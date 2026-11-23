/* Analysis-coverage companies. Same symbols as FUNDAMENTALS in scripts/universe.py.
   These names have a full company page and are not rows on a market tab. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EMMIFundamentals = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  return [
    { sym: "MTRS.ST", name: "Munters", tv: "OMXSTO:MTRS" },
    { sym: "HTRO.ST", name: "Hexatronic", tv: "OMXSTO:HTRO" },
    { sym: "NKT.CO", name: "NKT", tv: "OMXCOP:NKT" },
    { sym: "ABBN.SW", name: "ABB", tv: "SIX:ABBN" },
    { sym: "SU.PA", name: "Schneider Electric", tv: "EURONEXT:SU" },
    { sym: "ENR.DE", name: "Siemens Energy", tv: "XETR:ENR" },
    { sym: "EQIX", name: "Equinix", tv: "NASDAQ:EQIX" },
    { sym: "DLR", name: "Digital Realty", tv: "NYSE:DLR" },
    { sym: "VRT", name: "Vertiv", tv: "NYSE:VRT" },
    { sym: "CEG", name: "Constellation Energy", tv: "NASDAQ:CEG" },
    { sym: "GEV", name: "GE Vernova", tv: "NYSE:GEV" }
  ];
});
