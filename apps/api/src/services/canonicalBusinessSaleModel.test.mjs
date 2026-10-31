import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// The mock exists only in this disposable Node test process. Production keeps
// its SQL-reader-only WeakMap; there is no exported production grant fixture.
if(!process.execArgv.includes('--experimental-test-module-mocks')){
 test('canonical model/service contracts in an isolated ESM brand fixture',()=>{
  const result=spawnSync(process.execPath,['--experimental-test-module-mocks','--test',fileURLToPath(import.meta.url)],{encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}else{
 const ownerUrl=new URL('./canonicalBusinessSessionContext.mjs',import.meta.url),owner=await import(ownerUrl.href),branded=new WeakSet();
 mock.module(ownerUrl.href,{namedExports:{...owner,getCanonicalBusinessSaleContextProof:value=>branded.has(value)?value:null}});
 const {workSalePreview,workSelection,workDraftInput,workHash}=await import('./workSalesModel.mjs');
 const {workSelectedSaleInput,createWorkSalesService}=await import('./workSalesService.mjs');
 const revision='a'.repeat(64),nativeHash='B'.repeat(64),origin='CANONICAL_TEST_BUSINESS_SALE',requestId='11111111-1111-4111-8111-111111111111';
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 function fixture(change=()=>{}){
  const selection={customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]};
  const context={meta:{date:selection.documentDate,operationOrigin:origin},revision,nativePreviewHash:nativeHash,capabilities:{canCreate:true},limits:{maxInvoiceAmountExact4:'500.0000'},
   scope:{synthetic:false,operationOrigin:origin,customer:{id:'155',accountId:'7',partyId:'6',currency:'USD',sourceKey:'F0102/CUSTOMER/155',synthetic:false,operationOrigin:origin,writeEligible:true},products:[{id:'12',stockCode:'0012 SYN',name:'Fixture product',barcode:'000012',sourceKey:'F0102/PRODUCT/12',sourceWitnessHash:'c'.repeat(64),synthetic:false,operationOrigin:origin,writeEligible:true,stockQuantityExact3:'9.000',unit:{label:'ADET',factorExact8:'1.00000000',sourceId:'9'},costExact4:'0.5000',prices:[{quoteId:'81',currency:'USD',unitPriceExact8:'1.23456789'}]}]},
   rate:{currency:'USD',rateExact8:'2.00000000',rateDate:'2026-10-27',sourceKey:'RATE/USD/20261027'},nativeExpected:{items:[{productId:'12',quoteId:'81',quantityExact3:'2.000',unitPriceExact4:'1.2346',lineTotalExact4:'2.4692'}],grandTotalExact4:'2.4692',amountTryExact4:'4.9384'}};
  change(context,selection);freeze(context);branded.add(context);return {context,selection};
 }
 test('SQL-branded canonical preview preserves the selected account, exact4 math, barcode and owner hash',()=>{
  const {context,selection}=fixture(),preview=workSalePreview(selection,context);
  assert.equal(preview.previewHash,nativeHash.toLowerCase());assert.notEqual(preview.previewHash,workHash({...preview,previewHash:undefined}));
  assert.equal(preview.items[0].barcode,'000012');assert.equal(preview.items[0].stockCode,'0012 SYN');
  assert.equal(preview.items[0].unitPriceExact8,'1.23456789');assert.equal(preview.items[0].unitPriceExact4,'1.2346');assert.equal(preview.grandTotalExact4,'2.4692');assert.equal(preview.amountTryExact4,'4.9384');
  assert.equal(preview.selection.customerAccountId,'7');assert.equal(preview.settlement.accountId,'7');assert.equal(preview.settlement.documentRateExact8,'2.00000000');
  assert.equal(Object.hasOwn(preview.items[0],'costExact4'),false);
  assert.throws(()=>workSalePreview(selection,structuredClone(context)),{code:'WORK_CANONICAL_SALE_SCOPE'});
 });
 test('canonical native4/date/rate/account/source drift and unknown costs cannot become a writable preview',()=>{
  for(const change of [
   c=>{c.nativeExpected.items[0].unitPriceExact4='1.2345';},c=>{c.nativeExpected.items[0].lineTotalExact4='2.4693';},c=>{c.nativeExpected.grandTotalExact4='2.4693';},c=>{c.nativeExpected.amountTryExact4='4.9385';},
   c=>{c.scope.customer.accountId='8';},c=>{c.scope.customer.sourceKey='';},c=>{c.scope.products[0].sourceWitnessHash=null;},c=>{c.scope.products[0].unit.sourceId='0';},c=>{c.scope.products[0].synthetic=true;},
   c=>{c.meta.date='2026-10-27';},c=>{c.rate.currency='EUR';},c=>{c.rate.rateDate='2026-10-29';},c=>{c.rate.rateExact8='0.00000000';},c=>{c.scope.products[0].costExact4=null;},c=>{c.nativePreviewHash=null;}
  ]){const f=fixture(change);assert.throws(()=>workSalePreview(f.selection,f.context));}
  const zero=fixture(c=>{c.scope.products[0].costExact4='0.0000';});assert.equal(workSalePreview(zero.selection,zero.context).grandTotalExact4,'2.4692');
 });
 test('canonical parsing retains a required account and bounded whole quantities without changing legacy selection',()=>{
  const {selection}=fixture();assert.deepEqual(workSelectedSaleInput(selection,{canonicalBusiness:true}),selection);
  for(const bad of [{...selection,customerAccountId:undefined},{...selection,canonicalBusiness:true},{...selection,items:[{...selection.items[0],unitPriceExact8:'0.00000000'}]},...['0.000','1.500','6.000'].map(quantityExact3=>({...selection,items:[{...selection.items[0],quantityExact3}]})),{...selection,items:[selection.items[0],selection.items[0]]}])assert.throws(()=>workSelectedSaleInput(bad,{canonicalBusiness:true}));
  const draft=workDraftInput({...selection,requestId,previewHash:nativeHash,expectedRevision:revision},{canonicalBusiness:true});assert.equal(draft.customerAccountId,'7');assert.equal(draft.previewHash,nativeHash.toLowerCase());
  const inherited=Object.assign(Object.create({customerAccountId:'7'}),selection);delete inherited.customerAccountId;assert.throws(()=>workSelectedSaleInput(inherited,{canonicalBusiness:true}));
  const {customerAccountId,...legacy}=selection;assert.deepEqual(workSelectedSaleInput({...legacy,items:[{...legacy.items[0],quantityExact3:'6.000'}]}).items[0].quantityExact3,'6.000');assert.throws(()=>workSelection(selection,{allowBusinessCurrencies:true}));
  const local={meta:{date:selection.documentDate},revision,limits:{maxInvoiceAmountExact4:'500.0000'},scope:{synthetic:true,customer:{id:'155',currency:'TRY',synthetic:true,writeEligible:true},products:[{id:'12',stockCode:'SYN',name:'Local fixture',synthetic:true,writeEligible:true,stockQuantityExact3:'9.000',unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:'81',currency:'TRY',unitPriceExact8:'1.23456789'}]}]}};
  assert.equal(workSalePreview({...legacy,currency:'TRY'},local).grandTotalExact4,'2.4692');
 });
 test('both document and TRY totals stay at or below 500; TRY requires its exact unit rate',()=>{
  const f=fixture(c=>{c.scope.products[0].prices[0].unitPriceExact8='250.00000000';c.nativeExpected.items[0].unitPriceExact4='250.0000';c.nativeExpected.items[0].lineTotalExact4='500.0000';c.nativeExpected.grandTotalExact4='500.0000';c.nativeExpected.amountTryExact4='1000.0000';});assert.throws(()=>workSalePreview(f.selection,f.context));
  const over=fixture((c,s)=>{s.items[0].quantityExact3='5.000';c.scope.products[0].prices[0].unitPriceExact8='100.00010000';c.nativeExpected.items[0]={...s.items[0],unitPriceExact4:'100.0001',lineTotalExact4:'500.0005'};c.nativeExpected.grandTotalExact4='500.0005';c.nativeExpected.amountTryExact4='1000.0010';});assert.throws(()=>workSalePreview(over.selection,over.context),{code:'WORK_TOTAL_LIMIT'});
  const tr=fixture((c,s)=>{s.currency='TRY';c.scope.customer.currency='TRY';c.scope.products[0].prices[0].currency='TRY';c.rate.currency='TRY';c.rate.rateExact8='2.00000000';});assert.throws(()=>workSalePreview(tr.selection,tr.context),{code:'WORK_RATE_UNAVAILABLE'});
 });
 test('canonical profile limit is mandatory and malformed or tighter limits cannot default to 500',()=>{
  for(const change of [c=>{delete c.limits;},c=>{delete c.limits.maxInvoiceAmountExact4;},c=>{c.limits.maxInvoiceAmountExact4=null;},c=>{c.limits.maxInvoiceAmountExact4='500';},c=>{c.limits.maxInvoiceAmountExact4='500.00';},c=>{c.limits.maxInvoiceAmountExact4='500.00000';}]){
   const f=fixture(change);assert.throws(()=>workSalePreview(f.selection,f.context),{code:'WORK_AMOUNT_INVALID'});
  }
  for(const limit of ['0.0000','2.0000']){const f=fixture(c=>{c.limits.maxInvoiceAmountExact4=limit;});assert.throws(()=>workSalePreview(f.selection,f.context),{code:'WORK_TOTAL_LIMIT'});}
 });
 function serviceFixture(canonical=true){
  const f=fixture(),seen=[],actor={id:'17',permissions:['sales.view','sales.create']};
  const adapter={context:f.context,selectedSaleEnabled:true,selectedSaleContext:async value=>{seen.push(['selection',value]);return f.context;},selectedSalePreview:async value=>workSalePreview(value,f.context),createDraft:async preview=>{seen.push(['draft',preview.selection]);return {id:'91',status:'draft'};}};
  const store={isCanonicalBusinessSale:async a=>canonical&&a.id==='17',selectedSaleEnabled:async()=>true,read:async(a,fn)=>fn(adapter),mutateSelectedSale:async(a,op,payload,fn)=>{seen.push(['payload',payload]);return fn(adapter);}};
  return {...f,seen,actor,adapter,store,service:createWorkSalesService({getStore:async()=>store})};
 }
 test('canonical service passes the full strict account/date/items selection through preview and draft',async()=>{
  const f=serviceFixture(),selected=await f.service.selectedContext(f.selection,f.actor);assert.notEqual(selected,f.context);assert.equal(branded.has(selected),false);assert.equal(selected.scope.customer.accountId,'7');assert.deepEqual(f.seen[0],['selection',f.selection]);
  const preview=await f.service.preview(f.selection,f.actor);assert.equal(preview.previewHash,nativeHash.toLowerCase());
  const result=await f.service.createDraft({...f.selection,requestId,previewHash:nativeHash,expectedRevision:revision},f.actor);assert.equal(result.invoice.id,'91');assert.equal(f.seen.find(([kind])=>kind==='payload')[1].customerAccountId,'7');assert.equal(f.seen.filter(([kind])=>kind==='draft').length,1);
  await assert.rejects(f.service.selectedContext({customerId:'155',currency:'USD',productIds:['12']},f.actor));
 });
 test('public selected context removes private costs/native witnesses and cannot become a model proof',async()=>{
  const f=serviceFixture(),selected=await f.service.selectedContext(f.selection,f.actor),json=JSON.stringify(selected);
  for(const key of ['costExact4','sourceWitnessHash','sourceKey','nativeExpected','nativePreviewHash','profileHash','sourceId'])assert.equal(json.includes('"'+key+'"'),false,key);
  assert.equal(selected.scope.products[0].barcode,'000012');assert.equal(selected.scope.products[0].prices[0].unitPriceExact8,'1.23456789');assert.equal(selected.revision,revision);
  assert.throws(()=>workSalePreview(f.selection,selected),{code:'WORK_CANONICAL_SALE_SCOPE'});
  const preview=await f.service.preview(f.selection,f.actor);assert.equal(preview.grandTotalExact4,'2.4692');assert.equal(preview.previewHash,nativeHash.toLowerCase());
  f.adapter.selectedSaleContext=async()=>structuredClone(f.context);await assert.rejects(f.service.selectedContext(f.selection,f.actor),{code:'WORK_CANONICAL_SALE_SCOPE'});
 });
 test('client flags do not enable canonical parsing; an inconsistent server adapter fails closed',async()=>{
  const legacy=serviceFixture(false);let mismatchedReads=0;legacy.store.read=async()=>{mismatchedReads++;throw Error('shape mismatch must reject before adapter read');};await assert.rejects(legacy.service.selectedContext(legacy.selection,legacy.actor),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});assert.equal(mismatchedReads,0);assert.deepEqual(legacy.seen,[]);
  const inverse=serviceFixture();inverse.store.read=legacy.store.read;await assert.rejects(inverse.service.selectedContext({customerId:'155',currency:'USD',productIds:['12']},inverse.actor),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});assert.equal(mismatchedReads,0);
  const f=serviceFixture();f.adapter.selectedSaleEnabled='true';await assert.rejects(f.service.selectedContext(f.selection,f.actor),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});f.adapter.selectedSaleEnabled=false;await assert.rejects(f.service.preview(f.selection,f.actor),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});f.store.selectedSaleEnabled=async()=>false;await assert.rejects(f.service.createDraft({...f.selection,requestId,previewHash:nativeHash,expectedRevision:revision},f.actor),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});assert.deepEqual(f.seen,[]);
 });
}
