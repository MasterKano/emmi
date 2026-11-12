/* Covered-company research on the EMMI profile.
   Covered names are the live Oil & gas and Mining lists. Fields come from the
   same Research files the Research page publishes under research/data/.
   A missing item stays "not available yet". */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MMCoResearch = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const NA = "not available yet";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Live listing symbols that the company file still stores under the previous ticker. */
  const LISTING = {
    "SER.L": "SQZ.L", "SNM-SDB.ST": "SNM.OL", "IPCO.ST": "IPCO.TO",
    "LUMI.ST": "LUN.TO", "LUG.ST": "LUG.TO", "LUC.ST": "LUC.TO"
  };
  const OILS = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/companies_oil_gas.json";
  const MINES = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/companies_mining.json";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function norm(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/\b(plc|asa|ab|as|ltd|limited|inc|corp|corporation|oyj|se|ag|sa|n\.l\.|nl|publ)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim().replace(/\s+/g, " ");
  }
  function todayIso(d) {
    const x = d || new Date();
    const p = n => String(n).padStart(2, "0");
    return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
  }
  function fmtDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const month = MONTHS[Number(m[2]) - 1];
    if (!month) return null;
    return Number(m[3]) + " " + month + " " + m[1];
  }
  function dayOf(value) {
    const s = String(value || "");
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
  }
  async function getJSON(url) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  async function getText(url) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) return "";
      return await r.text();
    } catch (e) { return ""; }
  }
  async function load() {
    const [oil, mine, briefing, coming, smallcaps, identity, norway, pilot] = await Promise.all([
      getJSON(OILS),
      getJSON(MINES),
      getJSON("research/data/briefing.json"),
      getJSON("research/data/coming_up.json"),
      getJSON("research/data/smallcaps.json"),
      getJSON("research/data/company_identity.json"),
      getJSON("research/data/norway_events.json"),
      getText("research/data/events.csv")
    ]);
    const renew = (typeof window !== "undefined" && window.EMMICoverage ? window.EMMICoverage.renewables : []).map(c => ({ yahoo: c.yahoo, company: c.name, short: c.short || c.name }));
    const covered = ((oil && oil.companies) || []).concat((mine && mine.companies) || []).concat(renew);
    return { covered, briefing, coming, smallcaps, identity, norway, pilot };
  }
  function parseCsv(text) {
    if (!text) return [];
    const rows = [];
    let row = [], cell = "", q = false;
    const push = () => { row.push(cell); cell = ""; };
    const end = () => { if (row.length && row.some(c => c !== "")) rows.push(row); row = []; };
    const s = String(text).replace(/^\uFEFF/, "");
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; }
          else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") push();
      else if (c === "\n") { push(); end(); }
      else if (c !== "\r") cell += c;
    }
    push(); end();
    if (!rows.length) return [];
    const head = rows[0];
    return rows.slice(1).map(r => {
      const o = {};
      head.forEach((k, i) => { o[k] = r[i] == null ? "" : r[i]; });
      return o;
    });
  }
  function idFor(company, identity) {
    if (!identity || !identity.companies) return null;
    const yahoo = (identity.keys && identity.keys["emma.yahoo_symbol"]) || {};
    const screen = (identity.keys && identity.keys["moonshot.screen.code"]) || {};
    const sym = company.yahoo || "";
    const via = LISTING[sym] || sym;
    if (yahoo[via]) return yahoo[via];
    if (yahoo[sym]) return yahoo[sym];
    if (screen[sym]) return screen[sym];
    const want = norm(company.short || company.company);
    if (want.length < 3) return null;
    let found = null;
    Object.keys(identity.companies).forEach(id => {
      const rec = identity.companies[id];
      if (!rec || rec.parent_id || found) return;
      if (norm(rec.name) === want) found = id;
    });
    return found;
  }
  function family(company, identity) {
    const id = idFor(company, identity);
    const names = new Set();
    [company.short, company.company].forEach(n => { const k = norm(n); if (k) names.add(k); });
    const ids = [];
    if (id) ids.push(id);
    if (identity && identity.companies && id) {
      Object.keys(identity.companies).forEach(cid => {
        const rec = identity.companies[cid];
        if (cid === id || (rec && rec.parent_id === id)) ids.push(cid);
      });
      ids.forEach(cid => {
        const rec = identity.companies[cid];
        const k = norm(rec && rec.name);
        if (k) names.add(k);
      });
      const shorts = identity.keys && identity.keys["moonshot.norway.short_name"];
      if (shorts) Object.keys(shorts).forEach(name => {
        if (ids.indexOf(shorts[name]) >= 0) {
          const k = norm(name);
          if (k) names.add(k);
        }
      });
    }
    const idSet = new Set(ids);
    return { id, ids: idSet, names };
  }
  function ours(mapped, fam) {
    return !!(mapped && fam.ids.has(mapped));
  }
  function nameHit(value, fam) {
    return String(value || "").split(",").some(part => fam.names.has(norm(part)));
  }
  function tickerHit(code, fam, identity) {
    if (!code || !identity || !identity.companies) return false;
    let hit = false;
    fam.ids.forEach(cid => {
      const rec = identity.companies[cid];
      if (!rec || hit) return;
      if (rec.ticker === code || rec.parent_ticker === code) hit = true;
    });
    return hit;
  }
  function screenHit(code, fam, identity) {
    const screen = identity && identity.keys && identity.keys["moonshot.screen.code"];
    return ours(screen && screen[code], fam);
  }
  function consider(best, date, headline, url) {
    const day = dayOf(date);
    const text = String(headline || "").trim();
    if (!day || !text) return best;
    if (!best || day > best.date) return { date: day, headline: text, url: url || "" };
    return best;
  }
  function latestMaterial(fam, sources, today) {
    const identity = sources.identity;
    let best = null;
    (Array.isArray(sources.smallcaps) ? sources.smallcaps : []).forEach(row => {
      if (!row || !screenHit(row.code, fam, identity)) return;
      (row.events || []).forEach(ev => {
        if (!ev || ev.significance !== "material") return;
        const day = dayOf(ev.date);
        if (!day || day > today) return;
        best = consider(best, day, ev.headline, (ev.sources && ev.sources[0]) || "");
      });
    });
    const brief = sources.briefing || {};
    ["material_7d", "material_30d"].forEach(key => {
      (brief[key] || []).forEach(item => {
        if (!item) return;
        const fromId = String(item.id || "").match(/^E-([A-Za-z0-9.]+)-\d{4}-\d{2}-\d{2}/);
        const named = nameHit(item.company, fam) || (fromId && screenHit(fromId[1], fam, identity));
        if (!named) return;
        const day = dayOf(item.date);
        if (!day || day > today) return;
        best = consider(best, day, item.headline, "");
      });
    });
    (Array.isArray(sources.norway) ? sources.norway : []).forEach(ev => {
      if (!ev || (ev.significance !== "material" && ev.material !== "Y")) return;
      if (!(ev.companies || []).some(name => nameHit(name, fam))) return;
      const day = dayOf(ev.date);
      if (!day || day > today) return;
      best = consider(best, day, ev.title || ev.headline, ev.source_url || "");
    });
    const pilotRows = Array.isArray(sources.pilot) ? sources.pilot : parseCsv(sources.pilot);
    const pilotMap = identity && identity.keys && identity.keys["moonshot.pilot.ticker"];
    pilotRows.forEach(row => {
      if (!row || row.status !== "happened") return;
      if (row.significance !== "material" && row.material !== "Y") return;
      if (!ours(pilotMap && pilotMap[row.ticker], fam)) return;
      const day = dayOf(row.date);
      if (!day || day > today) return;
      best = consider(best, day, row.what_happened, row.source_url || "");
    });
    return best;
  }
  function nextCatalyst(fam, sources, today) {
    const identity = sources.identity;
    const items = sources.coming && Array.isArray(sources.coming.items) ? sources.coming.items : [];
    let best = null;
    items.forEach(item => {
      if (!item) return;
      const code = item.company_code || "";
      const hit = screenHit(code, fam, identity) || tickerHit(code, fam, identity) || nameHit(item.company_name, fam);
      if (!hit) return;
      const headline = String(item.headline || "").trim();
      if (!headline) return;
      const day = dayOf(item.sort_date || item.anchor);
      if (!day || day < today) return;
      if (best && day >= best.date) return;
      const label = item.date_label || fmtDate(day) || day;
      best = { date: day, label: label, headline: headline, url: item.source_url || "" };
    });
    return best && best.headline ? best : null;
  }
  function reviewDate(briefing) {
    return fmtDate(briefing && briefing.as_of);
  }
  function pick(symbol, sources, today) {
    const covered = (sources && sources.covered) || [];
    const prior = LISTING[symbol];
    const company = covered.find(c => c && (c.yahoo === symbol || (prior && c.yahoo === prior)));
    if (!company) return null;
    const day = today || todayIso();
    const fam = family(company, sources.identity);
    const material = latestMaterial(fam, sources, day);
    const catalyst = nextCatalyst(fam, sources, day);
    return {
      material: material ? { label: fmtDate(material.date) || material.date, headline: material.headline, url: material.url } : null,
      catalyst: catalyst,
      review: reviewDate(sources.briefing)
    };
  }
  function valueHtml(item) {
    if (!item || (!item.headline && !item.label)) return '<span class="co-na">' + NA + "</span>";
    if (!item.headline) return esc(item.label);
    const head = item.url
      ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.headline) + "</a>"
      : esc(item.headline);
    return (item.label ? esc(item.label) + " — " : "") + head;
  }
  function sectionHtml(fields) {
    if (!fields) return "";
    const box = (label, key, item) => '<div><span class="co-tl">' + esc(label) + '</span><p data-field="' + key + '">' + valueHtml(item) + "</p></div>";
    const review = fields.review ? { label: fields.review } : null;
    return '<section class="co-sec" id="coResearch"><div class="co-sec-head"><div><h3>Research</h3></div>' +
      '<details class="co-res-i"><summary class="info" aria-label="Sources and notes">i</summary>' +
      '<div class="info-panel"><p>Latest material development and next catalyst come from the research register the Research page uses (the briefing, the screen, the Norwegian shelf, the pilot register and the coming-up list). The research review date is the sign-off on that register. A field with no item says not available yet.</p></div></details></div>' +
      '<div class="co-res-grid">' +
      box("Latest material development", "material", fields.material) +
      box("Next catalyst", "catalyst", fields.catalyst) +
      box("Research review date", "review", review) +
      "</div></section>";
  }
  return { NA, load, pick, sectionHtml, parseCsv, fmtDate, norm };
});
