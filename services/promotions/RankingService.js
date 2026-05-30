'use strict';

/*
 * score = discountPercent + cashbackPercent
 *       - capPenalty (topes bajos penalizan)
 *       + todayBonus (activo hoy suma)
 *       + verifiedBonus (fuente oficial suma)
 *       - ageDecay (se acerca el vencimiento penaliza)
 */

const CAP_THRESHOLD_HIGH = 20000;
const CAP_THRESHOLD_LOW  = 5000;
const TODAY_BONUS        = 12;
const VERIFIED_BONUS     = 5;
const EXPIRY_WARNING_DAYS = 7;

function computeScore(promotion) {
  const discount  = promotion.discountPercent  || 0;
  const cashback  = promotion.cashbackPercent  || 0;
  const cap       = promotion.capAmount;
  const today     = new Date().getDay();

  let score = discount + cashback;

  // Cap penalty
  if (cap !== null && cap !== undefined) {
    if (cap < CAP_THRESHOLD_LOW)  score -= 8;
    else if (cap < CAP_THRESHOLD_HIGH) score -= 3;
  }

  // Today bonus
  const validDays = promotion.validDays;
  if (!validDays || validDays.length === 0 || validDays.includes(today)) {
    score += TODAY_BONUS;
  }

  // Trust level bonus
  const trustBonus = { OFFICIAL: 8, AUTO_VERIFIED: 4, SCRAPING_VERIFIED: 2 };
  score += trustBonus[promotion.verificationLevel] ?? (promotion.sourceUrl && promotion.lastVerified ? VERIFIED_BONUS : 0);

  // Expiry decay — promotions expiring within 7 days get penalised
  if (promotion.endDate) {
    const daysLeft = Math.ceil((new Date(promotion.endDate) - Date.now()) / 86400000);
    if (daysLeft < 0)              score -= 999; // expired
    else if (daysLeft < EXPIRY_WARNING_DAYS) score -= 4;
  }

  return Math.max(0, Math.round(score));
}

function rankPromotions(promotions) {
  return promotions
    .map(p => ({ ...p, score: computeScore(p) }))
    .sort((a, b) => b.score - a.score);
}

function isActiveToday(promotion) {
  const today = new Date().getDay();
  const d = promotion.validDays;
  return !d || d.length === 0 || d.includes(today);
}

function isExpiringSoon(promotion) {
  if (!promotion.endDate) return false;
  const daysLeft = Math.ceil((new Date(promotion.endDate) - Date.now()) / 86400000);
  return daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;
}

function getDaysLeft(promotion) {
  if (!promotion.endDate) return null;
  return Math.ceil((new Date(promotion.endDate) - Date.now()) / 86400000);
}

module.exports = { computeScore, rankPromotions, isActiveToday, isExpiringSoon, getDaysLeft };
