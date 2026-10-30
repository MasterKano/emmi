# Stage 5: Moonshot moved onto EMMA (30 Oct 2026)

The whole Moonshot site (code from `moonshot@4e08b27`) now runs on EMMA at `https://masterkano.github.io/emma/research/`,
behind EMMA's password page, with noindex. A **Research** link is in EMMA's top bar (phone: bottom bar).

- App code: `research/app/` (html/js/css as at 4e08b27; only changes: password page, EMMA back link, title, calendar links).
- Data: `research/app/data/` (9 files Moonshot had that are not in Cori's copy: the 7 country files, `briefing.json`,
  `smallcaps_reaction_summary.json`), overlaid at build time by `research/source/moonshot/` (Cori's copy wins).
- Calendars: `research/source/moonshot/*.ics` copied byte-for-byte to `/emma/research/coming_up.ics` and
  `/emma/research/norway_events.ics`. `scripts/check_ics.py` fails the deploy on bare LF, a broken VCALENDAR,
  a VEVENT without UID or duplicate UIDs, and reports UIDs not in `merge/ids/event_id_map.csv`.
  Calendar files cannot be password-protected: anyone with the link can read them (same as before on Moonshot).
- Same web origin (`masterkano.github.io`), so browser-kept settings carry over: theme, last tab, watchlist
  (`moonshot-watch`), timeline open/sort, briefing open.
- Jerry (30 Oct, 09:55): assume nobody subscribed to the old calendars; no redirect pages; the Moonshot repo is
  backed up and removed after the move is verified live.

## No feature lost (Moonshot M1–M33, see feature_checklist.md)

| # | Outcome |
|---|---|
| M1–M30 | Kept: same code and data, now at `/emma/research/`. Query-string links (M17 filters, M30 `watch=`) work at the new address; old `moonshot/` links stop working when the repo is removed (no redirects, Jerry's call). |
| M31 | Kept at a new address: `/emma/research/coming_up.ics` (220 events) and `/emma/research/norway_events.ics` (246), byte-identical to the old feeds (466 UIDs, CRLF). Old addresses go away with the repo. |
| M32 | Kept and stronger: EMMA `robots.txt` Disallow all + noindex + password page. Calendar files stay open by necessity. |
| M33 | Not fixed, not worse: the Research page loads the same files as Moonshot did (~2.75 MB raw, ~0.3 MB compressed estimate). EMMA's first visit is unchanged (Research data loads only on the Research page). Gap: de-duplicate repeat fetches later. |
| Outside | Gap for Cori: the 9 files in `research/app/data/` stay frozen at 4e08b27 unless her refresh also writes them to `research/source/moonshot/` (the build then uses hers). Her Monday coming-up note should link to the EMMA address. |

Rollback: revert the Stage 5 merge commit on EMMA (removes the Research page and feeds); the Moonshot backup in
`/home/box/backups/moonshot-2026-10-30/` (mirror clone + verified bundle + settings) restores the old repo.
