/* Workspace links follow server-verified membership, never localStorage or a hidden-button permission check. */
(function () {
  'use strict';
  const names = {orron:'Orrön',lundin:'Lundin',oilgas:'Oil & Gas',personal:'My Desk'};
  const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function init() {
    const nav = document.getElementById('workspaceNav'); if (!nav) return;
    let spaces = [], sharedWithSite = false; try { const r = await fetch('/emmi/api/workspaces',{cache:'no-store',redirect:'error'}); if (r.ok) { const d = await r.json(); spaces = (d.spaces||[]).filter(s=>names[s]); sharedWithSite = d.sharing === 'site'; } } catch {}
    nav.innerHTML = spaces.map(s=>'<a href="/emmi/'+s+'/">'+(['personal','oilgas'].includes(s)?'<span aria-hidden="true">⌑</span> ':'')+names[s]+'</a>').join(''); nav.hidden = !spaces.length;
    const match = /^\/emmi\/(orron|lundin|oilgas|personal)(?:\/|$)/.exec(location.pathname); if (!match) return;
    const space = match[1]; if (!spaces.includes(space)) return;
    const host = document.getElementById('workspaceView'); if (!host) return;
    document.body.classList.add('view-workspace'); host.hidden = false;
    const shared = '/emmi/';
    const link = (title,url)=>'<a class="workspace-item" href="'+url+'">'+title+' <span>→</span></a>';
    host.innerHTML = '<div class="lp"><header class="lp-head"><div><p class="kicker">'+(sharedWithSite?'Shared with EMMi users':['personal','oilgas'].includes(space)?'Private · your account':'Your workspace')+'</p><h1>'+names[space]+'</h1></div><a href="'+shared+'#briefs/live">Live Pulse →</a></header><div class="workspace-content"></div></div>';
    const content = host.querySelector('.workspace-content');
    if (space==='orron') content.innerHTML = '<section class="block"><h2>Nordic power</h2>'+link('Prices & curves',shared+'#energy/prices')+link('Hydro · wind · nuclear',shared+'#energy/generation')+link('Reservoirs',shared+'#energy/hydro')+'</section><section class="block"><h2>Companies & demand</h2>'+link('Orrön Energy',shared+'#co=ORRON.ST')+link('Cloudberry',shared+'#co=CLOUD.OL')+link('Data centres',shared+'#energy/grid/gdDC')+'</section>';
    else if (space==='lundin') {
      content.innerHTML = '<section class="block"><h2>Commodity curves</h2>'+link('NY Harbor ULSD · all contracts',shared+'v2/curves/#ho')+link('WTI · all contracts',shared+'v2/curves/#wti')+'</section><section class="block"><h2>Lundin companies</h2><div class="workspace-group">Loading group prices…</div>'+link('Upcoming catalysts',shared+'#events')+link('Research',shared+'research/#coming')+'</section>';
      try { let r = await fetch('/emmi/ed/live/data/market.json',{cache:'no-cache'}); if (!r.ok) r = await fetch('/emmi/data/market.json',{cache:'no-cache'}); if (!r.ok) throw Error(); const market = await r.json(), group = (market.groups||[]).find(g=>g.id==='lundin'), seen = new Set();
        const rows = (group&&group.sections||[]).flatMap(s=>s.rows||[]).filter(r=>{if(r.kind!=='equity'||seen.has(r.sym))return false;seen.add(r.sym);return true});
        content.querySelector('.workspace-group').innerHTML = rows.length ? rows.map(r=>link(esc(r.name)+' <small>'+esc(window.EMMIBrief.price(r))+'</small>',shared+'#co='+encodeURIComponent(r.sym))).join('') : link('Group research',shared+'#companies/mining');
      } catch { content.querySelector('.workspace-group').innerHTML = link('Open group research',shared+'#companies/mining'); }
    }
    else {
      content.innerHTML = '<section class="block"><h2>'+(space==='personal'?'Research notebook':'Upcoming activities')+'</h2><div class="workspace-notes">Loading your notes…</div></section>';
      const notes = content.querySelector('.workspace-notes');
      try { const r = await fetch('/emmi/'+space+'/data/notes.json',{cache:'no-store',redirect:'error'}); if (r.status===404) {notes.textContent='No notes added yet.';return;} if (!r.ok) throw Error(); const d = await r.json(); notes.innerHTML = (d.notes||[]).map(n=>'<details class="workspace-note"><summary>'+esc(n.title)+'</summary><p>'+esc(n.text)+'</p>'+(n.company?link('Shared company facts',shared+'#co='+encodeURIComponent(n.company)):'')+'</details>').join('') || 'No notes added yet.'; }
      catch {notes.textContent='Your notes could not be loaded.';}
    }
  }
  init();
})();
