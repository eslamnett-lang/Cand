# Phase 0 — Baseline Validation Report (Dependency-free)

## Tested Sample

- File: `sample.xlsx` (bundled in this workspace copy)
- First sheet: `Sheet0`

## Observed dataset metrics (from tools/baseline_sample_report.js)

- Header columns: **44**
- Data rows: **368**
- Default pageSize: **100** ⇒ pages:
  - ALL: 368 rows ⇒ 4 pages
  - BALANCE: 33 rows ⇒ 1 page
  - UNITS: 284 rows ⇒ 3 pages
  - BONUS: 32 rows ⇒ 1 page
  - JUNK: 2 rows ⇒ 1 page

### Filter counts (current app rules)

- `ALL`: 368
- `BALANCE`: 33
- `UNITS`: 284
- `BONUS`: 32
- `JUNK`: 2

### Example rows (useful for manual verification)

> **ملاحظة:** row id هو `_id` الداخلي الذي يبنيه التطبيق (تصاعدي من 1).

- BALANCE example: rowId **1** (`Balance Deduct From = Balance`)
- UNITS example: rowId **18** (`Balance Deduct From = Free Unit`)
- BONUS example: rowId **337** (`Balance Deduct From = Bonus`)
- JUNK example: rowId **57** (`Balance Deduct From = Balance/Free Unit`)

## Stability patch (Phase 0)

- Added a small compatibility helper in `js/config.js`:
  - Defines `window.normDeduct(v)` if missing.
  - This prevents `ReferenceError` inside rule modules that call `normDeduct(...)`.
  - Intended to be behavior-preserving (normalization = lower+trim).

## In-app Snapshot Mode (Phase 0)

- Added `js/snapshot_mode.js` (opt-in)
- Enabled by URL param: `?snapshot=1`
- Purpose: generate **lightweight JSON snapshots** of the current UI state for manual comparison.

### How to use

1. Start the local server:
   - `./run_local.sh`
2. Open:
   - `http://localhost:8080/?snapshot=1`
3. Load `sample.xlsx` via the normal file picker.
4. Use the floating panel **Snapshot Mode**:
   - **Capture now**: captures current state (headers + first visible rows + totals + pagination)
   - **Run baseline scenario**: runs a short deterministic flow (filters + pagination + selection + details)
   - **Download JSON**: downloads the snapshot bundle

## Zero-network note

- Snapshot mode does **not** fetch the sample file.
- It waits for the user to load the XLS from the file input (FileReader path).
