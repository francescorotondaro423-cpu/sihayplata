'use strict';

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_FILE      = path.join(__dirname, '../../data/promotions.json');
const HISTORY_FILE = path.join(__dirname, '../../data/promotions_history.json');

class PromotionRepository {
  /* ── I/O ── */
  _load() {
    try {
      if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { console.error('[repo] Error leyendo promotions.json:', e.message); }
    return { version:'2.0.0', schema:'promotions_v2', items:[] };
  }

  _save(db) {
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }

  _loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {}
    return [];
  }

  _saveHistory(h) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));
  }

  /* ── Queries ── */
  findAll(filters = {}) {
    const db = this._load();
    let items = db.items;

    if (filters.activeOnly !== false) items = items.filter(i => i.isActive && !i.isExpired);
    if (filters.supermarket)          items = items.filter(i =>
      i.supermarketList?.some(s => s.toLowerCase().includes(filters.supermarket.toLowerCase())) ||
      i.supermarket?.toLowerCase().includes(filters.supermarket.toLowerCase())
    );
    if (filters.wallet)               items = items.filter(i => i.wallet?.toLowerCase() === filters.wallet.toLowerCase());
    if (filters.bank)                 items = items.filter(i => i.bank?.toLowerCase() === filters.bank.toLowerCase());
    if (filters.benefitType)          items = items.filter(i => i.benefitType === filters.benefitType);
    if (filters.paymentMethod)        items = items.filter(i => i.paymentMethod === filters.paymentMethod);
    if (filters.sourceCategory)       items = items.filter(i => i.sourceCategory === filters.sourceCategory);
    if (filters.verificationLevel)    items = items.filter(i => i.verificationLevel === filters.verificationLevel);
    // Never show items without source backing (policy: all promos must have sourceUrl + lastValidation)
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
    return this.findAll()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /* ── Mutations ── */
  upsert(data) {
    const db  = this._load();
    const now = new Date().toISOString();
    const idx = db.items.findIndex(i => i.id === data.id);

    if (idx >= 0) {
      const old = { ...db.items[idx] };
      db.items[idx] = { ...old, ...data, updatedAt: now, lastSeen: now };
      if (JSON.stringify(old) !== JSON.stringify(db.items[idx])) {
        this._logChange(old.id, 'UPDATE', old, db.items[idx]);
      }
    } else {
      const item = {
        id:         data.id || `prom_${randomUUID().slice(0,8)}`,
        ...data,
        score:      data.score || 0,
        isActive:   data.isActive  ?? true,
        isExpired:  data.isExpired ?? false,
        firstSeen:  now,
        lastSeen:   now,
        createdAt:  now,
        updatedAt:  now,
      };
      db.items.push(item);
      this._logChange(item.id, 'CREATE', null, item);
    }

    this._save(db);
    return this.findById(data.id);
  }

  markExpired(id) {
    const db  = this._load();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx < 0) return null;
    const old = { ...db.items[idx] };
    db.items[idx].isActive  = false;
    db.items[idx].isExpired = true;
    db.items[idx].updatedAt = new Date().toISOString();
    this._logChange(id, 'EXPIRED', old, db.items[idx]);
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

  updateLastSeen(id) {
    const db  = this._load();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx >= 0) { db.items[idx].lastSeen = new Date().toISOString(); this._save(db); }
  }

  /* ── History ── */
  _logChange(id, type, before, after) {
    try {
      const h = this._loadHistory();
      h.push({ id, type, before, after, at: new Date().toISOString() });
      if (h.length > 1000) h.splice(0, h.length - 1000); // cap at 1000 entries
      this._saveHistory(h);
    } catch {}
  }

  getHistory(id) {
    return this._loadHistory().filter(e => e.id === id);
  }

  getRecentChanges(limit = 50) {
    const h = this._loadHistory();
    return h.slice(-limit).reverse();
  }
}

module.exports = new PromotionRepository();
