import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkInboundService} from './workInboundService.mjs';
import {canonical,countDto,countInput,hash,inboundCapabilities} from './workInboundModel.mjs';
const requestId='25826e43-f3f2-4ffc-9b10-5a9a412c7bcb',otherId='398cae93-ed0a-4b37-a76f-8cab77d971b2';
const seller={id:'15',permissions:['goods.view','goods.create','purchase.view']},office={id:'16',testAdminSession:true,permissions:['sales.view','goods.view','goods.create','goods.approve','goods.reject','purchase.view','purchase.create','purchase.finalize','purchase.cancel','supplier.view']};
const products=[{id:'301985',stockCode:'TEST-V70-GOODS-P',name:'Ürün 1',barcode:'00001',stockQuantityExact3:'29.000',purchasePriceExact8:'60.00000000'},{id:'325503',stockCode:'TEST-FINISH-GOODS-P2',name:'Ürün 2',barcode:null,stockQuantityExact3:'2.000',purchasePriceExact8:'80.00000000'}];
const line=(productId='301985')=>({clientLineId:'line-1',productId,barcode:productId===null?'009999':null,stockCode:null,physicalQuantityExact3:'2.000',expectedQuantityExact3:null,issue:null,note:''});
test('purchase GET provenance follows admitted invoice, batches once, and stays absent from mutation DTO/journal',async()=>{
 const f=fixture(),events=[],invoice={id:91,batchId:7,status:'draft',number:'TSTB-READ',date:'2026-10-09',currency:'TRY',lines:[],totals:{subtotal:60,grandTotal:60}};
 const basis={source:'stored-native-invoice',supplierId:'13370',receiptId:'7',documentCurrency:'TRY',documentExchangeRateExact8:'1.00000000',accountCurrency:'TRY',accountExchangeRateExact8:'1.00000000',accountAmountExact4:'60.0000',amountTryExact4:'60.0000'};
 f.c.getPurchase=async target=>{events.push('admit:'+target);return invoice;};
 f.c.recordedInvoiceBases=async values=>{events.push('basis');assert.deepEqual(values,[invoice]);assert.equal(f.transactions.at(-1),'read');return new Map([['91',basis]]);};
 assert.deepEqual((await f.service.purchaseGet('91',office)).recordedInvoiceBasis,basis);assert.deepEqual(events,['admit:91','basis']);
 f.c.batches=async()=>({batches:[],invoiceDrafts:[invoice]});assert.deepEqual((await f.service.purchaseContext(office)).drafts[0].recordedInvoiceBasis,basis);
 f.c.decidePurchase=async()=>invoice;assert.equal(Object.hasOwn((await f.service.purchaseDecide('91',{requestId},office)).invoice,'recordedInvoiceBasis'),false);
 f.c.recordedInvoiceBases=undefined;assert.equal(Object.hasOwn(await f.service.purchaseGet('91',office),'recordedInvoiceBasis'),false);
 let called=false;f.c.recordedInvoiceBases=async()=>{called=true;throw Error();};await assert.rejects(f.service.purchaseGet('91',seller),{statusCode:403});assert.equal(called,false);
 f.c.getPurchase=async()=>{throw Object.assign(Error(),{statusCode:404});};await assert.rejects(f.service.purchaseGet('91',office),{statusCode:404});assert.equal(called,false);
});
function fixture(){let current=null,version=0,native=0;const history=new Map(),transactions=[];const actual={permissions:office.permissions};const c={actual,products,supplier:{id:'13370',code:'TEST-V70-GOODS-S',name:'Tedarikçi',currency:'TRY',balanceExact4:'-100.0000'},warehouse:{id:'1',label:'Depo'},batches:async()=>({batches:[],invoiceDrafts:[]}),list:async()=>current?[structuredClone(current)]:[],draft:async()=>structuredClone(current),save:async(target,input,state,receiptId=null)=>{current=countDto({id:target??'1',created_by:15,state,version:++version,note:input.note,lines:input.lines,receipt_id:receiptId});return structuredClone(current);},createBatch:async input=>{native++;assert.equal(transactions.at(-1),'write');return{id:7,supplierId:13370,warehouseId:1,state:'pending',note:input.note,lines:input.lines.map((l,i)=>({id:i+1,...l,stockCode:products[i].stockCode,productName:products[i].name,receivedQuantity:0,invoiceableQuantity:0,purchasePrice:60}))};}};
 c.home=async()=>({countDrafts:current?[{id:current.id,state:current.state}]:[],receipts:[],drafts:[]});
 const store={read:async(actor,fn)=>{transactions.push('read');return fn(c);},mutate:async(actor,fn)=>{transactions.push('write');c.journal=async(operation,payload,execute)=>{const digest=hash({actor:actor.id,operation,payload}),prior=history.get(payload.requestId);if(prior){if(prior.digest!==digest)throw Object.assign(Error(),{statusCode:409});return{...structuredClone(prior.value),replayed:true};}const value=await execute();history.set(payload.requestId,{digest,value:structuredClone(value)});return value;};return fn(c);}};
 return{service:createWorkInboundService({getStore:async()=>store}),c,history,transactions,native:()=>native};}
test('count payload preserves literal unknown identity and rejects guesses, duplicate products and spoofed prices',()=>{
 const value=countInput({requestId,note:'',lines:[line(null)]},products);assert.equal(value.lines[0].barcode,'009999');assert.equal(value.lines[0].productId,null);
 for(const patch of [l=>l.expectedQuantityExact3='0.000',l=>l.physicalQuantityExact3='1.500',l=>l.barcode='00002',l=>l.purchasePrice=60,l=>l.productId='301986']){const l=line();patch(l);assert.throws(()=>countInput({requestId,note:'',lines:[l]},products));}
 assert.throws(()=>countInput({requestId,note:'',lines:[line(),{...line(),clientLineId:'line-2'}]},products));
});
test('personnel receiving stays nonfinancial even when existing purchase.view is present',async()=>{
 const f=fixture(),data=await f.service.context(seller);assert.equal(data.capabilities.canViewPurchase,false);const json=JSON.stringify(data);for(const secret of ['purchasePrice','balanceExact4','invoiceDrafts','grandTotal'])assert.equal(json.includes(secret),false);await assert.rejects(f.service.purchaseContext(seller),{statusCode:403});assert.equal(inboundCapabilities(office,{permissions:[]}).canApprove,false);
 const financialRevoked=inboundCapabilities(office,{permissions:['sales.view','supplier.view']});assert.equal(financialRevoked.canViewPurchase,false);assert.equal(financialRevoked.canCreatePurchase,false);assert.equal(financialRevoked.canViewSupplier,false);
});
test('business selected USD account projects currency correctly and blocks missing or mismatched source purchase quotes',async()=>{
 const f=fixture();f.c.copyContext={scopeKind:'VERIFIED_BUSINESS_TEST',date:'2026-10-09',operationOrigin:'ISOLATED_TEST_COPY',copyId:requestId,sealHash:'a'.repeat(64)};f.c.supplier={...f.c.supplier,currency:'USD',accountId:'32'};
 f.c.products=products.map(p=>({...p,purchasePriceExact8:'2.50000000',purchaseCurrency:'USD',stockUnitCostTryExact8:'9.25000000',costExact4:'9.2500'}));
 const batch={id:7,supplierId:13370,warehouseId:1,state:'accepted',note:'',lines:[{id:1,productId:301985,stockCode:products[0].stockCode,productName:'Fixture',quantity:2,unit:'ADET',purchasePrice:2.5,unitCostTry:9.25,receivedQuantity:2,invoiceableQuantity:2}]};f.c.batches=async()=>({batches:[batch],invoiceDrafts:[]});
 const selected={receiptId:'7',number:'TSTB-USD-1',documentDate:'2026-10-09',currency:'USD',lines:[{receiptLineId:'1',quantityExact3:'1.000'}]};
 const shown=await f.service.purchaseContext(office);assert.equal(shown.scope.supplier.currency,'USD');assert.equal(shown.scope.supplier.accountId,'32');assert.equal(shown.scope.products[0].purchasePriceExact8,'2.50000000');
 const preview=await f.service.preview(selected,office);assert.equal(preview.currency,'USD');assert.equal(preview.items[0].purchasePriceExact8,'2.50000000');assert.equal(preview.totals.grandTotalExact4,'2.5000');
 await assert.rejects(f.service.preview({...selected,currency:'TRY'},office),{code:'INBOUND_PURCHASE'});
 f.c.products[0].purchaseCurrency='TRY';assert.equal((await f.service.purchaseContext(office)).scope.products[0].purchasePriceExact8,null);
 batch.lines[0].purchasePrice=null;await assert.rejects(f.service.preview(selected,office),{code:'INBOUND_PURCHASE_SOURCE_REQUIRED'});
 const receiving=await f.service.context(seller);for(const key of ['purchasePriceExact8','costExact4','stockUnitCostTryExact8','purchaseCurrency','balanceExact4'])assert(!JSON.stringify(receiving).includes(key));
});
test('business purchase draft rejects an unsealed date before receipt read/journal/native and preserves legacy date behavior',async()=>{
 const f=fixture();f.c.copyContext={scopeKind:'VERIFIED_BUSINESS_TEST',date:'2026-10-09'};let reads=0,writes=0;
 f.c.batches=async()=>{reads++;return{batches:[{id:7,state:'accepted',lines:[{id:1,productId:301985,purchasePrice:60,invoiceableQuantity:2}]}],invoiceDrafts:[]};};
 f.c.createPurchase=async input=>f.c.journal('purchase_draft',input,async()=>{writes++;return{id:9,...input,status:'draft',lines:[],totals:{subtotal:60,grandTotal:60}};});
 const input={requestId,receiptId:'7',number:'TSTB-DATE-1',documentDate:'2026-10-08',currency:'TRY',lines:[{receiptLineId:'1',quantityExact3:'1.000'}]};
 await assert.rejects(f.service.purchaseDraft(input,office),{code:'INBOUND_DATE_OUTSIDE_SCOPE',statusCode:400});assert.equal(reads,0);assert.equal(writes,0);assert.equal(f.history.size,0);
 assert.equal((await f.service.purchaseDraft({...input,documentDate:'2026-10-09'},office)).invoice.documentDate,'2026-10-09');assert.equal(writes,1);assert.equal(f.history.size,1);
 for(const copyContext of [undefined,{target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'},date:'2026-10-09'}]){f.c.copyContext=copyContext;assert.equal((await f.service.purchaseDraft({...input,requestId:crypto.randomUUID()},office)).invoice.documentDate,'2026-10-08');}
});
test('unknown row remains persistent needs_review and cannot reach native submit; cancel retains history',async()=>{
 const f=fixture(),created=await f.service.create({requestId,note:'Barkod inceleme',lines:[line(null)]},seller);assert.equal(created.draft.state,'needs_review');assert.equal(created.draft.lines[0].barcode,'009999');
 await assert.rejects(f.service.submit('1',{requestId:otherId,expectedRevision:created.draft.revision},seller),{statusCode:409});assert.equal(f.native(),0);
 const cancelled=await f.service.cancel('1',{requestId:otherId,expectedRevision:created.draft.revision,reason:'Yanlış sayım satırı'},seller);assert.equal(cancelled.draft.state,'cancelled');assert.equal(f.history.get(requestId).value.draft.state,'needs_review');
});
test('business purchase cancellation is unavailable before journal/native mutation while finalized/read capability remains',async()=>{
 const f=fixture();f.c.copyContext={scopeKind:'VERIFIED_BUSINESS_TEST'};let called=false;f.c.decidePurchase=async()=>{called=true;throw Error('must not call');};
 const current=await f.service.context(office);assert.equal(current.capabilities.canCancelPurchase,false);assert.equal(current.capabilities.canFinalizePurchase,true);assert.equal(current.capabilities.canViewPurchase,true);
 await assert.rejects(f.service.purchaseDecide('1',{requestId,reason:'Sentetik yanlış belge'},office,true),{statusCode:403,code:'INBOUND_OPERATION_NOT_VERIFIED'});assert.equal(called,false);assert.equal(f.history.size,0);
 assert.equal(inboundCapabilities(office,f.c.actual).canCancelPurchase,true);
});
test('business three-line create/update reject before journal/save/native while old TEST retains up to20 rows',async()=>{
 const lines=[line(),{...line('325503'),clientLineId:'line-2'},{...line(null),clientLineId:'line-3'}],body={requestId,note:'Three line boundary',lines},f=fixture();f.c.copyContext={scopeKind:'VERIFIED_BUSINESS_TEST'};
 await assert.rejects(f.service.create(body,seller),{code:'INBOUND_LINES',statusCode:400,message:'1–2 sayım satırı gerekli.'});assert.equal(f.history.size,0);assert.equal((await f.c.list()).length,0);assert.equal(f.native(),0);
 const created=await f.service.create({...body,lines:lines.slice(0,2)},seller);assert.equal(created.draft.lines.length,2);assert.equal(f.history.size,1);
 await assert.rejects(f.service.update(created.draft.id,{...body,requestId:otherId,expectedRevision:created.draft.revision},seller),{code:'INBOUND_LINES',statusCode:400});assert.equal(f.history.size,1);assert.equal((await f.c.draft(created.draft.id)).revision,created.draft.revision);assert.equal(f.native(),0);
 const legacy=fixture();assert.equal((await legacy.service.create(body,seller)).draft.lines.length,3);
 const unknown20=Array.from({length:20},(_,i)=>({...line(null),clientLineId:'unknown-'+i,barcode:'UNKNOWN-'+i}));assert.equal(countInput({...body,lines:unknown20},products).lines.length,20);assert.throws(()=>countInput({...body,lines:[...unknown20,{...line(null),clientLineId:'extra'}]},products),{code:'INBOUND_LINES'});
 const old01=fixture();old01.c.copyContext={scopeKind:undefined,target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}};assert.equal((await old01.service.create(body,seller)).draft.lines.length,3);
});
test('count CAS rejects stale updates; full actor/body UUID replay precedes CAS and submit posts native batch once',async()=>{
 const f=fixture(),created=await f.service.create({requestId,note:'',lines:[line()]},seller),body={requestId:otherId,expectedRevision:created.draft.revision};
 await assert.rejects(f.service.update('1',{...body,expectedRevision:'a'.repeat(64),note:'',lines:[line()]},seller),{statusCode:409});
 const result=await f.service.submit('1',body,seller);assert.equal(result.draft.state,'submitted');assert.equal(result.receipt.id,'7');assert.equal(f.native(),1);assert.equal((await f.service.submit('1',body,seller)).replayed,true);assert.equal(f.native(),1);
 await assert.rejects(f.service.submit('1',{...body,expectedRevision:'b'.repeat(64)},seller),{statusCode:409});
});
test('office resolves unknown by explicit verified product while prior identity remains immutable',async()=>{
 const f=fixture(),created=await f.service.create({requestId,note:'',lines:[line(null)]},seller);const updated=await f.service.update('1',{requestId:otherId,expectedRevision:created.draft.revision,note:'Kart bulundu',lines:[line()]},office);assert.equal(updated.draft.state,'draft');assert.equal(f.history.get(requestId).value.draft.lines[0].productId,null);assert.equal(updated.draft.lines[0].productId,'301985');
});
test('current permission revocation denies before replay; HOME carries no monetary values',async()=>{
 const f=fixture(),body={requestId,note:'',lines:[line()]};await f.service.create(body,seller);f.c.actual.permissions=[];await assert.rejects(f.service.create(body,seller),{statusCode:403});f.c.actual.permissions=office.permissions;const home=await f.service.home(office);assert.equal(home.countDrafts.length,1);assert.equal(JSON.stringify(home).includes('60.00000000'),false);assert.equal(JSON.stringify(home).includes('balance'),false);
});


test('business Semih identity cannot borrow the older receiving actor scope, even with every receiving permission',async()=>{
 let storeCalls=0;const service=createWorkInboundService({getStore:async()=>{storeCalls++;assert.fail('unbound actor must not reach native storage');}});
 await assert.rejects(()=>service.context({id:'17',role:{code:'unified_test_semih'},permissions:[...office.permissions,'settings.manage']}),e=>e.code==='INBOUND_FORBIDDEN'&&e.statusCode===403);
 assert.equal(storeCalls,0);
});
