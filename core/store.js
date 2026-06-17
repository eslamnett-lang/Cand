/* core/store.js
 * Phase 7: Store/Dispatch facade + action definitions.
 *
 * IMPORTANT: This is a compatibility layer. It does not change behavior by itself.
 * The actual state container is still `core/state_manager.js` (App.Core.StateManager).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./state_manager'));
  } else {
    root.App = root.App || {};
    root.App.Core = root.App.Core || {};
    root.App.Core.Store = factory(root.App.Core.StateManager);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (StateManager) {
  'use strict';

  var ActionTypes = {
    LOAD_WORKBOOK: 'LOAD_WORKBOOK',
    SET_FILTER: 'SET_FILTER',
    SET_PAGE: 'SET_PAGE',
    SET_PAGE_SIZE: 'SET_PAGE_SIZE',
    TOGGLE_SELECT: 'TOGGLE_SELECT',
    SELECT_VISIBLE: 'SELECT_VISIBLE',
    CLEAR_SELECTION: 'CLEAR_SELECTION',
    OPEN_DETAILS: 'OPEN_DETAILS',
    CLOSE_DETAILS: 'CLOSE_DETAILS',
    RESET: 'RESET'
  };

  function createStore(initialState) {
    if (StateManager && typeof StateManager.createStateManager === 'function') {
      return StateManager.createStateManager(initialState || {});
    }
    // Fallback: expose a minimal no-op store (should never happen in app runtime).
    var _s = initialState || {};
    var _subs = [];
    return {
      getState: function () { return _s; },
      dispatch: function () {},
      subscribe: function (fn) { _subs.push(fn); return function () {}; },
      ActionTypes: ActionTypes
    };
  }

  return {
    ActionTypes: ActionTypes,
    createStore: createStore
  };
});
