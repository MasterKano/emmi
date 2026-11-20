/* EMMi password gate (Cloudflare Pages Function, runs in front of every path of the "emmi" Pages project).
   Jerry, 20 Nov 2026 (t1448): password only, replacing Cloudflare Access.
   - The password is the Pages secret EMMI_SITE_PASSWORD (set by deploy.yml from the GitHub secret of the same name).
     If it is missing the site stays shut (fail closed).
   - A correct POST to /emmi/__login sets cookie emmi_auth = HMAC-SHA256(password, "emmi-session-v1") in hex:
     derived from the password, never the password itself. HttpOnly, Secure, SameSite=Lax, 30 days. Changing the
     password signs every device out.
   - Wrong guesses wait about a second before the answer.
   - Open without the password: the research calendar feeds (/emmi/research/*.ics) so calendar apps can subscribe,
     and robots.txt. */
const COOKIE = "emmi_auth";
const MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN = "/emmi/__login";
const OPEN = (p) => /^\/emmi\/research\/[A-Za-z0-9_-]+\.ics$/.test(p) || p === "/robots.txt" || p === "/emmi/robots.txt";
const enc = new TextEncoder();

async function sessionToken(pw) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("emmi-session-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookie(req, name) {
  for (const part of (req.headers.get("Cookie") || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}
const safeNext = (n) => (typeof n === "string" && /^\/emmi\/[^\s\\]*$/.test(n) && !n.startsWith("//") && !n.startsWith(LOGIN) ? n : "/emmi/");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(status, next, msg) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="dark light">
<title>EMMi · sign in</title>
<script>try{var m=JSON.parse(localStorage.getItem("markets-monitor:v6")||"null");if(m&&(m.theme==="light"||m.theme==="dark"))document.documentElement.setAttribute("data-theme",m.theme);}catch(e){}</script>
<style>
:root{--bg:#202124;--panel:#303134;--border:#5f6368;--text:#e8eaed;--muted:#9aa0a6;--accent:#8ab4f8;--on-accent:#202124;--bad:#f28b82}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#fff;--panel:#f8f9fa;--border:#dadce0;--text:#202124;--muted:#5f6368;--accent:#1a73e8;--on-accent:#fff;--bad:#d93025}}
:root[data-theme="light"]{--bg:#fff;--panel:#f8f9fa;--border:#dadce0;--text:#202124;--muted:#5f6368;--accent:#1a73e8;--on-accent:#fff;--bad:#d93025}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:"Google Sans",Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
main{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:20px}
form{width:min(100%,360px);display:flex;flex-direction:column;gap:12px;padding:26px 22px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}
h1{margin:0;font-size:30px;font-weight:700;letter-spacing:.5px;text-align:center}
p{margin:0;color:var(--muted);font-size:13px;text-align:center}
input{width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit;font-size:16px}
input:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
button{min-height:44px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:15px;font-weight:650;cursor:pointer}
.err{min-height:16px;color:var(--bad);font-size:13px;text-align:center}
</style></head><body><main>
<form method="post" action="${LOGIN}" autocomplete="on">
<h1>EMMi</h1><p>Energy · minerals · markets · intelligence</p>
<input type="password" name="password" aria-label="Password" placeholder="Password" autocomplete="current-password" required autofocus>
<input type="hidden" name="next" value="${esc(next)}">
<button type="submit">Enter</button>
<div class="err" role="alert">${msg ? esc(msg) : ""}</div>
</form></main>
<script>(function(){var n=document.querySelector('input[name=next]');if(n&&location.hash&&n.value.indexOf("#")<0)n.value+=location.hash;})();</script>
</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "DENY" } });
}

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  if (OPEN(url.pathname)) return next();
  const pw = env.EMMI_SITE_PASSWORD;
  if (!pw) return new Response("EMMi sign-in is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });
  const tok = await sessionToken(pw);

  if (url.pathname === LOGIN) {
    if (request.method !== "POST") return Response.redirect(url.origin + "/emmi/", 303);
    let form;
    try { form = await request.formData(); } catch (e) { form = new FormData(); }
    const dest = safeNext(form.get("next"));
    const given = String(form.get("password") || "");
    if (given && same(await sessionToken(given), tok)) {
      return new Response(null, { status: 303, headers: {
        Location: dest, "Cache-Control": "no-store",
        "Set-Cookie": `${COOKIE}=${tok}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      } });
    }
    await new Promise((r) => setTimeout(r, 1000));
    return page(401, dest, "Wrong password");
  }

  if (same(cookie(request, COOKIE), tok)) return next();

  const accept = request.headers.get("Accept") || "";
  if (request.method === "GET" && (accept.includes("text/html") || accept === "" || accept.includes("*/*")) && !/\.(json|csv|js|css|png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname))
    return page(401, safeNext(url.pathname + url.search), "");
  return new Response("Sign in to EMMi first.", { status: 401, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}
