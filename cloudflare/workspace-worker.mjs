/* Pages advanced-mode worker. Shared static pages keep their existing Cloudflare Access gate.
   Workspace pages, data, attachments and navigation are authorised server-side, fail closed. */
const SPACES = ['orron', 'lundin', 'oilgas', 'personal'];
const keys = new Map();
function json(data, status = 200) { return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, Cf-Access-Jwt-Assertion','X-Content-Type-Options':'nosniff'}}); }
function decode(part) { const raw = atob(part.replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(raw, c=>c.charCodeAt(0)); }
function config(env) {
  try { const c = JSON.parse(env.EMMI_WORKSPACES || '{}'); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; } catch { return {}; }
}
async function identity(request, env) {
  const team = String(env.EMMI_ACCESS_TEAM_DOMAIN || '').replace(/^https:\/\//,'').replace(/\/$/,'');
  const audiences = String(env.EMMI_ACCESS_AUD || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team) || !audiences.length) return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return null;
  try {
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))), claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now()/1000, aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== 'https://' + team || !aud.some(a=>audiences.includes(a)) || !Number.isFinite(claims.exp) || claims.exp <= now || claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30) || claims.iat != null && (!Number.isFinite(claims.iat) || claims.iat > now + 30) || !claims.email || claims.type && claims.type !== 'app') return null;
    let cached = keys.get(team);
    if (!cached || cached.until < Date.now() || !cached.jwks.some(k=>k.kid===header.kid)) {
      const response = await fetch('https://' + team + '/cdn-cgi/access/certs'); if (!response.ok) return null;
      const data = await response.json(); if (!Array.isArray(data.keys)) return null;
      cached = {jwks:data.keys, until:Date.now()+5*60000}; keys.set(team,cached);
    }
    const jwk = cached.jwks.find(k=>k.kid===header.kid && k.kty==='RSA'); if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) return null;
    const email = String(claims.email).toLowerCase().trim();
    return /^[^@\s]+@[^@\s]+$/.test(email) ? email : null;
  } catch { return null; }
}
function allowed(space, email, env) {
  if (!email) return false;
  const rule = config(env)[space]; if (!rule || typeof rule !== 'object') return false;
  if (Array.isArray(rule.emails) && rule.emails.some(e=>typeof e==='string' && e.toLowerCase().trim()===email)) return true;
  // Personal research and upcoming activities are individual-email only.
  if (space === 'personal' || space === 'oilgas') return false;
  const domain = email.split('@')[1];
  return Array.isArray(rule.domains) && rule.domains.some(d=>typeof d==='string' && d.toLowerCase().replace(/^@/,'').trim()===domain);
}
async function fetchRequest(request, env) {
  const url = new URL(request.url);
  let path; try { path = decodeURIComponent(url.pathname); } catch { return json({error:'Invalid path'},400); }
  if (path.includes('\\') || path.includes('%') || path.split('/').some(x=>x==='.'||x==='..')) return json({error:'Invalid path'},400);
  const match = /^\/emmi\/(orron|lundin|oilgas|personal)(?:\/|$)/.exec(path);
  if (!match && path !== '/emmi/api/workspaces') return env.ASSETS.fetch(request);
  if (!['GET','HEAD'].includes(request.method)) return json({error:'Read-only'},405);
  const email = await identity(request,env);
  if (path === '/emmi/api/workspaces') return json({spaces:SPACES.filter(s=>allowed(s,email,env))});
  const space = match[1];
  if (!allowed(space,email,env)) return json({error:'This workspace is not available to this account.'},403);
  if (path.includes('/data/') || path.includes('/files/')) {
    if (!env.EMMI_PRIVATE || !['personal','oilgas'].includes(space)) return json({error:'No private file at this address.'},404);
    const key = path.slice('/emmi/'.length);
    const object = await env.EMMI_PRIVATE.get(key); if (!object) return json({error:'No private file at this address.'},404);
    const headers = new Headers({'Cache-Control':'private, no-store','Vary':'Cookie, Cf-Access-Jwt-Assertion','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control','private, no-store');
    return new Response(request.method==='HEAD'?null:object.body,{headers});
  }
  if (path !== '/emmi/' + space && path !== '/emmi/' + space + '/' && path !== '/emmi/' + space + '/index.html') return json({error:'Not found'},404);
  // Shell and shared facts contain no private material; all private data is read only from the protected prefix above.
  const asset = new URL('/emmi/index.html',url);
  const response = await env.ASSETS.fetch(new Request(asset,request));
  const headers = new Headers(response.headers); headers.set('Cache-Control','private, no-store'); headers.set('Vary','Cookie, Cf-Access-Jwt-Assertion');
  const html = request.method === 'HEAD' ? null : (await response.text()).replace('<head>','<head><base href="/emmi/">');
  return new Response(html,{status:response.status,headers});
}
export { identity, allowed, fetchRequest };
export default { async fetch(request,env) { try { return await fetchRequest(request,env); } catch { return json({error:'Workspace temporarily unavailable'},503); } } };
