# Integration note — EMMA + Moonshot (Stage 1, draft 30 Oct 2026)

Draft by Mark (technical lead), with the research owner's Stage 1 inventory (Cori, 30 Oct 2026) folded in. Items marked **[confirmed by research inventory]** were checked by the research owner. Feature baseline = public `MasterKano/moonshot` `main` at 4e08b27 (PR 23), not the working copy, which has drifted.

## 1. What each site is today

| | EMMA (`MasterKano/emma`) | Moonshot (`MasterKano/moonshot`) |
|---|---|---|
| Purpose | Live markets dashboard: equities, macro, Nordic power, gas storage, grid & data centres | Small-cap event research: screen of companies, event history, coming-up calendar, country pages, watchlist |
| Hosting | GitHub Pages from `main` | GitHub Pages from `main` (`robots.txt` disallows all crawlers) |
| How data gets there | GitHub Actions build JSON; fast-changing files are force-pushed to the orphan `live-data` branch; the page reads `live-data` first and falls back to the copies on `main` (`js/live.js`) | No workflows. Data files are built outside the repo and arrive by pull request (PRs #1–#23) |
| Size of repo | 212 commits, many branches (`live-data`, `tracker-history`, feature branches) | 25 commits, `main` only |

## 2. Data flows

### EMMA
```
Yahoo / CNBC / other public sources
   │  (GitHub Actions on a schedule)
   ▼
scripts/build_*.py ──► data/*.json, data/co/<symbol>.json
   │                     │
   │ publish_live.sh     └─► committed to main only on full builds (→ Pages rebuild)
   ▼
live-data branch (orphan, force-pushed, one commit) ──► browser (js/live.js fetch override)
tracker-history branch (append-only) ◄── build_tracker uk/de
```
Hand-maintained on `main`: `data/powered_land_deals.json`, `scripts/precip_normals.json`. Universe of listed companies: `scripts/universe.py` (84 unique equities; key = Yahoo symbol).

### Moonshot  [confirmed by research inventory]
```
Research workspace outside the repo (not version-controlled)
   site_data/smallcaps.json  ← stated "source of truth for the site and the Sheet"
   review/config.json, manual_sources.csv, manual_*.csv  (hand decisions)
   review/config.json + five review/manual_*.csv  (all hand judgement)
   sweep, basin, Norway and pilot scripts; enrich.py, build_briefing.py,
   apply_category.py, apply_additions.py, merge_europe.py ...  (not in the repo)
   smallcaps.json is written in place by 6+ scripts; coming_up.json by 2
   ▼
site_build/  (mirror)  ──► copied into the repo by PR
   │
   ▼
repo data/: smallcaps.json, companies.csv, events.csv, norway_*.json, briefing.json,
            read_across.json, slipped.json, smallcaps_reaction_summary.json, country files
   │  scripts/build_coming_up.py (in repo)
   ▼
data/coming_up.json, coming_up.ics, norway_events.ics  ──► browser + calendar subscribers
   └─► Google Sheet (15 tabs): one-way partial copy pushed from files; no script reads it; last edited 27 Oct, now stale
```

**Google Sheet vs JSON editing (trace result, both reads agree).** Neither repo reads or mentions the Sheet, and no script anywhere reads it. Research is authored in files: scripts write the JSON/CSV and hand judgement lives in `review/config.json` plus five `review/manual_*.csv`. The Sheet is a stale, one-way partial copy (no ids, sources, labels or what-changed fields). Problems: (a) the authoritative data is not version-controlled; (b) the repo cannot rebuild its own data; (c) several scripts edit the same generated file in place, so a rebuild can overwrite a decision; (d) working copy and public repo have drifted (box `coming_up.json` 217 items vs public 220). **Agreed recommendation:** the files are the one source — curated inputs kept separate from computed values — with **one build step** that produces every published file (site JSON, `coming_up.json`, briefing, both `.ics`). The Sheet is retired or regenerated as a read-only view. Where the files live depends on the OPEN DECISION below.

## 3. Schedules and workflows (EMMA; all times UTC)

| Workflow | File | Trigger | What it touches |
|---|---|---|---|
| Update market data | `update-data.yml` | weekdays 05:30, 12:30, 21:00; weekends 12:30; daily 17:30; catch-ups 09:45, 13:45; manual | All `build_*` scripts (modes full / market / power); `live-data` force-push; `tracker-history`; opens "Build alert" issues on failure |
| Intraday prices | `intraday.yml` | weekdays every 15 min (:07/:22/:37/:52), 05–21h; dispatched by ticker | `publish_live.sh market` → `live-data/data/market.json` |
| Intraday ticker | `ticker.yml` | hourly at :17 | Long-running job (~5h40m) that dispatches Intraday prices every 15 min and catch-up full builds |
| HO futures curve | `ho-curve.yml` | weekdays 21:07 | `live-data` `ho_curve.csv` + history |
| pages build and deployment | (GitHub) | every push to `main` | Site rebuild |

Moonshot has no workflows; nothing is generated on GitHub. Its two scheduled jobs are the research owner's routines, which re-run the scripts above. **Neither read could see the routines' definitions or outputs — still open.**
- *Monday coming-up note*: reads `data/coming_up.json` (window of upcoming catalysts); repo evidence: `coming_up.json` / `.ics` regenerated per PR.
- *Monthly refresh (1st–7th)*: re-screens and re-prices `smallcaps.json` (`as_of`, `last_checked`), rebuilds `briefing.json` (`as_of 2026-10-27`, "Built from the enriched data by review/build_briefing.py").

## 4. Downstream dependencies (things that break if paths or formats change)

| Consumer | Reads | Risk |
|---|---|---|
| EMMA page itself | `live-data` raw URLs, then `main` copies | Any rename in `data/` |
| Markets monitor (scrape/health check; paused since 22 Oct) | dispatches `intraday` / `update-data`; reads `live-data/data/market.json` | Workflow file names and `market.json` path |
| Briefing tiles (gas, Nordic M1) | `live-data/data/gas/<country>.json`, `hydro_nordic.json` | Paths |
| Monthly-review workbook (hydro) | `hydro_nordic.json` | Path |
| Calendar subscribers | Moonshot `coming_up.ics`, `norway_events.ics` URLs; event UIDs `<id>@moonshot` | URL and UID stability — changing either duplicates or drops events in people's calendars |
| Shared links | EMMA hash routes (`#equities/<chip>`, `#macro…`, `#power…`, `#gas`, `#charts`), raw.githack share link; Moonshot `watch=` links and browser-stored watchlist (`localStorage` key `moonshot-watch`) | Route and key names |

Rule for the merge: keep every path above working (redirect or keep a copy) until each consumer is moved.

## 5. Baselines (measured 30 Oct 2026)

### Runner minutes, last 7 days (window 23 Oct 07:21 → 30 Oct 07:21 UTC, 193 runs)
Method: GitHub Actions API. **Job-level** = sum over runs of each job's `started_at → completed_at` (time a runner was actually busy). Script: `tools/jobs.py`.

| Workflow | Runs | Job minutes | Rounded up per job (billing style) |
|---|---|---|---|
| Intraday ticker | 15 | 1,865 | 1,868 |
| Update market data | 43 | 335 | 391 |
| Intraday prices | 99 | 132 | 198 |
| pages build and deployment | 23 | 16 | 68 |
| HO futures curve | 13 | 2 | 12 |
| **Total** | **193** | **2,349** | **2,537** |

Run-level wall time (`run_started_at → updated_at`, `tools/runner.py`) gives 3,588 min, because it also counts time a run waits in the concurrency queue (one ticker run spans 18:59 → 04:17). The earlier figure of ~3,860 min used this wall-time style. **Proposed baseline: 2,349 job-minutes/week.** The ticker's long-running dispatcher is 79% of it.

### Page size, first visit (cold cache, Chrome headless, 1440×900, load + 8 s; `tools/pagesize.py`)
| Site | Requests | Transferred | Decoded |
|---|---|---|---|
| EMMA home | 39 | 0.40 MB | 1.22 MB |
| Moonshot home | 62 | 0.95 MB | 9.09 MB |

EMMA biggest (transferred / decoded kB): `live-data market.json` 74.6/247.5; `power.js` 40.6/124.7; `live-data power.json` 36.5/133.0; `company.js` 23.7; `table.js` 18.3; `grid.js` 16.8; `dealflow.json` 13.2; `mr.js` 12.0; `griddc.json` 11.9; `gas.js` 11.5. Within the README budget (< 600 KB initial load).

Moonshot finding: `smallcaps.json` (138 kB / 1.5 MB decoded) is fetched 4 times on first load, `coming_up.json` 3×, `norway_events.json` 3×. One shared loader would cut transfer roughly in half.

## 6. Canonical identifiers (Stage 2 draft in `ids/`)

- **company_id** `c_<slug of legal name>` — stable, never reused, never changed on rename (the name changes, the id does not).
- **listing_id** `<MIC>:<ticker>` (e.g. `XLON:ECO`, `XTSE:LUN`, `MERK:SNM`). A company has 0..n listings; one is `primary`.
- Listing row carries: exchange, ticker, currency, **quote unit** (GBX for London pence, ILA for Tel Aviv agorot), Yahoo, TradingView and CNBC symbols. Provider symbols are attributes, never keys.
- Private, state-owned and subsidiary entities get a company_id with no listing; subsidiaries point to `parent_company_id`.
- Every old key (Moonshot Screen code, pilot ticker, Norway short name, country-file name, EMMA Yahoo symbol) maps through `ids/id_map.csv`.
- Matching rule: **code first** (exchange + ticker), name only as a fallback that a human confirms. Moonshot's current fuzzy name match in the chart misfiles at least RCM→CRI and CRI→BCM.
- **Event ids are unstable today and double as calendar UIDs** [confirmed by research inventory]: past events `E-<code>-<date>-<hash of headline>`, pilot `P-<ticker>-<date>-<hash>`, upcoming `<prefix>-<code>-<date>-<position in list>`, Norway `NO001…NO246` (stable). A headline fix, date slip or reorder creates a new id → duplicate calendar entries and orphaned hand decisions (the manual CSVs are keyed by event id). Rule: **freeze every current event id in the old→new map** (to be added as `ids/event_id_map.csv` in Stage 3) and assign new ids that never change; `.ics` UIDs stay as they are today (`<id>@moonshot`, `NOxxx-moonshot-norway`).

## 7. Authoritative sources vs generated outputs  [confirmed by research inventory]

| Authoritative (edited by people) | Generated (never hand-edit) |
|---|---|
| EMMA `scripts/universe.py`, `data/powered_land_deals.json`, `scripts/precip_normals.json` | EMMA `data/*.json`, `data/co/*`, everything on `live-data`, `tracker-history` |
| Moonshot hand decisions (`review/config.json`, five `review/manual_*.csv`), hand-curated pilot `companies.csv` and labels; target: curated research records split out of `smallcaps.json` | Moonshot `smallcaps.json` (today generated *and* edited in place — to be split), `coming_up.json`, both `.ics`, `briefing.json`, `read_across.json`, `slipped.json`, country files, reaction summaries, audit logs |
| New: `merge/ids/*.csv` once approved | Google Sheet (export only, if kept) |

## 8. File ownership (proposal)

- Technical lead (Mark): workflows, build scripts, site code, `live-data`, ID tables' format and checks.
- Research owner (Cori): research content — screen membership, events, what changed, sources, Norway and country data, the ID tables' content (which company is which).
- Changes to the other side's files go by PR with the owner as reviewer.

## 9. Event-return method (one method for both)

Today there are two [confirmed by research inventory]: the Screen stores **abnormal returns vs the local index** (ASX Small Ords; FTSE AIM All-Share; FTSE All-Share) at r5 / r20 / r60, Day 1 = first close on or after the event date — **so the event-date close is included and after-close news is counted one session early**. Most of these values were written by a retired script (matched by list position; must not be re-run) and the prices exist only in local Yahoo caches, so they cannot be rebuilt exactly. The pilot register uses ETF benchmarks (COPX, GDXJ, GDX, XOP, XLE) at day 0 / 5d / 20d / 60d plus 20- and 60-day run-up. Consequence: run old and new side by side and keep the old values as a labelled method version.

Proposed single method:
- **Release-timing rule.** The "before" window ends at the **last close before the announcement**. News released after the close (or on a non-trading day) counts from the **next session's close**. Pre-open news counts from the same day's close.
- This needs an announcement **time** (or at least a pre-open / intraday / after-close flag) per event; today only a date is stored, so "first close on or after event date" is wrong for after-close news.
- Benchmark per listing (stored on the listing row): local small-cap index by default; a sector benchmark only as a second, labelled column.
- Horizons: 1, 5, 20, 60 trading days; price in the listing's quote unit, converted only for display.

## 10. Public file list (draft — depends on the OPEN DECISION)

Public now on the sites: everything in both repos (both are public). Proposed public after merge: site code, generated JSON the pages read, `.ics` calendars, `merge/ids/*` (public identifiers only). Candidate private (pending decision): hand decision notes (`config.json` reasons), manual source lists, the briefing text, watch-list reasoning, workflow logs.

## 11. Pilot scope (proposal)

Start with the companies already in both sites (30 research companies; see `ids/collisions.md` §1 for the list): render them in EMMA's company panel with Moonshot events, using the new ids, behind a separate route. No change to Moonshot's live pages during the pilot.

## 12. Checks and rollback

Checks before any switch: every row of `feature_checklist.md` ticked; every old id in `id_map.csv` resolves; no listing without currency/quote unit; calendar UIDs unchanged (diff of `.ics`); page size and runner minutes not above the baselines in §5; all paths in §4 still answer.
Rollback: work lands on branches only; `main` of either repo changes only by reviewed PR; any switch is a single revertible commit; `live-data` keeps being produced by the current workflows until the new path is proven.

## 13. Open questions (for the product owner)

1. **OPEN DECISION: what counts as private?** (decides §10 and where the authoritative research data lives)
2. Accept the runner-minutes baseline change: 2,349 job-minutes/week (job-level) instead of ~3,860 (wall time incl. queueing)?
3. Where should the single research source live (public repo, private repo, or elsewhere)? Follows from 1.
4. Moonshot blocks all crawlers (`robots.txt`); should the merged site keep that?
5. One event-return method (§9) for both sites — OK to change the screen's published numbers when the release-timing rule is applied?
6. Pilot scope (§11) — the 30 shared research companies, or a smaller set?
7. Retire the Google Sheet, or keep it as a generated read-only view?

## 14. Still open with the research owner (Cori)
- Routine definitions and outputs (Monday coming-up note, monthly refresh 1st–7th) — not visible to either read.
- Announcement times (or pre-open / after-close flags) for events, needed for §9.
- Confirm secondary tickers flagged "to verify" in `ids/` (Stockholm LUG, LUMI; Botswana LUC) and the unverified Lime parent.
- MAU: the inventory lists it as one company under two codes; the data says otherwise (see `ids/collisions.md`).
- Why the public `norway_events.ics` differs from the working copy.

Inventory received: 24 datasets, ~172 fields, ~60 features (cross-checked in `feature_checklist.md`).
