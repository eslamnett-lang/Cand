(function(global){
  'use strict';
  global.App = global.App || {};
  var App = global.App;
  var State = App.State;
  if (!State) { throw new Error('State is not available'); }

  // ===== Header Filters (Excel-like) — extracted from view.js for maintainability =====
// ===== Header Filters (Excel-like) =====
State.headerFilters = State.headerFilters || {}; // { headerName: { query: '', selected: Set([...]) } }
State.viewFiltered = State.viewFiltered || null;
  // Global date-time range (applies across Start/End columns together)
  State.rangeFilter = State.rangeFilter || { from: null, to: null };
    
  State.timeWindow = State.timeWindow || { from: null, to: null };

function __hf_isActive(f){ return f && ((f.query && f.query.trim()) || (f.selected && f.selected.size) || (f.dtFrom || f.dtTo)); }

function __hf_normalize(v){ return String(v==null?'':v).trim(); }

function __hf_rangeMatch(row){
      try{

        const norm = s => String(s||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'').trim();
        const H = State.headers || [];
        let colStart = null, colEnd = null;
        for (const h of H){ const n=norm(h); if (n==='starttime') colStart=h; if (n==='endtime') colEnd=h; }
        const from = State.rangeFilter?.from ? new Date(State.rangeFilter.from) : null;
        const to   = State.rangeFilter?.to   ? new Date(State.rangeFilter.to)   : null;
        if (!from && !to) return true; // no range set
        const ds = colStart ? __hf_parseDate(row[colStart]) : null;
        const de = colEnd   ? __hf_parseDate(row[colEnd])   : null;
        // if both present -> overlap logic
        if (ds && de){
          if (from && de < from) return false;
          if (to   && ds > to)   return false;
          return true;
        }
        // else, use whichever exists as point-in-time
        const d = ds || de;
        if (!d) return false;
        if (from && d < from) return false;
        if (to   && d > to)   return false;
        return true;
      
      }catch(e){
        try{
          const from = State.rangeFilter && State.rangeFilter.from;
          const to   = State.rangeFilter && State.rangeFilter.to;
          return !(from || to); // if range active => exclude on error
        }catch(_){ return false; }
      }
    }
    
function __hf_applyToRows(rows, filtersIn){
  try{
    const filters = filtersIn || (State && State.headerFilters) || {};
    const activeKeys = Object.keys(filters||{}).filter(k => __hf_isActive(filters[k]));
    const norm = __hf_normalize;
    return (rows||[]).filter(r => {
      if (!__hf_rangeMatch(r)) return false;
      for (const h of activeKeys){
        const f = filters[h];
        const cell = norm(r[h]);
        // Date sub-range per column
        if (f && (f.dtFrom || f.dtTo)){
          const d = __hf_parseDate(cell);
          if (!d) return false;
          if (f.dtFrom){ const from = new Date(f.dtFrom); if (d < from) return false; }
          if (f.dtTo){   const to   = new Date(f.dtTo);   if (d > to)   return false; }
          continue;
        }
        if (f && f.selected && f.selected.size){
          if (!f.selected.has(cell)) return false;
        } else if (f && f.query && f.query.trim()){
          const q = f.query.trim().toLowerCase();
          if (!cell.toLowerCase().includes(q)) return false;
        }
      }
      return true;
    });
  }catch(e){ console.warn('applyToRows failed', e); return rows||[]; }







}
function __hf_parseDate(v){
  try{
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return v;
    let s = String(v).trim();
    // replace line breaks / <br> with space
    s = s.replace(/<br\s*\/?>/ig, ' ').replace(/\s+/g,' ').trim();
    // Accept Arabic comma digits etc. Ensure slash separators stay
    // Pattern A: dd/MM/yyyy [HH:mm[:ss]]
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
    // Pattern B: [HH:mm[:ss]] dd/MM/yyyy (many CSVs put time first)
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
    // Try Utils.parseDateFlex then Date()
    if (global.App && global.App.Utils && typeof global.App.Utils.parseDateFlex === 'function'){
      const d = global.App.Utils.parseDateFlex(s);
      if (d && !isNaN(d)) return d;
    }
    const d2 = new Date(s);
    return (d2 && !isNaN(d2)) ? d2 : null;
  }catch(e){ return null; }
}



  
  function __hf_findSEHeaders(){
    const H = State.headers || [];
    const norm = (s)=> String(s||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'').trim();
    let hStart=null, hEnd=null;
    for (const h of H){
      const n = norm(h);
      if (n === 'starttime') hStart = h;
      if (n === 'endtime')   hEnd   = h;
    }
    return { hStart, hEnd };
  }

  function applyHeaderFilters(){
  const base = Array.isArray(State.view) ? State.view : (Array.isArray(State.rows) ? State.rows : []);
  const filtered = __hf_applyToRows(base);
  // Always update State.viewFiltered directly here. Dispatching from within this function can cause
  // recursive re-render loops because applyHeaderFilters() is invoked during renderTable(). Derived
  // state like viewFiltered does not need to travel through the Store – the bridge will be updated via sync.
  try {
    State.viewFiltered = filtered;
  } catch (_) {
    // ignore errors in debug mode
  }
  return filtered;
}

function __hf_ensureStyle(){
  if (document.getElementById('hf-style')) return;
  const st = document.createElement('style');
  st.id = 'hf-style';
  st.textContent = `
    .th-filter { cursor:pointer; margin-inline-start:.4rem; font-size:12px; opacity:.8; user-select:none; }
    th.filtered .th-filter { opacity:1; }
    #hf-menu { position:absolute; z-index:9999; background:#0d1b2a; color:#fff; border:1px solid #233; border-radius:10px; padding:.6rem; box-shadow:0 10px 30px rgba(0,0,0,.35); width:min(320px, 92vw); }
    #hf-menu h6 { margin:.2rem 0 .6rem; font-size:13px; font-weight:700; }
    #hf-menu .hf-titlebar{ display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    #hf-menu .hf-sum-btn{ cursor:pointer; border:1px solid #335; background:#132; color:#fff; width:30px; height:30px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-weight:800; }
    #hf-menu .hf-sum-btn[aria-pressed="true"]{ background:#225; border-color:#48f; }
#hf-menu .hf-modes{ display:inline-flex; align-items:center; gap:.35rem; }
#hf-menu .hf-mode-btn{ cursor:pointer; border:1px solid #335; background:#132; color:#fff; width:30px; height:30px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-weight:800; opacity:.85; }
#hf-menu .hf-mode-btn.active{ background:#225; border-color:#48f; opacity:1; }
#hf-menu .hf-mode-btn[disabled]{ opacity:.35; cursor:not-allowed; }
#hf-menu .hf-mini{ margin-inline-start:.5rem; font-size:11px; opacity:.85; }
    #hf-menu input[type="text"] { width:100%; padding:.35rem .5rem; border-radius:8px; border:1px solid #345; background:#102030; color:#fff; outline:none; }
    #hf-menu .vals { max-height:200px; overflow:auto; margin-top:.5rem; border:1px solid #1e2b3a; border-radius:8px; padding:.25rem .4rem; background:#0f1a26; }
    #hf-menu .vals label { display:flex; align-items:center; gap:.5rem; font-size:12px; padding:.15rem .2rem; cursor:pointer; }
    #hf-menu .vals label .hf-v{ flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #hf-menu .vals label .hf-t{ flex:0 0 auto; font-size:11px; opacity:.85; }
    #hf-menu .hf-sumbar{ display:none; margin-top:.45rem; padding:.35rem .45rem; border:1px solid #1e2b3a; border-radius:8px; background:#0f1a26; font-size:12px; }
    #hf-menu .hf-sumbar strong{ color:#6cf; }
    #hf-menu .hf-kind{ display:inline-flex; align-items:center; gap:.35rem; margin-inline-start:.6rem; }
    #hf-menu .hf-kind select{ background:#102030; color:#fff; border:1px solid #345; border-radius:8px; padding:.15rem .35rem; outline:none; }
    #hf-menu .hf-selectall{ display:none; align-items:center; gap:.5rem; margin-top:.45rem; font-size:12px; }
    #hf-menu .act { display:flex; justify-content:space-between; gap:.5rem; margin-top:.6rem; }
    #hf-menu button { border:1px solid #335; background:#132; color:#fff; padding:.35rem .6rem; border-radius:8px; cursor:pointer; }
    #hf-menu button.primary { background:#225; border-color:#48f; }
    #hf-menu .hint { font-size:11px; opacity:.8; margin-top:.25rem; }
  `;
  document.head.appendChild(st);
}

// ---- Header Filter: SUM mode for Balance/Usage/Unit columns ----
function __hf_normHeaderLite(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim(); }

function __hf_findHeaderByNorm(normName){
  try{
    const H = State.headers || [];
    const target = String(normName||'');
    for (const h of H){ if (__hf_normHeaderLite(h) === target) return h; }
  }catch(e){}
  return null;
}

function __hf_isSumEligibleHeader(headerName){
  // Show SUM feature for (almost) all filters, with explicit exclusions requested.
  const h = String(headerName||'');
  const nn = __hf_normHeaderLite(h);
  // Exclusions: these columns are descriptive text (no numeric meaning)
  if (nn === 'freeunitname') return false;
  if (nn === 'measureunit') return false;
  return true;
}

function __hf_guessNumericKind(headerName, rows){
  const n = String(headerName||'').toLowerCase();
  const sampleRows = (rows||[]).slice(0, 80);

  // For Usage/Unit: decide Bytes vs Seconds using Measure Unit column.
  // If we can't infer confidently, return 'unknown' and let user choose.
  if (n.includes('usage') || n.includes('unit')){
    const muHeader = __hf_findHeaderByNorm('measureunit') || 'Measure Unit';
    let bytesFound = false;
    let otherFound = false;
    for (const r of sampleRows){
      const mu = String((r && r[muHeader]) || '').toLowerCase().trim();
      if (!mu) continue;
      if (mu.includes('byte')) bytesFound = true;
      else otherFound = true;
      if (bytesFound && otherFound) break;
    }
    if (bytesFound && !otherFound) return 'bytes';
    if (!bytesFound && otherFound) return 'seconds';
    return 'unknown';
  }

  // For Balance/Total Fee (and similar money columns): try currency (LE/EGP)
  if (n.includes('balance') || n.includes('fee') || n.includes('amount') || n.includes('charge') || n.includes('cost') || n.includes('price')){
    for (const r of sampleRows){
      const v = String((r && r[headerName]) || '').toLowerCase();
      if (v.includes('le') || v.includes('egp')) return 'currency';
    }
    return 'currency';
  }

  // Generic fallback: if values contain LE/EGP treat as currency, otherwise number.
  for (const r of sampleRows){
    const v = String((r && r[headerName]) || '').toLowerCase();
    if (v.includes('le') || v.includes('egp')) return 'currency';
  }
  return 'number';
}

function __hf_parseNumberLoose(x){
  try{
    if (x == null) return 0;
    if (typeof x === 'number' && isFinite(x)) return x;
    let s = String(x);
    // Normalize Arabic digits if present
    s = s.replace(/[\u0660-\u0669]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    s = s.replace(/[\u06F0-\u06F9]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    // Remove thousand separators / non-number symbols but keep dot and minus
    s = s.replace(/,/g,'');
    const m = s.match(/-?\d+(?:\.\d+)?/g);
    if (!m) return 0;
    // If multiple numbers appear, take the first one (most cells are simple)
    return parseFloat(m[0]);
  }catch(e){ return 0; }
}


function __hf_parseCurrencyCents(x){
  // Parse to integer cents (piastres) to avoid floating errors in money sums.
  // Assumes currency values are at most 2 decimal places.
  try{
    const n = __hf_parseNumberLoose(x);
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }catch(e){ return 0; }
}

function __hf_fmtBytes(num){
  try{
    let n = Number(num||0);
    if (!isFinite(n)) n = 0;
    const abs = Math.abs(n);
    const units = ['B','KB','MB','GB','TB','PB'];
    let u = 0;
    while (u < units.length-1 && abs >= 1024 && abs/Math.pow(1024,u+1) >= 1) u++;
    const v = n / Math.pow(1024, u);
    const dec = (u===0) ? 0 : (Math.abs(v) >= 100 ? 1 : 2);
    return v.toFixed(dec) + ' ' + units[u];
  }catch(e){ return String(num||0); }
}

function __hf_fmtSecondsNearestMinute(sec){
  try{
    let s = Number(sec||0);
    if (!isFinite(s)) s = 0;
    const mins = Math.round(s/60);
    const h = Math.floor(mins/60);
    const m = mins % 60;
    if (h <= 0) return mins + ' دقيقة';
    if (m === 0) return h + ' ساعة';
    return h + ' ساعة ' + m + ' دقيقة';
  }catch(e){ return String(sec||0); }
}

function __hf_fmtCurrencyLE(num){
  try{
    let n = Number(num||0);
    if (!isFinite(n)) n = 0;
    return 'LE ' + n.toFixed(2);
  }catch(e){ return String(num||0); }
}

function __hf_formatSum(kind, num){
  if (kind === 'rows') {
    try{ return String(Math.round(Number(num||0))); }catch(e){ return '0'; }
  }
  if (kind === 'bytes') return __hf_fmtBytes(num);
  if (kind === 'seconds') return __hf_fmtSecondsNearestMinute(num);
  if (kind === 'currency') return __hf_fmtCurrencyLE(num);
  // number
  try{ return (Number(num||0)).toLocaleString(undefined, { maximumFractionDigits: 3 }); }catch(e){ return String(num||0); }
}

function __hf_openMenu(anchorEl, headerName){
  __hf_ensureStyle();
  const rect = anchorEl.getBoundingClientRect();
  const old = document.getElementById('hf-menu'); if (old) old.remove();
  const menu = document.createElement('div');
  menu.id = 'hf-menu';

  // Collect unique values (top 100)
  // Use the *currently visible* rows (after any active filters) so that
  // SUM mode + "Select All" operate on the filtered table, not the full dataset.
  const base = Array.isArray(State.viewFiltered)
    ? State.viewFiltered
    : (Array.isArray(State.view) ? State.view : (Array.isArray(State.rows) ? State.rows : []));
  // Filter list (unique values) stays as-is.
  const valuesUnique = [];
  try {
    const seen = new Set();
    for (const r of base){
      const v = __hf_normalize(r[headerName]);
      if (!seen.has(v)){ seen.add(v); valuesUnique.push(v); if (valuesUnique.length>=100) break; }
    }
  } catch(e){}

  const f = State.headerFilters[headerName] || { query:'', selected:new Set() };
  const q = f.query || '';

  // SUM mode (Balance/Usage/Unit)
  const isSumEligible = __hf_isSumEligibleHeader(headerName);
  const sumKindGuess = isSumEligible ? __hf_guessNumericKind(headerName, base) : null;
  const __hf_isTimeHeader = (()=>{
    try{
      const hn = String(headerName||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
      return (hn === 'starttime' || hn === 'endtime');
    }catch(e){ return false; }
  })();
  const __hf_defaultKind = (()=>{
    const hn = String(headerName||'').toLowerCase();
    if (__hf_isTimeHeader) return 'rows';
    if (sumKindGuess && sumKindGuess !== 'unknown') return sumKindGuess;
    if (hn.includes('usage') || hn.includes('unit')) return 'seconds';
    if (hn.includes('balance') || hn.includes('fee') || hn.includes('amount') || hn.includes('charge') || hn.includes('cost') || hn.includes('price')) return 'currency';
    return 'number';
  })();
  let currentKind = __hf_defaultKind;
  const showKindSelector = isSumEligible && (sumKindGuess === 'unknown');

  // SUM list mode:
  // - FILTER mode: unique values
  // - SUM mode: if the column contains numbers, show ROW occurrences (including duplicates) in visible row order.
  const __hf_colHasNumber = (()=>{
    if (__hf_isTimeHeader) return false;
    try{
      for (let i=0; i<Math.min(base.length, 200); i++){
        const s = String(base[i]?.[headerName] ?? '');
        if (/[-+]?\d/.test(s)) return true;
      }
    }catch(e){}
    return false;
  })();

  const __hf_valuesRows = (()=>{
    try{ return (base||[]).map(r => __hf_normalize(r?.[headerName])); }catch(e){ return []; }
  })();
  const statsByVal = {};
  if (isSumEligible){
    try{
      for (const r of base){
        const key = __hf_normalize(r[headerName]);
        if (!statsByVal[key]) statsByVal[key] = { count:0, sum:0 };
        statsByVal[key].count++;
        // Keep both float sum and integer cents sum for currency to avoid rounding issues.
        if (statsByVal[key].sumCents == null) statsByVal[key].sumCents = 0;
        if (__hf_defaultKind === 'currency'){
          const c = __hf_parseCurrencyCents(r[headerName]);
          statsByVal[key].sumCents += c;
          statsByVal[key].sum += (c/100);
        } else {
          statsByVal[key].sum += __hf_parseNumberLoose(r[headerName]);
        }
      }
    }catch(e){}
  }

  const titleText = (anchorEl.parentElement?.textContent?.trim()||headerName);
  const __hf_valsHtmlFilterUnique = ()=>{
    return valuesUnique.map(v=>{
      const checked = (f.selected && f.selected.has(v)) ? 'checked' : '';
      const lab = v ? v.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—';
      const vAttr = v.replace(/"/g,'&quot;');
      if (!isSumEligible){
        return `<label><input type="checkbox" value="${vAttr}" ${checked}/> <span class="hf-v" data-v="${vAttr}">${lab}</span></label>`;
      }
      const st = statsByVal[v] || {count:0,sum:0};
      const t = (currentKind === 'currency') ? __hf_formatSum('currency', st.sum) : __hf_formatSum(currentKind, st.sum);
      // total span is hidden until SUM mode is enabled
      return `<label><input type="checkbox" value="${vAttr}" ${checked}/> <span class="hf-v" data-v="${vAttr}">${lab}</span> <span class="hf-c" data-v="${vAttr}" style="display:none"></span> <span class="hf-t" data-v="${vAttr}" style="display:none">${t}</span></label>`;
    }).join('');
  };

  const __hf_valsHtmlSumRows = ()=>{
    // Preserve row order + duplicates as shown in the (currently visible) dataset.
    const rows = (__hf_valuesRows || []).slice(0, 800);
    return rows.map(v=>{
      const checked = (f.selected && f.selected.has(v)) ? 'checked' : '';
      const lab = v ? v.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—';
      const num = __hf_parseNumberLoose(v);
      const cents = __hf_parseCurrencyCents(v);
      const vAttr = v.replace(/"/g,'&quot;');
      // We keep value="v" (even if duplicated) so filtering still works; SUM uses per-row datasets.
      return `<label data-row="1"><input type="checkbox" value="${vAttr}" ${checked} data-num="${num}" data-cents="${cents}"/> <span class="hf-v" data-v="${vAttr}">${lab}</span> <span class="hf-c" data-v="${vAttr}" style="display:none"></span> <span class="hf-t" style="display:none"></span></label>`;
    }).join('');
  };

  menu.innerHTML = `
    <h6 class="hf-titlebar">
      <span>تصفية حسب: <span style="color:#6cf">${titleText}</span></span>
      ${isSumEligible ? `
        <span class="hf-modes">
          <button type="button" class="hf-sum-btn" id="hf-sum-toggle" aria-pressed="false" title="تحديد الكل + إجمالى المحدد">∑</button>
          <span class="hf-modes" id="hf-modes">
            <button type="button" class="hf-mode-btn" data-kind="currency" title="جمع فلوس (بدون تقريب)">💰</button>
            <button type="button" class="hf-mode-btn" data-kind="rows" title="عد الصفوف للمحدد">#</button>
            <button type="button" class="hf-mode-btn" data-kind="bytes" title="جمع كـ بايت">B</button>
            <button type="button" class="hf-mode-btn" data-kind="seconds" title="جمع كـ ثواني">⏱</button>
          </span>
        </span>
      ` : ``}
    </h6>
    <input type="text" id="hf-q" placeholder="ابحث فى القيم..." value="${q.replace(/"/g,'&quot;')}"/>
    ${isSumEligible ? `
      <div class="hf-selectall" id="hf-selectall"><label style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="hf-all"/> <span>تحديد الكل</span></label></div>
      <div class="hf-sumbar" id="hf-sumbar">
        <span>إجمالي المحدد: <strong id="hf-sumval">0</strong><span class="hf-mini" id="hf-mini"></span></span>
        ${showKindSelector ? `<span class="hf-kind">النوع:
          <select id="hf-sumkind" aria-label="نوع الإجمالي">
            <option value="number">رقم</option>
            <option value="currency">عملة</option>
            <option value="bytes">بايت</option>
            <option value="seconds">ثانية</option>
          </select>
        </span>` : ``}
      </div>
    ` : ``}
    <div class="hint">اختر قيمة/قيم (أو استخدم بحث نصى).</div>
    <div class="vals" id="hf-vals" data-mode="filter">
      ${__hf_valsHtmlFilterUnique()}
    </div>
    <div class="act">
      <button id="hf-clear">مسح</button>
      <button id="hf-apply" class="primary">تطبيق</button>
    </div>
  `;

  

  // Attach to table-wrap so it follows the sticky table header (not fixed to viewport)
    const wrap = (anchorEl && anchorEl.closest && anchorEl.closest('.table-wrap')) || document.querySelector('.table-wrap') || document.body;
    if (wrap !== document.body){
      try{
        const pos = window.getComputedStyle(wrap).position;
        if (!pos || pos === 'static') wrap.style.position = 'relative';
      }catch(e){}
      wrap.appendChild(menu);
    } else {
      document.body.appendChild(menu);
    }
  
    function __hf_pos(){
      try{
        if (wrap === document.body){
          const top = Math.min(window.innerHeight - menu.offsetHeight - 10, rect.bottom + 6);
          const left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, rect.left));
          menu.style.top = top + 'px';
          menu.style.left = left + 'px';
          return;
        }
        const wrapRect = wrap.getBoundingClientRect();
        const aRect = anchorEl.getBoundingClientRect();
  
        // Position under the header cell, in wrap content coordinates
        let top = (aRect.bottom - wrapRect.top) + wrap.scrollTop + 6;
        let left = (aRect.left - wrapRect.left) + wrap.scrollLeft;
  
        // Clamp inside visible wrap area
        const minLeft = wrap.scrollLeft + 8;
        const maxLeft = wrap.scrollLeft + wrap.clientWidth - menu.offsetWidth - 8;
        left = Math.max(minLeft, Math.min(maxLeft, left));
  
        const minTop = wrap.scrollTop + 6;
        const maxTop = wrap.scrollTop + wrap.clientHeight - menu.offsetHeight - 10;
        top = Math.max(minTop, Math.min(maxTop, top));
  
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
      }catch(e){}
    }
  
    const __hf_onScroll = ()=>{ __hf_pos(); };
    const __hf_onResize = ()=>{ __hf_pos(); };
  
    if (wrap !== document.body){
      wrap.addEventListener('scroll', __hf_onScroll, {passive:true});
    }
    window.addEventListener('resize', __hf_onResize);
  
    function __hf_close(){
      try{
        if (wrap !== document.body) wrap.removeEventListener('scroll', __hf_onScroll);
        window.removeEventListener('resize', __hf_onResize);
      }catch(e){}
      try{ menu.remove(); }catch(e){}
    }
  
    __hf_pos();
  

  // Events
  // SUM mode behavior
  if (isSumEligible){
    const btnSum = menu.querySelector('#hf-sum-toggle');
    const selectAllWrap = menu.querySelector('#hf-selectall');
    const sumbar = menu.querySelector('#hf-sumbar');
    const sumval = menu.querySelector('#hf-sumval');
    const cbAll = menu.querySelector('#hf-all');
    const selKind = menu.querySelector('#hf-sumkind');

    const mini = menu.querySelector('#hf-mini');
    const modeBtns = Array.from(menu.querySelectorAll('.hf-mode-btn'));
    const defaultKind = currentKind;

    const valsEl = menu.querySelector('#hf-vals');
    const __hf_isSumRowsMode = ()=> (valsEl && valsEl.getAttribute('data-mode') === 'sumrows');
    const __hf_attachCheckboxListeners = ()=>{
      try{
        menu.querySelectorAll('.vals input[type="checkbox"]').forEach(b=>{
          b.addEventListener('change', ()=>{ __hf_updateSumUI(); });
        });
      }catch(e){}
    };

    const __hf_switchListTo = (mode)=>{
      try{
        if (!valsEl) return;
        // Preserve selections across list mode switches
        const _sel = new Set();
        try{ valsEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb=>_sel.add(cb.value)); }catch(e){}
        if (mode === 'sumrows'){
          valsEl.setAttribute('data-mode','sumrows');
          valsEl.innerHTML = __hf_valsHtmlSumRows();
        } else {
          valsEl.setAttribute('data-mode','filter');
          valsEl.innerHTML = __hf_valsHtmlFilterUnique();
        }
        // Restore checked values
        try{
          if (_sel.size){
            valsEl.querySelectorAll('input[type="checkbox"]').forEach(cb=>{ if (_sel.has(cb.value)) cb.checked = true; });
          }
        }catch(e){}
        // Refresh per-item totals visibility based on current SUM mode
        const on = btnSum && (btnSum.getAttribute('aria-pressed') === 'true');
        valsEl.querySelectorAll('.hf-t').forEach(el=>{ el.style.display = on ? 'inline' : 'none'; });
        __hf_updateKindLabels();
        __hf_attachCheckboxListeners();
      }catch(e){}
    };
    const setActiveModeBtn = ()=>{
      try{
        modeBtns.forEach(b=>{
          const k = b.getAttribute('data-kind');
          b.classList.toggle('active', currentKind === k);
        });
      }catch(e){}
    };
    const setKind = (k)=>{
      try{
        if (!k) return;
        // Clicking the active mode again returns to default (auto)
        if (currentKind === k) currentKind = defaultKind;
        else currentKind = k;
        if (selKind) {
          try{ if (selKind.querySelector(`option[value="${currentKind}"]`)) selKind.value = currentKind; }catch(_){ }
        }
        setActiveModeBtn();
        __hf_updateKindLabels();
        __hf_updateSumUI();
        try{
          const _on = btnSum && (btnSum.getAttribute('aria-pressed') === 'true');
          if (_on){
            if (__hf_colHasNumber && currentKind !== 'rows') __hf_switchListTo('sumrows');
            else __hf_switchListTo('filter');
          }
        }catch(e){}
      }catch(e){}
    };
    modeBtns.forEach(b=>{
      b.addEventListener('click', (ev)=>{ ev.preventDefault(); ev.stopPropagation(); const _sx=window.scrollX||0, _sy=window.scrollY||0; setKind(b.getAttribute('data-kind')); setTimeout(()=>{ try{ window.scrollTo(_sx,_sy); }catch(e){} }, 0); });
    });

    const __hf_updateKindLabels = ()=>{
      try{
        const sumRowsMode = __hf_isSumRowsMode();
        if (sumRowsMode){
          // Per-row values (duplicates preserved)
          menu.querySelectorAll('#hf-vals label[data-row="1"]').forEach(lab=>{
            const cb = lab.querySelector('input[type="checkbox"]');
            const sp = lab.querySelector('.hf-t');
            if (!cb || !sp) return;
            const num = Number(cb.getAttribute('data-num')||0);
            const cents = Number(cb.getAttribute('data-cents')||0);
            if (currentKind === 'rows') sp.textContent = '1 صف';
            else if (currentKind === 'currency') sp.textContent = __hf_formatSum('currency', cents/100);
            else sp.textContent = __hf_formatSum(currentKind, num);
          });
          return;
        }
        // Aggregated-by-value list (unique)
        menu.querySelectorAll('.hf-t').forEach(sp=>{
          const v = sp.getAttribute('data-v') || '';
          const st = statsByVal[v] || { count:0, sum:0, sumCents:0 };
          if (currentKind === 'rows') sp.textContent = __hf_formatSum('rows', st.count) + ' صف';
          else if (currentKind === 'currency') sp.textContent = __hf_formatSum('currency', st.sumCents ? (st.sumCents/100) : st.sum);
          else sp.textContent = __hf_formatSum(currentKind, st.sum);
        });
      
        // Show repetition count beside the value (name-like logic) when requested:
        const __hf_sumOn = btnSum && (btnSum.getAttribute('aria-pressed') === 'true');
        const __hf_showCntInLabel = !!__hf_sumOn && (currentKind === 'rows' || __hf_isTimeHeader);
        try{
          menu.querySelectorAll('.hf-c').forEach(sp=>{
            const v = sp.getAttribute('data-v') || '';
            const st = statsByVal[v] || { count:0 };
            if (__hf_showCntInLabel){
              sp.textContent = `(x${st.count || 0})`;
              sp.style.display = 'inline';
            } else {
              sp.textContent = '';
              sp.style.display = 'none';
            }
          });
        }catch(e){}
}catch(e){}
    };

    if (selKind){
      try{ selKind.value = currentKind; }catch(e){}
      selKind.addEventListener('change', ()=>{
        try{
          currentKind = selKind.value || currentKind;
          __hf_updateKindLabels();
          try{ setActiveModeBtn(); }catch(_){ }
          __hf_updateSumUI();
        }catch(e){}
      });
    }

    const setSumMode = (on)=>{
      try{
        btnSum.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (selectAllWrap) selectAllWrap.style.display = on ? 'flex' : 'none';
        if (sumbar) sumbar.style.display = on ? 'block' : 'none';
        menu.querySelectorAll('.hf-t').forEach(el=>{ el.style.display = on ? 'inline' : 'none'; });
        try{ modeBtns.forEach(b=>{ b.disabled = !on; }); }catch(_){ }

        // In SUM mode: if the column has numbers, switch the list to ROW occurrences (duplicates preserved).
        // In FILTER mode: keep unique values.
        if (on){
          if (__hf_colHasNumber && currentKind !== 'rows') __hf_switchListTo('sumrows');
          else __hf_switchListTo('filter');
        }
        if (!on) __hf_switchListTo('filter');

        if (on){ setActiveModeBtn(); __hf_updateKindLabels(); __hf_updateSumUI(); }
      }catch(e){}
    };

    // Default: SUM mode off
    try{ modeBtns.forEach(b=>{ b.disabled = true; }); }catch(e){}

    const __hf_updateSumUI = ()=>{
      try{
        const sumRowsMode = __hf_isSumRowsMode();
        const checkedBoxes = Array.from(menu.querySelectorAll('.vals input[type="checkbox"]:checked'));
        let total = 0;

        if (sumRowsMode){
          if (currentKind === 'rows'){
            total = checkedBoxes.length;
            if (sumval) sumval.textContent = __hf_formatSum('rows', total) + ' صف';
            if (mini) mini.textContent = ` (تحديد: ${checkedBoxes.length})`;
          } else if (currentKind === 'currency'){
            let cents = 0;
            for (const cb of checkedBoxes){ cents += Number(cb.getAttribute('data-cents')||0); }
            total = cents / 100;
            if (sumval) sumval.textContent = __hf_formatSum('currency', total);
            if (mini) mini.textContent = '';
          } else {
            for (const cb of checkedBoxes){ total += Number(cb.getAttribute('data-num')||0); }
            if (sumval) sumval.textContent = __hf_formatSum(currentKind, total);
            if (mini) mini.textContent = '';
          }
        } else {
          const checkedVals = checkedBoxes.map(i=> i.value);
          if (currentKind === 'rows'){
            for (const v of checkedVals){ total += (statsByVal[v] ? statsByVal[v].count : 0); }
            if (sumval) sumval.textContent = __hf_formatSum('rows', total) + ' صف';
            if (mini) mini.textContent = ` (قيم: ${checkedVals.length})`;
          } else if (currentKind === 'currency'){
            let cents = 0;
            for (const v of checkedVals){ cents += (statsByVal[v] && statsByVal[v].sumCents ? statsByVal[v].sumCents : 0); }
            total = cents / 100;
            if (sumval) sumval.textContent = __hf_formatSum('currency', total);
            if (mini) mini.textContent = '';
          } else {
            for (const v of checkedVals){ total += (statsByVal[v] ? statsByVal[v].sum : 0); }
            if (sumval) sumval.textContent = __hf_formatSum(currentKind, total);
            if (mini) mini.textContent = '';
          }
        }
        if (cbAll){
          const allBoxes = Array.from(menu.querySelectorAll('.vals input[type="checkbox"]'));
          const allChecked = allBoxes.length && allBoxes.every(b=>b.checked);
          const anyChecked = allBoxes.some(b=>b.checked);
          cbAll.indeterminate = anyChecked && !allChecked;
          cbAll.checked = allChecked;
        }
      }catch(e){}
    };

    if (btnSum){
      btnSum.addEventListener('click', (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        const _sx=window.scrollX||0, _sy=window.scrollY||0;
        const on = btnSum.getAttribute('aria-pressed') !== 'true';
        setSumMode(on);
        setTimeout(()=>{ try{ window.scrollTo(_sx,_sy); }catch(e){} }, 0);
      });
    }
    if (cbAll){
      cbAll.addEventListener('change', ()=>{
        try{
          const on = !!cbAll.checked;
          menu.querySelectorAll('.vals input[type="checkbox"]').forEach(b=>{ b.checked = on; });
          __hf_updateSumUI();
        }catch(e){}
      });
    }
    __hf_attachCheckboxListeners();
  }

  menu.querySelector('#hf-apply').addEventListener('click', ()=>{
    const query = menu.querySelector('#hf-q').value || '';
    const selected = new Set(Array.from(menu.querySelectorAll('.vals input[type="checkbox"]:checked')).map(i=> i.value));
    try {
      const Store = global.App && global.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        // Clone current headerFilters and update the targeted header.
        const newHF = Object.assign({}, State.headerFilters || {});
        if ((query && query.trim()) || selected.size) {
          newHF[headerName] = { query, selected };
        } else {
          delete newHF[headerName];
        }
        // Reset to page 1 when filters change
        Store.dispatch({ patch: { headerFilters: newHF, page: 1 } });
      } else {
        // Legacy fallback: mutate headerFilters and reset page
        if ((query && query.trim()) || selected.size) {
          State.headerFilters[headerName] = { query, selected };
        } else {
          delete State.headerFilters[headerName];
        }
        try { State.page = 1; } catch (_) {}
      }
    } catch (_) {
      // On error, perform legacy assignment
      try {
        if ((query && query.trim()) || selected.size) {
          State.headerFilters[headerName] = { query, selected };
        } else {
          delete State.headerFilters[headerName];
        }
        State.page = 1;
      } catch (__){ }
    }
    // Recompute filtered view and re-render table
    applyHeaderFilters();
    global.App.View.renderTable();
    document.removeEventListener('click', onDoc);
    __hf_close();
  });
  menu.querySelector('#hf-clear').addEventListener('click', ()=>{
    try {
      const Store = global.App && global.App.Store;
      if (Store && typeof Store.dispatch === 'function') {
        const newHF = Object.assign({}, State.headerFilters || {});
        delete newHF[headerName];
        // Reset page to 1 on filter change
        Store.dispatch({ patch: { headerFilters: newHF, page: 1 } });
      } else {
        // Legacy fallback
        delete State.headerFilters[headerName];
        try { State.page = 1; } catch (_) {}
      }
    } catch (_) {
      try { delete State.headerFilters[headerName]; State.page = 1; } catch (__) {}
    }
    applyHeaderFilters();
    global.App.View.renderTable();
    document.removeEventListener('click', onDoc);
    __hf_close();
  });
  const onDoc = function(ev){
    if (!menu.contains(ev.target) && ev.target !== anchorEl){
      __hf_close();
      document.removeEventListener('click', onDoc);
    }
  };
  document.addEventListener('click', onDoc);
}



  // ---- Exports to App.ViewInternals (so other modules can call filters safely) ----
  App.ViewInternals = App.ViewInternals || {};
  App.ViewInternals.__hf_openMenu = __hf_openMenu;
  App.ViewInternals.applyHeaderFilters = applyHeaderFilters;

})(window);
