/* Metals page (#companies/metals). Prices from the live market file, then trader positioning (CFTC COT), official
   gold reserves (IMF), ETF holdings, COMEX warehouse stocks and the latest published supply/demand balances.
   Data: data/market.json and data/metals.json + data/cot.json (emmi-data live-data, scripts/build_metals.py);
   gold and copper balances from og-mining-v2/outlooks.json (WGC, ICSG). Blank = not available, never zero. */
(function () {
  "use strict";
  const U = () => window.MMV2;
  const C = () => window.EMMICharts;
  const f = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => U().esc(s);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const OZ_T = 32150.7466;
  const OUT = "/emmi/ed/main/og-mining-v2/outlooks.json";
  function dShort(iso, yr) { const p = String(iso || "").slice(0, 10).split("-"); return p.length < 3 ? "" : +p[2] + " " + MON[+p[1] - 1] + (yr ? " " + p[0] : ""); }
  function mShort(ym) { const p = String(ym || "").split("-"); return p.length > 1 ? MON[+p[1] - 1] + " " + p[0] : String(ym || ""); }
  function ageDays(iso) { const t = Date.parse(String(iso || "").slice(0, 10) + "T12:00:00Z"); return Number.isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : null; }
  function zurich(iso) { const t = Date.parse(iso || ""); return Number.isFinite(t) ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }) : ""; }
  function pct(v) { return f(v) ? (U().pill(U().signed(v, "%")) || '<span class="og-pill">0.0%</span>') : '<span class="og-pill">n/a</span>'; }
  function chg(v, d, post) {
    if (!f(v)) return '<span class="og-pill">n/a</span>';
    const a = Math.abs(v) < 1e-9 ? 0 : v;
    return '<span class="og-pill ' + (a > 0 ? "up" : a < 0 ? "dn" : "") + '">' + esc((a > 0 ? "+" : a < 0 ? "−" : "") + U().fmt(Math.abs(a), d) + (post || "")) + "</span>";
  }
  function pctTxt(v) { return '<b class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + (f(v) ? U().signed(v, "%") : "n/a") + "</b>"; }
  function stale(days, limit, what) { return days == null || days <= limit ? "" : '<span class="ogx-stale" title="' + esc(what || "") + '">' + days + " days old</span>"; }
  function section(root, id, kicker, asof) {
    const el = document.createElement("section");
    el.className = "og-block ogx-b";
    el.id = id;
    el.innerHTML = '<header class="og-h ogx-bh"><div class="ogx-bt"><p class="ogx-kick">' + esc(kicker) + '</p><h2 class="ogx-hl"></h2></div><div class="ogx-bh-r"><p class="og-asof">' + (asof || "") + "</p></div></header><p class=\"ogx-dek\" hidden></p><div class=\"og-body\"></div>";
    root.appendChild(el);
    return el;
  }
  function headline(el, text, dek) {
    el.querySelector(".ogx-hl").textContent = text || "";
    const d = el.querySelector(".ogx-dek");
    if (dek) { d.innerHTML = dek; d.hidden = false; }
  }
  const body = el => el.querySelector(".og-body");
  function scale() { return window.MMCandles ? MMCandles.scale() : "d"; }
  function scaleButtons(el, sc) {
    el.querySelector(".ogx-bh-r").innerHTML = '<div class="ogx-cdl" role="group" aria-label="Chart period"><button type="button" data-mt-sc="d" aria-pressed="' + (sc === "d") + '">1M <small>daily</small></button><button type="button" data-mt-sc="m" aria-pressed="' + (sc === "m") + '">1Y <small>monthly</small></button></div>';
  }
  /* one scale for the page: price tiles, ETF chart and the positioning charts follow the same buttons */
  const redraw = [];
  function onScale(fn) { redraw.push(fn); }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("#metalsView [data-mt-sc]");
    if (!t) return;
    const sc = t.getAttribute("data-mt-sc");
    if (window.MMCandles) MMCandles.setScale(sc);
    redraw.forEach(fn => fn(sc));
    document.querySelectorAll("#metalsView [data-mt-sc]").forEach(x => x.setAttribute("aria-pressed", String(x.getAttribute("data-mt-sc") === sc)));
    document.dispatchEvent(new CustomEvent("emmi:scale", { detail: sc }));
  });
  document.addEventListener("emmi:scale", e => {
    if (!document.querySelector("#metalsView .mt")) return;
    redraw.forEach(fn => fn(e.detail));
    document.querySelectorAll("#metalsView [data-mt-sc]").forEach(x => x.setAttribute("aria-pressed", String(x.getAttribute("data-mt-sc") === e.detail)));
  });

  /* ---------- prices ---------- */
  const TAPE = [
    { sym: "GC=F", name: "Gold", unit: "/oz", d: 0, cot: "gold", anchor: "mtGoldBal" },
    { sym: "SI=F", name: "Silver", unit: "/oz", d: 2, cot: "silver", anchor: "mtSilverBal" },
    { sym: "PL=F", name: "Platinum", unit: "/oz", d: 0, cot: "platinum", anchor: "mtPlatBal" },
    { sym: "PA=F", name: "Palladium", unit: "/oz", d: 0, cot: "palladium" },
    { sym: "HG=F", name: "Copper", unit: "/lb", d: 3, cot: "copper", anchor: "mtCopperBal", note: "COMEX" },
    { sym: "ALI=F", name: "Aluminium", unit: "/t", d: 0, note: "COMEX, thinly traded" }
  ];
  function contractOf(r) {
    if (r && r.contract && r.contract.month) return r.contract.month;
    const m = String((r && r.name) || "").match(/([A-Z][a-z]{2}-\d{2})\s*$/);
    return m ? m[1] : "";
  }
  function axisDates(q, sc) {
    const o = q && q.ohlc;
    if (!o || !C()) return null;
    if (sc === "m") {
      const m = C().monthSeq(o.m0, (o.m || []).length);
      return m ? { labels: m.map(x => C().monLabel(x, true)), ticks: m.map((x, i) => (i % 3 === (m.length - 1) % 3) ? (x.slice(5) === "01" || i === m.length - 1 ? C().monLabel(x) + " " + x.slice(2, 4) : C().monLabel(x)) : null) } : null;
    }
    const n = (o.d || []).length;
    const ds = C().sessionDates(o.d0, n, q.bar_date);
    if (!ds) return { labels: (o.d || []).map((x, i) => "Session " + (i + 1) + " of " + n), ticks: null };
    return { labels: ds.map(x => new Date(x + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })), ticks: ds.map((x, i) => (n - 1 - i) % 5 === 0 ? C().dayLabel(x) : null) };
  }
  /* 13 calendar months of highs and lows from the monthly candles (this month to date) */
  function range13(q) {
    const m = q && q.ohlc && q.ohlc.m;
    if (!Array.isArray(m) || m.length < 6) return null;
    const hi = Math.max(...m.map(x => x[1]).filter(f)), lo = Math.min(...m.map(x => x[2]).filter(f));
    return f(hi) && f(lo) && hi > lo ? { hi: hi, lo: lo } : null;
  }
  function rangeHTML(q, d) {
    const r = range13(q);
    if (!r || !f(q.px)) return "";
    const x = Math.max(0, Math.min(100, 100 * (q.px - r.lo) / (r.hi - r.lo)));
    return '<div class="mt-rg" title="Range of the last 13 calendar months (monthly highs and lows, this month to date)"><span>' + esc(U().fmt(r.lo, d)) + '</span><span class="mt-rgb"><i style="left:' + x.toFixed(1) + '%"></i></span><span>' + esc(U().fmt(r.hi, d)) + '</span><em>' + Math.round(x) + "% of 13-mo range</em></div>";
  }
  function cotChip(cot, id) {
    const m = cot && window.EMMICot ? EMMICot.byId(cot, id) : null;
    const s = m && m.s;
    if (!s || !f(s.net)) return "";
    const cr = EMMICot.crowd(s.pct_3y);
    return '<a class="mt-cot ' + cr.c + '" href="#companies/metals/mtCot" data-mt-go="mtCot" title="CFTC managed money, positions on ' + esc(dShort(s.date)) + '">Funds ' + esc(s.net >= 0 ? "net long " : "net short ") + esc(EMMICot.k(Math.abs(s.net))) + (f(s.pct_3y) ? " · " + s.pct_3y + "th pct" : "") + "</a>";
  }
  function priceTile(q, t, sc, cot) {
    const el = document.createElement("div");
    el.className = "ogx-tile";
    el.id = "mtPx-" + t.sym.replace(/\W/g, "");
    if (!q || !f(q.px)) { el.classList.add("is-na"); el.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(t.name) + '</span></div><p class="ogx-qm">Not in the market file right now.</p>'; return el; }
    const p = q.pct || {};
    const today = new Date().toISOString().slice(0, 10);
    const when = q.bar_date && q.bar_date !== today ? "Close " + dShort(q.bar_date) : (zurich(q.market_time) ? "Delayed · " + zurich(q.market_time) + " Zurich" : dShort(q.bar_date));
    el.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(t.name) + '</span><span class="ogx-ct">' + esc([contractOf(q), t.note].filter(Boolean).join(" · ")) + "</span></div>" +
      '<div class="ogx-pr"><span class="ogx-px"><small>$</small>' + esc(U().fmt(q.px, t.d)) + '<small class="u">' + esc(t.unit) + "</small></span>" + pct(p["1D"]) + "</div>" +
      '<p class="ogx-sm"><span class="ogx-k">1W</span>' + pctTxt(p["1W"]) + '<span class="ogx-k">1M</span>' + pctTxt(p["1M"]) + '<span class="ogx-k">YTD</span>' + pctTxt(p.YTD) + '<span class="ogx-k">1Y</span>' + pctTxt(p["1Y"]) + "</p>" +
      rangeHTML(q, t.d) + '<div class="ogx-cc"></div><p class="ogx-qm">' + esc(when) + (q.state === "open" ? ' · <span class="ogx-live">trading</span>' : "") + (t.cot ? " " + cotChip(cot, t.cot) : "") + "</p>";
    const o = q.ohlc || {};
    const ax = axisDates(q, sc) || {};
    if (C()) C().candles(el.querySelector(".ogx-cc"), { bars: sc === "m" ? o.m : o.d, labels: ax.labels, ticks: ax.ticks, d: t.d, pre: "", h: 130, prev: q.prev_close, aria: t.name + (sc === "m" ? " monthly candles, last 13 months" : " daily candles, last 22 sessions") });
    return el;
  }
  function ratioTile(name, sub, a, b, calc, d, color, sc, read) {
    if (!a || !b || !f(a.px) || !f(b.px)) return null;
    const el = document.createElement("div");
    el.className = "ogx-tile ogx-der";
    const now = calc(a.px, b.px), prev = f(a.prev_close) && f(b.prev_close) ? calc(a.prev_close, b.prev_close) : null;
    const key = sc === "m" ? "m" : "d", ca = a.ohlc && a.ohlc[key], cb = b.ohlc && b.ohlc[key];
    let vals = null, ax = {};
    if (ca && cb && ca.length === cb.length && a.ohlc[key + "0"] === b.ohlc[key + "0"]) {
      vals = ca.map((x, i) => f(x && x[3]) && f(cb[i] && cb[i][3]) ? calc(x[3], cb[i][3]) : null);
      ax = axisDates(a, sc) || {};
    }
    el.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(name) + '</span><span class="ogx-ct">computed</span></div><div class="ogx-pr"><span class="ogx-px">' + esc(U().fmt(now, d)) + "</span>" + chg(f(prev) ? now - prev : null, d) + "</div>" +
      '<p class="ogx-sm">' + esc(sub) + '</p><div class="ogx-cc"></div><p class="ogx-qm">' + esc(read(now)) + "</p>";
    if (vals && C()) {
      const ok = vals.filter(f), avg = ok.reduce((x, y) => x + y, 0) / ok.length;
      C().lines(el.querySelector(".ogx-cc"), { h: 130, d: d, series: [{ name: name, vals: vals, color: color, width: 2, area: true, smooth: false }], labels: ax.labels, ticks: ax.ticks, refs: [{ y: avg, label: "avg " + U().fmt(avg, d), color: "var(--muted)" }], aria: name + " over the period" });
    }
    return el;
  }
  function prices(root, q, cot, mktAt) {
    const el = section(root, "mtPx", "Prices", "");
    const g = q["GC=F"], s = q["SI=F"];
    if (g && f(g.px)) {
      const d1 = (g.pct || {})["1D"], ytd = (g.pct || {}).YTD;
      const verb = !f(d1) ? "is" : d1 >= 0.3 ? "up " + U().fmt(d1, 1) + "% today at" : d1 <= -0.3 ? "down " + U().fmt(Math.abs(d1), 1) + "% today at" : "little changed today at";
      headline(el, "Gold " + verb + " $" + U().fmt(g.px, 0) + (f(ytd) ? ", " + (ytd >= 0 ? "up " : "down ") + U().fmt(Math.abs(ytd), 1) + "% this year" : ""),
        "Front COMEX and NYMEX futures from the live market file" + (mktAt ? " (" + esc(zurich(mktAt)) + " Zurich, about 15 minutes delayed)" : "") + ". The funds chip under each tile is the latest CFTC positioning.");
    } else headline(el, "Metal prices are not in the market file right now");
    let sc = scale();
    scaleButtons(el, sc);
    const grid = document.createElement("div");
    grid.className = "ogx-tiles mt-tiles";
    body(el).appendChild(grid);
    const draw = x => {
      sc = x || sc;
      grid.innerHTML = "";
      TAPE.forEach(t => grid.appendChild(priceTile(q[t.sym], t, sc, cot)));
      [ratioTile("Gold / silver", "Ounces of silver per ounce of gold", g, s, (x, y) => x / y, 1, "var(--og-a)", sc, () => "Rising = silver lagging gold; falling = silver outperforming"),
        ratioTile("Copper / gold ×1000", "COMEX copper $/lb ÷ gold $/oz × 1000; growth versus haven", q["HG=F"], g, (x, y) => x / y * 1000, 3, "var(--og-o)", sc, () => "Rising = copper outpacing gold (risk-on); falling = haven demand")].forEach(x => { if (x) grid.appendChild(x); });
    };
    draw();
    onScale(draw);
    U().park(body(el), "Tiles are the front futures (contract month shown) from the live EMMi market file, refreshed every 15 minutes on weekdays: COMEX gold, silver, copper and aluminium; NYMEX platinum and palladium. 1M = one candle per session for the last 22 sessions; 1Y = one candle per calendar month. The range bar uses the 13 monthly highs and lows. LME copper, zinc, nickel, lead and aluminium have no free live source, so they are not shown.");
  }

  /* ---------- positioning ---------- */
  function positioning(root, cot) {
    const el = section(root, "mtCot", "Trader positioning", "");
    if (!cot || !window.EMMICot) { headline(el, "Trader positioning is not available right now"); return; }
    const g = EMMICot.byId(cot, "gold"), si = EMMICot.byId(cot, "silver"), cu = EMMICot.byId(cot, "copper");
    const bits = [];
    if (g && g.s) bits.push("gold funds " + (g.s.net_wow >= 0 ? "added " : "cut ") + EMMICot.k(Math.abs(g.s.net_wow || 0)));
    if (si && si.s && f(si.s.pct_3y)) bits.push("silver length sits in the " + si.s.pct_3y + "th percentile of three years");
    headline(el, bits.length ? bits.join("; ").replace(/^./, c => c.toUpperCase()) : "Managed money positioning",
      (cu && cu.s && f(cu.s.pct_1y) ? "Copper net long is " + EMMICot.k(cu.s.net) + " contracts, " + cu.s.pct_1y + "th percentile of the past year. " : "") + "Positions as of Tuesday " + esc(dShort(cot.report_date, true)) + ", published Friday.");
    const host = document.createElement("div");
    body(el).appendChild(host);
    EMMICot.mount(host, { layout: "cards", ids: ["gold", "silver", "platinum", "palladium", "copper"], lede: "Hedge funds and CTAs (managed money): long and short as a share of open interest, where the net sits in its three-year range, and the weekly net. Producers and swap dealers are in the line under each chart." });
    U().park(body(el), "CFTC Commitments of Traders, disaggregated, futures only (publicreporting.cftc.gov, dataset 72hh-3qpy), about three years of weekly reports. COMEX gold, silver and copper; NYMEX platinum and palladium. COMEX aluminium is too small for the CFTC report. The period buttons share the price tiles' setting: 1M shows the last 13 weekly reports, 1Y the last 52.");
  }

  /* ---------- official sector ---------- */
  function reserves(root, met, bal) {
    const r = met && met.reserves;
    const el = section(root, "mtCb", "Central banks and governments", r ? "IMF data to " + esc(mShort(r.latest_month)) : "");
    if (!r || !(r.top || []).length) { headline(el, "Official gold reserves are not available right now"); return; }
    const b = body(el);
    const by = r.buyers || [], top = by.slice(0, 2);
    headline(el, top.length ? top.map(x => x.name).join(" and ") + " lead official buying this year: " + top.map(x => "+" + U().fmt(x.ytd, 0) + " t").join(" and ") : "Official gold holdings",
      ((bal && bal.central_banks && bal.central_banks.facts) || []).slice(0, 2).map(esc).join(" ") + (bal && bal.central_banks ? ' <span class="mt-src">WGC, ' + esc(dShort(bal.central_banks.issued, true)) + "</span>" : ""));
    const grid = document.createElement("div");
    grid.className = "mt-two";
    b.appendChild(grid);
    const left = document.createElement("div");
    left.className = "ogx-sub";
    left.innerHTML = '<h3>Net change this year <span class="ogx-h3n">tonnes, December to latest month reported</span></h3><div class="mt-bars"></div>';
    grid.appendChild(left);
    const rows = by.slice(0, 10).map(x => ({ name: x.name, val: x.ytd, label: "+" + U().fmt(x.ytd, 1) + " t · " + MON[+x.month.slice(5) - 1], color: "#4cc38a", on: true }))
      .concat((r.sellers || []).slice(0, 4).map(x => ({ name: x.name, val: Math.abs(x.ytd), label: "−" + U().fmt(Math.abs(x.ytd), 1) + " t · " + MON[+x.month.slice(5) - 1], color: "#f27a8c", on: true })));
    U().bars(left.querySelector(".mt-bars"), rows, { aria: "Official gold, net change this year", left: 104, right: 92 });
    const right = document.createElement("div");
    right.className = "ogx-sub";
    let t = '<h3>Largest holders <span class="ogx-h3n">tonnes · last 24 months</span></h3><div class="ogx-scroll"><table class="ogx-tbl mt-tbl"><thead><tr><th>Holder</th><th>Tonnes</th><th>Month</th><th>m/m</th><th>12 m</th><th class="mt-spk">24 months</th></tr></thead><tbody>';
    r.top.slice(0, 15).forEach(x => {
      t += "<tr" + (x.stale ? ' class="mt-old"' : "") + "><th>" + esc(x.name) + "</th><td>" + esc(U().fmt(x.t, 0)) + "</td><td>" + esc(mShort(x.month).replace(/ (\d\d)(\d\d)$/, " $2")) + (x.stale ? " ·&nbsp;late" : "") + "</td><td>" + chg(x.m1, 1) + "</td><td>" + chg(x.m12, 1) + '</td><td class="mt-spk">' + spark(x.spark) + "</td></tr>";
    });
    right.innerHTML = t + "</tbody></table></div>";
    grid.appendChild(right);
    U().park(b, esc(r.src) + ' (<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">IMF data</a>). Countries report with different lags; a holder more than three months behind the newest month is greyed and marked late (Russia last reported ' + esc(mShort(((r.top || []).find(x => x.iso === "RUS") || {}).month || "")) + "). The ECB is listed as reported; the IMF’s own holding is left out. WGC counts unreported buying as well, which is why its quarterly central-bank demand is larger than the sum of these reports.");
  }
  function spark(v) {
    const xs = (v || []).filter(f);
    if (xs.length < 2) return "";
    const lo = Math.min(...xs), hi = Math.max(...xs), W = 80, H = 18;
    if (!(hi > lo)) return '<svg class="mt-sp" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="M0,' + H / 2 + "H" + W + '"/></svg>';
    const d = xs.map((x, i) => (i ? "L" : "M") + (i / (xs.length - 1) * W).toFixed(1) + "," + (2 + (1 - (x - lo) / (hi - lo)) * (H - 4)).toFixed(1)).join("");
    return '<svg class="mt-sp" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* ---------- ETFs ---------- */
  function etfs(root, met, bal) {
    const e = met && met.etf;
    const el = section(root, "mtEtf", "ETF holdings", "");
    if (!e || !e.GLD) { headline(el, "ETF holdings are not available right now"); return; }
    const gld = e.GLD, ser = gld.series || [];
    const back = n => ser.length > n ? ser[ser.length - 1 - n][1] : null;
    const w1 = back(5), m1 = back(21), y1 = back(252);
    headline(el, "GLD holds " + U().fmt(gld.t, 1) + " t of gold" + (f(m1) ? ", " + (gld.t - m1 >= 0 ? "+" : "−") + U().fmt(Math.abs(gld.t - m1), 1) + " t in a month" : ""),
      "The largest gold ETF’s bullion, from its issuer’s daily archive" + (bal && bal.silver ? ". " + esc(bal.silver.facts[1]) + ' <span class="mt-src">Silver Institute, ' + esc(dShort(bal.silver.issued, true)) + "</span>" : ""));
    let sc = scale();
    const b = body(el);
    const wrap = document.createElement("div");
    wrap.className = "mt-etf";
    b.appendChild(wrap);
    const draw = x => {
      sc = x || sc;
      const n = sc === "m" ? 252 : 22, s = ser.slice(-n);
      wrap.innerHTML = '<div class="ogx-tile mt-etfc"><div class="ogx-tt"><span class="ogx-tn">SPDR Gold Shares (GLD)</span><span class="ogx-ct">tonnes · ' + (sc === "m" ? "1 year" : "1 month") + ' daily</span></div><div class="ogx-pr"><span class="ogx-px">' + esc(U().fmt(gld.t, 1)) + '<small class="u"> t</small></span>' + chg(f(w1) ? gld.t - w1 : null, 1, " t 1W") + chg(f(y1) ? gld.t - y1 : null, 1, " t 1Y") + '</div><div class="ogx-cc"></div><p class="ogx-qm">As of ' + esc(dShort(gld.asof, true)) + stale(ageDays(gld.asof), 5, "GLD archive") + "</p></div>" +
        '<div class="mt-etfs">' + ["IAU", "SLV"].map(k => {
          const x = e[k];
          if (!x) return "";
          const s2 = x.series || [], p = s2.length > 1 ? s2[s2.length - 2][1] : null;
          return '<div class="ogx-tile"><div class="ogx-tt"><span class="ogx-tn">' + esc(x.name) + '</span><span class="ogx-ct">' + esc(x.metal) + '</span></div><div class="ogx-pr"><span class="ogx-px">' + esc(U().fmt(x.t, x.t >= 1000 ? 0 : 1)) + '<small class="u"> t</small></span>' + (f(p) ? chg(x.t - p, 1, " t") : "") + '</div><p class="ogx-sm">' + esc(U().fmt(x.t * OZ_T / 1e6, 1)) + ' Moz</p><p class="ogx-qm">As of ' + esc(dShort(x.asof, true)) + (s2.length < 5 ? " · daily history starts " + esc(dShort(s2[0] && s2[0][0])) : "") + stale(ageDays(x.asof), 5, x.name) + "</p></div>";
        }).join("") + "</div>";
      if (C() && s.length > 1) C().lines(wrap.querySelector(".mt-etfc .ogx-cc"), { h: 140, d: 1, unit: "t", series: [{ name: "GLD", vals: s.map(r => r[1]), color: "var(--og-a)", width: 2, area: true, end: true }], labels: s.map(r => dShort(r[0], true)), ticks: s.map((r, i) => (s.length - 1 - i) % (sc === "m" ? 63 : 5) === 0 ? dShort(r[0]) : null), aria: "GLD tonnes of gold" });
    };
    draw();
    onScale(draw);
    U().park(b, 'GLD: SPDR Gold Shares historical archive (tonnes of gold in the trust, daily; <a href="' + esc(gld.url) + '" target="_blank" rel="noopener noreferrer">spdrgoldshares.com</a>). IAU and SLV: “Tonnes in Trust” on the iShares fund pages, read once a day; EMMi builds their history from 17 Nov 2026 because iShares publishes no free archive. The issuer’s terms restrict redistribution, so this stays inside EMMi.');
  }

  /* ---------- exchange stocks ---------- */
  const STK = [["gold", "Gold", "Moz", 1e6, 2], ["silver", "Silver", "Moz", 1e6, 1], ["platinum", "Platinum", "koz", 1e3, 1], ["palladium", "Palladium", "koz", 1e3, 1], ["copper", "Copper", "kt", 1e3, 1], ["aluminum", "Aluminium", "t", 1, 0]];
  function stocks(root, met) {
    const st = met && met.stocks;
    const el = section(root, "mtStk", "Exchange stocks", "");
    if (!st || !st.gold) { headline(el, "COMEX warehouse stocks are not available right now"); return; }
    const act = st.gold.activity_date;
    const si = st.silver;
    headline(el, "COMEX holds " + U().fmt(st.gold.total / 1e6, 1) + " Moz of gold and " + U().fmt(si.total / 1e6, 0) + " Moz of silver",
      "Registered metal can be delivered against futures; eligible metal meets the standard but has no warrant. A falling registered share is the classic sign of tight deliverable supply. Activity on " + esc(dShort(act, true)) + ".");
    const b = body(el);
    let t = '<div class="ogx-scroll"><table class="ogx-tbl mt-tbl mt-stk"><thead><tr><th>Metal</th><th>Total</th><th>Day</th><th>Registered</th><th class="mt-regc">Reg. share</th><th>Eligible</th></tr></thead><tbody>';
    STK.forEach(([k, name, u, div, d]) => {
      const x = st[k];
      if (!x || !f(x.total)) return;
      const tons = k === "copper" ? 0.90718474 : 1; /* CME reports copper in short tons */
      const v = y => f(y) ? y * tons / div : null;
      const share = f(x.registered) && x.total ? 100 * x.registered / x.total : null;
      t += "<tr><th>" + esc(name) + ' <span class="ogx-u">' + esc(u) + "</span></th><td>" + esc(U().fmt(v(x.total), d)) + "</td><td>" + chg(f(x.total_prev) ? v(x.total - x.total_prev) : null, d) + "</td><td>" + esc(U().fmt(v(x.registered), d)) + '</td><td class="mt-regc"><span class="mt-reg"><i style="width:' + (f(share) ? share.toFixed(1) : 0) + '%"></i></span><b>' + (f(share) ? esc(U().fmt(share, 0)) + "%" : "n/a") + "</b></td><td>" + esc(U().fmt(v(x.eligible), d)) + "</td></tr>";
    });
    b.insertAdjacentHTML("beforeend", t + "</tbody></table></div>");
    const h = met.stocks_hist || {};
    const days = (h.gold || []).length;
    b.insertAdjacentHTML("beforeend", '<p class="og-note">' + (days > 20 ? "" : "Daily history builds from " + esc(dShort((h.gold && h.gold[0] && h.gold[0][0]) || act, true)) + "; CME publishes only the current report, so trend charts appear once a few weeks are stored. ") + "Copper converted from short tons to metric tonnes. LME and SHFE stocks are not shown: LME data are licensed and the SHFE file was not reachable.</p>");
    U().park(b, 'CME Group COMEX/NYMEX metal depository statistics (Gold_Stocks.xls, Silver_stocks.xls, Copper_Stocks.xls, PA-PL_Stck_Rprt.xls, Aluminum_Stocks.xls), report dated ' + esc(dShort(st.gold.report_date, true)) + " for activity on " + esc(dShort(act, true)) + ". Day change includes adjustments between registered and eligible.");
  }

  /* ---------- supply and demand ---------- */
  function balances(root, met, out) {
    const bal = (met && met.balances) || {};
    const mining = (out && out.mining) || {};
    const el = section(root, "mtBal", "Supply and demand", "");
    headline(el, "Gold demand held up on central banks; silver stays in deficit; platinum flips to a surplus this year",
      "Latest published balances, each dated and linked to its publisher. These are the agencies’ own estimates and forecasts, not EMMi’s.");
    const b = body(el);
    const grid = document.createElement("div");
    grid.className = "mt-bal";
    b.appendChild(grid);
    const card = (id, title, src, issued, url, inner, take) => {
      const c = document.createElement("article");
      c.className = "ogx-tile mt-bc";
      c.id = id;
      c.innerHTML = '<div class="ogx-tt"><span class="ogx-tn">' + esc(title) + '</span><span class="ogx-ct">' + esc(issued ? "issued " + dShort(issued, true) : "data to 30 Sep 2026") + "</span></div>" + (take ? '<p class="mt-take">' + take + "</p>" : "") + inner + '<p class="ogx-qm"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(src) + " ↗</a></p>";
      grid.appendChild(c);
    };
    const tbl = (rows, unit) => '<table class="ogx-tbl mt-btbl"><tbody>' + rows.map(r => "<tr" + (/balance/i.test(r.item) ? ' class="mt-net"' : "") + "><th>" + esc(r.item) + "</th><td>" + esc(U().fmt(r.v, Math.abs(r.v) < 100 && r.v % 1 ? 1 : 0)) + ' <span class="ogx-u">' + esc(unit) + "</span></td><td>" + (f(r.yoy_pct) ? pct(r.yoy_pct) : "") + "</td></tr>").join("") + "</tbody></table>";
    const wgc = mining.gold_wgc;
    if (wgc && wgc.rows) {
      const want = [["Total Supply", "Total supply"], ["Mine Production", "Mine production"], ["Jewellery Consumption", "Jewellery"], ["Total Bar and Coin", "Bar and coin"], ["ETFs and Similar Products", "ETFs"], ["Central Bank and Other Institutions", "Central banks"], ["Total Demand", "Total demand"]];
      const rows = want.map(([k, n]) => { const r = wgc.rows.find(x => x.item === k); return r ? { item: n, v: r.q3_26, yoy_pct: r.yoy_pct } : null; }).filter(Boolean);
      const cb = wgc.rows.find(x => /Central Bank/.test(x.item)), etf = wgc.rows.find(x => /^ETFs/.test(x.item));
      card("mtGoldBal", "Gold · Q3 2026", "World Gold Council, Gold Demand Trends Q3 2026", null, wgc.url, tbl(rows, "t") + '<p class="ogx-sm">Tonnes in the quarter; pills = change on Q3 2025.</p>',
        cb ? "Central banks took " + esc(U().fmt(cb.q3_26, 0)) + " t (" + esc(U().signed(cb.yoy_pct, "%")) + " y/y) and ETFs " + esc(U().fmt(etf ? etf.q3_26 : null, 0)) + " t, while jewellery fell on price." : "");
    }
    const sv = bal.silver;
    if (sv) card("mtSilverBal", "Silver · " + sv.year, sv.src, sv.issued, sv.url, tbl(sv.lines, sv.unit) + '<p class="ogx-sm">' + esc(sv.facts[0]) + "</p>", "A " + esc(U().fmt(Math.abs(sv.lines.find(x => /balance/i.test(x.item)).v), 0)) + " Moz deficit as solar thrifting cuts industrial use; " + esc(sv.facts[2].replace(/^./, c => c.toLowerCase())));
    const pt = bal.platinum;
    if (pt) card("mtPlatBal", "Platinum · " + pt.year, pt.src, pt.issued, pt.url, tbl(pt.lines, pt.unit) + '<p class="ogx-sm">' + esc(pt.facts[2]) + "</p>", "Surplus of " + esc(U().fmt(pt.lines.find(x => /balance/i.test(x.item)).v, 0)) + " koz on ETF and exchange-stock outflows. " + esc(pt.facts[0]) + " " + esc(pt.facts[1]));
    const icsg = mining.copper_icsg;
    if (icsg) {
      const yrs = icsg.years || [], tot = k => ((icsg[k] || {}).TOTAL || []);
      const rows = yrs.map((y, i) => '<tr><th>' + y + (i ? "F" : "") + "</th><td>" + esc(U().fmt(tot("mine_production_by_region")[i], 0)) + "</td><td>" + esc(U().fmt(tot("refined_production_by_region")[i], 0)) + "</td><td>" + esc(U().fmt(tot("refined_usage_by_region")[i], 0)) + '</td><td class="' + ((icsg.refined_balance_kt || [])[i] >= 0 ? "up" : "dn") + '">' + esc(U().signed((icsg.refined_balance_kt || [])[i], "", 0) || "") + "</td></tr>").join("");
      card("mtCopperBal", "Copper · " + yrs[0] + "–" + yrs[yrs.length - 1], "ICSG, Copper Market Forecast", icsg.issued, icsg.url,
        '<table class="ogx-tbl mt-btbl mt-cu"><thead><tr><th>kt</th><th>Mine</th><th>Refined</th><th>Usage</th><th>Balance</th></tr></thead><tbody>' + rows + '</tbody></table><p class="ogx-sm">China is ' + esc(String(icsg.china_share_of_usage_pct)) + "% of refined usage.</p>",
        "Refined copper stays in surplus through the forecast, even as mine supply grows.");
    }
    const om = bal.omitted || [];
    if (om.length) b.insertAdjacentHTML("beforeend", '<p class="og-note">Not shown: ' + om.map(esc).join(" ") + "</p>");
    U().park(b, "Gold and copper balances are the same files as the Mining page (og-mining-v2/outlooks.json). Silver and platinum are typed in from the publishers’ releases (scripts/metals_balances.json in emmi-data) and are updated when a new edition comes out.");
  }

  async function side(url) { try { const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 6e5)); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  function render(root, d) {
    root.innerHTML = "";
    root.classList.add("ogx", "mt");
    redraw.length = 0;
    const q = d.quotes;
    const head = document.createElement("div");
    head.className = "og-top ogx-top";
    head.innerHTML = '<div><p class="ogx-kick">Markets</p><h1>Metals</h1><p class="ogx-lede">Precious and base metal prices, who is positioned how, what central banks and ETFs are buying, how much metal sits in exchange vaults, and the latest supply and demand balances.</p></div>' +
      '<p class="og-asof ogx-upd">' + (d.mktAt ? "Prices " + esc(zurich(d.mktAt)) + " Zurich · " : "") + (d.cot ? "Positions " + esc(dShort(d.cot.report_date)) + " · " : "") + (d.met ? "Stocks " + esc(dShort(((d.met.stocks || {}).gold || {}).activity_date)) : "") + "</p>";
    root.appendChild(head);
    prices(root, q, d.cot, d.mktAt);
    positioning(root, d.cot);
    reserves(root, d.met, (d.met || {}).balances);
    etfs(root, d.met, (d.met || {}).balances);
    stocks(root, d.met);
    balances(root, d.met, d.out);
    const foot = document.createElement("p");
    foot.className = "og-foot";
    foot.innerHTML = 'Sources: live futures from the EMMi market file (Yahoo, about 15 minutes delayed); CFTC Commitments of Traders; IMF International Liquidity; SPDR Gold Shares and iShares; CME Group depository reports; World Gold Council, The Silver Institute / Metals Focus, WPIC, ICSG. Built by <a href="https://github.com/MasterKano/emmi-data/blob/main/scripts/build_metals.py">emmi-data build_metals.py</a>. A blank is n/a, never zero.';
    root.appendChild(foot);
    document.dispatchEvent(new CustomEvent("mm:place", { detail: "metals" }));
  }
  async function start() {
    const root = document.querySelector("#metalsView .og-root");
    if (!root || !U()) return;
    try {
      const [m, met, out] = await Promise.all([side("data/market.json"), side("data/metals.json"), side(OUT)]);
      let cot = null;
      try { cot = window.EMMICot ? await EMMICot.load() : null; } catch (e) { cot = null; }
      const quotes = {};
      ((m && m.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(x => { if (x && x.sym && !quotes[x.sym]) quotes[x.sym] = x; })));
      render(root, { quotes: quotes, mktAt: m && (m.generated_utc || ""), met: met, out: out, cot: cot });
    } catch (e) {
      root.innerHTML = '<p class="og-na">' + esc(e && e.message ? e.message : "Metals data are not available yet.") + "</p>";
    }
  }
  window.MMV2Metals = { start: start };
  if (document.querySelector("#metalsView .og-root")) start();
})();
