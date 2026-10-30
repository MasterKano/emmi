"""Check the published calendar feeds: CRLF line endings only, one VCALENDAR, no duplicate UIDs.
UIDs not in merge/ids/event_id_map.csv are reported (new events), never renumbered. Usage: check_ics.py FILE..."""
import csv, sys
frozen = {r["ics_uid"] for r in csv.DictReader(open("merge/ids/event_id_map.csv")) if r["ics_uid"]}
bad = 0
for p in sys.argv[1:]:
    b = open(p, "rb").read()
    lf = b.count(b"\n"); crlf = b.count(b"\r\n")
    t = b.decode("utf-8")
    uids = [l[4:] for l in t.split("\r\n") if l.startswith("UID:")]
    errs = []
    if lf != crlf: errs.append(f"{lf - crlf} bare LF line endings")
    if not t.startswith("BEGIN:VCALENDAR\r\n") or not t.rstrip("\r\n").endswith("END:VCALENDAR"): errs.append("not one VCALENDAR")
    if t.count("BEGIN:VEVENT") != len(uids): errs.append("VEVENT without UID")
    if len(uids) != len(set(uids)): errs.append("duplicate UIDs")
    new = [u for u in uids if u not in frozen]
    print(f"{p}: {len(uids)} events, {len(new)} UIDs not in the frozen map" + ("; ERROR: " + ", ".join(errs) if errs else ""))
    bad += bool(errs)
sys.exit(1 if bad else 0)
