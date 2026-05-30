'use strict';

const express  = require('express');
const svc      = require('../../services/mobility/MobilityService');
const ranking  = require('../../services/mobility/MobilityRankingService');
const repo     = require('../../repositories/mobility/MobilityRepository');

const router = express.Router();

function requireAdmin(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== (process.env.ADMIN_KEY || 'finrank-admin-2026'))
    return res.status(401).json({ error: 'No autorizado' });
  next();
}

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

/* ── GET /api/mobility ─────────────────────────── */
router.get('/', (req, res) => {
  const { category, wallet, provider, benefitType, paymentMethod, activeOnly } = req.query;
  const items = svc.getAll({
    activeOnly:   activeOnly !== 'false',
    category:     category    || undefined,
    wallet:       wallet      || undefined,
    provider:     provider    || undefined,
    benefitType:  benefitType || undefined,
    paymentMethod:paymentMethod || undefined,
  }).map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/mobility/today ───────────────────── */
router.get('/today', (_req, res) => {
  const items = svc.getToday().map(enrichItem);
  const DIA   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  res.json({ count: items.length, today: DIA[new Date().getDay()], items });
});

/* ── GET /api/mobility/mejores ─────────────────── */
router.get('/mejores', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  res.json({ count: limit, items: svc.getBest(limit).map(enrichItem) });
});

/* ── GET /api/mobility/stats ───────────────────── */
router.get('/stats', (_req, res) => res.json(svc.getStats()));

/* ── GET /api/mobility/catalog/validate ────────── */
router.get('/catalog/validate', (_req, res) => res.json(svc.validateCatalog()));

/* ── Categorías individuales ───────────────────── */
const CATS = ['subte','trenes','colectivos','telepeajes','estacionamientos','movilidad_privada','micromovilidad'];
for (const cat of CATS) {
  router.get(`/${cat}`, (_req, res) => {
    const items = svc.getByCategory(cat).map(enrichItem);
    res.json({ count: items.length, category: cat, items });
  });
}

/* ── GET /api/mobility/especiales/viajar-gratis ── */
router.get('/especiales/viajar-gratis', (_req, res) => {
  const items = svc.getAll()
    .filter(i => (i.discountPercent || 0) >= 100 || (i.cashbackPercent || 0) >= 100)
    .map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/mobility/especiales/top-ahorro ──── */
router.get('/especiales/top-ahorro', (_req, res) => {
  /* Estimación mensual por billetera usando parámetros promedio argentinos:
   * SUBE: 40 viajes/mes × $1.500 promedio → $60.000/mes
   * Telepeajes: 20 peajes/mes × $800 promedio → $16.000/mes
   * Privado: 10 viajes/mes × $3.000 promedio → $30.000/mes
   * Micromovilidad: 8 viajes/mes × $500 promedio → $4.000/mes
   */
  const SPEND = { subte:60000, trenes:60000, colectivos:60000, telepeajes:16000, estacionamientos:8000, movilidad_privada:30000, micromovilidad:4000 };
  const all  = svc.getAll();
  const byWallet = {};
  for (const item of all) {
    const pct  = (item.discountPercent || 0) + (item.cashbackPercent || 0);
    const base = SPEND[item.category] || 0;
    const savings = Math.round(base * pct / 100);
    if (!byWallet[item.wallet]) byWallet[item.wallet] = { wallet: item.wallet, savings: 0, bestPct: 0, categories: new Set() };
    byWallet[item.wallet].savings += savings;
    byWallet[item.wallet].bestPct = Math.max(byWallet[item.wallet].bestPct, pct);
    byWallet[item.wallet].categories.add(item.category);
  }
  const ranking = Object.values(byWallet)
    .map(w => ({ ...w, categories: [...w.categories] }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 10);
  res.json({ count: ranking.length, estimatedMonthlySpend: SPEND, ranking });
});

/* ── GET /api/mobility/comunidad/reportes (admin) */
router.get('/comunidad/reportes', requireAdmin, (_req, res) => {
  res.json({ reports: repo.getCommunityReports(false) });
});

/* ── POST /api/mobility/comunidad ─────────────── */
router.post('/comunidad', (req, res) => {
  const { wallet, category, description, sourceUrl, discountPercent, cashbackPercent } = req.body;
  if (!wallet || !category || !description)
    return res.status(400).json({ error: 'wallet, category y description son requeridos' });
  const report = repo.addCommunityReport({ wallet, category, description, sourceUrl, discountPercent, cashbackPercent, submittedAt: new Date().toISOString() });
  res.status(201).json({ ok: true, message: 'Reporte recibido — pendiente de verificación', id: report.id });
});

/* ── GET /api/mobility/:id ─────────────────────── */
router.get('/:id', (req, res) => {
  const item = svc.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(enrichItem(item));
});

module.exports = router;
