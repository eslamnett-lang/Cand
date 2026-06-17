MndoView Final Pro Build (performance-tuned)
-------------------------------------------
What changed:
1) Removed duplicate Bootstrap RTL stylesheet (kept vendor/bootstrap/bootstrap.rtl.min.css)
2) Added Web Worker for XLSX parsing at assets/js/worker_xlsx.js
3) Added perf_patch.js (assets/js/perf_patch.js) which exposes:
   - window.ensureXLSX(): Promise that ensures XLSX is loaded
   - window.parseExcelFile(file): Promise that parses the Excel in a Web Worker with graceful main-thread fallback
4) Ensured all scripts run with 'defer' to avoid blocking HTML parsing.
5) Kept XLSX vendor script in index.html for compatibility with current data.js.

How to fully opt-in to Worker parsing (optional):
- In your controller or wherever the file input is handled, replace the Excel parsing flow with:

  async function onFileSelected(file) {
    document.getElementById('loading').style.display = 'flex';
    try {
      const result = await window.parseExcelFile(file); // { sheet, rows }
      // If your code expects a workbook + loadSheet(), you can keep the current path.
      // Otherwise, set State.rows = result.rows and rebuild UI directly.
      // Example:
      //   App.State.rows = result.rows;
      //   App.State.sheetNames = [result.sheet];
      //   App.Data.rebuildUI();
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  }

Notes:
- parseExcelFile() returns JSON rows from the first sheet. If you need multiple sheets, extend the worker to iterate over wb.SheetNames.
- If you later migrate to lazy-loading XLSX only when needed, simply remove the vendor xlsx script tag from index.html; perf_patch.js will load it on demand.
