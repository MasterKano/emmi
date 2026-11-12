#!/usr/bin/env python3
"""Write data/live_comment.json (the Live Pulse 'Tone of the day' block) from a sent Pulse edition.

v1 takes the words verbatim from the newest emailed edition (pulse/editions.json, email_sent true): the headline,
the lead bullets, each section's "Our view." paragraph and the risk-gauge line. Nothing is written or summarised
here; written_at is the edition's send time. A later scheduled refresh can write the same schema from fresher text.

Usage: python3 scripts/build_live_comment.py [EDITION_ID]   (default: newest emailed Pulse)
"""
import html, json, re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Blocks(HTMLParser):
    """Flattens the email into text blocks (one per div/td/p), in document order."""
    BREAK = {"div", "td", "p", "tr", "li", "h1", "h2", "h3"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.buf, self.skip = [], [], 0

    def flush(self):
        t = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        if t:
            self.out.append(t)
        self.buf = []

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "title"):
            self.skip += 1
        if tag in self.BREAK:
            self.flush()
        if tag == "br":
            self.buf.append(" ")

    def handle_endtag(self, tag):
        if tag in ("style", "script", "title"):
            self.skip -= 1
        if tag in self.BREAK:
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)


def extract(email_html):
    p = Blocks()
    p.feed(email_html)
    p.flush()
    blocks = p.out
    bullets, views, risk, section = [], [], None, None
    for t in blocks:
        m = re.match(r"^(\d) · (.+)$", t)
        if m and len(t) < 60:
            section = m.group(2)
            continue
        if t.startswith("• ") and section is None:
            bullets.append(t[2:].strip())
        elif t.startswith("Our view.") and section:
            views.append({"section": section, "text": t[len("Our view."):].strip()})
        elif t.startswith("RISK GAUGE") and risk is None:
            risk = t[len("RISK GAUGE"):].strip()
    return bullets, views, risk


def first_sentence(s):
    m = re.match(r"^(.+?[.!?])(\s|$)", s or "")
    return m.group(1) if m else (s or None)


def main():
    eds = json.loads((ROOT / "pulse/editions.json").read_text())["editions"]
    want = sys.argv[1] if len(sys.argv) > 1 else None
    ed = next((e for e in eds if (e["id"] == want if want else e.get("email_sent"))), None)
    if not ed:
        sys.exit("no matching emailed Pulse edition")
    src = ROOT / ed["email"].replace("/emmi/", "", 1)
    bullets, views, risk = extract(src.read_text())
    headline = ed["subject"].split(": ", 1)[1] if ": " in ed["subject"] else ed["subject"]
    out = {
        "schema": 1,
        "written_at": ed["sent_iso"],
        "written_by": "Market Pulse email (verbatim)",
        "headline": headline[:1].upper() + headline[1:],
        "tone": first_sentence(bullets[0]) if bullets else None,
        "body": bullets,
        "views": views,
        "risk_label": risk,
        "source": {"kind": "pulse-edition", "id": ed["id"], "edition": ed["edition"], "sent": ed["sent"],
                   "href": ed["href"], "subject": ed["subject"]},
        "note": "Commentary from the last sent Pulse, not live. Prices elsewhere on Live Pulse are live.",
    }
    (ROOT / "data/live_comment.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
