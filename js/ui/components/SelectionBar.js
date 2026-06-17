/* js/ui/components/SelectionBar.js
 * Selection controls:
 * - Select all visible (checkbox)
 * - Clear selection
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function getVisibleIds() {
    try {
      const rows = Array.from(document.querySelectorAll('#dataTable tbody tr[data-row-id]'));
      return rows
        .filter((tr) => !(tr.classList && tr.classList.contains('row-compare')))
        .map((tr) => tr.getAttribute('data-row-id'))
        .filter(Boolean)
        .map((s) => {
          const n = Number(s);
          return Number.isNaN(n) ? s : n;
        });
    } catch (_) {
      return [];
    }
  }

  function SelectionBar() {
    let _store = null;
    let _checkAll = null;
    let _clearBtn = null;

    function init(_container, store) {
      _store = store;
      _checkAll = document.getElementById('checkAllVisible');
      _clearBtn = document.getElementById('clearSelection');

      if (_checkAll && !_checkAll.__cmpBound) {
        _checkAll.__cmpBound = true;
        _checkAll.addEventListener('change', function (e) {
          if (!_store || typeof _store.dispatch !== 'function') return;
          const checked = !!(e && e.target && e.target.checked);
          const ids = getVisibleIds();
          if (!ids.length) return;
          if (checked) _store.dispatch({ type: 'SELECT_ALL_VISIBLE', ids: ids });
          else _store.dispatch({ type: 'DESELECT_IDS', ids: ids });
        });
      }

      if (_clearBtn && !_clearBtn.__cmpBound) {
        _clearBtn.__cmpBound = true;
        _clearBtn.addEventListener('click', function (e) {
          try { e && e.preventDefault && e.preventDefault(); } catch (_) {}
          if (_store && typeof _store.dispatch === 'function') _store.dispatch({ type: 'CLEAR_SELECTION' });
          try { if (_checkAll) _checkAll.checked = false; } catch (_) {}
        });
      }
    }

    function render(state) {
      // Keep "select all visible" in sync.
      try {
        if (!_checkAll) return;
        const s = state || (_store && _store.getState ? _store.getState() : {});
        const ids = getVisibleIds();
        if (!ids.length) {
          _checkAll.indeterminate = false;
          _checkAll.checked = false;
          return;
        }
        const sel = s.selected || new Set();
        let hit = 0;
        for (const id of ids) if (sel.has(id)) hit++;
        _checkAll.indeterminate = hit > 0 && hit < ids.length;
        _checkAll.checked = hit === ids.length;
      } catch (_) {}
    }

    return { init, render };
  }

  global.App.UI.Components.SelectionBar = SelectionBar;
})(window);
