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
const VIEWS=["home","equities","macro","power","gas","grid","charts"];
const LEGACY={nordic:"equities/renewables",energy:"equities/oil-gas",metals:"equities/metals",lundin:"equities/lundin",indices:"macro/indices",commodities:"macro/commodities",rates:"macro/rates",monitor:"charts",table:"equities",markets:"equities",power:"power",pwSecGrid:"grid","power/pwSecGrid":"grid",griddc:"grid",home:"home"};
const st=Object.assign({view:"equities",eq:"nordic",explain:null,sort:null,dir:-1,q:""},(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}");}catch(e){return{};}})());
delete st.mode;/* Price / Volume+MA toggle removed: all column groups are always shown */
if(st.tab){/* v2 state: single tab id */if(st.tab==="power")st.view="power";else if(EQ.some(e=>e[0]===st.tab)){st.view="equities";st.eq=st.tab;}else if(MAC.some(m=>m[0]===st.tab))st.view="macro";delete st.tab;}
if(!["home","equities","macro","power","gas","grid"].includes(st.view))st.view="home";if(!EQ.some(e=>e[0]===st.eq))st.eq="nordic";
const save=()=>{try{localStorage.setItem(LS,JSON.stringify({view:st.view,eq:st.eq,sort:st.sort,dir:st.dir,wide:st.wide}));}catch(e){}};
const isPower=()=>st.view==="power",isMacro=()=>st.view==="macro",isAux=()=>["home","power","gas","grid"].includes(st.view);
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
/* quote time label: market open with a quote today -> time of last quote (Geneva); otherwise "close DD Mon" */
function quoteLabel(r){if(!r||r.error||!isNum(r.px))return null;const ST={open:"Market open",pre:"Pre-market",post:"After hours",closed:"Market closed"};
 const keep=r.stale?" · kept from the last full build":"";
 if(r.official&&r.bar_date){const d=gfd.format(new Date(r.bar_date+"T12:00:00Z"));const lag=Math.round((Date.now()-Date.parse(r.bar_date+"T12:00:00Z"))/864e5);return{txt:"close "+d,tip:(r.fallback?"CNBC daily close (fallback)":"Official close · "+r.official.name)+" · "+d+(lag>2?" · lags "+lag+" days":"")+(r.live&&isNum(r.live.px)?" · CNBC live quote "+r.live.px.toFixed(3)+"% (intraday move only)":"")};}
 if(r.partial===true&&r.market_time){const t=new Date(r.market_time);return{txt:gft.format(t),tip:"Market open · last quote "+gfs.format(t)+" Geneva (Yahoo, ~15 min delayed)"+keep};}
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
[5,20,50].forEach(n=>val["v"+n]=r=>r.vol&&r.vol["r"+n]);
[10,20,50,200].forEach(n=>val["m"+n]=r=>r.ma&&r.ma[n]?(r.kind==="yield"?r.ma[n].bp:r.ma[n].pct):null);
const COLS=[
 {k:"name",g:"",l:"Instrument",cls:"c-name"},
 {k:"px",g:"",l:"Last",cls:"num c-px",t:"Latest Yahoo quote, local currency (~15 min delayed), refreshed every 15 min in market hours. Grey: time of the last quote (Geneva) while the market is open, otherwise the date of the last close."},
 {k:"mcap",g:"",l:"Mkt cap €",cls:"num c-mcap",t:"Market capitalization converted to EUR (Yahoo; FX from Yahoo EUR crosses or ECB mid). Hover for original currency."},
 {k:"ev",g:"",l:"EV €",cls:"num c-ev",t:"Enterprise value converted to EUR when Yahoo provides it. Hover for original currency."},
 {k:"spark",g:"price",l:"1Y",t:"1-year line of daily closes (Yahoo) in the quote currency; yields in %, indices in points. Hover a line for the 1Y change, high and low. Sorts by 1Y %.",cls:"c-spark"},
 {k:"chg",g:"price",l:"1D chg",t:"Change vs previous close. Yields in bp."},
 ...PCT.map(k=>({k:"p"+k,g:"price",l:k==="1D"?"1D %":k,hz:k,
   t:(k==="YTD"?"Since prior year-end close":"Price return over "+k)+(k==="10Y"?". Futures: continuous front month, roll-affected (†)":"")+". Yields shown as bp change."})),
 {k:"vlast",g:"vol",l:"Last vol",t:"Volume of the latest session (today so far while the market is open)"},
 ...[5,20,50].map(n=>({k:"v"+n,g:"vol",l:n+"d avg",t:"Average volume of the "+n+" sessions before the latest; ratio = last ÷ average (highlighted > 1.5x)"})),
 ...[10,20,50,200].map(n=>({k:"m"+n,g:"ma",l:n+"d MA",t:"Price vs "+n+"-day simple moving average (●above / ●below). MA value in tooltip."})),
];
const GROUPS=[["","",1],["price","Price",0],["vol","Volume",0],["ma","Moving averages",0]];

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
 if(k==="chg"){const v=r.kind==="yield"?(r.bp&&r.bp["1D"]):r.chg;const s=isNum(v)?(v>0?"up":v<0?"dn":""):"";return'<td class="num '+s+'">'+(r.kind==="yield"?fbp(v):fchg(v,r.px,r.kind))+'</td>';}
 if(k[0]==="p"){const hz=c.hz;const y=r.kind==="yield";const v=y?(r.bp&&r.bp[hz]):(r.pct&&r.pct[hz]);
  const roll=hz==="10Y"&&r.roll&&isNum(v);const tip=roll?' title="Continuous front-month futures: 10Y figure is roll-affected"':y&&isNum(r.pct&&r.pct[hz])?' title="'+esc(fpct(r.pct[hz]))+' relative change in yield"':"";
  return'<td class="num heat'+hid+'"'+heat(v,y?S.bp[hz]:S.pct[hz])+tip+'>'+(y?fbp(v):fpct(v))+(roll?'<sup>†</sup>':"")+'</td>';}
 if(k==="vlast")return'<td class="num"'+(r.partial?' title="Today so far (market open); ratios compare a partial day with full-day averages"':"")+'>'+(r.vol&&isNum(r.vol.last)?fvol(r.vol.last):NA)+'</td>';
 if(k[0]==="v"){const n=k.slice(1);const a=r.vol&&r.vol["a"+n],x=r.vol&&r.vol["r"+n];if(!isNum(a))return'<td class="num'+hid+'">'+NA+'</td>';
  return'<td class="num vol'+hid+(isNum(x)&&x>1.5?" hot":"")+'" title="'+n+'d avg volume '+a.toLocaleString("en-US")+(isNum(x)?" · last = "+x.toFixed(2)+"x":"")+'"><span class="ratio">'+(isNum(x)?x.toFixed(1)+"x":"n/a")+'</span><span class="avg">'+fvol(a)+'</span></td>';}
 if(k[0]==="m"){const n=k.slice(1);const m=r.ma&&r.ma[n];if(!m)return'<td class="num'+hid+'" title="Not enough history for a '+n+'d MA">'+NA+'</td>';
  const y=r.kind==="yield";const v=y?m.bp:m.pct;const above=v>=0;
  return'<td class="num ma'+hid+'" title="'+n+'d MA '+esc(fpx(m.v,r.kind))+' · price '+esc(fpx(r.px,r.kind))+'"><i class="dot '+(above?"above":"below")+'"></i>'+(y?fbp(v):fpct(v))+'</td>';}
 return"<td></td>";}

/* ---------- render ---------- */
function sortRows(rs){if(!st.sort||!val[st.sort])return rs;const f=val[st.sort];return rs.slice().sort((a,b)=>{const x=f(a),y=f(b);const nx=x==null||(typeof x==="number"&&!isFinite(x)),ny=y==null||(typeof y==="number"&&!isFinite(y));if(nx&&ny)return 0;if(nx)return 1;if(ny)return-1;if(typeof x==="string")return st.dir*x.localeCompare(y);return -st.dir*(y-x);});}
function renderTabs(){const box=$("tblTabs");box.replaceChildren();if(!DATA)return;EQ.forEach(([id,label])=>{const g=grp(id);if(!g)return;const rs=g.sections.flatMap(s=>s.rows).filter(r=>!r.error);const up=rs.filter(r=>r.pct&&r.pct["1D"]>0).length,dn=rs.filter(r=>r.pct&&r.pct["1D"]<0).length;const on=id===st.eq;const b=document.createElement("button");b.type="button";b.className="tbl-tab"+(on?" is-on":"");b.setAttribute("role","tab");b.setAttribute("aria-selected",on);
 b.innerHTML='<span>'+esc(label)+'</span><span class="breadth" title="'+up+' up / '+dn+' down today"><i style="width:'+(rs.length?Math.round(up/rs.length*100):0)+'%"></i></span>';b.onclick=()=>{if(st.eq===id)return;st.eq=id;st.q="";$("tblFilter").value="";save();renderAll();writeHash();};box.append(b);});}
function renderMovers(rs){const box=$("tblMovers");const ok=rs.filter(r=>!r.error&&r.kind!=="yield"&&r.pct&&isNum(r.pct["1D"]));const uniq=[...new Map(ok.map(r=>[r.sym,r])).values()];
 if(!uniq.length){box.replaceChildren();return;}const s=uniq.slice().sort((a,b)=>b.pct["1D"]-a.pct["1D"]);const best=s[0],worst=s[s.length-1];
 const spikes=[...new Map(rs.filter(r=>r.vol&&r.vol.r20>1.5).map(r=>[r.sym,r])).values()].sort((a,b)=>b.vol.r20-a.vol.r20).slice(0,3);
 const above=uniq.filter(r=>r.ma&&r.ma["200"]).length?Math.round(uniq.filter(r=>r.ma&&r.ma["200"]&&r.ma["200"].pct>=0).length/uniq.filter(r=>r.ma&&r.ma["200"]).length*100):null;
 const pill=(lab,r,txt,cls)=>'<button type="button" class="mover '+cls+'" data-sym="'+esc(r.sym)+'"><span class="ml">'+lab+'</span><b>'+esc(r.name)+'</b> '+txt+'</button>';
 let h=pill("Top",best,fpct(best.pct["1D"]),"up")+(worst!==best?pill("Bottom",worst,fpct(worst.pct["1D"]),"dn"):"");
 spikes.forEach(r=>h+=pill("Vol spike",r,r.vol.r20.toFixed(1)+"x 20d","hot"));
 if(above!=null)h+='<span class="mover static"><span class="ml">Above 200d</span><b>'+above+'%</b> of names</span>';
 box.innerHTML=h;box.querySelectorAll("button[data-sym]").forEach(b=>b.onclick=()=>{const r=rs.find(x=>x.sym===b.dataset.sym);r&&openChart(r);});}
const gsMark=(h,c)=>c.gs?h.replace('class="','class="gs '):h;
const KEYC=["name","px","p1D","pYTD"];/* phone: key columns only until "More columns" */
function visCols(){const V=COLS.filter(c=>!(isMacro()&&(c.k==="mcap"||c.k==="ev"))&&(!PHONE.matches||st.wide||KEYC.includes(c.k)));
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
 $("tblFoot").innerHTML='Prices: Yahoo quotes (~15 min delayed), refreshed every 15 min in market hours; grey time = last quote (Geneva) while open. Price returns from daily closes (not total return).'+fxN+(futs?' † Continuous front-month futures: long-horizon (esp. 10Y) figures include roll effects.':"")+(rates?" Yield rows show changes and MA distance in basis points.":"")+' n/a = not available from source or not enough history. '+(isMacro()?'Click a row for its chart.':'Click a company name for its profile (valuation, consensus, financials); click elsewhere in the row for its chart.');}
function renderTable(){if(isMacro())return renderMacro();const tbl=$("tbl");const g=grp(st.eq)||grp(EQ[0][0])||DATA.groups[0];st.eq=g.id;const all=g.sections.flatMap(s=>s.rows);const S=scales(all);
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
 PC.lineChart($("y10Chart"),{n:D.length,series:ser,h:W<520?220:250,yunit:"%",xlab:i=>i===D.length-1?null:fd(D[i]),xw:62,label:"10-year government bond yields, %",
  tip:i=>'<b>'+esc(fd(D[i]))+'</b>'+ser.map(x=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+': <b>'+(isNum(x.vals[i])?x.vals[i].toFixed(2)+'%':"n/a")+'</b>').join("")});
 PC.lineChart($("y10Spread"),{n:D.length,series:sp,h:W<520?160:150,yunit:"bp",xlab:i=>i===D.length-1?null:fd(D[i]),xw:62,label:"10-year spreads over the Bund, bp",
  tip:i=>'<b>'+esc(fd(D[i]))+'</b>'+sp.map(x=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+': <b>'+(isNum(x.vals[i])?x.vals[i].toFixed(0)+' bp':"n/a")+'</b>').join("")});}
function colBtn(){let b=$("colToggle");if(!b){b=document.createElement("button");b.id="colToggle";b.type="button";b.className="button col-toggle";$("tblFilter").before(b);b.onclick=()=>{st.wide=!st.wide;save();renderTable();};}
 b.textContent=st.wide?"Key columns":"More columns";b.setAttribute("aria-pressed",String(!!st.wide));}
function renderStamp(){const el=$("tblStamp");if(!DATA){el.textContent="";return;}const d=new Date(DATA.generated_utc);el.title=DATA.fundamentals_utc?"Market cap / EV fundamentals as of "+gf.format(new Date(DATA.fundamentals_utc))+" Geneva (scaled with price since)":"";el.innerHTML=(window.MMUI?MMUI.dot(DATA.generated_utc,"intra","Prices (Yahoo, ~15 min delayed)"):"")+'Updated '+esc(ago(DATA.generated_utc))+(DATA.errors&&DATA.errors.length?' · <span title="'+esc(DATA.errors.map(e=>e.sym+": "+e.error).join("\n"))+'">'+DATA.errors.length+' missing</span>':"");$("footStamp").textContent="Table data updated "+gf.format(d)+" Geneva.";$("exAsOf").textContent=gf.format(d)+" Geneva";const fxEl=$("exFxAsOf");if(fxEl)fxEl.textContent=DATA.fx_asof||"n/a";}
let NF=null;/* news filter: null = this tab's default */
const NCAT=[["tab","This tab"],["co","Companies"],["mk","Markets"],["pw","Nordic power"],["all","All"]];
function nDefault(){return st.view==="grid"?"all":"tab";}
function newsItems(){const T=(NEWS&&NEWS.tabs)||{},f=NF||nDefault();const merge=ids=>{const seen=new Set();return ids.flatMap(id=>T[id]||[]).filter(it=>{const k=it.url||it.title;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,30);};
 const MK=MAC.map(m=>m[0]),CO=Object.keys(T).filter(k=>k!=="power"&&!MK.includes(k));
 if(f==="co")return merge(CO);if(f==="mk")return merge(MK);if(f==="pw")return T.power||[];if(f==="all")return merge(Object.keys(T));
 if(isPower())return T.power||[];if(!isMacro())return T[st.eq]||[];return merge(MK).slice(0,24);}
function newsChips(){const c=$("newsChips");if(!c)return;const f=NF||nDefault();c.innerHTML=NCAT.filter(x=>!(x[0]==="tab"&&st.view==="grid")).map(([k,l])=>'<button type="button" class="chip'+(k===f?" is-on":"")+'" data-n="'+k+'">'+l+'</button>').join("");
 c.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{NF=b.dataset.n===nDefault()?null:b.dataset.n;renderNews();});}
function renderNews(){const box=$("newsList"),hd=$("newsTitle"),meta=$("newsMeta");newsChips();const f=NF||nDefault();hd.textContent="News · "+(f!=="tab"?NCAT.find(x=>x[0]===f)[1]:isPower()?"Nordic power":isMacro()?"Markets":(EQ.find(e=>e[0]===st.eq)||[,""])[1]);
 if(!NEWS){box.innerHTML='<li class="news-empty">News not available yet.</li>';meta.textContent="";return;}
 const items=newsItems();meta.innerHTML=window.MMUI?MMUI.dot(NEWS.generated_utc,"news","Headlines"):"Updated "+esc(gf.format(new Date(NEWS.generated_utc)))+" Geneva";
 if(!items.length){box.innerHTML='<li class="news-empty">No recent headlines.</li>';return;}
 box.innerHTML=items.map(it=>{const u=/^https?:\/\//i.test(it.url)?it.url:"#";return'<li class="news-item'+(it.kind==="exchange"?" ex":"")+'"><time datetime="'+esc(it.time)+'">'+esc(gfs.format(new Date(it.time)))+'</time><a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(it.title)+'</a><span class="src">'+(it.kind==="exchange"?'<span class="badge">Exchange</span>':"")+esc(it.source)+'</span></li>';}).join("");}
function renderAll(){const v=st.view;document.body.classList.toggle("is-power",v==="power");document.body.classList.toggle("is-aux",isAux());VIEWS.forEach(x=>document.body.classList.toggle("view-"+x,v===x));renderTabs();syncNav();renderStamp();
 if(v==="power"||v==="grid"){window.MMPower&&window.MMPower.show(v);}else{window.MMPower&&window.MMPower.hide();if(v==="home"||v==="gas"||!DATA)window.MMToday.clear();else renderTable();}
 if(v==="gas")window.MMGas&&window.MMGas.show();else window.MMGas&&window.MMGas.hide();
 if(v==="home")window.MMHome&&window.MMHome.show();else window.MMHome&&window.MMHome.hide();
 renderNews();setSubnav();}
/* sticky section sub-nav for Equities and Macro (Grid & DC sets its own; Power keeps #pwSubnav) */
function setSubnav(){if(!window.MMUI)return;const el=$("subNav");if(st.view==="macro")MMUI.subnav(el,MAC.map(([id,l])=>["macro-"+id,l]).concat([["macro-y10","Government bonds"],["macro-val","US stock valuations"],["macro-charts","Interactive charts"],["pwNews","News"],["explain","How to read"]]));
 else if(st.view==="equities")MMUI.subnav(el,[["tblWrap","Table"],["dfPanel","Deal flow"],["pwNews","News"],["explain","How to read"]]);}

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
 if(a.status==="fulfilled")DATA=a.value;else if(!DATA)tbl.innerHTML='<tbody><tr><td class="empty">Could not load data/market.json ('+esc(a.reason&&a.reason.message)+'). If you opened the file directly, serve the folder over HTTP.</td></tr></tbody>';
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
function hashFor(){const v=curView();return v==="equities"?"equities/"+(EQ.find(e=>e[0]===st.eq)||EQ[0])[2]:v+(subHash&&v!=="charts"?"/"+subHash:"");}
function writeHash(){if(/^#co=/.test(location.hash))return;const h="#"+hashFor();if(location.hash!==h)history.replaceState(history.state,"",location.pathname+location.search+h);}
function parseHash(){let h="";try{h=decodeURIComponent(location.hash.slice(1));}catch(e){return null;}if(!h||h.startsWith("co="))return null;
 if(LEGACY[h])h=LEGACY[h];else if(/^power\/gd/.test(h))h="grid/"+h.slice(6);else if(/^gd/.test(h))h="grid/"+h;else if(/^pw(Sec|News)/.test(h))h="power/"+h;let[v,sub]=h.split("/");if(/^pwSec(Bal|Drv|Hyd)$/.test(sub||""))sub="pwSecSup";return VIEWS.includes(v)?{v,sub:sub||null}:null;}
function syncNav(){const v=curView()==="charts"?"macro":curView();document.querySelectorAll("#mainNav [data-v]").forEach(b=>{const on=b.dataset.v===v;b.classList.toggle("is-on",on);b.setAttribute("aria-selected",on);b.tabIndex=on?0:-1;});}
let pendingSub=null;
function scrollSub(sub){if(!sub)return;const id=isMacro()?"macro-"+sub:(isPower()||st.view==="grid"||st.view==="gas")?sub:null;if(id)setTimeout(()=>{if(window.MMUI&&$(id))MMUI.go(id,$(st.view==="power"?"pwSubnav":"subNav"));},st.view==="grid"||st.view==="gas"||isPower()?400:60);}
function go(v,sub,fromHash){if(!VIEWS.includes(v))v="equities";subHash=(v==="macro"&&MAC.some(m=>m[0]===sub))||(v==="power"&&/^pw/.test(sub||""))||(v==="grid"&&/^gd/.test(sub||""))||(v==="gas"&&/^gs/.test(sub||""))?sub:null;
 if(v==="charts"){window.MM&&window.MM.setPage("monitor");syncNav();if(!fromHash)writeHash();window.MMPower&&window.MMPower.hide();return;}
 window.MM&&window.MM.setPage("table");const changed=st.view!==v;st.view=v;
 if(v==="equities"&&sub){const e=EQ.find(x=>x[2]===sub||x[0]===sub);if(e)st.eq=e[0];}
 if(changed){st.q="";$("tblFilter").value="";NF=null;}
 save();renderAll();if(!NEWS&&v!=="home"&&!newsP)newsP=getJSON("data/news.json").then(n=>{NEWS=n;if(st.view!=="home")renderNews();}).catch(()=>{newsP=null;});if(!fromHash)writeHash();if(changed&&!sub)scrollTo({top:0});
 if(sub){if(DATA)scrollSub(sub);else pendingSub=sub;}}
document.querySelectorAll("#mainNav [data-v]").forEach(b=>b.onclick=()=>go(b.dataset.v));
$("mainNav").addEventListener("keydown",e=>{if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;const bs=[...document.querySelectorAll("#mainNav [data-v]")];const i=bs.findIndex(b=>b.classList.contains("is-on"));const n=bs[(i+(e.key==="ArrowRight"?1:-1)+bs.length)%bs.length];n.focus();n.click();});
window.addEventListener("hashchange",()=>{const r=parseHash();if(r)go(r.v,r.sub,true);});
let y10T;addEventListener("resize",()=>{clearTimeout(y10T);y10T=setTimeout(()=>{if(isMacro()&&DATA&&!st.q.trim())renderY10();},200);});
document.addEventListener("click",e=>{if(e.target.closest("#openCharts"))go("charts");else if(e.target.closest("#chartsBack"))go("macro","charts");});
window.MMNav={go:(v,sub)=>{go(v,sub);if(!sub)scrollTo({top:0});}};
window.MMTable={todayParts,fpx,fbp,spark,data:()=>DATA,news:()=>NEWS,openChart:r=>openChart(r),reload:()=>{if((isPower()||st.view==="grid")&&window.MMPower)window.MMPower.reload();if(st.view==="home"&&window.MMHome)MMHome.reload();if(st.view==="gas"&&window.MMGas)MMGas.reload();return load();}};
{const r=parseHash();if(r){go(r.v,r.sub,true);writeHash();}else{go("home",null);}}/* no hash: Home is the landing tab */
load();
})();
