/**
 * Compact view module for MNDO View Pro.
 *
 * This script adds a "فلترة مختصر" (compact filter) box that allows users
 * to display concise tables for either Units or Balance data. It watches
 * the underlying dataset and rebuilds the compact table automatically when
 * data is loaded or when header filters change. A refresh button allows
 * manual updates, and a return button restores the full table view.
 */
(function(global){
  'use strict';
  const App = global.App || {};
  const Compact = {
    // Base columns always present in compact views
    baseColumns: [
      'Source Service No',
      'Service Type',
      'Start Time',
      'End Time'
    ],
    // Definitions for each compact view type
    compactDefs: {
      BALANCE: {
        label: 'رصيد مختصر',
        extraColumns: [
          'Balance Before',
          'Total Fee',
          'Balance After',
          'Usage',
          'Offering Name'
        ]
      },
      UNITS: {
        label: 'وحدات مختصر',
        extraColumns: [
          'Usage',
          'Measure Unit',
          'Free Unit Name',
          'Free Unit Before',
          'Free Unit After',
          'Free Unit Consumed',
          'Consumed Offer'
        ]
      }
      ,
      BONUS: {
        // سلفنى مختصر: يعرض الحقول الترويجية المحددة بالإضافة إلى الأعمدة الأساسية
        label: 'سلفنى مختصر',
        extraColumns: [
          'Total Fee',
          'Total Promotional Balance Before',
          'Total Promotional Fee',
          'Total Promotional Balance After',
          'Total Balance',
          'Offering Name'
        ]
      }
    },
    current: null,
    lastCount: 0,
    headers: [],
    /**
     * Normalize a header by removing whitespace, punctuation and case.
     * Uses App.Utils.normalizeHeader if available.
     * @param {string} h
     */
    normalize(h){
      try{
        return App.Utils && typeof App.Utils.normalizeHeader === 'function'
          ? App.Utils.normalizeHeader(h)
          : String(h||'').toLowerCase().replace(/[\s_\/.\-]+/g,'').trim();
      }catch(e){
        return String(h||'').toLowerCase().replace(/[\s_\/.\-]+/g,'').trim();
      }
    },
    /**
     * Find the actual header name in the dataset that matches a given alias.
     * If no match is found, returns the alias itself. Matching is case-insensitive
     * and ignores whitespace and punctuation.
     * @param {string[]} headers List of actual header strings.
     * @param {string} alias The desired column alias.
     * @returns {string}
     */
    findHeader(headers, alias){
      const normAlias = this.normalize(alias);
      for (const h of headers){
        if (this.normalize(h) === normAlias) return h;
      }
      return alias;
    },
    /**
     * Return the headers from state or fallback. Stores fallback headers for later use.
     */
    getHeaders(){
      // Prefer headers from App.State
      const st = App.State || {};
      let hdrs = Array.isArray(st.headers) && st.headers.length ? st.headers.slice() : [];
      if (!hdrs.length && Array.isArray(this.headers) && this.headers.length){
        hdrs = this.headers.slice();
      }
      return hdrs;
    },
    /**
     * Obtain data rows from the current view or, if missing, from the DOM table.
     * Returns an array of objects keyed by header names.
     */
    getDataRows(){
      try{
        const st = App.State || {};
        // Use filtered view if available, otherwise use full view
        let rows = Array.isArray(st.viewFiltered) && st.viewFiltered.length
          ? st.viewFiltered
          : (Array.isArray(st.view) ? st.view : []);
        // If view arrays are empty, try rows (raw)
        if (!rows.length && Array.isArray(st.rows)) rows = st.rows;
        if (rows && rows.length) return rows;
      }catch(_){}
      // Fallback: parse DOM table if present
      const domRows = [];
      try{
        const table = document.querySelector('#dataTable');
        if (!table) return domRows;
        // Derive headers from thead (skip the select-col cell)
        const thEls = table.querySelectorAll('thead tr th');
        const headers = [];
        thEls.forEach((th, idx) => {
          // Skip the select column header (first one)
          if (idx === 0) return;
          // The header may include a filter button as child; take the text node
          const childNodes = Array.from(th.childNodes);
          let text = '';
          for (const node of childNodes){
            if (node.nodeType === Node.TEXT_NODE){
              text += node.textContent;
            }
          }
          headers.push(text.trim());
        });
        this.headers = headers;
        const rowsEls = table.querySelectorAll('tbody tr');
        rowsEls.forEach(tr => {
          const obj = {};
          const cells = Array.from(tr.children);
          let hdrIndex = 0;
          cells.forEach(cell => {
            if (cell.classList.contains('select-col')) return;
            const key = headers[hdrIndex++] || '';
            obj[key] = cell.textContent.trim();
          });
          domRows.push(obj);
        });
      }catch(e){ console.error('Compact fallback error:', e); }
      return domRows;
    },
    /**
     * Build a compact HTML table for a given type (BALANCE or UNITS).
     * @param {string} type
     * @returns {HTMLElement|null}
     */
    buildTable(type){
      const def = this.compactDefs[type];
      if (!def) return null;
      const allHeaders = this.getHeaders();
      // Map base and extra columns to actual header names
      const columns = [];
      const desired = this.baseColumns.concat(def.extraColumns);
      desired.forEach(col => {
        const h = this.findHeader(allHeaders, col);
        if (!columns.includes(h)) columns.push(h);
      });
      // Build table element with interactive features (selection + quick details)
      const table = document.createElement('table');
      // Use similar classes as the main table for styling
      table.className = 'compact-table table table-striped table-hover align-middle';
      const thead = document.createElement('thead');
      const thRow = document.createElement('tr');
      // First header cell for selection column
      const thSel = document.createElement('th');
      thSel.className = 'select-col';
      thSel.textContent = '—';
      thRow.appendChild(thSel);
      // Create header cells for each selected column
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        thRow.appendChild(th);
      });
      thead.appendChild(thRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      const dataRows = this.getDataRows();
      const State = (App && App.State) || {};
      const Utils = (App && App.Utils) || {};
      const escapeHTML = (Utils && Utils.escapeHTML) || (s => s);
      const updateSum = () => {
        try { if (App && App.View && typeof App.View.updateSumSelected === 'function') App.View.updateSumSelected(); } catch(_){ }
      };
      dataRows.forEach(row => {
        // Each row is the original object with _id and full columns
        const tr = document.createElement('tr');
        if (row && typeof row._id !== 'undefined'){
          tr.setAttribute('data-row-id', row._id);
        }
        // Selection cell with checkbox and quick details button
        const tdSel = document.createElement('td');
        tdSel.className = 'select-col';
        // checkbox for row selection
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        try{
          const sel = State && State.selected;
          cb.checked = sel && typeof sel.has === 'function' ? sel.has(row._id) : false;
        }catch(_){ cb.checked = false; }
        cb.addEventListener('change', () => {
          try{
            const Store = App && App.Store;
            if (Store && typeof Store.dispatch === 'function') {
              // Use TOGGLE_SELECT action to update selected set
              Store.dispatch({ type: 'TOGGLE_SELECT', rowId: row._id, checked: !!cb.checked });
            } else {
              // legacy fallback
              if (cb.checked){ State.selected && State.selected.add && State.selected.add(row._id); }
              else { State.selected && State.selected.delete && State.selected.delete(row._id); }
            }
            updateSum();
          }catch(_){ }
        });
        tdSel.appendChild(cb);
        // quick details button
        try{
          const quick = document.createElement('button');
          quick.type = 'button';
          quick.className = 'row-quick-details';
          quick.textContent = 'تفاصيل';
          quick.title = 'إظهار التفاصيل تحت الأصل';
          quick.setAttribute('aria-label','تفاصيل');
          quick.addEventListener('click', function(ev){
            try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(_){}
            // Ensure only one details row is visible at a time in compact view.
            // Remove any existing comparison rows and reset quick buttons.
            try{
              const existingRows = document.querySelectorAll('tr.row-compare');
              existingRows.forEach(rw => {
                if (rw && rw.parentNode) rw.parentNode.removeChild(rw);
              });
              const onButtons = document.querySelectorAll('.row-quick-details.on');
              onButtons.forEach(btn => {
                try{ btn.classList.remove('on'); }catch(_){}
                try{ btn.disabled = false; }catch(_){}
              });
            }catch(_){}
            try{
              // Determine the proper toggleRowDetails function. It may be exposed via DetailsHelpers.
              let fn = null;
              if (window && window.DetailsHelpers && typeof window.DetailsHelpers.toggleRowDetails === 'function'){
                fn = window.DetailsHelpers.toggleRowDetails;
              } else if (typeof toggleRowDetails === 'function') {
                fn = toggleRowDetails;
              }
              if (fn) fn(tr, row, quick);
            }catch(_){}
          }, true);
          tdSel.appendChild(quick);
        }catch(_){ }
        tr.appendChild(tdSel);
        // Cells for each requested column
        columns.forEach(col => {
          const td = document.createElement('td');
          let val = '';
          try{
            val = row && row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
          }catch(_){ val = ''; }
          // Avoid innerHTML for cell content (XSS-safe by default)
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      return table;
    },
    /**
     * Display the compact table view and hide the main data table.
     * @param {string} type
     */
    showTable(type){
      const wrap = document.getElementById('compactTableWrap');
      if (!wrap) return;

      // If we couldn't resolve the original wrapper during init (e.g., init ran before render), try again now.
      if (!this.origTableWrap){
        try{
          const dt = document.getElementById('dataTable');
          const parentWrap = dt ? dt.closest('.table-wrap') : null;
          if (parentWrap) this.origTableWrap = parentWrap;
        }catch(_){ /* ignore */ }
      }

      // Friendly empty-state when the user clicks before loading/rendering any data.
      try{
        const rowsCount = (this.getDataRows() || []).length;
        if (!rowsCount){
          wrap.innerHTML = '<div class="alert alert-info mb-0">لا توجد بيانات لعرضها الآن. الرجاء تحميل ملف Excel أولاً ثم اختر نوع الفلترة واضغط "مختصر".</div>';
          wrap.style.display = 'block';
          return;
        }
      }catch(_){ /* ignore */ }
      // Build table
      const table = this.buildTable(type);
      if (!table){
        console.warn('Compact: could not build table for', type);
        return;
      }
      this.current = type;
      wrap.innerHTML = '';
      wrap.appendChild(table);
      wrap.style.display = 'block';
      // Hide the original table wrapper if available
      try{
        if (this.origTableWrap) this.origTableWrap.style.display = 'none';
      }catch(_){}
      // Ensure our wrapper has table-wrap class for drag support
      try{ if (!wrap.classList.contains('table-wrap')) wrap.classList.add('table-wrap'); }catch(_){}
      // Show return/refresh buttons
      const returnBtn = document.getElementById('compactReturnBtn');
      const refreshBtn = document.getElementById('compactRefreshBtn');
      if (returnBtn) returnBtn.style.display = 'inline-block';
      if (refreshBtn) refreshBtn.style.display = 'inline-block';
    },
    /**
     * Hide the compact table view and restore the main data table.
     */
    hideTable(){
      const wrap = document.getElementById('compactTableWrap');
      if (wrap){
        wrap.style.display = 'none';
        wrap.innerHTML = '';
      }
      // Restore original table wrapper if available
      try{
        if (this.origTableWrap) this.origTableWrap.style.display = '';
      }catch(_){}
      this.current = null;
      // Hide buttons
      const returnBtn = document.getElementById('compactReturnBtn');
      const refreshBtn = document.getElementById('compactRefreshBtn');
      if (returnBtn) returnBtn.style.display = 'none';
      if (refreshBtn) refreshBtn.style.display = 'none';
    },
    /**
     * Rebuild the current compact table view if active.
     */
    refresh(){
      if (!this.current) return;
      this.showTable(this.current);
    },
    /**
     * Watch for data changes and auto-refresh the compact table. Uses a simple
     * interval; stops when page is unloaded.
     */
    autoRefresh(){
      const self = this;
      // Clear any existing interval
      if (self._interval) clearInterval(self._interval);
      self._interval = setInterval(()=>{
        try{
          const count = self.getDataRows().length;
          if (count && count !== self.lastCount){
            self.lastCount = count;
            if (self.current){
              console.info('✅ Compact ready: ' + count + ' rows detected');
              self.refresh();
            }
          }
        }catch(e){ /* ignore */ }
      }, 1000);
    },
    /**
     * Initialize event listeners and start auto-refresh.
     */
    init(){
      // Ensure the compact-mode button never behaves like a form submit button.
      // (Some environments treat <button> without type as submit.)
      try{
        const mb = document.getElementById('compactModeBtn');
        if (mb && !mb.getAttribute('type')) mb.setAttribute('type','button');
      }catch(_){ /* ignore */ }

      // Store reference to the original table container (the one wrapping #dataTable)
      if (!this.origTableWrap){
        try{
          const dt = document.getElementById('dataTable');
          if (dt) {
            const parentWrap = dt.closest('.table-wrap');
            if (parentWrap) {
              this.origTableWrap = parentWrap;
            }
          }
        }catch(_){ /* ignore */ }
      }
      // Buttons for return and refresh
      const returnBtn = document.getElementById('compactReturnBtn');
      const refreshBtn = document.getElementById('compactRefreshBtn');
      if (returnBtn){
        returnBtn.addEventListener('click', ()=>{
          this.hideTable();
        });
      }
      if (refreshBtn){
        refreshBtn.addEventListener('click', ()=>{
          this.refresh();
        });
      }
      // Single compact-mode button that decides which compact view to show based on current filter
      const modeBtn = document.getElementById('compactModeBtn');
      const filterSelect = document.getElementById('filterSelect');
      if (modeBtn && filterSelect){
        modeBtn.addEventListener('click', ()=>{
          const val = (filterSelect.value || '').toUpperCase();
          let type = null;
          if (val === 'BALANCE') type = 'BALANCE';
          else if (val === 'UNITS') type = 'UNITS';
          else if (val === 'BONUS') type = 'BONUS';
          // Only show a compact table if the filter corresponds to a defined type
          if (!type){
            // 'ALL' means full table (no compact view)
            if (val === 'ALL' || val === ''){
              try{ this.hideTable(); }catch(_){ }
              return;
            }

            // Friendly hint if the user is on a filter that has no compact view.
            try{
              const wrap = document.getElementById('compactTableWrap');
              if (wrap){
                wrap.style.display = 'block';
                wrap.classList.add('table-wrap');
                wrap.innerHTML =
                  '<div class="alert alert-warning m-0">'
                  + 'علشان يظهر العرض المختصر، اختار النوع من الأزرار دي أو من الفلترة بالأعلى:'
                  + '<div class="mt-2 d-flex flex-wrap gap-2">'
                  +   '<button type="button" class="btn btn-sm btn-outline-primary" data-compact-type="BALANCE">Balance</button>'
                  +   '<button type="button" class="btn btn-sm btn-outline-primary" data-compact-type="UNITS">Units</button>'
                  +   '<button type="button" class="btn btn-sm btn-outline-primary" data-compact-type="BONUS">سلفنى</button>'
                  + '</div>'
                  + '</div>';

                // One-time wiring for the inline type picker
                try{
                  const btns = wrap.querySelectorAll('button[data-compact-type]');
                  btns.forEach(b => {
                    b.addEventListener('click', ()=>{
                      const t = (b.getAttribute('data-compact-type') || '').toUpperCase();
                      if (!t) return;
                      try{ filterSelect.value = t; }catch(_){ }
                      // Show immediately
                      try{ this.showTable(t); }catch(_){ }
                    }, { once: true });
                  });
                }catch(_){ }
              }
              // (silenced) unsupported filter values are handled via the inline picker above
            }catch(_){ }
            return;
          }
          // Toggle: clicking the same type again exits compact mode
          if (this.current && this.current === type){
            this.hideTable();
            return;
          }
          // If no data is loaded yet, still switch UI but show a helpful placeholder.
          try{
            const rows = this.getDataRows();
            if (!rows || !rows.length){
              const wrap = document.getElementById('compactTableWrap');
              if (wrap){
                this.current = type;
                wrap.style.display = 'block';
                wrap.classList.add('table-wrap');
                wrap.innerHTML = '<div class="alert alert-info m-0">لا توجد بيانات حالياً. برجاء تحميل ملف Excel أولاً ثم إعادة المحاولة.</div>';
                // Hide the original table wrapper if available
                try{ if (this.origTableWrap) this.origTableWrap.style.display = 'none'; }catch(_){ }
                const returnBtn = document.getElementById('compactReturnBtn');
                const refreshBtn = document.getElementById('compactRefreshBtn');
                if (returnBtn) returnBtn.style.display = 'inline-block';
                if (refreshBtn) refreshBtn.style.display = 'inline-block';
              }
              return;
            }
          }catch(_){ }
          this.showTable(type);
        });
        // If the user changes the filter while in compact mode, rebuild the table for the new type
        filterSelect.addEventListener('change', ()=>{
          if (!this.current) return;
          const val = (filterSelect.value || '').toUpperCase();
          let type = null;
          if (val === 'BALANCE') type = 'BALANCE';
          else if (val === 'UNITS') type = 'UNITS';
          else if (val === 'BONUS') type = 'BONUS';
          if (type){
            this.showTable(type);
          } else {
            // If selected filter has no compact representation, hide the compact view
            this.hideTable();
          }
        });
      }
      // Kick off auto-refresh timer
      this.autoRefresh();
    }
  };
  // Export namespace
  global.App = Object.assign(global.App || {}, { Compact });
  // Initialize on DOM ready
  if (document.readyState !== 'loading'){
    Compact.init();
  } else {
    document.addEventListener('DOMContentLoaded', ()=>{
      Compact.init();
    });
  }
})(typeof window !== 'undefined' ? window : this);