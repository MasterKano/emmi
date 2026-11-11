#!/usr/bin/env python3
"""Publish only a checked edition, through an isolated branch + green PR + merge. No email."""
import datetime as dt, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
import requests
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

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(value, indent=2)); os.replace(tmp, path)

def public_ready(day, expected_html, limit=60):
    """Never call a merged PR 'published' before both real public URLs serve that exact edition."""
    urls = ['https://masterkano.github.io/emmi/pulse/', f'https://masterkano.github.io/emmi/pulse/{day}/']
    deadline = time.monotonic() + limit
    while True:
        responses = [requests.get(url, params={'verify': str(time.time_ns())}, timeout=10) for url in urls]
        if all(r.status_code == 200 and r.content == expected_html for r in responses):
            return dict(archive_url=urls[1])
        if time.monotonic() >= deadline: raise RuntimeError('PR is merged but public latest/archive are not ready; next invocation will reconcile them')
        time.sleep(5)

def existing_publication(day):
    if run('git', 'remote', 'get-url', 'origin', cwd=REPO) != 'https://github.com/MasterKano/emmi.git': raise ValueError('Wrong publishing repository')
    run('git', 'fetch', 'origin', 'main', cwd=REPO)
    path = f'origin/main:pulse/{day}/index.html'
    if subprocess.run(['git','cat-file','-e',path], cwd=REPO, capture_output=True).returncode:
        return None
    expected = subprocess.check_output(['git','show',path], cwd=REPO)
    return public_ready(day, expected) | dict(already_published=True)

def main():
    out = Path(sys.argv[1]).resolve()
    v, names = validate(out)
    day = v['run_date']
    done = existing_publication(day)
    if done:
        atomic(out/'publication.json', done)
        print(f'{day} already archived and live; nothing changed')
        return
    branch = f'pulse-auto/{day}'
    journal = Path(os.environ.get('BRIEF_ROOT', '/workspace/brief'))/'out/pulse_auto/transactions'/f'{day}.json'
    remote = run('git','ls-remote','--heads','origin',f'refs/heads/{branch}',cwd=REPO)
    source = out
    if remote:
        # Recover after push, PR creation, check wait or merge was interrupted: never create a second branch/PR.
        if not journal.exists(): raise RuntimeError('Existing dated branch has no local validation journal; held for review')
        state = json.loads(journal.read_text())
        source = Path(state['output_dir'])
        prior, _ = validate(source)  # same-day, integrity checked, younger than two hours
        if remote.split()[0] != state['head_sha']: raise RuntimeError('Dated branch changed outside this publication transaction')
        v = prior
    else:
        tmp = Path(tempfile.mkdtemp(prefix='pulse-publish-')) / 'repo'
        run('git', 'worktree', 'add', '--detach', str(tmp), 'origin/main', cwd=REPO)
        try:
            if not (tmp / 'scripts/pulse_auto/README.md').exists(): raise ValueError('Pilot infrastructure must be merged first')
            root = tmp / 'pulse'; dst = root / day
            dst.mkdir(parents=True)
            for name in names: shutil.copy2(out / name, dst / name)
            (root / 'index.html').write_bytes((dst / 'index.html').read_bytes())
            dates = sorted((p.name for p in root.iterdir() if re.fullmatch(r'\d{4}-\d{2}-\d{2}',p.name) and (p/'index.html').exists()), reverse=True)
            archive = root / 'archive'; archive.mkdir(exist_ok=True)
            items = ''.join(f'<li><a style="color:#fbbf24" href="/emmi/pulse/{d}/">{d} · numbers-only Pulse</a></li>' for d in dates)
            (archive / 'index.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pulse archive</title></head><body style="background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;margin:20px;max-width:600px"><h1>Market Pulse archive</h1><a style="color:#fbbf24" href="/emmi/pulse/">Latest</a><ul>'+items+'</ul></body></html>')
            run('git','add','pulse',cwd=tmp)
            run('git','commit','-m',f'Publish checked numbers-only Pulse {day}',cwd=tmp)
            head = run('git','rev-parse','HEAD',cwd=tmp)
            atomic(journal, dict(branch=branch,head_sha=head,output_dir=str(out)))
            run('git','push','origin',f'HEAD:refs/heads/{branch}',cwd=tmp)
        finally:
            run('git','worktree','remove',str(tmp),cwd=REPO)
    prs = json.loads(run('gh','pr','list','--repo',REMOTE,'--head',branch,'--state','open','--json','number,url'))
    if len(prs) > 1: raise RuntimeError('Multiple dated PRs exist; held for review')
    if prs: url = prs[0]['url']
    else:
        url = run('gh','pr','create','--repo',REMOTE,'--base','main','--head',branch,'--title',f'Pulse {day}: checked numbers-only pilot','--body',f'Parallel pilot. Locked master v1.2, source-date and phone checks passed. Session {v["last_close"]}. No email or bot calls; existing weekday routine unchanged.')
    number = url.rsplit('/',1)[-1]
    print(url, flush=True)
    for _ in range(18):
        pr = json.loads(run('gh','pr','view',number,'--repo',REMOTE,'--json','mergeable,statusCheckRollup,headRefOid'))
        # Deleted Cloudflare account already fails on main; active deployment is controlled GitHub Pages.
        checks = [c for c in pr['statusCheckRollup'] if c.get('name') != 'Cloudflare Pages']
        pending = [c for c in checks if c.get('status') != 'COMPLETED']
        bad = [c for c in checks if c.get('status') == 'COMPLETED' and c.get('conclusion') not in ('SUCCESS','SKIPPED','NEUTRAL')]
        if bad: raise RuntimeError('PR checks failed: ' + json.dumps(bad))
        if checks and any(c.get('name') == 'build' and c.get('conclusion') == 'SUCCESS' for c in checks) and not pending and pr['mergeable'] == 'MERGEABLE':
            run('gh','pr','merge',number,'--repo',REMOTE,'--merge','--match-head-commit',pr['headRefOid'])
            result = public_ready(day, (source/'index.html').read_bytes()) | dict(pr_url=url,already_published=False,source_output_dir=str(source))
            atomic(out/'publication.json',result)
            return
        time.sleep(10)
    raise RuntimeError('PR checks/mergeability not ready within three minutes; dated PR kept for next invocation')
if __name__ == '__main__': main()
