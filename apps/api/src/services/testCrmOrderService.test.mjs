import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestCrmOrderService} from './testCrmOrderService.mjs';
import {crmOrderFingerprint,CRM_ORDER_OPENING,crmOrderTotals} from './testCrmOrderContract.mjs';
const database='MELISA_ERP_SIRKET_TEST_20260929_01',requestId='e735b2dc-95d4-4b10-99ac-3b1a0beafbc8';
const native={id:1,permissions:['sales.create','sales.view']};
const first={sourceId:'vega-161466',stockCode:'41140 SÜPERMİNİ',quantity:2,unitPrice:196,currency:'TRY'};
const second={sourceId:'vega-123',stockCode:'0007',quantity:3,unitPrice:12.3456,currency:'TRY'};
const input=()=>({requestId,conversationId:'55',customerId:593,exchangeRate:1,items:[{...first},{...second}]});
function product(line,index){const sid=line.sourceId.slice(5),key=`VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/${sid}`;return{sourceId:line.sourceId,stockCode:line.stockCode,productName:'Fixture '+line.stockCode,currency:line.currency,unitPrice:line.unitPrice,erpProductId:String(301982+index),nativeProductId:String(301982+index),productSourceKey:key,nativePriceId:String(9001+index),priceSourceKey:key+'/PRICE/sale/1/1/'+line.currency,type:'sale',unitSourceId:'1',mainUnitSourceId:'1',isMainUnit:true,tier:1,unit:'ADET',factorExact8:'1.00000000',priceExact8:line.unitPrice.toFixed(8),nativePriceExact4:line.unitPrice.toFixed(4),...CRM_ORDER_OPENING};}
function fixture(options={}){
 const calls=[],executions=[],writes=[],bindings=[];let persisted=options.existing===true,sqlReads=0;
 const body=options.input??input(),state={actor:{id:'fixture-crm-user',role:'personel',permissions:['crm.view','crm.send'],active:true},phone:'+905387217733',db:database,catalog:body.items.map(line=>({id:line.sourceId,stockCode:line.stockCode,salePrice:line.unitPrice,currency:line.currency,priceStatus:'recorded',priceBasis:'per-item'})),products:body.items.map(product)};
 const environment={MELISA_CANONICAL_TEST:'true',MELISA_TEST_SCOPED_SALES:'true',SQL_DATABASE:database,SQL_READ_ONLY:'false'};
 function document(){const totals=crmOrderTotals(body.items,body.exchangeRate);return{recordsets:[[{id:800,documentNo:'CRM-fixture',status:'draft',customerId:593,customerName:'Fixture TEST',documentCurrency:body.items[0].currency,exchangeRate:body.exchangeRate,grandTotal:totals.grandTotal,amountTry:totals.amountTry,payloadHash:crmOrderFingerprint(body,1,'fixture-crm-user')}],body.items.map((l,i)=>({...l,lineTotal:totals.lineTotals[i]}))]};}
 const service=createTestCrmOrderService({environment,transport:async(url,settings)=>{
  assert.equal(settings.headers.authorization,'Bearer fixture-crm');assert.equal(settings.redirect,'error');const path=new URL(url).pathname;calls.push(path);options.onRead?.(path,state,calls);
  if(path==='/auth/me')return Response.json({success:true,data:state.actor,meta:{source:'crm-auth'}});
  if(path==='/crm/conversations/55')return Response.json({success:true,data:{id:'55',phone:state.phone},meta:{source:'chatwoot-conversation'}});
  return Response.json({success:true,data:state.catalog.find(p=>path.endsWith('/'+p.id)),meta:{source:'melisa-existing-erp-stock-read',sourceDatabaseVerified:true,sourceDatabases:{products:'VEGA2026',images:'MELISA_ERP_V2'}}});
 },sqlDependencies:async()=>({getSqlDriver:()=>({BigInt:'bigint',UniqueIdentifier:'uuid',MAX:-1,NVarChar:n=>'nvarchar'+n,VarChar:n=>'varchar'+n,Decimal:()=> 'decimal'}),getSqlPool:async()=>({request:()=>({input(name,type,value){bindings.push({name,type,value});return this},async query(text){sqlReads++;assert.equal(text,'SELECT DB_NAME() AS databaseName;');options.onIdentity?.(state,sqlReads);return{recordset:[{databaseName:state.db}]};},async execute(proc){executions.push(proc);options.onExecute?.(proc,state);if(options.sqlError)throw{number:options.sqlError,message:'private raw SQL secret'};if(proc.endsWith('_context'))return{recordsets:[[{id:593,code:'TEST-V70-20260929-C',name:'Fixture TEST',currency:'TRY'}],state.products]};if(proc.endsWith('_read')&&!persisted)throw{number:51096};if(proc.endsWith('_create')){if(options.createError)throw{number:options.createError};persisted=true;writes.push(proc);}const result=document();options.onDocument?.(result);return result;}})})})});
 return{service,state,calls,executions,writes,bindings,environment,sqlReads:()=>sqlReads};
}
const create=f=>f.service.create(input(),native,'Bearer fixture-crm');
test('two typed products create one persisted multiline receipt; separate get and UUID replay have no extra writes',async()=>{
 const f=fixture(),ctx=await f.service.context(native,'Bearer fixture-crm');assert.equal(ctx.products.length,2);assert.equal(ctx.products[1].stockCode,'0007');assert.equal(ctx.products[0].nativeProductId,'301982');assert.equal(ctx.products[0].type,'sale');assert.equal(ctx.products[0].priceExact8,'196.00000000');
 const receipt=await create(f);assert.equal(receipt.items.length,2);assert.equal(receipt.grandTotal,429.0368);assert.equal(receipt.stockEffect,false);assert.equal(receipt.ledgerEffect,false);assert.equal(receipt.erpPersisted,true);assert.equal(Object.hasOwn(receipt,'payloadHash'),false);
 assert.deepEqual(await f.service.get(requestId,native,'Bearer fixture-crm'),receipt);assert.deepEqual(await create(f),receipt);assert.equal(f.writes.length,1);assert.equal(f.bindings.find(b=>b.name==='crm_actor_id').value,'fixture-crm-user');assert.equal(JSON.parse(f.bindings.find(b=>b.name==='items_json').value).length,2);
});
test('wrong CRM peer/actor/send permission and native permission reject before SQL',async()=>{
 for(const mutation of [s=>s.phone='+905550000000',s=>s.actor.permissions=['crm.view'],s=>s.actor.active=false,s=>s.actor.permissions='crm.view crm.send']){const f=fixture();mutation(f.state);await assert.rejects(()=>create(f));assert.equal(f.sqlReads(),0);assert.equal(f.writes.length,0);}
 const f=fixture();await assert.rejects(()=>f.service.create(input(),{id:1,permissions:['sales.view']},'Bearer fixture-crm'),{code:'CRM_TEST_NATIVE_PERMISSION_REQUIRED'});assert.equal(f.calls.length,0);
});
test('catalog mismatch on second line leaves entire request unwritten',async()=>{const f=fixture();f.state.catalog[1].salePrice=13;await assert.rejects(()=>create(f),{code:'CRM_TEST_CATALOG_CHANGED'});assert.equal(f.writes.length,0);assert.deepEqual(f.executions,['dbo.usp_test_crm_order_read','dbo.usp_test_crm_order_context']);});
test('typed binding/source/alias/unit/tier/currency drift and missing second scope cannot reach create',async()=>{
 for(const change of [{priceExact8:'12.34570000'},{nativeProductId:'301984'},{productSourceKey:'VEGA2026/F0102TBLSTOKLAR/123'},{nativePriceId:'not-id'},{type:'purchase'},{tier:2},{unitSourceId:'2'},{isMainUnit:false},{factorExact8:'0.50000000'},{unit:'PAKET'},{currency:'USD'},{runId:'other'},{sourceHash:'0'.repeat(64)},{sourceAsOf:'2026-10-05'}]){const f=fixture();Object.assign(f.state.products[1],change);await assert.rejects(()=>create(f));assert.equal(f.writes.length,0);assert.equal(f.executions.includes('dbo.usp_test_crm_order_create'),false);}
 const f=fixture();f.state.products.pop();await assert.rejects(()=>create(f),{code:'CRM_TEST_PRODUCT_MAPPING_REQUIRED'});assert.equal(f.writes.length,0);
});
test('legacy actor-scoped UUID replay does not consult new mapping or changed catalog',async()=>{
 const old={...input(),items:[{...first}]},f=fixture({existing:true,input:old});f.state.products=[];f.state.catalog=[];
 const result=await f.service.create(old,native,'Bearer fixture-crm');assert.equal(result.grandTotal,392);assert.deepEqual(f.executions,['dbo.usp_test_crm_order_read']);assert.equal(f.calls.some(p=>p.startsWith('/crm/catalog/')),false);
 const changed={...old,items:[{...first,quantity:3}]};await assert.rejects(()=>f.service.create(changed,native,'Bearer fixture-crm'),{code:'CRM_TEST_REQUEST_CONFLICT'});assert.equal(f.writes.length,0);
});
test('late CRM send revocation/peer reassignment/actor change during catalog read rejects before SQL create',async()=>{
 for(const mutation of [s=>s.actor.permissions=['crm.view'],s=>s.phone='+905550000000',s=>s.actor.id='other-user',s=>s.actor.role='mudur']){const f=fixture({onRead(path,s){if(path.endsWith('/vega-123'))mutation(s)}});await assert.rejects(()=>create(f));assert.equal(f.writes.length,0);assert.equal(f.executions.includes('dbo.usp_test_crm_order_create'),false);}
});
test('identity wait before create triggers fresh scope check; disabled environment never executes create',async()=>{
 const late=fixture({onIdentity(s,n){if(n===3)s.actor.active=false}});await assert.rejects(()=>create(late),{code:'CRM_TEST_ACCESS_DENIED'});assert.equal(late.writes.length,0);
 const wrong=fixture();wrong.state.db='OTHER';await assert.rejects(()=>create(wrong),{code:'CRM_TEST_DATABASE_REQUIRED'});assert.equal(wrong.executions.length,0);
 const off=fixture();off.environment.SQL_READ_ONLY='true';await assert.rejects(()=>create(off),{code:'CRM_TEST_DATABASE_REQUIRED'});assert.equal(off.calls.length,0);
});
test('quarantine/typed SQL drift fail closed without exposing raw SQL; none create a receipt',async()=>{
 for(const [number,code,statusCode] of [[51098,'CRM_TEST_PRODUCT_QUARANTINED',409],[51097,'CRM_TEST_OPENING_BINDING_DRIFT',409],[51099,'CRM_TEST_OPENING_NOT_READY',503],[12345,'CRM_TEST_ORDER_UNAVAILABLE',503]]){const f=fixture({createError:number});await assert.rejects(()=>create(f),e=>e.code===code&&e.statusCode===statusCode&&!e.message.includes('private'));assert.equal(f.writes.length,0);}
});
test('context duplicate mapping and corrupt readback are rejected; extras never leak',async()=>{
 const duplicates=fixture();duplicates.state.products[1]={...duplicates.state.products[0]};await assert.rejects(()=>duplicates.service.context(native,'Bearer fixture-crm'),{code:'CRM_TEST_PRODUCT_MAPPING_REQUIRED'});
 for(const change of [r=>r.recordsets[1].pop(),r=>r.recordsets[0][0].grandTotal=999,r=>r.recordsets[1][1].sourceId='invalid',r=>r.recordsets[0][0].status='confirmed']){const f=fixture({existing:true,onDocument:change});await assert.rejects(()=>create(f),{code:'CRM_TEST_ORDER_CONTRACT_INVALID'});}
 const f=fixture();f.state.products[0].privateSupplier='must-not-leak';assert.equal(Object.hasOwn((await f.service.context(native,'Bearer fixture-crm')).products[0],'privateSupplier'),false);
});
test('fresh access after readonly and write awaits hides unauthorized results; persisted retry remains UUID-bound',async()=>{
 const f=fixture({onExecute(proc,s){if(proc.endsWith('_create'))s.actor.permissions=['crm.view']}});await assert.rejects(()=>create(f),{code:'CRM_TEST_ACCESS_DENIED'});assert.equal(f.writes.length,1);f.state.actor.permissions=['crm.view','crm.send'];assert.equal((await create(f)).id,800);assert.equal(f.writes.length,1);
 const read=fixture({existing:true,onExecute(proc,s){if(proc.endsWith('_read'))s.phone='+905550000000'}});await assert.rejects(()=>read.service.get(requestId,native,'Bearer fixture-crm'),{code:'CRM_TEST_SCOPE_REQUIRED'});
});
test('actual receipt contract accepts SQL decimal HALF_UP at adversarial FX half tie',async()=>{
 const body={...input(),exchangeRate:1.00105,items:[{...first,quantity:1,unitPrice:1,currency:'USD'}]},f=fixture({input:body,existing:true,onDocument(result){result.recordsets[0][0].amountTry='1.0011';}});
 const receipt=await f.service.get(requestId,native,'Bearer fixture-crm');assert.equal(receipt.grandTotal,1);assert.equal(receipt.amountTry,1.0011);assert.equal(f.writes.length,0);
});
