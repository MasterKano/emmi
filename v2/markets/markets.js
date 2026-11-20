/* Markets. Same market.json the live page loads. Null is "not available yet", never zero.
   Tiles use the Live Pulse language (t1411u): price with its unit, 1D/1M, candles, 52-week range and a freshness tag;
   hover or tap for the explainer and links; a tile opens its detail sheet (chart, sectors and largest members).
   Commodities: IG-style groups, four price tiles per row. A slim positioning bar sits under a tile when a weekly
   report exists (same width as the tile). The bar opens the full trader report; the price tile opens the chart,
   with the same report underneath. */
(function () {
  "use strict";
  const URLS = [
    "/emmi/ed/live/data/market.json",
    "/emmi/ed/main/data/market.json"
  ];
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
      chunk(rows, 4).forEach(band => {
        parts.push('<div class="cmd-band lpk"><div class="tiles cmd-tiles cmd-stacks">' +
          band.map(r => '<div class="cmd-stack">' + cmdTile(r) + '<div class="cot-slim-slot" data-cot-sym="' + esc(r.sym) + '"></div></div>').join("") +
          "</div></div>");
      });
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
  async function main() {
    render(await load());
  }
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
    const html = [scaleBar()];
    if (indices) html.push(section("Global markets", rowsOf(indices), "mkt-indices"));
    else html.push(section("Global markets", [], "mkt-indices"));
    html.push(commoditiesHTML(bySym(groups)));
    html.push('<div id="mktCurves"></div>');
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
    html.push('<p class="fnote inote-src">Candles on Global markets, Rates and FX: one per trading day for the last month, or one per month for the last year (this month to date). Green closed at or above its open; closes-only sources keep a grey line. Thin bar = 52-week range of daily closes, tick = now. On a phone the two badges are 1D then the selected period (outlined when it is 1M). Each tile says what its price is: <b>Delayed</b> (quote time; Yahoo runs about 15 minutes behind), <b>Close</b> or <b>Last trade</b> (today), <b>Prev close</b> (an earlier session) or <b>Official close</b> (central bank or Treasury fix). Hover, or tap on a phone, for the explainer, chart, fundamentals and source; a tile opens its chart and, for equity indices, sector performance and the largest members. Commodities use their own 1W / 1M / 3M / 1Y switch for the price. A slim bar under a commodity tile is the latest trader positioning; tap it for the full report.</p>');
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
  window.MMV2Markets = { start: start, reload: reload, GROUPS: GROUPS, SYM_COT: SYM_COT, PERIODS: PERIODS, period: period, setPeriod: setPeriod, picked: picked, chunk: chunk, cotIds: cotIds, bySym: bySym, commoditiesHTML: commoditiesHTML, NOTE: NOTE };
  if (rootEl()) start();
})();
