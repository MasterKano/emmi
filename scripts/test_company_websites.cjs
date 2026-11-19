/* Every company the panel can open has a checked official website, shown in the header and opening in a new tab. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const W = JSON.parse(fs.readFileSync(path.join(root, "data/company_websites.json"), "utf8")).sites;
const CO = JSON.parse(fs.readFileSync(path.join(root, "data/companies.json"), "utf8")).companies;
const js = fs.readFileSync(path.join(root, "company.js"), "utf8");
const nolist = [...js.matchAll(/file:"([^"]+)"/g)].map(m => m[1]);
const keys = Object.keys(CO).concat(nolist);
const missing = keys.filter(k => !W[k] || !/^https:\/\/[^/]+/.test(W[k].url));
assert.deepStrictEqual(missing, [], "companies without a checked website: " + missing.join(", "));
assert.ok(Object.values(W).every(w => w.checked && w.how), "each entry records when and how it was checked");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(/<a class="co-web" id="coWeb" target="_blank" rel="noopener noreferrer" hidden><\/a>/.test(html), "header link opens in a new tab");
assert.ok(/data\/company_websites\.json/.test(js) && /function head\(c,r\)\{setWeb\(\);/.test(js) && /EXT_ICON/.test(js), "header renders the website with an external-link icon");
assert.ok(!/company_notes\/company_websites|scripts\/sector\.py/.test(js), "not stored in Cori's paths");
console.log("company websites: " + keys.length + " names, all with a checked site: PASS");
