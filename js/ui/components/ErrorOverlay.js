/* js/ui/components/ErrorOverlay.js
 * Error overlay wrapper.
 *
 * Existing error_boundary/auto_recover scripts own behavior.
 */

(function (global) {
  'use strict';
  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function ErrorOverlay() {
    function init() {}
    function render() {}
    return { init, render };
  }

  global.App.UI.Components.ErrorOverlay = ErrorOverlay;
})(window);
