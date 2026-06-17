(function(global){
  'use strict';
  global.App = global.App || {};
  var Safe = global.App.SafeConsole || { error:function(){} };

  function notify(label, err){
    try{
      if (global.App && global.App.Recover && typeof global.App.Recover.handle === 'function'){
        global.App.Recover.handle(label, err);
      } else if (typeof global.__toast === 'function'){
        global.__toast('حصل خطأ: ' + (err && err.message ? err.message : String(err)));
      }
    }catch(_){}
  }

  global.addEventListener('error', function(ev){
    try{
      var err = ev && ev.error ? ev.error : new Error(ev && ev.message ? ev.message : 'Unknown error');
      Safe.error('GlobalError:', err);
      notify('window.error', err);
    }catch(_){}
  });

  global.addEventListener('unhandledrejection', function(ev){
    try{
      var reason = ev && ev.reason ? ev.reason : new Error('Unhandled rejection');
      Safe.error('UnhandledRejection:', reason);
      notify('unhandledrejection', reason);
    }catch(_){}
  });
})(window);
