# "No feature lost" checklist (Stage 1, started 30 Oct 2026)

Every user-visible feature on both sites. Tick a row only when the merged site does the same thing at the same or a redirected address. Baselines: EMMA `main` today; Moonshot public `main` @ 4e08b27 (PR 23), not the working copy.
Sources: Mark's walk-through of both live sites and their code; Moonshot rows cross-checked against the research owner's inventory (~60 features). Rows marked (R) were found only in the research inventory; (M) only in Mark's walk-through.

## EMMA

| # | Area | Feature | ✓ |
|---|---|---|---|
| E1 | Shell | Top navigation: Home, Companies, Markets, Nordic power, Gas storage, Grid & data centres | ☐ |
| E2 | Shell | Hash routes stay valid: `#equities/<chip>`, `#macro`, `#macro/indices|commodities|rates`, `#power` (+ sub-tabs), `#gas`, `#charts` | ☐ |
| E3 | Shell | Live data from `live-data` branch with fallback to `main` copies; "as of" times | ☐ |
| E4 | Shell | raw.githack share link works | ☐ |
| E5 | Home | Dashboard tiles (markets, power, gas summaries), "what drove it" notes, month-to-date and monthly-review views | ☐ |
| E6 | Equities | Group chips: Renewables, Oil & Gas, Metals & Mining, Lundin Group | ☐ |
| E7 | Equities | Sortable company table with intraday prices and moves | ☐ |
| E8 | Equities | Search box and quick picks (any Yahoo symbol, e.g. Apple … Toyota) | ☐ |
| E9 | Equities | Company panel: chart, key data, Yahoo ↗ link | ☐ |
| E10 | Equities | Compare view | ☐ |
| E11 | Equities | Valuation view | ☐ |
| E12 | Charts | Simple chart (CNBC-backed, no history) | ☐ |
| E13 | Charts | TradingView charts | ☐ |
| E14 | Macro | Indices, commodities, rates tables; HO futures curve | ☐ |
| E15 | Nordic power | Spot, Forwards, Drivers, SE4, News sub-tabs; power map | ☐ |
| E16 | Nordic power | Hydro balance, precipitation vs normals, Finnish wind, Nordic monthly | ☐ |
| E17 | Gas storage | Country storage levels and charts | ☐ |
| E18 | Grid & data centres | Grid connection / data-centre events, deal flow (powered-land deals), balancing, MaStR | ☐ |
| E19 | Grid | UK / DE tracker with history | ☐ |
| E20 | Health | Build health summary; "Build alert" issues on failure | ☐ |
| E21 | Performance | First load under 600 KB (baseline 0.40 MB transferred) | ☐ |

## Moonshot

| # | Area | Feature | ✓ |
|---|---|---|---|
| M1 | Header | Light/dark theme toggle (remembered) | ☐ |
| M2 | Header | Last tab remembered (R) | ☐ |
| M3 | Header | This week strip: new material events, new setbacks, catalysts next 30 days, guidance windows passed — each opens a list | ☐ |
| M4 | Header | How to read guide and legend (R) | ☐ |
| M5 | Access | Skip link, WCAG 2.1 AA basics; phone layouts with cards instead of tables (R) | ☐ |
| M6 | Screen | Table of all companies incl. Nordic, Tel Aviv, EU and Norway shelf (Not listed for private/state) | ☐ |
| M7 | Screen | Search; sort (incl. next event soonest/latest) | ☐ |
| M8 | Screen | Filters + More filters: market, commodity, stage, size band, sector, category (R) | ☐ |
| M9 | Screen | Column chooser (company, exchange, commodity, stage, market cap, median daily, material 12m, setbacks, latest material, cash flag, runway, upcoming, next) (R) | ☐ |
| M10 | Screen | Funding runway detail (cash, burn, debt/facilities, source) | ☐ |
| M11 | Screen | Upcoming items with date-basis chips (Confirmed, Company target, Estimate); Past guided date, Slipped, Overdue | ☐ |
| M12 | Screen | Related events from partners | ☐ |
| M13 | Screen | Price-reaction panel by tier and event type | ☐ |
| M14 | Events | One timeline of pilot register, Screen events and Norway shelf | ☐ |
| M15 | Events | Company swimlane chart: up to 25 lanes, Show all companies, Hide timeline (remembered), lane sort (next catalyst, latest material change, watchlist first, most events), Today line, filled/open markers, dashed outline for month-or-wider windows, star for setbacks, max 3 markers/week then a count, sideways scroll, popover | ☐ |
| M16 | Events | Filters: range, significance/tier, direction, status, date confidence, market, sector, category, country, size band, search, Show background; Clear filters | ☐ |
| M17 | Events | All filters in the page link (shareable URL) (R) | ☐ |
| M18 | Events | Upcoming switch | ☐ |
| M19 | Events | Event cards: source badge (Primary, Secondary, Listing page, Missing) with last-checked on hover; all sources and merged revisions | ☐ |
| M20 | Events | What changed (before, evidence, risk effect, next milestone) | ☐ |
| M21 | Events | Guidance history | ☐ |
| M22 | Events | Historical context r5 / r20 / r60 | ☐ |
| M23 | Events | Also affects (read-across) | ☐ |
| M24 | Events | Pilot detail: risk removed, stage reached, labels; Show more | ☐ |
| M25 | Coming up | Horizon (30 days default, up to 12 months) | ☐ |
| M26 | Coming up | Filters: market, sector, category, significance, direction, status, confidence, Material only, Watchlist only | ☐ |
| M27 | Coming up | Table and phone cards; date-basis chips; guidance history; Past guided date / Slipped / Overdue badges | ☐ |
| M28 | Countries | Falklands, Namibia, Guyana, South Africa, Gabon, Angola, Colombia: companies, context, catalysts (Past, Upcoming, Further out), Material/Setback/Background chips, sources | ☐ |
| M29 | Watchlist | Pin companies across all datasets incl. Not listed; kept in browser (`moonshot-watch`) | ☐ |
| M30 | Watchlist | `watch=` link to move a list; copy link | ☐ |
| M31 | Calendars | `coming_up.ics` and `norway_events.ics` at their current addresses; UIDs unchanged (no subscribe button today) | ☐ |
| M32 | Privacy | Search engines blocked (`robots.txt` Disallow all) — keep or drop is an open question (M) | ☐ |
| M33 | Performance | Baseline first load 0.95 MB transferred (data files fetched several times — fix, don't copy) (M) | ☐ |

## Outside the sites (must keep working, not features)
- Moonshot routines: Monday coming-up note; monthly refresh (1st–7th).
- EMMA consumers of `live-data` paths (monitor, briefing tiles, review workbook) — see `integration_note.md` §4.
- Google Sheet (stale view; retire or regenerate — open question).

## Cross-check result
- The research inventory's Moonshot list is a superset of Mark's: it adds M2, M4, M5, M8, M9, M17 (and finer detail in M15). Nothing in Mark's Moonshot list was missing from it apart from M32–M33, which are properties rather than features.
- One detail to verify on the live site: "up to 25 lanes" in M15 (taken from the inventory).
- Most at risk (PR 17 precedent, when the swimlane chart was dropped and later restored): M15, M17, M30, M21, M20, M13, M28, M31.
- The inventory covers Moonshot only; EMMA rows E1–E21 are Mark's.
