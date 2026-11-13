/* Upcoming events log (#events). Loads data/events.json and renders filters plus a dated list. */
(function (root) {
  "use strict";
  const TZ = "Europe/Zurich";
  const TYPE_SHORT = {
    results: "Results",
    cmd_agm: "Meetings",
    milestone: "Milestones",
    norway_round: "Norway rounds"
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const S = { data: null, err: null, type: "all", group: "all", when: "upcoming" };

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function windowEnd(ev) {
    return ev.window_end || ev.date || ev.sort_date || "";
  }
  function isPast(ev, today) {
    const end = windowEnd(ev);
    return !!(end && end < today);
  }
  function statusOf(ev, today) {
    return isPast(ev, today) ? "past" : "upcoming";
  }
  function typeLabel(ev, types) {
    const t = (types || []).find((x) => x.id === ev.type);
    return (t && t.label) || TYPE_SHORT[ev.type] || ev.type;
  }
  function groupLabel(ev, groups) {
    const g = (groups || []).find((x) => x.id === ev.group);
    return (g && g.label) || ev.group;
  }
  function fmtAsOf(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ, day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).format(d) + " Zurich";
    } catch (e) { return iso; }
  }

  function filtered(data, today) {
    const list = (data.events || []).slice().sort((a, b) => {
      const da = a.sort_date || "";
      const db = b.sort_date || "";
      if (da !== db) return da < db ? -1 : 1;
      return String(a.company).localeCompare(String(b.company));
    });
    return list.filter((ev) => {
      const st = statusOf(ev, today);
      if (S.when !== "all" && st !== S.when) return false;
      if (S.type !== "all" && ev.type !== S.type) return false;
      if (S.group !== "all" && ev.group !== S.group) return false;
      return true;
    });
  }

  function counts(data, today, pred) {
    const out = { all: 0 };
    (data.events || []).forEach((ev) => {
      if (!pred(ev, today)) return;
      out.all += 1;
      out[ev.type] = (out[ev.type] || 0) + 1;
      out["g:" + ev.group] = (out["g:" + ev.group] || 0) + 1;
    });
    return out;
  }

  function chip(id, label, on, n) {
    return '<button type="button" class="chip' + (on ? " is-on" : "") + '" data-id="' + esc(id) + '">' +
      esc(label) + (n != null ? "<small>" + n + "</small>" : "") + "</button>";
  }

  function renderItem(ev, data) {
    const today = todayISO();
    const past = isPast(ev, today);
    const typ = TYPE_SHORT[ev.type] || ev.type;
    const conf = ev.confidence === "guidance" ? "Guidance" : "Confirmed";
    const tick = ev.ticker ? '<span class="ev-tick">' + esc(ev.ticker) + (ev.exchange ? " · " + esc(ev.exchange) : "") + "</span>" : "";
    const desc = ev.description ? '<p class="ev-desc">' + esc(ev.description) + "</p>" : "";
    const src = ev.source ? '<a class="ev-src" href="' + esc(ev.source) + '" target="_blank" rel="noopener noreferrer">' + esc(ev.source_name || "Source") + "</a>" : "";
    return '<li class="ev-item ev-t-' + esc(ev.type) + (past ? " is-past" : "") + '">' +
      "<time datetime=\"" + esc(ev.date || ev.sort_date || "") + "\">" + esc(ev.date_label || ev.date || "") +
      '<span class="ev-conf">' + (past ? "Past · " : "") + esc(conf) + "</span></time>" +
      '<span class="ev-type">' + esc(typ) + "</span>" +
      '<div class="ev-main"><span class="ev-co">' + esc(ev.company) + "</span>" + tick +
      '<span class="ev-title">' + esc(ev.title) + "</span>" + desc + src + "</div></li>";
  }

  function companiesWithout(data, today) {
    const have = new Set();
    (data.events || []).forEach((ev) => {
      if (!isPast(ev, today)) have.add(ev.company);
    });
    return (data.coverage || []).filter((c) => !have.has(c.name));
  }

  function render(host) {
    if (!host) return;
    if (S.err) {
      host.innerHTML = '<div class="ev"><p class="ev-err">Could not load the events log (' + esc(S.err) + ").</p></div>";
      return;
    }
    if (!S.data) {
      host.innerHTML = '<div class="ev"><p class="ev-empty">Loading the events log…</p></div>';
      return;
    }
    const data = S.data;
    const today = todayISO();
    const whenPred = (ev) => S.when === "all" || statusOf(ev, today) === S.when;
    const typePred = (ev) => whenPred(ev) && (S.group === "all" || ev.group === S.group);
    const groupPred = (ev) => whenPred(ev) && (S.type === "all" || ev.type === S.type);
    const cType = counts(data, today, typePred);
    const cGroup = counts(data, today, groupPred);
    const rows = filtered(data, today);
    const nUp = (data.events || []).filter((ev) => !isPast(ev, today)).length;
    const nPast = (data.events || []).filter((ev) => isPast(ev, today)).length;
    const types = data.types || [];
    const groups = data.groups || [];

    const typeChips = chip("all", "All types", S.type === "all", cType.all) +
      types.map((t) => chip(t.id, t.label, S.type === t.id, cType[t.id] || 0)).join("");
    const groupChips = chip("all", "All groups", S.group === "all", cGroup.all) +
      groups.map((g) => chip(g.id, g.label, S.group === g.id, cGroup["g:" + g.id] || 0)).join("");

    const gaps = companiesWithout(data, today);
    const gapHtml = gaps.length ? '<section class="ev-gaps"><h2>No published upcoming date yet</h2>' +
      "<p>These coverage names have no confirmed or guided upcoming date in this log. Unlisted names appear only when they have announced an event. Calendars that have not yet published 2027 dates are left blank rather than estimated.</p><ul>" +
      gaps.map((c) => "<li>" + esc(c.name) + (c.ticker ? " <span class=\"ev-tick\">" + esc(c.ticker) + "</span>" : "") +
        ' <span class="ev-g">' + esc(groupLabel(c, groups)) + "</span></li>").join("") +
      "</ul></section>" : "";

    host.innerHTML =
      '<div class="ev"><header class="ev-head"><p class="kicker">Companies</p><h1>Upcoming events</h1>' +
      '<p class="lede">Results and trading updates, capital markets days and annual general meetings (AGMs), project milestones such as first oil, gas or power, final investment decisions (FIDs) and plans for development and operation (PDOs), and Norwegian licence rounds including Awards in Predefined Areas (APA) and Norwegian Offshore Directorate dates. Dates come only from company financial calendars, investor-relations pages, exchange calendars, and official Norwegian pages. A date that has not been published is left out. This log covers the Corporate Sector Intelligence list and is separate from the Research Coming up calendar. Ex-dividend dates are not included.</p>' +
      '<p class="asof">Compiled ' + esc(fmtAsOf(data.as_of)) + " · " + nUp + " upcoming · " + nPast + " past in the running log</p></header>" +
      '<div class="ev-when" role="group" aria-label="Upcoming or past">' +
      chip("upcoming", "Upcoming", S.when === "upcoming", nUp) +
      chip("past", "Past", S.when === "past", nPast) +
      chip("all", "All", S.when === "all", nUp + nPast) +
      "</div>" +
      '<div class="ev-filters">' +
      '<div class="ev-row"><span class="ev-row-l">Type</span><div class="ev-chips" data-kind="type">' + typeChips + "</div></div>" +
      '<div class="ev-row"><span class="ev-row-l">Group</span><div class="ev-chips" data-kind="group">' + groupChips + "</div></div>" +
      "</div>" +
      '<p class="ev-meta">' + (rows.length ? rows.length + " event" + (rows.length === 1 ? "" : "s") : "No events match these filters.") + "</p>" +
      (rows.length ? '<ol class="ev-list">' + rows.map((ev) => renderItem(ev, data)).join("") + "</ol>" : '<p class="ev-empty">No events match these filters.</p>') +
      gapHtml + "</div>";

    host.querySelector(".ev-when").addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]");
      if (!b) return;
      S.when = b.dataset.id;
      render(host);
    });
    host.querySelectorAll(".ev-chips").forEach((box) => {
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-id]");
        if (!b) return;
        if (box.dataset.kind === "type") S.type = b.dataset.id;
        else S.group = b.dataset.id;
        render(host);
      });
    });
  }

  async function load() {
    const url = "data/events.json?t=" + Math.floor(Date.now() / 6e4);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function mount(host) {
    if (!host) return;
    host.hidden = false;
    if (S.data || S.err) { render(host); return; }
    render(host);
    load().then((d) => { S.data = d; S.err = null; render(host); })
      .catch((e) => { S.err = (e && e.message) || "network error"; render(host); });
  }

  root.EMMIEvents = { mount: mount };
})(window);
