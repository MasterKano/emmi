/* Nordic Power tab: 'MR' block (price development, quarterly/yearly bars with futures, monthly table, curve vs a month
   ago, commodities) and the seasonal Jan–Dec cards in 'Supply & weather'. Data: data/mr.json (scripts/build_mr.py),
   loaded only when one of the two sections is open. Every chart: area chips where zone data exists, view buttons,
   hover values with units, legend items that hide/show a series. */
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
 s+='</svg>';el.innerHTML=s;const u=o.unit||"";
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
  line(el,{n:12,series:ser,band,xlab:i=>MON[i],unit:o.unit,dec:o.dec,zero:o.zero,label:o.label,tipTitle:i=>MON[i]});
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
  unit:o.unit,dec:o.dec,zero:o.zero,label:o.label,tipTitle:i=>mlab(ks[i])+(o.mtd&&ks[i]===o.mtd?" (month to date)":"")});
 const L=ser.map(s=>({key:s.key,name:s.name,color:s.color,w:s.w,dash:s.dash}));if(band)L.push({key:"band",name:"Same-month min–max "+rng,kind:"band"});return L;}
const MV=[["S","Seasonal Jan–Dec","Current year vs last year, historical range and average"],["13","13M","Last 13 months vs same-month history"],["5Y","5Y"],["A","All"]];
/* ======================================================================== MR section */
const MA_R=[["1M","1M"],["3M","3M"],["6M","6M"],["YTD","YTD"],["1Y","1Y"],["S","Seasonal Jan–Dec"]];
function cardMA(){const el=$("mrMA");if(!el||!vis(el))return;const cs=S("ma",{a:"SYS",r:"6M",hid:["daily"]});if(!D.daily.v[cs.a])cs.a="SYS";
 const a=cs.a,ma=D._ma[a],dv=D.daily.v[a];let last=ma.length-1;while(last>0&&!isNum(ma[last]))last--;
 const Y=D.year,nm=ZN[a]||a;let body="",keys=[];
 el.innerHTML=head("Nordic "+(a==="SYS"?"system":"area "+esc(a))+" spot price, 30-day moving average","€/MWh",
  "day-ahead daily averages, trailing 30-day mean · Nord Pool · to "+dlab(D._day(last)),"")+
  tools(chips("mrMAz",ZONES.filter(z=>D.daily.v[z]).map(z=>[z,ZN[z]]),a),seg("mrMAr",MA_R,cs.r))+'<div class="pw-chart" id="mrMAc"></div><div id="mrMAk"></div>'+
  '<p class="pw-foot">30-day MA = mean of the last 30 Nord Pool daily averages (each daily average is the mean of the delivery day\'s prices). Seasonal view: one line per year on a Jan–Dec axis; the band is the min–max of earlier years with published daily data (Nord Pool public data from 2024).</p>';
 const c=$("mrMAc");
 if(cs.r==="S"){const yrs={};for(let i=0;i<ma.length;i++){if(!isNum(ma[i]))continue;const d=D._day(i),y=+d.slice(0,4),doy=Math.round((Date.parse(d)-Date.UTC(y,0,1))/864e5);(yrs[y]=yrs[y]||new Array(366).fill(null))[doy]=ma[i];}
  const prior=Object.keys(yrs).map(Number).filter(y=>y<Y).sort();const lo=[],hi=[],av=[];for(let i=0;i<366;i++){const xs=prior.map(y=>yrs[y][i]).filter(isNum);lo.push(xs.length>1?Math.min(...xs):null);hi.push(xs.length>1?Math.max(...xs):null);av.push(xs.length>1?xs.reduce((p,q)=>p+q,0)/xs.length:null);}
  const rng=prior.length?prior[0]+"–"+prior[prior.length-1]:"";
  const ser=[{key:"cur",name:String(Y),color:C.cur,vals:yrs[Y]||[],w:3,end:true},{key:"last",name:String(Y-1),color:C.last,vals:yrs[Y-1]||[],w:1.8}];
  if(prior.length>1)ser.push({key:"avg",name:"Average "+rng,color:C.avg,vals:av,w:1.4,dash:"4 3"});
  ser.forEach(s=>s.off=(cs.hid||[]).includes(s.key));const band=prior.length>1?{lo,hi,name:"Range "+rng,off:(cs.hid||[]).includes("band")}:null;
  const md=[0,31,59,90,120,151,181,212,243,273,304,334];
  line(c,{n:366,series:ser,band,xlab:i=>MON[md.indexOf(i)]||"",xticks:md.filter((_,k)=>W(c)>=520||k%2===0),unit:"€/MWh",label:"30-day moving average by year",tipTitle:i=>{const dd=new Date(Date.UTC(2001,0,1)+i*864e5);return"Day "+(i+1)+" ("+dd.getUTCDate()+" "+MON[dd.getUTCMonth()]+")";}});
  keys=ser.map(s=>({key:s.key,name:s.name,color:s.color,w:s.w,dash:s.dash}));if(band)keys.push({key:"band",name:"Min–max "+rng,kind:"band"});}
 else{const days={"1M":31,"3M":92,"6M":183,"1Y":366}[cs.r];let i0=days?last-days+1:D.months.length&&Math.round((Date.UTC(Y,0,1)-D._t0)/864e5);i0=Math.max(0,i0);
  const idx=[];for(let i=i0;i<=last;i++)idx.push(i);
  const ser=[{key:"ma",name:"30-day moving average",color:C.cur,vals:idx.map(i=>ma[i]),w:2.4,area:true,end:true},{key:"daily",name:"Daily average",color:C.daily,vals:idx.map(i=>dv[i]),w:1,dash:"2 2"}];
  ser.forEach(s=>s.off=(cs.hid||[]).includes(s.key));
  const mt=idx.map((d,k)=>k).filter(k=>{const s2=D._day(idx[k]);return idx.length<=40?(+s2.slice(8)%7===1):s2.endsWith("-01")&&(idx.length<200||+s2.slice(5,7)%2===1||idx.length<250);});
  line(c,{n:idx.length,series:ser,xlab:k=>{const s2=D._day(idx[k]);return idx.length<=40?+s2.slice(8)+" "+MON[+s2.slice(5,7)-1]:MON[+s2.slice(5,7)-1]+(s2.slice(5,7)==="01"?" "+s2.slice(2,4):"");},xticks:mt,unit:"€/MWh",label:"30-day moving average",tipTitle:k=>dlab(D._day(idx[k]))});
  keys=ser.map(s=>({key:s.key,name:s.name,color:s.color,w:s.w,dash:s.dash}));}
 $("mrMAk").innerHTML=legend("mrMAl",keys,cs.hid||[]);bindLegend("mrMAl",cs,cardMA);
 bind("mrMAz",k=>{cs.a=k;save();cardMA();});bind("mrMAr",k=>{cs.r=k;save();cardMA();});}
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
 const lk=D.months[D.months.length-1],mtd=D.asof.slice(0,7)===lk&&!isMonthEnd(D.asof);const full=mtd?[addM(lk,-3),addM(lk,-2),addM(lk,-1)]:[addM(lk,-2),addM(lk,-1),lk];
 const mv=(z,k)=>{const i=D._mi[k];return i==null?null:D.monthly[z][i];};
 let t='<div class="mr-tw"><table class="pw-tbl mr-tbl"><thead><tr><th class="c-z">Period</th>'+cols.map(z=>'<th>'+(z==="SYS"?"SYS":z)+'</th>').join("")+'</tr></thead><tbody>';
 t+='<tr class="sum mr-fy"><th class="c-z">'+Y+' full year <em>actuals + futures</em></th>'+cols.map(z=>'<td class="num"><b>'+f((D.fut[z]||{}).fy)+'</b></td>').join("")+'</tr>';
 full.forEach(k=>{t+='<tr><th class="c-z">'+mlab(k)+'</th>'+cols.map(z=>'<td class="num">'+f(mv(z,k))+'</td>').join("")+'</tr>';});
 if(mtd)t+='<tr class="pw-exp"><th class="c-z">'+mlab(lk)+' <em>month to date, to '+dlab(D.asof)+'</em></th>'+cols.map(z=>'<td class="num mm">'+f(mv(z,lk))+'</td>').join("")+'</tr>';
 t+='</tbody></table></div>';
 el.innerHTML=head("Historical prices (monthly average) and "+Y+" full-year futures","€/MWh","Nord Pool day-ahead monthly averages · full year = mean of the four "+Y+" quarters (actual months + EEX futures "+dlab(D.eex_td)+")","")+
  tools(seg("mrTbls",Object.entries(TS).map(([k,v])=>[k,v[0]]),cs.s))+t+'<p class="pw-foot">SYS = Nordic system price. Full year as in the bar chart: completed months are actuals, the current month blends actual days with the month future, later months are futures.</p>';
 bind("mrTbls",k=>{cs.s=k;save();cardTable();});}
const isMonthEnd=iso=>{const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.getUTCDate()===1;};
function cardCmp(){const el=$("mrCmp");if(!el||!vis(el))return;const cs=S("cmp",{a:"SYS",hid:[]});if(!D.cmp[cs.a])cs.a="SYS";const c=D.cmp[cs.a],Y=D.year,y1=String(Y).slice(2),y2=String(Y+1).slice(2);
 const cats=[String(Y),"Q1-"+y1,"Q2-"+y1,"Q3-"+y1,"Q4-"+y1,String(Y+1),"Q1-"+y2,"Q2-"+y2,"Q3-"+y2,"Q4-"+y2];
 const ser=[{key:"cur",name:"Settlement "+dlab(D.eex_td),color:C.qf,vals:c.cur||[]}];if(c.prev&&D.eex_td_prev)ser.push({key:"prev",name:"Settlement "+dlab(D.eex_td_prev),color:C.prev,vals:c.prev});
 ser.forEach(s=>s.off=(cs.hid||[]).includes(s.key));const narrow=W(el)<560;
 el.innerHTML=head("Actuals and futures by quarter: now vs a month ago, "+(cs.a==="SYS"?"system price":"area "+esc(cs.a)),"€/MWh","EEX base futures (Nordic system and zonal) · completed months: Nord Pool actuals as known on each date","")+
  tools(chips("mrCmpz",ZONES.filter(z=>D.cmp[z]).map(z=>[z,ZN[z]]),cs.a))+'<div class="pw-chart" id="mrCmpc"></div><div id="mrCmpk"></div><p class="pw-foot">Same method as the bar chart, applied to both settlement dates. Full years: '+Y+' = mean of its quarters, '+(Y+1)+' = mean of its quarter futures.</p>';
 bars($("mrCmpc"),{cats,series:ser,unit:"€/MWh",dec:1,rot:narrow,seps:[5],label:"Futures now vs a month ago",bold:i=>i===0||i===5});
 $("mrCmpk").innerHTML=legend("mrCmpl",ser.map(s=>({key:s.key,name:s.name,color:s.color,kind:"bar"})),cs.hid||[]);bindLegend("mrCmpl",cs,cardCmp);bind("mrCmpz",k=>{cs.a=k;save();cardCmp();});}
const CM=[["gas","Gas, TTF day-ahead","€/MWh"],["coal","Coal, API2 front-December","$/t"],["co2","Carbon, EUA front-December","€/t"],["de","Power, Germany day-ahead","€/MWh"]];
function cardCom(){const el=$("mrCom");if(!el||!vis(el))return;const c=D.com;if(!c||!c.months.length){el.hidden=true;return;}const cs=S("com",{hid:[]});
 const mt=k=>k===D.asof.slice(0,7)&&!isMonthEnd(D.asof);
 el.innerHTML=head("Fuel, carbon and German power prices, monthly averages","units shown","EEX / ICE daily settlements (TTF, EUA, API2), Nord Pool (Germany) · history in this feed starts "+mlab(c.months[0])+" · latest settlement "+dlab(c.last_td),"")+
  tools(chips("mrComc",CM.map(([k,l])=>[k,l.split(",")[0]]).concat([["all","All four"]]),cs.k||"all"))+
  '<div class="mr-com">'+CM.filter(([k])=>!cs.k||cs.k==="all"||cs.k===k).map(([k,l,u])=>'<div class="mr-comi"><div class="mr-comh">'+esc(l)+' <em>'+u+'</em></div><div class="pw-chart" id="mrCom_'+k+'"></div></div>').join("")+'</div>'+
  '<p class="pw-foot">Monthly mean of daily settlements; the latest month is month to date. Coal and carbon use the nearest December contract.</p>';
 CM.forEach(([k,l,u])=>{const e=$("mrCom_"+k);if(!e)return;bars(e,{cats:c.months.map(m=>mlab(m)+(mt(m)?" MTD":"")),series:[{name:l,vals:c[k],color:k==="de"?C.qf:C.yf}],unit:u,dec:2,h:150,label:l,note:i=>k==="gas"?"TTF day-ahead":k==="de"?"Nord Pool DE-LU day-ahead":c.contracts[c.months[i]][k]});});
 bind("mrComc",k=>{cs.k=k;save();cardCom();});}
/* ======================================================================== seasonal cards (Supply & weather) */
function cardZP(){const el=$("mrZP");if(!el||!vis(el))return;const cs=S("zp",{a:"SYS",v:"S",hid:[]});if(!D.monthly[cs.a])cs.a="SYS";
 const map=mseries(D.months,D.monthly[cs.a]),mtd=!isMonthEnd(D.asof)?D.asof.slice(0,7):null;
 el.innerHTML=head("Monthly "+(cs.a==="SYS"?"system":"area "+esc(cs.a))+" price vs history","€/MWh","day-ahead monthly averages · Nord Pool (2024 on), ENTSO-E (zones 2015–2023) · latest month to date","")+
  tools(chips("mrZPz",ZONES.filter(z=>D.monthly[z]).map(z=>[z,ZN[z]]),cs.a),seg("mrZPv",MV,cs.v))+'<div class="pw-chart" id="mrZPc"></div><div id="mrZPk"></div>'+
  '<p class="pw-foot">'+(cs.a==="SYS"?"System price history in this chart starts in 2024 (older monthly system prices are not in Nord Pool's public data API).":"Range and average over 2015 to last year.")+' The current month is month to date.</p>';
 const k=monthlyChart($("mrZPc"),map,{Y:D.year,y0:2015,unit:"€/MWh",dec:2,label:"Monthly price",name:"Monthly average",mtd},cs);
 $("mrZPk").innerHTML=legend("mrZPl",k,cs.hid||[]);bindLegend("mrZPl",cs,cardZP);bind("mrZPz",x=>{cs.a=x;save();cardZP();});bind("mrZPv",x=>{cs.v=x;save();cardZP();});}
const EM=[["demand","Demand"],["gen","Total generation"],["netexp","Net exports"],["hydro","Hydro"],["nuclear","Nuclear"],["wind","Wind"],["solar","Solar"],["fossil","Fossil"],["bio","Bioenergy"]];
const EA=[["Nordic","Nordic total"],["NO","Norway"],["SE","Sweden"],["FI","Finland"],["DK","Denmark"]];
function cardEM(){const el=$("mrEM");if(!el||!vis(el))return;const E=D.ember;if(!E){el.hidden=true;return;}const cs=S("em",{a:"Nordic",m:"demand",v:"S",hid:[]});
 const A=E.areas[cs.a]||E.areas.Nordic,map=mseries(E.months,A[cs.m]||[]),ml=(EM.find(x=>x[0]===cs.m)||EM[0])[1],al=(EA.find(x=>x[0]===cs.a)||EA[0])[1];
 el.innerHTML=head(ml+", "+al+": monthly vs the last 10 years","TWh","Ember monthly electricity data (CC BY 4.0) · latest "+mlab(E.months[E.months.length-1]),"")+
  tools(chips("mrEMa",EA,cs.a),chips("mrEMm",EM,cs.m),seg("mrEMv",MV,cs.v))+'<div class="pw-chart" id="mrEMc"></div><div id="mrEMk"></div>'+
  '<p class="pw-foot">Nordic total = Norway + Sweden + Finland + Denmark. Net exports = exports minus imports (negative = net importer). Range and average: '+(D.year-10)+' to '+(D.year-1)+'.</p>';
 const k=monthlyChart($("mrEMc"),map,{Y:D.year,y0:D.year-10,unit:"TWh",dec:2,label:ml,name:ml,zero:cs.m!=="netexp"},cs);
 $("mrEMk").innerHTML=legend("mrEMl",k,cs.hid||[]);bindLegend("mrEMl",cs,cardEM);
 bind("mrEMa",x=>{cs.a=x;save();cardEM();});bind("mrEMm",x=>{cs.m=x;save();cardEM();});bind("mrEMv",x=>{cs.v=x;save();cardEM();});}
const WX=[["temp","Temperature","°C",1],["rain","Precipitation","mm/day",2],["wind","Wind speed","m/s",2]];
function cardWX(){const el=$("mrWX");if(!el||!vis(el))return;const X=D.weather;if(!X){el.hidden=true;return;}const cs=S("wx",{m:"temp",v:"S",hid:[]});
 const w=WX.find(x=>x[0]===cs.m)||WX[0],map=mseries(X.months,X[w[0]]||[]);
 el.innerHTML=head(w[1]+", Nordic area: monthly vs the last 50 years",w[2],"ERA5 reanalysis (Copernicus C3S), area mean 55–71°N, 4–32°E · latest "+mlab(X.months[X.months.length-1]),"")+
  tools(chips("mrWXm",WX.map(x=>[x[0],x[1]]),cs.m),seg("mrWXv",MV,cs.v))+'<div class="pw-chart" id="mrWXc"></div><div id="mrWXk"></div>'+
  '<p class="pw-foot">Monthly means: 2 m temperature, total precipitation (mm per day), 10 m wind speed. Range and average: '+(D.year-50)+' to '+(D.year-1)+'. One area for the whole region, so no zone switch.</p>';
 const k=monthlyChart($("mrWXc"),map,{Y:D.year,y0:D.year-50,unit:w[2],dec:w[3],label:w[1],name:w[1],zero:cs.m!=="temp"},cs);
 $("mrWXk").innerHTML=legend("mrWXl",k,cs.hid||[]);bindLegend("mrWXl",cs,cardWX);bind("mrWXm",x=>{cs.m=x;save();cardWX();});bind("mrWXv",x=>{cs.v=x;save();cardWX();});}
/* ---------- render ---------- */
const vis=el=>!!(el&&el.offsetParent!==null&&el.getClientRects().length);
function shells(){const m=$("mrBody");if(m&&!m.dataset.ready){m.dataset.ready="1";
  m.innerHTML='<div class="pw-mini-h pw-sec-h nm-subh">Power price development <em>system and area spot prices, quarters and futures</em></div>'+
  '<section class="pw-card pw-full" id="mrMA"></section><div class="pw-grid mr-grid2"><section class="pw-card" id="mrBar"></section><section class="pw-card" id="mrTbl"></section></div>'+
  '<div class="pw-mini-h pw-sec-h nm-subh">Curve and fuels <em>futures now vs a month ago · gas, coal, carbon, German power</em></div>'+
  '<div class="pw-grid mr-grid2"><section class="pw-card" id="mrCmp"></section><section class="pw-card" id="mrCom"></section></div><p class="pw-note mr-gen" id="mrGen"></p>';}
 const s=$("mrSeason");if(s&&!s.dataset.ready){s.dataset.ready="1";s.innerHTML='<section class="pw-card" id="mrZP"></section><section class="pw-card" id="mrEM"></section><section class="pw-card" id="mrWX"></section>';}}
function anyVis(){shells();return["mrMA","mrBar","mrTbl","mrCmp","mrCom","mrZP","mrEM","mrWX"].some(id=>vis($(id)));}
function draw(){if(!D)return;[cardMA,cardBars,cardTable,cardCmp,cardCom,cardZP,cardEM,cardWX].forEach(fn=>{try{fn();}catch(e){console.error("mr",fn.name,e);}});
 const g=$("mrGen");if(g)g.innerHTML="Data built "+esc(D.generated_utc.replace("T"," ").replace("Z"," UTC"))+" · spot to "+dlab(D.asof)+" · futures settlement "+dlab(D.eex_td)+(D.gaps&&D.gaps.length?" · gaps: "+esc(D.gaps.join("; ")):"");}
function render(){if(!anyVis())return;if(D){draw();return;}
 if(failed){const m=$("mrBody");if(m)m.insertAdjacentHTML("afterbegin",'<p class="pw-note">Data not available yet (data/mr.json).</p>');failed=false;return;}
 load().then(()=>draw());}
let rt;const later=()=>{clearTimeout(rt);rt=setTimeout(render,90);};
addEventListener("resize",later);addEventListener("mm:expand",later);
window.MMReview={render,load};
})();
