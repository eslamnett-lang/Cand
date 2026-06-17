
// === App.SelectEnhance — Professional selection UX for table & breakdown ===
(function(global){
  'use strict';

  var App = global.App = global.App || {};
  var SelectEnhance = App.SelectEnhance = App.SelectEnhance || {};

  // Public flag + API for other modules (e.g., drag-pan) to respect
  var __MODE = false;
  SelectEnhance.isSelecting = function(){ return __MODE; };

  function inAreas(t){
    return !!(t && (t.closest('.table-wrap') || t.closest('#consumptionBreakdown')));
  }
  function isInteractive(t){
    return !!(t && t.closest('input,textarea,select,a,button,label'));
  }
  function wrapOf(t){
    return (t && t.closest('.table-wrap')) || null;
  }
  function isDragging(t){
    var w = wrapOf(t); return !!(w && w.classList.contains('dragging'));
  }
  function clearSelection(){
    try{
      var sel = global.getSelection();
      if (sel && sel.rangeCount) sel.removeAllRanges();
    }catch(_){}
  }
  function selectNodeContents(el){
    try{
      var r = document.createRange();
      r.selectNodeContents(el);
      var sel = global.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
    }catch(_){}
  }
  function setMode(on, wrap){
    __MODE = !!on;
    if (wrap){
      if (on) wrap.classList.add('force-selecting');
      else wrap.classList.remove('force-selecting');
    }
  }

  // --- Word selection helpers ---
  function isWordChar(ch){
    if (!ch) return false;
    var code = ch.charCodeAt(0);
    // Arabic letters (0621–064A), Arabic-Indic digits (0660–0669), Tatweel (0640), diacritics (064B–065F)
    if ((code>=0x0621 && code<=0x064A) || code===0x0640 || (code>=0x064B && code<=0x065F) || (code>=0x0660 && code<=0x0669)) return true;
    // Latin letters/digits/underscore
    if (/[0-9A-Za-z_]/.test(ch)) return true;
    return false;
  }
  function selectWordAtPoint(x, y, target){
    var range = null;
    if (document.caretRangeFromPoint){
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint){
      var pos = document.caretPositionFromPoint(x, y);
      if (pos){ range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
    }
    if (!range) return false;
    var node = range.startContainer;
    if (!node) return false;
    if (node.nodeType !== 3){
      // Try text child
      if (target && target.firstChild && target.firstChild.nodeType===3){
        node = target.firstChild;
        range.setStart(node, 0);
        range.collapse(true);
      } else {
        // Walk to a text node if possible
        var tn = (node.childNodes || [])[0];
        while (tn && tn.nodeType !== 3) tn = tn.firstChild;
        if (!tn) return false;
        node = tn;
      }
    }
    var text = node.textContent || "";
    var idx = range.startOffset;
    if (idx < 0) idx = 0; if (idx > text.length) idx = text.length;

    var s = idx, e = idx;
    while (s>0 && isWordChar(text[s-1])) s--;
    while (e<text.length && isWordChar(text[e])) e++;

    // امتداد خاص للأرقام ذات الفواصل/النقاط: اجمع 1.45 أو 12,345.67 أو 01:45 كاملة
    var L = s, R = e;
    function isNumTokenChar(ch){ return /[0-9.,:-]/.test(ch); }
    while (L>0 && isNumTokenChar(text[L-1])) L--;
    while (R<text.length && isNumTokenChar(text[R])) R++;
    if (L < R && /\d/.test(text.slice(L, R))) { s = L; e = R; }

    if (s===e) return false;
    var sel = global.getSelection();
    var r = document.createRange();
    r.setStart(node, s); r.setEnd(node, e);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }

  // Single click: clear existing selection
  document.addEventListener('click', function(ev){
    if (ev.detail !== 1) return;
    if (!inAreas(ev.target)) return;
    if (isInteractive(ev.target)) return;
    if (isDragging(ev.target)) return;
    clearSelection();
  }, true);

  // Triple click: select full line (details) or table row
  document.addEventListener('click', function(ev){
    if (ev.detail !== 3) return;
    if (!inAreas(ev.target)) return;
    if (isInteractive(ev.target)) return;
    if (isDragging(ev.target)) return;

    var target = ev.target.closest('.br-line') || ev.target.closest('#dataTable tr') || ev.target;
    selectNodeContents(target);
  }, true);

  // Double click: prepare selection on second mousedown, then ensure word selection on dblclick
  document.addEventListener('mousedown', function(ev){
    if (ev.button !== 0) return;
    if (!inAreas(ev.target)) return;
    if (isInteractive(ev.target)) return;
    var wrap = wrapOf(ev.target);
    if (!wrap || isDragging(ev.target)) return;
    if (ev.detail === 2){
      setMode(true, wrap);
      var off = function(){
        document.removeEventListener('mouseup', off, true);
        setTimeout(function(){ setMode(false, wrap); }, 0);
      };
      document.addEventListener('mouseup', off, true);
    }
  }, true);

  
  // Double click: select the nearest semantic chunk (like native selection but chunk-level)
  
  // Double click:
  // - In details row (.row-detail / .details-row): select WORD only (native-like)
  // - Elsewhere (main row/cell): select the nearest CHUNK (cell/line/text block)
  document.addEventListener('dblclick', function(ev){
    if (!inAreas(ev.target)) return;
    if (isInteractive(ev.target)) return;
    var wrap = wrapOf(ev.target);
    if (!wrap || isDragging(ev.target)) return;

    var inDetail = !!(ev.target.closest('.row-detail, .details-row, .row-compare, .cmp-text'));

    if (inDetail){
      // WORD-level selection in details
      var ok = selectWordAtPoint(ev.clientX, ev.clientY, ev.target);
      if (!ok){
        // fallback: minimal target
        var t2 = ev.target.closest('.br-text, .cmp-text') || ev.target;
        selectNodeContents(t2);
      }
    }else{
      // CHUNK-level selection in main table
      var target = ev.target.closest('.br-text, .cmp-text') ||
                   ev.target.closest('.br-line') ||
                   ev.target.closest('#dataTable td, #dataTable th') ||
                   ev.target;
      selectNodeContents(target);
    }
    // no preventDefault: allow extending selection with dragging
  }, true);
})(window);
