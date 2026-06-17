/* worker_xlsx_export.js — generate XLSX off the main thread (classic worker)
 *
 * DOM-free by design: it only receives data and returns ArrayBuffer.
 * Main thread handles saving/downloading.
 */
self.importScripts('../../vendor/xlsx/xlsx.full.min.js');

function buildWorkbook(payload){
  var sheetName = (payload && payload.sheetName) ? String(payload.sheetName) : 'Sheet1';
  var headers = (payload && payload.headers) ? payload.headers : null;
  var rows = (payload && payload.rows) ? payload.rows : [];

  // Accept rows as array-of-arrays; if headers provided, prepend.
  var aoa = [];
  if (headers && headers.length) aoa.push(headers);
  for (var i = 0; i < rows.length; i++) aoa.push(rows[i]);

  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

self.onmessage = function(e){
  var msg = (e && e.data) ? e.data : {};
  try{
    if (msg.type !== 'EXPORT_XLSX') return;

    var wb = buildWorkbook(msg);
    var ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    // Transfer ArrayBuffer back to main thread
    self.postMessage({ type: 'XLSX_READY', buffer: ab, filename: msg.filename || 'export.xlsx' }, [ab]);
  }catch(err){
    self.postMessage({ type: 'XLSX_ERROR', message: String(err && err.message || err) });
  }
};
