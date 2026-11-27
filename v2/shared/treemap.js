/* Sector maps (treemaps) for the Markets Equities Monitor, drawn natively from emmi-data data/region_maps.json
   (scripts/build_region_maps.py): S&P 500, Europe top 80, Nikkei 225, CSI 300. window.EMMITreemap.
   Two levels, squarified: sectors by weight, then companies by market cap (CSI 300: index weight). Box colour = the day's
   % move (green up, red down, slate near zero; the same ramp in light and dark, white labels on every shade). Names and
   moves are printed only where they fit; every box has a hover / tap card with the full name, sector, price, move and size.
   Very small boxes in a sector fold into one "+N more" box (its card lists them). Re-laid out on resize. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const finite = v => typeof v === "number" && isFinite(v);
  const sg = (v, d) => (finite(v) ? (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(d == null ? 2 : d) + "%" : "n/a");

  /* ---------- squarified layout (Bruls, Huizing, van Wijk) ---------- */
  function worst(row, w) {
    let s = 0, mx = -Infinity, mn = Infinity;
    row.forEach(r => { s += r.a; if (r.a > mx) mx = r.a; if (r.a < mn) mn = r.a; });
    const s2 = s * s, w2 = w * w;
    return Math.max(w2 * mx / s2, s2 / (w2 * mn));
  }
  /* items: [{v, ...}] (v > 0) -> same objects with x, y, w, h inside the rect */
  function squarify(items, x, y, w, h) {
    const tot = items.reduce((a, b) => a + b.v, 0);
    if (!(tot > 0) || w <= 0 || h <= 0) return [];
    const scale = (w * h) / tot;
    const rest = items.filter(i => i.v > 0).sort((a, b) => b.v - a.v).map(i => Object.assign(i, { a: i.v * scale }));
    const out = [];
    let row = [];
    while (rest.length) {
      const side = Math.min(w, h), c = rest[0];
      if (!row.length || worst(row.concat([c]), side) <= worst(row, side)) { row.push(rest.shift()); continue; }
      ({ x, y, w, h } = place(row, x, y, w, h, out));
      row = [];
    }
    if (row.length) place(row, x, y, w, h, out);
    return out;
  }
  function place(row, x, y, w, h, out) {
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {               /* column on the left */
      const cw = s / h; let yy = y;
      row.forEach(r => { const rh = r.a / cw; out.push(Object.assign(r, { x: x, y: yy, w: cw, h: rh })); yy += rh; });
      return { x: x + cw, y: y, w: w - cw, h: h };
    }
    const rh = s / w; let xx = x;   /* row on top */
    row.forEach(r => { const rw = r.a / rh; out.push(Object.assign(r, { x: xx, y: y, w: rw, h: rh })); xx += rw; });
    return { x: x, y: y + rh, w: w, h: h - rh };
  }

  /* ---------- colour: % move -> fill (white text passes 4.5:1 on every shade) ---------- */
  const NEU = [91, 101, 115], UP = [21, 128, 61], DN = [185, 28, 28], UP2 = [20, 83, 45], DN2 = [127, 29, 29];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function heat(v, cap) {
    if (!finite(v)) return "rgb(" + NEU.join(",") + ")";
    const t = Math.min(1, Math.abs(v) / (cap || 3)), hi = v > 0 ? UP : DN, deep = v > 0 ? UP2 : DN2;
    const c = t < 0.08 ? NEU : t < 0.7 ? mix(NEU, hi, (t - 0.08) / 0.62) : mix(hi, deep, (t - 0.7) / 0.3);
    return "rgb(" + c.join(",") + ")";
  }

  /* ---------- one map ---------- */
  const HEAD = 15;   /* sector label band, px */
  const MIN_FS = 7;  /* smallest box label font, px */
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';   /* as .tm-l in live.css */
  /* Curated box names (Jerry 27 Nov 2026: no numeric codes and no cut-off names on boxes). Keyed by ticker:
     [box name or null = the data's short name, short form of 5 characters or fewer or null]. Checked against each
     company's full name in region_maps.json. The box name replaces a data short name shared by several companies
     (Sumitomo, Mitsui, China National ...) or a misleading one (Japan for Japan Tobacco); the short form is used only
     where the name does not fit even at MIN_FS. */
  const SHORT = {
    "8002.T": ["Marubeni", "Marub"], "8053.T": ["Sumitomo", "SumiC"], "8031.T": ["Mitsui", "Mitsui"], "6981.T": ["Murata", "Murata"],
    "6752.T": ["Panasonic", "Pana"], "6702.T": ["Fujitsu", "Fjtsu"], "9984.T": ["SoftBank", "SBG"], "9434.T": ["SB Corp", "SBC"],
    "4519.T": ["Chugai", "Chgai"], "4502.T": ["Takeda", "TAK"], "4578.T": ["Otsuka", "Otsuka"], "7267.T": ["Honda", "Honda"],
    "8802.T": ["Mitsubishi Est", "MEC"], "8801.T": ["Mitsui Fud", "MFud"], "8015.T": ["Toyota Tsu", "TTsu"], "9104.T": ["MOL", "MOL"],
    "9107.T": ["K Line", "KLine"], "9201.T": ["JAL", "JAL"], "7012.T": ["Kawasaki HI", "KHI"], "6305.T": ["Hitachi CM", "HCM"],
    "5706.T": ["Mitsui Kinz", "MKinz"], "6302.T": ["Sumitomo HI", "SHI"], "4307.T": ["NRI", "NRI"], "8309.T": ["SuMi Trust", "SMTH"],
    "8697.T": ["JPX", "JPX"], "7186.T": ["Yokohama FG", "YokFG"], "5101.T": ["Yokohama Rub", "YokoR"], "4506.T": ["Sumitomo Ph", "SumPh"],
    "2914.T": ["JT", "JT"], "5713.T": ["Sumitomo MM", "SMM"], "4188.T": ["Mitsubishi Ch", "MCG"], "4021.T": ["Nissan Chem", "NisCh"],
    "4005.T": ["Sumitomo Ch", "SumCh"], "4183.T": ["Mitsui Chem", "MCI"], "5711.T": ["Mitsubishi Mat", "MMat"], "8830.T": ["Sumitomo RE", "SumRE"],
    "3289.T": ["Tokyu Fud", "TokyuF"], "9501.T": ["TEPCO", "TEPCO"], "5802.T": ["Sumitomo El", "SEI"], "8804.T": ["Tokyo Tatemono", "TTate"],
    "9503.T": ["Kansai EP", "KEPCO"], "9502.T": ["Chubu EP", "Chubu"], "8725.T": ["MS&AD", "MS&AD"], "4661.T": ["Oriental Land", "OLC"],
    "300502.SZ": ["Eoptolink", "Eopto"], "688256.SS": ["Cambricon", "Cambr"], "688126.SS": ["NSIG", "NSIG"], "688396.SS": ["CR Micro", "CRMic"],
    "601995.SS": ["CICC", "CICC"], "600999.SS": ["CM Sec", "CMSec"], "601818.SS": ["Everbright Bk", "EB Bk"], "601825.SS": ["SH Rural Bk", "SRCB"],
    "601916.SS": ["Zheshang Bk", "ZS Bk"], "601077.SS": ["CQ Rural Bk", "CQRCB"], "601066.SS": ["CSC Fin", "CSC"], "601788.SS": ["Everbright Sec", "EBSec"],
    "601878.SS": ["Zheshang Sec", "ZSSec"], "601919.SS": ["Cosco Ship", "COSCO"], "600760.SS": ["AVIC SY", "AVIC"], "600893.SS": ["AECC Aero", "AECC"],
    "601100.SS": ["Hengli Hyd", "HLHyd"], "601390.SS": ["China Rail", "CREC"], "601727.SS": ["SH Electric", "SHEle"], "600118.SS": ["Spacesat", "SpSat"],
    "600009.SS": ["SH Airport", "SHAir"], "601186.SS": ["CRCC", "CRCC"], "600115.SS": ["China East", "CEA"], "601117.SS": ["CNCEC", "CNCEC"],
    "001965.SZ": ["CM Expwy", "CMExp"], "600018.SS": ["SIPG", "SIPG"], "688009.SS": ["CRSC", "CRSC"], "001391.SZ": ["AC Cargo", "AC Cgo"],
    "000807.SZ": ["Yunnan Alu", "YnAlu"], "002648.SZ": ["Satellite Ch", "SatCh"], "600346.SS": ["Hengli Petro", "HLPet"], "000301.SZ": ["Shenghong", "Sheng"],
    "688271.SS": ["United Img", "UIH"], "000538.SZ": ["Yunnan Baiyao", "Baiyao"], "601607.SS": ["SH Pharma", "SHPh"], "000999.SZ": ["CR Sanjiu", "Sanjiu"],
    "601872.SS": ["CM Energy", "CMES"], "600026.SS": ["Cosco Energy", "COSE"], "001280.SZ": ["CN Uranium", "CNU"], "601985.SS": ["CNNP", "CNNP"],
    "600050.SS": ["Unicom", "Unicm"], "601698.SS": ["China Satcom", "Satcm"], "001979.SZ": ["CM Shekou", "CMSK"], "601668.SS": ["CSCEC", "CSCEC"],
    "600111.SS": ["N. Rare Earth", "NRE"], "601600.SS": ["Chalco", "Chalco"], "600415.SS": ["Comm. City", "CCC"], "603288.SS": ["Haitian", "Haitn"],
    "002311.SZ": ["Haid", "Haid"], "300498.SZ": ["Wens", "Wens"], "600515.SS": ["Hainan Airport", "HNAir"], "002602.SZ": ["Century HT", "CHT"],
    "600436.SS": ["Pientzehuang", "PZH"], "300832.SZ": ["Snibe", "Snibe"], "600989.SS": ["Baofeng", "Baofng"], "601211.SS": ["Guotai Haitong", "GTHT"],
    "600803.SS": ["ENN Gas", "ENN"], "600066.SS": ["Yutong", "Yutng"], "600029.SS": ["China Southern", "CSA"], "601868.SS": ["CEEC", "CEEC"],
    "601377.SS": ["Industrial Sec", "IndSc"], "688036.SS": ["Transsion", "Trnss"], "600221.SS": ["Hainan Air", "HNA"], "9147.T": ["Nippon Exp", "NXHD"],
    "002074.SZ": ["Gotion", "Gotn"], "600482.SS": ["CSIC Power", "CSICP"], "600160.SS": ["Juhua", "Juhua"], "9021.T": ["JR West", "JR W"],
    "9020.T": ["JR East", "JR E"], "9022.T": ["JR Central", "JR C"], "601998.SS": ["CITIC Bank", "CITBk"], "000001.SZ": [null, "PA Bk"],
    "000002.SZ": [null, "Vanke"], "000100.SZ": [null, "TCL"], "000338.SZ": [null, "Weich"], "000408.SZ": [null, "Zangge"],
    "000425.SZ": [null, "XCMG"], "000568.SZ": [null, "Luzhou"], "000651.SZ": [null, "Gree"], "000776.SZ": [null, "GF"],
    "000792.SZ": [null, "QSL"], "000858.SZ": [null, "WLY"], "000938.SZ": [null, "UNIS"], "000975.SZ": [null, "SJ Au"],
    "000977.SZ": [null, "Inspur"], "000988.SZ": [null, "HGT"], "002027.SZ": [null, "Focus"], "002028.SZ": [null, "Sieyu"],
    "002050.SZ": [null, "Sanhua"], "002142.SZ": [null, "NB Bk"], "002179.SZ": [null, "Jonho"], "002202.SZ": [null, "GoldW"],
    "002230.SZ": [null, "iFly"], "002241.SZ": [null, "GoerT"], "002371.SZ": [null, "Naura"], "002384.SZ": [null, "DSBJ"],
    "002415.SZ": [null, "HIK"], "002422.SZ": [null, "Kelun"], "002460.SZ": [null, "Ganfg"], "002463.SZ": [null, "WUS"],
    "002466.SZ": [null, "Tianqi"], "002475.SZ": [null, "Luxsh"], "002532.SZ": [null, "TS Al"], "002558.SZ": [null, "Giant"],
    "002600.SZ": [null, "Lingyi"], "002714.SZ": [null, "Muyuan"], "002916.SZ": [null, "SCC"], "002920.SZ": [null, "Desay"],
    "002938.SZ": [null, "Avary"], "300014.SZ": [null, "EVE"], "300015.SZ": [null, "Aier"], "300033.SZ": [null, "THS"],
    "300059.SZ": [null, "EMoney"], "300124.SZ": [null, "Inova"], "300274.SZ": [null, "SGrow"], "300394.SZ": [null, "TFC"],
    "300408.SZ": [null, "3Circ"], "300418.SZ": [null, "Kunlun"], "300442.SZ": [null, "Range"], "300476.SZ": [null, "VGT"],
    "300760.SZ": [null, "Mndry"], "301308.SZ": [null, "LSYS"], "600000.SS": [null, "SPDB"], "600010.SS": [null, "BaoTS"],
    "600011.SS": [null, "HNPI"], "600015.SS": [null, "HXB"], "600016.SS": [null, "CMBC"], "600019.SS": [null, "BaoSt"],
    "600028.SS": [null, "Sinpc"], "600030.SS": [null, "CITIC"], "600031.SS": [null, "Sany"], "600089.SS": [null, "TBEA"],
    "600104.SS": [null, "SAIC"], "600150.SS": [null, "CSSC"], "600176.SS": [null, "Jushi"], "600183.SS": [null, "SYI"],
    "600188.SS": [null, "Yankg"], "600276.SS": [null, "Hengr"], "600309.SS": [null, "Wanhua"], "600362.SS": [null, "JX Cu"],
    "600406.SS": [null, "NARI"], "600489.SS": [null, "ZJ Au"], "600522.SS": [null, "ZTT"], "600547.SS": [null, "SD Au"],
    "600585.SS": [null, "Conch"], "600660.SS": [null, "Fuyao"], "600674.SS": [null, "Chuan"], "600690.SS": [null, "Haier"],
    "600741.SS": [null, "Huayu"], "600795.SS": [null, "GDPwr"], "600809.SS": [null, "Fenjiu"], "600900.SS": [null, "CYPC"],
    "600905.SS": [null, "CTGR"], "600919.SS": [null, "JS Bk"], "600926.SS": [null, "HZ Bk"], "600938.SS": [null, "CNOOC"],
    "600941.SS": [null, "CMob"], "600958.SS": [null, "OrSec"], "601006.SS": [null, "Daqin"], "601009.SS": [null, "NJ Bk"],
    "601012.SS": [null, "LONGi"], "601088.SS": [null, "Shenh"], "601169.SS": [null, "BJ Bk"], "601225.SS": [null, "SXCoal"],
    "601229.SS": [null, "SH Bk"], "601288.SS": [null, "ABC"], "601328.SS": [null, "BCom"], "601336.SS": [null, "NCI"],
    "601601.SS": [null, "CPIC"], "601628.SS": [null, "CLife"], "601658.SS": [null, "PSBC"], "601669.SS": [null, "PwrCN"],
    "601688.SS": [null, "HTSC"], "601689.SS": [null, "Tuopu"], "601728.SS": [null, "CTel"], "601766.SS": [null, "CRRC"],
    "601816.SS": [null, "BJ-SH"], "601838.SS": [null, "CD Bk"], "601857.SS": [null, "PetCh"], "601888.SS": [null, "CTG DF"],
    "603019.SS": [null, "Sugon"], "603259.SS": [null, "WuXi"], "603296.SS": [null, "Huaqin"], "603501.SS": [null, "OmniV"],
    "603799.SS": [null, "Huayou"], "603893.SS": [null, "RockC"], "603986.SS": [null, "Giga"], "603993.SS": [null, "CMOC"],
    "688008.SS": [null, "Montg"], "688012.SS": [null, "AMEC"], "688041.SS": [null, "Hygon"], "688072.SS": [null, "Pio"],
    "688111.SS": [null, "KSoft"], "688521.SS": [null, "VSil"], "688981.SS": [null, "SMIC"], "1605.T": [null, "Inpex"],
    "1801.T": [null, "Taisei"], "1802.T": [null, "Obaya"], "1812.T": [null, "Kajima"], "1925.T": [null, "DHI"],
    "1928.T": [null, "Sekis"], "2502.T": [null, "Asahi"], "2503.T": [null, "Kirin"], "2801.T": [null, "Kikko"],
    "2802.T": [null, "Ajino"], "3382.T": [null, "7&i"], "3402.T": [null, "Toray"], "3407.T": [null, "AKasei"],
    "3659.T": [null, "Nexon"], "4004.T": [null, "Resnc"], "4062.T": [null, "Ibiden"], "4063.T": [null, "S-Etsu"],
    "4151.T": [null, "Kyowa"], "4503.T": [null, "Astel"], "4507.T": [null, "Shion"], "4543.T": [null, "Terumo"],
    "4568.T": [null, "D-Ichi"], "4901.T": [null, "Fuji F"], "4911.T": [null, "Shise"], "5016.T": [null, "JX"],
    "5019.T": [null, "Idemi"], "5020.T": [null, "Eneos"], "5108.T": [null, "Bstone"], "5401.T": [null, "NSteel"],
    "5803.T": [null, "Fjkra"], "5831.T": [null, "Shizu"], "6098.T": [null, "RCRT"], "6146.T": [null, "Disco"],
    "6178.T": [null, "JPost"], "6301.T": [null, "Kmtsu"], "6326.T": [null, "Kubota"], "6361.T": [null, "Ebara"],
    "6367.T": [null, "Daikin"], "6503.T": [null, "MELCO"], "6525.T": [null, "Kokus"], "6532.T": [null, "BayC"],
    "6723.T": [null, "Renes"], "6857.T": [null, "ADVT"], "6861.T": [null, "Keyen"], "6902.T": [null, "Denso"],
    "6920.T": [null, "Laser"], "6954.T": [null, "Fanuc"], "6971.T": [null, "Kyocr"], "6976.T": [null, "Yuden"],
    "6988.T": [null, "Nitto"], "7269.T": [null, "Suzuki"], "7270.T": [null, "Subaru"], "7272.T": [null, "YamaM"],
    "7453.T": [null, "Muji"], "7532.T": [null, "PPIH"], "7733.T": [null, "Olymp"], "7735.T": [null, "Screen"],
    "7751.T": [null, "Canon"], "7832.T": [null, "Bandai"], "7974.T": [null, "Ninte"], "8308.T": [null, "Resona"],
    "8331.T": [null, "Chiba"], "8601.T": [null, "Daiwa"], "8604.T": [null, "Nomura"], "8630.T": [null, "Sompo"],
    "8750.T": [null, "DLife"], "9101.T": [null, "NYK"], "9531.T": [null, "TGas"], "9532.T": [null, "OGas"],
    "9602.T": [null, "Toho"], "9697.T": [null, "Capcom"], "9735.T": [null, "Secom"], "9766.T": [null, "Konami"],
    "9843.T": [null, "Nitori"], "000157.SZ": [null, "Zooml"], "000166.SZ": [null, "SWHY"], "000630.SZ": [null, "Tongl"],
    "000768.SZ": [null, "AVICX"], "002049.SZ": [null, "Unigp"], "002236.SZ": [null, "Dahua"], "002353.SZ": [null, "Jereh"],
    "002625.SZ": [null, "KChi"], "002736.SZ": [null, "Guosn"], "002837.SZ": [null, "Envic"], "300450.SZ": [null, "Lead"],
    "300661.SZ": [null, "SGM"], "600438.SS": [null, "Tngwi"], "600460.SS": [null, "Silan"], "600570.SS": [null, "Hund"],
    "600875.SS": [null, "DEC"], "601058.SS": [null, "Sailn"], "601127.SS": [null, "Seres"], "601360.SS": [null, "360"],
    "601456.SS": [null, "Glian"], "601877.SS": [null, "Chint"], "601881.SS": [null, "CGS"], "601901.SS": [null, "Foundr"],
    "605117.SS": [null, "Deye"], "688082.SS": [null, "ACM"], "1803.T": [null, "Shimz"], "2269.T": [null, "Meiji"],
    "2768.T": [null, "Sojtz"], "4324.T": [null, "Dents"], "4452.T": [null, "KAO"], "4689.T": [null, "LY"],
    "6273.T": [null, "SMC"], "6479.T": [null, "MinMi"], "6841.T": [null, "Yokog"], "6963.T": [null, "ROHM"],
    "7912.T": [null, "DNP"]
  };
  let CTX = null;
  function textW(t, wt, fs) {
    if (!CTX) { try { CTX = document.createElement("canvas").getContext("2d"); } catch (e) { CTX = null; } }
    if (!CTX) return t.length * fs * 0.6;
    CTX.font = wt + " " + fs + "px " + FONT;
    return CTX.measureText(t).width + 1;
  }
  function fmtCap(it, ccy) {
    if (finite(it[6])) { const v = it[6]; return (v >= 1000 ? (v / 1000).toFixed(2) + " trn" : v >= 10 ? v.toFixed(0) + " bn" : v.toFixed(1) + " bn") + " " + ccy; }
    return null;
  }
  function layout(map, W, H, opt) {
    const minA = (opt && opt.minArea) || 90;
    const secs = (map.sectors || []).filter(s => s.wt > 0).map(s => ({ v: s.wt, s: s }));
    const boxes = [], heads = [];
    squarify(secs, 0, 0, W, H).forEach(r => {
      const s = r.s, band = r.h > 46 && r.w > 44 ? HEAD : 0;
      heads.push({ x: r.x, y: r.y, w: r.w, h: r.h, band: band, s: s });
      const area = r.w * (r.h - band), tot = s.items.reduce((a, b) => a + (b[4] || 0), 0);
      if (!(tot > 0) || area <= 0) return;
      let keep = s.items.filter(it => (it[4] || 0) / tot * area >= minA);
      if (!keep.length) keep = s.items.slice(0, 1);
      const rest = s.items.slice(keep.length);
      const kids = keep.map(it => ({ v: it[4] || 0, it: it }));
      if (rest.length) {
        const rv = rest.reduce((a, b) => a + (b[4] || 0), 0), w0 = rest.map(it => (it[4] || 0) / (1 + (it[3] || 0) / 100));
        const rc = w0.reduce((a, b) => a + b, 0) ? rest.reduce((a, it, i) => a + w0[i] * (it[3] || 0), 0) / w0.reduce((a, b) => a + b, 0) : null;
        kids.push({ v: rv, more: rest, chg: rc });
      }
      squarify(kids, r.x, r.y + band, r.w, r.h - band).forEach(k => boxes.push(Object.assign(k, { s: s })));
    });
    return { boxes: boxes, heads: heads };
  }
  function render(host, map, opt) {
    opt = opt || {};
    const W = Math.max(120, Math.floor(host.clientWidth || opt.width || 600));
    const H = Math.max(160, Math.round(opt.height ? opt.height(W) : W * 0.62));
    const L = layout(map, W, H, opt), REG = [];
    /* Label rule: the box name (curated SHORT, else the data's) on one line, then on two lines, then a letter ticker
       (Europe, US), then the curated short form; otherwise blank. Never a numeric code, never a cut-off name. The font
       steps down from the box's natural size to MIN_FS px (text width measured); the % line only where it fits. */
    const lab = (b) => {
      const w = b.w - 4, h = b.h - 2;   /* 1px border and 1px label padding (live.css .tm-l) each side */
      if (w < 8 || h < MIN_FS * 1.15) return "";
      const fs0 = Math.max(MIN_FS, Math.min(15, Math.floor(Math.min(b.w / 4.6, b.h / 2.4))));
      const chg = b.more ? b.chg : b.it[3], pct = sg(chg, 1);
      const tk = b.more ? "" : String(b.it[0] || "").replace(/\.[A-Z]+$/, "");
      const cur = (!b.more && SHORT[b.it[0]]) || [];
      const name = b.more ? "+" + b.more.length : cur[0] || b.it[1] || tk;
      const sp = name.indexOf(" ") > 0 ? name.split(" ") : null;
      const two = sp ? [sp.slice(0, Math.ceil(sp.length / 2)).join(" "), sp.slice(Math.ceil(sp.length / 2)).join(" ")] : null;
      const tkT = tk && tk !== name && !/^\d/.test(tk) ? [[tk]] : [];
      const tries = [[name]].concat(two ? [two] : [], tkT, cur[1] && cur[1] !== name ? [[cur[1]]] : []);
      for (const lines of tries) {
        for (let fs = fs0; fs >= MIN_FS; fs--) {
          const nh = lines.length * fs * 1.12;
          if (nh + fs * 0.03 > h || lines.some(t => textW(t, 750, fs) > w)) continue;
          const showChg = nh + fs * 0.86 * 1.15 <= h && textW(pct, 600, fs * 0.86) <= w;
          return '<span class="tm-l" style="font-size:' + fs + 'px">' + lines.map(t => "<b>" + esc(t) + "</b>").join("") + (showChg ? "<i>" + esc(pct) + "</i>" : "") + "</span>";
        }
      }
      return "";
    };
    const px = v => Math.round(v * 10) / 10;
    let html = '<div class="tm-box" style="height:' + H + 'px" role="img" aria-label="' + esc(map.name + " sector map, " + map.label + ": " + map.adv + " up, " + map.dec + " down; " + (map.index_name || map.name) + " " + sg(map.index_chg)) + '">';
    L.heads.forEach(hd => {
      html += '<div class="tm-sec" style="left:' + px(hd.x) + "px;top:" + px(hd.y) + "px;width:" + px(hd.w) + "px;height:" + px(hd.h) + 'px">' +
        (hd.band ? '<span class="tm-sh" style="height:' + HEAD + 'px" title="' + esc(hd.s.name + " " + sg(hd.s.chg) + " · " + hd.s.wt + "% of the map") + '">' + esc(hd.w > 120 ? hd.s.short : hd.s.tiny) + (hd.w > 74 ? " <i>" + esc(sg(hd.s.chg, 1)) + "</i>" : "") + "</span>" : "") + "</div>";
    });
    L.boxes.forEach(b => {
      const i = REG.push(b) - 1, chg = b.more ? b.chg : b.it[3];
      html += '<div class="tm-c" data-tm="' + i + '" tabindex="-1" style="left:' + px(b.x) + "px;top:" + px(b.y) + "px;width:" + px(b.w) + "px;height:" + px(b.h) + "px;background:" + heat(chg, opt.cap) + '">' + lab(b) + "</div>";
    });
    html += '</div><div class="tm-tip" hidden></div>';
    host.innerHTML = html;
    host._tm = { REG: REG, map: map, W: W };
    wire(host);
  }
  function tipHTML(b, map) {
    if (b.more) {
      const top = b.more.slice(0, 8).map(it => "<li><span>" + esc(it[1]) + "</span><i class=\"" + (it[3] > 0 ? "up" : it[3] < 0 ? "dn" : "") + "\">" + esc(sg(it[3], 1)) + "</i></li>").join("");
      return "<b>" + esc(b.s.name) + ": " + b.more.length + " smaller names</b><span class=\"tm-tm\">" + esc(sg(b.chg)) + " cap-weighted</span><ul>" + top + "</ul>" + (b.more.length > 8 ? "<small>and " + (b.more.length - 8) + " more</small>" : "");
    }
    const it = b.it, cap = fmtCap(it, map.ccy);
    const pxs = finite(it[5]) ? it[5].toLocaleString("en-GB", { maximumFractionDigits: it[5] < 100 ? 2 : 1 }) + " " + esc(map.key === "eu80" ? "" : map.ccy) : "";
    return "<b>" + esc(it[2] || it[1]) + '</b><span class="tm-tk">' + esc(it[0]) + " · " + esc(b.s.name) + "</span>" +
      '<span class="tm-mv ' + (it[3] > 0 ? "up" : it[3] < 0 ? "dn" : "") + '">' + esc(sg(it[3])) + "</span>" +
      (pxs ? "<span>Price " + pxs.trim() + "</span>" : "") +
      (cap ? "<span>Mkt cap " + esc(cap) + "</span>" : "") +
      "<span>" + (map.key === "csi300" ? "Index weight " : "Weight in map ") + esc(finite(it[4]) ? it[4].toFixed(2) + "%" : "n/a") + "</span>" +
      "<small>" + esc(map.label + " · " + map.basis) + "</small>";
  }
  function wire(host) {
    if (host._tmWired) return;
    host._tmWired = true;
    const tip = () => host.querySelector(".tm-tip");
    const show = (el, ev) => {
      const st = host._tm, t = tip();
      if (!st || !t || !el) return;
      const b = st.REG[+el.dataset.tm];
      if (!b) return;
      t.innerHTML = tipHTML(b, st.map);
      t.hidden = false;
      host.querySelectorAll(".tm-c.on").forEach(x => x.classList.remove("on"));
      el.classList.add("on");
      const hb = host.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
      const cx = ev && finite(ev.clientX) ? ev.clientX - hb.left : b.x + b.w / 2, cy = ev && finite(ev.clientY) ? ev.clientY - hb.top : b.y + b.h / 2;
      let x = cx + 12, y = cy + 12;
      if (x + tw > hb.width - 2) x = Math.max(2, cx - tw - 12);
      if (y + th > hb.height + 40) y = Math.max(2, cy - th - 12);
      t.style.left = Math.round(x) + "px"; t.style.top = Math.round(y) + "px";
    };
    const hide = () => { const t = tip(); if (t) t.hidden = true; host.querySelectorAll(".tm-c.on").forEach(x => x.classList.remove("on")); };
    const touch = () => window.matchMedia && window.matchMedia("(hover: none)").matches;
    host.addEventListener("mousemove", e => { if (touch()) return; const c = e.target.closest && e.target.closest(".tm-c"); if (c) show(c, e); else hide(); });
    host.addEventListener("mouseleave", () => { if (!touch()) hide(); });
    host.addEventListener("click", e => {
      const c = e.target.closest && e.target.closest(".tm-c");
      if (!c) { hide(); return; }
      e.stopPropagation();
      if (c.classList.contains("on") && touch()) { hide(); return; }
      show(c, e);
    });
    document.addEventListener("click", e => { if (!host.contains(e.target)) hide(); });
    if (window.ResizeObserver) {
      let last = host.clientWidth, tmr = 0;
      new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - last) < 2 || !host._tm) return; last = w; clearTimeout(tmr); tmr = setTimeout(() => render(host, host._tm.map, host._tmOpt), 120); }).observe(host);
    }
  }
  function mount(host, map, opt) { host._tmOpt = opt || {}; render(host, map, host._tmOpt); }
  window.EMMITreemap = { squarify: squarify, heat: heat, layout: layout, mount: mount, render: render, tipHTML: tipHTML };
})();
