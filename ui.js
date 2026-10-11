/* Shared UI helpers: freshness dots, collapsible sections, "How to read" panels, generic sticky sub-nav.
   State (collapsed sections, open explainers) is kept in localStorage; explainers are closed by default. */
(()=>{"use strict";
const LS="markets-monitor:ui:v1",TZ="Europe/Zurich";
const S=(()=>{try{return Object.assign({c:{},d:{}},JSON.parse(localStorage.getItem(LS)||"{}"));}catch(e){return{c:{},d:{}};}})();
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const ftz=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,timeZoneName:"short"});
function tzName(d){const p=ftz.formatToParts(d).find(x=>x.type==="timeZoneName");const v=p?p.value:"";return v==="CET"||v==="CEST"?v:/\+0?2/.test(v)?"CEST":"CET";}
const when=d=>fmt.format(d).replace("Sept","Sep").replace(","," ·")+" "+tzName(d);
/* ---------- freshness: compare the as-of time with the latest scheduled build (UTC schedules of the GitHub workflows) ---------- */
const WD=d=>{const x=d.getUTCDay();return x>0&&x<6;};
const CAD={
 intra:{txt:"every 15 min in market hours (weekdays 05–22 UTC)",delay:20,slots:d=>WD(d)?[...Array(17)].flatMap((_,i)=>[7,22,37,52].map(m=>[5+i,m])):[]},
 power:{txt:"05:30 (weekdays), 12:30 and 17:30 UTC",delay:30,slots:d=>(WD(d)?[[5,30]]:[]).concat([[12,30],[17,30]])},
 news:{txt:"05:30 and 21:00 UTC on weekdays",delay:30,slots:d=>WD(d)?[[5,30],[21,0]]:[]},
 daily:{txt:"once a day, 05:30 UTC on weekdays",delay:45,slots:d=>WD(d)?[[5,30]]:[]},
};
function lastSlots(c,now,n){const out=[];const lim=now-c.delay*6e4;for(let k=0;k<10&&out.length<n;k++){const d=new Date(Date.UTC(new Date(lim).getUTCFullYear(),new Date(lim).getUTCMonth(),new Date(lim).getUTCDate()-k));
 const ts=c.slots(d).map(([h,m])=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),h,m)).filter(t=>t<=lim).sort((a,b)=>b-a);out.push(...ts);}return out.slice(0,n);}
function status(iso,cad,now){const t=Date.parse(iso);if(!isFinite(t))return"stale";const c=CAD[cad]||CAD.daily;const L=lastSlots(c,now||Date.now(),2);
 if(!L.length||t>=L[0]-5*6e4)return"fresh";if(t>=L[1]-5*6e4)return"late";return"stale";}
const SL={fresh:"Fresh",late:"Late: the latest scheduled update is missing",stale:"Stale: two or more scheduled updates are missing"};
function dotTitle(iso,cad,what,st){const t=Date.parse(iso);return(what?what+" · ":"")+(isFinite(t)?"as of "+when(new Date(t)):"as-of time n/a")+" · updates "+(CAD[cad]||CAD.daily).txt+" · "+SL[st];}
/* dot(iso, cadence, what[, forced status, extra note]) -> HTML; refreshed every minute */
function dot(iso,cad,what,force,note){const st=force||status(iso,cad);return'<span class="fd fd-'+st+'" role="img" tabindex="0" data-t="'+esc(iso||"")+'" data-c="'+esc(cad)+'" data-w="'+esc(what||"")+'"'+(force?' data-f="'+force+'"':"")+(note?' data-n="'+esc(note)+'"':"")+' aria-label="'+esc(dotTitle(iso,cad,what,st)+(note?" · "+note:""))+'" title="'+esc(dotTitle(iso,cad,what,st)+(note?" · "+note:""))+'"></span>';}
function refresh(){document.querySelectorAll(".fd[data-c]").forEach(el=>{const st=el.dataset.f||status(el.dataset.t,el.dataset.c);el.className="fd fd-"+st;const t=dotTitle(el.dataset.t,el.dataset.c,el.dataset.w,st)+(el.dataset.n?" · "+el.dataset.n:"");el.title=t;el.setAttribute("aria-label",t);});}
setInterval(refresh,60000);
/* ---------- collapsible sections: [data-sec=id] with a .sec-h header child ---------- */
function setColl(sec,on){sec.classList.toggle("is-collapsed",on);const h=sec.querySelector(":scope > .sec-h");if(h)h.setAttribute("aria-expanded",String(!on));}
function apply(root){(root||document).querySelectorAll("[data-sec]").forEach(s=>{setColl(s,!!S.c[s.dataset.sec]);const h=s.querySelector(":scope > .sec-h");if(h&&!h.hasAttribute("tabindex")){h.tabIndex=0;h.setAttribute("role","button");}});
 (root||document).querySelectorAll("details.explain[id]").forEach(d=>{d.open=!!S.d[d.id];});}
function toggleFrom(h){const s=h.parentElement;if(!s||!s.dataset.sec)return;const on=!s.classList.contains("is-collapsed");setColl(s,on);if(on)S.c[s.dataset.sec]=1;else delete S.c[s.dataset.sec];save();
 if(!on)requestAnimationFrame(()=>dispatchEvent(new Event("resize")));}
document.addEventListener("click",e=>{const h=e.target.closest(".sec-h");if(!h||e.target.closest("a,button,input,select,.fd,.seg"))return;toggleFrom(h);});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("sec-h")){e.preventDefault();toggleFrom(e.target);}});
document.addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches("details.explain[id]")){if(d.open)S.d[d.id]=1;else delete S.d[d.id];save();}},true);
/* ---------- generic sticky sub-nav with scroll spy ---------- */
let NAVI=null;
function subnav(el,items){if(!el)return;NAVI={el,items};el.innerHTML=items.map(([id,l])=>'<a href="#'+id+'" class="pw-nav-a" data-t="'+id+'">'+esc(l)+'</a>').join("");
 el.querySelectorAll("a").forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.t,el);});spy();}
function go(id,el){const t=document.getElementById(id);if(!t)return;const s=t.closest("[data-sec]");if(s&&s.classList.contains("is-collapsed")){setColl(s,false);delete S.c[s.dataset.sec];save();}
 const y=t.getBoundingClientRect().top+scrollY-((el&&el.offsetHeight)||0)-12;scrollTo({top:Math.max(0,y),behavior:"smooth"});}
function spy(){if(!NAVI||!NAVI.el.offsetParent)return;const lim=NAVI.el.offsetHeight+40;let cur=NAVI.items[0]&&NAVI.items[0][0];
 NAVI.items.forEach(([id])=>{const t=document.getElementById(id);if(t&&t.offsetParent&&t.getBoundingClientRect().top<=lim)cur=id;});
 if(innerHeight+scrollY>=document.documentElement.scrollHeight-4&&NAVI.items.length)cur=NAVI.items[NAVI.items.length-1][0];
 NAVI.el.querySelectorAll("a").forEach(a=>{const on=a.dataset.t===cur;a.classList.toggle("is-on",on);if(on)a.setAttribute("aria-current","true");else a.removeAttribute("aria-current");});}
let raf=0;addEventListener("scroll",()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;spy();});},{passive:true});
window.MMUI={dot,refresh,status,when,apply,subnav,spy,go,tzName};
})();
