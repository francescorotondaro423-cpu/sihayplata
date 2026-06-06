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

  /* Si PUPPETEER_SKIP_DOWNLOAD=true, Chrome no fue descargado — falla rápido */
  const execPath = puppeteer.executablePath?.();
  if (execPath && !require('fs').existsSync(execPath)) {
    console.warn('[source:puppeteer] Chrome no disponible (PUPPETEER_SKIP_DOWNLOAD=true) — usando fuentes HTTP');
    return { ok: false, rates: [], reason: 'Chrome no instalado (build sin Chromium)' };
  }

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
   Intenta TODOS los endpoints en paralelo y mergea todos los
   resultados. Así una sola fuente que quede stale no bloquea el resto.
═══════════════════════════════════════════════════════════════════ */

// URLs permanentes de secciones (no artículos individuales)
const HTTP_ENDPOINTS = [
  { name: 'comparatasas.ar',              url: 'https://comparatasas.ar/' },
  { name: 'ElEconomista — rendimientos',  url: 'https://eleconomista.com.ar/especial/rendimientos' },
  { name: 'Ambito — billeteras',          url: 'https://www.ambito.com/economia/billeteras-virtuales' },
  { name: 'Cronista — billeteras',        url: 'https://www.cronista.com/finanzas-mercados/billeteras-digitales/' },
  { name: 'iProfesional — billeteras',    url: 'https://www.iprofesional.com/finanzas/billeteras-virtuales' },
];

// Aliases: formas alternativas con que puede aparecer cada app en el HTML
const APP_ALIASES = {
  'Mercado Pago':  ['Mercado Pago', 'MercadoPago'],
  'Lemon Cash':    ['Lemon Cash', 'Lemon'],
  'Personal Pay':  ['Personal Pay', 'PersonalPay'],
  'Naranja X':     ['Naranja X', 'NaranjaX'],
  'Cocos Capital': ['Cocos Capital', 'Cocos'],
  'Claro Pay':     ['Claro Pay', 'ClaroPay'],
  'Cuenta DNI':    ['Cuenta DNI', 'CuentaDNI'],
  'Banco Del Sol': ['Banco Del Sol', 'BancoDelSol'],
  'IEB+':          ['IEB+', 'IEB +'],
  'Ualá':          ['Ualá', 'Uala'],
  'Balanz':        ['Balanz'],
  'Brubank':       ['Brubank'],
  'Adcap':         ['Adcap'],
  'Global66':      ['Global66'],
  'Fiwind':        ['Fiwind'],
  'Prex':          ['Prex'],
  'N1U':           ['N1U'],
  'Reba':          ['Reba'],
  'Bibank':        ['Bibank'],
};

function _parseRatesFromHTML(html) {
  const text  = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const found = new Map(); // canonical app name → best TNA

  for (const [canonical, aliases] of Object.entries(APP_ALIASES)) {
    for (const alias of aliases) {
      const idx = text.indexOf(alias);
      if (idx === -1) continue;

      // Solo mira hacia adelante desde el nombre (evita capturar la tasa de la app anterior)
      const ctx     = text.slice(idx + alias.length, idx + alias.length + 250);
      const matches = [...ctx.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g)];

      for (const m of matches) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (val >= 10 && val <= 45) {
          // Si ya hay un valor para esta app, toma el más alto (rendimiento max visible)
          if (!found.has(canonical) || val > found.get(canonical)) {
            found.set(canonical, val);
          }
          break;
        }
      }

      if (found.has(canonical)) break; // alias encontrado — no busca más aliases
    }
  }

  return [...found.entries()].map(([app, tna]) => ({ app, tna }));
}

const HTTP_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
};

async function _fetchEndpoint(endpoint) {
  try {
    const res = await fetch(endpoint.url, {
      headers:  HTTP_HEADERS,
      signal:   AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const html  = await res.text();
    const rates = _parseRatesFromHTML(html);
    console.log(`[source:http] ✓ ${endpoint.name} — ${rates.length} apps`);
    return { ok: true, rates };
  } catch (err) {
    console.warn(`[source:http] ✗ ${endpoint.name} — ${err.message}`);
    return { ok: false, rates: [] };
  }
}

async function sourceHTTP() {
  // Lanza todos los endpoints en paralelo
  const results = await Promise.all(HTTP_ENDPOINTS.map(_fetchEndpoint));

  // Mergea: por app, toma el promedio de todos los valores encontrados
  const accumulated = new Map(); // app → TNA[]
  for (const { rates } of results) {
    for (const r of rates) {
      if (!accumulated.has(r.app)) accumulated.set(r.app, []);
      accumulated.get(r.app).push(r.tna);
    }
  }

  if (accumulated.size === 0) {
    return {
      ok:     false,
      rates:  [],
      reason: 'Todos los endpoints HTTP fallaron o no encontraron apps',
    };
  }

  const merged = [...accumulated.entries()].map(([app, tnas]) => ({
    app,
    tna: parseFloat((tnas.reduce((a, b) => a + b, 0) / tnas.length).toFixed(2)),
  }));

  const successCount = results.filter(r => r.ok && r.rates.length > 0).length;
  console.log(`[source:http] Merge final: ${merged.length} apps de ${successCount}/${HTTP_ENDPOINTS.length} endpoints`);
  return { ok: true, rates: merged, source: `HTTP multi-endpoint (${successCount}/${HTTP_ENDPOINTS.length})` };
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

/* ═══════════════════════════════════════════════════════════════════
   FUENTE 4 — ArgentinaDatos API (FCI directos — datos CNV oficiales)
   Obtiene la TNA real de fondos específicos desde la API pública de
   argentinadatos.com, que agrega datos de cuotapartes de la CNV.
   Se usa como fuente autoritativa app por app; corre antes del waterfall.
   Agregar más apps en ARGENTINADATOS_FCI_MAP a medida que se verifican.
═══════════════════════════════════════════════════════════════════ */

// Mapping: app de nuestra app → fondo en argentinadatos (siempre Clase A = clase retail)
const ARGENTINADATOS_FCI_MAP = [
  { app: 'Mercado Pago', fondoNombre: 'Mercado Fondo', clase: 'Clase A' },
];

async function sourceArgentinaDatos() {
  const API_URL = 'https://api.argentinadatos.com/v1/finanzas/fci/fondos';
  try {
    const res = await fetch(API_URL, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const data   = await res.json();
    const fondos = data.fondos || [];

    const rates = [];
    for (const { app, fondoNombre, clase } of ARGENTINADATOS_FCI_MAP) {
      const match = fondos.find(f =>
        f.nombre.toLowerCase().startsWith(fondoNombre.toLowerCase()) &&
        f.nombre.toLowerCase().includes(clase.toLowerCase())
      );

      if (!match) {
        console.warn(`[source:argentinadatos] ✗ ${app}: "${fondoNombre} - ${clase}" no encontrado`);
        continue;
      }

      const tna = match.rendimientos?.ultimos7Dias;
      if (tna == null || typeof tna !== 'number' || !isFinite(tna) || tna <= 0) {
        console.warn(`[source:argentinadatos] ✗ ${app}: TNA no disponible (${tna})`);
        continue;
      }

      console.log(`[source:argentinadatos] ✓ ${app}: ${tna}% TNA (últimos 7d, CNV)`);
      rates.push({ app, tna });
    }

    return { ok: rates.length > 0, rates, reason: rates.length === 0 ? 'Ningún fondo mapeado devolvió TNA' : undefined };
  } catch (err) {
    console.warn(`[source:argentinadatos] ERROR: ${err.message}`);
    return { ok: false, rates: [], reason: err.message };
  }
}

module.exports = { sourcePuppeteer, sourceHTTP, sourceBADLARRecalc, sourceArgentinaDatos };
