/* Markets. Same market.json the live page loads. Null is "not available yet", never zero.
   Tiles use the Live Pulse language (t1411u): price with its unit, 1D/1M, candles, 52-week range and a freshness tag;
   hover or tap for the explainer and links; a tile opens its detail sheet (chart, sectors and largest members). */
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
  const tile = r => K.tile(r, REG, GEN);
  const MOVED = { "BZ=F": 1, "CL=F": 1, "NG=F": 1, "TTF=F": 1, "GC=F": 1, "HG=F": 1, "HO=F": 1 };
  function kept(rows) { return rows.filter(r => !MOVED[r.sym] && !/ulsd|harbor diesel|heating oil/i.test(r.name || "")); }
  function section(title, rows, id) {
    return '<section class="block" id="' + esc(id) + '"><header class="bh"><h2>' + esc(title) + '</h2></header><div class="lpk"><div class="tiles">' + rows.map(tile).join("") + "</div></div></section>";
  }
  function rowsOf(group) {
    const out = [];
    (group.sections || []).forEach(s => (s.rows || []).forEach(r => out.push(r)));
    if (!out.length && group.rows) group.rows.forEach(r => out.push(r));
    return out;
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
  function render(data) {
    REG.reset(); K.hidePop(); GEN = data.generated_utc || null; REG.gen = GEN;
    const line = document.getElementById("v2marketsBuild") || document.getElementById("buildLine");
    if (line) { line.classList.add("lpk"); line.innerHTML = '<span class="fr dl">Delayed</span> price file ' + esc(K.zurich(data.generated_utc, true) || asof(data)); }
    const groups = data.groups || [];
    const find = id => groups.find(g => g.id === id);
    const indices = find("indices");
    const commodities = find("commodities");
    const rates = find("rates");
    const html = [scaleBar()];
    if (indices) html.push(section("Global markets", rowsOf(indices), "mkt-indices"));
    else html.push(section("Global markets", [], "mkt-indices"));
    if (commodities) {
      const left = kept(rowsOf(commodities));
      if (left.length) html.push(section("Commodities", left, "mkt-cmd"));
    }
    html.push('<div id="mktCurves"></div>');
    if (window.EMMICot) html.push('<section class="block" id="mkt-cot"><header class="bh"><h2>Trader positioning</h2></header><div id="mktCot"></div></section>');
    if (rates) {
      const yieldRows = [];
      const fxRows = [];
      (rates.sections || []).forEach(s => {
        const bucket = /fx/i.test(s.label || "") ? fxRows : yieldRows;
        (s.rows || []).forEach(r => bucket.push(r));
      });
      if (yieldRows.length) html.push(section("Rates", yieldRows, "mkt-rates"));
      if (fxRows.length) html.push(section("FX", fxRows, "mkt-fx"));
      if (!yieldRows.length && !fxRows.length) html.push(section("Rates", rowsOf(rates), "mkt-rates"));
    }
    html.push('<p class="fnote inote-src">Candles: one per trading day for the last month, or one per month for the last year (this month to date). Green closed at or above its open; closes-only sources keep a grey line. Thin bar = 52-week range of daily closes, tick = now. On a phone the two badges are 1D then 1M (outlined). Each tile says what its price is: <b>Delayed</b> (quote time; Yahoo runs about 15 minutes behind), <b>Close</b> or <b>Last trade</b> (today), <b>Prev close</b> (an earlier session) or <b>Official close</b> (central bank or Treasury fix). Hover, or tap on a phone, for the explainer, chart, fundamentals and source; a tile opens its chart and, for equity indices, sector performance and the largest members.</p>');
    const missing = ["indices", "commodities", "rates"].filter(id => !find(id));
    if (missing.length) html.push('<p class="na">' + esc(missing.join(", ")) + " not available yet in this file.</p>");
    const app = document.getElementById("v2markets") || document.getElementById("app");
    if (app) {
      app.innerHTML = html.join("");
      if (window.MMCandles) MMCandles.wire(app, () => { K.rescale(app); if (K.sheetOpen()) K.openSheet(K.sheetOpen()); });
      K.onScale("mkt", () => { if (app.isConnected) K.rescale(app); });
      K.wirePop(app);
      if (!app._kClick) { app._kClick = true; app.addEventListener("click", e => { K.hostClick(e); }); }
      K.refreshSheet(REG.rows);
      const cot = document.getElementById("mktCot");
      if (cot && window.EMMICot) EMMICot.mount(cot, { layout: "rows", lede: "Managed money (hedge funds and CTAs) in every commodity future the CFTC and ICE Futures Europe report. Tap a row for long and short, its three-year range and the weekly chart.",
        groups: [["Energy", ["brent", "wti", "ulsd", "gasoil", "rbob", "hh"]], ["Metals", ["gold", "silver", "platinum", "palladium", "copper"]], ["Softs", ["coffee", "robusta", "cocoa", "cocoa_ldn", "sugar", "white_sugar", "cotton", "oj", "lumber"]], ["Grains and oilseeds", ["wheat", "corn", "soybeans", "soyoil", "soymeal", "oats", "rice"]], ["Livestock", ["cattle", "hogs"]]] });
    }
    document.dispatchEvent(new CustomEvent("mm:place", { detail: "markets" }));
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
    starting = main().then(() => { ready = true; }).catch(fail).finally(() => { starting = null; });
    return starting;
  }
  function reload() { ready = false; const box = rootEl(); if (box) box.innerHTML = ""; return start(); }
  window.MMV2Markets = { start: start, reload: reload };
  if (rootEl()) start();
})();
