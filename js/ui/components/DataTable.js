/* js/ui/components/DataTable.js
 *
 * Responsibilities:
 * - Owns table DOM event delegation (selection + details click)
 * - Triggers legacy table renderer when table-affecting state changes
 *
 * NOTE: Rendering stays delegated to the existing renderer to keep behavior identical.
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

  function DataTable() {
    let _table = null;
    let _tbody = null;
    let _store = null;
    let _deps = null;
    let _lastSig = '';
    let _lastSelVer = -1;

    function init(container, store, deps) {
      _table = container;
      _tbody = container ? container.querySelector('tbody') : null;
      _store = store;
      _deps = deps || {};

      if (_tbody && !_tbody.__cmpBound) {
        _tbody.__cmpBound = true;

        // Selection
        _tbody.addEventListener(
          'change',
          function (ev) {
            const t = ev && ev.target;
            if (!t || !t.classList || !t.classList.contains('row-select')) return;
            const tr = t.closest('tr[data-row-id]');
            if (!tr) return;
            const rid = normalizeRowId(tr.getAttribute('data-row-id'));
            if (!_store || typeof _store.dispatch !== 'function') return;
            _store.dispatch({ type: 'TOGGLE_SELECT_ROW', rowId: rid, checked: !!t.checked });
          },
          true
        );

        // Details toggle
        _tbody.addEventListener(
          'click',
          function (ev) {
            const btn = ev && ev.target && ev.target.closest ? ev.target.closest('button.row-quick-details, a.row-quick-details') : null;
            if (!btn) return;
            try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
            const tr = btn.closest('tr[data-row-id]');
            if (!tr) return;
            const rid = normalizeRowId(tr.getAttribute('data-row-id'));
            if (!_store || typeof _store.dispatch !== 'function') return;
            _store.dispatch({ type: 'TOGGLE_DETAILS', rowId: rid });
          },
          true
        );
      }
    }

    function render(state) {
      // Re-render only on table-affecting changes.
      const s = state || (_store && _store.getState ? _store.getState() : {});

      // Always keep visible checkbox states in sync when selection changes.
      try {
        const sel = s.selected || new Set();
        const ver = Number(s.selectedVersion || 0);
        if (ver !== _lastSelVer) {
          _lastSelVer = ver;
          const rows = document.querySelectorAll('#dataTable tbody tr[data-row-id]');
          rows.forEach((tr) => {
            if (tr.classList && tr.classList.contains('row-compare')) return;
            const id = normalizeRowId(tr.getAttribute('data-row-id'));
            const cb = tr.querySelector('input.row-select');
            if (cb) cb.checked = !!sel.has(id);
          });
        }
      } catch (_) {}
      const sig = [
        String(s.filter || ''),
        String(s.page || ''),
        String(s.pageSize || ''),
        String((s.headers && s.headers.length) || 0),
        String((s.view && s.view.length) || 0),
      ].join('|');

      if (sig === _lastSig) return;
      _lastSig = sig;

      try {
        if (_deps && typeof _deps.renderTable === 'function') {
          _deps.renderTable();
          return;
        }
        if (global.App && global.App.View && typeof global.App.View.renderTable === 'function') {
          global.App.View.renderTable();
        }
      } catch (_) {}
    }

    return { init, render };
  }

  global.App.UI.Components.DataTable = DataTable;
})(window);
