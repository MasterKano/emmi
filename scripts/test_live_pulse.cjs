/* Live Pulse (#live, the landing tab since 19 Nov 2026; #briefs/live redirects): risk gauge uses only live inputs and lists the rest; contributions add up;
   day-ahead reads mr.json by date; routing and the archive stay in place. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { window: {}, document: { addEventListener() {} }, Intl, Date, Math, JSON, localStorage: { getItem: () => null, setItem() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/shared/kit.js"), "utf8"), ctx);   /* shared kit first, as in index.html */
vm.runInNewContext(fs.readFileSync(path.join(root, "livepulse.js"), "utf8"), ctx);
const L = ctx.window.EMMILivePulse;
const row = (sym, kind, px, d1, extra) => Object.assign({ sym, name: sym, kind, px, pct: { "1D": d1, "1W": d1, "1M": d1 } }, extra || {});
const market = { groups: [{ id: "indices", sections: [{ rows: [
  row("^GSPC", "index", 7600, 1, { ma: { "200": { pct: 2.5 } } }), row("^STOXX", "index", 660, 0.5, { ma: { "200": { pct: 5 } } }),
  row("^GDAXI", "index", 1, -0.2), row("^FTSE", "index", 1, 0.3), row("^N225", "index", 1, 0.1), row("^HSI", "index", 1, -1),
  row("^VIX", "index", 16) ] }] },
  { id: "commodities", sections: [{ rows: [row("GC=F", "future", 4000, -1.5), row("HG=F", "future", 6, 0)] }] },
  { id: "rates", sections: [{ label: "US", rows: [Object.assign(row("^TNX", "yield", 4.9, null), { bp: { "1D": 5 } })] }, { label: "FX", rows: [row("DX-Y.NYB", "fx", 103, 0.25)] }] }] };
const by = L.index(market);
const g = L.riskGauge(by);
assert.strictEqual(g.parts.length, 8, "all eight live inputs used");
const sum = g.parts.reduce((a, p) => a + p.contrib, 0);
assert.strictEqual(g.score, Math.round(sum), "score is the sum of contributions");
assert.ok(g.parts.every(p => p.score >= -1 && p.score <= 1), "scores capped at ±1");
assert.strictEqual(g.parts.find(p => p.id === "vix").score, 0.5, "VIX 16 scores (20-16)/8");
assert.ok(g.missing.some(m => /Credit/.test(m)) && !g.missing.some(m => /2Y/.test(m)), "inputs not in the feeds are listed (US 2Y is in the feed since t1405u)");
// null inputs are left out and listed, never treated as zero
by["^VIX"].px = null; by["GC=F"].pct["1D"] = null;
const g2 = L.riskGauge(by);
assert.ok(!g2.parts.some(p => p.id === "vix" || p.id === "gold" || p.id === "cugold"), "null inputs excluded");
assert.ok(g2.missing.includes("VIX level") && g2.missing.includes("Gold, 1D"), "null inputs listed");
assert.strictEqual(L.riskGauge({}).score, null, "no data: no score");
// day-ahead from mr.json by date (never the wrong day)
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const start = new Date(Date.parse(today + "T00:00:00Z") - 40 * 864e5).toISOString().slice(0, 10);
const sys = Array.from({ length: 42 }, (_, i) => i + 1);
const D = L.dayAhead({ daily: { start, v: { SYS: sys, FI: sys.map(() => null) } } });
assert.strictEqual(D.today, today, "today's delivery day");
assert.strictEqual(D.at(D.today).SYS, 41, "today's value");
assert.strictEqual(D.at(D.today).FI, null, "missing zone stays null");
assert.ok(D.next, "tomorrow shown when published");
assert.strictEqual(L.dayAhead(null), null, "no file: nothing");
// wiring
const t = fs.readFileSync(path.join(root, "table.js"), "utf8");
assert.ok(/\["live","Live Pulse"\],\["editions","Pulse and CSI editions"\]/.test(t), "Live Pulse first, the editions second");
assert.ok(/if\(top==="live"\)return \{v:"briefs"/.test(t), "#live route");
assert.ok(/p\[1\]==="live"\?"live"/.test(t), "#briefs/live still routes to Live Pulse");
assert.ok(/go\("briefs",null,false,\{brief:"live"\}\);\}\}\/\* no hash: Live Pulse is the landing tab/.test(t), "bare address lands on Live Pulse");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(/livepulse\.js\?v=20261122ig1/.test(idx) && /livepulse\.css\?v=20261120sc1/.test(idx) && idx.indexOf("v2/shared/kit.js") < idx.indexOf("livepulse.js"), "assets cache-busted");
assert.ok(idx.indexOf("livepulse.js") < idx.indexOf("table.js"), "livepulse loads before table.js");
/* t1441u: tile labels and prices read in full at four per row on a phone; freshness tags are plain grey text */
const K = ctx.window.EMMIKit;
[[{ px: 91.07, kind: "future", sym: "BZ=F" }, "$91.07"], [{ px: 84.45, kind: "future", sym: "TTF=F" }, "€84.45"], [{ px: 3574, kind: "future", sym: "GC=F" }, "$3,574"],
  [{ px: 275.5, kind: "future", sym: "KC=F" }, "275.5¢"], [{ px: 6114, kind: "index", sym: "^STOXX50E" }, "6,114"], [{ px: 5.04, kind: "yield", sym: "^TNX" }, "5.04%"]]
  .forEach(([r, want]) => assert.strictEqual(K.pxShort(r), want, "compact price " + want));
["Euro Stoxx 50", "Diesel (ULSD)", "Uranium (SPUT)", "Aluminium (COMEX)", "Coffee NY (Arabica)", "Wheat Chicago", "Sugar NY No.11", "Soybean Meal", "TTF gas"].forEach(n =>
  assert.ok(K.tileName({ sym: "x", name: n }).length <= 12, "short tile label for " + n));
const tl = K.tile({ sym: "^STOXX50E", name: "Euro Stoxx 50", kind: "index", px: 6114, pct: { "1D": -0.7 } }, K.reg("t"), null);
assert.ok(/class="tn" title="Euro Stoxx 50"><span aria-hidden="true">Stoxx 50<\/span><span class="sr-only">Euro Stoxx 50</.test(tl), "full name stays on title and for screen readers");
const css = fs.readFileSync(path.join(root, "livepulse.css"), "utf8");
assert.ok(/\.fr:is\(\.dl, \.cl, \.pc, \.ob, \.cm, \.early\) \{display: inline; padding: 0; border: 0;[^}]*font-weight: 400;[^}]*color: var\(--faint\);\}/.test(css), "freshness tags plain grey for every state");
assert.ok(!/\.tn \{[^}]*text-overflow: ellipsis/.test(css) && !/\.sn-n \{[^}]*ellipsis/.test(css), "names are never ellipsised");
const b = fs.readFileSync(path.join(root, "briefs.js"), "utf8");
assert.ok(/data-brief-pick/.test(b) && /pulse\/editions\.json/.test(b), "edition archive and pickers unchanged");
const c = JSON.parse(fs.readFileSync(path.join(root, "data/live_comment.json"), "utf8"));
/* schema 2 (findings and a view) since t1405u; schema 1 (body bullets and a risk label) still renders */
assert.ok(c.written_at && c.headline && c.source && c.source.href && (c.schema >= 2 ? Array.isArray(c.findings) && c.findings.length >= 1 && c.findings.length <= 3 : Array.isArray(c.body) && "risk_label" in c), "live_comment.json schema");
console.log("live pulse ok");
// units and freshness labels (presentation only)
assert.strictEqual(L.unitText({ sym: "KC=F", kind: "future", ccy: "USX" }), "USc/lb", "coffee in US cents per lb");
assert.strictEqual(L.unitText({ sym: "^GSPC", kind: "index", ccy: "USD" }), "pts", "indices in points");
assert.strictEqual(L.unitText({ sym: "EURUSD=X", kind: "fx", ccy: "USD" }), "USD", "FX in the quote currency");
assert.strictEqual(L.fresh({ src: "ust", official: { id: "ust", name: "US Treasury", asof: "2026-11-17" }, bar_date: "2026-11-17" }, null).cls, "pc", "official close is a close");
assert.strictEqual(L.fresh({ src: "cnbc", official: { id: "snb", asof: "2025-07-31" }, market_time: "2026-11-17T21:01:48Z", state: null }, "2026-11-18T19:47:00Z").tag, "Prev close", "CNBC fallback is not labelled official");
assert.strictEqual(L.fresh({ state: "open", market_time: "2026-11-18T19:40:00Z" }, "2026-11-18T19:47:00Z").tag, "Delayed", "open market, fresh quote: delayed, never live");
console.log("live pulse units/freshness ok");
/* Catalysts open their EMMi entry, with the company page and the outside source beside it; past events drop out. */
const evs = { as_of: "2026-11-18", events: [
  { id: "orsted-q3", company: "Ørsted", ticker: "ORSTED", title: "Q3 results", date: "2099-11-24", sort_date: "2099-11-24", date_label: "24 Nov", source: "https://orsted.com/ir", source_name: "Ørsted IR" },
  { id: "old", company: "Old", title: "Past", date: "2000-01-01", sort_date: "2000-01-01", source: "javascript:alert(1)" }] };
const ch = L.catalystsHTML(evs, L.index({ groups: [{ id: "renewables", sections: [{ rows: [{ sym: "ORSTED.CO", name: "Ørsted", kind: "equity" }] }] }] }));
assert.ok(/href="#companies\/events\/orsted-q3"/.test(ch) && /data-co="ORSTED.CO"/.test(ch) && /https:\/\/orsted.com\/ir/.test(ch), "catalyst links: entry, company, source");
assert.ok(!/Past/.test(ch) && !/javascript:/.test(ch), "past events and unsafe links left out");
console.log("live pulse catalysts ok");
/* Announcements today (moved from the retired Overview tab): major company items dated today only; insider trades and
   administrative filings stay off; a name opens its company page. */
const nowIso = new Date().toISOString().slice(0, 16) + "Z";
const deals = { cos: { "EQNR.OL": { n: "Equinor" }, "AKRBP.OL": { n: "Aker BP" } }, items: [
  { t: nowIso, s: "EQNR.OL", ty: "ma", h: "Equinor agrees acquisition of a stake", u: "https://newsweb.oslobors.no/x", src: "newsweb" },
  { t: nowIso, s: "AKRBP.OL", ty: "insider", h: "Primary insider bought shares", src: "fi" },
  { t: nowIso, s: "EQNR.OL", ty: "other", h: "Total Voting Rights", src: "newsweb" },
  { t: "2000-01-01T08:00Z", s: "EQNR.OL", ty: "ma", h: "Old merger", src: "newsweb" }] };
const an = L.announcementsHTML(deals);
assert.ok(/Announcements today/.test(an) && /data-co="EQNR.OL"/.test(an) && /acquisition/.test(an), "today's major item shown");
assert.ok(!/insider/.test(an) && !/Voting Rights/.test(an) && !/Old merger/.test(an), "insider, admin and old items left out");
assert.strictEqual(L.announcementsHTML({ cos: {}, items: [] }), "", "nothing major today: no block");
console.log("live pulse announcements ok");

/* Six Live Pulse changes (t1421u): snapshot strip, collapsed findings, commentary time with an "older" badge,
   secondary groups behind expanders, Next up near the top, one-line phone intro. */
{
  const zw = (ymd, hm) => { /* Zurich wall time -> instant (CET in November) */ return Date.parse(ymd + "T" + hm + ":00+01:00"); };
  assert.strictEqual(L.latestSlot(zw("2026-11-19", "13:00")), zw("2026-11-19", "12:00"), "Thu 13:00: latest slot 12:00");
  assert.strictEqual(L.latestSlot(zw("2026-11-19", "06:10")), zw("2026-11-18", "22:30"), "before 06:30: the previous evening slot");
  assert.strictEqual(L.latestSlot(zw("2026-11-22", "10:00")), zw("2026-11-20", "22:30"), "Sunday: Friday 22:30");
  assert.ok(!L.commentaryOlder("2026-11-19T06:01:00+01:00", zw("2026-11-19", "09:00")), "06:00 email counts for the 06:30 slot");
  assert.ok(L.commentaryOlder("2026-11-19T06:01:00+01:00", zw("2026-11-19", "12:05")), "after 12:00 the morning text is older");
  assert.ok(!L.commentaryOlder("2026-11-19T22:28:00+01:00", zw("2026-11-19", "23:00")), "22:28 counts for 22:30");
  assert.ok(L.commentaryOlder("2026-11-17T22:28:00+01:00", zw("2026-11-19", "10:00")), "two days old is older");
  const cw = L.cwLine({ written_at: "2026-11-19T16:35:00+01:00", source: { prices_at: "2026-11-19T20:00:00+01:00" } });
  assert.ok(/Commentary written <b>16:35<\/b> Zurich/.test(cw) && !/20:00/.test(cw), "commentary time is written_at only, never the price time");
  const src = fs.readFileSync(path.join(root, "livepulse.js"), "utf8");
  assert.ok(/cwLine\(c\) \+ '<section class="block lp-tone lp-brief"/.test(src), "commentary line sits above the brief");
  /* snapshot strip */
  const snap = L.snapHTML(by, null, { prices: { regions: { Nordic: { rows: [["2026-11-18", 155.49], ["2026-11-19", 207.6]] } } } });
  assert.strictEqual((snap.match(/class="sn"/g) || []).length, 8, "eight benchmarks");
  assert.ok(/S&amp;P 500|S&P 500/.test(snap) && /US 10Y/.test(snap) && /Nordic system/.test(snap) && /207\.6 €\/MWh/.test(snap) && /\+52\.1 €/.test(snap), "names, power price and its day move");
  assert.ok(/href="#markets\/mkt-rates"/.test(snap) && /href="#energy\/prices"/.test(snap), "each links to its EMMi detail");
  assert.ok(!/data-co=/.test(snap), "no personal holdings or company names in the strip");
  /* expanders */
  const keyed = L.MONITOR.filter(g => g[3]).map(g => g[3]);
  assert.deepStrictEqual(Array.from(keyed), ["rates", "fx", "softs", "grains", "livestock"], "secondary groups behind expanders");
  assert.ok(L.MONITOR.filter(g => !g[3]).some(g => g[1].includes("^TNX")) && L.MONITOR.filter(g => !g[3]).some(g => g[1].includes("GC=F")), "headline tiles stay visible");
  const byTitle = Object.fromEntries(L.MONITOR.map(g => [g[0], Array.from(g[1])]));
  const mkGroups = { "Precious metals": ["GC=F", "SI=F", "PL=F", "PA=F"], "Base metals": ["HG=F", "ALI=F"], "Softs": ["KC=F", "CC=F", "SB=F", "CT=F", "OJ=F", "LBR=F"], "Grains and oilseeds": ["ZW=F", "ZC=F", "ZS=F", "ZL=F", "ZM=F", "ZO=F", "ZR=F"], "Livestock": ["LE=F", "HE=F", "GF=F"] };
  Object.keys(mkGroups).forEach(title => {
    assert.deepStrictEqual(byTitle[title], mkGroups[title], title + " matches the Markets IG grouping");
  });
  assert.ok(!L.MONITOR.some(g => g[0] === "Metals" || g[0] === "More metals" || g[0] === "Soft commodities"), "old ungrouped metals/softs labels are gone");
  assert.ok(!keyed.includes("metals"), "retired metals expander key is unused (old emmiLpExp.metals is ignored, not remapped)");
  const mk = fs.readFileSync(path.join(root, "v2/markets/markets.js"), "utf8");
  Object.keys(mkGroups).forEach(title => {
    const re = new RegExp('title: "' + title + '", syms: \\[([^\\]]+)\\]');
    const m = mk.match(re);
    assert.ok(m, "Markets still has " + title);
    const syms = m[1].split(",").map(s => s.trim().replace(/["']/g, ""));
    assert.deepStrictEqual(byTitle[title], syms, "Live Pulse " + title + " order matches Markets");
  });
  assert.ok(/emmiLpExp/.test(src) && /addEventListener\("toggle"/.test(src), "expander state kept in localStorage");
  /* findings collapse with links visible */
  assert.ok(/fd-more/.test(src) && /fdLinks\(f, lk\) \+ "<\/div><\/li>"/.test(src), "Read more, links outside the clamped text");
  /* Next up */
  const nu = L.nextUpHTML(evs, {});
  assert.ok(/Next up/.test(nu) && /orsted-q3/.test(nu), "Next up renders the catalysts");
  const evs2 = { events: [{ id: "a", company: "A", title: "Q4", date: "2099-01-02", confidence: "guidance" }, { id: "b", company: "B", title: "AGM", date: "2099-01-01", confidence: "confirmed" }] };
  const nu2 = L.nextUpHTML(evs2, {});
  assert.ok(nu2.indexOf("AGM") < nu2.indexOf("Q4") && /Confirmed/.test(nu2) && /Guided/.test(nu2), "Next up: date order with confirmed / guided labels");
  assert.ok(src.indexOf("toneHTML(D.comment) + nextUpHTML") > 0 && src.indexOf("snapHTML(by,") < src.indexOf("toneHTML(D.comment)"), "strip first, Next up right after the brief");
  /* phone header */
  const css = fs.readFileSync(path.join(root, "livepulse.css"), "utf8");
  assert.ok(/\.lp \.lede-l \{display: none;\}/.test(css) && /\.lp \.lp-ed \{display: none;\}/.test(css), "phone: one-line intro, no duplicate editions link");
}
console.log("live pulse six changes ok");
/* Markets Rates tiles (18 Nov wish): US 2Y leads, no 13-week, 5-year or French 10Y; Live Pulse rates groups match. */
{
  const mk = fs.readFileSync(path.join(root, "v2/markets/markets.js"), "utf8");
  assert.ok(/HIDE = \{ "\^IRX": 1, "\^FVX": 1, "CNBC:FR10Y-FR": 1 \}/.test(mk) && /sym === "UST:2Y"/.test(mk), "Markets Rates: 2Y first, 13-week, 5Y and French 10Y hidden");
  const all = L.MONITOR.filter(g => /rates/i.test(g[0])).reduce((a, g) => a.concat(g[1]), []);
  ["UST:2Y", "NYFED:SOFR", "NB:TBIL3M", "CNBC:JP10Y-JP", "PBOC:LPR1Y"].forEach(s => assert.ok(all.includes(s), s + " in the Live Pulse rates groups"));
  ["^IRX", "^FVX", "CNBC:FR10Y-FR"].forEach(s => assert.ok(!all.includes(s), s + " not in the Live Pulse rates groups"));
}
console.log("rates tiles ok");
// t1443u: real sectors (no TLT), coverage baskets with a median and up/down counts, unch vs no trade, typical-move bars
{
  const spark = Array.from({ length: 128 }, (_, i) => 100 * (1 + 0.01 * Math.sin(i)));
  const etf = (sym, note, d1, vol) => ({ sym, name: sym + " ETF", note, kind: "etf", px: 100, pct: { "1D": d1, "1W": d1, "1M": d1 }, vol: { last: vol }, spark });
  const eq = (sym, d1, vol, px) => ({ sym, name: sym, kind: "equity", px: px === undefined ? 10 : px, pct: { "1D": d1, "1W": d1 === null ? null : 2 * d1, "1M": null }, vol: { last: vol }, spark });
  const mk = { generated_utc: new Date().toISOString(), groups: [
    { id: "sectors", sections: [{ label: "US sectors (S&P 500, Select Sector SPDR)", rows: [etf("XLK", "Technology", -2, 9), etf("XLU", "Utilities", 0, 9), etf("XLE", "Energy", 0, 0)] },
      { label: "Europe sectors (STOXX Europe 600, iShares on Xetra)", rows: [etf("EXV1.DE", "Banks", 1.5, 9)] }] },
    { id: "nordic", sections: [{ label: null, rows: [eq("ORSTED.CO", 3, 5), eq("FORTUM.HE", -1, 5), eq("SCATC.OL", 0, 5), eq("RWE.DE", 2, 5), eq("ENEL.MI", 0, 0), eq("SLR.MC", 1, 5), eq("EDPR.LS", null, 5)] },
      { label: "Strategic peers", rows: [eq("KKR", 9, 5), eq("EQT.ST", 9, 5), eq("BLK", 1, 5), eq("BX", -1, 5), eq("BAM", 2, 5)] }] }] };
  const by2 = L.index(mk);
  const sh = L.sectorsHTML(mk, by2, "1D", "us");
  assert.ok(!/TLT/.test(sh), "no TLT in Sectors");
  assert.ok(/US · S&amp;P 500 sectors/.test(sh) && /Europe · STOXX Europe 600 sectors/.test(sh) && /Banks/.test(sh) && /Technology/.test(sh), "US and Europe sector lists, labelled by sector");
  assert.strictEqual((sh.match(/data-kt=/g) || []).length, 4, "every sector row opens its in-site detail sheet");
  assert.ok(!/finance\.yahoo/.test(sh), "sector rows do not link out to Yahoo");
  assert.ok(/>unch</.test(sh) && />no trade</.test(sh), "a traded 0.0 shows unch, an untraded one no trade");
  assert.ok(/data-lp-secreg="eu"/.test(sh), "phone US/Europe switch");
  assert.ok(L.typMove(mk.groups[0].sections[0].rows[0], "1W") > L.typMove(mk.groups[0].sections[0].rows[0], "1D"), "typical move grows with the period");
  const bh = L.basketsHTML(mk, "1D");
  assert.ok(/id="lpBaskets"/.test(bh) && /Nordic renewables <span class="fp">\(3\)/.test(bh) && /European renewables \(ex-Nordic\) <span class="fp">\(4\)/.test(bh), "Nordic split out, stable member counts");
  assert.ok(/Strategic peers <span class="fp">\(3\)/.test(bh), "Strategic peers without KKR and EQT");
  assert.ok(/1 up · 1 down · 1 unch/.test(bh), "Nordic: up/down/unch count");
  assert.ok(/2 up · 0 down · 1 no trade · 1 without 1D history/.test(bh), "no-trade and missing names counted apart, left out of the median");
  assert.ok(/European renewables \(ex-Nordic\)[\s\S]*?\+1\.5/.test(bh), "median of RWE 2 and Solaria 1 = 1.5 (Enel no trade excluded)");
  const bw = L.basketsHTML(mk, "1W");
  assert.ok(/European renewables \(ex-Nordic\) <span class="fp">\(4\)/.test(bw) && /Nordic renewables <span class="fp">\(3\)/.test(bw), "counts do not change with the period");
  const css = fs.readFileSync(path.join(root, "livepulse.css"), "utf8");
  assert.ok(!/\.lp-flow-p[^{]*\{[^}]*text-overflow:\s*ellipsis/.test(css), "no ellipsis on flow labels");
}
console.log("live pulse sectors and baskets ok");
