import test from 'node:test';
import assert from 'node:assert/strict';
import {lastPurchaseReferenceEnvelope,renderLastPurchaseReference} from './lastPurchaseReference.mjs';
const dto=()=>({schemaVersion:'melisa-product-last-purchase.v2',productId:'1',stockCode:'0161 MOLLY',cardAmountExact:'15.03000000',cardCurrency:'USD',cardUnitLabel:'ADET',discountExact:'10.00000000',cardPriceBasis:'UNKNOWN',referenceExact:'12.50000000',referenceCurrency:'TRY',referenceUnitLabel:'PAKET',referenceDate:'2026-10-01T00:00:00',sourceKind:'PURCHASE_DOCUMENT',selectionReason:'LATEST_VERIFIED_PURCHASE_DOCUMENT',reasons:[],status:'NET_REFERENCE',sourceAsOf:'2026-10-08T07:00:00Z',accountingCost:false,protectedExistingCost:true,protectedManual:false,referenceNumerator:'25',referenceDenominator:'2',precisionStatus:'EXACT',alternatives:[{sourceKind:'CARD',amountExact:'15.03000000',currency:'USD',unitLabel:'ADET',date:null,reason:'LOWER_PRIORITY'}]});
const envelope=data=>({success:true,data,meta:{readOnly:true,financialEffect:false}});
test('source date, kind and independent card currency/unit are shown without second discount',()=>{
 const r=dto();assert.equal(lastPurchaseReferenceEnvelope(envelope(r),'1','0161 MOLLY'),r);const html=renderLastPurchaseReference(r);for(const value of ['Son net alış','12,50 TRY','15,03 USD','PAKET','ADET','01.10.2026','Alış belgesi','kart iskontosu yeniden düşülmedi','öncelikli seçildi'])assert.ok(html.includes(value));assert.doesNotMatch(html,/SQL|DEBUG|TEST|13,527 USD/);
});
test('unknown currency retains known card amount and unknown basis leaves net blank',()=>{
 const r={...dto(),referenceExact:null,referenceCurrency:null,referenceUnitLabel:null,referenceDate:null,sourceKind:'CARD',status:'PARTIAL_CARD',cardCurrency:null,referenceNumerator:null,referenceDenominator:null,precisionStatus:null};lastPurchaseReferenceEnvelope(envelope(r),'1','0161 MOLLY');const html=renderLastPurchaseReference(r);assert.match(html,/15,03 · Döviz bilinmiyor/);assert.match(html,/brüt veya net olduğu doğrulanmadığından/);assert.doesNotMatch(html,/15,03 USD|kart iskontosu yeniden düşülmedi/);
});
test('older verified amount with newer ambiguity remains dated and visibly qualified',()=>{
 const r={...dto(),reasons:['NEWER_AMBIGUOUS_RECORD'],alternatives:[{sourceKind:'PURCHASE_DOCUMENT',amountExact:'13.00000000',currency:'TRY',unitLabel:'PAKET',date:'2026-10-05',reason:'NEWER_UNVERIFIED'}]};const html=renderLastPurchaseReference(r);assert.match(html,/01.10.2026/);assert.match(html,/Daha yeni veya aynı tarihli belirsiz kayıt/);assert.match(html,/bulunan son doğrulanmış alışa/);
});
test('untrusted identities, enum, date, currency/unit and rational values are rejected',()=>{
 for(const patch of [{schemaVersion:'v1'},{productId:'2'},{stockCode:'161 MOLLY'},{referenceCurrency:null},{referenceUnitLabel:null},{referenceDate:'2026-02-30'},{sourceKind:'SALE'},{referenceExact:'-1.00000000'},{referenceNumerator:'24'},{precisionStatus:'TRUNCATED_18'},{alternatives:[{}]}])assert.throws(()=>lastPurchaseReferenceEnvelope(envelope({...dto(),...patch}),'1','0161 MOLLY'));
 assert.throws(()=>lastPurchaseReferenceEnvelope({...envelope(dto()),meta:{readOnly:true,financialEffect:true}},'1','0161 MOLLY'));
});
test('explicit recurring quotient is preserved and labels are escaped',()=>{
 const r={...dto(),referenceExact:'0.333333333333333333',referenceNumerator:'1',referenceDenominator:'3',precisionStatus:'TRUNCATED_18',referenceUnitLabel:'<img onerror=alert(1)>'};lastPurchaseReferenceEnvelope(envelope(r),'1','0161 MOLLY');const html=renderLastPurchaseReference(r);assert.match(html,/0,333333333333333333 TRY/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
test('commercial entry is labelled as entry and manual value remains protected',()=>{
 const r={...dto(),sourceKind:'COMMERCIAL_ENTRY'};assert.match(renderLastPurchaseReference(r),/Giriş kaydı/);assert.match(renderLastPurchaseReference(r),/Geçerli alış belgesi bulunmadığından/);
 const manual={...dto(),protectedManual:true,status:'PROTECTED_MANUAL',cardAmountExact:null,referenceExact:null,referenceNumerator:null,referenceDenominator:null,precisionStatus:null};lastPurchaseReferenceEnvelope(envelope(manual),'1','0161 MOLLY');assert.match(renderLastPurchaseReference(manual),/Elle düzenlenmiş alış bilgisi korunuyor/);
});
