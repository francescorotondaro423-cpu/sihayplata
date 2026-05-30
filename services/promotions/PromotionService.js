'use strict';

const repo      = require('../../repositories/promotions/PromotionRepository');
const ranking   = require('./RankingService');
const validator = require('./CatalogValidator');

class PromotionService {
  /* ── Read ── */
  getAll(filters = {}) {
    const items = repo.findAll(filters);
    return ranking.rankPromotions(items);
  }

  getToday() {
    const items = repo.findActiveToday();
    return ranking.rankPromotions(items);
  }

  getBest(limit = 10) {
    return this.getAll().slice(0, limit);
  }

  getById(id) {
    return repo.findById(id);
  }

  getHistory(id) {
    return repo.getHistory(id);
  }

  getWallets() {
    const items = repo.findAll({ activeOnly: true });
    const wallets = [...new Set(items.map(i => i.wallet).filter(Boolean))];
    return wallets.sort();
  }

  getSupermarkets() {
    const items = repo.findAll({ activeOnly: true });
    const all   = items.flatMap(i => i.supermarketList || [i.supermarket]).filter(Boolean);
    return [...new Set(all)].sort();
  }

  /* ── Lifecycle ── */
  recomputeScores() {
    const items  = repo.findAll({ activeOnly: false });
    const scores = {};
    for (const item of items) {
      scores[item.id] = ranking.computeScore(item);
    }
    repo.updateScores(scores);
    console.log(`[PromotionService] Scores recalculados: ${Object.keys(scores).length} items`);
  }

  expireOldPromotions() {
    const db   = repo._load();
    const now  = Date.now();
    let expired = 0;
    for (const item of db.items) {
      if (item.isExpired) continue;
      if (item.endDate && new Date(item.endDate).getTime() < now) {
        repo.markExpired(item.id);
        expired++;
      }
    }
    if (expired) console.log(`[PromotionService] Marcadas como expiradas: ${expired} promociones`);
    return expired;
  }

  upsert(data) {
    const item = repo.upsert(data);
    this.recomputeScores();
    return item;
  }

  validateCatalog() {
    const items = repo.findAll({ activeOnly: false });
    return validator.validate(items);
  }

  /* ── Stats ── */
  getStats() {
    const all     = repo.findAll({ activeOnly: false });
    const active  = all.filter(i => i.isActive && !i.isExpired);
    const today   = repo.findActiveToday();
    const ranked  = ranking.rankPromotions(active);
    return {
      total:          all.length,
      active:         active.length,
      expired:        all.filter(i => i.isExpired).length,
      activeToday:    today.length,
      bestScore:      ranked[0]?.score ?? 0,
      avgDiscount:    active.length
        ? Math.round(active.reduce((s, i) => s + (i.discountPercent || 0), 0) / active.length)
        : 0,
    };
  }
}

module.exports = new PromotionService();
