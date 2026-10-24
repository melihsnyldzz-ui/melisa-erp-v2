import test from 'node:test';
import assert from 'node:assert/strict';
import {workSalePreview,workSelection,workDraftInput,workHash} from './workSalesModel.mjs';
import {createWorkSalesService} from './workSalesService.mjs';
import {createWorkCollectionService} from './workCollectionService.mjs';
import {withWorkNightScope,isWorkNightProduct} from './workNightScope.mjs';
import {fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {bindIsolatedCopyOperationDTO,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const revision='a'.repeat(64),uuid='a2a49b48-3696-4f2d-b237-e519af1e1b88';
const actor={id:'16',testAdminSession:true,permissions:['sales.view','sales.create','sales.finalize','sales.cancel','customer.view','finance.collection','finance.collection.cancel']};
const products=['400001','400002'].map((id,i)=>({id,stockCode:`NIGHT-${i+1}`,name:`Ürün ${i+1}`,synthetic:true,writeEligible:true,stockQuantityExact3:'10.000',unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:String(i+1),currency:'TRY',unitPriceExact8:i?'20.12345000':'10.00000000'}]}));
const context={meta:{date:'2026-10-06'},revision,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:true,canCancelCollection:true},scope:{synthetic:true,customer:{id:'400003',currency:'TRY',synthetic:true,writeEligible:true},products,accounts:[{id:'400004',currency:'TRY',synthetic:true}]},limits:{maxInvoiceAmountExact4:'500.0000'}};
const selection={customerId:'400003',documentDate:'2026-10-06',currency:'TRY',items:[{productId:'400001',quoteId:'1',quantityExact3:'2.000'},{productId:'400002',quoteId:'2',quantityExact3:'1.000'}]};
const invoice=()=>({id:'800001',status:'draft',currency:'TRY',revision,collections:{receivedExact4:'0.0000',outstandingExact4:'40.1235',revision,items:[]}});
test('two authoritative products project exact8 to native4 and sum exact money without float drift',()=>{
 const preview=workSalePreview(selection,context);assert.equal(preview.grandTotalExact4,'40.1235');assert.equal(preview.items[1].unitPriceExact8,'20.12345000');assert.equal(preview.items[1].unitPriceExact4,'20.1235');assert.equal(preview.previewHash.length,64);
});
test('unknown/zero/unproven prices, unit, stock, customer and currency fail closed',()=>{
 for(const change of [c=>c.scope.products[0].prices[0].unitPriceExact8=null,c=>c.scope.products[0].prices[0].unitPriceExact8='0.00000000',c=>c.scope.products[0].stockQuantityExact3=null,c=>c.scope.products[0].unit.factorExact8='2.00000000',c=>c.scope.customer.synthetic=false]){const c=structuredClone(context);change(c);assert.throws(()=>workSalePreview(selection,c));}
 assert.throws(()=>workSelection({...selection,currency:'USD'}),{statusCode:409});
});
test('strict body refuses client prices/roles, duplicate products, decimals and unsafe IDs',()=>{
 for(const value of [{...selection,role:'admin'},{...selection,items:[{...selection.items[0],unitPrice:1}]},{...selection,items:[selection.items[0],selection.items[0]]},{...selection,items:[{...selection.items[0],quantityExact3:'1.500'}]},{...selection,customerId:'9223372036854775808'}])assert.throws(()=>workSelection(value));
 assert.throws(()=>workDraftInput({...selection,requestId:'not-uuid',previewHash:revision,expectedRevision:revision}));
});
function fixture(localContext=context){const requests=new Map(),events=[],current=invoice();const c={context:localContext,invoice:async()=>structuredClone(current),createDraft:async()=>{events.push('draft');return structuredClone(current);},finalize:async()=>{events.push('finalize');current.status='finalized';return structuredClone(current);},cancel:async()=>{events.push('cancel');current.status='cancelled';return structuredClone(current);},collect:async p=>{events.push('collect');const item={id:'900001',invoiceId:current.id,accountId:p.selection.accountId,amountExact4:p.amountExact4,currency:'TRY',documentDate:p.selection.documentDate,status:'active',revision};current.collections.receivedExact4=p.receivedAfterExact4;current.collections.outstandingExact4=p.outstandingAfterExact4;current.collections.items.push(item);return item;},collection:async()=>current.collections.items[0],cancelCollection:async()=>{events.push('reverse');current.collections.receivedExact4='0.0000';current.collections.outstandingExact4='40.1235';current.collections.items[0].status='cancelled';return current.collections.items[0];}};
 const store={context:async()=>localContext,read:async(a,fn)=>fn(c),mutate:async(a,operation,payload,fn)=>{const hash=workHash({actorId:a.id,operation,payload}),old=requests.get(payload.requestId);if(old){if(old.hash!==hash)throw Object.assign(Error('Conflict'),{statusCode:409});return {...old.response,replayed:true};}const response=await fn(c);requests.set(payload.requestId,{hash,response:structuredClone(response)});return response;}};return{store,events,current,requests,context:localContext};}

const cleanBoundaryError={code:'WORK_UNAVAILABLE',statusCode:503};
function cleanBoundaryFixture(meta={environment:'CLEAN_SYNTHETIC_TEST'}){
 const local=structuredClone(context);local.meta={...local.meta,...meta};return fixture(local);
}
function draftBody(local=context){const preview=workSalePreview(selection,local);return {...selection,requestId:uuid,expectedRevision:local.revision,previewHash:preview.previewHash};}

test('B6 contract: a clean canCreate flag cannot admit a direct draft without a native contract',async()=>{
 const f=cleanBoundaryFixture(),service=createWorkSalesService({getStore:async()=>f.store});
 await assert.rejects(service.createDraft(draftBody(f.context),actor),cleanBoundaryError);
 assert.deepEqual(f.events,[]);assert.equal(f.requests.size,0);assert.equal(f.current.status,'draft');
});

test('B6 contract: a clean canFinalize flag cannot invoke the invoice engine without a native contract',async()=>{
 const f=cleanBoundaryFixture(),service=createWorkSalesService({getStore:async()=>f.store});
 await assert.rejects(service.finalize(f.current.id,{requestId:uuid,expectedRevision:revision},actor),cleanBoundaryError);
 assert.deepEqual(f.events,[]);assert.equal(f.requests.size,0);assert.equal(f.current.status,'draft');
});

test('B6 contract: partial clean markers, wrong target and claimed verification never become write admission',async()=>{
 const cases=[
  {environment:'CLEAN_SYNTHETIC_TEST',database:'LIVE',actualT1:true},
  {environment:'CLEAN_SYNTHETIC_TEST',environmentId:'wrong-environment',synthetic:false},
  {environment:'CANONICAL_TEST',database:'MELISA_ERP_CLEAN_TEST_20261022'},
  {environment:'CANONICAL_TEST',environmentId:'E662FD94-D797-4B3B-938A-D143AD758B67'},
  {environment:'CANONICAL_TEST',cleanSaleReadOnly:true},
  {environment:'CLEAN_SYNTHETIC_TEST',verified:true,cleanDirectSaleContract:{verified:true,canCreate:true,canFinalize:true}}
 ];
 for(const meta of cases){const f=cleanBoundaryFixture(meta),service=createWorkSalesService({getStore:async()=>f.store});
  await assert.rejects(service.createDraft(draftBody(f.context),actor),cleanBoundaryError);
  await assert.rejects(service.finalize(f.current.id,{requestId:uuid,expectedRevision:revision},actor),cleanBoundaryError);
  assert.deepEqual(f.events,[]);assert.equal(f.requests.size,0);
 }
});

test('B6 contract: missing actor permissions fail before opening the store and client admin flags do not grant them',async()=>{
 let opened=0;const service=createWorkSalesService({getStore:async()=>{opened++;throw Error('Store must remain closed');}});
 const unprivileged={id:'10018',username:'semih',isAdmin:true,testAdminSession:true,permissions:[]};
 await assert.rejects(service.createDraft(draftBody(),unprivileged),{code:'WORK_FORBIDDEN',statusCode:403});
 await assert.rejects(service.finalize('800001',{requestId:uuid,expectedRevision:revision},unprivileged),{code:'WORK_FORBIDDEN',statusCode:403});
 assert.equal(opened,0);
});

test('B6 contract: existing non-clean draft orchestration rejects stale revision and stale price before an engine call',async()=>{
 const local=structuredClone(context),f=fixture(local),service=createWorkSalesService({getStore:async()=>f.store}),body=draftBody(local);
 await assert.rejects(service.createDraft({...body,expectedRevision:'b'.repeat(64)},actor),{code:'WORK_STALE',statusCode:409});
 local.scope.products[0].prices[0].unitPriceExact8='11.00000000';
 await assert.rejects(service.createDraft(body,actor),{code:'WORK_PREVIEW_CHANGED',statusCode:409});
 assert.deepEqual(f.events,[]);assert.equal(f.requests.size,0);
});

test('B6 contract: existing in-memory journal replays finalize once and rejects the same UUID with another body',async()=>{
 const f=fixture(),service=createWorkSalesService({getStore:async()=>f.store}),body={requestId:uuid,expectedRevision:revision};
 const first=await service.finalize(f.current.id,body,actor),replay=await service.finalize(f.current.id,body,actor);
 assert.equal(first.invoice.status,'finalized');assert.equal(replay.replayed,true);assert.deepEqual(f.events,['finalize']);
 await assert.rejects(service.finalize(f.current.id,{...body,expectedRevision:'b'.repeat(64)},actor),{statusCode:409});
 assert.deepEqual(f.events,['finalize']);assert.equal(f.requests.size,1);
});

test('B6 contract: registered clean runtime refuses legacy fallback before opening any store',()=>{
 // The worker registers only an in-memory identity. No SQL module, credential,
 // socket or runtime fixture is opened; process isolation avoids registry leaks.
 const worker=`import assert from 'node:assert/strict';
 import {createWorkSalesService} from ${JSON.stringify(new URL('./workSalesService.mjs',import.meta.url).href)};
 import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from ${JSON.stringify(new URL('./cleanSyntheticContext.mjs',import.meta.url).href)};
 Object.assign(process.env,{MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'});
 registerCleanContext({databaseName:CLEAN_DATABASE,serverName:'Semih\\\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID});
 let opened=0;const service=createWorkSalesService({getStore:async()=>{opened++;throw Error('Unexpected store access');}}),actor={id:'10018',permissions:['sales.create','sales.finalize']};
 const requestId='${uuid}',expectedRevision='${revision}',body={requestId,expectedRevision,previewHash:expectedRevision,customerId:'1',documentDate:'2026-10-22',currency:'TRY',items:[{productId:'1',quoteId:'1',quantityExact3:'1.000'}]};
 for(const database of[CLEAN_DATABASE,'LIVE']){process.env.SQL_DATABASE=database;
  await assert.rejects(service.createDraft(body,actor),{code:'WORK_UNAVAILABLE',statusCode:503});
  await assert.rejects(service.finalize('1',{requestId,expectedRevision},actor),{code:'WORK_UNAVAILABLE',statusCode:503});
 }
 assert.equal(opened,0);console.log(JSON.stringify({registeredClean:true,storeCalls:opened,denied:4}));`;
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|NODE_OPTIONS)$/i.test(key)));
 const guard=fileURLToPath(new URL('../../../../scripts/ci/offline-guard.cjs',import.meta.url));
 const result=spawnSync(process.execPath,['--require',guard,'--input-type=module','-e',worker],{env,encoding:'utf8',windowsHide:true,timeout:10000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr||result.stdout);
 assert.deepEqual(JSON.parse(result.stdout.trim()),{registeredClean:true,storeCalls:0,denied:4});
});
test('draft creation persists replay identity before stale check; conflicting same UUID cannot write twice',async()=>{
 const f=fixture(),svc=createWorkSalesService({getStore:async()=>f.store}),p=workSalePreview(selection,context),body={...selection,requestId:uuid,expectedRevision:revision,previewHash:p.previewHash};
 await svc.createDraft(body,actor);assert.equal((await svc.createDraft(body,actor)).replayed,true);assert.deepEqual(f.events,['draft']);
 await assert.rejects(svc.createDraft({...body,items:[selection.items[0]]},actor),{statusCode:409});assert.deepEqual(f.events,['draft']);
});
test('sale status/revision guards and active linked collections prevent cancellation',async()=>{
 const f=fixture(),svc=createWorkSalesService({getStore:async()=>f.store});await assert.rejects(svc.finalize(f.current.id,{requestId:uuid,expectedRevision:'b'.repeat(64)},actor),{statusCode:409});
 f.current.status='finalized';f.current.collections.receivedExact4='1.0000';await assert.rejects(svc.cancel(f.current.id,{requestId:uuid,expectedRevision:revision,reason:'Deneme iptali'},actor),{statusCode:409});assert.equal(f.events.length,0);
});
test('partial/full invoice-linked collections stop overpayment, seller and currency mistakes',async()=>{
 const f=fixture();f.current.status='finalized';const svc=createWorkCollectionService({getStore:async()=>f.store}),s={invoiceId:f.current.id,accountId:'400004',amountExact4:'15.0000',documentDate:'2026-10-06'},p=await svc.preview(s,actor);
 assert.equal(p.outstandingAfterExact4,'25.1235');await svc.collect({...s,requestId:uuid,previewHash:p.previewHash,expectedRevision:revision},actor);assert.equal(f.events.filter(x=>x==='collect').length,1);
 await assert.rejects(svc.preview({...s,amountExact4:'30.0000'},actor),{statusCode:409});await assert.rejects(svc.preview(s,{id:'15',permissions:['sales.view']}),{statusCode:403});
 const full=await svc.preview({...s,amountExact4:'25.1235'},actor);assert.equal(full.outstandingAfterExact4,'0.0000');
});
test('collection context retains the original response contract without copy metadata',async()=>{
 const f=fixture(),service=createWorkCollectionService({getStore:async()=>f.store});
 const result=await service.context({invoiceId:f.current.id},actor);
 assert.deepEqual(Object.keys(result),['invoice','customer','accounts','capabilities','revision']);
 assert.equal(result.customer.synthetic,true);assert.equal(result.accounts[0].synthetic,true);
});
test('collection context exposes only registered copy metadata and exact selected real parties/accounts',async()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const c={context:bindIsolatedCopyOperationDTO(copy,{meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},scope:{...origin,customer:{...origin,id:'20',currency:'TRY',sourceKey:copy.customers[0].sourceKey,writeEligible:true,balanceExact8:'7395.28000001'},accounts:[{...origin,id:'40',name:'Kasa',currency:'TRY'}]},capabilities:{canCollect:true,canCancelCollection:false}}),invoice:async()=>({...invoice(),customerId:'20'})};
 let seen;
 const service=createWorkCollectionService({getStore:async()=>({read:async(a,fn,permission)=>{seen={actor:a,permission};return fn(c);}})});
 const result=await service.context({invoiceId:'800001'},actor);
 assert.deepEqual(result.meta,c.context.meta);assert.notEqual(result.meta,c.context.meta);
 assert.equal(result.customer,c.context.scope.customer);assert.equal(result.customer.synthetic,false);
 assert.equal(result.customer.balanceExact8,'7395.28000001');assert.equal(result.customer.sourceKey,copy.customers[0].sourceKey);
 assert.equal(result.accounts,c.context.scope.accounts);assert.equal(result.accounts[0].id,'40');
 assert.equal(result.capabilities.canCancelCollection,false);assert.equal(seen.permission,'customer.view');
 await assert.rejects(service.context({invoiceId:'800001'},{id:'16',permissions:[]}),{statusCode:403});
 c.invoice=async()=>({...invoice(),customerId:'21'});
 await assert.rejects(service.context({invoiceId:'800001'},actor),{code:'WORK_COLLECTION_SCOPE'});
 c.invoice=async()=>({...invoice(),customerId:'20'});c.context.scope.accounts[0].id='99';
 await assert.rejects(service.context({invoiceId:'800001'},actor),{code:'ISOLATED_COPY_DTO_FINANCE'});
 c.context.scope.accounts[0].id='40';c.context=structuredClone(c.context);
 await assert.rejects(service.context({invoiceId:'800001'},actor),{code:'ISOLATED_COPY_UNBOUND_DTO'});
});
test('night product exception is local to verified transaction and never leaks to other async work',async()=>{
 const proof={database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',transaction:{},validated:true,products};assert.equal(isWorkNightProduct(products[0].id),false);
 await withWorkNightScope(proof,async()=>{assert.equal(isWorkNightProduct(products[0].id,proof.transaction),true);assert.equal(isWorkNightProduct(products[0].id,{}),false);assert.equal(isWorkNightProduct(products[0].id),false);assert.equal(isWorkNightProduct('301986',proof.transaction),false);});assert.equal(isWorkNightProduct(products[0].id,proof.transaction),false);
 for(const patch of [{database:'LIVE'},{validated:false},{transaction:null},{products:[products[0]]},{products:[...products,{...products[0],id:'400005'}]}])assert.throws(()=>withWorkNightScope({...proof,...patch},()=>{}),{statusCode:503});
});

test('customer/currency list pair narrows mixed history before pagination without changing response metadata',async()=>{
 const rows=[{id:'9',customerId:'40',currency:'USD'},{id:'8',customerId:'41',currency:'TRY'},{id:'7',customerId:'40',currency:'TRY'},{id:'6',customerId:'40',currency:'TRY'},{id:'5',customerId:'40',currency:'EUR'}],calls=[];
 const store={readHistoricalSale:async(a,fn)=>{calls.push(a);return fn({list:async({page,limit,customerId,currency})=>{const visible=customerId?rows.filter(r=>r.customerId===customerId&&r.currency===currency):rows;return{data:visible.slice((page-1)*limit,page*limit),meta:{total:visible.length,page,limit}};}});}};
 const service=createWorkSalesService({getStore:async()=>store});assert.deepEqual(await service.list({customerId:'40',currency:'TRY',page:'2',limit:'1'},actor),{data:[rows[3]],meta:{total:2,page:2,limit:1}});assert.equal((await service.list({customerId:'999',currency:'TRY'},actor)).meta.total,0);assert.deepEqual((await service.list({},actor)).data,rows);assert.equal(calls.length,3);
});
test('list rejects incomplete/unsafe filter keys before store access and preserves sales permission gate',async()=>{
 let reads=0;const service=createWorkSalesService({getStore:async()=>{reads++;throw Error('unexpected store');}});
 for(const query of[{customerId:'40'},{currency:'TRY'},{customerId:'40',currency:'try'},{customerId:'40',currency:'GBP'},{customerId:'040',currency:'TRY'},{customerId:40,currency:'TRY'},{customerId:'40 ',currency:'TRY'},{customerId:'40.0',currency:'TRY'},{customerId:'4e1',currency:'TRY'},{customerId:['40'],currency:'TRY'},{customerId:'9223372036854775808',currency:'TRY'},{customerId:'40',currency:'TRY',source:'all'}])await assert.rejects(()=>service.list(query,actor));
 await assert.rejects(()=>service.list({customerId:'40',currency:'TRY'},{id:'15',permissions:[]}),{statusCode:403});assert.equal(reads,0);
});
