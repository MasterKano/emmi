"""Markdown analysis store: parse, publish, and search index. No network and no email."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mdreport = load("mdreport", HERE / "mdreport.py")
publish_analysis = load("publish_analysis", HERE / "publish_analysis.py")
site_pages = publish_analysis.site_pages
STAMP = ("Monday 23 November 2026, 18:00 Zurich", "2026-11-23T18:00:00+01:00")

SAMPLE = """---
id: 2026-11-23-sample
day: 2026-11-23
title: Sample data centre note
kind: Special report
summary: A short sample about capex and credit.
topics:
  - capex
companies:
  - name: Amazon
    sym: AMZN
email_sent: false
source_note: Sample source note for the test.
---

## Executive summary

Amazon guides to about $220bn. [1]

:::bars 2026 capex guidance
unit: $bn
Amazon | 220 | $220bn
:::

:::callout Bottom line
Power lasts.
:::

## Sources

1. [Example filing](https://example.com/filing), Example, 23 Nov 2026
"""


class Parse(unittest.TestCase):
    def test_frontmatter_and_charts(self):
        meta, body = mdreport.parse_frontmatter(SAMPLE)
        mdreport.validate_meta(meta, body)
        self.assertEqual(meta["id"], "2026-11-23-sample")
        self.assertFalse(meta["email_sent"])
        self.assertEqual(meta["companies"][0]["sym"], "AMZN")
        html, toc = mdreport.render_markdown(body)
        self.assertIn("$220bn", html)
        self.assertIn("report-hbar", html)
        self.assertIn("report-callout", html)
        self.assertIn('id="src-1"', html)
        self.assertIn("Executive summary", toc)
        self.assertIn('href="#src-1"', html)

    def test_ampersand_in_prose_is_refused(self):
        bad = SAMPLE.replace("Amazon guides", "Amazon & guides")
        with self.assertRaisesRegex(ValueError, "spell out"):
            mdreport.parse_frontmatter(bad)

    def test_bad_day_is_refused(self):
        meta, body = mdreport.parse_frontmatter(SAMPLE)
        meta["day"] = "2026-13-40"
        with self.assertRaises(ValueError):
            mdreport.validate_meta(meta, body)


class Publish(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.repo, ignore_errors=True))
        (self.repo / "data").mkdir()
        (self.repo / "data" / "companies.json").write_text(json.dumps({
            "companies": {"AMZN": {"name": "Amazon", "sym": "AMZN"}}
        }), encoding="utf-8")
        (self.repo / "data" / "symbols.json").write_text(json.dumps({
            "symbols": [["Amazon.com, Inc.", "NASDAQ:AMZN", "Stock"]]
        }), encoding="utf-8")
        notes = self.repo / "data" / "company_notes"
        notes.mkdir()
        (notes / "ECO.L.json").write_text(json.dumps({
            "sym": "ECO.L",
            "notes": [{
                "id": "guyana-note",
                "date": "2026-11-12",
                "title": "Guyana licence",
                "sections": [{"heading": "Where things stand", "paragraphs": ["The Orinduik block is in Guyana."]}],
                "sources": [],
            }],
        }), encoding="utf-8")
        reports = self.repo / "analysis" / "reports"
        reports.mkdir(parents=True)
        (reports / "2026-11-23-sample.md").write_text(SAMPLE, encoding="utf-8")
        emailed = self.repo / "specials" / "2026-11-23-euoil"
        emailed.mkdir(parents=True)
        html = "<html><head><title>t</title></head><body><p>Vår sample brief</p></body></html>"
        (emailed / "email.html").write_text(html, encoding="utf-8")
        entry = site_pages.sent_entry(
            "specials", "2026-11-23-euoil", "2026-11-23", "Special brief",
            "2026-11-23T15:49:00+01:00", "Sector Notes sample",
            recipients="to the list", title="EU oil sample",
            companies=[{"name": "Eco Atlantic", "sym": "ECO.L"}],
        )
        (emailed / "edition.json").write_text(json.dumps(entry), encoding="utf-8")
        self.email_bytes = (emailed / "email.html").read_bytes()

    def test_publish_keeps_the_emailed_special_and_indexes_everything(self):
        manifest, index, reports = publish_analysis.publish(self.repo, STAMP)
        self.assertEqual(manifest["latest"], "2026-11-23-euoil")
        self.assertEqual([e["id"] for e in manifest["editions"]], [
            "2026-11-23-euoil", "2026-11-23-sample",
        ])
        self.assertEqual((self.repo / "specials" / "2026-11-23-euoil" / "email.html").read_bytes(), self.email_bytes)
        page = (self.repo / "specials" / "2026-11-23-sample" / "index.html").read_text(encoding="utf-8")
        self.assertIn("noindex", page)
        self.assertNotIn("gate.js", page)
        self.assertNotIn("edition-frame", page)
        self.assertIn('href="/emmi/#co=AMZN"', page)
        self.assertIn("analysis.css", page)
        own = (self.repo / "specials" / "2026-11-23-sample" / "email.html").read_text(encoding="utf-8")
        self.assertIn("noindex", own)
        self.assertNotIn("gate.js", own)
        by_id = {item["id"]: item for item in index["items"]}
        self.assertIn("2026-11-23-sample", by_id)
        self.assertIn("2026-11-23-euoil", by_id)
        self.assertIn("ECO.L:guyana-note", by_id)
        self.assertIn("Vår", by_id["2026-11-23-euoil"]["text"])
        self.assertIn("Guyana", by_id["ECO.L:guyana-note"]["text"])
        self.assertIn("$220bn", by_id["2026-11-23-sample"]["text"])
        self.assertEqual(len(reports), 1)
        self.assertTrue((self.repo / "data" / "analysis_index.json").is_file())

    def test_unknown_symbol_is_refused(self):
        path = self.repo / "analysis" / "reports" / "2026-11-23-sample.md"
        path.write_text(SAMPLE.replace("sym: AMZN", "sym: NOPE"), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "NOPE"):
            publish_analysis.publish(self.repo, STAMP)


class RepoReport(unittest.TestCase):
    def test_data_centre_report_is_filed_and_searchable(self):
        editions = json.loads((REPO / "specials" / "editions.json").read_text(encoding="utf-8"))
        ids = [e["id"] for e in editions["editions"]]
        self.assertEqual(editions["latest"], "2026-11-23-euoil")
        self.assertIn("2026-11-23-data-centre-infrastructure", ids)
        self.assertIn("2026-11-23-euoil", ids)
        folder = REPO / "specials" / "2026-11-23-data-centre-infrastructure"
        page = (folder / "index.html").read_text(encoding="utf-8")
        body = (folder / "body.inc").read_text(encoding="utf-8")
        own = (folder / "email.html").read_text(encoding="utf-8")
        for text in (page, own):
            self.assertIn("noindex", text)
            self.assertNotIn("gate.js", text)
        self.assertNotIn("edition-frame", page)
        self.assertIn('src="email.html"', (REPO / "specials" / "2026-11-23-euoil" / "index.html").read_text(encoding="utf-8"))
        self.assertEqual(body.count('id="src-'), 48)
        self.assertEqual(body.count('class="report-pill"'), 26)
        for needle in ("$220bn", "$195-205bn", "$27bn", "94.6", "37.5", "342.5", "305", "$27.3bn", "5.046%",
                       "Bond investors", "Hyperion", "Munters", "CoreWeave", "report-hbar", "report-gbars",
                       "report-line", "report-flow"):
            self.assertIn(needle, body, needle)
        index = json.loads((REPO / "data" / "analysis_index.json").read_text(encoding="utf-8"))
        by_id = {item["id"]: item for item in index["items"]}
        self.assertIn("Hyperion", by_id["2026-11-23-data-centre-infrastructure"]["text"])
        self.assertIn("Vår", by_id["2026-11-23-euoil"]["title"] + by_id["2026-11-23-euoil"]["text"])
        self.assertIn("Guyana", by_id["ECO.L:orinduik-navitas-licence-2026-11-12"]["text"])
        linked = {c["sym"] for c in by_id["2026-11-23-data-centre-infrastructure"]["companies"]}
        self.assertIn("FORTUM.HE", linked)
        self.assertIn("MTRS.ST", linked)
        self.assertIn("ENR.DE", linked)
        self.assertTrue((REPO / "data" / "co" / "FORTUM.HE.json").is_file())
        self.assertFalse((REPO / "data" / "co" / "AMZN.json").is_file())


if __name__ == "__main__":
    unittest.main()
