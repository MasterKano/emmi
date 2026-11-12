/* Home cards for Latest Pulse and CSI.
   Dates come from pulse/latest.json and csi/editions.json. This file does not store an edition date. */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pulseLines(meta) {
    if (!meta || !meta.edition || !meta.kind || !meta.built || !meta.publication || !meta.delivery) {
      return { headline: "Edition date not loaded", detail: "Publication and delivery were not loaded" };
    }
    return {
      headline: meta.edition + " · " + meta.kind,
      detail: "Built " + meta.built + " · " + meta.publication + " · " + meta.delivery
    };
  }

  function csiLines(manifest) {
    if (manifest == null) {
      return { headline: "No edition published yet", detail: "Edition list not loaded" };
    }
    var list = manifest.editions;
    if (!list || !list.length) {
      return { headline: "No edition published yet", detail: "Nothing is published · No email has been sent" };
    }
    var item = list[0];
    if (!item || !item.edition || !item.publication || !item.delivery) {
      return { headline: "No edition published yet", detail: "Nothing is published · No email has been sent" };
    }
    var kind = item.kind ? " · " + item.kind : "";
    var built = item.built ? "Built " + item.built + " · " : "";
    return {
      headline: item.edition + kind,
      detail: built + item.publication + " · " + item.delivery
    };
  }

  function card(href, label, lines) {
    return '<a href="' + href + '"><span class="bk">' + label + '</span><span class="bw">' + esc(lines.headline) + '</span><span class="bs">' + esc(lines.detail) + "</span></a>";
  }

  function html(pulse, csi) {
    return '<nav class="briefs" aria-label="Latest briefs">' + card("/emmi/pulse/", "Latest Pulse", pulseLines(pulse)) + card("/emmi/csi/", "CSI", csiLines(csi)) + "</nav>";
  }

  window.EMMIBriefs = { pulseLines: pulseLines, csiLines: csiLines, html: html };
})();
