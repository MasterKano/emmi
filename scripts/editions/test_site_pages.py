"""Site pages around a Pulse edition. No network, no email, no rewrite of the edition."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("site_pages", Path(__file__).with_name("site_pages.py"))
site_pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site_pages)


class SitePages(unittest.TestCase):
    def test_install_keeps_edition_bytes_and_separates_status(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(tmp, ignore_errors=True))
        day = "2026-11-12"
        raw = b"<html>checked email bytes</html>"
        (tmp / day).mkdir()
        (tmp / day / "index.html").write_bytes(raw)
        validation = dict(
            run_date=day,
            last_close="2026-11-11",
            built_at="2026-11-12T06:05:00+01:00",
            exceptions=["numbers-only pilot"],
        )
        stamp = ("Thursday 12 November 2026, 14:03 Zurich", "2026-11-12T14:03:00+01:00")
        site_pages.install_pulse_site(tmp, day, validation, stamp=stamp)
        self.assertEqual((tmp / day / "index.html").read_bytes(), raw)
        latest = (tmp / "index.html").read_text()
        self.assertNotEqual(latest.encode(), raw)
        self.assertIn("Latest Pulse", latest)
        self.assertIn("Publication", latest)
        self.assertIn("Delivery", latest)
        self.assertIn("Email not sent", latest)
        self.assertIn("Back to EMMI", latest)
        self.assertIn("2026-11-12T14:03:00+01:00", latest)
        self.assertNotIn("gate.js", latest)
        self.assertNotIn("720px", latest)
        self.assertIn('max-width: 1280px', Path(__file__).resolve().parents[2].joinpath("editions.css").read_text())
        archive = (tmp / "archive" / "index.html").read_text()
        self.assertIn(f"/emmi/pulse/{day}/", archive)
        self.assertIn("Publication", archive)
        self.assertIn("Delivery", archive)
        self.assertIn("numbers-only pilot", archive)
        latest_meta = json.loads((tmp / "latest.json").read_text())
        self.assertEqual(latest_meta["day"], day)
        self.assertIn("12 November 2026", latest_meta["edition"])

    def test_later_day_replaces_the_home_metadata(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(tmp, ignore_errors=True))
        (tmp / "2026-11-11").mkdir()
        (tmp / "2026-11-11" / "index.html").write_bytes(b"pilot edition")
        day = "2026-11-13"
        raw = b"<html>later email</html>"
        (tmp / day).mkdir()
        (tmp / day / "index.html").write_bytes(raw)
        validation = dict(
            run_date=day,
            last_close="2026-11-12",
            built_at="2026-11-13T06:10:00+01:00",
            exceptions=["numbers-only pilot"],
        )
        site_pages.install_pulse_site(tmp, day, validation, stamp=("Friday 13 November 2026, 06:12 Zurich", "2026-11-13T06:12:00+01:00"))
        self.assertEqual((tmp / day / "index.html").read_bytes(), raw)
        self.assertEqual((tmp / "2026-11-11" / "index.html").read_bytes(), b"pilot edition")
        latest = json.loads((tmp / "latest.json").read_text())
        self.assertEqual(latest["day"], day)
        self.assertIn("13 November 2026", latest["edition"])
        self.assertNotIn("11 November", latest["edition"])
        self.assertEqual(latest["kind"], "numbers-only pilot")
        self.assertIn("06:10", latest["built"])
        self.assertIn("Zurich", latest["built"])
        self.assertIn("Published", latest["publication"])
        self.assertIn("not sent", latest["delivery"].lower())
        self.assertTrue((tmp / day / "edition.json").is_file())

    def test_csi_latest_does_not_invent_a_brief(self):
        html = site_pages.csi_latest()
        self.assertIn("No edition is published yet", html)
        self.assertIn("No email has been sent", html)
        self.assertNotIn("Brent", html)
        self.assertNotIn("gate.js", html)
        self.assertIn("editions.json", html)

    def test_known_pilot_stamps(self):
        meta = site_pages.KNOWN["2026-11-11"]
        html = site_pages.pulse_latest(meta)
        self.assertIn("Wednesday 11 November 2026", html)
        self.assertIn("Tuesday 10 November 2026", html)
        self.assertIn("07:27 Zurich", html)
        self.assertIn("Email not sent", html)
        self.assertIn('src="2026-11-11/"', html)
        self.assertNotIn("7,521", html)


if __name__ == "__main__":
    unittest.main()
