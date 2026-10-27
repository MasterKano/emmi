/* Data files built by the scheduled jobs live on the live-data branch (one force-pushed commit, so no history growth
   on main). Requests for them go there first; the copy on the site (main) is the fallback if that fails. */
(function(){const BASE="https://raw.githubusercontent.com/MasterKano/markets-monitor/live-data/",P=["data/market.json", "data/news.json", "data/power.json", "data/symbols.json", "data/companies.json", "data/co", "data/dealflow.json", "data/griddc.json", "data/griddc_state.json", "data/balancing.json", "data/mastr_de.json", "data/griddc_events.json", "data/hydro_nordic.json", "data/us_valuation.json", "data/fi_wind.json", "data/nordic_monthly.json", "data/nordic_precip.json", "data/nordic_dash.json", "data/gas.json", "data/gas", "data/mr.json", "data/nordic_mtd.json"],f0=window.fetch.bind(window);
const live=u=>typeof u==="string"&&u.startsWith("data/")&&P.some(p=>u===p||u.startsWith(p+"?")||u.startsWith(p+"/"));
window.MMLIVE={base:BASE,used:{}};
window.fetch=function(u,o){if(!live(u))return f0(u,o);const k=u.split("?")[0];
 return f0(BASE+u,o).then(r=>{if(r.ok){MMLIVE.used[k]="live";return r;}throw Error("HTTP "+r.status);}).catch(()=>{MMLIVE.used[k]="site";return f0(u,o);});};})();
