#!/usr/bin/env python3
"""Site pages for Latest Pulse and CSI. Does not build or send email.

The dated Pulse file pulse/YYYY-MM-DD/index.html stays the vetted edition.
Latest and the archive list are EMMI pages around that file.
"""
import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ZRH = ZoneInfo("Europe/Zurich")
V = "20261112v"
CLOCKS = "20261112q"
# When these site pages were added. Not an edition date and not a delivery time.
PAGE_ASOF = ("Thursday 12 November 2026, 14:03 Zurich", "2026-11-12T14:03:00+01:00")
HOME = "https://masterkano.github.io/emmi/"

# Facts printed in the 11 Nov numbers-only pilot itself. Email was not sent.
KNOWN = {
    "2026-11-11": {
        "day": "2026-11-11",
        "edition": "Wednesday 11 November 2026",
        "edition_iso": "2026-11-11",
        "source": "Prices at the Tuesday 10 November 2026 close, the latest completed session. Moves run from the Monday 9 November 2026 close to that Tuesday close.",
        "built": "Wednesday 11 November 2026, 07:27 Zurich",
        "built_iso": "2026-11-11T07:27:00+01:00",
        "kind": "numbers-only pilot",
        "publication": "Published on this site. This is the site copy of the numbers-only pilot.",
        "delivery": "Email not sent for this edition. This page is not the weekday Pulse email. Putting the edition on the site did not send an email.",
    }
}

NAV = (
    ("mt-home", "../#home", "Home", None),
    ("mt-mac", "../#macro", "Markets", "Mkt"),
    ("mt-og", "../#oilgas", "Oil &amp; gas", "Oil"),
    ("mt-mine", "../#mining", "Mining", "Mine"),
    ("mt-pw", "../#power", "Nordic power", "Power"),
    ("mt-gas", "../#gas", "Gas storage", "Gas"),
    ("mt-grid", "../#grid", "Grid &amp; data centres", "Grid"),
    ("mt-res", "../research/", "Research", "Res"),
)


def esc(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def prefix_for(depth):
    return "../" * depth


def nav(depth):
    pre = prefix_for(depth)
    parts = []
    for icon, href, long, short in NAV:
        href = href.replace("../", pre, 1)
        if short:
            label = f'<span><span class="mt-long">{long}</span><span class="mt-short">{short}</span></span>'
        else:
            label = f"<span>{long}</span>"
        parts.append(f'<a class="main-tab" href="{href}"><i class="mt-ic {icon}" aria-hidden="true"></i>{label}</a>')
    return "".join(parts)


def clocks():
    zones = (
        ("Zurich", "Europe/Zurich"),
        ("London", "Europe/London"),
        ("New York", "America/New_York"),
        ("Singapore", "Asia/Singapore"),
        ("Hong Kong", "Asia/Hong_Kong"),
        ("Shanghai", "Asia/Shanghai"),
        ("Sydney", "Australia/Sydney"),
    )
    blocks = "".join(
        f'<div class="clock-block"><span class="clock-label">{name}</span>'
        f'<time class="clock-value" data-zone="{zone}"></time></div>'
        for name, zone in zones
    )
    return f'<div class="clocks" aria-label="Market clocks">{blocks}</div>'


def shell(title, depth, body, product):
    pre = prefix_for(depth)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#202124">
<title>{title}</title>
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
    <nav class="main-nav" aria-label="Sections">{nav(depth)}</nav>
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


def back():
    return f'<p class="back"><a href="{HOME}">Back to EMMI</a></p>'


def asof_html(stamp=None):
    label, iso = stamp or PAGE_ASOF
    return f'<p class="asof">Page as of <time id="pageAsof" datetime="{esc(iso)}">{esc(label)}</time></p>'


def status_cards(publication, delivery):
    return (
        '<section class="status" aria-label="Publication and delivery">'
        f'<article class="is-publication"><h2>Publication</h2><p>{esc(publication)}</p></article>'
        f'<article class="is-delivery"><h2>Delivery</h2><p>{esc(delivery)}</p></article>'
        "</section>"
    )


def fact(label, text, iso=None):
    inner = f'<time datetime="{esc(iso)}">{esc(text)}</time>' if iso else esc(text)
    return f'<div class="fact"><dt>{esc(label)}</dt><dd>{inner}</dd></div>'


def pulse_latest(meta, stamp=None):
    day = meta["day"]
    body = "\n".join([
        back(),
        '<p class="kicker">Market Pulse</p>',
        '<header class="bh"><h1>Latest Pulse</h1>',
        asof_html(stamp),
        "</header>",
        '<p class="lede">This is the site page for the published Market Pulse. It is not the email. The edition date and the source dates are separate from publication and from delivery.</p>',
        '<dl class="facts">',
        fact("Edition date", meta["edition"], meta.get("edition_iso")),
        fact("Source dates", meta["source"]),
        fact("Built", meta["built"], meta.get("built_iso") or None),
        "</dl>",
        status_cards(meta["publication"], meta["delivery"]),
        '<p class="page-links"><a href="/emmi/pulse/archive/">Archive</a><a href="/emmi/csi/">Corporate Sector Intelligence</a></p>',
        f'<p class="edition-note">The brief below is the {esc(meta["kind"])} of {esc(meta["edition"])}, at the width it was published. '
        f'<a href="/emmi/pulse/{esc(day)}/">Open that edition on its own</a>. The page around it is the EMMI site.</p>',
        f'<div class="edition-slot"><iframe class="edition-frame" title="Market Pulse {esc(meta["kind"])}, {esc(meta["edition"])}" src="{esc(day)}/"></iframe></div>',
    ])
    return shell("Latest Pulse · emmi", 1, body, "pulse")


def pulse_archive(entries, stamp=None):
    if entries:
        items = []
        for meta in entries:
            items.append(
                "<li>"
                f'<a href="/emmi/pulse/{esc(meta["day"])}/">{esc(meta["edition"])} · {esc(meta["kind"])}</a>'
                f'<p class="meta">Edition date {esc(meta["edition"])}. {esc(meta["source"])} Built {esc(meta["built"])}.</p>'
                '<div class="split">'
                f'<p><b>Publication</b> {esc(meta["publication"])}</p>'
                f'<p><b>Delivery</b> {esc(meta["delivery"])}</p>'
                "</div></li>"
            )
        listing = '<ul class="archive-list">' + "".join(items) + "</ul>"
    else:
        listing = '<p class="empty" id="emptyArchive">No Pulse edition is published.</p>'
    body = "\n".join([
        back(),
        '<p class="kicker">Market Pulse</p>',
        '<header class="bh"><h1>Archive</h1>',
        asof_html(stamp),
        "</header>",
        '<p class="lede">Previous editions. Each line keeps the edition date and the source dates apart from whether the page is published and whether an email was sent.</p>',
        '<p class="page-links"><a href="/emmi/pulse/">Latest Pulse</a></p>',
        listing,
    ])
    return shell("Pulse archive · emmi", 2, body, "pulse-archive")


def csi_latest(stamp=None):
    publication = "Nothing is published. This is the stable latest URL, and it stays empty until a real edition is added."
    delivery = "No email has been sent from this page. There is no brief to deliver. An empty page is not a delivery."
    body = "\n".join([
        back(),
        '<p class="kicker">Corporate Sector Intelligence</p>',
        '<header class="bh"><h1>CSI</h1>',
        asof_html(stamp),
        "</header>",
        '<p class="lede">No edition is published yet. This page does not stand in for an email, and it does not invent a brief.</p>',
        '<dl class="facts" id="editionFacts">',
        fact("Edition date", "No edition date. No edition is published yet."),
        fact("Source dates", "No source date. There is no brief on this page."),
        "</dl>",
        status_cards(publication, delivery),
        '<p class="page-links"><a href="/emmi/csi/archive/">Archive</a><a href="/emmi/pulse/">Latest Pulse</a></p>',
        '<section class="empty" id="emptyEdition"><h2>No edition published yet</h2>'
        "<p>No Corporate Sector Intelligence brief is on this site. There are no prices and no headlines here.</p></section>",
        '<div id="editionHost"></div>',
        '<details class="dropin"><summary>Where the next edition goes</summary>'
        "<p>Add a dated folder, csi/YYYY-MM-DD/, with the published brief as index.html, and one entry in csi/editions.json. "
        "The entry needs the edition date, the source date, a publication status and a delivery status. "
        "This page and the archive read that list. Leave it empty until the brief is real. Publication still does not mean an email went out.</p></details>",
    ])
    html = shell("CSI · emmi", 1, body, "csi")
    return html.replace("<body ", '<body data-editions="editions.json" data-editions-mode="latest" ', 1)


def csi_archive(stamp=None):
    body = "\n".join([
        back(),
        '<p class="kicker">Corporate Sector Intelligence</p>',
        '<header class="bh"><h1>Archive</h1>',
        asof_html(stamp),
        "</header>",
        '<p class="lede">No editions yet. Nothing has been published here, and nothing has been sent.</p>',
        status_cards(
            "Nothing is published. The archive has no edition to list.",
            "No email has been sent. There is no edition to deliver.",
        ),
        '<p class="page-links"><a href="/emmi/csi/">Latest CSI</a></p>',
        '<p class="empty" id="emptyArchive">No editions yet.</p>',
        '<div id="editionHost"></div>',
    ])
    html = shell("CSI archive · emmi", 2, body, "csi-archive")
    return html.replace("<body ", '<body data-editions="../editions.json" data-editions-mode="archive" ', 1)


def dated_dirs(pulse_root):
    days = []
    if not pulse_root.is_dir():
        return days
    for path in pulse_root.iterdir():
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", path.name) and (path / "index.html").is_file():
            days.append(path.name)
    return sorted(days, reverse=True)


def describe(pulse_root, day, validation=None):
    if validation and str(validation.get("run_date")) == day:
        return meta_from_validation(validation)
    side = pulse_root / day / "edition.json"
    if side.is_file():
        data = json.loads(side.read_text())
        data["day"] = day
        return data
    if day in KNOWN:
        return dict(KNOWN[day])
    return {
        "day": day,
        "edition": day,
        "edition_iso": day,
        "source": "Source date is not recorded beside this edition.",
        "built": "Build time is not recorded beside this edition.",
        "built_iso": "",
        "kind": "Pulse edition",
        "publication": "Published on this site. This is the site copy of the edition.",
        "delivery": "No email delivery is recorded for this edition. The page being on the site is not a delivery.",
    }


def meta_from_validation(validation):
    """Stamps for a vetted edition. This publisher does not send mail."""
    day = str(validation["run_date"])
    last = str(validation.get("last_close") or "")
    built_raw = str(validation.get("built_at") or "")
    built_label, built_iso = format_built(built_raw)
    exceptions = " ".join(validation.get("exceptions") or [])
    kind = "numbers-only pilot" if "numbers-only" in exceptions else "Pulse edition"
    if last:
        source = f"Prices at the {last} close, the latest completed session named for this edition."
    else:
        source = "Source date is recorded in the edition."
    return {
        "day": day,
        "edition": pretty_day(day),
        "edition_iso": day,
        "source": source,
        "built": built_label,
        "built_iso": built_iso,
        "kind": kind,
        "publication": "Published on this site. This is the site copy of the edition.",
        "delivery": "Email not sent for this edition. This page is not the weekday Pulse email. Publishing the page did not send an email.",
    }


def pretty_day(day):
    y, m, d = (int(part) for part in day.split("-"))
    moment = dt.date(y, m, d)
    return f"{moment.strftime('%A')} {d} {moment.strftime('%B %Y')}"


def format_built(raw):
    if not raw:
        return "Build time is in the edition.", ""
    moment = dt.datetime.fromisoformat(raw)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZRH)
    local = moment.astimezone(ZRH).replace(microsecond=0)
    label = f"{local.strftime('%A')} {local.day} {local.strftime('%B %Y, %H:%M')} Zurich"
    return label, local.isoformat()


def zurich_now_stamp():
    local = dt.datetime.now(ZRH).replace(microsecond=0)
    label = f"{local.strftime('%A')} {local.day} {local.strftime('%B %Y, %H:%M')} Zurich"
    return label, local.isoformat()


def write_latest_json(pulse_root, meta):
    """The file Home reads. Only the newest published edition belongs here."""
    keys = ("day", "edition", "edition_iso", "source", "built", "built_iso", "kind", "publication", "delivery")
    payload = {key: meta[key] for key in keys if meta.get(key)}
    (Path(pulse_root) / "latest.json").write_text(json.dumps(payload, indent=2) + "\n")


def install_pulse_site(pulse_root, day, validation, stamp=None):
    """Write the latest page and the archive list. Leave the vetted edition bytes alone."""
    pulse_root = Path(pulse_root)
    edition = pulse_root / day / "index.html"
    before = edition.read_bytes()
    meta = meta_from_validation(validation)
    (pulse_root / day / "edition.json").write_text(json.dumps(meta, indent=2) + "\n")
    if edition.read_bytes() != before:
        raise RuntimeError("Site chrome must not rewrite the vetted edition")
    entries = [describe(pulse_root, name, validation if name == day else None) for name in dated_dirs(pulse_root)]
    latest_meta = next(item for item in entries if item["day"] == day)
    (pulse_root / "index.html").write_text(pulse_latest(latest_meta, stamp or zurich_now_stamp()))
    archive = pulse_root / "archive"
    archive.mkdir(exist_ok=True)
    (archive / "index.html").write_text(pulse_archive(entries, stamp or zurich_now_stamp()))
    write_latest_json(pulse_root, latest_meta)
    if edition.read_bytes() != before:
        raise RuntimeError("Site chrome must not rewrite the vetted edition")


def write_repo_pages(repo):
    repo = Path(repo)
    pulse = repo / "pulse"
    entries = [describe(pulse, day) for day in dated_dirs(pulse)]
    if not entries:
        raise SystemExit("No Pulse edition to point the latest page at")
    (pulse / "index.html").write_text(pulse_latest(entries[0], PAGE_ASOF))
    write_latest_json(pulse, entries[0])
    (pulse / "archive").mkdir(exist_ok=True)
    (pulse / "archive" / "index.html").write_text(pulse_archive(entries, PAGE_ASOF))
    csi = repo / "csi"
    csi.mkdir(exist_ok=True)
    (csi / "index.html").write_text(csi_latest(PAGE_ASOF))
    (csi / "archive").mkdir(exist_ok=True)
    (csi / "archive" / "index.html").write_text(csi_archive(PAGE_ASOF))
    manifest = csi / "editions.json"
    if not manifest.exists():
        manifest.write_text(json.dumps({
            "product": "Corporate Sector Intelligence",
            "editions": [],
        }, indent=2) + "\n")


if __name__ == "__main__":
    write_repo_pages(Path(__file__).resolve().parents[2])
