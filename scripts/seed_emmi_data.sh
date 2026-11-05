#!/usr/bin/env bash
# Push the price jobs to the public repo MasterKano/emmi-data.
# Run from a checkout of emmi by an account that can push emmi-data.
# The emmi cloud agent (cursor[bot]) is not a collaborator on emmi-data; its push returns 403.
#
# What it publishes:
#   main             scripts, the five data workflows, README, fallback data/market.json
#   live-data        current emmi live-data tip (market and other data files)
#   tracker-history  current emmi tracker-history tip
# It refuses to copy research/.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
dest=${1:-https://github.com/MasterKano/emmi-data.git}
case "$dest" in
  https://github.com/MasterKano/emmi-data|https://github.com/MasterKano/emmi-data.git) ;;
  *) echo "refusing destination: $dest" >&2; exit 1 ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
mkdir -p "$repo/scripts" "$repo/.github/workflows" "$repo/data"

cp cutover/README.md "$repo/README.md"
cp cutover/.gitignore "$repo/.gitignore"
cp cutover/workflows/*.yml "$repo/.github/workflows/"

# Data scripts only. Site assembly and research stay on emmi.
scripts=(
  universe.py build_balancing.py build_companies.py build_dashboard.py build_data.py
  build_dealflow.py build_drivers.py build_fi_wind.py build_gas.py build_griddc.py
  build_hydro_nordic.py build_mastr.py build_mr.py build_mtd.py build_news.py
  build_nordic_monthly.py build_power.py build_precip.py build_precip_normals.py
  build_symbols.py build_tracker.py build_ttf_weather.py build_valuation.py
  check_griddc_events.py common.py contracts.py entsoe_client.py health_summary.py
  ho_curve.py nwe_temp_normals.json precip_normals.json precip_regions.py
  publish_live.sh requirements.txt
)
for f in "${scripts[@]}"; do
  cp "scripts/$f" "$repo/scripts/$f"
done
chmod +x "$repo/scripts/publish_live.sh"
# AGSI user agent names the repo the job runs in.
python3 - "$repo/scripts/build_gas.py" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
t = p.read_text()
old = "markets-monitor (github.com/MasterKano/emmi)"
new = "markets-monitor (github.com/MasterKano/emmi-data)"
if old not in t:
    raise SystemExit("build_gas.py user agent string not found")
p.write_text(t.replace(old, new, 1))
PY

if git show origin/live-data:data/market.json > "$repo/data/market.json" 2>/dev/null; then
  :
elif git show live-data:data/market.json > "$repo/data/market.json" 2>/dev/null; then
  :
else
  echo "no live-data market.json to seed" >&2
  exit 1
fi
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d.get('groups')" "$repo/data/market.json"

if find "$repo" -iname '*research*' -o -iname '*moonshot*' | grep -q .; then
  echo "refusing to publish: research path in the seed tree" >&2
  exit 1
fi

if [ "${SEED_DRY_RUN:-}" = 1 ]; then
  echo "dry run, not pushing. tree:"
  find "$repo" -type f | sed "s|^$repo/||" | sort
  exit 0
fi

git -C "$repo" init -q -b main
git -C "$repo" add -A
git -C "$repo" -c user.name="${GIT_AUTHOR_NAME:-emmi-data seed}" -c user.email="${GIT_AUTHOR_EMAIL:-ci@localhost}" -c commit.gpgsign=false commit -q -m "Seed public price workflows for emmi."

echo "pushing main"
git -C "$repo" push "$dest" main

echo "pushing live-data"
if git show-ref --verify --quiet refs/remotes/origin/live-data; then
  git push "$dest" refs/remotes/origin/live-data:refs/heads/live-data
elif git show-ref --verify --quiet refs/heads/live-data; then
  git push "$dest" refs/heads/live-data:refs/heads/live-data
else
  echo "live-data ref not in this clone" >&2
  exit 1
fi

echo "pushing tracker-history"
if git show-ref --verify --quiet refs/remotes/origin/tracker-history; then
  git push "$dest" refs/remotes/origin/tracker-history:refs/heads/tracker-history
elif git show-ref --verify --quiet refs/heads/tracker-history; then
  git push "$dest" refs/heads/tracker-history:refs/heads/tracker-history
else
  echo "tracker-history ref not in this clone" >&2
  exit 1
fi

echo "seeded $dest"
echo "next: gh workflow run intraday.yml -R MasterKano/emmi-data --ref main"
