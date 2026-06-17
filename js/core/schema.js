/* core/schema.js
 * Schema utilities for header normalization and column detection.
 *
 * Provides two main helpers:
 *   - normalizeHeader(str): normalize header strings by lowercasing and
 *     removing all non-alphanumeric characters. This matches the
 *     philosophy used in existing utils but centralizes it for
 *     schema-related logic.
 *   - findColumnIndex(headers, aliases): given a list of header
 *     strings and a list of alias tokens (already normalized),
 *     returns the index of the first header whose normalized form
 *     exactly matches, starts with, or contains any alias. Returns
 *     -1 when no match is found.
 *
 * This module attaches its API to App.Core.Schema when running in
 * the browser. It also exports the functions for Node.js testing.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node/CommonJS export
    module.exports = factory(global || globalThis);
  } else {
    // Browser: attach to App.Core.Schema
    global.App = global.App || {};
    global.App.Core = global.App.Core || {};
    const api = factory(global);
    global.App.Core.Schema = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (G) {
  'use strict';

  /**
   * Normalize a header string by lowercasing and removing non-alphanumeric
   * characters. Leading/trailing whitespace is trimmed. This helper makes
   * comparisons robust across variations like spaces, underscores, dashes,
   * etc.
   *
   * @param {string} str
   * @returns {string}
   */
  function normalizeHeader(str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '');
  }

  /**
   * Find the index of a column whose normalized header matches any of the
   * provided aliases. An alias is considered a match when the normalized
   * header exactly equals, starts with, or includes the alias. Aliases
   * should already be normalized (e.g. via normalizeHeader) prior to
   * invocation.
   *
   * @param {string[]} headers - Original header strings
   * @param {string[]} aliases - Normalized alias tokens
   * @returns {number} - The index of the matching header, or -1 if none
   */
  function findColumnIndex(headers, aliases) {
    const H = Array.isArray(headers) ? headers : [];
    const A = Array.isArray(aliases) ? aliases : [];
    for (let i = 0; i < H.length; i++) {
      const hNorm = normalizeHeader(H[i]);
      for (let j = 0; j < A.length; j++) {
        const alias = String(A[j] || '');
        if (!alias) continue;
        if (hNorm === alias || hNorm.startsWith(alias) || hNorm.includes(alias)) {
          return i;
        }
      }
    }
    return -1;
  }

  return {
    normalizeHeader: normalizeHeader,
    findColumnIndex: findColumnIndex,
  };
});