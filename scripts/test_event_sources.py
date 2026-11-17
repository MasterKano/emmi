"""New Lundin names must have an official events page, so their dates get picked up (Valiente, 17 Nov 2026)."""
import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import events_refresh as ER  # noqa: E402

cov = {c["name"]: c for c in json.loads((ROOT / "data/events.json").read_text())["coverage"]}
src = {n: (g, u) for n, g, u in ER.SOURCES}
for name in ("Valiente Resources",):
    assert name in cov and cov[name]["group"] == "lundin", name + " missing from events coverage"
    assert name in src and src[name][1].startswith("https://"), name + " has no official page in SOURCES"
print("ok event sources")
