/* Home cards and the Briefs page for Market Pulse and CSI.
   Everything comes from pulse/editions.json, pulse/latest.json and csi/editions.json. No edition date lives here.
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
    return { headline: item.edition + " · " + item.kind, detail: parts.join(" · ") };
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

  function html(pulse, csi) {
    return '<nav class="briefs" aria-label="Latest briefs">' + card("/emmi/pulse/", "Latest Pulse", pulseLines(pulse)) + card("/emmi/csi/", "CSI", csiLines(csi)) + "</nav>";
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
    return '<label class="brief-pick" style="flex-wrap:wrap;max-width:100%"><span style="flex:0 0 auto">' + esc(name) + '</span><select data-brief-pick style="flex:1 1 240px;min-width:0;max-width:100%;text-overflow:ellipsis" aria-label="' + esc(aria) + '">'
      + list.map(function (item) {
        return '<option value="' + esc(item.href) + '"' + (item === latest ? " selected" : "") + ">" + esc(optionText(item)) + "</option>";
      }).join("") + "</select></label>";
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = '<div class="brief-page"><a class="lp-cta" href="#briefs/live"><b>Live Pulse</b><span>The Pulse, story first, refreshing through the day →</span></a><p class="kicker">Briefs</p><h1>Pulse and CSI</h1><p class="lede">Every Market Pulse and CSI edition that went out by email, as sent. Publication on the site and email delivery are separate. This page does not send email.</p><div id="briefCards"></div><p class="note" id="briefTruth">Checking the edition files…</p><div id="briefPicks"></div></div>';
    var one = function (url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    Promise.all([one("pulse/editions.json"), one("csi/editions.json")]).then(function (res) {
      var pulse = res[0], csi = res[1];
      var cards = host.querySelector("#briefCards");
      var truth = host.querySelector("#briefTruth");
      var picks = host.querySelector("#briefPicks");
      if (cards) cards.innerHTML = html(pulse, csi);
      var today = zurichToday();
      if (truth) truth.textContent = truthLine("Pulse", latestOf(pulse), today) + " " + truthLine("CSI", latestOf(csi), today);
      if (picks) {
        picks.innerHTML = picker("Pulse edition", "Market Pulse editions, newest first", pulse) + picker("CSI edition", "CSI editions, newest first", csi);
        picks.querySelectorAll("select[data-brief-pick]").forEach(function (select) {
          select.addEventListener("change", function () { if (select.value) location.href = select.value; });
        });
      }
    });
  }

  window.EMMIBriefs = { pulseLines: pulseLines, csiLines: csiLines, latestOf: latestOf, html: html, mount: mount };
})();
