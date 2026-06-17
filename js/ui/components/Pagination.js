/* js/ui/components/Pagination.js
 * Prev/Next paging controls.
 *
 * Keeps behavior identical by using the existing pageInfo label as the ground truth
 * for max pages (includes header-filters impact).
 */

(function (global) {
  'use strict';

  global.App = global.App || {};
  global.App.UI = global.App.UI || {};
  global.App.UI.Components = global.App.UI.Components || {};

  function parsePageInfo(text) {
    const t = String(text || '').trim();
    const m = t.match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { page: 1, maxPage: 1 };
    return { page: Math.max(1, Number(m[1]) || 1), maxPage: Math.max(1, Number(m[2]) || 1) };
  }

  function Pagination() {
    let _store = null;
    let _prevBtn = null;
    let _nextBtn = null;
    let _pageInfo = null;

    function init(container, store) {
      _store = store;
      _prevBtn = document.getElementById('prevPage');
      _nextBtn = document.getElementById('nextPage');
      _pageInfo = document.getElementById('pageInfo');

      if (_prevBtn && !_prevBtn.__cmpBound) {
        _prevBtn.__cmpBound = true;
        _prevBtn.addEventListener('click', function () {
          if (!_store || typeof _store.dispatch !== 'function') return;
          const cur = parsePageInfo(_pageInfo ? _pageInfo.textContent : '');
          if (cur.page > 1) _store.dispatch({ type: 'SET_PAGE', page: cur.page - 1 });
        });
      }

      if (_nextBtn && !_nextBtn.__cmpBound) {
        _nextBtn.__cmpBound = true;
        _nextBtn.addEventListener('click', function () {
          if (!_store || typeof _store.dispatch !== 'function') return;
          const cur = parsePageInfo(_pageInfo ? _pageInfo.textContent : '');
          if (cur.page < cur.maxPage) _store.dispatch({ type: 'SET_PAGE', page: cur.page + 1 });
        });
      }
    }

    function render() {
      // No-op: pageInfo is already rendered by the table renderer.
    }

    return { init, render };
  }

  global.App.UI.Components.Pagination = Pagination;
})(window);
