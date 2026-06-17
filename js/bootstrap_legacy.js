// js/bootstrap_legacy.js (Phase 4 fallback)
// Classic-script bootstrap for file:// where Chrome blocks ES module imports.
// Loads the app scripts in a deterministic order without relying on <script> ordering in index.html.

(function () {
  'use strict';

  // Prevent double-boot (e.g., accidental duplicate script loads)
  if (window.__APP_BOOTSTRAPPED) { console.warn('[boot] Already bootstrapped (legacy)'); return; }
  window.__APP_BOOTSTRAPPED = true;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      try {
        if (document.querySelector('script[data-bootstrap="' + url + '"]')) return resolve(true);
        var s = document.createElement('script');
        s.src = url;
        // IMPORTANT: dynamic scripts should NOT use defer; we want execution as soon as loaded.
        s.async = false;
        s.setAttribute('data-bootstrap', url);
        s.onload = function () { resolve(true); };
        s.onerror = function () { reject(new Error('Failed to load script: ' + url)); };
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Sequential load helper
  async function loadAll(list) {
    for (var i = 0; i < list.length; i++) {
      await loadScript(list[i]);
    }
  }

  (async function () {
    try {
      // Vendor first (UMD globals)
      await loadAll([
        './vendor/xlsx/xlsx.full.min.js'
      ]);

      // App scripts (same order as legacy index.html)
      await loadAll([
        './js/config.js',
        './js/utils.js',
        './js/state.js',
        './js/adapters/logger_adapter.js',
        './js/store/store.js',
        './js/core/filter_engine.js',
        './js/core/pagination.js',
        './js/core/summarizer.js',
        './js/core/derive.js',
        // New gateway modules
        './js/core/state_adapter.js',
        './js/ui/dom_bindings.js',
        './js/ui/dom_bindings_facade.js',
        './js/ui/applier.js',
        './js/ui_map.js',
        './js/view_modules/toast.js',
        './js/safe_console.js',
        './js/hooks.js',
        './js/auto_recover.js',
        './js/error_boundary.js',
        './js/data.js',
        './js/rules/registry.js',
        './js/rules/balance.js',
        './js/rules/units.js',
        './js/rules/bonus.js',
        './js/rules/junk.js',
        './js/rules/free_units.js',
        './js/view_modules/table.js',
        './js/view_modules/header_filters.js',
        './js/view.js',
        './js/helpers/details.js',
        './js/ui/components/Toast.js',
        './js/ui/components/ErrorOverlay.js',
        './js/ui/components/DragPan.js',
        './js/ui/components/HeaderFilters.js',
        './js/ui/components/Pagination.js',
        './js/ui/components/SelectionBar.js',
        './js/ui/components/DataTable.js',
        './js/ui/components/DetailsRow.js',
        './js/ui/components/SummaryBar.js',
        './js/adapters/parser_adapter.js',
        './js/ui/ui_root.js',
        './js/select_enhance.js',
        './js/theme_patch.js',
        './js/dragpan_pro.js',
        './assets/js/perf_patch.js',
      ]);

      // Optional scripts
      try {
        var sp = new URLSearchParams(location.search || '');
        if (sp.get('selftest') === '1' || sp.get('selftest') === 'unsafe') {
          await loadScript('./js/selftest_smoke.js');
        }
        if (sp.get('snapshot')) {
          await loadScript('./js/snapshot_mode.js');
        }
        if (sp.get('compact') === '1') {
          await loadScript('./js/compact/compact_bootstrap.js');
        }
      } catch (_) {}
    } catch (e) {
      try {
        console.error('[bootstrap_legacy] failed:', (e && e.message) ? e.message : String(e));
      } catch (_) {}
    }
  })();
})();