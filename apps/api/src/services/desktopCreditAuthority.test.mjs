import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopCreditAuthority} from './desktopCreditAuthority.mjs';
const U1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U3='cccccccc-cccc-4ccc-8ccc-cccccccccccc',U4='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function fixture(){
 let records=[],next=1,now=1000000,manager=true,queue=Promise.resolve();
 const account={customerId:'2',accountId:'3',entityId:'5',currency:'TRY',balanceExact8:'9.00000000'};
 const invoice={invoiceId:'4',customerId:'2',creatorId:'8',storedAccountId:'3',storedEntityId:'5',documentCurrency:'TRY',currency:'TRY',amountExact4:'2.0000',totalExact4:'2.0000',expectedVersion:'0x0000000000000001'};
 class Transaction{async begin(){const previous=queue;queue=new Promise(resolve=>{this.unlock=resolve;});await previous;this.data=structuredClone(records);}async commit(){records=this.data;this.unlock();}async rollback(){this.unlock();}}
 class Request{constructor(tx){this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(text){const p=this.p,t=this.tx;
  if(text.includes('CREDIT_ACCOUNT_LOCK'))return {recordset:p.account===account.accountId&&p.customer===account.customerId?[account]:[]};
  if(text.includes('CREDIT_INVOICE_IDENTITY'))return {recordset:p.invoice===invoice.invoiceId?[{customerId:invoice.customerId,accountId:invoice.storedAccountId}]:[]};
  if(text.includes('CREDIT_LEGACY_TRY_ACCOUNT'))return {recordset:[{accountId:account.accountId}]};
  if(text.includes('CREDIT_INVOICE_LOCK'))return {recordset:p.invoice===invoice.invoiceId?[invoice]:[]};
  if(text.includes('CREDIT_CLOCK'))return {recordset:[{nowMs:String(now)}]};
  if(text.includes('CREDIT_RECORD_INSERT')){const row={id:String(next++),actorId:p.actor,entityId:p.entity,reason:p.request,action:p.action,json:p.json};t.data.push(row);return {recordset:[{id:row.id}]};}
  if(text.includes('CREDIT_COMMAND_LOCK'))return {recordset:t.data.filter(r=>r.actorId===p.actor&&r.reason===p.request).slice(0,2)};
  if(text.includes('CREDIT_LATEST_APPROVED_REQUEST')){const approvals=t.data.filter(r=>r.action==='credit.approval.granted').reverse();const row=approvals.map(a=>t.data.find(r=>r.id===a.entityId&&r.action==='credit.approval.request'&&r.entityId===p.account&&r.actorId===p.actor&&JSON.parse(r.json).snapshot.invoiceId===p.invoice&&JSON.parse(r.json).snapshotHash===p.hash)).find(Boolean);return {recordset:row?[row]:[]};}
  if(text.includes('CREDIT_RECORDS')){let rows=t.data.filter(r=>r.action===p.action);if(p.id)rows=rows.filter(r=>text.includes('entity_id=')?r.entityId===p.id:r.id===p.id);if(p.account)rows=rows.filter(r=>r.entityId===p.account);if(text.includes('actor_user_id=')&&p.actor)rows=rows.filter(r=>r.actorId===p.actor);if(p.invoice)rows=rows.filter(r=>JSON.parse(r.json).snapshot?.invoiceId===p.invoice);const limit=Number(text.match(/TOP\((\d+)\)/)[1]);return {recordset:rows.reverse().slice(0,limit)};}
  throw Error('unexpected fixture query');}}
 const NVarChar=()=>null;NVarChar.MAX=0;
 const authority=createDesktopCreditAuthority({sql:{Request,Transaction,NVarChar,MAX:0,ISOLATION_LEVEL:{SERIALIZABLE:1}},ensureLease:()=>true,readAuthority:async({targetActorId,actorId})=>({revision:'a'.repeat(64),canManage:true,canApprove:(targetActorId??actorId)==='9'&&manager})});
 const service=authority.service({pool:{},verifySession:async()=>true,release:()=>{}});
 return {authority,service,records:()=>records,setManager:v=>{manager=v;},setNow:v=>{now=v;},account,invoice,Transaction};
}
test('policy is positive opt-in, command replay is bound, and resolution fences a missing UUID',async()=>{
 const f=fixture(),body={requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,limitExact8:'10.00000000',reason:'test policy'};
 assert.equal((await f.service.readAccount('9',{customerId:'2',accountId:'3'})).definition,null);
 await assert.rejects(f.service.savePolicy('9',{...body,limitExact8:'0.00000000'}));
 const first=await f.service.savePolicy('9',body);assert.equal(first.state,'COMMITTED');assert.equal((await f.service.savePolicy('9',body)).replayed,true);
 assert.equal((await f.service.savePolicy('9',{...body,limitExact8:'11.00000000'})).state,'UNKNOWN');assert.equal(f.records().length,1);
 const pending={requestId:U2,invoiceId:'4',expectedVersion:'0x0000000000000001'};assert.equal((await f.service.resolve('8',{kind:'createRequest',body:pending})).state,'NOT_COMMITTED');assert.equal((await f.service.createRequest('8',pending)).state,'UNKNOWN');
});
test('serialized owner model admits at most one simultaneous consumption',async()=>{
 const f=fixture();await f.service.savePolicy('9',{requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,limitExact8:'10.00000000',reason:'test policy'});await f.service.createRequest('8',{requestId:U2,invoiceId:'4',expectedVersion:'0x0000000000000001'});const request=(await f.service.listRequests('9')).requests[0];await f.service.approve('9',{requestId:U3,approvalRequestId:request.id,reason:'approved test'});
 async function attempt(){const tx=new f.Transaction();await tx.begin();try{await f.authority.assertDispatch({transaction:tx,actorId:'8',requestId:U4,invoiceId:'4',expectedVersion:'0x0000000000000001',accountId:'3',currency:'TRY',balanceExact8:'9.00000000',amountExact4:'2.0000'});await tx.commit();return true;}catch{await tx.rollback();return false;}}
 assert.deepEqual((await Promise.all([attempt(),attempt()])).sort(),[false,true]);assert.equal(f.records().filter(r=>r.action==='credit.approval.consume').length,1);
});
test('legacy unlinked TRY draft without a policy remains eligible; expiry and balance changes invalidate approval',async()=>{
 const f=fixture();f.invoice.storedAccountId=null;f.invoice.storedEntityId=null;f.invoice.creatorId=null;
 let tx=new f.Transaction();await tx.begin();const args={transaction:tx,actorId:'8',requestId:U4,invoiceId:'4',expectedVersion:'0x0000000000000001',accountId:'3',currency:'TRY',balanceExact8:'9.00000000',amountExact4:'2.0000'};
 assert.equal(await f.authority.assertDispatch(args),true);await tx.rollback();
 f.invoice.creatorId='8';await f.service.savePolicy('9',{requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,limitExact8:'10.00000000',reason:'test policy'});
 await f.service.createRequest('8',{requestId:U2,invoiceId:'4',expectedVersion:args.expectedVersion});const request=(await f.service.listRequests('9')).requests[0];await f.service.approve('9',{requestId:U3,approvalRequestId:request.id,reason:'approved test'});
 f.account.balanceExact8='9.10000000';tx=new f.Transaction();await tx.begin();await assert.rejects(f.authority.assertDispatch({...args,transaction:tx,balanceExact8:f.account.balanceExact8}));await tx.rollback();
 f.account.balanceExact8='9.00000000';f.setNow(1600000);tx=new f.Transaction();await tx.begin();await assert.rejects(f.authority.assertDispatch({...args,transaction:tx}));await tx.rollback();
});
test('approval is bound to current snapshot and revoked authority blocks consumption',async()=>{
 const f=fixture();await f.service.savePolicy('9',{requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,limitExact8:'10.00000000',reason:'test policy'});
 assert.equal((await f.service.createRequest('8',{requestId:U2,invoiceId:'4',expectedVersion:'0x0000000000000001'})).state,'COMMITTED');
 const request=(await f.service.listRequests('9')).requests[0];assert.equal(request.status,'PENDING');
 assert.equal((await f.service.approve('9',{requestId:U3,approvalRequestId:request.id,reason:'approved test'})).state,'COMMITTED');
 const args={actorId:'8',requestId:U4,invoiceId:'4',expectedVersion:'0x0000000000000001',accountId:'3',currency:'TRY',balanceExact8:'9.00000000',amountExact4:'2.0000'};
 f.setManager(false);const denied=new f.Transaction();await denied.begin();await assert.rejects(f.authority.assertDispatch({...args,transaction:denied}));await denied.rollback();
 f.setManager(true);const accepted=new f.Transaction();await accepted.begin();assert.equal(await f.authority.assertDispatch({...args,transaction:accepted}),true);await accepted.commit();assert.equal((await f.service.listRequests('9')).requests[0].status,'CONSUMED');
 const replay=new f.Transaction();await replay.begin();await assert.rejects(f.authority.assertDispatch({...args,transaction:replay}));await replay.rollback();
});
