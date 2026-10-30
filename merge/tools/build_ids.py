"""Draft company / listing ID map (Stage 2). Reads Moonshot repo data, Moonshot review/company_map.json (code-based
matching + parent links), and EMMA scripts/universe.py. Writes merge/ids/*.csv and collision facts as JSON."""
import csv, json, re, sys, unicodedata, collections
import os
MS=os.environ.get("MOONSHOT_DATA","moonshot/data/"); OUT=os.environ.get("OUT","merge/ids/")
sys.path.insert(0,os.environ.get("EMMA_SCRIPTS","scripts")); import universe
CMAP=json.load(open(os.environ["COMPANY_MAP"]))["entities"]

# exchange label -> (MIC, yahoo suffix, TradingView prefix, CNBC suffix as in EMMA pxchart.js, quote unit override)
EX={
 "ASX":("XASX",".AX","ASX","",None), "AIM":("XLON",".L","LSE","-GB","GBX"), "Main Market":("XLON",".L","LSE","-GB","GBX"),
 "London":("XLON",".L","LSE","-GB","GBX"),"London AIM":("XLON",".L","LSE","-GB","GBX"),
 "Oslo Bors":("XOSL",".OL","OSL","-NO",None),"Oslo":("XOSL",".OL","OSL","-NO",None),"Euronext Growth Oslo":("MERK",".OL","OSL","-NO",None),
 "Euronext Paris":("XPAR",".PA","EURONEXT","",None),"Paris":("XPAR",".PA","EURONEXT","",None),
 "Nasdaq Stockholm":("XSTO",".ST","OMXSTO","-SE",None),"Nasdaq First North Sweden":("SSME",".ST","OMXSTO","-SE",None),
 "Nasdaq First North":("SSME",".ST","OMXSTO","-SE",None),"Nasdaq Stockholm (SDB)":("XSTO",".ST","OMXSTO","-SE",None),
 "Nasdaq Helsinki":("XHEL",".HE","OMXHEX","-FI",None),"Tel Aviv Stock Exchange":("XTAE",".TA","TASE","","ILA"),
 "Frankfurt (Scale)":("XFRA",".F","FWB","",None),"Euronext Milan":("XMIL",".MI","MIL","-IT",None),
 "Euronext Amsterdam":("XAMS",".AS","EURONEXT","",None),"TSX":("XTSE",".TO","TSX","-CA",None),"TSX-V":("XTSX",".V","TSXV","-V",None),
 "BSE":("XBOT","","","",None),"NYSE":("XNYS","","NYSE","",None),"Warsaw":("XWAR",".WA","GPW","",None),"Vienna":("XWBO",".VI","VIE","",None),
 "Madrid":("XMAD",".MC","BME","-ES",None),"Tokyo":("XTKS",".T","TSE","",None),
}
YSUF={".AX":"XASX",".L":"XLON",".OL":"XOSL",".PA":"XPAR",".ST":"XSTO",".HE":"XHEL",".TA":"XTAE",".MI":"XMIL",".AS":"XAMS",
 ".TO":"XTSE",".V":"XTSX",".CO":"XCSE",".DE":"XETR",".LS":"XLIS",".MC":"XMAD",".BR":"XBRU",".VI":"XWBO",".WA":"XWAR",".T":"XTKS",".F":"XFRA"}
CCY={"XASX":"AUD","XLON":"GBP","XOSL":"NOK","MERK":"NOK","XPAR":"EUR","XSTO":"SEK","SSME":"SEK","XHEL":"EUR","XTAE":"ILS","XFRA":"EUR",
 "XMIL":"EUR","XAMS":"EUR","XTSE":"CAD","XTSX":"CAD","XBOT":"BWP","XNYS":"USD","XNAS":"USD","XCSE":"DKK","XETR":"EUR","XLIS":"EUR",
 "XMAD":"EUR","XBRU":"EUR","XWBO":"EUR","XWAR":"PLN","XTKS":"JPY"}
SUFFIX=r"\b(plc|ltd|limited|inc|corp|corporation|co|asa|ab|as|a s|sa|se|s a|nl|lp|ag|holdings?|group|the|and|energy|resources|petroleum|oil|gas|mining|minerals|metals)\b"
def fold(s): return unicodedata.normalize("NFKD",s or "").encode("ascii","ignore").decode().lower()
def nkey(name):
    s=fold(name); s=re.sub(r"\(.*?\)","",s); s=s.replace("&"," and "); s=re.sub(r"[^a-z0-9]+"," ",s)
    k=re.sub(SUFFIX," ",s); k=" ".join(k.split()); return k or " ".join(s.split())
def slug(name): return "c_"+re.sub(r"[^a-z0-9]+","_",fold(re.sub(r"\((via|private|parent|unlisted)[^)]*\)","",name)).strip()).strip("_")[:40]

companies={}   # company_id -> dict
listings={}    # listing_id -> dict
idmap=[]       # rows
bykey={}       # name key -> company_id
byticker={}    # (mic,ticker) -> listing_id
def company(name,status="listed",parent=None,source="",own=False):
    k=nkey(name)
    if k in bykey and not own: return bykey[k]
    cid=slug(name); base=cid; i=2
    while cid in companies: cid=f"{base}_{i}"; i+=1
    companies[cid]=dict(company_id=cid,name=name,status=status,parent_company_id=parent or "",sources=set([source]),aliases=set())
    if not own: bykey[k]=cid
    return cid
def listing(cid,exch,ticker,currency=None,primary=False,source="",note=""):
    mic,ys,tv,cn,unit=EX.get(exch,("?"+exch,"","","",None))
    t=ticker.split(".")[0] if ticker.endswith(ys) and ys else ticker
    lid=f"{mic}:{t}"
    if lid in listings:
        L=listings[lid]
        if L["company_id"]!=cid: L.setdefault("conflict",set()).add(cid)
        L["sources"].add(source); return lid
    ccy=currency or CCY.get(mic,"")
    yt=t.replace("_","-")
    listings[lid]=dict(listing_id=lid,company_id=cid,mic=mic,exchange=exch,ticker=t,currency=ccy,quote_unit=unit or ccy,
        yahoo=(yt+ys) if (ys or mic in("XNYS","XNAS")) else "",tradingview=f"{tv}:{t.replace('-','_') if tv=='OMXSTO' else t}" if tv else "",
        cnbc=(t.replace("_",".")+cn) if cn else "",primary="Y" if primary else "",status="listed",sources=set([source]),note=note)
    byticker[(mic,t)]=lid; return lid
def mapid(system,old,cid,lid="",relation="same",note=""): idmap.append(dict(system=system,old_id=old,company_id=cid,listing_id=lid,relation=relation,note=note))

# 1) Moonshot Screen (smallcaps.json): code is Moonshot's link key
sc=json.load(open(MS+"smallcaps.json"))
for r in sc:
    cid=company(r["name"],source="moonshot:screen")
    lid=listing(cid,r["exchange"],r["code"],r.get("currency"),True,"moonshot:screen")
    mapid("moonshot.screen.code",r["code"],cid,lid)
    for e in r.get("events",[]): pass
# 2) Pilot register (companies.csv): may be dual listed "TSX; Nasdaq Stockholm"
SECOND={("IPCO","Nasdaq Stockholm"):"IPCO",("LUN","Nasdaq Stockholm"):"LUMI",("LUG","Nasdaq Stockholm"):"LUG",
        ("LUC","Nasdaq First North"):"LUC",("LUC","BSE"):"LUC",("SNM","Euronext Growth Oslo"):"SNM"}
for r in csv.DictReader(open(MS+"companies.csv")):
    cid=company(r["company"],source="moonshot:pilot")
    venues=[v.strip() for v in r["exchange"].split(";")]
    for i,v in enumerate(venues):
        t=r["ticker"] if i==0 else SECOND.get((r["ticker"],v),r["ticker"])
        lid=listing(cid,v,t,None,i==0,"moonshot:pilot",note="" if i==0 else "secondary venue; ticker to verify")
        if i==0: mapid("moonshot.pilot.ticker",r["ticker"],cid,lid)
    mapid("moonshot.company_map","PILOT:"+r["ticker"],cid,"","same")
# 3) Norway shelf: subsidiaries link to listed parent (parent_listed)
for r in json.load(open(MS+"norway_companies.json")):
    pl=r.get("parent_listed"); st=r.get("listing_status")
    if st=="subsidiary of listed" and pl:
        pname=pl["name"]; pid=company(pname,source="moonshot:norway-parent")
        for ex in re.split(r" and ",pl["exchange"]):
            for tk in re.split(r" and ",pl["ticker"]):
                ex2={"London AIM":"London AIM"}.get(ex,ex)
                if "JV" in pname: continue
                listing(pid,ex2,tk,None,False,"moonshot:norway-parent")
        sid=company(r["name"],status="subsidiary",parent=pid,source="moonshot:norway",own=True)
        mapid("moonshot.norway.short_name",r["short_name"],sid,"","subsidiary_of:"+pid)
    elif st=="listed":
        cid=company(r["name"],source="moonshot:norway"); m=re.match(r"(\w[\w ]*?): (\w+)",r["listing_ticker"])
        lid=listing(cid,m.group(1),m.group(2),None,True,"moonshot:norway") if m else ""
        mapid("moonshot.norway.short_name",r["short_name"],cid,lid)
    else:
        cid=company(r["name"],status=st,source="moonshot:norway"); mapid("moonshot.norway.short_name",r["short_name"],cid,"","same",st)
# 4) Country files: companies by code (some not in dataset)
for f in ["falklands","namibia","guyana","south_africa","gabon","angola","colombia"]:
    for c in json.load(open(MS+f+".json"))["companies"]:
        code=c.get("code"); 
        cid=company(c["name"],status="listed" if code else "private/unverified",source=f"moonshot:country:{f}")
        if code and c.get("exchange"):
            ex=c["exchange"].split(" / ")[0]; listing(cid,ex,code,None,True,f"moonshot:country:{f}")
        mapid(f"moonshot.country.{f}",code or c["name"],cid,"","same","" if c.get("in_dataset") in (True,"Y") else "not in Moonshot dataset")
# 5) EMMA universe (Yahoo symbol is EMMA's key; data/co/<sym>.json)
emma_cids=set(); emma_rows={}
for g in universe.GROUPS:
    for s in g["sections"]:
        for r in s["rows"]:
            if r["kind"]!="equity" or r["sym"] in emma_rows: continue
            sym=r["sym"]; m=re.match(r"^(.*?)(\.[A-Z]+)?$",sym); t,suf=m.group(1),m.group(2) or ""
            mic=YSUF.get(suf,"XNYS" if not suf else "?"); emma_rows[sym]=r
            fam={"XOSL":["XOSL","MERK"],"XSTO":["XSTO","SSME"],"XNYS":["XNYS","XNAS"]}.get(mic,[mic])
            lid=next((byticker.get((m,x)) for m in fam for x in (t,t.replace("-","_")) if byticker.get((m,x))),None)
            cid=listings[lid]["company_id"] if lid else (bykey.get(nkey(r["name"])) or company(r["name"],source="emma"))
            companies[cid]["sources"].add("emma")
            if not lid:
                lid=f"{mic}:{t}"
                tv=r["tv"] or ""
                listings[lid]=dict(listing_id=lid,company_id=cid,mic=mic,exchange=tv.split(":")[0] if tv else mic,ticker=t,currency=CCY.get(mic,"USD"),
                    quote_unit="GBX" if mic=="XLON" else CCY.get(mic,"USD"),yahoo=sym,tradingview=tv,cnbc="",primary="",status="listed",sources=set(["emma"]),note="")
                byticker[(mic,t)]=lid
            L=listings[lid]; L["sources"].add("emma"); L["yahoo"]=sym; L["tradingview"]=r["tv"] or L["tradingview"]
            emma_cids.add(cid); mapid("emma.yahoo_symbol",sym,cid,lid,"same",f"group={g['id']}")
            emma_rows[sym]=dict(r,cid=cid,lid=lid)
# EMMA-specific CNBC symbol rule (pxchart.js) for listings with a TV symbol
SUF={"LSE":"-GB","HKEX":"-HK","OSL":"-NO","OMXSTO":"-SE","TSX":"-CA","TSXV":"-V","OMXHEX":"-FI","XETR":"-DE","SIX":"-CH","BME":"-ES","MIL":"-IT"}
for L in listings.values():
    tv=L.get("tradingview") or ""
    if ":" in tv:
        ex,t=tv.split(":")
        if ex in("NYSE","NASDAQ","AMEX"): L["cnbc"]=t
        elif ex in SUF: L["cnbc"]=(t.replace("-",".") if ex in("LSE","TSX","TSXV") else t.replace("_",".") if ex=="OMXSTO" else t)+SUF[ex]
        else: L["cnbc"]=""
# Moonshot set = everything except EMMA-only
ms_cids={c for c,v in companies.items() if any(s.startswith("moonshot") for s in v["sources"])}
overlap=sorted(ms_cids & emma_cids)
# collisions: same bare ticker used by different companies anywhere (incl. Moonshot's bare codes)
bt=collections.defaultdict(set)
for L in listings.values(): bt[L["ticker"].upper()].add((L["company_id"],L["listing_id"]))
coll={t:sorted(v) for t,v in bt.items() if len({c for c,_ in v})>1}
dual={c:[l for l,L in listings.items() if L["company_id"]==c] for c in companies}
dual={c:v for c,v in dual.items() if len(v)>1}
conflicts={l:sorted(L["conflict"]) for l,L in listings.items() if L.get("conflict")}
# write
def w(name,rows,cols):
    with open(OUT+name,"w",newline="") as fh:
        wr=csv.DictWriter(fh,cols,extrasaction="ignore"); wr.writeheader()
        for r in rows: wr.writerow({k:(";".join(sorted(v)) if isinstance(v,set) else v) for k,v in r.items()})
for c in companies.values(): c["in_emma"]="Y" if c["company_id"] in emma_cids else ""; c["in_moonshot"]="Y" if c["company_id"] in ms_cids else ""
w("companies.csv",sorted(companies.values(),key=lambda r:r["company_id"]),["company_id","name","status","parent_company_id","in_moonshot","in_emma","sources"])
w("listings.csv",sorted(listings.values(),key=lambda r:r["listing_id"]),["listing_id","company_id","mic","exchange","ticker","currency","quote_unit","yahoo","tradingview","cnbc","primary","status","sources","note"])
w("id_map.csv",idmap,["system","old_id","company_id","listing_id","relation","note"])
json.dump(dict(n_companies=len(companies),n_ms=len(ms_cids),n_emma=len(emma_cids),overlap=[(c,companies[c]["name"]) for c in overlap],
   collisions=coll,dual={c:v for c,v in dual.items()},conflicts=conflicts,n_listings=len(listings),n_map=len(idmap),
   n_status=collections.Counter(c["status"] for c in companies.values())),open(os.environ.get("FACTS","ids_facts.json"),"w"),indent=1,default=list)
print(len(companies),"companies;",len(ms_cids),"moonshot;",len(emma_cids),"emma;",len(overlap),"overlap;",len(listings),"listings;",len(coll),"ticker collisions;",len(dual),"multi-listed;",len(conflicts),"conflicts")
print("overlap:",", ".join(companies[c]["name"] for c in overlap))
for t,v in coll.items(): print("COLL",t,v)
for c,v in dual.items(): print("DUAL",c,v)
print(conflicts)
