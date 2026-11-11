#!/usr/bin/env python3
"""Parallel, numbers-only Pulse. Never emails, logs reported stories, or calls an LLM."""
import argparse, contextlib, datetime as dt, hashlib, json, math, os, re, subprocess, sys
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo
ROOT = Path(os.environ.get("BRIEF_ROOT", "/workspace/brief")).resolve()
sys.path.insert(0, str(ROOT))
ZRH = ZoneInfo("Europe/Zurich")
from pulse_status import write as write_status
from mark_policy import permitted, date_label, FredRetry
MASTER = ROOT / "master/market_pulse_weekday_master_v1.3.1"

def dump(path, value):
    path.write_text(json.dumps(value, indent=2, default=str, ensure_ascii=False))

def master_check():
    readme = (ROOT / "master/README.md").read_text()
    if "market_pulse_weekday_master_v1.3.1: CURRENT, LATEST VERSION" not in readme:
        raise RuntimeError("Locked-master pointer changed; review the new in/out list before running")
    subprocess.run(["sha256sum", "-c", "SHA256SUMS"], cwd=MASTER, check=True, stdout=subprocess.DEVNULL)
    for p in (MASTER / "code").glob("*.py"):
        target = next((ROOT / d / p.name for d in ("kinds", "lib", "edits") if (ROOT / d / p.name).exists()), None)
        if not target or hashlib.sha256(p.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise RuntimeError(f"Locked code differs: {p.name}; review instead of rebuilding the layout")

def build(day, out):
    from kinds import pulse, daily
    from lib import common, daily_blocks as DB, weekly_blocks as W, sections as S, nordic_panel, nordic_nuclear, gasdata, risk_gauge as RG
    from sources import nordpool, oilgas, macro
    from bs4 import BeautifulSoup
    master_check()
    common.setup_logging("pulse_auto", day.isoformat())
    common.GAPS.clear()
    # No writes to the normal out/pulse tree, editorial, sent records or inflation-seen cache.
    os.environ["BRIEF_COVERED"] = "off"  # The parallel numbers edition always carries the complete last-close board, even Monday.
    os.environ.pop("BRIEF_LIVE_SYMS", None)
    os.environ.pop("BRIEF_RISK_TRIGGER", None)
    captured, used = {}, set()
    from lib import daily_rules
    required_close = daily_rules.last_session(day).isoformat()
    fred_retry = FredRetry(macro.fred_series, common.log)
    risk_fragments = []
    label_sources = {}
    def remember(label, date):
        if date and str(date)[:10] < required_close:
            label_sources[label] = str(date)[:10]
    def annotate_risk(fn):
        def call(info, *a, **kw):
            result = fn(info, *a, **kw)
            notes = []
            for key,g in info["gauges"].items():
                dl = g.get("dl")
                if dl and dl < required_close:
                    remember("risk " + key, dl)
                    notes.append(g["lab"] + " · " + date_label(dl))
            if notes: result += '<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:14px;color:#9ca3af">' + daily.H.esc("; ".join(notes)) + '</div>'
            risk_fragments.append(result)
            return result
        return call
    def capture(key, fn):
        def call(*a, **kw):
            result = fn(*a, **kw)
            captured[key] = result
            return result
        return call
    def board(*a, **kw):
        result = original_collect(*a, **kw)
        captured["board"] = result[0]  # add_extras mutates this same board later
        return result
    def row(fn):
        def call(B, keys, *a, **kw):
            used.update(keys)
            result = fn(B, keys, *a, **kw)
            valid_keys = [k for k in keys if k in B]
            for item,key in zip(result,valid_keys):
                b = B[key]; dl=b.get("dl")
                if dl and dl < required_close and permitted(b.get("label",key),required_close,key,b) < required_close:
                    item["note"] = date_label(dl)
                    remember(b.get("label",key),dl)
            if any(x.get("note") for x in result):
                for item in result:item["note"] = item.get("note") or "\u00a0"
            return result
        return call
    def unusual(B, exclude=(), zmin=2., n=6):
        used.update([k for k in S.pick_movers(B, 40, zmin=zmin) if not k.startswith(("co_", "stk_")) and k not in exclude][:n])
        return original_unusual(B, exclude, zmin, n)
    original_collect, original_unusual = daily.collect, DB.unusual
    empty_news = dict(counts={}, stories=[], top="", ed_cards="", news="")
    with contextlib.ExitStack() as stack:
        for obj, name, value in (
            (daily, "collect", board), (DB, "news", lambda *a, **k: empty_news),
            (macro, "fred_series", fred_retry),
            (RG, "strip", annotate_risk(RG.strip)), (RG, "full", annotate_risk(RG.full)),
            (DB, "fresh_prints", lambda *a, **k: []), (DB, "unusual", unusual),
            (W, "_row", row(W._row)), (W, "_eq_row", row(W._eq_row)),
            (nordic_panel, "build", capture("nordic", nordic_panel.build)),
            (nordic_nuclear, "build", capture("nuclear", nordic_nuclear.build)),
            (nordpool, "daily", capture("power", nordpool.daily)),
            (oilgas, "GAS_URL", oilgas.GAS_URL.replace("/emmi/live-data/", "/emmi-data/live-data/")),
            (gasdata, "GAS_RAW", gasdata.GAS_RAW.replace("/emmi/live-data/", "/emmi-data/live-data/")),
        ):
            stack.enter_context(patch.object(obj, name, value))
        data = pulse.collect(day, out)
        # Mark's 11 Nov weekday rule; Jerry approved it at 07:20 Zurich, card t1089s3453.
        energy_notes=[]
        for area,st in (data.get("gas",{}).get("storage") or {}).items():
            dl=st.get("date")
            if dl and dl<required_close:
                remember("Gas storage " + area,dl);energy_notes.append(area + " gas storage · " + date_label(dl))
        dl=(data.get("gas",{}).get("curve") or {}).get("asof")
        if dl and dl<required_close:
            remember("TTF curve",dl);energy_notes.append("TTF curve · " + date_label(dl))
        if energy_notes:
            for section in data["sections"]:
                if section["id"]=="energy": section["body"].append(daily.H.note(daily.H.esc("; ".join(energy_notes))))
        # Existing section renderers + v1.3.1 layout; no news or old editorial is recycled.
        data["sections"] = [s for s in data["sections"] if s["id"] in ("monitor", "risk", "maps", "energy", "power", "calendar")]
        ed = dict(headline="Market Pulse · numbers-only pilot", intro="COMMENTARY SLOT · intentionally empty in this pilot. Top 5 reads and News by topic await the commentary stage.")
        stamp = f"Prices: {data['d1']} close (latest completed session); built {dt.datetime.now(ZRH):%a %d %b %Y %H:%M} Zurich. Source dates are checked before publication."
        data["pre"].append(daily.H.note(daily.H.esc(stamp)))
        doc, subject, imgs = pulse.render(day, out, data, ed)
    used.update(("spx", "sxxp", "us10", "brent", "eurusd", "gold", "brent2", "ho", "rb", "wti", "dcrack", "c321", "gocrack"))
    # Approved 11 Nov rule: strict headline closes/power; named lagging series <=1 Pulse business day.
    # Jerry: Yes, use the one-day-lag rule (07:20 Zurich), answered card t1089s3453.
    # See mark_policy.py and freshness-rule-audit.md. Locked v1.3.1 master (v1.3 + 600px PNGs on disk).
    expected = data["d1"]
    failures, observations = [], []
    def check(label, date, ok=True, required=expected, board_key=None, board=None):
        minimum=permitted(label,required,board_key,board)
        date = str(date)[:10] if date is not None else None
        observations.append(dict(item=label, asof=date, required=required, minimum_permitted=minimum, complete=bool(ok)))
        if date and date<required:remember(label,date)
        if not ok or not date or date < minimum or date > day.isoformat():
            failures.append(f"{label}: last timestamp {date or 'missing'}, minimum permitted {minimum} (required close {required}); complete={bool(ok)}")
    for key in sorted(used):
        b = captured.get("board", {}).get(key, {})
        check(b.get("label", key), b.get("dl"), b.get("last") is not None and b.get("chg") is not None, board_key=key, board=b)
    rg = json.loads((out / "risk_gauge.json").read_text()) if (out / "risk_gauge.json").exists() else {}
    allowed_risk_gaps=[]
    footer_text=BeautifulSoup(data["footer"],"html.parser").get_text(" ",strip=True)
    for key, gauge in rg.get("gauges", {}).items():
        if gauge.get("last") is None and f"Risk gauge {gauge.get('lab')}: no data" in footer_text:
            # Exception only when the unmodified locked footer actually names this exact missing input.
            allowed_risk_gaps.append(key)
            observations.append(dict(item="risk "+key,asof=None,complete=False,locked_gap_note=True))
        else:check("risk " + key, gauge.get("dl"), gauge.get("last") is not None)
    for key, breadth in rg.get("breadth", {}).items():
        check("risk breadth " + key, (breadth or {}).get("asof"), bool(breadth))
    if not rg: failures.append("Risk strip missing")
    npd = captured.get("power")
    for d in (day, day - dt.timedelta(days=1)):
        cols = daily.CLOUDBERRY
        valid = npd is not None and str(d) in npd.index.astype(str) and all(c in npd.columns and not math.isnan(float(npd.loc[str(d), c])) for c in cols)
        check("Nord Pool delivery " + str(d), d, valid, str(d))
    check("Nordic wind/hydro MTD", captured.get("nordic", {}).get("through"), bool(captured.get("nordic")))
    nuc = captured.get("nuclear", {})
    check("Nordic nuclear MTD", nuc.get("nuclear", {}).get("through"), bool(nuc.get("nuclear")))
    if nuc.get("online_error") or not nuc.get("online"): failures.append("Nordic nuclear online availability missing")
    if nuc.get("nuclear_error"): failures.append("Nordic nuclear generation missing")
    for area, storage in (data.get("gas", {}).get("storage") or {}).items():
        check("Gas storage " + area, storage.get("date"), storage.get("full") is not None)
    cv = data.get("gas", {}).get("curve") or {}
    check("TTF curve", cv.get("asof"), bool(cv.get("curve")))
    for png in ("oil.png", "treemaps.png", "gas_storage.png", "ttf_curve.png", "nordic.png", "nordic_nuclear.png"):
        if not (out / png).exists(): failures.append("Required chart missing: " + png)
    sections = [s["id"] for s in data["sections"]]
    for sid in ("monitor", "maps", "energy", "power", "calendar"):
        if sid not in sections: failures.append("Required master section missing: " + sid)
    power_body = "".join(next((s["body"] for s in data["sections"] if s["id"] == "power"), []))
    if not re.search(r'cid:nordic.png.*cid:nordic_nuclear.png', power_body, re.S): failures.append("Nuclear panel not directly after wind/hydro")
    if "<style" in doc or " class=" in doc: failures.append("Master requires fully inline styles")
    soup = BeautifulSoup(doc, "html.parser")
    text = soup.get_text(" ", strip=True)
    nongauge=doc
    for fragment in risk_fragments:nongauge=nongauge.replace(fragment,"")
    placeholder_text=BeautifulSoup(nongauge,"html.parser").get_text(" ",strip=True)
    if re.search(r"\bn/a\b|\bNaN\b|\bTBD\b", placeholder_text, re.I): failures.append("Rendered edition has a missing-data placeholder (see email.txt)")
    for table in soup.find_all("table"):
        if not table.get_text(strip=True) and not table.find("img") and not table.find("svg"):
            # Locked sparkline/range bars are presentation tables with real coloured geometry, not empty datasets.
            visual = table.get("role") == "presentation" and any("background:" in e.get("style", "") and re.search(r"height:[1-9]\d*px", e.get("style", "")) for e in table.find_all(["td", "div"]))
            if not visual: failures.append("Rendered empty table")
    if "COMMENTARY SLOT" not in text: failures.append("Marked commentary slot missing")
    (out / "email.html").write_text(doc)
    (out / "email.txt").write_text(daily.H.to_text(doc))
    daily.H.cap_out_pngs(out)
    import base64
    attachments = []
    for png in imgs:
        b64 = out / (Path(png).stem + ".b64")
        b64.write_text(base64.b64encode((out / png).read_bytes()).decode())
        attachments.append(dict(path=str(out / png), cid=png, filename=png, mimeType="image/png", b64=str(b64)))
    dump(out / "meta.json", dict(subject=subject, kind="pulse_auto", run_date=str(day), html=str(out / "email.html"), text=str(out / "email.txt"), attachments=attachments, send_note="Not sent. Check validation.json is PASS before handing to Gmail connector. No SMTP."))
    dump(out / "provenance.json", dict(board={k: captured.get("board", {}).get(k) for k in sorted(used)}, nordic=captured.get("nordic"), nuclear=nuc))
    # The approved width checker is part of the gate, not a screenshot-only proxy.
    subprocess.run([sys.executable, str(ROOT / "edits/pulse_v2_width.py"), str(out.resolve())], check=True)
    widths = json.loads((out / "_width.json").read_text())
    for name, result in widths.items():
        if result["sw"] != result["vw"] or result["n"]: failures.append("Phone overflow: " + name)
    # Static HTML cap (11 Nov 2026, Jerry): every image max-width:100%; no fixed width above the 600px column.
    # This is what makes the phone-width rule stick when a mail app ignores CSS and the Chrome check would still pass.
    for f in daily.H.column_width_failures(doc):
        failures.append("Column width: " + f)
    for f in daily.H.png_width_failures(out, imgs):
        failures.append("PNG width: " + f)
    report = dict(status="HELD" if failures else "PASS", policy_approval_required=False, policy_authorization_card="t1089s3453", as_of_labels=label_sources, allowed_risk_gaps=allowed_risk_gaps, fred_attempts=fred_retry.attempts, master=MASTER.name, run_date=str(day), last_close=expected, built_at=dt.datetime.now(ZRH).isoformat(),
                  failures=list(dict.fromkeys(failures)), observations=observations, gaps=common.GAPS, images=imgs,
                  exceptions=["Commentary, Top 5 reads and News by topic intentionally empty/absent: numbers-only pilot requested by Jerry", "No bot/LLM calls; no email; existing Pulse remains unchanged"], width_checks=widths)
    (out / "checklist.md").write_text("# Pulse numbers-only pilot\n\n" + (MASTER / "MASTER.md").read_text() + "\n\n# Pilot validation\n" + json.dumps(report, indent=2, default=str))
    # Web version uses precisely the email layout and PNGs, not a rebuilt page.
    public = doc.replace('src="cid:', f'src="/emmi/pulse/{day}/').replace("</head>", '<meta name="robots" content="noindex,nofollow"></head>')
    (out / "index.html").write_text(public)
    report["artifacts"] = {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for name in ["index.html"] + imgs}
    dump(out / "validation.json", report)
    if not failures: (out / "CHECK_PASS").write_text(hashlib.sha256((out / "validation.json").read_bytes()).hexdigest() + "\n")
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=str(dt.datetime.now(ZRH).date()))
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    out = None
    try:
        day = dt.date.fromisoformat(a.date)
        if day != dt.datetime.now(ZRH).date(): raise ValueError("Refusing a historical date in the live auto pipeline")
        if day.weekday() > 4: raise ValueError("Weekday pilot: no weekend publication")
        write_status("building", None, [], publish_requested=a.publish, run_date=str(day))
        if a.publish:
            from publish import existing_publication
            existing = existing_publication(day)
            if existing:
                write_status("published", 0, ["Today's immutable edition already exists; no rebuild, PR, or email"], run_date=str(day), **existing)
                return 0
        out = ROOT / "out/pulse_auto" / str(day) / dt.datetime.now(ZRH).strftime("%H%M%S-%f")
        out.mkdir(parents=True, exist_ok=False)
        report = build(day, out)
        if report["status"] != "PASS":
            write_status("held", 2, report["failures"], output_dir=str(out), run_date=str(day), publish_requested=a.publish,
                         rule_audit="Jerry approved one-business-day rule 11 Nov 07:20 Zurich; card t1089s3453")
            print(json.dumps(dict(out=str(out), status="held", failures=report["failures"]), indent=2))
            return 2
        if not a.publish:
            write_status("ready", 0, [], output_dir=str(out), run_date=str(day), publish_requested=False, as_of_labels=report["as_of_labels"])
            print(json.dumps(dict(out=str(out), status="ready", as_of_labels=report["as_of_labels"])))
            return 0
        result = subprocess.run([sys.executable, str(Path(__file__).with_name("publish.py")), str(out)])
        if result.returncode: raise RuntimeError(f"Publisher failed with exit {result.returncode}; inspect its log/PR before retrying")
        pub = json.loads((out / "publication.json").read_text())
        write_status("published", 0, [], output_dir=str(out), run_date=str(day), as_of_labels=report["as_of_labels"], allowed_risk_gaps=report["allowed_risk_gaps"], **pub)
        return 0
    except Exception as exc:
        from lib.common import redact
        reason = redact(exc)
        if out: dump(out / "failure.json", dict(status="HELD", failures=[reason]))
        write_status("held", 1, [reason], output_dir=str(out) if out else None, publish_requested=a.publish)
        print(reason, file=sys.stderr)
        return 1
if __name__ == "__main__": sys.exit(main())
