/* core/rules.js
 * Pure rule predicates and normalization helpers.
 * This is a compatibility layer so other modules can share the same predicates
 * without depending on DOM or globals.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MNDO_CoreRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normDeduct(v) {
    return String(v == null ? '' : v).toLowerCase().trim();
  }

  function matchesFilter(filterKey, row) {
    if (filterKey === 'ALL') return true;

    var d = normDeduct(row && row.deductFrom);

    if (filterKey === 'BALANCE') {
      return d.indexOf('balance') !== -1 && d.indexOf('free') === -1;
    }
    if (filterKey === 'UNITS') {
      return d.indexOf('free') !== -1 && d.indexOf('balance') === -1;
    }
    if (filterKey === 'BONUS') {
      return d === 'bonus';
    }
    if (filterKey === 'JUNK') {
      return (d.indexOf('balance') !== -1 && d.indexOf('free') !== -1) || d === 'bonus/free unit';
    }
    return true;
  }

  return {
    normDeduct: normDeduct,
    matchesFilter: matchesFilter
  };
});
