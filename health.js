/* Data health (#health). One row per dataset the live site shows.
   Build, observed and reviewed stay in separate cells. Status comes from health_model.js. */
(() => {
  "use strict";
  const M = window.MMHealthModel;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cache = {};
  function fetchJson(url) {
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(async r => {
      if (r.ok) return r.json();
      if (url === "research/out/chart_events.json") {
        const live = await fetch("https://masterkano.github.io/emmi/research/out/chart_events.json", { cache: "no-cache" });
        if (live.ok) return live.json();
      }
      return null;
    }).catch(() => null);
    return cache[url];
  }
  function loadModel() {
    if (window.MMHealthModel) return Promise.resolve(window.MMHealthModel);
    return new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = "health_model.js?v=20261112b";
      sc.onload = () => window.MMHealthModel ? res(window.MMHealthModel) : rej();
      sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  const dot = (row) => {
    const U = window.MMUI;
    const when = row.statusClock === "build" ? (row.build || "") : (row.observation || "");
    const shown = row.status === "missing" ? "stale" : row.status;
    const note = [row.expectation, row.note].filter(Boolean).join(" ");
    if (!U) return '<span class="fd fd-' + esc(shown) + '" title="' + esc(note) + '"></span>';
    return U.dot(when, "daily", row.label, shown, note);
  };
  function cell(label, text) {
    return '<td data-l="' + esc(label) + '">' + esc(text) + "</td>";
  }
  let box = null, last = null;
  function close() {
    if (!box) return;
    box.hidden = true;
    document.body.classList.remove("hl-open");
    if (location.hash === "#health") {
      const back = last && last !== "#health" ? last : (() => {
        const t = document.querySelector(".main-tab.is-on");
        return t ? "#" + t.dataset.v : "";
      })();
      history.replaceState(null, "", location.pathname + location.search + back);
    }
    if (box._ret) try { box._ret.focus(); } catch (e) {}
  }
  async function open() {
    if (!box) {
      box = document.createElement("div");
      box.id = "dataHealth";
      box.className = "hl-wrap";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-labelledby", "hlTitle");
      box.innerHTML = '<div class="hl-card"><div class="hl-top"><h2 id="hlTitle">Data health</h2><button type="button" class="hl-x-btn" aria-label="Close">×</button></div><p class="hl-lead"><span class="fd fd-fresh"></span>on time <span class="fd fd-late"></span>late <span class="fd fd-stale"></span>overdue or missing. Build is when the file was written. Observed is the latest point inside it. Reviewed is a human sign-off, and only Research has one. A new build does not move the observed date.</p><div id="hlBody" class="hl-body">Checking feeds…</div></div>';
      document.body.appendChild(box);
      box.addEventListener("click", e => { if (e.target === box || e.target.closest(".hl-x-btn")) close(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && box && !box.hidden) close(); });
    }
    box._ret = document.activeElement;
    box.hidden = false;
    document.body.classList.add("hl-open");
    box.querySelector(".hl-x-btn").focus();
    let model;
    try { model = await loadModel(); }
    catch (e) {
      document.getElementById("hlBody").textContent = "Data health could not be loaded.";
      return;
    }
    Object.keys(cache).forEach(k => delete cache[k]);
    const oilManifest = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/manifest.json";
    const paths = [...new Set(model.feeds.map(f => f.path).concat(oilManifest))];
    const files = {};
    await Promise.all(paths.map(async p => { files[p] = await fetchJson(p); }));
    const ctx = { nordic: files[model.feeds.find(f => f.id === "nordic-build").path], oil: files[oilManifest] };
    const now = new Date();
    const rows = model.feeds.map(f => {
      try { return model.assess(f.id, files[f.path], now, ctx); }
      catch (e) {
        return { id: f.id, group: f.group, label: f.label, source: f.source, expectation: f.expectation, status: "missing", statusClock: "observation", build: null, observation: null, review: null, buildText: model.BLANK, observationText: model.BLANK, reviewText: model.BLANK, note: "" };
      }
    });
    const groups = [...new Set(model.feeds.map(f => f.group))];
    const head = "<thead><tr><th class=\"hl-d\"><span class=\"sr-only\">Status</span></th><th>Dataset</th><th>Build</th><th>Observed</th><th>Reviewed</th><th class=\"hl-w\">On time when</th></tr></thead>";
    document.getElementById("hlBody").innerHTML = groups.map(g => {
      const body = rows.filter(r => r.group === g).map(r => {
        const word = r.status === "fresh" ? "on time" : r.status === "late" ? "late" : r.status === "missing" ? "missing" : "overdue";
        return '<tr class="hl-' + esc(r.status) + '"><td class="hl-d">' + dot(r) + '</td><td><b>' + esc(r.label) + '</b><span class="hl-src">' + esc(r.source) + "</span>" + (r.note ? '<span class="hl-x">' + esc(r.note) + "</span>" : "") + '<span class="hl-exp hl-m">' + esc(r.expectation) + '</span><span class="hl-age">' + esc(word) + "</span></td>" + cell("Build", r.buildText) + cell("Observed", r.observationText) + cell("Reviewed", r.reviewText) + '<td class="hl-exp hl-w" data-l="On time when">' + esc(r.expectation) + "</td></tr>";
      }).join("");
      return '<table class="hl-tbl"><caption>' + esc(g) + "</caption>" + head + "<tbody>" + body + "</tbody></table>";
    }).join("") + '<p class="hl-note">Checked ' + esc(window.MMUI ? MMUI.at(now.toISOString()) : now.toISOString()) + ". Times in CET.</p>";
  }
  window.addEventListener("hashchange", e => {
    if (location.hash !== "#health") {
      if (box && !box.hidden) { box.hidden = true; document.body.classList.remove("hl-open"); }
    } else {
      try { last = new URL(e.oldURL).hash; } catch (x) {}
      open();
    }
  });
  window.MMHealth = { open: open, close: close };
})();
