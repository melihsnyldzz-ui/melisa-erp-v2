import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkInboundFxService,workInboundFxDocument,workInboundFxPreview} from './workInboundFxService.mjs';
const requestId='25826e43-f3f2-4ffc-9b10-5a9a412c7bcb',revision='A'.repeat(64),previewHash='b'.repeat(64);
const actor={id:'16',testAdminSession:true,permissions:['sales.view','product.view','purchase.view','goods.create','goods.approve','goods.reject','purchase.create','purchase.finalize','purchase.cancel']};
const selected={productId:'301986',priceId:'279225',versionId:'7',revision};
const proof=s=>({source:'native-operational-price',...s,actorId:'16',changedAt:'2026-10-05T08:18:41.366Z',reason:'Doğrulanmış fiyat sürümü'});
const rates=['TRY','USD','EUR'].map(currency=>({currency,rateToTryExact8:currency==='TRY'?'1.00000000':currency==='USD'?'40.00000000':'45.00000000',source:'synthetic-test',sourceId:'C03-FX-20261004-'+currency,asOf:'2026-10-04',version:'1',hash:'c'.repeat(64)}));
const preview=()=>({selection:{...selected},quantity:1,date:'2026-10-04',currency:'USD',accountCurrency:'TRY',sourceProof:proof(selected),operationalUnit:{productId:'301986',unit:'ADET',factorExact8:'1.00000000',source:'synthetic-copy-unit-evidence',hash:'d'.repeat(64)},synthetic:true,targetProductId:301986,supplierId:13373,priceExact:'1.34567890',nativePriceExact4:'1.3457',documentAmountExact4:'1.3457',accountAmountExact4:'53.8280',amountTryExact4:'53.8280',rates:{document:rates[1],account:rates[0]},writable:true,blockedCode:null,previewHash});
const document=()=>({...preview(),id:9,intentId:3,receiptId:8,invoiceId:9,status:'finalized',number:'TDAY-C09-'+previewHash.slice(0,20),invoice:{averageCostTry:62.6994,private:'not-exposed'}});
const input=()=>({selection:{...selected},quantityExact3:'1.000',documentDate:'2026-10-04',rateVersion:'1'});
function fixture(){
 const calls=[],actual={id:'16',role:{code:'isolated_test_ilker'},permissions:['sales.view','product.view','purchase.view']},quoteEUR={productId:'301986',priceId:'279226',versionId:'5',revision};
 const raw={environment:'ISOLATED_TEST',fixture:{productId:301986,supplierId:13373,stockCode:'TEST-DAILY-PURCHASE',name:'Kayıtlı ürün',supplierName:'Kayıtlı tedarikçi',supplierCurrency:'TRY',supplierBalanceExact4:'60.0000',currentAverageCostTryExact4:'62.6994',unit:'ADET',factorExact8:'1.00000000',warehouse:'TEST-DAILY-WH',date:'2026-10-04',maxQuantity:5,maxAmountTryExact4:'200.0000',currentStock:31,maxStock:40},quotes:[{selection:{...selected},currency:'USD',priceExact:'1.34567890',sourceProof:proof(selected)},{selection:quoteEUR,currency:'EUR',priceExact:null,sourceProof:proof(quoteEUR)}],rates,receipts:[{...document(),id:8,state:'approved'}],invoiceDrafts:[document()]};
 const consumer={context:async a=>{calls.push(['context',a]);return structuredClone(raw);},preview:async(b,a)=>{calls.push(['preview',b,a]);return preview();}};
 for(const method of ['createReceipt','decideReceipt','createDraft','getDraft','finalizeDraft','cancelDraft'])consumer[method]=async(...args)=>{calls.push([method,...args]);return {...document(),replayed:true};};
 let authorizations=0;const service=createWorkInboundFxService({getActual:async()=>{authorizations++;return actual;},getConsumer:async()=>consumer});
 return {service,actual,calls,raw,consumer,authorizations:()=>authorizations};
}
test('current quotes only; known NULL, missing TRY and historical versions are preserved without cost/native payload leakage',async()=>{
 const f=fixture();f.raw.invoiceDrafts[0].selection.versionId='6';f.raw.invoiceDrafts[0].sourceProof.versionId='6';
 const data=await f.service.context(actor);assert.deepEqual(data.quotes.map(q=>q.currency),['USD','EUR']);assert.equal(data.quotes[1].priceExact8,null);assert.equal(data.scope.product.stockQuantityExact3,'31.000');assert.equal(data.drafts[0].selection.versionId,'6');assert.equal(data.receipts[0].id,data.receipts[0].receiptId);assert.equal(data.drafts[0].id,data.drafts[0].invoiceId);
 assert.equal(data.drafts[0].previewHash,previewHash);for(const key of ['averageCostTry','private','projection','currentAverageCostTryExact4'])assert.equal(JSON.stringify(data).includes(key),false);
});
test('office actual role and current view intersection are checked before any consumer call, including replay',async()=>{
 const f=fixture();await assert.rejects(f.service.context({...actor,id:'15'}),{statusCode:403});assert.equal(f.authorizations(),0);
 for(const change of [a=>a.permissions=['sales.view','product.view'],a=>a.role.code='other',a=>a.isActive=false]){const g=fixture();change(g.actual);await assert.rejects(g.service.createReceipt({...input(),requestId,previewHash},actor),{statusCode:403});assert.equal(g.calls.length,0);}
 await f.service.createReceipt({...input(),requestId,previewHash},actor);f.actual.permissions=[];await assert.rejects(f.service.createReceipt({...input(),requestId,previewHash},actor),{statusCode:403});assert.equal(f.calls.length,1);assert.equal(f.authorizations(),2);
});
test('verified admin projection uses actual sales.view and never bypasses revoked purchase/product read permission',async()=>{
 const f=fixture(),data=await f.service.context(actor);assert.equal(data.capabilities.canFinalizePurchase,true);await f.service.finalizeDraft('9',{requestId},actor);assert.ok(f.calls.at(-1).at(-1).permissions.includes('purchase.finalize'));
 const g=fixture();g.actual.permissions=['product.view','purchase.view'];await assert.rejects(g.service.finalizeDraft('9',{requestId},actor),{statusCode:403});assert.equal(g.calls.length,0);await assert.rejects(g.service.createDraft({requestId,receiptId:'8',previewHash},{...actor,testAdminSession:false}),{statusCode:403});
});
test('strict exact quantity, date, IDs, uppercase revision and fields fail before native input; preview hash stays opaque',async()=>{
 const f=fixture();for(const patch of [b=>b.quantityExact3='1.500',b=>b.quantityExact3=1,b=>b.documentDate='2026-10-06',b=>b.selection.revision='a'.repeat(64),b=>b.selection.priceId='9007199254740992',b=>b.priceExact8='1.00000000']){const body=input();patch(body);await assert.rejects(f.service.preview(body,actor),{statusCode:400});}
 assert.equal(f.calls.length,0);const value=await f.service.preview(input(),actor);assert.equal(value.previewHash,previewHash);assert.equal(value.priceExact8,'1.34567890');assert.equal(value.nativePriceExact4,'1.3457');assert.deepEqual(f.calls[0][1],{selection:selected,quantity:1,date:'2026-10-04',rateVersion:'1'});
});
test('unknown and real zero remain distinct blocked previews; untyped decimals/proof corruption fail closed',()=>{
 const unknown={...preview(),priceExact:null,nativePriceExact4:null,documentAmountExact4:null,accountAmountExact4:null,amountTryExact4:null,rates:null,writable:false,blockedCode:'PRICE_UNKNOWN'};assert.equal(workInboundFxPreview(unknown).priceExact8,null);assert.match(workInboundFxPreview(unknown).blockedReason,/bilinmiyor/);
 const zero={...unknown,priceExact:'0.00000000',nativePriceExact4:'0.0000',blockedCode:'PRICE_ZERO'};assert.equal(workInboundFxPreview(zero).priceExact8,'0.00000000');assert.match(workInboundFxPreview(zero).blockedReason,/Sıfır/);
 for(const patch of [p=>p.priceExact=1.3456789,p=>p.sourceProof.priceId='99',p=>p.rates.account.currency='USD',p=>p.documentAmountExact4=null,p=>p.quantity=null,p=>p.operationalUnit.factorExact8='2.00000000']){const p=structuredClone(preview());patch(p);assert.throws(()=>workInboundFxPreview(p),{statusCode:503});}
});
test('all lifecycle calls reuse original persistent consumer UUID and payload, never shadow journal or recalculate snapshots',async()=>{
 const f=fixture();const created=await f.service.createReceipt({...input(),requestId,previewHash},actor);assert.equal(created.replayed,true);assert.equal(created.requestId,requestId);
 await f.service.decideReceipt('8',{requestId,reason:'Kontrol edildi'},actor,true);await f.service.decideReceipt('8',{requestId,reason:'Uygun değil'},actor,false);await f.service.createDraft({requestId,receiptId:'8',previewHash},actor);await f.service.getDraft('9',actor);await f.service.finalizeDraft('9',{requestId},actor);await f.service.cancelDraft('9',{requestId,reason:'Kontrol iptali'},actor);
 assert.deepEqual(f.calls.map(c=>c[0]),['createReceipt','decideReceipt','decideReceipt','createDraft','getDraft','finalizeDraft','cancelDraft']);assert.equal(f.calls[0][1].previewHash,previewHash);assert.deepEqual(f.calls[3][1],{requestId,receiptId:8,previewHash});assert.equal(f.calls[1][1],8);assert.equal(f.calls[1][4],true);assert.equal(f.calls[2][4],false);assert.equal(f.authorizations(),7);
 const dto=workInboundFxDocument(document());assert.equal(dto.invoice,undefined);assert.equal(dto.selection.versionId,'7');assert.equal(dto.accountAmountExact4,'53.8280');
});
test('guard/runtime failures are sanitized and current price conflicts retain HTTP409 without fallback',async()=>{
 const f=fixture();f.consumer.preview=async()=>{throw Error('secret SQL detail');};await assert.rejects(f.service.preview(input(),actor),e=>e.statusCode===503&&!e.message.includes('SQL'));
 f.consumer.preview=async()=>{throw Object.assign(Error('Fiyat değişti.'),{statusCode:409});};await assert.rejects(f.service.preview(input(),actor),{statusCode:409});assert.equal(f.calls.length,0);
 f.raw.quotes[0].priceExact=1;await assert.rejects(f.service.context(actor),{statusCode:503});
});
