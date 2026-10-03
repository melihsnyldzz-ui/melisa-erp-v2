import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestCrmOrderService} from './testCrmOrderService.mjs';
import {crmOrderFingerprint} from './testCrmOrderContract.mjs';
const database='MELISA_ERP_SIRKET_TEST_20260929_01',requestId='e735b2dc-95d4-4b10-99ac-3b1a0beafbc8';
const input=()=>({requestId,conversationId:'55',customerId:593,exchangeRate:1,items:[{sourceId:'vega-161466',stockCode:'41140 SÜPERMİNİ',quantity:2,unitPrice:196,currency:'TRY'}]});
const native={id:1,permissions:['sales.create','sales.view']};
function fixture({authStatus=200,phone='+905387217733',price=196,db=database,actorPermissions=['crm.view','crm.send'],scope=true,sqlError=null,existing=false}={}){
  const calls=[],executions=[],bindings=[];let sqlReads=0,persisted=existing;
  const environment={MELISA_CANONICAL_TEST:'true',MELISA_TEST_SCOPED_SALES:'true',SQL_DATABASE:database,SQL_READ_ONLY:'false'};
  const service=createTestCrmOrderService({environment,transport:async(url,options)=>{
    assert.equal(options.headers.authorization,'Bearer fixture-crm');assert.equal(options.redirect,'error');calls.push(new URL(url).pathname);
    if(new URL(url).pathname==='/auth/me')return Response.json({success:authStatus===200,data:{id:'fixture-crm-user',role:'personel',permissions:actorPermissions},meta:{source:'crm-auth'}},{status:authStatus});
    if(new URL(url).pathname==='/crm/conversations/55')return Response.json({success:true,data:{id:'55',phone},meta:{source:'chatwoot-conversation'}});
    return Response.json({success:true,data:{id:'vega-161466',stockCode:'41140 SÜPERMİNİ',salePrice:price,currency:'TRY',priceStatus:'recorded',priceBasis:'per-item'},meta:{source:'melisa-existing-erp-stock-read',sourceDatabaseVerified:true,sourceDatabases:{products:'VEGA2026',images:'MELISA_ERP_V2'}}});
  },sqlDependencies:async()=>({getSqlDriver:()=>({BigInt:'bigint',UniqueIdentifier:'uuid',MAX:-1,NVarChar:n=>'nvarchar'+n,VarChar:n=>'varchar'+n,Decimal:()=> 'decimal'}),getSqlPool:async()=>({request:()=>({input(name,type,value){bindings.push({name,type,value});return this},async query(text){sqlReads++;assert.equal(text,'SELECT DB_NAME() AS databaseName;');return{recordset:[{databaseName:db}]};},async execute(procedure){executions.push(procedure);if(sqlError)throw{number:sqlError};if(procedure.endsWith('_context'))return{recordsets:[[scope?{id:593,code:'TEST-V70-20260929-C',name:'Fixture TEST',currency:'TRY'}:null].filter(Boolean),[{sourceId:'vega-161466',stockCode:'41140 SÜPERMİNİ',productName:'Fixture product',unitPrice:196,currency:'TRY',erpProductId:301982}]]};if(procedure.endsWith('_read')&&!persisted)throw{number:51096};if(procedure.endsWith('_create'))persisted=true;return{recordsets:[[{id:800,documentNo:'CRM-fixture',status:'draft',customerId:593,customerName:'Fixture TEST',documentCurrency:'TRY',exchangeRate:1,grandTotal:392,amountTry:392,payloadHash:crmOrderFingerprint(input(),1,'fixture-crm-user')}],[{sourceId:'vega-161466',stockCode:'41140 SÜPERMİNİ',quantity:2,unitPrice:196,currency:'TRY',lineTotal:392}]]};}})})})});
  return{service,calls,executions,bindings,sqlReads:()=>sqlReads,environment};
}
test('CRM/native auth and test peer reject before SQL execution',async()=>{
  for(const settings of [{authStatus:401},{phone:'+905550000000'},{actorPermissions:['crm.view']}]){const f=fixture(settings);await assert.rejects(()=>f.service.create(input(),native,'Bearer fixture-crm'));assert.equal(f.executions.length,0);assert.equal(f.sqlReads(),0);}
  const f=fixture();await assert.rejects(()=>f.service.create(input(),{id:1,permissions:['sales.view']},'Bearer fixture-crm'));assert.equal(f.calls.length,0);
});
test('fresh catalog price mismatch and wrong database block procedure writes',async()=>{
  const changed=fixture({price:197});await assert.rejects(()=>changed.service.create(input(),native,'Bearer fixture-crm'),{code:'CRM_TEST_CATALOG_CHANGED'});assert.deepEqual(changed.executions,['dbo.usp_test_crm_order_read']);
  const wrong=fixture({db:'OTHER_DATABASE'});await assert.rejects(()=>wrong.service.create(input(),native,'Bearer fixture-crm'),{code:'CRM_TEST_DATABASE_REQUIRED'});assert.equal(wrong.executions.length,0);
});
test('canonical context and receipt expose persisted draft without stock or ledger effect',async()=>{
  const f=fixture(),context=await f.service.context(native,'Bearer fixture-crm');assert.equal(context.customer.id,593);assert.equal(context.products[0].erpProductId,301982);
  const receipt=await f.service.create(input(),native,'Bearer fixture-crm');assert.equal(receipt.database,database);assert.equal(receipt.status,'draft');assert.equal(receipt.grandTotal,392);assert.equal(receipt.stockEffect,false);assert.equal(receipt.ledgerEffect,false);assert.equal(receipt.erpPersisted,true);
  assert.equal(f.executions[2],'dbo.usp_test_crm_order_create');assert.equal(f.bindings.find(binding=>binding.name==='crm_actor_id').value,'fixture-crm-user');assert.equal(f.bindings.find(binding=>binding.name==='customer_id').value,593);
  const read=await f.service.get(requestId,native,'Bearer fixture-crm');assert.deepEqual(read,receipt);assert.equal(f.executions[3],'dbo.usp_test_crm_order_read');assert.equal(Object.hasOwn(read,'payloadHash'),false);
});

test('same request returns persisted draft despite changed catalog; different payload conflicts before catalog or write',async()=>{
  const replay=fixture({existing:true,price:999});
  const receipt=await replay.service.create(input(),native,'Bearer fixture-crm');
  assert.equal(receipt.grandTotal,392);assert.equal(receipt.items[0].unitPrice,196);assert.equal(Object.hasOwn(receipt,'payloadHash'),false);
  assert.deepEqual(replay.executions,['dbo.usp_test_crm_order_read']);assert.deepEqual(replay.calls,['/auth/me','/crm/conversations/55']);
  const changed=fixture({existing:true}),request=input();request.items[0].quantity=3;
  await assert.rejects(()=>changed.service.create(request,native,'Bearer fixture-crm'),{code:'CRM_TEST_REQUEST_CONFLICT',statusCode:409});
  assert.deepEqual(changed.executions,['dbo.usp_test_crm_order_read']);assert.deepEqual(changed.calls,['/auth/me','/crm/conversations/55']);
});
test('SQL idempotency conflict is sanitized and environment identity fails closed',async()=>{
  const f=fixture({sqlError:51093});await assert.rejects(()=>f.service.create(input(),native,'Bearer fixture-crm'),{code:'CRM_TEST_REQUEST_CONFLICT',statusCode:409});
  const disabled=fixture();disabled.environment.SQL_READ_ONLY='true';await assert.rejects(()=>disabled.service.context(native,'Bearer fixture-crm'),{code:'CRM_TEST_DATABASE_REQUIRED'});assert.equal(disabled.calls.length,0);
});
