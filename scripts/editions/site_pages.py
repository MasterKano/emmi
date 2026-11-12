#!/usr/bin/env python3
"""EMMI site pages around Market Pulse and CSI editions. Never builds or sends email.

Layout, one folder per edition:
  <product>/<id>/email.html   the edition HTML exactly as published (sent email, or the pilot file)
  <product>/<id>/*.png        that edition's own images, next to email.html
  <product>/<id>/edition.json facts about the edition (dates, sent time, publication, delivery, caveat)
  <product>/<id>/index.html   EMMI page around email.html (iframe), with an edition picker

edition.json files are the source of truth. editions.json, pulse/latest.json, the latest page,
the archive page and every dated page are rebuilt from them by write_product().
Latest is the newest edition that went out by email; a site-only pilot never replaces it.
"""
import datetime as dt
import json
import os
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ZRH = ZoneInfo("Europe/Zurich")
V = "20261112ad"        # editions.css / editions.js
CLOCKS = "20261112y"    # clocks.js, unchanged
HOME = "https://masterkano.github.io/emmi/"
SAFE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")
ID = re.compile(r"\d{4}-\d{2}-\d{2}(-[a-z0-9]+)?")

PRODUCTS = {
    "pulse": dict(name="Market Pulse", short="Pulse", latest_title="Latest Pulse", other=("csi", "Corporate Sector Intelligence")),
    "csi": dict(name="Corporate Sector Intelligence", short="CSI", latest_title="Latest CSI", other=("pulse", "Market Pulse")),
}

NAV = (
    ("#overview", "Overview", "Ov"),
    ("#markets", "Markets", "Mkt"),
    ("#energy/nordic", "Energy", "En"),
    ("#companies/renewables", "Companies", "Co"),
    ("research/", "Research", "Res"),
    ("#briefs", "Briefs", "Br"),
)
ZONES = (
    ("New York", "America/New_York"), ("London", "Europe/London"), ("Zurich", "Europe/Zurich"),
    ("Singapore", "Asia/Singapore"), ("Hong Kong", "Asia/Hong_Kong"), ("Shanghai", "Asia/Shanghai"),
    ("Sydney", "Australia/Sydney"),
)

PUBLICATION_SENT = ("Published on this site from the exact HTML of the sent email, with the images that email carried. "
                    "This page is the site copy, not the email.")
SITE_NOTE = "Putting this edition on the site did not send an email."


class SentEditionError(RuntimeError):
    """Refused: the target is an emailed edition and must not be overwritten."""


def esc(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


# ---------- dates ----------

def pretty_day(iso_day):
    d = dt.date.fromisoformat(iso_day)
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')} {d.year}"


def short_day(iso_day):
    d = dt.date.fromisoformat(iso_day)
    return f"{d.day} {d.strftime('%B')} {d.year}"


def zurich_label(iso):
    t = dt.datetime.fromisoformat(iso).astimezone(ZRH)
    return f"{pretty_day(t.date().isoformat())}, {t:%H:%M} Zurich"


def hhmm(iso):
    return f"{dt.datetime.fromisoformat(iso).astimezone(ZRH):%H:%M}"


def zurich_now_stamp():
    now = dt.datetime.now(ZRH).replace(second=0, microsecond=0)
    return zurich_label(now.isoformat()), now.isoformat()


# ---------- edition facts ----------

def sent_entry(product, edition_id, day, kind, sent_at, subject, recipients="to Jerry's own inbox only",
               source=None, caveat=None, label=None, extra_delivery=None):
    """Facts for an edition that went out by email. sent_at is ISO with offset."""
    if product not in PRODUCTS or not ID.fullmatch(edition_id):
        raise ValueError("Bad product or edition id")
    when = dt.datetime.fromisoformat(sent_at).astimezone(ZRH)
    delivery = f"Email sent on {pretty_day(when.date().isoformat())} at {when:%H:%M} Zurich, {recipients}."
    if extra_delivery:
        delivery += " " + extra_delivery
    delivery += " " + SITE_NOTE
    return dict(
        product=product, id=edition_id, day=day, kind=kind,
        label=label or f"{short_day(day)} · {kind}",
        edition=pretty_day(day), edition_iso=day,
        subject=subject,
        email_sent=True, sent_iso=when.isoformat(), sent=zurich_label(when.isoformat()),
        source=source or "The email states its own price and news dates.",
        publication=PUBLICATION_SENT, delivery=delivery,
        caveat=caveat,
    )


def pilot_entry(day, last_close=None, built_at=None, exceptions=None):
    """The 05:30 numbers-only pilot. Site only, never emailed. Lives at pulse/<day>-pilot/."""
    source = "Prices at the latest completed session close before the build, as printed on the pilot."
    if last_close:
        prev = dt.date.fromisoformat(last_close)
        source = f"Prices at the {pretty_day(prev.isoformat())} close, the latest completed session."
    entry = dict(
        product="pulse", id=f"{day}-pilot", day=day, kind="numbers-only pilot",
        label=f"{short_day(day)} · numbers-only pilot (site only)",
        edition=pretty_day(day), edition_iso=day, subject=None,
        email_sent=False, sent_iso=None, sent=None,
        source=source,
        publication="Published on this site. This is the site copy of the numbers-only pilot built by the 05:30 routine.",
        delivery="Email not sent for this edition. This page is not the weekday Pulse email. " + SITE_NOTE,
        caveat=f"Numbers-only pilot. It is not the weekday Pulse email. The emailed Pulse for {short_day(day)}, if one went out, has its own page at /emmi/pulse/{day}/.",
    )
    if built_at:
        entry["built_iso"] = dt.datetime.fromisoformat(built_at).astimezone(ZRH).isoformat()
        entry["built"] = zurich_label(built_at)
    return entry


def read_entries(product_root):
    product_root = Path(product_root)
    entries = []
    for meta in product_root.glob("*/edition.json"):
        entry = json.loads(meta.read_text())
        if entry.get("id") != meta.parent.name:
            raise ValueError(f"{meta}: id does not match its folder")
        entries.append(entry)
    return sort_entries(entries)


def sort_entries(entries):
    """Newest edition date first; on the same date, emailed editions before the pilot, later sends first."""
    def key(e):
        return (e["day"], 1 if e.get("email_sent") else 0, e.get("sent_iso") or e.get("built_iso") or "")
    return sorted(entries, key=key, reverse=True)


def latest_of(entries):
    for e in entries:
        if e.get("email_sent"):
            return e
    return entries[0] if entries else None


def is_sent_dir(folder):
    meta = Path(folder) / "edition.json"
    return meta.is_file() and bool(json.loads(meta.read_text()).get("email_sent"))


# ---------- writing an edition folder ----------

def _write_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(data if isinstance(data, bytes) else data.encode())
    os.replace(tmp, path)


def cid_names(html):
    return sorted(set(re.findall(r"cid:([^\"'\s)>]+)", html)))


NOINDEX = '<meta name="robots" content="noindex, nofollow">'


def site_html_from_email(html):
    """The site copy of a sent email. Two changes only, nothing that styles the email:
    cid: image links point at the files next to email.html, and a robots noindex tag goes into
    <head> (scripts/site_files.sh refuses any Pulse or CSI page without one)."""
    for name in cid_names(html):
        if not SAFE.fullmatch(name):
            raise ValueError("Unsafe image name in email: " + name)
    html = re.sub(r"cid:([A-Za-z0-9][A-Za-z0-9_.-]*)", r"\1", html)
    if re.search(r'name="robots" content="noindex', html, re.I):
        return html
    head = re.search(r"<head\b[^>]*>", html, re.I)
    if head:
        return html[:head.end()] + NOINDEX + html[head.end():]
    return NOINDEX + html


def install_sent_edition(product_root, entry, email_html, images, allow_missing=()):
    """Write one emailed edition folder. No email, no git, no date or age gate.

    email_html: the sent HTML (str, cid: links allowed). images: {name: bytes} from that email.
    Same bytes again is a no-op; different bytes for an existing emailed edition are refused.
    """
    product_root = Path(product_root)
    folder = product_root / entry["id"]
    names = cid_names(email_html)
    for name in images:
        if not SAFE.fullmatch(name):
            raise ValueError("Unsafe image name: " + name)
    missing = [n for n in names if n not in images]
    if sorted(missing) != sorted(allow_missing):
        raise ValueError(f"Images referenced by the email but not supplied: {missing} (allowed: {list(allow_missing)})")
    html = site_html_from_email(email_html).encode()
    if folder.exists():
        if (folder / "email.html").is_file() and (folder / "email.html").read_bytes() != html and is_sent_dir(folder):
            raise SentEditionError(f"{folder} already holds a different emailed edition; refused")
        if not is_sent_dir(folder) and any(folder.iterdir()):
            raise SentEditionError(f"{folder} holds something that is not an emailed edition; refused")
    folder.mkdir(parents=True, exist_ok=True)
    _write_atomic(folder / "email.html", html)
    for name, data in images.items():
        _write_atomic(folder / name, data)
    entry = dict(entry, images=sorted(images), images_missing=sorted(missing))
    _write_atomic(folder / "edition.json", json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    return entry


# ---------- pages ----------

def nav(pre):
    return "".join(
        f'<a class="main-tab" href="{pre}{href}"><span class="mt-long">{long}</span><span class="mt-short">{short}</span></a>'
        for href, long, short in NAV)


def clocks():
    blocks = "".join(f'<div class="clock-block"><span class="clock-label">{n}</span><time class="clock-value" data-zone="{z}"></time></div>' for n, z in ZONES)
    return f'<div class="clocks" aria-label="Market clocks">{blocks}</div>'


def shell(title, depth, body, product):
    pre = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#202124">
<title>{esc(title)}</title>
<script>
(function () {{
  var theme = "dark";
  try {{
    var moon = localStorage.getItem("moonshot-theme");
    if (moon === "light" || moon === "dark") theme = moon;
    var main = JSON.parse(localStorage.getItem("markets-monitor:v6") || "null");
    if (main && (main.theme === "light" || main.theme === "dark")) theme = main.theme;
  }} catch (err) {{}}
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#202124");
}})();
</script>
<link rel="stylesheet" href="{pre}editions.css?v={V}">
</head>
<body class="edition-site" data-product="{product}">
<a class="skip" href="#main">Skip to content</a>
<div class="emmi-bar">
  <div class="wrap bar-row">
    <nav class="main-nav" aria-label="Sections">{nav(pre)}</nav>
    {clocks()}
    <button class="theme-toggle" id="themeButton" type="button" title="Switch light / dark theme" aria-pressed="false">Light</button>
  </div>
</div>
<main class="wrap" id="main">
{body}
<div id="pageEnd"></div>
</main>
<script src="{pre}clocks.js?v={CLOCKS}"></script>
<script src="{pre}editions.js?v={V}"></script>
</body>
</html>
"""


def asof_html(stamp):
    label, iso = stamp
    return f'<p class="asof">Page as of <time id="pageAsof" datetime="{esc(iso)}">{esc(label)}</time></p>'


def fact(label, text, iso=None):
    inner = f'<time datetime="{esc(iso)}">{esc(text)}</time>' if iso else esc(text)
    return f'<div class="fact"><dt>{esc(label)}</dt><dd>{inner}</dd></div>'


def status_cards(e):
    return ('<section class="status" aria-label="Publication and delivery">'
            f'<article class="is-publication"><h2>Publication</h2><p>{esc(e["publication"])}</p></article>'
            f'<article class="is-delivery"><h2>Delivery</h2><p>{esc(e["delivery"])}</p></article></section>')


def option_text(e):
    when = f"sent {hhmm(e['sent_iso'])} Zurich" if e.get("email_sent") else "not emailed"
    return f"{e['label']} · {when}"


def picker(product, entries, current):
    p = PRODUCTS[product]
    opts = "".join(
        f'<option value="/emmi/{product}/{esc(e["id"])}/"{" selected" if e["id"] == current["id"] else ""}>{esc(option_text(e))}</option>'
        for e in entries)
    return (f'<label class="edition-pick"><span>Pick a {esc(p["short"])} edition</span>'
            f'<select data-edition-pick aria-label="{esc(p["name"])} editions, newest first">{opts}</select></label>'
            f'<noscript><p class="page-links"><a href="/emmi/{product}/archive/">All editions</a></p></noscript>')


def caveat_html(e):
    if not e.get("caveat"):
        return ""
    return f'<p class="edition-caveat" role="note"><b>Note</b> {esc(e["caveat"])}</p>'


def edition_body(product, entries, e, stamp, latest):
    p = PRODUCTS[product]
    other, other_name = p["other"]
    title = p["latest_title"] if latest else e["label"]
    frame_src = f'{e["id"]}/email.html' if latest else "email.html"
    when = (fact("Sent", e["sent"], e["sent_iso"]) if e.get("email_sent")
            else fact("Built", e.get("built") or "Build time not recorded", e.get("built_iso")))
    what = "the email exactly as it was sent" if e.get("email_sent") else "the site-only pilot, which was never emailed"
    parts = [
        f'<p class="back"><a href="{HOME}">Back to EMMI</a></p>',
        f'<p class="kicker">{esc(p["name"])}</p>',
        f'<header class="bh"><h1>{esc(title)}</h1>', asof_html(stamp), "</header>",
        picker(product, entries, e),
        f'<p class="lede">{esc(e["label"])}. The brief below is {what}, shown in a frame so its own styles stay as they were. Publication on this site and email delivery are separate.</p>',
        caveat_html(e),
        '<dl class="facts">',
        fact("Edition date", e["edition"], e["edition_iso"]),
        when,
        fact("Subject", e["subject"]) if e.get("subject") else "",
        fact("Source dates", e["source"]),
        "</dl>",
        status_cards(e),
        f'<p class="page-links"><a href="/emmi/{product}/{esc(e["id"])}/email.html">Open the brief on its own</a>'
        f'<a href="/emmi/{product}/archive/">All editions</a><a href="/emmi/{other}/">{esc(other_name)}</a></p>',
        f'<div class="edition-slot"><iframe class="edition-frame" title="{esc(p["name"])}, {esc(e["label"])}" src="{esc(frame_src)}"></iframe></div>',
    ]
    return "\n".join(x for x in parts if x)


def archive_body(product, entries, stamp):
    p = PRODUCTS[product]
    items = []
    for e in entries:
        when = f"Sent {e['sent']}." if e.get("email_sent") else (f"Built {e['built']}. Not emailed." if e.get("built") else "Not emailed.")
        subject = f" Subject: {e['subject']}." if e.get("subject") else ""
        cav = f'<p class="meta edition-caveat-line"><b>Note</b> {esc(e["caveat"])}</p>' if e.get("caveat") else ""
        items.append(
            f'<li><a href="/emmi/{product}/{esc(e["id"])}/">{esc(e["label"])}</a>'
            f'<p class="meta">Edition date {esc(e["edition"])}. {esc(when)}{esc(subject)} {esc(e["source"])}</p>{cav}'
            f'<div class="split"><p><b>Publication</b> {esc(e["publication"])}</p><p><b>Delivery</b> {esc(e["delivery"])}</p></div></li>')
    return "\n".join([
        f'<p class="back"><a href="{HOME}">Back to EMMI</a></p>',
        f'<p class="kicker">{esc(p["name"])}</p>',
        '<header class="bh"><h1>All editions</h1>', asof_html(stamp), "</header>",
        f'<p class="lede">Every {esc(p["name"])} edition on this site, newest first. Each line keeps the edition date apart from whether it is published here and whether an email was sent.</p>',
        f'<p class="page-links"><a href="/emmi/{product}/">{esc(p["latest_title"])}</a></p>',
        '<ul class="archive-list">' + "".join(items) + "</ul>",
    ])


def empty_body(product, stamp):
    p = PRODUCTS[product]
    return "\n".join([
        f'<p class="back"><a href="{HOME}">Back to EMMI</a></p>',
        f'<p class="kicker">{esc(p["name"])}</p>',
        f'<header class="bh"><h1>{esc(p["latest_title"])}</h1>', asof_html(stamp), "</header>",
        '<p class="lede">No edition is published yet. This page does not stand in for an email, and it does not invent a brief.</p>',
        '<section class="status" aria-label="Publication and delivery"><article class="is-publication"><h2>Publication</h2><p>Nothing is published.</p></article>'
        '<article class="is-delivery"><h2>Delivery</h2><p>No email has been sent.</p></article></section>',
    ])


def public_entry(e):
    keep = ("id", "day", "kind", "label", "edition", "edition_iso", "subject", "email_sent", "sent", "sent_iso",
            "built", "built_iso", "source", "publication", "delivery", "caveat")
    out = {k: e.get(k) for k in keep if e.get(k) is not None}
    out["href"] = f"/emmi/{e['product']}/{e['id']}/"
    out["email"] = f"/emmi/{e['product']}/{e['id']}/email.html"
    return out


def write_product(product_root, product, stamp=None):
    """Rebuild every page and list for one product from the edition.json files. Never touches email.html."""
    product_root = Path(product_root)
    stamp = stamp or zurich_now_stamp()
    entries = read_entries(product_root)
    before = {e["id"]: (product_root / e["id"] / "email.html").read_bytes() for e in entries}
    p = PRODUCTS[product]
    latest = latest_of(entries)
    manifest = dict(product=p["name"], latest=latest["id"] if latest else None,
                    editions=[public_entry(e) for e in entries])
    _write_atomic(product_root / "editions.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    if latest:
        _write_atomic(product_root / "index.html", shell(f"{p['latest_title']} · emmi", 1, edition_body(product, entries, latest, stamp, True), product))
        if product == "pulse":
            _write_atomic(product_root / "latest.json", json.dumps(public_entry(latest), indent=2, ensure_ascii=False) + "\n")
    else:
        _write_atomic(product_root / "index.html", shell(f"{p['latest_title']} · emmi", 1, empty_body(product, stamp), product))
    for e in entries:
        _write_atomic(product_root / e["id"] / "index.html", shell(f"{e['label']} · {p['short']} · emmi", 2, edition_body(product, entries, e, stamp, False), product))
    _write_atomic(product_root / "archive" / "index.html", shell(f"{p['short']} editions · emmi", 2, archive_body(product, entries, stamp), product + "-archive"))
    for e in entries:
        if (product_root / e["id"] / "email.html").read_bytes() != before[e["id"]]:
            raise RuntimeError("Site pages must not rewrite an edition")
    return manifest


# ---------- 05:30 numbers-only pilot (scripts/pulse_auto/publish.py) ----------

def pilot_dir(day):
    return f"{day}-pilot"


def install_pulse_site(pulse_root, day, validation, stamp=None):
    """publish.py has copied the vetted pilot to pulse/<day>-pilot/email.html (+ images).

    Writes its facts and rebuilds the pages. The pilot never takes pulse/<day>/ and never
    replaces an emailed edition as latest.
    """
    pulse_root = Path(pulse_root)
    folder = pulse_root / pilot_dir(day)
    if is_sent_dir(folder):
        raise SentEditionError("Pilot target is an emailed edition; refused")
    if not (folder / "email.html").is_file():
        raise FileNotFoundError(f"{folder}/email.html missing")
    entry = pilot_entry(day, validation.get("last_close"), validation.get("built_at"), validation.get("exceptions"))
    entry["images"] = sorted(n for n in validation.get("images", []) if (folder / n).is_file())
    _write_atomic(folder / "edition.json", json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    return write_product(pulse_root, "pulse", stamp)


def write_repo_pages(repo, stamp=None):
    repo = Path(repo)
    for product in PRODUCTS:
        (repo / product).mkdir(exist_ok=True)
        write_product(repo / product, product, stamp)


if __name__ == "__main__":
    write_repo_pages(Path(__file__).resolve().parents[2])
