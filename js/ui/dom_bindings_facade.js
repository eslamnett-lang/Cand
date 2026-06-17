/*
 * js/ui/dom_bindings_facade.js
 *
 * Legacy facade that exposes the old DomBindings surface area,
 * but implemented using App.UI.dom primitives.
 *
 * NOTE: This file may contain VIEW logic (what to show/hide),
 * but MUST NOT contain business rules (totals calculations, filtering rules, etc).
 */
(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  App.UI = App.UI || {};
  const dom = App.UI.dom;

  function renderTable(viewModel) {
    try {
      if (App.View && typeof App.View.renderTable === 'function') App.View.renderTable();
    } catch (_) {}
  }

  function renderTotals(model) {
    try {
      if (App.View && typeof App.View.updateSumSelected === 'function') App.View.updateSumSelected();
    } catch (_) {}
  }

  function renderDetails(model) {
    // no-op for now; handled elsewhere
  }

  function renderToolbar(model) {
    try {
      const state = model || (App.Core && App.Core.StateAdapter && App.Core.StateAdapter.getPagination && App.Core.StateAdapter.getPagination());
      if (!state) return;
      const info = dom.byId('pageInfo');
      if (info) dom.setText(info, state.currentPage + ' / ' + state.maxPage);

      const nextBtn = dom.byId('nextPage');
      const prevBtn = dom.byId('prevPage');
      if (nextBtn) nextBtn.disabled = state.currentPage >= state.maxPage;
      if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    } catch (_) {}
  }

  function showLoading(flag) {
    try {
      const el = dom.byId('loading');
      if (!el) return;
      el.style.display = flag ? 'flex' : 'none';
    } catch (_) {}
  }

  function renderEmptyState(flag) {
    try {
      const tbody = dom.q('#dataTable tbody');
      if (!tbody) return;

      dom.qa('tr.empty-row', tbody).forEach(function (tr) { tr.remove(); });

      if (!flag) return;

      const tr = dom.create('tr', { class: 'empty-row' });
      const td = dom.create('td', { class: 'text-center text-muted' });

      // UI-only decision: how many columns are visible (NOT a business rule)
      let colSpan = 1;
      try {
        if (App.Core && App.Core.StateAdapter && typeof App.Core.StateAdapter.getHeadersRaw === 'function') {
          colSpan = (App.Core.StateAdapter.getHeadersRaw().length + 1);
        }
      } catch (_) {}
      td.colSpan = colSpan;

      dom.setText(td, 'لا توجد بيانات لعرضها');
      tr.appendChild(td);
      tbody.appendChild(tr);
    } catch (_) {}
  }

  function bindNextPage(handler) {
    const btn = dom.byId('nextPage');
    if (!btn) return;
    dom.on(btn, 'click', function (ev) {
      ev.preventDefault();
      handler && handler(ev);
    });
  }

  function bindPrevPage(handler) {
    const btn = dom.byId('prevPage');
    if (!btn) return;
    dom.on(btn, 'click', function (ev) {
      ev.preventDefault();
      handler && handler(ev);
    });
  }

  function bindFilterChange(handler) {
    const sel = dom.byId('filterSelect');
    if (!sel) return;
    dom.on(sel, 'change', function (ev) {
      handler && handler(ev.target && ev.target.value);
    });
  }

  function bindPageSizeChange(handler) {
    const sel = dom.byId('pageSize');
    if (!sel) return;
    dom.on(sel, 'change', function (ev) {
      handler && handler(parseInt(ev.target && ev.target.value, 10));
    });
  }

  function bindSelectAll(handler) {
    const cb = dom.byId('checkAllVisible');
    if (!cb) return;
    dom.on(cb, 'change', function (ev) {
      handler && handler(ev.target && ev.target.checked);
    });
  }

  function bindClearSelection(handler) {
    const btn = dom.byId('clearSelection');
    if (!btn) return;
    dom.on(btn, 'click', function (ev) {
      ev.preventDefault();
      handler && handler(ev);
    });
  }

  App.UI.DomBindings = {
    renderTable: renderTable,
    renderTotals: renderTotals,
    renderDetails: renderDetails,
    renderToolbar: renderToolbar,
    renderEmptyState: renderEmptyState,
    showLoading: showLoading,
    bindNextPage: bindNextPage,
    bindPrevPage: bindPrevPage,
    bindFilterChange: bindFilterChange,
    bindPageSizeChange: bindPageSizeChange,
    bindSelectAll: bindSelectAll,
    bindClearSelection: bindClearSelection
  };
})(window);
