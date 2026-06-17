/* core/derive.js
 * Phase 6: Core Derived Model.
 *
 * computeDerived(state) => {
 *   filteredRows,
 *   pageRows,
 *   summary: { selectedCount, totalsFee, totalsUnits }
 * }
 *
 * SAFE: Returns numeric metadata only (no raw cell text).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var FilterEngine = require('./filter_engine');
    var Paginate = require('./paginate');
    var Summarizer = require('./summarizer');
    module.exports = factory(FilterEngine, Paginate, Summarizer);
  } else {
    root.App = root.App || {};
    root.App.Core = root.App.Core || {};
    root.App.Core.Derive = factory(
      root.App.Core.FilterEngine,
      root.App.Core.Paginate,
      root.App.Core.Summarizer
    );
  }
})(typeof window !== 'undefined' ? window : globalThis, function (FilterEngine, Paginate, Summarizer) {
  'use strict';

  function normHeader(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function pickHeader(headers, norms) {
    if (!Array.isArray(headers)) return null;
    for (var i = 0; i < headers.length; i++) {
      var n = normHeader(headers[i]);
      for (var j = 0; j < norms.length; j++) {
        if (n === norms[j]) return headers[i];
      }
    }
    return null;
  }

  function parseNumberLoose(v) {
    if (v == null) return 0;
    if (typeof v === 'number' && isFinite(v)) return v;
    var s = String(v);
    s = s.replace(/[,،]/g, ' ');
    var m = s.match(/-?\d+(?:\.\d+)?/);
    if (!m) return 0;
    var n = Number(m[0]);
    return isFinite(n) ? n : 0;
  }

  function computeSummaryFallback(state) {
    var selected = state && state.selected ? state.selected : (state && state.selectedIds ? state.selectedIds : null);
    var rowsById = state && (state.rowsById || state.__rowsById) ? (state.rowsById || state.__rowsById) : null;
    var headers = state && state.headers ? state.headers : null;
    var filterKey = state && (state.filterKey || state.filter) ? (state.filterKey || state.filter) : null;

    var selectedIds = [];
    if (selected && typeof selected.forEach === 'function') {
      selected.forEach(function (id) { selectedIds.push(String(id)); });
    } else if (Array.isArray(selected)) {
      for (var i = 0; i < selected.length; i++) selectedIds.push(String(selected[i]));
    }

    var feeHeader = pickHeader(headers, ['totalfee']);
    var promoFeeHeader = pickHeader(headers, ['totalpromotionalfee']);
    var unitsHeader = pickHeader(headers, ['freeunitconsumed']);

    var useFeeHeader = feeHeader;
    if (String(filterKey || '').toUpperCase() === 'BONUS' && promoFeeHeader) {
      useFeeHeader = promoFeeHeader;
    }

    var totalsFee = 0;
    var totalsUnits = 0;

    if (rowsById) {
      for (var k = 0; k < selectedIds.length; k++) {
        var idKey = selectedIds[k];
        var row = rowsById[idKey] || rowsById[Number(idKey)];
        if (!row) continue;
        if (useFeeHeader) totalsFee += parseNumberLoose(row[useFeeHeader]);
        if (unitsHeader) totalsUnits += parseNumberLoose(row[unitsHeader]);
      }
    }

    totalsFee = Math.round(totalsFee * 100) / 100;
    totalsUnits = Math.round(totalsUnits * 100) / 100;

    return { selectedCount: selectedIds.length, totalsFee: totalsFee, totalsUnits: totalsUnits };
  }

  function computeDerived(state) {
    state = state || {};
    var filterKey = state.filterKey || state.filter || 'ALL';
    var page = Number(state.currentPage || state.page || 1);
    var pageSize = Number(state.pageSize || 100);

    var baseRows = null;
    if (Array.isArray(state.viewFiltered)) baseRows = state.viewFiltered;
    else if (Array.isArray(state.view)) baseRows = state.view;

    var filteredRows = baseRows;
    if (!filteredRows) {
      var rows = Array.isArray(state.rows) ? state.rows : [];
      if (FilterEngine && typeof FilterEngine.applyFilter === 'function') {
        filteredRows = FilterEngine.applyFilter(rows, filterKey);
      } else if (FilterEngine && typeof FilterEngine.apply === 'function') {
        filteredRows = FilterEngine.apply(filterKey, rows);
      } else {
        filteredRows = rows;
      }
    }

    var pageRows = filteredRows;
    if (Paginate && typeof Paginate.slice === 'function') {
      pageRows = Paginate.slice(filteredRows, page, pageSize);
    } else {
      var start = (page - 1) * pageSize;
      pageRows = filteredRows.slice(start, start + pageSize);
    }

    var summary = computeSummaryFallback(state);
    if (Summarizer && typeof Summarizer.compute === 'function') {
      try {
        var s2 = Summarizer.compute(state);
        if (s2 && typeof s2 === 'object') summary = s2;
      } catch (e) {
        // ignore
      }
    }

    return { filteredRows: filteredRows, pageRows: pageRows, summary: summary };
  }

  return { computeDerived: computeDerived };
});
