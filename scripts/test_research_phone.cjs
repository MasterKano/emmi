/* Phone Research journey: period, sector and watchlist lead; the review starts
   collapsed; secondary filters sit in More; the view labels stay on one line. */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

async function main() {
  const phone = await import(pathToFileURL(path.join(root, "research/app/phone.js")).href);
  assert.deepEqual(phone.eventFilterPlacement(true), {
    bar: ["period", "sector", "watch"],
    moreLead: ["search", "significance", "direction", "country"],
  });
  assert.deepEqual(phone.eventFilterPlacement(false).bar, [
    "search", "significance", "direction", "period", "sector", "country", "watch",
  ]);
  assert.deepEqual(phone.eventFilterPlacement(false).moreLead, []);
  assert.equal(phone.briefingStartsOpen(true, () => null), false);
  assert.equal(phone.briefingStartsOpen(true, () => "0"), false);
  assert.equal(phone.briefingStartsOpen(true, (key) => key === "moonshot-briefing-phone" ? "1" : "0"), true);
  assert.equal(phone.briefingStartsOpen(false, () => null), true);
  assert.equal(phone.briefingStartsOpen(false, () => "0"), false);
  assert.equal(phone.PHONE_MEDIA, "(max-width: 600px)");

  const app = read("research/app/app.js");
  assert.ok(app.includes('from "./phone.js?v=20261112s"'));
  assert.ok(app.includes("eventFilterPlacement(isResearchPhone())"));
  assert.ok(app.includes("briefingStartsOpen(isResearchPhone(), read)"));
  assert.ok(app.includes("Research reviewed through"));
  const cards = app.slice(app.indexOf("function renderCards"), app.indexOf("const SVG_NS"));
  const order = ["card-what", 'el("time"', "tl-cos", "chip-row"].map((bit) => cards.indexOf(bit));
  assert.ok(order.every((index) => index >= 0) && order.every((index, i) => i === 0 || order[i - 1] < index), "event cards lead with headline, then date, then company, then badges");

  const screen = read("research/app/smallcaps.js");
  const screenCards = screen.slice(screen.indexOf("function renderCards"), screen.indexOf("function renderLists"));
  assert.ok(screenCards.indexOf("cap-lead") < screenCards.indexOf("card-top"), "screen cards lead with the latest event");
  assert.ok(screenCards.indexOf("card-top") < screenCards.indexOf("cap-stage"));
  assert.ok(screen.includes('class: "cap-headline"'));

  const css = read("research/app/styles.css");
  assert.ok(css.includes("width: 100%"));
  assert.ok(/max-width:\s*1280px/.test(css));
  assert.ok(!/max-width:\s*720px/.test(css), "research reintroduced a 720px column");
  assert.ok(css.includes("padding-bottom: calc(96px + env(safe-area-inset-bottom))"));
  assert.ok(css.includes(".segment.view-tabs button { min-width: 0; white-space: nowrap; }"));
  const phoneCss = css.slice(css.indexOf("@media (max-width: 600px)"));
  assert.ok(phoneCss.includes("grid-template-columns: 1fr 1fr"));
  assert.ok(phoneCss.includes('[data-slot="period"]'));
  assert.ok(phoneCss.includes(".segment.view-tabs button"));
  assert.ok(phoneCss.includes("white-space: nowrap") || css.includes(".segment.view-tabs button { min-width: 0; white-space: nowrap; }"));
  const narrowCss = css.slice(css.lastIndexOf("@media (max-width: 820px)"));
  assert.ok(narrowCss.includes(".cap-headline { order: 1"));
  assert.ok(narrowCss.includes(".cap-date { order: 2"));

  const html = read("research/app/index.html");
  assert.ok(html.includes("styles.css?v=20261112s"));
  assert.ok(html.includes("app.js?v=20261112s"));
  assert.ok(html.includes("smallcaps.js?v=20261112s"));
  assert.ok(html.includes("27 Oct 2026"));
  const nav = html.slice(html.indexOf('class="main-nav"'), html.indexOf("</nav>"));
  assert.equal((nav.match(/class="main-tab/g) || []).length, 8);
  ["Home", "Markets", "Oil &amp; gas", "Mining", "Nordic power", "Gas storage", "Grid &amp; data centres", "Research"].forEach((label) => {
    assert.ok(nav.includes(label), label);
  });
  ["Mkt", "Oil", "Mine", "Power", "Gas", "Grid", "Res"].forEach((label) => assert.ok(nav.includes(label), label));
  assert.ok(html.includes(">Screen<") && html.includes("Coming up") && html.includes("Countries") && html.includes("Watchlist"));
  const briefing = JSON.parse(read("research/app/data/briefing.json"));
  assert.equal(briefing.as_of, "2026-10-27");

  if (process.env.SKIP_CHROME) {
    console.log("Research phone layout: source contract PASS (chrome skipped)");
    return;
  }
  await assertInBrowser();
  console.log("Research phone layout: primary filters, collapsed review, one-line tabs: PASS");
}

function dataFile(name) {
  const moon = path.join(root, "research/source/moonshot", name);
  const app = path.join(root, "research/app/data", name);
  if (fs.existsSync(moon)) return moon;
  if (fs.existsSync(app)) return app;
  return null;
}

function startServer() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".csv": "text/csv" };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    let file = null;
    if (pathname === "/gate.js") file = path.join(root, "gate.js");
    else if (pathname === "/clocks.js") file = path.join(root, "clocks.js");
    else if (pathname.startsWith("/research/data/")) file = dataFile(path.basename(pathname));
    else if (pathname === "/research" || pathname === "/research/") file = path.join(root, "research/app/index.html");
    else if (pathname.startsWith("/research/")) file = path.join(root, "research/app", pathname.slice("/research/".length));
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function assertInBrowser() {
  const server = await startServer();
  const { port } = server.address();
  const userDir = fs.mkdtempSync(path.join("/tmp", "emmi-phone-"));
  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    `--remote-debugging-port=0`,
    `--user-data-dir=${userDir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let debugPort = 0;
  chrome.stderr.on("data", (buf) => {
    const match = String(buf).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
    if (match) debugPort = Number(match[1]);
  });
  const deadline = Date.now() + 10000;
  while (!debugPort && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  if (!debugPort) throw new Error("chrome did not open a debugging port");
  try {
    const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    let next = 1;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
    const send = (method, params = {}, sessionId) => {
      const id = next++;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const ev = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send("Page.enable", {}, sessionId);
    const HASH = "b6e0165919e79c5c3d8a77ef8d30722856e1bb44b1b08556e11c97c4886c9d1e";
    async function openResearch(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 800 }, sessionId);
      await send("Page.navigate", { url: `http://127.0.0.1:${port}/research/` }, sessionId);
      await ev(`new Promise((resolve) => {
        const tick = () => {
          if (document.getElementById("emmaGate") || (document.body && document.body.dataset.ready === "true")) resolve(true);
          else setTimeout(tick, 50);
        };
        tick();
      })`);
      await ev(`localStorage.setItem("emmaGate","${HASH}"); localStorage.setItem("moonshot-theme","light"); localStorage.removeItem("moonshot-briefing"); localStorage.removeItem("moonshot-briefing-phone"); localStorage.removeItem("moonshot-tab"); "set"`);
      await send("Page.reload", { ignoreCache: true }, sessionId);
      await ev(`new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          if (document.body && document.body.dataset.ready === "true" && !document.documentElement.classList.contains("emma-locked")) return resolve(true);
          if (Date.now() - start > 20000) return reject(new Error("research did not load"));
          setTimeout(tick, 100);
        };
        tick();
      })`);
    }
    function probe() {
      return ev(`(() => {
        const slot = (name) => {
          const node = document.querySelector("[data-slot='" + name + "']");
          const rect = node ? node.getBoundingClientRect() : null;
          const more = document.getElementById("events-more");
          return {
            missing: !node,
            top: rect ? Math.round(rect.top) : null,
            height: rect ? Math.round(rect.height) : 0,
            width: rect ? Math.round(rect.width) : 0,
            inMore: !!(node && more && more.contains(node)),
            shown: !!(node && rect && rect.height > 0 && getComputedStyle(node).display !== "none"),
          };
        };
        const details = document.getElementById("briefingDetails");
        const wrap = getComputedStyle(document.querySelector("main.wrap"));
        const tabs = [...document.querySelectorAll(".view-tabs button")].map((button) => {
          const range = document.createRange();
          range.selectNodeContents(button);
          const box = button.getBoundingClientRect();
          return { text: button.textContent.trim(), lines: range.getClientRects().length, overflow: button.scrollWidth - button.clientWidth, top: Math.round(box.top), height: Math.round(box.height) };
        });
        const nav = [...document.querySelectorAll(".main-nav .main-tab")].map((tab) => {
          const box = tab.getBoundingClientRect();
          return { text: (tab.innerText || "").replace(/\\s+/g, " ").trim(), top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right) };
        });
        const card = document.querySelector("#cards .card");
        const cardOrder = card ? ["card-what", "time", "tl-cos", "chip-row"].map((sel) => {
          const node = card.querySelector(sel === "time" ? "time" : "." + sel);
          return node ? Math.round(node.getBoundingClientRect().top) : null;
        }) : [];
        return {
          summary: details && details.querySelector("summary") ? details.querySelector("summary").textContent : "",
          briefingOpen: !!(details && details.open),
          moreOpen: !!(document.getElementById("events-more") && document.getElementById("events-more").open),
          slots: Object.fromEntries(["period", "sector", "watch", "search", "significance", "direction", "country"].map((name) => [name, slot(name)])),
          wrap: { maxWidth: wrap.maxWidth, width: wrap.width },
          pad: getComputedStyle(document.body).paddingBottom,
          tabs,
          nav,
          cardOrder,
          innerHeight: window.innerHeight,
        };
      })()`);
    }

    await openResearch(375, 812);
    let page = await probe();
    assert.equal(page.briefingOpen, false, "review starts open on a phone");
    assert.ok(page.summary.includes("27 Oct 2026"), page.summary);
    assert.equal(page.moreOpen, false);
    for (const name of ["period", "sector", "watch"]) {
      assert.equal(page.slots[name].inMore, false, name);
      assert.equal(page.slots[name].shown, true, name);
      assert.ok(page.slots[name].top >= 0 && page.slots[name].top < page.innerHeight, name + " is below the first screen");
    }
    assert.ok(page.slots.period.width > 240, "period control is too narrow to show the range");
    for (const name of ["search", "significance", "direction", "country"]) {
      assert.equal(page.slots[name].inMore, true, name + " is still in the top row");
      assert.equal(page.slots[name].shown, false, name + " is visible without opening More");
    }
    assert.equal(page.wrap.maxWidth, "1280px");
    assert.ok(!page.wrap.width.startsWith("720"));
    assert.ok(page.pad.startsWith("96"), page.pad);
    assert.equal(page.tabs.length, 5);
    page.tabs.forEach((tab) => {
      assert.equal(tab.lines, 1, tab.text + " wraps");
      assert.ok(tab.overflow <= 1, tab.text + " is clipped");
    });
    assert.deepEqual(page.tabs.map((tab) => tab.text), ["Screen", "Events", "Coming up", "Countries", "Watchlist"]);
    assert.ok(page.cardOrder.length === 4 && page.cardOrder.every((top, i) => i === 0 || page.cardOrder[i - 1] <= top), "event row order " + page.cardOrder.join(","));
    assert.deepEqual(page.nav.map((tab) => tab.text), ["Home", "Mkt", "Oil", "Mine", "Power", "Gas", "Grid", "Res"]);

    await ev(`document.getElementById("events-more").open = true`);
    page = await probe();
    assert.equal(page.moreOpen, true);
    for (const name of ["search", "significance", "direction", "country"]) {
      assert.equal(page.slots[name].shown, true, name + " did not open with More");
    }
    await ev(`document.querySelector(".view-tabs [data-view='smallcaps']").click()`);
    await ev(`new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (document.querySelector("#smallcaps-cards .cap-headline")) return resolve(true);
        if (Date.now() - start > 10000) return reject(new Error("screen cards did not render"));
        setTimeout(tick, 100);
      };
      tick();
    })`);
    const screenOrder = await ev(`(() => {
      const card = document.querySelector("#smallcaps-cards .card");
      return ["cap-headline", "cap-date", "cap-name", "cap-stage"].map((sel) => {
        const node = card.querySelector("." + sel);
        return node ? Math.round(node.getBoundingClientRect().top) : null;
      });
    })()`);
    assert.ok(screenOrder.every((top) => top != null), "screen row is missing a lead field");
    assert.ok(screenOrder[0] <= screenOrder[1] && screenOrder[1] <= screenOrder[2] && screenOrder[2] <= screenOrder[3], "screen row order " + screenOrder.join(","));

    await openResearch(390, 844);
    page = await probe();
    assert.equal(page.briefingOpen, false);
    page.tabs.forEach((tab) => {
      assert.equal(tab.lines, 1, "390 " + tab.text);
      assert.ok(tab.overflow <= 1, "390 clip " + tab.text);
    });
    for (const name of ["period", "sector", "watch"]) {
      assert.equal(page.slots[name].shown, true, "390 " + name);
      assert.ok(page.slots[name].top < page.innerHeight, "390 " + name);
    }

    await openResearch(1280, 900);
    page = await probe();
    assert.equal(page.briefingOpen, true, "desktop review should stay expanded");
    assert.ok(page.summary.includes("27 Oct 2026"));
    assert.equal(page.wrap.maxWidth, "1280px");
    for (const name of ["search", "significance", "direction", "period", "sector", "country", "watch"]) {
      assert.equal(page.slots[name].inMore, false, "desktop hid " + name);
      assert.equal(page.slots[name].shown, true, "desktop " + name);
    }
    assert.equal(page.nav.length, 8);
    const tops = page.nav.map((tab) => tab.top);
    assert.ok(Math.max(...tops) - Math.min(...tops) <= 2, "desktop nav wrapped: " + JSON.stringify(page.nav));
    assert.deepEqual(page.nav.map((tab) => tab.text), ["Home", "Markets", "Oil & gas", "Mining", "Nordic power", "Gas storage", "Grid & data centres", "Research"]);
    ws.close();
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
