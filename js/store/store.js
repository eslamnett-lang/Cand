/* js/store/store.js
 * FINAL: Single source of truth Store (Vanilla JS, static offline).
 *
 * API:
 *   - getState()
 *   - dispatch(action)
 *   - subscribe(listener) => unsubscribe
 *
 * Privacy:
 *   - No data-dump logging here.
 *
 * Back-compat:
 *   - Keeps a stable `window.State` reference by syncing properties after each dispatch.
 *   - Exposes store on `window.App.Store`.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  const App = global.App;

  function normalizeContainers(s) {
    const out = Object.assign({}, s || {});
    if (out.selected && !(out.selected instanceof Set)) out.selected = new Set(out.selected);
    if (!out.selected) out.selected = new Set();

    if (out.rowsById && !(out.rowsById instanceof Map)) {
      try {
        out.rowsById = new Map(Object.entries(out.rowsById));
      } catch (_) {
        out.rowsById = new Map();
      }
    }
    if (!out.rowsById) out.rowsById = new Map();

    if (out.detailCache && !(out.detailCache instanceof Map)) {
      try {
        out.detailCache = new Map(Object.entries(out.detailCache));
      } catch (_) {
        out.detailCache = new Map();
      }
    }
    if (!out.detailCache) out.detailCache = new Map();

    if (!out.headerFilters || typeof out.headerFilters !== 'object') out.headerFilters = {};
    if (!out.rangeFilter || typeof out.rangeFilter !== 'object') out.rangeFilter = { from: null, to: null };

    if (typeof out.selectedVersion !== 'number') out.selectedVersion = 0;

    return out;
  }

  function getCoreFilterEngine() {
    try {
      return App && App.Core && App.Core.FilterEngine ? App.Core.FilterEngine : null;
    } catch (_) {
      return null;
    }
  }

  function computeViewFromRows(rows, filterKey) {
    try {
      const FE = getCoreFilterEngine();
      if (FE && typeof FE.apply === 'function') return FE.apply(filterKey, rows);
    } catch (_) {}
    return Array.isArray(rows) ? rows.slice() : [];
  }

  function reducer(state, action) {
    state = normalizeContainers(state);
    action = action || {};

    // Compatibility: allow patch-based updates (used by some legacy helpers).
    if (action.patch && typeof action.patch === 'object') {
      return normalizeContainers(Object.assign({}, state, action.patch));
    }

    switch (action.type) {
      // --- Required actions (spec) ---
      case 'LOAD_WORKBOOK_SUCCESS':
      case 'LOAD_WORKBOOK': {
        const payload = action.payload || {};
        const next = normalizeContainers(Object.assign({}, state, payload));
        return next;
      }

      case 'SET_FILTER': {
        const rows = Array.isArray(state.rows) ? state.rows : [];
        const view = computeViewFromRows(rows, action.filterKey);
        return normalizeContainers(Object.assign({}, state, { filter: action.filterKey, page: 1, view: view }));
      }

      case 'SET_PAGE':
        return normalizeContainers(Object.assign({}, state, { page: action.page }));

      case 'SET_PAGE_SIZE':
        return normalizeContainers(Object.assign({}, state, { pageSize: action.pageSize, page: 1 }));

      case 'TOGGLE_SELECT_ROW':
      case 'TOGGLE_SELECT': {
        const sel = new Set(state.selected || []);
        const id = action.rowId;
        if (action.checked) sel.add(id);
        else sel.delete(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel, selectedVersion: (state.selectedVersion || 0) + 1 }));
      }

      case 'SELECT_ALL_VISIBLE':
      case 'SELECT_IDS': {
        const sel = new Set(state.selected || []);
        for (const id of (action.ids || [])) sel.add(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel, selectedVersion: (state.selectedVersion || 0) + 1 }));
      }

      case 'DESELECT_IDS': {
        const sel = new Set(state.selected || []);
        for (const id of (action.ids || [])) sel.delete(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel, selectedVersion: (state.selectedVersion || 0) + 1 }));
      }

      case 'CLEAR_SELECTION': {
        return normalizeContainers(Object.assign({}, state, { selected: new Set(), selectedVersion: (state.selectedVersion || 0) + 1 }));
      }

      case 'TOGGLE_DETAILS': {
        const cur = state.detailsOpenRowId || null;
        const want = action.rowId || null;
        const nextId = (cur && want && String(cur) === String(want)) ? null : want;
        return normalizeContainers(Object.assign({}, state, { detailsOpenRowId: nextId }));
      }

      // Compatibility actions
      case 'OPEN_DETAILS':
        return normalizeContainers(Object.assign({}, state, { detailsOpenRowId: action.rowId || null }));
      case 'CLOSE_DETAILS':
        return normalizeContainers(Object.assign({}, state, { detailsOpenRowId: null }));

      case 'RESET': {
        const next = Object.assign({}, state);
        next.selected = new Set();
        next.detailCache = new Map();
        next.page = 1;
        return normalizeContainers(next);
      }

      default:
        return state;
    }
  }

  function createStore(initialState, bridgeTarget) {
    let state = normalizeContainers(initialState || {});
    const listeners = new Set();

    function syncBridge(next) {
      if (!bridgeTarget) return;
      try {
        for (const k of Object.keys(bridgeTarget)) {
          if (!(k in next)) delete bridgeTarget[k];
        }
        Object.assign(bridgeTarget, next);
      } catch (_) {}
    }

    function getState() {
      return state;
    }

    function dispatch(action) {
      const prev = state;
      const next = reducer(prev, action);
      if (next === prev) return prev;
      state = next;
      syncBridge(next);

      const silent = !!(action && (action.silent || (action.meta && action.meta.silent)));
      if (!silent) {
        for (const fn of listeners) {
          try {
            fn(state, action);
          } catch (_) {}
        }
      }
      return state;
    }

    function subscribe(listener) {
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    syncBridge(state);

    return { getState, dispatch, subscribe, _reducer: reducer };
  }

  // Create the app store once, reusing App.State as the stable bridge target.
  // This keeps legacy modules working while UI is refactored into components.
  try {
    App.State = App.State || global.State || {};
    if (!App.Store || typeof App.Store.dispatch !== 'function') {
      App.Store = createStore(App.State, App.State);
    }
  } catch (_) {}

  App.StoreFactory = { createStore: createStore };
})(window);
