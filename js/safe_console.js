(function(global){
  'use strict';
  function _noop(){}
  function _safe(method){
    return function(){
      try{
        var c = global.console;
        if (!c) return;
        var fn = c[method] || c.log;
        if (typeof fn !== 'function') return;
        fn.apply(c, arguments);
      }catch(_){}
    };
  }
  global.App = global.App || {};
  global.App.SafeConsole = {
    log: _safe('log'),
    info: _safe('info'),
    warn: _safe('warn'),
    error: _safe('error')
  };
})(window);
