(function(global){
  'use strict';
  global.App = global.App || {};

  function ensureToastEl(){
    var el = document.getElementById('app-toast');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'app-toast';
    el.style.cssText =
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
      'background:#1f2937;color:#fff;padding:.5rem .8rem;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:99999;font-size:13px;' +
      'opacity:0;pointer-events:none;transition:opacity .18s ease;max-width:92vw;' +
      'text-align:center;white-space:pre-wrap;';
    document.body.appendChild(el);
    return el;
  }

  var hideTimer = null;
  function show(msg, ms){
    try{
      var el = ensureToastEl();
      el.textContent = msg == null ? '' : String(msg);
      el.style.opacity = '1';
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function(){
        el.style.opacity = '0';
      }, typeof ms === 'number' ? ms : 2200);
    }catch(_){}
  }

  global.App.Toast = global.App.Toast || {};
  global.App.Toast.show = show;

  // Back-compat: older code uses window.__toast
  if (typeof global.__toast !== 'function'){
    global.__toast = show;
  }
})(window);
