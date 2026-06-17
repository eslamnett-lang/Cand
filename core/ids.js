/* core/ids.js
 * Helpers for row id assignment and indexing.
 * No DOM, no globals. Designed for gradual migration.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MNDO_CoreIds = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isFiniteNumber(n) {
    return typeof n === 'number' && isFinite(n);
  }

  /**
   * Ensure each row has a numeric `_id`.
   * Returns: { rows, nextId }
   *
   * Notes:
   * - By default mutates rows in-place to match current app behavior and avoid
   *   unnecessary copies. Pass mutate=false for a copy.
   */
  function ensureRowIds(rows, opts) {
    opts = opts || {};
    var startId = isFiniteNumber(opts.startId) ? opts.startId : 1;
    var mutate = opts.mutate !== false;

    var out = mutate ? (rows || []) : (rows || []).map(function (r) { return Object.assign({}, r); });
    var nextId = startId;

    for (var i = 0; i < out.length; i++) {
      var r = out[i];
      var id = r && r._id;
      if (!isFiniteNumber(id)) {
        r._id = nextId++;
      } else if (id >= nextId) {
        nextId = id + 1;
      }
    }
    return { rows: out, nextId: nextId };
  }

  /**
   * Build fast lookup structures for rows by `_id`.
   * Returns: { map, object }
   */
  function indexById(rows) {
    var map = new Map();
    var obj = Object.create(null);
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (!r) continue;
      var id = r._id;
      if (!isFiniteNumber(id)) continue;
      map.set(id, r);
      obj[id] = r;
    }
    return { map: map, object: obj };
  }

  return {
    ensureRowIds: ensureRowIds,
    indexById: indexById
  };
});
