/* Nordic Power tab cards drawn from data/mr.json (scripts/build_mr.py): price history (system price 30-day MA,
   yearly/quarterly bars with futures, zone table), quarters now vs a month ago, monthly commodity averages and the
   any-month fundamentals card. The cards live in power.js sections; each draws only when visible. Hover values carry units; legend items hide/show a series. */
(function(){"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const f=(v,d=2)=>isNum(v)?v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):"n/a";
const PC=()=>window.PWChart||{};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const C={cur:"var(--accent)",last:"#f0a04b",avg:"var(--faint)",hist:"#8b95a7",qa:"#79b8e8",qf:"#2f74c9",yf:"#14a395",prev:"#8b95a7",daily:"#9aa6b8"};
const ZN={SYS:"System",SE1:"SE1",SE2:"SE2",SE3:"SE3",SE4:"SE4",FI:"FI",NO1:"NO1",NO2:"NO2",NO3:"NO3",NO4:"NO4",NO5:"NO5",DK1:"DK1",DK2:"DK2"};
const ZONES=Object.keys(ZN);
const KEY="mm.mr.v1";
let st={};try{st=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){st={};}
const S=(k,d)=>(st[k]=Object.assign({},d,st[k]||{}));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}};
let D=null,busy=null,failed=false;
function load(){if(D)return Promise.resolve(D);if(busy)return busy;
 busy=fetch("data/mr.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{busy=null;if(j){D=prep(j);}else failed=true;return D;});return busy;}
const dIso=d=>d.toISOString().slice(0,10);
const dlab=iso=>{const [y,m,d]=iso.split("-");return +d+" "+MON[m-1]+" "+y;};
const mlab=k=>MON[+k.slice(5)-1]+"-"+k.slice(2,4);
function prep(j){
 const t0=Date.parse(j.daily.start+"T00:00:00Z");j._t0=t0;
 j._ma={};for(const a of Object.keys(j.daily.v)){const v=j.daily.v[a],o=new Array(v.length).fill(null);let s=0,n=0;
  for(let i=0;i<v.length;i++){if(isNum(v[i])){s+=v[i];n++;}else{s=NaN;}
   if(i>=30){const x=v[i-30];if(isNum(x)){s-=x;n--;}}
   if(i>=29){const w=v.slice(i-29,i+1);o[i]=w.every(isNum)?w.reduce((p,c)=>p+c,0)/30:null;}}
  j._ma[a]=o;}
 j._day=i=>dIso(new Date(t0+i*864e5));
 j._mi={};j.months.forEach((k,i)=>j._mi[k]=i);
 return j;}
/* ---------- nice axis ---------- */
function ticks(lo,hi,n){if(!(hi>lo)){hi=lo+1;lo-=1;}const r=(hi-lo)/(n||5),p=Math.pow(10,Math.floor(Math.log10(r))),m=r/p,s=(m<1.5?1:m<2.25?2:m<3.5?2.5:m<7.5?5:10)*p;
 const a=Math.floor(lo/s)*s,b=Math.ceil(hi/s)*s,o=[];for(let v=a;v<=b+s*1e-6;v+=s)o.push(+v.toFixed(10));return o;}
const W=el=>Math.max(280,Math.round(el.clientWidth||el.getBoundingClientRect().width||640));
/* ---------- legend: buttons that toggle a series ---------- */
function legend(id,items,hid){return'<div class="pw-keys mr-keys" id="'+id+'">'+items.map(s=>{const off=hid.includes(s.key);
 const sw=s.kind==="band"?'<i class="band"></i>':s.kind==="bar"?'<i style="height:9px;background:'+s.color+'"></i>':'<svg class="pw-kl" viewBox="0 0 18 6" width="18" height="6" aria-hidden="true"><line x1="1" x2="17" y1="3" y2="3" style="stroke:'+s.color+';stroke-width:'+(s.w||2.4)+(s.dash?';stroke-dasharray:'+s.dash:"")+'"/></svg>';
 return'<button type="button" class="pw-key mr-key'+(off?" is-off":"")+'" data-key="'+esc(s.key)+'" aria-pressed="'+(!off)+'" title="Click to '+(off?"show":"hide")+'">'+sw+esc(s.name)+'</button>';}).join("")+'</div>';}
function bindLegend(id,obj,redraw){const el=$(id);if(!el)return;el.querySelectorAll("button[data-key]").forEach(b=>b.onclick=()=>{const k=b.dataset.key,h=obj.hid||(obj.hid=[]);const i=h.indexOf(k);if(i>=0)h.splice(i,1);else h.push(k);save();redraw();});}
const chips=(id,opts,cur)=>'<div class="pw-chips mr-chips" id="'+id+'" role="group">'+opts.map(([k,l])=>'<button type="button" class="chip'+(k===cur?" is-on":"")+'" data-k="'+esc(k)+'" aria-pressed="'+(k===cur)+'">'+esc(l)+'</button>').join("")+'</div>';
const seg=(id,opts,cur)=>'<div class="seg pw-seg mr-seg" id="'+id+'" role="group">'+opts.map(([k,l,t])=>'<button type="button" class="button'+(k===cur?" is-on":"")+'" data-k="'+esc(k)+'"'+(t?' title="'+esc(t)+'"':"")+'>'+esc(l)+'</button>').join("")+'</div>';
const bind=(id,fn)=>{const el=$(id);if(el)el.querySelectorAll("button[data-k]").forEach(b=>b.onclick=()=>fn(b.dataset.k));};
const tools=(...h)=>'<div class="mr-tools">'+h.join("")+'</div>';
function head(title,unit,sub,right){const ch=PC().cardHead;return ch?ch(title,unit,sub,"",right):'<div class="pw-card-head"><strong class="panel-title">'+title+'</strong></div>';}
/* ---------- line chart with optional band, area fill and hover ---------- */
function line(el,o){
 const w=W(el),h=o.h||(w<520?210:250),L=w<520?34:42,R=10,T=10,B=24,iw=w-L-R,ih=h-T-B,n=o.n;
 const vis=o.series.filter(s=>!s.off);let lo=Infinity,hi=-Infinity;
 const take=v=>{if(isNum(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}};
 vis.forEach(s=>s.vals.forEach(take));if(o.band&&!o.band.off){o.band.lo.forEach(take);o.band.hi.forEach(take);}
 if(o.zero){lo=Math.min(lo,0);hi=Math.max(hi,0);}if(!isFinite(lo)){lo=0;hi=1;}
 const pad=(hi-lo)*.06||1;const tk=ticks(o.zero&&lo>=0?0:lo-pad,hi+pad,w<520?4:5),y0=tk[0],y1=tk[tk.length-1];
 const X=i=>L+(n<=1?iw/2:i*iw/(n-1)),Y=v=>T+ih-(v-y0)/(y1-y0)*ih;
 let s='<svg class="pw-svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+esc(o.label||"")+'">';
 tk.forEach(v=>{s+='<line class="g" x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="yt" x="'+(L-5)+'" y="'+(Y(v)+3.5).toFixed(1)+'">'+(Math.abs(y1-y0)<10?f(v,1):Math.round(v))+'</text>';});
 if(y0<0&&y1>0)s+='<line class="z" x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(0)+'" y2="'+Y(0)+'"/>';
 const step=Math.max(1,Math.ceil(n/(w<520?5:9)));const xl=o.xticks||[...Array(n).keys()].filter(i=>i%step===0);
 xl.forEach(i=>{s+='<text class="xt" x="'+X(i).toFixed(1)+'" y="'+(h-7)+'">'+esc(o.xlab(i))+'</text>';});
 if(o.band&&!o.band.off){let up="",dn="";const bl=o.band.lo,bh=o.band.hi;const seg2=[];let cur=[];
  for(let i=0;i<n;i++){if(isNum(bl[i])&&isNum(bh[i]))cur.push(i);else if(cur.length){seg2.push(cur);cur=[];}}if(cur.length)seg2.push(cur);
  seg2.forEach(g=>{up=g.map(i=>X(i).toFixed(1)+","+Y(bh[i]).toFixed(1)).join(" L");dn=g.slice().reverse().map(i=>X(i).toFixed(1)+","+Y(bl[i]).toFixed(1)).join(" L");s+='<path class="band" d="M'+up+" L"+dn+'Z"/>';});}
 const path=v=>{let d="",pen=false;for(let i=0;i<n;i++){if(isNum(v[i])){d+=(pen?"L":"M")+X(i).toFixed(1)+","+Y(v[i]).toFixed(1);pen=true;}else pen=false;}return d;};
 vis.forEach(sr=>{const d=path(sr.vals);if(!d)return;
  if(sr.area){const idx=sr.vals.map((v,i)=>isNum(v)?i:-1).filter(i=>i>=0);const base=Y(Math.max(y0,Math.min(0,y1))>y0?0:y0);
   s+='<path d="'+d+"L"+X(idx[idx.length-1]).toFixed(1)+","+base.toFixed(1)+"L"+X(idx[0]).toFixed(1)+","+base.toFixed(1)+'Z" style="fill:'+sr.color+';opacity:.16"/>';}
  s+='<path class="ln" d="'+d+'" style="stroke:'+sr.color+';stroke-width:'+(sr.w||2)+(sr.dash?';stroke-dasharray:'+sr.dash:"")+'"/>';
  if(sr.dots){sr.vals.forEach((v,i)=>{if(isNum(v))s+='<circle class="dt" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="'+(w<520?2.4:3)+'" style="fill:'+sr.color+'"/>';});}
  if(sr.end){let i=n-1;while(i>=0&&!isNum(sr.vals[i]))i--;if(i>=0)s+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(sr.vals[i]).toFixed(1)+'" r="3.5" style="fill:'+sr.color+'"/>';}});
 s+='<line class="hair" id="'+el.id+'H" x1="0" x2="0" y1="'+T+'" y2="'+(T+ih)+'" visibility="hidden"/><rect class="hit" x="'+L+'" y="'+T+'" width="'+iw+'" height="'+ih+'"/></svg>';
 el.innerHTML=s;
 {const U=window.MMUI;if(U&&U.series){const cs=vis.slice();if(o.band&&!o.band.off)cs.push({name:(o.band.name||"range")+" low",vals:o.band.lo},{name:(o.band.name||"range")+" high",vals:o.band.hi});U.series(el,{src:o.src||"Nord Pool day-ahead",name:o.label},o.xkey||(i=>o.tipTitle?o.tipTitle(i):o.xlab(i)),n,cs);}}
 const svg=el.querySelector("svg"),hit=svg.querySelector(".hit"),hair=svg.querySelector(".hair"),u=o.unit||"",dc=o.dec==null?2:o.dec;
 const mv=e=>{const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)*w/r.width;let i=Math.round((x-L)/(n<=1?1:iw/(n-1)));i=Math.max(0,Math.min(n-1,i));
  hair.setAttribute("x1",X(i));hair.setAttribute("x2",X(i));hair.setAttribute("visibility","visible");
  let t='<b>'+esc(o.tipTitle?o.tipTitle(i):o.xlab(i))+'</b>';
  vis.forEach(sr=>{const v=sr.vals[i];if(isNum(v))t+='<br><i class="pw-tk" style="background:'+sr.color+'"></i>'+esc(sr.tipName||sr.name)+': <b>'+f(v,dc)+'</b> '+u;});
  if(o.band&&!o.band.off&&isNum(o.band.lo[i]))t+='<br><i class="pw-tk" style="background:color-mix(in srgb,var(--accent) 30%,transparent)"></i>'+esc(o.band.name)+': '+f(o.band.lo[i],dc)+' – '+f(o.band.hi[i],dc)+' '+u;
  PC().showTip&&PC().showTip(t,e);};
 hit.addEventListener("pointermove",mv);hit.addEventListener("pointerdown",mv);hit.addEventListener("pointerleave",()=>{hair.setAttribute("visibility","hidden");PC().hideTip&&PC().hideTip();});}
/* ---------- bar chart: one value per category (own colour) or grouped series ---------- */
function bars(el,o){
 const w=W(el),h=o.h||(w<520?220:260),L=w<520?32:40,R=8,T=16,B=o.rot?34:24,iw=w-L-R,ih=h-T-B,n=o.cats.length;
 const vis=o.series.filter(s=>!s.off);let lo=0,hi=0;vis.forEach(s=>s.vals.forEach(v=>{if(isNum(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}}));if(hi===lo)hi=1;
 const tk=ticks(lo,hi*(o.series.length>1?1.16:1.08),w<520?4:5),y0=tk[0],y1=tk[tk.length-1],Y=v=>T+ih-(v-y0)/(y1-y0)*ih;
 const cw=iw/n,g=Math.max(1,vis.length),bw=Math.min(46,cw*.78/g);
 let s='<svg class="pw-svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+esc(o.label||"")+'">';
 tk.forEach(v=>{s+='<line class="g" x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="yt" x="'+(L-5)+'" y="'+(Y(v)+3.5).toFixed(1)+'">'+Math.round(v)+'</text>';});
 s+='<line class="z" x1="'+L+'" x2="'+(w-R)+'" y1="'+Y(0)+'" y2="'+Y(0)+'"/>';
 (o.seps||[]).forEach(i=>{const x=L+i*cw;s+='<line class="vg" x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+T+'" y2="'+(T+ih)+'"/>';});
 const fs=bw<16?8:bw<24?9:10,dc=bw<24?0:(o.dec==null?1:o.dec);
 o.cats.forEach((c,i)=>{const cx=L+cw*(i+.5);
  let py=null;vis.forEach((sr,k)=>{const v=sr.vals[i];if(!isNum(v))return;const x=cx-bw*g/2+k*bw,y=Y(Math.max(v,0)),hh=Math.abs(Y(v)-Y(0));const col=(sr.colors&&sr.colors[i])||sr.color;
   s+='<rect x="'+(x+.5).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+Math.max(1,bw-1).toFixed(1)+'" height="'+Math.max(.5,hh).toFixed(1)+'" rx="1.5" style="fill:'+col+'"/>';
   if(o.labels!==false){const lt=f(v,dc);let ly=v>=0?y-3:Y(v)+fs+1;
    /* grouped bars: label wider than its bar and level with the neighbour's -> lift it one line */
    if(g>1&&py!=null&&lt.length*fs*.6>bw-1&&Math.abs(ly-py)<fs+1)ly=Math.min(ly,py)-fs-1;py=ly;
    s+='<text class="mr-bl" x="'+(x+bw/2).toFixed(1)+'" y="'+ly.toFixed(1)+'" style="font-size:'+fs+'px">'+lt+'</text>';}});
  if(o.rot)s+='<text class="xt" transform="translate('+cx.toFixed(1)+' '+(h-B+11)+') rotate(-35)" style="text-anchor:end">'+esc(c)+'</text>';
  else s+='<text class="xt" x="'+cx.toFixed(1)+'" y="'+(h-7)+'"'+(o.bold&&o.bold(i)?' style="font-weight:700;fill:var(--text)"':"")+'>'+esc(c)+'</text>';
  s+='<rect class="hit" data-i="'+i+'" x="'+(L+cw*i).toFixed(1)+'" y="'+T+'" width="'+cw.toFixed(1)+'" height="'+ih+'"/>';});
 s+='</svg>';el.innerHTML=s;const u=o.unit||"";{const U=window.MMUI;if(U&&U.series)U.series(el,{src:o.src||"Nord Pool day-ahead, EEX base futures",name:o.label},i=>o.cats[i],n,vis);}
 el.querySelectorAll(".hit").forEach(r=>{const i=+r.dataset.i;const mv=e=>{let t='<b>'+esc(o.tip?o.tip(i):o.cats[i])+'</b>';
  vis.forEach(sr=>{const v=sr.vals[i];if(isNum(v))t+='<br><i class="pw-tk" style="background:'+((sr.colors&&sr.colors[i])||sr.color)+'"></i>'+esc(sr.name)+': <b>'+f(v,o.dec==null?2:o.dec)+'</b> '+u;});
  if(o.note&&o.note(i))t+='<br><span class="src">'+o.note(i)+'</span>';PC().showTip&&PC().showTip(t,e);};
  r.addEventListener("pointermove",mv);r.addEventListener("pointerdown",mv);r.addEventListener("pointerleave",()=>PC().hideTip&&PC().hideTip());});}
/* ---------- monthly helpers ---------- */
function mseries(months,vals){const m={};months.forEach((k,i)=>{if(isNum(vals[i]))m[k]=vals[i];});return m;}
function seasonal(map,Y,y0,y1){const yr=y=>MON.map((_,i)=>{const v=map[y+"-"+String(i+1).padStart(2,"0")];return isNum(v)?v:null;});
 const cur=yr(Y),last=yr(Y-1),lo=[],hi=[],avg=[];let used=new Set();
 for(let i=0;i<12;i++){const xs=[];for(let y=y0;y<=y1;y++){const v=map[y+"-"+String(i+1).padStart(2,"0")];if(isNum(v)){xs.push(v);used.add(y);}}
  lo.push(xs.length>1?Math.min(...xs):null);hi.push(xs.length>1?Math.max(...xs):null);avg.push(xs.length>1?xs.reduce((a,b)=>a+b,0)/xs.length:null);}
 const u=[...used].sort();return{cur,last,lo,hi,avg,from:u[0],to:u[u.length-1]};}
const lastKey=map=>Object.keys(map).sort().pop();
function addM(k,d){let y=+k.slice(0,4),m=+k.slice(5)-1+d;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+"-"+String(m+1).padStart(2,"0");}
/* generic monthly card: views Seasonal (Jan–Dec vs history) / 13M / 5Y / All */
function monthlyChart(el,map,o,cs){const view=cs.v,Y=o.Y,hid=cs.hid||[];const lk=lastKey(map);if(!lk){el.innerHTML='<p class="pw-note mr-pad">No data.</p>';return[];}
 const y0=o.y0,y1=Y-1,ss=seasonal(map,Y,y0,y1);const rng=(ss.from||y0)+"–"+(ss.to||y1);
 if(view==="S"){const ser=[{key:"cur",name:String(Y),color:C.cur,vals:ss.cur,w:3,dots:true,end:true},{key:"last",name:String(Y-1),color:C.last,vals:ss.last,w:1.8},{key:"avg",name:"Average "+rng,color:C.avg,vals:ss.avg,w:1.6,dash:"4 3"}];
  ser.forEach(s=>s.off=hid.includes(s.key));const band={lo:ss.lo,hi:ss.hi,name:"Range "+rng,off:hid.includes("band")};
  line(el,{n:12,series:ser,band,xlab:i=>MON[i],unit:o.unit,dec:o.dec,zero:o.zero,label:o.label,src:o.src,tipTitle:i=>MON[i]});
  return ser.map(s=>({key:s.key,name:s.name,color:s.color,w:s.w,dash:s.dash})).concat([{key:"band",name:"Min–max "+rng,kind:"band"}]);}
 const len=view==="13"?13:view==="5Y"?60:null;let ks=[];
 if(len){for(let i=len-1;i>=0;i--)ks.push(addM(lk,-i));}else{const all=Object.keys(map).sort();ks=all;}
 const vals=ks.map(k=>isNum(map[k])?map[k]:null);
 const mo=ks.map(k=>+k.slice(5)-1),blo=mo.map(m=>ss.lo[m]),bhi=mo.map(m=>ss.hi[m]),bav=mo.map(m=>ss.avg[m]);
 const ser=[{key:"val",name:o.name||"Monthly",color:C.cur,vals,w:view==="13"?2.6:1.8,dots:view==="13",end:true}];
 if(view!=="A")ser.push({key:"avg",name:"Same-month average "+rng,tipName:"Average "+rng,color:C.avg,vals:bav,w:1.4,dash:"4 3"});
 ser.forEach(s=>s.off=hid.includes(s.key));const band=view==="A"?null:{lo:blo,hi:bhi,name:"Range "+rng,off:hid.includes("band")};
 const step=view==="13"?2:view==="5Y"?12:Math.max(12,Math.ceil(ks.length/8/12)*12);
 line(el,{n:ks.length,series:ser,band,xlab:i=>view==="13"?mlab(ks[i]):ks[i].slice(0,4),xticks:ks.map((k,i)=>i).filter(i=>view==="13"?i%step===0:ks[i].endsWith("-01")&&(+ks[i].slice(0,4))%(step/12)===0),
  unit:o.unit,dec:o.dec,zero:o.zero,label:o.label,src:o.src,xkey:i=>ks[i],tipTitle:i=>mlab(ks[i])+(o.mtd&&ks[i]===o.mtd?" (month to date)":"")});
 const L=ser.map(s=>({key:s.key,name:s.name,color:s.color,w:s.w,dash:s.dash}));if(band)L.push({key:"band",name:"Same-month min–max "+rng,kind:"band"});return L;}
/* ======================================================================== MR section */
function cardMA(){const el=$("mrMA");if(!el||!vis(el))return;
 const ma=D._ma.SYS;let last=ma.length-1;while(last>0&&!isNum(ma[last]))last--;
 el.innerHTML=head("Nordic system spot price, 30-day moving average","€/MWh",
  "rolling 6 months · day-ahead daily averages, trailing 30-day mean · Nord Pool · to "+dlab(D._day(last)),"")+
  '<div class="pw-chart" id="mrMAc"></div>'+
  '<p class="pw-foot">30-day MA = mean of the last 30 Nord Pool daily system price averages.</p>';
 const c=$("mrMAc"),idx=[];for(let i=Math.max(0,last-182);i<=last;i++)idx.push(i);
 const ser=[{key:"ma",name:"30-day moving average",color:C.cur,vals:idx.map(i=>ma[i]),w:2.4,area:true,end:true}];
 const mt=idx.map((d,k)=>k).filter(k=>D._day(idx[k]).endsWith("-01"));
 line(c,{n:idx.length,series:ser,xlab:k=>{const s2=D._day(idx[k]);return MON[+s2.slice(5,7)-1]+(s2.slice(5,7)==="01"?" "+s2.slice(2,4):"");},xticks:mt,unit:"€/MWh",label:"30-day moving average",tipTitle:k=>dlab(D._day(idx[k]))});}
const FZ=()=>ZONES.filter(z=>D.fut[z]);
function cardBars(){const el=$("mrBar");if(!el||!vis(el))return;const cs=S("bar",{a:"SYS",hid:[]});if(!D.fut[cs.a])cs.a="SYS";const a=cs.a,F=D.fut[a],Y=D.year,yy=String(Y).slice(2);
 const cats=[],vals=[],cols=[],kind=[];
 if(a==="SYS"&&D.hist_avg&&isNum(D.hist_avg.SYS)){cats.push(D.hist_avg.label+" avg");vals.push(D.hist_avg.SYS);cols.push(C.hist);kind.push("Average of yearly averages 2011–2019");}
 for(let y=2020;y<Y;y++){const v=(D.yearly[a]||{})[y];cats.push(String(y));vals.push(isNum(v)?v:null);cols.push(C.hist);kind.push("Yearly average (actual)");}
 F.q.forEach((v,i)=>{const fw=F.qk[i]!=="A";cats.push(yy+"Q"+(i+1)+(fw?"F":""));vals.push(v);cols.push(fw?C.qf:C.qa);kind.push(fw?"Quarter: actual to date + futures (month values averaged)":"Quarter actual (mean of the three months)");});
 cats.push((Y+1)+"F");vals.push(F.ny);cols.push(C.yf);kind.push("Mean of the four quarter futures "+(Y+1));
 cats.push((Y+2)+"F");vals.push(F.ny2);cols.push(C.yf);kind.push("Cal-"+String(Y+2).slice(2)+" year future");
 const narrow=W(el)<560;
 el.innerHTML=head("Nordic "+(a==="SYS"?"system":"area "+esc(a))+" price: yearly averages, "+Y+" quarters and futures","€/MWh",
  "actuals: Nord Pool day-ahead"+(a==="SYS"?" (yearly 2011–2023 as published by Nord Pool)":" (before 2024: ENTSO-E)")+" · futures: EEX base settlement "+dlab(D.eex_td)+" · F = includes futures","")+
  tools(chips("mrBarz",FZ().map(z=>[z,ZN[z]]),a))+'<div class="pw-chart" id="mrBarc"></div>'+
  '<div class="pw-keys mr-keys mr-pad"><span class="pw-key"><i style="height:9px;background:'+C.hist+'"></i>History</span><span class="pw-key"><i style="height:9px;background:'+C.qa+'"></i>'+Y+' quarter, actual</span><span class="pw-key"><i style="height:9px;background:'+C.qf+'"></i>'+Y+' quarter with futures (F)</span><span class="pw-key"><i style="height:9px;background:'+C.yf+'"></i>Future years</span></div>'+
  '<p class="pw-foot">Quarter = simple mean of its three monthly averages. A month in progress = hour-weighted actual days to '+dlab(D.asof)+' plus the remaining days at that month\'s future; later months use the month future (else the quarter future). '+(Y+1)+'F = mean of the four '+(Y+1)+' quarter futures; '+(Y+2)+'F = Cal-'+String(Y+2).slice(2)+' future.'+(a!=="SYS"?' The 2011–2019 average is shown for the system price only (zone history here starts 2015).':"")+'</p>';
 bars($("mrBarc"),{cats,series:[{name:ZN[a]||a,vals,colors:cols,color:C.qa}],unit:"€/MWh",dec:1,rot:narrow,label:"Yearly and quarterly prices",note:i=>kind[i],seps:[cats.indexOf(yy+"Q1")].concat([cats.indexOf((Y+1)+"F")]).filter(i=>i>0),bold:i=>cats[i].indexOf(yy+"Q")===0});
 bind("mrBarz",k=>{cs.a=k;save();cardBars();});}
const TS={main:["Main zones",["SYS","SE2","SE3","SE4","FI"]],se:["Sweden",["SYS","SE1","SE2","SE3","SE4"]],no:["Norway",["SYS","NO1","NO2","NO3","NO4","NO5"]],dk:["Denmark + FI",["SYS","DK1","DK2","FI"]]};
function cardTable(){const el=$("mrTbl");if(!el||!vis(el))return;const cs=S("tbl",{s:"main"});if(!TS[cs.s])cs.s="main";const cols=TS[cs.s][1],Y=D.year;
 const lk=D.months[D.months.length-1],mtd=D.asof.slice(0,7)===lk&&!isMonthEnd(D.asof);const full=mtd?[addM(lk,-2),addM(lk,-1)]:[addM(lk,-2),addM(lk,-1),lk];
 const mv=(z,k)=>{const i=D._mi[k];return i==null?null:D.monthly[z][i];};
 let t='<div class="mr-tw"><table class="pw-tbl mr-tbl"><thead><tr><th class="c-z">Period</th>'+cols.map(z=>'<th>'+(z==="SYS"?"SYS":z)+'</th>').join("")+'</tr></thead><tbody>';
 full.forEach(k=>{t+='<tr><th class="c-z">'+mlab(k)+'</th>'+cols.map(z=>'<td class="num">'+f(mv(z,k))+'</td>').join("")+'</tr>';});
 if(mtd)t+='<tr class="pw-exp"><th class="c-z">'+mlab(lk)+' <em>month to date, to '+dlab(D.asof)+'</em></th>'+cols.map(z=>'<td class="num mm">'+f(mv(z,lk))+'</td>').join("")+'</tr>';
 t+='</tbody></table></div>';
 el.innerHTML=head("Nordic regional power prices, monthly average","€/MWh","Nord Pool day-ahead · last two months and month to date","")+
  tools(seg("mrTbls",Object.entries(TS).map(([k,v])=>[k,v[0]]),cs.s))+t+'<p class="pw-foot">SYS = Nordic system price.</p>';
 bind("mrTbls",k=>{cs.s=k;save();cardTable();});}
const isMonthEnd=iso=>{const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.getUTCDate()===1;};
function cardCmp(){const el=$("mrCmp");if(!el||!vis(el))return;const cs=S("cmp",{a:"SYS",hid:[]});if(!D.cmp[cs.a])cs.a="SYS";const c=D.cmp[cs.a],Y=D.year,y1=String(Y).slice(2),y2=String(Y+1).slice(2);
 const cats=[String(Y),"Q1-"+y1,"Q2-"+y1,"Q3-"+y1,"Q4-"+y1,String(Y+1),"Q1-"+y2,"Q2-"+y2,"Q3-"+y2,"Q4-"+y2];
 const ser=[{key:"cur",name:"Settlement "+dlab(D.eex_td),color:C.qf,vals:c.cur||[]}];if(c.prev&&D.eex_td_prev)ser.push({key:"prev",name:"Settlement "+dlab(D.eex_td_prev),color:C.prev,vals:c.prev});
 ser.forEach(s=>s.off=(cs.hid||[]).includes(s.key));const narrow=W(el)<560;
 el.innerHTML=head("Actuals and futures by quarter: now vs a month ago, "+(cs.a==="SYS"?"system price":"area "+esc(cs.a)),"€/MWh","EEX base futures (Nordic system and zonal) · completed months: Nord Pool actuals as known on each date","")+
  tools(chips("mrCmpz",ZONES.filter(z=>D.cmp[z]).map(z=>[z,ZN[z]]),cs.a))+'<div class="pw-chart" id="mrCmpc"></div><div id="mrCmpk"></div><p class="pw-foot">Same method as the bar chart, applied to both settlement dates. Full years: '+Y+' = mean of its quarters, '+(Y+1)+' = mean of its quarter futures.</p>';
 bars($("mrCmpc"),{cats,series:ser,unit:"€/MWh",dec:1,rot:narrow,seps:[5],label:"Futures now vs a month ago",src:"EEX base futures",bold:i=>i===0||i===5});
 $("mrCmpk").innerHTML=legend("mrCmpl",ser.map(s=>({key:s.key,name:s.name,color:s.color,kind:"bar"})),cs.hid||[]);bindLegend("mrCmpl",cs,cardCmp);bind("mrCmpz",k=>{cs.a=k;save();cardCmp();});}
let CM=[["gas","Gas, TTF front winter","€/MWh"],["coal","Coal, API2 December","$/t"],["co2","CO2, EUA December","€/t"],["de","DE power, day-ahead","€/MWh"]];
function cardCom(){const el=$("mrCom");if(!el||!vis(el))return;const c=D.com;if(!c||!c.months.length){el.hidden=true;return;}const cs=S("com",{hid:[]});
 const mt=k=>k===D.asof.slice(0,7)&&!isMonthEnd(D.asof);const K=c.contract||{};
 CM=[["gas","Gas, "+(K.gas||"TTF front winter"),"€/MWh"],["coal","Coal, "+(K.coal||"API2 December"),"$/t"],["co2","CO2, "+(K.co2||"EUA December"),"€/t"],["de","DE power, day-ahead","€/MWh"]];
 el.innerHTML=head("Commodity prices, monthly average","units shown","EEX / ICE daily settlements, Nord Pool (Germany) · last two months and month to date · latest settlement "+dlab(c.last_td),"")+
  '<div class="mr-com">'+CM.map(([k,l,u])=>'<div class="mr-comi"><div class="mr-comh">'+esc(l)+' <em>'+u+'</em></div><div class="pw-chart" id="mrCom_'+k+'"></div></div>').join("")+'</div>'+
  '<p class="pw-foot">Monthly mean of daily settlements of the same contract in every month (the front contracts at the latest settlement'+(c.last_td?', '+dlab(c.last_td):'')+'): gas = the next TTF winter not yet in delivery; coal and CO2 = the nearest December. DE power = Nord Pool DE-LU day-ahead.'+(c.months.length<3?' Settlement history in this feed starts '+mlab(c.months[0])+'.':'')+'</p>';
 const i0=Math.max(0,c.months.length-3),cmo=c.months.slice(i0);
 CM.forEach(([k,l,u])=>{const e=$("mrCom_"+k);if(!e)return;bars(e,{cats:cmo.map(m=>mlab(m)+(mt(m)?" MTD":"")),series:[{name:l,vals:c[k].slice(i0),color:k==="de"?C.qf:C.yf}],unit:u,dec:2,h:150,label:l,src:"EEX / ICE daily settlements, Nord Pool (Germany)",note:i=>k==="de"?"Nord Pool DE-LU day-ahead":c.contracts[cmo[i]][k]});});
}
/* ======================================================================== seasonal cards (Supply & weather) */
/* ======================================================================== Fundamentals: one month vs history */
const FW=[["wind","Wind","m/s",2],["rain","Rain","mm/d",2],["temp","Temp","°C",1]];
const FF=[["demand","Demand"],["gen","Generation"],["netexp","Net exports"],["hydro","Hydro"],["nuclear","Nuclear"],["wind","Wind"]];
const FA=[["Nordic","Nordic total"],["NO","Norway"],["SE","Sweden"],["FI","Finland"],["DK","Denmark"]];
const MONL=["January","February","March","April","May","June","July","August","September","October","November","December"];
function mstat(map,k,n){const y=+k.slice(0,4),m=k.slice(5),xs=[];for(let i=y-n;i<y;i++){const v=map[i+"-"+m];if(isNum(v))xs.push(v);}
 if(xs.length<2)return null;return{lo:Math.min(...xs),hi:Math.max(...xs),avg:xs.reduce((a,b)=>a+b,0)/xs.length,n:xs.length,from:y-n,to:y-1,val:map[k]};}
function rangeSvg(el,st,u,dc,label){const w=Math.max(96,Math.round(el.clientWidth||110)),h=150,T=16,B=8,ih=h-T-B;
 let lo=Math.min(st.lo,st.val??st.lo,st.avg),hi=Math.max(st.hi,st.val??st.hi,st.avg);const pad=(hi-lo)*.12||1;lo-=pad;hi+=pad;
 const Y=v=>T+ih-(v-lo)/(hi-lo)*ih,cx=w*.42,bw=Math.min(34,w*.28);
 let s='<svg class="pw-svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+esc(label)+'">';
 if(lo<0&&hi>0)s+='<line class="z" x1="4" x2="'+(w-4)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'"/>';
 s+='<rect class="mr-rg" x="'+(cx-bw/2).toFixed(1)+'" y="'+Y(st.hi).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(2,Y(st.lo)-Y(st.hi)).toFixed(1)+'" rx="3"/>';
 s+='<text class="yt mr-rl" x="'+(cx-bw/2-4).toFixed(1)+'" y="'+(Y(st.hi)+3.5).toFixed(1)+'">'+f(st.hi,dc)+'</text><text class="yt mr-rl" x="'+(cx-bw/2-4).toFixed(1)+'" y="'+(Y(st.lo)+3.5).toFixed(1)+'">'+f(st.lo,dc)+'</text>';
 s+='<line class="mr-av" x1="'+(cx-bw/2-3).toFixed(1)+'" x2="'+(cx+bw/2+3).toFixed(1)+'" y1="'+Y(st.avg).toFixed(1)+'" y2="'+Y(st.avg).toFixed(1)+'"/>';
 if(isNum(st.val)){const yv=Y(st.val);s+='<path class="mr-mk" d="M'+cx.toFixed(1)+','+(yv-6).toFixed(1)+'l6,6l-6,6l-6,-6z"/><text class="mr-vl" x="'+(cx+bw/2+6).toFixed(1)+'" y="'+(yv+4).toFixed(1)+'">'+f(st.val,dc)+'</text>';}
 s+='<rect class="hit" x="0" y="0" width="'+w+'" height="'+h+'"/></svg>';el.innerHTML=s;
 const svg=el.querySelector("svg"),tip=e=>{PC().showTip&&PC().showTip('<b>'+esc(label)+'</b><br><i class="pw-tk" style="background:var(--accent)"></i>Actual: <b>'+f(st.val,dc)+'</b> '+u+
  '<br><i class="pw-tk" style="background:var(--faint)"></i>Average '+st.from+'–'+st.to+': <b>'+f(st.avg,dc)+'</b> '+u+'<br>Min–max '+st.from+'–'+st.to+': '+f(st.lo,dc)+' – '+f(st.hi,dc)+' '+u,e);};
 svg.addEventListener("pointermove",tip);svg.addEventListener("pointerdown",tip);svg.addEventListener("pointerleave",()=>PC().hideTip&&PC().hideTip());}
function cardFund(){const el=$("mrFund");if(!el||!vis(el))return;const E=D.ember,X=D.weather;if(!E||!X){el.hidden=true;return;}
 const cs=S("fund",{a:"Nordic",z:null,hid:[]});if(!E.areas[cs.a])cs.a="Nordic";
 const cm=D.asof.slice(0,7),okM=k=>k<cm;const wmap=k=>mseries(X.months,X[k]),emap=k=>mseries(E.months,(E.areas[cs.a]||{})[k]||[]);
 const lastW=X.months.filter(okM).pop(),lastE=E.months.filter(okM).pop(),latest=lastW<lastE?lastW:lastE;
 const opts=[];for(let k=latest;opts.length<24;k=addM(k,-1))opts.push(k);
 if(!cs.m||!opts.includes(cs.m))cs.m=latest;const k=cs.m,ml=MONL[+k.slice(5)-1],yr=k.slice(0,4),al=(FA.find(x=>x[0]===cs.a)||FA[0])[1];
 const card=(id,name,u,st,zk)=>'<div class="mr-fc'+(cs.z===zk?" is-z":"")+'"><div class="mr-fch"><b>'+esc(name)+'</b> <em>'+esc(u)+'</em></div><div class="mr-fcc" id="'+id+'"></div>'+
  seg("mrFzb_"+zk,[["M",MON[+k.slice(5)-1]],["S","Jan–Dec"]],cs.z===zk?"S":"M")+'</div>';
 const ws=FW.map(([m,n,u,d])=>[m,n,u,d,mstat(wmap(m),k,50)]),fs=FF.map(([m,n])=>[m,n,"TWh",2,mstat(emap(m),k,10)]);
 el.innerHTML=head("Nordic power fundamentals – "+ml+" "+yr,"","month average vs history · weather: ERA5 reanalysis (Copernicus C3S), Nordic area mean · demand, supply and trade: Ember monthly electricity data","")+
  tools('<label class="mr-sel">Month <select id="mrFm">'+opts.map(o=>'<option value="'+o+'"'+(o===k?" selected":"")+'>'+MONL[+o.slice(5)-1]+' '+o.slice(0,4)+'</option>').join("")+'</select></label>',chips("mrFa",FA,cs.a))+
  '<div class="mr-fg"><div class="mr-fgw"><div class="mr-fgh">Weather: '+ml+' average <em>Nordic area · 50Y range and average</em></div><div class="mr-fgi mr-fg3">'+
  ws.map(([m,n,u,d,st])=>st?card("mrFw_"+m,n,u,st,"w_"+m):"").join("")+'</div></div>'+
  '<div class="mr-fgw"><div class="mr-fgh">Power demand, supply and trade <em>'+esc(al)+' · TWh · 10Y range and average</em></div><div class="mr-fgi mr-fg6">'+
  fs.map(([m,n,u,d,st])=>st?card("mrFe_"+m,n,u,st,"e_"+m):"").join("")+'</div></div></div>'+
  '<div class="mr-fkey"><span><i class="mr-krg"></i>Min–max range</span><span><i class="mr-kav"></i>Average</span><span><i class="mr-kmk"></i>'+ml+' '+yr+'</span></div>'+
  '<div id="mrFz"></div>'+
  '<p class="pw-foot">Range and average over the same calendar month of the previous 50 years (weather) or 10 years (power). Nordic total = Norway + Sweden + Finland + Denmark. Net exports = exports minus imports (negative = net importer). Weather is a Nordic-wide area mean (55–71°N, 4–32°E).</p>';
 ws.forEach(([m,n,u,d,st])=>{if(st)rangeSvg($("mrFw_"+m),st,u,d,n+", "+ml+" "+yr);});
 fs.forEach(([m,n,u,d,st])=>{if(st)rangeSvg($("mrFe_"+m),st,u,d,n+" ("+al+"), "+ml+" "+yr);});
 $("mrFm").onchange=e=>{cs.m=e.target.value;save();cardFund();};bind("mrFa",x=>{cs.a=x;save();cardFund();});
 [...ws.map(x=>"w_"+x[0]),...fs.map(x=>"e_"+x[0])].forEach(zk=>bind("mrFzb_"+zk,v=>{cs.z=v==="S"?zk:null;save();cardFund();if(cs.z){const p=$("mrFz");p&&p.scrollIntoView({block:"nearest",behavior:"smooth"});}}));
 if(cs.z){const isW=cs.z[0]==="w",m=cs.z.slice(2),def=isW?FW.find(x=>x[0]===m):FF.find(x=>x[0]===m);if(!def){cs.z=null;return;}
  const u=isW?def[2]:"TWh",dc=isW?def[3]:2,nm=def[1]+(isW?", Nordic area":", "+al),Y=+yr,map=isW?wmap(m):emap(m),N=isW?50:10;
  const z=$("mrFz");z.innerHTML='<div class="mr-fzh"><b>'+esc(nm)+': Jan–Dec</b> <em>'+u+' · '+Y+' vs '+(Y-1)+', '+N+'Y range and average ('+(Y-N)+'–'+(Y-1)+')</em><button type="button" class="button mr-fzx" id="mrFzx">Back to '+MON[+k.slice(5)-1]+'</button></div><div class="pw-chart" id="mrFzc"></div><div id="mrFzk"></div>';
  const zs={v:"S",hid:cs.hid};const L=monthlyChart($("mrFzc"),map,{Y,y0:Y-N,unit:u,dec:dc,label:nm,name:nm,src:isW?"ERA5 reanalysis (Copernicus C3S)":"Ember monthly electricity data",zero:m!=="netexp"&&m!=="temp"},zs);
  $("mrFzk").innerHTML=legend("mrFzl",L,cs.hid||[]);bindLegend("mrFzl",cs,cardFund);$("mrFzx").onclick=()=>{cs.z=null;save();cardFund();};}}
/* ---------- render ---------- */
const vis=el=>!!(el&&el.offsetParent!==null&&el.getClientRects().length);
function shells(){const m=$("mrBody");if($("mrMA"))return;if(m&&!m.dataset.ready){m.dataset.ready="1";
  m.innerHTML='<div class="pw-mini-h pw-sec-h nm-subh">Power price development <em>system and area spot prices, quarters and futures</em></div>'+
  '<section class="pw-card pw-full" id="mrMA"></section><div class="pw-grid mr-grid2"><section class="pw-card" id="mrBar"></section><section class="pw-card" id="mrTbl"></section></div>'+
  '<div class="pw-mini-h pw-sec-h nm-subh">Curve and fuels <em>futures now vs a month ago · gas, coal, carbon, German power</em></div>'+
  '<div class="pw-grid mr-grid2"><section class="pw-card" id="mrCmp"></section><section class="pw-card" id="mrCom"></section></div><div class="pw-mini-h pw-sec-h nm-subh">Fundamentals <em>latest month vs history · each card zooms out to Jan–Dec</em></div>'+
  '<section class="pw-card pw-full" id="mrFund"></section><p class="pw-note mr-gen" id="mrGen"></p>';}
}
function anyVis(){shells();return["mrMA","mrBar","mrTbl","mrCmp","mrCom","mrFund"].some(id=>vis($(id)));}
function draw(){if(!D)return;[cardMA,cardBars,cardTable,cardCmp,cardCom,cardFund].forEach(fn=>{try{fn();}catch(e){console.error("mr",fn.name,e);}});
 const g=$("mrGen");if(g)g.innerHTML="Data built "+esc(D.generated_utc.replace("T"," ").replace("Z"," UTC"))+" · spot to "+dlab(D.asof)+" · futures settlement "+dlab(D.eex_td)+(D.gaps&&D.gaps.length?" · gaps: "+esc(D.gaps.join("; ")):"");}
function render(){if(!anyVis())return;if(D){draw();return;}
 if(failed){const m=$("mrGen")||$("mrBody");if(m)m.textContent="Data not available yet (data/mr.json).";failed=false;return;}
 load().then(()=>draw());}
let rt;const later=()=>{clearTimeout(rt);rt=setTimeout(render,90);};
addEventListener("resize",later);addEventListener("mm:expand",later);
window.MMReview={render,load};
})();
