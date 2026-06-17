/* xlsx_exporter.js — main-thread bridge for XLSX export
 *
 * Responsibilities:
 *   - Create / talk to the export worker
 *   - Convert ArrayBuffer to Blob
 *   - Trigger download via App.UI.dom.downloadBlob
 *
 * NOTE: This file should be loaded only when export is needed (feature path), not by default bootstrap.
 */
(function () {
  'use strict';

  function ensureDom() {
    if (!window.App || !App.UI || !App.UI.dom || typeof App.UI.dom.downloadBlob !== 'function') {
      throw new Error('App.UI.dom.downloadBlob is not available');
    }
    return App.UI.dom;
  }

  function createWorker() {
    // Prefer the global helper if present (kept for back-compat)
    var url = (typeof window.__createXlsxWorkerURL === 'function')
      ? window.__createXlsxWorkerURL('export')
      : new URL('../../assets/js/worker_xlsx_export.js', location.href).toString();

    return new Worker(url);
  }

  /**
   * Export an Array-of-Arrays to XLSX and download it.
   * @param {Object} opts { headers?: any[], rows: any[][], filename?: string, sheetName?: string }
   * @returns {Promise<void>}
   */
  function exportAoaToXlsx(opts) {
    opts = opts || {};
    var dom = ensureDom();
    var worker = createWorker();

    return new Promise(function (resolve, reject) {
      var done = false;

      function cleanup() {
        try { worker.terminate(); } catch (_) {}
      }

      worker.onmessage = function (e) {
        var msg = (e && e.data) ? e.data : {};
        if (msg.type === 'XLSX_READY') {
          done = true;
          try {
            var blob = new Blob([msg.buffer], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            dom.downloadBlob(blob, msg.filename || opts.filename || 'export.xlsx');
            cleanup();
            resolve();
          } catch (err) {
            cleanup();
            reject(err);
          }
          return;
        }

        if (msg.type === 'XLSX_ERROR') {
          done = true;
          cleanup();
          reject(new Error(msg.message || 'XLSX_ERROR'));
        }
      };

      worker.onerror = function (err) {
        if (done) return;
        done = true;
        cleanup();
        reject(err);
      };

      worker.postMessage({
        type: 'EXPORT_XLSX',
        headers: opts.headers || null,
        rows: opts.rows || [],
        filename: opts.filename || 'export.xlsx',
        sheetName: opts.sheetName || 'Sheet1'
      });
    });
  }

  // Expose a tiny API under App.Export
  window.App = window.App || {};
  App.Export = App.Export || {};
  App.Export.exportAoaToXlsx = exportAoaToXlsx;
})();
