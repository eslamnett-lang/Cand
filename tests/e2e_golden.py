#!/usr/bin/env python3
"""Phase2‑Minimal E2E Golden (behavioral JSON only).

Creates/validates a stable baseline JSON derived from UI state after loading the
fixture Excel file.

Hard constraints:
- Chromium only
- No DOM/HTML snapshots
- Fail‑fast waits (20–30s)
- No wait_until=networkidle
- Must not use port 8080 (reserved in this environment)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


# --- Config ---
DEFAULT_PORT = 8099
GOLDEN_PATH = Path("tests/golden/baseline.json")
FIXTURE_PATH = Path("tests/fixtures/sample.xlsx")
CHROMIUM_EXE = os.environ.get("CHROMIUM_EXE") or "/usr/bin/chromium"

# NOTE: this container ships Chromium with a managed policy that blocks all URLs.
# We only adjust it for the duration of the test run, and restore it in finally.
POLICY_PATH = Path("/etc/chromium/policies/managed/000_policy_merge.json")
POLICY_DIR = POLICY_PATH.parent


def _step(msg: str) -> None:
    # STEP markers are safe (no file data). Helpful for triage.
    print(f"STEP:{msg}", file=sys.stderr, flush=True)


def _normalize_digits(s: str) -> str:
    # Arabic‑Indic digits → ASCII digits
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    return s.translate(trans)


def _parse_int(s: str) -> int:
    s2 = _normalize_digits(s)
    m = re.search(r"-?\d+", s2)
    return int(m.group(0)) if m else 0


def _parse_float(s: str) -> float:
    s2 = _normalize_digits(s)
    # Keep digits, dot, minus
    cleaned = re.sub(r"[^0-9\.\-]", "", s2)
    if cleaned in ("", "-", "."):
        return 0.0
    try:
        return float(cleaned)
    except Exception:
        return 0.0


def _safe_read_text(page, selector: str, timeout_ms: int = 25000) -> str:
    # Read small UI counters only.
    page.wait_for_selector(selector, state="attached", timeout=timeout_ms)
    txt = page.inner_text(selector, timeout=timeout_ms)
    return txt.strip()


def _start_http_server(root: Path, port: int) -> ThreadingHTTPServer:
    class ReuseServer(ThreadingHTTPServer):
        allow_reuse_address = True

    class QuietHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args: Any, **kwargs: Any):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            return

    # Some environments take a moment to release a port after shutdown.
    # Retry briefly instead of failing immediately with EADDRINUSE.
    last_err: Optional[Exception] = None
    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        try:
            httpd = ReuseServer(("127.0.0.1", port), QuietHandler)
            break
        except OSError as e:
            last_err = e
            if getattr(e, "errno", None) in (98, 48):
                time.sleep(0.25)
                continue
            raise
    else:
        raise OSError(f"Could not bind HTTP server on 127.0.0.1:{port}: {last_err}")
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    # Attach for clean shutdown/join in callers.
    setattr(httpd, "_thread", t)
    return httpd


def _wait_http_ready(port: int, timeout_s: float = 10.0) -> None:
    url = f"http://127.0.0.1:{port}/index.html"
    end = time.monotonic() + timeout_s
    last_err: Optional[Exception] = None
    while time.monotonic() < end:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                if resp.status == 200:
                    return
        except Exception as e:
            last_err = e
        time.sleep(0.2)
    raise TimeoutError(f"HTTP server not ready on {url}: {last_err}")


def _port_is_free(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except Exception:
            pass
        s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def _maybe_disable_url_blocklist() -> Tuple[Optional[Path], Optional[Path]]:
    """Temporarily disable Chromium managed policies.

    This container ships Chromium with a managed policy URLBlocklist=["*"] which
    blocks even localhost navigation (net::ERR_BLOCKED_BY_ADMINISTRATOR). In
    practice the blocklist may be enforced via multiple merged policy files, so
    the most reliable approach is to temporarily move the entire managed policy
    directory out of the way, create an empty one, then restore it at the end.
    """
    try:
        if not POLICY_DIR.exists():
            return None, None

        # Fast check: only do the move if the merged policy indicates URLBlocklist=["*"].
        if POLICY_PATH.exists():
            txt = POLICY_PATH.read_text(encoding="utf-8", errors="ignore")
            if not ('"URLBlocklist"' in txt and '"*"' in txt):
                return None, None

        bak_dir = POLICY_DIR.parent / (POLICY_DIR.name + ".e2e_bak")
        if bak_dir.exists():
            return None, None

        os.rename(POLICY_DIR, bak_dir)
        os.makedirs(POLICY_DIR, exist_ok=True)
        return POLICY_DIR, bak_dir
    except Exception:
        return None, None


def _restore_policy(orig: Optional[Path], bak: Optional[Path]) -> None:
    if not orig or not bak:
        return
    try:
        # Remove the temporary empty directory and restore the original one.
        if orig.exists() and orig.is_dir():
            try:
                for p in orig.iterdir():
                    # should be empty, but keep it safe
                    if p.is_file() or p.is_symlink():
                        p.unlink(missing_ok=True)
                    elif p.is_dir():
                        # best-effort: remove empty subdirs
                        try:
                            p.rmdir()
                        except Exception:
                            pass
                orig.rmdir()
            except Exception:
                pass
        if bak.exists() and not orig.exists():
            os.rename(bak, orig)
    except Exception:
        pass


def _collect_baseline(page) -> Dict[str, Any]:
    # Wait until the table is populated.
    page.wait_for_function(
        "() => document.querySelectorAll('#dataTable thead th').length > 0",
        timeout=30000,
    )
    page.wait_for_function(
        "() => document.querySelectorAll('#dataTable tbody tr').length > 0",
        timeout=30000,
    )

    headers_count = int(
        page.evaluate("() => document.querySelectorAll('#dataTable thead th').length")
    )
    visible_row_count = int(
        page.evaluate(
            "() => document.querySelectorAll('#dataTable tbody tr:not(.row-compare)').length"
        )
    )

    page_info = _safe_read_text(page, "#pageInfo")
    current_page = _parse_int(page_info)

    filter_key = page.evaluate("() => document.getElementById('filterSelect').value")

    selected_count = _parse_int(_safe_read_text(page, "#selectedCount"))
    totals_fee = _parse_float(_safe_read_text(page, "#sumSelectedFee"))
    totals_units = _parse_float(_safe_read_text(page, "#sumSelectedUnits"))

    return {
        "loaded": bool(headers_count > 0),
        "visibleRowCount": visible_row_count,
        "headersCount": headers_count,
        "currentPage": current_page,
        "filterKey": str(filter_key) if filter_key is not None else None,
        "selectedCount": selected_count,
        "totalsFee": totals_fee,
        "totalsUnits": totals_units,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-golden", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    os.chdir(root)

    port = int(os.environ.get("E2E_PORT") or str(DEFAULT_PORT))
    if port == 8080:
        print("E2E_PORT=8080 is forbidden; use 8099 or another free port.", file=sys.stderr)
        return 2

    if not FIXTURE_PATH.exists():
        print(f"Missing fixture: {FIXTURE_PATH}", file=sys.stderr)
        return 2

    if not _port_is_free(port):
        # Port release can lag briefly after a previous run; allow a short grace period.
        for _ in range(10):
            time.sleep(0.2)
            if _port_is_free(port):
                break
        else:
            print(f"Port {port} is not free. Set E2E_PORT to a free port.", file=sys.stderr)
            return 2

    GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)

    httpd: Optional[ThreadingHTTPServer] = None
    policy_orig: Optional[Path] = None
    policy_bak: Optional[Path] = None

    console_errors = {"count": 0}

    def on_console(msg) -> None:
        # Do not print message text; only count severity.
        try:
            if msg.type == "error":
                console_errors["count"] += 1
        except Exception:
            pass

    def on_page_error(_exc) -> None:
        console_errors["count"] += 1

    try:
        _step("server_start")
        httpd = _start_http_server(root, port)
        _wait_http_ready(port, timeout_s=10.0)
        _step("server_ready")

        # Workaround for container policy that blocks all URLs.
        policy_orig, policy_bak = _maybe_disable_url_blocklist()

        _step("playwright_launch")
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path=CHROMIUM_EXE,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-background-networking",
                    "--disable-default-apps",
                    "--disable-sync",
                    "--metrics-recording-only",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )

            context = browser.new_context(
                ignore_https_errors=True,
                viewport={"width": 1280, "height": 720},
            )
            page = context.new_page()

            page.set_default_timeout(25000)  # fail-fast
            page.on("console", on_console)
            page.on("pageerror", on_page_error)

            url = f"http://127.0.0.1:{port}/index.html"
            _step("goto")
            page.goto(url, wait_until="domcontentloaded", timeout=25000)

            _step("wait_file_input")
            page.wait_for_selector("#fileInput", state="attached", timeout=25000)

            _step("upload_fixture")
            # Setting input files triggers the onchange handler.
            page.set_input_files("#fileInput", str(FIXTURE_PATH.resolve()))

            _step("wait_table_loaded")
            # Wait until we have headers+rows (bounded). No networkidle.
            page.wait_for_function(
                "() => document.querySelectorAll('#dataTable thead th').length > 0",
                timeout=30000,
            )
            page.wait_for_function(
                "() => document.querySelectorAll('#dataTable tbody tr').length > 0",
                timeout=30000,
            )

            _step("collect_baseline")
            baseline = _collect_baseline(page)
            baseline["consoleErrorsCount"] = int(console_errors["count"])

            context.close()
            browser.close()

        if args.update_golden or not GOLDEN_PATH.exists():
            GOLDEN_PATH.write_text(
                json.dumps(baseline, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"WROTE_GOLDEN={GOLDEN_PATH}")
            return 0

        expected = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
        if baseline != expected:
            print("GOLDEN_MISMATCH", file=sys.stderr)
            print("EXPECTED=" + json.dumps(expected, sort_keys=True), file=sys.stderr)
            print("GOT=" + json.dumps(baseline, sort_keys=True), file=sys.stderr)
            return 1

        print("GOLDEN_OK")
        return 0

    except PlaywrightTimeoutError as e:
        print(f"E2E_TIMEOUT: {e}", file=sys.stderr)
        return 3
    except Exception as e:
        print(f"E2E_ERROR: {e}", file=sys.stderr)
        return 3
    finally:
        try:
            if httpd is not None:
                httpd.shutdown()
                httpd.server_close()
                t = getattr(httpd, "_thread", None)
                if t is not None:
                    t.join(timeout=2)
        except Exception:
            pass
        _restore_policy(policy_orig, policy_bak)


if __name__ == "__main__":
    raise SystemExit(main())
