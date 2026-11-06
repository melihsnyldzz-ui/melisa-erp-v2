import test from 'node:test';import assert from 'node:assert/strict';
import {mountDesktopProductCard} from './desktopProductCard.mjs';
import {productCardFixture} from '../../../api/src/services/test-fixtures/desktopProductCard.fixture.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('series display derives complete packs and remainder from physical ADET without inventing a series price',async()=>{const card=productCardFixture();card.currentStockExact3='61.500';card.units.push({id:'9',productId:'6',label:'SERİ',factorExact8:'6.00000000',isMain:false});const r=root();mountDesktopProductCard({root:r,productId:'6',load:async()=>card});await tick();assert.match(r.innerHTML,/61.500 ADET/);assert.match(r.innerHTML,/10 SERİ \+ 1.500 ADET/);assert.match(r.innerHTML,/Bir serideki adet/);assert.doesNotMatch(r.innerHTML,/SERİ fiyat/);});
function root(){let html='',paints=0,close;return {get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector(){return {addEventListener:(_k,fn)=>{close=fn;}};},get paints(){return paints;},close(){close();}};}
test('card displays exact barcode strings and escapes names',async()=>{
 const r=root(),card=productCardFixture();card.name='<script>bad</script>';let closed=0;mountDesktopProductCard({root:r,productId:'6',load:async()=>card,onClose:()=>closed++});await tick();assert.match(r.innerHTML,/000000000005/);assert.match(r.innerHTML,/000000000051/);assert.match(r.innerHTML,/Ana barkod/);assert.match(r.innerHTML,/Ek barkod/);assert.match(r.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(r.innerHTML,/<script>/);r.close();assert.equal(closed,1);
});
test('late or foreign-product results cannot replace another selected view',async()=>{
 let finish;const r=root(),mounted=mountDesktopProductCard({root:r,productId:'6',load:()=>new Promise(resolve=>{finish=resolve;})});mounted.dispose();finish(productCardFixture());await tick();assert.equal(r.paints,1);
 const wrong=root();mountDesktopProductCard({root:wrong,productId:'7',load:async()=>productCardFixture()});await tick();assert.match(wrong.innerHTML,/okunamadı/);assert.doesNotMatch(wrong.innerHTML,/000000000005/);
});
test('persisted opening reason is escaped and displayed with its movement and actor; legacy card invents no reason',async()=>{
 const card=productCardFixture();card.stockOpening={kind:'desktop-product-opening-v1',productId:'6',movementId:'11',actorId:'7',requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',reason:'<b>Açılış sayımı</b>',quantityExact3:'2.000',costExact4:'8.0000',amountTryExact4:'16.0000',documentDate:'2026-11-06',currency:'TRY'};const r=root();mountDesktopProductCard({root:r,productId:'6',load:async()=>card});await tick();assert.match(r.innerHTML,/Başlangıç stok gerekçesi/);assert.match(r.innerHTML,/&lt;b&gt;Açılış sayımı&lt;\/b&gt;/);assert.match(r.innerHTML,/Açılış hareketi/);assert.match(r.innerHTML,/Kaydeden kullanıcı/);assert.match(r.innerHTML,/16.0000 TRY/);
 const old=root();mountDesktopProductCard({root:old,productId:'6',load:async()=>productCardFixture()});await tick();assert.doesNotMatch(old.innerHTML,/Başlangıç stok gerekçesi/);
});
