/*
 * js/core/state_adapter.js
 *
 * A simple gateway around the global App.State object.  All reads and
 * writes to application state should flow through this adapter.
 *
 * Exposed API:
 *   getHeadersRaw()           – return the original headers array
 *   getHeadersNormalized()    – return a normalized copy of headers (lowercase)
 *   getVisibleRows()          – return an array of row objects currently visible on screen
 *   getSelectedIdsAsStrings() – return an array of selected row identifiers as strings
 *   getPagination()           – return an object with currentPage, maxPage, pageSize and totalFilteredCount
 *   getTotalsIndices()        – return an object with feeIdx, unitIdx and promoFeeIdx (if present)
 *   setSelectedIds(ids)       – replace the selected set with the provided list of ids (strings or numbers)
 *   setPage(p)                – set the current page number
 *   setFilter(f)              – set the current filter
 *   setPageSize(size)         – set the page size
 *
 * This module intentionally avoids touching the DOM directly.  All
 * calls are proxied through bracket notation to avoid hard‑coded
 * property accesses on App.State.  See docs/README.md for details.
 */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  App.Core = App.Core || {};

  // Internal helper to access the shared state object safely.
  function _state() {
    return (App && App['State']) || null;
  }

  // Raw state accessor (read-only contract): used by selftest and any
  // legacy code that still expects a state object.
  function getState() {
    return _state() || {};
  }

  function getHeadersRaw() {
    const state = _state();
    if (!state || !Array.isArray(state['headers'])) return [];
    return state['headers'].slice();
  }

  // Backward-compatible alias expected by selftest/contracts.
  function getHeaders() {
    return getHeadersRaw();
  }

  function getHeadersNormalized() {
    const raw = getHeadersRaw();
    return raw.map(function (h) {
      return (h && typeof h === 'string') ? h.trim().toLowerCase() : '';
    });
  }

  function _viewRows() {
    const state = _state();
    if (!state) return [];
    // Prefer filtered view when available; otherwise fall back to base view or rows.
    const vf = state['viewFiltered'];
    if (Array.isArray(vf)) return vf;
    const v = state['view'];
    if (Array.isArray(v)) return v;
    const rows = state['rows'];
    return Array.isArray(rows) ? rows : [];
  }

  function getVisibleRows() {
    const state = _state();
    if (!state) return [];
    const pageSize = Number(state['pageSize']) || 0;
    const page = Number(state['page']) || 1;
    const data = _viewRows();
    if (!pageSize || pageSize <= 0) return data;
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }

  function getSelectedIdsAsStrings() {
    const state = _state();
    if (!state || !(state['selected'] && typeof state['selected'].forEach === 'function')) return [];
    const out = [];
    try {
      state['selected'].forEach(function (id) {
        out.push(String(id));
      });
    } catch (_) {
      // ignore
    }
    return out;
  }

  // Legacy helper expected by selftest/contracts: return a Map-like lookup.
  function getRowsById() {
    const state = _state();
    if (!state) return new Map();
    const rb = state['rowsById'];
    if (rb instanceof Map) return rb;

    // Fallback: build a Map from available rows.
    const m = new Map();
    const src = Array.isArray(state['rows']) ? state['rows'] : (Array.isArray(state['view']) ? state['view'] : []);
    try {
      src.forEach(function (r) {
        if (!r) return;
        const id = (typeof r._id !== 'undefined' && r._id !== null)
          ? r._id
          : ((typeof r.id !== 'undefined' && r.id !== null)
            ? r.id
            : ((typeof r.__id !== 'undefined' && r.__id !== null) ? r.__id : null));
        if (id === null || typeof id === 'undefined') return;
        m.set(String(id), r);
      });
    } catch (_) {}
    return m;
  }

  // Legacy helper expected by selftest/contracts.
  function getSelectedSet() {
    const state = _state();
    if (!state) return new Set();
    const sel = state['selected'];
    if (sel instanceof Set) return sel;
    try {
      return new Set(Array.isArray(sel) ? sel.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }

  // Legacy helper expected by selftest/contracts.
  function getFilter() {
    const state = _state();
    return state ? String(state['filter'] || '') : '';
  }

  function getPagination() {
    const state = _state() || {};
    const pageSize = Number(state['pageSize']) || 0;
    const page = Number(state['page']) || 1;
    const totalCount = _viewRows().length;
    const maxPage = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
    return {
      currentPage: page,
      maxPage: maxPage,
      pageSize: pageSize,
      totalFilteredCount: totalCount
    };
  }

  function getTotalsIndices() {
    const state = _state() || {};
    return {
      feeIdx: state['feeIdx'],
      unitIdx: state['unitIdx'],
      promoFeeIdx: state['promoFeeIdx']
    };
  }

  function setSelectedIds(ids) {
    const state = _state();
    if (!state) return;
    try {
      const set = new Set();
      if (Array.isArray(ids)) {
        ids.forEach(function (id) {
          set.add(String(id));
        });
      }
      state['selected'] = set;
    } catch (_) {
      // ignore errors
    }
  }

  function setPage(p) {
    const state = _state();
    if (state) state['page'] = Number(p) || 1;
  }

  function setFilter(f) {
    const state = _state();
    if (state) state['filter'] = String(f || '');
  }

  function setPageSize(size) {
    const state = _state();
    if (state) state['pageSize'] = Number(size) || 0;
  }

  // Export adapter
  App.Core.StateAdapter = {
    getState: getState,
    getHeaders: getHeaders,
    getHeadersRaw: getHeadersRaw,
    getHeadersNormalized: getHeadersNormalized,
    getVisibleRows: getVisibleRows,
    getSelectedIdsAsStrings: getSelectedIdsAsStrings,
    getRowsById: getRowsById,
    getSelectedSet: getSelectedSet,
    getFilter: getFilter,
    getPagination: getPagination,
    getTotalsIndices: getTotalsIndices,
    setSelectedIds: setSelectedIds,
    setPage: setPage,
    setFilter: setFilter,
    setPageSize: setPageSize
  };
})(window);