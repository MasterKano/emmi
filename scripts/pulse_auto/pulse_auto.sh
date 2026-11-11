#!/usr/bin/env bash
# Routine-safe: one process, atomic status, hard five-minute bound; never email.
set -uo pipefail
export TZ=Europe/Zurich
cd /workspace/brief || exit 1
exec 9> /workspace/brief/auto/.run.lock
if ! /usr/bin/flock -n 9; then
  .venv/bin/python auto/pulse_status.py 75 'Another Pulse pilot command is running; this attempt did nothing'
  exit 75
fi
.venv/bin/python auto/pulse_status.py 0 'Command started' building
/usr/bin/timeout --signal=TERM --kill-after=10s 300s .venv/bin/python auto/pulse_auto.py "$@"
code=$?
case "$code" in
  0) ;;
  1|2) .venv/bin/python auto/pulse_status.py "$code" 'Builder exited before producing a final status' ensure-final ;;
  124|137) .venv/bin/python auto/pulse_status.py "$code" 'Five-minute deadline reached; edition held. If a PR was merged, deployment may still finish; retry reconciles remote state' ;;
  *) .venv/bin/python auto/pulse_status.py "$code" 'Command failed unexpectedly; inspect the run log before sending or publishing' ;;
esac
exit "$code"
