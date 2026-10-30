"""Pilot = the 30 companies in both EMMA and Moonshot's research (shared list in merge/ids, minus the
7 Norway operators/parents that have no research events). Writes research/pilot.csv and
research/pilot_events.csv with the stored (old, v0) returns kept and labelled."""
from rcommon import *
C = rcsv(os.path.join(IDS, "companies.csv")); L = {r["listing_id"]: r for r in rcsv(os.path.join(IDS, "listings.csv"))}
M = {(r["system"], r["old_id"]): r for r in rcsv(os.path.join(IDS, "id_map.csv"))}
pilot = [c for c in C if c["in_moonshot"] == "Y" and c["in_emma"] == "Y" and "norway" not in c["sources"]]
assert len(pilot) == 30, len(pilot)
pid = {c["company_id"] for c in pilot}
sc = {c["code"]: c for c in rjson(os.path.join(SRC, "smallcaps.json"))}
ev, used = [], {}
def listing_for(system, code):
    m = M.get((system, code)); return L[m["listing_id"]] if m and m.get("listing_id") in L else None
for code, c in sc.items():
    li = listing_for("moonshot.screen.code", code)
    if not li or li["company_id"] not in pid: continue
    seg = "XLON:AIM" if c.get("exchange") == "AIM" else ("XLON:MAIN" if li["mic"] == "XLON" else li["mic"])
    used[li["company_id"]] = (li, seg, code)
    for e in c["events"]:
        src = next((s for s in (e.get("sources") or []) if isinstance(s, str) and s.count("/") > 3), "")
        ev.append(dict(event_id=e["id"], company_id=li["company_id"], listing_id=li["listing_id"], date=e["date"],
                       headline=e.get("headline", "")[:160], source_url=src, v0_method="v0_eventday_close",
                       v0_r5=e.get("r5", ""), v0_r20=e.get("r20", ""), v0_r60=e.get("r60", "")))
for r in rcsv(os.path.join(SRC, "events.csv")):
    li = listing_for("moonshot.pilot.ticker", r["ticker"])
    if not li or li["company_id"] not in pid: continue
    used.setdefault(li["company_id"], (li, li["mic"], r["ticker"]))
    ev.append(dict(event_id=r["id"], company_id=li["company_id"], listing_id=li["listing_id"],
                   date=r["announced_date"] or r["date"], headline=r["what_happened"][:160], source_url=r["source_url"],
                   v0_method="v0_pilot_excess", v0_r5="", v0_r20=r["excess_20d"], v0_r60=r["excess_3m"]))
import re, datetime as _d
ev = [e for e in ev if re.fullmatch(r"\d{4}-\d\d-\d\d", e["date"]) and e["date"] <= str(_d.date.today())]
rows = []
for c in pilot:
    li, seg, code = used.get(c["company_id"], (None, "", ""))
    if not li:   # no research events yet: monitor its primary listing
        li = next(l for l in L.values() if l["company_id"] == c["company_id"] and l["yahoo"] and l["primary"] == "Y"); seg = li["mic"]
    b = BENCH[seg]
    rows.append(dict(company_id=c["company_id"], name=c["name"], listing_id=li["listing_id"], yahoo=li["yahoo"], mic=li["mic"],
                     segment=seg, benchmark=b[0], benchmark_name=b[1], moonshot_code=code,
                     events=sum(1 for e in ev if e["company_id"] == c["company_id"])))
pl = {r["company_id"]: r["listing_id"] for r in rows}
for e in ev: e["listing_id"] = pl[e["company_id"]]   # one price listing per company (the research listing)
wcsv(os.path.join(RES, "pilot.csv"), sorted(rows, key=lambda r: r["name"]))
wcsv(os.path.join(RES, "pilot_events.csv"), sorted(ev, key=lambda r: (r["company_id"], r["date"], r["event_id"])))
print(len(rows), "companies,", len(ev), "events")
