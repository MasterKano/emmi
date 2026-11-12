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
  /* Axis ticks: whole steps of 1, 2, 2.5 or 5 x 10^n. The top tick is the first step at or above the highest value,
     so there is never a spare grid line above the data. */
  function ticks(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1); }
    const raw = (hi - lo) / (n || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw * 0.999) || raw;
    const t0 = Math.floor(lo / step + 1e-9) * step, t1 = Math.ceil(hi / step - 1e-9) * step;
    const out = [];
    for (let v = t0; v <= t1 + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
    return { lo: t0, hi: t1, list: out, step: step };
  }
  function tickText(v, step) {
    const d = step >= 1 || Math.abs(step - Math.round(step)) < 1e-9 ? 0 : step >= 0.1 ? 1 : 2;
    const a = Math.abs(v);
    if (a >= 10000 && d === 0) return U().fmt(v / 1000, a % 1000 ? 1 : 0) + "k";
    return U().fmt(v, d);
  }
  /* One chart for the page: lines, optional bars (diverging from zero), forecast shade, x labels and reference lines.
     opts: { h, series:[{vals,color,width,dash,dots}], bars:{vals}, x:[label|null per point], shadeFrom, zero, refs:[{y,label,color}], aria } */
  function chart(el, o) {
    U().watch(el, w => {
      const series = (o.series || []).filter(s => s && s.vals && s.vals.some(f));
      const barV = o.bars && o.bars.vals;
      const n = Math.max(series.reduce((m, s) => Math.max(m, s.vals.length), 0), barV ? barV.length : 0);
      if (!n) { el.innerHTML = '<p class="og-na">Not available</p>'; return; }
      const vals = [];
      series.forEach(s => s.vals.forEach(v => { if (f(v)) vals.push(v); }));
      if (barV) barV.forEach(v => { if (f(v)) vals.push(v); });
      (o.refs || []).forEach(r => { if (f(r.y)) vals.push(r.y); });
      if (o.zero || barV) vals.push(0);
      const tk = ticks(Math.min(...vals), Math.max(...vals), o.nt || 4);
      const h = o.h || 150, fs = 11;
      const L = Math.max(26, Math.max(...tk.list.map(v => tickText(v, tk.step).length)) * 6.6 + 8), R = o.refs && o.refs.length ? 6 : 6, T = 8, B = o.x ? 20 : 6;
      const iw = w - L - R, ih = h - T - B;
      const X = i => L + (n > 1 ? (barV ? (i + 0.5) / n : i / (n - 1)) : 0.5) * iw;
      const Y = v => T + ih - (v - tk.lo) / (tk.hi - tk.lo) * ih;
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "chart") + '">';
      if (o.shadeFrom != null && o.shadeFrom >= 0) {
        const x0 = X(o.shadeFrom) - (barV ? iw / n / 2 : 0);
        s += '<rect x="' + x0.toFixed(1) + '" y="' + T + '" width="' + Math.max(0, L + iw - x0).toFixed(1) + '" height="' + ih + '" class="ogx-fc"/>';
        s += '<text x="' + (x0 + 4).toFixed(1) + '" y="' + (T + 11) + '" class="ogx-fct" font-size="10">Forecast</text>';
      }
      tk.list.forEach(v => {
        const y = Y(v);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="' + (v === 0 && tk.lo < 0 ? "ogx-g0" : "ogx-g") + '"/>';
        s += '<text x="' + (L - 5) + '" y="' + (y + 3.5).toFixed(1) + '" class="ogx-t" font-size="' + fs + '" text-anchor="end">' + esc(tickText(v, tk.step)) + "</text>";
      });
      if (o.x) {
        let last = -1e9;
        o.x.forEach((lab, i) => {
          if (!lab) return;
          const x = X(i);
          if (x - last < lab.length * 6.4 + 10) return;
          const end = x + lab.length * 3.4 > w;
          if (end && x - lab.length * 6.6 - 6 < last) return;
          s += '<text x="' + (end ? w - 1 : x).toFixed(1) + '" y="' + (h - 5) + '" class="ogx-t" font-size="' + fs + '" text-anchor="' + (end ? "end" : i === 0 && !barV ? "start" : "middle") + '">' + esc(lab) + "</text>";
          last = x;
        });
      }
      if (barV) {
        const bw = Math.max(1, iw / n - (n > 40 ? 1 : 2)), y0 = Y(0);
        barV.forEach((v, i) => {
          if (!f(v)) return;
          const y = Y(v), x = X(i) - bw / 2;
          s += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y, y0).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y0 - y)).toFixed(1) + '" class="' + (v >= 0 ? "ogx-bu" : "ogx-bd") + '"' + (o.bars.fade && o.bars.fade(i) ? ' opacity=".55"' : "") + "><title>" + esc((o.bars.title ? o.bars.title(i) : "") + " " + U().signed(v, "", 2)) + "</title></rect>";
        });
      }
      series.forEach(ser => {
        let d = "", pen = false;
        ser.vals.forEach((v, i) => {
          if (!f(v)) { pen = false; return; }
          d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1);
          pen = true;
        });
        if (d) s += '<path d="' + d + '" fill="none" stroke="' + ser.color + '" stroke-width="' + (ser.width || 1.8) + '" stroke-linejoin="round" stroke-linecap="round"' + (ser.dash ? ' stroke-dasharray="' + ser.dash + '"' : "") + "/>";
        if (ser.end) {
          let i = ser.vals.length - 1;
          while (i >= 0 && !f(ser.vals[i])) i--;
          if (i >= 0) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(ser.vals[i]).toFixed(1) + '" r="3" fill="' + ser.color + '"/>';
        }
      });
      (o.refs || []).forEach(r => {
        if (!f(r.y)) return;
        const y = Y(r.y);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + r.color + '" stroke-dasharray="4 3"/>';
        if (r.label) s += '<text x="' + (L + iw - 2) + '" y="' + (y - 4).toFixed(1) + '" fill="' + r.color + '" font-size="' + fs + '" text-anchor="end" class="ogx-halo">' + esc(r.label) + "</text>";
      });
      s += "</svg>";
      el.innerHTML = s;
    });
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
  function sparkLine(vals, cls) {
    const p = (vals || []).filter(f);
    if (p.length < 2) return "";
    const w = 132, h = 44, pad = 3;
    const lo = Math.min(...p), hi = Math.max(...p) > lo ? Math.max(...p) : lo + 1;
    let d = "", i = 0;
    vals.forEach((v, k) => { if (!f(v)) return; d += (i++ ? "L" : "M") + (k / (vals.length - 1) * w).toFixed(1) + "," + (pad + (1 - (v - lo) / (hi - lo)) * (h - 2 * pad)).toFixed(1); });
    return '<svg class="' + (cls || "ogx-spark") + '" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" aria-label="Daily closes"><path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* ---------- 1 prices ---------- */
  const TAPE = [
    { sym: "BZ=F", name: "Brent", unit: "$/bbl", pre: "$", d: 2 },
    { sym: "CL=F", name: "WTI", unit: "$/bbl", pre: "$", d: 2 },
    { sym: "HO=F", name: "NY Harbor ULSD", unit: "$/gal", pre: "$", d: 3 },
    { sym: "NG=F", name: "Henry Hub gas", unit: "$/mmBtu", pre: "$", d: 3 },
    { sym: "TTF=F", name: "Dutch TTF gas", unit: "€/MWh", pre: "€", d: 2 }
  ];
  function tapeTile(q, t, sc) {
    if (!q || !f(q.px)) {
      return '<div class="ogx-tile is-na"><div class="ogx-tn">' + esc(t.name) + '</div><div class="ogx-px">n/a</div><p class="ogx-qm">Not in the market file right now.</p></div>';
    }
    const p = q.pct || {};
    const c = window.MMCandles ? MMCandles.svg(q, sc, { h: 44, cls: "ogx-spark" }) : "";
    const bars = window.MMCandles ? MMCandles.bars(q, sc) : null;
    let rng = "";
    if (bars) {
      let lo = Infinity, hi = -Infinity;
      bars.forEach(b => b.forEach(v => { if (f(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
      if (hi > lo) {
        const at = Math.max(0, Math.min(100, (q.px - lo) / (hi - lo) * 100));
        rng = '<div class="ogx-rng" title="Low to high of the candles shown"><span>' + esc(U().fmt(lo, t.d)) + '</span><b><i style="left:' + at.toFixed(1) + '%"></i></b><span>' + esc(U().fmt(hi, t.d)) + "</span></div>";
      }
    }
    const when = q.bar_date && q.bar_date !== new Date().toISOString().slice(0, 10) ? "close " + dShort(q.bar_date) : (zurich(q.market_time) ? zurich(q.market_time) + " Zurich" : dShort(q.bar_date));
    return '<div class="ogx-tile"><div class="ogx-tt"><span class="ogx-tn">' + esc(t.name) + '</span><span class="ogx-ct">' + esc(contractOf(q)) + "</span></div>" +
      '<div class="ogx-px"><small>' + esc(t.pre) + "</small>" + esc(U().fmt(q.px, t.d)) + '<small class="u">' + esc(t.unit.replace(/^[$€]/, "")) + "</small></div>" +
      '<div class="ogx-pills"><span class="ogx-k">1D</span>' + pct(p["1D"]) + '<span class="ogx-k">1W</span>' + pct(p["1W"]) + '<span class="ogx-k">1M</span>' + pct(p["1M"]) + "</div>" +
      (c || sparkLine(q.spark ? q.spark.slice(-22) : null)) + rng +
      '<p class="ogx-qm">' + esc(when) + (q.state === "open" ? ' · <span class="ogx-live">trading</span>' : "") + "</p></div>";
  }
  function spreadTile(name, sub, unit, a, b, calc, d) {
    if (!a || !b || !f(a.px) || !f(b.px)) return "";
    const now = calc(a.px, b.px);
    const prev = f(a.prev_close) && f(b.prev_close) ? calc(a.prev_close, b.prev_close) : null;
    const ca = closes(a), cb = closes(b);
    let line = null;
    if (ca && cb && ca.length === cb.length && a.ohlc.d0 === b.ohlc.d0) line = ca.map((v, i) => f(v) && f(cb[i]) ? calc(v, cb[i]) : null);
    return '<div class="ogx-tile ogx-der"><div class="ogx-tt"><span class="ogx-tn">' + esc(name) + '</span><span class="ogx-ct">computed</span></div>' +
      '<div class="ogx-px"><small>$</small>' + esc(U().fmt(now, d)) + '<small class="u">' + esc(unit) + "</small></div>" +
      '<div class="ogx-pills"><span class="ogx-k">1D</span>' + chg(f(prev) ? now - prev : null, d, "$") + "</div>" +
      (line ? sparkLine(line) : "") + '<p class="ogx-qm">' + esc(sub) + "</p></div>";
  }
  /* Brent against its own moving averages: context, not a signal. */
  function trendTile(q) {
    const ma = q && q.ma;
    if (!ma || !f(q.px)) return "";
    const rows = ["20", "50", "200"].filter(k => ma[k] && f(ma[k].v));
    if (!rows.length) return "";
    const above = rows.filter(k => q.px >= ma[k].v).length;
    return '<div class="ogx-tile ogx-der"><div class="ogx-tt"><span class="ogx-tn">Brent trend</span><span class="ogx-ct">moving averages</span></div>' +
      '<p class="ogx-trs">' + (above === rows.length ? "Above all three averages" : above === 0 ? "Below all three averages" : "Above " + above + " of " + rows.length + " averages") + "</p>" +
      '<table class="ogx-ma"><tbody>' + rows.map(k => "<tr><th>" + k + "-day</th><td>$" + esc(U().fmt(ma[k].v, 2)) + "</td><td>" + pct(f(ma[k].pct) ? ma[k].pct : (q.px / ma[k].v - 1) * 100) + "</td></tr>").join("") + "</tbody></table>" +
      '<p class="ogx-qm">Price against each average, ' + esc(contractOf(q)) + " contract.</p></div>";
  }
  function prices(root, spot, quotes, mktTime) {
    const el = section(root, "ogPx", "Prices", "");
    const b = body(el);
    const sc = window.MMCandles ? MMCandles.scale() : "d";
    const bz = quotes["BZ=F"], cl = quotes["CL=F"], ho = quotes["HO=F"], hh = quotes["NG=F"], ttf = quotes["TTF=F"];
    /* Headline: what Brent did, in words, from the numbers. */
    if (bz && f(bz.px)) {
      const d1 = (bz.pct || {})["1D"], w1 = (bz.pct || {})["1W"];
      const verb = !f(d1) ? "is" : d1 >= 0.3 ? "up " + U().fmt(d1, 1) + "% today at" : d1 <= -0.3 ? "down " + U().fmt(Math.abs(d1), 1) + "% today at" : "little changed today at";
      const wk = f(w1) ? (Math.sign(w1) !== Math.sign(d1 || 0) && Math.abs(w1) >= 0.5 ? ", still " : ", ") + (w1 >= 0 ? "up " : "down ") + U().fmt(Math.abs(w1), 1) + "% on the week" : "";
      const others = [["WTI", cl], ["ULSD", ho], ["Henry Hub", hh], ["TTF", ttf]].filter(x => x[1] && f((x[1].pct || {})["1D"]))
        .map(x => "<b>" + x[0] + "</b> " + U().signed(x[1].pct["1D"], "%"));
      headline(el, "Brent " + verb + " $" + U().fmt(bz.px, 2) + wk, others.length ? "Today: " + others.join(" · ") : "");
    } else headline(el, "Live crude prices are not in the market file right now");
    el.querySelector(".ogx-bh-r").innerHTML = '<div class="ogx-cdl"><span class="ogx-k">Candles</span>' + (window.MMCandles ? MMCandles.toggle(sc) : "") + "</div>";
    const grid = document.createElement("div");
    grid.className = "ogx-tiles";
    b.appendChild(grid);
    const draw = s => {
      grid.innerHTML = TAPE.map(t => tapeTile(quotes[t.sym], t, s)).join("") +
        spreadTile("Brent – WTI", "Brent " + contractOf(bz) + " less WTI " + contractOf(cl), "/bbl", bz, cl, (x, y) => x - y, 2) +
        spreadTile("Diesel crack", "ULSD " + contractOf(ho) + " × 42 less Brent " + contractOf(bz), "/bbl", ho, bz, (x, y) => x * 42 - y, 2) +
        trendTile(bz);
      el.querySelectorAll("[data-cdl]").forEach(x => x.setAttribute("aria-pressed", String(x.getAttribute("data-cdl") === s)));
    };
    draw(sc);
    if (window.MMCandles) MMCandles.wire(el, draw);
    /* EIA physical spot: the official daily print, about a week behind the futures. */
    const rows = [["brent_spot", "Brent FOB", "$/bbl"], ["wti_spot", "WTI Cushing", "$/bbl"], ["henry_hub_spot", "Henry Hub", "$/mmBtu"]].filter(r => spot && spot[r[0]]);
    if (rows.length) {
      const asof = spot[rows[0][0]].as_of;
      let t = '<div class="ogx-sub"><h3>EIA physical spot <span class="ogx-h3n">as of ' + esc(dShort(asof)) + " · EIA publishes about a week late</span>" + stale(ageDays(asof), 10, "EIA spot file") + '</h3><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Market</th><th>Last</th><th>30-day avg</th><th>vs 30d</th><th>Month so far vs last month</th><th>vs 5-yr avg</th></tr></thead><tbody>';
      rows.forEach(([k, name, unit]) => {
        const s = spot[k];
        const vs30 = f(s.latest) && f(s.ma30) && s.ma30 ? (s.latest / s.ma30 - 1) * 100 : null;
        t += "<tr><th>" + esc(name) + ' <span class="ogx-u">' + esc(unit) + "</span></th><td>" + esc(U().fmt(s.latest, 2) || "n/a") + "</td><td>" + esc(U().fmt(s.ma30, 2) || "n/a") + "</td><td>" + pct(vs30) + "</td><td>" + pct(s.mtd_vs_prev_pct) + "</td><td>" + pct(s.vs_5y_pct) + "</td></tr>";
      });
      t += "</tbody></table></div></div>";
      b.insertAdjacentHTML("beforeend", t);
    }
    U().park(b, "Tiles are the front futures contracts from the live market file (contract month shown), refreshed every 15 minutes on weekdays. Candles: green closed at or above the open, red below; the bar under each is the low-to-high of the candles shown. Brent – WTI and the diesel crack are computed here from those two quotes; the contract months can differ, as labelled. NBP gas and gasoil are not in the market file, so they are not shown.");
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
  function curves(root) {
    const el = section(root, "ogCurveSec", "Futures curves", "");
    const host = document.createElement("div");
    host.id = "ogCurves";
    body(el).appendChild(host);
    headline(el, "Brent and diesel forward curves");
    Promise.all([curveShape("brent"), curveShape("ho")]).then(([br, ho]) => {
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

  /* ---------- 3 US weekly ---------- */
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
    const colors = ["#e8a33d", "#d9b44a", "#f07f3c", "#4fb3e0", "#5fb98a", "#a993f0"];
    keys.forEach((key, i) => {
      const s = data[key];
      if (!s) return;
      const card = document.createElement("div");
      card.className = "ogx-wk";
      const big = s.latest >= 100 ? 0 : 1;
      const wd = Math.abs(s.wow) >= 10 ? 0 : 1;
      let rng = "";
      if (s.range_5y && s.range_5y.length === 2 && f(s.range_5y[0]) && f(s.range_5y[1])) {
        const lo = Math.min(s.range_5y[0], s.range_5y[1], s.latest), hi = Math.max(s.range_5y[0], s.range_5y[1], s.latest);
        const P = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(1);
        rng = '<div class="ogx-r5"><span class="ogx-k">5-yr range this week</span><b><em style="left:' + P(Math.min(s.range_5y[0], s.range_5y[1])) + "%;right:" + (100 - P(Math.max(s.range_5y[0], s.range_5y[1]))) + '%"></em>' + (f(s.normal_5y) ? '<u style="left:' + P(s.normal_5y) + '%"></u>' : "") + '<i style="left:' + P(s.latest) + "%;--c:" + colors[i] + '"></i></b><span>' + esc(U().fmt(s.range_5y[0], big)) + "</span><span>" + esc(U().fmt(s.range_5y[1], big)) + "</span></div>";
      }
      card.innerHTML = '<div class="ogx-wh"><span class="ogx-tn">' + esc(String(s.label || key).replace(/^US /, "").replace(/^./, c => c.toUpperCase())) + '</span></div><div class="ogx-px">' + esc(U().fmt(s.latest, big) || "n/a") + '<small class="u">' + esc(s.unit || "") + "</small></div>" +
        '<div class="ogx-pills"><span class="ogx-k">Week</span>' + chg(s.wow, wd) + '<span class="ogx-k">Year</span>' + chg(s.yoy, s.latest >= 1000 ? 0 : 1) + '<span class="ogx-k">vs 5-yr</span>' + pct(s.vs_normal_pct) + "</div>" +
        '<div class="og-plot"></div>' + rng;
      grid.appendChild(card);
      const ser = s.series_1y || [];
      chart(card.querySelector(".og-plot"), {
        h: 112, aria: s.label + ", last 12 months against the 5-year average", nt: 3,
        x: ser.map((p, k) => { const m = String(p[0]).slice(5, 7); const prev = k ? String(ser[k - 1][0]).slice(5, 7) : ""; return m !== prev && k ? MON[+m - 1] : null; }),
        series: [
          { color: "var(--faint)", width: 1.2, dash: "3 3", vals: ser.map(p => p[2]) },
          { color: colors[i], width: 2, vals: ser.map(p => p[1]), end: true }
        ]
      });
    });
    b.insertAdjacentHTML("beforeend", legend([{ label: "Last 12 months", color: "var(--text)" }, { label: "5-year average, same week", color: "var(--faint)", dash: true }]));
    U().park(b, "Source: " + esc(((data.meta || {}).source) || "EIA Weekly Petroleum Status Report and Natural Gas Storage Report") + ". The range bar is the 5-year low to high for the latest week only; the white tick is the 5-year average and the dot is this week.");
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
    const P = cut(prod), C = cut(cons), Bl = cut(bal);
    const shade = P.findIndex(p => p[2] === true);
    const xl = P.map(p => String(p[0]).slice(5) === "01" ? String(p[0]).slice(0, 4) : null);
    const y26 = [yearAvg(prod, 2026), yearAvg(cons, 2026)], y27 = [yearAvg(prod, 2027), yearAvg(cons, 2027)];
    if (f(y27[0]) && f(y27[1])) {
      const s = y27[0] - y27[1];
      headline(el, "EIA sees a " + U().fmt(Math.abs(s), 1) + " mb/d " + (s >= 0 ? "surplus" : "deficit") + " in 2027, with Brent averaging $" + U().fmt(yearAvg(steo.brent_usd, 2027), 0));
    }
    b.insertAdjacentHTML("beforeend", '<div class="ogx-two"><div><h3>Supply and demand <span class="ogx-h3n">mb/d</span></h3><div class="og-plot ogx-p1"></div>' +
      legend([{ label: "Production", color: "#e8a33d" }, { label: "Consumption", color: "var(--muted)" }]) + '</div><div><h3>Implied stock change <span class="ogx-h3n">mb/d, + is surplus</span></h3><div class="og-plot ogx-p2"></div>' +
      legend([{ label: "Surplus (stocks build)", color: "var(--good)", box: true }, { label: "Deficit (stocks draw)", color: "var(--bad)", box: true }]) + "</div></div>");
    chart(b.querySelector(".ogx-p1"), { h: 170, aria: "World oil production and consumption, monthly, mb/d", shadeFrom: shade, x: xl,
      series: [{ color: "var(--muted)", width: 1.7, vals: C.map(p => p[1]) }, { color: "#e8a33d", width: 2, vals: P.map(p => p[1]) }] });
    chart(b.querySelector(".ogx-p2"), { h: 170, aria: "Implied global stock change, monthly, mb/d", shadeFrom: shade, x: xl, bars: { vals: Bl.map(p => p[1]), title: i => mShort(Bl[i][0]) } });
    const years = [2025, 2026, 2027];
    const cell = (series, y, d) => esc(U().fmt(yearAvg(series, y), d) || "–");
    let t = '<div class="ogx-scroll"><table class="ogx-tbl ogx-yr"><thead><tr><th>Annual average</th>' + years.map(y => "<th>" + y + (y > +String(meta.last_historical_month || "").slice(0, 4) ? "f" : "") + "</th>").join("") + "</tr></thead><tbody>";
    t += "<tr><th>Production, mb/d</th>" + years.map(y => "<td>" + cell(prod, y, 1) + "</td>").join("") + "</tr>";
    t += "<tr><th>Consumption, mb/d</th>" + years.map(y => "<td>" + cell(cons, y, 1) + "</td>").join("") + "</tr>";
    t += "<tr><th>Balance, mb/d</th>" + years.map(y => { const v = f(yearAvg(prod, y)) && f(yearAvg(cons, y)) ? yearAvg(prod, y) - yearAvg(cons, y) : null; return '<td class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + esc(U().signed(v, "", 1) || "–") + "</td>"; }).join("") + "</tr>";
    t += "<tr><th>Brent, $/bbl</th>" + years.map(y => "<td>" + cell(steo.brent_usd, y, 1) + "</td>").join("") + "</tr></tbody></table></div>";
    b.insertAdjacentHTML("beforeend", t);
    const stock = (steo.implied_balance || []).filter(p => p[2] !== true).pop();
    if (stock) b.insertAdjacentHTML("beforeend", '<p class="ogx-note">Last history month (' + esc(mShort(stock[0])) + ") implied balance " + esc(U().signed(stock[1], "", 1)) + " mb/d. f = forecast.</p>");
    const iea = outlook && outlook.oil && outlook.oil.short_term && outlook.oil.short_term.iea_omr_oct2026_highlights;
    if (iea) {
      b.insertAdjacentHTML("beforeend", '<div class="ogx-call"><p class="ogx-kick">Second opinion · IEA Oil Market Report, ' + esc(dShort(iea.published)) + "</p><p>Demand change " + esc(String(iea.demand_2026_change_mbd)) + " mb/d in 2026; 2027 versus 2025 " + esc(String(iea.demand_2027_vs_2025_kbd)) + " kb/d. Supply 2026 " + esc(String(iea.supply_2026_mbd)) + " mb/d (" + esc(String(iea.supply_2026_change_mbd)) + "), 2027 change " + esc(String(iea.supply_2027_change_mbd)) + " mb/d. " + esc(iea.context || "") + "</p></div>");
    }
    U().park(b, esc(meta.source || "") + (meta.released ? ", released " + esc(meta.released) : "") + ". " + esc(meta.note || "") + " Implied stock change is world production less consumption.");
  }

  /* ---------- 5 costs ---------- */
  function costs(root, cc, quotes) {
    const el = section(root, "ogCost", "Cost curve", "Unit opex or lifting cost as reported · not full-cycle");
    const b = body(el);
    const steps = (cc.og_unit_cost_curve || []).filter(s => f(s.unit_cost_usd_boe)).slice().sort((a, z) => a.unit_cost_usd_boe - z.unit_cost_usd_boe);
    const venue = y => /\.OL$/.test(y || "") ? "Norway" : /\.ST$/.test(y || "") ? "Sweden" : "London";
    const vc = { London: "#e8a33d", Norway: "#6f9bff", Sweden: "#5fb98a" };
    const brent = quotes["BZ=F"] && f(quotes["BZ=F"].px) ? quotes["BZ=F"].px : null;
    const perm = ((cc.dallasfed_q1_2026 || {}).rows || []).find(r => /Permian \(all/.test(r.play || ""));
    if (steps.length) {
      const lo = steps[0], hi = steps[steps.length - 1];
      headline(el, steps.length + " producers report unit costs of $" + U().fmt(lo.unit_cost_usd_boe, 0) + " to $" + U().fmt(hi.unit_cost_usd_boe, 0) + "/boe" + (brent && brent > hi.unit_cost_usd_boe ? ", all well below Brent at $" + U().fmt(brent, 0) : ""));
    }
    const refs = [];
    if (brent) refs.push({ y: brent, color: "var(--text)", label: "Brent $" + U().fmt(brent, 0) });
    if (perm && f(perm.breakeven_new_well)) refs.push({ y: perm.breakeven_new_well, color: "var(--bad)", label: "Permian new well $" + U().fmt(perm.breakeven_new_well, 0) });
    if (perm && f(perm.opex_existing_wells)) refs.push({ y: perm.opex_existing_wells, color: "var(--good)", label: "Permian existing $" + U().fmt(perm.opex_existing_wells, 0) });
    const plot = document.createElement("div");
    plot.className = "og-plot ogx-hb";
    b.appendChild(plot);
    U().watch(plot, w => {
      const narrow = w < 520;
      const L = narrow ? 104 : 170, R = 40, rowH = 21;
      /* reference labels: greedy rows so no two labels overlap */
      const max0 = Math.max(...steps.map(s => s.unit_cost_usd_boe).concat(refs.map(r => r.y)));
      const tk0 = ticks(0, max0, narrow ? 3 : 5);
      const X0 = v => L + v / tk0.hi * (w - L - R);
      const lab = refs.slice().sort((a, z) => a.y - z.y).map(r => {
        const text = narrow ? r.label.replace("Permian ", "") : r.label;
        const tw = text.length * 6.4, x = X0(r.y);
        const anchor = x + tw / 2 > w - 2 ? "end" : x - tw / 2 < 2 ? "start" : "middle";
        const x1 = anchor === "end" ? x - tw : anchor === "start" ? x : x - tw / 2;
        return { r: r, text: text, x: x, anchor: anchor, a: x1, b: x1 + tw };
      });
      const rowsEnd = [];
      lab.forEach(l => { let k = 0; while (rowsEnd[k] != null && rowsEnd[k] + 6 > l.a) k++; rowsEnd[k] = l.b; l.row = k; });
      const T = 12 + Math.max(1, rowsEnd.length) * 13, h = T + steps.length * rowH + 22;
      const max = Math.max(...steps.map(s => s.unit_cost_usd_boe).concat(refs.map(r => r.y)));
      const tk = ticks(0, max, narrow ? 3 : 5);
      const iw = w - L - R;
      const X = v => L + v / tk.hi * iw;
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Unit cost by company, $/boe, cheapest first">';
      tk.list.forEach(v => { s += '<line x1="' + X(v).toFixed(1) + '" x2="' + X(v).toFixed(1) + '" y1="' + (T - 4) + '" y2="' + (h - 20) + '" class="ogx-g"/><text x="' + X(v).toFixed(1) + '" y="' + (h - 6) + '" class="ogx-t" font-size="11" text-anchor="middle">' + esc(tickText(v, tk.step)) + "</text>"; });
      steps.forEach((st, i) => {
        const y = T + i * rowH, bw = Math.max(2, X(st.unit_cost_usd_boe) - L);
        const short = /\(([^)]+)\)/.test(st.company) ? st.company.match(/\(([^)]+)\)/)[1] : st.company.replace(/ Energy$| Petroleum$/, "");
        s += '<text x="' + (L - 8) + '" y="' + (y + 14) + '" class="ogx-tl" font-size="12" text-anchor="end">' + esc(narrow ? short : st.company) + "</text>";
        s += '<rect x="' + L + '" y="' + (y + 4) + '" width="' + bw.toFixed(1) + '" height="' + (rowH - 8) + '" rx="2" fill="' + vc[venue(st.yahoo)] + '"><title>' + esc(st.company + ": $" + U().fmt(st.unit_cost_usd_boe, 1) + "/boe, " + U().fmt(st.production_kboed, 1) + " kboe/d, " + st.period) + "</title></rect>";
        s += '<text x="' + (L + bw + 5).toFixed(1) + '" y="' + (y + 14) + '" class="ogx-tv" font-size="11.5">' + esc(U().fmt(st.unit_cost_usd_boe, 1)) + "</text>";
      });
      /* reference lines with labels stacked in the header band so they never cover bars */
      lab.forEach(l => {
        s += '<line x1="' + l.x.toFixed(1) + '" x2="' + l.x.toFixed(1) + '" y1="' + (12 + l.row * 13 + 3) + '" y2="' + (h - 20) + '" stroke="' + l.r.color + '" stroke-dasharray="4 3" stroke-width="1.3"/>';
        s += '<text x="' + (l.anchor === "end" ? l.x + 3 : l.anchor === "start" ? l.x - 3 : l.x).toFixed(1) + '" y="' + (10 + l.row * 13) + '" fill="' + l.r.color + '" font-size="11" font-weight="650" text-anchor="' + l.anchor + '" class="ogx-halo">' + esc(l.text) + "</text>";
      });
      s += "</svg>";
      plot.innerHTML = s;
    });
    b.insertAdjacentHTML("beforeend", legend([{ label: "London-listed", color: vc.London, box: true }, { label: "Oslo-listed", color: vc.Norway, box: true }, { label: "Stockholm-listed", color: vc.Sweden, box: true }]));
    let t = '<details class="ogx-more"><summary>Volumes and reporting periods (' + steps.length + ')</summary><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Company</th><th>$/boe</th><th>kboe/d</th><th>Period</th></tr></thead><tbody>' +
      steps.map(s => "<tr><th>" + esc(s.company) + "</th><td>" + esc(U().fmt(s.unit_cost_usd_boe, 1)) + "</td><td>" + esc(U().fmt(s.production_kboed, 1) || "n/a") + "</td><td>" + esc(s.period) + "</td></tr>").join("") + "</tbody></table></div></details>";
    b.insertAdjacentHTML("beforeend", t);
    const df = (cc.dallasfed_q1_2026 || {}).rows || [];
    if (df.length) {
      b.insertAdjacentHTML("beforeend", '<details class="ogx-more"><summary>US shale break-evens, Dallas Fed Energy Survey Q1 2026 ($/bbl WTI)</summary><div class="ogx-scroll"><table class="ogx-tbl"><thead><tr><th>Group</th><th>New well</th><th>Existing wells, opex</th></tr></thead><tbody>' +
        df.map(r => "<tr><th>" + esc(r.play) + "</th><td>" + esc(U().fmt(r.breakeven_new_well, 0) || "n/a") + "</td><td>" + esc(U().fmt(r.opex_existing_wells, 0) || "n/a") + "</td></tr>").join("") + "</tbody></table></div></details>");
    }
    U().park(b, "Unit opex or lifting cost as each company reports it, in $/boe; bases differ and none is full-cycle. Brent is the live front-month quote; the Permian lines are the Dallas Fed Q1 2026 survey averages.");
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
    const ieaCols = { "Total demand": "var(--text)", "OECD Europe": "var(--muted)", "China": "#f06a7d", "Other Asia": "#e8a33d" };
    if (iea && iea.rows && iea.rows["Total demand"]) {
      const d = iea.rows["Total demand"], y = iea.years || [];
      headline(el, "Oil demand still grows to 2030 in the IEA baseline: " + U().fmt(d[0], 1) + " to " + U().fmt(d[d.length - 1], 1) + " mb/d");
      grid += '<div><h3>IEA world demand <span class="ogx-h3n">mb/d, ' + esc(y[0] + "–" + y[y.length - 1]) + ' · pre-war baseline</span></h3><div class="og-plot ogx-i1"></div><h3>IEA by region <span class="ogx-h3n">mb/d</span></h3><div class="og-plot ogx-i2"></div>' +
        legend(["OECD Europe", "China", "Other Asia"].filter(n => iea.rows[n]).map(n => ({ label: n, color: ieaCols[n] }))) + "</div>";
    }
    const names = opec && opec.demand && opec.demand.rows ? ["China", "India", "OECD Europe"].filter(n => opec.demand.rows[n]) : [];
    const opCols = ["#f06a7d", "#e8a33d", "var(--muted)"];
    if (names.length) {
      const yy = opec.demand.years || [];
      grid += '<div><h3>OPEC demand outlook <span class="ogx-h3n">mb/d, ' + esc(yy[0] + "–" + yy[yy.length - 1]) + '</span></h3><div class="og-plot ogx-o1"></div>' + legend(names.map((n, i) => ({ label: n, color: opCols[i] })));
      const gas = outlook.gas && outlook.gas.long_term_opec;
      if (gas && gas.rows) {
        const gn = ["OECD Europe", "China", "India"].filter(n => gas.rows[n]);
        if (gn.length) grid += '<h3>OPEC gas demand <span class="ogx-h3n">' + esc(gas.unit || "") + ", first to last outlook year</span></h3><div class=\"ogx-kpis ogx-k3\">" +
          gn.map(n => '<div class="ogx-kpi"><span class="ogx-kl">' + esc(n) + '</span><span class="ogx-kv">' + esc(U().fmt(gas.rows[n][0], 1)) + " → " + esc(U().fmt(gas.rows[n][gas.rows[n].length - 1], 1)) + "</span></div>").join("") + "</div>";
      }
      grid += "</div>";
    }
    grid += "</div>";
    b.insertAdjacentHTML("beforeend", grid);
    if (iea && iea.rows) {
      const y = (iea.years || []).map(String);
      if (b.querySelector(".ogx-i1")) chart(b.querySelector(".ogx-i1"), { h: 120, aria: "IEA total oil demand", x: y, series: [{ color: "var(--text)", width: 2, vals: iea.rows["Total demand"], end: true }] });
      if (b.querySelector(".ogx-i2")) chart(b.querySelector(".ogx-i2"), { h: 130, aria: "IEA oil demand by region", x: y, series: ["OECD Europe", "China", "Other Asia"].filter(n => iea.rows[n]).map(n => ({ color: ieaCols[n], width: 1.8, vals: iea.rows[n] })) });
    }
    if (names.length) chart(b.querySelector(".ogx-o1"), { h: 236, aria: "OPEC oil demand outlook by region", x: (opec.demand.years || []).map(String), zero: true, series: names.map((n, i) => ({ color: opCols[i], width: 1.8, vals: opec.demand.rows[n], end: true })) });
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
    const cols = ["var(--muted)", "#e8a33d", "#f06a7d", "#4fb3e0", "var(--text)"];
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
        chart(host.querySelector(".og-plot"), { h: 190, aria: "Per person, " + fuel.label, zero: true, x: decadeX(yrs), series: names.map((n, i) => ({ color: cols[i % cols.length], width: 1.8, vals: file.entities[n][fuel.per_capita] || [] })) });
        host.insertAdjacentHTML("beforeend", '<p class="ogx-note">' + esc(compareStory(file)) + "</p>");
        return;
      }
      const ent = file.entities[state.place];
      if (!ent) { host.innerHTML = '<p class="og-na">Not available for this place.</p>'; return; }
      const nm = shortName(state.place);
      const cons = latestOf(ent, fuel.consumption), prod = fuel.production ? latestOf(ent, fuel.production) : null;
      headline(el, nm + ": " + fuel.label.toLowerCase() + (fuel.id === "total_energy" ? " supply " : " consumption ") + (cons && f(cons.value) ? U().fmt(cons.value, cons.value >= 100 ? 0 : 1) + " " + ({ kbd: "kb/d", bcm: "bcm", ej: "EJ" }[String(fuel.consumption).split("_").pop()] || "") + " in " + cons.year + (f(cons.yoy_pct) ? ", " + U().signed(cons.yoy_pct, "%") + " on the year" : "") : "n/a"));
      const series = [];
      if (fuel.production && ent[fuel.production]) series.push({ color: "#e8a33d", width: 2, vals: ent[fuel.production] });
      if (fuel.consumption && ent[fuel.consumption]) series.push({ color: "var(--muted)", width: 2, vals: ent[fuel.consumption] });
      let leg = [];
      if (fuel.production) leg.push({ label: "Production", color: "#e8a33d" });
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
      if (series.length) chart(host.querySelector(".ogx-a1"), { h: 170, aria: nm + " " + fuel.label, zero: true, x: decadeX(ent.years), series: series });
      else host.querySelector(".ogx-a1").innerHTML = '<p class="og-na">n/a</p>';
      if (ent[fuel.per_capita]) chart(host.querySelector(".ogx-a2"), { h: 120, aria: "Per person", zero: true, x: decadeX(ent.years), series: [{ color: "#f06a7d", width: 1.8, vals: ent[fuel.per_capita], end: true }] });
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
        return { map: map, at: d.generated_cet || d.generated_utc || "" };
      } catch (e) { /* try the next copy */ }
    }
    return { map: {}, at: "" };
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
    prices(root, data.spot_daily, q, at);
    curves(root);
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
