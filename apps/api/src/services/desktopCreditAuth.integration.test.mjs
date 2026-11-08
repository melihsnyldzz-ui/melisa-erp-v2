// Real normal-session verification; only the SQL driver and credit store are
// replaced. This proves the private authority binding, not SQL execution.
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
 configure('boss');u.roleVersion='0x0000000000000009';assert.equal((await get()).status,403);assert.equal(auth.close(),true);
});
