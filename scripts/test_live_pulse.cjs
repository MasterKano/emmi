/* Live Pulse (#briefs/live): risk gauge uses only live inputs and lists the rest; contributions add up;
   day-ahead reads mr.json by date; routing and the archive stay in place. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { window: {}, document: { addEventListener() {} }, Intl, Date, Math, JSON, localStorage: { getItem: () => null, setItem() {} } };
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
assert.ok(g.missing.some(m => /Credit/.test(m)) && g.missing.some(m => /2Y/.test(m)), "inputs not in the feeds are listed");
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
assert.ok(/\["live","Live Pulse"\],\["pulse","Pulse"\],\["csi","CSI"\]/.test(t), "Live Pulse first under Briefs");
assert.ok(/p\[1\]==="live"\?"live"/.test(t), "#briefs/live route");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(/livepulse\.js\?v=20261112ai/.test(idx) && /livepulse\.css\?v=20261112ah/.test(idx), "assets cache-busted");
assert.ok(idx.indexOf("livepulse.js") < idx.indexOf("table.js"), "livepulse loads before table.js");
const b = fs.readFileSync(path.join(root, "briefs.js"), "utf8");
assert.ok(/data-brief-pick/.test(b) && /pulse\/editions\.json/.test(b), "edition archive and pickers unchanged");
const c = JSON.parse(fs.readFileSync(path.join(root, "data/live_comment.json"), "utf8"));
assert.ok(c.written_at && c.headline && Array.isArray(c.body) && "risk_label" in c && c.source && c.source.href, "live_comment.json schema");
console.log("live pulse ok");
