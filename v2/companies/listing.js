/* Listing rule for the company tiles and profiles.
   Dual-listed mining names use the Stockholm line. A name with no Stockholm
   quote stays blank. The share price keeps the trading currency of that line. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MMListing = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  /* Yahoo symbols confirmed against the company sites and the Yahoo chart API.
     LUC.ST is Nasdaq First North Growth Market, Stockholm, still a .ST line. */
  const STOCKHOLM = {
    "LUN.TO": { yahoo: "LUMI.ST", ticker: "LUMI.ST" },
    "LUG.TO": { yahoo: "LUG.ST", ticker: "LUG.ST" },
    "LUC.TO": { yahoo: "LUC.ST", ticker: "LUC.ST" }
  };
  /* No Nasdaq Stockholm or First North quote. Do not price the Toronto line instead. */
  const NO_STOCKHOLM = { "NGEX.TO": true, "MAU.TO": true, "LUNR.TO": true };
  /* Company file still stores fundamentals under the previous symbol. */
  const FUNDAMENTALS = {
    "SER.L": "SQZ.L",
    "SNM-SDB.ST": "SNM.OL",
    "IPCO.ST": "IPCO.TO",
    "LUMI.ST": "LUN.TO",
    "LUG.ST": "LUG.TO",
    "LUC.ST": "LUC.TO"
  };
  const EXCH = {
    STO: "Stockholm", ST: "Stockholm", OMXSTO: "Stockholm", SSME: "Stockholm",
    TOR: "Toronto", TSX: "Toronto", TO: "Toronto",
    OSL: "Oslo", LSE: "LSE"
  };

  function ccyLabel(ccy) {
    if (ccy === "GBp" || ccy === "GBX") return "GBp";
    if (!ccy) return "";
    return String(ccy);
  }
  function exchLabel(code) {
    if (!code) return "";
    return EXCH[code] || String(code);
  }
  function finite(v) {
    return typeof v === "number" && Number.isFinite(v);
  }
  /* Price for the symbol that was opened. Never a different listing's row. */
  function quoteRow(sym, tableRow, quoteMap, own) {
    if (tableRow && finite(tableRow.px) && (!tableRow.sym || tableRow.sym === sym)) return tableRow;
    const q = quoteMap && quoteMap[sym];
    if (q && finite(q.px)) return q;
    if (own && (!own.sym || own.sym === sym) && finite(own.px)) {
      return {
        sym: sym, px: own.px, ccy: own.ccy || "", exch: own.exch || "", name: own.name || "",
        pct: finite(own.chg_pct) ? { "1D": own.chg_pct } : null
      };
    }
    return null;
  }
  function miningCompany(company) {
    const y = company && company.yahoo || "";
    const st = STOCKHOLM[y];
    if (st) return Object.assign({}, company, { yahoo: st.yahoo, exchange_ticker: st.ticker, listing: "st" });
    if (NO_STOCKHOLM[y]) {
      return Object.assign({}, company, {
        yahoo: "",
        exchange_ticker: "No Stockholm listing",
        listing: "none"
      });
    }
    return company;
  }

  return {
    STOCKHOLM: STOCKHOLM,
    NO_STOCKHOLM: NO_STOCKHOLM,
    fundamentals: FUNDAMENTALS,
    ccyLabel: ccyLabel,
    exchLabel: exchLabel,
    quoteRow: quoteRow,
    miningCompany: miningCompany
  };
});
