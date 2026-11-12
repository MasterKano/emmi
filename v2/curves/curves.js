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

  function chart(el, latest, past, color) {
    const a = sortRows(latest.filter(r => finite(r.settleN)));
    const b = past ? sortRows(past.filter(r => finite(r.settleN))) : [];
    const by = {};
    a.forEach(r => { by[r.contract] = r; });
    const keys = a.map(r => r.contract);
    b.forEach(r => { if (!by[r.contract]) keys.push(r.contract); });
    const order = sortRows(keys.map(k => by[k] || b.find(r => r.contract === k)));
    const n = order.length;
    if (!n) { el.innerHTML = '<p class="na">Not available yet</p>'; return; }
    const w = Math.round(el.clientWidth || 0);
    if (w < 80) return;
    const h = Math.round(Math.max(140, Math.min(220, w * 0.42)));
    const L = 46, R = 12, T = 14, B = 22, W = w, iw = W - L - R, ih = h - T - B;
    const vals = order.flatMap(r => {
      const o = [];
      if (by[r.contract] && finite(by[r.contract].settleN)) o.push(by[r.contract].settleN);
      const p = b.find(x => x.contract === r.contract);
      if (p && finite(p.settleN)) o.push(p.settleN);
      return o;
    });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (!(hi > lo)) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * iw;
    const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
    const path = (pick) => {
      let d = "", pen = false;
      order.forEach((r, i) => {
        const row = pick(r);
        if (!row || !finite(row.settleN)) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(row.settleN).toFixed(1);
        pen = true;
      });
      return d;
    };
    let s = '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="Futures curve">';
    [lo, (lo + hi) / 2, hi].forEach(v => {
      const y = Y(v);
      s += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#252d3c"/>';
      s += '<text x="' + (L - 4) + '" y="' + (y + 3).toFixed(1) + '" fill="#8b95a8" font-size="10" text-anchor="end">' + esc(fmt(v, hi - lo < 5 ? 2 : 1)) + "</text>";
    });
    const pd = path(r => b.find(x => x.contract === r.contract));
    if (pd) s += '<path d="' + pd + '" fill="none" stroke="' + PAST + '" stroke-width="1.6"/>';
    const ld = path(r => by[r.contract]);
    if (ld) s += '<path d="' + ld + '" fill="none" stroke="' + color + '" stroke-width="2.1"/>';
    order.forEach((r, i) => {
      const p = b.find(x => x.contract === r.contract);
      if (p && finite(p.settleN)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.settleN).toFixed(1) + '" r="2.2" fill="' + PAST + '"/>';
      const now = by[r.contract];
      if (now && finite(now.settleN)) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(now.settleN).toFixed(1) + '" r="2.6" fill="' + color + '"/>';
    });
    const step = n > 14 ? Math.ceil(n / 6) : n > 8 ? 2 : 1;
    order.forEach((r, i) => {
      if (i % step && i !== n - 1) return;
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" fill="#8b95a8" font-size="10" text-anchor="middle">' + esc(r.label || r.contract) + "</text>";
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
    el.innerHTML = '<header class="bh"><h2>' + esc(meta.title) + '</h2><p class="asof">as of ' + esc(dlab(meta.latest)) + " · " + esc(meta.unit) + '</p></header><div class="tools"><div class="tenors" role="group" aria-label="Contract type" hidden></div><label>Overlay <select aria-label="Archived date for ' + esc(meta.title) + '"></select></label><button type="button" data-act="copy">Copy</button><button type="button" data-act="csv">CSV</button></div><div class="plot"></div><p class="leg"></p><div class="sheet"></div>';
    app.appendChild(el);
    const sel = el.querySelector("select");
    sel.innerHTML = '<option value="">Latest only</option>' + dates.slice().reverse().map(d => '<option value="' + d + '">' + esc(dlab(d)) + "</option>").join("");
    const state = { latest: null, shown: null, past: null, tenor: "Months" };
    const present = () => {
      const set = new Set();
      (state.latest || []).concat(state.past || []).forEach(r => set.add(tenorOf(r.label)));
      return TENORS.filter(t => set.has(t));
    };
    const pick = rows => {
      const types = present();
      if (types.length < 2) return rows || [];
      if (!types.includes(state.tenor)) state.tenor = types[0];
      return (rows || []).filter(r => tenorOf(r.label) === state.tenor);
    };
    const draw = () => {
      const plot = el.querySelector(".plot");
      const types = present();
      const bar = el.querySelector(".tenors");
      if (types.length > 1) {
        bar.hidden = false;
        bar.innerHTML = types.map(t => '<button type="button" data-tenor="' + t + '"' + (t === state.tenor ? ' class="is-on"' : "") + ">" + t + "</button>").join("");
      } else bar.hidden = true;
      chart(plot, pick(state.latest), state.past ? pick(state.past) : null, color);
      if (!el._ro && typeof ResizeObserver === "function") {
        el._ro = new ResizeObserver(() => chart(plot, pick(state.latest), state.past ? pick(state.past) : null, color));
        el._ro.observe(plot);
      }
      const rows = pick(state.shown || state.latest || []);
      el.querySelector(".sheet").innerHTML = tableHTML(rows, meta.unit, el.dataset.open === "1");
      const bits = ['<span><i class="dot" style="--c:' + color + '"></i>Latest ' + esc(dlab(meta.latest)) + "</span>"];
      if (state.past) bits.push('<span><i class="dot" style="--c:' + PAST + '"></i>' + esc(dlab(state.pastDate)) + "</span>");
      el.querySelector(".leg").innerHTML = bits.join("");
      const note = el.querySelector(".gap");
      if (note) note.remove();
      if (dates.length < 2) el.insertAdjacentHTML("beforeend", '<p class="note gap">Only one archived date, so there is no earlier curve to overlay.</p>');
    };
    const loadDate = async (date, asPast) => {
      const rows = await rowsFor(meta.id, date);
      if (asPast) { state.past = rows; state.pastDate = date; state.shown = rows; }
      else { state.latest = rows; state.shown = rows; state.past = null; }
      draw();
    };
    el.querySelector(".tenors").addEventListener("click", ev => {
      const b = ev.target.closest("[data-tenor]");
      if (!b) return;
      state.tenor = b.getAttribute("data-tenor");
      el.dataset.open = "";
      draw();
    });
    el.addEventListener("click", ev => {
      if (!ev.target.closest("[data-act=more]")) return;
      el.dataset.open = el.dataset.open === "1" ? "" : "1";
      draw();
    });
    sel.addEventListener("change", async () => {
      const date = sel.value;
      if (!date || date === meta.latest) { state.past = null; state.shown = state.latest; draw(); return; }
      try { await loadDate(date, true); }
      catch (e) { el.querySelector(".sheet").insertAdjacentHTML("afterbegin", '<p class="na">That date is not available yet.</p>'); }
    });
    el.querySelector('[data-act="copy"]').addEventListener("click", async (ev) => {
      const rows = state.shown || [];
      try {
        await navigator.clipboard.writeText(tsv(rows));
        ev.target.textContent = "Copied";
        setTimeout(() => { ev.target.textContent = "Copy"; }, 1200);
      } catch (e) { ev.target.textContent = "Copy failed"; }
    });
    el.querySelector('[data-act="csv"]').addEventListener("click", () => {
      const rows = state.shown || [];
      const blob = new Blob([csv(rows)], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = meta.id + "-" + ((rows[0] && rows[0].as_of) || meta.latest) + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    });
    return loadDate(meta.latest, false);
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
    if (!full) host.insertAdjacentHTML("beforeend", '<p class="prev-tab"><a href="parked/curves/">Previous curves page</a></p>');
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
  window.MMV2Curves = { start: start, reload: reload, mount: mountHome, homeOf: homeOf };
  if (document.getElementById("app") && !document.getElementById("tablePage")) start();
})();
