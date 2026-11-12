/* Delivery and quote labels for the live Nordic, Markets and Gas views.
   Today and Tomorrow follow the Europe/Zurich calendar of the delivery date.
   A file refresh time is never used as an instrument's observation time.
   A futures quote is never labelled spot. */
(function () {
  "use strict";
  const TZ = "Europe/Zurich";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function zurichDate(now) {
    const d = now instanceof Date ? now : new Date(now);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  function pad2(v) { return String(v == null ? "" : v).padStart(2, "0"); }
  function zurichParts(now) {
    const d = now instanceof Date ? now : new Date(now);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(d);
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const mon = String(get("month") || "").replace(/\.$/, "");
    if (!get("year") || !mon || !get("day") || get("hour") == null || get("minute") == null) return null;
    return { y: get("year"), mon: mon, d: String(+get("day")), h: pad2(get("hour")), mi: pad2(get("minute")) };
  }
  function addDays(iso, n) {
    const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function day(iso) {
    const s = String(iso || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  function dlab(iso) {
    const s = day(iso);
    if (!s) return null;
    const m = s.slice(5, 7);
    if (!MON[+m - 1]) return null;
    return (+s.slice(8, 10)) + " " + MON[+m - 1] + " " + s.slice(0, 4);
  }
  function deliveryLabel(delivery, now) {
    const d = day(delivery);
    if (!d) return null;
    const today = zurichDate(now || new Date());
    if (today && d === today) return "Today";
    if (today && d === addDays(today, 1)) return "Tomorrow";
    return dlab(d);
  }

  function isFuture(row) {
    if (!row) return false;
    if (row.kind === "future") return true;
    if (/=F$/.test(String(row.sym || ""))) return true;
    const c = row.contract;
    if (c && (c.month || c.cont || c.sym)) return true;
    if (/\bfutures?\b/i.test(row.name || "")) return true;
    return false;
  }
  function isExplicitSpot(row) {
    if (!row || isFuture(row)) return false;
    return row.kind === "spot" || /\bspot\b/i.test(row.name || "");
  }
  function quoteWhen(row) {
    if (row && row.market_time) {
      const p = zurichParts(row.market_time);
      if (p) return { text: p.d + " " + p.mon + " " + p.y + ", " + p.h + ":" + p.mi, timeKnown: true };
    }
    const date = row && row.official && (row.official.asof || row.official.as_of) || row && row.bar_date || null;
    const lab = dlab(date);
    if (lab) return { text: lab + " · no quote time", timeKnown: false };
    return { text: "quote time not available", timeKnown: false };
  }
  function contractText(row) {
    if (!row) return "";
    const c = row.contract || {};
    if (c.month) {
      const exp = dlab(c.expiry);
      return exp ? c.month + " · exp " + exp : String(c.month);
    }
    if (isFuture(row)) return "contract not available";
    return "";
  }
  function tileMeta(row) {
    const when = quoteWhen(row);
    const contract = contractText(row);
    const bits = [when.text];
    if (contract) bits.push(contract);
    if (isFuture(row)) bits.push("futures");
    else if (isExplicitSpot(row)) bits.push("spot");
    return bits.join(" · ");
  }
  function futuresBits(contract, asOf) {
    const name = contract ? String(contract) : "contract not available";
    const when = dlab(asOf);
    return {
      name: name,
      kind: "futures",
      when: when ? "settled " + when + " · no quote time" : "quote time not available"
    };
  }
  function dayAheadDetail(delivery) {
    return "delivery " + (dlab(delivery) || "not available yet") + " · no quote time";
  }
  function dayAheadFigures(seriesDate, seriesPrice, tomorrowDate, tomorrowPrice, now) {
    const figs = [];
    const push = (date, price) => {
      const d = day(date);
      if (!d || price == null || price === "") return;
      const label = deliveryLabel(d, now);
      if (!label) return;
      figs.push({ label: label, delivery: d, price: String(price), detail: dayAheadDetail(d) });
    };
    push(seriesDate, seriesPrice);
    if (day(tomorrowDate) && day(tomorrowDate) !== day(seriesDate)) push(tomorrowDate, tomorrowPrice);
    const rank = f => f.label === "Today" ? "0" : f.label === "Tomorrow" ? "1" : "2" + f.delivery;
    figs.sort((a, b) => rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0);
    return figs;
  }
  function figuresHtml(figs) {
    const list = figs || [];
    if (!list.length) return '<div><div class="hero-k">Day-ahead</div><div class="hero-num is-na">Not available yet</div><div class="hero-day">delivery date not available yet</div></div>';
    return list.map(f => '<div><div class="hero-k">' + esc(f.label) + '</div><div class="hero-num">' + f.price + '<small>€</small></div><div class="hero-day">' + esc(f.detail) + "</div></div>").join("");
  }
  function gasQuote(row) {
    const future = isFuture(row);
    const spot = !future && isExplicitSpot(row);
    const when = quoteWhen(row);
    const contract = future ? contractText(row) : "";
    const kicker = future ? "TTF futures" : spot ? "TTF spot" : "TTF";
    const detail = [contract, when.text].filter(Boolean).join(" · ");
    const sub = future
      ? "Dutch TTF futures, then the futures curve"
      : spot
        ? "Dutch TTF spot, then the futures curve"
        : "Dutch TTF, then the futures curve";
    const note = future
      ? "Dutch TTF futures. The curve under this quote is the futures strip."
      : spot
        ? "Dutch TTF spot. The curve under this quote is futures."
        : "Dutch TTF. The curve under this quote is the futures strip.";
    return { future: future, spot: spot, kicker: kicker, detail: detail, sub: sub, note: note };
  }

  window.MMLabels = {
    esc: esc, zurichDate: zurichDate, addDays: addDays, dlab: dlab, deliveryLabel: deliveryLabel,
    isFuture: isFuture, quoteWhen: quoteWhen, contractText: contractText, tileMeta: tileMeta,
    futuresBits: futuresBits, dayAheadFigures: dayAheadFigures, figuresHtml: figuresHtml, gasQuote: gasQuote
  };
})();
