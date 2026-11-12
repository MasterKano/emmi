/* Oil & gas page. EI Statistical Review is the annual country panel.
   Population and GDP are overlaid only when demographics.json is published. */
(function () {
  "use strict";
  const U = () => window.MMV2;
  const BASE = "https://raw.githubusercontent.com/MasterKano/emmi-data/main/og-mining-v2/";
  const FILES = ["manifest", "spot_daily", "us_weekly", "oil_balance_steo", "oil_gas_history_ei", "outlooks", "cost_curves", "companies_oil_gas"];
  const PIN = ["World", "Europe", "EU", "Asia Pacific", "China", "India", "US"];
  const NAME = {
    "Total World": "World", "Total Europe": "Europe", "Total EU": "EU", "Total Asia Pacific": "Asia Pacific",
    "United States": "US", "US": "US", "Russian Federation": "Russia"
  };
  const state = { fuel: "oil", place: "__compare", data: null, book: null, demo: null, annual: null };

  function nice(name) { return NAME[name] || String(name || "").replace(/^Total /, ""); }
  function histOf(rec) {
    const h = rec && (rec.history_2000_2025 || rec.history_1990_2025 || rec.history || rec.series);
    return Array.isArray(h) ? h.filter(p => Array.isArray(p) && U().finite(p[1])) : [];
  }
  function put(book, fuel, flow, rec, unit) {
    const name = nice(rec.name || rec.country || rec.region);
    if (!name) return;
    book[fuel] = book[fuel] || {};
    book[fuel][flow] = book[fuel][flow] || {};
    const history = histOf(rec);
    book[fuel][flow][name] = {
      name: name,
      history: history,
      y: U().finite(rec.y2025) ? rec.y2025 : (U().finite(rec.latest) ? rec.latest : (history.length ? history[history.length - 1][1] : null)),
      yoy: U().finite(rec.yoy_pct) ? rec.yoy_pct : null,
      vs: U().finite(rec.vs_normal_pct) ? rec.vs_normal_pct : null,
      unit: rec.unit || unit
    };
  }
  function fromEI(ei) {
    const book = {};
    const map = [
      ["oil", "production", ei.oil_production_kbd, "kb/d"],
      ["oil", "consumption", ei.oil_consumption_kbd, "kb/d"],
      ["gas", "production", ei.gas_production_bcm, "bcm"],
      ["gas", "consumption", ei.gas_consumption_bcm, "bcm"]
    ];
    map.forEach(([fuel, flow, block, unit]) => {
      if (!block) return;
      (block.regions || []).concat(block.top_countries || []).forEach(rec => put(book, fuel, flow, rec, unit));
    });
    return book;
  }
  function seriesPairs(node) {
    if (!node) return null;
    if (Array.isArray(node) && node.length && Array.isArray(node[0])) return node.filter(p => U().finite(p[1]));
    if (Array.isArray(node) && node[0] && typeof node[0] === "object" && "year" in node[0]) {
      return node.map(p => [p.year, p.value != null ? p.value : p.v]).filter(p => U().finite(p[1]));
    }
    return null;
  }
  function absorbAnnual(file, book) {
    if (!file || typeof file !== "object") return;
    const fuelKeys = { oil: ["oil", "oil_kbd", "oil_ej"], gas: ["gas", "gas_bcm", "gas_ej"], energy: ["primary", "primary_energy", "energy", "total_energy"] };
    const flowKeys = { production: ["production", "prod"], consumption: ["consumption", "cons"] };
    const entities = file.entities || file.countries || file.regions;
    if (Array.isArray(entities)) {
      entities.forEach(e => {
        Object.keys(fuelKeys).forEach(fuel => {
          Object.keys(flowKeys).forEach(flow => {
            let node = null;
            fuelKeys[fuel].forEach(fk => flowKeys[flow].forEach(lk => {
              if (node) return;
              const bag = e[fk] || e[fk + "_" + lk] || e[lk + "_" + fk];
              if (bag && bag[lk]) node = bag[lk];
              else if (e[fk + "_" + lk]) node = e[fk + "_" + lk];
            }));
            const history = seriesPairs(node) || seriesPairs(e[fuel + "_" + flow]);
            if (!history) return;
            put(book, fuel, flow, { name: e.name || e.country, history: history, yoy_pct: e[fuel + "_" + flow + "_yoy"], unit: e.unit }, e.unit || "");
          });
        });
      });
      return;
    }
    Object.keys(fuelKeys).forEach(fuel => {
      let bag = null;
      fuelKeys[fuel].forEach(k => { if (!bag && file[k]) bag = file[k]; });
      if (!bag) return;
      Object.keys(flowKeys).forEach(flow => {
        let node = null;
        flowKeys[flow].forEach(k => { if (!node && bag[k]) node = bag[k]; });
        if (!node) return;
        const unit = node.unit || bag.unit || "";
        (node.regions || []).concat(node.countries || node.top_countries || []).forEach(rec => put(book, fuel, flow, rec, unit));
      });
    });
  }
  function places(book, fuel) {
    const bag = (book[fuel] && (book[fuel].consumption || book[fuel].production)) || {};
    const names = Object.keys(bag);
    const pin = PIN.filter(n => names.indexOf(n) >= 0);
    const rest = names.filter(n => pin.indexOf(n) < 0).sort((a, b) => a.localeCompare(b));
    return pin.concat(rest);
  }
  function align(recs) {
    const years = [];
    recs.forEach(r => (r.history || []).forEach(p => { if (years.indexOf(p[0]) < 0) years.push(p[0]); }));
    years.sort((a, b) => a - b);
    const map = r => {
      const m = {};
      (r.history || []).forEach(p => { m[p[0]] = p[1]; });
      return years.map(y => U().finite(m[y]) ? m[y] : null);
    };
    return { years: years, vals: recs.map(map) };
  }
  function pills(rec) {
    if (!rec) return "";
    const bits = [];
    if (U().finite(rec.yoy)) bits.push('<span class="og-pk">1Y</span>' + U().pill(U().signed(rec.yoy, "%")));
    if (U().finite(rec.vs)) bits.push('<span class="og-pk">vs 15–24</span>' + U().pill(U().signed(rec.vs, "%")));
    return '<span class="og-pills">' + bits.join("") + "</span>";
  }
  function story(book, fuel) {
    const bag = book[fuel] && book[fuel].consumption;
    if (!bag) return "";
    const eu = bag.Europe, ap = bag["Asia Pacific"], cn = bag.China;
    if (!eu || !ap || !cn) return "";
    const bit = r => r.name + " " + (U().signed(r.yoy, "%") || "n/a") + " vs 2024" + (U().finite(r.vs) ? " (" + U().signed(r.vs, "%") + " vs 2015–24)" : "");
    return bit(eu) + ". " + bit(ap) + ". " + bit(cn) + ".";
  }
  function findDemo(demo, name) {
    const list = demo && (demo.regions || demo.entities || demo.countries);
    if (!Array.isArray(list)) return null;
    const key = String(name || "").toLowerCase();
    return list.find(e => nice(e.name || e.country || "").toLowerCase() === key) || null;
  }
  function perCapita(cons, people) {
    if (!cons || !people) return [];
    const pop = {};
    people.forEach(p => { pop[p[0]] = p[1]; });
    return cons.map(p => {
      const n = pop[p[0]];
      if (!U().finite(p[1]) || !U().finite(n) || n <= 0) return [p[0], null];
      return [p[0], p[1] * 1000 * 365 / n];
    }).filter(p => U().finite(p[1]));
  }

  function priceStrip(root, spot, quotes) {
    const body = block(root, "Prices", "EIA spot lags about a week. The large figure is the live quote when the market file has it.", "");
    const rows = [
      ["brent_spot", "BZ=F", "Brent", "#e8c56b"],
      ["wti_spot", "CL=F", "WTI", "#f0b429"],
      ["henry_hub_spot", "NG=F", "Henry Hub", "#5bc0eb"]
    ];
    const bits = [];
    rows.forEach(([key, sym, label, color]) => {
      const s = spot[key];
      if (!s) return;
      const live = quotes[sym];
      const last = live && U().finite(live.px) ? live.px : s.latest;
      const vsMa = U().finite(last) && U().finite(s.ma30) && s.ma30 !== 0 ? (last / s.ma30 - 1) * 100 : null;
      const card = document.createElement("div");
      card.className = "og-split";
      card.innerHTML = '<div class="og-plot"></div><div><div class="og-k">' + U().esc(label) + '</div><div class="og-num">' +
        (U().fmt(last, Math.abs(last) < 20 ? 2 : 1) || "n/a") + "<small>" + (key === "henry_hub_spot" ? "$/mmBtu" : "$") + "</small></div>" +
        '<div class="og-pills"><span class="og-pk">vs 30d</span>' + (U().pill(U().signed(vsMa, "%")) || "") +
        '<span class="og-pk">m/m</span>' + (U().pill(U().signed(s.mtd_vs_prev_pct, "%")) || "") +
        '<span class="og-pk">vs 5y</span>' + (U().pill(U().signed(s.vs_5y_pct, "%")) || "") + "</div>" +
        '<p class="og-sub">EIA ' + U().esc(U().fmt(s.latest, 2) || "") + " as of " + U().esc(s.as_of || "") + (live ? " · live " + U().esc(live.bar_date || "") : "") + "</p></div>";
      body.appendChild(card);
      const series = s.series_2m || [];
      U().lineChart(card.querySelector(".og-plot"), {
        h: 120, aria: label,
        series: [
          { color: color, width: 1.6, vals: series.map(p => p[2]) },
          { color: color, dots: true, width: 0, vals: series.map(p => p[1]) }
        ]
      });
      bits.push(label + " " + U().fmt(last, 1));
    });
    const take = body.parentElement.querySelector(".og-take");
    if (take && spot.brent_spot) {
      const b = spot.brent_spot;
      take.textContent = "Brent EIA spot is " + U().fmt(b.latest, 1) + " on " + b.as_of + ", " + U().signed(b.mtd_vs_prev_pct, "%") + " versus the prior month and " + U().signed(b.vs_5y_pct, "%") + " versus the 5-year average. Live quotes: " + bits.join(", ") + ".";
    }
  }

  function weekly(root, data) {
    const body = block(root, "US weekly balance", "EIA weekly, as of " + ((data.us_commercial_crude_stocks || {}).as_of || ""), "");
    body.classList.add("og-weeks");
    const keys = ["us_commercial_crude_stocks", "us_gasoline_stocks", "us_distillate_stocks", "us_gas_storage_l48", "us_crude_production", "us_product_supplied"];
    const colors = ["#e8c56b", "#f0b429", "#fb923c", "#5bc0eb", "#5fb98a", "#b6a4f5"];
    keys.forEach((key, i) => {
      const s = data[key];
      if (!s) return;
      const card = document.createElement("div");
      card.className = "og-card og-split";
      const wow = U().finite(s.wow) ? U().signed(s.wow, "", Math.abs(s.wow) >= 10 ? 0 : 1) : null;
      card.innerHTML = '<div class="og-plot"></div><div><div class="og-k">' + U().esc(s.label) + '</div><div class="og-num">' +
        (U().fmt(s.latest, s.latest >= 100 ? 0 : 1) || "n/a") + "<small>" + U().esc(s.unit || "") + "</small></div>" +
        '<div class="og-pills"><span class="og-pk">WoW</span>' + (wow ? U().pill(wow) : "") +
        '<span class="og-pk">YoY</span>' + (U().pill(U().signed(s.yoy, "", 1)) || "") +
        '<span class="og-pk">vs 5y</span>' + (U().pill(U().signed(s.vs_normal_pct, "%")) || "") + "</div>" +
        '<div class="og-plot og-range"></div></div>';
      body.appendChild(card);
      const series = s.series_1y || [];
      U().lineChart(card.querySelector(".og-plot"), {
        h: 108, aria: s.label,
        series: [
          { color: "#8b95a8", width: 1.2, dash: "4 3", vals: series.map(p => p[2]) },
          { color: colors[i], width: 1.8, vals: series.map(p => p[1]) }
        ]
      });
      if (s.range_5y && s.range_5y.length === 2) {
        U().rangeBar(card.querySelector(".og-range"), { min: s.range_5y[0], max: s.range_5y[1], avg: s.normal_5y, val: s.latest, color: colors[i] });
      }
    });
    const c = data.us_commercial_crude_stocks;
    const take = body.parentElement.querySelector(".og-take");
    if (take && c) take.textContent = "Commercial crude is " + U().fmt(c.latest, 0) + " million bbl, " + U().signed(c.vs_normal_pct, "%") + " versus the same-week 5-year average. The line is this year; the dashed line is that average. The bar is only the latest week’s 5-year low to high.";
  }

  function yearAvg(series, year) {
    const pts = (series || []).filter(p => String(p[0]).indexOf(String(year)) === 0 && U().finite(p[1]));
    if (!pts.length) return null;
    return pts.reduce((s, p) => s + p[1], 0) / pts.length;
  }
  function balance(root, steo, outlook) {
    const meta = steo.meta || {};
    const body = block(root, "Global balance", (meta.source || "EIA STEO") + " · history through " + (meta.last_historical_month || ""), "");
    const prod = steo.world_production || [], cons = steo.world_consumption || [];
    const from = prod.findIndex(p => String(p[0]) >= "2024-01");
    const slice = arr => arr.slice(from < 0 ? 0 : from);
    const P = slice(prod), C = slice(cons);
    const shade = P.findIndex(p => p[2] === true);
    const plot = document.createElement("div");
    plot.className = "og-plot";
    body.appendChild(plot);
    U().lineChart(plot, {
      h: 160, aria: "World oil production and consumption",
      shadeFrom: shade < 0 ? null : shade,
      series: [
        { color: "#8b95a8", width: 1.6, vals: C.map(p => p[1]) },
        { color: "#e8c56b", width: 1.8, vals: P.map(p => p[1]) }
      ]
    });
    body.insertAdjacentHTML("beforeend", '<p class="og-leg"><span><i style="--c:#e8c56b"></i>Production</span><span><i style="--c:#8b95a8"></i>Consumption</span><span>shaded = forecast</span></p>');
    const years = [2025, 2026, 2027];
    let table = '<table class="og-table"><thead><tr><th></th><th>2025</th><th>2026</th><th>2027</th></tr></thead><tbody>';
    [["Production", prod], ["Consumption", cons], ["Brent $", steo.brent_usd || []]].forEach(([name, series]) => {
      table += "<tr><td>" + name + "</td>" + years.map(y => "<td>" + (U().fmt(yearAvg(series, y), y === 2025 && name !== "Brent $" ? 1 : 1) || "–") + "</td>").join("") + "</tr>";
    });
    table += "</tbody></table>";
    body.insertAdjacentHTML("beforeend", table);
    const spare = (steo.opec_surplus_capacity || []).filter(p => p[2] !== true).pop();
    const stock = (steo.implied_balance || []).filter(p => p[2] !== true).pop();
    const take = body.parentElement.querySelector(".og-take");
    if (take) take.textContent = "STEO averages: 2026 supply " + U().fmt(yearAvg(prod, 2026), 1) + " mb/d against demand " + U().fmt(yearAvg(cons, 2026), 1) + ". Brent averages $" + U().fmt(yearAvg(steo.brent_usd, 2026), 0) + " in 2026 and $" + U().fmt(yearAvg(steo.brent_usd, 2027), 0) + " in 2027. Last history month implied balance " + (stock ? U().fmt(stock[1], 1) + " mb/d" : "n/a") + ", OPEC spare capacity " + (spare ? U().fmt(spare[1], 2) + " mb/d" : "n/a") + ".";
    const iea = outlook && outlook.oil && outlook.oil.short_term && outlook.oil.short_term.iea_omr_oct2026_highlights;
    if (iea) {
      body.insertAdjacentHTML("beforeend", '<div class="og-call"><b>IEA Oil Market Report, ' + U().esc(iea.published) + "</b>. Demand change " + U().esc(String(iea.demand_2026_change_mbd)) + " mb/d in 2026, 2027 versus 2025 " + U().esc(String(iea.demand_2027_vs_2025_kbd)) + " kb/d. Supply 2026 " + U().esc(String(iea.supply_2026_mbd)) + " mb/d (" + U().esc(String(iea.supply_2026_change_mbd)) + "), 2027 change " + U().esc(String(iea.supply_2027_change_mbd)) + " mb/d. " + U().esc(iea.context || "") + "</div>");
    }
  }

  function shortName(name) { return String(name || "").replace(/^Total /, ""); }
  function atYear(ent, key, year) {
    if (!ent || !ent.years) return null;
    const i = ent.years.indexOf(year);
    const a = ent[key];
    if (i < 0 || !a || !U().finite(a[i])) return null;
    return a[i];
  }
  function latestOf(ent, key) { return ent && ent.latest && ent.latest[key] ? ent.latest[key] : null; }
  function latestPills(stat) {
    if (!stat) return "";
    const bits = [];
    if (U().finite(stat.yoy_pct)) bits.push('<span class="og-pk">1Y</span>' + U().pill(U().signed(stat.yoy_pct, "%")));
    if (U().finite(stat.vs_normal_pct)) bits.push('<span class="og-pk">vs 15–24</span>' + U().pill(U().signed(stat.vs_normal_pct, "%")));
    return bits.join("");
  }
  function annual(root, file) {
    const meta = (file && file.meta) || {};
    const body = block(root, "Country and region", (meta.source || "Energy Institute Statistical Review") + ", through " + (meta.data_to || ""), "");
    if (!file || !file.entities) {
      body.innerHTML = '<p class="og-na">The annual energy file is not available yet.</p>';
      return;
    }
    const fuels = (file.dropdown && file.dropdown.fuels) || [];
    const regions = (file.dropdown && file.dropdown.regions) || [];
    const countries = (file.dropdown && file.dropdown.countries) || [];
    const compare = (file.dropdown && file.dropdown.default_comparison) || [];
    state.fuel = (file.dropdown && file.dropdown.default_fuel) || "oil";
    state.place = "__compare";
    const opt = names => names.filter(n => file.entities[n]).map(n => '<option value="' + U().esc(n) + '">' + U().esc(shortName(n)) + "</option>").join("");
    body.insertAdjacentHTML("beforeend", '<div class="og-controls"><label>Place <select id="ogPlace" aria-label="Country or region"><option value="__compare">Europe, Asia Pacific, China, India, World</option><optgroup label="Regions">' + opt(regions) + '</optgroup><optgroup label="Countries">' + opt(countries) + "</optgroup></select></label><div class=\"og-fuels\" role=\"group\" aria-label=\"Fuel\">" + fuels.map(f => '<button type="button" data-fuel="' + U().esc(f.id) + '">' + U().esc(f.label) + "</button>").join("") + "</div></div><div id=\"ogAnnual\"></div>");
    const sel = body.querySelector("#ogPlace");
    const fuelById = id => fuels.find(f => f.id === id) || fuels[0];
    const paint = () => {
      const fuel = fuelById(state.fuel);
      body.querySelectorAll(".og-fuels button").forEach(b => b.classList.toggle("is-on", b.getAttribute("data-fuel") === fuel.id));
      const host = body.querySelector("#ogAnnual");
      host.innerHTML = "";
      const cols = ["#8b95a8", "#e8c56b", "#fb7185", "#5bc0eb", "#f4f7fb"];
      const take = body.parentElement.querySelector(".og-take");
      if (state.place === "__compare") {
        const names = compare.filter(n => file.entities[n]);
        const plot = document.createElement("div");
        plot.className = "og-plot";
        host.appendChild(plot);
        U().lineChart(plot, {
          h: 168, aria: "Per person, " + fuel.label,
          series: names.map((n, i) => ({ color: cols[i % cols.length], width: 1.7, vals: file.entities[n][fuel.per_capita] || [] }))
        });
        host.insertAdjacentHTML("beforeend", '<p class="og-leg">' + names.map((n, i) => '<span><i style="--c:' + cols[i % cols.length] + '"></i>' + U().esc(shortName(n)) + "</span>").join("") + "</p>");
        names.forEach(n => {
          const stat = latestOf(file.entities[n], fuel.per_capita);
          const a = atYear(file.entities[n], fuel.per_capita, 2000), b = atYear(file.entities[n], fuel.per_capita, 2025);
          host.insertAdjacentHTML("beforeend", '<p class="og-sub"><b>' + U().esc(shortName(n)) + "</b> " + (U().fmt(a, 2) || "–") + " → " + (U().fmt(b, 2) || "–") + " " + latestPills(stat) + "</p>");
        });
        if (take) take.textContent = compareStory(file);
        return;
      }
      const ent = file.entities[state.place];
      if (!ent) { host.innerHTML = '<p class="og-na">Not available for this place.</p>'; return; }
      const plot = document.createElement("div");
      plot.className = "og-plot";
      host.appendChild(plot);
      const series = [];
      if (fuel.production && ent[fuel.production]) series.push({ color: "#e8c56b", width: 1.7, vals: ent[fuel.production] });
      if (fuel.consumption && ent[fuel.consumption]) series.push({ color: "#8b95a8", width: 1.7, vals: ent[fuel.consumption] });
      if (series.length) U().lineChart(plot, { h: 150, aria: shortName(state.place), series: series });
      else host.insertAdjacentHTML("beforeend", '<p class="og-na">n/a</p>');
      let leg = "";
      if (fuel.production) leg += '<span><i style="--c:#e8c56b"></i>Production</span>';
      if (fuel.consumption) leg += '<span><i style="--c:#8b95a8"></i>' + (fuel.id === "total_energy" ? "Total energy supply" : "Consumption") + "</span>";
      host.insertAdjacentHTML("beforeend", '<p class="og-leg">' + leg + "</p>");
      if (!fuel.production && fuel.production_note) host.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(fuel.production_note) + "</p>");
      const prod = fuel.production ? latestOf(ent, fuel.production) : null;
      const cons = latestOf(ent, fuel.consumption);
      if (prod && U().finite(prod.value)) host.insertAdjacentHTML("beforeend", '<p class="og-sub">Production ' + U().fmt(prod.value, prod.value >= 100 ? 0 : 1) + " " + latestPills(prod) + "</p>");
      if (cons && U().finite(cons.value)) host.insertAdjacentHTML("beforeend", '<p class="og-sub">' + (fuel.id === "total_energy" ? "Supply " : "Consumption ") + U().fmt(cons.value, cons.value >= 100 ? 0 : 1) + " " + latestPills(cons) + "</p>");
      const pcPlot = document.createElement("div");
      pcPlot.className = "og-plot";
      host.appendChild(pcPlot);
      if (ent[fuel.per_capita]) U().lineChart(pcPlot, { h: 120, aria: "Per person", series: [{ color: "#fb7185", width: 1.7, vals: ent[fuel.per_capita] }] });
      const pc = latestOf(ent, fuel.per_capita);
      const pop = latestOf(ent, "population");
      const gdp = latestOf(ent, "gdp_per_capita_const2015_usd");
      if (pc && U().finite(pc.value)) host.insertAdjacentHTML("beforeend", '<p class="og-sub">Per person ' + U().fmt(pc.value, 2) + " " + latestPills(pc) + "</p>");
      if (pop && U().finite(pop.value)) host.insertAdjacentHTML("beforeend", '<p class="og-sub">Population ' + U().fmt(pop.value / 1e6, 1) + " million " + latestPills(pop) + "</p>");
      if (gdp && U().finite(gdp.value)) host.insertAdjacentHTML("beforeend", '<p class="og-sub">GDP per capita $' + U().fmt(gdp.value, 0) + " (2015 prices) " + latestPills(gdp) + "</p>");
      else if (ent.kind === "region") host.insertAdjacentHTML("beforeend", '<p class="og-note">Regional GDP is not in this file, so it is not shown.</p>');
      if (take && cons) take.textContent = shortName(state.place) + " " + fuel.label.toLowerCase() + " " + (fuel.id === "total_energy" ? "supply " : "consumption ") + U().fmt(cons.value, 1) + " in " + cons.year + (U().finite(cons.yoy_pct) ? ", " + U().signed(cons.yoy_pct, "%") + " versus the year before" : "") + (U().finite(cons.vs_normal_pct) ? ", " + U().signed(cons.vs_normal_pct, "%") + " versus 2015–24" : "") + ".";
    };
    body.querySelector(".og-fuels").addEventListener("click", e => {
      const b = e.target.closest("[data-fuel]");
      if (!b) return;
      state.fuel = b.getAttribute("data-fuel");
      paint();
    });
    sel.addEventListener("change", () => { state.place = sel.value; paint(); });
    paint();
  }
  function compareStory(file) {
    const E = file.entities;
    const pair = (name, key, d) => {
      const a = atYear(E[name], key, 2000), b = atYear(E[name], key, 2025);
      return U().fmt(a, d) + " → " + U().fmt(b, d);
    };
    const euOil = atYear(E["Total Europe"], "oil_cons_bbl_per_person", 2025);
    const cnOil = atYear(E.China, "oil_cons_bbl_per_person", 2025);
    const euTes = atYear(E["Total Europe"], "tes_gj_per_person", 2025);
    const cnTes = atYear(E.China, "tes_gj_per_person", 2025);
    const oilLine = cnOil != null && euOil != null && cnOil < euOil ? "China’s oil per person rose from " + pair("China", "oil_cons_bbl_per_person", 2) + ", and is still below Europe’s " + U().fmt(euOil, 2) + "." : "";
    const tesLine = cnTes != null && euTes != null && cnTes > euTes ? " China’s total energy per person is now " + U().fmt(cnTes, 1) + " GJ, above Europe’s " + U().fmt(euTes, 1) + "." : "";
    return "From 2000 to 2025, world oil per person was almost flat (" + pair("Total World", "oil_cons_bbl_per_person", 2) + " barrels a year; total energy " + pair("Total World", "tes_gj_per_person", 1) + " GJ). Europe fell (" + pair("Total Europe", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total Europe", "tes_gj_per_person", 1) + " GJ) and so did the EU (" + pair("Total EU", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total EU", "tes_gj_per_person", 1) + " GJ). Asia Pacific rose (" + pair("Total Asia Pacific", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Total Asia Pacific", "tes_gj_per_person", 1) + " GJ). " + oilLine + tesLine + " India is still low (" + pair("India", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("India", "tes_gj_per_person", 1) + " GJ; oil per person " + (U().signed((latestOf(E.India, "oil_cons_bbl_per_person") || {}).yoy_pct, "%") || "n/a") + " in 2025). The US fell (" + pair("US", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("US", "tes_gj_per_person", 1) + " GJ) and Germany fell (" + pair("Germany", "oil_cons_bbl_per_person", 2) + " barrels, " + pair("Germany", "tes_gj_per_person", 1) + " GJ).";
  }

  function medium(root, outlook) {
    const oil = outlook.oil || {};
    const iea = oil.medium_term_iea;
    const body = block(root, "Medium and long term", iea ? iea.source + ", published " + (iea.published || "") : "", "");
    if (iea && iea.rows) {
      const want = ["OECD Europe", "China", "Other Asia", "Total demand"].filter(n => iea.rows[n]);
      const years = iea.years || [];
      const cols = ["#8b95a8", "#fb7185", "#e8c56b", "#f4f7fb"];
      const plot = document.createElement("div");
      plot.className = "og-plot";
      body.appendChild(plot);
      U().lineChart(plot, {
        h: 150, aria: "IEA Oil 2025 demand",
        series: want.map((n, i) => ({ color: cols[i], width: 1.6, vals: iea.rows[n] }))
      });
      body.insertAdjacentHTML("beforeend", '<p class="og-leg">' + want.map((n, i) => '<span><i style="--c:' + cols[i] + '"></i>' + U().esc(n) + "</span>").join("") + "</p>");
      body.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(iea.note || "") + " Years " + U().esc((years[0] || "") + "–" + (years[years.length - 1] || "")) + ".</p>");
    }
    const opec = oil.long_term_opec;
    if (opec && opec.demand && opec.demand.rows) {
      const rows = opec.demand.rows;
      const names = ["China", "India", "OECD Europe"].filter(n => rows[n]);
      if (names.length) {
        body.insertAdjacentHTML("beforeend", "<h3>OPEC World Oil Outlook 2026 demand</h3>");
        const plot = document.createElement("div");
        plot.className = "og-plot";
        body.appendChild(plot);
        const cols = ["#fb7185", "#e8c56b", "#8b95a8"];
        U().lineChart(plot, { h: 130, aria: "OPEC demand", series: names.map((n, i) => ({ color: cols[i], vals: rows[n], width: 1.6 })) });
        body.insertAdjacentHTML("beforeend", '<p class="og-leg">' + names.map((n, i) => '<span><i style="--c:' + cols[i] + '"></i>' + n + "</span>").join("") + " · " + U().esc((opec.demand.years || []).join(", ")) + "</p>");
      }
    }
    const weo = oil.long_term_iea;
    if (weo) body.insertAdjacentHTML("beforeend", '<p class="og-note">WEO-2025: ' + U().esc(weo.stated_policies || "") + " " + U().esc(weo.current_policies || "") + " " + U().esc(weo.note || "") + "</p>");
    const gas = outlook.gas && outlook.gas.long_term_opec;
    if (gas && gas.rows) {
      const names = ["OECD Europe", "China", "India"].filter(n => gas.rows[n]);
      if (names.length) body.insertAdjacentHTML("beforeend", '<p class="og-sub">OPEC gas demand, ' + U().esc(gas.unit || "") + ": " + names.map(n => n + " " + U().fmt(gas.rows[n][0], 1) + " → " + U().fmt(gas.rows[n][gas.rows[n].length - 1], 1)).join("; ") + ".</p>");
    }
    const take = body.parentElement.querySelector(".og-take");
    if (take && iea && iea.rows && iea.rows["Total demand"]) {
      const d = iea.rows["Total demand"];
      take.textContent = "IEA Oil 2025, labelled pre-war because Oil 2026 was postponed: total demand " + U().fmt(d[0], 1) + " mb/d in " + iea.years[0] + " and " + U().fmt(d[d.length - 1], 1) + " in " + iea.years[iea.years.length - 1] + ". That path is a baseline, not a forecast through the present disruption.";
    }
  }

  function costs(root, cc, quotes) {
    const body = block(root, "Cost curve", "Unit opex or lifting cost as reported, not full-cycle. Bases differ.", "");
    const steps = (cc.og_unit_cost_curve || []).slice().sort((a, b) => a.cum_production_kboed_start - b.cum_production_kboed_start);
    const color = y => /\.OL$/.test(y) ? "#7aa2ff" : /\.ST$/.test(y) ? "#5fb98a" : "#e8c56b";
    const plot = document.createElement("div");
    plot.className = "og-plot";
    body.appendChild(plot);
    const brentLive = quotes["BZ=F"] && U().finite(quotes["BZ=F"].px) ? quotes["BZ=F"].px : null;
    const perm = ((cc.dallasfed_q1_2026 || {}).rows || []).find(r => /Permian \(all/.test(r.play || ""));
    const lines = [];
    if (brentLive) lines.push({ y: brentLive, color: "#f4f7fb", label: "Brent " + U().fmt(brentLive, 0) });
    if (perm && U().finite(perm.breakeven_new_well)) lines.push({ y: perm.breakeven_new_well, color: "#e0706a", label: "Permian new " + U().fmt(perm.breakeven_new_well, 0) });
    if (perm && U().finite(perm.opex_existing_wells)) lines.push({ y: perm.opex_existing_wells, color: "#5fb98a", label: "Permian existing " + U().fmt(perm.opex_existing_wells, 0) });
    U().stepChart(plot, {
      aria: "Unit cost curve",
      steps: steps.map(s => ({ x0: s.cum_production_kboed_start, x1: s.cum_production_kboed_end, y: s.unit_cost_usd_boe, color: color(s.yahoo) })),
      hlines: lines
    });
    body.insertAdjacentHTML("beforeend", '<p class="og-leg"><span><i style="--c:#e8c56b"></i>London</span><span><i style="--c:#7aa2ff"></i>Norway</span><span><i style="--c:#5fb98a"></i>Sweden</span></p>');
    body.insertAdjacentHTML("beforeend", '<table class="og-table"><thead><tr><th>Company</th><th>$/boe</th><th>kboe/d</th><th>Period</th></tr></thead><tbody>' +
      steps.slice().sort((a, b) => a.unit_cost_usd_boe - b.unit_cost_usd_boe).map(s => "<tr><td>" + U().esc(s.company) + "</td><td>" + U().fmt(s.unit_cost_usd_boe, 1) + "</td><td>" + U().fmt(s.production_kboed, 1) + "</td><td>" + U().esc(s.period) + "</td></tr>").join("") +
      "</tbody></table>");
    if (perm) {
      body.insertAdjacentHTML("beforeend", "<h3>Dallas Fed, Q1 2026</h3><table class=\"og-table\"><thead><tr><th>Group</th><th>New well</th><th>Existing opex</th></tr></thead><tbody>" +
        (cc.dallasfed_q1_2026.rows || []).map(r => "<tr><td>" + U().esc(r.play) + "</td><td>" + U().fmt(r.breakeven_new_well, 0) + "</td><td>" + U().fmt(r.opex_existing_wells, 0) + "</td></tr>").join("") +
        "</tbody></table>");
    }
    (cc.gaps || []).forEach(g => body.insertAdjacentHTML("beforeend", '<p class="og-note">' + U().esc(g) + "</p>"));
    const take = body.parentElement.querySelector(".og-take");
    if (take && steps.length) {
      const lo = steps.reduce((a, b) => a.unit_cost_usd_boe < b.unit_cost_usd_boe ? a : b);
      const hi = steps.reduce((a, b) => a.unit_cost_usd_boe > b.unit_cost_usd_boe ? a : b);
      take.textContent = steps.length + " companies report a unit cost, from " + lo.company + " at $" + U().fmt(lo.unit_cost_usd_boe, 1) + "/boe to " + hi.company + " at $" + U().fmt(hi.unit_cost_usd_boe, 1) + ". Harbour Energy is not on this list.";
    }
  }

  function block(root, title, asof, take) {
    const el = document.createElement("section");
    el.className = "og-block";
    el.innerHTML = '<header class="og-h"><h2>' + U().esc(title) + '</h2><p class="og-asof">' + U().esc(asof || "") + '</p></header><p class="og-take">' + U().esc(take || "") + '</p><div class="og-body"></div>';
    root.appendChild(el);
    return el.querySelector(".og-body");
  }

  async function optional(name) {
    try { return await U().getJSON(BASE + name + ".json?t=" + Math.floor(Date.now() / 36e5)); }
    catch (e) { return null; }
  }
  async function load() {
    const out = {};
    await Promise.all(FILES.map(async name => { out[name] = await U().getJSON(BASE + name + ".json?t=" + Math.floor(Date.now() / 36e5)); }));
    out.demographics = await optional("demographics");
    out.annual_energy = await optional("annual_energy");
    let quotes = {};
    try { quotes = await window.MMV2Tiles.loadQuotes(); } catch (e) { quotes = {}; }
    out.quotes = quotes;
    return out;
  }
  function render(root, data) {
    root.innerHTML = "";
    const man = data.manifest || {};
    const head = document.createElement("div");
    head.className = "og-top";
    head.innerHTML = "<h1>Oil & gas</h1><p class=\"og-asof\">Files as of " + U().esc(man.as_of || "") + "</p>";
    root.appendChild(head);
    const book = fromEI(data.oil_gas_history_ei || {});
    absorbAnnual(data.annual_energy, book);
    state.book = book;
    state.demo = data.demographics;
    if (data.spot_daily) priceStrip(root, data.spot_daily, data.quotes || {});
    if (data.us_weekly) weekly(root, data.us_weekly);
    if (data.oil_balance_steo) balance(root, data.oil_balance_steo, data.outlooks);
    annual(root, data.annual_energy);
    if (data.outlooks) medium(root, data.outlooks);
    if (data.cost_curves) costs(root, data.cost_curves, data.quotes || {});
    const tiles = document.createElement("section");
    tiles.className = "og-block";
    tiles.innerHTML = '<header class="og-h"><h2>Companies</h2><p class="og-asof">London, Sweden, Norway</p></header><div class="v2co"></div>';
    root.appendChild(tiles);
    window.MMV2Tiles.mount(tiles.querySelector(".v2co"), "oil");
    const foot = document.createElement("p");
    foot.className = "og-foot";
    foot.innerHTML = 'Sources: EIA STEO and weekly statistics, Energy Institute Statistical Review 2026, IEA Oil 2025 and the October 2026 Oil Market Report highlights, OPEC World Oil Outlook 2026, Dallas Fed Q1 2026. <a href="https://github.com/MasterKano/emmi-data/tree/main/og-mining-v2">emmi-data og-mining-v2</a>. A blank is n/a.';
    root.appendChild(foot);
  }
  async function start() {
    const root = document.querySelector("#oilgasView .og-root");
    if (!root || !U()) return;
    try {
      const data = await load();
      state.data = data;
      render(root, data);
    } catch (e) {
      root.innerHTML = '<p class="og-na">' + U().esc(e && e.message ? e.message : "Oil and gas data are not available yet.") + "</p>";
    }
  }
  window.MMV2Oil = { start: start };
  if (document.querySelector("#oilgasView .og-root")) start();
})();
