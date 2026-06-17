(function(global){
  'use strict';
  global.App = global.App || {};
  var Safe = global.App.SafeConsole || { log:function(){}, warn:function(){}, error:function(){} };

  var Recover = {
    _inRecover: false,
    _attempts: 0,
    _maxAttempts: 1,
    _lastGood: null, // {thead, tbody, pageInfo, ts}
    markGood: function(){
      try{
        var thead = document.querySelector('#dataTable thead');
        var tbody = document.querySelector('#dataTable tbody');
        if (!thead || !tbody) return;
        var pageInfo = document.getElementById('pageInfo');
        Recover._lastGood = {
          thead: thead.innerHTML,
          tbody: tbody.innerHTML,
          pageInfo: pageInfo ? pageInfo.textContent : '',
          ts: Date.now()
        };
      }catch(_){}
    },
    withRecovery: function(label, fn){
      try{
        if (Recover._inRecover) return fn(); // don't nest
        return fn();
      }catch(err){
        Recover.handle(label, err);
      }
    },
    handle: function(label, err){
      if (Recover._inRecover) return;
      Recover._attempts++;
      // notify hooks
      try{ (global.App.Hooks && global.App.Hooks.run) && global.App.Hooks.run('onError', { label:label, error:err }); }catch(_){}
      // soft toast
      try{
        var msg = 'حصل خطأ مؤقت. جاري محاولة إصلاح...';
        if (typeof global.__toast === 'function') global.__toast(msg);
      }catch(_){}
      Safe.error('AutoRecover:', label, err);

      if (Recover._attempts > Recover._maxAttempts){
        try{
          if (typeof global.__toast === 'function') global.__toast('تعذر الإصلاح تلقائيًا. جرّب Reload أو Reset table.');
        }catch(_){}
        return;
      }

      Recover._inRecover = true;
      try{
        // Strategy: restore last good DOM if available; otherwise do a gentle reset + re-render.
        var restored = false;
        try{
          if (Recover._lastGood){
            var thead = document.querySelector('#dataTable thead');
            var tbody = document.querySelector('#dataTable tbody');
            if (thead && tbody){
              thead.innerHTML = Recover._lastGood.thead || '';
              tbody.innerHTML = Recover._lastGood.tbody || '';
              var pageInfo = document.getElementById('pageInfo');
              if (pageInfo) pageInfo.textContent = Recover._lastGood.pageInfo || pageInfo.textContent;
              restored = true;
            }
          }
        }catch(_){}

        if (!restored){
          // Gentle reset: go to first page, keep user's file + rows, recompute view if possible.
          try{
            // Reset to first page via dispatch when available. Fallback preserves legacy behavior.
            const Store = global.App && global.App.Store;
            if (Store && typeof Store.dispatch === 'function') {
              Store.dispatch({ type: 'SET_PAGE', page: 1 });
            } else if (global.App.State) {
              global.App.State.page = 1;
            }
          }catch(_){}
          try{
            if (global.App.Data && typeof global.App.Data.computeView === 'function') global.App.Data.computeView();
          }catch(_){}
          // call raw render if exposed
          try{
            if (global.App.View){
              if (typeof global.App.View._renderTableRaw === 'function') global.App.View._renderTableRaw();
              else if (typeof global.App.View.renderTable === 'function') global.App.View.renderTable();
            }
          }catch(_){}
        }
      } finally {
        Recover._inRecover = false;
      }
    }
  };

  global.App.Recover = Recover;
})(window);
