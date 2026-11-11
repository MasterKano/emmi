#!/usr/bin/env python3
"""Publish only a checked edition, through an isolated branch + green PR + merge. No email."""
import datetime as dt, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
from zoneinfo import ZoneInfo
REPO = Path(os.environ.get('EMMI_REPO', '/workspace/emmi-pulse-auto')).resolve()
REMOTE = 'MasterKano/emmi'
ZRH = ZoneInfo('Europe/Zurich')
def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()
def validate(out):
    raw = (out / 'validation.json').read_bytes()
    v = json.loads(raw)
    if v.get('status') != 'PASS' or v.get('failures'): raise ValueError('HELD: no validated edition; publication refused')
    if (out / 'CHECK_PASS').read_text().strip() != hashlib.sha256(raw).hexdigest(): raise ValueError('Validation marker mismatch')
    now = dt.datetime.now(ZRH)
    if v['run_date'] != str(now.date()): raise ValueError('Edition date is not today in Zurich')
    if not 0 <= (now - dt.datetime.fromisoformat(v['built_at'])).total_seconds() < 7200: raise ValueError('Build older than two hours; rebuild')
    names = ['index.html'] + v['images']
    for name in names:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', name) or (out / name).is_symlink(): raise ValueError('Unsafe public path')
        if hashlib.sha256((out / name).read_bytes()).hexdigest() != v['artifacts'][name]: raise ValueError('Checked artifact changed: ' + name)
    return v, names

def main():
    out = Path(sys.argv[1]).resolve()
    v, names = validate(out)
    day = v['run_date']
    if run('git', 'remote', 'get-url', 'origin', cwd=REPO) != 'https://github.com/MasterKano/emmi.git': raise ValueError('Wrong publishing repository')
    run('git', 'fetch', 'origin', 'main', cwd=REPO)
    exists = subprocess.run(['git','cat-file','-e',f'origin/main:pulse/{day}/index.html'], cwd=REPO, capture_output=True).returncode == 0
    if exists:
        print(f'{day} already archived; immutable edition kept, nothing published')
        return
    tmp = Path(tempfile.mkdtemp(prefix='pulse-publish-')) / 'repo'
    branch = f'pulse-auto/{day}-{dt.datetime.now(ZRH):%H%M%S}'
    run('git', 'worktree', 'add', '-b', branch, str(tmp), 'origin/main', cwd=REPO)
    try:
        if not (tmp / 'scripts/pulse_auto/README.md').exists(): raise ValueError('Pilot infrastructure must be merged first')
        root = tmp / 'pulse'; dst = root / day
        dst.mkdir(parents=True)
        for name in names: shutil.copy2(out / name, dst / name)
        public = (dst / 'index.html').read_text()
        (root / 'index.html').write_text(public)
        dates = sorted((p.name for p in root.iterdir() if re.fullmatch(r'\d{4}-\d{2}-\d{2}',p.name) and (p/'index.html').exists()), reverse=True)
        archive = root / 'archive'; archive.mkdir(exist_ok=True)
        items = ''.join(f'<li><a style="color:#fbbf24" href="/emmi/pulse/{d}/">{d} · numbers-only Pulse</a></li>' for d in dates)
        (archive / 'index.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pulse archive</title></head><body style="background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;margin:20px;max-width:600px"><h1>Market Pulse archive</h1><a style="color:#fbbf24" href="/emmi/pulse/">Latest</a><ul>'+items+'</ul></body></html>')
        run('git','add','pulse',cwd=tmp)
        run('git','commit','-m',f'Publish checked numbers-only Pulse {day}',cwd=tmp)
        run('git','push','origin',branch,cwd=tmp)
        url = run('gh','pr','create','--repo',REMOTE,'--base','main','--head',branch,'--title',f'Pulse {day}: checked numbers-only pilot','--body',f'Parallel pilot. Locked master v1.2, fresh-data and 375/390px checks passed. Data session {v["last_close"]}. No email, no bot calls, existing weekday routine unchanged.',cwd=tmp)
        print(url, flush=True)
        number = url.rsplit('/',1)[-1]
        for _ in range(90):
            pr = json.loads(run('gh','pr','view',number,'--repo',REMOTE,'--json','mergeable,statusCheckRollup,headRefOid',cwd=tmp))
            checks = pr['statusCheckRollup']
            live = [c for c in checks if c.get('status') != 'COMPLETED']
            bad = [c for c in checks if c.get('status') == 'COMPLETED' and c.get('conclusion') not in ('SUCCESS','SKIPPED','NEUTRAL')]
            if bad: raise RuntimeError('PR checks failed: ' + json.dumps(bad))
            if checks and any(c.get('name') == 'build' and c.get('conclusion') == 'SUCCESS' for c in checks) and not live and pr['mergeable'] == 'MERGEABLE':
                run('gh','pr','merge',number,'--repo',REMOTE,'--merge','--match-head-commit',pr['headRefOid'],cwd=tmp)
                print('Merged '+url)
                (out/'publication.json').write_text(json.dumps(dict(pr=url,latest='https://masterkano.github.io/emmi/pulse/',archive=f'https://masterkano.github.io/emmi/pulse/{day}/'),indent=2))
                return
            time.sleep(10)
        raise RuntimeError('PR checks or mergeability not ready within 15 minutes; left PR open')
    finally:
        run('git','worktree','remove',str(tmp),cwd=REPO)
if __name__ == '__main__': main()
