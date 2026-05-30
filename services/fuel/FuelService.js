'use strict';

const repo      = require('../../repositories/fuel/FuelRepository');
const ranking   = require('./FuelRankingService');
const validator = require('./FuelCatalogValidator');

class FuelService {
  getAll(filters = {})     { return ranking.rankItems(repo.findAll(filters)); }
  getToday()               { return ranking.rankItems(repo.findActiveToday()); }
  getByStation(station)    { return this.getAll({ category: station }); }
  getBest(limit = 10)      { return this.getAll().slice(0, limit); }
  getLoyalty()             { return this.getAll({ benefitType: 'LOYALTY' }); }
  getById(id)              { return repo.findById(id); }

  getStats() {
    const all    = repo.findAll({ activeOnly: false });
    const active = all.filter(i => i.isActive && !i.isExpired);
    const today  = repo.findActiveToday();
    const cats   = ['ypf','shell','axion','puma','gulf','otras'];
    const byCat  = {};
    for (const c of cats) {
      byCat[c] = active.filter(i => i.category === c).length;
    }
    return {
      total:       all.length,
      active:      active.length,
      activeToday: today.length,
      loyalty:     active.filter(i => i.benefitType === 'LOYALTY').length,
      byStation:   byCat,
    };
  }

  recomputeScores() {
    const items  = repo.findAll({ activeOnly: false });
    const scores = {};
    for (const item of items) scores[item.id] = ranking.computeScore(item);
    repo.updateScores(scores);
    console.log(`[FuelService] Scores recalculados: ${Object.keys(scores).length} items`);
  }

  expireOld() {
    const db  = repo._load();
    const now = Date.now();
    let expired = 0;
    for (const item of db.items) {
      if (item.isExpired) continue;
      if (item.endDate && new Date(item.endDate).getTime() < now) {
        repo.markExpired(item.id);
        expired++;
      }
    }
    if (expired) console.log(`[FuelService] Expiradas: ${expired}`);
    return expired;
  }

  validateCatalog() {
    return validator.validate(repo.findAll({ activeOnly: false }));
  }
}

module.exports = new FuelService();
