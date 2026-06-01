'use strict';

const path = require('path');
const fs   = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '../../logs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

class BaseScraper {
  constructor(name, sourceUrl) {
    this.name      = name;
    this.sourceUrl = sourceUrl;
    this.browser   = null;
    this.page      = null;
    this.retries   = 3;
    this.timeout   = 30000;
    this.results   = [];
    this.errors    = [];
  }

  async launch() {
    const { default: puppeteer } = await import('puppeteer');
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    );
    await this.page.setDefaultNavigationTimeout(this.timeout);
    this.log('Browser iniciado');
  }

  async navigate(url) {
    await this.page.goto(url || this.sourceUrl, {
      waitUntil: 'networkidle2',
      timeout:   this.timeout,
    });
  }

  /* To be implemented by each specific scraper */
  async extract() {
    throw new Error(`${this.name}.extract() no implementado`);
  }

  async run() {
    const start = Date.now();
    this.log(`Iniciando scrape: ${this.sourceUrl}`);

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        await this.launch();
        await this.navigate();
        this.results = await this.extract();
        this.log(`OK — ${this.results.length} items · ${Date.now() - start}ms`);
        return { ok: true, items: this.results, scraper: this.name, at: new Date().toISOString() };
      } catch (err) {
        this.log(`Intento ${attempt}/${this.retries} fallido: ${err.message}`, 'error');
        this.errors.push({ attempt, message: err.message, at: new Date().toISOString() });
        await this.screenshot(`${this.name}_error_attempt${attempt}`).catch(() => {});
        if (attempt === this.retries) {
          return { ok: false, items: [], scraper: this.name, error: err.message, at: new Date().toISOString() };
        }
        await this.sleep(3000 * attempt);
      } finally {
        await this.close();
      }
    }
  }

  async screenshot(label) {
    if (!this.page) return;
    const file = path.join(SCREENSHOT_DIR, `${label}_${Date.now()}.png`);
    await this.page.screenshot({ path: file, fullPage: true });
    this.log(`Screenshot guardado: ${file}`);
  }

  async close() {
    try { await this.browser?.close(); } catch {}
    this.browser = null;
    this.page    = null;
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  log(msg, level = 'info') {
    const line = `[${new Date().toISOString()}] [${this.name}] [${level.toUpperCase()}] ${msg}`;
    console.log(line);
    try {
      const logFile = path.join(__dirname, '../../logs/scraper.log');
      fs.appendFileSync(logFile, line + '\n');
    } catch {}
  }

  /* Build a standardised promotion object from scraped data */
  buildPromotion(overrides) {
    return {
      wallet:             this.name,
      bank:               null,
      supermarket:        null,
      supermarketList:    [],
      discountPercent:    0,
      discountPercentMin: 0,
      cashbackPercent:    0,
      capAmount:          null,
      benefitType:        'DISCOUNT',
      paymentMethod:      'QR_PROPIO',
      validDays:          [0,1,2,3,4,5,6],
      description:        '',
      conditions:         '',
      startDate:          null,
      endDate:            null,
      sourceUrl:          this.sourceUrl,
      lastVerified:       new Date().toISOString(),
      isActive:           true,
      isExpired:          false,
      score:              0,
      ...overrides,
    };
  }
}

module.exports = BaseScraper;
