import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,bindIsolatedCopyOperationDTO} from './isolatedOperationCopyContext.mjs';
import {createIsolatedOperationCopyStore,ISOLATED_COPY_FINITE_FK_SQL,withSelectedSaleCollectionReadBridge} from './isolatedOperationCopyStoreFactory.mjs';
import {buildIsolatedCopyTradeDomain,buildBusinessSelectedSalePreview,SELECTED_SALE_JOIN_SQL} from './workTradeStore.mjs';
import {createBusinessSelectedSaleCollectionReadPreparation,SOURCE_COLLECTION_ACCOUNT_SQL,SOURCE_COLLECTION_COLLECTOR_SQL} from './businessSelectedSaleCollectionPreparation.mjs';
import {isolatedCopyTransactionContext,isIsolatedOperationCopyMutation} from './isolatedOperationCopyScope.mjs';

const rights=['sales.view','customer.view','finance.view','finance.collection'];
const actor=()=>({id:'16',role:{code:'isolated_test_ilker'},permissions:[...rights]});
const requestId='10000000-0000-4000-8000-000000000001';
function harness(){
 const copy=selectedSaleFixture().c,customer=copy.customers.find(c=>c.currency==='TRY'),product=copy.products[0],account=copy.financeAccounts.find(a=>a.currency==='TRY'),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const context={meta:{date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},revision:'a'.repeat(64),capabilities:{canCollect:false,canCancelCollection:false},limits:{maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4},scope:{...origin,customer:{...customer,...origin,writeEligible:true,balanceExact4:'24.0000'},accounts:[{...account,...origin}],products:[{...origin,id:product.id,stockCode:product.stockCode,name:'Offline SOURCE bridge item',barcode:product.barcodes[0],costExact4:product.costExact4,writeEligible:true,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'10.000',prices:product.quotes.filter(q=>q.currency==='TRY').map(q=>({quoteId:q.quoteId,currency:q.currency,unitPriceExact8:q.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}))}]}};
 bindIsolatedCopyOperationDTO(copy,context);
 const input={customerId:customer.id,documentDate:copy.date,currency:'TRY',items:[{productId:product.id,quoteId:product.quotes.find(q=>q.currency==='TRY').quoteId,quantityExact3:'8.000'}]},preview=buildBusinessSelectedSalePreview(copy,input,context);
 const draft={id:'1000',documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:copy.date,status:'draft',customerId:customer.id,currency:'TRY',subtotalExact4:preview.subtotalExact4,grandTotalExact4:preview.grandTotalExact4,amountTryExact4:preview.amountTryExact4};
 const payload={...input,requestId,expectedRevision:preview.scopeRevision,previewHash:preview.previewHash,businessCustomerId:customer.id,businessAccountId:customer.accountId,businessCurrency:'TRY',businessProductIds:[product.id],businessSelectedSalePolicyHash:preview.policyHash,sourceSelectionHash:preview.sourceSelectionHash,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,actorId:'15',operation:'sale_draft'};
 const row={...draft,status:'finalized',invoice_id:draft.id,request_id:requestId,actor_id:'15',preview_json:JSON.stringify({...preview,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin}),copy_id:copy.copyId,journal_request_id:requestId,journal_actor_id:'15',operation:'sale_draft',payload_hash:isolatedCopyHash(payload),payload_json:isolatedCopyJSON(payload),response_json:isolatedCopyJSON({invoice:{...draft,items:preview.items.map(i=>({...i,currency:'TRY'}))},requestId,replayed:false}),accountCurrency:'TRY',accountAmountExact4:preview.grandTotalExact4,documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',createdBy:'15'};
 const items=preview.items.map(i=>({...i,currency:'TRY',averageCostTryExact4:product.costExact4})),events=[],state={actualRights:[...rights],account:{id:account.id,currency:'TRY',type:account.type,isActive:true},identity:fixtureIdentity(copy),proof:fixtureProof(copy)};
 let tx,lastDomain;
 class Transaction{async begin(level){assert.equal(level,4);tx=this;events.push('SERIALIZABLE');}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{
  constructor(parent){assert.equal(parent,tx);this.parent=state.parentDrift?{}:parent;this.params={};}input(k,t,v){this.params[k]=v;return this;}
  async query(sql){
   if(sql.startsWith('SELECT DB_NAME')){events.push('identity');return {recordset:[state.identity]};}
   if(sql.includes('sp_getapplock')){assert(sql.includes("@LockMode=N'Shared'"));events.push('Shared');return {};}
   if(sql===ISOLATED_COPY_FINITE_FK_SQL){events.push('FK');return {recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};}
   if(sql===SOURCE_COLLECTION_COLLECTOR_SQL){assert.equal(isolatedCopyTransactionContext(tx,{writeRequired:false}),copy);assert.equal(isIsolatedOperationCopyMutation({database:copy.target.database,server:copy.target.server,user:copy.target.login,readOnly:false},tx),false);events.push('collector');return {recordset:state.actualRights.map(permissionKey=>({actorId:'16',roleCode:'isolated_test_ilker',userActive:state.userActive!==false,roleActive:state.roleActive!==false,permissionKey,canView:true}))};}
   if(sql===SOURCE_COLLECTION_ACCOUNT_SQL){events.push('account');return {recordset:state.account?[state.account]:[]};}
   if(sql===SELECTED_SALE_JOIN_SQL){events.push('creator');assert.equal(this.params.id,'1000');return {recordsets:[[structuredClone(row)],structuredClone(items)]};}
   if(sql.startsWith('SELECT CONVERT(varchar(20),movement_id) id FROM dbo.work_collection_links WITH(HOLDLOCK)')){events.push('collection links');return {recordset:[]};}
   throw Error('UNEXPECTED_SQL');
  }
  async execute(name){if(name===copy.sql.ready.name){events.push('READY');return {};}
   assert.equal(name,copy.sql.context.name);events.push('context');return {recordset:[{proof_json:JSON.stringify(state.proof),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:state.actualRights}),context_json:JSON.stringify(context)}]};}
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},UniqueIdentifier:'uuid',BigInt:'bigint',NVarChar:()=>{},Bit:'bit',MAX:'max'};
 const runtime={copyContext:copy,sql,pool:{}};
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,buildDomain:async args=>{lastDomain=await buildIsolatedCopyTradeDomain(args);return lastDomain;}});
 const service=createBusinessSelectedSaleCollectionReadPreparation({getStore:async()=>store});
 return {copy,state,row,items,events,store,service,lastDomain:()=>lastDomain,selection:{invoiceId:'1000',accountId:account.id,amountExact4:'5.0000',documentDate:copy.date}};
}

test('SOURCE read bridge uses real factory transaction READY FK actor and separate creator/current-account proof without writer capability',async()=>{
 const f=harness(),p=await f.service.preview(f.selection,actor());
 assert.equal(p.readOnly,true);assert.equal(p.preparationOnly,true);assert.equal(p.receivedAfterExact4,'5.0000');assert.equal(p.outstandingAfterExact4,'19.0000');assert.deepEqual(p.capabilities,{canCollect:false,canCancelCollection:false});assert.equal(p.preparationProof.creatorId,'15');assert.equal(p.preparationProof.collectorId,'16');assert.equal(p.preparationProof.invoiceId,'1000');
 assert.deepEqual(f.events.slice(0,6),['SERIALIZABLE','identity','Shared','READY','FK','context']);assert.deepEqual(f.events.slice(-2),['identity','commit']);assert(f.events.indexOf('collector')<f.events.indexOf('creator'));assert(f.events.includes('account'));assert.equal(f.lastDomain().context.capabilities.canCollect,false);
 assert.equal(f.lastDomain().request.length,1);assert.equal(f.events.some(x=>/BEGIN|journal|effects|collect$/.test(x)),false);
});
test('SOURCE read bridge rejects create cancel forged tokens and escaped transaction tokens before native effects',async()=>{
 const f=harness();await assert.rejects(f.service.collect({},actor()),{code:'ISOLATED_COPY_READ_ONLY'});await assert.rejects(f.service.cancel('1',{},actor()),{code:'ISOLATED_COPY_READ_ONLY'});assert.deepEqual(f.events,[]);
 assert.throws(()=>withSelectedSaleCollectionReadBridge({},()=>true),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
 let escaped,request,invoice;await f.store.readSelectedSaleCollectionPreparation(actor(),bridge=>{escaped=bridge;return withSelectedSaleCollectionReadBridge(bridge,native=>{request=native.request;invoice=native.invoice;return true;});});assert.throws(()=>withSelectedSaleCollectionReadBridge(escaped,()=>true),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.throws(()=>request(),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.throws(()=>invoice({}),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
});
test('SOURCE read bridge native identity proof current role account and joined creator drift fail before any journal',async()=>{
 for(const change of [f=>f.state.identity.live=1,f=>f.state.proof.valid=false,f=>f.state.actualRights=[],f=>f.state.actualRights=f.state.actualRights.filter(k=>k!=='finance.collection'),f=>f.state.userActive=false,f=>f.state.roleActive=false,f=>f.state.parentDrift=true,f=>f.state.account=null,f=>f.state.account.isActive=false,f=>f.state.account.currency='USD',f=>f.state.account.type='other',f=>f.row.actor_id='16',f=>f.row.createdBy='16',f=>f.row.payload_hash='F'.repeat(64),f=>f.row.accountCurrency='USD',f=>f.row.status='cancelled']){const f=harness();change(f);await assert.rejects(f.service.preview(f.selection,actor()));assert.equal(f.events.at(-1),'rollback');assert(!f.events.includes('commit'));}
 for(const a of [{...actor(),id:'15',role:{code:'isolated_test_sales'}},{...actor(),id:'17'},{...actor(),testAdminSession:true}]){const f=harness();await assert.rejects(f.service.preview(f.selection,a));assert(!f.events.includes('creator'));assert.equal(f.events.at(-1),'rollback');}
});
test('SOURCE read bridge keeps existing amount date and account preview boundaries inside read rollback',async()=>{
 for(const patch of [{amountExact4:'25.0000'},{accountId:'999'},{documentDate:'2026-10-10'}]){const f=harness();await assert.rejects(f.service.preview({...f.selection,...patch},actor()));assert.equal(f.events.at(-1),'rollback');}
});
test('SOURCE read bridge rejects price-bearing journal before any native HISTORY callback or invoice effects',async()=>{
 const f=harness(),preview=JSON.parse(f.row.preview_json);
 // Minimal valid joined fixture plus a price-history marker. Even an invalid
 // marker must never dispatch the collector as the creator's HISTORY actor.
 preview.pricing={pricingJson:'{}',pricingHash:'A'.repeat(64),priceRevisionHash:'B'.repeat(64),saleRevisionHash:'C'.repeat(64),copyId:f.copy.copyId,sealHash:f.copy.sealHash};
 f.row.preview_json=JSON.stringify(preview);
 await assert.rejects(f.service.preview(f.selection,actor()),{code:'WORK_SELECTED_SALE_PRICING_HISTORY_REQUIRED',statusCode:409});
 assert.deepEqual(f.events,['SERIALIZABLE','identity','Shared','READY','FK','context','collector','collector','creator','rollback']);
});
