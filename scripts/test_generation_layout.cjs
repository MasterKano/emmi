/* Energy > Nordic power > Generation (#energy/generation) uses the same card
   layout as the 100 m wind weather card (Jerry t1446u). Nuclear stays against
   installed capacity only. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

const js = read("v2/power/v2.js");
const css = read("v2/power/live.css");
const power = read("power.js");
const index = read("index.html");

assert.ok(js.includes("function wxSideHTML"), "shared side panel remains");
assert.ok(js.includes("function wxHero"), "generation reuses the wind-card hero");
assert.ok(js.includes("function weatherBlock"), "weather/wind card is unchanged in place");
assert.ok(js.includes('weatherBlock(root, data, "wind100")'), "wind at 100 m still uses weatherBlock");

assert.ok(js.includes('block(root, "gen-wind"'), "wind load-factor card");
assert.ok(js.includes('block(root, "gen-hydro"'), "hydro generation card");
assert.ok(js.includes('block(root, "gen-nuclear"'), "nuclear card");
assert.ok(!js.includes("function drawGenChart") && !js.includes("function drawNucChart"), "old drawGenChart/drawNucChart helpers are gone");
assert.ok(js.includes("function wxHero") && js.includes('class="hero hero-wx"'), "shared hero matches the wind card");
const gen = js.slice(js.indexOf("function generationBlock"), js.indexOf("function hydroBlock"));
assert.ok(gen.includes("wxHero(") && !gen.includes("hero-read"), "generation cards call the wind-card hero, not the old sidebar");

assert.ok(js.includes('vsLabel: "vs normal"') && js.includes('kind: "pp"'), "wind vs long-term load factor in percentage points");
assert.ok(js.includes("long-term load factor"), "wind compared with long-term load factor");
assert.ok(js.includes('unit: "GW"') && js.includes('kind: "pct"'), "hydro in GW against earlier years");

const nuc = js.slice(js.indexOf("function nuclearGenCard"), js.indexOf("function metricAsOf"));
assert.ok(nuc.includes('vsLabel: "% of installed"'), "nuclear stat 3 is % of installed");
assert.ok(nuc.includes('kind: "installed"'), "nuclear bars use installed ticks");
assert.ok(nuc.includes('t: "Installed capacity"'), "nuclear dashed line is installed capacity");
assert.ok(nuc.includes("moves: []"), "nuclear has no week or month comparison");
assert.ok(!/vs normal/.test(nuc), "nuclear card must not say vs normal");
assert.ok(!/normal_ma30|r\[3\]/.test(nuc), "nuclear card must not read the history-normal column");
assert.ok(nuc.includes("never against earlier years") || nuc.includes("not a typical level"), "nuclear explainer rules out a typical level");

assert.ok(js.includes("areaLatestFoot"), "per-area latest-day footnote");
assert.ok(js.includes('data-region="') && js.includes("wx-r"), "by-area rows switch the region pills");

assert.ok(power.includes("v2/power/v2.js?v=20261122tr1"), "v2.js cache bust");
assert.ok(index.includes("v2/power/live.css?v=20261120gl1"), "live.css cache bust");

assert.ok(css.includes(".wx-foot"), "footnote style");
assert.ok(/\.wx-k \{[^}]*white-space:\s*normal/.test(css), "stat labels wrap rather than clip");
assert.ok(!/wx-foot[^}]*ellipsis/.test(css) && !/wx-k[^}]*ellipsis/.test(css), "no ellipsis on the generation/wind stats");
assert.ok(css.includes('.wx-r[data-region]'), "area rows are clickable");

console.log("generation layout: source contract ok");
