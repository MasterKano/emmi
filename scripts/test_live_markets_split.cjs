/* Live Pulse / Markets / Energy split (Jerry 23 Nov 2026, t1592u-t1595u).
   #live: slim Risk Gauge strip on top, the brief, where the money is going, quick jumps; no Markets grid, no Energy block.
   #markets: regional Equities Monitor on the Zurich clock (holiday-aware order and pills, 2 rows of 4 tiles per region,
   4 sector maps: S&P 500, Europe top 80, Nikkei 225 + CSI 300), charts/tiles/tables only, notes behind the i.
   #energy: the Live Pulse Energy block merged into the Nordic landing (price strip and gas storage cards). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(root, f), "utf8");
const doc = { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, readyState: "loading", documentElement: { getAttribute() { return "light"; } } };
const ctx = { window: {}, document: doc, Intl, Date, Math, JSON, setInterval() {}, setTimeout() {}, clearInterval() {}, localStorage: { getItem: () => null, setItem() {} } };
["clocks.js", "v2/shared/kit.js", "v2/shared/regions.js", "v2/shared/treemap.js", "livepulse.js", "v2/markets/markets.js"].forEach(f => vm.runInNewContext(rd(f), ctx));
const W = ctx.window, R = W.EMMIRegions, T = W.EMMITreemap, L = W.EMMILivePulse, M = W.MMV2Markets;
assert.ok(R && T && L && M, "modules load");
const at = s => Date.parse(s);
const arr = a => JSON.parse(JSON.stringify(a));

/* ---------- 1 region order on the Zurich clock, holiday-aware ---------- */
const ORD = [
  ["2026-11-24T00:30:00+01:00", ["us", "eu", "asia"], "Tue 00:30: still the US window"],
  ["2026-11-24T01:00:00+01:00", ["asia", "us", "eu"], "Tue 01:00: Asia opens"],
  ["2026-11-24T08:59:00+01:00", ["asia", "us", "eu"], "08:59: Asia window"],
  ["2026-11-24T09:00:00+01:00", ["eu", "asia", "us"], "09:00: Europe opens"],
  ["2026-11-24T15:29:00+01:00", ["eu", "asia", "us"], "15:29: Europe window"],
  ["2026-11-24T15:30:00+01:00", ["us", "eu", "asia"], "15:30: US opens"],
  ["2026-11-26T16:00:00+01:00", ["eu", "asia", "us"], "US Thanksgiving 16:00: no US open, Europe -> Asia -> US"],
  ["2026-11-28T12:00:00+01:00", ["us", "eu", "asia"], "Saturday: Friday's last open (US) first"],
  ["2026-12-25T12:00:00+01:00", ["asia", "us", "eu"], "Christmas Day: Asia (Tokyo, Shanghai) opened, the West shut"]
];
ORD.forEach(([t, want, msg]) => assert.deepStrictEqual(arr(R.order(at(t))), want, msg));
console.log("region order ok (" + ORD.length + " clock cases)");

/* ---------- 2 session pills ---------- */
const pl = (r, t) => R.pill(r, at(t));
assert.strictEqual(pl("us", "2026-11-24T16:05:00+01:00").cls, "live", "US live in the session");
assert.ok(/^Live 16:05 CET/.test(pl("us", "2026-11-24T16:05:00+01:00").text), "live pill carries the Zurich time");
assert.strictEqual(pl("eu", "2026-11-24T20:00:00+01:00").cls, "close", "Europe closed in the evening");
assert.ok(/^Close Tue 24 Nov/.test(pl("eu", "2026-11-24T20:00:00+01:00").text), "close pill names the session");
const tg = pl("us", "2026-11-26T17:00:00+01:00");
assert.strictEqual(tg.cls, "holiday", "Thanksgiving: holiday pill");
assert.ok(/Close Wed 25 Nov/.test(tg.text) && /New York shut/.test(tg.text), "Thanksgiving: last close Wed and the exchange shut");
assert.strictEqual(R.state("tse", at("2026-11-24T04:00:00+01:00")), "midday", "Tokyo lunch break 12:00 JST = midday");
assert.strictEqual(pl("asia", "2026-11-24T04:00:00+01:00").cls, "live", "Asia stays live through Tokyo's lunch (Seoul, Taipei, Sydney trade)");
const syd = pl("asia", "2026-11-24T00:06:00+01:00");
assert.ok(syd.cls === "live" && /Sydney open/.test(syd.text), "before Tokyo opens the pill says which Asian market trades");
const tok = pl("asia", "2026-11-23T03:00:00+01:00");
assert.ok(/Tokyo shut/.test(tok.text), "Tokyo holiday (Labour Thanksgiving, 23 Nov) named on the Asia pill");
console.log("session pills ok");

/* ---------- 3 tiles: 2 rows of 4 per region ---------- */
const mk = (sym, d1, kind) => ({ sym, name: sym, kind: kind || "index", px: 100, pct: { "1D": d1, "1W": d1, "1M": d1 }, spark: [] });
const syms = ["^GSPC", "^NDX", "^DJI", "^RUT", "^SOX", "MAGS", "^VIX", "^IXIC", "^STOXX", "^GDAXI", "^FTSE", "^FCHI", "^SSMI", "^OMX", "^STOXX50E", "^AEX", "^IBEX",
  "^N225", "000300.SS", "^HSI", "^KS11", "^TWII", "^AXJO", "ES=F", "NQ=F"].concat(arr(R.US_SECTOR), arr(R.EU_SECTOR), arr(R.ASIA_LARGE));
const by = {};
syms.forEach((s, i) => { by[s] = mk(s, ((i * 7) % 11 - 5) / 10, /^(X|EX)/.test(s) ? "etf" : /\.(TW|KS|HK|T)$/.test(s) ? "equity" : /=F$/.test(s) ? "future" : "index"); });
by.XLE.pct["1D"] = 4.2; by["EXV6.DE"].pct["1D"] = -3.9; by["9988.HK"].pct["1D"] = 6; by["7203.T"].pct["1D"] = -5;
const usOpen = at("2026-11-24T16:00:00+01:00"), usShut = at("2026-11-24T03:00:00+01:00");
["us", "eu", "asia"].forEach(r => {
  const rows = R.lineup(r, by, usOpen);
  assert.strictEqual(rows.length, 2, r + ": 2 rows");
  rows.forEach(row => assert.strictEqual(row.length, 4, r + ": 4 tiles per row"));
});
const sy = (r, t) => R.lineup(r, by, t).map(row => row.map(x => x.row.sym));
assert.deepStrictEqual(arr(sy("us", usOpen)), [["^GSPC", "^NDX", "^DJI", "^RUT"], ["^SOX", "MAGS", "^VIX", "XLE"]], "US lineup with the standout sector ETF");
assert.deepStrictEqual(arr(sy("eu", usOpen)), [["^STOXX", "^GDAXI", "^FTSE", "^FCHI"], ["^SSMI", "^OMX", "^STOXX50E", "EXV6.DE"]], "Europe lineup with the standout STOXX sector");
assert.deepStrictEqual(arr(sy("asia", usShut)[1]), ["^TWII", "^AXJO", "ES=F", "NQ=F"], "Asia: US futures while US cash is shut");
assert.deepStrictEqual(arr(sy("asia", usOpen)[1]), ["^TWII", "^AXJO", "9988.HK", "7203.T"], "Asia: biggest large-cap movers while US cash trades");
const by2 = Object.assign({}, by); delete by2["^FCHI"];
assert.deepStrictEqual(arr(R.lineup("eu", by2, usOpen)[0].map(x => x.row.sym)), ["^STOXX", "^GDAXI", "^FTSE", "^AEX"], "a missing tile is filled from the reserves");
const by3 = Object.assign({}, by); ["^SOX", "MAGS", "^VIX", "^IXIC"].forEach(s => delete by3[s]);
assert.strictEqual(R.lineup("us", by3, usOpen).length, 1, "a row that cannot be filled to 4 is dropped whole");
console.log("tile lineups ok");

/* ---------- 4 treemap ---------- */
const items = [{ v: 6 }, { v: 6 }, { v: 4 }, { v: 3 }, { v: 2 }, { v: 2 }, { v: 1 }];
const rects = T.squarify(items, 0, 0, 600, 400);
const tot = rects.reduce((a, r) => a + r.w * r.h, 0);
assert.ok(Math.abs(tot - 240000) < 1, "squarify fills the box");
rects.forEach(r => { assert.ok(r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= 600.01 && r.y + r.h <= 400.01, "inside the box"); assert.ok(Math.abs(r.w * r.h / 240000 - r.v / 24) < 1e-6, "area proportional to weight"); });
assert.ok(rects.every(r => Math.max(r.w / r.h, r.h / r.w) < 4), "squarified: no slivers");
const hz = T.heat(0), hu = T.heat(3), hd = T.heat(-3);
assert.ok(hz !== hu && hu !== hd && /rgb/.test(hu), "heat: neutral, green and red differ");
const map = { key: "t", sectors: [{ name: "Tech", short: "Tech", chg: 1, wt: 60, items: [["A", "A", "A Inc", 2, 40, 10, 100], ["B", "B", "B Inc", -1, 15, 10, 50], ["C", "C", "C Inc", 0.5, 0.4, 10, 1], ["D", "D", "D Inc", 0.2, 0.3, 10, 1]] },
  { name: "Energy", short: "Energy", chg: -1, wt: 40, items: [["E", "E", "E plc", -2, 25, 10, 80], ["F", "F", "F plc", 1, 15, 10, 40]] }] };
const lay = T.layout(map, 600, 400, { minArea: 3000 });
assert.strictEqual(lay.heads.length, 2, "one box per sector");
assert.ok(lay.boxes.some(b => b.more && b.more.length === 2), "small names folded into one +N box");
console.log("treemap ok");

/* ---------- 5 #markets: Equities Monitor markup, 4 maps, no prose ---------- */
const mapsFx = { generated_utc: "2026-11-23T22:56:00Z", maps: {} };
[["sp500", "us", "S&P 500"], ["eu80", "eu", "Europe top 80"], ["nikkei225", "asia", "Nikkei 225"], ["csi300", "asia", "CSI 300"]].forEach(([k, r, n]) => {
  mapsFx.maps[k] = Object.assign({}, map, { key: k, region: r, name: n, index_name: n, index_chg: 0.4, adv: 1, dec: 1, unch: 0, n: 6, N: 6, mode: "close", label: "Close Mon 23 Nov", size: "Market cap", basis: "20 Nov → 23 Nov", built_utc: "2026-11-23T22:56:00Z" });
});
M.setMaps(mapsFx);
const eq = M.equitiesHTML(by);
assert.ok(/<section class="block eqm" id="mkt-indices" data-order="(us|eu|asia),(us|eu|asia),(us|eu|asia)"/.test(eq), "Equities section keeps the #markets/mkt-indices anchor and carries the order");
const ordNow = arr(R.order(Date.now()));
const pos = ordNow.map(r => eq.indexOf('id="mkt-eq-' + r + '"'));
assert.ok(pos.every(p => p > 0) && pos[0] < pos[1] && pos[1] < pos[2], "regions rendered in clock order");
const regs = eq.split('<section class="eqm-reg"').slice(1);
assert.strictEqual(regs.length, 3, "three regions");
regs.forEach(h => {
  const tiles = h.split('class="tiles eqm-tiles"')[1].split('<div class="eqm-maps')[0];
  assert.strictEqual((tiles.match(/data-kt=/g) || []).length, 8, "8 tiles (2 x 4) per region");
  assert.ok(/class="eqm-pill (live|midday|close|holiday)"/.test(h), "session pill per region");
});
assert.strictEqual((eq.match(/<figure class="tmap" data-map=/g) || []).length, 4, "4 sector maps");
assert.ok(/<div class="eqm-maps n2"><figure class="tmap" data-map="nikkei225">[\s\S]*data-map="csi300"/.test(eq), "Asia: Nikkei 225 and CSI 300 side by side");
assert.ok(/data-map="sp500"/.test(regs.find(h => /mkt-eq-us/.test(h))) && /data-map="eu80"/.test(regs.find(h => /mkt-eq-eu/.test(h))), "S&P 500 under US, Europe top 80 under Europe");
const prose = eq.replace(/<p class="fnote[^"]*">[\s\S]*?<\/p>/g, "");
assert.ok(!/<p(?! class="na")[ >]/.test(prose), "no editorial prose on #markets outside the i notes");
M.setMaps({ maps: { sp500: mapsFx.maps.sp500 } });
assert.ok(/tm-na[\s\S]*Sector map not available yet/.test(M.equitiesHTML(by)), "a missing map says so, never a blank");
M.setMaps(Object.assign({}, mapsFx, { maps: Object.assign({}, mapsFx.maps, { eu80: Object.assign({}, mapsFx.maps.eu80, { stale: true }) }) }));
assert.ok(/eqm-pill stale">Close Mon 23 Nov · stale/.test(M.equitiesHTML(by)), "a stale map is labelled stale");
const mjs = rd("v2/markets/markets.js");
assert.ok(/\/emmi\/ed\/live\/data\/region_maps\.json/.test(mjs), "maps read live-data region_maps.json");
assert.ok(mjs.indexOf("equitiesHTML(bySym(groups))") > 0 && !/title: "Global markets"/.test(mjs), "Equities Monitor replaces the old global indices block");
const css = rd("v2/markets/live.css");
assert.ok(/@media \(min-width: 900px\) \{ #macroWrap \.eqm-maps\.n2 \{grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);\} \}/.test(css), "Asia maps side by side on desktop, stacked on a phone");
assert.ok(/\.tiles\.eqm-tiles \{grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);\}/.test(css), "4 tiles per row at every width");
assert.ok(/#3B82F6/.test(css) && /\.tm-tip \{[^}]*var\(--panel/.test(css) && /\.tm-sec \{[^}]*var\(--panel/.test(css), "blue accent; theme-driven panels (light and dark)");
const tbl = rd("table.js");
assert.ok(/MKT_CHIPS=\[\["indices","Equities"\],\["ratesfx","Rates and FX"\]/.test(tbl), "Markets chips: Equities first");
console.log("markets equities monitor ok");

/* ---------- 6 #live: risk strip on top, no markets grid, no energy ---------- */
const lpm = { generated_utc: "2026-11-23T21:47:00Z", groups: [{ id: "indices", sections: [{ rows: [
  Object.assign(mk("^GSPC", 1.2), { ma: { "200": { pct: 3 } } }), Object.assign(mk("^STOXX", 0.4), { ma: { "200": { pct: 4 } } }), mk("^GDAXI", 0.3), mk("^FTSE", -0.2), mk("^N225", -1), mk("^HSI", 0.5),
  Object.assign(mk("^VIX", -5), { px: 17 })] }] }, { id: "commodities", sections: [{ rows: [mk("GC=F", -1, "future"), mk("HG=F", 1, "future")] }] }] };
const lb = L.index(lpm);
const rs = L.riskStripHTML(lb, lpm);
const g = L.riskGauge(lb);
assert.ok(rs.indexOf('id="lpRiskStrip"') > 0 && rs.indexOf('class="lp-rs-sc">+' + g.score + "<") > 0, "strip shows the score");
assert.ok(/class="lp-rs-band">(Risk on|Mixed|Risk off)</.test(rs) && /class="lp-rs-m" role="img"/.test(rs) && /class="mk" style="left:/.test(rs), "band pill and meter");
assert.strictEqual((rs.match(/class="lp-rs-d"/g) || []).length, 3, "top 3 drivers");
assert.ok(/data-lp-risk aria-expanded="false" aria-controls="lpRiskFull"/.test(rs) && /id="lpRiskFull" hidden/.test(rs) && /<tbody>[\s\S]*VIX level/.test(rs), "full breakdown behind the toggle");
const none = L.riskStripHTML({}, null);
assert.ok(/lp-rs na/.test(none) && /Not available yet/.test(none) && !/class="mk"/.test(none), "no gauge: says so, no marker");
const lsrc = rd("livepulse.js");
const rend = lsrc.slice(lsrc.indexOf("function render()"), lsrc.indexOf("function onClick("));
assert.ok(rend.indexOf("riskStripHTML") < rend.indexOf("toneHTML(D.comment)"), "risk strip above the brief");
assert.ok(!/marketsHTML|energyHTML|nordicHTML|gasHTML/.test(rend), "no Markets grid or Energy on #live");
assert.deepStrictEqual(arr(L.JUMPS.map(j => j[1])), ["#markets/mkt-indices", "#markets/mkt-rates", "#markets/mkt-cmd", "#markets/metals", "#energy", "#companies"], "quick jumps into Markets and Energy");
assert.ok(/Where the money is going/.test(lsrc), "leading and lagging retitled");
const lcss = rd("livepulse.css");
assert.ok(/\.lp-rs-bar \{display: grid;/.test(lcss) && /@media \(max-width: 600px\) \{\n  \.lp-v3 \.lp-tone/.test(lcss), "slim strip and a tighter brief on a phone");
const lc = JSON.parse(rd("data/live_comment.json"));
assert.ok(lc.headline && lc.written_at && (lc.schema >= 2 ? Array.isArray(lc.findings) : Array.isArray(lc.body)), "live_comment.json schema unchanged");
console.log("live pulse layout ok");

/* ---------- 7 #energy: merged snapshot ---------- */
const nl = rd("nordiclanding.js");
assert.ok(/blk\("Energy snapshot", snapshotHTML\) \+ blk\("Supply balance"/.test(nl), "Energy snapshot opens the Nordic landing");
["BZ=F", "CL=F", "TTF=F", "NG=F", "HO=F", "CO2.L", "U-UN.TO"].forEach(s => assert.ok(nl.indexOf('["' + s + '"') > 0, s + " in the energy price strip"));
assert.ok(/getJSON\("data\/market\.json\?t=/.test(nl) && /getJSON\("data\/gas\.json\?t=/.test(nl), "landing loads market.json and gas.json");
const NK = L.nordicKit;
assert.ok(typeof NK.tape === "function" && typeof NK.gasHTML === "function", "kit exports the price strip and gas cards");
const tape = NK.tape({ generated_utc: null, groups: [{ id: "energy", sections: [{ rows: [mk("BZ=F", -1.2, "future")] }] }] }, [["BZ=F", "Brent", null, "Brent crude"], ["CL=F", "WTI", null, "WTI crude"]]);
assert.strictEqual((tape.match(/class="sn"/g) || []).length, 2, "one cell per energy price");
assert.ok(/Brent/.test(tape) && /Not available yet|na/.test(tape), "missing price says not available");
const gas = { areas: { EU: { last: "2026-11-21", s: { fill: 69.2, twh: 783, vsAvg: -17.7, avg: 86.9, min: 72.3, max: 98.6, vsLy: -10.4, ly: 79.6, d7: -1.4, d1: -0.2 } } } };
const gh = NK.scoped("t", () => NK.gasHTML(gas));
assert.strictEqual((gh.match(/class="kpi"/g) || []).length, 4, "4 gas storage cards");
assert.ok(/69\.2% full/.test(gh) && /−17\.7 pp/.test(gh), "gas card values");
assert.ok(!/id="lpEnergy"/.test(lsrc), "Live Pulse Energy block removed (duplicate of the landing)");
console.log("energy merge ok");

/* ---------- 8 wiring ---------- */
const idx = rd("index.html");
const iKit = idx.indexOf("v2/shared/kit.js"), iReg = idx.indexOf("v2/shared/regions.js"), iTm = idx.indexOf("v2/shared/treemap.js"), iTbl = idx.indexOf("table.js?v=");
assert.ok(iKit > 0 && iReg > iKit && iTm > iReg && iTbl > iTm && idx.indexOf("clocks.js") < iReg, "regions.js and treemap.js load after clocks/kit, before table.js");
assert.ok(/regions\.js\?v=\d{8}\w+/.test(idx) && /treemap\.js\?v=\d{8}\w+/.test(idx), "new scripts cache-busted");
console.log("live / markets / energy split: PASS");
