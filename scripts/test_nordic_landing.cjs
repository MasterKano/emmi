/* Nordic power landing (#energy/nordic): shares the Live Pulse Nordic kit, the balance history uses the same
   scoring as the live gauge, forwards map to the right months, hourly prices decode by Zurich day, and the
   two pages keep separate explainer cards. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { window: {}, document: { addEventListener() {}, getElementById: () => null }, Intl, Date, Math, JSON, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "v2/shared/kit.js"), "utf8"), ctx);   /* shared kit (cards, popovers) loads first */
vm.runInContext(fs.readFileSync(path.join(root, "livepulse.js"), "utf8"), ctx);
ctx.EMMILivePulse = ctx.window.EMMILivePulse;
vm.runInContext(fs.readFileSync(path.join(root, "nordiclanding.js"), "utf8"), ctx);
const K = ctx.window.EMMILivePulse.nordicKit, NL = ctx.window.EMMINordicLanding;
assert.ok(K && NL, "kit and landing exported");
// a synthetic Nordic data set: one day, every driver present
const md = []; for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) { const dt = new Date(Date.UTC(2024, m - 1, d)); if (dt.getUTCMonth() === m - 1) md.push(String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")); }
const flat = v => md.map(() => v);
const day = "2026-11-17";
const N = {
  prices: { regions: { Nordic: { rows: [[day, 100, 90]] } } },
  nn: { month_days: md, wind_lf: { years: [2015, 2025], normal_30d: flat(34) }, nuclear_avail: { years: [2015, 2025], normal_30d: flat(87) } },
  generation: { nuclear_availability: { installed_mw: { SE: 7000, FI: 4400 }, online_mw: { SE: 4000, FI: 4400 }, observed_at: "2026-11-17T20:00:00+01:00", as_of: day, reactors_out: [] },
    regions: { Nordic: { metrics: { wind_load_factor: { rows: [[day, 30, 37.5, 33, 10]] }, nuclear: { rows: [[day, 8400 / 11400 * 11400, 0, 0]] } } } } },
  hydrology: { reservoirs: { NO: { rows: [["2026-11-08", 70, 60]], band: [[K.isoWeek("2026-11-08"), 60, 81.3, 95]] } } },
  weather: { regions: { Nordic: { metrics: { temp: { rows: [[day, -2, 3.2, 0, 1.3]] } } } } }
};
const h = NL.balanceHistory(N);
assert.strictEqual(h.length, 1, "one scored day");
const exp = Math.round(K.mean([K.clamp(-(70 - 81.3) / 10), K.clamp(-(8400 / 11400 * 100 - 87) / 30), K.clamp(-(37.5 - 34) / 10), K.clamp(-(3.2 - 1.3) / 3)]) * 100);
assert.strictEqual(h[0][1], exp, "history uses the gauge's scoring (reservoirs, nuclear, wind, temperature)");
// only three drivers is still a score; two is not
const N2 = JSON.parse(JSON.stringify(N)); N2.weather = {}; assert.strictEqual(NL.balanceHistory(N2).length, 1, "three drivers score");
N2.hydrology = {}; assert.strictEqual(NL.balanceHistory(N2).length, 0, "two drivers: no score, never filled in");
// forwards: contract months
assert.deepStrictEqual(Array.from(NL.monthsOf("Dec-26")), [12]);
assert.deepStrictEqual(Array.from(NL.monthsOf("Q1-27")), [1, 2, 3]);
assert.strictEqual(NL.monthsOf("Cal-27").length, 12);
assert.strictEqual(NL.monthsOf("Cal-27").length === 12 && !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d\d$/.test("Cal-27"), true, "Cal is not a month");
// hourly: delta-encoded hours, grouped by Zurich day (23:00 UTC = 00:00 Zurich in winter)
const p = [1000]; for (let i = 1; i < 48; i++) p.push(10);
const H = NL.hourly({ t0: "2026-11-16T23:00:00Z", enc: { scale: { p: 10 } }, zones: { SE3: { p: p } } }, "2026-11-17");
assert.strictEqual(H.SE3.length, 24, "24 hours of the Zurich day");
assert.deepStrictEqual(Array.from(H.SE3[0]), [0, 100], "first hour decoded and scaled");
assert.strictEqual(H.SE3[23][1], 123, "running sum of deltas");
// explainer cards: a landing render does not wipe Live Pulse's cards
const a = K.scoped("nl", () => K.popAttr({ title: "x" }));
assert.ok(/data-pop="nl:\d+"/.test(a), "landing cards in their own scope");
assert.strictEqual(ctx.window.EMMILivePulse.pops().length, 0, "Live Pulse list is separate");
// wiring
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(idx.indexOf("nordiclanding.js") > idx.indexOf("livepulse.js") && /nordiclanding\.css\?v=/.test(idx), "landing loads after the kit");
const v2 = fs.readFileSync(path.join(root, "v2/power/v2.js"), "utf8");
assert.ok(/EMMINordicLanding\.mount\(nl, data\)/.test(v2) && /data: \(\) => state\.data/.test(v2), "overview mounts the landing");
const src = fs.readFileSync(path.join(root, "nordiclanding.js"), "utf8");
assert.ok(!/Math\.random|fake|dummy/i.test(src), "no invented numbers");
console.log("nordic landing ok");
