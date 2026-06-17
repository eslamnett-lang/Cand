/* js/ui/components/DetailsRow.js
 * Store-driven Details toggle.
 *
 * - When state.detailsOpenRowId changes, this component opens/closes the compare/details row
 *   using the existing DetailsHelpers.toggleRowDetails implementation.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function normalizeRowId(idStr) {
    const n = Number(idStr);
    return Number.isNaN(n) ? idStr : n;
  }

  function byIdFromState(state, rid) {
    try {
      const m = state && state.rowsById;
      if (m && typeof m.get === 'function') {
        const v = m.get(String(rid));
        if (v) return v;
      }
    } catch (_) {}
    try {
      const rows = (state && state.rows) || [];
      const k = String(rid);
      return rows.find((r) => r && String(r._id) === k) || null;
    } catch (_) {
      return null;
    }
  }

  function DetailsRow() {
    let _store = null;
    let _lastOpen = null;

    function init(_container, store) {
      _store = store;
    }

    function render(state) {
      const s = state || (_store && _store.getState ? _store.getState() : {});
      const openId = s.detailsOpenRowId || null;
      if (String(openId || '') === String(_lastOpen || '')) return;

      // Close previous (toggle off) if still present
      try {
        if (_lastOpen != null) {
          const trPrev = document.querySelector('#dataTable tbody tr[data-row-id="' + String(_lastOpen) + '"]');
          const btnPrev = trPrev ? trPrev.querySelector('button.row-quick-details, a.row-quick-details') : null;
          const rowPrev = trPrev ? byIdFromState(s, _lastOpen) : null;
          if (trPrev && btnPrev && rowPrev && global.DetailsHelpers && typeof global.DetailsHelpers.toggleRowDetails === 'function') {
            global.DetailsHelpers.toggleRowDetails(trPrev, rowPrev, btnPrev);
          } else {
            // Fallback: clear any existing compare rows
            document.querySelectorAll('#dataTable .row-compare').forEach((el) => { try { el.remove(); } catch (_) {} });
            document.querySelectorAll('#dataTable .row-quick-details.on').forEach((el) => { try { el.classList.remove('on'); } catch (_) {} });
          }
        }
      } catch (_) {}

      _lastOpen = openId;

      // Open new
      try {
        if (openId != null) {
          const tr = document.querySelector('#dataTable tbody tr[data-row-id="' + String(openId) + '"]');
          const btn = tr ? tr.querySelector('button.row-quick-details, a.row-quick-details') : null;
          const rowObj = tr ? byIdFromState(s, openId) : null;
          if (tr && btn && rowObj && global.DetailsHelpers && typeof global.DetailsHelpers.toggleRowDetails === 'function') {
            global.DetailsHelpers.toggleRowDetails(tr, rowObj, btn);
          }
        }
      } catch (_) {}
    }

    return { init, render };
  }

  global.App.UI.Components.DetailsRow = DetailsRow;
})(window);
