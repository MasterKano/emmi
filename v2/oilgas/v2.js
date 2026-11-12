/* Oil & gas page. The annual country panel, population and per-capita rates come from annual_energy.json. */
(function () {
  "use strict";
  const U = () => window.MMV2;
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/";
  const FILES = ["manifest", "spot_daily", "us_weekly", "oil_balance_steo", "oil_gas_history_ei", "outlooks", "cost_curves", "companies_oil_gas"];
  const PIN = ["World", "Europe", "EU", "Asia Pacific", "China", "India", "US"];
  const NAME = {
    "Total World": "World", "Total Europe": "Europe", "Total EU": "EU", "Total Asia Pacific": "Asia Pacific",
    "United States": "US", "US": "US", "Russian Federation": "Russia"
  };
  const state = { fuel: "oil", place: "__compare", data: null, book: null, demo: null, annual: null };

  function nice(name) { return NAME[name] || String(name || "").replace(/^Total /, ""); }
  function histOf(rec) {
    const h = rec && (rec.history_2000_2025 || rec.history_1990_2025 || rec.history || rec.series);
    return Array.isArray(h) ? h.filter(p => Array.isArray(p) && U().finite(p[1])) : [];
  }
  function put(book, fuel, flow, rec, unit) {
    const name = nice(rec.name || rec.country || rec.region);
    if (!name) return;
    book[fuel] = book[fuel] || {};
    book[fuel][flow] = book[fuel][flow] || {};
    const history = histOf(rec);
    book[fuel][flow][name] = {
      name: name,
      history: history,
      y: U().finite(rec.y2025) ? rec.y2025 : (U().finite(rec.latest) ? rec.latest : (history.length ? history[history.length - 1][1] : null)),
      yoy: U().finite(rec.yoy_pct) ? rec.yoy_pct : null,
      vs: U().finite(rec.vs_normal_pct) ? rec.vs_normal_pct : null,
      unit: rec.unit || unit
    };
  }
  function fromEI(ei) {
    const book = {};
    const map = [
      ["oil", "production", ei.oil_production_kbd, "kb/d"],
      ["oil", "consumption", ei.oil_consumption_kbd, "kb/d"],
      ["gas", "production", ei.gas_production_bcm, "bcm"],
      ["gas", "consumption", ei.gas_consumption_bcm, "bcm"]
    ];
    map.forEach(([fuel, flow, block, unit]) => {
      if (!block) return;
      (block.regions || []).concat(block.top_countries || []).forEach(rec => put(book, fuel, flow, rec, unit));
    });
    return book;
  }
  function seriesPairs(node) {
    if (!node) return null;
    if (Array.isArray(node) && node.length && Array.isArray(node[0])) return node.filter(p => U().finite(p[1]));
    if (Array.isArray(node) && node[0] && typeof node[0] === "object" && "year" in node[0]) {
      return node.map(p => [p.year, p.value != null ? p.value : p.v]).filter(p => U().finite(p[1]));
    }
    return null;
  }
  function absorbAnnual(file, book) {
    if (!file || typeof file !== "object") return;
    const fuelKeys = { oil: ["oil", "oil_kbd", "oil_ej"], gas: ["gas", "gas_bcm", "gas_ej"], energy: ["primary", "primary_energy", "energy", "total_energy"] };
    const flowKeys = { production: ["production", "prod"], consumption: ["consumption", "cons"] };
    const entities = file.entities || file.countries || file.regions;
    if (Array.isArray(entities)) {
      entities.forEach(e => {
        Object.keys(fuelKeys).forEach(fuel => {
          Object.keys(flowKeys).forEach(flow => {
            let node = null;
            fuelKeys[fuel].forEach(fk => flowKeys[flow].forEach(lk => {
              if (node) return;
              const bag = e[fk] || e[fk + "_" + lk] || e[lk + "_" + fk];
              if (bag && bag[lk]) node = bag[lk];
              else if (e[fk + "_" + lk]) node = e[fk + "_" + lk];
            }));
            const history = seriesPairs(node) || seriesPairs(e[fuel + "_" + flow]);
            if (!history) return;
            put(book, fuel, flow, { name: e.name || e.country, history: history, yoy_pct: e[fuel + "_" + flow + "_yoy"], unit: e.unit }, e.unit || "");
          });
        });
      });
      return;
    }
    Object.keys(fuelKeys).forEach(fuel => {
      let bag = null;
      fuelKeys[fuel].forEach(k => { if (!bag && file[k]) bag = file[k]; });
      if (!bag) return;
      Object.keys(flowKeys).forEach(flow => {
        let node = null;
        flowKeys[flow].forEach(k => { if (!node && bag[k]) node = bag[k]; });
        if (!node) return;
        const unit = node.unit || bag.unit || "";
        (node.regions || []).concat(node.countries || node.top_countries || []).forEach(rec => put(book, fuel, flow, rec, unit));
      });
    });
  }
  function places(book, fuel) {
    const bag = (book[fuel] && (book[fuel].consumption || book[fuel].production)) || {};
    const names = Object.keys(bag);
    const pin = PIN.filter(n => names.indexOf(n) >= 0);
    const rest = names.filter(n => pin.indexOf(n) < 0).sort((a, b) => a.localeCompare(b));
    return pin.concat(rest);
  }
  function align(recs) {
    const years = [];
    recs.forEach(r => (r.history || []).forEach(p => { if (years.indexOf(p[0]) < 0) years.push(p[0]); }));
    years.sort((a, b) => a - b);
    const map = r => {
      const m = {};
      (r.history || []).forEach(p => { m[p[0]] = p[1]; });
      return years.map(y => U().finite(m[y]) ? m[y] : null);
    };
    return { years: years, vals: recs.map(map) };
  }
  function pills(rec) {
    if (!rec) return "";
    const bits = [];
    if (U().finite(rec.yoy)) bits.push('<span class="og-pk">1Y</span>' + U().pill(U().signed(rec.yoy, "%")));
    if (U().finite(rec.vs)) bits.push('<span class="og-pk">vs 15–24</span>' + U().pill(U().signed(rec.vs, "%")));
    return '<span class="og-pills">' + bits.join("") + "</span>";
  }
  function story(book, fuel) {
    const bag = book[fuel] && book[fuel].consumption;
    if (!bag) return "";
    const eu = bag.Europe, ap = bag["Asia Pacific"], cn = bag.China;
    if (!eu || !ap || !cn) return "";
    const bit = r => r.name + " " + (U().signed(r.yoy, "%") || "n/a") + " vs 2024" + (U().finite(r.vs) ? " (" + U().signed(r.vs, "%") + " vs 2015–24)" : "");
    return bit(eu) + ". " + bit(ap) + ". " + bit(cn) + ".";
  }
  function findDemo(demo, name) {
    const list = demo && (demo.regions || demo.entities || demo.countries);
    if (!Array.isArray(list)) return null;
    const key = String(name || "").toLowerCase();
    return list.find(e => nice(e.name || e.country || "").toLowerCase() === key) || null;
  }
  function perCapita(cons, people) {
    if (!cons || !people) return [];
    const pop = {};
    people.forEach(p => { pop[p[0]] = p[1]; });
    return cons.map(p => {
      const n = pop[p[0]];
      if (!U().finite(p[1]) || !U().finite(n) || n <= 0) return [p[0], null];
      return [p[0], p[1] * 1000 * 365 / n];
    }).filter(p => U().finite(p[1]));
  }


  /* ---------- shared bits for the redesigned page ---------- */
  const MKT = [
    "https://raw.githubusercontent.com/MasterKano/emmi-data/live-data/data/market.json",
    "https://raw.githubusercontent.com/MasterKano/emmi-data/main/data/market.json"
  ];
  const CURVES = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/curves/";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const f = v => U().finite(v);
  const esc = s => U().esc(s);
  function dayMs(iso) { const t = Date.parse(String(iso || "").slice(0, 10) + "T12:00:00Z"); return Number.isFinite(t) ? t : null; }
  function ageDays(iso) { const t = dayMs(iso); return t == null ? null : Math.floor((Date.now() - t) / 864e5); }
  function dShort(iso) {
    const p = String(iso || "").slice(0, 10).split("-");
    if (p.length < 3) return String(iso || "");
    return +p[2] + " " + MON[+p[1] - 1] + (p[0] !== String(new Date().getFullYear()) ? " " + p[0] : "");
  }
  function mShort(ym) { const p = String(ym || "").split("-"); return p.length > 1 ? MON[+p[1] - 1] + " " + p[0].slice(2) : String(ym || ""); }
  function zurich(iso) {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return "";
    return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
  }
  function pct(v) {
    if (!f(v)) return '<span class="og-pill">n/a</span>';
    return U().pill(U().signed(v, "%")) || '<span class="og-pill">0.0%</span>';
  }
  function chg(v, d, pre, post) {
    if (!f(v)) return '<span class="og-pill">n/a</span>';
    const a = Math.abs(v) < 1e-9 ? 0 : v;
    const t = (a > 0 ? "+" : a < 0 ? "−" : "") + (pre || "") + U().fmt(Math.abs(a), d) + (post || "");
    return '<span class="og-pill ' + (a > 0 ? "up" : a < 0 ? "dn" : "") + '">' + esc(t) + "</span>";
  }
  function stale(days, limit, what) {
    if (days == null || days <= limit) return "";
    return '<span class="ogx-stale" title="' + esc(what || "") + '">' + days + " days old</span>";
  }
  /* Legend chips: [{label, color, dash}] */
  function legend(items) {
    return '<div class="ogx-leg">' + items.map(it => '<span><i class="' + (it.dash ? "d" : it.box ? "b" : "") + '" style="--c:' + it.color + '"></i>' + esc(it.label) + "</span>").join("") + "</div>";
  }
  /* Block with a kicker (what), a headline (the point) and a right-hand slot. */
  function section(root, id, kicker, asof) {
    const el = document.createElement("section");
    el.className = "og-block ogx-b";
    if (id) el.id = id;
    el.innerHTML = '<header class="og-h ogx-bh"><div class="ogx-bt"><p class="ogx-kick">' + esc(kicker) + '</p><h2 class="ogx-hl"></h2></div><div class="ogx-bh-r"><p class="og-asof">' + (asof || "") + "</p></div></header>" +
      '<p class="ogx-dek" hidden></p><div class="og-body"></div>';
    root.appendChild(el);
    return el;
  }
  function headline(el, text, dek) {
    el.querySelector(".ogx-hl").textContent = text || "";
    const d = el.querySelector(".ogx-dek");
    if (dek) { d.innerHTML = dek; d.hidden = false; }
  }
  function body(el) { return el.querySelector(".og-body"); }
  function contractOf(r) {
    if (r && r.contract && r.contract.month) return r.contract.month;
    const m = String((r && r.name) || "").match(/([A-Z][a-z]{2}-\d{2})\s*$/);
    return m ? m[1] : "";
  }
  function closes(r) {
    const d = r && r.ohlc && r.ohlc.d;
    return Array.isArray(d) ? d.map(x => Array.isArray(x) && f(x[3]) ? x[3] : null) : null;
  }
  /* ---------- chart system adapter ---------- */
  const C = () => window.EMMICharts;
  const COL = { a: "var(--og-a)", b: "var(--og-b)", r: "var(--og-r)", t: "var(--og-t)", v: "var(--og-v)", o: "var(--og-o)", s: "var(--og-s)" };
  /* Old call shape {h, aria, zero, x, series:[{color,width,dash,vals,name,end}]} drawn by the shared system. */
  function chart(el, o) {
    C().lines(el, {
      h: o.h, aria: o.aria, zero: o.zero, ticks: o.x, labels: o.labels, d: o.d == null ? 1 : o.d, unit: o.unit,
      endLabels: o.endLabels, last: o.last, forecastFrom: o.shadeFrom, markers: o.markers,
      series: (o.series || []).map(s => ({ name: s.name, vals: s.vals, color: s.color, width: s.width || 2, dash: s.dash, faint: s.faint, end: s.end, area: s.area }))
    });
  }
  function stamp(t) { return '<span class="asof">' + t + "</span>"; }

  /* ---------- 0 hero: today, pressure gauge, money flow ---------- */
  const ENERGY_RX = /\b(oil|brent|wti|crude|ttf|gas|diesel|gasoil|opec|refin|barrel|lng|hormuz)\b/i;
  function sentences(p) { const m = String(p || "").match(/^(.+?[.!?])(\s+|$)([\s\S]*)$/); return m ? [m[1], m[3]] : [String(p || ""), ""]; }
  function heroToday(host, d, q, shapes) {
    const lc = d.live_comment || {};
    const age = lc.written_at ? (Date.now() - Date.parse(lc.written_at)) / 36e5 : null;
    const paras = (lc.body || []).filter(p => ENERGY_RX.test(p));
    const views = (lc.views || []).filter(v => ENERGY_RX.test(v.text || ""));
    const fresh = age != null && age < 20 && paras.length;
    const bz = q["BZ=F"], ttf = q["TTF=F"], ho = q["HO=F"];
    const p1 = r => r && r.pct ? r.pct["1D"] : null;
    let head = lc.headline || "";
    if (!fresh) {
      head = bz && f(bz.px) ? "Brent " + (p1(bz) >= 0 ? "up " : "down ") + U().fmt(Math.abs(p1(bz)), 1) + "% at $" + U().fmt(bz.px, 2) + (ttf && f(p1(ttf)) ? ", TTF " + U().signed(p1(ttf), "%") : "") : "Live energy prices are not in the market file right now";
    }
    const bullets = fresh ? paras.map(p => { const s = sentences(p); return "<li><b>" + esc(s[0]) + "</b> " + esc(s[1]) + "</li>"; }).join("") : "";
    /* Live lines, from the numbers on this page right now */
    const live = [];
    if (bz && f(bz.px)) live.push("<p><b>Brent</b> $" + esc(U().fmt(bz.px, 2)) + " " + pct(p1(bz)) + ' <span class="ogx-k">1W</span> ' + pct((bz.pct || {})["1W"]) + "</p>");
    const br = shapes && shapes.brent;
    if (br && br.now) live.push("<p><b>Curve</b> " + (br.now.spread >= 0 ? "backwardation" : "contango") + " $" + esc(U().fmt(Math.abs(br.now.spread), 2)) + " " + esc(br.now.l1) + "→" + esc(br.now.l12) + (br.prev ? " " + chg(br.now.spread - br.prev.spread, 2, "$") : "") + "</p>");
    if (ho && bz && f(ho.px) && f(bz.px)) {
      const cr = ho.px * 42 - bz.px, pv = f(ho.prev_close) && f(bz.prev_close) ? ho.prev_close * 42 - bz.prev_close : null;
      live.push("<p><b>Diesel crack</b> $" + esc(U().fmt(cr, 2)) + "/bbl " + chg(f(pv) ? cr - pv : null, 2, "$") + "</p>");
    }
    if (ttf && f(ttf.px)) live.push("<p><b>TTF</b> €" + esc(U().fmt(ttf.px, 2)) + "/MWh " + pct(p1(ttf)) + "</p>");
    const when = lc.written_at ? new Date(lc.written_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }) : "";
    host.insertAdjacentHTML("beforeend", '<section class="block lp-tone ogx-today" id="ogToday"><header class="bh"><p class="kick">What’s driving oil &amp; gas</p>' + stamp(fresh ? "Written " + esc(when) + " Zurich" : "Built from live prices " + esc(d.mktAt ? zurich(d.mktAt) : "") + " Zurich") + "</header>" +
      "<h2>" + esc(head) + "</h2>" + (fresh && lc.tone ? '<p class="tone">' + esc(lc.tone) + "</p>" : "") +
      '<div class="tone-g"><div>' + (bullets ? "<ul>" + bullets + "</ul>" : '<p class="from">No energy comment from today’s Pulse yet; the live readings on the right are current.</p>') + "</div>" +
      '<div class="views"><h3>Live now <span class="h3n">' + esc(d.mktAt ? zurich(d.mktAt) + " Zurich" : "") + "</span></h3>" + live.join("") +
      views.map(v => '<h3>' + esc(v.section || "") + "</h3><p>" + esc(v.text || "") + "</p>").join("") + "</div></div>" +
      (fresh ? '<p class="from">Comment from ' + esc(lc.written_by || "the Live Pulse") + ". The comment is not live; the right-hand numbers are." + (lc.source && lc.source.href ? ' <a href="#briefs/live">Open the Live Pulse →</a>' : "") + "</p>" : "") + "</section>");
  }
  const clamp = v => Math.max(-1, Math.min(1, v));
  function pressure(d, q, shapes) {
    const parts = [], left = [];
    const add = (label, shown, score, why) => { if (f(score)) parts.push({ label: label, shown: shown, score: clamp(score), why: why }); };
    const br = shapes && shapes.brent, ho = shapes && shapes.ho;
    if (br && br.now) { const p = br.now.spread / br.now.m1 * 100; add("Brent curve, M1 vs M12", (p >= 0 ? "+" : "") + U().fmt(p, 1) + "%", p / 8, "+8% backwardation or more = +1, 8% contango = −1"); } else left.push("Brent curve shape (curve archive not available)");
    if (ho && ho.now) { const p = ho.now.spread / ho.now.m1 * 100; add("Diesel curve, M1 vs M12", (p >= 0 ? "+" : "") + U().fmt(p, 1) + "%", p / 8, "same scale as Brent; M1 and M12 are the 1st and 12th monthly contracts"); } else left.push("Diesel curve shape");
    const bz = q["BZ=F"];
    if (bz && bz.ma && bz.ma["200"] && f(bz.ma["200"].pct)) add("Brent vs 200-day avg", U().signed(bz.ma["200"].pct, "%"), bz.ma["200"].pct / 15, "+15% above = +1");
    if (bz && bz.pct && f(bz.pct["1M"])) add("Brent, 1 month", U().signed(bz.pct["1M"], "%"), bz.pct["1M"] / 10, "+10% = +1");
    const ttf = q["TTF=F"];
    if (ttf && ttf.pct && f(ttf.pct["1M"])) add("TTF gas, 1 month", U().signed(ttf.pct["1M"], "%"), ttf.pct["1M"] / 15, "+15% = +1");
    const w = d.us_weekly || {};
    [["us_commercial_crude_stocks", "US crude stocks vs 5-yr"], ["us_distillate_stocks", "US distillates vs 5-yr"]].forEach(([k, label]) => {
      const s = w[k];
      if (!s || !f(s.vs_normal_pct)) { left.push(label); return; }
      const a = ageDays(s.as_of);
      if (a != null && a > 21) { left.push(label + " (week to " + dShort(s.as_of) + ", too old)"); return; }
      add(label, U().signed(s.vs_normal_pct, "%") + ' <span class="ogx-k">wk ' + esc(dShort(s.as_of)) + "</span>", -s.vs_normal_pct / 8, "8% below normal = +1");
    });
    const gs = d.gas && d.gas.areas && d.gas.areas.EU;
    if (gs && gs.s && f(gs.s.vsAvg)) {
      const a = ageDays(gs.last);
      if (a != null && a > 14) left.push("EU gas storage " + U().signed(gs.s.vsAvg, " pp") + " vs 5-yr, but the storage file stops at " + dShort(gs.last));
      else add("EU gas storage vs 5-yr", U().signed(gs.s.vsAvg, " pp") + ' <span class="ogx-k">' + esc(dShort(gs.last)) + "</span>", -gs.s.vsAvg / 10, "10 pp below = +1");
    } else left.push("EU gas storage (file not available)");
    const n = parts.length;
    parts.forEach(p => { p.contrib = p.score / n * 100; });
    const score = n ? Math.round(parts.reduce((a, p) => a + p.contrib, 0)) : null;
    return { score: score, label: score == null ? "Not available" : score >= 25 ? "Tight" : score <= -25 ? "Loose" : "Balanced", parts: parts, left: left };
  }
  function dial(score) {
    const W = 220, H = 124, cx = 110, cy = 112, R = 92;
    const pt = (v, r) => { const a = Math.PI * (1 - (v + 100) / 200); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    const arc = (a, b, cls) => { const p = pt(a, R), q = pt(b, R); return '<path class="' + cls + '" d="M' + p[0].toFixed(1) + " " + p[1].toFixed(1) + " A" + R + " " + R + " 0 0 1 " + q[0].toFixed(1) + " " + q[1].toFixed(1) + '"/>'; };
    let s = '<svg class="lp-dial" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Oil and gas pressure ' + (f(score) ? score : "not available") + ' from −100 (loose) to +100 (tight)">';
    s += arc(-100, -25, "seg off") + arc(-25, 25, "seg mid") + arc(25, 100, "seg on");
    if (f(score)) { const t = pt(score, R - 16); s += '<line class="needle" x1="' + cx + '" y1="' + cy + '" x2="' + t[0].toFixed(1) + '" y2="' + t[1].toFixed(1) + '"/><circle class="hub" cx="' + cx + '" cy="' + cy + '" r="4"/>'; }
    return s + '<text x="12" y="' + (H - 2) + '" class="dl">Loose</text><text x="' + (W - 12) + '" y="' + (H - 2) + '" text-anchor="end" class="dl">Tight</text></svg>';
  }
  function heroGauge(host, d, q, shapes) {
    const g = pressure(d, q, shapes);
    const rows = g.parts.map(p => {
      const w = Math.min(50, Math.abs(p.contrib) * 50 / (100 / Math.max(1, g.parts.length))).toFixed(1);
      return "<tr><th>" + esc(p.label) + "</th><td>" + p.shown + '</td><td class="cb"><span class="fb"><i class="' + (p.contrib >= 0 ? "up" : "dn") + '" style="' + (p.contrib >= 0 ? "left:50%" : "right:50%") + ";width:" + w + '%"></i></span></td><td class="cv ' + (p.contrib > 0 ? "up" : p.contrib < 0 ? "dn" : "") + '">' + (p.contrib > 0 ? "+" : p.contrib < 0 ? "−" : "") + Math.abs(p.contrib).toFixed(1) + "</td></tr>";
    }).join("");
    const method = "<p>Each input becomes a score from −1 (loose: plenty of supply, prices easing) to +1 (tight: scarce prompt barrels, prices firming), capped there. The gauge is the average × 100. Tight at +25 or above, loose at −25 or below, balanced in between. Equal weights. Curve shape is the front contract against the 12th from today’s settlement archive; Brent and TTF moves are the live front contracts; US stocks are the latest EIA week against the same-week 5-year average.</p><ul>" +
      g.parts.map(p => "<li><b>" + esc(p.label) + ":</b> " + esc(p.why) + "</li>").join("") + "</ul>";
    host.insertAdjacentHTML("beforeend", '<section class="block lp-risk ogx-gauge" id="ogGauge"><header class="bh"><h2>Oil &amp; gas pressure</h2><span class="bh-r">' + stamp("Prices " + esc(d.mktAt ? zurich(d.mktAt) : "") + " Zurich") + '<button type="button" class="info" data-lp-info="ogGaugeInfo" aria-expanded="false" aria-controls="ogGaugeInfo" aria-label="How the gauge works">i</button></span></header>' +
      '<div class="lp-risk-in"><div class="lp-dialbox">' + dial(g.score) + '<p class="lp-score ' + (g.score >= 25 ? "up" : g.score <= -25 ? "dn" : "") + '">' + (f(g.score) ? (g.score > 0 ? "+" : g.score < 0 ? "−" : "") + Math.abs(g.score) : "—") + '</p><p class="lp-label">' + esc(g.label) + "</p></div>" +
      '<div class="lp-parts"><table><thead><tr><th>Input</th><th>Reading</th><th class="cb">Contribution</th><th class="cv">pts</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      (g.left.length ? '<p class="fnote">Left out: ' + esc(g.left.join("; ")) + ".</p>" : "") + "</div></div>" +
      '<div class="info-panel" id="ogGaugeInfo" hidden>' + method + "</div></section>");
    /* the "i" button is toggled by the page-wide handler in v2/shared/ui.js (aria-controls) */
  }
  function closesAgo(r, k) {
    const c = closes(r);
    if (!c || c.length <= k) return null;
    return c[c.length - 1 - k];
  }
  function spreadMove(a, b, calc, p) {
    if (!a || !b || !f(a.px) || !f(b.px)) return null;
    const now = calc(a.px, b.px);
    if (p === "1D") return f(a.prev_close) && f(b.prev_close) ? now - calc(a.prev_close, b.prev_close) : null;
    if (!a.ohlc || !b.ohlc || a.ohlc.d0 !== b.ohlc.d0) return null;
    const k = p === "1W" ? 5 : 21, x = closesAgo(a, k), y = closesAgo(b, k);
    return f(x) && f(y) ? now - calc(x, y) : null;
  }
  function flowPanel(title, rows, note, unit) {
    const ok = rows.filter(r => f(r.v)).sort((a, b) => b.v - a.v);
    const mx = Math.max.apply(null, ok.map(r => Math.abs(r.v)).concat([0.0001]));
    const fv = r => (r.v > 0 ? "+" : r.v < 0 ? "−" : "") + (r.u === "$" ? "$" + U().fmt(Math.abs(r.v), 2) : U().fmt(Math.abs(r.v), 1) + "%");
    const body = ok.length ? ok.map(r => '<li><span class="fn">' + esc(r.name) + '</span><span class="fb"><i class="' + (r.v >= 0 ? "up" : "dn") + '" style="' + (r.v >= 0 ? "left:50%" : "right:50%") + ";width:" + (Math.abs(r.v) / mx * 50).toFixed(1) + '%"></i></span><span class="fv ' + (r.v > 0 ? "up" : r.v < 0 ? "dn" : "") + '">' + esc(fv(r)) + "</span></li>").join("") : '<li class="na">Not available for this period</li>';
    return '<div class="lp-flow-p"><h3>' + esc(title) + "</h3><ol>" + body + "</ol>" + (note ? '<p class="fnote">' + esc(note) + "</p>" : "") + "</div>";
  }
  function heroFlow(host, d, q, shapes) {
    const sec = document.createElement("section");
    sec.className = "block lp-flow ogx-flow";
    sec.id = "ogFlow";
    host.appendChild(sec);
    let per = "1D";
    try { per = localStorage.getItem("emmiOgPer") || "1D"; } catch (e) { /* private mode */ }
    const groups = d.groups || [];
    const energy = groups.find(g => g.id === "energy");
    const majors = energy ? ((energy.sections || []).find(s => !s.label) || { rows: [] }).rows.filter(r => r.kind === "equity" || /^X(LE|OP)$/.test(r.sym)) : [];
    const london = energy ? ((energy.sections || []).find(s => /London/.test(s.label || "")) || { rows: [] }).rows : [];
    const pc = (r, p) => r && r.pct && f(r.pct[p]) ? r.pct[p] : null;
    const draw = () => {
      const p = per;
      const com = [["BZ=F", "Brent"], ["CL=F", "WTI"], ["HO=F", "Diesel (ULSD)"], ["NG=F", "Henry Hub gas"], ["TTF=F", "TTF gas"], ["CO2.L", "EU carbon (ETC)"]].map(([s, n]) => ({ name: n, v: pc(q[s], p) }));
      const bz = q["BZ=F"], cl = q["CL=F"], ho = q["HO=F"];
      const spr = [
        { name: "Brent – WTI", v: spreadMove(bz, cl, (x, y) => x - y, p), u: "$" },
        { name: "Diesel crack", v: spreadMove(ho, bz, (x, y) => x * 42 - y, p), u: "$" }
      ];
      const br = shapes && shapes.brent;
      if (p === "1D" && br && br.now && br.prev) spr.push({ name: "Brent front–12th", v: br.now.spread - br.prev.spread, u: "$" });
      const eq = majors.map(r => ({ name: ({ XLE: "XLE (US energy ETF)", XOP: "XOP (US E&P ETF)" })[r.sym] || r.name, v: pc(r, p) }));
      const ld = london.map(r => ({ name: r.name, v: pc(r, p) })).filter(r => f(r.v)).sort((a, b) => b.v - a.v);
      const avg = ld.length ? ld.reduce((a, r) => a + r.v, 0) / ld.length : null;
      const ldShow = ld.slice(0, 4).concat(ld.length > 8 ? ld.slice(-4) : ld.slice(4));
      if (f(avg)) ldShow.push({ name: "All " + ld.length + " (equal weight)", v: avg });
      const btn = k => '<button type="button" data-og-per="' + k + '" aria-pressed="' + (p === k) + '">' + k + "</button>";
      sec.innerHTML = '<header class="bh"><h2>Where the energy money is going</h2><span class="bh-r">' + stamp("Prices " + esc(d.mktAt ? zurich(d.mktAt) : "") + " Zurich") + '<span class="cdl-scale lp-per" role="group" aria-label="Period">' + btn("1D") + btn("1W") + btn("1M") + "</span></span></header>" +
        '<div class="lp-flow-g">' + flowPanel("Oil, gas and carbon", com, "Front futures; EU carbon is the quoted EUA ETC.") +
        flowPanel("Spreads and cracks", spr, p === "1D" ? "Change in $ per barrel; curve spread from today’s settlement archive." : "Change in $ per barrel over the period, from daily closes. The curve spread has too little archive for this period.", "$") +
        flowPanel("Majors and energy ETFs", eq) + flowPanel("London E&Ps: best and worst", ldShow, "Top and bottom four of the London-listed E&P list.") + "</div>";
    };
    draw();
    sec.addEventListener("click", e => {
      const b = e.target.closest("[data-og-per]");
      if (!b) return;
      per = b.getAttribute("data-og-per");
      try { localStorage.setItem("emmiOgPer", per); } catch (x) { /* private mode */ }
      draw();
    });
  }
  function hero(root, d, q, shapes) {
    const host = document.createElement("div");
    host.className = "lp ogx-hero";
    root.appendChild(host);
    heroToday(host, d, q, shapes);
    heroGauge(host, d, q, shapes);
    heroFlow(host, d, q, shapes);
  }

  /* ---------- 1 prices ---------- */
  const TAPE = [
    { sym: "BZ=F", name: "Brent", unit: "/bbl", pre: "$", d: 2 },
    { sym: "CL=F", name: "WTI", unit: "/bbl", pre: "$", d: 2 },
    { sym: "HO=F", name: "NY Harbor ULSD", unit: "/gal", pre: "$", d: 3 },
    { sym: "NG=F", name: "Henry Hub gas", unit: "/mmBtu", pre: "$", d: 3 },
    { sym: "TTF=F", name: "Dutch TTF gas", unit: "/MWh", pre: "€", d: 2 }
  ];
  function axisDates(q, sc) {
    const o = q && q.ohlc;
    if (!o) return null;
    if (sc === "m") {
      const m = C().monthSeq(o.m0, (o.m || []).length);
      return m ? { labels: m.map(x => C().monLabel(x, true)), ticks: m.map((x, i) => (i % 3 === (m.length - 1) % 3) ? (x.slice(5) === "01" || i === m.length - 1 ? C().monLabel(x) + " " + x.slice(2, 4) : C().monLabel(x)) : null) } : null;
    }
    const n = (o.d || []).length;
    const ds = C().sessionDates(o.d0, n, q.bar_date);
    if (!ds) return { labels: (o.d || []).map((x, i) => "Session " + (i + 1) + " of " + n), ticks: null };
    return { labels: ds.map(x => new Date(x + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })), ticks: ds.map((x, i) => (n - 1 - i) % 5 === 0 ? C().dayLabel(x) : null) };
  }
  function tileHead(name, ct, px, pre, unit, d, pills) {
    return '<div class="ogx-tt"><span class="ogx-tn">' + esc(name) + '</span><span class="ogx-ct">' + esc(ct) + "</span></div>" +
      '<div class="ogx-pr"><span class="ogx-px"><small>' + esc(pre) + "</small>" + esc(U().fmt(px, d)) + '<small class="u">' + esc(unit) + "</small></span>" + pills + "</div>";
  }
  function priceTile(q, t, sc) {
    const el = document.createElement("div");
    el.className = "ogx-tile";
    if (!q || !f(q.px)) { el.classList.add("is-na"); el.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(t.name) + '</span></div><p class="ogx-qm">Not in the market file right now.</p>'; return el; }
    const p = q.pct || {};
    const when = q.bar_date && q.bar_date !== new Date().toISOString().slice(0, 10) ? "Close " + dShort(q.bar_date) : (zurich(q.market_time) ? zurich(q.market_time) + " Zurich" : dShort(q.bar_date));
    el.innerHTML = tileHead(t.name, contractOf(q), q.px, t.pre, t.unit, t.d, pct(p["1D"])) +
      '<p class="ogx-sm"><span class="ogx-k">1W</span>' + pctTxt(p["1W"]) + '<span class="ogx-k">1M</span>' + pctTxt(p["1M"]) + '<span class="ogx-k">YTD</span>' + pctTxt(p.YTD) + "</p>" +
      '<div class="ogx-cc"></div><p class="ogx-qm">' + esc(when) + (q.state === "open" ? ' · <span class="ogx-live">trading</span>' : "") + "</p>";
    const o = q.ohlc || {};
    const bars = sc === "m" ? o.m : o.d;
    const ax = axisDates(q, sc) || {};
    C().candles(el.querySelector(".ogx-cc"), { bars: bars, labels: ax.labels, ticks: ax.ticks, d: t.d, pre: "", h: 150, prev: q.prev_close, aria: t.name + (sc === "m" ? " monthly candles, last 13 months" : " daily candles, last 22 sessions") });
    return el;
  }
  function pctTxt(v) { return '<b class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + (f(v) ? U().signed(v, "%") : "n/a") + "</b>"; }
  function spreadTile(name, sub, unit, a, b, calc, d, color, sc) {
    if (!a || !b || !f(a.px) || !f(b.px)) return null;
    const el = document.createElement("div");
    el.className = "ogx-tile ogx-der";
    const now = calc(a.px, b.px);
    const prev = f(a.prev_close) && f(b.prev_close) ? calc(a.prev_close, b.prev_close) : null;
    const key = sc === "m" ? "m" : "d";
    const ca = a.ohlc && a.ohlc[key], cb = b.ohlc && b.ohlc[key];
    let vals = null, labels = null, ticks = null;
    if (ca && cb && ca.length === cb.length && a.ohlc[key + "0"] === b.ohlc[key + "0"]) {
      vals = ca.map((x, i) => f(x && x[3]) && f(cb[i] && cb[i][3]) ? calc(x[3], cb[i][3]) : null);
      const ax = axisDates(a, sc) || {};
      labels = ax.labels; ticks = ax.ticks;
    }
    el.innerHTML = tileHead(name, "computed", now, "$", unit, d, chg(f(prev) ? now - prev : null, 2, "$")) +
      '<p class="ogx-sm">' + esc(sub) + '</p><div class="ogx-cc"></div><p class="ogx-qm">' + (vals ? "Dashed line: average of the period shown" : "Contract histories do not line up, so no chart") + "</p>";
    if (vals) {
      const ok = vals.filter(f), avg = ok.reduce((x, y) => x + y, 0) / ok.length;
      C().lines(el.querySelector(".ogx-cc"), { h: 150, d: d, pre: "", series: [{ name: name, vals: vals, color: color, width: 2, area: true, smooth: false }], labels: labels, ticks: ticks, refs: [{ y: avg, label: "avg " + U().fmt(avg, d), color: "var(--muted)" }], aria: name + " over the period" });
    }
    return el;
  }
  function trendTile(q) {
    const ma = q && q.ma;
    if (!ma || !f(q.px)) return null;
    const rows = ["10", "20", "50", "200"].filter(k => ma[k] && f(ma[k].v));
    if (!rows.length) return null;
    const above = rows.filter(k => q.px >= ma[k].v).length;
    const mx = Math.max(...rows.map(k => Math.abs(ma[k].pct || 0)), 1);
    const el = document.createElement("div");
    el.className = "ogx-tile ogx-der";
    el.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">Brent trend</span><span class="ogx-ct">moving averages</span></div>' +
      '<p class="ogx-trs">' + (above === rows.length ? "Above every average" : above === 0 ? "Below every average" : "Above " + above + " of " + rows.length + " averages") + "</p>" +
      '<ol class="ogx-mab">' + rows.map(k => { const v = ma[k].pct; return '<li><span class="fn">' + k + '-day <small>$' + esc(U().fmt(ma[k].v, 2)) + '</small></span><span class="fb"><i class="' + (v >= 0 ? "up" : "dn") + '" style="' + (v >= 0 ? "left:50%" : "right:50%") + ";width:" + (Math.abs(v) / mx * 50).toFixed(1) + '%"></i></span><span class="fv ' + (v >= 0 ? "up" : "dn") + '">' + esc(U().signed(v, "%")) + "</span></li>"; }).join("") + "</ol>" +
      '<p class="ogx-qm">Brent ' + esc(contractOf(q)) + " against each average. Crossovers are context, not signals.</p>";
    return el;
  }
  function prices(root, spot, quotes) {
    const el = section(root, "ogPx", "Prices", "");
    const b = body(el);
    const bz = quotes["BZ=F"], cl = quotes["CL=F"], ho = quotes["HO=F"], hh = quotes["NG=F"], ttf = quotes["TTF=F"];
    if (bz && f(bz.px)) {
      const d1 = (bz.pct || {})["1D"], w1 = (bz.pct || {})["1W"];
      const verb = !f(d1) ? "is" : d1 >= 0.3 ? "up " + U().fmt(d1, 1) + "% today at" : d1 <= -0.3 ? "down " + U().fmt(Math.abs(d1), 1) + "% today at" : "little changed today at";
      const wk = f(w1) ? (Math.sign(w1) !== Math.sign(d1 || 0) && Math.abs(w1) >= 0.5 ? ", still " : ", ") + (w1 >= 0 ? "up " : "down ") + U().fmt(Math.abs(w1), 1) + "% on the week" : "";
      headline(el, "Brent " + verb + " $" + U().fmt(bz.px, 2) + wk);
    } else headline(el, "Live crude prices are not in the market file right now");
    let sc = window.MMCandles ? MMCandles.scale() : "d";
    el.querySelector(".ogx-bh-r").innerHTML = '<div class="ogx-cdl" role="group" aria-label="Chart period"><button type="button" data-og-sc="d">1M <small>daily</small></button><button type="button" data-og-sc="m">1Y <small>monthly</small></button></div>';
    const grid = document.createElement("div");
    grid.className = "ogx-tiles";
    b.appendChild(grid);
    const draw = () => {
      grid.innerHTML = "";
      TAPE.forEach(t => grid.appendChild(priceTile(quotes[t.sym], t, sc)));
      [spreadTile("Brent – WTI", "Brent " + contractOf(bz) + " less WTI " + contractOf(cl), "/bbl", bz, cl, (x, y) => x - y, 2, COL.b, sc),
        spreadTile("Diesel crack", "ULSD " + contractOf(ho) + " × 42 less Brent " + contractOf(bz), "/bbl", ho, bz, (x, y) => x * 42 - y, 2, COL.o, sc),
        trendTile(bz)].forEach(x => { if (x) grid.appendChild(x); });
      el.querySelectorAll("[data-og-sc]").forEach(x => x.setAttribute("aria-pressed", String(x.getAttribute("data-og-sc") === sc)));
    };
    draw();
    el.addEventListener("click", e => {
      const t = e.target.closest("[data-og-sc]");
      if (!t) return;
      sc = t.getAttribute("data-og-sc");
      if (window.MMCandles) MMCandles.setScale(sc);
      draw();
    });
    const rows = [["brent_spot", "Brent FOB", "$/bbl"], ["wti_spot", "WTI Cushing", "$/bbl"], ["henry_hub_spot", "Henry Hub", "$/mmBtu"]].filter(r => spot && spot[r[0]]);
    if (rows.length) {
      const asof = spot[rows[0][0]].as_of;
      let t = '<div class="ogx-sub"><h3>EIA physical spot <span class="ogx-h3n">as of ' + esc(dShort(asof)) + " · EIA publishes about a week late</span>" + stale(ageDays(asof), 10, "EIA spot file") + '</h3><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Market</th><th>Last</th><th>30-day avg</th><th>vs 30d</th><th>Month so far vs last month</th><th>vs 5-yr avg</th></tr></thead><tbody>';
      rows.forEach(([k, name, unit]) => {
        const s = spot[k];
        const vs30 = f(s.latest) && f(s.ma30) && s.ma30 ? (s.latest / s.ma30 - 1) * 100 : null;
        t += "<tr><th>" + esc(name) + ' <span class="ogx-u">' + esc(unit) + "</span></th><td>" + esc(U().fmt(s.latest, 2) || "n/a") + "</td><td>" + esc(U().fmt(s.ma30, 2) || "n/a") + "</td><td>" + pct(vs30) + "</td><td>" + pct(s.mtd_vs_prev_pct) + "</td><td>" + pct(s.vs_5y_pct) + "</td></tr>";
      });
      b.insertAdjacentHTML("beforeend", t + "</tbody></table></div></div>");
    }
    U().park(b, "Tiles are the front futures contracts from the live market file (contract month shown), refreshed every 15 minutes on weekdays. 1M shows one candle per session for the last 22 sessions; 1Y one candle per calendar month (this month to date). Green closed at or above the open, red below. The tag on the right axis is the last price. Hover or tap a chart for the values. Brent – WTI and the diesel crack are computed here from those two quotes; the contract months can differ, as labelled. NBP gas and gasoil are not in the market file, so they are not shown.");
    U().park(b, esc(((spot && spot.meta) || {}).source || "EIA spot prices") + ". " + esc(((spot && spot.meta) || {}).window || ""));
  }

  /* ---------- 2 curves ---------- */
  function parseCSV(text) {
    const lines = String(text || "").trim().split(/\r?\n/);
    const head = lines.shift().split(",");
    return lines.map(l => { const c = l.split(","); const o = {}; head.forEach((h, i) => { o[h] = c[i]; }); return o; });
  }
  async function curveRows(id, date) {
    try { const r = await fetch(CURVES + id + "/" + date + ".csv"); return r.ok ? parseCSV(await r.text()) : null; } catch (e) { return null; }
  }
  async function curveShape(id) {
    try {
      const r = await fetch(CURVES + id + "/index.json?t=" + Math.floor(Date.now() / 36e5));
      if (!r.ok) return null;
      const meta = await r.json();
      const dates = meta.dates || [];
      if (!dates.length) return null;
      const now = await curveRows(id, dates[dates.length - 1]);
      const prev = dates.length > 1 ? await curveRows(id, dates[dates.length - 2]) : null;
      const pick = rows => {
        if (!rows || rows.length < 12) return null;
        const a = Number(rows[0].settle), z = Number(rows[11].settle);
        return f(a) && f(z) ? { m1: a, m12: z, l1: rows[0].label, l12: rows[11].label, spread: a - z } : null;
      };
      return { id: id, unit: meta.unit, date: dates[dates.length - 1], prevDate: dates.length > 1 ? dates[dates.length - 2] : null, now: pick(now), prev: pick(prev) };
    } catch (e) { return null; }
  }
  function curves(root, shapes) {
    const el = section(root, "ogCurveSec", "Futures curves", "");
    const host = document.createElement("div");
    host.id = "ogCurves";
    body(el).appendChild(host);
    headline(el, "Brent and diesel forward curves");
    Promise.resolve([shapes && shapes.brent, shapes && shapes.ho]).then(([br, ho]) => {
      const word = s => s > 0 ? "backwardation" : s < 0 ? "contango" : "flat";
      if (br && br.now) {
        const s = br.now.spread;
        headline(el, "Brent is in " + (Math.abs(s) >= 5 ? "steep " : "") + word(s) + ": " + br.now.l1 + " trades $" + U().fmt(Math.abs(s), 2) + (s >= 0 ? " above " : " below ") + br.now.l12);
      }
      const chip = (c, name, d, pre) => {
        if (!c || !c.now) return "";
        const dd = c.prev ? c.now.spread - c.prev.spread : null;
        return '<div class="ogx-kpi"><span class="ogx-kl">' + esc(name) + " " + esc(c.now.l1) + " – " + esc(c.now.l12) + '</span><span class="ogx-kv">' + (c.now.spread >= 0 ? "+" : "−") + pre + esc(U().fmt(Math.abs(c.now.spread), d)) + ' <small>' + esc(c.unit || "") + '</small></span><span class="ogx-ks">' + word(c.now.spread) + (f(dd) ? " · " + chg(dd, d, pre) + ' <span class="ogx-k">vs ' + esc(dShort(c.prevDate)) + "</span>" : "") + "</span></div>";
      };
      const k = chip(br, "Brent", 2, "$") + chip(ho, "ULSD", 3, "$");
      if (k) el.querySelector(".ogx-dek").outerHTML = '<div class="ogx-kpis">' + k + "</div>";
      const day = (br && br.date) || (ho && ho.date);
      if (day) el.querySelector(".ogx-bh-r .og-asof").textContent = "Settlements " + dShort(day);
    });
  }

  /* ---------- 3 US weekly: seasonal ---------- */
  function weekIdx(iso) {
    const t = Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
    const y0 = Date.UTC(+String(iso).slice(0, 4), 0, 1);
    return Math.min(52, Math.floor((t - y0) / 864e5 / 7));
  }
  function weekly(root, data) {
    const crude = data.us_commercial_crude_stocks || {};
    const age = ageDays(crude.as_of);
    const el = section(root, "ogWeek", "US weekly balance", "EIA weekly · week to " + esc(dShort(crude.as_of)) + " " + stale(age, 9, "The newest EIA week is not in the file yet"));
    const b = body(el);
    if (f(crude.latest)) {
      const v = crude.vs_normal_pct;
      headline(el, "Commercial crude stocks " + U().fmt(crude.latest, 0) + " million bbl, " + (f(v) ? U().fmt(Math.abs(v), 1) + "% " + (v < 0 ? "below" : "above") + " the 5-year norm for the week" : "n/a against the 5-year norm"));
    }
    const grid = document.createElement("div");
    grid.className = "ogx-weeks";
    b.appendChild(grid);
    const keys = ["us_commercial_crude_stocks", "us_gasoline_stocks", "us_distillate_stocks", "us_gas_storage_l48", "us_crude_production", "us_product_supplied"];
    const colors = [COL.a, COL.o, COL.r, COL.b, COL.t, COL.v];
    const yr = String(crude.as_of || "").slice(0, 4);
    const ticksM = Array.from({ length: 53 }, (_, i) => { const m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334].findIndex(dd => Math.floor(dd / 7) === i); return m >= 0 && m % 2 === 0 ? MON[m] : null; });
    keys.forEach((key, i) => {
      const s = data[key];
      if (!s) return;
      const card = document.createElement("div");
      card.className = "ogx-wk";
      const big = s.latest >= 100 ? 0 : 1;
      const wd = Math.abs(s.wow) >= 10 ? 0 : 1;
      card.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(String(s.label || key).replace(/^US /, "").replace(/^./, c => c.toUpperCase())) + '</span><span class="ogx-ct">' + esc(s.unit || "") + "</span></div>" +
        '<div class="ogx-pr"><span class="ogx-px">' + esc(U().fmt(s.latest, big) || "n/a") + "</span>" + pct(s.vs_normal_pct) + '<span class="ogx-k">vs 5-yr</span></div>' +
        '<p class="ogx-sm"><span class="ogx-k">Week</span>' + chg(s.wow, wd).replace("og-pill", "og-pill ogx-q") + '<span class="ogx-k">Year</span>' + chg(s.yoy, s.latest >= 1000 ? 0 : 1).replace("og-pill", "og-pill ogx-q") + "</p>" +
        '<div class="ogx-cc"></div>';
      grid.appendChild(card);
      const ser = s.series_1y || [];
      const cur = Array(53).fill(null), prev = Array(53).fill(null), avg = Array(53).fill(null), lab = Array(53).fill("");
      ser.forEach(p => {
        const k = weekIdx(p[0]);
        if (String(p[0]).slice(0, 4) === yr) { cur[k] = p[1]; lab[k] = "Week to " + dShort(p[0]); }
        else { prev[k] = p[1]; if (!lab[k]) lab[k] = "Week to " + dShort(p[0]); }
        if (f(p[2])) avg[k] = p[2];
      });
      const li = cur.reduce((m, v, k) => f(v) ? k : m, -1);
      C().lines(card.querySelector(".ogx-cc"), {
        h: 150, d: big, labels: lab, ticks: ticksM, aria: s.label + ", seasonal",
        series: [
          { name: yr, vals: cur, color: colors[i], width: 2.2, end: true },
          { name: String(+yr - 1), vals: prev, color: colors[i], width: 1.4, faint: true },
          { name: "5-yr avg", vals: avg, color: "var(--muted)", width: 1.2, dash: "3 3" }
        ],
        whisker: s.range_5y && li >= 0 ? { i: li, lo: Math.min(s.range_5y[0], s.range_5y[1]), hi: Math.max(s.range_5y[0], s.range_5y[1]) } : null
      });
    });
    b.insertAdjacentHTML("beforeend", '<div class="ogx-leg"><span><i style="--c:var(--text)"></i>' + esc(yr) + ' so far</span><span><i style="--c:var(--text);opacity:.45"></i>' + (+yr - 1) + ' (the file’s last 12 months)</span><span><i class="d" style="--c:var(--muted)"></i>5-year average, same week</span><span><i class="w"></i>5-year low to high, latest week</span></div>');
    U().park(b, "Source: " + esc(((data.meta || {}).source) || "EIA") + ". The file carries the last 12 months, the same-week 5-year average and the 5-year low/high for the latest week only, so the shaded weekly band and a full prior-year line are not available. The bracket at the end of each line is that latest-week range.");
  }

  /* ---------- 4 global balance ---------- */
  function yearAvg(series, year) {
    const pts = (series || []).filter(p => String(p[0]).indexOf(String(year)) === 0 && f(p[1]));
    if (!pts.length) return null;
    return pts.reduce((s, p) => s + p[1], 0) / pts.length;
  }
  function balance(root, steo, outlook) {
    const meta = steo.meta || {};
    const el = section(root, "ogBal", "Global oil balance", esc(meta.source || "EIA STEO") + " · history to " + esc(mShort(meta.last_historical_month)));
    const b = body(el);
    const prod = steo.world_production || [], cons = steo.world_consumption || [], bal = steo.implied_balance || [];
    const from = prod.findIndex(p => String(p[0]) >= "2024-01");
    const cut = arr => arr.slice(from < 0 ? 0 : from);
    const P = cut(prod), Cn = cut(cons), Bl = cut(bal);
    const shade = P.findIndex(p => p[2] === true);
    const xl = P.map(p => String(p[0]).slice(5) === "01" ? String(p[0]).slice(0, 4) : null);
    const ml = P.map(p => mShort(p[0]));
    const y27 = [yearAvg(prod, 2027), yearAvg(cons, 2027)];
    if (f(y27[0]) && f(y27[1])) {
      const s = y27[0] - y27[1];
      headline(el, "EIA sees a " + U().fmt(Math.abs(s), 1) + " mb/d " + (s >= 0 ? "surplus" : "deficit") + " in 2027, with Brent averaging $" + U().fmt(yearAvg(steo.brent_usd, 2027), 0));
    }
    b.insertAdjacentHTML("beforeend", '<div class="ogx-two"><div><h3>Supply and demand <span class="ogx-h3n">mb/d, monthly</span></h3><div class="ogx-cc ogx-p1"></div></div><div><h3>Implied stock change <span class="ogx-h3n">mb/d · up = surplus, stocks build</span></h3><div class="ogx-cc ogx-p2"></div></div></div>');
    C().lines(b.querySelector(".ogx-p1"), { h: 200, d: 1, ticks: xl, labels: ml, forecastFrom: shade, endLabels: true, aria: "World oil production and consumption",
      series: [{ name: "Production", vals: P.map(p => p[1]), color: COL.a, width: 2.2 }, { name: "Demand", vals: Cn.map(p => p[1]), color: "var(--muted)", width: 1.8 }] });
    C().bars(b.querySelector(".ogx-p2"), { h: 200, d: 2, unit: "mb/d", ticks: xl, labels: Bl.map(p => mShort(p[0])), forecastFrom: shade, vals: Bl.map(p => p[1]), aria: "Implied global stock change" });
    const years = [2025, 2026, 2027];
    const cell = (series, y, d) => esc(U().fmt(yearAvg(series, y), d) || "–");
    let t = '<div class="ogx-scroll"><table class="ogx-tbl ogx-yr"><thead><tr><th>Annual average</th>' + years.map(y => "<th>" + y + (y > +String(meta.last_historical_month || "").slice(0, 4) ? "f" : "") + "</th>").join("") + "</tr></thead><tbody>";
    t += "<tr><th>Production, mb/d</th>" + years.map(y => "<td>" + cell(prod, y, 1) + "</td>").join("") + "</tr>";
    t += "<tr><th>Consumption, mb/d</th>" + years.map(y => "<td>" + cell(cons, y, 1) + "</td>").join("") + "</tr>";
    t += "<tr><th>Balance, mb/d</th>" + years.map(y => { const v = f(yearAvg(prod, y)) && f(yearAvg(cons, y)) ? yearAvg(prod, y) - yearAvg(cons, y) : null; return '<td class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + esc(U().signed(v, "", 1) || "–") + "</td>"; }).join("") + "</tr>";
    t += "<tr><th>Brent, $/bbl</th>" + years.map(y => "<td>" + cell(steo.brent_usd, y, 1) + "</td>").join("") + "</tr></tbody></table></div>";
    b.insertAdjacentHTML("beforeend", t);
    const stock = (steo.implied_balance || []).filter(p => p[2] !== true).pop();
    if (stock) b.insertAdjacentHTML("beforeend", '<p class="ogx-note">Last history month (' + esc(mShort(stock[0])) + ") implied balance " + esc(U().signed(stock[1], "", 1)) + " mb/d. Hatched = EIA forecast; f = forecast year.</p>");
    const iea = outlook && outlook.oil && outlook.oil.short_term && outlook.oil.short_term.iea_omr_oct2026_highlights;
    if (iea) b.insertAdjacentHTML("beforeend", '<div class="ogx-call"><p class="ogx-kick">Second opinion · IEA Oil Market Report, ' + esc(dShort(iea.published)) + "</p><p>Demand change " + esc(String(iea.demand_2026_change_mbd)) + " mb/d in 2026; 2027 versus 2025 " + esc(String(iea.demand_2027_vs_2025_kbd)) + " kb/d. Supply 2026 " + esc(String(iea.supply_2026_mbd)) + " mb/d (" + esc(String(iea.supply_2026_change_mbd)) + "), 2027 change " + esc(String(iea.supply_2027_change_mbd)) + " mb/d. " + esc(iea.context || "") + "</p></div>");
    U().park(b, esc(meta.source || "") + (meta.released ? ", released " + esc(meta.released) : "") + ". " + esc(meta.note || "") + " Implied stock change is world production less consumption.");
  }

  /* ---------- 5 costs: width = volume, height = unit cost ---------- */
  function costs(root, cc, quotes) {
    const el = section(root, "ogCost", "Cost curve", "Unit opex or lifting cost as reported · not full-cycle");
    const b = body(el);
    const steps = (cc.og_unit_cost_curve || []).filter(s => f(s.unit_cost_usd_boe)).slice().sort((a, z) => a.unit_cost_usd_boe - z.unit_cost_usd_boe);
    const venue = y => /\.OL$/.test(y || "") ? "Oslo" : /\.ST$/.test(y || "") ? "Stockholm" : "London";
    const vc = { London: COL.a, Oslo: COL.b, Stockholm: COL.t };
    const brent = quotes["BZ=F"] && f(quotes["BZ=F"].px) ? quotes["BZ=F"].px : null;
    const perm = ((cc.dallasfed_q1_2026 || {}).rows || []).find(r => /Permian \(all/.test(r.play || ""));
    const withVol = steps.filter(s => f(s.production_kboed) && s.production_kboed > 0);
    if (steps.length) {
      const lo = steps[0], hi = steps[steps.length - 1];
      const vol = withVol.reduce((a, s) => a + s.production_kboed, 0);
      headline(el, U().fmt(vol / 1000, 1) + " million boe/d from " + withVol.length + " producers costs $" + U().fmt(lo.unit_cost_usd_boe, 0) + " to $" + U().fmt(hi.unit_cost_usd_boe, 0) + "/boe to lift" + (brent && brent > hi.unit_cost_usd_boe ? ", all well below Brent at $" + U().fmt(brent, 0) : ""));
    }
    const refs = [];
    if (brent) refs.push({ y: brent, color: "var(--text)", label: "Brent $" + U().fmt(brent, 2) });
    if (perm && f(perm.breakeven_new_well)) refs.push({ y: perm.breakeven_new_well, color: "var(--bad)", label: "Permian new well $" + U().fmt(perm.breakeven_new_well, 0) });
    if (perm && f(perm.opex_existing_wells)) refs.push({ y: perm.opex_existing_wells, color: "var(--good)", label: "Permian existing wells $" + U().fmt(perm.opex_existing_wells, 0) });
    b.insertAdjacentHTML("beforeend", '<h3>Unit cost against output <span class="ogx-h3n">$/boe up, kboe/d across · width is each company’s output</span></h3><div class="ogx-cc ogx-cost"></div>');
    const shortName = n => /\(([^)]+)\)/.test(n) ? n.match(/\(([^)]+)\)/)[1] : n.replace(/ Energy$| Petroleum$/, "");
    C().costCurve(b.querySelector(".ogx-cost"), {
      xUnit: "kboe/d", yPre: "$", refs: refs, aria: "Unit cost curve, width is output",
      steps: withVol.map(s => ({ name: s.company, short: shortName(s.company), w: s.production_kboed, y: s.unit_cost_usd_boe, color: vc[venue(s.yahoo)],
        tip: C().tipRows(s.company, [{ k: "Unit cost", v: "$" + U().fmt(s.unit_cost_usd_boe, 1) + "/boe" }, { k: "Output", v: U().fmt(s.production_kboed, 1) + " kboe/d" }, { k: "Listing", v: venue(s.yahoo) }, { k: "Period", v: s.period }]) }))
    });
    b.insertAdjacentHTML("beforeend", '<div class="ogx-leg"><span><i class="b" style="--c:' + vc.London + '"></i>London-listed</span><span><i class="b" style="--c:' + vc.Oslo + '"></i>Oslo-listed</span><span><i class="b" style="--c:' + vc.Stockholm + '"></i>Stockholm-listed</span></div>');
    b.insertAdjacentHTML("beforeend", '<details class="ogx-more"><summary>All ' + steps.length + ' companies, cheapest first</summary><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Company</th><th>$/boe</th><th>kboe/d</th><th>Period</th></tr></thead><tbody>' +
      steps.map(s => "<tr><th>" + esc(s.company) + "</th><td>" + esc(U().fmt(s.unit_cost_usd_boe, 1)) + "</td><td>" + esc(U().fmt(s.production_kboed, 1) || "n/a") + "</td><td>" + esc(s.period) + "</td></tr>").join("") + "</tbody></table></div></details>");
    const df = (cc.dallasfed_q1_2026 || {}).rows || [];
    if (df.length) b.insertAdjacentHTML("beforeend", '<details class="ogx-more"><summary>US shale break-evens, Dallas Fed Energy Survey Q1 2026 ($/bbl WTI)</summary><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Group</th><th>New well</th><th>Existing wells, opex</th></tr></thead><tbody>' +
      df.map(r => "<tr><th>" + esc(r.play) + "</th><td>" + esc(U().fmt(r.breakeven_new_well, 0) || "n/a") + "</td><td>" + esc(U().fmt(r.opex_existing_wells, 0) || "n/a") + "</td></tr>").join("") + "</tbody></table></div></details>");
    U().park(b, "Unit opex or lifting cost as each company reports it, in $/boe; bases differ and none is full-cycle. Each block is as wide as that company’s reported output; Equinor’s volume is 9M 2026 against an FY2025 cost. Brent is the live front-month quote; the Permian lines are the Dallas Fed Q1 2026 survey averages. Hover or tap a block for its numbers.");
    (cc.gaps || []).forEach(g => U().park(b, esc(g)));
  }

  /* ---------- 6 outlook ---------- */
  function medium(root, outlook) {
    const oil = outlook.oil || {};
    const iea = oil.medium_term_iea;
    const opec = oil.long_term_opec;
    const el = section(root, "ogMed", "Medium and long term", "IEA Oil 2025 · OPEC World Oil Outlook 2026");
    const b = body(el);
    let grid = '<div class="ogx-two">';
    const ieaCols = { "OECD Europe": "var(--muted)", "China": COL.r, "Other Asia": COL.a };
    if (iea && iea.rows && iea.rows["Total demand"]) {
      const d = iea.rows["Total demand"], y = iea.years || [];
      headline(el, "Oil demand still grows to 2030 in the IEA baseline: " + U().fmt(d[0], 1) + " to " + U().fmt(d[d.length - 1], 1) + " mb/d");
      grid += '<div><h3>IEA world demand <span class="ogx-h3n">mb/d, ' + esc(y[0] + "–" + y[y.length - 1]) + ' · pre-war baseline</span></h3><div class="ogx-cc ogx-i1"></div><h3>IEA by region <span class="ogx-h3n">mb/d</span></h3><div class="ogx-cc ogx-i2"></div></div>';
    }
    const names = opec && opec.demand && opec.demand.rows ? ["China", "India", "OECD Europe"].filter(n => opec.demand.rows[n]) : [];
    const opCols = [COL.r, COL.a, "var(--muted)"];
    if (names.length) {
      const yy = opec.demand.years || [];
      grid += '<div><h3>OPEC demand outlook <span class="ogx-h3n">mb/d, ' + esc(yy[0] + "–" + yy[yy.length - 1]) + '</span></h3><div class="ogx-cc ogx-o1"></div>';
      const gas = outlook.gas && outlook.gas.long_term_opec;
      if (gas && gas.rows) {
        const gn = ["OECD Europe", "China", "India"].filter(n => gas.rows[n]);
        if (gn.length) grid += '<h3>OPEC gas demand <span class="ogx-h3n">' + esc(gas.unit || "") + ", first to last outlook year</span></h3><div class=\"ogx-kpis ogx-k3\">" +
          gn.map(n => '<div class="ogx-kpi"><span class="ogx-kl">' + esc(n) + '</span><span class="ogx-kv">' + esc(U().fmt(gas.rows[n][0], 1)) + " → " + esc(U().fmt(gas.rows[n][gas.rows[n].length - 1], 1)) + "</span></div>").join("") + "</div>";
      }
      grid += "</div>";
    }
    b.insertAdjacentHTML("beforeend", grid + "</div>");
    if (iea && iea.rows) {
      const y = (iea.years || []).map(String);
      if (b.querySelector(".ogx-i1")) C().lines(b.querySelector(".ogx-i1"), { h: 130, d: 1, ticks: y, labels: y, unit: "mb/d", aria: "IEA total oil demand", series: [{ name: "World", vals: iea.rows["Total demand"], color: "var(--text)", width: 2.2, area: true }] });
      if (b.querySelector(".ogx-i2")) C().lines(b.querySelector(".ogx-i2"), { h: 150, d: 1, ticks: y, labels: y, unit: "mb/d", endLabels: true, aria: "IEA oil demand by region", series: ["China", "Other Asia", "OECD Europe"].filter(n => iea.rows[n]).map(n => ({ name: n, color: ieaCols[n], width: 2, vals: iea.rows[n] })) });
    }
    if (names.length) {
      const yy = (opec.demand.years || []).map(String);
      C().lines(b.querySelector(".ogx-o1"), { h: 236, d: 1, zero: true, ticks: yy, labels: yy, unit: "mb/d", endLabels: true, aria: "OPEC oil demand outlook by region", series: names.map((n, i) => ({ name: n, color: opCols[i], width: 2.2, vals: opec.demand.rows[n] })) });
    }
    if (iea && iea.note) U().park(b, esc(iea.note));
    if (iea) U().park(b, esc(iea.source || "") + ", published " + esc(iea.published || "") + ". That path is a structural baseline, not a forecast through the present disruption.");
    const weo = oil.long_term_iea;
    if (weo) U().park(b, "WEO-2025: " + esc(weo.stated_policies || "") + " " + esc(weo.current_policies || "") + " " + esc(weo.note || ""));
  }

  /* ---------- 7 country and region ---------- */
  function shortName(name) { return String(name || "").replace(/^Total /, ""); }
  function atYear(ent, key, year) {
    if (!ent || !ent.years) return null;
    const i = ent.years.indexOf(year);
    const a = ent[key];
    if (i < 0 || !a || !f(a[i])) return null;
    return a[i];
  }
  function latestOf(ent, key) { return ent && ent.latest && ent.latest[key] ? ent.latest[key] : null; }
  function latestPills(stat) {
    if (!stat) return "";
    let s = "";
    if (f(stat.yoy_pct)) s += '<span class="ogx-k">1Y</span>' + pct(stat.yoy_pct);
    if (f(stat.vs_normal_pct)) s += '<span class="ogx-k">vs 2015–24</span>' + pct(stat.vs_normal_pct);
    return s;
  }
  function decadeX(years) { return (years || []).map(y => y % 10 === 0 ? String(y) : null); }
  function stat(label, value, s) {
    return '<div class="ogx-kpi"><span class="ogx-kl">' + label + '</span><span class="ogx-kv">' + value + '</span><span class="ogx-pills">' + latestPills(s) + "</span></div>";
  }
  function annual(root, file) {
    const meta = (file && file.meta) || {};
    const el = section(root, "ogYear", "Country and region", "Energy Institute Statistical Review 2026 · to " + esc(meta.data_to || ""));
    const b = body(el);
    if (!file || !file.entities) {
      b.innerHTML = '<p class="og-na">The annual energy file is not available yet.</p>';
      return;
    }
    const fuels = (file.dropdown && file.dropdown.fuels) || [];
    const regions = (file.dropdown && file.dropdown.regions) || [];
    const countries = (file.dropdown && file.dropdown.countries) || [];
    const compare = (file.dropdown && file.dropdown.default_comparison) || [];
    state.fuel = (file.dropdown && file.dropdown.default_fuel) || "oil";
    state.place = "__compare";
    const opt = names => names.filter(n => file.entities[n]).map(n => '<option value="' + esc(n) + '">' + esc(shortName(n)) + "</option>").join("");
    b.insertAdjacentHTML("beforeend", '<div class="og-controls ogx-ctl"><label><span class="ogx-k">Place</span> <select id="ogPlace" aria-label="Country or region"><option value="__compare">Compare five regions</option><optgroup label="Regions">' + opt(regions) + '</optgroup><optgroup label="Countries">' + opt(countries) + '</optgroup></select></label><div class="og-fuels" role="group" aria-label="Fuel">' + fuels.map(x => '<button type="button" data-fuel="' + esc(x.id) + '">' + esc(x.label) + "</button>").join("") + '</div></div><div id="ogAnnual"></div>');
    const sel = b.querySelector("#ogPlace");
    const fuelById = id => fuels.find(x => x.id === id) || fuels[0];
    const cols = ["var(--muted)", COL.a, COL.r, COL.b, "var(--text)"];
    const unitOf = key => ((meta.units || {})[key] || "");
    const paint = () => {
      const fuel = fuelById(state.fuel);
      b.querySelectorAll(".og-fuels button").forEach(x => x.classList.toggle("is-on", x.getAttribute("data-fuel") === fuel.id));
      const host = b.querySelector("#ogAnnual");
      host.innerHTML = "";
      if (state.place === "__compare") {
        const names = compare.filter(n => file.entities[n]);
        const yrs = (file.entities[names[0]] || {}).years || [];
        headline(el, fuel.label + " use per person, " + (yrs[0] || "") + "–" + (yrs[yrs.length - 1] || ""));
        host.insertAdjacentHTML("beforeend", '<h3>Per person <span class="ogx-h3n">' + esc(unitOf(fuel.per_capita)) + '</span></h3><div class="og-plot"></div>' +
          legend(names.map((n, i) => ({ label: shortName(n), color: cols[i % cols.length] }))) + '<div class="ogx-kpis ogx-k5">' +
          names.map(n => { const a = atYear(file.entities[n], fuel.per_capita, 2000), z = atYear(file.entities[n], fuel.per_capita, 2025); return stat(esc(shortName(n)) + ' <span class="ogx-k">2000 → 2025</span>', esc(U().fmt(a, 2) || "–") + " → " + esc(U().fmt(z, 2) || "–"), latestOf(file.entities[n], fuel.per_capita)); }).join("") + "</div>");
        chart(host.querySelector(".og-plot"), { h: 220, aria: "Per person, " + fuel.label, zero: true, x: decadeX(yrs), labels: yrs.map(String), d: 2, endLabels: true, series: names.map((n, i) => ({ name: shortName(n), color: cols[i % cols.length], width: n === "Total World" ? 2.4 : 1.8, vals: file.entities[n][fuel.per_capita] || [] })) });
        host.insertAdjacentHTML("beforeend", '<p class="ogx-note">' + esc(compareStory(file)) + "</p>");
        return;
      }
      const ent = file.entities[state.place];
      if (!ent) { host.innerHTML = '<p class="og-na">Not available for this place.</p>'; return; }
      const nm = shortName(state.place);
      const cons = latestOf(ent, fuel.consumption), prod = fuel.production ? latestOf(ent, fuel.production) : null;
      headline(el, nm + ": " + fuel.label.toLowerCase() + (fuel.id === "total_energy" ? " supply " : " consumption ") + (cons && f(cons.value) ? U().fmt(cons.value, cons.value >= 100 ? 0 : 1) + " " + ({ kbd: "kb/d", bcm: "bcm", ej: "EJ" }[String(fuel.consumption).split("_").pop()] || "") + " in " + cons.year + (f(cons.yoy_pct) ? ", " + U().signed(cons.yoy_pct, "%") + " on the year" : "") : "n/a"));
      const series = [];
      if (fuel.production && ent[fuel.production]) series.push({ name: "Production", color: COL.a, width: 2.2, vals: ent[fuel.production] });
      if (fuel.consumption && ent[fuel.consumption]) series.push({ name: fuel.id === "total_energy" ? "Supply" : "Consumption", color: "var(--muted)", width: 2, vals: ent[fuel.consumption] });
      let leg = [];
      if (fuel.production) leg.push({ label: "Production", color: COL.a });
      if (fuel.consumption) leg.push({ label: fuel.id === "total_energy" ? "Total energy supply" : "Consumption", color: "var(--muted)" });
      const pc = latestOf(ent, fuel.per_capita), pop = latestOf(ent, "population"), gdp = latestOf(ent, "gdp_per_capita_const2015_usd");
      let stats = "";
      if (prod && f(prod.value)) stats += stat("Production", esc(U().fmt(prod.value, prod.value >= 100 ? 0 : 1)) + ' <small>' + esc(unitOf(fuel.production)) + "</small>", prod);
      if (cons && f(cons.value)) stats += stat(fuel.id === "total_energy" ? "Supply" : "Consumption", esc(U().fmt(cons.value, cons.value >= 100 ? 0 : 1)) + ' <small>' + esc(unitOf(fuel.consumption)) + "</small>", cons);
      if (pc && f(pc.value)) stats += stat("Per person", esc(U().fmt(pc.value, 2)) + ' <small>' + esc(unitOf(fuel.per_capita)) + "</small>", pc);
      if (pop && f(pop.value)) stats += stat("Population", esc(U().fmt(pop.value / 1e6, 1)) + " <small>million</small>", pop);
      if (gdp && f(gdp.value)) stats += stat("GDP per person", "$" + esc(U().fmt(gdp.value, 0)) + " <small>2015 prices</small>", gdp);
      host.insertAdjacentHTML("beforeend", '<div class="ogx-two ogx-wide"><div><h3>' + esc(fuel.label) + ' <span class="ogx-h3n">' + esc(unitOf(fuel.consumption)) + '</span></h3><div class="og-plot ogx-a1"></div>' + legend(leg) +
        (!fuel.production && fuel.production_note ? '<p class="ogx-note">' + esc(fuel.production_note) + "</p>" : "") +
        '<h3>Per person <span class="ogx-h3n">' + esc(unitOf(fuel.per_capita)) + '</span></h3><div class="og-plot ogx-a2"></div></div><div class="ogx-kpis ogx-k1">' + stats + "</div></div>" +
        (!gdp && ent.kind === "region" ? '<p class="ogx-note">Regional GDP is not in this file, so it is not shown.</p>' : ""));
      if (series.length) chart(host.querySelector(".ogx-a1"), { h: 190, aria: nm + " " + fuel.label, zero: true, x: decadeX(ent.years), labels: (ent.years || []).map(String), d: 1, series: series });
      else host.querySelector(".ogx-a1").innerHTML = '<p class="og-na">n/a</p>';
      if (ent[fuel.per_capita]) chart(host.querySelector(".ogx-a2"), { h: 130, aria: "Per person", zero: true, x: decadeX(ent.years), labels: (ent.years || []).map(String), d: 2, series: [{ name: "Per person", color: COL.r, width: 2, vals: ent[fuel.per_capita], area: true }] });
    };
    b.querySelector(".og-fuels").addEventListener("click", e => {
      const x = e.target.closest("[data-fuel]");
      if (!x) return;
      state.fuel = x.getAttribute("data-fuel");
      paint();
    });
    sel.addEventListener("change", () => { state.place = sel.value; paint(); });
    paint();
    U().park(b, esc(meta.source || "") + ", published " + esc(meta.published || "") + ". " + esc(meta.note || ""));
  }
  function compareStory(file) {
    const E = file.entities;
    const pair = (name, key, d) => {
      const a = atYear(E[name], key, 2000), b = atYear(E[name], key, 2025);
      return U().fmt(a, d) + " → " + U().fmt(b, d);
    };
    const euOil = atYear(E["Total Europe"], "oil_cons_bbl_per_person", 2025);
    const cnOil = atYear(E.China, "oil_cons_bbl_per_person", 2025);
    const euTes = atYear(E["Total Europe"], "tes_gj_per_person", 2025);
    const cnTes = atYear(E.China, "tes_gj_per_person", 2025);
    const oilLine = cnOil != null && euOil != null && cnOil < euOil ? "China’s oil per person rose from " + pair("China", "oil_cons_bbl_per_person", 2) + ", and is still below Europe’s " + U().fmt(euOil, 2) + "." : "";
    const tesLine = cnTes != null && euTes != null && cnTes > euTes ? " China’s total energy per person is now " + U().fmt(cnTes, 1) + " GJ, above Europe’s " + U().fmt(euTes, 1) + "." : "";
    return "From 2000 to 2025, world oil per person was almost flat (" + pair("Total World", "oil_cons_bbl_per_person", 2) + " barrels a year; total energy " + pair("Total World", "tes_gj_per_person", 1) + " GJ). Europe fell (" + pair("Total Europe", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total Europe", "tes_gj_per_person", 1) + " GJ) and so did the EU (" + pair("Total EU", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total EU", "tes_gj_per_person", 1) + " GJ). Asia Pacific rose (" + pair("Total Asia Pacific", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total Asia Pacific", "tes_gj_per_person", 1) + " GJ). " + oilLine + tesLine + " India is still low (" + pair("India", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("India", "tes_gj_per_person", 1) + " GJ; oil per person " + (U().signed((latestOf(E.India, "oil_cons_bbl_per_person") || {}).yoy_pct, "%") || "n/a") + " in 2025). The US fell (" + pair("US", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("US", "tes_gj_per_person", 1) + " GJ) and Germany fell (" + pair("Germany", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Germany", "tes_gj_per_person", 1) + " GJ).";
  }

  async function optional(name) {
    try { return await U().getJSON(BASE + name + ".json?t=" + Math.floor(Date.now() / 36e5)); }
    catch (e) { return null; }
  }
  async function market() {
    for (const url of MKT) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const d = await r.json();
        const map = {};
        (d.groups || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(x => { if (x && x.sym && !map[x.sym]) map[x.sym] = x; })));
        return { map: map, at: d.generated_utc || d.generated_cet || "", groups: d.groups || [] };
      } catch (e) { /* try the next copy */ }
    }
    return { map: {}, at: "", groups: [] };
  }
  async function load() {
    const out = {};
    await Promise.all(FILES.map(async name => { out[name] = await U().getJSON(BASE + name + ".json?t=" + Math.floor(Date.now() / 36e5)); }));
    out.annual_energy = await optional("annual_energy");
    let quotes = {};
    try { quotes = await window.MMV2Tiles.loadQuotes(); } catch (e) { quotes = {}; }
    const m = await market();
    /* Commodity rows (with candles) straight from market.json; company quotes keep the tile loader's map. */
    Object.keys(m.map).forEach(k => { if (!quotes[k] || !quotes[k].ohlc) quotes[k] = m.map[k]; });
    out.quotes = quotes;
    out.mktAt = m.at;
    out.groups = m.groups;
    const side = async u => { try { const r = await fetch(u + "?t=" + Math.floor(Date.now() / 6e5)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const [lc, gas, br, ho] = await Promise.all([side("data/live_comment.json"), side("data/gas.json"), curveShape("brent"), curveShape("ho")]);
    out.live_comment = lc;
    out.gas = gas;
    out.shapes = { brent: br, ho: ho };
    return out;
  }
  function render(root, data) {
    root.innerHTML = "";
    root.classList.add("ogx");
    const man = data.manifest || {};
    const q = data.quotes || {};
    const head = document.createElement("div");
    head.className = "og-top ogx-top";
    const at = data.mktAt ? zurich(data.mktAt) : "";
    head.innerHTML = '<div><p class="ogx-kick">Energy</p><h1>Oil &amp; gas</h1><p class="ogx-lede">Crude, products and gas prices first, then the futures curves, the weekly US balance, the global balance, what it costs to produce, and the long view.</p></div>' +
      '<p class="og-asof ogx-upd">' + (at ? "Prices " + esc(at) + " Zurich · " : "") + "Data files " + esc(dShort(man.as_of || "")) + "</p>";
    root.appendChild(head);
    const book = fromEI(data.oil_gas_history_ei || {});
    absorbAnnual(data.annual_energy, book);
    state.book = book;
    hero(root, data, q, data.shapes);
    prices(root, data.spot_daily, q);
    curves(root, data.shapes);
    if (data.us_weekly) weekly(root, data.us_weekly);
    if (data.oil_balance_steo) balance(root, data.oil_balance_steo, data.outlooks);
    if (data.cost_curves) costs(root, data.cost_curves, q);
    if (data.outlooks) medium(root, data.outlooks);
    annual(root, data.annual_energy);
    const feed = document.createElement("div");
    feed.id = "ogFeed";
    root.appendChild(feed);
    const tape = document.createElement("div");
    tape.id = "ogTable";
    root.appendChild(tape);
    document.dispatchEvent(new CustomEvent("mm:place", { detail: "oil" }));
    const foot = document.createElement("p");
    foot.className = "og-foot";
    foot.innerHTML = 'Sources: live futures from the EMMI market file (15-minute refresh on weekdays), ICE/NYMEX curve settlements, EIA spot, STEO and weekly statistics, Energy Institute Statistical Review 2026, IEA Oil 2025 and the October 2026 Oil Market Report highlights, OPEC World Oil Outlook 2026, Dallas Fed Q1 2026. <a href="https://github.com/MasterKano/emmi-data/tree/main/og-mining-v2">emmi-data og-mining-v2</a>. A blank is n/a.';
    root.appendChild(foot);
  }
  async function start() {
    const root = document.querySelector("#oilgasView .og-root");
    if (!root || !U()) return;
    try {
      const data = await load();
      state.data = data;
      render(root, data);
    } catch (e) {
      root.innerHTML = '<p class="og-na">' + U().esc(e && e.message ? e.message : "Oil and gas data are not available yet.") + "</p>";
    }
  }
  window.MMV2Oil = { start: start };
  if (document.querySelector("#oilgasView .og-root")) start();
})();
