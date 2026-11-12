/* EMMI chart system (window.EMMICharts). One look for every chart that uses it: hairline grid, tabular numbers,
   right-hand value axis with a last-value tag, crisp candles, hover crosshair with a tooltip on desktop and a
   tap readout on phones. Axis tops are the first round step at or above the highest value (no spare grid line).
   Callers pass real values only; null stays a gap. */
(function () {
  "use strict";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FS = 10.5;
  function fmt(v, d) {
    if (!finite(v)) return "–";
    const n = Math.abs(v) < 1e-9 ? 0 : v;
    return n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
  }
  function ticks(lo, hi, n) {
    if (!(hi > lo)) { const p = Math.abs(lo) * 0.02 || 1; lo -= p; hi += p; }
    const raw = (hi - lo) / Math.max(1, n || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw * 0.999);
    const t0 = Math.floor(lo / step + 1e-9) * step, t1 = Math.ceil(hi / step - 1e-9) * step;
    const list = [];
    for (let k = 0; t0 + k * step <= t1 + step * 1e-6; k++) list.push(+(t0 + k * step).toFixed(10));
    const dec = step >= 1 ? 0 : step >= 0.1 ? (Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2) : step >= 0.01 ? 2 : 3;
    return { lo: t0, hi: t1, list: list, step: step, dec: dec };
  }
  function tickLabel(v, tk) {
    const a = Math.abs(v);
    if (a >= 10000 && tk.step >= 1000) return fmt(v / 1000, tk.step % 1000 ? 1 : 0) + "k";
    return fmt(v, tk.dec);
  }
  function tw(text, size) { return String(text).length * (size || FS) * 0.6; }
  /* Monotone cubic path (Fritsch–Carlson): smooth without overshooting the data. pts: [[x,y]...] */
  function smooth(pts) {
    const n = pts.length;
    if (n < 3) return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
    m[0] = dy[0]; m[n - 1] = dy[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (dy[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / dy[i], b = m[i + 1] / dy[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * dy[i]; m[i + 1] = t * b * dy[i]; }
    }
    let d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += "C" + (pts[i][0] + h).toFixed(1) + "," + (pts[i][1] + m[i] * h).toFixed(1) + " " + (pts[i + 1][0] - h).toFixed(1) + "," + (pts[i + 1][1] - m[i + 1] * h).toFixed(1) + " " + pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
    }
    return d;
  }
  function runs(vals, X, Y) {
    const out = []; let cur = [];
    vals.forEach((v, i) => { if (finite(v)) cur.push([X(i), Y(v)]); else if (cur.length) { out.push(cur); cur = []; } });
    if (cur.length) out.push(cur);
    return out;
  }
  let uid = 0;
  /* ---------- interaction ---------- */
  let pinned = null;
  document.addEventListener("pointerdown", e => { if (pinned && !pinned.contains(e.target)) { pinned._hide(); pinned = null; } }, true);
  function wire(box, hit) {
    const tip = box.querySelector(".ec-tip"), layer = box.querySelector(".ec-x");
    if (!hit || !hit.n || !layer) return;
    const show = (px, py, touch) => {
      const i = hit.idx(px, py);
      if (i == null || i < 0) { hide(); return; }
      const x = hit.x(i);
      let g = '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + hit.top + '" y2="' + hit.bottom + '" class="ec-cx"/>';
      if (hit.yAt && py != null && py >= hit.top && py <= hit.bottom && !touch) {
        g += '<line x1="' + hit.left + '" x2="' + hit.right + '" y1="' + py.toFixed(1) + '" y2="' + py.toFixed(1) + '" class="ec-cx"/>';
        const t = hit.yAt(py), wd = tw(t) + 10;
        g += '<rect x="' + (hit.right + 2) + '" y="' + (py - 8).toFixed(1) + '" width="' + wd.toFixed(1) + '" height="16" rx="3" class="ec-ytag"/><text x="' + (hit.right + 7) + '" y="' + (py + 3.5).toFixed(1) + '" class="ec-ytt">' + esc(t) + "</text>";
      }
      (hit.marks ? hit.marks(i) : []).forEach(m => { if (finite(m.y)) g += '<circle cx="' + (m.x != null ? m.x : x).toFixed(1) + '" cy="' + m.y.toFixed(1) + '" r="3.6" fill="' + m.color + '" class="ec-dot"/>'; });
      layer.innerHTML = g;
      tip.innerHTML = hit.tip(i);
      tip.hidden = false;
      box.classList.toggle("is-pin", !!touch);
      if (touch) { tip.style.left = ""; tip.style.top = ""; return; }
      const bw = box.clientWidth, tw2 = tip.offsetWidth;
      let left = x + 14;
      if (left + tw2 > bw - 4) left = x - 14 - tw2;
      tip.style.left = Math.max(2, left) + "px";
      tip.style.top = Math.max(0, (hit.top || 0)) + "px";
    };
    const hide = () => { layer.innerHTML = ""; tip.hidden = true; box.classList.remove("is-pin"); };
    box._hide = hide;
    const pos = e => { const r = box.querySelector("svg").getBoundingClientRect(); const k = hit.w / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    box.addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; const p = pos(e); show(p[0], p[1], false); });
    box.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hide(); });
    box.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      const p = pos(e); show(p[0], p[1], true); pinned = box;
    });
  }
  function mount(el, render) {
    if (!el) return;
    el.classList.add("ec-host");
    el._ecRender = render;
    const paint = force => {
      const w = Math.round(el.clientWidth || 0);
      if (w < 60 || (!force && w === el._ecW)) return;
      el._ecW = w;
      const out = el._ecRender(w);
      if (!out) { el.innerHTML = '<p class="ec-na">Not available</p>'; return; }
      el.innerHTML = '<div class="ec">' + out.svg.replace(/<\/svg>$/, '<g class="ec-x"></g></svg>') + '<div class="ec-tip" hidden></div></div>';
      if (out.hit) { out.hit.w = w; wire(el.querySelector(".ec"), out.hit); }
    };
    if (!el._ecRO && typeof ResizeObserver === "function") { el._ecRO = new ResizeObserver(() => paint(false)); el._ecRO.observe(el); }
    paint(true);
  }
  /* ---------- shared frame pieces ---------- */
  function yAxis(tk, Y, L, R, w, side, unitPre) {
    let s = "";
    tk.list.forEach(v => {
      const y = Math.round(Y(v)) + 0.5;
      s += '<line x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '" class="' + (v === 0 && tk.lo < 0 ? "ec-g0" : "ec-g") + '"/>';
      const t = (unitPre || "") + tickLabel(v, tk);
      if (side === "right") s += '<text x="' + (R + 6) + '" y="' + (y + 3.5) + '" class="ec-t">' + esc(t) + "</text>";
      else s += '<text x="' + L + '" y="' + (y - 4) + '" class="ec-t ec-halo">' + esc(t) + "</text>";
    });
    return s;
  }
  function lastTag(R, y, text, color, cls) {
    const wd = tw(text) + 10;
    return '<rect x="' + (R + 2) + '" y="' + (y - 8).toFixed(1) + '" width="' + wd.toFixed(1) + '" height="16" rx="3" fill="' + color + '" class="ec-tag ' + (cls || "") + '"/><text x="' + (R + 7) + '" y="' + (y + 3.5).toFixed(1) + '" class="ec-tagt">' + esc(text) + "</text>";
  }
  function xLabels(labels, X, y, w, minGap) {
    let s = "", last = -1e9;
    const n = labels.length;
    labels.forEach((lab, i) => {
      if (!lab) return;
      let x = X(i), anchor = "middle";
      const half = tw(lab) / 2;
      if (x - half < 0) { anchor = "start"; x = Math.max(0, x - 2); }
      if (x + half > w) { anchor = "end"; }
      const a = anchor === "start" ? x : anchor === "end" ? x - 2 * half : x - half;
      if (a < last + (minGap || 10)) return;
      s += '<text x="' + x.toFixed(1) + '" y="' + y + '" class="ec-t" text-anchor="' + anchor + '">' + esc(lab) + "</text>";
      last = a + 2 * half;
    });
    return s;
  }
  function hatchDefs(id, color) {
    return '<defs><pattern id="' + id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="' + color + '" opacity=".28"/><line x1="0" y1="0" x2="0" y2="5" stroke="' + color + '" stroke-width="2.2"/></pattern></defs>';
  }
  function tipRows(title, rows) {
    return '<p class="ec-tt">' + esc(title) + "</p>" + rows.filter(Boolean).map(r => '<p class="ec-tr"><span>' + (r.color ? '<i style="background:' + r.color + (r.dash ? ";opacity:.6" : "") + '"></i>' : "") + esc(r.k) + "</span><b" + (r.cls ? ' class="' + r.cls + '"' : "") + ">" + esc(r.v) + "</b></p>").join("");
  }

  /* ---------- candles ---------- */
  /* o: { bars:[[o,h,l,c]], labels:[date text per bar], ticks:[label or null per bar], d, pre, h, prev } */
  function candles(el, o) {
    mount(el, w => {
      const bars = (o.bars || []).filter(b => Array.isArray(b) && finite(b[3]));
      const n = bars.length;
      if (n < 2) return null;
      const h = o.h || 140, T = 8, B = 18;
      let lo = Infinity, hi = -Infinity;
      bars.forEach(b => b.forEach(v => { if (finite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
      const tk = ticks(lo, hi, h < 130 ? 3 : 4);
      const lastC = bars[n - 1][3];
      const labW = Math.max(tw((o.pre || "") + tickLabel(tk.hi, tk)), tw(fmt(lastC, o.d))) + 14;
      const L = 2, R = w - labW, iw = R - L - 4, ih = h - T - B;
      const Y = v => T + ih - (v - tk.lo) / (tk.hi - tk.lo) * ih;
      const slot = iw / n;
      const bw = Math.max(3, Math.min(14, Math.floor(slot * 0.64)));
      const X = i => Math.round(L + 2 + slot * (i + 0.5));
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "Candles") + '">' + yAxis(tk, Y, L, R, w, "right", o.pre);
      bars.forEach((b, i) => {
        const op = b[0], cl = b[3], x = X(i);
        const top = Math.max.apply(null, b.filter(finite)), bot = Math.min.apply(null, b.filter(finite));
        if (!finite(op)) { s += '<line x1="' + (x - bw / 2) + '" x2="' + (x + bw / 2) + '" y1="' + Y(cl).toFixed(1) + '" y2="' + Y(cl).toFixed(1) + '" class="ec-cn"/>'; return; }
        const up = cl >= op, cls = up ? "u" : "d";
        const y1 = Y(Math.max(op, cl)), y2 = Y(Math.min(op, cl));
        s += '<line x1="' + (x + 0.5) + '" x2="' + (x + 0.5) + '" y1="' + Y(top).toFixed(1) + '" y2="' + Y(bot).toFixed(1) + '" class="ec-wk ' + cls + '"/>';
        s += '<rect x="' + (x + 0.5 - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw + '" height="' + Math.max(1.5, y2 - y1).toFixed(1) + '" rx="' + (bw >= 6 ? 1 : 0) + '" class="ec-bd ' + cls + '"/>';
      });
      s += xLabels(o.ticks || [], X, h - 4, R, 8);
      const up = finite(o.prev) ? lastC >= o.prev : lastC >= (bars[n - 1][0] || lastC);
      s += lastTag(R, Y(lastC), fmt(lastC, o.d), up ? "var(--good)" : "var(--bad)");
      s += "</svg>";
      return {
        svg: s,
        hit: {
          n: n, top: T, bottom: T + ih, left: L, right: R, x: i => X(i) + 0.5,
          idx: px => Math.max(0, Math.min(n - 1, Math.floor((px - L - 2) / slot))),
          yAt: py => (o.pre || "") + fmt(tk.lo + (T + ih - py) / ih * (tk.hi - tk.lo), o.d),
          tip: i => {
            const b = bars[i], pc = i ? bars[i - 1][3] : null, ch = finite(pc) ? (b[3] / pc - 1) * 100 : null;
            return tipRows((o.labels && o.labels[i]) || "", [
              { k: "Open", v: fmt(b[0], o.d) }, { k: "High", v: fmt(b[1], o.d) }, { k: "Low", v: fmt(b[2], o.d) }, { k: "Close", v: fmt(b[3], o.d) },
              finite(ch) ? { k: "Change", v: (ch > 0 ? "+" : "") + fmt(ch, 2) + "%", cls: ch > 0 ? "up" : ch < 0 ? "dn" : "" } : null
            ]);
          }
        }
      };
    });
  }

  /* ---------- lines ---------- */
  /* o: { series:[{name, vals, color, width, dash, faint, area, smooth, end}], labels:[tooltip title per index], ticks:[x label or null],
         h, d, pre, unit, axis:"right"|"left", zero, refs:[{y,label,color}], band:{lo:[],hi:[],color}, forecastFrom, last:true|index,
         whisker:{i,lo,hi,label}, endLabels:true, markers:[indices on series 0], baseline:value (fill between series 0 and value) } */
  function lines(el, o) {
    mount(el, w => {
      const series = (o.series || []).filter(s => s && s.vals && s.vals.some(finite));
      const n = series.reduce((m, s) => Math.max(m, s.vals.length), 0);
      if (!n) return null;
      const h = o.h || 160, T = o.T || 10, B = o.ticks ? 18 : 6;
      const vals = [];
      series.forEach(s => s.vals.forEach(v => { if (finite(v)) vals.push(v); }));
      if (o.band) (o.band.lo || []).concat(o.band.hi || []).forEach(v => { if (finite(v)) vals.push(v); });
      if (o.whisker) [o.whisker.lo, o.whisker.hi].forEach(v => { if (finite(v)) vals.push(v); });
      (o.refs || []).forEach(r => { if (finite(r.y)) vals.push(r.y); });
      if (o.zero) vals.push(0);
      const tk = ticks(Math.min(...vals), Math.max(...vals), o.nt || (h < 130 ? 3 : 4));
      const s0 = series[0];
      let li = s0.vals.length - 1; while (li >= 0 && !finite(s0.vals[li])) li--;
      const lastV = li >= 0 ? s0.vals[li] : null;
      const right = o.axis !== "left" && !o.endLabels; /* direct labels own the right edge; the axis moves left */
      let endW = 0;
      if (o.endLabels) endW = Math.max(...series.map(s => tw((s.name || "") + " " + fmt(lastOf(s.vals), o.d)))) + 12;
      const labW = right ? Math.max(tw((o.pre || "") + tickLabel(tk.hi, tk)), tw((o.pre || "") + tickLabel(tk.lo, tk)), o.last !== false && finite(lastV) ? tw(fmt(lastV, o.d)) + 4 : 0) + 12 : 0;
      const L = 2, R = w - Math.max(labW, endW) - (right ? 0 : 4), ih = h - T - B;
      const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * (R - L - (right ? 6 : 0));
      const Y = v => T + ih - (v - tk.lo) / (tk.hi - tk.lo) * ih;
      const id = "ec" + (++uid);
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "Chart") + '">';
      if (o.forecastFrom != null && o.forecastFrom >= 0 && o.forecastFrom < n) {
        s += hatchDefs(id + "h", "var(--border-strong)");
        const x0 = X(o.forecastFrom);
        s += '<rect x="' + x0.toFixed(1) + '" y="' + T + '" width="' + (R - x0).toFixed(1) + '" height="' + ih + '" fill="url(#' + id + 'h)" class="ec-fc"/><text x="' + (x0 + 5).toFixed(1) + '" y="' + (T + 11) + '" class="ec-t ec-fct">Forecast</text>';
      }
      s += yAxis(tk, Y, L, R, w, right ? "right" : "left", o.pre);
      if (o.band && o.band.lo && o.band.hi) {
        let top = "", bot = "";
        for (let i = 0; i < n; i++) if (finite(o.band.hi[i]) && finite(o.band.lo[i])) top += (top ? "L" : "M") + X(i).toFixed(1) + "," + Y(o.band.hi[i]).toFixed(1);
        for (let i = n - 1; i >= 0; i--) if (finite(o.band.hi[i]) && finite(o.band.lo[i])) bot += "L" + X(i).toFixed(1) + "," + Y(o.band.lo[i]).toFixed(1);
        if (top) s += '<path d="' + top + bot + 'Z" fill="' + (o.band.color || "var(--muted)") + '" opacity=".14"/>';
      }
      (o.refs || []).forEach(r => {
        if (!finite(r.y)) return;
        const y = Math.round(Y(r.y)) + 0.5;
        s += '<line x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '" stroke="' + (r.color || "var(--muted)") + '" stroke-dasharray="3 3" stroke-width="1"/>';
        if (r.label) s += '<text x="' + (L + 2) + '" y="' + (y - 4) + '" class="ec-t ec-halo" fill="' + (r.color || "var(--muted)") + '">' + esc(r.label) + "</text>";
      });
      series.slice().reverse().forEach(ser => {
        runs(ser.vals, X, Y).forEach(pts => {
          const d = ser.smooth === false ? pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("") : smooth(pts);
          if (ser.area && pts.length > 1) {
            const gid = id + "g" + series.indexOf(ser);
            const base = finite(o.baseline) ? Y(o.baseline) : T + ih;
            s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ser.color + '" stop-opacity=".26"/><stop offset="1" stop-color="' + ser.color + '" stop-opacity="0"/></linearGradient></defs>';
            s += '<path d="' + d + "L" + pts[pts.length - 1][0].toFixed(1) + "," + base.toFixed(1) + "L" + pts[0][0].toFixed(1) + "," + base.toFixed(1) + 'Z" fill="url(#' + gid + ')"/>';
          }
          s += '<path d="' + d + '" fill="none" stroke="' + ser.color + '" stroke-width="' + (ser.width || 1.75) + '" stroke-linejoin="round" stroke-linecap="round"' + (ser.dash ? ' stroke-dasharray="' + ser.dash + '"' : "") + (ser.faint ? ' opacity=".45"' : "") + "/>";
        });
        if (ser.end) {
          let i = ser.vals.length - 1; while (i >= 0 && !finite(ser.vals[i])) i--;
          if (i >= 0) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(ser.vals[i]).toFixed(1) + '" r="3.2" fill="' + ser.color + '" class="ec-end"/>';
        }
      });
      (o.markers || []).forEach(i => { const v = s0.vals[i]; if (finite(v)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.8" fill="var(--panel)" stroke="' + s0.color + '" stroke-width="1.6"/>'; });
      if (o.whisker && finite(o.whisker.lo) && finite(o.whisker.hi)) {
        const x = X(o.whisker.i) + 7, a = Y(o.whisker.hi), b = Y(o.whisker.lo);
        s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + a.toFixed(1) + '" y2="' + b.toFixed(1) + '" class="ec-wh"/><line x1="' + (x - 3).toFixed(1) + '" x2="' + (x + 3).toFixed(1) + '" y1="' + a.toFixed(1) + '" y2="' + a.toFixed(1) + '" class="ec-wh"/><line x1="' + (x - 3).toFixed(1) + '" x2="' + (x + 3).toFixed(1) + '" y1="' + b.toFixed(1) + '" y2="' + b.toFixed(1) + '" class="ec-wh"/>';
      }
      if (o.ticks) s += xLabels(o.ticks, X, h - 4, R, 10);
      if (o.endLabels) {
        const items = series.map(ser => ({ ser: ser, v: lastOf(ser.vals) })).filter(x => finite(x.v)).map(x => ({ ser: x.ser, v: x.v, y: Y(x.v) })).sort((a, b) => a.y - b.y);
        for (let k = 1; k < items.length; k++) if (items[k].y < items[k - 1].y + 12) items[k].y = items[k - 1].y + 12;
        for (let k = items.length - 2; k >= 0; k--) if (items[k].y > items[k + 1].y - 12) items[k].y = items[k + 1].y - 12;
        items.forEach(it => { s += '<text x="' + (R + 8) + '" y="' + (it.y + 3.5).toFixed(1) + '" class="ec-el" fill="' + it.ser.color + '">' + esc(it.ser.name || "") + ' <tspan class="ec-elv">' + esc(fmt(it.v, o.d)) + "</tspan></text>"; });
      } else if (right && o.last !== false && finite(lastV)) {
        s += lastTag(R, Y(lastV), fmt(lastV, o.d), s0.color);
      }
      s += "</svg>";
      return {
        svg: s,
        hit: {
          n: n, top: T, bottom: T + ih, left: L, right: R, x: X,
          idx: px => Math.max(0, Math.min(n - 1, Math.round((px - L) / ((R - L - (right ? 6 : 0)) / Math.max(1, n - 1))))),
          marks: i => series.map(ser => ({ y: finite(ser.vals[i]) ? Y(ser.vals[i]) : null, color: ser.color })),
          tip: i => o.tip ? o.tip(i) : tipRows((o.labels && o.labels[i]) || "", series.map(ser => finite(ser.vals[i]) ? { k: ser.name || "", v: (o.pre || "") + fmt(ser.vals[i], o.d) + (o.unit ? " " + o.unit : ""), color: ser.color, dash: !!ser.dash } : null))
        }
      };
    });
  }
  function lastOf(v) { for (let i = v.length - 1; i >= 0; i--) if (finite(v[i])) return v[i]; return null; }

  /* ---------- diverging bars ---------- */
  /* o: { vals, labels, ticks, forecastFrom, h, d, unit, upName, dnName } */
  function bars(el, o) {
    mount(el, w => {
      const v = o.vals || [], n = v.length;
      if (!v.some(finite)) return null;
      const h = o.h || 160, T = 10, B = o.ticks ? 18 : 6;
      const f = v.filter(finite);
      const tk = ticks(Math.min(0, ...f), Math.max(0, ...f), o.nt || 4);
      const labW = tw(tickLabel(tk.lo, tk)) + 14;
      const L = 2, R = w - labW, ih = h - T - B;
      const slot = (R - L - 2) / n, bw = Math.max(2, Math.min(18, slot * 0.72));
      const X = i => L + slot * (i + 0.5);
      const Y = x => T + ih - (x - tk.lo) / (tk.hi - tk.lo) * ih;
      const id = "ec" + (++uid);
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "Bars") + '">' + hatchDefs(id + "u", "var(--good)") + hatchDefs(id + "d", "var(--bad)");
      if (o.forecastFrom != null && o.forecastFrom >= 0) {
        const x0 = L + slot * o.forecastFrom;
        s += '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + T + '" y2="' + (T + ih) + '" class="ec-g0" stroke-dasharray="2 3"/><text x="' + (x0 + 5).toFixed(1) + '" y="' + (T + 9) + '" class="ec-t ec-fct">Forecast</text>';
      }
      s += yAxis(tk, Y, L, R, w, "right");
      const y0 = Y(0);
      v.forEach((x, i) => {
        if (!finite(x)) return;
        const fc = o.forecastFrom != null && i >= o.forecastFrom, up = x >= 0;
        const y = Y(x);
        s += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + Math.min(y, y0).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y0 - y)).toFixed(1) + '" rx="1" ' + (fc ? 'fill="url(#' + id + (up ? "u" : "d") + ')"' : 'class="ec-bar ' + (up ? "u" : "d") + '"') + "/>";
      });
      s += '<line x1="' + L + '" x2="' + R + '" y1="' + (Math.round(y0) + 0.5) + '" y2="' + (Math.round(y0) + 0.5) + '" class="ec-g0"/>';
      if (o.ticks) s += xLabels(o.ticks, X, h - 4, R, 10);
      s += "</svg>";
      return {
        svg: s,
        hit: {
          n: n, top: T, bottom: T + ih, left: L, right: R, x: X,
          idx: px => Math.max(0, Math.min(n - 1, Math.floor((px - L) / slot))),
          tip: i => tipRows(((o.labels && o.labels[i]) || "") + (o.forecastFrom != null && i >= o.forecastFrom ? " · forecast" : ""), [{ k: finite(v[i]) && v[i] >= 0 ? (o.upName || "Surplus") : (o.dnName || "Deficit"), v: (finite(v[i]) && v[i] > 0 ? "+" : "") + fmt(v[i], o.d == null ? 2 : o.d) + (o.unit ? " " + o.unit : ""), cls: v[i] >= 0 ? "up" : "dn" }])
        }
      };
    });
  }

  /* ---------- cost curve: width = volume, height = cost ---------- */
  /* o: { steps:[{name, short, w, y, color, tip}], refs:[{y,label,color}], h, xUnit, yPre } */
  function costCurve(el, o) {
    mount(el, w => {
      const st = (o.steps || []).filter(s => finite(s.w) && s.w > 0 && finite(s.y));
      if (!st.length) return null;
      const narrow = w < 560;
      const h = o.h || (narrow ? 260 : 300), B = 18;
      const total = st.reduce((a, s) => a + s.w, 0);
      const ys = st.map(s => s.y).concat((o.refs || []).map(r => r.y)).filter(finite);
      const tk = ticks(0, Math.max(...ys), 4);
      const labW = tw((o.yPre || "") + tickLabel(tk.hi, tk)) + 14;
      const L = 2, R = w - labW;
      /* label band above the bars */
      const T = narrow ? 18 : 64, ih = h - T - B;
      const X = c => L + c / total * (R - L);
      const Y = v => T + ih - v / tk.hi * ih;
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "Cost curve") + '">' + yAxis(tk, Y, L, R, w, "right", o.yPre);
      let c = 0;
      const geo = [];
      st.forEach(x => { const a = X(c), b = X(c + x.w); geo.push({ a: a, b: b, s: x }); c += x.w; });
      geo.forEach(g => {
        const y = Y(g.s.y);
        s += '<rect x="' + (g.a + 0.5).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, g.b - g.a - 1).toFixed(1) + '" height="' + (T + ih - y).toFixed(1) + '" fill="' + g.s.color + '" class="ec-step"/>';
      });
      /* direct labels: inside-top when the step is wide enough, else angled in the band above, skipping collisions */
      let lastEnd = -1e9;
      geo.forEach(g => {
        const name = narrow ? (g.s.short || g.s.name) : g.s.name, wd = g.b - g.a, y = Y(g.s.y);
        if (wd > tw(name, 11) + 10) { s += '<text x="' + ((g.a + g.b) / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" class="ec-cl" text-anchor="middle">' + esc(name) + "</text>"; return; }
        if (narrow) return;
        const cx = (g.a + g.b) / 2;
        if (cx < lastEnd + 12) return;
        s += '<line x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + (y - 2).toFixed(1) + '" y2="' + (T - 6) + '" class="ec-lead"/><text transform="translate(' + (cx + 3).toFixed(1) + "," + (T - 8) + ') rotate(-40)" class="ec-cl">' + esc(name) + "</text>";
        lastEnd = cx;
      });
      (o.refs || []).forEach(r => {
        if (!finite(r.y)) return;
        const y = Math.round(Y(r.y)) + 0.5;
        s += '<line x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '" stroke="' + r.color + '" stroke-dasharray="4 3" stroke-width="1.2"/>';
        s += '<text x="' + (L + Math.min(48, (R - L) * 0.08)).toFixed(1) + '" y="' + (y - 4) + '" class="ec-t ec-halo" fill="' + r.color + '" font-weight="650">' + esc(r.label) + "</text>";
      });
      const xt = ticks(0, total, narrow ? 3 : 6);
      xt.list.forEach(v => { if (v <= total) s += '<text x="' + Math.min(X(v), R - 2).toFixed(1) + '" y="' + (h - 4) + '" class="ec-t" text-anchor="' + (v === 0 ? "start" : X(v) > R - 20 ? "end" : "middle") + '">' + esc(tickLabel(v, xt)) + "</text>"; });
      s += '<text x="' + (R + 6) + '" y="' + (h - 4) + '" class="ec-t">' + esc(o.xUnit || "") + "</text>";
      s += "</svg>";
      return {
        svg: s,
        hit: {
          n: geo.length, top: T, bottom: T + ih, left: L, right: R, x: i => (geo[i].a + geo[i].b) / 2,
          idx: px => { const k = geo.findIndex(g => px >= g.a && px < g.b); return k < 0 ? (px < L ? 0 : geo.length - 1) : k; },
          marks: i => [{ y: Y(geo[i].s.y), color: "var(--text)" }],
          tip: i => geo[i].s.tip
        }
      };
    });
  }

  /* ---------- helpers for callers ---------- */
  /* Business-day dates from d0 for n bars. Returns null unless the last one lands on the expected date. */
  function sessionDates(d0, n, lastIso) {
    const p = String(d0 || "").split("-").map(Number);
    if (p.length < 3) return null;
    const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    const out = [];
    while (out.length < n) {
      const wd = dt.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(dt.toISOString().slice(0, 10));
      dt.setUTCDate(dt.getUTCDate() + 1);
    }
    return lastIso && out[n - 1] !== lastIso ? null : out;
  }
  function monthSeq(m0, n) {
    const p = String(m0 || "").split("-").map(Number);
    if (p.length < 2) return null;
    const out = [];
    for (let i = 0; i < n; i++) { const y = p[0] + Math.floor((p[1] - 1 + i) / 12), m = (p[1] - 1 + i) % 12; out.push(y + "-" + String(m + 1).padStart(2, "0")); }
    return out;
  }
  function dayLabel(iso) { const p = String(iso || "").split("-"); return p.length < 3 ? "" : +p[2] + " " + MON[+p[1] - 1]; }
  function monLabel(ym, long) { const p = String(ym || "").split("-"); return p.length < 2 ? "" : MON[+p[1] - 1] + (long ? " " + p[0] : ""); }
  window.EMMICharts = { candles: candles, lines: lines, bars: bars, costCurve: costCurve, ticks: ticks, fmt: fmt, tipRows: tipRows, sessionDates: sessionDates, monthSeq: monthSeq, dayLabel: dayLabel, monLabel: monLabel, MON: MON };
})();
