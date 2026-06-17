
(function(global){
  'use strict';
  const { $, State } = global.App;

  function __getStore(){
    try{
      const s = global.App && global.App.Store;
      return (s && typeof s.dispatch === 'function') ? s : null;
    }catch(_){ return null; }
  }

  function __getState(){
    try{
      const Store = __getStore();
      if (Store && typeof Store.getState === 'function') return Store.getState();
    }catch(_){ }
    return State;
  }

  function wireEvents(){
    // Byte converter box (only visible when 1 sheet detected)
    const byteInput = document.getElementById('byteInput');
    if (byteInput) {
      byteInput.addEventListener('input', (e)=>{
        const bytes = parseFloat(e.target.value)||0;
        const mb = bytes / (1024*1024);
        const mbInt = Math.floor(mb);
        const kbInt = Math.round((mb - mbInt) * 1024);
        document.getElementById('mbResult').textContent = mbInt;
        document.getElementById('kbResult').textContent = kbInt;
      });
    }

    // File input
    $('#fileInput').addEventListener("change", e=>{
      if (e.target.files[0]) global.App.Data.handleFile(e.target.files[0]);
    });

    // Sheet select
    $('#sheetSelect').addEventListener("change", e=> global.App.Data.loadSheet(e.target.value));

    // Filter select
    $('#filterSelect').addEventListener("change", e=>{
      const val = e.target.value;
      // Phase 2: UI does not mutate State directly; it dispatches actions only.
      const Store = __getStore();
      if (Store) {
        Store.dispatch({ type: 'SET_FILTER', filterKey: val });
      } else if (State) {
        // Legacy fallback (store not initialized)
        try{ State.filter = val; State.page = 1; }catch(_){ }
        try{ global.App.Data.rebuildUI && global.App.Data.rebuildUI(); }catch(_){ }
      }
    });

    // Page size
    $('#pageSize').addEventListener("change", e=>{
      const ps = parseInt(e.target.value)||100;
      const Store = __getStore();
      if (Store) {
        // Phase 2: UI dispatches only; reducer updates pageSize/page.
        Store.dispatch({ type: 'SET_PAGE_SIZE', pageSize: ps });
      } else if (State) {
        // legacy fallback
        try{ State.pageSize = ps; State.page = 1; }catch(_){ }
        try {
          if (global.App && global.App.View && typeof global.App.View.renderTable === 'function') {
            global.App.View.renderTable();
          }
        } catch (_) {}
      }
    });

    // Pagination
    $('#prevPage').addEventListener("click", ()=>{
      const cur = __getState() || {};
      const curPage = Number(cur.page || 1);
      if (curPage > 1){
        const newPage = curPage - 1;
        const Store = __getStore();
        if (Store) {
          Store.dispatch({ type: 'SET_PAGE', page: newPage });
        } else if (State) {
          try{ State.page = newPage; }catch(_){ }
          try {
            if (global.App && global.App.View && typeof global.App.View.renderTable === 'function') {
              global.App.View.renderTable();
            }
          } catch (_) {}
        }
      }
    });
    $('#nextPage').addEventListener("click", ()=>{
      const cur = __getState() || {};
      const base = Array.isArray(cur.viewFiltered) ? cur.viewFiltered : (Array.isArray(cur.view) ? cur.view : []);
      const pageSize = Number(cur.pageSize || 100) || 100;
      const curPage = Number(cur.page || 1);
      const maxPage = Math.max(1, Math.ceil((base.length || 0) / pageSize));
      if (curPage < maxPage){
        const newPage = curPage + 1;
        const Store = __getStore();
        if (Store) {
          Store.dispatch({ type: 'SET_PAGE', page: newPage });
        } else if (State) {
          try{ State.page = newPage; }catch(_){ }
          try {
            if (global.App && global.App.View && typeof global.App.View.renderTable === 'function') {
              global.App.View.renderTable();
            }
          } catch (_) {}
        }
      }
    });

    // Select all visible
    $('#checkAllVisible').addEventListener("change", (e)=>{
      const checked = !!e.target.checked;
      const cur = __getState() || {};
      const base = Array.isArray(cur.viewFiltered) ? cur.viewFiltered : (Array.isArray(cur.view) ? cur.view : []);
      const pageSize = Number(cur.pageSize || 100) || 100;
      const page = Number(cur.page || 1) || 1;
      const start = (page - 1) * pageSize;
      const pageData = base.slice(start, start + pageSize);
      const ids = pageData.map(r => r && r._id).filter(Boolean);
      const Store = __getStore();
      if (Store) {
        Store.dispatch(checked ? { type: 'SELECT_IDS', ids } : { type: 'DESELECT_IDS', ids });
      } else if (State && State.selected) {
        // legacy fallback
        pageData.forEach(r => {
          try{ if (checked) State.selected.add(r._id); else State.selected.delete(r._id); }catch(_){ }
        });
        try{ global.App.View && global.App.View.updateSumSelected && global.App.View.updateSumSelected(); }catch(_){ }
      }
    });

    // Clear selection
    $('#clearSelection').addEventListener("click", ()=>{
      const Store = __getStore();
      if (Store) {
        Store.dispatch({ type: 'CLEAR_SELECTION' });
      } else if (State && State.selected) {
        try{ State.selected.clear(); }catch(_){ }
        try{ global.App.View && global.App.View.updateSumSelected && global.App.View.updateSumSelected(); }catch(_){ }
      }
      try {
        document.querySelectorAll('#dataTable tbody input[type="checkbox"]').forEach(cb => cb.checked = false);
      } catch (_) {}
      try { $('#checkAllVisible').checked = false; } catch (_) {}
    });
  }

  global.App = Object.assign(global.App || {}, { Controller: { wireEvents } });
})(window);
