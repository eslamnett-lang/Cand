/*!
 * perf_patch.js — safe replacement (2025-09-06)
 * الغرض: يمنع أخطاء الـ SyntaxError ويضمن عدم كسر المشروع.
 * - لا يغير منطق التطبيق.
 * - يوفّر Utilities اختيارية عند الحاجة.
 */
(function(){
  'use strict';

  var logPrefix = '[perf_patch]';
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
  } catch (e) { return; }

  function ensureXLSXLoaded() {
    try { return Promise.resolve(!!window.XLSX); }
    catch (e) { return Promise.resolve(false); }
  }

  function parseFile(file) {
    return new Promise(function(resolve, reject){
      try {
        if (!file) return reject(new Error('No file provided'));
        if (!window || !window.FileReader) return reject(new Error('FileReader not available'));
        var fr = new FileReader();
        fr.onerror = function(){ reject(fr.error || new Error('Failed to read file')); };
        fr.onload = function() {
          try {
            if (!window.XLSX) {
              console.warn(logPrefix, 'XLSX library not found. Returning ArrayBuffer only.');
              return resolve(fr.result);
            }
            var data = new Uint8Array(fr.result);
            var wb = window.XLSX.read(data, { type: 'array' });
            resolve(wb);
          } catch (err) { reject(err); }
        };
        fr.readAsArrayBuffer(file);
      } catch (err) { reject(err); }
    });
  }

  try {
    window.PerfPatch = window.PerfPatch || {};
    window.PerfPatch.ensureXLSXLoaded = ensureXLSXLoaded;
    window.PerfPatch.parseFile = parseFile;
    if (console && console.debug) console.debug(logPrefix, 'loaded.');
  } catch(e) {}
})();
