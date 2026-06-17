
(function(global){
  'use strict';
/* === Row details helpers (TOP table) ===
 *
 * Important: the TOP "تفاصيل" button must always work even if load order changes.
 * We keep an internal implementation here (same behavior as the original build),
 * and expose it on window.DetailsHelpers so other scripts can call it safely.
 */

// Always resolve the latest toggleRowDetails at call time; fallback to local implementation.
function __toggleRowDetailsProxy(tr, r, quick){
  try{
    var fn = (window && window.DetailsHelpers && typeof window.DetailsHelpers.toggleRowDetails === 'function')
      ? window.DetailsHelpers.toggleRowDetails
      : null;
    if (typeof fn === 'function') return fn(tr, r, quick);
  }catch(_){ }
  try{
    if (typeof toggleRowDetailsLocal === 'function') return toggleRowDetailsLocal(tr, r, quick);
  }catch(__){ }
}

/* === Helpers: fast waiter + filter-aware builder === */




/* Consolidated row-details toggle (no DOM/UI changes) */



// Call the proper breakdown renderer based on current filter
function __callBreakdownForCurrentFilter(){
  try{
    var f = String((State && State.filter) || '').toLowerCase();
    // Keep the top selected summary (counts + totals) up to date when available
    if (typeof updateSumSelected === 'function') { try{ updateSumSelected(); }catch(_){} }

    var isUnits   = (f.indexOf('unit') !== -1) || (f.indexOf('وحد') !== -1);
    var isBonus   = (f.indexOf('bonus') !== -1) || (f.indexOf('سلف') !== -1);
    var isBalance = (f.indexOf('balance') !== -1) || (f.indexOf('رصيد') !== -1);

    if (isUnits){
      if (typeof renderConsumptionBreakdown === 'function') { renderConsumptionBreakdown(); return; }
    }
    if (isBonus){
      if (typeof renderBonusBreakdown === 'function') { renderBonusBreakdown(); return; }
    }
    if (isBalance){
      if (typeof renderBalanceBreakdown === 'function') { renderBalanceBreakdown(); return; }
    }

    // Fallbacks (ALL / mixed)
    if (typeof renderSelectedBreakdownAll === 'function') { renderSelectedBreakdownAll(); return; }
    if (typeof renderConsumptionBreakdown === 'function') { renderConsumptionBreakdown(); return; }
  }catch(_){}
}


// === Observer-based waiter for details box (robust & lightweight) ===
function waitBoxText(getText, done, timeout){
  try{
    var host = document.getElementById('consumptionBreakdown');
    if (!host){ try{ done(''); }catch(_){ } return; }
    var TO = (typeof timeout==='number' ? timeout : 350); // <= 350ms total
    var finished=false;
    function end(t){ if (finished) return; finished=true; try{ done(t||''); }catch(_){ } }
    // Try immediate
    var im = ''; try{ im = getText(); }catch(_){}
    if (im){ return end(im); }
    // Try next 2 animation frames
    var count=0;
    function rafTry(){
      if (finished) return;
      try{
        var t = getText();
        if (t){ return end(t); }
      }catch(_){}
      if (++count<2){ return requestAnimationFrame(rafTry); }
      // Short fallback polling for the remainder of TO
      var start = Date.now();
      (function poll(){
        if (finished) return;
        var t=''; try{ t=getText(); }catch(_){}
        if (t || Date.now()-start >= TO){ return end(t); }
        setTimeout(poll, 25);
      })();
    }
    requestAnimationFrame(rafTry);
  }catch(_){ try{ done(''); }catch(__){} }
}

// === Helper: single compare row (no duplicates) ===
function __setCompareForRow(tr, detailText, markQuickOn){
  if (!tr || !tr.parentElement) return;
  // Find an existing compare row near this tr
  var cmp = tr.nextElementSibling, hops=0;
  while(cmp && !(cmp.classList && cmp.classList.contains('row-compare')) && hops++<6){
    cmp = cmp.nextElementSibling;
  }
  // Create if missing
  if (!(cmp && cmp.classList && cmp.classList.contains('row-compare'))){
    cmp = document.createElement('tr');
    cmp.className = 'row-compare';
    var td = document.createElement('td'); td.colSpan = tr.children.length;
    var wrap = document.createElement('div'); wrap.className='cmp-wrap';
    var list = document.createElement('div'); list.className='cmp-list';
    wrap.appendChild(list); td.appendChild(wrap); cmp.appendChild(td);
    tr.after(cmp);
  } else {
    // Clear list
    var list0 = cmp.querySelector('.cmp-list'); if (list0) list0.innerHTML='';
  }
  // One visual line: [نسخ] + text
  var list = cmp.querySelector('.cmp-list');
  if (!list){ list = document.createElement('div'); list.className='cmp-list'; cmp.firstElementChild.firstElementChild.appendChild(list); }
  var item = document.createElement('div'); item.className='cmp-item';
  try{ item.style.setProperty('list-style','none','important'); item.style.setProperty('list-style-type','none','important'); item.style.setProperty('padding-inline-start','0','important'); }catch(_){}
  var btn = document.createElement('button'); btn.type='button'; btn.className='copy-row-btn'; btn.textContent='نسخ'; btn.title='نسخ تفاصيل السطر';
  var silence = function(ev){ if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();} };
  btn.addEventListener('pointerdown', silence, true);
  btn.addEventListener('mousedown',  silence, true);
  btn.addEventListener('click', function(ev){
    silence(ev);
    try{
      var textToCopy = (detailText||'').trim();
      var ok=function(){ try{ btn.classList.add('copied'); setTimeout(function(){btn.classList.remove('copied');},900);}catch(e){} };
      Utils.copyToClipboard(textToCopy).then(function(ok2){ if(ok2) ok(); });
    }catch(_){}
  }, true);
  var span=document.createElement('span'); span.className='cmp-text';
  span.textContent=(detailText||'').replace(/[\u2022\u25CF\u25AA\u27A4\u2192\u21AA\u21B3\-\s]+$/,'').replace(/^[\u2022\u25CF\u25AA\u27A4\u2192\u21AA\u21B3\-\s]+/,'');
  // [Custom] When clicking on the detail text itself, hide the compare row (acts as a return)
  span.style.cursor = 'pointer';
  span.addEventListener('click', function(ev){
    try{
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    }catch(__){}
    // Remove this compare row and reset the quick-details button on the parent row
    try{
      const cmpRow = span.closest('tr.row-compare');
      if (cmpRow) {
        const parentRow = cmpRow.previousElementSibling;
        cmpRow.remove();
        if (parentRow) {
          const qb = parentRow.querySelector('.row-quick-details.on');
          if (qb) {
            try { qb.classList.remove('on'); }catch(ee){}
            try { qb.disabled = false; }catch(ee){}
          }
        }
      }
    }catch(__){}
  }, true);
  item.appendChild(btn); item.appendChild(span);
  list.appendChild(item);
  if (markQuickOn){ try{ markQuickOn.classList.add('on'); }catch(_){ } }
}

// === Local implementation for TOP "تفاصيل" button (restores original behavior) ===
function toggleRowDetailsLocal(tr, r, quick){
  try{ if (!tr || !quick) return; }catch(_){ return; }

  // If already open: close and exit
  try{
    if (quick.classList && quick.classList.contains('on')){
      var sib = tr.nextElementSibling, k=0;
      while(sib && k++<12){
        if (sib.classList && sib.classList.contains('row-compare')){
          try{ sib.remove(); }catch(__){ try{ sib.parentNode && sib.parentNode.removeChild(sib); }catch(___){} }
          break;
        }
        sib = sib.nextElementSibling;
      }
      try{ quick.classList.remove('on'); }catch(__){}
      try{ quick.disabled = false; }catch(__){}
      return;
    }
  }catch(_){ }

  const rid = r && r._id;

  // Cache (optional)
  var cacheKey=null, cachedText=null;
  try{
    cacheKey = String(rid) + '|' + String((State && State.filter) || 'all');
    if (typeof features!=='undefined' && features && features.detailsCache && State && State.detailCache && State.detailCache.has(cacheKey)){
      cachedText = State.detailCache.get(cacheKey);
    }
  }catch(_){ }
  if (cachedText){
    __setCompareForRow(tr, cachedText, quick);
    return;
  }

  // Snapshot selection and isolate this row
  var __prevSel = [];
  try{ State && State.selected && State.selected.forEach(function(v){ __prevSel.push(v); }); }catch(_){ }
  try{
    const Store = global.App && global.App.Store;
    if (Store && typeof Store.dispatch === 'function') {
      // replace selection with only the clicked row
      Store.dispatch({ patch: { selected: new Set([rid]) }, silent: true });
    } else if (State && State.selected) {
      // legacy fallback
      State.selected.clear && State.selected.clear();
      State.selected.add && State.selected.add(rid);
    }
  }catch(_){ }

  try{ __callBreakdownForCurrentFilter(); }catch(_){ }

  function readFromBox(){
    try{
      var host = document.getElementById('consumptionBreakdown');
      if (!host) return '';
      var nodes = host.querySelectorAll('.br-line, [data-detail], .detail-line, .bd-line, .line');
      var best='', bestScore=-1;
      var badStarts=[/^\s*لا\s+توجد/i, /^\s*لا\s+يوجد/i];
      function score(txt){
        if (!txt) return -1;
        var t = String(txt).trim();
        if (!t) return -1;
        for (var i=0;i<badStarts.length;i++){ if (badStarts[i].test(t)) return -1; }
        var s=0;
        if (/[0-9٠-٩]/.test(t)) s+=2;
        if (/(سبب|الخصم|استهلاك|من\s+.*\s+إلى)/.test(t)) s+=3;
        s += Math.min(5, Math.floor(t.length/25));
        return s;
      }
      if (nodes && nodes.length){
        for (var i=0;i<nodes.length;i++){
          var n=nodes[i];
          var dt=(n.getAttribute && n.getAttribute('data-detail')) || '';
          var txt=(dt || n.textContent || '').replace(/^↪\s*/, '').trim();
          var sc=score(txt);
          if (sc>bestScore){ bestScore=sc; best=txt; }
        }
        if (bestScore>=0) return best;
      }
      var allTxt = host.textContent ? host.textContent.trim() : '';
      if (allTxt){
        for (var j=0;j<badStarts.length;j++){ if (badStarts[j].test(allTxt)) return ''; }
        return allTxt;
      }
      return '';
    }catch(_){ return ''; }
  }

  try{ quick.disabled = true; }catch(_){ }
  waitBoxText(readFromBox, function finalize(text){
    // Restore selection
    try{
      const Store = global.App && global.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        const newSel = new Set(__prevSel);
        Store.dispatch({ patch: { selected: newSel }, silent: true });
        __callBreakdownForCurrentFilter();
      } else {
        // legacy fallback
        State && State.selected && State.selected.clear && State.selected.clear();
        __prevSel.forEach(function(v){ try{ State.selected.add(v); }catch(__){} });
        __callBreakdownForCurrentFilter();
      }
    }catch(_){ }

    if (!text) text = 'لا توجد تفاصيل متاحة لهذا الصف.';
    __setCompareForRow(tr, text, quick);
    try{ if (typeof features!=='undefined' && features && features.detailsCache && cacheKey){ State.detailCache.set(cacheKey, text); } }catch(_){ }
    try{ quick.disabled = false; }catch(_){ }
  }, 350);
}

// Expose helpers for other scripts (and for js/helpers/details.js guard)
try{
  window.DetailsHelpers = window.DetailsHelpers || {};
  if (typeof window.DetailsHelpers.waitBoxText !== 'function') window.DetailsHelpers.waitBoxText = waitBoxText;
  if (typeof window.DetailsHelpers.__callBreakdownForCurrentFilter !== 'function') window.DetailsHelpers.__callBreakdownForCurrentFilter = __callBreakdownForCurrentFilter;
  if (typeof window.DetailsHelpers.toggleRowDetails !== 'function') window.DetailsHelpers.toggleRowDetails = toggleRowDetailsLocal;
}catch(_){ }

  const { $, Utils, State } = global.App;
// [ADD 2025-09-06] اجمع الصفوف المختارة بغضّ النظر عن الفلتر الحالي
function getSelectedRowsAll(){
  try{
    // لو State.rows مسطحة
    if (Array.isArray(State.rows)) return State.rows.filter(r => !!r && r.__selected === true);
    // لو في صفحات داخل State.view
    const out = [];
    try {
      const all = (State.view && State.view.pages) ? State.view.pages : [];
      all.forEach(p => (p.rows||[]).forEach(r => { if (r && r.__selected === true) out.push(r); }));
    } catch(e){}
    return out;
  }catch(e){ return []; }
}

  const { escapeHTML, normalizeHeader, toNumber } = Utils;

// ===== Top toolbar for datetime range + reset =====
function parseInput24(s){
        try{
          if (!s) return null;
          s = String(s).trim().replace(/<br\s*\/?>/ig,' ').replace(/\s+/g,' ');
          // allow '08/24/2025 11:24 PM' by converting to 24h first
          let pm = /\bPM\b/i.test(s), am = /\bAM\b/i.test(s);
          if (pm || am){
            // split
            const m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
            if (m){
              let hh = parseInt(m[4],10); const mm = parseInt(m[5],10); const ss = parseInt(m[6]||'0',10);
              const d = parseInt(m[1],10), mo = parseInt(m[2],10)-1; let y = parseInt(m[3],10); if (y<100) y+=2000;
              const suf = (m[7]||'').toUpperCase();
              if (suf==='PM' && hh<12) hh+=12; if (suf==='AM' && hh===12) hh=0;
              return new Date(y, mo, d, hh, mm, ss);
            }
          }
          // dd/MM/yyyy HH:mm[:ss]
          let m = s.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{2,4})(?:\s+([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?$/);
          if (m){
            const d  = parseInt(m[1],10);
            const mo = parseInt(m[2],10)-1;
            let y  = parseInt(m[3],10); if (y<100) y += 2000;
            const hh = parseInt(m[4]||'0',10);
            const mm = parseInt(m[5]||'0',10);
            const ss = parseInt(m[6]||'0',10);
            return new Date(y, mo, d, hh, mm, ss);
          }
          // HH:mm[:ss] dd/MM/yyyy
          m = s.match(/^([0-2]?\d):([0-5]\d)(?::([0-5]\d))?\s+([0-3]?\d)\/([0-1]?\d)\/(\d{2,4})$/);
          if (m){
            const hh = parseInt(m[1]||'0',10);
            const mm = parseInt(m[2]||'0',10);
            const ss = parseInt(m[3]||'0',10);
            const d  = parseInt(m[4],10);
            const mo = parseInt(m[5],10)-1;
            let y  = parseInt(m[6],10); if (y<100) y += 2000;
            return new Date(y, mo, d, hh, mm, ss);
          }
          // Fallback ISO or native
          const n = new Date(s);
          return (n && !isNaN(n)) ? n : null;
        }catch(e){ return null; }
      }
      
// ===== 24h Date-Time Picker (no typing) =====
function __dtp_pad(n){ return String(n).padStart(2,'0'); }
function __dtp_fmt(d){ return __dtp_pad(d.getDate())+'/'+__dtp_pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+__dtp_pad(d.getHours())+':'+__dtp_pad(d.getMinutes())+':'+__dtp_pad(d.getSeconds()); }
function __dtp_daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }

function __dtp_rangeYears(){
  try{
    const years = new Set();
    const H = State.headers||[];
    const norm = s=>String(s||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'').trim();
    let colStart=null, colEnd=null;
    for (const h of H){ const n = norm(h); if (n==='starttime') colStart=h; if (n==='endtime') colEnd=h; }
    const rows = Array.isArray(State.rows)?State.rows:[];
    for (const r of rows){
      const ds = colStart?__hf_parseDate(r[colStart]):null;
      const de = colEnd?__hf_parseDate(r[colEnd]):null;
      if (ds && !isNaN(ds)) years.add(ds.getFullYear());
      if (de && !isNaN(de)) years.add(de.getFullYear());
      if (years.size>60) break;
    }
    if (!years.size){ const y = new Date().getFullYear(); for (let k=y-2;k<=y+2;k++) years.add(k); }
    const arr = Array.from(years).sort((a,b)=>a-b);
    return {min: arr[0], max: arr[arr.length-1], list: arr};
  }catch(e){ const y=new Date().getFullYear(); return {min:y-2,max:y+2,list:[y-2,y-1,y,y+1,y+2]}; }
}

function __dtp_buildSelect(min, max, value){
  const sel = document.createElement('select');
  for (let i=min;i<=max;i++){
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = (max - min <= 60 ? __dtp_pad(i) : String(i));
    if (i===value) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function __dtp_open(targetInput){
  // close any existing
  const existing = document.getElementById('dtp-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'dtp-panel';
  document.body.appendChild(panel);

  // Keep the picker visually "attached" to its input while the page scrolls.
  // (Old behavior used position:fixed which made the page scroll under it.)
  function place(){
    try{
      const rect = targetInput.getBoundingClientRect();
      const top  = Math.min(
        window.scrollY + window.innerHeight - panel.offsetHeight - 10,
        window.scrollY + rect.bottom + 6
      );
      const left = Math.max(
        window.scrollX + 8,
        Math.min(window.scrollX + window.innerWidth - panel.offsetWidth - 8, window.scrollX + rect.left)
      );
      panel.style.top  = top + 'px';
      panel.style.left = left + 'px';
    }catch(e){}
  }
  function cleanup(){
    try{
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    }catch(e){}
  }
  panel._cleanup = cleanup;

  // Determine initial value
  let d = parseInput24(targetInput.value) || new Date();
  if (isNaN(d)) d = new Date();
  const years = __dtp_rangeYears();
  const ySel = __dtp_buildSelect(years.min, years.max, d.getFullYear());
  const mSel = __dtp_buildSelect(1, 12, d.getMonth()+1);
  const dSel = document.createElement('select');
        function updateDaySel(){
          
    const days = __dtp_daysInMonth(parseInt(ySel.value,10), parseInt(mSel.value,10)-1);
    const dd = parseInt(dSel.value||d.getDate(),10);
    dSel.innerHTML='';
    for (let i=1;i<=days;i++){
      const opt = document.createElement('option'); opt.value=String(i); opt.textContent=__dtp_pad(i);
      if (i===Math.min(dd,days)) opt.selected=true;
      dSel.appendChild(opt);
    }
  
        }
        updateDaySel();

  mSel.addEventListener('change', updateDaySel); ySel.addEventListener('change', updateDaySel);

  const hhSel = __dtp_buildSelect(0, 23, d.getHours());
  const mmSel = __dtp_buildSelect(0, 59, d.getMinutes());
  const ssSel = __dtp_buildSelect(0, 59, d.getSeconds());

  function compose(){
    const Y = parseInt(ySel.value,10);
    const M = parseInt(mSel.value,10)-1;
    const DD= parseInt(dSel.value,10)||1;
    const HH= parseInt(hhSel.value,10)||0;
    const MI= parseInt(mmSel.value,10)||0;
    const SS= parseInt(ssSel.value,10)||0;
    return new Date(Y,M,DD,HH,MI,SS);
  }

  panel.innerHTML = `
    <div class="dtp-head">اختيار التاريخ والوقت (24h)</div>
    <div class="dtp-row"></div>
    <div class="dtp-row"></div>
    <div class="dtp-actions">
      <button class="dtp-btn" data-act="now">الآن</button>
      <button class="dtp-btn" data-act="day-start">بداية اليوم</button>
      <button class="dtp-btn" data-act="day-end">نهاية اليوم</button>
      <span class="sp"></span>
      <button class="dtp-btn" data-act="clear">مسح</button>
      <button class="dtp-btn primary" data-act="apply">حفظ</button>
    </div>
  `;
  const row1 = panel.querySelectorAll('.dtp-row')[0];
  const row2 = panel.querySelectorAll('.dtp-row')[1];

  // Append selects
  row1.appendChild(document.createTextNode('اليوم: '));
  row1.appendChild(dSel);
  row1.appendChild(document.createTextNode(' / '));
  row1.appendChild(mSel);
  row1.appendChild(document.createTextNode(' / '));
  row1.appendChild(ySel);

  row2.appendChild(document.createTextNode('الوقت: '));
  row2.appendChild(hhSel);
  row2.appendChild(document.createTextNode(' : '));
  row2.appendChild(mmSel);
  row2.appendChild(document.createTextNode(' : '));
  row2.appendChild(ssSel);

  // Position (absolute, with scroll offsets)
  requestAnimationFrame(place);
  window.addEventListener('scroll', place, {passive:true});
  window.addEventListener('resize', place);

  panel.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('.dtp-btn'); if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act==='now'){ const t=new Date(); ySel.value=t.getFullYear(); mSel.value=String(t.getMonth()+1); updateDaySel(); dSel.value=String(t.getDate()); hhSel.value=String(t.getHours()); mmSel.value=String(t.getMinutes()); ssSel.value=String(t.getSeconds()); }
    else if (act==='day-start'){ hhSel.value='0'; mmSel.value='0'; ssSel.value='0'; }
    else if (act==='day-end'){ hhSel.value='23'; mmSel.value='59'; ssSel.value='59'; }
    else if (act==='clear'){
      targetInput.value='';
      targetInput.dispatchEvent(new Event('change'));
      panel._cleanup && panel._cleanup();
      panel.remove();
    }
    else if (act==='apply'){
      const nd = compose();
      targetInput.value = __dtp_fmt(nd);
      targetInput.dispatchEvent(new Event('change'));
      panel._cleanup && panel._cleanup();
      panel.remove();
    }
  });

  // click-outside to close
  setTimeout(()=>{
    function onDoc(e){
      if (!panel.contains(e.target) && e.target!==targetInput){
        panel._cleanup && panel._cleanup();
        panel.remove();
        document.removeEventListener('mousedown', onDoc);
      }
    }
    document.addEventListener('mousedown', onDoc);
  }, 0);
}

function __toast(msg){
      try{ if (window.App && window.App.Toast && typeof window.App.Toast.show==='function'){ return window.App.Toast.show(msg); } }catch(_){ }

      try{
        let el = document.getElementById('app-toast');
        if (!el){
          el = document.createElement('div'); el.id='app-toast';
          el.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:.5rem .8rem;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:99999;font-size:13px;opacity:0;transition:opacity .15s ease';
          document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity='1';
        clearTimeout(el._t); el._t = setTimeout(()=>{ el.style.opacity='0'; }, 1600);
      }catch(e){}
    }
    function ensureTopToolbar(){
  try{
    if (document.getElementById('tableTools')) return;
    const tbl = document.getElementById('dataTable');
    if (!tbl) return;
    const wrap = tbl.closest('.table-wrapper, .table-wrap, .table-responsive') || tbl.parentElement;

    // Keep the tools bar *inside* the scrollable table wrap so:
    // 1) it doesn't float over the rest of the page when user scrolls down
    // 2) it follows horizontal scrolling of the table
    function __syncToolsOffset(){
      try{
        const tools = document.getElementById('tableTools');
        if (!tools) return;
        const h = tools.offsetHeight || 0;
        // Used by CSS to offset sticky thead
        wrap.style.setProperty('--tools-h', h + 'px');
      }catch(e){}
    }
    const bar = document.createElement('div');
    bar.id = 'tableTools';
    bar.innerHTML = `
      <div class="tools-inner">
        <div class="tools-left">
          <div class="group">
            <label>من (Start):</label>
            <input type="text" id="tt-start" class="tt-inp" readonly placeholder="dd/mm/yyyy hh:mm[:ss]"/>
          </div>
          <div class="group">
            <label>إلى (End):</label>
            <input type="text" id="tt-end" class="tt-inp" readonly placeholder="dd/mm/yyyy hh:mm[:ss]"/>
          </div>
          <button id="tt-apply" class="tt-btn primary">بحث</button>
          <button id="tt-clearRange" class="tt-btn">مسح الفترة</button>
          <span class="sep"></span>
          <button id="tt-reset" class="tt-btn danger">Reset table</button>
          <span class="hint">— يُلغي جميع الفلاتر ويعيد كل الصفوف</span>
        </div>

        <!-- Right side reserved for future controls (kept black to avoid showing table behind on horizontal scroll) -->
        <div class="tools-right" id="tt-extra"></div>
      </div>
    `;
    // Insert before the table *inside* the wrap
    wrap.insertBefore(bar, tbl);
    __syncToolsOffset();
    window.addEventListener('resize', __syncToolsOffset);

    // preload from filters if any
    const norm = s => String(s||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'').trim();
    const findHeaderByNorm = (key)=> {
      const H = State.headers||[];
      for (const h of H) if (norm(h)===key) return h;
      return null;
    };
    const hStart = findHeaderByNorm('starttime');
    const hEnd   = findHeaderByNorm('endtime');
    const fStartTW = (State.timeWindow||{});
    const fEndTW = (State.timeWindow||{});
    try{ if (fStartTW.from) document.getElementById('tt-start').value = new Date(fStartTW.from).toISOString().slice(0,16); }catch(e){}
    try{ if (fEndTW.to) document.getElementById('tt-end').value = new Date(fEndTW.to).toISOString().slice(0,16); }catch(e){}

    // handlers
    document.getElementById('tt-start').addEventListener('click', ()=>__dtp_open(document.getElementById('tt-start')));
          document.getElementById('tt-end').addEventListener('click', ()=>__dtp_open(document.getElementById('tt-end')));
          document.getElementById('tt-apply').addEventListener('click', ()=>{
            const elFrom = document.getElementById('tt-start');
            const elTo   = document.getElementById('tt-end');
            const dFrom = parseInput24(elFrom.value);
            const dTo0  = parseInput24(elTo.value);
            let dTo = dTo0;
            if (dTo && dTo.getHours()==0 && dTo.getMinutes()==0 && dTo.getSeconds()==0){ dTo.setHours(23,59,59,999); }
            // simple invalid highlight
            elFrom.classList.toggle('invalid', !!elFrom.value && !dFrom);
            elTo.classList.toggle('invalid', !!elTo.value && !dTo0);
            const rf = { from: dFrom ? dFrom.toISOString() : null, to: dTo ? dTo.toISOString() : null };
            const Store = global.App && global.App.Store;
            if (Store && typeof Store.dispatch === 'function') {
              Store.dispatch({ patch: { rangeFilter: rf, page: 1 } });
            } else {
              try{
                State.rangeFilter = rf;
                State.page = 1;
              }catch(_){}
            }
            applyHeaderFilters();
            global.App.View.renderTable();
          });
document.getElementById('tt-clearRange').addEventListener('click', ()=>{
            const v1 = document.getElementById('tt-start'); const v2 = document.getElementById('tt-end');
            v1.value = ''; v2.value = '';
            v1.classList.remove('invalid'); v2.classList.remove('invalid');
            const Store = global.App && global.App.Store;
            if (Store && typeof Store.dispatch === 'function') {
              Store.dispatch({ patch: { rangeFilter: { from: null, to: null }, page: 1 } });
            } else {
              try{
                State.rangeFilter = { from: null, to: null };
                State.page = 1;
              }catch(_){}
            }
            applyHeaderFilters();
            global.App.View.renderTable();
          });
    document.getElementById('tt-reset').addEventListener('click', ()=>{
      // Reset all filters
      const patch = { headerFilters: {}, rangeFilter: { from: null, to: null }, viewFiltered: null };
      const Store = global.App && global.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        Store.dispatch({ patch });
      } else {
        try{
          State.headerFilters = {};
          State.rangeFilter = { from: null, to: null };
          State.viewFiltered = null;
        }catch(_){}
      }
      applyHeaderFilters();
      global.App.View.renderTable();
    });
  }catch(e){ console.warn('ensureTopToolbar failed', e); }
}



// ===== Header Filters extracted to: js/view_modules/header_filters.js =====
// (kept as globals: applyHeaderFilters + __hf_* helpers)

  // ---------------------------------------------------------------------------
  // Table event delegation (one-time listeners)
  // ---------------------------------------------------------------------------
  function ensureRowDelegation(){
    try{
      const tbody = document.querySelector('#dataTable tbody');
      if (!tbody || tbody.__rowDelegationBound) return;
      tbody.__rowDelegationBound = true;

      // Checkbox selection
      tbody.addEventListener('change', function(ev){
        const cb = ev && ev.target;
        if (!cb || !cb.classList || !cb.classList.contains('row-select')) return;
        const tr = cb.closest('tr[data-row-id]');
        if (!tr) return;
        const idStr = tr.getAttribute('data-row-id');
        if (!idStr) return;
        const idNum = Number(idStr);
        const rid = Number.isNaN(idNum) ? idStr : idNum;

        const Store = global.App && global.App.Store;
        if (Store && Store.dispatch) {
          Store.dispatch({ type: 'TOGGLE_SELECT', rowId: rid, checked: !!cb.checked });
        } else {
          if (cb.checked) State.selected.add(rid);
          else State.selected.delete(rid);
        }
      }, true);

      // Quick details
      tbody.addEventListener('click', function(ev){
        const btn = ev && ev.target && ev.target.closest ? ev.target.closest('button.row-quick-details') : null;
        if (!btn) return;
        try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(_){}
        const tr = btn.closest('tr[data-row-id]');
        if (!tr) return;
        const idStr = tr.getAttribute('data-row-id');
        if (!idStr) return;

        let rowObj = null;
        try{
          if (State.rowsById && typeof State.rowsById.get === 'function') rowObj = State.rowsById.get(String(idStr));
          if (!rowObj && window.__ROWS_BY_ID) rowObj = window.__ROWS_BY_ID[String(idStr)];
        }catch(_){ rowObj = null; }

        if (rowObj) __toggleRowDetailsProxy(tr, rowObj, btn);
      }, true);
    }catch(_){}
  }



  function goToRow(keyOrId){
    return new Promise((resolve)=>{
      try{
        const tryFindIndex = () => {
          const ref = String(keyOrId);
          // 1) Exact string id match
          let idx = State.view.findIndex(r => String(r._id) === ref);
          if (idx >= 0) return { idx, selector: `#dataTable tbody tr[data-row-id="${ref}"]` };

          // 2) Numeric id match
          const idNum = Number(ref);
          if (!Number.isNaN(idNum)){
            idx = State.view.findIndex(r => Number(r._id) === idNum);
            if (idx >= 0) return { idx, selector: `#dataTable tbody tr[data-row-id="${idNum}"]` };
          }

          // 3) Composite key match
          const key = ref;
          try {
            idx = State.view.findIndex(r => (Utils && Utils.computeRowKey) ? (Utils.computeRowKey(State.headers, r) === key) : false);
          } catch(e){ idx = -1; }
          if (idx >= 0) return { idx, selector: `#dataTable tbody tr[data-row-key]` }; // we'll rely on row-target later

          return { idx: -1, selector: null };
        };

        const found = tryFindIndex();
        if (found.idx < 0){ console.warn('Row not in current view:', keyOrId); resolve(false); return; }
        const newPage = Math.max(1, Math.ceil((found.idx+1)/State.pageSize));
        const Store = global.App && global.App.Store;
        if (Store && typeof Store.dispatch === 'function') {
          Store.dispatch({ type: 'SET_PAGE', page: newPage });
        } else {
          try{ State.page = newPage; }catch(_){}
        }
        global.App.View.renderTable();

        requestAnimationFrame(()=>{
          const tr = document.querySelector(found.selector);
          if (tr){
            tr.classList.add('row-target');
            const tableEl = document.getElementById('dataTable');
            let container = tableEl ? (tableEl.closest('.table-responsive, .table-wrapper, .table-container') || tableEl.parentElement) : null;

            // Bring container into viewport if needed
            if (container){
              const rect = container.getBoundingClientRect();
              const outside = (rect.top < 0) || (rect.bottom > window.innerHeight);
              if (outside){ container.scrollIntoView({behavior:'smooth', block:'start'}); }
            }

            setTimeout(()=>{
              if (container && container.scrollHeight > container.clientHeight){
                const top = tr.offsetTop - (container.offsetTop||0);
                const CM = 96 / 2.54;
                const EXTRA = Math.round(6 * CM);
                const target = Math.max(0, top - (container.clientHeight/2 - tr.clientHeight/2) + EXTRA);
                container.scrollTo({ top: target, behavior: 'smooth' });
              } else {
                // NOTE: do not scroll main page here (keep user scroll position)
                // tr.scrollIntoView({behavior:'smooth', block:'start'});
              // (disabled) keep main page scroll stable
              }
              // (disabled) keep main page scroll stable
              /*page-offset-3cm*/
              // (disabled) keep main page scroll stable
              tr.classList.add('row-flash');
              // [2025-09-08] Preserve the red highlight on the row until another row is selected. Only remove the flash effect.
              setTimeout(()=>{ tr.classList.remove('row-flash'); /*tr.classList.remove('row-target');*/ resolve(true); }, 1400);
            }, 300);
          } else {
            resolve(false);
          }
        });
      }catch(e){ console.error(e); resolve(false); }
    });
  }


  // Backward-compat wrapper


  function goToRowById(rowId){ return goToRow(rowId); }

// Return to original row by closing any compare rows first, then jump and open its inline details
function __closeAllCompareRows(){
  try{
    document.querySelectorAll('tr.row-compare').forEach(function(cmp){
      try{
        var prev = cmp.previousElementSibling;
        try{ cmp.remove(); }catch(_){ try{ cmp.parentNode && cmp.parentNode.removeChild(cmp); }catch(__){} }
        if (prev){
          var qb = prev.querySelector('.row-quick-details.on');
          if (qb) { try{ qb.classList.remove('on'); }catch(__){} }
        }
      }catch(_){ }
    });
  }catch(_){ }
}
function __jumpToRowAndOpenDetails(id){
  if (!id) return;
  try{ __closeAllCompareRows(); }catch(_){ }
  try{
    var p = goToRowById(id);
    if (p && typeof p.then === 'function'){
      p.then(function(){
        try{
          var tr = document.querySelector('#dataTable tbody tr[data-row-id="' + id + '"]');
          var rowObj = null;
          try { rowObj = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(id); }); }catch(__){}
          var quickBtn = tr ? tr.querySelector('.row-quick-details') : null;
          if (tr && quickBtn && rowObj){ __toggleRowDetailsProxy(tr, rowObj, quickBtn); }
        }catch(__){}
      });
    } else {
      // If goToRowById is not promise-based, best effort open details directly
      try{
        var tr2 = document.querySelector('#dataTable tbody tr[data-row-id="' + id + '"]');
        var rowObj2 = null;
        try { rowObj2 = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(id); }); }catch(__){}
        var quickBtn2 = tr2 ? tr2.querySelector('.row-quick-details') : null;
        if (tr2 && quickBtn2 && rowObj2){ __toggleRowDetailsProxy(tr2, rowObj2, quickBtn2); }
      }catch(__){}
    }
  }catch(_){ }
}




  function updateSumSelected(){
    // Use StateAdapter as the single source of truth; fall back to legacy State.
    const Adapter = (global.App && global.App.Core && global.App.Core.StateAdapter) || null;
    const state = Adapter ? Adapter.getState() : (typeof State !== 'undefined' ? State : {});
    const headers = Adapter ? Adapter.getHeaders() : (Array.isArray(state.headers) ? state.headers : []);
    const selectedSet = Adapter ? Adapter.getSelectedSet() : (state.selected instanceof Set ? state.selected : new Set(state.selected || []));
    const rows = Adapter ? Adapter.getRows() : (Array.isArray(state.rows) ? state.rows : []);
    const rowsById = Adapter ? Adapter.getRowsById() : (state.rowsById instanceof Map ? state.rowsById : new Map());

    // Normalize selected IDs to string for consistent lookups
    const selectedIds = new Set();
    try {
      selectedSet.forEach(function (id) {
        if (id !== null && typeof id !== 'undefined') selectedIds.add(String(id));
      });
    } catch (_) {
      // ignore iteration errors
    }
    // Update selected count UI (near page info)
    const selCountEl = document.getElementById('selectedCount');
    if (selCountEl) selCountEl.textContent = selectedIds.size.toLocaleString();

    let sumUnits = 0, sumFee = 0;
    // Determine which header to use for fee and units totals
    const norm = normalizeHeader;
    const promoFeeIdx = headers.findIndex(h => norm(h) === 'totalpromotionalfee');
    let feeIdx = (typeof state.feeIdx === 'number') ? state.feeIdx : -1;
    let unitIdx = (typeof state.unitIdx === 'number') ? state.unitIdx : -1;
    let feeHeader = null;
    let unitHeader = null;
    if (state.filter === 'BONUS' && promoFeeIdx >= 0) feeHeader = headers[promoFeeIdx];
    else if (feeIdx >= 0) feeHeader = headers[feeIdx];
    if (unitIdx >= 0) unitHeader = headers[unitIdx];
    // Fallback: if either header is not determined, attempt to find using Schema
    if ((!feeHeader || !unitHeader) && global.App && App.Core && App.Core.Schema) {
      try {
        const schema = App.Core.Schema;
        const feeAliases = ['totalfee', 'totalfees', 'totalfeegp', 'fee'];
        const unitAliases = ['freeunitconsumed', 'freeunitsconsumed', 'unitsconsumed', 'unitconsumed'];
        if (!feeHeader) {
          const idx = schema.findColumnIndex(headers, feeAliases);
          if (idx >= 0) {
            feeIdx = idx;
            feeHeader = headers[idx];
          }
        }
        if (!unitHeader) {
          const idx = schema.findColumnIndex(headers, unitAliases);
          if (idx >= 0) {
            unitIdx = idx;
            unitHeader = headers[idx];
          }
        }
      } catch (_) {}
    }

    const feeParts = [], unitParts = [];
    let currency = "";

    // Helper to fetch a row by id
    const getRow = function (id) {
      try {
        if (rowsById && typeof rowsById.get === 'function') {
          const r = rowsById.get(String(id));
          if (r) return r;
        }
      } catch (_) {}
      // fallback: linear search
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          const rid = (typeof r._id !== 'undefined' && r._id !== null)
            ? r._id
            : ((typeof r.id !== 'undefined' && r.id !== null) ? r.id : ((typeof r.__id !== 'undefined' && r.__id !== null) ? r.__id : undefined));
          if (String(rid) === String(id)) return r;
        } catch (_) {}
      }
      return null;
    };

    selectedIds.forEach(function (id) {
      const row = getRow(id);
      if (!row) return;
      if (unitHeader) {
        let val;
        try { val = row[unitHeader]; } catch (_) { val = undefined; }
        const u = toNumber(val);
        sumUnits += u;
        if (u) unitParts.push(u);
      }
      if (feeHeader) {
        let cell;
        try { cell = row[feeHeader]; } catch (_) { cell = undefined; }
        const str = String(cell == null ? '' : cell);
        const n = toNumber(str);
        sumFee += n;
        if (n) feeParts.push(n);
        if (!currency) {
          let cur = str.replace(/[0-9.,\s\u00A0-]/g, '').trim().toUpperCase();
          if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP'; else if (cur) currency = cur;
        }
      }
    });

    const elUnits = document.getElementById('sumSelectedUnits');
    if (elUnits) elUnits.textContent = sumUnits.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const elFee = document.getElementById('sumSelectedFee');
    if (elFee) elFee.textContent = sumFee.toLocaleString(undefined, { maximumFractionDigits: 2 }) + (currency ? (' ' + currency) : '');
    const feeDetails = document.getElementById('sumSelectedFeeDetails');
    if (feeDetails) feeDetails.textContent = (feeParts.length && sumFee) ? '(' + feeParts.map(n => n.toLocaleString(undefined, { maximumFractionDigits: 2 })).join(' + ') + ')' : '';
    const unitDetails = document.getElementById('sumSelectedUnitsDetails');
    if (unitDetails) unitDetails.textContent = (unitParts.length && sumUnits) ? '(' + unitParts.map(n => n.toLocaleString(undefined, { maximumFractionDigits: 2 })).join(' + ') + ')' : '';

    // Determine categories of selected rows for breakdown
    let anyBalanceSelected = false;
    let anyBonusSelected = false;
    let anyUnitsSelected = false;
    selectedIds.forEach(function (id) {
      const row = getRow(id);
      if (!row) return;
      const v = String(row.deductFrom || '').trim().toLowerCase();
      if (v.includes('balance') && !v.includes('free')) anyBalanceSelected = true;
      if (v === 'bonus') anyBonusSelected = true;
      if (v.includes('free')) anyUnitsSelected = true;
    });
    const cats = [anyBonusSelected, anyBalanceSelected, anyUnitsSelected].filter(Boolean).length;
    if (cats >= 2) renderSelectedBreakdownAll();
    else if (anyBonusSelected) renderBonusBreakdown();
    else if (anyBalanceSelected) renderBalanceBreakdown();
    else if (anyUnitsSelected) renderConsumptionBreakdown();
    else renderConsumptionBreakdown();
  }

  function renderConsumptionBreakdown(){
    const box = document.getElementById('consumptionBreakdown');
    if (!box) return;
    const { Rules } = global.App;
    const selectedRows = State.rows.filter(r => State.selected.has(r._id));
    // Determine fee/unit headers for clickable parts in the breakdown box
    const promoFeeIdx = State.headers.findIndex(h => normalizeHeader(h) === 'totalpromotionalfee');
    let feeHeader = null;
    if (State.filter === 'BONUS' && promoFeeIdx >= 0) feeHeader = State.headers[promoFeeIdx];
    else if (State.feeIdx >= 0) feeHeader = State.headers[State.feeIdx];
    const unitHeader = (State.unitIdx>=0 ? State.headers[State.unitIdx] : null);

    if (!selectedRows.length){ box.innerHTML = '<div class="small-muted">لا توجد صفوف محددة حاليًا.</div>'; return; }

    
const groups=[];
(Rules?.list || []).forEach(rule=>{
  const rows = selectedRows.filter(rule.matches);
  if (rows.length){
    const summary = rule.summarize(rows, { State, Utils });
    groups.push({ rule, rows, summary, id: rule.key });
  }
});

// --- DEDUPE: Prefer FREE_UNITS over UNITS when both capture (nearly) the same rows ---
try {
  const keyOf = g => (g && g.id) ? String(g.id).toUpperCase() : '';
  const freeIdx = groups.findIndex(g => keyOf(g) === 'FREE_UNITS');
  const unitsIdx = groups.findIndex(g => keyOf(g) === 'UNITS');
  if (freeIdx >= 0 && unitsIdx >= 0){
    const a = new Set(groups[freeIdx].rows.map(r=>r._id));
    const b = new Set(groups[unitsIdx].rows.map(r=>r._id));
    // Compute Jaccard similarity
    let inter=0; a.forEach(id => { if (b.has(id)) inter++; });
    const union = new Set([...a, ...b]).size || 1;
    const jacc = inter / union;
    if (jacc >= 0.6){ // high overlap => drop UNITS (keep FREE_UNITS for detailed view)
      groups.splice(unitsIdx, 1);
    }
  }
} catch(e){ console.warn('dedupe groups failed', e); }


    if (!groups.length){ box.innerHTML = '<div class="small-muted">لم تنطبق أي قاعدة على الصفوف المحددة.</div>'; return; }

    let html = '<h6>تفاصيل الاستهلاك حسب الاختيار</h6>';
    groups.forEach(g=>{
      const { rule, rows, summary, id } = g;
      const parts = [];
      if (summary.totalFee!=null && !isNaN(summary.totalFee)){
        const feeTxt = summary.totalFee.toLocaleString(undefined,{maximumFractionDigits:2});
        parts.push(`<span class="tag">إجمالي الرسوم: ${feeTxt}${summary.currency?(' '+summary.currency):''}</span>`);
      }
      if (summary.totalUnits!=null && !isNaN(summary.totalUnits)){
        const unitTxt = summary.totalUnits.toLocaleString(undefined,{maximumFractionDigits:2});
        parts.push(`<span class="tag">إجمالي الوحدات: ${unitTxt}</span>`);
      }
      parts.push(`<span class="tag">عدد العمليات: ${rows.length}</span>`);

      let feeChipsHtml = '';
      if (feeHeader){
        const partsWithIds = [];
        rows.forEach(r=>{
          try{
            const cell = String(r[feeHeader] ?? "");
            const n = toNumber(cell);
            if (!n) return;
            partsWithIds.push({ id: r._id, v: n });
          }catch(_){}
        });
        if (partsWithIds.length){
          const spans = partsWithIds.map(p=>{
            const vTxt = (isFinite(p.v) ? p.v : 0).toLocaleString(undefined,{maximumFractionDigits:2});
            return `<span class="fee-part fee-chip" data-row-id="${p.id}">${vTxt}</span>`;
          }).join(' <span class="op">+</span> ');
          feeChipsHtml = `<div class="fee-chips mt-2" dir="ltr">تفصيل الرسوم: (${spans})</div>`;
        } else {
          feeChipsHtml = `<div class="fee-chips mt-2">تفصيل الرسوم: (-)</div>`;
        }
      }

      let unitChipsHtml = '';
      if (unitHeader){
        const unitPartsWithIds = [];
        rows.forEach(r=>{
          try{
            const cell = String(r[unitHeader] ?? "");
            const n = toNumber(cell);
            if (!n) return;
            unitPartsWithIds.push({ id: r._id, v: n });
          }catch(_){}
        });
        if (unitPartsWithIds.length){
          const spansU = unitPartsWithIds.map(p=>{
            const vTxt = (isFinite(p.v) ? p.v : 0).toLocaleString(undefined,{maximumFractionDigits:2});
            return `<span class="fee-part fee-chip" data-row-id="${p.id}">${vTxt}</span>`;
          }).join(' <span class="op">+</span> ');
          unitChipsHtml = `<div class="fee-chips mt-2">تفصيل الوحدات: (${spansU})</div>`;
        } else {
          unitChipsHtml = `<div class="fee-chips mt-2">تفصيل الوحدات: (-)</div>`;
        }
      }

      const detailBits = [];
      // For fee parts we no longer render a label; details will be materialised into clickable values after rendering
      // if (Array.isArray(summary.feeParts) && summary.feeParts.length){
      //   detailBits.push(`<div class="small-muted">تفصيل الرسوم: (${summary.feeParts.map(n=> n.toLocaleString(undefined,{maximumFractionDigits:2})).join(' + ')})</div>`);
      // }
      if (Array.isArray(summary.unitParts) && summary.unitParts.length){
        detailBits.push(`<div class="small-muted preserve-details d-none">تفصيل الوحدات: (${summary.unitParts.map(n=> n.toLocaleString(undefined,{maximumFractionDigits:2})).join(' + ')})</div>`);
      }

      const detailsHtml = Array.isArray(summary.details) && summary.details.length
          ? `<div id="det-${id}" class="small-muted preserve-details d-none">${summary.details.map(d=>`• ${d}`).join("<br>")}</div>`
          : '';

      html += `
        <div class="break-row">
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div class="fw-bold">${rule.label}</div>
              <div class="small-muted">${rule.explain || ""}</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="${id}">إظهار التفاصيل</button>
          </div>
          <div class="kv mt-2">${parts.join(' ')}</div>
          ${feeChipsHtml}
          ${unitChipsHtml}
          ${detailBits.join('')}
          ${detailsHtml}
          <div class="br-rows mt-2 preserve-details d-none" id="rows-${id}"></div>
        </div>
      `;
    });
    box.innerHTML = html;

    // Clickable fee/unit chips: jump back to the original row (and open inline details)
    if (!box.__feeChipBound){
      box.__feeChipBound = true;
      box.addEventListener('click', function(ev){
        const t = ev && ev.target && ev.target.closest ? ev.target.closest('.fee-part[data-row-id]') : null;
        if (!t) return;
        try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(_){}
        const id = t.getAttribute('data-row-id');
        if (id) __jumpToRowAndOpenDetails(id);
      }, true);
    }

    try {
      (groups || []).forEach(function(g){
        if (String(g.id||'').toUpperCase().includes('UNIT')){
          // [FIX 2025-09-06] Prepare Units rows map BEFORE materialization
window.__UNIT_ROWS_BY_ID = window.__UNIT_ROWS_BY_ID || {};
try {
  (groups || []).forEach(function(g){
    window.__UNIT_ROWS_BY_ID[g.id] = g && g.rows ? g.rows : [];
  });
} catch(e) {}
materializeUnitDetails(g.id);
        }
        // For groups with feeParts (i.e. deductions from balance or bonus), convert fee values into clickable lines
        try {
          if (Array.isArray(g.summary?.feeParts) && g.summary.feeParts.length){
            materializeFeeDetails(g.id, g.summary.feeParts, g.rows);
          }
        } catch(e){}
      });
    } catch(e) {}

    // Map rows by group id (for Units-only materialization)
    window.__UNIT_ROWS_BY_ID = {};
    try { (groups || []).forEach(g => { window.__UNIT_ROWS_BY_ID[g.id] = g.rows || []; }); } catch(e){}

    // Turn Units details bullets into clickable lines with jump arrow
    function materializeUnitDetails /*[RID_GUARD]*/(id){
  // [FIX 2025-09-06] Safe builder: only add jump if rid is valid
  // Append a simple clickable detail line for unit breakdowns. Each line shows only the value and navigates back to the original row when clicked.
  function __appendDetailLine(container, txt, rid){
    var line = document.createElement('div');
    // Preserve existing styling via br-line; mark as value-only for optional styling
    line.className = 'br-line br-value';
    if (rid != null) {
      line.setAttribute('data-row-id', rid);
      line.textContent = String(txt);
      // Clicking on the value should return to the row and expand its inline details
      line.addEventListener('click', function(ev){
        try{
          ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        }catch(_){}
        const id = rid;
        try{
          goToRowById(id).then(function(){
            try{
              const tr = document.querySelector('#dataTable tbody tr[data-row-id="' + id + '"]');
              let rowObj = null;
              try { rowObj = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(id); }); } catch(__){}
              const quickBtn = tr ? tr.querySelector('.row-quick-details') : null;
              if (tr && quickBtn && rowObj){ __toggleRowDetailsProxy(tr, rowObj, quickBtn); }
            }catch(__){}
          });
        }catch(__){}
      }, true);
    } else {
      line.textContent = String(txt);
    }

    /**
     * Convert fee breakdown values into clickable lines. This helper mirrors
     * the logic used for unit details above, but takes an array of numeric
     * values along with the corresponding rows and renders them into the
     * target container. Each value will act like a return button: clicking
     * it will navigate back to the original row and toggle its inline
     * details via __toggleRowDetailsProxy().
     *
     * @param {string} id Identifier of the breakdown container (matching rows-<id>)
     * @param {Array<number>} values Array of numeric fee values to render
     * @param {Array<Object>} rows Array of row objects corresponding to the values
     */
    function materializeFeeDetails /*[RID_GUARD]*/(id, values, rows){
      try{
        if (!id) return;
        const host = document.getElementById('rows-' + id);
        if (!host) return;
        // If no values provided, nothing to render
        if (!Array.isArray(values) || !values.length) {
          host.innerHTML = '';
          return;
        }
        host.innerHTML = '';
        const frag = document.createDocumentFragment();
        values.forEach(function(val, i){
          // Normalise to string with localisation (no currency here)
          let txt = '';
          try {
            // If val is numeric, format with comma separation
            if (typeof val === 'number') {
              txt = Math.abs(val).toLocaleString(undefined,{ maximumFractionDigits: 2 });
            } else {
              txt = String(val).trim();
            }
          } catch(e){ txt = String(val).trim(); }
          const rid = (Array.isArray(rows) && rows[i] && rows[i]._id) ? rows[i]._id : null;
          const line = document.createElement('div');
          line.className = 'br-line br-value';
          if (rid != null) {
            line.setAttribute('data-row-id', rid);
            line.textContent = txt;
            // Clicking on the value should close the compare row for current and open it for the clicked row
            line.addEventListener('click', function(ev){
              try{
                ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
              }catch(_){ }
              const idStr = rid;
              try{
                goToRowById(idStr).then(function(){
                  try{
                    const tr = document.querySelector('#dataTable tbody tr[data-row-id="' + idStr + '"]');
                    let rowObj = null;
                    try { rowObj = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(idStr); }); } catch(__){}
                    const quickBtn = tr ? tr.querySelector('.row-quick-details') : null;
                    if (tr && quickBtn && rowObj){ __toggleRowDetailsProxy(tr, rowObj, quickBtn); }
                  }catch(__){}
                });
              }catch(__){}
            }, true);
          } else {
            line.textContent = txt;
          }
          frag.appendChild(line);
        });
        host.appendChild(frag);
      }catch(e){}
    }
    container.appendChild(line);
  }

      
      try{
        const det  = document.getElementById('det-'  + id);
        const host = document.getElementById('rows-' + id);
        if(!det || !host) return;
        const raw = (det.innerHTML || det.textContent || "");
        // دعم فاصل <br> أو علامة + وإزالة الرمز •
        let parts = raw.split(/<br\s*\/?>/i);
        if (parts.length <= 1) { parts = raw.split(/\s*\+\s*/); }
        parts = parts.map(x => x.replace(/^•\s*/,'').trim()).filter(Boolean);
        // اخفاء المصدر لتفادي التكرار
        det.classList.add('d-none');
        det.style.display = 'none';
        det.setAttribute('aria-hidden','true');
        const rows = (window.__UNIT_ROWS_BY_ID || {})[id] || [];
        host.innerHTML = "";
        const frag = document.createDocumentFragment();
        parts.forEach((txt, i) => {
          const rid = (rows[i] && rows[i]._id) ? rows[i]._id : (rows[0] && rows[0]._id);
          __appendDetailLine(frag, txt, rid);
        });
        host.appendChild(frag);
      }catch(e){}

    }


    // === Pro: stream ALL matching rows for each rule (no hard cap) ===
    try {
      const CHUNK = 400; // rows per frame
      (groups || []).forEach(g => {
        const host = document.getElementById('rows-' + g.id);
        if (!host) return;
        // delegated click to go to row. Supports both arrow clicks and value lines
        host.addEventListener('click', (ev)=>{
          const target = ev.target.closest('.br-value, .br-jump');
          if (!target) return;
          const el = target.closest('.br-line');
          if (!el) return;
          const id = el.getAttribute('data-row-id');
          if (!id) return;
          // Navigate to the row
          try{
            goToRowById(id).then(function(){
              // If clicking on a value-only line (units), expand its details
              try{
                if (target.classList.contains('br-value') || el.classList.contains('br-value')){
                  const rid = id;
                  const tr = document.querySelector('#dataTable tbody tr[data-row-id="' + rid + '"]');
                  let rowObj = null;
                  try{ rowObj = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(rid); }); }catch(__){}
                  const quickBtn = tr ? tr.querySelector('.row-quick-details') : null;
                  if (tr && quickBtn && rowObj){ __toggleRowDetailsProxy(tr, rowObj, quickBtn); }
                }
              }catch(__){}
            });
          }catch(__){}
        });
        let i = 0;
        function step(){
          const gid = String(g.id||'').toUpperCase();
          const frag = document.createDocumentFragment();
          for (let c=0; c<CHUNK && i<g.rows.length; c++, i++){
            if (gid.includes('UNIT')) { continue; }
            const r = g.rows[i];
            const line = document.createElement('div');
            line.className = 'br-line';
            line.setAttribute('data-row-id', r._id);
            let key = '';
            try { key = (window.App && window.App.Utils && window.App.Utils.computeRowKey) ? window.App.Utils.computeRowKey(State.headers, r) : ''; } catch(e){}
            line.innerHTML = '<span class="br-jump" title="اذهب للأصل">↪</span>' + 
                             ' #' + r._id + ' — ' + (key ? window.App.Utils.escapeHTML(key) : '');
            try { if (g && g.summary && Array.isArray(g.summary.details)) { const d = g.summary.details[i]; if (d) line.setAttribute('data-detail', d); } } catch(e){}
            frag.appendChild(line);
          }
          host.appendChild(frag);
          if (i < g.rows.length) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    } catch(e) { console.warn('stream rows failed', e); }


    // Buttons
    const btns = box.querySelectorAll('[data-toggle-details]');
    btns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const groupId = String(btn.getAttribute('data-toggle-details')||'').toUpperCase();
        const id = btn.getAttribute('data-toggle-details');
        const det = document.getElementById('det-'+id);
        const host = document.getElementById('rows-'+id);
        if (!det && !host) return;
        const hidden = host ? host.classList.contains('d-none') : (det && det.classList.contains('d-none'));
        try{ if (det) det.classList.toggle('d-none'); }catch(_){}
        try{ if (host) host.classList.toggle('d-none'); }catch(_){}
        btn.textContent = hidden ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
        if (groupId.includes('UNIT')){ materializeUnitDetails(id); }
      });
    });

  }


// --- Helpers: fee/unit chips & value materialization (Hide, don't Delete) ---
function bindFeeChipClicks(container){
  try{
    if (!container || container.__feeChipBound) return;
    container.__feeChipBound = true;
    container.addEventListener('click', function(ev){
      const t = ev && ev.target && ev.target.closest ? ev.target.closest('.fee-part[data-row-id]') : null;
      if (!t) return;
      try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(_){}
      const rid = t.getAttribute('data-row-id');
      if (!rid) return;
      try{
        if (typeof __jumpToRowAndOpenDetails === 'function') { __jumpToRowAndOpenDetails(rid); return; }
      }catch(_){}
      try{
        goToRowById(rid).then(function(){
          try{
            const tr = document.querySelector('#dataTable tbody tr[data-row-id="' + rid + '"]');
            let rowObj = null;
            try { rowObj = (State.rows || []).find(function(rr){ return String(rr && rr._id) === String(rid); }); } catch(__){}
            const quickBtn = tr ? tr.querySelector('.row-quick-details') : null;
            if (tr && quickBtn && rowObj){ __toggleRowDetailsProxy(tr, rowObj, quickBtn); }
          }catch(__){}
        });
      }catch(_){}
    }, true);
  }catch(_){}
}

function buildValueChips(values, rows, opts){
  try{
    opts = opts || {};
    const label = opts.label || 'تفصيل';
    const dir = opts.dir || 'ltr';
    if (!Array.isArray(values) || !values.length) return `<div class="fee-chips mt-2">${label}: (-)</div>`;
    const spans = [];
    for (let i=0;i<values.length;i++){
      const v = values[i];
      const rid = (Array.isArray(rows) && rows[i] && rows[i]._id != null) ? rows[i]._id : null;
      const n = (typeof v === 'number') ? v : parseFloat(String(v||'').replace(/[^0-9\.-]/g,''));
      if (!n) continue;
      const txt = Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2});
      if (rid != null) spans.push(`<span class="fee-part fee-chip" data-row-id="${rid}">${txt}</span>`);
      else spans.push(`<span class="fee-part fee-chip">${txt}</span>`);
    }
    if (!spans.length) return `<div class="fee-chips mt-2">${label}: (-)</div>`;
    return `<div class="fee-chips mt-2" dir="${dir}">${label}: (${spans.join(' <span class="op">+</span> ')})</div>`;
  }catch(_){ return ''; }
}

function materializeFeeDetails(id, values, rows, detailLines){
  try{
    if (!id) return;
    const host = document.getElementById('rows-' + id);
    if (!host) return;
    host.innerHTML = '';
    if (!Array.isArray(values) || !values.length) return;
    const frag = document.createDocumentFragment();
    for (let i=0;i<values.length;i++){
      let v = values[i];
      let txt = '';
      try{
        if (typeof v === 'number') txt = Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:2});
        else {
          const n = parseFloat(String(v||'').replace(/[^0-9\.-]/g,''));
          txt = (isNaN(n)? String(v||'').trim() : Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2}));
        }
      }catch(e){ txt = String(v||'').trim(); }
      if (!txt) continue;

      const rid = (Array.isArray(rows) && rows[i] && rows[i]._id != null) ? rows[i]._id : null;
      const line = document.createElement('div');
      line.className = 'br-line br-value';
      if (rid != null) line.setAttribute('data-row-id', rid);
      try{
        let d = '';
        if (Array.isArray(detailLines)) {
          d = detailLines[i] != null ? String(detailLines[i]).trim() : '';
        } else if (typeof detailLines === 'function') {
          d = String(detailLines(rows[i], i, v) || '').trim();
        } else if (detailLines && typeof detailLines === 'object') {
          // allow passing {details:[...]} or similar
          const arr = detailLines.details || detailLines.lines || detailLines.texts;
          if (Array.isArray(arr)) d = arr[i] != null ? String(arr[i]).trim() : '';
        }
        if (d) line.setAttribute('data-detail', d);
      }catch(_){ }
      line.textContent = txt;
      frag.appendChild(line);
    }
    host.appendChild(frag);
  }catch(e){ /* ignore */ }
}

  // BONUS-only breakdown (promotional columns + offering name + time rules)
  function renderBonusBreakdown(){
    const box = document.getElementById('consumptionBreakdown');
    if (!box) return;

    const H = State.headers;
    const norm = s => String(s||"").toLowerCase().replace(/[\\s_\\/\\-\\.\\(\\)]+/g,"").trim();
    const findByWords = (words)=>{
      const w = words.map(x=> norm(x));
      for (let i=0;i<H.length;i++){
        const h = norm(H[i]);
        let ok = true;
        for(const x of w){ if(!h.includes(x)){ ok=false; break; } }
        if (ok) return i;
      }
      return -1;
    };

    const startIdx  = findByWords(['start','time']);
    const endIdx    = findByWords(['end','time']);
    const beforeIdx = findByWords(['total','promotional','balance','before']);
    const afterIdx  = findByWords(['total','promotional','balance','after']);
    const feeIdx    = findByWords(['total','promotional','fee']);
    const offeringIdx = findByWords(['offering','name']);

    const _candidates = State.rows.filter(r => String(r.deductFrom||'').trim().toLowerCase()==='bonus');
    const selectedRows = _candidates.filter(r => State.selected.has(r._id));
    const rowsForDetails = selectedRows.length ? selectedRows : _candidates;
    if (!rowsForDetails.length){ box.innerHTML = '<div class="small-muted">لا توجد صفوف سلفنى مطابقة.</div>';
    // delegated click-to-row
    box.addEventListener('click', (ev)=>{
      const el = ev.target.closest('.br-line');
      if (!el) return;
      const id = el.getAttribute('data-row-id');
      if (id) goToRowById(id);
    }, { once: true });

    box.querySelectorAll('.br-line').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-row-id');
        if (id) goToRowById(id);
      });
    });
 return; }

    // Helpers
    const timeArabic = (d)=>{ if(!d||isNaN(d)) return '—'; const h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const am=h<12; const hh=(h%12)||12; return `${hh}:${m} ${am?'صباحا':'مساءا'}`; };
    const sameDay = (a,b)=> a&&b&&a.getFullYear&&b.getFullYear&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

    let totalFee=0, parts=[], currency="";
    const lines=[];

    rowsForDetails.forEach(r=>{
      const start = Utils.parseDateFlex(startIdx>=0 ? r[H[startIdx]] : r.startTime);
      const end   = Utils.parseDateFlex(endIdx>=0   ? r[H[endIdx]]   : r.endTime);

      const before = beforeIdx>=0 ? toNumber(r[H[beforeIdx]]) : 0;
      const after  = afterIdx>=0  ? toNumber(r[H[afterIdx]])  : 0;

      const feeCell = feeIdx>=0 ? String(r[H[feeIdx]]) : "";
      const feeVal = toNumber(feeCell);
      totalFee += feeVal; if (feeVal) parts.push(feeVal);
      if (!currency){
        let cur = feeCell.replace(/[0-9.,\s\u00A0-]/g,"").trim().toUpperCase();
        if (/EGP|LE|ج|جنيه/.test(cur)) currency="EGP"; else if (cur) currency = cur;
      }

      const startFull = Utils.fmtArabicDT(start);
      const endFull   = Utils.fmtArabicDT(end);

      let timeText="";
      if (start && end && start.getTime && end.getTime && start.getTime()===end.getTime()){
        timeText = `فى توقيت ${startFull}`;
      } else if (sameDay(start, end)){
        timeText = `من توقيت ${startFull} حتى توقيت ${timeArabic(end)}`;
      } else {
        timeText = `من توقيت ${startFull} حتى توقيت ${endFull}`;
      }

      const reason = ((Utils && Utils.deductionReason) ? Utils.deductionReason(H, r) : (offeringIdx>=0?String(r[H[offeringIdx]]||'').trim():''));
      let offeringTxt = (Utils && Utils.breakdownComment) ? Utils.breakdownComment(H, r, 'BALANCE', { reason: reason }) : (reason ? ` وسبب الخصم: ${reason}` : '');

      const beforeTxt = beforeIdx>=0 ? Math.abs(before).toLocaleString() : "—";
      const feeTxt    = feeIdx>=0 ? (Math.abs(feeVal).toLocaleString() + (currency?(' '+currency):'')) : "—";
      const afterTxt  = afterIdx>=0 ? Math.abs(after).toLocaleString() : "—";

      const line = `${timeText} رصيد سلفنى كان ${beforeTxt} واتخصم منو ${feeTxt} والمتبقى ${afterTxt}${offeringTxt}`;
      lines.push('<span class="br-line" data-row-id="'+r._id+'" data-row-key="'+((Utils&&Utils.computeRowKey)?Utils.computeRowKey(H,r):'')+'"><span class="br-jump" title="اذهب للأصل">↪</span> '+ line + '</span>');
    });

    const totalTxt = (feeIdx>=0 ? Math.abs(totalFee).toLocaleString(undefined,{maximumFractionDigits:2}) + (currency?(' '+currency):'') : "—");
    const partsTxt = (feeIdx>=0 && parts.length) ? `<div class="small-muted">تفصيل الرسوم: (${parts.map(n=> n.toLocaleString(undefined,{maximumFractionDigits:2})).join(' + ')})</div>` : '';

    const feeVals = rowsForDetails.map(r=>{ try{ return feeIdx>=0 ? toNumber(String(r[H[feeIdx]]||'')) : 0; }catch(e){ return 0; } });
    const feeChipsHtml = buildValueChips(feeVals, rowsForDetails, { label: 'تفصيل الرسوم', dir: 'ltr' });

    // Hide the verbose lines/parts by default (do NOT remove), to avoid breaking upstream details.
    // User can toggle visibility.
    box.innerHTML = `
      <h6>تفاصيل الاستهلاك حسب الاختيار</h6>
      <div class="break-row">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="kv mt-2">
            <span class="tag">إجمالي الرسوم: ${totalTxt}</span>
            <span class="tag">عدد العمليات: ${rowsForDetails.length}</span>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="BONUS_ONLY">إظهار التفاصيل</button>
        </div>
        ${feeChipsHtml}
        <div id="det-BONUS_ONLY" class="preserve-details d-none">
          ${partsTxt ? partsTxt.replace('<div class="small-muted">','<div class="small-muted preserve-details">') : ''}
          <div class="small-muted mt-1 preserve-details">` + lines.join(' + ') + `</div>
        </div>
      </div>`;

    // Enable clickable fee chips
    try{ bindFeeChipClicks(box); }catch(_){ }

    // Bind toggle for this simple section
    try {
      const btn = box.querySelector('[data-toggle-details="BONUS_ONLY"]');
      if (btn && !btn.__bound){
        btn.__bound = true;
        btn.addEventListener('click', ()=>{
          const det = document.getElementById('det-BONUS_ONLY');
          if (!det) return;
          const hidden = det.classList.contains('d-none');
          det.classList.toggle('d-none');
          btn.textContent = hidden ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
        });
      }
    } catch(_){ }
  }

  
  function renderBalanceBreakdown(){
    const box = document.getElementById('consumptionBreakdown');
    if (!box) return;

    const H = State.headers;
    const norm = s => String(s||"").toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,"").trim();
    const findByWords = (words)=>{
      const w = words.map(x=> norm(x));
      for (let i=0;i<H.length;i++){
        const h = norm(H[i]);
        let ok = true;
        for(const x of w){ if(!h.includes(x)){ ok=false; break; } }
        if (ok) return i;
      }
      return -1;
    };

    const startIdx  = findByWords(['start','time']);
    const endIdx    = findByWords(['end','time']);
    const beforeIdx = findByWords(['balance','before']);
    const afterIdx  = findByWords(['balance','after']);
    const feeIdx    = findByWords(['total','fee']);
    const offeringIdx = findByWords(['offering','name']);

    const _candidates = State.rows.filter(r => String(r.deductFrom||'').toLowerCase().includes('balance') && !String(r.deductFrom||'').toLowerCase().includes('free'));
    const selectedRows = _candidates.filter(r => State.selected.has(r._id));
    const rowsForDetails = selectedRows.length ? selectedRows : _candidates;
    if (!rowsForDetails.length){ box.innerHTML = '<div class="small-muted">لا توجد صفوف خصم من الرصيد مطابقة.</div>';
    // delegated click-to-row
    box.addEventListener('click', (ev)=>{
      const el = ev.target.closest('.br-line');
      if (!el) return;
      const id = el.getAttribute('data-row-id');
      if (id) goToRowById(id);
    }, { once: true });

    box.querySelectorAll('.br-line').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-row-id');
        if (id) goToRowById(id);
      });
    });
 return; }

    // Helpers
    const timeArabic = (d)=>{ if(!d||isNaN(d)) return '—'; const h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const am=h<12; const hh=(h%12)||12; return `${hh}:${m} ${am?'صباحا':'مساءا'}`; };
    const sameDay = (a,b)=> a&&b&&a.getFullYear&&b.getFullYear && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

    // Try parse time columns using Utils.parseDateFlex if available
    const parseDate = (val)=>{
      if (val instanceof Date) return val;
      if (global.App?.Utils?.parseDateFlex){
        return global.App.Utils.parseDateFlex(val) || new Date(val);
      }
      return new Date(val);
    };

    const currency = (function pickCur(){
      for (const r of selectedRows){
        const cell = String(feeIdx>=0 ? (r[H[feeIdx]] ?? '') : '');
        let cur = cell.replace(/[0-9.,\-\s\u00A0]/g,'').trim().toUpperCase();
        if (/EGP|LE|ج|جنيه/.test(cur)) return 'EGP';
        if (cur) return cur;
      }
      return '';
    })();

    let totalFee = 0;
    const parts = [];
    const lines = [];

    rowsForDetails.forEach(r=>{
      const start = startIdx>=0 ? parseDate(r[H[startIdx]]) : null;
      const end   = endIdx>=0   ? parseDate(r[H[endIdx]])   : null;
      const before = beforeIdx>=0 ? (isNaN(Utils.toNumber(r[H[beforeIdx]])) ? 0 : Utils.toNumber(r[H[beforeIdx]])) : 0;
      const after  = afterIdx>=0 ? (isNaN(Utils.toNumber(r[H[afterIdx]])) ? 0 : Utils.toNumber(r[H[afterIdx]]))  : 0;
      const feeVal= feeIdx>=0   ? Number((r[H[feeIdx]]||'').toString().replace(/[^0-9\.-]/g,'')) : 0;

      totalFee += feeVal; if (feeVal) parts.push(feeVal);

      let timeText = 'في ';
      if (start && end && sameDay(start,end)){
        if (start.getTime() === end.getTime()) {
          timeText += `${start.toLocaleDateString('ar-EG')} – ${timeArabic(start)}`;
        } else {
          timeText += `${start.toLocaleDateString('ar-EG')}: من ${timeArabic(start)} إلى ${timeArabic(end)}`;
        }
      } else if (start && end){
        timeText += `من ${start.toLocaleDateString('ar-EG')} ${timeArabic(start)} إلى ${end.toLocaleDateString('ar-EG')} ${timeArabic(end)}`;
      } else if (start){
        timeText += `${start.toLocaleDateString('ar-EG')} – ${timeArabic(start)}`;
      } else {
        timeText = '';
      }

      const reason = ((Utils && Utils.deductionReason) ? Utils.deductionReason(H, r) : (offeringIdx>=0?String(r[H[offeringIdx]]||'').trim():''));
      let reasonTxt = reason ? ` وسبب الخصم: ${reason}` : '';

      const beforeTxt = beforeIdx>=0 ? Math.abs(before).toLocaleString() : "—";
      const feeTxt    = feeIdx>=0 ? (Math.abs(feeVal).toLocaleString() + (currency?(' '+currency):'')) : "—";
      const afterTxt  = afterIdx>=0 ? Math.abs(after).toLocaleString() : "—";

      const line = `${timeText} رصيدك كان ${beforeTxt} واتخصم منو ${feeTxt} والمتبقى ${afterTxt}${reasonTxt}`;
      lines.push('<span class="br-line" data-row-id="'+r._id+'" data-row-key="'+((Utils&&Utils.computeRowKey)?Utils.computeRowKey(H,r):'')+'"><span class="br-jump" title="اذهب للأصل">↪</span> '+ line + '</span>');
    });

    const totalTxt = (feeIdx>=0 ? Math.abs(totalFee).toLocaleString(undefined,{maximumFractionDigits:2}) + (currency?(' '+currency):'') : "—");
    const partsTxt = (feeIdx>=0 && parts.length) ? `<div class="small-muted">تفصيل الرسوم: (${parts.map(n=>Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2})).join(' + ')})</div>` : '';

    const feeVals = rowsForDetails.map(r=>{ try{ return feeIdx>=0 ? toNumber(String(r[H[feeIdx]]||'')) : 0; }catch(e){ return 0; } });
    const feeChipsHtml = buildValueChips(feeVals, rowsForDetails, { label: 'تفصيل الرسوم', dir: 'ltr' });

    // Hide the verbose lines/parts by default (do NOT remove), to avoid breaking upstream details.
    // User can toggle visibility.
    box.innerHTML = `
      <h6>تفاصيل الاستهلاك حسب الاختيار</h6>
      <div class="break-row">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="kv mt-2">
            <span class="tag">إجمالي الرسوم: ${totalTxt}</span>
            <span class="tag">عدد العمليات: ${rowsForDetails.length}</span>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="BALANCE_ONLY">إظهار التفاصيل</button>
        </div>
        ${feeChipsHtml}
        <div id="det-BALANCE_ONLY" class="preserve-details d-none">
          ${partsTxt ? partsTxt.replace('<div class="small-muted">','<div class="small-muted preserve-details">') : ''}
          <div class="small-muted mt-1 preserve-details">` + lines.join(' + ') + `</div>
        </div>
      </div>`;

    // Enable clickable fee chips
    try{ bindFeeChipClicks(box); }catch(_){ }

    // Bind toggle for this simple section
    try {
      const btn = box.querySelector('[data-toggle-details="BALANCE_ONLY"]');
      if (btn && !btn.__bound){
        btn.__bound = true;
        btn.addEventListener('click', ()=>{
          const det = document.getElementById('det-BALANCE_ONLY');
          if (!det) return;
          const hidden = det.classList.contains('d-none');
          det.classList.toggle('d-none');
          btn.textContent = hidden ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
        });
      }
    } catch(_){ }
  }


  
  function renderSelectedBreakdownAll(){
    const box = document.getElementById('consumptionBreakdown');
    if (!box) return;

    const H = State.headers;

    // ---------------------------------------------------------------------
    // V12 (Clean Architecture): ALL breakdown is now driven by a provider registry.
    // - Built-in providers (BONUS / BALANCE / FREE_UNITS) + any custom providers
    // - Custom providers can be added via App.Config.ALL_SECTIONS_EXT or App.Rules.register()
    // - UI and behavior remain identical to previous V11 build (Hide, don't Delete).
    // ---------------------------------------------------------------------

    const norm = s => String(s||"").toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,"").trim();
    const findByWords = (words)=>{
      const w = (words||[]).map(x=> norm(x));
      for (let i=0;i<H.length;i++){
        const h = norm(H[i]);
        let ok = true;
        for(const x of w){ if(!h.includes(x)){ ok=false; break; } }
        if (ok) return i;
      }
      return -1;
    };

    const toNumber = (v)=>{
      if (v===null || v===undefined) return 0;
      if (typeof v === 'number') return isFinite(v)?v:0;
      const s = String(v).trim();
      if (!s) return 0;
      const n = Number(s.replace(/[^0-9\.\-]/g,''));
      return isFinite(n)?n:0;
    };

    const sameDay = (a,b)=>{
      try{
        if (!a || !b || !a.getFullYear || !b.getFullYear) return false;
        return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
      }catch(_){ return false; }
    };

    const timeArabic = (d)=>{
      try{
        if (!d || !d.getHours) return '';
        const h = d.getHours();
        const m = String(d.getMinutes()).padStart(2,'0');
        return `${h}:${m}`;
      }catch(_){ return ''; }
    };

    const parseDate = (val)=>{
      try{
        if (!val) return null;
        if (val instanceof Date) return val;
        if (global.App?.Utils?.parseDateFlex){
          return global.App.Utils.parseDateFlex(val) || new Date(val);
        }
        return new Date(val);
      }catch(_){ return null; }
    };

    // ----------------------------- Generic section renderer (extensions) ---
    const __escapeHtml = (window.App && window.App.Utils && window.App.Utils.escapeHTML)
      ? window.App.Utils.escapeHTML
      : function(x){ return String(x==null?'':x); };

    function __renderGenericAllSection(boxEl, meta){
      try{
        const key   = String(meta.key || '').trim();
        const label = String(meta.label || key || 'قسم جديد');
        const agg   = meta.agg || {};
        const totalFee = (agg.totalFee!==undefined && agg.totalFee!==null) ? agg.totalFee : null;
        const totalUnits = (agg.totalUnits!==undefined && agg.totalUnits!==null) ? agg.totalUnits : null;
        const lines = Array.isArray(agg.details) ? agg.details : (Array.isArray(agg.lines) ? agg.lines : []);

        const id = 'SEL_' + (key || ('EXT_' + Math.random().toString(16).slice(2))).replace(/[^A-Z0-9_]/gi,'_').toUpperCase();

        const sec = document.createElement('div');
        sec.className = 'break-row';
        sec.innerHTML = `
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div class="fw-bold">${__escapeHtml(label)}</div>
              ${ (meta.explain) ? `<div class="small-muted">${__escapeHtml(meta.explain)}</div>` : ``}
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="${id}">إظهار التفاصيل</button>
          </div>
          <div class="kv mt-2">
            ${ (totalFee!==null)   ? `<div class="small-muted">إجمالي الخصم: ${Math.abs(Number(totalFee)||0).toLocaleString()}</div>` : ``}
            ${ (totalUnits!==null) ? `<div class="small-muted">الإجمالي: ${Math.abs(Number(totalUnits)||0).toLocaleString()}</div>` : ``}
          </div>
          <div class="mt-2 details-box"></div>
        `;
        boxEl.appendChild(sec);

        const btn = sec.querySelector('[data-toggle-details]');
        const listHost = sec.querySelector('.details-box');

        // render lines hidden by default (matching the current UI behavior)
        lines.forEach(function(line){
          try{
            const text = String(line || '').trim();
            if (!text) return;
            const el = document.createElement('div');
            el.className = 'br-line d-none';
            el.innerHTML = __escapeHtml(text);
            listHost.appendChild(el);
          }catch(_){}
        });

        // toggle
        try{
          if (btn && !btn.__bound){
            btn.__bound = true;
            btn.addEventListener('click', ()=>{
              try{
                const hidden = listHost.querySelector('.br-line.d-none') ? true : false;
                listHost.querySelectorAll('.br-line').forEach(function(x){
                  try{ x.classList.toggle('d-none', !hidden); }catch(_){}
                });
                btn.textContent = hidden ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
              }catch(_){}
            });
          }
        }catch(_){}
      }catch(_){}
    }

    // ----------------------------- Built-in section shell -------------------
    // Keep details in DOM but hidden by default (Hide, don't Delete).
    const renderSection = (label, explain, id, rows) => {
      if (!rows || !rows.length) return '';
      return `
        <div class="break-row">
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div class="fw-bold">${label}</div>
              <div class="small-muted">${explain}</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="${id}">إظهار التفاصيل</button>
          </div>
          <div class="chips-host" id="chips-${id}"></div>
          <div id="det-${id}" class="preserve-details d-none">
            <div class="br-rows mt-2 preserve-details" id="rows-${id}"></div>
          </div>
        </div>`;
    };

    // ----------------------------- Selection -------------------------------
    const selected = State.rows.filter(r => State.selected.has(r._id));

    // configs for fee/comment materialisation (BONUS/BALANCE)
    const cfgBonus = {
      startIdx: findByWords(['start','time']),
      endIdx:   findByWords(['end','time']),
      beforeIdx:findByWords(['total','promotional','balance','before']),
      afterIdx: findByWords(['total','promotional','balance','after']),
      feeIdx:   findByWords(['total','promotional','fee']),
      offeringIdx: findByWords(['offering','name'])
    };

    const cfgBalance = {
      startIdx: findByWords(['start','time']),
      endIdx:   findByWords(['end','time']),
      beforeIdx:findByWords(['balance','before']),
      afterIdx: findByWords(['balance','after']),
      feeIdx:   findByWords(['total','fee']),
      offeringIdx: findByWords(['offering','name'])
    };

    // ----------------------------- Providers registry -----------------------
    const providers = [];
    const Utils = (window.App && window.App.Utils) ? window.App.Utils : null;
    const Rules = (window.App && window.App.Rules) ? window.App.Rules : null;

    // Built-in: BONUS
    providers.push({
      key: 'BONUS',
      sectionId: 'SEL_BONUS',
      getRows(){
        // keep legacy behavior (deductFrom === bonus)
        return selected.filter(r => String(r.deductFrom||'').trim().toLowerCase()==='bonus');
      },
      buildHTML(rows){
        return renderSection('سلفنى (Bonus)', 'حالات Bonus الخالصة فقط (بدون أي إضافات).', 'SEL_BONUS', rows);
      },
      afterRender(boxEl, rows){
        if (!rows || !rows.length) return;

        // Fee chips and hidden details lines (full text + reason/comment)
        const parts = rows.map(r=>{
          const v = (cfgBonus && typeof cfgBonus.feeIdx === 'number' && cfgBonus.feeIdx >= 0) ? r[H[cfgBonus.feeIdx]] : 0;
          return toNumber(v);
        });

        const detailFn = (r)=>{
          try{
            const start = parseDate(cfgBonus.startIdx>=0 ? r[H[cfgBonus.startIdx]] : r.startTime);
            const end   = parseDate(cfgBonus.endIdx>=0   ? r[H[cfgBonus.endIdx]]   : r.endTime);

            const startFull = (Utils && Utils.fmtArabicDT) ? Utils.fmtArabicDT(start) : String(start||'');
            const endFull   = (Utils && Utils.fmtArabicDT) ? Utils.fmtArabicDT(end)   : String(end||'');

            let timeText = '';
            if (start && end && start.getTime && end.getTime && start.getTime()===end.getTime()){
              timeText = `فى توقيت ${startFull}`;
            } else if (sameDay(start, end)){
              timeText = `من توقيت ${startFull} حتى توقيت ${timeArabic(end)}`;
            } else {
              timeText = `من توقيت ${startFull} حتى توقيت ${endFull}`;
            }

            const before = cfgBonus.beforeIdx>=0 ? toNumber(r[H[cfgBonus.beforeIdx]]) : 0;
            const after  = cfgBonus.afterIdx>=0  ? toNumber(r[H[cfgBonus.afterIdx]])  : 0;
            const feeCell = cfgBonus.feeIdx>=0 ? String(r[H[cfgBonus.feeIdx]]||'') : '';
            const feeVal  = toNumber(feeCell);

            let currency = '';
            try{
              const cur = feeCell.replace(/[0-9.,\s\u00A0-]/g,'').trim().toUpperCase();
              if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP'; else if (cur) currency = cur;
            }catch(_){ }

            const reason = ((Utils && Utils.deductionReason)
              ? Utils.deductionReason(H, r)
              : (cfgBonus.offeringIdx>=0 ? String(r[H[cfgBonus.offeringIdx]]||'').trim() : ''));

            const offeringTxt = (Utils && Utils.breakdownComment)
              ? Utils.breakdownComment(H, r, 'BONUS', { reason: reason })
              : (reason ? ` وسبب الخصم: ${reason}` : '');

            const beforeTxt = cfgBonus.beforeIdx>=0 ? Math.abs(before).toLocaleString() : '—';
            const afterTxt  = cfgBonus.afterIdx>=0  ? Math.abs(after).toLocaleString()  : '—';
            const feeTxt    = cfgBonus.feeIdx>=0    ? (Math.abs(feeVal).toLocaleString(undefined,{maximumFractionDigits:2}) + (currency?(' '+currency):'')) : '—';

            return `${timeText} رصيدك كان ${beforeTxt} واتخصم منو ${feeTxt} والمتبقى ${afterTxt}${offeringTxt}`;
          }catch(e){ return ''; }
        };

        try{ materializeFeeDetails('SEL_BONUS', parts, rows, detailFn); }catch(_){}
        try{
          const ch = document.getElementById('chips-SEL_BONUS');
          if (ch) ch.innerHTML = buildValueChips(parts, rows, { label: 'تفصيل الرسوم', dir: 'ltr' });
        }catch(_){}
      }
    });

    // Built-in: BALANCE
    providers.push({
      key: 'BALANCE',
      sectionId: 'SEL_BALANCE',
      getRows(){
        // keep legacy behavior (balance but not free)
        return selected.filter(r => {
          const v = String(r.deductFrom||'').trim().toLowerCase();
          return v.includes('balance') && !v.includes('free');
        });
      },
      buildHTML(rows){
        return renderSection('سحب من الرصيد', 'تم السحب من الرصيد فقط دون استهلاك وحدات مجانية.', 'SEL_BALANCE', rows);
      },
      afterRender(boxEl, rows){
        if (!rows || !rows.length) return;

        const parts = rows.map(r=>{
          const v = (cfgBalance && typeof cfgBalance.feeIdx === 'number' && cfgBalance.feeIdx >= 0) ? r[H[cfgBalance.feeIdx]] : 0;
          return toNumber(v);
        });

        const detailFn = (r)=>{
          try{
            const start = parseDate(cfgBalance.startIdx>=0 ? r[H[cfgBalance.startIdx]] : r.startTime);
            const end   = parseDate(cfgBalance.endIdx>=0   ? r[H[cfgBalance.endIdx]]   : r.endTime);

            const startFull = (Utils && Utils.fmtArabicDT) ? Utils.fmtArabicDT(start) : String(start||'');
            const endFull   = (Utils && Utils.fmtArabicDT) ? Utils.fmtArabicDT(end)   : String(end||'');

            let timeText = '';
            if (start && end && start.getTime && end.getTime && start.getTime()===end.getTime()){
              timeText = `فى توقيت ${startFull}`;
            } else if (sameDay(start, end)){
              timeText = `من توقيت ${startFull} حتى توقيت ${timeArabic(end)}`;
            } else {
              timeText = `من توقيت ${startFull} حتى توقيت ${endFull}`;
            }

            const before = cfgBalance.beforeIdx>=0 ? toNumber(r[H[cfgBalance.beforeIdx]]) : 0;
            const after  = cfgBalance.afterIdx>=0  ? toNumber(r[H[cfgBalance.afterIdx]])  : 0;
            const feeCell = cfgBalance.feeIdx>=0 ? String(r[H[cfgBalance.feeIdx]]||'') : '';
            const feeVal  = toNumber(feeCell);

            let currency = '';
            try{
              const cur = feeCell.replace(/[0-9.,\s\u00A0-]/g,'').trim().toUpperCase();
              if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP'; else if (cur) currency = cur;
            }catch(_){ }

            const reason = ((Utils && Utils.deductionReason)
              ? Utils.deductionReason(H, r)
              : (cfgBalance.offeringIdx>=0 ? String(r[H[cfgBalance.offeringIdx]]||'').trim() : ''));

            const offeringTxt = (Utils && Utils.breakdownComment)
              ? Utils.breakdownComment(H, r, 'BALANCE', { reason: reason })
              : (reason ? ` وسبب الخصم: ${reason}` : '');

            const beforeTxt = cfgBalance.beforeIdx>=0 ? Math.abs(before).toLocaleString() : '—';
            const afterTxt  = cfgBalance.afterIdx>=0  ? Math.abs(after).toLocaleString()  : '—';
            const feeTxt    = cfgBalance.feeIdx>=0    ? (Math.abs(feeVal).toLocaleString(undefined,{maximumFractionDigits:2}) + (currency?(' '+currency):'')) : '—';

            return `${timeText} رصيدك كان ${beforeTxt} واتخصم منو ${feeTxt} والمتبقى ${afterTxt}${offeringTxt}`;
          }catch(e){ return ''; }
        };

        try{ materializeFeeDetails('SEL_BALANCE', parts, rows, detailFn); }catch(_){}
        try{
          const ch = document.getElementById('chips-SEL_BALANCE');
          if (ch) ch.innerHTML = buildValueChips(parts, rows, { label: 'تفصيل الرسوم', dir: 'ltr' });
        }catch(_){}
      }
    });

    // Built-in: FREE_UNITS (units-only) - uses rule.summarize to keep current text formatting
    providers.push({
      key: 'FREE_UNITS',
      sectionId: 'SEL_UNITS',
      getRows(){
        return selected.filter(r => String(r.deductFrom||'').toLowerCase().includes('free'));
      },
      buildHTML(rows){
        if (!rows || !rows.length) return '';
        let html = '';
        try{
          const ruleUnits = (Rules && Rules.list) ? Rules.list.find(r => r.key === 'FREE_UNITS') : null;
          if (!ruleUnits || typeof ruleUnits.summarize !== 'function') return '';
          const sumU = ruleUnits.summarize(rows, { State, Utils });
          const totalUnitsTxt = (sumU.totalUnits||0).toLocaleString(undefined,{maximumFractionDigits:2});
          const unitsSecId = 'SEL_UNITS';
          html += `<div class="break-row"><div class="d-flex align-items-center justify-content-between gap-2">
            <div><div class="fw-bold">استهلاك وحدات</div><div class="small-muted">تم استهلاك وحدات فقط دون خصم من الرصيد</div></div>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle-details="${unitsSecId}">إظهار التفاصيل</button>
          </div>
          <div class="kv mt-2"><span class="tag">إجمالي الوحدات: ${totalUnitsTxt}</span><span class="tag">عدد العمليات: ${rows.length}</span></div>
          <div class="chips-host" id="chips-${unitsSecId}"></div>
          <div id="det-${unitsSecId}" class="preserve-details d-none">
            <div class="br-rows mt-2 preserve-details" id="rows-${unitsSecId}">`;
          const details = Array.isArray(sumU.details) ? sumU.details : [];
          for (let i=0;i<rows.length;i++){
            const r = rows[i];
            const txtLine = details[i] || '';
            const rid = r && r._id;
            if (rid != null){
              html += `<div class="br-line" data-row-id="${rid}" data-detail="${__escapeHtml(txtLine)}"><span class="br-jump" title="اذهب للأصل">↪</span> ${__escapeHtml(txtLine)}</div>`;
            } else {
              html += `<div class="br-line" data-detail="${__escapeHtml(txtLine)}">${__escapeHtml(txtLine)}</div>`;
            }
          }
          html += `</div></div></div>`;
        }catch(e){ console.warn('units section failed', e); }
        return html;
      },
      afterRender(boxEl, rows){
        // Units chips
        try{
          const chU = document.getElementById('chips-SEL_UNITS');
          if (chU) {
            const unitHeader = (State.unitIdx>=0 ? H[State.unitIdx] : null);
            const valsU = unitHeader ? rows.map(r=>{ try{ return toNumber(r[unitHeader]); }catch(e){ return 0; } }) : [];
            chU.innerHTML = buildValueChips(valsU, rows, { label: 'تفصيل الوحدات', dir: 'ltr' });
          }
        }catch(_){}
      }
    });

    // Extensions (Config.ALL_SECTIONS_EXT): appended sections, but part of the same provider loop
    try{
      const C = (window.App && window.App.Config) ? window.App.Config : {};
      const ext = Array.isArray(C.ALL_SECTIONS_EXT) ? C.ALL_SECTIONS_EXT : [];
      ext.forEach(function(sec){
        try{
          if (!sec) return;
          const key = String(sec.key || sec.id || '').trim() || ('EXT_' + Math.random().toString(16).slice(2)).toUpperCase();
          providers.push({
            key: key,
            getRows(){
              try{
                if (typeof sec.rowsFilter === 'function') return sec.rowsFilter(selected, H) || [];
                if (typeof sec.matches === 'function') return selected.filter(r=>{ try{ return sec.matches(r, H); }catch(e){ return false; } });
                return [];
              }catch(_){ return []; }
            },
            append(boxEl, rows){
              if (!rows || !rows.length) return;
              try{
                if (typeof sec.render === 'function'){
                  sec.render(boxEl, rows, { headers: H, toNumber: toNumber });
                  return;
                }
                if (typeof sec.aggregate === 'function'){
                  const agg = sec.aggregate(rows, H) || {};
                  __renderGenericAllSection(boxEl, { key: key, label: sec.label || key, rows: rows, agg: agg, explain: sec.explain });
                }
              }catch(_){}
            }
          });
        }catch(_){}
      });
    }catch(_){}

    // Rules-based providers (App.Rules.list) for any additional rule beyond the built-ins
    try{
      if (Rules && Array.isArray(Rules.list)){
        Rules.list.forEach(function(rule){
          try{
            if (!rule || !rule.key) return;
            const key = String(rule.key).trim();
            if (key === 'BONUS' || key === 'BALANCE' || key === 'FREE_UNITS') return; // already handled
            providers.push({
              key: key,
              getRows(){
                try{
                  if (typeof rule.matches === 'function') return selected.filter(r=>{ try{ return rule.matches(r); }catch(e){ return false; } });
                  return [];
                }catch(_){ return []; }
              },
              append(boxEl, rows){
                if (!rows || !rows.length) return;
                try{
                  if (typeof rule.renderAll === 'function'){
                    rule.renderAll(boxEl, rows, { headers: H, toNumber: toNumber });
                    return;
                  }
                  if (typeof rule.aggregate === 'function'){
                    const agg = rule.aggregate(rows, H) || {};
                    __renderGenericAllSection(boxEl, { key: key, label: rule.label || key, rows: rows, agg: agg });
                  }
                }catch(_){}
              }
            });
          }catch(_){}
        });
      }
    }catch(_){}

    // ----------------------------- Render (single loop) ---------------------
    let html = '<h6>تفاصيل الاستهلاك حسب الاختيار</h6>';

    const rowsByKey = {};
    let hasAny = false;

    providers.forEach(function(p){
      try{
        const rows = (p && typeof p.getRows === 'function') ? (p.getRows() || []) : [];
        rowsByKey[p.key] = rows;
        if (rows && rows.length){
          if (typeof p.buildHTML === 'function'){
            const secHtml = p.buildHTML(rows) || '';
            if (secHtml) {
              hasAny = true;
              html += secHtml;
            }
          } else if (typeof p.append === 'function') {
            // appended later, but counts toward having content
            hasAny = true;
          }
        }
      }catch(_){}
    });

    if (!hasAny){
      box.innerHTML = '<div class="small-muted">لا توجد تفاصيل ضمن التحديد الحالي.</div>';
      return;
    }

    box.innerHTML = html;

    // Common bindings: jump links + row detail open (existing behavior)
    try{ bindFeeChipClicks(box); }catch(_){}

    // Toggle details (Hide/Show only)
    try{
      const btns = box.querySelectorAll('[data-toggle-details]');
      btns.forEach(btn=>{
        if (btn.__bound) return;
        btn.__bound = true;
        btn.addEventListener('click', ()=>{
          const id = btn.getAttribute('data-toggle-details');
          const det = document.getElementById('det-'+id);
          if (det){
            const hidden = det.classList.contains('d-none');
            det.classList.toggle('d-none');
            btn.textContent = hidden ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
            return;
          }
          // Generic sections (no det- wrapper)
          try{
            const host = btn.closest('.break-row')?.querySelector('.details-box');
            if (!host) return;
            const hidden2 = host.querySelector('.br-line.d-none') ? true : false;
            host.querySelectorAll('.br-line').forEach(function(x){
              try{ x.classList.toggle('d-none', !hidden2); }catch(_){}
            });
            btn.textContent = hidden2 ? 'إخفاء التفاصيل' : 'إظهار التفاصيل';
          }catch(_){}
        });
      });
    }catch(_){}

    // Providers post-render (chips + hidden details + appended sections)
    providers.forEach(function(p){
      try{
        const rows = rowsByKey[p.key] || [];
        if (!rows || !rows.length) return;
        if (typeof p.afterRender === 'function') p.afterRender(box, rows);
      }catch(_){}
    });

    providers.forEach(function(p){
      try{
        const rows = rowsByKey[p.key] || [];
        if (!rows || !rows.length) return;
        if (typeof p.append === 'function') p.append(box, rows);
      }catch(_){}
    });
  }


  
  // Global delegation: click on any .br-line jumps to the original row
  function handleBrLineClick(ev){
    const jump = ev.target.closest('.br-jump');
    if (!jump) return;
    const line = jump.closest('.br-line');
    if (!line) return;
    if (!window.State) window.State = {};
    if (State.navBusy) return;
    const Store = global.App && global.App.Store;
    if (Store && typeof Store.dispatch === 'function') {
      Store.dispatch({ patch: { navBusy: true } });
    } else {
      State.navBusy = true;
    }

    jump.classList.add('loading');
    const oldIcon = jump.textContent;
    jump.textContent = '⏳';
    line.classList.add('br-active');

    const idSel = line.getAttribute('data-row-id');
    const keySel = line.getAttribute('data-row-key');
    const ref = idSel || keySel;
    const detailText = line.getAttribute('data-detail') || line.textContent.replace(/^↪\s*/, '').trim();
    const stamp = new Date();

    goToRow(ref, { fallback: (ev && (ev.altKey || ev.ctrlKey || ev.metaKey)) ? true : false }).then((ok)=>{
      // Always try by ID first for appending, so duplicates go under their exact origin
      let tr = null;
      if (idSel) tr = document.querySelector(`#dataTable tbody tr[data-row-id="${idSel}"]`);
      if (!tr) tr = document.querySelector('#dataTable tbody tr.row-target');
      if (!tr && keySel) tr = document.querySelector('#dataTable tbody tr[data-row-key]'); // last resort

      if (tr && tr.parentElement){
        // Ensure a persistent compare row exists
        let cmp = tr.nextElementSibling;
        if (!(cmp && cmp.classList && cmp.classList.contains('row-compare'))){
          cmp = document.createElement('tr');
          cmp.className = 'row-compare';
          const td = document.createElement('td');
          td.colSpan = tr.children.length;
          const wrap = document.createElement('div');
          wrap.className = 'cmp-wrap';
          const list = document.createElement('div');
          list.className = 'cmp-list';
          wrap.appendChild(list); td.appendChild(wrap); cmp.appendChild(td);
          tr.after(cmp);
        }
        const list = cmp.querySelector('.cmp-list') || (function(){ const l=document.createElement('div'); l.className='cmp-list'; cmp.querySelector('td').appendChild(l); return l; })();
        // Append a new item (even if duplicate)
        const item = document.createElement('div');
item.className = 'cmp-item';

// زر نسخ هادي (بدون أى ردة فعل أو سكرول)
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'copy-row-btn';
btn.textContent = 'نسخ';
btn.title = 'نسخ تفاصيل السطر';

const text = document.createElement('span');
text.className = 'cmp-text';
text.textContent = detailText || '';

// امنع الفوكس/السكرول قبل حدوثه
btn.addEventListener('pointerdown', function(ev){ if (ev){ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }}, true);
btn.addEventListener('mousedown', function(ev){ if (ev){ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }}, true);

// النسخ بدون أى تغيير مرئي
btn.addEventListener('click', function(ev){
  const markCopied = ()=>{ try{ btn.classList.add('copied'); setTimeout(()=>btn.classList.remove('copied'), 900);}catch(e){} };
  if (ev){ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }
  try{
    const textToCopy = (detailText || '').trim() || text.textContent.trim();
    Utils.copyToClipboard(textToCopy).then(function(ok2){ if(ok2) markCopied(); });
  }catch(err){ /* silent */ }
}, true);

// ترتيب العناصر: [زر النسخ] [نص التفاصيل]
item.appendChild(btn);
item.appendChild(text);
list.appendChild(item);
      }
    }).finally(()=>{
      jump.classList.remove('loading');
      jump.textContent = oldIcon || '↪';
      const Store = global.App && global.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        Store.dispatch({ patch: { navBusy: false } });
      } else {
        State.navBusy = false;
      }
    });
  }
  document.addEventListener('click', handleBrLineClick);

// Expose minimal internals for modular view files (keeps core stable while splitting view.js gradually)
try{
  global.App = global.App || {};
  
  var __ex = global.App.ViewInternals || {};
  // Preserve any modules that already registered functions (e.g., header_filters.js)
  global.App.ViewInternals = Object.assign(__ex, {
    ensureTopToolbar: (__ex.ensureTopToolbar && typeof __ex.ensureTopToolbar === 'function') ? __ex.ensureTopToolbar
      : ((typeof ensureTopToolbar === 'function') ? ensureTopToolbar : function(){}),
    ensureRowDelegation: (__ex.ensureRowDelegation && typeof __ex.ensureRowDelegation === 'function') ? __ex.ensureRowDelegation
      : ((typeof ensureRowDelegation === 'function') ? ensureRowDelegation : function(){}),
    escapeHTML: (__ex.escapeHTML && typeof __ex.escapeHTML === 'function') ? __ex.escapeHTML
      : ((typeof escapeHTML === 'function') ? escapeHTML : function(s){ return String(s||''); }),
    __hf_openMenu: (__ex.__hf_openMenu && typeof __ex.__hf_openMenu === 'function') ? __ex.__hf_openMenu
      : ((typeof __hf_openMenu === 'function') ? __hf_openMenu : function(){}),
    applyHeaderFilters: (__ex.applyHeaderFilters && typeof __ex.applyHeaderFilters === 'function') ? __ex.applyHeaderFilters
      : ((typeof applyHeaderFilters === 'function') ? applyHeaderFilters : function(){ return Array.isArray(State.view) ? State.view : (Array.isArray(State.rows) ? State.rows : []); }),
    computeRowKey: (__ex.computeRowKey && typeof __ex.computeRowKey === 'function') ? __ex.computeRowKey
      : ((typeof computeRowKey === 'function') ? computeRowKey : function(){ return ''; }),
    markGood: (__ex.markGood && typeof __ex.markGood === 'function') ? __ex.markGood
      : ((typeof markGood === 'function') ? markGood : function(){}),
    normalizeHeader: (__ex.normalizeHeader && typeof __ex.normalizeHeader === 'function') ? __ex.normalizeHeader
      : ((typeof normalizeHeader === 'function') ? normalizeHeader : function(s){ return String(s||'').trim().toLowerCase(); })
  });
}catch(_){}
  // Safe wrappers (Auto-Recover friendly)
  // NOTE: Table module provides App.View._renderTableRaw. We wrap it safely without overwriting it.
  var __rawRenderTable = (global.App && global.App.View && typeof global.App.View._renderTableRaw === 'function')
    ? global.App.View._renderTableRaw
    : function(){ return undefined; };

  function renderTableSafe(){
    try{
      if (global.App && global.App.Recover && typeof global.App.Recover.withRecovery === 'function'){
        return global.App.Recover.withRecovery('renderTable', __rawRenderTable);
      }
      return __rawRenderTable();
    }catch(e){
      try{ if (global.App && global.App.Recover) global.App.Recover.handle('renderTable', e); }catch(_){ }
      throw e;
    }
  }

  // Publish stable View API without clobbering existing raw renderer
  try{
    global.App = global.App || {};
    global.App.View = Object.assign(global.App.View || {}, {
      renderTable: renderTableSafe,
      updateSumSelected: updateSumSelected,
      renderConsumptionBreakdown: renderConsumptionBreakdown,
      renderBonusBreakdown: renderBonusBreakdown
    });
  }catch(_){ }
})(window);

function __clearCacheOnReset(e){
  try{
    var t = e.target;
    if (!t) return;
    var txt = (t.textContent||'').toLowerCase();
    if (/reset\s*table/i.test(txt) || /reset/i.test(t.id||'')){
      if (State && State.detailCache){ State.detailCache.clear(); }
    }
  }catch(_){}
}
document.addEventListener('click', __clearCacheOnReset, true);