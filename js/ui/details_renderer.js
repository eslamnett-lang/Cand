// Phase 11: Details renderer (UI adapter)
//
// المطلوب: فصل منطق إنشاء/عرض تفاصيل الصف (row details) بعيدًا عن view.js.
//
// مبدئيًا (لـ Zero Regression): تفاصيل الصفوف وتحديث لوحة الـ breakdown
// ما زال يتم عبر المسار القديم (DetailsHelpers + updateSumSelected).
// هذه الوحدة توفر entrypoint ثابت يمكن تطويره لاحقًا بدون لمس طبقات أخرى.

(function (global) {
  const App = (global.App = global.App || {});
  App.UI = App.UI || {};

  function render(model, action) {
    // No-op on purpose: legacy behavior is preserved.
    // Details rows are toggled via DetailsHelpers and do not require a full render pass.
  }

  App.UI.DetailsRenderer = { render };
})(window);
