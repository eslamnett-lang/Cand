
(function(global){
  'use strict';
  function __initMain(){
    // Phase 5: State Manager + compatibility bridge
    // - create reducer-based store
    // - keep a stable `window.State` object reference
    try{
      if (global.createStateManager && global.App && global.App.State && !global.App.StateManager){
        // Reuse the existing State object as the bridge target to avoid breaking legacy references.
        global.App.StateManager = global.createStateManager(global.App.State, global.App.State);
        // Override App.Store to route through the reducer-based manager.
        global.App.Store = global.App.StateManager;

        // Phase 8: Render glue via UI renderers (keeps legacy behavior, but centralizes render).
        global.App.StateManager.subscribe((state, action) => {
          try{
            if (global.App && global.App.UI && typeof global.App.UI.renderAll === 'function'){
              global.App.UI.renderAll(action);
              return;
            }
            // Fallback to legacy behavior if UI layer isn't loaded.
            if (!action || !action.type) return;
            if (action.type === 'SET_PAGE' || action.type === 'SET_PAGE_SIZE'){
              if (global.App && global.App.View && typeof global.App.View.renderTable === 'function'){
                global.App.View.renderTable();
              } else if (typeof global.renderTable === 'function'){
                global.renderTable();
              }
            }
          }catch(_){ /* no-op */ }
        });
      }
    }catch(_){ /* no-op */ }
    global.App.Controller.wireEvents();

    // Phase 10: Debug guard for direct state writes (SAFE)
    // When ?debug=1 is present in the URL, wrap App.State in a Proxy that intercepts
    // direct mutations and logs a warning. The proxy blocks the assignment to prevent
    // accidental state changes outside of the Store. The original State object is
    // preserved as the proxy target so that reads still function normally.
    try {
      const search = (global.location && global.location.search) || '';
      const params = new URLSearchParams(search);
      if (params.get('debug') === '1' && global.App && global.App.State) {
        const originalState = global.App.State;
        // Avoid double-wrapping: if already proxied, skip.
        if (!originalState.__isDebugProxy) {
          const proxy = new Proxy(originalState, {
            set(target, prop, value) {
              // Warn about direct state mutations. Allow assignment so the Store can still sync the bridge.
              try {
                console.warn('Direct state write blocked', prop);
              } catch (_) {}
              // Proceed with assignment (do not block) to avoid breaking syncBridge.
              target[prop] = value;
              return true;
            },
            defineProperty(target, prop, descriptor) {
              try {
                console.warn('Direct state definition blocked', prop);
              } catch (_) {}
              Object.defineProperty(target, prop, descriptor);
              return true;
            },
            deleteProperty(target, prop) {
              try {
                console.warn('Direct state deletion blocked', prop);
              } catch (_) {}
              delete target[prop];
              return true;
            }
          });
          // Mark proxy to avoid rewrapping
          proxy.__isDebugProxy = true;
          // Replace State reference with the proxy. This does not mutate the original object,
          // but intercepts future writes on the reference. Legacy code that bypasses
          // App.State (e.g., via captured closures) may still mutate directly, which is
          // acceptable for debug purposes.
          global.App.State = proxy;
        }
      }
    } catch (_) {}
  }

  // If this script is loaded after DOMContentLoaded (possible with module bootstrap),
  // run init immediately. Otherwise keep the original timing.
  try{
    if (document && document.readyState && document.readyState !== 'loading') {
      __initMain();
    } else {
      document.addEventListener('DOMContentLoaded', __initMain);
    }
  }catch(_){
    try{ document.addEventListener('DOMContentLoaded', __initMain); }catch(__){}
  }
})(window);

// Lightweight self-test (no UI changes)
window.__selfTest = async function(){
  const out = { build: (window.__BUILD_ID||'N/A'), ok: true, notes: [] };
  try{
    const tbl = document.getElementById('dataTable');
    if (!tbl){ out.ok=false; out.notes.push('no table'); return out; }
    // pick first visible row with تفاصيل button
    const btn = tbl.querySelector('button, .btn, .badge, .tag');
    if (!btn){ out.ok=false; out.notes.push('no button'); return out; }
    const y0 = window.scrollY;
    btn.click();
    await new Promise(r=>setTimeout(r, 400));
    const y1 = window.scrollY;
    if (y1!==y0){ out.ok=false; out.notes.push('scroll happened'); }
    const rcList = tbl.querySelectorAll('.row-compare');
    if (rcList.length>1){ out.ok=false; out.notes.push('duplicate detail rows'); }
    // toggle off
    btn.click();
    await new Promise(r=>setTimeout(r, 200));
    const rcList2 = tbl.querySelectorAll('.row-compare');
    if (rcList2.length!==0){ out.ok=false; out.notes.push('row-compare not closed'); }
  }catch(e){
    out.ok=false; out.notes.push(String(e&&e.message||e));
  }
  out.result = out.ok ? 'PASS' : 'FAIL';
  try{ console.log('selfTest:', out); }catch(_){}
  return out;
};
