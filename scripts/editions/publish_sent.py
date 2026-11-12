#!/usr/bin/env python3
"""Put one emailed Pulse or CSI edition on the site, from the HTML that was sent and its images.

Writes files in a checkout only: <product>/<id>/ (email.html, images, edition.json, index.html),
then rebuilds editions.json, pulse/latest.json, the latest page and the archive.
It sends no email, makes no git commit and has no "today only" or two-hour gate, so it works
for a historical edition and right after a send. Run it after a successful send; commit and
open a PR as usual.

  python3 scripts/editions/publish_sent.py --product pulse --kind "weekday Pulse" \
      --id 2026-11-12 --sent-at 2026-11-12T05:52:17+01:00 \
      --subject "Market Pulse — Thu 12 Nov: ..." --html sent.html --images out/images/
"""
import argparse
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("site_pages", HERE / "site_pages.py")
site_pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site_pages)


def publish(repo, product, edition_id, kind, sent_at, subject, html_text, images, day=None,
            recipients="to Jerry's own inbox only", source=None, caveat=None, label=None,
            extra_delivery=None, allow_missing=(), stamp=None):
    day = day or edition_id[:10]
    entry = site_pages.sent_entry(product, edition_id, day, kind, sent_at, subject, recipients=recipients,
                                  source=source, caveat=caveat, label=label, extra_delivery=extra_delivery)
    root = Path(repo) / product
    site_pages.install_sent_edition(root, entry, html_text, images, allow_missing=allow_missing)
    return site_pages.write_product(root, product, stamp)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=str(HERE.parents[1]))
    ap.add_argument("--product", choices=sorted(site_pages.PRODUCTS), required=True)
    ap.add_argument("--id", required=True, help="YYYY-MM-DD, or YYYY-MM-DD-update for a same-day resend")
    ap.add_argument("--day", help="edition date if it differs from the id")
    ap.add_argument("--kind", required=True, help='e.g. "weekday Pulse", "Weekend Pulse", "Corporate Sector Intelligence"')
    ap.add_argument("--label", help='list label; default "<d Month yyyy> · <kind>"')
    ap.add_argument("--sent-at", required=True, help="ISO time with offset, from the sent message")
    ap.add_argument("--subject", required=True)
    ap.add_argument("--html", required=True, help="the sent HTML (cid: image links are fine)")
    ap.add_argument("--images", help="folder with the email's own attachments")
    ap.add_argument("--recipients", default="to Jerry's own inbox only", help="how it was delivered, in words; no addresses")
    ap.add_argument("--source", help="what the edition covers, e.g. the week it reports")
    ap.add_argument("--caveat", help="honest note shown on the edition page")
    ap.add_argument("--extra-delivery", help="extra delivery sentence")
    ap.add_argument("--allow-missing", default="", help="comma list of cid images that were not in the email")
    a = ap.parse_args(argv)
    html = Path(a.html).read_text(encoding="utf-8")
    images = {}
    if a.images:
        images = {p.name: p.read_bytes() for p in sorted(Path(a.images).iterdir()) if p.is_file()}
    missing = [x for x in a.allow_missing.split(",") if x]
    manifest = publish(a.repo, a.product, a.id, a.kind, a.sent_at, a.subject, html, images, day=a.day,
                       recipients=a.recipients, source=a.source, caveat=a.caveat, label=a.label,
                       extra_delivery=a.extra_delivery, allow_missing=missing)
    print(f"{a.product}/{a.id}/ written; latest is {manifest['latest']}; no email sent", file=sys.stderr)


if __name__ == "__main__":
    main()
