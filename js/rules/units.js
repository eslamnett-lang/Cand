(function(global){
  'use strict';
  const R = (global.App && global.App.Rules);
  if (!R || typeof R.register !== 'function') return;
  R.register({
    key: "UNITS",
    enabled: true,
    stage: "sections",
    order: 20,
    label: "استهلاك وحدات مجانية",
    matches(row){
      const v = normDeduct(row.deductFrom);
      return v.includes("free") && !v.includes("balance");
    },
    explain: "تم استهلاك وحدات مجانية فقط دون خصم من الرصيد.",
    summarize(rows, ctx){
      const { toNumber } = ctx.Utils;
      const unitHeader = ctx.State.unitIdx >= 0 ? ctx.State.headers[ctx.State.unitIdx] : null;
      let total = 0, list = [];
      rows.forEach(r=>{
        if (!unitHeader) return;
        const n = toNumber(r[unitHeader]);
        total += n; if(n) list.push(n);
      });
      return { totalUnits: total, unitParts: list };
    }
  });
})(window);
