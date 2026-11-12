/* Light theme tokens, world-clock zones, and the dense Markets table. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

const styles = read("styles.css");
assert.ok(/\[data-theme=light\]\{[^}]*--bg:#fff;/.test(styles), "light page is white");
assert.ok(/\[data-theme=light\]\{[^}]*--panel:#f8f9fa;/.test(styles), "light cards are light gray");
assert.ok(/\[data-theme=light\]\{[^}]*--border:#dadce0;/.test(styles), "light borders");
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
const zones = ["Europe/Zurich", "Europe/London", "America/New_York", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Australia/Sydney"];
zones.forEach(z => assert.ok(index.includes('data-zone="' + z + '"'), z));
assert.ok(!index.includes('id="utcClock"'), "UTC clock was replaced by London");
assert.ok(index.includes("clocks.js?v=20261112q"));

const clocks = read("clocks.js");
zones.forEach(z => assert.ok(clocks.includes('"' + z + '"'), "clocks.js " + z));
const sandbox = { window: {}, document: { readyState: "complete", addEventListener: function () {}, querySelectorAll: function () { return []; } }, matchMedia: function () { return { matches: false, addEventListener: function () {} }; } };
vm.createContext(sandbox);
vm.runInContext(clocks, sandbox);
assert.equal(Array.from(sandbox.window.EMMIClocks.zones, z => "" + z[1]).join("|"), zones.join("|"));

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
assert.ok(table.includes('id="mktDense"'), "dense table is on the daily Markets view");
assert.ok(table.includes("function denseCols"), "dense columns include volume and averages");
assert.ok(table.includes("function renderDenseMarkets"));
assert.ok(table.includes('href="parked/markets/"'), "Previous Markets tab link stays");
assert.ok(table.includes('href="parked/companies/"'));
const powerJs = read("v2/power/v2.js");
assert.ok(powerJs.includes('stroke="#f4f7fb" stroke-width="2"/>'), "white normal tick stays");
assert.ok(powerJs.includes("The white tick"));
assert.ok(powerJs.includes("Today and Tomorrow follow the delivery date in Zurich"));

const research = read("research/app/index.html");
assert.ok(research.includes("Home") && research.includes("Oil &amp; gas") && research.includes("Research"));
assert.ok(!/Companies|Curves/.test(research.slice(research.indexOf('class="main-nav"'), research.indexOf("</nav>"))));
zones.forEach(z => assert.ok(research.includes('data-zone="' + z + '"'), "research " + z));

console.log("Visual pass: light cards, clocks, dense Markets table: PASS");
