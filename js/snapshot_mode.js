/*
  Snapshot Mode (Phase 0)
  ----------------------
  SECURITY DEFAULT: SAFE

  SAFE mode is enabled by: ?snapshot=1 (or any truthy value except 'unsafe')
    - NEVER records any cell text or details text.
    - Replaces table cells[] with metadata only:
        { cellsCount, rowTextLenTotal, (optional) rowHash }
    - Replaces details text with metadata only:
        { detailsTextLen, (optional) detailsHash }
    - No console logging of snapshots or derived data.
    - Output is via Download JSON (Blob).

  UNSAFE mode requires: ?snapshot=unsafe
    - Shows a clear confirmation prompt.
    - Raw text capture is still OFF by default and requires an explicit UI toggle.

  Notes:
    - Hashes are optional and OFF by default in SAFE mode.
    - Hashes use SHA-256 (crypto.subtle) when available, otherwise a deterministic DJB2 fallback.
*/

(function () {
  const params = new URLSearchParams(location.search);
  const snapParam = params.get('snapshot');
  if (!snapParam) return;

  const isUnsafeParam = String(snapParam).toLowerCase() === 'unsafe';
  let mode = isUnsafeParam ? 'unsafe' : 'safe';

  // Unsafe requires explicit confirm; if user cancels -> fall back to safe.
  if (mode === 'unsafe') {
    const ok = confirm(
      'UNSAFE Snapshot Mode\n\n' +
        'This mode can optionally capture raw text from the file (cells/details) if you explicitly enable it in the panel.\n\n' +
        'If you are working with real customer data, do NOT enable raw capture.\n\n' +
        'Continue in UNSAFE mode?'
    );
    if (!ok) mode = 'safe';
  }

  // --- helpers ---
  function toast(msg, type) {
    try {
      if (window.App && App.Toast && typeof App.Toast.show === 'function') {
        App.Toast.show(msg, type || 'info');
        return;
      }
    } catch (e) {}
    // No console output (security requirement)
    alert(msg);
  }

  function qs(sel) {
    return document.querySelector(sel);
  }

  function nowStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '_' +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  function downloadJson(obj, filenameBase) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filenameBase || 'snapshot') + '_' + nowStamp() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function djb2Hash(str) {
    // deterministic, lightweight (fallback only)
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  async function sha256HexShort(str) {
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        const enc = new TextEncoder().encode(str);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        const bytes = new Uint8Array(buf);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
          hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex.slice(0, 16); // short but stable
      }
    } catch (e) {
      // ignore
    }
    return djb2Hash(str);
  }

  function collectCellTextsFromRow(tr) {
    const tds = Array.from(tr.querySelectorAll('td'));
    return tds.map((td) => (td && td.textContent ? td.textContent : ''));
  }

  function redactRowFromTexts(texts, includeHashes) {
    let lenTotal = 0;
    for (let i = 0; i < texts.length; i++) lenTotal += (texts[i] || '').length;

    const out = {
      cellsCount: texts.length,
      rowTextLenTotal: lenTotal,
    };

    if (includeHashes) {
      // Use a separator unlikely to appear in cells.
      out.rowHash = null; // filled async by caller
      out.__rowHashInput = texts.join('\u001f');
    }

    return out;
  }

  function getVisibleRowsSnapshot(opts) {
    const { includeHashes, includeRawText, maxRows } = opts;
    const tbody = qs('#dataTable tbody');
    if (!tbody) return [];

    const rows = Array.from(tbody.querySelectorAll('tr')).filter(
      (tr) => !tr.classList.contains('row-compare')
    );

    const out = [];
    const limit = Math.min(rows.length, maxRows || 50);

    for (let i = 0; i < limit; i++) {
      const tr = rows[i];
      const rowId = tr.getAttribute('data-row-id') || null;

      const texts = collectCellTextsFromRow(tr);
      const redacted = redactRowFromTexts(texts, includeHashes);

      const entry = {
        rowId,
      };

      if (includeRawText) {
        // UNSAFE explicit mode only: raw capture is user-controlled.
        entry.cells = texts;
      } else {
        entry.cellsMeta = redacted;
      }

      out.push(entry);
    }

    return out;
  }

  function getCompareDetailsSnapshot(opts) {
    const { includeHashes, includeRawText } = opts;
    const compare = qs('tr.row-compare');
    if (!compare) return null;

    const cmpTextEl = compare.querySelector('.cmp-text');
    const txt = cmpTextEl && cmpTextEl.textContent ? cmpTextEl.textContent : '';

    const meta = {
      detailsTextLen: txt.length,
    };

    if (includeHashes) {
      meta.detailsHash = null; // filled async by caller
      meta.__detailsHashInput = txt;
    }

    if (includeRawText) {
      return {
        detailsText: txt,
        detailsMeta: meta,
      };
    }

    return {
      detailsMeta: meta,
    };
  }

  function getBreakdownSnapshot(opts) {
    const { includeHashes, includeRawText } = opts;
    const el = qs('#consumptionBreakdown');
    const txt = el && el.textContent ? el.textContent : '';

    const meta = {
      breakdownTextLen: txt.length,
    };

    if (includeHashes) {
      meta.breakdownHash = null; // filled async by caller
      meta.__breakdownHashInput = txt;
    }

    if (includeRawText) {
      return {
        breakdownText: txt,
        breakdownMeta: meta,
      };
    }

    return {
      breakdownMeta: meta,
    };
  }

  function getHeaderMeta() {
    const thead = qs('#dataTable thead');
    if (!thead) return { headersCount: 0 };
    const ths = Array.from(thead.querySelectorAll('th'));
    return {
      headersCount: ths.length,
    };
  }

  function getPageMeta() {
    const pageInfo = qs('#pageInfo');
    const txt = pageInfo && pageInfo.textContent ? pageInfo.textContent : '';
    return {
      pageInfoTextLen: txt.length,
      // Avoid parsing/recording exact values (could reveal row counts tied to data).
      // If you need page numbers, rely on State.page/pageSize below.
    };
  }

  function getStateMeta() {
    const safe = {
      filter: null,
      page: null,
      pageSize: null,
      selectedCount: null,
    };

    try {
      if (window.State) {
        safe.filter = State.filter || null;
        safe.page = State.page || null;
        safe.pageSize = State.pageSize || null;
        safe.selectedCount = State.selected ? State.selected.size : 0;
      }
    } catch (e) {}

    return safe;
  }

  function getUiMeta() {
    const fileInput = qs('#fileInput');
    const sheetSelect = qs('#sheetSelect');
    const filterSelect = qs('#filterSelect');

    return {
      hasFileSelected: !!(fileInput && fileInput.files && fileInput.files.length),
      sheetSelectedIndex: sheetSelect ? sheetSelect.selectedIndex : null,
      sheetOptionsCount: sheetSelect ? sheetSelect.options.length : null,
      filterValue: filterSelect ? filterSelect.value : null,
    };
  }

  async function fillHashes(obj) {
    // Traverse object and replace __*HashInput fields
    async function walk(node) {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) await walk(node[i]);
        return;
      }

      // Row meta
      if (node.cellsMeta && node.cellsMeta.__rowHashInput) {
        node.cellsMeta.rowHash = await sha256HexShort(node.cellsMeta.__rowHashInput);
        delete node.cellsMeta.__rowHashInput;
      }

      // Details
      if (node.detailsMeta && node.detailsMeta.__detailsHashInput) {
        node.detailsMeta.detailsHash = await sha256HexShort(node.detailsMeta.__detailsHashInput);
        delete node.detailsMeta.__detailsHashInput;
      }

      // Breakdown
      if (node.breakdownMeta && node.breakdownMeta.__breakdownHashInput) {
        node.breakdownMeta.breakdownHash = await sha256HexShort(node.breakdownMeta.__breakdownHashInput);
        delete node.breakdownMeta.__breakdownHashInput;
      }

      for (const k of Object.keys(node)) {
        await walk(node[k]);
      }
    }

    await walk(obj);
  }

  async function captureSnapshot(opts) {
    const snapshot = {
      snapshotMode: mode,
      createdAt: new Date().toISOString(),
      safeDefaults: {
        noConsoleLogging: true,
        output: 'download-json',
      },
      ui: getUiMeta(),
      state: getStateMeta(),
      headers: getHeaderMeta(),
      page: getPageMeta(),
      // No raw data in SAFE.
      table: {
        maxRowsCaptured: opts.maxRows,
        rows: [],
      },
      breakdown: null,
      compare: null,
    };

    snapshot.table.rows = getVisibleRowsSnapshot(opts);
    snapshot.breakdown = getBreakdownSnapshot(opts);
    snapshot.compare = getCompareDetailsSnapshot(opts);

    if (opts.includeHashes) {
      await fillHashes(snapshot);
    } else {
      // Remove any __*HashInput (should not exist when includeHashes=false)
      // but keep it defensive.
      try {
        JSON.stringify(snapshot, (k, v) => {
          if (k && String(k).startsWith('__')) return undefined;
          return v;
        });
      } catch (e) {}
    }

    return snapshot;
  }

  // --- UI panel ---
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'mndo-snapshot-panel';
    panel.innerHTML = `
      <div class="mndo-snap-title">Snapshot Mode (${mode.toUpperCase()})</div>
      <div class="mndo-snap-row">
        <label><input type="checkbox" id="mndoSnapIncludeHashes"> Include hashes (recommended for diff)</label>
      </div>
      ${
        mode === 'unsafe'
          ? `<div class="mndo-snap-row">
               <label><input type="checkbox" id="mndoSnapIncludeRaw"> INCLUDE RAW TEXT (UNSAFE)</label>
             </div>`
          : ''
      }
      <div class="mndo-snap-row">
        <label>Max rows <input type="number" id="mndoSnapMaxRows" value="50" min="1" max="500" style="width:80px"></label>
      </div>
      <div class="mndo-snap-actions">
        <button id="mndoSnapCapture">Capture</button>
        <button id="mndoSnapDownload" disabled>Download JSON</button>
      </div>
      <div class="mndo-snap-hint">
        SAFE mode never stores cell/details text.\n
        UNSAFE mode can store raw text only if you explicitly enable it.
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #mndo-snapshot-panel{
        position:fixed;
        left:12px;
        bottom:12px;
        z-index:99999;
        width:280px;
        background:rgba(20,20,20,0.92);
        color:#fff;
        font:12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        border-radius:10px;
        padding:10px;
        box-shadow:0 10px 30px rgba(0,0,0,0.35);
      }
      #mndo-snapshot-panel .mndo-snap-title{font-weight:700; margin-bottom:8px;}
      #mndo-snapshot-panel .mndo-snap-row{margin:6px 0;}
      #mndo-snapshot-panel .mndo-snap-actions{display:flex; gap:8px; margin-top:8px;}
      #mndo-snapshot-panel button{padding:6px 10px; border-radius:8px; border:0; cursor:pointer;}
      #mndo-snapshot-panel button[disabled]{opacity:0.5; cursor:not-allowed;}
      #mndo-snapshot-panel .mndo-snap-hint{opacity:0.85; white-space:pre-line; margin-top:8px;}
      #mndo-snapshot-panel input[type="checkbox"]{vertical-align:middle;}
      #mndo-snapshot-panel input[type="number"]{border-radius:6px; border:1px solid rgba(255,255,255,0.15); padding:3px 6px;}
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    const btnCapture = qs('#mndoSnapCapture');
    const btnDownload = qs('#mndoSnapDownload');
    const cbHashes = qs('#mndoSnapIncludeHashes');
    const cbRaw = qs('#mndoSnapIncludeRaw');
    const inMaxRows = qs('#mndoSnapMaxRows');

    // Safe default: hashes OFF.
    if (cbHashes) cbHashes.checked = false;

    // Unsafe default: raw OFF.
    if (cbRaw) cbRaw.checked = false;

    let lastSnapshot = null;

    btnCapture.addEventListener('click', async () => {
      try {
        btnCapture.disabled = true;
        btnDownload.disabled = true;

        const includeHashes = !!(cbHashes && cbHashes.checked);
        const includeRawText = mode === 'unsafe' && !!(cbRaw && cbRaw.checked);

        if (includeRawText) {
          const ok = confirm(
            'RAW TEXT CAPTURE is enabled.\n\n' +
              'This may include sensitive data from real files.\n\n' +
              'Are you sure you want to continue?'
          );
          if (!ok) {
            cbRaw.checked = false;
            btnCapture.disabled = false;
            toast('Raw capture disabled.', 'info');
            return;
          }
        }

        const maxRows = Math.max(1, Math.min(500, Number(inMaxRows && inMaxRows.value) || 50));

        lastSnapshot = await captureSnapshot({
          includeHashes,
          includeRawText,
          maxRows,
        });

        toast('Snapshot captured (redacted).', 'success');
        btnDownload.disabled = false;
      } catch (e) {
        toast('Snapshot failed: ' + (e && e.message ? e.message : String(e)), 'error');
      } finally {
        btnCapture.disabled = false;
      }
    });

    btnDownload.addEventListener('click', () => {
      if (!lastSnapshot) {
        toast('Capture first.', 'info');
        return;
      }
      const base = mode === 'unsafe' ? 'snapshot_unsafe' : 'snapshot_safe';
      downloadJson(lastSnapshot, base);
      toast('Downloaded JSON.', 'success');
    });
  }

  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }
})();
