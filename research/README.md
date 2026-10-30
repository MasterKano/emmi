# Research pilot (Stage 3)

Read-only research data lives in `source/moonshot/` (copy of the public Moonshot files, pinned commit in the
PR that brought it in). It is never edited here; new versions arrive as a normal PR.

| File | What |
|---|---|
| `pilot.csv` | The 30 pilot companies (in both EMMA and the research list), the listing used for prices, and its local index |
| `pilot_events.csv` | Their 123 past events, frozen ids, and the OLD stored returns kept as-is, labelled `v0_eventday_close` (r5/r20/r60) or `v0_pilot_excess` (excess_20d in r20, excess_3m in r60) |
| `release_times.csv` | Release time (ISO, local exchange time with offset), `tz`, `time_basis` = stated / recovered / assumed |
| `logs/release_time_backfill_*.csv` | One-off backfill log: source, method, note per event |

Ids: every existing event / upcoming id is frozen in `merge/ids/event_id_map.csv` (new_id = old_id; they are
also calendar UIDs). Ids are never recomputed.

## Method v1 (release timing)
Base = last close **before** the announcement. Released before the open or during the session on trading day D:
day 1 = D. Released after the close, at an unknown time (treated as after the close), or on a non-trading day:
day 1 = next session. rN = stock move from base to the day-N close minus the local index over the same dates (%),
N = 1, 5, 20, 60 sessions. Indices: London AIM → FTSE AIM All-Share, London Main → FTSE All-Share,
Stockholm / First North → OMX Stockholm All-Share, Oslo → Oslo Benchmark, TSX → S&P/TSX Composite.
Prices: Yahoo daily close via EMMA's collector (split-adjusted, not dividend-adjusted).

## Running
`.github/workflows/research.yml` runs only when these inputs change (or by hand): fetch → compute → publish check.
Pass → a dated snapshot is ADDED to branch `research-history` (`snapshots/<UTC stamp>/` with prices, outputs,
release times, the check result) and the site redeploys with it as `research/out/`. Fail → nothing is written and
the last good snapshot stays live. It never runs on EMMA's market schedule and shares nothing with EMMA's jobs.
