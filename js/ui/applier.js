/*
 * js/ui/applier.js
 *
 * Takes the output of pure renderer modules (view models) and applies
 * those changes to the DOM via the DomBindings gateway.  This keeps
 * rendering logic decoupled from side‑effects.  At present the
 * renderers return undefined and legacy modules directly update the DOM,
 * so this applier acts as a no‑op.  It is ready for future use when
 * renderers start returning structured changes.
 */

(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  App.UI = App.UI || {};

  function apply(renderResult) {
    // A renderResult may contain partial updates for different UI areas.
    // For example: { table: vm1, totals: vm2, toolbar: vm3 }
    if (!renderResult || typeof renderResult !== 'object') return;
    try {
      const dom = App.UI.DomBindings || {};
      if (renderResult.table && typeof dom.renderTable === 'function') {
        dom.renderTable(renderResult.table);
      }
      if (renderResult.totals && typeof dom.renderTotals === 'function') {
        dom.renderTotals(renderResult.totals);
      }
      if (renderResult.details && typeof dom.renderDetails === 'function') {
        dom.renderDetails(renderResult.details);
      }
      if (renderResult.toolbar && typeof dom.renderToolbar === 'function') {
        dom.renderToolbar(renderResult.toolbar);
      }
    } catch (_) {
      // ignore errors to avoid cascading failures
    }
  }

  App.UI.Applier = { apply: apply };
})(window);