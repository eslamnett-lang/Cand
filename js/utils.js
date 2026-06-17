/**
 * mndoview - Utils (Dev-Ready)
 * - Single IIFE, no duplicate exports.
 * - Central Config.
 * - Rules-based deductionReason for easy extension.
 * - JSDoc typedefs for better editor hints.
 * - Debug helper (optional UI hook).
 */
(function(global){
  'use strict';

  // ---------------------------------------------------------------------------
  // JSDoc typedefs
  // ---------------------------------------------------------------------------
  /**
   * @typedef {Object.<string, any>} Row - Generic data row (Excel record)
   * @typedef {string[]} Headers - Sheet header array
   * @typedef {{ weCustomerCareNumbers: string[]|number[], aliases: Record<string, string[]> }} AppConfig
   */

  // ---------------------------------------------------------------------------
  // Config (can be moved to a separate file later). We merge with existing.
  // ---------------------------------------------------------------------------
  global.App = global.App || {};
  /** @type {AppConfig} */
  const DEFAULT_CONFIG = {
    weCustomerCareNumbers: ['111','19777','01555000111'],
    aliases: {
      serviceType: ['service type','servicetype','type'],
      offeringName: ['offering name','offering','package name','packagename'],
      targetServiceNo: ['target service no.','target service no','targetserviceno','target number','target no','target']
    }
  };
  global.App.Config = Object.assign({}, DEFAULT_CONFIG, global.App.Config || {});

  // ---------------------------------------------------------------------------
  // Tiny DOM helper (no jQuery dependency)
  // ---------------------------------------------------------------------------
  function $(sel, root){ return (root||document).querySelector(sel); }

  // ---------------------------------------------------------------------------
  // String/Number/Date helpers
  // ---------------------------------------------------------------------------
  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }

  function excelToDate(v){
    if (v instanceof Date) return v;
    if (typeof v === 'number'){
      var ms = Math.round((v - 25569) * 86400 * 1000); // Excel epoch 1899-12-30
      return new Date(ms);
    }
    var d = new Date(v);
    return isNaN(d) ? null : d;
  }

  function fmtDate(d){
    var dd = (d instanceof Date) ? d : excelToDate(d);
    if (!dd || isNaN(dd)) return '';
    try { return dd.toLocaleDateString('ar-EG'); } catch(e){ return dd.toISOString().slice(0,10); }
  }

  function fmtArabicDT(d){
    var dd = (d instanceof Date) ? d : excelToDate(d);
    if (!dd || isNaN(dd)) return '';
    try { return dd.toLocaleString('ar-EG'); } catch(e){ return dd.toISOString().replace('T',' ').slice(0,16); }
  }

  function parseDateFlex(v){
    if (v instanceof Date) return v;
    if (typeof v === 'number') return excelToDate(v);
    if (typeof v === 'string'){
      var t = v.trim();
      var d = new Date(t);
      if (!isNaN(d)) return d;
      // dd/mm/yyyy hh:mm
      var m = t.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (m){
        var day = parseInt(m[1],10), mon = parseInt(m[2],10)-1, yr = parseInt(m[3],10); if (yr<100) yr+=2000;
        var hh = m[4]?parseInt(m[4],10):0, mm = m[5]?parseInt(m[5],10):0;
        var dt = new Date(yr, mon, day, hh, mm);
        if (!isNaN(dt)) return dt;
      }
    }
    return null;
  }

  function normalizeHeader(str){
    return String(str||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'').trim();
  }

  function colIndexByAliases(headers, aliases){
    var H = headers||[];
    var cand = (aliases||[]).map(function(x){ return normalizeHeader(x); });
    for (var i=0;i<H.length;i++){
      var h = normalizeHeader(H[i]);
      for (var j=0;j<cand.length;j++){
        if (h.indexOf(cand[j]) !== -1) return i;
      }
    }
    return -1;
  }

  function headerIndex(headers, keyOrAliases){
    var aliasList = Array.isArray(keyOrAliases)
      ? keyOrAliases
      : ((global.App && global.App.Config && global.App.Config.aliases[keyOrAliases]) || [keyOrAliases]);
    return colIndexByAliases(headers, aliasList);
  }

  function toNumber(x){
    var s = String(x||'').replace(/[\s\u00A0]/g,'');
    // normalize comma/period
    if ((s.match(/\./g)||[]).length>1 && s.indexOf(',')>=0){
      s = s.replace(/\./g,'').replace(',', '.');
    } else if (s.indexOf(',')>=0 && s.indexOf('.')<0){
      s = s.replace(',', '.');
    }
    var n = parseFloat(s.replace(/[^0-9\.-]/g,''));
    return isNaN(n) ? 0 : n;
  }

  // ---------------------------------------------------------------------------
  // DEDUCTION RULES (easy to extend)
  // ---------------------------------------------------------------------------
  /** @type {{key:string, match:(ctx:any)=>boolean, reason:(ctx:any)=>string}[]} */
  const DEDUCTION_RULES = [
    {
      key: 'offnet-voice',
      match: function(ctx){ return ctx.s === 'off-net voice'; },
      reason: function(){ return 'مكالمة خارج الشبكه'; }
    },
    {
      key: 'local-call-we-care',
      match: function(ctx){ return ctx.s === 'local call' && ctx.weList.some(function(n){ return ctx.digits.indexOf(n) !== -1; }); },
      reason: function(){ return 'مكالمه الى خدمة العملاء'; }
    },
    {
      key: 'local-call-we',
      match: function(ctx){ return ctx.s === 'local call'; },
      reason: function(){ return 'مكالمه تابعه لشبكات وى'; }
    },
    {
      key: 'internet',
      match: function(ctx){ return ctx.s.indexOf('internet') !== -1; },
      reason: function(){ return 'إنترنت'; }
    },
    {
      key: 'business-balance',
      match: function(ctx){ return ctx.s.indexOf('business fee charged by balance') !== -1 || ctx.s.indexOf('business') !== -1; },
      reason: function(){ return 'خدمات الدفع من الرصيد'; }
    }
  ];

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------
  /**
   * Compute a stable row key from a few core columns.
   * @param {Headers} headers
   * @param {Row} row
   * @returns {string}
   */
  function computeRowKey(headers, row){
    var norm = function(x){ return String(x||'').trim(); };
    var stIdx  = headerIndex(headers, 'serviceType');
    var offIdx = headerIndex(headers, 'offeringName');
    var tgtIdx = headerIndex(headers, 'targetServiceNo');
      var dIdx   = headerIndex(headers, 'deductFrom');
    var vals = [
      norm(stIdx>=0 ? row[headers[stIdx]] : ''),
      norm(offIdx>=0 ? row[headers[offIdx]] : ''),
      norm(tgtIdx>=0 ? row[headers[tgtIdx]] : '')
    ];
    return vals.join(' | ').replace(/[\s\u00A0]+/g,' ').trim();
  }

  /**
   * Human-readable deduction reason using rules.
   * @param {Headers} headers
   * @param {Row} row
   * @returns {string}
   */
  function deductionReason(headers, row){
    try{
      var C = (global.App && global.App.Config) || {};
      var weList = (C.weCustomerCareNumbers || []).map(function(x){ return String(x).replace(/\D+/g,''); });

      var stIdx  = headerIndex(headers, 'serviceType');
      var offIdx = headerIndex(headers, 'offeringName');
      var tgtIdx = headerIndex(headers, 'targetServiceNo');
      var dIdx   = headerIndex(headers, 'deductFrom');

      var st       = stIdx>=0  ? String(row[headers[stIdx]] || '').trim() : '';
      var offering = offIdx>=0 ? String(row[headers[offIdx]] || '').trim() : '';
      var target   = tgtIdx>=0 ? String(row[headers[tgtIdx]] || '') : '';
      var deductRaw = dIdx>=0 ? String(row[headers[dIdx]]||'') : '';
      var deduct = deductRaw.toLowerCase();
      var s = st.toLowerCase();
      var digits = target.replace(/\D+/g,'');

      var ctx = { s: s, digits: digits, weList: weList, headers: headers, row: row, config: C, deduct: deduct };
      var rules = Array.isArray(C.DEDUCTION_RULES_EXT) ? C.DEDUCTION_RULES_EXT.concat(DEDUCTION_RULES) : DEDUCTION_RULES;
      var hit = null;
      for (var i=0;i<rules.length;i++){
        try{ if (rules[i] && typeof rules[i].match==='function' && rules[i].match(ctx)){ hit = rules[i]; break; } }catch(_){ }
      }
      if (hit && typeof hit.reason==='function') return hit.reason(ctx);

      // Fallback to offering name if exists
      return offering || (C && C.defaultReasonText) || '';
    }catch(e){ return ''; }
  }

  // ---------------------------------------------------------------------------
  // Debug helper (optional)
  // ---------------------------------------------------------------------------
  var Debug = {
    /**
     * Quick smoke test for deductionReason & date parsers. Run from console or bind to a button with id="debugBtn".
     */
    run: function(){
      var H = ['Service Type','Target Service No.','Offering Name'];
      var samples = [
        { 'Service Type':'Off-net Voice', 'Target Service No.':'01012345678', 'Offering Name':'—' },
        { 'Service Type':'Local call',    'Target Service No.':'02-19777',     'Offering Name':'—' },
        { 'Service Type':'Local call',    'Target Service No.':'01555000111',  'Offering Name':'—' },
        { 'Service Type':'Internet',      'Target Service No.':'—',            'Offering Name':'Daily Pack' }
      ];
      console.groupCollapsed('Debug: deductionReason');
      samples.forEach(function(r){
        var reason = deductionReason(H, r);
        console.log(r['Service Type'], r['Target Service No.'], '=>', reason);
      });
      console.groupEnd();
      alert('Debug finished. Check console for results.');
    }
  };

  // Auto-wire debug button if exists
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('debugBtn');
    if (btn) btn.addEventListener('click', Debug.run);
  });

  
  /**
   * Build the "comment" suffix that appears in the breakdown details (e.g. " وسبب الخصم: ...").
   * This is intentionally rules-based for easy extension without touching View code.
   *
   * Extension point:
   *   App.Config.BREAKDOWN_COMMENT_RULES_EXT = [
   *     { match(ctx){...}, comment(ctx){ return " ..." } }
   *   ]
   *
   * @param {string[]} headers
   * @param {Row} row
   * @param {string} sectionKey - e.g. "BALANCE" | "BONUS" | "UNITS" | "ALL" | custom
   * @param {Object} [opts]
   * @param {string} [opts.reason] - precomputed reason to avoid recomputing
   * @returns {string}
   */
  function breakdownComment(headers, row, sectionKey, opts){
    try{
      var C = (global.App && global.App.Config) || {};
      var reason = (opts && typeof opts.reason === 'string') ? opts.reason : deductionReason(headers, row);
      var ctx = { headers: headers, row: row, sectionKey: String(sectionKey||'').toUpperCase(), reason: reason, config: C };
      var ext = Array.isArray(C.BREAKDOWN_COMMENT_RULES_EXT) ? C.BREAKDOWN_COMMENT_RULES_EXT : [];
      for (var i=0;i<ext.length;i++){
        try{
          var rule = ext[i];
          if (rule && typeof rule.match === 'function' && rule.match(ctx)){
            if (typeof rule.comment === 'function') return String(rule.comment(ctx) || '');
            if (typeof rule.text === 'string') return rule.text;
          }
        }catch(_){}
      }
      return reason ? (' وسبب الخصم: ' + reason) : '';
    }catch(e){ return ''; }
  }


  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------
  /**
   * Copy text to clipboard with a safe fallback.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  function copyToClipboard(text){
    return new Promise(function(resolve){
      try{
        var t = String(text == null ? '' : text);
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(t).then(function(){ resolve(true); }).catch(function(){
            try{
              var ta = document.createElement('textarea');
              ta.value = t;
              ta.setAttribute('readonly','');
              ta.style.position = 'fixed';
              ta.style.left = '-9999px';
              ta.style.top = '0';
              document.body.appendChild(ta);
              ta.select();
              var ok = false;
              try{ ok = document.execCommand('copy'); }catch(_){ ok = false; }
              document.body.removeChild(ta);
              resolve(!!ok);
            }catch(_){ resolve(false); }
          });
          return;
        }
        // Fallback
        var ta2 = document.createElement('textarea');
        ta2.value = t;
        ta2.setAttribute('readonly','');
        ta2.style.position = 'fixed';
        ta2.style.left = '-9999px';
        ta2.style.top = '0';
        document.body.appendChild(ta2);
        ta2.select();
        var ok2 = false;
        try{ ok2 = document.execCommand('copy'); }catch(_){ ok2 = false; }
        document.body.removeChild(ta2);
        resolve(!!ok2);
      }catch(_){ resolve(false); }
    });
  }

// ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  global.App = Object.assign(global.App || {}, {
    $: $,
    Utils: {
      computeRowKey: computeRowKey,
      deductionReason: deductionReason,
      escapeHTML: escapeHTML,
      excelToDate: excelToDate,
      fmtDate: fmtDate,
      fmtArabicDT: fmtArabicDT,
      parseDateFlex: parseDateFlex,
      colIndexByAliases: colIndexByAliases,
      toNumber: toNumber,
      normalizeHeader: normalizeHeader,
      headerIndex: headerIndex,
      breakdownComment: breakdownComment,
      copyToClipboard: copyToClipboard
    },
    Debug: Debug,
    Deductions: DEDUCTION_RULES
  });
})(window);