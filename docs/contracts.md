# MNDO View — Behavioral Contracts (Phase 1)

> هذا المستند يصف **العقود السلوكية الفعلية** للتطبيق كما هي في كود المشروع الحالي (MNDO View بعد *Phase0 SAFE v3*)، بهدف **Zero Regression** في أي مراحل لاحقة.
>
> **مهم:** هذا المستند توثيقي فقط. لا يُغيّر سلوك التطبيق.

---

## 1) مبادئ غير قابلة للكسر

1) **Zero Regression:** أي تطوير لاحق يجب أن يحافظ على نفس السلوك/الحسابات/التجربة كما هي الآن.

2) **Offline‑Only:** التطبيق يعمل كـ Static Web App بدون Backend.

3) **No Network:** لا توجد fetch/XHR/telemetry مقصودة في الكود الحالي. الاعتماد فقط على ملفات محلية داخل المشروع.

4) **No Data Leakage:** ممنوع طباعة/تسجيل بيانات الملف (نص الخلايا/تفاصيل الصفوف) في الـ console أو حفظها بشكل غير Redacted.

---

## 2) تعريفات سريعة

- **Dataset:** الصفوف المقروءة من الشيت الحالي.
- **Row ID:** حقل `_id` رقم تسلسلي يُضاف لكل صف عند التحويل (غير موجود في Excel).
- **State.rows:** كل الصفوف بعد التحويل إلى Objects.
- **State.view:** ناتج الفلتر الرئيسي (ALL/BALANCE/UNITS/JUNK/BONUS) قبل Header Filters.
- **State.viewFiltered:** ناتج Header Filters + Range Filter (لو فعالة) فوق `State.view`.
- **Visible Rows:** صفوف الصفحة الحالية المعروضة في الجدول (slice من base = viewFiltered أو view).

المصدر الأساسي للـ state: `js/state.js`.

---

## 3) Contract: تحميل ملف Excel/CSV

**Input**
- المستخدم يختار ملف من `#fileInput` (`accept=".xlsx,.xls,.csv"`).
  - wiring في: `js/controller.js` → `App.Data.handleFile(file)`.

**Output**
- إظهار طبقة Loading (`#loading`) أثناء القراءة.
- قراءة الملف إلى `ArrayBuffer` عبر `file.arrayBuffer()` ثم:
  - تخزين `State.fileBuffer`.
  - محاولة parsing داخل Web Worker إن أمكن، وإلا fallback parsing على الـ main thread.
- بعد parsing يتم بناء:
  - `State.sheetNames`
  - `State.headers`
  - `State.rows` (Array of Objects)
  - `State.rowsById` + `window.__ROWS_BY_ID` (lookup سريع)
  - إعادة حساب `State.feeIdx` و `State.unitIdx`
  - ثم `computeView()` لتحديد `State.view` حسب الفلتر الرئيسي.
- تحديث UI:
  - تحديث `#sheetSelect` بأسماء الشيتات
  - إعادة رسم الجدول + تحديث totals/breakdown.

**Invariants**
- لا يتم إرسال الملف لأي مكان خارج المتصفح.
- IDs (`State.ids`) **لا تُصفّر** عند تحميل ملف جديد؛ تظل تزيد عبر الجلسة.
- تحميل ملف جديد **يمسح الاختيارات** (selection) ويعيد صفحة العرض للأولى.

ملفات ذات صلة: `js/controller.js`, `js/data.js`, `assets/js/worker_xlsx.js`.

---

## 4) Contract: Web Worker Parsing + Fallback

**المسار الأساسي (Worker)**
- الشرط: `features.disableWorkerParsing !== true` + دعم المتصفح للـ Worker.
- يوجد منطق إضافي يتعلق بالبروتوكول/الوضع:
  - `State.parseMode` قد يكون: `AUTO | WORKER | SAFE | FALLBACK`.
  - في `AUTO` لا يتم استخدام Worker على `file://`.
- التنفيذ: `js/data.js` ينشئ Worker من `assets/js/worker_xlsx.js` ويرسل رسالة:
  - `{ type: 'PARSE_XLSX', file: ArrayBuffer, sheetName }`
- الـ Worker يستخدم `XLSX.read(..., {type:'array'})` ويعيد:
  - `{ type: 'XLSX_PARSED', rows: AOA(rows), meta: { headers, sheetNames } }`

**Fallback (Main Thread)**
- يحدث عند:
  - عدم دعم Worker، أو
  - بروتوكول يمنع Worker (خاصة `file://` مع `AUTO`)، أو
  - timeout (حوالي 5 ثواني) أو خطأ في Worker.
- يستخدم SheetJS محليًا: `vendor/xlsx/xlsx.full.min.js`.

**Invariants**
- نفس المكتبة (SheetJS) مستخدمة في المسارين.
- نفس تحويل البيانات يتم تطبيقه بعد وصول AOA.

ملفات ذات صلة: `js/data.js`, `assets/js/worker_xlsx.js`, `vendor/xlsx/xlsx.full.min.js`.

---

## 5) Contract: اختيار الشيت (Sheet)

**Input**
- تغيير `#sheetSelect`.

**Output**
- `App.Data.loadSheet(sheetName)`:
  - يستدعي `resetTransientState()` (يمسح selection/details cache ويعيد page=1)
  - يعيد parsing للشيت المختار (Worker أو Main thread حسب الوضع)
  - يبني `State.headers/rows/...` ثم `computeView()` ثم render.

**Invariants**
- تغيير الشيت **يمسح الاختيارات دائمًا**.

ملفات ذات صلة: `js/controller.js`, `js/data.js`.

---

## 6) Contract: الفلتر الرئيسي (FilterSelect)

**Input**
- تغيير `#filterSelect`.
  - wiring: `js/controller.js` → `State.filter = value; App.Data.rebuildUI();`

**Output**
- `computeView()` في `js/data.js` يبني `State.view` من `State.rows` باستخدام `row.deductFrom` بعد normalization (lower + trim).

**القيم الفعلية للفلتر الرئيسي** (من `index.html` و `data.js`):

- `ALL` : كل الصفوف.
- `BALANCE` : `deductFrom` يحتوي `"balance"` ولا يحتوي `"free"`.
- `UNITS` : `deductFrom` يحتوي `"free"` ولا يحتوي `"balance"`.
- `BONUS` : `deductFrom` يساوي تمامًا `"bonus"`.
- `JUNK` :
  - (`deductFrom` يحتوي `balance` و `free`) **أو**
  - `deductFrom` يساوي `"bonus/free unit"`.

**Invariants**
- تغيير الفلتر الرئيسي:
  - يعيد `State.page = 1`.
  - **لا يمسح selection**؛ الاختيارات تظل محفوظة.

ملفات ذات صلة: `js/data.js`, `js/controller.js`, `index.html`.

---

## 7) Contract: Rules Registry (لقسم Breakdown)

> ملحوظة مهمة: الفلتر الرئيسي يحدد `State.view`، بينما **الـ Breakdown** يعتمد على **Rules registry** ويعمل على الصفوف **المحددة** (Selection).

**Rules المفعّلة حاليًا** (من `js/rules/registry.js`):

- `BALANCE` — `js/rules/balance.js`
- `UNITS` — `js/rules/units.js`
- `BONUS` — `js/rules/bonus.js`
- `JUNK` — `js/rules/junk.js`
- `FREE_UNITS` — `js/rules/free_units.js`

**آلية التشغيل**
- في `renderConsumptionBreakdown()` داخل `js/view.js`:
  - يتم تقسيم `selectedRows` حسب `rule.matches(row)`.
  - ثم حساب `rule.summarize(rows, { State, Utils })`.
  - يوجد منطق dedupe: لو `FREE_UNITS` و `UNITS` متداخلين بنسبة كبيرة، يتم إبقاء `FREE_UNITS` وحذف `UNITS`.

**Invariants**
- أي تعديل على قواعد rules يجب أن يحافظ على نفس `key` ونفس منطق `matches/summarize` لتجنب تغيير المخرجات.

---

## 8) Contract: Header Filters + Range Filter

هناك مستويان إضافيان فوق الفلتر الرئيسي:

### 8.1 Header Filters (فلترة لكل عمود)

**Input**
- الضغط على أيقونة الفلتر في رأس عمود (Header).

**Output**
- تخزين إعدادات الفلتر في `State.headerFilters[headerName]`.
- `applyHeaderFilters()` (من `js/view_modules/header_filters.js`) يُنتج `State.viewFiltered`.

**Invariants**
- Header Filters تُطبّق على كل النتائج (base) قبل pagination.
- عند تفعيل header filters، مصدر البيانات للجدول يصبح `State.viewFiltered` بدل `State.view`.

### 8.2 Range Filter (فترة زمنية عامة)

**Input**
- شريط الأدوات أعلى الجدول (Top Toolbar) داخل `js/view.js`:
  - `#tt-start`, `#tt-end`, زر `#tt-apply`, زر `#tt-clearRange`.

**Output**
- تخزين `State.rangeFilter = { from, to }` بصيغة ISO.
- `applyHeaderFilters()` يطبّق overlap logic على `Start Time`/`End Time` (حسب تطابق أسماء الأعمدة normalize إلى `starttime/endtime`).

**Reset table (مهم)**
- زر `#tt-reset` يقوم بـ:
  - `State.headerFilters = {}`
  - `State.rangeFilter = {from:null,to:null}`
  - `State.viewFiltered = null`
  - ثم render.

**Invariants**
- Reset table هنا **لا يغيّر** الفلتر الرئيسي (`State.filter`) ولا يمسح selection.

ملفات ذات صلة: `js/view.js`, `js/view_modules/header_filters.js`.

---

## 9) Contract: Pagination

**Input**
- `#prevPage`, `#nextPage`
- تغيير `#pageSize`.

**Output**
- `State.page` 1‑based.
- `State.pageSize` من UI (50/100/250/500) والافتراضي 100.
- `renderTable()` يحدد `base`:
  - `base = State.viewFiltered` إذا كانت Array، وإلا `State.view`.
  - ثم slice حسب الصفحة.

**Invariants**
- تغيير pageSize يقوم بـ render فقط (لا يضمن تحديث breakdown/summary في نفس الحدث).

ملفات ذات صلة: `js/controller.js`, `js/view_modules/table.js`, `js/view.js`.

---

## 10) Contract: Selection + Select All Visible + الاستمرار

**Source of truth**
- `State.selected: Set<rowId>`.

**Selection فردي**
- Checkbox داخل كل صف (`input.row-select`).
- Event delegation داخل `ensureRowDelegation()` في `js/view.js`:
  - يضيف/يحذف id من `State.selected` ثم `updateSumSelected()`.

**Select All Visible**
- Checkbox `#checkAllVisible` في toolbar.
- في `js/controller.js`:
  - base = `State.viewFiltered` إن كانت Array وإلا `State.view`.
  - pageData = slice(page/pageSize).
  - يضيف/يحذف IDs الخاصة بـ pageData فقط.
  - ثم يضبط checkboxes المعروضة في DOM.

**Clear selection**
- زر `#clearSelection`: يمسح `State.selected` ويعيد رسم/تحديث totals.

**Invariants**
- selection تستمر عبر:
  - تغيير الفلتر الرئيسي
  - Header Filters
  - تغيير الصفحة
- selection تُمسح عند:
  - تحميل ملف جديد
  - تغيير الشيت.

---

## 11) Contract: Totals (Fee/Units) وكيف تُحسب

**متى تُحسب؟**
- عند تغيير selection وعند بعض عمليات إعادة البناء.
- الدالة: `updateSumSelected()` في `js/view.js`.

### 11.1 Total Fee
- يعتمد على عمود:
  - `Total Fee` (normalized = `totalfee`) عبر `State.feeIdx`.
- استثناء BONUS:
  - إذا `State.filter === 'BONUS'` وعمود `Total Promotional Fee` موجود (normalized = `totalpromotionalfee`) يستخدمه بدلًا من `totalfee`.
- العملة:
  - تُستنتج أول مرة من نص الخلية بإزالة الأرقام والفراغات ثم عمل match على `EGP/LE/ج/جنيه`…

### 11.2 Free Unit Consumed
- يعتمد على عمود normalized = `freeunitconsumed` عبر `State.unitIdx`.

**Invariants**
- لو الأعمدة غير موجودة أو مسمياتها مختلفة → totals قد تظل 0.

ملفات ذات صلة: `js/data.js` (حساب indices), `js/view.js` (الجمع).

---

## 12) Contract: Breakdown Panel

- مكانه: `#consumptionBreakdown`.
- يُبنى من:
  - `renderConsumptionBreakdown()` غالبًا.
  - أو `renderBalanceBreakdown()` / `renderBonusBreakdown()` حسب نوع الصفوف المحددة.
  - أو `renderSelectedBreakdownAll()` عند خليط فئات.

**Invariants**
- الـ breakdown يستخدم HTML (strings) في بعض المواضع.
- يوجد delegation لزر jump `↪` للانتقال لصف معين.

ملفات ذات صلة: `js/view.js`.

---

## 13) Contract: تفاصيل الصف (Inline Details Row)

**Input**
- زر `تفاصيل` في كل صف (`button.row-quick-details`).

**Output**
- يتم إدراج صف واحد فقط `tr.row-compare` بعد الصف الأصلي.
- الضغط مرة ثانية على نفس الزر يغلق التفاصيل.

**كيف يتم توليد النص؟ (ملخص)**
- عبر `DetailsHelpers.toggleRowDetails()` في `js/helpers/details.js`:
  1) يحفظ selection الحالية.
  2) يعزل selection على الصف المطلوب فقط.
  3) يعيد بناء breakdown وفق الفلتر الحالي.
  4) يقرأ أفضل سطر مناسب من `#consumptionBreakdown`.
  5) يستعيد selection السابقة ويعيد breakdown.
  6) يُظهر النص داخل compare row.

**Caching**
- `State.detailCache` قد يخزن النص حسب key = `rowId|filter` إذا كانت `features.detailsCache` مفعلة.

**Invariants**
- دائمًا compare row واحد فقط.
- تفاصيل الصف **تعتمد على الفلتر الحالي** (لأنها تُستخرج من breakdown الحالي).

---

## 14) Contract: Compact Mode

**Input**
- زر `#compactModeBtn`.

**Output**
- إخفاء الجدول الأساسي وعرض `#compactTableWrap`.
- عرض أزرار:
  - `#compactReturnBtn` (عودة)
  - `#compactRefreshBtn` (تحديث)
- Selection داخل compact mode يكتب في نفس `State.selected`.

**Invariants**
- يوجد auto-refresh دوري (تقريبًا كل 1s) لمراقبة تغيّر البيانات.

ملفات ذات صلة: `js/compact/compact_bootstrap.js`.

---

## 15) Contract: Drag‑Pan + Speed

- Drag داخل `.table-wrap` لتحريك scroll.
- سرعة السحب قابلة للتغيير عبر `#speedUp/#speedDown`.
- السرعة تُحفظ في `localStorage['dragSpeedFactor']`.

ملفات ذات صلة: `js/dragpan_pro.js`.

---

## 16) Contract: Error Boundary + Auto‑Recover + Safe Console

### 16.1 Error Boundary
- يلتقط:
  - `window.error`
  - `window.unhandledrejection`
- ثم يوجّه للـ toast / recover.

ملف: `js/error_boundary.js`.

### 16.2 Auto‑Recover
- يحتفظ بـ snapshots DOM (thead/tbody/pageInfo).
- عند crash يحاول restore مرة واحدة.

ملف: `js/auto_recover.js`.

### 16.3 Safe Console
- يوفّر wrapper: `App.SafeConsole.{log,warn,error}` لمنع crash عند غياب console.
- لا يضمن redaction تلقائيًا؛ لذا يجب عدم تمرير بيانات الملف له.

ملف: `js/safe_console.js`.

---

## 17) ملاحظة للمطورين: Snapshot Mode (SAFE/UNSAFE)

> هذه أداة تطوير فقط لتسهيل التحقق اليدوي/الاختبارات.

- يتم تحميلها من `index.html` عند وجود `?snapshot=...`.
- الافتراضي **SAFE**: لا يخرج نص الخلايا ولا نص التفاصيل، فقط metadata + hashes/lengths.
- وضع **UNSAFE** يتطلب `?snapshot=unsafe` + تأكيد يدوي داخل الواجهة.

ملف: `js/snapshot_mode.js`.
