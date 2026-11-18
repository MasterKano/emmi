/* Behaviour at the important boundaries: delayed/closed quotes, absent prices, Zurich dates and guided windows. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = {window:{},document:{addEventListener(){}},Intl,Date,Set};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../livebrief.js'),'utf8'),ctx);
const B=ctx.window.EMMIBrief;
assert.equal(B.price({sym:'ECO.L',px:18.25,kind:'equity',ccy:'GBp'}),'18.25 GBp');
assert.equal(B.price({sym:'TTF=F',px:40.2,kind:'future',ccy:'EUR'}),'40.20 €/MWh');
assert.equal(B.price({sym:'^TNX',px:4.28,kind:'yield'}),'4.28 %');
assert.equal(B.price({sym:'missing',px:null,kind:'index'}),'—');
assert.match(B.quoteMeta({kind:'index',partial:false,bar_date:'2026-11-17'}),/^Last close/);
assert.match(B.quoteMeta({kind:'equity',partial:true,market_time:'2026-11-18T09:30:00Z'}),/^Delayed quote/);
assert.doesNotMatch(B.quoteMeta({kind:'equity',partial:true,bar_date:'2026-11-17'}),/live|fresh/i);
assert.equal(B.href('javascript:alert(1)'),''); assert.equal(B.href('//attacker.example'),'');
assert.equal(B.href('https://example.org/source'),'https://example.org/source');
const watch=B.watchHTML({'ECO.L':{sym:'ECO.L',kind:'equity',px:0,ccy:'GBp',pct:{'1D':0}}});
assert.match(watch,/0\.000 GBp/); assert.match(watch,/data-lp-quote="ECO.L"/);
assert.equal((watch.match(/class="watch-item"/g)||[]).length,7);
const source='https://example.org/ir';
const data={events:[{company:'Orrön',title:'Results',date:'2026-11-20',sort_date:'2026-11-20',precision:'day',confidence:'confirmed',source},
 {company:'Past',title:'Old results',date:'2026-11-17',precision:'day',confidence:'confirmed',source},
 {company:'Unsourced',title:'Guess',date:'2026-11-20',precision:'day',confidence:'confirmed'}]};
const research={items:[{company_name:'ECO',headline:'Project',anchor:'2026-10-01',sort_date:'2026-12-31',sort_date_is_proxy:true,precision:'quarter',date_window_text:'Q4 2026',date_basis:'company target',source_url:source}]};
const rows=B.upcoming(data,research,null,'2026-11-18');
assert.equal(rows.length,2); assert.ok(rows.some(e=>e.company==='Orrön'&&e.confirmed));
const eco=rows.find(e=>e.company==='ECO');assert.equal(eco.start,'2026-10-01');assert.equal(eco.end,'2026-12-31');assert.equal(eco.confirmed,false);assert.equal(eco.date,null);
assert.match(B.calendarHTML(data,research,null,'2026-11-18'),/Guidance · Q4 2026/);
assert.equal(B.bounds({date_window_text:'Feb 2028'}).end,'2028-02-29');
assert.equal(B.bounds({date_window_text:'H2 2026'}).start,'2026-07-01');
assert.equal(B.bounds({date_window_text:'2027'}).end,'2027-12-31');
assert.equal(B.upcoming({events:[]},null,null,'2026-11-18').length,0);
console.log('brief helpers ok');
