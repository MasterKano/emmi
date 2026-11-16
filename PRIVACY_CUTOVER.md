# EMMi privacy (16 Nov 2026)

EMMi is served only from Cloudflare Pages, behind Cloudflare Access:

https://emmi-e2e.pages.dev/emmi/

GitHub Pages (https://masterkano.github.io/emmi/) was retired on 16 Nov 2026 at Jerry's request: the Pages job was
removed from `.github/workflows/deploy.yml` and Pages was disabled on the repo.

## Where the site's data comes from

The site no longer reads anything from `raw.githubusercontent.com`. `deploy.yml` clones MasterKano/emmi-data with a
read-only deploy key (repo secret `EMMI_DATA_DEPLOY_KEY`; public half under emmi-data Settings → Deploy keys) and
bundles a copy on the site:

| emmi-data | on the site |
| --- | --- |
| `main` (`curves/`, `data/`, `nordic-climate/`, `nordic-v2/`, `og-mining-v2/`) | `/emmi/ed/main/` |
| `live-data` (`data/`) | `/emmi/ed/live/` |
| heads used for the build | `/emmi/ed/stamp.json` |

`live.js` sends `data/...` requests to `/emmi/ed/live/` first and falls back to the copy in this repo's `data/`.

## Freshness

`.github/workflows/data-watch.yml` polls the heads of emmi-data `main` and `live-data` and this repo's `main` every 45 s
and dispatches `deploy.yml` when one moves, so a data push is on the site in a few minutes (poll + ~2 min deploy).
It chains itself like emmi-data's `ticker.yml`; the hourly schedule only revives it.

## Not private yet

- This repo (MasterKano/emmi) is public: its `data/`, `pulse/`, `csi/` and `research/` sources can be read on GitHub.
- MasterKano/emmi-data is public. Making it private is safe for the site (deploy key), but its own Actions
  (`ticker.yml` runs around the clock, `intraday.yml` every 15 min) would then bill private-repo minutes far above the
  free allowance, and `ticker.yml` / `update-data.yml` read their own raw URLs without a token.
- Calendar feeds under `/emmi/research/*.ics` are behind Access, so calendar apps cannot fetch them unless an Access
  bypass rule is added for that path.
