/* Theme, clocks are in clocks.js, and a future CSI edition list.
   Reads the same theme keys as the rest of EMMI. Does not invent brief text. */
(function () {
  "use strict";

  function readTheme() {
    var theme = "dark";
    try {
      var moon = localStorage.getItem("moonshot-theme");
      if (moon === "light" || moon === "dark") theme = moon;
      var main = JSON.parse(localStorage.getItem("markets-monitor:v6") || "null");
      if (main && (main.theme === "light" || main.theme === "dark")) theme = main.theme;
    } catch (err) {}
    return theme;
  }

  function writeTheme(theme) {
    try { localStorage.setItem("moonshot-theme", theme); } catch (err) {}
    try {
      var raw = localStorage.getItem("markets-monitor:v6");
      var main = raw ? JSON.parse(raw) : {};
      if (main && typeof main === "object") {
        main.theme = theme;
        localStorage.setItem("markets-monitor:v6", JSON.stringify(main));
      }
    } catch (err) {}
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#202124");
    var button = document.getElementById("themeButton");
    if (!button) return;
    button.textContent = theme === "dark" ? "Light" : "Dark";
    button.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  }

  function fitFrame(frame) {
    if (!frame) return;
    var fit = function () {
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        var h = Math.max(doc.body ? doc.body.scrollHeight : 0, doc.documentElement.scrollHeight);
        if (h > 80) {
          frame.style.height = (h + 8) + "px";
          frame.setAttribute("scrolling", "no");
        }
      } catch (err) {}
    };
    frame.addEventListener("load", function () {
      fit();
      setTimeout(fit, 200);
      setTimeout(fit, 900);
    });
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") fit();
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* A drop-in edition is shown only when the file already names date, publication and delivery. */
  function editionCard(item) {
    if (!item || !item.day || !item.edition || !item.publication || !item.delivery) return "";
    var href = item.href || (item.day + "/");
    return '<a href="' + esc(href) + '">' + esc(item.edition) + "</a>"
      + '<p class="meta">Edition date ' + esc(item.edition) + ". "
      + esc(item.source || "Source date is recorded on the edition.") + "</p>"
      + '<div class="split"><p><b>Publication</b> ' + esc(item.publication) + "</p>"
      + "<p><b>Delivery</b> " + esc(item.delivery) + "</p></div>";
  }

  function loadCsi(root) {
    var url = root.getAttribute("data-editions");
    if (!url) return;
    fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      var list = data && data.editions;
      if (!list || !list.length) return;
      var host = document.getElementById("editionHost");
      if (!host) return;
      if (root.getAttribute("data-editions-mode") === "latest") {
        var item = list[0];
        if (!editionCard(item)) return;
        var facts = document.querySelectorAll("#editionFacts .fact dd");
        if (facts[0]) facts[0].textContent = item.edition;
        if (facts[1]) facts[1].textContent = item.source || "Source date is recorded on the edition.";
        var pub = document.querySelector(".is-publication p");
        var del = document.querySelector(".is-delivery p");
        if (pub) pub.textContent = item.publication;
        if (del) del.textContent = item.delivery;
        var empty = document.getElementById("emptyEdition");
        if (empty) empty.hidden = true;
        var lede = document.querySelector(".lede");
        if (lede) lede.textContent = "This is the site page for the published brief. It is not the email. Edition date and source dates stay separate from publication and delivery.";
        var frameSrc = item.href || (item.day + "/");
        host.innerHTML = '<p class="edition-note">The brief below is the published edition, at its own width. This page is not the email.</p>'
          + '<div class="edition-slot"><iframe class="edition-frame" title="Published CSI edition" src="' + esc(frameSrc) + '"></iframe></div>';
        fitFrame(host.querySelector("iframe"));
        return;
      }
      var items = list.map(editionCard).filter(Boolean);
      if (!items.length) return;
      var emptyList = document.getElementById("emptyArchive");
      if (emptyList) emptyList.hidden = true;
      host.innerHTML = "<ul class=\"archive-list\">" + items.map(function (html) {
        return "<li>" + html + "</li>";
      }).join("") + "</ul>";
    }).catch(function () {});
  }

  applyTheme(readTheme());
  var button = document.getElementById("themeButton");
  if (button) {
    button.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      writeTheme(next);
      applyTheme(next);
    });
  }
  document.querySelectorAll("iframe.edition-frame").forEach(fitFrame);
  loadCsi(document.body);
  window.EMMIEditions = { readTheme: readTheme, editionCard: editionCard };
})();
