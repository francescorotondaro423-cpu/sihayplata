'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_FILE      = path.join(__dirname, '../../data/mobility.json');
const HISTORY_FILE = path.join(__dirname, '../../data/mobility_history.json');

class MobilityRepository {
  _load() {
    try {
      if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { console.error('[mobility-repo] Error leyendo mobility.json:', e.message); }
    return { version:'1.0.0', schema:'mobility_v1', items:[] };
  }

  _save(db) {
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }

  findAll(filters = {}) {
    const db = this._load();
    let items = db.items;

    if (filters.activeOnly !== false) items = items.filter(i => i.isActive && !i.isExpired);
    if (filters.category)             items = items.filter(i => i.category === filters.category);
    if (filters.transportType)        items = items.filter(i => i.transportType === filters.transportType);
    if (filters.wallet)               items = items.filter(i => i.wallet?.toLowerCase() === filters.wallet.toLowerCase());
    if (filters.provider)             items = items.filter(i => i.provider?.toLowerCase() === filters.provider.toLowerCase());
    if (filters.benefitType)          items = items.filter(i => i.benefitType === filters.benefitType);
    if (filters.paymentMethod)        items = items.filter(i => i.paymentMethod === filters.paymentMethod);

    // Require source backing
    items = items.filter(i => i.sourceUrl && (i.lastValidation || i.lastVerified));
    return items;
  }

  findById(id) {
    return this._load().items.find(i => i.id === id) || null;
  }

  findActiveToday() {
    const today = new Date().getDay();
    return this.findAll().filter(i =>
      !i.validDays || i.validDays.length === 0 || i.validDays.includes(today)
    );
  }

  findBest(limit = 10) {
    return this.findAll().sort((a, b) => b.score - a.score).slice(0, limit);
  }

  upsert(data) {
    const db  = this._load();
    const now = new Date().toISOString();
    const idx = db.items.findIndex(i => i.id === data.id);

    if (idx >= 0) {
      db.items[idx] = { ...db.items[idx], ...data, updatedAt: now, lastSeen: now };
    } else {
      db.items.push({
        id:        data.id || `mob_${randomUUID().slice(0, 8)}`,
        ...data,
        score:     data.score || 0,
        isActive:  data.isActive  ?? true,
        isExpired: data.isExpired ?? false,
        firstSeen: now, lastSeen: now,
        createdAt: now, updatedAt: now,
      });
    }
    this._save(db);
    return this.findById(data.id);
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

  updateScores(scores) {
    const db = this._load();
    for (const [id, score] of Object.entries(scores)) {
      const idx = db.items.findIndex(i => i.id === id);
      if (idx >= 0) db.items[idx].score = score;
    }
    this._save(db);
  }

  /* ── Community Reports ── */
  addCommunityReport(data) {
    const db  = this._load();
    const now = new Date().toISOString();
    if (!db.communityReports) db.communityReports = [];
    const report = {
      id:                 `cr_${require('crypto').randomUUID().slice(0, 8)}`,
      ...data,
      verificationLevel: 'PENDING_VERIFICATION',
      isActive:          false,
      createdAt:         now,
    };
    db.communityReports.push(report);
    this._save(db);
    return report;
  }

  getCommunityReports(pendingOnly = true) {
    const db = this._load();
    const reports = db.communityReports || [];
    return pendingOnly ? reports.filter(r => r.verificationLevel === 'PENDING_VERIFICATION') : reports;
  }

}

module.exports = new MobilityRepository();
