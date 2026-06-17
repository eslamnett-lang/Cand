(function(global){
  'use strict';
  const R = (global.App && global.App.Rules);
  if (!R || typeof R.register !== 'function') return;
  R.register({
    key: "FREE_UNITS",
    enabled: true,
    stage: "sections",
    order: 50,
    label: "استهلاك وحدات",
    matches(row){
      const v = String(row.deductFrom||"").toLowerCase();
      return v.includes("free");
    },
    summarize(rows, { State, Utils }){
      const H = State.headers || [];
      const norm = s => String(s||"").toLowerCase().replace(/[\s_\/\-\.\(\)]+/g,'');
      const idx = (aliases)=>{
        for (let i=0;i<H.length;i++){
          const h = norm(H[i]);
          for (const a of aliases){ if (h.indexOf(norm(a)) !== -1) return i; }
        }
        return -1;
      };
      const iBefore = idx(['Free Unit Before','Units Before','Free Before']);
      const iCons   = idx(['Free Unit Consumed','Units Consumed','Free Consumed','freeunitconsumed']);
      const iAfter  = idx(['Free Unit After','Units After','Free After']);
      const iUsage  = idx(['Usage']);
      const iMU     = idx(['Measure Unit','Unit']);
      const iOffer  = idx(['Consumed Offer','Offer','Offering Name']);
      const iFName  = idx(['Free Unit Name','Unit Name']);
      const iStart  = idx(['Start Time','startTime','start time']);
      const iEnd    = idx(['End Time','endTime','end time']);
      const toNum = (x)=>{
        const n = Number(String(x||'').toString().replace(/[^0-9\.-]/g,''));
        return isNaN(n) ? 0 : n;
      };
      const toDate = (val)=>{
        if (val instanceof Date) return val;
        try{
          if (global.App && global.App.Utils && typeof global.App.Utils.parseDateFlex === 'function'){
            return global.App.Utils.parseDateFlex(val) || new Date(val);
          }
          return new Date(val);
        }catch(e){ return null; }
      };
      const timeArabic = (d)=>{
        if (!d || isNaN(d)) return '—';
        const h=d.getHours?d.getHours():0, m=String(d.getMinutes?d.getMinutes():0).padStart(2,'0');
        const am=h<12, hh=(h%12)||12;
        return hh+':'+m+' '+(am?'صباحا':'مساءا');
      };
      const sameDay = (a,b)=> a&&b && a.getFullYear&&b.getFullYear && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
      const fmtDT = (d)=> (global.App && global.App.Utils && typeof global.App.Utils.fmtArabicDT==='function') ? global.App.Utils.fmtArabicDT(d) : (d? d.toLocaleString('ar-EG'): '');

      let totalUnits=0, unitParts=[], details=[];
      rows.forEach(r=>{
        const before = iBefore>=0 ? r[H[iBefore]] : '';
        const cons   = iCons>=0   ? r[H[iCons]]   : '';
        const after  = iAfter>=0  ? r[H[iAfter]]  : '';
        const usage  = iUsage>=0  ? r[H[iUsage]]  : '';
        const mu     = iMU>=0     ? r[H[iMU]]     : '';
        const offer  = iOffer>=0  ? r[H[iOffer]]  : '';
        const fname  = iFName>=0  ? r[H[iFName]]  : '';

        const start  = iStart>=0 ? toDate(r[H[iStart]]) : null;
        const end    = iEnd>=0   ? toDate(r[H[iEnd]])   : null;

        const beforeTxt = before!==undefined && before!==null && before!=='' ? String(before) : '—';
        const consTxt   = cons!==undefined   && cons!==null   && cons!==''   ? String(cons)   : '—';
        const afterTxt  = after!==undefined  && after!==null  && after!==''  ? String(after)  : '—';
        const usageTxt  = usage!==undefined  && usage!==null  && usage!==''  ? String(usage)  : '';
        const muTxt     = mu!==undefined     && mu!==null     && mu!==''     ? String(mu)     : '';

        const cNum = toNum(cons);
        totalUnits += cNum; if(cNum) unitParts.push(cNum);

        let timeText='';
        if (start && end && start.getTime && end.getTime && start.getTime()===end.getTime()){
          timeText = 'فى توقيت ' + fmtDT(start);
        } else if (sameDay(start, end)){
          timeText = 'من توقيت ' + fmtDT(start) + ' حتى توقيت ' + timeArabic(end);
        } else if (start && end){
          timeText = 'من توقيت ' + fmtDT(start) + ' حتى توقيت ' + fmtDT(end);
        }

                const usagePart = (usageTxt && muTxt) ? (' (الاستهلاك الفعلي: ' + usageTxt + ' ' + muTxt + ')')
                          : (usageTxt ? (' (الاستهلاك الفعلي: ' + usageTxt + ')') : '');

        // ====== تعديل "مصدر الخصم" وفق القاعدة الجديدة المعتمدة على Free Unit Name ======
        const fnameRaw = fname ? String(fname) : '';
        const fparts = fnameRaw ? fnameRaw.split(',').map(x=>x.trim()) : [];
        const hasOffNet = fparts.includes('KIX_FM_OffNet_Unit');
        const hasBase   = fparts.includes('KIX_FM_Unit');
        const hasExtraMBS = fparts.includes('KIX_FM_Extra_MBS');

        // تحويل الاسم إلى الوصف العربي
        let fnameOut = '';
        if (hasOffNet && hasBase){
          fnameOut = 'خلصت وحدات تستخدم خارج الشبكة بواقع الوحدة = 1 دقيقة واتحولت إلى الوحدات الأساسية.';
        } else if (hasOffNet){
          fnameOut = 'وحدات تستخدم خارج الشبكة بواقع الوحدة = 1 دقيقة.';
        } else if (hasBase){
          fnameOut = 'الوحدات الأساسية.';
        } else if (hasExtraMBS){
          fnameOut = 'ميجابايتس للفيسبوك و واتس اب و انستاجرام.';
        } else if (fnameRaw){
          // fallback عام لأنواع أخرى غير مذكورة
          fnameOut = fnameRaw;
        }

        // دالة تقسيم "قبل/بعد" إلى (أساسي، خارج الشبكة) عند وجود النوعين معًا
        const splitToPhrase = (txt)=>{
          if (txt===undefined || txt===null) return '—';
          const s = String(txt);
          if (s.indexOf(',') === -1) return s; // لا حاجة للتقسيم
          const parts = s.split(',').map(v=>v.trim()).filter(Boolean);
          if (parts.length !== 2) return s;
          const nums = parts.map(p => Number(String(p).replace(/[^0-9\.-]/g,'')));
          if (nums.some(n => isNaN(n))){
            // لو القيم غير رقمية بالكامل، اعتبر الثانية أساسي والأولى خارج الشبكة
            const baseV = parts[1] || '0';
            const offV  = parts[0] || '0';
            return baseV + ' وحدة أساسية و ' + offV + ' وحدة من وحدات خارج الشبكة';
          }
          const baseV = Math.max(nums[0], nums[1]);
          const offV  = Math.min(nums[0], nums[1]);
          return baseV + ' وحدة أساسية و ' + offV + ' وحدة من وحدات خارج الشبكة';
        };

        // بناء نص "قبل/بعد" النهائي
        const bothTypes = hasOffNet && hasBase;
        const beforeOut = bothTypes ? splitToPhrase(beforeTxt) : (beforeTxt||'—');
        const afterOut  = bothTypes ? splitToPhrase(afterTxt)  : (afterTxt||'—');

        // صياغة ذيل الرسالة بعد الشرطة الطويلة: نعرض وصف "مصدر الخصم" فقط
        const afterDash = fnameOut ? (' — (' + fnameOut + ') · مصدر الخصم') : '';

        const line = (timeText ? (timeText+' ') : '') +
                     'كان معاك قبل الاستهلاك ' + beforeOut + (bothTypes ? '' : ' وحدة') + '، ' +
                     'واستهلكت منهم ' + consTxt + ' وحدة، ' +
                     'وباقي معاك ' + afterOut + (bothTypes ? '' : ' وحدة.') +
                     usagePart + afterDash;
        details.push(line);
      });
      return { totalFee:0, feeParts:[], currency:'', totalUnits, unitParts, details };
    }
  });
})(window);
