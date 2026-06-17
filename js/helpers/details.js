(function(g){
  'use strict';
  // Only skip if a complete implementation already exists.
  // Some builds may create a placeholder DetailsHelpers early; in that case we overwrite it here.
  if (
    g.DetailsHelpers &&
    typeof g.DetailsHelpers.waitBoxText === 'function' &&
    typeof g.DetailsHelpers.__callBreakdownForCurrentFilter === 'function' &&
    typeof g.DetailsHelpers.toggleRowDetails === 'function'
  ) return;
  function waitBoxText(getText, done, timeout){
  if (features && features.fastDetails === false){ // allow fallback
    // simple polling fallback
    var tries=0, MAX_TRIES=80, DELAY=25;
    (function loop(){
      var t=''; try{ t=getText(); }catch(_){}
      if (t || ++tries>MAX_TRIES){ try{done(t);}catch(_){ } } else { setTimeout(loop, DELAY); }
    })();
    return;
  }
  try{
    var host = document.getElementById('consumptionBreakdown');
    if (!host){ try{ done(''); }catch(_){ } return; }
    var TO = (typeof timeout==='number' ? timeout : 900);
    var finished=false;
    function end(t){ if (finished) return; finished=true; try{ done(t||''); }catch(_){ } }
    // immediate
    try{ var im=getText(); if (im){ return end(im); } }catch(_){}
    // two frames
    var frames=0;
    function rafTry(){
      if (finished) return;
      try{ var t=getText(); if (t){ return end(t); } }catch(_){}
      if (++frames<2){ return requestAnimationFrame(rafTry); }
      var start=Date.now();
      (function poll(){
        if (finished) return;
        var t=''; try{ t=getText(); }catch(_){}
        if (t || Date.now()-start>=TO){ return end(t); }
        setTimeout(poll, 25);
      })();
    }
    requestAnimationFrame(rafTry);
  }catch(_){ try{ done(''); }catch(__){} }
}
  function __callBreakdownForCurrentFilter(){
  try{
    var f = String((State && State.filter) || '').toLowerCase();
    // Keep the top selected summary (counts + totals) up to date when available
    if (typeof updateSumSelected === 'function') { try{ updateSumSelected(); }catch(__){} }

    var isUnits   = (f.indexOf('unit') !== -1) || (f.indexOf('وحد') !== -1);
    var isBonus   = (f.indexOf('bonus') !== -1) || (f.indexOf('سلف') !== -1);
    var isBalance = (f.indexOf('balance') !== -1) || (f.indexOf('رصيد') !== -1);

    // Use each section's original renderer when present (so the TOP table details stay correct)
    if (isUnits && typeof renderConsumptionBreakdown === 'function') { renderConsumptionBreakdown(); return; }
    if (isBonus && typeof renderBonusBreakdown === 'function') { renderBonusBreakdown(); return; }
    if (isBalance && typeof renderBalanceBreakdown === 'function') { renderBalanceBreakdown(); return; }

    // Fallbacks (ALL / mixed)
    if (typeof renderSelectedBreakdownAll === 'function') { renderSelectedBreakdownAll(); return; }
    if (typeof renderConsumptionBreakdown === 'function') { renderConsumptionBreakdown(); return; }
  }catch(_){ }
}
  function toggleRowDetails(tr, r, quick){
  try{ if (!tr || !quick) return; }catch(_){}
  const rid = r && r._id;
  // Always clear any existing compare rows and reset previous quick-detail buttons
  try {
    // Determine if this quick button is already active
    var wasOn = !!(quick && quick.classList && quick.classList.contains('on'));
    // Remove all existing comparison rows in the table
    document.querySelectorAll('.row-compare').forEach(function(cmp){
      try {
        const prev = cmp.previousElementSibling;
        // remove the compare row
        cmp.remove();
        // clear active state on any quick-detail cell in the preceding row
        if (prev) {
          const q = prev.querySelector('.row-quick-details.on');
          if (q) {
            try { q.classList.remove('on'); }catch(__){}
            try { q.disabled = false; }catch(__){}
          }
        }
      } catch(e) { /* ignore */ }
    });
    // Also remove 'on' class from any quick-detail cells that may still be marked
    document.querySelectorAll('.row-quick-details.on').forEach(function(btn){
      try { btn.classList.remove('on'); }catch(__){}
      try { btn.disabled = false; }catch(__){}
    });
    // If we clicked an already-active button, simply clear and exit
    if (wasOn) {
      return;
    }
  } catch(__) {}

  // Cache check
  var cacheKey = null, cachedText = null;
  try{
    cacheKey = String(rid) + '|' + String(State && State.filter || 'all');
    if (features && features.detailsCache && State && State.detailCache && State.detailCache.has(cacheKey)){
      cachedText = State.detailCache.get(cacheKey);
    }
  }catch(_){}
  if (cachedText){
    __setCompareForRow(tr, cachedText, quick);
    return;
  }

  // Snapshot selection and isolate this row
  var __prevSel = [];
  try{ State.selected.forEach(v=>__prevSel.push(v)); }catch(_){}
  try{
    const Store = g.App && g.App.Store;
    if (Store && typeof Store.dispatch === 'function') {
      // Replace selection with only this row id
      const newSel = new Set([rid]);
      Store.dispatch({ patch: { selected: newSel }, silent: true });
    } else {
      // legacy fallback
      State.selected && State.selected.clear && State.selected.clear();
      State.selected && State.selected.add && State.selected.add(rid);
    }
  }catch(_){}
  try{ __callBreakdownForCurrentFilter(); }catch(_){}

  function readFromBox(){
    try{
      var host = document.getElementById('consumptionBreakdown');
      if (!host) return '';
      var nodes = host.querySelectorAll('.br-line, [data-detail], .detail-line, .bd-line, .line');
      var best = '', bestScore = -1;
      var badStarts = [/^\s*لا\s+توجد/i, /^\s*لا\s+يوجد/i];
      function score(txt){
        if (!txt) return -1;
        var t = txt.trim();
        if (!t) return -1;
        for (var i=0;i<badStarts.length;i++){ if (badStarts[i].test(t)) return -1; }
        var s = 0;
        if (/[0-9٠-٩]/.test(t)) s += 2;
        if (/(سبب|الخصم|استهلاك|من\s+.*\s+إلى)/.test(t)) s += 3;
        s += Math.min(5, Math.floor(t.length/25));
        return s;
      }
      if (nodes && nodes.length){
        for (var i=0;i<nodes.length;i++){
          var n = nodes[i];
          var dt = (n.getAttribute && n.getAttribute('data-detail')) || '';
          var txt = (dt || n.textContent || '').replace(/^↪\s*/, '').trim();
          var sc = score(txt);
          if (sc > bestScore){ bestScore = sc; best = txt; }
        }
        if (bestScore >= 0){
          return best;
        }
      }
      var allTxt = host.textContent ? host.textContent.trim() : '';
      if (allTxt){
        for (var i=0;i<badStarts.length;i++){ if (badStarts[i].test(allTxt)) return ''; }
        return allTxt;
      }
      return '';
    }catch(_){ return ''; }
  }

  try{ quick.disabled = true; }catch(_){}
  waitBoxText(readFromBox, function finalize(text){
    try{
      const Store = g.App && g.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        const newSel = new Set(__prevSel);
        Store.dispatch({ patch: { selected: newSel }, silent: true });
        __callBreakdownForCurrentFilter();
      } else {
        // legacy fallback
        State.selected && State.selected.clear && State.selected.clear();
        __prevSel.forEach(v=>{
          try{ State.selected.add(v); }catch(__){}
        });
        __callBreakdownForCurrentFilter();
      }
    }catch(_){}
    if (!text){
      try{
        var cmpNext = tr.nextElementSibling;
        if (cmpNext && cmpNext.classList && cmpNext.classList.contains('row-compare')){
          var oldTxt = (cmpNext.querySelector('.cmp-text')||{}).textContent||'';
          if (oldTxt.trim()) text = oldTxt;
        }
      }catch(_){}
      if (!text){
        // FINAL: Provide a minimal, deterministic fallback derived from the row itself.
        // This prevents returning a placeholder that breaks the Details Contract,
        // while still avoiding full raw row dumps.
        try{
          var parts = [];
          parts.push('تفاصيل الصف #' + String(rid || ''));
          if (r && r.startTime) parts.push('بداية: ' + String(r.startTime));
          if (r && r.deductFrom) parts.push('خصم من: ' + String(r.deductFrom));
          // Add a small set of non-empty fields (truncated) to reach a useful length.
          if (r){
            var keys = Object.keys(r).filter(function(k){
              return k && k[0] !== '_' && k !== 'deductFrom' && k !== 'startTime' && k !== 'excelRowIndex';
            });
            for (var i=0; i<keys.length && parts.join(' | ').length < 160; i++){
              var k = keys[i];
              var v = r[k];
              if (v == null) continue;
              var s = String(v).trim();
              if (!s) continue;
              if (s.length > 42) s = s.slice(0,42) + '…';
              parts.push(String(k) + ': ' + s);
            }
          }
          text = parts.join(' | ');
        }catch(__){
          text = 'تفاصيل الصف #' + String(rid || '');
        }
      }
    }
    __setCompareForRow(tr, text, quick);
    try{ if (features && features.detailsCache && cacheKey){ State.detailCache.set(cacheKey, text); } }catch(_){}
    try{ quick.disabled = false; }catch(_){}
  }, 900);
}
  g.DetailsHelpers = {
    waitBoxText: waitBoxText,
    __callBreakdownForCurrentFilter: __callBreakdownForCurrentFilter,
    toggleRowDetails: toggleRowDetails
  };
})(typeof window!=='undefined'?window:this);
