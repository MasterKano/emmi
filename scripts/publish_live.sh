#!/usr/bin/env bash
# Publish build output to the orphan branch live-data as ONE commit (force-push, no history growth).
# Usage: publish_live.sh market <file>    -> replaces top-level market.json (intraday prices)
#        publish_live.sh data   <dir>     -> replaces the listed data files under data/ (scheduled builds)
# Both workflows use this; the other side's files are kept. Concurrent pushes are handled with
# --force-with-lease on the tip we started from, retried on conflict.
set -euo pipefail
kind=$1 src=$2
url="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
w=$(mktemp -d)
for i in 1 2 3 4 5 6; do
  rm -rf "$w"; mkdir -p "$w"; cd "$w"; git init -q -b live-data
  git config user.name "github-actions[bot]"; git config user.email "41898333+github-actions[bot]@users.noreply.github.com"
  base=""
  if git fetch -q --depth 1 "$url" live-data 2>/dev/null; then base=$(git rev-parse FETCH_HEAD); git checkout -q FETCH_HEAD -- . ; fi
  if [ "$kind" = market ]; then cp "$src" market.json
  else
    for p in $LIVE_PATHS; do rm -rf "$p"; if [ -e "$src/$p" ]; then mkdir -p "$(dirname "$p")"; cp -r "$src/$p" "$p"; fi; done
  fi
  git add -A
  git commit -q -m "${kind} $(date -u +'%Y-%m-%d %H:%M') UTC" --allow-empty
  lease="--force-with-lease=live-data:${base}"; [ -z "$base" ] && lease="--force"
  if git push -q $lease "$url" HEAD:live-data 2>/dev/null; then echo "published ($kind) on try $i"; exit 0; fi
  echo "live-data moved underneath us, retrying ($i)"; sleep $((i * 3))
done
echo "publish failed"; exit 1
