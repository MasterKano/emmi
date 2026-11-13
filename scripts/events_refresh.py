#!/usr/bin/env python3
"""Refresh the Upcoming events log (data/events.json).

What this script does:
  1. Reclassifies each event as upcoming or past from today's date in Europe/Zurich.
     (The page also does this in the browser; this keeps the file tidy.)
  2. Fetches a fixed list of official financial-calendar and licence-round pages and
     prints any ISO-like dates it can see, so a weekly pass can add or correct events.
  3. Never invents dates. New events must be copied from those official pages into
     data/events.json by hand (or by extending this script with a parser that has
     been checked against the same page).

Usage (from the repo root):
  python3 scripts/events_refresh.py
  python3 scripts/events_refresh.py --fetch     # also download the official pages
  python3 scripts/events_refresh.py --write     # write the reclassified file back

Coverage is the Corporate Sector Intelligence list in the shared watch list
(Lundin Group, oil and gas, Nordic renewables and power, data centres), plus
Valiente Resources once it lists. Ex-dividend dates are out of scope.
"""
from __future__ import annotations

import argparse, datetime as dt, json, re, sys, urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "events.json"
TZ = ZoneInfo("Europe/Zurich")

# Official pages to check each week. Add a new URL here when a company publishes
# a calendar. Keep these as primary sources only.
SOURCES = [
    ("Equinor", "oil_gas", "https://www.equinor.com/investors"),
    ("Aker BP", "oil_gas", "https://akerbp.com/en/investor/calendar/"),
    ("Vår Energi", "oil_gas", "https://varenergi.no/en/investor/financial-calendar/"),
    ("BW Energy", "oil_gas", "https://www.bwenergy.no/en/investor/financial-calendar/"),
    ("Harbour Energy", "oil_gas", "https://www.harbourenergy.com/investors/financial-calendar/"),
    ("OKEA", "oil_gas", "https://okea.no/investor/financial-calendar/"),
    ("Gulf Keystone Petroleum", "oil_gas", "https://www.gulfkeystone.com/investors/financial-calendar/"),
    ("Kistos", "oil_gas", "https://kistosplc.com/investors/financial-calendar/"),
    ("Ørsted", "renewables", "https://orsted.com/en/investors/financial-calendar"),
    ("Fortum", "renewables", "https://www.fortum.com/investors/calendar-and-events"),
    ("Eolus", "renewables", "https://www.eolus.com/en/investors/financial-calendar/"),
    ("Scatec", "renewables", "https://www.scatec.com/en/investors/financial-calendar/"),
    ("International Petroleum (IPC)", "lundin", "https://www.international-petroleum.com/investors/financial-calendar"),
    ("Lundin Mining", "lundin", "https://lundinmining.com/investors/"),
    ("Lundin Gold", "lundin", "https://lundingold.com/investors/quarterly-and-annual-financial-statements/"),
    ("Attica Exploration", "lundin", "https://www.attica-exploration.com/dugong"),
    ("Norwegian Offshore Directorate, APA 2026", "oil_gas", "https://www.sodir.no/en/facts/production-licences/licensing-rounds/apa-2026/"),
    ("Norwegian Offshore Directorate, licensing rounds", "oil_gas", "https://www.sodir.no/en/facts/production-licences/licensing-rounds/"),
]

DATE_RE = re.compile(
    r"\b(?:20\d{2}-\d{2}-\d{2}|"
    r"\d{1,2}[./]\d{1,2}[./]20\d{2}|"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}|"
    r"\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2}|"
    r"Q[1-4]\s*20\d{2}|H[12]\s*20\d{2})\b",
    re.I,
)


def today() -> str:
    return dt.datetime.now(TZ).date().isoformat()


def window_end(ev: dict) -> str:
    return ev.get("window_end") or ev.get("date") or ev.get("sort_date") or ""


def status(ev: dict, day: str) -> str:
    end = window_end(ev)
    return "past" if end and end < day else "upcoming"


def reclassify(data: dict, day: str) -> dict:
    upcoming = past = 0
    for ev in data.get("events", []):
        ev["status"] = status(ev, day)
        if ev["status"] == "past":
            past += 1
        else:
            upcoming += 1
    data["as_of"] = dt.datetime.now(TZ).isoformat(timespec="seconds")
    return data, upcoming, past


def fetch(url: str, timeout: int = 25) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "EMMI-events-refresh/1.0 (coverage calendar check)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "ignore")
            return r.status, body
    except Exception as e:
        return 0, str(e)


def scan_page(html: str) -> list[str]:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    hits = []
    seen = set()
    for m in DATE_RE.finditer(text):
        a, b = max(0, m.start() - 70), min(len(text), m.end() + 90)
        ctx = text[a:b].strip()
        key = ctx[20:80]
        if key in seen:
            continue
        seen.add(key)
        hits.append(ctx)
        if len(hits) >= 12:
            break
    return hits


def known_dates(data: dict) -> set[str]:
    out = set()
    for ev in data.get("events", []):
        if ev.get("date"):
            out.add(ev["date"])
        if ev.get("date_label"):
            out.add(ev["date_label"])
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="store_true", help="download official calendar pages and print date snippets")
    ap.add_argument("--write", action="store_true", help="write the reclassified JSON back to data/events.json")
    args = ap.parse_args()

    data = json.loads(DATA.read_text())
    day = today()
    data, n_up, n_past = reclassify(data, day)
    print(f"{DATA.relative_to(ROOT)}: {len(data.get('events', []))} events, {n_up} upcoming, {n_past} past, as of {day} Zurich")

    # Coverage names with no upcoming published date
    have = {ev["company"] for ev in data.get("events", []) if ev.get("status") != "past"}
    missing = [c["name"] for c in data.get("coverage", []) if c["name"] not in have]
    print(f"coverage names with no upcoming published date: {len(missing)}")
    if missing:
        print("  " + ", ".join(missing))

    if args.write:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote {DATA.relative_to(ROOT)} (as_of {data['as_of']})")

    if not args.fetch:
        print("Official pages to check (run with --fetch to download snippets):")
        for name, group, url in SOURCES:
            print(f"  - {name}: {url}")
        return 0

    print("\nFetching official calendars (snippets only; add new dates to the JSON by hand):")
    known = known_dates(data)
    for name, group, url in SOURCES:
        code, body = fetch(url)
        if code != 200:
            print(f"\n{name}: HTTP {code} {body[:120]}")
            continue
        hits = scan_page(body)
        print(f"\n{name} ({url})")
        if not hits:
            print("  (no date-like text found in the static HTML; open the page to check widgets)")
            continue
        for h in hits:
            flag = "  already in the log:" if any(k in h for k in known) else "  check:"
            print(flag, h)

    print("\nDo not add a date unless it is published on one of these pages or another official IR, exchange or Directorate page.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
