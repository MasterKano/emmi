import asyncio,json,sys
from playwright.async_api import async_playwright
URL=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=True)
        ctx=await b.new_context(viewport={"width":1440,"height":900})
        pg=await ctx.new_page(); cdp=await ctx.new_cdp_session(pg)
        await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{"cacheDisabled":True})
        reqs={}
        cdp.on("Network.responseReceived",lambda e:reqs.setdefault(e["requestId"],{}).update(url=e["response"]["url"],type=e["type"],status=e["response"]["status"]))
        cdp.on("Network.loadingFinished",lambda e:reqs.setdefault(e["requestId"],{}).update(enc=e["encodedDataLength"]))
        cdp.on("Network.dataReceived",lambda e:reqs.setdefault(e["requestId"],{}).__setitem__("dec",reqs.get(e["requestId"],{}).get("dec",0)+e["dataLength"]))
        await pg.goto(URL,wait_until="load",timeout=90000)
        await pg.wait_for_timeout(8000)
        rs=[r for r in reqs.values() if "url" in r]
        tot=sum(r.get("enc",0) for r in rs); dec=sum(r.get("dec",0) for r in rs)
        first=[r for r in rs if "masterkano.github.io" in r["url"] or "raw.githubusercontent" in r["url"]]
        print(f"URL {URL}\nrequests {len(rs)}  transferred {tot/1e6:.2f} MB  decoded {dec/1e6:.2f} MB")
        print(f"own-origin+live-data requests {len(first)} transferred {sum(r.get('enc',0) for r in first)/1e6:.2f} MB")
        for r in sorted(rs,key=lambda r:-r.get("enc",0))[:15]:
            print(f"{r.get('enc',0)/1e3:9.1f} kB  {r.get('dec',0)/1e3:9.1f} kB dec  {r['type']:<10} {r['url'][:110]}")
        await b.close()
asyncio.run(main())
