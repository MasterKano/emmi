/* Nordic power dashboard: rolling 30 days hourly. Data: data/nordic_dash.json (ENTSO-E A75/A44/A65/A69, Open-Meteo,
   NVE + ENTSO-E A72 reservoirs, EEX/ICE gas & carbon). Lazy-loaded when the section is opened. Plain SVG, no library. */
(function(){
const $=id=>document.getElementById(id),esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isN=v=>typeof v==="number"&&isFinite(v);
const COL={hydro:"#3a86ff",nuclear:"#9b5de5",wind:"#2ec4b6",solar:"#ffbe0b",thermal:"#8d6e63"};
const NAMES={hydro:"Hydro",nuclear:"Nuclear",wind:"Wind",solar:"Solar",thermal:"Thermal & other"};
const AREAS=[["NOR","Nordic",["NO1","NO2","NO3","NO4","NO5","SE1","SE2","SE3","SE4","FI","DK1","DK2"]],["NO","Norway",["NO1","NO2","NO3","NO4","NO5"]],["SE","Sweden",["SE1","SE2","SE3","SE4"]],["FI","Finland",["FI"]],["DK","Denmark",["DK1","DK2"]],
 ...["SE1","SE2","SE3","SE4","NO1","NO2","NO3","NO4","NO5","DK1","DK2"].map(z=>[z,z,[z]])];
const RAIN={NOR:["NO_S","NO_C","NO_N","SE_N"],NO:["NO_S","NO_C","NO_N"],SE:["SE_N"],NO1:["NO_S"],NO2:["NO_S"],NO5:["NO_S"],NO3:["NO_C"],NO4:["NO_N"],SE1:["SE_N"],SE2:["SE_N"]};
const RES={NOR:"nose",NO:"no",SE:"se",NO1:"no",NO2:"no",NO3:"no",NO4:"no",NO5:"no",SE1:"se",SE2:"se",SE3:"se",SE4:"se"};
let D=null,loading=null,st={a:"NOR",cmp:"",hid:{},w:null,day:null},A=null,HD=null;
const fmtD=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Stockholm",day:"numeric",month:"short"});
const fmtH=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Stockholm",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtK=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"});
const tms=i=>D._t0+i*36e5;
function sum(arrs){if(!arrs.length)return null;const n=D.n,o=new Array(n).fill(null);arrs.forEach(a=>{if(a)for(let i=0;i<n;i++)if(isN(a[i]))o[i]=(o[i]||0)+a[i];});return o;}
function build(){const ar=AREAS.find(x=>x[0]===st.a),zs=ar[2],Z=D.zones,n=D.n,g={};
 D.types.forEach(k=>{const s=sum(zs.map(z=>Z[z]&&Z[z].g[k]).filter(Boolean));if(s&&s.some(v=>v>0.5))g[k]=s;});
 const l=sum(zs.map(z=>Z[z]&&Z[z].l).filter(Boolean)),wf=sum(zs.map(z=>Z[z]&&Z[z].wf).filter(Boolean));
 let p;if(zs.length===1)p=(Z[zs[0]]||{}).p||[];else{p=new Array(n).fill(null);for(let i=0;i<n;i++){let s=0,w=0,s2=0,c=0;zs.forEach(z=>{const q=Z[z]&&Z[z].p&&Z[z].p[i],ll=Z[z]&&Z[z].l&&Z[z].l[i];if(isN(q)){s2+=q;c++;if(isN(ll)){s+=q*ll;w+=ll;}}});p[i]=w?Math.round(s/w*10)/10:c?Math.round(s2/c*10)/10:null;}}
 const tot=new Array(n).fill(null);Object.values(g).forEach(a=>a.forEach((v,i)=>{if(isN(v))tot[i]=(tot[i]||0)+v;}));
 const ni=tot.map((v,i)=>isN(v)&&l&&isN(l[i])?l[i]-v:null);
 const ctry=st.a==="NOR"?["NO","SE","FI","DK"]:[st.a.slice(0,2)];
 const td=D.days.map((_,k)=>{const v=ctry.map(c=>(D.temp[c]||[])[k]).filter(isN);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;});
 const rr=RAIN[st.a]||[],rd=D.days.map((_,k)=>{const v=rr.map(r=>(D.rain[r]||[])[k]).filter(isN);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;});
 const cp=st.cmp&&Z[st.cmp]?Z[st.cmp].p:null,spr=cp?p.map((v,i)=>isN(v)&&isN(cp[i])?Math.round((v-cp[i])*10)/10:null):null;
 A={name:ar[1],zs,g,l,wf,p,tot,ni,td,rd,rr,spr,res:RES[st.a],ctry};}
function dayOf(i){return HD[i];}
function load(){if(D)return Promise.resolve(D);if(loading)return loading;loading=fetch("data/nordic_dash.json?t="+Math.floor(Date.now()/6e5),{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(j=>{D=j;D._t0=Date.parse(D.t0);HD=[];for(let i=0;i<D.n;i++)HD.push(D.days.indexOf(fmtK.format(new Date(tms(i)))));return D;});return loading;}
/* ---------- drawing ---------- */
const ML=44,MR=48,MT=8,MB=18;let W=600,CH=[];
function xs(i){const[a,b]=st.w;return ML+(i-a)/(b-a)*(W-ML-MR);}
function ix(px){const[a,b]=st.w;return Math.max(a,Math.min(b,Math.round(a+(px-ML)/(W-ML-MR)*(b-a))));}
function yScale(lo,hi,h){if(lo===hi){hi=lo+1;}const pad=(hi-lo)*0.06;lo-=lo<0||lo>0?pad:0;hi+=pad;return{lo,hi,y:v=>MT+(hi-v)/(hi-lo)*(h-MT-MB)};}
function ticks(lo,hi,n){const st0=(hi-lo)/n,m=Math.pow(10,Math.floor(Math.log10(st0))),s=[1,2,2.5,5,10].map(x=>x*m).find(x=>x>=st0)||st0,o=[];for(let v=Math.ceil(lo/s)*s;v<=hi+1e-9;v+=s)o.push(Math.round(v*100)/100);return o;}
function path(a,y,step){let d="",on=false;const[i0,i1]=st.w;for(let i=i0;i<=i1;i++){const v=a[i];if(!isN(v)){on=false;continue;}const X=xs(i).toFixed(1),Y=y(v).toFixed(1);d+=(on?"L":"M")+X+" "+Y;on=true;}return d;}
function frame(h,yl,yr,ul,ur){let s="";const[a,b]=st.w;
 yl&&ticks(yl.lo,yl.hi,4).forEach(v=>{const Y=yl.y(v);s+='<line x1="'+ML+'" x2="'+(W-MR)+'" y1="'+Y+'" y2="'+Y+'" class="db-grid"/><text x="'+(ML-4)+'" y="'+(Y+3)+'" class="db-ax" text-anchor="end">'+v+'</text>';});
 yr&&ticks(yr.lo,yr.hi,4).forEach(v=>{const Y=yr.y(v);s+='<text x="'+(W-MR+4)+'" y="'+(Y+3)+'" class="db-ax db-axr">'+v+'</text>';});
 if(ul)s+='<text x="4" y="'+(MT+2)+'" class="db-ax db-u">'+esc(ul)+'</text>';if(ur)s+='<text x="'+(W-4)+'" y="'+(MT+2)+'" class="db-ax db-u db-axr" text-anchor="end">'+esc(ur)+'</text>';
 const span=(b-a)/24,every=span>20?4:span>10?2:1;let last=-1;
 for(let i=a;i<=b;i++){const k=dayOf(i);if(k!==last&&(i===0||dayOf(i-1)!==k)){last=k;if(k%every===0||span<=10){const X=xs(i);s+='<line x1="'+X+'" x2="'+X+'" y1="'+MT+'" y2="'+(h-MB)+'" class="db-dgrid"/><text x="'+(X+2)+'" y="'+(h-5)+'" class="db-ax">'+fmtD.format(new Date(tms(i)+6*36e5))+'</text>';}}}
 const nowI=Math.floor((Date.now()-D._t0)/36e5);if(nowI>a&&nowI<b)s+='<line x1="'+xs(nowI)+'" x2="'+xs(nowI)+'" y1="'+MT+'" y2="'+(h-MB)+'" class="db-now"/>';
 return s;}
function ext(arrs){let lo=Infinity,hi=-Infinity;const[a,b]=st.w;arrs.forEach(x=>{if(x)for(let i=a;i<=b;i++)if(isN(x[i])){lo=Math.min(lo,x[i]);hi=Math.max(hi,x[i]);}});return lo===Infinity?[0,1]:[lo,hi];}
function hourlyFromDaily(d){return HD.map(k=>k>=0?d[k]:null);}
function panel(id,h,inner){const el=$(id);if(!el)return;el.innerHTML='<svg width="'+W+'" height="'+h+'" viewBox="0 0 '+W+' '+h+'" class="db-svg" role="img">'+inner+'<line class="db-x" x1="-9" x2="-9" y1="'+MT+'" y2="'+(h-MB)+'"/><rect class="db-brush" x="0" y="'+MT+'" width="0" height="'+(h-MT-MB)+'"/><rect class="db-hit" x="'+ML+'" y="0" width="'+(W-ML-MR)+'" height="'+h+'" fill="transparent"/></svg>';CH.push(el);}
function drawMain(){const h=W<500?230:300,ks=Object.keys(A.g).filter(k=>!st.hid[k]),[a,b]=st.w;
 const cum=[];let base=new Array(D.n).fill(0);const lay=ks.map(k=>{const top=base.map((v,i)=>isN(A.g[k][i])?v+A.g[k][i]:null);const L={k,lo:base,hi:top};base=top.map((v,i)=>isN(v)?v:base[i]);return L;});
 const yl=yScale(0,Math.max(1,...base.slice(a,b+1).filter(isN))/1e3,h);const px=[A.p,A.spr].filter(Boolean),[plo,phi]=ext(px),yr=yScale(Math.min(0,plo),phi,h);
 let s=frame(h,yl,yr,"GW","EUR/MWh");
 lay.forEach(L=>{let up="",dn=[];for(let i=a;i<=b;i++){if(!isN(L.hi[i])){if(up){s+='<path d="'+up+dn.reverse().join("")+'Z" fill="'+COL[L.k]+'" opacity=".85"/>';}up="";dn=[];continue;}up+=(up?"L":"M")+xs(i).toFixed(1)+" "+yl.y(L.hi[i]/1e3).toFixed(1);dn.push("L"+xs(i).toFixed(1)+" "+yl.y((L.lo[i]||0)/1e3).toFixed(1));}if(up)s+='<path d="'+up+dn.reverse().join("")+'Z" fill="'+COL[L.k]+'" opacity=".85"/>';});
 if(!st.hid.price)s+='<path d="'+path(A.p,yr.y)+'" class="db-price"/>';
 if(A.spr&&!st.hid.spread)s+='<line x1="'+ML+'" x2="'+(W-MR)+'" y1="'+yr.y(0)+'" y2="'+yr.y(0)+'" class="db-zero"/><path d="'+path(A.spr,yr.y)+'" class="db-spr"/>';
 panel("dbMain",h,s);}
function line(id,h,series,unit,opt){opt=opt||{};const[lo,hi]=ext(series.map(x=>x.v));const y=yScale(opt.zero?Math.min(0,lo):lo,opt.zero?Math.max(0,hi):hi,h);let s=frame(h,y,null,unit);
 if(opt.zero)s+='<line x1="'+ML+'" x2="'+(W-MR)+'" y1="'+y.y(0)+'" y2="'+y.y(0)+'" class="db-zero"/>';
 series.forEach(x=>{if(x.bars){const[a,b]=st.w;let last=-2;for(let i=a;i<=b;i++){const k=dayOf(i);if(k===last||!isN(x.v[i]))continue;last=k;let j=i;while(j<b&&dayOf(j+1)===k)j++;const X0=xs(i),X1=xs(j+1>b?b:j+1);s+='<rect x="'+X0+'" width="'+Math.max(1,X1-X0-1)+'" y="'+y.y(x.v[i])+'" height="'+Math.max(0,y.y(0)-y.y(x.v[i]))+'" fill="'+x.c+'" opacity=".8"/>';}}
  else s+='<path d="'+path(x.v,y.y)+'" fill="none" stroke="'+x.c+'" stroke-width="'+(x.w||1.6)+'"'+(x.dash?' stroke-dasharray="'+x.dash+'"':"")+'/>';});
 panel(id,h,s);}
function resHourly(){const R=D.res&&D.res[A.res];if(!R)return null;const yr=+D.res.year;const cur=[],med=[];for(let i=0;i<D.n;i++){const d=new Date(tms(i)+6*36e5),w=isoWeek(d);cur.push(d.getUTCFullYear()===yr&&isN(R.cur[w-1])?R.cur[w-1]:null);med.push(isN(R.med[w-1])?R.med[w-1]:null);}return{cur,med};}
function isoWeek(d){const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7);}
function fuelHourly(k){const F=D.fuel&&D.fuel[k];if(!F)return null;const m={};F.d.forEach((d,j)=>m[d]=F.v[j]);let last=null;return HD.map(q=>{const d=D.days[q];if(d&&isN(m[d]))last=m[d];return q>=0&&d<=(F.d[F.d.length-1]||"")?last:null;});}
let RV,FU;
function drawAll(){const box=$("dbCharts");if(!box||!box.offsetParent)return;W=Math.max(300,Math.min(box.clientWidth,1400));CH=[];build();RV=resHourly();FU={ttf:fuelHourly("ttf_da"),eua:fuelHourly("eua")};
 drawMain();const g2=W<500?120:140;
 const wa=A.g.wind?A.g.wind.map(v=>isN(v)?v/1e3:null):null;line("dbWind",g2,[wa&&{v:wa,c:COL.wind,w:1.8},A.wf&&{v:A.wf.map(v=>isN(v)?v/1e3:null),c:"#ef476f",dash:"4 3"}].filter(Boolean),"GW");
 line("dbLoad",g2,[{v:(A.l||[]).map(v=>isN(v)?v/1e3:null),c:"#e9c46a",w:1.8}],"GW");
 line("dbNet",g2,[{v:A.ni.map(v=>isN(v)?v/1e3:null),c:"#90be6d",w:1.6}],"GW",{zero:1});
 line("dbTemp",g2,[{v:hourlyFromDaily(A.td),c:"#f4845f",w:2}],"°C");
 if(A.rr.length)line("dbRain",g2,[{v:hourlyFromDaily(A.rd),c:"#5bc0eb",bars:1}],"mm/day",{zero:1});else $("dbRain").innerHTML='<p class="pw-mut">No hydro-region rainfall series for this area (rain grid covers Norway and northern Sweden catchments).</p>';
 if(RV)line("dbRes",g2,[{v:RV.cur,c:"#3a86ff",w:2},{v:RV.med,c:"var(--muted)",dash:"4 3"}],"% full");else $("dbRes").innerHTML='<p class="pw-mut">Reservoir statistics are published for Norway and Sweden only.</p>';
 if(FU.ttf||FU.eua)dualFuel(g2);
 bind();keys();if(st.day!=null)card(st.day);scatter();$("dbAreaName").textContent=A.name+(A.zs.length>1?" ("+A.zs.join(", ")+")":"");}
function dualFuel(h){const[l1,h1]=ext([FU.ttf]),[l2,h2]=ext([FU.eua]),yl=yScale(l1,h1,h),yr=yScale(l2,h2,h);let s=frame(h,yl,yr,"EUR/MWh","EUR/t");if(FU.ttf)s+='<path d="'+path(FU.ttf,yl.y)+'" fill="none" stroke="#f77f00" stroke-width="1.8"/>';if(FU.eua)s+='<path d="'+path(FU.eua,yr.y)+'" fill="none" stroke="#adb5bd" stroke-width="1.8" stroke-dasharray="5 3"/>';panel("dbFuel",h,s);}
function keys(){const ks=Object.keys(A.g);$("dbKeys").innerHTML=ks.map(k=>'<button type="button" class="db-key'+(st.hid[k]?" off":"")+'" data-k="'+k+'"><i style="background:'+COL[k]+'"></i>'+NAMES[k]+'</button>').join("")+'<button type="button" class="db-key'+(st.hid.price?" off":"")+'" data-k="price"><i class="ln" style="background:#fff"></i>Day-ahead price'+(A.zs.length>1?" (load-weighted)":"")+'</button>'+(A.spr?'<button type="button" class="db-key'+(st.hid.spread?" off":"")+'" data-k="spread"><i class="ln" style="background:#ff006e"></i>Spread vs '+esc(st.cmp)+'</button>':"");
 $("dbKeys").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{st.hid[b.dataset.k]=!st.hid[b.dataset.k];drawAll();});}
/* ---------- interactions ---------- */
function tipAt(i){const t=new Date(tms(i)),f=(v,d)=>isN(v)?v.toLocaleString("en-GB",{maximumFractionDigits:d==null?0:d}):"–";let h='<b>'+fmtH.format(t)+'</b> <span class="src">CET/CEST · '+esc(A.name)+'</span>';
 Object.keys(A.g).forEach(k=>{if(!st.hid[k])h+='<br><i class="db-dot" style="background:'+COL[k]+'"></i>'+NAMES[k]+' <b>'+f(A.g[k][i])+'</b> MW';});
 h+='<br>Total generation <b>'+f(A.tot[i])+'</b> MW<br>Day-ahead price <b>'+f(A.p[i],1)+'</b> EUR/MWh';if(A.spr)h+='<br>Spread vs '+esc(st.cmp)+' <b>'+f(A.spr[i],1)+'</b> EUR/MWh';
 if(A.wf)h+='<br>Wind forecast (day-ahead) <b>'+f(A.wf[i])+'</b> MW';h+='<br>Demand <b>'+f(A.l&&A.l[i])+'</b> MW<br>Net imports <b>'+f(A.ni[i])+'</b> MW';
 const k=dayOf(i);if(k>=0){h+='<br>Temperature (daily mean) <b>'+f(A.td[k],1)+'</b> °C';if(A.rr.length)h+='<br>Rain (daily) <b>'+f(A.rd[k],1)+'</b> mm';}
 if(RV&&isN(RV.cur[i]))h+='<br>Reservoirs <b>'+f(RV.cur[i],1)+'</b> % (median '+f(RV.med[i],1)+' %)';if(FU.ttf&&isN(FU.ttf[i]))h+='<br>TTF gas day-ahead <b>'+f(FU.ttf[i],2)+'</b> EUR/MWh';if(FU.eua&&isN(FU.eua[i]))h+='<br>EUA carbon <b>'+f(FU.eua[i],2)+'</b> EUR/t';return h;}
function cross(i){CH.forEach(el=>{const l=el.querySelector(".db-x");if(l){const X=i==null?-9:xs(i);l.setAttribute("x1",X);l.setAttribute("x2",X);}});}
function bind(){const PC=window.PWChart;let drag=null;
 CH.forEach(el=>{const svg=el.querySelector("svg"),hit=el.querySelector(".db-hit"),br=el.querySelector(".db-brush");const px=e=>{const r=svg.getBoundingClientRect();return(e.clientX-r.left)*W/r.width;};
  hit.addEventListener("pointermove",e=>{const i=ix(px(e));cross(i);PC.showTip(tipAt(i),e);if(drag&&drag.el===el){const x0=Math.min(drag.x,px(e)),x1=Math.max(drag.x,px(e));br.setAttribute("x",x0);br.setAttribute("width",x1-x0);}});
  hit.addEventListener("pointerleave",()=>{cross(null);PC.hideTip();});
  hit.addEventListener("pointerdown",e=>{drag={el,x:px(e)};if(e.pointerType!=="touch")hit.setPointerCapture(e.pointerId);});
  hit.addEventListener("pointerup",e=>{if(!drag)return;const x1=px(e),d=drag;drag=null;br.setAttribute("width",0);
   if(Math.abs(x1-d.x)>8){const a=ix(Math.min(d.x,x1)),b=ix(Math.max(d.x,x1));if(b-a>=6){st.w=[a,b];drawAll();}}else{const k=dayOf(ix(x1));if(k>=0){st.day=k;card(k);if(e.pointerType==="touch")PC.showTip(tipAt(ix(x1)),e);}}});});}
function card(k){const el=$("dbCard"),hs=[];for(let i=0;i<D.n;i++)if(HD[i]===k)hs.push(i);const f=(v,d)=>isN(v)?v.toLocaleString("en-GB",{maximumFractionDigits:d==null?0:d}):"–";
 const day=D.days[k],gw={};Object.keys(A.g).forEach(t=>{const v=hs.map(i=>A.g[t][i]).filter(isN);gw[t]=v.length===hs.length&&v.length?v.reduce((a,b)=>a+b,0)/1e3:null;});
 const tot=Object.values(gw).filter(isN).reduce((a,b)=>a+b,0),ps=hs.map(i=>A.p[i]).filter(isN);
 const prev={};Object.keys(A.g).forEach(t=>{const v=[];for(let i=0;i<D.n;i++)if(HD[i]===k-1&&isN(A.g[t][i]))v.push(A.g[t][i]);prev[t]=v.length>=23?v.reduce((a,b)=>a+b,0)/1e3:null;});
 let big=null;Object.keys(gw).forEach(t=>{if(isN(gw[t])&&isN(prev[t])){const d=gw[t]-prev[t];if(!big||Math.abs(d)>Math.abs(big[1]))big=[t,d];}});
 let jump=null;for(let q=1;q<hs.length;q++){const a=A.p[hs[q-1]],b=A.p[hs[q]];if(isN(a)&&isN(b)&&(!jump||Math.abs(b-a)>Math.abs(jump[1])))jump=[hs[q],b-a];}
 const d0=Date.parse(day+"T00:00:00+02:00"),d1=d0+864e5,cc=A.ctry;const outs=(D.nuc_units||[]).filter(u=>cc.includes(u.c)&&Date.parse(u.start)<d1&&(!u.end||Date.parse(u.end)>d0));
 let h='<div class="db-card-h"><b>'+fmtD.format(new Date(d0+12*36e5))+' '+day.slice(0,4)+' · '+esc(A.name)+'</b><button type="button" class="db-x-btn" id="dbCardX" aria-label="Close">×</button></div>';
 h+='<div class="db-card-g"><div><div class="pw-mini-h">Generation mix <em>GWh in the day</em></div>'+(tot?Object.keys(gw).filter(t=>isN(gw[t])).map(t=>'<div class="db-mix"><i style="background:'+COL[t]+'"></i>'+NAMES[t]+'<b>'+f(gw[t])+'</b><span>'+Math.round(gw[t]/tot*100)+'%</span></div>').join("")+'<div class="db-mix tot">Total<b>'+f(tot)+'</b></div>':'<p class="pw-mut">Generation not complete for this day yet.</p>')+'</div>';
 h+='<div><div class="pw-mini-h">Day-ahead price <em>EUR/MWh</em></div>'+(ps.length?'<div class="db-mix">Average<b>'+f(ps.reduce((a,b)=>a+b,0)/ps.length,1)+'</b></div><div class="db-mix">Min<b>'+f(Math.min(...ps),1)+'</b></div><div class="db-mix">Max<b>'+f(Math.max(...ps),1)+'</b></div>':'<p class="pw-mut">No prices.</p>')+
  (jump?'<div class="db-mix">Biggest hour-to-hour move<b>'+(jump[1]>0?"+":"")+f(jump[1],1)+'</b><span>'+fmtH.format(new Date(tms(jump[0]))).slice(-5)+'</span></div>':"")+
  (big?'<div class="db-mix">Biggest change vs day before<b>'+NAMES[big[0]]+' '+(big[1]>0?"+":"")+f(big[1])+' GWh</b></div>':"")+'</div>';
 h+='<div><div class="pw-mini-h">Nuclear unavailability <em>published UMMs, MW</em></div>'+(outs.length?outs.map(u=>'<div class="db-mix">'+esc(u.n)+'<b>'+f(u.now)+' / '+f(u.cap)+'</b><span>'+esc(u.why||"")+'</span></div>').join(""):'<p class="pw-mut">None in the currently published messages for '+esc(cc.join(", "))+' (only messages still active are kept).</p>')+'</div></div>';
 el.innerHTML=h;el.hidden=false;$("dbCardX").onclick=()=>{st.day=null;el.hidden=true;};}
function scatter(){const el=$("dbScat");if(!A.g.wind){el.innerHTML='<p class="pw-mut">No wind generation in this area.</p>';return;}const pts=[];D.days.forEach((d,k)=>{const w=[],p=[];for(let i=0;i<D.n;i++)if(HD[i]===k){if(isN(A.g.wind[i]))w.push(A.g.wind[i]);if(isN(A.p[i]))p.push(A.p[i]);}if(w.length>=23&&p.length>=23)pts.push([d,w.reduce((a,b)=>a+b,0)/w.length/1e3,p.reduce((a,b)=>a+b,0)/p.length]);});
 const w2=Math.min(W,520),h=220,L=44,R=10,T=10,B=30;if(!pts.length){el.innerHTML="";return;}const xm=Math.max(...pts.map(p=>p[1]))*1.08,pl=Math.min(0,...pts.map(p=>p[2])),ph=Math.max(...pts.map(p=>p[2]))*1.08;
 const X=v=>L+v/xm*(w2-L-R),Y=v=>T+(ph-v)/(ph-pl)*(h-T-B);let s='<svg width="'+w2+'" height="'+h+'" class="db-svg">';
 ticks(pl,ph,4).forEach(v=>s+='<line x1="'+L+'" x2="'+(w2-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" class="db-grid"/><text x="'+(L-4)+'" y="'+(Y(v)+3)+'" class="db-ax" text-anchor="end">'+v+'</text>');
 ticks(0,xm,4).forEach(v=>s+='<text x="'+X(v)+'" y="'+(h-16)+'" class="db-ax" text-anchor="middle">'+v+'</text>');
 s+='<text x="'+((w2+L)/2)+'" y="'+(h-3)+'" class="db-ax" text-anchor="middle">Average wind output, GW</text><text x="4" y="'+(T+2)+'" class="db-ax db-u">EUR/MWh</text>';
 pts.forEach(p=>s+='<circle cx="'+X(p[1])+'" cy="'+Y(p[2])+'" r="4.5" class="db-pt" data-t="'+p[0]+'|'+p[1].toFixed(2)+'|'+p[2].toFixed(1)+'"/>');el.innerHTML=s+'</svg>';
 el.querySelectorAll("[data-t]").forEach(c=>{const[d,w,p]=c.dataset.t.split("|"),f=e=>window.PWChart.showTip('<b>'+d+'</b><br>Average wind <b>'+w+'</b> GW<br>Average day-ahead price <b>'+p+'</b> EUR/MWh',e);c.addEventListener("mousemove",f);c.addEventListener("click",f);c.addEventListener("mouseleave",window.PWChart.hideTip);});}
function csv(){const[a,b]=st.w,ks=Object.keys(A.g);let s="time_utc,"+ks.map(k=>k+"_MW").join(",")+",total_generation_MW,demand_MW,net_imports_MW,day_ahead_EUR_MWh,wind_forecast_MW"+(A.spr?",spread_vs_"+st.cmp+"_EUR_MWh":"")+"\n";
 for(let i=a;i<=b;i++){const r=[new Date(tms(i)).toISOString().slice(0,16)+"Z",...ks.map(k=>A.g[k][i]),A.tot[i],A.l&&A.l[i],A.ni[i],A.p[i],A.wf&&A.wf[i]];if(A.spr)r.push(A.spr[i]);s+=r.map(v=>v==null?"":v).join(",")+"\n";}
 const u=URL.createObjectURL(new Blob([s],{type:"text/csv"})),l=document.createElement("a");l.href=u;l.download="nordic_power_"+st.a+"_"+D.days[0]+"_hourly.csv";document.body.append(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
/* ---------- shell ---------- */
function head(t,u,sub){return'<div class="pw-mini-h">'+t+' <em>'+u+'</em>'+(sub?' <span class="pw-mut">'+sub+'</span>':"")+'</div>';}
function shell(){const body=$("pwDashBody");const z=D.zones;
 if(window.MMUI&&$("pwDotDash"))$("pwDotDash").innerHTML=MMUI.dot(D.generated_utc,"power","Nordic power dashboard (ENTSO-E, Open-Meteo)",null,(D.gaps||[]).join("; "));
 const ds=D.days[0],de=D.days[D.days.length-1];
 body.innerHTML='<div class="nm-chips db-areas" role="group" aria-label="Area">'+AREAS.map(a=>'<button type="button" class="chip'+(a[0]===st.a?" is-on":"")+'" data-a="'+a[0]+'">'+a[1]+'</button>').join("")+'</div>'+
 '<div class="db-tools"><label>Spread vs <select id="dbCmp"><option value="">off</option>'+Object.keys(z).map(k=>'<option'+(k===st.cmp?" selected":"")+'>'+k+'</option>').join("")+'</select></label><button type="button" class="button" id="dbReset">Reset zoom</button><button type="button" class="button" id="dbCsv">Download CSV</button><button type="button" class="button" id="dbPrint">'+(document.body.classList.contains("dash-print")?"Exit slide view":"Slide / print view")+'</button>'+(document.body.classList.contains("dash-print")?'<button type="button" class="button is-on" id="dbPrintGo">Print / save as PDF</button>':"")+'<span class="pw-mut">Drag across any chart to zoom · tap or click a day for its breakdown</span></div>'+
 '<div class="pw-card db-card-main"><h3 class="panel-title">Generation by type and day-ahead price: <span id="dbAreaName"></span>, last 30 days, hourly</h3><p class="pw-mut">'+ds+' to '+de+' (prices include tomorrow once published) · hours in CET/CEST · GW (left) and EUR/MWh (right) · <a href="https://transparency.entsoe.eu/" target="_blank" rel="noopener">ENTSO-E Transparency</a> A75 actual generation per type, A44 day-ahead prices</p><div class="db-keys" id="dbKeys"></div><div id="dbCharts">'+
 '<div id="dbMain" class="db-p"></div>'+
 head("Wind: actual vs day-ahead forecast","GW","solid actual, dashed forecast (ENTSO-E A75, A69)")+'<div id="dbWind" class="db-p"></div>'+
 head("Demand (actual total load)","GW","ENTSO-E A65")+'<div id="dbLoad" class="db-p"></div>'+
 head("Net imports","GW","above zero = importing; derived as load minus generation, so includes losses and data gaps")+'<div id="dbNet" class="db-p"></div>'+
 head("Temperature, daily mean of main load centres","°C",'<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0): Oslo, Bergen, Trondheim · Stockholm, Gothenburg, Malmö · Helsinki, Tampere, Oulu · Copenhagen, Aarhus')+'<div id="dbTemp" class="db-p"></div>'+
 head("Rain and snow, hydro catchments","mm per day",'Open-Meteo, mean of grid points per region (Norway south/central/north, northern Sweden)')+'<div id="dbRain" class="db-p"></div>'+
 head("Hydro reservoirs vs normal","% full, weekly",'solid this year, dashed median '+esc((D.res||{}).hist||"")+' · <a href="https://www.nve.no/energi/analyser-og-statistikk/magasinstatistikk/" target="_blank" rel="noopener">NVE</a> (Norway), ENTSO-E A72 (Sweden)')+'<div id="dbRes" class="db-p"></div>'+
 head("Gas and carbon","EUR/MWh (left) · EUR/t (right)","solid TTF gas day-ahead, dashed EUA Dec-26; daily settlements")+'<div id="dbFuel" class="db-p"></div>'+
 '</div></div><div class="pw-card db-card" id="dbCard" hidden></div>'+
 '<div class="pw-card"><h3 class="panel-title">Daily day-ahead price vs wind output: <span id="dbScN"></span>, last 30 days</h3><p class="pw-mut">One dot per full day · EUR/MWh vs GW · ENTSO-E A44, A75</p><div id="dbScat"></div></div>'+
 '<p class="pw-foot">Countries and Nordic are summed from bidding zones; their price is the hourly load-weighted average of zone prices. Nuclear schedule vs plan is not shown: ENTSO-E publishes no hourly nuclear generation plan. Day breakdown outages list nuclear unavailability messages that are still active, so older, finished outages are not included.</p>';
 body.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{st.a=b.dataset.a;st.day=null;$("dbCard").hidden=true;body.querySelectorAll("[data-a]").forEach(x=>x.classList.toggle("is-on",x===b));drawAll();$("dbScN").textContent=A.name;});
 $("dbCmp").onchange=e=>{st.cmp=e.target.value;drawAll();};$("dbReset").onclick=()=>{st.w=[0,D.n-1];drawAll();};$("dbCsv").onclick=csv;
 $("dbPrint").onclick=()=>{document.body.classList.toggle("dash-print");shell();scrollTo({top:0});};if($("dbPrintGo"))$("dbPrintGo").onclick=()=>print();
 if(!st.w)st.w=[0,D.n-1];drawAll();$("dbScN").textContent=A.name;}
function render(){const sec=$("pwSecDash"),body=$("pwDashBody");if(!sec||!body||!body.offsetParent)return;if(D){if(!body.querySelector("#dbCharts"))shell();else drawAll();return;}
 body.innerHTML='<p class="pw-mut">Loading 30 days of hourly data…</p>';load().then(shell).catch(e=>{body.innerHTML='<p class="pw-mut">Dashboard data not available ('+esc(e.message)+').</p>';});}
let rt;addEventListener("resize",()=>{if(!D||!$("dbCharts")||!$("dbCharts").offsetParent)return;clearTimeout(rt);rt=setTimeout(drawAll,200);});
addEventListener("mm:expand",()=>setTimeout(render,80));
window.MMDash={render};
})();
