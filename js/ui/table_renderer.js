// Phase 11: Table renderer (UI adapter)
//
// هدف هذا الملف: جعل بناء الجدول مسؤولية طبقة UI (js/ui)
// مع الحفاظ على نفس DOM/CSS والسلوك السابق (Zero Regression).
//
// ملاحظة: منطق بناء الـ DOM الفعلي ما زال المصدر الأساسي له هو
// `App.View.renderTable()` والذي يقوم بدوره باستدعاء
// `App.View._renderTableRaw` (في js/view_modules/table.js) مع غلاف SAFE.

(function (global) {
  const App = (global.App = global.App || {});
  App.UI = App.UI || {};

  function render(model, action) {
    // model/action currently unused: legacy renderer reads from State.
    try {
      if (App.View && typeof App.View.renderTable === 'function') {
        return App.View.renderTable();
      }
      // Fallback for older builds
      if (typeof global.renderTable === 'function') {
        return global.renderTable();
      }
      // Last-resort: raw renderer (if exposed)
      if (App.View && typeof App.View._renderTableRaw === 'function') {
        return App.View._renderTableRaw();
      }
    } catch (_) {
      // Keep SAFE default: no throw from UI adapter.
    }
  }

  App.UI.TableRenderer = { render };
})(window);
