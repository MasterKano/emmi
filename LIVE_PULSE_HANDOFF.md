# Live Pulse implementation · 18 Nov 2026

The homepage keeps the existing Briefs surfaces, risk dial, candles, ranked lists and energy panels. A compact seven-market board now leads: Brent, TTF, S&P 500, STOXX 600, ECO Atlantic, Orrön Energy and gold. Prices sit beside names; metric details link to charts, sources, fundamentals and explainers. No-hash visits land on Live Pulse; old explicit routes and the newsletter archive still work.

The written brief shows up to three short findings. Full legacy analysis is expandable. The editorial contract in `scripts/LIVE_COMMENT_WRITING.md` allows no findings on quiet days and requires evidence, judgement and honest uncertainty. Existing scheduled writers must use this contract; this code does not create new daily analytical claims.

Coming up combines existing company events, Moonshot research and an official macro calendar. Confirmed days and guidance windows stay distinct; proxy dates never become confirmed days. Source failures retain their old observation dates. The initial BLS calendar request returned HTTP 403; no CPI/jobs dates are invented. The Federal Reserve calendar was available.

WTI uses actual individually listed NYMEX contracts from the same public TradingView scanner used by the ULSD publisher. `brief-data.yml` refreshes it and the official calendar on weekdays. Its timestamps say **retrieved**, since the source supplies no per-contract quote time. ULSD and WTI open with all available contracts. Copy and CSV include raw price/change precision, units, timestamps and sources; the copy fallback works without clipboard permission. Existing curves and data refreshes remain intact.

## Workspace activation

The Pages worker is in `cloudflare/workspace-worker.mjs`. The existing deployment places it at `_cf/_worker.js`, routing only workspace paths and `/emmi/api/workspaces` through it. It verifies Cloudflare Access JWT signature, trusted issuer, audience, expiry and membership before returning workspace pages or data. Without configuration, all workspace paths deny access and the buttons stay hidden. The shared site retains its existing Access policy.

Set these **Cloudflare Pages production environment variables**, then redeploy:

- `EMMI_ACCESS_TEAM_DOMAIN`: the existing `<team>.cloudflareaccess.com` domain.
- `EMMI_ACCESS_AUD`: the existing site's Access application AUD tag (comma-separated if separate path applications are used).
- `EMMI_WORKSPACES`: JSON rules, using approved emails/domains. Shape: `{"orron":{"emails":[],"domains":["orron.com"]},"lundin":{"emails":["approved-email"]},"personal":{"emails":["owner-email"]},"oilgas":{"emails":["owner-email"]}}`. Supply actual approved addresses in Cloudflare, never in this public repository. Personal and Oil & Gas accept individual emails only.

Keep Cloudflare Access policies on `/emmi/orron/*`, `/emmi/lundin/*`, `/emmi/personal/*`, `/emmi/oilgas/*`, including bare section addresses; retain the whole-site policy. Buttons are convenience, not the access boundary. Protect preview hostnames too; deny unmatched workspace traffic. The worker is a second membership check.

Optional private notes use a private R2 binding `EMMI_PRIVATE`. Objects are read only at `personal/data/notes.json` or `oilgas/data/notes.json`, with shape `{"notes":[{"title":"...","text":"...","company":"ECO.L"}]}`. The browser receives them only under its authorised path with `private, no-store` caching. Attachments stay under the same workspace's `files/` prefix. Never add notes, theses, private attachments or search indexes to this public repository or the shared `data/` directory. No notes have been added by this change.

Orrön links directly to Nordic power, Cloudberry, Orrön and data centres. Lundin links to group companies/catalysts and full ULSD/WTI curves. Both reuse shared facts. My Desk and Oil & Gas provide separate read-only private notebooks.

## Validation

The deploy workflow runs the existing risk-gauge checks, quote/calendar helper checks, exact curve-export checks, JWT/membership/private-path checks, and Python source-parser checks. Browser checks cover desktop/mobile, the seven-market order, quote details, candle toggles, event links, and full curve copy. Existing candle checks pass. Two older assertion-based checks (`test_quote_labels.cjs`, `test_covered_company.cjs`) also fail on unchanged main: they expect retired power-helper / navigation markup. Those unrelated expectations have not been rewritten to conceal their baseline failures.
