/* core/filter_engine.js
 * Pure filter engine extracted from current js/data.js (computeView).
 *
 * Filter keys:
 * - ALL
 * - BALANCE: deductFrom contains "balance" AND NOT contains "free"
 * - UNITS:   deductFrom contains "free"    AND NOT contains "balance"
 * - BONUS:   deductFrom equals "bonus" (exact, after normalize)
 * - JUNK:    (balance AND free) OR equals "bonus/free unit"
 *
 * This file is intentionally dependency-free and does NOT touch DOM.
 *
 * Browser: attaches to window.App.Core.FilterEngine
 * Node: module.exports
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(global || globalThis);
  } else {
    global.App = global.App || {};
    global.App.Core = global.App.Core || {};
    const api = factory(global);
    global.App.Core.FilterEngine = api;
    // Phase 3: Single source of truth for Rules registry
    // Legacy code expects App.Rules.list/register/... so we mirror it here.
    try {
      if (api && api.Rules) {
        global.App.Rules = api.Rules;
      }
    } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : globalThis, function (G) {
  'use strict';

  const g = G || (typeof window !== 'undefined' ? window : globalThis);

  function normDeductLocal(v) {
    return String(v == null ? '' : v).toLowerCase().trim();
  }

  function normDeductCompat(v) {
    try {
      if (typeof g.normDeduct === 'function') return g.normDeduct(v);
    } catch (_) {}
    return normDeductLocal(v);
  }

  function matchesFilter(filterKey, row) {
    const d = normDeductLocal(row && row.deductFrom);
    switch (filterKey) {
      case 'BALANCE':
        return d.includes('balance') && !d.includes('free');
      case 'UNITS':
        return d.includes('free') && !d.includes('balance');
      case 'BONUS':
        return d === 'bonus';
      case 'JUNK':
        return (d.includes('balance') && d.includes('free')) || d === 'bonus/free unit';
      case 'ALL':
      default:
        return true;
    }
  }

  /**
   * Apply a main filter to rows.
   * IMPORTANT: To keep this module pure, it does not clone/mutate rows.
   * (In the current app, computeView clones rows and adds _start; that is
   * left in js/data.js for now to keep Zero Regression.)
   */
  function apply(filterKey, rows) {
    const key = filterKey || 'ALL';
    const src = Array.isArray(rows) ? rows : [];
    if (key === 'ALL') return src.slice();
    return src.filter((r) => matchesFilter(key, r));
  }

  /**
   * Phase4-compatible signature:
   * applyFilter(rows, filterKey, rules)
   * - rows: array of row objects
   * - filterKey: one of ALL/BALANCE/UNITS/BONUS/JUNK
   * - rules (optional): { matchesFilter(filterKey, row), normDeduct(v) }
   */
  function applyFilter(rows, filterKey, rules) {
    const r = rules && typeof rules.matchesFilter === 'function' ? rules : null;
    if (!r) return apply(filterKey, rows);
    const key = filterKey || 'ALL';
    const src = Array.isArray(rows) ? rows : [];
    if (key === 'ALL') return src.slice();
    return src.filter((row) => r.matchesFilter(key, row));
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Unified Rules registry (breakdown rules)
  // ---------------------------------------------------------------------------

  function createRulesRegistry() {
    const _all = [];
    let _list = [];

    function _rebuild() {
      _list = _all
        .filter((r) => r && r.enabled !== false)
        .sort((a, b) => {
          const sa = String(a.stage || '');
          const sb = String(b.stage || '');
          if (sa !== sb) return sa < sb ? -1 : 1;
          const oa = Number.isFinite(+a.order) ? +a.order : 0;
          const ob = Number.isFinite(+b.order) ? +b.order : 0;
          if (oa !== ob) return oa - ob;
          return String(a.key || '').localeCompare(String(b.key || ''));
        });
    }

    function register(rule) {
      try {
        if (!rule || typeof rule.matches !== 'function') return;
        if (!rule.key) {
          rule.key =
            String(rule.id || '').trim() ||
            ('RULE_' + Math.random().toString(16).slice(2)).toUpperCase();
        }
        if (rule.enabled === undefined) rule.enabled = true;
        if (!rule.stage) rule.stage = 'sections';
        if (rule.order === undefined) rule.order = 1000 + _all.length;

        const k = String(rule.key).trim();
        const idx = _all.findIndex((r) => r && String(r.key).trim() === k);
        if (idx >= 0) _all[idx] = rule;
        else _all.push(rule);

        _rebuild();
      } catch (_) {}
    }

    function setEnabled(key, enabled) {
      try {
        const k = String(key || '').trim();
        const r = _all.find((x) => x && String(x.key).trim() === k);
        if (!r) return false;
        r.enabled = !!enabled;
        _rebuild();
        return true;
      } catch (_) {
        return false;
      }
    }

    function configure(map) {
      try {
        if (!map) return;
        Object.keys(map).forEach(function (k) {
          const cfg = map[k] || {};
          const r = _all.find(
            (x) => x && String(x.key).trim() === String(k).trim()
          );
          if (!r) return;
          if (cfg.enabled !== undefined) r.enabled = !!cfg.enabled;
          if (cfg.order !== undefined) r.order = cfg.order;
          if (cfg.stage) r.stage = cfg.stage;
        });
        _rebuild();
      } catch (_) {}
    }

    return {
      get list() {
        return _list;
      },
      get all() {
        return _all.slice();
      },
      register,
      setEnabled,
      configure,
    };
  }

  function registerBuiltInRules(R) {
    // BALANCE
    R.register({
      key: 'BALANCE',
      enabled: true,
      stage: 'sections',
      order: 10,
      label: 'سحب من الرصيد',
      matches(row) {
        const v = normDeductCompat(row && row.deductFrom);
        return v.includes('balance') && !v.includes('free');
      },
      explain: 'تم السحب من الرصيد فقط دون استهلاك وحدات مجانية.',
      summarize(rows, ctx) {
        const toNumber = ctx && ctx.Utils && ctx.Utils.toNumber;
        const feeHeader =
          ctx && ctx.State && ctx.State.feeIdx >= 0
            ? ctx.State.headers[ctx.State.feeIdx]
            : null;
        let total = 0,
          list = [],
          currency = '';
        (rows || []).forEach((r) => {
          if (!feeHeader || typeof toNumber !== 'function') return;
          const cell = String(r[feeHeader] ?? '');
          const n = toNumber(cell);
          total += n;
          if (n) list.push(n);
          if (!currency) {
            let cur = cell
              .replace(/[0-9.,\-\s]/g, '')
              .trim()
              .toUpperCase();
            if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP';
            else if (cur) currency = cur;
          }
        });
        return { totalFee: total, feeParts: list, currency };
      },
    });

    // UNITS
    R.register({
      key: 'UNITS',
      enabled: true,
      stage: 'sections',
      order: 20,
      label: 'استهلاك وحدات مجانية',
      matches(row) {
        const v = normDeductCompat(row && row.deductFrom);
        return v.includes('free') && !v.includes('balance');
      },
      explain: 'تم استهلاك وحدات مجانية فقط دون خصم من الرصيد.',
      summarize(rows, ctx) {
        const toNumber = ctx && ctx.Utils && ctx.Utils.toNumber;
        const unitHeader =
          ctx && ctx.State && ctx.State.unitIdx >= 0
            ? ctx.State.headers[ctx.State.unitIdx]
            : null;
        let total = 0,
          list = [];
        (rows || []).forEach((r) => {
          if (!unitHeader || typeof toNumber !== 'function') return;
          const n = toNumber(r[unitHeader]);
          total += n;
          if (n) list.push(n);
        });
        return { totalUnits: total, unitParts: list };
      },
    });

    // BONUS
    R.register({
      key: 'BONUS',
      enabled: true,
      stage: 'sections',
      order: 30,
      label: 'سلفنى (Bonus)',
      matches(row) {
        const v = normDeductCompat(row && row.deductFrom);
        return v === 'bonus';
      },
      explain: 'حالات Bonus الخالصة فقط (بدون أي إضافات).',
      summarize(rows, ctx) {
        const toNumber = ctx && ctx.Utils && ctx.Utils.toNumber;
        const feeHeader =
          ctx && ctx.State && ctx.State.feeIdx >= 0
            ? ctx.State.headers[ctx.State.feeIdx]
            : null;
        let totalFee = 0,
          feeParts = [],
          currency = '';
        (rows || []).forEach((r) => {
          if (!feeHeader || typeof toNumber !== 'function') return;
          const cell = String(r[feeHeader] ?? '');
          const n = toNumber(cell);
          totalFee += n;
          if (n) feeParts.push(n);
          if (!currency) {
            let cur = cell
              .replace(/[0-9.,\-\s]/g, '')
              .trim()
              .toUpperCase();
            if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP';
            else if (cur) currency = cur;
          }
        });
        return { totalFee, feeParts, currency };
      },
    });

    // JUNK
    R.register({
      key: 'JUNK',
      enabled: true,
      stage: 'sections',
      order: 40,
      label: 'مختلط / Bonus مع وحدات',
      matches(row) {
        const v = normDeductCompat(row && row.deductFrom);
        return (v.includes('balance') && v.includes('free')) || v === 'bonus/free unit';
      },
      explain:
        'يتضمن خصم من الرصيد مع استهلاك وحدات مجانية، أو حالة Bonus/Free Unit.',
      summarize(rows, ctx) {
        const toNumber = ctx && ctx.Utils && ctx.Utils.toNumber;
        const feeHeader =
          ctx && ctx.State && ctx.State.feeIdx >= 0
            ? ctx.State.headers[ctx.State.feeIdx]
            : null;
        const unitHeader =
          ctx && ctx.State && ctx.State.unitIdx >= 0
            ? ctx.State.headers[ctx.State.unitIdx]
            : null;

        let totalFee = 0,
          feeParts = [],
          currency = '';
        let totalUnits = 0,
          unitParts = [];

        (rows || []).forEach((r) => {
          if (feeHeader && typeof toNumber === 'function') {
            const cell = String(r[feeHeader] ?? '');
            const n = toNumber(cell);
            totalFee += n;
            if (n) feeParts.push(n);
            if (!currency) {
              let cur = cell
                .replace(/[0-9.,\-\s]/g, '')
                .trim()
                .toUpperCase();
              if (/EGP|LE|ج|جنيه/.test(cur)) currency = 'EGP';
              else if (cur) currency = cur;
            }
          }
          if (unitHeader && typeof toNumber === 'function') {
            const u = toNumber(r[unitHeader]);
            totalUnits += u;
            if (u) unitParts.push(u);
          }
        });
        return { totalFee, feeParts, currency, totalUnits, unitParts };
      },
    });

    // FREE_UNITS (detailed)
    R.register({
      key: 'FREE_UNITS',
      enabled: true,
      stage: 'sections',
      order: 50,
      label: 'استهلاك وحدات',
      matches(row) {
        const v = String((row && row.deductFrom) || '').toLowerCase();
        return v.includes('free');
      },
      summarize(rows, ctx2) {
        const State = (ctx2 && ctx2.State) || {};
        const H = State.headers || [];
        const norm = (s) =>
          String(s || '')
            .toLowerCase()
            .replace(/[\s_\/\-\.\(\)]+/g, '');
        const idx = (aliases) => {
          for (let i = 0; i < H.length; i++) {
            const h = norm(H[i]);
            for (const a of aliases) {
              if (h.indexOf(norm(a)) !== -1) return i;
            }
          }
          return -1;
        };
        const iBefore = idx(['Free Unit Before', 'Units Before', 'Free Before']);
        const iCons = idx([
          'Free Unit Consumed',
          'Units Consumed',
          'Free Consumed',
          'freeunitconsumed',
        ]);
        const iAfter = idx(['Free Unit After', 'Units After', 'Free After']);
        const iUsage = idx(['Usage']);
        const iMU = idx(['Measure Unit', 'Unit']);
        const iOffer = idx(['Consumed Offer', 'Offer', 'Offering Name']);
        const iFName = idx(['Free Unit Name', 'Unit Name']);
        const iStart = idx(['Start Time', 'startTime', 'start time']);
        const iEnd = idx(['End Time', 'endTime', 'end time']);
        const toNum = (x) => {
          const n = Number(String(x || '').toString().replace(/[^0-9\.-]/g, ''));
          return isNaN(n) ? 0 : n;
        };
        const toDate = (val) => {
          if (val instanceof Date) return val;
          try {
            if (g.App && g.App.Utils && typeof g.App.Utils.parseDateFlex === 'function') {
              return g.App.Utils.parseDateFlex(val) || new Date(val);
            }
            return new Date(val);
          } catch (e) {
            return null;
          }
        };
        const timeArabic = (d) => {
          if (!d || isNaN(d)) return '—';
          const h = d.getHours ? d.getHours() : 0;
          const m = String(d.getMinutes ? d.getMinutes() : 0).padStart(2, '0');
          const am = h < 12;
          const hh = h % 12 || 12;
          return hh + ':' + m + ' ' + (am ? 'صباحا' : 'مساءا');
        };
        const sameDay = (a, b) =>
          a &&
          b &&
          a.getFullYear &&
          b.getFullYear &&
          a.getFullYear() === b.getFullYear() &&
          a.getMonth() === b.getMonth() &&
          a.getDate() === b.getDate();
        const fmtDT = (d) =>
          g.App && g.App.Utils && typeof g.App.Utils.fmtArabicDT === 'function'
            ? g.App.Utils.fmtArabicDT(d)
            : d
              ? d.toLocaleString('ar-EG')
              : '';

        let totalUnits = 0,
          unitParts = [],
          details = [];
        (rows || []).forEach((r) => {
          const before = iBefore >= 0 ? r[H[iBefore]] : '';
          const cons = iCons >= 0 ? r[H[iCons]] : '';
          const after = iAfter >= 0 ? r[H[iAfter]] : '';
          const usage = iUsage >= 0 ? r[H[iUsage]] : '';
          const mu = iMU >= 0 ? r[H[iMU]] : '';
          const offer = iOffer >= 0 ? r[H[iOffer]] : '';
          const fname = iFName >= 0 ? r[H[iFName]] : '';

          const start = iStart >= 0 ? toDate(r[H[iStart]]) : null;
          const end = iEnd >= 0 ? toDate(r[H[iEnd]]) : null;

          const beforeTxt =
            before !== undefined && before !== null && before !== ''
              ? String(before)
              : '—';
          const consTxt =
            cons !== undefined && cons !== null && cons !== '' ? String(cons) : '—';
          const afterTxt =
            after !== undefined && after !== null && after !== ''
              ? String(after)
              : '—';
          const usageTxt =
            usage !== undefined && usage !== null && usage !== ''
              ? String(usage)
              : '';
          const muTxt =
            mu !== undefined && mu !== null && mu !== '' ? String(mu) : '';

          const cNum = toNum(cons);
          totalUnits += cNum;
          if (cNum) unitParts.push(cNum);

          let timeText = '';
          if (
            start &&
            end &&
            start.getTime &&
            end.getTime &&
            start.getTime() === end.getTime()
          ) {
            timeText = 'فى توقيت ' + fmtDT(start);
          } else if (sameDay(start, end)) {
            timeText = 'من توقيت ' + fmtDT(start) + ' حتى توقيت ' + timeArabic(end);
          } else if (start && end) {
            timeText = 'من توقيت ' + fmtDT(start) + ' حتى توقيت ' + fmtDT(end);
          }

          const usagePart =
            usageTxt && muTxt
              ? ' (الاستهلاك الفعلي: ' + usageTxt + ' ' + muTxt + ')'
              : usageTxt
                ? ' (الاستهلاك الفعلي: ' + usageTxt + ')'
                : '';

          const fnameRaw = fname ? String(fname) : '';
          const fparts = fnameRaw ? fnameRaw.split(',').map((x) => x.trim()) : [];
          const hasOffNet = fparts.includes('KIX_FM_OffNet_Unit');
          const hasBase = fparts.includes('KIX_FM_Unit');
          const hasExtraMBS = fparts.includes('KIX_FM_Extra_MBS');

          let fnameOut = '';
          if (hasOffNet && hasBase) {
            fnameOut =
              'خلصت وحدات تستخدم خارج الشبكة بواقع الوحدة = 1 دقيقة واتحولت إلى الوحدات الأساسية.';
          } else if (hasOffNet) {
            fnameOut = 'وحدات تستخدم خارج الشبكة بواقع الوحدة = 1 دقيقة.';
          } else if (hasBase) {
            fnameOut = 'الوحدات الأساسية.';
          } else if (hasExtraMBS) {
            fnameOut = 'ميجابايتس للفيسبوك و واتس اب و انستاجرام.';
          } else if (fnameRaw) {
            fnameOut = fnameRaw;
          }

          const splitToPhrase = (txt3) => {
            if (txt3 === undefined || txt3 === null) return '—';
            const s = String(txt3);
            if (s.indexOf(',') === -1) return s;
            const parts = s.split(',').map((v) => v.trim()).filter(Boolean);
            if (parts.length !== 2) return s;
            const nums = parts.map((p) => Number(String(p).replace(/[^0-9\.-]/g, '')));
            if (nums.some((n) => isNaN(n))) {
              const baseV = parts[1] || '0';
              const offV = parts[0] || '0';
              return baseV + ' وحدة أساسية و ' + offV + ' وحدة من وحدات خارج الشبكة';
            }
            const baseV = Math.max(nums[0], nums[1]);
            const offV = Math.min(nums[0], nums[1]);
            return baseV + ' وحدة أساسية و ' + offV + ' وحدة من وحدات خارج الشبكة';
          };

          const bothTypes = hasOffNet && hasBase;
          const beforeOut = bothTypes ? splitToPhrase(beforeTxt) : beforeTxt || '—';
          const afterOut = bothTypes ? splitToPhrase(afterTxt) : afterTxt || '—';
          const afterDash = fnameOut ? ' — (' + fnameOut + ') · مصدر الخصم' : '';

          const line =
            (timeText ? timeText + ' ' : '') +
            'كان معاك قبل الاستهلاك ' +
            beforeOut +
            (bothTypes ? '' : ' وحدة') +
            '، ' +
            'واستهلكت منهم ' +
            consTxt +
            ' وحدة، ' +
            'وباقي معاك ' +
            afterOut +
            (bothTypes ? '' : ' وحدة.') +
            usagePart +
            afterDash;
          details.push(line);
        });

        return {
          totalFee: 0,
          feeParts: [],
          currency: '',
          totalUnits,
          unitParts,
          details,
        };
      },
    });
  }

  const Rules = createRulesRegistry();
  registerBuiltInRules(Rules);

  // Optional runtime configuration and extension (same behavior as Phase 1)
  try {
    const C2 = (g.App && g.App.Config) || {};
    if (C2 && C2.RULES_REGISTRY) Rules.configure(C2.RULES_REGISTRY);
  } catch (_) {}
  try {
    const C = (g.App && g.App.Config) || {};
    const ext = Array.isArray(C.SECTION_RULES_EXT) ? C.SECTION_RULES_EXT : [];
    ext.forEach(function (r) {
      try {
        if (r && typeof r.matches === 'function') Rules.register(r);
      } catch (_) {}
    });
  } catch (_) {}

  return {
    normDeduct: normDeductLocal,
    matchesFilter,
    apply,
    applyFilter,
    Rules,
  };
});
