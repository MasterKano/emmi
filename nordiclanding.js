/* Nordic power landing page (#energy/nordic, Overview under Energy > Nordic power).
   The full version of the Live Pulse Nordic section: the gauge, driver chips, zone strip, cards and explainer
   cards come from livepulse.js (EMMILivePulse.nordicKit), so both pages score and colour the same way.
   Added here: balance history, zone map and table, hourly prices for today and tomorrow, price history against
   the 2023–25 normal, the EEX forward strip against the same months' normal, reservoirs by Norwegian zone,
   nuclear reactor table and 14-day outlook from Nord Pool UMM, wind, hydro and temperature against normal, and
   nuclear output against installed capacity (never a normal). Only published files: nordic-v2 (emmi-data main), data/nordic_normals.json, live-data mr.json,
   power.json (UMM), nordic_dash.json (hourly zones) and curves/nordic-sys. A missing input is shown as
   not available, never estimated. Every figure carries its date and source. */
(function () {
  "use strict";
  const CUR = "/emmi/ed/main/curves/nordic-sys/";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const HZ = [["SYS", "var(--text)"], ["SE3", "#7aa2ff"], ["SE4", "#f28b82"], ["NO2", "#2dd4bf"], ["FI", "#e8c56b"], ["DK1", "#c58af9"]];
  const MAP = [["NO4", "no4"], ["SE1", "se1"], ["FI", "fi"], ["NO3", "no3"], ["SE2", "se2"], ["NO5", "no5"], ["NO1", "no1"], ["NO2", "no2"], ["SE3", "se3"], ["DK1", "dk1"], ["DK2", "dk2"], ["SE4", "se4"]];
  const NVE = ["NVE reservoir statistics", "https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/"];
  const UMM = ["Nord Pool UMM", "https://umm.nordpoolgroup.com/"];
  const EEX = ["EEX Nordic power futures", "https://www.eex.com/en/market-data/power/futures"];
  const S = { host: null, v2: null, extra: null, loading: null, zday: "today", hz: "SYS", range: readRange() };
  let K = null;

  function readRange() { try { return localStorage.getItem("emmiNlRange") === "1Y" ? "1Y" : "1M"; } catch (e) { return "1M"; } }
  const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const getText = u => fetch(u, { cache: "no-cache" }).then(r => (r.ok ? r.text() : null)).catch(() => null);
  const addDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const short = ymd => (ymd ? (+ymd.slice(8, 10)) + " " + MON[+ymd.slice(5, 7) - 1] : "");
  const shortY = ymd => (ymd ? short(ymd) + " " + ymd.slice(2, 4) : "");

  /* ---------- data ---------- */
  function parseCurve(txt) {
    if (!txt) return null;
    const lines = txt.trim().split(/\r?\n/), head = lines.shift().split(",");
    const ix = k => head.indexOf(k);
    const rows = lines.map(l => l.split(",")).map(c => ({ c: c[ix("contract")], exp: c[ix("expiry")], p: parseFloat(c[ix("settle")]), d1: parseFloat(c[ix("change")]), as_of: c[ix("as_of")] }));
    return rows.filter(r => r.c && Number.isFinite(r.p));
  }
  async function curveNear(ymd, back) {
    for (let k = 0; k <= back; k++) {
      const d = addDays(ymd, -k), dow = new Date(d + "T00:00:00Z").getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const rows = parseCurve(await getText(CUR + d + ".csv"));
      if (rows && rows.length) return { date: d, rows: rows };
    }
    return null;
  }
  async function loadExtra() {
    const th = Math.floor(Date.now() / 36e5);
    const [nn, mr, power, dash, cidx] = await Promise.all([
      getJSON("data/nordic_normals.json?t=" + Math.floor(Date.now() / 864e5)), getJSON("data/mr.json?t=" + th), getJSON("data/power.json?t=" + th),
      getJSON("data/nordic_dash.json?t=" + th), getJSON("/emmi/ed/main/curves/index.json?t=" + th)
    ]);
    const latest = cidx && cidx.curves && cidx.curves["nordic-sys"] && cidx.curves["nordic-sys"].latest;
    let curve = null;
    if (latest) {
      const [c0, cw, cm] = await Promise.all([curveNear(latest, 0), curveNear(addDays(latest, -7), 4), curveNear(addDays(latest, -30), 4)]);
      if (c0) curve = { now: c0, w: cw, m: cm };
    }
    return { nn: nn, mr: mr, power: power, dash: dash, curve: curve };
  }
  /* Nuclear: the newer of the nordic-v2 build and the live-data UMM file (shared with Live Pulse via the kit). */
  const nuclearNow = (G, power) => K.nuclearNow(G, power);
  function kitData() {
    const v = S.v2 || {}, x = S.extra || {};
    if (!v.prices) return null;
    const G = Object.assign({}, v.generation || {});
    G.nuclear_availability = nuclearNow(v.generation, x.power);
    const nn = x.nn;
    return { prices: v.prices, generation: G, hydrology: v.hydrology, weather: v.weather, tomorrow: v.tomorrow, nn: nn, normals: nn && nn.prices ? { pre: true, month_days: nn.month_days, normal: nn.prices.normal } : v.prices_normals };
  }

  /* ---------- small helpers ---------- */
  const f1 = v => K.n1(v), f0 = v => K.n0(v);
  const pop = o => K.popAttr(o);
  const lk = (lab, href) => [K.pageLab(href), href];
  const srcL = s => ["Source: " + s[0], s[1]];
  function rangeBtns() {
    return '<span class="cdl-scale" role="group" aria-label="Chart range">' + ["1M", "1Y"].map(k => '<button type="button" data-nl-range="' + k + '" aria-pressed="' + (S.range === k) + '">' + k + "</button>").join("") + "</span>";
  }
  function head(title, sub, right, href) {
    return '<header class="bh"><h2>' + (href ? '<a class="nlh-a" href="' + href + '">' + K.esc(title) + "</a>" : K.esc(title)) + (sub ? ' <small class="nlsub">' + K.esc(sub) + "</small>" : "") + "</h2>" + (right ? '<span class="bh-r">' + right + "</span>" : "") + "</header>";
  }
  const days = () => (S.range === "1Y" ? 365 : 30);
  function windowRows(rows) {
    if (!rows || !rows.length) return [];
    const end = rows[rows.length - 1][0], start = addDays(end, -days() + 1);
    return rows.filter(r => r[0] >= start);
  }
  /* note when the published series is shorter than the chosen range */
  function spanNote(rows) {
    if (S.range !== "1Y" || !rows.length) return "";
    const first = rows[0][0], want = addDays(rows[rows.length - 1][0], -364);
    return first > addDays(want, 14) ? '<span class="nlspan">Published series starts ' + K.esc(shortY(first)) + "</span>" : "";
  }

  /* Line chart: rows [date, value, normal, bandLo, bandHi]; o.faint = [date, value] drawn thin; o.bars = anomaly bars.
     Axis labels are HTML so they stay legible when the SVG stretches. */
  function chart(rows, o) {
    o = o || {};
    const p = (rows || []).filter(r => K.finite(r[1]));
    if (p.length < 3) return '<p class="na">Not available yet</p>';
    const W = 600, H = o.h || 120, vals = [];
    p.forEach(r => { [1, 2, 3, 4].forEach(k => { if (K.finite(r[k])) vals.push(r[k]); }); });
    (o.faint || []).forEach(r => { if (K.finite(r[1])) vals.push(r[1]); });
    (o.bars || []).forEach(r => { if (K.finite(r[1])) vals.push(r[1]); });
    if (o.zero) vals.push(0);
    (o.ref || []).forEach(v => vals.push(v));
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (o.fix) { lo = o.fix[0]; hi = o.fix[1]; }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.06; if (!o.fix) { hi += pad; lo -= pad; }
    const t0 = Date.parse(p[0][0] + "T00:00:00Z"), t1 = Date.parse(p[p.length - 1][0] + "T00:00:00Z"), span = Math.max(1, t1 - t0);
    const X = d => ((Date.parse(d + "T00:00:00Z") - t0) / span * W).toFixed(1), Y = v => (H - (v - lo) / (hi - lo) * H).toFixed(1);
    let g = "";
    [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75].forEach(v => { g += '<line class="gr" x1="0" x2="' + W + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>'; });
    if (o.zero && lo < 0 && hi > 0) g += '<line class="z0" x1="0" x2="' + W + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    (o.ref || []).forEach(v => { g += '<line class="rf" x1="0" x2="' + W + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>'; });
    const band = p.filter(r => K.finite(r[3]) && K.finite(r[4]));
    if (band.length > 1) g += '<polygon class="bd" points="' + band.map(r => X(r[0]) + "," + Y(r[4])).concat(band.slice().reverse().map(r => X(r[0]) + "," + Y(r[3]))).join(" ") + '"/>';
    if (o.bars) {
      const bw = Math.max(1, W / Math.max(1, o.bars.length) * 0.7);
      o.bars.forEach(r => { if (!K.finite(r[1])) return; const y0 = +Y(0), y1 = +Y(r[1]); g += '<rect class="' + (o.barTone ? o.barTone(r[1]) : "gn") + '" x="' + (X(r[0]) - bw / 2).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0.5, Math.abs(y1 - y0)).toFixed(1) + '"/>'; });
    }
    if (o.tightAbove !== undefined) {
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (!K.finite(a[2]) || !K.finite(b[2])) continue;
        const d = (a[1] - a[2]) + (b[1] - b[2]);
        if (!d) continue;
        g += '<polygon class="' + (o.tightAbove === null ? "gn" : (d > 0) === o.tightAbove ? "gt" : "gl") + '" points="' + X(a[0]) + "," + Y(a[1]) + " " + X(b[0]) + "," + Y(b[1]) + " " + X(b[0]) + "," + Y(b[2]) + " " + X(a[0]) + "," + Y(a[2]) + '"/>';
      }
    }
    if (o.scoreFill) {
      /* balance history: area to zero, red above (tight), blue below (loose) */
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        g += '<polygon class="' + ((a[1] + b[1]) > 0 ? "sft" : "sfl") + '" points="' + X(a[0]) + "," + Y(a[1]) + " " + X(b[0]) + "," + Y(b[1]) + " " + X(b[0]) + "," + Y(0) + " " + X(a[0]) + "," + Y(0) + '"/>';
      }
    }
    const line = (rs, k) => rs.filter(r => K.finite(r[k])).map(r => X(r[0]) + "," + Y(r[k])).join(" ");
    if (o.faint && o.faint.length > 1) g += '<polyline class="fl" points="' + line(o.faint.filter(r => r[0] >= p[0][0]), 1) + '"/>';
    if (p.some(r => K.finite(r[2]))) g += '<polyline class="nl" points="' + line(p, 2) + '"/>';
    if (!o.bars || o.line !== false) g += '<polyline class="sl"' + (o.color ? ' style="stroke:' + o.color + '"' : "") + ' points="' + line(p, 1) + '"/>';
    (o.more || []).forEach(s => { g += '<polyline class="sl sm" style="stroke:' + s.color + '" points="' + line(s.rows, 1) + '"/>'; });
    const fy = o.fy || (v => f1(v));
    const mid = p[Math.floor((p.length - 1) / 2)][0];
    return '<div class="nlc" style="--h:' + H + 'px"><div class="nlc-y"><span>' + K.esc(fy(lo + (hi - lo) * 0.75)) + "</span><span>" + K.esc(fy(lo + (hi - lo) * 0.25)) + '</span></div><svg class="nlc-s" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' + g + '</svg><div class="nlc-x"><span>' + K.esc(short(p[0][0])) + "</span><span>" + K.esc(short(mid)) + "</span><span>" + K.esc(short(p[p.length - 1][0])) + "</span></div></div>";
  }

  /* ---------- balance history (same formula as nordicStress, applied to each published day) ---------- */
  function balanceHistory(N) {
    const G = N.generation || {}, M = (((G.regions || {}).Nordic || {}).metrics) || {}, NN = N.nn;
    const na = G.nuclear_availability || {}, inst = Object.values(na.installed_mw || {}).filter(K.finite).reduce((a, b) => a + b, 0);
    const no = N.hydrology && N.hydrology.reservoirs && N.hydrology.reservoirs.NO, nrows = (no && no.rows) || [];
    const tmap = {}; ((((N.weather || {}).regions || {}).Nordic || {}).metrics || {}).temp && N.weather.regions.Nordic.metrics.temp.rows.forEach(r => { tmap[r[0]] = r; });
    const nmap = {}; ((M.nuclear && M.nuclear.rows) || []).forEach(r => { nmap[r[0]] = r; });
    const out = [];
    ((M.wind_load_factor && M.wind_load_factor.rows) || []).forEach(w => {
      const d = w[0], parts = [];
      let r = null; for (let i = nrows.length - 1; i >= 0; i--) { if (nrows[i][0] <= d) { r = nrows[i]; break; } }
      const b = r && addDays(r[0], 10) >= d ? K.weekBand(no, r[0]) : null;
      if (r && b && K.finite(r[1])) parts.push(K.clamp(-(r[1] - b.med) / 10));
      const nr = nmap[d];   // nuclear: that day's output as a share of installed capacity, fixed bands (kit nucScore), never a normal
      if (nr && K.finite(nr[1]) && inst > 0) parts.push(K.nucScore(nr[1] / inst * 100));
      const wn = K.nnAt(NN, "wind_lf", d) != null ? K.nnAt(NN, "wind_lf", d) : w[3];
      if (K.finite(w[2]) && K.finite(wn)) parts.push(K.clamp(-(w[2] - wn) / 10));
      const t = tmap[d];
      if (t && K.finite(t[2]) && K.finite(t[4])) parts.push(K.clamp(-(t[2] - t[4]) / 3));
      if (parts.length >= 3) out.push([d, Math.round(K.mean(parts) * 100)]);
    });
    return out;
  }
  function balanceHTML(N, parts) {
    const hist = balanceHistory(N), w = windowRows(hist), st = K.nordicStress(N);
    const last = K.lastOf(hist), wk = hist.length > 7 ? hist[hist.length - 8] : null;
    const hp = pop({ title: "Balance history", value: last ? (last[1] > 0 ? "+" : "") + last[1] + " on " + K.dayText(last[0]) : null, explain: "The same four supply drivers and scoring as the gauge, computed for each published day: reservoirs (latest NVE week), nuclear (that day's output as a share of installed capacity, scored by fixed bands: " + K.NUC_BANDS + "), wind load factor (30 days against the 2015–25 normal) and temperature (30 days against ERA5 2006–25). Above zero is tight (red), below is loose (blue); ±25 marks tight or loose. The headline uses UMM capacity online now, so it can differ from the last day here.", fresh: last ? "Daily, to " + K.dayText(last[0]) : null, links: [lk("", "#energy/generation"), lk("", "#energy/hydro"), srcL(K.SRC.ENTSOE), srcL(NVE)] });
    const chg = last && wk ? '<span class="nlkv">' + (last[1] > 0 ? "+" : "") + last[1] + '</span> <span class="nlks">on ' + K.esc(K.dayText(last[0])) + " · " + K.esc(K.sg(last[1] - wk[1], 0)) + " in a week</span>" : "";
    return '<section class="nlb nl-bal" id="nlBalance">' + head("Supply balance", "reservoirs, wind and temperature against normal; nuclear against installed capacity", rangeBtns()) + parts[0] +
      '<div class="nlhist"' + hp + ' tabindex="0"><div class="nlhh"><span class="kl">Balance history, daily score</span>' + chg + spanNote(w) + "</div>" +
      chart(w, { h: 110, zero: true, scoreFill: true, fix: [Math.min(-60, Math.min.apply(null, w.map(r => r[1]).concat([0])) - 5), Math.max(60, Math.max.apply(null, w.map(r => r[1]).concat([0])) + 5)], ref: [25, -25], fy: v => (v > 0 ? "+" : "") + Math.round(v) }) +
      K.tagFr(last ? ["Observed", "daily to " + K.dayText(last[0]) + (st.missing.length ? " · left out: " + st.missing.join(", ") : "")] : null) + "</div></section>";
  }

  /* ---------- zones ---------- */
  function zoneVals(N) {
    const P = N.prices, T = N.tomorrow, today = K.lastOf(P.regions && P.regions.Nordic && P.regions.Nordic.rows), d0 = today && today[0];
    const hasNext = T && T.delivery_date && d0 && T.delivery_date > d0 && K.finite(K.tomorrowAvg(T, "Nordic"));
    const useNext = S.zday === "next" && hasNext, dd = useNext ? T.delivery_date : d0;
    const on = (z, d) => { const r = (P.regions[z] && P.regions[z].rows || []).find(x => x[0] === d); return r && K.finite(r[1]) ? r[1] : null; };
    const val = z => (useNext ? K.tomorrowAvg(T, z) : on(z, d0));
    return { d0: d0, dd: dd, useNext: useNext, hasNext: hasNext, val: val, on: on };
  }
  function zonesHTML(N, parts) {
    const P = N.prices, PN = N.normals, T = N.tomorrow, Z = zoneVals(N), sys = Z.val("Nordic");
    const cell = (z, area) => {
      const v = Z.val(z), n = K.normalAt(PN, z, Z.dd), dv = K.finite(v) && K.finite(n) && n > 0 ? (v / n - 1) * 100 : null, spr = K.finite(v) && K.finite(sys) ? v - sys : null;
      return '<a class="nm" href="#energy/prices" style="grid-area:' + area + ";" + K.tint(K.finite(dv) ? dv / 100 : null) + '"' + pop({ title: z + " day-ahead", value: K.finite(v) ? f1(v) + " €/MWh" : null, explain: (K.finite(n) ? "Normal for the same weeks (" + K.nbasis(z, PN) + ", date ±7 days) " + f1(n) + " €/MWh" + (K.finite(dv) ? ", " + K.sg(dv, 0) + "%" : "") + ". " : "No normal for this zone. ") + (K.finite(spr) ? "Spread to the system price " + K.sg(spr) + " €/MWh." : ""), fresh: "Delivery " + K.dayText(Z.dd), links: [lk("", "#energy/prices"), srcL(K.SRC.NP)] }) + '><span class="zn">' + z + '</span><span class="zv">' + (K.finite(v) ? f0(v) : "–") + '</span><span class="zs">' + (K.finite(spr) ? K.esc(K.sg(spr, 0)) + " vs SYS" : "") + "</span></a>";
    };
    const map = '<div class="nlmap" aria-label="Bidding zones, laid out roughly by geography">' + MAP.map(([z, a]) => cell(z, a)).join("") + '<div class="nmsys" style="grid-area:sys"><span class="zn">SYS</span><span class="zv">' + (K.finite(sys) ? f0(sys) : "–") + '</span><span class="zs">system</span></div></div>';
    /* table: today, tomorrow, 7-day and 30-day averages against the 2023–25 normal for the same days */
    const rows = K.ZONES.map(z => {
      const rr = (P.regions[z] && P.regions[z].rows || []).filter(r => r[0] <= Z.d0);
      const l7 = rr.slice(-7).map(r => r[1]).filter(K.finite), l30 = rr.slice(-30);
      const a7 = l7.length === 7 ? K.mean(l7) : null, a30v = l30.map(r => r[1]).filter(K.finite), a30 = a30v.length >= 28 ? K.mean(a30v) : null;
      const n30 = l30.length ? K.mean(l30.map(r => K.normalAt(PN, z, r[0]))) : null, dv = K.finite(a30) && K.finite(n30) && n30 > 0 ? a30 / n30 - 1 : null;
      const t = Z.on(z, Z.d0), tm = Z.hasNext ? K.tomorrowAvg(T, z) : null;
      const td = (v, s) => '<td style="' + K.tint(s) + '">' + (K.finite(v) ? f1(v) : '<span class="na">–</span>') + "</td>";
      const nz = d => { const n = K.normalAt(PN, z, d); return K.finite(n) && n > 0 ? n : null; };
      return "<tr><th scope=\"row\">" + (z === "Nordic" ? "SYS" : z) + "</th>" + td(t, K.finite(t) && nz(Z.d0) ? K.clamp(t / nz(Z.d0) - 1) * 0.6 : null) + td(tm, K.finite(tm) && nz(T.delivery_date) ? K.clamp(tm / nz(T.delivery_date) - 1) * 0.6 : null) + td(a7, null) + td(a30, null) + "<td>" + (K.finite(n30) ? f1(n30) : '<span class="na">–</span>') + "</td><td>" + (K.finite(dv) ? K.chip(K.sg(dv * 100, 0) + "%", K.clamp(dv)) : '<span class="na">–</span>') + "</td></tr>";
    }).join("");
    const tp = pop({ title: "Zone prices against normal", explain: "Day-ahead averages by bidding zone from Nord Pool. Today and tomorrow are tinted against the " + K.nbasis("Nordic", PN) + " average for the same weeks. 7-day and 30-day averages end on " + K.dayText(Z.d0) + "; the normal is the 2023–25 average over the same 30 days.", fresh: "Delivery " + K.dayText(Z.d0) + (Z.hasNext ? ", tomorrow " + K.dayText(T.delivery_date) : ""), links: [lk("", "#energy/prices"), srcL(K.SRC.NP)] });
    const table = '<div class="nltbl"' + tp + ' tabindex="0"><table class="nlt"><thead><tr><th>Zone</th><th>' + K.esc(short(Z.d0)) + "</th><th>" + (Z.hasNext ? K.esc(short(T.delivery_date)) : "Next day") + "</th><th>7-day</th><th>30-day</th><th>Normal</th><th>vs normal</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
    let mtd = "";
    try { if (window.MMV2Power && MMV2Power.mtdTableHtml) mtd = MMV2Power.mtdTableHtml(S.v2, MMV2Power.zurichToday(), K.lastOf(P.regions.Nordic.rows)[0]); } catch (e) { mtd = ""; }
    return '<section class="nlb nl-zones" id="nlZones">' + head("Prices by zone", "€/MWh, Nord Pool day-ahead", "", "#energy/prices") + parts[1] +
      '<div class="nlzg"><div class="nlzc"><span class="kl">Zone map · ' + (Z.useNext ? "next day " + K.esc(short(Z.dd)) : K.esc(short(Z.dd))) + '</span>' + map + "</div>" + '<div class="nlzc"><span class="kl">Today, tomorrow and averages</span>' + table + "</div>" + (mtd ? '<div class="nlzc nlmtd">' + mtd + "</div>" : "") + "</div></section>";
  }

  /* ---------- hourly ---------- */
  function hourly(dash, ymd) {
    if (!dash || !dash.t0 || !dash.zones) return {};
    const t0 = Date.parse(dash.t0), fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
    const out = {};
    Object.keys(dash.zones).forEach(z => {
      const p = dash.zones[z].p; if (!Array.isArray(p)) return;
      const sc = (dash.enc && dash.enc.scale && dash.enc.scale.p) || 1;
      let acc = 0; const hrs = [];
      p.forEach((dv, i) => {
        acc += dv;
        const parts = fmt.formatToParts(new Date(t0 + i * 36e5)), g = k => (parts.find(x => x.type === k) || {}).value;
        if (g("year") + "-" + g("month") + "-" + g("day") === ymd) hrs.push([+g("hour"), acc / sc]);
      });
      if (hrs.length >= 23) out[z] = hrs;
    });
    return out;
  }
  function hourlyHTML(N) {
    const Z = zoneVals(N), T = N.tomorrow, x = S.extra || {};
    const H = hourly(x.dash, Z.dd);
    if (Z.useNext && T && T.regions && T.regions.Nordic && Array.isArray(T.regions.Nordic.price) && T.regions.Nordic.price.filter(K.finite).length >= 23) H.SYS = T.regions.Nordic.price.map((v, i) => [+(String((T.hours || [])[i] || "").slice(11, 13)) || i, v]);
    const series = HZ.filter(([z]) => H[z]);
    if (!series.length) return '<section class="nlb" id="nlHourly">' + head("Hourly prices", "", "") + "<p>" + K.NA + "</p></section>";
    const all = []; series.forEach(([z]) => H[z].forEach(h => { if (K.finite(h[1])) all.push(h[1]); }));
    let lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all); hi += (hi - lo) * 0.06;
    const W = 600, HH = 150, X = h => (h / 23 * W).toFixed(1), Y = v => (HH - (v - lo) / (hi - lo) * HH).toFixed(1);
    let g = "";
    [0.25, 0.5, 0.75].forEach(f => { g += '<line class="gr" x1="0" x2="' + W + '" y1="' + Y(lo + (hi - lo) * f) + '" y2="' + Y(lo + (hi - lo) * f) + '"/>'; });
    if (lo < 0) g += '<line class="z0" x1="0" x2="' + W + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    series.forEach(([z, c]) => { g += '<polyline class="sl' + (z === "SYS" ? " sys" : " sm") + '" style="stroke:' + c + '" points="' + H[z].filter(h => K.finite(h[1])).map(h => X(h[0]) + "," + Y(h[1])).join(" ") + '"/>'; });
    const legend = series.map(([z, c]) => '<span class="lg"><i style="background:' + c + '"></i>' + z + "</span>").join("");
    const rows = series.map(([z, c]) => {
      const v = H[z].filter(h => K.finite(h[1])), mx = v.reduce((a, b) => (b[1] > a[1] ? b : a)), mn = v.reduce((a, b) => (b[1] < a[1] ? b : a)), av = K.mean(v.map(h => h[1]));
      const hh = h => String(h).padStart(2, "0") + ":00";
      return '<tr><th scope="row"><i class="sw" style="background:' + c + '"></i>' + z + "</th><td>" + f1(av) + '</td><td><span class="pk">' + f0(mx[1]) + "</span> " + hh(mx[0]) + '</td><td><span class="tr">' + f0(mn[1]) + "</span> " + hh(mn[0]) + "</td><td>" + f0(mx[1] - mn[1]) + "</td></tr>";
    }).join("");
    const btn = (k, t, dis) => '<button type="button" data-lp-zday="' + k + '" aria-pressed="' + ((k === "next") === !!Z.useNext) + '"' + (dis ? " disabled" : "") + ">" + t + "</button>";
    const pp = pop({ title: "Hourly day-ahead prices", explain: "Nord Pool day-ahead prices by hour, Zurich time, for the system price and five key zones. The noon auction sets the next day, so tomorrow appears around 13:00. The system price is published per hour only for the next day in these files, so it is missing from today's chart. Peak-to-trough spread is the value of flexibility (batteries, hydro).", fresh: "Delivery " + K.dayText(Z.dd), links: [lk("", "#energy/prices"), srcL(K.SRC.NP)] });
    return '<section class="nlb nl-hourly" id="nlHourly">' + head("Hourly prices", "€/MWh by hour, Zurich time", '<span class="cdl-scale" role="group" aria-label="Delivery day">' + btn("today", short(Z.d0) || "Today") + btn("next", Z.hasNext ? short(T.delivery_date) : "Next day", !Z.hasNext) + "</span>", "#energy/prices") +
      '<div class="nlhg"><div' + pp + ' tabindex="0"><div class="nlleg">' + legend + '</div><div class="nlc" style="--h:' + HH + 'px"><div class="nlc-y"><span>' + f0(lo + (hi - lo) * 0.75) + "</span><span>" + f0(lo + (hi - lo) * 0.25) + '</span></div><svg class="nlc-s" viewBox="0 0 ' + W + " " + HH + '" preserveAspectRatio="none" aria-hidden="true">' + g + '</svg><div class="nlc-x"><span>00:00</span><span>12:00</span><span>23:00</span></div></div>' +
      K.tagFr(["Delivery", K.dayText(Z.dd) + (H.SYS ? "" : " · SYS hourly only for the next day")]) + '</div><table class="nlt nlht"><thead><tr><th>Zone</th><th>Avg</th><th>Peak</th><th>Trough</th><th>Spread</th></tr></thead><tbody>' + rows + "</tbody></table></div></section>";
  }

  /* ---------- price history ---------- */
  function priceHistHTML(N) {
    const mr = (S.extra || {}).mr, dl = mr && mr.daily, PN = N.normals;
    const key = S.hz, nk = key === "SYS" ? "Nordic" : key;
    let rows = [];
    if (dl && dl.start && dl.v && Array.isArray(dl.v[key])) {
      const t0 = Date.parse(dl.start + "T00:00:00Z");
      rows = dl.v[key].map((v, i) => { const d = new Date(t0 + i * 864e5).toISOString().slice(0, 10); return [d, K.finite(v) ? v : null, K.normalAt(PN, nk, d)]; });
      while (rows.length && !K.finite(rows[rows.length - 1][1])) rows.pop();
    }
    const w = windowRows(rows), last = K.lastOf(w);
    const av = K.mean(w.map(r => r[1])), an = K.mean(w.map(r => r[2])), dv = K.finite(av) && K.finite(an) && an > 0 ? av / an - 1 : null;
    const chips = ["SYS", "SE1", "SE2", "SE3", "SE4", "NO1", "NO2", "NO3", "NO4", "NO5", "FI", "DK1", "DK2"].map(z => '<button type="button" data-nl-hz="' + z + '" aria-pressed="' + (z === key) + '">' + z + "</button>").join("");
    const pp = pop({ title: key + " daily day-ahead", value: last ? f1(last[1]) + " €/MWh" : null, explain: "Daily average day-ahead price. Dashed: the " + K.nbasis(nk, PN) + " average for the same weeks (date ±7 days). Red shading where above normal, blue where below. " + (K.finite(dv) ? "Over the period the average is " + f1(av) + " against a normal of " + f1(an) + " (" + K.sg(dv * 100, 0) + "%)." : ""), fresh: last ? "Delivery to " + K.dayText(last[0]) : null, links: [lk("", "#energy/prices"), srcL(K.SRC.NP)] });
    return '<section class="nlb" id="nlPrice">' + head("Price against normal", S.range === "1Y" ? "last 12 months" : "last 30 days", rangeBtns(), "#energy/prices") +
      '<div class="nlzchips" role="group" aria-label="Zone">' + chips + "</div><div" + pp + ' tabindex="0"><div class="nlhh"><span class="nlkv">' + (K.finite(av) ? f1(av) : "–") + '</span> <span class="nlks">€/MWh average · normal ' + (K.finite(an) ? f1(an) : "–") + "</span> " + (K.finite(dv) ? K.chip(K.sg(dv * 100, 0) + "%", K.clamp(dv)) : "") + spanNote(w) + "</div>" +
      chart(w, { h: 130, tightAbove: true, fy: v => f0(v) }) + K.tagFr(last ? ["Delivery", "daily to " + K.dayText(last[0])] : null) + "</div></section>";
  }

  /* ---------- forwards ---------- */
  function monthsOf(c) {
    const mo = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    let m;
    if ((m = /^([A-Z][a-z]{2})-\d\d$/.exec(c)) && mo[m[1]]) return [mo[m[1]]];
    if ((m = /^Q([1-4])-\d\d$/.exec(c))) return [1, 2, 3].map(i => (+m[1] - 1) * 3 + i);
    if (/^Cal-\d\d$/.test(c)) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return [];
  }
  function fwdHTML(N) {
    const cv = (S.extra || {}).curve, nn = (S.extra || {}).nn;
    if (!cv) return '<section class="nlb" id="nlFwd">' + head("Forward curve", "", "", "#energy/prices") + "<p>" + K.NA + "</p></section>";
    const rows = cv.now.rows, asof = (rows[0] && rows[0].as_of) || cv.now.date;
    const fut = rows.filter(r => r.exp > asof);
    const pick = [];
    const first = (re, n) => fut.filter(r => re.test(r.c)).slice(0, n).forEach(r => pick.push(r));
    first(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d\d$/, 3); first(/^Q\d-\d\d$/, 2); first(/^Cal-\d\d$/, 2);
    const ord = r => (r.c.startsWith("Cal") ? 3 : r.c.startsWith("Q") ? 2 : 1);
    pick.sort((a, b) => ord(a) - ord(b) || (a.exp < b.exp ? -1 : 1));
    const MD = nn && nn.month_days, NV = nn && nn.prices && nn.prices.normal && nn.prices.normal.Nordic;
    const normOf = c => { const ms = monthsOf(c); if (!MD || !NV || !ms.length) return null; const v = MD.map((d, i) => (ms.indexOf(+d.slice(0, 2)) >= 0 ? NV[i] : null)).filter(K.finite); return v.length ? K.mean(v) : null; };
    const prev = (o, c) => { const r = o && o.rows.find(x => x.c === c); return r ? r.p : null; };
    const mx = Math.max.apply(null, pick.map(r => Math.max(r.p, normOf(r.c) || 0))) * 1.08;
    const body = pick.map(r => {
      const n = normOf(r.c), dv = K.finite(n) && n > 0 ? r.p / n - 1 : null, pw = prev(cv.w, r.c), pm = prev(cv.m, r.c);
      const ch = v => (K.finite(v) ? '<span class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + K.esc(K.sg(v, 2)) + "</span>" : '<span class="na">–</span>');
      return '<tr' + pop({ title: "Nordic " + r.c, value: f1(r.p) + " €/MWh", explain: "EEX Nordic system-price base-load settlement for " + r.c + ". Normal: the " + ((nn && nn.prices && nn.prices.years) || []).join("–").replace(/–\d+–/, "–") + " average system price over the same calendar months (" + (K.finite(n) ? f1(n) + " €/MWh" : "not available") + ")" + (K.finite(dv) ? ", so the market prices " + K.sg(dv * 100, 0) + "% against normal." : ".") + " Changes are against the settlements " + (cv.w ? K.dayText(cv.w.date) : "a week earlier") + " and " + (cv.m ? K.dayText(cv.m.date) : "a month earlier") + ".", fresh: "Settle EEX " + K.dayText(asof), links: [lk("", "#energy/prices"), srcL(EEX)] }) + ' tabindex="0"><th scope="row">' + K.esc(r.c) + '</th><td class="nlbar"><span class="fbar"><i style="width:' + (r.p / mx * 100).toFixed(1) + "%;" + K.tint(K.finite(dv) ? K.clamp(dv) * 0.8 : null).replace("background:", "background:") + '"></i>' + (K.finite(n) ? '<b style="left:' + (n / mx * 100).toFixed(1) + '%"></b>' : "") + '</span></td><td class="nlp1">' + f1(r.p) + "</td><td>" + (K.finite(n) ? f1(n) : '<span class="na">–</span>') + "</td><td>" + (K.finite(dv) ? K.chip(K.sg(dv * 100, 0) + "%", K.clamp(dv)) : "") + "</td><td>" + ch(r.d1) + "</td><td>" + ch(K.finite(pw) ? r.p - pw : null) + "</td><td>" + ch(K.finite(pm) ? r.p - pm : null) + "</td></tr>";
    }).join("");
    return '<section class="nlb" id="nlFwd">' + head("Forward curve", "EEX Nordic system price, €/MWh", "", "#energy/prices") +
      '<table class="nlt nlft"><thead><tr><th>Contract</th><th class="nlbar"><span class="lg"><i class="lgb"></i>settle</span> <span class="lg"><i class="lgt"></i>normal</span></th><th>Settle</th><th>Normal</th><th>vs normal</th><th>1D</th><th>1W</th><th>1M</th></tr></thead><tbody>' + body + "</tbody></table>" +
      K.tagFr(["Settle", "EEX " + K.dayText(asof) + (cv.w ? " · 1W vs " + short(cv.w.date) : "") + (cv.m ? " · 1M vs " + short(cv.m.date) : "")]) + ' <a class="nlmore" href="#energy/prices">Full curve and zone forwards →</a></section>';
  }

  /* ---------- reservoirs ---------- */
  function resHTML(N) {
    const R = (N.hydrology || {}).reservoirs || {};
    const main = K.resBar(R, "NO", "Norway", "%") + K.resBar(R, "SE", "Sweden", "TWh") + K.resBar(R, "FI", "Finland", "TWh");
    const zones = ["NO1", "NO2", "NO3", "NO4", "NO5"].map(z => K.resBar(R, z, z, "%")).join("");
    const no = R.NO, rows = ((no && no.rows) || []).map(r => { const b = K.weekBand(no, r[0]); return [r[0], r[1], b && b.med, b && b.min, b && b.max]; });
    const w = windowRows(rows), last = K.lastOf(rows), bal = no && no.reservoir_balance_twh;
    const pp = pop({ title: "Norway reservoir filling", value: last ? f1(last[1]) + "%" : null, explain: "NVE weekly filling, % of capacity. Shaded band: minimum to maximum for the same week, dashed: median (NVE 2006–25 reference). Below the median raises the value of stored water and so prices." + (bal && K.finite(bal.difference) ? " Energy terms: " + f1(bal.value) + " TWh against " + f1(bal.normal) + " TWh normal (" + K.sg(bal.difference) + " TWh)." : ""), fresh: last ? "Week of " + K.dayText(last[0]) : null, links: [lk("", "#energy/hydro"), srcL(NVE)] });
    return '<section class="nlb" id="nlRes">' + head("Reservoirs", "against the range for the same week", rangeBtns(), "#energy/hydro") +
      '<div class="nlrg"><div><span class="kl">By country</span>' + (main || K.NA) + '<span class="kl nlk2">Norway by zone</span>' + (zones || K.NA) + "</div><div" + pp + ' tabindex="0"><span class="kl">Norway, weekly % full</span>' + spanNote(w) +
      chart(w, { h: 140, tightAbove: false, fy: v => f0(v) + "%" }) + K.tagFr(last ? ["Observed", "weekly, latest week of " + K.dayText(last[0]) + (R.SE && R.SE.as_of ? " · Sweden " + short(R.SE.as_of) : "") + (R.FI && R.FI.as_of ? " · Finland " + short(R.FI.as_of) : "")] : null) +
      (bal && K.finite(bal.difference) ? '<p class="fnote keep">Norway holds ' + f1(bal.value) + " TWh against " + f1(bal.normal) + " TWh normal (" + K.esc(K.sg(bal.difference)) + " TWh). Sweden and Finland: TWh stored, ENTSO-E 2015–25 range; no capacity denominator is published, so no % full.</p>" : "") + "</div></div></section>";
  }

  /* ---------- nuclear ---------- */
  function nucHTML(N, parts) {
    const na = (N.generation || {}).nuclear_availability || {}, t = Date.parse(na.observed_at) || Date.now();
    const units = (na.reactors_out || []).filter(r => K.finite(r.cap) && K.finite(r.now));
    const active = units.filter(r => !(Date.parse(r.start) > t) && r.now < r.cap).sort((a, b) => (b.cap - b.now) - (a.cap - a.now));
    const later = units.filter(r => Date.parse(r.start) > t).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const zt = iso => (K.zurich(iso, true) || "").replace(/ Zurich$/, "");
    const row = (r, up) => '<tr><th scope="row">' + K.esc(r.n) + ' <span class="nlc2">' + K.esc(r.c) + '</span><span class="nlwhy2">' + K.esc(r.why || "") + "</span></th><td>" + f0(r.cap) + '</td><td data-l="Available, MW">' + f0(up ? r.cap : r.now) + '</td><td data-l="' + (up ? "Starts" : "MW off") + '">' + (up ? '<span class="na">from ' + K.esc(zt(r.start)) + "</span>" : f0(r.cap - r.now)) + "</td><td>" + (r.planned === false ? '<span class="dv tt">Unplanned</span>' : '<span class="dv tn">Planned</span>') + '</td><td data-l="Back (Zurich)">' + K.esc(zt(r.back)) + '</td><td class="nlwhy">' + K.esc(r.why || "") + "</td></tr>";
    const inst = na.installed_mw || {}, listed = c => units.filter(r => r.c === c).reduce((a, r) => a + r.cap, 0);
    const other = ["SE", "FI"].map(c => K.finite(inst[c]) ? c + " " + f0(inst[c] - listed(c)) + " MW" : null).filter(Boolean).join(", ");
    const table = active.length || later.length ? '<div class="nltbl"><table class="nlt nlnt"><thead><tr><th>Reactor</th><th>Capacity</th><th>Available</th><th>MW off</th><th>Type</th><th>Back (Zurich)</th><th class="nlwhy">Reason (UMM)</th></tr></thead><tbody>' + active.map(r => row(r, false)).join("") + (later.length ? '<tr class="nlsep"><th colspan="7">Announced, not started</th></tr>' + later.map(r => row(r, true)).join("") : "") + "</tbody></table></div>" : "<p>No active nuclear UMM messages.</p>";
    /* 14-day outlook (live-data power.json only) */
    let out = "";
    const dd = na.days || (((S.extra || {}).power || {}).nuclear || {}).days, tot = (inst.SE || 0) + (inst.FI || 0);
    if (Array.isArray(dd) && dd.length && tot > 0) {
      out = '<div class="nl14"' + pop({ title: "Nuclear availability, next 14 days", explain: "Available Swedish and Finnish nuclear capacity per day from active and announced UMM outage messages, against full installed capacity (" + f0(tot) + " MW). Plans change: delayed restarts are common.", fresh: "UMM as of " + zt(na.observed_at) + " Zurich", links: [lk("", "#energy/generation"), srcL(UMM)] }) + ' tabindex="0"><span class="kl">Available capacity, next 14 days (UMM plans)</span><div class="nl14b">' +
        dd.map(d => { const se = K.finite(d[1]) ? d[1] : 0, fi = K.finite(d[2]) ? d[2] : 0, p = (se + fi) / tot * 100; return '<span class="c" title="' + K.esc(short(d[0]) + ": " + f0(se + fi) + " MW, " + Math.round(p) + "%") + '"><i class="se" style="height:' + (se / tot * 100).toFixed(1) + '%"></i><i class="fi" style="height:' + (fi / tot * 100).toFixed(1) + '%"></i><em>' + Math.round(p) + "</em></span>"; }).join("") +
        '</div><div class="nlc-x"><span>' + K.esc(short(dd[0][0])) + "</span><span>" + K.esc(short(dd[dd.length - 1][0])) + '</span></div><div class="nlleg"><span class="lg"><i class="lse"></i>Sweden</span><span class="lg"><i class="lfi"></i>Finland</span><span class="lg">% of ' + f0(tot) + " MW installed</span></div></div>";
    }
    return '<section class="nlb" id="nlNuc">' + head("Nuclear", "Sweden and Finland, Nord Pool UMM", "", "#energy/generation") +
      '<div class="nlng"><div class="kpis nlk1">' + ((parts.named || {}).nuclear || "") + "</div>" + (out || "") + "</div>" + table +
      '<p class="fnote">Reactors without an active UMM message are not listed (' + K.esc(other || "–") + " of installed capacity). Available capacity is what the operators report, not measured output. UMM as of " + K.esc(zt(na.observed_at)) + ' Zurich. <a href="' + UMM[1] + '" target="_blank" rel="noopener noreferrer">Source: Nord Pool UMM ↗</a></p></section>';
  }

  /* ---------- wind, hydro, nuclear output, temperature ---------- */
  function gcard(title, href, value, chipH, sub, chartH, when, popo) {
    return '<div class="nlg"' + pop(popo) + ' tabindex="0"><div class="nlgh"><a class="kl" href="' + href + '">' + K.esc(title) + '</a><span class="nlkv">' + (value == null ? K.NA : K.esc(value)) + "</span> " + (chipH || "") + "</div>" + (sub ? '<div class="nlks">' + K.esc(sub) + "</div>" : "") + chartH + K.tagFr(when) + "</div>";
  }
  function genHTML(N) {
    const G = N.generation || {}, M = (((G.regions || {}).Nordic || {}).metrics) || {}, NN = N.nn || {};
    const na = G.nuclear_availability || {}, inst = Object.values(na.installed_mw || {}).filter(K.finite).reduce((a, b) => a + b, 0);
    const out = [];
    /* wind: 30-day load factor vs the 2015–25 normal for the same 30 days; daily as the faint line */
    const wr = (M.wind_load_factor && M.wind_load_factor.rows) || [], ww = windowRows(wr), wl = K.lastOf(wr);
    const wn = wl && K.nnAt(NN, "wind_lf", wl[0]);
    out.push(gcard("Wind load factor", "#energy/generation", wl && K.finite(wl[2]) ? f1(wl[2]) + "% (30d)" : null, wl && K.finite(wn) ? K.chip(K.sg(wl[2] - wn) + " pp", K.clamp(-(wl[2] - wn) / 10)) : "", wl ? "daily " + f1(wl[1]) + "% · normal " + f1(wn) + "% (" + K.yrs(NN.wind_lf) + ")" : null,
      spanNote(ww) + chart(ww.map(r => [r[0], r[2], K.nnAt(NN, "wind_lf", r[0])]), { h: 100, tightAbove: false, faint: ww.map(r => [r[0], r[1]]), fy: v => f0(v) + "%" }), wl && ["Observed", "to " + K.dayText(wl[0])],
      { title: "Wind load factor", explain: "Nordic wind output (SE, NO, FI, DK) as a share of installed capacity. Bold line: 30-day average; thin: daily; dashed: long-term normal for the same 30 days, " + K.yrs(NN.wind_lf) + ", each year's output over that year's capacity. Below normal (red) means less cheap supply.", fresh: wl ? "Observed to " + K.dayText(wl[0]) : null, links: [lk("", "#energy/generation"), srcL(K.SRC.ENTSOE)] }));
    /* hydro output: 30-day average vs the same 30 days in earlier years */
    const hr = (M.hydro && M.hydro.rows) || [], hw = windowRows(hr), hl = K.lastOf(hr), hs = hl && K.finite(hl[2]) && K.finite(hl[3]) ? hl[2] / hl[3] - 1 : null;
    out.push(gcard("Hydro output", "#energy/generation", hl && K.finite(hl[2]) ? f0(hl[2]) + " MW (30d)" : null, K.finite(hs) ? K.chip(K.sg(hs * 100, 0) + "%", null) : "", hl ? "daily " + f0(hl[1]) + " MW · same 30 days in earlier years " + f0(hl[3]) + " MW" : null,
      spanNote(hw) + chart(hw.map(r => [r[0], r[2], r[3]]), { h: 100, tightAbove: null, faint: hw.map(r => [r[0], r[1]]), fy: v => (v / 1000).toFixed(0) + " GW" }), hl && ["Observed", "to " + K.dayText(hl[0])],
      { title: "Hydro output", explain: "Nordic hydro generation. Bold: 30-day average; thin: daily; dashed: the same 30 days in earlier years (from 2015, at least three years). Not coloured: high output can mean ample water or producers running hard at high prices.", fresh: hl ? "Observed to " + K.dayText(hl[0]) : null, links: [lk("", "#energy/generation"), lk("", "#energy/hydro"), srcL(K.SRC.ENTSOE)] }));
    /* nuclear output as % of installed capacity (no normal, no history) */
    const nr = (M.nuclear && M.nuclear.rows) || [], nw = windowRows(nr), nl = K.lastOf(nr);
    const np = r => (inst > 0 && K.finite(r[1]) ? r[1] / inst * 100 : null);
    out.push(gcard("Nuclear output, measured", "#energy/generation", nl && K.finite(np(nl)) ? Math.round(np(nl)) + "% of installed" : null, nl && K.finite(np(nl)) ? K.chip(K.nucBand(np(nl)), K.nucScore(np(nl))) : "", nl ? f0(nl[1]) + " of " + f0(inst) + " MW installed on " + short(nl[0]) : null,
      spanNote(nw) + chart(nw.map(r => [r[0], np(r)]), { h: 100, fix: [0, 100], ref: [100], fy: v => f0(v) + "%" }), nl && ["Observed", "day " + K.dayText(nl[0])],
      { title: "Nuclear output", explain: "Swedish and Finnish nuclear generation each day as a share of installed capacity (" + f0(inst) + " MW); the line at 100% is installed capacity. " + K.NUC_BANDS, fresh: nl ? "Observed " + K.dayText(nl[0]) : null, links: [lk("", "#energy/generation"), srcL(K.SRC.ENTSOE)] }));
    /* temperature anomaly: daily bars, 30-day line */
    const tm = ((((N.weather || {}).regions || {}).Nordic || {}).metrics || {}).temp, tr = (tm && tm.rows) || [], tw = windowRows(tr), tl = K.lastOf(tr), cov = (N.weather || {}).coverage || {};
    const an = r => (K.finite(r[1]) && K.finite(r[3]) ? r[1] - r[3] : null), a30 = r => (K.finite(r[2]) && K.finite(r[4]) ? r[2] - r[4] : null);
    out.push(gcard("Temperature anomaly", "#energy/weather", tl && K.finite(a30(tl)) ? K.sg(a30(tl)) + " °C (30d)" : null, tl && K.finite(a30(tl)) ? K.chip(a30(tl) < 0 ? "colder" : "milder", K.clamp(-a30(tl) / 3)) : "", tl ? "daily " + f1(tl[1]) + " °C vs normal " + f1(tl[3]) + " °C · 30-day " + f1(tl[2]) + " vs " + f1(tl[4]) + " °C" : null,
      spanNote(tw) + chart(tw.map(r => [r[0], a30(r)]), { h: 100, zero: true, bars: tw.map(r => [r[0], an(r)]), barTone: v => (v < 0 ? "gt" : "gl"), fy: v => K.sg(v, 0) + "°" }), tl && ["Observed", "to " + K.dayText(tl[0]) + (cov.forecast_from ? " · forecast from " + short(cov.forecast_from) : "")],
      { title: "Temperature anomaly", explain: "Nordic land-area temperature against the ERA5 2006–25 normal for the date. Bars: daily anomaly, red where colder (more heating demand), blue where milder; line: 30-day anomaly. ERA5 runs about five days behind; the last days are Open-Meteo forecast until it catches up.", fresh: tl ? "Observed to " + K.dayText(tl[0]) : null, links: [lk("", "#energy/weather"), srcL(K.SRC.ERA5)] }));
    return '<section class="nlb" id="nlGen">' + head("Generation and weather", "against the same period in earlier years", rangeBtns(), "#energy/generation") + '<div class="nlgg">' + out.join("") + "</div></section>";
  }

  function linksHTML() {
    const L = [["#energy/prices", "Prices and forward curve", "Zone table, system chart, EEX curves"], ["#energy/generation", "Generation", "By fuel and country, nuclear against installed capacity"], ["#energy/weather", "Weather", "Wind, temperature, rain against normal"], ["#energy/hydro", "Hydro", "Reservoirs and inflow"], ["#energy/gas", "Gas storage", "EU storage against the 5-year range"], ["#live", "Live Pulse", "The cross-asset brief"]];
    return '<nav class="nllinks" aria-label="Deeper Nordic pages">' + L.map(l => '<a href="' + l[0] + '"><b>' + K.esc(l[1]) + " →</b><span>" + K.esc(l[2]) + "</span></a>").join("") + "</nav>";
  }

  /* ---------- render ---------- */
  function render() {
    const host = S.host;
    if (!host || !host.isConnected) return;
    const N = kitData();
    if (!N) { host.innerHTML = "<p>" + K.NA + "</p>"; return; }
    K.hidePop();
    host.innerHTML = K.scoped("nl", () => {
      const parts = K.nordicParts(N, S.zday);
      if (!Array.isArray(parts)) return parts;
      const built = N.prices.built_at ? K.zurich(N.prices.built_at, true) : null, na = N.generation.nuclear_availability || {};
      const blk = (name, fn) => { try { return fn(); } catch (e) { return '<section class="nlb" data-error="' + K.esc(e && e.message) + '">' + head(name, "", "") + "<p>" + K.NA + "</p></section>"; } };
      return '<header class="lp-head nlhead"><div><p class="kicker">Energy · Nordic power</p><p class="lede">What is driving Nordic prices: supply against normal, prices by zone and hour, forwards, reservoirs, nuclear and weather. Hover or tap any figure for its explainer, date and source.</p></div><p class="asof lp-upd">Power files built ' + K.esc(built || "–") + "<br>UMM " + K.esc(K.zurich(na.observed_at, true) || "–") + "</p></header>" +
        blk("Supply balance", () => balanceHTML(N, parts)) + blk("Prices by zone", () => zonesHTML(N, parts)) +
        '<div class="nl2">' + blk("Hourly prices", () => hourlyHTML(N)) + blk("Price against normal", () => priceHistHTML(N)) + "</div>" +
        '<div class="nl2">' + blk("Forward curve", () => fwdHTML(N)) + blk("Reservoirs", () => resHTML(N)) + "</div>" +
        blk("Nuclear", () => nucHTML(N, parts)) + blk("Generation and weather", () => genHTML(N)) + linksHTML() +
        '<p class="fnote">Colour = distance from normal: red where supply is tighter or prices higher than usual, blue where looser or lower. Normals: prices, the 2023–25 average for the same weeks (date ±7 days; 2023 from Nord Pool system prices republished by Energinet); forwards, the same calendar months in 2023–25; nuclear is not compared with a normal: it is shown as the share of installed capacity online, scored by fixed bands; wind, load factor 2015–25 for the same 30 days; hydro output, the same 30 days in earlier years; reservoirs, NVE 2006–25 (Norway) and ENTSO-E 2015–25 (Sweden, Finland); temperature, ERA5 2006–25. Sources: Nord Pool day-ahead and UMM, EEX, ENTSO-E Transparency, NVE, Copernicus ERA5, Energinet. Each figure prints its own date.</p>';
    });
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const r = t.closest("[data-nl-range]");
    if (r) { S.range = r.dataset.nlRange; try { localStorage.setItem("emmiNlRange", S.range); } catch (x) { /* private mode */ } keep(render); return; }
    const z = t.closest("[data-lp-zday]");
    if (z) { if (!z.disabled) { S.zday = z.dataset.lpZday; keep(render); } return; }
    const h = t.closest("[data-nl-hz]");
    if (h) { S.hz = h.dataset.nlHz; keep(render); return; }
    if (K && K.tapPop(e)) return;
  }
  /* re-render without the page jumping */
  function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }
  function mount(host, v2data) {
    K = window.EMMILivePulse && EMMILivePulse.nordicKit;
    if (!host || !K) return;
    S.host = host; if (v2data) S.v2 = v2data;
    if (!host._nlWired) { host._nlWired = true; host.addEventListener("click", onClick); K.wirePop(host); }
    if (S.extra) { render(); return; }
    host.innerHTML = '<p class="asof">Loading the Nordic power files…</p>';
    if (!S.loading) S.loading = loadExtra().then(x => { S.extra = x; }).catch(() => { S.extra = {}; }).finally(() => { S.loading = null; });
    S.loading && S.loading.then(render);
  }
  window.EMMINordicLanding = { mount: mount, balanceHistory: d => { K = K || (window.EMMILivePulse && EMMILivePulse.nordicKit); return balanceHistory(d); }, monthsOf: monthsOf, hourly: (dash, ymd) => { K = K || (window.EMMILivePulse && EMMILivePulse.nordicKit); return hourly(dash, ymd); } };
  const pend = document.getElementById("nlLanding");
  if (pend && !pend.childElementCount && window.MMV2Power && MMV2Power.data) mount(pend, MMV2Power.data());
})();
