"use strict";
/* "Jump to" index: type a word (hydro, SE4, CAPE, tender…) and open the matching section on its tab. */
(function(){
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const T={home:"Home",equities:"Companies",macro:"Markets",power:"Nordic power",gas:"Gas storage",grid:"Grid & data centres",oilgas:"Oil & gas",mining:"Mining"};
/* [label, tab, element id, extra keywords, optional profile symbol] */
const IX=[
["European gas storage","gas","gsSecOv","gas storage agsi gie fill eu injection withdrawal winter 90% target germany italy france netherlands austria twh"],["Gas storage by country","gas","gsSecTbl","gas storage country table germany italy france netherlands austria belgium spain poland czechia denmark sweden hungary slovakia ukraine"],
["What changed","home","hmMoves","home moves outside normal range brent ttf gold nordic wind storage"],
["Renewables table","power","pwCos","stocks shares equities renewables orron returns valuation market cap ev volume moving average"],["Oil and gas companies","oilgas","ogCos","stocks shares oil gas e&p tiles"],["Oil and gas price table","oilgas","ogTable","majors shell bp exxon volume moving average"],["Metals and mining table","mining","mnTable","bhp rio gold copper miners"],
["Lundin companies","mining","mnLundin","lundin group section tiles"],
["Lundin Mining","mining","mn-lundin-mining","lumi lumi.st lundin copper","LUMI.ST"],
["Lundin Gold","mining","mn-lundin-gold","lug lug.st lundin gold","LUG.ST"],
["NGEx Minerals","mining","mn-ngex-minerals","ngex lundin"],
["Lucara Diamond","mining","mn-lucara-diamond","luc luc.st lundin diamond karowe","LUC.ST"],
["Montage Gold","mining","mn-montage-gold","montage mau lundin"],
["LunR Royalties","mining","mn-lunr-royalties","lunr lundin royalties"],["Deal flow","oilgas","ogFeed","announcements insider results m&a"],["Brent curve","oilgas","ogCurves","futures brent heating oil forward"],["TTF curve","gas","gsSecPx","ttf gas futures curve"],["Power curve","power","pwCurve","nordic system futures eex forward"],
["Indices","macro","macro-indices","stock index s&p dax omx"],["Commodities","macro","macro-commodities","oil brent gas gold copper metals"],["Rates & FX","macro","macro-rates","currency fx eur chf usd interest"],
["Government bonds: 10-year yields","macro","macro-y10","bund treasury gilt oat spread yield"],["US stock valuations","macro","macro-val","cape shiller pe earnings yield dividend buyback damodaran profits fred"],["Interactive charts","macro","macro-charts","tradingview chart"],
["Prices & drivers: latest day-ahead price with wind, demand, nuclear, hydro, gas","power","pwSecWhy","drivers why price moved day ahead wind forecast demand load nuclear availability reservoirs hydro gas ttf carbon eua spread"],["Month to date: Nordic wind, hydro, demand, nuclear, prices, weather","power","pwSecMtd","mtd month to date last month seasonal wind hydro demand load nuclear price weather rain temperature twh"],["Monthly charts: Nordic overview","power","pwSecMon","monthly generation mix inflow rain precipitation snow normal report slide"],["Dashboard: last 30 days (Nordic power)","power","pwSecDash","dashboard hourly generation mix price demand load net imports exports flows temperature rain reservoir gas carbon wind forecast scatter spread csv zones se1 se2 se3 se4 no1 no2 no3 no4 no5 dk1 dk2"],["Prices: day-ahead and history","power","pwSecSpot","spot day ahead price zone hourly spread capture system sys history yearly quarterly moving average table"],
["Forwards","power","pwSecFw","futures eex curve cal quarter epad premium"],["Hydro reservoirs","power","pwSecHyd","hydro reservoir storage normal filling nve water"],["Nuclear, wind and solar","power","pwSecSup","nuclear reactor umm wind solar forecast finland denmark fingrid energinet"],["Fuels and carbon","power","pwSecDrv","fuel carbon gas ttf coal api2 eua goo certificates german power"],
["SE4 focus","power","pwSecSE4","southern sweden wind load demand flows interconnector outage svk generation"],
["Calendar of grid & tender dates","grid","gdSecCal","events deadlines consultation"],["UK & Germany project pipeline","grid","gdSecPipe","projects pipeline repd neso mastr data centre planning consent developer mw stage"],["Connection queues (GB, Germany, France)","grid","gdSecQueue","neso register queue notices tso connection uk"],
["Solar tenders","grid","gdSecSol","auction bnetza cre award price"],["Germany solar & battery pipeline","grid","gdSecMastr","mastr marktstammdatenregister bess commissioning"],
["Data centres & site deals","grid","gdSecDC","data center dc powered land site"],["Germany balancing prices","grid","gdSecBlg","fcr afrr regelleistung reserve battery revenue"]];
const fold=s=>String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function find(q){const w=fold(q).split(/\s+/).filter(Boolean);if(!w.length)return[];
 return IX.map(x=>{const label=fold(x[0]),hay=fold(x[0]+" "+(x[3]||"")+" "+T[x[1]]);if(!w.every(t=>hay.includes(t)))return[9,x];
  const exact=label===w.join(" ")?0:1,inLabel=w.every(t=>label.includes(t))?0:1,head=label.includes(w[0])?0:1;return[exact+inLabel+head,x];}).filter(a=>a[0]<9).sort((a,b)=>a[0]-b[0]).slice(0,8).map(a=>a[1]);}
function profile(sym){if(sym&&window.MMCompany&&MMCompany.open)MMCompany.open(sym);}
function mark(el){if(!el||!el.classList)return;if(document.querySelectorAll)document.querySelectorAll(".v2co-tile.is-jump").forEach(n=>n.classList.remove("is-jump"));el.classList.add("is-jump");}
function open(x){const [,tab,id,,sym]=x;window.MMNav&&MMNav.go(tab);let n=0;const t=setInterval(()=>{const el=$(id);n++;if(el&&el.offsetParent!==null||n>60){clearInterval(t);
  const nav=$(tab==="power"&&window.EMMI_PARKED_POWER?"pwSubnav":"subNav");
  if(!el){const sec=String(id).indexOf("mn-")===0?$("mnLundin"):null;if(sec&&window.MMUI)MMUI.go("mnLundin",nav);profile(sym);return;}
  if(id==="cmpBtn"){el.click();return;}if(String(id).indexOf("mn-")===0)mark(el);window.MMUI&&MMUI.go(id,nav);profile(sym);}},150);}
function init(){const inp=$("jumpInput"),ul=$("jumpList");if(!inp)return;let cur=[],k=0;
 const draw=()=>{ul.hidden=!cur.length;ul.innerHTML=cur.map((x,i)=>'<li role="option" data-i="'+i+'"'+(i===k?' aria-selected="true" class="on"':"")+'><b>'+esc(x[0])+'</b><span>'+esc(T[x[1]])+'</span></li>').join("");};
 inp.addEventListener("input",()=>{cur=find(inp.value);k=0;draw();});
 inp.addEventListener("keydown",e=>{if(e.key==="ArrowDown"){k=Math.min(cur.length-1,k+1);draw();e.preventDefault();}else if(e.key==="ArrowUp"){k=Math.max(0,k-1);draw();e.preventDefault();}
  else if(e.key==="Enter"&&cur[k]){open(cur[k]);inp.value="";cur=[];draw();inp.blur();}else if(e.key==="Escape"){inp.value="";cur=[];draw();inp.blur();}});
 ul.addEventListener("mousedown",e=>{const li=e.target.closest("li");if(!li)return;e.preventDefault();open(cur[+li.dataset.i]);inp.value="";cur=[];draw();});
 inp.addEventListener("blur",()=>setTimeout(()=>{ul.hidden=true;},150));}
window.MMJump={find,open};init();
})();
