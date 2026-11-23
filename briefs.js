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
      + '<nav class="briefs" aria-label="Special briefs">' + card(href, "Special brief", specialsLines(specials)) + "</nav>"
      + '<p class="an-jump"><a href="#live/analysis">Search our analysis</a></p></section>';
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

  function picker(name, aria, data, siteLabel) {
    var list = (data && data.editions) || [];
    if (!list.length) return "";
    var latest = latestOf(data);
    /* Emailed editions first. Pulse pilots keep their own label; other site-only editions are not pilots. */
    var siteOnly = list.filter(function (item) { return !item.email_sent; });
    var opt = function (item) { return '<option value="' + esc(item.href) + '"' + (item === latest ? " selected" : "") + ">" + esc(optionText(item)) + "</option>"; };
    var group = siteLabel || "Numbers-only pilots (site only, not emailed)";
    return '<label class="brief-pick" style="flex-wrap:wrap;max-width:100%"><span style="flex:0 0 auto">' + esc(name) + '</span><select data-brief-pick style="flex:1 1 240px;min-width:0;max-width:100%;text-overflow:ellipsis" aria-label="' + esc(aria) + '">'
      + list.filter(function (item) { return item.email_sent; }).map(opt).join("")
      + (siteOnly.length ? '<optgroup label="' + esc(group) + '">' + siteOnly.map(opt).join("") + "</optgroup>" : "")
      + "</select></label>";
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function prettyDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    return Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1];
  }

  function haystack(item) {
    var cos = (item.companies || []).map(function (c) { return (c && c.name || "") + " " + (c && c.sym || ""); }).join(" ");
    return [item.title, item.summary, (item.topics || []).join(" "), cos, item.text, item.kind].join("\n").toLowerCase();
  }

  function matchesQuery(item, q) {
    var terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    var h = haystack(item);
    return terms.every(function (term) { return h.indexOf(term) >= 0; });
  }

  function filterItems(items, opts) {
    opts = opts || {};
    var type = opts.type || "all";
    var topic = opts.topic || "";
    var sym = opts.sym || "";
    var q = opts.q || "";
    var out = (items || []).filter(function (it) {
      if (!it) return false;
      if (type !== "all" && it.type !== type) return false;
      if (topic && (it.topics || []).indexOf(topic) < 0) return false;
      if (sym && !(it.companies || []).some(function (c) { return c && c.sym === sym; })) return false;
      return matchesQuery(it, q);
    });
    out.sort(function (a, b) {
      var byDate = String(b.date || "").localeCompare(String(a.date || ""));
      return byDate || String(a.title || "").localeCompare(String(b.title || ""));
    });
    return out;
  }

  function snippet(item, q) {
    var text = String((item && item.text) || (item && item.summary) || "");
    var terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    var low = text.toLowerCase();
    var at = -1;
    var term = "";
    terms.forEach(function (t) {
      var j = low.indexOf(t);
      if (j >= 0 && (at < 0 || j < at)) { at = j; term = t; }
    });
    if (at < 0) return String((item && item.summary) || "").slice(0, 280);
    var start = Math.max(0, at - 80);
    var end = Math.min(text.length, at + term.length + 140);
    var cut = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) cut = "…" + cut;
    if (end < text.length) cut += "…";
    return cut;
  }

  function resultHtml(item, q) {
    var when = prettyDate(item.date);
    var topics = (item.topics || []).map(function (topic) { return '<span class="an-topic">' + esc(topic) + "</span>"; }).join("");
    var cos = (item.companies || []).map(function (c) {
      if (!c || !c.sym) return "";
      return '<a href="/emmi/#co=' + esc(c.sym) + '">' + esc(c.name || c.sym) + "</a>";
    }).join("");
    return '<article class="an-hit"><p class="an-meta"><span class="an-badge">' + esc(item.kind || (item.type === "note" ? "Company note" : "Special report")) + "</span>"
      + (when ? '<time datetime="' + esc(item.date) + '">' + esc(when) + "</time>" : "") + "</p>"
      + '<h3><a href="' + esc(item.href) + '">' + esc(item.title) + "</a></h3>"
      + '<p class="an-sum">' + esc(snippet(item, q)) + "</p>"
      + (topics ? '<p class="an-topics">' + topics + "</p>" : "")
      + (cos ? '<p class="an-cos">' + cos + "</p>" : "")
      + '<p class="an-open"><a href="' + esc(item.href) + '">' + (item.type === "note" ? "Open the note" : "Open the report") + "</a></p></article>";
  }

  function mountSearch(host, opts) {
    if (!host) return;
    opts = opts || {};
    var intro = opts.heading === false ? "" : '<header class="bh"><h2>Our analysis</h2></header>'
      + '<p class="lede">Search special reports and company notes. Matching runs in this browser. Nothing is sent off the site.</p>';
    host.innerHTML = '<section class="an-search" aria-label="Our analysis">'
      + intro
      + '<form class="an-filters" role="search">'
      + '<label>Search<input type="search" data-an-q placeholder="Keyword, company or ticker" autocomplete="off" spellcheck="false"></label>'
      + '<label>Type<select data-an-type><option value="all">All</option><option value="special">Special reports</option><option value="note">Company notes</option></select></label>'
      + '<label>Topic<select data-an-topic><option value="">All topics</option></select></label>'
      + '<label>Company<select data-an-co><option value="">All companies</option></select></label>'
      + "</form>"
      + '<p class="an-count" data-an-count>Loading the analysis index…</p>'
      + '<div class="an-hits" data-an-hits></div></section>';
    var q = host.querySelector("[data-an-q]");
    var type = host.querySelector("[data-an-type]");
    var topic = host.querySelector("[data-an-topic]");
    var co = host.querySelector("[data-an-co]");
    var count = host.querySelector("[data-an-count]");
    var hits = host.querySelector("[data-an-hits]");
    var items = [];
    function paint() {
      var opts = { q: q.value, type: type.value, topic: topic.value, sym: co.value };
      var rows = filterItems(items, opts);
      count.textContent = rows.length + (rows.length === 1 ? " item" : " items");
      hits.innerHTML = rows.length ? rows.map(function (item) { return resultHtml(item, opts.q); }).join("") : '<p class="an-empty">No matching analysis.</p>';
    }
    host.querySelector("form").addEventListener("submit", function (ev) { ev.preventDefault(); paint(); });
    [q, type, topic, co].forEach(function (el) { el.addEventListener("input", paint); el.addEventListener("change", paint); });
    fetch("data/analysis_index.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      items = (data && data.items) || [];
      var topics = {};
      var companies = {};
      items.forEach(function (item) {
        (item.topics || []).forEach(function (name) { if (name) topics[name] = true; });
        (item.companies || []).forEach(function (c) { if (c && c.sym) companies[c.sym] = c.name || c.sym; });
      });
      Object.keys(topics).sort().forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        topic.appendChild(opt);
      });
      Object.keys(companies).sort(function (a, b) { return String(companies[a]).localeCompare(String(companies[b])); }).forEach(function (sym) {
        var opt = document.createElement("option");
        opt.value = sym;
        opt.textContent = companies[sym] + " (" + sym + ")";
        co.appendChild(opt);
      });
      paint();
    }).catch(function () { count.textContent = "The analysis index did not load."; });
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = '<div class="brief-page"><p class="kicker">Live Pulse · Editions</p><h1>Pulse and CSI editions</h1><p class="lede">Every Morning Pulse, Weekend Pulse, CSI and special brief edition that went out by email, as sent. Publication on the site and email delivery are separate. This page does not send email.</p><div id="briefCards"></div><p class="note" id="briefTruth">Checking the edition files…</p><div id="briefPicks"></div><div id="analysisSearch"></div></div>';
    mountSearch(host.querySelector("#analysisSearch"));
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
        picks.innerHTML = picker("Pulse edition", "Pulse editions, newest first", pulse) + picker("CSI edition", "CSI editions, newest first", csi) + picker("Special brief", "Special briefs, newest first", specials, "Site only (not emailed)");
        picks.querySelectorAll("select[data-brief-pick]").forEach(function (select) {
          select.addEventListener("change", function () { if (select.value) location.href = select.value; });
        });
      }
    });
  }

  function mountAnalysis(host) {
    if (!host) return;
    host.innerHTML = '<div class="brief-page"><p class="kicker">Live Pulse</p><h1>Our analysis</h1><p class="lede">Search special reports and company notes. Matching runs in this browser on the published index. Nothing is sent off the site.</p><p class="an-jump"><a href="#live/editions">Pulse and CSI editions</a></p><div id="analysisSearch"></div></div>';
    mountSearch(host.querySelector("#analysisSearch"), { heading: false });
  }

  window.EMMIBriefs = { pulseLines: pulseLines, csiLines: csiLines, specialsLines: specialsLines, latestOf: latestOf, html: html, mount: mount, mountAnalysis: mountAnalysis, filterItems: filterItems, snippet: snippet, matchesQuery: matchesQuery };
})();
