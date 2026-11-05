# Privacy cutover

Company research and the site must not be readable from a public GitHub URL. Live prices stay on a **public** repo so GitHub Actions minutes stay free. The site moves to Cloudflare Pages with Cloudflare Access in front.

Jerry signs in to Cloudflare after this change. Nothing in this repo is a Cloudflare password or API token.

## Repos

| Repo | Visibility | Holds |
|---|---|---|
| [MasterKano/emmi-data](https://github.com/MasterKano/emmi-data) | **Stay public** | Price workflows, data scripts, orphan `live-data` branch, append-only `tracker-history` |
| [MasterKano/emmi](https://github.com/MasterKano/emmi) | **Make private** after the steps below | Site HTML/JS/CSS, `research/`, research workflow, `research-history` |

The site loads prices from:

`https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/`

`live.js` tries that host first and falls back to the copy of `data/` published with the site. `emmaGate` / the `emmaGate` localStorage key stays as a second check. Cloudflare Access is the real control. Do not put a password in the repo.

## Status when this branch was opened (5 Nov 2026)

The cloud agent can push `MasterKano/emmi` and **cannot** push `MasterKano/emmi-data`. The GitHub App installation for the agent includes only `MasterKano/emmi`. A push to emmi-data returned `403 Permission denied to cursor[bot]`, and creating a file through the API returned `Resource not accessible by integration`.

So this branch does **not** make emmi private, and it does **not** by itself move the running jobs. emmi is still public. The five price workflows are removed from emmi **on this branch**. Merging before emmi-data is seeded stops the 15-minute price chain.

**Do not merge until** `scripts/seed_emmi_data.sh` has succeeded and an Intraday prices run on emmi-data is green. Until that merge, emmi's workflows on `main` keep updating `MasterKano/emmi/live-data`, and the current GitHub Pages site keeps reading them.

## Order

Do these in order. Prices keep moving only if 1–3 finish before 4.

### 1. Seed emmi-data (account that can push it)

From a clone of this branch, with git credentials for MasterKano (not cursor[bot]):

```bash
bash scripts/seed_emmi_data.sh
```

That pushes:

- `main` — data scripts, `intraday.yml`, `ticker.yml`, `update-data.yml`, `ho-curve.yml`, `ttf-weather.yml`, a fallback `data/market.json`, README. No `research/`.
- `live-data` — the current emmi `live-data` tip (includes `data/market.json`).
- `tracker-history` — the current append-only tracker log.

Dry check, no push: `SEED_DRY_RUN=1 bash scripts/seed_emmi_data.sh`.

If emmi-data ever gets branch protection, open a pull request instead of pushing `main` directly. `live-data` is still a direct force-style publish from the workflows (same as today).

### 2. Prove the price chain on emmi-data

```bash
gh workflow run intraday.yml -R MasterKano/emmi-data --ref main
gh run watch -R MasterKano/emmi-data $(gh run list -R MasterKano/emmi-data -w intraday.yml -L 1 --json databaseId -q '.[0].databaseId')
```

Success means the run is green and this URL returns JSON with a fresh `generated_utc`:

https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json

Then start the 15-minute chain (it also revives itself from the hourly schedule once the workflow file is on `main`):

```bash
gh workflow run ticker.yml -R MasterKano/emmi-data --ref main
```

Leave emmi-data **public**.

### 3. Copy Actions secrets onto emmi-data

GitHub cannot display the existing secret values. Copy them from the original source into:

https://github.com/MasterKano/emmi-data/settings/secrets/actions

| Secret | Used for |
|---|---|
| `ENTSOE_API_TOKEN` | ENTSO-E prices, SE4 detail, reservoirs, monthly history |
| `FINGRID_API_KEY` | Finland wind |
| `FINGRID_API_KEY_SECONDARY` | second Fingrid key |
| `GIE_API_KEY` | GIE AGSI+ gas storage |

No new passwords. Intraday quotes do not need these. Until they exist, gas storage keeps the seeded file (`GIE_API_KEY` unset skips the step), and ENTSO-E / Fingrid sections fall back or keep prior values. The quote chain still runs.

### 4. Merge the emmi pull request

Merging does three things at once:

- `live.js` reads emmi-data.
- The five price workflows leave emmi, so a private emmi does not spend Actions minutes on prices. The research workflow stays.
- `deploy.yml` stops publishing GitHub Pages. It only builds `_site` and uploads a check artifact.

The GitHub Pages site that is already live keeps the previous bundle until step 8. That bundle still points at `MasterKano/emmi/live-data`. After this merge, emmi stops updating that branch, so **github.io prices freeze**. That is expected. The live prices are on emmi-data, and the site that reads them is the Cloudflare project in the next step.

### 5. Cloudflare Pages

Sign in at https://dash.cloudflare.com as the account that should own the site.

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub for **MasterKano** if asked. Choose repository **emmi** (`MasterKano/emmi`). It may already be private by the time you do this; Pages can build a private repo.
3. Set up builds:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `bash scripts/cf_build.sh`
   - Build output directory: `_site`
   - Root directory: leave empty (`/`)
   - Environment variables: none
4. Save and deploy. Wait until the production deployment is **Success**.
5. Note the hostname, shaped like `emmi.pages.dev` (the project name plus `.pages.dev`).

`wrangler.toml` records the same output directory. `_headers` is copied into `_site` by `scripts/site_files.sh` (noindex, no referrer, private cache).

`scripts/cf_build.sh` fetches `research-history` when the build can, and publishes the newest snapshot that contains `CHECK_PASS`. If the build log says `research-history not fetched`, the research app still builds from `main`; the pilot `research/out` snapshot is missing until the Pages GitHub app can read that branch. The research workflow on emmi still updates `research-history`.

### 6. Cloudflare Access (Jerry only)

Use the free plan (One-time PIN, up to 50 users). Do not add a second email. Do not add a Bypass policy, including for `*.ics`.

**From the Pages project (try this first):**

1. Workers & Pages → the emmi project → **Settings** → **General**.
2. **Access policy** → **Enable** → **Manage**.
3. Policy name: `Jerry only`.
4. Action: **Allow**.
5. Include rule: **Emails** → `jerryhohoho@gmail.com`.
6. Session duration: 24 hours is enough.
7. Identity provider: **One-time PIN** (no external IdP).
8. Save. Add the preview hostname as well (`*.<project>.pages.dev`) if the form has a separate domain list. Preview URLs that are not listed are public.

**If Access is only under Zero Trust:**

1. Open https://one.dash.cloudflare.com → **Access controls** → **Applications** → **Add an application** → **Self-hosted**.
2. Application name: `emmi`.
3. Session duration: 24 hours.
4. Application domain: the production hostname (`<project>.pages.dev`), path left blank (whole site).
5. Add a second hostname: `*.<project>.pages.dev` (preview deployments).
6. Identity providers: **One-time PIN**.
7. Add a policy: name `Jerry only`, Action **Allow**, Include → Emails → `jerryhohoho@gmail.com`.
8. Next, then **Add application**.

There is no allow-everyone rule. Anyone else who requests a code is denied.

### 7. Check the private site before turning github.io off

In a private browser window:

1. Open `https://<project>.pages.dev`.
2. Enter `jerryhohoho@gmail.com`. A code should arrive only at that mailbox.
3. Enter the code. The dashboard should open. `gate.js` may still ask for the existing site password (`emmaGate`). That hash is unchanged.
4. In the network panel, `data/market.json` should load from `raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json` and succeed.
5. Open Research. It should load. A logged-out window must not.
6. Try another email. Access must reject it.

Calendar links on Coming up are relative (`coming_up.ics`, `norway_events.ics`). They sit behind Access on purpose. A calendar app that cannot complete the email code cannot subscribe. Do not add an Access bypass for those files; the event list is research.

### 8. Make emmi private, then unpublish GitHub Pages

Do this only after step 7 works.

**Private repo**

1. https://github.com/MasterKano/emmi/settings → **Danger Zone** → **Change repository visibility** → **Private**.
2. Confirm the name `MasterKano/emmi`.
3. Logged out, https://github.com/MasterKano/emmi and https://raw.githubusercontent.com/MasterKano/emmi/main/research/app/index.html must not return the files (404).
4. `research-history` is a branch of this repo, so it becomes private with it.

**Unpublish GitHub Pages** (after the Cloudflare site works, not before)

1. https://github.com/MasterKano/emmi/settings/pages
2. **Unpublish site** and confirm.
   If the button is not there: `gh api --method DELETE /repos/MasterKano/emmi/pages`
3. Logged out, https://masterkano.github.io/emmi/ should 404.
4. Do not turn Pages back on. `deploy.yml` no longer calls `deploy-pages`. The old rollback (legacy Pages from `main`) would publish the site again, including research. Do not run it.

`raw.githack.com` links are removed from the README. Do not add a public CDN in front of this repo.

## What stays public on purpose

`MasterKano/emmi-data` and its `live-data` branch, including `data/market.json` and the other market files. That is the price feed. It is not the research site.

## Research workflow

`.github/workflows/research.yml` stays on emmi. It still writes `research-history` and dispatches `deploy.yml`, which now only checks that `_site` builds. A private emmi uses the account's Actions minutes for that job. It does not run on the price schedule.

`scripts/build_data.py` stays in emmi because `scripts/research/fetch_prices.py` imports it. The copy that the price jobs run is the one on emmi-data. If the Yahoo fetch changes in a way the pilot depends on, update both.

## If something breaks

- emmi-data intraday red: the previous `live-data` tip is still the seeded emmi tip until a publish succeeds. Fix the run, do not point the site elsewhere.
- Need the old price jobs back on emmi before Cloudflare works: restore the five files from `cutover/workflows/` into `.github/workflows/` on emmi `main` and do not merge a tree that deletes them. `live.js` on the already-published GitHub Pages bundle still reads `MasterKano/emmi/live-data` until Pages is replaced.
- Cloudflare build fails on `cf_build.sh`: the build image needs `bash` and `python3` (both are on the default Pages image). Build command and output directory must be exactly the values in step 5.
