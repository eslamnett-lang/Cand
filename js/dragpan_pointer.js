// ===== dragpan_pointer.js (loaded after core scripts) =====
(function(){
  'use strict';

  function __isSelecting(){ try { return !!(window.App && App.SelectEnhance && App.SelectEnhance.isSelecting && App.SelectEnhance.isSelecting()); } catch(_){ return false; } }

  function isInteractive(el){ return !!(el && el.closest('input,button,a,select,textarea,label')); }
  function isHeader(el){ return !!(el && el.closest('#dataTable thead')); }

  function bind(wrap){
    if (!wrap || wrap.dataset.dragPanReady === '1') return;
    wrap.dataset.dragPanReady = '1';
    wrap.classList.add('drag-pan');

    let isDown=false, dragging=false;
    let startX=0, startY=0, sx=0, sy=0;
    let lastX=0, lastY=0, rafId=0;
    const THRESH=3;

    function applyScroll(){
      rafId = 0; if(!isDown) return;
      const dx = lastX - startX;
      const dy = lastY - startY;
      if(!dragging){
        if (Math.abs(dx)>THRESH || Math.abs(dy)>THRESH){
          dragging = true;
          wrap.classList.add('dragging');
          document.body.style.userSelect = 'none';
        } else {
          return;
        }
      }
      wrap.scrollLeft = sx - dx;
      wrap.scrollTop  = sy - dy;
    }

    wrap.addEventListener('pointerdown', (e)=>{ if (__isSelecting()) return;
      if (e.button !== 0 || isInteractive(e.target) || isHeader(e.target)) return;
      isDown = true; dragging = false;
      startX = lastX = e.clientX; startY = lastY = e.clientY;
      sx = wrap.scrollLeft; sy = wrap.scrollTop;
      try{ wrap.setPointerCapture(e.pointerId); }catch(_){}
    });

    wrap.addEventListener('pointermove', (e)=>{ if (__isSelecting()) return;
      if (isHeader(e.target)) { if (isDown) { isDown=false; dragging=false; wrap.classList.remove('dragging'); } return; }
      if(!isDown) return;
      lastX = e.clientX; lastY = e.clientY;
      if(!rafId) rafId = requestAnimationFrame(applyScroll);
    });

    function end(){
      if(!isDown) return;
      isDown=false;
      if(rafId){ cancelAnimationFrame(rafId); rafId=0; }
      if(dragging){ wrap.classList.remove('dragging'); document.body.style.userSelect=''; }
      dragging=false;
    }
    wrap.addEventListener('pointerup', (e)=>{ if (__isSelecting()) return; end(e); });
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('pointerleave', end);
  }

  function setup(){
    const wrap = document.querySelector('.table-wrap');
    if (wrap) bind(wrap);

    // If table-wrap appears later, observe the DOM
    const obs = new MutationObserver(()=>{
      const w = document.querySelector('.table-wrap');
      if (w) bind(w);
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
