import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopCreditAuthority} from './desktopCreditAuthority.mjs';

async function pendingCredit(f){
 await f.service.savePolicy('9',{requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,limitExact8:'10.00000000',reason:'credit limit'});
 assert.equal((await f.service.createRequest('8',{requestId:U2,invoiceId:'4',expectedVersion:'0x0000000000000001'})).state,'COMMITTED');
 return (await f.service.listRequests('8')).requests[0];
}
test('older current credit request survives fifty newer stale or decided requests in list and invoice lookup',async()=>{
 const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 for(const decide of [false,true]){
  const f=fixture(),pending=await pendingCredit(f);f.invoice.expectedVersion='0x0000000000000002';
  for(let i=0;i<51;i++){
   const body={requestId:uuid(i+100),invoiceId:'4',expectedVersion:f.invoice.expectedVersion};assert.equal((await f.service.createRequest('8',body)).state,'COMMITTED');
   if(decide){const row=(await f.service.listRequests('8')).requests[0];assert.equal((await f.service.approve('9',{requestId:uuid(i+1000),approvalRequestId:row.id,reason:'newer decision'})).state,'COMMITTED');}
  }
  f.invoice.expectedVersion='0x0000000000000001';assert.deepEqual((await f.service.listRequests('9')).requests.map(r=>r.id),[pending.id]);assert.equal((await f.service.readInvoice('9',{invoiceId:'4'})).expectedVersion,f.invoice.expectedVersion);assert.ok(f.queries.filter(q=>q.includes('CREDIT_RECORDS')).every(q=>q.includes('ORDER BY requestRow.id DESC')));assert.ok(f.queries.some(q=>q.includes('requestRow.id<TRY_CONVERT(bigint,@beforeId)')));
 }
});
test('manager reads only a current pending credit decision, never an unrelated CHECKED invoice or general account',async()=>{
 const f=fixture();await assert.rejects(f.service.readInvoice('9',{invoiceId:'4'}));assert.equal((await f.service.readInvoice('8',{invoiceId:'4'})).invoiceId,'4');
 const pending=await pendingCredit(f);f.setPermissions(['sales.view']);
 assert.equal((await f.service.readInvoice('9',{invoiceId:'4'})).invoiceId,'4');assert.equal((await f.service.listRequests('9')).requests[0].id,pending.id);
 await assert.rejects(f.service.readAccount('9',{customerId:'2',accountId:'3'}));await assert.rejects(f.service.readInvoice('7',{invoiceId:'4'}));
 const body={requestId:U3,approvalRequestId:pending.id,reason:'manager approval'},decision=await f.service.approve('9',body);assert.equal(decision.state,'COMMITTED');assert.equal((await f.service.approve('9',body)).replayed,true);
 await assert.rejects(f.service.readInvoice('9',{invoiceId:'4'}));assert.equal((await f.service.listRequests('9')).requests.length,0);assert.equal((await f.service.listRequests('8')).requests[0].status,'APPROVED');
 f.setManager(false);assert.equal((await f.service.resolve('9',{kind:'approve',body})).state,'COMMITTED');assert.equal((await f.service.listRequests('9')).requests.length,0);
 f.setManager(true);f.setNow(1600000);await assert.rejects(f.service.readInvoice('9',{invoiceId:'4'}));assert.equal((await f.service.listRequests('9')).requests.length,0);assert.equal((await f.service.listRequests('8')).requests[0].status,'EXPIRED');
});
test('changed credit balance, workflow version, creator or policy hides and rejects the foreign pending decision',async()=>{
 for(const mutate of [f=>{f.account.balanceExact8='9.10000000';},f=>{f.invoice.expectedVersion='0x0000000000000002';},f=>{f.invoice.creatorId='7';},f=>{f.setManager(false);}]){
  const f=fixture(),pending=await pendingCredit(f);mutate(f);assert.equal((await f.service.listRequests('9')).requests.length,0);await assert.rejects(f.service.readInvoice('9',{invoiceId:'4'}));assert.equal((await f.service.approve('9',{requestId:U3,approvalRequestId:pending.id,reason:'stale approval'})).state,'UNKNOWN');assert.equal(f.records().filter(r=>r.action==='credit.approval.granted').length,0);
 }
 const f=fixture(),pending=await pendingCredit(f),definition=(await f.service.readAccount('9',{customerId:'2',accountId:'3'})).definition;
 await f.service.savePolicy('9',{requestId:U4,customerId:'2',accountId:'3',expectedRevision:definition.revision,limitExact8:'10.50000000',reason:'limit changed'});assert.equal((await f.service.listRequests('9')).requests.length,0);await assert.rejects(f.service.readInvoice('9',{invoiceId:'4'}));assert.equal((await f.service.approve('9',{requestId:U3,approvalRequestId:pending.id,reason:'stale policy'})).state,'UNKNOWN');
});
const U1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U3='cccccccc-cccc-4ccc-8ccc-cccccccccccc',U4='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function fixture(){
 let records=[],next=1,now=1000000,manager=true,manage=true,queue=Promise.resolve(),permissions=null;const queries=[];
 const account={customerId:'2',accountId:'3',entityId:'5',currency:'TRY',balanceExact8:'9.00000000'};
 const invoice={invoiceId:'4',customerId:'2',creatorId:'8',storedAccountId:'3',storedEntityId:'5',documentCurrency:'TRY',currency:'TRY',amountExact4:'2.0000',totalExact4:'2.0000',expectedVersion:'0x0000000000000001'};
 class Transaction{async begin(){const previous=queue;queue=new Promise(resolve=>{this.unlock=resolve;});await previous;this.data=structuredClone(records);}async commit(){records=this.data;this.unlock();}async rollback(){this.unlock();}}
 class Request{constructor(tx){this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(text){queries.push(text);const p=this.p,t=this.tx;
  if(text.includes('DUE_INVOICE_LOCK'))return {recordset:p.invoice===invoice.invoiceId?[{invoiceId:invoice.invoiceId,customerId:invoice.customerId,documentDate:'2026-11-08'}]:[]};
  if(text.includes('DUE_INVOICE_EXISTING'))return {recordset:t.data.filter(r=>r.source==='due'&&(r.entityId===p.invoice||r.reason===p.request)).slice(0,2)};
  if(text.includes('DUE_INVOICE_INSERT')){const row={id:String(next++),actorId:p.actor,entityId:p.invoice,reason:p.request,action:'invoice.due.snapshot',json:p.json,source:'due'};t.data.push(row);return {recordset:[{id:row.id}]};}
  if(text.includes('DUE_INVOICE_READBACK'))return {recordset:t.data.filter(r=>r.source==='due'&&r.id===p.id).map(r=>({actorId:r.actorId,invoiceId:r.entityId,reason:r.reason,json:r.json}))};
  if(text.includes('CREDIT_ACCOUNT_LOCK'))return {recordset:p.account===account.accountId&&p.customer===account.customerId?[account]:[]};
  if(text.includes('CREDIT_INVOICE_IDENTITY'))return {recordset:p.invoice===invoice.invoiceId?[{customerId:invoice.customerId,accountId:invoice.storedAccountId}]:[]};
  if(text.includes('CREDIT_LEGACY_TRY_ACCOUNT'))return {recordset:[{accountId:account.accountId}]};
  if(text.includes('CREDIT_INVOICE_LOCK'))return {recordset:p.invoice===invoice.invoiceId?[invoice]:[]};
  if(text.includes('CREDIT_CLOCK'))return {recordset:[{nowMs:String(now)}]};
  if(text.includes('CREDIT_RECORD_INSERT')){const row={id:String(next++),actorId:p.actor,entityId:p.entity,reason:p.request,action:p.action,json:p.json};t.data.push(row);return {recordset:[{id:row.id}]};}
  if(text.includes('CREDIT_COMMAND_LOCK'))return {recordset:t.data.filter(r=>r.source!=='due'&&r.actorId===p.actor&&r.reason===p.request).slice(0,2)};
  if(text.includes('CREDIT_LATEST_APPROVED_REQUEST')){const approvals=t.data.filter(r=>r.action==='credit.approval.granted').reverse();const row=approvals.map(a=>t.data.find(r=>r.id===a.entityId&&r.action==='credit.approval.request'&&r.entityId===p.account&&r.actorId===p.actor&&JSON.parse(r.json).snapshot.invoiceId===p.invoice&&JSON.parse(r.json).snapshotHash===p.hash)).find(Boolean);return {recordset:row?[row]:[]};}
  if(text.includes('CREDIT_RECORDS')){let rows=t.data.filter(r=>r.action===p.action);if(p.id)rows=rows.filter(r=>text.includes('entity_id=')?r.entityId===p.id:r.id===p.id);if(p.account)rows=rows.filter(r=>r.entityId===p.account);if(text.includes('actor_user_id=')&&p.actor)rows=rows.filter(r=>r.actorId===p.actor);if(p.invoice)rows=rows.filter(r=>JSON.parse(r.json).snapshot?.invoiceId===p.invoice);if(p.hash)rows=rows.filter(r=>JSON.parse(r.json).snapshotHash===p.hash);if(text.includes('NOT EXISTS'))rows=rows.filter(r=>!t.data.some(a=>a.action==='credit.approval.granted'&&a.entityId===r.id));if(p.beforeId)rows=rows.filter(r=>BigInt(r.id)<BigInt(p.beforeId));const limit=Number(text.match(/TOP\((\d+)\)/)[1]);return {recordset:rows.reverse().slice(0,limit)};}
  throw Error('unexpected fixture query');}}
 const NVarChar=()=>null;NVarChar.MAX=0;
 const authority=createDesktopCreditAuthority({sql:{Request,Transaction,NVarChar,MAX:0,ISOLATION_LEVEL:{SERIALIZABLE:1}},ensureLease:()=>true,readAuthority:async({targetActorId,actorId})=>({revision:'a'.repeat(64),canManage:manage,canApprove:(targetActorId??actorId)==='9'&&manager})});
 const service=authority.service({pool:{},verifySession:async({permission})=>permissions===null||(Array.isArray(permission)?permission:[permission]).every(p=>permissions.includes(p)),release:()=>{}});
 return {authority,service,queries,records:()=>records,setManager:v=>{manager=v;},setManage:v=>{manage=v;},setNow:v=>{now=v;},setPermissions:v=>{permissions=v;},account,invoice,Transaction};
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
 f.setManager(true);const accepted=new f.Transaction();await accepted.begin();assert.equal(await f.authority.assertDispatch({...args,transaction:accepted}),true);await accepted.commit();assert.equal((await f.service.listRequests('9')).requests.length,0);assert.equal((await f.service.listRequests('8')).requests[0].status,'CONSUMED');
 const replay=new f.Transaction();await replay.begin();await assert.rejects(f.authority.assertDispatch({...args,transaction:replay}));await replay.rollback();
});

test('explicit terms are revision bound and manager controlled; missing differs from zero days',async()=>{const f=fixture(),args={requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,termDays:0,reason:'term decision'};assert.equal((await f.service.readAccount('8',{customerId:'2',accountId:'3'})).termsDefinition,null);f.setManage(false);assert.equal((await f.service.saveTerms('8',args)).state,'UNKNOWN');assert.equal(f.records().length,0);f.setManage(true);const first=await f.service.saveTerms('9',args);assert.equal(first.state,'COMMITTED');assert.equal(first.result.termsDefinition.termDays,0);assert.equal(first.result.vadeStatus,'defined');assert.equal((await f.service.saveTerms('9',args)).replayed,true);assert.equal((await f.service.saveTerms('9',{...args,termDays:30})).state,'UNKNOWN');const current=await f.service.readAccount('8',{customerId:'2',accountId:'3'});assert.deepEqual(current.termsDefinition,first.result.termsDefinition);assert.equal((await f.service.saveTerms('9',{...args,requestId:U2,termDays:30})).state,'UNKNOWN');const next=await f.service.saveTerms('9',{...args,requestId:U2,expectedRevision:first.result.termsDefinition.revision,termDays:30});assert.equal(next.result.termsDefinition.termDays,30);assert.equal((await f.service.resolve('9',{kind:'saveTerms',body:{...args,requestId:U3}})).state,'NOT_COMMITTED');assert.equal((await f.service.saveTerms('9',{...args,requestId:U3})).state,'UNKNOWN');await assert.rejects(f.service.saveTerms('9',{...args,termDays:-1}));});

test('finalization snapshot captures explicit terms once and rollback leaves no due record',async()=>{const f=fixture();const term=await f.service.saveTerms('9',{requestId:U1,customerId:'2',accountId:'3',expectedRevision:null,termDays:30,reason:'terms'});const args={actorId:'8',requestId:U2,invoiceId:'4',expectedVersion:'0x0000000000000001',accountId:'3',currency:'TRY',balanceExact8:'9.00000000',amountExact4:'2.0000'};let tx=new f.Transaction();await tx.begin();assert.equal(await f.authority.assertDispatch({...args,transaction:tx}),true);await tx.rollback();assert.equal(f.records().filter(r=>r.action==='invoice.due.snapshot').length,0);tx=new f.Transaction();await tx.begin();assert.equal(await f.authority.assertDispatch({...args,transaction:tx}),true);await tx.commit();const due=JSON.parse(f.records().find(r=>r.action==='invoice.due.snapshot').json);assert.equal(due.documentDate,'2026-11-08');assert.equal(due.dueDate,'2026-12-08');assert.equal(due.termsRevision,term.result.termsDefinition.revision);const before=JSON.stringify(due);await f.service.saveTerms('9',{requestId:U3,customerId:'2',accountId:'3',expectedRevision:due.termsRevision,termDays:60,reason:'changed'});assert.equal(f.records().find(r=>r.action==='invoice.due.snapshot').json,before);});
