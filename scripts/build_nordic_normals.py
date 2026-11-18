#!/usr/bin/env python3
"""Seasonal normals for the Live Pulse Nordic section -> data/nordic_normals.json.

Completed years only, so the file changes once a year (rerun in January).
  prices : day-ahead daily average, mean of the last three full years (2023-2025) over the same
           calendar window (date +/- 7 days). Zones: ENTSO-E A44 daily files in emmi-data
           nordic-v2/history/prices. System price (SYS): Nord Pool DayAheadPrices aggregates for
           2024-2025 (nordic-v2/history/prices/sys_YYYY.json) and, for 2023, the Nord Pool system price
           republished hourly by Energinet's Energi Data Service (Elspotprices, PriceArea=SYSTEM),
           averaged over each Danish/Zurich local delivery day.
  wind   : Nordic (SE+NO+FI+DK) wind load factor, trailing 30 days, each year's output over that
           year's installed capacity (ENTSO-E A75 / Energinet output, ENTSO-E A68 capacity), mean over
           every complete year 2015-2025 for the same calendar day.
  nuclear: SE+FI nuclear output over that year's installed nuclear capacity, trailing 30 days,
           same years and method (typical seasonal availability, for scoring only).
Usage: build_nordic_normals.py <emmi-data nordic-v2 dir> [out.json]
"""
import csv, datetime as dt, json, sys, urllib.request
from collections import defaultdict
from pathlib import Path

NV2 = Path(sys.argv[1]); OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "data/nordic_normals.json")
H = NV2 / "history"
PY = [2023, 2024, 2025]
GY = list(range(2015, 2026))
ZONES = ["NO1", "NO2", "NO3", "NO4", "NO5", "SE1", "SE2", "SE3", "SE4", "FI", "DK1", "DK2"]
D = dt.date
def mdays():
    d, out = D(2024, 1, 1), []
    while d.year == 2024: out.append(d.strftime("%m-%d")); d += dt.timedelta(1)
    return out
MD = mdays()

def zone_daily(z):
    s = {}
    for f in sorted((H / "prices").glob(f"price_daily_{z}_*.csv")):
        for r in csv.DictReader(open(f)):
            if r["value"]: s[r["date"]] = float(r["value"])
    return s

def sys_daily():
    s = {}
    for y in (2024, 2025):
        a = json.load(open(H / "prices" / f"sys_{y}.json"))
        for x in a["multiAreaDailyAggregates"]:
            v = x["averagePerArea"].get("SYS")
            if v is not None: s[x["deliveryStart"]] = float(v)
    url = ("https://api.energidataservice.dk/dataset/Elspotprices?start=2023-01-01T00:00&end=2024-01-01T00:00"
           "&filter=%7B%22PriceArea%22:%5B%22SYSTEM%22%5D%7D&limit=0")
    rec = json.load(urllib.request.urlopen(url, timeout=120))["records"]
    by = defaultdict(list)
    for r in rec:
        if r["SpotPriceEUR"] is not None: by[r["HourDK"][:10]].append(float(r["SpotPriceEUR"]))
    n23 = 0
    for d, v in by.items():
        if len(v) >= 23: s[d] = sum(v) / len(v); n23 += 1
    return s, n23

def window_normal(series, years, half=7):
    out = []
    for md in MD:
        vals = []
        for y in years:
            m, d = int(md[:2]), int(md[3:])
            if (m, d) == (2, 29) and y % 4: m, d = 2, 28
            c = D(y, m, d)
            for k in range(-half, half + 1):
                v = series.get((c + dt.timedelta(k)).isoformat())
                if v is not None: vals.append(v)
        out.append(round(sum(vals) / len(vals), 2) if len(vals) >= 10 * len(years) else None)
    return out

def gen(country, col):
    s = {}
    for y in GY:
        f = H / "generation" / f"gen_daily_v2_{country}_{y}.csv"
        if not f.exists(): continue
        for r in csv.DictReader(open(f)):
            if r.get(col): s[r["date"][:10]] = float(r[col])
    return s

def ratio_normal(countries, col, capkey, G):
    cap = G["capacity"]
    series = {c: gen(c, col) for c in countries}
    years_ok = [y for y in GY if all(str(y) in cap.get(c, {}) and cap[c][str(y)].get(capkey) for c in countries)]
    def lf(day):
        y = str(day.year); tot = 0.0
        for c in countries:
            v = series[c].get(day.isoformat())
            if v is None: return None
            tot += v
        return tot / sum(cap[c][y][capkey] for c in countries) * 100
    per_year = {}
    for y in years_ok:
        ser = {}
        d = D(y, 1, 1)
        while d.year == y:
            w = [lf(d - dt.timedelta(k)) for k in range(30)]
            w = [x for x in w if x is not None and (d - dt.timedelta(29)).year >= 2015]
            if len(w) >= 25 and all((d - dt.timedelta(k)).year in years_ok for k in range(30)): ser[d.strftime("%m-%d")] = sum(w) / len(w)
            d += dt.timedelta(1)
        per_year[y] = ser
    out, used = [], set()
    for md in MD:
        vals = [(y, per_year[y][md]) for y in years_ok if md in per_year[y]]
        if md == "02-29": vals = [(y, per_year[y].get("02-28")) for y in years_ok if per_year[y].get("02-28") is not None]
        used |= {y for y, _ in vals}
        out.append(round(sum(v for _, v in vals) / len(vals), 2) if len(vals) >= 5 else None)
    return out, sorted(used)

G = json.load(open(NV2 / "generation.json"))
sysd, n23 = sys_daily()
prices = {"Nordic": window_normal(sysd, PY)}
for z in ZONES: prices[z] = window_normal(zone_daily(z), PY)
wind, wy = ratio_normal(["SE", "NO", "FI", "DK"], "wind", "wind_mw", G)
nuc, ny = ratio_normal(["SE", "FI"], "nuclear", "nuclear_mw", G)
out = {
    "schema": 1, "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "month_days": MD,
    "prices": {"years": PY, "window_days": 7, "unit": "EUR/MWh", "normal": prices,
               "method": "mean of daily day-ahead averages over date +/-7 days in 2023, 2024 and 2025",
               "sources": {"zones": "ENTSO-E Transparency A44 day-ahead, daily averages (emmi-data nordic-v2/history/prices)",
                           "SYS_2024_2025": "Nord Pool DayAheadPrices daily aggregates (emmi-data nordic-v2/history/prices/sys_YYYY.json)",
                           "SYS_2023": f"Nord Pool system price via Energinet Energi Data Service, dataset Elspotprices, PriceArea SYSTEM, hourly, {n23} days (https://www.energidataservice.dk/tso-electricity/Elspotprices)"}},
    "wind_lf": {"years": wy, "unit": "%", "normal_30d": wind,
                "method": "Nordic (SE+NO+FI+DK) wind output over that year's installed wind capacity, trailing 30-day mean, averaged over the years listed for the same calendar day",
                "sources": "ENTSO-E A75 and Energinet output; ENTSO-E A68 installed capacity (emmi-data nordic-v2 history and generation.json capacity)"},
    "nuclear_avail": {"years": ny, "unit": "% of installed", "normal_30d": nuc,
                      "method": "SE+FI nuclear output over that year's installed nuclear capacity, trailing 30-day mean, same calendar day, years listed",
                      "sources": "ENTSO-E A75 output and A68 installed capacity"},
}
OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
i = MD.index("11-18")
print("SYS 2023 days", n23, "| 11-18 normals: SYS", prices["Nordic"][i], "SE3", prices["SE3"][i], "| wind", wind[MD.index("11-17")], wy, "| nuc", nuc[MD.index("11-17")], ny)
