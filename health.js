/* Data health overlay (#health): one row per feed with last update (Geneva time), a fresh/late/stale dot and the
   expected refresh time. Reuses MMUI's freshness rules (same cadences as the dots on each tab) and only existing data:
   in-memory copies when a tab already loaded them, else the first bytes of each data file (its generated_utc stamp). */
(()=>{"use strict";
const U=window.MMUI,esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=s=>!s?null:/T\d\d:\d\dZ$/.test(s)?s.replace("Z",":00Z"):/^\d{4}-\d\d-\d\d$/.test(s)?s+"T12:00:00Z":s;
const head={};
function stamp(p){if(!head[p])head[p]=fetch(p,{headers:{Range:"bytes=0-1023"},cache:"no-cache"}).then(r=>r.ok?r.text():null).then(t=>{const m=t&&t.match(/"generated_(?:utc|at)"\s*:\s*"([^"]+)"/);return m?m[1]:null;}).catch(()=>null);return head[p];}
const full={};
function json(p){if(!full[p])full[p]=fetch(p,{cache:"no-cache"}).then(r=>r.ok?r.json():null).catch(()=>null);return full[p];}
const T=()=>window.MMTable&&MMTable.data&&MMTable.data(),PW=()=>{const d=window.MMPower&&MMPower.data&&MMPower.data();return d&&d.P;},GS=()=>window.MMGas&&MMGas.data&&MMGas.data();
const gd=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
const day=t=>gd.format(new Date(t));
const hm=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const fmtD=d=>new Date(d+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
/* Day-ahead zone: covers today; after the ~12:45 CET auction (checked 12:30/17:30 UTC) it should also cover tomorrow. */
function zoneSt(z){if(!z.ok||!z.last)return"stale";const now=Date.now(),after=hm.format(new Date(now))>="14:00";const want=day(now+(after?864e5:0)),have=day(Date.parse(z.last)-6e4),prev=day(Date.parse(want+"T12:00:00Z")-864e5);return have>=want?"fresh":have>=prev?"late":"stale";}
/* Feed list: [group, label, source, file, cadence, detail(data)->text, pick(data)->iso]. */
const F=[
["Markets","Prices (equities, FX, commodities)","Yahoo, about 15 min delayed","data/market.json","intra",d=>{const o=U.priceObs&&U.priceObs(d);return o?"latest quote "+U.at(o):"";},null,T],
["Markets","10-year yields","US Treasury, Bundesbank, BoE, SNB, CNBC (FR)","data/market.json","daily",d=>{const a=d&&d.yields10&&d.yields10.asof;if(!a)return"";return"latest closes: "+Object.keys(a).filter(k=>a[k]).map(k=>k+" "+fmtD(String(a[k]).slice(0,10))).join(", ");},null,T],
["Markets","News headlines","publisher RSS feeds","data/news.json","news"],
["Markets","Deal flow","company and exchange news","data/dealflow.json","power"],
["Power","Nordic day-ahead prices","Nord Pool","data/power.json","power",null,d=>d&&d.nordpool&&d.nordpool.asof,PW],
["Power","Day-ahead by zone","ENTSO-E Transparency","data/power.json","power","zones",null,PW],
["Power","Futures settlements","EEX","data/power.json","daily","eex",null,PW],
["Power","Nuclear availability","Nord Pool UMM","data/power.json","power",null,d=>d&&d.nuclear&&d.nuclear.asof,PW],
["Power","Nordic dashboard (hourly)","ENTSO-E, NVE, Open-Meteo","data/nordic_dash.json","power"],
["Power","Month to date","ENTSO-E","data/nordic_mtd.json","power"],
["Power","Monthly overview","ENTSO-E","data/nordic_monthly.json","monthly"],
["Gas","EU gas storage","GIE AGSI+","data/gas.json","gas","gas",null,GS],
["Wind, hydro, weather","Nordic hydro reservoirs","NVE, ENTSO-E","data/hydro_nordic.json","weekly","hydro",null,null,"weekly: weekday morning build, skipped while under 6.5 days old"],
["Wind, hydro, weather","Finland wind","Fingrid","data/fi_wind.json","power"],
["Wind, hydro, weather","Precipitation forecast","Open-Meteo","data/nordic_precip.json","power"],
["Other","US valuation","Shiller CAPE, FRED","data/us_valuation.json","monthly"],
["Research","Research snapshot (event returns)","company filings and exchange notices","research/out/chart_events.json","weekly",null,null,null,"after each research update (no fixed schedule)"]];
function zones(P){const s=P&&P.spot&&P.spot.status;if(!s||!s.length)return'<span class="hl-miss">no zone status in feed</span>';return'<span class="hl-zs">'+s.map(z=>{const st=zoneSt(z);return'<span class="hl-z">'+U.dot(z.last?z.last:"","power",z.zone+" day-ahead",st,z.ok?(z.last?"data through "+U.at(z.last):""):"missing from "+z.src)+esc(z.zone)+"</span>";}).join("")+"</span>";}
function eex(P){const e=P&&P.eex;if(!e||!e.asof)return{st:"stale",txt:"missing"};return{st:e.asof>=(e.expected||e.asof)?"fresh":e.lag?"late":"stale",txt:"settlement "+fmtD(e.asof)+(e.expected&&e.asof<e.expected?" (expected "+fmtD(e.expected)+")":"")};}
async function row(f){const[g,label,src,path,cad,det,pick,mem,txtOv]=f;let d=mem&&mem()||null;if(!d&&(det&&det!=="zones"&&det!=="eex"||pick))d=await json(path);
 let t=pick?pick(d):d&&(d.generated_utc||d.generated_at);if(!t)t=await stamp(path);t=iso(t);
 let extra="",force=null,note="";
 if(det==="zones"){d=d||await json(path);extra=zones(d);}
 else if(det==="eex"){d=d||await json(path);const e=eex(d);force=e.st;extra=esc(e.txt);}
 else if(det==="gas"){d=d||await json(path);const l=d&&d.areas&&d.areas.EU&&d.areas.EU.last;extra=l?"latest gas day "+fmtD(String(l).slice(0,10)):"";}
 else if(det==="hydro"){const h=await json(path);const z=h&&h.zones&&(h.zones.NO1||Object.values(h.zones)[0]);extra=z&&z.date?"latest week "+fmtD(String(z.date).slice(0,10)):"";}
 else if(typeof det==="function")extra=esc(det(d)||"");
 const gp=d&&(d.gaps||d.errors||(path==="data/power.json"&&det==="zones"&&d.entsoe&&d.entsoe.errors));const gl=Array.isArray(gp)?gp:gp&&typeof gp==="object"?Object.keys(gp):[];
 if(gl.length)extra+=(extra?'<span class="hl-x">':"")+esc(gl.length+" gap"+(gl.length>1?"s":"")+" reported in the last build")+(extra?"</span>":"");
 if(!t){force="stale";note="missing";}
 if(path==="data/power.json"&&d&&d.entsoe&&d.entsoe.stale&&d.entsoe.stale.length&&det==="zones")note="ENTSO-E queries flagged stale: "+d.entsoe.stale.join(", ");
 const st=force||U.status(t,cad),word=note==="missing"?"missing":st==="fresh"?"fresh":st==="late"?"late":"stale";
 return{g,h:'<tr class="hl-'+word+'"><td class="hl-d">'+U.dot(t||"",cad,label,force,note)+'</td><td><b>'+esc(label)+'</b><span class="hl-src">'+esc(src)+'</span>'+(extra?'<span class="hl-x">'+extra+'</span>':"")+(note&&note!=="missing"?'<span class="hl-x">'+esc(note)+'</span>':"")+'<span class="hl-exp hl-m">expected: '+esc(txtOv||U.cadTxt(cad))+'</span></td><td class="hl-t">'+(t?esc(U.at(t))+'<span class="hl-age">'+esc(U.age(t))+" · "+word+"</span>":'<span class="hl-miss">missing</span>')+'</td><td class="hl-exp hl-w">'+esc(txtOv||U.cadTxt(cad))+"</td></tr>"};}
let box=null,last=null;
function close(){if(!box)return;box.hidden=true;document.body.classList.remove("hl-open");if(location.hash==="#health")history.replaceState(null,"",location.pathname+location.search+(last&&last!=="#health"?last:(()=>{const t=document.querySelector(".main-tab.is-on");return t?"#"+t.dataset.v:"";})()));if(box._ret)try{box._ret.focus();}catch(e){}}
async function open(){if(!box){box=document.createElement("div");box.id="dataHealth";box.className="hl-wrap";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-labelledby","hlTitle");box.innerHTML='<div class="hl-card"><div class="hl-top"><h2 id="hlTitle">Data health</h2><button type="button" class="hl-x-btn" aria-label="Close">×</button></div><p class="hl-lead"><span class="fd fd-fresh"></span>fresh <span class="fd fd-late"></span>late (latest scheduled update not in yet) <span class="fd fd-stale"></span>stale or missing. Times are Geneva time.</p><div id="hlBody" class="hl-body">Checking feeds…</div></div>';document.body.appendChild(box);box.addEventListener("click",e=>{if(e.target===box||e.target.closest(".hl-x-btn"))close();});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!box.hidden)close();});}
 box._ret=document.activeElement;box.hidden=false;document.body.classList.add("hl-open");box.querySelector(".hl-x-btn").focus();
 for(const k in head)delete head[k];for(const k in full)delete full[k];
 const rows=await Promise.all(F.map(f=>row(f).catch(()=>({g:f[0],h:'<tr class="hl-missing"><td class="hl-d">'+U.dot("",f[4],f[1],"stale","missing")+"</td><td><b>"+esc(f[1])+'</b></td><td class="hl-t"><span class="hl-miss">missing</span></td><td class="hl-exp hl-w"></td></tr>'}))));
 const groups=[...new Set(F.map(f=>f[0]))];
 $b().innerHTML=groups.map(g=>'<table class="hl-tbl"><caption>'+esc(g)+'</caption><thead><tr><th class="hl-d"><span class="sr-only">Status</span></th><th>Feed</th><th>Last updated</th><th class="hl-w">Expected refresh</th></tr></thead><tbody>'+rows.filter(r=>r.g===g).map(r=>r.h).join("")+"</tbody></table>").join("")+'<p class="hl-note">Checked '+esc(U.at(new Date().toISOString()))+". Same rules as the dots on each tab.</p>";}
const $b=()=>document.getElementById("hlBody");
window.addEventListener("hashchange",e=>{if(location.hash!=="#health"){if(box&&!box.hidden){box.hidden=true;document.body.classList.remove("hl-open");}}else{try{last=new URL(e.oldURL).hash;}catch(x){}open();}});
window.MMHealth={open,close};
})();
