"""Upcoming dated items per company for the company 1Y chart (shaded windows / exact markers).
Reads research/source/moonshot/coming_up.json, writes a small JSON published as research/data/chart_windows.json.
Only reshapes existing fields: precision + anchor -> the calendar window the date label already names
(month, quarter, half, year); exact items keep their single day. Usage: chart_windows.py IN OUT"""
import calendar, json, re, sys

src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding="utf-8"))
SPAN = {"month": 1, "quarter": 3, "half": 6, "year": 12}
out = {}
for i in d.get("items", []):
    p, a = i.get("precision"), i.get("anchor") or ""
    if i.get("status") not in ("upcoming", "overdue", "slipped") or not re.match(r"\d{4}-\d{2}-\d{2}$", a):
        continue
    y, m = int(a[:4]), int(a[5:7])
    if p == "exact":
        s = e = a
    elif p in SPAN:
        n = SPAN[p]
        m0 = (m - 1) // n * n + 1
        m1 = m0 + n - 1
        s, e = f"{y}-{m0:02d}-01", f"{y}-{m1:02d}-{calendar.monthrange(y, m1)[1]:02d}"
    else:
        continue
    code = re.sub(r"[^A-Z0-9]", "", (i.get("link_key") or i.get("company_code") or "").upper())
    if not code:
        continue
    out.setdefault(f"{i.get('market', '')}|{code}", []).append(
        {"p": p, "s": s, "e": e, "l": i.get("date_label") or "", "h": i.get("headline") or "", "u": i.get("source_url") or "",
         "st": i.get("status")})
for v in out.values():
    v.sort(key=lambda x: (x["s"], x["e"]))
json.dump({"as_of": d.get("as_of"), "source": "research calendar (coming_up.json)", "companies": out},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"chart windows: {len(out)} companies, {sum(map(len, out.values()))} items")
