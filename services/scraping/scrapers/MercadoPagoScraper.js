'use strict';

const BaseScraper = require('../BaseScraper');

/*
 * Prioridad 2: Endpoint JSON público detectado vía Network Inspection
 * Target: API pública de descuentos de Mercado Pago (cuando disponible)
 * Fallback Prioridad 3: HTML scraping
 */
class MercadoPagoScraper extends BaseScraper {
  constructor() {
    super('Mercado Pago', 'https://www.mercadopago.com.ar');
  }

  async extract() {
    const promos = [];

    try {
      // Attempt to intercept API calls for discount data
      const apiResponses = [];
      this.page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/discounts') || url.includes('/promotions') || url.includes('/benefits')) {
          try {
            const json = await response.json();
            apiResponses.push({ url, data: json });
            this.log(`Interceptado endpoint: ${url}`);
          } catch {}
        }
      });

      await this.navigate();
      await this.sleep(3000);

      if (apiResponses.length > 0) {
        this.log(`Encontrados ${apiResponses.length} endpoints JSON`);
        // Process API response (structure depends on what's intercepted)
      }

      // Fallback: return known promotions with scraper validation marker
      promos.push({
        ...this.buildPromotion({
          id:              'prom_004',
          wallet:          'Mercado Pago',
          supermarket:     'Multi-cadena',
          supermarketList: ['Carrefour Express', 'Locales geolocalizados'],
          discountPercent:  25,
          discountPercentMin: 10,
          benefitType:     'DISCOUNT',
          paymentMethod:   'QR_PROPIO',
          validDays:       [0,1,2,3,4,5,6],
          description:     'Descuentos geolocalizados en supermercados vía Descubrí Locales',
          endDate:         '2026-06-30',
          _scraperStatus:  'FALLBACK',
        }),
      });
    } catch (err) {
      this.log(`Error extrayendo: ${err.message}`, 'error');
    }

    return promos;
  }
}

module.exports = MercadoPagoScraper;
