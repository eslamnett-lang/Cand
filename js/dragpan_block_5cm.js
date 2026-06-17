// Block drag-pan in the first 5cm from the RIGHT edge (RTL-friendly)
(function(){
  'use strict';
  var CM_TO_PX = 96 / 2.54;        // ~37.795 px
  var BLOCK_PX = 5 * CM_TO_PX;     // ~189 px

  function isBlocked(e, el){
    var rect = el.getBoundingClientRect();
    // Always from RIGHT as requested
    var fromRight = rect.right - e.clientX;
    return fromRight <= BLOCK_PX;
  }

  function setup(){
    var wrap = document.querySelector('.table-wrap');
    if (!wrap) return;

    // Prevent drag handler from seeing pointerdown in the blocked zone
    wrap.addEventListener('pointerdown', function(ev){
      if (isBlocked(ev, wrap)){
        // Do NOT prevent default so checkboxes still toggle normally
        ev.stopPropagation(); // block the drag listener upstream
      }
    }, true); // capture

    // Cursor hint
    wrap.addEventListener('pointermove', function(ev){
      if (isBlocked(ev, wrap)){
        wrap.style.cursor = 'default';
      } else {
        wrap.style.cursor = '';
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();