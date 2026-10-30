/* emmi company 1Y chart, interactive layer (loaded only when a company chart opens, after lightweight-charts.js).
   TradingView Lightweight Charts™ v5.2.1, Copyright (c) TradingView, Inc., Apache License 2.0 (self-hosted copy:
   lightweight-charts.js). The TradingView attribution logo stays on (layout.attributionLogo).
   Data: r.spark = ~90 Yahoo closes over one year with no per-point dates, so point dates are spread evenly between the
   first and last close (shown as "≈ date"), exactly like the SVG line and the CSV download.
   Past research events (exact days) = purple markers. Upcoming calendar items: an exact day = thin purple dashed line;
   a month / quarter / half / year = a shaded window over the whole period the date label names, never a single day. */
(function(){
const LW=window.LightweightCharts,DAY=864e5;let last=null;
const iso=t=>new Date(t).toISOString().slice(0,10);
const css=(n,f)=>(getComputedStyle(document.documentElement).getPropertyValue(n)||"").trim()||f;
const SUF={L:["London"],OL:["Norway","Nordic"],ST:["Nordic"],HE:["Nordic"],CO:["Nordic"],PA:["Paris"],TA:["Tel Aviv"],DE:["Frankfurt"],F:["Frankfurt"],MI:["Milan"]};
const norm=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function upcoming(W,sym){if(!W||!W.companies||!sym)return[];const i=sym.lastIndexOf("."),b=i>0?sym.slice(0,i):sym,x=i>0?sym.slice(i+1):"";
 for(const m of SUF[x]||[])for(const k of [m+"|"+norm(b),m+"|"+norm(sym)])if(W.companies[k])return W.companies[k];return[];}
function draw(box,r,R,W,H){
 const p=r.spark,a=Date.parse(r.spark_from),b=Date.parse(r.bar_date);if(!LW||!p||p.length<2||!(b>a))return false;
 const n=p.length,step=(b-a)/(n-1);
 const up=upcoming(W,r.sym).filter(u=>Date.parse(u.e)>=b-DAY);
 /* future axis: whitespace on the same spacing up to the furthest upcoming item, capped at 9 months after the last close */
 const far=Math.min(b+275*DAY,Math.max(b,...up.map(u=>Date.parse(u.e)+DAY)));
 const T=[];for(let i=0;i<n;i++)T.push(a+step*i);for(let t=b+step;t<=far+step;t+=step)T.push(t);
 const used=new Set(),times=T.map(t=>{let d=iso(t);while(used.has(d)){t+=DAY;d=iso(t);}used.add(d);return d;});
 const lg=t=>{const ms=Date.parse(t);if(ms<=T[0])return(ms-T[0])/step;for(let i=1;i<T.length;i++)if(ms<=T[i])return i-1+(ms-T[i-1])/(T[i]-T[i-1]);return T.length-1+(ms-T[T.length-1])/step;};
 const good=css("--good","#45bd84"),bad=css("--bad","#ef6a70"),vi=css("--violet","#b07cff"),mu=css("--muted","#a0a9ba"),bd=css("--border","#252d3c");
 const hx=(c,d)=>/^#[0-9a-f]{6}$/i.test(c)?c:d,lc=p[n-1]>=p[0]?hx(good,"#45bd84"):hx(bad,"#ef6a70");
 if(last){try{last.remove();}catch(e){}last=null;}
 box.innerHTML='<div class="co-lw"></div><button type="button" class="co-lw-reset" hidden>Reset zoom</button>';
 const el=box.querySelector(".co-lw"),rs=box.querySelector(".co-lw-reset");
 const ch=LW.createChart(el,{autoSize:true,layout:{background:{type:"solid",color:"transparent"},textColor:mu,fontSize:11,attributionLogo:true},
  grid:{vertLines:{visible:false},horzLines:{color:bd}},rightPriceScale:{borderVisible:false,scaleMargins:{top:.18,bottom:.08}},
  timeScale:{borderVisible:false,rightOffset:0,lockVisibleTimeRangeOnResize:true},
  handleScroll:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
  handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:false},axisDoubleClickReset:true},
  crosshair:{mode:LW.CrosshairMode.Magnet,vertLine:{labelBackgroundColor:mu},horzLine:{labelBackgroundColor:mu}},
  localization:{priceFormatter:v=>H.fpx(v),timeFormatter:t=>{const d=typeof t==="object"?Date.UTC(t.year,t.month-1,t.day):typeof t==="number"?t*1e3:Date.parse(t);return(d<=b+DAY?"≈ ":"")+H.dateTxt(iso(d));}}});
 const s=ch.addSeries(LW.AreaSeries,{lineColor:lc,topColor:lc+"47",bottomColor:lc+"00",lineWidth:2,priceLineVisible:false,lastValueVisible:true,crosshairMarkerRadius:3});
 last=ch;
 /* logicalToCoordinate only takes whole indexes: interpolate between neighbours for a date inside a step */
 const X=L=>{const ts=ch.timeScale(),f=Math.floor(L),a0=ts.logicalToCoordinate(f),a1=ts.logicalToCoordinate(f+1);return a0==null||a1==null?null:a0+(L-f)*(a1-a0);};
 s.setData(times.map((t,i)=>i<n?{time:t,value:p[i]}:{time:t}));
 /* past research events -> purple markers on the line (snapped to the nearest plotted point) */
 const ev=R?R.ev.map((e,i)=>({e,i,l:lg(e.d1||e.d)})).filter(q=>q.l>=-.5&&q.l<=n-.5):[];
 if(ev.length&&LW.createSeriesMarkers){const seen={},mk=[];ev.forEach(q=>{const k=Math.max(0,Math.min(n-1,Math.round(q.l)));if(seen[k])return;seen[k]=1;mk.push({time:times[k],position:"inBar",color:vi,shape:"circle",size:1.2});});LW.createSeriesMarkers(s,mk);}
 /* upcoming items grouped by window; label rows so overlapping windows don't share a line */
 const G=[];up.forEach(u=>{const g=G.find(x=>x.s===u.s&&x.e===u.e);if(g)g.it.push(u);else G.push({s:u.s,e:u.e,p:u.p,l:u.l,it:[u]});});
 G.forEach(g=>{g.l0=g.p==="exact"?lg(g.s):lg(g.s)-.5;g.l1=g.p==="exact"?g.l0:lg(iso(Date.parse(g.e)+DAY))-.5;});
 const rows=[];G.slice().sort((x,y)=>x.l0-y.l0).forEach(g=>{let k=rows.findIndex(e=>e<g.l0);if(k<0){k=rows.length;rows.push(0);}rows[k]=g.l1+6;g.row=k;});
 let api=null;const prim={attached(o){api=o;},detached(){api=null;},updateAllViews(){},paneViews(){return[{zOrder:()=>"bottom",renderer:()=>({draw(tg){tg.useBitmapCoordinateSpace(sc=>{
  const c=sc.context,hr=sc.horizontalPixelRatio,vr=sc.verticalPixelRatio,ts=ch.timeScale(),Hh=sc.bitmapSize.height;
  G.forEach(g=>{const x0=X(g.l0),x1=X(g.l1);if(x0==null||x1==null)return;c.save();
   if(g.p==="exact"){c.strokeStyle=vi;c.globalAlpha=g.hot?1:.75;c.lineWidth=Math.max(1,Math.round(hr*(g.hot?2:1)));c.setLineDash([4*hr,3*hr]);c.beginPath();c.moveTo(Math.round(x0*hr),0);c.lineTo(Math.round(x0*hr),Hh);c.stroke();}
   else{c.fillStyle=vi;c.globalAlpha=g.hot?.26:.12;c.fillRect(x0*hr,0,Math.max(1,(x1-x0)*hr),Hh);c.globalAlpha=.45;c.fillRect(x0*hr,0,Math.max(1,hr),Hh);c.fillRect(x1*hr-hr,0,Math.max(1,hr),Hh);}
   c.restore();
   if(x1-x0>30||g.p==="exact"){c.save();c.fillStyle=vi;c.font=(10*vr)+"px system-ui,sans-serif";c.textBaseline="top";const t=(g.p==="exact"?H.dateTxt(g.s).replace(/ \d{4}$/,""):g.l)+(g.it.length>1?" ·"+g.it.length:"");
    c.fillText(t,(Math.max(x0,0)+3)*hr,(7+g.row*13)*vr);c.restore();}});});}})}];}};
 s.attachPrimitive(prim);
 const ts=ch.timeScale(),full={from:-.5,to:T.length-.5},reset=()=>ts.setVisibleLogicalRange(full);reset();
 let rz=false;ts.subscribeVisibleLogicalRangeChange(v=>{if(!v)return;const z=Math.abs(v.from-full.from)>.6||Math.abs(v.to-full.to)>.6;if(z!==rz){rz=z;rs.hidden=!z;}});
 rs.addEventListener("click",reset);
 /* hover / tap: a marker within 10 px -> the research event tip (same as the SVG); inside a window -> its calendar items */
 const tip=document.getElementById("coEvTip");let pin=null,def="";const nE=ev.length,nW=G.length,nS=G.filter(g=>g.p!=="exact").length;
 if(tip){tip.hidden=!(nE||nW);def=(nE||nW?'<span class="co-ev-dot"></span>':"")+[nE?nE+" research events":"",nW?nW+" upcoming dates"+(nS?" ("+nS+" shaded: no exact day yet)":""):""].filter(Boolean).join(" · ")+(nE||nW?" · hover or tap for details":"");tip.innerHTML=def;}
 const hit=pt=>{if(!pt)return null;const x=pt.x;const E=ev.filter(q=>{const xc=ts.logicalToCoordinate(Math.max(0,Math.min(n-1,Math.round(q.l))));return xc!=null&&Math.abs(xc-x)<10;});
  if(E.length)return{k:"e"+E.map(q=>q.i).join(","),h:H.evTip(R,E.map(q=>R.ev[q.i]).reverse())};
  const L=ts.coordinateToLogical(x);if(L==null)return null;const B=G.filter(g=>g.p==="exact"?Math.abs(X(g.l0)-x)<8:L>=g.l0&&L<=g.l1);
  if(!B.length)return null;return{k:"w"+B.map(g=>g.s+g.e).join(","),g:B,h:B.map(g=>'<div class="co-ev-one"><div class="co-ev-meta"><b>'+H.esc(g.l)+'</b> · '+(g.p==="exact"?"upcoming, dated":"window "+H.esc(H.dateTxt(g.s))+" to "+H.esc(H.dateTxt(g.e))+", no exact day given")+'</div>'+
   g.it.map(u=>'<div class="co-ev-h">'+(u.u?H.link(u.u,u.h):H.esc(u.h))+(u.st&&u.st!=="upcoming"?" ("+H.esc(u.st)+")":"")+'</div>').join("")+'</div>').join("")+'<div class="co-ev-meta">Research calendar'+(W&&W.as_of?", as of "+H.esc(H.dateTxt(W.as_of)):"")+'</div>'};};
 const show=h=>{G.forEach(g=>g.hot=false);if(tip){if(!h){tip.innerHTML=def;tip.classList.remove("is-on");}else{tip.innerHTML=h.h;tip.classList.add("is-on");}}if(h&&h.g)h.g.forEach(g=>g.hot=true);api&&api.requestUpdate();};
 ch.subscribeCrosshairMove(q=>{if(!pin)show(hit(q.point));});
 ch.subscribeClick(q=>{const h=hit(q.point);if(h&&pin!==h.k){pin=h.k;show(h);}else{pin=null;show(null);}});
 el.addEventListener("pointerleave",()=>{if(!pin)show(null);});
 return true;}
window.MMCoChart={draw,upcoming};
})();
