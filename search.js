"use strict";
/* "Jump to" index: type a word (hydro, SE4, CAPE, tender…) and open the matching section on its tab. */
(function(){
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const T={home:"Home",equities:"Companies",macro:"Markets",power:"Nordic power",grid:"Grid & data centres"};
/* [label, tab, element id, extra keywords] */
const IX=[
["Today","home","hmToday","summary overview"],["Key prices","home","hmPx","quotes brent gold s&p"],["What changed since your last visit","home","hmNew","new updates"],
["Company table","equities","tblWrap","stocks shares equities returns valuation market cap ev volume moving average"],["Compare companies","equities","cmpBtn","compare side by side"],["Deal flow","equities","dfPanel","announcements insider results m&a"],
["Indices","macro","macro-indices","stock index s&p dax omx"],["Commodities","macro","macro-commodities","oil brent gas gold copper metals"],["Rates & FX","macro","macro-rates","currency fx eur chf usd interest"],
["Government bonds: 10-year yields","macro","macro-y10","bund treasury gilt oat spread yield"],["US stock valuations","macro","macro-val","cape shiller pe earnings yield dividend buyback damodaran profits fred"],["Interactive charts","macro","macro-charts","tradingview chart"],
["Last month: Nordic overview","power","pwSecMon","monthly generation mix inflow rain precipitation snow normal report slide"],["Dashboard: last 30 days (Nordic power)","power","pwSecDash","dashboard hourly generation mix price demand load net imports exports flows temperature rain reservoir gas carbon wind forecast scatter spread csv zones se1 se2 se3 se4 no1 no2 no3 no4 no5 dk1 dk2"],["Prices now: day-ahead","power","pwSecSpot","spot day ahead price zone hourly spread capture"],
["Forwards","power","pwSecFw","futures eex curve cal quarter epad premium"],["Supply & weather","power","pwSecSup","nuclear reactor hydro reservoir wind solar fuel carbon gas coal goo certificates system price finland denmark"],
["SE4 focus","power","pwSecSE4","southern sweden wind load demand flows interconnector outage svk generation"],
["Calendar of grid & tender dates","grid","gdSecCal","events deadlines consultation"],["Connection queues (GB, Germany, France)","grid","gdSecQueue","neso register queue notices tso connection uk"],
["Solar tenders","grid","gdSecSol","auction bnetza cre award price"],["Germany solar & battery pipeline","grid","gdSecMastr","mastr marktstammdatenregister bess commissioning"],
["Data centres & site deals","grid","gdSecDC","data center dc powered land site"],["Germany balancing prices","grid","gdSecBlg","fcr afrr regelleistung reserve battery revenue"]];
const fold=s=>String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function find(q){const w=fold(q).split(/\s+/).filter(Boolean);if(!w.length)return[];
 return IX.map(x=>{const hay=fold(x[0]+" "+x[3]+" "+T[x[1]]);const sc=w.every(t=>hay.includes(t))?(fold(x[0]).includes(w[0])?0:1):9;return[sc,x];}).filter(a=>a[0]<9).sort((a,b)=>a[0]-b[0]).slice(0,8).map(a=>a[1]);}
function open(x){const [,tab,id]=x;window.MMNav&&MMNav.go(tab);let n=0;const t=setInterval(()=>{const el=$(id);n++;if(el&&el.offsetParent!==null||n>40){clearInterval(t);if(!el)return;
  if(id==="cmpBtn"){el.click();return;}const nav=$(tab==="power"?"pwSubnav":"subNav");window.MMUI&&MMUI.go(id,nav);}},150);}
function init(){const inp=$("jumpInput"),ul=$("jumpList");if(!inp)return;let cur=[],k=0;
 const draw=()=>{ul.hidden=!cur.length;ul.innerHTML=cur.map((x,i)=>'<li role="option" data-i="'+i+'"'+(i===k?' aria-selected="true" class="on"':"")+'><b>'+esc(x[0])+'</b><span>'+esc(T[x[1]])+'</span></li>').join("");};
 inp.addEventListener("input",()=>{cur=find(inp.value);k=0;draw();});
 inp.addEventListener("keydown",e=>{if(e.key==="ArrowDown"){k=Math.min(cur.length-1,k+1);draw();e.preventDefault();}else if(e.key==="ArrowUp"){k=Math.max(0,k-1);draw();e.preventDefault();}
  else if(e.key==="Enter"&&cur[k]){open(cur[k]);inp.value="";cur=[];draw();inp.blur();}else if(e.key==="Escape"){inp.value="";cur=[];draw();inp.blur();}});
 ul.addEventListener("mousedown",e=>{const li=e.target.closest("li");if(!li)return;e.preventDefault();open(cur[+li.dataset.i]);inp.value="";cur=[];draw();});
 inp.addEventListener("blur",()=>setTimeout(()=>{ul.hidden=true;},150));}
window.MMJump={find,open};init();
})();
