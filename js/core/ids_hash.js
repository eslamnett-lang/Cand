/* js/core/ids_hash.js
 * Stable non-cryptographic hashes for UI/selftest comparisons.
 *
 * Notes:
 * - Purpose: detect change (pagination/filter/details) without dumping sensitive data.
 * - We intentionally avoid crypto.subtle to keep this synchronous and file:// friendly.
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.Core = global.App.Core || {};

  // FNV-1a 32-bit
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // h *= 16777619 (with overflow)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function toHex32(n) {
    return ('00000000' + (n >>> 0).toString(16)).slice(-8);
  }

  function hashText(text) {
    const s = text == null ? '' : String(text);
    return toHex32(fnv1a32(s));
  }

  function hashIds(ids) {
    const arr = Array.isArray(ids) ? ids : [];
    // Normalize to string with separator to reduce ambiguity.
    const s = arr.map((x) => String(x)).join('|');
    return toHex32(fnv1a32(s));
  }

  global.App.Core.IdsHash = {
    hashText,
    hashIds,
  };
})(window);
