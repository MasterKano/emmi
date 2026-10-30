"""Publish check for research outputs. Exit 1 = do not publish (the last good version stays live).
Checks: unique event ids; ids exist in the frozen map; valid ISO dates; release-time basis valid;
prices positive with valid, strictly increasing dates; returns finite."""
import sys, re, json, math, datetime as dt
from rcommon import *
PD = sys.argv[1]; errs = []
frozen = {r["old_id"] for r in rcsv(os.path.join(IDS, "event_id_map.csv"))}
def date_ok(s):
    try: dt.date.fromisoformat(s); return True
    except Exception: return False
ev = rcsv(os.path.join(OUT, "event_returns.csv")); ids = [e["event_id"] for e in ev]
if len(ids) != len(set(ids)): errs.append("duplicate event ids")
errs += [f"{i}: not in frozen id map" for i in ids if i not in frozen]
errs += [f"{e['event_id']}: bad date {e['date']}" for e in ev if not date_ok(e["date"])]
errs += [f"{e['event_id']}: bad time_basis" for e in ev if e["time_basis"] not in ("stated", "recovered", "assumed")]
for e in ev:
    for k in ("v1_r1", "v1_r5", "v1_r20", "v1_r60"):
        if e[k] and not math.isfinite(float(e[k])): errs.append(f"{e['event_id']}: {k} not finite")
for f in sorted(os.listdir(PD)):
    rows = rcsv(os.path.join(PD, f)); last = ""
    for r in rows:
        if not date_ok(r["date"]) or r["date"] <= last: errs.append(f"{f}: bad/unsorted date {r['date']}"); break
        if not float(r["close"]) > 0: errs.append(f"{f}: non-positive price on {r['date']}"); break
        last = r["date"]
    if not rows: errs.append(f"{f}: empty")
if len(os.listdir(PD)) < 30: errs.append(f"only {len(os.listdir(PD))} price series")
json.loads(open(os.path.join(OUT, "event_returns.json")).read())
print("CHECK", "FAIL" if errs else "PASS", f"({len(ev)} events, {len(os.listdir(PD))} series)"); [print(" -", x) for x in errs[:20]]
sys.exit(1 if errs else 0)
