'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_FILE = path.join(__dirname, '../../data/fuel.json');

class FuelRepository {
  _load() {
    try {
      if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { console.error('[fuel-repo] Error:', e.message); }
    return { version:'1.0.0', schema:'fuel_v1', items:[] };
  }

  _save(db) {
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }

  findAll(filters = {}) {
    const db = this._load();
    let items = db.items;

    if (filters.activeOnly !== false) items = items.filter(i => i.isActive && !i.isExpired);
    if (filters.station)     items = items.filter(i => i.station?.toLowerCase() === filters.station.toLowerCase());
    if (filters.category)    items = items.filter(i => i.category === filters.category);
    if (filters.wallet)      items = items.filter(i => i.wallet?.toLowerCase() === filters.wallet.toLowerCase());
    if (filters.bank)        items = items.filter(i => i.bank?.toLowerCase().includes(filters.bank.toLowerCase()));
    if (filters.fuelType)    items = items.filter(i => i.fuelType.includes(filters.fuelType) || i.fuelType.includes('TODOS'));
    if (filters.benefitType) items = items.filter(i => i.benefitType === filters.benefitType);

    // Require source backing
    items = items.filter(i => i.sourceUrl && (i.lastValidation || i.lastVerified));
    return items;
  }

  findById(id)    { return this._load().items.find(i => i.id === id) || null; }

  findActiveToday() {
    const today = new Date().getDay();
    return this.findAll().filter(i =>
      !i.validDays || i.validDays.length === 0 || i.validDays.includes(today)
    );
  }

  updateScores(scores) {
    const db = this._load();
    for (const [id, score] of Object.entries(scores)) {
      const idx = db.items.findIndex(i => i.id === id);
      if (idx >= 0) db.items[idx].score = score;
    }
    this._save(db);
  }

  markExpired(id) {
    const db  = this._load();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx < 0) return null;
    db.items[idx].isActive  = false;
    db.items[idx].isExpired = true;
    db.items[idx].updatedAt = new Date().toISOString();
    this._save(db);
    return db.items[idx];
  }
}

module.exports = new FuelRepository();
