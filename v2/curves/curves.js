/* Futures curves preview. Reads only MasterKano/emmi-data curves/ on main.
   A blank change is "not available yet", never zero. */
(function () {
  "use strict";
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/curves/";
  const ORDER = ["nordic-sys", "brent", "ho", "ttf"];
  const COLOR = { "nordic-sys": "#e8c56b", brent: "#f0b429", ho: "#fb923c", ttf: "#5bc0eb" };
  const PAST = "#8b95a8";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function num(s) {
    if (s == null || String(s).trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function fmt(v, d) {
    if (!finite(v)) return null;
    return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
  }
  function round2(raw) {
    if (raw == null || String(raw).trim() === "") return "";
    const s = String(raw).trim();
    const neg = s.startsWith("-");
    const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
    const frac = (f + "000").slice(0, 3);
    let n = Number(w) * 100 + Number(frac[0]) * 10 + Number(frac[1]);
    if (Number(frac[2]) >= 5) n += 1;
    return (neg ? "-" : "") + Math.floor(n / 100) + "." + String(n % 100).padStart(2, "0");
  }
  function chgText(raw) {
    const s = round2(raw);
    if (!s) return null;
    if (s === "0.00" || s === "-0.00") return "0.00";
    return (s.startsWith("-") ? "−" : "+") + s.replace("-", "");
  }
  const TENORS = ["Months", "Quarters", "Seasons", "Years"];
  function tenorOf(label) {
    const s = String(label || "");
    if (/^Q\d/.test(s)) return "Quarters";
    if (/^(Winter|Summer)/.test(s)) return "Seasons";
    if (/^Cal-/.test(s)) return "Years";
    return "Months";
  }
  function dlab(iso) {
    if (!iso || iso.length < 10) return iso || "";
    return (+iso.slice(8, 10)) + " " + MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
  }
  function rank(label) {
    if (/^Q\d/.test(label)) return 1;
    if (/^(Winter|Summer)/.test(label)) return 2;
    if (/^Cal-/.test(label)) return 3;
    return 0;
  }
  function sortRows(rows) {
    return rows.slice().sort((a, b) => {
      const e = String(a.expiry || "").localeCompare(String(b.expiry || ""));
      if (e) return e;
      const r = rank(a.label) - rank(b.label);
      return r || String(a.label).localeCompare(String(b.label));
    });
  }
  function parseCSV(text) {
    const lines = String(text).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    if (!lines.length) return [];
    const head = lines[0].split(",").map(s => s.trim());
    return lines.slice(1).filter(Boolean).map(line => {
      const c = line.split(",");
      const o = {};
      head.forEach((h, i) => { o[h] = c[i] == null ? "" : c[i].trim(); });
      o.settleN = num(o.settle);
      o.changeN = num(o.change);
      return o;
    }).filter(r => r.contract);
  }
  async function getText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.text();
  }
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  const COMPARE = ["#8b95a8", "#7aa2ff"];
  function addDays(iso, n) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function addMonths(iso, n) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(d, dim));
    return dt.toISOString().slice(0, 10);
  }
  function onOrBefore(sorted, target) {
    let best = null;
    (sorted || []).forEach(d => { if (d <= target && (!best || d > best)) best = d; });
    return best;
  }
  /* Default curves: latest, the previous archived session (calendar yesterday when that file exists), and one month earlier. */
  function pickDefaults(dates, latest) {
    const sorted = (dates || []).slice().filter(Boolean).sort();
    const current = latest && sorted.indexOf(latest) >= 0 ? latest : (sorted[sorted.length - 1] || null);
    if (!current) return { current: null, yesterday: null, month: null, yesterdayTarget: null, monthTarget: null };
    const yesterdayTarget = addDays(current, -1);
    const monthTarget = addMonths(current, -1);
    const before = sorted.filter(d => d < current);
    const yesterday = sorted.indexOf(yesterdayTarget) >= 0 ? yesterdayTarget : (before.length ? before[before.length - 1] : null);
    const month = sorted.indexOf(monthTarget) >= 0 ? monthTarget : onOrBefore(before, monthTarget);
    return {
      current: current,
      yesterday: yesterday,
      month: month,
      yesterdayTarget: yesterdayTarget,
      monthTarget: monthTarget,
      yesterdayExact: yesterday === yesterdayTarget,
      monthExact: month === monthTarget
    };
  }
  /* Shared chart system (v2/shared/charts.js) when the page loads it; the plain drawing below stays as the fallback. */
  function chartEC(el, packs, order, unit) {
    const EC = window.EMMICharts;
    const series = packs.map(p => ({
      name: p.name || "", color: p.color, width: p.width, dash: p.dash, faint: p.faint, area: p.area,
      vals: order.map(r => { const row = p.map[r.contract]; return row && finite(row.settleN) ? row.settleN : null; })
    }));
    const front = series[0] && series[0].vals.find(finite);
    const mk = [];
    for (let i = 0; i < Math.min(6, order.length); i++) if (tenorOf(order[i].label) === "Months") mk.push(i);
    const lab = order.map(r => r.label || r.contract);
    const step = order.length > 16 ? Math.ceil(order.length / 7) : order.length > 8 ? 2 : 1;
    EC.lines(el, {
      h: Math.round(Math.max(190, Math.min(280, (el.clientWidth || 600) * 0.4))),
      d: 2, series: series, labels: lab, markers: mk, last: false, baseline: front, nt: 5,
      refs: finite(front) ? [{ y: front, label: "Front " + fmt(front, 2), color: "var(--faint)" }] : [],
      ticks: lab.map((t, i) => (i % step === 0 || i === order.length - 1) ? t : null),
      unit: unit || "", aria: "Futures curve"
    });
  }
  function chart(el, series, unit) {
    const packs = (series || []).map(s => {
      const map = {};
      sortRows((s.rows || []).filter(r => finite(r.settleN))).forEach(r => { map[r.contract] = r; });
      return { map: map, color: s.color, dash: s.dash || "", width: s.width || 1.8, name: s.name, faint: s.faint, area: s.area };
    }).filter(s => Object.keys(s.map).length);
    const seen = {};
    const keys = [];
    packs.forEach(p => Object.keys(p.map).forEach(k => { if (!seen[k]) { seen[k] = p.map[k]; keys.push(k); } }));
    const order = byTenor(keys.map(k => seen[k]));
    const n = order.length;
    if (!n) { el.innerHTML = '<p class="na">Not available yet</p>'; return; }
    if (window.EMMICharts) { chartEC(el, packs, order, unit); return; }
    const w = Math.round(el.clientWidth || 0);
    if (w < 80) return;
    const h = Math.round(Math.max(150, Math.min(240, w * 0.42)));
    const L = 52, R = 12, T = 16, B = 28, W = w, iw = W - L - R, ih = h - T - B;
    const vals = [];
    order.forEach(r => packs.forEach(p => { const row = p.map[r.contract]; if (row && finite(row.settleN)) vals.push(row.settleN); }));
    if (!vals.length) { el.innerHTML = '<p class="na">Not available yet</p>'; return; }
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (!(hi > lo)) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * iw;
    const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
    let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="Futures curve">';
    [lo, (lo + hi) / 2, hi].forEach(v => {
      const y = Y(v);
      s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)"/>';
      s += '<text x="' + (L - 6) + '" y="' + (y + 4).toFixed(1) + '" fill="var(--faint)" font-size="12" text-anchor="end">' + esc(fmt(v, hi - lo < 5 ? 2 : 1)) + "</text>";
    });
    packs.forEach(p => {
      let d = "", pen = false;
      order.forEach((r, i) => {
        const row = p.map[r.contract];
        if (!row || !finite(row.settleN)) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(row.settleN).toFixed(1);
        pen = true;
      });
      if (d) s += '<path d="' + d + '" fill="none" stroke="' + p.color + '" stroke-width="' + p.width + '"' + (p.dash ? ' stroke-dasharray="' + p.dash + '"' : "") + "/>";
      order.forEach((r, i) => {
        const row = p.map[r.contract];
        if (row && finite(row.settleN)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(row.settleN).toFixed(1) + '" r="2.4" fill="' + p.color + '"/>';
      });
    });
    const step = n > 16 ? Math.ceil(n / 7) : n > 8 ? 2 : 1;
    order.forEach((r, i) => {
      if (i % step && i !== n - 1) return;
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 8) + '" fill="var(--faint)" font-size="12" text-anchor="middle">' + esc(r.label || r.contract) + "</text>";
    });
    s += "</svg>";
    el.innerHTML = s;
  }

  const STRIP = 4;
  function tableHTML(rows, unit, expanded) {
    const sorted = sortRows(rows);
    const open = !!expanded || sorted.length <= STRIP;
    const shown = open ? sorted : sorted.slice(0, STRIP);
    const rest = sorted.length - shown.length;
    const body = shown.map(r => {
      const ch = r.changeN;
      const cls = finite(ch) ? (ch > 0 ? "up" : ch < 0 ? "dn" : "") : "";
      return "<tr><td>" + esc(r.label || r.contract) + "</td><td>" + (fmt(r.settleN, unit.indexOf("gal") >= 0 ? 4 : 2) || '<span class="na">–</span>') + "</td><td class=\"" + cls + "\">" + (r.change === "" ? '<span class="na">–</span>' : chgText(r.change)) + "</td></tr>";
    }).join("");
    const btn = rest > 0
      ? '<button type="button" class="curve-more" data-act="more">Show the rest (' + rest + ")</button>"
      : (sorted.length > STRIP ? '<button type="button" class="curve-more" data-act="more">Front months only</button>' : "");
    return "<table><thead><tr><th>Contract</th><th>Price</th><th>Change</th></tr></thead><tbody>" + body + "</tbody></table>" + btn;
  }
  function byTenor(rows) {
    return (rows || []).slice().sort((a, b) => {
      const t = TENORS.indexOf(tenorOf(a.label)) - TENORS.indexOf(tenorOf(b.label));
      if (t) return t;
      return sortRows([a, b])[0] === a ? -1 : 1;
    });
  }
  function tsv(rows) {
    const lines = ["type\tcontract\tprice\tchange"];
    byTenor(rows).forEach(r => lines.push([tenorOf(r.label), r.label || r.contract, r.settle === "" ? "" : r.settle, round2(r.change)].join("\t")));
    return lines.join("\n");
  }
  function csv(rows) {
    const head = ["type", "contract", "label", "expiry", "settle", "change", "currency", "unit", "source", "as_of"];
    const lines = [head.join(",")];
    byTenor(rows).forEach(r => lines.push(head.map(k => k === "type" ? tenorOf(r.label) : k === "change" ? round2(r.change) : (r[k] == null ? "" : r[k])).join(",")));
    return lines.join("\n");
  }

  function mount(meta, dates, host, token) {
    const app = host || document.getElementById("v2curves") || document.getElementById("app");
    if (!app) return Promise.resolve();
    if (token != null && app._cv !== token) return Promise.resolve();
    const el = document.createElement("section");
    el.className = "cv-block";
    el.id = meta.id;
    const color = COLOR[meta.id] || "#e8c56b";
    const sorted = (dates || []).slice().filter(Boolean).sort();
    const first = sorted[0] || "";
    const last = sorted[sorted.length - 1] || meta.latest || "";
    const def = pickDefaults(sorted, meta.latest || last);
    el.innerHTML = '<header class="bh"><h2>' + esc(meta.title) + '</h2><p class="asof">as of ' + esc(dlab(def.current || meta.latest)) + " · " + esc(meta.unit) + '</p></header>' +
      '<div class="tools"><div class="tenors" role="group" aria-label="Contract type"></div>' +
      '<button type="button" data-act="copy">Copy</button><button type="button" data-act="csv">CSV</button></div>' +
      '<div class="cv-dates">' +
      '<label>Current <input type="date" data-slot="0" min="' + esc(first) + '" max="' + esc(last) + '" value="' + esc(def.current || "") + '" aria-label="Current curve date for ' + esc(meta.title) + '"></label>' +
      '<label>Yesterday <input type="date" data-slot="1" min="' + esc(first) + '" max="' + esc(last) + '" value="' + esc(def.yesterday || def.yesterdayTarget || "") + '" aria-label="Yesterday curve date for ' + esc(meta.title) + '"></label>' +
      '<label>1 month earlier <input type="date" data-slot="2" min="' + esc(first) + '" max="' + esc(last) + '" value="' + esc(def.month || def.monthTarget || "") + '" aria-label="One month earlier curve date for ' + esc(meta.title) + '"></label>' +
      "</div>" +
      '<div class="plot"></div><p class="leg"></p><div class="cv-miss"></div><div class="sheet"></div>';
    app.appendChild(el);
    const state = {
      tenor: "Months",
      together: false,
      slots: [
        { role: "Current", date: def.current, rows: null, missing: false },
        { role: "Yesterday", date: def.yesterday, rows: null, missing: !def.yesterday, asked: def.yesterdayTarget,
          note: def.yesterday && !def.yesterdayExact ? "No curve archived for " + dlab(def.yesterdayTarget) + ". Showing " + dlab(def.yesterday) + ", the previous archived session." : "" },
        { role: "1 month earlier", date: def.month, rows: null, missing: !def.month, asked: def.monthTarget,
          note: def.month && !def.monthExact ? "No curve archived for " + dlab(def.monthTarget) + ". Showing " + dlab(def.month) + ", the closest earlier archived session." : "" }
      ]
    };
    const allRows = () => state.slots.reduce((acc, slot) => acc.concat(slot.rows || []), []);
    const present = () => {
      const set = new Set();
      allRows().forEach(r => set.add(tenorOf(r.label)));
      return TENORS.filter(t => set.has(t));
    };
    const pick = rows => {
      if (!rows) return [];
      if (state.together) return rows.filter(r => tenorOf(r.label) === "Months" || tenorOf(r.label) === "Quarters" || tenorOf(r.label) === "Years" || tenorOf(r.label) === "Seasons");
      const types = present();
      if (types.length < 2) return rows;
      if (types.indexOf(state.tenor) < 0) state.tenor = types[0];
      return rows.filter(r => tenorOf(r.label) === state.tenor);
    };
    const slotColor = i => i === 0 ? color : window.EMMICharts ? "var(--muted)" : (COMPARE[i - 1] || PAST);
    const draw = () => {
      const plot = el.querySelector(".plot");
      const types = present();
      const bar = el.querySelector(".tenors");
      const buttons = types.length > 1 ? types.slice() : [];
      if (buttons.length) buttons.push("Together");
      bar.hidden = buttons.length < 2;
      bar.innerHTML = buttons.map(t => {
        const on = t === "Together" ? state.together : (!state.together && t === state.tenor);
        return '<button type="button" data-tenor="' + t + '"' + (on ? ' class="is-on"' : "") + ">" + t + "</button>";
      }).join("");
      const EC = !!window.EMMICharts;
      const drawn = state.slots.map((slot, i) => ({
        rows: slot.rows && !slot.missing ? pick(slot.rows) : [],
        name: slot.role + (slot.date ? " " + dlab(slot.date) : ""),
        color: slotColor(i),
        width: EC ? (i === 0 ? 2.4 : i === 1 ? 1.6 : 1.3) : (i === 0 ? 2.2 : 1.7),
        dash: EC ? (i === 1 ? "5 4" : "") : (i === 2 ? "6 4" : ""),
        faint: EC && i === 2,
        area: EC && i === 0
      }));
      const paint = () => chart(el.querySelector(".plot"), drawn, meta.unit);
      paint();
      el._paint = paint;
      if (!EC && !el._ro && typeof ResizeObserver === "function") {
        el._ro = new ResizeObserver(() => { if (el._paint) el._paint(); });
        el._ro.observe(plot);
      }
      const rows = pick((state.slots[0].rows) || []);
      el.querySelector(".sheet").innerHTML = tableHTML(rows, meta.unit, el.dataset.open === "1");
      const bits = state.slots.map((slot, i) => {
        if (!slot.date && !slot.asked) return "";
        const when = slot.missing ? (slot.asked || slot.date) : slot.date;
        const label = slot.role + " · " + (dlab(when) || "date not available");
        const mark = window.EMMICharts ? (i === 1 ? "dash" : i === 2 ? "faint" : "dot") : (i === 2 ? "dash" : "dot");
        return '<span><i class="' + mark + '" style="--c:' + slotColor(i) + '"></i>' + esc(label) + "</span>";
      }).filter(Boolean);
      el.querySelector(".leg").innerHTML = bits.join("");
      const miss = state.slots.map(slot => {
        if (slot.note) return slot.note;
        if (slot.missing && (slot.asked || slot.date)) return "No curve archived for " + dlab(slot.asked || slot.date) + " (" + slot.role.toLowerCase() + ").";
        return "";
      }).filter(Boolean);
      el.querySelector(".cv-miss").innerHTML = miss.length ? '<p class="na">' + esc(miss.join(" ")) + "</p>" : "";
    };
    const loadSlot = async (i, date) => {
      const slot = state.slots[i];
      slot.note = "";
      slot.asked = date;
      if (!date || sorted.indexOf(date) < 0) {
        slot.date = date || null;
        slot.rows = null;
        slot.missing = true;
        draw();
        return;
      }
      try {
        slot.rows = await rowsFor(meta.id, date);
        slot.date = date;
        slot.missing = !slot.rows || !slot.rows.length;
      } catch (e) {
        slot.date = date;
        slot.rows = null;
        slot.missing = true;
      }
      draw();
    };
    el.querySelector(".tenors").addEventListener("click", ev => {
      const b = ev.target.closest("[data-tenor]");
      if (!b) return;
      const t = b.getAttribute("data-tenor");
      if (t === "Together") state.together = true;
      else { state.together = false; state.tenor = t; }
      el.dataset.open = "";
      draw();
    });
    el.addEventListener("click", ev => {
      if (!ev.target.closest("[data-act=more]")) return;
      el.dataset.open = el.dataset.open === "1" ? "" : "1";
      draw();
    });
    el.querySelectorAll(".cv-dates input").forEach(input => {
      input.addEventListener("change", () => loadSlot(+input.getAttribute("data-slot"), input.value));
    });
    el.querySelector('[data-act="copy"]').addEventListener("click", async (ev) => {
      const rows = pick(state.slots[0].rows || []);
      try {
        await navigator.clipboard.writeText(tsv(rows));
        ev.target.textContent = "Copied";
        setTimeout(() => { ev.target.textContent = "Copy"; }, 1200);
      } catch (e) { ev.target.textContent = "Copy failed"; }
    });
    el.querySelector('[data-act="csv"]').addEventListener("click", () => {
      const rows = pick(state.slots[0].rows || []);
      const blob = new Blob([csv(rows)], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = meta.id + "-" + ((rows[0] && rows[0].as_of) || meta.latest || "curve") + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    });
    return Promise.all(state.slots.map((slot, i) => slot.date ? loadSlot(i, slot.date) : Promise.resolve())).then(() => draw());
  }

  const csvCache = new Map();
  async function rowsFor(id, date) {
    const k = id + "/" + date;
    if (!csvCache.has(k)) csvCache.set(k, parseCSV(await getText(BASE + id + "/" + date + ".csv")));
    return csvCache.get(k);
  }
  let indexP = null;
  function loadIndex() {
    if (!indexP) indexP = getJSON(BASE + "index.json?t=" + Math.floor(Date.now() / 36e5)).catch(e => { indexP = null; throw e; });
    return indexP;
  }
  const HOME = { "nordic-sys": "power", brent: "oil", ho: "oil", ttf: "gas" };
  function homeOf(id, meta) {
    if (HOME[id]) return HOME[id];
    const t = (id + " " + ((meta && meta.title) || "")).toLowerCase();
    if (/gold|copper|silver|platinum|zinc|alumini|nickel|metal/.test(t)) return "metal";
    if (/brent|wti|ulsd|heating|gasoil|crude/.test(t)) return "oil";
    if (/ttf|nbp|henry|jkm/.test(t) || (/\bgas\b/.test(t) && !/gasoil/.test(t))) return "gas";
    if (/nordic|power|electric/.test(t)) return "power";
    return "other";
  }
  function orderedIds(curves, pred) {
    return Object.keys(curves).filter(id => pred(id, curves[id])).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }
  async function paint(host, ids, index, full, token) {
    if (!host.isConnected || (token != null && host._cv !== token)) return 0;
    const curves = index.curves || {};
    host.classList.add("cv");
    host.hidden = false;
    host.innerHTML = "";
    if (!ids.length) { host.hidden = true; return 0; }
    if (!full) host.dataset.embedded = "1";
    for (const id of ids) {
      if (!host.isConnected || (token != null && host._cv !== token)) return 0;
      const meta = curves[id];
      if (!meta) continue;
      const detail = await getJSON(BASE + id + "/index.json?t=" + Math.floor(Date.now() / 36e5));
      if (!host.isConnected || (token != null && host._cv !== token)) return 0;
      await mount(Object.assign({ id: id }, meta, { dates: detail.dates || [] }), detail.dates || [], host, token);
    }
    if (host.isConnected && (token == null || host._cv === token)) host.insertAdjacentHTML("beforeend", '<p class="cv-src">Futures curves: <a href="https://github.com/MasterKano/emmi-data/tree/main/curves">MasterKano/emmi-data, curves</a>. A blank is “not available yet”, never zero. Change is versus the previous archived session of the same contract.</p>');
    return ids.length;
  }
  async function main() {
    const line = document.getElementById("v2curvesBuild") || document.getElementById("buildLine");
    const index = await loadIndex();
    const curves = index.curves || {};
    if (line) line.textContent = "Archive built " + (index.generated || "").replace("T", " ").slice(0, 16) + " UTC";
    const box = rootEl();
    if (!box) return;
    const ids = orderedIds(curves, () => true);
    if (!ids.length) { box.innerHTML = '<p class="na">Not available yet</p>'; return; }
    await paint(box, ids, index, true);
  }
  function rootEl() { return document.getElementById("v2curves") || document.getElementById("app"); }
  let starting = null, ready = false;
  function fail(e) {
    const box = rootEl();
    if (box) box.innerHTML = '<p class="na">' + esc(e && e.message ? e.message : "The curve archive is not available yet.") + "</p>";
  }
  function start() {
    if (ready && rootEl() && rootEl().querySelector(".cv-block")) return starting;
    if (starting) return starting;
    const box = rootEl();
    if (!box) return;
    box.innerHTML = "";
    starting = main().then(() => { ready = true; }).catch(fail).finally(() => { starting = null; });
    return starting;
  }
  function reload() { ready = false; csvCache.clear(); indexP = null; return start(); }
  async function mountHome(host, home) {
    if (!host) return 0;
    const token = (host._cv = (host._cv || 0) + 1);
    host.hidden = false;
    host.innerHTML = home === "oil" || home === "power" || home === "gas" ? '<p class="cv-wait">Loading the curve…</p>' : "";
    try {
      const index = await loadIndex();
      if (host._cv !== token || !host.isConnected) return 0;
      const ids = orderedIds(index.curves || {}, (id, meta) => homeOf(id, meta) === home);
      if (!ids.length) { host.innerHTML = ""; host.hidden = true; return 0; }
      return await paint(host, ids, index, false, token);
    } catch (e) {
      if (host._cv === token && host.isConnected) host.innerHTML = '<p class="na">' + esc(e && e.message ? e.message : "The curve archive is not available yet.") + "</p>";
      return 0;
    }
  }
  window.MMV2Curves = { start: start, reload: reload, mount: mountHome, homeOf: homeOf, pickDefaults: pickDefaults, addDays: addDays, addMonths: addMonths };
  if (document.getElementById("app") && !document.getElementById("tablePage")) start();
})();
