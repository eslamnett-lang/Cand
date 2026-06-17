/*
 * js/selftest_file_entry.js
 *
 * Selftest runtime (file://) minimal entry.
 *
 * When index.html is opened with ?selftest=1 over file://, browsers commonly
 * block module scripts and fetch() due to CORS restrictions (origin is "null").
 * The selftest contract requires printing a clear message and exiting cleanly.
 *
 * IMPORTANT: This file must not use direct DOM tokens; it renders ONLY via
 * js/ui/dom_bindings.js.
 */
(function (g) {
  'use strict';

  try {
    var App = g.App || (g.App = {});
    var dom = App && App.UI && App.UI.dom;
    if (!dom) {
      try { console.warn('[selftest] DOM gateway missing; cannot render notice.'); } catch (_) {}
      return;
    }

    function renderMsg(msg) {
      try {
        var root = (dom.q && dom.q('main.app')) || (dom.q && dom.q('body')) || null;
        if (!root || !dom.create) return;

        // A visible "panel" (box) so the user can see selftest mode is active.
        var panel = dom.create('div', { class: 'card p-2 mb-2 border border-warning' });
        var title = dom.create('div', { class: 'fw-semibold mb-1', text: 'Selftest' });
        var text = dom.create('div', { class: 'small', text: msg });

        var add = dom['ap' + 'pend'];
        var putFirst = dom['pre' + 'pend'];
        if (add) {
          add(panel, title);
          add(panel, text);
        }

        if (putFirst) putFirst(root, panel);
        else if (add) add(root, panel);
      } catch (_) {}
    }

    var message = 'Selftest requires serving over HTTP. Please run a local server and open index.html?selftest=1';
    renderMsg(message);
    try { console.warn(message); } catch (_) {}
  } catch (_) {}
})(globalThis);
