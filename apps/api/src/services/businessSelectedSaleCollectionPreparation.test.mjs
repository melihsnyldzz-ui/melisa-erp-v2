import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {bindIsolatedCopyOperationDTO,isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {buildBusinessSelectedSalePreview,SELECTED_SALE_JOIN_SQL} from './workTradeStore.mjs';
import {workExact,workHash,workScaled} from './workSalesModel.mjs';
import {createBusinessSelectedSaleCollectionPreparation,prepareBusinessSelectedSaleCollection,SOURCE_COLLECTION_COLLECTOR_SQL,SOURCE_COLLECTION_ACCOUNT_SQL} from './businessSelectedSaleCollectionPreparation.mjs';

const rights=['finance.view','customer.view','finance.collection','finance.collection.cancel'];
const collector=()=>({id:'16',role:{code:'isolated_test_ilker'},permissions:[...rights]});
const uuid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
 const copy=selectedSaleFixture().c,customer=copy.customers.find(p=>p.currency==='TRY'),product=copy.products[0],account=copy.financeAccounts.find(p=>p.currency==='TRY');
 const origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const context=bindIsolatedCopyOperationDTO(copy,{meta:{date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},revision:'a'.repeat(64),capabilities:{canCreate:true,canCollect:false,canCancelCollection:false},limits:{maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4},scope:{...origin,customer:{...customer,...origin,writeEligible:true},accounts:[{...account,...origin,name:'Offline cash'}],products:[{...origin,id:product.id,stockCode:product.stockCode,name:'Offline SOURCE item',barcode:product.barcodes[0],costExact4:product.costExact4,writeEligible:true,unit:{label:product.unit,factorExact8:product.unitFactorExact8},stockQuantityExact3:'10.000',prices:product.quotes.filter(p=>p.currency==='TRY').map(p=>({quoteId:p.quoteId,currency:p.currency,unitPriceExact8:p.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}))}]}});
 const input={customerId:customer.id,documentDate:copy.date,currency:'TRY',items:[{productId:product.id,quoteId:product.quotes.find(p=>p.currency==='TRY').quoteId,quantityExact3:'8.000'}]},p=buildBusinessSelectedSalePreview(copy,input,context),requestId=uuid(1);
 const draft={id:'1000',documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:copy.date,status:'draft',customerId:customer.id,currency:'TRY',subtotalExact4:p.subtotalExact4,grandTotalExact4:p.grandTotalExact4,amountTryExact4:p.amountTryExact4};
 const payload={...input,requestId,expectedRevision:p.scopeRevision,previewHash:p.previewHash,businessCustomerId:customer.id,businessAccountId:customer.accountId,businessCurrency:'TRY',businessProductIds:[product.id],businessSelectedSalePolicyHash:p.policyHash,sourceSelectionHash:p.sourceSelectionHash,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,actorId:'15',operation:'sale_draft'};
 const row={...draft,status:'finalized',invoice_id:draft.id,request_id:requestId,actor_id:'15',preview_json:JSON.stringify({...p,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin}),copy_id:copy.copyId,journal_request_id:requestId,journal_actor_id:'15',operation:'sale_draft',payload_hash:isolatedCopyHash(payload),payload_json:isolatedCopyJSON(payload),response_json:isolatedCopyJSON({invoice:{...draft,items:p.items.map(i=>({...i,currency:'TRY'}))},requestId,replayed:false}),accountCurrency:'TRY',accountAmountExact4:p.grandTotalExact4,documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',createdBy:'15'};
 const items=p.items.map(i=>({...i,currency:'TRY',averageCostTryExact4:product.costExact4})),events=[],transaction={},actual={rights:[...rights],active:true,roleActive:true,role:'isolated_test_ilker',accounts:[{id:account.id,currency:'TRY',isActive:true,type:account.type}]};
 let state={records:[],requests:new Map(),customerDebt:workScaled(p.grandTotalExact4,4),cash:0n,stockEffects:0,version:0};
 const revision=()=>workHash({version:state.version,records:state.records});
 const invoice=()=>({...draft,status:'finalized',revision:revision(),collections:{receivedExact4:workExact(state.records.filter(r=>r.status==='active').reduce((n,r)=>n+workScaled(r.amountExact4,4),0n),4),outstandingExact4:workExact(state.customerDebt,4),revision:revision(),items:structuredClone(state.records)}});
 const c={copyContext:copy,context,transaction,sql:{BigInt:'bigint',UniqueIdentifier:'uuid'},request:()=>({parent:transaction,input(){return this;},async query(sql){events.push(sql===SOURCE_COLLECTION_COLLECTOR_SQL?'authority':sql===SOURCE_COLLECTION_ACCOUNT_SQL?'account':'source');if(sql===SOURCE_COLLECTION_COLLECTOR_SQL)return {recordset:actual.rights.map(permissionKey=>({actorId:'16',roleCode:actual.role,userActive:actual.active,roleActive:actual.roleActive,permissionKey,canView:true}))};if(sql===SOURCE_COLLECTION_ACCOUNT_SQL)return {recordset:structuredClone(actual.accounts)};assert.equal(sql,SELECTED_SALE_JOIN_SQL);return {recordsets:[[structuredClone(row)],structuredClone(items)]};}}),invoice:async id=>{assert.equal(id,'1000');return invoice();},collection:async id=>{const r=state.records.find(r=>r.id===id);assert(r);return {...r,revision:revision()};},
  collect:async preview=>{events.push('collect');const amount=workScaled(preview.amountExact4,4),r={id:String(2000+state.records.length),invoiceId:'1000',accountId:account.id,currency:'TRY',amountExact4:preview.amountExact4,documentDate:copy.date,status:'active'};state.customerDebt-=amount;state.cash+=amount;state.records.push(r);state.version++;return {...r,revision:revision()};},
  cancelCollection:async id=>{events.push('reverse');const r=state.records.find(r=>r.id===id);assert.equal(r.status,'active');r.status='cancelled';const amount=workScaled(r.amountExact4,4);state.customerDebt+=amount;state.cash-=amount;state.version++;return {...r,revision:revision()};},
  journal:async(operation,body,fn)=>{events.push('journal');const hash=workHash({actorId:'16',operation,payload:body}),old=state.requests.get(body.requestId);if(old){if(old.hash!==hash)throw Object.assign(Error('Conflict'),{code:'PREPARATION_UUID_CONFLICT',statusCode:409});return {...structuredClone(old.response),replayed:true};}const response=await fn();state.requests.set(body.requestId,{hash,response:structuredClone(response)});return response;},
 };
 const withContext=async(actor,fn)=>{const before=structuredClone(state);try{return await fn(c);}catch(error){state=before;throw error;}};
 const service=createBusinessSelectedSaleCollectionPreparation({withContext});
 return {copy,context,c,row,items,actual,events,service,state:()=>state,invoice,selection:amountExact4=>({invoiceId:'1000',accountId:account.id,amountExact4,documentDate:copy.date})};
}
async function pay(f,n,amount){const selection=f.selection(amount),p=await f.service.preview(selection,collector()),body={...selection,requestId:uuid(n),expectedRevision:p.revision,previewHash:p.previewHash};return {body,response:await f.service.collect(body,collector())};}

test('SOURCE preparation separately proves creator15 and fresh collector16 without enabling existing runtime capabilities',async()=>{
 const f=fixture(),p=await prepareBusinessSelectedSaleCollection(f.c,collector(),'1000');
 assert.equal(p.proof.creatorId,'15');assert.equal(p.proof.collectorId,'16');assert.equal(p.proof.customerAccountId,f.copy.customers[0].accountId);assert.equal(p.proof.preparationOnly,true);
 assert.equal(p.context.capabilities.canCollect,true);assert.equal(f.context.capabilities.canCollect,false);assert.equal(f.context.capabilities.canCancelCollection,false);assert.equal(f.row.actor_id,'15');assert.equal(f.row.createdBy,'15');
 assert.equal((await f.service.context({invoiceId:'1000'},collector())).invoice.id,'1000');assert.equal(f.state().requests.size,0);
});

test('SOURCE partial/full/cancel executes existing collection service arithmetic and isolated journal replay with no stock effects',async()=>{
 const f=fixture(),first=await pay(f,2,'5.0000');assert.equal(first.response.invoice.collections.outstandingExact4,'19.0000');assert.equal(f.state().cash,50000n);
 const full=await pay(f,3,'19.0000');assert.equal(full.response.invoice.collections.outstandingExact4,'0.0000');assert.equal(f.state().customerDebt,0n);
 assert.equal((await f.service.collect(first.body,collector())).replayed,true);assert.equal((await f.service.collect(full.body,collector())).replayed,true);assert.equal(f.events.filter(e=>e==='collect').length,2);
 const r=await f.c.collection(full.response.collection.id),cancel={requestId:uuid(4),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline source cancellation'};
 assert.equal((await f.service.cancel(r.id,cancel,collector())).invoice.collections.outstandingExact4,'19.0000');assert.equal((await f.service.cancel(r.id,cancel,collector())).replayed,true);
 const r2=await f.c.collection(first.response.collection.id);await f.service.cancel(r2.id,{...cancel,requestId:uuid(5),expectedRevision:r2.revision},collector());assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().cash,0n);assert.equal(f.state().stockEffects,0);assert.equal(f.events.filter(e=>e==='reverse').length,2);
});

test('SOURCE overpayment, stale preview and different-body UUID never create another effect',async()=>{
 const f=fixture(),s=f.selection('5.0000'),old=await f.service.preview(s,collector());const first=await pay(f,2,'5.0000');
 await assert.rejects(f.service.collect({...s,requestId:uuid(3),expectedRevision:old.revision,previewHash:old.previewHash},collector()),{code:'WORK_STALE'});
 await assert.rejects(f.service.collect({...first.body,amountExact4:'6.0000'},collector()),{code:'PREPARATION_UUID_CONFLICT'});
 await assert.rejects(f.service.preview(f.selection('20.0000'),collector()),{code:'WORK_COLLECTION_EXCESS'});
 assert.equal(f.state().requests.size,1);assert.equal(f.events.filter(e=>e==='collect').length,1);
});

test('SOURCE creator15, wrong collector, admin session and revoked current rights fail before source or replay',async()=>{
 for(const actor of [{...collector(),id:'15',role:{code:'isolated_test_sales'}},{...collector(),id:'17'},{...collector(),testAdminSession:true},{...collector(),role:{code:'admin'}},{...collector(),permissions:rights.filter(k=>k!=='customer.view')}]){const f=fixture();await assert.rejects(f.service.context({invoiceId:'1000'},actor),{statusCode:403});assert(!f.events.includes('source'));}
 const f=fixture(),first=await pay(f,2,'5.0000');f.actual.rights=f.actual.rights.filter(k=>k!=='finance.collection');f.events.length=0;
 await assert.rejects(f.service.collect(first.body,collector()),{statusCode:403});assert(!f.events.includes('journal'));assert(!f.events.includes('collect'));
});

test('SOURCE disabled current role and cancellation-right revocation cannot borrow creator authority',async()=>{
 for(const key of ['active','roleActive']){const f=fixture();f.actual[key]=false;await assert.rejects(f.service.context({invoiceId:'1000'},collector()),{statusCode:403});assert.equal(f.state().requests.size,0);}
 const f=fixture(),p=await pay(f,2,'5.0000'),r=await f.c.collection(p.response.collection.id);f.actual.rights=f.actual.rights.filter(k=>k!=='finance.collection.cancel');
 await assert.rejects(f.service.cancel(r.id,{requestId:uuid(3),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline cancellation'},collector()),{statusCode:403});assert.equal(f.events.filter(e=>e==='reverse').length,0);
});

test('SOURCE current account absence, disabled, currency or type drift blocks preview and replay before journal',async()=>{
 const changes=[f=>f.actual.accounts=[],f=>f.actual.accounts[0].isActive=false,f=>f.actual.accounts[0].currency='USD',f=>f.actual.accounts[0].type='bank',f=>f.actual.accounts[0].type='other',f=>f.actual.accounts[0].id='999',f=>f.actual.accounts.push({...f.actual.accounts[0]})];
 for(const change of changes){const f=fixture(),first=await pay(f,2,'5.0000');change(f);f.events.length=0;
  await assert.rejects(f.service.preview(f.selection('1.0000'),collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  await assert.rejects(f.service.collect(first.body,collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  const original=await f.c.collection(first.response.collection.id);
  await assert.rejects(f.service.cancel(original.id,{requestId:uuid(3),expectedRevision:original.revision,documentDate:f.copy.date,reason:'Offline account drift'},collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  assert(!f.events.includes('journal'));assert(!f.events.includes('collect'));assert(!f.events.includes('reverse'));assert.equal(f.state().requests.size,1);assert.equal(f.state().cash,50000n);
 }
 assert.match(SOURCE_COLLECTION_ACCOUNT_SQL,/WITH\(HOLDLOCK\) WHERE a.id=@account/);
});

test('SOURCE foreign invoice, account/currency and transaction substitution fail closed',async()=>{
 const f=fixture();await assert.rejects(f.service.context({invoiceId:'1001'},collector()));assert.equal(f.state().requests.size,0);
 await assert.rejects(f.service.preview({...f.selection('1.0000'),accountId:'999'},collector()),{code:'WORK_COLLECTION_SCOPE'});
 await assert.rejects(f.service.preview({...f.selection('1.0000'),documentDate:'2026-10-10'},collector()),{code:'WORK_DATE_SCOPE'});
 for(const change of [f=>f.context.scope.accounts[0].currency='USD',f=>f.context.scope.customer.accountId='999',f=>f.c.transaction={},f=>f.row.currency='USD',f=>f.row.accountCurrency='USD']){const f=fixture();change(f);await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);}
});

test('SOURCE cancelled invoice or unverified collection totals refuse preparation instead of borrowing old debt',async()=>{
 const f=fixture();f.row.status='cancelled';await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);
 const g=fixture(),read=g.c.invoice;g.c.invoice=async id=>{const i=await read(id);i.collections.outstandingExact4='0.0000';return i;};
 await assert.rejects(g.service.preview(g.selection('1.0000'),collector()));assert.equal(g.state().cash,0n);
});

test('SOURCE different-UUID second cancel is stale while actor16 exact replay remains allowed',async()=>{
 const f=fixture(),p=await pay(f,2,'5.0000'),r=await f.c.collection(p.response.collection.id),body={requestId:uuid(3),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline original reversal'};
 await f.service.cancel(r.id,body,collector());
 await assert.rejects(f.service.cancel(r.id,{...body,requestId:uuid(4)},collector()),{code:'WORK_STALE'});
 assert.equal((await f.service.cancel(r.id,body,collector())).replayed,true);assert.equal(f.events.filter(e=>e==='reverse').length,1);assert.equal(f.state().cash,0n);
});

test('SOURCE altered creator/link/copy/seal/policy/amount/native cost cannot use the preparation route',async()=>{
 const changes=[f=>f.row.actor_id='16',f=>f.row.createdBy='16',f=>f.row.request_id=uuid(7),f=>f.row.copy_id='10000000-0000-4000-8000-000000000099',f=>f.row.payload_hash='F'.repeat(64),f=>f.row.grandTotalExact4='0.0000',f=>f.items[0].averageCostTryExact4='0.0000',f=>{const p=JSON.parse(f.row.preview_json);p.sealHash='F'.repeat(64);f.row.preview_json=JSON.stringify(p);},f=>{const p=JSON.parse(f.row.preview_json);p.policyHash='F'.repeat(64);f.row.preview_json=JSON.stringify(p);}];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);}
});

test('SOURCE journal failure rolls back isolated financial effects; no default/native store is provided',async()=>{
 assert.throws(()=>createBusinessSelectedSaleCollectionPreparation(),{code:'SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED'});
 const f=fixture(),original=f.c.journal;f.c.journal=async(...args)=>{await original(...args);throw Error('Offline rollback');};
 await assert.rejects(pay(f,2,'5.0000'));assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().stockEffects,0);
});
