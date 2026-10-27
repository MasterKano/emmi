/* Nordic Power tab: "Month to date" panel. One card per metric (wind, hydro, nuclear, demand, day-ahead price,
   wind speed, rain, temperature) in the same format: big number with a % badge, cumulative (or daily) line for this
   month vs last month, and bars by area with a tick at last month's same-period value.
   Views: month to date (default) · last full month · Jan–Dec vs history (10-yr power, 50-yr weather).
   Data: data/nordic_mtd.json (scripts/build_mtd.py: ENTSO-E A75/A65 daily, Open-Meteo daily weather) and
   data/mr.json (scripts/build_mr.py: Nord Pool daily prices, Ember monthly, ERA5 monthly). Nothing is filled in:
   a missing day makes the period shorter (and says so) or the value n/a. */
(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const PC=()=>window.PWChart||{};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],MONF=["January","February","March","April","May","June","July","August","September","October","November","December"];
const NA='<span class="na">n/a</span>';
const fx=(v,d)=>isNum(v)?v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):"n/a";
const ZC={NO:["NO1","NO2","NO3","NO4","NO5"],SE:["SE1","SE2","SE3","SE4"],FI:["FI"],DK:["DK1","DK2"]};
const CTRY=["SE","NO","FI","DK"],ALLZ=[].concat(ZC.SE,ZC.NO,ZC.FI,ZC.DK);
const ctryOf=z=>CTRY.find(c=>ZC[c].includes(z))||null;
const KEY="mm.mtd.v1";
let st={v:"M",a:"Nordic",x:{}};try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}};
/* kind: E energy (TWh, cumulative), P price (€/MWh, daily mean), W weather (agg mean or sum) */
const MET=[
 {k:"wind",t:"Wind",s:"onshore + offshore",c:"#2dd4bf",kind:"E",src:"ENTSO-E A75 actual generation",ek:"wind"},
 {k:"hydro",t:"Hydro",s:"reservoir + run-of-river, excl. pumped storage",c:"#60a5fa",kind:"E",src:"ENTSO-E A75 actual generation",ek:"hydro",only:["Nordic","NO","SE","FI"]},
 {k:"load",t:"Demand",s:"actual total load",c:"#f0b429",kind:"E",src:"ENTSO-E A65 actual total load",ek:"demand"},
 {k:"nuclear",t:"Nuclear",s:"actual generation",c:"#b07cff",kind:"E",src:"ENTSO-E A75 actual generation",ek:"nuclear",only:["Nordic","SE","FI"]},
 {k:"price",t:"Day-ahead price",s:"mean of daily averages",c:"#f08848",kind:"P",u:"€/MWh",d:2,src:"Nord Pool day-ahead"},
 {k:"wx_wind",w:"wind",t:"Wind speed",s:"10 m, daily mean",c:"#5eead4",kind:"W",u:"m/s",d:2,agg:"mean"},
 {k:"wx_rain",w:"rain",t:"Rain",s:"precipitation",c:"#7dd3fc",kind:"W",u:"mm",d:0,agg:"sum"},
 {k:"wx_temp",w:"temp",t:"Temperature",s:"2 m, daily mean",c:"#fb7185",kind:"W",u:"°C",d:1,agg:"mean",delta:true}];
let M=null,R=null,busy=null;
function load(){if(M&&R)return Promise.resolve();if(busy)return busy;
 busy=Promise.all([fetch("data/nordic_mtd.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).catch(()=>null),
  window.MMReview?MMReview.load():Promise.resolve(null)]).then(([a,b])=>{M=a;R=b;busy=null;});return busy;}
/* ---------- dates ---------- */
const ymd=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
const todayIso=()=>ymd.format(new Date());
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();      /* m = 1..12 */
const mk=(y,m)=>{while(m<1){m+=12;y--;}while(m>12){m-=12;y++;}return{y,m,k:y+"-"+String(m).padStart(2,"0"),n:dim(y,m),s:MON[m-1],f:MONF[m-1]};};
const iso=(o,d)=>o.k+"-"+String(d).padStart(2,"0");
const dl=iso_=>{const[y,m,d]=iso_.split("-");return +d+" "+MON[m-1];};
const rng=(o,a,b)=>o.s+" "+a+(b>a?"–"+b:"");
/* ---------- daily series for one metric and area (array aligned to M.days; null = missing) ---------- */
const di=x=>M?M.days.indexOf(x):-1;
const failedZ=(src,z)=>((M&&M.gaps)||[]).some(g=>g.startsWith(src+" "+z+":"));
function zoneE(k,z){const Z=M.zones[z]||{};const a=Z[k];if(a)return a;
 const src=k==="load"?"A65":"A75";return M.days.map(()=>failedZ(src,z)?null:0);}   /* type not present in the zone = 0 */
function areaZones(a){return a==="Nordic"?ALLZ:ZC[a]||[a];}
function sumZ(k,zs){const S=zs.map(z=>zoneE(k,z));return M.days.map((_,i)=>{let s=0;for(const a of S){const v=a[i];if(!isNum(v))return null;s+=v;}return s;});}
function serE(k,a){return sumZ(k,areaZones(a));}
function serW(w,a){const c=a==="Nordic"||ZC[a]?a:ctryOf(a);return((M.wx||{})[w]||{})[c]||M.days.map(()=>null);}
function serP(a){if(!R||!R.daily||!R.daily.v[a])return null;const t0=Date.parse(R.daily.start+"T00:00:00Z"),v=R.daily.v[a];
 return M.days.map(x=>{const i=Math.round((Date.parse(x+"T00:00:00Z")-t0)/864e5);return i>=0&&i<v.length&&isNum(v[i])?v[i]:null;});}
function ser(m,a){return m.kind==="E"?serE(m.k,a):m.kind==="W"?serW(m.w,a):serP(a);}
/* values of month o, days 1..n (null where missing) */
function mvals(s,o,n){const out=[];for(let d=1;d<=n;d++){const i=di(iso(o,d));out.push(i>=0&&s?s[i]:null);}return out;}
function agg(m,vals){if(!vals.length||!vals.every(isNum))return null;const s=vals.reduce((p,c)=>p+c,0);
 return m.kind==="E"?s/1000:m.agg==="sum"?s:s/vals.length;}
const cumul=(m,v)=>m.kind==="E"||m.agg==="sum";
const unitOf=m=>m.kind==="E"?"TWh":m.u;
const decOf=m=>m.kind==="E"?2:m.d;
/* ---------- pills ---------- */
function chg(m,cur,ref){if(!isNum(cur)||!isNum(ref))return null;if(m.delta)return{v:cur-ref,txt:(cur-ref>=0?"+":"−")+Math.abs(cur-ref).toFixed(1)+" °C"};
 if(!ref)return null;const p=(cur/ref-1)*100;return{v:p,txt:(p>=0?"+":"−")+Math.abs(p).toFixed(1)+"%"};}
function pill(c,big){if(!c)return'<span class="md-pill na">n/a</span>';const up=c.v>=0;return'<span class="md-pill '+(up?"up":"dn")+(big?" big":"")+'">'+(up?"▲":"▼")+" "+esc(c.txt)+'</span>';}
/* ---------- bars: rows {lab, v, ref, c (chg), strong, sep} ---------- */
function bars(rows,col,dec,refLab){const grp=[];let cur=[];rows.forEach(r=>{if(r.sep&&cur.length){grp.push(cur);cur=[];}cur.push(r);});if(cur.length)grp.push(cur);
 const one=r=>{const mx=r._mx||1,w=isNum(r.v)?Math.max(0,Math.min(100,r.v/mx*100)):0,t=isNum(r.ref)?Math.max(0,Math.min(100,r.ref/mx*100)):null;
  return'<div class="md-bar'+(r.strong?" strong":"")+'" title="'+esc(r.lab+": "+fx(r.v,dec)+(isNum(r.ref)?" · "+refLab+" "+fx(r.ref,dec):""))+'"><span class="md-bl">'+esc(r.lab)+'</span><span class="md-bt"><i style="width:'+w.toFixed(1)+'%;background:'+col+'"></i>'+(t!=null?'<b style="left:'+t.toFixed(1)+'%"></b>':"")+'</span><span class="md-bv">'+(isNum(r.v)?fx(r.v,dec):"n/a")+'</span>'+pill(r.c)+'</div>';};
 return grp.map((g,gi)=>{const mx=Math.max(...g.map(r=>Math.max(isNum(r.v)?r.v:0,isNum(r.ref)?r.ref:0)),1e-9);g.forEach(r=>r._mx=mx);return'<div class="md-bg'+(gi?" sep":"")+'">'+g.map(one).join("")+'</div>';}).join("");}
/* ---------- small SVG line chart ---------- */
function ticks(lo,hi,n){if(!(hi>lo)){hi=lo+1;lo=lo-1;}const r=(hi-lo)/(n||4),p=Math.pow(10,Math.floor(Math.log10(r))),q=r/p,s=(q<1.5?1:q<2.25?2:q<3.5?2.5:q<7.5?5:10)*p;
 const a=Math.floor(lo/s)*s,b=Math.ceil(hi/s)*s,o=[];for(let v=a;v<=b+s*1e-6;v+=s)o.push(+v.toFixed(10));return o;}
function mini(el,o){if(!el)return;const W=Math.max(220,Math.round(el.clientWidth||300)),H=o.h||172,L=34,Rm=o.rm||34,T=18,B=20,iw=W-L-Rm,ih=H-T-B;
 const all=[];o.series.forEach(s=>s.vals.forEach(v=>isNum(v)&&all.push(v)));if(o.band)o.band.forEach(b=>{if(b){isNum(b[0])&&all.push(b[0]);isNum(b[1])&&all.push(b[1]);}});
 if(!all.length){el.innerHTML='<div class="pw-empty pw-empty-s">No data for this period.</div>';return;}
 let lo=Math.min(...all),hi=Math.max(...all);if(o.zero&&lo>0)lo=0;const tk=ticks(lo,hi,4);lo=tk[0];hi=tk[tk.length-1];
 const X=i=>L+(o.n>1?i/(o.n-1):0.5)*iw,Y=v=>T+ih-(v-lo)/(hi-lo)*ih;
 let s='<svg class="pw-svg md-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||"")+'">';
 tk.forEach(v=>{s+='<line x1="'+L+'" x2="'+(L+iw)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" class="md-gl"/><text class="yt" x="'+(L-5)+'" y="'+(Y(v)+3).toFixed(1)+'">'+esc(o.yfmt?o.yfmt(v):String(+v.toFixed(2)))+'</text>';});
 if(o.ulab)s+='<text class="md-ul" x="'+(L+4)+'" y="'+(T-6)+'">'+esc(o.ulab)+'</text>';
 for(let i=0;i<o.n;i++){const l=o.xlab(i);if(l!=null&&l!=="")s+='<text class="xt" x="'+X(i).toFixed(1)+'" y="'+(H-5)+'">'+esc(l)+'</text>';}
 if(o.band){let up="",dn="";o.band.forEach((b,i)=>{if(b&&isNum(b[0])&&isNum(b[1])){up+=(up?"L":"M")+X(i).toFixed(1)+","+Y(b[1]).toFixed(1);dn=" L"+X(i).toFixed(1)+","+Y(b[0]).toFixed(1)+dn;}});if(up)s+='<path class="md-band" style="fill:'+o.bandCol+'" d="'+up+dn+' Z"/>';}
 if(isNum(o.mark))s+='<line class="md-mark" x1="'+X(o.mark).toFixed(1)+'" x2="'+X(o.mark).toFixed(1)+'" y1="'+T+'" y2="'+(T+ih)+'"/>';
 o.series.forEach(sr=>{let d="",pen=false;sr.vals.forEach((v,i)=>{if(isNum(v)){d+=(pen?"L":"M")+X(i).toFixed(1)+","+Y(v).toFixed(1);pen=true;}else pen=false;});
  if(d)s+='<path class="ln" d="'+d+'" style="stroke:'+sr.col+';stroke-width:'+(sr.w||2.4)+(sr.dash?';stroke-dasharray:'+sr.dash:"")+(sr.op?';opacity:'+sr.op:"")+'"/>';});
 (o.dots||[]).forEach(p=>{if(isNum(p.v))s+='<circle cx="'+X(p.i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="'+(p.r||4)+'" style="fill:'+p.col+'" class="dt"/>';});
 (o.labels||[]).forEach(p=>{if(!isNum(p.v))return;let x=X(p.i)+(p.dx||0),y=Y(p.v)+(p.dy||0);y=Math.max(T-2,Math.min(T+ih,y));const a=p.a||"middle";
  s+='<text class="md-lab" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" style="fill:'+p.col+';text-anchor:'+a+'">'+esc(p.t)+'</text>';});
 s+='<rect class="hit" x="'+L+'" y="'+T+'" width="'+iw+'" height="'+ih+'"/></svg>';el.innerHTML=s;
 const hit=el.querySelector(".hit");if(!hit||!o.tip)return;const P=PC();
 hit.addEventListener("pointermove",e=>{const r=hit.getBoundingClientRect();const i=Math.max(0,Math.min(o.n-1,Math.round((e.clientX-r.left)/r.width*(o.n-1))));P.showTip&&P.showTip(o.tip(i),e);});
 hit.addEventListener("pointerleave",()=>P.hideTip&&P.hideTip());}
/* ---------- period model for the MTD and Last-month views ---------- */
function periods(){const t=todayIso(),y=+t.slice(0,4),m=+t.slice(5,7);const last=M.days[M.days.length-1];
 let cur=mk(y,m);let note="";
 if(st.v==="M"&&(!last||last.slice(0,7)<cur.k)){note="No complete day of "+cur.f+" yet, so this shows last month.";}
 const useL=st.v==="L"||!!note;if(useL)cur=mk(y,m-1);const prev=mk(cur.y,cur.m-1);
 const lastD=useL?cur.n:Math.min(cur.n,+last.slice(8,10));
 return{cur,prev,lastD,full:useL,note};}
/* compute one card in MTD / last-month view */
function calcFlow(m,area,p){const kids=rowsFor(m,area);const head=kids.head;const s=ser(m,head);if(!s)return null;
 const cv=mvals(s,p.cur,p.lastD);let N=0;while(N<cv.length&&isNum(cv[N]))N++;   /* complete run of days from the 1st */
 let gap="";if(N<p.lastD){const miss=(m.kind==="E"?areaZones(head):[head]).filter(z=>{const ss=m.kind==="E"?zoneE(m.k,z):ser(m,z);const i=di(iso(p.cur,N+1));return !ss||!isNum(ss[i]);});
  gap=(miss.length?miss.join(", ")+" ":"")+(m.kind==="E"?m.t.toLowerCase():m.t.toLowerCase())+" not reported"+(N?" after "+dl(iso(p.cur,N)):" this month")+", so the comparison stops at day "+N+".";}
 const nP=p.full?p.prev.n:Math.min(N,p.prev.n);
 const pvAll=mvals(s,p.prev,p.prev.n);
 const cur=N?agg(m,cv.slice(0,N)):null,ref=nP?agg(m,pvAll.slice(0,nP)):null,refFull=agg(m,pvAll);
 const perDay=v=>!isNum(v)?null:m.kind==="E"?v*1000/(p.full?p.cur.n:N):v;
 const avgC=m.kind==="E"?(N?cur*1000/N:null):null,avgP=m.kind==="E"&&isNum(refFull)?refFull*1000/p.prev.n:null;
 const cmpC=p.full&&cumul(m)?chg(m,N?cur/N:null,isNum(ref)?ref/p.prev.n:null):chg(m,cur,ref);
 const rows=kids.rows.map(r=>{const z=ser(m,r.a);const a=z?mvals(z,p.cur,N).slice(0,N):[],b=z?pvAll.length&&mvals(z,p.prev,p.prev.n).slice(0,nP):[];const v=N?agg(m,a):null,rf=nP?agg(m,b):null;
  return Object.assign({},r,{v,ref:rf,c:p.full&&cumul(m)?chg(m,isNum(v)?v/N:null,isNum(rf)?rf/nP:null):chg(m,v,rf)});});
 return{s,cv,N,nP,cur,ref,refFull,avgC,avgP,cmp:cmpC,rows,gap,perDay,pvAll};}
function rowsFor(m,area){let head=area,list=[];const isZ=ALLZ.includes(area);
 if(m.kind==="W"){if(isZ)head=ctryOf(area);list=[{a:"Nordic",lab:"Nordic",strong:head==="Nordic"}].concat(CTRY.map((c,i)=>({a:c,lab:c,sep:i===0,strong:c===head})));return{head,rows:list};}
 if(m.kind==="P"){if(area==="Nordic"){head="SYS";list=[{a:"SYS",lab:"System",strong:true}].concat(ALLZ.map((z,i)=>({a:z,lab:z,sep:i===0})));}
  else if(ZC[area]){head="SYS";list=[{a:"SYS",lab:"System",strong:true}].concat(ZC[area].map((z,i)=>({a:z,lab:z,sep:i===0})));}
  else{const c=ctryOf(area);list=[{a:"SYS",lab:"System"}].concat(ZC[c].map((z,i)=>({a:z,lab:z,sep:i===0,strong:z===area})));}
  return{head,rows:list};}
 if(area==="Nordic")list=[{a:"Nordic",lab:"Nordic",strong:true}].concat(CTRY.filter(c=>has(m,c)).map((c,i)=>({a:c,lab:c,sep:i===0})));
 else if(ZC[area])list=[{a:area,lab:area,strong:true}].concat(ZC[area].length>1?ZC[area].filter(z=>hasZ(m,z)).map((z,i)=>({a:z,lab:z,sep:i===0})):[]);
 else{const c=ctryOf(area);list=[{a:c,lab:c}].concat(ZC[c].filter(z=>hasZ(m,z)).map((z,i)=>({a:z,lab:z,sep:i===0,strong:z===area})));}
 return{head,rows:list};}
const hasZ=(m,z)=>!!(M.zones[z]||{})[m.k];
const has=(m,c)=>ZC[c].some(z=>hasZ(m,z));
function shown(m,area){if(m.kind!=="E")return true;const zs=areaZones(area);if(ALLZ.includes(area))return hasZ(m,area);return zs.some(z=>hasZ(m,z));}
/* ---------- seasonal (Jan–Dec vs history) ---------- */
function seasonal(m,area){if(!R)return null;
 if(m.kind==="E"){const E=R.ember;if(!E)return null;const a=area==="Nordic"||ZC[area]?area:ctryOf(area);const v=((E.areas[a]||{})[m.ek])||null;if(!v)return null;
  return{mon:E.months,get:x=>{const A=(E.areas[x]||{})[m.ek];return A||null;},area:a,v,yrs:10,src:"Ember monthly electricity data",rows:[{a:"Nordic",lab:"Nordic",strong:a==="Nordic"}].concat(CTRY.filter(c=>((E.areas[c]||{})[m.ek]||[]).some(x=>isNum(x)&&x>0)).map((c,i)=>({a:c,lab:c,sep:i===0,strong:c===a}))),unit:"TWh",dec:2};}
 if(m.kind==="P"){const a=ALLZ.includes(area)?area:"SYS",zs=area==="Nordic"?ALLZ:ZC[area]||ZC[ctryOf(area)];
  return{mon:R.months,get:x=>R.monthly[x]||null,area:a,v:R.monthly[a],yrs:10,src:"Nord Pool day-ahead, monthly average",rows:[{a:"SYS",lab:"System",strong:a==="SYS"}].concat(zs.map((z,i)=>({a:z,lab:z,sep:i===0,strong:z===a}))),unit:"€/MWh",dec:2};}
 const X=R.weather;if(!X||!X[m.w])return null;
 return{mon:X.months,get:x=>x==="Nordic"?X[m.w]:null,area:"Nordic",v:X[m.w],yrs:50,src:"ERA5 reanalysis (Copernicus C3S), Nordic area mean 55–71°N 4–32°E",rows:[{a:"Nordic",lab:"Nordic",strong:true}],unit:m.w==="rain"?"mm/day":m.u,dec:m.w==="temp"?1:2,nordicOnly:true};}
function seasCalc(m,area){const S=seasonal(m,area);if(!S)return null;const cm=todayIso().slice(0,7);
 const idx={};S.mon.forEach((k,i)=>idx[k]=i);const val=(arr,k)=>arr&&idx[k]!=null&&isNum(arr[idx[k]])?arr[idx[k]]:null;
 let K=null;for(let i=S.mon.length-1;i>=0;i--){if(S.mon[i]<cm&&isNum(S.v[i])){K=S.mon[i];break;}}if(!K)return null;
 const y=+K.slice(0,4),mo=+K.slice(5,7);
 const hist=(arr,mm)=>{const o=[];for(let yy=y-S.yrs;yy<y;yy++){const v=val(arr,yy+"-"+String(mm).padStart(2,"0"));if(isNum(v))o.push(v);}return o;};
 const st_=a=>a.length?{avg:a.reduce((p,c)=>p+c,0)/a.length,lo:Math.min(...a),hi:Math.max(...a),n:a.length}:null;
 const cur=[],last=[],band=[],avg=[];for(let i=1;i<=12;i++){const k=y+"-"+String(i).padStart(2,"0");cur.push(k<cm?val(S.v,k):null);last.push(val(S.v,(y-1)+"-"+String(i).padStart(2,"0")));const h=st_(hist(S.v,i));band.push(h?[h.lo,h.hi]:null);avg.push(h?h.avg:null);}
 const H=st_(hist(S.v,mo)),v=val(S.v,K);
 const rows=S.rows.map(r=>{const A=S.get(r.a);const x=val(A,K),h=st_(hist(A,mo));return Object.assign({},r,{v:x,ref:h?h.avg:null,c:chg(m,x,h?h.avg:null)});});
 const y0=S.mon.find(k=>isNum(S.v[idx[k]]));
 return Object.assign(S,{K,y,mo,cur,last,band,avg,H,val:v,c:chg(m,v,H?H.avg:null),rows,y0});}
/* ---------- shell ---------- */
function shell(box){
 box.innerHTML='<div class="md-ctl"><div class="seg pw-seg" id="mtView" role="group" aria-label="Period">'+[["M","Month to date"],["L","Last month"],["S","Jan–Dec vs history"]].map(([k,l])=>'<button type="button" class="button" data-k="'+k+'">'+l+'</button>').join("")+'</div>'+
  '<div class="pw-chips md-areas" id="mtArea" role="group" aria-label="Area">'+["Nordic"].concat(CTRY).map(a=>'<button type="button" class="chip" data-a="'+a+'">'+a+'</button>').join("")+
  '<select id="mtZone" aria-label="Bidding zone"><option value="">Zone…</option>'+ALLZ.map(z=>'<option>'+z+'</option>').join("")+'</select></div>'+
  '<div class="md-leg" id="mtLeg"></div></div><p class="md-note" id="mtNote" hidden></p><div class="md-grid" id="mtGrid"></div>';
 $("mtView").querySelectorAll("button").forEach(b=>b.onclick=()=>{st.v=b.dataset.k;save();draw();});
 $("mtArea").querySelectorAll("button").forEach(b=>b.onclick=()=>{st.a=b.dataset.a;save();draw();});
 $("mtZone").onchange=e=>{if(e.target.value){st.a=e.target.value;save();draw();}};}
function head(m,sub,right){return'<div class="md-h"><span class="md-name" style="color:'+m.c+'">'+esc(m.t)+'</span><span class="md-sub">'+sub+'</span><button type="button" class="md-x" data-k="'+m.k+'" aria-expanded="'+(!!st.x[m.k])+'">'+(st.x[m.k]?"Less ▴":"Daily detail ▾")+'</button></div>';}
function draw(){const box=$("pwMtdBody");if(!box)return;if(!M){box.innerHTML='<div class="pw-empty">Month-to-date data not available in this build.</div>';return;}
 if(!$("mtGrid"))shell(box);
 if(window.MMUI&&$("pwDotMtd"))$("pwDotMtd").innerHTML=MMUI.dot(M.generated_utc,"power","Month to date (ENTSO-E daily, Open-Meteo)",null,(M.gaps||[]).join("; "));
 $("mtView").querySelectorAll("button").forEach(b=>{const on=b.dataset.k===st.v;b.classList.toggle("is-on",on);b.setAttribute("aria-pressed",on);});
 $("mtArea").querySelectorAll("button").forEach(b=>{const on=b.dataset.a===st.a;b.classList.toggle("is-on",on);b.setAttribute("aria-pressed",on);});
 $("mtZone").value=ALLZ.includes(st.a)?st.a:"";
 const g=$("mtGrid"),notes=[];let html="",jobs=[];
 if(st.v==="S"){const any=MET.map(m=>seasCard(m,st.a)).filter(Boolean);html=any.map(x=>x.h).join("");jobs=any;
  $("mtLeg").innerHTML='<span class="md-lk"><i style="background:var(--text)"></i>'+(any[0]?any[0].y:"")+'</span><span class="md-lk dash"><i></i>'+(any[0]?any[0].y-1:"")+'</span><span class="md-lk band"><i></i>range of the same month (10 yrs power and prices, 50 yrs weather)</span>';
  setTitle("Jan–Dec vs history",any[0]?"latest complete month "+any[0].K+" vs the same month in earlier years":"");}
 else{const p=periods();if(p.note)notes.push(p.note);const any=MET.filter(m=>shown(m,st.a)).map(m=>flowCard(m,st.a,p)).filter(Boolean);html=any.map(x=>x.h).join("");jobs=any;any.forEach(x=>x.gap&&notes.push(x.gap));
  $("mtLeg").innerHTML='<span class="md-lk"><i style="background:var(--text)"></i>'+p.cur.s+'</span><span class="md-lk dash"><i></i>'+p.prev.s+' (full month)</span>'+(p.full?"":'<span class="md-lk mark"><i></i>day '+p.lastD+'</span>')+'<span class="md-lk"><b class="md-pill up">▲</b> above '+p.prev.s+' <b class="md-pill dn">▼</b> below</span>';
  setTitle(p.full?"Last month · "+p.cur.f+" "+p.cur.y:"Month to date · "+rng(p.cur,1,p.lastD),p.full?p.cur.f+" vs "+p.prev.f+" (% on the daily average, months differ in length)":p.cur.s+" 1–"+p.lastD+" vs the same days of "+p.prev.s);}
 const ar=st.a;if(st.v==="S"&&ar!=="Nordic")notes.push("Weather history is a Nordic-wide series (ERA5), so it does not change with the area"+(ALLZ.includes(ar)?"; power history is by country, so "+ar+" shows "+ctryOf(ar)+".":"."));
 else if(ALLZ.includes(ar))notes.push("Weather is by country, so "+ar+" shows "+ctryOf(ar)+" weather.");
 const nt=$("mtNote");nt.hidden=!notes.length;nt.textContent=[...new Set(notes)].join(" ");
 g.innerHTML=html||'<div class="pw-empty">No data for this selection.</div>';
 jobs.forEach(j=>j.draw&&j.draw());
 g.querySelectorAll(".md-x").forEach(b=>b.onclick=()=>{const k=b.dataset.k;st.x[k]=!st.x[k];if(!st.x[k])delete st.x[k];save();draw();});
 window.MMPowerGaps&&MMPowerGaps(g);}
function setTitle(t,s){const a=$("pwMtdTitle"),b=$("pwMtdSub");if(a)a.textContent=t;if(b)b.textContent=s;}
/* ---------- card: MTD / last month ---------- */
function flowCard(m,area,p){const r=calcFlow(m,area,p);const u=unitOf(m),d=decOf(m),cum=cumul(m);
 const id="md_"+m.k,ex=!!st.x[m.k],cs=p.cur.s,ps=p.prev.s,N=r?r.N:0,sub=esc(m.s)+" · "+u;
 if(!r||!N){return{h:'<section class="pw-card md-card" id="'+id+'" style="--mc:'+m.c+'">'+head(m,sub)+'<div class="pw-empty pw-empty-s">'+esc(m.t)+' for '+esc(area)+': '+(r&&r.gap?esc(r.gap):"n/a, no data in this build")+'</div></section>',gap:r&&r.gap};}
 const per=p.full?cs+" 1–"+p.cur.n:rng(p.cur,1,N),pper=p.full?ps+" 1–"+p.prev.n:rng(p.prev,1,r.nP);
 const big=m.kind==="E"?fx(r.cur,2):fx(r.cur,d);
 let l3="";if(m.kind==="E")l3='Avg / day <b class="md-hl">'+fx(r.avgC,0)+' GWh</b> vs '+fx(r.avgP,0)+' full '+ps+' '+pill(chg(m,r.avgC,r.avgP));
 else if(m.kind==="P"||m.agg==="mean")l3='Full '+ps+' '+(m.agg==="mean"?"mean":"average")+' <b class="md-hl">'+fx(r.refFull,d)+' '+esc(u)+'</b>'+(p.full?"":' · '+cs+' so far vs full '+ps+' '+pill(chg(m,r.cur,r.refFull)));
 else l3='Avg / day <b class="md-hl">'+fx(r.cur/N,1)+' mm</b> vs '+fx(isNum(r.refFull)?r.refFull/p.prev.n:null,1)+' full '+ps+' '+pill(chg(m,r.cur/N,isNum(r.refFull)?r.refFull/p.prev.n:null));
 const kids=r.rows,isP=m.kind==="P";
 const bh=(m.kind==="W"?"By country":isP?"By bidding zone":"By area")+' · bar = '+per+' '+u+'<span class="md-tk">'+ps+(p.full?"":" 1–"+r.nP)+'</span>';
 const srcL=m.kind==="W"?'Open-Meteo daily '+(m.w==="temp"?"mean temperature at load centres":m.w==="rain"?"precipitation":"10 m wind speed")+', mean of fixed points per country (Nordic = mean of the countries)':esc(m.src)+(m.kind==="E"?", SE1–4, NO1–5, FI, DK1–2 summed":", area daily averages");
 const foot=per+' vs '+pper+(p.full?" (% compares daily averages)":"")+' · daily, CET days · '+srcL+'.';
 const h='<section class="pw-card md-card'+(ex?" md-wide":"")+'" id="'+id+'" style="--mc:'+m.c+'">'+head(m,sub)+
  '<div class="md-body"><div class="md-chart" id="'+id+'_c"></div><div class="md-side">'+
  '<div class="md-big"><b>'+big+'</b><span class="md-u">'+esc(u)+'</span>'+pill(r.cmp,1)+'</div>'+
  '<div class="md-l2">'+(isP?"System · ":"")+per+' · vs <b>'+fx(r.ref,d)+' '+esc(u)+'</b> '+pper+'</div><div class="md-l3">'+l3+'</div>'+
  '<div class="md-bh">'+bh+'</div>'+bars(kids,m.c,d,ps)+'</div></div>'+
  (ex?'<div class="md-det"><div class="pw-mini-h">Daily values <em>'+esc(u==="TWh"?"GWh per day":u+" per day")+' · '+cs+' vs '+ps+'</em></div><div class="md-dc" id="'+id+'_d"></div>'+detTable(m,r,p,kids,d)+'</div>':"")+
  '<p class="pw-foot">'+foot+'</p></section>';
 const drawIt=()=>{const n=Math.max(p.cur.n,p.prev.n),cv=r.cv,pv=r.pvAll;const sc=m.kind==="E"?1e-3:1;
  const cc=[],pc=[];let a=0,b=0;for(let i=0;i<n;i++){if(i<N&&isNum(cv[i])){a+=cv[i]*sc;cc.push(cum?a:cv[i]);}else cc.push(null);if(i<pv.length&&isNum(pv[i])){b+=pv[i]*sc;pc.push(cum?b:pv[i]);}else{pc.push(null);if(cum)b=NaN;}}
  const ce=cc[N-1],pe=pc.filter(isNum).length===p.prev.n?pc[p.prev.n-1]:null,pN=pc[N-1];
  mini($(id+"_c"),{n,label:m.t+" "+(cum?"cumulative ":"daily ")+u,ulab:u+(cum?" cumulative":m.agg==="mean"||isP?" daily":""),zero:cum||m.kind==="E",rm:cum?36:12,
   xlab:i=>(i===0||(i+1)%10===0)?String(i+1):null,mark:p.full?null:N-1,
   series:[{vals:pc,col:"#9aa3b2",w:1.6,dash:"5 4",op:.85},{vals:cc,col:m.c,w:2.6}],
   dots:[{i:N-1,v:ce,col:m.c,r:4.2}].concat(p.full||!cum?[]:[{i:N-1,v:pN,col:"#9aa3b2",r:3.4}]),
   labels:[{i:N-1,v:ce,t:(p.full?cs+" ":"MTD ")+(cum?fx(ce,cum&&m.kind==="E"?1:0):fx(r.cur,d)+(isP||m.agg==="mean"?" avg":"")),col:m.c,dy:-9,a:N>n*0.7?"end":"middle"}].concat(cum&&isNum(pe)?[{i:p.prev.n-1,v:pe,t:fx(pe,m.kind==="E"?1:0),col:"#9aa3b2",dx:5,dy:4,a:"start"}]:[]),
   tip:i=>'<b>Day '+(i+1)+'</b> <span class="src">'+esc(u)+(cum?" cumulative":"")+'</span><br><i class="pw-tk" style="background:'+m.c+'"></i>'+cs+' <b>'+(isNum(cc[i])?fx(cc[i],cum?2:d):"—")+'</b><br><i class="pw-tk" style="background:#9aa3b2"></i>'+ps+' <b>'+(isNum(pc[i])?fx(pc[i],cum?2:d):"—")+'</b>'});
  if(ex){const P=PC();const ds=Math.max(p.cur.n,p.prev.n);const dv=v=>isNum(v)?v:null;
   const sr=[{name:ps+" (daily)",color:"#9aa3b2",w:1.5,dash:"5 4",vals:Array.from({length:ds},(_,i)=>dv(pv[i]))},{name:cs+" (daily)",color:m.c,w:2.4,end:true,vals:Array.from({length:ds},(_,i)=>i<N?dv(cv[i]):null)}];
   P.lineChart&&P.lineChart($(id+"_d"),{n:ds,series:sr,h:170,yunit:u==="TWh"?"GWh":u,zero:m.kind==="E",label:m.t+" daily, "+cs+" vs "+ps,xlab:i=>(i===0||(i+1)%5===0)?String(i+1):null,xw:22,
    tip:i=>'<b>Day '+(i+1)+'</b>'+sr.slice().reverse().map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>'+(isNum(s.vals[i])?fx(s.vals[i],u==="TWh"?0:d):"n/a")+'</b> '+esc(u==="TWh"?"GWh":u)).join("")});}};
 return{h,draw:drawIt,gap:r.gap};}
function detTable(m,r,p,rows,d){const u=unitOf(m);return'<div class="pw-tbl-wrap"><table class="pw-tbl md-tbl"><thead><tr><th class="c-z">Area <span class="pw-mut">'+esc(u)+'</span></th><th>'+(p.full?p.cur.s:rng(p.cur,1,r.N))+'</th><th>'+(p.full?p.prev.s:rng(p.prev,1,r.nP))+'</th><th>'+(m.delta?"Δ °C":"Δ %")+'</th><th>Full '+p.prev.s+'</th></tr></thead><tbody>'+
 rows.map(x=>{const s=ser(m,x.a),full=s?agg(m,mvals(s,p.prev,p.prev.n)):null;return'<tr class="'+(x.strong?"focus":"")+'"><th class="c-z">'+esc(x.lab)+'</th><td class="num">'+fx(x.v,d)+'</td><td class="num">'+fx(x.ref,d)+'</td><td class="num '+(x.c?(x.c.v>=0?"up":"dn"):"")+'">'+(x.c?esc(x.c.txt):"n/a")+'</td><td class="num">'+fx(full,d)+'</td></tr>';}).join("")+'</tbody></table></div>';}
/* ---------- card: Jan–Dec vs history ---------- */
function seasCard(m,area){const S=seasCalc(m,area);const id="md_"+m.k,sub0=esc(m.s);
 if(!S)return{h:'<section class="pw-card md-card" id="'+id+'" style="--mc:'+m.c+'">'+head(m,sub0)+'<div class="pw-empty pw-empty-s">No monthly history for this series in this build.</div></section>',K:"",y:""};
 const ex=!!st.x[m.k],u=S.unit,d=S.dec,mo=MON[S.mo-1],yr0=S.y-S.yrs,yr1=S.y-1;
 const ln=m.kind==="E"?"TWh in the month":u;
 const h='<section class="pw-card md-card'+(ex?" md-wide":"")+'" id="'+id+'" style="--mc:'+m.c+'">'+head(m,sub0+" · "+esc(u))+
  '<div class="md-body"><div class="md-chart" id="'+id+'_c"></div><div class="md-side">'+
  '<div class="md-big"><b>'+fx(S.val,d)+'</b><span class="md-u">'+esc(u)+'</span>'+pill(S.c,1)+'</div>'+
  '<div class="md-l2">'+(m.kind==="P"?esc(S.area==="SYS"?"System":S.area)+" · ":S.area!=="Nordic"?esc(S.area)+" · ":"")+mo+' '+S.y+' · vs <b>'+fx(S.H&&S.H.avg,d)+' '+esc(u)+'</b> '+yr0+'–'+yr1+' avg</div>'+
  '<div class="md-l3">Range '+mo+' '+yr0+'–'+yr1+' <b class="md-hl">'+fx(S.H&&S.H.lo,d)+' – '+fx(S.H&&S.H.hi,d)+'</b>'+(S.H?' · '+S.H.n+' yrs':'')+'</div>'+
  '<div class="md-bh">'+(S.nordicOnly?"Nordic area only (no country split in this history)":m.kind==="P"?"By bidding zone":"By country")+' · bar = '+mo+' '+S.y+'<span class="md-tk">'+yr0+'–'+yr1+' avg</span></div>'+bars(S.rows,m.c,d,"avg")+'</div></div>'+
  (ex?'<div class="md-det">'+seasTable(S,d)+'</div>':"")+
  '<p class="pw-foot">Monthly · '+esc(S.src)+' · history from '+esc(S.y0||"")+'; band = min–max of the same month '+yr0+'–'+yr1+(m.kind==="W"?"; not the same points as the month-to-date weather":"")+'.</p></section>';
 const drawIt=()=>mini($(id+"_c"),{n:12,label:m.t+" by month, "+S.y+" vs history",ulab:ln,zero:m.kind==="E",rm:12,xlab:i=>MON[i].charAt(0),
  band:S.band,bandCol:"color-mix(in srgb,"+m.c+" 16%,transparent)",
  series:[{vals:S.avg,col:"#9aa3b2",w:1.2,dash:"2 3"},{vals:S.last,col:"#9aa3b2",w:1.5,dash:"5 4",op:.85},{vals:S.cur,col:m.c,w:2.6}],
  dots:[{i:S.mo-1,v:S.val,col:m.c,r:4}],
  labels:[{i:S.mo-1,v:S.val,t:mo+" "+fx(S.val,d>1?1:d),col:m.c,dy:-9,a:S.mo>9?"end":"middle"}],
  tip:i=>'<b>'+MONF[i]+'</b> <span class="src">'+esc(u)+'</span><br><i class="pw-tk" style="background:'+m.c+'"></i>'+S.y+' <b>'+fx(S.cur[i],d)+'</b><br><i class="pw-tk" style="background:#9aa3b2"></i>'+(S.y-1)+' <b>'+fx(S.last[i],d)+'</b><br>Avg '+yr0+'–'+yr1+' <b>'+fx(S.avg[i],d)+'</b>'+(S.band[i]?'<br><span class="src">range '+fx(S.band[i][0],d)+' – '+fx(S.band[i][1],d)+'</span>':"")});
 return{h,draw:drawIt,K:mo+" "+S.y,y:S.y};}
function seasTable(S,d){return'<div class="pw-tbl-wrap"><table class="pw-tbl md-tbl"><thead><tr><th class="c-z">Month <span class="pw-mut">'+esc(S.unit)+'</span></th><th>'+S.y+'</th><th>'+(S.y-1)+'</th><th>Avg '+(S.y-S.yrs)+'–'+(S.y-1)+'</th><th>Min</th><th>Max</th></tr></thead><tbody>'+
 MON.map((l,i)=>'<tr><th class="c-z">'+l+'</th><td class="num">'+fx(S.cur[i],d)+'</td><td class="num">'+fx(S.last[i],d)+'</td><td class="num">'+fx(S.avg[i],d)+'</td><td class="num">'+fx(S.band[i]&&S.band[i][0],d)+'</td><td class="num">'+fx(S.band[i]&&S.band[i][1],d)+'</td></tr>').join("")+'</tbody></table></div>';}
function render(){const box=$("pwMtdBody");if(!box)return;load().then(draw);}
let rt,lw=innerWidth;addEventListener("resize",()=>{if(!M||!$("mtGrid")||!$("mtGrid").offsetParent)return;if(innerWidth===lw)return;lw=innerWidth;clearTimeout(rt);rt=setTimeout(draw,200);});
window.MMMtd={render,load,bars,pill};
})();
