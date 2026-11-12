/* Hand-written company notes: Eco Atlantic file is valid, and the company
   page loads data/company_notes/<SYMBOL>.json into the Notes block. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const eco = JSON.parse(fs.readFileSync(path.join(root, "data/company_notes/ECO.L.json"), "utf8"));
assert.strictEqual(eco.sym, "ECO.L");
assert.ok(Array.isArray(eco.notes) && eco.notes.length >= 1, "ECO.L has at least one note");
const note = eco.notes[0];
assert.strictEqual(note.title, "Orinduik: Navitas option and the Guyana licence (12 Nov 2026)");
assert.strictEqual(note.date, "2026-11-12");
const heads = note.sections.map(s => s.heading);
assert.deepStrictEqual(heads, [
  "Where things stand",
  "Why it is slow",
  "Any falling-out?",
  "Likely path"
]);
assert.strictEqual(note.sections[1].label, "Analyst read");
assert.strictEqual(note.sections[3].label, "Analyst judgement");
assert.ok(note.sources.length >= 5, "sources listed");
note.sources.forEach(s => {
  assert.ok(/^https:\/\//.test(s.url), "source has https url: " + s.label);
});

function walk(x) {
  if (Array.isArray(x)) return x.forEach(walk);
  if (x && typeof x === "object") return Object.entries(x).forEach(([k, v]) => {
    if (k === "url") return;
    walk(v);
  });
  if (typeof x === "string") {
    assert.ok(!x.includes("&"), "note text must not contain &: " + x.slice(0, 80));
    assert.ok(!/share price/i.test(x) && !/\b\d+(\.\d+)?\s*p\b/.test(x), "no share prices: " + x.slice(0, 80));
  }
}
walk(eco);

const js = fs.readFileSync(path.join(root, "company.js"), "utf8");
assert.ok(js.includes('data/company_notes/"+encodeURIComponent(k)+".json'), "company.js loads per-symbol notes");
assert.ok(/function notesSlot\(/.test(js), "notesSlot remains the Notes block");
assert.ok(js.includes('id="coNotes"') || js.includes('sec("coNotes"'), "Notes section id is coNotes");

const css = fs.readFileSync(path.join(root, "company.css"), "utf8");
assert.ok(css.includes(".co-note-art"), "company.css styles the note");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(/company\.js\?v=/.test(html), "index loads company.js with a cache-bust");

// The deploy file list copies all of data/, so the note ships with the site.
const stage = path.join(root, "_site_notes_test");
execFileSync("bash", [path.join(root, "scripts/site_files.sh"), stage], { cwd: root, stdio: "pipe" });
assert.ok(fs.existsSync(path.join(stage, "data/company_notes/ECO.L.json")), "site_files.sh publishes the Eco note");
fs.rmSync(stage, { recursive: true, force: true });

console.log("test_company_notes: ok");
