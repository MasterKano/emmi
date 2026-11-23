/* Live Pulse (#live, the landing tab; #briefs/live redirects). Short, commentary-first briefing page (Jerry 23 Nov 2026,
   t1592u-t1595u):
   0 Slim Risk Gauge strip at the very top: score, band (Risk on / Mixed / Risk off), meter and the top drivers; a tap opens
     the full breakdown (computed here from market.json; inputs that are missing are left out and listed)
   1 The brief (data/live_comment.json schema 2: headline, 1-3 findings with EMMi deep links, our view; not live)
   2 Where the money is going: eight-benchmark tape, leading and lagging (1D / 1W / 1M), coverage movers and baskets,
     announcements, and quick jumps into Markets (Equities, Rates and FX, Commodities, Metals) and Energy
   3 Next up (company events).
   The 42-tile Markets grid now lives only on #markets (regional Equities Monitor and sector maps); the Energy block moved
   to #energy (its gas storage cards and a cross-energy price strip open the Energy landing). Only instruments that exist
   in the live feeds are shown. null is "Not available yet", never zero or a guess. The email is not touched by this page.
   window.EMMILivePulse. */
(function () {
  "use strict";
  const NV2 = "/emmi/ed/main/nordic-v2/";
  const EVERY = 5 * 60 * 1000;           /* market.json is rebuilt every ~15 min; check every 5 */
  const clamp = v => Math.max(-1, Math.min(1, v));
  const K = window.EMMIKit;   /* shared presentation kit: v2/shared/kit.js (prices, freshness, cards, tiles, sheet, return to place) */
  const { finite, esc, NA, zurich, dayText, zurichDay, dmy, index, chg, unitOf, fmtChg, pill, px, unitText, pxu, DEEP, GROUP_PAGE, linkOf, nameLink, fresh, tagHTML, EXPLAIN, PAGE, pageLab, popFor, short, tileName, pxShort, safeURL } = K;
  const REG = K.reg("lp");
  let CUR = REG;   /* nordicKit.scoped switches this to the Nordic landing page's registry while it renders */
  const popAttr = o => CUR.pop(o);

  /* ---------- time ---------- */
  const stamp = t => '<p class="asof">' + (t ? esc(t) : "Time not available yet") + "</p>";
  const pstamp = m => '<p class="asof"><span class="fr dl">Delayed</span> price file ' + esc(zurich(m && m.generated_utc) || "time not available") + "</p>";

  /* Zurich wall clock without a library: parts of an instant, and the instant of a Zurich wall time. */
  const ZF = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const ZN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  function zParts(ms) { const o = {}; ZF.formatToParts(new Date(ms)).forEach(x => { o[x.type] = x.value; }); return o; }
  function zOff(ms) { const o = {}; ZN.formatToParts(new Date(ms)).forEach(x => { o[x.type] = +x.value; }); return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - Math.floor(ms / 6e4) * 6e4; }
  function zWall(y, m, d, h, mi) { const g = Date.UTC(y, m - 1, d, h, mi); return g - zOff(g - zOff(g)); }
  /* Scheduled commentary slots, weekdays, Zurich: 06:30 (after the 06:00 email), 12:00, 15:30, 22:30. */
  const SLOTS = [[22, 30], [15, 30], [12, 0], [6, 30]];
  function latestSlot(now) {
    for (let k = 0; k < 8; k++) {
      const o = {}; ZN.formatToParts(new Date(now - k * 864e5)).forEach(x => { o[x.type] = +x.value; });
      const wd = new Date(Date.UTC(o.year, o.month - 1, o.day)).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      for (const [h, mi] of SLOTS) { const t = zWall(o.year, o.month, o.day, h, mi); if (t <= now) return t; }
    }
    return null;
  }
  /* Older = written before the latest slot that has passed. A slot's commentary may be written up to 45 minutes ahead
     of it (the 06:00 email covers 06:30; 22:2x covers 22:30). */
  function commentaryOlder(writtenIso, now) {
    const w = Date.parse(writtenIso || ""), s = latestSlot(now);
    return isFinite(w) && s != null && w < s - 45 * 6e4;
  }

  /* ---------- market rows ---------- */


  /* ---------- 2 risk gauge (pure, tested in scripts/test_live_pulse.cjs) ---------- */
  const BREADTH = ["^GSPC", "^IXIC", "^DJI", "^STOXX", "^STOXX50E", "^GDAXI", "^FTSE", "^SSMI", "^OMX", "^N225", "^HSI", "000300.SS"];
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
  const NOT_IN_FEED = ["Credit spreads (HYG / LQD or HY OAS are not in market.json)"];
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

  /* ---------- 3 leading and lagging ---------- */
  const FLOW = {
    regions: { title: "Regions", syms: BREADTH },
    commodities: { title: "Commodities", syms: ["BZ=F", "CL=F", "HO=F", "NG=F", "TTF=F", "CO2.L", "GC=F", "SI=F", "HG=F", "PL=F", "U-UN.TO"] },
    fx: { title: "FX", syms: ["DX-Y.NYB", "EURUSD=X", "JPY=X", "CHF=X", "EURCHF=X", "GBPCHF=X", "EURNOK=X", "EURSEK=X"] }
  };
  /* t1443u (20 Nov 2026): bars are drawn against each row's typical move for the period, not the biggest move in the panel,
     so a quiet day looks quiet. Typical move = robust standard deviation of the row's past-year closes (r.spark, ~128 points
     a year), scaled to one session and then by the square root of the sessions in the period. Full half-bar = 3 typical moves. */
  const PER_N = { "1D": 1, "1W": 5, "1M": 21 };
  function typMove(r, p) {
    const s = ((r && r.spark) || []).filter(x => finite(x) && x > 0);
    if (s.length < 20) return null;
    const lr = []; for (let i = 1; i < s.length; i++) lr.push(Math.abs(Math.log(s[i] / s[i - 1])));
    lr.sort((a, b) => a - b);
    const med = lr[Math.floor(lr.length / 2)], step = Math.max(1, 252 / (s.length - 1));
    const d1 = 1.4826 * med / Math.sqrt(step) * 100;
    return d1 > 0 ? d1 * Math.sqrt(PER_N[p] || 1) : null;
  }
  const typDefault = p => 1.2 * Math.sqrt(PER_N[p] || 1);
  const barW = (v, typ) => Math.min(50, Math.abs(v) / (3 * (finite(typ) && typ > 0 ? typ : typDefault("1D"))) * 50);
  /* t1443u item 6: a 1D move of exactly 0 is "unch" when the name traded (checked 20 Nov: Shell 3,574.5 = previous close on
     both Yahoo and CNBC, 10.5M shares) and "no trade" when the session shows no volume. */
  function zeroState(r, p, v) {
    if (v !== 0 || !r || !(r.kind === "equity" || r.kind === "etf")) return null;
    if (p !== "1D") return "unch";
    return r.vol && r.vol.last > 0 ? "unch" : "no trade";
  }
  /* rows: {name, v, u, typ, tag, link, pop, px, attrs, zs} */
  function flowItems(rows, cap) {
    let ok = rows.filter(r => finite(r.v)).sort((a, b) => b.v - a.v);
    const cut = cap && ok.length > cap * 2 ? ok.length - cap * 2 : 0;   /* tight lists: leaders and laggards only */
    if (cut) ok = ok.slice(0, cap).concat([{ gap: cut }], ok.slice(-cap));
    return ok.length ? ok.map(r => {
      if (r.gap) return '<li class="fgap" aria-label="' + r.gap + ' more in between">⋯ ' + r.gap + " more</li>";
      const w = barW(r.v, r.typ).toFixed(1);
      const side = r.v >= 0 ? "left:50%" : "right:50%";
      const val = r.zs ? '<span class="fv zs">' + esc(r.zs) + "</span>" : '<span class="fv ' + (r.v > 0 ? "up" : r.v < 0 ? "dn" : "") + '">' + esc(fmtChg(r.v, r.u)) + "</span>";
      return "<li" + (r.attrs || "") + (r.pop ? popAttr(r.pop) : "") + '><span class="fn"><span class="fnm">' + (r.link ? nameLink(r.name, r.link) : esc(r.name)) + (r.px ? ' <span class="fp">' + esc(r.px) + "</span>" : "") + "</span>" +
        (r.tag ? '<span class="ft">' + r.tag + "</span>" : "") + '</span><span class="fb"><i class="' + (r.v >= 0 ? "up" : "dn") + '" style="' + side + ";width:" + w + '%"></i></span>' + val + "</li>";
    }).join("") : "<li>" + NA + "</li>";
  }
  const TIGHT = 3;
  function flowPanel(title, rows, note) {
    return '<div class="lp-flow-p"><h3>' + esc(title) + "</h3><ol>" + flowItems(rows, TIGHT) + "</ol>" + (note ? '<p class="fnote">' + esc(note) + "</p>" : "") + "</div>";
  }
  /* t1443u item 1: real sectors. US = the 11 S&P 500 Select Sector SPDR ETFs, Europe = the STOXX Europe 600 sector ETFs
     (iShares, Xetra), both in the live price file (emmi-data group "sectors"). Each row opens its in-site detail sheet.
     Side by side from 700px; a US / Europe switch on a phone. */
  function sectorsHTML(market, by, p, reg) {
    const g = ((market && market.groups) || []).find(x => x.id === "sectors");
    const secs = (g && g.sections) || [];
    const gen = market && market.generated_utc;
    const list = s => flowItems(((s && s.rows) || []).filter(r => r && !r.error).map(r => {
      const v = chg(r, p);
      return { name: r.note || r.name, v: v, u: "%", typ: typMove(r, p), tag: tagHTML(fresh(r, gen)), zs: zeroState(r, p, v),
        attrs: CUR.row(r) + ' role="button" tabindex="0" title="' + esc(r.name) + '"' };
    }), TIGHT);
    const us = secs.find(s => /^US/.test(s.label || "")), eu = secs.find(s => /^Europe/.test(s.label || ""));
    const sw = k => '<button type="button" data-lp-secreg="' + k + '" aria-pressed="' + (reg === k) + '">' + (k === "us" ? "US" : "Europe") + "</button>";
    return '<div class="lp-flow-p lp-sec" data-reg="' + esc(reg) + '"><h3>Sectors <span class="cdl-scale lp-secreg" role="group" aria-label="Region">' + sw("us") + sw("eu") + "</span></h3>" +
      '<div class="lp-sec-g"><div class="sec-us"><h4>US · S&amp;P 500 sectors</h4><ol>' + (us ? list(us) : "<li>" + NA + "</li>") + '</ol></div><div class="sec-eu"><h4>Europe · STOXX Europe 600 sectors</h4><ol>' + (eu ? list(eu) : "<li>" + NA + "</li>") + "</ol></div></div>" +
      '<p class="fnote">US: Select Sector SPDR ETFs (USD), the 11 S&amp;P 500 sectors. Europe: iShares STOXX Europe 600 sector ETFs on Xetra (EUR). Each row opens its chart and detail. Bar length is the move against that sector\'s typical move over the period (full bar = 3 typical moves, from the past year\'s closes), so a long bar means an unusual move. Each row\'s tag says how fresh its price is.</p></div>';
  }


  const EXP_KEY = "emmiLpExp";
  function expState() { try { const o = JSON.parse(localStorage.getItem(EXP_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function saveExp(k, open) { try { const o = expState(); o[k] = !!open; localStorage.setItem(EXP_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } }

  /* ---------- 0 snapshot strip: eight benchmarks, price, 1D move, freshness, link to the EMMi detail ---------- */
  /* t1441u: short labels (full name on title and for screen readers) so all eight read in full at four per row on a phone */
  const SNAP = [["^GSPC", "S&P 500", "#markets/mkt-indices", "S&P 500"], ["^STOXX50E", "Stoxx 50", "#markets/mkt-indices", "Euro Stoxx 50"], ["BZ=F", "Brent", null, "Brent crude"],
    ["TTF=F", "TTF", null, "TTF gas (Dutch front month)"], ["GC=F", "Gold", null, "Gold"], ["^TNX", "US 10Y", "#markets/mkt-rates", "US 10-year Treasury yield"], ["EURUSD=X", "EUR/USD", "#markets/mkt-fx", "EUR/USD"]];
  const snapCell = (name, href, price, move, tag, title) => '<a class="sn" href="' + esc(href) + '"' + (title ? ' title="' + esc(title) + '"' : "") + '><span class="sn-n">' + (title && title !== name ? '<span aria-hidden="true">' + esc(name) + '</span><span class="sr-only">' + esc(title.split(" · ")[0]) + "</span>" : esc(name)) + '</span><span class="sn-p">' + (price ? esc(price) : NA) + "</span>" +
      '<span class="sn-m">' + (move || "") + "</span>" + '<span class="sn-f">' + (tag || "") + "</span></a>";
  /* list: [sym, short name, href or null, full name]. Also used by the Energy landing's price strip (nordicKit.tape). */
  const tapeCells = (by, gen, list) => list.map(([sym, name, href, full]) => {
    const r = by[sym];
    if (!r) return snapCell(name, href || "#markets", null, "", "", full);
    const l = linkOf(r), h = href || (l && !l.ext ? l.href : "#markets");
    return snapCell(name, h, pxShort(r), pill(chg(r, "1D"), unitOf(r)), tagHTML(fresh(r, gen)), full + (pxu(r) ? " · " + pxu(r) : ""));
  });
  function snapHTML(by, gen, N) {
    const cell = snapCell;
    const items = tapeCells(by, gen, SNAP);
    /* Nordic system price: latest day-ahead delivery day against the day before (Nord Pool, nordic-v2 prices.json). */
    const rows = N && N.prices && N.prices.regions && N.prices.regions.Nordic && N.prices.regions.Nordic.rows;
    const ok = (rows || []).filter(x => x && finite(x[1])), a = ok[ok.length - 1], b = ok[ok.length - 2];
    const d = a && b ? a[1] - b[1] : null;
    items.push(cell("Nordic SYS", "#energy/prices", a ? "€" + a[1].toFixed(1) : null,
      finite(d) ? '<span class="pill ' + (d > 0 ? "up" : d < 0 ? "dn" : "") + '">' + (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d).toFixed(1) + " €</span>" : "",
      a ? '<span class="fr pc" title="Day-ahead average for delivery on ' + esc(dayText(a[0]) || a[0]) + '; the move is against the day before">Delivery ' + esc(dmy(a[0]) || a[0]) + "</span>" : "", "Nordic system price (day-ahead)" + (a ? " · " + a[1].toFixed(1) + " €/MWh" : "")));
    return '<section class="lp-snap" id="lpSnap" aria-label="Snapshot: eight benchmarks">' + items.join("") + "</section>";
  }
  let GEN = null;
  const tile = r => K.tile(r, REG, GEN);

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
     with no data is left out and listed, never filled in. Normals: prices 2023–25 same weeks (data/nordic_normals.json; falls back to prices_normals.json),
     nuclear by the share of installed SE+FI capacity online (fixed bands, never a normal), wind load factor vs 2015–25 same 30 days, reservoirs NVE 2006–25 weekly range, weather ERA5 2006–25. */
  const ZONES = ["Nordic", "SE1", "SE2", "SE3", "SE4", "NO1", "NO2", "NO3", "NO4", "NO5", "DK1", "DK2", "FI"];
  const zlab = z => (z === "Nordic" ? "SYS" : z);
  const n0 = v => (finite(v) ? Math.round(v).toLocaleString("en-GB") : null);
  const sg = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d == null ? 1 : d) : null);
  const mean = a => { const f = (a || []).filter(finite); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : null; };
  const lastOf = rows => (rows && rows.length ? rows[rows.length - 1] : null);
  /* Nuclear is scored only by the share of installed Swedish + Finnish capacity online (Jerry 20 Nov 2026: compare
     nuclear with actual capacity, never with a normal, typical level or earlier years). Fixed bands:
     95% or more online scores −1 (loose), 82.5% scores 0, 60% or less scores +1 (fully tight); linear in between. */
  const NUC_BANDS = "Bands by share of installed capacity online: 90% or more is ample, 75–90% is usual running, 60–75% is short, below 60% is very short. It scores 0 at 82.5% online, fully tight (+1) at 60% or less and fully loose (−1) at 95% or more, linear in between.";
  function nucScore(pct) {
    if (!finite(pct)) return null;
    return clamp(pct < 82.5 ? (82.5 - pct) / 22.5 : -(pct - 82.5) / 12.5);
  }
  function nucBand(pct) { return !finite(pct) ? null : pct >= 90 ? "ample" : pct >= 75 ? "usual" : pct >= 60 ? "short" : "very short"; }
  /* background tint for a tight (+) / loose (−) score, safe in both themes */
  const tint = s => (finite(s) && Math.abs(s) >= 0.05 ? "background:color-mix(in srgb," + (s > 0 ? "var(--bad)" : "var(--accent)") + " " + Math.round(8 + Math.min(1, Math.abs(s)) * 30) + "%,var(--panel-deep,var(--panel)))" : "");
  const toneC = s => (finite(s) ? (s >= 0.05 ? "tt" : s <= -0.05 ? "tl" : "tn") : "tn");
  const chip = (txt, s) => (txt ? '<span class="dv ' + toneC(s) + '">' + esc(txt) + "</span>" : "");
  /* Normal for a date: the file's daily normal averaged over ±7 days, because a same-date average of only a
     few years is noisy. Preferred source is data/nordic_normals.json (2023–25, pre-windowed). */
  const nbasis = (z, PN) => (PN && PN.pre ? "2023–25" : z === "Nordic" ? "2024–25" : "2021–25");
  function normalAt(PN, z, ymd) {
    if (!PN || !PN.normal || !PN.month_days || !ymd) return null;
    const md = PN.month_days, a = PN.normal[z], i = md.indexOf(String(ymd).slice(5, 10));
    if (i < 0 || !a) return null;
    if (PN.pre) return finite(a[i]) ? a[i] : null; /* data/nordic_normals.json: already the ±7-day window, 2023–25 */
    const w = [];
    for (let k = -7; k <= 7; k++) { const v = a[(i + k + md.length) % md.length]; if (finite(v)) w.push(v); }
    return w.length >= 10 ? mean(w) : null;
  }
  /* Long-term seasonal normal from data/nordic_normals.json for a date (trailing-30-day series). */
  function nnAt(NN, key, ymd) {
    const b = NN && NN[key], md = NN && NN.month_days, i = md && ymd ? md.indexOf(String(ymd).slice(5, 10)) : -1;
    return b && i >= 0 && finite(b.normal_30d[i]) ? b.normal_30d[i] : null;
  }
  const yrs = b => (b && b.years && b.years.length ? b.years[0] + "–" + String(b.years[b.years.length - 1]).slice(2) : "");
  function tomorrowAvg(T, z) {
    const r = T && T.regions && T.regions[z];
    if (!r || !Array.isArray(r.price) || (r.complete && r.complete.price === false)) return null;
    const f = r.price.filter(finite);
    return f.length >= 23 ? mean(f) : null;
  }
  function weekBand(res, ymd) { const w = isoWeek(ymd), b = res && res.band && res.band.find(x => x[0] === w); return b && finite(b[1]) && finite(b[2]) && finite(b[3]) ? { min: b[1], med: b[2], max: b[3] } : null; }
  /* Nuclear availability: the nordic-v2 build and the live-data UMM file (power.json) come from the same Nord Pool
     UMM feed; the newer one is used, so Live Pulse and the Nordic power overview show the same figure. */
  function nuclearNow(G, power) {
    const na = (G && G.nuclear_availability) || null, pn = power && power.nuclear;
    if (pn && pn.cap && pn.now && Array.isArray(pn.units) && (!na || Date.parse(pn.asof) > Date.parse(na.observed_at))) {
      return { as_of: zurichDay(new Date(pn.asof)), observed_at: pn.asof, installed_mw: pn.cap, online_mw: pn.now, reactors_out: pn.units, source: pn.source, definition: "available capacity from active REMIT messages; not measured generation", days: pn.days, fromLive: true };
    }
    return na;
  }
  function reactorsNow(na) {
    const t = Date.parse(na && na.observed_at) || Date.now();
    return ((na && na.reactors_out) || []).filter(r => finite(r.cap) && finite(r.now) && r.now < r.cap && !(Date.parse(r.start) > t));
  }
  function nordicStress(N) {
    const parts = [], missing = [];
    const put = (id, label, o) => { if (!o || !finite(o.score)) { missing.push(label); return; } parts.push(Object.assign({ id: id, label: label }, o, { score: clamp(o.score) })); };
    const P = N && N.prices, PN = N && N.normals, G = (N && N.generation) || {};
    /* 1 system price vs its 3-year (2023–25) normal for the same weeks: context only, not scored */
    const pr = lastOf(P && P.regions && P.regions.Nordic && P.regions.Nordic.rows), pn = pr && normalAt(PN, "Nordic", pr[0]);
    const price = (pr && finite(pr[1]) && finite(pn) && pn > 0) ? { value: pr[1], normal: pn, dev: (pr[1] / pn - 1) * 100, score: (pr[1] / pn - 1), shown: n1(pr[1]) + " €/MWh", chipT: sg((pr[1] / pn - 1) * 100, 0) + "%", when: ["Delivery", dayText(pr[0])], cause: "system price " + Math.abs(Math.round((pr[1] / pn - 1) * 100)) + "% " + (pr[1] >= pn ? "above" : "below") + " its " + nbasis("Nordic", PN) + " normal", rule: "against the " + nbasis("Nordic", PN) + " average for the same weeks (date ±7 days)." } : null;
    /* 2 Norwegian reservoirs vs NVE median for the week */
    const no = N && N.hydrology && N.hydrology.reservoirs && N.hydrology.reservoirs.NO, nr = lastOf(no && no.rows), nb = nr && weekBand(no, nr[0]);
    put("res", "Reservoirs", nr && finite(nr[1]) && nb ? { value: nr[1], normal: nb.med, dev: nr[1] - nb.med, score: -(nr[1] - nb.med) / 10, shown: n1(nr[1]) + "% NO", chipT: sg(nr[1] - nb.med) + " pp", when: ["Observed", "week of " + dayText(nr[0])], cause: "Norwegian reservoirs " + Math.abs(nr[1] - nb.med).toFixed(1) + " pp " + (nr[1] < nb.med ? "below" : "above") + " median", rule: "pp below the NVE 2006–25 median for the week; 10 pp below scores fully tight." } : null);
    /* 3 nuclear: online capacity as % of full installed SE + FI capacity (nameplates in the UMM reactor list),
       scored by fixed bands of that share (nucScore); no normal or history */
    const NN = N && N.nn;
    const na = G.nuclear_availability || {}, on = Object.values(na.online_mw || {}).filter(finite).reduce((a, b) => a + b, 0), inst = Object.values(na.installed_mw || {}).filter(finite).reduce((a, b) => a + b, 0);
    const pct = inst > 0 ? on / inst * 100 : null;
    const outs = reactorsNow(na), off = outs.filter(r => r.now === 0).length, red = outs.length - off;
    put("nuc", "Nuclear", finite(pct) ? { value: pct, on: on, inst: inst, score: nucScore(pct), band: nucBand(pct), shown: Math.round(pct) + "% of capacity", chipT: nucBand(pct), when: ["Observed", zurich(na.observed_at, true) || dayText(na.as_of)], cause: "nuclear at " + Math.round(pct) + "% of installed capacity, " + (on / 1000).toFixed(1) + " of " + (inst / 1000).toFixed(1) + " GW" + (off ? " (" + off + " reactor" + (off > 1 ? "s" : "") + " out" + (red ? ", " + red + " reduced" : "") + ")" : ""), rule: "online capacity " + n0(on) + " of " + n0(inst) + " MW installed (SE " + n0((na.installed_mw || {}).SE) + " + FI " + n0((na.installed_mw || {}).FI) + "), " + Math.round(pct) + "% online. " + NUC_BANDS } : null);
    /* 4 wind load factor, 30 days vs the same period in earlier years */
    const wl = lastOf((((G.regions || {}).Nordic || {}).metrics || {}).wind_load_factor && G.regions.Nordic.metrics.wind_load_factor.rows);
    const wn = wl && (nnAt(NN, "wind_lf", wl[0]) != null ? nnAt(NN, "wind_lf", wl[0]) : wl[3]), wy = nnAt(NN, "wind_lf", wl && wl[0]) != null ? yrs(NN.wind_lf) : "earlier years";
    put("wind", "Wind 30d", wl && finite(wl[2]) && finite(wn) ? { value: wl[2], normal: wn, years: wy, dev: wl[2] - wn, score: -(wl[2] - wn) / 10, shown: n1(wl[2]) + "% LF", chipT: sg(wl[2] - wn) + " pp", when: ["Observed", "to " + dayText(wl[0])], cause: "wind load factor " + n1(wl[2]) + "% vs " + n1(wn) + "% normal (" + wy + ")", rule: "30-day Nordic wind load factor against its long-term normal for the same 30 days, " + n1(wn) + "% (" + wy + ", each year's output over that year's installed capacity); 10 pp short scores fully tight." } : null);
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
    if (pr && finite(pr[1]) && finite(ta) && T.delivery_date > pr[0]) out.push({ href: "#energy/prices", t: "system price for " + dayText(T.delivery_date) + " " + n1(ta) + " €/MWh, " + sg((ta / pr[1] - 1) * 100, 0) + "% on " + dayText(pr[0]) });
    const no = N && N.hydrology && N.hydrology.reservoirs && N.hydrology.reservoirs.NO, rr = no && no.rows;
    if (rr && rr.length > 1 && finite(rr[rr.length - 1][1]) && finite(rr[rr.length - 2][1])) out.push({ href: "#energy/hydro", t: "Norway reservoirs " + sg(rr[rr.length - 1][1] - rr[rr.length - 2][1]) + " pp in the week to " + dmy(rr[rr.length - 1][0]) });
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
  /* Reservoir filling against the published range for the same week (shared with nordiclanding.js). */
  function resBar(R, k, lab, u) {
    const r = R[k], x = lastOf(r && r.rows), b = x && weekBand(r, x[0]);
    if (!x || !b || !finite(x[1])) return "";
    const lo = Math.min(b.min, x[1]), hi = Math.max(b.max, x[1]), sc = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(1);
    const s = -(x[1] - b.med) / (u === "%" ? 10 : b.med * 0.15);
    return '<div class="nres"><span class="nrl"><b>' + esc(lab) + "</b> " + esc(n1(x[1]) + (u === "%" ? "%" : " TWh")) + " " + chip(sg(x[1] - b.med) + (u === "%" ? " pp" : " TWh"), s) + '</span><span class="nrb"><i class="rng" style="left:' + sc(b.min) + "%;right:" + (100 - sc(b.max)) + '%"></i><i class="med" style="left:' + sc(b.med) + '%"></i><b class="' + toneC(s) + '" style="left:' + sc(x[1]) + '%"></b></span><span class="kw">' + esc("wk of " + dmy(x[0]) + " · range " + n1(b.min) + "–" + n1(b.max)) + "</span></div>";
  }
  function nordicParts(N, zday) {
    if (!N || !N.prices) return "<p>" + NA + "</p>";
    const P = N.prices, PN = N.normals, T = N.tomorrow, G = N.generation || {};
    const st = nordicStress(N), out = [];
    /* stress gauge */
    const pos = finite(st.score) ? 50 + st.score / 2 : null;
    const pc = st.price ? '<span class="nin npx" style="' + tint(clamp(st.price.score)) + '"' + popAttr({ title: "System price", value: st.price.shown, explain: "Shown for context, not part of the balance score (the score uses supply drivers only). " + sg(st.price.dev, 0) + "% against the " + nbasis("Nordic", PN) + " average for the same weeks (" + n1(st.price.normal) + " €/MWh, date ±7 days).", fresh: st.price.when.join(" "), links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]]] }) + ' tabindex="0"><b>Price</b> ' + esc(st.price.shown) + "</span>" : "";
    const chips = pc + st.parts.map(p => '<span class="nin" style="' + tint(p.score) + '"' + popAttr({ title: p.label, value: p.shown, explain: "Scores " + (p.score > 0 ? "+" : "") + p.score.toFixed(2) + " (tight +1, loose −1): " + p.rule, fresh: p.when.join(" "), links: ({ price: [["#energy/prices", NP]], res: [["#energy/hydro", ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"]]], nuc: [["#energy/generation", ENTSOE]], wind: [["#energy/generation", ENTSOE]], temp: [["#energy/weather", ERA5]] }[p.id] || []).reduce((l, x) => l.concat([[pageLab(x[0]), x[0]], ["Source: " + x[1][0], x[1][1]]]), []) }) + ' tabindex="0"><b>' + esc(p.label) + "</b> " + esc(p.shown) + " " + chip(p.chipT, p.score) + "</span>").join("");
    const big = st.parts.length ? reactorsNow(G.nuclear_availability).filter(r => r.planned === false).sort((a, b) => (b.cap - b.now) - (a.cap - a.now))[0] : null;
    const ch = nordicChanges(N);
    out.push('<div class="nstress"' + popAttr({ title: "Nordic balance", explain: "Four supply drivers, each scored from −1 (loose) to +1 (tight) and averaged: reservoirs, wind and temperature against their normals, nuclear by the share of installed capacity online (" + NUC_BANDS + "); ±25 or beyond reads tight or loose. Price is not scored: it is the outcome. Inputs with no data are left out." + (st.missing.length ? " Left out: " + st.missing.join(", ") + "." : ""), fresh: "Each input shows its own date", links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]], ["Source: NVE reservoirs", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"], ["Source: " + ENTSOE[0], ENTSOE[1]]] }) + ">" +
      '<div class="nsg"><div class="nsh"><span class="kl">Nordic balance</span><span class="nss ' + (st.label === "Tight" ? "tt" : st.label === "Loose" ? "tl" : "tn") + '">' + (finite(st.score) ? (st.score > 0 ? "+" : st.score < 0 ? "−" : "") + Math.abs(st.score) + " " + esc(st.label) : "Not enough inputs") + "</span></div>" +
      '<div class="nbar"><i class="nbl"></i><i class="nbt"></i>' + (finite(pos) ? '<b style="left:' + pos.toFixed(1) + '%"></b>' : "") + '</div><div class="nbk"><span>Loose</span><span>Normal</span><span>Tight</span></div></div>' +
      '<div class="nsc">' + (st.cause ? '<p class="ncause">' + esc(st.cause) + "</p>" : "") +
      (ch.length ? '<p class="nchg"><b>What changed:</b> ' + ch.map(c => '<a class="lk" href="' + c.href + '">' + esc(c.t) + "</a>").join("; ") + ".</p>" : "") +
      (big ? '<p class="nout"><span class="dv tt">Unplanned</span> Largest unplanned outage: <a class="lk" href="#energy/generation"><b>' + esc(big.n) + "</b></a> " + esc(n0(big.cap - big.now)) + " MW off" + (big.back ? ", expected back " + esc(zurich(big.back, true)) : "") + ' <span class="kw">(nuclear only)</span> <span class="xl"><a href="#energy/generation">EMMi: Nordic generation →</a> · <a href="https://umm.nordpoolgroup.com/" target="_blank" rel="noopener noreferrer">Source: Nord Pool UMM ↗</a></span></p>' : '<p class="nout"><span class="kw">No unplanned nuclear outage reported (nuclear is the only outage feed here).</span></p>') +
      "</div></div>" + '<div class="nins">' + chips + "</div>" + (st.missing.length ? '<p class="fnote keep">Left out of the balance: ' + esc(st.missing.join(", ")) + " (no data).</p>" : ""));
    /* zone heat strip */
    const today = lastOf(P.regions && P.regions.Nordic && P.regions.Nordic.rows), d0 = today && today[0];
    const hasNext = T && T.delivery_date && d0 && T.delivery_date > d0 && finite(tomorrowAvg(T, "Nordic"));
    const useNext = zday === "next" && hasNext, dd = useNext ? T.delivery_date : d0;
    const val = z => (useNext ? tomorrowAvg(T, z) : (() => { const r = lastOf(P.regions[z] && P.regions[z].rows); return r && r[0] === d0 && finite(r[1]) ? r[1] : null; })());
    const sys = val("Nordic");
    const cells = ZONES.map(z => {
      const v = val(z), n = normalAt(PN, z, dd), dv = finite(v) && finite(n) && n > 0 ? (v / n - 1) * 100 : null, spr = z !== "Nordic" && finite(v) && finite(sys) ? v - sys : null;
      return '<a class="nz" href="#energy/prices" style="' + tint(finite(dv) ? dv / 100 : null) + '"' + popAttr({ title: zlab(z) + " day-ahead", value: finite(v) ? n1(v) + " €/MWh" : null, explain: (finite(n) ? "Normal for the same weeks (" + nbasis(z, PN) + ", date ±7 days) " + n1(n) + " €/MWh" + (finite(dv) ? ", " + sg(dv, 0) + "%" : "") + ". " : "No normal for this zone. ") + (finite(spr) ? "Spread to the system price " + sg(spr) + " €/MWh: a gap shows grid congestion." : "The system price is the unconstrained Nordic reference."), fresh: "Delivery " + dayText(dd) + (useNext ? " (published by Nord Pool, average of the hourly prices)" : ""), links: [[pageLab("#energy/prices"), "#energy/prices"], ["Source: " + NP[0], NP[1]]] }) + '><span class="zn">' + esc(zlab(z)) + '</span><span class="zv">' + (finite(v) ? esc(n0(v)) : "–") + '</span><span class="zs">' + (z === "Nordic" ? "system" : finite(spr) ? esc(sg(spr, 0)) : "") + "</span></a>";
    }).join("");
    const btn = (k, t) => '<button type="button" data-lp-zday="' + k + '" aria-pressed="' + ((k === "next") === !!useNext) + '"' + (k === "next" && !hasNext ? " disabled" : "") + ">" + t + "</button>";
    out.push('<div class="nzh"><span class="kl">Day-ahead by zone, €/MWh · colour = against the ' + (PN && PN.pre ? "2023–25 average for the same weeks" : "normal for the date") + ' · small figure = spread to the system price</span><span class="cdl-scale" role="group" aria-label="Delivery day">' + btn("today", d0 ? dayText(d0) : "Today") + btn("next", hasNext ? dayText(T.delivery_date) : "Next day") + '</span></div><div class="nzs">' + cells + "</div>" + tagFr(["Delivery", dayText(dd) + (useNext ? " · average of Nord Pool's hourly prices" : "")]).replace('class="kw"', 'class="kw nzw"'));
    /* cards */
    const cards = [], named = {};
    const cput = (k, h) => { cards.push(h); named[k] = (named[k] || "") + h; };
    const sp = st.parts.reduce((o, p) => (o[p.id] = p, o), { price: st.price });
    const pr = P.regions.Nordic.rows.slice(-30).map(r => [r[0], r[1], normalAt(PN, "Nordic", r[0])]);
    cput("price", ncard({ title: "System price", value: sp.price ? sp.price.shown : null, chipT: null, s: sp.price && clamp(sp.price.score), sub: sp.price ? nbasis("Nordic", PN) + " normal " + n1(sp.price.normal) + " · 30-day avg " + n1(mean(pr.map(x => x[1]))) : null, body: spark(pr, true), when: sp.price && sp.price.when, href: "#energy/prices", src: NP, explain: (sp.price ? sg(sp.price.dev, 0) + "% against normal. " : "") + "Nord Pool system price, daily average, last 30 days. Dashed line: the " + nbasis("Nordic", PN) + " average for the same weeks (date ±7 days; 2023 from Nord Pool's system price as republished by Energinet). Red shading where above normal, blue where below." }));
    const M = ((G.regions || {}).Nordic || {}).metrics || {};
    const gser = (m, d) => ((M[m] && M[m].rows) || []).slice(-30).map(r => [r[0], r[1], r[3]]);
    const gl = (m) => lastOf(M[m] && M[m].rows);
    const nuc = sp.nuc, nr = gl("nuclear"), NN = N.nn || {}, na0 = G.nuclear_availability || {};
    const nsr = nuc ? ((M.nuclear && M.nuclear.rows) || []).slice(-30).map(r => [r[0], finite(r[1]) ? r[1] / nuc.inst * 100 : null, 100]) : [];
    cput("nuclear", ncard({ title: "Nuclear", value: nuc ? nuc.shown : null, chipT: nuc && nuc.band, s: nuc && nuc.score, sub: nuc ? (nuc.on / 1000).toFixed(1) + " of " + (nuc.inst / 1000).toFixed(1) + " GW installed online · " + n0(nuc.inst - nuc.on) + " MW off" : null, body: spark(nsr, null), when: nuc && nuc.when, href: "#energy/generation", src: ["Nord Pool UMM", "https://umm.nordpoolgroup.com/"], explain: "Swedish and Finnish nuclear: capacity online now as a share of full installed capacity, " + (nuc ? n0(nuc.inst) + " MW (SE " + n0((na0.installed_mw || {}).SE) + " + FI " + n0((na0.installed_mw || {}).FI) + ", reactor nameplates in the Nord Pool UMM list)" : "") + ". Line: daily output over that installed capacity, last 30 days; dashed: installed capacity (100%). " + NUC_BANDS }));
    const hy = gl("hydro"), hs = hy && finite(hy[2]) && finite(hy[3]) ? (hy[2] / hy[3] - 1) : null;
    cput("hydro", ncard({ title: "Hydro output", value: hy && finite(hy[1]) ? n0(hy[1]) + " MW" : null, chipT: finite(hs) ? sg(hs * 100, 0) + "% 30d" : null, s: null, sub: hy && finite(hy[3]) ? "30-day " + n0(hy[2]) + " vs normal " + n0(hy[3]) + " MW" : null, body: spark(gser("hydro"), null), when: hy && ["Observed", "day " + dayText(hy[0])], href: "#energy/generation", src: ENTSOE, explain: "Nordic hydro output, daily average. Not coloured: high output can mean ample water or producers running hard at high prices. Dashed: same 30 days in earlier years." }));
    const w = sp.wind, wl = gl("wind_load_factor");
    cput("wind", ncard({ title: "Wind", value: wl && finite(wl[1]) ? n1(wl[1]) + "% load factor" : null, chipT: w && w.chipT + " 30d", s: w && w.score, sub: w ? "30-day " + n1(w.value) + "% vs long-term normal " + n1(w.normal) + "% (" + w.years + ")" : null, body: spark(((M.wind_load_factor && M.wind_load_factor.rows) || []).slice(-30).map(r => [r[0], r[1], nnAt(NN, "wind_lf", r[0])]), false), when: wl && ["Observed", "day " + dayText(wl[0])], href: "#energy/generation", src: ENTSOE, explain: "Nordic wind output (SE, NO, FI, DK) as a share of installed capacity. Line: daily load factor; dashed: long-term normal for the same 30 days, " + yrs(NN.wind_lf) + ", each year's output over that year's capacity. Below normal (red) means less cheap supply." }));
    const tm = (((N.weather || {}).regions || {}).Nordic || {}).metrics || {}, tt = sp.temp, cov = (N.weather || {}).coverage || {};
    const tsr = ((tm.temp && tm.temp.rows) || []).slice(-30).map(r => [r[0], r[1], r[3]]), tl = lastOf(tsr);
    cput("temp", ncard({ title: "Temperature, 30-day", value: tt && finite(tt.value) ? n1(tt.value) + " °C" : tl && finite(tl[1]) ? n1(tl[1]) + " °C" : null, chipT: tt && tt.chipT + " vs normal", s: tt && tt.score, sub: [tt ? "normal " + n1(tt.normal) + " °C" : null, tl && finite(tl[1]) ? "latest day " + n1(tl[1]) + (finite(tl[2]) ? " vs " + n1(tl[2]) : "") + " °C" : null].filter(Boolean).join(" · ") || null, body: spark(tsr, false), when: tl && ["Observed", "to " + dayText(tl[0]) + (cov.forecast_from ? " · forecast fill from " + dmy(cov.forecast_from) : "")], href: "#energy/weather", src: ERA5, explain: "Nordic land-area temperature, daily. Colder than normal (red) means more heating demand. ERA5 runs about five days behind; the last days are Open-Meteo forecast until ERA5 catches up." }));
    /* reservoir gauge vs the published range */
    const R = (N.hydrology || {}).reservoirs || {};
    const rbar = (k, lab, u) => resBar(R, k, lab, u);
    const rres = rbar("NO", "Norway", "%") + rbar("SE", "Sweden", "TWh") + rbar("FI", "Finland", "TWh");
    cput("reservoirs", ncard({ title: "Reservoirs vs range", novalue: true, body: rres || "<span class=\"na\">Not available yet</span>", when: R.NO && ["Observed", "weekly, latest " + dayText(lastOf(R.NO.rows)[0])], href: "#energy/hydro", src: ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"], explain: "Reservoir filling against the published range for the same week: shaded band = min to max, tick = median (Norway: NVE 2006–25; Sweden and Finland: ENTSO-E 2015–25, TWh). Below median is red." }));
    /* tomorrow's hourly shape */
    const tp = T && T.regions && T.regions.Nordic && Array.isArray(T.regions.Nordic.price) ? T.regions.Nordic.price : null;
    if (tp && tp.filter(finite).length >= 23) {
      const f = tp.filter(finite), mx = Math.max.apply(null, f), mn = Math.min.apply(null, f), base = Math.min(0, mn);
      const hrs = (T.hours || []).map(h => String(h).slice(11, 16));
      const iMx = tp.indexOf(mx), iMn = tp.indexOf(mn);
      const bars = tp.map((v, i) => finite(v) ? '<i class="' + (i === iMx ? "pk" : i === iMn ? "tr" : "") + '" style="height:' + (6 + (v - base) / (mx - base || 1) * 94).toFixed(1) + '%" title="' + esc((hrs[i] || i) + " " + n1(v) + " €/MWh") + '"></i>' : "<i></i>").join("");
      const dn = normalAt(PN, "Nordic", T.delivery_date), av = mean(f);
      cput("hourly", ncard({ title: "System price by hour, " + dayText(T.delivery_date), wide: true, value: n1(av) + " €/MWh average", chipT: null, s: finite(dn) ? clamp(av / dn - 1) : null, body: '<div class="nhr">' + bars + '</div><div class="nhk"><span>' + esc(hrs[0] || "00:00") + '</span><span><b class="pk">Peak</b> ' + esc(n0(mx)) + " at " + esc(hrs[iMx] || "") + ' · <b class="tr">Trough</b> ' + esc(n0(mn)) + " at " + esc(hrs[iMn] || "") + "</span><span>" + esc(hrs[hrs.length - 1] || "23:00") + "</span></div>", when: ["Delivery", dayText(T.delivery_date) + " · published " + (zurich(T.built_at, true) || dayText(T.as_of))], href: "#energy/prices", src: NP, explain: (finite(dn) ? "Day average " + sg((av / dn - 1) * 100, 0) + "% against the " + nbasis("Nordic", PN) + " normal for the same weeks (" + n1(dn) + " €/MWh). " : "") + "Hourly Nordic system prices from Nord Pool's day-ahead auction, Zurich time. A sharp morning or evening peak usually means low wind or tight transmission in those hours." }));
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
      cput("fut", ncard({ title: "Nordic " + (c || (k === "front_month" ? "front month" : "next quarter")), value: finite(v.p) ? n1(v.p) + " €/MWh" : null, chipT: null, s: finite(dv) ? clamp(dv) : null, sub: [finite(nm) ? "normal " + n1(nm) + " (" + nbasis("Nordic", PN) + ")" : null, finite(v.d1) ? "1D " + sg(v.d1, 2) + " €" : null].filter(Boolean).join(" · ") || null, when: x.as_of ? ["Settle", "EEX " + dayText(x.as_of)] : null, href: "#energy/prices", src: ["EEX power futures", "https://www.eex.com/en/market-data/power/futures"], explain: (finite(dv) ? sg(dv * 100, 0) + "% against normal. " : "") + "EEX Nordic base-load futures settlement: the market's expected average system price for the period, against the same months' system price in " + nbasis("Nordic", PN) + "." }));
    });
    out.push('<div class="kpis ncards">' + cards.join("") + "</div>");
    out.named = named;
    return out;
  }
  function nordicHTML(N, zday) { const o = nordicParts(N, zday); return Array.isArray(o) ? o.join("") : o; }
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
  /* Catalysts ahead: the next dated events from the EMMi events log. Each opens its EMMi entry,
     with the company page and the outside source beside it. */
  function catalystsHTML(ev, by, n) {
    const today = zurichDay();
    const all = ((ev && ev.events) || []).filter(e => e && e.id && (e.sort_date || e.date) >= today).sort((a, b) => String(a.sort_date || a.date).localeCompare(String(b.sort_date || b.date))).slice(0, n || 6);
    if (!all.length) return "";
    const coOf = e => { const rows = Object.values(by || {}); const r = rows.find(x => x.kind === "equity" && (x.name === e.company || (e.ticker && String(x.sym).split(".")[0] === e.ticker))); return r ? r.sym : null; };
    const li = e => {
      const co = coOf(e), u = safeURL(e.source);
      return '<li><span class="ct-d">' + esc(e.date_label || dayText(e.date)) + (e.confidence === "guidance" ? ' <span class="fr pc" title="A company or official window, not a fixed day">Guided</span>' : e.confidence === "confirmed" ? ' <span class="fr cl" title="A published day on the company or exchange calendar">Confirmed</span>' : "") + '</span><a class="ct-t" href="#companies/events/' + esc(encodeURIComponent(e.id)) + '"><b>' + esc(e.company) + "</b> " + esc(e.title) + "</a>" +
        '<span class="ct-x">' + (co ? '<a href="#co=' + esc(encodeURIComponent(co)) + '" data-co="' + esc(co) + '">Company page</a>' : "") + (u ? (co ? " · " : "") + '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(e.source_name || "Source") + " ↗</a>" : "") + "</span></li>";
    };
    return '<ol class="lp-cat">' + all.map(li).join("") + '</ol><p class="fnote">From the EMMi events log' + (ev.as_of ? ", compiled " + esc(dayText(ev.as_of)) : "") + ". Dates come only from company and exchange calendars; tap a line for its entry. No macro calendar is in the live files, so none is shown.</p>";
  }
  function nextUpHTML(ev, by) {
    const body = catalystsHTML(ev, by, 5);
    return '<section class="block lp-next" id="lpNext"><header class="bh"><h2>Next up</h2><a class="h3n" href="#companies/events">Company events log →</a></header>' + (body || "<p>No dated company events ahead in the events log.</p>") + "</section>";
  }
  /* Today's major company announcements (moved here from the retired Overview tab, t1416u): only a company-published
     item the deal-flow file already classes as major (M&A, raise, financing, PPA, FID, guidance, first production), dated
     today in Zurich, for a name on the coverage lists. Administrative filings and insider trades are left out. */
  const MAJOR = /\b(acqui(re|res|sition)|merger|combin(e|ation) with|takeover|offer (for|declared)|majority owner|investment platform|rights issue|placing|private placement|bond issu|final investment decision|\bFID\b|profit warning|(raises|lowers|cuts|withdraws) .*guidance|guidance (raised|cut|lowered)|first (oil|gas|power|gold)|commercial operation|discovery)\b/i;
  const ADMIN = /(8\.5 EPT\b|application for listing|\bForm 8(\.\d)?\b|Award of Options|Admission to Trading|Disclosure Table|Total Voting Rights|\bTVR\b|voting rights|Issue of Equity in Lieu|Publication and Posting|Supplementary Letter|Directorate change|Board Change|Block ?listing|Acceptance Level Update|Exercise of (Share )?(Awards|Options)|publication of (a )?prospectus|Prospectus and listing)/i;
  function majorDeal(it) {
    if (!it || it.ty === "insider" || ADMIN.test(it.h || "")) return false;
    const primary = it.src !== "yahoo" || /\b(Business ?Wire|PR ?Newswire|GlobeNewswire|NewMediaWire|ACCESS ?Newswire|Accesswire|Newsfile|Cision|RNS)\b/i.test(it.pub || "");
    return primary && (["ma", "raise", "financing", "ppa"].includes(it.ty) || MAJOR.test(it.h || ""));
  }
  function announcementsHTML(deals) {
    const cos = (deals && deals.cos) || {}, today = zurichDay();
    const items = ((deals && deals.items) || []).filter(it => { const t = Date.parse(it.t || ""); return isFinite(t) && zurichDay(new Date(t)) === today && cos[it.s] && majorDeal(it); })
      .sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 3);
    if (!items.length) return "";
    const li = it => '<li><span class="ct-d">' + esc(zurich(it.t) || "") + '</span><a class="ct-t" href="#co=' + esc(encodeURIComponent(it.s)) + '" data-co="' + esc(it.s) + '"><b>' + esc(cos[it.s].n || it.s) + "</b> " + esc(it.h || "") + "</a>" +
      (safeURL(it.u) ? '<span class="ct-x"><a href="' + esc(safeURL(it.u)) + '" target="_blank" rel="noopener noreferrer">Announcement ↗</a></span>' : "") + "</li>";
    return '<h3>Announcements today</h3><ol class="lp-cat lp-ann">' + items.map(li).join("") + '</ol><p class="fnote">Company-published items the deal-flow file classes as major, dated today (Zurich). Tap a name for its company page.</p>';
  }
  /* ---------- coverage baskets (t1443u, 20 Nov 2026) ----------
     The coverage lists as baskets, moved out of "Sectors". Median move of the names (not an average, so one penny stock cannot
     swing it), how many rose and fell, and a stable count: N = names with a price, the same for 1D, 1W and 1M. Tap a basket
     for its members. Display grouping only: the lists themselves live in emmi-data scripts/universe.py. */
  const NORDIC_X = /\.(OL|ST|CO|HE|IC)$/;
  const BASKETS = [
    { k: "majors", label: "Oil & gas majors", g: "energy", s: null, href: "#companies/oil" },
    { k: "lse", label: "London-listed E&Ps", g: "energy", s: "London-listed E&Ps", href: "#companies/oil" },
    { k: "nren", label: "Nordic renewables", g: "nordic", s: null, keep: r => NORDIC_X.test(r.sym), href: "#companies/renewables" },
    { k: "eren", label: "European renewables (ex-Nordic)", g: "nordic", s: null, keep: r => !NORDIC_X.test(r.sym), href: "#companies/renewables" },
    { k: "dc", label: "Data centres & powered land", g: "nordic", s: "Data centres & powered land", href: "#companies/renewables" },
    { k: "peers", label: "Strategic peers", g: "nordic", s: "Strategic peers", keep: r => !["KKR", "EQT.ST"].includes(r.sym), href: "#companies/renewables" },
    { k: "lundin", label: "Lundin Group", g: "lundin", s: null, href: "#companies/mining/mnLundin" },
    { k: "metals", label: "Metals & Mining", g: "metals", s: null, href: "#companies/mining/mnTable" }
  ];
  const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null; };
  function basketRows(market, def) {
    const g = ((market && market.groups) || []).find(x => x.id === def.g);
    const sec = g && (g.sections || []).find(x => (x.label || null) === def.s);
    return ((sec && sec.rows) || []).filter(r => r && r.kind === "equity" && !r.error && finite(r.px) && (!def.keep || def.keep(r)));
  }
  /* one calm tag for a basket: "Close 16:25–17:39 · Delayed 21:17" from its members' own tags */
  function basketTag(rows, gen) {
    const by = {};
    rows.forEach(r => { const f = fresh(r, gen); if (!f || !f.text) return; const m = /^(.*?)\s*(\d{1,2}:\d{2})$/.exec(f.text); const k = m ? m[1] : f.text; (by[k] = by[k] || []).push(m ? m[2] : ""); });
    const parts = Object.keys(by).map(k => { const t = by[k].filter(Boolean).sort(); return k + (t.length ? " " + t[0] + (t[t.length - 1] !== t[0] ? "–" + t[t.length - 1] : "") : ""); });
    return parts.length ? '<span class="fr cl">' + esc(parts.join(" · ")) + "</span>" : "";
  }
  function basketsHTML(market, p) {
    const gen = market && market.generated_utc;
    const items = BASKETS.map(def => {
      const rows = basketRows(market, def);
      if (rows.length < 3) return null;
      const vals = rows.map(r => ({ r: r, v: chg(r, p) })).map(x => Object.assign(x, { zs: zeroState(x.r, p, x.v) }));
      const live = vals.filter(x => finite(x.v) && x.zs !== "no trade");
      const med = median(live.map(x => x.v)), up = live.filter(x => x.v > 0).length, dn = live.filter(x => x.v < 0).length, un = live.length - up - dn;
      const nt = vals.filter(x => x.zs === "no trade").length, nh = vals.filter(x => !finite(x.v)).length;
      const typ = median(rows.map(r => typMove(r, p)).filter(finite));
      return { def: def, rows: rows, vals: vals, live: live, med: med, up: up, dn: dn, un: un, nt: nt, nh: nh, typ: typ };
    }).filter(Boolean).sort((a, b) => (finite(b.med) ? b.med : -1e9) - (finite(a.med) ? a.med : -1e9));
    if (!items.length) return "";
    const li = b => {
      const open = !!S.bkOpen[b.def.k], v = b.med, w = finite(v) ? barW(v, b.typ).toFixed(1) : "0";
      const cnt = b.up + " up · " + b.dn + " down" + (b.un ? " · " + b.un + " unch" : "") + (b.nt ? " · " + b.nt + " no trade" : "") + (b.nh ? " · " + b.nh + " without " + p + " history" : "");
      const srt = b.live.slice().sort((x, y) => y.v - x.v), best = srt[0], worst = srt[srt.length - 1];
      const mem = b.vals.slice().sort((x, y) => (finite(y.v) ? y.v : -1e9) - (finite(x.v) ? x.v : -1e9)).map(x => '<li><a href="#co=' + esc(encodeURIComponent(x.r.sym)) + '" data-co="' + esc(x.r.sym) + '">' + esc(x.r.name) + '</a> <span class="bx">' + esc(x.r.exch || x.r.sym) + "</span>" +
        '<span class="bt">' + tagHTML(fresh(x.r, gen)) + '</span><span class="fv ' + (x.zs ? "zs" : x.v > 0 ? "up" : x.v < 0 ? "dn" : "") + '">' + esc(x.zs || (finite(x.v) ? fmtChg(x.v, "%") : "–")) + "</span></li>").join("");
      return '<li class="bk' + (open ? " open" : "") + '"><button type="button" class="bk-h" data-lp-bk="' + esc(b.def.k) + '" aria-expanded="' + open + '"><span class="fn"><span class="fnm">' + esc(b.def.label) + ' <span class="fp">(' + b.rows.length + ")</span></span>" +
        '<span class="ft">' + esc(cnt) + " · " + basketTag(b.rows, gen) + "</span></span>" +
        '<span class="fb">' + (finite(v) ? '<i class="' + (v >= 0 ? "up" : "dn") + '" style="' + (v >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i>' : "") + "</span>" +
        '<span class="fv ' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + (finite(v) ? esc(fmtChg(v, "%")) : NA) + "</span></button>" +
        (open ? '<div class="bk-m"><p class="bk-s">' + (best ? "Best " + esc(best.r.name) + " " + esc(fmtChg(best.v, "%")) + " · worst " + esc(worst.r.name) + " " + esc(fmtChg(worst.v, "%")) + " · " : "") +
          '<a href="' + esc(b.def.href) + '">Open coverage list →</a></p><ol class="bk-l">' + mem + "</ol></div>" : "") + "</li>";
    };
    const btn = k => '<button type="button" data-lp-period="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>";
    return '<section class="block lp-baskets" id="lpBaskets"><header class="bh"><h2>Coverage baskets</h2><span class="bh-r">' + pstamp(market) + '<span class="cdl-scale lp-per" role="group" aria-label="Period">' + btn("1D") + btn("1W") + btn("1M") + "</span></span></header>" +
      '<ol class="lp-bk">' + items.map(li).join("") + "</ol>" +
      '<p class="fnote">Each basket is the median ' + p + ' move of the covered names in it (count in brackets = names with a price; it does not change with the period), with how many rose and fell. A name that traded but closed where it started shows "unch"; one with no trade today shows "no trade" and is left out of the median. Bar length is the median against the basket\'s typical move over the period (full bar = 3 typical moves). Tap a basket for its members, best and worst, and a link to the coverage list. Nordic renewables = names listed in Oslo, Stockholm, Copenhagen and Helsinki; the rest of the renewables list is European renewables. Strategic peers leaves out KKR and EQT (investment firms, not a sector). Some names sit in more than one basket (Fortum, RWE, Equinor, TotalEnergies, Lundin Mining, Lundin Gold, Orrön, Magnora, Solaria).</p></section>';
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
    const up = all.filter(r => chg(r, p) > 0).slice(0, 5), dn = all.filter(r => chg(r, p) < 0).slice(-5).reverse();
    return '<div class="movers"><div><h3>Up most · ' + p + "</h3><ol>" + (up.map(row).join("") || "<li>None up</li>") + "</ol></div><div><h3>Down most · " + p + "</h3><ol>" + (dn.map(row).join("") || "<li>None down</li>") + '</ol></div></div><p class="fnote">' + all.length + " covered names (Renewables, Oil & gas, Lundin Group, Metals & mining) with a " + p + " change in the live file. Tap a name for its company page.</p>";
  }


  /* ---------- page ---------- */
  const S = { host: null, timer: 0, data: {}, period: "1D", zday: "today", loadedAt: null, open: false, fdOpen: {}, bkOpen: {}, secReg: "us", riskOpen: false };
  function period() { try { const v = localStorage.getItem("emmaLivePeriod"); return ["1D", "1W", "1M"].includes(v) ? v : "1D"; } catch (e) { return "1D"; } }
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null); }
  async function load() {
    const t5 = Math.floor(Date.now() / EVERY), th = Math.floor(Date.now() / 36e5);
    const [market, gas, comment, prices, generation, hydrology, weather, normals0, tomorrow, events, nn, idx, power, deals] = await Promise.all([
      getJSON("data/market.json?t=" + t5), getJSON("data/gas.json?t=" + th), getJSON("data/live_comment.json?t=" + t5),
      getJSON(NV2 + "prices.json?t=" + th), getJSON(NV2 + "generation.json?t=" + th), getJSON(NV2 + "hydrology.json?t=" + th), getJSON(NV2 + "weather.json?t=" + th),
      getJSON(NV2 + "prices_normals.json?t=" + th), getJSON(NV2 + "tomorrow.json?t=" + th), getJSON("data/events.json?t=" + th), getJSON("data/nordic_normals.json?t=" + Math.floor(Date.now() / 864e5)),
      getJSON("/emmi/ed/live/data/index_detail.json?t=" + th), getJSON("data/power.json?t=" + th), getJSON("data/dealflow.json?t=" + th)
    ]);
    const gen = generation ? Object.assign({}, generation, { nuclear_availability: nuclearNow(generation, power) }) : generation;
    K.primeIdx(idx);
    S.data = { market, gas, comment, events, idx, deals, nordic: prices ? { prices, generation: gen, hydrology, weather, tomorrow, nn, normals: nn && nn.prices ? { pre: true, month_days: nn.month_days, normal: nn.prices.normal } : normals0 } : null };
    S.loadedAt = new Date();
  }
  /* schema 2: headline, 1-3 findings {headline, body, early, sources}, view (rendered last, in italics) */
  /* A finding's links: EMMi detail pages first (schema 2 "emmi": [{label, href: "#..."}], internal only),
     then outside sources. */
  function fdLinks(f, lk) {
    const em = (Array.isArray(f.emmi) ? f.emmi : []).filter(x => x && typeof x.href === "string" && /^#[\w\-\/=.%^]+$/.test(x.href)).slice(0, 3)
      .map(x => '<a class="fd-em" href="' + esc(x.href) + '">' + esc(x.label || "Open in EMMi") + " →</a>");
    const so = (f.sources || []).map(lk).filter(Boolean);
    return em.length || so.length ? '<p class="fd-src">' + em.join("") + (so.length ? '<span class="fd-so">' + (em.length ? "Sources: " : "") + so.join(" · ") + "</span>" : "") + "</p>" : "";
  }
  function briefHTML(c) {
    const src = c.source || {};
    const F = (c.findings || []).filter(f => f && f.headline).slice(0, 3);
    const lk = x => { const u = safeURL(x && x.url); return u ? '<a href="' + esc(u) + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(x.label || "source") + "</a>" : ""; };
    /* Findings start collapsed to the headline and two lines; links and sources stay visible. Opened ones stay open across refreshes. */
    const fd = (f, i) => {
      const long = f.body && f.body.length > 160, open = !long || S.fdOpen[f.headline];
      return '<li class="' + (open ? "" : "fd-c") + '"><span class="fd-n">' + (i + 1) + "</span><div><h3>" + esc(f.headline) + (f.early ? ' <span class="fr early">Before prices</span>' : "") + "</h3>" + (f.body ? '<p class="fd-b">' + esc(f.body) + "</p>" : "") +
        (long ? '<button type="button" class="fd-more" data-lp-more="' + esc(f.headline) + '" aria-expanded="' + !!open + '">' + (open ? "Show less" : "Read more") + "</button>" : "") + fdLinks(f, lk) + "</div></li>";
    };
    return cwLine(c) + '<section class="block lp-tone lp-brief" id="lpTone"><header class="bh"><p class="kick">The brief</p></header>' +
      "<h2>" + esc(c.headline) + "</h2>" +
      '<ol class="fds">' + F.map(fd).join("") + "</ol>" +
      (c.view ? '<p class="view"><em>' + esc(c.view) + "</em></p>" : "") +
      '<p class="from">Written from the price file of ' + esc(zurich(src.prices_at) || "a time not given") + " and news checks. The prices below are newer." + (safeURL(src.href) ? ' <a href="' + esc(src.href) + '">This morning\'s Pulse →</a>' : "") + "</p></section>";
  }
  /* "Commentary written HH:MM Zurich": only ever the commentary's own written_at, never a price time, so a price
     refresh cannot move it. Greyed with an "older" badge once a later scheduled slot has passed. */
  function cwLine(c) {
    const w = Date.parse((c && c.written_at) || "");
    if (!isFinite(w)) return '<p class="lp-cw">Commentary time not given</p>';
    const slot = latestSlot(Date.now()), old = commentaryOlder(c.written_at, Date.now()), p = zParts(w);
    const day = zurichDay(new Date(w)) === zurichDay() ? "" : " on " + p.weekday + " " + Number(p.day) + " " + p.month;
    return '<p class="lp-cw' + (old ? " old" : "") + '" title="When the commentary text was written. Quote times are on each price; a price refresh does not change this time.">Commentary written <b>' + esc(p.hour + ":" + p.minute) + "</b> Zurich" + esc(day) +
      (old ? ' <span class="fr old" title="The ' + esc(zParts(slot).hour + ":" + zParts(slot).minute) + ' Zurich slot has passed and its commentary is not in yet">older</span>' : "") + "</p>";
  }
  function toneHTML(c) {
    if (c && c.headline && (c.schema >= 2 || (c.findings || []).some(f => f && f.headline))) return briefHTML(c);
    if (!c || !c.headline) return '<section class="block lp-tone" id="lpTone"><header class="bh"><h2>Tone of the day</h2></header><p>' + NA + "</p></section>";
    const src = c.source || {};
    const fresh = src.kind && src.kind !== "pulse-edition";
    const views = (c.views || []).map(v => "<p><b>" + esc(v.section) + ".</b> " + esc(v.text) + "</p>").join("");
    return cwLine(c) + '<section class="block lp-tone" id="lpTone"><header class="bh"><p class="kick">Tone of the day</p></header>' +
      "<h2>" + esc(c.headline) + "</h2>" + (c.tone && !(c.body && c.body[0] && c.body[0].indexOf(c.tone) === 0) ? '<p class="tone">' + esc(c.tone) + "</p>" : "") +
      '<div class="tone-g"><div>' + (c.body && c.body.length ? "<ul>" + c.body.map(b => { const m = /^(.+?[.!?])(\s|$)/.exec(b); return "<li>" + (m ? "<b>" + esc(m[1]) + "</b>" + esc(b.slice(m[1].length)) : esc(b)) + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      (views ? '<aside class="views"><h3>Our view</h3>' + views + "</aside>" : "") + "</div>" +
      (c.risk_label ? '<p class="fnote keep">' + (fresh ? "Risk gauge when written: " : "Edition risk gauge: ") + esc(c.risk_label) + "</p>" : "") +
      (fresh
        ? '<p class="from">Written fresh for the ' + esc(src.slot || "") + " " + esc(src.edition || "update") + " from live prices" + (src.prices_at ? " (prices " + esc(zurich(src.prices_at) || "") + ")" : "") + " and news checks. Not live: the numbers below are." + (src.href ? ' <a href="' + esc(src.href) + '">Read this morning\'s Pulse →</a>' : "") + "</p></section>"
        : '<p class="from">From the ' + esc(src.edition || "last") + " Pulse email" + (src.sent ? ", sent " + esc(String(src.sent).split(", ").pop()) : "") + ". Not live: the numbers below are." + (src.href ? ' <a href="' + esc(src.href) + '">Read the full edition →</a>' : "") + "</p></section>");
  }
  function riskRows(g, by, market) {
    const mk = market;
    const RL = { vix: "^VIX", spx200: "^GSPC", stoxx200: "^STOXX", us10y: "^TNX", dxy: "DX-Y.NYB", gold: "GC=F", cugold: "HG=F" };
    const rows = g.parts.map(p => {
      const r = by[RL[p.id]], l = p.id === "breadth" ? { href: "#markets/mkt-indices", ext: false } : linkOf(r), lp = p.id === "cugold" ? null : pxu(r);
      const rule = "Gauge rule: " + p.rule + ".";
      const pop = p.id === "breadth" ? { title: p.label, value: p.shown, explain: "How many of the " + BREADTH.length + " tracked equity indices are up on the day. Narrow breadth means a few markets carry the move. " + rule, links: [[pageLab("#markets/mkt-indices"), "#markets/mkt-indices"]] }
        : p.id === "cugold" ? Object.assign(popFor(r, mk && mk.generated_utc) || {}, { title: p.label, value: p.shown, explain: "Copper's move against gold's. Copper outrunning gold reads as growth confidence; gold outrunning copper as caution. " + rule })
        : Object.assign(popFor(r, mk && mk.generated_utc) || { title: p.label, links: [] }, { title: p.label, explain: (EXPLAIN[RL[p.id]] || "") + " " + rule });
      const w = Math.min(50, Math.abs(p.contrib) * 50 / 12.5).toFixed(1);
      return "<tr" + popAttr(pop) + "><th>" + nameLink(p.label, l) + (lp ? ' <span class="lpx">' + esc(lp) + "</span>" : "") + "</th><td>" + esc(p.shown || "") + (p.id !== "breadth" && r ? " " + tagHTML(fresh(r, mk && mk.generated_utc)) : "") + '</td><td class="cb"><span class="fb"><i class="' + (p.contrib >= 0 ? "up" : "dn") + '" style="' + (p.contrib >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i></span></td><td class="cv ' + (p.contrib > 0 ? "up" : p.contrib < 0 ? "dn" : "") + '">' + (p.contrib > 0 ? "+" : p.contrib < 0 ? "−" : "") + Math.abs(p.contrib).toFixed(1) + "</td></tr>";
    }).join("");
    return rows;
  }
  /* ---------- 0 Risk Gauge strip (t1595u): slim, at the very top of the landing page; full breakdown behind one tap ---------- */
  const DRV = { vix: "VIX", breadth: "Breadth", spx200: "S&P vs 200d", stoxx200: "STOXX vs 200d", us10y: "US 10Y", dxy: "Dollar", gold: "Gold", cugold: "Copper/gold" };
  const RISK_TXT = "Each input is turned into a score from −1 (risk off) to +1 (risk on) and capped there. The gauge is the average score × 100, so it runs from −100 to +100; each row's contribution is its share of that total. Risk on at +25 or above, risk off at −25 or below, mixed in between. Equal weights. Day changes are the latest price against the previous close; each row's tag says whether that price is a delayed quote, today's close, a previous close or an official close, so a market that has not opened yet counts its last session.";
  function riskStripHTML(by, market) {
    const g = riskGauge(by), sc = g.score, ok = finite(sc);
    const band = !ok ? "na" : sc >= 25 ? "on" : sc <= -25 ? "off" : "mid";
    const num = ok ? (sc > 0 ? "+" : sc < 0 ? "−" : "") + Math.abs(sc) : "—";
    const top = g.parts.slice().sort((x, y) => Math.abs(y.contrib) - Math.abs(x.contrib)).slice(0, 3);
    const drv = top.map(p => '<span class="lp-rs-d"><span class="lp-rs-dn">' + esc(DRV[p.id] || p.label) + '</span> <b class="' + (p.contrib > 0 ? "up" : p.contrib < 0 ? "dn" : "") + '">' + (p.contrib > 0 ? "+" : p.contrib < 0 ? "−" : "") + Math.abs(p.contrib).toFixed(0) + "</b></span>").join("");
    const pos = ok ? ((sc + 100) / 2).toFixed(1) : null;
    const open = !!S.riskOpen;
    const rows = riskRows(g, by, market);
    const method = "<p>" + RISK_TXT + "</p><ul>" + RISK_METHOD.map(m => "<li><b>" + esc(m[1]) + ":</b> " + esc(m[2]) + "</li>").join("") + "</ul><p>Source: market.json on emmi-data (Yahoo Finance quotes, ~15-minute refresh). An input with no live value is left out, never filled in.</p>";
    return '<section class="lp-rs ' + band + (open ? " open" : "") + '" id="lpRiskStrip" aria-label="Risk gauge">' +
      '<button type="button" class="lp-rs-bar" data-lp-risk aria-expanded="' + open + '" aria-controls="lpRiskFull" title="Risk gauge: tap for the full breakdown">' +
      '<span class="lp-rs-k">Risk gauge</span><b class="lp-rs-sc">' + num + '</b><span class="lp-rs-band">' + esc(g.label || "Not available yet") + "</span>" +
      '<span class="lp-rs-m" role="img" aria-label="' + (ok ? "Score " + num + " on a scale from −100 (risk off) to +100 (risk on)" : "Score not available") + '"><i class="z off"></i><i class="z mid"></i><i class="z on"></i>' + (ok ? '<i class="mk" style="left:' + pos + '%"></i>' : "") + "</span>" +
      '<span class="lp-rs-drv">' + (drv ? '<span class="lp-rs-dk">Drivers</span>' + drv : "") + "</span>" +
      '<span class="lp-rs-x" aria-hidden="true"></span></button>' +
      '<div class="lp-rs-full" id="lpRiskFull"' + (open ? "" : " hidden") + '><div class="lp-rs-fh"><span>Contribution of each input, points out of ±100 · ' + pstamp(market) + '</span><button type="button" class="info" data-lp-info="lpRiskInfo" aria-expanded="false" aria-controls="lpRiskInfo" aria-label="How the gauge works">i</button></div>' +
      '<div class="lp-parts"><table><thead><tr><th>Input</th><th>Latest</th><th class="cb">Contribution</th><th class="cv">pts</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">' + NA + "</td></tr>") + "</tbody></table>" +
      (g.missing.length ? '<p class="fnote keep">Left out: ' + esc(g.missing.join("; ")) + ".</p>" : "") + "</div>" +
      '<div class="info-panel" id="lpRiskInfo" hidden>' + method + "</div></div></section>";
  }
  function flowHTML(market, by, p) {
    const pick = syms => syms.map(s => by[s]).filter(Boolean).map(r => ({ name: short(r), v: chg(r, p), u: unitOf(r), px: pxu(r), link: linkOf(r), typ: typMove(r, p), zs: zeroState(r, p, chg(r, p)), pop: popFor(r, market && market.generated_utc) }));
    const btn = k => '<button type="button" data-lp-period="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>";
    return '<section class="block lp-flow" id="lpFlow"><header class="bh"><h2>Where the money is going <span class="h3n">leading and lagging</span></h2><span class="bh-r">' + pstamp(market) + '<span class="cdl-scale lp-per" role="group" aria-label="Period">' + btn("1D") + btn("1W") + btn("1M") + "</span></span></header>" +
      '<div class="lp-flow-g">' + flowPanel(FLOW.regions.title, pick(FLOW.regions.syms), "Bars in every list here are drawn against each row's typical move for the period (full bar = 3 typical moves, from the past year's closes), not against the biggest move in the list.") + flowPanel(FLOW.commodities.title, pick(FLOW.commodities.syms)) + flowPanel(FLOW.fx.title, pick(FLOW.fx.syms), "Pair moves: EUR/USD up = euro stronger, USD/JPY up = dollar stronger.") + sectorsHTML(market, by, p, S.secReg) + "</div></section>";
  }
  /* Quick jumps from the landing page into the data tabs (t1592u). */
  const JUMPS = [["Equities", "#markets/mkt-indices"], ["Rates and FX", "#markets/mkt-rates"], ["Commodities", "#markets/mkt-cmd"], ["Metals", "#markets/metals"], ["Energy", "#energy"], ["Companies", "#companies"]];
  function jumpsHTML() {
    return '<nav class="lp-jump" id="lpJump" aria-label="Open the data"><span class="lp-jump-k">Open</span>' + JUMPS.map(([t, h]) => '<a class="lp-jp" href="' + h + '">' + esc(t) + "</a>").join("") + "</nav>";
  }
  function render() {
    const host = S.host;
    if (!host) return;
    const D = S.data, market = D.market, by = index(market);
    const p = S.period;
    REG.reset(); K.hidePop();
    GEN = market && market.generated_utc; REG.gen = GEN;
    /* Order (t1592u-t1595u): risk strip, the brief, where the money is going (tape, leading and lagging, quick jumps),
       coverage movers, next up. Markets tiles live on #markets; the Energy block moved to #energy. */
    host.innerHTML = '<div class="lp lp-v3" id="livePulse"><header class="lp-head"><h1 class="sr-only">EMMi Live Pulse</h1></header>' +
      riskStripHTML(by, market) +
      toneHTML(D.comment) +
      '<div class="lp-pulse" id="lpPulse">' + snapHTML(by, market && market.generated_utc, D.nordic) + jumpsHTML() + flowHTML(market, by, p) + "</div>" +
      '<section class="block lp-movers" id="lpMovers"><header class="bh"><h2>Coverage movers</h2>' + pstamp(market) + "</header>" + moversHTML(market, p) + announcementsHTML(D.deals) + "</section>" +
      basketsHTML(market, p) + nextUpHTML(D.events, by) +
      '<p class="asof lp-upd">Checked ' + esc(zurich(S.loadedAt && S.loadedAt.toISOString()) || "") + ' · refreshes every 5 min · <a href="#live/editions">Pulse and CSI editions</a></p>' +
      '<footer class="lp-foot"><p>Sources: The brief, data/live_comment.json (the sent Pulse email at 06:00, then written fresh at 12:00, 15:30 and 22:30). Risk gauge, leading and lagging and movers: market.json on the emmi-data live-data branch (Yahoo Finance quotes, typically about 15 minutes delayed; CNBC for live yield moves; official closes from the US Treasury, Bundesbank, Bank of England and SNB). Nordic system price: emmi-data nordic-v2 files (Nord Pool). Charts, tiles and sector maps are on Markets; Nordic power and gas storage on Energy. Commentary is market commentary, not investment advice.</p></footer></div>';
    const C = window.MMCandles;
    const root = host.querySelector("#livePulse");
    K.onScale("lp", () => { if (visible()) K.rescale(root); });
    if (C) C.wire(root, () => { K.rescale(root); if (K.sheetOpen()) K.openSheet(K.sheetOpen()); });
    K.refreshSheet(REG.rows);
  }
  function onClick(e) {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const rk = t.closest("[data-lp-risk]");
    if (rk) { S.riskOpen = !S.riskOpen; const box = rk.closest(".lp-rs"), full = S.host.querySelector("#lpRiskFull"); if (full) full.hidden = !S.riskOpen; if (box) box.classList.toggle("open", S.riskOpen); rk.setAttribute("aria-expanded", String(S.riskOpen)); return; }
    const zd = t.closest("[data-lp-zday]");
    if (zd) { if (!zd.disabled) { S.zday = zd.dataset.lpZday; render(); } return; }
    const per = t.closest("[data-lp-period]");
    if (per) { S.period = per.dataset.lpPeriod; try { localStorage.setItem("emmaLivePeriod", S.period); } catch (x) { /* private mode */ } render(); return; }
    const sr = t.closest("[data-lp-secreg]");
    if (sr) { S.secReg = sr.dataset.lpSecreg === "eu" ? "eu" : "us"; const box = sr.closest(".lp-sec"); if (box) { box.dataset.reg = S.secReg; box.querySelectorAll("[data-lp-secreg]").forEach(b => b.setAttribute("aria-pressed", String(b === sr))); } try { localStorage.setItem("emmiLpSecReg", S.secReg); } catch (x) { /* private mode */ } return; }
    const bk = t.closest("[data-lp-bk]");
    if (bk) { const k = bk.dataset.lpBk; S.bkOpen[k] = !S.bkOpen[k]; render(); return; }
    const more = t.closest("[data-lp-more]");
    if (more) { const k = more.dataset.lpMore, li = more.closest("li"), open = !S.fdOpen[k]; S.fdOpen[k] = open; if (li) li.classList.toggle("fd-c", !open); more.setAttribute("aria-expanded", String(open)); more.textContent = open ? "Show less" : "Read more"; return; }
    const inf = t.closest("[data-lp-info]");
    if (inf) { const pnl = S.host.querySelector("#" + inf.dataset.lpInfo); if (pnl) { pnl.hidden = !pnl.hidden; inf.setAttribute("aria-expanded", String(!pnl.hidden)); } return; }
    if (t.closest(".nchg a, .nout a")) return; /* explicit links inside the balance panel go straight through */
    if (K.hostClick(e)) return;   /* a tile opens its detail sheet; on touch the first tap on a name opens its card */
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
  function stop() { if (S.timer) clearInterval(S.timer); S.timer = 0; K.hidePop(); }
  /* ---------- keep the reader's place: K.savePlace / K.restorePlace in v2/shared/kit.js (site-wide) ---------- */
  function mount(host) {
    if (!host) return;
    S.host = host;
    S.period = period();
    try { S.secReg = localStorage.getItem("emmiLpSecReg") === "eu" ? "eu" : "us"; } catch (e) { S.secReg = "us"; }
    if (!host._lpWired) {
      host._lpWired = true; host.addEventListener("click", onClick); K.wirePop(host);
      /* toggle does not bubble: listen in the capture phase. Remember each expander and size its tiles once shown. */
      host.addEventListener("toggle", e => { const d = e.target; if (!d || !d.dataset || !d.dataset.lpExp) return; saveExp(d.dataset.lpExp, d.open); if (d.open) { const root = host.querySelector("#livePulse"); if (root) K.rescale(root); } }, true);
    }
    host.innerHTML = '<div class="lp" id="livePulse"><p class="kicker">EMMi</p><h1>Live Pulse</h1><p class="asof">Loading the live files…</p></div>';
    stop();
    if (window.EMMICot) EMMICot.load().catch(() => null);
    load().then(() => { render(); K.restorePlace(); K.backPill(); });
    S.timer = setInterval(tick, EVERY);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.timer && S.loadedAt && Date.now() - S.loadedAt > EVERY) tick(); });
  /* Shared with the Nordic power landing page (nordiclanding.js): same cards, gauge, colours and explainers.
     Cards and popovers come from v2/shared/kit.js; "scoped" points popAttr at the page's own registry. */
  const nordicKit = {
    scoped: (sc, fn) => { const was = CUR; CUR = K.reg(sc); CUR.reset(); try { return fn(); } finally { CUR = was; } },
    popAttr: popAttr, wirePop: K.wirePop, tapPop: e => { const t = e.target && e.target.closest ? e.target : null; return !!t && !t.closest(".nchg a, .nout a") && K.hostClick(e); }, hidePop: K.hidePop, canHover: () => K.canHover(),
    nordicParts: nordicParts, nordicStress: nordicStress, nordicChanges: nordicChanges, spark: spark, ncard: ncard, resBar: resBar,
    tint: tint, chip: chip, toneC: toneC, tagFr: tagFr, normalAt: normalAt, nnAt: nnAt, weekBand: weekBand, reactorsNow: reactorsNow, nuclearNow: nuclearNow, nucScore: nucScore, nucBand: nucBand, NUC_BANDS: NUC_BANDS,
    gasHTML: gasHTML, kpi: kpi, index: index, tape: (market, list) => '<div class="lp-snap nl-tape">' + tapeCells(index(market), market && market.generated_utc, list).join("") + "</div>", tomorrowAvg: tomorrowAvg, nbasis: nbasis, yrs: yrs, clamp: clamp, pageLab: pageLab, isoWeek: isoWeek,
    n0: n0, n1: n1, sg: sg, mean: mean, lastOf: lastOf, dayText: dayText, dmy: dmy, zurich: zurich, zurichDay: zurichDay, esc: esc, finite: finite,
    NA: NA, ZONES: ZONES, SRC: { NP: NP, ENTSOE: ENTSOE, ERA5: ERA5 }
  };
  window.EMMILivePulse = { pops: () => REG.pops, fresh: fresh, unitText: unitText, mount: mount, stop: stop, riskGauge: riskGauge, index: index, sectorsHTML: sectorsHTML, basketsHTML: basketsHTML, typMove: typMove, zeroState: zeroState, dayAhead: dayAhead, nordicStress: nordicStress, nordicChanges: nordicChanges, catalystsHTML: catalystsHTML, nextUpHTML: nextUpHTML, snapHTML: snapHTML, latestSlot: latestSlot, commentaryOlder: commentaryOlder, cwLine: cwLine, riskStripHTML: riskStripHTML, jumpsHTML: jumpsHTML, JUMPS: JUMPS, announcementsHTML: announcementsHTML, readPlace: K.readPlace, NOT_IN_FEED: NOT_IN_FEED, nordicKit: nordicKit };
})();
