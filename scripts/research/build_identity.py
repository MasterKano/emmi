#!/usr/bin/env python3
"""Build structured company identity data for the research site.

Reads merge/ids/{companies,listings,id_map}.csv, the country files in
research/app/data and the pinned Moonshot copy (read only), and writes:
  research/app/data/company_identity.json
  research/app/data/event_parent_links.json
Missing data stays null; nothing is inferred beyond the MIC-to-country table.
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IDS = ROOT / "merge" / "ids"
DATA = ROOT / "research" / "app" / "data"
MOON = ROOT / "research" / "source" / "moonshot"
COUNTRY_FILES = ["angola", "colombia", "falklands", "gabon", "guyana", "namibia", "south_africa"]

# MIC -> (readable exchange name, listing country)
MIC = {
    "XASX": ("ASX", "Australia"),
    "XLON": ("London Stock Exchange", "United Kingdom"),
    "XNYS": ("NYSE", "United States"),
    "XTSE": ("TSX", "Canada"),
    "XTSX": ("TSX Venture", "Canada"),
    "XOSL": ("Oslo Børs", "Norway"),
    "MERK": ("Euronext Growth Oslo", "Norway"),
    "XSTO": ("Nasdaq Stockholm", "Sweden"),
    "SSME": ("Nasdaq First North Sweden", "Sweden"),
    "XCSE": ("Nasdaq Copenhagen", "Denmark"),
    "XHEL": ("Nasdaq Helsinki", "Finland"),
    "XPAR": ("Euronext Paris", "France"),
    "XAMS": ("Euronext Amsterdam", "Netherlands"),
    "XBRU": ("Euronext Brussels", "Belgium"),
    "XLIS": ("Euronext Lisbon", "Portugal"),
    "XMIL": ("Euronext Milan", "Italy"),
    "XMAD": ("BME Madrid", "Spain"),
    "XETR": ("Xetra", "Germany"),
    "XFRA": ("Frankfurt Stock Exchange", "Germany"),
    "XWAR": ("Warsaw Stock Exchange", "Poland"),
    "XWBO": ("Vienna Stock Exchange", "Austria"),
    "XTAE": ("Tel Aviv Stock Exchange", "Israel"),
    "XTKS": ("Tokyo Stock Exchange", "Japan"),
    "XBOT": ("Botswana Stock Exchange", "Botswana"),
    "XSES": ("SGX", "Singapore"),
}
# Segment names that matter for display, keyed by (MIC, exchange text in listings.csv)
SEGMENT = {
    ("XLON", "AIM"): "AIM",
    ("XSES", "SGX Catalist"): "SGX Catalist",
    ("SSME", "Nasdaq First North Growth Market"): "Nasdaq First North Growth Market",
    ("XFRA", "Frankfurt (Scale)"): "Frankfurt Scale",
    ("XSTO", "Nasdaq Stockholm (SDB)"): "Nasdaq Stockholm (SDB)",
}
VERIFIED_RE = re.compile(r"(?<!un)verified:?\s*([^;]*)", re.I)


def rows(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def clean(value):
    value = (value or "").strip()
    return value or None


def pick_listing(listings):
    if not listings:
        return None
    primary = [r for r in listings if r["primary"] == "Y"]
    return (primary or listings)[0]


def listing_fields(listing):
    if not listing:
        return {"exchange": None, "mic": None, "ticker": None, "listing_country": None}
    mic = listing["mic"]
    name, country = MIC.get(mic, (None, None))
    return {
        "exchange": SEGMENT.get((mic, listing["exchange"]), name or clean(listing["exchange"])),
        "mic": clean(mic),
        "ticker": clean(listing["ticker"]),
        "listing_country": country,
    }


def verification(texts, status):
    for text in texts:
        match = VERIFIED_RE.search(text or "")
        if match:
            return True, clean(match.group(1)) or "verified"
    if "unverified" in status:
        return False, None
    return None, None


def main():
    companies = {r["company_id"]: r for r in rows(IDS / "companies.csv")}
    listings = {}
    for r in rows(IDS / "listings.csv"):
        listings.setdefault(r["company_id"], []).append(r)
    id_map = rows(IDS / "id_map.csv")
    notes = {}
    keys = {}
    for r in id_map:
        if r["company_id"]:
            notes.setdefault(r["company_id"], []).append(r["note"])
            keys.setdefault(r["system"], {})[r["old_id"]] = r["company_id"]

    countries = {}
    for stem in COUNTRY_FILES:
        doc = json.loads((DATA / f"{stem}.json").read_text(encoding="utf-8"))
        lookup = keys.get(f"moonshot.country.{stem}", {})
        for company in doc.get("companies", []):
            cid = lookup.get(company.get("code") or "") or lookup.get(company.get("name") or "")
            if cid:
                countries.setdefault(cid, set()).add(doc["country"])
    for cid in keys.get("moonshot.norway.short_name", {}).values():
        countries.setdefault(cid, set()).add("Norway")

    out = {}
    for cid, c in companies.items():
        raw_status = c["status"]
        status = raw_status.split("/")[0]
        own_listing = pick_listing(listings.get(cid))
        parent = companies.get(c["parent_company_id"]) if c["parent_company_id"] else None
        texts = notes.get(cid, []) + [r["note"] for r in listings.get(cid, [])]
        verified, verified_by = verification(texts, raw_status)
        entry = {
            "name": c["name"],
            "status": status,
            "parent_id": parent["company_id"] if parent else None,
            "parent_name": parent["name"] if parent else None,
        }
        if status == "subsidiary":
            entry.update({"exchange": None, "mic": None, "ticker": None, "listing_country": None})
            pl = listing_fields(pick_listing(listings.get(parent["company_id"]))) if parent else listing_fields(None)
            entry.update({
                "parent_exchange": pl["exchange"],
                "parent_mic": pl["mic"],
                "parent_ticker": pl["ticker"],
                "parent_listing_country": pl["listing_country"],
            })
        else:
            entry.update(listing_fields(own_listing))
            entry.update({"parent_exchange": None, "parent_mic": None, "parent_ticker": None, "parent_listing_country": None})
        entry["project_countries"] = sorted(countries.get(cid, []))
        entry["verified"] = verified
        entry["source"] = "; ".join(x for x in [clean(c["sources"]), verified_by and f"verified: {verified_by}"] if x) or None
        out[cid] = entry

    identity = {
        "note": "Built by scripts/research/build_identity.py from merge/ids. Null means not known.",
        "companies": dict(sorted(out.items())),
        "keys": {system: dict(sorted(m.items())) for system, m in sorted(keys.items())},
    }
    (DATA / "company_identity.json").write_text(json.dumps(identity, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # Events whose company is a subsidiary of a listed parent
    def listed_parent(cid):
        entry = out.get(cid)
        return entry and entry["status"] == "subsidiary" and entry["parent_ticker"]

    by_name = {c["name"]: cid for cid, c in companies.items()}
    short = keys.get("moonshot.norway.short_name", {})
    links = []
    for event in json.loads((MOON / "norway_events.json").read_text(encoding="utf-8")):
        for name in event.get("companies") or []:
            cid = short.get(name)
            if cid and listed_parent(cid):
                links.append((event["id"], cid))
    for item in json.loads((MOON / "coming_up.json").read_text(encoding="utf-8")).get("items", []):
        cid = by_name.get(item.get("company_name") or "")
        if cid and listed_parent(cid):
            links.append((item["id"], cid))
    result = [
        {"event_id": eid, "company_id": cid, "parent_id": out[cid]["parent_id"], "parent_ticker": out[cid]["parent_ticker"]}
        for eid, cid in sorted(set(links))
    ]
    (DATA / "event_parent_links.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"companies {len(out)}, event links {len(result)}")


if __name__ == "__main__":
    main()
