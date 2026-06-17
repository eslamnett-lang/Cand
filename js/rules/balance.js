(function(global){
  'use strict';
  const R = (global.App && global.App.Rules);
  if (!R || typeof R.register !== 'function') return;
  R.register({
    key: "BALANCE",
    enabled: true,
    stage: "sections",
    order: 10,
    label: "سحب من الرصيد",
    matches(row){
      const v = normDeduct(row.deductFrom);
      return v.includes("balance") && !v.includes("free");
    },
    explain: "تم السحب من الرصيد فقط دون استهلاك وحدات مجانية.",
    summarize(rows, ctx){
      const { toNumber } = ctx.Utils;
      const feeHeader = ctx.State.feeIdx >= 0 ? ctx.State.headers[ctx.State.feeIdx] : null;
      let total = 0, list = [], currency = "";
      rows.forEach(r=>{
        if (!feeHeader) return;
        const cell = String(r[feeHeader] ?? "");
        const n = toNumber(cell);
        total += n; if(n) list.push(n);
        if(!currency){
          let cur = cell.replace(/[0-9.,\-\s]/g,"").trim().toUpperCase();
          if (/EGP|LE|ج|جنيه/.test(cur)) currency = "EGP";
          else if (cur) currency = cur;
        }
      });
      return { totalFee: total, feeParts: list, currency };
    }
  });
})(window);
