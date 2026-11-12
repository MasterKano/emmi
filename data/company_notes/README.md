Hand-written research notes for company pages.

The company page loads `data/company_notes/<SYMBOL>.json` on demand when a name is opened.
A missing file is normal: the Notes block then says a note has not been written yet.

These files are not produced by `scripts/build_companies.py` (that script only writes
`data/companies.json` and `data/co/<SYMBOL>.json`). Do not overwrite this folder in the
daily fundamentals build.
