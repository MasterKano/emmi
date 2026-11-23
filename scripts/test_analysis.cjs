/* Our analysis search and the company-page section. No network. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sandbox = { window: {}, document: { readyState: "complete", addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; } }, fetch() { return Promise.resolve({ ok: false }); } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("briefs.js"), sandbox);
const B = sandbox.EMMIBriefs;

const items = [
  { id: "dc", date: "2026-11-23", type: "special", kind: "Special report", title: "Data centre infrastructure", summary: "capex and debt", topics: ["capex", "credit"], companies: [{ name: "CoreWeave", sym: "CRWV" }, { name: "Munters", sym: "MTRS.ST" }], href: "/emmi/specials/dc/", text: "Hyperion campus and CoreWeave capex. Munters orders." },
  { id: "oil", date: "2026-11-23", type: "special", kind: "Special brief", title: "EU oil sample", summary: "Vår pays for Norway", topics: ["oil"], companies: [{ name: "Vår Energi", sym: "VAR.OL" }], href: "/emmi/specials/oil/", text: "Vår Energi closed the deal." },
  { id: "note", date: "2026-11-12", type: "note", kind: "Company note", title: "Guyana licence", summary: "Orinduik", topics: ["Where things stand"], companies: [{ name: "Eco Atlantic", sym: "ECO.L" }], href: "/emmi/#co=ECO.L&tab=research", text: "The Orinduik block is in Guyana." },
];

assert.deepStrictEqual(B.filterItems(items, { q: "Hyperion" }).map((i) => i.id), ["dc"]);
assert.deepStrictEqual(B.filterItems(items, { q: "CoreWeave" }).map((i) => i.id), ["dc"]);
assert.deepStrictEqual(B.filterItems(items, { q: "Munters" }).map((i) => i.id), ["dc"]);
assert.deepStrictEqual(B.filterItems(items, { q: "Vår" }).map((i) => i.id), ["oil"]);
assert.deepStrictEqual(B.filterItems(items, { q: "Guyana" }).map((i) => i.id), ["note"]);
assert.deepStrictEqual(B.filterItems(items, { q: "CRWV" }).map((i) => i.id), ["dc"]);
assert.deepStrictEqual(B.filterItems(items, { type: "note" }).map((i) => i.id), ["note"]);
assert.deepStrictEqual(B.filterItems(items, { topic: "credit" }).map((i) => i.id), ["dc"]);
assert.deepStrictEqual(B.filterItems(items, { sym: "VAR.OL" }).map((i) => i.id), ["oil"]);
assert.deepStrictEqual(B.filterItems(items, {}).map((i) => i.id), ["dc", "oil", "note"]);
assert.ok(B.snippet(items[0], "Hyperion").includes("Hyperion"));
assert.ok(B.matchesQuery(items[2], "orinduik guyana"));

const js = read("company.js");
assert.ok(/function notesSlot\(/.test(js), "notesSlot remains");
assert.ok(js.includes('sec("coNotes","Our analysis"'), "one Our analysis section");
assert.ok(!js.includes('sec("coSpecials"'), "Special briefs block is not a second section");
assert.ok(!js.includes('sec("coNotes","Notes"'), "Notes is not a separate heading");
assert.ok(js.includes("Special report") && js.includes("Company note"));

const table = read("table.js");
assert.ok(table.includes('["analysis","Our analysis"]'));
assert.ok(table.includes('p[1]==="analysis"?"analysis"'));
assert.ok(table.includes("mountAnalysis"));

const home = read("index.html");
assert.ok(home.includes("analysis.css?v=20261123an1"));
assert.ok(home.includes("company.js?v=20261123an1"));
assert.ok(home.includes("briefs.js?v=20261123an1"));
assert.ok(home.includes("table.js?v=20261123an1"));

const index = JSON.parse(read("data/analysis_index.json"));
const textOf = (id) => {
  const item = index.items.find((row) => row.id === id);
  assert.ok(item, id);
  return [item.title, item.summary, item.text, ...(item.topics || []), ...(item.companies || []).map((c) => c.name + " " + c.sym)].join("\n");
};
assert.ok(textOf("2026-11-23-data-centre-infrastructure").includes("Hyperion"));
assert.ok(textOf("2026-11-23-data-centre-infrastructure").includes("CoreWeave"));
assert.ok(textOf("2026-11-23-data-centre-infrastructure").includes("Munters"));
assert.ok(textOf("2026-11-23-euoil").includes("Vår"));
assert.ok(textOf("ECO.L:orinduik-navitas-licence-2026-11-12").includes("Guyana"));

console.log("test_analysis: ok");
