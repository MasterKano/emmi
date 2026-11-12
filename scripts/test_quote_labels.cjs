/* Labels stay truthful across Zurich midnight and market closures.
   Fails if a non-today delivery is called Today, a futures quote is called spot,
   or a file refresh time is used as an instrument observation. */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "v2/shared/labels.js"), "utf8");
const sandbox = { window: {}, Intl, Date };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const L = sandbox.window.MMLabels;

const morning = new Date("2026-11-12T08:00:00+01:00");
const justAfter = new Date("2026-11-13T00:05:00+01:00");
const utcAlreadyNext = new Date("2026-11-12T23:30:00Z");
const stillTwelfth = new Date("2026-11-12T22:30:00Z");
const fridayEvening = new Date("2026-11-13T20:30:00+01:00");
const saturday = new Date("2026-11-14T18:00:00+01:00");
const sunday = new Date("2026-11-15T11:00:00+01:00");
const FILE = "2026-11-12T11:17:26+01:00";
const fileClock = L.quoteWhen({ market_time: FILE }).text;

function byDelivery(figs) {
  const o = {};
  figs.forEach(f => { o[f.delivery] = f; });
  return o;
}
function noRelative(figs) {
  figs.forEach(f => {
    assert.ok(!/yesterday/i.test(f.label), f.label);
    assert.ok(f.detail.indexOf("delivery " + L.dlab(f.delivery)) === 0, f.detail);
    assert.ok(f.detail.indexOf("no quote time") >= 0, f.detail);
    assert.ok(!/spot/i.test(f.label + f.detail), f.detail);
  });
}
function notFile(text) {
  assert.ok(text.indexOf("11:17") < 0, text);
  assert.ok(text.indexOf(FILE) < 0, text);
  assert.ok(text.indexOf(fileClock) < 0, text);
}

assert.equal(L.zurichDate(morning), "2026-11-12");
assert.equal(L.deliveryLabel("2026-11-11", morning), "11 Nov 2026");
assert.notEqual(L.deliveryLabel("2026-11-11", morning), "Today");
assert.notEqual(L.deliveryLabel("2026-11-11", morning), "Yesterday");

const jerry = L.dayAheadFigures("2026-11-11", "234.6", "2026-11-12", "144.5", morning);
const j = byDelivery(jerry);
assert.equal(j["2026-11-11"].label, "11 Nov 2026");
assert.equal(j["2026-11-12"].label, "Today");
assert.ok(j["2026-11-12"].detail.indexOf("delivery 12 Nov 2026") === 0);
assert.ok(!jerry.some(f => f.label === "Tomorrow"));
noRelative(jerry);
const jerryHtml = L.figuresHtml(jerry);
assert.ok(!/hero-k">Today<\/div><div class="hero-num">234\.6/.test(jerryHtml));
assert.ok(/hero-k">Today<\/div><div class="hero-num">144\.5/.test(jerryHtml));
assert.ok(/hero-k">11 Nov 2026<\/div><div class="hero-num">234\.6/.test(jerryHtml));
assert.ok(jerryHtml.indexOf(">Today<") < jerryHtml.indexOf("234.6"));

const onlyStale = L.dayAheadFigures("2026-11-11", "234.6", "2026-11-12", null, morning);
assert.equal(onlyStale.length, 1);
assert.equal(onlyStale[0].label, "11 Nov 2026");
assert.ok(!/Today|Tomorrow/.test(L.figuresHtml(onlyStale)));

assert.equal(L.zurichDate(justAfter), "2026-11-13");
assert.equal(L.zurichDate(utcAlreadyNext), "2026-11-13");
const flipped = L.dayAheadFigures("2026-11-12", "144.5", "2026-11-13", "100.0", justAfter);
const f = byDelivery(flipped);
assert.equal(f["2026-11-13"].label, "Today");
assert.equal(f["2026-11-12"].label, "12 Nov 2026");
assert.notEqual(f["2026-11-12"].label, "Today");
assert.notEqual(f["2026-11-12"].label, "Tomorrow");
noRelative(flipped);
const held = L.dayAheadFigures("2026-11-11", "234.6", "2026-11-12", "144.5", utcAlreadyNext);
assert.ok(!held.some(f => f.label === "Today" || f.label === "Tomorrow"));
assert.equal(byDelivery(held)["2026-11-12"].label, "12 Nov 2026");
assert.equal(L.deliveryLabel("2026-11-12", stillTwelfth), "Today");
assert.equal(L.deliveryLabel("2026-11-13", stillTwelfth), "Tomorrow");

assert.equal(L.zurichDate(fridayEvening), "2026-11-13");
const weekendGap = L.dayAheadFigures("2026-11-13", "80.0", "2026-11-15", "70.0", fridayEvening);
const w = byDelivery(weekendGap);
assert.equal(w["2026-11-13"].label, "Today");
assert.equal(w["2026-11-15"].label, "15 Nov 2026");
assert.notEqual(w["2026-11-15"].label, "Tomorrow");
noRelative(weekendGap);
const satFigs = L.dayAheadFigures("2026-11-13", "80.0", "2026-11-14", "60.0", saturday);
assert.equal(byDelivery(satFigs)["2026-11-13"].label, "13 Nov 2026");
assert.equal(byDelivery(satFigs)["2026-11-14"].label, "Today");
assert.ok(!satFigs.some(f => f.label === "Tomorrow"));
const sunFigs = L.dayAheadFigures("2026-11-13", "80.0", null, null, sunday);
assert.equal(sunFigs.length, 1);
assert.equal(sunFigs[0].label, "13 Nov 2026");
assert.ok(!/Today|Tomorrow/.test(sunFigs[0].label));

const sp = L.tileMeta({
  sym: "^GSPC", name: "S&P 500", kind: "index",
  market_time: "2026-11-11T21:42:03+00:00", bar_date: "2026-11-11",
  generated_cet: FILE, generated_utc: "2026-11-12T10:17:26+00:00"
});
assert.ok(sp.indexOf("11 Nov 2026, 22:42") >= 0, sp);
notFile(sp);
assert.ok(!/\bspot\b/i.test(sp) && !/\bfutures\b/i.test(sp), sp);

const yieldRow = L.tileMeta({
  sym: "^TNX", kind: "yield", name: "US 10Y yield", bar_date: "2026-11-10",
  official: { asof: "2026-11-10" }, generated_cet: FILE
});
assert.ok(yieldRow.indexOf("10 Nov 2026") >= 0, yieldRow);
assert.ok(yieldRow.indexOf("no quote time") >= 0, yieldRow);
notFile(yieldRow);
assert.ok(!/\bspot\b|\bfutures\b/i.test(yieldRow), yieldRow);

const poisoned = L.tileMeta({
  sym: "BZ=F", kind: "future", name: "Brent crude Jan-27",
  contract: { month: "Jan-27", expiry: "2026-11-30" },
  generated_cet: FILE, generated_utc: "2026-11-12T10:17:26+00:00"
});
assert.ok(poisoned.indexOf("quote time not available") >= 0, poisoned);
assert.ok(poisoned.indexOf("Jan-27") >= 0, poisoned);
assert.ok(poisoned.indexOf("futures") >= 0, poisoned);
assert.ok(!/\bspot\b/i.test(poisoned), poisoned);
notFile(poisoned);

const ttf = {
  sym: "TTF=F", kind: "future", name: "Dutch TTF gas Dec-26",
  market_time: "2026-11-12T08:39:32+00:00", bar_date: "2026-11-12",
  contract: { sym: "TTFZ26.NYM", month: "Dec-26", expiry: "2026-11-27", cont: "TTF=F" },
  generated_cet: FILE
};
const g = L.gasQuote(ttf);
assert.equal(g.kicker, "TTF futures");
assert.equal(g.future, true);
assert.equal(g.spot, false);
assert.ok(g.detail.indexOf("Dec-26") >= 0, g.detail);
assert.ok(g.detail.indexOf("12 Nov 2026, 09:39") >= 0, g.detail);
assert.ok(!/\bspot\b/i.test(g.kicker + " " + g.detail + " " + g.sub + " " + g.note), g.kicker);
notFile(g.detail);
const namedSpot = L.gasQuote({ sym: "TTF=F", kind: "future", name: "Dutch TTF spot", generated_cet: FILE });
assert.equal(namedSpot.kicker, "TTF futures");
assert.ok(!/\bspot\b/i.test(namedSpot.kicker + namedSpot.sub + namedSpot.note));
const tileTtf = L.tileMeta(ttf);
assert.ok(tileTtf.indexOf("futures") >= 0 && tileTtf.indexOf("Dec-26") >= 0, tileTtf);
assert.ok(!/\bspot\b/i.test(tileTtf), tileTtf);
notFile(tileTtf);

const genuine = L.gasQuote({ sym: "TTFDA", kind: "spot", name: "TTF day-ahead spot", bar_date: "2026-11-12" });
assert.equal(genuine.kicker, "TTF spot");
assert.equal(genuine.spot, true);
assert.ok(genuine.detail.indexOf("no quote time") >= 0);

const fut = L.futuresBits("Dec-26", "2026-11-10");
assert.equal(fut.kind, "futures");
assert.equal(fut.name, "Dec-26");
assert.ok(fut.when.indexOf("10 Nov 2026") >= 0, fut.when);
assert.ok(fut.when.indexOf("no quote time") >= 0, fut.when);
assert.ok(!/spot/i.test(fut.kind + fut.when));
const built = L.futuresBits("Dec-26", "2026-11-11T23:15:58+01:00");
assert.ok(built.when.indexOf("23:15") < 0, built.when);
assert.ok(built.when.indexOf("no quote time") >= 0);
assert.equal(L.futuresBits(null, null).name, "contract not available");
assert.ok(!/Today|Tomorrow/.test(L.figuresHtml([])));

const v2 = fs.readFileSync(path.join(root, "v2/power/v2.js"), "utf8");
const markets = fs.readFileSync(path.join(root, "v2/markets/markets.js"), "utf8");
const gas = fs.readFileSync(path.join(root, "gas.js"), "utf8");
const table = fs.readFileSync(path.join(root, "table.js"), "utf8");
assert.ok(v2.indexOf("MMLabels.dayAheadFigures") >= 0);
assert.ok(v2.indexOf("MMLabels.figuresHtml") >= 0);
assert.ok(v2.indexOf("MMLabels.futuresBits") >= 0);
assert.ok(v2.indexOf('hero-k">Today') < 0);
assert.ok(v2.indexOf('hero-k">Tomorrow') < 0);
assert.ok(!/dayAheadFigures\([^)]*built_at/.test(v2));
assert.ok(!/futuresBits\([^)]*built_at/.test(v2));
assert.ok(v2.indexOf('class="spot"') < 0);
const tileFn = markets.slice(markets.indexOf("function tile"), markets.indexOf("const MOVED"));
assert.ok(tileFn.indexOf("MMLabels.tileMeta") >= 0);
assert.ok(tileFn.indexOf("generated_") < 0);
assert.ok(!/\bas of\b/.test(tileFn));
assert.ok(markets.indexOf('class="asof">as of') < 0);
assert.ok(gas.indexOf("Dutch TTF spot") < 0);
assert.ok(gas.indexOf("MMLabels.gasQuote") >= 0);
assert.ok(table.indexOf("MMLabels.gasQuote") >= 0);
assert.ok(table.indexOf("Dutch TTF spot") < 0);
assert.ok(table.indexOf('og-k">TTF<') < 0);

console.log("Quote labels stay truthful across Zurich midnight and market closures: PASS");
