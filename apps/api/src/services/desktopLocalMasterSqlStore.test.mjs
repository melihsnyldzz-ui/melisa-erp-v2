import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopLocalMasterSqlStore} from './desktopLocalMasterSqlStore.mjs';

function fakeDriver({rejectTarget=false,rejectMutation=false,commitLost=false,noEnabledDirectPermission=false,extraPermission=false}={}){
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
   if(statement.includes('INSERT dbo.products'))return {recordset:[{id:'81'}]};
   if(statement.includes('LOCAL_MASTER_REQUEST_LOCKED'))return {recordset:[]};
   if(statement.includes('LOCAL_MASTER_REQUEST_LOCK_REQUIRED')){this.tx.journal={requestId:this.params.requestIdText,operation:this.params.operation,actorId:this.params.actorIdText,payloadHash:this.params.payloadHash.toString('hex'),response_json:this.params.responseJson};return {recordset:[{response_json:this.params.responseJson}]};}
   if(statement.includes('FROM dbo.desktop_local_master_requests WHERE request_id=')){assert.match(statement,/LOWER\(CONVERT\(varchar\(36\),request_id\)\)/);return {recordset:[this.tx.journal]};}
   throw Error('unexpected SQL');
  }
 }
 const type=()=>({});const sql={Transaction,Request,NVarChar:type,VarBinary:type,Int:{},MAX:-1,ISOLATION_LEVEL:{SERIALIZABLE:4}};
 return {sql,pool:{},log};
}

test('wrong physical target aborts before callback, rolls back and does not mutate',async()=>{
 const f=fakeDriver({rejectTarget:true});let called=false;
 const store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await assert.rejects(store.withTransaction(async()=>{called=true;}));
 assert.equal(called,false);assert.deepEqual(f.log.map(x=>x.kind),['begin','sql','rollback']);
 assert.match(f.log[1].statement,/schema_version=2 AND actual_t1=0 AND external_operations=0 AND read_only=0/);assert.match(f.log[1].statement,/database_guid/);assert.match(f.log[1].statement,/DATALENGTH\(USER_NAME\(\)\)/);
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
test('an entirely disabled direct edit permission cannot start a write',async()=>{
 const f=fakeDriver({noEnabledDirectPermission:true}),store=createDesktopLocalMasterSqlStore({...f,verifySession:async()=>true});
 await store.withTransaction(async tx=>assert.equal(await tx.lockAndVerifyAuthority({actorId:'7',permission:'customer.edit'}),false));
 assert.ok(!f.log.some(x=>x.statement?.includes('INSERT dbo.customers')));
});
