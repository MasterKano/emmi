/* Nordic power preview. Reads only MasterKano/emmi-data nordic-v2.
   Null is "not available yet", never zero. 100 m wind is never filled from a 10 m field.
   Temperature anomalies are degrees, never a percent. SE/Nordic load factor stays blank
   while Swedish current capacity is missing. */
(function () {
  "use strict";
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/nordic-v2/";
  const FILES = ["manifest", "prices", "weather", "weather_normals", "generation", "hydrology", "tomorrow", "monthly"];
  const ORDER = ["Nordic", "SE", "NO", "FI", "DK"];
  const LONG = { Nordic: "Nordic", SE: "Sweden", NO: "Norway", FI: "Finland", DK: "Denmark" };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const ZONE = { NO: ["NO1", "NO2", "NO3", "NO4", "NO5"], SE: ["SE1", "SE2", "SE3", "SE4"], FI: ["FI"], DK: ["DK1", "DK2"] };
  const FUEL = [
    ["hydro", "Hydro", "#7aa2ff"],
    ["nuclear", "Nuclear", "#fb923c"],
    ["wind", "Wind", "#2dd4bf"],
    ["solar", "Solar", "#e8c56b"],
    ["thermal", "Thermal", "#f08848"]
  ];
  const state = { region: "Nordic", month: null, year: false, data: null };
  let ros = [];

  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function fmt(v, d) {
    if (!finite(v)) return null;
    const n = Math.abs(v) < 1e-9 ? 0 : v;
    return n.toLocaleString("en-GB", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }).replace("-", "−");
  }
  function signed(v, suffix) {
    const t = fmt(v, 1);
    if (t == null) return null;
    return (v > 0 ? "+" : "") + t + (suffix || "");
  }
  function dlab(iso) {
    if (!iso || String(iso).length < 10) return null;
    const y = iso.slice(0, 4), m = iso.slice(5, 7), d = iso.slice(8, 10);
    return (+d) + " " + MON[+m - 1] + " " + y;
  }
  function mlab(k) { return MON[+k.slice(5) - 1] + " " + k.slice(0, 4); }
  function addMonths(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(d, dim));
    return dt.toISOString().slice(0, 10);
  }
  function isoWeek(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt - ys) / 86400000) + 1) / 7);
  }
  function twoMonth(rows, end) {
    if (!rows || !rows.length) return [];
    if (!end) return rows.slice(-62);
    const start = addMonths(end, -2);
    return rows.filter(r => r[0] >= start && r[0] <= end);
  }
  function ticks(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const r = (hi - lo) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(r))), q = r / p;
    const s = (q < 1.5 ? 1 : q < 2.25 ? 2 : q < 3.5 ? 2.5 : q < 7.5 ? 5 : 10) * p;
    const a = Math.floor(lo / s) * s, b = Math.ceil(hi / s) * s, o = [];
    for (let v = a; v <= b + s * 1e-6; v += s) o.push(+v.toFixed(8));
    return o;
  }
  function axisFmt(v, span) { return fmt(v, span >= 40 ? 0 : 1); }
  function clearObs() { ros.forEach(r => r.disconnect()); ros = []; }
  function watch(el, draw) {
    let w = -1;
    const go = () => {
      const nw = Math.round(el.clientWidth || 0);
      if (nw < 80 || nw === w) return;
      w = nw;
      draw(nw);
    };
    go();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(go);
      ro.observe(el);
      ros.push(ro);
    }
  }
  function na(text) { return '<p class="na">' + esc(text || "Not available yet") + "</p>"; }
  function block(root, id, title, asof) {
    const el = document.createElement("section");
    el.className = "block";
    el.id = id;
    el.dataset.block = id;
    el.innerHTML = '<header class="bh"><h2>' + esc(title) + '</h2><div class="bh-side"><p class="asof">' + asof + "</p></div></header>";
    el._info = [];
    root.appendChild(el);
    return el;
  }
  function add(el, html) { el.insertAdjacentHTML("beforeend", html); }
  function tell(el, html) { if (el && el._info) el._info.push(html); }
  function seal(el) {
    if (!el || !el._info || !el._info.length) return;
    const id = el.id + "-info";
    const side = el.querySelector(".bh-side");
    if (side) side.insertAdjacentHTML("beforeend", '<button type="button" class="info" aria-expanded="false" aria-controls="' + id + '" aria-label="Sources and notes">i</button>');
    el.insertAdjacentHTML("beforeend", '<div class="info-panel" id="' + id + '" hidden>' + el._info.join("") + "</div>");
  }
  function fig(label, value, sub, isNa, asIs) {
    return '<div class="fig' + (isNa ? " is-na" : "") + '"><span class="fig-l' + (asIs ? " as-is" : "") + '">' + esc(label) + "</span><b>" + value + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>";
  }
  function leg(items) {
    return '<p class="leg">' + items.map(it => '<span><i class="' + it.k + '"' + (it.c ? ' style="background:' + it.c + ";border-color:" + it.c + '"' : "") + "></i>" + esc(it.t) + "</span>").join("") + "</p>";
  }

  function mountChart(el, model) {
    el.innerHTML = '<p class="readout"></p>';
    const readout = el.querySelector(".readout");
    watch(el, w => {
      const svg = drawChart(w, model);
      const old = el.querySelector("svg");
      if (old) old.remove();
      el.insertAdjacentHTML("beforeend", svg);
      const hit = el.querySelector(".hit");
      const n = model.dates.length;
      const show = i => { readout.innerHTML = model.readout(i); };
      let last = n - 1;
      for (let i = n - 1; i >= 0; i--) {
        if (model.series.some(s => finite(s.vals[i]))) { last = i; break; }
      }
      show(Math.max(0, last));
      if (!hit) return;
      const move = e => {
        const r = hit.getBoundingClientRect();
        const t = r.width ? (e.clientX - r.left) / r.width : 0;
        const i = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
        show(i);
      };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
    });
  }
  function drawChart(w, model) {
    const n = model.dates.length;
    if (!n) return "";
    const h = w < 480 ? 196 : 224;
    const right = model.series.some(s => s.axis === "r" && s.vals.some(finite));
    const endLabel = model.series.some(s => s.labelEnd);
    const L = 48, R = right ? 54 : endLabel ? 62 : 14, T = 14, B = 22;
    const W = Math.max(w, L + R + 80);
    const iw = W - L - R, ih = h - T - B;
    const take = axis => model.series.filter(s => (s.axis || "l") === axis).flatMap(s => s.vals.filter(finite));
    const scale = (vals, floorZero) => {
      if (!vals.length) return null;
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const dataLo = lo;
      if (!(hi > lo)) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08 || 1;
      hi += pad;
      lo -= pad;
      if (dataLo >= 0 && (floorZero || lo < 0)) lo = 0;
      let tk = ticks(lo, hi, 4).filter(v => !(dataLo >= 0 && v < -1e-9));
      if (!tk.length || (dataLo >= 0 && tk[0] > 0 && floorZero)) tk = [0].concat(tk.filter(v => v > 0));
      if (tk.length < 2) tk = ticks(lo, hi, 4);
      return { lo: tk[0], hi: tk[tk.length - 1], tk };
    };
    const left = scale(take("l"), !!model.floorZero);
    const rght = right ? scale(take("r"), true) : null;
    if (!left && !rght) return "";
    const Lsc = left || rght;
    const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * iw;
    const span = sc => (sc.hi - sc.lo) || 1;
    const Y = (v, sc) => T + ih - (v - sc.lo) / span(sc) * ih;
    let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="' + esc(model.aria || "") + '">';
    Lsc.tk.forEach(v => {
      const y = Y(v, Lsc);
      s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c" stroke-width="1"/>';
      s += '<text x="' + (L - 6) + '" y="' + (y + 3).toFixed(1) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(axisFmt(v, Lsc.hi - Lsc.lo)) + "</text>";
    });
    if (rght) rght.tk.forEach(v => {
      s += '<text x="' + (W - 4) + '" y="' + (Y(v, rght) + 3).toFixed(1) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(axisFmt(v, rght.hi - rght.lo)) + "</text>";
    });
    s += '<text x="' + L + '" y="11" fill="#8b95a8" font-size="10">' + esc(model.yLeft || "") + "</text>";
    if (right && model.yRight) s += '<text x="' + (W - 4) + '" y="11" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(model.yRight) + "</text>";
    const want = w < 480 ? 3 : 5;
    const xi = [];
    for (let k = 0; k < want; k++) xi.push(Math.round(k * (n - 1) / (want - 1)));
    [...new Set(xi)].forEach(i => {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + esc(model.xlab ? model.xlab(i) : model.dates[i].slice(8)) + "</text>";
    });
    const path = (vals, sc) => {
      let d = "", pen = false;
      vals.forEach((v, i) => {
        if (!finite(v)) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v, sc).toFixed(1);
        pen = true;
      });
      return d;
    };
    model.series.forEach(sr => {
      const sc = sr.axis === "r" && rght ? rght : Lsc;
      if (sr.dots) {
        sr.vals.forEach((v, i) => {
          if (!finite(v)) return;
          s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v, sc).toFixed(1) + '" r="' + (n > 40 ? 2.1 : 3) + '" fill="' + sr.color + '" opacity=".8"/>';
        });
      }
      const d = path(sr.vals, sc);
      if (d && sr.width !== 0) s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.width || 2) + '"' + (sr.dash ? ' stroke-dasharray="' + sr.dash + '"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
      if (sr.labelEnd) {
        let i = -1;
        for (let k = sr.vals.length - 1; k >= 0; k--) if (finite(sr.vals[k])) { i = k; break; }
        if (i >= 0) {
          const x = Math.min(W - 4, X(i) + 6), y = Math.max(T + 4, Math.min(T + ih - 2, Y(sr.vals[i], sc) + 3));
          s += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="#f4f7fb" font-size="11" font-weight="700" text-anchor="start">' + esc(fmt(sr.vals[i], 1)) + "</text>";
        }
      }
    });
    s += '<rect class="hit" x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '" fill="transparent"/></svg>';
    return s;
  }

  function barLineChart(el, model) {
    watch(el, w => {
      const n = model.bars.length;
      const h = w < 480 ? 200 : 228, L = 44, R = 46, T = 18, B = 24;
      const W = Math.max(w, L + R + n * 8);
      const iw = W - L - R, ih = h - T - B;
      const vals = model.bars.concat(model.line).filter(finite);
      if (!vals.length) { el.innerHTML = na(); return; }
      let lo = Math.min(0, ...vals), hi = Math.max(...vals);
      hi += (hi - lo) * 0.16 || 1;
      const tk = ticks(lo, hi, 4);
      lo = tk[0]; hi = tk[tk.length - 1];
      const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
      const slot = iw / n;
      let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="' + esc(model.aria || "") + '">';
      tk.forEach(v => {
        const y = Y(v);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
        s += '<text x="' + (L - 5) + '" y="' + (y + 3) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(axisFmt(v, hi - lo)) + "</text>";
      });
      model.bars.forEach((v, i) => {
        const x = L + i * slot + slot * 0.18, bw = slot * 0.64;
        if (finite(v)) s += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(Y(v), Y(0)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.abs(Y(v) - Y(0)).toFixed(1) + '" rx="2" fill="' + model.color + '" opacity="' + (i === n - 1 ? "1" : ".78") + '"/>';
        const nv = model.line[i];
        if (finite(nv)) {
          const y = Y(nv);
          s += '<line x1="' + (x - 2).toFixed(1) + '" x2="' + (x + bw + 2).toFixed(1) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#f4f7fb" stroke-width="2" stroke-dasharray="4 3"/>';
          if (slot > 52) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" fill="#f4f7fb" font-size="10" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="#111722" stroke-width="3">' + esc(fmt(nv, 1)) + "</text>";
        }
        if (i === 0 || i === n - 1 || (slot > 36 && i % 2 === 0)) {
          const key = model.keys[i];
          const lab = key.endsWith("-01") || i === 0 ? MON[+key.slice(5) - 1] + " " + key.slice(2, 4) : MON[+key.slice(5) - 1];
          s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 6) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + esc(lab) + "</text>";
        }
      });
      let li = -1;
      for (let i = n - 1; i >= 0; i--) if (finite(model.line[i])) { li = i; break; }
      if (li >= 0 && slot <= 52) {
        const y = Y(model.line[li]);
        s += '<text x="' + (W - 4) + '" y="' + (y + 3).toFixed(1) + '" fill="#f4f7fb" font-size="11" font-weight="700" text-anchor="end">' + esc(fmt(model.line[li], 1)) + "</text>";
      }
      s += "</svg>";
      el.innerHTML = '<p class="readout"></p>' + s;
      const rd = el.querySelector(".readout");
      const show = i => {
        const v = model.bars[i], nv = model.line[i];
        const pct = finite(v) && finite(nv) && nv !== 0 ? signed((v / nv - 1) * 100, "%") : null;
        rd.innerHTML = "<b>" + esc(mlab(model.keys[i])) + "</b> · " + (fmt(v, 1) || "not available yet") + " " + esc(model.unit) + " · normal " + (fmt(nv, 1) || "not available yet") + (pct ? " · " + pct : "");
      };
      show(n - 1);
      const svg = el.querySelector("svg");
      const move = e => {
        const r = svg.getBoundingClientRect();
        const t = r.width ? (e.clientX - r.left - L * r.width / W) / (iw * r.width / W) : 0;
        show(Math.max(0, Math.min(n - 1, Math.floor(t * n))));
      };
      svg.addEventListener("pointermove", move);
      svg.addEventListener("pointerdown", move);
    });
  }

  function bandChart(el, pts, unit) {
    watch(el, w => {
      const n = pts.length;
      if (!n) { el.innerHTML = na(); return; }
      const h = w < 480 ? 196 : 220, L = 44, R = 42, T = 16, B = 22;
      const W = Math.max(w, L + R + 80), iw = W - L - R, ih = h - T - B;
      const nums = pts.flatMap(p => [p.val, p.min, p.med, p.max]).filter(finite);
      if (!nums.length) { el.innerHTML = na(); return; }
      let lo = Math.min(...nums), hi = Math.max(...nums);
      const pad = (hi - lo) * 0.1 || 1;
      lo -= pad; hi += pad;
      const tk = ticks(lo, hi, 4);
      lo = tk[0]; hi = tk[tk.length - 1];
      const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * iw;
      const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
      let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="Reservoir versus the historical band">';
      tk.forEach(v => {
        const y = Y(v);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
        s += '<text x="' + (L - 5) + '" y="' + (y + 3) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(fmt(v, (hi - lo) < 20 ? 1 : 0)) + "</text>";
      });
      let up = "", dn = "", pen = false;
      const flush = () => {
        if (up) s += '<path d="' + up + dn + ' Z" fill="rgba(79,124,255,.18)"/>';
        up = ""; dn = ""; pen = false;
      };
      pts.forEach((p, i) => {
        if (!finite(p.min) || !finite(p.max)) { flush(); return; }
        up += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(p.max).toFixed(1);
        dn = "L" + X(i).toFixed(1) + "," + Y(p.min).toFixed(1) + dn;
        pen = true;
      });
      flush();
      let d = "", penL = false;
      pts.forEach((p, i) => {
        if (!finite(p.med)) { penL = false; return; }
        d += (penL ? "L" : "M") + X(i).toFixed(1) + "," + Y(p.med).toFixed(1);
        penL = true;
      });
      if (d) s += '<path d="' + d + '" fill="none" stroke="#f4f7fb" stroke-width="1.6" stroke-dasharray="4 3"/>';
      pts.forEach((p, i) => { if (finite(p.val)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.val).toFixed(1) + '" r="3.2" fill="#7aa2ff"/>'; });
      let li = -1;
      for (let i = n - 1; i >= 0; i--) if (finite(pts[i].med)) { li = i; break; }
      if (li >= 0) s += '<text x="' + Math.min(W - 2, X(li) + 8).toFixed(1) + '" y="' + (Y(pts[li].med) + 3).toFixed(1) + '" fill="#f4f7fb" font-size="11" font-weight="700">' + esc(fmt(pts[li].med, 1)) + "</text>";
      [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach(i => {
        s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 5) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + esc(dlab(pts[i].date).replace(/ \d{4}$/, "")) + "</text>";
      });
      s += "</svg>";
      el.innerHTML = '<p class="readout"></p>' + s;
      const rd = el.querySelector(".readout");
      const show = i => {
        const p = pts[i];
        rd.innerHTML = "<b>" + esc(dlab(p.date)) + "</b> · " + (fmt(p.val, 1) || "not available yet") + " " + esc(unit) + " · median " + (fmt(p.med, 1) || "not available yet") + " · band " + (fmt(p.min, 1) || "–") + "–" + (fmt(p.max, 1) || "–");
      };
      show(n - 1);
      const svg = el.querySelector("svg");
      const move = e => {
        const r = svg.getBoundingClientRect();
        const t = r.width ? (e.clientX - r.left) / r.width : 0;
        show(Math.max(0, Math.min(n - 1, Math.round(t * (n - 1)))));
      };
      svg.addEventListener("pointermove", move);
    });
  }

  function rangeGlyph(el, st) {
    watch(el, w => {
      const h = 128, T = 16, B = 6, ih = h - T - B;
      const pts = [st.min, st.max, st.avg, st.val].filter(finite);
      if (!pts.length) { el.innerHTML = na(); return; }
      let lo = Math.min(...pts), hi = Math.max(...pts);
      const pad = (hi - lo) * 0.22 || Math.abs(lo) * 0.05 || 1;
      lo -= pad; hi += pad;
      const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
      const cx = Math.min(w * 0.34, w - 86), bw = Math.min(26, w * 0.18);
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(st.label || "average") + '">';
      if (lo < 0 && hi > 0) s += '<line x1="4" x2="' + (w - 4) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#364157"/>';
      if (finite(st.min) && finite(st.max)) {
        s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + Y(st.max).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, Y(st.min) - Y(st.max)).toFixed(1) + '" rx="3" fill="rgba(79,124,255,.20)" stroke="rgba(79,124,255,.45)"/>';
        s += '<text x="' + (cx - bw / 2 - 4).toFixed(1) + '" y="' + (Y(st.max) + 3).toFixed(1) + '" fill="#8b95a8" font-size="9" text-anchor="end">' + esc(fmt(st.max, 1)) + "</text>";
        s += '<text x="' + (cx - bw / 2 - 4).toFixed(1) + '" y="' + (Y(st.min) + 3).toFixed(1) + '" fill="#8b95a8" font-size="9" text-anchor="end">' + esc(fmt(st.min, 1)) + "</text>";
      }
      if (finite(st.avg)) {
        const y = Y(st.avg);
        s += '<line x1="' + (cx - bw / 2 - 6).toFixed(1) + '" x2="' + (cx + bw / 2 + 6).toFixed(1) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#f4f7fb" stroke-width="2" stroke-dasharray="4 3"/>';
        s += '<text x="' + (cx + bw / 2 + 10).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" fill="#f4f7fb" font-size="12" font-weight="700">' + esc(fmt(st.avg, 1)) + "</text>";
      }
      if (finite(st.val)) {
        const y = Y(st.val);
        s += '<path d="M' + cx.toFixed(1) + "," + (y - 5).toFixed(1) + " l5,5 l-5,5 l-5,-5 z" + '" fill="' + (st.color || "#4f7cff") + '"/>';
      }
      s += "</svg>";
      el.innerHTML = s;
    });
  }

  function cmpHTML(rows, unit, kind, color, windowLabel) {
    const nums = rows.flatMap(r => [r.value, r.normal]).filter(finite);
    if (!nums.length) return na();
    const lo = Math.min(0, ...nums), hi = Math.max(...nums), span = (hi - lo) || 1;
    const pos = v => (v - lo) / span * 100;
    return '<div class="cmp" style="--c:' + color + '">' + rows.map(r => {
      const on = r.code === state.region ? " is-on" : "";
      if (!finite(r.value)) return '<div class="cmp-r' + on + '"><div class="cmp-top"><b>' + esc(r.name) + '</b><span class="na">Not available yet</span></div></div>';
      let delta = "Not available yet";
      if (kind === "deg" && finite(r.difference)) delta = signed(r.difference, " °C");
      else if (kind === "pp" && finite(r.normal)) delta = signed(r.value - r.normal, " pp");
      else if (kind === "pct" && finite(r.pct)) delta = signed(r.pct, "%");
      const x0 = pos(Math.min(0, r.value)), x1 = pos(Math.max(0, r.value));
      const tick = finite(r.normal) ? '<b style="left:' + pos(r.normal).toFixed(1) + '%"></b>' : "";
      return '<div class="cmp-r' + on + '"><div class="cmp-top"><b>' + esc(r.name) + "</b><span>" + fmt(r.value, 1) + " " + esc(unit) + '</span><span class="delta">' + esc(delta) + '</span></div><span class="track"><i style="left:' + x0.toFixed(1) + "%;width:" + Math.max(0.8, x1 - x0).toFixed(1) + '%"></i>' + tick + '</span><div class="cmp-sub">' + esc(windowLabel || "30-day avg vs normal") + (finite(r.normal) ? " · " + fmt(r.normal, 1) + " " + esc(unit) : "") + "</div></div>";
    }).join("") + "</div>";
  }

  function seriesOf(rows, idx, nIdx) {
    return rows.map(r => {
      const v = r[idx];
      if (!finite(v)) return null;
      if (nIdx != null && !(r[nIdx] >= 3)) return null;
      return v;
    });
  }
  function gapNote(rows) {
    const last = rows[rows.length - 1];
    if (!last || finite(last[2])) return "";
    const missing = rows.filter(r => !finite(r[1]));
    const day = missing.length ? missing[missing.length - 1][0] : null;
    return "The 30-day average is not available yet" + (day ? " — a missing day (" + dlab(day) + ") leaves it blank rather than shortening the window" : "") + ".";
  }
  function seGap(gen) {
    const cap = gen.capacity_latest && gen.capacity_latest.SE;
    const metric = gen.regions.SE.metrics.wind_load_factor;
    const last = metric.rows[metric.rows.length - 1];
    const blank = !last || (!finite(last[1]) && !finite(last[2]));
    const flagged = !cap || !finite(cap.wind_mw) || /not used for current/i.test(cap.status || "");
    return blank || flagged;
  }
  function capLine(cap) {
    if (!cap || !finite(cap.wind_mw)) return "Capacity data pending";
    const st = cap.status || "";
    let plain = "as of " + (dlab(cap.as_of) || "date not available yet");
    if (/provisional/i.test(st)) plain += " · provisional";
    if (/not a current turbine census/i.test(st) || /annual/i.test(st)) plain += " · annual figure, not a turbine count";
    if (finite(cap.stale_days) && cap.stale_days > 0) plain += " · held " + cap.stale_days + " days past coverage";
    if (finite(cap.excluded_unknown_capacity)) plain += " · " + cap.excluded_unknown_capacity + " turbines of unknown capacity excluded";
    return fmt(cap.wind_mw, 1) + " MW · " + plain;
  }

  function priceBlock(root, data) {
    const P = data.prices, code = state.region;
    const el = block(root, "price", "Day-ahead price · " + LONG[code], "");
    if (!P || !P.regions || !P.regions[code]) { add(el, na("Price is not available yet.")); return; }
    const R = P.regions[code];
    el.querySelector(".asof").textContent = "as of " + (dlab(R.as_of) || "date not available yet");
    const rows = twoMonth(R.rows, R.as_of);
    const end = rows.filter(r => r[0] === R.as_of).pop() || rows[rows.length - 1];
    const day = end && finite(end[1]) ? end : null;
    const ma = end && finite(end[2]) ? end[2] : null;
    const note = code === "Nordic"
      ? "Official Nord Pool system price. This is not an average of the countries."
      : (R.definition ? "Equal-weight average of the bidding zones. Not a load-weighted national price, and not the system price." : LONG[code] + " day-ahead price.");
    tell(el, "<p>" + esc(note) + "</p>");
    const fut = P.futures || {};
    const futFig = key => {
      const f = fut[key];
      const label = f && f.contract ? f.contract : key;
      const settled = f && f.as_of ? "settled " + dlab(f.as_of) : "settlement date not available yet";
      const rec = f && f.regions ? f.regions[code] : undefined;
      if (!rec || !finite(rec.p)) return fig(label, "Not available yet", esc(settled) + ". No quote is published for " + esc(LONG[code]) + ".", true, true);
      return fig(label, fmt(rec.p, 1), "€/MWh · " + esc(settled), false, true);
    };
    add(el, '<div class="figs four">' +
      fig("Latest day", day ? fmt(day[1], 1) : "Not available yet", day ? "€/MWh · " + esc(dlab(day[0])) : "", !day) +
      fig("30-day avg", ma != null ? fmt(ma, 1) : "Not available yet", ma != null ? "trailing 30 days · €/MWh" : esc(gapNote(rows)), ma == null) +
      futFig("front_month") + futFig("next_quarter") + "</div>");
    if (rows.length && rows.some(r => finite(r[1]) || finite(r[2]))) {
      add(el, '<div class="plot"></div>' + leg([{ k: "dot", c: "#9aa6b8", t: "Daily" }, { k: "line", c: "#e8c56b", t: "30-day avg" }]));
      mountChart(el.querySelector(".plot"), {
        dates: rows.map(r => r[0]),
        aria: "Day-ahead price, daily dots and 30-day average",
        yLeft: "€/MWh", floorZero: true,
        xlab: i => dlab(rows[i][0]).replace(/ \d{4}$/, ""),
        series: [
          { name: "30-day", color: "#e8c56b", width: 2.3, vals: rows.map(r => finite(r[2]) ? r[2] : null) },
          { name: "Day", color: "#9aa6b8", dots: true, width: 0, vals: rows.map(r => finite(r[1]) ? r[1] : null) }
        ],
        readout: i => "<b>" + esc(dlab(rows[i][0])) + "</b> · day " + (fmt(rows[i][1], 1) || "not available yet") + " €/MWh · 30-day " + (fmt(rows[i][2], 1) || "not available yet")
      });
    } else add(el, na());
    const span = rows.length ? dlab(rows[0][0]) + " – " + dlab(rows[rows.length - 1][0]) : "";
    tell(el, "<p>" + esc(span) + ". €/MWh. No historical price normal is published in this file, so the chart has no normal line. " + esc(P.source || "") + ".</p>");
    seal(el);
  }

  function weatherBlock(root, data, metric) {
    const meta = {
      wind100: { id: "wind", title: "Wind at 100 m", unit: "m/s", color: "#2dd4bf", kind: "pct", about: "ERA5 daily mean wind speed at 100 m. It is not a 10 m wind and it is not scaled up from 10 m." },
      temp: { id: "temp", title: "Temperature", unit: "°C", color: "#fb7185", kind: "deg", about: "ERA5 daily mean temperature at 2 m. The comparison is in degrees, not a percent." },
      rain: { id: "rain", title: "Rain", unit: "mm/day", color: "#5bc0eb", kind: "pct", about: "ERA5 daily precipitation." }
    }[metric];
    const W = data.weather, code = state.region;
    const el = block(root, meta.id, meta.title + " · " + LONG[code], "");
    if (!W || !W.regions || !W.regions[code]) { add(el, na(meta.title + " is not available yet.")); return; }
    const M = W.regions[code].metrics[metric];
    el.querySelector(".asof").textContent = "as of " + (dlab(M.as_of) || "date not available yet");
    const rows = twoMonth(M.rows, M.as_of);
    const end = rows.filter(r => r[0] === M.as_of).pop() || rows[rows.length - 1];
    const sum = M.summary || {};
    const win = "30-day avg vs 2006–2025 normal (same dates)";
    const delta = finite(sum.normal) ? (meta.kind === "deg" ? signed(sum.difference, " °C") : signed(sum.difference_pct, "%")) : null;
    tell(el, "<p>" + esc(meta.about) + " Normal is the 2006–2025 average of the same calendar dates. " + esc(W.grid || "Coarse land-area grid, not a dense national average.") + "</p>");
    add(el, '<div class="figs three">' +
      fig("Latest day", end && finite(end[1]) ? fmt(end[1], 1) : "Not available yet", end && finite(end[1]) ? esc(meta.unit) + " · " + esc(dlab(end[0])) : "", !(end && finite(end[1]))) +
      fig("30-day avg", finite(sum.value) ? fmt(sum.value, 1) : "Not available yet", finite(sum.value) ? esc(meta.unit) + " · " + esc(win) : "", !finite(sum.value)) +
      fig("2006–2025 normal", finite(sum.normal) ? fmt(sum.normal, 1) : "Not available yet", finite(sum.normal) ? "same dates" + (delta ? " · " + esc(delta) : "") : "", !finite(sum.normal), true) +
      "</div>");
    if (rows.some(r => finite(r[1]) || finite(r[2]) || finite(r[3]))) {
      add(el, '<div class="plot"></div>' + leg([
        { k: "dot", c: meta.color, t: "Daily" },
        { k: "line", c: meta.color, t: "30-day avg" },
        { k: "dash", t: "2006–2025 normal (same dates)" }
      ]));
      mountChart(el.querySelector(".plot"), {
        dates: rows.map(r => r[0]),
        aria: meta.title + " daily, 30-day average and 2006 to 2025 normal",
        yLeft: meta.unit, floorZero: metric !== "temp",
        xlab: i => dlab(rows[i][0]).replace(/ \d{4}$/, ""),
        series: [
          { name: "Normal", color: "#f4f7fb", width: 1.6, dash: "4 3", labelEnd: true, vals: rows.map(r => finite(r[4]) ? r[4] : null) },
          { name: "30-day", color: meta.color, width: 2.3, vals: rows.map(r => finite(r[2]) ? r[2] : null) },
          { name: "Day", color: meta.color, dots: true, width: 0, vals: rows.map(r => finite(r[1]) ? r[1] : null) }
        ],
        readout: i => {
          const r = rows[i];
          const tail = meta.kind === "deg" ? "" : "";
          return "<b>" + esc(dlab(r[0])) + "</b> · day " + (fmt(r[1], 1) || "not available yet") + " · 30-day " + (fmt(r[2], 1) || "not available yet") + " · normal " + (fmt(r[4], 1) || "not available yet") + " " + esc(meta.unit) + tail;
        }
      });
    } else add(el, na());
    const bars = ORDER.map(c => {
      const sm = W.regions[c] && W.regions[c].metrics[metric] && W.regions[c].metrics[metric].summary || {};
      return { code: c, name: LONG[c], value: finite(sm.value) ? sm.value : null, normal: finite(sm.normal) ? sm.normal : null, difference: finite(sm.difference) ? sm.difference : null, pct: metric === "temp" ? null : (finite(sm.difference_pct) ? sm.difference_pct : null) };
    });
    add(el, '<p class="win">' + esc(win) + "</p>" + cmpHTML(bars, meta.unit, meta.kind, meta.color, win));
    tell(el, "<p>White tick on each bar is the normal. " + (rows.length ? esc(dlab(rows[0][0]) + " – " + dlab(rows[rows.length - 1][0])) + ". " : "") + esc(W.source || "") + ".</p>");
    seal(el);
  }

  function generationBlock(root, data) {
    const G = data.generation, code = state.region;
    const el = block(root, "generation", "Generation against history · " + LONG[code], "");
    if (!G || !G.regions || !G.regions[code]) { add(el, na("Generation is not available yet.")); return; }
    const reg = G.regions[code];
    el.querySelector(".asof").textContent = "generation as of " + (dlab(reg.as_of) || "date not available yet");
    const genWin = "30-day avg vs earlier years (same dates, from 2015)";
    tell(el, "<p>Wind is a load factor: output divided by the capacity of that day. Hydro is reservoir plus run-of-river, without pumped storage. Nuclear availability is what the market messages say is available, not metered output. The history line is the same 30 days in earlier years since 2015, not the 2006–2025 weather normal.</p>");

    add(el, "<h3>Wind load factor</h3>");
    add(el, '<p class="win">' + esc(genWin) + "</p>");
    const pendingNordic = seGap(G);
    add(el, '<ul class="cap-list">' + ORDER.map(c => {
      const metric = G.regions[c].metrics.wind_load_factor;
      const last = metric.rows[metric.rows.length - 1];
      const pending = c === "Nordic" || c === "SE" ? pendingNordic : (!G.capacity_latest[c] || !finite(G.capacity_latest[c].wind_mw) || /not used for current/i.test(G.capacity_latest[c].status || ""));
      let line;
      if (pending) line = "<b>Capacity data pending</b>";
      else if (last && finite(last[2])) {
        const normal = last[4] >= 3 && finite(last[3]) ? last[3] : null;
        line = "<b>" + fmt(last[2], 1) + "%</b>" + (normal == null ? "" : " · normal " + fmt(normal, 1) + "% · " + signed(last[2] - normal, " pp"));
      } else if (last && finite(last[1])) line = "<b>30-day average not available yet</b> · latest day " + fmt(last[1], 1) + "% on " + esc(dlab(last[0]));
      else line = "<b>Not available yet</b>";
      const cap = c === "Nordic" ? "Nordic load factor needs every country. Sweden’s current capacity is missing, so the system figure is not calculated." : (pending ? "Current capacity is not published, so no load factor is shown." : capLine(G.capacity_latest[c]));
      const when = pending ? "" : " · series as of " + esc(dlab(metric.as_of) || "not available yet");
      return "<li" + (c === code ? ' class="is-on"' : "") + "><b>" + esc(LONG[c]) + "</b> · " + line + "<small>" + cap + when + "</small></li>";
    }).join("") + "</ul>");

    const wind = reg.metrics.wind_load_factor;
    const windPending = code === "Nordic" || code === "SE" ? pendingNordic : false;
    if (windPending) add(el, na("Capacity data pending. No current load factor is drawn for " + LONG[code] + "."));
    else drawGenChart(el, wind, "%", "#2dd4bf", true);

    add(el, "<h3>Hydro</h3><p class=\"win\">" + esc(genWin) + "</p>");
    const hydro = reg.metrics.hydro;
    if (!hydro.rows.some(r => finite(r[1]) || finite(r[2]))) add(el, na("Hydro generation is not available yet" + (code === "DK" ? ". Denmark has no material reported hydro series in this file" : "") + "."));
    else drawGenChart(el, hydro, "MW", "#7aa2ff", true);

    add(el, "<h3>Nuclear</h3>");
    add(el, '<p class="win">Daily generation. No 30-day average. Dashed line: earlier years, same 30 days (from 2015).</p>');
    const NA = G.nuclear_availability || {};
    const countries = code === "Nordic" ? ["SE", "FI"] : [code];
    if (code === "NO" || code === "DK") add(el, na("Not available yet. No nuclear fleet is published for " + LONG[code] + "."));
    else {
      const inst = countries.every(c => finite((NA.installed_mw || {})[c])) ? countries.reduce((s, c) => s + NA.installed_mw[c], 0) : null;
      const on = countries.every(c => finite((NA.online_mw || {})[c])) ? countries.reduce((s, c) => s + NA.online_mw[c], 0) : null;
      if (inst == null || on == null) add(el, na("Nuclear availability is not available yet."));
      else {
        const pct = inst ? on / inst * 100 : null;
        add(el, '<div class="avail"><span class="fig-l">Available ' + esc(code === "Nordic" ? "Sweden + Finland" : LONG[code]) + " · as of " + esc(dlab(NA.as_of) || "date not available yet") + '</span><b>' + fmt(on, 1) + '</b> <span>MW online of ' + fmt(inst, 1) + " installed" + (pct == null ? "" : " · " + fmt(pct, 1) + "%") + '</span><span class="track"><i style="left:0;width:' + Math.max(0, Math.min(100, pct || 0)).toFixed(1) + '%;background:#fb923c"></i></span></div>');
      }
      const out = (NA.reactors_out || []).filter(r => code === "Nordic" || r.c === code);
      if (!out.length) add(el, '<p class="note">No reactors are reported out.</p>');
      else add(el, '<ul class="outages">' + out.map(r => {
        const reduced = finite(r.now) && r.now > 0;
        return "<li><b>" + esc(r.n) + "</b> · " + esc(r.c) + " · " + (fmt(r.now, 1) || "not available yet") + " of " + (fmt(r.cap, 1) || "–") + " MW " + (reduced ? "reduced" : "out") + "<small>" + (r.planned ? "Planned" : "Unplanned") + " · back " + esc(dlab((r.back || "").slice(0, 10)) || "date not available yet") + (r.why ? " · " + esc(r.why) : "") + "</small></li>";
      }).join("") + "</ul>");
    }
    const nuc = reg.metrics.nuclear;
    if (nuc.rows.some(r => finite(r[1]))) drawGenChart(el, nuc, "MW", "#fb923c", false);
    else if (code !== "NO" && code !== "DK") add(el, na("Metered nuclear generation is not available yet."));
    tell(el, "<p>" + esc(G.source || "") + ". " + esc(G.history_normal || "") + " Availability: " + esc(NA.source || "") + ". " + esc(NA.definition || "") + "</p>");
    seal(el);
  }
  function drawGenChart(el, metric, unit, color, withMa) {
    const rows = twoMonth(metric.rows, metric.as_of || (metric.rows[metric.rows.length - 1] || [])[0]);
    if (!rows.some(r => finite(r[1]) || (withMa && finite(r[2])) || (finite(r[3]) && r[4] >= 3))) { add(el, na()); return; }
    const host = document.createElement("div");
    host.className = "plot";
    el.appendChild(host);
    add(el, leg([
      { k: "dot", c: color, t: "Daily" },
      withMa ? { k: "line", c: color, t: "30-day average" } : null,
      { k: "dash", t: "Earlier years, same 30 days (from 2015)" }
    ].filter(Boolean)));
    const series = [
      { name: "History", color: "#f4f7fb", width: 1.6, dash: "4 3", labelEnd: true, vals: seriesOf(rows, 3, 4) }
    ];
    if (withMa) series.push({ name: "30-day", color: color, width: 2.3, vals: rows.map(r => finite(r[2]) ? r[2] : null) });
    series.push({ name: "Day", color: color, dots: true, width: 0, vals: rows.map(r => finite(r[1]) ? r[1] : null) });
    mountChart(host, {
      dates: rows.map(r => r[0]),
      aria: unit === "%" ? "Wind load factor" : "Generation",
      yLeft: unit, floorZero: unit === "%",
      xlab: i => dlab(rows[i][0]).replace(/ \d{4}$/, ""),
      series: series,
      readout: i => {
        const r = rows[i];
        const hist = r[4] >= 3 && finite(r[3]) ? fmt(r[3], 1) : null;
        return "<b>" + esc(dlab(r[0])) + "</b> · day " + (fmt(r[1], 1) || "not available yet") + (withMa ? " · 30-day " + (fmt(r[2], 1) || "not available yet") : "") + " · history " + (hist || "not available yet") + " " + esc(unit);
      }
    });
    if (withMa) {
      const note = gapNote(rows);
      if (note) add(el, '<p class="note">' + esc(note) + "</p>");
    }
  }

  function hydroBlock(root, data) {
    const H = data.hydrology, code = state.region;
    const el = block(root, "hydro", "Hydrology · " + LONG[code], "");
    if (!H) { add(el, na("Hydrology is not available yet.")); return; }
    el.querySelector(".asof").textContent = "file as of " + (dlab(H.as_of) || "date not available yet");
    add(el, na("Snowpack vs normal is not available yet."));
    tell(el, "<p>Reservoir anomaly is reservoir storage only, not the full hydro balance. Snowpack is not in this file.</p>");
    const keys = code === "Nordic" ? ["NO", "SE", "FI"] : code === "DK" ? [] : [code];
    if (!keys.length) add(el, na("Denmark’s reservoirs are not a meaningful Nordic hydro block, so they are not shown."));
    else {
      if (code === "Nordic") {
        add(el, '<p class="note">Shown separately. Norway is % full. Sweden and Finland are TWh.</p>');
        tell(el, "<p>No single Nordic reservoir series is published. Sweden and Finland have no matched capacity, so they are not shown as percent full.</p>");
      }
      keys.forEach(k => reservoirCard(el, H.reservoirs[k], k));
    }
    add(el, "<h3>Monthly inflow</h3>");
    const inflowKey = code === "Nordic" ? "NOSE" : code;
    const inf = (H.monthly_inflow || {})[inflowKey];
    if (!inf) add(el, na((code === "FI" ? "Finland" : code === "DK" ? "Denmark" : LONG[code]) + " monthly inflow is not available yet."));
    else {
      const rows = inf.rows.slice(-13);
      const inflowWin = ((inf.baseline || [2021, 2025]).join("–")) + " normal";
      add(el, '<p class="win">vs ' + esc(inflowWin) + " · " + esc(inf.unit || "TWh/month") + " · as of " + esc(dlab(inf.as_of) || "not available yet") + (code === "Nordic" ? ". Norway + Sweden. Finland is not in this inflow." : "") + "</p>");
      const host = document.createElement("div");
      host.className = "plot";
      el.appendChild(host);
      barLineChart(host, {
        keys: rows.map(r => r[0]),
        bars: rows.map(r => finite(r[1]) ? r[1] : null),
        line: rows.map(r => finite(r[2]) ? r[2] : null),
        color: "#7aa2ff",
        unit: inf.unit || "TWh",
        aria: "Monthly inflow and the normal"
      });
      add(el, leg([{ k: "line", c: "#7aa2ff", t: "Inflow" }, { k: "dash", t: inflowWin }]));
      add(el, '<ul class="mini">' + rows.slice(-3).map(r => {
        const pct = finite(r[1]) && finite(r[2]) && r[2] !== 0 ? signed((r[1] / r[2] - 1) * 100, "%") : null;
        return "<li><span>" + esc(mlab(r[0])) + "</span><b>" + (fmt(r[1], 1) || "not available yet") + " · normal " + (fmt(r[2], 1) || "not available yet") + (pct ? " · " + pct : "") + "</b></li>";
      }).join("") + "</ul>");
      tell(el, "<p>Snapshot through " + esc(dlab(inf.as_of) || "") + (inf.stale_snapshot ? ", assembled " + esc(dlab(inf.stale_snapshot.slice(0, 10))) : "") + ". " + esc(inf.method || "") + "</p>");
    }
    seal(el);
  }
  function reservoirCard(el, R, code) {
    if (!R) { add(el, na(LONG[code] + " reservoirs are not available yet.")); return; }
    const fill = (R.columns || []).indexOf("fill_pct");
    const store = (R.columns || []).indexOf("storage_twh");
    const useFill = fill >= 0;
    const valIdx = useFill ? fill : store;
    const unit = useFill ? "% full" : "TWh";
    const end = R.as_of;
    const rows = twoMonth(R.rows, end);
    const band = {};
    (R.band || []).forEach(b => { band[b[0]] = b; });
    const pts = rows.map(r => {
      const b = band[isoWeek(r[0])] || [];
      return { date: r[0], val: finite(r[valIdx]) ? r[valIdx] : null, min: finite(b[1]) ? b[1] : null, med: finite(b[2]) ? b[2] : null, max: finite(b[3]) ? b[3] : null };
    });
    const bal = R.reservoir_balance_twh || {};
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = '<div class="subh"><h3>' + esc(LONG[code]) + " reservoir</h3><p>as of " + esc(dlab(R.as_of) || "not available yet") + " · " + esc(R.unit || unit) + "</p></div>";
    const split = document.createElement("div");
    split.className = "split";
    const plot = document.createElement("div");
    plot.className = "plot";
    const side = document.createElement("div");
    const diff = finite(bal.difference) ? signed(bal.difference, " TWh") : null;
    const bandWin = /2006/.test(R.band_period || "") ? "2006–2025 normal (same week)" : "2015–2025 median (same week)";
    side.innerHTML = '<div class="tile"><span class="fig-l as-is">Reservoir only · vs ' + esc(bandWin) + '</span><b>' + (diff || "Not available yet") + '</b><span class="sub">Stored ' + (fmt(bal.value, 1) || "not available yet") + " TWh · normal " + (fmt(bal.normal, 1) || "not available yet") + " TWh</span></div>";
    split.appendChild(plot);
    split.appendChild(side);
    card.appendChild(split);
    card.insertAdjacentHTML("beforeend", leg([
      { k: "dot", c: "#7aa2ff", t: "Weekly reading" },
      { k: "dash", t: bandWin },
      { k: "line", c: "rgba(79,124,255,.45)", t: "Min–max band" }
    ]));
    tell(el, "<p>" + esc(LONG[code]) + ": " + esc(R.band_period || "historical band") + (R.source ? " · " + esc(R.source) : "") + ". Weekly readings, so there is no 30-day average.</p>");
    el.appendChild(card);
    bandChart(plot, pts, unit);
  }

  function indexOf(months, m) { return months.indexOf(m); }
  function avgOf(arr, months, month, years) {
    const v = [];
    for (let y = years[0]; y <= years[1]; y++) {
      const i = indexOf(months, y + month.slice(4));
      if (i >= 0 && finite(arr[i])) v.push(arr[i]);
    }
    if (v.length < 3) return null;
    return { avg: v.reduce((s, x) => s + x, 0) / v.length, min: Math.min(...v), max: Math.max(...v), n: v.length };
  }
  function reported(gen, types) { return types.filter(k => (gen[k] || []).some(finite)); }
  function totalArr(gen, types, n) {
    const use = reported(gen, types);
    const o = [];
    for (let i = 0; i < n; i++) {
      let s = 0, ok = use.length > 0;
      for (const k of use) {
        if (!finite(gen[k][i])) { ok = false; break; }
        s += gen[k][i];
      }
      o.push(ok ? s : null);
    }
    return o;
  }

  function monthlyBlock(root, data) {
    const M = data.monthly;
    const el = block(root, "monthly", "Month against history", "");
    if (!M || !M.snapshots || !M.snapshots.nordic_monthly) { add(el, na("The monthly snapshot is not available yet.")); return; }
    const nm = M.snapshots.nordic_monthly;
    const months = nm.months.slice();
    if (!state.month || !months.includes(state.month)) state.month = nm.last;
    const month = state.month;
    el.querySelector(".asof").textContent = "snapshot as of " + (dlab(M.as_of) || "date not available yet") + (M.stale ? " · stale" : "");
    tell(el, "<p>Same controls as the live monthly section: region and month. Figures are to 1 decimal. This copy is the published snapshot, not a new fetch. " + esc(M.note || "") + "</p>");
    tell(el, "<p>The older Nordic climate snapshot is hidden. It uses a different normal and grid. Wind on the daily blocks above is 100 m.</p>");
    add(el, '<div class="tools"><div class="chips" role="group" aria-label="Region">' + ORDER.map(c => '<button type="button" class="chip' + (c === state.region ? " is-on" : "") + '" data-region="' + c + '">' + (c === "Nordic" ? "Nordic" : c) + '</button>').join("") + '</div><label>Month <select id="monthPick">' + months.map(m => '<option value="' + m + '"' + (m === month ? " selected" : "") + ">" + esc(MONL[+m.slice(5) - 1] + " " + m.slice(0, 4)) + "</option>").join("") + '</select></label><button type="button" class="textbtn' + (state.year ? " is-on" : "") + '" id="yearToggle">' + (state.year ? "Hide Jan–Dec" : "Jan–Dec") + "</button></div>");

    const code = state.region;
    const gen = nm.gen[code];
    const i = indexOf(nm.months, month);
    const years = nm.avg_years || [2021, 2025];
    add(el, "<h3>Generation · " + esc(mlab(month)) + " · " + esc(LONG[code]) + "</h3>");
    if (!gen || i < 0) add(el, na("Generation for " + mlab(month) + " is not available yet in this snapshot. The last complete month on file is " + mlab(nm.last) + "."));
    else {
      const ly = (+month.slice(0, 4) - 1) + month.slice(4);
      const ily = indexOf(nm.months, ly);
      add(el, '<div class="glyphs five" id="fuelGlyphs"></div>');
      const host = el.querySelector("#fuelGlyphs");
      FUEL.forEach(([k, name, color]) => {
        const stat = avgOf(gen[k], nm.months, month, years);
        const val = finite(gen[k][i]) ? gen[k][i] : null;
        const prev = ily >= 0 && finite(gen[k][ily]) ? gen[k][ily] : null;
        const cell = document.createElement("div");
        cell.className = "glyph";
        cell.innerHTML = '<div class="glyph-h"><b>' + esc(name) + '</b><span>TWh</span></div><div class="gsvg"></div><div class="glyph-v">' + (val == null ? "Not available yet" : fmt(val, 1)) + '</div><div class="glyph-s">vs ' + years[0] + "–" + years[1] + " same month · " + esc(mlab(ly)) + " " + (prev == null ? "not available yet" : fmt(prev, 1)) + "</div>";
        host.appendChild(cell);
        rangeGlyph(cell.querySelector(".gsvg"), { min: stat && stat.min, max: stat && stat.max, avg: stat && stat.avg, val: val, color: color, label: name });
      });
      const missing = FUEL.filter(([k]) => !reported(gen, [k]).length).map(([, n]) => n);
      add(el, '<p class="win">Dashed line: ' + years[0] + "–" + years[1] + " same-month average</p>");
      tell(el, "<p>Diamond is " + esc(mlab(month)) + ". The number beside the dashed line is the " + years[0] + "–" + years[1] + " average of that month. The bar is the min–max of those years." + (missing.length ? " " + esc(missing.join(" and ")) + " is not in this country’s file, so it is not shown as zero." : "") + "</p>");
      if (state.year) yearChart(el, nm, code, month, years);
    }

    const infKey = code === "Nordic" ? "NOSE" : code;
    const inf = (nm.inflow || {})[infKey];
    add(el, "<h3>Inflow vs " + years[0] + "–" + years[1] + " same month</h3>");
    if (!inf) add(el, na((code === "Nordic" ? "A Nordic total including Finland" : LONG[code]) + " inflow is not available yet."));
    else if (i < 0) add(el, na("Inflow for " + mlab(month) + " is not available yet."));
    else {
      const stat = avgOf(inf, nm.months, month, years);
      const val = finite(inf[i]) ? inf[i] : null;
      add(el, '<div class="glyphs"><div class="glyph" id="infGlyph"><div class="glyph-h"><b>' + esc(code === "Nordic" ? "Norway + Sweden" : LONG[code]) + '</b><span>TWh</span></div><div class="gsvg"></div><div class="glyph-v">' + (val == null ? "Not available yet" : fmt(val, 1)) + '</div><div class="glyph-s">vs ' + years[0] + "–" + years[1] + " same month" + (code === "Nordic" ? ". Finland is not in this inflow." : "") + "</div></div></div>");
      rangeGlyph(el.querySelector("#infGlyph .gsvg"), { min: stat && stat.min, max: stat && stat.max, avg: stat && stat.avg, val: val, color: "#7aa2ff", label: "Inflow" });
    }

    add(el, "<h3>Day-ahead prices this month</h3>");
    const pi = indexOf(nm.price_months, month);
    const want = code === "Nordic" ? nm.price_zones.slice() : (ZONE[code] || []);
    const have = want.filter(z => nm.prices[z]);
    const missing = code === "Nordic" ? [] : want.filter(z => !nm.prices[z]);
    if (pi < 0) add(el, na("Prices for " + mlab(month) + " are not available yet. This snapshot’s prices run " + mlab(nm.price_months[0]) + " – " + mlab(nm.price_months[nm.price_months.length - 1]) + "."));
    else add(el, '<div class="figs">' + have.map(z => {
      const v = nm.prices[z][pi];
      return fig(z, finite(v) ? fmt(v, 1) : "Not available yet", finite(v) ? "€/MWh" : "", !finite(v));
    }).join("") + "</div>" + (missing.length ? '<p class="note">' + esc(missing.join(", ")) + " not available yet in this snapshot.</p>" : ""));

    seal(el);
  }
  function yearChart(el, nm, code, month, years) {
    const gen = nm.gen[code];
    const Y = +month.slice(0, 4);
    const totals = totalArr(gen, nm.types, nm.months.length);
    const keys = [];
    for (let m = 1; m <= 12; m++) keys.push(Y + "-" + String(m).padStart(2, "0"));
    const at = k => { const i = indexOf(nm.months, k); return i >= 0 ? totals[i] : null; };
    const bars = keys.map(at);
    const last = keys.map(k => at((Y - 1) + k.slice(4)));
    const avg = keys.map(k => { const s = avgOf(totals, nm.months, k, years); return s ? s.avg : null; });
    add(el, "<h3>Jan–Dec " + Y + " · sum of reported types · " + esc(LONG[code]) + "</h3>");
    const host = document.createElement("div");
    host.className = "plot";
    el.appendChild(host);
    const mark = +month.slice(5) - 1;
    watch(host, w => {
      const n = 12, h = w < 480 ? 200 : 230, L = 40, R = 36, T = 16, B = 22;
      const W = Math.max(w, L + R + 120), iw = W - L - R, ih = h - T - B;
      const vals = bars.concat(last, avg).filter(finite);
      if (!vals.length) { host.innerHTML = na(); return; }
      let lo = 0, hi = Math.max(...vals);
      hi += (hi - lo) * 0.14 || 1;
      const tk = ticks(lo, hi, 4); lo = tk[0]; hi = tk[tk.length - 1];
      const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * iw;
      const Yv = v => T + ih - (v - lo) / (hi - lo) * ih;
      const slot = iw / n;
      let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="January to December generation">';
      tk.forEach(v => {
        const y = Yv(v);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
        s += '<text x="' + (L - 4) + '" y="' + (y + 3) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(fmt(v, hi < 30 ? 1 : 0)) + "</text>";
      });
      bars.forEach((v, i) => {
        if (!finite(v)) return;
        const x = L + i * slot + slot * 0.22, bw = slot * 0.56;
        s += '<rect x="' + x.toFixed(1) + '" y="' + Yv(v).toFixed(1) + '" width="' + Math.max(1, bw).toFixed(1) + '" height="' + Math.max(0, Yv(0) - Yv(v)).toFixed(1) + '" rx="2" fill="' + (i === mark ? "#4f7cff" : "#7aa2ff") + '" opacity="' + (i === mark ? "1" : ".55") + '"/>';
      });
      const line = (arr, color, width, dash) => {
        let d = "", pen = false;
        arr.forEach((v, i) => {
          if (!finite(v)) { pen = false; return; }
          d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Yv(v).toFixed(1);
          pen = true;
        });
        if (d) s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + "/>";
      };
      line(last, "#8b95a8", 1.4, "");
      line(avg, "#f4f7fb", 1.8, "4 3");
      if (finite(avg[mark])) {
        const y = Math.max(T + 8, Yv(avg[mark]) - 6);
        s += '<text x="' + X(mark).toFixed(1) + '" y="' + y.toFixed(1) + '" fill="#f4f7fb" font-size="12" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="#111722" stroke-width="3">' + esc(fmt(avg[mark], 1)) + "</text>";
      }
      keys.forEach((k, i) => {
        s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + MON[i].slice(0, 1) + "</text>";
      });
      s += "</svg>";
      host.innerHTML = '<p class="readout"></p>' + s + leg([{ k: "line", c: "#4f7cff", t: String(Y) }, { k: "line", c: "#8b95a8", t: String(Y - 1) }, { k: "dash", t: years[0] + "–" + years[1] + " same-month average" }]).replace('class="leg"', 'class="leg" style="margin-top:4px"');
      const rd = host.querySelector(".readout");
      const show = i => { rd.innerHTML = "<b>" + MONL[i] + " " + Y + "</b> · " + (fmt(bars[i], 1) || "not available yet") + " · " + (Y - 1) + " " + (fmt(last[i], 1) || "not available yet") + " · average " + (fmt(avg[i], 1) || "not available yet") + " TWh"; };
      show(mark);
      host.querySelector("svg").addEventListener("pointermove", e => {
        const r = host.querySelector("svg").getBoundingClientRect();
        const t = (e.clientX - r.left) / r.width;
        show(Math.max(0, Math.min(11, Math.round(t * 11))));
      });
    });
  }

  function tomorrowBlock(root, data) {
    const T = data.tomorrow, code = state.region;
    const el = block(root, "tomorrow", "Tomorrow", "");
    if (!T) { add(el, na("The day-ahead file is not available yet.")); return; }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const word = T.delivery_date === today ? "Today" : T.delivery_date === addDaysSafe(today, 1) ? "Tomorrow" : "Delivery day";
    el.querySelector("h2").textContent = word + " · " + LONG[code];
    el.querySelector(".asof").textContent = "delivery " + (dlab(T.delivery_date) || "not available yet") + " · retrieved " + (dlab(T.as_of) || "not available yet");
    const hours = T.hours || [];
    const R = (T.regions || {})[code];
    const temp = (T.temperature || {})[code];
    tell(el, "<p>Hourly price against the wind forecast and residual load. Residual load is load minus wind minus solar, and only where all three forecasts exist. " + esc(T.timezone || "") + ". " + esc(T.source || "") + ".</p>");
    const wrap = document.createElement("div");
    wrap.className = "tom";
    const left = document.createElement("div");
    const right = document.createElement("div");
    wrap.appendChild(left);
    wrap.appendChild(right);
    el.appendChild(wrap);
    if (!R) {
      left.insertAdjacentHTML("beforeend", na("An hourly Nordic system price, wind forecast and residual load are not in this file. Country curves are not averaged into one."));
    } else {
      const windOk = R.complete && R.complete.wind_fc && (R.wind_fc || []).some(finite);
      const resOk = R.complete && R.complete.residual_load && (R.residual_load || []).some(finite);
      const loadOk = R.complete && R.complete.load_fc && (R.load_fc || []).some(finite);
      const priceOk = R.complete && R.complete.price && (R.price || []).some(finite);
      const notes = [];
      if (!windOk) notes.push("Wind forecast is not available yet.");
      if (!resOk) notes.push("Residual load is not available yet.");
      if (windOk && (R.wind_fc || []).every(v => v === 0)) notes.push("The published wind forecast is 0 MW in every hour.");
      if (notes.length) left.insertAdjacentHTML("beforeend", '<p class="note">' + esc(notes.join(" ")) + "</p>");
      const series = [];
      if (priceOk) series.push({ name: "Price", color: "#e8c56b", width: 2.2, vals: R.price });
      if (resOk) series.push({ name: "Residual", color: "#c4b5fd", width: 2, axis: "r", vals: R.residual_load });
      else if (loadOk) series.push({ name: "Load", color: "#8b95a8", width: 1.7, axis: "r", vals: R.load_fc });
      if (windOk) series.push({ name: "Wind", color: "#2dd4bf", width: 2, axis: "r", vals: R.wind_fc });
      if (series.length) {
        const host = document.createElement("div");
        host.className = "plot";
        left.appendChild(host);
        const legend = [{ k: "line", c: "#e8c56b", t: "Price €/MWh" }];
        if (windOk) legend.push({ k: "line", c: "#2dd4bf", t: "Wind forecast MW" });
        if (resOk) legend.push({ k: "line", c: "#c4b5fd", t: "Residual load MW" });
        else if (loadOk) legend.push({ k: "line", c: "#8b95a8", t: "Load forecast MW" });
        left.insertAdjacentHTML("beforeend", leg(legend));
        mountChart(host, {
          dates: hours,
          aria: "Hourly price, wind and residual load",
          yLeft: "€/MWh", yRight: "MW", floorZero: true,
          xlab: i => ["00:00", "06:00", "12:00", "18:00"].indexOf(String(hours[i] || "").slice(11, 16)) >= 0 ? String(hours[i]).slice(11, 16) : "",
          series: series,
          readout: i => {
            const h = String(hours[i] || "").slice(11, 16);
            const bits = ["<b>" + esc(h) + "</b>"];
            bits.push("price " + (priceOk && finite(R.price[i]) ? fmt(R.price[i], 1) : "not available yet"));
            bits.push("wind " + (windOk && finite(R.wind_fc[i]) ? fmt(R.wind_fc[i], 1) + " MW" : "not available yet"));
            bits.push(resOk ? "residual " + (finite(R.residual_load[i]) ? fmt(R.residual_load[i], 1) + " MW" : "not available yet") : "residual not available yet");
            return bits.join(" · ");
          }
        });
      }
    }
    const tile = document.createElement("div");
    tile.className = "tile";
    right.appendChild(tile);
    if (!temp || !finite(temp.daily_mean)) tile.innerHTML = '<span class="fig-l as-is">Delivery-day mean vs 2006–2025 normal</span>' + na("Temperature is not available yet.");
    else {
      let normal = finite(temp.daily_normal) ? temp.daily_normal : null;
      if (normal == null && data.weather_normals && data.weather_normals.regions && data.weather_normals.regions[code] && T.delivery_date) {
        const key = T.delivery_date.slice(5);
        const row = data.weather_normals.regions[code].find(r => r[0] === key);
        if (row && finite(row[2])) normal = row[2];
      }
      const diff = finite(temp.difference_degC) ? temp.difference_degC : (normal == null ? null : temp.daily_mean - normal);
      tile.innerHTML = '<span class="fig-l as-is">Delivery-day mean vs 2006–2025 normal</span><b>' + fmt(temp.daily_mean, 1) + ' °C</b><span class="sub">normal ' + (fmt(normal, 1) || "not available yet") + " °C" + (diff == null ? "" : " · " + signed(diff, " °C")) + "</span><div class=\"plot\"></div>";
      tell(el, "<p>" + esc(temp.note || "Forecast local-day mean against the 2006–2025 normal.") + "</p>");
      const hourly = temp.hourly || [];
      if (hourly.some(finite) && normal != null) {
        mountChart(tile.querySelector(".plot"), {
          dates: hourly.map((_, i) => String(i)),
          aria: "Hourly temperature and the daily normal",
          yLeft: "°C", floorZero: false,
          xlab: i => i % 6 === 0 && hours[i] ? String(hours[i]).slice(11, 13) : "",
          series: [
            { name: "Normal", color: "#f4f7fb", width: 1.6, dash: "4 3", labelEnd: true, vals: hourly.map(() => normal) },
            { name: "Forecast", color: "#fb7185", width: 2, vals: hourly.map(v => finite(v) ? v : null) }
          ],
          readout: i => (hours[i] ? esc(String(hours[i]).slice(11, 16)) + " · " : "") + (fmt(hourly[i], 1) || "not available yet") + " °C · normal " + fmt(normal, 1)
        });
      }
    }
    seal(el);
  }
  function addDaysSafe(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function syncRegions() {
    document.querySelectorAll("[data-region]").forEach(b => {
      const on = b.getAttribute("data-region") === state.region;
      b.classList.toggle("is-on", on);
      if (b.getAttribute("role") === "tab") b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function render() {
    const root = document.getElementById("app");
    if (!root || !state.data) return;
    clearObs();
    root.innerHTML = "";
    const data = state.data;
    const line = document.getElementById("buildLine");
    if (line && data.manifest) {
      const man = data.manifest;
      const built = man.built_at ? man.built_at.replace("T", " ").slice(0, 16) + " Zurich" : "build time not available yet";
      line.textContent = (man.status === "partial" ? "Partial build" : "Build") + " · " + built + " · weather normal " + ((man.baseline || []).join("–") || "not available yet");
    }
    const jobs = [
      ["price", () => priceBlock(root, data)],
      ["wind", () => weatherBlock(root, data, "wind100")],
      ["temp", () => weatherBlock(root, data, "temp")],
      ["rain", () => weatherBlock(root, data, "rain")],
      ["generation", () => generationBlock(root, data)],
      ["hydro", () => hydroBlock(root, data)],
      ["monthly", () => monthlyBlock(root, data)],
      ["tomorrow", () => tomorrowBlock(root, data)]
    ];
    jobs.forEach(([name, fn]) => {
      try { fn(); }
      catch (e) {
        const el = block(root, name, name, "");
        el.dataset.error = e && e.message ? e.message : "error";
        add(el, na("Not available yet. This block could not be drawn."));
      }
    });
    syncRegions();
  }

  document.body.addEventListener("click", e => {
    const infoBtn = e.target.closest(".info");
    if (infoBtn) {
      const panel = document.getElementById(infoBtn.getAttribute("aria-controls"));
      if (!panel) return;
      const open = infoBtn.getAttribute("aria-expanded") === "true";
      infoBtn.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
      return;
    }
    const b = e.target.closest("[data-region]");
    if (b) {
      const code = b.getAttribute("data-region");
      if (code && code !== state.region) { state.region = code; render(); }
      return;
    }
    if (e.target.id === "yearToggle") { state.year = !state.year; render(); }
  });
  document.body.addEventListener("change", e => {
    if (e.target.id === "monthPick") { state.month = e.target.value; render(); }
  });

  async function load() {
    const t = Math.floor(Date.now() / 36e5);
    const out = {};
    await Promise.all(FILES.map(async name => {
      const r = await fetch(BASE + name + ".json?t=" + t);
      if (!r.ok) throw new Error(name + ".json could not be loaded (" + r.status + ")");
      out[name] = await r.json();
    }));
    return out;
  }
  const app = document.getElementById("app");
  load().then(data => { state.data = data; render(); }).catch(e => {
    if (app) app.innerHTML = na(e && e.message ? e.message : "The published files are not available yet.");
  });
})();
