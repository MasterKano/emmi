/* Light theme tokens and world-clock zones; the dense Markets table and page footers are retired (19 Nov 2026). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

const styles = read("styles.css");
assert.ok(/\[data-theme=light\]\{[^}]*--bg:#fff;/.test(styles), "light page is white");
assert.ok(/\[data-theme=light\]\{[^}]*--panel:#f8f9fa;/.test(styles), "light cards are light gray");
assert.ok(/\[data-theme=light\]\{[^}]*--border-strong:#dadce0;/.test(styles), "light borders");
assert.ok(/\[data-theme=light\]\{[^}]*--accent:#1a73e8;/.test(styles), "light link blue");
assert.ok(/\[data-theme=light\]\{[^}]*--good:#137333;/.test(styles), "light up green");
assert.ok(/\[data-theme=light\]\{[^}]*--bad:#a50e0e;/.test(styles), "light down red");
assert.ok(/:root,\[data-theme=dark\]\{[^}]*--bg:#202124;/.test(styles), "dark page is gray, not navy");
assert.ok(!/:root,\[data-theme=dark\]\{[^}]*--bg:#0b0f16/.test(styles));

const markets = read("v2/markets/live.css");
assert.ok(!/--bg:\s*#0b0f16/.test(markets), "markets cards must not lock a dark background");
assert.ok(markets.includes("background: var(--panel)"), "markets cards use the theme panel");
assert.ok(/max-width:\s*1280px/.test(markets));
assert.ok(!/max-width:\s*720px/.test(markets));

for (const f of ["v2/home/live.css", "v2/power/live.css", "v2/curves/live.css", "v2/oilgas/live.css", "research/app/styles.css"]) {
  const css = read(f);
  assert.ok(!/--bg:\s*#0b0f16/.test(css), f + " still locks navy");
  assert.ok(/max-width:\s*1280px/.test(css), f + " lost the 1280 cap");
  assert.ok(!/max-width:\s*720px/.test(css), f + " reintroduced a 720px column");
}

const home = read("v2/home/live.css");
assert.ok(home.includes("background: var(--panel)"), "home tiles follow the theme");
assert.ok(!home.includes("color: #f4f7fb"), "home prices are not hard-wired white");

const index = read("index.html");
const zones = ["America/Toronto", "America/New_York", "Europe/London", "Europe/Stockholm", "Europe/Zurich", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney"];
zones.forEach(z => assert.ok(index.includes('data-zone="' + z + '"'), z));
assert.ok(index.includes("TSX") && index.includes("STO") && index.includes("SIX"));
assert.ok(!index.includes('id="utcClock"'), "UTC clock was replaced by London");
assert.ok(index.includes("clocks.js?v=20261116a"));
assert.ok(index.includes("clocks-summary") && index.includes("clocks-list"));

const clocks = read("clocks.js");
zones.forEach(z => assert.ok(clocks.includes('"' + z + '"'), "clocks.js " + z));
const sandbox = { window: {}, document: { readyState: "complete", addEventListener: function () {}, querySelectorAll: function () { return []; } }, matchMedia: function () { return { matches: false, addEventListener: function () {} }; } };
vm.createContext(sandbox);
vm.runInContext(clocks, sandbox);
assert.equal(Array.from(sandbox.window.EMMIClocks.zones, z => z.zone).join("|"), zones.join("|"));

const st = (zone, iso) => sandbox.window.EMMIClocks.status(zone, new Date(iso));
assert.equal(st("America/New_York", "2026-01-15T14:30:00Z").state, "open", "NYSE winter open");
assert.equal(st("America/New_York", "2026-01-15T14:29:00Z").state, "closed", "NYSE before open");
assert.equal(st("America/New_York", "2026-01-15T21:00:00Z").state, "closed", "NYSE at the close");
assert.equal(st("America/New_York", "2026-07-15T13:30:00Z").state, "open", "NYSE summer DST open");
assert.equal(st("America/Toronto", "2026-11-16T14:30:00Z").state, "open", "TSX open");
assert.equal(st("Europe/Stockholm", "2026-11-16T10:00:00Z").state, "open", "STO open");
assert.equal(st("Europe/Zurich", "2026-11-16T16:29:00Z").state, "open", "SIX almost close");
assert.equal(st("Asia/Shanghai", "2026-11-16T02:00:00Z").state, "open", "SSE morning");
assert.equal(st("Asia/Shanghai", "2026-11-16T04:45:00Z").state, "lunch", "SSE lunch");
assert.equal(st("Asia/Singapore", "2026-11-16T04:30:00Z").state, "lunch", "SGX lunch");
assert.equal(st("Asia/Hong_Kong", "2026-11-16T04:30:00Z").state, "open", "HKEX trades through lunch");
assert.equal(st("America/New_York", "2026-11-14T16:00:00Z").state, "closed", "weekend");
assert.equal(st("America/New_York", "2026-12-25T16:00:00Z").reason, "holiday", "NYSE Christmas");
assert.equal(st("America/New_York", "2026-12-24T19:00:00Z").state, "closed", "NYSE Christmas Eve early close already done");
assert.equal(st("America/New_York", "2026-12-24T16:30:00Z").state, "open", "NYSE Christmas Eve before 13:00");
assert.equal(st("Australia/Sydney", "2026-12-24T03:00:00Z").state, "open", "ASX still open at 14:00 on early-close day");
assert.equal(st("Australia/Sydney", "2026-12-24T03:11:00Z").state, "closed", "ASX early close 14:10");
assert.ok(st("Europe/Zurich", "2026-11-16T17:00:00Z").until.includes("opens"), "SIX until text");

function hm(zone, iso) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
const winter = "2026-01-15T12:00:00Z";
const summer = "2026-07-15T12:00:00Z";
assert.equal(hm("America/New_York", winter), "07:00");
assert.equal(hm("America/New_York", summer), "08:00");
assert.equal(hm("Europe/London", winter), "12:00");
assert.equal(hm("Europe/London", summer), "13:00");
assert.equal(hm("Europe/Zurich", winter), "13:00");
assert.equal(hm("Europe/Zurich", summer), "14:00");
assert.equal(hm("Asia/Singapore", winter), "20:00");
assert.equal(hm("Asia/Singapore", summer), "20:00");
assert.equal(hm("Asia/Hong_Kong", winter), "20:00");
assert.equal(hm("Asia/Shanghai", summer), "20:00");
assert.equal(hm("Australia/Sydney", winter), "23:00");
assert.equal(hm("Australia/Sydney", summer), "22:00");

const table = read("table.js");
assert.ok(!table.includes('id="mktDense"') && !table.includes("function renderDenseMarkets"), "dense Markets table is retired");
assert.ok(!/Previous compan/i.test(table), "no Previous companies footers on pages");
["home", "markets", "power", "curves", "companies"].forEach(p => assert.ok(index.includes('href="parked/' + p + '/"'), "Archive keeps parked/" + p));
const powerJs = read("v2/power/v2.js");
assert.ok(powerJs.includes('stroke="#f4f7fb" stroke-width="2"/>'), "white normal tick stays");
assert.ok(powerJs.includes("The white tick"));
assert.ok(powerJs.includes("MMLabels.deliveryLabel(T.delivery_date, new Date())"), "day-ahead word follows the delivery date in Zurich");

const research = read("research/app/index.html");
const rnav = research.slice(research.indexOf('class="main-nav"'), research.indexOf("</nav>"));
assert.ok(rnav.includes("Live Pulse") && rnav.includes("Companies") && rnav.includes("Research"));
assert.ok(!/Overview|Briefs|Curves/.test(rnav));
zones.forEach(z => assert.ok(research.includes('data-zone="' + z + '"'), "research " + z));

console.log("Visual pass: light cards, clocks, retired dense table: PASS");
