/* Tile candles. Rows from market.json carry r.ohlc = {d: [[o,h,l,c] x ~22 sessions], d0, m: [[o,h,l,c] x 13 months], m0}.
   One candle per day on the short scale, one per calendar month on the long one. Green when the bar closed at or
   above its open, red below. A bar without an open is drawn as a grey close tick, never a made-up body.
   svg() returns "" when a row has no candles for that scale, so the caller keeps its line. window.MMCandles. */
(function () {
  "use strict";
  const KEY = "emmaCandles";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function scale() { try { return localStorage.getItem(KEY) === "m" ? "m" : "d"; } catch (e) { return "d"; } }
  function setScale(s) { try { localStorage.setItem(KEY, s === "m" ? "m" : "d"); } catch (e) { /* private mode */ } }
  function bars(r, sc) {
    const o = r && r.ohlc;
    const b = o && o[sc === "m" ? "m" : "d"];
    if (!Array.isArray(b) || b.length < 2) return null;
    const ok = b.filter(x => Array.isArray(x) && finite(x[3]));
    if (ok.length < 2 || ok.filter(x => finite(x[0]) && finite(x[1]) && finite(x[2])).length < ok.length / 2) return null;
    return ok;
  }
  function since(r, sc) {
    const o = r && r.ohlc;
    if (!o) return "";
    if (sc === "m" && o.m0) { const p = String(o.m0).split("-"); return MON[+p[1] - 1] + " " + p[0]; }
    if (o.d0) { const p = String(o.d0).split("-"); return +p[2] + " " + MON[+p[1] - 1]; }
    return "";
  }
  /* w x h viewBox stretched to the tile (preserveAspectRatio none); crispEdges keeps 1 px wicks and body edges sharp at 1x. */
  function svg(r, sc, opt) {
    const b = bars(r, sc);
    if (!b) return "";
    const o = opt || {};
    const n = b.length, slot = 6, w = n * slot, h = o.h || 36, pad = 2;
    let lo = Infinity, hi = -Infinity;
    b.forEach(x => x.forEach(v => { if (finite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
    if (!(hi > lo)) { hi = lo + Math.abs(lo || 1) * 0.01; lo -= Math.abs(lo || 1) * 0.01; }
    const Y = v => pad + (1 - (v - lo) / (hi - lo)) * (h - 2 * pad);
    const bw = 4, parts = [];
    b.forEach((x, i) => {
      const cx = i * slot + slot / 2, op = x[0], c = x[3];
      const top = Math.max.apply(null, x.filter(finite)), bot = Math.min.apply(null, x.filter(finite));
      if (!finite(op)) {
        parts.push('<path d="M' + (cx - bw / 2) + " " + Y(c).toFixed(2) + "h" + bw + '" stroke="var(--muted)" stroke-width="1.5"/>');
        return;
      }
      const up = c >= op;
      const col = up ? "var(--good)" : "var(--bad)";
      const y1 = Y(Math.max(op, c)), y2 = Y(Math.min(op, c));
      parts.push('<g fill="' + col + '" stroke="' + col + '"><path d="M' + cx + " " + Y(top).toFixed(2) + "V" + Y(bot).toFixed(2) + '" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
        '<rect x="' + (cx - bw / 2) + '" y="' + y1.toFixed(2) + '" width="' + bw + '" height="' + Math.max(1, y2 - y1).toFixed(2) + '" stroke="none"/></g>');
    });
    const label = (sc === "m" ? n + " monthly candles" : n + " daily candles") + (since(r, sc) ? " from " + since(r, sc) : "");
    return '<svg class="' + (o.cls || "spark") + ' cdl" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="' + label + '"><title>' + label + "</title>" + parts.join("") + "</svg>";
  }
  /* "Daily · 1M | Monthly · 1Y" switch; onChange(scale) redraws the caller's tiles. */
  function toggle(sc) {
    const btn = (k, txt, tip) => '<button type="button" data-cdl="' + k + '" aria-pressed="' + (sc === k) + '" title="' + tip + '">' + txt + "</button>";
    return '<div class="cdl-scale" role="group" aria-label="Candle scale">' + btn("d", "Daily · 1M", "One candle per trading day, last month") + btn("m", "Monthly · 1Y", "One candle per calendar month, last year (this month to date)") + "</div>";
  }
  function wire(root, onChange) {
    if (!root || root._cdlWired) return;
    root._cdlWired = true;
    root.addEventListener("click", e => {
      const t = e.target.closest && e.target.closest("[data-cdl]");
      if (!t || !root.contains(t)) return;
      e.preventDefault();
      setScale(t.dataset.cdl);
      onChange(scale());
    });
  }
  window.MMCandles = { scale: scale, setScale: setScale, bars: bars, svg: svg, toggle: toggle, wire: wire, since: since };
})();
