'use strict';

require('dotenv').config();

const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const cron      = require('node-cron');
const compress  = require('compression');
const rateLimit = require('express-rate-limit');
const { runScraper } = require('./scraper');

/* ── Módulo Promotions (Supermercados v2) ── */
const promotionRouter = require('./controllers/promotions/PromotionController');
const syncJob         = require('./jobs/promotionSyncJob');
const promotionSvc    = require('./services/promotions/PromotionService');

/* ── Módulo Movilidad y Transporte ── */
const mobilityRouter = require('./controllers/mobility/MobilityController');
const mobilitySvc    = require('./services/mobility/MobilityService');

/* ── Módulo Combustibles ── */
const fuelRouter = require('./controllers/fuel/FuelController');
const fuelSvc    = require('./services/fuel/FuelService');

const app  = express();
const PORT = process.env.PORT || 8080;

/* ── Compresión gzip/brotli en todas las respuestas ── */
app.use(compress());

/* ── Rate limiters ── */
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá más tarde' },
});

const impressionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─────────────────────────────────────────────────────────────
   PERFILES ARS  —  cargados desde archivo (actualizado por scraper)
   Fallback hardcodeado si el archivo no existe.
───────────────────────────────────────────────────────────── */
const ARS_FILE = path.join(__dirname, 'data', 'ars_rates.json');

const ARS_FALLBACK = [
  { app:'Cocos Capital',    type:'fci',    section:'variable',    spread: 1.58, promo:false, limit:'Sin Límite',       info:'FCI Renta Mixta T+0' },
  { app:'IOL',              type:'fci',    section:'variable',    spread: 0.86, promo:false, limit:'Sin Límite',       info:'IOL Cash FCI Money Market T+0' },
  { app:'Adcap',            type:'fci',    section:'variable',    spread:-2.86, promo:false, limit:'Sin Límite',       info:'Adcap Fondo Dinero T+0' },
  { app:'Global66',         type:'fci',    section:'variable',    spread:-2.96, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0' },
  { app:'Personal Pay',     type:'fci',    section:'variable',    spread:-3.29, promo:false, limit:'Sin Límite',       info:'FCI MM · nivel 2+ requerido' },
  { app:'Mercado Pago',     type:'fci',    section:'variable',    spread:-3.37, promo:false, limit:'Sin Límite',       info:'FCI Mercado Fondo T+0' },
  { app:'Toronto Trust',    type:'fci',    section:'variable',    spread:-3.39, promo:false, limit:'Sin Límite',       info:'Toronto Ahorro FCI MM T+0' },
  { app:'IEB+',             type:'fci',    section:'variable',    spread:-4.09, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0' },
  { app:'Balanz',           type:'fci',    section:'variable',    spread:-4.09, promo:false, limit:'Sin Límite',       info:'FCI Balanz Ahorro T+0' },
  { app:'Claro Pay',        type:'fci',    section:'variable',    spread:-4.18, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0' },
  { app:'PPI',              type:'fci',    section:'variable',    spread:-4.06, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0 · Portfolio Personal' },
  { app:'Bull Market',      type:'fci',    section:'variable',    spread:-4.06, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0' },
  { app:'Lemon Cash',       type:'fci',    section:'variable',    spread:-4.48, promo:false, limit:'Sin Límite',       info:'FCI Lemon Ahorro T+0' },
  { app:'N1U',              type:'fci',    section:'variable',    spread:-5.76, promo:false, limit:'Sin Límite',       info:'FCI Money Market T+0' },
  { app:'AstroPay',         type:'fci',    section:'variable',    spread:-6.28, promo:false, limit:'Sin Límite',       info:'FCI MM · Southern Trust' },
  { app:'LB Finanzas',      type:'fci',    section:'variable',    spread:-6.28, promo:false, limit:'Sin Límite',       info:"FCI MM · ex Let's Bit" },
  { app:'Prex',             type:'cuenta', section:'variable',    spread:-2.53, promo:false, limit:'Sin Límite',       info:'Cuenta remunerada diaria' },
  { app:'Cuenta DNI',       type:'cuenta', section:'variable',    spread:-2.06, promo:false, limit:'Sin Límite',       info:'Banco Provincia · acreditación diaria' },
  { app:'Reba',             type:'cuenta', section:'variable',    spread:-2.56, promo:false, limit:'Sin Límite',       info:'Cuenta remunerada diaria' },
  { app:'Naranja X',        type:'cuenta', section:'variable',    spread:-3.56, promo:false, limit:'Hasta $750.000',   info:'Tope mensual al saldo remunerado' },
  { app:'Carrefour Banco',  type:'cuenta', section:'variable',    spread:-3.56, promo:false, limit:'Sin Límite',       info:'Cuenta Digital Mi Carrefour · BSF' },
  { app:'Brubank',          type:'cuenta', section:'variable',    spread:-5.06, promo:false, limit:'Hasta $500.000',   info:'Acreditación automática 24/7' },
  { app:'Crédito Regional', type:'plazo',  section:'garantizado', spread: 3.94, promo:false, limit:'Sin Límite',       info:'Compañía Financiera · Plazo Fijo 30d · tasa líder' },
  { app:'Banco VOII',       type:'plazo',  section:'garantizado', spread: 3.44, promo:false, limit:'Sin Límite',       info:'Banco Regional · Plazo Fijo 30d' },
  { app:'Banco Meridian',   type:'plazo',  section:'garantizado', spread: 2.44, promo:false, limit:'Sin Límite',       info:'Banco Regional · Plazo Fijo 30d' },
  { app:'Bibank',           type:'plazo',  section:'garantizado', spread: 2.44, promo:false, limit:'Sin Límite',       info:'Banco Digital · Plazo Fijo 30d' },
  { app:'Banco Masventas',  type:'plazo',  section:'garantizado', spread: 2.44, promo:false, limit:'Sin Límite',       info:'Banco Regional · Plazo Fijo 30d' },
  { app:'Banco CMF',        type:'plazo',  section:'garantizado', spread: 1.69, promo:false, limit:'Sin Límite',       info:'Banco · Plazo Fijo 30d' },
  { app:'Banco Bica',       type:'plazo',  section:'garantizado', spread: 1.44, promo:false, limit:'Sin Límite',       info:'Banco Regional · Cuenta Click disponible' },
  { app:'Banco Del Sol',    type:'plazo',  section:'garantizado', spread: 0.44, promo:false, limit:'Sin Límite',       info:'Banco Digital · Plazo Fijo 30d' },
  { app:'Banco Mariva',     type:'plazo',  section:'garantizado', spread:-0.56, promo:false, limit:'Sin Límite',       info:'Banco · Plazo Fijo 30d' },
  { app:'Banco Provincia',  type:'plazo',  section:'garantizado', spread:-2.06, promo:false, limit:'Sin Límite',       info:'Banco Provincial BsAs · PF online y sucursal' },
  { app:'Banco Hipotecario',type:'plazo',  section:'garantizado', spread:-2.56, promo:false, limit:'Sin Límite',       info:'Banco Nacional · Plazo Fijo 30d' },
  { app:'Banco Macro',      type:'plazo',  section:'garantizado', spread:-2.56, promo:false, limit:'Sin Límite',       info:'Plazo Fijo 30d · sucursales y app' },
  { app:'ICBC',             type:'plazo',  section:'garantizado', spread:-2.76, promo:false, limit:'Sin Límite',       info:'Banco Internacional · Plazo Fijo online' },
  { app:'BBVA',             type:'plazo',  section:'garantizado', spread:-2.81, promo:false, limit:'Sin Límite',       info:'Plazo Fijo online y sucursal' },
  { app:'Banco Nación',     type:'plazo',  section:'garantizado', spread:-3.06, promo:false, limit:'Sin Límite',       info:'Plazo Fijo 30d · sucursales nacionales' },
  { app:'Banco Galicia',    type:'plazo',  section:'garantizado', spread:-3.31, promo:false, limit:'Sin Límite',       info:'Plazo Fijo 30d · sucursales y app' },
  { app:'Banco Ciudad',     type:'plazo',  section:'garantizado', spread:-3.56, promo:false, limit:'Sin Límite',       info:'Banco Municipal GCBA · Plazo Fijo 30d' },
  { app:'Banco Comafi',     type:'plazo',  section:'garantizado', spread:-3.56, promo:false, limit:'Sin Límite',       info:'Banco Nacional · Plazo Fijo 30d' },
  { app:'Supervielle',      type:'plazo',  section:'garantizado', spread:-3.56, promo:false, limit:'Sin Límite',       info:'Banco Nacional · Plazo Fijo 30d y app' },
  { app:'Banco Credicoop',  type:'plazo',  section:'garantizado', spread:-4.06, promo:false, limit:'Sin Límite',       info:'Banco Cooperativo · Plazo Fijo 30d' },
  { app:'Banco Patagonia',  type:'plazo',  section:'garantizado', spread:-4.06, promo:false, limit:'Sin Límite',       info:'Banco Nacional · Plazo Fijo 30d' },
  { app:'Bind',             type:'plazo',  section:'garantizado', spread:-5.06, promo:false, limit:'Sin Límite',       info:'Banco Industrial · Plazo Fijo Digital 30d' },
  { app:'Fiwind',           type:'plazo',  section:'garantizado', spread:-5.36, promo:false, limit:'Sin Límite',       info:'Plazo Fijo Digital, mínimo 30 días' },
  { app:'Santander',        type:'plazo',  section:'garantizado', spread:-6.56, promo:false, limit:'Sin Límite',       info:'Plazo Fijo online y sucursal' },
  { app:'Ualá',             type:'cuenta', section:'especial',    spread: 4.44, promo:true,  limit:'Hasta $3.000.000', info:'Tasa promo 90 días, solo nuevos usuarios', condicion:'Solo nuevos usuarios · Primeros 90 días' },
];

function loadARSData() {
  try {
    if (fs.existsSync(ARS_FILE)) return JSON.parse(fs.readFileSync(ARS_FILE, 'utf8'));
  } catch {}
  return { items: ARS_FALLBACK, sourceLabel: 'Spreads estimados (fallback)' };
}

/* ─────────────────────────────────────────────────────────────
   CACHÉ EN MEMORIA
   TTL 1 hora para rates, 24 hs para historial.
   Si la API cae devuelve el dato stale con aviso.
───────────────────────────────────────────────────────────── */
class Cache {
  constructor(ttlMs) {
    this.ttl  = ttlMs;
    this._v   = null;
    this._ts  = 0;
  }
  valid()      { return this._v !== null && Date.now() - this._ts < this.ttl; }
  set(v)       { this._v = v; this._ts = Date.now(); }
  get()        { return this.valid() ? this._v : null; }
  stale()      { return this._v; }
  invalidate() { this._v = null; }
  ageSeconds() { return this._v ? Math.floor((Date.now() - this._ts) / 1000) : null; }
}

const ratesCache = new Cache(60 * 60 * 1000);       // 1 hora

/* ─────────────────────────────────────────────────────────────
   FECHAS
───────────────────────────────────────────────────────────── */
const fmtDate = d  => d.toISOString().slice(0, 10);
const today   = () => fmtDate(new Date());
const daysAgo = n  => fmtDate(new Date(Date.now() - n * 86400000));

function parseTope(limit) {
  if (!limit || limit === 'Sin Límite') return null;
  const clean = limit.replace(/[^0-9.]/g, '');
  const num   = parseInt(clean.replace(/\./g, ''), 10);
  return isNaN(num) ? null : num;
}

/* ─────────────────────────────────────────────────────────────
   BCRA API v4.0
   GET /estadisticas/v4.0/monetarias/{varId}?desde=&hasta=
   Respuesta: { results:[{ idVariable, detalle:[{fecha,valor}] }] }
   detalle viene ordenado más nuevo primero.
───────────────────────────────────────────────────────────── */
async function fetchBCRA(varId, desde, hasta) {
  const url = `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${varId}?desde=${desde}&hasta=${hasta}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'FinRankAR/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BCRA HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

async function getBADLAR() {
  const json    = await fetchBCRA(7, daysAgo(25), today());
  const detalle = json?.results?.[0]?.detalle;
  if (!detalle?.length) throw new Error('BCRA: detalle vacío para variable 7');
  return {
    value:   detalle[0].valor,
    date:    detalle[0].fecha,
    history: detalle.slice(0, 60).map(d => ({ date: d.fecha, value: d.valor })),
  };
}

/* ─────────────────────────────────────────────────────────────
   HISTORIAL (archivo JSON, guarda hasta 90 días)
───────────────────────────────────────────────────────────── */
const HISTORY_FILE   = path.join(__dirname, 'data', 'history.json');
const HISTORIAL_FILE = path.join(__dirname, 'data', 'historial_apps.json');

function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {}
  return { badlar: [] };
}

function appendHistory(date, value) {
  const h = readHistory();
  if (h.badlar.find(e => e.date === date)) return; // no duplicar
  h.badlar.unshift({ date, value });
  h.badlar = h.badlar.slice(0, 90);
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); } catch(e) {
    console.error('[history] Error escribiendo:', e.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   HISTORIAL DE APPS (archivo JSON, guarda hasta 90 días por app)
───────────────────────────────────────────────────────────── */
function readHistorialApps() {
  try {
    if (fs.existsSync(HISTORIAL_FILE)) return JSON.parse(fs.readFileSync(HISTORIAL_FILE, 'utf8'));
  } catch {}
  return {};
}

function seedHistorialIfEmpty(arsItems) {
  if (fs.existsSync(HISTORIAL_FILE)) return;
  const h   = {};
  const now = Date.now();
  for (const item of arsItems) {
    const tope  = parseTope(item.limit);
    const list  = [];
    const delta = (Math.random() - 0.5) * 8;
    for (let i = 29; i >= 0; i--) {
      const date     = fmtDate(new Date(now - i * 86400000));
      const progress = (29 - i) / 29;
      const base     = item.tna + delta * (1 - progress);
      const noise    = (Math.random() - 0.5) * 0.6;
      list.push({ date, tna: parseFloat((base + noise).toFixed(2)), tope });
    }
    h[item.app] = list;
  }
  try {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(h, null, 2));
    console.log(`[historial] Inicializado con 30 días de ejemplo (${arsItems.length} apps)`);
  } catch (e) { console.error('[historial] Error inicializando:', e.message); }
}

async function runDailyHistorialSnapshot() {
  console.log(`[cron-historial] Snapshot — ${new Date().toISOString()}`);
  try {
    const { value: badlar } = await getBADLAR();
    const arsData  = loadARSData();
    const arsItems = arsData.items.map(p => ({
      ...p,
      tna: parseFloat((badlar + p.spread).toFixed(2)),
    }));
    const h    = readHistorialApps();
    const date = today();
    let updated = 0;
    for (const item of arsItems) {
      if (!h[item.app]) h[item.app] = [];
      if (h[item.app].find(e => e.date === date)) continue;
      h[item.app].unshift({ date, tna: item.tna, tope: parseTope(item.limit) });
      h[item.app] = h[item.app].slice(0, 90);
      updated++;
    }
    fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(h, null, 2));
    console.log(`[cron-historial] Guardado: ${updated} apps · ${date}`);
  } catch (err) { console.error('[cron-historial] Error:', err.message); }
}

/* ─────────────────────────────────────────────────────────────
   USD RATES (archivo JSON editado manualmente o vía POST /api/usd)
───────────────────────────────────────────────────────────── */
const USD_FILE = path.join(__dirname, 'data', 'usd_rates.json');

function loadUSD() {
  try {
    if (fs.existsSync(USD_FILE)) return JSON.parse(fs.readFileSync(USD_FILE, 'utf8'));
  } catch {}
  return {
    sourceLabel:      'Sin datos USD configurados',
    lastManualUpdate: null,
    items:            [],
  };
}

/* ─────────────────────────────────────────────────────────────
   BUILDER PRINCIPAL
───────────────────────────────────────────────────────────── */
async function buildRates() {
  const badlarData = await getBADLAR();
  const { value: badlar, date: badlarDate, history } = badlarData;

  appendHistory(badlarDate, badlar);

  const arsData  = loadARSData();
  const arsItems = arsData.items
    .map(p => ({
      ...p,
      // tnaDirecta: TNA real de API (FCI/CNV). No pasa por BADLAR+spread.
      // Sin tnaDirecta: tasa bancaria definida como BADLAR + spread fijo.
      tna:    p.tnaDirecta != null
        ? parseFloat(p.tnaDirecta.toFixed(2))
        : parseFloat((badlar + p.spread).toFixed(2)),
      src:    p.src || 'BCRA',
      change: 0,
    }))
    .sort((a, b) => b.tna - a.tna)
    .map((x, i) => ({ ...x, id: i + 1 }));

  seedHistorialIfEmpty(arsItems);

  const usdData = loadUSD();

  const scraperInfo = arsData.lastScraperRun
    ? ` · Scraper: ${arsData.lastScraperRun.slice(0, 10)}`
    : ' · spreads estimados';

  return {
    ars: {
      items:           arsItems,
      badlar,
      badlarDate,
      badlarHistory:   history,
      lastScraperRun:  arsData.lastScraperRun || null,
      scraperStatus:   arsData.scraperStatus  || {},
      sourceLabel:     `BCRA v4.0 · BADLAR ${badlar.toFixed(2)}% (${badlarDate})${scraperInfo}`,
    },
    usd: {
      items:       usdData.items,
      sourceLabel: usdData.sourceLabel,
      lastUpdate:  usdData.lastManualUpdate,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      cachePolicy: '1 hora',
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   EXPRESS
───────────────────────────────────────────────────────────── */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* GET /api/rates — principal */
app.get('/api/rates', async (req, res) => {
  const forceRefresh = req.query.force === '1';

  if (!forceRefresh) {
    const cached = ratesCache.get();
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
      return res.json({
        ...cached,
        _cache: { hit: true, ageSeconds: ratesCache.ageSeconds() },
      });
    }
  }

  try {
    const data = await buildRates();
    ratesCache.set(data);
    console.log(`[${new Date().toISOString()}] Rates actualizados — BADLAR: ${data.ars.badlar}%`);
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    return res.json({ ...data, _cache: { hit: false } });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error: ${err.message}`);
    const stale = ratesCache.stale();
    if (stale) {
      return res.status(200).json({
        ...stale,
        _cache: { hit: true, stale: true, ageSeconds: ratesCache.ageSeconds() },
        _error: `API temporalmente no disponible. Mostrando datos de hace ${ratesCache.ageSeconds()}s.`,
      });
    }
    return res.status(503).json({ error: 'Servicio no disponible', detail: err.message });
  }
});

/* GET /api/rates/history — historial BADLAR para gráficos */
app.get('/api/rates/history', (req, res) => {
  res.json(readHistory());
});

/* GET /api/health */
app.get('/api/health', (req, res) => {
  res.json({
    status:      'ok',
    uptime:      Math.floor(process.uptime()),
    cacheValid:  ratesCache.valid(),
    cacheAge:    ratesCache.ageSeconds(),
    nodeVersion: process.version,
    timestamp:   new Date().toISOString(),
  });
});

/* POST /api/usd — actualizar tasas USD manualmente (protegido con API key) */
app.post('/api/usd', (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const { items, sourceLabel } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '`items` requerido y debe ser array' });
  }
  const payload = {
    sourceLabel:      sourceLabel || 'Actualizado manualmente',
    lastManualUpdate: today(),
    items:            items.map((x, i) => ({ ...x, id: i + 1, src: '~ref', change: x.change ?? 0 })),
  };
  try {
    fs.writeFileSync(USD_FILE, JSON.stringify(payload, null, 2));
    ratesCache.invalidate();
    console.log(`[${new Date().toISOString()}] USD rates actualizados (${items.length} apps)`);
    res.json({ ok: true, count: items.length, date: today() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/ars — actualizar tasas ARS manualmente (spreads o TNA absoluta) */
app.post('/api/ars', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '`items` requerido y debe ser array' });
  }

  // Si se envía `tna` en lugar de `spread`, calcula el spread con BADLAR actual
  let badlar = null;
  const needsBadlar = items.some(i => i.tna !== undefined && i.spread === undefined);
  if (needsBadlar) {
    try {
      const b = await getBADLAR();
      badlar = b.value;
    } catch {
      return res.status(503).json({ error: 'No se pudo obtener BADLAR para calcular spreads' });
    }
  }

  const data = loadARSData();

  for (const incoming of items) {
    const existing = data.items.find(i => i.app === incoming.app);
    if (!existing) continue;

    if (incoming.spread !== undefined) {
      existing.spread = incoming.spread;
    } else if (incoming.tna !== undefined) {
      existing.spread = parseFloat((incoming.tna - badlar).toFixed(2));
    }

    // Permite actualizar también metadatos opcionales
    if (incoming.promo   !== undefined) existing.promo   = incoming.promo;
    if (incoming.limit   !== undefined) existing.limit   = incoming.limit;
    if (incoming.info    !== undefined) existing.info    = incoming.info;
    existing.lastUpdated = today();
    existing.src         = 'manual';
  }

  data.sourceLabel = `Actualizado manualmente · ${today()}`;
  fs.writeFileSync(ARS_FILE, JSON.stringify(data, null, 2));
  ratesCache.invalidate();
  console.log(`[${new Date().toISOString()}] ARS rates actualizados manualmente (${items.length} items)`);
  res.json({ ok: true, count: items.length, badlarUsed: badlar });
});

/* POST /api/scraper/run — dispara el scraper manualmente */
app.post('/api/scraper/run', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  res.json({ ok: true, message: 'Scraper iniciado en segundo plano' });

  // Corre de forma asíncrona sin bloquear la respuesta
  (async () => {
    try {
      const { value: badlar } = await getBADLAR();
      const result = await runScraper(badlar);
      ratesCache.invalidate();
      console.log(`[scraper] Completado: ${result.ok}/${result.total} ok`);
    } catch (err) {
      console.error('[scraper] Error:', err.message);
    }
  })();
});

/* GET /api/scraper/status — estado del último scraper run */
app.get('/api/scraper/status', (req, res) => {
  const data = loadARSData();
  res.json({
    lastScraperRun: data.lastScraperRun || null,
    scraperStatus:  data.scraperStatus  || {},
  });
});

/* GET /api/scraper/health — frescura de datos por app */
app.get('/api/scraper/health', (req, res) => {
  const data  = loadARSData();
  const today = new Date().toISOString().slice(0, 10);

  const apps = (data.items || []).map(item => {
    const lastUpdated = item.lastUpdated;
    let ageDays = null;
    let status  = 'manual';

    if (lastUpdated && lastUpdated !== 'pre-scraper') {
      const diffMs = Date.now() - new Date(lastUpdated).getTime();
      ageDays      = Math.floor(diffMs / 86_400_000);
      status       = ageDays === 0 ? 'fresh' : ageDays <= 3 ? 'ok' : 'stale';
    }

    return {
      app:         item.app,
      spread:      item.spread,
      lastUpdated: lastUpdated || null,
      src:         item.src    || null,
      ageDays,
      status,
    };
  });

  const fresh  = apps.filter(a => a.status === 'fresh').length;
  const ok     = apps.filter(a => a.status === 'ok').length;
  const stale  = apps.filter(a => a.status === 'stale').length;
  const manual = apps.filter(a => a.status === 'manual').length;

  res.json({
    lastScraperRun:  data.lastScraperRun || null,
    sourceLabel:     data.sourceLabel    || null,
    summary: { total: apps.length, fresh, ok, stale, manual },
    apps,
  });
});

/* GET /api/rendimientos/historial/:appId */
app.get('/api/rendimientos/historial/:appId', (req, res) => {
  const { appId } = req.params;
  const h    = readHistorialApps();
  const data = (h[appId] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  res.json({ appId, data });
});

/* Caché en memoria para historico — evita llamar BCRA en cada request */
const historicoCache = new Map(); // key: `${appId}:${maxPts}` → { data, ts }
const HISTORICO_TTL  = 60 * 60 * 1000; // 1 hora

/* GET /api/rendimientos/historico/:appId — TNA calculada sobre BADLAR real (BCRA v4.0) */
app.get('/api/rendimientos/historico/:appId', async (req, res) => {
  const { appId }   = req.params;
  const maxPts      = Math.min(parseInt(req.query.points) || 180, 365);

  const arsData = loadARSData();
  const profile = arsData.items.find(i => i.app === appId);
  if (!profile) return res.status(404).json({ error: 'App no encontrada' });

  const { spread } = profile;
  const cacheKey   = `${appId}:${maxPts}`;

  /* Servir desde caché si existe y no venció */
  const hit = historicoCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < HISTORICO_TTL) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ ...hit.data, _cache: true });
  }

  try {
    // Buffer 2× para cubrir fines de semana y feriados (BCRA no publica todos los días)
    const json    = await fetchBCRA(7, daysAgo(maxPts * 2), today());
    const detalle = json?.results?.[0]?.detalle;
    if (!detalle?.length) throw new Error('BCRA: sin datos de BADLAR para el período');

    // detalle viene más-nuevo-primero; tomamos maxPts y revertimos (más-antiguo-primero)
    const data = detalle
      .slice(0, maxPts)
      .reverse()
      .map(d => ({
        date:   d.fecha,
        badlar: parseFloat(d.valor.toFixed(2)),
        tna:    parseFloat((d.valor + spread).toFixed(2)),
      }));

    const spreadType = profile.src === 'manual' ? 'verificado manualmente' : 'estimado (referencial)';

    const payload = {
      appId,
      spread,
      spreadType,
      source:      'BCRA — Estadísticas monetarias v4.0',
      variable:    'BADLAR PF entidades financieras privadas (Variable 7)',
      calcFormula: `TNA = BADLAR + ${spread >= 0 ? '+' : ''}${spread} pp (spread ${spreadType})`,
      disclaimer:  `El spread puede diferir del que publica la entidad. La TNA es calculada, no la tasa exacta que acredita cada plataforma.`,
      data,
    };

    historicoCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(payload);
  } catch (err) {
    console.error('[historico]', err.message);
    /* Servir stale si existe */
    const stale = historicoCache.get(cacheKey);
    if (stale) return res.json({ ...stale.data, _stale: true });
    res.status(503).json({ error: `BCRA no disponible: ${err.message}` });
  }
});

/* ─────────────────────────────────────────────────────────────
   MÓDULO TRANSPORTE
   Beneficios de transporte público y autopistas.
   La data vive en data/beneficios_transporte.json para que
   pueda actualizarse sin tocar código (Policy: Data Drift).
───────────────────────────────────────────────────────────── */
const TRANSPORTE_FILE = path.join(__dirname, 'data', 'beneficios_transporte.json');

function loadTransporte() {
  try {
    if (fs.existsSync(TRANSPORTE_FILE)) return JSON.parse(fs.readFileSync(TRANSPORTE_FILE, 'utf8'));
  } catch {}
  return { version: '2026-05', lastUpdated: today(), items: [] };
}

function saveTransporte(data) {
  try { fs.writeFileSync(TRANSPORTE_FILE, JSON.stringify(data, null, 2)); } catch (e) {
    console.error('[transporte] Error guardando:', e.message);
  }
}

/*
 * GET /api/transporte
 * Query params opcionales:
 *   grupo    = publico | autopistas
 *   metodo   = nfc | qr | tarjeta_contactless | google_pay | apple_pay | recarga_digital | telepase
 *   rubro    = subte | colectivo | tren | autopista | peaje
 *   dia      = 0-6  (día de semana, 0=domingo) — filtra si el beneficio tiene dias_semana definidos
 */
app.get('/api/transporte', (req, res) => {
  const data     = loadTransporte();
  const todayStr = today();
  const { grupo, metodo, rubro } = req.query;
  const diaNum   = req.query.dia != null ? parseInt(req.query.dia) : new Date().getDay();

  let items = data.items.filter(i => {
    if (!i.activo) return false;
    if (i.fecha_expiracion && i.fecha_expiracion < todayStr) return false;
    if (i.fecha_inicio    && i.fecha_inicio    > todayStr) return false;
    if (Array.isArray(i.dias_semana) && !i.dias_semana.includes(diaNum)) return false;
    return true;
  });

  if (grupo)  items = items.filter(i => i.grupo === grupo);
  if (metodo) items = items.filter(i => i.metodos_pago.includes(metodo));
  if (rubro)  items = items.filter(i => i.rubros.includes(rubro));

  res.json({
    version:     data.version,
    lastUpdated: data.lastUpdated,
    diaConsulta: diaNum,
    count:       items.length,
    items,
  });
});

/* POST /api/transporte/:id/reportar — crowdsourcing: usuario reporta que cambió */
app.post('/api/transporte/:id/reportar', reportLimiter, (req, res) => {
  const id   = parseInt(req.params.id);
  const data = loadTransporte();
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Beneficio no encontrado' });
  item.reportes_error = (item.reportes_error || 0) + 1;
  data.lastUpdated    = today();
  saveTransporte(data);
  console.log(`[transporte] Reporte de cambio: id=${id} (${item.entidad}) — total reportes: ${item.reportes_error}`);
  res.json({ ok: true, id, reportes_error: item.reportes_error });
});

/* PUT /api/transporte/:id — actualización editorial (admin, 1° de cada mes) */
app.put('/api/transporte/:id', (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'No autorizado' });
  const id  = parseInt(req.params.id);
  const data = loadTransporte();
  const idx  = data.items.findIndex(i => i.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
  data.items[idx] = { ...data.items[idx], ...req.body, id };
  data.lastUpdated = today();
  saveTransporte(data);
  console.log(`[transporte] Actualizado: id=${id} (${data.items[idx].entidad})`);
  res.json({ ok: true, item: data.items[idx] });
});

/* POST /api/transporte — crear nuevo beneficio (admin) */
app.post('/api/transporte', (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'No autorizado' });
  const data  = loadTransporte();
  const newId = data.items.length ? Math.max(...data.items.map(i => i.id)) + 1 : 1;
  const item  = { ...req.body, id: newId, reportes_error: 0 };
  data.items.push(item);
  data.lastUpdated = today();
  saveTransporte(data);
  console.log(`[transporte] Creado: id=${newId} (${item.entidad})`);
  res.json({ ok: true, item });
});

/* ─────────────────────────────────────────────────────────────
   MÓDULO PROMOTIONS v2 — Supermercados (arquitectura modular)
   Reemplaza el módulo Compras legacy. Ver controllers/promotions/.
───────────────────────────────────────────────────────────── */
app.use('/api/promotions', promotionRouter);
app.use('/api/wallets',      (_req, res) => res.redirect('/api/promotions/meta/wallets'));
app.use('/api/supermarkets', (_req, res) => res.redirect('/api/promotions/meta/supermarkets'));
app.use('/api/mobility',  mobilityRouter);
app.use('/api/fuel',      fuelRouter);

/* POST /api/rendimientos/snapshot — disparo manual (API key requerida) */
app.post('/api/rendimientos/snapshot', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json({ ok: true, message: 'Snapshot iniciado' });
  runDailyHistorialSnapshot();
});

/* ─────────────────────────────────────────────────────────────
   VERCEL CRON ENDPOINTS
   Llamados automáticamente por Vercel Cron según vercel.json.
   Protegidos con CRON_SECRET (header Authorization: Bearer).
───────────────────────────────────────────────────────────── */
function verifyCronSecret(req, res) {
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

app.get('/api/cron/scraper', async (req, res) => {
  if (!verifyCronSecret(req, res)) return;
  res.json({ ok: true, message: 'Scraper iniciado' });
  (async () => {
    try {
      const { value: badlar } = await getBADLAR();
      const result = await runScraper(badlar);
      ratesCache.invalidate();
      console.log(`[cron-vercel] Scraper completado: ${result.ok}/${result.total} ok`);
    } catch (err) {
      console.error('[cron-vercel] Scraper error:', err.message);
    }
  })();
});

app.get('/api/cron/snapshot', async (req, res) => {
  if (!verifyCronSecret(req, res)) return;
  res.json({ ok: true, message: 'Snapshot iniciado' });
  runDailyHistorialSnapshot();
});

/* GET /api/img-proxy — proxy de imágenes con Referer de lanacion.com.ar */
app.get('/api/img-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://resizer.glanacion.com/')) {
    return res.status(400).end();
  }
  try {
    const r = await fetch(url, {
      headers: {
        'Referer': 'https://www.lanacion.com.ar/',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return res.status(r.status).end();
    const ct = r.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    r.body.pipeTo(new WritableStream({ write(chunk) { res.write(chunk); }, close() { res.end(); } }));
  } catch {
    res.status(502).end();
  }
});

/* GET /api/news — proxy RSS argentina.gob.ar (evita CORS en el browser) */
app.get('/api/news', async (req, res) => {
  const FEEDS = [
    'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/',
    'https://www.lanacion.com.ar/arc/outboundfeeds/rss/',
  ];

  const parseItems = (xmlText) => {
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    const tagRe  = (t) => new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${t}>`, 'i');
    const items  = [];
    let m;
    while ((m = itemRe.exec(xmlText)) !== null) {
      const block   = m[1];
      const get     = t => { const r = tagRe(t).exec(block); return r ? r[1].trim() : ''; };
      const decodeHtml = s => s ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : s;
      const encl    = /<enclosure[^>]+url=["']([^"']+)["']/i.exec(block);
      const mc      = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block);
      const imgTag  = /<img[^>]+src=["']([^"']+)["']/i.exec(get('description'));
      const image   = decodeHtml((encl && encl[1]) || (mc && mc[1]) || (imgTag && imgTag[1]) || null);
      const rawDesc = get('description').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      let dateStr   = null;
      const pub     = get('pubDate');
      if (pub) try { dateStr = new Date(pub).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' }); } catch {}
      items.push({
        title:   get('title'),
        link:    get('link'),
        desc:    rawDesc.length > 200 ? rawDesc.slice(0, 200) + '…' : rawDesc,
        image:   image ? (image.startsWith('/') ? 'https://www.argentina.gob.ar' + image : (image.startsWith('https://resizer.glanacion.com/') ? '/api/img-proxy?url=' + encodeURIComponent(image) : image)) : null,
        dateStr,
      });
    }
    return items.filter(n => n.title && n.link).slice(0, 12);
  };

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed, {
        headers: { 'User-Agent': 'FinRankAR/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) continue;
      const text  = await r.text();
      const items = parseItems(text);
      if (items.length) return res.json({ ok: true, items });
    } catch {}
  }

  res.status(502).json({ ok: false, error: 'No se pudo acceder al feed de noticias.' });
});

/* ═══════════════════════════════════════════════════════════════
   ADS — Sistema de anuncios con tracking
═══════════════════════════════════════════════════════════════ */
const ADS_FILE  = path.join(__dirname, 'data', 'ads_analytics.json');

const ADVERTISEMENTS = [
  {
    id: 'cocos',
    name: 'Cocos Capital',
    tagline: 'Invertí en acciones, CEDEARs y fondos comunes desde Argentina.',
    cta: 'Conocer más',
    destinationUrl: 'https://www.cocos.capital/',
    // Programa de referidos: https://cocos.capital/referidos
    // Cuando obtengas tu código, setealo via PUT /api/ads/cocos/refcode
    affiliateUrlTemplate: 'https://cocos.capital/?ref={code}',
    refCode: '',
    route: 'cocos',
    brandColor: '#2AB187',
    bg: '#f0fdf8',
    textColor: '#0d3d2e',
    active: true,
    clicks: 0,
    impressions: 0,
  },
  {
    id: 'balanz',
    name: 'Balanz',
    tagline: 'Invertí de forma simple y profesional en el mercado de capitales.',
    cta: 'Ver plataforma',
    destinationUrl: 'https://balanz.com/',
    // Contactar: partnerships@balanz.com — negociar CPA directo
    affiliateUrlTemplate: 'https://balanz.com/?aff={code}',
    refCode: '',
    route: 'balanz',
    brandColor: '#0052CC',
    bg: '#eff6ff',
    textColor: '#003087',
    active: true,
    clicks: 0,
    impressions: 0,
  },
  {
    id: 'iol',
    name: 'Invertir Online',
    tagline: 'Acciones, bonos, CEDEARs y fondos. El broker líder de Argentina.',
    cta: 'Comenzar',
    destinationUrl: 'https://www.invertironline.com/',
    // Programa de afiliados: invertironline.com/afiliados
    affiliateUrlTemplate: 'https://www.invertironline.com/?ref={code}',
    refCode: '',
    route: 'iol',
    brandColor: '#E31837',
    bg: '#fff5f5',
    textColor: '#7f1d1d',
    active: true,
    clicks: 0,
    impressions: 0,
  },
  {
    id: 'lemon',
    name: 'Lemon',
    tagline: 'Cripto, pesos y rendimientos. Todo desde tu celular.',
    cta: 'Descubrir',
    destinationUrl: 'https://lemon.me/',
    // Programa de referidos en la app → Perfil → Invitar amigos
    affiliateUrlTemplate: 'https://lemon.me/invite/{code}',
    refCode: '',
    route: 'lemon',
    brandColor: '#F7B500',
    bg: '#fffbeb',
    textColor: '#713f12',
    active: true,
    clicks: 0,
    impressions: 0,
  },
  {
    id: 'belo',
    name: 'Belo',
    tagline: 'Cobrá, ahorrá e invertí en una sola app.',
    cta: 'Explorar',
    destinationUrl: 'https://belo.app/',
    // Programa de referidos en la app → Referidos
    affiliateUrlTemplate: 'https://belo.app/?ref={code}',
    refCode: '',
    route: 'belo',
    brandColor: '#7C3AED',
    bg: '#f5f3ff',
    textColor: '#4c1d95',
    active: true,
    clicks: 0,
    impressions: 0,
  },
];

/* Carga métricas y códigos de afiliado persistidos */
(function loadAdAnalytics() {
  try {
    const raw = JSON.parse(fs.readFileSync(ADS_FILE, 'utf8'));
    for (const saved of raw) {
      const ad = ADVERTISEMENTS.find(a => a.id === saved.id);
      if (ad) {
        ad.clicks      = saved.clicks      || 0;
        ad.impressions = saved.impressions || 0;
        if (saved.refCode) ad.refCode = saved.refCode;
      }
    }
  } catch {}
})();

function saveAdAnalytics() {
  try {
    const payload = ADVERTISEMENTS.map(({ id, clicks, impressions, refCode }) => ({ id, clicks, impressions, refCode }));
    fs.writeFileSync(ADS_FILE, JSON.stringify(payload, null, 2));
  } catch {}
}

/* Construye la URL final con código de afiliado + UTM params */
function buildRedirectUrl(ad, position) {
  const utm = `utm_source=sihayplata&utm_medium=banner&utm_campaign=${ad.id}&utm_content=${position}`;
  let base;
  if (ad.refCode && ad.affiliateUrlTemplate) {
    base = ad.affiliateUrlTemplate.replace('{code}', ad.refCode);
  } else {
    base = ad.destinationUrl;
  }
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${utm}`;
}

const adClickLog = [];

/* GET /go/:route — tracking redirect con UTM + affiliate code */
app.get('/go/:route', (req, res) => {
  const ad = ADVERTISEMENTS.find(a => a.route === req.params.route && a.active);
  if (!ad) return res.status(404).send('Not found');
  const position = req.query.pos || 'unknown';
  ad.clicks++;
  adClickLog.push({
    ts:       new Date().toISOString(),
    id:       ad.id,
    name:     ad.name,
    position,
    hasCode:  !!ad.refCode,
  });
  saveAdAnalytics();
  res.redirect(302, buildRedirectUrl(ad, position));
});

/* GET /api/ads — lista de anuncios activos para el cliente */
app.get('/api/ads', (_req, res) => {
  res.json(ADVERTISEMENTS.filter(a => a.active).map(({ id, name, tagline, cta, route, brandColor, bg, textColor }) => ({
    id, name, tagline, cta, route: `/go/${route}`, brandColor, bg, textColor,
  })));
});

/* POST /api/ads/:id/impression — registra impresión */
app.post('/api/ads/:id/impression', impressionLimiter, (req, res) => {
  const ad = ADVERTISEMENTS.find(a => a.id === req.params.id && a.active);
  if (!ad) return res.status(404).json({ ok: false });
  ad.impressions++;
  saveAdAnalytics();
  res.json({ ok: true });
});

/* GET /api/ads/metrics — CTR y métricas con estado de afiliado */
app.get('/api/ads/metrics', (_req, res) => {
  res.json(ADVERTISEMENTS.map(a => ({
    id:                a.id,
    name:              a.name,
    clicks:            a.clicks,
    impressions:       a.impressions,
    ctr:               a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(2) + '%' : '0.00%',
    affiliateStatus:   a.refCode ? '✓ activo' : '⚠ sin código',
    refCode:           a.refCode || null,
    affiliateTemplate: a.affiliateUrlTemplate,
    sampleUrl:         a.refCode ? buildRedirectUrl(a, 'preview') : null,
    log:               adClickLog.filter(e => e.id === a.id).slice(-10),
  })));
});

/* PUT /api/ads/:id/refcode — actualizar código de afiliado sin reiniciar */
app.put('/api/ads/:id/refcode', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY)
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  const ad = ADVERTISEMENTS.find(a => a.id === req.params.id);
  if (!ad) return res.status(404).json({ ok: false, error: 'Anunciante no encontrado' });
  const { code } = req.body;
  if (typeof code !== 'string') return res.status(400).json({ ok: false, error: 'Se requiere { code: string }' });
  ad.refCode = code.trim();
  saveAdAnalytics();
  res.json({
    ok:      true,
    id:      ad.id,
    refCode: ad.refCode,
    url:     ad.refCode ? buildRedirectUrl(ad, 'preview') : null,
  });
});

/* GET /* — SPA fallback */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─────────────────────────────────────────────────────────────
   INICIALIZACIÓN DE SERVICIOS
   Se ejecuta tanto en local como en Vercel (al cargar el módulo).
───────────────────────────────────────────────────────────── */
try {
  promotionSvc.expireOldPromotions();
  promotionSvc.recomputeScores();
} catch (e) { console.error('[startup] Error init promotions:', e.message); }

try {
  const { validate, printReport } = require('./services/promotions/CatalogValidator');
  const repo  = require('./repositories/promotions/PromotionRepository');
  const items = repo.findAll({ activeOnly: false });
  printReport(validate(items));
} catch (e) { console.error('[startup] Error catalog validation:', e.message); }

try {
  mobilitySvc.expireOld();
  mobilitySvc.recomputeScores();
  const mobVal  = require('./services/mobility/MobilityCatalogValidator');
  const mobRepo = require('./repositories/mobility/MobilityRepository');
  mobVal.printReport(mobVal.validate(mobRepo.findAll({ activeOnly: false })));
} catch (e) { console.error('[startup] Error init mobility:', e.message); }

try {
  fuelSvc.expireOld();
  fuelSvc.recomputeScores();
  const fuelVal  = require('./services/fuel/FuelCatalogValidator');
  const fuelRepo = require('./repositories/fuel/FuelRepository');
  fuelVal.printReport(fuelVal.validate(fuelRepo.findAll({ activeOnly: false })));
} catch (e) { console.error('[startup] Error init fuel:', e.message); }

syncJob.register();

/* Servidor HTTP — solo en ejecución directa (local), no en Vercel */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   FinRank AR  —  Backend iniciado     ║
╠═══════════════════════════════════════╣
║  App:          http://localhost:${PORT}   ║
║  Promotions:   /api/promotions        ║
║  Today:        /api/promotions/today  ║
║  Best:         /api/promotions/best   ║
║  Wallets:      /api/wallets           ║
╚═══════════════════════════════════════╝
    `);
  });
}

/* ─────────────────────────────────────────────────────────────
   CRON: scraper automático todos los días a las 03:00
───────────────────────────────────────────────────────────── */
cron.schedule('0 3 * * *', async () => {
  console.log(`[cron] Iniciando scraper diario — ${new Date().toISOString()}`);
  try {
    const { value: badlar } = await getBADLAR();
    const result = await runScraper(badlar);
    ratesCache.invalidate();
    console.log(`[cron] Scraper completado: ${result.ok}/${result.total} ok`);
  } catch (err) {
    console.error('[cron] Error en scraper:', err.message);
  }
}, { timezone: 'America/Argentina/Buenos_Aires' });

/* ── Snapshot diario historial apps a las 23:59 ── */
cron.schedule('59 23 * * *', runDailyHistorialSnapshot, {
  timezone: 'America/Argentina/Buenos_Aires',
});

module.exports = app;
