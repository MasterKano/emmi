/* Data health dates. Build time, observation date and editorial review are separate.
   Status uses the source's own expectation. A file's build time is never copied into
   the observation date. Research is input-triggered and is not judged on a weekly clock. */
(function () {
  "use strict";
  const TZ = "Europe/Zurich";
  const BLANK = "not available yet";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const US_CLOSED = new Set(["2026-11-11"]);
  const NORDIC = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/nordic-v2/";
  const CURVES = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/curves/index.json";
  const OG = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/";

  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDateUTC(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function addDays(iso, n) {
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return isoDateUTC(d);
  }
  function weekday(iso) { return new Date(String(iso).slice(0, 10) + "T12:00:00Z").getUTCDay(); }
  function weekend(iso) { const w = weekday(iso); return w === 0 || w === 6; }
  function prevWeekday(iso) {
    let d = String(iso).slice(0, 10);
    do { d = addDays(d, -1); } while (weekend(d));
    return d;
  }
  function prevBiz(iso, closed) {
    let d = String(iso).slice(0, 10);
    do { d = addDays(d, -1); } while (weekend(d) || (closed && closed.has(d)));
    return d;
  }
  function prevMonth(iso) {
    const s = String(iso).slice(0, 10);
    const y = +s.slice(0, 4), m = +s.slice(5, 7);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    return py + "-" + pad(pm);
  }
  function zurichDate(date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  function zurichHM(date) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  }
  function tzName(date) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "short" }).formatToParts(date).find(x => x.type === "timeZoneName");
    const v = p ? p.value : "";
    return v === "CET" || v === "CEST" ? v : /\+0?2/.test(v) ? "CEST" : "CET";
  }
  function dlab(iso) {
    const s = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return (+s.slice(8, 10)) + " " + MON[+s.slice(5, 7) - 1] + " " + s.slice(0, 4);
  }
  function tlab(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    const d = new Date(t);
    return dlab(zurichDate(d)) + " " + zurichHM(d) + " " + tzName(d);
  }
  function showDate(iso, kind) {
    if (!iso) return BLANK;
    if (kind === "instant") return tlab(iso) || BLANK;
    return dlab(iso) || BLANK;
  }
  function worse(a, b) {
    const rank = { fresh: 0, late: 1, stale: 2, missing: 3 };
    return (rank[b] || 0) > (rank[a] || 0) ? b : a;
  }
  function nordicBuild(ctx) { return ctx && ctx.nordic && ctx.nordic.built_at || null; }
  function oilBuild(ctx) { return ctx && ctx.oil && ctx.oil.built_at || null; }
  function quoteTime(d) {
    let best = null, bestT = -Infinity;
    const take = r => {
      if (!r || r.error || r.official || !r.market_time) return;
      const t = Date.parse(r.market_time);
      if (Number.isFinite(t) && t > bestT) { bestT = t; best = r.market_time; }
    };
    ((d && d.groups) || []).forEach(g => (g.sections || []).forEach(s => (s.rows || []).forEach(take)));
    (d && d.rows || []).forEach(take);
    return best;
  }
  function newest(list) {
    let best = null, bestT = -Infinity;
    list.forEach(iso => {
      const t = Date.parse(iso || "");
      if (Number.isFinite(t) && t > bestT) { bestT = t; best = iso; }
    });
    return best;
  }
  function dayGap(have, due) {
    const a = Date.parse(String(have).slice(0, 10) + "T12:00:00Z");
    const b = Date.parse(String(due).slice(0, 10) + "T12:00:00Z");
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 864e5);
  }
  function sessionStatus(have, due) {
    const h = String(have || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) return "missing";
    if (h >= due) return "fresh";
    if (h >= prevWeekday(due)) return "late";
    return "stale";
  }
  function calendarStatus(have, due, lateDays) {
    const gap = dayGap(have, due);
    if (gap == null) return "missing";
    if (gap <= 0) return "fresh";
    if (gap <= lateDays) return "late";
    return "stale";
  }
  function ageStatus(iso, now, freshDays, lateDays) {
    const gap = dayGap(iso, zurichDate(now));
    if (gap == null) return "missing";
    if (gap < freshDays) return "fresh";
    if (gap < lateDays) return "late";
    return "stale";
  }
  function lastSlots(now, delayMin, slotFn) {
    const lim = now.getTime() - delayMin * 6e4;
    const out = [];
    const base = new Date(lim);
    for (let k = 0; k < 10 && out.length < 2; k++) {
      const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - k));
      slotFn(day).filter(t => t <= lim).sort((a, b) => b - a).forEach(t => out.push(t));
    }
    return out.slice(0, 2);
  }
  function slotStatus(iso, now, delayMin, slotFn) {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return "missing";
    const L = lastSlots(now, delayMin, slotFn);
    if (!L.length || t >= L[0] - 5 * 6e4) return "fresh";
    if (L[1] != null && t >= L[1] - 5 * 6e4) return "late";
    return "stale";
  }
  function intraSlots(day) {
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) return [];
    const y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate(), out = [];
    for (let h = 5; h <= 21; h++) [7, 22, 37, 52].forEach(min => out.push(Date.UTC(y, m, d, h, min)));
    return out;
  }
  function newsSlots(day) {
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) return [];
    const y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate();
    return [Date.UTC(y, m, d, 5, 30), Date.UTC(y, m, d, 21, 0)];
  }
  function dealSlots(day) {
    const y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate();
    const out = [Date.UTC(y, m, d, 12, 30), Date.UTC(y, m, d, 17, 30)];
    if (day.getUTCDay() > 0 && day.getUTCDay() < 6) out.unshift(Date.UTC(y, m, d, 5, 30));
    return out;
  }
  function pipelineSlots(day) {
    const wd = day.getUTCDay();
    if (wd !== 1 && wd !== 4) return [];
    return [Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 6, 20)];
  }
  function eexDue(now) {
    const day = zurichDate(now);
    const prev = prevWeekday(day);
    /* Before 18:00 Zurich the previous session is not required. EEX often publishes
       after the close, and the daily collector may not have landed yet. */
    if (zurichHM(now) < "18:00") return prevWeekday(prev);
    return prev;
  }
  function gasDue(now) {
    const day = zurichDate(now);
    if (zurichHM(now) < "18:00") return addDays(day, -2);
    return addDays(day, -1);
  }
  function deliveryDue(now) {
    const day = zurichDate(now);
    if (zurichHM(now) >= "14:00") return addDays(day, 1);
    return day;
  }
  function expectedRun(now) {
    const day = isoDateUTC(now);
    const hm = now.toISOString().slice(11, 16);
    if (hm >= "20:40") return day + "T12:00:00Z";
    if (hm >= "08:40") return day + "T00:00:00Z";
    return addDays(day, -1) + "T12:00:00Z";
  }
  function runStatus(have, now) {
    const got = Date.parse(have || "");
    if (!Number.isFinite(got)) return "missing";
    const want = Date.parse(expectedRun(now));
    if (got >= want - 36e5) return "fresh";
    if (got >= want - 12 * 36e5 - 36e5) return "late";
    return "stale";
  }
  function eiaWeekDue(now) {
    let friday = zurichDate(now);
    while (weekday(friday) !== 5) friday = addDays(friday, -1);
    const release = addDays(friday, 5);
    if (zurichDate(now) < release) friday = addDays(friday, -7);
    return friday;
  }
  function monthStatus(obs, now) {
    const have = String(obs || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(have)) return "missing";
    const due = prevMonth(zurichDate(now));
    if (have >= due) return "fresh";
    if (have >= prevMonth(due + "-01")) return "late";
    return "stale";
  }
  function yearStatus(obs, now) {
    const y = +String(obs || "").slice(0, 4);
    if (!y) return "missing";
    const nowY = +zurichDate(now).slice(0, 4);
    if (y >= nowY - 1) return "fresh";
    if (y >= nowY - 2) return "late";
    return "stale";
  }
  function morningFile(build, now) {
    const t = Date.parse(build || "");
    if (!Number.isFinite(t)) return "missing";
    const start = Date.parse(isoDateUTC(now) + "T04:00:00Z");
    if (t >= start) return "fresh";
    if (t >= start - 864e5) return "late";
    return "stale";
  }
  function buildLagNote(build, now, hours) {
    const t = Date.parse(build || "");
    if (!Number.isFinite(t)) return "";
    if ((now.getTime() - t) / 36e5 > hours) return "The file build is older than the usual rebuild. The observation date is unchanged.";
    return "";
  }

  function judge(rule, times, now) {
    const obs = times && times.observation;
    const build = times && times.build;
    if (rule === "intra") return slotStatus(obs, now, 20, intraSlots);
    if (rule === "morningFile") return morningFile(build, now);
    if (rule === "newsCheck") return slotStatus(build, now, 30, newsSlots);
    if (rule === "dealCheck") return slotStatus(build, now, 45, dealSlots);
    if (rule === "pipeline") return slotStatus(build, now, 90, pipelineSlots);
    if (rule === "eex") return sessionStatus(obs, eexDue(now));
    if (rule === "session") return sessionStatus(obs, prevWeekday(zurichDate(now)));
    if (rule === "gas") return calendarStatus(obs, gasDue(now), 1);
    if (rule === "delivery") return calendarStatus(obs, deliveryDue(now), 1);
    if (rule === "yesterday") return calendarStatus(obs, addDays(zurichDate(now), -1), 1);
    if (rule === "era5") return ageStatus(obs, now, 9, 13);
    if (rule === "weekly") return ageStatus(obs, now, 8, 15);
    if (rule === "fileAge") return ageStatus(build, now, 8, 15);
    if (rule === "register") return ageStatus(obs, now, 5, 12);
    if (rule === "spotLag") return ageStatus(obs, now, 6, 13);
    if (rule === "eiaWeek") return calendarStatus(obs, eiaWeekDue(now), 7);
    if (rule === "month") return monthStatus(obs, now);
    if (rule === "year") return yearStatus(obs, now);
    if (rule === "run") return runStatus(obs, now);
    if (rule === "yields") {
      const asof = (times && times.yields) || {};
      const day = zurichDate(now);
      const want = { US: prevBiz(day, US_CLOSED), DE: prevWeekday(day), GB: prevWeekday(day), FR: prevWeekday(day), CH: prevWeekday(day) };
      let st = "fresh";
      Object.keys(want).forEach(k => {
        if (!asof[k]) { st = worse(st, "missing"); return; }
        st = worse(st, sessionStatus(asof[k], want[k]));
      });
      return st;
    }
    if (rule === "input" || rule === "hand") return (obs || build || (times && times.review)) ? "fresh" : "missing";
    return obs || build ? "fresh" : "missing";
  }

  function readPrices(d) {
    return { build: d.generated_utc || d.generated_cet || null, buildKind: "instant", observation: quoteTime(d), observationKind: "instant" };
  }
  function readYields(d) {
    const a = (d.yields10 && d.yields10.asof) || {};
    const parts = Object.keys(a).filter(k => a[k]).map(k => k + " " + (dlab(String(a[k]).slice(0, 10)) || BLANK));
    return { build: d.generated_utc || null, buildKind: "instant", observation: null, observationText: parts.join(" · "), yields: a };
  }
  function readNews(d) {
    const times = [];
    Object.keys(d.tabs || {}).forEach(k => (d.tabs[k] || []).forEach(it => times.push(it.time)));
    return { build: d.generated_utc || null, buildKind: "instant", observation: newest(times), observationKind: "instant" };
  }
  function readDeals(d) {
    return { build: d.generated_utc || null, buildKind: "instant", observation: newest((d.items || []).map(it => it.t || it.time)), observationKind: "instant" };
  }
  function readFutures(d, ctx) {
    const f = d.futures || {};
    const bits = [];
    ["front_month", "next_quarter"].forEach(k => {
      const row = f[k];
      if (row && row.as_of) bits.push({ contract: row.contract || k, as_of: String(row.as_of).slice(0, 10) });
    });
    bits.sort((a, b) => a.as_of < b.as_of ? -1 : 1);
    return {
      build: nordicBuild(ctx), buildKind: "instant",
      observation: bits.length ? bits[0].as_of : null,
      observationText: bits.map(x => x.contract + " settled " + dlab(x.as_of)).join(" · ")
    };
  }
  function readRegion(d, ctx) {
    const obs = (d.regions && d.regions.Nordic && d.regions.Nordic.as_of) || d.as_of;
    return { build: nordicBuild(ctx), buildKind: "instant", observation: obs ? String(obs).slice(0, 10) : null };
  }
  function readTomorrow(d, ctx) {
    return { build: nordicBuild(ctx), buildKind: "instant", observation: d.delivery_date || null };
  }
  function readAsOf(d, ctx) {
    return { build: nordicBuild(ctx), buildKind: "instant", observation: d.as_of ? String(d.as_of).slice(0, 10) : null };
  }
  function readManifest(d) {
    return { build: d.built_at || null, buildKind: "instant", observation: d.as_of ? String(d.as_of).slice(0, 10) : null };
  }
  function readCurve(d, id) {
    const c = d.curves && d.curves[id];
    return { build: d.generated || null, buildKind: "instant", observation: c && c.latest ? String(c.latest).slice(0, 10) : null };
  }
  function readGas(d) {
    const last = d.areas && d.areas.EU && d.areas.EU.last;
    return { build: d.generated_utc || null, buildKind: "instant", observation: last ? String(last).slice(0, 10) : null };
  }
  function readWx(d) {
    return { build: d.generated_utc || null, buildKind: "instant", observation: d.run_utc || null, observationKind: "instant" };
  }
  function readSpot(d, ctx) {
    const bits = ["brent_spot", "wti_spot", "henry_hub_spot"].map(k => d[k] && d[k].as_of).filter(Boolean).map(x => String(x).slice(0, 10)).sort();
    return { build: oilBuild(ctx), buildKind: "instant", observation: bits[0] || null, observationText: bits.length ? [...new Set(bits)].map(dlab).join(" · ") : "" };
  }
  function readWeekly(d, ctx) {
    const obs = d.us_commercial_crude_stocks && d.us_commercial_crude_stocks.as_of;
    return { build: oilBuild(ctx), buildKind: "instant", observation: obs ? String(obs).slice(0, 10) : null };
  }
  function readSteo(d, ctx) {
    const m = (d.meta && d.meta.last_historical_month) || "";
    return { build: oilBuild(ctx), buildKind: "instant", observation: /^\d{4}-\d{2}$/.test(m) ? m + "-01" : null, observationText: /^\d{4}-\d{2}$/.test(m) ? MON[+m.slice(5) - 1] + " " + m.slice(0, 4) : "" };
  }
  function readEi(d, ctx) {
    const y = d.meta && d.meta.data_to;
    return { build: oilBuild(ctx), buildKind: "instant", observation: y ? String(y).slice(0, 4) + "-12-31" : null, observationText: y ? String(y) : "" };
  }
  function readAnnual(d) {
    const meta = d.meta || {};
    const y = d.as_of || meta.as_of || meta.data_to;
    return { build: d.built_at || meta.built_at || null, buildKind: "instant", observation: y ? String(y).slice(0, 4) + "-12-31" : null, observationText: y ? String(y).slice(0, 4) : "" };
  }
  function readCosts(d, ctx) {
    const note = (d.meta && d.meta.note) || "";
    const dallas = (note.match(/last update (\d{1,2} \w+ \d{4})/) || [])[1];
    const checked = (note.match(/on\s+(\d{1,2} \w+ \d{4})/) || [])[1];
    const text = [dallas ? "Dallas Fed " + dallas : "", checked ? "company costs " + checked : ""].filter(Boolean).join(" · ");
    return { build: oilBuild(ctx), buildKind: "instant", observation: text ? "noted" : null, observationText: text };
  }
  function readCompanies(d, ctx) {
    return { build: oilBuild(ctx), buildKind: "instant", observation: d.as_of ? String(d.as_of).slice(0, 10) : null };
  }
  function readUsgs(d, ctx) {
    const published = d.meta && d.meta.published;
    return {
      build: oilBuild(ctx), buildKind: "instant",
      observation: "2025-12-31",
      observationText: "2025" + (published ? " · published " + (dlab(published) || published) : "")
    };
  }
  function readOutlook(d, ctx) {
    const file = ctx && ctx.oil && ctx.oil.files && ctx.oil.files["outlooks.json"];
    return { build: oilBuild(ctx), buildKind: "instant", observation: file && file.as_of ? String(file.as_of).slice(0, 10) : null };
  }
  function readGrid(d) {
    const diff = d.uk && d.uk.last_diff;
    return { build: d.generated_utc || null, buildKind: "instant", observation: diff && diff.date ? String(diff.date).slice(0, 10) : null };
  }
  function readEvents(d) {
    return { build: d.auto_checked || null, buildKind: "date", observation: null };
  }
  function readMastr(d) {
    const months = d.months || [];
    const last = months.length ? String(months[months.length - 1]) : "";
    return { build: d.generated_utc || null, buildKind: "instant", observation: /^\d{4}-\d{2}$/.test(last) ? last + "-01" : null, observationText: /^\d{4}-\d{2}$/.test(last) ? MON[+last.slice(5) - 1] + " " + last.slice(0, 4) : "" };
  }
  function readBal(d) {
    const keys = Object.keys(d.days || {}).sort();
    return { build: d.generated_utc || null, buildKind: "instant", observation: keys.length ? keys[keys.length - 1] : null };
  }
  function trackerObs(d) {
    const a = d.asof;
    if (!a) return null;
    if (typeof a === "string") return a.slice(0, 10);
    const dates = Object.keys(a).map(k => a[k]).filter(Boolean).map(x => String(x).slice(0, 10)).sort();
    return dates[0] || null;
  }
  function readTracker(d) {
    return { build: d.generated_utc || null, buildKind: "instant", observation: trackerObs(d) };
  }
  function readPipe(d) {
    return { build: d.generated_utc || null, buildKind: "instant", observation: null };
  }
  function readLand(d) {
    const dates = (d.rows || []).map(r => r.d).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ""))).sort();
    return { build: d.checked || null, buildKind: "date", observation: dates.length ? dates[dates.length - 1] : null };
  }
  function readReview(d) {
    return { build: null, observation: null, review: d.as_of ? String(d.as_of).slice(0, 10) : null };
  }
  function readSnapshot(d) {
    const gen = d.generated_at || null;
    return { build: gen, buildKind: "instant", observation: gen ? String(gen).slice(0, 10) : null, review: null };
  }
  function readReactions(d) {
    const m = String(d.as_of || "").match(/\d{4}-\d{2}-\d{2}/);
    return { build: null, observation: m ? m[0] : null };
  }

  const RESEARCH = "Runs when research inputs change. No fixed refresh clock, and not judged as a missed weekly update.";
  const NORDIC_NOTE = "Nordic v2 rebuilds about hourly. ";
  const feeds = [
    { id: "prices", group: "Markets", label: "Prices", source: "Yahoo, about 15 min delayed", path: "data/market.json", rule: "intra", clock: "observation", expectation: "Every 15 min in weekday market hours (05:00–22:00 UTC), plus the exchange delay. The observed time is the newest quote, not the file write.", read: readPrices },
    { id: "yields", group: "Markets", label: "10-year yields", source: "US Treasury, Bundesbank, BoE, SNB, CNBC (FR)", path: "data/market.json", rule: "yields", clock: "observation", expectation: "Official close from the previous local session. US Treasuries were closed on 11 Nov 2026 (Veterans Day), so 10 Nov is the latest US session until the 12 Nov close. A same-morning price-file build does not move these dates.", read: readYields },
    { id: "news", group: "Markets", label: "News headlines", source: "Publisher RSS and exchange feeds", path: "data/news.json", rule: "newsCheck", clock: "build", expectation: "The file is checked at 05:30 and 21:00 UTC on weekdays. Observed is the newest headline, which can be older than the file and older than the price file. Late means the check itself missed a run.", read: readNews },
    { id: "deals", group: "Markets", label: "Announcements", source: "Exchange and company notices", path: "data/dealflow.json", rule: "dealCheck", clock: "build", expectation: "Checked on the weekday data runs (05:30, 12:30 and 17:30 UTC). Observed is the newest announcement, which is not the file write.", read: readDeals },
    { id: "og-quotes", group: "Markets", label: "Oil and gas tile quotes", source: "Yahoo, names missing from the market file", path: "data/og-quotes.json", rule: "morningFile", clock: "build", expectation: "Filled by the weekday morning build, not the 15-minute price run. Observed is the newest quote in the file, which stays at that build.", read: readPrices },
    { id: "nordic-build", group: "Nordic power", label: "Nordic v2 build", source: "emmi-data nordic-v2 manifest", path: NORDIC + "manifest.json", rule: "yesterday", clock: "observation", buildHours: 6, expectation: NORDIC_NOTE + "Observed is the bundle as-of date. The build time is built_at.", read: readManifest },
    { id: "nordic-prices", group: "Nordic power", label: "Day-ahead prices", source: "Nord Pool system price and ENTSO-E", path: NORDIC + "prices.json", rule: "yesterday", clock: "observation", buildHours: 6, expectation: NORDIC_NOTE + "The daily series is due through yesterday. Today's auction result is the separate delivery file.", read: readRegion },
    { id: "nordic-tomorrow", group: "Nordic power", label: "Day-ahead auction", source: "Nord Pool and ENTSO-E", path: NORDIC + "tomorrow.json", rule: "delivery", clock: "observation", buildHours: 6, expectation: "The auction is about 12:42 CET. Before 14:00 Zurich the file should carry today's delivery. After 14:00 it should carry tomorrow. Observed is the delivery date.", read: readTomorrow },
    { id: "nordic-futures", group: "Nordic power", label: "Nordic power futures", source: "EEX settlements in nordic-v2 prices", path: NORDIC + "prices.json", rule: "eex", clock: "observation", buildHours: 6, expectation: "EEX publishes a session after the close, sometimes only the next morning. This file is not late on the next morning while it still holds the previous session. It is late once 18:00 Zurich has passed and the prior session is still missing. The settlement date is not the price-file build.", read: readFutures },
    { id: "nordic-generation", group: "Nordic power", label: "Generation", source: "ENTSO-E actual generation", path: NORDIC + "generation.json", rule: "yesterday", clock: "observation", buildHours: 6, expectation: NORDIC_NOTE + "Actual generation is due through yesterday.", read: readAsOf },
    { id: "nordic-hydro", group: "Nordic power", label: "Hydrology", source: "NVE reservoir statistics", path: NORDIC + "hydrology.json", rule: "weekly", clock: "observation", buildHours: 6, expectation: "Weekly reservoir statistics. Not late inside about a week. Observed is the reservoir week, not the file build.", read: readAsOf },
    { id: "nordic-weather", group: "Nordic power", label: "Weather", source: "ERA5 via Open-Meteo", path: NORDIC + "weather.json", rule: "era5", clock: "observation", buildHours: 6, expectation: "ERA5 daily means arrive several days late. Not late inside about 8 days.", read: readAsOf },
    { id: "nordic-weather-normals", group: "Nordic power", label: "Weather normals", source: "ERA5 baseline", path: NORDIC + "weather_normals.json", rule: "year", clock: "observation", expectation: "A finished baseline through the last full year. Not a daily feed.", read: readAsOf },
    { id: "nordic-price-normals", group: "Nordic power", label: "Price normals", source: "Nord Pool monthly aggregates and ENTSO-E", path: NORDIC + "prices_normals.json", rule: "year", clock: "observation", expectation: "Baseline through the last full year, plus published monthly aggregates. Not a daily feed.", read: readAsOf },
    { id: "nordic-monthly", group: "Nordic power", label: "Monthly power", source: "ENTSO-E generation, prices and inflow", path: NORDIC + "monthly.json", rule: "month", clock: "observation", expectation: "The previous calendar month. The current month is not due.", read: readAsOf },
    { id: "nordic-monthly-climate", group: "Nordic power", label: "Monthly climate", source: "ERA5 via Open-Meteo", path: NORDIC + "monthly_climate.json", rule: "era5", clock: "observation", expectation: "ERA5 monthly means follow the same multi-day lag as the daily weather file.", read: readAsOf },
    { id: "curve-nordic", group: "Futures curves", label: "Nordic system futures", source: "EEX, curves archive", path: CURVES, rule: "eex", clock: "observation", expectation: "Same EEX publication lag as Nordic power futures. Observed is the latest archived session, not the archive build.", read: d => readCurve(d, "nordic-sys") },
    { id: "curve-ttf", group: "Futures curves", label: "TTF futures", source: "EEX, curves archive", path: CURVES, rule: "eex", clock: "observation", expectation: "Same EEX publication lag. Observed is the latest archived session, not the archive build. Brent and heating oil are a different source and can be newer.", read: d => readCurve(d, "ttf") },
    { id: "curve-brent", group: "Futures curves", label: "Brent futures", source: "TradingView delayed settle", path: CURVES, rule: "session", clock: "observation", expectation: "Weekday morning archive of the delayed settle. Observed is the session date. Today or the previous session is on time.", read: d => readCurve(d, "brent") },
    { id: "curve-ho", group: "Futures curves", label: "Heating oil futures", source: "TradingView delayed settle", path: CURVES, rule: "session", clock: "observation", expectation: "Weekday morning archive of the delayed NY Harbor ULSD settle. Observed is the session date, not the archive build.", read: d => readCurve(d, "ho") },
    { id: "gas", group: "Gas", label: "EU gas storage", source: "GIE AGSI+", path: "data/gas.json", rule: "gas", clock: "observation", expectation: "AGSI+ publishes around 18:00 CET for the previous gas day. On a morning, the gas day two days back is the one that should already be in the file. Country histories use the same gas day.", read: readGas },
    { id: "ttf-weather", group: "Gas", label: "NW Europe temperature", source: "ECMWF via Open-Meteo", path: "data/ttf_weather.json", rule: "run", clock: "observation", expectation: "ECMWF 00z and 12z, checked about 08:40 and 20:40 UTC. Observed is the model run, not the file write.", read: readWx },
    { id: "og-spot", group: "Oil and mining", label: "EIA spot prices", source: "EIA daily spot file", path: OG + "spot_daily.json", rule: "spotLag", clock: "observation", expectation: "EIA's daily spot file trails the live quote. Observed is the last EIA price date. Not late inside about 5 days.", read: readSpot },
    { id: "og-weekly", group: "Oil and mining", label: "US weekly balances", source: "EIA Weekly Petroleum Status Report", path: OG + "us_weekly.json", rule: "eiaWeek", clock: "observation", expectation: "Week ending Friday, released the following Wednesday. Observed is that week-ending date, not the oil-page build.", read: readWeekly },
    { id: "og-steo", group: "Oil and mining", label: "STEO balances", source: "EIA Short-Term Energy Outlook", path: OG + "oil_balance_steo.json", rule: "month", clock: "observation", expectation: "Monthly outlook. Observed is the last historical month. The current month is still a forecast.", read: readSteo },
    { id: "og-ei", group: "Oil and mining", label: "Annual oil and gas history", source: "Energy Institute Statistical Review", path: OG + "oil_gas_history_ei.json", rule: "year", clock: "observation", expectation: "Annual statistical review. Observed is the last history year.", read: readEi },
    { id: "og-annual", group: "Oil and mining", label: "Annual energy by country", source: "Energy Institute, population and World Bank GDP", path: OG + "annual_energy.json", rule: "year", clock: "observation", expectation: "Annual country panel. Observed is the data year. The build time is when this file was written.", read: readAnnual },
    { id: "og-outlooks", group: "Oil and mining", label: "Outlooks", source: "IEA, OPEC, ICSG, WGC, Kimberley Process", path: OG + "outlooks.json", rule: "input", clock: "observation", expectation: "Scenario files, refreshed when the oil and mining bundle is rebuilt. Not a daily price.", read: readOutlook },
    { id: "og-costs", group: "Oil and mining", label: "Cost curves", source: "Dallas Fed survey and company reports", path: OG + "cost_curves.json", rule: "input", clock: "observation", expectation: "Dallas Fed Q1 2026 breakevens and company unit costs checked when the file was assembled. The survey date stays March even if the file is rebuilt.", read: readCosts },
    { id: "og-companies", group: "Oil and mining", label: "Oil and gas companies", source: "Company list for the tiles", path: OG + "companies_oil_gas.json", rule: "input", clock: "observation", expectation: "Rebuilt with the oil and mining files. Live quotes come from the market file, not from this as-of date.", read: readCompanies },
    { id: "mn-companies", group: "Oil and mining", label: "Mining companies", source: "Company list for the tiles", path: OG + "companies_mining.json", rule: "input", clock: "observation", expectation: "Rebuilt with the oil and mining files. Live quotes come from the market file.", read: readCompanies },
    { id: "mn-usgs", group: "Oil and mining", label: "USGS mine production", source: "Mineral Commodity Summaries", path: OG + "mining_production_usgs.json", rule: "year", clock: "observation", expectation: "Annual. Observed is the production year on the chart. The publication date is shown beside it and is not a review sign-off.", read: readUsgs },
    { id: "grid", group: "Grid", label: "Grid and data-centre register", source: "NESO, German and French notices", path: "data/griddc.json", rule: "register", clock: "observation", expectation: "Register snapshot. Observed is the date of the last compared register file.", read: readGrid },
    { id: "grid-events", group: "Grid", label: "Grid event calendar", source: "Official tender and connection dates", path: "data/griddc_events.json", rule: "fileAge", clock: "build", expectation: "The automatic check is about weekly. Observed is not a market date: the calendar lists future events. Hand verification stays on each event row.", read: readEvents },
    { id: "mastr", group: "Grid", label: "Germany MaStR", source: "Marktstammdatenregister", path: "data/mastr_de.json", rule: "month", clock: "observation", expectation: "Monthly commissionings. Observed is the latest month in the file.", read: readMastr },
    { id: "balancing", group: "Grid", label: "German balancing auctions", source: "regelleistung.net", path: "data/balancing.json", rule: "yesterday", clock: "observation", expectation: "Auction days. Observed is the latest day in the file, due through yesterday.", read: readBal },
    { id: "tracker-uk", group: "Grid", label: "UK project tracker", source: "NESO register snapshots", path: "data/tracker_uk.json", rule: "register", clock: "observation", expectation: "Observed is the register as-of date, not the morning rebuild.", read: readTracker },
    { id: "tracker-de", group: "Grid", label: "Germany project tracker", source: "MaStR snapshots", path: "data/tracker_de.json", rule: "register", clock: "observation", expectation: "Observed is the register as-of date, not the morning rebuild.", read: readTracker },
    { id: "tracker-de-wind", group: "Grid", label: "Germany wind tracker", source: "MaStR wind snapshots", path: "data/tracker_de_wind.json", rule: "register", clock: "observation", expectation: "Loaded with the Germany wind view. Observed is the register as-of date.", read: readTracker },
    { id: "pipeline", group: "Grid", label: "Project pipeline", source: "UK and Germany project stages", path: "data/pipeline_projects.json", rule: "pipeline", clock: "build", expectation: "Rebuilt Monday and Thursday at 06:20 UTC. This register has no single observation date, so that cell stays empty.", read: readPipe },
    { id: "land", group: "Grid", label: "Powered-land deals", source: "Hand-logged announcements", path: "data/powered_land_deals.json", rule: "hand", clock: "observation", expectation: "Updated when a deal is logged. No clock. Build is the last hand check. Observed is the newest announcement date.", read: readLand },
    { id: "research-review", group: "Research", label: "Research review", source: "Events register, human sign-off", path: "research/data/briefing.json", rule: "input", clock: "none", expectation: RESEARCH, read: readReview },
    { id: "research-snapshot", group: "Research", label: "Event-return snapshot", source: "Yahoo daily closes for the pilot", path: "research/out/chart_events.json", rule: "input", clock: "observation", expectation: RESEARCH, read: readSnapshot },
    { id: "research-reactions", group: "Research", label: "Screen event reactions", source: "Share-price reactions on the screen", path: "research/data/smallcaps_reaction_summary.json", rule: "input", clock: "observation", expectation: RESEARCH + " This is the screen's reaction window, not the event-return snapshot.", read: readReactions }
  ];

  function assess(id, data, now, ctx) {
    const feed = feeds.find(f => f.id === id);
    if (!feed) throw new Error("unknown dataset " + id);
    const nowD = now instanceof Date ? now : new Date(now);
    const times = data ? feed.read(data, ctx || {}) : { build: null, observation: null, review: null };
    let status = data ? judge(feed.rule, times, nowD) : "missing";
    const lag = data && feed.buildHours ? buildLagNote(times.build, nowD, feed.buildHours) : "";
    if (lag && status === "fresh") status = "late";
    const note = [times.note || "", lag].filter(Boolean).join(" ");
    const observationText = times.observationText || showDate(times.observation, times.observationKind || "date");
    return {
      id: feed.id,
      group: feed.group,
      label: feed.label,
      source: feed.source,
      path: feed.path,
      expectation: feed.expectation,
      status: status,
      statusClock: feed.clock,
      build: times.build || null,
      observation: times.observation || null,
      review: times.review || null,
      buildText: showDate(times.build, times.buildKind || "instant"),
      observationText: observationText || BLANK,
      reviewText: showDate(times.review, "date"),
      note: note
    };
  }

  window.MMHealthModel = {
    BLANK: BLANK,
    feeds: feeds,
    assess: assess,
    judge: judge,
    eexDue: eexDue,
    gasDue: gasDue,
    showDate: showDate
  };
})();
