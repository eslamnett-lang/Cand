# Testing (Phase2‑Minimal)

## Golden E2E (Behavioral JSON only)

This project uses a **behavioral golden JSON** (counts/state only). No DOM snapshots are produced.

### Update golden

```bash
export E2E_PORT=8099
python3 tests/e2e_golden.py --update-golden
```

### Verify against golden

```bash
export E2E_PORT=8099
python3 tests/e2e_golden.py
```

### Outputs

- Golden file: `tests/golden/baseline.json`
- Fixture: `tests/fixtures/sample.xlsx`

### Notes

- Chromium only.
- All waits are fail‑fast (20–30s).
- No `networkidle` waits.
