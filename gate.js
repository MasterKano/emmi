/* EMMA simple password page. Keeps casual visitors out; data files stay public on GitHub.
   Only a salted SHA-256 hash is stored here. To change: re-hash "emma:"+newPassword and replace H. */
(function(){
var H="b6e0165919e79c5c3d8a77ef8d30722856e1bb44b1b08556e11c97c4886c9d1e",K="emmaGate";
var d=document,r=d.documentElement;
try{if(localStorage.getItem(K)===H)return;}catch(e){}
r.classList.add("emma-locked");
var s=d.createElement("style");
s.textContent="html.emma-locked{overflow:hidden}html.emma-locked body{visibility:hidden}"+
"#emmaGate{visibility:visible;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 15% -10%,rgba(79,124,255,.10),transparent 34rem),#0b0f16;color:#e5e9f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}"+
"#emmaGate form{width:min(100%,340px);display:flex;flex-direction:column;gap:12px;padding:26px 22px;border:1px solid #252d3c;border-radius:10px;background:#111722;box-shadow:0 16px 38px rgba(0,0,0,.35)}"+
"#emmaGate h1{margin:0;font-size:28px;letter-spacing:4px;text-align:center}#emmaGate p{margin:0;color:#a0a9ba;font-size:12px;text-align:center}"+
"#emmaGate input{min-height:42px;padding:8px 12px;border:1px solid #364157;border-radius:6px;background:#0d131d;color:#e5e9f0;font-size:16px;width:100%;box-sizing:border-box}#emmaGate input:focus{outline:none;border-color:#4f7cff}"+
"#emmaGate button{min-height:42px;border:1px solid #4f7cff;border-radius:6px;background:#4f7cff;color:#fff;font-size:15px;font-weight:650;cursor:pointer}"+
"#emmaGate .err{min-height:16px;color:#ef6a70;font-size:12.5px;text-align:center}";
(d.head||r).appendChild(s);
function hex(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("")}
function show(){
 var g=d.createElement("div");g.id="emmaGate";
 g.innerHTML='<form autocomplete="on"><h1>EMMA</h1><p>Energy · Minerals · Market · Analysis</p><input type="password" name="password" aria-label="Password" placeholder="Password" autocomplete="current-password" required autofocus><button type="submit">Enter</button><div class="err" role="alert"></div></form>';
 d.body.appendChild(g);
 var f=g.querySelector("form"),i=g.querySelector("input"),e=g.querySelector(".err");i.focus();
 f.addEventListener("submit",function(ev){ev.preventDefault();e.textContent="";
  crypto.subtle.digest("SHA-256",new TextEncoder().encode("emma:"+i.value)).then(function(b){
   if(hex(b)===H){try{localStorage.setItem(K,H)}catch(x){}g.remove();s.remove();r.classList.remove("emma-locked");window.dispatchEvent(new Event("resize"));}
   else{e.textContent="Wrong password";i.value="";i.focus();}
  });
 });
}
if(d.body)show();else d.addEventListener("DOMContentLoaded",show);
})();
