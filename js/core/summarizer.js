/* core/summarizer.js
 * Pure summarizer for selection totals.
 * Mirrors current behavior conceptually: sums fee + units across selected rows.
 *
 * IMPORTANT: This module does not touch DOM and does not log.
 *
 * Browser: attaches to window.App.Core.Summarizer
 * Node: module.exports
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.App = global.App || {};
    global.App.Core = global.App.Core || {};
    global.App.Core.Summarizer = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function toNumber(v) {
    if (v == null) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    // Keep this conservative: strip non-numeric except . and - and ,
    // then remove commas.
    const s = String(v).trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9,.-]+/g, '').replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Compute totals from a selection.
   * @param {Object} opts
   * @param {Iterable<number|string>} opts.selectedIds
   * @param {(id:number|string)=>Object|undefined} opts.rowById
   * @param {string} [opts.filterKey] - current main filter (BONUS special-case)
   * @param {string} [opts.feeField='totalFee']
   * @param {string} [opts.promoFeeField='totalPromotionalFee']
   * @param {string} [opts.unitsField='freeUnitConsumed']
   */
  function compute(opts) {
    const selectedIds = (opts && opts.selectedIds) || [];
    const rowById = (opts && opts.rowById) || (() => undefined);
    const filterKey = (opts && opts.filterKey) || 'ALL';
    const feeField = (opts && opts.feeField) || 'totalFee';
    const promoFeeField = (opts && opts.promoFeeField) || 'totalPromotionalFee';
    const unitsField = (opts && opts.unitsField) || 'freeUnitConsumed';

    let totalFee = 0;
    let totalUnits = 0;
    let selectedCount = 0;

    for (const id of selectedIds) {
      const row = rowById(id);
      if (!row) continue;
      selectedCount += 1;

      const feeVal = filterKey === 'BONUS' && row[promoFeeField] != null ? row[promoFeeField] : row[feeField];
      totalFee += toNumber(feeVal);
      totalUnits += toNumber(row[unitsField]);
    }

    return {
      selectedCount,
      totalFee,
      totalUnits,
    };
  }

  return {
    toNumber,
    compute,
  };
});
