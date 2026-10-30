"""Event returns, method v1 (release-timing rule), side by side with the stored old values (v0, labelled).
v1: base = last close BEFORE the announcement. If released before/within the session of a trading day D,
day 1 = D; if after the close, unknown time (assumed) or on a non-trading day, day 1 = next session.
rN = stock(day N close / base) - index(same dates), in %, N = 1, 5, 20, 60 trading days.
v0_recalc = v0 rule (day 1 = first close on/after event date, base = prior close) on the same prices,
so a v1-vs-v0 gap can be split into 'timing' and 'data' parts.
Usage: compute_returns.py PRICEDIR"""
import sys, datetime as dt, json, bisect
from zoneinfo import ZoneInfo
from rcommon import *
PD = sys.argv[1]
P = {p["listing_id"]: p for p in rcsv(os.path.join(RES, "pilot.csv"))}
RT = {r["event_id"]: r for r in rcsv(os.path.join(RES, "release_times.csv"))}
def series(name):
    f = os.path.join(PD, name.replace(":", "_").replace("^", "") + ".csv")
    if not os.path.exists(f): return None
    rows = rcsv(f); return [r["date"] for r in rows], [float(r["close"]) for r in rows]
def ret(dates, px, i0, n, idx):
    j = i0 + n - 1 if i0 is not None else None
    if i0 is None or i0 < 1 or j >= len(dates): return None
    s = px[j] / px[i0 - 1] - 1
    di, ip = idx; a = bisect.bisect_right(di, dates[i0 - 1]) - 1; b = bisect.bisect_right(di, dates[j]) - 1
    if a < 0 or b < 0: return None
    return round(100 * (s - (ip[b] / ip[a] - 1)), 2)
out = []
for e in rcsv(os.path.join(RES, "pilot_events.csv")):
    p = P[e["listing_id"]]; s = series(e["listing_id"]); ix = series("INDEX:" + p["benchmark"])
    r = RT.get(e["event_id"], {}); tz, op, cl = SESSION[p["mic"]]
    row = dict(event_id=e["event_id"], company_id=e["company_id"], listing_id=e["listing_id"], date=e["date"],
               release_time=r.get("release_time", ""), time_basis=r.get("time_basis", "assumed"),
               benchmark=p["benchmark"], v0_method=e["v0_method"], v0_r5=e["v0_r5"], v0_r20=e["v0_r20"], v0_r60=e["v0_r60"])
    if not s or not ix: row["note"] = "no prices"; out.append(row); continue
    d, px = s
    # v0 recalculated: first session on/after the event date
    i_v0 = bisect.bisect_left(d, e["date"]); i_v0 = i_v0 if i_v0 < len(d) else None
    # v1: decide session
    if r.get("release_time"):
        t = dt.datetime.fromisoformat(r["release_time"]).astimezone(ZoneInfo(tz))
        ld, hm = str(t.date()), t.strftime("%H:%M"); session = "pre-open" if hm < op else ("intraday" if hm < cl else "after-close")
    else:
        ld, session = e["date"], "after-close (assumed)"
    i = bisect.bisect_left(d, ld)
    if i < len(d) and d[i] == ld and session.startswith("after"): i += 1   # counts from next session
    i_v1 = i if i < len(d) else None
    row.update(v0_day1=d[i_v0] if i_v0 is not None else "", session=session, v1_day1=d[i_v1] if i_v1 is not None else "", v1_base_date=d[i_v1 - 1] if i_v1 else "")
    for n in (1, 5, 20, 60):
        row[f"v1_r{n}"] = ret(d, px, i_v1, n, ix)
    for n in (5, 20, 60):
        row[f"v0recalc_r{n}"] = ret(d, px, i_v0, n, ix)
    out.append(row)
os.makedirs(OUT, exist_ok=True)
F = ["event_id","company_id","listing_id","date","release_time","time_basis","session","v1_base_date","v1_day1","v0_day1","benchmark",
     "v1_r1","v1_r5","v1_r20","v1_r60","v0_method","v0_r5","v0_r20","v0_r60","v0recalc_r5","v0recalc_r20","v0recalc_r60","note"]
wcsv(os.path.join(OUT, "event_returns.csv"), [{k: ("" if x.get(k) is None else x.get(k, "")) for k in F} for x in out], F)
json.dump(dict(method="v1_release_timing", old_method_kept=["v0_eventday_close", "v0_pilot_excess"],
               rule=__doc__.split("Usage")[0].strip(), price_source="Yahoo chart v8 daily close (split-adjusted, not dividend-adjusted)",
               generated_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), events=out),
          open(os.path.join(OUT, "event_returns.json"), "w"), ensure_ascii=False, separators=(",", ":"))
# chart file for the site's company charts: one compact record per pilot company (headline, source, release time
# and basis, v1 returns only), fetched by the browser only when a company chart opens. syms = every Yahoo symbol
# of the company's listings, so a company EMMA shows on another exchange still gets its markers.
PE = {e["event_id"]: e for e in rcsv(os.path.join(RES, "pilot_events.csv"))}
LS = rcsv(os.path.join(IDS, "listings.csv")); CH = {}
for x in sorted(out, key=lambda x: (x["date"], x["event_id"])):
    p = P[x["listing_id"]]; e = PE[x["event_id"]]
    c = CH.setdefault(x["company_id"], dict(name=p["name"], ly=p["yahoo"], bench=p["benchmark_name"], ev=[],
        syms=sorted({l["yahoo"] for l in LS if l["company_id"] == x["company_id"] and l["yahoo"]} | {p["yahoo"]})))
    c["ev"].append(dict(id=x["event_id"], d=x["date"], t=x["release_time"], b=x["time_basis"], s=x.get("session", ""),
                        h=e["headline"], u=e["source_url"], d1=x.get("v1_day1", ""),
                        **{f"r{n}": x.get(f"v1_r{n}") for n in (1, 5, 20, 60)}))
json.dump(dict(method="v1_release_timing", generated_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
               price_source="Yahoo daily closes", companies=CH),
          open(os.path.join(OUT, "chart_events.json"), "w"), ensure_ascii=False, separators=(",", ":"))
# reconciliation: material = |v1 - v0| > 5 pp on the 20-day horizon (or 5-day where 20 missing)
def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None
mat, n_cmp = [], 0
for x in out:
    a, b = f(x.get("v1_r20")), f(x["v0_r20"])
    if a is None or b is None: continue
    n_cmp += 1
    if abs(a - b) > 5:
        c = f(x.get("v0recalc_r20")); why = []
        if x.get("v1_day1") != x.get("v0_day1"): why.append("timing: after-close/assumed, day 1 moved to next session")
        if c is not None and abs(c - b) > 3: why.append(f"data/method: same-rule recalc {c:+.1f} vs stored {b:+.1f}")
        if x["v0_method"] == "v0_pilot_excess": why.append("old pilot measure (excess_20d) used a different base/benchmark")
        mat.append((x, a, b, "; ".join(why) or "small timing + price differences combined"))
L = ["# Event returns: v1 vs old stored values (v0) — reconciliation", "",
     f"Generated {dt.date.today()} for the 30 pilot companies. v1 = release-timing rule; v0 kept unchanged in the same table, labelled by method.",
     f"Compared on 20 sessions: {n_cmp} events with both values; material difference (> 5 percentage points): {len(mat)}.", "",
     "| Event | Listing | Date | Timing | v1 r20 | v0 r20 | Main reason |", "|---|---|---|---|---|---|---|"]
for x, a, b, why in sorted(mat, key=lambda t: -abs(t[1] - t[2])):
    L.append(f"| {x['event_id']} | {x['listing_id']} | {x['date']} | {x.get('session','')} | {a:+.1f} | {b:+.1f} | {why} |")
open(os.path.join(OUT, "reconciliation.md"), "w").write("\n".join(L) + "\n")
print(len(out), "events;", n_cmp, "compared;", len(mat), "material")
