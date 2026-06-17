#!/usr/bin/env node
/*
  Baseline report generator (SAFE)
  ------------------------------
  This tool produces a redacted baseline JSON for sample files.

  SECURITY REQUIREMENTS:
  - MUST NOT write any raw cell text/values from the workbook.
  - MUST NOT write raw 'deductFrom' strings.
  - Output is metadata only (counts/lengths/optional hashes).

  Output: docs/baseline_sample.json
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const XLSX = require('../vendor/xlsx/xlsx.full.min.js');

function sha256Short(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex').slice(0, 16);
}

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

function safeStrMeta(s, includeHash = true) {
  const v = String(s || '');
  return {
    len: v.length,
    ...(includeHash ? { hash: sha256Short(v) } : {}),
  };
}

function classify(deductFrom) {
  const d = norm(deductFrom);
  if (!d) return 'EMPTY';
  const hasBalance = d.includes('balance');
  const hasFree = d.includes('free');
  if (d === 'bonus') return 'BONUS';
  if (hasBalance && hasFree) return 'JUNK';
  if (d === 'bonus/free unit') return 'JUNK';
  if (hasBalance && !hasFree) return 'BALANCE';
  if (hasFree && !hasBalance) return 'UNITS';
  return 'OTHER';
}

function detectKey(headers, preferred) {
  const lower = headers.map((h) => norm(h));
  const idx = lower.findIndex((h) => h.includes(preferred));
  return idx >= 0 ? headers[idx] : null;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const samplePath = path.join(root, 'sample.xlsx');

  if (!fs.existsSync(samplePath)) {
    console.error('sample.xlsx not found at:', samplePath);
    process.exit(1);
  }

  const buf = fs.readFileSync(samplePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetNames = wb.SheetNames || [];

  const sheetName = sheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Use header row + sheet_to_json, but NEVER emit any cell text.
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
  const headers = (aoa[0] || []).map((h) => String(h || ''));

  // Guess column names (matches app behavior heuristics loosely)
  const startHeader = detectKey(headers, 'start') || headers[0] || null;
  const endHeader = detectKey(headers, 'end') || headers[1] || null;
  const deductHeader = detectKey(headers, 'deduct') || headers[12] || null;

  const rows = XLSX.utils.sheet_to_json(ws, {
    raw: true,
    defval: '',
  });

  // Build per-row minimal metadata for deductFrom only (len/hash), no raw strings.
  const counts = {
    ALL: 0,
    BALANCE: 0,
    UNITS: 0,
    BONUS: 0,
    JUNK: 0,
    EMPTY: 0,
    OTHER: 0,
  };

  const deductMetaAgg = {
    distinctApprox: new Map(), // hash -> { len, count }
    emptyCount: 0,
  };

  for (const r of rows) {
    counts.ALL++;

    const deductVal = deductHeader ? r[deductHeader] : '';
    const cls = classify(deductVal);
    if (counts[cls] !== undefined) counts[cls]++;

    // Track hashed groups (no raw)
    const m = safeStrMeta(deductVal, true);
    if (m.len === 0) {
      deductMetaAgg.emptyCount++;
    } else {
      const key = m.hash;
      const cur = deductMetaAgg.distinctApprox.get(key) || { len: m.len, hash: key, count: 0 };
      cur.count++;
      // keep max len seen for same hash (should be stable anyway)
      if (m.len > cur.len) cur.len = m.len;
      deductMetaAgg.distinctApprox.set(key, cur);
    }
  }

  const distinctList = Array.from(deductMetaAgg.distinctApprox.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Per-filter metadata only — no examples text.
  const perFilter = {
    ALL: { count: counts.ALL },
    BALANCE: { count: counts.BALANCE },
    UNITS: { count: counts.UNITS },
    BONUS: { count: counts.BONUS },
    JUNK: { count: counts.JUNK },
    EMPTY: { count: counts.EMPTY },
    OTHER: { count: counts.OTHER },
  };

  const out = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    file: {
      // Do NOT emit file name text. Metadata only.
      sizeBytes: buf.length,
      sha256Short: sha256Short(buf),
      nameLen: path.basename(samplePath).length,
      nameHash: sha256Short(path.basename(samplePath)),
    },
    workbook: {
      // Do NOT emit sheet names as text. Metadata only.
      sheetCount: sheetNames.length,
      sheetNameHashes: sheetNames.map((n) => sha256Short(n)),
      firstSheetHash: sheetName ? sha256Short(sheetName) : null,
    },
    table: {
      headers: {
        count: headers.length,
        // Header names are not data values; still, keep only count + hashes to be safest.
        nameHashes: headers.map((h) => sha256Short(h)),
      },
      rows: {
        dataRowCount: rows.length,
      },
      guessedColumns: {
        startHeaderHash: startHeader ? sha256Short(startHeader) : null,
        endHeaderHash: endHeader ? sha256Short(endHeader) : null,
        deductHeaderHash: deductHeader ? sha256Short(deductHeader) : null,
      },
    },
    filters: {
      counts: perFilter,
      deductFrom: {
        emptyCount: deductMetaAgg.emptyCount,
        distinctApprox: deductMetaAgg.distinctApprox.size,
        topHashed: distinctList, // {hash,len,count}
      },
    },
  };

  const docsDir = path.join(root, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const outPath = path.join(docsDir, 'baseline_sample.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log('Wrote redacted baseline:', outPath);
}

main();
