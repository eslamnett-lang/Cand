/* js/adapters/logger_adapter.js
 * SAFE logger + SAFE/UNSAFE intent gate.
 *
 * Privacy by default:
 * - SAFE is the default.
 * - UNSAFE requires explicit URL parameter AND a confirm dialog.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.Adapters = global.App.Adapters || {};

  const R = (global.App.Runtime = global.App.Runtime || {});
  let _unsafeEnabled = false;
  let _unsafePrompted = false;

  function hasUnsafeParam() {
    try {
      const sp = new URLSearchParams(global.location.search || '');
      return sp.get('snapshot') === 'unsafe' || sp.get('selftest') === 'unsafe';
    } catch (_) {
      return false;
    }
  }

  function requestUnsafeEnable() {
    if (_unsafeEnabled) return true;
    if (_unsafePrompted) return false;
    _unsafePrompted = true;
    if (!hasUnsafeParam()) return false;
    try {
      const ok = global.confirm('UNSAFE mode will allow exporting debug snapshots/baselines.\n\nProceed?');
      if (ok) {
        _unsafeEnabled = true;
        R.unsafe = true;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isUnsafe() {
    return !!_unsafeEnabled;
  }

  function createSafeLogger(scope) {
    const pfx = scope ? '[' + String(scope) + '] ' : '';
    function safeMsg(args) {
      try {
        const a = Array.prototype.slice.call(args || []);
        // Only keep primitive-ish first argument.
        if (!a.length) return pfx;
        const x = a[0];
        if (x == null) return pfx;
        if (typeof x === 'string') return pfx + x;
        return pfx + String(x);
      } catch (_) {
        return pfx;
      }
    }

    return {
      debug: function () {
        if (!isUnsafe()) return;
        try { console.debug(safeMsg(arguments)); } catch (_) {}
      },
      info: function () {
        if (!isUnsafe()) return;
        try { console.info(safeMsg(arguments)); } catch (_) {}
      },
      warn: function () {
        // Warnings are allowed in SAFE but without payload.
        try { console.warn(safeMsg(arguments)); } catch (_) {}
      },
      error: function () {
        // Errors are allowed in SAFE but without payload.
        try { console.error(safeMsg(arguments)); } catch (_) {}
      },
    };
  }

  global.App.Adapters.Logger = {
    hasUnsafeParam,
    requestUnsafeEnable,
    isUnsafe,
    create: createSafeLogger,
  };
})(window);
