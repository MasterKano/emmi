/* Markets preview. Same market.json the live page loads. Null is "not available yet", never zero.
   A tile opens the quote. It does not draw a second chart. */
(function () {
  "use strict";
  const URLS = [
    "https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json",
    "https://raw.githubusercontent.com/MasterKano/emmi-data/main/data/market.json"
  ];
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function pxText(v, kind) {
    if (!finite(v)) return null;
    const a = Math.abs(v);
    const d = kind === "fx" && a < 20 ? 4 : kind === "yield" ? 3 : a >= 1000 ? 1 : a >= 100 ? 1 : 2;
    return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pill(v, suffix) {
    if (!finite(v)) return "";
    const cls = v > 0 ? "up" : v < 0 ? "dn" : "";
    const n = Math.abs(v);
    const body = (v > 0 ? "+" : v < 0 ? "−" : "") + n.toFixed(suffix === "bp" ? (n >= 10 ? 0 : 1) : 1) + (suffix === "bp" ? " bp" : "%");
    return '<span class="pill ' + cls + '">' + body + "</span>";
  }
  function spark(values) {
    const p = (values || []).filter(finite);
    if (p.length < 2) return "";
    const w = 120, h = 28;
    let mn = Math.min(...p), mx = Math.max(...p);
    if (mx === mn) mx = mn + 1;
    const pts = p.map((v, i) => [(i / (p.length - 1)) * w, h - 3 - ((v - mn) / (mx - mn)) * (h - 6)]);
    const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
    const up = p[p.length - 1] >= p[0];
    const c = up ? "var(--good)" : "var(--bad)";
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" aria-label="1-year close line"><title>1-year close line (this source publishes closes only)</title><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  /* daily or monthly candles where the row carries real OHLC; otherwise the 1Y close line */
  function chart(r) {
    const C = window.MMCandles;
    return (C && C.svg(r, C.scale())) || spark(r.spark);
  }
  function quoteURL(r) {
    const sym = String(r.sym || "");
    if (sym && !sym.startsWith("CNBC:")) return "https://finance.yahoo.com/quote/" + encodeURIComponent(sym);
    if (r.tv) return "https://www.tradingview.com/symbols/" + encodeURIComponent(String(r.tv).replace(":", "-"));
    return "";
  }
  function tile(r) {
    const url = quoteURL(r);
    const name = esc(r.name);
    const price = pxText(r.px, r.kind);
    const oneD = r.kind === "yield" && r.bp ? r.bp["1D"] : r.pct && r.pct["1D"];
    const oneM = r.kind === "yield" && r.bp ? r.bp["1M"] : r.pct && r.pct["1M"];
    const suf = r.kind === "yield" && r.bp ? "bp" : "%";
    const bits = [];
    if (finite(oneD)) bits.push('<span class="k">1D</span>' + pill(oneD, suf));
    if (finite(oneM)) bits.push('<span class="k">1M</span>' + pill(oneM, suf));
    const meta = window.MMLabels ? MMLabels.tileMeta(r) : "quote time not available";
    const inner = '<span class="tn">' + name + '</span><span class="px">' + (price || '<span class="na">Not available yet</span>') + '</span><span class="qmeta">' + esc(meta) + "</span>" + (bits.length ? '<span class="pills">' + bits.join("") + "</span>" : "") + chart(r);
    const k = ' data-row="' + (ROWS.push(r) - 1) + '"';
    if (!url) return '<div class="tile"' + k + ">" + inner + "</div>";
    return '<a class="tile"' + k + ' href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + inner + "</a>";
  }
  const MOVED = { "BZ=F": 1, "CL=F": 1, "NG=F": 1, "TTF=F": 1, "GC=F": 1, "HG=F": 1, "HO=F": 1 };
  function kept(rows) { return rows.filter(r => !MOVED[r.sym] && !/ulsd|harbor diesel|heating oil/i.test(r.name || "")); }
  function section(title, rows, id) {
    return '<section class="block" id="' + esc(id) + '"><header class="bh"><h2>' + esc(title) + '</h2></header><div class="tiles">' + rows.map(tile).join("") + "</div></section>";
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
  let ROWS = [];
  async function main() {
    render(await load());
  }
  /* scale switch: swap each tile's chart in place (the page around the tiles is left alone) */
  function rescale(app) {
    app.querySelectorAll("[data-cdl]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cdl === MMCandles.scale())));
    app.querySelectorAll(".tile[data-row]").forEach(t => {
      const old = t.querySelector(":scope > svg.spark");
      const html = chart(ROWS[+t.dataset.row]);
      if (old) old.outerHTML = html || "";
      else if (html) t.insertAdjacentHTML("beforeend", html);
    });
  }
  function scaleBar() {
    const C = window.MMCandles;
    return C ? '<div class="cdl-bar"><span class="cdl-k">Candles</span>' + C.toggle(C.scale()) + "</div>" : "";
  }
  function render(data) {
    ROWS = [];
    const line = document.getElementById("v2marketsBuild") || document.getElementById("buildLine");
    const when = asof(data);
    if (line) line.textContent = "File refreshed " + when + (String(data.generated_cet || "").indexOf("+01") >= 0 || String(data.generated_cet || "").indexOf("+02") >= 0 ? " Zurich" : "");
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
    const missing = ["indices", "commodities", "rates"].filter(id => !find(id));
    if (missing.length) html.push('<p class="na">' + esc(missing.join(", ")) + " not available yet in this file.</p>");
    const app = document.getElementById("v2markets") || document.getElementById("app");
    if (app) {
      app.innerHTML = html.join("");
      if (window.MMCandles) MMCandles.wire(app, () => rescale(app));
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
