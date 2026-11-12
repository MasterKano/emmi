/* Shared formatting and compact charts for the oil, gas and mining pages.
   Null stays unavailable. A range bar never stretches out to the latest value. */
(function () {
  "use strict";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function fmt(v, d) {
    if (!finite(v)) return null;
    const n = Math.abs(v) < 1e-9 ? 0 : v;
    return n.toLocaleString("en-GB", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }).replace("-", "−");
  }
  function signed(v, suffix, d) {
    const t = fmt(v, d == null ? 1 : d);
    if (t == null) return null;
    return (v > 0 ? "+" : "") + t + (suffix || "");
  }
  function pill(text) {
    if (!text) return "";
    const neg = /^[−-]/.test(text), pos = text.charAt(0) === "+";
    const cls = neg ? "dn" : pos ? "up" : "";
    return '<span class="og-pill ' + cls + '">' + esc(text) + "</span>";
  }
  function money(v, ccy) {
    if (!finite(v)) return null;
    const a = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    const n = a >= 1e12 ? (a / 1e12).toFixed(2) + "tn" : a >= 1e9 ? (a / 1e9).toFixed(a >= 1e10 ? 1 : 2) + "bn" : a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "m" : Math.round(a).toLocaleString("en-GB");
    const mark = ccy === "EUR" ? "€" : ccy === "USD" ? "$" : ccy === "GBP" ? "£" : "";
    return mark ? mark + sign + n : sign + n + (ccy ? " " + ccy : "");
  }
  function pxText(v, ccy) {
    if (!finite(v)) return null;
    const d = Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 2 : 3;
    const t = fmt(v, d);
    if (ccy === "GBp" || ccy === "GBX") return t + "p";
    return t;
  }
  function hexA(hex, a) {
    const h = String(hex || "#4f7cff").replace("#", "");
    const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6);
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    if (![r, g, b].every(x => x >= 0)) return "rgba(79,124,255," + a + ")";
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function watch(el, draw) {
    const go = () => {
      const w = Math.round(el.clientWidth || 0);
      if (w < 40) return;
      draw(w);
    };
    go();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(go);
      ro.observe(el);
    }
  }
  /* series: [{ color, width, dash, vals:[number|null] }]. Optional band { mins, maxs } aligned to vals. */
  function lineChart(el, opts) {
    watch(el, w => {
      const series = (opts.series || []).filter(s => s && s.vals);
      const n = series.reduce((m, s) => Math.max(m, s.vals.length), 0);
      if (!n) { el.innerHTML = '<p class="og-na">n/a</p>'; return; }
      const h = opts.h || 150;
      const L = 36, R = 8, T = 8, B = opts.labels ? 18 : 8;
      const vals = [];
      series.forEach(s => s.vals.forEach(v => { if (finite(v)) vals.push(v); }));
      const band = opts.band;
      if (band) (band.mins || []).concat(band.maxs || []).forEach(v => { if (finite(v)) vals.push(v); });
      if (!vals.length) { el.innerHTML = '<p class="og-na">n/a</p>'; return; }
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (!(hi > lo)) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08;
      lo -= pad; hi += pad;
      if (opts.floorZero && lo < 0 && Math.min(...vals.filter(finite)) >= 0) lo = 0;
      const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * (w - L - R);
      const Y = v => T + (h - T - B) - (v - lo) / (hi - lo) * (h - T - B);
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "chart") + '">';
      if (band && band.mins && band.maxs) {
        let d = "";
        for (let i = 0; i < n; i++) if (finite(band.maxs[i])) d += (d ? "L" : "M") + X(i).toFixed(1) + "," + Y(band.maxs[i]).toFixed(1);
        for (let i = n - 1; i >= 0; i--) if (finite(band.mins[i])) d += "L" + X(i).toFixed(1) + "," + Y(band.mins[i]).toFixed(1);
        if (d) s += '<path d="' + d + 'Z" fill="' + hexA(opts.bandColor || "#8b95a8", 0.22) + '"/>';
      }
      if (opts.shadeFrom != null) {
        const x0 = X(opts.shadeFrom);
        s += '<rect x="' + x0.toFixed(1) + '" y="' + T + '" width="' + Math.max(0, w - R - x0).toFixed(1) + '" height="' + (h - T - B) + '" fill="rgba(232,197,107,.08)"/>';
      }
      [lo, (lo + hi) / 2, hi].forEach(v => {
        const y = Y(v);
        s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
        s += '<text x="' + (L - 4) + '" y="' + (y + 3).toFixed(1) + '" fill="#8b95a8" font-size="9" text-anchor="end">' + esc(fmt(v, hi - lo > 40 ? 0 : 1)) + "</text>";
      });
      series.forEach(ser => {
        let d = "", pen = false;
        ser.vals.forEach((v, i) => {
          if (!finite(v)) { pen = false; return; }
          d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1);
          pen = true;
        });
        if (!d) return;
        s += '<path d="' + d + '" fill="none" stroke="' + (ser.color || "#e8c56b") + '" stroke-width="' + (ser.width || 1.8) + '"' + (ser.dash ? ' stroke-dasharray="' + ser.dash + '"' : "") + '/>';
        if (ser.dots) ser.vals.forEach((v, i) => { if (finite(v)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.2" fill="' + ser.color + '"/>'; });
      });
      s += "</svg>";
      el.innerHTML = s;
    });
  }
  /* Width of an SVG label in user units. Slightly generous so the text stays inside the viewBox. */
  function labelWidth(text, size) {
    return Math.ceil(String(text || "").length * size * 0.62);
  }
  /* Equal-width columns ranked by the caller. hlines: [{ y, color, label }].
     Reference labels sit in a right column, above their line, and are pushed apart so they
     never cover each other or the bars. */
  function stepChart(el, opts) {
    watch(el, w => {
      const steps = opts.steps || [];
      if (!steps.length) { el.innerHTML = '<p class="og-na">n/a</p>'; return; }
      const lines = (opts.hlines || []).filter(l => finite(l.y)).slice();
      const font = 11;
      const widest = lines.reduce((m, l) => Math.max(m, labelWidth(l.label, font)), 0);
      const h = opts.h || 228;
      const L = 32, R = Math.max(8, widest + 16), T = 6, B = 8;
      const ys = steps.map(s => s.y).concat(lines.map(l => l.y)).filter(finite);
      let yLo = 0, yHi = Math.max(...ys);
      if (!(yHi > yLo)) yHi = yLo + 1;
      const plotH = h - T - B;
      /* Room above the highest line for its label, and a little air under the top edge. */
      const head = (font + 10) / plotH * (yHi - yLo);
      yHi += head;
      const Y = v => T + plotH - (v - yLo) / (yHi - yLo) * plotH;
      const n = steps.length, gap = 3, iw = Math.max(20, w - L - R), bw = Math.max(2, (iw - gap * (n - 1)) / n);
      const barTop = Math.min(...steps.map(st => Y(st.y)));
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "unit cost") + '">';
      [0, (yHi - head) / 2, yHi - head].forEach(v => {
        const y = Y(v);
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
        s += '<text x="' + (L - 4) + '" y="' + (y + 3).toFixed(1) + '" fill="#8b95a8" font-size="9" text-anchor="end">' + esc(fmt(v, 0)) + "</text>";
      });
      steps.forEach((st, i) => {
        const x = L + i * (bw + gap), y = Y(st.y);
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Y(0) - y).toFixed(1) + '" fill="' + hexA(st.color, 0.9) + '"><title>' + esc(st.name || "") + " $" + esc(fmt(st.y, 1)) + "</title></rect>";
      });
      const placed = lines.map(l => ({ l: l, lineY: Y(l.y), y: Y(l.y) - 3 }));
      placed.sort((a, b) => a.y - b.y);
      const sep = font + 5, minY = font, maxY = h - 3;
      placed.forEach((p, i) => {
        if (p.y < minY) p.y = minY;
        if (i && p.y < placed[i - 1].y + sep) p.y = placed[i - 1].y + sep;
        /* Keep a label that would fall into the bars in the empty band above them. */
        if (p.y > barTop - 2) p.y = Math.max(minY, barTop - 2);
      });
      for (let i = placed.length - 2; i >= 0; i--) {
        if (placed[i].y > placed[i + 1].y - sep) placed[i].y = placed[i + 1].y - sep;
      }
      if (placed.length && placed[0].y < minY) {
        const shift = minY - placed[0].y;
        placed.forEach(p => { p.y += shift; });
      }
      placed.forEach((p, i) => {
        if (i && p.y < placed[i - 1].y + sep) p.y = placed[i - 1].y + sep;
        if (p.y > maxY) p.y = maxY;
      });
      placed.forEach(p => {
        const l = p.l;
        s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + p.lineY.toFixed(1) + '" y2="' + p.lineY.toFixed(1) + '" stroke="' + l.color + '" stroke-dasharray="4 3"/>';
        if (Math.abs(p.y - p.lineY) > 8) {
          s += '<line x1="' + (L + iw) + '" x2="' + (L + iw + 7) + '" y1="' + p.lineY.toFixed(1) + '" y2="' + (p.y - 3).toFixed(1) + '" stroke="' + l.color + '" stroke-width="1"/>';
        }
        s += '<text x="' + (w - 4) + '" y="' + p.y.toFixed(1) + '" fill="' + l.color + '" font-size="' + font + '" text-anchor="end" paint-order="stroke" stroke="#111722" stroke-width="3">' + esc(l.label) + "</text>";
      });
      s += "</svg>";
      el.innerHTML = s;
    });
  }
  function bars(el, rows, opts) {
    watch(el, w => {
      const list = (rows || []).filter(r => finite(r.val));
      if (!list.length) { el.innerHTML = '<p class="og-na">n/a</p>'; return; }
      const h = Math.max(28, list.length * 22 + 8);
      const L = opts.left || 92, R = 44;
      const max = Math.max(...list.map(r => Math.abs(r.val))) || 1;
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "bars") + '">';
      list.forEach((r, i) => {
        const y = 6 + i * 22;
        const bw = (w - L - R) * Math.abs(r.val) / max;
        s += '<text x="' + (L - 6) + '" y="' + (y + 10) + '" fill="#a0a9ba" font-size="10" text-anchor="end">' + esc(r.name) + "</text>";
        s += '<rect x="' + L + '" y="' + y + '" width="' + Math.max(2, bw).toFixed(1) + '" height="12" rx="3" fill="' + hexA(r.color || "#e8c56b", r.on ? 0.95 : 0.45) + '"/>';
        s += '<text x="' + (L + bw + 4) + '" y="' + (y + 10) + '" fill="#e5e9f0" font-size="10">' + esc(r.label || fmt(r.val, 1)) + "</text>";
      });
      s += "</svg>";
      el.innerHTML = s;
    });
  }
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }
  /* Coloured bar is historical min to max only. The latest marker may sit outside it. */
  function rangeBar(el, st) {
    watch(el, w => {
      const vals = [st.min, st.max, st.val].filter(finite);
      if (vals.length < 2 || !finite(st.min) || !finite(st.max)) { el.innerHTML = ""; return; }
      const h = 28;
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (!(hi > lo)) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.12 || 1;
      lo -= pad; hi += pad;
      const X = v => 2 + (w - 4) * (v - lo) / (hi - lo);
      const y = 4, bh = 8;
      const x1 = X(Math.min(st.min, st.max)), x2 = X(Math.max(st.min, st.max));
      const col = st.color || "#e8c56b";
      let s = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="range">';
      s += '<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + Math.max(bh, x2 - x1).toFixed(1) + '" height="' + bh + '" rx="4" fill="' + hexA(col, 0.4) + '"/>';
      if (finite(st.avg)) {
        const t = Math.max(x1, Math.min(x2, X(st.avg)));
        s += '<line x1="' + t.toFixed(1) + '" x2="' + t.toFixed(1) + '" y1="' + (y - 1) + '" y2="' + (y + bh + 1) + '" stroke="#f4f7fb" stroke-width="2"/>';
      }
      if (finite(st.val)) s += '<circle cx="' + X(st.val).toFixed(1) + '" cy="' + (y + bh / 2) + '" r="3.4" fill="' + col + '"/>';
      s += '<text x="' + x1.toFixed(1) + '" y="26" fill="#8b95a8" font-size="8">' + esc(fmt(st.min, 0)) + "</text>";
      s += '<text x="' + x2.toFixed(1) + '" y="26" fill="#8b95a8" font-size="8" text-anchor="end">' + esc(fmt(st.max, 0)) + "</text>";
      s += "</svg>";
      el.innerHTML = s;
    });
  }
  let ogInfoSeq = 0;
  function park(node, text) {
    const block = node && node.closest ? node.closest(".og-block") : null;
    if (!block || !text) return;
    let panel = block.querySelector(":scope > .info-panel");
    if (!panel) {
      const id = "og-info-" + (++ogInfoSeq);
      const head = block.querySelector(".og-h");
      if (head) head.insertAdjacentHTML("beforeend", '<button type="button" class="info" aria-expanded="false" aria-controls="' + id + '" aria-label="Sources and notes">i</button>');
      block.insertAdjacentHTML("beforeend", '<div class="info-panel" id="' + id + '" hidden></div>');
      panel = block.querySelector(":scope > .info-panel");
    }
    panel.insertAdjacentHTML("beforeend", "<p>" + text + "</p>");
  }
  document.addEventListener("click", e => {
    const btn = e.target.closest("#oilgasView .og .info, #miningView .og .info");
    if (!btn) return;
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    panel.hidden = open;
  });
  window.MMV2 = { finite, esc, fmt, signed, pill, money, pxText, hexA, watch, lineChart, stepChart, bars, rangeBar, getJSON, park };
})();
