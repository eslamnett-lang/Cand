/* core/paginate.js
 * Pure pagination helpers.
 * Browser: window.App.Core.Paginate
 * Node: module.exports
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.App = global.App || {};
    global.App.Core = global.App.Core || {};
    global.App.Core.Paginate = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function pageCount(totalItems, pageSize) {
    const size = Math.max(1, Number(pageSize) || 1);
    const total = Math.max(0, Number(totalItems) || 0);
    return Math.max(1, Math.ceil(total / size));
  }

  function slice(baseRows, page, pageSize) {
    const arr = Array.isArray(baseRows) ? baseRows : [];
    const size = Math.max(1, Number(pageSize) || 1);
    const p = Math.max(1, Number(page) || 1);
    const start = (p - 1) * size;
    return arr.slice(start, start + size);
  }

  return { pageCount, slice };
});
