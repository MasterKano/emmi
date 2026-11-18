#!/usr/bin/env python3
"""Refresh WTI's listed contracts and official macro dates. Failed sources retain their last good observations.

Python stdlib only. No generated prices, inferred event dates, API keys or paid feeds.
"""
import argparse
import datetime as dt
import html
import json
import math
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import re
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
FED = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
BLS = "https://www.bls.gov/schedule/news_release/bls.ics"
SCANNER = "https://scanner.tradingview.com/futures/scan"
MONTH_CODES = "FGHJKMNQUVXZ"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EMMi market-data refresh)", "Accept": "application/json,text/html,text/calendar"}


def get(url, payload=None):
    headers = dict(HEADERS)
    if payload is not None:
        headers.update({"Content-Type": "application/json", "Origin": "https://www.tradingview.com"})
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8-sig")


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def wti_contracts(payload, fetched_at):
    columns = ["name", "close", "change_abs", "exchange"]
    rows = {}
    today = fetched_at[:7]
    for item in payload.get("data", []):
        d = dict(zip(columns, item.get("d", [])))
        match = re.fullmatch(r"CL([FGHJKMNQUVXZ])(20\d\d)", str(d.get("name", "")))
        if not match or d.get("exchange") != "NYMEX" or not numeric(d.get("close")) or d["close"] <= 0:
            continue
        month = f"{match[2]}-{MONTH_CODES.index(match[1]) + 1:02d}"
        if month < today:
            continue
        # CL's native tick is one cent. Remove binary float artefacts without inventing extra precision.
        cents = lambda v: str(Decimal(str(v)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        rows[d["name"]] = {"contract": d["name"], "label": MONTHS[int(month[5:]) - 1][:3] + "-" + month[2:4], "month": month,
            "settle": cents(d["close"]), "change": cents(d["change_abs"]) if numeric(d.get("change_abs")) else "",
            "currency": "USD", "unit": "USD/bbl", "source": "tradingview_scanner", "as_of": fetched_at,
            "quote_time": None, "timestamp_kind": "retrieved"}
    return sorted(rows.values(), key=lambda row: row["month"])


def fed_events(page):
    """Published meeting days only; no assumed decision hour or inferred minutes-release date."""
    out = []
    sections = re.split(r"(20\d\d) FOMC Meetings", page)
    for i in range(1, len(sections), 2):
        year, body = int(sections[i]), sections[i + 1]
        pattern = r'class="[^"]*fomc-meeting__month[^\"]*"[^>]*>(.*?)</div>\s*<div class="[^"]*fomc-meeting__date[^\"]*"[^>]*>(.*?)</div>'
        for month_html, days_html in re.findall(pattern, body, re.S):
            month = re.sub(r"<[^>]+>", "", month_html).strip()
            days = re.sub(r"<[^>]+>", "", days_html).strip().replace("*", "")
            if month not in MONTHS or not re.fullmatch(r"\d{1,2}(?:-\d{1,2})?", days):
                continue
            day = dt.date(year, MONTHS.index(month) + 1, int(days.split("-")[-1])).isoformat()
            out.append({"id": "fomc-" + day, "company": "Federal Reserve", "title": "FOMC meeting concludes", "date": day,
                "date_label": day, "sort_date": day, "precision": "day", "confidence": "confirmed", "group": "macro", "source": FED})
    return out


def bls_events(text):
    text = re.sub(r"\r?\n[ \t]", "", text)
    out = []
    for event in text.split("BEGIN:VEVENT")[1:]:
        fields = {}
        for line in event.split("END:VEVENT", 1)[0].splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                fields[key.split(";", 1)[0]] = (key, value)
        summary = fields.get("SUMMARY", ("", ""))[1].replace("\\,", ",")
        if not re.search(r"Consumer Price Index|Producer Price Index|Employment Situation", summary, re.I):
            continue
        key, value = fields.get("DTSTART", ("", ""))
        try:
            if "T" in value:
                date = dt.datetime.strptime(value.rstrip("Z"), "%Y%m%dT%H%M%S")
                tz = dt.timezone.utc if value.endswith("Z") else ZoneInfo(re.search(r"TZID=([^;:]+)", key)[1]) if "TZID=" in key else None
                if tz is None:
                    continue  # A floating calendar time cannot safely be called Zurich or UTC.
                date = date.replace(tzinfo=tz).astimezone(dt.timezone.utc)
                iso, time = date.date().isoformat(), date.strftime("%H:%M:%S")
            else:
                iso, time = dt.datetime.strptime(value, "%Y%m%d").date().isoformat(), None
        except (ValueError, KeyError, TypeError):
            continue
        out.append({"id": "bls-" + fields.get("UID", ("", iso + summary))[1], "company": "US economy", "title": html.unescape(summary),
            "date": iso, "date_label": iso, "sort_date": iso, "time": time, "timezone": "UTC" if time else None,
            "precision": "day", "confidence": "confirmed", "group": "macro", "source": BLS})
    return out


def write(path, data):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--only", choices=["wti", "calendar", "all"], default="all")
    args.add_argument("--out", type=Path, default=ROOT / "data")
    a = args.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    successes = 0
    if a.only in ["wti", "all"]:
        try:
            payload = json.loads(get(SCANNER, {"filter": [{"left": "exchange", "operation": "equal", "right": "NYMEX"},
                {"left": "name", "operation": "match", "right": "^CL[FGHJKMNQUVXZ][0-9]{4}$"}],
                "symbols": {"query": {"types": []}}, "columns": ["name", "close", "change_abs", "exchange"], "range": [0, 1000]}))
            rows = wti_contracts(payload, now)
            if len(rows) < 6:
                raise ValueError(f"only {len(rows)} priced contracts; retaining prior curve")
            write(a.out / "wti_curve.json", {"fetched_at_utc": now, "source": SCANNER, "unit": "USD/bbl", "contracts": rows,
                "note": "Delayed per-contract quotes, not settlements. Timestamp is retrieval; the source does not supply individual quote times. Missing changes remain blank."})
            print(f"WTI: {len(rows)} priced listed contracts")
            successes += 1
        except Exception as error:
            print(f"WTI: retained last good file ({error})")
    if a.only in ["calendar", "all"]:
        path = a.out / "macro_calendar.json"
        previous = json.loads(path.read_text()) if path.exists() else {"events": [], "sources": {}}
        events, statuses = [], {}
        for url, parser in [(FED, fed_events), (BLS, bls_events)]:
            try:
                rows = parser(get(url))
                if not rows:
                    raise ValueError("no published dates parsed")
                events.extend([{**row, 'last_checked': now} for row in rows])
                statuses[url] = {"checked_at": now, "status": "ok"}
                successes += 1
            except Exception as error:
                retained = [e for e in previous["events"] if e.get("source") == url]
                events.extend(retained)
                prior = previous.get("sources", {}).get(url, {})
                statuses[url] = {"checked_at": prior.get("checked_at"), "attempted_at": now, "status": "retained" if retained else "unavailable"}
                print(f"Calendar {url}: {statuses[url]['status']} ({error})")
        write(path, {"fetched_at_utc": now, "events": sorted(events, key=lambda e: e["date"]), "sources": statuses})
        print(f"Macro calendar: {len(events)} published dates; source checks retain their own times")
    return 0 if successes else 1


if __name__ == "__main__":
    raise SystemExit(main())
