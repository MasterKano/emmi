"""Apply the research owner's 30 Oct 2026 follow-up answers on top of build_ids.py output.
Run from merge/: python3 tools/apply_followups.py"""
import csv
def load(p):
    with open(p,newline="") as f: r=csv.DictReader(f); return r.fieldnames,list(r)
def save(p,h,rows):
    with open(p,"w",newline="") as f: w=csv.DictWriter(f,h,lineterminator="\r\n"); w.writeheader(); w.writerows(rows)
SRC_CO="verified: company sites (30 Oct 2026)"
h,L=load("ids/listings.csv")
note={"SSME:LUC":"Nasdaq First North Growth Market (not main market); "+SRC_CO,
      "XBOT:LUC":"Botswana Stock Exchange, symbol LUC; "+SRC_CO,
      "XTSE:LUC":SRC_CO,"XTSE:LUG":SRC_CO,"XSTO:LUG":"Nasdaq Stockholm, ticker LUG; "+SRC_CO,
      "XTSE:LUN":SRC_CO,"XSTO:LUMI":"Nasdaq Stockholm, ticker LUMI (not LUN); "+SRC_CO}
coll={"MAU":"TICKER COLLISION: bare MAU is two companies (XTSE:MAU Montage Gold, XPAR:MAU Maurel et Prom); match on MIC+ticker only",
      "SNM":"TICKER COLLISION: bare SNM is two companies (XASX:SNM Sentinel Metals, MERK/XSTO:SNM ShaMaran); match on MIC+ticker only",
      "PEN":"TICKER COLLISION: bare PEN is two companies (XOSL:PEN Panoro, XASX:PEN Peninsula); match on MIC+ticker only"}
for r in L:
    if r["listing_id"] in note: r["note"]=note[r["listing_id"]]
    if r["ticker"] in coll: r["note"]=coll[r["ticker"]]
    if r["listing_id"]=="SSME:LUC": r["exchange"]="Nasdaq First North Growth Market"; r["primary"]=""
    if r["listing_id"]=="XBOT:LUC": r["exchange"]="Botswana Stock Exchange"
if not any(r["listing_id"]=="XSES:5WH" for r in L):
    L.append(dict(listing_id="XSES:5WH",company_id="c_rex_international_holding",mic="XSES",exchange="SGX Catalist",ticker="5WH",
        currency="SGD",quote_unit="SGD",yahoo="5WH.SI",tradingview="SGX:5WH",cnbc="",primary="Y",status="listed",
        sources="research-owner follow-up",note="parent of Lime Petroleum AS; "+SRC_CO+"; Yahoo/TradingView symbols to check"))
save("ids/listings.csv",h,L)
h,C=load("ids/companies.csv")
for r in C:
    if r["company_id"]=="c_lime_petroleum_as": r["status"]="subsidiary"; r["parent_company_id"]="c_rex_international_holding"
if not any(r["company_id"]=="c_rex_international_holding" for r in C):
    C.append(dict(company_id="c_rex_international_holding",name="Rex International Holding Ltd",status="listed",parent_company_id="",
        in_moonshot="Y",in_emma="",sources="moonshot:norway-parent (research-owner follow-up)"))
save("ids/companies.csv",h,C)
h,M=load("ids/id_map.csv")
for r in M:
    if r["system"]=="moonshot.norway.short_name" and r["old_id"]=="Lime":
        r["relation"]="subsidiary_of:c_rex_international_holding"; r["note"]="parent verified: company sites (30 Oct 2026)"
save("ids/id_map.csv",h,M)
