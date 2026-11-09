/* Nordic Power tab: Nordic nuclear month-to-date panel (Nuclear, wind and solar section). Same design as the Market Pulse
   panel locked in market_pulse_weekday_master_v1.2 (9 Nov 2026): cumulative TWh this month (Nordic, Sweden, Finland) with the
   previous month's Nordic total dashed grey, headline TWh with a chip vs the same days of the previous month, average per day
   vs the full previous month, country bars with a previous-month tick, then available vs installed capacity today and the
   reactors out or reduced.
   Data: data/nordic_mtd.json (scripts/build_mtd.py: ENTSO-E A75 actual generation, nuclear, SE3 = all Swedish reactors, FI;
   GWh per CET day, a day under 90% of its hours stays empty and is left out) and data/power.json nuclear (Nord Pool UMM). */
(function(){
"use strict";
const ACC="#fb923c",SEC="#fdba74",FIC="#ea580c",GREY="#9ca3af",AMB="#fbbf24",GOOD="#34d399",BAD="#f87171";
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const isNum=v=>typeof v==="number"&&isFinite(v);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let M=null,busy=null;
function load(){if(M)return Promise.resolve(M);if(busy)return busy;
 busy=fetch("data/nordic_mtd.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{M=j;busy=null;return j;});return busy;}
const pct=(a,b)=>isNum(a)&&isNum(b)&&b?100*(a/b-1):null;
function chip(p,sm){if(!isNum(p))return'<span class="nx-na">n/a</span>';const c=p>=0?GOOD:BAD;
 return'<span class="nx-chip'+(sm?" sm":"")+'" style="color:'+c+';background:'+c+'1f;border-color:'+c+'55">'+(p>=0?"▲":"▼")+" "+(p>=0?"+":"−")+Math.abs(p).toFixed(1)+'%</span>';}
const ym=d=>d.slice(0,7);
function prevYm(s){let y=+s.slice(0,4),m=+s.slice(5,7)-1;if(m<1){m=12;y--;}return y+"-"+String(m).padStart(2,"0");}
const mlab=s=>MON[+s.slice(5,7)-1];
/* month-to-date numbers; GWh per day per country; complete days = both zones reported */
function calc(){
 if(!M||!M.days||!M.zones||!M.zones.SE3||!M.zones.FI)return null;
 const se=M.zones.SE3.nuclear,fi=M.zones.FI.nuclear;if(!se||!fi)return null;
 const ok=M.days.map((d,i)=>isNum(se[i])&&isNum(fi[i]));
 let last=-1;for(let i=M.days.length-1;i>=0;i--)if(ok[i]){last=i;break;}if(last<0)return null;
 let cm=ym(M.days[last]);const inM=(m)=>M.days.map((d,i)=>[d,i]).filter(([d,i])=>ym(d)===m&&ok[i]);
 let cur=inM(cm);if(cur.length<2){cm=prevYm(cm);cur=inM(cm);}           // too early in the month: previous month in full
 const pm=prevYm(cm),prv=inM(pm);if(!cur.length||!prv.length)return null;
 const N=+cur[cur.length-1][0].slice(8,10);
 const dayOf=d=>+d.slice(8,10);
 const cum=(rows,f)=>{let t=0;return rows.map(([d,i])=>(t+=f(i))/1000);};
 const S=i=>se[i],F=i=>fi[i],T=i=>se[i]+fi[i];
 const same=prv.filter(([d])=>dayOf(d)<=N);
 const O={SE:cur.reduce((s,[d,i])=>s+se[i],0)/1000,FI:cur.reduce((s,[d,i])=>s+fi[i],0)/1000};
 const R={SE:same.reduce((s,[d,i])=>s+se[i],0)/1000,FI:same.reduce((s,[d,i])=>s+fi[i],0)/1000};
 const o=O.SE+O.FI,s=R.SE+R.FI,ptot=prv.reduce((a,[d,i])=>a+T(i),0);
 return{cm,pm,N,Np:Math.min(N,dayOf(prv[prv.length-1][0])),miss:N-cur.length,O,R,o,s,avg:o/cur.length*1000,sfa:ptot/prv.length,
  x:cur.map(([d])=>dayOf(d)),px:prv.map(([d])=>dayOf(d)),nord:cum(cur,T),se:cum(cur,S),fi:cum(cur,F),prev:cum(prv,T),
  through:cur[cur.length-1][0],gen:M.generated_utc};}
function svg(r){
 const W=290,H=196,l=26,rr=40,t=10,b=22,{nord,se,fi,prev,x,px,N}=r,ymax=Math.max(nord[nord.length-1],prev[prev.length-1])*1.08||1;
 const xs=d=>l+(d-1)/30*(W-l-rr),ys=v=>t+(1-v/ymax)*(H-t-b);
 const path=(a,xx)=>a.map((v,i)=>(i?"L":"M")+xs(xx[i]).toFixed(1)+","+ys(v).toFixed(1)).join(" ");
 const step=ymax<2.5?0.5:ymax<6?1:ymax<12?2:5;let g="";
 for(let v=0;v<=ymax+1e-9;v+=step)g+='<line x1="'+l+'" x2="'+(W-rr)+'" y1="'+ys(v).toFixed(1)+'" y2="'+ys(v).toFixed(1)+'" stroke="#222"/><text x="'+(l-5)+'" y="'+(ys(v)+3).toFixed(1)+'" text-anchor="end" class="nx-ax">'+(+v.toFixed(1))+'</text>';
 [1,10,20,30].forEach(d=>g+='<text x="'+xs(d).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" class="nx-ax">'+d+'</text>');
 g+='<line x1="'+xs(N).toFixed(1)+'" x2="'+xs(N).toFixed(1)+'" y1="'+t+'" y2="'+(H-b)+'" stroke="#444" stroke-dasharray="2 3"/>';
 let ln='<path d="'+path(prev,px)+'" fill="none" stroke="'+GREY+'" stroke-width="1.6" stroke-dasharray="4 3"/>';
 [[se,SEC,1.8,3],[fi,FIC,1.8,3],[nord,ACC,2.6,3.5]].forEach(([a,c,w,rad])=>{ln+='<path d="'+path(a,x)+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linejoin="round"/><circle cx="'+xs(x[x.length-1]).toFixed(1)+'" cy="'+ys(a[a.length-1]).toFixed(1)+'" r="'+rad+'" fill="'+c+'"/>';});
 const e=a=>a[a.length-1],xe=xs(x[x.length-1]);
 let yse=ys(e(se))-1,yfi=ys(e(fi))+11;if(yfi-yse<11){const m=(yse+yfi)/2;yse=m-5.5;yfi=m+5.5;}
 const pe=px[px.length-1];let ymtd=ys(e(nord))-7;
 if(Math.abs(ys(e(prev))-ys(e(nord)))<16&&xe>xs(Math.min(pe,30))-60)ymtd=Math.min(ys(prev[Math.min(N,prev.length)-1]),ys(e(nord)))-8;
 ln+='<text x="'+(xe+6).toFixed(1)+'" y="'+yse.toFixed(1)+'" class="nx-lbl" fill="'+SEC+'">SE '+e(se).toFixed(1)+'</text>'+
  '<text x="'+(xe+6).toFixed(1)+'" y="'+yfi.toFixed(1)+'" class="nx-lbl" fill="'+FIC+'">FI '+e(fi).toFixed(1)+'</text>'+
  '<text x="'+(xe-5).toFixed(1)+'" y="'+ymtd.toFixed(1)+'" text-anchor="end" class="nx-lbl" fill="'+ACC+'">MTD '+e(nord).toFixed(1)+'</text>'+
  '<text x="'+(xs(Math.min(pe,30))+4).toFixed(1)+'" y="'+(ys(e(prev))+4).toFixed(1)+'" class="nx-lbl" fill="'+GREY+'">'+e(prev).toFixed(1)+'</text>';
 return'<svg class="nx-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Nordic nuclear output, cumulative TWh this month vs last month">'+g+ln+'<text x="'+(l+2)+'" y="'+(t+8)+'" class="nx-ax">TWh cumulative</text></svg>';}
function bar(lab,v,ref,mx,tot){return'<div class="nx-cr'+(tot?" tot":"")+'"><span class="nx-cc">'+lab+'</span><div class="nx-bw"><div class="nx-b" style="width:'+(100*v/mx).toFixed(1)+'%;background:'+ACC+'"></div><div class="nx-tick" style="left:calc('+(100*ref/mx).toFixed(1)+'% - 1px)"></div></div><span class="nx-cv">'+v.toFixed(2)+'</span><span class="nx-cp">'+chip(pct(v,ref),true)+'</span></div>';}
function nucSec(r){const mc=mlab(r.cm),mp=mlab(r.pm),N=r.N,Np=r.Np;
 const mx=Math.max(r.O.SE,r.O.FI,r.R.SE,r.R.FI)||1;
 const rows=bar("Nordic",r.o,r.s,Math.max(r.o,r.s)||1,true)+'<div class="nx-dv"></div>'+bar("SE",r.O.SE,r.R.SE,mx)+bar("FI",r.O.FI,r.R.FI,mx);
 return'<div class="nx-sec"><div class="nx-hd"><span class="nx-tag">NUCLEAR</span><span class="nx-sub">actual output</span></div>'+
  '<div class="nx-grid"><div class="nx-left">'+svg(r)+'</div><div class="nx-right">'+
  '<div class="nx-big"><span class="nx-num">'+r.o.toFixed(2)+'</span><span class="nx-unit">TWh</span> '+chip(pct(r.o,r.s))+'</div>'+
  '<div class="nx-line">'+mc+' 1–'+N+' · vs <b>'+r.s.toFixed(2)+' TWh</b> '+mp+' 1–'+Np+(r.miss?' · '+r.miss+' incomplete day'+(r.miss>1?"s":"")+' left out':"")+'</div>'+
  '<div class="nx-kv"><span class="nx-k">Avg / day</span><span class="nx-v">'+Math.round(r.avg)+' GWh</span><span class="nx-k">vs '+Math.round(r.sfa)+' full '+mp+'</span>'+chip(pct(r.avg,r.sfa),true)+'</div>'+
  '<div class="nx-bars"><div class="nx-bh"><span>By country · bar = '+mc+' 1–'+N+' TWh</span><span><i class="nx-tk"></i> '+mp+' 1–'+Np+'</span></div>'+rows+'</div>'+
  '</div></div></div>';}
const gw=v=>(v/1000).toFixed(1);
function backDay(ts){const d=new Date(new Date(ts).getTime()-6e4);const s=d.toLocaleDateString("en-GB",{timeZone:"Europe/Zurich",day:"numeric",month:"short"}).replace("Sept","Sep");
 const y=+d.toLocaleDateString("en-GB",{timeZone:"Europe/Zurich",year:"numeric"});return s+(y!==new Date().getFullYear()?" "+y:"");}
function outList(U){const red=(U||[]).filter(u=>isNum(u.now)&&isNum(u.cap)&&u.now<u.cap-1);
 const full=red.filter(u=>u.now<=1).sort((a,b)=>a.back<b.back?-1:1),part=red.filter(u=>u.now>1).sort((a,b)=>a.back<b.back?-1:1);
 const tg=u=>u.planned?"":', <span class="nx-forced">unplanned</span>';
 const it=full.map(u=>'<span class="nx-ou">'+esc(u.n)+' ('+gw(u.cap)+' GW, back '+backDay(u.back)+tg(u)+')</span>').concat(part.map(u=>'<span class="nx-ou">'+esc(u.n)+' partial ('+gw(u.now)+' of '+gw(u.cap)+' GW, until '+backDay(u.back)+tg(u)+')</span>'));
 if(!it.length)return"All 11 reactors at full capacity per published UMMs.";
 const pl=red.map(u=>!!u.planned),note=pl.every(Boolean)?" All planned.":pl.every(v=>!v)?" All unplanned.":"";
 return"<b>Out or reduced:</b> "+it.join(" · ")+"."+note;}
function onlineSec(N){const cap={SE:N.cap.SE,FI:N.cap.FI},now={SE:N.now.SE,FI:N.now.FI},tn=now.SE+now.FI,tc=cap.SE+cap.FI;
 let rows='<div class="nx-cr tot cap"><span class="nx-cc">Nordic</span><div class="nx-bw cap" style="width:100%"><div class="nx-b" style="width:'+(100*tn/tc).toFixed(1)+'%;background:'+ACC+'"></div></div><span class="nx-cv">'+gw(tn)+'</span><span class="nx-cp"><span class="nx-of">of '+gw(tc)+' GW</span></span></div><div class="nx-dv"></div>';
 ["SE","FI"].forEach(c=>{rows+='<div class="nx-cr cap"><span class="nx-cc">'+c+'</span><div class="nx-bw cap" style="width:'+(100*cap[c]/tc).toFixed(1)+'%"><div class="nx-b" style="width:'+(100*now[c]/cap[c]).toFixed(1)+'%;background:'+ACC+'"></div></div><span class="nx-cv">'+gw(now[c])+'</span><span class="nx-cp"><span class="nx-of">of '+gw(cap[c])+' · '+Math.round(100*now[c]/cap[c])+'%</span></span></div>';});
 return'<div class="nx-sec"><div class="nx-hd"><span class="nx-tag">ONLINE TODAY</span><span class="nx-sub">available vs installed capacity, GW</span></div><div class="nx-bars">'+rows+'</div><div class="nx-out">'+outList(N.units)+'</div></div>';}
function draw(box,N){const r=calc();
 const fdt=t=>new Date(t).toLocaleString("en-GB",{timeZone:"Europe/Zurich",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).replace("Sept","Sep").replace(",","");
 if(!r&&!N){box.innerHTML='<div class="nx-wrap"><h3 class="nx-h1">NORDIC NUCLEAR · <span>MONTH TO DATE</span></h3><div class="nx-empty">Nuclear month-to-date data is not available in this build.</div></div>';return;}
 let h='<div class="nx-wrap"><h3 class="nx-h1">NORDIC NUCLEAR · <span>MONTH TO DATE</span></h3>';
 if(r){const mc=mlab(r.cm),mp=mlab(r.pm);
  h+='<div class="nx-st">SE + FI · '+mc+' 1–'+r.N+' vs same days of '+mp+' · green = above '+mp+', red = below</div>'+
   '<div class="nx-leg"><span><i style="border-color:'+ACC+'"></i>Nordic</span><span><i style="border-color:'+SEC+'"></i>SE</span><span><i style="border-color:'+FIC+'"></i>FI</span><span><i class="d"></i>Nordic, '+mp+' (full month)</span><span>┊ day '+r.N+'</span></div>'+nucSec(r);}
 else h+='<div class="nx-st">SE + FI · available vs installed capacity today</div>';
 if(N)h+=onlineSec(N);
 const foot=[];
 if(r)foot.push("Source: ENTSO-E Transparency, actual generation per type (A75, nuclear), SE3 + FI, complete CET days, "+mlab(r.cm)+" 1–"+r.N+" vs "+mlab(r.pm)+" 1–"+r.Np+"; full-"+mlab(r.pm)+" avg = whole month ÷ days."+(r.gen?" Built "+fdt(r.gen)+" CET.":""));
 else foot.push("Nuclear output (ENTSO-E) is not available in this build.");
 if(N)foot.push("Capacity: Nord Pool REMIT outage messages, "+fdt(N.asof)+" CET.");
 h+='<div class="nx-foot">'+foot.join(" ")+'</div></div>';box.innerHTML=h;}
function render(box,N){if(!box)return;load().then(()=>{try{draw(box,N);}catch(e){box.innerHTML='<div class="nx-wrap"><div class="nx-empty">Nuclear month-to-date panel failed to draw.</div></div>';console.warn("nucmtd",e);}});}
window.MMNucMtd={render,calc:()=>calc()};
})();
