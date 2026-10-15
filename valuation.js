"use strict";
/* Macro tab: "US equity valuations: then vs now" from data/us_valuation.json (monthly build). Uses window.PWChart. */
(function(){
const $=id=>document.getElementById(id),isN=v=>typeof v==="number"&&isFinite(v),D="—";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lnk=(u,t)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+t+'</a>';
const MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],ml=m=>MO[+m.slice(5,7)-1]+" "+m.slice(0,4),ql=q=>"Q"+(Math.floor((+q.slice(5,7)-1)/3)+1)+" "+q.slice(0,4);
let V=null,busy=null;
function load(){if(V)return Promise.resolve(V);if(busy)return busy;busy=fetch("data/us_valuation.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).then(j=>(V=j)).catch(()=>null);return busy;}
const lastIdx=a=>{for(let i=a.length-1;i>=0;i--)if(isN(a[i]))return i;return -1;};
function thenNow(arr,lab,i,step){/* value at latest index and step*5 / step*10 earlier */const at=k=>k>=0&&isN(arr[k])?[arr[k],lab[k]]:[null,null];return[at(i),at(i-5*step),at(i-10*step)];}
function render(){const box=$("macro-val");if(!box)return;load().then(v=>{if(!v){box.hidden=true;return;}box.hidden=false;draw(v);});}
function draw(v){const box=$("macro-val"),PC=window.PWChart;if(!PC)return;const S=v.shiller,M=v.damodaran,F=v.fred,SP=v.spdji,U=v.us10;
 const dot=window.MMUI?MMUI.dot(v.generated_utc,"monthly","US valuation build (Shiller, Damodaran, S&P DJI, FRED)",null,(v.gaps||[]).join("; ")):"";
 let h='<div class="macro-head sec-h"><h2 class="macro-h">US stock valuations: then vs now</h2><span class="macro-meta">'+dot+'S&amp;P 500 · CAPE · yields · corporate profits</span></div>';
 h+='<section class="pw-card"><div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title">S&amp;P 500 valuation: today vs 5 and 10 years ago</strong><span class="pw-card-sub">each row at its latest published date; "5y / 10y ago" = same month, year or quarter 5 / 10 years earlier</span></div></div><div class="pw-tbl-wrap"><table class="pw-tbl" id="valTbl"></table></div></section>';
 h+='<div class="y10-grid val-grid"><section class="pw-card" id="valYld"></section><section class="pw-card" id="valCape"></section><section class="pw-card" id="valEcy"></section><section class="pw-card" id="valProf"></section></div>';
 h+='<p class="pw-foot">'+(SP?'S&amp;P Dow Jones Indices, '+esc(SP.period)+': dividend yield '+SP.dy+'%, buyback yield '+SP.by+'%, combined '+SP.sy+'%, as-reported earnings yield '+SP.ey+'% (operating '+SP.ey_op+'%); dividends $'+SP.div_bn+' bn, buybacks $'+SP.bb_bn+' bn, market value $'+Math.round(SP.mv_bn).toLocaleString("en-US")+' bn · '+lnk(SP.url,"S&amp;P DJI buyback file")+(SP.stale?' (kept from an earlier build)':'')+'. ':'')+
  'Sources: '+lnk(S?S.url:"https://shillerdata.com/","Robert Shiller, shillerdata.com")+' · '+lnk(M?M.url:"https://pages.stern.nyu.edu/~adamodar/","Aswath Damodaran, NYU Stern")+' · '+lnk("https://fred.stlouisfed.org/series/CP","FRED, St. Louis Fed (BEA)")+(U?' · current US 10Y: '+esc(U.src)+' close '+esc(U.d):'')+'. '+((v.gaps||[]).length?'Not in this build: '+esc(v.gaps.join("; "))+'.':'')+'</p>';
 box.innerHTML=h;
 /* table */const T=[],row=(l,u,src,trip,fmt)=>T.push([l,u,src,trip,fmt]);const f1=x=>isN(x)?x.toFixed(1):D,f2=x=>isN(x)?x.toFixed(2):D;
 if(S){const ic=lastIdx(S.cape),ml2=S.m.map(ml);row("CAPE (Shiller P/E10)","ratio","Shiller",thenNow(S.cape,ml2,ic,12),f1);
  const cy=S.cape.map(c=>isN(c)?100/c:null);row("CAPE earnings yield (1 / CAPE)","%","Shiller",thenNow(cy,ml2,ic,12),f2);
  row("Excess CAPE yield (Shiller, vs real 10Y)","%","Shiller",thenNow(S.ecy,ml2,lastIdx(S.ecy),12),f2);
  row("Trailing earnings yield (E / P)","%","Shiller",thenNow(S.ey,ml2,lastIdx(S.ey),12),f2);row("Dividend yield (D / P)","%","Shiller",thenNow(S.dy,ml2,lastIdx(S.dy),12),f2);
  if(U){const t=thenNow(S.gs10,ml2,ic,12);const e=thenNow(cy,ml2,ic,12);row("1 / CAPE minus nominal US 10Y","pp","Shiller, US Treasury",[[isN(e[0][0])?e[0][0]-U.v:null,"10Y "+U.v+"%, "+U.d],[isN(e[1][0])&&isN(t[1][0])?e[1][0]-t[1][0]:null,e[1][1]],[isN(e[2][0])&&isN(t[2][0])?e[2][0]-t[2][0]:null,e[2][1]]],f2);}}
 if(M){const yl=M.y.map(String);row("Shareholder yield (dividends + buybacks)","%","Damodaran, year end",thenNow(M.sy,yl,lastIdx(M.sy),1),f2);}
 if(F){const qq=F.q.map(ql);row("Corporate profits after tax, % of GDP","%","FRED CP / GDP",thenNow(F.cp_gdp,qq,F.q.length-1,4),f1);row("Corporate net cash flow, % of GDP","%","FRED CNCF / GDP",thenNow(F.cf_gdp,qq,F.q.length-1,4),f1);}
 const pct=S?'<p class="pw-foot pw-pad">CAPE '+f1(S.cape[lastIdx(S.cape)])+' in '+ml(S.m[lastIdx(S.cape)])+' is higher than '+S.cape_pct+'% of all '+S.cape_n.toLocaleString("en-US")+' monthly readings since '+ml(S.cape_from)+'.</p>':"";
 $("valTbl").innerHTML='<thead><tr><th class="c-z">Metric</th><th>Today</th><th>5y ago</th><th>10y ago</th><th class="c-z">Source</th></tr></thead><tbody>'+T.map(([l,u,s,t,fm])=>'<tr><td class="c-z">'+esc(l)+' <span class="pw-mut">'+u+'</span></td>'+t.map(([x,d])=>'<td class="num"><b>'+fm(x)+'</b>'+(d?'<br><span class="pw-mut">'+esc(d)+'</span>':'')+'</td>').join("")+'<td class="c-z pw-mut">'+esc(s)+'</td></tr>').join("")+'</tbody>';
 $("valTbl").closest(".pw-card").insertAdjacentHTML("beforeend",pct);
 /* charts */const xl=(lab,every)=>i=>(i%every===0)?lab[i]:null;
 if(S){const n=S.m.length,ser=[{name:"Earnings yield, trailing (Shiller)",color:"var(--accent)",vals:S.ey},{name:"Dividend yield (Shiller)",color:"var(--good)",vals:S.dy}];
  if(M){const sy=S.m.map(m=>{if(m.slice(5)!=="12")return null;const k=M.y.indexOf(+m.slice(0,4));return k>=0?M.sy[k]:null;});ser.push({name:"Shareholder yield: dividends + buybacks (Damodaran, year end)",color:"var(--pw-de, #e0a030)",vals:sy,dots:1,w:0.01,r:3});}
  $("valYld").innerHTML=PC.cardHead("S&P 500 earnings, dividend and shareholder yield, "+S.m[0].slice(0,4)+"–"+S.m[n-1].slice(0,4),"%","monthly (Shiller) · yearly dots (Damodaran) · "+lnk(S.url,"Shiller")+" · "+lnk(M?M.url:"#","Damodaran"),PC.keysHtml(ser))+'<div class="pw-chart" id="valYldC"></div>';
  PC.lineChart($("valYldC"),{n,series:ser,h:230,yunit:"%",zero:1,label:"S&P 500 yields, %",xlab:i=>S.m[i].endsWith("-01")&&+S.m[i].slice(0,4)%5===0?S.m[i].slice(0,4):null,xall:1,xw:40,
   tip:i=>'<b>'+ml(S.m[i])+'</b> <span class="src">%</span>'+ser.map(s=>isN(s.vals[i])?'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>'+s.vals[i].toFixed(2)+'%</b>':'').join("")});
  const med=(()=>{const a=S.cape.filter(isN).slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)];})();
  const cs=[{name:"CAPE",color:"var(--accent)",vals:S.cape,end:1},{name:"Median "+S.m[0].slice(0,4)+"–"+S.m[n-1].slice(0,4)+" ("+med.toFixed(1)+")",color:"var(--muted)",vals:S.cape.map(()=>med),dash:"3 3",w:1.2}];
  $("valCape").innerHTML=PC.cardHead("S&P 500 cyclically adjusted P/E (CAPE), "+S.m[0].slice(0,4)+"–"+S.m[n-1].slice(0,4),"ratio","monthly · price ÷ 10-year average real earnings · percentile "+S.cape_pct+"% of all months since "+S.cape_from.slice(0,4)+" · "+lnk(S.url,"Shiller"),PC.keysHtml(cs))+'<div class="pw-chart" id="valCapeC"></div>';
  PC.lineChart($("valCapeC"),{n,series:cs,h:230,yunit:"×",label:"S&P 500 CAPE",xlab:i=>S.m[i].endsWith("-01")&&+S.m[i].slice(0,4)%5===0?S.m[i].slice(0,4):null,xall:1,xw:40,tip:i=>'<b>'+ml(S.m[i])+'</b><br>CAPE <b>'+f1(S.cape[i])+'</b>'});
  const es=[{name:"Excess CAPE yield (Shiller)",color:"var(--pw-de, #e0a030)",vals:S.ecy},{name:"US 10Y Treasury, GS10 (Shiller file)",color:"var(--muted)",vals:S.gs10,dash:"4 3",w:1.4},{name:"1 / CAPE",color:"var(--accent)",vals:S.cape.map(c=>isN(c)?100/c:null),w:1.6}];
  $("valEcy").innerHTML=PC.cardHead("S&P 500 excess CAPE yield vs US 10-year yield, "+S.m[0].slice(0,4)+"–"+S.m[n-1].slice(0,4),"%","monthly · excess CAPE yield = 1/CAPE minus the real 10-year yield (Shiller's definition) · "+lnk(S.url,"Shiller"),PC.keysHtml(es))+'<div class="pw-chart" id="valEcyC"></div>';
  PC.lineChart($("valEcyC"),{n,series:es,h:230,yunit:"%",zero:1,label:"Excess CAPE yield and US 10Y, %",xlab:i=>S.m[i].endsWith("-01")&&+S.m[i].slice(0,4)%5===0?S.m[i].slice(0,4):null,xall:1,xw:40,tip:i=>'<b>'+ml(S.m[i])+'</b> <span class="src">%</span>'+es.map(s=>'<br><i class="pw-tk" style="background:'+s.color+'"></i>'+esc(s.name)+' <b>'+f2(s.vals[i])+'%</b>').join("")});}
 if(F){const n=F.q.length,fs=[{name:"Corporate profits after tax (CP)",color:"var(--accent)",vals:F.cp_gdp},{name:"Corporate net cash flow (CNCF)",color:"var(--good)",vals:F.cf_gdp}];
  $("valProf").innerHTML=PC.cardHead("US corporate profits and net cash flow, % of GDP, "+F.q[0].slice(0,4)+"–"+F.q[n-1].slice(0,4),"% of GDP","quarterly, seasonally adjusted annual rates · with inventory valuation adjustment (CP also capital consumption adjustment) · "+lnk(F.url,"FRED / BEA"),PC.keysHtml(fs))+'<div class="pw-chart" id="valProfC"></div>';
  PC.lineChart($("valProfC"),{n,series:fs,h:230,yunit:"%",label:"US corporate profits and cash flow, % of GDP",xlab:i=>F.q[i].endsWith("01-01")&&+F.q[i].slice(0,4)%5===0?F.q[i].slice(0,4):null,xall:1,xw:40,
   tip:i=>'<b>'+ql(F.q[i])+'</b> <span class="src">% of GDP</span><br><i class="pw-tk" style="background:var(--accent)"></i>Profits after tax <b>'+f1(F.cp_gdp[i])+'%</b> ($'+Math.round(F.cp[i]).toLocaleString("en-US")+' bn)<br><i class="pw-tk" style="background:var(--good)"></i>Net cash flow <b>'+f1(F.cf_gdp[i])+'%</b> ($'+Math.round(F.cf[i]).toLocaleString("en-US")+' bn)'});}
 window.MMUI&&MMUI.apply(box);}
let rt;addEventListener("resize",()=>{if(!V||!$("macro-val")||$("macro-val").hidden)return;clearTimeout(rt);rt=setTimeout(()=>draw(V),200);});
window.MMVal={render};
})();
