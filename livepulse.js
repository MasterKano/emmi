/* Live Pulse (#briefs/live). The Pulse story, refreshing through the day, story first:
   1 Tone of the day (data/live_comment.json: words from the last sent Pulse, dated, not live)
   2 Risk on/off gauge (computed here from market.json; inputs that are missing are left out and listed)
   3 Where the money is going (1D / 1W / 1M ranked moves: regions, sectors, commodities, FX)
   4 Markets in the Pulse tile layout, candles with the Daily · 1M / Monthly · 1Y switch
   5 Energy (nordic-v2 files + gas.json) and coverage-list movers.
   Only instruments that exist in the live feeds are shown. null is "Not available yet", never zero or a guess.
   The email is not touched by this page. window.EMMILivePulse. */
(function () {
  "use strict";
  const NV2 = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/nordic-v2/";
  const EVERY = 5 * 60 * 1000;           /* market.json is rebuilt every ~15 min; check every 5 */
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = v => Math.max(-1, Math.min(1, v));
  const NA = '<span class="na">Not available yet</span>';

  /* ---------- time ---------- */
  function zurich(iso, withDay) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const o = { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hour12: false };
    if (withDay) { o.weekday = "short"; o.day = "numeric"; o.month = "short"; }
    return new Intl.DateTimeFormat("en-GB", o).format(d).replace(",", "") + " Zurich";
  }
  function dayText(ymd) {
    if (!ymd) return null;
    const d = new Date(String(ymd).slice(0, 10) + "T12:00:00Z");
    if (isNaN(d)) return String(ymd);
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d).replace(",", "");
  }
  const stamp = t => '<p class="asof">' + (t ? esc(t) : "Time not available yet") + "</p>";

  /* ---------- market rows ---------- */
  function index(market) {
    const by = {};
    ((market && market.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(r => {
      if (r && r.sym && !by[r.sym]) by[r.sym] = Object.assign({ _group: g.id, _section: s.label || null }, r);
    })));
    return by;
  }
  function chg(r, p) {
    if (!r) return null;
    if (r.kind === "yield" && r.bp) return finite(r.bp[p]) ? r.bp[p] : null;
    return r.pct && finite(r.pct[p]) ? r.pct[p] : null;
  }
  const unitOf = r => (r && r.kind === "yield" && r.bp ? "bp" : "%");
  function fmtChg(v, u) {
    if (!finite(v)) return null;
    const n = Math.abs(v), sg = v > 0 ? "+" : v < 0 ? "−" : "";
    return sg + (u === "bp" ? n.toFixed(n >= 10 ? 0 : 1) + " bp" : n.toFixed(1) + "%");
  }
  function pill(v, u) {
    const t = fmtChg(v, u);
    return t ? '<span class="pill ' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + t + "</span>" : "";
  }
  function px(v, kind) {
    if (!finite(v)) return null;
    const a = Math.abs(v);
    const d = kind === "fx" && a < 20 ? 4 : kind === "yield" ? 2 : a >= 1000 ? 0 : a >= 100 ? 1 : 2;
    return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }) + (kind === "yield" ? "%" : "");
  }

  /* ---------- 2 risk gauge (pure, tested in scripts/test_live_pulse.cjs) ---------- */
  const BREADTH = ["^GSPC", "^IXIC", "^DJI", "^STOXX", "^STOXX50E", "^GDAXI", "^FTSE", "^SSMI", "OSEBX.OL", "^OMX", "^OMXC25", "^OMXH25", "^N225", "^HSI"];
  const RISK_METHOD = [
    ["vix", "VIX level", "(20 − VIX) ÷ 8: 12 or lower scores +1 (calm), 28 or higher −1 (stress)"],
    ["breadth", "Index breadth", "share of " + BREADTH.length + " equity indices up on the day, (share − 50%) × 2"],
    ["spx200", "S&P 500 vs 200-day", "distance from the 200-day average ÷ 5%"],
    ["stoxx200", "STOXX 600 vs 200-day", "distance from the 200-day average ÷ 5%"],
    ["us10y", "US 10Y yield, 1D", "−(bp change) ÷ 10: a sharp rise in yields counts as risk-off"],
    ["dxy", "US dollar (DXY), 1D", "−(% change) ÷ 0.5: a firmer dollar counts as risk-off"],
    ["gold", "Gold, 1D", "−(% change) ÷ 1.5: a gold bid counts as risk-off"],
    ["cugold", "Copper / gold, 1D", "change in the copper-to-gold ratio ÷ 1.5%: copper outrunning gold counts as risk-on"]
  ];
  /* Inputs the gauge would use but no live feed carries. Listed under the gauge, never filled in. */
  const NOT_IN_FEED = ["Credit spreads (HYG / LQD or HY OAS are not in market.json)", "US 2Y yield (not in market.json; the feed has 13-week, 5Y, 10Y and 30Y)"];
  function riskGauge(by) {
    const out = [], missing = [];
    const put = (id, value, shown, score) => {
      const m = RISK_METHOD.find(x => x[0] === id);
      if (!finite(score)) { missing.push(m[1]); return; }
      out.push({ id: id, label: m[1], rule: m[2], value: value, shown: shown, score: clamp(score) });
    };
    const vix = by["^VIX"];
    put("vix", vix && vix.px, vix && finite(vix.px) ? vix.px.toFixed(1) : null, vix && finite(vix.px) ? (20 - vix.px) / 8 : null);
    const ups = BREADTH.map(s => chg(by[s], "1D")).filter(finite);
    const share = ups.length >= 5 ? ups.filter(v => v > 0).length / ups.length : null;
    put("breadth", share, finite(share) ? ups.filter(v => v > 0).length + " of " + ups.length + " up" : null, finite(share) ? (share - 0.5) * 2 : null);
    [["spx200", "^GSPC"], ["stoxx200", "^STOXX"]].forEach(([id, sym]) => {
      const r = by[sym], d = r && r.ma && r.ma["200"] && r.ma["200"].pct;
      put(id, d, fmtChg(d, "%"), finite(d) ? d / 5 : null);
    });
    const tnx = chg(by["^TNX"], "1D");
    put("us10y", tnx, fmtChg(tnx, "bp"), finite(tnx) ? -tnx / 10 : null);
    const dxy = chg(by["DX-Y.NYB"], "1D");
    put("dxy", dxy, fmtChg(dxy, "%"), finite(dxy) ? -dxy / 0.5 : null);
    const au = chg(by["GC=F"], "1D"), cu = chg(by["HG=F"], "1D");
    put("gold", au, fmtChg(au, "%"), finite(au) ? -au / 1.5 : null);
    const ratio = finite(au) && finite(cu) ? ((1 + cu / 100) / (1 + au / 100) - 1) * 100 : null;
    put("cugold", ratio, fmtChg(ratio, "%"), finite(ratio) ? ratio / 1.5 : null);
    if (out.length < 4) return { score: null, label: null, parts: out, missing: missing.concat(NOT_IN_FEED) };
    const n = out.length;
    out.forEach(p => { p.contrib = (p.score / n) * 100; });
    const score = Math.round(out.reduce((a, p) => a + p.contrib, 0));
    const label = score >= 25 ? "Risk on" : score <= -25 ? "Risk off" : "Mixed";
    return { score: score, label: label, parts: out, missing: missing.concat(NOT_IN_FEED) };
  }
  function dial(score) {
    const W = 220, H = 124, cx = 110, cy = 112, R = 92;
    const pt = (v, r) => { const a = Math.PI * (1 - (v + 100) / 200); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    const arc = (a, b, cls) => { const p = pt(a, R), q = pt(b, R); return '<path class="' + cls + '" d="M' + p[0].toFixed(1) + " " + p[1].toFixed(1) + " A" + R + " " + R + " 0 0 1 " + q[0].toFixed(1) + " " + q[1].toFixed(1) + '"/>'; };
    let s = '<svg class="lp-dial" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Risk gauge ' + (finite(score) ? score : "not available") + ' on a scale from −100 (risk off) to +100 (risk on)">';
    s += arc(-100, -25, "seg off") + arc(-25, 25, "seg mid") + arc(25, 100, "seg on");
    if (finite(score)) {
      const t = pt(score, R - 16);
      s += '<line class="needle" x1="' + cx + '" y1="' + cy + '" x2="' + t[0].toFixed(1) + '" y2="' + t[1].toFixed(1) + '"/><circle class="hub" cx="' + cx + '" cy="' + cy + '" r="4"/>';
    }
    s += '<text x="12" y="' + (H - 2) + '" class="dl">Off</text><text x="' + (W - 12) + '" y="' + (H - 2) + '" text-anchor="end" class="dl">On</text></svg>';
    return s;
  }

  /* ---------- 3 where the money is going ---------- */
  const FLOW = {
    regions: { title: "Regions", syms: BREADTH },
    commodities: { title: "Commodities", syms: ["BZ=F", "CL=F", "HO=F", "NG=F", "TTF=F", "CO2.L", "GC=F", "SI=F", "HG=F", "PL=F", "U-UN.TO"] },
    fx: { title: "FX", syms: ["DX-Y.NYB", "EURUSD=X", "JPY=X", "CHF=X", "EURCHF=X", "GBPCHF=X", "EURNOK=X", "EURSEK=X"] }
  };
  const SHORT = { "Brent crude Jan-27": "Brent", "WTI crude Dec-26": "WTI", "NY Harbor diesel (ULSD) Dec-26": "Diesel (ULSD)", "Henry Hub gas Dec-26": "Henry Hub", "Dutch TTF gas Dec-26": "TTF gas", "Gold Dec-26": "Gold", "Silver Dec-26": "Silver", "Copper (COMEX) Dec-26": "Copper", "Platinum Jan-27": "Platinum", "Sprott Physical Uranium": "Uranium (SPUT)", "EU carbon (EUA ETC)": "EU carbon", "STOXX Europe 600": "STOXX 600", "Oslo Børs Benchmark": "Oslo OSEBX", "OMX Stockholm 30": "OMX S30", "OMX Copenhagen 25": "OMX C25", "OMX Helsinki 25": "OMX H25", "Nasdaq Composite": "Nasdaq", "US Dollar Index": "Dollar index" };
  const short = r => SHORT[r.name] || r.name;
  /* Sectors: equal-weight baskets of the names each live group carries, plus the sector ETFs in the feed. */
  function sectorRows(market, by, p) {
    const out = [];
    const basket = (label, rows) => {
      const v = rows.map(r => chg(r, p)).filter(finite);
      if (v.length >= 3) out.push({ name: label + " (" + v.length + ")", v: v.reduce((a, b) => a + b, 0) / v.length, u: "%", basket: true });
    };
    ((market && market.groups) || []).forEach(g => {
      if (!["nordic", "energy", "lundin", "metals"].includes(g.id)) return;
      (g.sections || []).forEach(s => {
        const eq = (s.rows || []).filter(r => r.kind === "equity");
        const label = s.label ? s.label : g.id === "energy" ? "Oil & gas majors" : g.label;
        basket(label, eq);
      });
    });
    ["XLE", "XOP", "GDX", "COPX", "TLT"].forEach(sym => { const r = by[sym]; if (r && finite(chg(r, p))) out.push({ name: r.sym + " ETF", v: chg(r, p), u: "%" }); });
    return out;
  }
  function flowPanel(title, rows, note) {
    const ok = rows.filter(r => finite(r.v)).sort((a, b) => b.v - a.v);
    const mx = Math.max.apply(null, ok.map(r => Math.abs(r.v)).concat([0.0001]));
    const body = ok.length ? ok.map(r => {
      const w = (Math.abs(r.v) / mx * 50).toFixed(1);
      const side = r.v >= 0 ? "left:50%" : "right:50%";
      return '<li><span class="fn">' + esc(r.name) + '</span><span class="fb"><i class="' + (r.v >= 0 ? "up" : "dn") + '" style="' + side + ";width:" + w + '%"></i></span><span class="fv ' + (r.v > 0 ? "up" : r.v < 0 ? "dn" : "") + '">' + esc(fmtChg(r.v, r.u)) + "</span></li>";
    }).join("") : "<li>" + NA + "</li>";
    return '<div class="lp-flow-p"><h3>' + esc(title) + "</h3><ol>" + body + "</ol>" + (note ? '<p class="fnote">' + esc(note) + "</p>" : "") + "</div>";
  }

  /* ---------- 4 markets tiles (Pulse grid) ---------- */
  const MONITOR = [
    ["Equities", ["^GSPC", "^IXIC", "^STOXX", "^GDAXI", "^HSI", "^N225", "^FTSE", "^SSMI", "^DJI", "^STOXX50E", "OSEBX.OL", "^OMX", "^OMXC25", "^OMXH25", "^VIX"]],
    ["Energy", ["BZ=F", "CL=F", "TTF=F", "NG=F", "HO=F", "CO2.L", "U-UN.TO"]],
    ["Rates", ["^IRX", "^FVX", "^TNX", "^TYX", "CNBC:DE10Y-DE", "CNBC:GB10Y-GB", "CNBC:FR10Y-FR", "CNBC:CH10Y-CH"], "change in bp"],
    ["Currencies", ["EURUSD=X", "EURCHF=X", "GBPCHF=X", "JPY=X", "DX-Y.NYB", "CHF=X", "EURNOK=X", "EURSEK=X"]],
    ["Metals", ["GC=F", "HG=F", "SI=F", "PL=F"]]
  ];
  function quoteURL(r) {
    const sym = String(r.sym || "");
    if (sym && !sym.startsWith("CNBC:")) return "https://finance.yahoo.com/quote/" + encodeURIComponent(sym);
    if (r.tv) return "https://www.tradingview.com/symbols/" + encodeURIComponent(String(r.tv).replace(":", "-"));
    return "";
  }
  /* 52-week range from the 1Y closes the row carries (r.spark) and the live price */
  function range52(r) {
    const s = (r.spark || []).filter(finite);
    if (s.length < 20 || !finite(r.px)) return "";
    const lo = Math.min.apply(null, s.concat(r.px)), hi = Math.max.apply(null, s.concat(r.px));
    if (!(hi > lo)) return "";
    const at = ((r.px - lo) / (hi - lo) * 100).toFixed(1);
    return '<span class="rng" title="52-week range (daily closes) ' + esc(px(lo, r.kind)) + " – " + esc(px(hi, r.kind)) + '"><i style="left:' + at + '%"></i></span><span class="rngk">52-wk range</span>';
  }
  function lineSpark(values) {
    const p = (values || []).filter(finite);
    if (p.length < 2) return "";
    const w = 120, h = 36;
    let mn = Math.min.apply(null, p), mx = Math.max.apply(null, p);
    if (mx === mn) mx = mn + 1;
    const d = p.map((v, i) => (i ? "L" : "M") + ((i / (p.length - 1)) * w).toFixed(1) + " " + (h - 3 - ((v - mn) / (mx - mn)) * (h - 6)).toFixed(1)).join("");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" aria-label="1-year close line"><title>1-year close line (this source publishes closes only)</title><path d="' + d + '" fill="none" stroke="var(--muted)" stroke-width="1.25" vector-effect="non-scaling-stroke"/></svg>';
  }
  function chart(r) {
    const C = window.MMCandles;
    return (C && C.svg(r, C.scale(), { h: 40 })) || lineSpark(r.spark);
  }
  let ROWS = [];
  function tile(r) {
    const u = unitOf(r);
    const meta = window.MMLabels && MMLabels.tileMeta ? MMLabels.tileMeta(r) : "";
    const inner = '<span class="tn">' + esc(short(r)) + '</span><span class="px">' + (px(r.px, r.kind) ? esc(px(r.px, r.kind)) : NA) + "</span>" +
      '<span class="pills">' + (finite(chg(r, "1D")) ? '<span class="k">1D</span>' + pill(chg(r, "1D"), u) : "") + (finite(chg(r, "1M")) ? '<span class="k">1M</span>' + pill(chg(r, "1M"), u) : "") + "</span>" +
      chart(r) + range52(r) + (meta ? '<span class="qmeta">' + esc(meta) + "</span>" : "");
    const k = ' data-row="' + (ROWS.push(r) - 1) + '"';
    const url = quoteURL(r);
    return url ? '<a class="tile"' + k + ' href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="Open the quote">' + inner + "</a>" : '<div class="tile"' + k + ">" + inner + "</div>";
  }

  /* ---------- 5 energy + movers ---------- */
  function kpi(label, value, sub, when) {
    return '<div class="kpi"><span class="kl">' + esc(label) + '</span><span class="kv">' + (value == null ? NA : esc(value)) + "</span>" + (sub ? '<span class="ks">' + esc(sub) + "</span>" : "") + (when ? '<span class="kw">' + esc(when) + "</span>" : "") + "</div>";
  }
  const n1 = v => (finite(v) ? v.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null);
  function isoWeek(ymd) {
    const d = new Date(String(ymd).slice(0, 10) + "T00:00:00Z");
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  }
  /* Daily day-ahead averages from mr.json (live-data): {start, v: {SYS: [...], SE3: [...], ...}}, one value per day. */
  function zurichDay(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date()); }
  function dayAhead(mr) {
    const dl = mr && mr.daily;
    if (!dl || !dl.start || !dl.v || !Array.isArray(dl.v.SYS)) return null;
    const t0 = Date.parse(dl.start + "T00:00:00Z");
    const ix = ymd => Math.round((Date.parse(ymd + "T00:00:00Z") - t0) / 864e5);
    const ymdAt = i => new Date(t0 + i * 864e5).toISOString().slice(0, 10);
    const lastI = dl.v.SYS.length - 1;
    let ti = Math.min(ix(zurichDay()), lastI);
    while (ti >= 0 && !finite(dl.v.SYS[ti])) ti--;
    if (ti < 0) return null;
    const at = ymd => { const i = ix(ymd), o = {}; Object.keys(dl.v).forEach(k => { const v = dl.v[k][i]; o[k] = finite(v) ? v : null; }); return o; };
    const w = dl.v.SYS.slice(Math.max(0, ti - 29), ti + 1).filter(finite);
    return { today: ymdAt(ti), next: ti < lastI ? ymdAt(ti + 1) : null, at: at, avg30: w.length >= 20 ? w.reduce((a, b) => a + b, 0) / w.length : null };
  }
  function nordicHTML(N) {
    if (!N) return "<p>" + NA + "</p>";
    const out = [];
    const D = dayAhead(N.mr);
    if (D) {
      const t = D.at(D.today), nx = D.at(D.next);
      out.push(kpi("Nordic system day-ahead", finite(t.SYS) ? n1(t.SYS) + " €/MWh" : null, [finite(D.avg30) ? "30-day average " + n1(D.avg30) : null, finite(nx.SYS) ? dayText(D.next) + " " + n1(nx.SYS) : null].filter(Boolean).join(" · ") || null, "Delivery " + dayText(D.today) + " · Nord Pool"));
      const zs = ["SE3", "SE4", "NO1", "NO2", "FI", "DK1", "DE-LU"].filter(z => finite(t[z]));
      out.push('<div class="kpi kpi-w"><span class="kl">Zones, day-ahead average</span><span class="kz">' + (zs.length ? zs.map(z => "<span><b>" + esc(z) + "</b> " + esc(n1(t[z])) + "</span>").join("") : NA) + '</span><span class="kw">€/MWh · delivery ' + esc(dayText(D.today)) + (finite(nx.SYS) ? " · " + esc(dayText(D.next)) + " is published" : "") + "</span></div>");
    } else {
      out.push(kpi("Nordic system day-ahead", null, null, null));
    }
    const fw = (N.prices && N.prices.futures) || {};
    ["front_month", "next_quarter"].forEach(k => {
      const x = fw[k] || {}, v = ((x.regions || {}).Nordic || {});
      out.push(kpi("Nordic " + (x.contract || (k === "front_month" ? "front month" : "next quarter")), finite(v.p) ? n1(v.p) + " €/MWh" : null, finite(v.d1) ? "1D " + fmtChg(v.d1, "%").replace("%", "") + " €" : null, x.as_of ? "EEX settle " + dayText(x.as_of) : null));
    });
    const G = N.generation || {};
    const na = G.nuclear_availability || {};
    const sum = o => Object.values(o || {}).filter(finite).reduce((a, b) => a + b, 0);
    const on = sum(na.online_mw), inst = sum(na.installed_mw);
    out.push(kpi("Nuclear available", inst > 0 ? (on / 1000).toFixed(1) + " of " + (inst / 1000).toFixed(1) + " GW" : null, inst > 0 ? "SE + FI" : null, na.as_of ? "As of " + dayText(na.as_of) : null));
    const hy = ((((G.regions || {}).Nordic || {}).metrics || {}).hydro || {}).rows || [];
    const h = hy.length ? hy[hy.length - 1] : null;
    out.push(kpi("Hydro generation", h && finite(h[1]) ? Math.round(h[1]).toLocaleString("en-GB") + " MW" : null, "Nordic daily average", h ? "Day " + dayText(h[0]) : null));
    const no = ((N.hydrology || {}).reservoirs || {}).NO || {};
    const nr = (no.rows || []).length ? no.rows[no.rows.length - 1] : null;
    let med = null;
    if (nr && no.band) { const b = no.band.find(x => x[0] === isoWeek(nr[0])); if (b && finite(b[2])) med = b[2]; }
    out.push(kpi("Norway reservoirs", nr && finite(nr[1]) ? n1(nr[1]) + "% full" : null, finite(med) ? "median for the week " + n1(med) + "% (" + (no.band_period || "reference") + ")" : null, nr ? "Week of " + dayText(nr[0]) : null));
    const W = (((N.weather || {}).regions || {}).Nordic || {}).metrics || {};
    [["wind100", "Wind at 100 m, 30 days", "m/s"], ["temp", "Temperature, 30 days", "°C"]].forEach(([m, lab, u]) => {
      const x = W[m] || {}, s = x.summary || {};
      out.push(kpi(lab, finite(s.value) ? n1(s.value) + " " + u : null, finite(s.normal) ? "normal " + n1(s.normal) + " " + u : null, x.as_of ? "ERA5 to " + dayText(x.as_of) : null));
    });
    return '<div class="kpis">' + out.join("") + "</div>";
  }
  function gasHTML(gas) {
    const eu = gas && gas.areas && gas.areas.EU;
    const s = eu && eu.s;
    if (!s) return "<p>" + NA + "</p>";
    const pp = v => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pp" : null);
    return '<div class="kpis">' +
      kpi("EU storage", finite(s.fill) ? n1(s.fill) + "% full" : null, finite(s.twh) ? Math.round(s.twh).toLocaleString("en-GB") + " TWh" : null, "Gas day " + dayText(eu.last)) +
      kpi("vs 5-year average", pp(s.vsAvg), finite(s.avg) ? "average " + n1(s.avg) + "%, range " + n1(s.min) + "–" + n1(s.max) + "%" : null, "Gas day " + dayText(eu.last)) +
      kpi("vs last year", pp(s.vsLy), finite(s.ly) ? "last year " + n1(s.ly) + "%" : null, "Gas day " + dayText(eu.last)) +
      kpi("7-day change", pp(s.d7), finite(s.d1) ? "1 day " + pp(s.d1) : null, "Gas day " + dayText(eu.last)) + "</div>";
  }
  function moversHTML(market, p) {
    const seen = {}, all = [];
    ((market && market.groups) || []).forEach(g => {
      if (!["nordic", "energy", "lundin", "metals"].includes(g.id)) return;
      (g.sections || []).forEach(s => (s.rows || []).forEach(r => {
        if (r.kind !== "equity" || seen[r.sym] || !finite(chg(r, p))) return;
        seen[r.sym] = 1; all.push(r);
      }));
    });
    if (!all.length) return "<p>" + NA + "</p>";
    all.sort((a, b) => chg(b, p) - chg(a, p));
    const row = r => '<li><a href="#co=' + esc(encodeURIComponent(r.sym)) + '" data-co="' + esc(r.sym) + '"><span class="mn">' + esc(r.name) + '</span><span class="mx">' + esc(r.exch || r.sym) + '</span><span class="mp">' + esc((px(r.px, r.kind) || "") + (r.ccy ? " " + r.ccy : "")) + "</span>" + pill(chg(r, p), "%") + "</a></li>";
    const up = all.filter(r => chg(r, p) > 0).slice(0, 6), dn = all.filter(r => chg(r, p) < 0).slice(-6).reverse();
    return '<div class="movers"><div><h3>Up most · ' + p + "</h3><ol>" + (up.map(row).join("") || "<li>None up</li>") + "</ol></div><div><h3>Down most · " + p + "</h3><ol>" + (dn.map(row).join("") || "<li>None down</li>") + '</ol></div></div><p class="fnote">' + all.length + " covered names (Renewables, Oil & gas, Lundin Group, Metals & mining) with a " + p + " change in the live file. Tap a name for its company page.</p>";
  }

  /* ---------- page ---------- */
  const S = { host: null, timer: 0, data: {}, period: "1D", loadedAt: null, open: false };
  function period() { try { const v = localStorage.getItem("emmaLivePeriod"); return ["1D", "1W", "1M"].includes(v) ? v : "1D"; } catch (e) { return "1D"; } }
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null); }
  async function load() {
    const t5 = Math.floor(Date.now() / EVERY), th = Math.floor(Date.now() / 36e5);
    const [market, gas, comment, prices, generation, hydrology, weather, mr] = await Promise.all([
      getJSON("data/market.json?t=" + t5), getJSON("data/gas.json?t=" + th), getJSON("data/live_comment.json?t=" + t5),
      getJSON(NV2 + "prices.json?t=" + th), getJSON(NV2 + "generation.json?t=" + th), getJSON(NV2 + "hydrology.json?t=" + th), getJSON(NV2 + "weather.json?t=" + th), getJSON("data/mr.json?t=" + th)
    ]);
    S.data = { market, gas, comment, nordic: prices || mr ? { prices, generation, hydrology, weather, mr } : null };
    S.loadedAt = new Date();
  }
  function toneHTML(c) {
    if (!c || !c.headline) return '<section class="block lp-tone" id="lpTone"><header class="bh"><h2>Tone of the day</h2></header><p>' + NA + "</p></section>";
    const src = c.source || {};
    const views = (c.views || []).map(v => "<p><b>" + esc(v.section) + ".</b> " + esc(v.text) + "</p>").join("");
    return '<section class="block lp-tone" id="lpTone"><header class="bh"><p class="kick">Tone of the day</p>' + stamp("Written " + (zurich(c.written_at, true) || "time not given")) + "</header>" +
      "<h2>" + esc(c.headline) + "</h2>" + (c.tone && !(c.body && c.body[0] && c.body[0].indexOf(c.tone) === 0) ? '<p class="tone">' + esc(c.tone) + "</p>" : "") +
      '<div class="tone-g"><div>' + (c.body && c.body.length ? "<ul>" + c.body.map(b => { const m = /^(.+?[.!?])(\s|$)/.exec(b); return "<li>" + (m ? "<b>" + esc(m[1]) + "</b>" + esc(b.slice(m[1].length)) : esc(b)) + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      (views ? '<aside class="views"><h3>Our view</h3>' + views + "</aside>" : "") + "</div>" +
      (c.risk_label ? '<p class="fnote">Edition risk gauge: ' + esc(c.risk_label) + "</p>" : "") +
      '<p class="from">From the ' + esc(src.edition || "last") + " Pulse email" + (src.sent ? ", sent " + esc(String(src.sent).split(", ").pop()) : "") + ". Not live: the numbers below are." + (src.href ? ' <a href="' + esc(src.href) + '">Read the full edition →</a>' : "") + "</p></section>";
  }
  function riskHTML(by, market) {
    const g = riskGauge(by);
    const rows = g.parts.map(p => {
      const w = Math.min(50, Math.abs(p.contrib) * 50 / 12.5).toFixed(1);
      return "<tr><th>" + esc(p.label) + "</th><td>" + esc(p.shown || "") + '</td><td class="cb"><span class="fb"><i class="' + (p.contrib >= 0 ? "up" : "dn") + '" style="' + (p.contrib >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i></span></td><td class="cv ' + (p.contrib > 0 ? "up" : p.contrib < 0 ? "dn" : "") + '">' + (p.contrib > 0 ? "+" : p.contrib < 0 ? "−" : "") + Math.abs(p.contrib).toFixed(1) + "</td></tr>";
    }).join("");
    const method = "<p>Each input is turned into a score from −1 (risk off) to +1 (risk on) and capped there. The gauge is the average score × 100, so it runs from −100 to +100; each row's contribution is its share of that total. Risk on at +25 or above, risk off at −25 or below, mixed in between. Equal weights. Day changes are the live price against the previous close, so a market that has not opened yet counts its last session.</p><ul>" + RISK_METHOD.map(m => "<li><b>" + esc(m[1]) + ":</b> " + esc(m[2]) + "</li>").join("") + "</ul><p>Source: market.json on emmi-data (Yahoo Finance quotes, ~15-minute refresh). An input with no live value is left out, never filled in.</p>";
    return '<section class="block lp-risk" id="lpRisk"><header class="bh"><h2>Risk on / off</h2><span class="bh-r">' + stamp("Prices " + (zurich(market && market.generated_utc) || "time not available")) + '<button type="button" class="info" data-lp-info="lpRiskInfo" aria-expanded="false" aria-controls="lpRiskInfo" aria-label="How the gauge works">i</button></span></header>' +
      '<div class="lp-risk-in"><div class="lp-dialbox">' + dial(g.score) + '<p class="lp-score ' + (g.score >= 25 ? "up" : g.score <= -25 ? "dn" : "") + '">' + (finite(g.score) ? (g.score > 0 ? "+" : g.score < 0 ? "−" : "") + Math.abs(g.score) : "—") + '</p><p class="lp-label">' + esc(g.label || "Not available yet") + "</p></div>" +
      '<div class="lp-parts"><table><thead><tr><th>Input</th><th>Live</th><th class="cb">Contribution</th><th class="cv">pts</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">' + NA + "</td></tr>") + "</tbody></table>" +
      (g.missing.length ? '<p class="fnote">Left out: ' + esc(g.missing.join("; ")) + ".</p>" : "") + "</div></div>" +
      '<div class="info-panel" id="lpRiskInfo" hidden>' + method + "</div></section>";
  }
  function flowHTML(market, by, p) {
    const pick = syms => syms.map(s => by[s]).filter(Boolean).map(r => ({ name: short(r), v: chg(r, p), u: unitOf(r) }));
    const btn = k => '<button type="button" data-lp-period="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>";
    return '<section class="block lp-flow" id="lpFlow"><header class="bh"><h2>Where the money is going</h2><span class="bh-r">' + stamp("Prices " + (zurich(market && market.generated_utc) || "time not available")) + '<span class="cdl-scale lp-per" role="group" aria-label="Period">' + btn("1D") + btn("1W") + btn("1M") + "</span></span></header>" +
      '<div class="lp-flow-g">' + flowPanel(FLOW.regions.title, pick(FLOW.regions.syms)) + flowPanel("Sectors", sectorRows(market, by, p), "Baskets are equal-weight averages of the covered names in the live file (count in brackets); ETFs as quoted.") + flowPanel(FLOW.commodities.title, pick(FLOW.commodities.syms)) + flowPanel(FLOW.fx.title, pick(FLOW.fx.syms), "Pair moves: EUR/USD up = euro stronger, USD/JPY up = dollar stronger.") + "</div></section>";
  }
  function marketsHTML(market, by) {
    ROWS = [];
    const C = window.MMCandles;
    const sw = C ? '<span class="cdl-bar"><span class="cdl-k">Candles</span>' + C.toggle(C.scale()) + "</span>" : "";
    const groups = MONITOR.map(([title, syms, note]) => {
      const rows = syms.map(s => by[s]).filter(Boolean);
      if (!rows.length) return "";
      return '<h3>' + esc(title) + (note ? ' <span class="h3n">' + esc(note) + "</span>" : "") + '</h3><div class="tiles">' + rows.map(tile).join("") + "</div>";
    }).join("");
    return '<section class="block lp-mkts" id="lpMarkets"><header class="bh"><h2>Markets</h2><span class="bh-r">' + stamp("Prices " + (zurich(market && market.generated_utc) || "time not available")) + sw + "</span></header>" + (groups || "<p>" + NA + "</p>") +
      '<p class="fnote">Candles: one per trading day for the last month, or one per month for the last year (this month to date). Green closed at or above its open. Yields whose source publishes closes only keep a grey line. Thin bar = 52-week range of daily closes, tick = now. Tap a tile for its quote. <a href="#markets">All markets →</a></p></section>';
  }
  function energyHTML(N, gas) {
    const nv = N && N.mr && N.mr.generated_utc ? "Power prices " + (zurich(N.mr.generated_utc.replace("Z", ":00Z")) || "") : null;
    return '<section class="block lp-energy" id="lpEnergy"><header class="bh"><h2>Energy</h2>' + stamp(nv) + '</header><h3>Nordic power <a class="h3n" href="#energy/nordic">Open Nordic power →</a></h3>' + nordicHTML(N) +
      '<h3>EU gas storage <a class="h3n" href="#energy/gas">Open gas storage →</a></h3>' + gasHTML(gas) + '<p class="fnote">Each figure prints its own date. Day-ahead prices are published around 13:00 for the next day; ERA5 weather runs about five days behind; reservoirs are weekly.</p></section>';
  }
  function render() {
    const host = S.host;
    if (!host) return;
    const D = S.data, market = D.market, by = index(market);
    const p = S.period;
    host.innerHTML = '<div class="lp" id="livePulse"><header class="lp-head"><div><p class="kicker">Briefs</p><h1>Live Pulse</h1><p class="lede">The Pulse, story first, refreshing through the day. Prices and power data are live from the site\'s feeds; the written comment is from the last sent edition and says when it was written.</p></div><p class="asof lp-upd">Checked ' + esc(zurich(S.loadedAt && S.loadedAt.toISOString()) || "") + ' · refreshes every 5 min · <a href="#briefs">Editions archive</a></p></header>' +
      toneHTML(D.comment) + riskHTML(by, market) + flowHTML(market, by, p) + marketsHTML(market, by) + energyHTML(D.nordic, D.gas) +
      '<section class="block lp-movers" id="lpMovers"><header class="bh"><h2>Coverage movers</h2>' + stamp("Prices " + (zurich(market && market.generated_utc) || "time not available")) + "</header>" + moversHTML(market, p) + "</section>" +
      '<footer class="lp-foot"><p>Sources: Tone of the day, data/live_comment.json (from the sent Pulse email, verbatim). Risk gauge, money flows, markets and movers: market.json on the emmi-data live-data branch (Yahoo Finance and CNBC quotes). Nordic power: emmi-data nordic-v2 files (Nord Pool, ENTSO-E, EEX, NVE, ERA5), the same files as Energy. Gas storage: GIE AGSI+ via gas.json. Commentary is market commentary, not investment advice.</p></footer></div>';
    const C = window.MMCandles;
    const root = host.querySelector("#livePulse");
    if (C) C.wire(root, () => {
      root.querySelectorAll("[data-cdl]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cdl === C.scale())));
      root.querySelectorAll(".lp-mkts .tile[data-row]").forEach(t => { const old = t.querySelector(":scope > svg.spark"); const h = chart(ROWS[+t.dataset.row]); if (old) old.outerHTML = h || ""; });
    });
  }
  function onClick(e) {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const per = t.closest("[data-lp-period]");
    if (per) { S.period = per.dataset.lpPeriod; try { localStorage.setItem("emmaLivePeriod", S.period); } catch (x) { /* private mode */ } render(); return; }
    const inf = t.closest("[data-lp-info]");
    if (inf) { const pnl = S.host.querySelector("#" + inf.dataset.lpInfo); if (pnl) { pnl.hidden = !pnl.hidden; inf.setAttribute("aria-expanded", String(!pnl.hidden)); } return; }
    const co = t.closest("[data-co]");
    if (co && window.MMCompany && MMCompany.open) { e.preventDefault(); MMCompany.open(co.dataset.co); }
  }
  function visible() { return S.host && S.host.isConnected && !S.host.hidden && S.host.querySelector("#livePulse") && document.body.classList.contains("view-briefs"); }
  function tick() {
    if (!visible()) { stop(); return; }
    if (document.hidden) return;
    const keep = window.scrollY;
    load().then(() => { if (visible()) { render(); window.scrollTo(0, keep); } });
  }
  function stop() { if (S.timer) clearInterval(S.timer); S.timer = 0; }
  function mount(host) {
    if (!host) return;
    S.host = host;
    S.period = period();
    if (!host._lpWired) { host._lpWired = true; host.addEventListener("click", onClick); }
    host.innerHTML = '<div class="lp" id="livePulse"><p class="kicker">Briefs</p><h1>Live Pulse</h1><p class="asof">Loading the live files…</p></div>';
    stop();
    load().then(render);
    S.timer = setInterval(tick, EVERY);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.timer && S.loadedAt && Date.now() - S.loadedAt > EVERY) tick(); });
  window.EMMILivePulse = { mount: mount, stop: stop, riskGauge: riskGauge, index: index, sectorRows: sectorRows, dayAhead: dayAhead, NOT_IN_FEED: NOT_IN_FEED };
})();
