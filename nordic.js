"use strict";
/* Power tab: "Nordic monthly overview" from data/nordic_monthly.json (ENTSO-E A75/A44, NVE + A72 derived inflow). */
(function(){
const $=id=>document.getElementById(id),isN=v=>typeof v==="number"&&isFinite(v),D="—";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],MF=["January","February","March","April","May","June","July","August","September","October","November","December"];
const ml=m=>MO[+m.slice(5)-1]+" "+m.slice(0,4),ms=m=>MO[+m.slice(5)-1]+" ’"+m.slice(2,4),mfull=m=>MF[+m.slice(5)-1]+" "+m.slice(0,4);
const TN={hydro:"Hydro",nuclear:"Nuclear",wind:"Wind",solar:"Solar",thermal:"Thermal & other"},TC={hydro:"#4f7cff",nuclear:"#b07cff",wind:"var(--pw-wind, #3ec98a)",solar:"#f2c14e",thermal:"#f08848"};
const CN={Nordic:"Nordic (NO+SE+FI+DK)",NO:"Norway",SE:"Sweden",FI:"Finland",DK:"Denmark"},ZC={NO1:"#4f7cff",NO2:"#8fb0ff",SE3:"#3ec98a",SE4:"#9be0b9",FI:"#f2c14e",DK1:"#f08848"};
const LS="markets-monitor:nordicmonth:v1";let st=(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}");}catch(e){return{};}})();st.c=st.c||"Nordic";st.i=st.i||"NOSE";
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(st));}catch(e){}};
let N=null,busy=null;
function load(){if(N)return Promise.resolve(N);if(busy)return busy;busy=fetch("data/nordic_monthly.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).then(j=>(N=j)).catch(()=>null);return busy;}
const f1=v=>isN(v)?v.toFixed(1):D,pct=(a,b)=>isN(a)&&isN(b)&&b?(a/b-1)*100:null,sg=v=>isN(v)?(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(0)+"%":D;
const W=el=>Math.max(300,el.clientWidth||700);
function tipBind(el,fn){const PC=window.PWChart;el.querySelectorAll("[data-t]").forEach(r=>{r.addEventListener("mousemove",e=>PC.showTip(fn(r.dataset.t),e));r.addEventListener("mouseleave",PC.hideTip);r.addEventListener("click",e=>PC.showTip(fn(r.dataset.t),e));});}
function axis(lo,hi,n){const raw=(hi-lo)/n,p=Math.pow(10,Math.floor(Math.log10(raw||1))),s=[1,2,2.5,5,10].map(x=>x*p).find(x=>x>=raw)||raw;return s;}
/* derived helpers */
function idx(m){return N.months.indexOf(m);}
function sameLY(m){return (+m.slice(0,4)-1)+m.slice(4);}
function avgM(arr,m){const [a,b]=N.avg_years,v=[];for(let y=a;y<=b;y++){const k=idx(y+m.slice(4));if(k>=0&&isN(arr[k]))v.push(arr[k]);}return v.length>=3?v.reduce((x,y)=>x+y,0)/v.length:null;}
const tot=(c,i)=>{const g=N.gen[c];if(i<0)return null;const v=N.types.map(k=>g[k][i]);return v.some(isN)?v.reduce((s,x)=>s+(x||0),0):null;};
const totAvg=(c,m)=>{const [a,b]=N.avg_years,v=[];for(let y=a;y<=b;y++){const t=tot(c,idx(y+m.slice(4)));if(isN(t))v.push(t);}return v.length>=3?v.reduce((x,y)=>x+y,0)/v.length:null;};
function render(){const box=$("pwMonBody");if(!box)return;load().then(n=>{if(!n){box.innerHTML='<div class="pw-empty">Monthly overview not available yet.</div>';return;}draw();});}
function draw(){const box=$("pwMonBody"),PC=window.PWChart;if(!box||!PC)return;const m=N.last,i=idx(m),ly=sameLY(m),il=idx(ly),AY=N.avg_years.join("–");
 if(window.MMUI&&$("pwDotMon"))$("pwDotMon").innerHTML=MMUI.dot(N.generated_utc,"monthly","Nordic monthly overview (ENTSO-E, NVE)",null,(N.gaps||[]).join("; "));
 $("pwMonTitle").textContent=mfull(m);
 /* glance */const G=N.gen.Nordic,inf=N.inflow&&N.inflow.NOSE,iN=inf?avgM(inf,m):null;let g="";
 const tile=(l,v,u,s,t)=>'<div class="nm-tile"'+(t?' title="'+esc(t)+'"':'')+'><span class="nm-l">'+l+'</span><b>'+v+'<small> '+u+'</small></b><span class="nm-s">'+s+'</span></div>';
 const T=tot("Nordic",i),TL=tot("Nordic",il),TA=totAvg("Nordic",m);
 g+=tile("Nordic generation",f1(T),"TWh",sg(pct(T,TL))+" vs "+ms(ly)+" · "+sg(pct(T,TA))+" vs "+AY+" avg","ENTSO-E A75, NO+SE+FI+DK");
 ["hydro","wind","nuclear"].forEach(k=>{const a=G[k][i],b=G[k][il],c=avgM(G[k],m);g+=tile(TN[k],f1(a),"TWh",sg(pct(a,b))+" vs "+ms(ly)+" · "+sg(pct(a,c))+" vs avg","Nordic "+TN[k].toLowerCase()+" generation, ENTSO-E A75; avg = "+AY);});
 if(inf)g+=tile("Hydro inflow NO+SE",f1(inf[i]),"TWh",(isN(iN)?Math.round(inf[i]/iN*100)+"% of "+AY+" avg ("+f1(iN)+")":D),"Derived: reservoir change (NVE, ENTSO-E A72) + hydro generation (A75)");
 const pz=N.price_zones.filter(z=>N.prices[z]),pi=N.price_months.indexOf(m),pl=N.price_months.indexOf(ly);
 if(pz.length)g+='<div class="nm-tile nm-px"><span class="nm-l">Day-ahead average, €/MWh</span><div class="nm-pz">'+pz.map(z=>{const a=N.prices[z][pi],b=N.prices[z][pl];return'<span title="'+esc(z+": "+f1(a)+" €/MWh in "+ml(m)+", "+f1(b)+" in "+ml(ly))+'"><em>'+z+'</em><b>'+(isN(a)?a.toFixed(0):D)+'</b><i>'+(isN(b)?ms(ly)+" "+b.toFixed(0):"")+'</i></span>';}).join("")+'</div><span class="nm-s">ENTSO-E A44, time-weighted monthly mean</span></div>';
 let h='<div class="nm-glance" role="list">'+g+'</div>';
 h+='<div class="pw-chips nm-chips" id="nmChips">'+Object.keys(CN).map(c=>'<button type="button" class="chip'+(c===st.c?" is-on":"")+'" data-c="'+c+'">'+(c==="Nordic"?"Nordic":c)+'</button>').join("")+'</div>';
 h+='<div class="nm-grid"><section class="pw-card" id="nmCmp"></section><section class="pw-card" id="nmTrend"></section><section class="pw-card" id="nmInf"></section><section class="pw-card" id="nmPx"></section></div>';
 h+='<p class="pw-foot">Generation: <a href="'+N.src.gen+'" target="_blank" rel="noopener">ENTSO-E Transparency, actual generation per production type (A75)</a>, country level, CET months; thermal &amp; other = gas, coal, oil, biomass, waste and other. Prices: <a href="'+N.src.price+'" target="_blank" rel="noopener">ENTSO-E day-ahead prices (A44)</a>. Inflow is derived, not reported: change in reservoir energy (<a href="'+N.src.nve+'" target="_blank" rel="noopener">NVE magasinstatistikk</a> for Norway, <a href="'+N.src.a72+'" target="_blank" rel="noopener">ENTSO-E A72</a> for Sweden, interpolated to month ends) plus hydro generation; it ignores pumping, spill and unregulated run-of-river storage. Precipitation vs normal, Finland/Denmark inflow and hydro forecasts are not shown (no comparable free official series).'+((N.gaps||[]).length?' Missing in this build: '+esc(N.gaps.join("; "))+'.':'')+'</p>';
 box.innerHTML=h;
 $("nmChips").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{st.c=b.dataset.c;save();draw();});
 cmp(m,ly,AY);trend();inflow(m,AY);prices();window.MMUI&&MMUI.apply&&0;}
function cmp(m,ly,AY){const el=$("nmCmp"),PC=window.PWChart,c=st.c,g=N.gen[c],i=idx(m),il=idx(ly);const ks=N.types.filter(k=>g[k].some(v=>isN(v)&&v>0.005));
 const rows=ks.map(k=>[k,g[k][i],g[k][il],avgM(g[k],m)]);const mx=Math.max(...rows.flatMap(r=>r.slice(1).filter(isN)),0.1);
 const S=[["Last month ("+ml(m)+")","var(--accent)"],["Same month last year ("+ml(ly)+")","var(--muted)"],[MO[+m.slice(5)-1]+" average "+AY,"var(--faint, #6b7280)"]];
 el.innerHTML=PC.cardHead("Electricity generation by type, "+CN[c]+", "+ml(m)+" vs "+ml(ly)+" and "+AY+" average","TWh","monthly totals · ENTSO-E A75 actual generation",S.map(([n,col],j)=>'<span class="pw-key"><i style="background:'+col+(j==2?';opacity:.7':'')+'"></i>'+esc(n)+'</span>').join(""))+'<div class="pw-chart" id="nmCmpC"></div>';
 const box=$("nmCmpC"),w=W(box),L=w<520?84:110,R=60,bh=9,gap=4,rh=3*bh+2*gap+14,H=rows.length*rh+22,X=v=>L+(w-L-R)*v/mx;
 let s='<svg viewBox="0 0 '+w+' '+H+'" width="'+w+'" height="'+H+'" class="pw-svg" role="img" aria-label="Generation by type, TWh">';const stp=axis(0,mx,4);
 for(let v=0;v<=mx+1e-9;v+=stp)s+='<line class="g" x1="'+X(v).toFixed(1)+'" x2="'+X(v).toFixed(1)+'" y1="4" y2="'+(H-18)+'"/><text class="xt" x="'+X(v).toFixed(1)+'" y="'+(H-4)+'">'+(+v.toFixed(2))+'</text>';
 s+='<text class="yu" x="'+(w-R+4)+'" y="'+(H-4)+'">TWh</text>';
 rows.forEach(([k,a,b,av],r)=>{const y0=6+r*rh;s+='<text class="yt" x="'+(L-8)+'" y="'+(y0+rh/2-2)+'" style="text-anchor:end">'+TN[k]+'</text><rect x="'+(L-4)+'" y="'+(y0+1)+'" width="3" height="'+(3*bh+2*gap)+'" style="fill:'+TC[k]+'"/>';
  [a,b,av].forEach((v,j)=>{const y=y0+j*(bh+gap);if(isN(v))s+='<rect data-t="'+k+'" x="'+L+'" y="'+y+'" width="'+Math.max(1,X(v)-L).toFixed(1)+'" height="'+bh+'" rx="2" style="fill:'+S[j][1]+(j==2?';opacity:.7':'')+'"/><text class="xt" x="'+(X(v)+4).toFixed(1)+'" y="'+(y+bh-1)+'" style="text-anchor:start">'+v.toFixed(v<10?2:1)+'</text>';});});
 box.innerHTML=s+'</svg>';
 tipBind(box,k=>{const r=rows.find(x=>x[0]===k);return'<b>'+TN[k]+' · '+esc(CN[c])+'</b> <span class="src">TWh</span><br>'+ml(m)+' <b>'+f1(r[1])+'</b><br>'+ml(ly)+' <b>'+f1(r[2])+'</b> ('+sg(pct(r[1],r[2]))+')<br>'+AY+' avg <b>'+f1(r[3])+'</b> ('+sg(pct(r[1],r[3]))+')';});}
function trend(){const el=$("nmTrend"),PC=window.PWChart,c=st.c,g=N.gen[c],n=24,M=N.months.slice(-n),i0=N.months.length-n,ks=N.types.filter(k=>g[k].some(v=>isN(v)&&v>0.005));
 el.innerHTML=PC.cardHead("Monthly electricity generation by type, "+CN[c]+", "+ml(M[0])+" – "+ml(M[n-1]),"TWh","stacked monthly totals · ENTSO-E A75",ks.slice().reverse().map(k=>'<span class="pw-key"><i style="background:'+TC[k]+'"></i>'+TN[k]+'</span>').join(""))+'<div class="pw-chart" id="nmTrC"></div>';
 const box=$("nmTrC"),w=W(box),H=w<520?200:240,Lm=36,Rm=8,T=10,B=22,tots=M.map((_,j)=>tot(c,i0+j)),mx=Math.max(...tots.filter(isN))*1.06,stp=axis(0,mx,4),bw=(w-Lm-Rm)/n,Y=v=>T+(H-T-B)*(1-v/mx);
 let s='<svg viewBox="0 0 '+w+' '+H+'" width="'+w+'" height="'+H+'" class="pw-svg" role="img" aria-label="Monthly generation by type, TWh">';
 for(let v=0;v<=mx;v+=stp)s+='<line class="g" x1="'+Lm+'" x2="'+(w-Rm)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="yt" x="'+(Lm-5)+'" y="'+(Y(v)+3.5).toFixed(1)+'">'+(+v.toFixed(1))+'</text>';
 s+='<text class="yu" x="2" y="9">TWh</text>';
 M.forEach((m,j)=>{let acc=0;const x=Lm+j*bw+bw*.14,bwi=bw*.72;ks.forEach(k=>{const v=g[k][i0+j];if(!isN(v)||v<=0)return;s+='<rect x="'+x.toFixed(1)+'" y="'+Y(acc+v).toFixed(1)+'" width="'+bwi.toFixed(1)+'" height="'+(Y(acc)-Y(acc+v)).toFixed(1)+'" style="fill:'+TC[k]+'"/>';acc+=v;});
  s+='<rect data-t="'+j+'" x="'+(Lm+j*bw).toFixed(1)+'" y="'+T+'" width="'+bw.toFixed(1)+'" height="'+(H-T-B)+'" style="fill:transparent"/>';
  if(m.endsWith("-01")||j===0||(w>=520&&(+m.slice(5))%3===1))s+='<text class="xt" x="'+(x+bwi/2).toFixed(1)+'" y="'+(H-6)+'">'+(m.endsWith("-01")||j===0?ms(m):MO[+m.slice(5)-1])+'</text>';});
 box.innerHTML=s+'</svg>';
 tipBind(box,j=>{j=+j;const m=M[j];return'<b>'+ml(m)+' · '+esc(CN[c])+'</b> <span class="src">TWh</span>'+ks.map(k=>'<br><i class="pw-tk" style="background:'+TC[k]+'"></i>'+TN[k]+' <b>'+f1(g[k][i0+j])+'</b>').join("")+'<br>Total <b>'+f1(tots[j])+'</b>';});}
function inflow(m,AY){const el=$("nmInf"),PC=window.PWChart,I=N.inflow||{};const opts=[["NOSE","Norway + Sweden"],["NO","Norway"],["SE","Sweden"]].filter(o=>I[o[0]]);
 if(!opts.length){el.innerHTML=PC.cardHead("Hydro energy inflow","TWh","not available in this build");return;}if(!I[st.i])st.i=opts[0][0];const a=I[st.i],n=13,M=N.months.slice(-n),i0=N.months.length-n;
 const nm=M.map(x=>avgM(a,x)),v=M.map((_,j)=>a[i0+j]);const lab=opts.find(o=>o[0]===st.i)[1];
 const seg='<div class="seg pw-seg" id="nmInfSeg">'+opts.map(o=>'<button type="button" class="button'+(o[0]===st.i?" is-on":"")+'" data-k="'+o[0]+'">'+o[1]+'</button>').join("")+'</div>';
 el.innerHTML=PC.cardHead("Hydro energy inflow (derived), "+lab+", "+ml(M[0])+" – "+ml(M[n-1])+" vs "+AY+" average","TWh","monthly · reservoir change + hydro generation · % = share of the "+AY+" average for the month",'<span class="pw-key"><i style="background:#4f7cff"></i>Inflow</span><span class="pw-key"><i style="background:var(--muted);height:2px"></i>'+AY+' average</span>',seg)+'<div class="pw-chart" id="nmInfC"></div>';
 el.querySelectorAll("#nmInfSeg button").forEach(b=>b.onclick=()=>{st.i=b.dataset.k;save();inflow(m,AY);});
 const box=$("nmInfC"),w=W(box),H=w<520?200:230,Lm=36,Rm=8,T=16,B=22,lo=Math.min(0,...v.filter(isN),...nm.filter(isN)),mx=Math.max(...v.filter(isN),...nm.filter(isN))*1.12,stp=axis(lo,mx,4),bw=(w-Lm-Rm)/n,Y=x=>T+(H-T-B)*(1-(x-lo)/(mx-lo));
 let s='<svg viewBox="0 0 '+w+' '+H+'" width="'+w+'" height="'+H+'" class="pw-svg" role="img" aria-label="Hydro inflow vs average, TWh">';
 for(let t=Math.ceil(lo/stp)*stp;t<=mx;t+=stp)s+='<line class="'+(t===0?"z":"g")+'" x1="'+Lm+'" x2="'+(w-Rm)+'" y1="'+Y(t).toFixed(1)+'" y2="'+Y(t).toFixed(1)+'"/><text class="yt" x="'+(Lm-5)+'" y="'+(Y(t)+3.5).toFixed(1)+'">'+(+t.toFixed(1))+'</text>';
 s+='<text class="yu" x="2" y="10">TWh</text>';
 M.forEach((x,j)=>{const bx=Lm+j*bw+bw*.16,bwi=bw*.68,vv=v[j],nn=nm[j];if(isN(vv))s+='<rect x="'+bx.toFixed(1)+'" y="'+Math.min(Y(vv),Y(0)).toFixed(1)+'" width="'+bwi.toFixed(1)+'" height="'+Math.abs(Y(0)-Y(vv)).toFixed(1)+'" rx="2" style="fill:#4f7cff'+(j===n-1?'':';opacity:.75')+'"/>';
  if(isN(nn))s+='<line x1="'+(bx-2).toFixed(1)+'" x2="'+(bx+bwi+2).toFixed(1)+'" y1="'+Y(nn).toFixed(1)+'" y2="'+Y(nn).toFixed(1)+'" style="stroke:var(--text);stroke-width:2;opacity:.75"/>';
  if(isN(vv)&&isN(nn)&&nn>0.5)s+='<text class="xt" x="'+(bx+bwi/2).toFixed(1)+'" y="'+(Math.min(Y(vv),Y(nn))-4).toFixed(1)+'" style="font-size:'+(w<520?8.5:10)+'px">'+Math.round(vv/nn*100)+'%</text>';
  s+='<rect data-t="'+j+'" x="'+(Lm+j*bw).toFixed(1)+'" y="'+T+'" width="'+bw.toFixed(1)+'" height="'+(H-T-B)+'" style="fill:transparent"/>';
  if(j%(w<520?3:1)===0||j===n-1)s+='<text class="xt" x="'+(bx+bwi/2).toFixed(1)+'" y="'+(H-6)+'">'+(x.endsWith("-01")||j===0?ms(x):MO[+x.slice(5)-1])+'</text>';});
 box.innerHTML=s+'</svg>';
 tipBind(box,j=>{j=+j;return'<b>'+ml(M[j])+' · '+esc(lab)+'</b> <span class="src">TWh</span><br>Inflow <b>'+f1(v[j])+'</b><br>'+AY+' average <b>'+f1(nm[j])+'</b>'+(isN(v[j])&&isN(nm[j])&&nm[j]>0.5?' ('+Math.round(v[j]/nm[j]*100)+'%)':'');});}
function prices(){const el=$("nmPx"),PC=window.PWChart,M=N.price_months,n=M.length,zs=N.price_zones.filter(z=>N.prices[z]);
 const ser=zs.map(z=>({name:z,color:ZC[z],vals:N.prices[z],w:z==="SE3"||z==="NO1"?2.4:1.6,end:true}));
 el.innerHTML=PC.cardHead("Day-ahead power prices by bidding zone, monthly average, "+ml(M[0])+" – "+ml(M[n-1]),"€/MWh","time-weighted monthly mean of hourly / 15-min day-ahead prices · ENTSO-E A44",PC.keysHtml(ser))+'<div class="pw-chart" id="nmPxC"></div>';
 PC.lineChart($("nmPxC"),{n,series:ser,h:220,yunit:"€/MWh",zero:1,label:"Monthly day-ahead price by zone, €/MWh",xall:1,xlab:i=>i===0||(i>2&&M[i].endsWith("-01"))?ms(M[i]):i>2&&(+M[i].slice(5))%3===1?MO[+M[i].slice(5)-1]:null,
  tip:i=>'<b>'+ml(M[i])+'</b> <span class="src">€/MWh</span>'+ser.map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+s.name+' <b>'+f1(s.vals[i])+'</b>').join("")});}
let rt;addEventListener("resize",()=>{if(!N||!$("pwMonBody")||!$("pwMonBody").offsetParent)return;clearTimeout(rt);rt=setTimeout(draw,200);});
window.MMNordic={render};
})();
