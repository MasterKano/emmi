/* Live Pulse (#briefs/live). The Pulse story, refreshing through the day, story first:
   1 The brief (data/live_comment.json: 1-3 findings and our view, with the time it was written; not live)
   2 Risk on/off gauge (computed here from market.json; inputs that are missing are left out and listed)
   3 Leading and lagging (1D / 1W / 1M ranked price moves: regions, sectors, commodities, FX)
   4 Markets in the Pulse tile layout, candles with the Daily · 1M / Monthly · 1Y switch
   5 Energy (nordic-v2 files + gas.json) and coverage-list movers.
   Only instruments that exist in the live feeds are shown. null is "Not available yet", never zero or a guess.
   The email is not touched by this page. window.EMMILivePulse. */
(function () {
  "use strict";
  const NV2 = "/emmi/ed/main/nordic-v2/";
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
  const pstamp = m => '<p class="asof"><span class="fr dl">Delayed</span> price file ' + esc(zurich(m && m.generated_utc) || "time not available") + "</p>";

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

  /* ---------- latest price with its unit, and where each name links (presentation only) ---------- */
  /* Futures units are the exchange contract units; indices are points; FX pairs are quoted in the second currency;
     ETFs in their trading currency; yields already print "%". Anything else prints no unit rather than a guess. */
  const UNIT = { "BZ=F": "USD/bbl", "CL=F": "USD/bbl", "HO=F": "USD/gal", "NG=F": "USD/MMBtu", "TTF=F": "EUR/MWh", "GC=F": "USD/oz", "SI=F": "USD/oz", "PL=F": "USD/oz", "PA=F": "USD/oz", "HG=F": "USD/lb", "ALI=F": "USD/t", "DX-Y.NYB": "pts",
    "KC=F": "USc/lb", "CC=F": "USD/t", "ZW=F": "USc/bu", "ZC=F": "USc/bu", "ZS=F": "USc/bu", "ZO=F": "USc/bu", "SB=F": "USc/lb", "HE=F": "USc/lb", "LE=F": "USc/lb", "CT=F": "USc/lb", "ZL=F": "USc/lb", "OJ=F": "USc/lb", "ZR=F": "USD/cwt", "ZM=F": "USD/st", "LBR=F": "USD/mbf" };
  function unitText(r) {
    if (!r) return "";
    if (UNIT[r.sym]) return UNIT[r.sym];
    if (r.kind === "yield") return "";
    if (r.kind === "index") return "pts";
    if (r.ccy === "USX") return "USc";
    return r.ccy ? String(r.ccy) : "";
  }
  function pxu(r) {
    const t = r ? px(r.px, r.kind) : null;
    if (!t) return null;
    const u = unitText(r);
    return u ? t + " " + u : t;
  }
  /* Deeper EMMi pages: futures curves (Brent, diesel, TTF), oil & gas fundamentals (WTI, Henry Hub), copper and gold
     fundamentals (Metals & mining). Everything else opens its source quote page. */
  const DEEP = { "BZ=F": "#energy/oil/ogCurves", "HO=F": "#energy/oil/ogCurves", "CL=F": "#energy/oil", "NG=F": "#energy/oil", "TTF=F": "#energy/gas/gsSecPx", "GC=F": "#companies/mining", "HG=F": "#companies/mining" };
  const GROUP_PAGE = { nordic: "#companies/renewables", energy: "#companies/oil", lundin: "#companies/mining", metals: "#companies/mining" };
  function linkOf(r) {
    if (!r) return null;
    if (DEEP[r.sym]) return { href: DEEP[r.sym], ext: false };
    const u = quoteURL(r);
    return u ? { href: u, ext: true } : null;
  }
  function aOpen(l, cls, extra) {
    return "<a" + (cls ? ' class="' + cls + '"' : "") + ' href="' + esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener noreferrer"' : "") + (extra || "") + ">";
  }
  const nameLink = (text, l) => (l ? aOpen(l, "lk") + esc(text) + "</a>" : esc(text));

  /* ---------- freshness: what kind of price this is and when it was observed ---------- */
  const hhmm = t => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  function fresh(r, genIso) {
    if (!r) return null;
    if (r.official && r.src === r.official.id) {
      const d = r.official.asof || r.bar_date, lv = r.live && finite(r.live.px) ? r.live : null;
      return { cls: "pc", tag: "Close", text: "Official close " + (dayText(d) || "date n/a"), short: "Official " + (dmy(d) || "n/a"),
        long: (r.official.name || "Official") + " close for " + (dayText(d) || "a date not given") + (lv ? ". " + lv.src + " delayed quote " + px(lv.px, "yield") + " at " + hhmm(lv.t) + " Zurich drives the 1D move" : "") + "." };
    }
    const t = r.market_time ? Date.parse(r.market_time) : NaN;
    if (!isFinite(t)) return { cls: "pc", tag: "Close", text: r.bar_date ? "Close " + dayText(r.bar_date) : "Time not given", short: r.bar_date ? "Close " + dmy(r.bar_date) : "Time n/a", long: "Close for " + (dayText(r.bar_date) || "a date not given") + "; the source gives no quote time." };
    const gen = Date.parse(genIso || "") || Date.now(), today = zurichDay(new Date(t)) === zurichDay(new Date());
    if (r.state === "open" && gen - t <= 30 * 60e3)
      return { cls: "dl", tag: "Delayed", text: "Delayed " + hhmm(t), short: "Delayed " + hhmm(t), long: "Delayed quote at " + hhmm(t) + " Zurich (Yahoo, typically about 15 minutes behind the exchange). Not a live price." };
    if (today)
      return { cls: "cl", tag: r.state === "open" ? "Last" : "Close", text: (r.state === "open" ? "Last trade " : "Close ") + hhmm(t), short: (r.state === "open" ? "Last " : "Close ") + hhmm(t),
        long: (r.state === "open" ? "Last trade at " + hhmm(t) + " Zurich; the market is quiet or paused." : "Today's close, last trade at " + hhmm(t) + " Zurich.") };
    return { cls: "pc", tag: "Prev close", text: "Prev close " + dayText(zurichDay(new Date(t))), short: "Prev " + dmy(zurichDay(new Date(t))), long: "Previous session's close (" + dayText(zurichDay(new Date(t))) + ", " + hhmm(t) + " Zurich). The market has not traded since." };
  }
  const tagHTML = f => (f ? '<span class="fr ' + f.cls + '" title="' + esc(f.long) + '">' + esc(f.short || f.text) + "</span>" : "");
  function dmy(ymd) { const t = dayText(ymd); return t ? t.replace(/^\w+ /, "") : null; }

  /* ---------- hover / tap cards: one-line explainer + chart, fundamentals, source ---------- */
  const TV = tv => (tv ? "https://www.tradingview.com/symbols/" + encodeURIComponent(String(tv).replace(":", "-")).replace(/%21/g, "!") + "/" : null);
  const WASDE = ["USDA WASDE (supply and demand)", "https://www.usda.gov/about-usda/general-information/staff-offices/office-chief-economist/commodity-markets/wasde-report"];
  const TV_FIX = { "TTF=F": "ICEENDEX:TFM1!" };   /* TradingView's page for the TTF front month */
  const FUND = {
    "BZ=F": ["EMMi oil balances", "#energy/oil"], "CL=F": ["EMMi oil balances", "#energy/oil"], "HO=F": ["EMMi oil balances", "#energy/oil"],
    "NG=F": ["EIA weekly gas storage", "https://ir.eia.gov/ngs/ngs.html"], "TTF=F": ["EMMi EU gas storage", "#energy/gas"],
    "GC=F": ["EMMi gold (WGC)", "#companies/mining"], "HG=F": ["EMMi copper (ICSG)", "#companies/mining"],
    "ZW=F": WASDE, "ZC=F": WASDE, "ZS=F": WASDE, "ZL=F": WASDE, "ZM=F": WASDE, "ZO=F": WASDE, "ZR=F": WASDE, "CT=F": WASDE,
    "KC=F": ["International Coffee Organization", "https://ico.org/"], "CC=F": ["International Cocoa Organization", "https://www.icco.org/"]
  };
  const EXPLAIN = {
    "^VIX": "Expected 30-day S&P 500 volatility from options. Above 20 signals stress; above 28 the gauge scores full risk-off.",
    "^GSPC": "US large caps. The risk gauge watches its distance from the 200-day average.", "^STOXX": "European large and mid caps. The gauge watches its distance from the 200-day average.",
    "^TNX": "US 10-year Treasury yield. A sharp rise tightens financial conditions and counts as risk-off.",
    "DX-Y.NYB": "Dollar against six majors. A firmer dollar usually means tighter global conditions and weaker metals.",
    "GC=F": "Gold futures. A strong gold bid often signals hedging demand; falling gold with a firm dollar points to rate pressure.",
    "HG=F": "COMEX copper futures, a read on industrial demand. Copper outrunning gold counts as risk-on.",
    "BZ=F": "ICE Brent, the global crude benchmark.", "CL=F": "NYMEX WTI, the US crude benchmark.",
    "HO=F": "NY Harbor ULSD (diesel). Diesel tightness shows up here before it reaches crude.", "NG=F": "US Henry Hub gas, front month.",
    "TTF=F": "Dutch TTF, Europe's gas benchmark, front month.", "CO2.L": "SparkChange physical EUA ETC, tracking EU carbon permits.",
    "U-UN.TO": "Sprott Physical Uranium Trust units, a proxy for spot uranium."
  };
  function generic(r) {
    const k = r && r.kind;
    if (k === "index") return "Index level in points. 1D is against the previous close, 1M against a month ago.";
    if (k === "yield") return "Yield in percent; changes are in basis points.";
    if (k === "fx") return "Exchange rate; the price is in the second currency.";
    if (k === "future") return r.note ? r.note : "Futures price, front month.";
    return "Price in the trading currency.";
  }
  let POPS = [];
  const PAGE = { "#energy/oil/ogCurves": "Oil futures curves", "#energy/oil": "Oil & gas", "#energy/gas/gsSecPx": "TTF price and curve", "#companies/mining": "Metals & mining",
    "#energy/prices": "Nordic prices and forward curve", "#energy/generation": "Nordic generation", "#energy/hydro": "Nordic hydro", "#energy/weather": "Nordic weather",
    "#energy/gas": "EU gas storage", "#markets/mkt-indices": "Markets: indices", "#companies/renewables": "Renewables companies", "#companies/oil": "Oil & gas companies" };
  const pageLab = h => "EMMi: " + (PAGE[h] || "page");
  const popAttr = o => ' data-pop="' + (POPS.push(o) - 1) + '"';
  function popFor(r, genIso, extra) {
    if (!r) return null;
    const links = [], d = DEEP[r.sym], f = FUND[r.sym];
    if (d) links.push([pageLab(d), d]);
    const ch = TV(TV_FIX[r.sym] || r.tv); if (ch) links.push(["Chart", ch]);
    if (f && f[1] !== d) links.push(["Fundamentals: " + f[0], f[1]]); else if (f) links[0][0] = "Fundamentals: " + f[0];
    if (r.official && r.official.url) links.push([(r.src === r.official.id ? "Source: " : "Official reference: ") + r.official.name, r.official.url]);
    const q = quoteURL(r); if (q) links.push(["Quote: " + (/cnbc/.test(q) ? "CNBC" : "Yahoo"), q]);
    if (r.live && r.live.url && r.live.url !== q) links.push(["Delayed quote: " + (r.live.src || "source"), r.live.url]);
    const fr = fresh(r, genIso);
    return { title: r.name, value: pxu(r), explain: (extra ? extra + " " : "") + (EXPLAIN[r.sym] || generic(r)), fresh: fr && fr.long, links: links };
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

  /* ---------- 3 leading and lagging ---------- */
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
    const basket = (label, rows, link) => {
      const v = rows.map(r => chg(r, p)).filter(finite);
      if (v.length >= 3) out.push({ name: label + " (" + v.length + ")", v: v.reduce((a, b) => a + b, 0) / v.length, u: "%", basket: true, px: null, link: link });
    };
    ((market && market.groups) || []).forEach(g => {
      if (!["nordic", "energy", "lundin", "metals"].includes(g.id)) return;
      (g.sections || []).forEach(s => {
        const eq = (s.rows || []).filter(r => r.kind === "equity");
        const label = s.label ? s.label : g.id === "energy" ? "Oil & gas majors" : g.label;
        basket(label, eq, GROUP_PAGE[g.id] ? { href: GROUP_PAGE[g.id], ext: false } : null);
      });
    });
    ["XLE", "XOP", "GDX", "COPX", "TLT"].forEach(sym => { const r = by[sym]; if (r && finite(chg(r, p))) out.push({ name: r.sym + " ETF", v: chg(r, p), u: "%", px: pxu(r), link: linkOf(r), pop: popFor(r, market && market.generated_utc) }); });
    return out;
  }
  function flowPanel(title, rows, note) {
    const ok = rows.filter(r => finite(r.v)).sort((a, b) => b.v - a.v);
    const mx = Math.max.apply(null, ok.map(r => Math.abs(r.v)).concat([0.0001]));
    const body = ok.length ? ok.map(r => {
      const w = (Math.abs(r.v) / mx * 50).toFixed(1);
      const side = r.v >= 0 ? "left:50%" : "right:50%";
      return "<li" + (r.pop ? popAttr(r.pop) : "") + '><span class="fn">' + nameLink(r.name, r.link) + (r.px ? '<span class="fp">' + esc(r.px) + "</span>" : "") + '</span><span class="fb"><i class="' + (r.v >= 0 ? "up" : "dn") + '" style="' + side + ";width:" + w + '%"></i></span><span class="fv ' + (r.v > 0 ? "up" : r.v < 0 ? "dn" : "") + '">' + esc(fmtChg(r.v, r.u)) + "</span></li>";
    }).join("") : "<li>" + NA + "</li>";
    return '<div class="lp-flow-p"><h3>' + esc(title) + "</h3><ol>" + body + "</ol>" + (note ? '<p class="fnote">' + esc(note) + "</p>" : "") + "</div>";
  }

  /* ---------- 4 markets tiles (Pulse grid) ---------- */
  const MONITOR = [
    ["Equities", ["^GSPC", "^IXIC", "^STOXX", "^GDAXI", "^HSI", "^N225", "^FTSE", "^SSMI", "^DJI", "^STOXX50E", "OSEBX.OL", "^OMX", "^OMXC25", "^OMXH25", "^VIX"]],
    ["Energy", ["BZ=F", "CL=F", "TTF=F", "NG=F", "HO=F", "CO2.L", "U-UN.TO"]],
    ["Rates", ["^IRX", "^FVX", "^TNX", "^TYX", "CNBC:DE10Y-DE", "CNBC:GB10Y-GB", "CNBC:FR10Y-FR", "CNBC:CH10Y-CH"], "change in bp"],
    ["Currencies", ["EURUSD=X", "EURCHF=X", "GBPCHF=X", "JPY=X", "DX-Y.NYB", "CHF=X", "EURNOK=X", "EURSEK=X"]],
    ["Precious metals", ["GC=F", "SI=F", "PL=F", "PA=F"]],
    ["Base metals", ["HG=F", "ALI=F"], "COMEX; LME copper, zinc, lead, nickel and iron ore have no free live source"],
    ["Soft commodities", ["KC=F", "CC=F", "ZW=F", "ZC=F", "ZS=F", "SB=F", "HE=F", "CT=F", "ZL=F", "ZO=F", "LE=F", "ZR=F", "ZM=F", "OJ=F", "LBR=F"], "US futures, continuous front month; London softs not available"]
  ];
  function quoteURL(r) {
    const sym = String(r.sym || "");
    if (sym && !sym.startsWith("CNBC:")) return "https://finance.yahoo.com/quote/" + encodeURIComponent(sym);
    if (sym.startsWith("CNBC:") && sym.length > 5) return "https://www.cnbc.com/quotes/" + encodeURIComponent(sym.slice(5));
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
  let ROWS = [], GEN = null;
  function tile(r) {
    const u = unitOf(r);
    const f = fresh(r, GEN);
    const u0 = unitText(r);
    const inner = '<span class="tn">' + esc(short(r)) + '</span><span class="px">' + (px(r.px, r.kind) ? esc(px(r.px, r.kind)) + (u0 ? ' <small class="pu">' + esc(u0) + "</small>" : "") : NA) + "</span>" +
      '<span class="pills">' + (finite(chg(r, "1D")) ? '<span class="k">1D</span>' + pill(chg(r, "1D"), u) : "") + (finite(chg(r, "1M")) ? '<span class="k">1M</span><span class="m1" title="1M">' + pill(chg(r, "1M"), u) + "</span>" : "") + "</span>" +
      chart(r) + range52(r) + '<span class="qmeta">' + tagHTML(f) + "</span>";
    const k = ' data-row="' + (ROWS.push(r) - 1) + '"';
    const l = linkOf(r);
    const pa = popAttr(popFor(r, GEN));
    return l ? aOpen(l, "tile", k + pa) + inner + "</a>" : '<div class="tile"' + k + pa + ">" + inner + "</div>";
  }

  /* ---------- 5 energy + movers ---------- */
  const NP = ["Nord Pool day-ahead prices", "https://data.nordpoolgroup.com/auction/day-ahead/prices"], ENTSOE = ["ENTSO-E Transparency", "https://transparency.entsoe.eu/"],
    ERA5 = ["Copernicus ERA5", "https://cds.climate.copernicus.eu/"], AGSI = ["GIE AGSI+ storage", "https://agsi.gie.eu/"];
  /* label pattern, freshness tag, one-line explainer, source */
  const KPI_INFO = [
    [/^Nordic system day-ahead/, "Delivery", "Average of the 24 hourly prices for the Nordic system area, set in Nord Pool's noon auction for the next day.", NP],
    [/^Zones/, "Delivery", "Day-ahead averages by bidding zone. Gaps to the system price show where the grid is congested.", NP],
    [/^Nordic /, "Settle", "EEX Nordic base-load futures settlement: the market's expected average system price for that period.", ["EEX power futures", "https://www.eex.com/en/market-data/power/futures"]],
    [/^Nuclear/, "Observed", "Swedish and Finnish nuclear capacity online. Outages tighten supply and lift prices, most in SE3 and FI.", ENTSOE],
    [/^Hydro generation/, "Observed", "Nordic hydro output, daily average. Hydro is the swing supply that sets most Nordic prices.", ENTSOE],
    [/^Norway reservoirs/, "Observed", "NVE weekly reservoir filling against the median for the same week. Below median raises the value of water, and prices.", ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"]],
    [/^Wind/, "Observed", "30-day average wind speed at 100 m against normal. More wind means more wind power and lower prices.", ERA5],
    [/^Temperature/, "Observed", "30-day average temperature against normal. Colder weather means more heating demand.", ERA5],
    [/^(EU storage|vs |7-day)/, "Observed", "EU gas storage filling from GIE AGSI+. A deficit to the 5-year average leaves less buffer for winter.", AGSI]
  ];
  function kpi(label, value, sub, when, href) {
    const info = KPI_INFO.find(x => x[0].test(label));
    const pa = info ? popAttr({ title: label, value: value, explain: info[2], fresh: when || null, links: [href ? [pageLab(href), href] : null, ["Source: " + info[3][0], info[3][1]]].filter(Boolean) }) : "";
    when = when && info ? '<span class="fr ' + (info[1] === "Observed" ? "ob" : "pc") + '">' + info[1] + "</span> " + esc(when) : esc(when || "");
    return '<div class="kpi"' + pa + '><span class="kl">' + nameLink(label, href ? { href: href, ext: false } : null) + '</span><span class="kv">' + (value == null ? NA : esc(value)) + "</span>" + (sub ? '<span class="ks">' + esc(sub) + "</span>" : "") + (when ? '<span class="kw">' + when + "</span>" : "") + "</div>";
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
      out.push(kpi("Nordic system day-ahead", finite(t.SYS) ? n1(t.SYS) + " €/MWh" : null, [finite(D.avg30) ? "30-day average " + n1(D.avg30) : null, finite(nx.SYS) ? dayText(D.next) + " " + n1(nx.SYS) : null].filter(Boolean).join(" · ") || null, "Delivery " + dayText(D.today) + " · Nord Pool", "#energy/prices"));
      const zs = ["SE3", "SE4", "NO1", "NO2", "FI", "DK1", "DE-LU"].filter(z => finite(t[z]));
      const zi = KPI_INFO[1];
      out.push('<div class="kpi kpi-w"' + popAttr({ title: "Zones, day-ahead average", explain: zi[2], fresh: "Delivery " + dayText(D.today), links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + zi[3][0], zi[3][1]]] }) + '><span class="kl"><a class="lk" href="#energy/prices">Zones, day-ahead average</a></span><span class="kz">' + (zs.length ? zs.map(z => "<span><b>" + esc(z) + "</b> " + esc(n1(t[z])) + "</span>").join("") : NA) + '</span><span class="kw"><span class="fr pc">Delivery</span> ' + esc(dayText(D.today)) + " · €/MWh" + (finite(nx.SYS) ? " · " + esc(dayText(D.next)) + " is published" : "") + "</span></div>");
    } else {
      out.push(kpi("Nordic system day-ahead", null, null, null, "#energy/prices"));
    }
    const fw = (N.prices && N.prices.futures) || {};
    ["front_month", "next_quarter"].forEach(k => {
      const x = fw[k] || {}, v = ((x.regions || {}).Nordic || {});
      out.push(kpi("Nordic " + (x.contract || (k === "front_month" ? "front month" : "next quarter")), finite(v.p) ? n1(v.p) + " €/MWh" : null, finite(v.d1) ? "1D " + fmtChg(v.d1, "%").replace("%", "") + " €" : null, x.as_of ? "EEX settle " + dayText(x.as_of) : null, "#energy/prices"));
    });
    const G = N.generation || {};
    const na = G.nuclear_availability || {};
    const sum = o => Object.values(o || {}).filter(finite).reduce((a, b) => a + b, 0);
    const on = sum(na.online_mw), inst = sum(na.installed_mw);
    out.push(kpi("Nuclear available", inst > 0 ? (on / 1000).toFixed(1) + " of " + (inst / 1000).toFixed(1) + " GW" : null, inst > 0 ? "SE + FI" : null, na.as_of ? "As of " + dayText(na.as_of) : null, "#energy/generation"));
    const hy = ((((G.regions || {}).Nordic || {}).metrics || {}).hydro || {}).rows || [];
    const h = hy.length ? hy[hy.length - 1] : null;
    out.push(kpi("Hydro generation", h && finite(h[1]) ? Math.round(h[1]).toLocaleString("en-GB") + " MW" : null, "Nordic daily average", h ? "Day " + dayText(h[0]) : null, "#energy/generation"));
    const no = ((N.hydrology || {}).reservoirs || {}).NO || {};
    const nr = (no.rows || []).length ? no.rows[no.rows.length - 1] : null;
    let med = null;
    if (nr && no.band) { const b = no.band.find(x => x[0] === isoWeek(nr[0])); if (b && finite(b[2])) med = b[2]; }
    out.push(kpi("Norway reservoirs", nr && finite(nr[1]) ? n1(nr[1]) + "% full" : null, finite(med) ? "median for the week " + n1(med) + "% (" + (no.band_period || "reference") + ")" : null, nr ? "Week of " + dayText(nr[0]) : null, "#energy/hydro"));
    const W = (((N.weather || {}).regions || {}).Nordic || {}).metrics || {};
    [["wind100", "Wind at 100 m, 30 days", "m/s"], ["temp", "Temperature, 30 days", "°C"]].forEach(([m, lab, u]) => {
      const x = W[m] || {}, s = x.summary || {};
      out.push(kpi(lab, finite(s.value) ? n1(s.value) + " " + u : null, finite(s.normal) ? "normal " + n1(s.normal) + " " + u : null, x.as_of ? "ERA5 to " + dayText(x.as_of) : null, "#energy/weather"));
    });
    return '<div class="kpis">' + out.join("") + "</div>";
  }
  function gasHTML(gas) {
    const eu = gas && gas.areas && gas.areas.EU;
    const s = eu && eu.s;
    if (!s) return "<p>" + NA + "</p>";
    const pp = v => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pp" : null);
    return '<div class="kpis">' +
      kpi("EU storage", finite(s.fill) ? n1(s.fill) + "% full" : null, finite(s.twh) ? Math.round(s.twh).toLocaleString("en-GB") + " TWh" : null, "Gas day " + dayText(eu.last), "#energy/gas") +
      kpi("vs 5-year average", pp(s.vsAvg), finite(s.avg) ? "average " + n1(s.avg) + "%, range " + n1(s.min) + "–" + n1(s.max) + "%" : null, "Gas day " + dayText(eu.last), "#energy/gas") +
      kpi("vs last year", pp(s.vsLy), finite(s.ly) ? "last year " + n1(s.ly) + "%" : null, "Gas day " + dayText(eu.last), "#energy/gas") +
      kpi("7-day change", pp(s.d7), finite(s.d1) ? "1 day " + pp(s.d1) : null, "Gas day " + dayText(eu.last), "#energy/gas") + "</div>";
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

  /* ---------- popover (hover with a mouse, focus with a keyboard, tap on touch) ---------- */
  let POP = null, popFor0 = null, popT = 0;
  let lastPtr = "";
  document.addEventListener("pointerdown", e => { lastPtr = e.pointerType; }, true);
  const canHover = () => lastPtr !== "touch" && lastPtr !== "pen" && !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
  function popEl() {
    if (POP && POP.isConnected) return POP;
    POP = document.createElement("div");
    POP.className = "lp-pop"; POP.setAttribute("role", "dialog"); POP.hidden = true;
    POP.addEventListener("pointerenter", () => clearTimeout(popT));
    POP.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") popT = setTimeout(hidePop, 180); });
    document.body.appendChild(POP);
    return POP;
  }
  function hidePop() { clearTimeout(popT); if (POP) POP.hidden = true; popFor0 = null; }
  function showPop(el) {
    const o = POPS[+el.dataset.pop];
    if (!o) return;
    const P = popEl();
    const a = l => { const u = safeURL(l[1]); if (!u) return ""; const ext = /^https?:/.test(u); return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(l[0]) + (ext ? " ↗" : " →") + "</a>"; };
    P.innerHTML = '<p class="pp-h"><b>' + esc(o.title || "") + "</b>" + (o.value ? " <span>" + esc(o.value) + "</span>" : "") + "</p>" + (o.explain ? '<p class="pp-x">' + esc(o.explain) + "</p>" : "") +
      (o.fresh ? '<p class="pp-f">' + esc(o.fresh) + "</p>" : "") + ((o.links || []).length ? '<p class="pp-l">' + o.links.map(a).join("") + "</p>" : "") + (canHover() ? "" : '<button type="button" class="pp-x-btn" aria-label="Close">×</button>');
    P.hidden = false; popFor0 = el;
    const r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
    P.style.width = w + "px";
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    const below = r.bottom + 6, h = P.offsetHeight;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    P.style.left = left + window.scrollX + "px"; P.style.top = top + window.scrollY + "px";
    const b = P.querySelector(".pp-x-btn"); if (b) b.onclick = hidePop;
  }
  function wirePop(host) {
    host.addEventListener("pointerover", e => {
      if (e.pointerType !== "mouse") return;
      const el = e.target.closest && e.target.closest("[data-pop]");
      if (!el || !host.contains(el) || el === popFor0) return;
      clearTimeout(popT); popT = setTimeout(() => showPop(el), 220);
    });
    host.addEventListener("pointerout", e => {
      if (e.pointerType !== "mouse") return;
      const el = e.target.closest && e.target.closest("[data-pop]");
      if (el && !el.contains(e.relatedTarget) && !(POP && POP.contains(e.relatedTarget))) { clearTimeout(popT); popT = setTimeout(hidePop, 180); }
    });
    host.addEventListener("focusin", e => { const el = e.target.closest && e.target.closest("[data-pop]"); if (el && canHover()) showPop(el); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hidePop(); });
    document.addEventListener("click", e => { if (POP && !POP.hidden && !POP.contains(e.target) && !(popFor0 && popFor0.contains(e.target))) hidePop(); }, true);
    window.addEventListener("scroll", () => { if (POP && !POP.hidden && canHover()) hidePop(); }, { passive: true });
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
  const safeURL = u => (/^(https?:\/\/|\/|#)/.test(String(u || "")) ? String(u) : null);
  /* schema 2: headline, 1-3 findings {headline, body, early, sources}, view (rendered last, in italics) */
  function briefHTML(c) {
    const src = c.source || {};
    const F = (c.findings || []).filter(f => f && f.headline).slice(0, 3);
    const lk = x => { const u = safeURL(x && x.url); return u ? '<a href="' + esc(u) + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(x.label || "source") + "</a>" : ""; };
    return '<section class="block lp-tone lp-brief" id="lpTone"><header class="bh"><p class="kick">The brief</p><p class="asof"><span class="fr cm">Commentary</span> written ' + esc(zurich(c.written_at, true) || "time not given") + "</p></header>" +
      "<h2>" + esc(c.headline) + "</h2>" +
      '<ol class="fds">' + F.map((f, i) => '<li><span class="fd-n">' + (i + 1) + "</span><div><h3>" + esc(f.headline) + (f.early ? ' <span class="fr early">Before prices</span>' : "") + "</h3>" + (f.body ? "<p>" + esc(f.body) + "</p>" : "") +
        (f.sources && f.sources.length ? '<p class="fd-src">' + f.sources.map(lk).filter(Boolean).join(" · ") + "</p>" : "") + "</div></li>").join("") + "</ol>" +
      (c.view ? '<p class="view"><em>' + esc(c.view) + "</em></p>" : "") +
      '<p class="from">Written from the price file of ' + esc(zurich(src.prices_at) || "a time not given") + " and news checks. The prices below are newer." + (safeURL(src.href) ? ' <a href="' + esc(src.href) + '">This morning\'s Pulse →</a>' : "") + "</p></section>";
  }
  function toneHTML(c) {
    if (c && c.headline && (c.schema >= 2 || (c.findings || []).some(f => f && f.headline))) return briefHTML(c);
    if (!c || !c.headline) return '<section class="block lp-tone" id="lpTone"><header class="bh"><h2>Tone of the day</h2></header><p>' + NA + "</p></section>";
    const src = c.source || {};
    const fresh = src.kind && src.kind !== "pulse-edition";
    const views = (c.views || []).map(v => "<p><b>" + esc(v.section) + ".</b> " + esc(v.text) + "</p>").join("");
    return '<section class="block lp-tone" id="lpTone"><header class="bh"><p class="kick">Tone of the day</p>' + stamp("Written " + (zurich(c.written_at, true) || "time not given")) + "</header>" +
      "<h2>" + esc(c.headline) + "</h2>" + (c.tone && !(c.body && c.body[0] && c.body[0].indexOf(c.tone) === 0) ? '<p class="tone">' + esc(c.tone) + "</p>" : "") +
      '<div class="tone-g"><div>' + (c.body && c.body.length ? "<ul>" + c.body.map(b => { const m = /^(.+?[.!?])(\s|$)/.exec(b); return "<li>" + (m ? "<b>" + esc(m[1]) + "</b>" + esc(b.slice(m[1].length)) : esc(b)) + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      (views ? '<aside class="views"><h3>Our view</h3>' + views + "</aside>" : "") + "</div>" +
      (c.risk_label ? '<p class="fnote">' + (fresh ? "Risk gauge when written: " : "Edition risk gauge: ") + esc(c.risk_label) + "</p>" : "") +
      (fresh
        ? '<p class="from">Written fresh for the ' + esc(src.slot || "") + " " + esc(src.edition || "update") + " from live prices" + (src.prices_at ? " (prices " + esc(zurich(src.prices_at) || "") + ")" : "") + " and news checks. Not live: the numbers below are." + (src.href ? ' <a href="' + esc(src.href) + '">Read this morning\'s Pulse →</a>' : "") + "</p></section>"
        : '<p class="from">From the ' + esc(src.edition || "last") + " Pulse email" + (src.sent ? ", sent " + esc(String(src.sent).split(", ").pop()) : "") + ". Not live: the numbers below are." + (src.href ? ' <a href="' + esc(src.href) + '">Read the full edition →</a>' : "") + "</p></section>");
  }
  function riskHTML(by, market) {
    const mk = market;
    const g = riskGauge(by);
    const RL = { vix: "^VIX", spx200: "^GSPC", stoxx200: "^STOXX", us10y: "^TNX", dxy: "DX-Y.NYB", gold: "GC=F", cugold: "HG=F" };
    const rows = g.parts.map(p => {
      const r = by[RL[p.id]], l = p.id === "breadth" ? { href: "#markets/mkt-indices", ext: false } : linkOf(r), lp = p.id === "cugold" ? null : pxu(r);
      const rule = "Gauge rule: " + p.rule + ".";
      const pop = p.id === "breadth" ? { title: p.label, value: p.shown, explain: "How many of the " + BREADTH.length + " tracked equity indices are up on the day. Narrow breadth means a few markets carry the move. " + rule, links: [[pageLab("#markets/mkt-indices"), "#markets/mkt-indices"]] }
        : p.id === "cugold" ? Object.assign(popFor(r, mk && mk.generated_utc) || {}, { title: p.label, value: p.shown, explain: "Copper's move against gold's. Copper outrunning gold reads as growth confidence; gold outrunning copper as caution. " + rule })
        : Object.assign(popFor(r, mk && mk.generated_utc) || { title: p.label, links: [] }, { title: p.label, explain: (EXPLAIN[RL[p.id]] || "") + " " + rule });
      const w = Math.min(50, Math.abs(p.contrib) * 50 / 12.5).toFixed(1);
      return "<tr" + popAttr(pop) + "><th>" + nameLink(p.label, l) + (lp ? ' <span class="lpx">' + esc(lp) + "</span>" : "") + "</th><td>" + esc(p.shown || "") + '</td><td class="cb"><span class="fb"><i class="' + (p.contrib >= 0 ? "up" : "dn") + '" style="' + (p.contrib >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i></span></td><td class="cv ' + (p.contrib > 0 ? "up" : p.contrib < 0 ? "dn" : "") + '">' + (p.contrib > 0 ? "+" : p.contrib < 0 ? "−" : "") + Math.abs(p.contrib).toFixed(1) + "</td></tr>";
    }).join("");
    const method = "<p>Each input is turned into a score from −1 (risk off) to +1 (risk on) and capped there. The gauge is the average score × 100, so it runs from −100 to +100; each row's contribution is its share of that total. Risk on at +25 or above, risk off at −25 or below, mixed in between. Equal weights. Day changes are the live price against the previous close, so a market that has not opened yet counts its last session.</p><ul>" + RISK_METHOD.map(m => "<li><b>" + esc(m[1]) + ":</b> " + esc(m[2]) + "</li>").join("") + "</ul><p>Source: market.json on emmi-data (Yahoo Finance quotes, ~15-minute refresh). An input with no live value is left out, never filled in.</p>";
    return '<section class="block lp-risk" id="lpRisk"><header class="bh"><h2>Risk on / off</h2><span class="bh-r">' + pstamp(market) + '<button type="button" class="info" data-lp-info="lpRiskInfo" aria-expanded="false" aria-controls="lpRiskInfo" aria-label="How the gauge works">i</button></span></header>' +
      '<div class="lp-risk-in"><div class="lp-dialbox">' + dial(g.score) + '<p class="lp-score ' + (g.score >= 25 ? "up" : g.score <= -25 ? "dn" : "") + '">' + (finite(g.score) ? (g.score > 0 ? "+" : g.score < 0 ? "−" : "") + Math.abs(g.score) : "—") + '</p><p class="lp-label">' + esc(g.label || "Not available yet") + "</p></div>" +
      '<div class="lp-parts"><table><thead><tr><th>Input</th><th>Live</th><th class="cb">Contribution</th><th class="cv">pts</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">' + NA + "</td></tr>") + "</tbody></table>" +
      (g.missing.length ? '<p class="fnote">Left out: ' + esc(g.missing.join("; ")) + ".</p>" : "") + "</div></div>" +
      '<div class="info-panel" id="lpRiskInfo" hidden>' + method + "</div></section>";
  }
  function flowHTML(market, by, p) {
    const pick = syms => syms.map(s => by[s]).filter(Boolean).map(r => ({ name: short(r), v: chg(r, p), u: unitOf(r), px: pxu(r), link: linkOf(r), pop: popFor(r, market && market.generated_utc) }));
    const btn = k => '<button type="button" data-lp-period="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>";
    return '<section class="block lp-flow" id="lpFlow"><header class="bh"><h2>Leading and lagging</h2><span class="bh-r">' + pstamp(market) + '<span class="cdl-scale lp-per" role="group" aria-label="Period">' + btn("1D") + btn("1W") + btn("1M") + "</span></span></header>" +
      '<div class="lp-flow-g">' + flowPanel(FLOW.regions.title, pick(FLOW.regions.syms)) + flowPanel("Sectors", sectorRows(market, by, p), "Baskets are equal-weight averages of the covered names in the live file (count in brackets); ETFs as quoted.") + flowPanel(FLOW.commodities.title, pick(FLOW.commodities.syms)) + flowPanel(FLOW.fx.title, pick(FLOW.fx.syms), "Pair moves: EUR/USD up = euro stronger, USD/JPY up = dollar stronger.") + "</div></section>";
  }
  function marketsHTML(market, by) {
    ROWS = []; GEN = market && market.generated_utc;
    const C = window.MMCandles;
    const sw = C ? '<span class="cdl-bar"><span class="cdl-k">Candles</span>' + C.toggle(C.scale()) + "</span>" : "";
    const groups = MONITOR.map(([title, syms, note]) => {
      const rows = syms.map(s => by[s]).filter(Boolean);
      if (!rows.length) return "";
      return '<h3>' + esc(title) + (note ? ' <span class="h3n">' + esc(note) + "</span>" : "") + '</h3><div class="tiles">' + rows.map(tile).join("") + "</div>";
    }).join("");
    return '<section class="block lp-mkts" id="lpMarkets"><header class="bh"><h2>Markets</h2><span class="bh-r">' + pstamp(market) + sw + "</span></header>" + (groups || "<p>" + NA + "</p>") +
      '<p class="fnote">Candles: one per trading day for the last month, or one per month for the last year (this month to date). Green closed at or above its open. Yields whose source publishes closes only keep a grey line. Thin bar = 52-week range of daily closes, tick = now. On a phone the two badges are 1D then 1M (outlined). Each tile says what its price is: <b>Delayed</b> (quote time; Yahoo runs about 15 minutes behind), <b>Close</b> or <b>Last trade</b> (today, market shut or quiet), <b>Prev close</b> (an earlier session) or <b>Official close</b> (central bank or Treasury fix). Hover, or tap on a phone, for the explainer, chart, fundamentals and source. <a href="#markets">All markets →</a></p></section>';
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
    POPS = []; hidePop();
    host.innerHTML = '<div class="lp" id="livePulse"><header class="lp-head"><div><p class="kicker">Briefs</p><h1>Live Pulse</h1><p class="lede">The Pulse, story first, refreshing through the day. Prices are delayed quotes or closes and each one says which; power and gas figures carry their observation date; the brief says when it was written.</p></div><p class="asof lp-upd">Checked ' + esc(zurich(S.loadedAt && S.loadedAt.toISOString()) || "") + ' · refreshes every 5 min · <a href="#briefs">Editions archive</a></p></header>' +
      toneHTML(D.comment) + riskHTML(by, market) + flowHTML(market, by, p) + marketsHTML(market, by) + energyHTML(D.nordic, D.gas) +
      '<section class="block lp-movers" id="lpMovers"><header class="bh"><h2>Coverage movers</h2>' + pstamp(market) + "</header>" + moversHTML(market, p) + "</section>" +
      '<footer class="lp-foot"><p>Sources: The brief, data/live_comment.json (the sent Pulse email at 06:00, then written fresh at 12:00, 15:30 and 22:30). Risk gauge, leading and lagging, markets and movers: market.json on the emmi-data live-data branch (Yahoo Finance quotes, typically about 15 minutes delayed; CNBC for live yield moves; official closes from the US Treasury, Bundesbank, Bank of England and SNB). Nordic power: emmi-data nordic-v2 files (Nord Pool, ENTSO-E, EEX, NVE, ERA5), the same files as Energy. Gas storage: GIE AGSI+ via gas.json. Commentary is market commentary, not investment advice.</p></footer></div>';
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
    const pe = t.closest("[data-pop]");
    if (pe && !canHover() && popFor0 !== pe) { e.preventDefault(); showPop(pe); return; }
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
  function stop() { if (S.timer) clearInterval(S.timer); S.timer = 0; hidePop(); }
  function mount(host) {
    if (!host) return;
    S.host = host;
    S.period = period();
    if (!host._lpWired) { host._lpWired = true; host.addEventListener("click", onClick); wirePop(host); }
    host.innerHTML = '<div class="lp" id="livePulse"><p class="kicker">Briefs</p><h1>Live Pulse</h1><p class="asof">Loading the live files…</p></div>';
    stop();
    load().then(render);
    S.timer = setInterval(tick, EVERY);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.timer && S.loadedAt && Date.now() - S.loadedAt > EVERY) tick(); });
  window.EMMILivePulse = { pops: () => POPS, fresh: fresh, unitText: unitText, mount: mount, stop: stop, riskGauge: riskGauge, index: index, sectorRows: sectorRows, dayAhead: dayAhead, NOT_IN_FEED: NOT_IN_FEED };
})();
