(function(global){
  'use strict';
  // Central config you can edit safely.
  // ————————————————————————————————————————————————————————————————
  // Example: numbers for WE Customer Care to be recognized as "خدمة العملاء"
  // Put only digits; any formatting will be stripped.
  var weCustomerCareNumbers = [
    "19777", // WE main short code (example)
    "01555000111" // WE customer care (example)
  ];

  // Optional: extend deduction rules without touching core files.
  // Each item = { key, match(ctx), reason(ctx) }.
  // ctx = { s: serviceTypeLower, digits: targetNumberDigits, headers, row, config }.
  
  // === User-specified deduction reason constants (high priority) ===
  var DEDUCTION_RULES_EXT = [
    // ----- Voice / Calls -----
    { key:"transfer-out", match:function(ctx){ return ctx.s==='transfer-out'||ctx.s==='transfer out'; }, reason:function(){ return "تحويل رصيد"; } },
    { key:"onnet-voice", match:function(ctx){ return ctx.s==='on-net voice'||ctx.s==='on net voice'; }, reason:function(){ return "مكالمة داخل شبكة وى"; } },
    { key:"offnet-voice", match:function(ctx){ return ctx.s==='off-net voice'||ctx.s==='off net voice'; }, reason:function(){ return "مكالمة خارج شبكة وى"; } },
    { key:"long-distance", match:function(ctx){ return ctx.s.indexOf('long distance')!==-1; }, reason:function(){ return "Long distance"; } },
    { key:"idd", match:function(ctx){ return ctx.s==='idd'; }, reason:function(){ return "مكالمة دولية (International Direct Dialing)"; } },
    { key:"national-roaming-voice", match:function(ctx){ return ctx.s==='national roaming voice'; }, reason:function(){ return "مكالمة تجوال محلي"; } },
    { key:"international-roaming-voice", match:function(ctx){ return ctx.s==='international roaming voice'; }, reason:function(){ return "مكالمة تجوال دولي"; } },
    { key:"international-voice", match:function(ctx){ return ctx.s==='international'; }, reason:function(){ return "مكالمة دولية"; } },
    { key:"premium-call", match:function(ctx){ return ctx.s==='premium call'||ctx.s==='primium call'; }, reason:function(){ return "مكالمة خاصة/مميزة"; } },
    { key:"roaming-outgoing", match:function(ctx){ return ctx.s==='roaming outgoing'; }, reason:function(){ return "مكالمة صادرة أثناء التجوال"; } },
    { key:"roaming-incoming", match:function(ctx){ return ctx.s==='roaming incoming'; }, reason:function(){ return "مكالمة واردة أثناء التجوال"; } },
    { key:"national-fixed-on-brand", match:function(ctx){ return ctx.s==='national fixed line calls on brand'; }, reason:function(){ return "مكالمات أرضية محلية داخل شبكة وى"; } },
    { key:"national-mobile-on-brand", match:function(ctx){ return ctx.s==='national mobile calls on brand'; }, reason:function(){ return "مكالمات محمول محلية داخل شبكة وى"; } },
    { key:"national-fixed-not-on-brand", match:function(ctx){ return ctx.s==='national fixed line calls not on brand'; }, reason:function(){ return "مكالمات أرضية محلية خارج الشبكة"; } },
    { key:"national-mobile-not-on-brand", match:function(ctx){ return ctx.s==='national mobile calls not on brand'; }, reason:function(){ return "مكالمات محمول محلية خارج الشبكة"; } },
    // Local call customer care
    { key:"local-call-care",
      match:function(ctx){
        if (ctx.s!=='local call') return false;
        var list=(ctx.weList||[]), d=String(ctx.digits||''), cand=[];
        if (!d) return false;
        list.forEach(function(n){ cand.push(n); cand.push('20'+n); cand.push('02'+n); });
        return cand.some(function(n){ return d.endsWith(n); }) || list.some(function(n){ return d.indexOf(n)!==-1; });
      },
      reason:function(){ return "مكالمة خدمة عملاء"; }
    },
    { key:"local-call", match:function(ctx){ return ctx.s==='local call'; }, reason:function(){ return "مكالمات داخل شبكة وى"; } },
    // Added rule for other local calls not matched above
    { key:"local-call-other",
      match:function(ctx){ return ctx.s==='local call other'; },
      reason:function(){ return "مكالمة محلية أخرى"; }
    },

    // ----- SMS / MMS -----
    { key:"onnet-sms", match:function(ctx){ return ctx.s==='on-net sms'||ctx.s==='on net sms'; }, reason:function(){ return "رسالة داخل شبكة وى"; } },
    { key:"offnet-sms", match:function(ctx){ return ctx.s==='off-net sms'||ctx.s==='off net sms'; }, reason:function(){ return "رسالة خارج شبكة وى"; } },
    { key:"premium-sms", match:function(ctx){ return ctx.s==='premium sms'; }, reason:function(){ return "رسالة مميزة/خدمة برسوم إضافية"; } },
    { key:"intl-sms", match:function(ctx){ return ctx.s==='international sms'; }, reason:function(){ return "رسالة دولية"; } },
    { key:"intl-roaming-sms", match:function(ctx){ return ctx.s==='international roaming sms'; }, reason:function(){ return "رسالة تجوال دولي (SMS)"; } },
    { key:"roaming-sms", match:function(ctx){ return ctx.s==='roaming sms'||ctx.s==='sms roaming'; }, reason:function(){ return "رسالة تجوال محلي/دولي"; } },
    { key:"premium-mt-sms", match:function(ctx){ return ctx.s==='premium mt sms'; }, reason:function(){ return "رسالة واردة برسوم إضافية"; } },
    { key:"plain-sms", match:function(ctx){ return ctx.s==='sms'; }, reason:function(){ return "رسالة نصية عادية"; } },

    { key:"onnet-mms", match:function(ctx){ return ctx.s==='on-net mms'||ctx.s==='on net mms'; }, reason:function(){ return "رسالة وسائط داخل الشبكة"; } },
    { key:"offnet-mms", match:function(ctx){ return ctx.s==='off-net mms'||ctx.s==='off net mms'; }, reason:function(){ return "رسالة وسائط خارج الشبكة"; } },
    { key:"intl-mms", match:function(ctx){ return ctx.s==='international mms'; }, reason:function(){ return "رسالة وسائط دولية"; } },
    { key:"intl-roaming-mms", match:function(ctx){ return ctx.s==='international roaming mms'; }, reason:function(){ return "رسالة وسائط تجوال دولي"; } },
    { key:"plain-mms", match:function(ctx){ return ctx.s==='mms'; }, reason:function(){ return "رسالة وسائط عادية"; } },

    // ----- Internet / Data -----
    { key:"internet-access", match:function(ctx){ return ctx.s==='internet access'; }, reason:function(){ return "استخدام إنترنت"; } },
    { key:"roaming-internet-access", match:function(ctx){ return ctx.s==='roaming internet access'; }, reason:function(){ return "استخدام إنترنت أثناء التجوال"; } },
    { key:"data-generic", match:function(ctx){ return ctx.s==='data'; }, reason:function(){ return "استهلاك بيانات"; } },
    { key:"data-roaming", match:function(ctx){ return ctx.s==='data roaming'; }, reason:function(){ return "بيانات أثناء التجوال"; } },

    // ----- Value-added & services -----
    { key:"transfer-in", match:function(ctx){ return ctx.s==='transfer-in'||ctx.s==='transfer in'; }, reason:function(){ return "تحويل رصيد وارد"; } },
    { key:"call-tone", match:function(ctx){ return ctx.s==='call tone'||ctx.s==='caller tone'||ctx.s==='ring back tone'; }, reason:function(){ return "نغمة المتصل/كول تون"; } },
    { key:"management-service", match:function(ctx){ return ctx.s==='management service'; }, reason:function(){ return "خدمة إدارية"; } },
    { key:"short-numbers", match:function(ctx){ return ctx.s==='short numbers'||ctx.s==='short number'; }, reason:function(){ return "خدمة الأرقام القصيرة"; } },
    { key:"loan", match:function(ctx){ return ctx.s==='loan'; }, reason:function(){ return "سلفة/سلفني"; } },
    { key:"bonus", match:function(ctx){ return ctx.s==='bonus'; }, reason:function(){ return "سلفة/سلفني"; } },
    { key:"bank-fee", match:function(ctx){ return ctx.s==='business fee charged by bank'; }, reason:function(){ return "رسوم إدارية محملة من البنك"; } },
    { key:"voicemail", match:function(ctx){ return ctx.s==='voice mail'||ctx.s==='voicemail'; }, reason:function(){ return "خدمة البريد الصوتي"; } },
    { key:"voicemail-calls", match:function(ctx){ return ctx.s==='voicemail calls'||ctx.s==='voice mail calls'; }, reason:function(){ return "مكالمات بريد صوتي"; } },
    { key:"mcn", match:function(ctx){ return ctx.s==='mcn'; }, reason:function(){ return "خدمة شبكية (MCN – Mobile Corporate Network غالبًا)"; } },
    { key:"redemption", match:function(ctx){ return ctx.s==='redemption'; }, reason:function(){ return "استرداد/تسوية"; } },
    { key:"adjustment-credit", match:function(ctx){ return ctx.s==='adjustment credit'; }, reason:function(){ return "تسوية رصيد (إضافة)"; } },
    { key:"adjustment-debit", match:function(ctx){ return ctx.s==='adjustment debit'; }, reason:function(){ return "تسوية رصيد (خصم)"; } },
    { key:"product-monthly-charge", match:function(ctx){ return ctx.s==='product monthly charge'; }, reason:function(){ return "رسوم شهرية"; } },
    { key:"occ", match:function(ctx){ return ctx.s==='occ'; }, reason:function(){ return "رسوم/تكلفة تشغيلية (One-time/Other Charge Component)"; } },
    { key:"minimum-commitment", match:function(ctx){ return ctx.s==='minimum commitment charge'; }, reason:function(){ return "رسوم الحد الأدنى للاشتراك"; } },
    { key:"installment", match:function(ctx){ return ctx.s==='installment'; }, reason:function(){ return "قسط/دفعة"; } },

    // Additions
    { key:"query-balance", match:function(ctx){ return ctx.s==='query balance'; }, reason:function(){ return "استعلام عن الرصيد"; } },

    // Monthly tariff fees + Offering has "Tax" + deduct is balance
    { key:"monthly-tax",
      match:function(ctx){
        var sOK = (ctx.s.indexOf('monthly tariff fees') !== -1);
        var H = ctx.headers||[]; var offering=''; var offIdx=-1;
        for (var i=0;i<H.length;i++){ var h=String(H[i]||'').toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,''); if (h.indexOf('offeringname')!==-1 || h.indexOf('offer')!==-1){ offIdx=i; break; } }
        if (offIdx>=0) offering = String(ctx.row[H[offIdx]]||'').toLowerCase();
        var hasTax = offering.indexOf('tax')!==-1;
        var isBalance = String(ctx.deduct||'').indexOf('balance')!==-1;
        return sOK && hasTax && isBalance;
      },
      reason:function(){ return "الضريبة الشهرية"; }
    }
  ];


  // Expose as App.Config
  // Default fallback reason if nothing matches
  var defaultReasonText = "—";

  global.App = Object.assign(global.App || {}, {
    Config: {
      defaultReasonText: defaultReasonText,
      weCustomerCareNumbers: weCustomerCareNumbers,
      DEDUCTION_RULES_EXT: DEDUCTION_RULES_EXT
    }
  });
})(window);


// Feature flags
var features = {};

// Expose feature flags under App.Config.features as well (backwards compatible)
window.App = window.App || {};
window.App.Config = window.App.Config || {};
window.App.Config.features = features;
window.features = features;


features.useUnifiedDiscountBase = true;
features.disableWorkerParsing = false;

features.fastDetails = true;

features.detailsCache = true;

window.__BUILD_ID = 'PRO-20250914-101824';

window.__BUILD_ID_2 = 'PRO2-20250914-103328';
// ---------------------------------------------------------------------------
// Compatibility helper
// ---------------------------------------------------------------------------
// Some rule modules reference a global `normDeduct(...)` helper.
// Define it once to avoid ReferenceError and keep behavior consistent.
try {
  if (typeof window.normDeduct !== 'function') {
    window.normDeduct = function(v){
      return String(v || '').toLowerCase().trim();
    };
  }
} catch (_){ }
