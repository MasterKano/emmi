/* Edition cards and the Editions page under Live Pulse (#live/editions) for Pulse (Morning Pulse, Weekend Pulse), CSI and Special briefs.
   Everything comes from pulse/editions.json, pulse/latest.json, csi/editions.json and specials/editions.json. No edition date lives here.
   Latest is the newest edition that went out by email. The Briefs page does not send email. */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function clockTime(label) {
    if (!label) return "";
    var comma = String(label).lastIndexOf(", ");
    return comma >= 0 ? String(label).slice(comma + 2) : String(label);
  }

  function publishedShort(text) {
    var t = String(text || "");
    if (/nothing is published|not published|no edition/i.test(t)) return "not published";
    if (/published/i.test(t)) return "published on the site";
    return t;
  }

  function deliveryShort(item) {
    if (item.email_sent === true) return "email sent";
    if (item.email_sent === false) return "email not sent";
    var t = String(item.delivery || "");
    if (/not sent|no email has been sent|no email/i.test(t)) return "email not sent";
    if (/\bsent\b/i.test(t)) return "email sent";
    return t;
  }

  /* Accepts one edition (pulse/latest.json) or a list file ({ editions: [...] }). */
  function latestOf(data) {
    if (!data) return null;
    if (!Array.isArray(data.editions)) return data;
    var list = data.editions;
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].email_sent) return list[i];
    return list[0] || null;
  }

  function lines(item, missing) {
    if (!item || !item.edition || !item.kind || !item.publication || !item.delivery) return missing;
    var parts = [];
    if (item.email_sent && item.sent) parts.push("Sent " + clockTime(item.sent));
    else if (item.built) parts.push("Built " + clockTime(item.built));
    parts.push(publishedShort(item.publication));
    parts.push(deliveryShort(item));
    return { headline: item.edition + " · " + (item.kind_label || (item.kind === "weekday Pulse" ? "Morning Pulse" : item.kind)), detail: parts.join(" · ") };
  }

  function pulseLines(data) {
    return lines(latestOf(data), { headline: "Edition date not loaded", detail: "Publication and delivery were not loaded" });
  }

  function csiLines(data) {
    if (data == null) return { headline: "No edition published yet", detail: "Edition list not loaded" };
    return lines(latestOf(data), { headline: "No edition published yet", detail: "Nothing is published · No email has been sent" });
  }

  function card(href, label, l) {
    return '<a href="' + href + '"><span class="bk">' + label + '</span><span class="bw">' + esc(l.headline) + '</span><span class="bs">' + esc(l.detail) + "</span></a>";
  }

  function specialsLatest(data) {
    return latestOf(data);
  }

  function specialsLines(data) {
    var item = latestOf(data);
    if (data == null) return { headline: "No special brief published yet", detail: "Edition list not loaded" };
    if (!item) return { headline: "No special brief published yet", detail: "Nothing is published · No email has been sent" };
    var headline = item.title || item.label || (item.edition + " · " + (item.kind_label || item.kind || "Special brief"));
    var parts = [];
    if (item.email_sent && item.sent) parts.push("Sent " + clockTime(item.sent));
    else if (item.built) parts.push("Built " + clockTime(item.built));
    parts.push(publishedShort(item.publication));
    parts.push(deliveryShort(item));
    return { headline: headline, detail: parts.join(" · ") };
  }

  function specialsBlock(specials) {
    var item = latestOf(specials);
    var href = (item && item.href) || "/emmi/specials/";
    return '<section class="ov-block" id="hmSpecials"><header class="bh"><h2>Special briefs</h2></header>'
      + '<nav class="briefs" aria-label="Special briefs">' + card(href, "Special brief", specialsLines(specials)) + "</nav></section>";
  }

  function html(pulse, csi, specials) {
    return '<nav class="briefs" aria-label="Latest briefs">' + card("/emmi/pulse/", "Latest Pulse", pulseLines(pulse)) + card("/emmi/csi/", "CSI", csiLines(csi)) + "</nav>" + specialsBlock(specials);
  }

  function zurichToday() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (err) { return ""; }
  }

  function truthLine(name, item, today) {
    if (!item) return name + ": the edition list did not load.";
    var sent = item.email_sent ? "emailed at " + clockTime(item.sent) : "not emailed";
    if (item.day === today) return name + ": today's edition (" + item.edition + ") was " + sent + " and is on the site.";
    return name + ": no edition dated today is on the site yet. The latest is " + item.edition + ", " + sent + ".";
  }

  function optionText(item) {
    return item.label + " · " + (item.email_sent ? "sent " + clockTime(item.sent) : "not emailed");
  }

  function picker(name, aria, data) {
    var list = (data && data.editions) || [];
    if (!list.length) return "";
    var latest = latestOf(data);
    /* Emailed editions first; the 05:30 numbers-only pilots sit in their own group at the end so they do not clutter the list. */
    var pilots = list.filter(function (item) { return !item.email_sent; });
    var opt = function (item) { return '<option value="' + esc(item.href) + '"' + (item === latest ? " selected" : "") + ">" + esc(optionText(item)) + "</option>"; };
    return '<label class="brief-pick" style="flex-wrap:wrap;max-width:100%"><span style="flex:0 0 auto">' + esc(name) + '</span><select data-brief-pick style="flex:1 1 240px;min-width:0;max-width:100%;text-overflow:ellipsis" aria-label="' + esc(aria) + '">'
      + list.filter(function (item) { return item.email_sent; }).map(opt).join("")
      + (pilots.length ? '<optgroup label="Numbers-only pilots (site only, not emailed)">' + pilots.map(opt).join("") + "</optgroup>" : "")
      + "</select></label>";
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = '<div class="brief-page"><p class="kicker">Live Pulse · Editions</p><h1>Pulse and CSI editions</h1><p class="lede">Every Morning Pulse, Weekend Pulse, CSI and special brief edition that went out by email, as sent. Publication on the site and email delivery are separate. This page does not send email.</p><div id="briefCards"></div><p class="note" id="briefTruth">Checking the edition files…</p><div id="briefPicks"></div></div>';
    var one = function (url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    Promise.all([one("pulse/editions.json"), one("csi/editions.json"), one("specials/editions.json")]).then(function (res) {
      var pulse = res[0], csi = res[1], specials = res[2];
      var cards = host.querySelector("#briefCards");
      var truth = host.querySelector("#briefTruth");
      var picks = host.querySelector("#briefPicks");
      if (cards) cards.innerHTML = html(pulse, csi, specials);
      var today = zurichToday();
      if (truth) truth.textContent = truthLine("Pulse", latestOf(pulse), today) + " " + truthLine("CSI", latestOf(csi), today) + " " + truthLine("Special briefs", latestOf(specials), today);
      if (picks) {
        picks.innerHTML = picker("Pulse edition", "Pulse editions, newest first", pulse) + picker("CSI edition", "CSI editions, newest first", csi) + picker("Special brief", "Special briefs, newest first", specials);
        picks.querySelectorAll("select[data-brief-pick]").forEach(function (select) {
          select.addEventListener("change", function () { if (select.value) location.href = select.value; });
        });
      }
    });
  }

  window.EMMIBriefs = { pulseLines: pulseLines, csiLines: csiLines, specialsLines: specialsLines, latestOf: latestOf, html: html, mount: mount };
})();
