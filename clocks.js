/* World clocks with regular-session open/closed state.
   Times use the browser IANA zone database, not a fixed UTC offset.
   Regular hours (local exchange time), checked 16 Nov 2026 against the
   exchanges' own pages:
     TSX  09:30–16:00  https://tsx.com/en/trading/calendars-and-trading-hours/trading-hours
     NYSE 09:30–16:00  https://www.nyse.com/trade/trading-information
     LSE  08:00–16:30  London Stock Exchange business parameters / market practice
     STO  09:00–17:30  https://www.nasdaq.com/european-market-activity/trading-hours
     SIX  09:00–17:30  (shares) https://www.six-group.com/en/products-services/the-swiss-stock-exchange/trading/trading-provisions/trading-hours.html
     SSE  09:30–11:30 and 13:00–15:00 (continuous auction + closing auction)
          https://english.sse.com.cn/start/trading/schedule/
     HKEX 09:30–16:00  includes the Extended Morning Session 12:00–13:00
          https://www.hkex.com.hk/Global/Exchange/FAQ/Securities-Market/Trading/Securities-Market-Operations?sc_lang=en
          Half days (eves of Lunar New Year, Christmas, New Year): 09:30–12:00
     SGX  09:00–12:00 and 13:00–17:00  SGX Rulebook Practice Note 8.2.1 / 13.1
     ASX  10:00–16:00  https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours
   Holidays are full-day closures and published early/half closes for 2026–2027.
   Sources are cited on each market. SGX holidays are not included (official
   calendar could not be fetched reliably); weekends still close it.
   SSE 2027 holidays were not on the official closed-days page yet.
*/
(function () {
  "use strict";

  function closed() {
    var days = {};
    for (var i = 0; i < arguments.length; i++) days[arguments[i]] = "closed";
    return days;
  }
  function merge(a, b) {
    var out = {}, k;
    for (k in a) out[k] = a[k];
    for (k in b) out[k] = b[k];
    return out;
  }

  /* TSX: https://tsx.com/en/trading/calendars-and-trading-hours/calendar
     and Schedule for 2027 https://tsx.com/en/resource/3591/
     Christmas Eve early close 13:00 is the standing TSX/TSXV rule on that calendar. */
  var TSX_H = merge(closed(
    "2026-01-01", "2026-02-16", "2026-04-03", "2026-05-18", "2026-07-01",
    "2026-08-03", "2026-09-07", "2026-10-12", "2026-12-25", "2026-12-28",
    "2027-01-01", "2027-02-15", "2027-03-26", "2027-05-24", "2027-07-01",
    "2027-08-02", "2027-09-06", "2027-10-11", "2027-12-27", "2027-12-28"
  ), { "2026-12-24": "13:00", "2027-12-24": "13:00" });

  /* NYSE: ICE press release 23 Dec 2025,
     https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx
     Early close 13:00 ET the day after Thanksgiving, and 24 Dec 2026. 24 Dec 2027 is a full close (Christmas observed). */
  var NYSE_H = merge(closed(
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"
  ), { "2026-11-27": "13:00", "2026-12-24": "13:00", "2027-11-26": "13:00" });

  /* LSE: https://www.londonstockexchange.com/en/resources/markets-products/business-days
     recognises England & Wales bank holidays. Half days close from 12:30.
     Dates already elapsed on that page in late 2026 are the standard E&W holidays. */
  var LSE_H = merge(closed(
    "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
    "2026-08-31", "2026-12-25", "2026-12-28",
    "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31",
    "2027-08-30", "2027-12-27", "2027-12-28"
  ), { "2026-12-24": "12:30", "2026-12-31": "12:30", "2027-12-24": "12:30", "2027-12-31": "12:30" });

  /* Nasdaq Stockholm equities: https://www.nasdaq.com/european-market-activity/trading-hours
     Half-trading days 09:00–13:00. */
  var STO_H = merge(closed(
    "2026-01-01", "2026-01-06", "2026-04-03", "2026-04-06", "2026-05-01",
    "2026-05-14", "2026-06-19", "2026-12-24", "2026-12-25", "2026-12-31",
    "2027-01-01", "2027-01-06", "2027-03-26", "2027-03-29", "2027-05-06",
    "2027-06-25", "2027-12-24", "2027-12-31"
  ), {
    "2026-01-05": "13:00", "2026-04-02": "13:00", "2026-04-30": "13:00",
    "2026-05-13": "13:00", "2026-10-30": "13:00",
    "2027-01-05": "13:00", "2027-03-25": "13:00", "2027-04-30": "13:00",
    "2027-05-05": "13:00", "2027-11-05": "13:00"
  });

  /* SIX Trading Calendar 2026 and 2027 PDFs (Trading Guide). */
  var SIX_H = closed(
    "2026-01-01", "2026-01-02", "2026-04-03", "2026-04-06", "2026-05-01",
    "2026-05-14", "2026-05-25", "2026-12-24", "2026-12-25", "2026-12-31",
    "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-06", "2027-05-17",
    "2027-12-24", "2027-12-31"
  );

  /* SSE 2026: https://www.sse.com.cn/disclosure/dealinstruc/closed/
     2027 was not published there at the time of this list. */
  var SSE_H = closed(
    "2026-01-01", "2026-01-02",
    "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-23",
    "2026-04-06", "2026-05-01", "2026-05-04", "2026-05-05",
    "2026-06-19", "2026-09-25",
    "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"
  );

  /* HKEX circulars CT/075/25 (2026) and CT/077/26 (2027). Half days: morning only. */
  var HKEX_H = merge(closed(
    "2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19", "2026-04-03",
    "2026-04-06", "2026-04-07", "2026-05-01", "2026-05-25", "2026-06-19",
    "2026-07-01", "2026-10-01", "2026-10-19", "2026-12-25",
    "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-03-29",
    "2027-04-05", "2027-05-13", "2027-06-09", "2027-07-01", "2027-09-16",
    "2027-10-01", "2027-10-08", "2027-12-27"
  ), {
    "2026-02-16": "12:00", "2026-12-24": "12:00", "2026-12-31": "12:00",
    "2027-02-05": "12:00", "2027-12-24": "12:00", "2027-12-31": "12:00"
  });

  /* ASX: https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours/trading-calendar
     Early close 14:10 on the last business days before Christmas and New Year.
     ANZAC Day 26 Apr 2027 is a trading day. */
  var ASX_H = merge(closed(
    "2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-06-08",
    "2026-12-25", "2026-12-28",
    "2027-01-01", "2027-01-26", "2027-03-26", "2027-03-29", "2027-06-14",
    "2027-12-27", "2027-12-28"
  ), {
    "2026-12-24": "14:10", "2026-12-31": "14:10",
    "2027-12-24": "14:10", "2027-12-31": "14:10"
  });

  var ZONES = [
    { city: "Toronto", zone: "America/Toronto", exchange: "TSX", sessions: [["09:30", "16:00"]], holidays: TSX_H },
    { city: "New York", zone: "America/New_York", exchange: "NYSE", sessions: [["09:30", "16:00"]], holidays: NYSE_H },
    { city: "London", zone: "Europe/London", exchange: "LSE", sessions: [["08:00", "16:30"]], holidays: LSE_H },
    { city: "Stockholm", zone: "Europe/Stockholm", exchange: "STO", sessions: [["09:00", "17:30"]], holidays: STO_H },
    { city: "Zurich", zone: "Europe/Zurich", exchange: "SIX", sessions: [["09:00", "17:30"]], holidays: SIX_H },
    { city: "Shanghai", zone: "Asia/Shanghai", exchange: "SSE", sessions: [["09:30", "11:30"], ["13:00", "15:00"]], holidays: SSE_H },
    { city: "Hong Kong", zone: "Asia/Hong_Kong", exchange: "HKEX", sessions: [["09:30", "16:00"]], holidays: HKEX_H },
    { city: "Singapore", zone: "Asia/Singapore", exchange: "SGX", sessions: [["09:00", "12:00"], ["13:00", "17:00"]], holidays: {} },
    { city: "Sydney", zone: "Australia/Sydney", exchange: "ASX", sessions: [["10:00", "16:00"]], holidays: ASX_H }
  ];

  var BY_ZONE = {};
  for (var zi = 0; zi < ZONES.length; zi++) BY_ZONE[ZONES[zi].zone] = ZONES[zi];

  function toMin(hm) {
    var p = String(hm).split(":");
    return (+p[0]) * 60 + (+p[1]) + ((+p[2] || 0) / 60);
  }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function ymdFrom(p) { return p.year + "-" + p.month + "-" + p.day; }

  function parts(date, zone) {
    var bag = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23"
    }).formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") bag[part.type] = part.value;
    });
    var hour = bag.hour === "24" ? "00" : bag.hour;
    return {
      year: bag.year,
      month: bag.month,
      day: bag.day,
      weekday: bag.weekday,
      hour: hour,
      minute: bag.minute,
      second: bag.second,
      ymd: bag.year + "-" + bag.month + "-" + bag.day,
      hm: hour + ":" + bag.minute,
      minutes: toMin(hour + ":" + bag.minute + ":" + bag.second)
    };
  }

  function fromZoned(ymd, hm, zone) {
    var target = ymd + "T" + hm + ":00";
    var t = Date.parse(ymd + "T" + hm + ":00Z");
    if (!isFinite(t)) return null;
    for (var i = 0; i < 4; i++) {
      var p = parts(new Date(t), zone);
      var got = p.ymd + "T" + p.hm + ":" + p.second;
      var diff = Date.parse(got + "Z") - Date.parse(target + "Z");
      if (diff === 0) break;
      t -= diff;
    }
    return new Date(t);
  }

  function addDays(ymd, n) {
    var d = new Date(ymd + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function weekdayOf(ymd, zone) {
    return parts(fromZoned(ymd, "12:00", zone) || new Date(ymd + "T12:00:00Z"), zone).weekday;
  }

  function sessionsOn(market, ymd) {
    var wd = weekdayOf(ymd, market.zone);
    if (wd === "Sat" || wd === "Sun") return [];
    var mark = (market.holidays || {})[ymd];
    if (mark === "closed") return [];
    var sessions = market.sessions.map(function (s) { return [s[0], s[1]]; });
    if (mark && /^\d{2}:\d{2}/.test(mark)) {
      var cut = toMin(mark);
      var clipped = [];
      for (var i = 0; i < sessions.length; i++) {
        var a = toMin(sessions[i][0]), b = toMin(sessions[i][1]);
        if (cut <= a) break;
        clipped.push([sessions[i][0], cut < b ? mark : sessions[i][1]]);
      }
      return clipped;
    }
    return sessions;
  }

  function hoursLabel(sessions, fallback) {
    var list = sessions && sessions.length ? sessions : fallback;
    return list.map(function (s) { return s[0] + "–" + s[1]; }).join(", ");
  }

  function nextOpen(market, fromYmd, afterMin) {
    for (var d = 0; d < 16; d++) {
      var ymd = addDays(fromYmd, d);
      var sessions = sessionsOn(market, ymd);
      for (var i = 0; i < sessions.length; i++) {
        if (d === 0 && toMin(sessions[i][0]) <= afterMin) continue;
        return { ymd: ymd, hm: sessions[i][0], at: fromZoned(ymd, sessions[i][0], market.zone) };
      }
    }
    return null;
  }

  function prettyUntil(ms, verb, nxt, zone) {
    if (!nxt || !nxt.at || !isFinite(ms)) return "";
    var mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 60) return verb + " in " + mins + "m";
    if (mins < 24 * 60) {
      var h = Math.floor(mins / 60), m = mins % 60;
      return verb + " in " + h + "h" + (m ? " " + m + "m" : "");
    }
    var p = parts(nxt.at, zone);
    var weekdays = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
    return verb + " " + (weekdays[p.weekday] || p.weekday) + " " + p.hm;
  }

  function status(marketOrZone, date) {
    var market = typeof marketOrZone === "string" ? BY_ZONE[marketOrZone] : marketOrZone;
    if (!market) return null;
    var now = date ? new Date(date) : new Date();
    var p = parts(now, market.zone);
    var sessions = sessionsOn(market, p.ymd);
    var hol = (market.holidays || {})[p.ymd];
    var wd = p.weekday;
    var reason = "";
    if (wd === "Sat" || wd === "Sun") reason = "weekend";
    else if (hol === "closed") reason = "holiday";
    var state = "closed";
    var untilHm = null;
    var i, a, b;
    for (i = 0; i < sessions.length; i++) {
      a = toMin(sessions[i][0]);
      b = toMin(sessions[i][1]);
      if (p.minutes >= a && p.minutes < b) {
        state = "open";
        untilHm = sessions[i][1];
        break;
      }
    }
    if (state === "closed") {
      for (i = 0; i < sessions.length - 1; i++) {
        if (p.minutes >= toMin(sessions[i][1]) && p.minutes < toMin(sessions[i + 1][0])) {
          state = "lunch";
          untilHm = sessions[i + 1][0];
          reason = "lunch";
          break;
        }
      }
    }
    var next, untilAt = null, untilText = "";
    if (state === "open" || state === "lunch") {
      untilAt = fromZoned(p.ymd, untilHm, market.zone);
      next = { ymd: p.ymd, hm: untilHm, at: untilAt };
      untilText = prettyUntil(untilAt - now, state === "open" ? "closes" : "opens", next, market.zone);
    } else {
      next = nextOpen(market, p.ymd, p.minutes);
      if (next && next.at) untilText = prettyUntil(next.at - now, "opens", next, market.zone);
    }
    var todayHours = hoursLabel(sessions, market.sessions);
    var usualHours = hoursLabel(market.sessions);
    var tip = market.exchange + " " + todayHours;
    if (state === "open") tip += " · open" + (untilText ? " · " + untilText : "");
    else if (state === "lunch") tip += " · lunch" + (untilText ? " · " + untilText : "");
    else {
      tip += " · closed";
      if (reason === "holiday") tip += " · holiday";
      else if (reason === "weekend") tip += " · weekend";
      if (untilText) tip += " · " + untilText;
    }
    return {
      state: state,
      reason: reason,
      zone: market.zone,
      city: market.city,
      exchange: market.exchange,
      hours: usualHours,
      todayHours: todayHours,
      localTime: p.hm,
      ymd: p.ymd,
      tip: tip,
      until: untilText
    };
  }

  var started = false;
  var timeFmts = [];

  function bindToggle(scope) {
    var boxes = scope.querySelectorAll(".clocks");
    for (var b = 0; b < boxes.length; b++) {
      (function (box) {
        var btn = box.querySelector(".clocks-summary");
        if (!btn || btn.getAttribute("data-bound")) return;
        btn.setAttribute("data-bound", "1");
        btn.addEventListener("click", function () {
          var on = box.classList.toggle("is-open");
          btn.setAttribute("aria-expanded", on ? "true" : "false");
        });
      })(boxes[b]);
    }
  }

  function paint(nodes, now) {
    now = now || new Date();
    var openCount = 0;
    for (var i = 0; i < nodes.length; i++) {
      var block = nodes[i];
      var zone = block.getAttribute("data-zone") || (block.querySelector(".clock-value") && block.querySelector(".clock-value").getAttribute("data-zone"));
      var timeEl = block.querySelector(".clock-value");
      if (timeEl && timeFmts[i]) {
        timeEl.textContent = timeFmts[i].format(now);
        timeEl.setAttribute("datetime", now.toISOString());
      }
      var info = zone ? status(zone, now) : null;
      if (!info) continue;
      block.classList.remove("is-open", "is-lunch", "is-closed");
      block.classList.add("is-" + info.state);
      block.setAttribute("title", info.tip);
      block.setAttribute("data-state", info.state);
      var label = info.city + " " + info.exchange + " " + info.localTime + ", " + info.tip.replace(/^[^·]+ · /, "");
      block.setAttribute("aria-label", label);
      if (info.state === "open") openCount++;
    }
    var roots = document.querySelectorAll("details.clocks, .clocks");
    for (var r = 0; r < roots.length; r++) {
      var text = roots[r].querySelector(".clocks-summary-text");
      if (!text) continue;
      text.textContent = openCount ? ("Markets · " + openCount + " open") : "Markets · all closed";
    }
  }

  function start(root) {
    if (started) return true;
    var scope = root || document;
    var nodes = scope.querySelectorAll(".clock-block");
    if (!nodes.length) {
      nodes = scope.querySelectorAll(".clock-value[data-zone]");
      if (!nodes.length) return false;
    }
    started = true;
    bindToggle(scope);
    timeFmts = [];
    for (var i = 0; i < nodes.length; i++) {
      var timeEl = nodes[i].querySelector ? nodes[i].querySelector(".clock-value") : nodes[i];
      if (!timeEl || !timeEl.getAttribute) timeEl = nodes[i];
      var zone = timeEl.getAttribute("data-zone") || (nodes[i].getAttribute && nodes[i].getAttribute("data-zone"));
      timeFmts.push(new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23"
      }));
    }
    function tick() { paint(nodes, new Date()); }
    tick();
    setInterval(tick, 1000);
    return true;
  }

  window.EMMIClocks = {
    zones: ZONES,
    status: status,
    sessionsOn: sessionsOn,
    fromZoned: fromZoned,
    start: start
  };
  function boot() { start(document); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
