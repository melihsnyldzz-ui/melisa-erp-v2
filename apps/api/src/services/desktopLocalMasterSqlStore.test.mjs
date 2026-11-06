import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopLocalMasterSqlStore} from './desktopLocalMasterSqlStore.mjs';
import {productRejectionRecord,productRejectionOutcome} from './desktopProductRejection.mjs';

function fakeDriver({rejectTarget=false,rejectMutation=false,commitLost=false,noEnabledDirectPermission=false,extraPermission=false,inactiveSupplier=false,badSupplierReadback=false,productConflictReason=null,replayResponse=null}={}){
 const log=[];let txCount=0;
 class Transaction{
  constructor(pool){this.pool=pool;this.id=++txCount;this.open=false;}
  async begin(level){this.open=true;log.push({kind:'begin',id:this.id,level});}
  async commit(){log.push({kind:'commit',id:this.id});this.open=false;if(commitLost)throw Error('lost ack');}
  async rollback(){log.push({kind:'rollback',id:this.id});this.open=false;}
 }
 class Request{
  constructor(tx){if(!tx.open)throw Error('not in transaction');this.tx=tx;this.params={};}
  input(name,type,value){this.params[name]=value;return this;}
  async query(statement){
   log.push({kind:'sql',id:this.tx.id,statement,params:this.params});
   if(statement.includes('LOCAL_SQL_TARGET_REJECTED')){assert.match(statement,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);if(rejectTarget||extraPermission)throw Error('target or permission drift');return {recordset:[{ok:1}]};}
   if(statement.includes('FROM dbo.users u WITH(UPDLOCK,HOLDLOCK)')){
    if(noEnabledDirectPermission){assert.match(statement,/p\.can_view=1 OR p\.can_create=1 OR p\.can_update=1 OR p\.can_approve=1/);return {recordset:[]};}
    return {recordset:[{id:'7'}]};
   }
   if(statement.includes('INSERT dbo.customers')){if(rejectMutation)throw Error('constraint');return {recordset:[{id:'42'}]};}
   if(statement.includes('INSERT dbo.suppliers'))return {recordset:[{id:'51'}]};
   if(statement.includes('INSERT dbo.party_entities'))return {recordset:[{id:'52'}]};
   if(statement.includes('UPDATE dbo.suppliers SET party_entity_id'))return {recordset:[{changed:1}]};
   if(statement.includes('INSERT dbo.party_currency_accounts'))return {recordset:[{id:'53'}]};
   if(statement.includes('FROM dbo.suppliers s JOIN dbo.party_entities'))return {recordset:[{s_id:'51',s_entity:'52',s_currency:'TRY',s_code:'T1',s_name:'Tedarik',s_phone:'555',s_city:'İstanbul',s_country:'Türkiye',s_discount:'12.5000',s_balance:'0.0000',s_active:true,s_deleted:false,e_id:'52',e_role:'supplier',e_name:'Tedarik',e_country:'Türkiye',a_id:'53',a_entity:'52',a_customer:null,a_supplier:badSupplierReadback?'999':'51',a_currency:'TRY',a_balance:'0.00000000'}]};
   if(statement.includes('FROM dbo.suppliers WITH(UPDLOCK,HOLDLOCK)'))return {recordset:[{id:'51',isActive:!inactiveSupplier,isDeleted:false}]};
   if(statement.includes('SELECT brand,category,CONVERT'))return {recordset:[{brand:'B',category:'C',supplierId:'51'}]};
   if(statement.includes('END conflictReason')){assert.match(statement,/dbo\.products WITH\(UPDLOCK,HOLDLOCK\)/);assert.match(statement,/dbo\.product_barcodes WITH\(UPDLOCK,HOLDLOCK\)/);return {recordset:[{conflictReason:productConflictReason}]};}
   if(statement.includes('INSERT dbo.products'))return {recordset:[{id:'81'}]};
   if(statement.includes('LOCAL_MASTER_REQUEST_LOCKED'))return {recordset:replayResponse?[{response_json:JSON.stringify(replayResponse)}]:[]};
   if(statement.includes('LOCAL_MASTER_REQUEST_LOCK_REQUIRED')){this.tx.journal={requestId:this.params.requestIdText,operation:this.params.operation,actorId:this.params.actorIdText,payloadHash:this.params.payloadHash.toString('hex'),response_json:this.params.responseJson};return {recordset:[{response_json:this.params.responseJson}]};}
   if(statement.includes('FROM dbo.desktop_local_master_requests WHERE request_id=')){assert.match(statement,/LOWER\(CONVERT\(varchar\(36\),request_id\)\)/);return {recordset:[this.tx.journal]};}
   throw Error('unexpected SQL');
  }
 }
 const type=()=>({});const sql={Transaction,Request,NVarChar:type,VarBinary:type,Int:{},MAX:-1,ISOLATION_LEVEL:{SERIALIZABLE:4}};
 return {sql,pool:{},log};
}

test('v3 supplier authority, account relationship and journal commit are bound to one transaction',async()=>{
 const f=fakeDriver(),store=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async({permission})=>permission==='supplier.edit'}),r={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'supplier.create',actorId:'7',payloadHash:'ab'.repeat(32)};
 await store.withTransaction(async tx=>{assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'supplier.edit'}),true);await tx.beginRequest(r);
  const supplierId=await tx.insertSupplier({actorId:'7',supplierCode:'T1',name:'Tedarik',phone:'555',city:'İstanbul',country:'Türkiye',currency:'TRY',purchaseDiscountRateExact4:'12.5000'});
  const entityId=await tx.insertPartyEntity({actorId:'7',role:'supplier',name:'Tedarik',country:'Türkiye'});await tx.attachSupplierEntity({supplierId,entityId});
  const accountId=await tx.insertSupplierCurrencyAccount({supplierId,entityId,currency:'TRY',currentBalanceExact8:'0.00000000'});const values=await tx.readSupplierPersistence({supplierId,entityId,accountId});assert.equal(values.account.customerId,null);assert.equal(values.account.supplierId,supplierId);
  await tx.finishRequest({...r,response:{id:supplierId}});await tx.readFinishedRequest({requestId:r.requestId});});
 const sqls=f.log.filter(x=>x.kind==='sql');assert.equal(new Set(sqls.map(x=>x.id)).size,1);assert.match(sqls[0].statement,/schema_version=3/);assert.equal(sqls.find(x=>x.params?.direct==='supplier.edit').params.manage,'suppliers.manage');assert.ok(sqls.some(x=>x.statement.includes("N'supplier.create'")));assert.equal(f.log.at(-1).kind,'commit');
});
test('v3 supplier readback mismatch prevents commit and selected supplier must be active before product insert',async()=>{
 const f=fakeDriver({badSupplierReadback:true}),store=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async()=>true}),r={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'supplier.create',actorId:'7',payloadHash:'ab'.repeat(32)};
 await assert.rejects(store.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'supplier.edit'});await tx.beginRequest(r);const supplierId=await tx.insertSupplier({actorId:'7',supplierCode:'T1',name:'Tedarik',phone:'555',city:'İstanbul',country:'Türkiye',currency:'TRY',purchaseDiscountRateExact4:'12.5000'});const entityId=await tx.insertPartyEntity({role:'supplier',name:'Tedarik',country:'Türkiye'});await tx.attachSupplierEntity({supplierId,entityId});const accountId=await tx.insertSupplierCurrencyAccount({supplierId,entityId,currency:'TRY',currentBalanceExact8:'0.00000000'});await tx.readSupplierPersistence({supplierId,entityId,accountId});}),/LOCAL_SQL_SUPPLIER_READBACK/);assert.equal(f.log.at(-1).kind,'rollback');
 const g=fakeDriver({inactiveSupplier:true}),other=createDesktopLocalMasterSqlStore({...g,richCards:true,verifySession:async()=>true});await assert.rejects(other.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest({...r,operation:'product.create'});await tx.lockActiveSupplier({supplierId:'51'});}),/LOCAL_SQL_SUPPLIER_UNAVAILABLE/);assert.equal(g.log.some(x=>x.statement?.includes('INSERT dbo.products')),false);
});
test('v3 product cannot be inserted without same-transaction supplier lock and exact rich readback',async()=>{
 const r={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'product.create',actorId:'7',payloadHash:'ab'.repeat(32)},p={actorId:'7',stockCode:'P',name:'Ürün',unit:'ADET',currency:'TRY',salePriceExact4:'2.0000',purchasePriceExact4:'1.0000',purchaseDiscountRateExact4:'0.0000',averageCostTryExact4:'1.0000',initialStockExact3:'0.000',brand:'B',category:'C',supplierId:'51'};
 const missing=fakeDriver(),a=createDesktopLocalMasterSqlStore({...missing,richCards:true,verifySession:async()=>true});await assert.rejects(a.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(r);await tx.insertProduct(p);}),/LOCAL_SQL_ORDER/);assert.equal(missing.log.some(x=>x.statement?.includes('INSERT dbo.products')),false);
 const f=fakeDriver(),b=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async()=>true});await b.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(r);await tx.lockActiveSupplier({supplierId:'51'});await tx.findProductConflict({stockCode:p.stockCode,barcode:'B1'});const productId=await tx.insertProduct(p);assert.deepEqual(await tx.readRichProductFields({productId}),{brand:'B',category:'C',supplierId:'51'});await tx.finishRequest({...r,response:{id:productId}});await tx.readFinishedRequest({requestId:r.requestId});});const insert=f.log.find(x=>x.statement?.includes('INSERT dbo.products'));assert.equal(insert.params.supplier,'51');assert.equal(insert.params.brand,'B');assert.equal(insert.params.category,'C');assert.match(insert.statement,/brand,category,supplier_id/);
});

test('wrong physical target aborts before callback, rolls back and does not mutate',async()=>{
 const f=fakeDriver({rejectTarget:true});let called=false;
 const store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await assert.rejects(store.withTransaction(async()=>{called=true;}));
 assert.equal(called,false);assert.deepEqual(f.log.map(x=>x.kind),['begin','sql','rollback']);
 assert.match(f.log[1].statement,/schema_version=2 AND actual_t1=0 AND external_operations=0 AND read_only=0/);assert.match(f.log[1].statement,/database_guid/);assert.match(f.log[1].statement,/DATALENGTH\(USER_NAME\(\)\)/);
});

test('rich conflict rejection commits only under locked authority and the same reserved UUID',async()=>{
 const f=fakeDriver({productConflictReason:'PRODUCT_BARCODE_IN_USE'}),store=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async()=>true});
 const r={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'product.create',actorId:'7',payloadHash:'ab'.repeat(32)};
 await store.withTransaction(async tx=>{
  await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(r);await tx.lockActiveSupplier({supplierId:'51'});
  assert.equal(await tx.findProductConflict({stockCode:'P2',barcode:'existing'}),'PRODUCT_BARCODE_IN_USE');
  const response=productRejectionRecord(r.requestId,'PRODUCT_BARCODE_IN_USE');await tx.finishRequest({...r,response});assert.deepEqual((await tx.readFinishedRequest({requestId:r.requestId})).response,response);
  return productRejectionOutcome(response,false);
 });
 assert.equal(f.log.some(x=>x.statement&&/INSERT dbo\.(?:products|product_barcodes|stock_movements|desktop_local_product_units)/.test(x.statement)),false);
 assert.equal(f.log.filter(x=>x.kind==='commit').length,1);assert.equal(f.log.filter(x=>x.statement?.includes('INSERT dbo.desktop_local_master_requests')).length,1);
 for(const reason of [null,'PRODUCT_STOCK_CODE_IN_USE']){
  const x=fakeDriver({productConflictReason:reason}),s=createDesktopLocalMasterSqlStore({...x,richCards:true,verifySession:async()=>true});
  await assert.rejects(s.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(r);await tx.lockActiveSupplier({supplierId:'51'});await tx.findProductConflict({stockCode:'P2',barcode:'existing'});await tx.finishRequest({...r,response:productRejectionRecord(r.requestId,'PRODUCT_BARCODE_IN_USE')});}),/LOCAL_SQL_ORDER/);
  assert.equal(x.log.some(v=>v.kind==='commit'),false);
 }
});

test('a stored rejection is replayed without a new product check or write; fabricated NOT_COMMITTED cannot commit',async()=>{
 const r={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'product.create',actorId:'7',payloadHash:'ab'.repeat(32)},record=productRejectionRecord(r.requestId,'PRODUCT_BARCODE_IN_USE');
 const f=fakeDriver({replayResponse:record}),store=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async()=>true});
 const outcome=await store.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});const prior=await tx.beginRequest(r);assert.equal(prior.state,'REPLAY');return productRejectionOutcome(prior.response,true);});assert.equal(outcome.state,'NOT_COMMITTED');
 assert.equal(f.log.some(x=>x.statement?.includes('END conflictReason')||x.statement?.includes('INSERT dbo.')),false);
 const forged=fakeDriver(),other=createDesktopLocalMasterSqlStore({...forged,richCards:true,verifySession:async()=>true});
 await assert.rejects(other.withTransaction(async tx=>{await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(r);return productRejectionOutcome(record,false);}),/LOCAL_SQL_UNFINISHED_REQUEST/);
 assert.equal(forged.log.some(x=>x.kind==='commit'),false);
});
test('extra writer permission aborts before business callback or data mutation',async()=>{
 const f=fakeDriver({extraPermission:true}),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});let called=false;
 await assert.rejects(store.withTransaction(async()=>{called=true;}));assert.equal(called,false);
 assert.deepEqual(f.log.map(x=>x.kind),['begin','sql','rollback']);
});

test('normal session and locked create permission precede a parameterized customer insert on same transaction',async()=>{
 const f=fakeDriver();let verifiedTx;
 const store=createDesktopLocalMasterSqlStore({...f,verifySession:async({transaction,actorId,permission})=>{verifiedTx=transaction;return actorId==='7'&&permission==='customer.edit';}});
 const reservation={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'customer.create',actorId:'7',payloadHash:'ab'.repeat(32)};
 const injection="Müşteri'); DROP TABLE customers;--";
 const result=await store.withTransaction(async tx=>{
  assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'}),true);
  assert.deepEqual(await tx.beginRequest(reservation),{state:'NEW'});
  const id=await tx.insertCustomer({customerCode:'C01',name:injection,phone:'123',customerType:'customer',currency:'TRY',actorId:'7'});
  await tx.finishRequest({...reservation,response:{id}});await tx.readFinishedRequest({requestId:reservation.requestId});return id;
 });
 assert.equal(result,'42');const sqls=f.log.filter(x=>x.kind==='sql');
 assert.ok(verifiedTx);assert.ok(sqls.every(x=>x.id===verifiedTx.id));
 const insert=sqls.find(x=>x.statement.includes('INSERT dbo.customers'));
 assert.equal(insert.params.name,injection);assert.ok(!insert.statement.includes(injection));
 assert.match(sqls[1].statement,/UPDLOCK,HOLDLOCK/);assert.match(sqls[1].statement,/p\.can_create=1 OR p\.can_update=1/);
 assert.equal(sqls[1].params.direct,'customer.edit');assert.equal(sqls[1].params.update,'customer.update');assert.equal(sqls[1].params.manage,'customers.manage');
 assert.ok(!Object.values(sqls[1].params).includes('customer.view'));
 assert.equal(f.log.at(-1).kind,'commit');
});

test('mutation failure rolls back; commit acknowledgement loss is not reported as success',async()=>{
 for(const flags of [{rejectMutation:true},{commitLost:true}]){
  const f=fakeDriver(flags),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
  const reservation={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'customer.create',actorId:'7',payloadHash:'ab'.repeat(32)};
  await assert.rejects(store.withTransaction(async tx=>{
   assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'}),true);
   await tx.beginRequest(reservation);
   const id=await tx.insertCustomer({customerCode:'C01',name:'A',phone:'1',customerType:'customer',currency:'TRY',actorId:'7'});
   await tx.finishRequest({...reservation,response:{id}});await tx.readFinishedRequest({requestId:reservation.requestId});return id;
  }));
  if(flags.rejectMutation)assert.equal(f.log.at(-1).kind,'rollback');
  else assert.equal(f.log.at(-1).kind,'rollback'); // no success after lost commit acknowledgement
 }
});

test('a direct caller cannot insert without authority and an owned fresh journal reservation',async()=>{
 const f=fakeDriver(),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await assert.rejects(store.withTransaction(tx=>tx.insertCustomer({actorId:'7'})),/LOCAL_SQL_ORDER/);
 assert.ok(!f.log.some(x=>x.statement?.includes('INSERT dbo.customers')));
 const g=fakeDriver(),other=createDesktopLocalMasterSqlStore({...g,verifySession:async()=>true});
 await assert.rejects(other.withTransaction(async tx=>{
  await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'});
  await tx.beginRequest({requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'product.create',actorId:'7',payloadHash:'ab'.repeat(32)});
 }),/LOCAL_SQL_ORDER/);
 assert.ok(!g.log.some(x=>x.statement?.includes('INSERT dbo.products')));
});

test('journal insertion without a same-transaction readback cannot commit',async()=>{
 const f=fakeDriver(),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 const reservation={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'customer.create',actorId:'7',payloadHash:'ab'.repeat(32)};
 await assert.rejects(store.withTransaction(async tx=>{
  await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'});await tx.beginRequest(reservation);
  await tx.finishRequest({...reservation,response:{id:'42'}});
 }),/LOCAL_SQL_UNFINISHED_REQUEST/);
 assert.equal(f.log.at(-1).kind,'rollback');
});

test('opening movement cannot target an existing product or finish without its same-request movement',async()=>{
 for(const action of ['existing','other','unfinished']){
  const f=fakeDriver(),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
  const reservation={requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',operation:'product.create',actorId:'7',payloadHash:'ab'.repeat(32)};
  await assert.rejects(store.withTransaction(async tx=>{
   await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'});await tx.beginRequest(reservation);
   if(action!=='existing')await tx.insertProduct({actorId:'7',initialStockExact3:'4.000',averageCostTryExact4:'5.3000'});
   if(action==='unfinished')return tx.finishRequest({...reservation,response:{id:'81'}});
   return tx.insertOpeningMovement({productId:'99',actorId:'7',quantityExact3:'4.000',averageCostTryExact4:'5.3000'});
  }),/LOCAL_SQL_ORDER/);
  assert.ok(!f.log.some(x=>x.statement?.includes('INSERT dbo.stock_movements')));assert.equal(f.log.at(-1).kind,'rollback');
 }
});

test('missing or false current session cannot authorize writing',async()=>{
 const f=fakeDriver();assert.throws(()=>createDesktopLocalMasterSqlStore({...f}));
 const store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>false});
 await store.withTransaction(async tx=>assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'}),false));
 assert.equal(f.log.filter(x=>x.kind==='sql').length,1);
});

test('product authorization targets the PR54 direct and legacy edit keys',async()=>{
 const f=fakeDriver(),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await store.withTransaction(async tx=>assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'}),true));
 const auth=f.log.find(x=>x.statement?.includes('FROM dbo.users u WITH(UPDLOCK,HOLDLOCK)'));
 assert.deepEqual([auth.params.direct,auth.params.update,auth.params.manage],['product.edit','product.update','products.manage']);
 assert.match(auth.statement,/DATALENGTH\(p\.permission_key\)=DATALENGTH\(@direct\)/);
});

test('rich product creation rechecks product edit and supplier view in the same transaction lease',async()=>{
 const f=fakeDriver();let required;
 const store=createDesktopLocalMasterSqlStore({...f,richCards:true,verifySession:async({permission})=>{required=permission;return false;}});
 await store.withTransaction(async tx=>assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'product.edit'}),false));
 assert.deepEqual(required,['product.edit','supplier.view']);
 assert.equal(f.log.filter(x=>x.kind==='sql').length,1);
});
test('an entirely disabled direct edit permission cannot start a write',async()=>{
 const f=fakeDriver({noEnabledDirectPermission:true}),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await store.withTransaction(async tx=>assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'}),false));
 assert.ok(!f.log.some(x=>x.statement?.includes('INSERT dbo.customers')));
});
