/* EMMi shared kit (window.EMMIKit): the Live Pulse presentation patterns, shared by every page that shows prices.
   - prices with their unit beside the name, and a freshness tag on every value (Delayed / Close / Prev / Official)
   - each name links to its best EMMi page; hover (mouse) or tap (touch) cards give the explainer and chart,
     EMMi page and source links
   - compact market tiles (4 across on a phone) that open a detail sheet: chart with the 1M/1Y switch, then sector
     performance and the largest members for equity indices (data/index_detail.json)
   - return to place: leaving a page through an internal link saves the scroll position; Back or the
     "← Back to …" pill restores it
   - i-notes: explanatory, legend and method footnotes sit behind a small i button; short action links stay visible
   Presentation only. Null is "Not available yet", never zero or a guess. Moved out of livepulse.js (t1411u). */
(function () {
  "use strict";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NA = '<span class="na">Not available yet</span>';
  const safeURL = u => (/^(https?:\/\/|\/|#)/.test(String(u || "")) ? String(u) : null);

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
  function zurichDay(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date()); }

  /* ---------- registries: one per page ("lp" Live Pulse, "mkt" Markets, ...). data-pop="ns:i", data-kt="ns:i" ---------- */
  const REGS = {};
  function reg(ns) {
    if (REGS[ns]) return REGS[ns];
    const R = { ns: ns, pops: [], rows: [], gen: null };
    R.reset = () => { R.pops = []; R.rows = []; };
    R.pop = o => (o ? ' data-pop="' + ns + ":" + (R.pops.push(o) - 1) + '"' : "");
    R.row = r => ' data-kt="' + ns + ":" + (R.rows.push(r) - 1) + '"';
    REGS[ns] = R;
    return R;
  }
  const lookup = (key, kind) => { const m = /^([\w-]+):(\d+)$/.exec(String(key || "")); const R = m && REGS[m[1]]; return R ? R[kind][+m[2]] : null; };

  /* ---------- market rows ---------- */
  let LASTBY = {};   /* t1443u: the latest live rows, so the index sheet's sector table reads live sector-ETF moves */
  function index(market) {
    const by = {};
    ((market && market.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(r => {
      if (r && r.sym && !by[r.sym]) by[r.sym] = Object.assign({ _group: g.id, _section: s.label || null }, r);
    })));
    if (by.XLK || by["EXV1.DE"]) LASTBY = by;
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
  const DEEP = { "BZ=F": "#energy/oil/ogCurves", "HO=F": "#energy/oil/ogCurves", "CL=F": "#energy/oil", "NG=F": "#energy/oil", "TTF=F": "#energy/gas/gsSecPx", "GC=F": "#markets/metals/mtPx", "SI=F": "#markets/metals/mtPx", "PL=F": "#markets/metals/mtPx", "PA=F": "#markets/metals/mtPx", "HG=F": "#markets/metals/mtPx", "ALI=F": "#markets/metals/mtPx" };
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
  const SHORT = { "Brent crude Jan-27": "Brent", "WTI crude Dec-26": "WTI", "NY Harbor diesel (ULSD) Dec-26": "Diesel (ULSD)", "Henry Hub gas Dec-26": "Henry Hub", "Dutch TTF gas Dec-26": "TTF gas", "Gold Dec-26": "Gold", "Silver Dec-26": "Silver", "Copper (COMEX) Dec-26": "Copper", "Platinum Jan-27": "Platinum", "Sprott Physical Uranium": "Uranium (SPUT)", "EU carbon (EUA ETC)": "EU carbon", "STOXX Europe 600": "STOXX 600", "Oslo Børs Benchmark": "Oslo OSEBX", "OMX Stockholm 30": "OMX S30", "OMX Copenhagen 25": "OMX C25", "OMX Helsinki 25": "OMX H25", "Nasdaq Composite": "Nasdaq", "US Dollar Index": "Dollar index" };
  const SHORT_SYM = { "UST:2Y": "US 2Y", "NYFED:SOFR": "SOFR", "NB:TBIL3M": "NIBOR 3m*", "CNBC:JP10Y-JP": "JGB 10Y", "PBOC:LPR1Y": "PBoC 1Y LPR", "000300.SS": "CSI 300",
    "^TNX": "US 10Y", "^TYX": "US 30Y", "CNBC:DE10Y-DE": "Bund 10Y", "CNBC:GB10Y-GB": "Gilt 10Y", "CNBC:CH10Y-CH": "Swiss 10Y",
    "BZ=F": "Brent", "CL=F": "WTI", "HO=F": "Diesel", "RB=F": "RBOB", "NG=F": "Henry Hub", "TTF=F": "TTF",
    "GC=F": "Gold", "SI=F": "Silver", "PL=F": "Platinum", "PA=F": "Palladium", "HG=F": "Copper", "ALI=F": "Aluminium",
    "KC=F": "Coffee", "CC=F": "Cocoa", "SB=F": "Sugar", "CT=F": "Cotton", "OJ=F": "Orange juice", "LBR=F": "Lumber",
    "ZW=F": "Wheat", "ZC=F": "Corn", "ZS=F": "Soybeans", "ZL=F": "Soy oil", "ZM=F": "Soy meal", "ZO=F": "Oats", "ZR=F": "Rice",
    "LE=F": "Cattle", "HE=F": "Lean hogs", "GF=F": "Feeders", "U-UN.TO": "Uranium", "CO2.L": "EU carbon" };
  const short = r => SHORT_SYM[r.sym] || SHORT[r.name] || r.name;
  /* t1441u (20 Nov 2026): tile and snapshot labels short enough to read in full at four tiles per row on a 375px phone.
     The full name stays on the tile's title and aria label and in the detail sheet. */
  const TILE_LABEL = { "Euro Stoxx 50": "Stoxx 50", "STOXX 600": "Stoxx 600", "CBOE VIX": "VIX", "Nikkei 225": "Nikkei", "TTF gas": "TTF", "Diesel (ULSD)": "Diesel",
    "Uranium (SPUT)": "Uranium", "Aluminium (COMEX)": "Aluminium", "Coffee NY (Arabica)": "Coffee", "Cocoa NY": "Cocoa", "Wheat Chicago": "Wheat", "Sugar NY No.11": "Sugar",
    "Soybean Meal": "Soy meal", "Soybean Oil": "Soy oil", "Lean Hogs": "Lean hogs", "Live Cattle": "Cattle", "Rough Rice": "Rice", "Orange Juice": "Orange juice",
    "iShares 20+Y Treasury (TLT)": "TLT", "Dollar index": "DXY", "PBoC 1Y LPR": "PBoC LPR", "Nordic system": "Nordic SYS" };
  const tileName = r => { const s0 = short(r); return TILE_LABEL[s0] || TILE_LABEL[r.name] || s0; };
  /* Compact price: currency as a symbol in front ($91.07, €87.30, C$25.75), US cents as ¢ after (275.5¢); index points and an
     FX pair's quote currency are left out (the name says it). The full unit (USD/bbl, EUR/MWh ...) goes on the title. */
  const CCY_SYM = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$" };
  function pxShort(r) {
    const t = r ? px(r.px, r.kind) : null;
    if (!t) return null;
    if (r.kind === "yield" || r.kind === "fx") return t;
    const u = unitText(r);
    if (!u || u === "pts") return t;
    const c = u.split("/")[0];
    if (c === "USc") return t + "¢";
    return CCY_SYM[c] ? CCY_SYM[c] + t : t + " " + c;
  }
  const TV = tv => (tv ? "https://www.tradingview.com/symbols/" + encodeURIComponent(String(tv).replace(":", "-")).replace(/%21/g, "!") + "/" : null);
  const WASDE = ["USDA WASDE (supply and demand)", "https://www.usda.gov/about-usda/general-information/staff-offices/office-chief-economist/commodity-markets/wasde-report"];
  const TV_FIX = { "TTF=F": "ICEENDEX:TFM1!" };   /* TradingView's page for the TTF front month */
  const FUND = {
    "BZ=F": ["EMMi oil balances", "#energy/oil"], "CL=F": ["EMMi oil balances", "#energy/oil"], "HO=F": ["EMMi oil balances", "#energy/oil"],
    "NG=F": ["EIA weekly gas storage", "https://ir.eia.gov/ngs/ngs.html"], "TTF=F": ["EMMi EU gas storage", "#energy/gas"],
    "GC=F": ["EMMi gold supply and demand (WGC)", "#markets/metals/mtBal"], "HG=F": ["EMMi copper balance (ICSG)", "#markets/metals/mtBal"],
    "SI=F": ["EMMi silver balance (Silver Institute)", "#markets/metals/mtBal"], "PL=F": ["EMMi platinum balance (WPIC)", "#markets/metals/mtBal"],
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
    "TTF=F": "Dutch TTF, Europe's gas benchmark, front month. Priced from the NYMEX-listed TTF contract (Yahoo), which trades thinly and often has no prints after mid-afternoon; the tag gives the last trade time. The main ICE Endex quote has no free feed.", "CO2.L": "SparkChange physical EUA ETC, tracking EU carbon permits.",
    "U-UN.TO": "Sprott Physical Uranium Trust units, a proxy for spot uranium.",
    "UST:2Y": "US 2-year Treasury yield, the market's read on the Fed path over two years.",
    "NYFED:SOFR": "Secured Overnight Financing Rate: the US overnight repo benchmark, published by the New York Fed the next business day.",
    "NB:TBIL3M": "NIBOR 3m proxy: Norges Bank's official 3-month Treasury bill yield. Official NIBOR fixings are not free to republish, so this tracks Norwegian 3-month money instead.",
    "CNBC:JP10Y-JP": "Japan 10-year government bond yield (JGB), official close from the Ministry of Finance.",
    "PBOC:LPR1Y": "China's 1-year loan prime rate, the PBoC's benchmark lending rate, fixed on the 20th of each month and published by the National Interbank Funding Center.",
    "000300.SS": "CSI 300: the 300 largest Shanghai and Shenzhen A-shares. Closes from China Securities Index Co."
  };
  function generic(r) {
    const k = r && r.kind;
    if (k === "index") return "Index level in points. 1D is against the previous close, 1M against a month ago.";
    if (k === "yield") return "Yield in percent; changes are in basis points.";
    if (k === "fx") return "Exchange rate; the price is in the second currency.";
    if (k === "future") return r.note ? r.note : "Futures price, front month.";
    return "Price in the trading currency.";
  }
  const PAGE = { "#energy/oil/ogCurves": "Oil futures curves", "#energy/oil": "Oil & gas", "#energy/gas/gsSecPx": "TTF price and curve", "#companies/mining": "Metals & mining", "#markets/metals/mtPx": "Metals", "#markets/metals/mtBal": "Metals: supply and demand", "#markets/metals/mtCot": "Metals: trader positioning", "#energy/oil/ogCot": "Oil: trader positioning", "#markets/mkt-cot": "Markets: trader positioning", "#markets/mkt-cmd-energy": "Markets: energy", "#markets/mkt-cmd-precious": "Markets: precious metals", "#markets/mkt-cmd-base": "Markets: base metals", "#markets/mkt-cmd-softs": "Markets: softs", "#markets/mkt-cmd-grains": "Markets: grains and oilseeds", "#markets/mkt-cmd-livestock": "Markets: livestock",
    "#energy/prices": "Nordic prices and forward curve", "#energy/generation": "Nordic generation", "#energy/hydro": "Nordic hydro", "#energy/weather": "Nordic weather",
    "#energy/gas": "EU gas storage", "#markets/mkt-indices": "Markets: indices", "#companies/renewables": "Renewables companies", "#companies/oil": "Oil & gas companies",
    "#energy/nordic": "Nordic power overview", "#live": "Live Pulse", "#briefs/live": "Live Pulse", "#live/editions": "Pulse and CSI editions",
    "#markets/metals": "Metals", "#markets/mkt-rates": "Markets: rates and FX", "#markets/mkt-cmd": "Markets: commodities", "#energy/grid": "Grid", "#companies/events": "Company events log" };
  const pageLab = h => "EMMi: " + (PAGE[h] || "page");
  function popFor(r, genIso, extra) {
    if (!r) return null;
    const links = [], d = DEEP[r.sym], f = FUND[r.sym];
    if (d) links.push([pageLab(d), d]);
    const ch = TV(TV_FIX[r.sym] || r.tv); if (ch) links.push(["Chart", ch]);
    if (f && f[1] !== d) links.push(["Fundamentals: " + f[0], f[1]]); else if (f) links[0][0] = "Fundamentals: " + f[0];
    if (r.official && r.official.url) links.push([(r.src === r.official.id ? "Source: " : "Official reference: ") + r.official.name, r.official.url]);
    const q = quoteURL(r); if (q && !links.some(l => l[1] === q)) links.push(["Quote: " + (/cnbc/.test(q) ? "CNBC" : /csindex/.test(q) ? "China Securities Index" : "Yahoo"), q]);
    if (r.live && r.live.url && r.live.url !== q) links.push(["Delayed quote: " + (r.live.src || "source"), r.live.url]);
    const fr = fresh(r, genIso);
    return { sym: r.sym, title: r.name, value: pxu(r), explain: (extra ? extra + " " : "") + (EXPLAIN[r.sym] || generic(r)), fresh: fr && fr.long, links: links };
  }
  function quoteURL(r) {
    const sym = String(r.sym || "");
    if (/^(UST|NYFED|NB|PBOC):/.test(sym)) return (r.official && r.official.url) || "";
    if (sym === "000300.SS") return "https://www.csindex.com.cn/en/indices/index-detail/000300";
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
  /* 3M is not in market.json pct (1D/1W/1M/6M/1Y). Use the close three monthly candles back. */
  function chg3m(r) {
    const m = r && r.ohlc && r.ohlc.m;
    if (!Array.isArray(m) || m.length < 4) return null;
    const a = m[m.length - 4] && m[m.length - 4][3], b = m[m.length - 1] && m[m.length - 1][3];
    return finite(a) && finite(b) && a ? (b / a - 1) * 100 : null;
  }
  function chgAt(r, p) { return p === "3M" ? (finite(chg(r, "3M")) ? chg(r, "3M") : chg3m(r)) : chg(r, p); }
  function sparkTail(r, frac) {
    const s = r && r.spark;
    if (!Array.isArray(s) || s.length < 4) return s;
    const n = Math.max(4, Math.round(s.length * frac));
    return s.slice(-n);
  }
  /* per: "1W"|"1M"|"3M"|"1Y" for the Commodities period switch; omitted, follow the site-wide Daily·1M / Monthly·1Y scale. */
  function chart(r, per) {
    const C = window.MMCandles;
    if (per === "1Y") return (C && C.svg(r, "m", { h: 40 })) || lineSpark(r.spark);
    if (per === "1W") return (C && C.svg(r, "d", { h: 40, n: 5 })) || lineSpark(sparkTail(r, 5 / 250));
    if (per === "3M") return lineSpark(sparkTail(r, 0.25)) || (C && C.svg(r, "m", { h: 40, n: 4 })) || "";
    if (per === "1M") return (C && C.svg(r, "d", { h: 40 })) || lineSpark(sparkTail(r, 1 / 12));
    return (C && C.svg(r, C.scale(), { h: 40 })) || lineSpark(r.spark);
  }

  /* ---------- compact market tile (Pulse grid): name, price + unit, 1D/1M, candles, 52-week range, freshness ---------- */
  function tile(r, R, gen, extra) {
    const u = unitOf(r), f = fresh(r, gen), nm = tileName(r), full = pxu(r), ps = pxShort(r);
    const per = extra && extra.period;
    const p2 = per || "1M";
    const v2 = chgAt(r, p2);
    /* short label on screen, full name and full unit for hover and screen readers */
    const inner = '<span class="tn" title="' + esc(r.name) + '">' + (nm !== r.name ? '<span aria-hidden="true">' + esc(nm) + '</span><span class="sr-only">' + esc(r.name) + "</span>" : esc(nm)) + "</span>" +
      '<span class="px"' + (full ? ' title="' + esc(full) + '"' : "") + ">" + (ps ? (full && full !== ps ? '<span aria-hidden="true">' + esc(ps) + '</span><span class="sr-only">' + esc(full) + "</span>" : esc(ps)) : NA) + "</span>" +
      '<span class="pills">' + (finite(chg(r, "1D")) ? '<span class="k">1D</span>' + pill(chg(r, "1D"), u) : "") + (finite(v2) ? '<span class="k">' + p2 + "</span>" + (p2 === "1M" ? '<span class="m1" title="1M">' + pill(v2, u) + "</span>" : pill(v2, u)) : "") + "</span>" +
      chart(r, per) + range52(r) + '<span class="qmeta">' + tagHTML(f) + "</span>";
    /* t1405u: a tile opens its detail sheet (chart, then sector performance and largest members for indices) */
    return '<div class="tile" role="button" tabindex="0" aria-haspopup="dialog"' + (per ? ' data-cmd-per="' + esc(per) + '"' : "") + R.row(r) + R.pop(popFor(r, gen, extra)) + ">" + inner + "</div>";
  }
  /* swap each tile's chart in place after the Daily · 1M / Monthly · 1Y switch */
  function rescale(root) {
    const C = window.MMCandles;
    if (!root || !C) return;
    root.querySelectorAll("[data-cdl]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cdl === C.scale())));
    root.querySelectorAll(".tile[data-kt]").forEach(t => { const r = lookup(t.dataset.kt, "rows"); if (!r) return; const old = t.querySelector(":scope > svg.spark"); const h = chart(r, t.getAttribute("data-cmd-per") || null); if (old) old.outerHTML = h || ""; });
  }
  const SCALE_CB = {};
  const onScale = (ns, fn) => { SCALE_CB[ns] = fn; };

  /* ---------- tile detail sheet (t1405u) ----------
     Price chart with the Daily · 1M / Monthly · 1Y switch; for equity indices, sector performance (1D or 1M) and the
     largest members with their weights, from data/index_detail.json (emmi-data build_index_detail.py). Only what the
     file carries is shown; gaps are labelled. */
  const SH = { r: null, gen: null, per: "1D", idx: null, idxAt: 0, el: null };
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null); }
  function loadIdx() {
    const th = Math.floor(Date.now() / 36e5);
    if (SH.idx && SH.idxAt === th) return Promise.resolve(SH.idx);
    return getJSON("/emmi/ed/live/data/index_detail.json?t=" + th).then(d => { if (d) { SH.idx = d; SH.idxAt = th; } return SH.idx; });
  }
  function primeIdx(d) { if (d) { SH.idx = d; SH.idxAt = Math.floor(Date.now() / 36e5); } }
  function bigChart(r) {
    const C = window.MMCandles;
    const c = C && C.svg(r, C.scale(), { h: 120, cls: "lps-ch" });
    if (c) return c;
    const p = (r.spark || []).filter(finite);
    if (p.length < 2) return '<p class="fnote">No chart history in the feed.</p>';
    return lineSpark(p).replace('class="spark"', 'class="lps-ch"');
  }
  function sbar(v, mx) {
    const w = (Math.min(1, Math.abs(v) / mx) * 50).toFixed(1);
    return '<span class="fb"><i class="' + (v >= 0 ? "up" : "dn") + '" style="' + (v >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i></span>';
  }
  const pct2 = v => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%" : "–");
  function sheetHTML(r) {
    const D = (SH.idx && SH.idx.indices && SH.idx.indices[r.sym]) || null, per = SH.per === "1M" ? "1M" : "1D", key = per === "1M" ? "m1" : "d1";
    const C = window.MMCandles, f = fresh(r, SH.gen), u = unitOf(r), pop = popFor(r, SH.gen) || {};
    let h = '<div class="lps-bg"></div><div class="lps" role="dialog" aria-modal="true" aria-label="' + esc(r.name) + '">' +
      '<header class="lps-h"><div><h3>' + esc(short(r)) + ' <small>' + esc(r.name !== short(r) ? r.name : "") + '</small></h3><p class="lps-px">' + (pxu(r) ? esc(pxu(r)) : NA) +
      (finite(chg(r, "1D")) ? ' <span class="k">1D</span>' + pill(chg(r, "1D"), u) : "") + (finite(chg(r, "1M")) ? ' <span class="k">1M</span>' + pill(chg(r, "1M"), u) : "") + " " + tagHTML(f) + "</p></div>" +
      '<button type="button" class="lps-x" data-lps-close aria-label="Close">×</button></header>' +
      '<div class="lps-c">' + bigChart(r) + (C ? '<div class="lps-tg">' + C.toggle(C.scale()) + "</div>" : "") + "</div>";
    if (r.kind === "index") {
      if (!D) h += '<p class="fnote">' + (SH.idx ? "No sector or member data for this index in the feed." : "Loading sectors and members…") + "</p>";
      else {
        const pb = k => '<button type="button" data-lps-per="' + k + '" aria-pressed="' + (per === k) + '">' + k + "</button>";
        /* t1443u: sector ETFs that are in the live price file use their live move (and freshness) instead of the once-a-day file */
        let nLive = 0, lfr = null;
        const sec = D.sectors && (D.sectors.rows || []).map(x => {
          const lr = x.sym && LASTBY[x.sym], d1 = lr && chg(lr, "1D");
          if (!finite(d1)) return x;
          nLive++; if (!lfr) lfr = fresh(lr);
          return Object.assign({}, x, { d1: d1, m1: finite(chg(lr, "1M")) ? chg(lr, "1M") : x.m1, live: true });
        }).filter(x => finite(x[key]));
        if (sec && sec.length) {
          const asof = (D.sectors.rows.find(x => x.asof) || {}).asof, mx = Math.max.apply(null, sec.map(x => Math.abs(x[key])).concat([0.0001]));
          h += '<h4>Sector performance <span class="cdl-scale lps-per" role="group" aria-label="Period">' + pb("1D") + pb("1M") + "</span></h4><ol class=\"lps-sec\">" +
            sec.slice().sort((a, b) => b[key] - a[key]).map(x => '<li><span class="fn">' + esc(x.name) + '</span>' + sbar(x[key], mx) + '<span class="fv ' + (x[key] >= 0 ? "up" : "dn") + '">' + pct2(x[key]) + "</span></li>").join("") +
            '</ol><p class="fnote">' + esc(D.sectors.src) + (nLive ? ", live prices from the EMMi price file" + (lfr ? " (" + esc(lfr.text) + ")" : "") : asof ? ", close " + esc(dayText(asof) || asof) : "") + '. <a href="' + esc(D.sectors.url) + '" target="_blank" rel="noopener noreferrer">Source ↗</a></p>';
        } else if (D.sector_weights && D.sector_weights.length) {
          h += '<h4>Sector weights</h4><ol class="lps-sw">' + D.sector_weights.slice(0, 8).map(x => '<li><span class="fn">' + esc(x.k) + '</span><span class="fb"><i class="w" style="width:' + Math.min(100, x.w * 2).toFixed(1) + '%"></i></span><span class="fv">' + x.w.toFixed(1) + "%</span></li>").join("") +
            '</ol><p class="fnote">No free daily sector series for this index, so sector moves are not shown. Weights of ' + esc(D.etf_name || D.etf) + ".</p>";
        }
        const hs = (D.holdings || []);
        if (hs.length) {
          h += "<h4>Largest members</h4><table class=\"lps-t\"><thead><tr><th>Company</th><th>Weight</th><th>1D</th><th>1M</th></tr></thead><tbody>" +
            hs.map(x => '<tr><td><a href="https://finance.yahoo.com/quote/' + encodeURIComponent(x.sym || "") + '" target="_blank" rel="noopener noreferrer">' + esc(x.name || x.sym) + "</a></td><td>" + (finite(x.w) ? x.w.toFixed(1) + "%" : "–") +
              '</td><td class="' + (x.d1 >= 0 ? "up" : "dn") + '">' + pct2(x.d1) + '</td><td class="' + (x.m1 >= 0 ? "up" : "dn") + '">' + pct2(x.m1) + "</td></tr>").join("") +
            '</tbody></table><p class="fnote">Weights: ' + esc((D.holdings_src || {}).name || D.etf) + (D.note ? ". " + esc(String(D.note).replace(/[.\s]+$/, "")) : "") + ". Moves to each stock's last close (Yahoo). " +
            '<a href="' + esc((D.holdings_src || {}).url || "#") + '" target="_blank" rel="noopener noreferrer">Holdings ↗</a></p>';
        }
      }
    }
    h += '<p class="lps-ex">' + esc(pop.explain || "") + "</p>" + (pop.fresh ? '<p class="fnote">' + esc(pop.fresh) + "</p>" : "") +
      '<p class="lps-l">' + (pop.links || []).map(l => { const ext = !/^#/.test(l[1]); return '<a href="' + esc(l[1]) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(l[0]) + (ext ? " ↗" : " →") + "</a>"; }).join("") + "</p></div>";
    return h;
  }
  function openSheet(r, gen) {
    if (!r || typeof document.createElement !== "function") return;
    SH.r = r; if (gen !== undefined) SH.gen = gen;
    let el = SH.el && SH.el.isConnected ? SH.el : document.getElementById("kSheet");
    if (!el) {
      el = document.createElement("div"); el.id = "kSheet"; el.className = "lps-w";
      document.body.appendChild(el);
      if (window.MMCandles) MMCandles.wire(el, () => { openSheet(SH.r); Object.keys(SCALE_CB).forEach(k => { try { SCALE_CB[k](); } catch (e) { /* page gone */ } }); });
    }
    SH.el = el;
    const sc = el.querySelector(".lps") ? el.querySelector(".lps").scrollTop : 0;
    el.innerHTML = sheetHTML(r); el.hidden = false;
    document.documentElement.classList.add("lps-open");
    const box = el.querySelector(".lps"); if (box) box.scrollTop = sc;
    if (r.kind === "index" && !SH.idx) loadIdx().then(d => { if (d && SH.r === r && !el.hidden) openSheet(r); });
  }
  function closeSheet() {
    SH.r = null;
    if (SH.el) { SH.el.hidden = true; SH.el.innerHTML = ""; }
    if (document.documentElement) document.documentElement.classList.remove("lps-open");
  }
  /* after a page re-renders with fresh rows, keep an open sheet on the same instrument */
  function refreshSheet(rows) {
    if (!SH.r) return;
    const nr = (rows || []).find(x => x && x.sym === SH.r.sym);
    if (nr) openSheet(nr); else closeSheet();
  }
  document.addEventListener("click", e => {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t || !t.closest(".lps-w")) return;
    if (t.closest("[data-lps-close]") || t.classList.contains("lps-bg")) { e.preventDefault(); closeSheet(); return; }
    const lper = t.closest("[data-lps-per]");
    if (lper) { SH.per = lper.dataset.lpsPer; openSheet(SH.r); }
  });

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
  /* CFTC/ICE managed-money line in the hover card, with a link to the EMMi positioning section */
  function cotPop(o, a) {
    const C = window.EMMICot, d = C && C.peek && C.peek(), m = d && o.sym ? C.bySym(d, o.sym) : null, t = m ? C.line(m) : "";
    return t ? '<p class="pp-f">' + esc(t) + " " + a(["Positioning", C.where(m)]) + "</p>" : "";
  }
  function hidePop() { clearTimeout(popT); if (POP) POP.hidden = true; popFor0 = null; }
  const popOpenFor = el => !!el && popFor0 === el;
  function showPop(el) {
    const o = lookup(el.dataset.pop, "pops");
    if (!o) return;
    const P = popEl();
    const a = l => { const u = safeURL(l[1]); if (!u) return ""; const ext = /^https?:/.test(u); return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(l[0]) + (ext ? " ↗" : " →") + "</a>"; };
    P.innerHTML = '<p class="pp-h"><b>' + esc(o.title || "") + "</b>" + (o.value ? " <span>" + esc(o.value) + "</span>" : "") + "</p>" + (o.explain ? '<p class="pp-x">' + esc(o.explain) + "</p>" : "") +
      (o.fresh ? '<p class="pp-f">' + esc(o.fresh) + "</p>" : "") + cotPop(o, a) + ((o.links || []).length ? '<p class="pp-l">' + o.links.map(a).join("") + "</p>" : "") + (canHover() ? "" : '<button type="button" class="pp-x-btn" aria-label="Close">×</button>');
    P.hidden = false; popFor0 = el;
    const r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
    P.style.width = w + "px";
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    const below = r.bottom + 6, h = P.offsetHeight;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    P.style.left = left + window.scrollX + "px"; P.style.top = top + window.scrollY + "px";
    const b = P.querySelector(".pp-x-btn"); if (b) b.onclick = hidePop;
  }
  /* hover and keyboard focus on a page host; the page's own click handler calls hostClick() for taps and tiles */
  function wirePop(host) {
    if (!host || host._kPop) return;
    host._kPop = true;
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
  }
  /* A tap or click inside a page: a tile opens its sheet; on touch, the first tap on a name opens its card and the
     second follows the link. Returns true when it handled the click. */
  function hostClick(e) {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return false;
    const kt = t.closest("[data-kt]");
    if (kt && !t.closest("a")) { e.preventDefault(); hidePop(); const r = lookup(kt.dataset.kt, "rows"), R = REGS[String(kt.dataset.kt).split(":")[0]]; openSheet(r, R ? R.gen : null); return true; }
    const pe = t.closest("[data-pop]");
    if (pe && !canHover() && popFor0 !== pe) { e.preventDefault(); showPop(pe); return true; }
    return false;
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { hidePop(); closeSheet(); }
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches(".tile[data-kt], li[data-kt][role=button]")) { e.preventDefault(); const R = REGS[String(e.target.dataset.kt).split(":")[0]]; openSheet(lookup(e.target.dataset.kt, "rows"), R ? R.gen : null); }
  });
  document.addEventListener("click", e => { if (POP && !POP.hidden && !POP.contains(e.target) && !(popFor0 && popFor0.contains(e.target))) hidePop(); }, true);
  if (window.addEventListener) window.addEventListener("scroll", () => { if (POP && !POP.hidden && canHover()) hidePop(); }, { passive: true });

  /* ---------- return to place (t1399u), site-wide ----------
     Leaving a page through an internal link in its content (a name, a card, a catalyst, a popover or sheet link)
     saves the scroll position and the nearest section in sessionStorage. Coming back (Back, the "← Back to …" pill
     or the nav) restores it once the page has rendered. Kept for 30 minutes, this tab only. */
  const PLACE = "emmiLivePlace";
  const PAGES = [[/^#(live\/editions|briefs(\/csi|\/pulse)?$)/, "Editions"], [/^#(live|briefs\/live)/, "Live Pulse"], [/^#(markets\/metals|companies\/metals)/, "Metals"], [/^#(markets|macro)/, "Markets"], [/^#energy\/oil/, "Oil & gas"], [/^#energy\/gas/, "Gas storage"], [/^#energy\/grid/, "Grid"],
    [/^#(energy|power)/, "Nordic power"], [/^#companies\/mining/, "Mining"], [/^#(companies\/events|events)/, "Company events log"], [/^#companies\/oil/, "Oil companies"],
    [/^#companies/, "Companies"], [/^#curves/, "Curves"], [/^#(home|overview)?$/, "Live Pulse"]];
  const pageOf = h => { const p = PAGES.find(x => x[0].test(h || "")); return p ? p[1] : null; };
  const CONTENT = "#tablePage, .lp-pop, .lps-w";
  const NOSAVE = "#subNav, .pw-subnav, .sub-nav, .main-nav, #sectionNav";
  function readPlace() { try { const p = JSON.parse(sessionStorage.getItem(PLACE) || "null"); return p && Date.now() - p.t < 18e5 ? p : null; } catch (e) { return null; } }
  function anchors() {
    return Array.from(document.querySelectorAll("#livePulse > section[id], #tablePage section[id], #tablePage .og-block[id], #tablePage .block[id]"))
      .filter(el => el.offsetParent !== null);
  }
  function savePlace(target) {
    const from = location.hash || "#live";
    if (!pageOf(from)) return;
    const y = window.scrollY;
    let sec = null, off = 0, best = -Infinity;
    anchors().forEach(el => { const top = el.getBoundingClientRect().top + y; if (top <= y + 80 && top > best) { best = top; sec = el.id; off = y - top; } });
    try { sessionStorage.setItem(PLACE, JSON.stringify({ from: from, y: y, sec: sec, off: off, to: target || null, t: Date.now() })); } catch (e) { /* private mode */ }
  }
  function placeTarget(p) {
    const el = p.sec && document.getElementById(p.sec);
    if (el && el.offsetParent !== null) return el.getBoundingClientRect().top + window.scrollY + p.off;
    return p.sec ? null : p.y;
  }
  /* restore now if the page is drawn far enough; returns true when it scrolled */
  function restorePlace() {
    const p = readPlace();
    if (!p || (location.hash || "#live") !== p.from) return false;
    const y = placeTarget(p);
    if (y == null || document.documentElement.scrollHeight < y + window.innerHeight * 0.5) return false;
    window.scrollTo(0, Math.max(0, Math.round(y)));
    try { sessionStorage.removeItem(PLACE); } catch (e) { /* private mode */ }
    backPill();
    return true;
  }
  /* pages that render late: try for up to 6 s after coming back */
  let waitT = 0;
  function awaitRestore() {
    clearInterval(waitT);
    const p = readPlace();
    if (!p || (location.hash || "#live") !== p.from) return;
    const t0 = Date.now();
    waitT = setInterval(() => { if (restorePlace() || Date.now() - t0 > 6000) clearInterval(waitT); }, 120);
  }
  const same = (a, b) => String(a || "#live").split("/").slice(0, 2).join("/") === String(b || "#live").split("/").slice(0, 2).join("/");
  document.addEventListener("click", e => {
    const a = e.target && e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (!a || (e.defaultPrevented && !a.closest(".lp-pop, .lps-w"))) return;
    const h = a.getAttribute("href");
    if (!h || h === "#" || /^#co=/.test(h) || !a.closest(CONTENT) || a.closest(NOSAVE) || a.classList.contains("lp-back")) return;
    if (same(h, location.hash) && !/^#(live|briefs\/live)$/.test(location.hash || "")) return; /* a jump within the same page */
    savePlace(h);
  }, true);
  let PILL = null;
  function backPill() {
    const p = readPlace(), here = location.hash || "#live";
    const on = !!p && here !== p.from && !/^#co=/.test(here) && pageOf(p.from) && pageOf(here) !== pageOf(p.from);
    if (!on) { if (PILL) PILL.hidden = true; return; }
    if (!PILL) {
      PILL = document.createElement("a");
      PILL.className = "lp-back";
      PILL.addEventListener("click", () => { if (PILL) PILL.hidden = true; });
      document.body.appendChild(PILL);
    }
    PILL.href = p.from; PILL.textContent = "← Back to " + pageOf(p.from);
    PILL.hidden = false;
  }
  if (window.addEventListener) window.addEventListener("hashchange", () => { backPill(); awaitRestore(); });

  /* ---------- i-notes (t1412u): explanations, legends and method notes behind a small i ----------
     A matching note is hidden and an i button takes its place; short action links ("All markets →") stay visible
     beside the i. Notes that follow each other share one i. A note straight under a section heading puts its i in
     that heading. Add the class "inote-src" to any element to fold it the same way. */
  const FOLD = [
    ".inote-src",
    ".lp .fnote:not(.keep)",              /* Live Pulse legends: candles, baskets, colour, movers, catalysts */
    ".cot-lede", ".cot-note",             /* trader positioning intro and report note (Markets, Oil & gas, Metals) */
    "#ogBal .ogx-note", ".tape-note",     /* oil balance legend, table notes */
    "#gasView .pw-foot",                  /* gas storage method and coverage notes */
    ".v2co-foot",                         /* company lists: listing and currency notes */
    "#mnCost .og-note", "#mtStk .og-note", "#mtBal > .og-note", "#mtPx .ogx-dek",
    ".co-note", ".co-src-note",           /* company page source notes */
    ".news-note", ".ev-note"
  ].join(", ");
  const HEADS = "header, .bh, .og-h, .sec-h, .cot-h, h2, h3";
  let seq = 0;
  /* the heading of the section this note opens, when nothing but headings comes before it */
  function topHead(el) {
    const sec = el.closest("section, .block, .og-block");
    if (!sec) return null;
    for (let n = el; n && n !== sec; n = n.parentElement) {
      for (let p = n.previousElementSibling; p; p = p.previousElementSibling) if (!(p.matches(HEADS) || p.classList.contains("inote") || p.classList.contains("inote-p"))) return null;
    }
    const h = Array.from(sec.children).find(c => c.matches(HEADS));
    return h ? (h.querySelector(":scope > h2, :scope > h3") || h) : null;
  }
  function keepLink(a) { const t = (a.textContent || "").trim(); return t.length <= 40 && /→$/.test(t) && /^#/.test(a.getAttribute("href") || ""); }
  function foldOne(el) {
    if (!el || el.dataset.inote || !el.isConnected) return;
    if (!(el.textContent || "").trim()) return;
    el.dataset.inote = "1";
    const id = el.id || (el.id = "inote-" + (++seq));
    const keep = Array.from(el.querySelectorAll("a")).filter(keepLink);
    const keepHTML = keep.map(a => a.outerHTML).join(" ");
    keep.forEach(a => a.remove());
    /* Oil & gas, Mining and Metals blocks already have an i (MMV2.park): the note joins that panel, one i per block */
    const blk = el.closest("#oilgasView .og-block, #miningView .og-block, #metalsView .og-block");
    const ogh = blk && blk.querySelector(".og-h");
    if (ogh) {
      let panel = blk.querySelector(":scope > .info-panel");
      if (!panel) {
        const pid = "og-info-k" + (++seq);
        ogh.insertAdjacentHTML("beforeend", '<button type="button" class="info" aria-expanded="false" aria-controls="' + pid + '" aria-label="Sources and notes">i</button>');
        blk.insertAdjacentHTML("beforeend", '<div class="info-panel" id="' + pid + '" hidden></div>');
        panel = blk.querySelector(":scope > .info-panel");
      }
      if (keepHTML) el.insertAdjacentHTML("beforebegin", '<div class="inote"><span class="inote-k">' + keepHTML + "</span></div>");
      el.hidden = false;
      panel.insertBefore(el, panel.firstChild);
      return;
    }
    el.classList.add("inote-p");
    el.hidden = true;
    /* a note right after another folded note joins its i */
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains("inote-p") && prev.dataset.inoteBtn) {
      const b = document.getElementById(prev.dataset.inoteBtn);
      if (b) { b.setAttribute("aria-controls", b.getAttribute("aria-controls") + " " + id); el.dataset.inoteBtn = b.id; if (keepHTML) { const k = b.parentNode.querySelector(".inote-k"); if (k) k.insertAdjacentHTML("beforeend", " " + keepHTML); } return; }
    }
    const bid = "inoteb-" + (++seq);
    const btn = '<button type="button" class="inote-b" id="' + bid + '" aria-expanded="false" aria-controls="' + id + '" aria-label="Notes and sources" title="Notes and sources">i</button>';
    el.dataset.inoteBtn = bid;
    const head = keepHTML ? null : (prev && prev.matches && prev.matches(HEADS) ? prev : topHead(el));
    if (head) { head.insertAdjacentHTML("beforeend", btn.replace('class="inote-b"', 'class="inote-b inote-hb"')); return; }
    el.insertAdjacentHTML("beforebegin", '<div class="inote">' + btn + (keepHTML ? '<span class="inote-k">' + keepHTML + "</span>" : "") + "</div>");
  }
  let foldQ = 0;
  function foldAll(root) { (root || document).querySelectorAll(FOLD).forEach(foldOne); }
  function foldSoon() { if (foldQ) return; foldQ = (window.requestAnimationFrame || setTimeout)(() => { foldQ = 0; foldAll(); }); }
  document.addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest(".inote-b") : null;
    if (!b) return;
    e.preventDefault();
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    String(b.getAttribute("aria-controls") || "").split(/\s+/).forEach(i => { const p = i && document.getElementById(i); if (p) p.hidden = !open; });
  });
  function startFold() {
    if (typeof MutationObserver !== "function" || !document.body) return;
    foldAll();
    new MutationObserver(foldSoon).observe(document.body, { childList: true, subtree: true });
  }
  if (typeof document.querySelectorAll === "function") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startFold); else startFold();
  }

  /* ---------- kit strip (19 Nov 2026 tidy-up): the same compact tiles on Gas storage, Grid and Mining ----------
     strip(ns, o) returns a block of compact tiles: market rows (o.syms, from o.market) open the tile detail sheet,
     o.facts are non-market figures ({title, value, unit, tag: [cls, short, long], sub, href, explain, links}) with a
     freshness label and a hover or tap card. o.note goes behind an i. wireStrip(host, ns) wires cards and sheets. */
  function factTile(R, t) {
    const tag = t.tag ? '<span class="fr ' + esc(t.tag[0]) + '" title="' + esc(t.tag[2] || t.tag[1]) + '">' + esc(t.tag[1]) + "</span>" : "";
    const val = t.value == null || t.value === "" ? NA : esc(t.value) + (t.unit ? ' <small class="pu">' + esc(t.unit) + "</small>" : "");
    const pop = R.pop({ title: t.title, value: t.value == null ? null : t.value + (t.unit ? " " + t.unit : ""), explain: t.explain || "", fresh: t.tag ? t.tag[2] || t.tag[1] : null, links: (t.links || []).concat(t.href ? [[pageLab(t.href) === "EMMi: page" ? "Open in EMMi" : pageLab(t.href), t.href]] : []) });
    const inner = '<span class="tn">' + esc(t.title) + '</span><span class="px">' + val + "</span>" + (t.sub ? '<span class="pills"><span class="k">' + esc(t.sub) + "</span></span>" : "") + '<span class="qmeta">' + tag + "</span>";
    return t.href ? '<a class="tile" href="' + esc(t.href) + '"' + pop + ">" + inner + "</a>" : '<div class="tile" tabindex="0"' + pop + ">" + inner + "</div>";
  }
  function strip(ns, o) {
    const R = reg(ns); R.reset();
    R.gen = (o.market && o.market.generated_utc) || null;
    const by = index(o.market);
    const rows = (o.syms || []).map(s => by[s]).filter(Boolean);
    const body = rows.map(r => tile(r, R, R.gen)).join("") + (o.facts || []).filter(Boolean).map(t => factTile(R, t)).join("");
    if (!body) return "";
    return '<section class="block kit-strip lpk" id="' + esc(o.id) + '"><header class="bh"><h2>' + esc(o.title) + "</h2>" + (o.right || "") + "</header>" +
      '<div class="tiles">' + body + "</div>" + (o.note ? '<p class="inote-src">' + o.note + "</p>" : "") + "</section>";
  }
  function wireStrip(host, ns) {
    if (!host) return;
    wirePop(host);
    if (!host._kStrip) { host._kStrip = true; host.addEventListener("click", e => { if (e.target && e.target.closest && e.target.closest(".kit-strip")) hostClick(e); }); }
    onScale(ns, () => { if (host.isConnected) host.querySelectorAll(".kit-strip").forEach(rescale); });
    refreshSheet(reg(ns).rows);
    foldSoon();
  }
  /* an observation or publication date as a freshness label: [cls, short, long] */
  const dateTag = (kind, ymd, long) => (ymd ? [kind === "Observed" ? "ob" : "pc", kind + " " + (dmy(ymd) || ymd), long || kind + " " + (dayText(ymd) || ymd)] : null);

  window.EMMIKit = { finite, esc, NA, safeURL, zurich, dayText, zurichDay, hhmm, dmy, index, chg, unitOf, fmtChg, pill, px, UNIT, unitText, pxu, DEEP, GROUP_PAGE, linkOf, aOpen, nameLink,
    fresh, tagHTML, TV, FUND, EXPLAIN, generic, PAGE, pageLab, popFor, quoteURL, range52, lineSpark, chart, chg3m, chgAt, short, SHORT, SHORT_SYM, tileName, pxShort, TILE_LABEL, reg, tile, rescale, onScale,
    openSheet, closeSheet, refreshSheet, primeIdx, loadIdx, sheetOpen: () => SH.r, canHover, showPop, hidePop, popOpenFor, wirePop, hostClick,
    readPlace, savePlace, restorePlace, backPill, pageOf, foldAll, FOLD, strip, wireStrip, factTile, dateTag };
})();
