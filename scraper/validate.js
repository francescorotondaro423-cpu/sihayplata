'use strict';

/* ═══════════════════════════════════════════════════════════════════
   ESCUDO 2 — VALIDACIÓN (Sanity Check)
   Verifica que los datos scrapeados tengan sentido financiero antes
   de ser escritos al disco. Si fallan, la fuente se descarta y se
   pasa a la siguiente.
═══════════════════════════════════════════════════════════════════ */

const CRITICAL_APPS = ['Mercado Pago', 'Naranja X', 'Ualá'];

/**
 * Valida una lista de tasas scrapeadas.
 *
 * @param {Array<{ app: string, tna: number }>} items
 * @param {{ tnaMin?: number, tnaMax?: number, minItems?: number, soft?: boolean }} opts
 *   - soft=true usa rangos más amplios (para el fallback de recálculo BADLAR)
 * @returns {{ ok: boolean, reason?: string, warnings: string[] }}
 */
function validate(items, opts = {}) {
  const {
    soft     = false,
    tnaMin   = soft ?  1 : 10,
    tnaMax   = soft ? 100 : 45,
    minItems = soft ?  5 :  2,
  } = opts;

  const warnings = [];

  // ── Checks estructurales ─────────────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: 'Lista vacía o tipo inválido', warnings };
  }

  if (items.length < minItems) {
    return {
      ok: false,
      reason: `Insuficientes items: ${items.length} (mínimo requerido: ${minItems})`,
      warnings,
    };
  }

  // ── Checks por ítem ──────────────────────────────────────────────
  for (const item of items) {
    if (!item.app || typeof item.app !== 'string') {
      return { ok: false, reason: `Item sin nombre de app: ${JSON.stringify(item)}`, warnings };
    }

    if (typeof item.tna !== 'number' || isNaN(item.tna) || !isFinite(item.tna)) {
      return {
        ok: false,
        reason: `TNA no numérica en "${item.app}": ${item.tna}`,
        warnings,
      };
    }

    if (item.tna < tnaMin || item.tna > tnaMax) {
      return {
        ok: false,
        reason: `TNA fuera de rango en "${item.app}": ${item.tna}% (válido: ${tnaMin}%–${tnaMax}%)`,
        warnings,
      };
    }
  }

  // ── Checks de entidades críticas (warnings, no rechazo) ──────────
  for (const appName of CRITICAL_APPS) {
    const found = items.find(i => i.app === appName);
    if (!found) {
      warnings.push(`Entidad crítica no encontrada en esta fuente: ${appName}`);
    }
  }

  return { ok: true, warnings };
}

module.exports = { validate, CRITICAL_APPS };
