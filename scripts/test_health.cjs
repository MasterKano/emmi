/* A fresh file build must not be reported as the observation date.
   Covers the 12 Nov 2026 10:47 Zurich price build, a 10 Nov EEX settlement,
   a news headline older than that build, and Research review vs snapshot. */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "health_model.js"), "utf8");
const sandbox = { window: {}, Intl, Date };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const H = sandbox.window.MMHealthModel;

const morning = new Date("2026-11-12T09:47:00Z");
const PRICE_BUILD = "2026-11-12T09:47:00Z";
const later = new Date("2026-11-13T17:30:00Z");

function prices(marketTime) {
  return {
    generated_utc: PRICE_BUILD,
    groups: [{ sections: [{ rows: [{ market_time: marketTime, px: 80 }] }] }]
  };
}
const nordicCtx = { nordic: { built_at: PRICE_BUILD, as_of: "2026-11-11" } };
const futuresFile = {
  as_of: "2026-11-11",
  regions: { Nordic: { as_of: "2026-11-11" } },
  futures: {
    front_month: { contract: "Dec-26", as_of: "2026-11-10" },
    next_quarter: { contract: "Q1-27", as_of: "2026-11-10" }
  }
};

const freshQuote = H.assess("prices", prices("2026-11-12T09:30:00Z"), morning);
assert.equal(freshQuote.status, "fresh");
assert.ok(freshQuote.observationText.indexOf("10:30") >= 0, freshQuote.observationText);
assert.notEqual(freshQuote.observationText, freshQuote.buildText);

const oldQuote = H.assess("prices", prices("2026-11-10T16:00:00Z"), morning);
assert.equal(oldQuote.observation.slice(0, 10), "2026-11-10");
assert.notEqual(oldQuote.status, "fresh");
assert.ok(oldQuote.observationText.indexOf("10 Nov 2026") >= 0, oldQuote.observationText);
assert.ok(oldQuote.observationText.indexOf("10:47") < 0, oldQuote.observationText);
assert.ok(oldQuote.buildText.indexOf("10:47") >= 0, oldQuote.buildText);
assert.notEqual(oldQuote.observation, oldQuote.build);

const eex = H.assess("nordic-futures", futuresFile, morning, nordicCtx);
assert.equal(eex.observation, "2026-11-10");
assert.equal(eex.statusClock, "observation");
assert.equal(eex.status, "fresh");
assert.ok(eex.observationText.indexOf("10 Nov 2026") >= 0, eex.observationText);
assert.ok(eex.observationText.indexOf("Dec-26") >= 0, eex.observationText);
assert.ok(eex.observationText.indexOf("10:47") < 0, eex.observationText);
assert.ok(eex.observationText.indexOf("09:47") < 0, eex.observationText);
assert.notEqual(eex.observationText, eex.buildText);
assert.ok(eex.buildText.indexOf("10:47") >= 0, eex.buildText);
assert.equal(eex.reviewText, H.BLANK);

const eexHeld = H.assess("nordic-futures", futuresFile, later, { nordic: { built_at: "2026-11-13T17:20:00Z" } });
assert.equal(eexHeld.observation, "2026-11-10");
assert.notEqual(eexHeld.status, "fresh");
assert.ok(eexHeld.observationText.indexOf("10 Nov 2026") >= 0);
assert.ok(eexHeld.buildText.indexOf("18:20") >= 0, eexHeld.buildText);
assert.notEqual(eexHeld.status, H.assess("prices", prices("2026-11-13T17:15:00Z"), later).status);

const noSettlement = H.assess("nordic-futures", { futures: {}, generated_utc: PRICE_BUILD }, morning, nordicCtx);
assert.equal(noSettlement.observation, null);
assert.notEqual(noSettlement.status, "fresh");
assert.equal(noSettlement.observationText, H.BLANK);
assert.ok(noSettlement.observationText.indexOf("10:47") < 0);

const curves = H.assess("curve-nordic", {
  generated: PRICE_BUILD,
  curves: { "nordic-sys": { latest: "2026-11-10" }, ttf: { latest: "2026-11-10" }, brent: { latest: "2026-11-12" }, ho: { latest: "2026-11-12" } }
}, morning);
assert.equal(curves.observation, "2026-11-10");
assert.ok(curves.observationText.indexOf("10 Nov 2026") >= 0, curves.observationText);
assert.ok(curves.observationText.indexOf("10:47") < 0, curves.observationText);
assert.equal(curves.status, "fresh");
const brent = H.assess("curve-brent", {
  generated: PRICE_BUILD,
  curves: { brent: { latest: "2026-11-12" } }
}, morning);
assert.equal(brent.observation, "2026-11-12");
assert.notEqual(brent.observationText, curves.observationText);

const news = H.assess("news", {
  generated_utc: "2026-11-12T02:09:26Z",
  tabs: { energy: [{ time: "2026-11-12T01:55:32Z", title: "OPEC" }] }
}, morning);
assert.equal(news.observation, "2026-11-12T01:55:32Z");
assert.equal(news.status, "late");
assert.ok(news.observationText.indexOf("10:47") < 0, news.observationText);
assert.ok(news.observationText.indexOf("02:55") >= 0, news.observationText);
assert.notEqual(news.observationText, news.buildText);
assert.ok(news.buildText.indexOf("03:09") >= 0, news.buildText);

const review = H.assess("research-review", { as_of: "2026-10-27" }, morning);
const snap = H.assess("research-snapshot", { generated_at: "2026-11-01T14:38:02+00:00" }, morning);
assert.equal(review.reviewText, "27 Oct 2026");
assert.equal(review.observationText, H.BLANK);
assert.equal(snap.observationText, "1 Nov 2026");
assert.equal(snap.reviewText, H.BLANK);
assert.notEqual(review.reviewText, snap.observationText);
assert.ok(snap.buildText.indexOf("1 Nov 2026") >= 0, snap.buildText);
assert.notEqual(snap.buildText, snap.observationText);
assert.equal(review.status, "fresh");
assert.equal(snap.status, "fresh");
assert.equal(H.judge("weekly", { observation: "2026-11-01" }, morning), "late");
assert.ok(!/once a week/i.test(review.expectation + snap.expectation));
assert.ok(!/weekday morning/i.test(review.expectation));

const yields = H.assess("yields", {
  generated_utc: PRICE_BUILD,
  yields10: { asof: { US: "2026-11-10", DE: "2026-11-11", GB: "2026-11-11", FR: "2026-11-11", CH: "2026-11-11" } }
}, morning);
assert.equal(yields.status, "fresh");
assert.ok(yields.observationText.indexOf("US 10 Nov 2026") >= 0, yields.observationText);
assert.ok(yields.observationText.indexOf("10:47") < 0, yields.observationText);

const gas = H.assess("gas", { generated_utc: PRICE_BUILD, areas: { EU: { last: "2026-11-10" } } }, morning);
assert.equal(gas.observation, "2026-11-10");
assert.equal(gas.status, "fresh");
assert.ok(gas.observationText.indexOf("10 Nov 2026") >= 0);
assert.notEqual(gas.observationText, gas.buildText);

const ids = H.feeds.map(f => f.id);
["nordic-prices", "nordic-tomorrow", "nordic-futures", "nordic-generation", "nordic-hydro", "nordic-weather", "nordic-price-normals", "nordic-monthly"].forEach(id => {
  assert.ok(ids.includes(id), id);
  assert.ok(H.feeds.find(f => f.id === id).path.indexOf("/nordic-v2/") >= 0, id);
});
assert.ok(H.feeds.find(f => f.id === "nordic-tomorrow").path.endsWith("tomorrow.json"));
assert.ok(H.feeds.find(f => f.id === "nordic-price-normals").path.endsWith("prices_normals.json"));

const ui = fs.readFileSync(path.join(root, "health.js"), "utf8");
assert.ok(ui.indexOf("r.observationText") >= 0);
assert.ok(ui.indexOf("r.buildText") >= 0);
assert.ok(ui.indexOf("r.reviewText") >= 0);
assert.ok(!/Last updated/.test(ui));

console.log("health dates ok");
