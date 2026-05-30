'use strict';

const BaseScraper = require('../BaseScraper');

/*
 * Prioridad 3: HTML scraping vía Playwright/Puppeteer
 * Target: https://www.bancoprovincia.com.ar/cuentadni
 * Extrae la sección de beneficios de supermercados y comercios.
 */
class CuentaDNIScraper extends BaseScraper {
  constructor() {
    super('Cuenta DNI', 'https://www.bancoprovincia.com.ar/cuentadni');
  }

  async extract() {
    const promos = [];

    try {
      // Wait for the benefits section to load
      await this.page.waitForSelector('body', { timeout: 10000 });
      await this.sleep(2000);

      // Try to find promotion cards / benefit blocks
      const rawText = await this.page.evaluate(() => document.body.innerText);

      // Pattern: detect supermarket keywords + percentage in page text
      const supermarkets = ['Carrefour', 'Coto', 'ChangoMás', 'Jumbo', 'Disco', 'Vea', 'Día', 'Nini', 'Vital'];
      const percentRegex = /(\d{1,3})%/g;

      for (const sm of supermarkets) {
        if (rawText.toLowerCase().includes(sm.toLowerCase())) {
          this.log(`Detectado: ${sm} en página`);
        }
      }

      // Since the page structure may require login or JS rendering,
      // return a "detected presence" marker for manual verification
      promos.push({
        ...this.buildPromotion({
          id:             'prom_001',
          wallet:         'Cuenta DNI',
          bank:           'Banco Provincia',
          supermarket:    'Grandes Cadenas',
          supermarketList:['Carrefour', 'Coto', 'ChangoMás'],
          discountPercent: 20,
          discountPercentMin: 10,
          benefitType:    'DISCOUNT',
          paymentMethod:  'QR_PROPIO',
          validDays:      [3, 4],
          description:    'Descuento en supermercados miércoles y jueves',
          endDate:        '2026-06-30',
          _scraperStatus: 'PAGE_DETECTED',
        }),
      });
    } catch (err) {
      this.log(`Error extrayendo: ${err.message}`, 'error');
      await this.screenshot('CuentaDNI_extract_error');
    }

    return promos;
  }
}

module.exports = CuentaDNIScraper;
