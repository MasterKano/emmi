/* Shared UI helpers: freshness dots, collapsible sections, "How to read" panels, generic sticky sub-nav.
   State (collapsed sections, open explainers) is kept in localStorage; explainers are closed by default. */
(()=>{"use strict";
const LS="markets-monitor:ui:v1",TZ="Europe/Zurich";
const S=(()=>{try{return Object.assign({c:{},d:{},o:{}},JSON.parse(localStorage.getItem(LS)||"{}"));}catch(e){return{c:{},d:{},o:{}};}})();
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const ftz=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,timeZoneName:"short"});
function tzName(d){const p=ftz.formatToParts(d).find(x=>x.type==="timeZoneName");const v=p?p.value:"";return v==="CET"||v==="CEST"?v:/\+0?2/.test(v)?"CEST":"CET";}
const when=d=>fmt.format(d).replace("Sept","Sep").replace(","," ·")+" "+tzName(d);
/* ---------- freshness: compare the as-of time with the latest scheduled build (UTC schedules of the GitHub workflows) ---------- */
const WD=d=>{const x=d.getUTCDay();return x>0&&x<6;};
const CAD={
 intra:{txt:"every 15 min in market hours (weekdays 05–22 UTC)",delay:20,slots:d=>WD(d)?[...Array(17)].flatMap((_,i)=>[7,22,37,52].map(m=>[5+i,m])):[]},
 power:{txt:"05:30 (weekdays), 12:30 and 17:30 UTC",delay:30,slots:d=>(WD(d)?[[5,30]]:[]).concat([[12,30],[17,30]])},
 news:{txt:"05:30 and 21:00 UTC on weekdays",delay:30,slots:d=>WD(d)?[[5,30],[21,0]]:[]},
 gas:{txt:"daily: AGSI+ publishes ~18:00 CET; checked 05:30 (weekdays), 12:30 and 17:30 UTC",delay:30,slots:d=>(WD(d)?[[5,30]]:[]).concat([[12,30],[17,30]])},
 daily:{txt:"once a day, 05:30 UTC on weekdays",delay:45,slots:d=>WD(d)?[[5,30]]:[]},
 weekly:{txt:"once a week (weekday morning build)",age:[8,15],slots:()=>[]},
 monthly:{txt:"once a month (sources publish monthly or quarterly)",age:[40,70],slots:()=>[]},
};
function lastSlots(c,now,n){const out=[];const lim=now-c.delay*6e4;for(let k=0;k<10&&out.length<n;k++){const d=new Date(Date.UTC(new Date(lim).getUTCFullYear(),new Date(lim).getUTCMonth(),new Date(lim).getUTCDate()-k));
 const ts=c.slots(d).map(([h,m])=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),h,m)).filter(t=>t<=lim).sort((a,b)=>b-a);out.push(...ts);}return out.slice(0,n);}
function status(iso,cad,now){const t=Date.parse(iso);if(!isFinite(t))return"stale";const c=CAD[cad]||CAD.daily;if(c.age){const a=((now||Date.now())-t)/864e5;return a<c.age[0]?"fresh":a<c.age[1]?"late":"stale";}const L=lastSlots(c,now||Date.now(),2);
 if(!L.length||t>=L[0]-5*6e4)return"fresh";if(t>=L[1]-5*6e4)return"late";return"stale";}
const SL={fresh:"Fresh",late:"Late: the latest scheduled update is missing",stale:"Stale: two or more scheduled updates are missing"};
function dotTitle(iso,cad,what,st,forced){const t=Date.parse(iso);return(what?what+" · ":"")+(isFinite(t)?"as of "+when(new Date(t)):"as-of time n/a")+" · updates "+(CAD[cad]||CAD.daily).txt+" · "+(forced?{fresh:"Fresh",late:"Late",stale:"Stale"}[st]:SL[st]);}
/* dot(iso, cadence, what[, forced status, extra note]) -> HTML; refreshed every minute */
function dot(iso,cad,what,force,note){const st=force||status(iso,cad);return'<span class="fd fd-'+st+'" role="img" tabindex="0" data-t="'+esc(iso||"")+'" data-c="'+esc(cad)+'" data-w="'+esc(what||"")+'"'+(force?' data-f="'+force+'"':"")+(note?' data-n="'+esc(note)+'"':"")+' aria-label="'+esc(dotTitle(iso,cad,what,st,!!force)+(note?" · "+note:""))+'" title="'+esc(dotTitle(iso,cad,what,st,!!force)+(note?" · "+note:""))+'"></span>';}
function refresh(){setTimeout(()=>staleNotes(),0);document.querySelectorAll(".fd[data-c]").forEach(el=>{const st=el.dataset.f||status(el.dataset.t,el.dataset.c);el.className="fd fd-"+st;const t=dotTitle(el.dataset.t,el.dataset.c,el.dataset.w,st,!!el.dataset.f)+(el.dataset.n?" · "+el.dataset.n:"");el.title=t;el.setAttribute("aria-label",t);});}
setInterval(refresh,60000);
/* ---------- collapsible sections: [data-sec=id] with a .sec-h header child ---------- */
function setColl(sec,on){sec.classList.toggle("is-collapsed",on);const h=sec.querySelector(":scope > .sec-h");if(h)h.setAttribute("aria-expanded",String(!on));}
/* collapsed by default except the first section of each tab (and Home); the user's own open/close choice is remembered */
const OPEN0=new Set(["hmToday","hmPx","hmBal","hmDeals","hmGrid","hmNew","mac-indices","pwMtd","pwSpot","pwFw","pwHyd","pwSup","pwDrv","pwSE4","gdCal","gsOv","gsTbl"]);
const isColl=id=>S.c[id]?true:S.o&&S.o[id]?false:!OPEN0.has(id);
function apply(root){const L=[...(root||document).querySelectorAll("[data-sec]")];if(root&&root.matches&&root.matches("[data-sec]"))L.unshift(root);L.forEach(s=>{setColl(s,isColl(s.dataset.sec));blurb(s);setTimeout(()=>staleNotes(s.parentElement),0);const h=s.querySelector(":scope > .sec-h");if(h&&!h.hasAttribute("tabindex")){h.tabIndex=0;h.setAttribute("role","button");}});
 (root||document).querySelectorAll("details.explain[id]").forEach(d=>{d.open=!!S.d[d.id];});}
function toggleFrom(h){const s=h.parentElement;if(!s||!s.dataset.sec)return;const on=!s.classList.contains("is-collapsed");setColl(s,on);S.o=S.o||{};if(on){S.c[s.dataset.sec]=1;delete S.o[s.dataset.sec];}else{delete S.c[s.dataset.sec];S.o[s.dataset.sec]=1;}save();
 if(!on)expanded(s);}
function expanded(s){requestAnimationFrame(()=>{dispatchEvent(new CustomEvent("mm:expand",{detail:s.dataset.sec}));dispatchEvent(new Event("resize"));});}
document.addEventListener("click",e=>{const h=e.target.closest(".sec-h");if(!h||e.target.closest("a,button,input,select,.fd,.seg"))return;toggleFrom(h);});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("sec-h")){e.preventDefault();toggleFrom(e.target);}});
document.addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches("details.explain[id]")){if(d.open)S.d[d.id]=1;else delete S.d[d.id];save();}},true);
/* stale-data note: a section whose header dot is stale says so in words at the top */
function staleNotes(root){const L=[...(root||document).querySelectorAll("[data-sec]")];L.forEach(s=>{const h=s.querySelector(":scope > .sec-h");const d=h&&h.querySelector(".fd-stale");let n=s.querySelector(":scope > .sec-stale");
 if(!d){if(n)n.remove();return;}const t=Date.parse(d.dataset.t||"");const txt="Older data: last updated "+(isFinite(t)?when(new Date(t)):"at an unknown time")+"; the scheduled update is overdue, so figures may be out of date.";
 if(!n){n=document.createElement("p");n.className="sec-stale";(s.querySelector(":scope > .sec-blurb")||h).after(n);}if(n.textContent!==txt)n.textContent=txt;});}
/* phones: wide tables become stacked cards (label: value per row) */
const NARROW=matchMedia("(max-width:600px)");
function stackTables(){document.querySelectorAll(".pw-tbl-wrap > table:not(.pw-fw), .tbl-wrap.macro-wrap > table").forEach(tb=>{
 if(!NARROW.matches){tb.classList.remove("stk");return;}if(tb.offsetParent===null)return;
 const wide=tb.classList.contains("stk")||tb.scrollWidth>tb.parentElement.clientWidth+4;if(!wide)return;
 const hr=tb.tHead&&tb.tHead.rows.length?tb.tHead.rows[tb.tHead.rows.length-1]:null;if(!hr)return;const labs=[...hr.cells].map(c=>c.textContent.trim());
 [...tb.tBodies].forEach(b=>[...b.rows].forEach(r=>{let i=0;[...r.cells].forEach(c=>{if(!c.hasAttribute("data-l"))c.setAttribute("data-l",labs[i]||"");i+=c.colSpan||1;});}));tb.classList.add("stk");});}
let stT=0;const stackSoon=()=>{clearTimeout(stT);stT=setTimeout(stackTables,250);};
new MutationObserver(()=>{if(NARROW.matches)stackSoon();}).observe(document.documentElement,{childList:true,subtree:true});
NARROW.addEventListener("change",stackSoon);addEventListener("mm:expand",stackSoon);
/* one-line "what this is" under every section heading (shown even when collapsed) */
const BLURB={hmToday:"One line per area with today's key facts. Click a line to open that tab.",hmPx:"Latest price and 1-day move for the main markets, with a 1-year line.",hmBal:"Nordic nuclear, hydro and system price at a glance.",hmDeals:"The newest company announcements from the deal-flow feed.",hmGrid:"The newest dated grid and data-centre items.",hmNew:"Sections with new data since your last visit.",
deals:"Company announcements (deals, financing, results) from exchange feeds and press wires. Media commentary and routine filings are hidden unless you switch them on.",news:"Recent headlines for this tab. Links open the publisher.",
"mac-indices":"Main stock indices: last level, daily and longer-term moves.","mac-commodities":"Oil, gas, metals and other commodity prices.","mac-rates":"Interest rates and currency pairs.","mac-y10":"10-year government bond yields and their gap to Germany.","mac-val":"Is the US stock market cheap or expensive vs its own history? CAPE, yields and profits.","mac-charts":"Interactive price charts for a few key markets (loaded when opened).",
pwMtd:"This month so far vs last month for wind, hydro, demand, nuclear, prices and weather. Switch to last month or a Jan–Dec view vs 10 years (power) and 50 years (weather).",pwHist:"Longer price history: system and area 30-day average, yearly and quarterly averages with futures, and monthly prices by zone.",pwCmp:"Quarterly actual and futures prices now vs a month ago.",pwHyd:"How much water is stored in Nordic reservoirs vs normal, by week, area and zone.",pwFiW:"Finnish wind output vs forecast every 15 minutes (Fingrid).",pwDrv:"Gas, coal, carbon, certificates and German power: latest settlements and monthly averages.",pwFund:"Pick any month: generation, net exports and weather vs the last 10 or 50 years.",pwMon:"What drove Nordic power last month: generation mix, hydro inflow, rain and monthly prices. Built for report slides.",pwDash:"Interactive last 30 days, hour by hour: what was generated, prices, demand, imports, weather, reservoirs, gas and carbon, for the Nordics, each country or zone.",pwSpot:"Today's and tomorrow's day-ahead prices by zone and hour, the Nordic system price, spreads and what wind and solar earned. Price history opens below.",pwFw:"Futures prices for coming months, quarters and years, and zone premiums vs the Nordic system price.",pwSup:"Nuclear availability for the next two weeks and wind and solar output vs forecast in Denmark and Finland.",pwSE4:"Southern Sweden in detail: wind, demand, cross-border flows and outages.",pwBlg:"German balancing-reserve auction prices (FCR and aFRR), a revenue source for batteries.",
gdCal:"Upcoming official dates: grid connection rounds, tenders and consultations in Germany, the UK and France.",gdUK:"Great Britain's grid connection queue: what is new or changed and what connects next.",gdSol:"Solar auction results in Germany and France: prices and volumes per round.",gdBess:"Published battery build-cost benchmarks.",gdMastr:"New solar and battery projects registered in Germany, by month and state.",gdDEFR:"Grid operators' connection notices in Germany and France's renewable connection queue.",gdDC:"Announced data centres with a stated power need, plus data-centre deal-flow items.",gdLand:"Logged deals for powered land and data-centre sites, with sources.",gdQueue:"Grid connection queues and notices by country.",gsOv:"How full Europe's gas storage is today vs last year and the last five years. Click a country, switch the measure, or click a day on the chart.",gsTbl:"Every country with storage: fill level, recent change and gap to normal. Click a row to chart it.",gdDCAll:"Data-centre announcements and site deals."};
function blurb(s){const id=s.dataset.sec,b=BLURB[id];if(!b)return;const h=s.querySelector(":scope > .sec-h");if(!h||s.querySelector(":scope > .sec-blurb"))return;const p=document.createElement("p");p.className="sec-blurb";p.textContent=b;h.after(p);}
/* ---------- generic sticky sub-nav with scroll spy ---------- */
let NAVI=null;
function subnav(el,items){if(!el)return;NAVI={el,items};el.innerHTML=items.map(([id,l])=>'<a href="#'+id+'" class="pw-nav-a" data-t="'+id+'">'+esc(l)+'</a>').join("");
 el.querySelectorAll("a").forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.t,el);});spy();}
function go(id,el){const t=document.getElementById(id);if(!t)return;const s=t.closest("[data-sec]");if(s&&s.classList.contains("is-collapsed")){setColl(s,false);delete S.c[s.dataset.sec];S.o=S.o||{};S.o[s.dataset.sec]=1;save();expanded(s);}
 const y=t.getBoundingClientRect().top+scrollY-((el&&el.offsetHeight)||0)-12;scrollTo({top:Math.max(0,y),behavior:"smooth"});}
function spy(){if(!NAVI||!NAVI.el.offsetParent)return;const lim=NAVI.el.offsetHeight+40;let cur=NAVI.items[0]&&NAVI.items[0][0];
 NAVI.items.forEach(([id])=>{const t=document.getElementById(id);if(t&&t.offsetParent&&t.getBoundingClientRect().top<=lim)cur=id;});
 if(innerHeight+scrollY>=document.documentElement.scrollHeight-4&&NAVI.items.length)cur=NAVI.items[NAVI.items.length-1][0];
 NAVI.el.querySelectorAll("a").forEach(a=>{const on=a.dataset.t===cur;a.classList.toggle("is-on",on);if(on)a.setAttribute("aria-current","true");else a.removeAttribute("aria-current");});}
let raf=0;addEventListener("scroll",()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;spy();});},{passive:true});
/* ---------- times: observation (price as-of) vs fetch (data build) vs page load ---------- */
const fhm=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false}),fdk=new Intl.DateTimeFormat("en-CA",{timeZone:TZ}),fdm=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short"});
/* "14:05 CET" today, else "Mon 26 Oct 14:05 CET" */
function at(iso){const d=new Date(iso);if(isNaN(d))return"n/a";return(fdk.format(d)!==fdk.format(new Date())?fdm.format(d).replace("Sept","Sep")+" ":"")+fhm.format(d)+" "+tzName(d);}
function age(iso){const m=(Date.now()-Date.parse(iso))/6e4;if(!isFinite(m))return"age n/a";if(m<1.5)return"just now";if(m<90)return Math.round(m)+" min old";if(m<48*60)return Math.round(m/60)+" h old";return Math.round(m/1440)+" days old";}
/* latest quote time across a market.json (rows' market_time; official yield closes excluded) */
function priceObs(D){let best=null;(D&&D.groups||[]).forEach(g=>g.sections.forEach(s=>s.rows.forEach(r=>{if(r.error||r.official||!r.market_time)return;const t=Date.parse(r.market_time);if(isFinite(t)&&(!best||t>best))best=t;})));return best?new Date(best).toISOString():null;}
const MARK={loaded:null};
window.MMUI={dot,refresh,status,when,apply,subnav,spy,go,tzName,at,age,priceObs,loaded:()=>MARK.loaded,markLoaded(){MARK.loaded=new Date().toISOString();}};
})();
