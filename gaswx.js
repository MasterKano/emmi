/* Gas tab: "NW Europe temperature & HDD" panel. Latest ECMWF IFS 00z/12z run vs the run 12 h before vs normal, days
   1-14, from data/ttf_weather.json (scripts/build_ttf_weather.py, workflow ttf-weather.yml: ECMWF via Open-Meteo,
   population-weighted 10 cities, ERA5 1991-2020 normal). Same card format as the Nordic month-to-date panel. */
(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const fx=(v,d)=>isNum(v)?v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):"n/a";
const sg=(v,d)=>isNum(v)?(v>0?"+":v<0?"−":"±")+fx(Math.abs(v),d):"n/a";
const COL={l:"#e8833a",p:"#e8833a",n:"#8b93a3"};
const WIN=[["d1_7","Days 1–7"],["d8_14","Days 8–14"],["d1_14","Days 1–14"]];
let D=null,tried=false,busy=null;
const run=t=>t&&window.MMUI?MMUI.when(new Date(Date.parse(t))):esc(t||"");
const dd=d=>new Date(d+"T12:00:00Z").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"});
const dshort=d=>new Date(d+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
function pill(v,unit,big){if(!isNum(v))return'<span class="md-pill na">n/a</span>';const c=v>0?"up":v<0?"dn":"na";return'<span class="md-pill '+c+(big?" big":"")+'" title="'+(v>0?"colder: more heating demand":v<0?"milder: less heating demand":"unchanged")+'">'+(v>0?"▲ colder":v<0?"▼ milder":"unchanged")+'</span>';}
const cl=v=>isNum(v)?v>0?"up":v<0?"dn":"":"";
function load(){if(busy)return busy;busy=fetch("data/ttf_weather.json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();})
 .then(j=>{D=j;}).catch(e=>console.warn("ttf weather",e)).then(()=>{tried=true;busy=null;draw();});return busy;}
function shell(){return'<section class="pw-sec" id="gsSecWx" data-sec="gsWx"><h2 class="pw-h sec-h">NW Europe temperature for gas <span class="pw-sub">heating degree days · ECMWF 15-day · latest run vs previous run vs normal</span><span class="sec-dot" id="gwDot"></span></h2><div id="gwBody"><div class="pw-empty pw-loading">Loading the temperature forecast…</div></div></section>';}
function draw(){const box=$("gwBody");if(!box)return;
 if(!D){box.innerHTML='<div class="pw-empty">'+(tried?"Temperature forecast not available yet: the first twice-daily update has not been published.":"Loading the temperature forecast…")+'</div>';return;}
 const W=D.windows||{},T=W.d1_14||{},days=D.days||[],n=days.length;
 if($("gwDot")&&window.MMUI)$("gwDot").innerHTML=MMUI.dot(D.generated_utc,"wx","NW Europe temperature (ECMWF via Open-Meteo)",null,"ECMWF run "+run(D.run_utc));
 const rows=WIN.map(([k,l])=>{const w=W[k]||{};return'<tr><th class="c-z">'+l+'</th><td>'+fx(w.hdd,1)+'</td><td class="'+cl(w.d_prev)+'">'+sg(w.d_prev,1)+'</td><td class="'+cl(w.d_norm)+'">'+sg(w.d_norm,1)+'</td><td class="'+cl(w.twh_vs_prev)+'">'+sg(w.twh_vs_prev,1)+'</td></tr>';}).join("");
 const span=n?dshort(days[0].date)+"–"+dshort(days[n-1].date):"";
 box.innerHTML='<section class="pw-card md-card gw-card" style="--mc:'+COL.l+'">'+
  '<div class="md-h"><span class="md-name" style="color:'+COL.l+'">HDD · NW Europe</span><span class="md-sub">ECMWF (via Open-Meteo) · run '+run(D.run_utc)+' vs '+run(D.prev_run_utc)+'</span></div>'+
  '<div class="md-body"><div class="md-side">'+
   '<div class="gw-tiles"><div class="gw-tile"><span class="gw-tl">HDD change vs previous run · days 1–14</span><div class="md-big"><b>'+sg(T.d_prev,1)+'</b><span class="md-u">HDD</span>'+pill(T.d_prev,"",1)+'</div><span class="gw-ts">'+fx(T.hdd,1)+' HDD now vs '+fx(T.hdd_prev,1)+' previous run · normal '+fx(T.hdd_norm,1)+' ('+sg(T.d_norm,1)+')</span></div>'+
   '<div class="gw-tile"><span class="gw-tl">EU gas demand vs previous run · days 1–14</span><div class="md-big"><b>'+sg(T.twh_vs_prev,1)+'</b><span class="md-u">TWh</span><span class="gw-ind">indicative</span></div><span class="gw-ts">≈ '+fx(D.twh_per_hdd,2)+' TWh per degree-day (EU27 ≈ '+fx(D.twh_per_hdd,2)+' TWh/d per 1 °C) · vs normal '+sg(T.twh_vs_norm,1)+' TWh</span></div></div>'+
   '<div class="pw-tbl-wrap"><table class="pw-tbl md-tbl gw-tbl"><thead><tr><th class="c-z">'+esc(span)+'</th><th>HDD</th><th>vs prev</th><th>vs normal</th><th>TWh vs prev</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '</div><div class="md-chart"><div class="md-leg gw-leg">'+(window.PWChart?PWChart.keysHtml(ser().map(s=>({name:s.name,color:s.color,dash:s.dash}))):"")+'</div><div id="gwChart"></div></div></div>'+
  '<p class="pw-foot">Daily mean 2 m temperature, population-weighted over London, Manchester, Paris, Lyon, Amsterdam, Brussels, Berlin, Hamburg, Frankfurt and Munich (UTC days). HDD = 18 − T when T ≤ 15 °C. Normal = ERA5 1991–2020, 7-day centred. Previous run = the ECMWF run 12 hours earlier. TWh is indicative only: an EU-wide rule of thumb applied to NW Europe temperatures. Updates twice a day after the 00z and 12z runs.</p></section>';
 chart();}
function ser(){const d=D.days||[];return[{name:"Latest run",color:COL.l,w:2.4,vals:d.map(x=>x.t),end:true},{name:"Previous run",color:COL.p,w:1.6,dash:"5 4",op:.75,vals:d.map(x=>x.t_prev)},{name:"Normal",color:COL.n,w:1.8,vals:d.map(x=>x.t_norm)}];}
function chart(){const el=$("gwChart");if(!el||!D||!window.PWChart)return;const d=D.days||[],n=d.length;
 PWChart.lineChart(el,{n,series:ser(),yunit:"°C",h:el.clientWidth<520?200:230,xw:40,label:"NW Europe daily mean temperature, ECMWF latest vs previous run vs normal",src:"ECMWF (via Open-Meteo)",asof:D.generated_utc,
  xlab:i=>{const t=new Date(d[i].date+"T12:00:00Z");return t.getUTCDate()+(i===0||t.getUTCDate()===1?" "+t.toLocaleDateString("en-GB",{month:"short",timeZone:"UTC"}):"");},xkey:i=>d[i].date,
  vline:i=>i===7,
  tip:i=>{const x=d[i];return'<b>Day '+(i+1)+' · '+esc(dd(x.date))+'</b><br>Latest '+fx(x.t,1)+' °C · HDD '+fx(x.hdd,1)+'<br>Previous '+fx(x.t_prev,1)+' °C · HDD '+fx(x.hdd_prev,1)+'<br>Normal '+fx(x.t_norm,1)+' °C · HDD '+fx(x.hdd_norm,1);}});}
let rt=null;window.addEventListener("resize",()=>{if(!D||!$("gwChart"))return;clearTimeout(rt);rt=setTimeout(chart,180);});
window.MMGasWx={shell,draw,load,data:()=>D,show(){if(!D&&!busy)load();else draw();}};
})();
