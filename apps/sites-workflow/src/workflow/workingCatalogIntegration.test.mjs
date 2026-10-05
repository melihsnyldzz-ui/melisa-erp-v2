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
 assert.match(demo,/workflow-render',\(\)=>\{\s*if\(bridge.screen\(\)==='stock'\)return;/);
 assert(!/for\(const name of \[[^\]]*stockPage/.test(demo));
});
test('shared catalog is mounted only in canonical ERP target',()=>{
 const launcher=read('../../../api/start-canonical-test.mjs');
 assert.match(launcher,/if\(mode==='erp'\)\{[^]*?app.use\('\/api',catalogProductsRoutes\)/);
 assert(!read('../../../api/src/routes/catalogRoutes.mjs').match(/\.post\(|\.put\(|\.delete\(/));
});
