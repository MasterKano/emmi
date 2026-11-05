# Privacy cutover (abandoned)

The November 2026 plan to move this site onto Cloudflare Pages behind Cloudflare Access was abandoned. The Cloudflare account was deleted. Do not configure Cloudflare Pages, Access, Wrangler, or a card for this site.

The site is public again on GitHub Pages:

https://masterkano.github.io/emmi/

`.github/workflows/deploy.yml` builds the same public file list as before the cutover (`scripts/site_files.sh`) and publishes it with `actions/deploy-pages` on every push to `main` and on `workflow_dispatch`. Pull requests only build the artifact.

## What stayed from the cutover

Live prices still load from the public repo [MasterKano/emmi-data](https://github.com/MasterKano/emmi-data), branch `live-data`:

`https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/`

`live.js` tries that host first and falls back to the copy of `data/` published with the site. Price workflows stay on emmi-data. They are not required in this repo for the site to load. Copies used to seed emmi-data remain under `cutover/workflows/`. `scripts/seed_emmi_data.sh` is how that repo was filled.

`gate.js` (localStorage key `emmaGate`) is still the password page on the published HTML. It is not a private host. Calendar files on the Pages site are ordinary static files; anyone with the link can read them.

## One-time: turn Pages on

GitHub Actions cannot create the Pages site. `GITHUB_TOKEN` cannot hold `administration:write`, and `POST /repos/MasterKano/emmi/pages` from this repo's app returns 403 (`Resource not accessible by integration`). A repository admin does this once. There is no `gh-pages` branch; the source is GitHub Actions.

```bash
gh api --method POST -H "Accept: application/vnd.github+json" \
  /repos/MasterKano/emmi/pages \
  -f build_type=workflow
```

The same switch is Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Verify after this change is on main

1. Pages source is GitHub Actions (the call above returned 201, or a later GET is not 404).
2. The **Deploy site (controlled Pages build)** workflow on `main` is green, including the `deploy` job.
3. https://masterkano.github.io/emmi/ returns 200 and the monitor loads.
4. In the browser network panel, `data/market.json` is requested from `raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json`.
