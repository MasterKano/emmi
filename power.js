/* Nordic Power tab: data/power.json (built by GitHub Actions from EEX settlements, day-ahead prices, NVE hydro).
   Real data only: null -> "n/a". Hand-rolled SVG charts (no libraries), Geneva time (CET/CEST) throughout.
   Chart labelling convention: title = what + where, unit after " · " (e.g. "SE4 day-ahead price by hour · €/MWh");
   subtitle = period · resolution · time zone · source; y-axis carries the unit; legend whenever > 1 series;
   tooltips show value + unit. */
(()=>{"use strict";
const TZ="Europe/Zurich";
const LS="markets-monitor:power:v2";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NA='<span class="na">n/a</span>';
const isNum=v=>typeof v==="number"&&isFinite(v);
const mean=a=>{const b=a.filter(isNum);return b.length?b.reduce((x,y)=>x+y,0)/b.length:null;};
const SPOT=["NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4","FI","DK1","DK2","DE-LU","PL","LT"];
const NORDIC=SPOT.slice(0,12);
const NEIGH=["DE-LU","PL","LT"];
const FUT_N=["Nordic","NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4","FI"];
const FUT_EU=["DE","FR","NL","GB","ES","IT"];
const ZNAME={Nordic:"Nordic system",DE:"Germany",FR:"France",NL:"Netherlands",GB:"Great Britain",ES:"Spain",IT:"Italy","DE-LU":"DE-LU"};
const COL={zone:"var(--accent)",sys:"var(--pw-sys)",de:"var(--pw-de)",prev:"var(--faint)",se3:"var(--pw-se3)",wind:"var(--pw-wind)"};
const FOCUS="SE4";
const SE_Z=["SE1","SE2","SE3","SE4"];
const st=Object.assign({day:"today",zone:"SE4",mode:"p",eu:false,tenor:null,bench:"Y",hz:"Norway",rz:"DK1"},(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}");}catch(e){return{};}})());
const save=()=>{try{localStorage.setItem(LS,JSON.stringify({day:st.day,zone:st.zone,mode:st.mode,eu:st.eu,bench:st.bench,hz:st.hz,rz:st.rz}));}catch(e){}};
let P=null,loading=null,shown=false,mode=null;

/* ---------- formatting ---------- */
const fdate=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short"});
const fdt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const fhr=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",hour12:false});
const fymd=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"});
const dayKey=(off=0)=>fymd.format(new Date(Date.now()+off*864e5));
const dlabel=k=>{if(!k)return"";const d=new Date(k+"T12:00:00Z");return fdate.format(d).replace("Sept","Sep");};
const tdlabel=k=>{if(!k)return"";const d=new Date(k+"T12:00:00Z");return d.toLocaleDateString("en-GB",{timeZone:"UTC",weekday:"short",day:"2-digit",month:"short",year:"numeric"}).replace("Sept","Sep");};
const sdate=k=>new Date(k+"T12:00:00Z").toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short"}).replace("Sept","Sep");
function fp(v,d=2){return isNum(v)?v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):NA;}
function fpt(v,d=2){return isNum(v)?v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):"n/a";}
function fs(v,d=2){if(!isNum(v))return NA;return(v>0?"+":v<0?"−":"")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});}
function fst(v,d=2){if(!isNum(v))return"n/a";return(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(d);}
function ago(iso){const m=(Date.now()-new Date(iso).getTime())/6e4;if(!isFinite(m))return"";if(m<1)return"just now";if(m<60)return Math.round(m)+"m ago";if(m<48*60)return Math.round(m/60)+"h ago";return Math.round(m/1440)+"d ago";}

/* ---------- labelling helpers ---------- */
const EUR="€/MWh";
const U=u=>String(u||"").replace(/^EUR\s*\/\s*/,"€/").replace(/^USD\s*\/\s*/,"$/");
const ftz=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,timeZoneName:"short"});
function tzName(ms){try{const p=ftz.formatToParts(new Date(ms)).find(x=>x.type==="timeZoneName");const v=p?p.value:"";if(v==="CET"||v==="CEST")return v;return/\+0?2/.test(v)?"CEST":"CET";}catch(e){return"CET";}}
const tzSpan=(a,b)=>{const x=tzName(a),y=tzName(b==null?a:b);return x===y?x:"CET/CEST";};
const hRange=(t0,n)=>dlabel(fymd.format(new Date(t0)))+" – "+dlabel(fymd.format(new Date(t0+(n-1)*36e5)));
/* card head: title (what + where) · unit, subtitle (period · resolution · tz · source), optional legend / controls */
function ttlHtml(title,unit){return title+(unit?'<span class="pw-u"> · '+unit+'</span>':"");}
function cardHead(title,unit,sub,keys,right){return'<div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title">'+ttlHtml(title,unit)+'</strong>'+(sub?'<span class="pw-card-sub">'+sub+'</span>':"")+'</div>'+(keys?'<div class="pw-keys">'+keys+'</div>':"")+(right||"")+'</div>';}
function setHead(id,title,unit,sub){const t=$(id);if(t)t.innerHTML=ttlHtml(title,unit);const b=$(id+"Sub");if(b)b.innerHTML=sub||"";}
const headSlot=id=>'<div class="pw-ttl"><strong class="panel-title" id="'+id+'"></strong><span class="pw-card-sub" id="'+id+'Sub"></span></div>';
/* legend swatch drawn with the series' own dash pattern */
const keyHtml=s=>s.dotKey?'<span class="pw-key"><svg class="pw-kl" viewBox="0 0 18 6" width="18" height="6" aria-hidden="true"><circle cx="9" cy="3" r="3" style="fill:'+s.color+(s.op?';opacity:'+s.op:"")+'"/></svg>'+esc(s.name)+'</span>':'<span class="pw-key"><svg class="pw-kl" viewBox="0 0 18 6" width="18" height="6" aria-hidden="true"><line x1="1" x2="17" y1="3" y2="3" style="stroke:'+s.color+';stroke-width:'+(s.dash?2:2.8)+(s.dash?';stroke-dasharray:'+s.dash.split(" ").map(x=>Math.max(1.6,x*.6).toFixed(1)).join(" "):"")+(s.op?';opacity:'+s.op:"")+'"/></svg>'+esc(s.name)+'</span>';
const keysHtml=ser=>ser.map(keyHtml).join("");
/* hourly multi-day axis: day names centred on noon, faint lines at local midnight, a "now" marker, tz in the corner */
const fdnum=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"numeric"}),fdwd=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric"});
function hAxis(t0,n,el){const days=Math.max(1,n/24),per=((el&&el.clientWidth)||600)/days;const hr=i=>fhr.format(new Date(t0+i*36e5));const now=Math.floor((Date.now()-t0)/36e5);
 return{xall:true,xunit:tzSpan(t0,t0+(n-1)*36e5),now:now>=0&&now<n?now:null,vline:i=>i>0&&hr(i)==="00",
  xlab:i=>{if(hr(i)!=="12")return null;const d=new Date(t0+i*36e5);return per>=78?dlabel(fymd.format(d)):per>=44?fdwd.format(d):fdnum.format(d);}};}
const tipTime=(t0,i)=>esc(fdt.format(new Date(t0+i*36e5)).replace("Sept","Sep"))+' '+tzName(t0+i*36e5);

/* ---------- price colour scale (EUR/MWh, fixed so days are comparable) ---------- */
const STOPS=[[-40,[196,48,58]],[-10,[229,72,77]],[0,[180,140,70]],[25,[78,184,104]],[60,[45,160,120]],[100,[56,140,200]],[160,[70,110,230]],[250,[86,104,255]],[350,[50,70,200]]];
function pcol(v,a){if(!isNum(v))return"transparent";let i=0;while(i<STOPS.length-2&&v>STOPS[i+1][0])i++;const[x0,c0]=STOPS[i],[x1,c1]=STOPS[i+1];const t=Math.max(0,Math.min(1,(v-x0)/(x1-x0)));const c=c0.map((q,j)=>Math.round(q+(c1[j]-q)*t));return a==null?"rgb("+c+")":"rgba("+c+","+a+")";}
function ink(v){if(!isNum(v))return"";return (v>=15&&v<95)?"#10141c":"#fff";}
function legend(){const xs=[-40,0,40,100,160,250,350];return'<div class="pw-legend"><span class="pw-lg-bar" style="background:linear-gradient(90deg,'+xs.map((x,i)=>pcol(x)+" "+(i/(xs.length-1)*100).toFixed(0)+"%").join(",")+')"></span><span class="pw-lg-ticks">'+xs.map(x=>"<i>"+(x<0?"−"+(-x):x)+"</i>").join("")+'</span><span class="pw-lg-unit">€/MWh · daily average</span></div>';}

/* ---------- tooltip ---------- */
let tip;function showTip(html,e){if(!tip){tip=document.createElement("div");tip.className="pw-tip";document.body.append(tip);}tip.innerHTML=html;tip.hidden=false;const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=Math.max(6,x)+"px";tip.style.top=Math.max(6,y)+"px";}
function hideTip(){if(tip)tip.hidden=true;}

/* ---------- generic SVG line chart ---------- */
function nice(lo,hi,n=5){if(!isNum(lo)||!isNum(hi))return[0,1,[0,1]];if(lo===hi){lo-=1;hi+=1;}const span=hi-lo,step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0))),f=step0/mag,step=(f<1.5?1:f<3?2:f<7?5:10)*mag;const a=Math.floor(lo/step)*step,b=Math.ceil(hi/step)*step;const t=[];for(let v=a;v<=b+step/2;v+=step)t.push(Math.round(v/step)*step);return[a,b,t];}
function lineChart(el,o){
 const W=Math.max(280,el.clientWidth||600),H=o.h||(W<520?220:270),m={l:44,r:12,t:o.yunit?24:12,b:o.xgroups?40:26};
 const n=o.n;const gx=o.gap||0;const groups=o.groups||[];let gaps=0;const xs=[];for(let i=0;i<n;i++){if(i&&groups[i]!==groups[i-1])gaps++;xs.push(i+gaps*gx);}
 const xmax=Math.max(1,xs[n-1]||1);const X=i=>m.l+(n<2?0.5:xs[i]/xmax)*(W-m.l-m.r);
 let vals=[];o.series.forEach(s=>vals=vals.concat(s.vals.filter(isNum)));if(o.band)o.band.forEach(b=>{vals.push(b[1],b[3]);});vals=vals.filter(isNum);
 if(o.zero)vals.push(0);
 if(!vals.length){el.innerHTML='<div class="pw-empty">No data available</div>';return;}
 let[lo,hi,ticks]=nice(Math.min(...vals),Math.max(...vals),W<520?4:5);if(o.ymin!=null){lo=o.ymin;}if(o.ymax!=null){hi=o.ymax;}if(o.ymin!=null||o.ymax!=null)ticks=nice(lo,hi,5)[2].filter(t=>t>=lo&&t<=hi);
 const Y=v=>m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b);
 let s='<svg class="pw-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img"'+(o.label?' aria-label="'+esc(o.label)+'"':"")+'>';
 ticks.forEach(t=>{s+='<line class="g" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(t).toFixed(1)+'" y2="'+Y(t).toFixed(1)+'"/><text class="yt" x="'+(m.l-6)+'" y="'+(Y(t)+3.5).toFixed(1)+'">'+(o.yfmt?o.yfmt(t):t)+'</text>';});
 if(o.yunit)s+='<text class="yu" x="2" y="12">'+esc(o.yunit)+'</text>';
 if(o.vline)for(let i=0;i<n;i++)if(o.vline(i))s+='<line class="vg" x1="'+X(i).toFixed(1)+'" x2="'+X(i).toFixed(1)+'" y1="'+m.t+'" y2="'+(H-m.b)+'"/>';
 if(o.now!=null&&o.now>=0&&o.now<n){const x=X(o.now).toFixed(1);s+='<line class="nw" x1="'+x+'" x2="'+x+'" y1="'+m.t+'" y2="'+(H-m.b)+'"/><text class="nwt" x="'+(+x+3)+'" y="'+(m.t+9)+'">now</text>';}
 if(o.zero&&lo<0&&hi>0)s+='<line class="z" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'"/>';
 if(o.band){const B=o.band.filter(b=>isNum(b[1])&&isNum(b[3]));if(B.length){const up=B.map(b=>X(b[0]).toFixed(1)+" "+Y(b[3]).toFixed(1)),dn=B.slice().reverse().map(b=>X(b[0]).toFixed(1)+" "+Y(b[1]).toFixed(1));s+='<path class="band" d="M'+up.join("L")+"L"+dn.join("L")+'Z"/>';s+='<path class="band-mid" d="M'+B.map(b=>X(b[0]).toFixed(1)+" "+Y(b[2]).toFixed(1)).join("L")+'"/>';}}
 // x labels
 const step=Math.max(1,Math.ceil(n/((W-m.l-m.r)/(o.xw||46))));
 for(let i=0;i<n;i++){const lab=o.xlab(i);if(lab==null)continue;if(!o.xall&&i%step&&i!==n-1)continue;s+='<text class="xt" x="'+X(i).toFixed(1)+'" y="'+(H-m.b+14)+'">'+esc(lab)+'</text>';}
 if(o.xunit)s+='<text class="xu" x="'+(m.l-9)+'" y="'+(H-m.b+14)+'">'+esc(o.xunit)+'</text>';
 if(o.xgroups){const seen={};groups.forEach((g,i)=>{(seen[g]=seen[g]||[]).push(i);});Object.entries(seen).forEach(([g,ix])=>{const a=X(ix[0]),b=X(ix[ix.length-1]);s+='<line class="grp" x1="'+(a-4)+'" x2="'+(b+4)+'" y1="'+(H-14)+'" y2="'+(H-14)+'"/><text class="gt" x="'+((a+b)/2).toFixed(1)+'" y="'+(H-3)+'">'+esc(o.xgroups[g]||"")+'</text>';});}
 o.series.forEach(se=>{let d="",pen=false;for(let i=0;i<n;i++){const v=se.vals[i];if(!isNum(v)||(i&&groups.length&&groups[i]!==groups[i-1])){pen=false;}if(!isNum(v))continue;d+=(pen?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1);pen=true;}
  s+='<path class="ln" d="'+d+'" style="stroke:'+se.color+';stroke-width:'+(se.w||2)+(se.dash?';stroke-dasharray:'+se.dash:"")+(se.op?';opacity:'+se.op:"")+'"/>';
  if(se.dots)for(let i=0;i<n;i++){const v=se.vals[i];if(isNum(v))s+='<circle class="dt" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="'+(se.r||2.6)+'" style="fill:'+se.color+'"/>';}
  if(se.end){let li=-1;for(let i=n-1;i>=0;i--)if(isNum(se.vals[i])){li=i;break;}if(li>=0)s+='<circle cx="'+X(li).toFixed(1)+'" cy="'+Y(se.vals[li]).toFixed(1)+'" r="3.4" style="fill:'+se.color+'"/>';}});
 s+='<line class="hair" x1="0" x2="0" y1="'+m.t+'" y2="'+(H-m.b)+'" visibility="hidden"/><rect class="hit" x="'+m.l+'" y="'+m.t+'" width="'+(W-m.l-m.r)+'" height="'+(H-m.t-m.b)+'"/></svg>';
 el.innerHTML=s;
 const svg=el.querySelector("svg"),hair=svg.querySelector(".hair"),hit=svg.querySelector(".hit");
 const move=e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)*W/r.width;let bi=0,bd=1e9;for(let i=0;i<n;i++){const d=Math.abs(X(i)-px);if(d<bd){bd=d;bi=i;}}hair.setAttribute("x1",X(bi));hair.setAttribute("x2",X(bi));hair.setAttribute("visibility","visible");showTip(o.tip(bi),e);};
 hit.addEventListener("pointermove",move);hit.addEventListener("pointerleave",()=>{hair.setAttribute("visibility","hidden");hideTip();});}
function sparkSvg(v,w=110,h=30){const p=v.filter(isNum);if(p.length<2)return"";let mn=Math.min(...p),mx=Math.max(...p);if(mx===mn)mx=mn+1;const pts=v.map((q,i)=>isNum(q)?[(i/(v.length-1))*w,h-3-((q-mn)/(mx-mn))*(h-6)]:null).filter(Boolean);const d=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join("");const up=p[p.length-1]>=p[0];const c=up?"var(--good)":"var(--bad)";const l=pts[pts.length-1];
 return'<svg class="spark" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true"><path d="'+d+'L'+l[0].toFixed(1)+' '+h+'L0 '+h+'Z" fill="'+c+'" opacity=".12"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="1.5" stroke-linejoin="round"/><circle cx="'+l[0].toFixed(1)+'" cy="'+l[1].toFixed(1)+'" r="2.2" fill="'+c+'"/></svg>';}
function heat(v,scale){if(!isNum(v)||!scale)return"";const h=Math.min(1,Math.abs(v)/scale);return' style="--h:'+(Math.round(h*100)/100)+'" data-s="'+(v>0?"p":v<0?"n":"z")+'"';}
function seg(id,opts,cur){return'<div class="seg pw-seg" id="'+id+'" role="group">'+opts.map(([k,l,dis,t])=>'<button type="button" class="button'+(k===cur?" is-on":"")+'" data-k="'+esc(k)+'"'+(dis?" disabled":"")+(t?' title="'+esc(t)+'"':"")+'>'+l+'</button>').join("")+'</div>';}
function bindSeg(id,fn){const el=$(id);if(!el)return;el.querySelectorAll("button[data-k]").forEach(b=>b.onclick=()=>fn(b.dataset.k));}

/* ---------- spot helpers ---------- */
/* Nord Pool official figures: SYS (system price) is a pseudo-zone; official area daily averages win over computed ones */
const NPo=()=>P&&P.nordpool&&P.nordpool.avg?P.nordpool:null;
function npAvg(z,k){const n=NPo(),a=n&&n.avg[k];return a&&isNum(a[z])?a[z]:null;}
const Z=z=>{if(z==="SYS"){const n=NPo();return n?{src:"Nord Pool",daily:n.sys||[],days:n.sys_days||{}}:null;}return P&&P.spot&&P.spot.zones&&P.spot.zones[z]||null;};
function dayRec(z,k){const r=Z(z);return r&&r.days&&r.days[k]||null;}
function dayAvg(z,k){const o=npAvg(z,k);if(isNum(o))return o;const r=dayRec(z,k);if(r&&isNum(r.avg))return r.avg;const zz=Z(z);if(!zz)return null;const f=(zz.daily||[]).find(x=>x[0]===k);return f?f[1]:null;}
function winAvg(z,endKey,n){const zz=Z(z);if(!zz||!endKey)return null;const m=new Map(zz.daily||[]);const e=new Date(endKey+"T12:00:00Z");const vals=[];for(let i=0;i<n;i++){const k=new Date(e.getTime()-i*864e5).toISOString().slice(0,10);const v=m.get(k);if(!isNum(v))return null;vals.push(v);}return mean(vals);}
function nordicAvg(k,fn){const v=NORDIC.map(z=>fn(z,k));return v.every(isNum)?mean(v):null;}
const dayVal=(z,k)=>z==="NordicAvg"?nordicAvg(k,dayAvg):dayAvg(z,k);
const w7=(z,k)=>z==="NordicAvg"?nordicAvg(k,(zz,kk)=>winAvg(zz,kk,7)):winAvg(z,k,7);
const w30=(z,k)=>z==="NordicAvg"?nordicAvg(k,(zz,kk)=>winAvg(zz,kk,30)):winAvg(z,k,30);
function keys(){const t=dayKey(0),m=dayKey(1);const has=k=>SPOT.some(z=>dayRec(z,k));return{today:t,tomorrow:m,hasT:has(t),hasM:has(m)};}

/* ---------- layout ---------- */
function shell(){const v=$("powerView");v.innerHTML=
 '<section class="pw-sec" id="pwSecMon" data-sec="pwMon"><h2 class="pw-h sec-h pw-h-top">Last month: <span id="pwMonTitle">overview</span> <span class="pw-sub">Nordic generation, hydro inflow, rain and prices · NO, SE, FI, DK</span><span class="sec-dot" id="pwDotMon"></span></h2><div id="pwMonBody"></div></section>'+
 '<div class="pw-kpis pw-kpis-focus" id="pwFocusKpis" aria-label="SE4 key figures"></div>'+
 '<div class="pw-kpis pw-kpis-nordic" id="pwKpis"></div>'+
 '<section class="pw-sec" id="pwSecSpot" data-sec="pwSpot"><h2 class="pw-h sec-h">Prices now <span class="pw-sub">day-ahead spot prices by bidding zone · €/MWh · CET delivery day</span><span class="sec-dot" id="pwDotSpot"></span></h2>'+
 '<div class="pw-grid pw-grid-da">'+
  '<section class="pw-card pw-map-card"><div class="pw-card-head">'+headSlot("pwMapTitle")+'<div id="pwDaySeg"></div></div><div class="pw-map" id="pwMap"></div><div id="pwLegend"></div><div class="pw-side"><div class="pw-mini-h">Key spreads <em>€/MWh · day-ahead daily average, first zone − second</em></div><div class="pw-tbl-wrap"><table class="pw-tbl" id="pwSpreads"></table></div><div id="pwCapture"></div></div></section>'+
  '<section class="pw-card pw-heat-card"><div class="pw-card-head">'+headSlot("pwHeatTitle")+'<span class="pw-note" id="pwHeatNote"></span></div><div class="pw-heat-wrap" id="pwHeat"></div>'+
  '<div class="pw-side"><div class="pw-mini-h">Day-ahead price averages <em>€/MWh · Today / Tmrw = daily average of the delivery day (Nord Pool official where published) · 7d / 30d = mean of the 7 / 30 delivery days ending today · SYS = system price</em></div><div class="pw-tbl-wrap"><table class="pw-tbl" id="pwAvg"></table></div></div></section>'+
 '</div></section>'+
 '<section class="pw-sec" id="pwSecFw" data-sec="pwFw"><h2 class="pw-h sec-h">Forwards <span class="pw-sub">EEX base-load futures, daily settlement · €/MWh</span><span class="sec-dot" id="pwDotFw"></span></h2>'+
 '<div class="pw-grid pw-grid-fw">'+
  '<section class="pw-card"><div class="pw-card-head">'+headSlot("pwCurveTitle")+'<div class="pw-keys" id="pwCurveKeys"></div></div><div class="pw-chips" id="pwZoneChips"></div><div class="pw-chart" id="pwCurve"></div></section>'+
  '<section class="pw-card"><div class="pw-card-head">'+headSlot("pwPremTitle")+'<div id="pwPremSeg"></div></div><div class="pw-bars" id="pwPrem"></div><div class="pw-mini-h" id="pwHistTitle"></div><div class="pw-keys pw-pad" id="pwHistKeys"></div><div class="pw-chart" id="pwHist"></div></section>'+
 '</div>'+
 '<section class="pw-card pw-full"><div class="pw-card-head">'+headSlot("pwFwTitle")+'<div class="pw-tools"><div id="pwModeSeg"></div><button class="button" id="pwEu" type="button">+ Europe</button></div></div><div class="pw-tbl-wrap pw-fw-wrap"><table class="pw-tbl pw-fw" id="pwFw"></table></div><p class="pw-foot" id="pwFwFoot"></p></section></section>'+
 '<section class="pw-sec" id="pwSecSup" data-sec="pwSup"><h2 class="pw-h sec-h">Supply &amp; weather <span class="pw-sub">nuclear · hydro · wind and solar · fuels and carbon</span></h2>'+
 '<div class="pw-mini-h pw-sec-h nm-subh">Nuclear and system price <em>available reactor capacity · Nordic system price vs zones</em><span class="sec-dot" id="pwDotBal"></span></div>'+
 '<div class="pw-kpis pw-kpis-bal" id="pwBalKpis" aria-label="Nordic balance key figures"></div>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="pwNuc"></section><section class="pw-card" id="pwSys"></section></div>'+
 '<div class="pw-mini-h pw-sec-h nm-subh">Hydro <em>reservoir energy vs normal and vs the last 10 years · storage and price by zone</em><span class="sec-dot" id="pwDotHyd"></span></div>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="pwHyBal"></section><section class="pw-card" id="pwHydN"></section></div>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="pwHydMap"></section><section class="pw-card" id="pwRes" hidden></section></div>'+
 '<div class="pw-mini-h pw-sec-h nm-subh">Wind and solar <em>output vs forecast · Denmark and Finland</em></div>'+
 '<section class="pw-card pw-full" id="pwRen" hidden></section>'+
 '<section class="pw-card pw-full" id="pwFiW" hidden></section>'+
 '<div class="pw-mini-h pw-sec-h nm-subh">Fuels, carbon and certificates <em>latest settlement in the unit shown · line = settlements since 1 Sep</em><span class="sec-dot" id="pwDotDrv"></span></div>'+
 '<div class="pw-drivers" id="pwDrivers"></div>'+
'<details class="explain pw-explain" id="pwExplain"><summary><span class="explain-title">How to read the Nordic balance</span><span class="explain-hint">Nuclear · Hydro · System price · Wind &amp; solar · Data checks</span></summary><div class="explain-grid">'+
  '<div class="ex-item"><h3>Nuclear</h3><p><b>Available MW</b> = net capacity of the 11 Swedish and Finnish reactors minus the unavailable capacity in operators\' active <b>Nord Pool UMM</b> (REMIT) messages, planned and unplanned. The chart is the daily mean for the next 14 days; <b>back</b> = end of the current event as published. Outages not yet announced are not included.</p></div>'+
  '<div class="ex-item ex-vol"><h3>Hydro vs normal</h3><p>Energy stored in reservoirs, TWh. <b>Normal</b> = median of the same week (Norway: NVE 2006–2025; Sweden, Finland: ENTSO-E A72 over the last 10 years). The key number is the <b>deviation</b>: below normal means less water to produce later, which usually supports Nordic prices. Denmark has no hydro storage.</p></div>'+
  '<div class="ex-item ex-ma"><h3>System price</h3><p><b>SYS</b> = Nord Pool\'s Nordic system price, the unconstrained reference price (no grid congestion) used for Nordic futures. Area minus SYS shows congestion: SE4 above SYS = imports into southern Sweden are scarce. Daily averages are Nord Pool\'s official figures.</p></div>'+
  '<div class="ex-item"><h3>Wind, solar &amp; checks</h3><p>DK1/DK2 output and day-ahead forecast from Energinet, FI from Fingrid (ENTSO-E until an API key is set). SE4 load values below 40% of the forecast are removed as glitches and the newest, still-incomplete hour is shown as provisional. EEX settlements arrive the evening after trading.</p></div>'+
 '</div></details>'+
 '</section>'+
 '<section class="pw-sec" id="pwSecSE4" data-sec="pwSE4"><h2 class="pw-h sec-h">SE4 focus <span class="pw-sub">southern Sweden · wind, demand, flows, outages and Swedish generation</span><span class="sec-dot" id="pwDotSE4"></span></h2>'+
 '<section class="pw-card pw-s4-wide" id="pwS4Wind" hidden></section>'+
 '<div class="pw-grid pw-grid-se4">'+
  '<section class="pw-card" id="pwS4Value" hidden></section>'+
  '<section class="pw-card" id="pwS4Svk"></section>'+
 '</div>'+
 '<div class="pw-grid pw-grid-se4">'+
  '<section class="pw-card" id="pwS4Flows"></section>'+
 '</div>'+
 '<div class="pw-grid pw-grid-se4">'+
  '<section class="pw-card" id="pwS4Out" hidden></section>'+
  '<section class="pw-card" id="pwS4Mix"></section>'+
 '</div>'+
 '</section>'+
 '<p class="pw-foot pw-credits" id="pwCredits"></p>';}

function gridShell(){const v=$("gridView");if(!v||v.dataset.ready)return;v.dataset.ready="1";v.innerHTML=
 '<section class="pw-sec" id="gdSecCal" data-sec="gdCal"><h2 class="pw-h pw-h-top sec-h">Upcoming grid, tender &amp; connection events <span class="pw-sub">Germany · UK · France · official sources · next 12 months</span><span class="sec-dot" id="gdDotCal"></span></h2>'+
 '<section class="pw-card pw-full" id="gdCal"></section></section>'+
 '<section class="pw-sec" id="gdSecQueue" data-sec="gdQueue"><h2 class="pw-h sec-h">Connection queues <span class="pw-sub">Great Britain · Germany · France · grid operators\' registers and notices</span></h2>'+
 '<div class="pw-chips gd-qchips" id="gdQChips"><button type="button" class="chip is-on" data-q="all">All</button><button type="button" class="chip" data-q="gb">Great Britain</button><button type="button" class="chip" data-q="de">Germany</button><button type="button" class="chip" data-q="fr">France</button></div>'+
 '<div class="gd-q" data-q="gb" id="gdSecUK">'+
 '<div class="pw-mini-h pw-sec-h">Great Britain <em>NESO connection registers · solar, battery and demand · new and changed entries</em><span class="sec-dot" id="gdDotUK"></span></div>'+
 '<section class="pw-card pw-full" id="gdUK"></section></div>'+
 '<div class="pw-mini-h pw-sec-h" id="gdSecDEFR">Germany and France <em>transmission operators\' connection notices · renewable connection queue by region</em><span class="sec-dot" id="gdDotDEFR"></span></div>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card gd-q" data-q="de" id="gdDE"></section><section class="pw-card gd-q" data-q="fr" id="gdFR"></section></div></section>'+
 '<section class="pw-sec" id="gdSecSol" data-sec="gdSol"><h2 class="pw-h sec-h">Solar tenders <span class="pw-sub">Germany (BNetzA) and France (CRE) · award prices, volumes, all rounds</span><span class="sec-dot" id="gdDotSol"></span></h2>'+
 '<section class="pw-card pw-full" id="gdSol"></section></section>'+
 '<section class="pw-sec" id="gdSecBess" data-sec="gdBess"><h2 class="pw-h sec-h">Battery storage build costs <span class="pw-sub">published capex benchmarks · static, updated by hand</span></h2>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="gdBessGB"></section><section class="pw-card" id="gdBessGl"></section></div></section>'+
 '<section class="pw-sec" id="gdSecMastr" data-sec="gdMastr"><h2 class="pw-h sec-h">Germany: solar &amp; battery project pipeline <span class="pw-sub">Marktstammdatenregister (BNetzA) · utility-scale units &gt; 1 MW · weekly</span><span class="sec-dot" id="gdDotMastr"></span></h2>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="gdMastrNew"></section><section class="pw-card" id="gdMastrSt"></section></div></section>'+
 '<section class="pw-sec" id="gdSecDC" data-sec="gdDCAll"><h2 class="pw-h sec-h">Data centres &amp; site deals <span class="pw-sub">UK · Germany · France · announcements with a stated capacity · powered-land and site deals</span><span class="sec-dot" id="gdDotDC"></span></h2>'+
 '<section class="pw-card pw-full" id="gdDC"></section><section class="pw-card pw-full" id="gdDCDeals"></section>'+
 '<div class="pw-mini-h pw-sec-h" id="gdSecLand">Site deals <em>powered land and data-centre site deals · hand-maintained log · sourced facts only</em></div>'+
 '<section class="pw-card pw-full" id="gdLand"></section></section>'+
 '<section class="pw-sec" id="gdSecBlg" data-sec="pwBlg"><h2 class="pw-h sec-h">Germany balancing prices <span class="pw-sub">FCR and aFRR capacity auctions · regelleistung.net · last 90 delivery days</span><span class="sec-dot" id="pwDotBlg"></span></h2>'+
 '<div class="pw-grid pw-grid-gd"><section class="pw-card" id="pwBlgF"></section><section class="pw-card" id="pwBlgA"></section></div></section>'+
 '<details class="explain pw-explain" id="gdExplain"><summary><span class="explain-title">How to read Grid &amp; DC</span><span class="explain-hint">Registers · Tenders · Queue · Data centres</span></summary><div class="explain-grid">'+
  '<div class="ex-item"><h3>GB registers</h3><p>NESO\'s <b>TEC register</b> (transmission) and <b>embedded register</b> list projects with a connection agreement: capacity in MW, the date it takes effect and the project status. Bars sum the cumulative contracted MW by status. Each build compares the registers with the previous build and lists <b>new</b> entries and entries whose MW, date or status <b>changed</b>.</p></div>'+
  '<div class="ex-item ex-vol"><h3>Solar tenders</h3><p><b>Germany</b>: Bundesnetzagentur rounds for ground-mounted solar, pay-as-bid; the award price is the guaranteed value in ct/kWh (1 ct/kWh = 10 €/MWh). <b>France</b>: CRE synthesis of each tender period; the price is the volume-weighted reference price of the bids CRE proposes to retain, in €/MWh.</p></div>'+
  '<div class="ex-item ex-ma"><h3>Connection queue</h3><p>France: renewable projects waiting for a grid connection by region (RTE and distribution networks), from the ODRE open-data portal; it is published once a year. Germany: transmission operators\' press notices on grid connections and connection capacity.</p></div>'+
  '<div class="ex-item"><h3>DE pipeline</h3><p><b>Marktstammdatenregister</b> (BNetzA) public unit register. Charts and the state table use units with net rated power &gt; 1 MW: ground-mounted solar and battery storage only. Status is as registered (in operation / in planning). Smaller units are counted but not summed.</p></div>'+
  '<div class="ex-item"><h3>Data centres</h3><p>Headlines from the last 90 days that name a UK, German or French location and state a capacity. Columns are read from the headline, so check the linked article for details. €/MW appears only when the headline gives both an investment amount and a capacity.</p></div>'+
 '</div></details>';
 window.MMUI&&MMUI.apply(v);}
/* ---------- KPIs + stamps ---------- */
function kpi(label,val,sub,cls,title){return'<div class="pw-kpi'+(cls?" "+cls:"")+'"'+(title?' title="'+esc(title)+'"':"")+'><span class="pw-kpi-l">'+label+'</span><b>'+val+'</b><span class="pw-kpi-s">'+(sub||"")+'</span></div>';}
function renderKpis(){const K=keys(),E=P.eex;const t=K.today;let h="";
 const na=dayVal("NordicAvg",t),de=dayVal("DE-LU",t);
 if(!NPo())h+=kpi("Nordic avg · today",isNum(na)?fp(na)+'<small> €/MWh</small>':NA,isNum(na)&&isNum(de)?"vs DE-LU "+fs(na-de):"simple mean of 12 zones","","Unweighted mean of the 12 Nordic bidding-zone day-ahead averages (not the Nord Pool system price)");
 h+=kpi("DE-LU · today",isNum(de)?fp(de)+'<small> €/MWh</small>':NA,K.hasM?"tomorrow "+fpt(dayVal("DE-LU",K.tomorrow)):"tomorrow n/a yet");
 const sys=E&&E.zones&&E.zones.Nordic,fm=E&&E.bench&&E.bench.M,fy=E&&E.bench&&E.bench.Y;
 if(sys&&fm&&sys[fm])h+=kpi("Nordic system · "+esc(fm),fp(sys[fm].p)+(isNum(sys[fm].p)?'<small> €/MWh</small>':""),"1D "+fs(sys[fm].d1)+" · 1W "+fs(sys[fm].w1),"","EEX Nordic system price base month future, settlement "+(E.asof||""));
 if(E&&fy&&sys&&sys[fy]&&E.zones.DE&&E.zones.DE[fy]){const a=sys[fy].p,b=E.zones.DE[fy].p;h+=kpi("Nordic vs DE · "+esc(fy),isNum(a)&&isNum(b)?fs(a-b)+'<small> €/MWh</small>':NA,"Nordic "+fpt(a)+" · DE "+fpt(b),"","EEX base-load "+fy+" settlement, Nordic system minus Germany");}
 const ttf=E&&(E.drivers||[]).find(d=>d.key==="ttf_m");if(ttf)h+=kpi("TTF · "+esc((ttf.contract||"").replace("Gas Month ","")),fp(ttf.p)+(isNum(ttf.p)?'<small> '+esc(U(ttf.unit))+'</small>':""),"1D "+fs(ttf.d1)+" · since 1 Sep "+fs(ttf.s1));
 $("pwKpis").innerHTML=h;
}
/* one freshness dot per section (replaces the old row of timestamps); tooltips carry the as-of time in CET/CEST */
function setDot(id,html){const el=$(id);if(el)el.innerHTML=html;}
function renderDots(){if(!window.MMUI)return;const D=MMUI.dot,E=P.eex,sp=P.spot,n=NPo(),e=EN(),G0=P.generated_utc;
 setDot("pwDotBal",D(n&&n.asof||G0,"power","Nord Pool SYS, UMM nuclear, hydro balance",n&&n.stale?"late":null,(n&&n.stale?"Nord Pool part kept from an earlier build":"")));
 setDot("pwDotSpot",D(sp&&sp.asof,"power","Day-ahead prices ("+((sp&&sp.sources)||[]).join(", ")+")",sp&&sp.asof?null:"stale"));
 const eexN=E?"EEX settlements as of "+tdlabel(E.asof)+(E.lag?" (behind the expected "+tdlabel(E.expected)+")":"")+"; settlements arrive after the close (~18:00 CET) and are collected each evening":"EEX n/a";
 setDot("pwDotFw",D(G0,"power","Forwards",E?(E.lag?"late":null):"stale",eexN));
 setDot("pwDotDrv",D(G0,"power","Fuels, carbon and certificates (EEX / ICE)",E?(E.lag?"late":null):"stale",eexN));
 setDot("pwDotHyd",D(HN&&HN.generated_utc,"weekly","NVE, ENTSO-E A72",HN?(HN.se?null:"late"):"stale",HN&&!HN.se?"Sweden missing":""));setDot("pwDotBlg",D(BL&&BL.generated_utc,"power","regelleistung.net capacity auctions",BL?null:"stale"));setDot("pwDotSE4",D(e&&e.asof||G0,"power","ENTSO-E Transparency, Svenska kraftnät",e&&(e.stale||[]).length?"late":null,e&&(e.stale||[]).length?e.stale.length+" part(s) kept from an earlier build":""));}


/* ---------- map ---------- */
function renderMap(){const M=window.PW_MAP,K=keys();const k=st.day==="tomorrow"?K.tomorrow:K.today;
 $("pwDaySeg").innerHTML=seg("pwDay",[["today","Today · "+esc(dlabel(K.today)),false],["tomorrow","Tomorrow · "+esc(dlabel(K.tomorrow)),!K.hasM,K.hasM?"":"Not published yet (day-ahead auction results ~12:45 CET)"]],st.day);
 bindSeg("pwDay",d=>{st.day=d;save();renderDA();});
 if(!M){$("pwMap").innerHTML='<div class="pw-empty">Map geometry not loaded</div>';return;}
 const zmap={DE:"DE-LU"};let s='<svg class="pw-mapsvg" viewBox="0 0 '+M.w+' '+M.h+'" role="img" aria-label="Map of Nordic bidding zones coloured by day-ahead average">';
 const order=["EE","LV","LT","PL","NL","DE","DK1","DK2","NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4","FI"];
 order.forEach(id=>{const g=M.z[id];if(!g)return;const z=zmap[id]||id;const live=SPOT.includes(z);const v=live?dayVal(z,k):null;
  s+='<path class="pw-zone'+(live?" live":" ctx")+(live&&!isNum(v)?" nodata":"")+'" data-z="'+z+'" d="'+g.d+'"'+(live&&isNum(v)?' style="fill:'+pcol(v)+'"':"")+'/>';});
 order.forEach(id=>{const g=M.z[id];const z=zmap[id]||id;if(!g||!g.c||!SPOT.includes(z))return;const v=dayVal(z,k);let[x,y]=g.c;if(id==="DE")y=Math.min(y,M.h-14);
  s+='<g class="pw-lbl" transform="translate('+x+' '+y+')"><text class="z" y="-4">'+esc(z)+'</text><text class="v" y="13">'+(isNum(v)?Math.round(v):"n/a")+'</text></g>';});
 s+="</svg>";$("pwMap").innerHTML=s;$("pwLegend").innerHTML=legend();
 {const r4=dayRec(FOCUS,k)||dayRec("SE3",k);const srcs=(P.spot&&P.spot.sources||[]).join(", ");
  setHead("pwMapTitle","Daily average day-ahead price by zone",EUR,(st.day==="tomorrow"?"Tomorrow":"Today")+" · "+esc(dlabel(k))+" · mean of all "+(r4&&r4.res===15?"15-min":"hourly")+" prices in the delivery day (CET)"+(srcs?" · "+esc(srcs):""));}
 $("pwMap").querySelectorAll("path.live").forEach(p=>{const z=p.dataset.z;p.addEventListener("pointermove",e=>{const r=dayRec(z,k),v=dayVal(z,k);const src=Z(z)&&Z(z).src;showTip('<b>'+esc(z)+'</b> · day-ahead · '+esc(dlabel(k))+'<br>Daily average <b>'+fpt(v)+'</b> €/MWh'+(r?'<br>Min '+fpt(r.min)+' · Max '+fpt(r.max)+' €/MWh <span class="src">('+(r.res===15?"15-min":"hourly")+')</span>'+(r.neg?'<br><span class="neg-t">'+r.neg+' negative '+(r.res===15?"15-min periods":"hours")+'</span>':""):"")+'<br>7d avg '+fpt(w7(z,K.today))+' · 30d '+fpt(w30(z,K.today))+' €/MWh'+(src?'<br><span class="src">'+esc(src)+'</span>':""),e);});p.addEventListener("pointerleave",hideTip);p.addEventListener("click",()=>{if(FUT_N.includes(z)){st.zone=z;save();renderFw();}});});}

/* ---------- heatmap ---------- */
const HZ=()=>(dayRec("SYS",keys().today)||dayRec("SYS",keys().tomorrow)?["SYS"]:[]).concat(SPOT);
function renderHeat(){const K=keys();const k=st.day==="tomorrow"?K.tomorrow:K.today;
 const recs=HZ().map(z=>[z,dayRec(z,k)]);const any=recs.find(r=>r[1]);
 setHead("pwHeatTitle","Day-ahead price by zone and hour",EUR,esc(dlabel(k))+" · hourly · times CET/CEST");
 if(!any){$("pwHeat").innerHTML='<div class="pw-empty">'+(st.day==="tomorrow"?"Tomorrow's day-ahead prices are not published yet (auction results ~12:45 CET; this page refreshes ~14:30 Geneva daily).":"No day-ahead prices for today in the current data.")+'</div>';$("pwHeatNote").textContent="";return;}
 // hour columns from the longest record (23/24/25 h on DST days)
 const ref=recs.map(r=>r[1]).filter(Boolean).sort((a,b)=>b.h.length-a.h.length)[0];const t0=new Date(ref.t0).getTime();const nH=ref.h.length;
 let h='<table class="pw-heat"><thead><tr><th class="c-z" title="Bidding zone; columns are hours starting at the time shown ('+tzName(t0)+')">Zone</th>';for(let i=0;i<nH;i++)h+='<th>'+fhr.format(new Date(t0+i*36e5))+'</th>';h+='<th class="c-avg" title="Daily average of all periods in the delivery day, €/MWh">Avg</th></tr></thead><tbody>';
 recs.forEach(([z,r])=>{h+='<tr'+(z===FOCUS?' class="focus"':z===NEIGH[0]?' class="nb-first"':z==="SYS"?' class="sys"':'')+'><th class="c-z" scope="row"'+(z==="SYS"?' title="Nord Pool Nordic system price (unconstrained reference price)"':'')+'>'+esc(z)+'</th>';if(!r){h+='<td colspan="'+(nH+1)+'" class="pw-nodata">n/a</td></tr>';return;}
  const off=Math.round((new Date(r.t0).getTime()-t0)/36e5);
  for(let i=0;i<nH;i++){const v=r.h[i-off];if(!isNum(v)){h+='<td class="na-c">·</td>';continue;}h+='<td class="'+(v<0?"neg":"")+'" style="background:'+pcol(v)+';color:'+ink(v)+'" data-z="'+esc(z)+'" data-i="'+i+'">'+(v<0&&Math.round(v)===0?"−0":Math.round(v)<0?"−"+Math.abs(Math.round(v)):Math.round(v))+'</td>';}
  const a=isNum(r.avg)?r.avg:null;h+='<td class="c-avg"'+(isNum(a)?' style="background:'+pcol(a,.9)+';color:'+ink(a)+'"':"")+(r.full?"":' title="Incomplete day in source data"')+'>'+(isNum(a)?a.toFixed(1):"n/a")+'</td></tr>';});
 h+="</tbody></table>";$("pwHeat").innerHTML=h;
 const negs=recs.filter(r=>r[1]&&r[1].neg).map(r=>r[0]);const tz=tzSpan(t0,t0+(nH-1)*36e5);
 setHead("pwHeatTitle","Day-ahead price by zone and hour",EUR,esc(dlabel(k))+" · columns = hour starting ("+tz+")"+(ref.res===15?", mean of 4 × 15-min prices":"")+" · Avg = daily average"+(recs[0][0]==="SYS"?" · SYS = Nord Pool system price":""));
 $("pwHeatNote").innerHTML=""+(negs.length?' · <span class="neg-t">negative prices: '+esc(negs.join(", "))+'</span>':"");
 $("pwHeat").querySelectorAll("td[data-z]").forEach(td=>{td.addEventListener("pointermove",e=>{const z=td.dataset.z,i=+td.dataset.i;const r=dayRec(z,k);const off=Math.round((new Date(r.t0).getTime()-t0)/36e5);const v=r.h[i-off];const a=new Date(t0+i*36e5),b=new Date(t0+(i+1)*36e5);
  showTip('<b>'+esc(z)+'</b> · '+esc(dlabel(k))+' '+fhr.format(a)+':00–'+fhr.format(b)+':00 '+tzName(a.getTime())+'<br>Day-ahead <b>'+fpt(v)+'</b> €/MWh'+(r.res===15?' <span class="src">(mean of 4 × 15-min)</span>':""),e);});td.addEventListener("pointerleave",hideTip);});}

/* ---------- averages + spreads ---------- */
function renderAvg(){const K=keys();const t=K.today,m=K.tomorrow;
 let h='<thead><tr><th class="c-z">Zone</th><th>Today</th><th>Tmrw</th><th title="Mean of the 7 delivery days ending today">7d</th><th title="Mean of the 30 delivery days ending today">30d</th><th title="Today\'s min and max (15-min or hourly resolution as published)">Min / max</th><th title="Number of negative-price periods today (15-min or hourly)">Neg.</th></tr></thead><tbody>';
 const row=(z,lab,cls)=>{const r=dayRec(z,t);const a=dayVal(z,t),b=dayVal(z,m),c=w7(z,t),d=w30(z,t);const cell=v=>'<td class="num"'+(isNum(v)?' style="--pc:'+pcol(v)+'"':"")+'>'+(isNum(v)?'<i class="pw-sw"></i>'+v.toFixed(1):NA)+'</td>';
  return'<tr class="'+(cls||"")+(z===FOCUS?" focus":"")+'"><th class="c-z" scope="row"'+(z==="NordicAvg"?' title="Unweighted mean of the 12 Nordic zones (needs all 12)"':"")+'>'+lab+'</th>'+cell(a)+cell(b)+cell(c)+cell(d)+'<td class="num mm">'+(r?'<span class="'+(r.min<0?"neg-t":"")+'">'+fpt(r.min,0)+'</span> / '+fpt(r.max,0):NA)+'</td><td class="num">'+(r?(r.neg?'<span class="neg-t">'+r.neg+(r.res===15?"×15m":"h")+'</span>':"0"):NA)+'</td></tr>';};
 if(Z("SYS")&&(dayRec("SYS",t)||dayRec("SYS",m)))h+=row("SYS",'<span title="Nord Pool Nordic system price, official daily average">SYS</span>',"sys");
 SPOT.forEach(z=>h+=row(z,esc(z),z===NEIGH[0]?"nb-first":(NEIGH.includes(z)?"nb":"")));h+=row("NordicAvg","Nordic avg","sum");
 $("pwAvg").innerHTML=h+"</tbody>";
 const SP=[["SE4 − SE3","SE4","SE3"],["SE4 − DK2","SE4","DK2"],["SE4 − DE-LU","SE4","DE-LU"],["SE2 − SE4","SE2","SE4"],["SE3 − FI","SE3","FI"],["DK1 − DE","DK1","DE-LU"],["NO2 − DE","NO2","DE-LU"],NPo()?["SYS − DE","SYS","DE-LU"]:["Nordic avg − DE","NordicAvg","DE-LU"]];
 let s='<thead><tr><th class="c-z">Spread</th><th>Today</th><th>Tmrw</th><th>7d</th><th>30d</th></tr></thead><tbody>';
 SP.forEach(([l,a,b])=>{const f=(fn,k)=>{const x=fn(a,k),y=fn(b,k);return isNum(x)&&isNum(y)?x-y:null;};const vs=[f(dayVal,t),f(dayVal,m),f(w7,t),f(w30,t)];
  s+='<tr><th class="c-z" scope="row">'+esc(l)+'</th>'+vs.map(v=>'<td class="num heat"'+heat(v,40)+'>'+fs(v,1)+'</td>').join("")+'</tr>';});
 $("pwSpreads").innerHTML=s+"</tbody>";
 const C=P.capture&&P.capture.zones;let c="";if(C&&Object.keys(C).length){const c0=Object.values(C)[0]||{};c='<div class="pw-mini-h" title="Computed here: generation-weighted average day-ahead price over the period; not a published series">Capture prices <em>€/MWh · '+(c0.start&&c0.end?esc(sdate(c0.start))+' – '+esc(sdate(c0.end)):"last 30 days")+' · % = capture ÷ baseload · computed</em></div><div class="pw-tbl-wrap"><table class="pw-tbl"><thead><tr><th class="c-z">Zone</th><th title="Time-average day-ahead price">Baseload</th><th title="Wind-weighted day-ahead price and capture rate">Wind</th><th title="Solar-weighted day-ahead price and capture rate">Solar</th></tr></thead><tbody>';
  Object.entries(C).forEach(([z,r])=>{const f=x=>x?fp(x.cap,1)+' <span class="pw-ratio">'+(isNum(x.ratio)?Math.round(x.ratio*100)+"%":"")+'</span>':NA;const base=(r.wind||r.solar||{}).base;c+='<tr><th class="c-z">'+esc(z)+'</th><td class="num">'+fp(base,1)+'</td><td class="num">'+f(r.wind)+'</td><td class="num">'+f(r.solar)+'</td></tr>';});
  c+='</tbody></table></div>';}
 $("pwCapture").innerHTML=c;}
function renderDA(){renderMap();renderHeat();renderAvg();}

/* ---------- forwards ---------- */
const GL={M:"Months",Q:"Quarters",Y:"Years"};
function renderFw(){const E=P.eex;if(!E){["pwCurve","pwPrem","pwHist"].forEach(id=>$(id).innerHTML='<div class="pw-empty">EEX settlements not available</div>');$("pwFw").innerHTML="";return;}
 if(!FUT_N.includes(st.zone))st.zone="SE4";
 const T=E.tenors,zn=E.zones;
 // zone chips
 $("pwZoneChips").innerHTML=FUT_N.map(z=>'<button type="button" class="chip'+(z===st.zone?" is-on":"")+'" data-z="'+z+'">'+esc(z==="Nordic"?"System":z)+'</button>').join("");
 $("pwZoneChips").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{st.zone=b.dataset.z;save();renderFw();});
 const zl=st.zone==="Nordic"?"Nordic system":st.zone;
 setHead("pwCurveTitle",esc(zl)+" forward curve",EUR,"EEX base-load futures · settlement "+esc(tdlabel(E.asof))+" · vs Nordic system, Germany and "+esc(zl)+" a week earlier");
 const v=(z,c)=>zn[z]&&zn[z][c]?zn[z][c].p:null;
 const ser=[{name:zl+" a week earlier",color:COL.prev,dash:"3 4",w:1.4,vals:T.map(t=>{const r=zn[st.zone]&&zn[st.zone][t.c];return r&&isNum(r.p)&&isNum(r.w1)?r.p-r.w1:null;})},
  {name:"Germany",color:COL.de,w:1.8,dash:"6 4",dots:true,vals:T.map(t=>v("DE",t.c))}];
 if(st.zone!=="Nordic")ser.push({name:"Nordic system",color:COL.sys,w:1.8,dots:true,vals:T.map(t=>v("Nordic",t.c))});
 ser.push({name:zl,color:COL.zone,w:2.6,dots:true,r:3.2,vals:T.map(t=>v(st.zone,t.c))});
 $("pwCurveKeys").innerHTML=keysHtml(ser.slice().reverse());
 lineChart($("pwCurve"),{h:($("pwCurve").clientWidth||600)<520?240:380,n:T.length,groups:T.map(t=>t.t),gap:.8,xgroups:GL,xall:true,xw:30,series:ser,yunit:EUR,label:zl+" base-load forward curve, €/MWh",
  xlab:i=>{const c=T[i].c,nar=($("pwCurve").clientWidth||600)<560;return T[i].t==="M"?(nar?c[0]:c.slice(0,3)):T[i].t==="Q"?(nar?c.slice(0,2):c.replace("-","'")):(nar?"":"'")+c.slice(-2);},
  tip:i=>'<b>'+esc(T[i].c)+'</b> <span class="src">delivery from '+esc(T[i].start)+'</span>'+tipRows(ser.slice().reverse(),i,2," €/MWh")+(isNum(v(st.zone,T[i].c))&&isNum(v("Nordic",T[i].c))&&st.zone!=="Nordic"?'<br><span class="src">'+esc(st.zone)+' − system '+fst(v(st.zone,T[i].c)-v("Nordic",T[i].c))+' €/MWh</span>':"")});
 renderPrem();renderFwTable();}
function renderPrem(){const E=P.eex,T=E.tenors,zn=E.zones;
 const opts=["M","Q","Y"].filter(k=>E.bench[k]).map(k=>[E.bench[k],E.bench[k]]);if(!st.tenor||!T.find(t=>t.c===st.tenor))st.tenor=E.bench.Y||T[0].c;
 if(!opts.find(o=>o[0]===st.tenor))opts.push([st.tenor,st.tenor]);
 $("pwPremSeg").innerHTML=seg("pwPremS",opts,st.tenor);bindSeg("pwPremS",k=>{st.tenor=k;renderPrem();renderFwTable();});
 setHead("pwPremTitle","Zone premium vs Nordic system · "+esc(st.tenor),EUR,"Zonal future − Nordic system future (implied EPAD) · last row: Nordic system − Germany · EEX settlement "+esc(tdlabel(E.asof)));
 const sys=zn.Nordic&&zn.Nordic[st.tenor]&&zn.Nordic[st.tenor].p;const rows=FUT_N.slice(1).map(z=>{const p=zn[z]&&zn[z][st.tenor]&&zn[z][st.tenor].p;return[z,isNum(p)&&isNum(sys)?p-sys:null,p];});
 const de=zn.DE&&zn.DE[st.tenor]&&zn.DE[st.tenor].p;rows.push(["Nordic − DE",isNum(sys)&&isNum(de)?sys-de:null,sys,true]);
 const mx=Math.max(10,...rows.map(r=>Math.abs(r[1]||0)));
 $("pwPrem").innerHTML=rows.map(([z,d,p,sep])=>{const w=isNum(d)?Math.abs(d)/mx*50:0;return'<div class="pw-bar'+(sep?" sep":"")+(z===st.zone?" on":"")+'" title="'+esc(sep?"Nordic system minus Germany, "+st.tenor:z+" minus Nordic system (implied EPAD), "+st.tenor+"; outright "+fpt(p))+'"><span class="bl">'+esc(z)+'</span><span class="bt"><i class="'+(d<0?"n":"p")+'" style="'+(d<0?"right:50%":"left:50%")+';width:'+w.toFixed(1)+'%"></i><b class="mid"></b></span><span class="bv">'+fs(d)+'</span></div>';}).join("");
 // benchmark history since 1 Sep
 const b=E.bench[st.bench]?st.bench:"Y";const c=E.bench[b];const H=E.hist||{};const D=E.dates||[];
 $("pwHistTitle").innerHTML=esc(c)+' settlement since 1 Sep <em>€/MWh</em> '+seg("pwBenchS",["M","Q","Y"].filter(k=>E.bench[k]).map(k=>[k,k==="M"?"Front month":k==="Q"?"Front quarter":"Front year"]),b);
 bindSeg("pwBenchS",k=>{st.bench=k;save();renderPrem();});
 const zs=st.zone==="Nordic"?["Nordic","DE"]:[st.zone,"Nordic","DE"];const cols={Nordic:COL.sys,DE:COL.de};
 const ser=zs.map(z=>({name:z==="Nordic"?"Nordic system":z==="DE"?"Germany":z,color:cols[z]||COL.zone,w:z===st.zone?2.4:1.7,dash:z==="DE"?"6 4":null,end:true,vals:(H[z]&&H[z][c])||[]}));
 $("pwHistKeys").innerHTML=keysHtml(ser.slice().reverse());
 lineChart($("pwHist"),{n:D.length,series:ser,h:200,yunit:EUR,label:c+" settlement since 1 Sep, €/MWh",xlab:i=>sdate(D[i]),xw:54,
  tip:i=>'<b>'+esc(c)+'</b> · '+esc(tdlabel(D[i]))+tipRows(ser.slice().reverse(),i,2," €/MWh")});}
const MODE_SUB={p:"Settlement price",d1:"Change vs previous settlement",w1:"Change vs a week earlier",s1:"Change since 1 Sep",sys:"Zone − Nordic system (implied EPAD)",de:"Zone − Germany"};
const MODES=[["p","Price"],["d1","Δ day"],["w1","Δ week"],["s1","Δ since 1 Sep"],["sys","vs system"],["de","vs DE"]];
function renderFwTable(){const E=P.eex,T=E.tenors,zn=E.zones;
 setHead("pwFwTitle","Base-load futures by zone and tenor",EUR,esc(MODE_SUB[st.mode]||"")+" · EEX, trade date "+esc(tdlabel(E.asof)));
 $("pwModeSeg").innerHTML=seg("pwMode",MODES,st.mode);bindSeg("pwMode",k=>{st.mode=k;save();renderFwTable();});
 $("pwEu").classList.toggle("is-on",st.eu);$("pwEu").onclick=()=>{st.eu=!st.eu;save();renderFwTable();};
 const zones=FUT_N.concat(st.eu?FUT_EU:["DE"]);
 const val=(z,c)=>{const r=zn[z]&&zn[z][c];if(!r)return null;if(st.mode==="p")return r.p;if(st.mode==="sys"){const s=zn.Nordic&&zn.Nordic[c];return z==="Nordic"?null:(isNum(r.p)&&s&&isNum(s.p)?r.p-s.p:null);}if(st.mode==="de"){const s=zn.DE&&zn.DE[c];return z==="DE"?null:(isNum(r.p)&&s&&isNum(s.p)?r.p-s.p:null);}return r[st.mode];};
 const all=[];zones.forEach(z=>T.forEach(t=>{const x=val(z,t.c);if(isNum(x))all.push(Math.abs(x));}));all.sort((a,b)=>a-b);const sc=Math.max(st.mode==="d1"?2:st.mode==="w1"?4:st.mode==="s1"?8:10,all.length?all[Math.floor(all.length*.85)]:1);
 let h='<thead><tr class="grp"><th class="c-z"></th>';["M","Q","Y"].forEach(g=>{const n=T.filter(t=>t.t===g).length;if(n)h+='<th colspan="'+n+'" class="g-'+g+'">'+GL[g]+'</th>';});h+='</tr><tr><th class="c-z">Zone</th>';
 T.forEach(t=>h+='<th class="'+(t.c===st.tenor?"sel":"")+'" data-c="'+esc(t.c)+'" title="'+esc(t.c+" · delivery from "+t.start)+' · click to use in premia">'+esc(t.c)+'</th>');h+='</tr></thead><tbody>';
 zones.forEach(z=>{h+='<tr class="'+(z===st.zone?"on ":"")+(z==="Nordic"?"sys":"")+(z==="DE"?" de":"")+'" data-z="'+z+'"><th class="c-z" scope="row" title="'+esc(ZNAME[z]||z)+'">'+esc(z==="Nordic"?"System":z)+'</th>';
  T.forEach(t=>{const r=zn[z]&&zn[z][t.c];const x=val(z,t.c);const tt=r?esc(z+" "+t.c+": "+fpt(r.p)+" · 1D "+fst(r.d1)+" · 1W "+fst(r.w1)+" · since "+(r.from||"1 Sep")+" "+fst(r.s1)):"";
   if(st.mode==="p")h+='<td class="num"'+(isNum(x)?' style="background:'+pcol(x,.28)+'"':"")+' title="'+tt+'">'+(isNum(x)?x.toFixed(2):NA)+'</td>';
   else h+='<td class="num heat"'+heat(x,sc)+' title="'+tt+'">'+fs(x)+(st.mode==="s1"&&r&&r.from?'<sup>*</sup>':"")+'</td>';});h+='</tr>';});
 $("pwFw").innerHTML=h+"</tbody>";
 $("pwFw").querySelectorAll("thead th[data-c]").forEach(th=>th.onclick=()=>{st.tenor=th.dataset.c;renderPrem();renderFwTable();});
 $("pwFw").querySelectorAll("tbody tr[data-z]").forEach(tr=>tr.onclick=()=>{if(FUT_N.includes(tr.dataset.z)){st.zone=tr.dataset.z;save();renderFw();}});
 const late=T.some(t=>zones.some(z=>zn[z]&&zn[z][t.c]&&zn[z][t.c].from));
 $("pwFwFoot").innerHTML='EEX settlement prices (€/MWh) for trade date <b>'+esc(tdlabel(E.asof))+'</b>. Nordic zones are <b>outright zonal futures</b> (EEX Nordic Zonal Futures, e.g. SE3 = 3SBM), not EPADs; “vs system” is the implied EPAD (zone − Nordic system price future). Δ day vs previous settlement, Δ week vs the last settlement ≥ 7 days earlier, Δ since 1 Sep vs the first settlement in this dataset'+(late?' (<sup>*</sup> contract listed later: change since listing)':"")+'. Contracts already in delivery ('+esc((E.in_delivery||[]).join(", ")||"none")+') are excluded. History starts 1 Sep 2026 and is not backfilled. DK1/DK2 futures are not in the source dataset.';}

/* ---------- drivers ---------- */
function renderDrivers(){const E=P.eex;if(!E){$("pwDrivers").innerHTML='<div class="pw-empty">n/a</div>';return;}
 $("pwDrivers").innerHTML=(E.drivers||[]).map(d=>'<div class="pw-drv" title="'+esc((d.note||d.name)+" · "+d.contract+" · settlement "+(d.asof||"n/a"))+'"><div class="pw-drv-h"><span class="panel-label">'+esc(d.name)+'</span><span class="pw-unit">'+esc(U(d.unit))+'</span></div><div class="pw-drv-v"><b>'+fp(d.p)+'</b>'+(d.hist?sparkSvg(d.hist).replace('aria-hidden="true"','role="img" aria-label="'+esc(d.name)+' settlements since 1 Sep, '+esc(U(d.unit))+'"'):"")+'</div><div class="pw-drv-c"><span>1D <em class="'+(d.d1>0?"up":d.d1<0?"dn":"")+'">'+fs(d.d1)+'</em></span><span>1W <em class="'+(d.w1>0?"up":d.w1<0?"dn":"")+'">'+fs(d.w1)+'</em></span><span>1 Sep <em class="'+(d.s1>0?"up":d.s1<0?"dn":"")+'">'+fs(d.s1)+'</em></span></div><div class="pw-drv-a">'+esc(d.asof?"Settlement "+tdlabel(d.asof):"n/a")+' · line since 1 Sep</div></div>').join("");}

/* ---------- SE4 focus: KPI strip ---------- */
function spreadV(a,b,fn,k){const x=fn(a,k),y=fn(b,k);return isNum(x)&&isNum(y)?x-y:null;}
function renderFocusKpis(){const K=keys(),t=K.today,E=P.eex,z=FOCUS;let h="";
 const a=dayVal(z,t),r=dayRec(z,t),m=K.hasM?dayVal(z,K.tomorrow):null;
 h+=kpi(z+" day-ahead · today",isNum(a)?fp(a)+'<small> €/MWh</small>':NA,(K.hasM?"tomorrow "+fpt(m):"tomorrow n/a yet")+(r?" · "+fpt(r.min,0)+"–"+fpt(r.max,0):""),"pw-f","SE4 day-ahead daily average for "+dlabel(t)+(r?"; min/max "+fpt(r.min)+" / "+fpt(r.max):""));
 h+=kpi(z+" 7d · 30d",isNum(w7(z,t))?fp(w7(z,t),1)+'<small> · '+fpt(w30(z,t),1)+' €/MWh</small>':NA,"day-ahead, mean of delivery days ending today","pw-f");
 {const R=E4(),C=R&&R.capture,c30=C&&C.d30&&C.d30.wind,c7=C&&C.d7&&C.d7.wind,ct=C&&C.today_fc&&C.today_fc.wind;
  if(c30||c7)h+=kpi("Wind capture · 30d",c30?pct0(c30.rate)+'<small> · '+fpt(c30.cap,1)+' €/MWh</small>':NA,(c7?"7d "+pct0(c7.rate)+" ("+fpt(c7.cap,1)+")":"")+(ct?" · today exp. "+pct0(ct.rate):""),"pw-f"+(c30&&isNum(c30.rate)?(c30.rate<0.8?" pw-neg":""):""),"SE4 wind capture rate = wind-weighted day-ahead price ÷ baseload, last 30 complete days (computed from ENTSO-E A44 × A75). 7d = last 7 days; today expected = weighted by the day-ahead wind forecast.");}
 const s3=spreadV(z,"SE3",dayVal,t),s3w=spreadV(z,"SE3",w7,t);h+=kpi(z+" − SE3 · today",isNum(s3)?fs(s3)+'<small> €/MWh</small>':NA,"7d "+fst(s3w)+(K.hasM?" · tmrw "+fst(spreadV(z,"SE3",dayVal,K.tomorrow)):""),"pw-f"+(isNum(s3)?(s3>0?" pw-pos":" pw-neg"):""),"Day-ahead daily average spread SE4 minus SE3 (congestion between southern and central Sweden)");
 const sd=spreadV(z,"DE-LU",dayVal,t),sdw=spreadV(z,"DE-LU",w7,t);h+=kpi(z+" − DE-LU · today",isNum(sd)?fs(sd)+'<small> €/MWh</small>':NA,"7d "+fst(sdw)+(K.hasM?" · tmrw "+fst(spreadV(z,"DE-LU",dayVal,K.tomorrow)):""),"pw-f"+(isNum(sd)?(sd>0?" pw-pos":" pw-neg"):""),"Day-ahead daily average spread SE4 minus Germany-Luxembourg");
 if(E&&E.zones&&E.zones[z]){const zn=E.zones;[["M","front month"],["Y","front year"]].forEach(([b,lab])=>{const c=E.bench[b];const q=c&&zn[z][c];if(!q)return;const sys=zn.Nordic&&zn.Nordic[c];const ep=isNum(q.p)&&sys&&isNum(sys.p)?q.p-sys.p:null;
  h+=kpi(z+" fwd · "+esc(c),fp(q.p)+(isNum(q.p)?'<small> €/MWh</small>':""),"1D "+fs(q.d1)+" · EPAD "+fs(ep),"pw-f","EEX SE4 zonal base future, "+lab+" "+c+", settlement "+tdlabel(E.asof)+"; EPAD = SE4 − Nordic system "+fpt(sys&&sys.p));});}
 $("pwFocusKpis").innerHTML=h;}

/* ---------- SE4 focus: section ---------- */
function alignHours(z,k,t0,n){const r=dayRec(z,k);if(!r)return Array(n).fill(null);const off=Math.round((new Date(r.t0).getTime()-t0)/36e5);const o=[];for(let i=0;i<n;i++){const v=r.h[i-off];o.push(isNum(v)?v:null);}return o;}
function renderSe4(){if(!$("pwS4Hour")){renderSvk();renderEntsoe();return;}const K=keys(),z=FOCUS;const t=K.today;const srcOf=q=>Z(q)&&Z(q).src||"";
 // SE4 day-ahead price by hour: today (+ tomorrow when published) vs SE3 / DE-LU on the same day
 const rt=dayRec(z,t)||dayRec(z,K.tomorrow);const box=$("pwS4Hour");
 if(!rt){setHead("pwS4HourTitle",z+" day-ahead price by hour",EUR,"No SE4 day-ahead prices in the current data");box.innerHTML='<div class="pw-empty">No SE4 day-ahead prices in the current data.</div>';$("pwS4HourKeys").innerHTML="";}
 else{const k0=dayRec(z,t)?t:K.tomorrow;const w0=k0===t?"today":"tomorrow";const t0=new Date(rt.t0).getTime(),n=rt.h.length,tz=tzSpan(t0,t0+(n-1)*36e5);
  const ser=[{name:"DE-LU "+w0,color:COL.de,w:1.5,dash:"6 4",vals:alignHours("DE-LU",k0,t0,n)},{name:"SE3 "+w0,color:COL.sys,w:1.6,vals:alignHours("SE3",k0,t0,n)}];
  const rm=k0===t&&dayRec(z,K.tomorrow);
  if(rm){const m1=new Map();const tm0=new Date(rm.t0).getTime();rm.h.forEach((v,j)=>{const hh=fhr.format(new Date(tm0+j*36e5));if(!m1.has(hh))m1.set(hh,isNum(v)?v:null);});
   ser.push({name:z+" tomorrow",color:COL.zone,w:1.8,dash:"3 3",op:.75,vals:Array.from({length:n},(_,i)=>{const v=m1.get(fhr.format(new Date(t0+i*36e5)));return v==null?null:v;})});}
  ser.push({name:z+" "+w0,color:COL.zone,w:2.6,dots:true,r:2.2,vals:alignHours(z,k0,t0,n)});
  const days=rm?"Today "+dlabel(t)+" + tomorrow "+dlabel(K.tomorrow):(w0==="today"?"Today ":"Tomorrow ")+dlabel(k0);
  setHead("pwS4HourTitle",z+" day-ahead price by hour",EUR,esc(days)+" · hourly"+(rt.res===15?" avg of 15-min prices":"")+", "+tz+" · vs SE3 and DE-LU (Germany)"+(srcOf(z)?" · "+esc(srcOf(z)):""));
  $("pwS4HourKeys").innerHTML=keysHtml(ser.slice().reverse());
  const nowI=k0===t?Math.floor((Date.now()-t0)/36e5):null;
  lineChart(box,{n,series:ser,zero:true,h:240,yunit:EUR,xunit:tz,now:nowI,label:z+" day-ahead price by hour, €/MWh",xlab:i=>fhr.format(new Date(t0+i*36e5)),xw:34,
   tip:i=>{const a=new Date(t0+i*36e5),b=new Date(t0+(i+1)*36e5);const s4=ser[ser.length-1].vals[i],s3=ser[1].vals[i];return'<b>'+fhr.format(a)+':00–'+fhr.format(b)+':00 '+tzName(a.getTime())+'</b> <span class="src">day-ahead price</span>'+tipRows(ser.slice().reverse(),i,2," €/MWh")+(isNum(s4)&&isNum(s3)?'<br><span class="src">SE4 − SE3 '+fst(s4-s3)+' €/MWh</span>':"");}});}
 // SE4 day-ahead price, daily average over the last 30 delivery days (incl. tomorrow once published)
 const zs=[z,"SE3","DE-LU"],maps=zs.map(q=>new Map((Z(q)&&Z(q).daily)||[]));const ds=[...new Set(maps.flatMap(m=>[...m.keys()]))].sort().slice(-30);
 const dser=[{name:"DE-LU",color:COL.de,w:1.5,dash:"6 4",vals:ds.map(d=>maps[2].get(d))},{name:"SE3",color:COL.sys,w:1.6,vals:ds.map(d=>maps[1].get(d))},{name:z,color:COL.zone,w:2.6,end:true,vals:ds.map(d=>maps[0].get(d))}];
 $("pwS4DayKeys").innerHTML=keysHtml(dser.slice().reverse());
 const dl=ds[ds.length-1];
 setHead("pwS4DayTitle",z+" daily average day-ahead price",EUR,ds.length?ds.length+" delivery days, "+esc(sdate(ds[0]))+" – "+esc(sdate(dl))+(dl===K.tomorrow?" (incl. tomorrow)":dl===t?" (to today)":"")+" · mean of each day · vs SE3 and Germany (DE-LU)"+(srcOf(z)?" · "+esc(srcOf(z)):""):"n/a");
 lineChart($("pwS4Day"),{n:ds.length,series:dser,zero:true,h:240,yunit:EUR,label:z+" day-ahead daily average price, €/MWh",xlab:i=>sdate(ds[i]),xw:54,
  tip:i=>'<b>'+esc(tdlabel(ds[i]))+'</b>'+(ds[i]===K.tomorrow?' <span class="src">tomorrow</span>':ds[i]===t?' <span class="src">today</span>':"")+'<br><span class="src">day-ahead daily average</span>'+tipRows(dser.slice().reverse(),i,2," €/MWh")+(isNum(dser[2].vals[i])&&isNum(dser[1].vals[i])?'<br><span class="src">SE4 − SE3 '+fst(dser[2].vals[i]-dser[1].vals[i])+' €/MWh</span>':"")});
 renderSe4Fw();renderSvk();renderEntsoe();}
function renderSe4Fw(){const E=P.eex,tb=$("pwS4Fw");if(!E||!E.zones||!E.zones[FOCUS]){setHead("pwS4FwTitle","SE4 base-load futures by tenor",EUR,"EEX settlements not available");tb.innerHTML='<tbody><tr><td class="pw-empty">EEX settlements not available</td></tr></tbody>';return;}
 const zn=E.zones,z=FOCUS;setHead("pwS4FwTitle","SE4 base-load futures by tenor",EUR,"EEX zonal futures · settlement "+esc(tdlabel(E.asof))+" · Δ = change, EPAD = SE4 − Nordic system");
 const g=(q,c)=>zn[q]&&zn[q][c]&&isNum(zn[q][c].p)?zn[q][c].p:null;
 let h='<thead><tr><th class="c-z">Tenor</th><th>SE4</th><th>Δ day</th><th>Δ week</th><th title="SE4 − Nordic system (implied EPAD)">EPAD</th><th>vs SE3</th><th>vs DE</th></tr></thead><tbody>';
 E.tenors.forEach(t=>{const r=zn[z][t.c];if(!r)return;const p=r.p,d=(q)=>isNum(p)&&isNum(g(q,t.c))?p-g(q,t.c):null;
  h+='<tr class="'+(Object.values(E.bench).includes(t.c)?"bench":"")+'" data-c="'+esc(t.c)+'"><th class="c-z" scope="row" title="delivery from '+esc(t.start)+'">'+esc(t.c)+'</th><td class="num" style="background:'+pcol(p,.28)+'">'+fp(p)+'</td><td class="num heat"'+heat(r.d1,4)+'>'+fs(r.d1)+'</td><td class="num heat"'+heat(r.w1,8)+'>'+fs(r.w1)+'</td><td class="num heat"'+heat(d("Nordic"),30)+'>'+fs(d("Nordic"))+'</td><td class="num heat"'+heat(d("SE3"),20)+'>'+fs(d("SE3"))+'</td><td class="num heat"'+heat(d("DE"),30)+'>'+fs(d("DE"))+'</td></tr>';});
 tb.innerHTML=h+"</tbody>";
 tb.querySelectorAll("tbody tr[data-c]").forEach(tr=>tr.onclick=()=>{st.zone=z;st.tenor=tr.dataset.c;save();renderFw();const el=$("pwSecFw");el&&el.scrollIntoView({behavior:"smooth",block:"start"});});}
/* ---------- Svenska kraftnät (Kontrollrummet + data.svk.se), keyless ---------- */
const BORDER_COL={SE3:"var(--pw-sys)",DK2:"#b07cff","DE-LU":"var(--pw-de)",PL:"#e5484d",LT:"#2da0aa"};
function svkIdx(V){const t0=new Date(V.t0).getTime();const now=Date.now();const i=Math.floor((now-t0)/36e5);return{t0,n:V.n,now:i};}
function lastIdx(a,upto){if(!a)return -1;for(let i=Math.min(a.length-1,upto==null?a.length-1:upto);i>=0;i--)if(isNum(a[i]))return i;return -1;}
function dayMean(a,t0,k){if(!a)return null;const s=new Date(k+"T00:00:00");const vals=[];for(let i=0;i<a.length;i++){const d=fymd.format(new Date(t0+i*36e5));if(d===k&&isNum(a[i]))vals.push(a[i]);}return vals.length?mean(vals):null;}
function svkStats(items){return'<div class="pw-grid-stats">'+items.map(([a,b,c,t])=>'<div'+(t?' title="'+esc(t)+'"':"")+'><span>'+a+'</span><b>'+b+'</b><em>'+(c||"")+'</em></div>').join("")+'</div>';}
function svkEmpty(box,title,unit,sub,msg){box.innerHTML=cardHead(title,unit,sub)+'<div class="pw-empty">'+msg+'</div>';}
/* SE4 cross-border flows card (SVK primary, ENTSO-E A11 fallback): one layout, one set of labels */
const BORDER_NAME={SE3:"SE3 (central Sweden)",DK2:"DK2 (east Denmark)","DE-LU":"Germany (DE-LU)",PL:"Poland",LT:"Lithuania"};
function flowCard(B2,fl,t0,n,src,foot){const K=keys(),now=Math.floor((Date.now()-t0)/36e5);
 const BO=["SE3","DK2","DE-LU","PL","LT"];const order=BO.filter(k=>fl[k]).concat(Object.keys(fl).filter(k=>!BO.includes(k)));
 const fs_=order.map(k=>({name:BORDER_NAME[k]||k,color:BORDER_COL[k]||"var(--muted)",w:k==="SE3"?2.4:1.6,vals:fl[k]}));
 const li=lastIdx(fl[order[0]],now);let fi=-1;fl[order[0]].some((v,i)=>{if(isNum(v)){fi=i;return true;}return false;});
 const from=fi>=0?dlabel(fymd.format(new Date(t0+fi*36e5))):"";
 const ax=hAxis(t0,n,$("pwS4Flows"));
 B2.innerHTML=cardHead(FOCUS+" cross-border physical flows","MW","Hourly · "+esc(hRange(t0,n))+" · "+ax.xunit+" · + = into SE4, − = out of SE4 · "+src,keysHtml(fs_))+
 '<div class="pw-tbl-wrap pw-flow-wrap"><table class="pw-tbl"><thead><tr><th class="c-z">Border <span class="pw-mut">MW</span></th><th title="Latest hourly value">Latest</th><th title="Mean of today\'s hours so far">Today avg</th><th title="Mean of all hours in the chart'+(from?" (from "+esc(from)+")":"")+'">Period avg</th></tr></thead><tbody>'+
 order.map(k=>{const a=fl[k];const l=lastIdx(a,now);const c=v=>'<td class="num '+(isNum(v)?(v>=0?"imp":"exp"):"")+'">'+(isNum(v)?(v>=0?"+":"−")+fp(Math.abs(v),0):NA)+'</td>';
  return'<tr><th class="c-z">'+esc(k==="SE3"?"SE3 → SE4":"SE4 ↔ "+k)+'</th>'+c(l>=0?a[l]:null)+c(dayMean(a,t0,K.today))+c(mean(a.filter(isNum)))+'</tr>';}).join("")+'</tbody></table></div>'+
 '<div class="pw-chart" id="pwS4FlowChart"></div><p class="pw-foot">'+foot+(li>=0?' Latest '+esc(fdt.format(new Date(t0+li*36e5)).replace("Sept","Sep"))+' '+tzName(t0+li*36e5)+'.':'')+'</p>';
 lineChart($("pwS4FlowChart"),Object.assign(hAxis(t0,n,$("pwS4FlowChart")),{n,series:fs_,zero:true,h:200,yunit:"MW",label:FOCUS+" cross-border physical flows by border, MW, positive into SE4",
  tip:i=>'<b>'+tipTime(t0,i)+'</b> <span class="src">net flow, + = into SE4</span>'+fs_.map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>'+(isNum(s.vals[i])?fst(s.vals[i],0)+'</b> MW':'n/a</b>')).join("")}));return true;}
function entFlows(B2){const R=E4(),fl=R&&R.flows;if(!fl||!Object.keys(fl).length)return false;
 return flowCard(B2,fl,new Date(R.t0).getTime(),R.n,"ENTSO-E (A11)","Fallback source (Svenska kraftnät flows unavailable): ENTSO-E cross-border physical flows (A11), net into SE4 per border. Hourly means.");}
function renderSvk(){const V=P.svk;const B1=$("pwS4Svk"),B2=$("pwS4Flows"),B3=$("pwS4Mix");
 const entLoad=renderLoadEnt(B1);
 if(!V){if(!entLoad)svkEmpty(B1,FOCUS+" electricity demand (load)","MW","Svenska kraftnät","SVK data not available in this build.");if(!entFlows(B2))svkEmpty(B2,FOCUS+" cross-border physical flows","MW","Svenska kraftnät","SVK data not available in this build.");svkEmpty(B3,"Sweden generation by type","MW","Svenska kraftnät","SVK data not available in this build.");return;}
 const{t0,n,now}=svkIdx(V),K=keys(),Z4=(V.zones||{})[FOCUS]||{};const tzv=tzSpan(t0,t0+(n-1)*36e5);
 // 1) SE4 load (outcome + forecast) and solar plan: only when ENTSO-E load is missing
 const ser=[];if(Z4.load_plan)ser.push({name:"Load forecast",color:COL.de,w:1.4,dash:"4 3",vals:Z4.load_plan});if(Z4.load)ser.push({name:"Load actual",color:COL.zone,w:2.4,end:true,vals:Z4.load});if(Z4.solar_plan)ser.push({name:"Solar plan",color:SOLAR_C,w:1.6,vals:Z4.solar_plan});
 if(entLoad){}
 else if(!ser.length)svkEmpty(B1,FOCUS+" electricity demand (load)","MW","Svenska kraftnät Kontrollrummet","n/a");
 else{const li=lastIdx(Z4.load,now);const lt=dayMean(Z4.load,t0,K.today),lp=dayMean(Z4.load_plan,t0,K.today),sp=Z4.solar_plan?Math.max(...Z4.solar_plan.filter(isNum).concat([0])):null;
  const fl=V.flows_se4||{};const ni=lastIdx(Object.values(fl)[0],now);const net=ni>=0?Object.values(fl).reduce((a,v)=>a+(isNum(v[ni])?v[ni]:0),0):null;
  B1.innerHTML=cardHead(FOCUS+" electricity demand (load) vs forecast","MW","Hourly · "+esc(hRange(t0,n))+" · "+tzv+" · Svenska kraftnät Kontrollrummet",keysHtml(ser.slice().reverse()))+
  svkStats([["Load latest",li>=0?fp(Z4.load[li],0)+" MW":NA,li>=0?fhr.format(new Date(t0+li*36e5))+":00 "+tzName(t0+li*36e5):"","Consumption outcome, SE4"],["Load today",isNum(lt)?fp(lt,0)+" MW":NA,isNum(lp)?"forecast "+fp(lp,0)+" MW":"mean so far","Mean of today's hourly outcome vs SVK forecast"],["Net import",isNum(net)?fp(net,0)+" MW":NA,ni>=0?"all borders · "+fhr.format(new Date(t0+ni*36e5))+":00":"","Physical flows into SE4 minus out of SE4 (data.svk.se)"],["Solar plan peak",isNum(sp)?fp(sp,0)+" MW":NA,"max of the hours published","Solar production plans submitted by balance-responsible parties"]])+
  '<div class="pw-chart" id="pwS4SvkChart"></div>';
  lineChart($("pwS4SvkChart"),Object.assign(hAxis(t0,n,$("pwS4SvkChart")),{n,series:ser,h:210,yunit:"MW",label:FOCUS+" load and forecast, MW",tip:i=>'<b>'+tipTime(t0,i)+'</b>'+tipRows(ser.slice().reverse(),i)}));}
 // 2) SE4 flows per border (positive = import into SE4)
 const fl=V.flows_se4;
 if(!fl||!Object.keys(fl).length){if(!entFlows(B2))svkEmpty(B2,FOCUS+" cross-border physical flows","MW","Svenska kraftnät data.svk.se","n/a");}
 else flowCard(B2,fl,t0,n,"Svenska kraftnät","Positive = flow into SE4, negative = out of SE4. Hourly means of 15-min physical flows (data.svk.se).");
 // 3) Sweden production by type + SE1–SE4 load split
 const S=V.se;const zs=V.zones||{};
 if(!S&&!Object.keys(zs).length){svkEmpty(B3,"Sweden generation by type","MW","Svenska kraftnät Kontrollrummet","n/a");return;}
 const MIX=[["wind","Wind","var(--pw-wind)"],["hydro","Hydro","#4f7cff"],["nuclear","Nuclear","#b07cff"],["thermal","Thermal","#f08848"],["unspecified","Unspecified","var(--muted)"]];
 const mser=S?MIX.filter(([k])=>S[k]).map(([k,l,c])=>({name:l,color:c,w:k==="wind"?2.4:1.5,vals:S[k]})):[];
 let h=cardHead("Sweden generation by type","MW","Hourly · "+esc(hRange(t0,n))+" · "+tzv+" · whole of Sweden (no zone split) · Svenska kraftnät",keysHtml(mser));
 if(S){const li=lastIdx(S.total,now);const tot=li>=0?S.total[li]:null;
  h+='<div class="pw-mix"><div class="pw-mini-h">Latest hour <em>MW and share of total'+(li>=0?' · '+esc(fdt.format(new Date(t0+li*36e5)).replace("Sept","Sep"))+' '+tzName(t0+li*36e5):"")+'</em></div>'+MIX.filter(([k])=>S[k]).map(([k,l,c])=>{const v=li>=0?S[k][li]:null;const sh=isNum(v)&&isNum(tot)&&tot?v/tot*100:null;return'<div class="pw-mix-row"><span class="hl"><i style="background:'+c+'"></i>'+l+'</span><span class="hb"><i style="width:'+(isNum(sh)?Math.max(0,Math.min(100,sh)):0).toFixed(1)+'%;background:'+c+'"></i></span><span class="hv">'+(isNum(v)?fp(v,0):NA)+'</span><span class="hd">'+(isNum(sh)?sh.toFixed(0)+"%":"")+'</span></div>';}).join("")+
  '<div class="pw-mix-sum">Total '+(isNum(tot)?fp(tot,0):"n/a")+' MW · consumption '+(li>=0&&S.consumption?fpt(S.consumption[li],0):"n/a")+' MW · net export '+(li>=0&&S.net_export?fst(S.net_export[li],0):"n/a")+' MW</div></div>';}
 const zk=SE_Z.filter(z=>zs[z]);
 if(zk.length){h+='<div class="pw-mini-h pw-pad">Load by bidding area <em>MW · latest hour, today\'s mean and forecast · Kontrollrummet</em></div><div class="pw-tbl-wrap pw-pad"><table class="pw-tbl"><thead><tr><th class="c-z">Zone</th><th>Latest</th><th>Today avg</th><th>Forecast today</th><th title="Highest hourly solar production plan in the hours published">Solar plan peak</th></tr></thead><tbody>'+
  zk.map(z=>{const r=zs[z];const l=lastIdx(r.load,now);const sp=r.solar_plan?r.solar_plan.filter(isNum):[];return'<tr class="'+(z===FOCUS?"focus":"")+'"><th class="c-z">'+z+'</th><td class="num">'+(l>=0?fp(r.load[l],0):NA)+'</td><td class="num">'+fp(dayMean(r.load,t0,K.today),0)+'</td><td class="num">'+fp(dayMean(r.load_plan,t0,K.today),0)+'</td><td class="num">'+(sp.length?fp(Math.max(...sp),0):NA)+'</td></tr>';}).join("")+'</tbody></table></div>';}
 h+=(mser.length?'<div class="pw-mini-h pw-pad">Generation by type, hourly <em>MW · whole of Sweden</em></div>':"")+'<div class="pw-chart" id="pwS4MixChart"></div><p class="pw-foot">Production by type is published for Sweden as a whole (no bidding-area split at source) and is based on operators\' reported schedules, not settled outcome.</p>';
 B3.innerHTML=h;
 if(mser.length)lineChart($("pwS4MixChart"),Object.assign(hAxis(t0,n,$("pwS4MixChart")),{n,series:mser,h:190,yunit:"MW",label:"Sweden generation by type, MW",tip:i=>'<b>'+tipTime(t0,i)+'</b>'+tipRows(mser,i)}));}
/* ---------- ENTSO-E Transparency: SE4 wind, value of wind, load, outages; reservoirs (Drivers) ---------- */
const EN=()=>P.entsoe&&P.entsoe.enabled?P.entsoe:null;
const E4=()=>{const e=EN();return e&&e.se4&&e.se4.t0?e.se4:null;};
const SOLAR_C="#e2c454";
const tipRows=(ser,i,d=0,u=" MW")=>ser.map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>'+fpt(s.vals[i],d)+'</b>'+(isNum(s.vals[i])?u:"")).join("");
const pct0=v=>isNum(v)?Math.round(v*100)+"%":"n/a";
function staleNote(k){const e=EN();return e&&(e.stale||[]).includes(k)?' <span class="na">(kept from an earlier build: this part failed at the last update)</span>':"";}
function renderWind(){const box=$("pwS4Wind"),R=E4(),S=R&&R.series;
 if(!S||!(S.wind||S.wind_fc)){box.hidden=true;box.innerHTML="";return;}box.hidden=false;
 const t0=new Date(R.t0).getTime(),n=R.n,now=Math.floor((Date.now()-t0)/36e5),K=keys();
 const ser=[];if(S.solar_fc)ser.push({name:"Solar forecast (day-ahead)",color:SOLAR_C,w:1.2,dash:"4 3",op:.8,vals:S.solar_fc});if(S.solar)ser.push({name:"Solar actual",color:SOLAR_C,w:1.6,vals:S.solar});
 if(S.wind_fc)ser.push({name:"Wind forecast (day-ahead)",color:COL.wind,w:1.5,dash:"5 3",op:.85,vals:S.wind_fc});if(S.wind)ser.push({name:"Wind actual",color:COL.wind,w:2.6,end:true,vals:S.wind});
 const li=lastIdx(S.wind,now),wt=dayMean(S.wind_fc,t0,K.today),wa=dayMean(S.wind,t0,K.today),wm=dayMean(S.wind_fc,t0,K.tomorrow),er=R.wind_err;
 const stats=[["Wind latest",li>=0?fp(S.wind[li],0)+" MW":NA,li>=0?fhr.format(new Date(t0+li*36e5))+":00 "+tzName(t0+li*36e5)+" · actual":"","Latest actual hourly wind generation in SE4 (ENTSO-E A75)"],
  ["Today · forecast",isNum(wt)?fp(wt,0)+" MW":NA,isNum(wa)?"actual so far "+fp(wa,0)+" MW":"mean of the day","Day-ahead wind forecast (A69), mean MW over today"],
  ["Tomorrow · forecast",isNum(wm)?fp(wm,0)+" MW":NA,isNum(wm)?"mean of the day":"published the afternoon before","Day-ahead wind forecast for tomorrow (A69); appears after it is published, typically late afternoon the day before"],
  ["DA forecast error",er?fp(er.mae,0)+" MW":NA,er?"MAE 7d · "+(er.mean?Math.round(er.mae/er.mean*100)+"% of mean · ":"")+(er.bias<0?"under":"over")+"-forecast "+fp(Math.abs(er.bias),0)+" MW":"","Mean absolute error of the hourly day-ahead wind forecast vs actual over the last 7 complete days; bias = mean(forecast − actual)"]];
 const ax=hAxis(t0,n,box);
 box.innerHTML=cardHead(FOCUS+" wind and solar output vs day-ahead forecast","MW","Hourly · "+esc(hRange(t0,n))+" · "+ax.xunit+" · ENTSO-E (actual A75, forecast A69)",keysHtml(ser.slice().reverse()))+svkStats(stats)+'<div class="pw-chart" id="pwS4WindChart"></div>'+
  '<p class="pw-foot">Actual generation per type (A75) vs the TSO\'s <b>day-ahead</b> wind and solar forecast (A69), both in MW. A69 is a short-horizon forecast published the day before delivery (it covers today and, once published, tomorrow); it is not a multi-week outlook. Hourly means of 15-min values; times CET/CEST (Geneva).'+staleNote("series")+'</p>';
 lineChart($("pwS4WindChart"),Object.assign(hAxis(t0,n,$("pwS4WindChart")),{n,series:ser,h:230,yunit:"MW",label:FOCUS+" wind and solar output, actual vs day-ahead forecast, MW",band:null,
  tip:i=>'<b>'+tipTime(t0,i)+'</b>'+tipRows(ser.slice().reverse(),i)+(isNum(S.wind&&S.wind[i])&&isNum(S.wind_fc&&S.wind_fc[i])?'<br><span class="src">wind forecast − actual '+fst(S.wind_fc[i]-S.wind[i],0)+' MW</span>':"")}));}
function renderValue(){const box=$("pwS4Value"),R=E4(),C=R&&R.capture,D=R&&R.daily;
 if(!C&&!(D&&D.length)){box.hidden=true;box.innerHTML="";return;}box.hidden=false;
 const rows=[["Last 7 days","d7","actual"],["Last 30 days","d30","actual"],["Today","today_fc","expected"],["Tomorrow","tomorrow_fc","expected"]];
 const cell=x=>x?'<td class="num">'+fp(x.cap,1)+'</td><td class="num"><span class="pw-rate'+(isNum(x.rate)?(x.rate<0.8?" lo":x.rate>=0.95?" hi":""):"")+'">'+pct0(x.rate)+'</span></td>':'<td class="num">'+NA+'</td><td class="num">'+NA+'</td>';
 let t='<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-cap"><thead><tr><th class="c-z">Period <span class="pw-mut">€/MWh</span></th><th title="Time-average day-ahead price over the same periods, €/MWh">Baseload</th><th title="Wind-weighted day-ahead price, €/MWh">Wind capture</th><th title="Wind capture ÷ baseload">Rate</th><th title="Solar-weighted day-ahead price, €/MWh">Solar capture</th><th title="Solar capture ÷ baseload">Rate</th></tr></thead><tbody>';
 rows.forEach(([l,k,kind])=>{const r=C&&C[k];if(!r&&kind==="expected"&&k==="tomorrow_fc"){t+='<tr class="pw-dim"><th class="c-z" scope="row">'+l+' <em>expected</em></th><td class="num" colspan="5"><span class="na">needs tomorrow\'s prices and wind forecast</span></td></tr>';return;}
  const w=r&&r.wind,s=r&&r.solar;t+='<tr'+(kind==="expected"?' class="pw-exp"':"")+'><th class="c-z" scope="row">'+l+(kind==="expected"?' <em title="Weighted by the day-ahead wind forecast (A69), not by actual output">expected</em>':"")+'</th><td class="num">'+fp((w||s||{}).base,1)+'</td>'+cell(w)+cell(s)+'</tr>';});
 t+='</tbody></table></div>';
 const c30=C&&C.d30&&C.d30.wind,c7=C&&C.d7&&C.d7.wind;
 const stats=[["Wind capture · 30d",c30?fp(c30.cap,1):NA,c30?pct0(c30.rate)+" of baseload "+fpt(c30.base,1):"",EUR],["Wind capture · 7d",c7?fp(c7.cap,1):NA,c7?pct0(c7.rate)+" of baseload "+fpt(c7.base,1):"",EUR]];
 let ch="",ser=[];if(D&&D.length){ser=[{name:"Baseload (time-average)",color:COL.sys,w:1.6,vals:D.map(r=>r[1])},{name:"Wind capture price",color:COL.wind,w:2.6,end:true,vals:D.map(r=>r[2])}];
  ch='<div class="pw-mini-h pw-pad">Daily wind capture price vs baseload <em>€/MWh · '+D.length+' complete days, '+esc(sdate(D[0][0]))+' – '+esc(sdate(D[D.length-1][0]))+'</em></div><div class="pw-keys pw-pad">'+keysHtml(ser.slice().reverse())+'</div><div class="pw-chart" id="pwS4ValueChart"></div>';}
 box.innerHTML=cardHead(FOCUS+" wind capture price vs baseload",EUR,"Wind-weighted vs time-average day-ahead price · last 7 / 30 days, today and tomorrow (expected) · computed from ENTSO-E")+'<div class="pw-grid-stats pw-stats-2">'+stats.map(([a,b,c,u])=>'<div><span>'+a+'</span><b>'+b+(b!==NA?'<small> '+u+'</small>':"")+'</b><em>'+c+'</em></div>').join("")+'</div>'+t+ch+
  '<p class="pw-foot">Capture price = Σ(price × MW) ÷ Σ(MW) over 15-min periods, using ENTSO-E day-ahead prices (A44) and actual generation (A75); rate = capture ÷ baseload over the same periods. “Expected” uses the day-ahead forecast (A69) instead of actual output. Computed here, not a published series.'+staleNote("capture")+'</p>';
 if(ser.length)lineChart($("pwS4ValueChart"),{n:D.length,series:ser,zero:true,h:190,yunit:EUR,label:FOCUS+" daily wind capture price vs baseload, €/MWh",xw:54,xlab:i=>sdate(D[i][0]),
  tip:i=>{const r=D[i];return'<b>'+esc(tdlabel(r[0]))+'</b>'+tipRows(ser.slice().reverse(),i,1," €/MWh")+'<br><span class="src">capture rate '+(isNum(r[1])&&isNum(r[2])&&r[1]>0?Math.round(r[2]/r[1]*100)+"%":"n/a")+' · mean wind output '+fpt(r[3],0)+' MW'+(isNum(r[4])?' · solar capture '+fpt(r[4],1)+' €/MWh':"")+'</span>';}});}
function renderLoadEnt(box){const R=E4(),S=R&&R.series;if(!S||!S.load)return false;
 const t0=new Date(R.t0).getTime(),n=R.n,now=Math.floor((Date.now()-t0)/36e5),K=keys(),Q=R.load_qc||{},pv=Q.prov&&isNum(Q.prov[1])?Q.prov:null,dr=Q.dropped||[];
 const res=S.load.map((l,i)=>isNum(l)&&isNum(S.wind&&S.wind[i])?l-S.wind[i]-(isNum(S.solar&&S.solar[i])?S.solar[i]:0):null);
 const ser=[];if(S.load_fc)ser.push({name:"Load forecast (day-ahead)",color:COL.de,w:1.4,dash:"4 3",vals:S.load_fc});ser.push({name:"Load actual",color:COL.zone,w:2.4,end:!pv,vals:S.load});ser.push({name:"Residual (load − wind − solar)",color:COL.sys,w:1.5,vals:res});
 const pser=pv?{name:"Latest hour, provisional",color:COL.zone,w:1,dots:true,dotKey:true,r:3.4,op:.5,vals:Array.from({length:n},(_,i)=>i===pv[0]?pv[1]:null)}:null;
 const rng=[];dr.forEach(i=>{const l=rng[rng.length-1];if(l&&i===l[1]+1)l[1]=i;else rng.push([i,i]);});
 const dl=rng.slice(0,3).map(([a,b])=>esc(fdt.format(new Date(t0+a*36e5)).replace("Sept","Sep"))+"–"+esc(fhr.format(new Date(t0+(b+1)*36e5)))+":00 "+tzName(t0+a*36e5)).join("; ");
 const li=lastIdx(S.load,now),lt=dayMean(S.load,t0,K.today),lf=dayMean(S.load_fc,t0,K.today),ri=lastIdx(res,now),W=R.load_week||[];const pk=W.length?Math.max(...W.map(r=>r[2]).filter(isNum)):null;
 const ax=hAxis(t0,n,box);
 box.innerHTML=cardHead(FOCUS+" electricity demand (load) vs forecast","MW","Hourly · "+esc(hRange(t0,n))+" · "+ax.xunit+" · ENTSO-E (A65)",keysHtml(ser.slice().reverse().concat(pser?[pser]:[])))+
  svkStats([["Load latest",li>=0?fp(S.load[li],0)+" MW":NA,li>=0?fhr.format(new Date(t0+li*36e5))+":00 "+tzName(t0+li*36e5)+(pv?" · next hour provisional":""):"","Actual total load SE4 (A65), latest complete hour"+(pv?"; the newest hour ("+fp(pv[1],0)+" MW so far) is still incomplete":"")],["Load today",isNum(lt)?fp(lt,0)+" MW":NA,isNum(lf)?"DA forecast "+fp(lf,0)+" MW":"mean so far","Mean of today's hourly actual load vs the day-ahead load forecast (A65, A01)"],["Residual latest",ri>=0?fp(res[ri],0)+" MW":NA,"load − wind − solar","What other generation and imports have to cover"],["Week-ahead peak",isNum(pk)?fp(pk,0)+" MW":NA,W.length?"next "+W.length+" days":"","Week-ahead load forecast (A65, A31): daily maximum"]])+
  '<div class="pw-chart" id="pwS4LoadChart"></div>'+
  (W.length?'<div class="pw-mini-h pw-pad">Week-ahead load forecast <em>MW · daily min – max · ENTSO-E A65 week-ahead</em></div><div class="pw-wk pw-pad">'+W.map(r=>'<div><span>'+esc(dlabel(r[0]))+'</span><b>'+fpt(r[1],0)+'–'+fpt(r[2],0)+'</b></div>').join("")+'</div>':"")+
  '<p class="pw-foot">Actual total load and the day-ahead load forecast (A65), in MW; residual = load − wind − solar (what other generation and imports have to cover). Hourly means; times CET/CEST (Geneva). Data checks: 15-min load values below '+Math.round((Q.ratio||0.4)*100)+'% of the day-ahead forecast are treated as source glitches and removed'+(dr.length?' ('+dr.length+' hour'+(dr.length>1?'s':'')+' affected in this window: '+dl+(rng.length>3?"; …":"")+')':' (none in this window)')+'; the newest hour is published from incomplete metering, so it is shown as a faint provisional dot and left out of the residual.'+staleNote("series")+'</p>';
 lineChart($("pwS4LoadChart"),Object.assign(hAxis(t0,n,$("pwS4LoadChart")),{n,series:pser?ser.concat([pser]):ser,h:200,yunit:"MW",label:FOCUS+" load, forecast and residual load, MW",tip:i=>'<b>'+tipTime(t0,i)+'</b>'+tipRows(ser.slice().reverse(),i)+(pv&&i===pv[0]?'<br><i class="pw-tk" style="background:'+COL.zone+';opacity:.5"></i>Provisional (incomplete hour) <b>'+fp(pv[1],0)+'</b> MW':"")+(dr.includes(i)?'<br><span class="src">implausible values removed this hour (&lt; '+Math.round((Q.ratio||0.4)*100)+'% of forecast)</span>':"")}));return true;}
const fwd=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"2-digit",month:"short"}),fwt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false});
const fwinH=iso=>{const d=new Date(iso);return esc(fwd.format(d).replace("Sept","Sep"))+'<span class="pw-t"> '+esc(fwt.format(d))+'</span>';};
function renderOutages(){const box=$("pwS4Out"),R=E4();const tx=R&&R.outages_tx,gen=R&&R.outages_gen;
 if(!R||(!tx&&!gen)){box.hidden=true;box.innerHTML="";return;}box.hidden=false;
 const PS={wind:"Wind",solar:"Solar",nuclear:"Nuclear",hydro:"Hydro",gas:"Gas",coal:"Coal",oil:"Oil",biomass:"Biomass",waste:"Waste",other:"Other"};
 let h=cardHead(FOCUS+" outages: interconnectors and generation units","MW","ENTSO-E reported unavailability (A78, A80) · in effect now and upcoming · times CET/CEST");
 h+='<div class="pw-mini-h pw-pad">Interconnectors <em>reported unavailabilities, now and next 30 days</em></div>';
 if(tx&&tx.length){h+='<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-out"><thead><tr><th class="c-z">Direction</th><th title="Remaining cross-border capacity in this direction during the event">Avail. MW</th><th>Window <span class="pw-mut">(CET/CEST)</span></th><th>Type</th></tr></thead><tbody>'+
  tx.map(r=>'<tr class="'+(r.now?"is-now":"")+'"><th class="c-z" scope="row"><i class="pw-now" title="'+(r.now?"In effect now":"Upcoming")+'"></i>'+esc(r.frm)+' → '+esc(r.to)+'</th><td class="num">'+fp(r.avail,0)+'</td><td class="num">'+fwinH(r.start)+' → '+fwinH(r.end)+'</td><td><span class="pw-pill '+(r.type==="forced"?"forced":"")+'">'+esc(r.type)+'</span></td></tr>').join("")+'</tbody></table></div>';}
 else h+='<div class="pw-empty pw-empty-s">No interconnector unavailability reported for SE4 borders.</div>';
 h+='<div class="pw-mini-h pw-pad">Generation units in SE4 <em>aggregated by fuel, next 7 days</em></div>';
 if(gen&&gen.length){h+='<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-out"><thead><tr><th class="c-z">Fuel</th><th title="Unavailable capacity now, MW (number of events)">Out now</th><th title="Sum of the largest unavailable capacity per event starting or running in the next 7 days, MW (number of events)">Next 7 days</th><th>Planned / forced</th></tr></thead><tbody>'+
  gen.map(r=>'<tr><th class="c-z" scope="row">'+esc(PS[r.type]||r.type)+'</th><td class="num">'+(r.now_mw?fp(r.now_mw,0)+' MW <span class="pw-mut">('+r.now_n+')</span>':"0")+'</td><td class="num">'+fp(r.wk_mw,0)+' MW <span class="pw-mut">('+r.wk_n+')</span></td><td class="num">'+r.planned+' / '+r.forced+'</td></tr>').join("")+'</tbody></table></div>';}
 else h+='<div class="pw-empty pw-empty-s">No generation-unit unavailability reported for SE4.</div>';
 h+='<p class="pw-foot"><i class="pw-now on"></i> = in effect now. Planned and forced unavailabilities published on the ENTSO-E Transparency Platform (A78 transmission, A80 generation units); unit, plant and line names are not shown. Avail. MW = capacity left in that direction during the event. Times CET/CEST (Geneva).'+staleNote("outages_tx")+'</p>';
 box.innerHTML=h;}
function renderReservoirs(){const box=$("pwRes"),e=EN(),RS=e&&e.reservoirs;
 if(!RS||!Object.keys(RS).length){box.hidden=true;box.innerHTML="";return;}box.hidden=false;
 const fmtE=v=>!isNum(v)?NA:Math.abs(v)>=1000?(v/1000).toFixed(1)+'<small> TWh</small>':Math.round(v)+'<small> GWh</small>';
 const fmtD=v=>!isNum(v)?NA:(v>0?"+":v<0?"−":"")+(Math.abs(v)>=1000?(Math.abs(v)/1000).toFixed(2)+" TWh":Math.round(Math.abs(v))+" GWh");
 const agg=zs=>{const have=zs.filter(z=>RS[z]);if(have.length!==zs.length)return null;const w=RS[have[0]].w;if(!have.every(z=>RS[z].w.join()===w.join()))return null;
  const sum=k=>w.map((_,i)=>{const v=have.map(z=>RS[z][k][i]);return v.every(isNum)?v.reduce((a,b)=>a+b,0):null;});return{w,v:sum("v"),ly:sum("ly")};};
 const rows=[["SE1",RS.SE1],["SE2",RS.SE2],["SE3",RS.SE3],["SE4",RS.SE4],["Sweden",agg(SE_Z),"sum"],["NO1",RS.NO1],["NO2",RS.NO2],["NO3",RS.NO3],["NO4",RS.NO4],["NO5",RS.NO5],["Norway",agg(["NO1","NO2","NO3","NO4","NO5"]),"sum"]].filter(r=>r[1]);
 let wk=null;rows.forEach(([,r])=>{const d=r.w[r.w.length-1];if(!wk||d>wk)wk=d;});
 let h=cardHead("Hydro reservoirs · stored energy by zone","GWh / TWh","ENTSO-E weekly (A72) · week of "+esc(dlabel(wk))+" · line = last 52 weeks");
 h+='<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-res"><thead><tr><th class="c-z">Zone</th><th>Stored</th><th title="Change vs the previous week">w/w</th><th title="Same week one year earlier">vs last year</th><th class="c-spark" title="Stored energy, last 52 weeks">Last 52 wks</th></tr></thead><tbody>';
 rows.forEach(([z,r,cls])=>{const n=r.v.length,v=r.v[n-1],p=r.v[n-2],ly=r.ly[n-1];const dw=isNum(v)&&isNum(p)?v-p:null,dy=isNum(v)&&isNum(ly)?v-ly:null,py=isNum(dy)&&ly?dy/ly*100:null;
  h+='<tr class="'+(cls||"")+(z===FOCUS?" focus":"")+'"><th class="c-z" scope="row">'+esc(z)+'</th><td class="num">'+fmtE(v)+'</td><td class="num '+(isNum(dw)?(dw<0?"dn":"up"):"")+'">'+fmtD(dw)+'</td><td class="num '+(isNum(dy)?(dy<0?"dn":"up"):"")+'">'+fmtD(dy)+(isNum(py)?' <span class="pw-mut">('+(py>0?"+":"−")+Math.abs(py).toFixed(0)+'%)</span>':"")+'</td><td class="c-spark">'+sparkSvg(r.v.slice(-52),96,24).replace('aria-hidden="true"','role="img" aria-label="'+esc(z)+' stored energy, last 52 weeks"')+'</td></tr>';});
 h+='</tbody></table></div><p class="pw-foot">Weekly aggregated filling of water reservoirs and hydro storage plants (A72), energy stored at week end. Complements NVE (Norway, % with history band) and Energiföretagen (Sweden) above.'+staleNote("reservoirs")+'</p>';
 box.innerHTML=h;}
function renderEntsoe(){renderWind();renderValue();renderOutages();}

/* ---------- Nordic balance: nuclear (Nord Pool UMM), hydro vs normal, system price ---------- */
const NU=()=>P.nuclear&&P.nuclear.cap&&P.nuclear.now?P.nuclear:null;
const HB=()=>P.hydro_bal&&P.hydro_bal.areas?P.hydro_bal:null;
const C_SE="#b07cff",C_FI="#2da0aa",C_SYS="#f08848",C_HY="#4f8cff";
const fmw=v=>isNum(v)?fp(v,0):NA;
const ft1=v=>isNum(v)?v.toFixed(1):"n/a";
const fwkd=k=>{if(!k)return"";const d=new Date(k+"T12:00:00Z");return d.toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short"}).replace("Sept","Sep");};
const stale=x=>x&&x.stale?' <span class="na">(kept from an earlier build: this part failed at the last update)</span>':"";
function renderBalKpis(){$("pwBalKpis").innerHTML=balKpisHtml();}
function balKpisHtml(){let h="";const N=NU(),H=HB(),K=keys();
 if(N){const cap=N.cap.SE+N.cap.FI,now=N.now.SE+N.now.FI,off=N.units.filter(u=>u.now===0).length,red=N.units.filter(u=>u.now>0&&u.now<u.cap).length;
  h+=kpi("Nordic nuclear · available now",fmw(now)+'<small> MW</small>',Math.round(now/cap*100)+"% of "+fp(cap,0)+" MW · "+off+" offline"+(red?", "+red+" reduced":""),"pw-b"+(now/cap<0.75?" pw-dn":""),"Sweden "+fpt(N.now.SE,0)+" of "+fpt(N.cap.SE,0)+" MW, Finland "+fpt(N.now.FI,0)+" of "+fpt(N.cap.FI,0)+" MW (net capacity minus unavailability in active Nord Pool UMM messages)");
  const d7=N.d7.SE+N.d7.FI,d14=N.d14.SE+N.d14.FI;
  h+=kpi("Nuclear · next 7 / 14 days",fmw(d7)+'<small> / '+fp(d14,0)+' MW</small>',"mean available · "+Math.round(d7/cap*100)+"% / "+Math.round(d14/cap*100)+"% of capacity","pw-b","Mean available capacity over the next 7 and 14 days according to published UMMs; outages not yet announced are not included");}
 if(H&&H.nordic){const n=H.nordic;h+=kpi("Nordic hydro vs normal · wk "+n.w,fs(n.dev,1)+'<small> TWh</small>',fs(n.pct,1)+"% · "+ft1(n.twh)+" vs "+ft1(n.norm)+" TWh normal","pw-b pw-kk"+(n.dev<0?" pw-dn":" pw-up"),"Norway + Sweden + Finland reservoir energy in week "+n.w+" (from "+fwkd(n.date)+") vs the median of the same week");}
 if(NPo()){const v=dayVal("SYS",K.today),m=dayVal("SYS",K.tomorrow),a=dayVal("SE3",K.today),b=dayVal("SE4",K.today),bm=dayVal("SE4",K.tomorrow);
  h+=kpi("System price (SYS) · today",isNum(v)?fp(v)+'<small> €/MWh</small>':NA,(isNum(m)?"tmrw "+fpt(m):"tmrw ~12:45 CET")+" · SE4 − SYS "+fst(isNum(b)&&isNum(v)?b-v:null,1),"pw-b","Nord Pool official daily averages. Today "+dlabel(K.today)+": SYS "+fpt(v)+", SE3 "+fpt(a)+", SE4 "+fpt(b)+" €/MWh. Tomorrow "+dlabel(K.tomorrow)+": SYS "+fpt(m)+", SE3 "+fpt(dayVal("SE3",K.tomorrow))+", SE4 "+fpt(bm)+" €/MWh.");}
 return h;}
function renderNuc(){const box=$("pwNuc"),N=NU();
 if(!N){svkEmpty(box,"Nordic nuclear available capacity","MW","Nord Pool UMM","Nuclear availability is not available in this build.");return;}
 const D=N.days||[],capT=N.cap.SE+N.cap.FI;
 const ser=[{name:"Installed (net)",color:"var(--faint)",dash:"4 3",w:1.3,vals:D.map(()=>capT)},{name:"Finland",color:C_FI,w:1.6,vals:D.map(r=>r[2])},{name:"Sweden",color:C_SE,w:1.6,vals:D.map(r=>r[1])},{name:"Total available",color:COL.zone,w:2.6,dots:true,r:2.2,vals:D.map(r=>isNum(r[1])&&isNum(r[2])?r[1]+r[2]:null)}];
 const U=N.units||[];
 const rows=U.map(u=>{const up=new Date(u.start).getTime()>Date.now()+36e5;return'<tr><th class="c-z" scope="row">'+esc(u.n)+' <span class="pw-mut">'+esc(u.c)+'</span></th><td class="num">'+(up?'<span class="pw-mut">from </span>'+fwinH(u.start):'<b class="'+(u.now===0?"dn":"")+'">'+fp(u.now,0)+'</b><span class="pw-mut"> / '+fp(u.cap,0)+'</span>')+'</td><td class="num">'+fwinH(u.back)+(new Date(u.back).getFullYear()!==new Date().getFullYear()?' '+new Date(u.back).getFullYear():'')+'</td><td><span class="pw-pill'+(u.planned?"":" forced")+'" title="'+esc(u.why||"")+'">'+(u.planned?"planned":"unplanned")+'</span></td></tr>';}).join("");
 const sv=P.svk&&P.svk.se&&P.svk.se.nuclear;let chk="";if(sv){const t0=new Date(P.svk.t0).getTime(),li=lastIdx(sv,Math.floor((Date.now()-t0)/36e5));if(li>=0)chk=' Cross-check: Svenska kraftnät reports <b>'+fp(sv[li],0)+' MW</b> Swedish nuclear output at '+esc(fhr.format(new Date(t0+li*36e5)))+':00 '+tzName(t0+li*36e5)+' (available now per UMM: '+fp(N.now.SE,0)+' MW).';}
 box.innerHTML=cardHead("Nordic nuclear available capacity by day","MW",(D.length?esc(sdate(D[0][0]))+" – "+esc(sdate(D[D.length-1][0]))+" · ":"")+"daily mean · CET days · Sweden (6 reactors) + Finland (5) · Nord Pool UMM, "+esc(fdt.format(new Date(N.asof)).replace("Sept","Sep")),keysHtml(ser.slice().reverse()))+
  '<div class="pw-chart" id="pwNucChart"></div>'+
  '<div class="pw-mini-h pw-pad">Reactors out or reduced <em>MW now / net capacity · back = end of the published event · CET/CEST</em></div>'+
  (U.length?'<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-nuc"><thead><tr><th class="c-z">Reactor</th><th title="Available MW now / net capacity">Now <span class="pw-mut">MW</span></th><th title="Expected return to full capacity (end of the latest published event)">Back</th><th>Type</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="pw-empty pw-empty-s">All 11 reactors at full capacity per published UMMs.</div>')+
  '<p class="pw-foot">Available = net capacity minus unavailable capacity in operators\' active UMM/REMIT messages (planned and unplanned) for Forsmark, Ringhals, Oskarshamn (SE3), Olkiluoto and Loviisa (FI). Return dates are the operators\' current estimates; outages not yet announced are not included.'+chk+stale(N)+'</p>';
 if(D.length)lineChart($("pwNucChart"),{n:D.length,series:ser,h:190,ymin:0,yunit:"MW",label:"Nordic nuclear available capacity by day, MW",xall:true,xlab:i=>i%3===0&&i<D.length-1?sdate(D[i][0]):null,
  tip:i=>{const tot=ser[3].vals[i];return'<b>'+esc(tdlabel(D[i][0]))+'</b> <span class="src">mean available</span>'+tipRows(ser.slice().reverse(),i,0," MW")+(isNum(tot)?'<br><span class="src">'+Math.round(tot/capT*100)+'% of installed</span>':"");}});}
function renderHyBal(){const box=$("pwHyBal"),H=HB();
 if(!H){svkEmpty(box,"Nordic hydro reservoir energy vs normal","TWh","NVE, ENTSO-E A72","Hydro balance is not available in this build.");return;}
 const A=H.areas,n=H.nordic,W=H.weeks||[];
 const ser=[{name:"Normal (median of the week)",color:"var(--faint)",dash:"4 3",w:1.5,vals:W.map(r=>r[2])},{name:"Nordic stored",color:C_HY,w:2.6,end:true,vals:W.map(r=>r[1])}];
 const row=(lab,r,cls,t)=>!r?"":'<tr class="'+(cls||"")+'"><th class="c-z" scope="row"'+(t?' title="'+esc(t)+'"':"")+'>'+lab+'</th><td class="num">'+ft1(r.twh)+'</td><td class="num">'+ft1(r.norm)+'</td><td class="num '+(isNum(r.dev)?(r.dev<0?"dn":"up"):"")+'"><b>'+fs(r.dev,1)+'</b></td><td class="num '+(isNum(r.pct)?(r.pct<0?"dn":"up"):"")+'">'+fs(r.pct,1)+'%</td><td class="num pw-mut">'+(r.w?"wk "+r.w:"")+'</td></tr>';
 const no=A.NO;
 box.innerHTML=cardHead("Nordic hydro reservoir energy vs normal","TWh",(W.length?W.length+" weeks to week "+n.w+" (from "+esc(fwkd(n.date))+")":"")+" · weekly · Norway + Sweden + Finland · normal = median of the week · NVE, ENTSO-E A72",keysHtml(ser.slice().reverse()))+
  '<div class="pw-chart" id="pwHyBalChart"></div>'+
  '<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-hyb"><thead><tr><th class="c-z">Area <span class="pw-mut">TWh</span></th><th>Stored</th><th>Normal</th><th title="Stored − normal">Δ TWh</th><th title="Stored ÷ normal − 1">Δ %</th><th>Week</th></tr></thead><tbody>'+
  row("Norway",no,"","NVE: "+(no?ft1(no.fill)+"% full vs median "+ft1(no.fill_med)+"% ("+(no.nyears||"")+"), capacity "+ft1(no.cap)+" TWh":""))+row("Sweden",A.SE,"","ENTSO-E A72 country total; normal = median "+(A.SE&&A.SE.nyears||""))+row("Finland",A.FI,"","ENTSO-E A72 country total; normal = median "+(A.FI&&A.FI.nyears||""))+row("Nordic",n,"sum","Sum of the three at the latest week all have published")+'</tbody></table></div>'+
  '<p class="pw-foot">Norway: NVE weekly reservoir statistics (capacity '+(no?ft1(no.cap):"n/a")+' TWh; '+(no?ft1(no.fill)+'% full vs median '+ft1(no.fill_med)+'%':'')+'), normal = NVE median '+esc(no&&no.nyears||"")+'. Sweden and Finland: ENTSO-E aggregated filling of water reservoirs and hydro storage (A72, country totals), normal = median of the same ISO week '+esc(A.SE&&A.SE.nyears||"")+'. Sweden/Finland publish 1–2 weeks later than NVE, so the Nordic total uses the latest week all three cover. Denmark has no hydro storage.'+stale(H)+'</p>';
 if(W.length)lineChart($("pwHyBalChart"),{n:W.length,series:ser,h:190,yunit:"TWh",label:"Nordic hydro reservoir energy vs normal by week, TWh",xall:true,xlab:i=>i%4===1&&i<W.length-2?fwkd(W[i][0]):null,
  tip:i=>{const r=W[i];return'<b>Week from '+esc(fwkd(r[0]))+'</b>'+tipRows(ser.slice().reverse(),i,1," TWh")+(isNum(r[1])&&isNum(r[2])?'<br><span class="src">vs normal '+fst(r[1]-r[2],1)+' TWh ('+fst((r[1]/r[2]-1)*100,1)+'%)</span>':"");}});}
function renderSys(){const box=$("pwSys"),K=keys(),n=NPo();
 const ZS=[["SYS","SYS (system)",C_SYS,2.6,null],["SE3","SE3",COL.sys,1.6,null],["SE4","SE4",COL.zone,2,null],["DK2","DK2","#b07cff",1.4,"5 3"]];
 if(!n){svkEmpty(box,"Nordic system price vs SE3, SE4 and DK2",EUR,"Nord Pool","Nord Pool day-ahead data not available in this build.");return;}
 const maps=ZS.map(([z])=>{const m=new Map((Z(z)&&Z(z).daily)||[]);[K.today,K.tomorrow].forEach(k=>{const v=dayVal(z,k);if(isNum(v))m.set(k,v);});return m;});
 const ds=[...maps[0].keys()].sort().slice(-31);
 const ser=ZS.map(([z,l,c,w,d],j)=>({name:l,color:c,w,dash:d,end:z==="SYS",vals:ds.map(k=>maps[j].get(k))})).reverse();
 const tr=([z,l])=>{const a=dayVal(z,K.today),b=dayVal(z,K.tomorrow),sa=dayVal("SYS",K.today),sb=dayVal("SYS",K.tomorrow),m30=w30(z,K.today);const d=(x,y)=>z==="SYS"?'<td class="num pw-mut">—</td>':'<td class="num heat"'+heat(isNum(x)&&isNum(y)?x-y:null,40)+'>'+fs(isNum(x)&&isNum(y)?x-y:null,1)+'</td>';
  return'<tr class="'+(z==="SYS"?"sys":z===FOCUS?"focus":"")+'"><th class="c-z" scope="row">'+esc(l)+'</th><td class="num">'+fp(a)+'</td>'+d(a,sa)+'<td class="num">'+(isNum(b)?fp(b):'<span class="na">n/a</span>')+'</td>'+d(b,sb)+'<td class="num">'+fp(m30,1)+'</td></tr>';};
 const st_=n.state&&n.state[K.tomorrow];
 box.innerHTML=cardHead("Nordic system price vs SE3, SE4 and DK2",EUR,(ds.length?esc(sdate(ds[0]))+" – "+esc(sdate(ds[ds.length-1]))+" · ":"")+"daily average · CET delivery day · Nord Pool official (SYS + area averages)",keysHtml(ser))+
  '<div class="pw-chart" id="pwSysChart"></div>'+
  '<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl pw-sys"><thead><tr><th class="c-z">Area <span class="pw-mut">€/MWh</span></th><th>Today</th><th title="Area − SYS, today">− SYS</th><th>Tmrw</th><th title="Area − SYS, tomorrow">− SYS</th><th title="Mean of the 30 delivery days ending today">30d</th></tr></thead><tbody>'+ZS.map(tr).join("")+'</tbody></table></div>'+
  '<p class="pw-foot">SYS is Nord Pool\'s unconstrained Nordic system price (reference for Nordic futures); area − SYS shows the congestion premium or discount. Today '+esc(dlabel(K.today))+(K.hasM||npAvg("SYS",K.tomorrow)!=null?', tomorrow '+esc(dlabel(K.tomorrow))+(st_&&st_!=="Final"?" ("+esc(st_.toLowerCase())+")":""):'; tomorrow is published after the day-ahead auction (~12:45 CET)')+'. Source: Nord Pool day-ahead (data.nordpoolgroup.com); 30d uses the daily averages kept by this page.'+stale(n)+'</p>';
 if(ds.length)lineChart($("pwSysChart"),{n:ds.length,series:ser,h:190,zero:true,yunit:EUR,label:"Nordic system price vs SE3, SE4 and DK2, daily average, €/MWh",xlab:i=>sdate(ds[i]),xw:54,
  tip:i=>{const s=maps[0].get(ds[i]),a=maps[2].get(ds[i]);return'<b>'+esc(tdlabel(ds[i]))+'</b>'+(ds[i]===K.tomorrow?' <span class="src">tomorrow</span>':ds[i]===K.today?' <span class="src">today</span>':"")+'<br><span class="src">day-ahead daily average</span>'+tipRows(ser,i,2," €/MWh")+(isNum(s)&&isNum(a)?'<br><span class="src">SE4 − SYS '+fst(a-s)+' €/MWh</span>':"");}});}
function renderBal(){renderBalKpis();renderNuc();renderHyBal();renderSys();}
/* ---------- wind and solar: DK1/DK2 (Energinet) and FI (Fingrid / ENTSO-E) ---------- */
function renderRen(){const box=$("pwRen"),R=P.renew;
 if(!R||!R.zones||!Object.keys(R.zones).length){box.hidden=true;box.innerHTML="";return;}box.hidden=false;
 const zs=["DK1","DK2","FI"].filter(z=>R.zones[z]);if(!zs.includes(st.rz))st.rz=zs[0];
 const z=st.rz,S=R.zones[z],t0=new Date(R.t0).getTime(),n=R.n,now=Math.floor((Date.now()-t0)/36e5),K=keys();
 const lab=S.fc==="latest"?"latest forecast":"day-ahead forecast";
 const ser=[];if(S.solar_fc)ser.push({name:"Solar "+lab,color:SOLAR_C,w:1.2,dash:"4 3",op:.8,vals:S.solar_fc});if(S.solar)ser.push({name:"Solar actual",color:SOLAR_C,w:1.6,vals:S.solar});
 if(S.wind_fc)ser.push({name:"Wind "+lab,color:COL.wind,w:1.5,dash:"5 3",op:.85,vals:S.wind_fc});if(S.wind)ser.push({name:"Wind actual",color:COL.wind,w:2.6,end:true,vals:S.wind});
 const li=lastIdx(S.wind,now),wt=dayMean(S.wind_fc,t0,K.today),wa=dayMean(S.wind,t0,K.today),wm=dayMean(S.wind_fc,t0,K.tomorrow);
 const sp=k=>{const a=S.solar_fc||S.solar;if(!a)return null;let m=null;a.forEach((v,i)=>{if(isNum(v)&&fymd.format(new Date(t0+i*36e5))===k)m=Math.max(m||0,v);});return m;};const spt=sp(K.today);
 const ax=hAxis(t0,n,box);
 const foot=z==="FI"?(/Fingrid/.test(S.src)?'Fingrid open data (CC BY 4.0): wind generation (dataset 75) and the wind forecast updated every 15 minutes (dataset 245); hourly means.':'Fingrid\'s open-data API needs a free key that is not configured yet, so Finland uses ENTSO-E actual generation (A75) and the TSO day-ahead forecast (A69) instead; it switches to Fingrid automatically once the key is added.'):'Energinet Energi Data Service: 5-min real-time production (onshore + offshore wind, solar) as hourly means, vs Energinet\'s day-ahead forecast. The current, incomplete hour is left out.';
 box.innerHTML=cardHead(z+" wind and solar output vs forecast","MW","Hourly · "+esc(hRange(t0,n))+" · "+ax.xunit+" · "+esc(S.src),keysHtml(ser.slice().reverse()),seg("pwRenZ",zs.map(q=>[q,q]),z))+
  svkStats([["Wind latest",li>=0?fp(S.wind[li],0)+" MW":NA,li>=0?fhr.format(new Date(t0+li*36e5))+":00 "+tzName(t0+li*36e5)+" · actual":"","Latest complete hour of actual wind generation"],
   ["Wind today",isNum(wt)?fp(wt,0)+" MW":NA,isNum(wa)?"actual so far "+fp(wa,0)+" MW":"forecast, mean of the day","Mean forecast wind output today vs actual so far"],
   ["Wind tomorrow",isNum(wm)?fp(wm,0)+" MW":NA,isNum(wm)?"forecast, mean of the day":"not published yet","Mean forecast wind output tomorrow"],
   ["Solar peak today",isNum(spt)?fp(spt,0)+" MW":NA,S.solar_fc?"forecast":"actual","Highest hourly solar output today"]])+
  '<div class="pw-chart" id="pwRenChart"></div><p class="pw-foot">'+foot+' Times CET/CEST (Geneva).'+stale(R)+'</p>';
 bindSeg("pwRenZ",k=>{st.rz=k;save();renderRen();});
 lineChart($("pwRenChart"),Object.assign(hAxis(t0,n,$("pwRenChart")),{n,series:ser,h:210,yunit:"MW",label:z+" wind and solar output vs forecast, MW",
  tip:i=>'<b>'+tipTime(t0,i)+'</b> <span class="src">'+esc(z)+'</span>'+tipRows(ser.slice().reverse(),i)}));}
/* ---------- Grid & DC (data/griddc.json, daily): connection registers, solar tenders, data-centre announcements ---------- */
let G=null,BX=null,PL=null,MS=null,BL=null,EV=null,HN=null,FW=null;
const MONS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const gdD=s=>{if(!s)return"n/a";const[y,m,d]=s.split("-");return(d?(+d)+" ":"")+MONS[+m-1]+" "+y;};
const gdM=s=>{if(!s)return"";const[y,m]=s.split("-");return MONS[+m-1]+" "+y.slice(2);};
const gdW=v=>isNum(v)?v.toLocaleString("en-US",{maximumFractionDigits:v<100?1:0}):"n/a";
const lnk=(u,t)=>u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+t+'</a>':t;
const gUrl=u=>!u?"":u.startsWith("g:")?"https://news.google.com/rss/articles/"+u.slice(2):u;
const GST=[["Built","Built","var(--pw-st-built)"],["Under Construction/Commissioning","Under construction","var(--pw-st-uc)"],["Consents Approved","Consents approved","var(--pw-st-ca)"],["Awaiting Consents","Awaiting consents","var(--pw-st-ac)"],["Scoping","Scoping","var(--pw-st-sc)"]];
const GCAT={B:"Battery",SB:"Solar + battery",S:"Solar",D:"Demand + other"};
const GKEY=(n,c)=>'<span class="pw-key"><i class="gd-sw" style="background:'+c+'"></i>'+esc(n)+'</span>';
function bindTips(box){box.querySelectorAll("[data-tip]").forEach(el=>{el.addEventListener("pointermove",e=>showTip(el.dataset.tip,e));el.addEventListener("pointerleave",hideTip);});}
/* stacked horizontal bars: rows [[label, [[value, colour, tipHtml]...]]] */
function hbars(rows,unit){const mx=Math.max(1,...rows.map(r=>r[1].reduce((a,s)=>a+(s[0]||0),0)));
 return'<div class="gd-bars">'+rows.map(([l,segs,tot])=>{const t=segs.reduce((a,s)=>a+(s[0]||0),0);
  return'<div class="gd-row"><span class="gd-lab">'+l+'</span><span class="gd-trk">'+segs.filter(s=>s[0]>0).map(s=>'<i style="width:'+(s[0]/mx*100).toFixed(2)+'%;background:'+s[1]+'" data-tip="'+esc(s[2])+'"></i>').join("")+'</span><span class="gd-val">'+(tot||gdW(t))+'<small> '+unit+'</small></span></div>';}).join("")+'</div>';}
function renderGdUK(){const box=$("gdUK"),U=G&&G.uk;if(!U){box.innerHTML=cardHead("Great Britain connection pipeline: solar, battery and demand","MW","NESO registers")+'<div class="pw-empty">No data yet</div>';return;}
 const R=U.regs||{},rd=Object.values(R).map(r=>r.date).sort().pop();
 const rows=["B","SB","S","D"].filter(c=>U.summary[c]).map(c=>{const s=U.summary[c];const tot=GST.reduce((a,[k])=>a+((s[k]||[0,0])[1]),0),n=GST.reduce((a,[k])=>a+((s[k]||[0,0])[0]),0);
  return[esc(GCAT[c])+' <em>'+n+'</em>',GST.map(([k,l,col])=>{const v=s[k]||[0,0];return[v[1],col,'<b>'+esc(GCAT[c])+' · '+esc(l)+'</b><br>'+gdW(v[1])+' MW · '+v[0]+' entries'];}),gdW(tot)];});
 const IC=U.ic;let icTxt="";if(IC){const s=IC.status,b=(s.Built||[0,0]),p=Object.entries(s).filter(([k])=>k!=="Built").reduce((a,[,v])=>[a[0]+v[0],a[1]+v[1]],[0,0]);icTxt='Interconnectors ('+lnk(IC.url,"register")+'): '+b[0]+' built, '+gdW(b[1])+' MW import; '+p[0]+' in the pipeline, '+gdW(p[1])+' MW.';}
 const ch=U.changes||[],LD=U.last_diff;
 const chT=ch.length?'<div class="pw-tbl-wrap gd-scroll"><table class="pw-tbl gd-tbl"><thead><tr><th class="c-z">Change</th><th class="c-z">Project</th><th class="c-z">Type</th><th>MW</th><th>Connection</th><th class="c-z">Status</th><th class="c-z">Site</th><th>Seen</th></tr></thead><tbody>'+
  ch.map(c=>'<tr><td class="c-z"><span class="gd-tag '+(c.t==="new"?"new":"chg")+'">'+(c.t==="new"?"New":"Changed: "+esc(c.f.join(", ")))+'</span></td><td class="c-z gd-name" title="'+esc(c.pn)+'">'+esc(c.n)+'</td><td class="c-z mm">'+esc(GCAT[c.c])+'</td><td class="num">'+gdW(c.mw)+'</td><td class="num">'+gdD(c.d)+'</td><td class="c-z mm">'+esc(c.s)+'</td><td class="c-z mm gd-site">'+esc(c.site)+'</td><td class="num mm">'+gdD(c.seen)+'</td></tr>').join("")+'</tbody></table></div>'
  :'<div class="gd-note">No new or changed entries yet. Changes are flagged against the register file read by the previous build; tracking started with the register published '+gdD(U.baseline)+'. NESO updates the registers about twice a week.</div>';
 const nx=U.next||[];
 const nxT='<div class="pw-tbl-wrap gd-scroll"><table class="pw-tbl gd-tbl"><thead><tr><th class="c-z">Project</th><th class="c-z">Type</th><th>MW</th><th>Connection</th><th class="c-z">Status</th><th class="c-z">Site</th></tr></thead><tbody>'+
  nx.map(r=>'<tr><td class="c-z gd-name">'+esc(r.n)+'</td><td class="c-z mm">'+esc(GCAT[r.c])+'</td><td class="num">'+gdW(r.mw)+'</td><td class="num">'+gdD(r.d)+'</td><td class="c-z mm">'+esc(r.s)+'</td><td class="c-z mm gd-site">'+esc(r.site)+(r.r==="E"?' <em>(embedded)</em>':'')+'</td></tr>').join("")+'</tbody></table></div>';
 const pubs=(U.pubs||[]);
 box.innerHTML=cardHead("Great Britain connection pipeline: solar, battery and demand","MW","Registers published "+gdD(rd)+" · cumulative contracted MW by status · NESO "+lnk(R.T&&R.T.page,"TEC register")+" + "+lnk(R.E&&R.E.page,"embedded register"),GST.map(([,l,c])=>GKEY(l,c)).join(""))+
  '<div class="gd-pad">'+hbars(rows,"MW")+'<p class="pw-foot gd-foot0">Entries whose plant type includes PV, energy storage or demand ('+U.n.toLocaleString("en-US")+' of the two registers). Of these, '+U.demand[0]+' entries ('+gdW(U.demand[1])+' MW) are also flagged demand, mostly storage that imports. Demand-only connections such as data centres are not part of these registers. '+icTxt+'</p></div>'+
  '<div class="gd-two"><div><div class="pw-mini-h">New or changed entries <em>'+(LD?'last change '+gdD(LD.date)+': '+LD.new+' new, '+LD.chg+' changed, '+LD.removed+' removed':'vs the previous build · last 90 days')+'</em></div>'+chT+'</div>'+
  '<div><div class="pw-mini-h">Next to connect <em>not yet built · effective date in the next 12 months · first '+nx.length+'</em></div>'+nxT+'</div></div>'+
  '<div class="pw-mini-h">NESO connections publications <em>last 90 days · NESO news (Connections) and publications feed</em></div>'+
  (pubs.length?'<ul class="gd-list">'+pubs.map(p=>'<li><span class="gd-d">'+gdD(p.d)+'</span>'+lnk(p.u,esc(p.h))+' <em>'+esc(p.src)+'</em></li>').join("")+'</ul>':'<div class="gd-note">None in the last 90 days.</div>');
 bindTips(box);}
/* solar tenders DE + FR on one dated axis: prices (€/MWh or ct/kWh; 1 ct/kWh = 10 €/MWh exactly) and volumes */
const SOLU=()=>st.gdu==="ct"?"ct/kWh":"€/MWh";const solV=v=>isNum(v)?(st.gdu==="ct"?v/10:v):null;
const solF=v=>isNum(v)?fpt(v,st.gdu==="ct"?2:1):"n/a";
function solRounds(){const R=[],D=G&&G.de&&G.de.solar,C=(G&&G.fr&&G.fr.cre)||{};
 ((D&&D.rounds)||[]).forEach(r=>R.push({k:"de",d:r.r+"-01",tn:"Germany · ground-mounted",rd:"Bid date "+gdD(r.r+"-01"),vol:r.vol,aw:r.aw,bid:r.bid,n:r.n,avg:r.avg*10,lo:r.lo*10,hi:r.hi*10,cap:r.cap*10,u:D.url,unit:"ct"}));
 [["sol","fs","France · ground-mounted"],["bat","fb","France · rooftop > 500 kWc"]].forEach(([k,id,l])=>((C[k]&&C[k].periods)||[]).forEach(p=>R.push({k:id,d:p.d,tn:l,rd:p.p+"e period",vol:p.called,aw:p.mw,n:p.n,avg:p.avg,u:p.u,unit:"eur"})));
 return R.filter(r=>r.d&&isNum(r.avg)).sort((a,b)=>a.d.localeCompare(b.d));}
const SOLS=[["de","Germany · BNetzA ground-mounted (volume-weighted average award)","var(--accent)"],["fs","France · CRE ground-mounted (average of retained bids)","var(--pw-de)"],["fb","France · CRE rooftop > 500 kWc (average of retained bids)","var(--good)"]];
/* dated chart: x = calendar time, points joined per series; kind "bar" draws thin bars from 0 */
function tChart(el,o){const W=Math.max(280,el.clientWidth||600),H=o.h||200,m={l:46,r:14,t:24,b:24};const P=o.series.flatMap(s=>s.pts.map(p=>[s,...p]));
 if(!P.length){el.innerHTML='<div class="pw-empty">No data available</div>';return;}
 const t0=Math.min(...P.map(p=>p[1])),t1=Math.max(...P.map(p=>p[1]));const pad=(t1-t0)*.02+864e5*20;const a=t0-pad,b=t1+pad;const X=t=>m.l+(t-a)/(b-a)*(W-m.l-m.r);
 const vs=P.map(p=>p[2]).concat(o.bar?[0]:[]);const extra=o.extra||[];extra.forEach(v=>isNum(v)&&vs.push(v));let[lo,hi,ticks]=nice(Math.min(...vs),Math.max(...vs),W<520?4:5);const Y=v=>m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b);
 let s='<svg class="pw-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+esc(o.label)+'">';
 ticks.forEach(t=>{s+='<line class="g" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(t).toFixed(1)+'" y2="'+Y(t).toFixed(1)+'"/><text class="yt" x="'+(m.l-6)+'" y="'+(Y(t)+3.5).toFixed(1)+'">'+(o.yfmt?o.yfmt(t):t)+'</text>';});
 s+='<text class="yu" x="2" y="12">'+esc(o.yunit)+'</text>';
 const y0=new Date(a).getUTCFullYear()+1,y1=new Date(b).getUTCFullYear();const yst=Math.max(1,Math.ceil((y1-y0+1)/((W-m.l-m.r)/44)));
 for(let y=y0;y<=y1;y++){const x=X(Date.UTC(y,0,1));s+='<line class="vg" x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+m.t+'" y2="'+(H-m.b)+'"/>';if((y-y0)%yst===0&&x<W-m.r-14)s+='<text class="xt" x="'+(x+3).toFixed(1)+'" y="'+(H-m.b+14)+'" style="text-anchor:start">'+y+'</text>';}
 o.series.forEach((se,si)=>{const q=se.pts;if(o.bar){const bw=Math.max(2,Math.min(6,(W-m.l-m.r)/160));q.forEach(p=>{s+='<rect x="'+(X(p[0])-bw/2+(si-1)*bw*.0).toFixed(1)+'" y="'+Y(p[1]).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0,Y(0)-Y(p[1])).toFixed(1)+'" style="fill:'+se.color+'" rx="1"/>';});return;}
  if(se.dash&&q.length)s+='<path class="ln" d="'+q.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("")+'" style="stroke:'+se.color+';stroke-width:1.4;stroke-dasharray:'+se.dash+'"/>';
  else if(q.length){s+='<path class="ln" d="'+q.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("")+'" style="stroke:'+se.color+';stroke-width:1.8;opacity:.85"/>';q.forEach(p=>{s+='<circle cx="'+X(p[0]).toFixed(1)+'" cy="'+Y(p[1]).toFixed(1)+'" r="2.8" style="fill:'+se.color+'"/>';});}});
 s+='<line class="hair" x1="0" x2="0" y1="'+m.t+'" y2="'+(H-m.b)+'" visibility="hidden"/><rect class="hit" x="'+m.l+'" y="'+m.t+'" width="'+(W-m.l-m.r)+'" height="'+(H-m.t-m.b)+'"/></svg>';
 el.innerHTML=s;const svg=el.querySelector("svg"),hair=svg.querySelector(".hair"),hit=svg.querySelector(".hit");const tp=P.filter(p=>p[3]);
 hit.addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)*W/r.width,py=(e.clientY-r.top)*H/r.height;let bi=null,bd=1e9;tp.forEach(p=>{const d=Math.hypot(X(p[1])-px,(Y(p[2])-py)*(o.bar?.15:.6));if(d<bd){bd=d;bi=p;}});if(!bi)return;const x=X(bi[1]).toFixed(1);hair.setAttribute("x1",x);hair.setAttribute("x2",x);hair.setAttribute("visibility","visible");showTip(bi[3],e);});
 hit.addEventListener("pointerleave",()=>{hair.setAttribute("visibility","hidden");hideTip();});}
function renderGdSol(){const box=$("gdSol");if(!box)return;const R=solRounds();if(!R.length){box.innerHTML=cardHead("Solar tender award prices, Germany and France",SOLU(),"BNetzA and CRE results")+'<div class="pw-empty">No tender results available.</div>';return;}
 const ms=d=>Date.parse(d+"T00:00:00Z"),u=SOLU();
 const tip=r=>'<b>'+esc(r.tn)+'</b><br>'+esc(r.rd)+(r.k==="de"?"":" · CRE report "+gdD(r.d))+'<br>Average price <b>'+fpt(r.avg/10,2)+' ct/kWh = '+fpt(r.avg,1)+' €/MWh</b>'+(isNum(r.lo)?'<br>Lowest / highest '+fpt(r.lo/10,2)+' / '+fpt(r.hi/10,2)+' ct/kWh':'')+(isNum(r.cap)?'<br>Ceiling '+fpt(r.cap/10,2)+' ct/kWh ('+fpt(r.cap,1)+' €/MWh)':'')+'<br>'+(r.k==="de"?'Awarded '+gdW(r.aw)+' MW of '+gdW(r.vol)+' MW tendered':'Retained '+gdW(r.aw)+' MWc of '+gdW(r.vol)+' MWc sought');
 const ser=SOLS.map(([k,l,c])=>({name:l,color:c,dotKey:true,pts:R.filter(r=>r.k===k).map(r=>[ms(r.d),solV(r.avg),tip(r)])})).filter(x=>x.pts.length);
 const capS={name:"Germany ceiling price",color:"var(--bad)",dash:"1 3",pts:R.filter(r=>r.k==="de"&&isNum(r.cap)).map(r=>[ms(r.d),solV(r.cap)])};
 const vser=SOLS.map(([k,l,c])=>({name:l,color:c,pts:R.filter(r=>r.k===k&&isNum(r.aw)).map(r=>[ms(r.d),r.aw,tip(r)])})).filter(x=>x.pts.length);
 const first=R[0].d,last=R[R.length-1].d,de=R.filter(r=>r.k==="de"),fs=R.filter(r=>r.k!=="de");
 const unitSeg=seg("gdSolU",[["eur","€/MWh"],["ct","ct/kWh"]],st.gdu==="ct"?"ct":"eur");
 box.innerHTML=cardHead("Solar tender award prices, Germany and France",u,MONS[+first.slice(5,7)-1]+" "+first.slice(0,4)+" – "+MONS[+last.slice(5,7)-1]+" "+last.slice(0,4)+" · one point per round · Germany at the bid date, France at the CRE report date · converted at <b>1 ct/kWh = 10 €/MWh</b> · "+lnk(G.de.solar&&G.de.solar.url,"Bundesnetzagentur")+", "+lnk("https://www.cre.fr/documents/appels-doffres.html","CRE"),keysHtml(ser.map(x=>({name:x.name,color:x.color,dotKey:true})).concat([capS])),unitSeg)+
  '<div class="pw-chart" id="gdSolChart"></div>'+
  '<div class="pw-mini-h">Volume awarded per round <em>MW (Germany) / MWc (France) · bars at the same dates</em></div><div class="pw-chart" id="gdSolVol"></div>'+
  '<div class="pw-mini-h">All rounds <em>newest first · '+de.length+' German, '+fs.length+' French rounds · prices in ct/kWh and €/MWh</em></div>'+
  '<div class="pw-tbl-wrap gd-scroll"><table class="pw-tbl gd-tbl"><thead><tr><th class="c-z">Tender</th><th class="c-z">Round</th><th>Date</th><th>Tendered / sought</th><th>Awarded / retained</th><th>Bids MW</th><th>Awards</th><th>Avg ct/kWh</th><th>Avg €/MWh</th><th>Range ct/kWh</th><th>Ceiling ct/kWh</th></tr></thead><tbody>'+
  R.slice().reverse().map(r=>'<tr><td class="c-z">'+esc(r.tn)+'</td><td class="c-z">'+lnk(r.u,esc(r.k==="de"?"BNetzA":r.rd))+'</td><td class="num mm">'+gdD(r.d)+'</td><td class="num">'+gdW(r.vol)+'</td><td class="num">'+gdW(r.aw)+'</td><td class="num mm">'+gdW(r.bid)+'</td><td class="num mm">'+(isNum(r.n)?r.n:"n/a")+'</td><td class="num"><b>'+fpt(r.avg/10,2)+'</b></td><td class="num"><b>'+fpt(r.avg,1)+'</b></td><td class="num mm">'+(isNum(r.lo)?fpt(r.lo/10,2)+'–'+fpt(r.hi/10,2):"n/a")+'</td><td class="num mm">'+(isNum(r.cap)?fpt(r.cap/10,2):"n/a")+'</td></tr>').join("")+'</tbody></table></div>'+
  '<p class="pw-foot">Germany: Bundesnetzagentur rounds for ground-mounted solar (first segment), pay-as-bid; the award value is set in ct/kWh, shown here ×10 as €/MWh. France: CRE synthesis report of each PPE2 tender period, the volume-weighted average price of the bids CRE proposes to retain, set in €/MWh, shown here ÷10 as ct/kWh. Germany from 2017; France from the reports CRE lists with a readable totals table.</p>';
 tChart($("gdSolChart"),{series:ser.concat(capS.pts.length?[capS]:[]),h:($("gdSolChart").clientWidth||600)<520?220:260,yunit:u,yfmt:v=>st.gdu==="ct"?fpt(v,v%1?1:0):v,label:"Solar tender average award prices, Germany and France, "+u});
 tChart($("gdSolVol"),{series:vser,bar:true,h:140,yunit:"MW",yfmt:v=>gdW(v),label:"Solar tender volume awarded per round, MW"});
 bindSeg("gdSolU",k=>{st.gdu=k==="ct"?"ct":"eur";save();renderGdSol();});}
function renderGdDE(){const box=$("gdDE"),D=G&&G.de;if(!D){box.innerHTML="";return;}
 const nt=D.notices||[];
 box.innerHTML=cardHead("Germany: TSO grid-connection notices","",'last 90 days · press items from Amprion, TenneT and TransnetBW')+
  (nt.length?'<ul class="gd-list">'+nt.map(p=>'<li><span class="gd-d">'+gdD(p.d)+'</span>'+lnk(p.u,esc(p.h))+' <em>'+esc(p.src)+'</em></li>').join("")+'</ul>':'<div class="gd-note">None in the last 90 days.'+(D.latest?' Latest: '+gdD(D.latest.d)+', '+esc(D.latest.src)+': '+lnk(D.latest.u,esc(D.latest.h)):'')+'</div>')+
  '<p class="pw-foot">Press items mentioning grid connection, connection capacity or the maturity procedure (Reifegradverfahren). 50Hertz is not covered: its press list loads in the browser and its RSS feed needs a login. Solar tender results are in the block above.</p>';}
function renderGdFR(){const box=$("gdFR"),F=G&&G.fr;if(!F){box.innerHTML="";return;}
 const Q=F.queue,QR=(Q&&Q.regions)||[];
 const QC=[["pv","Solar","var(--pw-de)"],["won","Onshore wind","var(--pw-wind)"],["wof","Offshore wind","var(--accent)"],["oth","Other","var(--faint)"]];
 const RSH={"Nouvelle-Aquitaine":"N.-Aquitaine","Bourgogne-Franche-Comté":"Bourgogne-FC","Centre-Val de Loire":"Centre-VdL","Auvergne-Rhône-Alpes":"Auvergne-RA","Provence-Alpes-Côte d'Azur":"PACA","Hauts-de-France":"Hauts-de-Fr."};
 const qrows=QR.map(([reg,v])=>[RSH[reg]?'<span class="gd-full">'+esc(reg)+'</span><span class="gd-short" title="'+esc(reg)+'">'+esc(RSH[reg])+'</span>':esc(reg),QC.map(([k,l,col])=>[v[k][0]+v[k][1],col,'<b>'+esc(reg)+' · '+l+'</b><br>'+gdW(v[k][0]+v[k][1])+' MW in the queue<br>RTE (transmission) '+gdW(v[k][0])+' MW · distribution '+gdW(v[k][1])+' MW'])]);
 const tot=QR.reduce((a,[,v])=>a+QC.reduce((b,[k])=>b+v[k][0]+v[k][1],0),0);
 box.innerHTML=cardHead("France: renewable connection queue by region","MW","projects in development at "+gdD(Q&&Q.asof)+" · RTE + distribution · total "+gdW(tot)+" MW · "+lnk(Q&&Q.url,"ODRE"))+
  '<div class="pw-keys pw-pad">'+QC.map(([,l,c])=>GKEY(l,c)).join("")+'</div><div class="gd-pad">'+hbars(qrows,"MW")+'</div>'+
  '<p class="pw-foot">The queue counts RTE projects with an accepted connection offer or queue entry and distribution projects with a complete connection request. Not covered: Caparéseau (map application, no data download) and RTE connection notices (news list loads in the browser, no feed).</p>';
 bindTips(box);}
function renderGdDC(){const box=$("gdDC"),L=(G&&G.dc)||[];const cz=st.gdc||"all";
 const seg_=seg("gdDCSeg",[["all","All"],["UK","UK"],["DE","DE"],["FR","FR"]].map(([k,l])=>[k,l+(k==="all"?"":" ("+L.filter(x=>x.c===k).length+")"),k!=="all"&&!L.some(x=>x.c===k)]),cz);
 const R=L.filter(x=>cz==="all"||x.c===cz);
 box.innerHTML=cardHead("Data-centre announcements: UK, Germany and France","MW","Last 90 days · headlines that state a capacity · Google News, DCD and this site's deal-flow feed","",seg_)+
  (R.length?'<div class="pw-tbl-wrap"><table class="pw-tbl gd-tbl gd-dc"><thead><tr><th class="c-z">Date</th><th class="c-z">Ctry</th><th class="c-z">Headline</th><th class="c-z">Developer*</th><th class="c-z">Location*</th><th>MW</th><th class="c-z">Grid*</th><th>€/MW</th></tr></thead><tbody>'+
  R.map(x=>{const pm=x.pm;return'<tr><td class="c-z mm">'+gdD(x.d)+'</td><td class="c-z">'+x.c+'</td><td class="c-z gd-hl">'+lnk(gUrl(x.u),esc(x.h))+' <em>'+esc(x.pub||x.src)+'</em></td><td class="c-z">'+(x.dev?esc(x.dev):'<span class="na">—</span>')+'</td><td class="c-z">'+(x.loc?esc(x.loc):'<span class="na">—</span>')+'</td><td class="num">'+gdW(x.mw)+'</td><td class="c-z mm">'+(x.grid?esc(x.grid):'<span class="na">—</span>')+'</td><td class="num">'+(pm?'<span title="'+esc(pm.amt+" ("+pm.ccy+", "+pm.fx+" per EUR) ÷ "+pm.mw+" MW")+'">€'+(pm.eur_mw/1e6).toFixed(1)+'m</span><br><em>'+esc(pm.amt)+' ÷ '+gdW(pm.mw)+' MW</em>':'<span class="na">—</span>')+'</td></tr>';}).join("")+'</tbody></table></div>':'<div class="pw-empty">No announcements with a stated capacity in the last 90 days.</div>')+
  '<p class="pw-foot">*From the headline only: developer = the company named as the subject (left blank when it could be a place), location = the place named, grid = grid or power-connection wording. MW is the capacity stated in the headline (IT load or grid capacity, as published). €/MW is shown only when the headline states both an amount and a capacity, converted at the site\'s daily FX rate shown in the tooltip.</p>';
 bindSeg("gdDCSeg",k=>{st.gdc=k;renderGdDC();});}
/* data-centre items from the shared deal-flow feed (data/dealflow.json, loaded once by dealflow.js) */
const DC_RE=/data ?cent(re|er)s?|datacenter|rechenzent|centres? de données|hyperscale|AI campus|campus IA/i;
function dcDeals(){const D=window.MMDeals&&MMDeals.peek&&MMDeals.peek();return D&&D.items?D.items.filter(it=>DC_RE.test(it.h||"")):null;}
function renderGdDeals(){const box=$("gdDCDeals");if(!box)return;const L=dcDeals();const D=window.MMDeals&&MMDeals.peek&&MMDeals.peek();
 if(!L){box.innerHTML=cardHead("Data-centre items in the deal-flow feed","","company announcements and news mentioning data centres")+'<div class="pw-empty">Loading deal flow…</div>';if(window.MMDeals&&!renderGdDeals.l){renderGdDeals.l=1;MMDeals.load().then(()=>{renderGdDeals();window.MMHome&&MMHome.render();}).catch(()=>{box.innerHTML=cardHead("Data-centre items in the deal-flow feed","","")+'<div class="pw-empty">Deal flow not available.</div>';});}return;}
 box.innerHTML=cardHead("Data-centre items in the deal-flow feed","",'company announcements mentioning data centres · last '+((D&&D.window_days)||30)+' days · same feed as the Equities deal flow')+
  (L.length?'<ul class="df-list gd-dfl">'+L.slice(0,12).map(it=>MMDeals.itemHtml(it)).join("")+'</ul>':'<div class="gd-note">No deal-flow item mentions a data centre in the last '+((D&&D.window_days)||30)+' days.</div>');}
/* battery storage build costs: static, hand-maintained data/bess_capex.json (source URL + date per figure) */
const BCOL={"2h":"var(--accent)","4h":"var(--good)","6h":"var(--pw-de, #e0a030)","8h":"var(--bad)"};
function renderGdBess(){const a=$("gdBessGB"),b=$("gdBessGl");if(!a||!b)return;if(!BX){a.innerHTML=b.innerHTML='<div class="pw-empty">Battery cost data not available.</div>';return;}
 const g=BX.gb,y=g.years,ser=Object.keys(g.series).map(k=>({name:k+" duration",color:BCOL[k]||"var(--muted)",vals:g.series[k]}));
 a.innerHTML=cardHead(esc(g.title),"£/kW",y[0]+"–"+y[y.length-1]+" · yearly · "+esc(g.basis)+" prices · source: "+lnk(g.url,esc(g.source))+" (published "+esc(gdD(g.date))+"; "+lnk(g.data_url,"chart data")+")",keysHtml(ser))+'<div class="pw-chart" id="gdBessChart"></div>'+
  '<p class="pw-foot">All-in capex per kW of power capacity for a GB battery by storage duration, as modelled by the source; real 2025 pounds.</p>';
 lineChart($("gdBessChart"),{n:y.length,series:ser,h:210,yunit:"£/kW",label:g.title+", £/kW, real 2025",xlab:i=>(i%5===0&&i<y.length-1)?String(y[i]):"",xw:40,
  tip:i=>'<b>'+y[i]+'</b> <span class="src">£/kW, real 2025</span>'+ser.map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>£'+fpt(s.vals[i],0)+'/kW</b>').join("")});
 const G2=BX.glob,DE=BX.de,cur=(c,v)=>esc(c.replace("k",""))+fpt(v,0)+"k";
 const tr=(reg,r,c,irr)=>'<tr><td class="c-z">'+reg+'</td><td class="c-z">'+esc(r.d)+'</td><td class="num">'+(r.mwh!=null?cur(c,r.mwh):'<span class="na">—</span>')+'</td><td class="num">'+cur(c,r.mw)+(r.mw_note?'<sup title="'+esc(r.mw_note)+'">*</sup>':'')+'</td><td class="num">'+(irr&&r.irr!=null?fpt(r.irr,1)+"%":'<span class="na">—</span>')+'</td></tr>';
 b.innerHTML=cardHead("Battery storage all-in capex: global and Germany","US$ / €",'Global: survey medians, '+esc(gdD(G2.date))+', '+lnk(G2.url,"Modo Energy")+(DE?' · Germany: '+esc(DE.title.replace(/^Germany, /,""))+', '+esc(gdD(DE.date))+', '+lnk(DE.url,"Modo Energy"):"")+' · original currencies, no conversion')+
  '<div class="pw-tbl-wrap pw-pad"><table class="pw-tbl"><thead><tr><th class="c-z">Region</th><th class="c-z">Duration</th><th>Capex / MWh</th><th>Capex / MW</th><th title="Unlevered project IRR">Unlev. IRR</th></tr></thead><tbody>'+
  G2.rows.map(r=>tr("Global, Sep 2026",r,r.ccy)).join("")+(DE?DE.rows.map(r=>tr("Germany, 2026 COD",r,r.ccy,1)).join(""):"")+'</tbody></table></div>'+
  '<p class="pw-foot">Global: '+esc(G2.premium.txt)+' <b>'+G2.premium.now+'%</b> ('+G2.premium.prev+'% in '+G2.premium.prev_year+'); all-in = containerised BESS, balance of plant and grid connection.'+(DE?' Germany (Modo central assumptions): 4h capex '+DE.premium+'% above 2h; '+esc(DE.rev.txt)+'.':'')+(G2.rows.some(r=>r.mw_note)?' *'+esc(G2.rows.find(r=>r.mw_note).mw_note)+'.':'')+'</p>';}
function renderGdLand(){const box=$("gdLand");if(!box)return;if(!PL){box.innerHTML='<div class="pw-empty">Deal log not available.</div>';return;}
 const D='<span class="na">—</span>',v=x=>x?esc(x):D,dd=r=>r.d?(r.d.length===4?r.d:gdD(r.d)):esc(r.dl||"n/a");
 box.innerHTML=cardHead("Powered land and data-centre site deals, Europe","MW","announcement date from each source (month or year only where the source gives no day) · checked "+esc(gdD(PL.checked))+" · — = not disclosed")+
  '<div class="pw-tbl-wrap"><table class="pw-tbl gd-tbl gd-land"><thead><tr><th class="c-z">Date</th><th class="c-z">Seller / developer</th><th class="c-z">Buyer / partner</th><th class="c-z">Country</th><th class="c-z">Site</th><th>MW</th><th class="c-z">Type</th><th class="c-z">Price</th><th class="c-z">Source</th></tr></thead><tbody>'+
  PL.rows.map(r=>'<tr><td class="c-z mm">'+dd(r)+'</td><td class="c-z">'+v(r.sel)+'</td><td class="c-z">'+v(r.buy)+'</td><td class="c-z">'+v(r.c)+'</td><td class="c-z gd-hl">'+v(r.site)+(r.note?'<br><em>'+esc(r.note)+'</em>':'')+'</td><td class="num">'+v(r.mw)+'</td><td class="c-z">'+v(r.ty)+'</td><td class="c-z gd-hl">'+v(r.px)+'</td><td class="c-z">'+r.src.map(([l,u])=>lnk(u,esc(l)+" ↗")).join("<br>")+'</td></tr>').join("")+'</tbody></table></div>'+
  '<p class="pw-foot">Tracked companies: '+PL.tracked.map(esc).join(", ")+'. MW as stated by the source (IT load or grid capacity as published). Prices in the original currency.</p>';}
/* Germany utility solar + battery pipeline: aggregates of the MaStR register (data/mastr_de.json, weekly) */
const MSC={pv:"var(--pw-de, #e0a030)",bat:"var(--accent)"};
function msMon(k){const[y,m]=k.split("-");return["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]+" "+y.slice(2);}
function renderGdMastr(){const a=$("gdMastrNew"),b=$("gdMastrSt");if(!a||!b)return;if(!MS){a.innerHTML=b.innerHTML='<div class="pw-empty">Register data not available yet.</div>';return;}
 const M=MS.months,src=lnk(MS.url,"Marktstammdatenregister (BNetzA)"),ser=[{name:"Ground-mounted solar",color:MSC.pv,vals:MS.pv.new,dots:1},{name:"Battery storage",color:MSC.bat,vals:MS.bat.new,dots:1}];
 const k=(l,o,u)=>'<div class="pw-kpi"><span class="pw-kpi-l">'+l+'</span><b>'+fpt(o.op_mw,0)+' <small>MW in operation</small></b><span class="pw-kpi-s">'+fpt(o.pl_mw,0)+' MW planned · '+fpt(o.op_n,0)+' / '+fpt(o.pl_n,0)+' units &gt; 1 MW'+(u?' · all sizes: '+fpt(o.all_op_n,0)+' operating, '+fpt(o.all_pl_n,0)+' planned units':'')+'</span></div>';
 a.innerHTML=cardHead("New commissionings, Germany, utility-scale solar and battery","MW",msMon(M[0])+" – "+msMon(M[M.length-1])+" · monthly · by commissioning date · source: "+src+" · register as of "+esc(gdD(MS.generated_utc.slice(0,10))),keysHtml(ser))+
  '<div class="pw-kpis pw-pad">'+k("Solar, ground-mounted",MS.pv,1)+k("Battery storage",MS.bat,1)+'</div><div class="pw-chart" id="gdMastrChart"></div>'+
  '<p class="pw-foot">Net rated power of units &gt; 1 MW with status "in operation", summed by month of commissioning. Late registrations still arrive, so the latest months are incomplete. Smaller units (rooftop solar, home batteries) are counted above but not summed.</p>';
 lineChart($("gdMastrChart"),{n:M.length,series:ser,h:200,yunit:"MW",zero:1,label:"New commissionings, Germany, MW per month",xlab:i=>msMon(M[i]),xw:44,
  tip:i=>'<b>'+msMon(M[i])+'</b> <span class="src">MW commissioned, units &gt; 1 MW</span>'+ser.map((x,j)=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+' <b>'+fpt(x.vals[i],0)+' MW</b> ('+[MS.pv,MS.bat][j].new_n[i]+' units)').join("")});
 const st=[...new Set(Object.keys(MS.pv.by_state).concat(Object.keys(MS.bat.by_state)))].filter(x=>x!=="?").sort((x,y)=>((MS.pv.by_state[y]||[0])[0]+(MS.bat.by_state[y]||[0])[0])-((MS.pv.by_state[x]||[0])[0]+(MS.bat.by_state[x]||[0])[0]));
 const c=(t,s,i)=>{const r=MS[t].by_state[s];return'<td class="num">'+(r&&r[i]?fpt(r[i],0):'<span class="na">—</span>')+'</td>';};
 b.innerHTML=cardHead("Pipeline by federal state, Germany, utility-scale solar and battery","MW","status as registered · units &gt; 1 MW · net rated power · source: "+src)+
  '<div class="pw-tbl-wrap gd-scroll"><table class="pw-tbl"><thead><tr><th class="c-z">State <span class="pw-mut">MW</span></th><th title="Ground-mounted solar, in operation">Solar op.</th><th title="Ground-mounted solar, in planning">Solar plan.</th><th title="Battery storage, in operation">Battery op.</th><th title="Battery storage, in planning">Battery plan.</th></tr></thead><tbody>'+
  st.map(s=>'<tr><td class="c-z">'+esc(s)+'</td>'+c("pv",s,0)+c("pv",s,2)+c("bat",s,0)+c("bat",s,2)+'</tr>').join("")+'</tbody></table></div>'+
  '<p class="pw-foot">"Planned" = units registered with status "in planning" (In Planung); registration of planned units is not complete. Units without a stated state are left out of this table.</p>';}
/* Germany balancing capacity auctions (data/balancing.json, regelleistung.net, daily, 90 days) */
function blgD(k){return gdD(k).replace(/ \d{4}$/,"");}
function renderBlg(){const a=$("pwBlgF"),b=$("pwBlgA");if(!a||!b)return;if(!BL||!BL.days){a.innerHTML=b.innerHTML='<div class="pw-empty">Balancing auction data not available yet.</div>';return;}
 const K=Object.keys(BL.days).sort(),D=K.map(k=>BL.days[k]),per=gdD(K[0])+" – "+gdD(K[K.length-1]),src=lnk(BL.url,"regelleistung.net"),xl=i=>blgD(K[i]);
 const f=[{name:"FCR, Germany",color:"var(--pw-de, #e0a030)",vals:D.map(d=>d.fcr)}];
 a.innerHTML=cardHead("FCR capacity price, Germany","€/MW per day",per+" · daily (sum of six 4-hour products) · settlement price · source: "+src,keysHtml(f))+'<div class="pw-chart" id="pwBlgFc"></div><p class="pw-foot">Frequency containment reserve, symmetric product; the daily value adds the six 4-hour settlement prices (€/MW each). Delivery day; the next day is auctioned the day before.</p>';
 lineChart($("pwBlgFc"),{n:K.length,series:f,h:200,yunit:"€/MW/day",zero:1,label:"FCR capacity price Germany, €/MW per day",xlab:xl,xw:52,
  tip:i=>'<b>'+esc(gdD(K[i]))+'</b> <span class="src">FCR, Germany</span><br><b>'+fpt(D[i].fcr,0)+' €/MW</b> per day<br><span class="src">4-hour blocks, €/MW: '+(D[i].fcr_b||[]).map(v=>fpt(v,0)).join(" · ")+'</span>'});
 const s=[{name:"aFRR positive",color:"var(--good)",vals:D.map(d=>d.pos)},{name:"aFRR negative",color:"var(--bad)",vals:D.map(d=>d.neg)}];
 b.innerHTML=cardHead("aFRR average capacity price, Germany","€/MW/h",per+" · daily mean of six 4-hour products · volume-weighted average · source: "+src,keysHtml(s))+'<div class="pw-chart" id="pwBlgAc"></div><p class="pw-foot">Automatic frequency restoration reserve, capacity market; positive and negative are separate products. Value = mean of the six 4-hour average capacity prices, (€/MW)/h.</p>';
 lineChart($("pwBlgAc"),{n:K.length,series:s,h:200,yunit:"€/MW/h",zero:1,label:"aFRR average capacity price Germany, €/MW per hour",xlab:xl,xw:52,
  tip:i=>'<b>'+esc(gdD(K[i]))+'</b> <span class="src">aFRR, Germany, (€/MW)/h</span>'+s.map(x=>'<br><i class="pw-tk" style="background:'+x.color+'"></i>'+esc(x.name)+' <b>'+fpt(x.vals[i],2)+' €/MW/h</b>').join("")});}
/* Grid & DC events calendar: hand-maintained data/griddc_events.json (official sources), weekly date check */
const CALC={DE:"Germany",UK:"UK",FR:"France"};
function calEnd(d){if(d.length===7){const[y,m]=d.split("-").map(Number);return new Date(Date.UTC(y,m,0));}return new Date(d+"T00:00:00Z");}
function calD(d){if(d.length===7){const[y,m]=d.split("-");return["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]+" "+y;}return gdD(d);}
function renderGdCal(){const box=$("gdCal");if(!box)return;if(!EV){box.innerHTML='<div class="pw-empty">Events calendar not available.</div>';return;}
 const now=new Date(),t0=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),lo=t0-30*864e5,hi=t0+366*864e5,cz=st.gcal||"all";
 const L=EV.events.map(e=>Object.assign({},e,{past:calEnd(e.d).getTime()<t0})).filter(e=>{const x=calEnd(e.d).getTime();return x>=lo&&(e.d.length===7?new Date(e.d+"-01T00:00:00Z").getTime():x)<=hi;});
 const R=L.filter(e=>cz==="all"||e.c===cz),cnt=k=>L.filter(e=>(k==="all"||e.c===k)&&!e.past).length;
 const nn=EV.none||{},fx=(EV.facts||[]).filter(f=>cz==="all"||f.c===cz);
 box.innerHTML=cardHead("Grid, tender and connection events, Germany, UK and France","",'next 12 months, sorted by date · past 30 days greyed · month shown where only the month is published · hand-maintained from official pages, checked '+esc(gdD(EV.checked)),"",'<div class="pw-tools">'+seg("gdCalSeg",[["all","All ("+cnt("all")+")"],["DE","DE ("+cnt("DE")+")"],["UK","UK ("+cnt("UK")+")"],["FR","FR ("+cnt("FR")+")"]],cz)+'</div>')+
  (R.length?'<div class="pw-tbl-wrap"><table class="pw-tbl gd-tbl gd-cal"><thead><tr><th class="c-z">Date</th><th class="c-z">Ctry</th><th class="c-z gd-cal-cat">Category</th><th class="c-z">Event</th><th class="c-z">Source</th></tr></thead><tbody>'+
  R.map(e=>'<tr class="'+(e.past?"gd-past":"")+'"><td class="c-z mm">'+esc(calD(e.d))+(e.past?'<br><em>past</em>':'')+'</td><td class="c-z">'+esc(e.c)+'</td><td class="c-z gd-cal-cat">'+esc(e.cat)+'</td><td class="c-z gd-hl"><b>'+esc(e.t)+'</b><br><span class="gd-cal-d">'+esc(e.desc)+'</span></td><td class="c-z">'+lnk(e.u,esc(e.src)+" ↗")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="pw-empty">No dated events in this window.</div>')+
  Object.keys(nn).filter(k=>cz==="all"||cz===k).map(k=>'<p class="pw-foot">'+esc(CALC[k]||k)+': '+esc(nn[k].t)+' '+lnk(nn[k].u,"CRE ↗")+'</p>').join("")+
  fx.map(f=>'<p class="pw-foot">'+esc(CALC[f.c]||f.c)+', large loads: '+esc(f.t)+' '+lnk(f.u,esc(f.src)+" ↗")+'</p>').join("");
 bindSeg("gdCalSeg",k=>{st.gcal=k;renderGdCal();});}
/* Finland wind: data/fi_wind.json (Fingrid open data 75 / 245 / 268), hourly, last 14 days + 48 h forecast */
function renderFiW(){const fmt0=v=>isNum(v)?Math.round(v).toLocaleString("en-GB"):"n/a";const box=$("pwFiW");if(!box)return;const F=FW;if(!F||!F.act){box.hidden=true;return;}box.hidden=false;
 const t0=Date.parse(F.t0),n=F.n,T=i=>new Date(t0+i*36e5),df=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short"}),hf=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
 const li=F.act.reduce((m,v,i)=>v!=null?i:m,-1),fc=F.fc.map((v,i)=>i>=li-1?v:null),fcp=F.fc.map((v,i)=>i<li?v:null);
 const ser=[{name:"Forecast, earlier hours (Fingrid, latest run)",color:COL.wind,w:1,dash:"2 3",op:.55,vals:fcp},{name:"Forecast, next 48 h",color:COL.wind,w:1.6,dash:"5 3",vals:fc},{name:"Actual production",color:COL.wind,w:2.4,end:true,vals:F.act}];
 if(isNum(F.cap))ser.push({name:"Installed capacity ("+Math.round(F.cap).toLocaleString("en-GB")+" MW)",color:"var(--muted)",w:1,dash:"3 3",vals:F.act.map(()=>F.cap)});
 const cf=isNum(F.cap)&&F.cap?Math.round(F.last.mw/F.cap*100):null,cf14=isNum(F.cap)&&F.cap?Math.round(F.avg14/F.cap*100):null;
 const d1=df.format(T(0)),d2=df.format(T(n-1));
 box.innerHTML=cardHead("Finland wind power production and forecast, "+d1+" – "+d2,"MW","hourly means of 15-min data · last 14 days actual, forecast to +48 h · latest "+fmt0(F.last.mw)+" MW ("+hf.format(new Date(F.last.t))+", "+cf+"% of capacity) · 14-day mean "+fmt0(F.avg14)+" MW ("+cf14+"%), range "+fmt0(F.min14)+"–"+fmt0(F.max14)+" MW · source: <a href=\""+esc(F.url)+"\" target=\"_blank\" rel=\"noopener noreferrer\">Fingrid open data</a> (datasets 75, 245, 268; CC BY 4.0)",keysHtml(ser.slice().reverse()),'<span class="sec-dot">'+(window.MMUI?MMUI.dot(F.generated_utc,"power","Finland wind (Fingrid)"):"")+'</span>')+'<div class="pw-chart" id="pwFiWC"></div>';
 lineChart($("pwFiWC"),{n,series:ser,h:220,yunit:"MW",ymin:0,label:"Finland wind production and forecast, MW",xall:true,xlab:i=>T(i).getHours()===0&&i%48<24?df.format(T(i)):null,
  tip:i=>'<b>'+esc(hf.format(T(i)))+'</b> <span class="src">MW</span>'+(isNum(F.act[i])?'<br><i class="pw-tk" style="background:'+COL.wind+'"></i>Actual <b>'+fmt0(F.act[i])+' MW</b>':'')+(isNum(F.fc[i])?'<br><i class="pw-tk" style="background:'+COL.wind+';opacity:.6"></i>Forecast <b>'+fmt0(F.fc[i])+' MW</b>':'')+(isNum(F.cap)?'<br>Capacity '+fmt0(F.cap)+' MW':'')});}
/* Nordic hydro: data/hydro_nordic.json (NVE + ENTSO-E A72, weekly) and storage/price map (existing power.json) */
function renderHyd(){const a=$("pwHydN"),b=$("pwHydMap");if(!a||!b)return;if(!HN){a.innerHTML=b.innerHTML='<div class="pw-empty">Hydro data not available yet.</div>';return;}
 const opts=[["nose","Norway + Sweden",!HN.nose],["no","Norway",false],["se","Sweden",!HN.se]];let k=st.hyd&&HN[st.hyd]?st.hyd:(HN.nose?"nose":"no");const B=HN[k],y=HN.year,n=53;
 const src=k==="no"?lnk(HN.src.no_url,"NVE"):k==="se"?lnk(HN.src.se_url,"ENTSO-E Transparency (A72)"):lnk(HN.src.no_url,"NVE")+" + "+lnk(HN.src.se_url,"ENTSO-E Transparency (A72)");
 const ser=[{name:String(y),color:"var(--accent)",vals:B.cur,w:2.4,end:1},{name:String(y-1),color:"var(--muted)",vals:B.prev,dash:"4 3",w:1.5},{name:"Median "+HN.hist,color:"var(--pw-de, #e0a030)",vals:B.band.map(x=>x?x[1]:null),dash:"2 3",w:1.4}];
 const li=B.cur.length-1,lb=B.band[li];
 a.innerHTML=cardHead("Hydro reservoir energy, "+opts.find(o=>o[0]===k)[1]+", "+y+" vs "+HN.hist,"TWh","ISO weeks 1–53 · weekly · shaded = min–max of the same week "+HN.hist+" · source: "+src,keysHtml(ser)+'<span class="pw-k"><i class="pw-tk" style="background:color-mix(in srgb,var(--accent) 22%,transparent)"></i>Range '+HN.hist+'</span>',seg("pwHydSeg",opts.map(o=>[o[0],o[1],o[2]]),k))+
  '<div class="pw-chart" id="pwHydC"></div><p class="pw-foot">Latest: week '+(li+1)+' · <b>'+fpt(B.cur[li],1)+' TWh</b>'+(lb?' · median '+fpt(lb[1],1)+' TWh ('+(B.cur[li]>=lb[1]?"+":"−")+fpt(Math.abs(B.cur[li]-lb[1]),1)+') · range '+fpt(lb[0],1)+'–'+fpt(lb[2],1)+' TWh':'')+'. Energy stored in reservoirs; Norway capacity '+fpt(HN.no_cap_twh,1)+' TWh (NVE).</p>';
 lineChart($("pwHydC"),{n,series:ser,h:230,yunit:"TWh",band:B.band.map((x,i)=>x?[i,x[0],x[1],x[2]]:[i,null,null,null]),label:"Hydro reservoir energy TWh by ISO week",xlab:i=>(i%8===0||i===n-1)?"W"+(i+1):"",xw:30,xunit:"",
  tip:i=>'<b>Week '+(i+1)+'</b> <span class="src">TWh</span>'+ser.map(s2=>'<br><i class="pw-tk" style="background:'+s2.color+'"></i>'+esc(s2.name)+' <b>'+(isNum(s2.vals[i])?fpt(s2.vals[i],1)+' TWh':'—')+'</b>').join("")+(B.band[i]?'<br>Range '+HN.hist+': '+fpt(B.band[i][0],1)+'–'+fpt(B.band[i][2],1)+' TWh':'')});
 bindSeg("pwHydSeg",x=>{st.hyd=x;save();renderHyd();});
 /* map: fill % by zone (NO: NVE vs median; SE: Energiföretagen), label = today's day-ahead average */
 const M=window.PW_MAP,K=keys(),SE=(P.hydro&&P.hydro.se&&P.hydro.se.zones)||{},Z=HN.zones||{};if(!M){b.innerHTML='<div class="pw-empty">Map geometry not loaded</div>';return;}
 const fill=z=>Z[z]?Z[z].fill:SE[z]?SE[z].fill:null,fc=v=>"color-mix(in srgb,#2f80ed "+Math.round(15+Math.max(0,Math.min(100,v))*.8)+"%,var(--panel))";
 const ids=["DK1","DK2","NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4","FI"];let s2='<svg class="pw-mapsvg" viewBox="0 0 '+M.w+' '+M.h+'" role="img" aria-label="Nordic bidding zones coloured by reservoir filling">';
 ["EE","LV","LT","PL","NL","DE"].concat(ids).forEach(id=>{const g=M.z[id];if(!g)return;const f=ids.includes(id)?fill(id):null;s2+='<path class="pw-zone '+(ids.includes(id)?"live":"ctx")+(ids.includes(id)&&!isNum(f)?" nodata":"")+'" data-z="'+id+'" d="'+g.d+'"'+(isNum(f)?' style="fill:'+fc(f)+'"':"")+'/>';});
 ids.forEach(id=>{const g=M.z[id];if(!g||!g.c)return;const f=fill(id),v=dayVal(id,K.today);s2+='<g class="pw-lbl" transform="translate('+g.c[0]+' '+g.c[1]+')"><text class="z" y="-4">'+id+'</text><text class="v" y="13">'+(isNum(f)?Math.round(f)+"%":"–")+'</text><text class="z" y="27">'+(isNum(v)?Math.round(v)+" €":"")+'</text></g>';});
 s2+='</svg>';const sw=P.hydro&&P.hydro.se;
 b.innerHTML=cardHead("Reservoir filling and day-ahead price by zone, Nordics","% / €/MWh","filling: Norway week "+esc((Object.values(Z)[0]||{}).week||"")+" ("+lnk(HN.src.no_url,"NVE")+"), Sweden week "+esc(sw&&sw.week||"")+" ("+lnk(sw&&sw.source||"https://www.energiforetagen.se","Energiföretagen")+") · price: today's day-ahead daily average · Finland and Denmark: no zone reservoir data")+
  '<div class="pw-map pw-map-hyd" id="pwHydM">'+s2+'</div><div class="pw-keys pw-pad"><span class="pw-k"><i class="pw-tk" style="background:'+fc(20)+'"></i>20%</span><span class="pw-k"><i class="pw-tk" style="background:'+fc(60)+'"></i>60%</span><span class="pw-k"><i class="pw-tk" style="background:'+fc(100)+'"></i>100% full</span><span class="pw-k">labels: zone · filling % · €/MWh</span></div>';
 $("pwHydM").querySelectorAll("path.live").forEach(p=>{const z=p.dataset.z;p.addEventListener("pointermove",e=>{const n2=Z[z],s3=SE[z],v=dayVal(z,K.today);showTip('<b>'+esc(z)+'</b>'+(n2?'<br>Filling <b>'+fpt(n2.fill,1)+'%</b> · median '+fpt(n2.med,1)+'% ('+'2006–2025, NVE)<br>'+fpt(n2.twh,1)+' TWh · week '+n2.week:s3?'<br>Filling <b>'+fpt(s3.fill,1)+'%</b> · '+fpt(s3.gwh,0)+' GWh (Energiföretagen)':'<br>No zone reservoir data')+'<br>Day-ahead today <b>'+fpt(v)+'</b> €/MWh',e);});p.addEventListener("pointerleave",hideTip);});}
function qChips(){const c=$("gdQChips");if(!c||c.dataset.ready)return;c.dataset.ready="1";c.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{const q=b.dataset.q;c.querySelectorAll(".chip").forEach(x=>x.classList.toggle("is-on",x===b));document.querySelectorAll("#gdSecQueue .gd-q").forEach(el=>{el.hidden=!(q==="all"||el.dataset.q===q);});const h=$("gdSecDEFR");if(h)h.hidden=q==="gb";dispatchEvent(new Event("resize"));});}
function renderGd(){if(!$("gdUK"))return;renderBlg();qChips();{const D=window.MMUI&&MMUI.dot;if(D)setDot("pwDotBlg",D(BL&&BL.generated_utc,"power","regelleistung.net capacity auctions",BL?null:"stale"));}if(!G){["gdUK","gdSol","gdDE","gdFR","gdDC","gdDCDeals"].forEach(id=>{const b=$(id);if(b)b.innerHTML='<div class="pw-empty">Grid &amp; DC data not available yet.</div>';});return;}
 {const g=G.generated_utc&&G.generated_utc.replace("Z",":00Z"),D=window.MMUI&&MMUI.dot,stl=(G.stale||[]);if(D){const n=stl.length?"kept from an earlier build: "+stl.join(", "):"";
  ["gdDotUK","gdDotSol","gdDotDEFR","gdDotDC"].forEach(id=>setDot(id,D(g,"daily","Grid & DC build",stl.length?"late":null,n)));setDot("gdDotCal",D(EV&&EV.auto_checked?EV.auto_checked+"T06:00:00Z":null,"weekly","Events calendar (weekly date check)",EV?null:"stale"));setDot("gdDotMastr",D(MS&&MS.generated_utc,"weekly","Marktstammdatenregister (BNetzA)",MS?null:"stale"));}}
 renderGdCal();renderGdUK();renderGdSol();renderGdBess();renderGdMastr();renderGdDE();renderGdFR();renderGdDC();renderGdDeals();renderGdLand();}
/* ---------- sticky sub-navigation (static #pwSubnav in index.html) ---------- */
const NAV=[["pwSecMon","Last month"],["pwSecSpot","Prices now"],["pwSecFw","Forwards"],["pwSecSup","Supply & weather"],["pwSecSE4","SE4 focus"],["pwNews","News"]];
function navTarget(id){return $(id)||(id==="pwNews"?document.querySelector(".news-panel"):null);}
function initNav(){const nav=$("pwSubnav");if(!nav||nav.dataset.ready)return;nav.dataset.ready="1";
 nav.innerHTML=NAV.map(([id,l])=>'<a href="#'+id+'" class="pw-nav-a'+(id==="pwSecSE4"?" focus":"")+'" data-t="'+id+'">'+l+'</a>').join("");
 nav.querySelectorAll("a").forEach(a=>a.onclick=e=>{e.preventDefault();const el=navTarget(a.dataset.t);if(!el)return;if(window.MMUI){MMUI.go(el.id||a.dataset.t,nav);return;}const y=el.getBoundingClientRect().top+scrollY-nav.offsetHeight-8;scrollTo({top:Math.max(0,y),behavior:"smooth"});});
 let raf=0;addEventListener("scroll",()=>{if(raf||!shown)return;raf=requestAnimationFrame(()=>{raf=0;spy();});},{passive:true});}
function spy(){const nav=$("pwSubnav");if(!nav)return;const lim=nav.offsetHeight+40;let cur=NAV[0][0];
 NAV.forEach(([id])=>{const el=navTarget(id);if(el&&el.getBoundingClientRect().top<=lim)cur=id;});
 if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)cur=NAV[NAV.length-1][0];
 nav.querySelectorAll("a").forEach(a=>{const on=a.dataset.t===cur;a.classList.toggle("is-on",on);if(on)a.setAttribute("aria-current","true");else a.removeAttribute("aria-current");});}

/* ---------- credits ---------- */
function renderCredits(){const sp=P.spot,srcs=(sp&&sp.sources)||[];const fail=(sp&&sp.status||[]).filter(x=>!x.ok&&x.src==="Energy-Charts"&&!(sp.zones&&sp.zones[x.zone]&&sp.zones[x.zone].src));
 $("pwCredits").innerHTML=(P.errors&&P.errors.length?'<span class="bad" title="'+esc(P.errors.map(e=>e.section+": "+e.error).join("\n"))+'">'+P.errors.length+' source error(s) at the last build.</span> ':'')+'Sources: forwards and drivers from <b>EEX</b> public daily settlements (API2 coal: ICE), collected by a daily scraper since 1 Sep 2026. Day-ahead: '+
 (srcs.includes("ENTSO-E")?'<a href="https://transparency.entsoe.eu" target="_blank" rel="noopener noreferrer">ENTSO-E Transparency Platform</a> (A44)'+(srcs.length>1?', ':''):'')+
 (srcs.includes("Energy-Charts")||!srcs.length?'<a href="https://www.energy-charts.info" target="_blank" rel="noopener noreferrer">Energy-Charts</a> (Fraunhofer ISE, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>)':'')+
 (srcs.includes("Energi Data Service")?', <a href="https://www.energidataservice.dk" target="_blank" rel="noopener noreferrer">Energi Data Service</a> (Energinet; DK1/DK2)':"")+(srcs.includes("spot-hinta.fi")?', <a href="https://spot-hinta.fi" target="_blank" rel="noopener noreferrer">spot-hinta.fi</a>':"")+
 (fail.length?' <span class="na">(primary source unavailable at last build for '+fail.length+' zone(s); fallback sources used where possible)</span>':"")+'. '+
 (P.capture&&P.capture.zones&&Object.keys(P.capture.zones).length?'FI / DE-LU capture prices use Energy-Charts generation (CC BY 4.0). ':'')+'Hydro: <a href="https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/" target="_blank" rel="noopener noreferrer">NVE magasinstatistikk</a> (NLOD); Sweden: <a href="https://www.energiforetagen.se/statistik/kraftlaget/" target="_blank" rel="noopener noreferrer">Energiföretagen</a>. '+
 (NPo()?'Nordic system price (SYS) and official area daily averages: <a href="https://data.nordpoolgroup.com" target="_blank" rel="noopener noreferrer">Nord Pool</a> day-ahead. ':'')+(NU()?'Nuclear availability: <a href="https://umm.nordpoolgroup.com" target="_blank" rel="noopener noreferrer">Nord Pool UMM</a> (REMIT messages published by the operators). ':'')+(HB()?'Hydro balance: NVE (Norway) and ENTSO-E A72 (Sweden, Finland). ':'')+(P.renew&&P.renew.zones?'DK1/DK2 wind, solar and day-ahead prices: <a href="https://www.energidataservice.dk" target="_blank" rel="noopener noreferrer">Energi Data Service</a> (Energinet); Finland wind: '+(P.renew.zones.FI&&/Fingrid/.test(P.renew.zones.FI.src)?'<a href="https://data.fingrid.fi" target="_blank" rel="noopener noreferrer">Fingrid open data</a> (CC BY 4.0)':'ENTSO-E (Fingrid open data once an API key is configured)')+'. ':'')+
 (P.svk?'SE4 load, flows and Sweden production: <a href="https://www.svk.se/om-kraftsystemet/kontrollrummet/" target="_blank" rel="noopener noreferrer">Svenska kraftnät Kontrollrummet</a> and <a href="https://data.svk.se" target="_blank" rel="noopener noreferrer">data.svk.se</a> (CC BY 4.0). ':'')+(EN()?'SE4 wind and solar (actual A75, day-ahead forecast A69), load (A65), flows (A11), outages (A78/A80) and reservoirs (A72): <a href="https://transparency.entsoe.eu" target="_blank" rel="noopener noreferrer">ENTSO-E Transparency Platform</a>; capture prices computed here. ':'')+'Zone outlines simplified from ENTSO-E bidding-zone shapes (entsoe-py, MIT). Day-ahead days follow the CET delivery day; times are Geneva time (CET/CEST). Prices in €/MWh, power in MW. Nordic avg is an unweighted mean of 12 zones; SYS is the Nord Pool system price. EEX settlements are collected each evening after publication, so they show the previous trading day until then. n/a = not available from source.';}

/* ---------- main ---------- */
/* one-line factual summary at the top of the Power tab (#todayLine in index.html) */
function todayPower(){if(!P)return null;const K=keys(),parts=[];
 const pair=(k,l)=>{const a=dayAvg("SE4",k),b=dayAvg("SYS",k);if(!isNum(a)&&!isNum(b))return null;return l+' ('+esc(dlabel(k))+') SE4 <b>'+(isNum(a)?fpt(a,1):"n/a")+'</b> vs SYS <b>'+(isNum(b)?fpt(b,1):"n/a")+'</b> €/MWh'+(isNum(a)&&isNum(b)?' ('+(a-b>=0?"+":"−")+fpt(Math.abs(a-b),1)+')':'');};
 const t=pair(K.today,"today"),m=K.hasM?pair(K.tomorrow,"tomorrow"):null;
 parts.push((t||"today's day-ahead average n/a")+(m?" · "+m:" · tomorrow not published yet")+' <span class="td-src">(day-ahead daily averages)</span>');
 const N=NU();if(N){const cap=N.cap.SE+N.cap.FI,now=N.now.SE+N.now.FI;parts.push('Nordic nuclear available <b>'+fpt(now,0)+'</b> of '+fpt(cap,0)+' MW');}
 const H=HB();if(H&&H.nordic)parts.push('Nordic hydro <b>'+fst(H.nordic.dev,1)+' TWh</b> vs normal (week '+H.nordic.w+')');
 return{parts,isos:[P.generated_utc]};}
function todayGrid(){if(!G)return null;const parts=[];const U=G.uk,LD=U&&U.last_diff;if(U)parts.push(LD?'GB connection registers (TEC + embedded), latest change '+esc(gdD(LD.date))+': <b>'+LD.new+'</b> new, <b>'+LD.chg+'</b> changed, <b>'+LD.removed+'</b> removed entries':'GB connection registers: no new or changed entries since the '+esc(gdD(U.baseline))+' baseline');
 const R=solRounds(),lr=R[R.length-1];if(lr)parts.push('latest solar tender result: '+esc(lr.tn)+', '+esc(gdD(lr.d))+', '+fpt(lr.avg,1)+' €/MWh');
 const dc=(G.dc||[]).filter(x=>x.d&&Date.parse(x.d)>=Date.now()-7*864e5).length;parts.push('data-centre announcements with a stated capacity in the last 7 days: <b>'+dc+'</b>');
 return{parts,isos:[G.generated_utc&&G.generated_utc.replace("Z",":00Z")]};}
function renderToday(){if(!window.MMToday||!mode)return;const x=mode==="grid"?todayGrid():todayPower();if(x)window.MMToday.set(x.parts,x.isos);}
function renderPower(){initNav();window.MMNordic&&MMNordic.render();renderBal();renderFocusKpis();renderKpis();renderDots();renderDA();renderFw();renderDrivers();renderReservoirs();renderRen();renderFiW();renderSe4();renderHyd();renderCredits();spy();}
function renderGridView(){gridShell();renderGd();if(window.MMUI)MMUI.subnav($("subNav"),[["gdSecCal","Calendar"],["gdSecQueue","Connection queues"],["gdSecSol","Solar tenders"],["gdSecMastr","Germany pipeline"],["gdSecDC","Data centres & sites"],["gdSecBlg","Germany balancing"],["gdSecBess","Battery costs"],["gdExplain","How to read"]]);}
function renderAll(){if(!P)return;if(mode==="power")renderPower();else if(mode==="grid")renderGridView();renderToday();window.MMHome&&MMHome.render();}
async function load(force){if(loading&&!force)return loading;const v=$("powerView");if(!P)v.innerHTML='<div class="pw-empty pw-loading">Loading Nordic power data…</div>';
 loading=(async()=>{try{const r=await fetch("data/power.json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);const pj=await r.json();try{const g=await fetch("data/griddc.json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"});G=g.ok?await g.json():null;}catch(e){G=null;}try{const b=await fetch("data/bess_capex.json?t="+Math.floor(Date.now()/36e5),{cache:"no-cache"});BX=b.ok?await b.json():null;}catch(e){BX=null;}try{const b=await fetch("data/powered_land_deals.json?t="+Math.floor(Date.now()/36e5),{cache:"no-cache"});PL=b.ok?await b.json():null;}catch(e){PL=null;}try{const b=await fetch("data/fi_wind.json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"});FW=b.ok?await b.json():null;}catch(e){FW=null;}try{const b=await fetch("data/hydro_nordic.json?t="+Math.floor(Date.now()/36e5),{cache:"no-cache"});HN=b.ok?await b.json():null;}catch(e){HN=null;}try{const b=await fetch("data/griddc_events.json?t="+Math.floor(Date.now()/36e5),{cache:"no-cache"});EV=b.ok?await b.json():null;}catch(e){EV=null;}try{const b=await fetch("data/mastr_de.json?t="+Math.floor(Date.now()/36e5),{cache:"no-cache"});MS=b.ok?await b.json():null;}catch(e){MS=null;}try{const b=await fetch("data/balancing.json?t="+Math.floor(Date.now()/6e5),{cache:"no-cache"});BL=b.ok?await b.json():null;}catch(e){BL=null;}P=pj;shell();window.MMUI&&MMUI.apply($("powerView"));renderAll();}
  catch(e){if(!P)v.innerHTML='<div class="pw-empty">Could not load data/power.json ('+esc(e.message)+'). If you opened the file directly, serve the folder over HTTP.</div>';}finally{loading=null;}})();return loading;}
let rt,lastW=innerWidth;window.addEventListener("resize",()=>{if(!shown||!P)return;clearTimeout(rt);rt=setTimeout(()=>{if(mode==="grid")renderGd();else{renderBal();renderFw();renderRen();renderFiW();renderSe4();renderBlg();renderHyd();}},180);});
window.PWChart={lineChart,keysHtml,keyHtml,cardHead,showTip,hideTip,fpt};
addEventListener("mm:expand",()=>{if(!shown||!P)return;clearTimeout(rt);rt=setTimeout(()=>{if(mode==="grid")renderGd();else renderPower();},60);});
window.MMPower={show(m){shown=true;mode=m==="grid"?"grid":"power";if(!P)load();else renderAll();},hide(){shown=false;mode=null;hideTip();},reload(){return load(true);},
 ensure(){return P?Promise.resolve():load();},data:()=>({P,G}),todayPower,todayGrid,
 balHtml:()=>P?balKpisHtml():"",
 gridItems(n){if(!G)return[];const it=[];const U=G.uk||{};(U.changes||[]).forEach(c=>it.push({d:c.seen||(U.last_diff&&U.last_diff.date),k:"GB register",h:(c.t==="new"?"New: ":"Changed: ")+c.n+" · "+gdW(c.mw)+" MW · "+(c.s||""),sub:"gdSecUK"}));
  (U.pubs||[]).forEach(p=>it.push({d:p.d,k:"NESO",h:p.h,u:p.u,sub:"gdSecUK"}));((G.de||{}).notices||[]).forEach(p=>it.push({d:p.d,k:p.src,h:p.h,u:p.u,sub:"gdSecDEFR"}));
  (G.dc||[]).forEach(x=>it.push({d:x.d,k:"Data centre · "+x.c,h:x.h,u:gUrl(x.u),sub:"gdSecDC"}));solRounds().forEach(r=>it.push({d:r.d,k:"Solar tender",h:r.tn+" · "+fpt(r.avg,1)+" €/MWh · "+gdW(r.aw)+" MW",sub:"gdSecSol"}));
  const byD=it.filter(x=>x.d).sort((a,b)=>b.d.localeCompare(a.d));const seenK={};const out=[];for(const x of byD){const kk=x.k.split(" · ")[0];if(kk==="GB register"&&(seenK[kk]=(seenK[kk]||0)+1)>2)continue;out.push(x);if(out.length>=n)break;}return out;}};
setInterval(()=>{if(shown&&P&&mode==="power"){renderBalKpis();renderFocusKpis();renderKpis();}},60000);
})();
