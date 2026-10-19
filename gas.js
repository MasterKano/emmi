/* Gas storage tab (#gas): EU and member-state gas storage from GIE AGSI+ (built daily by scripts/build_gas.py).
   data/gas.json is a small index (latest figures per country in areas[c].s); each country's daily history is
   data/gas/<CODE>.json, fetched when its chart is opened (all of them only when a past day is clicked). Seasonal chart (this year vs earlier years and the 5-year range), click a country to switch,
   click a day on the chart to see every country on that day. Self-contained: own chart, uses the shared .pw-* styles. */
(()=>{"use strict";
const LS="markets-monitor:gas:v1",TZ="Europe/Zurich";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const NA='<span class="na">n/a</span>';
const st=Object.assign({area:"EU",metric:"fill",axis:"cal",on:["y0","y1","band","avg","tgt"],sort:"wgv",dir:-1},(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}");}catch(e){return{};}})());
const save=()=>{try{localStorage.setItem(LS,JSON.stringify({area:st.area,metric:st.metric,axis:st.axis,on:st.on,sort:st.sort,dir:st.dir}));}catch(e){}};
let G=null,loading=null,tried=false,shown=false,pick=null;/* pick = ISO date chosen by clicking the chart (not saved) */
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fdd=d=>{const x=new Date(d+"T12:00:00Z");return x.getUTCDate()+" "+MON[x.getUTCMonth()]+" "+x.getUTCFullYear();};
const fds=d=>{const x=new Date(d+"T12:00:00Z");return x.getUTCDate()+" "+MON[x.getUTCMonth()];};
const f=(v,d)=>isNum(v)?v.toLocaleString("en-GB",{minimumFractionDigits:d,maximumFractionDigits:d}):"–";
const sg=(v,d,u)=>{if(!isNum(v))return"–";const r=+v.toFixed(d);return(r>0?"+":r<0?"−":"±")+f(Math.abs(r),d)+(u||"");};
const cls=v=>isNum(v)?(v>0.05?"up":v<-0.05?"dn":""):"";
/* ---------- dates on a 366-day grid (index 59 = 29 Feb; non-leap years skip it), same as build_gas.py ---------- */
const leap=y=>y%4===0&&(y%100!==0||y%400===0);
function idx(iso){const y=+iso.slice(0,4),d=new Date(iso+"T00:00:00Z"),i=Math.round((d-Date.UTC(y,0,1))/864e5);return !leap(y)&&i>=59?i+1:i;}
function dateAt(y,i){if(!leap(y)){if(i===59)return null;if(i>59)i--;}const d=new Date(Date.UTC(y,0,1)+i*864e5);return d.toISOString().slice(0,10);}
const OCT1=274;/* index of 1 Oct on the grid */
function val(A,k,iso){if(!iso)return null;const a=A[k]&&A[k][iso.slice(0,4)];if(!a)return null;const v=a[idx(iso)];return isNum(v)?v:null;}
const shift=(iso,days)=>new Date(Date.parse(iso+"T00:00:00Z")+days*864e5).toISOString().slice(0,10);
/* x-axis "slots": calendar year (Jan-Dec) or gas year (1 Oct - 30 Sep); slot i of year label -> (calendar year, grid index) */
function slot(axis,yr,i){if(axis==="cal")return[yr,i];return i<366-OCT1?[yr,OCT1+i]:[yr+1,i-(366-OCT1)];}
function seriesOf(A,k,axis,yr){const out=new Array(366).fill(null);for(let i=0;i<366;i++){const[y,j]=slot(axis,yr,i);const a=A[k]&&A[k][y];out[i]=a&&isNum(a[j])?a[j]:null;}
 /* bridge the empty 29 Feb slot of non-leap years so lines stay continuous */
 for(let i=1;i<365;i++)if(out[i]==null&&isNum(out[i-1])&&isNum(out[i+1])){const[y,j]=slot(axis,yr,i);if(j===59)out[i]=(out[i-1]+out[i+1])/2;}return out;}
const ylab=(axis,yr)=>axis==="cal"?String(yr):yr+"/"+String(yr+1).slice(2);
function curYear(axis){const L=G.areas.EU?G.areas.EU.last:G.gas_day;const y=+L.slice(0,4);return axis==="cal"?y:(idx(L)>=OCT1?y:y-1);}
function band(A,k,axis,y0){const yrs=[];for(let k2=1;k2<=5;k2++)yrs.push(y0-k2);const S=yrs.map(y=>seriesOf(A,k,axis,y));const have=yrs.filter((y,j)=>S[j].some(isNum));
 const out=[];for(let i=0;i<366;i++){const v=S.map(s=>s[i]).filter(isNum);out.push(v.length>=3?[Math.min(...v),v.reduce((a,b)=>a+b,0)/v.length,Math.max(...v)]:null);}
 return{rows:out,label:have.length?ylab(axis,Math.min(...have))+"–"+ylab(axis,Math.max(...have)).replace(/^\d\d(\d\d)$/,"$1"):"",n:have.length,years:have};}
function bandAt(A,iso){const y=+iso.slice(0,4),i=idx(iso);const v=[];for(let k=1;k<=5;k++){const a=A.fill[y-k];if(a&&isNum(a[i]))v.push(a[i]);else if(i===59){const b=a&&a[58],c=a&&a[60];if(isNum(b)&&isNum(c))v.push((b+c)/2);}}
 return v.length>=3?{min:Math.min(...v),avg:v.reduce((a,b)=>a+b,0)/v.length,max:Math.max(...v),n:v.length}:null;}
/* ---------- per-area figures on one date ---------- */
function stats(code,iso){const A=G.areas[code];if(!A)return null;const d=iso&&iso<=A.last?iso:A.last;
 const base={code,name:A.name,eu:A.eu,d,wgv:A.wgv,status:d===A.last&&A.latest_meta?A.latest_meta.status:null};
 if(!A.fill)return d===A.last&&A.s?Object.assign(base,A.s):Object.assign(base,{pending:true});/* history not loaded yet */
 const fill=val(A,"fill",d);
 const b=bandAt(A,d),ly=val(A,"fill",shift(d,-365-(leap(+d.slice(0,4))&&idx(d)>59?1:0)));
 const lyIso=(+d.slice(0,4)-1)+d.slice(4);const lyv=d.slice(5)==="02-29"?null:val(A,"fill",lyIso);
 return{code,name:A.name,eu:A.eu,d,fill,twh:val(A,"twh",d),inj:val(A,"inj",d),wd:val(A,"wd",d),net:val(A,"net",d),wgv:A.wgv,
  d1:isNum(fill)&&isNum(val(A,"fill",shift(d,-1)))?fill-val(A,"fill",shift(d,-1)):null,
  d7:isNum(fill)&&isNum(val(A,"fill",shift(d,-7)))?fill-val(A,"fill",shift(d,-7)):null,
  d30:isNum(fill)&&isNum(val(A,"fill",shift(d,-30)))?fill-val(A,"fill",shift(d,-30)):null,
  ly:isNum(lyv)?lyv:ly,vsLy:isNum(fill)&&isNum(isNum(lyv)?lyv:ly)?fill-(isNum(lyv)?lyv:ly):null,
  avg:b&&b.avg,min:b&&b.min,max:b&&b.max,vsAvg:isNum(fill)&&b?fill-b.avg:null,status:d===A.last&&A.latest_meta?A.latest_meta.status:null};}
/* ---------- tooltip ---------- */
let tip;function showTip(html,e){if(!tip){tip=document.createElement("div");tip.className="pw-tip";document.body.append(tip);}tip.innerHTML=html;tip.hidden=false;const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=Math.max(6,x)+"px";tip.style.top=Math.max(6,y)+"px";}
function hideTip(){if(tip)tip.hidden=true;}
function nice(lo,hi,n){if(lo===hi){lo-=1;hi+=1;}const span=hi-lo,s0=span/n,m=Math.pow(10,Math.floor(Math.log10(s0))),q=s0/m,step=(q<1.5?1:q<3?2:q<7?5:10)*m;const a=Math.floor(lo/step)*step,b=Math.ceil(hi/step)*step;const t=[];for(let v=a;v<=b+step/2;v+=step)t.push(Math.round(v/step)*step);return[a,b,t];}
const PAL=["var(--accent)","var(--muted)","#e0a030","#b07cff","#3fbf9f","#ff7b7b"];
const METRIC={fill:{l:"% full",u:"%",k:"fill",d:1},twh:{l:"TWh stored",u:"TWh",k:"twh",d:1},flow:{l:"Daily flow",u:"GWh/d",k:"net",d:0}};
/* ---------- chart ---------- */
function chart(el,o){const W=Math.max(290,el.clientWidth||700),H=W<520?250:320,m={l:W<520?36:44,r:10,t:22,b:26},n=366;
 const X=i=>m.l+i/(n-1)*(W-m.l-m.r);let lo,hi,ticks;
 if(o.yr){[lo,hi]=o.yr;ticks=nice(lo,hi,5)[2].filter(t=>t>=lo&&t<=hi);}else{let v=[];o.ser.forEach(s=>s.on&&s.vals.forEach(x=>isNum(x)&&v.push(x)));if(o.band)o.band.forEach(b=>b&&v.push(b[0],b[2]));if(o.zero)v.push(0);if(o.tline)v.push(o.tline);if(!v.length)v=[0,1];[lo,hi,ticks]=nice(Math.min(...v),Math.max(...v),W<520?4:5);}
 const Y=v=>m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b);
 let s='<svg class="pw-svg gs-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+esc(o.label)+'">';
 /* target window (1 Oct - 1 Dec) */
 if(o.tgt){const a=X(o.tgt[0]),b=X(o.tgt[1]);s+='<rect class="gs-tw" x="'+a.toFixed(1)+'" y="'+m.t+'" width="'+Math.max(2,b-a).toFixed(1)+'" height="'+(H-m.t-m.b)+'"/>';}
 ticks.forEach(t=>{s+='<line class="g" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(t).toFixed(1)+'" y2="'+Y(t).toFixed(1)+'"/><text class="yt" x="'+(m.l-5)+'" y="'+(Y(t)+3.5).toFixed(1)+'">'+f(t,0)+'</text>';});
 s+='<text class="yu" x="2" y="12">'+esc(o.unit)+'</text>';
 if(o.zero&&lo<0&&hi>0)s+='<line class="z" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'"/>';
 /* month ticks */
 for(let i=0;i<n;i++){const[yy,j]=slot(o.axis,2024,i);const d=dateAt(yy,j);if(d&&d.slice(8)==="01"){const mo=+d.slice(5,7)-1;s+='<line class="vg" x1="'+X(i).toFixed(1)+'" x2="'+X(i).toFixed(1)+'" y1="'+(H-m.b)+'" y2="'+(H-m.b+4)+'"/>';if(W>=520||mo%2===0)s+='<text class="xt" x="'+(X(i)+(W<520?8:14)).toFixed(1)+'" y="'+(H-m.b+14)+'">'+MON[mo]+'</text>';}}
 if(o.band){const B=o.band.map((b,i)=>b?[i,b]:null).filter(Boolean);if(B.length){if(o.bandOn){const up=B.map(([i,b])=>X(i).toFixed(1)+" "+Y(b[2]).toFixed(1)),dn=B.slice().reverse().map(([i,b])=>X(i).toFixed(1)+" "+Y(b[0]).toFixed(1));s+='<path class="band" d="M'+up.join("L")+"L"+dn.join("L")+'Z"/>';}
  if(o.avgOn)s+='<path class="ln gs-avg" d="M'+B.map(([i,b])=>X(i).toFixed(1)+" "+Y(b[1]).toFixed(1)).join("L")+'"/>';}}
 if(o.tgt&&o.tline!=null){const a=X(o.tgt[0]),b=X(o.tgt[1]);s+='<line class="gs-tl" x1="'+a.toFixed(1)+'" x2="'+b.toFixed(1)+'" y1="'+Y(o.tline).toFixed(1)+'" y2="'+Y(o.tline).toFixed(1)+'"/>';
  if(o.tline2!=null)s+='<line class="gs-tl2" x1="'+a.toFixed(1)+'" x2="'+b.toFixed(1)+'" y1="'+Y(o.tline2).toFixed(1)+'" y2="'+Y(o.tline2).toFixed(1)+'"/>';
  s+='<text class="gs-tt" x="'+((a+b)/2).toFixed(1)+'" y="'+(Y(o.tline)-5).toFixed(1)+'">'+esc(o.tlab)+'</text>';}
 o.ser.slice().reverse().forEach(se=>{if(!se.on)return;
  if(se.bars){const bw=Math.max(1,(W-m.l-m.r)/n-.3);for(let i=0;i<n;i++){const v=se.vals[i];if(!isNum(v))continue;const y0=Y(0),y1=Y(v);s+='<rect class="gs-bar '+(v>=0?"in":"out")+'" x="'+(X(i)-bw/2).toFixed(1)+'" y="'+Math.min(y0,y1).toFixed(1)+'" width="'+bw.toFixed(2)+'" height="'+Math.max(.6,Math.abs(y1-y0)).toFixed(1)+'"/>';}return;}
  let d="",pen=false;for(let i=0;i<n;i++){const v=se.vals[i];if(!isNum(v)){pen=false;continue;}d+=(pen?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1);pen=true;}
  s+='<path class="ln" d="'+d+'" style="stroke:'+se.color+';stroke-width:'+(se.w||1.5)+(se.dash?';stroke-dasharray:'+se.dash:"")+(se.op?';opacity:'+se.op:"")+'"/>';
  if(se.end){let li=-1;for(let i=n-1;i>=0;i--)if(isNum(se.vals[i])){li=i;break;}if(li>=0)s+='<circle cx="'+X(li).toFixed(1)+'" cy="'+Y(se.vals[li]).toFixed(1)+'" r="3.6" style="fill:'+se.color+'"/>';}});
 if(o.pin!=null)s+='<line class="gs-pin" x1="'+X(o.pin).toFixed(1)+'" x2="'+X(o.pin).toFixed(1)+'" y1="'+m.t+'" y2="'+(H-m.b)+'"/>';
 s+='<line class="hair" x1="0" x2="0" y1="'+m.t+'" y2="'+(H-m.b)+'" visibility="hidden"/><rect class="hit gs-hit" x="'+m.l+'" y="'+m.t+'" width="'+(W-m.l-m.r)+'" height="'+(H-m.t-m.b)+'"/></svg>';
 el.innerHTML=s;const svg=el.querySelector("svg"),hair=svg.querySelector(".hair"),hit=svg.querySelector(".hit");
 const at=e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)*W/r.width;return Math.max(0,Math.min(n-1,Math.round((px-m.l)/(W-m.l-m.r)*(n-1))));};
 const move=e=>{const i=at(e);hair.setAttribute("x1",X(i));hair.setAttribute("x2",X(i));hair.setAttribute("visibility","visible");showTip(o.tip(i),e);};
 hit.addEventListener("pointermove",move);hit.addEventListener("pointerdown",move);hit.addEventListener("pointerleave",()=>{hair.setAttribute("visibility","hidden");hideTip();});
 hit.addEventListener("click",e=>o.click&&o.click(at(e)));}
/* ---------- page shell ---------- */
function dot(){if(!G||!window.MMUI)return"";const lag=(Date.now()-Date.parse(G.gas_day+"T00:00:00Z"))/864e5;return MMUI.dot(G.generated_utc,"gas","EU gas storage (GIE AGSI+)",lag>4.5?"stale":lag>3.2?"late":null,"latest gas day "+fdd(G.gas_day));}
function shell(){const v=$("gasView");if(!v||v.dataset.ready)return;v.dataset.ready="1";v.innerHTML=
 '<section class="pw-sec" id="gsSecOv" data-sec="gsOv"><h2 class="pw-h pw-h-top sec-h">European gas storage <span class="pw-sub">EU and member states · daily · GIE AGSI+</span><span class="sec-dot" id="gsDot"></span></h2>'+
 '<div class="gs-areas" id="gsAreas" role="group" aria-label="Country"></div>'+
 '<div class="pw-kpis gs-kpis" id="gsKpis"></div>'+
 '<section class="pw-card pw-full" id="gsChartCard"></section></section>'+
 '<section class="pw-sec" id="gsSecTbl" data-sec="gsTbl"><h2 class="pw-h sec-h">Countries <span class="pw-sub">fill level, change and vs normal · click a row to chart it · click a header to sort</span></h2>'+
 '<section class="pw-card pw-full" id="gsTbl"></section></section>'+
 '<details class="explain gs-explain" id="gsExplain"><summary><span class="explain-title">How to read gas storage</span><span class="explain-hint">Fill level · 5-year range · EU target · Data</span></summary><div class="explain-grid">'+
 '<div class="ex-item ex-price"><h3>Fill level</h3><p><b>% full</b> = gas in storage ÷ working gas capacity, per gas day (06:00–06:00 CET). Europe fills storage in summer (injection) and draws it down in winter (withdrawal), so the line rises roughly April–October and falls November–March. <b>Net flow</b> = injection minus withdrawal: positive = filling, negative = drawing down.</p></div>'+
 '<div class="ex-item ex-vol"><h3>Compared with what</h3><p>The shaded band is the lowest-to-highest level on the same date over the previous five years, the dashed line their average. <b>vs 5y avg</b> and <b>vs last year</b> are differences in percentage points (pp) of capacity on the same date. Switch to <b>Gas year</b> to see a full winter (1 Oct – 30 Sep) without the January break.</p></div>'+
 '<div class="ex-item ex-ma"><h3>EU target</h3><p id="gsTgtTxt"></p></div>'+
 '<div class="ex-item"><h3>Data</h3><p id="gsSrcTxt"></p></div></div></details>';
 window.MMUI&&MMUI.apply(v);}
function setNav(){if(window.MMUI)MMUI.subnav($("subNav"),[["gsSecOv","EU & country chart"],["gsSecTbl","Countries"],["gsExplain","How to read"]]);}
function render(){if(!shown)return;shell();const v=$("gasView");if(!G){const c=$("gsChartCard");if(c)c.innerHTML='<div class="pw-empty pw-loading">'+(!tried?"Loading gas storage data…":"Gas storage data pending: the first daily update has not been published yet.")+'</div>';return;}
 if(!G.areas[st.area])st.area="EU";$("gsDot").innerHTML=dot();renderAreas();renderKpis();renderChart();renderTable();renderExplain();window.MMUI&&MMUI.refresh();renderToday();}
function renderAreas(){const el=$("gsAreas");el.innerHTML=G.order.map(c=>{const A=G.areas[c];return'<button type="button" class="chip'+(c===st.area?" is-on":"")+(A.eu?"":" gs-noneu")+'" data-a="'+c+'" title="'+esc(A.name+(A.eu?"":" (not in the EU total)"))+'">'+esc(c==="EU"?"EU":A.name)+'</button>';}).join("");
 el.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>setArea(b.dataset.a));}
function setArea(c){st.area=c;save();renderAreas();renderKpis();renderChart();renderTable();renderToday();}
function kpi(l,b,s,c,t){return'<div class="pw-kpi'+(c==="up"?" pw-up":c==="dn"?" pw-dn":"")+'"'+(t?' title="'+esc(t)+'"':"")+'><span class="pw-kpi-l">'+l+'</span><b>'+b+'</b><span class="pw-kpi-s">'+s+'</span></div>';}
function renderKpis(){const S=stats(st.area,pick);const el=$("gsKpis");if(!S){el.innerHTML="";return;}const on=fdd(S.d)+(S.status==="E"?" · estimated":"");
 const fl=isNum(S.net)?(S.net>=0?"Net injection":"Net withdrawal"):"Net flow";
 el.innerHTML=kpi("Full · "+esc(S.name),f(S.fill,1)+'<small> %</small>',(pick?"on ":"gas day ")+esc(on))+
  kpi("In storage",f(S.twh,S.twh<20?2:1)+'<small> TWh</small>',"of "+f(S.wgv,S.wgv<20?2:1)+" TWh capacity"+(pick?" (today's)":""))+
  kpi(fl,isNum(S.net)?f(Math.abs(S.net),0)+'<small> GWh/d</small>':NA,isNum(S.inj)?"injection "+f(S.inj,0)+" · withdrawal "+f(S.wd,0)+" GWh/d":isNum(S.net)?"injection / withdrawal split: this year only":"daily flows kept for this year and last",isNum(S.net)?(S.net>=0?"up":"dn"):"")+
  kpi("vs 5-year average",sg(S.vsAvg,1)+'<small> pp</small>',isNum(S.avg)?"avg "+f(S.avg,1)+"% · range "+f(S.min,1)+"–"+f(S.max,1)+"%":"needs 3+ earlier years",cls(S.vsAvg))+
  kpi("vs same day last year",sg(S.vsLy,1)+'<small> pp</small>',isNum(S.ly)?"last year "+f(S.ly,1)+"%":"",cls(S.vsLy))+
  kpi("Last 7 days",sg(S.d7,1)+'<small> pp</small>',"30 days "+sg(S.d30,1)+" pp · 1 day "+sg(S.d1,2)+" pp",cls(S.d7));}
function on(k){return st.on.includes(k);}
function toggle(k){const i=st.on.indexOf(k);if(i>=0)st.on.splice(i,1);else st.on.push(k);save();renderChart();}
/* ---------- per-country history (lazy) ---------- */
let DL={};
function ensureArea(c){const A=G&&G.areas[c];if(!A)return Promise.resolve(null);if(A.fill)return Promise.resolve(A);if(DL[c])return DL[c];const g=G;
 DL[c]=fetch("data/gas/"+c+".json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();})
  .then(j=>{if(G!==g)return null;for(const k of["fill","twh","net","inj","wd"])if(j[k])A[k]=j[k];if(!A.fill)A.fill={};return A;})
  .catch(e=>{console.warn("gas history "+c,e);A._err=1;delete DL[c];return null;});return DL[c];}
function ensureAll(){return Promise.all(G.order.map(ensureArea));}
function renderChart(){const el=$("gsChartCard"),A=G.areas[st.area],M=METRIC[st.metric]||METRIC.fill,ax=st.axis,y0=curYear(ax);
 if(!A.fill){const err=A._err;el.innerHTML='<div class="pw-empty pw-loading">'+(err?"Could not load the history for "+esc(A.name)+". ":"Loading "+esc(A.name)+" history…")+'</div>';
  if(!err){const c=st.area;ensureArea(c).then(x=>{if(x&&shown&&st.area===c&&G.areas[c]===x)renderChart();else if(!x&&shown&&st.area===c)renderChart();});}else delete A._err;return;}
 const yrs=[0,1,2,3,4,5].map(k=>y0-k).filter(y=>seriesOf(A,M.k,ax,y).some(isNum));
 const ser=yrs.map((y,k)=>({key:"y"+(y0-y),name:ylab(ax,y),vals:seriesOf(A,M.k,ax,y),color:PAL[y0-y],w:y===y0?2.6:y0-y===1?1.7:1.3,dash:y0-y===1?"5 3":null,op:y0-y>1?.85:null,end:y===y0,bars:st.metric==="flow"&&y===y0}));
 ser.forEach(s=>s.on=s.key==="y0"||on(s.key));
 const B=band(A,M.k,ax,y0);const hasBand=B.n>=3;
 const tg=G.targets,eu=A.eu&&tg;const ti=eu?[idx("2024-"+tg.window[0]),idx("2024-"+tg.window[1])].map(j=>ax==="cal"?j:j-OCT1):null;
 const tline=eu&&st.metric!=="flow"?(st.metric==="fill"?tg.fill_pct:isNum(A.wgv)?A.wgv*tg.fill_pct/100:null):null;
 const tline2=tline!=null?(st.metric==="fill"?tg.fill_pct-tg.deviation_pp:A.wgv*(tg.fill_pct-tg.deviation_pp)/100):null;
 const pinI=pick?(()=>{const y=+pick.slice(0,4),j=idx(pick);if(ax==="cal")return y===y0||yrs.includes(y)?j:null;return j>=OCT1?j-OCT1:j+(366-OCT1);})():null;
 const keys=ser.map(s=>'<button type="button" class="gs-key'+(s.on?" is-on":"")+(s.key==="y0"?" fixed":"")+'" data-k="'+s.key+'"'+(s.key==="y0"?" disabled":"")+' style="--c:'+s.color+'"><i></i>'+esc(s.name)+'</button>').join("")+
  (hasBand?'<button type="button" class="gs-key gs-kb'+(on("band")?" is-on":"")+'" data-k="band"><i></i>Range '+esc(B.label)+'</button><button type="button" class="gs-key gs-ka'+(on("avg")?" is-on":"")+'" data-k="avg"><i></i>5-yr average</button>':"")+
  (tline!=null?'<button type="button" class="gs-key gs-kt'+(on("tgt")?" is-on":"")+'" data-k="tgt"><i></i>EU target</button>':"");
 const seg=(id,opts,cur)=>'<div class="seg pw-seg" id="'+id+'" role="group">'+opts.map(([k,l,t])=>'<button type="button" class="button'+(k===cur?" is-on":"")+'" data-k="'+k+'"'+(t?' title="'+esc(t)+'"':"")+'>'+l+'</button>').join("")+'</div>';
 const sub=(ax==="cal"?"Jan–Dec":"gas year 1 Oct – 30 Sep")+" · daily by gas day"+(hasBand?" · shaded = lowest–highest of the same date "+B.label:st.metric==="flow"?" · 5-year range for flows: EU total only":"")+" · source: <a href=\""+esc(G.source.url)+"\" target=\"_blank\" rel=\"noopener noreferrer\">GIE AGSI+</a>";
 el.innerHTML='<div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title">'+esc(A.name)+' gas storage, '+esc(ylab(ax,y0))+' vs earlier years<span class="pw-u"> · '+esc(M.u)+'</span></strong><span class="pw-card-sub">'+sub+'</span></div>'+
  '<div class="pw-tools"><label class="gs-sel"><span class="sr-only">Country</span><select id="gsAreaSel">'+G.order.map(c=>'<option value="'+c+'"'+(c===st.area?" selected":"")+'>'+esc(G.areas[c].name)+'</option>').join("")+'</select></label>'+
  seg("gsMetric",[["fill","% full","Share of storage capacity in use"],["twh","TWh","Energy stored, terawatt-hours"],["flow","Daily flow","Injection minus withdrawal, GWh per day"]],st.metric)+seg("gsAxis",[["cal","Jan–Dec"],["gas","Gas year","1 Oct – 30 Sep, shows a whole winter"]],ax)+'</div></div>'+
  '<div class="gs-keys" id="gsKeys">'+keys+'</div><div class="pw-chart gs-chart" id="gsChart"></div>'+
  '<p class="pw-foot gs-foot" id="gsFoot"></p>';
 const tipf=i=>{const rows=ser.filter(s=>s.on).map(s=>{const yy=+s.name.slice(0,4);const[cy,j]=slot(ax,yy,i);const d=dateAt(cy,j);return'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+(d?' <span class="src">'+esc(fds(d))+'</span>':"")+' <b>'+(isNum(s.vals[i])?(st.metric==="flow"?sg(s.vals[i],0):f(s.vals[i],M.d))+" "+esc(M.u):"–")+'</b>';}).join("");
  const[cy,j]=slot(ax,y0,i);const d=dateAt(cy,j)||dateAt(2024,slot(ax,2024,i)[1]);const b=B.rows[i];
  return'<b>'+esc(d?fds(d):"29 Feb")+'</b> <span class="src">'+esc(A.name)+' · '+esc(M.u)+'</span>'+rows+(b&&hasBand?'<br>5-yr avg <b>'+(st.metric==="flow"?sg(b[1],0):f(b[1],M.d))+'</b> · range '+f(b[0],M.d)+' to '+f(b[2],M.d):"")+'<br><span class="src">click to see every country on this day</span>';};
 const doClick=i=>{let d=null;for(const y of yrs){const[cy,j]=slot(ax,y,i);const dd=dateAt(cy,j);if(dd&&isNum(val(A,"fill",dd))&&dd<=A.last){d=dd;break;}}if(!d)return;pick=d===A.last?null:d;renderKpis();renderChart();renderTable();if(pick){const p=pick;ensureAll().then(()=>{if(shown&&pick===p){renderKpis();renderTable();}});}};
 chart($("gsChart"),{axis:ax,ser,unit:M.u,label:A.name+" gas storage "+M.l,band:hasBand?B.rows:null,bandOn:hasBand&&on("band"),avgOn:hasBand&&on("avg"),yr:st.metric==="fill"?[0,100]:st.metric==="twh"&&isNum(A.wgv)?[0,nice(0,A.wgv,5)[1]]:null,zero:st.metric==="flow",
  tgt:tline!=null&&on("tgt")?ti:null,tline:on("tgt")?tline:null,tline2:on("tgt")?tline2:null,tlab:st.metric==="fill"?"EU target 90%":"90% = "+f(tline,0)+" TWh",pin:pinI,tip:tipf,click:doClick});
 const S=stats(st.area,pick);
 $("gsFoot").innerHTML=(pick?'<button type="button" class="button gs-back" id="gsBack">← Back to latest ('+esc(fds(A.last))+')</button> Showing <b>'+esc(fdd(pick))+'</b> in the cards and the country table. ':'Latest gas day <b>'+esc(fdd(A.last))+'</b>'+(S&&S.status==="E"?" (AGSI marks the latest days as estimated; they are revised)":"")+'. Tap or click the chart to see that day for every country. ')+
  (tline!=null&&on("tgt")?'Target box: 1 Oct – 1 Dec at 90% (dotted line: 80%, the lowest allowed with the 10-point flexibility). ':"")+(A.eu?"":esc(G.notes&&G.notes[A.code||st.area]||"Not part of the EU total."));
 const bk=$("gsBack");if(bk)bk.onclick=()=>{pick=null;renderKpis();renderChart();renderTable();};
 $("gsAreaSel").onchange=e=>setArea(e.target.value);
 el.querySelectorAll("#gsMetric [data-k]").forEach(b=>b.onclick=()=>{st.metric=b.dataset.k;save();renderChart();});
 el.querySelectorAll("#gsAxis [data-k]").forEach(b=>b.onclick=()=>{st.axis=b.dataset.k;save();renderChart();});
 el.querySelectorAll("#gsKeys [data-k]").forEach(b=>b.onclick=()=>toggle(b.dataset.k));}
/* ---------- country table ---------- */
const COLS=[["name","Country",1],["fill","Full",-1],["vsAvg","vs 5y avg",-1],["vsLy","vs last year",-1],["d7","7 days",-1],["twh","Stored",-1],["wgv","Capacity",-1],["net","Net flow",-1]];
function bar(S){if(!isNum(S.fill))return NA;const tk=(v,c,t)=>isNum(v)?'<i class="gs-tick '+c+'" style="left:'+Math.max(0,Math.min(100,v))+'%" title="'+esc(t)+'"></i>':"";
 return'<span class="gs-bar-w"><span class="gs-bar-f" style="width:'+Math.max(0,Math.min(100,S.fill))+'%"></span>'+tk(S.avg,"avg","5-yr average "+f(S.avg,1)+"%")+tk(S.ly,"ly","Last year "+f(S.ly,1)+"%")+'</span><b>'+f(S.fill,1)+'%</b>';}
function renderTable(){const el=$("gsTbl");const d=pick||null;const rows=G.order.map(c=>stats(c,d)).filter(Boolean);const eu=rows.find(r=>r.code==="EU"),rest=rows.filter(r=>r.code!=="EU"&&r.eu),non=rows.filter(r=>!r.eu);
 const k=st.sort,dir=st.dir;rest.sort((a,b)=>{const x=a[k],y=b[k];if(k==="name")return dir*String(x).localeCompare(String(y));if(!isNum(x)&&!isNum(y))return 0;if(!isNum(x))return 1;if(!isNum(y))return-1;return dir*(x-y);});
 const td=(v,dd,u,c,k)=>'<td class="'+(k?"gs-c-"+k+" ":"")+'num '+(c?cls(v):"")+'">'+(isNum(v)?(c?sg(v,dd):f(v,dd))+(u?'<small> '+u+'</small>':""):NA)+'</td>';
 const tr=S=>'<tr class="gs-row'+(S.code===st.area?" is-on":"")+(S.code==="EU"?" sum":"")+'" data-a="'+S.code+'" tabindex="0"><th class="c-z" scope="row">'+esc(S.name)+(S.eu?"":' <span class="pw-ratio">non-EU</span>')+(d&&S.d!==d?' <span class="pw-ratio">'+esc(fds(S.d))+'</span>':"")+(S.pending?' <span class="pw-ratio">loading…</span>':"")+'</th><td class="gs-fill">'+bar(S)+'</td>'+td(S.vsAvg,1,"pp",1)+td(S.vsLy,1,"pp",1)+td(S.d7,1,"pp",1)+td(S.twh,S.twh<20?2:1,"TWh","","twh")+td(S.wgv,S.wgv<20?2:1,"TWh","","wgv")+
  '<td class="gs-c-net num '+(isNum(S.net)?(S.net>=0?"up":"dn"):"")+'">'+(isNum(S.net)?sg(S.net,0)+'<small> GWh/d</small>':NA)+'</td></tr>';
 const th=COLS.map(([key,l,dd])=>'<th scope="col" class="gs-c-'+key+' '+(key==="name"?"c-z ":"")+'gs-sort'+(k===key?" is-sorted":"")+'" data-s="'+key+'" data-d="'+dd+'" aria-sort="'+(k===key?(dir>0?"ascending":"descending"):"none")+'"><button type="button">'+l+(k===key?(dir>0?" ▲":" ▼"):"")+'</button></th>').join("");
 el.innerHTML='<div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title">Gas storage by country<span class="pw-u"> · '+(d?"on "+esc(fdd(d)):"latest gas day "+esc(fdd(G.gas_day)))+'</span></strong><span class="pw-card-sub">Bar = % full · <i class="gs-tick avg inl"></i> 5-yr average · <i class="gs-tick ly inl"></i> last year · pp = percentage points of capacity · net flow + filling / − drawing down'+(d?' · <button type="button" class="button gs-back" id="gsBack2">Back to latest</button>':"")+'</span></div></div>'+
  '<div class="gs-tbl-wrap"><table class="pw-tbl gs-tbl"><thead><tr>'+th+'</tr></thead><tbody>'+(eu?tr(eu):"")+rest.map(tr).join("")+non.map(tr).join("")+'</tbody></table></div>'+
  '<p class="pw-foot">'+esc(Object.entries(G.notes||{}).filter(([c])=>c!=="UA").map(([,t])=>t).join(" "))+' Capacity = working gas volume on the latest day. Countries without underground storage (e.g. Finland, Greece, the Baltics except Latvia) report none.</p>';
 el.querySelectorAll(".gs-sort").forEach(h=>h.onclick=()=>{const s=h.dataset.s;if(st.sort===s)st.dir=-st.dir;else{st.sort=s;st.dir=+h.dataset.d;}save();renderTable();});
 el.querySelectorAll(".gs-row").forEach(r=>{const go=()=>{setArea(r.dataset.a);const c=$("gsChartCard");if(c&&c.getBoundingClientRect().top<0)window.MMUI?MMUI.go("gsChartCard",$("subNav")):c.scrollIntoView();};r.onclick=go;r.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};});
 const b2=$("gsBack2");if(b2)b2.onclick=e=>{e.stopPropagation();pick=null;renderKpis();renderChart();renderTable();};}
function renderExplain(){const t=G.targets;if(!t)return;$("gsTgtTxt").innerHTML=esc(t.text)+' Sources: <a href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">Regulation (EU) 2025/1733</a>, <a href="'+esc(t.ec_url)+'" target="_blank" rel="noopener noreferrer">European Commission</a>. The box on the chart marks 1 Oct – 1 Dec at 90% for EU countries; it is a legal reference, not a forecast. Some countries have lower obligations (for example where storage is large relative to national use).';
 $("gsSrcTxt").innerHTML='<a href="'+esc(G.source.url)+'" target="_blank" rel="noopener noreferrer">GIE AGSI+</a> (Gas Infrastructure Europe), the official EU storage transparency platform. Published once a day (~18:00 CET) for the previous gas day; the latest days are often revised. Refreshed here several times a day; this year and the previous five years kept. '+esc(G.notes&&G.notes.UA||"");}
/* ---------- Today line (tab + Home) ---------- */
function today(){if(!G||!G.areas.EU)return null;const S=stats("EU",null);if(!S)return null;
 return{parts:['EU gas storage <b>'+f(S.fill,1)+'%</b> full ('+esc(fds(S.d))+')',isNum(S.vsAvg)?sg(S.vsAvg,1)+' pp vs 5-yr avg':null,isNum(S.vsLy)?sg(S.vsLy,1)+' pp vs last year':null,isNum(S.net)?(S.net>=0?"net injection ":"net withdrawal ")+f(Math.abs(S.net)/1000,2)+' TWh/d':null],isos:[G.generated_utc.replace("Z",":00Z")]};}
function renderToday(){if(!shown||!window.MMToday)return;const x=today();if(x)MMToday.set(x.parts,x.isos);}
function load(force){if(loading&&!force)return loading;loading=(async()=>{try{const r=await fetch("data/gas.json?t="+Math.floor(Date.now()/6e4),{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);G=await r.json();DL={};}catch(e){console.warn("gas.json",e);}
 tried=true;render();window.MMHome&&MMHome.render&&MMHome.render();return G;})();return loading;}
let rt;addEventListener("resize",()=>{if(!shown||!G)return;clearTimeout(rt);rt=setTimeout(renderChart,180);});
addEventListener("mm:expand",()=>{if(shown&&G){clearTimeout(rt);rt=setTimeout(renderChart,60);}});
window.MMGas={show(){shown=true;shell();setNav();render();if(!G)load();},hide(){shown=false;hideTip();},reload(){pick=null;return load(true);},ensure(){return G?Promise.resolve(G):load();},today,data:()=>G};
})();
