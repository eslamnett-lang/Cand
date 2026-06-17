WE MNDO View — Fixed package (built 2025-09-06 06:40)

Included fixes:
1) view.js
   - Builds Units rows map BEFORE calling materializeUnitDetails(...).
   - Safeguards detail lines: only adds ↪ (br-jump) if a valid row id exists.
   - Unit details summary rendered on ONE line (joins with " + " instead of "<br>").
   - Minor hygiene: removed duplicate data-row-id assignment if present.

2) assets/js/perf_patch.js
   - Fully replaced with a safe, syntax-error-free version.
   - Does not change your app logic; provides optional helpers only.

How to deploy:
- Replace the same files in your project with the fixed versions from this package, keeping the same relative paths.
- Hard-refresh the browser (Ctrl+F5).
