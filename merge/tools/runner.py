import json,subprocess,collections
from datetime import datetime,timedelta,timezone
end=datetime.now(timezone.utc); start=end-timedelta(days=7)
runs=[];page=1
while True:
    out=subprocess.run(["gh","api",f"repos/MasterKano/emmi/actions/runs?per_page=100&page={page}&created=>={start:%Y-%m-%dT%H:%M:%SZ}"],capture_output=True,text=True).stdout
    d=json.loads(out); rs=d["workflow_runs"]; runs+=rs
    if len(rs)<100: break
    page+=1
P=lambda s:datetime.fromisoformat(s.replace("Z","+00:00"))
by=collections.defaultdict(lambda:[0,0.0]); tot=0
for r in runs:
    if r["status"]!="completed" or not r.get("run_started_at"): 
        by[r["name"]+" (not completed)"][0]+=1; continue
    m=(P(r["updated_at"])-P(r["run_started_at"])).total_seconds()/60
    by[r["name"]][0]+=1; by[r["name"]][1]+=m; tot+=m
print("window_utc",start.isoformat(),end.isoformat(),"runs",len(runs),"total_min",round(tot))
for k,(n,m) in sorted(by.items(),key=lambda x:-x[1][1]): print(f"{k}\t{n}\t{round(m)}")
