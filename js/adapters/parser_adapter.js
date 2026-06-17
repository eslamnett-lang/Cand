/* js/adapters/parser_adapter.js
 * Parser adapter (worker/fallback wrapper).
 *
 * This is a thin wrapper around the existing Data layer to keep behavior identical.
 * It exposes a small, stable API for ui_root/components.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.Adapters = global.App.Adapters || {};

  function loadFile(file) {
    try {
      if (global.App && global.App.Data && typeof global.App.Data.handleFile === 'function') {
        global.App.Data.handleFile(file);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function loadSheet(sheetName) {
    try {
      if (global.App && global.App.Data && typeof global.App.Data.loadSheet === 'function') {
        global.App.Data.loadSheet(sheetName);
        return true;
      }
    } catch (_) {}
    return false;
  }

  global.App.Adapters.Parser = {
    loadFile,
    loadSheet,
  };
})(window);
