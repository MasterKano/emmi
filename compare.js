"use strict";
/* Compare 2-5 tracked companies side by side. Reuses data already loaded by the site:
   data/market.json rows (1-year sampled closes "spark", returns, mcap/EV in EUR) and data/companies.json (valuation).
   No new data files. Opened from the "Compare" button on the Equities tab; selection kept in localStorage. */
(function(){
const $=id=>document.getElementById(id),KEY="markets-monitor:compare:v1",MAX=5,COL=["#4ea1ff","#f0b429","#4eb868","#e5484d","#b07cff"];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isN=v=>typeof v==="number"&&isFinite(v),D="—";
let sel=[],per="1Y",CO=null;function restore(){try{const s=JSON.parse(localStorage.getItem(KEY)||"{}");sel=(s.sel||[]).slice(0,MAX);per=s.per||"1Y";}catch(e){}}restore();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({sel,per}));}catch(e){}};
const PER=[["1M",1],["3M",3],["6M",6],["1Y",12]];
function rows(){const d=window.MMTable&&MMTable.data&&MMTable.data();if(!d)return[];const m=new Map();
 d.groups.forEach(g=>g.sections.forEach(s=>s.rows.forEach(r=>{if(r.kind==="equity"&&!m.has(r.sym))m.set(r.sym,Object.assign({grp:g.label},r));})));return[...m.values()].sort((a,b)=>a.name.localeCompare(b.name));}
function loadCo(){if(CO)return Promise.resolve(CO);return fetch("data/companies.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.ok?r.json():null).then(j=>(CO=j&&j.companies||{})).catch(()=>(CO={}));}
const big=v=>!isN(v)?D:Math.abs(v)>=1e9?(v/1e9).toFixed(Math.abs(v)>=1e11?0:1)+" bn":(v/1e6).toFixed(0)+" m";
const mult=v=>isN(v)?(v>=100?v.toFixed(0):v.toFixed(1))+"×":D,pc=(v,d)=>isN(v)?(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(d==null?1:d)+"%":D;
const fd=s=>{const d=new Date(s+"T12:00:00Z");return isNaN(d)?s:d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});};
/* spark = closes sampled every ~2 trading days over 1 year (latest point exact); map each point to an approximate date */
function series(r){const p=r.spark||[],n=p.length;if(n<2||!r.spark_from||!r.bar_date)return null;const t0=Date.parse(r.spark_from+"T12:00:00Z"),t1=Date.parse(r.bar_date+"T12:00:00Z");
 return p.map((v,i)=>[t0+(t1-t0)*i/(n-1),v]);}
function at(S,t){if(t<=S[0][0])return S[0][1];for(let i=1;i<S.length;i++)if(S[i][0]>=t){const[a,va]=S[i-1],[b,vb]=S[i];return va+(vb-va)*(t-a)/(b-a);}return S[S.length-1][1];}
function chart(R){const box=$("cmpChart");const ser=R.map((r,i)=>({r,c:COL[i],S:series(r)})).filter(x=>x.S);if(!ser.length){box.innerHTML='<div class="pw-empty">No price history.</div>';return;}
 const t1=Math.max(...ser.map(x=>x.S[x.S.length-1][0])),m=PER.find(p=>p[0]===per)[1],d=new Date(t1);d.setUTCMonth(d.getUTCMonth()-m);const t0=per==="1Y"?Math.max(...ser.map(x=>x.S[0][0])):Math.max(d.getTime(),Math.max(...ser.map(x=>x.S[0][0])));
 const N=80,ts=[...Array(N)].map((_,i)=>t0+(t1-t0)*i/(N-1));ser.forEach(x=>{const b=at(x.S,t0);x.v=ts.map(t=>t>x.S[x.S.length-1][0]+864e5*4?null:at(x.S,t)/b*100);});
 const all=ser.flatMap(x=>x.v.filter(isN));let lo=Math.min(...all,100),hi=Math.max(...all,100);const pad=(hi-lo)*.06||1;lo-=pad;hi+=pad;
 const W=Math.max(300,box.clientWidth||700),H=W<520?230:290,M={l:42,r:12,t:22,b:26},X=i=>M.l+i/(N-1)*(W-M.l-M.r),Y=v=>M.t+(1-(v-lo)/(hi-lo))*(H-M.t-M.b);
 const st=(hi-lo)/4,step=[1,2,5,10,20,25,50,100].find(s=>s>=st/1.2)||100;let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" class="pw-svg" role="img" aria-label="Rebased share price, 100 at period start">';
 for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step)s+='<line class="g" x1="'+M.l+'" x2="'+(W-M.r)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="yt" x="'+(M.l-6)+'" y="'+(Y(v)+3.5).toFixed(1)+'">'+v+'</text>';
 s+='<line class="z" x1="'+M.l+'" x2="'+(W-M.r)+'" y1="'+Y(100).toFixed(1)+'" y2="'+Y(100).toFixed(1)+'"/><text class="yu" x="2" y="12">index, start = 100</text>';
 const xl=[0,Math.round(N/3),Math.round(2*N/3),N-1];xl.forEach(i=>{s+='<text class="xt" x="'+X(i).toFixed(1)+'" y="'+(H-M.b+14)+'">'+esc(new Date(ts[i]).toLocaleDateString("en-GB",{day:"numeric",month:"short"}))+'</text>';});
 ser.forEach(x=>{let p="",on=0;x.v.forEach((v,i)=>{if(!isN(v)){on=0;return;}p+=(on?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1);on=1;});s+='<path class="ln" d="'+p+'" style="stroke:'+x.c+';stroke-width:2"/>';});
 s+='<line class="hair" x1="0" x2="0" y1="'+M.t+'" y2="'+(H-M.b)+'" visibility="hidden"/><rect class="hit" x="'+M.l+'" y="'+M.t+'" width="'+(W-M.l-M.r)+'" height="'+(H-M.t-M.b)+'" fill="transparent"/></svg>';
 box.innerHTML=s;if(window.MMUI&&MMUI.series)MMUI.series(box,{src:"Yahoo daily closes, rebased to 100 at period start",name:"compare "+per,asof:(window.MMTable&&MMTable.data&&MMTable.data()||{}).generated_utc},i=>new Date(ts[i]).toISOString().slice(0,10),N,ser.map(x=>({name:x.r.name+" ("+x.r.sym+")",vals:x.v.map(v=>v==null?null:+v.toFixed(2))})));
 const svg=box.querySelector("svg"),hair=svg.querySelector(".hair"),tip=$("cmpTip");
 svg.querySelector(".hit").addEventListener("pointermove",e=>{const r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(N-1,Math.round(((e.clientX-r.left)*W/r.width-M.l)/(W-M.l-M.r)*(N-1))));hair.setAttribute("x1",X(i));hair.setAttribute("x2",X(i));hair.setAttribute("visibility","visible");
  tip.innerHTML='<b>≈ '+esc(new Date(ts[i]).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}))+'</b> · index, start = 100'+ser.map(x=>'<br><i style="background:'+x.c+'"></i>'+esc(x.r.name)+' <b>'+(isN(x.v[i])?x.v[i].toFixed(1):D)+'</b> ('+pc(isN(x.v[i])?x.v[i]-100:null)+')').join("");tip.hidden=false;
  const bx=box.getBoundingClientRect();tip.style.left=Math.min(bx.width-230,Math.max(0,e.clientX-bx.left+12))+"px";tip.style.top=(e.clientY-bx.top+12)+"px";});
 svg.querySelector(".hit").addEventListener("pointerleave",()=>{hair.setAttribute("visibility","hidden");tip.hidden=true;});
 $("cmpSub").textContent=fd(new Date(t0).toISOString().slice(0,10))+" – "+fd(new Date(t1).toISOString().slice(0,10))+" · closes sampled about every 2 trading days (Yahoo Finance), local currency, price return; dates approximate";}
function table(R){const c=s=>(CO&&CO[s])||{};const L=[
 ["Last price",r=>isN(r.px)?r.px.toLocaleString("en-US",{maximumFractionDigits:r.px>=1000?0:2})+" "+esc(r.ccy||""):D,"local currency"],
 ["Market cap",r=>big(r.mcap_eur),"EUR"],["Enterprise value",r=>big(r.ev_eur),"EUR"],
 ["P/E (trailing)",r=>mult((c(r.sym).val||{}).pe),""],["P/E (forward)",r=>mult((c(r.sym).val||{}).pe_fwd),""],
 ["EV / EBITDA",r=>mult((c(r.sym).val||{}).ev_ebitda),""],["EV / revenue",r=>mult((c(r.sym).val||{}).ev_rev),""],["Price / book",r=>mult((c(r.sym).val||{}).pb),""],
 ["Dividend yield",r=>pc((c(r.sym).val||{}).dy),"%"],["FCF yield",r=>pc((c(r.sym).val||{}).fcf_y),"%"],
 ["Net debt",r=>{const v=c(r.sym).val||{};return isN(v.nd)?big(v.nd)+" "+esc(c(r.sym).fin_ccy||""):D;},"reporting currency"],
 ["Beta",r=>{const b=(c(r.sym).mkt||{}).beta;return isN(b)?b.toFixed(2):D;},""],
 ["Return 1M",r=>pc((r.pct||{})["1M"]),"%"],["Return 6M",r=>pc((r.pct||{})["6M"]),"%"],["Return 1Y",r=>pc((r.pct||{})["1Y"]),"%"],
 ["Analyst target upside",r=>pc((c(r.sym).cons||{}).upside),"%"],["Next earnings",r=>{const e=(c(r.sym).dates||{}).earnings;return e?esc(fd(e)):D;},""]];
 $("cmpTbl").innerHTML='<thead><tr><th class="c-z">Metric</th>'+R.map((r,i)=>'<th><i class="cmp-k" style="background:'+COL[i]+'"></i>'+esc(r.name)+'<br><span class="pw-mut">'+esc(r.sym)+'</span></th>').join("")+'</tr></thead><tbody>'+
  L.map(([l,f,u])=>'<tr><td class="c-z">'+l+(u?' <span class="pw-mut">'+u+'</span>':'')+'</td>'+R.map(r=>'<td class="num">'+f(r)+'</td>').join("")+'</tr>').join("")+'</tbody>';}
function render(){const all=rows(),by=new Map(all.map(r=>[r.sym,r]));sel=sel.filter(s=>by.has(s));const R=sel.map(s=>by.get(s));
 $("cmpChips").innerHTML=R.map((r,i)=>'<button type="button" class="cmp-chip" data-x="'+esc(r.sym)+'" title="Remove"><i style="background:'+COL[i]+'"></i>'+esc(r.name)+' ×</button>').join("")+(R.length<MAX?'<select id="cmpAdd" aria-label="Add a company"><option value="">+ Add company ('+R.length+'/'+MAX+')</option>'+all.filter(r=>!sel.includes(r.sym)).map(r=>'<option value="'+esc(r.sym)+'">'+esc(r.name)+' ('+esc(r.sym)+')</option>').join("")+'</select>':"");
 $("cmpPer").innerHTML=PER.map(([k])=>'<button type="button" class="button'+(k===per?" is-on":"")+'" data-p="'+k+'">'+k+'</button>').join("");
 const ok=R.length>=2;$("cmpBody").hidden=!ok;$("cmpHint").hidden=ok;
 $("cmpTitle").textContent="Share price performance, rebased to 100"+(ok?" · "+per:"");
 $("cmpKeys").innerHTML=ok?R.map((r,i)=>'<span class="cmp-key"><i class="cmp-k" style="background:'+COL[i]+'"></i>'+esc(r.name)+'</span>').join(""):"";
 if(ok){chart(R);loadCo().then(()=>table(R));}}
function build(){if($("cmpLayer"))return;const L=document.createElement("div");L.id="cmpLayer";L.className="cmp-layer";L.hidden=true;L.innerHTML=
 '<div class="cmp-back" data-close></div><section class="cmp-panel" role="dialog" aria-modal="true" aria-labelledby="cmpH"><header class="cmp-head"><h2 id="cmpH">Compare companies</h2><button type="button" class="button" data-close>Close</button></header>'+
 '<div class="cmp-pick"><div id="cmpChips" class="cmp-chips"></div></div><p class="pw-foot" id="cmpHint">Pick 2 to 5 tracked companies.</p>'+
 '<div id="cmpBody"><div class="pw-card"><div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title" id="cmpTitle"></strong><span class="pw-card-sub" id="cmpSub"></span></div><div class="seg pw-seg" id="cmpPer"></div></div><div class="pw-keys pw-pad" id="cmpKeys"></div><div class="cmp-chart-wrap"><div id="cmpChart"></div><div id="cmpTip" class="cmp-tip" hidden></div></div></div>'+
 '<div class="pw-card cmp-card2"><div class="pw-card-head"><div class="pw-ttl"><strong class="panel-title">Key metrics</strong><span class="pw-card-sub">market cap and EV converted to EUR; valuation from Yahoo Finance (may be incomplete for small caps); returns are price returns in local currency from daily closes, so they can differ slightly from the sampled chart</span></div></div><div class="pw-tbl-wrap"><table class="pw-tbl cmp-tbl" id="cmpTbl"></table></div></div></div></section>';
 document.body.append(L);
 L.addEventListener("click",e=>{const t=e.target;if(t.closest("[data-close]")){close();return;}const x=t.closest("[data-x]");if(x){sel=sel.filter(s=>s!==x.dataset.x);save();render();return;}const p=t.closest("[data-p]");if(p){per=p.dataset.p;save();render();}});
 L.addEventListener("change",e=>{if(e.target.id==="cmpAdd"&&e.target.value&&sel.length<MAX){sel.push(e.target.value);save();render();}});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!L.hidden)close();});
 let rt;addEventListener("resize",()=>{if(L.hidden)return;clearTimeout(rt);rt=setTimeout(render,150);});}
function open(){restore();build();const L=$("cmpLayer");L.hidden=false;document.body.classList.add("cmp-open");render();}
function close(){const L=$("cmpLayer");if(L)L.hidden=true;document.body.classList.remove("cmp-open");}
function button(){const f=$("tblFilter");if(!f||$("cmpBtn"))return;const b=document.createElement("button");b.id="cmpBtn";b.type="button";b.className="button";b.textContent="Compare";b.title="Compare 2–5 companies side by side";b.onclick=open;f.before(b);}
button();window.MMCompare={open,close};
})();
