#!/usr/bin/env bash
# Cloudflare Pages build. Output directory: _site
# Same public file list as the old GitHub Pages deploy, plus _headers.
# research-history is fetched when this environment can, so the newest checked
# snapshot is included. A missing snapshot does not fail the build.
set -euo pipefail
cd "$(dirname "$0")/.."
snap=""
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git fetch -q --depth=1 origin research-history; then
    mkdir -p "$tmp/rh"
    if git archive FETCH_HEAD snapshots | tar -x -C "$tmp/rh"; then
      last=$(find "$tmp/rh/snapshots" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | while read -r d; do
        [ -f "$d/CHECK_PASS" ] && printf '%s\n' "$d"
      done | sort | tail -1 || true)
      if [ -n "${last:-}" ]; then
        snap=${last%/}
        echo "research snapshot: $snap"
      else
        echo "research-history has no CHECK_PASS snapshot"
      fi
    fi
  else
    echo "research-history not fetched; building without the research/out snapshot"
  fi
fi
bash scripts/site_files.sh _site "$snap"
