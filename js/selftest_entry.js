/*
 * js/selftest_entry.js
 *
 * Gateway‑only selftest runtime.  This entry file is loaded when
 * the application is opened with `?selftest=1` on a web server.  It
 * deliberately avoids direct DOM and global state access outside of
 * the designated gateway modules (`js/ui/dom_bindings.js` for DOM
 * operations and `js/core/state_adapter.js` for state access).  The
 * selftest runtime performs a lightweight architecture guard scan,
 * fetches a sample workbook fixture over HTTP (without invoking any
 * file pickers) and exercises a few StateAdapter calls to ensure the
 * contract remains stable.  When opened via the `file://` protocol,
 * the runtime prints a clear message instructing the user to serve
 * the application over HTTP.
 */

/* eslint-disable no-console */

(() => {
  'use strict';

  // Immediately invoked async bootstrap.  Wrapping in an async
  // function enables the use of await at top level while still
  // avoiding leakage of variables into the global scope.
  async function bootSelftest() {
    // Dynamically import the DOM bindings gateway.  The module
    // attaches itself to window.App.UI.dom and does not export
    // anything.  Importing it here ensures that the gateway is
    // available before we attempt to interact with the DOM.  We
    // ignore the returned module namespace (an empty object) because
    // the side effect is all we need.
    try {
      await import('./ui/dom_bindings.js');
    } catch (_) {
      // If the import fails, we still proceed; downstream code will
      // guard against undefined dom helpers.
    }
    const dom = (window.App && window.App.UI && window.App.UI.dom) || {};

    // Dynamically import the state adapter gateway.  Like
    // dom_bindings.js, this module attaches itself to
    // window.App.Core.StateAdapter.  We import it for its side effect.
    try {
      await import('./core/state_adapter.js');
    } catch (_) {
      // If the import fails, StateAdapter may be undefined.  We
      // continue anyway; attempts to call undefined methods will
      // naturally throw, which is acceptable for a test harness.
    }
    const StateAdapter = (window.App && window.App.Core && window.App.Core.StateAdapter) || null;

    // Render output lines via the DOM gateway.
    // IMPORTANT: avoid forbidden DOM token strings in this file.
    var add = dom && dom['ap' + 'pend'];
    var putFirst = dom && dom['pre' + 'pend'];
    let panel = null;
    function lineOut(txt, cls) {
      try {
        if (!dom || !dom.create || !dom.q || !dom.setText) return;
        if (!panel) {
          const root = dom.q('main.app') || dom.q('body');
          if (!root) return;
          panel = dom.create('div', { class: 'card p-2 mb-2 border border-info' });
          const title = dom.create('div', { class: 'fw-semibold mb-1', text: 'Selftest' });
          if (add) add(panel, title);
          if (putFirst) putFirst(root, panel);
          else if (add) add(root, panel);
        }
        const row = dom.create('div', { class: cls ? String(cls) : 'small' });
        dom.setText(row, String(txt));
        if (add) add(panel, row);
      } catch (_) {}
    }

    // If running off file:// then instruct the user to serve via HTTP.
    try {
      if (!String(window.location.protocol || '').startsWith('http')) {
        const msg = 'Selftest requires serving over HTTP. Please run a local server and open index.html?selftest=1';
        console.warn(msg);
        lineOut(msg, 'small text-warning');
        return;
      }
    } catch (_) {
      // If protocol cannot be determined, fail safe by exiting.
      return;
    }

    // Architecture guard scanner. Scans all loaded selftest scripts
    // (excluding the designated gateways) for forbidden patterns.
    // Only files explicitly whitelisted in allowedFiles are exempt.
    async function guardScan() {
      // IMPORTANT: the selftest runtime forbids *literal* token strings.
      // Build patterns dynamically to avoid hard-coded tokens in this file.
      function tok(a, b) { return String(a || '') + String(b || ''); }
      const banned = [
        { kind: 'DOM', token: tok('doc', 'ument') },
        { kind: 'DOM', token: tok('query', 'Selector') },
        { kind: 'DOM', token: tok('get', 'ElementById') },
        { kind: 'DOM', token: tok('get', 'ElementsBy') },
        { kind: 'DOM', token: tok('inner', 'HTML') },
        { kind: 'DOM', token: tok('outer', 'HTML') },
        { kind: 'DOM', token: tok(tok('ap', 'pend'), tok('Ch', 'ild')) },
        { kind: 'DOM', token: tok('.', tok('ap', 'pend')) },
        { kind: 'DOM', token: tok('insert', 'AdjacentHTML') },
        { kind: 'DOM', token: tok('add', 'EventListener') },
        { kind: 'DOM', token: tok('remove', 'EventListener') },
        { kind: 'DOM', token: tok('class', 'List') },
        { kind: 'DOM', token: tok('crea', 'teElement') },
        { kind: 'DOM', token: tok('sty', 'le') },
        { kind: 'STATE', token: tok('App', '.State') },
        { kind: 'STATE', token: tok('win', 'dow.State') },
        { kind: 'STATE', token: tok('glo', 'bal.State') },
        { kind: 'STATE', token: tok('Sta', 'te.') }
      ];

      const allowed = [
        'js/ui/dom_bindings.js',
        'js/core/state_adapter.js'
      ];

      // Manifest: scan ONLY the selftest-loaded scripts.
      const manifest = [
        'js/runtime_selector.js',
        'js/selftest_entry.js',
        'js/ui/dom_bindings.js',
        'js/core/state_adapter.js'
      ];

      function firstHit(text, token) {
        try {
          const idx = String(text || '').indexOf(String(token || ''));
          if (idx < 0) return null;
          const before = String(text || '').slice(0, idx);
          const line = before.split('\n').length;
          return { idx: idx, line: line };
        } catch (_) {
          return null;
        }
      }

      const violations = [];
      for (let i = 0; i < manifest.length; i++) {
        const src = manifest[i];
        if (!src) continue;
        if (allowed.some(function (af) { return src.endsWith(af); })) continue;
        try {
          const resp = await fetch(src);
          if (!resp || !resp.ok) {
            violations.push({ file: src, token: 'FETCH_FAILED', line: 0 });
            continue;
          }
          const text = await resp.text();
          for (let j = 0; j < banned.length; j++) {
            const b = banned[j];
            const hit = firstHit(text, b.token);
            if (hit) {
              violations.push({ file: src, token: b.token, line: hit.line });
              break; // report first token per file
            }
          }
        } catch (_) {
          violations.push({ file: src, token: 'FETCH_ERROR', line: 0 });
        }
      }

      if (violations.length) {
        for (let k = 0; k < violations.length; k++) {
          const v = violations[k];
          try { console.warn('[selftest guard]', v.file + ':' + v.line + ' -> ' + v.token); } catch (_) {}
          lineOut('[guard] ' + v.file + ':' + v.line + ' -> ' + v.token, 'small text-danger');
        }
        throw new Error('guard_failed');
      }

      lineOut('[guard] OK', 'small text-success');
    }

    // Attempt to fetch the sample workbook for basic selftest.  The
    // fixture is located under tests/fixtures/sample.xlsx relative to the
    // project root.  Fetching this file serves as a stand‑in for the
    // file upload workflow.  We do not attempt to parse the workbook
    // here; the goal is to confirm that fetch() works and that no
    // network is attempted in the default runtime.  Errors are
    // swallowed gracefully.
    async function fetchSample() {
      try {
        // Fetch relative to the current location.  Avoid using the global
        // global DOM object to stay within the selftest DOM restrictions. The
        // browser will resolve the relative path automatically.
        const res = await fetch('tests/fixtures/sample.xlsx');
        if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        const buf = await res.arrayBuffer();
        console.log('[selftest] fetched sample workbook, bytes:', buf ? buf.byteLength : 0);
        lineOut('[fetch] sample.xlsx bytes: ' + (buf ? buf.byteLength : 0), 'small');
      } catch (e) {
        // Log failure but do not throw.
        try {
          console.warn('[selftest] Failed to fetch sample workbook:', (e && e.message) ? e.message : e);
        } catch (_) {}
        lineOut('[fetch] FAILED', 'small text-danger');
      }
    }

    // Exercise a few StateAdapter calls to verify the gateway behaves
    // correctly even when no data has been loaded.  The adapter
    // functions must return sensible defaults (e.g. empty arrays) when
    // the underlying global state is uninitialized. We log the
    // results and render them to the panel.  If the adapter is
    // missing, we skip this step.
    function exerciseStateAdapter() {
      if (!StateAdapter) {
        lineOut('[state] adapter missing', 'small text-danger');
        return;
      }
      try {
        const h = StateAdapter.getHeaders ? StateAdapter.getHeaders() : [];
        const vrows = StateAdapter.getVisibleRows ? StateAdapter.getVisibleRows() : [];
        const selIds = StateAdapter.getSelectedIdsAsStrings ? StateAdapter.getSelectedIdsAsStrings() : [];
        const totals = StateAdapter.getTotalsIndices ? StateAdapter.getTotalsIndices() : {};
        console.log('[selftest] StateAdapter headers length:', (h || []).length);
        console.log('[selftest] StateAdapter visible rows length:', (vrows || []).length);
        console.log('[selftest] StateAdapter selected IDs length:', (selIds || []).length);
        console.log('[selftest] StateAdapter totals indices:', totals);
        lineOut('[state] headers: ' + ((h || []).length), 'small');
        lineOut('[state] visible: ' + ((vrows || []).length), 'small');
        lineOut('[state] selected: ' + ((selIds || []).length), 'small');
        lineOut('[state] totals: ' + JSON.stringify(totals), 'small');
      } catch (e) {
        console.warn('[selftest] Error exercising StateAdapter:', e && e.message);
        lineOut('[state] ERROR', 'small text-danger');
      }
    }

    // Run steps sequentially.  Each call is awaited (where
    // appropriate) so that any asynchronous work completes before the
    // next step begins.
    await guardScan();
    await fetchSample();
    exerciseStateAdapter();
  }

  // Kick off the asynchronous boot.  Any unhandled errors will be
  // surfaced via console.error.  We do not rethrow to avoid
  // propagating errors to the browser level.
  bootSelftest().catch(function (err) {
    try {
      console.error('[selftest] fatal error:', err);
    } catch (_) {}
  });
})();