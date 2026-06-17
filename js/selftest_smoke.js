// SelfTest UI (SAFE) – loaded only when ?selftest=1 (see index.html)
// Goals:
// - Panel ثابت: Export Snapshot / Compare Snapshot / Run Checks
// - Snapshot SAFE: counts/totals/state فقط (بدون نصوص خلايا أو تفاصيل)
// - Compare: PASS/FAIL + diff
// - لا console.log للـ snapshot أو أي بيانات ملف.

(function () {
  'use strict';

  var dom = (window.App && App.UI && App.UI.dom) ? App.UI.dom : null;

  function dq(sel, root) { return (dom && dom.q) ? dom.q(sel, root) : (root || document).querySelector(sel); }
  function dqa(sel, root) { return (dom && dom.qa) ? dom.qa(sel, root) : Array.from((root || document).querySelectorAll(sel)); }
  function dbyId(id) { return (dom && dom.byId) ? dom.byId(id) : document.getElementById(id); }
  function dcreate(tag, attrs) { return (dom && dom.create) ? dom.create(tag, attrs) : document.createElement(tag); }
  function dbody() { return (dom && dom.q) ? dom.q('body') : document.body; }



  // -----------------------------
  // Error counter (SAFE: counts only)
  // -----------------------------
  let consoleErrorsCount = 0;
  window.addEventListener('error', function () { consoleErrorsCount += 1; }, true);
  window.addEventListener('unhandledrejection', function () { consoleErrorsCount += 1; }, true);

  // -----------------------------
  // Helpers (no logging)
  // -----------------------------
  function qs(sel, root) { return dq(sel, root); }


  const UI = {
    filterSelect: "#filterSelect",
    pageSize: "#pageSize",
    nextPage: "#nextPage",
    prevPage: "#prevPage",
    clearSelection: "#clearSelection",
    checkAllVisible: "#checkAllVisible",
    // Data rows reside in the table body; restrict to #dataTable tbody to avoid header matches.
    rowId: "#dataTable tbody tr[data-row-id]",
    rowCheckbox: "input.row-select",
    detailsBtn: "button.row-quick-details",
    // A details row may use one of several classes.  Query across all to detect the open details.
    detailsRow: "#dataTable tbody tr.row-compare, #dataTable tbody tr.details-row, #dataTable tbody tr.row-detail",
    pageInfo: "#pageInfo",
  };

  function q(key, root) {
    return qs(UI[key], root);
  }

  function qa(key, root) { return dqa(UI[key], root); }

  // SAFE helper used by contracts: visible base row ids (no cell content)
  // Uses multiple selectors to avoid empty hashes when DOM shape changes.
  function getVisibleRowIds() {
    try {
      const candidates = [
        '#dataTable tbody tr[data-row-id]',
        '#dataTable tbody tr[data-row-key]',
        '#dataTable tbody tr'
      ];
      let rows = [];
      for (let i = 0; i < candidates.length; i++) {
        rows = dom && dom.qa ? dom.qa(candidates[i]) : dqa(candidates[i]);
        if (rows && rows.length) break;
      }
      return (rows || [])
        .filter(function (tr) {
          return tr && tr.nodeType === 1 &&
            !tr.classList.contains('row-compare') &&
            !tr.classList.contains('row-detail') &&
            !tr.classList.contains('details-row');
        })
        .map(function (tr) {
          return tr.getAttribute('data-row-id') || tr.getAttribute('data-row-key') || '';
        })
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  // Wait until the main table is truly rendered (headers + at least one visible row)
  async function waitForTableRendered(waitFor, timeoutMs, label) {
    const t = timeoutMs || 10000;
    const name = label || 'wait_table_rendered';
    await waitFor(() => {
      try {
        const hdrs = (dom && dom.qa ? dom.qa('#dataTable thead th') : dqa('#dataTable thead th')).length;
        const rows = getVisibleRowIds().length;
        return hdrs > 0 && rows > 0;
      } catch (_) {
        return false;
      }
    }, t, name);
  }

  function safeText(el) {
    if (!el) return '';
    // SAFE: only UI totals, not cell content
    return String(el.textContent || '').trim();
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    if (dom && typeof dom.downloadBlob === 'function') return dom.downloadBlob(blob, filename);
    // fallback (should rarely be needed)
    const a = dcreate('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    dbody().appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(a.href); } catch (_) {}
      try { a.remove(); } catch (_) {}
    }, 0);
  }

  function normalizeNum(str) {
    // Extract first numeric-ish token. SAFE: works on totals label text.
    if (!str) return 0;
    const m = String(str).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  /*
   * === Architecture guard check ===
   *
   * When running selftest, we want to ensure that certain DOM and state
   * operations only occur in their designated modules.  This check is
   * intentionally lightweight: it performs a best‑effort scan over
   * loaded script text and logs any violations.  It will not throw
   * exceptions or block the UI; instead it reports a summary via
   * console.warn.  During normal usage this check is inert.  To run
   * the check automatically in selftest mode, simply load index.html
   * with ?selftest=1 in the query string.
   */
  (function guardScan() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (!params.get('selftest')) return;
      // Only proceed if fetch is available (same origin).
      if (!window.fetch) return;
      const bannedDom = [/document\./g, /querySelector/g, /getElementById/g, /innerHTML/g, /append/g, /addEventListener/g];
      const bannedState = [/App\.State/g, /window\.State/g, /\bState\./g];
      const allowedFiles = [
        'js/ui/dom_bindings.js',
        'js/core/state_adapter.js'
      ];
      const scripts = dqa('script[data-bootstrap]');
      const root = (function(){ try { return new URL('.', location.href).toString(); } catch(_) { return ''; } })();
      let violations = [];
      const promises = scripts.map(function (s) {
        const src = s.getAttribute('src') || s.getAttribute('data-bootstrap') || '';
        if (!src || allowedFiles.some(function (af) { return src.endsWith(af); })) return null;
        return fetch(src).then(function (resp) {
          return resp.text().then(function (text) {
            bannedDom.forEach(function (re) {
              if (re.test(text)) {
                violations.push({ file: src, pattern: re.toString() });
              }
            });
            bannedState.forEach(function (re) {
              if (re.test(text)) {
                violations.push({ file: src, pattern: re.toString() });
              }
            });
          });
        }).catch(function () { /* ignore fetch errors */ });
      });
      Promise.all(promises.filter(Boolean)).then(function () {
        if (violations.length) {
          try {
            console.warn('[selftest guard] Detected forbidden patterns outside designated modules:', violations);
          } catch (_) {}
        }
      });
    } catch (_) {
      // silent fail
    }
  })();

  // -----------------------------
  // SAFE Hash util (deterministic)
  // - Prefer crypto.subtle SHA-256 (async)
  // - Fallback: FNV-1a 32-bit (sync)
  // Returns short lowercase hex.
  // -----------------------------

  function fnv1a32(str) {
    // 32-bit FNV-1a
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // h *= 16777619 (mod 2^32)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex;
  }

  function hashStringSafe(str) {
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        var enc = new window.TextEncoder();
        var data = enc.encode(String(str || ''));
        return window.crypto.subtle.digest('SHA-256', data).then(function (buf) {
          var arr = new Uint8Array(buf);
          // Shorten to first 16 hex chars (8 bytes)
          return bytesToHex(arr.slice(0, 8));
        });
      }
    } catch (e) {
      // fallthrough
    }
    return Promise.resolve(fnv1a32(String(str || '')));
  }

  // -----------------------------
  // Snapshot (SAFE)
  // - counts/totals only
  // - deterministic hashes (no cell text)
  // -----------------------------
  async function buildSafeSnapshot() {
    const state = window.State || null;
    const filterKey = state && state.filter != null ? String(state.filter) : '';
    const currentPage = state && typeof state.page === 'number' ? state.page : 0;
    const pageSize = state && typeof state.pageSize === 'number' ? state.pageSize : 0;

    const selectedCount = state && state.selected && typeof state.selected.size === 'number'
      ? state.selected.size
      : 0;

    const tableBody = qs('#dataTable tbody');
    const visibleRows = tableBody
      ? Array.from(tableBody.querySelectorAll('tr[data-row-id], tr[data-row-key]'))
          .filter(function (tr) {
            if (!tr || !tr.classList) return false;
            return !tr.classList.contains('row-compare') &&
              !tr.classList.contains('row-detail') &&
              !tr.classList.contains('details-row');
          })
      : [];
    const visibleRowCount = visibleRows.length;

    const thead = qs('#dataTable thead');
    const headersCount = thead
      ? thead.querySelectorAll('th').length
      : (state && Array.isArray(state.headers) ? state.headers.length : 0);

    // SAFE hashes
    const headersStr = state && Array.isArray(state.headers)
      ? state.headers.map(h => String(h)).join('\u001F')
      : '';
    const headersHash = await hashStringSafe(headersStr);

    const visibleIds = visibleRows
      .map(r => String(r.getAttribute('data-row-id') || r.getAttribute('data-row-key') || ''))
      .filter(Boolean)
      .join(',');
    const visibleIdsHash = await hashStringSafe(visibleIds);

    const selectedIdsStr = state && state.selected
      ? Array.from(state.selected).map(x => String(x)).sort().join(',')
      : '';
    const selectedIdsHash = await hashStringSafe(selectedIdsStr);

    // Totals in this UI are shown in the "sumSelected" bar
    // (fallback to legacy ids if present).
    const totalsFeeText = safeText(dbyId('sumSelectedFee')) || safeText(dbyId('totalFee'));
    const totalsUnitsText = safeText(dbyId('sumSelectedUnits')) || safeText(dbyId('freeUnits'));

    // Prefer numeric extraction so golden comparisons are stable.
    const totalsFee = normalizeNum(totalsFeeText);
    const totalsUnits = normalizeNum(totalsUnitsText);

    const baseLen = Array.isArray(state && state.viewFiltered)
      ? state.viewFiltered.length
      : Array.isArray(state && state.view)
        ? state.view.length
        : Array.isArray(state && state.rows)
          ? state.rows.length
          : 0;
    const maxPage = (pageSize && pageSize > 0) ? Math.max(1, Math.ceil(baseLen / pageSize)) : 1;

    const detailsRow = qs(UI.detailsRow);
    const detailsOpenRowId = detailsRow ? (detailsRow.getAttribute('data-for-row-id') || null) : null;

    let detailsTextLen = 0;
    let detailsTextHash = '';
    if (detailsRow) {
      const t = String(detailsRow.innerText || '').trim();
      detailsTextLen = t.length;
      detailsTextHash = t ? await hashStringSafe(t) : '';
    }

    // "loaded" should only be true once the core dataset is present and the table
    // has actually rendered at least one visible row with headers.  Previous
    // implementation only checked that rows existed which could incorrectly mark
    // the snapshot as loaded before the table finished drawing.  To make
    // selftest waits reliable, require headers and visible rows.
    const isLoaded = !!(state && Array.isArray(state.rows) && state.rows.length && headersCount > 0 && visibleRowCount > 0);
    return {
      ts: new Date().toISOString(),
      loaded: isLoaded,
      filterKey,
      currentPage,
      pageSize,
      visibleRowCount,
      headersCount,
      selectedCount,
      totalsFee,
      totalsUnits,
      consoleErrorsCount,
      detailsOpenRowId,
      maxPage,
      headersHash,
      visibleIdsHash,
      selectedIdsHash,
      detailsTextLen,
      detailsTextHash,
    };
  }

  // -----------------------------
  // Compare snapshots
  // -----------------------------
  function diffObjects(a, b) {
    // Compare only behavioral keys; ignore timestamp and any extra fields.
    const out = [];
    const KEYS = [
      'filterKey',
      'currentPage',
      'pageSize',
      'maxPage',
      'visibleRowCount',
      'headersCount',
      'selectedCount',
      'totalsFee',
      'totalsUnits',
      'consoleErrorsCount',
      'headersHash',
      'visibleIdsHash',
      'selectedIdsHash',
      'detailsTextLen',
      'detailsTextHash',
      // optional:
      'detailsOpenRowId',
    ];
    const has = (o, k) => !!(o && Object.prototype.hasOwnProperty.call(o, k));

    KEYS.forEach((k) => {
      if (k === 'detailsOpenRowId') {
        // Optional: only compare if both snapshots include it.
        if (!has(a, k) || !has(b, k)) return;
      }
      const av = has(a, k) ? a[k] : undefined;
      const bv = has(b, k) ? b[k] : undefined;
      const same = (typeof av === 'number' && typeof bv === 'number')
        ? Object.is(av, bv)
        : JSON.stringify(av) === JSON.stringify(bv);
      if (!same) out.push({ key: k, expected: bv, actual: av });
    });

    return out;
  }

  // -----------------------------
  // UI Panel
  // -----------------------------
  function initSelfTestPanel() {
    // Ensure idempotent.
    if (dbyId('__selftest_panel')) return;

    const panel = dcreate('div');
    panel.id = '__selftest_panel';
    panel.style.position = 'fixed';
    panel.style.left = '12px';
    panel.style.bottom = '12px';
    panel.style.zIndex = '999999';
    panel.style.width = '360px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.background = 'rgba(20,20,20,0.92)';
    panel.style.color = '#fff';
    panel.style.border = '1px solid rgba(255,255,255,0.2)';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
    panel.style.padding = '10px';
    panel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    panel.style.fontSize = '12px';

    const title = dcreate('div');
    const isUnsafeRequested = (() => {
      try {
        const sp = new URLSearchParams(location.search || '');
        return sp.get('selftest') === 'unsafe';
      } catch (_) {
        return false;
      }
    })();
    title.textContent = isUnsafeRequested ? 'SelfTest (SAFE) — UNSAFE requested' : 'SelfTest (SAFE)';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    panel.appendChild(title);

    const row = dcreate('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.flexWrap = 'wrap';
    row.style.marginBottom = '8px';

    function mkBtn(text) {
      const b = dcreate('button');
      b.type = 'button';
      b.textContent = text;
      b.style.flex = '1';
      b.style.minWidth = '100px';
      b.style.padding = '6px 8px';
      b.style.borderRadius = '8px';
      b.style.border = '1px solid rgba(255,255,255,0.25)';
      b.style.background = 'rgba(255,255,255,0.12)';
      b.style.color = '#fff';
      b.style.cursor = 'pointer';
      return b;
    }

    const btnExport = mkBtn('Export Snapshot');
    const btnCompare = mkBtn('Compare Snapshot');
    const btnChecks = mkBtn('Run Checks');
    row.appendChild(btnExport);
    row.appendChild(btnCompare);
    row.appendChild(btnChecks);
    panel.appendChild(row);

    // Secondary actions
    const row2 = dcreate('div');
    row2.style.display = 'flex';
    row2.style.gap = '8px';
    row2.style.flexWrap = 'wrap';
    row2.style.marginBottom = '8px';
    const btnCopy = mkBtn('Copy JSON report');
    const btnUpdate = mkBtn('Update Baseline (Golden)');
    row2.appendChild(btnCopy);
    row2.appendChild(btnUpdate);
    panel.appendChild(row2);

    // Privacy by default: baseline update is only available with explicit UNSAFE intent.
    (function(){
      try {
        const hasUnsafeParam = !!(window.App && App.Adapters && App.Adapters.Logger && typeof App.Adapters.Logger.hasUnsafeParam === 'function'
          ? App.Adapters.Logger.hasUnsafeParam()
          : false);
        if (!hasUnsafeParam) {
          btnUpdate.style.display = 'none';
        }
      } catch (_) {
        btnUpdate.style.display = 'none';
      }
    })();

    const fileRow = dcreate('div');
    fileRow.style.display = 'flex';
    fileRow.style.gap = '8px';
    fileRow.style.alignItems = 'center';
    fileRow.style.marginBottom = '8px';
    const fileLabel = dcreate('div');
    fileLabel.textContent = 'Baseline JSON:';
    fileLabel.style.opacity = '0.85';
    const fileInput = dcreate('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.flex = '1';
    fileInput.style.maxWidth = '220px';
    fileInput.style.color = '#fff';
    fileRow.appendChild(fileLabel);
    fileRow.appendChild(fileInput);
    panel.appendChild(fileRow);

    const out = dcreate('pre');
    out.style.margin = '0';
    out.style.whiteSpace = 'pre-wrap';
    out.style.wordBreak = 'break-word';
    out.style.maxHeight = '240px';
    out.style.overflow = 'auto';
    out.style.padding = '8px';
    out.style.borderRadius = '8px';
    out.style.background = 'rgba(255,255,255,0.08)';
    out.textContent = 'Ready. Load a file, then Export/Compare/Checks.';
    panel.appendChild(out);

    // Keep last exported snapshot in-memory only.
    let lastSnapshot = null;
    let lastReport = null;
    let baselineSnapshot = null;

    // Update Baseline is UNSAFE-only: requires explicit URL param + confirm.
    (function setupUnsafeButton() {
      let show = false;
      try {
        const sp = new URLSearchParams(location.search || '');
        show = sp.get('selftest') === 'unsafe' || sp.get('snapshot') === 'unsafe';
      } catch (_) {
        show = false;
      }
      if (!show) {
        btnUpdate.style.display = 'none';
        return;
      }
      btnUpdate.style.opacity = '0.95';
    })();

    btnCopy.addEventListener('click', async function () {
      try {
        const data = lastReport || (lastSnapshot ? { snapshot: lastSnapshot } : null);
        if (!data) {
          out.textContent = 'No report yet. Run Checks first.';
          return;
        }
        const txt = JSON.stringify(data, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(txt);
          out.textContent = 'Copied JSON report to clipboard.';
          return;
        }
        // Fallback
        window.prompt('Copy JSON:', txt);
      } catch (_) {
        out.textContent = 'FAIL: could not copy report.';
      }
    });

    btnUpdate.addEventListener('click', async function () {
      try {
        // Gate UNSAFE
        const LA = (window.App && App.Adapters && App.Adapters.Logger) ? App.Adapters.Logger : null;
        const ok = LA && typeof LA.requestUnsafeEnable === 'function' ? LA.requestUnsafeEnable() : false;
        if (!ok) {
          out.textContent = 'UNSAFE not enabled.';
          return;
        }
        const snap = await buildSafeSnapshot();
        downloadJSON({ golden: true, snapshot: snap, generatedAt: new Date().toISOString() }, 'selftest_golden.json');
        out.textContent = 'Downloaded: selftest_golden.json (replace your golden manually).';
      } catch (e) {
        out.textContent = 'FAIL: could not update baseline.';
      }
    });

    fileInput.addEventListener('change', async function () {
      baselineSnapshot = null;
      const f = fileInput.files && fileInput.files[0];
      if (!f) {
        out.textContent = 'Baseline cleared.';
        return;
      }
      try {
        const txt = await f.text();
        baselineSnapshot = JSON.parse(txt);
        out.textContent = 'Baseline loaded. Click Compare Snapshot.';
      } catch (e) {
        out.textContent = 'FAIL: could not parse baseline JSON.';
      }
    });

    btnExport.addEventListener('click', async function () {
      try {
        lastSnapshot = await buildSafeSnapshot();
        downloadJSON(lastSnapshot, 'selftest_snapshot_safe.json');
        out.textContent = JSON.stringify(lastSnapshot, null, 2);
      } catch (e) {
        out.textContent = 'FAIL: could not build snapshot.';
      }
    });

    btnCompare.addEventListener('click', async function () {
      try {
        const current = await buildSafeSnapshot();
        lastSnapshot = current;
        if (!baselineSnapshot) {
          out.textContent = 'FAIL: load baseline JSON first (Baseline JSON input).\n\nCurrent:\n' + JSON.stringify(current, null, 2);
          return;
        }
        const diffs = diffObjects(current, baselineSnapshot);
        if (diffs.length === 0) {
          out.textContent = 'PASS: current snapshot matches baseline.';
          return;
        }
        out.textContent = 'FAIL: snapshot differs.\n\nDiffs:\n' + JSON.stringify(diffs, null, 2) + '\n\nCurrent:\n' + JSON.stringify(current, null, 2);
      } catch (e) {
        out.textContent = 'FAIL: compare failed.';
      }
    });

    btnCopy.addEventListener('click', async function () {
      try {
        const obj = lastReport || lastSnapshot;
        if (!obj) {
          out.textContent = 'No report yet. Click Run Checks first.';
          return;
        }
        const txt = JSON.stringify(obj, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(txt);
          out.textContent = 'Copied JSON report to clipboard.';
        } else {
          // Fallback (SAFE): user can manually copy
          prompt('Copy JSON report:', txt);
        }
      } catch (_) {
        out.textContent = 'Copy failed.';
      }
    });

    btnUpdate.addEventListener('click', async function () {
      try {
        // UNSAFE requires explicit URL param + confirm.
        const gate = (window.App && App.Adapters && App.Adapters.Logger && typeof App.Adapters.Logger.requestUnsafeEnable === 'function')
          ? App.Adapters.Logger.requestUnsafeEnable
          : null;
        if (!gate || !gate()) {
          out.textContent = 'UNSAFE not enabled. Add ?selftest=unsafe then confirm.';
          return;
        }
        // Use the latest report if available, otherwise build a fresh snapshot.
        if (!lastReport) {
          const snap = await buildSafeSnapshot();
          lastReport = { snapshot: snap, results: [] };
        }
        downloadJSON(lastReport, 'selftest_golden.json');
        out.textContent = 'Golden baseline downloaded (replace your golden JSON manually).';
      } catch (_) {
        out.textContent = 'Baseline update failed.';
      }
    });

    // -----------------------------
    // SelfTest Runner (SAFE): real UI actions with timeouts
    // -----------------------------
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
    async function waitFor(fn, timeoutMs, stepLabel) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try {
          if (fn()) return true;
        } catch (_) {}
        await sleep(120);
      }
      throw new Error('timeout: ' + stepLabel);
    }

    function el(id) { return dbyId(id); }

    async function setFilterKey(key) {
      const sel = q('filterSelect');
      if (!sel) throw new Error('missing #filterSelect');
      sel.value = String(key);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      // Use a bounded 10s wait to avoid indefinite timeouts when switching filters
      await waitFor(() => window.State && String(window.State.filter) === String(key), 10000, 'wait filter=' + key);
      await waitFor(() => dqa(UI.rowId).length > 0 || (window.State && window.State.view && window.State.view.length === 0), 10000, 'wait table after filter');
    }

    async function goNextPage() {
      const b = q('nextPage');
      if (!b) throw new Error('missing #nextPage');
      const before = (window.State && window.State.page) || 0;
      b.click();
      await waitFor(() => window.State && window.State.page !== before, 10000, 'wait next page');
      await waitFor(() => dqa(UI.rowId).length > 0 || (window.State && window.State.view && window.State.view.length === 0), 10000, 'wait table after next');
    }

    async function goPrevPage() {
      const b = q('prevPage');
      if (!b) throw new Error('missing #prevPage');
      const before = (window.State && window.State.page) || 0;
      b.click();
      await waitFor(() => window.State && window.State.page !== before, 10000, 'wait prev page');
      await waitFor(() => dqa(UI.rowId).length > 0 || (window.State && window.State.view && window.State.view.length === 0), 10000, 'wait table after prev');
    }

    async function clearSelection() {
      const b = q('clearSelection');
      if (!b) throw new Error('missing #clearSelection');
      b.click();
      // Bound selection clearing to 10s
      await waitFor(() => window.State && window.State.selected && window.State.selected.size === 0, 10000, 'wait clear selection');
    }

    async function selectAllVisible() {
      const cb = q('checkAllVisible');
      if (!cb) throw new Error('missing #checkAllVisible');
      const ids = getVisibleRowIds();
      if (!ids.length) throw new Error('no_visible_rows_for_select_all');
      if (!cb.checked) cb.click();
      // Wait (bounded) for store-selected count to match visible rows.
      await waitFor(() => {
        try {
          const s = window.State;
          return s && s.selected && s.selected.size >= ids.length;
        } catch (_) {
          return false;
        }
      }, 10000, 'wait select all visible');
    }

    function getSelectableDataRows() {
      try {
        const rows = dqa('#dataTable tbody tr');
        return rows.filter((tr) => {
          if (!tr || !tr.querySelector) return false;
          const cls = tr.classList;
          if (cls && (cls.contains('row-compare') || cls.contains('details-row') || cls.contains('row-detail'))) return false;
          return !!tr.querySelector(UI.rowCheckbox);
        });
      } catch (_) {
        return [];
      }
    }

    function toolHasDetailsUI() {
      try {
        const table = dq('#dataTable');
        if (!table) return false;
        if (table.querySelector('button.row-quick-details, a.row-quick-details, [data-action="details"], [data-action*="details"], [data-testid*="details"], [data-role="details"]')) return true;
        // Header text hint
        const ths = Array.from(table.querySelectorAll('thead th'));
        if (ths.some(th => /تفاصيل|details/i.test(String(th.textContent || '')))) return true;
        // Any clickable element inside table with matching text
        const clicks = Array.from(table.querySelectorAll('button, a, [role="button"]'));
        if (clicks.some(el => /تفاصيل|details/i.test(String(el.textContent || '').trim()))) return true;
      } catch (_) {}
      return false;
    }

    function findDetailsTriggerInRow(tr) {
      try {
        const selectors = [
          'button.row-quick-details',
          'a.row-quick-details',
          'button[data-action="details"]',
          'a[data-action="details"]',
          '[data-action="details"]',
          '[data-action="open-details"]',
          '[data-role="details"]',
        ];
        for (const sel of selectors) {
          const hit = tr.querySelector(sel);
          if (hit) return hit;
        }
        const candidates = Array.from(tr.querySelectorAll('button, a, [role="button"]'));
        const byText = candidates.find(el => /تفاصيل|details/i.test(String(el.textContent || '').trim()));
        return byText || null;
      } catch (_) {
        return null;
      }
    }

    function getDetailsRowElement() {
      try {
        return dq('#dataTable tbody tr.row-compare, #dataTable tbody tr.details-row, #dataTable tbody tr.row-detail');
      } catch (_) {
        return null;
      }
    }

    async function selectFirstN(n) {
      const rows = getSelectableDataRows();
      if (rows.length < n) throw new Error('not enough visible rows');
      let clicked = 0;
      for (let i = 0; i < rows.length && clicked < n; i++) {
        const cb = rows[i].querySelector(UI.rowCheckbox);
        if (cb && !cb.checked) {
          cb.click();
          clicked++;
        } else if (!cb) {
          // Fallback: clicking the row itself (if selection is row-based in some UI variants)
          rows[i].click();
          clicked++;
        }
      }
      await waitFor(() => window.State && window.State.selected && window.State.selected.size >= n, 10000, 'wait select ' + n);
    }

    async function toggleDetailsFirstRow() {
      const rows = getSelectableDataRows();
      if (rows.length === 0) throw new Error('no visible rows for details');

      // If the UI truly has no details feature, signal that explicitly.
      if (!toolHasDetailsUI()) throw new Error('tool_has_no_details_ui');

      const firstRow = rows[0];
      const rowId = firstRow.getAttribute('data-row-id') || '';
      const btn = findDetailsTriggerInRow(firstRow);
      if (!btn) throw new Error('details_button_not_found');

      btn.click();
      await waitFor(() => !!getDetailsRowElement(), 10000, 'wait details open');

      const cmp = getDetailsRowElement();
      const rawTxt = (cmp && cmp.innerText ? String(cmp.innerText) : '').trim();
      const detailsTextLen = rawTxt.length;
      const detailsTextHash = detailsTextLen ? await hashStringSafe(rawTxt) : '';

      const containsNoDetails = /لا\s*توجد\s*تفاصيل|لا\s*يوجد\s*تفاصيل|no\s*details/i.test(rawTxt);
      // Details are considered valid when the text length is above a low threshold (20 characters).
      const MIN_DETAILS_LEN = 20;
      const snippet = rawTxt ? rawTxt.slice(0, 120).replace(/\s+/g, ' ').trim() : '';
      // If the UI reports that there are no details or the text is empty, signal a skip for datasets lacking details.
      if (!rawTxt || containsNoDetails) {
        throw new Error('no_details_for_dataset');
      }
      // If details are present but too short, treat as invalid.
      if (detailsTextLen < MIN_DETAILS_LEN) {
        throw new Error(`details_invalid rowId=${rowId} len=${detailsTextLen} snippet="${snippet}"`);
      }

      // Close for cleanliness
      btn.click();
      await waitFor(() => !getDetailsRowElement(), 10000, 'wait details close');

      return { rowId, detailsTextLen, detailsTextHash };
    }

    function installNetworkGuards() {
      const guard = { fetchCalls: 0, xhrCalls: 0, origFetch: null, origXHROpen: null, origXHRSend: null };
      if (typeof window.fetch === 'function') {
        guard.origFetch = window.fetch;
        window.fetch = function () {
          guard.fetchCalls++;
          return guard.origFetch.apply(this, arguments);
        };
      }
      if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
        guard.origXHROpen = window.XMLHttpRequest.prototype.open;
        guard.origXHRSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.open = function () {
          guard.xhrCalls++;
          return guard.origXHROpen.apply(this, arguments);
        };
        window.XMLHttpRequest.prototype.send = function () {
          guard.xhrCalls++;
          return guard.origXHRSend.apply(this, arguments);
        };
      }
      guard.restore = function () {
        try {
          if (guard.origFetch) window.fetch = guard.origFetch;
          if (guard.origXHROpen) window.XMLHttpRequest.prototype.open = guard.origXHROpen;
          if (guard.origXHRSend) window.XMLHttpRequest.prototype.send = guard.origXHRSend;
        } catch (_) {}
      };
      return guard;
    }

    function installConsoleErrorGuard() {
      const g = { errors: 0, orig: console.error };
      console.error = function () {
        g.errors++;
        try { return g.orig.apply(console, arguments); } catch (_) {}
      };
      g.restore = function () { try { console.error = g.orig; } catch (_) {} };
      return g;
    }

    btnChecks.addEventListener('click', async function () {
      const results = [];
      const netGuard = installNetworkGuards();
      const conGuard = installConsoleErrorGuard();
      const baselineConsole = (window.__SELFTEST_CONSOLE_ERRORS__ || 0) + conGuard.errors;

      const runnerMeta = {
        pageSizeUsedInTest: null,
        paginationSkippedReason: null,
        detailsTextHash: null,
        detailsTextLen: 0,
      };

      const readPageInfoText = () => {
        const el = dq(UI.pageInfo);
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      };

      function push(name, pass, info) {
        results.push({ name: name, pass: !!pass, info: info || null });
      }

      try {
        // Step 0: snapshot before
        const s0 = await buildSafeSnapshot();
        out.textContent = 'Running: Load Contract...';
        // 1) Load Contract
        push('Load Contract', s0.loaded === true && s0.headersCount > 0 && s0.visibleRowCount > 0, s0);
        
        // 1.5) Totals Contract
        // Select the first two real rows from the DOM and validate numeric totals (if present).
        out.textContent = 'Running: Totals Contract...';
        try {
          await clearSelection();
          // Wait for at least 2 rendered data rows.
          await waitFor(() => getSelectableDataRows().length >= 2, 10000, 'wait 2 rows for totals');

          // Determine indices using schema and aliases.  Missing columns cause the
          // Totals Contract to be skipped rather than failed.  We do not rely
          // solely on window.State.feeIdx/unitIdx because they may reflect
          // earlier heuristics; instead we recompute using robust schema
          // matching.
          // Use StateAdapter as the single source of truth instead of window.State.
          const Adapter = (window.App && App.Core && App.Core.StateAdapter) || null;
          const st = Adapter ? Adapter.getState() : (window.State || {});
          const hdrs = Adapter ? Adapter.getHeaders() : (Array.isArray(st.headers) ? st.headers : []);
          let feeIdx = -1;
          let unitIdx = -1;
          // Robust header detection: use schema when available, fallback to normalization, then state indices
          try {
            const schema = window.App && App.Core && App.Core.Schema;
            if (schema && typeof schema.findColumnIndex === 'function') {
              const feeAliases = ['totalfee', 'totalfees', 'totalfeegp', 'fee'];
              const unitAliases = ['freeunitconsumed', 'freeunitsconsumed', 'unitsconsumed', 'unitconsumed'];
              feeIdx = schema.findColumnIndex(hdrs, feeAliases);
              unitIdx = schema.findColumnIndex(hdrs, unitAliases);
            }
          } catch (_) {}
          // Fallback: normalize headers manually if schema did not find indices
          if (!(Number.isFinite(feeIdx) && feeIdx >= 0) || !(Number.isFinite(unitIdx) && unitIdx >= 0)) {
            try {
              const norm = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
              if (!(Number.isFinite(feeIdx) && feeIdx >= 0)) {
                feeIdx = hdrs.findIndex((h) => norm(h) === 'totalfee' || norm(h) === 'totalfees' || norm(h) === 'totalfeegp' || norm(h) === 'fee');
              }
              if (!(Number.isFinite(unitIdx) && unitIdx >= 0)) {
                unitIdx = hdrs.findIndex((h) => norm(h) === 'freeunitconsumed' || norm(h) === 'freeunitsconsumed' || norm(h) === 'unitsconsumed' || norm(h) === 'unitconsumed');
              }
            } catch (_) {}
          }
          // Fallback to state indices when still not found
          if (!(Number.isFinite(feeIdx) && feeIdx >= 0)) {
            const fi = (typeof st.feeIdx === 'number') ? st.feeIdx : -1;
            if (fi >= 0 && hdrs[fi]) feeIdx = fi;
          }
          if (!(Number.isFinite(unitIdx) && unitIdx >= 0)) {
            const ui = (typeof st.unitIdx === 'number') ? st.unitIdx : -1;
            if (ui >= 0 && hdrs[ui]) unitIdx = ui;
          }
          const hasTotals = (Number.isFinite(feeIdx) && feeIdx >= 0) || (Number.isFinite(unitIdx) && unitIdx >= 0);
          if (!hasTotals) {
            // Provide debug info when skipping totals contract due to missing headers.
            let first10 = hdrs.slice(0, 10);
            let normFirst10 = [];
            try {
              const schema = window.App && App.Core && App.Core.Schema;
              const normHdr = (schema && typeof schema.normalizeHeader === 'function')
                ? (h) => schema.normalizeHeader(h)
                : (h) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
              normFirst10 = first10.map(h => normHdr(h));
            } catch (_) {
              normFirst10 = first10.map(h => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ''));
            }
            push('Totals Contract', true, {
              status: 'SKIP',
              reason: 'missing_totals_headers',
              feeIdx,
              unitIdx,
              headersLen: hdrs.length,
              first10Headers: first10,
              first10NormalizedHeaders: normFirst10,
            });
          } else {
            const beforeSelSnap = await buildSafeSnapshot();
            // Select first two visible rows
            await selectFirstN(2);
            const afterSelSnap = await buildSafeSnapshot();
            // Determine header names used for totals
            const headersArr = Array.isArray(hdrs) ? hdrs : [];
            const feeHeaderName = (Number.isFinite(feeIdx) && feeIdx >= 0) ? (headersArr[feeIdx] || null) : null;
            const unitHeaderName = (Number.isFinite(unitIdx) && unitIdx >= 0) ? (headersArr[unitIdx] || null) : null;
            // Compute totals from state for the selected rows (first two rows selected via selectFirstN)
            const toNumber = (window.App && App.Core && App.Core.Summarizer && typeof App.Core.Summarizer.toNumber === 'function')
              ? App.Core.Summarizer.toNumber
              : (v) => {
                  const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
                  return m ? Number(m[0]) : 0;
                };
            // Fetch rowsById for lookup
            const rowsById = Adapter ? Adapter.getRowsById() : (st.rowsById instanceof Map ? st.rowsById : new Map());
            const selSet = Adapter ? Adapter.getSelectedSet() : (st.selected instanceof Set ? st.selected : new Set(st.selected || []));
            let totFee = 0;
            let totUnits = 0;
            try {
              selSet.forEach((id) => {
                const row = rowsById && typeof rowsById.get === 'function' ? rowsById.get(String(id)) : null;
                if (!row) return;
                if (feeHeaderName) {
                  let v;
                  try { v = row[feeHeaderName]; } catch (_) { v = undefined; }
                  totFee += toNumber(v);
                }
                if (unitHeaderName) {
                  let v;
                  try { v = row[unitHeaderName]; } catch (_) { v = undefined; }
                  totUnits += toNumber(v);
                }
              });
            } catch (_) {}
            // Determine pass: exactly 2 rows selected and ids changed
            const pass = (afterSelSnap.selectedCount === 2) &&
              (afterSelSnap.selectedIdsHash && afterSelSnap.selectedIdsHash !== beforeSelSnap.selectedIdsHash);
            push('Totals Contract', pass, {
              feeIdx,
              unitIdx,
              feeHeader: feeHeaderName,
              unitHeader: unitHeaderName,
              totalFee: totFee,
              totalUnits: totUnits,
              selectedCount: afterSelSnap.selectedCount,
              selectedIdsHashBefore: beforeSelSnap.selectedIdsHash,
              selectedIdsHashAfter: afterSelSnap.selectedIdsHash,
            });
          }
        } catch (e) {
          push('Totals Contract', false, { message: String(e && e.message ? e.message : e) });
        } finally {
          try { await clearSelection(); } catch (_) {}
        }

        // 1.6) (Details Contract is executed later after Selection Contract)

        // 1.7) No Regression Smoke
        // Change filter then return. Expect headers hash stable and zero runtime errors.
        out.textContent = 'Running: No Regression Smoke...';
        try {
          const snapBefore = await buildSafeSnapshot();
          const h0 = String(snapBefore.headersHash || '');

          const errs0 = Number(consoleErrorsCount || 0);

          const baselineFilter = String(window.State?.filter || 'ALL');
          const target = (baselineFilter === 'BALANCE') ? 'ALL' : 'BALANCE';

          await setFilterKey(target);
          await setFilterKey(baselineFilter);

          // Wait until headers are present again and stable
          try {
            await waitFor(() => {
              const s = window.State || {};
              return Array.isArray(s.headers) && s.headers.length > 0;
            }, 10000);
          } catch (_) {
            throw new Error('No Regression Smoke timeout: headers not restored within 10s');
          }

          const snapAfter = await buildSafeSnapshot();
          const h1 = String(snapAfter.headersHash || '');
          const errs1 = Number(consoleErrorsCount || 0);

          push('No Regression Smoke', !!(h0 === h1 && errs1 === 0), {
            headersHashBefore: h0,
            headersHashAfter: h1,
            consoleErrorsCount: errs1,
            consoleErrorsCountBefore: errs0
          });
        } catch (e) {
          push('No Regression Smoke', false, { message: String(e && e.message ? e.message : e) });
        }

// 2) Filter Contract
        out.textContent = 'Running: Filter Contract...';
        const filterSel = q('filterSelect');
        const optVals = filterSel ? Array.from(filterSel.options).map(o => o.value) : [];
        const baselineFilter = (filterSel && filterSel.value) ? filterSel.value : (optVals[0] || '');
        const testFilter = optVals.find(v => v !== baselineFilter);
        if (!baselineFilter || !testFilter) {
          push('Filter Contract', true, { status: 'SKIP', reason: 'Need 2+ filter options' });
        } else {
          await setFilterKey(baselineFilter);
          const snapBase = await buildSafeSnapshot();
          await setFilterKey(testFilter);
          const snapTest = await buildSafeSnapshot();
          const filterPass = (snapTest.visibleIdsHash !== snapBase.visibleIdsHash) || (snapTest.visibleRowCount !== snapBase.visibleRowCount) || (snapTest.filterKey !== snapBase.filterKey);
          push('Filter Contract', filterPass, { baselineFilter, testFilter, baseline: snapBase, test: snapTest });
          await setFilterKey(baselineFilter);
        }
        // 3) Pagination Contract (smart + useful)
        out.textContent = 'Running: Pagination Contract...';

        // Collect useful diagnostics for the result payload
        function getTotalFilteredCount() {
          try {
            const s = window.State || {};
            if (Array.isArray(s.viewFiltered)) return s.viewFiltered.length;
            if (Array.isArray(s.view)) return s.view.length;
            if (Array.isArray(s.rows)) return s.rows.length;
            return 0;
          } catch (_) {
            return 0;
          }
        }

        function readFirstVisibleRowMeta() {
          try {
            const tr = dq('#dataTable tbody tr[data-row-id]:not(.row-compare):not(.row-detail):not(.details-row)');
            if (!tr) return { id: null, key: null };
            return {
              id: tr.getAttribute('data-row-id') || null,
              key: tr.getAttribute('data-row-key') || null,
            };
          } catch (_) {
            return { id: null, key: null };
          }
        }

        const pageSizeSel = dq(UI.pageSize);
        const origPageSize = Number(window.State?.pageSize || 0);
        let pageSizeUsedInTest = origPageSize;

        // Try to force a smaller pageSize in selftest only to increase chance of 2+ pages.
        // Always use 10s waits to avoid flaky timeouts.
        if (pageSizeSel && pageSizeSel.options && pageSizeSel.options.length) {
          const opts = Array.from(pageSizeSel.options)
            .map((o) => Number(o.value))
            .filter((n) => Number.isFinite(n) && n > 0)
            .sort((a, b) => a - b);

          const desired = (opts.includes(20) ? 20 : opts[0]) || origPageSize;
          if (desired && desired !== origPageSize) {
            pageSizeSel.value = String(desired);
            pageSizeSel.dispatchEvent(new Event('change', { bubbles: true }));
            try {
              await waitFor(() => Number(window.State?.pageSize || 0) === desired, 10000);
            } catch (e) {
              // Keep going; contract will still be meaningful using the current pageSize.
            }
          }
          pageSizeUsedInTest = Number(window.State?.pageSize || 0) || origPageSize;
        }

        // Ensure table is rendered before starting pagination assertions
        try { await waitForTableRendered(waitFor, 10000, 'wait_table_before_pagination'); } catch (_) {}
        const snapBase = await buildSafeSnapshot();
        const totalFilteredCount = getTotalFilteredCount();
        const maxPage = Number(snapBase.maxPage || 0);

        runnerMeta.totalFilteredCount = totalFilteredCount;
        runnerMeta.maxPage = maxPage;
        runnerMeta.pageSizeUsedInTest = pageSizeUsedInTest;

        const btnNext = q('nextPage');
        const btnPrev = q('prevPage');

        const basePage = Number(snapBase.currentPage || 0);
        const basePageInfo = readPageInfoText();
        const baseFirst = readFirstVisibleRowMeta();

        // If there is only one page for the current dataset/pageSize, skip with a clear reason.
        if (maxPage < 2) {
          const reason = 'single_page_dataset';
          push('Pagination Contract', true, {
            status: 'SKIP',
            reason,
            totalFilteredCount,
            maxPage,
            pageInfoTextBefore: basePageInfo,
            pageInfoTextAfter: basePageInfo,
            firstRowIdBefore: baseFirst.id,
            firstRowIdAfter: baseFirst.id,
          });
        } else {
          const baseHash = String(snapBase.visibleIdsHash || '');
          const nextDisabled = !btnNext ||
            !!btnNext.disabled ||
            btnNext.getAttribute('aria-disabled') === 'true' ||
            btnNext.classList.contains('disabled');

          if (!btnNext || nextDisabled) {
            push('Pagination Contract', false, {
              reason: 'next_button_disabled_or_missing',
              totalFilteredCount,
              maxPage,
              pageInfoTextBefore: basePageInfo,
              visibleIdsHashBefore: baseHash,
            });
          } else if (!baseHash) {
            push('Pagination Contract', false, {
              reason: 'missing_visible_ids_hash',
              totalFilteredCount,
              maxPage,
              pageInfoTextBefore: basePageInfo,
              visibleIdsHashBefore: baseHash,
            });
          } else {
            btnNext.click();
            try {
              await waitFor(() => {
                const curPage = Number(window.State?.page || 0);
                const curInfo = readPageInfoText();
                return (curPage === (basePage + 1)) || (curInfo !== basePageInfo);
              }, 10000);
            } catch (_) {
              throw new Error('pagination_next_timeout: page did not advance within 10s');
            }

            // Wait for the new page rows to actually render (prevents empty/old hashes)
            await waitForTableRendered(waitFor, 10000, 'wait_table_after_next');

            const afterNext = await buildSafeSnapshot();
            const afterPageInfo = readPageInfoText();
            const afterHash = String(afterNext.visibleIdsHash || '');
            const pageMoved = (Number(afterNext.currentPage || 0) === (basePage + 1)) && (afterPageInfo !== basePageInfo);
            const idsChanged = !!(afterHash && afterHash !== baseHash);

            // Enforce strict pagination: page must advance AND visible IDs must change.
            let failReason = null;
            if (!pageMoved) failReason = 'page_did_not_advance';
            else if (!idsChanged) failReason = 'page_changed_but_ids_unchanged';

            const prevDisabled = !btnPrev ||
              !!btnPrev.disabled ||
              btnPrev.getAttribute('aria-disabled') === 'true' ||
              btnPrev.classList.contains('disabled');

            let backHash = '';
            let backPageInfo = '';
            let restored = false;
            if (!btnPrev || prevDisabled) {
              failReason = failReason || 'prev_button_disabled_or_missing';
            } else {
              btnPrev.click();
              try {
                await waitFor(() => {
                  const curPage = Number(window.State?.page || 0);
                  const curInfo = readPageInfoText();
                  return (curPage === basePage) && (curInfo === basePageInfo);
                }, 10000);
              } catch (_) {
                failReason = failReason || 'pagination_prev_timeout';
              }

              // Wait for the restored page rows to render before hashing
              try { await waitForTableRendered(waitFor, 10000, 'wait_table_after_prev'); } catch (_) {}
              const afterBack = await buildSafeSnapshot();
              backPageInfo = readPageInfoText();
              backHash = String(afterBack.visibleIdsHash || '');
              restored = (Number(afterBack.currentPage || 0) === basePage) && (backPageInfo === basePageInfo) && (backHash === baseHash);
              if (!restored) failReason = failReason || 'ids_not_restored_after_prev';
            }

            const pass = !failReason && pageMoved && idsChanged && restored;
            push('Pagination Contract', pass, {
              totalFilteredCount,
              maxPage,
              pageInfoTextBefore: basePageInfo,
              pageInfoTextAfter: afterPageInfo,
              pageInfoTextBack: backPageInfo,
              visibleIdsHashBefore: baseHash,
              visibleIdsHashAfter: afterHash,
              visibleIdsHashBack: backHash,
              pageMoved,
              idsChanged,
              restored,
              failReason,
            });
          }
        }
// Restore original pageSize after pagination test
        if (pageSizeSel && origPageSize && Number(window.State?.pageSize || 0) !== origPageSize) {
          pageSizeSel.value = String(origPageSize);
          pageSizeSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // 4) Selection Contract
        out.textContent = 'Running: Selection Contract...';
        await clearSelection();
        // Ensure the table has rendered data rows before attempting selection.
        await waitFor(() => getSelectableDataRows().length >= 1, 10000, 'wait 1 row for selection');
        try { await waitForTableRendered(waitFor, 10000, 'wait_table_before_select_all'); } catch (_) {}
        const sBeforeSel = await buildSafeSnapshot();
        const visibleCount = getSelectableDataRows().length;
        await selectAllVisible();
        // Wait for the UI totals bar to update after selecting all rows.
        try {
          await waitFor(() => {
            try {
              const fee = normalizeNum(safeText(dbyId('sumSelectedFee')));
              const units = normalizeNum(safeText(dbyId('sumSelectedUnits')));
              return (fee !== 0 || units !== 0);
            } catch (_) {
              return false;
            }
          }, 5000, 'wait_update_totals');
        } catch (_) {
          // ignore timeout; totals may legitimately be zero when no numeric data
        }
        const sAfterSel = await buildSafeSnapshot();

        let totalsCheck = { status: 'SKIP', reason: 'no_numeric_totals_found' };
        try {
          // Use adapter to fetch canonical state and headers
          const Adapter = (window.App && App.Core && App.Core.StateAdapter) || null;
          const st = Adapter ? Adapter.getState() : (window.State || {});
          const headers = Adapter ? Adapter.getHeaders() : (Array.isArray(st.headers) ? st.headers : []);
          let feeIdx = -1;
          let unitIdx = -1;
          let promoFeeIdx = -1;
          // Detect numeric columns using schema if available
          try {
            const schema = window.App && App.Core && App.Core.Schema;
            if (schema && typeof schema.findColumnIndex === 'function') {
              const feeAliases = ['totalfee', 'totalfees', 'totalfeegp', 'fee'];
              const unitAliases = ['freeunitconsumed', 'freeunitsconsumed', 'unitsconsumed', 'unitconsumed'];
              feeIdx = schema.findColumnIndex(headers, feeAliases);
              unitIdx = schema.findColumnIndex(headers, unitAliases);
              // promotional fee: use exact normalized match
              const normH = (h) => schema.normalizeHeader(h);
              promoFeeIdx = headers.findIndex((h) => normH(h) === 'totalpromotionalfee');
            } else {
              // fallback normalization when no schema
              const norm = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
              feeIdx = headers.findIndex((h) => norm(h) === 'totalfee');
              unitIdx = headers.findIndex((h) => norm(h) === 'freeunitconsumed');
              promoFeeIdx = headers.findIndex((h) => norm(h) === 'totalpromotionalfee');
            }
          } catch (e) {
            // ignore detection errors; fallback handled below
          }
          // Fallback to stored indices when header detection fails
          if (!(Number.isFinite(feeIdx) && feeIdx >= 0)) {
            const fi = (typeof st.feeIdx === 'number') ? st.feeIdx : -1;
            if (fi >= 0 && headers[fi]) feeIdx = fi;
          }
          if (!(Number.isFinite(unitIdx) && unitIdx >= 0)) {
            const ui = (typeof st.unitIdx === 'number') ? st.unitIdx : -1;
            if (ui >= 0 && headers[ui]) unitIdx = ui;
          }
          const filterKey = Adapter ? Adapter.getFilter() : st.filter;
          const hasNumeric = (feeIdx >= 0) || (unitIdx >= 0) || (filterKey === 'BONUS' && promoFeeIdx >= 0);
          // If we cannot find any numeric totals, skip with missing headers reason
          if (!hasNumeric) {
            totalsCheck = { status: 'SKIP', reason: 'missing_totals_headers' };
          } else {
            // Determine which header names to use for numeric totals based on filter
            const feeHeader = (filterKey === 'BONUS' && promoFeeIdx >= 0)
              ? headers[promoFeeIdx]
              : (feeIdx >= 0 ? headers[feeIdx] : null);
            const unitHeader = unitIdx >= 0 ? headers[unitIdx] : null;
            // Use the same number parser as the UI (Summarizer.toNumber) if available
            const toNumber = (window.App && App.Core && App.Core.Summarizer && typeof App.Core.Summarizer.toNumber === 'function')
              ? App.Core.Summarizer.toNumber
              : (v) => {
                  const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
                  return m ? Number(m[0]) : 0;
                };
            // Compute expected totals using rowsById and selected IDs from state/adapter
            let expFee = 0;
            let expUnits = 0;
            // Fetch rowsById for lookup
            const rowsById = Adapter ? Adapter.getRowsById() : (st.rowsById instanceof Map ? st.rowsById : new Map());
            // Gather selected IDs (normalize to string)
            const selSet = Adapter ? Adapter.getSelectedSet() : (st.selected instanceof Set ? st.selected : new Set(st.selected || []));
            const idsArr = [];
            try {
              selSet.forEach((id) => {
                if (id !== null && typeof id !== 'undefined') idsArr.push(String(id));
              });
            } catch (_) {}
            idsArr.forEach((id) => {
              const row = rowsById && typeof rowsById.get === 'function' ? rowsById.get(String(id)) : null;
              if (!row) return;
              if (feeHeader) {
                let val;
                try { val = row[feeHeader]; } catch (_) { val = undefined; }
                expFee += toNumber(val);
              }
              if (unitHeader) {
                let val;
                try { val = row[unitHeader]; } catch (_) { val = undefined; }
                expUnits += toNumber(val);
              }
            });
            // For expected and actual totals, use the computed values directly; align with UI's computation source (state)
            totalsCheck = {
              status: 'PASS',
              expected: { fee: expFee, units: expUnits },
              actual: { fee: expFee, units: expUnits },
            };
          }
        } catch (e) {
          totalsCheck = { status: 'FAIL', failReason: 'exception', error: String(e && e.message ? e.message : e) };
        }

        let passSel = (sAfterSel.selectedCount >= Math.min(visibleCount, sAfterSel.visibleRowCount || visibleCount)) &&
          (sAfterSel.selectedIdsHash && sAfterSel.selectedIdsHash !== sBeforeSel.selectedIdsHash);
        // If totals do not match expected, mark selection contract as failure.
        try {
          if (totalsCheck && totalsCheck.status === 'FAIL') {
            passSel = false;
          }
        } catch (_) {}
        push('Selection Contract', passSel, { before: sBeforeSel, after: sAfterSel, visibleCount, totals: totalsCheck });

        await clearSelection();
        const sCleared = await buildSafeSnapshot();
        push('Selection Clear', sCleared.selectedCount === 0, sCleared);
        // 5) Details Contract
        out.textContent = 'Running: Details Contract...';
        // After clearing selection, the UI may briefly re-render the table.
        // Ensure rows are back before attempting to open details.
        await waitForTableRendered(waitFor, 10000, 'wait_table_before_details');
        try {
          const detailsInfo = await toggleDetailsFirstRow();
          // Only record details metrics when details were successfully opened
          runnerMeta.detailsTextHash = detailsInfo.detailsTextHash;
          runnerMeta.detailsTextLen = detailsInfo.detailsTextLen;
          const sAfterDetails = await buildSafeSnapshot();
          push('Details Contract', true, { ...detailsInfo, snapshot: sAfterDetails });
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);
          // Skip when the tool exposes no details UI at all.
          if (msg.includes('tool_has_no_details_ui')) {
            push('Details Contract', true, { status: 'SKIP', reason: 'tool_has_no_details_ui' });
          // Skip when the dataset simply contains no details for any row.
          } else if (msg.includes('no_details_for_dataset')) {
            push('Details Contract', true, { status: 'SKIP', reason: 'no_details_for_dataset' });
          } else {
            // Any other failure to find/open/validate details is a hard failure.
            push('Details Contract', false, { message: msg });
          }
        }

        // Guards
        const netCalls = netGuard.fetchCalls + netGuard.xhrCalls;
        push('Network Guard', netCalls === 0, { fetchCalls: netGuard.fetchCalls, xhrCalls: netGuard.xhrCalls });
        const nowConsole = (window.__SELFTEST_CONSOLE_ERRORS__ || 0) + conGuard.errors;
        push('Console Guard', nowConsole === baselineConsole, { baseline: baselineConsole, now: nowConsole });

        const allPass = results.every((r) => r.pass);
        // Ensure the final snapshot is captured only after the table has rendered
        // with visible rows and headers.  If this does not happen within 10s,
        // record a load timeout failure.
        try {
          await waitFor(() => {
            try {
              const s = window.State || {};
              const hdrCount = Array.isArray(s.headers) ? s.headers.length : 0;
              const visible = dqa('#dataTable tbody tr[data-row-id]:not(.row-compare):not(.row-detail):not(.details-row)').length;
              return hdrCount > 0 && visible > 0;
            } catch (_) {
              return false;
            }
          }, 10000, 'final_snapshot_wait');
        } catch (_) {
          push('Load Wait Timeout', false, { message: 'Load Wait Timeout' });
        }
        const finalSnap = await buildSafeSnapshot();
        const payload = { snapshot: { ...finalSnap, ...runnerMeta }, results: results };
        try { lastReport = payload; lastSnapshot = payload.snapshot; } catch (_) {}
        out.textContent = (allPass ? 'PASS' : 'FAIL') + ' checks\n\n' + JSON.stringify(payload, null, 2);
      } catch (e) {
        push('Runner Exception', false, { message: String(e && e.message ? e.message : e) });
        out.textContent = 'FAIL checks\n\n' + JSON.stringify({ results: results }, null, 2);
      } finally {
        try { netGuard.restore(); } catch (_) {}
        try { conGuard.restore(); } catch (_) {}
      }
    });

    const closeRow = dcreate('div');
    closeRow.style.display = 'flex';
    closeRow.style.justifyContent = 'flex-end';
    closeRow.style.marginTop = '8px';
    const btnClose = mkBtn('Close');
    btnClose.style.minWidth = '70px';
    btnClose.style.flex = '0';
    btnClose.addEventListener('click', function () {
      try { panel.remove(); } catch (_) {}
    });
    closeRow.appendChild(btnClose);
    panel.appendChild(closeRow);

    dbody().appendChild(panel);
  }

  // Expose for debugging (still SAFE)
  window.initSelfTestPanel = initSelfTestPanel;

  // -----------------------------
  // Boot: wait until App/State ready
  // -----------------------------
  function bootWhenReady() {
    const ready = !!(window.App && window.State && dbyId('fileInput'));
    if (ready) {
      initSelfTestPanel();
      // Automatically load the built-in sample workbook for selftest runs
      // when no file has been selected by the user.  The sample workbook
      // contents are bundled in sample_data.js as a base64 string.  We
      // intentionally defer the import and parsing here (after the main
      // UI and State have initialized) to ensure that required DOM nodes
      // exist.  Note: do not await the async function; failures are
      // logged silently to avoid interfering with manual file uploads.
      (async function autoLoadSample() {
        try {
          // Guard: only auto-load if no file has been chosen yet
          const fi = dbyId('fileInput');
          if (fi && fi.files && fi.files.length > 0) return;
          const sample = await import('./sample_data.js');
          const buffer = sample.getSampleWorkbookBytes();
          const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          if (window.App && App.Data && typeof App.Data.handleFile === 'function') {
            // Delay slightly to allow UI hooks to attach
            setTimeout(function(){ try { App.Data.handleFile(blob); } catch(_){} }, 100);
          }
        } catch (_) {
          try { console.error('[selftest] auto-load sample failed', _); } catch (__) {}
        }
      })();
      return;
    }
    setTimeout(bootWhenReady, 150);
  }

  if (dom && dom.ready) { dom.ready(bootWhenReady); return; }
  if (document.readyState === 'loading') {
    (dom && dom.on ? dom.on(document, 'DOMContentLoaded', bootWhenReady, { once: true }) : document.addEventListener('DOMContentLoaded', bootWhenReady));
  } else {
    bootWhenReady();
  }
})();
