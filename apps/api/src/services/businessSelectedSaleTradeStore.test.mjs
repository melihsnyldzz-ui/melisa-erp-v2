import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {bindIsolatedCopyOperationDTO,isolatedCopyJSON,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {buildBusinessSelectedSalePreview,loadBusinessSelectedSaleJournal,buildIsolatedCopyTradeDomain,SELECTED_SALE_JOIN_SQL,SELECTED_SALE_LIST_SQL} from './workTradeStore.mjs';
import {createWorkSalesService,workSelectedSaleInput} from './workSalesService.mjs';
import {workSalePreview} from './workSalesModel.mjs';

function fixture(){
 const copy=selectedSaleFixture().c,customer=copy.customers.find(c=>c.currency==='USD'),product=copy.products[0],origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const context={meta:{date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},revision:'a'.repeat(64),capabilities:{canCreate:true},limits:{maxItems:200,maxInvoiceAmountExact4:'20000.0000'},scope:{...origin,customer:{...customer,...origin,writeEligible:true},accounts:[],products:[{...origin,id:product.id,stockCode:product.stockCode,name:'Offline product',barcode:product.barcodes[0],costExact4:product.costExact4,writeEligible:true,unit:{label:product.unit,factorExact8:product.unitFactorExact8},stockQuantityExact3:'10000.000',prices:product.quotes.filter(q=>q.currency==='USD').map(q=>({quoteId:q.quoteId,currency:q.currency,unitPriceExact8:q.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}))}]}};
 bindIsolatedCopyOperationDTO(copy,context);
 const input={customerId:customer.id,documentDate:copy.date,currency:'USD',items:[{productId:product.id,quoteId:'101',quantityExact3:'8.000'}]};
 return {copy,context,input,actor:{id:'15',permissions:['sales.view','sales.create']}};
}
test('selected arithmetic accepts whole main quantities beyond legacy five and exact SOURCE USD price/FX without a cash account',()=>{
 const f=fixture(),p=buildBusinessSelectedSalePreview(f.copy,f.input,f.context);
 assert.equal(p.grandTotalExact4,'16.9880');assert.equal(p.items[0].unitPriceExact4,'2.1235');assert.equal(p.items[0].unitPriceExact8,'2.12345678');assert.equal(p.amountTryExact4,'812.0264');assert.equal(p.selection.customerAccountId,'5100');assert.equal(p.settlement.accountRateExact8,'47.80000000');assert.equal(p.items[0].barcode,'00444');assert.throws(()=>workSalePreview(f.input,f.context),{code:'WORK_QUANTITY_INVALID'});
});
test('selected parser rejects caller policy/identity, fractional or duplicate quantities, and more than 200 items',()=>{
 const {input}=fixture();for(const patch of [{businessAccountId:'5100'},{sourceSelectionHash:'a'.repeat(64)},{selectedSaleIntent:{}},{items:[{...input.items[0],quantityExact3:'1.500'}]},{items:[input.items[0],input.items[0]]},{items:Array.from({length:201},(_,i)=>({...input.items[0],productId:String(i+1)}))}])assert.throws(()=>workSelectedSaleInput({...input,...patch}));
 assert.equal(workSelectedSaleInput({...input,items:Array.from({length:200},(_,i)=>({...input.items[0],productId:String(i+1)}))}).items.length,200);
});
test('selected preview refuses unbound context, substituted quote/account, missing stock and excessive amount',()=>{
 for(const mutate of [c=>c.scope.customer.accountId='1100',c=>c.scope.products[0].prices[0].unitPriceExact8='1.00000000',c=>c.scope.products[0].stockQuantityExact3='7.000',c=>c.limits.maxInvoiceAmountExact4='500.0000']){const f=fixture();mutate(f.context);assert.throws(()=>buildBusinessSelectedSalePreview(f.copy,f.input,f.context));}
 const f=fixture();assert.throws(()=>buildBusinessSelectedSalePreview(f.copy,f.input,structuredClone(f.context)));assert.throws(()=>buildBusinessSelectedSalePreview(f.copy,{...f.input,items:[{...f.input.items[0],quantityExact3:'10000.000'}]},f.context),{code:'WORK_TOTAL_LIMIT'});
});
test('exact joined loader verifies canonical immutable creation and rejects foreign actor or altered cost',async()=>{
 const f=fixture(),p=buildBusinessSelectedSalePreview(f.copy,f.input,f.context),requestId='10000000-0000-4000-8000-000000000001',invoice={id:'1000',documentNo:'NIGHT-'+requestId.replaceAll('-','').slice(0,24),documentDate:f.copy.date,status:'draft',customerId:f.input.customerId,currency:'USD',subtotalExact4:p.subtotalExact4,grandTotalExact4:p.grandTotalExact4,amountTryExact4:p.amountTryExact4};
 const payload={...f.input,requestId,expectedRevision:p.scopeRevision,previewHash:p.previewHash,businessCustomerId:f.input.customerId,businessAccountId:p.selection.customerAccountId,businessCurrency:'USD',businessProductIds:['444'],businessSelectedSalePolicyHash:p.policyHash,sourceSelectionHash:p.sourceSelectionHash,copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin,actorId:f.actor.id,operation:'sale_draft'};
 const row={...invoice,invoice_id:invoice.id,request_id:requestId,actor_id:'15',preview_json:JSON.stringify({...p,copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin}),copy_id:f.copy.copyId,journal_request_id:requestId,journal_actor_id:'15',operation:'sale_draft',payload_hash:isolatedCopyHash(payload),payload_json:isolatedCopyJSON(payload),response_json:isolatedCopyJSON({invoice:{...invoice,items:p.items.map(i=>({...i,currency:'USD'}))},requestId,replayed:false}),accountCurrency:'USD',accountAmountExact4:p.grandTotalExact4,documentRateExact8:'47.80000000',accountRateExact8:'47.80000000',createdBy:'15'};
 const items=p.items.map(i=>({...i,currency:'USD',averageCostTryExact4:f.copy.products[0].costExact4})),calls=[];
 const request=()=>({input(k,t,v){calls.push([k,v]);return this;},async query(sql){assert.equal(sql,SELECTED_SALE_JOIN_SQL);return {recordsets:[[row],items]};}}),sql={UniqueIdentifier:'uuid',BigInt:'bigint'};
 const options={copy:f.copy,actor:f.actor,request,sql,id:'1000'},result=await loadBusinessSelectedSaleJournal(options);assert.equal(result.selection.customerAccountId,'5100');assert.deepEqual(calls,[['copy_id',f.copy.copyId],['id','1000']]);assert.match(SELECTED_SALE_JOIN_SQL,/l.request_id=j.request_id/);assert.match(SELECTED_SALE_JOIN_SQL,/ORDER BY s.id/);assert.match(SELECTED_SALE_JOIN_SQL,/LOWER\(CONVERT\(varchar\(36\),j.request_id\)\)/);
 await assert.rejects(loadBusinessSelectedSaleJournal({...options,actor:{...f.actor,id:'16'}}),{code:'WORK_SELECTED_SALE_FORBIDDEN'});items[0].averageCostTryExact4='999.0000';await assert.rejects(loadBusinessSelectedSaleJournal(options),{code:'WORK_SELECTED_SALE_DRIFT'});
});
test('selected service delegates immutable replay before preview, revision and fresh-stock checks',async()=>{
 const f=fixture(),p=buildBusinessSelectedSalePreview(f.copy,f.input,f.context),requestId='10000000-0000-4000-8000-000000000001';let preview=0;
 const service=createWorkSalesService({getStore:async()=>({selectedSaleEnabled:async()=>true,mutateSelectedSale:async(actor,operation,payload,fn)=>{assert.equal(operation,'sale_draft');assert.equal(payload.requestId,requestId);return {invoice:{id:'1000'},requestId,replayed:true};},mutate(){throw Error('legacy route');},read:async(actor,fn)=>fn({context:f.context,selectedSalePreview(){preview++;throw Error('stock is now depleted');}})})});
 const response=await service.createDraft({...f.input,requestId,previewHash:p.previewHash,expectedRevision:p.scopeRevision},f.actor);assert.equal(response.replayed,true);assert.equal(preview,0);
});
test('unregistered v4/v5 service preserves legacy preview hash and draft limits despite selected helper presence',async()=>{
 const f=fixture();f.context.limits={maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'};
 let mutations=0,selectedPreviews=0;
 const domain={context:f.context,selectedSaleEnabled:false,selectedSalePreview(){selectedPreviews++;throw Error('selected writer unavailable');},createDraft:async preview=>({id:'1000',currency:preview.currency})};
 const service=createWorkSalesService({getStore:async()=>({selectedSaleEnabled:async()=>false,read:async(actor,fn)=>fn(domain),mutateSelectedSale:async(actor,operation,payload,fn)=>{mutations++;return fn(domain);}})});
 await assert.rejects(service.preview(f.input,f.actor),{code:'WORK_QUANTITY_INVALID'});
 const requestId='10000000-0000-4000-8000-000000000001';await assert.rejects(service.createDraft({...f.input,requestId,previewHash:'b'.repeat(64),expectedRevision:f.context.revision},f.actor),{code:'WORK_QUANTITY_INVALID'});assert.equal(mutations,0);
 const input={...f.input,items:[{...f.input.items[0],quantityExact3:'1.000'}]},expected=workSalePreview(input,f.context),preview=await service.preview(input,f.actor);assert.deepEqual(preview,expected);
 const result=await service.createDraft({...input,requestId,previewHash:preview.previewHash,expectedRevision:f.context.revision},f.actor);assert.equal(result.invoice.id,'1000');assert.equal(mutations,1);assert.equal(selectedPreviews,0);
});
test('unregistered legacy copy list retains page cap and rejects selected journal rows instead of downgrading them',async()=>{
 const f=fixture(),inputs=[],queries=[];
 let returnForeign=false;
 const sql={Int:'int',Date:'date',BigInt:'bigint',UniqueIdentifier:'uuid',Bit:'bit'};
 const request=()=>({input(k,t,v){inputs.push([k,v]);return this;},async query(text){queries.push(text);
  if(text===SELECTED_SALE_LIST_SQL)return {recordsets:[[{total:returnForeign?1:0}],returnForeign?[{id:'1000'}]:[]]};
  if(text===SELECTED_SALE_JOIN_SQL)return {recordsets:[[{invoice_id:'1000',request_id:'10000000-0000-4000-8000-000000000001',actor_id:'16',copy_id:f.copy.copyId,journal_actor_id:'16',journal_request_id:'10000000-0000-4000-8000-000000000001',id:'1000'}],[]]};
  return {recordsets:[[{id:'1000',customerId:f.input.customerId,currency:'USD',selectedCreation:1,preview_json:JSON.stringify({policyHash:'b'.repeat(64)})}],[],[]]};
 }});
 const domain=await buildIsolatedCopyTradeDomain({runtime:{sql},copyContext:f.copy,context:f.context,actor:f.actor,nativeContext:{transaction:{}},request,reloadContext:async()=>{throw Error('unexpected reload');}});
 const list=await domain.list({page:2,limit:25});assert.deepEqual(list,{data:[],meta:{total:0,page:2,limit:25}});assert.ok(inputs.some(([k,v])=>k==='actor_id'&&v==='15'));assert.ok(inputs.some(([k,v])=>k==='copy_id'&&v===f.copy.copyId));assert.ok(inputs.some(([k,v])=>k==='profileDate'&&v===f.copy.date));assert.ok(inputs.some(([k,v])=>k==='offset'&&v===25));assert.ok(inputs.some(([k,v])=>k==='selected_enabled'&&v===false));assert.match(SELECTED_SALE_LIST_SQL,/j.actor_id=@actor_id AND l.actor_id=j.actor_id/);assert.match(SELECTED_SALE_LIST_SQL,/j.request_id=l.request_id/);assert.match(SELECTED_SALE_LIST_SQL,/j.operation=N'sale_draft'/);assert.match(SELECTED_SALE_LIST_SQL,/response_json,'\$\.invoice.id'/);assert.match(SELECTED_SALE_LIST_SQL,/NOT EXISTS\(SELECT 1 FROM dbo.stage4_copy_requests excluded/);
 await assert.rejects(domain.list({page:1,limit:51}),{code:'WORK_QUERY_INVALID'});
 returnForeign=true;await assert.rejects(domain.list({page:1,limit:25}),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});assert.equal(queries.includes(SELECTED_SALE_JOIN_SQL),false);assert.equal(domain.selectedSaleEnabled,false);assert.equal(domain.selectedSalePreview,undefined);assert.equal(domain.useSelectedSaleContext,undefined);
});
