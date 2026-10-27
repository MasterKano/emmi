#!/usr/bin/env python3
"""NY Harbor ULSD (NYMEX HO, heating oil) futures curve, all listed months, from TradingView's public
futures scanner (delayed ~10 min, no login or API key). Standalone: Python stdlib only, no repo imports.

One HTTP request per run. Rows without a price are dropped (never filled). Exits non-zero, without writing
anything, if fewer than --min-months contracts come back, so a broken run never overwrites good data.

  python scripts/ho_curve.py --out data/ho_curve.csv [--history data/ho_curve_history.csv]
  python scripts/ho_curve.py --out data/ho_curve.csv --history data/ho_curve_history.csv --merge-only
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import tempfile
import urllib.request

URL = "https://scanner.tradingview.com/futures/scan"
SOURCE = "tradingview_scanner"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
MONTH_CODES = "FGHJKMNQUVXZ"  # Jan..Dec
COLS = ["name", "close", "change_abs", "open", "high", "low", "volume", "close[1]", "exchange"]
FIELDS = ["contract", "month", "last", "change", "open", "high", "low", "volume", "prior_settle",
          "source", "fetched_at_utc"]
NAME_RE = re.compile(r"^HO([FGHJKMNQUVXZ])(\d{4})$")


def fetch():
    body = {
        "filter": [
            {"left": "exchange", "operation": "equal", "right": "NYMEX"},
            {"left": "name", "operation": "match", "right": "^HO[FGHJKMNQUVXZ][0-9]{4}$"},
        ],
        "symbols": {"query": {"types": []}},
        "columns": COLS,
        "range": [0, 200],
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST", headers={
        "User-Agent": UA, "Content-Type": "application/json", "Accept": "application/json",
        "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def num(v, nd=4):
    if v is None or isinstance(v, bool):
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return ""
    return f"{f:.{nd}f}" if f == f else ""  # NaN -> blank


def parse(payload, fetched_at):
    rows, seen = [], set()
    for item in payload.get("data") or []:
        d = dict(zip(COLS, item.get("d") or []))
        m = NAME_RE.match(str(d.get("name") or ""))
        if not m or d.get("exchange") != "NYMEX":
            continue
        last = num(d.get("close"))
        if not last:
            continue  # no price -> drop, never invent
        code, year = m.group(1), int(m.group(2))
        contract = f"HO{code}{year % 100:02d}"
        if contract in seen:
            continue
        seen.add(contract)
        vol = d.get("volume")
        rows.append({
            "contract": contract,
            "month": f"{year:04d}-{MONTH_CODES.index(code) + 1:02d}",
            "last": last,
            "change": num(d.get("change_abs")),
            "open": num(d.get("open")),
            "high": num(d.get("high")),
            "low": num(d.get("low")),
            "volume": str(int(vol)) if isinstance(vol, (int, float)) and vol == vol else "",
            "prior_settle": num(d.get("close[1]")),
            "source": SOURCE,
            "fetched_at_utc": fetched_at,
        })
    rows.sort(key=lambda r: r["month"])
    return rows


def write_atomic(path, rows):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    with os.fdopen(fd, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, path)


def append_history(path, rows):
    """Append today's rows; a rerun on the same UTC day replaces that day's rows (no duplicates)."""
    day = rows[0]["fetched_at_utc"][:10]
    old = []
    if os.path.exists(path):
        with open(path, newline="") as f:
            old = [r for r in csv.DictReader(f) if (r.get("fetched_at_utc") or "")[:10] != day]
    write_atomic(path, old + rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data/ho_curve.csv", help="latest curve CSV (overwritten)")
    ap.add_argument("--history", help="history CSV to append to (optional)")
    ap.add_argument("--min-months", type=int, default=6, help="fail if fewer contracts come back")
    ap.add_argument("--merge-only", action="store_true",
                    help="no fetch: append the existing --out CSV to --history (used by the publish retry loop)")
    a = ap.parse_args()

    if a.merge_only:
        if not a.history:
            ap.error("--merge-only needs --history")
        with open(a.out, newline="") as f:
            rows = list(csv.DictReader(f))
        if len(rows) < a.min_months:
            print(f"{a.out} has only {len(rows)} rows; history not touched", file=sys.stderr)
            return 3
        append_history(a.history, rows)
        print(f"merged {len(rows)} rows into {a.history}")
        return 0

    fetched_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        rows = parse(fetch(), fetched_at)
    except Exception as e:  # network/HTTP/JSON problems
        print(f"fetch failed: {e}", file=sys.stderr)
        return 2
    if len(rows) < a.min_months:
        print(f"only {len(rows)} months returned (< {a.min_months}); nothing written", file=sys.stderr)
        return 3
    write_atomic(a.out, rows)
    if a.history:
        append_history(a.history, rows)
    print(f"{len(rows)} months {rows[0]['month']}..{rows[-1]['month']} -> {a.out}"
          + (f" (+ {a.history})" if a.history else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
