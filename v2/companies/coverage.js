/* Companies of interest. Names and symbols are the lists already in scripts/universe.py.
   Oil is OIL_GAS_V2 (32). Mining is the six Lundin names. Renewables is the
   Nordic Renewables operating list (not the ETF benchmarks or the strategic-peer screen).
   Faraday, Fireweed and Valiente are not coverage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EMMICoverage = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function row(yahoo, name, tv, extra) {
    return Object.assign({ yahoo: yahoo, name: name, short: name, tv: tv || "", page: yahoo }, extra || {});
  }

  const RENEWABLES = [
    row("CLOUD.OL", "Cloudberry Clean Energy", "OSL:CLOUD"),
    row("SCATC.OL", "Scatec", "OSL:SCATC"),
    row("EOLU-B.ST", "Eolus B", "OMXSTO:EOLU_B"),
    row("ORRON.ST", "Orrön Energy", "OMXSTO:ORRON"),
    row("MGN.OL", "Magnora", "OSL:MGN"),
    row("ORSTED.CO", "Ørsted", "OMXCOP:ORSTED"),
    row("VWS.CO", "Vestas Wind Systems", "OMXCOP:VWS"),
    row("FORTUM.HE", "Fortum", "OMXHEX:FORTUM"),
    row("RWE.DE", "RWE", "XETR:RWE"),
    row("EDPR.LS", "EDP Renováveis", "EURONEXT:EDPR"),
    row("ANE.MC", "Acciona Energía", "BME:ANE"),
    row("SLR.MC", "Solaria", "BME:SLR"),
    row("GRE.MC", "Grenergy", "BME:GRE"),
    row("ERG.MI", "ERG", "MIL:ERG"),
    row("VLTSA.PA", "Voltalia", "EURONEXT:VLTSA"),
    row("NDX1.DE", "Nordex", "XETR:NDX1")
  ];

  const OIL = [
    row("TLW.L", "Tullow Oil", "LSE:TLW", { group: "London" }),
    row("CNE.L", "Capricorn Energy", "LSE:CNE", { group: "London" }),
    row("GENL.L", "Genel Energy", "LSE:GENL", { group: "London" }),
    row("ECO.L", "Eco (Atlantic) Oil & Gas", "LSE:ECO", { group: "London" }),
    row("ITH.L", "Ithaca Energy", "LSE:ITH", { group: "London" }),
    row("AET.L", "Afentra", "LSE:AET", { group: "London" }),
    row("KIST.L", "Kistos", "LSE:KIST", { group: "London" }),
    row("JSE.L", "Jadestone Energy", "LSE:JSE", { group: "London" }),
    row("CHAR.L", "Chariot", "LSE:CHAR", { group: "London" }),
    row("TXP.L", "Touchstone Exploration", "LSE:TXP", { group: "London" }),
    row("GKP.L", "Gulf Keystone Petroleum", "LSE:GKP", { group: "London" }),
    row("SER.L", "Serica Energy", "LSE:SER", { group: "London" }),
    row("ENOG.L", "Energean", "LSE:ENOG", { group: "London" }),
    row("SEPL.L", "Seplat Energy", "LSE:SEPL", { group: "London" }),
    row("RKH.L", "Rockhopper Exploration", "LSE:RKH", { group: "London" }),
    row("ENQ.L", "EnQuest", "LSE:ENQ", { group: "London" }),
    row("PHAR.L", "Pharos Energy", "LSE:PHAR", { group: "London" }),
    row("IPCO.ST", "International Petroleum Corp", "OMXSTO:IPCO", { group: "Sweden" }),
    row("SNM-SDB.ST", "ShaMaran Petroleum", "OMXSTO:SNM_SDB", { group: "Sweden" }),
    row("AEC.ST", "Africa Energy", "OMXSTO:AEC", { group: "Sweden" }),
    row("MER.ST", "Meren Energy", "OMXSTO:MER", { group: "Sweden" }),
    row("EQNR.OL", "Equinor", "OSL:EQNR", { group: "Norway" }),
    row("AKRBP.OL", "Aker BP", "OSL:AKRBP", { group: "Norway" }),
    row("VAR.OL", "Vår Energi", "OSL:VAR", { group: "Norway" }),
    row("DNO.OL", "DNO", "OSL:DNO", { group: "Norway" }),
    row("BNOR.OL", "BlueNord", "OSL:BNOR", { group: "Norway" }),
    row("BWE.OL", "BW Energy", "OSL:BWE", { group: "Norway" }),
    row("OKEA.OL", "OKEA", "OSL:OKEA", { group: "Norway" }),
    row("PEN.OL", "Panoro Energy", "OSL:PEN", { group: "Norway" }),
    row("PNOR.OL", "PetroNor E&P", "OSL:PNOR", { group: "Norway" }),
    row("QEC.OL", "Questerre Energy", "OSL:QEC", { group: "Norway" }),
    row("IOX.OL", "Interoil Exploration and Production", "OSL:IOX", { group: "Norway" })
  ];

  const MINING = [
    row("LUMI.ST", "Lundin Mining", "OMXSTO:LUMI", { listing: "st" }),
    row("LUG.ST", "Lundin Gold", "OMXSTO:LUG", { listing: "st" }),
    row("LUC.ST", "Lucara Diamond", "OMXSTO:LUC", { listing: "st", short: "Lucara" }),
    row("", "NGEx Minerals", "", { listing: "none", page: "nolist:NGEx", short: "NGEx Minerals" }),
    row("", "Montage Gold", "", { listing: "none", page: "nolist:Montage", short: "Montage Gold" }),
    row("", "LunR Royalties", "", { listing: "none", page: "nolist:LunR", short: "LunR Royalties" })
  ];

  /* Tickers the research files use for these same names. Not extra companies. */
  const CODE_ALIAS = [
    "SQZ", "SQZ.L", "LUN", "LUN.TO", "LUG.TO", "LUC.TO", "NGEX", "NGEX.TO", "MAU", "MAU.TO", "LUNR", "LUNR.TO",
    "IPCO", "IPCO.TO", "SNM", "SNM.OL", "ORRON", "EQNR", "AKRBP", "VAR", "DNO", "BNOR", "BWE", "OKEA", "PEN",
    "PNOR", "QEC", "IOX", "AEC", "MER", "SER", "TLW", "CNE", "GENL", "ECO", "ITH", "AET", "KIST", "JSE", "CHAR",
    "TXP", "GKP", "ENOG", "SEPL", "RKH", "ENQ", "PHAR", "LUMI", "LUG", "LUC",
    "CLOUD", "SCATC", "EOLU", "EOLU-B", "EOLUB", "MGN", "ORSTED", "VWS", "FORTUM", "RWE", "EDPR", "ANE", "SLR",
    "GRE", "VLTSA", "NDX1"
  ];

  const BLOCK = ["faraday", "fireweed", "valiente", "fdy", "fwz"];

  function fold(s) {
    return String(s || "").toLowerCase()
      .replace(/ø/g, "o").replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/æ/g, "ae")
      .replace(/é/g, "e").replace(/á/g, "a").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/\b(plc|asa|ab|ltd|limited|inc|corp|corporation|oyj|publ|se)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim().replace(/\s+/g, " ");
  }

  const NAMES = new Set();
  function addName(value) {
    const n = fold(value);
    if (n) NAMES.add(n);
  }
  RENEWABLES.concat(OIL, MINING).forEach(c => {
    addName(c.name);
    addName(c.short);
  });
  ["orsted", "edp renovaveis", "eolus", "eolus b", "var energi", "shamaran", "international petroleum",
    "africa energy", "meren", "bluenord", "bw energy", "panoro", "petronor", "questerre", "interoil",
    "capricorn", "genel", "tullow", "ithaca", "afentra", "kistos", "jadestone", "chariot", "touchstone",
    "gulf keystone", "serica", "energean", "seplat", "rockhopper", "enquest", "pharos", "cloudberry",
    "scatec", "magnora", "vestas", "vestas wind systems", "fortum", "rwe", "acciona energia", "solaria",
    "grenergy", "voltalia", "nordex", "orrön energy", "orron", "lundin mining", "lundin gold", "lucara",
    "ngex", "ngex minerals", "montage", "montage gold", "lunr", "lunr royalties", "aker bp", "equinor",
    "dno", "okea", "eco atlantic"].forEach(addName);

  const CODES = new Set(CODE_ALIAS.map(c => c.toUpperCase()));
  function addCode(sym) {
    const s = String(sym || "").toUpperCase();
    if (!s) return;
    CODES.add(s);
    const bare = s.split(".")[0].replace(/-SDB$/, "").replace(/-B$/, "");
    if (bare) CODES.add(bare);
  }
  RENEWABLES.concat(OIL, MINING).forEach(c => addCode(c.yahoo));

  function blocked(value) {
    const n = fold(value);
    if (!n) return false;
    return BLOCK.some(b => n === b || n.startsWith(b + " "));
  }

  function hit(value) {
    const raw = String(value || "").trim();
    if (!raw || blocked(raw)) return false;
    const up = raw.toUpperCase();
    if (CODES.has(up)) return true;
    const token = up.replace(/^OSLO AND NYSE:\s*/i, "").replace(/^OSLO:\s*/i, "").replace(/^LSE:\s*/i, "").trim();
    if (CODES.has(token)) return true;
    const bare = token.split(/[\s:/]/).pop();
    if (bare && CODES.has(bare.replace(/[^A-Z0-9.-]/g, ""))) return true;
    const n = fold(raw);
    if (!n || blocked(n)) return false;
    if (NAMES.has(n)) return true;
    let ok = false;
    NAMES.forEach(name => {
      if (ok || name.length < 4) return;
      if (n === name || n.startsWith(name + " ")) ok = true;
    });
    return ok;
  }

  function screenRows(rows) {
    return (rows || []).filter(row => row && (hit(row.code) || hit(row.name) || hit(row.ticker) || hit(row.short)));
  }

  function norwayCompanies(rows) {
    return (rows || []).filter(row => row && (hit(row.short_name) || hit(row.name) || hit((row.parent_listed || {}).ticker) || hit(row.listing_ticker)));
  }

  function norwayEvents(rows) {
    return (rows || []).map(ev => {
      if (!ev) return null;
      const names = (ev.companies || []).filter(hit);
      const partners = (ev.other_partners || []).filter(hit);
      const op = hit(ev.operator) ? ev.operator : "";
      if (!names.length && !partners.length && !op) return null;
      return Object.assign({}, ev, { companies: names, other_partners: partners, operator: op || null });
    }).filter(Boolean);
  }

  function comingItems(items) {
    return (items || []).filter(item => item && (hit(item.company_code) || hit(item.company_name) || hit(item.link_key)));
  }

  function countryFile(file) {
    if (!file) return null;
    const companies = (file.companies || []).filter(c => hit(c.code) || hit(c.name) || hit(c.ticker));
    const cat = rows => (rows || []).filter(r => hit(r.company) || hit(r.company_code) || hit(r.company_name) || hit(r.code) || hit(r.name) || (Array.isArray(r.companies) && r.companies.some(hit)));
    const catalysts = cat(file.catalysts);
    const beyond = cat(file.beyond_window);
    const context = (file.context || []).filter(hit);
    if (!companies.length && !catalysts.length && !beyond.length) return null;
    return Object.assign({}, file, { companies: companies, catalysts: catalysts, beyond_window: beyond, context: context });
  }

  function pilotRows(rows) {
    return (rows || []).filter(row => row && (hit(row.ticker) || hit(row.company) || hit(row.code)));
  }

  function byPage(page) {
    return MINING.concat(OIL, RENEWABLES).find(c => c.page === page || c.yahoo === page) || null;
  }

  return {
    renewables: RENEWABLES,
    oil: OIL,
    mining: MINING,
    hit: hit,
    fold: fold,
    screenRows: screenRows,
    norwayCompanies: norwayCompanies,
    norwayEvents: norwayEvents,
    comingItems: comingItems,
    countryFile: countryFile,
    pilotRows: pilotRows,
    byPage: byPage
  };
});
