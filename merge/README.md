# merge/ — EMMA + Moonshot merge, Stages 1–2 (working files)

Planning material only. Nothing in this folder is read by the site, the build scripts or any workflow, and this branch does not publish (GitHub Pages builds from `main`).

| File | What it is |
|---|---|
| `integration_note.md` | Stage 1: data flows, schedules, dependencies, baselines, identifiers, sources vs outputs, ownership, event-return method, public file list, pilot scope, checks and rollback, open questions |
| `feature_checklist.md` | Stage 1: "no feature lost" checklist of every user-visible feature on both sites |
| `ids/companies.csv` | Stage 2 draft: one row per company, stable `company_id` |
| `ids/listings.csv` | Stage 2 draft: one row per listing (exchange, ticker, currency, quote unit, Yahoo / TradingView / CNBC symbols) |
| `ids/id_map.csv` | Stage 2 draft: every old identifier in either site → new `company_id` / `listing_id` |
| `ids/collisions.md` | Stage 2: ticker collisions, dual listings, name changes, delisted / private / unverified entries |
| `tools/` | Scripts used for the baselines and the ID draft, so the numbers can be re-run |

Status: draft. The research owner's Stage 1 inventory (30 Oct 2026) is folded in; items it confirmed are marked **[confirmed by research inventory]**.
