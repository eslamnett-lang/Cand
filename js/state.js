(function(global){
  'use strict';

  const State = {
    workbook: null,
    sheetNames: [],
    rows: [],
    headers: [],
    view: [],
    filter: "ALL",
    page: 1,
    pageSize: 100,
    selected: new Set(),
    // Fast lookup for row objects by _id (stringified)
    rowsById: new Map(),
    // Incremented whenever a new dataset is loaded (used to invalidate global lookups)
    lookupVersion: 0,
    ids: 0,
    feeIdx: -1,
    unitIdx: -1,
    // Holds the raw ArrayBuffer of the last loaded XLSX file for worker reuse.
    fileBuffer: null,
    // Parsing mode: WORKER or FALLBACK
    parseMode: 'UNKNOWN'
  };

  // Cache for row details (rid|filter -> text)
  State.detailCache = new Map();

    // Legacy compatibility: some modules still reference `State` global.
  // Keep this alias to avoid runtime breakage while modularization is in progress.
  global.State = global.State || State;
  global.App = Object.assign(global.App || {}, { State });
})(window);
