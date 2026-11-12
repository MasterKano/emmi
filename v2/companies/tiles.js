/* Company tiles shared by Oil & gas, Mining, and the Companies tab.
   Live last, market cap and EV come from market.json. A missing quote stays n/a. */
(function () {
  "use strict";
  const U = () => window.MMV2;
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/";
  const QUOTES = [
    "https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json",
    "https://raw.githubusercontent.com/MasterKano/emmi-data/main/data/market.json"
  ];
  const PRICE_FALLBACK = { "SNM-SDB.ST": "SNM.OL" };

  function rowsOf(market) {
    const out = {};
    ((market && market.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(r => { if (r && r.sym) out[r.sym] = r; })));
    return out;
  }
  async function loadQuotes() {
    let last = "market.json is not available yet";
    for (const url of QUOTES) {
      try {
        const r = await fetch(url);
        if (!r.ok) { last = r.status + ""; continue; }
        return rowsOf(await r.json());
      } catch (e) { last = e && e.message ? e.message : last; }
    }
    throw new Error(last);
  }
  function quoteFor(map, yahoo) {
    if (!map) return { row: null, via: null };
    if (map[yahoo]) return { row: map[yahoo], via: null };
    const alt = PRICE_FALLBACK[yahoo];
    if (alt && map[alt]) return { row: map[alt], via: alt };
    return { row: null, via: null };
  }
  function capLine(row, company) {
    const Uu = U();
    const eur = row && Uu.finite(row.mcap_eur) ? Uu.money(row.mcap_eur, "EUR") : null;
    const ev = row && Uu.finite(row.ev_eur) ? Uu.money(row.ev_eur, "EUR") : null;
    if (eur && ev) return "Mkt " + eur + " · EV " + ev;
    if (eur) return "Mkt " + eur;
    const local = company && Uu.finite(company.mcap_local) ? Uu.money(company.mcap_local, company.mcap_ccy === "GBP" ? "GBP" : company.mcap_ccy) : (company && Uu.finite(company.mcap) ? Uu.money(company.mcap, company.ccy) : null);
    return local ? "Mkt " + local : "";
  }
  function tile(company, map) {
    const Uu = U();
    const q = quoteFor(map, company.yahoo);
    const row = q.row;
    const name = company.short || company.company;
    const tk = company.exchange_ticker || String(company.yahoo || "").split(".")[0];
    const px = row ? Uu.pxText(row.px, row.ccy) : null;
    const one = row && row.pct ? row.pct["1D"] : null;
    const href = "https://finance.yahoo.com/quote/" + encodeURIComponent(q.via || company.yahoo);
    const spark = row && row.spark && row.spark.length > 2 ? sparkSVG(row.spark) : "";
    const cap = capLine(row, company);
    const via = q.via ? '<span class="v2co-via">price ' + Uu.esc(q.via) + "</span>" : "";
    return '<a class="v2co-tile" href="' + href + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="v2co-name">' + Uu.esc(name) + '</span><span class="v2co-tk">' + Uu.esc(tk) + "</span>" +
      '<span class="v2co-px">' + (px || '<span class="og-na">n/a</span>') + "</span>" +
      '<span class="v2co-chg">' + (Uu.finite(one) ? Uu.pill(Uu.signed(one, "%")) : "") + "</span>" +
      (cap || via ? '<span class="v2co-meta">' + Uu.esc(cap) + (cap && via ? " · " : "") + via + "</span>" : "") +
      spark + "</a>";
  }
  function sparkSVG(values) {
    const p = values.filter(v => typeof v === "number" && Number.isFinite(v));
    if (p.length < 2) return "";
    const w = 120, h = 22;
    let lo = Math.min(...p), hi = Math.max(...p);
    if (!(hi > lo)) hi = lo + 1;
    const d = p.map((v, i) => (i ? "L" : "M") + ((i / (p.length - 1)) * w).toFixed(1) + " " + (h - 2 - ((v - lo) / (hi - lo)) * (h - 4)).toFixed(1)).join("");
    const up = p[p.length - 1] >= p[0];
    return '<svg class="v2co-spark" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (up ? "#5fb98a" : "#e0706a") + '" stroke-width="1.4"/></svg>';
  }
  function groupHTML(title, companies, map) {
    return '<section class="v2co-sec"><h3>' + U().esc(title) + '</h3><div class="v2co-grid">' + companies.map(c => tile(c, map)).join("") + "</div></section>";
  }
  async function companies(file) {
    return U().getJSON(BASE + file);
  }
  async function renderOil(host, map) {
    const data = await companies("companies_oil_gas.json");
    const list = data.companies || [];
    const groups = ["London", "Sweden", "Norway"];
    host.innerHTML = groups.map(g => groupHTML(g, list.filter(c => c.venue_group === g), map)).join("") +
      '<p class="v2co-foot">Market cap and EV in EUR from the live quote file, as of ' + U().esc(data.as_of || "") + '. A blank quote is n/a.</p>';
    return list.map(c => c.yahoo);
  }
  async function renderMine(host, map) {
    const data = await companies("companies_mining.json");
    const list = data.companies || [];
    host.innerHTML = groupHTML("Lundin mining", list, map) +
      '<p class="v2co-foot">' + U().esc(data.note || "") + "</p>";
    return list.map(c => c.yahoo);
  }
  async function mount(host, kind) {
    if (!host || !U()) return;
    host.innerHTML = '<p class="og-na">Loading quotes…</p>';
    let map = {};
    try { map = await loadQuotes(); } catch (e) { map = {}; }
    try {
      if (kind === "mining") return await renderMine(host, map);
      return await renderOil(host, map);
    } catch (e) {
      host.innerHTML = '<p class="og-na">' + U().esc(e && e.message ? e.message : "Companies are not available yet.") + "</p>";
    }
  }
  window.MMV2Tiles = { mount, loadQuotes, quoteFor, tile };
})();
