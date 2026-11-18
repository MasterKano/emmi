const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{},document:{getElementById(){return null}},Map,Set,Date,Math};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../v2/curves/curves.js'),'utf8'),ctx);
const C=ctx.window.MMV2Curves;
const rows=[{contract:'HOZ26',label:'Dec-26',settle:'2.6845',change:'-0.0008',currency:'USD',unit:'USD/gal',source:'source, quoted',as_of:'2026-11-18T09:30:00Z'},
 {contract:'HOF27',label:'Jan-27',settle:'2.7001',change:'',currency:'USD',unit:'USD/gal',source:'scanner',as_of:'2026-11-18'}];
const lines=C.tsv(rows).split('\n'),head=lines[0].split('\t'),first=lines[1].split('\t'),last=lines[2].split('\t');
assert.equal(lines.length,3);assert.equal(first[head.indexOf('price')],'2.6845');assert.equal(first[head.indexOf('change')],'-0.0008');
assert.equal(last[head.indexOf('change')],'');assert.equal(first[head.indexOf('unit')],'USD/gal');assert.equal(first[head.indexOf('timestamp')],'2026-11-18T09:30:00Z');
assert.match(C.csv(rows),/"source, quoted"/);assert.match(C.csv(rows),/-0.0008/);
assert.equal(C.homeOf('wti',{}),'oil');
console.log('curve export precision and metadata ok');
