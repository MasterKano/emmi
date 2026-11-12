/* Wind speed and temperature use a 7-day trailing mean of the daily series.
   Rain, day-ahead prices and generation keep their published 30-day window. */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "v2/power/v2.js"), "utf8");
const sandbox = { window: {}, document: { getElementById: () => null, querySelector: () => null }, Map, Intl, Date };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const P = sandbox.window.MMV2Power;

function iso(start, i) {
  const [y, m, d] = start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
}
function mean(nums) { return nums.reduce((s, n) => s + n, 0) / nums.length; }

const rows = [];
for (let i = 0; i < 10; i++) rows.push([iso("2026-02-24", i), i + 1, 999, 0.5, 888]);
const asOf = rows[9][0];
assert.equal(asOf, "2026-03-05");
const poisoned = { value: 999, normal: 888, difference: 111, difference_pct: 50 };

assert.equal(P.wxDays("wind100"), 7);
assert.equal(P.wxDays("temp"), 7);
assert.equal(P.wxDays("rain"), 30);
assert.equal(P.wxDays("hydro"), 30);
assert.equal(P.wxDays("price"), 30);

const wind = P.weatherView("wind100", { as_of: asOf, rows: rows, summary: poisoned });
assert.equal(wind.short, "7d Avg");
assert.equal(wind.tip, "7d Avg");
assert.equal(wind.prose, "7-day average");
assert.equal(wind.aria, "7-day average");
assert.equal(wind.value, mean([4, 5, 6, 7, 8, 9, 10]));
assert.equal(wind.normal, 0.5);
assert.equal(wind.difference, wind.value - 0.5);
assert.equal(wind.pct, (wind.value / 0.5 - 1) * 100);
assert.equal(wind.seriesAvg[9], wind.value);
assert.equal(wind.seriesAvg[6], mean([1, 2, 3, 4, 5, 6, 7]));
assert.equal(wind.seriesAvg[5], null);
assert.ok(wind.seriesAvg.every(v => v !== 999));
assert.ok(wind.seriesNorm.every(v => v == null || v === 0.5));
assert.notEqual(wind.value, poisoned.value);

const temp = P.weatherView("temp", { as_of: asOf, rows: rows, summary: poisoned });
assert.equal(temp.days, 7);
assert.equal(temp.short, "7d Avg");
assert.equal(temp.prose, "7-day average");
assert.equal(temp.value, wind.value);
assert.equal(temp.seriesNorm[9], 0.5);

const gapped = rows.map(r => r.slice());
gapped[7][1] = null;
const gap = P.weatherView("wind100", { as_of: asOf, rows: gapped, summary: poisoned });
assert.equal(gap.value, null);
assert.equal(gap.seriesAvg[9], null);
assert.equal(gap.seriesAvg[6], mean([1, 2, 3, 4, 5, 6, 7]));

const flat = [];
for (let i = 0; i < 30; i++) flat.push([iso("2026-01-01", i), i === 29 ? 30 : 0, 0, 1, 1]);
assert.equal(P.trailingMean(flat, flat[29][0], 30, 1), 1);
assert.equal(P.trailingMean(flat, flat[29][0], 7, 1), 30 / 7);
assert.equal(P.trailingMean(flat, flat[6][0], 7, 1), 0);
assert.equal(P.trailingMean(flat, flat[5][0], 7, 1), null);

const rain = P.weatherView("rain", { as_of: asOf, rows: rows, summary: { value: 2.5, normal: 2, difference: 0.5, difference_pct: 25 } });
assert.equal(rain.days, 30);
assert.equal(rain.short, "30-day avg");
assert.equal(rain.tip, "30-day");
assert.equal(rain.prose, "30-day average");
assert.equal(rain.aria, "30-day average");
assert.equal(rain.value, 2.5);
assert.equal(rain.normal, 2);
assert.equal(rain.difference, 0.5);
assert.equal(rain.pct, 25);
assert.equal(rain.seriesAvg[9], 999);
assert.equal(rain.seriesNorm[9], 888);
assert.notEqual(rain.value, mean([4, 5, 6, 7, 8, 9, 10]));

function sliceFn(name, next) {
  const start = code.indexOf("function " + name);
  const end = code.indexOf("function " + next);
  assert.ok(start >= 0 && end > start, name);
  return code.slice(start, end);
}
const weather = sliceFn("weatherBlock", "generationBlock");
assert.ok(weather.includes("weatherView(metric, M)"));
assert.ok(weather.includes("view.short"));
assert.ok(weather.includes("view.prose"));
assert.ok(weather.includes("view.tip"));
assert.ok(weather.includes("six days before"));
assert.ok(!weather.includes("30-day"), "weather block must not hard-code a 30-day label");
assert.ok(!weather.includes("7d Avg"), "the 7d Avg label is produced by wxCopy");

const price = sliceFn("priceBlock", "wxDays");
assert.ok(price.includes('maLine("30-day avg"'));
assert.ok(price.includes('t: "30-day avg"'));
assert.ok(price.includes('name: "30-day"'));
assert.ok(price.includes("· 30-day "));
assert.ok(!price.includes("7d Avg"));
assert.ok(!price.includes("weatherView"));

const generation = sliceFn("generationBlock", "hydroBlock");
assert.ok(generation.includes("30-day avg"));
assert.ok(generation.includes("30-day average"));
assert.ok(generation.includes("same 30 days"));
assert.ok(generation.includes("finite(r[2])"));
assert.ok(!generation.includes("7d Avg"));
assert.ok(!generation.includes("weatherView"));

const monthly = sliceFn("monthlyBlock", "yearChart");
assert.ok(monthly.includes('["wind100", "Wind 100 m"'));
assert.ok(monthly.includes('["temp", "Temperature"'));
assert.ok(!monthly.includes("7d Avg"));
assert.ok(!monthly.includes("weatherView"));
assert.ok(!monthly.includes("30-day avg"));

console.log("Wind and temperature use a 7-day window; rain, price and generation stay on 30 days: PASS");
