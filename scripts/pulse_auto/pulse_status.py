"""Atomic fixed-path status for the routine; contains no credentials."""
import datetime as dt, json, os, sys
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(os.environ.get('BRIEF_ROOT','/workspace/brief')).resolve()
PATH=ROOT/'out/pulse_auto/latest_status.json'
def write(state, code, reasons=(), **extra):
    PATH.parent.mkdir(parents=True,exist_ok=True)
    status=dict(status=state,exit_code=code,reasons=list(reasons),page_url='https://masterkano.github.io/emmi/pulse/',updated_at=dt.datetime.now(ZoneInfo('Europe/Zurich')).isoformat(),**extra)
    tmp=PATH.with_name(f'.{PATH.name}.{os.getpid()}.tmp')
    tmp.write_text(json.dumps(status,indent=2,ensure_ascii=False,default=str));os.replace(tmp,PATH)
    return status
if __name__=='__main__':
    code=int(sys.argv[1]); reason=sys.argv[2]
    mode=sys.argv[3] if len(sys.argv)>3 else 'held'
    if mode=='ensure-final':
        try: current=json.loads(PATH.read_text())
        except (FileNotFoundError,ValueError): current={}
        if current.get('status') not in (None,'building'): sys.exit(0)
        mode='held'
    write(mode,None if mode=='building' else code,[reason])
