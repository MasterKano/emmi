/* Markets: charts, tiles, tables and data only (Jerry 23 Nov 2026, t1592u-t1595u: no editorial prose here; notes sit behind
   i buttons). Same market.json the live page loads. Null is "not available yet", never zero.
   Equities (#markets/mkt-indices, the default view) is the time-ordered regional Equities Monitor of the Morning Pulse v1.10:
   regions newest session open first on the Zurich clock (v2/shared/regions.js, holiday-aware), each with its session pill,
   2 full rows of 4 candle tiles, then its sector map(s) straight underneath (US: S&P 500; Europe: Europe top 80; Asia:
   Nikkei 225 and CSI 300, side by side on a wide screen, stacked on a phone), drawn by v2/shared/treemap.js from emmi-data
   data/region_maps.json. Then Rates and FX, then Commodities.
   Tiles use the Live Pulse language (t1411u): price with its unit, 1D/1M, candles, 52-week range and a freshness tag;
   hover or tap for the explainer and links; a tile opens its detail sheet (chart, sectors and largest members).
   Commodities: IG-style groups, with the same tile sizing as the other Markets sections. A slim positioning bar
   sits under a tile when a weekly report exists (same width as the tile). The bar opens the full trader report;
   the price tile opens the chart, with the same report underneath. */
(function () {
  "use strict";
  const URLS = [
    "/emmi/ed/live/data/market.json",
    "/emmi/ed/main/data/market.json"
  ];
  const MAPS_URLS = ["/emmi/ed/live/data/region_maps.json"];
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const K = window.EMMIKit;   /* v2/shared/kit.js: Live Pulse tiles, freshness tags, hover cards, detail sheet */
  const REG = K.reg("mkt");
  let GEN = null;
  const PER_KEY = "emmiCmdPer";
  const PERIODS = ["1W", "1M", "3M", "1Y"];
  const SYM_COT = {
    "BZ=F": "brent", "CL=F": "wti", "HO=F": "ulsd", "RB=F": "rbob", "NG=F": "hh",
    "GC=F": "gold", "SI=F": "silver", "PL=F": "platinum", "PA=F": "palladium",
    "HG=F": "copper",
    "KC=F": "coffee", "CC=F": "cocoa", "SB=F": "sugar", "CT=F": "cotton", "OJ=F": "oj", "LBR=F": "lumber",
    "ZW=F": "wheat", "ZC=F": "corn", "ZS=F": "soybeans", "ZL=F": "soyoil", "ZM=F": "soymeal", "ZO=F": "oats", "ZR=F": "rice",
    "LE=F": "cattle", "HE=F": "hogs", "GF=F": "feeders",
    "TTF=F": "ttf", "CO2.L": "eua"
  };
  /* IG-style groups. Uranium and EU carbon stay in Energy (they were on the old Commodities strip). RBOB and
     feeder cattle appear when the market file carries them. extraCot = weekly reports with no price tile here. */
  const GROUPS = [
    { id: "energy", title: "Energy", syms: ["BZ=F", "CL=F", "HO=F", "RB=F", "NG=F", "TTF=F", "CO2.L", "U-UN.TO"], extraCot: ["gasoil"] },
    { id: "precious", title: "Precious metals", syms: ["GC=F", "SI=F", "PL=F", "PA=F"] },
    { id: "base", title: "Base metals", syms: ["HG=F", "ALI=F"] },
    { id: "softs", title: "Softs", syms: ["KC=F", "CC=F", "SB=F", "CT=F", "OJ=F", "LBR=F"], extraCot: ["cocoa_ldn", "robusta", "white_sugar"] },
    { id: "grains", title: "Grains and oilseeds", syms: ["ZW=F", "ZC=F", "ZS=F", "ZL=F", "ZM=F", "ZO=F", "ZR=F"] },
    { id: "livestock", title: "Livestock", syms: ["LE=F", "HE=F", "GF=F"] }
  ];
  const NOTE = "Under each price, a slim bar is that contract’s latest trader positioning (net long or short as a share of open interest), with a small CFTC, ICE or Endex label and the as-of date. Tap the bar for the full weekly report; tap the price for the chart, with the same report underneath. The 1W / 1M / 3M / 1Y buttons move the price only. No bar means there is no weekly report for that contract.";
  function period() {
    try { const v = localStorage.getItem(PER_KEY); if (PERIODS.includes(v)) return v; } catch (e) { /* private mode */ }
    return "1M";
  }
  function setPeriod(p) { if (!PERIODS.includes(p)) return; try { localStorage.setItem(PER_KEY, p); } catch (e) { /* private mode */ } }
  function cmdTile(r) { return K.tile(r, REG, GEN, { period: period() }); }
  function tile(r) { return K.tile(r, REG, GEN); }
  function section(title, rows, id) {
    return '<section class="block" id="' + esc(id) + '"><header class="bh"><h2>' + esc(title) + '</h2></header><div class="lpk"><div class="tiles">' + rows.map(tile).join("") + "</div></div></section>";
  }
  function rowsOf(group) {
    const out = [];
    (group.sections || []).forEach(s => (s.rows || []).forEach(r => out.push(r)));
    if (!out.length && group.rows) group.rows.forEach(r => out.push(r));
    return out;
  }
  function bySym(groups) {
    const by = {};
    (groups || []).forEach(g => rowsOf(g).forEach(r => { if (r && r.sym && !by[r.sym]) by[r.sym] = r; }));
    return by;
  }
  function picked(def, by) {
    const rows = def.syms.map(s => by[s]).filter(Boolean);
    const shown = new Set(rows.map(r => SYM_COT[r.sym]));
    const extraCot = (def.extraCot || []).filter(id => id !== "rbob" || !shown.has("rbob"));
    return { rows: rows, extraCot: extraCot };
  }
  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  function cotIds(rows) {
    return rows.map(r => SYM_COT[r.sym] || null);
  }
  function perBar() {
    const p = period();
    return '<div class="cmd-per" role="group" aria-label="Price period">' +
      PERIODS.map(k => '<button type="button" data-cmd-per="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>").join("") + "</div>";
  }
  function commoditiesHTML(by) {
    const parts = ['<section class="block" id="mkt-cmd"><header class="bh"><h2>Commodities</h2>' + perBar() + "</header>" +
      '<p class="inote-src">' + esc(NOTE) + "</p>"];
    GROUPS.forEach(def => {
      const { rows, extraCot } = picked(def, by);
      if (!rows.length) return;
      parts.push('<div class="cmd-sub" id="mkt-cmd-' + esc(def.id) + '"><h3>' + esc(def.title) + "</h3>");
      parts.push('<div class="cmd-band lpk"><div class="tiles cmd-tiles cmd-stacks">' +
        rows.map(r => '<div class="cmd-stack">' + cmdTile(r) + '<div class="cot-slim-slot" data-cot-sym="' + esc(r.sym) + '"></div></div>').join("") +
        "</div></div>");
      parts.push("</div>");
    });
    parts.push("</section>");
    return parts.join("");
  }
  function mountCmd(root) {
    if (!root || !window.EMMICot) return;
    const fill = d => {
      root.querySelectorAll(".cot-slim-slot[data-cot-sym]").forEach(slot => {
        const m = EMMICot.bySym(d, slot.getAttribute("data-cot-sym"));
        slot.innerHTML = m ? EMMICot.slimHTML(m) : "";
      });
    };
    const d = EMMICot.peek && EMMICot.peek();
    if (d) fill(d);
    else EMMICot.load().then(fill).catch(() => {});
  }
  function onSlimClick(e) {
    const b = e.target.closest && e.target.closest("[data-cot-slim]");
    if (!b || !window.EMMICot) return false;
    e.preventDefault();
    e.stopPropagation();
    EMMICot.openReport(b.getAttribute("data-cot-slim"));
    return true;
  }
  async function load() {
    let last = "market.json is not available yet";
    for (const url of URLS) {
      try {
        const r = await fetch(url);
        if (!r.ok) { last = r.status + " " + url; continue; }
        return await r.json();
      } catch (e) { last = e && e.message ? e.message : last; }
    }
    throw new Error(last);
  }
  function asof(data) {
    const t = data.generated_cet || data.generated_utc || "";
    return String(t).replace("T", " ").replace(/\+\d{2}:\d{2}$/, "").slice(0, 16) || "date not available yet";
  }
  async function loadMaps() {
    for (const url of MAPS_URLS) {
      try { const r = await fetch(url + "?t=" + Math.floor(Date.now() / 3e5), { cache: "no-cache" }); if (r.ok) return await r.json(); } catch (e) { /* next */ }
    }
    return null;
  }
  let MAPS = null;
  async function main() {
    const [data, maps] = await Promise.all([load(), loadMaps()]);
    MAPS = maps;
    render(data);
  }

  /* ---------- Equities Monitor ---------- */
  const NAMES = { us: "US", eu: "Europe", asia: "Asia" };
  const MAP_NOTE = {
    sp500: "S&P 500 constituents, box = market cap in USD (shares × price).",
    eu80: "The 80 largest European companies by market cap, box = market cap in EUR at Yahoo FX.",
    nikkei225: "Nikkei 225 constituents, box = market cap in JPY (shares × price).",
    csi300: "CSI 300 constituents, box = official CSI index weight (month-end file) drifted by the day's move."
  };
  const sgn = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(d == null ? 2 : d) + "%" : "n/a");
  function mapHead(m) {
    const mode = m.stale ? "stale" : m.mode;
    return '<figcaption class="tm-cap"><span class="tm-t">' + esc(m.name) + '</span><span class="eqm-pill ' + esc(mode) + '">' + esc(m.label) + (m.stale ? " · stale" : "") + "</span>" +
      '<span class="tm-st"><b class="' + (m.index_chg > 0 ? "up" : m.index_chg < 0 ? "dn" : "") + '">' + esc((m.index_name || m.name) + " " + sgn(m.index_chg)) + "</b>" +
      '<span class="tm-br"><span class="up">' + m.adv + " up</span> · <span class=\"dn\">" + m.dec + " down</span>" + (m.unch ? " · " + m.unch + " unch" : "") + "</span>" +
      "<span>" + m.n + "/" + m.N + " priced</span></span>" +
      '<span class="tm-sub">' + esc(m.size) + " · " + esc(m.basis) + " · built " + esc(K.zurich(m.built_utc, true) || "") + "</span></figcaption>";
  }
  function mapsHTML(region) {
    const keys = (window.EMMIRegions ? window.EMMIRegions.MAPS[region] : []) || [];
    const got = keys.map(k => MAPS && MAPS.maps && MAPS.maps[k]).filter(Boolean);
    const miss = keys.filter(k => !(MAPS && MAPS.maps && MAPS.maps[k]));
    const figs = got.map(m => '<figure class="tmap" data-map="' + esc(m.key) + '">' + mapHead(m) + '<div class="tm-host" data-tm-key="' + esc(m.key) + '"></div></figure>');
    miss.forEach(k => figs.push('<figure class="tmap tm-na" data-map="' + esc(k) + '"><figcaption class="tm-cap"><span class="tm-t">' + esc({ sp500: "S&P 500", eu80: "Europe top 80", nikkei225: "Nikkei 225", csi300: "CSI 300" }[k]) + '</span></figcaption><p class="na">Sector map not available yet.</p></figure>'));
    return '<div class="eqm-maps n' + keys.length + '">' + figs.join("") + "</div>";
  }
  function regionHTML(region, by, now) {
    const R = window.EMMIRegions, pl = R.pill(region, now), rows = R.lineup(region, by, now);
    const tiles = rows.map(row => row.map(x => tile(x.row)).join("")).join("");
    return '<section class="eqm-reg" id="mkt-eq-' + region + '" data-region="' + region + '"><header class="eqm-rh"><h3>' + esc(NAMES[region]) + '</h3><span class="eqm-pill ' + esc(pl.cls) + '" title="' + esc(pl.title) + '">' + esc(pl.text) + "</span></header>" +
      (tiles ? '<div class="lpk"><div class="tiles eqm-tiles">' + tiles + "</div></div>" : '<p class="na">Tiles not available yet.</p>') + mapsHTML(region) + "</section>";
  }
  function equitiesHTML(by) {
    const R = window.EMMIRegions;
    if (!R) return section("Equities", [], "mkt-indices");
    const now = Date.now(), ord = R.order(now);
    return '<section class="block eqm" id="mkt-indices" data-order="' + ord.join(",") + '"><header class="bh"><h2>Equities</h2><span class="eqm-ord" title="Regions in the order they last opened, newest first (Zurich clock)">' + esc(ord.map(r => NAMES[r]).join(" → ")) + "</span>" + scaleBar() + "</header>" +
      ord.map(r => regionHTML(r, by, now)).join("") +
      '<p class="fnote">Regions run newest session open first on the Zurich clock (Asia 01:00, Europe 09:00, US 15:30), skipping a region on its exchange holidays. Each region: 2 rows of 4 tiles (US: S&amp;P 500, Nasdaq 100, Dow Jones, Russell 2000, SOX, Magnificent 7, VIX, the US sector ETF with the largest move against its typical day; Europe: Stoxx 600, DAX, FTSE 100, CAC 40, SMI, OMX Stockholm 30, Euro Stoxx 50, the standout STOXX Europe 600 sector ETF, AEX and IBEX 35 as reserves; Asia: Nikkei 225, CSI 300, Hang Seng, Kospi, Taiex, ASX 200, then S&amp;P 500 and Nasdaq 100 futures while US cash is shut, else the two biggest movers among TSMC, Samsung, SK Hynix, Alibaba, Tencent and Toyota). ' +
      "Sector maps: " + Object.keys(MAP_NOTE).map(k => esc(MAP_NOTE[k])).join(" ") + " Colour = the day's % move (full colour at ±3%). Live / Midday only while that exchange is open and the data has today's bar; otherwise the last close to close. Prices: Yahoo Finance, about 15 minutes delayed" + (MAPS && MAPS.generated_utc ? "; maps built " + esc(K.zurich(MAPS.generated_utc, true) || "") : "") + ".</p></section>";
  }
  function mountMaps(app) {
    if (!window.EMMITreemap || !MAPS || !MAPS.maps) return;
    app.querySelectorAll(".tm-host[data-tm-key]").forEach(h => {
      const m = MAPS.maps[h.dataset.tmKey];
      if (!m) return;
      const asia = m.region === "asia";
      window.EMMITreemap.mount(h, m, { height: w => Math.round(Math.max(300, Math.min(asia ? 420 : 470, w * (w < 600 ? 1.05 : asia ? 0.72 : 0.5)))), minArea: w0(h) < 600 ? 110 : 80 });
    });
  }
  const w0 = el => el.clientWidth || 600;
  function scaleBar() {
    const C = window.MMCandles;
    return C ? '<div class="cdl-bar"><span class="cdl-k">Candles</span>' + C.toggle(C.scale()) + "</div>" : "";
  }
  let LAST = null;
  function render(data) {
    REG.reset(); K.hidePop(); GEN = data.generated_utc || null; REG.gen = GEN; LAST = data;
    const line = document.getElementById("v2marketsBuild") || document.getElementById("buildLine");
    if (line) { line.classList.add("lpk"); line.innerHTML = '<span class="fr dl">Delayed</span> price file ' + esc(K.zurich(data.generated_utc, true) || asof(data)); }
    const groups = data.groups || [];
    const find = id => groups.find(g => g.id === id);
    const indices = find("indices");
    const rates = find("rates");
    const html = [];
    html.push(equitiesHTML(bySym(groups)));
    if (rates) {
      const yieldRows = [];
      const fxRows = [];
      (rates.sections || []).forEach(s => {
        const bucket = /fx/i.test(s.label || "") ? fxRows : yieldRows;
        (s.rows || []).forEach(r => bucket.push(r));
      });
      /* Rates tiles (Jerry, 18 Nov): the US 2-year leads in place of the 13-week bill; the US 5-year and the French 10Y
         are not shown (the French 10Y stays in the data for the 10-year comparison). SOFR, NIBOR 3m, JGB 10Y and the
         PBoC 1Y LPR stay; there is no Bank of Canada rate. */
      const HIDE = { "^IRX": 1, "^FVX": 1, "CNBC:FR10Y-FR": 1 };
      const shown = yieldRows.filter(r => !HIDE[r.sym]);
      const two = shown.findIndex(r => r.sym === "UST:2Y");
      if (two > 0) shown.unshift(shown.splice(two, 1)[0]);
      yieldRows.length = 0; shown.forEach(r => yieldRows.push(r));
      if (yieldRows.length) html.push(section("Rates", yieldRows, "mkt-rates"));
      if (fxRows.length) html.push(section("FX", fxRows, "mkt-fx"));
      if (!yieldRows.length && !fxRows.length) html.push(section("Rates", rowsOf(rates), "mkt-rates"));
    }
    html.push(commoditiesHTML(bySym(groups)));
    html.push('<div id="mktCurves"></div>');
    html.push('<p class="fnote inote-src">Candles on Equities, Rates and FX: one per trading day for the last month, or one per month for the last year (this month to date). Green closed at or above its open; closes-only sources keep a grey line. Thin bar = 52-week range of daily closes, tick = now. On a phone the two badges are 1D then the selected period (outlined when it is 1M). Each tile says what its price is: <b>Delayed</b> (quote time; Yahoo runs about 15 minutes behind), <b>Close</b> or <b>Last trade</b> (today), <b>Prev close</b> (an earlier session) or <b>Official close</b> (central bank or Treasury fix). Hover, or tap on a phone, for the explainer, chart, fundamentals and source; a tile opens its chart and, for equity indices, sector performance and the largest members. Commodities use their own 1W / 1M / 3M / 1Y switch for the price. A slim bar under a commodity tile is the latest trader positioning; tap it for the full report.</p>');
    const missing = ["indices", "commodities", "rates"].filter(id => !find(id));
    if (missing.length) html.push('<p class="na">' + esc(missing.join(", ")) + " not available yet in this file.</p>");
    const app = document.getElementById("v2markets") || document.getElementById("app");
    if (app) {
      app.innerHTML = html.join("");
      if (window.MMCandles) MMCandles.wire(app, () => { K.rescale(app); if (K.sheetOpen()) K.openSheet(K.sheetOpen()); });
      K.onScale("mkt", () => { if (app.isConnected) K.rescale(app); });
      K.wirePop(app);
      if (!app._kClick) { app._kClick = true; app.addEventListener("click", e => { if (onSlimClick(e)) return; K.hostClick(e); onCmdClick(e, app); }); }
      K.refreshSheet(REG.rows);
      mountCmd(app);
      mountMaps(app);
    }
    document.dispatchEvent(new CustomEvent("mm:place", { detail: "markets" }));
  }
  function onCmdClick(e, app) {
    const b = e.target.closest && e.target.closest("[data-cmd-per]");
    if (!b || !app.contains(b)) return;
    e.preventDefault();
    const p = b.getAttribute("data-cmd-per");
    if (!PERIODS.includes(p) || p === period()) return;
    setPeriod(p);
    if (LAST) render(LAST);
  }
  function rootEl() { return document.getElementById("v2markets") || document.getElementById("app"); }
  let starting = null, ready = false;
  function fail(e) {
    const box = rootEl();
    if (box) box.innerHTML = '<p class="na">' + esc(e && e.message ? e.message : "The market file is not available yet.") + "</p>";
  }
  function start() {
    if (ready && rootEl() && rootEl().childElementCount) return starting;
    if (starting) return starting;
    if (!rootEl()) return;
    if (window.EMMICot) EMMICot.load().catch(() => null);
    starting = main().then(() => { ready = true; }).catch(fail).finally(() => { starting = null; });
    return starting;
  }
  function reload() { ready = false; const box = rootEl(); if (box) box.innerHTML = ""; return start(); }
  window.MMV2Markets = { start: start, equitiesHTML: equitiesHTML, setMaps: m => { MAPS = m; }, reload: reload, GROUPS: GROUPS, SYM_COT: SYM_COT, PERIODS: PERIODS, period: period, setPeriod: setPeriod, picked: picked, chunk: chunk, cotIds: cotIds, bySym: bySym, commoditiesHTML: commoditiesHTML, NOTE: NOTE };
  if (rootEl()) start();
})();
