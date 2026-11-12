/* Home cards for Latest Pulse and CSI.
   Dates come from pulse/latest.json and csi/editions.json. This file does not store an edition date.
   Home shows a short status line. The full publication and delivery text stays on the Pulse and CSI pages. */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function builtTime(built) {
    if (!built) return "";
    var comma = String(built).lastIndexOf(", ");
    return comma >= 0 ? String(built).slice(comma + 2) : String(built);
  }

  function publishedShort(text) {
    var t = String(text || "");
    if (/nothing is published|not published|no edition/i.test(t)) return "not published";
    if (/published/i.test(t)) return "published on the site";
    return t;
  }

  function deliveryShort(text) {
    var t = String(text || "");
    if (/not sent|no email has been sent|no email/i.test(t)) return "email not sent";
    if (/\bsent\b/i.test(t)) return "email sent";
    return t;
  }

  function shortDetail(built, publication, delivery) {
    var time = builtTime(built);
    var parts = [];
    if (time) parts.push("Built " + time);
    parts.push(publishedShort(publication));
    parts.push(deliveryShort(delivery));
    return parts.join(" · ");
  }

  function pulseLines(meta) {
    if (!meta || !meta.edition || !meta.kind || !meta.built || !meta.publication || !meta.delivery) {
      return { headline: "Edition date not loaded", detail: "Publication and delivery were not loaded" };
    }
    return {
      headline: meta.edition + " · " + meta.kind,
      detail: shortDetail(meta.built, meta.publication, meta.delivery)
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
    return {
      headline: item.edition + kind,
      detail: shortDetail(item.built, item.publication, item.delivery)
    };
  }

  function card(href, label, lines) {
    return '<a href="' + href + '"><span class="bk">' + label + '</span><span class="bw">' + esc(lines.headline) + '</span><span class="bs">' + esc(lines.detail) + "</span></a>";
  }

  function html(pulse, csi) {
    return '<nav class="briefs" aria-label="Latest briefs">' + card("/emmi/pulse/", "Latest Pulse", pulseLines(pulse)) + card("/emmi/csi/", "CSI", csiLines(csi)) + "</nav>";
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = '<div class="brief-page"><p class="kicker">Briefs</p><h1>Pulse and CSI</h1><p class="lede">Publication and delivery are separate. This page does not send email.</p><div id="briefCards"></div><p class="note" id="briefTruth">Checking the edition files…</p></div>';
    const one = url => fetch(url, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([one("pulse/latest.json"), one("csi/editions.json"), one("pulse/latest.json")]).then(([pulse]) => {
      const cards = host.querySelector("#briefCards");
      const truth = host.querySelector("#briefTruth");
      if (cards && window.EMMIBriefs) cards.innerHTML = window.EMMIBriefs.html(pulse, null);
      fetch("csi/editions.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(csi => {
        if (cards && window.EMMIBriefs) cards.innerHTML = window.EMMIBriefs.html(pulse, csi);
      }).catch(() => {});
      const day = pulse && pulse.edition_iso;
      const today = "2026-11-12";
      const hasToday = day === today;
      if (truth) truth.textContent = hasToday
        ? "The edition dated 12 November 2026 is the one in the site files."
        : "12 November 2026 has no Pulse edition in the site files. The latest published edition is " + ((pulse && pulse.edition) || "not loaded") + ". Email was not sent for that edition. No email is sent from this page.";
      const pick = document.createElement("label");
      pick.className = "brief-pick";
      pick.innerHTML = 'Edition <select aria-label="Past Pulse editions"><option value="pulse/2026-11-11/">11 November 2026 · numbers-only pilot</option></select>';
      host.querySelector(".brief-page").appendChild(pick);
      pick.querySelector("select").addEventListener("change", e => { if (e.target.value) location.href = e.target.value; });
    });
  }

  window.EMMIBriefs = { pulseLines: pulseLines, csiLines: csiLines, html: html, mount: mount };
})();
