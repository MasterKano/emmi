/* Nuclear is compared only with installed capacity (Jerry 20 Nov 2026: "Nuclear I want comparing to actual capacity").
   Fails if any EMMi page compares nuclear with a typical level, normal, average, last year, last month or earlier years. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
// 1) behaviour: gauge and balance history score nuclear by share of installed capacity, never by a normal
const ctx = { window: {}, document: { addEventListener() {} }, Intl, Date, Math, JSON, localStorage: { getItem: () => null, setItem() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, "v2/shared/kit.js"), "utf8"), ctx);
vm.runInNewContext(fs.readFileSync(path.join(root, "livepulse.js"), "utf8"), ctx);
const K = ctx.window.EMMILivePulse.nordicKit;
assert.ok(K.nucScore(82.5) === 0, "82.5% online scores 0");
assert.strictEqual(K.nucScore(60), 1, "60% online is fully tight");
assert.strictEqual(K.nucScore(40), 1, "capped at +1");
assert.strictEqual(K.nucScore(95), -1, "95% online is fully loose");
assert.ok(K.nucScore(74.4) > 0.3 && K.nucScore(74.4) < 0.4, "74% online is moderately tight");
assert.strictEqual(K.nucBand(74.4), "short");
assert.ok(/installed capacity/.test(K.NUC_BANDS), "bands explained");
const md = []; for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) { const dt = new Date(Date.UTC(2024, m - 1, d)); if (dt.getUTCMonth() === m - 1) md.push(String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")); }
const day = "2026-11-20";
const mk = typ => ({ prices: { regions: { Nordic: { rows: [[day, 170, 100]] } } },
  nn: { month_days: md, nuclear_avail: { years: [2015, 2025], normal_30d: md.map(() => typ) }, wind_lf: { years: [2015, 2025], normal_30d: md.map(() => 34) } },
  generation: { nuclear_availability: { installed_mw: { SE: 7006, FI: 4394 }, online_mw: { SE: 4242, FI: 4239 }, as_of: day, observed_at: day + "T07:00:00+01:00", reactors_out: [] },
    regions: { Nordic: { metrics: { wind_load_factor: { rows: [[day, 30, 30, 33, 10]] }, nuclear: { rows: [[day, 8000, null, 9000, 10]] } } } } },
  hydrology: {}, weather: { regions: { Nordic: { metrics: { temp: { rows: [[day, 0, 1, 0, 1]] } } } } } });
const a = K.nordicStress(mk(87)).parts.find(p => p.id === "nuc"), b = K.nordicStress(mk(40)).parts.find(p => p.id === "nuc");
assert.ok(a, "nuclear part present");
assert.strictEqual(a.score, b.score, "the typical/normal value has no effect on the nuclear score");
assert.strictEqual(a.score, K.nucScore(8481 / 11400 * 100), "scored by share of installed capacity online");
assert.ok(!("normal" in a) && !/typical|normal/i.test(a.cause + " " + a.chipT), "no normal on the nuclear part");
// 2) source scan: no nuclear-vs-normal/history anywhere in the live modules
const FILES = ["livepulse.js", "nordiclanding.js", "v2/power/v2.js", "nucmtd.js", "nordic.js", "mtd.js", "power.js", "whydrove.js", "dash.js", "health_model.js", "v2/shared/kit.js"].filter(f => fs.existsSync(path.join(root, f)));
const CMP = /\b(typical|normal|average|avg|last year|last month|previous month|earlier years|past years|same 30 days|same dates|history|historical)\b/i;
const NEG = /\b(never|not|no|instead of|rather than|only)\b/i;
const bad = [];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  if (/nuclear_avail\b/.test(src)) bad.push(f + ": reads the nuclear_avail (typical availability) normal");
  const re = /nuclear/gi; let m;
  while ((m = re.exec(src))) {
    const w = src.slice(Math.max(0, m.index - 60), m.index + 140).split(/\n/).join(" ");
    const sent = w.split(/(?<=[.;])\s|["'`]/);   // stay inside one sentence / one string literal
    const piece = sent.find(s => /nuclear/i.test(s)) || w;
    if (CMP.test(piece) && !NEG.test(piece) && !/wind|hydro|temperature|reservoir|prices?\b/i.test(piece.replace(/nuclear[^.]*$/i, ""))) bad.push(f + ": " + piece.trim().slice(0, 140));
  }
}
assert.deepStrictEqual(bad, [], "nuclear compared with a normal/average/history:\n" + bad.join("\n"));
console.log("nuclear capacity: ok");
