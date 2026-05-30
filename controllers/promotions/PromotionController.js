'use strict';

const express        = require('express');
const promotionSvc   = require('../../services/promotions/PromotionService');
const walletSvc      = require('../../services/wallets/WalletService');
const supermarketSvc = require('../../services/supermarkets/SupermarketService');
const scraperManager = require('../../services/scraping/ScraperManager');
const syncJob        = require('../../jobs/promotionSyncJob');
const repo           = require('../../repositories/promotions/PromotionRepository');
const ranking        = require('../../services/promotions/RankingService');

const router = express.Router();

/* ── GET /api/promotions ──────────────────────────────── */
router.get('/', (req, res) => {
  const { supermarket, wallet, bank, activeOnly, benefitType, paymentMethod, category, verificationLevel } = req.query;
  const filters = {
    activeOnly:        activeOnly !== 'false',
    supermarket:       supermarket        || undefined,
    wallet:            wallet             || undefined,
    bank:              bank               || undefined,
    benefitType:       benefitType        || undefined,
    paymentMethod:     paymentMethod      || undefined,
    sourceCategory:    category           || undefined,
    verificationLevel: verificationLevel  || undefined,
  };
  const items = promotionSvc.getAll(filters).map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/promotions/today ───────────────────────── */
router.get('/today', (_req, res) => {
  const items = promotionSvc.getToday().map(enrichItem);
  res.json({ count: items.length, today: new Date().toLocaleDateString('es-AR',{weekday:'long'}), items });
});

/* ── GET /api/promotions/best ────────────────────────── */
router.get('/best', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const items = promotionSvc.getBest(limit).map(enrichItem);
  res.json({ count: items.length, items });
});

/* ── GET /api/promotions/stats ───────────────────────── */
router.get('/stats', (_req, res) => {
  res.json(promotionSvc.getStats());
});

/* ── GET /api/promotions/catalog/validate ─────────────── */
router.get('/catalog/validate', (_req, res) => {
  res.json(promotionSvc.validateCatalog());
});

/* ── GET /api/promotions/:id ─────────────────────────── */
router.get('/:id', (req, res) => {
  const item = promotionSvc.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(enrichItem(item));
});

/* ── GET /api/promotions/:id/history ─────────────────── */
router.get('/:id/history', (req, res) => {
  res.json(promotionSvc.getHistory(req.params.id));
});

/* ── POST /api/promotions/:id/reportar ───────────────── */
router.post('/:id/reportar', (req, res) => {
  const item = repo.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  const updated = repo.upsert({
    ...item,
    _reports: (item._reports || 0) + 1,
    _lastReport: new Date().toISOString(),
  });
  console.log(`[PromotionController] Reporte: ${req.params.id} — total: ${updated._reports}`);
  res.json({ ok: true, id: req.params.id, reports: updated._reports });
});

/* ── Admin endpoints (API key required) ─────────────── */
function requireAdmin(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== (process.env.ADMIN_KEY || 'finrank-admin-2026'))
    return res.status(401).json({ error: 'No autorizado' });
  next();
}

router.put('/:id', requireAdmin, (req, res) => {
  const existing = repo.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'No encontrado' });
  const updated = promotionSvc.upsert({ ...existing, ...req.body, id: req.params.id });
  res.json({ ok: true, item: enrichItem(updated) });
});

router.post('/', requireAdmin, (req, res) => {
  const item = promotionSvc.upsert(req.body);
  res.status(201).json({ ok: true, item: enrichItem(item) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const item = repo.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  repo.markExpired(req.params.id);
  res.json({ ok: true, id: req.params.id, status: 'expired' });
});

/* ── GET /api/wallets ────────────────────────────────── */
router.get('/meta/wallets', (_req, res) => {
  res.json(walletSvc.getAll());
});

/* ── GET /api/supermarkets ───────────────────────────── */
router.get('/meta/supermarkets', (_req, res) => {
  res.json(supermarketSvc.getAll());
});

/* ── POST /api/promotions/sync/run (admin) ───────────── */
router.post('/sync/run', requireAdmin, async (req, res) => {
  res.json({ ok: true, message: 'Sync iniciado en background' });
  syncJob.runSync().catch(err => console.error('[sync] Error:', err.message));
});

/* ── GET /api/promotions/sync/status ─────────────────── */
router.get('/sync/status', (_req, res) => {
  res.json(scraperManager.getStatus());
});

/* ── Helpers ─────────────────────────────────────────── */
function enrichItem(item) {
  const walletMeta = require('../../services/wallets/WalletService').getMeta(item.wallet);
  const today      = new Date().getDay();
  const allDays    = !item.validDays || item.validDays.length === 0;
  const activeTdy  = allDays || item.validDays.includes(today);
  const expSoon    = ranking.isExpiringSoon(item);
  const daysLeft   = ranking.getDaysLeft(item);
  const DIA_FULL   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return {
    ...item,
    score:       ranking.computeScore(item),
    activeToday: activeTdy,
    expiringSoon: expSoon,
    daysLeft,
    validDaysLabels: allDays ? ['Todos los días'] : item.validDays.map(d => DIA_FULL[d]),
    walletMeta,
  };
}

module.exports = router;
