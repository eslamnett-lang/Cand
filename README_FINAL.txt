MNDO View — Pro14 (FINAL v8)

This build is "clean release" (no sample.xlsx inside the ZIP) and is structured for easier future upgrades.

What changed (architecture / maintainability):
1) Header Filters extracted from view.js
   - Moved to: js/view_modules/header_filters.js
   - Same behavior, but view.js is smaller and safer to modify.

2) Internal Rules Registry (Plugins-free)
   - Folder: js/rules/
   - registry.js holds enabled/order/stage + register/setEnabled/configure
   - Each rule is its own small file (balance.js, units.js, bonus.js, junk.js, free_units.js)
   - Backward compatible: view.js still uses App.Rules.list / App.Rules.register

3) Script order hardened
   - Dependencies load before view.js:
     rules registry + rules → table module → header_filters module → view.js

Notes about running:
- Best: serve via http (Netlify / localhost) so the browser can use Worker mode automatically when supported.
- If you open index.html via file://, some browsers restrict Workers; the app falls back safely.

Self-test:
- Optional UI appears only with: ?selftest=1
- It uses a tiny synthetic workbook if sample.xlsx is not present (so it won’t expose customer data).

Release hygiene:
- No plugins system / loader left in the build.
- No sample Excel file shipped inside the ZIP.

Rules configuration (optional):
- In js/config.js you can add:
  App.Config.RULES_REGISTRY = { BALANCE:{enabled:true,order:10}, JUNK:{enabled:false} };
  (no rebuild needed)


v8.4 note: Added a legacy alias window.State -> App.State for backward compatibility.
