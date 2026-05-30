'use strict';

const cron           = require('node-cron');
const promotionSvc   = require('../services/promotions/PromotionService');
const scraperManager = require('../services/scraping/ScraperManager');
const repo           = require('../repositories/promotions/PromotionRepository');

async function runSync() {
  const start = Date.now();
  console.log(`\n[promotionSyncJob] ===== INICIO SYNC ===== ${new Date().toISOString()}`);

  try {
    /* 1. Expirar promociones vencidas */
    const expired = promotionSvc.expireOldPromotions();

    /* 2. Correr scrapers */
    const scraperResults = await scraperManager.runAll();

    /* 3. Procesar resultados del scraping y upsert en repo */
    let upserted = 0;
    for (const result of Object.values(scraperResults)) {
      if (!result.ok || !result.items?.length) continue;
      for (const item of result.items) {
        if (!item.sourceUrl || !item.lastVerified) {
          console.warn(`[promotionSyncJob] Item sin sourceUrl/lastVerified ignorado: ${item.id}`);
          continue;
        }
        repo.upsert(item);
        upserted++;
      }
    }

    /* 4. Recalcular scores */
    promotionSvc.recomputeScores();

    const elapsed = Date.now() - start;
    console.log(`[promotionSyncJob] ===== FIN SYNC (${elapsed}ms) — expired:${expired} upserted:${upserted} =====\n`);

    return { ok: true, elapsed, expired, upserted };
  } catch (err) {
    console.error(`[promotionSyncJob] ERROR en sync: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function register() {
  // Run every 12 hours: 00:00 and 12:00 Argentina time
  cron.schedule('0 0,12 * * *', runSync, { timezone: 'America/Argentina/Buenos_Aires' });
  console.log('[promotionSyncJob] Registrado — cada 12 hs (00:00 y 12:00 ARG)');
}

module.exports = { register, runSync };
