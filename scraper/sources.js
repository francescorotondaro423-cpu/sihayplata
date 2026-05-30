'use strict';

/* ═══════════════════════════════════════════════════════════════════
   ESCUDO 1 — MULTIFUENTE (Redundancia)
   Define 3 fuentes independientes para obtener tasas ARS.
   Si una falla o devuelve datos insuficientes, el pipeline salta
   automáticamente a la siguiente.

   FUENTE 1: Puppeteer  — scraping con headless Chrome (JS rendering)
   FUENTE 2: HTTP Fetch — scraping liviano sin navegador
   FUENTE 3: Recálculo BADLAR — fallback matemático desde spreads previos
═══════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ARS_FILE = path.join(__dirname, '..', 'data', 'ars_rates.json');

/* ─────────────────────────────────────────────────────────────────
   UTILIDAD COMPARTIDA: extracción de TNA desde texto plano
───────────────────────────────────────────────────────────────── */
const TNA_RE     = /(?:(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?TNA|TNA\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*%)/gi;
const LOAN_RE    = /pr[eé]stamo|cr[eé]dito|cuota|financ|tarjeta/i;
const SAVINGS_RE = /ahorro|saldo|rend[ií]|cuenta|ganás|ganá|ganancia|plazo.?fijo|fondo|invertí/i;

function extractTNAFromText(rawText) {
  const lines      = rawText.split(/\n|\r/);
  const candidates = [];

  for (const line of lines) {
    if (LOAN_RE.test(line)) continue;
    let m;
    TNA_RE.lastIndex = 0;
    while ((m = TNA_RE.exec(line)) !== null) {
      const val = parseFloat((m[1] || m[2]).replace(',', '.'));
      if (val > 0 && val < 150) {
        candidates.push({ val, savings: SAVINGS_RE.test(line) });
      }
    }
  }

  if (!candidates.length) return null;

  const pool = candidates.filter(c => c.savings).length
    ? candidates.filter(c => c.savings)
    : candidates;

  const freq = {};
  for (const c of pool) freq[c.val] = (freq[c.val] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return parseFloat(sorted[0][0]);
}

/* ═══════════════════════════════════════════════════════════════════
   FUENTE 1 — Puppeteer (headless Chrome)
   Renderiza las páginas JS-heavy de cada app y extrae el TNA
   con la función de regex compartida.
═══════════════════════════════════════════════════════════════════ */
const PUPPETEER_APPS = [
  { app: 'Ualá',          url: 'https://www.uala.com.ar/',             waitMs: 4000 },
  { app: 'Naranja X',     url: 'https://naranjax.com/',                waitMs: 4000 },
  { app: 'Mercado Pago',  url: 'https://www.mercadopago.com.ar/',      waitMs: 5000 },
  { app: 'Personal Pay',  url: 'https://personal-pay.com.ar/',         waitMs: 4000 },
  { app: 'Brubank',       url: 'https://www.brubank.com/',             waitMs: 4000 },
  { app: 'Cocos Capital', url: 'https://cocoscapital.com.ar/',         waitMs: 4000 },
  { app: 'Fiwind',        url: 'https://fiwind.io/',                   waitMs: 3000 },
  { app: 'Lemon Cash',    url: 'https://www.lemon.me/ar',              waitMs: 4000 },
  { app: 'Prex',          url: 'https://www.prexcard.com.ar/',         waitMs: 4000 },
  { app: 'N1U',           url: 'https://n1u.app/',                     waitMs: 4000 },
  { app: 'Balanz',        url: 'https://balanz.com/',                  waitMs: 4000 },
  { app: 'Claro Pay',     url: 'https://www.claropay.com.ar/',         waitMs: 4000 },
];

async function _scrapeOneApp(page, { app, url, waitMs }) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await new Promise(r => setTimeout(r, waitMs));
    const text = await page.evaluate(() => document.body.innerText);
    const tna  = extractTNAFromText(text);
    if (tna === null) return { app, ok: false, reason: 'TNA no encontrada en la página' };
    return { app, ok: true, tna };
  } catch (err) {
    return { app, ok: false, reason: err.message.slice(0, 100) };
  }
}

async function sourcePuppeteer() {
  const { default: puppeteer } = await import('puppeteer');
  console.log('[source:puppeteer] Iniciando navegador headless…');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    const details = [];
    for (const appConf of PUPPETEER_APPS) {
      const r = await _scrapeOneApp(page, appConf);
      details.push(r);
      if (r.ok) console.log(`[source:puppeteer]  ✓ ${r.app}: ${r.tna}% TNA`);
      else      console.warn(`[source:puppeteer]  ✗ ${r.app}: ${r.reason}`);
    }

    const rates = details.filter(r => r.ok).map(({ app, tna }) => ({ app, tna }));
    const failed = details.filter(r => !r.ok);

    return {
      ok:      rates.length > 0,
      rates,
      details,
      failed,
      reason: rates.length === 0 ? 'Ningún app devolvió TNA válida' : undefined,
    };
  } finally {
    await browser.close();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   FUENTE 2 — HTTP Fetch (sin navegador)
   Intenta obtener datos de páginas comparadoras públicas usando
   requests HTTP directos con headers de browser real.
   Parsea el HTML con regex para encontrar TNAs junto a nombres de apps.
═══════════════════════════════════════════════════════════════════ */
const HTTP_ENDPOINTS = [
  {
    name: 'comparatasas.ar',
    url:  'https://comparatasas.ar/',
  },
  {
    name: 'ElEconomista — rendimientos',
    url:  'https://eleconomista.com.ar/especial/rendimientos',
  },
  {
    name: 'iProfesional — billeteras',
    url:  'https://www.iprofesional.com/finanzas/455670-billeteras-virtuales-suben-tasa-26-por-ciento-dejan-atras-plazo-fijo-bancario-mayo-2026',
  },
];

// Apps conocidas a buscar en el texto HTML
const KNOWN_APPS = [
  'Ualá', 'Naranja X', 'Mercado Pago', 'Personal Pay', 'Brubank',
  'Cocos Capital', 'Fiwind', 'Lemon Cash', 'Prex', 'N1U',
  'Balanz', 'IEB+', 'Claro Pay', 'Global66', 'Adcap', 'Reba',
  'Personal Pay', 'Cuenta DNI', 'Bibank', 'Banco Del Sol',
];

function _parseRatesFromHTML(html) {
  // Convierte HTML a texto plano básico quitando tags
  const text  = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const rates = [];

  for (const appName of KNOWN_APPS) {
    const idx = text.indexOf(appName);
    if (idx === -1) continue;

    // Ventana de contexto: 200 chars antes y después del nombre
    const window = text.slice(Math.max(0, idx - 30), idx + 200);

    // Busca porcentajes en esa ventana
    const matches = [...window.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g)];
    for (const m of matches) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val >= 10 && val <= 45) {
        rates.push({ app: appName, tna: val });
        break;
      }
    }
  }

  // Deduplica: si hay múltiples menciones de la misma app, toma el promedio
  const grouped = {};
  for (const r of rates) {
    if (!grouped[r.app]) grouped[r.app] = [];
    grouped[r.app].push(r.tna);
  }

  return Object.entries(grouped).map(([app, tnas]) => ({
    app,
    tna: parseFloat((tnas.reduce((a, b) => a + b, 0) / tnas.length).toFixed(2)),
  }));
}

const HTTP_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
};

async function sourceHTTP() {
  for (const endpoint of HTTP_ENDPOINTS) {
    console.log(`[source:http] Intentando: ${endpoint.name}`);
    try {
      const res = await fetch(endpoint.url, {
        headers: HTTP_HEADERS,
        signal:  AbortSignal.timeout(12_000),
        redirect: 'follow',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const html  = await res.text();
      const rates = _parseRatesFromHTML(html);

      if (rates.length >= 3) {
        console.log(`[source:http] ✓ ${endpoint.name} — ${rates.length} apps encontradas`);
        return { ok: true, rates, source: endpoint.name };
      }

      console.warn(`[source:http] ✗ ${endpoint.name} — solo ${rates.length} apps (insuficiente)`);

    } catch (err) {
      console.warn(`[source:http] ✗ ${endpoint.name} — ${err.message}`);
    }
  }

  return {
    ok:     false,
    rates:  [],
    reason: 'Todos los endpoints HTTP fallaron o devolvieron datos insuficientes',
  };
}

/* ═══════════════════════════════════════════════════════════════════
   FUENTE 3 — Recálculo BADLAR (Fallback matemático garantizado)
   Lee los spreads existentes en ars_rates.json y los recalcula
   contra el BADLAR actual. Siempre devuelve datos si el JSON existe.
   Usa validación blanda (rango más amplio) en el pipeline.
═══════════════════════════════════════════════════════════════════ */
async function sourceBADLARRecalc(badlar) {
  let currentData;
  try {
    currentData = JSON.parse(fs.readFileSync(ARS_FILE, 'utf8'));
  } catch (err) {
    return {
      ok:     false,
      rates:  [],
      reason: `No se pudo leer ars_rates.json: ${err.message}`,
    };
  }

  if (!Array.isArray(currentData?.items) || currentData.items.length === 0) {
    return { ok: false, rates: [], reason: 'ars_rates.json está vacío o corrupto' };
  }

  const rates = currentData.items.map(item => ({
    app: item.app,
    tna: parseFloat((badlar + item.spread).toFixed(2)),
  }));

  console.log(`[source:recalc] ✓ BADLAR ${badlar}% → ${rates.length} apps recalculadas desde spreads previos`);
  return { ok: true, rates };
}

module.exports = { sourcePuppeteer, sourceHTTP, sourceBADLARRecalc };
