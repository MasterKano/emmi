/* Mining tiles price the Stockholm line, and share prices carry the trading currency.
   A missing Stockholm quote stays blank. Toronto is not relabelled as Stockholm. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

const window = {};
const context = { window: window, document: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(read("v2/companies/listing.js"), context);
vm.runInContext(read("v2/shared/ui.js"), context);
context.window.MMV2 = context.window.MMV2;
vm.runInContext(read("v2/companies/tiles.js"), context);
const L = context.window.MMListing;
const U = context.window.MMV2;
const tiles = context.window.MMV2Tiles;

function tileOf(company, map) {
  return tiles.tile(company, map || {});
}

assert.strictEqual(L.ccyLabel("GBp"), "GBp");
assert.strictEqual(L.ccyLabel("GBX"), "GBp");
assert.strictEqual(L.ccyLabel("SEK"), "SEK");
assert.strictEqual(L.ccyLabel("NOK"), "NOK");
assert.strictEqual(L.ccyLabel("USD"), "USD");
assert.strictEqual(L.ccyLabel("EUR"), "EUR");
assert.strictEqual(L.ccyLabel(""), "");
assert.strictEqual(L.ccyLabel(null), "");

assert.ok(U.pxText(223.83, "GBp").endsWith("GBp"), U.pxText(223.83, "GBp"));
assert.ok(!/\dp$/.test(U.pxText(223.83, "GBp")), U.pxText(223.83, "GBp"));
assert.ok(U.pxText(210.5, "SEK").endsWith("SEK"));
assert.ok(U.pxText(20.7, "NOK").endsWith("NOK"));
assert.ok(U.pxText(191.2, "USD").endsWith("USD"));
assert.ok(U.pxText(12.5, "EUR").endsWith("EUR"));
assert.strictEqual(U.pxText(1.774, "SEK").endsWith("SEK"), true);
assert.strictEqual(U.pxText(null, "SEK"), null);
assert.ok(!/\b(SEK|GBp|NOK|USD|EUR|CAD)\b/.test(U.pxText(10, null)), U.pxText(10, null));

const toronto = { sym: "LUN.TO", px: 30.56, ccy: "CAD", pct: { "1D": -0.6 } };
const stockholm = { sym: "LUMI.ST", px: 210.5, ccy: "SEK", pct: { "1D": 1.2 }, mcap_eur: 1.5e10, ev_eur: 1.7e10 };
assert.strictEqual(L.quoteRow("LUMI.ST", null, { "LUMI.ST": stockholm, "LUN.TO": toronto }, toronto).ccy, "SEK");
assert.strictEqual(L.quoteRow("LUMI.ST", null, { "LUN.TO": toronto }, toronto), null);
assert.strictEqual(L.quoteRow("LUMI.ST", toronto, { "LUMI.ST": stockholm }, null).sym, "LUMI.ST");

const lun = tileOf(
  { yahoo: "LUN.TO", short: "Lundin Mining", company: "Lundin Mining", exchange_ticker: "LUN" },
  { "LUN.TO": toronto, "LUMI.ST": stockholm }
);
assert.ok(lun.includes("LUMI.ST"), lun);
assert.ok(lun.includes("SEK"), lun);
assert.ok(lun.includes("v2co-ccy"), lun);
assert.ok(!lun.includes("LUN.TO"), lun);
assert.ok(!lun.includes("30.56"), lun);
assert.ok(!/Toronto/i.test(lun), lun);
assert.ok(lun.includes('href="#co=LUMI.ST"'), lun);
assert.ok(lun.includes("finance.yahoo.com/quote/LUMI.ST"), lun);
assert.strictEqual(tiles.quoteFor({ "LUN.TO": toronto }, "LUMI.ST").row, null);

[["LUG.TO", "Lundin Gold"], ["LUC.TO", "Lucara Diamond"]].forEach(([sym, name]) => {
  const live = L.miningCompany({ yahoo: sym, short: name, company: name, exchange_ticker: sym.split(".")[0] });
  assert.ok(live.yahoo.endsWith(".ST"), sym);
  assert.ok(!live.yahoo.endsWith(".TO"), sym);
  const html = tileOf({ yahoo: sym, short: name, company: name, exchange_ticker: sym.split(".")[0] }, {});
  assert.ok(html.includes(live.yahoo), html);
  assert.ok(html.includes("og-na"), html);
  assert.ok(!html.includes(sym), html);
  assert.ok(!/Toronto/i.test(html), html);
});

[["NGEX.TO", "NGEx Minerals"], ["MAU.TO", "Montage Gold"], ["LUNR.TO", "LunR Royalties"]].forEach(([sym, name]) => {
  const html = tileOf(
    { yahoo: sym, short: name, company: name, exchange_ticker: sym.split(".")[0] },
    { [sym]: { sym: sym, px: 27.17, ccy: "CAD", pct: { "1D": -1 } } }
  );
  assert.ok(html.includes("No Stockholm listing"), sym);
  assert.ok(html.includes("n/a"), sym);
  assert.ok(!html.includes("27.17"), sym + " kept the Toronto price");
  assert.ok(!html.includes(sym), sym);
  assert.ok(!/Toronto|\.TO/.test(html), html);
});

const ser = tileOf(
  { yahoo: "SER.L", short: "Serica Energy", company: "Serica Energy", exchange_ticker: "SER" },
  { "SER.L": { sym: "SER.L", px: 223.83, ccy: "GBp", pct: { "1D": -1.3 }, mcap_eur: 1e9, ev_eur: 1e9 } }
);
assert.ok(ser.includes("GBp"), ser);
assert.ok(ser.includes("v2co-ccy"), ser);
assert.ok(!ser.includes("SQZ.L"), ser);
assert.ok(ser.includes('href="#co=SER.L"'), ser);

const ipc = tileOf(
  { yahoo: "IPCO.ST", short: "International Petroleum", company: "International Petroleum", exchange_ticker: "IPCO" },
  { "IPCO.ST": { sym: "IPCO.ST", px: 267.6, ccy: "SEK", pct: { "1D": 0.7 } }, "IPCO.TO": { sym: "IPCO.TO", px: 37.82, ccy: "CAD", pct: { "1D": 0.2 } } }
);
assert.ok(ipc.includes("SEK"), ipc);
assert.ok(ipc.includes('href="#co=IPCO.ST"'), ipc);
assert.ok(!ipc.includes("IPCO.TO"), ipc);
assert.ok(!ipc.includes("37.82"), ipc);

const eq = tileOf(
  { yahoo: "EQNR.OL", short: "Equinor", company: "Equinor", exchange_ticker: "EQNR" },
  { "EQNR.OL": { sym: "EQNR.OL", px: 401.3, ccy: "NOK", pct: { "1D": 1.5 } } }
);
assert.ok(eq.includes("NOK"), eq);

const uni = read("scripts/universe.py");
const at = uni.indexOf("LUNDIN_MINING_V2");
const block = uni.slice(at, uni.indexOf("])])", at) + 3);
assert.ok(block.includes('"LUMI.ST"') && block.includes('"LUG.ST"') && block.includes('"LUC.ST"'), block);
assert.ok(!block.includes(".TO"), block);

const build = read("scripts/build_data.py");
assert.ok(build.includes("def mining_quote_specs"));
assert.ok(build.includes("def quote_specs"));
assert.ok(build.includes("gap_specs() + mining_quote_specs()"));

const company = read("company.js");
assert.ok(company.includes("quoteRow(cur)"));
assert.ok(company.includes("MMListing.quoteRow"));
assert.ok(company.includes("data/og-quotes.json"));
assert.ok(company.includes('class="co-ccy"'));
assert.ok(!company.includes("r.px:c&&c.px"), "profile price must not fall through to another listing");

console.log("Stockholm listings and share-price currencies: PASS");
