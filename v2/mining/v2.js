/* Mining page: six Lundin names, then copper, gold, diamonds and reported costs. */
(function () {
  "use strict";
  const U = () => window.MMV2;
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/";
  const HL = { copper_mine: ["Chile", "Brazil", "Argentina"], gold_mine: ["Ecuador", "Côte d'Ivoire", "Brazil", "Argentina"] };
  const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function block(root, title, asof, take) {
    const el = document.createElement("section");
    el.className = "og-block";
    el.innerHTML = '<header class="og-h"><h2>' + U().esc(title) + '</h2><p class="og-asof">' + U().esc(asof || "") + '</p></header><p class="og-take">' + U().esc(take || "") + '</p><div class="og-body"></div>';
    root.appendChild(el);
    return el.querySelector(".og-body");
  }
  function spot(root, quotes) {
    const body = block(root, "Metal prices", "Live quotes from the market file", "");
    [["GC=F", "Gold", "$/oz", "#e8c56b"], ["HG=F", "Copper", "", "#fb923c"]].forEach(([sym, label, unit, color]) => {
      const r = quotes[sym];
      const one = r && r.pct ? r.pct["1D"] : null;
      const card = document.createElement("div");
      card.className = "og-split";
      card.innerHTML = '<div class="og-plot"></div><div><div class="og-k">' + label + '</div><div class="og-num">' +
        (r && U().fmt(r.px, r.px >= 100 ? 0 : 2) || "n/a") + "<small>" + U().esc(r && r.ccy || unit) + "</small></div>" +
        '<div class="og-pills"><span class="og-pk">1D</span>' + (U().finite(one) ? U().pill(U().signed(one, "%")) : "") + "</div></div>";
      body.appendChild(card);
      if (r && r.spark) U().lineChart(card.querySelector(".og-plot"), { h: 90, aria: label, series: [{ color: color, vals: r.spark, width: 1.6 }] });
    });
  }
  function usgsBars(body, blockData, highlights, title) {
    if (!blockData || !blockData.rows) return;
    const rows = blockData.rows.filter(r => r.country !== "World" && r.country !== "Other" && U().finite(r.production));
    const el = document.createElement("div");
    el.className = "og-plot";
    body.appendChild(el);
    const big = rows.some(r => r.production >= 1e6);
    const short = name => /democratic republic of (the )?congo/i.test(name) ? "DR Congo" : name;
    U().bars(el, rows.slice(0, 12).map(r => {
      const on = highlights.some(h => fold(h) === fold(r.country));
      const label = big ? U().fmt(r.production / 1e6, 1) + " Mt" : U().fmt(r.production, 0) + " t";
      return { name: short(r.country), val: r.production, color: on ? "#e8c56b" : "#8b95a8", label: label, on: on };
    }), { aria: title, left: 118 });
    const seen = new Set();
    const miss = [];
    highlights.forEach(h => {
      const k = fold(h);
      if (seen.has(k)) return;
      seen.add(k);
      if (!blockData.rows.some(r => fold(r.country) === k)) miss.push(h);
    });
    if (miss.length) {
      const list = miss.length === 1 ? miss[0] : miss.slice(0, -1).join(", ") + " and " + miss[miss.length - 1];
      body.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(list) + (miss.length === 1 ? " is" : " are") + " not in these USGS country rows.</p>");
    }
  }
  function copper(root, outlook, usgs) {
    const icsg = outlook && outlook.mining && outlook.mining.copper_icsg;
    const body = block(root, "Copper", icsg ? icsg.source + ", issued " + (icsg.issued || "") : "ICSG", "");
    if (icsg) {
      const years = icsg.years || [];
      const mine = (icsg.mine_production_by_region || {}).TOTAL || [];
      const ref = (icsg.refined_production_by_region || {}).TOTAL || [];
      const use = (icsg.refined_usage_by_region || {}).TOTAL || [];
      const plot = document.createElement("div");
      plot.className = "og-plot";
      body.appendChild(plot);
      U().lineChart(plot, {
        h: 140, aria: "ICSG copper",
        series: [
          { color: "#e8c56b", vals: mine, width: 1.7 },
          { color: "#8b95a8", vals: ref, width: 1.5 },
          { color: "#fb7185", vals: use, width: 1.5 }
        ]
      });
      body.insertAdjacentHTML("beforeend", '<p class="og-leg"><span><i style="--c:#e8c56b"></i>Mine</span><span><i style="--c:#8b95a8"></i>Refined</span><span><i style="--c:#fb7185"></i>Usage</span> · kt, ' + U().esc(years.join(" ")) + "</p>");
      const bal = icsg.refined_balance_kt || [];
      body.insertAdjacentHTML("beforeend", '<p class="og-sub">Refined balance ' + bal.map((v, i) => (years[i] || "") + " " + U().fmt(v, 0) + " kt").join(" · ") + ". China share of usage " + U().esc(String(icsg.china_share_of_usage_pct)) + "%.</p>");
      const take = body.parentElement.querySelector(".og-take");
      if (take && mine.length) take.textContent = "ICSG mine supply " + U().fmt(mine[0], 0) + " kt in " + years[0] + " and " + U().fmt(mine[mine.length - 1], 0) + " kt in " + years[years.length - 1] + ". The refined market stays in surplus in the forecast (" + bal.map(v => U().fmt(v, 0)).join(", ") + " kt).";
    }
    if (usgs && usgs.copper_mine) {
      body.insertAdjacentHTML("beforeend", "<h3>USGS mine production</h3>");
      usgsBars(body, usgs.copper_mine, HL.copper_mine, "Copper mine production");
      const chile = (usgs.copper_mine.rows || []).find(r => r.country === "Chile");
      if (chile) body.insertAdjacentHTML("beforeend", '<p class="og-sub">Chile ' + U().fmt(chile.production, 0) + " " + U().esc(usgs.copper_mine.unit || "") + (U().finite(chile.share_world_pct) ? ", " + U().fmt(chile.share_world_pct, 1) + "% of world" : "") + ". Lundin’s copper sits in Chile, Brazil and Argentina; Brazil and Argentina are marked when the USGS row exists.</p>");
    }
  }
  function gold(root, outlook, usgs) {
    const wgc = outlook && outlook.mining && outlook.mining.gold_wgc;
    const body = block(root, "Gold", wgc ? wgc.source : "WGC", "");
    const want = ["Mine Production", "Total Supply", "Jewellery Consumption", "Investment", "ETFs and Similar Products", "Central Bank and Other Institutions", "Total Demand", "LBMA Gold Price (US$/oz)"];
    const rows = ((wgc && wgc.rows) || []).filter(r => want.indexOf(r.item) >= 0);
    if (rows.length) {
      body.insertAdjacentHTML("beforeend", '<table class="og-table"><thead><tr><th>Line</th><th>Q3 26</th><th>QoQ</th><th>YoY</th></tr></thead><tbody>' +
        rows.map(r => "<tr><td>" + U().esc(r.item) + "</td><td>" + (U().fmt(r.q3_26, r.q3_26 > 100 ? 0 : 1) || "–") + "</td><td>" + (U().pill(U().signed(r.qoq_pct, "%")) || "–") + "</td><td>" + (U().pill(U().signed(r.yoy_pct, "%")) || "–") + "</td></tr>").join("") +
        "</tbody></table>");
      const mine = rows.find(r => r.item === "Mine Production");
      const dem = rows.find(r => r.item === "Total Demand");
      const take = body.parentElement.querySelector(".og-take");
      if (take && mine) take.textContent = "Mine supply was " + U().fmt(mine.q3_26, 0) + " tonnes in Q3 2026, " + (U().signed(mine.yoy_pct, "%") || "n/a") + " versus Q3 2025." + (dem ? " Total demand " + U().fmt(dem.q3_26, 0) + " tonnes, " + (U().signed(dem.yoy_pct, "%") || "n/a") + " year on year." : "");
    }
    if (usgs && usgs.gold_mine) {
      body.insertAdjacentHTML("beforeend", "<h3>USGS mine production</h3>");
      usgsBars(body, usgs.gold_mine, HL.gold_mine, "Gold mine production");
    }
  }
  function diamonds(root, outlook, costs) {
    const kp = outlook && outlook.mining && outlook.mining.diamonds_kp;
    const body = block(root, "Diamonds", kp ? kp.source : "Kimberley Process", "");
    const years = kp && kp.world_by_year ? Object.keys(kp.world_by_year).sort() : [];
    if (years.length) {
      const plot = document.createElement("div");
      plot.className = "og-plot";
      body.appendChild(plot);
      U().lineChart(plot, {
        h: 130, aria: "Rough diamond price",
        series: [{ color: "#e8c56b", width: 1.8, vals: years.map(y => kp.world_by_year[y].usd_per_carat) }]
      });
      const last = kp.world_by_year[years[years.length - 1]];
      const prev = kp.world_by_year[years[years.length - 2]];
      const yoy = prev && prev.usd_per_carat ? (last.usd_per_carat / prev.usd_per_carat - 1) * 100 : null;
      body.insertAdjacentHTML("beforeend", '<p class="og-sub">' + years[years.length - 1] + " world rough " + U().fmt(last.carats_m, 1) + " million ct, $" + U().fmt(last.usd_per_carat, 0) + "/ct " + (U().pill(U().signed(yoy, "%")) || "") + "</p>");
      const take = body.parentElement.querySelector(".og-take");
      if (take) take.textContent = "World rough production fell to " + U().fmt(last.carats_m, 1) + " million carats in " + years[years.length - 1] + ". The average price was $" + U().fmt(last.usd_per_carat, 0) + "/ct, " + (U().signed(yoy, "%") || "n/a") + " versus " + years[years.length - 2] + ".";
    }
    const bot = kp && kp.botswana;
    if (bot && bot.length) {
      const b = bot[bot.length - 1];
      body.insertAdjacentHTML("beforeend", '<p class="og-sub">Botswana ' + b.year + ": " + U().fmt(b.production_carats / 1e6, 2) + " million ct, $" + U().fmt(b.usd_per_carat, 0) + "/ct. Lucara’s Karowe mine is in Botswana.</p>");
    }
    const luc = (costs || []).find(c => /Lucara/i.test(c.company || ""));
    if (luc) {
      body.insertAdjacentHTML("beforeend", '<p class="og-sub">Lucara operating cost $' + U().fmt(luc.unit_cost, 2) + "/t, " + U().esc(luc.period) + ".</p>");
      U().park(body, "Q3 is due 13 Nov, so this is still the Q2 figure.");
    }
  }
  function costPoints(root, cc, quotes) {
    const body = block(root, "Reported costs", "Company figures, not an industry cost curve", "");
    const gold = quotes["GC=F"], copper = quotes["HG=F"];
    (cc.mining_costs || []).forEach(c => {
      const spotN = /gold/i.test(c.commodity || "") && gold ? U().fmt(gold.px, 0) + " " + (gold.ccy || "USD") : /copper/i.test(c.commodity || "") && copper ? U().fmt(copper.px, 2) + " " + (copper.ccy || "") : null;
      body.insertAdjacentHTML("beforeend", '<p class="og-sub"><b>' + U().esc(c.company) + "</b> " + U().esc(c.period) + " · " + U().esc(c.metric) + " · " + U().fmt(c.unit_cost, c.unit_cost >= 100 ? 0 : 2) + (spotN ? " · spot " + spotN : "") + "</p>");
    });
    (cc.gaps || []).forEach(g => { if (/[Mm]ining|[Gg]old|[Cc]opper/.test(g)) body.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(g) + "</p>"); });
    const lug = (cc.mining_costs || []).find(c => /Lundin Gold/.test(c.company || ""));
    const take = body.parentElement.querySelector(".og-take");
    if (take && lug && gold) take.textContent = "Lundin Gold AISC was $" + U().fmt(lug.unit_cost, 0) + "/oz in " + lug.period + " against a live gold quote of " + U().fmt(gold.px, 0) + ". Montage’s figure is a study AISC, not a reported quarter.";
  }
  async function start() {
    const root = document.querySelector("#miningView .og-root");
    if (!root || !U()) return;
    try {
      const [mine, outlook, usgs, costs, man] = await Promise.all(["companies_mining.json", "outlooks.json", "mining_production_usgs.json", "cost_curves.json", "manifest.json"].map(f => U().getJSON(BASE + f + "?t=" + Math.floor(Date.now() / 36e5))));
      let quotes = {};
      try { quotes = await window.MMV2Tiles.loadQuotes(); } catch (e) { quotes = {}; }
      root.innerHTML = '<div class="og-top"><h1>Mining</h1><p class="og-asof">Files as of ' + U().esc((man || {}).as_of || "") + "</p></div>";
      spot(root, quotes);
      const tiles = document.createElement("section");
      tiles.className = "og-block";
      tiles.innerHTML = '<header class="og-h"><h2>Lundin companies</h2></header><div class="v2co"></div>';
      root.appendChild(tiles);
      window.MMV2Tiles.mount(tiles.querySelector(".v2co"), "mining");
      const note = (mine.companies || []).find(c => /NGEx/.test(c.company || ""));
      if (note && note.note) root.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(note.note) + "</p>");
      const mau = (mine.companies || []).find(c => /Montage/.test(c.company || ""));
      if (mau && mau.note) root.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(mau.note) + "</p>");
      copper(root, outlook, usgs);
      gold(root, outlook, usgs);
      diamonds(root, outlook, (costs || {}).mining_costs);
      if (costs) costPoints(root, costs, quotes);
      root.insertAdjacentHTML("beforeend", '<p class="og-foot">Sources: ICSG, USGS Mineral Commodity Summaries, World Gold Council, Kimberley Process, company reports. <a href="https://github.com/MasterKano/emmi-data/tree/main/og-mining-v2">emmi-data og-mining-v2</a>.</p>');
    } catch (e) {
      root.innerHTML = '<p class="og-na">' + U().esc(e && e.message ? e.message : "Mining data are not available yet.") + "</p>";
    }
  }
  window.MMV2Mine = { start: start };
  if (document.querySelector("#miningView .og-root")) start();
})();
