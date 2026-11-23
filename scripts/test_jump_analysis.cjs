/* Jump bar: existing section and company hits stay, and analysis specials and notes join them.
   No network. The analysis index is injected. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function el(id) {
  const node = {
    id,
    value: "",
    hidden: true,
    innerHTML: "",
    _l: {},
    blur() { node._blurred = true; },
    addEventListener(type, fn) { (node._l[type] = node._l[type] || []).push(fn); },
    dispatch(type, event) {
      const e = Object.assign({ preventDefault() { e.defaulted = true; }, target: node }, event);
      (node._l[type] || []).forEach((fn) => fn(e));
      return e;
    }
  };
  return node;
}

const input = el("jumpInput");
const list = el("jumpList");
list.querySelector = () => null;
const pushed = [];
const sandbox = {
  document: {
    getElementById(id) { return id === "jumpInput" ? input : id === "jumpList" ? list : null; },
    activeElement: null,
    addEventListener() {}
  },
  location: { hash: "", pathname: "/emmi/index.html", search: "", href: "" },
  history: {
    pushState(state, title, url) {
      pushed.push(url);
      const hash = String(url).includes("#") ? "#" + String(url).split("#").slice(1).join("#") : "";
      sandbox.location.hash = hash;
    }
  },
  fetch() { return Promise.reject(new Error("offline")); },
  setTimeout(fn) { fn(); return 0; },
  setInterval() { return 0; },
  clearInterval() {},
  clearTimeout() {},
  MMCompany: { opened: [], ready() { sandbox.MMCompany.opened.push(sandbox.location.hash); } },
  MMNav: { gone: [], go(tab) { sandbox.MMNav.gone.push(tab); } },
  MMUI: { go() {} }
};
sandbox.window = sandbox;
list.addEventListener = el("x").addEventListener.bind(list);
list._l = {};
vm.createContext(sandbox);
vm.runInContext(read("v2/companies/coverage.js"), sandbox);
vm.runInContext(read("fundamentals.js"), sandbox);
vm.runInContext(read("search.js"), sandbox);
const J = sandbox.MMJump;

const items = JSON.parse(read("data/analysis_index.json")).items;
J.setAnalysis(items);

function ids(q) { return J.find(q).map((row) => row[0]); }
function kinds(q) { return J.find(q).map((row) => row[1]); }

const hydro = J.find("hydro");
assert.ok(hydro.length, "hydro still matches");
assert.strictEqual(hydro[0][0], "Hydro reservoirs");
assert.ok(!kinds("hydro").includes("analysis"), "hydro does not turn into an analysis hit");
assert.ok(ids("SE4").includes("SE4 focus"));
assert.ok(ids("CAPE").includes("US stock valuations"));
const fortum = J.find("Fortum");
assert.strictEqual(fortum[0][0], "Fortum");
assert.strictEqual(fortum[0][1], "companies");
assert.ok(fortum.some((row) => row[1] === "analysis" && String(row[2]).includes("data-centre-infrastructure")));

const munters = J.find("Munters");
assert.ok(munters.some((row) => row[1] === "co" && row[2] === "MTRS.ST"), "Munters opens the company page");
assert.ok(munters.some((row) => row[1] === "analysis" && row[4].type === "special"), "Munters matches the special");
assert.ok(munters[0][1] !== "analysis", "the company row ranks ahead of the report");

assert.ok(J.find("EQIX").some((row) => row[1] === "co" && row[2] === "EQIX"));
assert.ok(J.find("GEV").some((row) => row[2] === "GEV"));
assert.ok(J.find("data centres").some((row) => row[1] === "analysis" && String(row[2]).includes("data-centre")));
assert.ok(J.find("neoclouds").some((row) => row[1] === "analysis"));
assert.ok(J.find("rate squeeze").some((row) => String(row[2]).includes("data-centre-infrastructure")));
const note = J.find("Guyana");
assert.ok(note.some((row) => row[1] === "analysis" && row[4].type === "note" && String(row[2]).includes("ECO.L")));
assert.ok(J.find("Orinduik").some((row) => row[4] && row[4].type === "note"));
assert.ok(J.find("Valiente").some((row) => row[1] === "analysis" && row[4].type === "note"));

const companyHtml = J.itemHtml(J.find("Munters").find((row) => row[1] === "co"), 0, true);
assert.ok(companyHtml.includes("MTRS.ST"));
assert.ok(!companyHtml.includes("jump-badge"));
const specialHtml = J.itemHtml(J.find("data centre infrastructure").find((row) => row[1] === "analysis"), 0, true);
assert.ok(specialHtml.includes("jump-badge"));
assert.ok(specialHtml.includes("Special"));
assert.ok(specialHtml.includes("23 Nov 2026"));
assert.ok(!specialHtml.includes("Note"));
const noteHtml = J.itemHtml(J.find("Guyana").find((row) => row[1] === "analysis"), 1, false);
assert.ok(noteHtml.includes("Note"));
assert.ok(noteHtml.includes("12 Nov 2026"));

pushed.length = 0;
sandbox.MMCompany.opened.length = 0;
J.open(J.find("Munters").find((row) => row[1] === "co"));
assert.ok(sandbox.location.hash === "#co=MTRS.ST" || pushed.some((u) => u.endsWith("#co=MTRS.ST")));
assert.ok(sandbox.MMCompany.opened.some((h) => h.includes("co=MTRS.ST")));

sandbox.MMCompany.opened.length = 0;
J.open(J.find("Guyana").find((row) => row[1] === "analysis"));
assert.ok(sandbox.location.hash.includes("co=ECO.L"));
assert.ok(sandbox.location.hash.includes("tab=research"));
assert.ok(sandbox.MMCompany.opened.some((h) => h.includes("tab=research")));

sandbox.location.href = "";
J.open(J.find("EU oil").find((row) => row[1] === "analysis"));
assert.ok(String(sandbox.location.href).includes("/emmi/specials/2026-11-23-euoil/"));

sandbox.MMNav.gone.length = 0;
J.open(J.find("hydro")[0]);
assert.deepStrictEqual(sandbox.MMNav.gone, ["power"]);

// Keyboard: Down then Enter follows the highlighted row. Fast input replaces the list immediately.
input.value = "Munters";
input.dispatch("input", {});
assert.ok(list.innerHTML.includes("Munters"));
assert.ok(list.innerHTML.includes("Special"));
const first = list.innerHTML.indexOf('aria-selected="true"');
input.dispatch("keydown", { key: "ArrowDown" });
assert.ok(list.innerHTML.indexOf('aria-selected="true"') !== first);
input.value = "hydro";
input.dispatch("input", {});
assert.ok(list.innerHTML.includes("Hydro reservoirs"));
assert.ok(!list.innerHTML.includes("Munters"));
input.dispatch("keydown", { key: "Enter" });
assert.deepStrictEqual(sandbox.MMNav.gone, ["power", "power"]);
assert.strictEqual(input.value, "");
input.value = "CAPE";
input.dispatch("input", {});
input.dispatch("keydown", { key: "Escape" });
assert.strictEqual(input.value, "");
assert.strictEqual(list.hidden, true);

// A failed index fetch leaves section search working.
J.setAnalysis(null);
assert.strictEqual(J.find("Guyana").length, 0);
assert.strictEqual(J.find("SE4")[0][0], "SE4 focus");

const src = read("search.js");
assert.ok(src.includes('e.key==="ArrowDown"') && src.includes('e.key==="ArrowUp"') && src.includes('e.key==="Enter"') && src.includes('e.key==="Escape"'));
assert.ok(src.includes("data/analysis_index.json"));
assert.ok(!/Jerry|Orron|Orrön|orron\.com/i.test(read("fundamentals.js")));
assert.ok(!/Jerry|Orron|Orrön|orron\.com/i.test(read("search.js").slice(read("search.js").indexOf("function prettyDate"))));

console.log("test_jump_analysis: ok");
