'use strict';

/* Catálogo canónico de fuentes esperadas.
 * Las claves deben coincidir exactamente con el campo `wallet` en promotions.json
 * y con los `key` en WALLET_DIR del frontend.
 */
const EXPECTED_SOURCES = {
  fintech: [
    'Mercado Pago', 'Personal Pay', 'Ualá', 'Naranja X', 'Prex',
    'Brubank', 'Lemon Cash', 'Belo', 'LetsBit',
  ],
  'bank-wallets': [
    'Cuenta DNI', 'MODO', 'BNA+', 'Banco Galicia', 'Santander',
    'BBVA', 'Banco Macro', 'ICBC', 'Supervielle', 'Banco Ciudad', 'Banco Comafi', 'Banco Credicoop',
  ],
  retail: [
    'Cencopay', 'Club Día', 'Comunidad Coto', 'Mi Carrefour',
    'Mi ChangoMás', 'Jumbo Más', 'Disco Más', 'Vea Ahorro',
  ],
  cards: [
    'Visa Beneficios', 'Mastercard Surprize', 'American Express Offers',
  ],
  'provincial-banks': [
    'Cuenta Santa Fe', 'Billetera Entre Ríos', 'Banco Corrientes',
    'Banco Formosa', 'Banco La Pampa', 'Banco del Chubut', 'Banco del Neuquén',
  ],
};

const ALL_EXPECTED  = Object.values(EXPECTED_SOURCES).flat();
const EXPECTED_TOTAL = ALL_EXPECTED.length; // 39

function validate(promotions) {
  const loaded = new Set(
    promotions
      .filter(p => p.isActive && !p.isExpired && p.wallet)
      .map(p => p.wallet)
  );

  const loadedCount = ALL_EXPECTED.filter(w => loaded.has(w)).length;
  const missingFlat = ALL_EXPECTED.filter(w => !loaded.has(w));

  const missing = {};
  for (const [category, sources] of Object.entries(EXPECTED_SOURCES)) {
    const cat = sources.filter(s => !loaded.has(s));
    if (cat.length) missing[category] = cat;
  }

  return {
    expectedSources: EXPECTED_TOTAL,
    loadedSources:   loadedCount,
    missingCount:    missingFlat.length,
    status:          missingFlat.length === 0 ? 'OK' : 'ERROR',
    statusMessage:   missingFlat.length === 0
      ? 'All sources loaded ✓'
      : `ERROR — Missing Sources Detected (${missingFlat.length})`,
    missing,
  };
}

function printReport(result) {
  const line = '══════════════════════════════════════════════';
  console.log(`\n[CatalogValidator] ${line}`);
  console.log(`[CatalogValidator] Expected Sources : ${result.expectedSources}`);
  console.log(`[CatalogValidator] Loaded Sources   : ${result.loadedSources}`);
  console.log(`[CatalogValidator] Status           : ${result.statusMessage}`);
  if (result.missingCount > 0) {
    for (const [cat, names] of Object.entries(result.missing)) {
      console.warn(`[CatalogValidator] Missing ${cat}: ${names.join(', ')}`);
    }
  }
  console.log(`[CatalogValidator] ${line}\n`);
}

module.exports = { validate, printReport, EXPECTED_SOURCES, EXPECTED_TOTAL, ALL_EXPECTED };
