# MNDO View — Current Architecture (Phase 1)

> الهدف من هذا المستند: **توصيف المعمارية الحالية كما هي فعلاً في الكود** (بدون Refactor) حتى نقدر نبدأ مراحل التطوير اللاحقة بدون كسر أي سلوك (Zero Regression).

---

## 1) نظرة عامة

- التطبيق **Static Web App**: صفحة `index.html` + ملفات JS/CSS محلية.
- لا يوجد Backend، ولا يوجد API calls مقصودة.
- الاعتماد على **globals** بشكل كبير:
  - `window.App` (namespace)
  - `window.App.State` (state “الحي”)
- Parsing لملفات Excel يتم عبر **SheetJS (XLSX)**، وبشكل اختياري داخل **Web Worker**.

مجلدات مهمة:
- `index.html` نقطة الدخول.
- `js/` منطق التطبيق (state/data/view/controller/...)
- `js/view_modules/` وحدات واجهة (table, header_filters, toast).
- `js/rules/` قواعد التصنيف الخاصة بـ breakdown.
- `assets/js/worker_xlsx.js` كود الـ worker.

---

## 2) تسلسل الإقلاع (Boot Sequence)

`index.html` يقوم بتحميل السكربتات **بالترتيب** (كلها `defer`)، وبالتالي ترتيب التحميل مهم جدًا.

الترتيب الفعلي (مختصر):
1) `js/config.js` يجهّز `App.Config` و feature flags + helper `normDeduct`.
2) `js/state.js` يعرّف `App.State`.
3) `js/utils.js` يجهّز `App.Utils` (normalize/escape/toNumber/... إلخ).
4) طبقات أمان/استقرار: `safe_console.js`, `hooks.js`, `error_boundary.js`, `auto_recover.js`.
5) القواعد: `js/rules/registry.js` (يبني `App.Rules`).
6) البيانات + parsing: `js/data.js` (يبني `App.Data`).
7) العرض: `js/view_modules/*` + `js/view.js` (يبني `App.View`).
8) التحكم بالأحداث: `js/controller.js`.
9) bootstrap: `js/main.js`.

**نتيجة ذلك:** أي تغيير في ترتيب السكربتات قد يكسر التطبيق لأن العديد من الملفات تفترض وجود `window.App.*` مسبقًا.

---

## 3) خريطة تدفق البيانات الفعلية

### 3.1 تحميل ملف (File → Rows)

1) المستخدم يختار ملف عبر `#fileInput`.
2) `controller.js` يستقبل الحدث → ينادي `App.Data.handleFile(file)`.
3) `data.js`:
   - يقرأ `file.arrayBuffer()` → `State.fileBuffer`.
   - يحدد مسار parsing:
     - Worker (`assets/js/worker_xlsx.js`) أو
     - Fallback main thread (باستخدام `XLSX.read`).
   - بعد parsing:
     - يبني `headers` من أول صف.
     - يبني `rows` كـ Objects + `_id` + حقول مشتقة (`deductFrom/startTime/endTime`).
     - يبني `rowsById` + `window.__ROWS_BY_ID`.
     - يحدد `feeIdx/unitIdx` بناءً على headers (normalize).
   - ينادي `computeView()` لتكوين `State.view` حسب `State.filter`.
4) ثم UI update:
   - تحديث `#sheetSelect`.
   - `applyHeaderFilters()` (لو موجودة فلترة أعمدة/نطاق).
   - `App.View.renderTable()` ثم `App.View.updateSumSelected()`.

### 3.2 تغيير الفلتر الرئيسي (FilterSelect)

1) `controller.js` على `#filterSelect`:
   - يضبط `State.filter`.
   - ينادي `App.Data.rebuildUI()`.
2) `data.js`:
   - `computeView()` → `State.view`.
   - `State.page = 1`.
3) `view.js`:
   - `renderTable()` يعرض slice من `viewFiltered/view`.
   - `updateSumSelected()` يحدث totals/breakdown.

### 3.3 Header Filters + Range

- مصدر التنفيذ: `js/view_modules/header_filters.js` + جزء من `js/view.js` (Top Toolbar).
- المبدأ: `State.view` (من الفلتر الرئيسي) → يتم تطبيق فلترة إضافية → `State.viewFiltered`.
- الجدول يقرأ دائمًا من:
  - `State.viewFiltered` إذا كانت Array، وإلا `State.view`.

### 3.4 Pagination

- أزرار Next/Prev + pageSize موجودة في `controller.js`.
- `renderTable()` يقوم بعمل slice بناءً على `State.page` و `State.pageSize`.

### 3.5 Selection → Totals → Breakdown

- مصدر الحقيقة: `State.selected: Set<rowId>`.
- تحديث selection يحدث عبر:
  - delegation على `tbody` في `view.js` (`ensureRowDelegation`) أو
  - compact mode handlers.
- `updateSumSelected()`:
  - يجمع `sumUnits/sumFee` عبر `State.rows` (ليس فقط visible).
  - ثم يحدد أي breakdown renderer سيُستخدم.

### 3.6 Details Row (Inline)

- زر التفاصيل لكل صف يمر عبر `DetailsHelpers.toggleRowDetails(...)` (`js/helpers/details.js`).
- منطق التفاصيل يعتمد على **إعادة توليد breakdown مؤقتًا** وقراءة أفضل سطر من `#consumptionBreakdown`.

---

## 4) Dependency Map (مين بينادي مين)

> هذه خريطة “Call/Dependency” على مستوى الوحدات، وليست class diagram.

### 4.1 Layers بشكل مبسط

- **Config/State**
  - `config.js` → يجهز flags/helpers
  - `state.js` → `App.State`

- **Core Utilities**
  - `utils.js` → normalization/escape/number/date helpers

- **Stability/Recovery**
  - `error_boundary.js` (global window handlers)
  - `auto_recover.js` (DOM snapshot/restore)
  - `hooks.js` (نقاط hooking لبعض الأحداث)
  - `safe_console.js` (wrapper)

- **Data Layer**
  - `data.js` → parsing + build rows + computeView
  - `assets/js/worker_xlsx.js` → parsing داخل worker

- **UI Layer**
  - `view_modules/table.js` → بناء DOM للجدول
  - `view_modules/header_filters.js` → فلترة الأعمدة + viewFiltered
  - `view.js` → glue logic + totals + breakdown + delegation + top toolbar
  - `helpers/details.js` → تفاصيل صفوف inline
  - `compact/compact_bootstrap.js` → compact mode renderer/events

- **Controller/Bootstrap**
  - `controller.js` → wiring للأزرار/inputs
  - `main.js` → init + self test + ربط بعض patching

### 4.2 تدفق النداءات الأساسية

- `controller.js` → `App.Data.handleFile/loadSheet/rebuildUI()`
- `App.Data.*` → يكتب في `App.State` → ثم ينادي:
  - `App.View.renderTable()`
  - `App.View.updateSumSelected()`
- `App.View.renderTable()` → `view_modules/table.js` + `applyHeaderFilters()`
- `updateSumSelected()` → `renderConsumptionBreakdown()` → `App.Rules.list[*].matches/summarize()`
- `DetailsHelpers.toggleRowDetails()` → ينادي `App.View.updateSumSelected()/renderConsumptionBreakdown()` بشكل غير مباشر

---

## 5) 10 مخاطر/Weaknesses مؤكدة من الكود الحالي

> البنود التالية **مؤكدة من قراءة الكود** (ليست افتراضات). الهدف منها: نعرف أين قد يحدث Regression أو Bugs عند أي تطوير لاحق.

1) **Coupling عالي جدًا بسبب Globals**
   - `App.State` يتم تعديله من `data.js`, `controller.js`, `view.js`, `header_filters.js`, و compact.
   - لا يوجد “Store/dispatch” أو immutability، مما يصعب تتبع السبب عند أي خلل.

2) **حساسية شديدة لترتيب تحميل السكربتات**
   - الاعتماد على أن `App.Config/State/Utils` موجودة قبل `data/view/controller`.
   - أي تغيير في ترتيب `<script defer>` في `index.html` قد يكسر runtime.

3) **منطق الفلاتر مكرر (Duplication) بين computeView و Rules**
   - `data.js:computeView()` يقرر BALANCE/UNITS/BONUS/JUNK.
   - في نفس الوقت `js/rules/*.js` تعيد تعريف matches لمنطق قريب.
   - هذا يفتح باب divergence في المستقبل.

4) **Pagination Next/Prev لا تحترم viewFiltered**
   - `controller.js` يحسب `maxPage` بناءً على `State.view.length` وليس `State.viewFiltered.length`.
   - النتيجة: صفحات فارغة/أرقام غير منطقية عند تفعيل header filters.

5) **goToRow يعتمد على State.view وليس base الفعلي**
   - `view.js:goToRow()` يبحث داخل `State.view` لتحديد page.
   - مع `State.viewFiltered` قد يذهب لصفحة غير صحيحة.

6) **Header filters/range قد تظل فعالة عبر تحميل ملف جديد**
   - `data.js:resetTransientState()` يمسح selection/detailCache/page فقط.
   - لا يقوم بمسح `State.headerFilters`, `State.rangeFilter`, `State.viewFiltered`.

7) **مخاطر XSS/HTML injection في بعض مسارات rendering**
   - `view_modules/table.js` يستخدم `escapeHTML` (جيد).
   - لكن `view.js` يبني HTML strings في breakdown ويضعها في `innerHTML` مع قيم مشتقة من الملف.
   - أي تغيير لاحق يجب أن يحافظ على نفس المخرجات مع تقوية sanitization.

8) **قابلية أداء ضعيفة مع Selections كبيرة**
   - `updateSumSelected()` يمر على `State.rows` بالكامل في كل مرة، ويعمل sums للصفوف المختارة.
   - مع ملفات كبيرة + selection كبيرة قد يصبح بطيئًا.

9) **عدم وجود Cancellation حقيقية لعمليات parsing**
   - يوجد timeout fallback للـ Worker، لكن لا يوجد “cancel job” إذا المستخدم غيّر الملف بسرعة.
   - قد يحدث race: نتيجة parsing قديمة تصل بعد اختيار ملف جديد (unless guarded).

10) **Compact mode auto-refresh (polling) كل 1s**
   - `compact_bootstrap.js` يعمل polling لمراقبة تغيّر البيانات.
   - قد يسبب CPU usage غير ضروري ويصعب اختبار الاستقرار على جلسات طويلة.

---

## Phase 11: UI adapters (New Layering)

> من أجل تقليل الاقتران بين `view.js` وواجهة المستخدم، تم إدخال طبقة UI منفصلة فى المسار المحدث. هذه الطبقة تلتزم بالسلوك السابق ولكن تجعل من السهل استبدال أو تحديث منطق العرض لاحقًا.

- **js/ui/table_renderer.js**
  - نقطة الدخول الرسمية لبناء الجدول. تقوم بإستدعاء `App.View.renderTable()` (أو النسخة العالمية `renderTable`) دون تعديل DOM بنفسها.

- **js/ui/summary_renderer.js**
  - تقوم بتحديث شريط التجميع السريع للصفوف المحددة عبر إستدعاء `updateSumSelected`. أى تحسين أو تغيير فى منطق التجميع يمكن عزله هنا.

- **js/ui/details_renderer.js**
  - مدخل مخصص لعرض التفاصيل/التقسيمات. فى الوقت الحالى هو دالة فارغة لأن `updateSumSelected()` ما زال يقوم بتوليد بيانات الـ breakdown داخليًا، لكنها موجودة استعدادًا لفصل هذا المنطق فى المستقبل.

- **js/ui/controls_wiring.js**
  - مسئولة عن تهيئة نموذج العرض (`renderModel`) وإستدعاء الريندر المناسب حسب نوع الـ action الصادر من الـ Store. على سبيل المثال، تغير الصفحة (SET_PAGE/SET_PAGE_SIZE) يعيد رسم الجدول فقط بينما تغيّر الاختيار (TOGGLE_SELECT) يحدث شريط المجاميع وناحية التفاصيل دون إعادة بناء الجدول.

يقوم `view.js` بالاحتفاظ بالدوال العامة القديمة (`renderTable`, `updateSumSelected`, إلخ)، لكن لا يتم إستدعاؤها مباشرة من `controller.js` أو `main.js`. بدلاً من ذلك، يستدعى `App.UI.renderAll(action)` من خلال subscribe فى `state_manager.js` والذى يقوم بدوره بتمرير التحكم إلى الـ renderers أعلاه. يعنى ذلك أن تغيير منطق العرض لا يستلزم تعديل الـ controller أو الـ state manager.

### مخطط مبسط للطبقة الجديدة

```
App.StateManager (dispatch) → App.UI.renderAll(action)
                             ↙         ↓         ↘
                 TableRenderer  SummaryRenderer  DetailsRenderer
                       |               |                 |
                App.View.renderTable   App.View.updateSumSelected   (no‑op)
```

توضح الأسهم أن الـ dispatch من الـ Store يمر عبر `renderAll()`، والذى يقرر أى ريندر يجب تشغيله بناءً على نوع الـ action، ومن ثم يفوض إلى الدوال الموجودة فى `view.js`. هذا الفصل يسمح بتغيير أو استبدال `view.js` فى مراحل لاحقة دون المساس بطبقات البيانات أو التحكم.

---

## 6) ما الذي يجب اعتباره “Contracts” قبل أي Refactor؟

- ما هو “مصدر الحقيقة” لكل قرار؟
  - `State.view` للفلتر الرئيسي.
  - `State.viewFiltered` لفلترة الأعمدة/النطاق.
  - `State.selected` للاختيار.
- ما هي النقاط التي تربط أجزاء بعيدة ببعضها؟
  - Details row يعتمد على breakdown text داخل DOM.
  - breakdown يعتمد على Rules registry.
  - pagination/selection تعتمد على base (view vs viewFiltered).

هذه النقاط هي الأكثر حساسية عند أي تطوير لاحق.

---

## 7) تحديثات مرحلة 10 (Single Source of Truth)

في المرحلة العاشرة تم إدخال **StateManager/Store** كوسيط وحيد لتغيير حالة التطبيق. أبرز التغييرات:

- **التغييرات على الحالة تتم عبر dispatch فقط:** كل الأماكن التي كانت تكتب إلى `App.State` مباشرة (مثل تغير الصفحة، حجم الصفحة، الفلتر، اختيار الصفوف أو إعادة الضبط) تم تعديلها لتستدعي `Store.dispatch()` بواحدة من نوعين:
  - `dispatch({type: 'SOME_ACTION', ...})` للأفعال المعرّفة في الـ reducer (مثل `SELECT_IDS`, `DESELECT_IDS`, `CLEAR_SELECTION`).
  - أو `dispatch({ patch: { key: value, ... } })` لتحديث مجمّع لعدة حقول دفعة واحدة. يقوم StateManager بدمج الـ patch وتحريك المشتركين.
- **الاحتفاظ بجسر التوافق:** الكائن `App.State` ما يزال موجوداً كمرجع ثابت لقراءة الحالة. عند تهيئة `StateManager` يتم تمرير هذا الكائن كـ target و proxy للـ reducer بحيث تبقى الإشارات القديمة صالحة.
- **مسارات Legacy fallback:** في بعض الأماكن ما زالت توجد مسارات fallback بحيث إذا لم يكن Store موجوداً (مثلاً في نسخ أقدم)، يتم تعديل `State` مباشرة للحفاظ على التوافق.
- **حارس Debug لتتبع الكتابة المباشرة:** عند إضافة `?debug=1` لعنوان الصفحة يتم تغليف `App.State` في Proxy يمنع أى كتابة مباشرة ويطبع تحذيراً فى الـ console (`Direct state write blocked`). هذه الميزة تساعد على اكتشاف الأكواد التى لم يتم تحديثها بعد لتستخدم `dispatch`.
- **عدم تغيير السلوك الظاهرى (Zero Regression):** تم اختبار التغييرات باستخدام `selftest` لضمان أن UI يتصرف كما كان قبل إدخال الـ Store، وأن كل العقود القائمة (pagination، filters، selection، details) لا تزال تعمل كما هى.

