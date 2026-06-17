/* core/state_manager.js
 *
 * State manager for MNDO View.
 *
 * API:
 *   - getState()
 *   - dispatch(action)
 *   - subscribe(listener) => unsubscribe
 *
 * Compatibility:
 *   - Maintains a stable `window.State` reference by syncing properties after
 *     each dispatch, so legacy code holding a `State` reference keeps working.
 */

(function (global) {
  'use strict';

  function normalizeContainers(s) {
    const out = Object.assign({}, s || {});
    if (out.selected && !(out.selected instanceof Set)) out.selected = new Set(out.selected);
    if (!out.selected) out.selected = new Set();
    if (out.rowsById && !(out.rowsById instanceof Map)) {
      // If passed as plain object: convert entries.
      try {
        out.rowsById = new Map(Object.entries(out.rowsById));
      } catch (e) {
        out.rowsById = new Map();
      }
    }
    if (!out.rowsById) out.rowsById = new Map();
    // Details cache is expected to be a Map in legacy code (has/get/set/clear).
    // Preserve Map when present, and convert plain objects to Map when needed.
    if (out.detailCache && !(out.detailCache instanceof Map)) {
      try {
        out.detailCache = new Map(Object.entries(out.detailCache));
      } catch (e) {
        out.detailCache = new Map();
      }
    }
    if (!out.detailCache) out.detailCache = new Map();
    return out;
  }

  function reducer(state, action) {
    state = normalizeContainers(state);
    action = action || {};

    switch (action.type) {
      case 'LOAD_WORKBOOK': {
        const payload = action.payload || {};
        const next = normalizeContainers(Object.assign({}, state, payload));
        return next;
      }
      case 'SET_FILTER':
        // Phase 2: single source of truth via Store.
        // Recompute `view` from existing rows using the pure filter engine when available.
        try {
          const FE = (global.App && global.App.Core && global.App.Core.FilterEngine) ? global.App.Core.FilterEngine : null;
          const rows = Array.isArray(state.rows) ? state.rows : [];
          const view = (FE && typeof FE.apply === 'function') ? FE.apply(action.filterKey, rows) : rows.slice();
          return normalizeContainers(Object.assign({}, state, { filter: action.filterKey, page: 1, view: view }));
        } catch (_) {
          return normalizeContainers(Object.assign({}, state, { filter: action.filterKey, page: 1 }));
        }

      case 'SET_PAGE':
        return normalizeContainers(Object.assign({}, state, { page: action.page }));

      case 'SET_PAGE_SIZE':
        return normalizeContainers(Object.assign({}, state, { pageSize: action.pageSize, page: 1 }));

      case 'TOGGLE_SELECT': {
        const sel = new Set(state.selected || []);
        const id = action.rowId;
        if (action.checked) sel.add(id);
        else sel.delete(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel }));
      }

      case 'SELECT_IDS': {
        const sel = new Set(state.selected || []);
        for (const id of (action.ids || [])) sel.add(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel }));
      }

      case 'DESELECT_IDS': {
        const sel = new Set(state.selected || []);
        for (const id of (action.ids || [])) sel.delete(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel }));
      }

      case 'CLEAR_SELECTION':
        return normalizeContainers(Object.assign({}, state, { selected: new Set() }));

      case 'SELECT_VISIBLE': {
        // Caller provides the visible row ids to select.
        const sel = new Set(state.selected || []);
        for (const id of (action.ids || [])) sel.add(id);
        return normalizeContainers(Object.assign({}, state, { selected: sel }));
      }

      case 'OPEN_DETAILS':
        return normalizeContainers(Object.assign({}, state, { detailsOpenRowId: action.rowId || null }));

      case 'CLOSE_DETAILS':
        return normalizeContainers(Object.assign({}, state, { detailsOpenRowId: null }));

      case 'RESET': {
        // Reset transient state only (mirrors resetTransientState intent)
        const next = Object.assign({}, state);
        next.selected = new Set();
        next.detailCache = new Map();
        next.page = 1;
        return normalizeContainers(next);
      }

      default: {
        // Optional patch support for gradual migration
        if (action.patch && typeof action.patch === 'object') {
          return normalizeContainers(Object.assign({}, state, action.patch));
        }
        return state;
      }
    }
  }

  function createStateManager(initialState, stateBridgeTarget) {
    let state = normalizeContainers(initialState);
    const listeners = new Set();

    function syncBridge(next) {
      if (!stateBridgeTarget) return;
      // Remove keys not present in next
      for (const k of Object.keys(stateBridgeTarget)) {
        if (!(k in next)) delete stateBridgeTarget[k];
      }
      Object.assign(stateBridgeTarget, next);
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
      if (!silent){
        for (const fn of listeners) {
          try {
            fn(state, action);
          } catch (e) {
            // Never throw from subscribers in production.
          }
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

    return {
      getState,
      dispatch,
      subscribe,
      _reducer: reducer,
    };
  }

  global.createStateManager = createStateManager;
})(window);
