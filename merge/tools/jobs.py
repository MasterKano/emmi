import json,subprocess,collections,math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
end=datetime.now(timezone.utc); start=end-timedelta(days=7)
runs=[];page=1
while True:
    d=json.loads(subprocess.run(["gh","api",f"repos/MasterKano/emmi/actions/runs?per_page=100&page={page}&created=>={start:%Y-%m-%dT%H:%M:%SZ}"],capture_output=True,text=True).stdout)
    runs+=d["workflow_runs"]
    if len(d["workflow_runs"])<100: break
    page+=1
P=lambda s:datetime.fromisoformat(s.replace("Z","+00:00"))
def jobs(r):
    d=json.loads(subprocess.run(["gh","api",f"repos/MasterKano/emmi/actions/runs/{r['id']}/jobs?per_page=100"],capture_output=True,text=True).stdout)
    out=[]
    for j in d.get("jobs",[]):
        if j.get("started_at") and j.get("completed_at"):
            s=(P(j["completed_at"])-P(j["started_at"])).total_seconds()
            out.append(s)
        elif j.get("started_at"):
            out.append((end-P(j["started_at"])).total_seconds())
    return r["name"].split(" (")[0].replace(" catch-up",""),out,r["status"]
by=collections.defaultdict(lambda:[0,0.0,0]); 
with ThreadPoolExecutor(12) as ex:
    for name,js,st in ex.map(jobs,runs):
        b=by[name]; b[0]+=1; b[1]+=sum(js)/60; b[2]+=sum(math.ceil(s/60) for s in js if s>0)
T=sum(v[1] for v in by.values()); R=sum(v[2] for v in by.values())
print(f"window_utc {start:%Y-%m-%d %H:%M} to {end:%Y-%m-%d %H:%M}; runs {len(runs)}; job_minutes {T:.0f}; rounded_up_per_job {R}")
for k,v in sorted(by.items(),key=lambda x:-x[1][1]): print(f"{k}\t{v[0]} runs\t{v[1]:.0f} min\t{v[2]} rounded")
