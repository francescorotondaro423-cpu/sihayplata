'use strict';

/* Score formula for fuel promotions.
 * Loyalty programs score lower than direct discounts by design.
 */
const TODAY_BONUS    = 12;
const EXPIRY_WARNING = 7;

function computeScore(item) {
  const discount = item.discountPercent  || 0;
  const cashback = item.cashbackPercent  || 0;
  const today    = new Date().getDay();
  const cap      = item.capAmount;

  let score = item.benefitType === 'LOYALTY' ? 5 : discount + cashback;
  if (item.pointsMultiplier > 1) score += item.pointsMultiplier * 2;

  if (cap !== null && cap !== undefined) {
    if (cap < 5000)  score -= 8;
    else if (cap < 20000) score -= 3;
  }

  const validDays = item.validDays;
  if (!validDays || validDays.length === 0 || validDays.includes(today)) score += TODAY_BONUS;

  const trust = { OFFICIAL: 8, AUTO_VERIFIED: 4, SCRAPING_VERIFIED: 2 };
  score += trust[item.verificationLevel] ?? 0;

  if (item.endDate) {
    const daysLeft = Math.ceil((new Date(item.endDate) - Date.now()) / 86400000);
    if (daysLeft < 0) score -= 999;
    else if (daysLeft < EXPIRY_WARNING) score -= 4;
  }

  return Math.max(0, Math.round(score));
}

function rankItems(items) {
  return items
    .map(i => ({ ...i, score: computeScore(i) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = (a.discountPercent||0) + (a.cashbackPercent||0);
      const db = (b.discountPercent||0) + (b.cashbackPercent||0);
      if (db !== da) return db - da;
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
