# Changelog – MNDO View Pro (v14)

## 2026-01-30 — FINAL UI Architecture Refactor (Vanilla, offline)

### Added (new architecture)
* `js/store/store.js` — single source of truth Store (dispatch/subscribe/getState) with stable `window.State` bridge.
* `js/core/` — pure logic moved under `js/core/` (`filter_engine.js`, `pagination.js`, `summarizer.js`, `derive.js`, `ids_hash.js`).
* `js/ui/ui_root.js` — mounts components and renders on store updates.
* `js/ui/components/` — component boundaries:
  - `DataTable.js`, `HeaderFilters.js`, `SummaryBar.js`, `Pagination.js`, `SelectionBar.js`, `DetailsRow.js`, `Toast.js`, `DragPan.js`, `ErrorOverlay.js`.
* `js/adapters/` — thin wrappers:
  - `logger_adapter.js` (SAFE/UNSAFE gate), `parser_adapter.js` (Data wrapper).

### Modified
* `index.html` — removed inline boot script, added CSP meta, uses `js/bootstrap_legacy.js` for both file:// and local servers.
* `js/bootstrap_legacy.js` / `js/bootstrap.js` — updated load order to the new Store + component UI (no controller/main coupling).
* `js/view_modules/table.js` — removed legacy row delegation binding; switched table cell rendering to `textContent` (no innerHTML for cell content).
* `js/helpers/details.js` — increased details wait window to reduce “لا توجد تفاصيل” placeholders under heavy renders.
* `js/selftest_smoke.js` — improved panel actions + stronger contracts (pagination ids must change, selection select-all, details validation, safe snapshots scoped to #dataTable).

### Notes
* Legacy modules remain in-place for compatibility, but the active UI path is now driven by `js/ui/ui_root.js` + Store.

All changes below were made to deliver a clean, modular build while preserving the original user experience.  Each section references the file and (where practical) the specific area modified.

## Previous notes (kept for history)

* **README.md** – Introduces the project, setup instructions, features and troubleshooting.
* **run_local.sh / run_local.bat** – Simple scripts to launch a static web server on port 8080 for local testing.
* **sample.xlsx** – A sample Excel workbook for quick testing of the app.

## Modified

### `js/state.js`
* Added new properties:
  - `fileBuffer` – stores the raw `ArrayBuffer` of the last loaded Excel file for reuse by the worker.

### `js/controller.js`
* Updated the *Select all visible* handler to respect header filters by selecting only rows from `State.viewFiltered` if present.

### `js/view.js`
* Fixed the **first‑row details** bug by rewriting `__setCompareForRow()` to always remove any existing detail row and insert a fresh one immediately after the clicked row using `insertBefore()`.
* Simplified unit details in the consumption breakdown: removed the return arrow and deduction reason, displaying values only.  Each value is clickable and navigates back to the original row, expanding its inline details.
* Updated the delegated click handler in the breakdown panel to support clicks on both jump arrows and value lines, expanding details for unit values.

### `js/data.js`
* Introduced a worker‑based parsing path.  `handleFile()` stores the file buffer and attempts to parse via `assets/js/worker_xlsx.js`.  If worker parsing fails it falls back to the original synchronous parsing using the `XLSX` library.
* Added `processParsedData()` and `parseSheetWithWorker()` helpers to process worker responses and coordinate parsing of specific sheets on demand.
* Updated `loadSheet()` to use the worker when possible and fall back to parsing via an existing workbook or the stored buffer as necessary.

### `assets/js/worker_xlsx.js`
* Rewritten to support a single message protocol:
  - Receives `{ type:'PARSE_XLSX', file: ArrayBuffer, sheetName?: string }`.
  - Dynamically imports the XLSX library (`xlsx.full.min.js`) and parses the specified sheet (or the first sheet).
  - Responds with `{ type:'XLSX_PARSED', rows: [...], meta: { sheetName, sheetNames, headers } }` on success or `{ type:'XLSX_ERROR', message: string }` on failure.
* Removed the obsolete `init` and `sheet` message handlers.

### `index.html`
* No visual changes were made.

## Removed

* The “Return” button in the consumption breakdown has been removed entirely.  Values now serve as the link back to their originating rows.

## Behaviour Preservation

Despite significant internal changes, the application’s user interface and overall behaviour remain unchanged.  All filters, sorting, pagination, row highlighting and summation features function identically to the original version.

## V4 - Indicator + Auto-Recover
- Added Mode indicator (Worker/Fallback)
- Added gentle Auto-Recover and global error boundary
- Added hooks + safe console for resilience
