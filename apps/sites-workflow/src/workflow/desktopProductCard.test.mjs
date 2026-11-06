import test from 'node:test';import assert from 'node:assert/strict';
import {mountDesktopProductCard} from './desktopProductCard.mjs';
import {productCardFixture} from '../../../api/src/services/test-fixtures/desktopProductCard.fixture.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function root(){let html='',paints=0,close;return {get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector(){return {addEventListener:(_k,fn)=>{close=fn;}};},get paints(){return paints;},close(){close();}};}
test('card displays exact barcode strings and escapes names',async()=>{
 const r=root(),card=productCardFixture();card.name='<script>bad</script>';let closed=0;mountDesktopProductCard({root:r,productId:'6',load:async()=>card,onClose:()=>closed++});await tick();assert.match(r.innerHTML,/000000000005/);assert.match(r.innerHTML,/000000000051/);assert.match(r.innerHTML,/Ana barkod/);assert.match(r.innerHTML,/Ek barkod/);assert.match(r.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(r.innerHTML,/<script>/);r.close();assert.equal(closed,1);
});
test('late or foreign-product results cannot replace another selected view',async()=>{
 let finish;const r=root(),mounted=mountDesktopProductCard({root:r,productId:'6',load:()=>new Promise(resolve=>{finish=resolve;})});mounted.dispose();finish(productCardFixture());await tick();assert.equal(r.paints,1);
 const wrong=root();mountDesktopProductCard({root:wrong,productId:'7',load:async()=>productCardFixture()});await tick();assert.match(wrong.innerHTML,/okunamadı/);assert.doesNotMatch(wrong.innerHTML,/000000000005/);
});
