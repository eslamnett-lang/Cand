(function(){
  'use strict';

  var KEY = 'mndo_theme';
  var root = document.documentElement;

  // Apply stored theme if any
  try{
    var stored = localStorage.getItem(KEY);
    if(stored){ root.setAttribute('data-theme', stored); }
  }catch(e){}

  function toggleTheme(){
    var cur = root.getAttribute('data-theme');
    if(cur === 'dark'){
      root.removeAttribute('data-theme');
      try{ localStorage.removeItem(KEY); }catch(e){}
    }else{
      root.setAttribute('data-theme', 'dark');
      try{ localStorage.setItem(KEY, 'dark'); }catch(e){}
    }
  }

  var btn = document.getElementById('themeToggle');
  if(btn){ btn.addEventListener('click', toggleTheme); }

})();