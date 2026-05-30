'use strict';

const express = require('express');
const svc     = require('../../services/fuel/FuelService');
const ranking = require('../../services/fuel/FuelRankingService');

const router = express.Router();

/* Estimated monthly fuel spend in ARS (2026): 40L × 2 fills × $2500/L avg */
const MONTHLY_FUEL_SPEND = 200000;

function enrichItem(item) {
  const today    = new Date().getDay();
  const allDays  = !item.validDays || item.validDays.length === 0;
  const DIA_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return {
    ...item,
    score:           ranking.computeScore(item),
    activeToday:     allDays || item.validDays.includes(today),
    expiringSoon:    ranking.isExpiringSoon(item),
    daysLeft:        ranking.getDaysLeft(item),
    validDaysLabels: allDays ? ['Todos los días'] : item.validDays.map(d => DIA_FULL[d]),
  };
}

/* ── GET /api/fuel ─────────────────────────────── */
router.get('/', (req, res) => {
  const { station, category, wallet, bank, fuelType, benefitType, activeOnly } = req.query;
  const items = svc.getAll({
    activeOnly:  activeOnly !== 'false',
    station:     station    || undefined,
    category:    category   || undefined,
    wallet:      wallet     || undefined,
    bank:        bank       || undefined,
    fuelType:    fuelType   || undefined,
    benefitType: benefitType || undefined,
  }).map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/fuel/today ───────────────────────── */
router.get('/today', (_req, res) => {
  const items = svc.getToday().map(enrichItem);
  const DIA   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  res.json({ count: items.length, today: DIA[new Date().getDay()], items });
});

/* ── GET /api/fuel/best ────────────────────────── */
router.get('/best', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  res.json({ count: limit, items: svc.getBest(limit).map(enrichItem) });
});

/* ── GET /api/fuel/loyalty ─────────────────────── */
router.get('/loyalty', (_req, res) => {
  const items = svc.getLoyalty().map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/fuel/stats ───────────────────────── */
router.get('/stats', (_req, res) => res.json(svc.getStats()));

/* ── GET /api/fuel/catalog/validate ───────────── */
router.get('/catalog/validate', (_req, res) => res.json(svc.validateCatalog()));

/* ── GET /api/fuel/top-ahorro ──────────────────── */
router.get('/top-ahorro', (_req, res) => {
  const all = svc.getAll();
  const byWallet = {};

  for (const item of all) {
    if (item.benefitType === 'LOYALTY') continue;
    const pct     = (item.discountPercent||0) + (item.cashbackPercent||0);
    const savings = Math.round(MONTHLY_FUEL_SPEND * pct / 100);
    if (!byWallet[item.wallet]) byWallet[item.wallet] = { wallet: item.wallet, savings: 0, bestPct: 0, stations: new Set() };
    byWallet[item.wallet].savings  += savings;
    byWallet[item.wallet].bestPct  = Math.max(byWallet[item.wallet].bestPct, pct);
    byWallet[item.wallet].stations.add(item.station);
  }

  const ranking_list = Object.values(byWallet)
    .map(w => ({ ...w, stations: [...w.stations], savingsPerFill: Math.round(w.savings / 8) }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 10);

  res.json({
    count:                  ranking_list.length,
    estimatedMonthlySpend:  MONTHLY_FUEL_SPEND,
    note:                   '40L × 2 cargas/mes × $2.500/L promedio nafta Super (referencial 2026)',
    ranking: ranking_list,
  });
});

/* ── Estaciones individuales ───────────────────── */
const STATIONS = ['ypf','shell','axion','puma','gulf'];
for (const st of STATIONS) {
  router.get(`/${st}`, (_req, res) => {
    const items = svc.getByStation(st).map(enrichItem);
    res.json({ count: items.length, station: st, items });
  });
}

/* ── GET /api/fuel/:id ─────────────────────────── */
router.get('/:id', (req, res) => {
  const item = svc.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(enrichItem(item));
});

module.exports = router;
