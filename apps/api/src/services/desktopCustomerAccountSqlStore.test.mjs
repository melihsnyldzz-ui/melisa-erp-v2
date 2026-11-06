import test from 'node:test';import assert from 'node:assert/strict';import {createDesktopCustomerAccountSqlStore} from './desktopCustomerAccountSqlStore.mjs';import {customerAccountRecord} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
const c={requestId:'21f5d2d1-b067-48fd-9850-b33fa13a02ff',customerId:'3',entityId:'4',customerCode:'C1',customerName:'Müşteri',currency:'USD'},account={id:'5',customerId:'3',entityId:'4',currency:'USD',balanceExact8:'0.00000000'};
function fixture({duplicate=false,replay=null,badAccount=false,lost=false,mainBalance='176.00000000',allowed=true}={}){
 const log=[];let json,audit;
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');this.open=true;log.push('begin');}async commit(){assert(this.open);log.push('commit');if(lost)throw Error('ack lost');this.open=false;}async rollback(){log.push('rollback');this.open=false;}}
 class Request{constructor(tx){assert(tx.open);this.v={};}input(k,_type,v){this.v[k]=v;return this;}async query(q){log.push(q);const v=this.v;
  if(q.includes('LOCAL_MASTER_REQUEST_LOCKED'))return {recordset:replay?[{response_json:JSON.stringify(replay)}]:[]};
  if(q.includes('FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK)'))return {recordset:[{customerId:'3',entityId:'4',customerCode:'C1',customerName:'Müşteri',currency:'TRY',balanceExact4:'176.0000'}]};
  if(q.includes('balance_status balanceStatus FROM'))return {recordset:[{entityId:'4',supplierId:null,balanceExact8:mainBalance,balanceStatus:'local'}]};
  if(q.includes('INDEX(UX_desktop_v4_customer_currency)'))return {recordset:duplicate?[{id:'5',entityId:'4'}]:[]};
  if(q.startsWith('INSERT dbo.party_currency_accounts')){assert.equal(v.currency,'USD');assert.match(q,/CONVERT\(decimal\(28,8\),0\)/);return {recordset:[{id:'5'}]};}
  if(q.includes('source_record_key sourceRecordKey'))return {recordset:[{...account,...(badAccount?{currency:'EUR'}:{}),supplierId:null,balanceStatus:'local',sourceRecordKey:null}]};
  if(q.startsWith('INSERT dbo.audit_logs')){audit=v;return {recordset:[]};}
  if(q.includes('FROM dbo.audit_logs WITH(HOLDLOCK)'))return {recordset:[{actorId:audit.actor,accountId:audit.account,afterJson:audit.json}]};
  if(q.includes('LOCAL_MASTER_REQUEST_LOCK_REQUIRED')){json=v.responseJson;return {recordset:[{response_json:json}]};}
  if(q.includes('FROM dbo.desktop_local_master_requests WITH(HOLDLOCK)'))return {recordset:[{operation:'customer.account.create',actorId:'30002',payloadHash:'a'.repeat(64),responseJson:json}]};
  throw Error('unhandled fixture statement');
 }}
 const sql={Transaction,Request,NVarChar:()=>null,VarBinary:()=>null,MAX:-1,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'}},store=createDesktopCustomerAccountSqlStore({pool:{},sql,verifySession:async v=>{log.push('authority');assert.deepEqual(v.permission,['customer.edit','customer.view']);return allowed;}});
 return {log,run:()=>store.create({actorId:'30002',command:c,payloadHash:'a'.repeat(64)})};
}
test('same serializable transaction owns auth, request lock, customer lock, uniqueness, zero-account readback, audit and durable result',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.state,'COMMITTED');assert.equal(r.account.id,'5');assert.equal(f.log.at(-1),'commit');const text=f.log.join('\n');assert(!/UPDATE dbo.customers|UPDATE dbo.party_currency_accounts/.test(text));assert.equal(f.log.filter(q=>q.startsWith('INSERT dbo.party_currency_accounts')).length,1);
});
test('existing request replays before current customer reads; duplicate new UUID durably records no account/audit; wrong readback and lost commit roll back',async()=>{
 const f=fixture({replay:customerAccountRecord(c,account)});assert.equal((await f.run()).replayed,true);assert(!f.log.some(q=>q.includes('FROM dbo.customers')));
 const d=fixture({duplicate:true});assert.equal((await d.run()).state,'NOT_COMMITTED');assert(!d.log.some(q=>q.startsWith('INSERT dbo.party_currency_accounts')||q.startsWith('INSERT dbo.audit_logs')));
 for(const options of [{badAccount:true},{mainBalance:'175.00000000'},{allowed:false},{lost:true}]){const bad=fixture(options);await assert.rejects(bad.run());assert.equal(bad.log.at(-1),'rollback');}
});
