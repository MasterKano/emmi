/* Theme, edition frame height and the edition picker on Pulse and CSI pages. Clocks are in clocks.js.
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

  /* Edition pickers are rendered into each page from editions.json; choosing one opens that edition's page. */
  function bindPickers() {
    document.querySelectorAll("select[data-edition-pick]").forEach(function (select) {
      select.addEventListener("change", function () {
        var href = select.value;
        if (href && href !== location.pathname) location.href = href;
      });
    });
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
  bindPickers();
  window.EMMIEditions = { readTheme: readTheme };
})();
