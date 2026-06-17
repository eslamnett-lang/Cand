/* js/ui/components/DragPan.js
 * Drag-pan wrapper.
 *
 * The existing implementation self-initializes (dragpan_pro.js).
 * This component exists as an architectural boundary only.
 */

(function (global) {
  'use strict';
  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function DragPan() {
    function init() {}
    function render() {}
    return { init, render };
  }

  global.App.UI.Components.DragPan = DragPan;
})(window);
