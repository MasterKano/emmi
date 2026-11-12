/* Latest Pulse and CSI: site pages, stamps, archive, chrome, phone, no email rewrite. */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execSync } = require("child_process");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function staticContract() {
  const css = read("editions.css");
  assert.ok(/\.wrap \{\s*width: 100%;\s*max-width: 1280px;\s*margin: 0 auto;/.test(css), "page wrap is 1280");
  assert.ok(!/max-width:\s*720px/.test(css), "no 720px page column");
  assert.ok(!/#0b0f16/.test(css), "no navy");
  assert.ok(css.includes("--bg: #fff") && css.includes("--panel: #f8f9fa") && css.includes("--accent: #1a73e8"));
  assert.ok(css.includes("--bg: #202124") && css.includes("--panel: #303134"));
  assert.ok(css.includes("padding-bottom: calc(96px + env(safe-area-inset-bottom))"));
  const zones = ["America/New_York", "Europe/London", "Europe/Zurich", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Australia/Sydney"];

  for (const file of ["pulse/index.html", "pulse/archive/index.html", "csi/index.html", "csi/archive/index.html"]) {
    const html = read(file);
    assert.ok(!html.includes("gate.js"), file + " must stay outside the password gate");
    assert.ok(/name="robots" content="noindex/.test(html), file + " noindex");
    assert.ok(html.includes("editions.css?v=20261112v"), file + " cache bust");
    assert.ok(html.includes("Back to EMMI"), file);
    assert.ok(html.includes("https://masterkano.github.io/emmi/"), file);
    assert.ok(html.includes('id="pageAsof"'), file);
    assert.ok(html.includes("2026-11-12T14:03:00+01:00"), file);
    assert.ok(html.includes("Zurich"), file);
    assert.ok(html.includes(">Publication<") && html.includes(">Delivery<"), file);
    zones.forEach((zone) => assert.ok(html.includes('data-zone="' + zone + '"'), file + " " + zone));
    const nav = html.slice(html.indexOf('class="main-nav"'), html.indexOf("</nav>"));
    assert.equal((nav.match(/class="main-tab/g) || []).length, 8, file);
    ["Home", "Markets", "Oil &amp; gas", "Mining", "Nordic power", "Gas storage", "Grid &amp; data centres", "Research"].forEach((label) => {
      assert.ok(nav.includes(label), file + " " + label);
    });
    assert.ok(!nav.includes("Pulse") && !nav.includes("CSI") && !nav.includes(">Csi<"), file + " nav stays at eight");
  }

  const pulse = read("pulse/index.html");
  assert.ok(pulse.includes("Wednesday 11 November 2026"));
  assert.ok(pulse.includes("Tuesday 10 November 2026"));
  assert.ok(pulse.includes("Monday 9 November 2026"));
  assert.ok(pulse.includes("07:27 Zurich"));
  assert.ok(pulse.includes("Email not sent"));
  assert.ok(pulse.includes('href="/emmi/pulse/archive/"'));
  assert.ok(pulse.includes('src="2026-11-11/"'));
  assert.ok(pulse.includes("numbers-only pilot"));
  assert.ok(!pulse.includes("7,521"), "latest page does not copy prices out of the edition");

  const archive = read("pulse/archive/index.html");
  assert.ok(archive.includes("/emmi/pulse/2026-11-11/"));
  assert.ok(archive.includes("numbers-only pilot"));
  assert.ok(archive.includes('href="/emmi/pulse/"'));

  const edition = read("pulse/2026-11-11/index.html");
  assert.ok(edition.includes("numbers-only pilot"));
  assert.ok(edition.includes("Market Pulse — Wed 11 Nov: markets at the Tue 10 Nov close"));
  assert.ok(edition.includes("max-width:640px"));

  const csi = read("csi/index.html");
  assert.ok(csi.includes("No edition is published yet"));
  assert.ok(csi.includes("No email has been sent"));
  assert.ok(csi.includes('href="/emmi/csi/archive/"'));
  assert.ok(!/Brent|S&amp;P 500|\$\d/.test(csi));
  assert.ok(csi.includes("no headlines"));
  const manifest = JSON.parse(read("csi/editions.json"));
  assert.deepEqual(manifest.editions, []);
  assert.ok(read("csi/archive/index.html").includes("No editions yet"));

  const home = read("index.html");
  const homeNav = home.slice(home.indexOf('id="mainNav"'), home.indexOf("</nav>"));
  assert.equal((homeNav.match(/class="main-tab/g) || []).length, 8);
  assert.ok(!homeNav.includes("Pulse") && !homeNav.includes(">CSI<"));
  assert.ok(home.includes("home.js?v=20261112x"));
  assert.ok(home.includes("briefs.js?v=20261112x"));
  assert.ok(home.includes("v2/home/live.css?v=20261112u"));
  const homeJs = read("home.js");
  const briefsJs = read("briefs.js");
  assert.ok(homeJs.includes('"/emmi/pulse/latest.json"'));
  assert.ok(homeJs.includes('"/emmi/csi/editions.json"'));
  assert.ok(homeJs.includes("What changed"));
  assert.ok(!/11 Nov|14:03|2026-11-11/.test(homeJs), "home.js must not bake an edition date");
  assert.ok(!/11 Nov|14:03|2026-11-11/.test(briefsJs), "briefs.js must not bake an edition date");
  assert.ok(briefsJs.includes("No edition published yet"));
  const latestFile = JSON.parse(read("pulse/latest.json"));
  assert.equal(latestFile.day, "2026-11-11");
  assert.ok(latestFile.edition && latestFile.kind && latestFile.built && latestFile.publication && latestFile.delivery);

  const status = execSync("git status --porcelain", { cwd: root, encoding: "utf8" });
  const forbidden = [
    "scripts/pulse_auto/pulse_auto.py",
    "scripts/pulse_auto/pulse_auto.sh",
    "scripts/pulse_auto/mark_policy.py",
    "scripts/pulse_auto/pulse_status.py",
    "pulse/2026-11-11/",
    "research/app/phone.js",
    "research/app/app.js",
    "research/app/styles.css",
    "research/app/comingup.js",
    "research/app/smallcaps.js",
  ];
  forbidden.forEach((file) => assert.ok(!status.includes(file), "email or locked file in the diff: " + file));
  assert.ok(!/master|email\.html|weekday/i.test(status), status);

  const sandbox = { window: {}, document: { readyState: "complete", body: { getAttribute() { return null; } }, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; }, documentElement: { getAttribute() { return "dark"; }, setAttribute() {}, style: {} } }, localStorage: { getItem() { return null; }, setItem() {} } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("editions.js"), sandbox);
  assert.equal(sandbox.EMMIEditions.editionCard({}), "");
  assert.equal(sandbox.EMMIEditions.editionCard({ day: "2026-11-20", edition: "Thursday 20 November 2026" }), "");
  const card = sandbox.EMMIEditions.editionCard({
    day: "2026-11-20",
    edition: "Thursday 20 November 2026",
    publication: "Published on this site.",
    delivery: "Email not sent for this edition.",
    source: "Source date 19 November 2026.",
  });
  assert.ok(card.includes("Publication") && card.includes("Delivery"));
  assert.ok(card.includes("Email not sent"));
  assert.ok(!card.includes("7,521"));

  vm.runInContext(read("briefs.js"), sandbox);
  const later = sandbox.EMMIBriefs.pulseLines({
    edition: "Friday 13 November 2026",
    kind: "numbers-only pilot",
    built: "Friday 13 November 2026, 06:10 Zurich",
    publication: "Published on this site.",
    delivery: "Email not sent for this edition.",
  });
  assert.ok(later.headline.includes("Friday 13 November 2026") && later.headline.includes("numbers-only pilot"));
  assert.equal(later.detail, "Built 06:10 Zurich · published on the site · email not sent");
  const current = sandbox.EMMIBriefs.pulseLines(latestFile);
  assert.equal(current.headline, latestFile.edition + " · " + latestFile.kind);
  assert.equal(current.detail, "Built 07:27 Zurich · published on the site · email not sent");
  assert.ok(!current.detail.includes("This is the site copy") && !current.detail.includes("weekday Pulse email"));
  const sent = sandbox.EMMIBriefs.pulseLines(Object.assign({}, latestFile, { delivery: "Email sent for this edition." }));
  assert.equal(sent.detail, "Built 07:27 Zurich · published on the site · email sent");
  assert.ok(!later.detail.includes("This is the site copy") && !later.detail.includes("Putting the edition"));
  assert.ok(!/11 November|14:03/.test(later.headline + later.detail));
  const unloaded = sandbox.EMMIBriefs.pulseLines(null);
  assert.equal(unloaded.headline, "Edition date not loaded");
  assert.ok(!/11 Nov|14:03/.test(unloaded.headline + unloaded.detail));
  const emptyCsi = sandbox.EMMIBriefs.csiLines({ editions: [] });
  assert.equal(emptyCsi.headline, "No edition published yet");
  assert.ok(emptyCsi.detail.includes("No email has been sent"));
}

function startServer() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/emmi") pathname = "/emmi/";
    if (!pathname.startsWith("/emmi/")) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    let rel = pathname.slice("/emmi/".length);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function fetchText(port, pathname) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  staticContract();
  const server = await startServer();
  const { port } = server.address();
  try {
    const pulse = await fetchText(port, "/emmi/pulse/");
    assert.equal(pulse.status, 200);
    assert.ok(pulse.text.includes("Latest Pulse") && pulse.text.includes("14:03") && pulse.text.includes("Zurich"));
    const archive = await fetchText(port, "/emmi/pulse/archive/");
    assert.equal(archive.status, 200);
    assert.ok(archive.text.includes("/emmi/pulse/2026-11-11/"));
    const edition = await fetchText(port, "/emmi/pulse/2026-11-11/");
    assert.equal(edition.status, 200);
    assert.ok(edition.text.includes("numbers-only pilot"));
    const csi = await fetchText(port, "/emmi/csi/");
    assert.equal(csi.status, 200);
    assert.ok(csi.text.includes("No edition is published yet"));
    const csiArchive = await fetchText(port, "/emmi/csi/archive/");
    assert.equal(csiArchive.status, 200);
    assert.ok(csiArchive.text.includes("No editions yet"));
    const manifest = await fetchText(port, "/emmi/csi/editions.json");
    assert.deepEqual(JSON.parse(manifest.text).editions, []);
    if (process.env.SKIP_CHROME) {
      console.log("Pulse and CSI pages: source contract PASS (chrome skipped)");
      return;
    }
    await assertInBrowser(port);
  } finally {
    server.close();
  }
  console.log("Pulse and CSI pages: stamps, archive, chrome, phone: PASS");
}

async function assertInBrowser(port) {
  const userDir = fs.mkdtempSync(path.join("/tmp", "emmi-editions-"));
  const chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${userDir}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let debugPort = 0;
  chrome.stderr.on("data", (buf) => {
    const match = String(buf).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
    if (match) debugPort = Number(match[1]);
  });
  const deadline = Date.now() + 15000;
  while (!debugPort && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  if (!debugPort) throw new Error("chrome did not open a debugging port");
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
  const shotDir = process.env.EMMI_SHOTS || "";
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

  async function openPage(pathname, width, theme) {
    const height = width >= 1000 ? 1100 : 900;
    await ev(`try {
      localStorage.setItem("emmaGate","${HASH}");
      localStorage.setItem("moonshot-theme","${theme}");
      const cur = JSON.parse(localStorage.getItem("markets-monitor:v6") || "null") || {};
      cur.theme = "${theme}";
      localStorage.setItem("markets-monitor:v6", JSON.stringify(cur));
    } catch (e) {}
    "set"`);
    await send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: width < 800,
    }, sessionId);
    await send("Page.navigate", { url: `http://127.0.0.1:${port}${pathname}` }, sessionId);
    const waitReady = `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (!document.body || !document.documentElement) {
          if (Date.now() - start > 15000) return resolve("nobody");
          return setTimeout(tick, 40);
        }
        const here = location.pathname;
        const want = "${pathname}";
        if (here !== want && here !== want + "index.html" && here + "/" !== want) {
          if (Date.now() - start > 15000) return resolve("wrong-page:" + here);
          return setTimeout(tick, 40);
        }
        if (document.documentElement.classList.contains("emma-locked")) {
          localStorage.setItem("emmaGate", "${HASH}");
          localStorage.setItem("moonshot-theme", "${theme}");
          const cur = JSON.parse(localStorage.getItem("markets-monitor:v6") || "null") || {};
          cur.theme = "${theme}";
          localStorage.setItem("markets-monitor:v6", JSON.stringify(cur));
          return resolve("locked");
        }
        const edition = document.getElementById("pageAsof");
        const briefs = document.querySelector(".briefs");
        const clocks = document.querySelector(".clock-value");
        const clockReady = clocks && clocks.textContent && clocks.textContent.trim().length >= 4;
        const homeView = document.getElementById("homeView");
        const briefsText = briefs ? briefs.textContent : "";
        const contentReady = !!edition || briefsText.includes("Latest Pulse");
        const homeShown = !homeView || getComputedStyle(homeView).display !== "none";
        const briefsSettled = !homeView || (briefsText.includes("Latest Pulse") && !briefsText.includes("Edition date not loaded"));
        if (contentReady && clockReady && homeShown && briefsSettled && document.querySelector(".main-nav")) return resolve("ready");
        if (Date.now() - start > 15000) return resolve("timeout:" + [document.title, document.documentElement.className, !!(document.querySelector(".main-nav")), (document.querySelector(".clock-value") || {}).textContent, ((document.querySelector(".briefs") || {}).textContent || "").slice(0, 80), (document.body && document.body.className) || ""].join(" | "));
        setTimeout(tick, 80);
      };
      tick();
    })`;
    let ready = await ev(waitReady);
    if (ready === "locked") {
      await send("Page.reload", { ignoreCache: true }, sessionId);
      ready = await ev(waitReady);
    }
    if (ready !== "ready") throw new Error("page not ready: " + pathname + " " + ready);
    await ev(`document.documentElement.setAttribute("data-theme","${theme}"); "ok"`);
    await ev(`new Promise((resolve) => {
      const frame = document.querySelector("iframe.edition-frame");
      if (!frame) return resolve(true);
      const start = Date.now();
      const tick = () => {
        if (frame.getBoundingClientRect().height > 1500 || Date.now() - start > 3000) return resolve(true);
        setTimeout(tick, 100);
      };
      tick();
    })`);
  }

  function probe(width) {
    return ev(`(() => {
      const tabs = [...document.querySelectorAll(".main-nav .main-tab")];
      const clocks = [...document.querySelectorAll(".clock-block")];
      const wrap = document.querySelector("main.wrap, #homeView .hm2");
      const theme = document.getElementById("themeButton");
      const nav = document.querySelector(".main-nav");
      window.scrollTo(0, document.documentElement.scrollHeight);
      const end = document.getElementById("pageEnd");
      const navBox = nav.getBoundingClientRect();
      const endBox = end ? end.getBoundingClientRect() : null;
      const themeBox = theme.getBoundingClientRect();
      const bg = getComputedStyle(document.body).backgroundColor;
      const pad = getComputedStyle(document.body).paddingBottom;
      const wrapCs = wrap ? getComputedStyle(wrap) : null;
      return {
        tabs: tabs.length,
        tabTops: tabs.map((el) => Math.round(el.getBoundingClientRect().top)),
        labels: tabs.map((el) => el.innerText.replace(/\\s+/g, " ").trim()),
        clockTops: clocks.map((el) => Math.round(el.getBoundingClientRect().top)),
        clockLabels: clocks.map((el) => el.querySelector(".clock-label").textContent),
        zones: clocks.map((el) => el.querySelector(".clock-value").getAttribute("data-zone")),
        wrapMax: wrapCs ? wrapCs.maxWidth : "",
        wrapWidth: wrap ? Math.round(wrap.getBoundingClientRect().width) : 0,
        bodyWidth: Math.round(document.body.getBoundingClientRect().width),
        bg,
        pad,
        themeW: Math.round(themeBox.width),
        themeH: Math.round(themeBox.height),
        themeBefore: getComputedStyle(theme, "::before").content,
        navTop: Math.round(navBox.top),
        navH: Math.round(navBox.height),
        endBottom: endBox ? Math.round(endBox.bottom) : null,
        innerHeight: window.innerHeight,
        text: document.body.innerText.slice(0, 4000),
      };
    })()`);
  }

  const pages = [
    ["pulse", "/emmi/pulse/"],
    ["pulse-archive", "/emmi/pulse/archive/"],
    ["csi", "/emmi/csi/"],
    ["csi-archive", "/emmi/csi/archive/"],
    ["home", "/emmi/"],
  ];
  for (const theme of ["dark", "light"]) {
    for (const width of [1280, 375, 390]) {
      for (const [name, pathname] of pages) {
        await openPage(pathname, width, theme);
        const report = await probe(width);
        const where = `${name} ${width} ${theme}`;
        assert.equal(report.tabs, 8, where + " tabs " + report.labels.join("|"));
        assert.ok(report.labels.some((label) => label.includes("Research") || label.includes("Res")), where);
        assert.ok(!report.labels.some((label) => /Pulse|CSI/.test(label)), where + " " + report.labels.join("|"));
        if (width === 1280) {
          const spread = Math.max(...report.tabTops) - Math.min(...report.tabTops);
          assert.ok(spread < 2, where + " nav wrapped " + report.tabTops.join(","));
          const clockSpread = Math.max(...report.clockTops) - Math.min(...report.clockTops);
          assert.ok(clockSpread < 2, where + " clocks wrapped " + report.clockLabels.join(","));
          assert.ok(report.wrapMax === "1280px" || report.wrapWidth >= 1200, where + " wrap " + report.wrapMax + " " + report.wrapWidth);
          assert.ok(report.wrapWidth > 720, where);
        } else {
          assert.ok(report.navTop > report.innerHeight * 0.7, where + " nav not at bottom " + report.navTop);
          assert.ok(report.pad.startsWith("96"), where + " pad " + report.pad);
          assert.ok(report.endBottom == null || report.endBottom <= report.navTop + 1, where + " content under nav " + report.endBottom + " vs " + report.navTop);
          assert.equal(report.themeW, 32, where + " theme " + report.themeW);
          assert.ok(String(report.themeBefore).includes("◐"), where + " theme icon " + report.themeBefore);
          ["Mkt", "Oil", "Mine", "Power", "Gas", "Grid", "Res"].forEach((label) => {
            assert.ok(report.labels.some((text) => text.includes(label)), where + " missing " + label + " in " + report.labels.join("|"));
          });
        }
        assert.deepEqual(report.zones, ["America/New_York", "Europe/London", "Europe/Zurich", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Australia/Sydney"], where);
        assert.equal(report.clockLabels.includes("Shanghai") && report.clockLabels.includes("Sydney") && report.clockLabels.includes("London"), true, where);
        const bg = report.bg.replace(/\s/g, "");
        if (theme === "light") assert.ok(bg === "rgb(255,255,255)", where + " " + bg);
        else assert.ok(bg === "rgb(32,33,36)", where + " " + bg);
        if (name === "pulse") {
          assert.ok(report.text.includes("Latest Pulse"), where);
          assert.ok(/publication/i.test(report.text) && /delivery/i.test(report.text), where);
          assert.ok(report.text.includes("Email not sent"), where);
        }
        if (name === "csi") assert.ok(report.text.includes("No edition is published yet"), where);
        if (name === "home") {
          assert.ok(/latest pulse/i.test(report.text) && /what changed/i.test(report.text), where);
          const latestMeta = JSON.parse(read("pulse/latest.json"));
          assert.ok(report.text.includes(latestMeta.edition), where);
          assert.ok(report.text.includes(latestMeta.kind), where);
          const builtTime = latestMeta.built.slice(latestMeta.built.lastIndexOf(", ") + 2);
          assert.ok(report.text.includes("Built " + builtTime), where);
          assert.ok(report.text.includes("published on the site") && report.text.includes("email not sent"), where);
          assert.ok(!report.text.includes("This is the site copy") && !report.text.includes("Putting the edition"), where);
        }
        if (shotDir) {
          await ev(`window.scrollTo(0,0); "top"`);
          const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId);
          fs.writeFileSync(path.join(shotDir, `${name}-${width}-${theme}.png`), Buffer.from(shot.data, "base64"));
        }
        console.log("ok", where);
      }
    }
  }
  ws.close();
  chrome.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
