'use strict';

/* Expected sources: 30 unique station:wallet combos. */
const EXPECTED_SOURCES = {
  ypf:   ['Mercado Pago','Cuenta DNI','Personal Pay','BBVA','Naranja X','YPF ServiClub','BNA+','Galicia','Visa Beneficios','Ualá'],
  shell: ['Mercado Pago','Personal Pay','BBVA','Santander','Galicia','Shell Club Smart','Mastercard Surprize'],
  axion: ['Mercado Pago','MODO','ON Axion','Galicia','Brubank','Santander'],
  puma:  ['Mercado Pago','BBVA','Puma Pris','Santander'],
  gulf:  ['Mercado Pago','Naranja X','Ualá'],
};

const ALL_EXPECTED   = Object.entries(EXPECTED_SOURCES).flatMap(([s, ws]) => ws.map(w => `${s}:${w}`));
const EXPECTED_TOTAL = ALL_EXPECTED.length; // 30

function validate(items) {
  const loaded = new Set(
    items.filter(i => i.isActive && !i.isExpired && i.wallet && i.category)
         .map(i => `${i.category}:${i.wallet}`)
  );

  const missing = {};
  let missingCount = 0;

  for (const [station, wallets] of Object.entries(EXPECTED_SOURCES)) {
    const cat = wallets.filter(w => !loaded.has(`${station}:${w}`));
    if (cat.length) { missing[station] = cat; missingCount += cat.length; }
  }

  const loadedCount = EXPECTED_TOTAL - missingCount;
  const byCat = {};
  for (const [s, ws] of Object.entries(EXPECTED_SOURCES)) {
    byCat[s] = { expected: ws.length, loaded: ws.filter(w => loaded.has(`${s}:${w}`)).length };
  }

  return {
    expectedSources: EXPECTED_TOTAL,
    loadedSources:   loadedCount,
    missingCount,
    status:         missingCount === 0 ? 'OK' : 'INCOMPLETE',
    statusMessage:  missingCount === 0
      ? `All ${EXPECTED_TOTAL} fuel sources loaded ✓`
      : `INCOMPLETE — Missing Fuel Sources (${missingCount} / ${EXPECTED_TOTAL})`,
    byCategory: byCat,
    missing,
  };
}

function printReport(result) {
  const line = '══════════════════════════════════════════════';
  console.log(`\n[FuelCatalog] ${line}`);
  console.log(`[FuelCatalog] Expected Sources : ${result.expectedSources}`);
  console.log(`[FuelCatalog] Loaded Sources   : ${result.loadedSources}`);
  console.log(`[FuelCatalog] Status           : ${result.statusMessage}`);
  if (result.missingCount > 0) {
    for (const [s, names] of Object.entries(result.missing)) {
      console.warn(`[FuelCatalog] Missing ${s}: ${names.join(', ')}`);
    }
  }
  console.log(`[FuelCatalog] ${line}\n`);
}

module.exports = { validate, printReport, EXPECTED_SOURCES, EXPECTED_TOTAL };
