#!/usr/bin/env python3
"""Publish only a checked edition, through an isolated branch + green PR + merge. No email."""
import datetime as dt, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile, time
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

def pilot_dir(day):
    """The numbers-only pilot lives at pulse/<day>-pilot/. pulse/<day>/ is kept for the emailed Pulse."""
    return f'{day}-pilot'

SITE = 'https://emmi-e2e.pages.dev/emmi/'

def public_ready(day, expected_html, limit=600):
    """The site sits behind Cloudflare Access (no anonymous reads), so readiness is checked on what gets deployed:
    origin/main must hold the vetted pilot bytes plus the rebuilt latest and archive pages, and a deploy.yml run on main
    that includes that commit must have succeeded. Latest is not required to show the pilot: an emailed edition stays latest."""
    pilot_b = pilot_dir(day).encode()
    deadline = time.monotonic() + limit
    while True:
        run('git', 'fetch', '-q', 'origin', 'main', cwd=REPO)
        head = run('git', 'rev-parse', 'origin/main', cwd=REPO)
        show = lambda path: subprocess.run(['git', 'show', f'origin/main:{path}'], cwd=REPO, capture_output=True).stdout
        dated, latest, archive = show(f'pulse/{pilot_dir(day)}/email.html'), show('pulse/index.html'), show('pulse/archive/index.html')
        dated_ok = dated == expected_html
        latest_ok = (latest != expected_html and pilot_b in latest and b'Latest Pulse' in latest and b'Publication' in latest
                     and b'Delivery' in latest and b'Back to EMM' in latest)
        archive_ok = pilot_b in archive and b'Publication' in archive and b'Delivery' in archive
        deployed = False
        if dated_ok and latest_ok and archive_ok:
            runs = json.loads(run('gh', 'run', 'list', '-R', REMOTE, '-w', 'deploy.yml', '--branch', 'main', '-L', '20',
                                  '--json', 'headSha,status,conclusion', cwd=REPO) or '[]')
            for r in runs:
                if r['status'] != 'completed' or r['conclusion'] != 'success': continue
                if r['headSha'] == head or subprocess.run(['git', 'merge-base', '--is-ancestor', head, r['headSha']], cwd=REPO, capture_output=True).returncode == 0:
                    deployed = True; break
        if deployed:
            return dict(archive_url=f'{SITE}pulse/{pilot_dir(day)}/')
        if time.monotonic() >= deadline: raise RuntimeError('PR is merged but latest/archive are not on main or not deployed yet; next invocation will reconcile them')
        time.sleep(15)

def existing_publication(day):
    if run('git', 'remote', 'get-url', 'origin', cwd=REPO) != 'https://github.com/MasterKano/emmi.git': raise ValueError('Wrong publishing repository')
    run('git', 'fetch', 'origin', 'main', cwd=REPO)
    path = f'origin/main:pulse/{pilot_dir(day)}/email.html'
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
            root = tmp / 'pulse'; dst = root / pilot_dir(day)
            spec = importlib.util.spec_from_file_location('site_pages', tmp / 'scripts' / 'editions' / 'site_pages.py')
            site_pages = importlib.util.module_from_spec(spec); spec.loader.exec_module(site_pages)
            # Never write into an emailed edition. pulse/<day>/ belongs to the sent Pulse; the pilot has its own folder,
            # and site_pages keeps the newest emailed edition as latest.json and the latest page.
            if site_pages.is_sent_dir(dst) or dst.resolve() == (root / day).resolve():
                raise RuntimeError('Pilot would overwrite an emailed edition; refused')
            dst.mkdir(parents=True)
            for name in names: shutil.copy2(out / name, dst / ('email.html' if name == 'index.html' else name))
            site_pages.install_pulse_site(root, day, v)
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
        url = run('gh','pr','create','--repo',REMOTE,'--base','main','--head',branch,'--title',f'Pulse {day}: checked numbers-only pilot','--body',f'Parallel pilot. Locked master v1.3.1, source-date, column-width, 600px PNG and phone checks passed. Session {v["last_close"]}. No email or bot calls; existing weekday routine unchanged.')
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
