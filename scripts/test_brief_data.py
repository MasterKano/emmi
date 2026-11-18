import unittest
from build_brief_data import wti_contracts, fed_events, bls_events


class BriefDataTests(unittest.TestCase):
    def test_contracts_not_continuous_prices(self):
        data = {"data": [{"d": ["CLZ2026", 70.12, None, "NYMEX"]}, {"d": ["CL1!", 70.1, 1, "NYMEX"]},
            {"d": ["CLF2027", None, 1, "NYMEX"]}, {"d": ["CLX2025", 1, 1, "NYMEX"]}, {"d": ["CLG2027", 71.25, -.05, "NYMEX"]}]}
        rows = wti_contracts(data, "2026-11-18T10:00:00Z")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["change"], "")
        self.assertIsNone(rows[0]["quote_time"])
        self.assertEqual(rows[0]["timestamp_kind"], "retrieved")
        self.assertEqual(rows[1]["change"], "-0.05")

    def test_fed_only_published_days(self):
        text = '2026 FOMC Meetings<div class="fomc-meeting__month"><strong>December</strong></div><div class="fomc-meeting__date">8-9*</div>'
        rows = fed_events(text)
        self.assertEqual(rows[0]["date"], "2026-12-09")
        self.assertNotIn("time", rows[0])  # No invented decision hour.

    def test_bls_timezone_and_folded_lines(self):
        text = 'BEGIN:VEVENT\nUID:cpi\nSUMMARY:Consumer Price \n Index\nDTSTART;TZID=America/New_York:20261118T083000\nEND:VEVENT'
        rows = bls_events(text)
        self.assertEqual(rows[0]["date"], "2026-11-18")
        self.assertEqual(rows[0]["time"], "13:30:00")
        self.assertEqual(rows[0]["confidence"], "confirmed")
        self.assertEqual(bls_events(text.replace(';TZID=America/New_York','')), [])


if __name__ == '__main__':
    unittest.main()
