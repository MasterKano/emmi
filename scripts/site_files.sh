#!/usr/bin/env bash
# The public file list for the EMMA site. Everything else in the repo (scripts/, merge/, research/source/,
# README, .github, ...; research/app and research/source/moonshot are published only as research/) is NOT published. Usage: scripts/site_files.sh OUTDIR [RESEARCH_SNAPSHOT_DIR]
set -euo pipefail
out=${1:?outdir}; snap=${2:-}
rm -rf "$out"; mkdir -p "$out"
cp index.html robots.txt "$out"/
cp ./*.js ./*.css "$out"/
cp -r data "$out"/data
# Parallel public Pulse: only vetted static HTML/PNG editions, no private build artifacts.
if [ -d pulse ]; then cp -r pulse "$out"/pulse; fi
# Corporate Sector Intelligence. Public, no password gate, same rule as Pulse.
if [ -d csi ]; then cp -r csi "$out"/csi; fi
# v2 pages. Live tabs embed power, markets, curves, oil & gas and mining.
if [ -d v2 ]; then cp -r v2 "$out"/v2; fi
# Previous Nordic power and Markets tabs, kept at /parked/power/ and /parked/markets/.
if [ -d parked ]; then cp -r parked "$out"/parked; fi
# Research (the former Moonshot site): app from research/app, data = research/app/data overlaid by the research owner's
# research/source/moonshot (her copy wins), calendars copied byte-for-byte so UIDs and CRLF are unchanged.
mkdir -p "$out/research/data"
cp research/app/*.html research/app/*.js research/app/*.css "$out/research/"
cp research/app/data/* "$out/research/data/"
for f in research/source/moonshot/*; do case "$f" in *.ics) cp "$f" "$out/research/";; *) cp "$f" "$out/research/data/";; esac; done
python3 scripts/chart_windows.py research/source/moonshot/coming_up.json "$out/research/data/chart_windows.json"
python3 scripts/check_ics.py "$out"/research/*.ics
if [ -n "$snap" ] && [ -d "$snap/out" ]; then mkdir -p "$out/research"; cp -r "$snap/out" "$out/research/out"; fi
# every page must load the password gate and carry noindex
htmls=("$out"/*.html "$out"/research/*.html)
if [ -d "$out/v2" ]; then htmls+=("$out"/v2/*/*.html); fi
if [ -d "$out/parked" ]; then htmls+=("$out"/parked/*/*.html); fi
for f in "${htmls[@]}"; do
  [ -f "$f" ] || continue
  grep -q 'gate.js' "$f" || { echo "::error::$f does not load gate.js"; exit 1; }
  grep -qi 'name="robots" content="noindex' "$f" || { echo "::error::$f has no noindex"; exit 1; }
done
# Pulse and CSI stay public: noindex, and they must not pick up the password gate.
if [ -d "$out/pulse" ] || [ -d "$out/csi" ]; then
  while IFS= read -r f; do
    if grep -q 'gate.js' "$f"; then echo "::error::$f must not load the password gate"; exit 1; fi
    grep -qi 'name="robots" content="noindex' "$f" || { echo "::error::$f has no noindex"; exit 1; }
  done < <(find "$out/pulse" "$out/csi" -name '*.html' -type f 2>/dev/null)
fi
echo "site: $(find "$out" -type f | wc -l) files, $(du -sh "$out" | cut -f1)"
