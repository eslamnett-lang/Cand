(function(global){
  'use strict';
  global.App = global.App || {};
  var Hooks = {
    afterParse: [],
    beforeRender: [],
    afterRender: [],
    onError: [],
    run: function(name, payload){
      try{
        var list = Hooks[name] || [];
        for (var i=0;i<list.length;i++){
          try{ list[i](payload); }catch(e){
            try{ (global.App.SafeConsole||console).error('Hook error:', name, e); }catch(_){}
          }
        }
      }catch(_){}
    }
  };
  global.App.Hooks = Hooks;
})(window);
