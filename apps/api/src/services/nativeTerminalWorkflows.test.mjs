import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
const blocked=()=>{throw Error('Unexpected real boundary');};
mock.module('./nativeTerminalCatalog.mjs',{namedExports:{nativeRequestContext:blocked,nativeCustomers:blocked}});
mock.module('./currencyRateService.js',{namedExports:{getCurrencyRates:blocked,upsertCurrencyRates:blocked}});
mock.module('./salesPipelineService.js',{namedExports:{listPipelineDocuments:blocked,getPipelineDocument:blocked}});
mock.module('../config/database.js',{namedExports:{getSqlPool:blocked,getSqlDriver:blocked}});
const {createNativeWorkflows}=await import('./nativeTerminalWorkflows.mjs');
const actor={id:8,permissions:['terminal.sales.create','sales.view']},manager={...actor,permissions:[...actor.permissions,'settings.manage']};
const query={terminalCode:'TEST-DEVICE'};
function fixture(){
 const calls=[],doc={id:3,documentNo:'SIP-TEST',customerName:'TEST',documentDate:'2026-09-15',itemCount:1,status:'CONFIRMED',grandTotal:100,
  items:[{id:11,productId:21,stockCode:'TEST-21',productName:'Test product',quantity:2,barcode:'1001'}]};
 const deps={
  context:async(code,user)=>{assert.equal(code,'TEST-DEVICE');assert.equal(user.id,8);calls.push('context');},
  readRates:async()=>({rates:[{currency:'USD',rateToTry:1,defined:false,rateDate:'2026-09-15'},{currency:'TRY',rateToTry:1,defined:true,rateDate:'2026-09-15'}]}),
  writeRates:async(payload,user)=>calls.push({payload,user}),
  list:async(kind,q)=>{calls.push({kind,q});return {data:[doc],meta:{hasNextPage:true,total:31}};},
  detail:async(kind,id)=>{assert.equal(kind,'order');assert.equal(id,3);return doc;},
  barcodes:async()=>[{product_id:21,barcode:'1001'},{product_id:21,barcode:'1002'}]
 };
 return {api:createNativeWorkflows(deps),deps,calls,doc};
}
test('settings retain undefined rates, permission and read-only boundary',async()=>{
 const f=fixture(),r=await f.api.settings(query,actor);
 assert.equal(r.rates[0].rateToTry,null);assert.equal(r.rates[1].rateToTry,'1');assert.equal(r.canEditRates,false);assert.equal(r.paperFormat,'A4');assert.deepEqual(f.calls,['context']);
});
test('unauthorized rates cannot enter context or write service',async()=>{
 const f=fixture();await assert.rejects(f.api.saveRates({...query,rates:{USD:'47',EUR:'53'}},actor),{code:'AUTH_PERMISSION_DENIED'});assert.equal(f.calls.length,0);
});
test('invalid currency input never reaches shared ERP writer',async()=>{
 for(const rates of [{USD:'0',EUR:'2'},{USD:'-1',EUR:'2'},{USD:'NaN',EUR:'2'},{USD:'1',EUR:'1.123456789'}]){
  const f=fixture();await assert.rejects(f.api.saveRates({...query,rates},manager),{code:'NATIVE_RATE_INVALID'});assert.deepEqual(f.calls,['context']);
 }
});
test('rate writes delegate to existing audited ERP service with actor',async()=>{
 const f=fixture();const r=await f.api.saveRates({...query,rates:{USD:'47.8',EUR:'53.25'}},manager);
 assert.deepEqual(f.calls[1],{payload:{rates:{USD:'47.8',EUR:'53.25'},source:'native-terminal'},user:manager});assert.equal(r.canEditRates,true);
});
test('terminal validation rejects writes even for settings managers',async()=>{
 const f=fixture();f.deps.context=async()=>{throw Object.assign(Error('inactive device'),{code:'TERMINAL_INACTIVE'});};
 await assert.rejects(createNativeWorkflows(f.deps).saveRates({...query,rates:{USD:'47',EUR:'53'}},manager),{code:'TERMINAL_INACTIVE'});assert.equal(f.calls.length,0);
});
test('order lists require sales view and always read confirmed paginated orders',async()=>{
 const f=fixture();await assert.rejects(f.api.orders(query,{...actor,permissions:[]}),{code:'AUTH_PERMISSION_DENIED'});assert.equal(f.calls.length,0);
 const r=await f.api.orders({...query,page:'2',search:'SIP'},actor);
 assert.deepEqual(f.calls[1],{kind:'order',q:{page:2,limit:30,search:'SIP',status:'confirmed'}});
 assert.equal(r.total,31);assert.equal(r.hasMore,true);assert.ok(!('grandTotal' in r.orders[0]));
});
test('bad pages cannot enter order query',async()=>{
 for(const page of ['NaN','1.5','0','100001']){const f=fixture();await assert.rejects(f.api.orders({...query,page},actor),{code:'NATIVE_PAGE_INVALID'});assert.deepEqual(f.calls,['context']);}
});
test('order revision changes when expected quantity changes; alternate barcodes retained once',async()=>{
 const f=fixture(),first=await f.api.order(3,query,actor);
 assert.deepEqual(first.items[0].barcodes,['1001','1002']);assert.equal(first.items[0].quantity,'2');
 f.doc.items[0].quantity=3;const second=await f.api.order(3,query,actor);assert.notEqual(first.revision,second.revision);
});
test('cancelled or fulfilled orders are never opened for picking',async()=>{
 for(const status of ['CANCELLED','FULFILLED','DRAFT']){const f=fixture();f.doc.status=status;await assert.rejects(f.api.order(3,query,actor),{code:'NATIVE_ORDER_NOT_OPEN'});}
});

