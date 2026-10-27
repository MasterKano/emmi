/* Nordic Power tab: "Prices & drivers" panel. One card: the latest day-ahead price per area vs the day before and its
   4-week average, next to measured moves in wind, demand, temperature, nuclear, reservoirs, gas/carbon and zone spreads.
   Numbers come from data/nordic_drivers.json (scripts/build_drivers.py); this file only formats them. Lines state what
   was measured and when; they do not estimate how much each one moved the price. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isNum=v=>typeof v==="number"&&isFinite(v);
const KEY="mm.why.v1";let st={a:"NOR"};try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}};
const ZC={SE:["SE1","SE2","SE3","SE4"],NO:["NO1","NO2","NO3","NO4","NO5"],FI:["FI"],DK:["DK1","DK2"]};
const ALLZ=[].concat(ZC.SE,ZC.NO,ZC.FI,ZC.DK),CTRY=z=>Object.keys(ZC).find(c=>ZC[c].includes(z));
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const dd=s=>{if(!s)return"";const d=new Date(s.slice(0,10)+"T12:00:00Z");return d.getUTCDate()+" "+MON[d.getUTCMonth()];};
const wd=s=>WD[new Date(s.slice(0,10)+"T12:00:00Z").getUTCDay()];
const days=(a,b)=>Math.round((Date.parse(b.slice(0,10))-Date.parse(a.slice(0,10)))/864e5);
const f2=v=>isNum(v)?v.toFixed(2):"n/a";
const sg=(v,d)=>isNum(v)?(v>=0?"+":"−")+Math.abs(v).toFixed(d==null?2:d):"n/a";
const gw=v=>isNum(v)?(Math.abs(v)>=10000?(v/1000).toFixed(1):(v/1000).toFixed(2))+" GW":"n/a";
const pct=(v,r)=>isNum(v)&&isNum(r)&&r>0?(v/r-1)*100:null;
/* "17% above its 4-week average (14.7 GW)"; within ±0.5% reads "in line with" */
const rel=(p,what)=>!isNum(p)?"":Math.abs(p)<0.5?"in line with "+what:Math.abs(p).toFixed(Math.abs(p)<10?1:0)+"% "+(p>0?"above ":"below ")+what;
const avgLab=n=>n>=28?"its 4-week average":"its "+n+"-day average";
const pillP=p=>isNum(p)?{v:p,txt:(p>=0?"+":"−")+Math.abs(p).toFixed(Math.abs(p)<10?1:0)+"%"}:null;
let J=null,busy=null;
function load(){if(J)return Promise.resolve(J);if(!busy)busy=fetch("data/nordic_drivers.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{J=j;return j;});return busy;}
const pill=(c,big)=>window.MMMtd?MMMtd.pill(c,big):"";
function bar(v,ref,col){if(!isNum(v))return"";const mx=Math.max(v,isNum(ref)?ref:0)*1.12||1,w=Math.max(0,Math.min(100,v/mx*100)),t=isNum(ref)?Math.max(0,Math.min(100,ref/mx*100)):null;
 return'<span class="md-bt wd-bt"><i style="width:'+w.toFixed(1)+'%;background:'+col+'"></i>'+(t!=null?'<b style="left:'+t.toFixed(1)+'%"></b>':"")+'</span>';}
function row(o){/* {k, val, pill, bar, txt, src, stale} */
 return'<div class="wd-row'+(o.stale?" is-stale":"")+'"><div class="wd-top"><span class="wd-k">'+esc(o.k)+'</span>'+(o.bar||'<span class="wd-bt0"></span>')+'<span class="wd-v">'+esc(o.val)+'</span>'+(o.pill||'<span></span>')+'</div>'+
  '<div class="wd-t">'+o.txt+(o.stale?' <span class="wd-old">'+esc(o.stale)+'</span>':"")+'</div><div class="wd-src">'+o.src+'</div></div>';}
/* ---------- driver lines; each returns null when the data is missing ---------- */
function lines(A,P,F,area){const D=P.date,out=[],old=(d,lim)=>d&&days(d,D)>lim?"Latest available is "+dd(d)+".":"";
 const w=A.wind;if(w&&isNum(w.v)){const p=pct(w.v,w.avg),pd=pct(w.v,w.prev),wa=A.wind_act;
  out.push({key:"wind",k:"Wind",val:gw(w.v),pill:pill(pillP(p)),bar:bar(w.v,w.avg,"#4aa3df"),
   txt:"Day-ahead forecast for "+dd(w.date)+": "+gw(w.v)+", "+rel(p,avgLab(w.n))+" ("+gw(w.avg)+")"+(isNum(pd)?"; "+sg(pd,0)+"% vs the "+dd(prevOf(w.date))+" forecast":"")+"."+(wa&&isNum(wa.v)?" Actual on "+dd(wa.date)+": "+gw(wa.v)+".":""),
   src:"ENTSO-E A69 wind and solar forecast"+(wa?", A75 actual":"")+" · "+dd(w.date),stale:old(w.date,1),p,pd});}
 const l=A.load;if(l&&isNum(l.v)){const p=pct(l.v,l.avg),pd=pct(l.v,l.prev);
  out.push({key:"load",k:"Demand",val:gw(l.v),pill:pill(pillP(p)),bar:bar(l.v,l.avg,"#c08bf0"),
   txt:"Actual load on "+dd(l.date)+": "+gw(l.v)+", "+rel(p,avgLab(l.n))+" ("+gw(l.avg)+")"+(isNum(pd)?"; "+sg(pd,1)+"% vs "+dd(prevOf(l.date)):"")+"."+(l.excl?" Excludes "+l.excl.join(", ")+" (no load data for that day yet).":""),
   src:"ENTSO-E A65 actual total load · "+dd(l.date),stale:old(l.date,4),p,pd});}
 const t=A.temp;if(t&&isNum(t.v)){const dl=isNum(t.avg)?t.v-t.avg:null,dp=isNum(t.prev)?t.v-t.prev:null;
  out.push({key:"temp",k:"Temperature",val:t.v.toFixed(1)+" °C",pill:pill(isNum(dl)?{v:dl,txt:sg(dl,1)+" °C"}:null),bar:"",
   txt:(t.scope&&t.scope.length===2?{SE:"Sweden",NO:"Norway",FI:"Finland",DK:"Denmark"}[t.scope]+" (main cities)":"Nordic mean (NO, SE, FI, DK cities)")+" "+(t.kind==="forecast"?"forecast ":"")+"for "+dd(t.date)+": "+t.v.toFixed(1)+" °C, "+(isNum(dl)?(Math.abs(dl)<0.05?"equal to ":Math.abs(dl).toFixed(1)+" °C "+(dl>0?"above ":"below "))+avgLab(t.n):"")+(isNum(dp)?"; "+sg(dp,1)+" °C vs "+dd(prevOf(t.date)):"")+".",
   src:"Open-Meteo daily mean, main load-centre cities · "+dd(t.date),stale:old(t.date,2),dl});}
 const n=A.nuc;if(n&&isNum(n.avail)){
  out.push({key:"nuc",k:"Nuclear",val:gw(n.avail),pill:'<span class="md-pill na">'+Math.round(n.pct)+'% of cap.</span>',bar:bar(n.avail,n.cap,"#f2b84b"),
   txt:(n.scope==="SE+FI"?"Swedish and Finnish":n.scope==="SE"?"Swedish":"Finnish")+" nuclear available for "+dd(n.date)+": "+gw(n.avail)+" of "+gw(n.cap)+" installed ("+n.pct.toFixed(0)+"%)"+(n.basis==="at build time"?", as of the latest update":"")+"."+(isNum(n.out_avg)?" Actual output averaged "+gw(n.out_avg)+" over the 4 weeks before.":""),
   src:"Nord Pool UMM (availability), ENTSO-E A75 (output) · "+dd(n.date),stale:old(n.date,1),pct:n.pct});}
 const h=A.hydro;if(h&&isNum(h.twh)){const sun=h.date?new Date(Date.parse(h.date)+6*864e5).toISOString().slice(0,10):null;
  out.push({key:"hydro",k:"Reservoirs",val:h.twh.toFixed(1)+" TWh",pill:pill(isNum(h.pct)?{v:h.pct,txt:sg(h.pct,1)+"%"}:null),bar:bar(h.twh,h.norm,"#3cc4b4"),
   txt:(h.scope.length===2?{SE:"Sweden",NO:"Norway",FI:"Finland"}[h.scope]:"Nordic (NO, SE, FI)")+", week "+h.week+(sun?" (to "+dd(sun)+")":"")+": "+h.twh.toFixed(1)+" TWh, "+(isNum(h.dev)?Math.abs(h.dev).toFixed(1)+" TWh ("+Math.abs(h.pct).toFixed(1)+"%) "+(h.dev>=0?"above":"below")+" the median for that week ("+h.norm.toFixed(1)+" TWh"+(h.years?", "+h.years:"")+")":"")+".",
   src:esc(h.src||"")+" · week "+h.week,stale:sun&&days(sun,D)>17?"Weekly data; latest week ended "+dd(sun)+".":"",p:h.pct});}
 const g=F.gas;if(g&&isNum(g.v)){const pd=pct(g.v,g.prev),p=pct(g.v,g.avg),c=F.co2,cd=c?pct(c.v,c.prev):null;
  out.push({key:"gas",k:"Gas & carbon",val:g.v.toFixed(2)+" €/MWh",pill:pill(pillP(pd)),bar:bar(g.v,g.avg,"#e07b53"),
   txt:"TTF day-ahead gas settled "+g.v.toFixed(2)+" €/MWh on "+dd(g.date)+(isNum(pd)?", "+sg(pd,1)+"% vs "+dd(g.prev_date):"")+(isNum(p)?", "+rel(p,"its 4-week average")+" ("+g.avg.toFixed(2)+")":"")+"."+
    (c&&isNum(c.v)?" EUA Dec-26 carbon "+c.v.toFixed(2)+" €/t"+(isNum(cd)?", "+sg(cd,1)+"% vs "+dd(c.prev_date):"")+".":""),
   src:"EEX settlements · "+dd(g.date),stale:old(g.date,5),pd});}
 const Z=P.zones||{};
 if(area==="NOR"){const zs=ALLZ.filter(z=>Z[z]&&isNum(Z[z].v));if(zs.length>1){const hi=zs.reduce((a,b)=>Z[b].v>Z[a].v?b:a),lo=zs.reduce((a,b)=>Z[b].v<Z[a].v?b:a);
   const pz=zs.filter(z=>isNum(Z[z].prev)),gp=pz.length>1?Math.max(...pz.map(z=>Z[z].prev))-Math.min(...pz.map(z=>Z[z].prev)):null,gap=Z[hi].v-Z[lo].v;
   out.push({key:"spr",k:"Zone spread",val:f2(gap)+" €/MWh",pill:pill(isNum(gp)?{v:gap-gp,txt:sg(gap-gp,0)+" €"}:null),bar:bar(gap,gp,"#9aa3b2"),
    txt:"On "+dd(D)+" zone prices ran from "+f2(Z[lo].v)+" ("+lo+") to "+f2(Z[hi].v)+" €/MWh ("+hi+"), a gap of "+f2(gap)+(isNum(gp)?"; the gap on "+dd(P.prev_date)+" was "+f2(gp):"")+".",
    src:"Nord Pool day-ahead · "+dd(D)});}}
 else{const z=Z[area];if(z&&isNum(z.spr)){
   out.push({key:"spr",k:"vs system",val:sg(z.spr)+" €/MWh",pill:pill(isNum(z.spr_prev)?{v:z.spr-z.spr_prev,txt:sg(z.spr-z.spr_prev,0)+" €"}:null),bar:"",
    txt:area+" minus the system price on "+dd(D)+": "+sg(z.spr)+" €/MWh"+(isNum(z.spr_prev)?", vs "+sg(z.spr_prev)+" on "+dd(P.prev_date):"")+(isNum(z.spr_avg)?"; 4-week average "+sg(z.spr_avg)+".":"."),
    src:"Nord Pool day-ahead · "+dd(D)});}}
 return out;}
function prevOf(s){return new Date(Date.parse(s.slice(0,10))-864e5).toISOString().slice(0,10);}
/* one plain sentence: the price move, then the measured moves listed next to it */
function read(P,L,area){const k=area==="NOR"?"SYS":area,z=P.zones[k];if(!z)return"";const nm=area==="NOR"?"The system price":area;
 const d=isNum(z.prev)?z.v-z.prev:null,a=isNum(z.avg)?z.v-z.avg:null;
 let s=nm+" for "+wd(P.date)+" "+dd(P.date)+" is "+f2(z.v)+" €/MWh, "+(isNum(d)?(Math.abs(d)<0.005?"unchanged from ":(d>0?"up ":"down ")+Math.abs(d).toFixed(2)+" from ")+dd(P.prev_date):"")+(isNum(a)?" and "+Math.abs(a).toFixed(2)+(a>=0?" above ":" below ")+"its 4-week average":"")+".";
 const by=Object.fromEntries(L.map(x=>[x.key,x])),al=[];
 if(by.wind&&isNum(by.wind.pd))al.push("a wind forecast "+Math.abs(by.wind.pd).toFixed(0)+"% "+(by.wind.pd>=0?"higher":"lower")+" than for "+dd(P.prev_date));
 if(by.nuc)al.push("nuclear availability at "+by.nuc.pct.toFixed(0)+"% of capacity");
 if(by.hydro&&isNum(by.hydro.p))al.push("reservoirs "+Math.abs(by.hydro.p).toFixed(1)+"% "+(by.hydro.p>=0?"above":"below")+" the weekly median");
 if(by.gas&&isNum(by.gas.pd))al.push("TTF day-ahead gas "+sg(by.gas.pd,1)+"% at its "+dd((J.fuels.gas||{}).date)+" settlement");
 if(al.length)s+=" Alongside: "+al.join(", ")+".";
 return s;}
function shell(box){
 box.innerHTML='<div class="md-ctl"><div class="pw-chips md-areas wd-areas" id="wdArea" role="group" aria-label="Area">'+["NOR"].concat(ALLZ).map(a=>'<button type="button" class="chip" data-a="'+a+'">'+(a==="NOR"?"Nordic":a)+'</button>').join("")+'</div></div>'+
  '<div class="pw-card md-card wd-card" style="--mc:var(--accent)" id="wdCard"></div>';
 $("wdArea").querySelectorAll("button").forEach(b=>b.onclick=()=>{st.a=b.dataset.a;save();draw();});}
function draw(){const box=$("pwWhyBody");if(!box)return;
 const P=J&&J.prices;if(!P||!P.zones||!P.zones.SYS){box.innerHTML='<div class="pw-empty">Price and driver data not available in this build.</div>';return;}
 if(!$("wdCard"))shell(box);
 if(window.MMUI&&$("pwDotWhy"))$("pwDotWhy").innerHTML=MMUI.dot(J.generated_utc,"power","Prices & drivers (Nord Pool, ENTSO-E, UMM, NVE, EEX)",null,(J.gaps||[]).join("; "));
 const area=(st.a==="NOR"||ALLZ.includes(st.a))&&J.areas[st.a]?st.a:"NOR";
 $("wdArea").querySelectorAll("button").forEach(b=>{const on=b.dataset.a===area;b.classList.toggle("is-on",on);b.setAttribute("aria-pressed",on);});
 const sub=$("pwWhySub");if(sub)sub.textContent="day-ahead "+wd(P.date)+" "+dd(P.date)+" vs "+dd(P.prev_date)+" and the 4 weeks before";
 const A=J.areas[area]||{},L=lines(A,P,J.fuels||{},area),Z=P.zones,k=area==="NOR"?"SYS":area,z=Z[k];
 const zs=area==="NOR"?ALLZ:ZC[CTRY(area)];
 const rows=[{lab:"SYS",v:Z.SYS.v,ref:Z.SYS.prev,c:isNum(Z.SYS.prev)?{v:Z.SYS.v-Z.SYS.prev,txt:sg(Z.SYS.v-Z.SYS.prev,1)}:null,strong:area==="NOR"}];
 let lastC=null;zs.forEach(q=>{const r=Z[q];if(!r)return;const c=CTRY(q);rows.push({lab:q,v:r.v,ref:r.prev,c:isNum(r.prev)?{v:r.v-r.prev,txt:sg(r.v-r.prev,1)}:null,strong:q===area,sep:c!==lastC});lastC=c;});
 const dA=isNum(z.avg)?pct(z.v,z.avg):null,dD=isNum(z.prev)?z.v-z.prev:null;
 const today=J.today||"",late=today&&days(P.date,today)>0?'<p class="md-note">Latest Nord Pool day in this build is '+dd(P.date)+'.</p>':"";
 $("wdCard").innerHTML=late+'<div class="md-body wd-body"><div class="md-side">'+
  '<div class="md-big"><b>'+f2(z.v)+'</b><span class="md-u">€/MWh</span>'+pill(isNum(dD)?{v:dD,txt:sg(dD)+" vs "+dd(P.prev_date)}:null,true)+'</div>'+
  '<div class="md-l2">'+(area==="NOR"?"System price":area)+' · '+wd(P.date)+' '+dd(P.date)+' · 4-week avg <b>'+f2(z.avg)+'</b>'+(isNum(dA)&&z.avg>0?' ('+sg(dA,0)+'%)':"")+'</div>'+
  '<p class="wd-read">'+esc(read(P,L,area))+'</p>'+
  '<div class="md-bh"><span>Day-ahead €/MWh, '+dd(P.date)+'</span><span class="md-tk">'+dd(P.prev_date)+'</span></div>'+
  (window.MMMtd?MMMtd.bars(rows,"var(--accent)",2,dd(P.prev_date)):"")+
  '<div class="wd-src">'+esc(P.src||"Nord Pool")+' · '+dd(P.date)+'</div></div>'+
  '<div class="wd-list">'+(L.length?L.map(row).join(""):'<div class="pw-empty">No driver data for this area.</div>')+'</div></div>'+
  '<p class="pw-foot">Each line is a measured or published value with its own date; they are shown side by side and are not an estimate of how much each one moved the price. 4-week average = the 28 days before the value’s date. Daily values are means of the hours in the CET day.</p>';}
function render(){const box=$("pwWhyBody");if(!box)return;load().then(draw);}
window.MMWhy={render,load};
})();
