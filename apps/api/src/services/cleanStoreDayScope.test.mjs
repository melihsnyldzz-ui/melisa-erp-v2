import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {registerCleanContext} from './cleanSyntheticContext.mjs';
import {withCleanStoreDayMutation,isCleanStoreDayMutation,assertCleanReceivedPurchaseContext} from './cleanStoreDayScope.mjs';
import {withCleanOrderSaleMutation} from './cleanOrderSaleScope.mjs';
const env={MELISA_CLEAN_TEST:'20261022',MELISA_CLEAN_STORE_DAY:'20261022',API_PORT:'4194',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:'MELISA_ERP_CLEAN_TEST_20261022',SQL_USER:'melisa_clean_test_app_20261022',SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false'};
Object.assign(process.env,env);
registerCleanContext({databaseName:env.SQL_DATABASE,serverName:'Semih\\MELISADEV',loginName:env.SQL_USER,databaseUser:env.SQL_USER,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'});
function fixture({operation='purchase_finalize',actorId=19,permission='purchase.finalize',missing=false,foreign=false}={}){
 const requestId='b7b88fda-9756-4867-a3c5-38a2ed4acabd',payloadJson=JSON.stringify({requestId,operation,actorId:String(actorId)}),payloadHash=createHash('sha256').update(payloadJson,'utf16le').digest('hex'),transaction={},calls=[];
 const witness={accepted:true,verified:true,environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',requestId,actorId,operation,payloadHash,receiptId:1,invoiceId:2,stockAlreadyPosted:true};
 const sqlDriver={BigInt:'bigint',UniqueIdentifier:'uuid',MAX:16,NVarChar:()=>'',Char:()=>'',Request:class{constructor(tx){assert.equal(tx,transaction);}input(){return this;}async execute(name){calls.push(name);if(missing)throw Error('cohort not installed');return {recordset:[foreign?{...witness,environmentId:'wrong'}:witness]};}}};
 return {input:{transaction,sqlDriver,actor:{id:actorId,permissions:[permission]},operation,requestId,payloadJson,payloadHash,receiptId:1,invoiceId:2},calls,witness};
}
test('native bind must succeed before existing motor scope; native finish must verify effects',async()=>{
 const f=fixture();assert.equal(isCleanStoreDayMutation(),false);
 const value=await withCleanStoreDayMutation(f.input,async()=>{assert.equal(isCleanStoreDayMutation(),true);await assertCleanReceivedPurchaseContext({...f.input,cleanStoreDayReceived:true},2);return 'existing-native-result';});
 assert.equal(value,'existing-native-result');assert.equal(isCleanStoreDayMutation(),false);
 assert.deepEqual(f.calls,['dbo.usp_clean_store_day_bind','dbo.usp_clean_store_received_purchase_proof','dbo.usp_clean_store_day_finish']);
});
test('missing cohort and foreign native proof cannot open the scope',async()=>{
 for(const options of [{missing:true},{foreign:true}]){const f=fixture(options);let ran=false;await assert.rejects(withCleanStoreDayMutation(f.input,async()=>{ran=true;}));assert.equal(ran,false);assert.equal(isCleanStoreDayMutation(),false);}
});
test('personnel cannot approve, unsigned payload and wrong target never reach SQL',async()=>{
 const f=fixture();for(const input of [{...f.input,actor:{id:18,permissions:['purchase.finalize']}},{...f.input,payloadHash:'f'.repeat(64)},{...f.input,operation:'sale_finalize'},{...f.input,receiptId:0},{...f.input,receiptId:null},{...f.input,invoiceId:null}])await assert.rejects(withCleanStoreDayMutation(input,async()=>{}));
 process.env.API_PORT='4196';try{await assert.rejects(withCleanStoreDayMutation(f.input,async()=>{}));}finally{process.env.API_PORT='4194';}assert.equal(f.calls.length,0);
});
test('stockAlreadyReceived flag alone, cross-TX proof, and nested scopes are rejected',async()=>{
 const f=fixture();await assert.rejects(assertCleanReceivedPurchaseContext({...f.input,cleanStoreDayReceived:true},2));
 await withCleanStoreDayMutation(f.input,async()=>{await assert.rejects(assertCleanReceivedPurchaseContext({...f.input,transaction:{},cleanStoreDayReceived:true},2));await assert.rejects(withCleanStoreDayMutation(f.input,async()=>{}));await assert.rejects(assertCleanReceivedPurchaseContext({...f.input,cleanStoreDayReceived:true},3));});
 assert.deepEqual(f.calls,['dbo.usp_clean_store_day_bind','dbo.usp_clean_store_day_finish']);
});
test('SALE and inbound scope cannot nest in either direction',async()=>{
 process.env.MELISA_CLEAN_SALES='20261022';const f=fixture();
 await withCleanOrderSaleMutation({transaction:f.input.transaction,operation:'finalize',orderId:3},async()=>{await assert.rejects(withCleanStoreDayMutation(f.input,async()=>{}));});
 assert.equal(f.calls.length,0);
 await withCleanStoreDayMutation(f.input,async()=>{await assert.rejects(withCleanOrderSaleMutation({transaction:f.input.transaction,operation:'finalize',orderId:3},async()=>{}));});
});
test('finance uses its native binder, exact sale/purchase and real actor20 without aliasing legacy16',async()=>{
 process.env.MELISA_CLEAN_FINANCE='20261022';
 try{
  for(const operation of ['collection_create','payment']){
   const f=fixture({operation,actorId:20,permission:operation==='payment'?'finance.payment':'finance.collection'});
   Object.assign(f.input,{invoiceId:operation==='payment'?4:1,receiptId:operation==='payment'?3:null});
   await withCleanStoreDayMutation(f.input,async()=>{assert.equal(isCleanStoreDayMutation(),true);});
   assert.deepEqual(f.calls,['dbo.usp_clean_store_finance_bind','dbo.usp_clean_store_finance_finish']);
   for(const patch of [{actor:{id:16,permissions:['finance.collection','finance.payment']}},{invoiceId:2},{receiptId:0}])await assert.rejects(withCleanStoreDayMutation({...f.input,...patch},async()=>assert.fail()));
  }
 }finally{delete process.env.MELISA_CLEAN_FINANCE;}
 const f=fixture({operation:'collection_create',actorId:20,permission:'finance.collection'});Object.assign(f.input,{invoiceId:1,receiptId:null});
 await assert.rejects(withCleanStoreDayMutation(f.input,async()=>assert.fail()));assert.equal(f.calls.length,0);
});

test('daily count and return require the dedicated native cohort and their real actor; old finance cannot issue inventory authority',async()=>{
 process.env.MELISA_CLEAN_INVENTORY='20261022';
 try{for(const [operation,actorId,permission] of [['stock_count_draft',21,'product.view'],['stock_count_approve',22,'stock.adjust'],['purchase_return_draft',21,'purchase.view'],['purchase_return_cancel',22,'purchase.cancel']]){
  const f=fixture({operation,actorId,permission});Object.assign(f.input,{receiptId:operation.startsWith('purchase_return_')?3:null,invoiceId:operation.startsWith('purchase_return_')?4:null});
  await withCleanStoreDayMutation(f.input,async()=>assert.equal(isCleanStoreDayMutation(),true));
  assert.deepEqual(f.calls,['dbo.usp_clean_store_inventory_bind','dbo.usp_clean_store_inventory_finish']);
  for(const patch of [{actor:{id:20,permissions:[permission]}},{actor:{id:16,permissions:[permission]}},{invoiceId:2}])await assert.rejects(withCleanStoreDayMutation({...f.input,...patch},async()=>assert.fail()));
  process.env.API_PORT='4196';try{await assert.rejects(withCleanStoreDayMutation(f.input,async()=>assert.fail()));}finally{process.env.API_PORT='4194';}
 }}finally{delete process.env.MELISA_CLEAN_INVENTORY;}
 const f=fixture({operation:'stock_count_draft',actorId:21,permission:'product.view'});Object.assign(f.input,{receiptId:null,invoiceId:null});await assert.rejects(withCleanStoreDayMutation(f.input,async()=>assert.fail()));assert.equal(f.calls.length,0);
});
