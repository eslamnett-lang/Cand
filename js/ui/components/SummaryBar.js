/* js/ui/components/SummaryBar.js
 * Selected totals + breakdown panel.
 *
 * To keep zero-regression, we delegate to the existing View implementation
 * (updateSumSelected + breakdown renderers) which already matches current UI.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function SummaryBar() {
    let _store = null;
    let _lastSig = '';

    function init(_container, store) {
      _store = store;
    }

    function render(state) {
      const s = state || (_store && _store.getState ? _store.getState() : {});
      // Only recompute when selection/filter changes.
      const sig = [String(s.filter || ''), String(s.selected ? s.selected.size : 0), String(s.detailsOpenRowId || '')].join('|');
      if (sig === _lastSig) return;
      _lastSig = sig;
      try {
        // Bridge: synchronize legacy State.selected with the store's state.selected
        // before updating sum.  Without this, the legacy View totals logic
        // sees an outdated selection set and reports zero totals.
        const legacyState = global.State || (global.App && global.App.State);
        if (legacyState && s && s.selected && typeof s.selected.size === 'number') {
          try {
            // Clone the selected ids from store into a new Set on legacy state.
            legacyState.selected = new Set(Array.from(s.selected));
          } catch (_) {
            // If assignment fails, ignore – updateSumSelected will still run.
          }
        }
        if (global.App && global.App.View && typeof global.App.View.updateSumSelected === 'function') {
          global.App.View.updateSumSelected();
        }
      } catch (_) {}
    }

    return { init, render };
  }

  global.App.UI.Components.SummaryBar = SummaryBar;
})(window);
