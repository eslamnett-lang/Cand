/* worker_xlsx_blob.js — Worker URL helper (DOM-free)
 *
 * Old versions inlined a full SheetJS build + browser download helpers.
 * That created a large DOM surface area and mixed "generation" with "download".
 *
 * New behavior:
 *   - Returns a URL string for a dedicated worker script (parse/export)
 *   - Workers do generation/parsing only (no DOM)
 *   - Main thread triggers download via App.UI.dom.downloadBlob(...)
 */
(function () {
  'use strict';

  function absURL(relPath) {
    // location.href works in browsers and avoids touching DOM globals.
    return new URL(relPath, location.href).toString();
  }

  // Back-compat global: used by older code paths
  window.__createXlsxWorkerURL = function (kind) {
    kind = kind || 'parse';
    if (kind === 'export') return absURL('./assets/js/worker_xlsx_export.js');
    return absURL('./assets/js/worker_xlsx.js');
  };
})();
