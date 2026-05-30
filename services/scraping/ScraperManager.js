'use strict';

const path = require('path');
const fs   = require('fs');

/* Lazy-load scrapers to avoid startup overhead */
const SCRAPERS = {
  'Cuenta DNI':   () => new (require('./scrapers/CuentaDNIScraper'))(),
  'Mercado Pago': () => new (require('./scrapers/MercadoPagoScraper'))(),
};

class ScraperManager {
  constructor() {
    this.results    = {};
    this.isRunning  = false;
    this.lastRunAt  = null;
    this.runCount   = 0;
  }

  async runAll() {
    if (this.isRunning) {
      console.log('[ScraperManager] Ya hay un scrape en curso — abortando');
      return { skipped: true };
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    this.runCount++;
    const startMs  = Date.now();
    const results  = {};

    console.log(`[ScraperManager] Iniciando ciclo #${this.runCount} — ${Object.keys(SCRAPERS).length} scrapers`);

    for (const [name, factory] of Object.entries(SCRAPERS)) {
      const scraper = factory();
      try {
        results[name] = await scraper.run();
        console.log(`[ScraperManager] ${name}: ${results[name].ok ? 'OK' : 'ERROR'} — ${results[name].items?.length ?? 0} items`);
      } catch (err) {
        results[name] = { ok: false, error: err.message, scraper: name };
        console.error(`[ScraperManager] ${name}: excepción — ${err.message}`);
      }
    }

    this.results   = results;
    this.isRunning = false;

    const elapsed = Date.now() - startMs;
    const ok = Object.values(results).filter(r => r.ok).length;
    console.log(`[ScraperManager] Ciclo completado en ${elapsed}ms — ${ok}/${Object.keys(SCRAPERS).length} OK`);

    this._saveRunLog(results, elapsed);
    return results;
  }

  async runSingle(scraperName) {
    const factory = SCRAPERS[scraperName];
    if (!factory) throw new Error(`Scraper no encontrado: ${scraperName}`);
    return factory().run();
  }

  getStatus() {
    return {
      isRunning:  this.isRunning,
      lastRunAt:  this.lastRunAt,
      runCount:   this.runCount,
      scrapers:   Object.keys(SCRAPERS),
      lastResults: Object.fromEntries(
        Object.entries(this.results).map(([k, v]) => [k, { ok: v.ok, count: v.items?.length ?? 0, at: v.at }])
      ),
    };
  }

  _saveRunLog(results, elapsed) {
    try {
      const logDir  = path.join(__dirname, '../../logs');
      const logFile = path.join(logDir, 'scraper_runs.jsonl');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const entry = JSON.stringify({ at: this.lastRunAt, elapsed, results: this.getStatus().lastResults });
      fs.appendFileSync(logFile, entry + '\n');
    } catch {}
  }
}

module.exports = new ScraperManager();
