// Phase 11: Summary renderer (UI adapter)
//
// الهدف: تحديث شريط التجميع السريع للصفوف المحددة
// (sumSelectedBar + breakdown) عبر نقطة دخول مستقلة.
//
// NOTE: لضمان Zero Regression، ما زال منطق التجميع/التقسيم المصدر
// الأساسي له هو `App.View.updateSumSelected()` داخل view.js.

(function (global) {
  const App = (global.App = global.App || {});
  App.UI = App.UI || {};

  function render(model, action) {
    try {
      if (App.View && typeof App.View.updateSumSelected === 'function') {
        return App.View.updateSumSelected();
      }
      // Older builds fallback
      if (typeof global.updateSumSelected === 'function') {
        return global.updateSumSelected();
      }
    } catch (_) {
      // SAFE default: do not throw from UI adapter.
    }
  }

  // New name (Phase 11)
  App.UI.SummaryRenderer = { render };
  // Backward-compatible alias (older Phase 8 naming)
  if (!App.UI.SummaryBar) {
    App.UI.SummaryBar = App.UI.SummaryRenderer;
  }
})(window);
