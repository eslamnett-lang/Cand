
(function(global){
  'use strict';
  const { $, Utils, State } = global.App;
  const { excelToDate } = Utils;

  // ---------------------------------------------------------------------------
  // Store helpers (Phase 10)
  // ---------------------------------------------------------------------------
  function __getStore(){
    try{ return global.App && global.App.Store; }catch(_){ return null; }
  }

  function __getCanonicalState(){
    const Store = __getStore();
    try{
      if (Store && typeof Store.getState === 'function') return Store.getState();
    }catch(_){ }
    return State;
  }

  function __dispatch(action){
    const Store = __getStore();
    if (Store && typeof Store.dispatch === 'function'){
      Store.dispatch(action);
      return true;
    }
    return false;
  }

  function __dispatchPatch(patch, opts){
    return __dispatch(Object.assign({ patch: patch }, (opts||{})));
  }

  function __buildViewFrom(rows, filterKey){
    let view = (rows||[]).map(r => ({...r, _start: excelToDate(r.startTime)}));
    const f = String(filterKey || 'ALL');
    if (f !== "ALL"){
      view = view.filter(r => {
        const raw = String(r.deductFrom||"");
        const v = raw.toLowerCase().trim();

        const isBalance = v.includes("balance");
        const isFree    = v.includes("free");
        const isBonusExact = v === "bonus";                       // سلفنى: Bonus فقط
        const isBonusFreeUnit = v === "bonus/free unit";          // يجب أن تُعامل كـ JUNK

        if (f === "BALANCE") return isBalance && !isFree;
        if (f === "UNITS")   return isFree    && !isBalance;
        if (f === "BONUS")   return isBonusExact;
        if (f === "JUNK")    return (isBalance && isFree) || isBonusFreeUnit;

        return true;
      });
    }
    // NOTE: original logic didn't sort; we preserve behavior.
    return view;
  }

  function __buildIndexesFromRows(rows, baseLookupVersion){
    const lookupVersion = (baseLookupVersion || 0) + 1;
    const rowsById = new Map();

    // Backward-compatible global lookup (used by some legacy helpers)
    window.__ROWS_BY_ID = window.__ROWS_BY_ID || {};
    // clear while keeping object reference (avoid breaking references)
    try{ Object.keys(window.__ROWS_BY_ID).forEach(function(k){ try{ delete window.__ROWS_BY_ID[k]; }catch(_){ } }); }catch(_){ }

    (rows || []).forEach(function(r){
      if (!r) return;
      // Determine the canonical row id. Prefer `_id`, then `id`, then `__id`.
      let rid;
      try {
        rid = (typeof r._id !== 'undefined' && r._id !== null)
          ? r._id
          : ((typeof r.id !== 'undefined' && r.id !== null)
            ? r.id
            : ((typeof r.__id !== 'undefined' && r.__id !== null) ? r.__id : undefined));
      } catch (_) {
        rid = undefined;
      }
      if (typeof rid === 'undefined') return;
      // Populate `_id` property if missing to normalize downstream references.
      try {
        if (typeof r._id === 'undefined' || r._id === null) {
          r._id = rid;
        }
      } catch (_) { /* ignore assignment failures */ }
      const key = String(rid);
      try { rowsById.set(key, r); } catch (_) { /* no-op */ }
      try { window.__ROWS_BY_ID[key] = r; } catch (_) { /* no-op */ }
    });

    window.__ROWS_BY_ID_VERSION = lookupVersion;
    return { lookupVersion, rowsById };
  }

  // ---------------------------------------------------------------------------
  // Dataset lifecycle helpers
  // ---------------------------------------------------------------------------
  function resetTransientState(){
    // Use Store as the single source of truth when available.
    try{
      const Store = __getStore();
      if (Store && typeof Store.dispatch === 'function'){
        // Silent to avoid unnecessary re-renders during parsing workflows.
        Store.dispatch({ type: 'RESET', silent: true });
        return;
      }
    }catch(_){ }
    // Legacy fallback
    try{ if (State && State.selected) State.selected.clear(); }catch(_){ }
    try{ if (State && State.detailCache && typeof State.detailCache.clear === 'function') State.detailCache.clear(); }catch(_){ }
    try{ State.page = 1; }catch(_){ }
  }

  function rebuildIndexes(rowsOverride){
    try{
      const base = __getCanonicalState();
      const rows = Array.isArray(rowsOverride) ? rowsOverride : (Array.isArray(base.rows) ? base.rows : []);
      const built = __buildIndexesFromRows(rows, base.lookupVersion || 0);

      const Store = __getStore();
      if (Store && typeof Store.dispatch === 'function'){
        Store.dispatch({ patch: { lookupVersion: built.lookupVersion, rowsById: built.rowsById }, silent: true });
      } else {
        State.lookupVersion = built.lookupVersion;
        State.rowsById = built.rowsById;
      }
    }catch(_){ }
  }


  function computeView(){
    const base = __getCanonicalState();
    const view = __buildViewFrom(base.rows || [], base.filter);

    const Store = __getStore();
    if (Store && typeof Store.dispatch === 'function'){
      // Silent: caller decides when to re-render.
      Store.dispatch({ patch: { view }, silent: true });
      return view;
    }

    // Legacy fallback
    try{ State.view = view; }catch(_){ }
    return view;
  }


  function rebuildUI(){
    computeView();
    try{
      const Store = __getStore();
      if (Store && typeof Store.dispatch === 'function'){
        // Silent: rebuildUI calls the legacy renderers explicitly.
        Store.dispatch({ type: 'SET_PAGE', page: 1, silent: true });
      } else {
        State.page = 1;
      }
    }catch(_){
      try{ State.page = 1; }catch(__){}
    }
    global.App.View.renderTable();
    global.App.View.updateSumSelected();
  }

  /**
   * Process parsed rows and meta information received from the XLSX worker. Converts each row array into an object using the
   * current headers, assigns a unique _id, and guesses common columns (startTime, endTime, deductFrom) just like the
   * original implementation. Finally rebuilds the UI.
   */

  /**
   * Process parsed rows and meta information received from the XLSX worker.
   */

  /**
   * Process parsed rows and meta information received from the XLSX worker.
   */
  function processParsedData(rowsArr, meta){
    try{
      resetTransientState();

      const base = __getCanonicalState();
      const headers = Array.isArray(meta && meta.headers) ? meta.headers : [];
      const sheetNames = Array.isArray(meta && meta.sheetNames) ? meta.sheetNames : [];

      // Keep ids monotonically increasing across loads
      let ids = base.ids || 0;

      const startIdx = headers.findIndex(h=> String(h).toLowerCase().includes("start"));
      const endIdx   = headers.findIndex(h=> String(h).toLowerCase().includes("end"));
      const deductIdx= headers.findIndex(h=> String(h).toLowerCase().includes("deduct"));

      // -----------------------------------------------------------------
      // Determine feeIdx and unitIdx using schema-based matching. The Schema
      // module normalizes headers and matches against a list of alias
      // tokens. When no match is found, the index remains -1.  This
      // approach is more robust to header variations such as extra
      // whitespace or minor wording differences.
      const feeAliases  = ['totalfee','totalfees','totalfeegp','fee'];
      const unitAliases = ['freeunitconsumed','freeunitsconsumed','unitsconsumed','unitconsumed'];
      let feeIdx = -1;
      let unitIdx = -1;
      try {
        const schema = global.App && global.App.Core && global.App.Core.Schema;
        if (schema && typeof schema.findColumnIndex === 'function') {
          feeIdx  = schema.findColumnIndex(headers, feeAliases);
          unitIdx = schema.findColumnIndex(headers, unitAliases);
        }
      } catch (_) {
        // swallow errors; indices stay at -1
      }

      const rows = (rowsArr || []).map(arr => {
        const o = { _id: (++ids) };
        headers.forEach((h, j)=>{ o[h] = arr[j]; });
        // Guess common columns
        o.startTime  = arr[startIdx >= 0 ? startIdx : 0];
        o.endTime    = arr[endIdx   >= 0 ? endIdx   : 1];
        o.deductFrom = arr[deductIdx >= 0 ? deductIdx : 12];
        return o;
      });

      const built = __buildIndexesFromRows(rows, base.lookupVersion || 0);
      const view = __buildViewFrom(rows, base.filter);

      const payload = {
        headers: headers,
        sheetNames: sheetNames,
        workbook: null,
        // Use schema-based indices computed from aliases.  When no match is
        // found the index is -1, which signals absence of the column.
        feeIdx: feeIdx,
        unitIdx: unitIdx,
        ids: ids,
        rows: rows,
        view: view,
        rowsById: built.rowsById,
        lookupVersion: built.lookupVersion,
        page: 1,
        selected: new Set(),
        detailCache: new Map(),
      };

      const Store = __getStore();
      const hasStore = !!(Store && typeof Store.dispatch === 'function');
      if (hasStore){
        Store.dispatch({ type: 'LOAD_WORKBOOK_SUCCESS', payload: payload });
      } else {
        // Legacy fallback
        State.headers = headers;
        State.sheetNames = sheetNames;
        State.workbook = null;
        // Assign feeIdx and unitIdx based on exact header names.  If not found, these remain -1.
        State.feeIdx  = feeIdx;
        State.unitIdx = unitIdx;
        State.ids = ids;
        State.rows = rows;
        State.view = view;
        State.rowsById = built.rowsById;
        State.lookupVersion = built.lookupVersion;
        State.page = 1;
        try{ State.selected && State.selected.clear(); }catch(_){ }
        try{ State.detailCache && typeof State.detailCache.clear === 'function' && State.detailCache.clear(); }catch(_){ }
      }

      // Build sheet selector UI
      const sheetSel = document.getElementById('sheetSelect');
      const byteBox  = document.getElementById('byteConvert');
      if (sheetNames.length <= 1) {
        if (sheetSel) sheetSel.parentElement.style.display = 'none';
        if (byteBox)  byteBox.style.display = 'block';
      } else {
        if (sheetSel) sheetSel.parentElement.style.display = 'block';
        if (byteBox)  byteBox.style.display = 'none';
      }
      const sel = $('#sheetSelect'); if (sel){ sel.innerHTML = ""; }
      (sheetNames || []).forEach((n,i)=>{
        const o = document.createElement("option");
        o.value = n; o.textContent = n; if(i===0) o.selected = true; sel && sel.appendChild(o);
      });
      if (sel) sel.disabled = false;

      // Store path renders via subscription; legacy fallback renders explicitly.
      if (!hasStore){
        global.App.View.renderTable();
        global.App.View.updateSumSelected();
      }
    }catch(e){ console.error(e); }
  }

/**
   * Parse a sheet using the Web Worker. Returns a promise that resolves when parsing is complete or rejects on error.
   */
  function parseSheetWithWorker(sheetName){
    return new Promise((resolve, reject)=>{
      try{
        // Ensure we have a file buffer to send to the worker
        const buffer = State.fileBuffer;
        if (!buffer){ reject('No file buffer available'); return; }

        const worker = new Worker('assets/js/worker_xlsx.js');
        let done = false;
        const finish = (ok, errMsg)=>{
          if (done) return;
          done = true;
          try{ worker.terminate(); }catch(_){}
          if (ok) resolve();
          else reject(errMsg || 'Worker parsing error');
        };

        // Safety timeout: if the worker fails to load / respond, don't freeze the UI.
        const t = setTimeout(()=>{ finish(false, 'Worker timeout'); }, 5000);

        worker.onmessage = (ev)=>{
          const data = ev.data || {};
          if (data.type === 'XLSX_PARSED'){
            try{ processParsedData(data.rows, data.meta); }catch(e){ console.error(e); }
            clearTimeout(t);
            finish(true);
          } else if (data.type === 'XLSX_ERROR'){
            clearTimeout(t);
            finish(false, data.message || 'Worker parsing error');
          }
        };
        worker.onerror = (err)=>{
          clearTimeout(t);
          finish(false, err && err.message ? err.message : String(err));
        };
        worker.onmessageerror = (err)=>{
          clearTimeout(t);
          finish(false, err && err.message ? err.message : 'Worker message error');
        };

        worker.postMessage({ type:'PARSE_XLSX', file: buffer, sheetName: sheetName || null });
      }catch(e){ reject(e); }
    });
  }
  async function handleFile(file){
    const __loadingEl = $('#loading');
    try{ if (__loadingEl) __loadingEl.style.display = "flex"; }catch(_){ }
    try {
      const data = await file.arrayBuffer();

      // New dataset: clear transient state & store raw buffer for optional worker use
      resetTransientState();
      if (!__dispatchPatch({ fileBuffer: data }, { silent: true })){
        State.fileBuffer = data;
      }

      
// Worker availability:
// - AUTO: use worker on http/https only (most reliable)
// - WORKER: attempt worker even on file:// (may still be blocked by policy)
// - SAFE: disable worker entirely
const pref = (global.App && (global.App.parseModePref || (global.App.State && global.App.State.parseModePref) || (global.App.Config && global.App.Config.parseModePref))) || 'AUTO';
const prefU = String(pref).toUpperCase();

const proto = (global.location && global.location.protocol) ? global.location.protocol : '';
const hasWorker = (typeof Worker !== 'undefined');

let canUseWorker =
  hasWorker && (
    proto === 'http:' || proto === 'https:' ||
    (proto === 'file:' && prefU === 'WORKER')
  );

if (prefU === 'SAFE' || prefU === 'FALLBACK'){
  canUseWorker = false;
}

      let parsed = false;
      let workerErrMsg = '';




      try{
        if (global.App && global.App.Mode){
          global.App.Mode.set(canUseWorker ? 'WORKER' : 'SAFE',
            canUseWorker ? 'Worker available' : 'Worker unavailable (needs http/https, or blocked by policy)');
        }
      }catch(_){}

      if (canUseWorker){
        try{
          await parseSheetWithWorker(null);
          parsed = true;
          try{ if (global.App && global.App.Mode) global.App.Mode.set('WORKER','Parsed via Web Worker'); }catch(_){}
          return; // processParsedData already rebuilds UI + sheet selector
        }catch(e){
          parsed = false;
          try{ workerErrMsg = (e && e.message) ? e.message : String(e||'Worker failed'); }catch(_){ workerErrMsg = 'Worker failed'; }
        }
      }

      // Fallback: parse on main thread
      try{
        if (global.App && global.App.Mode){
          var msg = workerErrMsg ? ('Worker failed: ' + workerErrMsg + '; Parsed on main thread (fallback)') : 'Parsed on main thread (fallback)';
          global.App.Mode.set('FALLBACK', msg);
        }
      }catch(_){}
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      if (!__dispatchPatch({ workbook: wb, sheetNames: wb.SheetNames }, { silent: true })){
        State.workbook = wb;
        State.sheetNames = wb.SheetNames;
      }

      // Build sheet selector / byte converter
      const sheetSel = document.getElementById('sheetSelect');
      const byteBox  = document.getElementById('byteConvert');
      if (wb.SheetNames.length <= 1) {
        if (sheetSel) sheetSel.parentElement.style.display = 'none';
        if (byteBox)  byteBox.style.display = 'block';
      } else {
        if (sheetSel) sheetSel.parentElement.style.display = 'block';
        if (byteBox)  byteBox.style.display = 'none';
      }

      const sel = $('#sheetSelect'); if (sel){ sel.innerHTML = ""; }
      wb.SheetNames.forEach((n,i)=>{
        const o = document.createElement("option");
        o.value = n; o.textContent = n; if(i===0) o.selected = true; sel && sel.appendChild(o);
      });
      if (sel) sel.disabled = false;

      // Load first sheet using main thread parser
      await loadSheet(wb.SheetNames[0]);
    } finally {
      try{ if (__loadingEl) __loadingEl.style.display = "none"; }catch(_){ }
    }
  }

  async function loadSheet(name){
    resetTransientState();
    const __loadingEl2 = $('#loading');
    try{ if (__loadingEl2) __loadingEl2.style.display = "flex"; }catch(_){ }
    try {
      // Attempt to parse using the worker according to current preference.
      // - AUTO   : use worker on http/https only (most reliable)
      // - WORKER : attempt worker even on file:// (may still be blocked by browser policy)
      // - SAFE   : disable worker entirely
      const pref = (global.App && (global.App.parseModePref || (global.App.State && global.App.State.parseModePref) || (global.App.Config && global.App.Config.parseModePref))) || 'AUTO';
      const prefU = String(pref).toUpperCase();
      const proto = (location && location.protocol) ? location.protocol : '';
      const hasWorker = (typeof Worker !== 'undefined');

      let canUseWorker = !!State.fileBuffer && hasWorker && (
        proto === 'http:' || proto === 'https:' ||
        (proto === 'file:' && prefU === 'WORKER')
      );
      if (prefU === 'SAFE' || prefU === 'FALLBACK') canUseWorker = false;

      let workerErrMsg2 = '';

      if (canUseWorker){
        try{
          await parseSheetWithWorker(name);
          try{ if (global.App && global.App.Mode) global.App.Mode.set('WORKER','Parsed sheet via Web Worker'); }catch(_){}
          return; // processParsedData already rebuilds UI
        }catch(e){
          // fall through to main-thread parsing
          try{ workerErrMsg2 = (e && e.message) ? e.message : String(e||'Worker failed'); }catch(_){ workerErrMsg2 = 'Worker failed'; }
        }
      }

      try{
        if (global.App && global.App.Mode){
          var msg = workerErrMsg2 ? ('Worker failed: ' + workerErrMsg2 + '; Parsed sheet on main thread (fallback)') : 'Parsed sheet on main thread (fallback)';
          global.App.Mode.set('FALLBACK', msg);
        }
      }catch(_){ }


       // Fallback: parse from an existing workbook if present
      if (State.workbook && State.workbook.Sheets){
        const ws  = State.workbook.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" });

        const base = __getCanonicalState();
        const headers = aoa.length ? aoa[0] : [];
        let ids = base.ids || 0;

        const startIdx = headers.findIndex(h=> String(h).toLowerCase().includes("start"));
        const endIdx   = headers.findIndex(h=> String(h).toLowerCase().includes("end"));
        const deductIdx= headers.findIndex(h=> String(h).toLowerCase().includes("deduct"));

        const rows = aoa.length ? aoa.slice(1).map((arr)=>{
          const o = { _id: (++ids) };
          headers.forEach((h, j)=> o[h] = arr[j]);
          o.startTime  = arr[startIdx >= 0 ? startIdx : 0];
          o.endTime    = arr[endIdx   >= 0 ? endIdx   : 1];
          o.deductFrom = arr[deductIdx >= 0 ? deductIdx : 12];
          return o;
        }) : [];

        const built = __buildIndexesFromRows(rows, base.lookupVersion || 0);
        const view = __buildViewFrom(rows, base.filter);

        const payload = {
          headers: headers,
          feeIdx: -1,
          unitIdx: -1,
          ids: ids,
          rows: rows,
          view: view,
          rowsById: built.rowsById,
          lookupVersion: built.lookupVersion,
          page: 1,
          selected: new Set(),
          detailCache: new Map(),
        };

        const Store = __getStore();
        const hasStore = !!(Store && typeof Store.dispatch === 'function');
        if (hasStore){
          Store.dispatch({ type: 'LOAD_WORKBOOK_SUCCESS', payload: payload });
        } else {
          State.headers = headers;
          State.feeIdx  = -1;
          State.unitIdx = -1;
          State.ids = ids;
          State.rows = rows;
          State.view = view;
          State.rowsById = built.rowsById;
          State.lookupVersion = built.lookupVersion;
          State.page = 1;
          global.App.View.renderTable();
          global.App.View.updateSumSelected();
        }
        return;
      } else {

        // As last resort, attempt to parse the file buffer directly using XLSX
        if (State.fileBuffer){
          const wb = XLSX.read(State.fileBuffer, { type: "array", cellDates: true });
          if (!__dispatchPatch({ workbook: wb }, { silent: true })){
            State.workbook = wb;
          }
          if (!__dispatchPatch({ sheetNames: wb.SheetNames }, { silent: true })){
            State.sheetNames = wb.SheetNames;
          }
          const ws  = wb.Sheets[name];
          const aoa = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" });

          const base = __getCanonicalState();
          const headers = aoa.length ? aoa[0] : [];
          let ids = base.ids || 0;

          const startIdx = headers.findIndex(h=> String(h).toLowerCase().includes("start"));
          const endIdx   = headers.findIndex(h=> String(h).toLowerCase().includes("end"));
          const deductIdx= headers.findIndex(h=> String(h).toLowerCase().includes("deduct"));

          const rows = aoa.length ? aoa.slice(1).map((arr)=>{
            const o = { _id: (++ids) };
            headers.forEach((h, j)=> o[h] = arr[j]);
            o.startTime  = arr[startIdx >= 0 ? startIdx : 0];
            o.endTime    = arr[endIdx   >= 0 ? endIdx   : 1];
            o.deductFrom = arr[deductIdx >= 0 ? deductIdx : 12];
            return o;
          }) : [];

          const built = __buildIndexesFromRows(rows, base.lookupVersion || 0);
          const view = __buildViewFrom(rows, base.filter);

          const payload = {
            headers: headers,
            feeIdx: -1,
            unitIdx: -1,
            ids: ids,
            rows: rows,
            view: view,
            rowsById: built.rowsById,
            lookupVersion: built.lookupVersion,
            page: 1,
            selected: new Set(),
            detailCache: new Map(),
          };

          const Store = __getStore();
          const hasStore = !!(Store && typeof Store.dispatch === 'function');
          if (hasStore){
            Store.dispatch({ type: 'LOAD_WORKBOOK_SUCCESS', payload: payload });
          } else {
            State.headers = headers;
            State.feeIdx  = -1;
            State.unitIdx = -1;
            State.ids = ids;
            State.rows = rows;
            State.view = view;
            State.rowsById = built.rowsById;
            State.lookupVersion = built.lookupVersion;
            State.page = 1;
            global.App.View.renderTable();
            global.App.View.updateSumSelected();
          }

          return;
        }
      }
    } finally {
      try{ if (__loadingEl2) __loadingEl2.style.display = "none"; }catch(_){ }
    }
  }

  // Re-parse currently loaded file buffer using the current mode preference.
  // This is used when the user changes "Mode" so that the "Active" indicator updates immediately.
  async function reparseCurrent(){
    if (!State.fileBuffer) return;
    const sheetSel = document.getElementById('sheetSelect');
    const wantedSheet = (sheetSel && sheetSel.value) ? sheetSel.value : null;
    try{
      // Use a synthetic File to reuse the same validated parsing path in handleFile.
      const f = new File([new Blob([State.fileBuffer])], 'reparse.xlsx');
      await handleFile(f);
      // Restore the previous sheet selection when possible.
      if (wantedSheet && State.sheetNames && State.sheetNames.indexOf(wantedSheet) >= 0){
        try{ if (sheetSel) sheetSel.value = wantedSheet; }catch(_){ }
        try{ await loadSheet(wantedSheet); }catch(_){ }
      }
    }catch(e){
      // Older environments without File constructor: fall back to loading the desired sheet
      try{
        if (wantedSheet) await loadSheet(wantedSheet);
      }catch(_){ }
    }
  }

  global.App = Object.assign(global.App || {}, { Data: { computeView, rebuildUI, handleFile, loadSheet, reparseCurrent } });
})(window);
