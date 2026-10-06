import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('working face does not carry package labels or synthetic stock handlers',()=>{
 const html=read('../../ornek-akis.html');
 assert(!/ÖRNEK MOD|TEST veritabanı/.test(html));
 const builder=read('../../../../scripts/canonical/build-package.mjs');
 assert(!/for\(const page of \[[^\]]*ornek-akis/.test(builder));
 const demo=read('./demoOperations.js');
 const guard=demo.match(/document.addEventListener\('workflow-render',\(\)=>\{([^]*?)bridge\.badges/);
 assert(guard,'Demo handler entry is required');
 const runGuard=new Function('bridge','localStorage',guard[1]+'return true;');
 for(const screen of ['stock','home','supplier-payments'])assert.equal(runGuard({screen:()=>screen},{getItem(){throw Error('Real screens must never read demo state');}}),undefined);
 assert.equal(runGuard({screen:()=> 'goods'},{getItem:()=> 'live'}),undefined);
 assert.equal(runGuard({screen:()=> 'goods'},{getItem:()=> 'demo'}),true);
 assert(!/for\(const name of \[[^\]]*stockPage/.test(demo));
});
test('shared catalog is mounted only in canonical ERP target',()=>{
 const launcher=read('../../../api/start-canonical-test.mjs');
 assert.match(launcher,/if\(mode==='erp'\)\{[^]*?app.use\('\/api',catalogProductsRoutes\)/);
 assert(!read('../../../api/src/routes/catalogRoutes.mjs').match(/\.post\(|\.put\(|\.delete\(/));
});
