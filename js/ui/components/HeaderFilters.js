/* js/ui/components/HeaderFilters.js
 * Top bar controls:
 * - file input
 * - sheet select
 * - main filter
 * - page size
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function HeaderFilters() {
    let _store = null;
    let _deps = null;
    let _fileInput = null;
    let _sheetSelect = null;
    let _filterSelect = null;
    let _pageSizeSelect = null;
    let _lastSheetsHash = '';

    function init(_container, store, deps) {
      _store = store;
      _deps = deps || {};

      _fileInput = document.getElementById('fileInput');
      _sheetSelect = document.getElementById('sheetSelect');
      _filterSelect = document.getElementById('filterSelect');
      _pageSizeSelect = document.getElementById('pageSize');

      if (_fileInput && !_fileInput.__cmpBound) {
        _fileInput.__cmpBound = true;
        _fileInput.addEventListener('change', function (e) {
          const f = e && e.target && e.target.files ? e.target.files[0] : null;
          if (!f) return;
          try {
            if (_deps && _deps.parser && typeof _deps.parser.loadFile === 'function') {
              _deps.parser.loadFile(f);
              return;
            }
            if (global.App && global.App.Data && typeof global.App.Data.handleFile === 'function') {
              global.App.Data.handleFile(f);
            }
          } catch (_) {}
        });
      }

      if (_sheetSelect && !_sheetSelect.__cmpBound) {
        _sheetSelect.__cmpBound = true;
        _sheetSelect.addEventListener('change', function (e) {
          const v = e && e.target ? e.target.value : '';
          if (!v) return;
          try {
            if (_deps && _deps.parser && typeof _deps.parser.loadSheet === 'function') {
              _deps.parser.loadSheet(v);
              return;
            }
            if (global.App && global.App.Data && typeof global.App.Data.loadSheet === 'function') {
              global.App.Data.loadSheet(v);
            }
          } catch (_) {}
        });
      }

      if (_filterSelect && !_filterSelect.__cmpBound) {
        _filterSelect.__cmpBound = true;
        _filterSelect.addEventListener('change', function (e) {
          const v = e && e.target ? e.target.value : 'ALL';
          if (_store && typeof _store.dispatch === 'function') {
            _store.dispatch({ type: 'SET_FILTER', filterKey: v });
          }
        });
      }

      if (_pageSizeSelect && !_pageSizeSelect.__cmpBound) {
        _pageSizeSelect.__cmpBound = true;
        _pageSizeSelect.addEventListener('change', function (e) {
          const ps = parseInt(e && e.target ? e.target.value : '100', 10) || 100;
          if (_store && typeof _store.dispatch === 'function') {
            _store.dispatch({ type: 'SET_PAGE_SIZE', pageSize: ps });
          }
        });
      }
    }

    function render(state) {
      const s = state || (_store && _store.getState ? _store.getState() : {});
      // Sync filter + page size selections
      try {
        if (_filterSelect && s.filter && _filterSelect.value !== s.filter) _filterSelect.value = s.filter;
      } catch (_) {}
      try {
        const ps = String(s.pageSize || 100);
        if (_pageSizeSelect && _pageSizeSelect.value !== ps) _pageSizeSelect.value = ps;
      } catch (_) {}

      // Keep sheet list in sync (idempotent; Data layer may also populate it)
      try {
        const sheets = Array.isArray(s.sheetNames) ? s.sheetNames : [];
        const sh = sheets.join('|');
        if (_sheetSelect && sh !== _lastSheetsHash) {
          _lastSheetsHash = sh;
          _sheetSelect.innerHTML = '';
          sheets.forEach(function (name, i) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (i === 0) opt.selected = true;
            _sheetSelect.appendChild(opt);
          });
          _sheetSelect.disabled = sheets.length === 0;
        }
      } catch (_) {}
    }

    return { init, render };
  }

  global.App.UI.Components.HeaderFilters = HeaderFilters;
})(window);
