"""Freeze every current Moonshot event / upcoming id (they double as .ics UIDs).
Reads the read-only copy in research/source/moonshot, writes merge/ids/event_id_map.csv.
Policy: new_id == old_id for everything that exists today; ids are never recomputed from text,
dates or list position again. Run once; re-running only ADDS ids not already in the map."""
import csv, json, os, re, sys
SRC = "research/source/moonshot/"; OUT = "merge/ids/event_id_map.csv"
idmap = {}
for r in csv.DictReader(open("merge/ids/id_map.csv", newline="")):
    if r["system"] in ("moonshot.screen.code", "moonshot.pilot.ticker"):
        idmap.setdefault(r["old_id"], (r["company_id"], r["listing_id"]))
rows = {}
def add(i, kind, f, code="", date=""):
    if not i or i in rows: return
    cid, lid = idmap.get(code, ("", ""))
    rows[i] = dict(old_id=i, new_id=i, kind=kind, source_file=f, company_code=code, company_id=cid,
                   listing_id=lid, date=date, ics_uid="", ics_file="", frozen_at="2026-10-30")
def walk(o, f, code=""):
    if isinstance(o, dict):
        code = o.get("code") or o.get("company_code") or code
        if isinstance(o.get("id"), str):
            i = o["id"]; kind = {"E": "past", "P": "pilot", "N": "norway"}.get(i[:1], "upcoming")
            if i.startswith("NO"): kind = "norway"
            add(i, kind, f, code if kind != "norway" else "", o.get("date") or o.get("anchor") or o.get("sort_date") or "")
        for v in o.values(): walk(v, f, code)
    elif isinstance(o, list):
        for v in o: walk(v, f, code)
for f in ("smallcaps.json", "coming_up.json", "norway_events.json", "read_across.json", "slipped.json"):
    walk(json.load(open(SRC + f)), f)
for r in csv.DictReader(open(SRC + "events.csv", newline="")):
    add(r["id"], "pilot", "events.csv", r["ticker"], r["date"])
for f in ("coming_up.ics", "norway_events.ics"):
    for u in re.findall(r"UID:(.*?)\r?\n", open(SRC + f, newline="").read()):
        base = u.replace("@moonshot", "").replace("-moonshot-norway", "")
        key = base if base in rows else ("N-" + base if "N-" + base in rows else base)
        if key not in rows: add(key, "ics-only", f)
        rows[key]["ics_file"] = (rows[key]["ics_file"] + ";" if rows[key]["ics_file"] else "") + f
        rows[key]["ics_uid"] = (rows[key]["ics_uid"] + ";" if rows[key]["ics_uid"] else "") + u
if os.path.exists(OUT):   # add-only
    old = {r["old_id"]: r for r in csv.DictReader(open(OUT, newline=""))}
    for k, v in rows.items(): old.setdefault(k, v)
    rows = old
w = csv.DictWriter(open(OUT, "w", newline=""), list(next(iter(rows.values())).keys()))
w.writeheader(); w.writerows(sorted(rows.values(), key=lambda r: (r["kind"], r["old_id"])))
from collections import Counter
print(len(rows), Counter(r["kind"] for r in rows.values()), "with ics uid:", sum(1 for r in rows.values() if r["ics_uid"]))
