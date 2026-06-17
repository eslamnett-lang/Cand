/* js/ui/ui_root.js
 *
 * Mounts UI components and wires Store -> UI rendering.
 *
 * This file is intentionally small: components own event bindings and rendering.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  const App = global.App;
  const dom = (App.UI && App.UI.dom) ? App.UI.dom : null;

  function init() {
    if (!dom) { try { console.error('[ui_root] dom gateway missing'); } catch (_) {} return; }

    const store = App.Store;
    if (!store || typeof store.getState !== 'function' || typeof store.dispatch !== 'function') {
      try { console.error('[ui_root] Store missing'); } catch (_) {}
      return;
    }

    const logger = (App.Adapters && App.Adapters.Logger && typeof App.Adapters.Logger.create === 'function')
      ? App.Adapters.Logger.create('ui_root')
      : { debug: function(){}, info: function(){}, warn: function(){}, error: function(){} };

    const deps = {
      parser: (App.Adapters && App.Adapters.Parser) ? App.Adapters.Parser : null,
      logger: logger,
      renderTable: function () {
        try {
          if (App.View && typeof App.View.renderTable === 'function') return App.View.renderTable();
        } catch (_) {}
      },
    };

    const C = (App.UI && App.UI.Components) ? App.UI.Components : {};
    const components = [];

    function mount(Ctor, container) {
      try {
        if (typeof Ctor !== 'function') return;
        const inst = Ctor();
        if (!inst || typeof inst.init !== 'function' || typeof inst.render !== 'function') return;
        inst.init(container, store, deps);
        components.push(inst);
      } catch (e) {
        logger.error('component mount failed');
      }
    }

    mount(C.Toast, dom.q('body'));
    mount(C.ErrorOverlay, dom.q('body'));
    mount(C.DragPan, dom.q('body'));
    mount(C.HeaderFilters, dom.q('body'));
    mount(C.Pagination, dom.q('body'));
    mount(C.SelectionBar, dom.q('body'));
    mount(C.DataTable, dom.byId('dataTable'));
    mount(C.DetailsRow, dom.byId('dataTable'));
    mount(C.SummaryBar, dom.q('body'));

    function renderAll() {
      const s = store.getState();
      for (const cmp of components) {
        try { cmp.render(s); } catch (_) {}
      }
    }

    // Initial paint
    renderAll();

    // Store -> UI
    store.subscribe(function (_state, _action) {
      renderAll();
    });

    // Expose a minimal facade for legacy/debug (SAFE by default)
    App.UIRoot = {
      renderAll: renderAll,
      components: components,
    };

    logger.debug('mounted');
  }

  try {
    dom.ready(init);
  } catch (_) {
    try { dom.on(document, 'DOMContentLoaded', init, { once: true }); } catch (__) {}
  }
})(window);