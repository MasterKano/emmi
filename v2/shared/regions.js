/* Equities Monitor regions for the Markets tab (Jerry 23 Nov 2026, t1592u-t1595u): the Morning Pulse v1.10 rules, live on the
   reader's clock. window.EMMIRegions.
   order(now)        regions newest session OPEN first on the Zurich clock: Asia opens 01:00, Europe 09:00, US 15:30, so a
                     normal weekday reads 01:00-08:59 Asia -> US -> Europe, 09:00-15:29 Europe -> Asia -> US, 15:30-00:59
                     US -> Europe -> Asia. A day a region is shut (weekend, exchange holiday) is not an open: on US
                     Thanksgiving at 16:00 the order is Europe -> Asia -> US.
   pill(region, now) the region's session pill: "Live 16:05 CET" / "Midday 04:10 CET" / "Close Mon 23 Nov" (+ " · Tokyo shut").
   lineup(region, by, now)  the region's tiles, 2 rows of 4 (Pulse v1.10): a row that cannot be filled to 4 from its own
                     tiles and the region's reserves is dropped whole.
   Holidays: EMMi clocks.js calendars (NYSE, LSE, STO, SIX, SSE, HKEX, ASX), Tokyo below, and the weekdays with no Western
   close (the Pulse's assets/market_holidays.json); Xetra/Euronext are shut where London and Zurich are both shut.
   Same rules as lib/equity_regions.py in the Pulse build and scripts/build_region_maps.py in emmi-data. */
(function () {
  "use strict";
  const ZRH = "Europe/Zurich";
  const NAMES = { asia: "Asia", eu: "Europe", us: "US" };
  const OPEN = { asia: [1, 0], eu: [9, 0], us: [15, 30] };
  /* exchange -> [IANA zone, cash segments in local minutes [open, close), calendar key, place for "shut" labels] */
  const EXCH = {
    nyse: ["America/New_York", [[570, 960]], "NYSE", "New York"],
    xetra: ["Europe/Berlin", [[540, 1050]], "XETRA", "Frankfurt"],
    lse: ["Europe/London", [[480, 990]], "LSE", "London"],
    six: ["Europe/Zurich", [[540, 1050]], "SIX", "Zurich"],
    sto: ["Europe/Stockholm", [[540, 1050]], "STO", "Stockholm"],
    tse: ["Asia/Tokyo", [[540, 690], [750, 930]], "JPX", "Tokyo"],
    sse: ["Asia/Shanghai", [[570, 690], [780, 900]], "SSE", "Shanghai"],
    hkex: ["Asia/Hong_Kong", [[570, 720], [780, 960]], "HKEX", "Hong Kong"],
    krx: ["Asia/Seoul", [[540, 930]], "KRX", "Seoul"],
    twse: ["Asia/Taipei", [[540, 810]], "TWSE", "Taipei"],
    asx: ["Australia/Sydney", [[600, 960]], "ASX", "Sydney"]
  };
  const REGION_EXCH = { asia: ["tse", "sse", "hkex", "krx", "twse", "asx"], eu: ["xetra", "lse", "six", "sto"], us: ["nyse"] };
  const PRIMARY = { us: "nyse", eu: "xetra", asia: "tse" };
  /* Tokyo (JPX) full closures: national holidays and the year-end break (Pulse lib/daily_rules ASIA_HOLIDAYS + 2027 calendar) */
  const JPX = ["2026-11-23", "2026-12-31", "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04",
    "2027-05-05", "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11", "2027-11-03", "2027-11-23", "2027-12-31"];
  /* weekdays with no Western close at all (NYSE and the main European cash markets shut) */
  const NO_WEST = ["2026-04-03", "2026-12-25", "2027-01-01", "2027-03-26", "2027-12-24"];
  let HOL = null;
  function calendars() {
    if (HOL) return HOL;
    const h = {};
    const zones = (window.EMMIClocks && window.EMMIClocks.zones) || [];
    zones.forEach(z => { if (z && z.exchange) h[z.exchange] = Object.assign({}, z.holidays || {}); });
    h.JPX = Object.assign({}, h.JPX || {});
    JPX.forEach(d => { h.JPX[d] = "closed"; });
    ["NYSE", "LSE", "SIX", "STO", "XETRA", "EURONEXT"].forEach(k => { h[k] = h[k] || {}; NO_WEST.forEach(d => { h[k][d] = "closed"; }); });
    const both = Object.keys(h.SIX || {}).filter(d => h.SIX[d] === "closed" && (h.LSE || {})[d] === "closed");
    both.forEach(d => { h.XETRA[d] = "closed"; h.EURONEXT[d] = "closed"; });
    HOL = h;
    return h;
  }
  /* tests: replace the calendars ({NYSE: {"2026-11-26": "closed"}, ...}); null reloads from clocks.js */
  function setHolidays(h) { HOL = h ? Object.assign({}, h) : null; }

  /* ---------- wall clocks without a library ---------- */
  const FMT = {};
  function parts(ms, tz) {
    const f = FMT[tz] || (FMT[tz] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }));
    const o = {};
    f.formatToParts(new Date(ms)).forEach(x => { o[x.type] = x.value; });
    const wd = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[o.weekday];
    return { ymd: o.year + "-" + o.month + "-" + o.day, y: +o.year, mo: +o.month, d: +o.day, min: (+o.hour % 24) * 60 + +o.minute, wd: wd, hm: (o.hour === "24" ? "00" : o.hour) + ":" + o.minute };
  }
  /* instant of a wall time in a zone (two passes handle DST) */
  function wall(ymd, h, mi, tz) {
    const [y, mo, d] = ymd.split("-").map(Number);
    let g = Date.UTC(y, mo - 1, d, h, mi);
    for (let i = 0; i < 2; i++) { const p = parts(g, tz); const seen = Date.UTC(p.y, p.mo - 1, p.d, Math.floor(p.min / 60), p.min % 60); g += Date.UTC(y, mo - 1, d, h, mi) - seen; }
    return g;
  }
  const addDays = (ymd, k) => new Date(Date.parse(ymd + "T12:00:00Z") + k * 864e5).toISOString().slice(0, 10);
  const wdOf = ymd => (new Date(ymd + "T12:00:00Z").getUTCDay() + 6) % 7;
  const tzAbbr = ms => { const m = Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZRH, timeZoneName: "shortOffset" }).formatToParts(new Date(ms)).find(x => x.type === "timeZoneName").value.replace(/[^0-9+-]/g, "") || 1); return m === 2 ? "CEST" : "CET"; };

  function holiday(ex, ymd) { return ((calendars()[EXCH[ex][2]] || {})[ymd]) === "closed"; }
  function tradingDay(ex, ymd) { return wdOf(ymd) < 5 && !holiday(ex, ymd); }
  function regionOpenDay(r, ymd) { return wdOf(ymd) < 5 && REGION_EXCH[r].some(x => tradingDay(x, ymd)); }
  function lastOpen(r, now) {
    let d = parts(now, ZRH).ymd;
    for (let k = 0; k < 15; k++) {
      const t = wall(d, OPEN[r][0], OPEN[r][1], ZRH);
      if (t <= now && regionOpenDay(r, d)) return t;
      d = addDays(d, -1);
    }
    return wall(d, OPEN[r][0], OPEN[r][1], ZRH);
  }
  function order(now) {
    now = now == null ? Date.now() : +now;
    return ["asia", "eu", "us"].sort((a, b) => lastOpen(b, now) - lastOpen(a, now));
  }
  function state(ex, now) {
    const [tz, segs] = EXCH[ex], p = parts(now, tz);
    if (p.wd >= 5) return "weekend";
    if (holiday(ex, p.ymd)) return "holiday";
    if (p.min < segs[0][0]) return "preopen";
    if (segs.some(s => p.min >= s[0] && p.min < s[1])) return "live";
    return p.min >= segs[segs.length - 1][1] ? "close" : "midday";
  }
  /* last finished session date of an exchange, local calendar */
  function lastClose(ex, now) {
    const p = parts(now, EXCH[ex][0]);
    let d = p.ymd;
    if (!(tradingDay(ex, d) && state(ex, now) === "close")) d = addDays(d, -1);
    for (let k = 0; k < 15 && !tradingDay(ex, d); k++) d = addDays(d, -1);
    return d;
  }
  const dayLab = ymd => { const dt = new Date(ymd + "T12:00:00Z"); return dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }) + " " + dt.getUTCDate() + " " + dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }); };
  /* {text, cls: live|midday|close|holiday, title} */
  function pill(r, now) {
    now = now == null ? Date.now() : +now;
    const ex = PRIMARY[r], st = REGION_EXCH[r].map(x => [x, state(x, now)]);
    const z = parts(now, ZRH).hm + " " + tzAbbr(now);
    const live = st.find(s => s[1] === "live"), mid = st.find(s => s[1] === "midday");
    const shut = holiday(ex, parts(now, EXCH[ex][0]).ymd) && parts(now, EXCH[ex][0]).wd < 5 ? EXCH[ex][3] + " shut" : "";
    let text, cls;
    if (live && (state(ex, now) === "live" || shut || r === "asia")) { text = "Live " + z; cls = "live"; }
    else if (mid || state(ex, now) === "midday") { text = "Midday " + z; cls = "midday"; }
    else { text = "Close " + dayLab(lastClose(ex, now)); cls = "close"; }
    const open = st.filter(s => s[1] === "live" || s[1] === "midday").map(s => EXCH[s[0]][3]);
    /* say which market is trading when the region's main exchange is not (e.g. Sydney before Tokyo opens) */
    if (cls === "live" && state(ex, now) !== "live" && !shut && open.length) text += " \u00b7 " + open.join(", ") + " open";
    if (shut) { text += " \u00b7 " + shut; cls = cls === "close" ? "holiday" : cls; }
    return { text: text, cls: cls, title: NAMES[r] + (open.length ? ": open now in " + open.join(", ") : ": cash markets shut") + " (Zurich clock " + z + ")" };
  }
  function windowName(now) { return order(now).map(r => NAMES[r]).join(" \u2192 "); }

  /* ---------- tile lineups (Pulse v1.10: 2 full rows of 4 per region) ---------- */
  const US_SECTOR = ["XLK", "XLF", "XLV", "XLY", "XLC", "XLI", "XLP", "XLE", "XLU", "XLRE", "XLB"];
  const EU_SECTOR = ["EXV1.DE", "EXH4.DE", "EXV4.DE", "EXV3.DE", "EXH5.DE", "EXH3.DE", "EXH7.DE", "EXH1.DE", "EXH9.DE", "EXH2.DE", "EXV2.DE", "EXV8.DE", "EXV7.DE", "EXV6.DE", "EXV5.DE", "EXH6.DE", "EXV9.DE", "EXH8.DE", "EXI5.DE"];
  const ASIA_LARGE = ["2330.TW", "005930.KS", "000660.KS", "9988.HK", "0700.HK", "7203.T"];
  const LINEUP = {
    us: { rows: [["^GSPC", "^NDX", "^DJI", "^RUT"], ["^SOX", "MAGS", "^VIX", "pick:us"]], reserves: ["^IXIC"] },
    eu: { rows: [["^STOXX", "^GDAXI", "^FTSE", "^FCHI"], ["^SSMI", "^OMX", "^STOXX50E", "pick:eu"]], reserves: ["^AEX", "^IBEX"] },
    asia: { rows: [["^N225", "000300.SS", "^HSI", "^KS11"], ["^TWII", "^AXJO", "pick:asia1", "pick:asia2"]], reserves: [] }
  };
  const finite = v => typeof v === "number" && isFinite(v);
  const d1 = r => (r && r.pct && finite(r.pct["1D"]) ? r.pct["1D"] : null);
  function zOf(r) {
    const v = d1(r);
    if (!finite(v)) return null;
    const LP = window.EMMILivePulse, t = LP && LP.typMove ? LP.typMove(r, "1D") : null;
    return Math.abs(v) / (finite(t) && t > 0 ? t : 1);
  }
  /* standout = largest move against its own typical day (|z|) */
  function standout(syms, by) {
    let best = null, bz = -1;
    syms.forEach(s => { const r = by[s], z = zOf(r); if (r && !r.error && finite(z) && z > bz) { bz = z; best = r; } });
    return best;
  }
  function usCashOpen(now) { return state("nyse", now) === "live"; }
  function picks(r, by, now) {
    if (r === "us") return { "pick:us": standout(US_SECTOR, by) };
    if (r === "eu") return { "pick:eu": standout(EU_SECTOR, by) };
    if (!usCashOpen(now) && by["ES=F"] && by["NQ=F"]) return { "pick:asia1": by["ES=F"], "pick:asia2": by["NQ=F"] };
    const mv = ASIA_LARGE.map(s => by[s]).filter(x => x && !x.error && finite(d1(x))).sort((a, b) => Math.abs(d1(b)) - Math.abs(d1(a)));
    return { "pick:asia1": mv[0] || null, "pick:asia2": mv[1] || null };
  }
  const ok = r => !!(r && !r.error && finite(r.px));
  function lineup(r, by, now) {
    now = now == null ? Date.now() : +now;
    const L = LINEUP[r], pk = picks(r, by, now), used = new Set();
    const reserves = L.reserves.slice();
    if (r === "asia") { reserves.push("ES=F", "NQ=F"); ASIA_LARGE.forEach(s => reserves.push(s)); }
    const out = [];
    L.rows.forEach(row => {
      const got = row.map(s => (s.indexOf("pick:") === 0 ? pk[s] : by[s])).map(x => (ok(x) && !used.has(x.sym) ? x : null));
      got.forEach(x => { if (x) used.add(x.sym); });
      for (let i = 0; i < got.length; i++) {
        if (got[i]) continue;
        while (reserves.length) { const x = by[reserves.shift()]; if (ok(x) && !used.has(x.sym)) { got[i] = x; used.add(x.sym); break; } }
      }
      if (got.every(Boolean)) out.push(got.map((x, i) => ({ row: x, pick: row[i].indexOf("pick:") === 0 })));
      else got.forEach(x => { if (x) used.delete(x.sym); });
    });
    return out;
  }
  const MAPS = { us: ["sp500"], eu: ["eu80"], asia: ["nikkei225", "csi300"] };
  window.EMMIRegions = { NAMES: NAMES, EXCH: EXCH, MAPS: MAPS, LINEUP: LINEUP, US_SECTOR: US_SECTOR, EU_SECTOR: EU_SECTOR, ASIA_LARGE: ASIA_LARGE,
    order: order, pill: pill, state: state, lastOpen: lastOpen, lastClose: lastClose, lineup: lineup, usCashOpen: usCashOpen, windowName: windowName, setHolidays: setHolidays, holiday: holiday, wall: wall };
})();
