const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "../v2/power/v2.js"), "utf8");
const sandbox = {
  window: {},
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ querySelector() { return null; }, insertAdjacentHTML() {}, appendChild() {} }),
  },
  localStorage: { getItem: () => null, setItem() {} },
  Intl, Date, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat, console,
  ResizeObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
};
sandbox.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const M = sandbox.window.MMV2Power;
assert.ok(M, "MMV2Power not exported");
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg || (JSON.stringify(a) + " != " + JSON.stringify(b)));

// 1. Tight axis: 234 is below 250, last tick is 250, no wasted 300 line.
const sc = M.axisScale([8.6, 234.58, 144.45], true);
assert.strictEqual(sc.hi, 250, "axis top for 234.58 should be 250, got " + sc.hi);
assert.strictEqual(sc.lo, 0);
assert.ok(sc.tk.includes(250));
assert.ok(!sc.tk.includes(300), "no wasted 300 line: " + sc.tk);

// 80 should not be forced up to 250, and should not jump to 100.
const sc80 = M.axisScale([10, 80], true);
assert.strictEqual(sc80.hi, 80, "axis top for 80 should be 80, got " + sc80.hi);

// Just over 250 uses the next nice tick, not 250.
const sc251 = M.axisScale([10, 251], true);
assert.ok(sc251.hi >= 251);
assert.strictEqual(sc251.hi, 300, "axis top for 251 should be 300, got " + sc251.hi);

// 2. Rolling three months inclusive of the end date.
const days = [];
for (let t = Date.UTC(2026, 6, 12); t <= Date.UTC(2026, 10, 12); t += 86400000) {
  days.push([new Date(t).toISOString().slice(0, 10), 50, 50]);
}
const win = M.threeMonth(days, "2026-11-12");
assert.strictEqual(win[0][0], "2026-08-12", "three-month start, got " + win[0][0]);
assert.strictEqual(win[win.length - 1][0], "2026-11-12");
assert.strictEqual(win.length, 93);

// 3. appendToday only when the delivery date is Zurich today; trailing 30-day MA.
function iso(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); }
const thirty = [];
for (let i = 0; i < 30; i++) thirty.push([iso(2026, 10, 14 + i), 100 + i, null]);
// 14 Oct + 29 days = 12 Nov? 14 Oct + 29 = 12 Nov yes (Oct has 31: 14..31 = 18, + 12 = 30).
assert.strictEqual(thirty[29][0], "2026-11-12");
const skip = M.appendToday(thirty.slice(0, 29), "2026-11-13", 200, "2026-11-12");
assert.strictEqual(skip.length, 29, "must not append a later delivery as today");
const withToday = M.appendToday(thirty.slice(0, 29), "2026-11-12", 144.45, "2026-11-12");
assert.strictEqual(withToday[withToday.length - 1][0], "2026-11-12");
assert.strictEqual(withToday[withToday.length - 1][1], 144.45);
const expectedMa = thirty.slice(0, 29).reduce((s, r) => s + r[1], 0) / 30 + 144.45 / 30;
assert.ok(Math.abs(withToday[withToday.length - 1][2] - expectedMa) < 1e-9, "MA " + withToday[withToday.length - 1][2] + " vs " + expectedMa);

// A missing calendar day leaves the average blank, rather than shortening.
const gappy = thirty.slice();
gappy[5][1] = null;
assert.strictEqual(M.trailingMa(gappy, "2026-11-12", 1), null);

// Already present: do not duplicate.
const again = M.appendToday(withToday, "2026-11-12", 999, "2026-11-12");
assert.strictEqual(again.length, withToday.length);
assert.strictEqual(again[again.length - 1][1], 144.45);

// 4. Prev MTD is day-for-day, and does not spill into the month before.
assert.deepEqual(M.prevMtdSpan("2026-11-12"), ["2026-10-01", "2026-10-12"]);
assert.deepEqual(M.prevMtdSpan("2026-03-31"), ["2026-02-01", "2026-02-28"]);
assert.deepEqual(M.prevMtdSpan("2024-03-31"), ["2024-02-01", "2024-02-29"]);
assert.deepEqual(M.prevMtdSpan("2026-01-15"), ["2025-12-01", "2025-12-15"]);

// 5. Area table order: SYS, all bidding zones including NO4, DE at the bottom.
const labels = M.AREA_ORDER.map(x => x[1]);
assert.deepEqual(labels[0], "SYS");
assert.ok(labels.includes("NO4"), "NO4 must be in the table");
assert.strictEqual(labels[labels.length - 1], "DE");
assert.strictEqual(labels.length, 14);

// Table figures from a compact fixture, including today and DE, week Mon–Thu, MTD, prev MTD day-for-day.
function row(date, v) { return [date, v, null]; }
function series(from, to, v) {
  const out = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) {
    out.push(row(new Date(t).toISOString().slice(0, 10), v));
  }
  return out;
}
const prices = { regions: {} };
// Nordic: Oct 1–12 all 80, Nov 1–11 all 100; today 12 Nov supplied via tomorrow at 130.
prices.regions.Nordic = { rows: series("2026-10-01", "2026-11-11", 0).map(r => [r[0], r[0] < "2026-11-01" ? 80 : 100, null]) };
// Fill other areas with empty so they show blanks; DE from prices.regions after merge.
["SE1","SE2","SE3","SE4","FI","DK1","DK2","NO1","NO2","NO3","NO4","NO5"].forEach(c => {
  prices.regions[c] = { rows: prices.regions.Nordic.rows.map(r => r.slice()) };
});
prices.regions.DE = { rows: series("2026-10-01", "2026-11-12", 0).map(r => [r[0], r[0] < "2026-11-01" ? 50 : (r[0] === "2026-11-12" ? 200 : 150), null]) };
const tomorrow = {
  delivery_date: "2026-11-12",
  regions: {
    Nordic: { complete: { price: true }, price: [100, 160] }, // mean 130
    SE1: { complete: { price: true }, price: [100, 160] },
    SE2: { complete: { price: true }, price: [100, 160] },
    SE3: { complete: { price: true }, price: [100, 160] },
    SE4: { complete: { price: true }, price: [100, 160] },
    FI: { complete: { price: true }, price: [100, 160] },
    DK1: { complete: { price: true }, price: [100, 160] },
    DK2: { complete: { price: true }, price: [100, 160] },
    NO1: { complete: { price: true }, price: [100, 160] },
    NO2: { complete: { price: true }, price: [100, 160] },
    NO3: { complete: { price: true }, price: [100, 160] },
    NO4: { complete: { price: true }, price: [100, 160] },
    NO5: { complete: { price: true }, price: [100, 160] },
  }
};
const stats = M.areaStats({ prices, tomorrow }, "2026-11-12");
const sys = stats.find(s => s.code === "Nordic");
assert.strictEqual(sys.today, 130);
// Week Mon 9 Nov – Thu 12 Nov: 100,100,100,130 → 107.5
assert.ok(Math.abs(sys.week - 107.5) < 1e-9, "week " + sys.week);
// MTD Nov 1–12: 11 days at 100 + 130 = 1230/12 = 102.5
assert.ok(Math.abs(sys.mtd - 102.5) < 1e-9, "mtd " + sys.mtd);
// Prev MTD Oct 1–12: all 80
assert.ok(Math.abs(sys.prev - 80) < 1e-9, "prev " + sys.prev);
assert.deepEqual(sys.prevSpan, ["2026-10-01", "2026-10-12"]);
const de = stats.find(s => s.code === "DE");
assert.strictEqual(de.today, 200);
// DE week Nov 9–12: 150,150,150,200 = 162.5
assert.ok(Math.abs(de.week - 162.5) < 1e-9, "DE week " + de.week);
assert.ok(Math.abs(de.prev - 50) < 1e-9, "DE prev " + de.prev);
assert.strictEqual(stats[stats.length - 1].code, "DE");

// Zurich today helper returns an ISO date.
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(M.zurichToday(new Date("2026-11-12T15:00:00+01:00"))));
assert.strictEqual(M.zurichToday(new Date("2026-11-12T15:00:00+01:00")), "2026-11-12");
assert.strictEqual(M.zurichToday(new Date("2026-11-12T00:30:00+01:00")), "2026-11-12");
// After midnight Zurich on the 13th, 12 Nov is no longer today.
assert.strictEqual(M.zurichToday(new Date("2026-11-13T00:30:00+01:00")), "2026-11-13");

console.log("Day-ahead price chart (3-month, today, axis, table, MA, prev MTD): PASS");
