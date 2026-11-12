/* Pulse and CSI: emailed editions on the site, pickers, stamps, archive, chrome, phone, no email rewrite. */
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

  const pages = ["pulse/index.html", "pulse/archive/index.html", "csi/index.html", "csi/archive/index.html",
    "pulse/2026-11-12/index.html", "pulse/2026-11-11/index.html", "pulse/2026-11-11-pilot/index.html", "pulse/2026-11-07/index.html",
    "pulse/2026-11-04-update/index.html", "csi/2026-11-12/index.html", "csi/2026-11-11/index.html"];
  for (const file of pages) {
    const html = read(file);
    assert.ok(!html.includes("gate.js"), file + " must stay outside the password gate");
    assert.ok(/name="robots" content="noindex/.test(html), file + " noindex");
    assert.ok(html.includes("editions.css?v=20261112ad") && html.includes("editions.js?v=20261112ad"), file + " cache bust");
    assert.ok(html.includes("Back to EMMI"), file);
    assert.ok(html.includes("https://masterkano.github.io/emmi/"), file);
    assert.ok(html.includes('id="pageAsof"'), file);
    assert.ok(html.includes("Zurich"), file);
    assert.ok(html.includes(">Publication<") && html.includes(">Delivery<"), file);
    zones.forEach((zone) => assert.ok(html.includes('data-zone="' + zone + '"'), file + " " + zone));
    const nav = html.slice(html.indexOf('class="main-nav"'), html.indexOf("</nav>"));
    assert.equal((nav.match(/class="main-tab/g) || []).length, 6, file);
    ["Overview", "Markets", "Energy", "Companies", "Research", "Briefs"].forEach((label) => {
      assert.ok(nav.includes(label), file + " " + label);
    });
    assert.ok(!nav.includes("Pulse") && !nav.includes("CSI"), file + " nav stays at six");
  }

  const pulseList = JSON.parse(read("pulse/editions.json"));
  const csiList = JSON.parse(read("csi/editions.json"));
  assert.equal(pulseList.latest, pulseList.editions.find((e) => e.email_sent).id, "latest is the newest emailed Pulse");
  assert.equal(csiList.latest, csiList.editions.find((e) => e.email_sent).id, "latest is the newest emailed CSI");
  assert.equal(pulseList.editions.filter((e) => e.email_sent && e.kind === "weekday Pulse").length, 12);
  assert.equal(pulseList.editions.filter((e) => e.kind === "Weekend Pulse").length, 2);
  assert.equal(csiList.editions.filter((e) => e.email_sent).length, 8);
  const pilot = pulseList.editions.filter((e) => !e.email_sent);
  assert.deepEqual(pilot.map((e) => e.id), ["2026-11-11-pilot"], "only the 11 Nov pilot is not emailed");
  assert.ok(pilot[0].label.includes("numbers-only pilot"));
  const days = pulseList.editions.map((e) => e.day);
  assert.deepEqual(days, days.slice().sort().reverse(), "Pulse list is newest first");
  pulseList.editions.concat(csiList.editions).forEach((e) => {
    assert.ok(e.href && e.email && e.label && e.edition && e.publication && e.delivery, e.id);
    assert.ok(!/@/.test(e.delivery), e.id + " no addresses on the site");
    if (e.email_sent) assert.ok(/Email sent on .* at \d\d:\d\d Zurich/.test(e.delivery) && e.sent.endsWith("Zurich"), e.id);
  });
  assert.ok(!pulseList.editions.some((e) => /weekday/.test(e.kind) && /Axel/.test(e.delivery)), "weekday Pulse never claims Axel");
  assert.ok(!/Axel/.test(pulseList.editions.find((e) => e.id === "2026-11-07").delivery), "7 Nov Weekend Pulse went to Jerry only");
  assert.ok(/Axel/.test(pulseList.editions.find((e) => e.id === "2026-10-31").delivery));
  assert.ok(/Incomplete copy/.test(pulseList.editions.find((e) => e.id === "2026-11-07").caveat));
  assert.ok(/Two of the seven/.test(csiList.editions.find((e) => e.id === "2026-11-11").caveat));
  assert.ok(/08:06 update/.test(pulseList.editions.find((e) => e.id === "2026-11-04-update").label));

  const pulse = read("pulse/index.html");
  const top = pulseList.editions.find((e) => e.id === pulseList.latest);
  assert.ok(pulse.includes(top.edition) && pulse.includes(top.sent));
  assert.ok(pulse.includes('src="' + top.id + '/email.html"'));
  assert.ok(pulse.includes('href="/emmi/pulse/archive/"'));
  pulseList.editions.forEach((e) => assert.ok(pulse.includes('value="/emmi/pulse/' + e.id + '/"'), "picker has " + e.id));
  assert.ok(pulse.includes("data-edition-pick"));
  assert.ok(!pulse.includes("7,521"), "latest page does not copy prices out of the edition");
  assert.ok(read("pulse/2026-11-07/index.html").includes("Incomplete copy"));
  assert.ok(read("pulse/2026-11-11-pilot/index.html").includes("numbers-only pilot"));
  assert.ok(read("pulse/2026-11-11/index.html").includes("<h1>11 November 2026 · weekday Pulse</h1>"), "11 Nov path is the emailed Pulse");

  const archive = read("pulse/archive/index.html");
  pulseList.editions.forEach((e) => assert.ok(archive.includes("/emmi/pulse/" + e.id + "/"), "archive has " + e.id));
  assert.ok(archive.includes('href="/emmi/pulse/"'));

  const pilotEmail = read("pulse/2026-11-11-pilot/email.html");
  assert.ok(pilotEmail.includes("numbers-only pilot"));
  assert.ok(pilotEmail.includes("Market Pulse — Wed 11 Nov: markets at the Tue 10 Nov close"));

  const csi = read("csi/index.html");
  const csiTop = csiList.editions[0];
  assert.ok(csi.includes("Latest CSI") && csi.includes(csiTop.sent));
  assert.ok(csi.includes('src="' + csiTop.id + '/email.html"'));
  assert.ok(csi.includes('href="/emmi/csi/archive/"'));
  csiList.editions.forEach((e) => assert.ok(read("csi/archive/index.html").includes("/emmi/csi/" + e.id + "/")));

  const home = read("index.html");
  const homeNav = home.slice(home.indexOf('id="mainNav"'), home.indexOf("</nav>"));
  assert.equal((homeNav.match(/class="main-tab/g) || []).length, 6);
  assert.ok(!homeNav.includes("Pulse") && !homeNav.includes(">CSI<"));
  assert.ok(home.includes("home.js?v=20261112ac"));
  assert.ok(home.includes("briefs.js?v=20261112ah"));
  const homeJs = read("home.js");
  const briefsJs = read("briefs.js");
  assert.ok(homeJs.includes('"/emmi/pulse/latest.json"'));
  assert.ok(homeJs.includes('"/emmi/csi/editions.json"'));
  assert.ok(homeJs.includes("What changed"));
  assert.ok(!/11 Nov|14:03|2026-11-11/.test(homeJs), "home.js must not bake an edition date");
  assert.ok(!/11 Nov|12 Nov|14:03|2026-11-1\d/.test(briefsJs), "briefs.js must not bake an edition date");
  assert.equal((briefsJs.match(/one\("pulse\//g) || []).length, 1, "Briefs page loads the Pulse list once");
  assert.ok(briefsJs.includes("No edition published yet"));
  const latestFile = JSON.parse(read("pulse/latest.json"));
  assert.equal(latestFile.id, pulseList.latest);
  assert.ok(latestFile.email_sent === true && latestFile.edition && latestFile.kind && latestFile.sent && latestFile.publication && latestFile.delivery);

  const status = execSync("git status --porcelain", { cwd: root, encoding: "utf8" });
  const forbidden = [
    "scripts/pulse_auto/pulse_auto.sh",
    "scripts/pulse_auto/mark_policy.py",
    "scripts/pulse_auto/pulse_status.py",
    "research/app/phone.js",
    "research/app/app.js",
    "research/app/styles.css",
    "research/app/comingup.js",
    "research/app/smallcaps.js",
  ];
  forbidden.forEach((file) => assert.ok(!status.includes(file), "email or locked file in the diff: " + file));
  assert.ok(!/master/i.test(status), status);

  const sandbox = { window: {}, document: { readyState: "complete", body: { getAttribute() { return null; } }, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; }, documentElement: { getAttribute() { return "dark"; }, setAttribute() {}, style: {} } }, localStorage: { getItem() { return null; }, setItem() {} } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("editions.js"), sandbox);
  assert.ok(sandbox.EMMIEditions && sandbox.EMMIEditions.readTheme);

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
  assert.equal(current.detail, "Sent " + latestFile.sent.slice(latestFile.sent.lastIndexOf(", ") + 2) + " · published on the site · email sent");
  assert.ok(!current.detail.includes("This is the site copy"));
  assert.deepEqual(sandbox.EMMIBriefs.pulseLines(pulseList), current, "list file and latest.json give the same card");
  const csiCard = sandbox.EMMIBriefs.csiLines(csiList);
  assert.ok(csiCard.headline.startsWith(csiList.editions[0].edition) && csiCard.detail.endsWith("email sent"));
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
    const pulseList = JSON.parse(read("pulse/editions.json"));
    const csiList = JSON.parse(read("csi/editions.json"));
    for (const list of [pulseList, csiList]) {
      for (const e of list.editions) {
        const page = await fetchText(port, e.href);
        assert.equal(page.status, 200, e.href);
        assert.ok(page.text.includes(">Publication<") && page.text.includes(">Delivery<"), e.href);
        const email = await fetchText(port, e.email);
        assert.equal(email.status, 200, e.email);
        const imgs = [...email.text.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((src) => !/^(https?:|data:)/.test(src));
        for (const src of imgs) {
          const res = await fetch(`http://127.0.0.1:${port}${e.href}${src}`);
          const known = e.id === "2026-11-11" && e.href.startsWith("/emmi/csi/") && /tile-(panr_l|sivi_st)\.png/.test(src);
          assert.equal(res.status, known ? 404 : 200, e.href + src);
        }
      }
    }
    for (const p of ["/emmi/pulse/", "/emmi/pulse/archive/", "/emmi/csi/", "/emmi/csi/archive/"]) {
      assert.equal((await fetchText(port, p)).status, 200, p);
    }
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
        pick: (document.querySelector("select[data-edition-pick]") || { options: [] }).options.length,
        frameW: (() => { const f = document.querySelector("iframe.edition-frame"); return f ? Math.round(f.getBoundingClientRect().width) : 0; })(),
      };
    })()`);
  }

  const pages = [
    ["pulse", "/emmi/pulse/"],
    ["pulse-archive", "/emmi/pulse/archive/"],
    ["csi", "/emmi/csi/"],
    ["csi-archive", "/emmi/csi/archive/"],
    ["weekend-0711", "/emmi/pulse/2026-11-07/"],
    ["csi-1111", "/emmi/csi/2026-11-11/"],
    ["home", "/emmi/"],
  ];
  for (const theme of ["dark", "light"]) {
    for (const width of [1280, 375, 390]) {
      for (const [name, pathname] of pages) {
        await openPage(pathname, width, theme);
        const report = await probe(width);
        const where = `${name} ${width} ${theme}`;
        assert.equal(report.tabs, 6, where + " tabs " + report.labels.join("|"));
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
          ["Ov", "Mkt", "En", "Co", "Res", "Br"].forEach((label) => {
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
          assert.ok(report.text.includes("Email sent on"), where);
          assert.ok(report.pick > 10, where + " picker " + report.pick);
        }
        if (name === "csi") assert.ok(report.text.includes("Latest CSI") && report.text.includes("Email sent on") && report.pick >= 8, where);
        if (name === "weekend-0711") assert.ok(report.text.includes("Incomplete copy") && report.text.includes("Weekend Pulse"), where);
        if (name === "csi-1111") assert.ok(report.text.includes("Two of the seven"), where);
        if (name === "home") {
          assert.ok(/latest pulse/i.test(report.text) && /what changed/i.test(report.text), where);
          const latestMeta = JSON.parse(read("pulse/latest.json"));
          assert.ok(report.text.includes(latestMeta.edition), where);
          assert.ok(report.text.includes(latestMeta.kind), where);
          const sentTime = latestMeta.sent.slice(latestMeta.sent.lastIndexOf(", ") + 2);
          assert.ok(report.text.includes("Sent " + sentTime), where);
          assert.ok(report.text.includes("published on the site") && report.text.includes("email sent"), where);
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
