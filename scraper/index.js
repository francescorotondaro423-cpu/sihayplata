'use strict';

/* ═══════════════════════════════════════════════════════════════════
   ENTRY POINT del scraper — API pública sin cambios para server.js
   Delega todo al pipeline de 3 escudos.
═══════════════════════════════════════════════════════════════════ */

const { runPipeline } = require('./pipeline');

/**
 * Ejecuta el pipeline completo de actualización de tasas.
 * Backward-compatible con la firma original que usa server.js.
 *
 * @param {number} badlar - Valor actual de BADLAR obtenido del BCRA
 * @returns {{ ok: number, failed: number, total: number }}
 */
async function runScraper(badlar) {
  console.log(`[scraper] Iniciando pipeline de 3 escudos — BADLAR: ${badlar}%`);

  const result = await runPipeline(badlar);

  if (result.ok) {
    console.log(
      `[scraper] Pipeline exitoso via "${result.source}" — ` +
      `${result.updatedCount}/${result.totalApps} apps actualizadas`
    );
    return {
      ok:     result.updatedCount,
      failed: result.partialErrors?.length ?? 0,
      total:  result.totalApps,
    };
  }

  console.error(`[scraper] Pipeline falló en todos los escudos — ${result.errors?.length ?? 0} errores`);
  return {
    ok:     0,
    failed: result.errors?.length ?? 3,
    total:  result.errors?.length ?? 3,
  };
}

module.exports = { runScraper };
