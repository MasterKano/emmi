#!/usr/bin/env python3
"""Parallel, numbers-only Pulse. Never emails, logs reported stories, or calls an LLM."""
import argparse, contextlib, datetime as dt, hashlib, json, math, os, re, subprocess, sys
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo
ROOT = Path(os.environ.get("BRIEF_ROOT", "/workspace/brief")).resolve()
sys.path.insert(0, str(ROOT))
ZRH = ZoneInfo("Europe/Zurich")
MASTER = ROOT / "master/market_pulse_weekday_master_v1.2"

def dump(path, value):
    path.write_text(json.dumps(value, indent=2, default=str, ensure_ascii=False))

def master_check():
    readme = (ROOT / "master/README.md").read_text()
    if "market_pulse_weekday_master_v1.2: CURRENT, LATEST VERSION" not in readme:
        raise RuntimeError("Locked-master pointer changed; review the new in/out list before running")
    subprocess.run(["sha256sum", "-c", "SHA256SUMS"], cwd=MASTER, check=True, stdout=subprocess.DEVNULL)
    for p in (MASTER / "code").glob("*.py"):
        target = next((ROOT / d / p.name for d in ("kinds", "lib", "edits") if (ROOT / d / p.name).exists()), None)
        if not target or hashlib.sha256(p.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise RuntimeError(f"Locked code differs: {p.name}; review instead of rebuilding the layout")

def build(day, out):
    from kinds import pulse, daily
    from lib import common, daily_blocks as DB, weekly_blocks as W, sections as S, nordic_panel, nordic_nuclear, gasdata, risk_gauge as RG
    from sources import nordpool, oilgas
    from bs4 import BeautifulSoup
    master_check()
    common.setup_logging("pulse_auto", day.isoformat())
    common.GAPS.clear()
    # No writes to the normal out/pulse tree, editorial, sent records or inflation-seen cache.
    os.environ["BRIEF_COVERED"] = "off"  # The parallel numbers edition always carries the complete last-close board, even Monday.
    os.environ.pop("BRIEF_LIVE_SYMS", None)
    os.environ.pop("BRIEF_RISK_TRIGGER", None)
    captured, used = {}, set()
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
            return fn(B, keys, *a, **kw)
        return call
    def unusual(B, exclude=(), zmin=2., n=6):
        used.update([k for k in S.pick_movers(B, 40, zmin=zmin) if not k.startswith(("co_", "stk_")) and k not in exclude][:n])
        return original_unusual(B, exclude, zmin, n)
    original_collect, original_unusual = daily.collect, DB.unusual
    empty_news = dict(counts={}, stories=[], top="", ed_cards="", news="")
    with contextlib.ExitStack() as stack:
        for obj, name, value in (
            (daily, "collect", board), (DB, "news", lambda *a, **k: empty_news),
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
        # Existing section renderers + v1.2 layout; no news or old editorial is recycled.
        data["sections"] = [s for s in data["sections"] if s["id"] in ("monitor", "risk", "maps", "energy", "power", "calendar")]
        ed = dict(headline="Market Pulse · numbers-only pilot", intro="COMMENTARY SLOT · intentionally empty in this pilot. Top 5 reads and News by topic await the commentary stage.")
        stamp = f"Prices: {data['d1']} close (latest completed session); built {dt.datetime.now(ZRH):%a %d %b %Y %H:%M} Zurich. Source dates are checked before publication."
        data["pre"].append(daily.H.note(daily.H.esc(stamp)))
        doc, subject, imgs = pulse.render(day, out, data, ed)
    used.update(("spx", "sxxp", "us10", "brent", "eurusd", "gold", "brent2", "ho", "rb", "wti", "dcrack", "c321", "gocrack"))
    expected = data["d1"]
    failures, observations = [], []
    def check(label, date, ok=True, required=expected):
        date = str(date)[:10] if date is not None else None
        observations.append(dict(item=label, asof=date, required=required, complete=bool(ok)))
        if not ok or not date or date < required or date > day.isoformat():
            failures.append(f"{label}: last timestamp {date or 'missing'}, required {required}; complete={bool(ok)}")
    for key in sorted(used):
        b = captured.get("board", {}).get(key, {})
        check(b.get("label", key), b.get("dl"), b.get("last") is not None and b.get("chg") is not None)
    rg = json.loads((out / "risk_gauge.json").read_text()) if (out / "risk_gauge.json").exists() else {}
    for key, gauge in rg.get("gauges", {}).items():
        check("risk " + key, gauge.get("dl"), gauge.get("last") is not None)
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
    if re.search(r"\bn/a\b|\bNaN\b|\bTBD\b", text, re.I): failures.append("Rendered edition has a missing-data placeholder (see email.txt)")
    for table in soup.find_all("table"):
        if not table.get_text(strip=True) and not table.find("img") and not table.find("svg"):
            # Locked sparkline/range bars are presentation tables with real coloured geometry, not empty datasets.
            visual = table.get("role") == "presentation" and any("background:" in e.get("style", "") and re.search(r"height:[1-9]\d*px", e.get("style", "")) for e in table.find_all(["td", "div"]))
            if not visual: failures.append("Rendered empty table")
    if "COMMENTARY SLOT" not in text: failures.append("Marked commentary slot missing")
    (out / "email.html").write_text(doc)
    (out / "email.txt").write_text(daily.H.to_text(doc))
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
    report = dict(status="HELD" if failures else "PASS", master=MASTER.name, run_date=str(day), last_close=expected, built_at=dt.datetime.now(ZRH).isoformat(),
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
    day = dt.date.fromisoformat(a.date)
    if day != dt.datetime.now(ZRH).date(): sys.exit("Refusing a historical date in the live auto pipeline")
    if day.weekday() > 4: sys.exit("Weekday pilot: no weekend publication")
    out = ROOT / "out/pulse_auto" / str(day) / dt.datetime.now(ZRH).strftime("%H%M%S")
    out.mkdir(parents=True, exist_ok=False)
    try:
        report = build(day, out)
    except Exception as exc:
        from lib.common import redact
        dump(out / "validation.json", dict(status="HELD", failures=[redact(exc)]))
        raise
    print(json.dumps(dict(out=str(out), status=report["status"], failures=report["failures"]), indent=2))
    if report["status"] != "PASS": sys.exit(2)
    if a.publish:
        subprocess.run([sys.executable, str(Path(__file__).with_name("publish.py")), str(out)], check=True)
if __name__ == "__main__": main()
