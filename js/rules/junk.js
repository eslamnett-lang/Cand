(function(global){
  'use strict';
  const R = (global.App && global.App.Rules);
  if (!R || typeof R.register !== 'function') return;
  R.register({
    key: "JUNK",
    enabled: true,
    stage: "sections",
    order: 40,
    label: "مختلط / Bonus مع وحدات",
    matches(row){
      const v = normDeduct(row.deductFrom);
      return (v.includes("balance") && v.includes("free")) || v === "bonus/free unit";
    },
    explain: "يتضمن خصم من الرصيد مع استهلاك وحدات مجانية، أو حالة Bonus/Free Unit.",
    summarize(rows, ctx){
      const { toNumber } = ctx.Utils;
      const feeHeader  = ctx.State.feeIdx  >= 0 ? ctx.State.headers[ctx.State.feeIdx]   : null;
      const unitHeader = ctx.State.unitIdx >= 0 ? ctx.State.headers[ctx.State.unitIdx]  : null;

      let totalFee = 0, feeParts = [], currency = "";
      let totalUnits = 0, unitParts = [];

      rows.forEach(r=>{
        if (feeHeader){
          const cell = String(r[feeHeader] ?? "");
          const n = toNumber(cell);
          totalFee += n; if(n) feeParts.push(n);
          if(!currency){
            let cur = cell.replace(/[0-9.,\-\s]/g,"").trim().toUpperCase();
            if (/EGP|LE|ج|جنيه/.test(cur)) currency = "EGP";
            else if (cur) currency = cur;
          }
        }
        if (unitHeader){
          const u = toNumber(r[unitHeader]);
          totalUnits += u; if(u) unitParts.push(u);
        }
      });
      return { totalFee, feeParts, currency, totalUnits, unitParts };
    }
  });
})(window);
