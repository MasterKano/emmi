#!/usr/bin/env bash
# The public file list for the EMMA site. Everything else in the repo (scripts/, merge/, research/source/,
# README, .github, ...; research/app and research/source/moonshot are published only as research/) is NOT published. Usage: scripts/site_files.sh OUTDIR [RESEARCH_SNAPSHOT_DIR]
set -euo pipefail
out=${1:?outdir}; snap=${2:-}
rm -rf "$out"; mkdir -p "$out"
cp index.html robots.txt "$out"/
cp ./*.js ./*.css "$out"/
cp -r data "$out"/data
# Research (the former Moonshot site): app from research/app, data = research/app/data overlaid by Cori's
# research/source/moonshot (her copy wins), calendars copied byte-for-byte so UIDs and CRLF are unchanged.
mkdir -p "$out/research/data"
cp research/app/*.html research/app/*.js research/app/*.css "$out/research/"
cp research/app/data/* "$out/research/data/"
for f in research/source/moonshot/*; do case "$f" in *.ics) cp "$f" "$out/research/";; *) cp "$f" "$out/research/data/";; esac; done
python3 scripts/check_ics.py "$out"/research/*.ics
if [ -n "$snap" ] && [ -d "$snap/out" ]; then mkdir -p "$out/research"; cp -r "$snap/out" "$out/research/out"; fi
# every page must load the password gate and carry noindex
for f in "$out"/*.html "$out"/research/*.html; do
  grep -q 'gate.js' "$f" || { echo "::error::$f does not load gate.js"; exit 1; }
  grep -qi 'name="robots" content="noindex' "$f" || { echo "::error::$f has no noindex"; exit 1; }
done
echo "site: $(find "$out" -type f | wc -l) files, $(du -sh "$out" | cut -f1)"
