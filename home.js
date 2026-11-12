/* Home: what changed, and does it matter.
   Tiles are chosen from today's files (market, Nordic power, gas storage). At most eight.
   A name is included when it sits outside a normal or range the file already publishes, or when
   the move is large for that market. Quiet names are left off. Nothing is invented to fill a gap.
   The previous Home view is parked/home/legacy.js. */
(function () {
  "use strict";
  if (window.EMMI_PARKED_HOME) return;

  const NORDIC = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/nordic-v2/";
  const CAP = 8;
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* sym, label, unit, digits, href, family, weight, bucket */
  const CATALOG = [
    ["BZ=F", "Brent", "$/bbl", 2, "#oilgas/ogPx", "energy", 1.25, ""],
    ["CL=F", "WTI", "$/bbl", 2, "#oilgas/ogPx", "energy", 1.05, "crude"],
    ["HO=F", "NY Harbor ULSD", "$/gal", 3, "#oilgas/ogPx", "energy", 1.15, ""],
    ["NG=F", "Henry Hub", "$/mmBtu", 3, "#oilgas/ogPx", "energy", 1.2, ""],
    ["TTF=F", "TTF", "€/MWh", 2, "#gas/gsSecPx", "energy", 1.25, ""],
    ["GC=F", "Gold", "$/oz", 1, "#mining/mnPx", "metal", 1.2, "precious"],
    ["HG=F", "Copper", "$/lb", 3, "#mining/mnPx", "metal", 1.2, ""],
    ["SI=F", "Silver", "$/oz", 2, "#macro/mkt-cmd", "metal", 1.08, "precious"],
    ["PL=F", "Platinum", "$/oz", 1, "#macro/mkt-cmd", "metal", 0.95, "precious"],
    ["U-UN.TO", "Uranium", "C$", 2, "#macro/mkt-cmd", "energy", 1.05, ""],
    ["CO2.L", "EU carbon", "€", 2, "#macro/mkt-cmd", "energy", 1.15, ""],
    ["^TNX", "US 10Y", "%", 3, "#macro/mkt-rates", "rates", 1.15, ""],
    ["CNBC:DE10Y-DE", "Bund 10Y", "%", 3, "#macro/mkt-rates", "rates", 1.08, ""],
    ["EURUSD=X", "EUR/USD", "", 4, "#macro/mkt-fx", "fx", 1.1, "dollar"],
    ["DX-Y.NYB", "Dollar index", "", 2, "#macro/mkt-fx", "fx", 0.9, "dollar"],
    ["EURCHF=X", "EUR/CHF", "", 4, "#macro/mkt-fx", "fx", 0.95, ""],
    ["^OMX", "OMX Stockholm 30", "", 1, "#macro/mkt-indices", "index", 0.78, "index"],
    ["^STOXX50E", "Euro Stoxx 50", "", 1, "#macro/mkt-indices", "index", 0.74, "index"],
    ["^GSPC", "S&P 500", "", 1, "#macro/mkt-indices", "index", 0.7, "index"],
    ["^N225", "Nikkei 225", "", 1, "#macro/mkt-indices", "index", 0.7, "index"],
    ["^FTSE", "FTSE 100", "", 1, "#macro/mkt-indices", "index", 0.65, "index"]
  ];

  const state = { ready: false, market: null, prices: null, normals: null, gen: null, hydro: null, weather: null, gas: null, gasHist: null, deals: null };
  let shown = false, seq = 0, bound = false;

  function fmt(v, d) {
    if (!finite(v)) return null;
    return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function dayLabel(iso) {
    const s = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "not available yet";
    const d = new Date(s + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) return "not available yet";
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(d).replace("Sept", "Sep");
  }
  function zurichDay(date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  function addDays(iso, n) {
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    const da = Date.parse(String(a).slice(0, 10) + "T12:00:00Z");
    const db = Date.parse(String(b).slice(0, 10) + "T12:00:00Z");
    if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
    return Math.round((da - db) / 864e5);
  }
  function headWhen(data) {
    const raw = data && (data.generated_cet || data.generated_utc);
    const t = Date.parse(raw || "");
    if (!Number.isFinite(t)) return "not available yet";
    const d = new Date(t);
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short" }).format(d).replace("Sept", "Sep");
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    return day + " " + hm + " Zurich";
  }
  function rowsOf(data) {
    const map = new Map();
    ((data && data.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(r => {
      if (r && r.sym && !map.has(r.sym)) map.set(r.sym, r);
    })));
    return map;
  }
  function groupSet(data, id) {
    const g = ((data && data.groups) || []).find(x => x.id === id);
    const set = new Set();
    if (!g) return set;
    (g.sections || []).forEach(s => (s.rows || []).forEach(r => { if (r && r.sym) set.add(r.sym); }));
    return set;
  }
  function sparkPath(values) {
    const p = (values || []).filter(finite);
    if (p.length < 2) return "";
    const w = 120, h = 28;
    let mn = Math.min.apply(null, p), mx = Math.max.apply(null, p);
    if (mx === mn) mx = mn + 1;
    const pts = p.map((v, i) => [(i / (p.length - 1)) * w, h - 3 - ((v - mn) / (mx - mn)) * (h - 6)]);
    const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
    const c = p[p.length - 1] >= p[0] ? "var(--good)" : "var(--bad)";
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function pill(v, unit) {
    if (!finite(v)) return "";
    const cls = v > 0 ? "up" : v < 0 ? "dn" : "";
    const n = Math.abs(v);
    let body, suf;
    if (unit === "bp") { body = n.toFixed(n >= 10 ? 0 : 1); suf = " bp"; }
    else if (unit === "pp") { body = n.toFixed(1); suf = " pp"; }
    else if (unit === "°C") { body = n.toFixed(1); suf = " °C"; }
    else { body = n.toFixed(1); suf = "%"; }
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return '<span class="pill ' + cls + '">' + sign + body + suf + "</span>";
  }
  function changeBit(label, ch) {
    const body = !ch || !finite(ch.v) ? '<span class="na">not available yet</span>' : pill(ch.v, ch.unit);
    return '<span class="chg"><span class="k">' + label + "</span>" + body + "</span>";
  }

  function rangePos(r) {
    const sp = (r.spark || []).filter(finite);
    if (sp.length < 20 || !finite(r.px) || !r.spark_from || !r.bar_date) return null;
    const span = daysBetween(r.bar_date, r.spark_from);
    if (span == null || span < 300) return null;
    const lo = Math.min.apply(null, sp), hi = Math.max.apply(null, sp);
    if (!(hi > lo)) return null;
    return (r.px - lo) / (hi - lo);
  }
  function maStat(r, family) {
    const ma = r.ma && r.ma["200"];
    if (!ma) return null;
    if (family === "rates") return finite(ma.bp) ? ma.bp : null;
    return finite(ma.pct) ? ma.pct : null;
  }
  function marketMove(r, family) {
    if (family === "rates") {
      const bp = r.bp || {};
      return { d1: finite(bp["1D"]) ? bp["1D"] : null, m1: finite(bp["1M"]) ? bp["1M"] : null, unit: "bp" };
    }
    const pct = r.pct || {};
    return { d1: finite(pct["1D"]) ? pct["1D"] : null, m1: finite(pct["1M"]) ? pct["1M"] : null, unit: "%" };
  }
  function qualifiesMarket(family, d1, m1, mav, edge) {
    const a = v => finite(v) ? Math.abs(v) : 0;
    if (family === "index") return a(d1) >= 1.8 || a(m1) >= 8 || a(mav) >= 10;
    if (family === "fx") return a(d1) >= 0.7 || a(m1) >= 2.2 || a(mav) >= 4 || edge;
    if (family === "rates") return a(d1) >= 8 || a(m1) >= 20 || a(mav) >= 40 || edge;
    return a(d1) >= 1.8 || a(m1) >= 8 || a(mav) >= 12 || edge;
  }
  function scoreMarket(family, d1, m1, mav, edge, weight) {
    let score = 0;
    const a = v => finite(v) ? Math.abs(v) : null;
    if (edge && family !== "index") score += 2.6;
    const farScale = family === "rates" ? 40 : family === "fx" ? 4 : 12;
    const farCut = family === "rates" ? 40 : family === "fx" ? 4 : family === "index" ? 10 : 12;
    if (a(mav) != null && a(mav) >= farCut) score += Math.min(3.4, a(mav) / farScale);
    const dScale = family === "index" ? 1.8 : family === "fx" ? 0.7 : family === "rates" ? 8 : 1.8;
    const mScale = family === "index" ? 8 : family === "fx" ? 2.2 : family === "rates" ? 20 : 8;
    if (a(d1) != null && a(d1) >= dScale * 0.8) score += Math.min(2.6, a(d1) / dScale);
    if (a(m1) != null && a(m1) >= mScale * 0.8) score += Math.min(2.4, a(m1) / mScale);
    return score * weight;
  }
  function marketWhy(family, pos, mav) {
    if (pos != null && (pos <= 0.04 || pos >= 0.96)) {
      const high = pos >= 0.5;
      const at = high ? pos >= 0.985 : pos <= 0.015;
      return (at ? "At" : "Near") + " the 1-year " + (high ? "high." : "low.");
    }
    if (!finite(mav)) return "";
    const far = family === "rates" ? Math.abs(mav) >= 40 : family === "fx" ? Math.abs(mav) >= 4 : family === "index" ? Math.abs(mav) >= 10 : Math.abs(mav) >= 12;
    if (!far) return "";
    const word = mav > 0 ? "above" : "below";
    if (family === "rates") return Math.round(Math.abs(mav)) + " bp " + word + " its 200-day average.";
    const n = Math.abs(mav);
    return (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + "% " + word + " its 200-day average.";
  }

  function marketTiles(data) {
    const rows = rowsOf(data);
    const out = [];
    CATALOG.forEach((spec, i) => {
      const sym = spec[0], r = rows.get(sym);
      if (!r || !finite(r.px)) return;
      const family = spec[5];
      const move = marketMove(r, family);
      const mav = maStat(r, family);
      const pos = rangePos(r);
      const edge = pos != null && (pos <= 0.04 || pos >= 0.96);
      if (!qualifiesMarket(family, move.d1, move.m1, mav, edge)) return;
      const month = r.contract && r.contract.month;
      out.push({
        id: sym,
        label: spec[1],
        unit: spec[2],
        digits: spec[3],
        href: spec[4],
        family: family,
        bucket: spec[7],
        px: r.px,
        asof: r.bar_date || "",
        extra: month || "",
        d1: { v: move.d1, unit: move.unit },
        m1: { v: move.m1, unit: move.unit },
        why: marketWhy(family, pos, mav),
        spark: r.spark || [],
        score: scoreMarket(family, move.d1, move.m1, mav, edge, spec[6]),
        ord: i,
        m1raw: move.m1,
        d1raw: move.d1
      });
    });
    return out;
  }

  function lastFinite(rows, idx) {
    if (!rows) return null;
    for (let i = rows.length - 1; i >= 0; i--) if (finite(rows[i][idx])) return rows[i];
    return null;
  }
  function valueOn(rows, iso, idx, slack) {
    if (!rows || !iso) return null;
    const cut = addDays(iso, slack || 0);
    let hit = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r[0] <= cut && finite(r[idx])) hit = r;
    }
    if (!hit) return null;
    const gap = daysBetween(addDays(iso, slack || 0), hit[0]);
    if (gap != null && gap > 5) return null;
    return hit;
  }
  function pctChange(now, then) {
    if (!finite(now) || !finite(then) || then === 0) return null;
    return (now / then - 1) * 100;
  }

  function nordicPrice(prices, normals) {
    const R = prices && prices.regions && prices.regions.Nordic;
    if (!R || !R.rows) return null;
    const row = (R.as_of && R.rows.find(r => r[0] === R.as_of && finite(r[1]))) || lastFinite(R.rows, 1);
    if (!row) return null;
    const day = row[1];
    const prev = valueOn(R.rows, addDays(row[0], -1), 1, 0);
    const month = valueOn(R.rows, addDays(row[0], -30), 1, 0);
    let norm = null;
    const days = normals && normals.month_days;
    const series = normals && normals.normal && normals.normal.Nordic;
    if (Array.isArray(days) && Array.isArray(series)) {
      const i = days.indexOf(row[0].slice(5));
      if (i >= 0 && finite(series[i])) norm = series[i];
    }
    const vs = finite(norm) && norm !== 0 ? (day / norm - 1) * 100 : null;
    const sum = R.summary || {};
    const sumPct = finite(sum.difference_pct) ? sum.difference_pct : null;
    const d1 = prev ? pctChange(day, prev[1]) : null;
    const m1 = month ? pctChange(day, month[1]) : null;
    const outsideDay = finite(vs) && Math.abs(vs) >= 40;
    const outsideAvg = finite(sumPct) && Math.abs(sumPct) >= 25;
    const moved = (finite(d1) && Math.abs(d1) >= 10) || (finite(m1) && Math.abs(m1) >= 20);
    if (!outsideDay && !outsideAvg && !moved) return null;
    const base = R.baseline_label || (normals && normals.baseline_label) || "";
    let why = "";
    if (outsideDay) why = "Same-date normal is " + fmt(norm, 1) + (base ? " (" + base + ")" : "") + ".";
    else if (outsideAvg && finite(sum.value) && finite(sum.normal)) why = "30-day average is " + fmt(sum.value, 1) + " versus a " + fmt(sum.normal, 1) + " normal.";
    let score = 0;
    if (outsideDay) score += Math.min(4.2, Math.abs(vs) / 40);
    else if (outsideAvg) score += Math.min(3.2, Math.abs(sumPct) / 40);
    if (finite(d1) && Math.abs(d1) >= 8) score += Math.min(2.6, Math.abs(d1) / 10);
    if (finite(m1) && Math.abs(m1) >= 12) score += Math.min(2.2, Math.abs(m1) / 15);
    return {
      id: "nordic-price", label: "Nordic system", unit: "€/MWh", digits: 1, href: "#power/price",
      px: day, asof: row[0], d1: { v: d1, unit: "%" }, m1: { v: m1, unit: "%" }, why: why,
      spark: R.rows.map(r => finite(r[1]) ? r[1] : null).filter(finite),
      score: score * 1.35, ord: -30
    };
  }

  function genTile(gen, key) {
    const M = gen && gen.regions && gen.regions.Nordic && gen.regions.Nordic.metrics && gen.regions.Nordic.metrics[key];
    if (!M || !M.rows) return null;
    const row = (M.as_of && M.rows.find(r => r[0] === M.as_of && finite(r[1]))) || lastFinite(M.rows, 1);
    if (!row) return null;
    if (M.as_of && daysBetween(M.as_of, row[0]) > 3) return null;
    const day = row[1];
    const hist = row[4] >= 3 && finite(row[3]) ? row[3] : null;
    const prev = valueOn(M.rows, addDays(row[0], -1), 1, 0);
    const month = valueOn(M.rows, addDays(row[0], -30), 1, 0);
    if (key === "wind_load_factor") {
      const gap = finite(hist) ? day - hist : null;
      const d1 = prev && finite(prev[1]) ? day - prev[1] : null;
      const m1 = month && finite(month[1]) ? day - month[1] : null;
      const outside = finite(gap) && Math.abs(gap) >= 8;
      const moved = (finite(d1) && Math.abs(d1) >= 6) || (finite(m1) && Math.abs(m1) >= 10);
      if (!outside && !moved) return null;
      let why = "";
      if (outside) why = Math.abs(gap).toFixed(0) + " pp " + (gap < 0 ? "under" : "over") + " the same-date history (" + fmt(hist, 0) + "%" + (finite(row[4]) ? ", " + row[4] + " years" : "") + ").";
      let score = 0;
      if (outside) score += Math.min(3.6, Math.abs(gap) / 8);
      if (finite(d1) && Math.abs(d1) >= 5) score += Math.min(2.2, Math.abs(d1) / 6);
      if (finite(m1) && Math.abs(m1) >= 8) score += Math.min(2, Math.abs(m1) / 10);
      return {
        id: "nordic-wind", label: "Nordic wind", unit: "%", digits: 1, href: "#power/generation",
        px: day, asof: row[0], d1: { v: d1, unit: "pp" }, m1: { v: m1, unit: "pp" }, why: why,
        spark: M.rows.map(r => finite(r[1]) ? r[1] : null).filter(finite),
        score: score * 1.32, ord: -20
      };
    }
    const vs = finite(hist) && hist !== 0 ? (day / hist - 1) * 100 : null;
    const d1 = prev ? pctChange(day, prev[1]) : null;
    const m1 = month ? pctChange(day, month[1]) : null;
    const outside = finite(vs) && Math.abs(vs) >= 25;
    const moved = (finite(d1) && Math.abs(d1) >= 15) || (finite(m1) && Math.abs(m1) >= 20);
    if (!outside && !moved) return null;
    let why = "";
    if (outside) why = (Math.abs(vs) >= 10 ? Math.abs(vs).toFixed(0) : Math.abs(vs).toFixed(1)) + "% " + (vs > 0 ? "above" : "below") + " the same-date history (" + fmt(hist, 0) + " MW" + (finite(row[4]) ? ", " + row[4] + " years" : "") + ").";
    let score = 0;
    if (outside) score += Math.min(3.2, Math.abs(vs) / 20);
    if (finite(d1) && Math.abs(d1) >= 10) score += Math.min(2, Math.abs(d1) / 12);
    if (finite(m1) && Math.abs(m1) >= 15) score += Math.min(2, Math.abs(m1) / 20);
    return {
      id: "nordic-hydro", label: "Nordic hydro", unit: "MW", digits: 0, href: "#power/generation",
      px: day, asof: row[0], d1: { v: d1, unit: "%" }, m1: { v: m1, unit: "%" }, why: why,
      spark: M.rows.map(r => finite(r[1]) ? r[1] : null).filter(finite),
      score: score * 1.22, ord: -10
    };
  }

  function isoWeek(iso) {
    const date = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 864e5) + 1) / 7);
  }
  function reservoir(hydro) {
    const bag = hydro && hydro.reservoirs;
    if (!bag) return null;
    const codes = ["NO", "SE", "FI"];
    let best = null;
    codes.forEach(code => {
      const R = bag[code];
      if (!R || !R.rows || !R.as_of || !/%|full/i.test(R.unit || "")) return;
      if (daysBetween(new Date().toISOString(), R.as_of) > 14) return;
      const row = R.rows.find(r => r[0] === R.as_of) || R.rows[R.rows.length - 1];
      if (!row || !finite(row[1])) return;
      const band = R.band || [];
      let b = null;
      const week = isoWeek(row[0]);
      b = band.find(x => x && x[0] === week) || null;
      if (!b && band.length === R.rows.length) b = band[R.rows.indexOf(row)] || null;
      if (!b || !finite(b[1]) || !finite(b[3])) return;
      const fill = row[1];
      const outside = fill < b[1] || fill > b[3];
      const mid = finite(b[2]) ? fill - b[2] : null;
      if (!outside && !(finite(mid) && Math.abs(mid) >= 12)) return;
      const edge = outside ? Math.max(b[1] - fill, fill - b[3], 0) : Math.abs(mid);
      const score = (outside ? 2.4 : 0) + Math.min(2, edge / 6);
      const why = outside
        ? (fill < b[1] ? "Below" : "Above") + " the weekly range (" + fmt(b[1], 0) + "–" + fmt(b[3], 0) + "%)."
        : Math.abs(mid).toFixed(0) + " pp " + (mid > 0 ? "over" : "under") + " the weekly median (" + fmt(b[2], 0) + "%).";
      const prev = valueOn(R.rows, addDays(row[0], -7), 1, 0);
      const month = valueOn(R.rows, addDays(row[0], -28), 1, 3);
      const tile = {
        id: "reservoir-" + code, label: (code === "NO" ? "Norway" : code === "SE" ? "Sweden" : "Finland") + " reservoirs",
        unit: "%", digits: 1, href: "#power/hydro", px: fill, asof: row[0],
        d1: { v: prev ? fill - prev[1] : null, unit: "pp" },
        m1: { v: month ? fill - month[1] : null, unit: "pp" },
        why: why, spark: R.rows.map(r => finite(r[1]) ? r[1] : null).filter(finite),
        score: score * 1.15, ord: 5
      };
      if (!best || tile.score > best.score) best = tile;
    });
    return best;
  }

  function weatherTile(weather, priceAsOf) {
    const bag = weather && weather.regions && weather.regions.Nordic && weather.regions.Nordic.metrics;
    if (!bag) return null;
    const specs = [
      ["temp", "Nordic temperature", "°C", "#power/temp", 3, "°C"],
      ["wind100", "Nordic wind speed", "m/s", "#power/wind", 25, "%"],
      ["rain", "Nordic rain", "mm/day", "#power/rain", 50, "%"]
    ];
    let best = null;
    specs.forEach(spec => {
      const M = bag[spec[0]];
      if (!M || !M.rows || !M.as_of) return;
      if (priceAsOf && daysBetween(priceAsOf, M.as_of) > 3) return;
      const sum = M.summary || {};
      const row = M.rows.find(r => r[0] === M.as_of && finite(r[1])) || lastFinite(M.rows, 1);
      if (!row) return;
      const day = row[1];
      let outside = false, why = "", mag = 0, dUnit = "%";
      if (spec[0] === "temp") {
        const diff = finite(sum.difference) ? sum.difference : null;
        outside = finite(diff) && Math.abs(diff) >= spec[4];
        if (!outside) return;
        why = Math.abs(diff).toFixed(1) + " °C " + (diff > 0 ? "above" : "below") + " the 2006–2025 normal.";
        mag = Math.abs(diff) / 2;
        dUnit = "°C";
      } else {
        const pct = finite(sum.difference_pct) ? sum.difference_pct : null;
        outside = finite(pct) && Math.abs(pct) >= spec[4];
        if (!outside) return;
        why = Math.abs(pct).toFixed(0) + "% " + (pct > 0 ? "above" : "below") + " the 2006–2025 normal.";
        mag = Math.abs(pct) / spec[4];
      }
      const prev = valueOn(M.rows, addDays(row[0], -1), 1, 0);
      const month = valueOn(M.rows, addDays(row[0], -30), 1, 0);
      const d1 = prev ? (dUnit === "°C" ? day - prev[1] : pctChange(day, prev[1])) : null;
      const m1 = month ? (dUnit === "°C" ? day - month[1] : pctChange(day, month[1])) : null;
      const tile = {
        id: "wx-" + spec[0], label: spec[1], unit: spec[2], digits: 1, href: spec[3],
        px: day, asof: row[0], d1: { v: d1, unit: dUnit }, m1: { v: m1, unit: dUnit }, why: why,
        spark: M.rows.map(r => finite(r[1]) ? r[1] : null).filter(finite),
        score: Math.min(3.6, mag) * 1.15, ord: 8
      };
      if (!best || tile.score > best.score) best = tile;
    });
    return best;
  }

  function gasSeries(file) {
    const fill = file && file.fill;
    if (!fill || typeof fill !== "object") return [];
    const out = [];
    Object.keys(fill).filter(y => /^\d{4}$/.test(y)).sort().forEach(y => {
      const arr = fill[y];
      if (!Array.isArray(arr)) return;
      arr.forEach(v => { if (finite(v)) out.push(v); });
    });
    return out.slice(-200);
  }
  function gasTile(gas, hist) {
    const eu = gas && gas.areas && gas.areas.EU;
    const s = eu && eu.s;
    if (!s || !finite(s.fill)) return null;
    const outside = finite(s.min) && finite(s.max) && (s.fill < s.min || s.fill > s.max);
    const far = finite(s.vsAvg) && Math.abs(s.vsAvg) >= 8;
    const moved = (finite(s.d1) && Math.abs(s.d1) >= 1.5) || (finite(s.d30) && Math.abs(s.d30) >= 4);
    if (!outside && !far && !moved) return null;
    let why = "";
    if (outside) why = (s.fill < s.min ? "Below" : "Above") + " the 5-year range of " + fmt(s.min, 0) + "–" + fmt(s.max, 0) + "%" + (finite(s.avg) ? " (average " + fmt(s.avg, 0) + "%)" : "") + ".";
    else if (far) why = Math.abs(s.vsAvg).toFixed(0) + " pp " + (s.vsAvg < 0 ? "under" : "over") + " the 5-year average" + (finite(s.avg) ? " (" + fmt(s.avg, 0) + "%)" : "") + ".";
    let score = 0;
    if (outside) score += 2.6;
    if (far) score += Math.min(2.2, Math.abs(s.vsAvg) / 8);
    if (finite(s.d1) && Math.abs(s.d1) >= 1.2) score += Math.min(1.6, Math.abs(s.d1) / 1.5);
    if (finite(s.d30) && Math.abs(s.d30) >= 3) score += Math.min(1.6, Math.abs(s.d30) / 4);
    return {
      id: "eu-storage", label: "EU gas storage", unit: "%", digits: 1, href: "#gas/gsSecOv",
      px: s.fill, asof: eu.last || gas.gas_day || "", d1: { v: finite(s.d1) ? s.d1 : null, unit: "pp" },
      m1: { v: finite(s.d30) ? s.d30 : null, unit: "pp" }, why: why,
      spark: gasSeries(hist), score: score * 1.28, ord: -15
    };
  }

  function dedupe(list) {
    function drop(id) { list = list.filter(t => t.id !== id); }
    function both(a, b) { return [list.find(t => t.id === a), list.find(t => t.id === b)]; }
    const crude = both("BZ=F", "CL=F");
    if (crude[0] && crude[1]) {
      const same = finite(crude[0].m1raw) && finite(crude[1].m1raw) && crude[0].m1raw * crude[1].m1raw > 0
        && Math.abs(crude[0].m1raw - crude[1].m1raw) < 4
        && finite(crude[0].d1raw) && finite(crude[1].d1raw) && Math.abs(crude[0].d1raw - crude[1].d1raw) < 1.2;
      if (same) drop(crude[0].score >= crude[1].score ? "CL=F" : "BZ=F");
    }
    const dollar = both("EURUSD=X", "DX-Y.NYB");
    if (dollar[0] && dollar[1]) drop(dollar[0].score >= dollar[1].score ? "DX-Y.NYB" : "EURUSD=X");
    const precious = list.filter(t => t.bucket === "precious").sort((a, b) => b.score - a.score || a.ord - b.ord);
    if (precious.length > 2) {
      const lose = new Set(precious.slice(2).map(t => t.id));
      list = list.filter(t => !lose.has(t.id));
    }
    const indices = list.filter(t => t.bucket === "index").sort((a, b) => b.score - a.score || a.ord - b.ord);
    if (indices.length > 1) {
      const keep = indices[0].id;
      list = list.filter(t => t.bucket !== "index" || t.id === keep);
    }
    return list;
  }

  function choose() {
    const market = (window.MMTable && MMTable.data && MMTable.data()) || state.market;
    let tiles = marketTiles(market);
    const price = nordicPrice(state.prices, state.normals);
    const wind = genTile(state.gen, "wind_load_factor");
    const hydro = genTile(state.gen, "hydro");
    const res = reservoir(state.hydro);
    const wx = weatherTile(state.weather, state.prices && state.prices.as_of);
    const gas = gasTile(state.gas, state.gasHist);
    [price, wind, hydro, res, gas].forEach(t => { if (t) tiles.push(t); });
    if (wx && !(wx.id === "wx-wind100" && wind)) tiles.push(wx);
    tiles = dedupe(tiles);
    tiles.sort((a, b) => b.score - a.score || a.ord - b.ord);
    return tiles.slice(0, CAP);
  }

  const MAJOR = /\b(acqui(re|res|sition)|merger|combin(e|ation) with|takeover|offer (for|declared)|majority owner|investment platform|rights issue|placing|private placement|bond issu|final investment decision|\bFID\b|profit warning|(raises|lowers|cuts|withdraws) .*guidance|guidance (raised|cut|lowered)|first (oil|gas|power|gold)|commercial operation|discovery)\b/i;
  const ADMIN = /(8\.5 EPT\b|application for listing|\bForm 8(\.\d)?\b|Award of Options|Admission to Trading|Disclosure Table|Total Voting Rights|\bTVR\b|voting rights|Issue of Equity in Lieu|Publication and Posting|Supplementary Letter|Directorate change|Board Change|Block ?listing|Acceptance Level Update|Exercise of (Share )?(Awards|Options)|publication of (a )?prospectus|Prospectus and listing)/i;
  function isMajor(it) {
    if (!it || it.ty === "insider" || ADMIN.test(it.h || "")) return false;
    const primary = it.src !== "yahoo" || /\b(Business ?Wire|PR ?Newswire|GlobeNewswire|NewMediaWire|ACCESS ?Newswire|Accesswire|Newsfile|Cision|RNS)\b/i.test(it.pub || "");
    return primary && (["ma", "raise", "financing", "ppa"].includes(it.ty) || MAJOR.test(it.h || ""));
  }
  function dealHref(sym) {
    const market = (window.MMTable && MMTable.data && MMTable.data()) || state.market;
    const cos = (state.deals && state.deals.cos && state.deals.cos[sym]) || {};
    const g = cos.g || [];
    if (g.includes("ren") || groupSet(market, "nordic").has(sym)) return "#power/pwFeed";
    if (g.includes("og") || g.includes("lse") || groupSet(market, "energy").has(sym)) return "#oilgas/ogFeed";
    if (groupSet(market, "metals").has(sym)) return "#mining/mnFeed";
    if (g.includes("lun")) return "#mining/mnLundin";
    return "";
  }
  function announcements() {
    const items = (state.deals && state.deals.items) || [];
    const today = zurichDay(new Date());
    return items.filter(it => {
      const t = Date.parse(it.t || "");
      return Number.isFinite(t) && zurichDay(new Date(t)) === today && isMajor(it) && dealHref(it.s);
    }).sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 3);
  }

  function tileHTML(t) {
    const num = fmt(t.px, t.digits);
    const unit = t.unit ? '<small' + (t.unit === "%" ? ' class="pct"' : "") + ">" + esc(t.unit) + "</small>" : "";
    const fig = num ? num + unit : '<span class="na">not available yet</span>';
    const when = dayLabel(t.asof) + (t.extra ? " · " + esc(t.extra) : "");
    return '<a class="tile" href="' + esc(t.href) + '"><span class="tn">' + esc(t.label) + '</span><span class="when">' + when + '</span><span class="px">' + fig + '</span><span class="pills">' + changeBit("1D", t.d1) + changeBit("1M", t.m1) + "</span>" + (t.why ? '<span class="why">' + esc(t.why) + "</span>" : "") + sparkPath(t.spark) + "</a>";
  }
  function stripHTML(items) {
    if (!items.length) return "";
    const cos = (state.deals && state.deals.cos) || {};
    const lis = items.map(it => {
      const name = (cos[it.s] && cos[it.s].n) || it.s;
      return '<li><a href="' + esc(dealHref(it.s)) + '"><time datetime="' + esc(it.t || "") + '">' + esc(dayLabel(it.t)) + "</time>" + esc(name) + " — " + esc(it.h || "") + "</a></li>";
    }).join("");
    return '<section class="strip" aria-label="Major announcements"><h2>Announcements · ' + esc(dayLabel(items[0].t)) + "</h2><ul>" + lis + "</ul></section>";
  }

  const INFO = '<p>A tile is here because it is outside a normal or range already in the file, or because the day or the month move is large for that market. Quiet names stay off, even when that leaves a short row. At most eight. A blank says not available yet.</p>'
    + '<p>Price levels use the one-year history stored with the quote, or the 200-day average in the same file. Nordic price uses the published same-date normal. Wind and hydro use the same-date history in the generation file, not a weather normal. Gas storage uses the same-date five-year range. No normal is filled in when the file does not have one.</p>'
    + '<p>Green is up and red is down, including the power price. On the Nordic power page a rise in the price is red. The Nordic wind figure is the system load factor. Sweden’s 2026 dates keep the 2025 ENTSO-E A68 capacity, held forward.</p>';
  const FOOT = '<p>Prices: the market file (Yahoo, about 15 minutes delayed; 10-year yields are the official closes where that file says so). Nordic power: Nord Pool system price, ENTSO-E generation and the published normals in nordic-v2. Gas storage: GIE AGSI+. Announcements, when a line is shown: the same deal-flow file as the sector pages, and only a company-published item that the file already classes as major, dated today, with a link to the live sector page.</p>';

  function paint() {
    const box = document.getElementById("homeView");
    if (!box || !shown) return;
    const open = document.getElementById("hmInfoBtn") && document.getElementById("hmInfoBtn").getAttribute("aria-expanded") === "true";
    const market = (window.MMTable && MMTable.data && MMTable.data()) || state.market;
    const asof = state.ready && market ? headWhen(market) : "not available yet";
    let body;
    if (!state.ready) body = '<p class="wait">Loading prices, Nordic power and gas storage…</p>';
    else {
      const tiles = choose();
      const notes = announcements();
      body = tiles.length
        ? '<div class="tiles" id="hmMoves" data-n="' + tiles.length + '">' + tiles.map(tileHTML).join("") + "</div>" + stripHTML(notes)
        : '<p class="quiet" id="hmMoves">Nothing in today’s data is outside its range, and nothing has a large move.</p>';
    }
    box.innerHTML = '<div class="hm2"><p class="prev-tab"><a href="parked/home/">Previous Home</a></p><p class="kicker">Home</p><header class="bh"><h1>What changed</h1><div class="bh-side"><p class="asof">Prices as of ' + esc(asof) + '</p><button type="button" class="info" id="hmInfoBtn" aria-expanded="' + (open ? "true" : "false") + '" aria-controls="hmInfo" aria-label="Sources and notes">i</button></div></header><p class="lede">Outside a normal range, or a large move.</p>' + body + '<div class="info-panel" id="hmInfo"' + (open ? "" : " hidden") + ">" + INFO + "</div><footer class=\"hm2-foot\">" + FOOT + "</footer></div>";
  }

  function bind() {
    const root = document.getElementById("homeView");
    if (!root || bound) return;
    bound = true;
    root.addEventListener("click", e => {
      const btn = e.target.closest(".info");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      const on = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", on ? "false" : "true");
      panel.hidden = on;
    });
  }

  function bust(url) {
    const t = Math.floor(Date.now() / 36e5);
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + t;
  }
  function getJSON(url) {
    return fetch(bust(url), { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function load() {
    const my = ++seq;
    const have = window.MMTable && MMTable.data && MMTable.data();
    const jobs = [
      ["market", have && have.groups ? Promise.resolve(have) : getJSON("data/market.json")],
      ["prices", getJSON(NORDIC + "prices.json")],
      ["normals", getJSON(NORDIC + "prices_normals.json")],
      ["gen", getJSON(NORDIC + "generation.json")],
      ["hydro", getJSON(NORDIC + "hydrology.json")],
      ["weather", getJSON(NORDIC + "weather.json")],
      ["gas", getJSON("data/gas.json")],
      ["gasHist", getJSON("data/gas/EU.json")],
      ["deals", getJSON("data/dealflow.json")]
    ];
    return Promise.all(jobs.map(([, p]) => p.then(v => ({ ok: true, v: v }), () => ({ ok: false })))).then(res => {
      if (my !== seq) return;
      jobs.forEach((pair, i) => { if (res[i].ok) state[pair[0]] = res[i].v; });
      state.ready = true;
      if (shown) paint();
    });
  }

  window.MMHome = {
    show() { shown = true; bind(); paint(); if (!state.ready) load(); },
    hide() { shown = false; },
    render() { if (shown) paint(); },
    reload() { state.ready = false; if (shown) paint(); return load(); }
  };
})();
