(function(){
  'use strict';
  function injectCDN(){
    if(document.getElementById('cairo-cdn')) return;
    var link = document.createElement('link');
    link.id = 'cairo-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }

  function checkAndFallback(){
    try{
      // Quick heuristic check
      var allOK = false;
      if (document.fonts && document.fonts.check) {
        var ok400 = document.fonts.check('400 16px "Cairo"');
        var ok500 = document.fonts.check('500 16px "Cairo"');
        var ok700 = document.fonts.check('700 16px "Cairo"');
        allOK = ok400 && ok500 && ok700;
      }

      if(allOK){ return; }

      // Faster timeout (500ms) for local failure
      var timer = setTimeout(injectCDN, 500);

      var loaders = [];
      if(document.fonts && document.fonts.load){
        loaders = [
          document.fonts.load('400 16px "Cairo"'),
          document.fonts.load('500 16px "Cairo"'),
          document.fonts.load('700 16px "Cairo"')
        ];
      }

      Promise.allSettled(loaders).then(function(res){
        clearTimeout(timer);
        if(!res.length){ injectCDN(); return; }
        var fulfilled = res.filter(r=>r.status==='fulfilled').length;
        if(fulfilled < 3){ injectCDN(); }
      }).catch(function(){
        clearTimeout(timer);
        injectCDN();
      });
    }catch(e){
      injectCDN();
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', checkAndFallback);
  }else{
    checkAndFallback();
  }
})();