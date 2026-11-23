#!/usr/bin/env python3
"""File Markdown special reports into the analysis store and rebuild the search index.

Reads analysis/reports/*.md, checks each company symbol against companies.json,
symbols.json and scripts/universe.py, writes the specials page, and rebuilds:

  specials/editions.json          emailed HTML specials stay in the list
  specials/<id>/                  native report page for each Markdown file
  data/analysis_index.json        specials and data/company_notes, for browser search

It never sends email. One command, from the repo root:

  python3 scripts/editions/publish_analysis.py

To commit the report, the generated pages and the search index, and push straight
to main (only those paths; no email):

  python3 scripts/editions/publish_analysis.py --push -m "File analysis: title"

A company note is still a JSON file under data/company_notes/. Run the same command
after adding or editing one so the search index picks it up.
"""
import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import mdreport  # noqa: E402
import site_pages  # noqa: E402

# Yahoo suffixes for the exchanges in data/symbols.json. Xetra, Paris, SIX and
# Copenhagen are not in that file; those primary listings are named below.
TV_SUFFIX = {
    "NASDAQ": "", "NYSE": "", "AMEX": "", "NYSEARCA": "",
    "OMXSTO": ".ST", "OMXHEX": ".HE", "OMXCOP": ".CO",
    "OSL": ".OL", "LSE": ".L",
    "TSX": ".TO", "TSXV": ".V",
    "MIL": ".MI", "BIT": ".MI",
    "XETR": ".DE", "TASE": ".TA", "ASX": ".AX",
}
# European primary Yahoo symbols outside symbols.json's exchange list.
EXTRA_LISTINGS = {
    "ENR.DE": "Siemens Energy",
    "SU.PA": "Schneider Electric",
    "ABBN.SW": "ABB",
    "NKT.CO": "NKT",
}
PUBLICATION_MD = (
    "Published on this site from the Markdown report in the analysis store. "
    "This page is the site copy."
)
DELIVERY_MD = "Email not sent. This report is on the site only. " + site_pages.SITE_NOTE
REPORTS = Path("analysis") / "reports"
INDEX = Path("data") / "analysis_index.json"


def _load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_known(repo):
    """symbol -> {names, where}. companies.json and universe.py win on the label."""
    repo = Path(repo)
    known = {}

    def add(sym, name, where, primary=False):
        if not sym or not name:
            return
        rec = known.setdefault(sym, {"names": [], "where": where})
        if name not in rec["names"]:
            if primary:
                rec["names"].insert(0, name)
            else:
                rec["names"].append(name)
        if primary:
            rec["where"] = where

    companies = repo / "data" / "companies.json"
    if companies.is_file():
        blob = json.loads(companies.read_text(encoding="utf-8"))
        for sym, rec in (blob.get("companies") or {}).items():
            if isinstance(rec, dict):
                add(sym, rec.get("name") or rec.get("long_name") or "", "companies.json", primary=True)
    universe = repo / "scripts" / "universe.py"
    if universe.is_file():
        mod = _load_module(universe, "emmi_universe")
        for group in getattr(mod, "GROUPS", []):
            for section in group.get("sections") or []:
                for row in section.get("rows") or []:
                    add(row.get("sym"), row.get("name"), "universe.py", primary=True)
        for row in getattr(mod, "FUNDAMENTALS", []) or []:
            add(row.get("sym"), row.get("name"), "universe.py", primary=True)
    symbols = repo / "data" / "symbols.json"
    if symbols.is_file():
        blob = json.loads(symbols.read_text(encoding="utf-8"))
        for row in blob.get("symbols") or []:
            if len(row) < 3 or row[2] != "Stock":
                continue
            name, tv = row[0], row[1]
            if ":" not in tv:
                continue
            exch, ticker = tv.split(":", 1)
            if exch not in TV_SUFFIX or not ticker or "." in ticker:
                continue
            add(ticker + TV_SUFFIX[exch], name, "symbols.json")
    for sym, name in EXTRA_LISTINGS.items():
        add(sym, name, "european-primary", primary=True)
    return known


def check_companies(companies, known):
    checked = []
    for company in companies:
        sym, name = company["sym"], company["name"]
        rec = known.get(sym)
        if not rec or not any(mdreport.names_compatible(name, known_name, sym) for known_name in rec["names"]):
            shown = rec["names"][0] if rec else "not found"
            raise ValueError(f"{sym} ({name}) does not match repo data ({shown})")
        checked.append({"name": name, "sym": sym, "where": rec["where"]})
    return checked


def page_depth(repo, sym):
    path = Path(repo) / "data" / "co" / f"{sym}.json"
    if not path.is_file():
        return "thin"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return "thin"
    annual = ((data.get("fin") or {}).get("annual") or [])
    return "full" if annual else "thin"


def html_to_text(html):
    text = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", html or "")
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'")
    return re.sub(r"\s+", " ", text).strip()


def _excerpt(text, limit=320):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def read_report(path, known):
    meta, body = mdreport.parse_frontmatter(path.read_text(encoding="utf-8"))
    mdreport.validate_meta(meta, body)
    if path.stem != meta["id"]:
        raise ValueError(f"{path.name} does not match id {meta['id']}")
    meta["companies"] = check_companies(meta["companies"], known)
    meta["body"] = body
    meta["path"] = str(path)
    return meta


def edition_from(meta):
    day = meta["day"]
    return dict(
        product="specials",
        id=meta["id"],
        day=day,
        kind=meta["kind"],
        label=meta["title"],
        edition=site_pages.pretty_day(day),
        edition_iso=day,
        title=meta["title"],
        summary=meta["summary"],
        topics=list(meta["topics"]),
        email_sent=bool(meta["email_sent"]),
        sent_iso=None,
        sent=None,
        source=meta["source_note"],
        publication=PUBLICATION_MD,
        delivery=DELIVERY_MD,
        caveat=None,
        format="markdown",
        companies=[{"name": c["name"], "sym": c["sym"]} for c in meta["companies"]],
    )


def note_name(sym, known):
    rec = known.get(sym) or {}
    name = (rec.get("names") or [sym])[0]
    return name.replace(" & ", " and ").replace("&", " and ")


def build_index(repo, known):
    repo = Path(repo)
    items = []
    root = repo / "specials"
    if (root / "editions.json").is_file():
        manifest = json.loads((root / "editions.json").read_text(encoding="utf-8"))
        for entry in manifest.get("editions") or []:
            folder = root / entry["id"]
            text = ""
            for name in ("email.html", "body.inc"):
                path = folder / name
                if path.is_file():
                    text = html_to_text(path.read_text(encoding="utf-8", errors="replace"))
                    break
            summary = entry.get("summary") or entry.get("subject") or _excerpt(text)
            items.append(dict(
                id=entry["id"],
                date=entry.get("day") or entry.get("edition_iso") or "",
                type="special",
                kind=entry.get("kind") or "Special brief",
                title=entry.get("title") or entry.get("label") or entry["id"],
                summary=summary,
                topics=list(entry.get("topics") or []),
                companies=[{"name": c.get("name"), "sym": c.get("sym")} for c in (entry.get("companies") or []) if c.get("sym")],
                href=entry.get("href") or f"/emmi/specials/{entry['id']}/",
                text=text,
            ))
    notes_root = repo / "data" / "company_notes"
    if notes_root.is_dir():
        for path in sorted(notes_root.glob("*.json")):
            blob = json.loads(path.read_text(encoding="utf-8"))
            sym = blob.get("sym") or path.stem
            for note in blob.get("notes") or []:
                parts = [note.get("title") or ""]
                for section in note.get("sections") or []:
                    parts.append(section.get("heading") or "")
                    parts.extend(section.get("paragraphs") or [])
                for source in note.get("sources") or []:
                    parts.append(source.get("label") or "")
                text = "\n".join(p for p in parts if p)
                first = ""
                for section in note.get("sections") or []:
                    paras = section.get("paragraphs") or []
                    if paras:
                        first = paras[0]
                        break
                items.append(dict(
                    id=f"{sym}:{note.get('id') or note.get('date') or 'note'}",
                    date=note.get("date") or "",
                    type="note",
                    kind="Company note",
                    title=note.get("title") or "Company note",
                    summary=_excerpt(first or text),
                    topics=[s.get("heading") for s in (note.get("sections") or []) if s.get("heading")],
                    companies=[{"name": note_name(sym, known), "sym": sym}],
                    href=f"/emmi/#co={sym}&tab=research",
                    text=text,
                ))
    items.sort(key=lambda item: (item.get("date") or "", item.get("title") or ""), reverse=True)
    return {"count": len(items), "items": items}


def publish(repo, stamp=None):
    repo = Path(repo)
    known = load_known(repo)
    folder = repo / REPORTS
    reports = []
    if folder.is_dir():
        for path in sorted(folder.glob("*.md")):
            reports.append(read_report(path, known))
    specials = repo / "specials"
    specials.mkdir(exist_ok=True)
    wanted = {meta["id"] for meta in reports}
    for edition in specials.glob("*/edition.json"):
        entry = json.loads(edition.read_text(encoding="utf-8"))
        if entry.get("format") == "markdown" and entry.get("id") not in wanted:
            target = edition.parent
            for child in target.iterdir():
                child.unlink()
            target.rmdir()
        elif entry.get("email_sent") and entry.get("id") in wanted:
            raise ValueError(f"{entry['id']} is an emailed special and cannot be replaced by Markdown")
    for meta in reports:
        entry = edition_from(meta)
        dest = specials / meta["id"]
        dest.mkdir(parents=True, exist_ok=True)
        fragment = mdreport.render_fragment(entry, meta["body"])
        # body.inc is the fragment the edition page wraps. It is not a page, so it is not named .html.
        _write(dest / "body.inc", fragment)
        legacy = dest / "body.html"
        if legacy.is_file():
            legacy.unlink()
        _write(dest / "email.html", mdreport.standalone_html(entry, fragment))
        _write(dest / "edition.json", json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    manifest = site_pages.write_product(specials, "specials", stamp)
    index = build_index(repo, known)
    _write(repo / INDEX, json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    return manifest, index, reports


def _write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _git(repo, message, push):
    paths = ["analysis", "specials", "data/analysis_index.json"]
    subprocess.run(["git", "add", "--", *paths], cwd=repo, check=True)
    staged = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo)
    if staged.returncode == 0:
        print("analysis store: nothing new to commit", file=sys.stderr)
    else:
        subprocess.run(["git", "commit", "-m", message], cwd=repo, check=True)
    if push:
        subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=repo, check=True)
        print("pushed HEAD to main; no email sent", file=sys.stderr)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=str(HERE.parents[1]))
    ap.add_argument("--dry-run", action="store_true", help="validate the Markdown and print the companies, then stop")
    ap.add_argument("--push", action="store_true", help="commit the store, pages and index, then push HEAD to main")
    ap.add_argument("-m", "--message", help="commit message used with --push")
    args = ap.parse_args(argv)
    repo = Path(args.repo)
    if args.dry_run:
        known = load_known(repo)
        for path in sorted((repo / REPORTS).glob("*.md")):
            meta = read_report(path, known)
            print(meta["id"])
            for company in meta["companies"]:
                print(f"  {company['sym']}\t{company['name']}\t{company['where']}\t{page_depth(repo, company['sym'])}")
        return
    manifest, index, reports = publish(repo)
    print(
        f"specials latest {manifest.get('latest')}; {len(reports)} markdown report(s); "
        f"search index {index['count']} item(s); no email sent",
        file=sys.stderr,
    )
    for meta in reports:
        for company in meta["companies"]:
            depth = page_depth(repo, company["sym"])
            print(f"  {company['sym']}\t{company['name']}\t{depth}", file=sys.stderr)
    if args.push:
        titles = "; ".join(meta["title"] for meta in reports) or "analysis index"
        _git(repo, args.message or f"File analysis: {titles}", push=True)


if __name__ == "__main__":
    main()
