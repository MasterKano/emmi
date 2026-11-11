# Parallel numbers-only weekday Pulse pilot

Local command: `/workspace/brief/auto/pulse_auto.sh` (build/check only), or add `--publish` (checked branch + PR + green checks + merge). Existing weekday Pulse, editorial, sent records and email are not changed. No LLM calls or SMTP. A future short bot step can send only after the fixed status is ready/published and validation is PASS.

## Locked template
Source of truth: `/workspace/brief/master/README.md`, current approved `market_pulse_weekday_master_v1.2` (9 November 2026). v2 was superseded. Each run verifies SHA256SUMS and exact parity of all nine locked code files; it halts on template drift rather than rebuilding layout. Existing renderers produce the email HTML and same-section image stacks, with nuclear v3 directly after wind/hydro. Full tiles, energy charts, calendar and risk strip are preserved. Full risk section remains stress-trigger-only. Inline styles and 375/390px styled/nostyle overflow checks are mandatory.

Only intentional pilot exceptions to the master's in/out list: Top 5 reads, News by topic and editorial text await the explicitly marked commentary slot. The pilot always shows the full last-completed-session board (also on Mondays), independently of whether another brief covered that close. No old commentary is reused. Inflation release checks are omitted because they update a shared seen-cache; they remain in the existing Pulse. Existing intraday trigger is not started, changed or repaired here.

## Safety gate
Fresh fetch on every run. Source dates for displayed board prices, risk gauges/breadth, power delivery, wind/hydro, nuclear MTD, gas storage and TTF curve are recorded in `validation.json` alongside failures/gaps. Prices must be current day or latest completed session; official data lags are not silently excused. Every required chart must exist. Missing text values, empty tables, wrong chart ordering or phone overflow hold publication. The commentary slot is the sole deliberate empty editorial slot. Pilot-only gas feed constants point to emmi-data after the 5 November split; existing builders are untouched.

Output: `/workspace/brief/out/pulse_auto/YYYY-MM-DD/HHMMSS/` contains HTML, PNGs, source provenance, phone results and checklist. Nothing touches `out/pulse`, editorial files or reported sent stories. `CHECK_PASS` hashes the validation report; the publisher rechecks report and HTML/image hashes, date, and build age (under 2h). Only HTML and referenced PNGs go public. Validation/provenance files remain local. A date already archived is immutable: reruns retain it. Publication does not imply email was sent.

URLs: `/emmi/pulse/` latest; `/emmi/pulse/YYYY-MM-DD/` archived edition; `/emmi/pulse/archive/` archive list. Before first valid run, latest truthfully explains that none is published. The site remains public, with noindex; no password gate is added to Pulse. `scripts/site_files.sh` includes only this dedicated static output folder.

## Routine execution (box timer dropped)
A Grok Bot routine can invoke `/workspace/brief/auto/pulse_auto.sh --publish` weekdays around 05:30 Europe/Zurich. This change does not create/edit any routine or email. All pilot box timer/service/cron configuration was removed; the old intraday trigger is untouched.

The command has a kernel flock and a 300-second deadline (+10-second forced-stop grace). Fixed atomic status: `/workspace/brief/out/pulse_auto/latest_status.json`. Final states: `published` (both latest/archive HTTP 200 with exact expected HTML), `ready` (clean dry run, nothing published), or `held` (reason list, no permission to send). `building` is transient. Exit codes: 0 ready/published, 2 validation held, 1 build/publish error, 75 overlap, 124 deadline (137 if forced kill). Status includes reasons, output_dir where applicable, page_url and Zurich timestamp. Dry-run command omits `--publish`.

Idempotence: if today's archive is already on main, verify both real URLs and return already_published without rebuilding or opening a PR. Otherwise use one deterministic `pulse-auto/YYYY-MM-DD` branch/PR. An atomic local journal under `out/pulse_auto/transactions/` preserves the checked output/head SHA before push; retries validate and resume that same transaction rather than opening duplicates. Unknown/changed/expired remote transactions hold for review. No force-push or archive replacement.

## Freshness rules: unresolved source-policy mismatch
See `freshness-rule-audit.md` and inline code citations. No source-specific weekday age allowances were present in v1.2/checklist/source code; available-observation selection has no age limit. The separate Weekend exception table is not borrowed. Therefore the original strict source-date holds are retained rather than inventing allowances. This is not a claim that unlimited source lag is approved.

## Runtime
Use the existing brief virtualenv and existing source credentials provided through its environment; never place credentials in this repo. Additional HTML checker: `beautifulsoup4` (installed into existing brief venv). Chrome: `/usr/bin/google-chrome`. Script has a flock guard against overlapping builds. EMMI_REPO defaults to `/workspace/emmi-pulse-auto`, BRIEF_ROOT to `/workspace/brief`. Publisher uses existing Git/gh authentication, no new tokens. Per-edition PR checks must include a successful Pages `build` and no failed/running relevant checks before merge. Only the retired Cloudflare Pages integration is excluded: the deleted account still reports failures on main, while the active controlled deployment is GitHub Pages. The integration itself is not modified or removed.

Later stages (not implemented): Gmail app-password email, bot commentary injection and quiet-day email decisions.
