/* Sector maps (treemaps) for the Markets Equities Monitor, drawn natively from emmi-data data/region_maps.json
   (scripts/build_region_maps.py): S&P 500, Europe top 80, Nikkei 225, CSI 300. window.EMMITreemap.
   Two levels, squarified: sectors by weight, then companies by market cap (CSI 300: index weight). Box colour = the day's
   % move (green up, red down, slate near zero; the same ramp in light and dark, white labels on every shade). Names and
   moves are printed only where they fit; every box has a hover / tap card with the full name, sector, price, move and size.
   Very small boxes in a sector fold into one "+N more" box (its card lists them). Re-laid out on resize. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const finite = v => typeof v === "number" && isFinite(v);
  const sg = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(d == null ? 2 : d) + "%" : "n/a");

  /* ---------- squarified layout (Bruls, Huizing, van Wijk) ---------- */
  function worst(row, w) {
    let s = 0, mx = -Infinity, mn = Infinity;
    row.forEach(r => { s += r.a; if (r.a > mx) mx = r.a; if (r.a < mn) mn = r.a; });
    const s2 = s * s, w2 = w * w;
    return Math.max(w2 * mx / s2, s2 / (w2 * mn));
  }
  /* items: [{v, ...}] (v > 0) -> same objects with x, y, w, h inside the rect */
  function squarify(items, x, y, w, h) {
    const tot = items.reduce((a, b) => a + b.v, 0);
    if (!(tot > 0) || w <= 0 || h <= 0) return [];
    const scale = (w * h) / tot;
    const rest = items.filter(i => i.v > 0).sort((a, b) => b.v - a.v).map(i => Object.assign(i, { a: i.v * scale }));
    const out = [];
    let row = [];
    while (rest.length) {
      const side = Math.min(w, h), c = rest[0];
      if (!row.length || worst(row.concat([c]), side) <= worst(row, side)) { row.push(rest.shift()); continue; }
      ({ x, y, w, h } = place(row, x, y, w, h, out));
      row = [];
    }
    if (row.length) place(row, x, y, w, h, out);
    return out;
  }
  function place(row, x, y, w, h, out) {
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {               /* column on the left */
      const cw = s / h; let yy = y;
      row.forEach(r => { const rh = r.a / cw; out.push(Object.assign(r, { x: x, y: yy, w: cw, h: rh })); yy += rh; });
      return { x: x + cw, y: y, w: w - cw, h: h };
    }
    const rh = s / w; let xx = x;   /* row on top */
    row.forEach(r => { const rw = r.a / rh; out.push(Object.assign(r, { x: xx, y: y, w: rw, h: rh })); xx += rw; });
    return { x: x, y: y + rh, w: w, h: h - rh };
  }

  /* ---------- colour: % move -> fill (white text passes 4.5:1 on every shade) ---------- */
  const NEU = [91, 101, 115], UP = [21, 128, 61], DN = [185, 28, 28], UP2 = [20, 83, 45], DN2 = [127, 29, 29];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function heat(v, cap) {
    if (!finite(v)) return "rgb(" + NEU.join(",") + ")";
    const t = Math.min(1, Math.abs(v) / (cap || 3)), hi = v > 0 ? UP : DN, deep = v > 0 ? UP2 : DN2;
    const c = t < 0.08 ? NEU : t < 0.7 ? mix(NEU, hi, (t - 0.08) / 0.62) : mix(hi, deep, (t - 0.7) / 0.3);
    return "rgb(" + c.join(",") + ")";
  }

  /* ---------- one map ---------- */
  const HEAD = 15;   /* sector label band, px */
  const MIN_FS = 8;  /* smallest box label font, px */
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';   /* as .tm-l in live.css */
  let CTX = null;
  function textW(t, wt, fs) {
    if (!CTX) { try { CTX = document.createElement("canvas").getContext("2d"); } catch (e) { CTX = null; } }
    if (!CTX) return t.length * fs * 0.6;
    CTX.font = wt + " " + fs + "px " + FONT;
    return CTX.measureText(t).width + 1;
  }
  function fmtCap(it, ccy) {
    if (finite(it[6])) { const v = it[6]; return (v >= 1000 ? (v / 1000).toFixed(2) + " trn" : v >= 10 ? v.toFixed(0) + " bn" : v.toFixed(1) + " bn") + " " + ccy; }
    return null;
  }
  function layout(map, W, H, opt) {
    const minA = (opt && opt.minArea) || 90;
    const secs = (map.sectors || []).filter(s => s.wt > 0).map(s => ({ v: s.wt, s: s }));
    const boxes = [], heads = [];
    squarify(secs, 0, 0, W, H).forEach(r => {
      const s = r.s, band = r.h > 46 && r.w > 44 ? HEAD : 0;
      heads.push({ x: r.x, y: r.y, w: r.w, h: r.h, band: band, s: s });
      const area = r.w * (r.h - band), tot = s.items.reduce((a, b) => a + (b[4] || 0), 0);
      if (!(tot > 0) || area <= 0) return;
      let keep = s.items.filter(it => (it[4] || 0) / tot * area >= minA);
      if (!keep.length) keep = s.items.slice(0, 1);
      const rest = s.items.slice(keep.length);
      const kids = keep.map(it => ({ v: it[4] || 0, it: it }));
      if (rest.length) {
        const rv = rest.reduce((a, b) => a + (b[4] || 0), 0), w0 = rest.map(it => (it[4] || 0) / (1 + (it[3] || 0) / 100));
        const rc = w0.reduce((a, b) => a + b, 0) ? rest.reduce((a, it, i) => a + w0[i] * (it[3] || 0), 0) / w0.reduce((a, b) => a + b, 0) : null;
        kids.push({ v: rv, more: rest, chg: rc });
      }
      squarify(kids, r.x, r.y + band, r.w, r.h - band).forEach(k => boxes.push(Object.assign(k, { s: s })));
    });
    return { boxes: boxes, heads: heads };
  }
  function render(host, map, opt) {
    opt = opt || {};
    const W = Math.max(120, Math.floor(host.clientWidth || opt.width || 600));
    const H = Math.max(160, Math.round(opt.height ? opt.height(W) : W * 0.62));
    const L = layout(map, W, H, opt), REG = [];
    /* Label rule: try the short name on one line, then on two lines, then the bare ticker, stepping the font down from the box's natural size to
       MIN_FS px (text width measured, not guessed); the % line only where a second line fits. */
    const lab = (b) => {
      const w = b.w - 6, h = b.h - 2;   /* 1px border each side, 2px label padding each side */
      if (w < 10 || h < MIN_FS * 1.15) return "";
      const fs0 = Math.max(MIN_FS, Math.min(15, Math.floor(Math.min(b.w / 4.6, b.h / 2.4))));
      const chg = b.more ? b.chg : b.it[3], pct = sg(chg, 1);
      const name = b.more ? "+" + b.more.length : b.it[1], tk = b.more ? "" : String(b.it[0] || "").replace(/\.[A-Z]+$/, "");
      const sp = name.indexOf(" ") > 0 ? name.split(" ") : null;
      const two = sp ? [sp.slice(0, Math.ceil(sp.length / 2)).join(" "), sp.slice(Math.ceil(sp.length / 2)).join(" ")] : null;
      const tries = [[name]].concat(two ? [two] : [], tk && tk !== name ? [[tk]] : []);   /* name, name on 2 lines, ticker */
      for (const lines of tries) {
        for (let fs = fs0; fs >= MIN_FS; fs--) {
          const nh = lines.length * fs * 1.12;
          if (nh + fs * 0.03 > h || lines.some(t => textW(t, 750, fs) > w)) continue;
          const showChg = nh + fs * 0.86 * 1.15 <= h && textW(pct, 600, fs * 0.86) <= w;
          return '<span class="tm-l" style="font-size:' + fs + 'px">' + lines.map(t => "<b>" + esc(t) + "</b>").join("") + (showChg ? "<i>" + esc(pct) + "</i>" : "") + "</span>";
        }
      }
      return "";
    };
    const px = v => Math.round(v * 10) / 10;
    let html = '<div class="tm-box" style="height:' + H + 'px" role="img" aria-label="' + esc(map.name + " sector map, " + map.label + ": " + map.adv + " up, " + map.dec + " down; " + (map.index_name || map.name) + " " + sg(map.index_chg)) + '">';
    L.heads.forEach(hd => {
      html += '<div class="tm-sec" style="left:' + px(hd.x) + "px;top:" + px(hd.y) + "px;width:" + px(hd.w) + "px;height:" + px(hd.h) + 'px">' +
        (hd.band ? '<span class="tm-sh" style="height:' + HEAD + 'px" title="' + esc(hd.s.name + " " + sg(hd.s.chg) + " · " + hd.s.wt + "% of the map") + '">' + esc(hd.w > 120 ? hd.s.short : hd.s.tiny) + (hd.w > 74 ? " <i>" + esc(sg(hd.s.chg, 1)) + "</i>" : "") + "</span>" : "") + "</div>";
    });
    L.boxes.forEach(b => {
      const i = REG.push(b) - 1, chg = b.more ? b.chg : b.it[3];
      html += '<div class="tm-c" data-tm="' + i + '" tabindex="-1" style="left:' + px(b.x) + "px;top:" + px(b.y) + "px;width:" + px(b.w) + "px;height:" + px(b.h) + "px;background:" + heat(chg, opt.cap) + '">' + lab(b) + "</div>";
    });
    html += '</div><div class="tm-tip" hidden></div>';
    host.innerHTML = html;
    host._tm = { REG: REG, map: map, W: W };
    wire(host);
  }
  function tipHTML(b, map) {
    if (b.more) {
      const top = b.more.slice(0, 8).map(it => "<li><span>" + esc(it[1]) + "</span><i class=\"" + (it[3] > 0 ? "up" : it[3] < 0 ? "dn" : "") + "\">" + esc(sg(it[3], 1)) + "</i></li>").join("");
      return "<b>" + esc(b.s.name) + ": " + b.more.length + " smaller names</b><span class=\"tm-tm\">" + esc(sg(b.chg)) + " cap-weighted</span><ul>" + top + "</ul>" + (b.more.length > 8 ? "<small>and " + (b.more.length - 8) + " more</small>" : "");
    }
    const it = b.it, cap = fmtCap(it, map.ccy);
    const pxs = finite(it[5]) ? it[5].toLocaleString("en-GB", { maximumFractionDigits: it[5] < 100 ? 2 : 1 }) + " " + esc(map.key === "eu80" ? "" : map.ccy) : "";
    return "<b>" + esc(it[2] || it[1]) + '</b><span class="tm-tk">' + esc(it[0]) + " · " + esc(b.s.name) + "</span>" +
      '<span class="tm-mv ' + (it[3] > 0 ? "up" : it[3] < 0 ? "dn" : "") + '">' + esc(sg(it[3])) + "</span>" +
      (pxs ? "<span>Price " + pxs.trim() + "</span>" : "") +
      (cap ? "<span>Mkt cap " + esc(cap) + "</span>" : "") +
      "<span>" + (map.key === "csi300" ? "Index weight " : "Weight in map ") + esc(finite(it[4]) ? it[4].toFixed(2) + "%" : "n/a") + "</span>" +
      "<small>" + esc(map.label + " · " + map.basis) + "</small>";
  }
  function wire(host) {
    if (host._tmWired) return;
    host._tmWired = true;
    const tip = () => host.querySelector(".tm-tip");
    const show = (el, ev) => {
      const st = host._tm, t = tip();
      if (!st || !t || !el) return;
      const b = st.REG[+el.dataset.tm];
      if (!b) return;
      t.innerHTML = tipHTML(b, st.map);
      t.hidden = false;
      host.querySelectorAll(".tm-c.on").forEach(x => x.classList.remove("on"));
      el.classList.add("on");
      const hb = host.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
      const cx = ev && finite(ev.clientX) ? ev.clientX - hb.left : b.x + b.w / 2, cy = ev && finite(ev.clientY) ? ev.clientY - hb.top : b.y + b.h / 2;
      let x = cx + 12, y = cy + 12;
      if (x + tw > hb.width - 2) x = Math.max(2, cx - tw - 12);
      if (y + th > hb.height + 40) y = Math.max(2, cy - th - 12);
      t.style.left = Math.round(x) + "px"; t.style.top = Math.round(y) + "px";
    };
    const hide = () => { const t = tip(); if (t) t.hidden = true; host.querySelectorAll(".tm-c.on").forEach(x => x.classList.remove("on")); };
    const touch = () => window.matchMedia && window.matchMedia("(hover: none)").matches;
    host.addEventListener("mousemove", e => { if (touch()) return; const c = e.target.closest && e.target.closest(".tm-c"); if (c) show(c, e); else hide(); });
    host.addEventListener("mouseleave", () => { if (!touch()) hide(); });
    host.addEventListener("click", e => {
      const c = e.target.closest && e.target.closest(".tm-c");
      if (!c) { hide(); return; }
      e.stopPropagation();
      if (c.classList.contains("on") && touch()) { hide(); return; }
      show(c, e);
    });
    document.addEventListener("click", e => { if (!host.contains(e.target)) hide(); });
    if (window.ResizeObserver) {
      let last = host.clientWidth, tmr = 0;
      new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - last) < 2 || !host._tm) return; last = w; clearTimeout(tmr); tmr = setTimeout(() => render(host, host._tm.map, host._tmOpt), 120); }).observe(host);
    }
  }
  function mount(host, map, opt) { host._tmOpt = opt || {}; render(host, map, host._tmOpt); }
  window.EMMITreemap = { squarify: squarify, heat: heat, layout: layout, mount: mount, render: render, tipHTML: tipHTML };
})();
