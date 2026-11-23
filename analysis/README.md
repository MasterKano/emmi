# Analysis store

Special reports live here as one Markdown file each. Company notes stay in `data/company_notes/<SYMBOL>.json`. One command rebuilds the specials pages and the browser search index. It does not send email.

## File a report

1. Add `analysis/reports/<id>.md`. The id is `YYYY-MM-DD-slug` and must match the `day` in the frontmatter.
2. Fill the frontmatter: `id`, `day`, `title`, `kind`, `summary`, `topics`, `companies` (`name` and `sym`), `email_sent`, `source_note`.
3. Write the report in Markdown. Headings, lists, tables, quotes and `[1]` citations are enough. Chart fences are `:::bars`, `:::grouped`, `:::line`, `:::flow` and `:::callout`. Spell "and"; do not use "&".
4. Company symbols are checked against `data/companies.json`, `data/symbols.json` and `scripts/universe.py`. European primary listings that those files do not cover are `ENR.DE` (Siemens Energy), `SU.PA` (Schneider Electric), `ABBN.SW` (ABB) and `NKT.CO` (NKT).

From the repo root:

```bash
python3 scripts/editions/publish_analysis.py
```

That writes `specials/<id>/` (the page and a standalone copy), refreshes `specials/editions.json` without dropping emailed HTML specials, and rewrites `data/analysis_index.json` from every special and every company note.

Preview the checks without writing:

```bash
python3 scripts/editions/publish_analysis.py --dry-run
```

Commit the report, the generated pages and the search index, and push straight to main:

```bash
python3 scripts/editions/publish_analysis.py --push -m "File analysis: title"
```

`--push` commits only `analysis/`, `specials/` and `data/analysis_index.json`, then pushes `HEAD` to `main`. It still does not send email. Run the plain command first when you also changed site code, and commit that in the normal way.

After adding or editing a file in `data/company_notes/`, run the same command so the search index includes it.

Emailed HTML specials, including `specials/2026-11-23-euoil/`, stay as they are. A Markdown id must not reuse an emailed edition id.
