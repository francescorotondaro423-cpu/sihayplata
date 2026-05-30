'use strict';

/* Expected sources: 40 unique category:wallet combos.
 * Validated against the actual loaded items at startup.
 */
const EXPECTED_SOURCES = {
  subte: [
    'Cuenta DNI', 'Mercado Pago', 'Personal Pay', 'MODO', 'BNA+', 'Naranja X',
  ],
  trenes: [
    'Cuenta DNI', 'Mercado Pago', 'Banco Galicia', 'Personal Pay', 'BBVA',
  ],
  colectivos: [
    'Mercado Pago', 'Cuenta DNI', 'MODO', 'Ualá', 'Personal Pay',
  ],
  telepeajes: [
    'Mercado Pago', 'Personal Pay', 'Banco Galicia', 'Santander', 'BBVA',
    'Naranja X', 'BNA+', 'MODO', 'Banco Macro', 'Visa Beneficios',
  ],
  estacionamientos: [
    'Mercado Pago', 'Cuenta DNI', 'Personal Pay', 'MODO', 'Blinkay',
  ],
  movilidad_privada: [
    'Mercado Pago', 'Naranja X', 'Santander', 'BBVA', 'DiDi', 'InDrive',
  ],
  micromovilidad: [
    'Mercado Pago', 'Personal Pay', 'Naranja X',
  ],
};

const ALL_EXPECTED    = Object.entries(EXPECTED_SOURCES).flatMap(([cat, ws]) => ws.map(w => `${cat}:${w}`));
const EXPECTED_TOTAL  = ALL_EXPECTED.length; // 40

function validate(items) {
  const loaded = new Set(
    items.filter(i => i.isActive && !i.isExpired && i.wallet && i.category)
         .map(i => `${i.category}:${i.wallet}`)
  );

  const missing      = {};
  let   missingCount = 0;

  for (const [category, wallets] of Object.entries(EXPECTED_SOURCES)) {
    const cat = wallets.filter(w => !loaded.has(`${category}:${w}`));
    if (cat.length) { missing[category] = cat; missingCount += cat.length; }
  }

  const loadedCount = EXPECTED_TOTAL - missingCount;
  const byCat = {};
  for (const [cat, ws] of Object.entries(EXPECTED_SOURCES)) {
    byCat[cat] = { expected: ws.length, loaded: ws.filter(w => loaded.has(`${cat}:${w}`)).length };
  }

  return {
    expectedSources: EXPECTED_TOTAL,
    loadedSources:   loadedCount,
    missingCount,
    status:         missingCount === 0 ? 'OK' : 'INCOMPLETE',
    statusMessage:  missingCount === 0
      ? `All ${EXPECTED_TOTAL} mobility sources loaded ✓`
      : `INCOMPLETE — Missing Mobility Sources (${missingCount} / ${EXPECTED_TOTAL})`,
    byCategory:  byCat,
    missing,
  };
}

function printReport(result) {
  const line = '══════════════════════════════════════════════';
  console.log(`\n[MobilityCatalog] ${line}`);
  console.log(`[MobilityCatalog] Expected Sources : ${result.expectedSources}`);
  console.log(`[MobilityCatalog] Loaded Sources   : ${result.loadedSources}`);
  console.log(`[MobilityCatalog] Status           : ${result.statusMessage}`);
  if (result.missingCount > 0) {
    for (const [cat, names] of Object.entries(result.missing)) {
      console.warn(`[MobilityCatalog] Missing ${cat}: ${names.join(', ')}`);
    }
  }
  console.log(`[MobilityCatalog] ${line}\n`);
}

module.exports = { validate, printReport, EXPECTED_SOURCES, EXPECTED_TOTAL, ALL_EXPECTED };
