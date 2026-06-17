(function(global){
  'use strict';
  global.App = global.App || {};
  // Central place for DOM ids/selectors (optional helper for future refactors).
  // Keep it conservative to avoid breaking existing code.
  global.App.UI = global.App.UI || {
    ids: {
      fileInput: 'fileInput',
      sheetSelect: 'sheetSelect',
      table: 'dataTable',
      tableBody: 'tableBody',
      loading: 'loading',
      totalFee: 'totalFee',
      freeUnits: 'freeUnits'
    },
    sel: {
      fileInput: '#fileInput',
      sheetSelect: '#sheetSelect',
      table: '#dataTable',
      tableBody: '#tableBody',
      loading: '#loading'
    }
  };
})(window);
