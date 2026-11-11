/* Nordic power preview. Reads only MasterKano/emmi-data nordic-v2.
   Null is "not available yet", never zero. 100 m wind is never filled from a 10 m field.
   Temperature anomalies are degrees, never a percent. SE/Nordic load factor stays blank
   while Swedish current capacity is missing. */
(function () {
  "use strict";
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/nordic-v2/";
  const FILES = ["manifest", "prices", "weather", "weather_normals", "generation", "hydrology", "tomorrow", "monthly", "monthly_climate"];
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
  function watch(el, draw, min) {
    let w = -1;
    const floor = min == null ? 80 : min;
    const go = () => {
      const nw = Math.round(el.clientWidth || 0);
      if (nw < floor || nw === w) return;
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
    el.innerHTML = "";
    const readout = document.createElement("p");
    readout.className = "readout";
    const row = el.closest(".hero, .split");
    if (row) row.insertAdjacentElement("afterend", readout);
    else el.appendChild(readout);
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
    const narrow = w < 280;
    const h = Math.round(Math.max(narrow ? 136 : 150, Math.min(narrow ? 210 : 260, w * (narrow ? 1 : 0.75))));
    const right = model.series.some(s => s.axis === "r" && s.vals.some(finite));
    const endLabel = model.series.some(s => s.labelEnd);
    const L = narrow ? 32 : 46, R = right ? (narrow ? 34 : 50) : endLabel ? (narrow ? 36 : 56) : (narrow ? 6 : 12), T = 12, B = 18;
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
    const readout = document.createElement("p");
    readout.className = "readout";
    const row = el.closest(".hero, .split");
    if (row) row.insertAdjacentElement("afterend", readout);
    else el.appendChild(readout);
    watch(el, w => {
      const n = model.bars.length;
      const narrow = w < 280;
      const h = Math.round(Math.max(narrow ? 104 : 128, Math.min(210, w * 0.62))), L = narrow ? 30 : 40, R = narrow ? 28 : 42, T = 14, B = 20;
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
      el.innerHTML = s;
      const show = i => {
        const v = model.bars[i], nv = model.line[i];
        const pct = finite(v) && finite(nv) && nv !== 0 ? signed((v / nv - 1) * 100, "%") : null;
        readout.innerHTML = "<b>" + esc(mlab(model.keys[i])) + "</b> · " + (fmt(v, 1) || "not available yet") + " " + esc(model.unit) + " · normal " + (fmt(nv, 1) || "not available yet") + (pct ? " · " + pct : "");
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
    const readout = document.createElement("p");
    readout.className = "readout";
    const row = el.closest(".hero, .split");
    if (row) row.insertAdjacentElement("afterend", readout);
    else el.appendChild(readout);
    watch(el, w => {
      const n = pts.length;
      if (!n) { el.innerHTML = na(); return; }
      const narrow = w < 280;
      const h = Math.round(Math.max(narrow ? 104 : 128, Math.min(210, w * 0.62))), L = narrow ? 30 : 40, R = narrow ? 28 : 38, T = 12, B = 18;
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
      let vpath = "", penV = false;
      pts.forEach((p, i) => {
        if (!finite(p.val)) { penV = false; return; }
        vpath += (penV ? "L" : "M") + X(i).toFixed(1) + "," + Y(p.val).toFixed(1);
        penV = true;
      });
      if (vpath) s += '<path d="' + vpath + '" fill="none" stroke="#7aa2ff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
      const dot = n > 30 ? 2.1 : 3.2;
      pts.forEach((p, i) => { if (finite(p.val)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.val).toFixed(1) + '" r="' + dot + '" fill="#7aa2ff"/>'; });
      let li = -1;
      for (let i = n - 1; i >= 0; i--) if (finite(pts[i].med)) { li = i; break; }
      if (li >= 0) s += '<text x="' + Math.min(W - 2, X(li) + 8).toFixed(1) + '" y="' + (Y(pts[li].med) + 3).toFixed(1) + '" fill="#f4f7fb" font-size="11" font-weight="700">' + esc(fmt(pts[li].med, 1)) + "</text>";
      [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach(i => {
        const iso = pts[i].date;
        const lab = n > 16 ? MON[+iso.slice(5, 7) - 1] + " " + iso.slice(2, 4) : dlab(iso).replace(/ \d{4}$/, "");
        s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 5) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + esc(lab) + "</text>";
      });
      s += "</svg>";
      el.innerHTML = s;
      const show = i => {
        const p = pts[i];
        readout.innerHTML = "<b>" + esc(dlab(p.date)) + "</b> · " + (fmt(p.val, 1) || "not available yet") + " " + esc(unit) + " · median " + (fmt(p.med, 1) || "not available yet") + " · band " + (fmt(p.min, 1) || "–") + "–" + (fmt(p.max, 1) || "–");
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
      const compact = !!st.compact;
      const h = compact ? 16 : 36;
      const pts = [st.min, st.max, st.avg, st.val].filter(finite);
      if (!pts.length) { el.innerHTML = ""; return; }
      let lo = Math.min(...pts), hi = Math.max(...pts);
      if (!(hi > lo)) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08 || 1;
      lo -= pad; hi += pad;
      const L = 6, R = 6, y = compact ? 8 : 16;
      const X = v => L + (w - L - R) * (v - lo) / (hi - lo);
      const bits = [st.label || "range"];
      if (finite(st.min)) bits.push("min " + fmt(st.min, 1));
      if (finite(st.max)) bits.push("max " + fmt(st.max, 1));
      if (finite(st.avg)) bits.push("normal " + fmt(st.avg, 1));
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(bits.join(", ")) + '">';
      let a = finite(st.min) ? st.min : lo, b = finite(st.max) ? st.max : hi;
      if (finite(st.val)) { a = Math.min(a, st.val); b = Math.max(b, st.val); }
      s += '<line x1="' + X(a).toFixed(1) + '" x2="' + X(b).toFixed(1) + '" y1="' + y + '" y2="' + y + '" stroke="#3a4458" stroke-width="' + (compact ? 3 : 4) + '" stroke-linecap="round"/>';
      if (finite(st.avg)) s += '<line x1="' + X(st.avg).toFixed(1) + '" x2="' + X(st.avg).toFixed(1) + '" y1="' + (y - (compact ? 5 : 7)) + '" y2="' + (y + (compact ? 5 : 7)) + '" stroke="#f4f7fb" stroke-width="2"/>';
      if (finite(st.val)) s += '<circle cx="' + X(st.val).toFixed(1) + '" cy="' + y + '" r="' + (compact ? 3 : 4.5) + '" fill="' + (st.color || "#4f7cff") + '"/>';
      if (!compact && finite(st.min)) s += '<text x="' + X(st.min).toFixed(1) + '" y="34" fill="#8b95a8" font-size="9" text-anchor="start">' + esc(fmt(st.min, 1)) + "</text>";
      if (!compact && finite(st.max)) s += '<text x="' + X(st.max).toFixed(1) + '" y="34" fill="#8b95a8" font-size="9" text-anchor="end">' + esc(fmt(st.max, 1)) + "</text>";
      s += "</svg>";
      el.innerHTML = s;
    }, 24);
  }
  function pill(text, invert) {
    if (!text) return "";
    const neg = /^[−-]/.test(text), pos = text.charAt(0) === "+";
    let cls = neg ? "dn" : pos ? "up" : "";
    if (invert && cls) cls = cls === "dn" ? "up" : "dn";
    return '<span class="pill ' + cls + '">' + esc(text) + "</span>";
  }
  function atDate(rows, iso) {
    if (!iso || !rows) return null;
    for (let i = 0; i < rows.length; i++) if (rows[i][0] === iso) return rows[i];
    return null;
  }
  function chgItem(k, rows, end, back, idx, mode, unit, invert) {
    const now = atDate(rows, end), prev = atDate(rows, back);
    if (!now || !prev || !finite(now[idx]) || !finite(prev[idx])) return null;
    const d = now[idx] - prev[idx];
    let text = null;
    if (mode === "deg") text = signed(d, " °C");
    else if (mode === "pp") text = signed(d, " pp");
    else if (mode === "pct") { if (prev[idx] === 0) return null; text = signed(d / Math.abs(prev[idx]) * 100, "%"); }
    else text = signed(d, unit || "");
    return text ? { k: k, text: text, invert: !!invert } : null;
  }
  function chgHTML(items) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) return "";
    return '<div class="chg">' + rows.map(r => '<span class="chg-k">' + esc(r.k) + "</span>" + pill(r.text, r.invert)).join("") + "</div>";
  }
  function mondayOf(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() - (day - 1));
    return dt.toISOString().slice(0, 10);
  }
  function avgSpan(rows, idx, a, b) {
    let s = 0, n = 0;
    for (let i = 0; i < (rows || []).length; i++) {
      const r = rows[i];
      if (r[0] < a || r[0] > b || !finite(r[idx])) continue;
      s += r[idx];
      n++;
    }
    return n ? s / n : null;
  }
  function periodItem(k, rows, asOf, idx, mode, invert) {
    if (!asOf) return null;
    let curA, prevA, prevB;
    if (k === "Week") {
      curA = mondayOf(asOf);
      prevB = addDaysSafe(curA, -1);
      prevA = addDaysSafe(curA, -7);
    } else {
      curA = asOf.slice(0, 8) + "01";
      prevB = addDaysSafe(curA, -1);
      prevA = prevB.slice(0, 8) + "01";
    }
    const cur = avgSpan(rows, idx, curA, asOf);
    const prev = avgSpan(rows, idx, prevA, prevB);
    if (cur == null || prev == null) return null;
    let text = null;
    if (mode === "deg") text = signed(cur - prev, " °C");
    else if (prev === 0) return null;
    else text = signed((cur / prev - 1) * 100, "%");
    return text ? { k: k, text: text, invert: !!invert } : null;
  }
  function maLine(label, value, unit, color) {
    if (value == null) return "";
    return '<div class="ma-line"><span class="hero-k">' + esc(label) + '</span><b style="color:' + color + '">' + value + (unit ? "<small> " + esc(unit) + "</small>" : "") + "</b></div>";
  }

  function cmpHTML(rows, unit, kind, color, windowLabel) {
    const nums = rows.flatMap(r => [r.value, r.normal]).filter(finite);
    if (!nums.length) return na();
    const lo = Math.min(0, ...nums), hi = Math.max(...nums), span = (hi - lo) || 1;
    const pos = v => (v - lo) / span * 100;
    return '<div class="cmp" style="--c:' + color + '">' + rows.map(r => {
      const on = r.code === state.region ? " is-on" : "";
      if (!finite(r.value)) return '<div class="cmp-r' + on + '"><span class="cmp-n">' + esc(r.name) + '</span><span class="na">Not available yet</span></div>';
      let delta = "Not available yet";
      if (kind === "deg" && finite(r.difference)) delta = signed(r.difference, " °C");
      else if (kind === "pp" && finite(r.normal)) delta = signed(r.value - r.normal, " pp");
      else if (kind === "pct" && finite(r.pct)) delta = signed(r.pct, "%");
      const x0 = pos(Math.min(0, r.value)), x1 = pos(Math.max(0, r.value));
      const tick = finite(r.normal) ? '<b style="left:' + pos(r.normal).toFixed(1) + '%"></b>' : "";
      return '<div class="cmp-r' + on + '"><span class="cmp-n">' + esc(r.name) + '</span><span class="track"><i style="left:' + x0.toFixed(1) + "%;width:" + Math.max(0.8, x1 - x0).toFixed(1) + '%"></i>' + tick + '</span><span class="cmp-v">' + fmt(r.value, 1) + "<small> " + esc(unit) + "</small></span>" + pill(delta === "Not available yet" ? "" : delta) + "</div>";
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
    const futBit = key => {
      const f = fut[key];
      const label = f && f.contract ? f.contract : key;
      const settled = f && f.as_of ? dlab(f.as_of) : "";
      const rec = f && f.regions ? f.regions[code] : undefined;
      if (!rec || !finite(rec.p)) return '<span title="' + esc(settled || "not available yet") + '"><b>' + esc(label) + '</b> <span class="na">–</span></span>';
      return '<span title="' + esc(settled ? "settled " + settled : "") + '"><b>' + esc(label) + "</b> " + fmt(rec.p, 1) + "</span>";
    };
    const asOfP = end && end[0];
    let tomNum = null;
    const Tm = data.tomorrow;
    const TR = Tm && Tm.regions && Tm.regions[code];
    if (TR && TR.complete && TR.complete.price && asOfP && Tm.delivery_date && Tm.delivery_date > asOfP) {
      const vals = (TR.price || []).filter(finite);
      if (vals.length) tomNum = fmt(vals.reduce((s, v) => s + v, 0) / vals.length, 1);
    }
    const priceMoves = asOfP ? chgHTML([
      periodItem("Week", R.rows, asOfP, 1, "pct", true),
      periodItem("Month", R.rows, asOfP, 1, "pct", true)
    ]) : "";
    const spots = '<div class="spot"><div><div class="hero-k">Today</div><div class="hero-num' + (day ? "" : " is-na") + '">' + (day ? fmt(day[1], 1) + "<small>€</small>" : "Not available yet") + "</div></div>" + (tomNum ? '<div><div class="hero-k">Tomorrow</div><div class="hero-num">' + tomNum + "<small>€</small></div></div>" : "") + "</div>";
    add(el, '<div class="hero"><div class="plot"></div><div class="hero-side"><div class="hero-read">' + spots + maLine("30-day avg", ma == null ? null : fmt(ma, 1), "€/MWh", "#e8c56b") + priceMoves + "</div></div></div>");
    add(el, '<div class="fwd">' + futBit("front_month") + futBit("next_quarter") + "<small>€/MWh</small></div>");
    if (rows.length && rows.some(r => finite(r[1]) || finite(r[2]))) {
      add(el, leg([{ k: "dot", c: "#b6a4f5", t: "Daily" }, { k: "line", c: "#e8c56b", t: "30-day avg" }]));
      mountChart(el.querySelector(".plot"), {
        dates: rows.map(r => r[0]),
        aria: "Day-ahead price, daily dots and 30-day average",
        yLeft: "€/MWh", floorZero: true,
        xlab: i => dlab(rows[i][0]).replace(/ \d{4}$/, ""),
        series: [
          { name: "30-day", color: "#e8c56b", width: 2.3, vals: rows.map(r => finite(r[2]) ? r[2] : null) },
          { name: "Day", color: "#b6a4f5", dots: true, width: 0, vals: rows.map(r => finite(r[1]) ? r[1] : null) }
        ],
        readout: i => "<b>" + esc(dlab(rows[i][0])) + "</b> · day " + (fmt(rows[i][1], 1) || "not available yet") + " €/MWh · 30-day " + (fmt(rows[i][2], 1) || "not available yet")
      });
    } else add(el, na());
    const span = rows.length ? dlab(rows[0][0]) + " – " + dlab(rows[rows.length - 1][0]) : "";
    const settled = ["front_month", "next_quarter"].map(k => {
      const f = fut[k];
      return f && f.contract ? f.contract + (f.as_of ? " settled " + dlab(f.as_of) : "") : "";
    }).filter(Boolean).join(". ");
    tell(el, "<p>" + esc(span) + ". €/MWh. Today is the latest day-ahead price. Tomorrow is the mean of the published hourly prices for the next delivery day, and only when that file has them. The 30-day average is the trailing mean. Week is this Monday-to-date average against the previous Monday–Sunday. Month is this month-to-date average against the previous calendar month. A rise is red. No historical price normal is published, so there is no normal line. " + esc(settled) + ". " + esc(P.source || "") + ".</p>");
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
    const asOfW = end && end[0];
    const dayOk = end && finite(end[1]);
    const dayLab = dayOk ? dlab(end[0]).replace(/ \d{4}$/, "") : "Latest";
    const weatherMoves = asOfW ? chgHTML([
      periodItem("Week", M.rows, asOfW, 1, meta.kind === "deg" ? "deg" : "pct", false),
      periodItem("Month", M.rows, asOfW, 1, meta.kind === "deg" ? "deg" : "pct", false)
    ]) : "";
    const bars = ORDER.map(c => {
      const sm = W.regions[c] && W.regions[c].metrics[metric] && W.regions[c].metrics[metric].summary || {};
      return { code: c, name: c === "Nordic" ? "Nordic" : c, value: finite(sm.value) ? sm.value : null, normal: finite(sm.normal) ? sm.normal : null, difference: finite(sm.difference) ? sm.difference : null, pct: metric === "temp" ? null : (finite(sm.difference_pct) ? sm.difference_pct : null) };
    });
    const read = '<div class="hero-read"><div class="hero-k">' + esc(dayLab) + '</div><div class="hero-num' + (dayOk ? "" : " is-na") + '">' + (dayOk ? fmt(end[1], 1) + "<small>" + esc(meta.unit) + "</small>" : "Not available yet") + "</div>" + maLine("30-day avg", finite(sum.value) ? fmt(sum.value, 1) : null, meta.unit, meta.color) + '<div class="hero-row">' + pill(delta) + '</div><div class="hero-vs">vs 2006–2025 normal</div>' + weatherMoves + "</div>";
    add(el, '<div class="hero"><div class="plot"></div><div class="hero-side">' + read + cmpHTML(bars, meta.unit, meta.kind, meta.color, win) + "</div></div>");
    if (rows.some(r => finite(r[1]) || finite(r[2]) || finite(r[3]))) {
      add(el, leg([
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
    tell(el, "<p>The white number is the latest day and the coloured number is the 30-day average. The pill is that average against the 2006–2025 normal for the same dates. Week is this Monday-to-date average against the previous Monday–Sunday. Month is this month-to-date average against the previous calendar month. Temperature changes are degrees. The white tick on each bar is the normal. " + (rows.length ? esc(dlab(rows[0][0]) + " – " + dlab(rows[rows.length - 1][0])) + ". " : "") + esc(W.source || "") + ".</p>");
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
        add(el, '<div class="avail"><span class="fig-l">Available ' + esc(code === "Nordic" ? "Sweden + Finland" : LONG[code]) + " · as of " + esc(dlab(NA.as_of) || "date not available yet") + '</span><b>' + fmt(on, 1) + '<small> MW</small></b><span>of ' + fmt(inst, 1) + " installed" + (pct == null ? "" : " · " + fmt(pct, 1) + "%") + '</span><span class="track"><i style="left:0;width:' + Math.max(0, Math.min(100, pct || 0)).toFixed(1) + '%;background:#fb923c"></i></span></div>');
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
    tell(el, "<p>The white number is the latest day and the coloured number is the 30-day average, when that average exists. Week is this Monday-to-date average against the previous Monday–Sunday. Month is this month-to-date average against the previous calendar month. " + esc(G.source || "") + ". " + esc(G.history_normal || "") + " Availability: " + esc(NA.source || "") + ". " + esc(NA.definition || "") + "</p>");
    seal(el);
  }
  function drawGenChart(el, metric, unit, color, withMa) {
    const rows = twoMonth(metric.rows, metric.as_of || (metric.rows[metric.rows.length - 1] || [])[0]);
    if (!rows.some(r => finite(r[1]) || (withMa && finite(r[2])) || (finite(r[3]) && r[4] >= 3))) { add(el, na()); return; }
    const end = rows[rows.length - 1];
    const ma = withMa && end && finite(end[2]) ? end[2] : null;
    const day = end && finite(end[1]) ? end[1] : null;
    const hist = end && end[4] >= 3 && finite(end[3]) ? end[3] : null;
    const head = ma != null ? ma : day;
    const delta = head != null && hist != null ? (unit === "%" ? signed(head - hist, " pp") : (hist !== 0 ? signed((head / hist - 1) * 100, "%") : null)) : null;
    const win = withMa ? "30-day avg vs earlier years (same dates, from 2015)" : "Daily vs earlier years (same dates, from 2015)";
    const host = document.createElement("div");
    host.className = "hero";
    const plot = document.createElement("div");
    plot.className = "plot";
    const side = document.createElement("div");
    side.className = "hero-read";
    const asOfG = end && end[0];
    const gMode = unit === "%" ? "pp" : "pct";
    const genMoves = asOfG ? chgHTML([
      periodItem("Week", metric.rows, asOfG, 1, gMode, false),
      periodItem("Month", metric.rows, asOfG, 1, gMode, false)
    ]) : "";
    const gLab = end && day != null ? dlab(end[0]).replace(/ \d{4}$/, "") : "Latest";
    side.innerHTML = '<div class="hero-k">' + esc(gLab) + '</div><div class="hero-num' + (day == null ? " is-na" : "") + '">' + (day == null ? "Not available yet" : fmt(day, 1) + "<small>" + esc(unit) + "</small>") + "</div>" + maLine("30-day avg", ma == null ? null : fmt(ma, 1), unit, color) + '<div class="hero-row">' + pill(delta) + '</div><div class="hero-vs">' + (hist == null ? "" : "vs earlier years") + "</div>" + genMoves;
    host.appendChild(plot);
    host.appendChild(side);
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
    mountChart(plot, {
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
      const last3 = rows.slice(-3);
      const latest = last3[last3.length - 1];
      const lv = latest && finite(latest[1]) ? latest[1] : null;
      const ln = latest && finite(latest[2]) ? latest[2] : null;
      const lp = lv != null && ln != null && ln !== 0 ? signed((lv / ln - 1) * 100, "%") : null;
      const hero = document.createElement("div");
      hero.className = "hero";
      const plot = document.createElement("div");
      plot.className = "plot";
      const side = document.createElement("div");
      side.className = "hero-read";
      const prevM = rows.length > 1 ? rows[rows.length - 2] : null;
      const yKey = latest ? (+latest[0].slice(0, 4) - 1) + latest[0].slice(4) : "";
      const yAgo = inf.rows.find(r => r[0] === yKey);
      const inflowMoves = [];
      if (latest && prevM && finite(latest[1]) && finite(prevM[1]) && prevM[1] !== 0) inflowMoves.push({ k: "1M", text: signed((latest[1] / prevM[1] - 1) * 100, "%"), invert: false });
      if (latest && yAgo && finite(latest[1]) && finite(yAgo[1]) && yAgo[1] !== 0) inflowMoves.push({ k: "1Y", text: signed((latest[1] / yAgo[1] - 1) * 100, "%"), invert: false });
      side.innerHTML = '<div class="hero-k">' + esc(latest ? mlab(latest[0]) : "Latest") + '</div><div class="hero-num' + (lv == null ? " is-na" : "") + '">' + (lv == null ? "Not available yet" : fmt(lv, 1) + "<small>" + esc(inf.unit || "TWh") + "</small>") + '</div><div class="hero-row">' + pill(lp) + '</div><div class="hero-vs">vs ' + esc(inflowWin) + "</div>" + chgHTML(inflowMoves);
      hero.appendChild(plot);
      hero.appendChild(side);
      el.appendChild(hero);
      barLineChart(plot, {
        keys: rows.map(r => r[0]),
        bars: rows.map(r => finite(r[1]) ? r[1] : null),
        line: rows.map(r => finite(r[2]) ? r[2] : null),
        color: "#7aa2ff",
        unit: inf.unit || "TWh",
        aria: "Monthly inflow and the normal"
      });
      add(el, leg([{ k: "line", c: "#7aa2ff", t: "Inflow" }, { k: "dash", t: inflowWin }]));
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
    const allWeeks = (R.rows || []).filter(r => !end || r[0] <= end);
    const rows = allWeeks.slice(-52);
    const band = {};
    (R.band || []).forEach(b => { band[b[0]] = b; });
    const pts = rows.map(r => {
      const b = band[isoWeek(r[0])] || [];
      return { date: r[0], val: finite(r[valIdx]) ? r[valIdx] : null, min: finite(b[1]) ? b[1] : null, med: finite(b[2]) ? b[2] : null, max: finite(b[3]) ? b[3] : null };
    });
    const bal = R.reservoir_balance_twh || {};
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = '<div class="subh"><h3>' + esc(LONG[code]) + " reservoir</h3><p>1 year, weekly · as of " + esc(dlab(R.as_of) || "not available yet") + " · " + esc(R.unit || unit) + "</p></div>";
    const split = document.createElement("div");
    split.className = "split";
    const plot = document.createElement("div");
    plot.className = "plot";
    const side = document.createElement("div");
    const diff = finite(bal.difference) ? signed(bal.difference, " TWh") : null;
    const bandWin = /2006/.test(R.band_period || "") ? "2006–2025 normal (same week)" : "2015–2025 median (same week)";
    const wMode = useFill ? "pp" : "unit";
    const wUnit = useFill ? "" : " TWh";
    const weekMoves = end ? chgHTML([
      chgItem("1W", allWeeks, end, addDaysSafe(end, -7), valIdx, wMode, wUnit, false),
      chgItem("1M", allWeeks, end, addDaysSafe(end, -28), valIdx, wMode, wUnit, false),
      chgItem("1Y", allWeeks, end, addDaysSafe(end, -364), valIdx, wMode, wUnit, false)
    ]) : "";
    side.innerHTML = '<div class="tile"><span class="fig-l as-is">vs same week</span><b>' + (diff || "Not available yet") + '</b><span class="sub">' + (fmt(bal.value, 1) || "–") + " / " + (fmt(bal.normal, 1) || "–") + " TWh</span>" + weekMoves + "</div>";
    split.appendChild(plot);
    split.appendChild(side);
    card.appendChild(split);
    card.insertAdjacentHTML("beforeend", leg([
      { k: "line", c: "#7aa2ff", t: "Weekly" },
      { k: "dot", c: "#7aa2ff", t: "Week" },
      { k: "dash", t: bandWin },
      { k: "line", c: "rgba(79,124,255,.45)", t: "Min–max band" }
    ]));
    const weekNote = rows.length < 52 ? " The published weekly file has " + allWeeks.length + " points" + (allWeeks[0] ? " from " + (dlab(allWeeks[0][0]) || allWeeks[0][0]) : "") + ", so the chart shows " + rows.length + " weeks rather than 52." : "";
    tell(el, "<p>" + esc(LONG[code]) + ": " + esc(R.band_period || "historical band") + (R.source ? " · " + esc(R.source) : "") + ". The chart is 1 year of weekly readings, dots joined by a line, with the same-week band. 1W, 1M and 1Y are this reading minus the reading 1, 4 and 52 weeks earlier when that week is in the file." + weekNote + "</p>");
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
  function priceHist(arr, months, month, years) {
    const v = [];
    let y0 = null, y1 = null;
    for (let y = years[0]; y <= years[1]; y++) {
      const i = indexOf(months, y + month.slice(4));
      if (i >= 0 && finite(arr[i])) {
        v.push(arr[i]);
        if (y0 == null) y0 = y;
        y1 = y;
      }
    }
    if (v.length < 2) return null;
    return { avg: v.reduce((s, x) => s + x, 0) / v.length, min: Math.min(...v), max: Math.max(...v), n: v.length, y0: y0, y1: y1 };
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
    const C = data.monthly_climate;
    const months = nm.months.slice();
    const climRows = C && C.regions && C.regions.Nordic && C.regions.Nordic.metrics.wind100.rows || [];
    climRows.forEach(r => { if (r[0] && !months.includes(r[0])) months.push(r[0]); });
    months.sort();
    if (!state.month || !months.includes(state.month)) state.month = nm.last;
    const month = state.month;
    el.querySelector(".asof").textContent = "snapshot as of " + (dlab(M.as_of) || "date not available yet") + (M.stale ? " · stale" : "");
    tell(el, "<p>Same controls as the live monthly section: region and month. Figures are to 1 decimal. Generation, inflow and prices are the published snapshot, not a new fetch. " + esc(M.note || "") + "</p>");
    el.querySelector(".bh-side").insertAdjacentHTML("afterbegin", '<label class="mh"><select id="monthPick" aria-label="Month">' + months.map(m => '<option value="' + m + '"' + (m === month ? " selected" : "") + ">" + esc(MON[+m.slice(5) - 1] + " " + m.slice(0, 4)) + "</option>").join("") + "</select></label>");
    add(el, '<div class="tools"><div class="chips" role="group" aria-label="Region">' + ORDER.map(c => '<button type="button" class="chip' + (c === state.region ? " is-on" : "") + '" data-region="' + c + '">' + (c === "Nordic" ? "Nordic" : c) + '</button>').join("") + '</div><button type="button" class="textbtn' + (state.year ? " is-on" : "") + '" id="yearToggle">' + (state.year ? "Hide Jan–Dec" : "Jan–Dec") + "</button></div>");

    const code = state.region;
    const gen = nm.gen[code];
    const i = indexOf(nm.months, month);
    const years = nm.avg_years || [2021, 2025];
    const dash = '<span class="na" title="Not available yet">–</span>';
    add(el, '<p class="win">Weather normal is 2006–2025. Generation and inflow normal is ' + years[0] + "–" + years[1] + " same month.</p>");
    const host = document.createElement("div");
    host.className = "dense";
    host.innerHTML = '<div class="dense-h"><span></span><span>Value</span><span>Normal</span><span>vs</span><span>Range</span></div>';
    el.appendChild(host);
    const section = text => { const s = document.createElement("div"); s.className = "dense-sec"; s.textContent = text; host.appendChild(s); };
    const note = text => { const n = document.createElement("div"); n.className = "dense-note"; n.textContent = text; host.appendChild(n); };
    const addRow = (nameHTML, valueHTML, normalHTML, deltaHTML, range) => {
      const r = document.createElement("div");
      r.className = "dense-r";
      r.innerHTML = '<span class="dense-n">' + nameHTML + '</span><span class="dense-v">' + valueHTML + '</span><span class="dense-m">' + normalHTML + '</span><span class="dense-d">' + (deltaHTML || "") + '</span><span class="gsvg"></span>';
      host.appendChild(r);
      if (range && [range.min, range.max, range.avg, range.val].some(finite)) rangeGlyph(r.querySelector(".gsvg"), range);
    };

    section("Climate · " + LONG[code]);
    let partialNote = "";
    if (!C || !C.regions || !C.regions[code]) note("Monthly climate is not available yet.");
    else {
      const asOf = C.regions[code].as_of || C.as_of;
      [["wind100", "Wind 100 m", "m/s", "#2dd4bf", "pct"], ["temp", "Temperature", "°C", "#fb7185", "deg"], ["rain", "Rain", "mm/day", "#5bc0eb", "pct"]].forEach(([key, name, unit, color, kind]) => {
        const metric = C.regions[code].metrics[key];
        const crow = metric && (metric.rows || []).find(r => r[0] === month);
        const label = esc(name) + "<small> " + esc(unit) + "</small>";
        if (!crow || !finite(crow[1])) { addRow(label, dash, dash, "", null); return; }
        const val = crow[1], normal = finite(crow[2]) ? crow[2] : null, lo = finite(crow[3]) ? crow[3] : null, hi = finite(crow[4]) ? crow[4] : null;
        const diff = finite(crow[5]) ? crow[5] : null, pct = finite(crow[6]) ? crow[6] : null;
        const delta = kind === "deg" ? (diff == null ? "" : pill(signed(diff, " °C"))) : (pct == null ? "" : pill(signed(pct, "%")));
        if (crow[9] === true && !partialNote) partialNote = "month to date, " + crow[7] + " of " + crow[8] + " days, vs same days 2006–2025";
        addRow(label, fmt(val, 1), normal == null ? dash : fmt(normal, 1), delta, { min: lo, max: hi, avg: normal, val: val, color: color, compact: true, label: name + " " + month });
      });
      if (partialNote) note(partialNote);
      else note("vs 2006–2025 normal" + (asOf ? " · as of " + (dlab(asOf) || "") : ""));
      tell(el, "<p>Climate is the 2006–2025 land-area series, same grid as the daily weather. " + esc(C.aggregation || "") + " " + esc(C.grid || "") + ". The white tick is the normal and the dot is this month. Min and max are the lowest and highest of the 20 baseline years for that month, or for those same days when the month is still open. Temperature is degrees, not a percent. The old 72-point climate snapshot is not used.</p>");
    }

    section("Generation · " + mlab(month));
    if (!gen || i < 0) note("Generation for " + mlab(month) + " is not available yet. Last complete month is " + mlab(nm.last) + ".");
    else {
      const ly = (+month.slice(0, 4) - 1) + month.slice(4);
      const ily = indexOf(nm.months, ly);
      const lyBits = [];
      FUEL.forEach(([k, name, color]) => {
        if (!reported(gen, [k]).length) return;
        const stat = avgOf(gen[k], nm.months, month, years);
        const val = finite(gen[k][i]) ? gen[k][i] : null;
        const prev = ily >= 0 && finite(gen[k][ily]) ? gen[k][ily] : null;
        if (prev != null) lyBits.push(name + " " + fmt(prev, 1));
        const delta = val != null && stat && finite(stat.avg) && stat.avg !== 0 ? pill(signed((val / stat.avg - 1) * 100, "%")) : "";
        addRow(esc(name) + "<small> TWh</small>", val == null ? dash : fmt(val, 1), stat ? fmt(stat.avg, 1) : dash, delta, stat ? { min: stat.min, max: stat.max, avg: stat.avg, val: val, color: color, compact: true, label: name } : null);
      });
      const absent = FUEL.filter(([k]) => !reported(gen, [k]).length).map(([, n]) => n);
      if (absent.length) note(absent.join(" and ") + " is not in this file.");
      tell(el, "<p>The white tick is the " + years[0] + "–" + years[1] + " average of " + esc(mlab(month)) + " and the dot is this month. The strip is the min–max of those years." + (absent.length ? " " + esc(absent.join(" and ")) + " is not in this country’s file, so it is not shown as zero." : "") + (lyBits.length ? " Same month a year earlier: " + esc(lyBits.join(", ")) + " TWh." : "") + "</p>");
    }

    const infKey = code === "Nordic" ? "NOSE" : code;
    const inf = (nm.inflow || {})[infKey];
    if (!inf) note((code === "Nordic" ? "A Nordic total including Finland" : LONG[code]) + " inflow is not available yet.");
    else if (i < 0) note("Inflow for " + mlab(month) + " is not available yet.");
    else {
      const stat = avgOf(inf, nm.months, month, years);
      const val = finite(inf[i]) ? inf[i] : null;
      const delta = val != null && stat && finite(stat.avg) && stat.avg !== 0 ? pill(signed((val / stat.avg - 1) * 100, "%")) : "";
      addRow(esc(code === "Nordic" ? "Inflow NO+SE" : "Inflow") + "<small> TWh</small>", val == null ? dash : fmt(val, 1), stat ? fmt(stat.avg, 1) : dash, delta, stat ? { min: stat.min, max: stat.max, avg: stat.avg, val: val, color: "#7aa2ff", compact: true, label: "Inflow" } : null);
      if (code === "Nordic") note("Finland is not in this inflow.");
    }

    section("Day-ahead prices");
    const pi = indexOf(nm.price_months, month);
    const want = code === "Nordic" ? nm.price_zones.slice() : (ZONE[code] || []);
    const have = want.filter(z => nm.prices[z]);
    const missingZ = code === "Nordic" ? [] : want.filter(z => !nm.prices[z]);
    if (pi < 0) note("Prices for " + mlab(month) + " are not available yet. This snapshot’s prices run " + mlab(nm.price_months[0]) + " – " + mlab(nm.price_months[nm.price_months.length - 1]) + ".");
    else {
      const withHist = [];
      const bare = [];
      have.forEach(z => {
        const arr = nm.prices[z];
        const v = finite(arr[pi]) ? arr[pi] : null;
        const stat = priceHist(arr, nm.price_months, month, years);
        if (stat && v != null) withHist.push({ z: z, v: v, stat: stat });
        else if (v != null) bare.push({ z: z, v: v });
      });
      withHist.forEach(item => {
        const stat = item.stat;
        const delta = stat.avg !== 0 ? pill(signed((item.v / stat.avg - 1) * 100, "%")) : "";
        addRow(esc(item.z) + "<small> €/MWh</small>", fmt(item.v, 1), fmt(stat.avg, 1), delta, { min: stat.min, max: stat.max, avg: stat.avg, val: item.v, color: "#e8c56b", compact: true, label: item.z + " price" });
      });
      if (withHist.length) {
        const st = withHist[0].stat;
        note("Same month " + st.y0 + "–" + st.y1 + ", " + st.n + " year" + (st.n === 1 ? "" : "s") + " on file. Earlier 2021–2025 prices are not in this snapshot.");
      }
      if (bare.length) {
        const box = document.createElement("div");
        box.className = "pz";
        box.innerHTML = bare.map(b => "<span><b>" + esc(b.z) + "</b> " + fmt(b.v, 1) + "</span>").join("");
        host.appendChild(box);
        if (!withHist.length) note("No same-month price history back to 2021 in this snapshot.");
      }
      if (missingZ.length) note(missingZ.join(", ") + " not available yet in this snapshot.");
      tell(el, "<p>A price normal is the average of that same month inside 2021–2025, using only the years this snapshot actually holds. The strip runs from the lowest of those years to the highest, and the dot is the selected month. A zone with fewer than two historical years is shown as a value only.</p>");
    }
    if (state.year && gen && i >= 0) yearChart(el, nm, code, month, years);
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
    const T = data.tomorrow;
    const el = block(root, "tomorrow", "Tomorrow", "");
    if (!T) { add(el, na("The day-ahead file is not available yet.")); return; }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const word = T.delivery_date === today ? "Today" : T.delivery_date === addDaysSafe(today, 1) ? "Tomorrow" : "Delivery day";
    el.querySelector("h2").textContent = word;
    el.querySelector(".asof").textContent = "delivery " + (dlab(T.delivery_date) || "not available yet") + " · retrieved " + (dlab(T.as_of) || "not available yet");
    const meanOf = arr => {
      const v = (arr || []).filter(finite);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    const published = (R, key) => !!(R && R.complete && R.complete[key] && (R[key] || []).some(v => finite(v) && v !== 0));
    const winds = ORDER.map(c => (T.wind100 || {})[c]).filter(Boolean);
    const scaleNums = winds.flatMap(W => [W.daily_mean, W.daily_normal]).filter(finite);
    const lo = Math.min(0, ...(scaleNums.length ? scaleNums : [0]));
    const hi = Math.max(1, ...(scaleNums.length ? scaleNums : [1]));
    const span = (hi - lo) || 1;
    const pos = v => Math.max(0, Math.min(100, (v - lo) / span * 100));
    const track = (value, normal) => {
      if (!finite(value)) return '<span class="track"></span>';
      const x0 = pos(Math.min(0, value)), x1 = pos(Math.max(0, value));
      const tick = finite(normal) ? '<b style="left:' + pos(normal).toFixed(1) + '%"></b>' : "";
      return '<span class="track" style="--c:#2dd4bf"><i style="left:' + x0.toFixed(1) + "%;width:" + Math.max(0.8, x1 - x0).toFixed(1) + '%"></i>' + tick + "</span>";
    };
    const src = [];
    ORDER.forEach(c => {
      const fs = ((T.regions || {})[c] || {}).forecast_source || {};
      Object.keys(fs).forEach(k => { if (fs[k] && src.indexOf(fs[k]) < 0) src.push(fs[k]); });
    });
    const windNote = (T.wind100 || {}).Nordic || {};
    const tempNote = (T.temperature || {}).Nordic || {};
    tell(el, "<p>The Nordic price is the official Nord Pool system price, not an average of the countries. Each price is the mean of the published hours. The wind bar is the 100 m daily mean against the 2006–2025 normal. Residual load is load minus wind minus solar, and only where that forecast is published. A missing MW series is not shown as zero. " + esc(T.timezone || "") + ". " + esc(T.source || "") + (src.length ? " " + esc(src.join(". ")) + "." : "") + "</p>");
    if (windNote.note) tell(el, "<p>" + esc(windNote.note) + (windNote.source ? " " + esc(windNote.source) + "." : "") + "</p>");
    if (tempNote.note) tell(el, "<p>" + esc(tempNote.note) + "</p>");
    add(el, '<p class="win">Daily mean price · wind bar vs 2006–2025 normal</p>');
    const list = document.createElement("div");
    list.className = "tom-list";
    ORDER.forEach(c => {
      const R = (T.regions || {})[c];
      const W = (T.wind100 || {})[c];
      const temp = (T.temperature || {})[c];
      const price = R && R.complete && R.complete.price ? meanOf(R.price) : null;
      const mean = W && finite(W.daily_mean) ? W.daily_mean : null;
      const normal = W && finite(W.daily_normal) ? W.daily_normal : null;
      const pct = W && finite(W.difference_pct) ? signed(W.difference_pct, "%") : null;
      let tNormal = temp && finite(temp.daily_normal) ? temp.daily_normal : null;
      if (tNormal == null && temp && finite(temp.daily_mean) && data.weather_normals && data.weather_normals.regions && data.weather_normals.regions[c] && T.delivery_date) {
        const key = T.delivery_date.slice(5);
        const found = data.weather_normals.regions[c].find(r => r[0] === key);
        if (found && finite(found[2])) tNormal = found[2];
      }
      const tMean = temp && finite(temp.daily_mean) ? temp.daily_mean : null;
      const bits = [];
      if (tMean != null) bits.push(fmt(tMean, 1) + " °C" + (tNormal == null ? "" : " vs " + fmt(tNormal, 1)));
      const mw = [["wind_fc", "Wind"], ["solar_fc", "Solar"], ["residual_load", "Residual"]];
      const shown = mw.filter(([k]) => published(R, k));
      const hidden = mw.filter(([k]) => !published(R, k)).map(([, n]) => n);
      shown.forEach(([k, name]) => { const m = meanOf(R[k]); if (m != null) bits.push(name + " " + fmt(m, 1) + " MW"); });
      if (!shown.length) bits.push("MW forecast not published");
      else if (hidden.length) bits.push(hidden.join(" and ") + ": MW forecast not published");
      const row = document.createElement("div");
      row.className = "tom-r" + (c === state.region ? " is-on" : "");
      row.innerHTML = '<span class="tom-n" title="' + esc(LONG[c]) + '">' + esc(c === "Nordic" ? "Nordic" : c) + '</span><span class="tom-p">' + (price == null ? '<span class="na">–</span>' : fmt(price, 1) + "<small> €</small>") + "</span>" + track(mean, normal) + '<span class="tom-wv">' + (mean == null ? '<span class="na">–</span>' : fmt(mean, 1)) + "</span>" + pill(pct) + '<span class="tom-x">' + esc(bits.join(" · ")) + "</span>";
      list.appendChild(row);
    });
    el.appendChild(list);
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
