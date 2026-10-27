/* Home tab (default landing): Today lines from every tab, key prices, compact Nordic balance, latest deal flow and grid/DC items.
   Reuses the data already loaded by the other tabs (market.json, power.json, griddc.json, dealflow.json); no extra files. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const NA='<span class="na">n/a</span>';
/* key prices: [symbol, short label, unit, macro section] */
const KEY=[["^GSPC","S&P 500","pts","indices"],["^STOXX50E","Euro Stoxx 50","pts","indices"],["^GDAXI","DAX","pts","indices"],["^FTSE","FTSE 100","pts","indices"],["^SSMI","SMI","pts","indices"],["^OMX","OMX Stockholm 30","pts","indices"],
 ["BZ=F","Brent","$/bbl","commodities"],["TTF=F","TTF gas","€/MWh","commodities"],["GC=F","Gold","$/oz","commodities"],["HG=F","Copper","$/lb","commodities"],
 ["EURCHF=X","EUR/CHF","CHF","rates"],["^TNX","US 10Y","%","rates"],["CNBC:DE10Y-DE","Bund 10Y","%","rates"]];
let shown=false,asked=false;
const fdd=new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"numeric",month:"short"});
const gd=d=>d?fdd.format(new Date(d.slice(0,10)+"T12:00:00Z")).replace("Sept","Sep"):"";
function rows(){const D=window.MMTable&&MMTable.data();if(!D)return null;const m=new Map();D.groups.forEach(g=>g.sections.forEach(s=>s.rows.forEach(r=>{if(!m.has(r.sym))m.set(r.sym,r);})));return m;}
function head(id,title,sub,dot,href,open){return'<div class="hm-h sec-h"><h2>'+esc(title)+(sub?' <span class="pw-sub">'+sub+'</span>':'')+'</h2>'+(dot||"")+(href?'<a class="hm-open" href="'+href+'">'+esc(open)+' →</a>':'')+'</div>';}
function tile(r,k){const[sym,l,u,sec]=k;if(!r)return"";const y=r.kind==="yield";const c=y?(r.bp&&r.bp["1D"]):(r.pct&&r.pct["1D"]);const cls=isNum(c)?(c>0?"up":c<0?"dn":""):"";
 const T=window.MMTable;
 return'<a class="hm-tile" href="#macro/'+sec+'" title="'+esc(r.name+" · "+u+(r.official&&!r.fallback?" · official close: "+r.official.name:"")+" · open Macro")+'"><span class="hm-tl">'+esc(l)+' <em>'+esc(u)+'</em></span><b class="hm-px">'+(T?T.fpx(r.px,r.kind):r.px)+'</b>'+
  '<span class="hm-ch '+cls+'">'+(isNum(c)?(y?T.fbp(c):(c>0?"+":c<0?"−":"")+Math.abs(c).toFixed(2)+"%"):NA)+'<small> 1D</small></span>'+(T&&r.spark&&r.spark.length>1?'<span class="hm-sp">'+T.spark(r)+'</span>':'')+'</a>';}
/* Today briefing: per area one main development, one comparison and a link, with a freshness dot; the other facts and the sources fold out */
const SRC={equities:"Yahoo Finance quotes (~15 min delayed) and daily closes. Deal flow: NewsWeb, MFN, Nasdaq Nordic, Investegate, press wires and the FI insider register.",
 macro:"Yahoo quotes (~15 min delayed). 10-year yields: official daily closes where published (US Treasury, Deutsche Bundesbank, Bank of England, SNB), otherwise CNBC (marked in brackets).",
 power:"Nord Pool day-ahead prices and UMM, EEX settlements, ENTSO-E, NVE hydro and Svenska kraftnät.",gas:"GIE AGSI+ (Gas Infrastructure Europe), daily.",
 grid:"Grid-operator connection registers, regulator tender results and the announcements listed on the Grid & DC tab."};
const CAD={equities:"intra",macro:"intra",power:"power",gas:"gas",grid:"daily"};
function brief(v,l,x){const U=window.MMUI;if(!x)return'<div class="hm-brief"><a class="hm-bh" href="#'+v+'"><span class="fd"></span>'+esc(l)+'</a><span class="hm-bm na">loading…</span></div>';
 const P=x.parts.filter(Boolean);const ci=Math.max(1,P.findIndex((t,i)=>i>0&&/ vs |spreads| up \/ |crossed/.test(t)));const main=P[0],cmp=P[ci],rest=P.filter((t,i)=>i!==0&&i!==ci);
 const ts=(x.isos||[]).filter(Boolean).map(d=>new Date(d)).filter(d=>!isNaN(d)).sort((a,b)=>b-a);const iso=ts.length?ts[0].toISOString():null;
 const gen=iso&&U?'Data build '+esc(U.at(iso))+(ts.length>1&&ts[ts.length-1]-ts[0]?' (oldest input '+esc(U.at(ts[ts.length-1].toISOString()))+')':''):"";
 return'<div class="hm-brief"><a class="hm-bh" href="#'+v+'">'+(U&&iso?U.dot(iso,CAD[v],l):'<span class="fd"></span>')+esc(l)+'</a><span class="hm-bm">'+(main||'<span class="na">n/a</span>')+'</span>'+(cmp?'<span class="hm-bc">'+cmp+'</span>':'')+
  '<a class="hm-bo" href="#'+v+'">Open →</a><details class="hm-bmore"><summary>More &amp; sources</summary>'+(rest.length?'<ul>'+rest.map(t=>'<li>'+t+'</li>').join("")+'</ul>':'')+'<p><b>Sources:</b> '+esc(SRC[v]||"")+'</p>'+(gen?'<p>'+gen+'</p>':'')+'</details></div>';}
function todayBlock(){const T=window.MMTable,P=window.MMPower;if(!window.MMToday)return"";
 const L=[["equities","Companies",T&&T.data()?T.todayParts("equities"):null],["macro","Markets",T&&T.data()?T.todayParts("macro"):null],["power","Nordic power",P&&P.todayPower()],["gas","Gas storage",window.MMGas&&MMGas.today()],["grid","Grid & data centres",P&&P.todayGrid()]];
 return L.map(([v,l,x])=>brief(v,l,x)).join("");}
/* last visit (this device): the previous session's time, kept for the whole session */
const PREV=(()=>{try{let p=sessionStorage.getItem("mm:prev");if(p===null){p=localStorage.getItem("mm:last")||"";sessionStorage.setItem("mm:prev",p);}
 const mark=()=>{try{localStorage.setItem("mm:last",new Date().toISOString());}catch(e){}};mark();setInterval(mark,5*60000);return p?Date.parse(p):null;}catch(e){return null;}})();
const fwhen=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
/* What changed: material changes first (new company announcements, new dated grid items); routine data refreshes folded away */
function newBlock(md,pw,gr,D,P){if(!PREV)return'<p class="hm-new-none">First visit on this device: everything below is new. From next time this lists what changed since your last visit.</p>';
 const M=[],R=[],tt=x=>Date.parse(x||""),pl=(n,w)=>n+" "+w+(n===1?"":/sh$/.test(w)?"es":"s"),DL=window.MMDeals;
 if(D&&D.items&&DL){const nw=D.items.filter(it=>tt(it.t)>PREV),vis=DL.visible(nw),maj=vis.filter(it=>DL.sig(it)==="major");
  if(vis.length)M.push(["#equities","Deal flow",pl(vis.length,"new company announcement")+(maj.length?": "+maj.length+" major ("+[...new Set(maj.map(it=>DL.coName(it.s)))].slice(0,3).join(", ")+")":"")]);
  if(nw.length>vis.length)R.push(["#equities","Deal flow",pl(nw.length-vis.length,"commentary or routine item")]);}
 if(P&&gr){const n=P.gridItems(200).filter(x=>tt((x.d||"").slice(0,10)+"T23:59:59Z")>PREV).length;if(n)M.push(["#grid","Grid & data centres",pl(n,"new dated item")]);}
 const G=window.MMGas&&MMGas.data&&MMGas.data();
 [["#macro","Prices",md&&md.generated_utc],["#power","Nordic power data",pw&&pw.generated_utc],["#gas","Gas storage",G&&G.generated_utc&&G.generated_utc.replace(/(T\d\d:\d\d)Z$/,"$1:00Z")],["#grid","Grid & DC build",gr&&gr.generated_utc&&gr.generated_utc.replace(/(T\d\d:\d\d)Z$/,"$1:00Z")]]
  .forEach(([h,a,iso])=>{if(iso&&tt(iso)>PREV)R.push([h,a,"updated "+fwhen.format(new Date(iso))]);});
 const since="since your last visit ("+fwhen.format(new Date(PREV))+")",li=L=>'<ul class="hm-new">'+L.map(([h,a,b])=>'<li><a href="'+h+'"><b>'+esc(a)+'</b> '+esc(b)+'</a></li>').join("")+'</ul>';
 return(M.length?'<p class="hm-new-k">Material changes '+esc(since)+'</p>'+li(M):'<p class="hm-new-none">No material changes '+esc(since)+'.</p>')+
  (R.length?'<details class="hm-new-rt"><summary>New data arrived: '+pl(R.length,"routine refresh")+'</summary>'+li(R)+'</details>':'');}
/* freshness strip (top of Home): one chip per dataset with its age and status; prices also show the quote time */
function freshStrip(md,pw,D,gr){const U=window.MMUI;if(!U)return"";const G=window.MMGas&&MMGas.data&&MMGas.data();
 const L=[["Prices","#macro",md&&md.generated_utc,"intra",md&&U.priceObs(md)],["Nordic power","#power",pw&&pw.generated_utc,"power"],["Gas storage","#gas",G&&G.generated_utc&&G.generated_utc.replace(/(T\d\d:\d\d)Z$/,"$1:00Z"),"gas"],
  ["Deal flow","#equities",D&&D.generated_utc,"power"],["Grid & DC","#grid",gr&&gr.generated_utc&&gr.generated_utc.replace(/(T\d\d:\d\d)Z$/,"$1:00Z"),"daily"]];
 let warn="";const chips=L.map(([l,h,iso,cad,obs])=>{if(!iso)return'<a class="hm-fc" href="'+h+'"><span class="fd"></span><span class="hm-fl">'+esc(l)+'</span><small>loading…</small></a>';const st=U.status(iso,cad);
  if(st==="stale"&&l==="Prices")warn='<p class="hm-fwarn">Prices are '+esc(U.age(iso))+': the latest quotes are from '+esc(obs?U.at(obs):"n/a")+' (fetched '+esc(U.at(iso))+'). The 15-minute price update has not run since.</p>';
  return'<a class="hm-fc hm-f-'+st+'" href="'+h+'" title="'+esc(l+(obs?" · latest quote "+U.at(obs):"")+" · fetched "+U.at(iso)+" · "+U.age(iso))+'">'+U.dot(iso,cad,l)+'<span class="hm-fl">'+esc(l)+'</span><small>'+(obs?'as of '+esc(U.at(obs))+' · ':'')+esc(U.age(iso))+'</small></a>';}).join("");
 const ld=U.loaded();return'<div class="hm-fresh" role="group" aria-label="Data freshness">'+chips+(ld?'<span class="hm-floaded" title="When this page last loaded the saved data (Reload data reloads it)">page loaded '+esc(U.at(ld))+'</span>':'')+'</div>'+warn;}
function render(){const box=$("homeView");if(!box||!shown)return;const R=rows(),T=window.MMTable,P=window.MMPower,D=window.MMDeals&&MMDeals.peek&&MMDeals.peek(),U=window.MMUI;
 const md=T&&T.data(),pd=P&&P.data(),pw=pd&&pd.P,gr=pd&&pd.G;const dot=(i,c,w,f)=>U&&i?U.dot(i,c,w,f):"";
 const gi=P&&gr?P.gridItems(5):[];const di=D&&D.items?MMDeals.visible(D.items).slice().sort((a,b)=>String(b.t).localeCompare(String(a.t))).slice(0,5):null;
 const today=(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",weekday:"long",day:"numeric",month:"long"})).format(new Date());
 box.innerHTML='<div class="hm">'+freshStrip(md,pw,D,gr)+'<section class="hm-sec" id="hmToday" data-sec="hmToday">'+head("hmToday","Today",esc(today))+'<div class="hm-body hm-todays">'+todayBlock()+'</div></section>'+
  '<section class="hm-sec" id="hmPx" data-sec="hmPx">'+head("hmPx","Key prices","last quote · 1D change (yields in bp) · 1Y line",dot(md&&md.generated_utc,"intra","Prices (Yahoo ~15 min delayed; 10Y official closes)"),"#macro","Macro")+
   '<div class="hm-body hm-tiles">'+(R?KEY.map(k=>tile(R.get(k[0]),k)).join(""):'<div class="pw-empty">Loading market data…</div>')+'</div></section>'+
  '<section class="hm-sec" id="hmNew" data-sec="hmNew">'+head("hmNew","What changed","material changes first, then routine refreshes · since your last visit on this device")+'<div class="hm-body">'+newBlock(md,pw,gr,D,P)+'</div></section>'+
  '<section class="hm-sec" id="hmBal" data-sec="hmBal">'+head("hmBal","Nordic balance","nuclear availability · hydro vs normal · system price vs SE4",dot(pw&&((pw.nordpool&&pw.nordpool.asof)||pw.generated_utc),"power","Nord Pool, UMM, hydro"),"#power/pwSecSup","Power")+
   '<div class="hm-body">'+(pw?'<a class="hm-bal" href="#power/pwSecSup"><div class="pw-kpis pw-kpis-bal">'+P.balHtml()+'</div></a>':'<div class="pw-empty">Loading power data…</div>')+'</div></section>'+
  '<div class="hm-two">'+
  '<section class="hm-sec" id="hmDeals" data-sec="hmDeals">'+head("hmDeals","Latest deal flow","5 newest items",dot(D&&D.generated_utc,"power","Deal flow"),"#equities","All deal flow")+
   '<div class="hm-body">'+(di?(di.length?'<ul class="df-list hm-list">'+di.map(it=>MMDeals.itemHtml(it)).join("")+'</ul>':'<div class="pw-empty">No items in the window.</div>'):'<div class="pw-empty">Loading deal flow…</div>')+'</div></section>'+
  '<section class="hm-sec" id="hmGrid" data-sec="hmGrid">'+head("hmGrid","Latest grid & data-centre items","5 newest dated items",dot(gr&&gr.generated_utc&&gr.generated_utc.replace("Z",":00Z"),"daily","Grid & DC build"),"#grid","Grid & DC")+
   '<div class="hm-body">'+(gr?(gi.length?'<ul class="hm-gl">'+gi.map(x=>'<li><span class="hm-gd">'+esc(gd(x.d))+'</span><span class="hm-gk">'+esc(x.k)+'</span><span class="hm-gh">'+(x.u?'<a href="'+esc(x.u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.h)+'</a>':'<a href="#grid/'+x.sub+'">'+esc(x.h)+'</a>')+'</span></li>').join("")+'</ul>':'<div class="pw-empty">No dated items.</div>'):'<div class="pw-empty">Loading grid data…</div>')+'</div></section>'+
  '</div></div>';
 U&&U.apply(box);}
function ask(){if(asked)return;asked=true;if(window.MMGas)MMGas.ensure().then(render).catch(()=>{});const P=window.MMPower;if(P)P.ensure().then(()=>{render();return P.gridReady&&P.gridReady();}).then(render).catch(()=>{});if(window.MMDeals)MMDeals.load().then(render).catch(()=>{});}
window.MMHome={show(){shown=true;ask();render();},hide(){shown=false;},render,reload(){asked=false;ask();}};
})();
