// dragpan_pro.js — robust 2D drag-pan with speed & proper capture
(function(){
  'use strict';

  var SPEED_KEY = 'dragSpeedFactor';
  var speed = +(localStorage.getItem(SPEED_KEY) || '1') || 1;

  function setSpeed(v, silent){
    speed = Math.max(.25, Math.min(6, +v || 1));
    localStorage.setItem(SPEED_KEY, String(speed));
    var el = document.getElementById('dragSpeedVal'); if (el) el.textContent = speed.toFixed(1) + 'x';
    var rg = document.getElementById('speedRange'); if (rg && !silent) rg.value = String(speed);
  }
  window.setDragSpeed = setSpeed;
  function initSpeedUI(){
    setSpeed(speed, true);
    var up = document.getElementById('speedUp');
    var down = document.getElementById('speedDown');
    var range = document.getElementById('speedRange');
    if (up) up.addEventListener('click', function(e){ e.preventDefault(); setSpeed(speed + 0.25); });
    if (down) down.addEventListener('click', function(e){ e.preventDefault(); setSpeed(speed - 0.25); });
    if (range) range.addEventListener('input', function(e){ setSpeed(e.target.value, true); });
  }

  function isInteractive(el){ return !!(el && el.closest('input,button,a,select,textarea,label')); }
  var CM_TO_PX = 96 / 2.54;
  var BLOCK_PX = 5 * CM_TO_PX; // ≈ 189px من يمين الجدول

  function bind(wrap){
    if (!wrap || wrap.dataset.dragProReady === '1') return;
    wrap.dataset.dragProReady = '1';
    wrap.classList.add('drag-pan'); // لتمكين الـ cursor من CSS

    var isDown=false, dragging=false;
    var startX=0, startY=0, sx=0, sy=0;
    var raf=0, px=0, py=0;

    function onDown(e){
      // احترم منطقة الحظر 5سم من اليمين
      var rect = wrap.getBoundingClientRect();
      var fromRight = rect.right - e.clientX;
      if (fromRight <= BLOCK_PX) return;

      if (isInteractive(e.target)) return;

      isDown = true; dragging = false;
      startX = e.clientX; startY = e.clientY;
      sx = wrap.scrollLeft; sy = wrap.scrollTop;
      px = py = 0;
      wrap.classList.add('dragging');
      wrap.style.cursor = 'grabbing';

      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch(_){}
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }

    function onMove(e){
      if (!isDown) return;
      var dx = (startX - e.clientX) * speed;
      var dy = (startY - e.clientY) * speed;

      if (!dragging && (Math.abs(dx) + Math.abs(dy) < 3)) return;
      dragging = true;

      px = sx + dx; py = sy + dy;

      if (!raf){
        raf = requestAnimationFrame(function tick(){
          raf = 0;
          wrap.scrollLeft = px;
          wrap.scrollTop  = py;
        });
      }

      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }

    function onUp(e){
      if (!isDown) return;
      isDown = false;
      wrap.classList.remove('dragging');
      wrap.style.cursor = '';
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }

    // استخدم capture لقتل أي هاندلر قديم يسبقنا
    wrap.addEventListener('pointerdown', onDown, true);
    wrap.addEventListener('pointermove', onMove, {passive:false, capture:true});
    wrap.addEventListener('pointerup', onUp, true);
    wrap.addEventListener('pointercancel', onUp, true);
    wrap.addEventListener('mouseleave', onUp, true);

    // مؤشر مناسب حسب المنطقة
    wrap.addEventListener('pointermove', function(ev){
      var rect = wrap.getBoundingClientRect();
      var fromRight = rect.right - ev.clientX;
      if (!isDown) wrap.style.cursor = (fromRight <= BLOCK_PX) ? 'default' : 'grab';
    }, {passive:true});
  }

  function setup(){
    initSpeedUI();
    var w = document.querySelector('.table-wrap');
    if (w) bind(w);
    var obs = new MutationObserver(function(){
      var w2 = document.querySelector('.table-wrap');
      if (w2) bind(w2);
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();


// init-sync to reflect current saved speed in UI after DOM is ready
document.addEventListener('DOMContentLoaded', function(){
  try{
    var SPEED_KEY='dragSpeedFactor';
    var v = +(localStorage.getItem(SPEED_KEY)||'1')||1;
    var el = document.getElementById('dragSpeedVal');
    if (el) el.textContent = v.toFixed(1)+'x';
  }catch(e){}
});
