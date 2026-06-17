(function(global){
  'use strict';
  const R = (global.App && global.App.Rules);
  if (!R || typeof R.register !== 'function') return;
  R.register({
    key: "BONUS",
    enabled: true,
    stage: "sections",
    order: 30,
    label: "سلفنى (Bonus)",
    matches(row){
      const v = normDeduct(row.deductFrom);
      return v === "bonus";
    },
    explain: "حالات Bonus الخالصة فقط (بدون أي إضافات).",
    summarize(rows, ctx){
      // Keep lightweight: totals only if standard fee header exists
      const { toNumber } = ctx.Utils;
      const feeHeader = ctx.State.feeIdx >= 0 ? ctx.State.headers[ctx.State.feeIdx] : null;
      let totalFee = 0, feeParts = [], currency = "";
      rows.forEach(r=>{
        if (!feeHeader) return;
        const cell = String(r[feeHeader] ?? "");
        const n = toNumber(cell);
        totalFee += n; if(n) feeParts.push(n);
        if(!currency){
          let cur = cell.replace(/[0-9.,\-\s]/g,"").trim().toUpperCase();
          if (/EGP|LE|ج|جنيه/.test(cur)) currency = "EGP";
          else if (cur) currency = cur;
        }
      });
      return { totalFee, feeParts, currency };
    }
  });
})(window);
