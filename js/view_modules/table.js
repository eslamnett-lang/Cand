
(function(global){
  'use strict';
  global.App = global.App || {};
  var App = global.App;
  App.View = App.View || {};
  var State = App.State || (App.State = {});
  var Internals = App.ViewInternals || (App.ViewInternals = {});
  var Paginate = (App && App.Core && App.Core.Paginate) ? App.Core.Paginate : null;

  // Table rendering extracted from view.js (phase 1 of modularization).
  App.View._renderTableRaw = function(){
    try{ if (global.App && global.App.Hooks) global.App.Hooks.run('beforeRender', { page: State.page }); }catch(e){}
    if (Internals && typeof Internals.ensureTopToolbar === 'function') Internals.ensureTopToolbar();
    const thead = document.querySelector('#dataTable thead');
    const tbody = document.querySelector('#dataTable tbody');
    if (!thead || !tbody) return;
    // FINAL UI: row events are owned by js/ui/components/DataTable.js
    thead.innerHTML = ""; tbody.innerHTML = "";
    // Clean stray markers/details before re-render
    try { document.querySelectorAll('#dataTable .row-target').forEach(el=>el.classList.remove('row-target')); } catch(e){}
    try { document.querySelectorAll('#dataTable .row-detail, #dataTable .details-row').forEach(el=>el.remove()); } catch(e){}

    // Row lookup map (built in Data layer). Keep a defensive rebuild if missing/stale.
    try {
      const wantVer = State.lookupVersion || 0;
      if (!window.__ROWS_BY_ID || window.__ROWS_BY_ID_VERSION !== wantVer){
        window.__ROWS_BY_ID = window.__ROWS_BY_ID || {};
        Object.keys(window.__ROWS_BY_ID).forEach(function(k){ try{ delete window.__ROWS_BY_ID[k]; }catch(_){ } });
        var src = Array.isArray(State.rows) ? State.rows : (Array.isArray(State.view) ? State.view : []);
        src.forEach(function(r){ if (r && typeof r._id !== 'undefined') window.__ROWS_BY_ID[String(r._id)] = r; });
        window.__ROWS_BY_ID_VERSION = wantVer;
      }
    } catch(e){}

    // Try set default indices if not set
    if (State.feeIdx === -1)  State.feeIdx  = State.headers.findIndex(h => Internals.normalizeHeader(h) === 'totalfee');
    if (State.unitIdx === -1) State.unitIdx = State.headers.findIndex(h => Internals.normalizeHeader(h) === 'freeunitconsumed');

    
    // Header
    const trh = document.createElement('tr');
    const thSel = document.createElement('th'); thSel.className='select-col'; thSel.textContent='—';
    trh.appendChild(thSel);
    

State.headers.forEach((h, colIdx)=>{
  const th = document.createElement('th');
  th.textContent = h;
  const f = State.headerFilters[h];
  if (f && ((f.query&&f.query.trim()) || (f.selected&&f.selected.size) || (f.dtFrom || f.dtTo))) th.classList.add('filtered');
  const btn = document.createElement('span');
  btn.className = 'th-filter';
  btn.title = 'تصفية هذا العمود';
  btn.textContent = '▾';
  btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); Internals.__hf_openMenu(btn, h); });
  th.appendChild(btn);
  trh.appendChild(th);
});
thead.appendChild(trh);


    
    // Rows (current page) — apply header filters over current view
    const rowsBase = Array.isArray(State.view) ? State.view : (Array.isArray(State.rows) ? State.rows : []);
    const allRows = (Internals && typeof Internals.applyHeaderFilters==='function') ? Internals.applyHeaderFilters() : rowsBase;
    // fills State.viewFiltered from rowsBase (or returns base if filters module not present)
    const allRowsSafe = Array.isArray(allRows) ? allRows : rowsBase;
    const pageData = (Paginate && typeof Paginate.slice === 'function')
      ? Paginate.slice(allRowsSafe, State.page, State.pageSize)
      : allRowsSafe.slice((State.page-1)*State.pageSize, (State.page-1)*State.pageSize + State.pageSize);
    
    (function(){
      const N = pageData.length;
      const CHUNK = (State.pageSize && State.pageSize>250) ? 120 : N; // render in chunks if big
      let i = 0;
      function step(){
        const frag = document.createDocumentFragment();
        for (let c=0; c<CHUNK && i<N; c++, i++){
          const r = pageData[i];
          // Canonicalize the row identifier. Prefer `_id`; fall back to `id` or `__id` when `_id` is undefined or null.
          const rowId = (r && typeof r._id !== 'undefined' && r._id !== null)
            ? r._id
            : ((r && typeof r.id !== 'undefined' && r.id !== null)
              ? r.id
              : ((r && typeof r.__id !== 'undefined' && r.__id !== null)
                ? r.__id
                : null));
          const tr = document.createElement('tr');
          // Attach the canonical identifier to the row DOM element.  Use String(value) implicitly via attribute.
          tr.setAttribute('data-row-id', rowId);
          try { tr.setAttribute('data-row-key', Utils.Internals.computeRowKey(State.headers, r)); } catch(e) {}
          const tdSel = document.createElement('td');
          tdSel.className = 'select-col';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'row-select';
          // Reflect selection state based on the canonical row id.
          cb.checked = State.selected.has(rowId);
          tdSel.appendChild(cb);

          // زر تفاصيل سريع: يظهر تفاصيل هذا الصف تحت الأصل فورًا
          const quick = document.createElement('button');
          quick.type = 'button';
          quick.className = 'row-quick-details';
          quick.textContent = 'تفاصيل';
          quick.title = 'إظهار التفاصيل تحت الأصل';
          quick.setAttribute('aria-label','تفاصيل');
          tdSel.appendChild(quick);

          tr.appendChild(tdSel);

          State.headers.forEach(function(h){
            const td = document.createElement('td');
            // Avoid innerHTML for cell content (XSS-safe by default)
            td.textContent = String(r[h] ?? "");
            tr.appendChild(td);
          });
          frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        if (i < N) requestAnimationFrame(step);
        else {
          try{ if (global.App && global.App.Recover) global.App.Recover.Internals.markGood(); }catch(e){}
          try{ if (global.App && global.App.Hooks) global.App.Hooks.run('afterRender', { rows: N, page: State.page }); }catch(e){}
        }
      }
      requestAnimationFrame(step);
    })();
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = State.page + " / " + Math.max(1, Math.ceil((State.viewFiltered ? State.viewFiltered.length : (State.view?State.view.length:0))/State.pageSize));

    // No additional post-render column-hiding steps
  };
})(window);
