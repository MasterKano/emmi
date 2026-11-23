"""Analysis-coverage companies stay on the company-page build and off the market tabs.

No network. The 11 names are the ones linked from the 23 Nov data centre report that
had no full fundamentals file. A partial build_companies run must keep every company
already in the index.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from universe import GROUPS, FUNDAMENTALS  # noqa: E402
import build_companies as BC  # noqa: E402

NEED = [
    ("MTRS.ST", "Munters"),
    ("HTRO.ST", "Hexatronic"),
    ("NKT.CO", "NKT"),
    ("ABBN.SW", "ABB"),
    ("SU.PA", "Schneider Electric"),
    ("ENR.DE", "Siemens Energy"),
    ("EQIX", "Equinix"),
    ("DLR", "Digital Realty"),
    ("VRT", "Vertiv"),
    ("CEG", "Constellation Energy"),
    ("GEV", "GE Vernova"),
]


def group_equities():
    out = {}
    for g in GROUPS:
        for sec in g["sections"]:
            for row in sec["rows"]:
                if row.get("kind", "equity") == "equity":
                    out.setdefault(row["sym"], row)
    return out


def main():
    groups = group_equities()
    fund = {r["sym"]: r for r in FUNDAMENTALS}
    assert list(fund) == [sym for sym, _ in NEED], "FUNDAMENTALS order drifted"
    for sym, name in NEED:
        assert fund[sym]["name"] == name, sym
        assert sym not in groups, sym + " would land on a market tab"
        assert fund[sym].get("tv"), sym + " needs a chart symbol"

    specs = BC.equity_specs()
    for sym in groups:
        assert sym in specs, "market-tab equity missing from the company build: " + sym
    for sym, _ in NEED:
        assert sym in specs and specs[sym]["name"] == fund[sym]["name"]
    # A tab row wins if the same symbol is ever listed in both places.
    overlap = BC.equity_specs(fundamentals=[dict(groups["FORTUM.HE"])])
    assert overlap["FORTUM.HE"]["name"] == groups["FORTUM.HE"]["name"]

    prev = {"AAA.L": {"sym": "AAA.L", "name": "Kept"}, "BBB.L": {"sym": "BBB.L", "name": "Old"}}
    updated = {"BBB.L": {"sym": "BBB.L", "name": "New"}, "CCC.L": {"sym": "CCC.L", "name": "Added"}}
    merged = BC.merge_companies(prev, updated, partial=True)
    assert list(merged) == ["AAA.L", "BBB.L", "CCC.L"]
    assert merged["AAA.L"]["name"] == "Kept"
    assert merged["BBB.L"]["name"] == "New"
    full = BC.merge_companies(prev, updated, partial=False)
    assert list(full) == ["BBB.L", "CCC.L"]

    # A full run's keep-set is the universe just built, which includes analysis coverage,
    # so those detail files are not deleted.
    built = {s: {"sym": s} for s in specs}
    keep = {BC.safe_name(s) for s in BC.merge_companies({}, built, partial=False)}
    for sym, _ in NEED:
        assert BC.safe_name(sym) in keep

    blob = json.loads((ROOT / "data" / "companies.json").read_text(encoding="utf-8"))
    companies = blob["companies"]
    for sym in groups:
        if sym == "SER.L":
            assert sym not in companies  # the index still carries the retired SQZ.L line
            continue
        assert sym in companies, "market-tab company dropped from the index: " + sym
    assert len(companies) == 86 + len(NEED), len(companies)
    with_divs = 0
    for sym, name in NEED:
        rec = companies.get(sym)
        assert rec and rec.get("name") == name, sym
        assert isinstance(rec.get("px"), (int, float)), sym + " has no Yahoo price"
        assert rec.get("long_name") and rec["long_name"] != name
        assert rec.get("detail") == sym + ".json"
        detail = json.loads((ROOT / "data" / "co" / (sym + ".json")).read_text(encoding="utf-8"))
        annual = ((detail.get("fin") or {}).get("annual") or [])
        assert annual, sym + " has no annual statements"
        assert any(isinstance(row.get("rev"), (int, float)) for row in annual), sym + " revenue missing"
        if detail.get("divs"):
            with_divs += 1
    assert with_divs >= 10, "Yahoo dividend history missing for too many of the 11"
    # Companies that were already in the index stay there.
    for sym in ("FORTUM.HE", "EQNR.OL", "SHEL.L", "SQZ.L", "HWG.L"):
        assert sym in companies, sym
        assert (ROOT / "data" / "co" / (sym + ".json")).is_file(), sym

    js = (ROOT / "fundamentals.js").read_text(encoding="utf-8")
    for sym, name in NEED:
        assert sym in js and name in js
    company_js = (ROOT / "company.js").read_text(encoding="utf-8")
    assert "EMMIFundamentals" in company_js
    assert 'sec("coNotes","Our analysis"' in company_js

    print("test_fundamentals_coverage: ok", len(companies), "companies")


if __name__ == "__main__":
    main()
