/* World clocks. Times come from the browser's IANA zone database, not a fixed offset. */
(function () {
  "use strict";
  var ZONES = [
    ["Zurich", "Europe/Zurich"],
    ["London", "Europe/London"],
    ["New York", "America/New_York"],
    ["Singapore", "Asia/Singapore"],
    ["Hong Kong", "Asia/Hong_Kong"],
    ["Shanghai", "Asia/Shanghai"],
    ["Sydney", "Australia/Sydney"]
  ];
  var started = false;
  function start(root) {
    if (started) return true;
    var scope = root || document;
    var nodes = scope.querySelectorAll(".clock-value[data-zone]");
    if (!nodes.length) return false;
    started = true;
    var fmts = [];
    for (var i = 0; i < nodes.length; i++) {
      fmts.push(new Intl.DateTimeFormat("en-GB", {
        timeZone: nodes[i].getAttribute("data-zone"),
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }));
    }
    function paint() {
      var now = new Date();
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].textContent = fmts[i].format(now);
        nodes[i].setAttribute("datetime", now.toISOString());
      }
    }
    paint();
    setInterval(paint, 1000);
    return true;
  }
  window.EMMIClocks = { zones: ZONES, start: start };
  function boot() { start(document); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
