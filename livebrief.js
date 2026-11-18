/* Compact Live Pulse helpers. All figures come from the existing feeds; missing observations stay missing. */
(function (root) {
  "use strict";
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const WATCH = [["BZ=F", "Brent"], ["TTF=F", "TTF"], ["^GSPC", "S&P 500"], ["^STOXX", "STOXX 600"], ["ECO.L", "ECO Atlantic"], ["ORRON.ST", "Orrön Energy"], ["GC=F", "Gold"]];
  let context = {}, modal = null, opener = null;
  function href(value) {
    const s = String(value || "").trim();
    return /^(https?:\/\/|\/(?!\/)|#)/i.test(s) ? s : "";
  }
  function number(v, kind) {
    if (!finite(v)) return "—";
    const a = Math.abs(v), d = kind === "fx" && a < 20 ? 4 : kind === "yield" ? 2 : a >= 1000 ? 1 : a < 1 ? 3 : 2;
    return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function unit(r) {
    return ({ "BZ=F": "$/bbl", "CL=F": "$/bbl", "HO=F": "$/gal", "TTF=F": "€/MWh", "NG=F": "$/MMBtu", "GC=F": "$/oz", "SI=F": "$/oz", "HG=F": "$/lb" })[r.sym] || (r.kind === "yield" ? "%" : r.kind === "index" || r.kind === "fx" ? "" : r.ccy || "");
  }
  function price(r) { return number(r && r.px, r && r.kind) + (r && unit(r) ? " " + unit(r) : ""); }
  function name(r) {
    const known = WATCH.find(x => x[0] === r.sym);
    return known ? known[1] : String(r.name || r.sym).replace(/ (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d\d$/, "");
  }
  function when(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "Time not supplied" : new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(",", "") + " Zurich";
  }
  function quoteMeta(r) {
    const L = root.MMLabels;
    const observed = L ? L.quoteWhen(r).text : r.market_time ? when(r.market_time) : r.bar_date || "Quote time not supplied";
    const state = r.official ? "Official close" : r.partial === false || ["closed", "pre", "post"].includes(r.state) ? "Last close" : r.kind === "fx" ? "Indicative" : "Delayed quote";
    const contract = r.contract && r.contract.month;
    return [state, observed, contract, r.stale ? "Retained observation" : ""].filter(Boolean).join(" · ");
  }
  function change(v, bp) { return finite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + (bp ? " bp" : "%") : "—"; }
  function watchMeta(r) {
    const date = r.market_time ? new Date(r.market_time) : null, today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(new Date());
    const currentDay = date && !isNaN(date) ? new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(date) : null;
    const closed = r.official || r.partial === false || ['closed','pre','post'].includes(r.state);
    const observation = date && !isNaN(date) ? new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',...(currentDay===today&&!closed?{hour:'2-digit',minute:'2-digit',hour12:false}:{day:'numeric',month:'short',year:date.getFullYear()===new Date().getFullYear()?undefined:'numeric'})}).format(date) : r.bar_date || 'Time unavailable';
    return [observation,closed?'last close':r.kind==='fx'?'indicative':'delayed',r.contract&&r.contract.month,r.stale?'retained':''].filter(Boolean).join(' · ');
  }
  function attrs(r) { return ' data-lp-quote="' + esc(r.sym) + '"'; }
  function watchHTML(by) {
    return '<section class="block lp-watch" id="lpWatch"><header class="bh"><h2>Your markets</h2><a href="#markets">All markets →</a></header><div class="watch-grid">' + WATCH.map(([sym, title]) => {
      const r = by[sym];
      if (!r) return '<div class="watch-item"><span class="watch-name">' + esc(title) + '</span><span class="na">Not available yet</span></div>';
      const v = r.pct && r.pct["1D"];
      return '<button type="button" class="watch-item"' + attrs(r) + ' aria-label="' + esc(title + ', ' + price(r) + ', ' + quoteMeta(r)) + '"><span class="watch-id"><b>' + esc(title) + '</b><strong>' + esc(price(r)) + '</strong></span><span class="watch-move ' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + change(v) + '<span class="watch-arrow">↗</span></span><span class="qmeta">' + esc(watchMeta(r)) + '</span></button>';
    }).join("") + "</div></section>";
  }
  function addDays(day, n) { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function bounds(ev) {
    const label = ev.date_window_text || ev.date_label || "";
    let start = ev.window_start || ev.anchor || ev.date || ev.sort_date || "", end = ev.window_end || start;
    const q = /Q([1-4])\s*(20\d\d)/i.exec(label), half = /H([12])\s*(20\d\d)/i.exec(label);
    const month = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d\d)$/i.exec(label);
    const year = /^(20\d\d)$/.exec(label);
    if (q || half || month || year) {
      const m = q ? (+q[1] - 1) * 3 : half ? (+half[1] - 1) * 6 : month ? "jan feb mar apr may jun jul aug sep oct nov dec".split(" ").indexOf(month[1].slice(0, 3).toLowerCase()) : 0;
      const y = +(q ? q[2] : half ? half[2] : month ? month[2] : year[1]), span = q ? 3 : half ? 6 : month ? 1 : 12;
      start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); end = new Date(Date.UTC(y, m + span, 0)).toISOString().slice(0, 10);
    }
    return { start: String(start).slice(0, 10), end: String(end).slice(0, 10) };
  }
  function upcoming(data, research, macro, today) {
    const rows = (data && data.events || []).concat(research && research.items || [], macro && macro.events || []);
    const seen = new Set(), end = addDays(today, 28);
    return rows.map(e => {
      const b = bounds(e), source = href(e.source_url || e.source), company = e.company_name || e.company || "Macro";
      const confirmed = e.confidence === "confirmed" && e.precision === "day" || e.date_basis === "confirmed" && e.precision === "exact" && !e.sort_date_is_proxy && !e.approx;
      return { id: e.id, company, title: e.title || e.headline || "Event", source, start: b.start, end: b.end, confirmed,
        date: confirmed ? e.date || e.anchor || e.sort_date : null, label: e.date_window_text || e.date_label || b.start,
        time: e.time, timezone: e.timezone, group: e.group || e.category || "", checked: e.last_checked || null };
    }).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.start) && e.end >= today && e.start <= end && e.source)
      .sort((a, b) => (a.start < today ? today : a.start).localeCompare(b.start < today ? today : b.start) || Number(b.confirmed) - Number(a.confirmed) || a.company.localeCompare(b.company))
      .filter(e => { const key = e.company.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + e.title.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + e.start; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  function calendarHTML(data, research, macro, today) {
    const rows = upcoming(data, research, macro, today), nextMonday = addDays(today, (8 - (new Date(today + "T12:00:00Z").getUTCDay() || 7)) % 7 || 7);
    const groups = [["Today", e => e.confirmed && e.date === today], ["This week", e => e.confirmed && e.date > today && e.date < nextMonday], ["Next week", e => e.confirmed && e.date >= nextMonday && e.date < addDays(nextMonday, 7)], ["Coming weeks / guidance", e => !e.confirmed || e.date >= addDays(nextMonday, 7)]];
    return '<section class="block lp-coming" id="lpComing"><header class="bh"><h2>Coming up</h2><span class="bh-r"><a href="#events">Company calendar →</a><a href="research/#coming">Research →</a></span></header><div class="coming-grid">' + groups.map(([label, pred]) => {
      const priority = e => (e.group === 'macro' ? 4 : 0) + (/Orr[oö]n|Cloudberry|Eco Atlantic|Lundin|ShaMaran|International Petroleum|Lucara|NGEx/i.test(e.company) ? 2 : 0) + (e.confirmed ? 1 : 0);
      const list = rows.filter(pred).sort((a,b)=>priority(b)-priority(a)||a.start.localeCompare(b.start)).slice(0, 2).sort((a,b)=>a.start.localeCompare(b.start));
      return '<div><h3>' + label + '</h3>' + (list.length ? list.map(e => {
        let time = "";
        if (e.confirmed && e.time && e.timezone) { try { const t = new Date(e.date + "T" + e.time + (e.timezone === "UTC" ? "Z" : "")); if (e.timezone === "UTC" && !isNaN(t)) time = " · " + when(t); } catch (err) {} }
        return '<a class="coming-item" href="' + esc(e.source) + '" target="_blank" rel="noopener noreferrer"><strong>' + esc(e.company) + '</strong><span>' + esc(e.title) + ' ↗</span><small>' + esc((e.confirmed ? "Confirmed · " : "Guidance · ") + e.label + time) + '</small></a>';
      }).join("") : '<p class="fnote">No sourced date in this window</p>') + '</div>';
    }).join("") + '</div><p class="fnote">Calendar checked ' + esc(data && data.as_of ? when(data.as_of) : "time not supplied") + ' · Research ' + esc(research && research.as_of || "unavailable") + ' · Macro checks ' + esc(macro && macro.fetched_at_utc ? when(macro.fetched_at_utc) : "unavailable") + (macro && Object.values(macro.sources || {}).some(s=>s.status!=='ok') ? ' · Some macro sources unavailable / retained' : '') + '</p></section>';
  }
  function routes(r) {
    if (r.kind === "equity") return [['Company research', '#co=' + encodeURIComponent(r.sym)], ['Catalysts', 'research/#coming']];
    if (r.sym === "TTF=F") return [['Storage, weather and supply', '#energy/gas'], ['TTF curve', 'v2/curves/#ttf']];
    if (["BZ=F", "CL=F", "HO=F"].includes(r.sym)) return [['Oil fundamentals', '#energy/oil'], ['Full curve', 'v2/curves/#' + ({"BZ=F":"brent","CL=F":"wti","HO=F":"ho"})[r.sym]]];
    return [['Markets and comparisons', '#markets']];
  }
  function primer(r) {
    if (r.kind === "yield") return "A yield is an annual percentage. A one-basis-point change is 0.01 percentage points; yield changes are shown in bp, not percentage returns.";
    if (r.kind === "equity") return "Price moves are price returns, excluding dividends. Cash, commitments and funding belong beside the next catalyst; a guidance window is not a confirmed date.";
    if (r.kind === "future") return "A futures price is for a specific delivery contract. Compare the same month across dates. Backwardation means near contracts cost more than later ones; contango means the reverse. A curve is pricing, not a guaranteed forecast.";
    if (r.kind === "fx") return "The quote is units of the second currency for one unit of the first. A higher EUR/USD means a stronger euro against the dollar.";
    if (r.sym === "^VIX") return "VIX reflects option-implied S&P 500 volatility. It measures expected movement, not the direction of the next move or a forecast of a crash.";
    return "An index summarises its constituent markets. Compare its daily move with breadth and other markets; a price move alone does not identify its cause.";
  }
  function ensureModal() {
    if (modal && modal.isConnected) return modal;
    modal = document.createElement("dialog"); modal.className = "lp-detail"; modal.setAttribute("aria-labelledby", "lpDetailTitle");
    document.body.appendChild(modal);
    modal.addEventListener("close", () => { if (opener && opener.isConnected) opener.focus(); });
    modal.addEventListener("click", e => { if (e.target.closest("[data-lp-close]")) modal.close(); else if (e.target.closest("a[href^='#']")) modal.close(); });
    return modal;
  }
  function show(title, html, trigger) {
    const d = ensureModal(); opener = trigger || document.activeElement;
    d.innerHTML = '<header><h2 id="lpDetailTitle">' + esc(title) + '</h2><button type="button" data-lp-close aria-label="Close detail">×</button></header>' + html;
    if (!d.open) d.showModal();
  }
  function detail(sym, trigger) {
    const r = context.by && context.by[sym]; if (!r) return;
    const L = root.MMLabels, source = href(r.official && r.official.url) || (sym.startsWith("CNBC:") ? href(r.live && r.live.url) : "https://finance.yahoo.com/quote/" + encodeURIComponent(r.contract && r.contract.sym || sym) + "/");
    const candles = root.MMCandles && root.MMCandles.svg(r, root.MMCandles.scale(), {h: 130});
    const historical = (r.spark || []).filter(finite), trend = !candles && historical.length > 1 ? '<p class="detail-data">1-year observed close range: ' + esc(number(Math.min(...historical), r.kind)) + '–' + esc(number(Math.max(...historical), r.kind)) + ' ' + esc(unit(r)) + '</p>' : '';
    show(name(r), '<strong class="detail-price">' + esc(price(r)) + '</strong><p class="detail-meta">' + esc(quoteMeta(r)) + '</p>' + (candles || trend) + '<nav class="detail-links">' + routes(r).map(([label,url]) => '<a href="' + esc(url) + '">' + esc(label) + ' →</a>').join('') + '</nav><details><summary>How to read this</summary><p>' + esc(primer(r)) + '</p></details><details><summary>Source and observation</summary><p>' + esc(r.official && r.official.name || r.src || "Quote feed") + ' · ' + esc(L ? L.tileMeta(r) : quoteMeta(r)) + '</p><a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Original quote / source ↗</a></details><button type="button" class="detail-chart" data-lp-fullchart="' + esc(sym) + '">Open full price chart →</button>', trigger);
  }
  function info(id, trigger) {
    if (id === "breadth") {
      const indices = ['^GSPC','^IXIC','^DJI','^STOXX','^STOXX50E','^GDAXI','^FTSE','^SSMI','OSEBX.OL','^OMX','^OMXC25','^OMXH25','^N225','^HSI'];
      const rows = indices.map(s=>(context.by||{})[s]).filter(r => r && finite(r.pct && r.pct["1D"]));
      show("Index breadth", '<p>Share of the covered equity indices up on the day. Sessions can differ; closed markets retain their last close.</p><div class="detail-links">' + rows.map(r => '<button type="button"' + attrs(r) + '>' + esc(name(r)) + ' · ' + esc(price(r)) + ' · ' + change(r.pct["1D"]) + ' ↗</button>').join('') + '</div>', trigger);
    } else if (id === "cugold") show("Copper / gold", '<p>The relative move compares the same-day percentage changes in copper and gold. Different contract units make the raw price ratio scale-dependent.</p><div class="detail-links">' + ["HG=F", "GC=F"].map(sym => context.by && context.by[sym] ? '<button type="button" data-lp-quote="' + sym + '">' + esc(name(context.by[sym])) + ' · ' + esc(price(context.by[sym])) + ' ↗</button>' : '').join('') + '</div>', trigger);
  }
  function setContext(value) { context = value || {}; }
  root.EMMIBrief = { WATCH, attrs, price, name, quoteMeta, number, when, href, watchHTML, bounds, upcoming, calendarHTML, setContext, detail, info };
  if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest("[data-lp-quote],[data-lp-info-detail],[data-lp-fullchart]"); if (!el) return;
    e.preventDefault();
    if (el.hasAttribute("data-lp-quote")) detail(el.getAttribute("data-lp-quote"), el);
    else if (el.hasAttribute("data-lp-info-detail")) info(el.getAttribute("data-lp-info-detail"), el);
    else { const r = context.by && context.by[el.getAttribute("data-lp-fullchart")]; if (r && root.MMTable) { modal.close(); root.MMTable.openChart(r); } }
  });
})(window);
