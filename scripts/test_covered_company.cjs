/* Covered oil and mining tiles open the EMMI profile. Yahoo stays a secondary link.
   A covered profile always has the three research fields. Values come from the
   research files; this test does not invent events. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const COVERED = [
  ["TLW.L", "Tullow Oil"],
  ["CNE.L", "Capricorn Energy"],
  ["GENL.L", "Genel Energy"],
  ["ECO.L", "Eco Atlantic"],
  ["ITH.L", "Ithaca Energy"],
  ["AET.L", "Afentra"],
  ["KIST.L", "Kistos"],
  ["JSE.L", "Jadestone Energy"],
  ["CHAR.L", "Chariot"],
  ["TXP.L", "Touchstone Exploration"],
  ["GKP.L", "Gulf Keystone"],
  ["SER.L", "Serica Energy"],
  ["ENOG.L", "Energean"],
  ["SEPL.L", "Seplat Energy"],
  ["RKH.L", "Rockhopper Exploration"],
  ["ENQ.L", "EnQuest"],
  ["PHAR.L", "Pharos Energy"],
  ["IPCO.ST", "International Petroleum"],
  ["SNM-SDB.ST", "ShaMaran Petroleum"],
  ["AEC.ST", "Africa Energy"],
  ["MER.ST", "Meren Energy"],
  ["EQNR.OL", "Equinor"],
  ["AKRBP.OL", "Aker BP"],
  ["VAR.OL", "Vår Energi"],
  ["DNO.OL", "DNO"],
  ["BNOR.OL", "BlueNord"],
  ["BWE.OL", "BW Energy"],
  ["OKEA.OL", "OKEA"],
  ["PEN.OL", "Panoro Energy"],
  ["PNOR.OL", "PetroNor E&P"],
  ["QEC.OL", "Questerre Energy"],
  ["IOX.OL", "Interoil Exploration and Production"],
  ["LUN.TO", "Lundin Mining"],
  ["LUG.TO", "Lundin Gold"],
  ["NGEX.TO", "NGEx Minerals"],
  ["LUC.TO", "Lucara Diamond"],
  ["MAU.TO", "Montage Gold"],
  ["LUNR.TO", "LunR Royalties"]
];

function loadTiles() {
  const window = {};
  const context = { window: window };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "v2/companies/listing.js"), "utf8"), context);
  context.window.MMV2 = {
    esc: s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    finite: v => typeof v === "number" && Number.isFinite(v),
    pxText: () => "10",
    pill: t => String(t),
    signed: v => String(v),
    money: () => "€1"
  };
  vm.runInContext(fs.readFileSync(path.join(root, "v2/companies/tiles.js"), "utf8"), context);
  return context.window.MMV2Tiles;
}

function openHref(html) {
  const m = html.match(/class="v2co-open"[^>]*href="([^"]+)"/);
  assert.ok(m, "tile has no profile link: " + html.slice(0, 180));
  return m[1];
}

const LIVE = { "LUN.TO": "LUMI.ST", "LUG.TO": "LUG.ST", "LUC.TO": "LUC.ST" };
const NO_ST = new Set(["NGEX.TO", "MAU.TO", "LUNR.TO"]);
const tiles = loadTiles();
for (const [yahoo, name] of COVERED) {
  const html = tiles.tile({ yahoo: yahoo, short: name, company: name, exchange_ticker: yahoo.split(".")[0] }, {});
  if (NO_ST.has(yahoo)) {
    assert.ok(html.includes("n/a"), yahoo + " should be blank without a Stockholm quote");
    assert.ok(html.includes("No Stockholm listing"), yahoo);
    assert.ok(!html.includes(yahoo), yahoo + " still points at Toronto");
    assert.ok(!/Toronto/i.test(html), yahoo);
    continue;
  }
  const live = LIVE[yahoo] || yahoo;
  const href = openHref(html);
  assert.ok(!/finance\.yahoo\.com/i.test(href), live + " primary href is still Yahoo: " + href);
  assert.strictEqual(href, "#co=" + encodeURIComponent(live), yahoo);
  assert.ok(html.includes("https://finance.yahoo.com/quote/" + encodeURIComponent(live)), live + " is missing the Yahoo link");
  assert.ok(!/<a class="v2co-tile"/.test(html), live + " tile is still one Yahoo anchor");
  if (LIVE[yahoo]) {
    assert.ok(!html.includes(yahoo), live + " tile still names the Toronto symbol");
    assert.ok(!/Toronto/i.test(html), live);
  }
}

const sham = tiles.tile(
  { yahoo: "SNM-SDB.ST", short: "ShaMaran Petroleum", company: "ShaMaran Petroleum", exchange_ticker: "SNM" },
  { "SNM.OL": { sym: "SNM.OL", px: 1.2, ccy: "NOK", pct: { "1D": 1 } } }
);
assert.strictEqual(openHref(sham), "#co=SNM-SDB.ST");
assert.ok(sham.includes("https://finance.yahoo.com/quote/SNM-SDB.ST"));
assert.ok(!sham.includes("finance.yahoo.com/quote/SNM.OL"), "Yahoo link must use SNM-SDB.ST");
assert.strictEqual(openHref(tiles.tile({ yahoo: "SER.L", short: "Serica Energy", company: "Serica Energy", exchange_ticker: "SER" }, {})), "#co=SER.L");
assert.ok(!tiles.tile({ yahoo: "SER.L", short: "Serica Energy", company: "Serica Energy", exchange_ticker: "SER" }, {}).includes("SQZ.L"));
assert.strictEqual(openHref(tiles.tile({ yahoo: "IPCO.ST", short: "International Petroleum", company: "International Petroleum", exchange_ticker: "IPCO" }, {})), "#co=IPCO.ST");

const research = require(path.join(root, "v2/companies/research.js"));
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const json = p => JSON.parse(read(p));
const sources = {
  covered: COVERED.map(([yahoo, name]) => ({ yahoo: yahoo, short: name, company: name })),
  briefing: json("research/app/data/briefing.json"),
  coming: json("research/source/moonshot/coming_up.json"),
  smallcaps: json("research/source/moonshot/smallcaps.json"),
  identity: json("research/app/data/company_identity.json"),
  norway: json("research/source/moonshot/norway_events.json"),
  pilot: read("research/source/moonshot/events.csv")
};
const blob = [
  read("research/app/data/briefing.json"),
  read("research/source/moonshot/coming_up.json"),
  read("research/source/moonshot/smallcaps.json"),
  read("research/source/moonshot/norway_events.json"),
  read("research/source/moonshot/events.csv")
].join("\n");
const LABELS = ["Latest material development", "Next catalyst", "Research review date"];

function assertFields(html, yahoo) {
  LABELS.forEach(label => assert.ok(html.includes(label), yahoo + " is missing " + label));
  assert.strictEqual((html.match(/data-field="/g) || []).length, 3, yahoo + " field count");
  assert.ok(html.includes('id="coResearch"'), yahoo);
  assert.ok(/<summary class="info"/.test(html), yahoo + " source note is not behind an i");
}

const blank = research.pick("NOPE.L", {
  covered: [{ yahoo: "NOPE.L", short: "No Events", company: "No Events" }],
  briefing: { as_of: "2026-10-27" },
  coming: { items: [] },
  smallcaps: [],
  identity: null,
  norway: [],
  pilot: ""
}, "2026-11-12");
const blankHtml = research.sectionHtml(blank);
assertFields(blankHtml, "NOPE.L");
assert.ok(blankHtml.includes("not available yet"));
assert.ok(blankHtml.includes("27 Oct 2026"));
assert.strictEqual(research.pick("AAPL", sources, "2026-11-12"), null);
assert.strictEqual(research.sectionHtml(null), "");

for (const [yahoo] of COVERED) {
  const fields = research.pick(yahoo, sources, "2026-11-12");
  assert.ok(fields, yahoo + " is covered but pick returned nothing");
  const html = research.sectionHtml(fields);
  assertFields(html, yahoo);
  if (fields.material) {
    assert.ok(blob.includes(fields.material.headline), yahoo + " material is not in the research files: " + fields.material.headline);
    assert.ok(fields.material.label && fields.material.label !== "not available yet", yahoo);
  } else assert.ok(html.includes("not available yet"), yahoo);
  if (fields.catalyst) {
    assert.ok(blob.includes(fields.catalyst.headline), yahoo + " catalyst is not in the research files: " + fields.catalyst.headline);
    assert.ok(fields.catalyst.date >= "2026-11-12", yahoo + " catalyst is in the past: " + fields.catalyst.date);
  }
  assert.strictEqual(fields.review, "27 Oct 2026", yahoo + " review date");
}

const gkp = research.pick("GKP.L", sources, "2026-11-12");
assert.ok(gkp.material && gkp.catalyst, "Gulf Keystone should have a material item and a catalyst in the register");
const ser = research.sectionHtml(research.pick("SER.L", sources, "2026-11-12"));
assert.ok(!ser.includes("SQZ.L"));
const lumi = research.pick("LUMI.ST", sources, "2026-11-12");
assert.ok(lumi, "LUMI.ST should use the Lundin Mining research record");
assert.strictEqual(lumi.review, research.pick("LUN.TO", sources, "2026-11-12").review);
const snm = research.sectionHtml(research.pick("SNM-SDB.ST", sources, "2026-11-12"));
assert.ok(!snm.includes("SNM.OL"));

const companyJs = read("company.js");
assert.ok(companyJs.includes("function researchSec"), "company profile does not render the research fields");
assert.ok(companyJs.includes("researchSec()"), "overview does not include the research fields");
const page = read("research/app/index.html");
const nav = page.slice(page.indexOf('class="main-nav"'), page.indexOf("</nav>"));
assert.ok(nav.includes("Home") && nav.includes("Oil &amp; gas") && nav.includes("Mining") && nav.includes("Gas storage") && nav.includes("Research"));
assert.ok(!/Companies|Curves/.test(nav), "Research nav must not bring back Companies or Curves");
assert.ok(!page.includes("larr; emmi") && !page.includes("← emmi"));
assert.ok(page.includes('data-view="events"') && page.includes("Coming up") && page.includes(">Screen<"));
const css = read("research/app/styles.css");
assert.ok(css.includes("width: 100%") && css.includes("max-width: 1280px"));
assert.ok(css.includes("padding-bottom: calc(96px + env(safe-area-inset-bottom))"));
assert.ok(!/max-width:\s*720px/.test(css));

console.log("Covered tiles open EMMI profiles; covered profiles have the three research fields: PASS");
