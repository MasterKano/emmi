const fs=require('fs'),vm=require('vm'),assert=require('assert');
let code=fs.readFileSync(__dirname+'/../mtd.js','utf8').replace('window.MMMtd={render,load,bars,pill};','window.__test={set:(m,r)=>{M=m;R=r;},serW,seasonal,MET};');
const sandbox={window:{},document:{getElementById:()=>null},localStorage:{getItem:()=>null},innerWidth:390,addEventListener:()=>{},Intl,Date};
vm.runInNewContext(code,sandbox);const t=sandbox.window.__test;
let m={days:['2026-10-01'],wx:{wind:{Nordic:[8]}}},r={weather:{months:['2026-10'],wind:[8]}};
t.set(m,r);assert.equal(t.serW('wind','Nordic')[0],null);assert.equal(t.seasonal({kind:'W',w:'wind'},'Nordic'),null);
m.wx_wind_height_m=100;r.weather.wind_height_m=100;t.set(m,r);
assert.equal(t.serW('wind','Nordic')[0],8);assert.equal(t.seasonal({kind:'W',w:'wind',u:'m/s'},'Nordic').v[0],8);
assert.equal(t.MET.find(m=>m.k==='wx_wind').s,'100 m, daily mean');console.log('Frontend rejects unverified height and accepts matching 100m current/history: PASS');
