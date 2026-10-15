"""End-of-build health summary (no network). Reads step outcomes (STEPS_JSON from the workflow) and the 'gaps'/'errors'
lists inside data files, writes a GitHub job summary and ::warning:: annotations, and exits 0. If anything failed it
writes ALERT=1 to GITHUB_OUTPUT so the workflow can open/update one issue per day."""
import json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
steps = json.loads(os.environ.get("STEPS_JSON") or "{}")
mode = os.environ.get("MODE", "?")
bad = [f"step '{k}' {v.get('outcome')}" for k, v in steps.items() if v.get("outcome") in ("failure", "cancelled")]
changed = {l[3:].strip() for l in subprocess.run(["git", "status", "--porcelain", "-uall", "--", "data"], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()}
gaps = []
for f in sorted(os.listdir(os.path.join(ROOT, "data"))):
    if not f.endswith(".json"):
        continue
    try:
        d = json.load(open(os.path.join(ROOT, "data", f)))
    except Exception as e:  # noqa: BLE001
        bad.append(f"{f} unreadable: {str(e)[:80]}"); continue
    if not isinstance(d, dict) or ("data/" + f) not in changed:
        continue
    g = d.get("gaps") or d.get("errors") or []
    if isinstance(g, dict):
        g = [f"{k}: {v}" for k, v in g.items()]
    for x in g[:5]:
        gaps.append(f"{f}: {str(x)[:140]}")
EXPECT = {"power": ["data/power.json", "data/nordic_dash.json"], "market": ["data/market.json"], "full": ["data/market.json", "data/power.json", "data/news.json"]}
for p in EXPECT.get(mode, []):
    if p not in changed:
        bad.append(f"{p} not updated by this {mode} build")
lines = [f"## Build health ({mode})", "", f"**Failures:** {len(bad)} · **Source gaps reported in data:** {len(gaps)}", ""]
lines += [f"- ❌ {b}" for b in bad] + [f"- ⚠️ {g}" for g in gaps] + ([] if bad or gaps else ["- ✅ all steps ok, no gaps"])
open(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null"), "a").write("\n".join(lines) + "\n")
for b in bad:
    print(f"::warning title=Build step problem::{b}")
for g in gaps:
    print(f"::notice title=Source gap::{g}")
with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as o:
    o.write(f"alert={'1' if bad else '0'}\n")
open(os.path.join(os.environ.get("RUNNER_TEMP", "/tmp"), "health.md"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
