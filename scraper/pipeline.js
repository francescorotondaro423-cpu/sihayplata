'use strict';

/* ═══════════════════════════════════════════════════════════════════
   PIPELINE DE ACTUALIZACIÓN DE TASAS — 3 ESCUDOS
   ─────────────────────────────────────────────────────────────────
   Escudo 1 — Multifuente:  intenta Puppeteer → HTTP → Recálculo BADLAR
   Escudo 2 — Validación:   sanity-check antes de escribir al disco
   Escudo 3 — Fallback:     si todo falla, preserva datos del día anterior
                             y genera log detallado + alerta por email
═══════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const { sourcePuppeteer, sourceHTTP, sourceBADLARRecalc } = require('./sources');
const { validate }        = require('./validate');
const { sendFailureEmail } = require('./notify');

const ARS_FILE = path.join(__dirname, '..', 'data', 'ars_rates.json');
const LOG_FILE = path.join(__dirname, '..', 'data', 'scraper_errors.log');

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function appendLog(level, msg, detail = '') {
  const ts   = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${detail ? ` | ${detail}` : ''}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  if (level === 'ERROR') console.error(line.trim());
  else                   console.log(line.trim());
}

function readCurrentData() {
  try {
    if (fs.existsSync(ARS_FILE)) return JSON.parse(fs.readFileSync(ARS_FILE, 'utf8'));
  } catch (err) {
    appendLog('ERROR', 'No se pudo leer ars_rates.json', err.message);
  }
  return null;
}

/**
 * Fusiona los rates scrapeados con los items actuales de ars_rates.json.
 * Solo actualiza los apps que la fuente encontró; el resto conserva su spread previo.
 *
 * @param {Array}  existingItems  - items actuales del JSON
 * @param {Array<{app,tna}>} scrapedRates - rates obtenidos por la fuente
 * @param {number} badlar         - BADLAR actual
 * @param {string} srcLabel       - etiqueta de la fuente ('scraper'|'http'|'recalc')
 * @returns {Array} items fusionados
 */
function mergeRates(existingItems, scrapedRates, badlar, srcLabel) {
  const today   = new Date().toISOString().slice(0, 10);
  const rateMap = new Map(scrapedRates.map(r => [r.app, r.tna]));

  return existingItems.map(item => {
    if (!rateMap.has(item.app)) return item; // sin cambios

    const newTNA    = rateMap.get(item.app);
    const newSpread = parseFloat((newTNA - badlar).toFixed(2));

    return {
      ...item,
      spread:      newSpread,
      lastUpdated: today,
      src:         srcLabel,
    };
  });
}

/* ─────────────────────────────────────────────────────────────────
   Definición de fuentes — orden de preferencia
───────────────────────────────────────────────────────────────── */
function buildSources(badlar) {
  return [
    {
      name:       'Puppeteer (scraping directo)',
      fn:         () => sourcePuppeteer(),
      srcLabel:   'scraper',
      softValidation: false,
      timeoutMs:  120_000,  // 2 min — Puppeteer es lento
    },
    {
      name:       'HTTP Fetch (comparadores web)',
      fn:         () => sourceHTTP(),
      srcLabel:   'http',
      softValidation: false,
      timeoutMs:  30_000,
    },
    {
      name:       'Recálculo BADLAR (fallback matemático)',
      fn:         () => sourceBADLARRecalc(badlar),
      srcLabel:   'recalc',
      softValidation: true,   // rango más amplio — los datos son derivados matemáticamente
      timeoutMs:  5_000,
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────
   Pipeline principal
───────────────────────────────────────────────────────────────── */
async function runPipeline(badlar) {
  const timestamp  = new Date().toISOString();
  const sources    = buildSources(badlar);
  const errorLog   = [];   // historial de fallos por fuente

  appendLog('INFO', `Pipeline iniciado — BADLAR: ${badlar}%`);

  for (const source of sources) {
    appendLog('INFO', `━━━ Intentando fuente: ${source.name} ━━━`);

    try {
      /* ── ESCUDO 1: Ejecutar fuente con timeout propio ─────────── */
      const result = await Promise.race([
        source.fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout (${source.timeoutMs / 1000}s)`)),
            source.timeoutMs
          )
        ),
      ]);

      if (!result.ok || !result.rates?.length) {
        const reason = result.reason || 'Sin rates válidas';
        errorLog.push({ source: source.name, step: 'fetch', reason });
        appendLog('WARN', `Fuente sin datos útiles: ${source.name}`, reason);
        continue;
      }

      appendLog('INFO', `Fuente devolvió ${result.rates.length} rates — validando…`);

      /* ── ESCUDO 2: Validación de sanity check ─────────────────── */
      const validation = validate(result.rates, { soft: source.softValidation });

      if (!validation.ok) {
        errorLog.push({ source: source.name, step: 'validate', reason: validation.reason });
        appendLog('WARN', `Validación rechazó datos de: ${source.name}`, validation.reason);
        continue;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w =>
          appendLog('WARN', `Advertencia de validación: ${w}`)
        );
      }

      /* ── ESCUDO 3 (éxito): Merge + escritura atómica ──────────── */
      const currentData = readCurrentData();
      if (!currentData?.items?.length) {
        errorLog.push({ source: source.name, step: 'merge', reason: 'ars_rates.json ilegible o vacío' });
        appendLog('ERROR', 'No se puede hacer merge — ars_rates.json ilegible');
        continue;
      }

      const mergedItems = mergeRates(
        currentData.items,
        result.rates,
        badlar,
        source.srcLabel
      );

      // Genera el status detallado de cada app scrapeada
      const scraperStatus = {};
      for (const r of result.rates) {
        scraperStatus[r.app] = `ok (${r.tna}% TNA)`;
      }

      const payload = {
        ...currentData,
        sourceLabel:    `${source.name} · BADLAR ${badlar.toFixed(2)}% · ${timestamp.slice(0, 10)}`,
        lastScraperRun: timestamp,
        scraperStatus,
        items:          mergedItems,
      };

      // Escritura atómica: escribe en .tmp y luego renombra
      const TMP_FILE = ARS_FILE + '.tmp';
      fs.writeFileSync(TMP_FILE, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(TMP_FILE, ARS_FILE);

      const updatedCount = result.rates.length;
      appendLog('INFO',
        `✓ Guardado exitosamente con "${source.name}" — ${updatedCount} apps actualizadas`
      );

      return {
        ok:           true,
        source:       source.name,
        updatedCount,
        totalApps:    mergedItems.length,
        badlar,
        timestamp,
        partialErrors: errorLog,  // fuentes anteriores que fallaron
      };

    } catch (err) {
      const msg = err.message.slice(0, 200);
      errorLog.push({ source: source.name, step: 'exception', reason: msg });
      appendLog('ERROR', `Excepción en fuente "${source.name}"`, msg);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ESCUDO 3 — FALLBACK TOTAL
     Todas las fuentes fallaron. Se preserva ars_rates.json intacto
     y se genera alerta.
  ═══════════════════════════════════════════════════════════════ */
  const summary = errorLog.map(e => `  [${e.step}] ${e.source}: ${e.reason}`).join('\n');
  appendLog('ERROR', 'PIPELINE TOTAL FAILURE — todos los escudos fallaron.\n' + summary);

  // Alerta por email con detalle de cada fuente fallida
  try {
    await sendFailureEmail(
      errorLog.map(e => ({ app: e.source, reason: `[${e.step}] ${e.reason}` })),
      0,
      sources.length
    );
  } catch (notifyErr) {
    appendLog('ERROR', 'No se pudo enviar alerta por email', notifyErr.message);
  }

  return {
    ok:        false,
    badlar,
    timestamp,
    errors:    errorLog,
    message:   'Todos los escudos fallaron. ars_rates.json conservado sin cambios.',
  };
}

module.exports = { runPipeline };
