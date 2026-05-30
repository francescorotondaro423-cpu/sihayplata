'use strict';

/* Score = discount + cashback + bonuses − penalties
 * Transport-specific: telepeajes/autopista items get a slight boost
 * for items active every day (high utility).
 */

const TODAY_BONUS    = 12;
const VERIFIED_BONUS = 5;
const EXPIRY_WARNING = 7;

function computeScore(item) {
  const discount  = item.discountPercent  || 0;
  const cashback  = item.cashbackPercent  || 0;
  const cap       = item.capAmount;
  const today     = new Date().getDay();

  let score = discount + cashback;

  // Cap penalty
  if (cap !== null && cap !== undefined) {
    if (cap < 5000)  score -= 8;
    else if (cap < 20000) score -= 3;
  }

  // Today bonus
  const validDays = item.validDays;
  if (!validDays || validDays.length === 0 || validDays.includes(today)) {
    score += TODAY_BONUS;
  }

  // Verification bonus
  const trustMap = { OFFICIAL: 8, AUTO_VERIFIED: 4, SCRAPING_VERIFIED: 2 };
  score += trustMap[item.verificationLevel] ?? (item.sourceUrl && item.lastVerified ? VERIFIED_BONUS : 0);

  // Expiry decay
  if (item.endDate) {
    const daysLeft = Math.ceil((new Date(item.endDate) - Date.now()) / 86400000);
    if (daysLeft < 0)              score -= 999;
    else if (daysLeft < EXPIRY_WARNING) score -= 4;
  }

  return Math.max(0, Math.round(score));
}

function rankItems(items) {
  return items
    .map(i => ({ ...i, score: computeScore(i) }))
    .sort((a, b) => {
      const da = (a.discountPercent||0) + (a.cashbackPercent||0);
      const db = (b.discountPercent||0) + (b.cashbackPercent||0);
      if (b.score !== a.score) return b.score - a.score;
      if (db !== da)           return db - da;
      return (a.endDate||'9999').localeCompare(b.endDate||'9999');
    });
}

function isExpiringSoon(item) {
  if (!item.endDate) return false;
  const d = Math.ceil((new Date(item.endDate) - Date.now()) / 86400000);
  return d >= 0 && d <= EXPIRY_WARNING;
}

function getDaysLeft(item) {
  if (!item.endDate) return null;
  return Math.ceil((new Date(item.endDate) - Date.now()) / 86400000);
}

module.exports = { computeScore, rankItems, isExpiringSoon, getDaysLeft };
