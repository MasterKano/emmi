/* Commitments of Traders (window.EMMICot). Reads data/cot.json (emmi-data live-data, built weekly by
   scripts/build_metals.py from the CFTC disaggregated futures-only report and ICE Futures Europe's COT files).
   Managed money = hedge funds and CTAs. Each market: w = [[date, OI, MM long, MM short, producer long, producer short,
   swap long, swap short]] oldest first, s = latest stats (net, w/w changes, 1y/3y percentiles of the net).
   card(m)  : one market, headline net, long/short split of open interest, 3-year percentile track and a net chart.
   strip(ms): compact rows (diverging net bar, w/w, percentile, 1-year sparkline); a row opens its card in place.
   Period buttons share the site-wide candle scale (MMCandles: "d" short, "m" long) so one click flips every chart:
   reports are weekly, so short = the last 13 reports (3 months) and long = the last 52 (1 year). */
(function () {
  "use strict";
  const f = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let P = null, DATA = null;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!P) P = fetch("data/cot.json?t=" + Math.floor(Date.now() / 36e5)).then(r => { if (!r.ok) throw Error("cot.json " + r.status); return r.json(); }).then(d => (DATA = d)).catch(e => { P = null; throw e; });
    return P;
  }
  function byId(d, id) { return ((d && d.markets) || []).find(m => m.id === id) || null; }
  function bySym(d, sym) { return ((d && d.markets) || []).find(m => m.sym === sym) || null; }
  function k(v, sign) {
    if (!f(v)) return "n/a";
    const a = Math.abs(v), s = v < 0 ? "−" : sign && v > 0 ? "+" : "";
    if (a >= 1e6) return s + (a / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 2 }) + "m";
    if (a >= 1e4) return s + (a / 1e3).toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "k";
    return s + Math.round(a).toLocaleString("en-GB");
  }
  function day(iso, yr) { const p = String(iso || "").split("-"); return p.length < 3 ? "" : +p[2] + " " + MON[+p[1] - 1] + (yr ? " " + p[0] : ""); }
  function ord(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function ageDays(iso) { const t = Date.parse(String(iso || "") + "T12:00:00Z"); return Number.isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : null; }
  function scale() { return window.MMCandles ? MMCandles.scale() : "d"; }
  function weeks(sc) { return sc === "m" ? 52 : 13; }
  /* reading of the percentile; extremes are where positioning tends to matter for price */
  function crowd(p) {
    if (!f(p)) return { t: "", c: "" };
    if (p >= 90) return { t: "near 3-year high", c: "hot" };
    if (p >= 75) return { t: "high", c: "warm" };
    if (p <= 10) return { t: "near 3-year low", c: "cold" };
    if (p <= 25) return { t: "low", c: "cool" };
    return { t: "mid-range", c: "" };
  }
  function chip(v, title) {
    if (!f(v)) return '<span class="cot-chip">n/a</span>';
    return '<span class="cot-chip ' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '"' + (title ? ' title="' + esc(title) + '"' : "") + ">" + esc(k(v, true)) + "</span>";
  }
  function toggle(sc) {
    const b = (key, t, s, tip) => '<button type="button" data-cot-sc="' + key + '" aria-pressed="' + (sc === key) + '" title="' + tip + '">' + t + " <small>" + s + "</small></button>";
    return '<div class="cot-sc" role="group" aria-label="Chart period">' + b("d", "3M", "weekly", "Short view: the last 13 weekly reports. Follows the 1M setting on price charts") + b("m", "1Y", "weekly", "Long view: the last 52 weekly reports. Follows the 1Y setting on price charts") + "</div>";
  }
  function stamp(m) {
    const s = m.s || {}, a = ageDays(s.date);
    const late = a != null && a > 12;
    return '<span class="cot-when' + (late ? " late" : "") + '" title="Positions as of this Tuesday; ' + esc(m.exch === "CFTC" ? "CFTC publishes on Friday 15:30 New York" : "ICE Futures Europe publishes on Friday") + '">Positions ' + esc(day(s.date)) + (late ? " · " + a + " days old" : "") + (m.stale ? " · stale copy" : "") + "</span>";
  }
  /* long/short split of open interest: shorts grow left of centre, longs right */
  function split(s) {
    if (!f(s.long) || !f(s.short) || !f(s.oi) || !s.oi) return "";
    const L = 100 * s.long / s.oi, S = 100 * s.short / s.oi, mx = Math.max(L, S, 1);
    const w = v => Math.max(1.5, 48 * v / mx).toFixed(1);
    return '<div class="cot-split" title="Managed money long and short, as a share of open interest">' +
      '<div class="cot-sbar"><span class="cot-s dn" style="width:' + w(S) + '%"></span><i></i><span class="cot-s up" style="width:' + w(L) + '%"></span></div>' +
      '<div class="cot-slab"><span><b>Short</b> ' + esc(k(s.short)) + ' <em>' + esc(S.toFixed(0)) + '% OI</em> ' + chip(s.short_wow, "Change in shorts on the week") + '</span><span><b>Long</b> ' + esc(k(s.long)) + ' <em>' + esc(L.toFixed(0)) + '% OI</em> ' + chip(s.long_wow, "Change in longs on the week") + "</span></div></div>";
  }
  /* 3-year range of the net with today's marker and the quartile zones */
  function track(s) {
    if (!f(s.lo_3y) || !f(s.hi_3y) || !f(s.net)) return "";
    const lo = s.lo_3y, hi = s.hi_3y, x = hi > lo ? 100 * (s.net - lo) / (hi - lo) : 50;
    const z = hi > lo && lo < 0 && hi > 0 ? 100 * (0 - lo) / (hi - lo) : null;
    const cr = crowd(s.pct_3y);
    return '<div class="cot-track" title="Where this week\'s net position sits in its 3-year range (percentile = share of the last ~156 weeks at or below it)">' +
      '<div class="cot-tbar">' + (z != null ? '<i class="cot-zero" style="left:' + z.toFixed(1) + '%"></i>' : "") + '<b class="cot-mark ' + cr.c + '" style="left:' + Math.max(0, Math.min(100, x)).toFixed(1) + '%"></b></div>' +
      '<div class="cot-tlab"><span>' + esc(k(lo, true)) + '</span><span class="cot-pct ' + cr.c + '">' + (f(s.pct_3y) ? esc(ord(s.pct_3y)) + " percentile, 3y" : "") + (cr.t ? " · " + esc(cr.t) : "") + '</span><span>' + esc(k(hi, true)) + "</span></div></div>";
  }
  function head(m) {
    const s = m.s || {};
    const side = !f(s.net) ? "Net" : s.net >= 0 ? "Net long" : "Net short";
    return '<div class="cot-hd"><div class="cot-nm"><span class="cot-n">' + esc(m.name) + '</span><span class="cot-ex">' + esc(m.exch === "CFTC" ? "CFTC · managed money" : "ICE Europe · managed money") + "</span></div>" + stamp(m) + "</div>" +
      '<div class="cot-net"><span class="cot-big ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '"><small>' + side + "</small>" + esc(k(f(s.net) ? Math.abs(s.net) : null)) + "</span>" + chip(s.net_wow, "Change in the net position on the week") + '<span class="cot-u">contracts · ' + (f(s.net_pct_oi) ? esc((s.net_pct_oi > 0 ? "+" : "") + s.net_pct_oi.toFixed(1).replace("-", "−")) + "% of OI" : "") + "</span></div>";
  }
  function drawChart(el, m, sc) {
    const C = window.EMMICharts;
    const w = (m.w || []).slice(-weeks(sc));
    if (!C || w.length < 2) { el.innerHTML = ""; return; }
    const net = w.map(r => f(r[2]) && f(r[3]) ? r[2] - r[3] : null);
    const dates = w.map(r => r[0]);
    const n = w.length, every = sc === "m" ? 13 : 4;
    C.lines(el, {
      h: 118, d: 0, zero: true, aria: m.name + " managed money net position, last " + n + " weekly reports",
      labels: dates.map(x => day(x, true)), ticks: dates.map((x, i) => (n - 1 - i) % every === 0 ? day(x) : null),
      series: [{ name: "Net", vals: net, color: "var(--cot-net)", width: 1.9, area: true, end: true }],
      tip: i => C.tipRows("Week to " + day(dates[i], true), [
        { k: "Net", v: k(net[i], true), color: "var(--cot-net)" },
        { k: "Long", v: k(w[i][2]) }, { k: "Short", v: k(w[i][3]) }, { k: "Open interest", v: k(w[i][1]) }])
    });
  }
  function foot(m) {
    const s = m.s || {};
    const bits = ["Open interest " + k(s.oi) + (f(s.oi_wow) ? " (" + k(s.oi_wow, true) + " w/w)" : "")];
    if (f(s.prod_net)) bits.push("Producers net " + k(s.prod_net, true));
    if (f(s.swap_net)) bits.push("Swap dealers net " + k(s.swap_net, true));
    return '<p class="cot-ft">' + esc(bits.join(" · ")) + ' · <a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">' + esc(m.exch === "CFTC" ? "CFTC" : "ICE") + " ↗</a></p>";
  }
  function card(m, sc) {
    const el = document.createElement("div");
    el.className = "cot-card";
    el.dataset.cot = m.id;
    el.innerHTML = head(m) + split(m.s || {}) + track(m.s || {}) + '<div class="cot-ch"></div>' + foot(m);
    drawChart(el.querySelector(".cot-ch"), m, sc || scale());
    return el;
  }
  function spark(m) {
    const w = (m.w || []).slice(-52), v = w.map(r => f(r[2]) && f(r[3]) ? r[2] - r[3] : null).filter(f);
    if (v.length < 2) return "";
    let lo = Math.min(0, ...v), hi = Math.max(0, ...v);
    if (!(hi > lo)) hi = lo + 1;
    const W = 120, H = 26, X = i => (i / (v.length - 1)) * W, Y = x => 2 + (1 - (x - lo) / (hi - lo)) * (H - 4);
    const d = v.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(x).toFixed(1)).join("");
    return '<svg class="cot-sp" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="' + W + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="z"/><path d="' + d + '"/></svg>';
  }
  function row(m) {
    const s = m.s || {};
    const p = f(s.net_pct_oi) ? Math.max(-100, Math.min(100, s.net_pct_oi)) : null;
    const cr = crowd(s.pct_3y);
    const bar = p == null ? "" : '<span class="cot-rb"><i class="' + (p >= 0 ? "up" : "dn") + '" style="' + (p >= 0 ? "left:50%" : "right:50%") + ";width:" + Math.max(1, Math.min(50, Math.abs(p) * 1.25)).toFixed(1) + '%"></i></span>';
    return '<details class="cot-row" data-cot="' + esc(m.id) + '"><summary><span class="cot-rn">' + esc(m.name) + '<small>' + esc(m.exch === "CFTC" ? "" : "ICE Europe") + "</small></span>" + bar +
      '<span class="cot-rv ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '">' + esc(k(s.net, true)) + "</span>" + chip(s.net_wow, "Week-on-week change in the net") +
      '<span class="cot-rp ' + cr.c + '" title="' + esc(cr.t) + '">' + (f(s.pct_3y) ? esc(ord(s.pct_3y)) : "–") + "</span>" + spark(m) + "</summary><div class=\"cot-rx\"></div></details>";
  }
  /* mount(host, {ids, title, lede, layout: "cards"|"rows", groups: [[label, [ids]]], link}) */
  function mount(host, o) {
    o = o || {};
    const sec = host;
    sec.classList.add("cot");
    sec.innerHTML = '<p class="og-na">Loading trader positioning…</p>';
    return load().then(d => {
      let sc = scale();
      const pick = ids => ids.map(id => byId(d, id)).filter(Boolean);
      const draw = () => {
        sec.innerHTML = "";
        const bar = document.createElement("div");
        bar.className = "cot-bar";
        const rep = d.report_date;
        bar.innerHTML = '<p class="cot-lede">' + (o.lede || "") + "</p>" + toggle(sc);
        sec.appendChild(bar);
        if (o.layout === "rows") {
          let first = true;
          (o.groups || [["", o.ids || []]]).forEach(([label, ids]) => {
            const ms = pick(ids);
            if (!ms.length) return;
            const g = document.createElement("div");
            g.className = "cot-grp";
            g.innerHTML = (label ? '<h3 class="cot-gh">' + esc(label) + "</h3>" : "") + '<div class="cot-rows">' + (first ? '<div class="cot-rh"><span>Market</span><span title="Net position as a share of open interest; full bar is 40% or more">Net % OI</span><span>Net</span><span>w/w</span><span>3y pct</span><span>1 year</span></div>' : "") + ms.map(row).join("") + "</div>";
            sec.appendChild(g);
            first = false;
          });
          sec.querySelectorAll("details.cot-row").forEach(dt => dt.addEventListener("toggle", () => {
            const x = dt.querySelector(".cot-rx");
            if (dt.open && !x.firstChild) { const m = byId(d, dt.dataset.cot); if (m) x.appendChild(card(m, sc)); }
          }));
        } else {
          const grid = document.createElement("div");
          grid.className = "cot-cards";
          pick(o.ids || []).forEach(m => grid.appendChild(card(m, sc)));
          sec.appendChild(grid);
        }
        const notes = (d.errors || []).length ? '<p class="cot-note">Some reports could not be refreshed on the last run; the last good copy is shown and dated.</p>' : "";
        sec.insertAdjacentHTML("beforeend", notes + '<p class="cot-note">' + (rep ? "Latest CFTC report: positions on Tuesday " + esc(day(rep, true)) + ". " : "") + "Managed money = hedge funds and CTAs (the CFTC disaggregated report). Net = long minus short, in contracts. Percentile = share of the last three years of weekly reports with a net position at or below this week’s. Futures only; options excluded.</p>");
      };
      draw();
      sec.addEventListener("click", e => {
        const b = e.target.closest("[data-cot-sc]");
        if (!b) return;
        sc = b.getAttribute("data-cot-sc");
        if (window.MMCandles) MMCandles.setScale(sc);
        const open = [...sec.querySelectorAll("details.cot-row[open]")].map(x => x.dataset.cot);
        draw();
        open.forEach(id => { const x = sec.querySelector('details.cot-row[data-cot="' + id + '"]'); if (x) x.open = true; });
        document.dispatchEvent(new CustomEvent("emmi:scale", { detail: sc }));
      });
      document.addEventListener("emmi:scale", e => { if (e.detail !== sc && sec.isConnected) { sc = e.detail; draw(); } });
      return d;
    }).catch(() => { sec.innerHTML = '<p class="og-na">Trader positioning is not available right now.</p>'; });
  }
  /* the EMMi section that shows a market's positioning */
  function where(m) {
    if (!m) return null;
    if (m.group === "precious" || m.group === "base") return "#markets/metals/mtCot";
    if (m.group === "energy") return "#energy/oil/ogCot";
    return "#markets/mkt-cot";
  }
  /* one-line summary for hover cards: "Funds net long 112.3k (+8.7k w/w), 35th pct of 3y · 10 Nov" */
  function line(m) {
    const s = m && m.s;
    if (!s || !f(s.net)) return "";
    return "Funds " + (s.net >= 0 ? "net long " : "net short ") + k(Math.abs(s.net)) + (f(s.net_wow) ? " (" + k(s.net_wow, true) + " w/w)" : "") + (f(s.pct_3y) ? ", " + ord(s.pct_3y) + " pct of 3y" : "") + " · " + day(s.date);
  }
  window.EMMICot = { peek: () => DATA, where: where, load: load, byId: byId, bySym: bySym, card: card, mount: mount, line: line, crowd: crowd, k: k };
})();
