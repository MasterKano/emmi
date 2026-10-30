"""Lightweight daily-close fetch for the research pilot ONLY: 30 pilot listings + their local indices.
Uses EMMA's existing Yahoo daily collector (scripts/build_data.py fetch_chart, chart API interval=1d);
no fundamentals, no build_companies calls. Range = earliest pilot event - 120 days .. today
(covers the before-window and the 60-session after-window).
Usage: fetch_prices.py OUTDIR   -> OUTDIR/<listing or index>.csv (date,close,volume,currency,source,fetched_at)"""
import sys, math, datetime as dt
import os; sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rcommon import *
sys.argv, _out = sys.argv[:1], sys.argv[1]
import build_data as BD
P = rcsv(os.path.join(RES, "pilot.csv")); EV = rcsv(os.path.join(RES, "pilot_events.csv"))
first = min(dt.date.fromisoformat(e["date"]) for e in EV) - dt.timedelta(days=120)
years = max(1, math.ceil((dt.date.today() - first).days / 365.25))
syms = {p["yahoo"]: p["listing_id"] for p in P}; syms.update({p["benchmark"]: "INDEX:" + p["benchmark"] for p in P})
now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"); fails = []
os.makedirs(_out, exist_ok=True)
for y, name in sorted(syms.items()):
    try:
        df, meta = BD.fetch_chart(y, years=years)
    except Exception as x:
        fails.append(f"{y}: {x}"); continue
    df = df[df.index.date >= first].dropna(subset=["close"])
    rows = [dict(date=str(i.date()), close=f"{c:.6g}", volume="" if v != v or v is None else int(v),
                 currency=meta.get("currency", ""), source=f"yahoo chart v8 1d {y}", fetched_at=now)
            for i, c, v in zip(df.index, df["close"], df["volume"])]
    wcsv(os.path.join(_out, name.replace(":", "_").replace("^", "") + ".csv"), rows)
print(len(syms) - len(fails), "series ok;", "failed:", fails or "none")
sys.exit(1 if len(fails) > 3 else 0)
