#!/usr/bin/env python3
"""EMMI site pages around Pulse (Morning Pulse and Weekend Pulse), CSI and Special briefs editions. Never builds or sends email.

Layout, one folder per edition:
  <product>/<id>/email.html   the edition HTML exactly as published (sent email, or the pilot file)
  <product>/<id>/*.png        that edition's own images, next to email.html
  <product>/<id>/edition.json facts about the edition (dates, sent time, publication, delivery, caveat)
  <product>/<id>/index.html   EMMI page around email.html (iframe), with an edition picker

edition.json files are the source of truth. editions.json, pulse/latest.json, the latest page,
the archive page and every dated page are rebuilt from them by write_product().
Latest is the newest edition that went out by email; a site-only pilot never replaces it.
The Pulse product keeps at most one emailed edition per calendar day, always at pulse/<YYYY-MM-DD>/;
a later send overwrites that slot and stale same-day <day>-* copies (including pilots) are removed.
"""
import datetime as dt
import json
import os
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ZRH = ZoneInfo("Europe/Zurich")
V = "20261120nv1"       # editions.css / editions.js
ANALYSIS_CSS = "20261123an1"  # analysis.css, markdown special reports only
CLOCKS = "20261116a"    # clocks.js
HOME = "/emmi/"
SAFE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")
ID = re.compile(r"\d{4}-\d{2}-\d{2}(-[a-z0-9]+)*")

PRODUCTS = {
    "pulse": dict(name="Pulse", short="Pulse", latest_title="Latest Pulse", other=("csi", "Corporate Sector Intelligence")),
    "csi": dict(name="Corporate Sector Intelligence", short="CSI", latest_title="Latest CSI", other=("pulse", "Pulse")),
    "specials": dict(name="Special briefs", short="Special briefs", latest_title="Latest special brief", other=None),
}

# Same five tabs and icons as the main site's bottom bar (index.html / ui.css). Editions live under Live Pulse.
NAV = (
    ("#live", "Live Pulse", "Live", "mt-ch"),
    ("#markets", "Markets", "Mkt", "mt-mac"),
    ("#energy/nordic", "Energy", "En", "mt-pw"),
    ("#companies/renewables", "Companies", "Co", "mt-eq"),
    ("research/", "Research", "Res", "mt-res"),
)
ZONES = (
    ("Toronto", "America/Toronto", "TSX"), ("New York", "America/New_York", "NYSE"),
    ("London", "Europe/London", "LSE"), ("Stockholm", "Europe/Stockholm", "STO"),
    ("Zurich", "Europe/Zurich", "SIX"), ("Shanghai", "Asia/Shanghai", "SSE"),
    ("Hong Kong", "Asia/Hong_Kong", "HKEX"), ("Singapore", "Asia/Singapore", "SGX"),
    ("Sydney", "Australia/Sydney", "ASX"),
)

PUBLICATION_SENT = ("Published on this site from the exact HTML of the sent email, with the images that email carried. "
                    "This page is the site copy, not the email.")
SITE_NOTE = "Putting this edition on the site did not send an email."


class SentEditionError(RuntimeError):
    """Refused: the target is an emailed edition and must not be overwritten."""


# How the daily Pulse goes out since mid-November: Jerry's own inbox, Axel and Jerry's Orron inbox (the saved send rule).
# Callers that know the actual recipients of a send pass them; this default is the standing distribution, not "own inbox only".
DEFAULT_RECIPIENTS = {"pulse": "to Jerry's own inbox, Axel and Jerry's Orron inbox", "csi": "to Jerry's own inbox and to Axel"}


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

def sent_entry(product, edition_id, day, kind, sent_at, subject, recipients=None,
               source=None, caveat=None, label=None, extra_delivery=None,
               title=None, companies=None):
    """Facts for an edition that went out by email. sent_at is ISO with offset."""
    if product not in PRODUCTS or not ID.fullmatch(edition_id):
        raise ValueError("Bad product or edition id")
    recipients = recipients or DEFAULT_RECIPIENTS.get(product, "by email")
    when = dt.datetime.fromisoformat(sent_at).astimezone(ZRH)
    delivery = f"Email sent on {pretty_day(when.date().isoformat())} at {when:%H:%M} Zurich, {recipients}."
    if extra_delivery:
        delivery += " " + extra_delivery
    delivery += " " + SITE_NOTE
    entry = dict(
        product=product, id=edition_id, day=day, kind=kind,
        label=label or title or f"{short_day(day)} · {kind}",
        edition=pretty_day(day), edition_iso=day,
        subject=subject,
        email_sent=True, sent_iso=when.isoformat(), sent=zurich_label(when.isoformat()),
        source=source or "The email states its own price and news dates.",
        publication=PUBLICATION_SENT, delivery=delivery,
        caveat=caveat,
    )
    if title:
        entry["title"] = title
    if companies:
        entry["companies"] = list(companies)
    return entry


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


CANONICAL_ID = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def is_canonical_id(edition_id):
    return bool(CANONICAL_ID.fullmatch(edition_id or ""))


def canonical_pulse_id(product, edition_id, day=None):
    """Emailed Pulse editions always live at pulse/<YYYY-MM-DD>/."""
    if product == "pulse":
        return day or (edition_id or "")[:10]
    return edition_id


def allow_pulse_overwrite(entry):
    """A later sent Pulse may replace the canonical daily slot; CSI/specials may not."""
    return entry.get("product") == "pulse" and is_canonical_id(entry.get("id")) and entry.get("id") == (entry.get("day") or entry["id"][:10])


def stale_same_day_entries(product_root, day, kind, keep_id):
    """Same-kind Pulse duplicates for this day, plus any numbers-only pilot, excluding keep_id."""
    out = []
    root = Path(product_root)
    if not any(root.glob("*/edition.json")):
        return out
    for e in read_entries(root):
        if e.get("id") == keep_id or e.get("day") != day:
            continue
        if e.get("kind") == kind or is_pilot_entry(e) or e.get("kind") == "numbers-only pilot":
            out.append(e)
    return out


def prune_stale_same_day(product_root, day, kind, keep_id):
    """Delete stale pulse/<day>-* folders of the same kind (and pilots) after a canonical publish."""
    import shutil
    removed = []
    for e in stale_same_day_entries(product_root, day, kind, keep_id):
        folder = Path(product_root) / e["id"]
        if folder.is_dir():
            shutil.rmtree(folder)
            removed.append(e["id"])
    return removed


def _relocate_edition(product_root, src_id, dest_id):
    """Move a Pulse folder to the canonical id and fix edition.json. Replaces dest if present."""
    import shutil
    product_root = Path(product_root)
    src, dest = product_root / src_id, product_root / dest_id
    if src_id == dest_id:
        return
    if not src.is_dir():
        raise FileNotFoundError(src)
    if dest.exists():
        shutil.rmtree(dest)
    src.rename(dest)
    meta = dest / "edition.json"
    entry = json.loads(meta.read_text(encoding="utf-8"))
    entry["id"] = dest_id
    kind = entry.get("kind") or "weekday Pulse"
    entry["label"] = f"{short_day(entry.get('day') or dest_id)} · {kind}"
    product = entry.get("product") or "pulse"
    entry["href"] = f"/emmi/{product}/{dest_id}/"
    entry["email"] = f"/emmi/{product}/{dest_id}/email.html"
    _write_atomic(meta, json.dumps(entry, indent=2, ensure_ascii=False) + "\n")


def collapse_pulse_to_one_per_day(pulse_root, stamp=None):
    """Keep only the latest emailed Pulse of each kind per calendar day, under the canonical <day> id.

    Removes numbers-only pilots and earlier same-day drafts or updates. A day that had only a pilot
    is left with no edition. If two distinct emailed kinds ever shared a date, only the latest occupies
    <day>; the other kind keeps its folder (never deleted).
    """
    import shutil
    from collections import defaultdict
    pulse_root = Path(pulse_root)
    removed, promoted, kept = [], [], []
    for e in list(read_entries(pulse_root)):
        if is_pilot_entry(e) or e.get("kind") == "numbers-only pilot":
            folder = pulse_root / e["id"]
            if folder.is_dir():
                shutil.rmtree(folder)
                removed.append(e["id"])
    groups = defaultdict(list)
    for e in read_entries(pulse_root):
        groups[(e["day"], e.get("kind"))].append(e)
    # Detect a same-day kind clash before relocating into <day>.
    kinds_by_day = defaultdict(set)
    for (day, kind) in groups:
        kinds_by_day[day].add(kind)
    for (day, kind), items in groups.items():
        items = sorted(items, key=lambda e: e.get("sent_iso") or "", reverse=True)
        winner = items[0]
        for loser in items[1:]:
            folder = pulse_root / loser["id"]
            if folder.is_dir():
                shutil.rmtree(folder)
                removed.append(loser["id"])
        dest = day
        if len(kinds_by_day[day]) > 1 and winner["id"] != day:
            # Another kind may already own <day>; leave this kind where it is.
            kept.append(winner["id"])
            continue
        if winner["id"] != dest:
            _relocate_edition(pulse_root, winner["id"], dest)
            promoted.append({"from": winner["id"], "to": dest})
            kept.append(dest)
        else:
            kept.append(dest)
    write_product(pulse_root, "pulse", stamp)
    return dict(kept=kept, removed=removed, promoted=promoted)


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
    <head> (scripts/site_files.sh refuses any Pulse, CSI or Special briefs page without one)."""
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
        different = (folder / "email.html").is_file() and (folder / "email.html").read_bytes() != html and is_sent_dir(folder)
        leftover = (not is_sent_dir(folder)) and any(folder.iterdir())
        if (different or leftover) and not allow_pulse_overwrite(entry):
            if different:
                raise SentEditionError(f"{folder} already holds a different emailed edition; refused")
            raise SentEditionError(f"{folder} holds something that is not an emailed edition; refused")
        if different or leftover:
            # Replace the canonical daily Pulse in place; drop leftover images the new email does not carry.
            for child in list(folder.iterdir()):
                if child.is_file() and child.name not in images and child.name not in ("email.html", "edition.json", "index.html"):
                    child.unlink()
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
        f'<a class="main-tab{" is-on" if href == "#live" else ""}" href="{pre}{href}"><i class="mt-ic {ic}" aria-hidden="true"></i>'
        f'<span><span class="mt-long">{long}</span><span class="mt-short">{short}</span></span></a>'
        for href, long, short, ic in NAV)


def clocks():
    blocks = "".join(
        f'<div class="clock-block" data-zone="{z}">'
        f'<span class="clock-label">{n}</span>'
        f'<span class="clock-reading"><span class="clock-status" aria-hidden="true"></span>'
        f'<time class="clock-value" data-zone="{z}"></time><span class="clock-ex">{ex}</span></span></div>'
        for n, z, ex in ZONES)
    return (f'<div class="clocks" aria-label="Market clocks">'
            f'<button type="button" class="clocks-summary" aria-expanded="false"><span class="clocks-summary-text">Markets</span></button>'
            f'<div class="clocks-list">{blocks}</div></div>')


def shell(title, depth, body, product, extra_head=""):
    pre = "../" * depth
    styles = f'<link rel="stylesheet" href="{pre}editions.css?v={V}">'
    if extra_head:
        styles += "\n" + extra_head
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
{styles}
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
    one = lambda e: f'<option value="/emmi/{product}/{esc(e["id"])}/"{" selected" if e["id"] == current["id"] else ""}>{esc(option_text(e))}</option>'
    site_only = [e for e in entries if not e.get("email_sent")]
    opts = "".join(one(e) for e in entries if e.get("email_sent"))
    if site_only:   # Pulse pilots stay in their own group; other site-only editions are not pilots
        label = "Numbers-only pilots (site only, not emailed)" if product == "pulse" else "Site only (not emailed)"
        opts += f'<optgroup label="{esc(label)}">' + "".join(one(e) for e in site_only) + "</optgroup>"
    return (f'<label class="edition-pick"><span>Pick a {esc(p["short"])} edition</span>'
            f'<select data-edition-pick aria-label="{esc(p["name"])} editions, newest first">{opts}</select></label>'
            f'<noscript><p class="page-links"><a href="/emmi/{product}/archive/">All editions</a></p></noscript>')


def caveat_html(e):
    if not e.get("caveat"):
        return ""
    return f'<p class="edition-caveat" role="note"><b>Note</b> {esc(e["caveat"])}</p>'


def companies_html(e):
    """Links from a special brief to each listed company it covers. Pulse and CSI have none."""
    rows = e.get("companies") or []
    links = []
    for c in rows:
        if not isinstance(c, dict):
            continue
        name, sym = c.get("name") or "", c.get("sym") or ""
        if not name or not sym:
            continue
        links.append(f'<a href="/emmi/#co={esc(sym)}">{esc(name)}</a>')
    if not links:
        return ""
    return '<p class="edition-note">Companies in this brief</p><p class="page-links">' + "".join(links) + "</p>"


def other_link(product):
    other = PRODUCTS[product].get("other")
    if not other:
        return ""
    href, name = other
    return f'<a href="/emmi/{href}/">{esc(name)}</a>'


def edition_body(product, entries, e, stamp, latest):
    p = PRODUCTS[product]
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
        f'<a href="/emmi/{product}/archive/">All editions</a>{other_link(product)}</p>',
        companies_html(e),
        f'<div class="edition-slot"><iframe class="edition-frame" title="{esc(p["name"])}, {esc(e["label"])}" src="{esc(frame_src)}"></iframe></div>',
    ]
    return "\n".join(x for x in parts if x)


def is_pilot_entry(e):
    """Numbers-only Pulse pilots. A site-only special report is not a pilot."""
    return (not e.get("email_sent")) and str(e.get("id", "")).endswith("-pilot")


def markdown_edition_body(product, entries, e, stamp, latest, fragment):
    """Native report page. The fragment is the rendered Markdown (facts, contents, article)."""
    p = PRODUCTS[product]
    title = e.get("title") or e.get("label") or p["latest_title"]
    parts = [
        f'<p class="back"><a href="{HOME}">Back to EMMI</a></p>',
        f'<p class="kicker">{esc(e.get("kind") or p["name"])}</p>',
        f'<header class="bh"><h1>{esc(title)}</h1>', asof_html(stamp), "</header>",
        picker(product, entries, e),
        fragment,
        f'<p class="page-links"><a href="/emmi/{product}/archive/">All editions</a>'
        f'<a href="/emmi/{product}/{esc(e["id"])}/email.html">Open the report on its own</a></p>',
    ]
    return "\n".join(x for x in parts if x)


def archive_body(product, entries, stamp):
    p = PRODUCTS[product]
    items, pilot_items = [], []
    for e in entries:
        bucket = pilot_items if is_pilot_entry(e) else items
        when = f"Sent {e['sent']}." if e.get("email_sent") else (f"Built {e['built']}. Not emailed." if e.get("built") else "Not emailed.")
        subject = f" Subject: {e['subject']}." if e.get("subject") else ""
        cav = f'<p class="meta edition-caveat-line"><b>Note</b> {esc(e["caveat"])}</p>' if e.get("caveat") else ""
        bucket.append(
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
        (f'<details class="archive-pilots"><summary>Numbers-only pilots ({len(pilot_items)}): built for the site, never emailed</summary>'
         '<ul class="archive-list">' + "".join(pilot_items) + "</ul></details>") if pilot_items else "",
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
    keep = ("id", "day", "kind", "kind_label", "label", "edition", "edition_iso", "subject", "title", "summary", "topics",
            "format", "email_sent", "sent", "sent_iso", "built", "built_iso", "source", "publication", "delivery", "caveat", "companies")
    out = {k: e.get(k) for k in keep if e.get(k) is not None}
    out["href"] = f"/emmi/{e['product']}/{e['id']}/"
    out["email"] = f"/emmi/{e['product']}/{e['id']}/email.html"
    return out


# 20 Nov 2026 (Jerry, t1438u): the weekday Pulse is called Morning Pulse on the site. edition.json keeps the raw facts
# (kind "weekday Pulse", the subject exactly as it was sent); only the shown label, delivery and caveat text say Morning Pulse.
KIND_DISPLAY = {"weekday Pulse": "Morning Pulse"}


def display_entry(e):
    out = dict(e)
    for k in ("label", "delivery", "caveat"):
        if isinstance(out.get(k), str):
            for raw, shown in KIND_DISPLAY.items():
                out[k] = out[k].replace(raw, shown)
    if out.get("kind") in KIND_DISPLAY:
        out["kind_label"] = KIND_DISPLAY[out["kind"]]
    return out


def write_product(product_root, product, stamp=None):
    """Rebuild every page and list for one product from the edition.json files. Never touches email.html."""
    product_root = Path(product_root)
    stamp = stamp or zurich_now_stamp()
    entries = [display_entry(e) for e in read_entries(product_root)]
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
        if e.get("format") == "markdown":
            frag_path = product_root / e["id"] / "body.inc"
            if not frag_path.is_file():
                raise FileNotFoundError(f"{frag_path} missing for markdown edition")
            extra = f'<link rel="stylesheet" href="../../analysis.css?v={ANALYSIS_CSS}">'
            page = shell(
                f"{e['label']} · {p['short']} · emmi", 2,
                markdown_edition_body(product, entries, e, stamp, False, frag_path.read_text(encoding="utf-8")),
                product, extra_head=extra)
        else:
            page = shell(f"{e['label']} · {p['short']} · emmi", 2, edition_body(product, entries, e, stamp, False), product)
        _write_atomic(product_root / e["id"] / "index.html", page)
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
