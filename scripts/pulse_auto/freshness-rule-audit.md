# Approved weekday Pulse freshness rule — 11 Nov 2026

Jerry approved this change at 07:20 Zurich by selecting "Yes, use the one-day-lag rule" on question card t1089s3453 ("Use the one-day-lag rule for slower series on the Pulse page?"). The active implementation now uses this rule; the locked v1.2 files are unchanged.

- Latest required settled close, no lag allowance: core Monitor prices (Brent, WTI, TTF front, non-Asia equity indices, FX, gold/silver/copper) and Nordic power. Unlisted prices remain strict.
- At most one earlier business day, visibly labelled "as of <date>": Asia-Pacific indices, iron ore, TTF curve, SOFR and official yields, EU/DE AGSI storage, FRED HY and other risk inputs. Older/future dates hold. Business days use the existing weekday Pulse daily_rules.last_session calendar.
- FRED: up to three attempts with 1s/2s backoff. A successful fresh same-run fetch is reused for duplicate requests; no old draft or disk snapshot fallback.
- Missing risk input still holds unless the unmodified locked v1.2 footer actually names that exact missing input's gap. Generic n/a alone is not an exception. Other missing values still hold.
- As-of labels use the existing Monitor note field and small inline risk/Energy notes. Every run records source dates, minimum permitted dates, applied labels and any named-gap exception in validation.json.
- A clean build writes PASS plus the publisher's hashed CHECK_PASS marker. Held builds cannot publish. No emails or commentary are generated/sent, and no normal weekday routine/master is changed.

## Historical audit (before this explicit approval)
# Weekday Pulse v1.2 freshness-rule audit — 11 Nov 2026 Zurich

The requested `/workspace/brief/checklist.md` and master v1.2/checklist.md do not exist. The actual root checklist is `/workspace/brief/PRESEND_CHECK.md`; the latest sent weekday checklist is `out/pulse/2026-11-10/checklist.md`.

No finite, source-specific weekday lag allowances were found. Therefore no new T+1/T+2/max-age policy was invented or copied from a different product. The pilot's strict source-date gate remains in place. This discrepancy needs Mark's attention before claiming parity with the human-checked weekday brief.

Sources inspected:

- Locked v1.2 `code/pulse.py:validate` delegates to `code/newkind.py:validate`. The latter lines 30–75 validates image/layout/content requirements and treats GAPS as warnings; it does not compare source dates. No source-age policy exists there.
- `sources/yahoo.py:asof` (lines 63–70): selects the last value on or before the requested date. `lib/board.py:entry` (52–76) uses it for iron ore, Nikkei, yields and other board entries. This is an as-of selector, not a finite freshness allowance.
- `sources/cnbc.py:yields` + `lib/board.py:collect`: yields select available history then pass through `entry`; no special US 2y/10y maximum lag.
- `lib/daily_blocks.py:add_extras` (31–44): SOFR/HY use freshly fetched FRED series, then weekly_blocks._ent/board.entry. No finite SOFR allowance.
- Locked v1.2 `code/risk_gauge.py:compute` (206–250): HY/Euro HY/curve select last observation on/before d1; tile code labels actual earlier close when dp==dl rather than inventing a change. No maximum permitted lag.
- `lib/gasdata.py:storage` (51–94): newest populated gas-day slot in the freshest available/direct feed, rendered with its actual gas-day label. No minimum acceptable gas day.
- `lib/gasdata.py:ttf_curve` (133–157): latest EEX trade date before run, plus prior-month comparison. No minimum acceptable settlement date.
- `PRESEND_CHECK.md` lines 15–18: latest settled closes, re-pulled at send time; no wrong dates/NaN/n/a/blank tiles; nothing unverified. Lines 35–37 explicitly qualify the detailed expected-close/declared-late-source checks as the Weekend latest-prices protection.
- `out/pulse/2026-11-10/checklist.md` asserts the Mon 9 Nov close was used, but declares no per-source lag exceptions.
- `edits/wp_latest.py:expected_close/verify_asof` is explicitly Weekend Pulse code; content-specific `asof_exceptions` (Thu/Wed/Fri with reasons) cannot be silently transplanted to weekday Tuesday/Wednesday editions.

Unchanged: fresh pull every run, exact master/layout, explicit source dates in provenance, non-zero exit when held, no publishing or sending held output. Mark can provide an existing approved weekday exception list if it lives elsewhere; the pilot must not guess one.
