/* Markets Commodities: IG-style groups, 4 tiles then aligned CFTC cells, shared 1W/1M/3M/1Y period (t1445u). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");

const store = {};
const document = {
  addEventListener() {},
  readyState: "complete",
  body: null,
  getElementById() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { className: "", innerHTML: "" }; }
};
const ctx = {
  window: {}, document, Intl, Date, Math, JSON, console,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
};
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/shared/candles.js"), "utf8"), ctx);
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/shared/kit.js"), "utf8"), ctx);
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/shared/cot.js"), "utf8"), ctx);
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/markets/markets.js"), "utf8"), ctx);

const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const K = ctx.window.EMMIKit;
const C = ctx.window.MMCandles;
const Cot = ctx.window.EMMICot;
const M = ctx.window.MMV2Markets;

assert.ok(M && M.GROUPS && M.SYM_COT && M.PERIODS.join() === "1W,1M,3M,1Y", "markets hooks exported");
assert.strictEqual(M.period(), "1M", "default period is 1M");
M.setPeriod("3M");
assert.strictEqual(M.period(), "3M");
M.setPeriod("1M");

const row = (sym, name, extra) => Object.assign({
  sym, name, kind: "future", px: 100, ccy: "USD",
  pct: { "1D": 0.5, "1W": -1.2, "1M": -3.4, "6M": 8, "1Y": 12 },
  spark: Array.from({ length: 40 }, (_, i) => 90 + i * 0.2),
  ohlc: {
    d: Array.from({ length: 22 }, (_, i) => [100 + i * 0.1, 101 + i * 0.1, 99 + i * 0.1, 100.2 + i * 0.1]),
    d0: "2026-10-21",
    m: Array.from({ length: 13 }, (_, i) => [80 + i, 82 + i, 78 + i, 81 + i]),
    m0: "2025-11"
  }
}, extra || {});

const groups = [
  { id: "commodities", sections: [{ rows: [
    row("BZ=F", "Brent crude Jan-27"), row("CL=F", "WTI crude Dec-26"),
    row("HO=F", "NY Harbor diesel (ULSD) Dec-26"), row("NG=F", "Henry Hub gas Dec-26"),
    row("TTF=F", "Dutch TTF gas Dec-26"), row("GC=F", "Gold Dec-26"),
    row("SI=F", "Silver Dec-26"), row("HG=F", "Copper (COMEX) Dec-26"),
    row("PL=F", "Platinum Jan-27"), row("U-UN.TO", "Sprott Physical Uranium"),
    row("CO2.L", "EU carbon (EUA ETC)")
  ] }] },
  { id: "commodities_more", sections: [
    { label: "Precious metals", rows: [row("PA=F", "Palladium")] },
    { label: "Base metals", rows: [row("ALI=F", "Aluminium (COMEX)")] },
    { label: "Soft commodities", rows: [
      row("KC=F", "Coffee NY (Arabica)"), row("CC=F", "Cocoa NY"), row("ZW=F", "Wheat Chicago"),
      row("ZC=F", "Corn"), row("ZS=F", "Soybeans"), row("SB=F", "Sugar NY No.11"),
      row("HE=F", "Lean Hogs"), row("CT=F", "Cotton"), row("ZL=F", "Soybean Oil"),
      row("ZO=F", "Oats"), row("LE=F", "Live Cattle"), row("ZR=F", "Rough Rice"),
      row("ZM=F", "Soybean Meal"), row("OJ=F", "Orange Juice"), row("LBR=F", "Lumber")
    ] }
  ] },
  { id: "indices", sections: [{ rows: [row("^GSPC", "S&P 500", { kind: "index" })] }] }
];
const by = M.bySym(groups);
assert.ok(by["PA=F"] && by["BZ=F"] && by["LE=F"] && by["ALI=F"], "tiles from both commodities groups are indexed");

const energy = M.picked(M.GROUPS[0], by);
same(energy.rows.map(r => r.sym), ["BZ=F", "CL=F", "HO=F", "NG=F", "TTF=F", "CO2.L", "U-UN.TO"], "Energy order, RBOB skipped when absent");
assert.ok(energy.extraCot.includes("gasoil"), "ICE gasoil kept as also-reported");
same(M.picked(M.GROUPS[1], by).rows.map(r => r.sym), ["GC=F", "SI=F", "PL=F", "PA=F"], "Precious: gold silver platinum palladium");
same(M.picked(M.GROUPS[2], by).rows.map(r => r.sym), ["HG=F", "ALI=F"], "Base: copper and aluminium");
same(M.picked(M.GROUPS[3], by).rows.map(r => r.sym), ["KC=F", "CC=F", "SB=F", "CT=F", "OJ=F", "LBR=F"], "Softs only, no grains or livestock");
same(M.picked(M.GROUPS[4], by).rows.map(r => r.sym), ["ZW=F", "ZC=F", "ZS=F", "ZL=F", "ZM=F", "ZO=F", "ZR=F"], "Grains and oilseeds");
same(M.picked(M.GROUPS[5], by).rows.map(r => r.sym), ["LE=F", "HE=F"], "Livestock, feeders skipped when absent");

const html = M.commoditiesHTML(by);
["Energy", "Precious metals", "Base metals", "Softs", "Grains and oilseeds", "Livestock"].forEach(t =>
  assert.ok(html.includes(">" + t + "<"), "subsection " + t));
assert.ok(/id="mkt-cmd"/.test(html) && /id="mkt-cmd-energy"/.test(html) && /id="mkt-cmd-softs"/.test(html), "section anchors");
assert.ok(/data-cmd-per="1W"/.test(html) && /data-cmd-per="1M"/.test(html) && /data-cmd-per="3M"/.test(html) && /data-cmd-per="1Y"/.test(html), "period buttons");
assert.ok(/aria-pressed="true">1M</.test(html), "1M is the default pressed period");
assert.ok(/cmd-tiles/.test(html) && /cot-cells/.test(html) && /cot-open/.test(html), "tile row + cot row + open slot");
assert.ok(/data-cot-ids="brent,wti,ulsd,hh"/.test(html), "first Energy row: Brent WTI ULSD Henry Hub, aligned");
assert.ok(/data-cot-ids=",,,?"/.test(html) || /data-cot-ids="gold,silver,platinum,palladium"/.test(html), "Precious four match");
assert.ok(/data-cot-ids="gold,silver,platinum,palladium"/.test(html), "Precious alignment");
assert.ok(html.includes("data-cot-ids=\"copper,\""), "Base: copper then an empty id so aluminium gets a No CFTC report cell");
assert.ok(!/class="cot-cell cot-na"/.test(html), "placeholder cells are filled after mount, not baked into the section HTML");
assert.ok(!/data-cot-ids=",,,"/.test(html), "no all-empty four-cell band");
assert.ok(/data-cot-extra="gasoil"/.test(html), "gasoil also-reported under Energy");
assert.ok(/data-cot-extra="cocoa_ldn,robusta,white_sugar"/.test(html), "London softs also-reported under Softs");
assert.ok(!/text-overflow:\s*ellipsis/.test(fs.readFileSync(path.join(root, "v2/shared/cot.css"), "utf8").split("cmd-band")[1] || ""), "new cell CSS does not ellipsis names");

/* every commodity tile in the fixture appears once, in its group, and 1D+1M pills show at default period */
assert.ok(html.includes("data-cmd-per=\"1M\"") && (html.match(/class="tile"/g) || []).length >= 28, "all commodity tiles rendered");
assert.ok(/class="k">1D</.test(html) && /class="k">1M</.test(html), "default tiles show 1D and 1M");
assert.ok(!html.includes("Henry Hub gas Dec-26</span>") || html.includes(">Henry Hub<") || html.includes(">Henry Hub</"), "short energy names");
assert.strictEqual(K.tileName({ sym: "BZ=F", name: "Brent crude Jan-27" }), "Brent");
assert.strictEqual(K.tileName({ sym: "PA=F", name: "Palladium Mar-27" }), "Palladium");
assert.strictEqual(K.tileName({ sym: "ALI=F", name: "Aluminium (COMEX) Dec-26" }), "Aluminium");
assert.ok(K.tileName({ sym: "KC=F", name: "Coffee NY (Arabica) Mar-27" }).length <= 12);

/* 3M from monthly candles; period-aware pills and charts */
const brent = by["BZ=F"];
const m3 = K.chg3m(brent);
assert.ok(typeof m3 === "number" && Number.isFinite(m3), "3M computed from monthly candles");
M.setPeriod("3M");
const t3 = K.tile(brent, K.reg("t"), null, { period: "3M" });
assert.ok(/class="k">1D</.test(t3) && /class="k">3M</.test(t3), "3M period shows 1D and 3M pills");
assert.ok(/data-cmd-per="3M"/.test(t3), "tile is marked with the commodities period");
const wChart = K.chart(brent, "1W");
const mChart = K.chart(brent, "1M");
const yChart = K.chart(brent, "1Y");
assert.ok(/daily candles/.test(wChart), "1W uses daily candles");
assert.ok(((wChart.match(/<rect /g) || []).length) === 5, "1W keeps the last five daily candles");
assert.ok(((mChart.match(/<rect /g) || []).length) === 22, "1M keeps the full month of daily candles");
assert.ok(/monthly candles/.test(yChart), "1Y keeps monthly candles");
const qChart = K.chart(brent, "3M");
assert.ok(/<path d="M/.test(qChart) && !/<rect /.test(qChart), "3M is a line (no 3M daily candles in the file)");
M.setPeriod("1M");

/* CFTC cells: same order, placeholder for missing, period-labelled change */
function mkt(id, name, exch, net, wow, hist) {
  const w = (hist || []).map((n, i) => ["2026-0" + (i + 1) + "-01", 100000, n > 0 ? 50000 + n : 50000, n > 0 ? 50000 : 50000 - n]);
  if (!w.length) w.push(["2026-11-10", 100000, 60000, 40000]);
  const last = w[w.length - 1];
  return { id, name, exch, group: "energy", s: { net, net_wow: wow, net_pct_oi: 10, date: "2026-11-10", long: last[2], short: last[3], oi: last[1] }, w };
}
const d = { markets: [
  mkt("brent", "Brent crude", "ICE Futures Europe", 171603, 1200, [160000, 165000, 168000, 170000, 171603]),
  mkt("wti", "WTI crude", "CFTC", 25714, -800, [30000, 28000, 27000, 26500, 25714])
] };
const cells = Cot.cellsHTML(["brent", "wti", null, "copper"], d, "1M");
assert.strictEqual((cells.match(/class="cot-cell/g) || []).length, 4, "four cells including placeholders");
assert.ok(/data-cot="brent"/.test(cells) && /data-cot="wti"/.test(cells), "named cells for the two reports");
assert.strictEqual((cells.match(/class="cot-cell cot-na"/g) || []).length, 2, "placeholder for empty slot and missing copper");
assert.ok(/CFTC 10 Nov/.test(cells) && /ICE 10 Nov/.test(cells), "calm as-of tags");
assert.ok(/class="cot-per-k">1M</.test(cells), "change is labelled with the same period as the tiles");
const wcells = Cot.cellsHTML(["brent"], d, "1W");
assert.ok(/class="cot-per-k">w\/w</.test(wcells), "1W change is labelled w/w");
assert.strictEqual(Cot.weeksOf("1W"), 1);
assert.strictEqual(Cot.weeksOf("1M"), 4);
assert.strictEqual(Cot.weeksOf("3M"), 13);
assert.strictEqual(Cot.weeksOf("1Y"), 52);
assert.ok(Number.isFinite(Cot.netDelta(d.markets[0], "1M")), "net change over 1M (4 reports)");

/* cache-bust */
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const tbl = fs.readFileSync(path.join(root, "table.js"), "utf8");
assert.ok(/kit\.js\?v=20261120cmd1/.test(idx) && /cot\.js\?v=20261120cmd1/.test(idx) && /cot\.css\?v=20261120cmd1/.test(idx), "kit/cot cache-busted");
assert.ok(/candles\.js\?v=20261120cmd1/.test(idx) && /markets\/live\.css\?v=20261120cmd1/.test(idx), "candles and markets css cache-busted");
assert.ok(/markets\.js\?v=20261120cmd1/.test(tbl), "markets.js cache-busted in the loader");
assert.ok(!/nav-dock|bottom-nav|phone-tab/.test(fs.readFileSync(path.join(root, "v2/markets/markets.js"), "utf8")), "commodities change does not touch the phone nav");

console.log("markets commodities grouping and CFTC alignment: PASS");
