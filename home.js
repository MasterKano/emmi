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
function todayBlock(){const T=window.MMTable,P=window.MMPower,Td=window.MMToday;if(!Td)return"";
 const L=[["equities","Companies",T&&T.data()?T.todayParts("equities"):null],["macro","Markets",T&&T.data()?T.todayParts("macro"):null],["power","Nordic power",P&&P.todayPower()],["gas","Gas storage",window.MMGas&&MMGas.today()],["grid","Grid & data centres",P&&P.todayGrid()]];
 return L.map(([v,l,x])=>'<a class="hm-today" href="#'+v+'"><p class="today-line">'+(x?Td.html(x.parts,x.isos,esc(l)):'<span class="td-h">'+esc(l)+'</span><span class="td-p na">loading…</span>')+'</p></a>').join("");}
/* last visit (this device): the previous session's time, kept for the whole session */
const PREV=(()=>{try{let p=sessionStorage.getItem("mm:prev");if(p===null){p=localStorage.getItem("mm:last")||"";sessionStorage.setItem("mm:prev",p);}
 const mark=()=>{try{localStorage.setItem("mm:last",new Date().toISOString());}catch(e){}};mark();setInterval(mark,5*60000);return p?Date.parse(p):null;}catch(e){return null;}})();
const fwhen=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
function newBlock(md,pw,gr,D,P){if(!PREV)return'<p class="hm-new-none">First visit on this device: everything below is new. From next time this lists what changed since your last visit.</p>';
 const L=[],tt=x=>Date.parse(x||"");
 if(D&&D.items){const n=D.items.filter(it=>tt(it.t)>PREV).length;if(n)L.push(['#equities/'+'',"Deal flow",n+" new announcement"+(n>1?"s":"")]);}
 if(P&&gr){const n=P.gridItems(200).filter(x=>tt((x.d||"").slice(0,10)+"T23:59:59Z")>PREV).length;if(n)L.push(["#grid","Grid & data centres",n+" new dated item"+(n>1?"s":"")]);}
 if(md&&tt(md.generated_utc)>PREV)L.push(["#macro","Prices","updated "+fwhen.format(new Date(md.generated_utc))]);
 if(pw&&tt(pw.generated_utc)>PREV)L.push(["#power","Nordic power data","updated "+fwhen.format(new Date(pw.generated_utc))]);
 const since="since your last visit ("+fwhen.format(new Date(PREV))+")";
 return L.length?'<ul class="hm-new">'+L.map(([h,a,b])=>'<li><a href="'+h+'"><b>'+esc(a)+'</b> '+esc(b)+'</a></li>').join("")+'</ul><p class="hm-new-none">'+esc(since)+'</p>':'<p class="hm-new-none">Nothing new '+esc(since)+'.</p>';}
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
 const gi=P&&gr?P.gridItems(5):[];const di=D&&D.items?D.items.slice().sort((a,b)=>String(b.t).localeCompare(String(a.t))).slice(0,5):null;
 const today=(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",weekday:"long",day:"numeric",month:"long"})).format(new Date());
 box.innerHTML='<div class="hm">'+freshStrip(md,pw,D,gr)+'<section class="hm-sec" id="hmToday" data-sec="hmToday">'+head("hmToday","Today",esc(today)+" · one line per tab, facts only · click a line to open its tab")+'<div class="hm-body hm-todays">'+todayBlock()+'</div></section>'+
  '<section class="hm-sec" id="hmPx" data-sec="hmPx">'+head("hmPx","Key prices","last quote · 1D change (yields in bp) · 1Y line",dot(md&&md.generated_utc,"intra","Prices (Yahoo ~15 min delayed; 10Y official closes)"),"#macro","Macro")+
   '<div class="hm-body hm-tiles">'+(R?KEY.map(k=>tile(R.get(k[0]),k)).join(""):'<div class="pw-empty">Loading market data…</div>')+'</div></section>'+
  '<section class="hm-sec" id="hmNew" data-sec="hmNew">'+head("hmNew","What changed","since your last visit on this device")+'<div class="hm-body">'+newBlock(md,pw,gr,D,P)+'</div></section>'+
  '<section class="hm-sec" id="hmBal" data-sec="hmBal">'+head("hmBal","Nordic balance","nuclear availability · hydro vs normal · system price vs SE4",dot(pw&&((pw.nordpool&&pw.nordpool.asof)||pw.generated_utc),"power","Nord Pool, UMM, hydro"),"#power/pwSecSup","Power")+
   '<div class="hm-body">'+(pw?'<a class="hm-bal" href="#power/pwSecSup"><div class="pw-kpis pw-kpis-bal">'+P.balHtml()+'</div></a>':'<div class="pw-empty">Loading power data…</div>')+'</div></section>'+
  '<div class="hm-two">'+
  '<section class="hm-sec" id="hmDeals" data-sec="hmDeals">'+head("hmDeals","Latest deal flow","5 newest items",dot(D&&D.generated_utc,"power","Deal flow"),"#equities","All deal flow")+
   '<div class="hm-body">'+(di?(di.length?'<ul class="df-list hm-list">'+di.map(it=>MMDeals.itemHtml(it)).join("")+'</ul>':'<div class="pw-empty">No items in the window.</div>'):'<div class="pw-empty">Loading deal flow…</div>')+'</div></section>'+
  '<section class="hm-sec" id="hmGrid" data-sec="hmGrid">'+head("hmGrid","Latest grid & data-centre items","5 newest dated items",dot(gr&&gr.generated_utc&&gr.generated_utc.replace("Z",":00Z"),"daily","Grid & DC build"),"#grid","Grid & DC")+
   '<div class="hm-body">'+(gr?(gi.length?'<ul class="hm-gl">'+gi.map(x=>'<li><span class="hm-gd">'+esc(gd(x.d))+'</span><span class="hm-gk">'+esc(x.k)+'</span><span class="hm-gh">'+(x.u?'<a href="'+esc(x.u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.h)+'</a>':'<a href="#grid/'+x.sub+'">'+esc(x.h)+'</a>')+'</span></li>').join("")+'</ul>':'<div class="pw-empty">No dated items.</div>'):'<div class="pw-empty">Loading grid data…</div>')+'</div></section>'+
  '</div></div>';
 U&&U.apply(box);}
function ask(){if(asked)return;asked=true;if(window.MMGas)MMGas.ensure().then(render).catch(()=>{});const P=window.MMPower;if(P)P.ensure().then(render).catch(()=>{});if(window.MMDeals)MMDeals.load().then(render).catch(()=>{});}
window.MMHome={show(){shown=true;ask();render();},hide(){shown=false;},render,reload(){asked=false;ask();}};
})();
