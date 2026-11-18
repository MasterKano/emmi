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
  function kpi(label, value, sub, when, href, sc) {
    const info = KPI_INFO.find(x => x[0].test(label));
    const pa = info ? popAttr({ title: label, value: value, explain: info[2], fresh: when || null, links: [href ? [pageLab(href), href] : null, ["Source: " + info[3][0], info[3][1]]].filter(Boolean) }) : "";
    when = when && info ? '<span class="fr ' + (info[1] === "Observed" ? "ob" : "pc") + '">' + info[1] + "</span> " + esc(when) : esc(when || "");
    return '<div class="kpi"' + pa + (finite(sc) ? ' style="' + tint(sc * 0.35) + '"' : "") + '><span class="kl">' + nameLink(label, href ? { href: href, ext: false } : null) + '</span><span class="kv' + (finite(sc) ? " " + (sc >= 0.05 ? "tkv" : sc <= -0.05 ? "lkv" : "") : "") + '">' + (value == null ? NA : esc(value)) + "</span>" + (sub ? '<span class="ks">' + esc(sub) + "</span>" : "") + (when ? '<span class="kw">' + when + "</span>" : "") + "</div>";
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
  /* ---------- Nordic power: stress gauge, zone heat strip, sparklines against normal, tomorrow's shape ----------
     Positive score = tight (red), negative = loose (blue). Every number comes from the nordic-v2 files; an input
     with no data is left out and listed, never filled in. Normals: zone prices 2021–25, system price 2024–25 (same date ±7 days, Nord Pool),
     generation same 30-day period in earlier years, reservoirs NVE 2006–25 weekly range, weather ERA5 2006–25. */
  const ZONES = ["Nordic", "SE1", "SE2", "SE3", "SE4", "NO1", "NO2", "NO3", "NO4", "NO5", "DK1", "DK2", "FI"];
  const zlab = z => (z === "Nordic" ? "SYS" : z);
  const n0 = v => (finite(v) ? Math.round(v).toLocaleString("en-GB") : null);
  const sg = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d == null ? 1 : d) : null);
  const mean = a => { const f = (a || []).filter(finite); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : null; };
  const lastOf = rows => (rows && rows.length ? rows[rows.length - 1] : null);
  /* background tint for a tight (+) / loose (−) score, safe in both themes */
  const tint = s => (finite(s) && Math.abs(s) >= 0.05 ? "background:color-mix(in srgb," + (s > 0 ? "var(--bad)" : "var(--accent)") + " " + Math.round(8 + Math.min(1, Math.abs(s)) * 30) + "%,var(--panel-deep,var(--panel)))" : "");
  const toneC = s => (finite(s) ? (s >= 0.05 ? "tt" : s <= -0.05 ? "tl" : "tn") : "tn");
  const chip = (txt, s) => (txt ? '<span class="dv ' + toneC(s) + '">' + esc(txt) + "</span>" : "");
  /* Normal for a date: the file's daily normal averaged over ±7 days, because a same-date average of only a
     few years is noisy. Zones use 2021–25; the system price (stored as Nordic) only has 2024–25 on file. */
  const nbasis = z => (z === "Nordic" ? "2024–25" : "2021–25");
  function normalAt(PN, z, ymd) {
    if (!PN || !PN.normal || !PN.month_days || !ymd) return null;
    const md = PN.month_days, a = PN.normal[z], i = md.indexOf(String(ymd).slice(5, 10));
    if (i < 0 || !a) return null;
    const w = [];
    for (let k = -7; k <= 7; k++) { const v = a[(i + k + md.length) % md.length]; if (finite(v)) w.push(v); }
    return w.length >= 10 ? mean(w) : null;
  }
  function tomorrowAvg(T, z) {
    const r = T && T.regions && T.regions[z];
    if (!r || !Array.isArray(r.price) || (r.complete && r.complete.price === false)) return null;
    const f = r.price.filter(finite);
    return f.length >= 23 ? mean(f) : null;
  }
  function weekBand(res, ymd) { const w = isoWeek(ymd), b = res && res.band && res.band.find(x => x[0] === w); return b && finite(b[1]) && finite(b[2]) && finite(b[3]) ? { min: b[1], med: b[2], max: b[3] } : null; }
  function reactorsNow(na) {
    const t = Date.parse(na && na.observed_at) || Date.now();
    return ((na && na.reactors_out) || []).filter(r => finite(r.cap) && finite(r.now) && r.now < r.cap && !(Date.parse(r.start) > t));
  }
  function nordicStress(N) {
    const parts = [], missing = [];
    const put = (id, label, o) => { if (!o || !finite(o.score)) { missing.push(label); return; } parts.push(Object.assign({ id: id, label: label }, o, { score: clamp(o.score) })); };
    const P = N && N.prices, PN = N && N.normals, G = (N && N.generation) || {};
    /* 1 system price vs its 2024–25 normal for the date */
    const pr = lastOf(P && P.regions && P.regions.Nordic && P.regions.Nordic.rows), pn = pr && normalAt(PN, "Nordic", pr[0]);
    const price = (pr && finite(pr[1]) && finite(pn) && pn > 0) ? { value: pr[1], normal: pn, dev: (pr[1] / pn - 1) * 100, score: (pr[1] / pn - 1), shown: n1(pr[1]) + " €/MWh", chipT: sg((pr[1] / pn - 1) * 100, 0) + "%", when: ["Delivery", dayText(pr[0])], cause: "system price " + Math.abs(Math.round((pr[1] / pn - 1) * 100)) + "% " + (pr[1] >= pn ? "above" : "below") + " normal", rule: "% above the 2024–25 normal for the date (±7-day average; the official system price is on file only from 2024); +100% scores fully tight." } : null;
    /* 2 Norwegian reservoirs vs NVE median for the week */
    const no = N && N.hydrology && N.hydrology.reservoirs && N.hydrology.reservoirs.NO, nr = lastOf(no && no.rows), nb = nr && weekBand(no, nr[0]);
    put("res", "Reservoirs", nr && finite(nr[1]) && nb ? { value: nr[1], normal: nb.med, dev: nr[1] - nb.med, score: -(nr[1] - nb.med) / 10, shown: n1(nr[1]) + "% NO", chipT: sg(nr[1] - nb.med) + " pp", when: ["Observed", "week of " + dayText(nr[0])], cause: "Norwegian reservoirs " + Math.abs(nr[1] - nb.med).toFixed(1) + " pp " + (nr[1] < nb.med ? "below" : "above") + " median", rule: "pp below the NVE 2006–25 median for the week; 10 pp below scores fully tight." } : null);
    /* 3 nuclear online now vs normal output for the same period of earlier years */
    const na = G.nuclear_availability || {}, on = Object.values(na.online_mw || {}).filter(finite).reduce((a, b) => a + b, 0);
    const nu = lastOf((((G.regions || {}).Nordic || {}).metrics || {}).nuclear && G.regions.Nordic.metrics.nuclear.rows), nn = nu && nu[3];
    const outs = reactorsNow(na), off = outs.filter(r => r.now === 0).length, red = outs.length - off;
    put("nuc", "Nuclear", on > 0 && finite(nn) && nn > 0 ? { value: on, normal: nn, dev: (on / nn - 1) * 100, score: -(on / nn - 1) / 0.3, shown: (on / 1000).toFixed(1) + " GW", chipT: sg((on / nn - 1) * 100, 0) + "%", when: ["Observed", zurich(na.observed_at, true) || dayText(na.as_of)], cause: "nuclear " + Math.abs(Math.round((on / nn - 1) * 100)) + "% " + (on < nn ? "below" : "above") + " normal" + (off ? " (" + off + " reactor" + (off > 1 ? "s" : "") + " out" + (red ? ", " + red + " reduced" : "") + ")" : ""), rule: "online SE + FI capacity against normal output for the same 30 days of earlier years; 30% short scores fully tight." } : null);
    /* 4 wind load factor, 30 days vs the same period in earlier years */
    const wl = lastOf((((G.regions || {}).Nordic || {}).metrics || {}).wind_load_factor && G.regions.Nordic.metrics.wind_load_factor.rows);
    put("wind", "Wind 30d", wl && finite(wl[2]) && finite(wl[3]) ? { value: wl[2], normal: wl[3], dev: wl[2] - wl[3], score: -(wl[2] - wl[3]) / 10, shown: n1(wl[2]) + "% LF", chipT: sg(wl[2] - wl[3]) + " pp", when: ["Observed", "to " + dayText(wl[0])], cause: "wind " + Math.abs(wl[2] - wl[3]).toFixed(1) + " pp " + (wl[2] >= wl[3] ? "above" : "below") + " normal", rule: "30-day wind load factor against the same period of earlier years; 10 pp short scores fully tight." } : null);
    /* 5 temperature, 30 days vs normal */
    const tm = (((N && N.weather && N.weather.regions && N.weather.regions.Nordic) || {}).metrics || {}).temp, tr = lastOf(tm && tm.rows);
    put("temp", "Temp 30d", tr && finite(tr[2]) && finite(tr[4]) ? { value: tr[2], normal: tr[4], dev: tr[2] - tr[4], score: -(tr[2] - tr[4]) / 3, shown: n1(tr[2]) + " °C", chipT: sg(tr[2] - tr[4]) + " °C", when: ["Observed", "to " + dayText(tr[0])], cause: Math.abs(tr[2] - tr[4]).toFixed(1) + " °C " + (tr[2] >= tr[4] ? "milder" : "colder") + " than normal", rule: "30-day temperature against the ERA5 2006–25 normal; 3 °C colder scores fully tight (heating demand)." } : null);
    if (parts.length < 3) return { score: null, label: null, parts: parts, missing: missing, cause: null, price: price };
    const score = Math.round(mean(parts.map(p => p.score)) * 100);
    const label = score >= 25 ? "Tight" : score <= -25 ? "Loose" : "Balanced";
    const pos = parts.filter(p => p.score >= 0.2).sort((a, b) => b.score - a.score), neg = parts.filter(p => p.score <= -0.2).sort((a, b) => a.score - b.score);
    const list = a => a.map(p => p.cause).join(", ");
    let cause;
    if (label === "Tight") cause = "Tight: " + list(pos.slice(0, 3)) + (neg.length ? "; offset by " + list(neg.slice(0, 2)) : "") + ".";
    else if (label === "Loose") cause = "Loose: " + list(neg.slice(0, 3)) + (pos.length ? "; offset by " + list(pos.slice(0, 2)) : "") + ".";
    else cause = "Balanced" + (pos.length || neg.length ? ": " + [pos.length ? list(pos.slice(0, 2)) + " pull tight" : "", neg.length ? list(neg.slice(0, 2)) + " pull loose" : ""].filter(Boolean).join("; ") : "") + ".";
    return { score: score, label: label, parts: parts, missing: missing, cause: cause.charAt(0).toUpperCase() + cause.slice(1), price: price };
  }
  /* "What changed": the newest moves, each with its own date. */
  function nordicChanges(N, today) {
    const out = [], P = N && N.prices, T = N && N.tomorrow;
    const pr = lastOf(P && P.regions && P.regions.Nordic && P.regions.Nordic.rows), ta = tomorrowAvg(T, "Nordic");
    if (pr && finite(pr[1]) && finite(ta) && T.delivery_date > pr[0]) out.push("system price for " + dayText(T.delivery_date) + " " + n1(ta) + " €/MWh, " + sg((ta / pr[1] - 1) * 100, 0) + "% on " + dayText(pr[0]));
    const no = N && N.hydrology && N.hydrology.reservoirs && N.hydrology.reservoirs.NO, rr = no && no.rows;
    if (rr && rr.length > 1 && finite(rr[rr.length - 1][1]) && finite(rr[rr.length - 2][1])) out.push("Norway reservoirs " + sg(rr[rr.length - 1][1] - rr[rr.length - 2][1]) + " pp in the week to " + dmy(rr[rr.length - 1][0]));
    return out;
  }
  /* 30-day sparkline: daily series, dashed normal, the gap shaded red where tight and blue where loose. */
  function spark(pts, tightAbove) {
    const p = (pts || []).filter(x => finite(x[1]));
    if (p.length < 5) return "";
    const W = 120, H = 34, vals = [];
    p.forEach(x => { vals.push(x[1]); if (finite(x[2])) vals.push(x[2]); });
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const X = i => (i * W / (p.length - 1)).toFixed(1), Y = v => (H - 2 - (v - lo) / (hi - lo) * (H - 4)).toFixed(1);
    let gap = "";
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      if (!finite(a[2]) || !finite(b[2])) continue;
      const d = (a[1] - a[2]) + (b[1] - b[2]);
      if (!d) continue;
      gap += '<polygon class="' + (tightAbove == null ? "gn" : (d > 0) === tightAbove ? "gt" : "gl") + '" points="' + X(i) + "," + Y(a[1]) + " " + X(i + 1) + "," + Y(b[1]) + " " + X(i + 1) + "," + Y(b[2]) + " " + X(i) + "," + Y(a[2]) + '"/>';
    }
    const line = k => p.map((x, i) => (finite(x[k]) ? X(i) + "," + Y(x[k]) : null)).filter(Boolean).join(" ");
    const nl = p.some(x => finite(x[2])) ? '<polyline class="nl" points="' + line(2) + '"/>' : "";
    return '<svg class="nsp" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' + gap + nl + '<polyline class="sl" points="' + line(1) + '"/></svg>';
  }
  const tagFr = (w, cls) => (w ? '<span class="kw"><span class="fr ' + (cls || (w[0] === "Observed" ? "ob" : "pc")) + '">' + esc(w[0]) + "</span> " + esc(w[1] || "") + "</span>" : "");
  function ncard(o) {
    const pa = popAttr({ title: o.title, value: o.value, explain: o.explain, fresh: o.when ? o.when.join(" ") : null, links: [o.href ? [pageLab(o.href), o.href] : null, o.src ? ["Source: " + o.src[0], o.src[1]] : null].filter(Boolean) });
    return '<div class="kpi ncard' + (o.wide ? " kpi-w" : "") + '"' + pa + (o.s != null ? ' style="' + tint(o.s * 0.35) + '"' : "") + '><span class="kl">' + nameLink(o.title, o.href ? { href: o.href, ext: false } : null) + '</span>' + (o.novalue ? "" : '<span class="kv">' + (o.value == null ? NA : esc(o.value)) + " " + chip(o.chipT, o.s) + "</span>") + (o.sub ? '<span class="ks">' + esc(o.sub) + "</span>" : "") + (o.body || "") + tagFr(o.when) + "</div>";
  }
  function nordicHTML(N, zday) {
    if (!N || !N.prices) return "<p>" + NA + "</p>";
    const P = N.prices, PN = N.normals, T = N.tomorrow, G = N.generation || {};
    const st = nordicStress(N), out = [];
    /* stress gauge */
    const pos = finite(st.score) ? 50 + st.score / 2 : null;
    const pc = st.price ? '<span class="nin npx" style="' + tint(clamp(st.price.score)) + '"' + popAttr({ title: "System price", value: st.price.shown, explain: "Shown for context, not part of the balance score (the score uses supply drivers only). " + sg(st.price.dev, 0) + "% against the 2024–25 normal for the date (" + n1(st.price.normal) + " €/MWh, ±7-day average).", fresh: st.price.when.join(" "), links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]]] }) + ' tabindex="0"><b>Price</b> ' + esc(st.price.shown) + "</span>" : "";
    const chips = pc + st.parts.map(p => '<span class="nin" style="' + tint(p.score) + '"' + popAttr({ title: p.label, value: p.shown, explain: "Scores " + (p.score > 0 ? "+" : "") + p.score.toFixed(2) + " (tight +1, loose −1): " + p.rule, fresh: p.when.join(" "), links: ({ price: [["#energy/prices", NP]], res: [["#energy/hydro", ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"]]], nuc: [["#energy/generation", ENTSOE]], wind: [["#energy/generation", ENTSOE]], temp: [["#energy/weather", ERA5]] }[p.id] || []).reduce((l, x) => l.concat([[pageLab(x[0]), x[0]], ["Source: " + x[1][0], x[1][1]]]), []) }) + ' tabindex="0"><b>' + esc(p.label) + "</b> " + esc(p.shown) + " " + chip(p.chipT, p.score) + "</span>").join("");
    const big = st.parts.length ? reactorsNow(G.nuclear_availability).filter(r => r.planned === false).sort((a, b) => (b.cap - b.now) - (a.cap - a.now))[0] : null;
    const ch = nordicChanges(N);
    out.push('<div class="nstress"' + popAttr({ title: "Nordic balance", explain: "Four supply drivers (reservoirs, nuclear, wind, temperature), each scored from −1 (loose) to +1 (tight) against its normal and averaged; ±25 or beyond reads tight or loose. Price is not scored: it is the outcome. Inputs with no data are left out." + (st.missing.length ? " Left out: " + st.missing.join(", ") + "." : ""), fresh: "Each input shows its own date", links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]], ["Source: NVE reservoirs", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"], ["Source: " + ENTSOE[0], ENTSOE[1]]] }) + ">" +
      '<div class="nsg"><div class="nsh"><span class="kl">Nordic balance</span><span class="nss ' + (st.label === "Tight" ? "tt" : st.label === "Loose" ? "tl" : "tn") + '">' + (finite(st.score) ? (st.score > 0 ? "+" : st.score < 0 ? "−" : "") + Math.abs(st.score) + " " + esc(st.label) : "Not enough inputs") + "</span></div>" +
      '<div class="nbar"><i class="nbl"></i><i class="nbt"></i>' + (finite(pos) ? '<b style="left:' + pos.toFixed(1) + '%"></b>' : "") + '</div><div class="nbk"><span>Loose</span><span>Normal</span><span>Tight</span></div></div>' +
      '<div class="nsc">' + (st.cause ? '<p class="ncause">' + esc(st.cause) + "</p>" : "") +
      (ch.length ? '<p class="nchg"><b>What changed:</b> ' + esc(ch.join("; ")) + ".</p>" : "") +
      (big ? '<p class="nout"><span class="dv tt">Unplanned</span> Largest unplanned outage: <b>' + esc(big.n) + "</b> " + esc(n0(big.cap - big.now)) + " MW off" + (big.back ? ", expected back " + esc(zurich(big.back, true)) : "") + ' <span class="kw">(nuclear only; UMM via ENTSO-E)</span></p>' : '<p class="nout"><span class="kw">No unplanned nuclear outage reported (nuclear is the only outage feed here).</span></p>') +
      "</div></div>" + '<div class="nins">' + chips + "</div>" + (st.missing.length ? '<p class="fnote">Left out of the balance: ' + esc(st.missing.join(", ")) + " (no data).</p>" : ""));
    /* zone heat strip */
    const today = lastOf(P.regions && P.regions.Nordic && P.regions.Nordic.rows), d0 = today && today[0];
    const hasNext = T && T.delivery_date && d0 && T.delivery_date > d0 && finite(tomorrowAvg(T, "Nordic"));
    const useNext = zday === "next" && hasNext, dd = useNext ? T.delivery_date : d0;
    const val = z => (useNext ? tomorrowAvg(T, z) : (() => { const r = lastOf(P.regions[z] && P.regions[z].rows); return r && r[0] === d0 && finite(r[1]) ? r[1] : null; })());
    const sys = val("Nordic");
    const cells = ZONES.map(z => {
      const v = val(z), n = normalAt(PN, z, dd), dv = finite(v) && finite(n) && n > 0 ? (v / n - 1) * 100 : null, spr = z !== "Nordic" && finite(v) && finite(sys) ? v - sys : null;
      return '<a class="nz" href="#energy/prices" style="' + tint(finite(dv) ? dv / 100 : null) + '"' + popAttr({ title: zlab(z) + " day-ahead", value: finite(v) ? n1(v) + " €/MWh" : null, explain: (finite(n) ? "Normal for the date (" + nbasis(z) + ", ±7-day average) " + n1(n) + " €/MWh" + (finite(dv) ? ", " + sg(dv, 0) + "%" : "") + ". " : "No normal for this zone. ") + (finite(spr) ? "Spread to the system price " + sg(spr) + " €/MWh: a gap shows grid congestion." : "The system price is the unconstrained Nordic reference."), fresh: "Delivery " + dayText(dd) + (useNext ? " (published by Nord Pool, average of the hourly prices)" : ""), links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]]] }) + '><span class="zn">' + esc(zlab(z)) + '</span><span class="zv">' + (finite(v) ? esc(n0(v)) : "–") + '</span><span class="zs">' + (z === "Nordic" ? "system" : finite(spr) ? esc(sg(spr, 0)) : "") + "</span></a>";
    }).join("");
    const btn = (k, t) => '<button type="button" data-lp-zday="' + k + '" aria-pressed="' + ((k === "next") === !!useNext) + '"' + (k === "next" && !hasNext ? " disabled" : "") + ">" + t + "</button>";
    out.push('<div class="nzh"><span class="kl">Day-ahead by zone, €/MWh · colour = against normal for the date (zones 2021–25, SYS 2024–25) · small figure = spread to the system price</span><span class="cdl-scale" role="group" aria-label="Delivery day">' + btn("today", d0 ? dayText(d0) : "Today") + btn("next", hasNext ? dayText(T.delivery_date) : "Next day") + '</span></div><div class="nzs">' + cells + "</div>" + tagFr(["Delivery", dayText(dd) + (useNext ? " · average of Nord Pool's hourly prices" : "")]).replace('class="kw"', 'class="kw nzw"'));
    /* cards */
    const cards = [];
    const sp = st.parts.reduce((o, p) => (o[p.id] = p, o), { price: st.price });
    const pr = P.regions.Nordic.rows.slice(-30).map(r => [r[0], r[1], normalAt(PN, "Nordic", r[0])]);
    cards.push(ncard({ title: "System price", value: sp.price ? sp.price.shown : null, chipT: null, s: sp.price && clamp(sp.price.score), sub: sp.price ? "normal " + n1(sp.price.normal) + " · 30-day avg " + n1(mean(pr.map(x => x[1]))) : null, body: spark(pr, true), when: sp.price && sp.price.when, href: "#energy/prices", src: NP, explain: (sp.price ? sg(sp.price.dev, 0) + "% against normal. " : "") + "Nord Pool system price, daily average, last 30 days. Dashed line: normal for each date, 2024–25 (±7-day average; the official system price is on file only from 2024). Red shading where above normal, blue where below." }));
    const M = ((G.regions || {}).Nordic || {}).metrics || {};
    const gser = (m, d) => ((M[m] && M[m].rows) || []).slice(-30).map(r => [r[0], r[1], r[3]]);
    const gl = (m) => lastOf(M[m] && M[m].rows);
    const nuc = sp.nuc, nr = gl("nuclear");
    cards.push(ncard({ title: "Nuclear", value: nuc ? nuc.shown + " online" : null, chipT: nuc && nuc.chipT, s: nuc && nuc.score, sub: nuc ? "normal output " + (nuc.normal / 1000).toFixed(1) + " GW (same period, earlier years)" : null, body: spark(gser("nuclear"), false), when: nuc && nuc.when, href: "#energy/generation", src: ENTSOE, explain: "SE + FI nuclear. Line: daily output, last 30 days; dashed: same 30 days in earlier years. The headline is capacity online now, from the outage messages." }));
    const hy = gl("hydro"), hs = hy && finite(hy[2]) && finite(hy[3]) ? (hy[2] / hy[3] - 1) : null;
    cards.push(ncard({ title: "Hydro output", value: hy && finite(hy[1]) ? n0(hy[1]) + " MW" : null, chipT: finite(hs) ? sg(hs * 100, 0) + "% 30d" : null, s: null, sub: hy && finite(hy[3]) ? "30-day " + n0(hy[2]) + " vs normal " + n0(hy[3]) + " MW" : null, body: spark(gser("hydro"), null), when: hy && ["Observed", "day " + dayText(hy[0])], href: "#energy/generation", src: ENTSOE, explain: "Nordic hydro output, daily average. Not coloured: high output can mean ample water or producers running hard at high prices. Dashed: same 30 days in earlier years." }));
    const w = sp.wind, wl = gl("wind_load_factor");
    cards.push(ncard({ title: "Wind", value: wl && finite(wl[1]) ? n1(wl[1]) + "% load factor" : null, chipT: w && w.chipT + " 30d", s: w && w.score, sub: w ? "30-day " + n1(w.value) + "% vs normal " + n1(w.normal) + "%" : null, body: spark(gser("wind_load_factor"), false), when: wl && ["Observed", "day " + dayText(wl[0])], href: "#energy/generation", src: ENTSOE, explain: "Nordic wind output as a share of installed capacity. Below normal (red) means less cheap supply. Dashed: same 30 days in earlier years." }));
    const tm = (((N.weather || {}).regions || {}).Nordic || {}).metrics || {}, tt = sp.temp, cov = (N.weather || {}).coverage || {};
    const tsr = ((tm.temp && tm.temp.rows) || []).slice(-30).map(r => [r[0], r[1], r[3]]), tl = lastOf(tsr);
    cards.push(ncard({ title: "Temperature", value: tl && finite(tl[1]) ? n1(tl[1]) + " °C" : null, chipT: tt && tt.chipT + " 30d", s: tt && tt.score, sub: tt ? "30-day " + n1(tt.value) + " vs normal " + n1(tt.normal) + " °C" : null, body: spark(tsr, false), when: tl && ["Observed", "to " + dayText(tl[0]) + (cov.forecast_from ? " · forecast fill from " + dmy(cov.forecast_from) : "")], href: "#energy/weather", src: ERA5, explain: "Nordic land-area temperature, daily. Colder than normal (red) means more heating demand. ERA5 runs about five days behind; the last days are Open-Meteo forecast until ERA5 catches up." }));
    /* reservoir gauge vs the published range */
    const R = (N.hydrology || {}).reservoirs || {};
    const rbar = (k, lab, u) => {
      const r = R[k], x = lastOf(r && r.rows), b = x && weekBand(r, x[0]);
      if (!x || !b || !finite(x[1])) return "";
      const lo = Math.min(b.min, x[1]), hi = Math.max(b.max, x[1]), sc = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(1);
      const s = -(x[1] - b.med) / (u === "%" ? 10 : b.med * 0.15);
      return '<div class="nres"><span class="nrl"><b>' + esc(lab) + "</b> " + esc(n1(x[1]) + (u === "%" ? "%" : " TWh")) + " " + chip(sg(x[1] - b.med) + (u === "%" ? " pp" : " TWh"), s) + '</span><span class="nrb"><i class="rng" style="left:' + sc(b.min) + "%;right:" + (100 - sc(b.max)) + '%"></i><i class="med" style="left:' + sc(b.med) + '%"></i><b class="' + toneC(s) + '" style="left:' + sc(x[1]) + '%"></b></span><span class="kw">' + esc("wk of " + dmy(x[0]) + " · range " + n1(b.min) + "–" + n1(b.max)) + "</span></div>";
    };
    const rres = rbar("NO", "Norway", "%") + rbar("SE", "Sweden", "TWh") + rbar("FI", "Finland", "TWh");
    cards.push(ncard({ title: "Reservoirs vs range", novalue: true, body: rres || "<span class=\"na\">Not available yet</span>", when: R.NO && ["Observed", "weekly, latest " + dayText(lastOf(R.NO.rows)[0])], href: "#energy/hydro", src: ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"], explain: "Reservoir filling against the published range for the same week: shaded band = min to max, tick = median (Norway: NVE 2006–25; Sweden and Finland: ENTSO-E 2015–25, TWh). Below median is red." }));
    /* tomorrow's hourly shape */
    const tp = T && T.regions && T.regions.Nordic && Array.isArray(T.regions.Nordic.price) ? T.regions.Nordic.price : null;
    if (tp && tp.filter(finite).length >= 23) {
      const f = tp.filter(finite), mx = Math.max.apply(null, f), mn = Math.min.apply(null, f), base = Math.min(0, mn);
      const hrs = (T.hours || []).map(h => String(h).slice(11, 16));
      const iMx = tp.indexOf(mx), iMn = tp.indexOf(mn);
      const bars = tp.map((v, i) => finite(v) ? '<i class="' + (i === iMx ? "pk" : i === iMn ? "tr" : "") + '" style="height:' + (6 + (v - base) / (mx - base || 1) * 94).toFixed(1) + '%" title="' + esc((hrs[i] || i) + " " + n1(v) + " €/MWh") + '"></i>' : "<i></i>").join("");
      const dn = normalAt(PN, "Nordic", T.delivery_date), av = mean(f);
      cards.push(ncard({ title: "System price by hour, " + dayText(T.delivery_date), wide: true, value: n1(av) + " €/MWh average", chipT: null, s: finite(dn) ? clamp(av / dn - 1) : null, body: '<div class="nhr">' + bars + '</div><div class="nhk"><span>' + esc(hrs[0] || "00:00") + '</span><span><b class="pk">Peak</b> ' + esc(n0(mx)) + " at " + esc(hrs[iMx] || "") + ' · <b class="tr">Trough</b> ' + esc(n0(mn)) + " at " + esc(hrs[iMn] || "") + "</span><span>" + esc(hrs[hrs.length - 1] || "23:00") + "</span></div>", when: ["Delivery", dayText(T.delivery_date) + " · published " + (zurich(T.built_at, true) || dayText(T.as_of))], href: "#energy/prices", src: NP, explain: (finite(dn) ? "Day average " + sg((av / dn - 1) * 100, 0) + "% against the 2024–25 normal (" + n1(dn) + " €/MWh). " : "") + "Hourly Nordic system prices from Nord Pool's day-ahead auction, Zurich time. A sharp morning or evening peak usually means low wind or tight transmission in those hours." }));
    }
    /* futures vs the monthly normal (only 2 years of official SYS monthly history, so it is labelled) */
    const fw = P.futures || {};
    ["front_month", "next_quarter"].forEach(k => {
      const x = fw[k] || {}, v = ((x.regions || {}).Nordic || {}), c = x.contract || "";
      const DN = PN && PN.normal && PN.normal.Nordic, MD = (PN && PN.month_days) || [], mo = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
      let ms = [];
      const m1 = /^([A-Z][a-z]{2})-/.exec(c), q = /^Q([1-4])-/.exec(c);
      if (m1 && mo[m1[1]]) ms = [mo[m1[1]]]; else if (q) ms = [1, 2, 3].map(i => String((+q[1] - 1) * 3 + i).padStart(2, "0"));
      const nm = DN && ms.length ? mean(MD.map((d, i) => (ms.indexOf(d.slice(0, 2)) >= 0 ? DN[i] : null))) : null;
      const dv = finite(v.p) && finite(nm) && nm > 0 ? v.p / nm - 1 : null;
      cards.push(ncard({ title: "Nordic " + (c || (k === "front_month" ? "front month" : "next quarter")), value: finite(v.p) ? n1(v.p) + " €/MWh" : null, chipT: null, s: finite(dv) ? clamp(dv) : null, sub: [finite(nm) ? "normal " + n1(nm) + " (2024–25)" : null, finite(v.d1) ? "1D " + sg(v.d1, 2) + " €" : null].filter(Boolean).join(" · ") || null, when: x.as_of ? ["Settle", "EEX " + dayText(x.as_of)] : null, href: "#energy/prices", src: ["EEX power futures", "https://www.eex.com/en/market-data/power/futures"], explain: (finite(dv) ? sg(dv * 100, 0) + "% against normal. " : "") + "EEX Nordic base-load futures settlement: the market's expected average system price for the period, against the same months' system price in 2024–25 (the only years Nord Pool publishes free)." }));
    });
    out.push('<div class="kpis ncards">' + cards.join("") + "</div>");
    return out.join("");
  }
  function gasHTML(gas) {
    const eu = gas && gas.areas && gas.areas.EU;
    const s = eu && eu.s;
    if (!s) return "<p>" + NA + "</p>";
    const pp = v => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pp" : null);
    return '<div class="kpis">' +
      kpi("EU storage", finite(s.fill) ? n1(s.fill) + "% full" : null, finite(s.twh) ? Math.round(s.twh).toLocaleString("en-GB") + " TWh" : null, "Gas day " + dayText(eu.last), "#energy/gas") +
      kpi("vs 5-year average", pp(s.vsAvg), finite(s.avg) ? "average " + n1(s.avg) + "%, range " + n1(s.min) + "–" + n1(s.max) + "%" : null, "Gas day " + dayText(eu.last), "#energy/gas", finite(s.vsAvg) ? clamp(-s.vsAvg / 15) : null) +
      kpi("vs last year", pp(s.vsLy), finite(s.ly) ? "last year " + n1(s.ly) + "%" : null, "Gas day " + dayText(eu.last), "#energy/gas", finite(s.vsLy) ? clamp(-s.vsLy / 15) : null) +
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
  const S = { host: null, timer: 0, data: {}, period: "1D", zday: "today", loadedAt: null, open: false };
  function period() { try { const v = localStorage.getItem("emmaLivePeriod"); return ["1D", "1W", "1M"].includes(v) ? v : "1D"; } catch (e) { return "1D"; } }
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null); }
  async function load() {
    const t5 = Math.floor(Date.now() / EVERY), th = Math.floor(Date.now() / 36e5);
    const [market, gas, comment, prices, generation, hydrology, weather, normals, tomorrow] = await Promise.all([
      getJSON("data/market.json?t=" + t5), getJSON("data/gas.json?t=" + th), getJSON("data/live_comment.json?t=" + t5),
      getJSON(NV2 + "prices.json?t=" + th), getJSON(NV2 + "generation.json?t=" + th), getJSON(NV2 + "hydrology.json?t=" + th), getJSON(NV2 + "weather.json?t=" + th),
      getJSON(NV2 + "prices_normals.json?t=" + th), getJSON(NV2 + "tomorrow.json?t=" + th)
    ]);
    S.data = { market, gas, comment, nordic: prices ? { prices, generation, hydrology, weather, normals, tomorrow } : null };
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
    const nv = N && N.prices && N.prices.built_at ? "Power files built " + (zurich(N.prices.built_at, true) || "") : null;
    return '<section class="block lp-energy" id="lpEnergy"><header class="bh"><h2>Energy</h2>' + stamp(nv) + '</header><h3>Nordic power <a class="h3n" href="#energy/nordic">Open Nordic power →</a></h3>' + nordicHTML(N, S.zday) +
      '<h3>EU gas storage <a class="h3n" href="#energy/gas">Open gas storage →</a></h3>' + gasHTML(gas) + '<p class="fnote">Colour = distance from normal: red where supply is tighter or prices higher than usual, blue where looser or lower; deeper colour = further from normal. Normals: zone prices 2021–25 and system price 2024–25, same date ±7 days; generation, the same 30 days of earlier years (never month-on-month); reservoirs, the published weekly range; weather, ERA5 2006–25. Each figure prints its own date. Day-ahead prices are published around 13:00 for the next day; ERA5 weather runs about five days behind; reservoirs are weekly.</p></section>';
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
    const zd = t.closest("[data-lp-zday]");
    if (zd) { if (!zd.disabled) { S.zday = zd.dataset.lpZday; render(); } return; }
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
  window.EMMILivePulse = { pops: () => POPS, fresh: fresh, unitText: unitText, mount: mount, stop: stop, riskGauge: riskGauge, index: index, sectorRows: sectorRows, dayAhead: dayAhead, nordicStress: nordicStress, nordicChanges: nordicChanges, NOT_IN_FEED: NOT_IN_FEED };
})();
