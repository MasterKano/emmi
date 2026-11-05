#!/usr/bin/env python3
"""UK and Germany project pipeline for the Grid & DC tab (data/pipeline_projects.json).

Situational awareness of power, grid and data-centre projects. Not a price signal.
No API keys. Each source is public:

  UK grid        NESO TEC register and embedded register (CKAN), about twice a week
  UK planning    DESNZ Renewable Energy Planning Database, quarterly CSV
  UK data centres  Planning Inspectorate NSIP register (name or description) and
                 the hand-maintained powered-land log (data/powered_land_deals.json)
  DE generation  Marktstammdatenregister public JSON: ground-mounted solar and
                 batteries above 20 MW; wind grouped into parks

Customer names of natural persons are not stored (MaStR organisation flag only).
NESO does not publish demand-only data centres; the German Rechenzentrumsregister
blocks scripted downloads, so it is not used.

  python scripts/build_pipeline.py            refresh data/pipeline_projects.json
  python scripts/build_pipeline.py --self-check

A failed source keeps that source's rows from the previous file. An unchanged
stage, MW, owner and name keeps the previous last-change date.
"""
import csv, datetime as dt, hashlib, io, json, os, re, sys, time
import urllib.parse

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write_json  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "pipeline_projects.json")
CACHE = os.environ.get("PIPELINE_CACHE") or "/tmp/emmi-pipeline"
UTC = dt.timezone.utc
TODAY = dt.datetime.now(UTC).date().isoformat()
NOWS = dt.datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ")
H = {"User-Agent": "Mozilla/5.0 (markets-monitor; public data)"}

NESO = "https://api.neso.energy/api/3/action/package_show?id="
NESO_PAGE = {
    "T": "https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register",
    "E": "https://www.neso.energy/data-portal/embedded-register",
}
REPD_PUB = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
NSIP_URL = "https://national-infrastructure-consenting.planninginspectorate.gov.uk/api/applications-download"
NSIP_PAGE = "https://national-infrastructure-consenting.planninginspectorate.gov.uk/projects/"
MASTR = "https://www.marktstammdatenregister.de/MaStR/Einheit/EinheitJson/GetErweiterteOeffentlicheEinheitStromerzeugung"
MASTR_WEB = "https://www.marktstammdatenregister.de/MaStR/Einheit/Einheiten/ErweiterteOeffentlicheEinheitenuebersicht"
MASTR_UNIT = "https://www.marktstammdatenregister.de/MaStR/Einheit/Detail/IndexOeffentlich/"
PS = 2500

# NESO: the scoping queue is enormous, so early-stage rows use a higher floor.
# Later stages stay visible at a lower floor. REPD fills planning projects the
# connection registers do not list. Data-centre rows are kept even when small.
# Floors keep the file under the on-demand size budget and on the projects large
# enough to matter for a pipeline view. The registers themselves are larger;
# the Grid tab's queue and MaStR charts still cover the smaller units.
NESO_FLOOR = {"planning": 600, "consented": 200, "build": 80, "ops": 250}
REPD_FLOOR = {"planning": 200, "consented": 250, "build": 80, "ops": 400}
DE_SOLAR_BAT_MW = 60
DE_WIND_MW = 60

TY_ORDER = "SBWONHPGDCX"
DC_RE = re.compile(r"data\s*cent(?:re|er)s?", re.I)
MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"], 1)}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def get_bytes(url, timeout=180):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha256(url.encode()).hexdigest())
    if os.path.exists(path) and os.path.getsize(path) > 200:
        return open(path, "rb").read()
    err = None
    for i in range(4):
        try:
            r = requests.get(url, headers=H, timeout=timeout)
            if r.status_code == 200 and r.content:
                open(path, "wb").write(r.content)
                return r.content
            err = IOError(f"HTTP {r.status_code} {url[:80]}")
        except Exception as e:  # noqa: BLE001
            err = e
        time.sleep(4 * (i + 1))
    raise err


def get_json(url):
    return json.loads(get_bytes(url))


def file_date(name):
    m = re.search(r"(\d{1,2})-(\d{1,2}|[a-z]+)-(20\d\d)", (name or "").lower())
    if not m:
        return ""
    d, mo, y = m.groups()
    mo = int(mo) if mo.isdigit() else MONTHS.get(mo)
    try:
        return dt.date(int(y), mo, int(d)).isoformat()
    except (TypeError, ValueError):
        return ""


def num(s):
    s = (s or "").strip().replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def soften(s):
    """Publish ALL-CAPS register names in title case. Mixed-case names stay as published."""
    s = (s or "").replace("＆", "&").replace("\n", " ").strip()
    s = re.sub(r"\s+", " ", s)
    letters = [c for c in s if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.75:
        return s
    pretty = {"GMBH": "GmbH", "KG": "KG", "AG": "AG", "SE": "SE", "BV": "BV", "NV": "NV", "AB": "AB",
              "SA": "SA", "PLC": "PLC", "LLP": "LLP", "INC": "Inc", "CO": "Co", "UK": "UK", "GB": "GB"}
    out = []
    for w in s.split():
        raw = w.strip(",")
        token = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
        if token in pretty:
            out.append(pretty[token] + raw[len(token):] if raw.upper().startswith(token) else pretty[token])
        else:
            out.append(raw[:1].upper() + raw[1:].lower() if raw else raw)
    return " ".join(out)


def ty_join(codes):
    return "".join(c for c in TY_ORDER if c in codes) or "X"


def sig(r):
    mw = r.get("mw")
    mw_s = "" if mw is None else f"{float(mw):.1f}"
    return (r.get("st") or "", mw_s, r.get("own") or "", r.get("n") or "")


def row(id_, name, own, mw, ty, stage, loc, chg, src, url, raw, nu=None):
    r = {"id": id_, "n": (name or "").strip() or "Unnamed project", "own": soften(own),
         "mw": None if mw is None else round(float(mw), 1), "ty": ty or "X", "st": stage,
         "loc": re.sub(r"\s+", " ", (loc or "").strip()), "chg": chg or "", "src": src,
         "u": url or "", "rs": (raw or "").strip()}
    if nu and nu > 1:
        r["nu"] = int(nu)
    if r["mw"] is not None and r["mw"] <= 0:
        r["mw"] = None
    return r


# ---------------------------------------------------------------- stages
def neso_stage(status):
    return {"Scoping": "planning", "Awaiting Consents": "planning", "Consents Approved": "consented",
            "Under Construction/Commissioning": "build", "Built": "ops"}.get((status or "").strip())


def repd_stage(status):
    return {"Application Submitted": "planning", "Appeal Lodged": "planning", "Revised": "planning",
            "Awaiting Construction": "consented", "No Application Required": "consented",
            "Under Construction": "build", "Operational": "ops"}.get((status or "").strip())


def nsip_stage(stage, withdrawn):
    if (withdrawn or "").strip():
        return None
    s = (stage or "").strip().lower()
    if s in ("pre-application", "pre application", "acceptance", "pre-examination", "examination", "recommendation"):
        return "planning"
    if s in ("decision", "decided", "post-decision", "post decision"):
        return "consented"
    return "planning" if s else None


def tech_neso(pt, name, customer):
    codes = set()
    for p in (pt or "").lower().split(";"):
        p = p.strip()
        if not p:
            continue
        if "pv" in p or "solar" in p:
            codes.add("S")
        elif "storage" in p or p.startswith("laes"):
            codes.add("B")
        elif "offshore" in p:
            codes.add("O")
        elif "wind" in p:
            codes.add("W")
        elif "nuclear" in p:
            codes.add("N")
        elif "pump" in p:
            codes.add("P")
        elif "hydro" in p:
            codes.add("H")
        elif any(k in p for k in ("ccgt", "ocgt", "gas", "chp", "thermal", "oil")):
            codes.add("G")
        elif "demand" in p:
            codes.add("D")
        else:
            codes.add("X")
    if DC_RE.search(f"{name or ''} {customer or ''}"):
        codes.add("C")
    return ty_join(codes)


def tech_repd(tech, storage):
    t = (tech or "").lower()
    codes = set()
    if "solar" in t:
        codes.add("S")
    elif "offshore" in t:
        codes.add("O")
    elif "wind" in t:
        codes.add("W")
    elif "battery" in t or "storage" in t:
        codes.add("B")
    elif "hydro" in t:
        codes.add("H")
    else:
        codes.add("X")
    st = (storage or "").strip().lower()
    if st and st not in ("not set", "none", "n/a"):
        codes.add("B")
    return ty_join(codes)


def tech_text(text):
    t = (text or "").lower()
    codes = set()
    if DC_RE.search(t):
        codes.add("C")
    if "solar" in t or "photovoltaic" in t:
        codes.add("S")
    if "battery" in t or "bess" in t or "storage" in t:
        codes.add("B")
    if "offshore wind" in t:
        codes.add("O")
    elif re.search(r"\bwind\b", t):
        codes.add("W")
    if "nuclear" in t:
        codes.add("N")
    if re.search(r"\bgas\b|ccgt|ocgt", t):
        codes.add("G")
    return ty_join(codes) if codes else "C"


def mw_from_text(s):
    best = None
    for n, u in re.findall(r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(gw|mw)\b", (s or "").lower()):
        v = float(n.replace(",", "")) * (1000 if u == "gw" else 1)
        if 0.3 <= v <= 8000:
            best = v if best is None else max(best, v)
    return best


def norm_name(s):
    s = re.sub(r"[^a-z0-9]+", " ", (s or "").lower())
    drop = {"ltd", "limited", "plc", "llp", "gmbh", "inc", "the", "project", "farm", "energy", "power",
            "station", "bess", "solar", "wind", "park", "phase", "extension", "and", "of"}
    return " ".join(t for t in s.split() if t not in drop and not t.isdigit())


def same_project(a, b):
    """True when two register names are the same project. Short names are left as two rows."""
    a, b = norm_name(a), norm_name(b)
    if len(a) < 8 or len(b) < 8:
        return False
    if a == b:
        return True
    short, long = (a, b) if len(a) <= len(b) else (b, a)
    return len(short) >= 12 and short in long


# ---------------------------------------------------------------- UK NESO
def neso_rows():
    out, meta = [], {}
    for reg, pkg in (("T", "transmission-entry-capacity-tec-register"), ("E", "embedded-register")):
        info = get_json(NESO + pkg)["result"]["resources"][0]
        url = info["url"]
        asof = file_date(url.split("?")[0].rsplit("/", 1)[-1]) or (info.get("last_modified") or "")[:10] or TODAY
        text = get_bytes(url).decode("utf-8-sig", "replace")
        src = "NESO TEC" if reg == "T" else "NESO embedded"
        n = 0
        for x in csv.DictReader(io.StringIO(text)):
            pn = (x.get("Project Number") or x.get("Project No") or "").strip()
            stage = neso_stage(x.get("Project Status"))
            mw = num(x.get("Cumulative Total Capacity (MW)"))
            if not pn or not stage or mw is None:
                continue
            if mw < NESO_FLOOR[stage] and not DC_RE.search(f"{x.get('Project Name') or ''} {x.get('Customer Name') or ''}"):
                continue
            n += 1
            out.append(row(
                f"neso:{reg}:{pn}", x.get("Project Name"), x.get("Customer Name"), mw,
                tech_neso(x.get("Plant Type"), x.get("Project Name"), x.get("Customer Name")),
                stage, x.get("Connection Site"), asof, src, "", x.get("Project Status")))
        meta[src] = {"asof": asof, "url": NESO_PAGE[reg], "file": url, "rows": n}
        log(f"{src} {asof}: {n} rows kept")
    return out, meta


# ---------------------------------------------------------------- UK REPD
def repd_rows(neso):
    html = get_bytes(REPD_PUB).decode("utf-8", "replace")
    urls = re.findall(r"https://assets\.publishing\.service\.gov\.uk/[^\"']+\.csv", html)
    if not urls:
        raise IOError("REPD CSV link missing on the GOV.UK publication page")
    url = urls[0]
    text = get_bytes(url).decode("utf-8-sig", "replace")
    out = []
    latest = ""
    for x in csv.DictReader(io.StringIO(text)):
        stage = repd_stage(x.get("Development Status (short)"))
        mw = num(x.get("Installed Capacity (MWelec)"))
        if not stage or mw is None or mw < REPD_FLOOR[stage]:
            continue
        name = (x.get("Site Name") or "").strip()
        if any(same_project(name, n["n"]) for n in neso):
            continue
        chg = ""
        raw_d = (x.get("Record Last Updated (dd/mm/yyyy)") or "").strip()
        try:
            chg = dt.datetime.strptime(raw_d[:10], "%d/%m/%Y").date().isoformat()
        except ValueError:
            chg = ""
        if chg > latest:
            latest = chg
        loc = ", ".join(p for p in ((x.get("County") or "").strip(), (x.get("Region") or "").strip(),
                                    (x.get("Country") or "").strip()) if p and p.lower() != "not set")
        ref = (x.get("Ref ID") or x.get("Old Ref ID") or name).strip()
        out.append(row(
            "repd:" + ref, name, x.get("Operator (or Applicant)"), mw,
            tech_repd(x.get("Technology Type"), x.get("Storage Type")),
            stage, loc, chg or latest or TODAY, "REPD", "", x.get("Development Status (short)")))
    log(f"REPD {url.rsplit('/', 1)[-1]}: {len(out)} rows kept (record dates through {latest or 'n/a'})")
    return out, {"asof": latest or TODAY, "url": REPD_PUB, "file": url, "rows": len(out)}


# ---------------------------------------------------------------- UK NSIP data centres
def nsip_rows():
    text = get_bytes(NSIP_URL).decode("utf-8-sig", "replace")
    out = []
    for x in csv.DictReader(io.StringIO(text)):
        desc = x.get("Description") or ""
        name = x.get("Project name") or ""
        if not DC_RE.search(name + " " + desc):
            continue
        stage = nsip_stage(x.get("Stage"), x.get("Date withdrawn"))
        if not stage:
            continue
        ref = (x.get("Project reference") or "").strip()
        loc = ", ".join(p for p in ((x.get("Location") or "").strip(), (x.get("Region") or "").strip()) if p)
        if len(loc) > 180:
            loc = (x.get("Region") or "").strip()
        chg = (x.get("Date of decision") or x.get("Date of application") or "")[:10]
        if not re.match(r"20\d\d-\d\d-\d\d", chg):
            chg = TODAY
        out.append(row(
            "nsip:" + ref, name, x.get("Applicant name"), mw_from_text(name + " " + desc),
            tech_text(name + " " + desc), stage, loc, chg, "NSIP", NSIP_PAGE + ref, x.get("Stage")))
    log(f"NSIP data centres: {len(out)}")
    return out, {"asof": TODAY, "url": NSIP_URL, "rows": len(out)}


def land_stage(blob):
    b = (blob or "").lower()
    if re.search(r"operat|in operation|commissioned", b):
        return "ops"
    if re.search(r"under construction|construction start", b):
        return "build"
    if re.search(r"consent|permission granted|permitted", b):
        return "consented"
    if re.search(r"planning|exclusiv|develop|application", b):
        return "planning"
    return "unstated"


def land_mw(text):
    v = mw_from_text(str(text or ""))
    if v is not None:
        return v
    m = re.search(r"(\d+(?:\.\d+)?)", str(text or "").replace(",", ""))
    return float(m.group(1)) if m else None


# ---------------------------------------------------------------- Germany MaStR
def msd(s):
    m = re.search(r"-?\d+", s or "")
    if not m:
        return ""
    return dt.datetime.fromtimestamp(int(m.group()) / 1000, UTC).date().isoformat()


def mastr_fetch(filt):
    out, page, tot = [], 1, None
    while True:
        q = urllib.parse.urlencode({"page": page, "pageSize": PS, "filter": filt})
        j = get_json(MASTR + "?" + q)
        d = j.get("Data") or []
        tot = j.get("Total") if tot is None else tot
        out.extend(d)
        log(f"  MaStR page {page}: {len(out)}/{tot}")
        if len(d) < PS or page * PS >= (tot or 0):
            break
        page += 1
        time.sleep(0.4)
    if tot is None or len(out) < tot * 0.98:
        raise IOError(f"MaStR incomplete: {len(out)} of {tot}")
    return out


def de_owner(x):
    if x.get("AnlagenbetreiberPersonenArt") != 517 or x.get("IsAnonymisiert"):
        return ""
    return x.get("AnlagenbetreiberName") or x.get("AnlagenbetreiberMaskedName") or ""


def de_place(x):
    parts = []
    for k in ("Gemeinde", "Ort", "Landkreis", "Bundesland"):
        v = (x.get(k) or "").strip()
        if v and v.lower() != "none" and v not in parts:
            parts.append(v)
    return ", ".join(parts[:3])


def de_stage(x):
    return {31: "planning", 35: "ops"}.get(x.get("BetriebsStatusId"))


def wind_tech(x):
    blob = " ".join(str(x.get(k) or "") for k in ("WindAnLandOderSeeBezeichnung", "Bundesland")).lower()
    if "auf see" in blob or "offshore" in blob or "ausschlie" in blob or x.get("WindClusterNordseeId") or x.get("WindClusterOstseeId"):
        return "O"
    return "W"


def de_rows():
    solar_f = "Energieträger~eq~'2495'~and~Art der Solaranlage~eq~'852'~and~Nettonennleistung der Einheit~gt~'20000'"
    bat_f = "Energieträger~eq~'2496'~and~Speichertechnologie~eq~'524'~and~Nettonennleistung der Einheit~gt~'20000'"
    wind_pl = "Energieträger~eq~'2497'~and~Nettonennleistung der Einheit~gt~'1000'~and~Betriebs-Status~eq~'31'"
    wind_op = "Energieträger~eq~'2497'~and~Nettonennleistung der Einheit~gt~'10000'~and~Betriebs-Status~eq~'35'"
    units = []
    for label, filt, kind in (("solar", solar_f, "S"), ("battery", bat_f, "B"),
                              ("wind planning", wind_pl, "W"), ("wind operating", wind_op, "W")):
        log("MaStR", label)
        for x in mastr_fetch(filt):
            x["_kind"] = kind
            units.append(x)
    groups = {}
    singles = []
    for x in units:
        stage = de_stage(x)
        if not stage:
            continue
        kind = x["_kind"]
        park = ""
        if kind == "W":
            park = (x.get("WindparkName") or "").strip()
        elif kind == "S":
            park = (x.get("SolarparkName") or "").strip()
        if park:
            key = (kind, park.lower(), stage, (x.get("Bundesland") or "").strip().lower())
            groups.setdefault(key, []).append(x)
        elif kind == "W":
            key = ("Wloc", de_owner(x).lower(), (x.get("Gemeinde") or x.get("Landkreis") or "").strip().lower(),
                   (x.get("Bundesland") or "").strip().lower(), stage)
            groups.setdefault(key, []).append(x)
        else:
            singles.append(x)
    out = []

    def emit_group(key, xs):
        mw = sum((x.get("Nettonennleistung") or 0) for x in xs) / 1000
        if mw < DE_WIND_MW and key[0] in ("W", "Wloc"):
            return
        if mw < DE_SOLAR_BAT_MW:
            return
        big = max(xs, key=lambda x: x.get("Nettonennleistung") or 0)
        kind = "W" if key[0] == "Wloc" else key[0]
        if kind == "W":
            techs = {wind_tech(x) for x in xs}
            ty = "O" if techs == {"O"} else ("W" if techs == {"W"} else ty_join(techs))
            name = (big.get("WindparkName") or "").strip() or (big.get("SolarparkName") or "").strip()
        else:
            ty = kind
            name = (big.get("SolarparkName") or big.get("WindparkName") or "").strip()
        if not name:
            where = de_place(big) or "Germany"
            name = {"S": "Solar", "B": "Battery", "W": "Wind", "O": "Offshore wind"}.get(ty, "Project") + " in " + where
        owners = {}
        for x in xs:
            o = de_owner(x)
            if o:
                owners[o] = owners.get(o, 0) + (x.get("Nettonennleistung") or 0)
        own = max(owners, key=owners.get) if owners else ""
        chg = max((msd(x.get("DatumLetzteAktualisierung")) for x in xs), default="") or TODAY
        raw = big.get("BetriebsStatusName") or ("In Planung" if xs[0] and de_stage(big) == "planning" else "In Betrieb")
        gid = "mastr:" + hashlib.sha1(repr(key).encode()).hexdigest()[:12]
        out.append(row(gid, name, own, mw, ty, de_stage(big), de_place(big), chg, "MaStR",
                       MASTR_UNIT + str(big.get("Id") or ""), raw, len(xs)))

    for key, xs in groups.items():
        emit_group(key, xs)
    for x in singles:
        mw = (x.get("Nettonennleistung") or 0) / 1000
        if mw < DE_SOLAR_BAT_MW:
            continue
        stage = de_stage(x)
        kind = x["_kind"]
        name = (x.get("EinheitName") or "").strip() if de_owner(x) or x.get("AnlagenbetreiberPersonenArt") == 517 else ""
        if not name:
            name = {"S": "Solar", "B": "Battery"}.get(kind, "Unit") + " in " + (de_place(x) or "Germany")
        sid = x.get("MaStRNummer") or str(x.get("Id"))
        out.append(row(
            "mastr:" + str(sid), name, de_owner(x), mw, kind, stage, de_place(x),
            msd(x.get("DatumLetzteAktualisierung")) or TODAY, "MaStR",
            MASTR_UNIT + str(x.get("Id") or ""), x.get("BetriebsStatusName") or ""))
    log(f"MaStR rows kept: {len(out)}")
    return out, {"asof": TODAY, "url": MASTR_WEB, "rows": len(out)}


def sort_rows(rows):
    rows.sort(key=lambda r: (-(r["mw"] or -1), r["n"].lower(), r["id"]))
    return rows


def apply_history(rows, prev):
    for r in rows:
        p = prev.get(r["id"])
        if not p:
            continue
        if sig(p) == sig(r) and p.get("chg"):
            r["chg"] = p["chg"]
        elif sig(p) != sig(r):
            r["chg"] = TODAY
    return rows


def keep_source(old_rows, src):
    return [r for r in old_rows or [] if r.get("src") == src]


def load_prev():
    if not os.path.exists(OUT):
        return {"uk": [], "de": []}, {}
    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        log("previous file unreadable", e)
        return {"uk": [], "de": []}, {}
    prev = {}
    for cc in ("uk", "de"):
        for r in old.get(cc) or []:
            if r.get("id"):
                prev[r["id"]] = r
    return old, prev


def build(old, prev):
    warnings = []
    meta = {}
    uk, de = [], []

    def run(label, fn):
        try:
            rows, m = fn()
            meta[label] = m
            return rows
        except Exception as e:  # noqa: BLE001
            log("FAILED", label, type(e).__name__, e)
            warnings.append(f"{label}: {type(e).__name__}: {str(e)[:180]}")
            return None

    neso = run("neso", neso_rows)
    if neso is None:
        uk += keep_source(old.get("uk"), "NESO TEC") + keep_source(old.get("uk"), "NESO embedded")
    else:
        uk += neso

    repd = run("repd", lambda: repd_rows([r for r in uk if str(r.get("src", "")).startswith("NESO")]))
    uk += keep_source(old.get("uk"), "REPD") if repd is None else repd

    nsip = run("nsip", nsip_rows)
    uk += keep_source(old.get("uk"), "NSIP") if nsip is None else nsip

    try:
        luk, lde, lm = land_rows_fixed()
        meta["powered_land"] = lm
        uk += luk
        de += lde
    except Exception as e:  # noqa: BLE001
        log("FAILED powered land", e)
        warnings.append(f"powered land: {type(e).__name__}: {e}"[:180])
        uk += keep_source(old.get("uk"), "Powered land")
        de += keep_source(old.get("de"), "Powered land")

    mastr = run("mastr", de_rows)
    de += keep_source(old.get("de"), "MaStR") if mastr is None else mastr

    uk, de = sort_rows(apply_history(uk, prev)), sort_rows(apply_history(de, prev))
    if not uk or not de:
        raise SystemExit(f"refusing to write an empty table (UK {len(uk)}, DE {len(de)})")
    doc = {
        "generated_utc": NOWS,
        "about": "Situational awareness of UK and German power, grid and data-centre projects. Not a trading signal.",
        "cadence": "Monday and Thursday 06:20 UTC, and when scripts/build_pipeline.py is run",
        "stages": ["planning", "consented", "build", "ops", "unstated"],
        "stage_labels": {"planning": "Planning", "consented": "Consented", "build": "Build", "ops": "Operating", "unstated": "Not stated"},
        "types": {"S": "Solar", "B": "Battery", "W": "Onshore wind", "O": "Offshore wind", "N": "Nuclear",
                  "H": "Hydro", "P": "Pumped storage", "G": "Gas", "D": "Demand", "C": "Data centre", "X": "Other"},
        "floors_mw": {"neso": NESO_FLOOR, "repd": REPD_FLOOR, "de_solar_battery": DE_SOLAR_BAT_MW, "de_wind_park": DE_WIND_MW},
        "meta": meta,
        "warnings": warnings,
        "uk": uk,
        "de": de,
    }
    write_json(OUT, doc)
    log(f"wrote {OUT} {os.path.getsize(OUT)} B · UK {len(uk)} · DE {len(de)} · warnings {len(warnings)}")
    return 0


def land_rows_fixed():
    """Powered-land log: UK and Germany only. MW is the first number the log states."""
    path = os.path.join(DATA, "powered_land_deals.json")
    doc = json.load(open(path, encoding="utf-8"))
    uk, de = [], []
    uk_c = {"uk", "gb", "united kingdom", "england", "scotland", "wales"}
    de_c = {"de", "germany", "deutschland"}
    for i, x in enumerate(doc.get("rows") or []):
        c = (x.get("c") or "").strip().lower()
        bucket = uk if c in uk_c else de if c in de_c else None
        if bucket is None:
            continue
        blob = " ".join(str(x.get(k) or "") for k in ("ty", "note", "px"))
        d = (x.get("d") or "")
        if re.match(r"20\d\d-\d\d-\d\d", d):
            chg = d[:10]
        elif re.match(r"20\d\d-\d\d", d):
            chg = d[:7] + "-01"
        elif re.match(r"20\d\d$", d):
            chg = d + "-01-01"
        else:
            chg = doc.get("checked") or TODAY
        srcs = x.get("src") or []
        url = srcs[0][1] if srcs and len(srcs[0]) > 1 else ""
        own = " / ".join(p for p in (x.get("sel"), x.get("buy")) if p and "undisclosed" not in str(p).lower())
        bucket.append(row(
            f"land:{chg}:{(x.get('site') or i)}", x.get("site") or "Data-centre site", own, land_mw(x.get("mw")),
            "C", land_stage(blob), ", ".join(p for p in (x.get("site"), x.get("c")) if p),
            chg, "Powered land", url, x.get("ty") or "site deal"))
    log(f"powered land: UK {len(uk)}, DE {len(de)}")
    return uk, de, {"asof": doc.get("checked") or "", "rows": len(uk) + len(de)}


def self_check():
    assert neso_stage("Scoping") == "planning"
    assert neso_stage("Awaiting Consents") == "planning"
    assert neso_stage("Consents Approved") == "consented"
    assert neso_stage("Under Construction/Commissioning") == "build"
    assert neso_stage("Built") == "ops"
    assert neso_stage("Something else") is None
    assert repd_stage("Awaiting Construction") == "consented"
    assert repd_stage("Under Construction") == "build"
    assert repd_stage("Application Submitted") == "planning"
    assert repd_stage("Application Refused") is None
    assert repd_stage("Decommissioned") is None
    assert nsip_stage("Pre-application", "") == "planning"
    assert nsip_stage("Post-decision", "") == "consented"
    assert nsip_stage("Examination", "2024-01-01") is None
    assert tech_neso("Energy Storage System;PV Array (Photo Voltaic/solar)", "", "") == "SB"
    assert "C" in tech_neso("Demand", "North Data Centre", "Example Ltd")
    assert tech_repd("Wind Offshore", "Not set") == "O"
    assert tech_repd("Solar Photovoltaics", "Battery") == "SB"
    assert mw_from_text("IT load of up to c.300MW across the three buildings (c.100 MW each)") == 300
    assert mw_from_text("two reactors of 3,260MW") == 3260
    assert mw_from_text("no capacity here") is None
    assert soften("NEW ENERGY PARTNERSHIP LIMITED") == "New Energy Partnership Limited"
    assert soften("EnBW He Dreiht GmbH & Co. KG") == "EnBW He Dreiht GmbH & Co. KG"
    assert same_project("Hornsea Two", "Hornsea Two Wind Farm Ltd")
    assert not same_project("AB", "AB Wind")
    assert land_stage("Accepted power connection offer; exclusivity for a powered-land sale") == "planning"
    assert land_mw("48 IT (75 MVA)") == 48
    kept = apply_history([row("a", "N", "O", 10, "S", "ops", "X", "2026-01-01", "REPD", "", "Operational")],
                         {"a": {"st": "ops", "mw": 10, "own": "O", "n": "N", "chg": "2024-05-01"}})
    assert kept[0]["chg"] == "2024-05-01"
    changed = apply_history([row("a", "N", "O", 12, "S", "ops", "X", "2026-01-01", "REPD", "", "Operational")],
                            {"a": {"st": "ops", "mw": 10, "own": "O", "n": "N", "chg": "2024-05-01"}})
    assert changed[0]["chg"] == TODAY
    print("self-check ok")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
    else:
        # main() delegates to build(); ignore its unused first attempt
        old, prev = load_prev()
        raise SystemExit(build(old, prev))
