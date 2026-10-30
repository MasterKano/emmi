"""One-off, logged backfill of release time for PILOT events only (not all 742).
release_time = ISO local time with offset; tz = IANA zone; time_basis = stated | recovered | assumed.
stated    = time printed by the exchange news service for that announcement (Investegate/RNS, Nasdaq, Newsweb)
recovered = publish time in the source page's metadata (other sites), same date as the event
assumed   = no time found -> treated as after the close (counts from the next session)."""
import re, time, datetime as dt, sys
from zoneinfo import ZoneInfo
from rcommon import *
try:
    from curl_cffi import requests as http; S = http.Session(impersonate="chrome")
except ImportError:
    import requests as http; S = http.Session(); S.headers["User-Agent"] = "Mozilla/5.0"
def get(u):
    r = S.get(u, timeout=30); r.raise_for_status(); return r.text
def parse(url, html):
    if "investegate.co.uk" in url:
        m = re.search(r'"dateCreated":\s*"(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)"', html)
        if m: return dt.datetime.fromisoformat(f"{m[1]}T{m[2]}").replace(tzinfo=ZoneInfo("Europe/London")), "Europe/London", "stated", "investegate dateCreated"
    if "view.news.eu.nasdaq.com" in url:
        m = re.search(r"(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) (CET|CEST)", html)
        if m: return dt.datetime.fromisoformat(f"{m[1]}T{m[2]}").replace(tzinfo=ZoneInfo("Europe/Stockholm")), "Europe/Stockholm", "stated", "nasdaq news timestamp"
    if "newsweb.oslobors.no" in url:
        m = re.search(r'"publishedTime":"([^"]+)"', html)
        if m: return dt.datetime.fromisoformat(m[1].replace("Z", "+00:00")).astimezone(ZoneInfo("Europe/Oslo")), "Europe/Oslo", "stated", "newsweb publishedTime"
    m = re.search(r'(?:article:published_time"\s+content="|"datePublished"\s*:\s*")(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d))', html)
    if m:
        t = dt.datetime.fromisoformat(m[1].replace("Z", "+00:00"))
        if t.time() != dt.time(0, 0): return t, str(t.tzinfo), "recovered", "page published_time metadata"
    return None
EV = rcsv(os.path.join(RES, "pilot_events.csv")); P = {p["listing_id"]: p for p in rcsv(os.path.join(RES, "pilot.csv"))}
out, log, cache = [], [], {}
for e in EV:
    u = e["source_url"]; res, note = None, "no source url"
    if u.startswith("http"):
        fu = u
        if "newsweb.oslobors.no/message/" in u:
            fu = "https://api3.oslo.oslobors.no/v1/newsreader/message?messageId=" + u.rstrip("/").split("/")[-1]
        try:
            if fu not in cache: cache[fu] = get(fu); time.sleep(0.6)
            res = parse(u, cache[fu]); note = "no time on page" if not res else ""
        except Exception as x: note = f"fetch failed: {str(x)[:60]}"
    if res and abs((res[0].date() - dt.date.fromisoformat(e["date"])).days) > 1:
        note = f"page date {res[0].date()} != event date; kept assumed"; res = None
    tz = SESSION[e["listing_id"].split(":")[0]][0]
    if res: t, tzn, basis, how = res; t = t.astimezone(ZoneInfo(tz)); rt = t.isoformat(timespec="seconds")
    else: rt, basis, how = "", "assumed", "assumed after close (rule: unknown = after close)"
    out.append(dict(event_id=e["event_id"], listing_id=e["listing_id"], date=e["date"], release_time=rt, tz=tz, time_basis=basis))
    log.append(dict(event_id=e["event_id"], source_url=u, result=basis, method=how, note=note, run_at=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")))
wcsv(os.path.join(RES, "release_times.csv"), out)
wcsv(os.path.join(RES, "logs", f"release_time_backfill_{dt.date.today()}.csv"), log)
from collections import Counter; print(Counter(r["time_basis"] for r in out), Counter(l["note"][:20] for l in log))
