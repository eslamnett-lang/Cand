// Phase 11: UI controls wiring + render orchestration
//
// الهدف: جعل main.js subscription "مفيد" عبر App.UI.renderAll(action)
// بحيث يمكن تحديث أجزاء الواجهة بشكل مركزي.
//
// ملاحظة: لا توجد أي اتصالات شبكة أو تعديلات فى UI/CSS هنا.

(function (global) {
  const App = (global.App = global.App || {});
  App.UI = App.UI || {};

  function computeDerivedMaybe(state) {
    try {
      if (App.Core && App.Core.Derive && typeof App.Core.Derive.computeDerived === 'function') {
        return App.Core.Derive.computeDerived(state);
      }
    } catch (_) {
      // optional
    }
    return null;
  }

  function buildRenderModel(state) {
    return {
      state: state,
      derived: computeDerivedMaybe(state),
      flags: {
        selftest: (() => {
          try {
            const sp = new URLSearchParams(global.location.search || '');
            return sp.get('selftest') === '1';
          } catch (_) {
            return false;
          }
        })(),
      },
    };
  }

  function typeOfAction(action) {
    try {
      return String((action && action.type) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function renderAll(action) {
    // Canonical state reference: prefer Store.getState (reducer-based), fallback to window.State
    const state = (App.Store && typeof App.Store.getState === 'function') ? App.Store.getState() : (global.State || (App && App.State));
    const model = buildRenderModel(state);

    const t = typeOfAction(action);

    // Map a few legacy labels (Phase 11 spec uses SELECT/DETAILS names)
    const isLoad     = (t === 'LOAD_WORKBOOK');
    const isFilter   = (t === 'SET_FILTER');
    const isPage     = (t === 'SET_PAGE' || t === 'SET_PAGE_SIZE');
    const isSelect   = (t === 'SELECT' || t === 'TOGGLE_SELECT' || t === 'SELECT_VISIBLE' || t === 'SELECT_IDS' || t === 'DESELECT_IDS' || t === 'CLEAR_SELECTION');
    const isDetails  = (t === 'DETAILS' || t === 'OPEN_DETAILS' || t === 'CLOSE_DETAILS');

    // Minimal render selection (safe defaults)
    const wantTable   = isLoad || isFilter || isPage || (t === 'SELECT_VISIBLE' || t === 'SELECT_IDS' || t === 'DESELECT_IDS' || t === 'CLEAR_SELECTION');
    const wantSummary = isLoad || isFilter || isSelect || isDetails;
    const wantDetails = isDetails;

    // Order matters: table first so checkboxes/rows exist before any dependent UI.
    if (wantTable && App.UI.TableRenderer && typeof App.UI.TableRenderer.render === 'function') {
      App.UI.TableRenderer.render(model, action);
    }

    if (wantSummary) {
      const SR = App.UI.SummaryRenderer || App.UI.SummaryBar;
      if (SR && typeof SR.render === 'function') {
        SR.render(model, action);
      }
    }

    if (wantDetails && App.UI.DetailsRenderer && typeof App.UI.DetailsRenderer.render === 'function') {
      App.UI.DetailsRenderer.render(model, action);
    }

    // SAFE fallback: if action has no known type (or renderers missing), keep legacy behavior best-effort.
    if (!t) {
      try {
        if (App.View && typeof App.View.renderTable === 'function') App.View.renderTable();
        if (App.View && typeof App.View.updateSumSelected === 'function') App.View.updateSumSelected();
      } catch (_) {}
    }
  }

  App.UI.buildRenderModel = buildRenderModel;
  App.UI.renderAll = renderAll;
})(window);
