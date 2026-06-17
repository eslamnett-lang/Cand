/* worker_xlsx.js — parse Excel off the main thread (classic worker) */
self.importScripts('../../vendor/xlsx/xlsx.full.min.js');

function parseWorkbook(buffer, sheetName){
  var wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  var names = wb.SheetNames || [];
  var name = sheetName || (names[0] || null);
  if (!name) throw new Error('No sheets found in workbook');
  var ws = wb.Sheets[name];
  if (!ws) throw new Error('Sheet not found: ' + name);
  var aoa = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" });
  var headers = (aoa && aoa[0]) ? aoa[0] : [];
  var rows = (aoa && aoa.length > 1) ? aoa.slice(1) : [];
  return { rows: rows, meta: { headers: headers, sheetNames: names } };
}

self.onmessage = function(e){
  var msg = (e && e.data) ? e.data : {};
  try{
    // Back-compat: accept PARSE_XLSX (expected by js/data.js)
    if (msg.type === 'PARSE_XLSX'){
      var buffer = msg.file || msg.buffer;
      if (!buffer) throw new Error('No file buffer provided');
      var out = parseWorkbook(buffer, msg.sheetName || msg.name);
      self.postMessage({ type: 'XLSX_PARSED', rows: out.rows, meta: out.meta });
      return;
    }

    // Also accept legacy two-step protocol (init + sheet) if present
    if (msg.type === 'init' && msg.buffer){
      var wb = XLSX.read(msg.buffer, { type: 'array', cellDates: true });
      self.__wb = wb;
      self.postMessage({ type: 'ready', sheetNames: wb.SheetNames || [] });
      return;
    }
    if (msg.type === 'sheet' && self.__wb){
      var names = self.__wb.SheetNames || [];
      var name = msg.name || (names[0] || null);
      var ws = self.__wb.Sheets[name];
      var aoa = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" });
      self.postMessage({ type: 'XLSX_PARSED', rows: (aoa.length>1?aoa.slice(1):[]), meta: { headers: aoa[0]||[], sheetNames: names } });
      return;
    }
  }catch(err){
    self.postMessage({ type: 'XLSX_ERROR', message: String(err && err.message || err) });
    return;
  }
  // Unknown message types are ignored intentionally.
};
