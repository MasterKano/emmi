# Parallel numbers-only weekday Pulse pilot

Local command: `/workspace/brief/auto/pulse_auto.sh` (build/check only), or add `--publish` (checked branch + PR + green checks + merge). Existing weekday Pulse, editorial, sent records and email are not changed. No LLM calls or SMTP.

## Locked template
Source of truth: `/workspace/brief/master/README.md`, current approved `market_pulse_weekday_master_v1.2` (9 November 2026). v2 was superseded. Each run verifies SHA256SUMS and exact parity of all nine locked code files; it halts on template drift rather than rebuilding layout. Existing renderers produce the email HTML and same-section image stacks, with nuclear v3 directly after wind/hydro. Full tiles, energy charts, calendar and risk strip are preserved. Full risk section remains stress-trigger-only. Inline styles and 375/390px styled/nostyle overflow checks are mandatory.

Only intentional pilot exceptions to the master's in/out list: Top 5 reads, News by topic and editorial text await the explicitly marked commentary slot. The pilot always shows the full last-completed-session board (also on Mondays), independently of whether another brief covered that close. No old commentary is reused. Inflation release checks are omitted because they update a shared seen-cache; they remain in the existing Pulse. Existing intraday trigger is not started, changed or repaired here.

## Safety gate
Fresh fetch on every run. Source dates for displayed board prices, risk gauges/breadth, power delivery, wind/hydro, nuclear MTD, gas storage and TTF curve are recorded in `validation.json` alongside failures/gaps. Prices must be current day or latest completed session; official data lags are not silently excused. Every required chart must exist. Missing text values, empty tables, wrong chart ordering or phone overflow hold publication. The commentary slot is the sole deliberate empty editorial slot. Pilot-only gas feed constants point to emmi-data after the 5 November split; existing builders are untouched.

Output: `/workspace/brief/out/pulse_auto/YYYY-MM-DD/HHMMSS/` contains HTML, PNGs, source provenance, phone results and checklist. Nothing touches `out/pulse`, editorial files or reported sent stories. `CHECK_PASS` hashes the validation report; the publisher rechecks report and HTML/image hashes, date, and build age (under 2h). Only HTML and referenced PNGs go public. Validation/provenance files remain local. A date already archived is immutable: reruns retain it. Publication does not imply email was sent.

URLs: `/emmi/pulse/` latest; `/emmi/pulse/YYYY-MM-DD/` archived edition; `/emmi/pulse/archive/` archive list. Before first valid run, latest truthfully explains that none is published. The site remains public, with noindex; no password gate is added to Pulse. `scripts/site_files.sh` includes only this dedicated static output folder.

## Scheduling: NOT ACTIVE on initial installation
Requested: weekdays around 05:30 Europe/Zurich. `scheduler/pulse-auto.timer` is the restart-persistent systemd configuration (`Persistent=true`, explicit IANA zone), with a companion oneshot service. `scheduler/crontab.example` is the matching local-time cron entry. The box has PID 1 `/tini ... /pod-daemon`, no systemd user bus, no cron binary/daemon. `apt-get update` failed with HTTP 500/unsigned-index errors on 11 November 2026. Therefore no timer was falsely marked enabled. These units need a functioning supported scheduler/host startup hook before unattended runs can be promised. A detached shell loop is intentionally NOT used: it would not survive restart.

Existing old 15-min trigger inspection: `/home/box/markets-monitor-trigger/install.sh` installs cron at 12,27,42,57, else a non-persistent nohup loop. No cron or loop is running; its bashrc reinstall hook is commented PAUSED (22 October). Existing cron-keepalive shell hooks cannot start a missing executable. Its workflow target still says MasterKano/emmi. No change to it in this pilot.

## Runtime
Use the existing brief virtualenv and existing source credentials provided through its environment; never place credentials in this repo. Additional HTML checker: `beautifulsoup4` (installed into existing brief venv). Chrome: `/usr/bin/google-chrome`. Script has a flock guard against overlapping builds. EMMI_REPO defaults to `/workspace/emmi-pulse-auto`, BRIEF_ROOT to `/workspace/brief`. Publisher uses existing Git/gh authentication, no new tokens. Per-edition PR checks must include a successful Pages `build` and no failed/running checks before merge.

Later stages (not implemented): Gmail app-password email, bot commentary injection and quiet-day email decisions.
