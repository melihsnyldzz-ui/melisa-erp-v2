// Real normal-session verification; only the SQL driver and credit store are
// replaced. This proves the private authority binding, not SQL execution.
import {createDesktopCreditAuthority as realCreditAuthority} from './desktopCreditAuthority.mjs';
import {createDesktopCreditRoutes} from '../routes/desktopCreditRoutes.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import express from 'express';import bcrypt from 'bcrypt';
test('credit authority is pool-bound, current and transaction-leased; TEST operator never inherits manager rights',async t=>{
 const pool={},u={id:'8',username:'normal',displayName:'Normal',passwordHash:await bcrypt.hash('synthetic-test-password',4),roleId:'30',roleCode:'desktop_first_sale_operator',roleName:'Operator',userActive:true,roleActive:true,userVersion:'0x0000000000000001',roleVersion:'0x0000000000000002'};
 let setting=null,permissions=['customer.view','customer.edit','sales.view'],binding=null,lastTx=null;
 class Transaction{async begin(){this.open=true;}async commit(){this.open=false;}async rollback(){this.open=false;}}
 class Request{constructor(tx){assert.equal(tx.open,true);this.tx=tx;this.params={};}input(k,_type,v){this.params[k]=v;return this;}async query(q){if(q.includes('DESKTOP_AUTH_TARGET_REJECTED'))return {recordset:[{ok:1}]};if(q.includes('FROM dbo.users u'))return {recordset:[{...u}]};if(q.includes('FROM dbo.permissions'))return {recordset:permissions.map(permission_key=>({permission_key,can_view:true,can_create:false,can_update:false,can_delete:false,can_approve:false}))};if(q.includes('DESKTOP_CREDIT_ACCESS_READ'))return {recordset:setting?[setting]:[]};throw Error('UNEXPECTED_SQL');}}
 const sql={Transaction,Request,NVarChar:()=>null,ISOLATION_LEVEL:{SERIALIZABLE:4}};
 t.mock.module('mssql',{exports:{default:sql}});
 t.mock.module('./desktopCreditAuthority.mjs',{exports:{createDesktopCreditAuthority:options=>{
  binding=options;return {assertDispatch:()=>null,service:({pool:actual,verifySession,release})=>({async probe(actorId){assert.equal(actual,pool);const tx=new Transaction();lastTx=tx;try{await tx.begin();if(!await verifySession({transaction:tx,actorId,permission:'customer.view'}))throw Error('DENIED');assert.throws(()=>options.ensureLease({},actorId));await assert.rejects(options.readAuthority({transaction:tx,actorId:'9'}));const result=await options.readAuthority({transaction:tx,actorId});await tx.commit();return result;}finally{if(tx.open)await tx.rollback();release();}}})};
 }}});
 const {createDesktopWriteAuthCore,getDesktopWriteCreditService,getDesktopWriteCreditAuthority}=await import('./desktopWriteAuthCore.mjs');
 const auth=createDesktopWriteAuthCore({pool,sql,richCards:true,schemaVersion:7});assert.throws(()=>getDesktopWriteCreditService(auth,{}));assert.throws(()=>getDesktopWriteCreditAuthority({},pool));
 const service=getDesktopWriteCreditService(auth,pool);await assert.rejects(binding.readAuthority({transaction:{},actorId:'8'}));
 const signed=await auth.login({username:'normal',password:'synthetic-test-password'});
 const app=express();app.use(auth.bind);app.get('/credit',async(req,res)=>{try{const actor=await auth.authenticateNormal(req);const result=await service.probe(actor.userId);assert.throws(()=>binding.ensureLease(lastTx,actor.userId));res.json(result);}catch{res.status(403).json({denied:true});}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const get=()=>new Promise((resolve,reject)=>{const q=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/credit',headers:{authorization:'Bearer '+signed.accessToken}},r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(b)}));});q.on('error',reject);q.end();});
 let result=await get();assert.equal(result.status,200);assert.deepEqual([result.body.canManage,result.body.canApprove],[false,false]);
 const configure=kind=>{setting={id:'5',value:JSON.stringify({version:1,people:[{actorId:u.id,roleId:u.roleId,roleCode:u.roleCode,kind,canChangeSalePrice:false,maxDiscountRateExact4:null}]}),valueType:'json',active:true,version:'0x0000000000000005'};};
 configure('manager');result=await get();assert.equal(result.status,200);assert.deepEqual([result.body.canManage,result.body.canApprove],[true,true]);const revision=result.body.revision;
 permissions=['customer.view','sales.view'];result=await get();assert.equal(result.body.canManage,false);assert.equal(result.body.canApprove,true);
 setting.version='0x0000000000000006';result=await get();assert.notEqual(result.body.revision,revision);
 setting.active=false;assert.equal((await get()).status,403);
 configure('sales');result=await get();assert.deepEqual([result.body.canManage,result.body.canApprove],[false,false]);
 configure('boss');u.roleVersion='0x0000000000000009';result=await get();assert.equal(result.status,401);assert.deepEqual(result.body,{success:false,code:'DESKTOP_NORMAL_SESSION_REQUIRED'});assert.equal(auth.close(),true);
});

// Actual normal auth and actual credit implementation; all rows and transactions
// below are synthetic memory. No captured session, credential or database use.
test('normal owner and isolated decision-only manager use scoped due endpoints with real service and current policy',async t=>{
 const pool={},password='synthetic-due-auth-password',passwordHash=await bcrypt.hash(password,4),base={displayName:'Fixture',passwordHash,roleName:'Fixture role',userActive:true,roleActive:true,userVersion:'0x0000000000000001',roleVersion:'0x0000000000000002'};
 const users=[{...base,id:'8',username:'due-owner',roleId:'30',roleCode:'fixture_due_sales'},{...base,id:'9',username:'due-manager',roleId:'31',roleCode:'fixture_due_decision'},{...base,id:'10',username:'due-boss',roleId:'32',roleCode:'fixture_due_boss'}];
 let records=[],next=1,workflow='CHECKED';const queries=[];
 const people=users.slice(1).map(u=>({actorId:u.id,roleId:u.roleId,roleCode:u.roleCode,kind:u.id==='9'?'manager':'boss',canChangeSalePrice:false,maxDiscountRateExact4:null})),setting={id:'5',value:JSON.stringify({version:1,people}),valueType:'json',active:true,version:'0x0000000000000005'};
 const account={customerId:'2',accountId:'3',entityId:'5',currency:'TRY',balanceExact8:'9.00000000'},invoice={invoiceId:'4',customerId:'2',creatorId:'8',storedAccountId:'3',storedEntityId:'5',documentCurrency:'TRY',currency:'TRY',amountExact4:'2.0000',totalExact4:'2.0000',expectedVersion:'0x0000000000000001'};
 class Transaction{async begin(){this.open=true;this.data=structuredClone(records);}async commit(){records=this.data;this.open=false;}async rollback(){this.open=false;}}
 class Request{constructor(tx){assert(tx.open);this.tx=tx;this.p={};}input(k,_t,v){this.p[k]=v;return this;}async query(q){queries.push(q);const p=this.p,t=this.tx,rows=recordset=>({recordset});
  if(q.includes('DESKTOP_AUTH_TARGET_REJECTED'))return rows([{ok:1}]);
  if(q.includes('FROM dbo.users u'))return rows(users.filter(u=>p.userId===u.id||p.username===u.username));
  if(q.includes('FROM dbo.permissions'))return rows([{permission_key:'sales.view',can_view:true,can_create:false,can_update:false,can_delete:false,can_approve:false}]);
  if(q.includes('DESKTOP_CREDIT_ACCESS_READ'))return rows([setting]);
  if(q.includes('CREDIT_ACCOUNT_LOCK'))return rows(p.account==='3'&&p.customer==='2'?[account]:[]);
  if(q.includes('CREDIT_INVOICE_IDENTITY'))return rows(p.invoice==='4'?[{customerId:'2',accountId:'3'}]:[]);
  if(q.includes('CREDIT_INVOICE_LOCK'))return rows(p.invoice==='4'&&workflow==='CHECKED'?[invoice]:[]);
  if(q.includes('DUE_INVOICE_LOCK'))return rows([{invoiceId:'4',customerId:'2',documentDate:'2026-11-08'}]);
  if(q.includes('CREDIT_CLOCK'))return rows([{nowMs:'1000000'}]);
  if(q.includes('CREDIT_COMMAND_LOCK'))return rows(t.data.filter(r=>r.actorId===p.actor&&r.reason===p.request).slice(0,2));
  if(q.includes('CREDIT_RECORD_INSERT')){const r={id:String(next++),actorId:p.actor,entityId:p.entity,reason:p.request,action:p.action,json:p.json};t.data.push(r);return rows([{id:r.id}]);}
  if(q.includes('CREDIT_RECORDS')){let result=t.data.filter(r=>r.action===p.action);if(p.id)result=result.filter(r=>q.includes('entity_id=')?r.entityId===p.id:r.id===p.id);if(p.account)result=result.filter(r=>r.entityId===p.account);if(q.includes('actor_user_id=')&&p.actor)result=result.filter(r=>r.actorId===p.actor);if(p.invoice)result=result.filter(r=>JSON.parse(r.json).snapshot?.invoiceId===p.invoice);if(p.beforeId)result=result.filter(r=>BigInt(r.id)<BigInt(p.beforeId));return rows(result.reverse().slice(0,Number(q.match(/TOP\((\d+)\)/)[1])));}
  if(q.includes('DUE_EXCEPTION_CONSUMED'))return rows([]);
  throw Error('unexpected synthetic SQL');
 }}
 const sql={Transaction,Request,NVarChar:()=>null,MAX:0,ISOLATION_LEVEL:{SERIALIZABLE:4}};t.mock.module('mssql',{exports:{default:sql}});t.mock.module('./desktopCreditAuthority.mjs',{exports:{createDesktopCreditAuthority:realCreditAuthority}});
 const {createDesktopWriteAuthCore,getDesktopWriteCreditService}=await import('./desktopWriteAuthCore.mjs?due-real-auth'),auth=createDesktopWriteAuthCore({pool,sql,richCards:true,schemaVersion:7}),service=getDesktopWriteCreditService(auth,pool),tokens={};t.after(()=>auth.close());
 for(const u of users)tokens[u.id]=(await auth.login({username:u.username,password})).accessToken;
 const app=express();app.use(express.json());app.use(auth.bind);app.use(createDesktopCreditRoutes({service,authenticateNormal:auth.authenticateNormal}));const server=await new Promise(resolve=>{const x=app.listen(0,'127.0.0.1',()=>resolve(x));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const call=(actor,path,method='GET',body)=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/desktop-credit'+path,method,headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294','content-type':'application/json',authorization:'Bearer '+tokens[actor]}},r=>{let s='';r.on('data',b=>s+=b);r.on('end',()=>resolve({status:r.statusCode,...JSON.parse(s)}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
 const uuid=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,body=n=>({requestId:uuid(n),invoiceId:'4',expectedVersion:invoice.expectedVersion,expectedTermsRevision:null,requestedTermDays:30,reason:'invoice only due'});
 assert.equal((await call('9','/invoices/4/due-exception')).status,403);assert.equal((await call('8','/invoices/4/due-exception')).status,200);workflow='READY';assert.equal((await call('8','/due-requests','POST',body(1))).data.state,'UNKNOWN');assert.equal(records.length,0);workflow='CHECKED';assert.equal((await call('8','/due-requests','POST',body(1))).data.state,'COMMITTED');
 const list=await call('9','/due-requests');assert.equal(list.status,200);assert.equal(list.data.requests.length,1);assert.equal((await call('9','/invoices/4/due-exception')).data.accountId,'3');assert.equal((await call('9','/invoices/4')).status,403);assert.equal((await call('9','/customers/2/accounts/3')).status,403);assert.equal((await call('9','/customers/2/accounts/3/terms','POST',{})).status,403);
 const id=list.data.requests[0].id;assert.equal((await call('9','/due-requests/'+id+'/approve','POST',{requestId:uuid(2),reason:'normal manager decision'})).data.state,'COMMITTED');assert.equal((await call('9','/invoices/4/due-exception')).status,403);assert.equal((await call('9','/due-requests')).data.requests.length,0);assert.equal((await call('8','/due-requests')).data.requests[0].status,'APPROVED');
 invoice.creatorId='9';assert.equal((await call('9','/due-requests','POST',body(3))).data.state,'COMMITTED');const own=(await call('9','/due-requests')).data.requests[0];assert.equal((await call('9','/due-requests/'+own.id+'/approve','POST',{requestId:uuid(4),reason:'own manager denied'})).data.state,'UNKNOWN');
 invoice.creatorId='10';assert.equal((await call('10','/due-requests','POST',body(5))).data.state,'COMMITTED');const boss=(await call('10','/due-requests')).data.requests[0];assert.equal((await call('10','/due-requests/'+boss.id+'/approve','POST',{requestId:uuid(6),reason:'explicit boss own decision'})).data.state,'COMMITTED');assert(queries.some(q=>q.includes('DESKTOP_CREDIT_ACCESS_READ')));assert.equal(records.filter(r=>r.action==='credit.terms.set').length,0);
});
