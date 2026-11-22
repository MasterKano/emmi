/* Futures section in the commodity sheet (window.EMMIFut), between the price chart and the trader report (t1515u).
   Data: MasterKano/emmi-data main, futures/ (scripts/build_futures.py, weekdays after the US close):
     futures/<id>.json            listed contracts (last, 1D, open/high/low, volume, open interest, expiry) and a
                                  3-month closes matrix for the curve compares
     futures/<id>/<CONTRACT>.csv  one contract's daily bars (Yahoo history, then the daily TradingView bar)
   Views: Contract (candles for the chosen month, 1M / 3M daily, 6M / 1Y weekly), Curve (today against 1W / 1M /
   3M ago), Spread (front month minus the 2nd, 3rd or 6th) and All months (table; a row opens that contract).
   Only real values are drawn; a gap stays a gap. A tile with no free futures curve gets a short muted note. */
(function () {
  "use strict";
  const BASE = "/emmi/ed/main/futures/";
  const ID = {
    "BZ=F": "brent", "CL=F": "wti", "HO=F": "ulsd", "RB=F": "rbob", "NG=F": "hh", "TTF=F": "ttf", "CO2.L": "eua",
    "GC=F": "gold", "SI=F": "silver", "PL=F": "platinum", "PA=F": "palladium", "HG=F": "copper", "ALI=F": "aluminium",
    "KC=F": "coffee", "CC=F": "cocoa", "SB=F": "sugar", "CT=F": "cotton", "OJ=F": "oj", "LBR=F": "lumber",
    "ZW=F": "wheat", "ZC=F": "corn", "ZS=F": "soybeans", "ZL=F": "soyoil", "ZM=F": "soymeal", "ZO=F": "oats", "ZR=F": "rice",
    "LE=F": "cattle", "GF=F": "feeders", "HE=F": "hogs"
  };
  const NONE = { "U-UN.TO": "No free futures curve for uranium. This tile is the Sprott Physical Uranium trust." };
  /* the full curve tools (Copy/CSV, date pick) live on these pages */
  const MORE = { brent: ["#energy/oil/ogCurves", "Oil curves"], ulsd: ["#energy/oil/ogCurves", "Oil curves"], ttf: ["#energy/gas/gsSecPx", "TTF curve"] };
  const VIEWS = [["c", "Contract"], ["cv", "Curve"], ["sp", "Spread"], ["t", "All months"]];
  const PERS = ["1M", "3M", "6M", "1Y"];
  const CMP = [["1W", 7, "#7aa2ff"], ["1M", 30, "#b18cf0"], ["3M", 91, "#8b95a8"]];
  const SPR = [[1, "M1–M2"], [2, "M1–M3"], [5, "M1–M6"]];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LS = "emmiFut";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hour = () => Math.floor(Date.now() / 36e5);

  /* ---------- state that survives the sheet re-rendering (candle switch, refresh) ---------- */
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { return {}; } }
  const PREF = Object.assign({ view: "c", per: "3M", cmp: ["1M"], spr: 1, sper: "3M" }, loadPrefs());
  function savePrefs() { try { localStorage.setItem(LS, JSON.stringify({ view: PREF.view, per: PREF.per, cmp: PREF.cmp, spr: PREF.spr, sper: PREF.sper })); } catch (e) { /* private mode */ } }
  const PICK = {};          /* id -> chosen contract code (per session) */
  const DOC = {}, DOCP = {}, CSV = {}, CSVP = {};
  const INFO = {};          /* id -> info panel open */

  function getDoc(id) {
    if (DOC[id] && DOC[id].h === hour()) return Promise.resolve(DOC[id].d);
    if (!DOCP[id]) DOCP[id] = fetch(BASE + id + ".json?t=" + hour(), { cache: "no-cache" })
      .then(r => (r.ok ? r.json() : null)).then(d => { DOC[id] = { d: d, h: hour() }; return d; })
      .catch(() => null).finally(() => { DOCP[id] = null; });
    return DOCP[id];
  }
  function parseCSV(text) {
    const lines = String(text || "").trim().split(/\r?\n/);
    const head = (lines.shift() || "").split(",");
    const ix = k => head.indexOf(k);
    const num = s => (s == null || s === "" ? null : (Number.isFinite(+s) ? +s : null));
    return lines.map(l => {
      const c = l.split(",");
      return { d: c[ix("date")], o: num(c[ix("open")]), h: num(c[ix("high")]), l: num(c[ix("low")]), c: num(c[ix("close")]), v: num(c[ix("volume")]), oi: num(c[ix("oi")]) };
    }).filter(b => b.d && finite(b.c));
  }
  function getCSV(id, code) {
    const k = id + "/" + code;
    if (CSV[k] && CSV[k].h === hour()) return Promise.resolve(CSV[k].d);
    if (!CSVP[k]) CSVP[k] = fetch(BASE + id + "/" + encodeURIComponent(code) + ".csv?t=" + hour(), { cache: "no-cache" })
      .then(r => (r.ok ? r.text() : "")).then(t => { const d = parseCSV(t); CSV[k] = { d: d, h: hour() }; return d; })
      .catch(() => []).finally(() => { CSVP[k] = null; });
    return CSVP[k];
  }

  /* ---------- formatting ---------- */
  function fmt(v, d) {
    if (!finite(v)) return "–";
    const n = Math.abs(v) < 1e-12 ? 0 : v;
    return n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
  }
  const sgn = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d) : "–");
  const cls = v => (finite(v) && v > 0 ? "up" : finite(v) && v < 0 ? "dn" : "");
  function kfmt(v) {
    if (!finite(v)) return "–";
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "m";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    return String(Math.round(v));
  }
  function day(iso, yr) {
    const p = String(iso || "").split("-");
    if (p.length < 3) return "";
    return +p[2] + " " + MON[+p[1] - 1] + (yr ? " " + p[0].slice(2) : "");
  }
  function addDays(iso, n) {
    const p = String(iso).split("-").map(Number);
    const t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return t.toISOString().slice(0, 10);
  }
  const pill = (v, d) => '<span class="pill ' + cls(v) + '">' + sgn(v, d) + "</span>";

  /* ---------- markup ---------- */
  function seg(attr, list, on, label) {
    return '<span class="cdl-scale fut-seg" role="group" aria-label="' + esc(label) + '">' +
      list.map(x => '<button type="button" ' + attr + '="' + esc(x[0]) + '" aria-pressed="' + (on(x[0])) + '">' + esc(x[1]) + "</button>").join("") + "</span>";
  }
  /* the most active month (largest open interest) is where a sheet opens and where spreads start: for gold that
     is the December contract, not an expiring November */
  function active(doc) {
    const cs = doc.contracts || [];
    let best = 0;
    cs.forEach((c, i) => { if (finite(c.oi) && (!finite(cs[best].oi) || c.oi > cs[best].oi)) best = i; });
    return best;
  }
  function chosen(doc) {
    const cs = doc.contracts || [];
    return cs.find(c => c.c === PICK[doc.id]) || cs[active(doc)];
  }
  function chipsHTML(doc) {
    const sel = chosen(doc);
    return '<div class="fut-strip"><button type="button" class="fut-nav" data-fut-step="-1" aria-label="Earlier contract">‹</button>' +
      '<div class="fut-chips" role="tablist" aria-label="Contracts">' +
      (doc.contracts || []).map(c => '<button type="button" role="tab" class="fut-chip" data-fut-c="' + esc(c.c) + '" aria-selected="' + (c === sel) + '" tabindex="' + (c === sel ? 0 : -1) + '" title="' + esc(c.c + (c.exp ? ", last trade " + day(c.exp, true) : "")) + '">' +
        "<b>" + esc(c.label) + '</b><span class="fut-cp">' + fmt(c.last, doc.dec) + '</span><span class="fut-cc ' + cls(c.chg) + '">' + sgn(c.chg, doc.dec) + "</span></button>").join("") +
      '</div><button type="button" class="fut-nav" data-fut-step="1" aria-label="Later contract">›</button></div>';
  }
  function contractHTML(doc) {
    const c = chosen(doc);
    if (!c) return "";
    const stats = [["Open", fmt(c.open, doc.dec)], ["High", fmt(c.high, doc.dec)], ["Low", fmt(c.low, doc.dec)], ["Volume", kfmt(c.vol)], ["Open int.", kfmt(c.oi)], ["Last trade", day(c.exp, true) || "–"]];
    return chipsHTML(doc) +
      '<div class="fut-card"><div class="fut-ch"><div><span class="fut-cn">' + esc(c.label) + ' <small>' + esc(c.c) + '</small></span><span class="fut-px">' + fmt(c.last, doc.dec) + ' <small>' + esc(doc.unit) + "</small> " + pill(c.chg, doc.dec) + "</span></div>" +
      seg("data-fut-per", PERS.map(p => [p, p]), p => p === PREF.per, "Contract history period") + "</div>" +
      '<dl class="fut-st">' + stats.map(s => "<div><dt>" + s[0] + "</dt><dd>" + esc(s[1]) + "</dd></div>").join("") + "</dl>" +
      '<div class="fut-chart" data-fut-chart="c"><p class="fut-wait">Loading ' + esc(c.label) + " history…</p></div>" +
      '<p class="fut-note" data-fut-cnote></p></div>';
  }
  function curveHTML(doc) {
    return '<div class="fut-card"><div class="fut-ch"><div><span class="fut-cn">Curve <small>' + esc((doc.contracts || []).length + " months") + "</small></span>" + curveShape(doc) + "</div>" +
      seg("data-fut-cmp", CMP.map(x => [x[0], "vs " + x[0]]), k => PREF.cmp.indexOf(k) >= 0, "Compare with") + "</div>" +
      '<div class="fut-chart" data-fut-chart="cv"></div><p class="fut-leg" data-fut-leg></p></div>';
  }
  function curveShape(doc) {
    const cs = (doc.contracts || []).filter(c => finite(c.last));
    if (cs.length < 2) return "";
    const a = cs[0], b = cs[Math.min(cs.length - 1, 11)];
    const d = b.last - a.last, pct = a.last ? d / a.last * 100 : null;
    const word = Math.abs(pct) < 0.5 ? "flat" : d > 0 ? "contango" : "backwardation";
    return '<span class="fut-sh">' + esc(a.label) + " to " + esc(b.label) + ": <b>" + sgn(d, doc.dec) + "</b> " + esc(word) + "</span>";
  }
  function spreadHTML(doc) {
    const n = (doc.contracts || []).length - active(doc);
    const opts = SPR.filter(x => x[0] < n);
    return '<div class="fut-card"><div class="fut-ch"><div><span class="fut-cn" data-fut-sname>Spread</span><span class="fut-px" data-fut-snow></span></div>' +
      '<span class="fut-segs">' + seg("data-fut-spr", opts.map(x => [String(x[0]), x[1]]), k => +k === PREF.spr, "Spread") +
      seg("data-fut-sper", [["3M", "3M"], ["1Y", "1Y"]], k => k === PREF.sper, "Spread period") + "</span></div>" +
      '<div class="fut-chart" data-fut-chart="sp"><p class="fut-wait">Loading…</p></div><p class="fut-note" data-fut-snote></p></div>';
  }
  function tableHTML(doc) {
    const sel = chosen(doc);
    return '<div class="fut-tw"><table class="fut-t"><thead><tr><th>Month</th><th>Last</th><th>1D</th><th>Vol</th><th>OI</th></tr></thead><tbody>' +
      (doc.contracts || []).map(c => '<tr data-fut-row="' + esc(c.c) + '"' + (c === sel ? ' class="on"' : "") + ' tabindex="0" title="' + esc(c.c + (c.exp ? ", last trade " + day(c.exp, true) : "")) + '"><td>' + esc(c.label) + "</td><td>" + fmt(c.last, doc.dec) +
        '</td><td class="' + cls(c.chg) + '">' + sgn(c.chg, doc.dec) + "</td><td>" + kfmt(c.vol) + "</td><td>" + kfmt(c.oi) + "</td></tr>").join("") +
      '</tbody></table></div><p class="fut-note">Tap a month for its chart. Vol and OI: the session’s volume and the latest open interest.</p>';
  }
  function infoText(doc) {
    const src = doc.source || {};
    return "Listed contracts, nearest first, with the exchange’s own month codes. Prices: " + (src.chain || "TradingView") + ". Per-contract history: " + (src.history || "–") +
      ". Contract candles: one per trading day for 1M and 3M, one per week for 6M and 1Y; a grey tick is a close with no open in the source. Curve: each date’s closes for today’s listed months (a month that has since expired is not on an older curve). Spread: M1 is the most active month (largest open interest), minus the 2nd, 3rd or 6th listed month after it on the same day; positive means the nearer month is dearer (backwardation). A sheet opens on the most active month. Blanks are “not available”, never zero. Built " +
      (doc.built_utc ? String(doc.built_utc).replace("T", " ").slice(0, 16) + " UTC" : "–") + ".";
  }
  function bodyHTML(doc) {
    const v = PREF.view;
    return v === "cv" ? curveHTML(doc) : v === "sp" ? spreadHTML(doc) : v === "t" ? tableHTML(doc) : contractHTML(doc);
  }
  function sectionHTML(doc) {
    const more = MORE[doc.id];
    const open = !!INFO[doc.id];
    return '<h4 class="fut-h"><span>Futures <small class="fut-fr">' + esc(doc.exchange) + " · " + esc(day(doc.asof)) + ' close</small></span><button type="button" class="fut-i" data-fut-info aria-expanded="' + open + '" aria-label="About this futures data">i</button></h4>' +
      '<p class="fut-ip"' + (open ? "" : " hidden") + ">" + esc(infoText(doc)) + (more ? ' <a href="' + esc(more[0]) + '" data-fut-more>' + esc(more[1]) + " with Copy/CSV and date pick →</a>" : "") + "</p>" +
      '<div class="fut-views">' + seg("data-fut-view", VIEWS, k => k === PREF.view, "Futures view") + "</div>" +
      '<div class="fut-body">' + bodyHTML(doc) + "</div>";
  }

  /* ---------- charts ---------- */
  function weekly(bars) {
    const out = [];
    let cur = null, key = null;
    bars.forEach(b => {
      const p = b.d.split("-").map(Number), t = Date.UTC(p[0], p[1] - 1, p[2]);
      const wd = (new Date(t).getUTCDay() + 6) % 7, k = new Date(t - wd * 864e5).toISOString().slice(0, 10);
      if (k !== key) { if (cur) out.push(cur); key = k; cur = { d: b.d, wk: k, o: b.o, h: b.h, l: b.l, c: b.c, last: b.d }; return; }
      if (!finite(cur.o)) cur.o = b.o;
      if (finite(b.h)) cur.h = finite(cur.h) ? Math.max(cur.h, b.h) : b.h;
      if (finite(b.l)) cur.l = finite(cur.l) ? Math.min(cur.l, b.l) : b.l;
      cur.c = b.c; cur.last = b.d;
    });
    if (cur) out.push(cur);
    return out;
  }
  function drawContract(host, doc) {
    const box = host.querySelector('[data-fut-chart="c"]');
    const c = chosen(doc);
    if (!box || !c) return;
    const EC = window.EMMICharts;
    getCSV(doc.id, c.c).then(all => {
      if (!box.isConnected || chosen(doc) !== c) return;
      const note = host.querySelector("[data-fut-cnote]");
      if (!all.length || !EC) { box.innerHTML = '<p class="fut-na">No history for ' + esc(c.label) + " yet.</p>"; return; }
      const last = all[all.length - 1].d;
      const from = addDays(last, { "1M": -31, "3M": -92, "6M": -183, "1Y": -366 }[PREF.per] || -92);
      let bars = all.filter(b => b.d > from);
      const wk = PREF.per === "6M" || PREF.per === "1Y";
      if (wk) bars = weekly(bars);
      if (bars.length < 2) {
        box.innerHTML = '<p class="fut-na">' + esc(c.label) + " history starts " + esc(day(all[0].d, true)) + "; the chart fills in as EMMi archives each session.</p>";
        if (note) note.textContent = "";
        return;
      }
      const step = Math.max(1, Math.ceil(bars.length / 6));
      box.innerHTML = "";
      EC.candles(box, {
        bars: bars.map(b => [b.o, b.h, b.l, b.c]),
        labels: bars.map(b => (wk ? "Week of " + day(b.wk, true) : day(b.d, true))),
        ticks: bars.map((b, i) => (i % step === 0 ? day(wk ? b.wk : b.d) : null)),
        d: doc.dec, h: 176,
        aria: c.label + " " + doc.title + " futures, " + (wk ? "weekly" : "daily") + " candles"
      });
      if (note) {
        const first = all[0].d, f = bars[0].c, l = bars[bars.length - 1].c, ch = f ? (l / f - 1) * 100 : null;
        note.innerHTML = esc(PREF.per) + ": <b class=\"" + cls(ch) + '">' + (finite(ch) ? (ch > 0 ? "+" : ch < 0 ? "−" : "") + Math.abs(ch).toFixed(1) + "%" : "–") + "</b> · " + (wk ? "weekly" : "daily") + " candles" +
          (first > from ? " · history from " + esc(day(first, true)) : "");
      }
    });
  }
  function valAt(doc, code, target) {
    const ds = doc.dates || [], v = (doc.closes || {})[code] || [];
    for (let i = ds.length - 1; i >= 0; i--) if (ds[i] <= target && finite(v[i])) return { v: v[i], d: ds[i] };
    return null;
  }
  function drawCurve(host, doc) {
    const box = host.querySelector('[data-fut-chart="cv"]'), EC = window.EMMICharts;
    if (!box || !EC) return;
    const cs = doc.contracts || [], ds = doc.dates || [];
    const lastD = ds[ds.length - 1] || doc.asof;
    const series = [{ name: "Today", color: "var(--accent)", width: 2.2, vals: cs.map(c => (finite(c.last) ? c.last : null)), end: true }];
    const leg = ['<span><i style="background:var(--accent)"></i>' + esc(day(doc.asof)) + "</span>"];
    const missing = [];
    CMP.forEach(x => {
      if (PREF.cmp.indexOf(x[0]) < 0) return;
      const target = addDays(lastD, -x[1]);
      if (!ds.length || ds[0] > target) { missing.push(x[0]); return; }
      let on = null;
      const vals = cs.map(c => { const p = valAt(doc, c.c, target); if (p && (!on || p.d > on)) on = p.d; return p ? p.v : null; });
      if (!vals.some(finite)) { missing.push(x[0]); return; }
      series.push({ name: x[0] + " ago", color: x[2], width: 1.6, dash: x[0] === "3M" ? "4 3" : "", vals: vals });
      leg.push('<span><i style="background:' + x[2] + '"></i>' + esc(x[0]) + " ago · " + esc(day(on || target)) + "</span>");
    });
    const labs = cs.map(c => c.label);
    const step = labs.length > 12 ? 3 : labs.length > 7 ? 2 : 1;
    box.innerHTML = "";
    EC.lines(box, {
      h: 190, d: doc.dec, series: series, labels: labs.map((l, i) => l + " · " + cs[i].c),
      ticks: labs.map((l, i) => (i % step === 0 || i === labs.length - 1 ? l : null)), unit: doc.unit, aria: doc.title + " futures curve"
    });
    const lg = host.querySelector("[data-fut-leg]");
    if (lg) lg.innerHTML = leg.join("") + (missing.length ? '<em>' + esc(missing.join(", ")) + " not archived yet</em>" : "");
  }
  function drawSpread(host, doc) {
    const box = host.querySelector('[data-fut-chart="sp"]'), EC = window.EMMICharts;
    const cs = doc.contracts || [];
    const ai = active(doc), k = Math.min(PREF.spr, cs.length - 1 - ai);
    if (!box || !EC || k < 1) { if (box) box.innerHTML = '<p class="fut-na">Not enough listed months for a spread.</p>'; return; }
    const a = cs[ai], b = cs[ai + k];
    const nm = host.querySelector("[data-fut-sname]");
    if (nm) nm.innerHTML = esc(a.label) + " − " + esc(b.label) + " <small>" + esc(doc.unit) + "</small>";
    Promise.all([getCSV(doc.id, a.c), getCSV(doc.id, b.c)]).then(([A, B]) => {
      if (!box.isConnected) return;
      const bm = {};
      B.forEach(x => { bm[x.d] = x.c; });
      let pts = A.filter(x => finite(bm[x.d])).map(x => ({ d: x.d, v: x.c - bm[x.d] }));
      if (pts.length) {
        const from = addDays(pts[pts.length - 1].d, PREF.sper === "1Y" ? -366 : -92);
        pts = pts.filter(p => p.d > from);
      }
      const now = host.querySelector("[data-fut-snow]"), note = host.querySelector("[data-fut-snote]");
      if (pts.length < 2) {
        box.innerHTML = '<p class="fut-na">Not enough shared sessions yet for ' + esc(a.label) + " − " + esc(b.label) + ". It fills in as EMMi archives each day.</p>";
        if (now) now.innerHTML = ""; if (note) note.textContent = "";
        return;
      }
      const L = pts[pts.length - 1].v;
      const ago = n => { const t = addDays(pts[pts.length - 1].d, -n); for (let i = pts.length - 1; i >= 0; i--) if (pts[i].d <= t) return pts[i].v; return null; };
      if (now) now.innerHTML = '<b class="' + cls(L) + '">' + sgn(L, doc.dec) + "</b> " + '<span class="k">1W</span>' + pill(finite(ago(7)) ? L - ago(7) : null, doc.dec) + ' <span class="k">1M</span>' + pill(finite(ago(30)) ? L - ago(30) : null, doc.dec);
      const step = Math.max(1, Math.ceil(pts.length / 6));
      box.innerHTML = "";
      EC.lines(box, {
        h: 170, d: doc.dec, zero: true, unit: doc.unit,
        series: [{ name: a.label + " − " + b.label, color: "var(--accent)", width: 1.8, vals: pts.map(p => p.v), end: true }],
        baseline: 0, labels: pts.map(p => day(p.d, true)), ticks: pts.map((p, i) => (i % step === 0 ? day(p.d) : null)),
        aria: doc.title + " calendar spread"
      });
      if (note) note.textContent = "Above zero: " + a.label + " is dearer than " + b.label + " (backwardation). Below zero: contango." + (pts[0].d > addDays(pts[pts.length - 1].d, PREF.sper === "1Y" ? -300 : -80) ? " Shared history from " + day(pts[0].d, true) + "." : "");
    });
  }
  function paintBody(host, doc) {
    const body = host.querySelector(".fut-body");
    if (!body) return;
    body.innerHTML = bodyHTML(doc);
    if (PREF.view === "c") { drawContract(host, doc); centerChip(host, false); }
    else if (PREF.view === "cv") drawCurve(host, doc);
    else if (PREF.view === "sp") drawSpread(host, doc);
  }
  function centerChip(host, smooth) {
    const row = host.querySelector(".fut-chips"), on = row && row.querySelector('[aria-selected="true"]');
    if (!row || !on) return;
    const left = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
    if (typeof row.scrollTo === "function") row.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    else row.scrollLeft = Math.max(0, left);
  }
  function select(host, doc, code, focus) {
    if (!(doc.contracts || []).some(c => c.c === code)) return;
    PICK[doc.id] = code;
    if (PREF.view !== "c") { PREF.view = "c"; savePrefs(); host.querySelectorAll("[data-fut-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.futView === "c"))); }
    paintBody(host, doc);
    centerChip(host, true);
    if (focus) { const b = host.querySelector('.fut-chip[aria-selected="true"]'); if (b) b.focus({ preventScroll: true }); }
  }
  function wire(host, doc) {
    host.addEventListener("click", e => {
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      const q = s => t.closest(s);
      let b;
      if ((b = q("[data-fut-info]"))) { INFO[doc.id] = !INFO[doc.id]; b.setAttribute("aria-expanded", String(INFO[doc.id])); const p = host.querySelector(".fut-ip"); if (p) p.hidden = !INFO[doc.id]; return; }
      if ((b = q("[data-fut-more]"))) { if (window.EMMIKit && EMMIKit.closeSheet) EMMIKit.closeSheet(); return; }
      if ((b = q("[data-fut-view]"))) { PREF.view = b.dataset.futView; savePrefs(); host.querySelectorAll("[data-fut-view]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); paintBody(host, doc); return; }
      if ((b = q("[data-fut-c]"))) { select(host, doc, b.dataset.futC); return; }
      if ((b = q("[data-fut-row]"))) { select(host, doc, b.dataset.futRow); return; }
      if ((b = q("[data-fut-step]"))) {
        const cs = doc.contracts || [], i = cs.indexOf(chosen(doc)), j = Math.max(0, Math.min(cs.length - 1, i + (+b.dataset.futStep)));
        if (j !== i) select(host, doc, cs[j].c);
        return;
      }
      if ((b = q("[data-fut-per]"))) { PREF.per = b.dataset.futPer; savePrefs(); host.querySelectorAll("[data-fut-per]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawContract(host, doc); return; }
      if ((b = q("[data-fut-cmp]"))) {
        const k = b.dataset.futCmp, i = PREF.cmp.indexOf(k);
        if (i >= 0) PREF.cmp.splice(i, 1); else PREF.cmp.push(k);
        savePrefs(); b.setAttribute("aria-pressed", String(i < 0)); drawCurve(host, doc); return;
      }
      if ((b = q("[data-fut-spr]"))) { PREF.spr = +b.dataset.futSpr; savePrefs(); paintBody(host, doc); return; }
      if ((b = q("[data-fut-sper]"))) { PREF.sper = b.dataset.futSper; savePrefs(); paintBody(host, doc); return; }
    });
    host.addEventListener("keydown", e => {
      const chip = e.target && e.target.closest && e.target.closest(".fut-chip");
      const row = e.target && e.target.closest && e.target.closest("[data-fut-row]");
      if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(host, doc, row.dataset.futRow); return; }
      if (!chip) return;
      const cs = doc.contracts || [], i = cs.indexOf(chosen(doc));
      let j = i;
      if (e.key === "ArrowRight") j = i + 1; else if (e.key === "ArrowLeft") j = i - 1; else if (e.key === "Home") j = 0; else if (e.key === "End") j = cs.length - 1; else return;
      e.preventDefault();
      j = Math.max(0, Math.min(cs.length - 1, j));
      if (j !== i) select(host, doc, cs[j].c, true);
    });
  }

  /* ---------- mount into the sheet: called by kit.js right after the price chart is drawn ---------- */
  function has(sym) { return !!(ID[sym] || NONE[sym]); }
  function mount(sheet, r) {
    if (!sheet || !r || !has(r.sym)) return null;
    let host = sheet.querySelector(".lps-fut-host");
    if (!host) {
      host = document.createElement("section");
      host.className = "lps-fut-host fut";
      host.setAttribute("aria-label", "Futures");
      const chart = sheet.querySelector(".lps-c");
      if (chart) chart.after(host); else return null;
    }
    if (NONE[r.sym]) { host.innerHTML = '<h4 class="fut-h"><span>Futures</span></h4><p class="fut-na">' + esc(NONE[r.sym]) + "</p>"; return host; }
    const id = ID[r.sym];
    const paint = doc => {
      if (!host.isConnected) return;
      if (!doc || !(doc.contracts || []).length) { host.innerHTML = '<h4 class="fut-h"><span>Futures</span></h4><p class="fut-na">The futures file for this market is not available yet.</p>'; return; }
      host.innerHTML = sectionHTML(doc);
      if (!host._futWired) { host._futWired = true; wire(host, doc); }
      paintBody(host, doc);
    };
    if (DOC[id] && DOC[id].d) paint(DOC[id].d);
    else { host.innerHTML = '<h4 class="fut-h"><span>Futures</span></h4><p class="fut-wait">Loading the futures curve…</p>'; getDoc(id).then(paint); }
    return host;
  }
  window.EMMIFut = { mount: mount, has: has, ID: ID, weekly: weekly, parseCSV: parseCSV };
})();
