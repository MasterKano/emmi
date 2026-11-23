#!/usr/bin/env python3
"""Parse one analysis Markdown file and render it to themed HTML. No network, no email.

The dialect is the subset this store needs: headings, paragraphs, lists, tables,
blockquotes, callouts, citation markers, and four chart fences (bars, grouped, line, flow).
"""
import datetime as dt
import re
from html import escape

ID_RE = re.compile(r"\d{4}-\d{2}-\d{2}(-[a-z0-9]+)*")
SYM_RE = re.compile(r"[A-Z0-9][A-Z0-9.-]*")
REQUIRED = ("id", "day", "title", "kind", "summary", "topics", "companies", "email_sent", "source_note")


def esc(value):
    return escape(str(value if value is not None else ""), quote=True)


def fold(value):
    text = str(value or "").casefold().replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def names_compatible(given, known, sym):
    g, k = fold(given), fold(known)
    if g and k and (g in k or k in g):
        return True
    root = str(sym).split(".")[0].casefold()
    if g == root:
        return True
    if k and g and k.split(" ")[0] == g:
        return True
    return False


def has_visible_ampersand(text):
    """True when '&' would show in prose. Characters inside URLs are left out."""
    stripped = re.sub(r"\((https?://[^)\s]+)\)", "()", text or "")
    stripped = re.sub(r"https?://\S+", "", stripped)
    return "&" in stripped


def _unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def _coerce(value):
    low = value.casefold()
    if low in ("true", "yes"):
        return True
    if low in ("false", "no"):
        return False
    return value


def parse_frontmatter(text):
    """Return (meta dict, body). A small YAML subset: scalars, folded text, lists, maps."""
    if not text.startswith("---\n"):
        raise ValueError("Markdown report needs a frontmatter block")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("Frontmatter is not closed")
    raw, body = text[4:end], text[end + 5:]
    if has_visible_ampersand(raw) or has_visible_ampersand(body):
        raise ValueError("Report prose must spell out the word and")
    data, i, lines = {}, 0, raw.splitlines()
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.strip().startswith("#"):
            i += 1
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
        if not match:
            raise ValueError("Bad frontmatter line: " + line)
        key, rest = match.group(1), match.group(2).strip()
        if rest in (">", "|"):
            i += 1
            chunks = []
            while i < len(lines) and (not lines[i].strip() or lines[i].startswith(" ")):
                chunks.append(lines[i].strip())
                i += 1
            data[key] = re.sub(r"\s+", " ", " ".join(c for c in chunks if c)).strip()
            continue
        if rest == "":
            i += 1
            items = []
            while i < len(lines):
                if not lines[i].strip():
                    i += 1
                    continue
                if not lines[i].startswith((" ", "-", "\t")):
                    break
                item = re.match(r"^\s*-\s*(.*)$", lines[i])
                if item:
                    payload = item.group(1).strip()
                    field = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", payload)
                    if field:
                        obj = {field.group(1): _unquote(field.group(2).strip())}
                        i += 1
                        while i < len(lines):
                            more = re.match(r"^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", lines[i])
                            if not more:
                                break
                            obj[more.group(1)] = _unquote(more.group(2).strip())
                            i += 1
                        items.append(obj)
                        continue
                    items.append(_unquote(payload))
                    i += 1
                    continue
                more = re.match(r"^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", lines[i])
                if more and items and isinstance(items[-1], dict):
                    items[-1][more.group(1)] = _unquote(more.group(2).strip())
                    i += 1
                    continue
                raise ValueError("Bad list line: " + lines[i])
            data[key] = items
            continue
        data[key] = _coerce(_unquote(rest))
        i += 1
    return data, body.lstrip("\n")


def validate_meta(meta, body):
    missing = [key for key in REQUIRED if key not in meta]
    if missing:
        raise ValueError("Missing frontmatter: " + ", ".join(missing))
    if not isinstance(meta["id"], str) or not ID_RE.fullmatch(meta["id"]):
        raise ValueError("Bad report id: " + str(meta.get("id")))
    try:
        dt.date.fromisoformat(meta["day"])
    except Exception as exc:
        raise ValueError("Bad report day") from exc
    if not meta["day"] == meta["id"][:10]:
        raise ValueError("Report id must start with its day")
    for key in ("title", "kind", "summary", "source_note"):
        if not isinstance(meta[key], str) or not meta[key].strip():
            raise ValueError("Empty frontmatter field: " + key)
    if not isinstance(meta["email_sent"], bool):
        raise ValueError("email_sent must be true or false")
    if not isinstance(meta["topics"], list) or not all(isinstance(t, str) and t.strip() for t in meta["topics"]):
        raise ValueError("topics must be a list of words")
    companies = meta["companies"]
    if not isinstance(companies, list):
        raise ValueError("companies must be a list")
    seen = set()
    for company in companies:
        if not isinstance(company, dict) or not company.get("name") or not company.get("sym"):
            raise ValueError("Each company needs a name and a sym")
        if not SYM_RE.fullmatch(company["sym"]):
            raise ValueError("Bad symbol: " + str(company.get("sym")))
        if company["sym"] in seen:
            raise ValueError("Repeated symbol: " + company["sym"])
        seen.add(company["sym"])
    if not body.strip():
        raise ValueError("Report body is empty")
    return meta


def inline(src):
    """Links, bold, and [n] citations. Everything else is escaped."""
    out, i, text = [], 0, str(src or "")
    while i < len(text):
        if text.startswith("**", i):
            close = text.find("**", i + 2)
            if close > i:
                out.append("<strong>" + inline(text[i + 2:close]) + "</strong>")
                i = close + 2
                continue
        if text[i] == "[":
            link = re.match(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", text[i:])
            if link:
                out.append(
                    f'<a href="{esc(link.group(2))}" target="_blank" rel="noopener noreferrer">{inline(link.group(1))}</a>'
                )
                i += link.end()
                continue
            cite = re.match(r"\[(\d+)\]", text[i:])
            if cite:
                n = cite.group(1)
                out.append(f'<sup class="report-cite"><a href="#src-{n}">{n}</a></sup>')
                i += cite.end()
                continue
        nxt = len(text)
        for k in range(i + 1, len(text)):
            if text[k] == "[" or text.startswith("**", k):
                nxt = k
                break
        out.append(esc(text[i:nxt]))
        i = nxt
    return "".join(out)


def _slug(text, used):
    base = re.sub(r"[^a-z0-9]+", "-", fold(text)).strip("-") or "section"
    slug, n = base, 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


def _fence(lines, i):
    head = lines[i].strip()
    match = re.match(r"^:::([A-Za-z]+)\s*(.*)$", head)
    if not match:
        raise ValueError("Bad fence: " + head)
    kind, title = match.group(1).lower(), match.group(2).strip()
    i += 1
    body = []
    while i < len(lines) and lines[i].strip() != ":::":
        body.append(lines[i])
        i += 1
    if i >= len(lines):
        raise ValueError("Unclosed fence: " + kind)
    return kind, title, body, i + 1


def _chart_meta(body):
    meta, data = {}, []
    for line in body:
        stripped = line.strip()
        if not stripped:
            continue
        field = re.match(r"^(unit|series|min|max)\s*:\s*(.*)$", stripped, re.I)
        if field and not data:
            meta[field.group(1).lower()] = field.group(2).strip()
            continue
        data.append(stripped)
    return meta, data


def _num(token):
    try:
        return float(str(token).replace(",", "").replace("%", ""))
    except ValueError as exc:
        raise ValueError("Bad chart number: " + str(token)) from exc


def render_bars(title, body):
    meta, data = _chart_meta(body)
    rows = []
    for line in data:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2:
            raise ValueError("Bar row needs a name and a value: " + line)
        value = _num(parts[1])
        display = parts[2] if len(parts) > 2 and parts[2] else parts[1]
        rows.append((parts[0], value, display))
    peak = max((row[1] for row in rows), default=0) or 1
    bits = []
    for name, value, display in rows:
        width = 0 if value <= 0 else value / peak * 100
        bits.append(
            '<div class="report-hbar">'
            f'<span class="report-hbar-name">{esc(name)}</span>'
            f'<span class="report-hbar-track"><span class="report-hbar-fill" style="width:{width:.2f}%"></span></span>'
            f'<span class="report-hbar-val">{esc(display)}</span></div>'
        )
    unit = meta.get("unit", "")
    label = ", ".join(f"{name} {display}" for name, _value, display in rows)
    cap = f'<span class="report-chart-t">{esc(title)}</span>' + (f'<span class="report-chart-u"> · {esc(unit)}</span>' if unit else "")
    return (
        f'<figure class="report-chart">{cap and "<figcaption>" + cap + "</figcaption>"}'
        f'<div class="report-hbars" role="img" aria-label="{esc(title + ". " + label)}">{"".join(bits)}</div></figure>'
    )


def render_grouped(title, body):
    meta, data = _chart_meta(body)
    series = [p.strip() for p in meta.get("series", "A | B").split("|")]
    if len(series) < 2:
        raise ValueError("Grouped chart needs two series")
    rows = []
    for line in data:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3:
            raise ValueError("Grouped row needs a name and two values: " + line)
        rows.append((parts[0], _num(parts[1]), parts[1], _num(parts[2]), parts[2]))
    peak = max((max(row[1], row[3]) for row in rows), default=0) or 1
    legend = (
        '<div class="report-legend"><span><i class="s1"></i>' + esc(series[0]) + "</span><span><i class=\"s2\"></i>"
        + esc(series[1]) + "</span></div>"
    )
    bits = []
    described = []
    for name, left, left_txt, right, right_txt in rows:
        described.append(f"{name} {series[0]} {left_txt}, {series[1]} {right_txt}")
        def bar(value, text, cls):
            width = 0 if value <= 0 else value / peak * 100
            return (
                '<span class="report-gbar-line"><span class="report-gbar ' + cls + f'" style="width:{width:.2f}%"></span>'
                f'<span class="report-gbar-n">{esc(text)}</span></span>'
            )
        bits.append(
            '<div class="report-gbar-row"><span class="report-gbar-name">' + esc(name) + "</span>"
            '<span class="report-gbar-bars">' + bar(left, left_txt, "s1") + bar(right, right_txt, "s2") + "</span></div>"
        )
    unit = meta.get("unit", "")
    cap = f'<span class="report-chart-t">{esc(title)}</span>' + (f'<span class="report-chart-u"> · {esc(unit)}</span>' if unit else "")
    return (
        f'<figure class="report-chart"><figcaption>{cap}</figcaption>{legend}'
        f'<div class="report-gbars" role="img" aria-label="{esc(title + ". " + "; ".join(described))}">{"".join(bits)}</div></figure>'
    )


def render_line(title, body):
    meta, data = _chart_meta(body)
    points = []
    for line in data:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2:
            raise ValueError("Line point needs a label and a value: " + line)
        points.append((parts[0], _num(parts[1]), parts[1]))
    if len(points) < 2:
        raise ValueError("Line chart needs at least two points")
    ymin = _num(meta["min"]) if meta.get("min") else min(p[1] for p in points)
    ymax = _num(meta["max"]) if meta.get("max") else max(p[1] for p in points)
    if ymax <= ymin:
        ymax = ymin + 1
    width, height, left, right, top, bottom = 680, 320, 48, 16, 18, 56
    inner_w, inner_h = width - left - right, height - top - bottom

    def x_at(i):
        return left + inner_w * (i / (len(points) - 1))

    def y_at(value):
        return top + inner_h * (1 - (value - ymin) / (ymax - ymin))

    ticks = [ymin + (ymax - ymin) * i / 4 for i in range(5)]
    grid = []
    for tick in ticks:
        y = y_at(tick)
        label = str(int(tick)) if abs(tick - round(tick)) < 1e-9 else f"{tick:g}"
        grid.append(
            f'<line class="report-grid" x1="{left}" y1="{y:.1f}" x2="{width - right}" y2="{y:.1f}"/>'
            f'<text class="report-axis" x="{left - 8}" y="{y + 4:.1f}" text-anchor="end">{esc(label)}</text>'
        )
    coords = " ".join(f"{x_at(i):.1f},{y_at(value):.1f}" for i, (_lab, value, _raw) in enumerate(points))
    dots, labels = [], []
    for i, (lab, value, raw) in enumerate(points):
        x, y = x_at(i), y_at(value)
        dots.append(f'<circle class="report-dot" cx="{x:.1f}" cy="{y:.1f}" r="4"><title>{esc(lab + ": " + raw)}</title></circle>')
        labels.append(f'<text class="report-axis" x="{x:.1f}" y="{height - 16}" text-anchor="middle">{esc(lab)}</text>')
    unit = meta.get("unit", "")
    cap = f'<span class="report-chart-t">{esc(title)}</span>' + (f'<span class="report-chart-u"> · {esc(unit)}</span>' if unit else "")
    cells = "".join(f"<tr><th>{esc(lab)}</th><td>{esc(raw)}</td></tr>" for lab, _value, raw in points)
    described = ", ".join(f"{lab} {raw}" for lab, _value, raw in points)
    return (
        f'<figure class="report-chart"><figcaption>{cap}</figcaption>'
        f'<div class="report-line-wrap"><svg class="report-line" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(title + ". " + described)}">'
        + "".join(grid)
        + f'<polyline class="report-series" points="{coords}" fill="none"/>'
        + "".join(dots) + "".join(labels)
        + "</svg></div>"
        f'<table class="report-data"><caption>{esc(title)} readings</caption><tbody>{cells}</tbody></table></figure>'
    )


def _node(parts):
    label = parts[0] if parts else ""
    detail = parts[1] if len(parts) > 1 else ""
    return f'<div class="report-node"><b>{esc(label)}</b>' + (f"<span>{esc(detail)}</span>" if detail else "") + "</div>"


def _edge(text, upward=False):
    cls = "report-edge up" if upward else "report-edge"
    arrow = "↑" if upward else "→"
    return f'<div class="{cls}" aria-hidden="true"><span>{esc(text)}</span><i>{arrow}</i></div>'


def render_flow(title, body):
    order = []
    for line in body:
        stripped = line.strip()
        if not stripped:
            continue
        match = re.match(r"^(left|arrow|mid|right|up)\s*:\s*(.*)$", stripped, re.I)
        if not match:
            raise ValueError("Bad flow line: " + stripped)
        key = match.group(1).lower()
        if key == "arrow":
            order.append(("arrow", [match.group(2).strip()]))
        else:
            order.append((key, [p.strip() for p in match.group(2).split("|")]))
    keys = [key for key, _parts in order]
    described = []
    for key, parts in order:
        described.append(" ".join(p for p in parts if p))
    aria = esc(title + ". " + ". ".join(described))
    if keys == ["left", "arrow", "mid", "arrow", "right", "up"]:
        left, a1, mid, a2, right, up = (parts for _key, parts in order)
        edge = up[2] if len(up) > 2 else ""
        html = (
            '<div class="report-flow" role="img" aria-label="' + aria + '">'
            + _node(left) + _edge(a1[0]) + _node(mid) + _edge(a2[0]) + _node(right)
            + '<div class="report-flow-up">' + _edge(edge, upward=True) + _node(up[:2]) + "</div></div>"
        )
    else:
        bits = []
        for key, parts in order:
            bits.append(_edge(parts[0]) if key == "arrow" else _node(parts))
        html = f'<div class="report-flow is-stack" role="img" aria-label="{aria}">{"".join(bits)}</div>'
    return f'<figure class="report-chart"><figcaption><span class="report-chart-t">{esc(title)}</span></figcaption>{html}</figure>'


def render_callout(lead, body):
    text = "\n".join(body).strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()] or [""]
    inner = "".join(f"<p>{inline(re.sub(r'\s+', ' ', p))}</p>" for p in paras)
    lead_html = f'<p class="report-callout-lead">{inline(lead)}</p>' if lead else ""
    return f'<aside class="report-callout">{lead_html}{inner}</aside>'


def _table(lines):
    rows = []
    for line in lines:
        if re.match(r"^\s*\|?\s*:?-{3,}", line):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    head = "".join(f"<th>{inline(c)}</th>" for c in rows[0])
    body = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>" for row in rows[1:])
    return f'<div class="report-table-wrap"><table class="report-table"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def _list(items, kind, sources=False):
    lis = []
    for n, item in enumerate(items, 1):
        attr = f' id="src-{n}"' if sources else ""
        lis.append(f"<li{attr}>{inline(item)}</li>")
    tag = "ol" if kind == "ol" else "ul"
    cls = ' class="report-src"' if sources else ""
    return f"<{tag}{cls}>" + "".join(lis) + f"</{tag}>"


def _quote(lines):
    paras, cite = [], None
    for line in lines:
        text = re.sub(r"^>\s?", "", line).strip()
        if not text:
            continue
        if text.startswith(("—", "–")):
            cite = text.lstrip("—– ").strip()
        else:
            paras.append(text)
    body = "".join(f"<p>{inline(p)}</p>" for p in paras)
    foot = f"<footer>{inline(cite)}</footer>" if cite else ""
    return f'<blockquote class="report-quote">{body}{foot}</blockquote>'


def render_markdown(body):
    """Return (article html, toc html)."""
    lines = body.replace("\r\n", "\n").split("\n")
    used, headings, parts = set(), [], []
    sources = False
    i, n = 0, len(lines)
    while i < n:
        stripped = lines[i].strip()
        if not stripped:
            i += 1
            continue
        if stripped.startswith(":::"):
            kind, title, fence, i = _fence(lines, i)
            if kind == "bars":
                parts.append(render_bars(title, fence))
            elif kind == "grouped":
                parts.append(render_grouped(title, fence))
            elif kind == "line":
                parts.append(render_line(title, fence))
            elif kind == "flow":
                parts.append(render_flow(title, fence))
            elif kind == "callout":
                parts.append(render_callout(title, fence))
            else:
                raise ValueError("Unknown block: " + kind)
            continue
        heading = re.match(r"^(#{2,4})\s+(.+)$", stripped)
        if heading:
            level = min(len(heading.group(1)), 3)
            text = heading.group(2).strip()
            slug = _slug(text, used)
            headings.append((level, slug, text))
            if fold(text) == "sources":
                sources = True
            parts.append(f'<h{level} id="{slug}">{inline(text)}</h{level}>')
            i += 1
            continue
        if stripped.startswith("|"):
            block = []
            while i < n and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            parts.append(_table(block))
            continue
        if stripped.startswith(">"):
            block = []
            while i < n and lines[i].strip().startswith(">"):
                block.append(lines[i])
                i += 1
            parts.append(_quote(block))
            continue
        bullet = re.match(r"^[-*]\s+", stripped)
        number = re.match(r"^\d+\.\s+", stripped)
        if bullet or number:
            kind = "ul" if bullet else "ol"
            items = []
            while i < n:
                row = lines[i].strip()
                if not row:
                    break
                if kind == "ul" and re.match(r"^[-*]\s+", row):
                    items.append(re.sub(r"^[-*]\s+", "", row))
                    i += 1
                    continue
                if kind == "ol" and re.match(r"^\d+\.\s+", row):
                    items.append(re.sub(r"^\d+\.\s+", "", row))
                    i += 1
                    continue
                if items and lines[i].startswith("  ") and not row.startswith(("#", "|", ">", ":::")):
                    items[-1] = items[-1] + " " + row
                    i += 1
                    continue
                break
            parts.append(_list(items, kind, sources=sources and kind == "ol"))
            if sources and kind == "ol":
                sources = False
            continue
        para = [stripped]
        i += 1
        while i < n:
            row = lines[i].strip()
            if not row or row.startswith(("#", "|", ">", ":", "-", "*")) or re.match(r"^\d+\.\s+", row):
                break
            para.append(row)
            i += 1
        parts.append("<p>" + inline(" ".join(para)) + "</p>")
    return "".join(parts), _toc(headings)


def _toc(headings):
    if not headings:
        return ""
    items = []
    for level, slug, text in headings:
        node = {"id": slug, "text": text, "children": []}
        if level <= 2 or not items:
            items.append(node)
        else:
            items[-1]["children"].append(node)
    lis = []
    for node in items:
        kids = ""
        if node["children"]:
            kids = "<ol>" + "".join(
                f'<li><a href="#{esc(child["id"])}">{inline(child["text"])}</a></li>' for child in node["children"]
            ) + "</ol>"
        lis.append(f'<li><a href="#{esc(node["id"])}">{inline(node["text"])}</a>{kids}</li>')
    return '<nav class="report-toc" aria-label="Contents"><p class="report-toc-h">Contents</p><ol>' + "".join(lis) + "</ol></nav>"


def render_fragment(entry, body):
    """Metadata, company pills, contents and the article. Ready to drop into a page."""
    article, toc = render_markdown(body)
    topics = "".join(f'<li>{esc(topic)}</li>' for topic in entry.get("topics") or [])
    pills = "".join(
        f'<a class="report-pill" href="/emmi/#co={esc(company["sym"])}">{esc(company["name"])}</a>'
        for company in entry.get("companies") or []
        if company.get("name") and company.get("sym")
    )
    topic_html = f'<div class="fact"><dt>Topics</dt><dd><ul class="report-topics">{topics}</ul></dd></div>' if topics else ""
    pills_html = (
        '<p class="edition-note">Companies in this report</p><p class="report-pills">' + pills + "</p>" if pills else ""
    )
    return (
        '<div class="report">'
        f'<p class="report-lede">{esc(entry.get("summary") or "")}</p>'
        '<dl class="facts">'
        f'<div class="fact"><dt>Edition date</dt><dd><time datetime="{esc(entry.get("edition_iso") or entry.get("day") or "")}">{esc(entry.get("edition") or "")}</time></dd></div>'
        f'<div class="fact"><dt>Kind</dt><dd>{esc(entry.get("kind") or "")}</dd></div>'
        + topic_html
        + f'<div class="fact"><dt>Source</dt><dd>{esc(entry.get("source") or "")}</dd></div>'
        "</dl>"
        '<section class="status" aria-label="Publication and delivery">'
        f'<article class="is-publication"><h2>Publication</h2><p>{esc(entry.get("publication") or "")}</p></article>'
        f'<article class="is-delivery"><h2>Delivery</h2><p>{esc(entry.get("delivery") or "")}</p></article>'
        "</section>"
        + pills_html
        + toc
        + f'<article class="report-body">{article}</article></div>'
    )


def standalone_html(entry, fragment):
    """The report on its own, with the same theme switch as the edition pages. No password gate."""
    title = entry.get("title") or entry.get("label") or "Report"
    kind = entry.get("kind") or "Special report"
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
<link rel="stylesheet" href="../../editions.css?v=20261120nv1">
<link rel="stylesheet" href="../../analysis.css?v=20261123an1">
</head>
<body class="edition-site">
<a class="skip" href="#main">Skip to content</a>
<div class="emmi-bar">
  <div class="wrap bar-row">
    <p class="back" style="margin:0"><a href="/emmi/">Back to EMMI</a></p>
    <button class="theme-toggle" id="themeButton" type="button" title="Switch light / dark theme" aria-pressed="false">Light</button>
  </div>
</div>
<main class="wrap" id="main">
<p class="kicker">{esc(kind)}</p>
<header class="bh"><h1>{esc(title)}</h1></header>
{fragment}
<p class="page-links"><a href="./">Edition page</a></p>
<div id="pageEnd"></div>
</main>
<script src="../../editions.js?v=20261120nv1"></script>
</body>
</html>
"""
