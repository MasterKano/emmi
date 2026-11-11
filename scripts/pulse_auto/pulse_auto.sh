#!/usr/bin/env bash
set -euo pipefail
export TZ=Europe/Zurich
cd /workspace/brief
exec /usr/bin/flock -n /workspace/brief/auto/.run.lock .venv/bin/python auto/pulse_auto.py "$@"
