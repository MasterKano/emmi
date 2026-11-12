"""Site pages around Pulse and CSI editions. No network, no email, no rewrite of an edition."""
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


publish_sent = load("publish_sent", HERE / "publish_sent.py")
site_pages = publish_sent.site_pages  # one module, so its error classes match
STAMP = ("Thursday 12 November 2026, 16:00 Zurich", "2026-11-12T16:00:00+01:00")
EMAIL = '<html><head><title>t</title></head><body><p>sent email</p><img src="cid:chart.png"></body></html>'


class SitePages(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.repo, ignore_errors=True))
        self.pulse = self.repo / "pulse"

    def sent(self, eid="2026-11-12", sent_at="2026-11-12T05:52:17+01:00", html=EMAIL, **kw):
        return publish_sent.publish(self.repo, "pulse", eid, "weekday Pulse", sent_at, "Market Pulse — test",
                                    html, {"chart.png": b"png"}, stamp=STAMP, **kw)

    def pilot(self, day, built_at):
        folder = self.pulse / site_pages.pilot_dir(day)
        folder.mkdir(parents=True)
        (folder / "email.html").write_bytes(b"<html>pilot</html>")
        v = dict(run_date=day, last_close="2026-11-12", built_at=built_at, images=[])
        return site_pages.install_pulse_site(self.pulse, day, v, stamp=STAMP)

    def test_sent_edition_keeps_email_and_points_images_next_to_it(self):
        manifest = self.sent()
        folder = self.pulse / "2026-11-12"
        site = (folder / "email.html").read_text()
        self.assertEqual(site.replace(site_pages.NOINDEX, ""), EMAIL.replace("cid:chart.png", "chart.png"))
        self.assertIn('<meta name="robots" content="noindex', site)
        self.assertEqual((folder / "chart.png").read_bytes(), b"png")
        self.assertEqual(manifest["latest"], "2026-11-12")
        latest = json.loads((self.pulse / "latest.json").read_text())
        self.assertTrue(latest["email_sent"])
        self.assertIn("05:52 Zurich", latest["delivery"])
        self.assertIn("did not send an email", latest["delivery"])
        page = (folder / "index.html").read_text()
        self.assertIn('src="email.html"', page)
        self.assertIn("data-edition-pick", page)
        self.assertIn("Back to EMMI", page)
        self.assertNotIn("gate.js", page)
        self.assertIn('name="robots" content="noindex', page)
        top = (self.pulse / "index.html").read_text()
        self.assertIn("Latest Pulse", top)
        self.assertIn('src="2026-11-12/email.html"', top)
        self.assertIn("/emmi/pulse/2026-11-12/", (self.pulse / "archive" / "index.html").read_text())

    def test_historical_publish_has_no_today_or_age_gate(self):
        manifest = self.sent(eid="2020-01-02", sent_at="2020-01-02T05:45:00+01:00")
        self.assertEqual(manifest["latest"], "2020-01-02")

    def test_pilot_never_replaces_an_emailed_latest(self):
        self.sent()
        before = (self.pulse / "2026-11-12" / "email.html").read_bytes()
        manifest = self.pilot("2026-11-13", "2026-11-13T05:35:00+01:00")
        self.assertEqual(manifest["latest"], "2026-11-12")
        self.assertEqual(json.loads((self.pulse / "latest.json").read_text())["id"], "2026-11-12")
        self.assertEqual((self.pulse / "2026-11-12" / "email.html").read_bytes(), before)
        self.assertFalse((self.pulse / "2026-11-13").exists())
        pilot = json.loads((self.pulse / "2026-11-13-pilot" / "edition.json").read_text())
        self.assertFalse(pilot["email_sent"])
        self.assertIn("numbers-only pilot", pilot["label"])
        self.assertIn("2026-11-13-pilot", (self.pulse / "index.html").read_text())  # still in the picker

    def test_pilot_is_latest_only_when_nothing_was_emailed(self):
        manifest = self.pilot("2026-11-13", "2026-11-13T05:35:00+01:00")
        self.assertEqual(manifest["latest"], "2026-11-13-pilot")
        self.assertIn("not sent", json.loads((self.pulse / "latest.json").read_text())["delivery"].lower())

    def test_same_day_email_after_pilot_becomes_latest(self):
        self.pilot("2026-11-13", "2026-11-13T05:35:00+01:00")
        manifest = self.sent(eid="2026-11-13", sent_at="2026-11-13T05:50:00+01:00")
        self.assertEqual(manifest["latest"], "2026-11-13")
        ids = [e["id"] for e in manifest["editions"]]
        self.assertEqual(ids, ["2026-11-13", "2026-11-13-pilot"])

    def test_different_bytes_for_an_emailed_edition_are_refused(self):
        self.sent()
        self.sent()  # same bytes again: no-op
        with self.assertRaises(site_pages.SentEditionError):
            self.sent(html=EMAIL.replace("sent email", "other"))

    def test_pilot_cannot_write_into_an_emailed_folder(self):
        self.sent(eid="2026-11-13-pilot", sent_at="2026-11-13T05:50:00+01:00", day="2026-11-13")
        with self.assertRaises(site_pages.SentEditionError):
            site_pages.install_pulse_site(self.pulse, "2026-11-13", dict(run_date="2026-11-13"), stamp=STAMP)

    def test_missing_images_must_be_declared(self):
        html = EMAIL + '<img src="cid:gone.png">'
        with self.assertRaisesRegex(ValueError, "not supplied"):
            self.sent(html=html)
        self.sent(html=html, allow_missing=("gone.png",), caveat="One chart was not in the email.")
        e = json.loads((self.pulse / "2026-11-12" / "edition.json").read_text())
        self.assertEqual(e["images_missing"], ["gone.png"])
        self.assertIn("One chart was not in the email.", (self.pulse / "2026-11-12" / "index.html").read_text())

    def test_empty_csi_does_not_invent_a_brief(self):
        (self.repo / "csi").mkdir()
        site_pages.write_product(self.repo / "csi", "csi", STAMP)
        html = (self.repo / "csi" / "index.html").read_text()
        self.assertIn("No edition is published yet", html)
        self.assertIn("No email has been sent", html)


class RepoEditions(unittest.TestCase):
    """The committed editions agree with their own facts."""

    def test_every_edition_folder_is_complete(self):
        for product in site_pages.PRODUCTS:
            root = REPO / product
            manifest = json.loads((root / "editions.json").read_text())
            entries = site_pages.read_entries(root)
            self.assertEqual([e["id"] for e in manifest["editions"]], [e["id"] for e in entries])
            latest = site_pages.latest_of(entries)
            if latest:
                self.assertTrue(latest["email_sent"], product + " latest must be an emailed edition")
                self.assertEqual(manifest["latest"], latest["id"])
            for e in entries:
                folder = root / e["id"]
                html = (folder / "email.html").read_text(encoding="utf-8")
                self.assertNotIn("cid:", html, folder)
                for name in e.get("images", []):
                    self.assertTrue((folder / name).is_file(), f"{folder}/{name}")
                self.assertTrue((folder / "index.html").is_file())
        pulse_latest = json.loads((REPO / "pulse" / "latest.json").read_text())
        self.assertEqual(pulse_latest["id"], json.loads((REPO / "pulse" / "editions.json").read_text())["latest"])


if __name__ == "__main__":
    unittest.main()
