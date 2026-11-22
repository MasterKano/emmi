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
  function scale() { return window.MMCandles ? window.MMCandles.scale() : "d"; }
  function weeks(sc) { return sc === "m" ? 52 : 13; }
  function isMifid(m) { return !!(m && (m.scheme === "mifid" || m.exch === "ICE Endex")); }
  function exchShort(m) {
    if (!m) return "";
    if (m.exch === "CFTC") return "CFTC";
    if (m.exch === "ICE Endex") return "Endex";
    if ((m.exch || "").indexOf("ICE") === 0) return "ICE";
    return m.exch || "";
  }
  function exchLine(m) {
    if (!m) return "";
    if (m.exch === "CFTC") return "CFTC · managed money";
    if (isMifid(m)) return "ICE Endex · investment funds";
    return "ICE Europe · managed money";
  }
  function unitWord(m) {
    const u = String((m && m.unit) || "").toLowerCase();
    if (u === "mwh" || u === "mwho") return "MWh";
    if (u === "lots" || u === "lot") return "lots";
    return "contracts";
  }
  function pubHint(m) {
    if (isMifid(m)) return "Positions for the week ending Friday; ICE Endex publishes the following Wednesday and ESMA republishes the same report";
    if (m && m.exch === "CFTC") return "Positions as of Tuesday; CFTC publishes on Friday 15:30 New York";
    return "Positions as of Tuesday; ICE Futures Europe publishes on Friday";
  }
  /* Shared method text, said once per section (behind the i), never on every card. */
  function methodNote(m) {
    if (isMifid(m)) {
      return "Investment funds under MiFID II. Net = longs minus shorts, in " + unitWord(m) + ". The bar is the long/short split as a share of open interest. The marker is this week's net in its three-year range; the percentile is the share of weekly readings at or below it. Crowded longs or shorts can be a contrarian signal. The line is the same net week by week (3M = last 13 reports, 1Y = last 52). Positions for the week ending Friday; ICE Endex publishes the following Wednesday and ESMA republishes the same report.";
    }
    return "Managed money = hedge funds and CTAs (the CFTC disaggregated report, or ICE Futures Europe). Net = longs minus shorts, in contracts. The bar is the long/short split as a share of open interest. The marker is this week's net in its three-year range; the percentile is the share of weekly readings at or below it. Crowded longs or shorts can be a contrarian signal. The line is the same net week by week (3M = last 13 reports, 1Y = last 52). Positions as of Tuesday, published Friday. Futures only; options excluded.";
  }
  function sectionNote(d) {
    return (d && d.report_date ? "Latest CFTC report: positions on Tuesday " + day(d.report_date, true) + ". " : "") + methodNote(null);
  }
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
    return '<span class="cot-when' + (late ? " late" : "") + '" title="' + esc(pubHint(m)) + '">Positions ' + esc(day(s.date)) + (late ? " · " + a + " days old" : "") + (m.stale ? " · stale copy" : "") + "</span>";
  }
  /* long/short split of open interest: shorts grow left of centre, longs right */
  function split(s) {
    if (!f(s.long) || !f(s.short) || !f(s.oi) || !s.oi) return "";
    const L = 100 * s.long / s.oi, S = 100 * s.short / s.oi, mx = Math.max(L, S, 1);
    const w = v => Math.max(1.5, 48 * v / mx).toFixed(1);
    return '<div class="cot-split" title="Long and short, as a share of open interest">' +
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
    return '<div class="cot-hd"><div class="cot-nm"><span class="cot-n">' + esc(m.name) + '</span><span class="cot-ex">' + esc(exchLine(m)) + "</span></div>" + stamp(m) + "</div>" +
      '<div class="cot-net"><span class="cot-big ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '"><small>' + side + "</small>" + esc(k(f(s.net) ? Math.abs(s.net) : null)) + "</span>" + chip(s.net_wow, "Change in the net position on the week") + '<span class="cot-u">' + esc(unitWord(m)) + " · " + (f(s.net_pct_oi) ? esc((s.net_pct_oi > 0 ? "+" : "") + s.net_pct_oi.toFixed(1).replace("-", "−")) + "% of OI" : "") + "</span></div>";
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
    if (f(s.prod_net)) bits.push((isMifid(m) ? "Commercial net " : "Producers net ") + k(s.prod_net, true));
    if (f(s.swap_net)) bits.push((isMifid(m) ? "Investment firms net " : "Swap dealers net ") + k(s.swap_net, true));
    const srcN = m.exch === "CFTC" ? "CFTC" : isMifid(m) ? "ICE Endex" : "ICE";
    return '<p class="cot-ft">' + esc(bits.join(" · ")) + ' · <a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">' + esc(srcN) + " ↗</a></p>";
  }
  function card(m, sc) {
    const el = document.createElement("div");
    el.className = "cot-card";
    el.dataset.cot = m.id;
    const s = m.s || {};
    el.innerHTML = head(m) + split(s) + track(s) + '<div class="cot-ch"></div>' + foot(m);
    drawChart(el.querySelector(".cot-ch"), m, sc || scale());
    return el;
  }
  function spark(m, n) {
    const w = (m.w || []).slice(-(n || 52)), v = w.map(r => f(r[2]) && f(r[3]) ? r[2] - r[3] : null).filter(f);
    if (v.length < 2) return "";
    let lo = Math.min(0, ...v), hi = Math.max(0, ...v);
    if (!(hi > lo)) hi = lo + 1;
    const W = 120, H = 26, X = i => (i / (v.length - 1)) * W, Y = x => 2 + (1 - (x - lo) / (hi - lo)) * (H - 4);
    const d = v.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(x).toFixed(1)).join("");
    return '<svg class="cot-sp" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="' + W + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="z"/><path d="' + d + '"/></svg>';
  }
  function row(m, per) {
    const s = m.s || {};
    const p = f(s.net_pct_oi) ? Math.max(-100, Math.min(100, s.net_pct_oi)) : null;
    const cr = crowd(s.pct_3y);
    const bar = p == null ? "" : '<span class="cot-rb"><i class="' + (p >= 0 ? "up" : "dn") + '" style="' + (p >= 0 ? "left:50%" : "right:50%") + ";width:" + Math.max(1, Math.min(50, Math.abs(p) * 1.25)).toFixed(1) + '%"></i></span>';
    const dlt = per ? netDelta(m, per) : s.net_wow;
    const dltTip = per ? ("Change in the net over " + per + (per === "1W" ? " (latest week vs the week before)" : "")) : "Week-on-week change in the net";
    const exLab = m.exch === "CFTC" ? "" : isMifid(m) ? "ICE Endex" : "ICE Europe";
    return '<details class="cot-row" data-cot="' + esc(m.id) + '"><summary><span class="cot-rn">' + esc(m.name) + (exLab ? "<small>" + esc(exLab) + "</small>" : "") + "</span>" + bar +
      '<span class="cot-rv ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '">' + esc(k(s.net, true)) + "</span>" + chip(dlt, dltTip) +
      '<span class="cot-rp ' + cr.c + '" title="' + esc(cr.t) + '">' + (f(s.pct_3y) ? esc(ord(s.pct_3y)) : "–") + "</span>" + spark(m, per ? Math.max(2, weeksOf(per) + 1) : 52) + "</summary><div class=\"cot-rx\"></div></details>";
  }
  /* mount(host, {ids, title, lede, layout: "cards"|"rows", groups: [[label, [ids]]], link}) */
  function mount(host, o) {
    o = o || {};
    const sec = host;
    sec.classList.add("cot");
    sec.innerHTML = '<p class="og-na">Loading trader positioning…</p>';
    return load().then(d => {
      let sc = o.period ? (weeksOf(o.period) >= 52 ? "m" : "d") : scale();
      const pick = ids => ids.map(id => byId(d, id)).filter(Boolean);
      const draw = () => {
        sec.innerHTML = "";
        const bar = document.createElement("div");
        bar.className = "cot-bar";
        bar.innerHTML = '<p class="cot-lede">' + (o.lede || "") + "</p>" + (o.hideToggle ? "" : toggle(sc));
        sec.appendChild(bar);
        if (o.layout === "rows") {
          let first = true;
          (o.groups || [["", o.ids || []]]).forEach(([label, ids]) => {
            const ms = pick(ids);
            if (!ms.length) return;
            const g = document.createElement("div");
            g.className = "cot-grp";
            g.innerHTML = (label ? '<h3 class="cot-gh">' + esc(label) + "</h3>" : "") + '<div class="cot-rows">' + (first ? '<div class="cot-rh"><span>Market</span><span title="Net position as a share of open interest; full bar is 40% or more">Net % OI</span><span>Net</span><span>' + (o.period === "1W" ? "w/w" : (o.period || "w/w")) + '</span><span>3y pct</span><span>' + (o.period || "1 year") + '</span></div>' : "") + ms.map(m => row(m, o.period)).join("") + "</div>";
            sec.appendChild(g);
            first = false;
          });
          sec.querySelectorAll("details.cot-row").forEach(dt => dt.addEventListener("toggle", () => {
            const x = dt.querySelector(".cot-rx");
            if (dt.open && !x.firstChild) { const m = byId(d, dt.dataset.cot); if (m) x.appendChild(card(m, o.period ? (weeksOf(o.period) >= 52 ? "m" : "d") : sc)); }
          }));
        } else {
          const grid = document.createElement("div");
          grid.className = "cot-cards";
          pick(o.ids || []).forEach(m => grid.appendChild(card(m, sc)));
          sec.appendChild(grid);
        }
        const notes = (d.errors || []).length ? '<p class="cot-note">Some reports could not be refreshed on the last run; the last good copy is shown and dated.</p>' : "";
        if (o.hideToggle) { if (notes) sec.insertAdjacentHTML("beforeend", notes); }
        else sec.insertAdjacentHTML("beforeend", notes + '<p class="cot-note">' + esc(sectionNote(d)) + "</p>");
      };
      draw();
      sec.addEventListener("click", e => {
        const b = e.target.closest("[data-cot-sc]");
        if (!b) return;
        sc = b.getAttribute("data-cot-sc");
        if (window.MMCandles) window.MMCandles.setScale(sc);
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
    if (m.group === "softs") return "#markets/mkt-cmd-softs";
    if (m.group === "grains") return "#markets/mkt-cmd-grains";
    if (m.group === "livestock") return "#markets/mkt-cmd-livestock";
    return "#markets/mkt-cmd";
  }
  /* one-line summary for hover cards: "Funds net long 112.3k (+8.7k w/w), 35th pct of 3y · 10 Nov" */
  function line(m) {
    const s = m && m.s;
    if (!s || !f(s.net)) return "";
    const who = isMifid(m) ? "Investment funds " : "Funds ";
    return who + (s.net >= 0 ? "net long " : "net short ") + k(Math.abs(s.net)) + (f(s.net_wow) ? " (" + k(s.net_wow, true) + " w/w)" : "") + (f(s.pct_3y) ? ", " + ord(s.pct_3y) + " pct of 3y" : "") + " · " + exchShort(m) + " " + day(s.date);
  }

  /* Shared period with the Commodities tiles (t1445u). Reports are weekly, so:
       1W = latest report vs the week before (the usual w/w figure)
       1M = change over the last 4 reports (~a month)
       3M = last 13 reports    1Y = last 52 reports */
  const PER_WEEKS = { "1W": 1, "1M": 4, "3M": 13, "1Y": 52 };
  function weeksOf(per) { return PER_WEEKS[per] || 4; }
  function netAt(m, back) {
    const w = m && m.w || [];
    const r = w[w.length - 1 - (back || 0)];
    return r && f(r[2]) && f(r[3]) ? r[2] - r[3] : null;
  }
  function netDelta(m, per) {
    const n = weeksOf(per);
    const now = netAt(m, 0), then = netAt(m, n);
    if (f(now) && f(then)) return now - then;
    return n === 1 && m && m.s && f(m.s.net_wow) ? m.s.net_wow : null;
  }
  function asofTag(m) {
    const s = m && m.s || {};
    const who = m && m.exch === "CFTC" ? "CFTC" : "ICE";
    const d = day(s.date);
    return d ? who + " " + d : who;
  }
  function placeholderHTML() {
    return '<div class="cot-cell cot-na" aria-label="No CFTC report"><span class="cot-na-l">No CFTC report</span></div>';
  }
  function cellHTML(m, per) {
    if (!m) return placeholderHTML();
    const s = m.s || {};
    const p = f(s.net_pct_oi) ? Math.max(-100, Math.min(100, s.net_pct_oi)) : null;
    const bar = p == null ? "" : '<span class="cot-rb"><i class="' + (p >= 0 ? "up" : "dn") + '" style="' + (p >= 0 ? "left:50%" : "right:50%") + ";width:" + Math.max(1, Math.min(50, Math.abs(p) * 1.25)).toFixed(1) + '%"></i></span>';
    const dlt = netDelta(m, per);
    const wk = Math.max(2, weeksOf(per) + 1);
    const tip = m.name + " · funds net " + k(s.net, true) + (f(dlt) ? ", " + k(dlt, true) + " over " + (per || "1M") : "") + " · " + asofTag(m);
    return '<div class="cot-cell" role="button" tabindex="0" data-cot="' + esc(m.id) + '" title="' + esc(tip) + '" aria-expanded="false" aria-label="' + esc(tip) + '">' +
      '<span class="sr-only">' + esc(m.name) + "</span>" + bar +
      '<span class="cot-rv ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '">' + esc(k(s.net, true)) + "</span>" +
      chip(dlt, "Change in the net over " + (per || "1M") + (per === "1W" ? " (latest week vs the week before)" : "")) +
      '<span class="cot-per-k">' + esc(per === "1W" ? "w/w" : (per || "1M")) + "</span>" +
      spark(m, wk) +
      '<span class="cot-when">' + esc(asofTag(m)) + "</span></div>";
  }
  function cellsHTML(ids, d, per) {
    return (ids || []).map(id => {
      if (!id) return placeholderHTML();
      const m = byId(d, id);
      return m ? cellHTML(m, per) : placeholderHTML();
    }).join("");
  }
  /* fill a .cot-cells host with one cell per id (placeholder when missing). A cell opens the full card. */
  function fillCells(host, ids, per) {
    if (!host) return Promise.resolve();
    host.classList.add("cot-cells");
    const band = host.closest && host.closest(".cmd-band") || host.parentNode;
    let slot = band && band.querySelector && band.querySelector(":scope > .cot-open");
    if (band && !slot) { slot = document.createElement("div"); slot.className = "cot-open"; host.insertAdjacentElement("afterend", slot); }
    const sc = weeksOf(per || "1M") >= 52 ? "m" : "d";
    function openCell(id, d) {
      if (!slot) return;
      const on = slot.dataset.cot === id && slot.firstChild;
      host.querySelectorAll(".cot-cell[data-cot]").forEach(c => c.setAttribute("aria-expanded", "false"));
      slot.innerHTML = "";
      slot.dataset.cot = "";
      if (on || !id) return;
      const m = byId(d, id);
      if (!m) return;
      const cell = host.querySelector('.cot-cell[data-cot="' + id + '"]');
      if (cell) cell.setAttribute("aria-expanded", "true");
      slot.dataset.cot = id;
      slot.appendChild(card(m, sc));
    }
    return load().then(d => {
      host.innerHTML = cellsHTML(ids, d, per || "1M");
      const go = e => {
        const cell = e.target.closest && e.target.closest(".cot-cell[data-cot]");
        if (!cell || !host.contains(cell)) return;
        e.preventDefault();
        openCell(cell.dataset.cot, d);
      };
      if (!host._cotCells) { host._cotCells = true; host.addEventListener("click", go); host.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(e); }); }
      else host._cotGo = go;
      return d;
    }).catch(() => { host.innerHTML = (ids || []).map(() => placeholderHTML()).join(""); });
  }

  function netBar(s) {
    const p = f(s && s.net_pct_oi) ? Math.max(-100, Math.min(100, s.net_pct_oi)) : null;
    if (p == null) return "";
    return '<span class="cot-rb"><i class="' + (p >= 0 ? "up" : "dn") + '" style="' + (p >= 0 ? "left:50%" : "right:50%") + ";width:" + Math.max(1, Math.min(50, Math.abs(p) * 1.25)).toFixed(1) + '%"></i></span>';
  }
  /* Slim bar under a commodity price tile: net-as-share-of-OI bar + muted source and date. */
  function slimHTML(m) {
    if (!m || !m.s) return "";
    const s = m.s, lab = exchShort(m), when = day(s.date);
    const tip = (isMifid(m) ? "Investment funds net " : "Funds net ") + k(s.net, true) + (f(s.net_wow) ? " (" + k(s.net_wow, true) + " w/w)" : "") + " · " + lab + " " + when;
    return '<button type="button" class="cot-slim" data-cot-slim="' + esc(m.id) + '" aria-label="' + esc(tip) + '" title="' + esc(tip) + '">' +
      netBar(s) + '<span class="cot-slim-lab"><span>' + esc(lab) + "</span> <span>" + esc(when) + "</span></span></button>";
  }
  function rowLine(m) {
    const s = m.s || {}, cr = crowd(s.pct_3y);
    const exLab = m.exch === "CFTC" ? "" : isMifid(m) ? "ICE Endex" : "ICE Europe";
    return '<div class="cot-row cot-row-static"><div class="cot-rs"><span class="cot-rn">' + esc(m.name) + (exLab ? "<small>" + esc(exLab) + "</small>" : "") + "</span>" +
      netBar(s) +
      '<span class="cot-rv ' + (f(s.net) ? (s.net >= 0 ? "up" : "dn") : "") + '">' + esc(k(s.net, true)) + "</span>" +
      chip(s.net_wow, "Week-on-week change in the net") +
      '<span class="cot-rp ' + cr.c + '" title="' + esc(cr.t) + '">' + (f(s.pct_3y) ? esc(ord(s.pct_3y)) : "–") + "</span>" +
      spark(m, 52) + "</div></div>";
  }
  /* Full pre-#203 report (row + history card, as-of date and source) into a host. */
  function detail(host, m, o) {
    if (!host || !m) return;
    o = o || {};
    let sc = scale();
    const draw = () => {
      host.classList.add("cot", "lps-cot");
      const heading = o.heading === false ? "" : '<h3 class="cot-h">Trader positioning</h3>';
      const src = (m.src ? " " + esc(m.src) : "") + (m.url ? ' · <a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">Source ↗</a>' : "");
      host.innerHTML = heading +
        '<div class="cot-bar">' + toggle(sc) + "</div>" +
        '<div class="cot-rows">' +
        '<div class="cot-rh"><span>Market</span><span title="Net position as a share of open interest; full bar is 40% or more">Net % OI</span><span>Net</span><span>w/w</span><span>3y pct</span><span>1 year</span></div>' +
        rowLine(m) + '</div><div class="cot-detail-card"></div>' +
        '<p class="cot-note">' + esc(methodNote(m)) + src + "</p>";
      const box = host.querySelector(".cot-detail-card");
      if (box) box.appendChild(card(m, sc));
    };
    draw();
    if (!host._cotDetail) {
      host._cotDetail = true;
      host.addEventListener("click", e => {
        const b = e.target.closest && e.target.closest("[data-cot-sc]");
        if (!b) return;
        sc = b.getAttribute("data-cot-sc");
        draw();
      });
    }
  }
  function closeReport() {
    const el = document.getElementById("cotSheet");
    if (el) { el.hidden = true; el.innerHTML = ""; }
    const price = document.getElementById("kSheet");
    if (!price || price.hidden) document.documentElement.classList.remove("lps-open");
  }
  function openReport(idOrM) {
    return load().then(d => {
      const m = typeof idOrM === "string" ? byId(d, idOrM) : idOrM;
      if (!m) return;
      if (window.EMMIKit && EMMIKit.closeSheet) EMMIKit.closeSheet();
      let el = document.getElementById("cotSheet");
      if (!el) {
        el = document.createElement("div");
        el.id = "cotSheet";
        el.className = "lps-w";
        document.body.appendChild(el);
        el.addEventListener("click", e => {
          if (e.target.closest("[data-lps-close]") || e.target.classList.contains("lps-bg")) closeReport();
        });
      }
      el.innerHTML = '<div class="lps-bg"></div><div class="lps cot-panel" role="dialog" aria-modal="true" aria-label="Trader positioning, ' + esc(m.name) + '">' +
        '<header class="lps-h"><div><h3>Trader positioning <small>' + esc(m.name) + "</small></h3></div>" +
        '<button type="button" class="lps-x" data-lps-close aria-label="Close">×</button></header>' +
        '<div class="lps-c lps-cot-host"></div></div>';
      el.hidden = false;
      document.documentElement.classList.add("lps-open");
      detail(el.querySelector(".lps-cot-host"), m, { heading: false });
      const box = el.querySelector(".lps");
      if (box) box.scrollTop = 0;
      return m;
    });
  }

  window.EMMICot = { peek: () => DATA, where: where, load: load, byId: byId, bySym: bySym, card: card, mount: mount, line: line, crowd: crowd, k: k, weeksOf: weeksOf, netDelta: netDelta, asofTag: asofTag, cellHTML: cellHTML, cellsHTML: cellsHTML, placeholderHTML: placeholderHTML, fillCells: fillCells, PER_WEEKS: PER_WEEKS, slimHTML: slimHTML, detail: detail, openReport: openReport, closeReport: closeReport, exchShort: exchShort };
})();
