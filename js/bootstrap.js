// js/bootstrap.js (Phase 4)
// Single entry **module** to remove script-order sensitivity.
//
// Key design points:
// - Uses **top-level await** so the browser waits for bootstrapping before
//   firing DOMContentLoaded (important for legacy modules that listen for it).
// - Loads SheetJS (vendor/xlsx) as a classic script (UMD) to preserve global XLSX.
// - Imports all app modules in a deterministic sequence.
// - Offline/Safe: no network; only local project files.

'use strict';

// Prevent double-boot (e.g., accidental duplicate script loads)
if (window.__APP_BOOTSTRAPPED) {
  console.warn('[boot] Already bootstrapped (module)');
} else {
  window.__APP_BOOTSTRAPPED = true;

function __resolve(url) {
  // Query params (used for optional modules)
  const __sp = new URLSearchParams(location.search || '');

  try {
    return new URL(url, document.baseURI).toString();
  } catch (_) {
    return url;
  }
}

function loadClassicScript(url) {
  return new Promise(function (resolve, reject) {
    try {
      var abs = __resolve(url);
      if (document.querySelector('script[data-bootstrap="' + abs + '"]')) return resolve(true);

      var s = document.createElement('script');
      // IMPORTANT: dynamic scripts should NOT use defer; we want execution as soon as loaded.
      s.async = false;
      s.src = abs;
      s.setAttribute('data-bootstrap', abs);
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('Failed to load script: ' + url)); };
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

try {
  // --- Vendor dependencies (classic scripts) ---
  // SheetJS full build is UMD and relies on classic-script global scope.
  await loadClassicScript('./vendor/xlsx/xlsx.full.min.js');

  // --- App modules (side-effect imports, in the original required order) ---
  await import('./config.js');
  await import('./utils.js');
  await import('./state.js');

  await import('./adapters/logger_adapter.js');
  await import('./store/store.js');

  await import('./core/filter_engine.js');
  await import('./core/pagination.js');
  await import('./core/summarizer.js');
  await import('./core/derive.js');

  // Load schema utilities before data.js. This defines App.Core.Schema
  // which is used by data.js and selftest to detect fee/unit columns
  await import('./core/schema.js');

  // Load state adapter to expose a canonical view of the state.  This must
  // be imported early so that legacy modules and tests can reference
  // App.Core.StateAdapter instead of window.State directly.
  await import('./core/state_adapter.js');

  // UI DOM gateway modules
  await import('./ui/dom_bindings.js');
  await import('./ui/dom_bindings_facade.js');
  await import('./ui/applier.js');

  await import('./ui_map.js');
  await import('./view_modules/toast.js');
  await import('./safe_console.js');
  await import('./hooks.js');
  await import('./auto_recover.js');
  await import('./error_boundary.js');

  await import('./data.js');

  await import('./rules/registry.js');
  await import('./rules/balance.js');
  await import('./rules/units.js');
  await import('./rules/bonus.js');
  await import('./rules/junk.js');
  await import('./rules/free_units.js');

  await import('./view_modules/table.js');
  await import('./view_modules/header_filters.js');
  await import('./view.js');

  await import('./ui/components/Toast.js');
  await import('./ui/components/ErrorOverlay.js');
  await import('./ui/components/DragPan.js');
  await import('./ui/components/HeaderFilters.js');
  await import('./ui/components/Pagination.js');
  await import('./ui/components/SelectionBar.js');
  await import('./ui/components/DataTable.js');
  await import('./ui/components/DetailsRow.js');
  await import('./ui/components/SummaryBar.js');
  await import('./adapters/parser_adapter.js');
  await import('./ui/ui_root.js');
  await import('./select_enhance.js');

  // Post-body patches (previously loaded at bottom of index.html)
  await import('./theme_patch.js');
  await import('./dragpan_pro.js');
  await import('../assets/js/perf_patch.js');
  await import('./helpers/details.js');
  // Optional: compact view (off by default)
  if (__sp.get('compact') === '1') {
    await import('./compact/compact_bootstrap.js');
  }


  // Optional: selftest/snapshot loaded only when requested (prevents any UI changes by default).
  try {
    var sp = __sp;
    if (sp.get('selftest') === '1' || sp.get('selftest') === 'unsafe') {
      await import('./selftest_smoke.js');
    }
    if (sp.get('snapshot')) {
      await import('./snapshot_mode.js');
    }
  } catch (_) {}

  // Auto-load sample workbook during selftest without requiring a file picker.
  // When running in selftest mode (only when selftest=1), load a bundled sample Excel
  // workbook encoded as base64 and feed it through the same parsing pipeline as a
  // user-uploaded file. This supports both file:// and http:// modes because it
  // does not rely on network fetches.  The sample_data module exports the
  // base64 string and a helper to convert it to an ArrayBuffer.  Once the data
  // module is imported earlier in this bootstrap sequence, App.Data.handleFile
  // becomes available to parse the file.  We create a synthetic File object to
  // reuse the existing file parsing logic.
  try {
    if (sp && sp.get('selftest') === '1') {
      const sample = await import('./sample_data.js');
      const buffer = sample.getSampleWorkbookBytes();
      // Construct a File from the ArrayBuffer.  The name and MIME type mirror a
      // typical XLSX upload.
      // Use a Blob instead of File for maximum compatibility.  Blobs also
      // implement the arrayBuffer() method used by handleFile and do not
      // require the File constructor which may be unavailable in some
      // contexts (e.g. file:// origins).  We still supply the correct MIME
      // type so downstream logic can infer a workbook.
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      if (globalThis.App && App.Data && typeof App.Data.handleFile === 'function') {
        // Use a short delay to wait for the DOM and UI layers to finish
        // initializing.  Without this delay the DOM nodes used by
        // handleFile (e.g. sheet selectors) may not exist, causing UI
        // updates to silently fail.  We do not await the returned promise
        // because any parsing errors are surfaced in the UI and selftest
        // harness.
        setTimeout(function () {
          try {
            App.Data.handleFile(blob);
          } catch (_) {}
        }, 200);
      }
    }
  } catch (e) {
    try { console.error('[bootstrap] sample workbook auto-load failed', e); } catch (_) {}
  }
} catch (e) {
  // Fail safe: show minimal message without leaking any file data.
  try {
    console.error('[bootstrap] failed:', (e && e.message) ? e.message : String(e));
  } catch (_) {}
}
}