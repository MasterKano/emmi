# EMMI · Energy · Minerals · Market · Intelligence

Static markets dashboard (GitHub Pages): https://masterkano.github.io/emmi/

Immediate share link (no Pages wait): https://raw.githack.com/MasterKano/emmi/main/index.html

## Pages

Top-level tabs (URL hash in brackets; older hashes such as `#nordic`, `#rates`, `#monitor` redirect):

- **Equities** (default, `#equities/<chip>`): chips Renewables (incl. benchmarks and strategic peers), Oil & Gas (incl. London-listed E&Ps),
  Metals & Mining, Lundin Group. Price returns 1D to 10Y, volume vs 5/20/50-day averages (ratio highlighted above 1.5x),
  distance from 10/20/50/200-day moving averages, a 1-year sparkline, market cap / EV in EUR, company panel, news and a Deal flow panel (material announcements for the Renewables, Oil & Gas and Lundin Group names).
- **Macro** (`#macro[/indices|commodities|rates]`): Indices, Commodities and Rates & FX as sections on one page (no
  company data), merged macro news.
  Heatmap colours are scaled per horizon. Click a header to sort, a row to open its TradingView chart.
  *Compact* hides 2Y-10Y and the 5d/10d columns; the *Volume* and *Moving avg* switches show/hide those column
  groups (off by default on phones/narrow screens, on for desktop; choices are remembered per browser).
  Instrument, Market (listing venue) and Last stay pinned while scrolling sideways. A collapsible
  "How to read this table" panel explains price source, volume ratios and MA distances. Missing data shows as `n/a`.
- **Power** (`#power`): Nordic Power dashboard with its own sub-navigation (Spot, Forwards, Drivers, SE4, News): day-ahead map of the Nordic bidding zones coloured by today's (or tomorrow's)
  daily average, zones × hours heatmap (negative prices outlined), daily/7d/30d averages and key spreads; EEX forward
  curves per zone with the Nordic system price and Germany overlaid, a zone × tenor table (price, day/week/since-1-Sep
  changes, implied EPAD vs system, vs DE), zone premia and benchmark history; power drivers (TTF, EUA, API2 coal,
  GoO wind); Norwegian reservoir filling vs the NVE 2006–2025 min/median/max band plus a Swedish snapshot; news.
- **Research** (`research/`, link in the top bar): the former Moonshot site, moved onto EMMA in Stage 5 (30 Oct 2026) —
  Screen, Events (timeline and swimlanes), Coming up, Countries and Watchlist, same code and data, behind the password page.
  Code in `research/app/`; data from `research/app/data/` overlaid by Cori's `research/source/moonshot/` at build time.
  Calendar feeds (subscribe in any calendar app; same event UIDs as the old Moonshot feeds, CRLF, checked by
  `scripts/check_ics.py` on every deploy): https://masterkano.github.io/emmi/research/coming_up.ics and
  https://masterkano.github.io/emmi/research/norway_events.ics. Calendar files cannot sit behind the password page:
  anyone with the link can read them. Details and the feature-parity table: `merge/stage5.md`.
- **Gas storage** (`#gas`): European gas storage from GIE AGSI+. Country chips / dropdown (EU total, 18 member states
  with storage, Ukraine for reference), headline cards (% full, TWh stored, net injection/withdrawal, vs 5-year average,
  vs same day last year, 7/30-day change), a seasonal chart (this year vs the previous five, shaded 5-year min–max
  band and average; switch % full / TWh / daily flow and Jan–Dec / gas year Oct–Sep; click legend keys to show or hide
  years; click a day to see every country on that day) with the EU filling-target box (90% at any point 1 Oct – 1 Dec,
  Regulation (EU) 2025/1733), and a sortable country table (click a row to chart it).
- **Charts** (`#charts`): four TradingView widget charts styled like the table cards (Timeframe and Moving averages
  controls apply to all four; the row pop-up chart in Equities/Macro always opens Daily with 50/100/200-day MAs): Markets, Commodities, FX and Rates / Bonds.
  Markets has an instrument dropdown plus type-ahead search over `data/symbols.json` (built by
  `scripts/build_symbols.py`: London LSE/AIM, Sweden OMX Stockholm, Norway Oslo, New York NYSE/Nasdaq/Arca,
  Toronto TSX/TSXV, Hong Kong HKEX, plus every equity/ETF/index TV symbol in `scripts/universe.py` and curated
  energy/mining peers such as Genel Energy). Client-side only — no API keys; TradingView's remote symbol-search often
  returns 403 from static hosts, so the offline index is the primary autofill. Quick-pick chips and in-widget symbol
  change remain. Searched symbols are kept under "Recent". Exotic names outside the index may need `EXCH:SYM` or the
  in-chart TradingView search. Rates / Bonds uses Treasury and credit ETFs because TradingView does not allow Treasury
  yields (TVC:US*) in embedded widgets; for the same reason, yield rows on the Table open a Yahoo 1-year line chart
  (TradingView ↗ still links to the full chart).

## Data

`.github/workflows/update-data.yml` runs on weekdays at 05:30, 12:30 (Nordic Power only) and 21:00 UTC (markets and
news only), and on demand, and commits:

Late or dropped morning build: GitHub often starts the 05:30 schedule late or not at all, so three things back it up.
`.github/workflows/ticker.yml` (the long-running job that dispatches intraday prices every 15 min) checks on
weekdays from 06:00 to 15:59 UTC whether today's full build exists (`fundamentals_utc` in live-data
`data/market.json` after 04:00 UTC, or a successful full run since then); if not, and no Update market data run is
queued/in progress and no catch-up was dispatched today, it dispatches one full build with `catchup=true`. The
catch-up crons (09:45 / 13:45 UTC) and the 05:30 schedule are gated the same way, runs share one concurrency
group (queued, never cancelled), and a gated run that waited behind a full build skips, so there is at most one full
build per morning.

- `data/market.json` from `scripts/build_data.py`: Yahoo Finance daily bars (chart API with retries/backoff,
  yfinance fallback). Price returns, not total return. Futures are continuous front-month, so long horizons
  include roll effects. Universe: `scripts/universe.py`.
- Intraday prices: `.github/workflows/intraday.yml` runs `build_data.py --intraday` every 15 min on weekdays
  (:07/:22/:37/:52, 05-21 UTC): latest Yahoo quote + time, 1D vs previous close, mkt cap / EV scaled from the last full build.
  It is not committed: it updates `data/market.json` on the single-commit orphan branch `live-data` (the same file the
  full builds write; each intraday run starts from the latest published copy). `scripts/publish_live.sh` only replaces
  that file with a copy from a newer full build (`fundamentals_utc`) or, for the same full build, newer prices.
- `data/news.json` from `scripts/build_news.py`: Google News RSS searches plus exchange announcements
  (Oslo Børs NewsWeb, Nasdaq Nordic). Headlines and links only. FT excluded.
- `data/dealflow.json` from `scripts/build_dealflow.py` (05:30 full + 12:30/17:30 power runs): material
  corporate announcements for the Renewables (incl. strategic peers), Oil & Gas (incl. London E&Ps) and
  Lundin Group companies, last 30 days. Sources (keyless, public): Oslo Børs NewsWeb JSON, MFN
  (`mfn.se`), Nasdaq Nordic / GlobeNewswire, Investegate RNS for London names, Yahoo Finance news for
  other EU/US/Canada names, and the FI insider register CSV (`fi.se`) for Swedish issuers. Each headline
  is typed by fixed keyword rules (M&A, capital raise, PPA, financing, insider, results, project, other);
  routine notices (buybacks, AGM, Form 8.3, calendars) are collapsed into counts. Solar/wind/battery/
  data-centre flags and an indicative €/MW (when one sentence states both amount and capacity) are
  attached. The Equities page shows a filterable Deal flow panel; each company page shows an
  Announcements section, and Swedish names get a FI insider table on Ownership & insiders.
- `data/companies.json` + `data/co/SYMBOL.json` from `scripts/build_companies.py` (05:30 and 21:00 runs): the
  company page (click a company name in the Table; shareable as `#co=SYMBOL&tab=fin|analysts|own|mgmt`).
  `companies.json` is a small index (price, valuation, consensus, key stats, dates) read with the Table;
  `data/co/SYMBOL.json` holds the detail loaded on demand when a page opens: profile, officers and pay,
  governance scores, ownership and top holders, insider transactions and holders, recommendation trend,
  rating changes, estimates and revisions, earnings surprises, full income / balance / cash-flow statements
  (5 years, 6 quarters, TTM), ratios and dividend history. Sources: Yahoo quoteSummary, the
  fundamentals-timeseries endpoint and the chart endpoint (dividends), fetched with 4 threads. EV = market cap
  + net debt (+ minorities) with the balance sheet converted at current FX. Per-symbol failures keep the previous
  files; detail files are only rewritten when their content changes.

- `data/symbols.json` from `scripts/build_symbols.py`: offline Markets chart autofill catalog (name + TradingView
  `EXCH:SYM` + kind). Built from Nasdaq Trader directories and a filtered free ticker database for LSE/AIM, OMXSTO,
  OSL, NYSE/Nasdaq/Arca, TSX/TSXV and HKEX; no API keys. Re-run locally when refreshing the catalog; optional in CI.
- `data/power.json` from `scripts/build_power.py`:
  - EEX daily settlements from the public CSV at `MasterKano/scrape` (`master/eex_master.csv`, read via
    raw.githubusercontent.com). Base-load Month/Quarter/Year futures for the Nordic system price, the Nordic zones
    (outright EEX Nordic Zonal Futures, not EPADs) and DE/FR/NL/GB/ES/IT, plus TTF, EUA, API2 coal and GoO wind.
    History starts 1 Sep 2026 (no backfill). Contracts already in delivery are excluded.
  - Day-ahead prices (A44) for NO1–NO5, SE1–SE4, FI, DK1, DK2 plus DE-LU, PL, LT from the ENTSO-E Transparency
    Platform (needs the `ENTSOE_API_TOKEN` env var / GitHub secret; 92 days of history). Fallbacks per zone:
    Energy-Charts (Fraunhofer ISE, CC BY 4.0), Energinet Energi Data Service (DK1, DK2, NO2, SE3, SE4, DE) and
    spot-hinta.fi (today/tomorrow only). Daily averages from earlier runs are kept so 7d/30d averages survive outages.
    15-min prices are averaged to hourly; days are CET delivery days and are shown in Geneva time.
  - ENTSO-E SE4 detail: wind/solar actual (A75) vs day-ahead forecast (A69, short horizon only), load actual vs
    day-ahead forecast and week-ahead min/max (A65), physical flows on SE4 borders (A11, fallback for SVK),
    unavailabilities (A78 interconnectors, A80 generation aggregated by fuel; no unit/plant/line names) and weekly
    reservoir stored energy (A72) for SE1–SE4 / NO1–NO5. Wind/solar capture prices (7d/30d, daily, and expected
    today/tomorrow from the forecast) are computed from A44 × A75/A69. ~60 requests per run, throttled well below the
    400/min limit, retried on 429/5xx; failed parts keep the previous values. The token is never logged.
  - Hydro: NVE magasinstatistikk API (Norway and NO1–NO5, weekly) and the Energiföretagen weekly PDF (Sweden snapshot).
  - FI / DE-LU capture prices use Energy-Charts generation.
  - Schedule: power runs at 05:30 and 12:30 UTC on weekdays (12:30 captures tomorrow's day-ahead prices), at 12:30
    UTC on Saturdays and Sundays, and daily at 17:30 UTC, after the D-1 18:00 Brussels deadline for the day-ahead
    wind/solar forecast (A69), so the SE4 "tomorrow expected" capture row fills in.
- `data/mr.json` from `scripts/build_mr.py` (power + full builds): Nord Pool day-ahead daily prices (public API, 2024 on;
  system price yearly averages 2011-2023 as published by Nord Pool), ENTSO-E A44 monthly area prices 2015-2023 (needs
  `ENTSOE_API_TOKEN`), EEX base futures settlements from the public EEX CSV also used by the Forwards section, TTF / EUA /
  API2 settlements from the same CSV, Ember monthly electricity data (CC BY 4.0, refetched weekly) and ERA5 monthly
  reanalysis (Copernicus C3S) area means. Feeds the MR block after News.
- `data/gas.json` from `scripts/build_gas.py` (power + full builds): GIE AGSI+ API (`agsi.gie.eu`, needs a free key in
  the `GIE_API_KEY` env var / GitHub secret, sent only in the `x-key` header and never logged; the step is skipped and the
  previous file kept when it is unset). EU aggregate + countries, daily by gas day. Each run refetches the last 60 days
  (AGSI revises recent days); missing years are backfilled. Output is split: `data/gas.json` is a small index
  (latest stats per country, targets, notes) and `data/gas/<CODE>.json` holds each country's daily history, which the
  Gas tab fetches only for the country on screen (and for all countries when a past day is clicked). The UK is not in AGSI+ after 2020 (pre-Brexit only).

Local run: `pip install -r scripts/requirements.txt && python scripts/build_data.py && python scripts/build_news.py && python scripts/build_dealflow.py && python scripts/build_power.py && python scripts/build_symbols.py && python scripts/build_companies.py`,
then `python -m http.server` and open http://localhost:8000/.

## HO futures curve (NY Harbor ULSD)

Standalone fetcher for the NYMEX HO (heating oil / ULSD) futures curve, all listed months, from public delayed
sources (no login or key). Not wired into the site yet. Sources, tried in order; the first that returns at least 6
months is used for the whole run (never mixed) and named in the `source` column:

1. `tradingview_scanner`: TradingView's public futures scanner, one request, all listed months (~10 min delayed).
2. `yahoo`: Yahoo per-contract quotes (HOX26.NYM, ...), next ~24 months, one paced request each; months with no
   recent data are skipped.

`wsj` (WSJ's HO00 contracts page, all listed months) works locally with `--source wsj` but WSJ answers GitHub
Actions runners with HTTP 401, so it is not in the automatic chain. Investing.com (403, intermittent), Barchart
(bot challenge) and The Globe and Mail (contracts table rendered client-side) were tested and are not used.

- Run locally (Python 3 stdlib only): `python scripts/ho_curve.py --out data/ho_curve.csv`
  (add `--history data/ho_curve_history.csv` to also append to a history file; `--source wsj` etc. forces one
  source for testing; `--probe` checks which candidate sites respond, writing nothing).
- Columns: `contract` (e.g. HOZ26), `month` (YYYY-MM), `last`, `change`, `open`, `high`, `low`, `volume`,
  `prior_settle` (previous settle/close; blank on WSJ once the day's settle is out), `source`, `fetched_at_utc`.
  Prices in USD/gal as quoted, sorted by month. Contracts with no price are dropped, never filled. If no source
  returns at least 6 months the script exits non-zero and writes nothing, so the last good file stays.
- Workflow `.github/workflows/ho-curve.yml` (weekdays 21:07 UTC, after the NYMEX settle, plus manual
  `workflow_dispatch` with optional `source`, `publish` and `probe` inputs) publishes to the `live-data` branch:
  `data/ho_curve.csv` (latest) and `data/ho_curve_history.csv` (one snapshot per UTC day; a rerun the same day
  replaces that day's rows).
- Raw URL: https://raw.githubusercontent.com/MasterKano/emmi/live-data/data/ho_curve.csv
  (history: https://raw.githubusercontent.com/MasterKano/emmi/live-data/data/ho_curve_history.csv)

## Where data lives, refresh and retention

Scheduled builds publish every data file to the **`live-data`** branch as one force-pushed commit (no history
growth); intraday prices update `data/market.json` there too (one market file; `fundamentals_utc` inside it is the
time of the last full/market build). The site reads data from there
(`live.js`) and falls back to the frozen copies under `data/` on `main`. Builds start by loading the current files
from `live-data`, so each file keeps rolling within the window below. Skip-if-fresh checks use the
`generated_utc` stamp inside each file (not file times). Each build ends with a health summary; any failed step or
expected file not updated opens or updates one `Build alert YYYY-MM-DD` issue.

| File | Refresh | Keeps | Size budget |
|---|---|---|---|
| `data/market.json` | full + market builds; prices every 15 min in weekday market hours (intraday) | latest + 1Y sparkline history | < 300 KB |
| `data/power.json` | power + full builds | day-ahead 95 days, Nord Pool system 35 days, nuclear next 14 days, SE4 detail 7 days hourly / 30 days daily, reservoirs 53 weeks + year before | < 200 KB |
| `data/nordic_dash.json` | power + full builds | rolling 30 days hourly (+ tomorrow's prices); zone series delta-encoded | < 300 KB |
| `data/fi_wind.json` | power + full builds | recent days hourly + forecast | < 20 KB |
| `data/nordic_precip.json` | daily forecast part; monthly part monthly | 13 months + 14-day forecast | < 10 KB |
| `data/nordic_monthly.json` | monthly (skip if fresh) | 24-25 months + 2021-2025 average | < 50 KB |
| `data/hydro_nordic.json` | weekly (skip if < 6.5 days) | this year + last year weekly, 10-year band | < 20 KB |
| `data/us_valuation.json` | monthly (skip if < 25 days) | full history, monthly/yearly aggregates | < 50 KB |
| `data/gas.json` | power + full builds | index: latest figures per country (loaded on site open for the Home line) | < 20 KB |
| `data/gas/<CODE>.json` | power + full builds | one country's history, loaded when its chart opens: this year + 5 previous (fill %; TWh and net flow this year + last, all six for the EU; injection / withdrawal this year) | < 60 KB each |
| `data/mr.json` | power + full builds | daily system/area prices 2024+, monthly 2015+, yearly 2011+, EEX futures (latest + ~1 month ago), fuels, Ember monthly 2015+, ERA5 weather 1970+; loaded only when the MR block is open | < 200 KB |
| `data/balancing.json` | power + full builds | 90 days | < 30 KB |
| `data/mastr_de.json` | weekly | monthly aggregates | < 10 KB |
| `data/news.json`, `data/dealflow.json` | full builds | latest items (insider window 90 days) | < 100 KB each |
| `data/griddc*.json` | full builds (events weekly check) | latest registers / state for diffs | < 50 KB each |
| `data/companies.json`, `data/co/*.json` | full builds | latest fundamentals per company | < 150 KB, < 30 KB each |
| `data/symbols.json` | full builds | search index (loaded only on search) | < 1 MB |

**Size budgets.** What matters is what a visitor downloads, so the budget is split:

- **Initial load** (fetched when the site opens on Home): `data/market.json`, `data/power.json`, `data/dealflow.json`,
  `data/griddc.json`, `data/gas.json` (index), `data/balancing.json`, `data/griddc_events.json`,
  `data/hydro_nordic.json`, `data/fi_wind.json`, `data/mastr_de.json`, `data/powered_land_deals.json`:
  **< 600 KB together** (about 510 KB on 19 Oct 2026).
- **On demand** (fetched when a tab, chart, company or search is opened): each file < 300 KB (`data/co/*.json`
  < 30 KB each, `data/gas/<CODE>.json` < 60 KB each); `data/symbols.json` < 1 MB (search only). There is no limit
  on the sum of on-demand files, since no page loads them all.

`scripts/health_summary.py` checks these after every build and reports any file or the initial-load total over
budget as a notice in the build summary (not an alert).

Hand-maintained (stay on `main`): `data/powered_land_deals.json`, `scripts/precip_normals.json` (1991-2020 normals).
