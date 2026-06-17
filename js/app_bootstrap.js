// js/app_bootstrap.js
// Single, explicit runtime entry point for both http(s) and file://
// Default: load ESM bootstrap (js/bootstrap.js)
// Optional: force legacy via ?legacy=1
// Fallback: if module load fails (common on file:// in Chrome), auto-load legacy bootstrap.

(function () {
  'use strict';

  function loadClassic(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.defer = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(s);
    });
  }

  function loadModule(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = url;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('Failed to load module: ' + url)); };
      document.head.appendChild(s);
    });
  }

  (async function boot() {
    var sp = new URLSearchParams(location.search || '');
    var forceLegacy = sp.get('legacy') === '1';

    // Debug marker
    window.__BOOT_MODE = forceLegacy ? 'legacy' : 'module';

    if (forceLegacy) {
      console.warn('[boot] legacy=1 → loading bootstrap_legacy.js');
      await loadClassic('./js/bootstrap_legacy.js');
      return;
    }

    try {
      console.info('[boot] loading module bootstrap.js');
      await loadModule('./js/bootstrap.js');
      return;
    } catch (e) {
      console.warn('[boot] module failed → fallback to legacy', (e && e.message) ? e.message : e);
      window.__BOOT_MODE = 'legacy-fallback';
      await loadClassic('./js/bootstrap_legacy.js');
    }
  })();
})();
