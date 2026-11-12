/* Jump search finds the six Lundin mining names and opens the Mining tile.
   A Stockholm line also opens that profile. A name with no Stockholm line
   stays on the blank tile. Unconfirmed names stay out of the index. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

const NAMES = [
  ["Lundin Mining", "mn-lundin-mining", "LUMI.ST", "LUN.TO"],
  ["Lundin Gold", "mn-lundin-gold", "LUG.ST", "LUG.TO"],
  ["NGEx Minerals", "mn-ngex-minerals", null, "NGEX.TO"],
  ["Lucara Diamond", "mn-lucara-diamond", "LUC.ST", "LUC.TO"],
  ["Montage Gold", "mn-montage-gold", null, "MAU.TO"],
  ["LunR Royalties", "mn-lunr-royalties", null, "LUNR.TO"]
];
const LEFT_OUT = ["Faraday", "Fireweed", "Valiente"];

function loadSearch() {
  const timers = [];
  const context = {
    window: {},
    document: { getElementById() { return null; }, querySelectorAll() { return []; } },
    setInterval(fn) {
      const rec = { on: true };
      for (let i = 0; i < 80 && rec.on; i++) fn();
      timers.push(rec);
      return rec;
    },
    clearInterval(rec) { if (rec) rec.on = false; }
  };
  vm.createContext(context);
  vm.runInContext(read("search.js"), context);
  return context.window.MMJump;
}

function loadTiles() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("v2/companies/listing.js"), context);
  context.window.MMV2 = {
    esc: s => String(s == null ? "" : s),
    finite: v => typeof v === "number" && Number.isFinite(v),
    pxText: (px, ccy) => (px == null ? null : px + " " + (ccy || "")),
    pill: t => String(t),
    signed: v => String(v),
    money: () => ""
  };
  vm.runInContext(read("v2/companies/tiles.js"), context);
  return context.window.MMV2Tiles;
}

const jump = loadSearch();
const found = q => Array.from(jump.find(q), x => [String(x[0]), String(x[1]), String(x[2]), x[3] == null ? "" : String(x[3]), x[4] == null ? undefined : String(x[4])]);
const labels = q => found(q).map(x => x[0]);
const row = (q, name) => found(q).find(x => x[0] === name);

const lundin = labels("Lundin");
assert.deepStrictEqual(lundin, [
  "Lundin companies",
  "Lundin Mining",
  "Lundin Gold",
  "NGEx Minerals",
  "Lucara Diamond",
  "Montage Gold",
  "LunR Royalties"
]);

const group = row("Lundin", "Lundin companies");
assert.strictEqual(group[1], "mining");
assert.strictEqual(group[2], "mnLundin");
assert.strictEqual(group[4], undefined);

NAMES.forEach(([name, id, profile, toronto]) => {
  const hit = row("Lundin", name);
  assert.ok(hit, name + " missing from Lundin");
  assert.strictEqual(hit[1], "mining", name);
  assert.strictEqual(hit[2], id, name);
  assert.strictEqual(hit[4], profile || undefined, name);
  assert.ok(!String(hit[2]).includes(".TO"), name);
  assert.ok(!String(hit[4] || "").includes(".TO"), name);
  assert.ok(!/toronto|\.TO/i.test(hit[3]), name + " keywords: " + hit[3]);
  assert.ok(!labels(name).includes(toronto), name);
  const exact = found(name);
  assert.strictEqual(exact[0][0], name, labels(name).join(" | "));
  assert.strictEqual(exact[0][2], id);
  assert.strictEqual(exact[0][4], profile || undefined);
});

assert.deepStrictEqual(labels("Lundin Mining").slice(0, 1), ["Lundin Mining"]);
assert.deepStrictEqual(labels("LUMI"), ["Lundin Mining"]);
assert.deepStrictEqual(labels("LUMI.ST"), ["Lundin Mining"]);
assert.deepStrictEqual(labels("Lundin Gold").slice(0, 1), ["Lundin Gold"]);
assert.deepStrictEqual(labels("LUG"), ["Lundin Gold"]);
assert.deepStrictEqual(labels("LUG.ST"), ["Lundin Gold"]);
assert.deepStrictEqual(labels("Lucara"), ["Lucara Diamond"]);
assert.deepStrictEqual(labels("LUC"), ["Lucara Diamond"]);
assert.deepStrictEqual(labels("LUC.ST"), ["Lucara Diamond"]);
assert.deepStrictEqual(labels("NGEx"), ["NGEx Minerals"]);
assert.deepStrictEqual(labels("NGEX"), ["NGEx Minerals"]);
assert.deepStrictEqual(labels("Montage"), ["Montage Gold"]);
assert.deepStrictEqual(labels("MAU"), ["Montage Gold"]);
assert.deepStrictEqual(labels("LunR"), ["LunR Royalties"]);
assert.deepStrictEqual(labels("LUNR"), ["LunR Royalties"]);

["LUMI", "LUG", "NGEx", "Montage", "LunR"].forEach(q => {
  found(q).forEach(x => {
    assert.strictEqual(x[1], "mining", q);
    assert.notStrictEqual(x[1], "equities", q);
  });
});

assert.ok(labels("hydro").includes("Hydro reservoirs"));
assert.strictEqual(row("hydro", "Hydro reservoirs")[1], "power");
assert.strictEqual(row("hydro", "Hydro reservoirs")[2], "pwSecHyd");
assert.ok(labels("SE4").includes("SE4 focus"));
assert.strictEqual(row("SE4", "SE4 focus")[2], "pwSecSE4");
assert.ok(labels("CAPE").includes("US stock valuations"));
assert.strictEqual(row("companies", "Oil and gas companies")[1], "oilgas");
assert.strictEqual(row("companies", "Oil and gas companies")[2], "ogCos");
assert.ok(labels("companies").indexOf("Oil and gas companies") < labels("companies").indexOf("Lundin companies"));

const src = read("search.js");
assert.ok(src.includes('equities:"Companies"'), "Companies label stays on the unused equities key");
assert.ok(!src.includes('"equities",'), "Jump must not target the Companies tab");
LEFT_OUT.forEach(name => {
  assert.ok(!src.toLowerCase().includes(name.toLowerCase()), name + " is in search.js");
  assert.deepStrictEqual(labels(name), [], name);
});
assert.ok(!src.includes("SQZ"));
assert.ok(!src.includes("IPCO.TO"));
assert.ok(!src.includes("SNM.OL"));

const listing = read("v2/companies/listing.js");
assert.ok(listing.includes('"SER.L": "SQZ.L"'));
assert.ok(listing.includes('"SNM-SDB.ST": "SNM.OL"'));
assert.ok(listing.includes('"IPCO.ST": "IPCO.TO"'));
assert.ok(listing.includes('"LUMI.ST"'));
assert.ok(!listing.includes("Faraday") && !listing.includes("Fireweed") && !listing.includes("Valiente"));

const tiles = loadTiles();
const stockholm = { sym: "LUMI.ST", px: 210.5, ccy: "SEK", pct: { "1D": 1.2 } };
NAMES.forEach(([name, id, profile, toronto]) => {
  assert.strictEqual(tiles.mineTileId({ company: name }), id);
  const quote = { [toronto]: { sym: toronto, px: 27.17, ccy: "CAD", pct: { "1D": -1 } } };
  if (profile === "LUMI.ST") quote["LUMI.ST"] = stockholm;
  const html = tiles.tile({ yahoo: toronto, company: name, exchange_ticker: toronto.split(".")[0] }, quote, id);
  assert.ok(html.includes('id="' + id + '"'), html);
  if (profile) {
    assert.ok(html.includes('href="#co=' + profile + '"'), html);
    assert.ok(html.includes(profile), html);
    assert.ok(!html.includes(toronto), name + " still names the Toronto line");
    assert.ok(!/Toronto/i.test(html), html);
  } else {
    assert.ok(html.includes("No Stockholm listing"), html);
    assert.ok(html.includes(">n/a<"), html);
    assert.ok(!html.includes("#co="), name + " blank tile opens a profile");
    assert.ok(!html.includes("27.17"), name + " kept a Toronto price");
    assert.ok(!html.includes(toronto), html);
    assert.ok(!/Toronto/i.test(html), html);
  }
});

const lumi = tiles.tile(
  { yahoo: "LUN.TO", company: "Lundin Mining", exchange_ticker: "LUN" },
  { "LUN.TO": { sym: "LUN.TO", px: 30.56, ccy: "CAD", pct: { "1D": -0.6 } }, "LUMI.ST": stockholm },
  "mn-lundin-mining"
);
assert.ok(lumi.includes("SEK"), lumi);
assert.ok(!lumi.includes("30.56"), lumi);
assert.ok(!lumi.includes("CAD"), lumi);

function openCalls(present, entry) {
  const calls = [];
  const nodes = {};
  present.forEach(id => {
    nodes[id] = {
      id: id,
      offsetParent: {},
      classList: { add(c) { this.on = c; }, remove() {}, contains() { return false; } }
    };
  });
  const nav = { go(tab) { calls.push(["nav", tab]); } };
  const ui = { go(id) { calls.push(["ui", id]); } };
  const company = { open(sym) { calls.push(["co", sym]); } };
  const pending = [];
  const context = {
    window: { MMNav: nav, MMUI: ui, MMCompany: company },
    MMNav: nav,
    MMUI: ui,
    MMCompany: company,
    document: {
      getElementById(id) { return nodes[id] || null; },
      querySelectorAll() { return []; }
    },
    setInterval(fn) {
      const rec = { on: true };
      pending.push(() => { for (let i = 0; i < 80 && rec.on; i++) fn(); });
      return rec;
    },
    clearInterval(rec) { if (rec) rec.on = false; }
  };
  vm.createContext(context);
  vm.runInContext(read("search.js"), context);
  context.window.MMJump.open(entry);
  pending.forEach(run => run());
  return { calls: calls, tile: nodes };
}

const mining = row("LUMI", "Lundin Mining");
const opened = openCalls(["mn-lundin-mining"], mining);
assert.deepStrictEqual(opened.calls, [["nav", "mining"], ["ui", "mn-lundin-mining"], ["co", "LUMI.ST"]]);
assert.strictEqual(opened.tile["mn-lundin-mining"].classList.on, "is-jump");

const ngex = row("NGEx", "NGEx Minerals");
assert.deepStrictEqual(openCalls(["mn-ngex-minerals"], ngex).calls, [["nav", "mining"], ["ui", "mn-ngex-minerals"]]);

const late = openCalls(["mnLundin"], mining);
assert.deepStrictEqual(late.calls, [["nav", "mining"], ["ui", "mnLundin"], ["co", "LUMI.ST"]]);
assert.deepStrictEqual(openCalls(["mnLundin"], ngex).calls, [["nav", "mining"], ["ui", "mnLundin"]]);
assert.deepStrictEqual(openCalls([], ngex).calls, [["nav", "mining"]]);

const gold = row("LUG", "Lundin Gold");
assert.deepStrictEqual(openCalls(["mn-lundin-gold"], gold).calls[2], ["co", "LUG.ST"]);
const luc = row("LUC", "Lucara Diamond");
assert.deepStrictEqual(openCalls(["mn-lucara-diamond"], luc).calls[2], ["co", "LUC.ST"]);

console.log("Lundin jump search: PASS");
