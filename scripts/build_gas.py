"""European gas storage (GIE AGSI+, the official EU gas storage transparency platform).
Daily filling level for the EU aggregate and member states with storage, plus Ukraine (non-EU, not in the EU total).
Keeps the current calendar year and the 5 previous ones (5-year average/range is computed in the browser):
  fill % for all six years; TWh in storage and net flow (injection - withdrawal, GWh/d) for this year and last year
  (the EU aggregate keeps all six years of those too); injection and withdrawal for this year.
Arrays are indexed by a 366-day grid (index 59 = 29 Feb, empty in non-leap years) so years line up by date.
Source: https://agsi.gie.eu (API needs a free key: env GIE_API_KEY, sent only in the x-key header, never logged).
AGSI publishes once a day (~18:00 CET) for the previous gas day and revises recent days, so each run refetches the
last 60 days; missing years are backfilled (first run ~160 requests). Writes data/gas.json."""
import datetime as dt, json, os, sys, time

import requests
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write_json  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "gas.json")
API = "https://agsi.gie.eu/api"
NY = 5            # previous years kept for the 5-year average / range
RECENT = 60       # days refetched on every run (AGSI revises recent gas days)
# order = default table order; (code, name, query)
AREAS = [("EU", "EU total", {"type": "eu"}),
         ("DE", "Germany", {}), ("IT", "Italy", {}), ("FR", "France", {}), ("NL", "Netherlands", {}),
         ("AT", "Austria", {}), ("HU", "Hungary", {}), ("SK", "Slovakia", {}), ("CZ", "Czechia", {}),
         ("PL", "Poland", {}), ("RO", "Romania", {}), ("ES", "Spain", {}), ("LV", "Latvia", {}),
         ("BE", "Belgium", {}), ("HR", "Croatia", {}), ("BG", "Bulgaria", {}), ("DK", "Denmark", {}),
         ("PT", "Portugal", {}), ("SE", "Sweden", {}),
         ("UA", "Ukraine", {})]
NON_EU = {"UA"}
NOTES = {"GB": "United Kingdom: AGSI+ has UK data only up to 30 Dec 2020 (pre-Brexit), so it is not shown.",
         "IE": "Ireland: no storage data reported in AGSI+.",
         "UA": "Ukraine is not an EU member: shown for reference, not part of the EU total."}
S = requests.Session()


def key():
    return os.environ.get("GIE_API_KEY", "").strip()


def redact(s):
    """AGSI error messages can echo the key back: never let it reach logs or the data file."""
    s, k = str(s), key()
    return s.replace(k, "***") if k else s


def call(params):
    """One AGSI request with retries. Only the HTTP status / a fixed label is ever reported, never the response text
    (AGSI's error messages can contain the key) or the request headers."""
    last = None
    for i in range(6):
        try:
            r = S.get(API, params=params, headers={"x-key": key(), "User-Agent": "markets-monitor (github.com/MasterKano/markets-monitor)"}, timeout=90)
            if r.status_code in (429, 500, 502, 503, 504):
                last = f"HTTP {r.status_code}"; time.sleep(6 * (i + 1)); continue
            if r.status_code >= 400:
                last = f"HTTP {r.status_code}"; time.sleep(6 * (i + 1)); continue
            j = r.json()
            if j.get("error"):
                # e.g. transient key throttling: back off and retry; the message itself is not reported
                last = "AGSI refused the request (" + redact(str(j.get("error")))[:40] + ")"; time.sleep(15 * (i + 1)); continue
            time.sleep(1.1)  # stay under ~60 requests/min
            return j
        except (requests.RequestException, ValueError) as e:
            last = type(e).__name__; time.sleep(6 * (i + 1))
    raise RuntimeError(f"{last} for {params.get('country') or params.get('type')}")


def fetch(q, a, b):
    """All rows for one area between dates a and b (inclusive) -> {date: row}."""
    out, page = {}, 1
    while True:
        p = dict(q, **{"from": a.isoformat(), "to": b.isoformat(), "size": 300, "page": page})
        j = call(p)
        for x in j.get("data") or []:
            out[x["gasDayStart"]] = x
        lp = int(j.get("last_page") or 1)
        if page >= lp:
            return out
        page += 1


def num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def idx(d):
    """366-day grid index (29 Feb = 59; non-leap years skip it)."""
    i = d.timetuple().tm_yday - 1
    leap = d.year % 4 == 0 and (d.year % 100 != 0 or d.year % 400 == 0)
    return i + 1 if (not leap and i >= 59) else i


def from_idx(y, i):
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    if not leap:
        if i == 59:
            return None
        if i > 59:
            i -= 1
    return dt.date(y, 1, 1) + dt.timedelta(days=i)


def rnd(v, n):
    return None if v is None else round(v, n)


def trim(a):
    a = list(a)
    while a and a[-1] is None:
        a.pop()
    return a


def old_rows(area, years):
    """Rebuild {date: (fill, twh, inj, wd, net)} from the previous file so only recent days need refetching."""
    rows = {}
    for y in years:
        ys = str(y)
        f = (area.get("fill") or {}).get(ys) or []
        t = (area.get("twh") or {}).get(ys) or []
        n = (area.get("net") or {}).get(ys) or []
        inj = (area.get("inj") or {}).get(ys) or []
        wd = (area.get("wd") or {}).get(ys) or []
        g = lambda arr, i: arr[i] if i < len(arr) else None  # noqa: E731
        for i in range(366):
            d = from_idx(y, i)
            if d is None:
                continue
            v = (g(f, i), g(t, i), g(inj, i), g(wd, i), g(n, i))
            if any(x is not None for x in v):
                rows[d.isoformat()] = v
    return rows


def main():
    if not key():
        print("GIE_API_KEY not set; gas storage build skipped (keeping the previous file)")
        return
    t0 = time.time()
    # a gas day runs 06:00-06:00 CET; AGSI also lists the running gas day (previous day's flows carried forward),
    # so stop at the last finished one
    running = (dt.datetime.now(ZoneInfo("Europe/Brussels")) - dt.timedelta(hours=6)).date()
    end = today = running - dt.timedelta(days=1)
    try:
        prev = json.load(open(OUT))
    except Exception:  # noqa: BLE001
        prev = {}
    y = today.year
    years = list(range(y - NY, y + 1))
    first = dt.date(y - NY, 1, 1)
    areas, gaps = {}, []
    for code, name, q0 in AREAS:
        q = q0 or {"country": code}
        pa = (prev.get("areas") or {}).get(code) or {}
        rows = {d: v for d, v in (old_rows(pa, years) if pa else {}).items() if d <= end.isoformat()}
        have = {d[:4] for d in rows}
        # first run, or a year boundary: backfill everything not held yet; otherwise just the recent window
        # (an area with no data in some year, e.g. Ukraine, is not re-backfilled every run: "since" records the backfill)
        start = first if not rows or (pa.get("since") or "9999") > first.isoformat() and any(str(yy) not in have for yy in years[:-1]) else today - dt.timedelta(days=RECENT)
        try:
            raw = fetch(q, start, end)
            if raw and max(raw) < (end - dt.timedelta(days=5)).isoformat():
                raw.update(fetch(q, end - dt.timedelta(days=RECENT), end))  # recent page missing: ask once more
        except Exception as e:  # noqa: BLE001
            gaps.append(redact(f"{code}: {str(e)[:120]}"))
            if pa:
                areas[code] = pa  # keep the previous data for this area
            continue
        info = None
        for d, x in raw.items():
            if d > end.isoformat():
                continue
            fill, twh = num(x.get("full")), num(x.get("gasInStorage"))
            inj, wd = num(x.get("injection")), num(x.get("withdrawal"))
            net = (inj - wd) if inj is not None and wd is not None else None
            if fill is None and twh is None:
                rows.pop(d, None); continue
            rows[d] = (fill, twh, inj, wd, net)
            if info is None or d > info["d"]:
                info = {"d": d, "wgv": num(x.get("workingGasVolume")), "status": x.get("status"), "updated": x.get("updatedAt"),
                        "inj_cap": num(x.get("injectionCapacity")), "wd_cap": num(x.get("withdrawalCapacity")), "trend": num(x.get("trend"))}
        if not rows:
            gaps.append(f"{code}: no data"); continue
        if info is None:
            info = pa.get("latest_meta") or {}
        big = code == "EU"
        fd = 0 if (info.get("wgv") or 0) >= 50 else 1  # flow decimals (GWh/d)
        out = {"name": name, "eu": code not in NON_EU, "fill": {}, "twh": {}, "net": {}, "inj": {}, "wd": {}}
        for yy in years:
            arr = [[None] * 366 for _ in range(5)]
            for d, v in rows.items():
                if d[:4] != str(yy):
                    continue
                i = idx(dt.date.fromisoformat(d))
                for k in range(5):
                    arr[k][i] = v[k]
            cur = yy == y
            recent = yy >= y - 1
            out["fill"][str(yy)] = trim(rnd(v, 2 if recent else 1) for v in arr[0])
            if recent or big:
                out["twh"][str(yy)] = trim(rnd(v, 2 if (cur or (info.get("wgv") or 0) < 50) else 1) for v in arr[1])
                out["net"][str(yy)] = trim(rnd(v, fd) for v in arr[4])
            if cur:
                out["inj"][str(yy)] = trim(rnd(v, fd) for v in arr[2])
                out["wd"][str(yy)] = trim(rnd(v, fd) for v in arr[3])
        last = max(rows)
        out["last"] = last
        out["since"] = min(start.isoformat(), pa.get("since") or "9999")
        out["latest_meta"] = {k: (rnd(v, 2) if isinstance(v, float) else v) for k, v in info.items()}
        out["wgv"] = out["latest_meta"].get("wgv")
        areas[code] = out
        print(f"  {code}: {len(raw)} rows fetched from {start}, latest {last}", flush=True)
    if not areas:
        print("AGSI: nothing fetched; keeping the previous file"); sys.exit(1)
    eu = areas.get("EU")
    obj = {
        "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "gas_day": eu["last"] if eu else max(a["last"] for a in areas.values()),
        "year": y, "years": years,
        "source": {"name": "GIE AGSI+ (Aggregated Gas Storage Inventory)", "url": "https://agsi.gie.eu/",
                   "note": "Gas Infrastructure Europe transparency platform; data published daily ~18:00 CET for the previous gas day, recent days are revised."},
        "targets": {"fill_pct": 90, "window": ["10-01", "12-01"], "deviation_pp": 10,
                    "text": "EU rule: each member state's storage should reach 90% at any point between 1 October and 1 December (Regulation (EU) 2017/1938 Art. 6a as amended by Regulation (EU) 2025/1733, applies to 2027). Up to 10 percentage points lower is allowed in difficult market conditions; intermediate targets (1 Feb, 1 May, 1 Jul, 1 Sep) are set per country and are indicative unless that country decides otherwise.",
                    "url": "https://eur-lex.europa.eu/eli/reg/2025/1733/oj/eng", "ec_url": "https://energy.ec.europa.eu/topics/energy-security/gas-storage_en"},
        "order": [c for c, _, _ in AREAS if c in areas],
        "notes": NOTES,
        "areas": areas,
        "gaps": gaps,
    }
    if key() in json.dumps(obj):  # belt and braces: never publish the key
        raise SystemExit("refusing to write gas.json: key found in output")
    write_json(OUT, obj)
    print(f"gas.json {os.path.getsize(OUT) // 1024} KB, {len(areas)} areas, gas day {obj['gas_day']}, {len(gaps)} gaps, {round(time.time() - t0)} s")


if __name__ == "__main__":
    main()
