/* Table page: data/market.json + data/news.json (built by GitHub Actions). Real data only: null -> "n/a". */
(()=>{"use strict";
const LS="markets-monitor:table:v2";
const TZ="Europe/Zurich";
const PCT=["1D","1W","1M","6M","YTD","1Y","5Y","10Y"];
const FLOOR={"1D":1,"1W":2,"1M":4,"6M":8,"YTD":10,"1Y":12,"5Y":25,"10Y":40};
const FLOOR_BP={"1D":6,"1W":15,"1M":25,"6M":50,"YTD":60,"1Y":75,"5Y":150,"10Y":200};
const NARROW=matchMedia("(max-width:900px)");
/* Navigation: Equities (chips) · Macro (indices, commodities, rates & FX on one page) · Power · Charts (app.js Monitor page).
   URL hash #equities/<chip>, #macro[/<section>], #power[/<section>], #charts; older hashes (#nordic, #rates, #monitor…) redirect. */
const EQ=[["nordic","Renewables","renewables"],["energy","Oil & Gas","oil-gas"],["metals","Metals & Mining","metals"],["lundin","Lundin Group","lundin"]];
const MAC=[["indices","Indices"],["commodities","Commodities"],["rates","Rates & FX"]];
const VIEWS=["home","equities","macro","curves","oilgas","mining","power","gas","grid","charts","companies","briefs"];
const LEGACY={nordic:"equities/renewables",energy:"equities/oil-gas",metals:"equities/metals",lundin:"equities/lundin",indices:"macro/indices",commodities:"macro/commodities",rates:"macro/rates",monitor:"charts",table:"equities",markets:"equities",power:"power",pwSecGrid:"grid","power/pwSecGrid":"grid",griddc:"grid",home:"home"};
const st=Object.assign({view:"equities",eq:"nordic",explain:null,sort:null,dir:-1,q:""},(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}");}catch(e){return{};}})());
delete st.mode;/* Price / Volume+MA toggle removed: all column groups are always shown */
if(st.tab){/* v2 state: single tab id */if(st.tab==="power")st.view="power";else if(EQ.some(e=>e[0]===st.tab)){st.view="equities";st.eq=st.tab;}else if(MAC.some(m=>m[0]===st.tab))st.view="macro";delete st.tab;}
if(!["home","equities","macro","curves","oilgas","mining","power","gas","grid","companies","briefs"].includes(st.view))st.view="home";if(!EQ.some(e=>e[0]===st.eq))st.eq="nordic";
if(!st.list)st.list="renewables";if(!st.nordic)st.nordic="overview";if(!st.brief)st.brief="pulse";if(!st.energy)st.energy="nordic";
const save=()=>{try{localStorage.setItem(LS,JSON.stringify({view:st.view,eq:st.eq,sort:st.sort,dir:st.dir,wide:st.wide,list:st.list,nordic:st.nordic,brief:st.brief,energy:st.energy}));}catch(e){}};
const isPower=()=>st.view==="power",isMacro=()=>st.view==="macro",isAux=()=>["home","curves","oilgas","mining","power","gas","grid","companies","briefs"].includes(st.view);
const PHONE=matchMedia("(max-width:600px)");
let DATA=null,NEWS=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NA='<span class="na">n/a</span>';
const isNum=v=>typeof v==="number"&&isFinite(v);
const gf=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const gfs=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const gft=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false});
const gfd=new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"short"});
/* quote time label: market open with a quote today -> time of last quote (CET); otherwise "close DD Mon" */
function quoteLabel(r){if(!r||r.error||!isNum(r.px))return null;const ST={open:"Market open",pre:"Pre-market",post:"After hours",closed:"Market closed"};
 const keep=r.stale?" · kept from the last full build":"";
 if(r.official&&r.bar_date){const d=gfd.format(new Date(r.bar_date+"T12:00:00Z"));const lag=Math.round((Date.now()-Date.parse(r.bar_date+"T12:00:00Z"))/864e5);return{txt:"close "+d,tip:(r.fallback?"CNBC daily close (fallback)":"Official close · "+r.official.name)+" · "+d+(lag>2?" · lags "+lag+" days":"")+(r.live&&isNum(r.live.px)?" · CNBC live quote "+r.live.px.toFixed(3)+"% (intraday move only)":"")};}
 if(r.partial===true&&r.market_time){const t=new Date(r.market_time);return{txt:gft.format(t),tip:"Market open · last quote "+gfs.format(t)+" CET (Yahoo, ~15 min delayed)"+keep};}
 const d=r.bar_date?gfd.format(new Date(r.bar_date+"T12:00:00Z")):"";return d?{txt:"close "+d,tip:[ST[r.state],"last close "+d].filter(Boolean).join(" · ")+keep}:null;}
function ago(iso){const m=(Date.now()-new Date(iso).getTime())/6e4;if(!isFinite(m))return"";if(m<1)return"just now";if(m<60)return Math.round(m)+"m ago";if(m<48*60)return Math.round(m/60)+"h ago";return Math.round(m/1440)+"d ago";}
function dp(v,kind){const a=Math.abs(v);if(kind==="fx"&&a<20)return 4;if(a>=10000)return 0;if(a>=1000)return 1;if(a>=1)return 2;if(a>=0.1)return 3;return 4;}
function fpx(v,kind){if(!isNum(v))return NA;const d=dp(v,kind);return v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});}
function fchg(v,ref,kind){if(!isNum(v))return NA;const d=dp(ref||v,kind);return(v>0?"+":v<0?"−":"")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});}
function fpct(v){if(!isNum(v))return NA;const a=Math.abs(v);const d=a>=100?0:1;return(v>0?"+":v<0?"−":"")+a.toFixed(d)+"%";}
function fbp(v){if(!isNum(v))return NA;return(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(Math.abs(v)>=10?0:1)+"bp";}
function fvol(v){if(!isNum(v))return NA;const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+"B";if(a>=1e6)return(v/1e6).toFixed(a>=1e8?0:a>=1e7?1:2)+"M";if(a>=1e3)return(v/1e3).toFixed(a>=1e5?0:1)+"K";return String(v);}
/* neutral display labels for older data files (labels now come from scripts/universe.py) */
const SEC_FIX={"Potential acquirers":{label:"Strategic peers",note:"Speculative, illustrative screen of listed strategic and financial investors active in European renewables. Not based on any reported approach; not investment advice. Hover a name for the rationale."}};
const secLab=sec=>{const f=SEC_FIX[sec.label];return f?{label:f.label,note:f.note}:{label:sec.label,note:sec.note};};
const isCo=r=>r.kind==="equity"&&!!window.MMCompany;
const grp=id=>DATA&&DATA.groups.find(x=>x.id===id)||null;
function feur(v){if(!isNum(v))return NA;const a=Math.abs(v);if(a>=1e12)return(v/1e12).toFixed(2)+"T";if(a>=1e9)return(v/1e9).toFixed(a>=1e11?1:2)+"B";if(a>=1e6)return(v/1e6).toFixed(a>=1e8?0:a>=1e7?1:2)+"M";if(a>=1e3)return(v/1e3).toFixed(0)+"K";return String(Math.round(v));}
function fundTip(r,kind){const raw=kind==="ev"?r.ev:r.mcap;const eur=kind==="ev"?r.ev_eur:r.mcap_eur;const ccy0=r.mcap_ccy||r.ccy||"";const ccy=({GBp:"GBP",GBX:"GBP",ILA:"ILS",ZAc:"ZAR"})[ccy0]||ccy0;/* Yahoo cap/EV are in the major unit */
 const bits=[];if(isNum(eur))bits.push("€"+feur(eur).replace(/<[^>]+>/g,""));if(isNum(raw)&&ccy)bits.push(feur(raw).replace(/<[^>]+>/g,"")+" "+ccy);if(DATA&&DATA.fx_asof)bits.push("FX as of "+DATA.fx_asof);return bits.join(" · ");}

/* ---------- columns ---------- */
const val={
 name:r=>r.name.toLowerCase(),px:r=>r.px,chg:r=>r.px&&r.chg!=null?r.chg/(r.px-r.chg)*100:null,spark:r=>r.pct&&r.pct["1Y"],
 mcap:r=>r.mcap_eur,ev:r=>r.ev_eur,vlast:r=>r.vol&&r.vol.last,
};
PCT.forEach(k=>val["p"+k]=r=>r.kind==="yield"&&r.bp?r.bp[k]:r.pct&&r.pct[k]);
/* volume ratios are only meaningful for single listed instruments with a real average: not for indices (Yahoo index
   volume changes basis day to day), continuous futures (volume jumps at each contract roll) or tiny averages */
const VOL_MIN_AVG=1000,VOL_MAX_RATIO=30;
function volWhy(r,n){if(r.kind==="index")return"Index volume from Yahoo is not consistent from day to day, so no ratio is shown";
 if(r.kind==="future"||r.roll)return"Futures: a contract month's volume rises and falls around expiry, so no ratio is shown";
 if(r.kind==="fx"||r.kind==="yield")return"No traded volume";const a=r.vol&&r.vol["a"+n];
 if(isNum(a)&&a<VOL_MIN_AVG)return"Average volume is too small ("+a.toLocaleString("en-US")+") for a meaningful ratio";return"";}
const volRatio=(r,n)=>volWhy(r,n)?null:(r.vol&&isNum(r.vol["r"+n])?r.vol["r"+n]:null);
/* highlight only validated spikes: ratio > 1.5x and not implausibly large (> 30x is flagged for checking instead) */
const volHot=(r,n)=>{const x=volRatio(r,n);return isNum(x)&&x>1.5&&x<=VOL_MAX_RATIO;};
[5,20,50].forEach(n=>val["v"+n]=r=>volRatio(r,n));
[10,20,50,200].forEach(n=>val["m"+n]=r=>r.ma&&r.ma[n]?(r.kind==="yield"?r.ma[n].bp:r.ma[n].pct):null);
const COLS=[
 {k:"name",g:"",l:"Instrument",cls:"c-name"},
 {k:"px",g:"",l:"Last",cls:"num c-px",t:"Latest Yahoo quote, local currency (~15 min delayed), refreshed every 15 min in market hours. Grey: time of the last quote (CET) while the market is open, otherwise the date of the last close."},
 {k:"mcap",g:"",l:"Mkt cap €",cls:"num c-mcap",t:"Market capitalization converted to EUR (Yahoo; FX from Yahoo EUR crosses or ECB mid). Hover for original currency."},
 {k:"ev",g:"",l:"EV €",cls:"num c-ev",t:"Enterprise value converted to EUR when Yahoo provides it. Hover for original currency."},
 {k:"spark",g:"price",l:"1Y line",t:"1-year line of daily closes (Yahoo) in the quote currency; yields in %, indices in points. Hover a line for the 1Y change, high and low. Sorts by 1Y %.",cls:"c-spark"},
 {k:"chg",g:"price",l:"1D chg",t:"Change vs previous close. Yields in bp."},
 ...PCT.map(k=>({k:"p"+k,g:"price",l:k==="1D"?"1D %":k,hz:k,
   t:(k==="YTD"?"Price change since the prior year-end close":k==="1D"?"Price change vs the previous session's close":"Price change over "+k+": last close vs the close on or before the same date "+({"1W":"a week","1M":"a month","6M":"6 months","1Y":"a year","5Y":"5 years","10Y":"10 years"}[k]||"a day")+" earlier (price only, no dividends)")+(/^(2Y|3Y|5Y|10Y)$/.test(k)?". Futures: continuous front month, includes contract rolls (†)":"")+". Yields shown as bp change."})),
 {k:"vlast",g:"vol",l:"Last vol",t:"Volume of the latest session (today so far while the market is open)"},
 ...[5,20,50].map(n=>({k:"v"+n,g:"vol",l:n+"d avg",t:"Average volume of the "+n+" sessions before the latest; ratio = last ÷ average (highlighted > 1.5x). No ratio for indices, continuous futures or tiny averages."})),
 ...[10,20,50,200].map(n=>({k:"m"+n,g:"ma",l:n+"-day",t:"Distance from the "+n+"-day average: how far the price is above (●) or below (●) its "+n+"-day simple moving average. Average value in the tooltip."})),
];
const GROUPS=[["","",1],["price","Price",0],["vol","Volume",0],["ma","Distance from average price",0]];
/* company table column presets; saved under their own key so the main table state is untouched */
const LSP="markets-monitor:table:preset:v1";
const PRESETS=[["overview","Overview","Price, size, the main returns and the 200-day trend"],["momentum","Momentum","Returns from 1 day to 1 year and the distance from the 20/50/200-day averages"],["valuation","Valuation","Market cap, enterprise value and long-run price change (multiples are on each company profile)"],["liquidity","Liquidity","Traded volume vs its 5/20/50-day averages"],["all","All","Every column"]];
const PCOLS={overview:["name","px","mcap","spark","p1D","p1M","pYTD","p1Y","v20","m200"],momentum:["name","px","p1D","p1W","p1M","p6M","pYTD","p1Y","m20","m50","m200"],valuation:["name","px","mcap","ev","spark","p1Y","p5Y","p10Y"],liquidity:["name","px","mcap","p1D","vlast","v5","v20","v50"]};
let PRE=(()=>{try{const v=localStorage.getItem(LSP);return PCOLS[v]||v==="all"?v:"overview";}catch(e){return"overview";}})();

/* ---------- cells ---------- */
/* what a 1Y line is plotted in: yields in %, indices in points, everything else in its quote currency */
const unitOf=r=>r.kind==="yield"?"% yield":r.kind==="index"?"index points":r.ccy==="GBp"?"GBp (pence)":(r.ccy||"");
const untag=x=>String(x).replace(/<[^>]+>/g,"");
function sparkTip(r){const p=r.spark,y=r.kind==="yield";const ch=y?fbp(r.bp&&r.bp["1Y"]):fpct(r.pct&&r.pct["1Y"]);
 let t="1-year "+(y?"yield":"price")+" line · "+unitOf(r)+" · daily closes ("+(r.official&&!r.fallback?r.official.name:r.src==="cnbc"?"CNBC":"Yahoo")+", ~every 2nd day)";
 if(p&&p.length>1)t+="\n1Y "+untag(ch)+(r.spark_from?" since "+r.spark_from:"")+" · high "+untag(fpx(Math.max(...p),r.kind))+" · low "+untag(fpx(Math.min(...p),r.kind));return t;}
function spark(r){const p=r.spark;if(!p||p.length<2)return NA;const w=84,h=24;let mn=Math.min(...p),mx=Math.max(...p);if(mx===mn)mx=mn+1;
 const pts=p.map((v,i)=>[(i/(p.length-1))*w,h-2-((v-mn)/(mx-mn))*(h-4)]);const d=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join("");
 const up=p[p.length-1]>=p[0];const c=up?"var(--good)":"var(--bad)";const last=pts[pts.length-1];
 return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true"><path d="'+d+'L'+w+' '+h+'L0 '+h+'Z" fill="'+c+'" opacity=".12"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="1.4" stroke-linejoin="round"/><circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="2" fill="'+c+'"/></svg>';}
function heat(v,scale){if(!isNum(v)||!scale)return"";const h=Math.min(1,Math.abs(v)/scale);return' style="--h:'+(Math.round(h*100)/100)+'" data-s="'+(v>0?"p":v<0?"n":"z")+'"';}
function scales(rs){const out={},outbp={};for(const k of PCT){const a=rs.filter(r=>r.kind!=="yield").map(r=>r.pct&&r.pct[k]).filter(isNum).map(Math.abs).sort((x,y)=>x-y);
 const p=a.length?a[Math.floor(a.length*.8)]||a[a.length-1]:0;out[k]=Math.max(FLOOR[k],p);
 const b=rs.filter(r=>r.kind==="yield"&&r.bp).map(r=>r.bp[k]).filter(isNum).map(Math.abs).sort((x,y)=>x-y);outbp[k]=Math.max(FLOOR_BP[k],b.length?b[Math.floor(b.length*.8)]||b[b.length-1]:0);}
 return{pct:out,bp:outbp};}
function cell(c,r,S){const k=c.k,hid=c.hide?" c-opt":"";
 if(k==="name"){const O=r.official,L=r.live;const sub=O?(r.fallback?"Fallback: CNBC closes":O.name+" closes")+(L&&isNum(L.px)?" · CNBC live "+L.px.toFixed(2)+"% ("+(L.bp>0?"+":L.bp<0?"−":"±")+Math.abs(L.bp).toFixed(1)+" bp)":""):[String(r.sym).replace(/^CNBC:/,"CNBC "),r.ccy].filter(Boolean).join(" · ");
  const flags=(r.fallback?'<span class="info fb" title="'+esc("Fallback: "+O.name+" — "+r.fallback+". Closes, changes and spreads use CNBC daily closes."+(r.official_ref?" Official reference: "+r.official_ref.name+" "+r.official_ref.month+" average "+r.official_ref.v.toFixed(2)+"%.":""))+'">fallback</span>':"")+(r.note?'<span class="info" title="'+esc(r.note)+'">i</span>':"")+(r.error?'<span class="info bad" title="'+esc(r.error)+'">!</span>':"");
  const co=isCo(r);/* name colour = sign of today's move (1D %, yields in bp); |move| < 0.005 (float noise) counts as flat */
  const p1=r.pct&&r.pct["1D"],dv=r.error?null:r.kind==="yield"?(r.bp&&r.bp["1D"]):isNum(p1)?p1:(isNum(r.chg)&&r.px?r.chg/(r.px-r.chg)*100:null);const ds=isNum(dv)&&Math.abs(dv)>=0.005?(dv>0?" nm-up":" nm-dn"):"";const nm=co?'<button type="button" class="nm co-link" aria-label="'+esc(r.name+": company profile")+'">'+esc(r.name)+'</button>':'<span class="nm">'+esc(r.name)+'</span>';
  return'<th scope="row" class="c-name'+(co?" has-co":"")+ds+'"'+(r.note?' title="'+esc(r.name+" — "+r.note+(co?" · click for company profile":""))+'"':' title="'+esc(r.name+(co?" · click for company profile":r.bar_date?" · last bar "+r.bar_date:""))+'"')+'>'+nm+flags+'<span class="sym">'+esc(sub)+'</span></th>';}
 if(r.error&&k!=="name")return'<td class="na-cell'+hid+'">'+NA+'</td>';
 if(k==="px"){const q=quoteLabel(r);return'<td class="num px c-px"'+(q?' title="'+esc(q.tip)+'"':"")+'>'+fpx(r.px,r.kind)+(q?'<span class="qt">'+esc(q.txt)+'</span>':"")+'</td>';}
 if(k==="mcap"){const v=r.mcap_eur;return'<td class="num c-mcap"'+(isNum(v)?' title="'+esc(fundTip(r,"mcap"))+'"':"")+'>'+feur(v)+'</td>';}
 if(k==="ev"){const v=r.ev_eur;return'<td class="num c-ev"'+(isNum(v)?' title="'+esc(fundTip(r,"ev"))+'"':"")+'>'+feur(v)+'</td>';}
 if(k==="spark")return'<td class="c-spark" title="'+esc(sparkTip(r))+'">'+spark(r)+'</td>';
 if(k==="chg"){const v=r.kind==="yield"?(r.bp&&r.bp["1D"]):r.chg;const s=isNum(v)?(v>0?"up":v<0?"dn":""):"";return'<td class="num '+s+'"'+(r.chg_suppressed?' title="The contract-month quote is missing: no change shown"':"")+'>'+(r.kind==="yield"?fbp(v):fchg(v,r.px,r.kind))+'</td>';}
 if(k[0]==="p"){const hz=c.hz;const y=r.kind==="yield";const v=y?(r.bp&&r.bp[hz]):(r.pct&&r.pct[hz]);
  const roll=isNum(v)&&(r.pct_cont?r.pct_cont.includes(hz):hz==="10Y"&&r.roll);const ct=r.contract;const tip=roll?' title="Futures: '+hz+' uses the continuous front-month series and includes contract rolls"':ct&&ct.sym&&isNum(v)?' title="'+esc(hz+" change of one contract month: "+r.name+" ("+ct.sym+")")+'"':ct&&!ct.sym&&!isNum(v)?' title="The contract-month quote is missing: the continuous price could compare two different months, so no change is shown"':y&&isNum(r.pct&&r.pct[hz])?' title="'+esc(fpct(r.pct[hz]))+' relative change in yield"':"";
  return'<td class="num heat'+hid+'"'+heat(v,y?S.bp[hz]:S.pct[hz])+tip+'>'+(y?fbp(v):fpct(v))+(roll?'<sup>†</sup>':"")+'</td>';}
 if(k==="vlast")return'<td class="num"'+(r.partial?' title="Today so far (market open); ratios compare a partial day with full-day averages"':"")+'>'+(r.vol&&isNum(r.vol.last)?fvol(r.vol.last):NA)+'</td>';
 if(k[0]==="v"){const n=k.slice(1);const a=r.vol&&r.vol["a"+n],why=volWhy(r,n),x=volRatio(r,n);if(!isNum(a))return'<td class="num'+hid+'"'+(why?' title="'+esc(why)+'"':"")+'>'+NA+'</td>';
  const odd=isNum(x)&&x>VOL_MAX_RATIO;const tip=n+'d avg volume '+a.toLocaleString("en-US")+(why?" · "+why:isNum(x)?" · last = "+x.toFixed(2)+"x"+(odd?" · unusually large: check the source before relying on it":""):"");
  return'<td class="num vol'+hid+(volHot(r,n)?" hot":"")+(why||odd?" vol-x":"")+'" title="'+esc(tip)+'"><span class="ratio">'+(why?"–":isNum(x)?x.toFixed(1)+"x"+(odd?"?":""):"n/a")+'</span><span class="avg">'+fvol(a)+'</span></td>';}
 if(k[0]==="m"){const n=k.slice(1);const m=r.ma&&r.ma[n];if(!m)return'<td class="num'+hid+'" title="Not enough history for a '+n+'-day average">'+NA+'</td>';
  const y=r.kind==="yield";const v=y?m.bp:m.pct;const above=v>=0;
  return'<td class="num ma'+hid+'" title="'+n+'-day average '+esc(fpx(m.v,r.kind))+' · price '+esc(fpx(r.px,r.kind))+'"><i class="dot '+(above?"above":"below")+'"></i>'+(y?fbp(v):fpct(v))+'</td>';}
 return"<td></td>";}

/* ---------- render ---------- */
function sortRows(rs){if(!st.sort||!val[st.sort])return rs;const f=val[st.sort];return rs.slice().sort((a,b)=>{const x=f(a),y=f(b);const nx=x==null||(typeof x==="number"&&!isFinite(x)),ny=y==null||(typeof y==="number"&&!isFinite(y));if(nx&&ny)return 0;if(nx)return 1;if(ny)return-1;if(typeof x==="string")return st.dir*x.localeCompare(y);return -st.dir*(y-x);});}
function renderTabs(){const box=$("tblTabs");box.replaceChildren();if(!DATA)return;EQ.forEach(([id,label])=>{const g=grp(id);if(!g)return;const rs=g.sections.flatMap(s=>s.rows).filter(r=>!r.error);const up=rs.filter(r=>r.pct&&r.pct["1D"]>0).length,dn=rs.filter(r=>r.pct&&r.pct["1D"]<0).length;const on=id===st.eq;const b=document.createElement("button");b.type="button";b.className="tbl-tab"+(on?" is-on":"");b.setAttribute("role","tab");b.setAttribute("aria-selected",on);
 b.innerHTML='<span>'+esc(label)+'</span><span class="breadth" title="'+up+' up / '+dn+' down today"><i style="width:'+(rs.length?Math.round(up/rs.length*100):0)+'%"></i></span>';b.onclick=()=>{if(st.eq===id)return;st.eq=id;st.q="";$("tblFilter").value="";save();renderAll();writeHash();};box.append(b);});}
function renderMovers(rs){const box=$("tblMovers");const ok=rs.filter(r=>!r.error&&r.kind!=="yield"&&r.pct&&isNum(r.pct["1D"]));const uniq=[...new Map(ok.map(r=>[r.sym,r])).values()];
 if(!uniq.length){box.replaceChildren();return;}const s=uniq.slice().sort((a,b)=>b.pct["1D"]-a.pct["1D"]);const best=s[0],worst=s[s.length-1];
 const spikes=[...new Map(rs.filter(r=>volHot(r,20)).map(r=>[r.sym,r])).values()].sort((a,b)=>b.vol.r20-a.vol.r20).slice(0,3);
 const above=uniq.filter(r=>r.ma&&r.ma["200"]).length?Math.round(uniq.filter(r=>r.ma&&r.ma["200"]&&r.ma["200"].pct>=0).length/uniq.filter(r=>r.ma&&r.ma["200"]).length*100):null;
 const pill=(lab,r,txt,cls)=>'<button type="button" class="mover '+cls+'" data-sym="'+esc(r.sym)+'"><span class="ml">'+lab+'</span><b>'+esc(r.name)+'</b> '+txt+'</button>';
 let h=pill("Top",best,fpct(best.pct["1D"]),"up")+(worst!==best?pill("Bottom",worst,fpct(worst.pct["1D"]),"dn"):"");
 spikes.forEach(r=>h+=pill("Vol spike",r,r.vol.r20.toFixed(1)+"x 20d","hot"));
 if(above!=null)h+='<span class="mover static"><span class="ml">Above 200-day avg</span><b>'+above+'%</b> of names</span>';
 box.innerHTML=h;box.querySelectorAll("button[data-sym]").forEach(b=>b.onclick=()=>{const r=rs.find(x=>x.sym===b.dataset.sym);r&&openChart(r);});}
const gsMark=(h,c)=>c.gs?h.replace('class="','class="gs '):h;
const KEYC=["name","px","p1D","pYTD"];/* phone: key columns only until "More columns" */
function visCols(){const P=!isMacro()&&PCOLS[PRE];const V=COLS.filter(c=>!(isMacro()&&(c.k==="mcap"||c.k==="ev"))&&(PHONE.matches&&!st.wide?KEYC.includes(c.k):!P||P.includes(c.k)));
 V.forEach(c=>c.gs=false);GROUPS.forEach(([id])=>{if(!id)return;const f=V.find(c=>c.g===id);if(f)f.gs=true;});return V;}
function tableHtml(g,V,S,q){
 let head='<thead><tr class="grp">';GROUPS.forEach(([id,l])=>{const n=V.filter(c=>c.g===id).length;if(!n)return;head+='<th scope="colgroup" class="g-'+(id||"name")+(id?" gs":"")+'" colspan="'+n+'"><span class="gl">'+esc(l)+'</span></th>';});
 head+='</tr><tr class="cols">';V.forEach(c=>{const on=st.sort===c.k;head+=gsMark('<th scope="col" class="'+(c.cls||"num")+(c.g?" g-"+c.g:"")+(on?" sorted":"")+'" data-k="'+c.k+'"'+(c.t?' title="'+esc(c.t)+'"':"")+' aria-sort="'+(on?(st.dir>0?"ascending":"descending"):"none")+'"><button type="button">'+esc(c.l)+'<span class="arrow">'+(on?(st.dir>0?"▲":"▼"):"")+'</span></button></th>',c);});
 head+='</tr></thead>';let body="",n=0;
 g.sections.forEach(sec=>{let rs=sec.rows;if(q)rs=rs.filter(r=>(r.name+" "+r.sym+" "+(r.ccy||"")).toLowerCase().includes(q));if(!rs.length)return;n+=rs.length;const sl=secLab(sec);
  if(sl.label)body+='<tbody class="sec"><tr class="sec-row"><th scope="rowgroup" class="c-name sec-name" title="'+esc(sl.note||"")+'">'+esc(sl.label)+'</th><td colspan="'+(V.length-1)+'" class="sec-note"><span class="sec-note-txt">'+esc(sl.note||"")+'</span></td></tr></tbody>';
  body+='<tbody class="rows">'+sortRows(rs).map(r=>'<tr data-sym="'+esc(r.sym)+'" tabindex="0"'+(r.error?' class="err"':"")+'>'+V.map(c=>gsMark(cell(c,r,S),c)).join("")+"</tr>").join("")+"</tbody>";});
 return{html:head+(body||'<tbody><tr><td class="empty" colspan="'+V.length+'">No matches</td></tr></tbody>'),n};}
function bindTable(tbl,all){
 tbl.querySelectorAll("thead th[data-k]").forEach(th=>th.querySelector("button").onclick=()=>{const k=th.dataset.k;const asc=k==="name";if(st.sort!==k){st.sort=k;st.dir=asc?1:-1;}else if((st.dir===-1&&!asc)||(st.dir===1&&asc))st.dir*=-1;else{st.sort=null;}save();renderTable();});
 const open=tr=>{const r=all.find(x=>x.sym===tr.dataset.sym);r&&openChart(r);};
 const pick=(tr,e)=>{const r=all.find(x=>x.sym===tr.dataset.sym);if(!r)return;if(e&&e.target.closest&&e.target.closest("th.has-co")&&isCo(r)){window.MMCompany.open(r.sym);return;}openChart(r);};
 tbl.querySelectorAll("tbody tr[data-sym]").forEach(tr=>{tr.onclick=e=>pick(tr,e);tr.onkeydown=e=>{if(e.key==="Enter"&&e.target===tr)open(tr);};});}
function footNote(all,rates){const futs=all.some(r=>r.roll);const fxN=DATA.fx_asof&&!isMacro()?(" Cap/EV in EUR (FX as of "+DATA.fx_asof+")."):" ";
 $("tblFoot").innerHTML='Prices: Yahoo quotes (~15 min delayed), refreshed every 15 min in market hours; grey time = last quote (CET) while open. Price returns from daily closes (not total return).'+fxN+(futs?' Futures: price, 1D to 1Y, averages and the 1Y line use one contract month (shown in the name, e.g. Brent Dec-26); on an expiry day the next month is used. † 2Y to 10Y use the continuous front month and include roll effects.':"")+(rates?" Yield rows show changes and MA distance in basis points.":"")+' n/a = not available from source or not enough history. '+(isMacro()?'Click a row for its chart.':'Click a company name for its profile (valuation, consensus, financials); click elsewhere in the row for its chart.');}
function renderTable(){if(isMacro()&&!window.EMMI_PARKED_MARKETS){mountLiveMarkets();return;}if(isMacro())return renderMacro();const tbl=$("tbl");const g=grp(st.eq)||grp(EQ[0][0])||DATA.groups[0];st.eq=g.id;const all=g.sections.flatMap(s=>s.rows);const S=scales(all);
 const V=visCols();tbl.innerHTML=tableHtml(g,V,S,st.q.trim().toLowerCase()).html;tbl.classList.remove("is-compact");bindTable(tbl,all);
 renderMovers(all);footNote(all,false);renderToday();colBtn();}
function renderMacro(){const box=$("macroWrap");const V=visCols(),q=st.q.trim().toLowerCase();let allRows=[];
 if(!box.dataset.ready){box.dataset.ready="1";box.innerHTML=MAC.map(([id,l])=>'<section class="macro-sec" id="macro-'+id+'" data-sec="mac-'+id+'" aria-labelledby="macroH-'+id+'"><div class="macro-head sec-h"><h2 class="macro-h" id="macroH-'+id+'">'+esc(l)+'</h2><span class="macro-meta" id="macroM-'+id+'"></span></div><div class="tbl-wrap macro-wrap"><table class="mtable" id="macroT-'+id+'"></table></div></section>').join("")+'<section class="macro-sec" id="macro-y10" data-sec="mac-y10" hidden></section><section class="macro-sec" id="macro-val" data-sec="mac-val" hidden></section><section class="macro-sec" id="macro-charts" data-sec="mac-charts"><div class="macro-head sec-h"><h2 class="macro-h">Interactive charts</h2><span class="macro-meta">S&amp;P 500 · Brent · EUR/CHF · US Treasuries (TLT) · TradingView</span></div><div class="mc-open"><button type="button" class="button is-on" id="openCharts">Open interactive charts</button><span class="pw-mut">Opens a full-width page with four configurable charts. They load only when opened (about 8–10 MB).</span></div></section>';window.MMUI&&MMUI.apply(box);}
 MAC.forEach(([id])=>{const g=grp(id),sec=$("macro-"+id);if(!g){sec.hidden=true;return;}const all=g.sections.flatMap(s=>s.rows);allRows=allRows.concat(all);const r=tableHtml(g,V,scales(all),q);sec.hidden=!!q&&!r.n;
  const tbl=$("macroT-"+id);tbl.innerHTML=r.html;bindTable(tbl,all);const ok=all.filter(x=>!x.error),up=ok.filter(x=>x.pct&&x.pct["1D"]>0).length;
  $("macroM-"+id).innerHTML=(window.MMUI?MMUI.dot(DATA.generated_utc,"intra","Yahoo quotes (~15 min delayed)"):"")+'<span class="breadth" title="'+up+' up / '+(ok.filter(x=>x.pct&&x.pct["1D"]<0).length)+' down today"><i style="width:'+(ok.length?Math.round(up/ok.length*100):0)+'%"></i></span>'+all.length+' instruments';});
 renderMovers(allRows);footNote(allRows,true);colBtn();if(!q){renderY10();window.MMVal&&MMVal.render();}else{$("macro-y10").hidden=true;if($("macro-val"))$("macro-val").hidden=true;}renderToday();}
/* ---------- "Today" one-line factual summary (#todayLine); Power fills its own via MMPower ---------- */
const tdz=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,timeZoneName:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const tdd=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",year:"numeric"});
function tzLab(d){const p=tdz.formatToParts(d).find(x=>x.type==="timeZoneName");const v=p?p.value:"";return v==="CET"||v==="CEST"?v:/\+0?2/.test(v)?"CEST":"CET";}
const tdK=new Intl.DateTimeFormat("en-CA",{timeZone:TZ}),tdM=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"numeric",month:"short"});
const tdT=iso=>{const d=new Date(iso);if(isNaN(d))return"n/a";return(tdK.format(d)!==tdK.format(new Date())?tdM.format(d).replace("Sept","Sep")+" ":"")+gft.format(d)+" "+tzLab(d);};
window.MMToday={html(parts,isos,head){const ts=(isos||[]).filter(Boolean).map(x=>new Date(x)).filter(d=>!isNaN(d)).sort((a,b)=>b-a);
 return'<span class="td-h">'+(head||'Today · '+esc(tdd.format(new Date())))+'</span>'+parts.filter(Boolean).map(x=>'<span class="td-p">'+x+'</span>').join("")+(ts.length?'<span class="td-gen">generated from the '+esc(tdT(ts[0].toISOString()))+' data build'+(ts.length>1&&ts[ts.length-1].getTime()!==ts[0].getTime()?' (oldest input '+esc(tdT(ts[ts.length-1].toISOString()))+')':'')+'</span>':'');},
 set(parts,isos){const el=$("todayLine");if(!el)return;el.innerHTML=this.html(parts,isos);el.hidden=false;},
 clear(){const el=$("todayLine");if(el){el.hidden=true;el.innerHTML="";}}};
const sgn=(v,d,u)=>(v>0?"+":v<0?"−":"±")+Math.abs(v).toFixed(d)+(u||"");
function crossings(rs){const up=[],dn=[];rs.forEach(r=>{const m=r.ma&&r.ma["200"];if(!m||!isNum(m.v)||!isNum(r.px)||!isNum(r.prev_close)||r.error)return;
 if(r.prev_close<m.v&&r.px>m.v)up.push(r.name);else if(r.prev_close>m.v&&r.px<m.v)dn.push(r.name);});return{up,dn};}
const names=a=>a.slice(0,3).map(esc).join(", ")+(a.length>3?" +"+(a.length-3)+" more":"");
function crossTxt(c){return c.up.length||c.dn.length?'200-day average crossed: '+(c.up.length?'<b>'+c.up.length+'</b> above ('+names(c.up)+')':'none above')+', '+(c.dn.length?'<b>'+c.dn.length+'</b> below ('+names(c.dn)+')':'none below'):'no new 200-day average crossings';}
function movers(rs,unitBp){const ok=[...new Map(rs.filter(r=>!r.error&&r.kind!=="yield"&&r.pct&&isNum(r.pct["1D"])).map(r=>[r.sym,r])).values()].sort((a,b)=>b.pct["1D"]-a.pct["1D"]);
 if(!ok.length)return null;const a=ok[0],b=ok[ok.length-1];return'biggest 1D moves: up <b>'+esc(a.name)+' '+sgn(a.pct["1D"],1,"%")+'</b>, down <b>'+esc(b.name)+' '+sgn(b.pct["1D"],1,"%")+'</b>';}
function todayParts(view){if(!DATA)return null;const parts=[];const isos=[DATA.generated_utc];
 if(view==="macro"){const rs=MAC.flatMap(([id])=>{const g=grp(id);return g?g.sections.flatMap(x=>x.rows):[];});parts.push(movers(rs));
  const y=s=>rs.find(r=>r.sym===s);const yl=[["^TNX","US"],["CNBC:DE10Y-DE","Bund"],["CNBC:GB10Y-GB","gilt"],["CNBC:FR10Y-FR","OAT"],["CNBC:CH10Y-CH","Swiss"]].map(([s,l])=>{const r=y(s);return r&&isNum(r.px)?l+' '+r.px.toFixed(2)+'%'+(r.bp&&isNum(r.bp["1D"])?' ('+sgn(r.bp["1D"],1," bp")+')':'')+(r.fallback?' [CNBC fallback]':r.official&&r.bar_date?' ['+r.official.name.replace(/^(Deutsche |US )/,"")+' '+gfd.format(new Date(r.bar_date+"T12:00:00Z"))+']':''):null;}).filter(Boolean);
  if(yl.length)parts.push('10Y yields, official closes: '+yl.join(", "));const SP=DATA.yields10&&DATA.yields10.spreads;
  if(SP){const t=[["FR-DE","OAT–Bund"],["GB-DE","gilt–Bund"]].filter(([k])=>SP[k]).map(([k,l])=>l+' <b>'+Math.round(SP[k].bp)+' bp</b>'+(isNum(SP[k].d1)?' ('+sgn(SP[k].d1,1," bp")+')':'')+(SP[k].date?' ['+gfd.format(new Date(SP[k].date+"T12:00:00Z"))+']':''));if(t.length)parts.push('spreads: '+t.join(", "));}
  parts.push(crossTxt(crossings(rs)));}
 else{const rs=EQ.flatMap(([id])=>{const g=grp(id);return g?g.sections.flatMap(x=>x.rows):[];});const u=[...new Map(rs.map(r=>[r.sym,r])).values()];
  parts.push(movers(u));const up=u.filter(r=>!r.error&&r.pct&&r.pct["1D"]>0).length,dn=u.filter(r=>!r.error&&r.pct&&r.pct["1D"]<0).length;parts.push('<b>'+up+'</b> up / <b>'+dn+'</b> down of '+u.length+' names');parts.push(crossTxt(crossings(u)));
  const D=window.MMDeals&&window.MMDeals.peek&&window.MMDeals.peek();
  if(D&&D.items){const cut=Date.now()-864e5;const n=D.items.filter(it=>Date.parse(it.t)>=cut).length;parts.push('deal flow: <b>'+n+'</b> new item'+(n===1?"":"s")+' in the last 24 h');isos.push(D.generated_utc);}
  else if(window.MMDeals&&window.MMDeals.load&&!renderToday.dl){renderToday.dl=1;window.MMDeals.load().then(()=>{if(st.view==="equities")renderToday();window.MMHome&&MMHome.render();}).catch(()=>{});}}
 return{parts,isos};}
function renderToday(){if(isAux()||!DATA)return;const x=todayParts(st.view);if(x)window.MMToday.set(x.parts,x.isos);}
/* ---------- Macro: 10-year yields comparison (DATA.yields10) ---------- */
const Y10=[["US","US 10Y Treasury","var(--accent)"],["DE","German Bund","var(--good)"],["GB","UK gilt","var(--pw-de, #e0a030)"],["FR","French OAT","var(--bad)"],["CH","Swiss Confederation","var(--muted)"]];
function renderY10(){renderY10_();window.MMUI&&$("macro-y10")&&MMUI.apply($("macro-y10"));}
function renderY10_(){const box=$("macro-y10");const Y=DATA&&DATA.yields10,PC=window.PWChart;if(!box)return;if(!Y||!Y.dates||!PC){box.hidden=true;return;}box.hidden=false;
 const D=Y.dates,S=Y.series,ser=Y10.filter(([k])=>S[k]).map(([k,l,c])=>({name:l,color:c,vals:S[k],w:k==="DE"?2.4:1.8}));
 const sp=[["FR","OAT–Bund","var(--bad)"],["GB","gilt–Bund","var(--pw-de, #e0a030)"]].filter(([k])=>S[k]&&S.DE).map(([k,l,c])=>({name:l,color:c,vals:D.map((_,i)=>isNum(S[k][i])&&isNum(S.DE[i])?Math.round((S[k][i]-S.DE[i])*1000)/10:null)}));
 const SP=Y.spreads||{};const src=Object.entries(Y.src||{}).reduce((a,[k,v])=>{(a[v]=a[v]||[]).push(k);return a;},{});
 const fd=d=>{const[y,m,dd]=d.split("-");return(+dd)+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]+" "+y.slice(2);};
 const card=([k,l])=>{const x=SP[k+"-DE"];if(!x)return"";const c=v=>isNum(v)?'<span class="'+(v>0?"up":v<0?"dn":"")+'">'+sgn(v,1)+'</span>':"n/a";
  return'<div class="y10-kpi"><span class="y10-l">'+l+' spread</span><b>'+x.bp.toFixed(0)+'<small> bp</small></b><span class="y10-c">1D '+c(x.d1)+' · 1M '+c(x.m1)+' · 1Y '+c(x.y1)+' bp</span><span class="y10-d">close '+esc(fd(x.date))+'</span></div>';};
 const AS=Y.asof||{},lastD=D[D.length-1];const srcTxt=Object.entries(src).map(([v,ks])=>v+" ("+ks.map(k=>k+(AS[k]&&AS[k]<lastD?" to "+fd(AS[k]):"")).join(", ")+")").join(", ");
 const asofs=Object.values(Y.asof||{}).sort();box.innerHTML='<div class="macro-head sec-h"><h2 class="macro-h">Government bonds: 10-year yields</h2><span class="macro-meta">'+(window.MMUI?MMUI.dot(DATA.generated_utc,"intra","10Y yields",null,"official closes as of "+(asofs[0]===asofs[asofs.length-1]?asofs[0]:asofs[0]+" to "+asofs[asofs.length-1])+"; official series are fetched at 05:30 and 21:00 UTC on weekdays"):"")+'US · Germany · UK · France · Switzerland</span></div>'+
  '<div class="y10-grid"><section class="pw-card">'+PC.cardHead("10-year government bond yields: US, Germany, UK, France, Switzerland","%",fd(D[0])+" – "+fd(D[D.length-1])+" · daily closes, every 2nd trading day · "+esc(srcTxt),PC.keysHtml(ser))+'<div class="pw-chart" id="y10Chart"></div></section>'+
  '<section class="pw-card">'+PC.cardHead("Spreads over the German Bund, 10-year","bp","same period · yield difference × 100 on days both official closes exist",PC.keysHtml(sp))+'<div class="y10-kpis">'+card(["FR","OAT–Bund"])+card(["GB","gilt–Bund"])+'</div><div class="pw-chart" id="y10Spread"></div></section></div>';
 const W=$("y10Chart").clientWidth||600;
 PC.lineChart($("y10Chart"),{n:D.length,series:ser,h:W<520?220:250,yunit:"%",xkey:i=>D[i],xlab:i=>i===D.length-1?null:fd(D[i]),xw:62,label:"10-year government bond yields, %",
  tip:i=>'<b>'+esc(fd(D[i]))+'</b>'+ser.map(x=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+': <b>'+(isNum(x.vals[i])?x.vals[i].toFixed(2)+'%':"n/a")+'</b>').join("")});
 PC.lineChart($("y10Spread"),{n:D.length,series:sp,h:W<520?160:150,yunit:"bp",xkey:i=>D[i],xlab:i=>i===D.length-1?null:fd(D[i]),xw:62,label:"10-year spreads over the Bund, bp",
  tip:i=>'<b>'+esc(fd(D[i]))+'</b>'+sp.map(x=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+': <b>'+(isNum(x.vals[i])?x.vals[i].toFixed(0)+' bp':"n/a")+'</b>').join("")});}
function presetBar(){let w=$("colPreset");if(!w){w=document.createElement("div");w.id="colPreset";w.className="col-preset";w.setAttribute("role","group");w.setAttribute("aria-label","Column set");$("tblFilter").before(w);
  w.onclick=e=>{const b=e.target.closest("button[data-pre]");if(!b)return;PRE=b.dataset.pre;try{localStorage.setItem(LSP,PRE);}catch(x){}if(PHONE.matches&&!st.wide){st.wide=true;save();}renderTable();};}
 w.hidden=isMacro();w.innerHTML='<span class="cp-l">Columns</span>'+PRESETS.map(([id,l,t])=>'<button type="button" class="chip'+(id===PRE?" is-on":"")+'" data-pre="'+id+'" aria-pressed="'+(id===PRE)+'" title="'+esc(t)+'">'+esc(l)+'</button>').join("");}
function colBtn(){presetBar();let b=$("colToggle");if(!b){b=document.createElement("button");b.id="colToggle";b.type="button";b.className="button col-toggle";$("tblFilter").before(b);b.onclick=()=>{st.wide=!st.wide;save();renderTable();};}
 b.textContent=st.wide?"Key columns":"More columns";b.setAttribute("aria-pressed",String(!!st.wide));}
function renderStamp(){const el=$("tblStamp");if(!DATA){el.textContent="";return;}const d=new Date(DATA.generated_utc);el.title=DATA.fundamentals_utc?"Market cap / EV fundamentals as of "+gf.format(new Date(DATA.fundamentals_utc))+" CET (scaled with price since)":"";const U=window.MMUI,obs=U&&U.priceObs(DATA);el.innerHTML=(U?U.dot(DATA.generated_utc,"intra","Prices (Yahoo, ~15 min delayed)"):"")+(U?'<span title="Latest quote time in this data (when the price was observed on the exchange)">Prices as of <b>'+esc(obs?U.at(obs):"n/a")+'</b></span> · <span title="When the site last fetched prices from Yahoo">fetched '+esc(U.at(DATA.generated_utc))+' ('+esc(U.age(DATA.generated_utc))+')</span>':'Updated '+esc(ago(DATA.generated_utc)))+(DATA.errors&&DATA.errors.length?' · <span title="'+esc(DATA.errors.map(e=>e.sym+": "+e.error).join("\n"))+'">'+DATA.errors.length+' missing</span>':"");$("footStamp").textContent="Table data updated "+gf.format(d)+" CET.";$("exAsOf").textContent=gf.format(d)+" CET";const fxEl=$("exFxAsOf");if(fxEl)fxEl.textContent=DATA.fx_asof||"n/a";}
let NF=null;/* news filter: null = this tab's default */
const NCAT=[["tab","This tab"],["co","Companies"],["mk","Markets"],["pw","Nordic power"],["all","All"]];
function nDefault(){return st.view==="grid"?"all":"tab";}
function newsItems(){const T=(NEWS&&NEWS.tabs)||{},f=NF||nDefault();const merge=ids=>{const seen=new Set();return ids.flatMap(id=>T[id]||[]).filter(it=>{const k=it.url||it.title;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,30);};
 const MK=MAC.map(m=>m[0]),CO=Object.keys(T).filter(k=>k!=="power"&&!MK.includes(k));
 if(f==="co")return merge(CO);if(f==="mk")return merge(MK);if(f==="pw")return T.power||[];if(f==="all")return merge(Object.keys(T));
 if(isPower())return T.power||[];if(!isMacro())return T[st.eq]||[];return merge(MK).slice(0,24);}
function newsChips(){const c=$("newsChips");if(!c)return;const f=NF||nDefault();c.innerHTML=NCAT.filter(x=>!(x[0]==="tab"&&st.view==="grid")).map(([k,l])=>'<button type="button" class="chip'+(k===f?" is-on":"")+'" data-n="'+k+'">'+l+'</button>').join("");
 c.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{NF=b.dataset.n===nDefault()?null:b.dataset.n;renderNews();});}
const OIL_SKIP_SYM=new Set(["TLW.L","CNE.L","GENL.L","ECO.L","ITH.L","AET.L","KIST.L","JSE.L","CHAR.L","TXP.L","GKP.L","SER.L","SQZ.L","ENOG.L","SEPL.L","RKH.L","ENQ.L","PHAR.L","IPCO.ST","IPCO.TO","SNM-SDB.ST","SNM.OL","AEC.ST","MER.ST","EQNR.OL","AKRBP.OL","VAR.OL","DNO.OL","BNOR.OL","BWE.OL","OKEA.OL","PEN.OL","PNOR.OL","QEC.OL","IOX.OL"]);
const OIL_SKIP_NAME=["tullow oil","capricorn energy","genel energy","eco atlantic","ithaca energy","afentra","kistos","jadestone energy","chariot","touchstone exploration","gulf keystone","serica energy","energean","seplat energy","rockhopper exploration","enquest","pharos energy","international petroleum","shamaran","africa energy","meren energy","equinor","aker bp","var energi","dno","bluenord","bw energy","okea","panoro energy","petronor","questerre energy","interoil"];
const foldName=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
function oilDup(r){if(!r||OIL_SKIP_SYM.has(r.sym))return true;const n=foldName(r.name);return OIL_SKIP_NAME.some(t=>n===t||(t.length>=6&&n.startsWith(t)));}
function renderGroupInto(host,groupId,opt){if(!host)return;opt=opt||{};if(!DATA){host.innerHTML='<p class="cv-wait">Loading prices…</p>';return;}
 const g0=grp(groupId);if(!g0){host.hidden=true;host.innerHTML="";return;}
 const skip=opt.skip||(()=>false);
 const g={id:g0.id,sections:(g0.sections||[]).map(s=>({label:s.label,note:s.note,rows:(s.rows||[]).filter(r=>!skip(r))})).filter(s=>s.rows.length)};
 const all=g.sections.flatMap(s=>s.rows);if(!all.length){host.hidden=true;host.innerHTML="";return;}
 host.hidden=false;const built=tableHtml(g,visCols(),scales(all),"");
 host.innerHTML='<section class="sec-tape"><header class="tape-h"><h2>'+esc(opt.title||"Companies")+'</h2><button type="button" class="tape-more">'+(st.wide?"Key columns":"More columns")+'</button></header><p class="tape-note">'+esc(opt.note||"")+'</p><div class="tbl-wrap tape-wrap"><table class="mtable">'+built.html+'</table></div></section>';
 bindTable(host.querySelector("table"),all);
 const btn=host.querySelector(".tape-more");if(btn)btn.onclick=()=>{st.wide=!st.wide;save();renderGroupInto(host,groupId,opt);};}
function newsHtml(parts){if(!NEWS||!NEWS.tabs)return"";const seen=new Set(),items=[];
 parts.forEach(p=>{(NEWS.tabs[p.id]||[]).forEach(it=>{if(p.topics&&!p.topics.some(w=>String(it.topic||"").toLowerCase().includes(w)))return;const k=it.url||it.title;if(seen.has(k))return;seen.add(k);items.push(it);});});
 items.sort((a,b)=>new Date(b.time)-new Date(a.time));const top=items.slice(0,6);if(!top.length)return"";
 return '<div class="feed-col"><h3>News</h3><ol class="feed-news">'+top.map(it=>{const u=/^https?:\/\//i.test(it.url)?it.url:"#";return '<li><time datetime="'+esc(it.time)+'">'+esc(gfs.format(new Date(it.time)))+'</time><a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(it.title)+'</a><span class="src">'+esc(it.source||"")+'</span></li>';}).join("")+'</ol></div>';}
function fillFeed(host,parts,dealKind){if(!host)return;const news=newsHtml(parts);const deals=window.MMDeals&&MMDeals.feed?MMDeals.feed(dealKind):"";
 const link='<p class="park-link"><a href="parked/companies/">Previous companies page: tables, news and deal flow</a></p>';
 if(!news&&!deals&&!(window.MMDeals&&MMDeals.feed)){host.innerHTML=link;return;}
 host.innerHTML='<section class="sec-feed"><h2>News and announcements</h2><div class="feed-grid">'+news+deals+'</div>'+link+'</section>';
 if(!deals&&window.MMDeals&&MMDeals.load&&host.dataset.dl!=="1"){host.dataset.dl="1";MMDeals.load().then(()=>{if(host.isConnected)fillFeed(host,parts,dealKind);}).catch(()=>{});}}
function fillGasSpot(){const host=$("gsSpot");if(!host)return;const g=grp("commodities");const rows=g?g.sections.flatMap(s=>s.rows):[];const r=rows.find(x=>x.sym==="TTF=F");
 if(!r||!DATA){host.innerHTML='<p class="gs-miss">TTF is not available yet.</p>';return;}
 const pill=v=>isNum(v)?'<span class="'+(v>0?"up":v<0?"dn":"")+'">'+fpct(v)+'</span>':"n/a";
 const q=window.MMLabels?MMLabels.gasQuote(r):{kicker:"TTF futures",detail:"contract not available · quote time not available",note:"Dutch TTF futures. The curve under this quote is the futures strip."};
 host.innerHTML='<div class="gs-quote"><div><span class="og-k">'+esc(q.kicker)+'</span><div class="gs-px">'+fpx(r.px,r.kind)+'<small>'+esc(r.ccy?" "+r.ccy:"")+'</small></div><p class="gs-meta">'+esc(q.detail)+'</p></div><div class="og-pills"><span class="og-pk">1D</span> '+pill(r.pct&&r.pct["1D"])+' <span class="og-pk">1M</span> '+pill(r.pct&&r.pct["1M"])+'</div><p class="tape-note">'+esc(q.note)+'</p></div>';}
function fillCurves(host,home){if(!host)return;ensureV2("v2/curves/curves.js?v=20261112ac",()=>{if(!window.MMV2Curves)return;const job=MMV2Curves.mount(host,home);if(job&&job.then)job.then(()=>setSubnav());});}
function place(kind){if(kind==="oil"){fillCurves($("ogCurves"),"oil");renderGroupInto($("ogTable"),"energy",{title:"Other oil & gas names",note:"Majors and listed names that are not already in the company tiles. Price, volume and moving averages. Click a name for the company page.",skip:oilDup});fillFeed($("ogFeed"),[{id:"energy"},{id:"lundin",topics:["shamaran","international petroleum","ipco"]}],"oil");}
 else if(kind==="mine"){fillCurves($("mnCurves"),"metal");renderGroupInto($("mnTable"),"metals",{title:"Metals & mining",note:"Price, volume and moving averages for the sector. The six Lundin names stay in the tiles above. Lundin Mining and Lundin Gold are also in this table so they sit with the other producers. Click a name for the company page."});fillFeed($("mnFeed"),[{id:"metals"},{id:"lundin",topics:["lundin mining","lundin gold","ngex","lucara","montage","lunr"]}],"mine");}
 else if(kind==="power"){fillCurves($("pwCurve"),"power");}
 else if(kind==="gas"){fillGasSpot();fillCurves($("gsCurve"),"gas");}
 else if(kind==="markets")fillCurves($("mktCurves"),"other");
 setSubnav();}
function renderNews(){const box=$("newsList"),hd=$("newsTitle"),meta=$("newsMeta");newsChips();const f=NF||nDefault();hd.textContent="News · "+(f!=="tab"?NCAT.find(x=>x[0]===f)[1]:isPower()?"Nordic power":isMacro()?"Markets":(EQ.find(e=>e[0]===st.eq)||[,""])[1]);
 if(!NEWS){box.innerHTML='<li class="news-empty">News not available yet.</li>';meta.textContent="";return;}
 const items=newsItems();meta.innerHTML=window.MMUI?MMUI.dot(NEWS.generated_utc,"news","Headlines"):"Updated "+esc(gf.format(new Date(NEWS.generated_utc)))+" CET";
 if(!items.length){box.innerHTML='<li class="news-empty">No recent headlines.</li>';return;}
 box.innerHTML=items.map(it=>{const u=/^https?:\/\//i.test(it.url)?it.url:"#";return'<li class="news-item'+(it.kind==="exchange"?" ex":"")+'"><time datetime="'+esc(it.time)+'">'+esc(gfs.format(new Date(it.time)))+'</time><a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(it.title)+'</a><span class="src">'+(it.kind==="exchange"?'<span class="badge">Exchange</span>':"")+esc(it.source)+'</span></li>';}).join("");}
const v2Scripts={};
function ensureV2(src,boot){if(v2Scripts[src]==="done"){boot();return;}if(Array.isArray(v2Scripts[src])){v2Scripts[src].push(boot);return;}const q=[boot];v2Scripts[src]=q;const s=document.createElement("script");s.src=src;s.onload=()=>{v2Scripts[src]="done";q.forEach(fn=>fn());};document.body.appendChild(s);}
function denseCols(){const V=COLS.filter(c=>c.k!=="mcap"&&c.k!=="ev");V.forEach(c=>c.gs=false);GROUPS.forEach(([id])=>{if(!id)return;const f=V.find(c=>c.g===id);if(f)f.gs=true;});return V;}
function renderDenseMarkets(){const host=$("mktDenseBody");if(!host)return;if(!DATA){host.innerHTML='<p class="na">Loading the price table…</p>';return;}
 host.innerHTML=MAC.map(([id,l])=>{const g=grp(id);if(!g)return"";const all=g.sections.flatMap(s=>s.rows);const r=tableHtml(g,denseCols(),scales(all),"");
  return '<section class="mkt-sec" id="mkt-tbl-'+id+'"><h3>'+esc(l)+'</h3><div class="tbl-wrap mkt-wrap"><table class="mtable">'+r.html+'</table></div></section>';}).join("");
 host.querySelectorAll("table.mtable").forEach(tbl=>{const id=tbl.closest(".mkt-sec").id.replace("mkt-tbl-","");const g=grp(id);if(g)bindTable(tbl,g.sections.flatMap(s=>s.rows));});}
function mountLiveMarkets(){const v=$("macroWrap");if(!v)return;if(!v.querySelector(".v2-live"))v.innerHTML='<div class="v2-live"><p class="build" id="v2marketsBuild">Loading the published market file…</p><main id="v2markets"></main><section class="block mkt-dense" id="mktDense"><header class="bh"><h2>Volume, averages and longer periods</h2></header><p class="asof">Same prices as the tiles. Volume, moving averages and changes out to 10Y.</p><div id="mktDenseBody"></div></section><footer><p>Data: the same market file the previous Markets tab uses. A blank is “not available yet”, never zero. A tile opens the quote; it does not draw another chart.</p></footer></div>';ensureV2("v2/markets/markets.js?v=20261112ag",()=>{window.MMV2Markets&&MMV2Markets.start();});renderDenseMarkets();}
function mountLiveCurves(){const v=$("curvesView");if(!v)return;if(!v.querySelector(".v2-live"))v.innerHTML='<div class="v2-live"><p class="build" id="v2curvesBuild">Loading the published curve archive…</p><main id="v2curves"></main><footer><p>Data: <a href="https://github.com/MasterKano/emmi-data/tree/main/curves">MasterKano/emmi-data, curves</a>. A blank is “not available yet”, never zero. Change is versus the previous archived session of the same contract.</p></footer></div>';ensureV2("v2/curves/curves.js?v=20261112ac",()=>{window.MMV2Curves&&MMV2Curves.start();});}
function bootOg(src,ready){ensureV2("v2/companies/coverage.js?v=20261112ac",()=>ensureV2("v2/shared/ui.js?v=20261112st1",()=>ensureV2("v2/companies/tiles.js?v=20261112ac",()=>ensureV2(src,ready))));}
function mountCompanyBoard(){const host=$("companiesView");if(!host)return;host.hidden=false;const kind=st.list==="oil"?"oil":"renewables";if(host.dataset.kind===kind&&host.querySelector(".v2co-tile, .co-row"))return;host.dataset.kind=kind;host.innerHTML='<div class="co-board"><h1>'+(kind==="oil"?"Oil":"Renewables")+'</h1><p class="lede">'+(kind==="oil"?"The 32-name oil and gas list. A name opens its EMMI page.":"The renewables names already on the EMMI list. A name opens its EMMI page.")+'</p><div class="v2co"></div></div>';bootOg("v2/companies/tiles.js?v=20261112ac",()=>{window.MMV2Tiles&&MMV2Tiles.mount(host.querySelector(".v2co"),kind);});}
function mountBriefs(){const host=$("briefsView");if(!host)return;host.hidden=false;if(st.brief==="live"&&window.EMMILivePulse){EMMILivePulse.mount(host);return;}if(window.EMMILivePulse)EMMILivePulse.stop();if(window.EMMIBriefs&&EMMIBriefs.mount)EMMIBriefs.mount(host);}
function mountLiveOil(){const v=$("oilgasView");if(!v)return;if(!v.querySelector(".og"))v.innerHTML='<div class="og"><div class="og-root">Loading oil and gas…</div></div>';bootOg("v2/oilgas/v2.js?v=20261112ac",()=>{window.MMV2Oil&&MMV2Oil.start();});}
function mountLiveMine(){const v=$("miningView");if(!v)return;if(!v.querySelector(".og"))v.innerHTML='<div class="og"><div class="og-root">Loading mining…</div></div>';bootOg("v2/mining/v2.js?v=20261112st1",()=>{window.MMV2Mine&&MMV2Mine.start();});}
function mountCoTiles(){const host=$("coTiles");if(!host)return;const kind=st.eq==="lundin"?"mining":"oil";const on=st.view==="equities"&&(st.eq==="energy"||st.eq==="lundin")&&!window.EMMI_PARKED_COMPANIES;document.body.classList.toggle("co-tiles",on);host.hidden=!on;if(!on)return;if(host.dataset.kind===kind&&host.querySelector(".v2co-tile"))return;host.dataset.kind=kind;host.innerHTML='<p class="v2co-prev"><a href="parked/companies/">Previous company table</a></p><div class="v2co"></div>';bootOg("v2/companies/tiles.js?v=20261112q",()=>{window.MMV2Tiles&&MMV2Tiles.mount(host.querySelector(".v2co"),kind);});}
function renderAll(){const v=st.view;document.body.classList.toggle("is-power",v==="power");document.body.classList.toggle("is-aux",isAux());document.body.classList.toggle("is-energy",["power","oilgas","gas","grid"].includes(v));VIEWS.forEach(x=>document.body.classList.toggle("view-"+x,v===x));const cv=$("companiesView"),bv=$("briefsView");if(cv)cv.hidden=v!=="companies";if(bv)bv.hidden=v!=="briefs";renderTabs();syncNav();renderStamp();paintSection();
 if(v==="curves"){window.MMPower&&window.MMPower.hide();window.MMToday&&window.MMToday.clear();mountLiveCurves();}
 else if(v==="oilgas"){window.MMPower&&window.MMPower.hide();window.MMToday&&window.MMToday.clear();mountLiveOil();}
 else if(v==="mining"){window.MMPower&&window.MMPower.hide();window.MMToday&&window.MMToday.clear();mountLiveMine();}
 else if(v==="companies"){window.MMPower&&window.MMPower.hide();window.MMToday&&window.MMToday.clear();mountCompanyBoard();}
 else if(v==="briefs"){window.MMPower&&window.MMPower.hide();window.MMToday&&window.MMToday.clear();mountBriefs();}
 else if(v==="power"||v==="grid"){window.EMMI_NORDIC_FOCUS=st.nordic;window.MMPower&&window.MMPower.show(v);if(v==="power"&&window.MMV2Power&&MMV2Power.setFocus)MMV2Power.setFocus(st.nordic);}else{window.MMPower&&window.MMPower.hide();if(v==="home"||v==="gas"||!DATA)window.MMToday&&window.MMToday.clear();else if(v==="macro"&&!window.EMMI_PARKED_MARKETS)mountLiveMarkets();else if(v!=="companies"&&v!=="briefs")renderTable();}
 if(v==="gas")window.MMGas&&window.MMGas.show();else window.MMGas&&window.MMGas.hide();
 if(v==="home")window.MMHome&&window.MMHome.show();else window.MMHome&&window.MMHome.hide();
 if(v==="equities")mountCoTiles();else{document.body.classList.remove("co-tiles");const host=$("coTiles");if(host)host.hidden=true;}
 renderNews();setSubnav();
 if(v==="oilgas")place("oil");else if(v==="mining")place("mine");else if(v==="power")place("power");else if(v==="gas")place("gas");else if(v==="macro"&&!window.EMMI_PARKED_MARKETS)place("markets");}
function paintSection(){const el=$("sectionNav");if(!el)return;const v=st.view;let items=null,on="";
 if(v==="power"||v==="oilgas"||v==="gas"||v==="grid"){items=[["power","Nordic power"],["oilgas","Oil & gas"],["gas","Gas storage"],["grid","Grid"]];on=v==="power"?"power":v;if(v==="power")items=items.concat([["overview","Overview"],["prices","Prices"],["generation","Generation"],["weather","Weather"],["hydro","Hydro"]]);}
 else if(v==="companies"||v==="mining"){items=[["renewables","Renewables"],["oil","Oil"],["mining","Mining"]];on=v==="mining"?"mining":st.list;}
 else if(v==="briefs"){items=[["live","Live Pulse"],["pulse","Pulse"],["csi","CSI"]];on=st.brief||"pulse";}
 if(!items){el.hidden=true;el.innerHTML="";return;}
 el.hidden=false;
 el.innerHTML=items.map(([id,label])=>{const focus=["overview","prices","generation","weather","hydro"].includes(id);const cur=focus?st.nordic===id||(id==="overview"&&st.nordic==="nordic"):id===on;return '<button type="button" data-sec="'+id+'"'+(cur?' class="is-on" aria-current="true"':"")+'>'+label+"</button>";}).join("");}
/* sticky section sub-nav. Grid and gas set their own when those views render. */
function setSubnav(){if(!window.MMUI)return;const el=$("subNav");if(!el)return;
 if(st.view==="macro"&&window.EMMI_PARKED_MARKETS){MMUI.subnav(el,MAC.map(([id,l])=>["macro-"+id,l]).concat([["macro-y10","Government bonds"],["macro-val","US stock valuations"],["macro-charts","Interactive charts"],["pwNews","News"],["explain","How to read"]]));return;}
 if(st.view==="equities"&&(window.EMMI_PARKED_COMPANIES||window.EMMI_PARKED_CURVES)){MMUI.subnav(el,[["tblWrap","Table"],["dfPanel","Deal flow"],["pwNews","News"],["explain","How to read"]]);return;}
 if(st.view==="gas")return;
 if(st.view==="grid"){el.innerHTML="";return;}
 const mineCurve=$("mnCurves")&&!$("mnCurves").hidden&&$("mnCurves").querySelector(".cv-block");
 const items=st.view==="macro"?[["mkt-indices","Indices"],["mkt-cmd","Commodities"],["mkt-rates","Rates"],["mkt-fx","FX"],["mktDense","Table"]]
  :st.view==="oilgas"?[["ogPx","Prices"],["ogCurves","Curve"],["ogWeek","Weekly"],["ogBal","Balance"],["ogYear","Annual"],["ogMed","Outlook"],["ogCost","Costs"]]
  :st.view==="mining"?[["mnLundin","Companies"],["mnPx","Prices"],["mnCopper","Copper"],["mnGold","Gold"],["mnDia","Diamonds"],["mnCost","Costs"]]
  :st.view==="power"||st.view==="companies"||st.view==="briefs"?null
  :null;
 if(items&&st.view==="mining"&&mineCurve)items.splice(1,0,["mnCurves","Curve"]);
 if(!items){el.innerHTML="";return;}
 MMUI.subnav(el,items);}

/* ---------- chart modal ---------- */
function yahooUrl(s){return/^CNBC:/.test(s)?"https://www.cnbc.com/quotes/"+encodeURIComponent(s.slice(5)):"https://finance.yahoo.com/quote/"+encodeURIComponent(s);}
function bigChart(r){const p=r.spark;if(!p||p.length<2)return'<p class="fallback-msg">No price history available.</p>';const w=600,h=220;let mn=Math.min(...p),mx=Math.max(...p);if(mx===mn)mx=mn+1;
 const d=p.map((v,i)=>(i?"L":"M")+((i/(p.length-1))*w).toFixed(1)+" "+(h-8-((v-mn)/(mx-mn))*(h-16)).toFixed(1)).join("");const c=p[p.length-1]>=p[0]?"var(--good)":"var(--bad)";
 return'<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" class="fallback-svg"><path d="'+d+'L'+w+' '+h+'L0 '+h+'Z" fill="'+c+'" opacity=".12"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="fallback-axis"><span>'+esc(r.spark_from||"")+'</span><span>hi '+fpx(mx,r.kind)+' · lo '+fpx(mn,r.kind)+' '+esc(unitOf(r))+'</span><span>'+esc(r.bar_date||"")+'</span></div>';}
/* TradingView's embeddable widget refuses Cboe Treasury yields (TVC:US*) with an "only available on TradingView" popup,
   so yield rows open the Yahoo 1Y line straight away; the TradingView button still links to the full chart. */
const noWidget=r=>r.kind==="yield"||/^TVC:US\d/.test(r.tv||"");
function openChart(r){const m=$("chartModal");const y=noWidget(r);$("cmTitle").textContent=r.name;$("cmMeta").textContent=[r.tv||"no TradingView mapping",r.sym,r.ccy].filter(Boolean).join(" · ");
 $("cmTv").href=r.tv?"https://www.tradingview.com/chart/?symbol="+encodeURIComponent(r.tv):"https://www.tradingview.com/";const OU=r.official&&!r.fallback?r.official.url:r.official&&r.live?r.live.url:null;$("cmYahoo").href=OU||yahooUrl(r.sym);$("cmYahoo").textContent=OU?(r.fallback?"CNBC ↗":r.official.name+" ↗"):"Yahoo ↗";
 $("cmFallback").innerHTML='<div class="fallback-head">'+(y?"1-year yield, % · daily closes ("+(r.official&&!r.fallback?r.official.name:r.src==="cnbc"?"CNBC, fallback":"Yahoo")+"). Government bond yields can't be embedded from TradingView; use TradingView ↗ for the interactive chart.":"1-year price, "+esc(unitOf(r))+" · daily closes (Yahoo) — shown when the TradingView widget is unavailable for this symbol")+'</div>'+bigChart(r);
 m.hidden=false;document.body.classList.add("modal-open");$("cmClose").focus();
 const fb=$("cmFallback"),sb=$("cmSimple");
 if(r.tv&&!y&&window.MM&&window.MM.openChart){fb.hidden=true;sb.classList.remove("is-on");sb.disabled=false;sb.title="Toggle a simple 1Y line from the table data";window.MM.openChart(r.name,r.tv);if(!(window.MM.selfDrawn&&window.MM.selfDrawn(r.tv)))setTimeout(()=>{if(!window.TradingView)fb.hidden=false;},5000);}
 else{fb.hidden=false;sb.classList.add("is-on");sb.disabled=true;sb.title=y?"Yields show the Yahoo 1Y line (no embeddable TradingView chart)":"No TradingView mapping: Yahoo 1Y line only";window.MM&&window.MM.clearChart&&window.MM.clearChart();const s=$("status_tablechart");if(s)s.hidden=true;$("chart_tablechart").replaceChildren();}}
function closeChart(){$("chartModal").hidden=true;document.body.classList.remove("modal-open");$("chart_tablechart").replaceChildren();}

/* ---------- load ---------- */
async function getJSON(u){const r=await fetch(u+(u.includes("?")?"&":"?")+"t="+Math.floor(Date.now()/6e4),{cache:"no-cache"});if(!r.ok)throw Error(u+": HTTP "+r.status);return r.json();}
/* intraday prices (every 15 min) are published to the live-data branch, not committed; use whichever file is newer */
/* one file for intraday and full builds (live-data data/market.json via live.js; the copy on main is the fallback) */
async function getMarket(){const d=await getJSON("data/market.json");if(!d||!d.groups)throw Error("market.json: no rows");return d;}
async function load(){const tbl=$("tbl");if(!DATA)tbl.innerHTML='<tbody><tr><td class="empty">Loading market data…</td></tr></tbody>';
 const[a,b]=await Promise.allSettled([getMarket(),st.view==="home"?Promise.resolve(NEWS):getJSON("data/news.json")]);
 if(a.status==="fulfilled"){DATA=a.value;window.MMUI&&MMUI.markLoaded();}else if(!DATA)tbl.innerHTML='<tbody><tr><td class="empty">Could not load data/market.json ('+esc(a.reason&&a.reason.message)+'). If you opened the file directly, serve the folder over HTTP.</td></tr></tbody>';
 if(b.status==="fulfilled"&&b.value)NEWS=b.value;
 if(st.sort&&!val[st.sort])st.sort=null;renderAll();window.MMCompany&&window.MMCompany.ready();if(pendingSub){const s=pendingSub;pendingSub=null;scrollSub(s);}}
window.MMUI&&MMUI.apply(document);/* "How to read" closed by default, then the user's choice */
PHONE.addEventListener("change",()=>{if(DATA&&!isAux())renderTable();});
let ft;$("tblFilter").addEventListener("input",e=>{clearTimeout(ft);ft=setTimeout(()=>{st.q=e.target.value;renderTable();},120);});
$("cmClose").onclick=closeChart;$("cmSimple").onclick=()=>{const f=$("cmFallback");f.hidden=!f.hidden;$("cmSimple").classList.toggle("is-on",!f.hidden);};$("chartModal").addEventListener("click",e=>{if(e.target.id==="chartModal")closeChart();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("chartModal").hidden)closeChart();});
setInterval(()=>DATA&&renderStamp(),60000);
/* pick up new intraday prices while the page stays open (tables only re-render when the data changed) */
setInterval(async()=>{if(document.hidden||!DATA)return;try{const d=await getMarket();if(d.generated_utc===DATA.generated_utc)return;DATA=d;renderStamp();
 if(document.body.dataset.page!=="monitor"){if(!isAux()){renderTabs();renderTable();}else if(st.view==="home"&&window.MMHome)MMHome.render();}}catch(e){}},5*60000);
/* ---------- navigation + URL hash ---------- */
const curView=()=>document.body.dataset.page==="monitor"?"charts":st.view;
let subHash=null,newsP=null;
function hashFor(){const v=curView();
 if(v==="charts")return "markets/charts";
 if(v==="home")return "overview";
 if(v==="macro")return "markets"+(subHash?"/"+subHash:"");
 if(v==="power")return "energy/"+(st.nordic&&st.nordic!=="overview"?st.nordic:"nordic");
 if(v==="oilgas")return "energy/oil"+(subHash?"/"+subHash:"");
 if(v==="gas")return "energy/gas"+(subHash?"/"+subHash:"");
 if(v==="grid")return "energy/grid"+(subHash?"/"+subHash:"");
 if(v==="mining")return "companies/mining";
 if(v==="companies")return "companies/"+(st.list||"renewables");
 if(v==="briefs")return st.brief&&st.brief!=="pulse"?"briefs/"+st.brief:"briefs";
 return "overview";}
function writeHash(){if(/^#co=/.test(location.hash))return;const h="#"+hashFor();if(location.hash!==h)history.replaceState(history.state,"",location.pathname+location.search+h);}
function parseHash(){let h="";try{h=decodeURIComponent(location.hash.slice(1));}catch(e){return null;}if(!h||h.startsWith("co="))return null;
 const leg={home:"overview",macro:"markets",power:"energy/nordic",oilgas:"energy/oil",mining:"companies/mining",gas:"energy/gas",grid:"energy/grid",equities:"companies/renewables",curves:"energy/nordic",charts:"markets/charts",monitor:"markets/charts",nordic:"companies/renewables",energy:"companies/oil",metals:"companies/mining",lundin:"companies/mining",indices:"markets",commodities:"markets",rates:"markets",table:"companies/renewables",markets:"markets"};
 if(leg[h])h=leg[h];
 else if(h.startsWith("equities/")){const s=h.split("/")[1];h=(s==="oil-gas"||s==="energy")?"companies/oil":(s==="metals"||s==="lundin")?"companies/mining":"companies/renewables";}
 else if(h.startsWith("power/")){const s=h.slice(6);const map={price:"prices",wind:"weather",temp:"weather",rain:"weather",generation:"generation",hydro:"hydro",monthly:"weather",tomorrow:"prices",pwCurve:"prices",pwSecSpot:"prices"};if(s==="pwCos")h="companies/renewables";else h="energy/"+(map[s]||"nordic");}
 else if(h.startsWith("oilgas/")){const s=h.slice(7);h=(s==="ogCos")?"companies/oil":"energy/oil"+(s?"/"+s:"");}
 else if(h.startsWith("mining/"))h="companies/mining";
 else if(h.startsWith("gas/"))h="energy/"+h;
 else if(h.startsWith("grid/")||/^gd/.test(h))h=h.startsWith("gd")?"energy/grid/"+h:"energy/"+h;
 else if(h.startsWith("macro/"))h="markets/"+h.slice(6);
 else if(h.startsWith("pw"))h="energy/nordic";
 const p=h.split("/");const top=p[0];
 if(top==="overview")return {v:"home"};
 if(top==="markets")return {v:p[1]==="charts"?"charts":"macro",sub:p[1]&&p[1]!=="charts"?p[1]:null};
 if(top==="energy"){const s=p[1]||"nordic";if(s==="oil")return {v:"oilgas",sub:p[2]||null,energy:"oil"};if(s==="gas")return {v:"gas",sub:p[2]||null,energy:"gas"};if(s==="grid")return {v:"grid",sub:p[2]||null,energy:"grid"};const focus={nordic:"overview",overview:"overview",prices:"prices",generation:"generation",weather:"weather",hydro:"hydro"}[s]||"overview";return {v:"power",energy:"nordic",nordic:focus};}
 if(top==="companies"){const list=p[1]||"renewables";if(list==="mining")return {v:"mining",list:"mining"};return {v:"companies",list:list==="oil"?"oil":"renewables"};}
 if(top==="briefs")return {v:"briefs",brief:p[1]==="csi"?"csi":p[1]==="live"?"live":"pulse"};
 if(VIEWS.includes(top))return {v:top,sub:p[1]||null};
 return null;}
function sectionOf(v){if(v==="home")return "home";if(v==="macro"||v==="charts")return "macro";if(v==="companies"||v==="mining")return "companies";if(v==="briefs")return "briefs";if(v==="power"||v==="oilgas"||v==="gas"||v==="grid")return "energy";return "home";}
function syncNav(){const v=sectionOf(curView());document.querySelectorAll("#mainNav [data-v]").forEach(b=>{const on=b.dataset.v===v;b.classList.toggle("is-on",on);if(b.getAttribute("role")==="tab"){b.setAttribute("aria-selected",on);b.tabIndex=on?0:-1;}});}
let pendingSub=null;
function scrollSub(sub){if(!sub)return;const id=document.getElementById(sub)?sub:(isMacro()?"macro-"+sub:sub);setTimeout(()=>{const el=$(id)||$(sub);if(el&&window.MMUI)MMUI.go(el.id,$("subNav"));},st.view==="grid"||st.view==="gas"||isPower()?400:120);}
function parkedOld(){return !!(window.EMMI_PARKED_COMPANIES||window.EMMI_PARKED_CURVES);}
function retarget(v,sub){if(parkedOld())return null;
 if(v==="equities"){if(sub==="renewables"||sub==="nordic")return ["power","pwCos"];if(sub==="metals")return ["mining","mnTable"];if(sub==="lundin")return ["mining","mnLundin"];return ["oilgas","ogTable"];}
 if(v==="curves"){if(sub==="brent"||sub==="ho")return ["oilgas","ogCurves"];if(sub==="ttf")return ["gas","gsSecPx"];return ["power","pwCurve"];}
 return null;}
function keepSub(v,sub){if(!sub)return null;if(v==="macro"&&(MAC.some(m=>m[0]===sub)||/^mkt-/.test(sub)))return sub;if(v==="power"&&(/^pw/.test(sub)||/^(price|wind|temp|rain|generation|hydro|monthly|tomorrow)$/.test(sub)))return sub;if(v==="oilgas"&&/^og/.test(sub))return sub;if(v==="mining"&&/^mn/.test(sub))return sub;if(v==="grid"&&/^gd/.test(sub))return sub;if(v==="gas"&&/^gs/.test(sub))return sub;return null;}
function go(v,sub,fromHash,extra){extra=extra||{};const rt=retarget(v,sub);if(rt){v=rt[0];sub=rt[1];}if(!VIEWS.includes(v))v="home";subHash=keepSub(v,sub);
 if(extra.nordic)st.nordic=extra.nordic;if(extra.list)st.list=extra.list;if(extra.brief)st.brief=extra.brief;if(extra.energy)st.energy=extra.energy;
 if(v==="power")st.energy="nordic";if(v==="oilgas")st.energy="oil";if(v==="gas")st.energy="gas";if(v==="grid")st.energy="grid";
 if(v==="mining")st.list="mining";if(v==="companies"&&extra.list)st.list=extra.list;
 if(v==="charts"){window.MM&&window.MM.setPage("monitor");syncNav();if(!fromHash)writeHash();window.MMPower&&window.MMPower.hide();return;}
 window.MM&&window.MM.setPage("table");const changed=st.view!==v;st.view=v;
 if(v==="equities"&&sub){const e=EQ.find(x=>x[2]===sub||x[0]===sub);if(e)st.eq=e[0];}
 if(changed){st.q="";const f=$("tblFilter");if(f)f.value="";NF=null;}
 save();renderAll();if(!NEWS&&v!=="home"&&!newsP)newsP=getJSON("data/news.json").then(n=>{NEWS=n;if(st.view!=="home")renderNews();}).catch(()=>{newsP=null;});if(!fromHash||rt)writeHash();if(changed&&!sub)scrollTo({top:0});
 if(sub){if(DATA)scrollSub(sub);else pendingSub=sub;}}
function navClick(v){if(v==="energy"){if(st.energy==="oil")go("oilgas");else if(st.energy==="gas")go("gas");else if(st.energy==="grid")go("grid");else go("power",null,false,{nordic:st.nordic||"overview"});}
 else if(v==="companies"){if(st.list==="mining")go("mining");else go("companies",null,false,{list:st.list==="oil"?"oil":"renewables"});}
 else if(v==="briefs")go("briefs",null,false,{brief:st.brief||"pulse"});
 else go(v);}
document.querySelectorAll("#mainNav [data-v]").forEach(b=>{if(b.tagName==="A")return;b.onclick=()=>navClick(b.dataset.v);});
const secNav=$("sectionNav");if(secNav)secNav.addEventListener("click",e=>{const b=e.target.closest("[data-sec]");if(!b)return;const id=b.dataset.sec;
 if(id==="power")go("power",null,false,{nordic:st.nordic||"overview"});
 else if(id==="oilgas")go("oilgas");
 else if(id==="gas")go("gas");
 else if(id==="grid")go("grid");
 else if(id==="renewables")go("companies",null,false,{list:"renewables"});
 else if(id==="oil")go("companies",null,false,{list:"oil"});
 else if(id==="mining")go("mining",null,false,{list:"mining"});
 else if(id==="pulse"||id==="csi"||id==="live"){st.brief=id;go("briefs",null,false,{brief:id});}
 else if(["overview","prices","generation","weather","hydro"].includes(id))go("power",null,false,{nordic:id});
});
$("mainNav").addEventListener("keydown",e=>{if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;const bs=[...document.querySelectorAll("#mainNav [data-v]")];const i=bs.findIndex(b=>b.classList.contains("is-on"));const n=bs[(i+(e.key==="ArrowRight"?1:-1)+bs.length)%bs.length];n.focus();n.click();});
window.addEventListener("hashchange",()=>{const r=parseHash();if(r)go(r.v,r.sub,true,r);});
let y10T;addEventListener("resize",()=>{clearTimeout(y10T);y10T=setTimeout(()=>{if(isMacro()&&window.EMMI_PARKED_MARKETS&&DATA&&!st.q.trim())renderY10();},200);});
document.addEventListener("click",e=>{if(e.target.closest("#openCharts"))go("charts");else if(e.target.closest("#chartsBack"))go("macro","charts");});
window.MMNav={go:(v,sub)=>{go(v,sub);if(!sub)scrollTo({top:0});}};
window.MMTable={todayParts,fpx,fbp,spark,data:()=>DATA,news:()=>NEWS,openChart:r=>openChart(r),reload:()=>{if((isPower()||st.view==="grid")&&window.MMPower)window.MMPower.reload();if(st.view==="home"&&window.MMHome)MMHome.reload();if(st.view==="gas"&&window.MMGas)MMGas.reload();if(isMacro()&&!window.EMMI_PARKED_MARKETS&&window.MMV2Markets)MMV2Markets.reload();if(st.view==="curves"&&window.MMV2Curves)MMV2Curves.reload();return load();}};
document.addEventListener("mm:place",e=>{if(e.detail)place(e.detail);});
{const r=parseHash();if(r){go(r.v,r.sub,true,r);writeHash();}else{go("home",null);}}/* no hash: Overview is the landing tab */
load();
})();
