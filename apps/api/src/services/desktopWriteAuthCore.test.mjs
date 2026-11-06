import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {createDesktopWriteAuthCore,getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {createDesktopLocalMasterRoutes} from '../routes/desktopLocalMasterRoutes.mjs';

const requestId='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
test('sale capability cannot use an unregistered auth object or a synthetic SQL/password verifier',()=>{const fakePool={},fakeSql={Transaction:class{},Request:class{},NVarChar:()=>null,ISOLATION_LEVEL:{SERIALIZABLE:4}};const auth=createDesktopWriteAuthCore({pool:fakePool,sql:fakeSql,tokenKey:Buffer.alloc(48,1),passwordHasher:{compare:async()=>true}});assert.throws(()=>getDesktopWriteSessionVerifier({},fakePool));assert.throws(()=>getDesktopWriteSessionVerifier(auth,fakePool));assert.equal(auth.close(),true);});
const body={requestId,customerCode:'M1',name:'Test',phone:'555',city:null,country:null,customerType:'customer',currency:'TRY'};
function driver(passwordHash){
 const log=[];let seq=0;
 const state={target:true,extraPermission:false,databaseUser:'melisa_desktop_test_writer_20261105',user:{id:'7',username:'normal',displayName:'Normal',passwordHash,roleId:'2',roleCode:'employee',roleName:'Employee',userActive:true,roleActive:true,userVersion:'0x0000000000000001',roleVersion:'0x0000000000000002'},
  permissions:[{permission_key:'customer.edit',can_view:true,can_create:true,can_update:false,can_delete:false,can_approve:false}]};
 class Transaction{constructor(pool){this.pool=pool;this.id=++seq;}async begin(){this.open=true;log.push({event:'begin',id:this.id});}async commit(){this.open=false;log.push({event:'commit',id:this.id});}async rollback(){this.open=false;log.push({event:'rollback',id:this.id});}}
 class Request{constructor(tx){if(!tx?.open)throw Error('not same active tx');this.tx=tx;this.params={};}input(k,_type,v){this.params[k]=v;return this;}
  async query(sql){log.push({event:'query',id:this.tx.id,sql,params:this.params});
   if(sql.includes('DESKTOP_AUTH_TARGET_REJECTED')){assert.match(sql,/DATALENGTH\(USER_NAME\(\)\)/);assert.match(sql,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);if(!state.target||state.extraPermission||state.databaseUser!=='melisa_desktop_test_writer_20261105')throw Error('wrong db, user, or extra permission');return {recordset:[{ok:1}]};}
   if(sql.includes('FROM dbo.users u WITH(UPDLOCK,HOLDLOCK)'))return {recordset:((this.params.username===state.user.username||this.params.userId===state.user.id)?[{...state.user}]:[])};
   if(sql.includes('FROM dbo.permissions WITH(UPDLOCK,HOLDLOCK)'))return {recordset:state.permissions.map(p=>({...p}))};throw Error('unexpected sql');}}
 const sql={Transaction,Request,NVarChar:()=>({}),ISOLATION_LEVEL:{SERIALIZABLE:4}};
 return {sql,pool:{},state,log};
}
async function fixture(t,{permission=true,waitOperation=false}={}){
 const passwordHash=await bcrypt.hash('test-test',12),d=driver(passwordHash),key=Buffer.alloc(48,3);
 if(!permission)d.state.permissions=[{permission_key:'customer.view',can_view:true,can_create:false,can_update:false,can_delete:false,can_approve:false}];
 const auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:key});
 const signed=await auth.login({username:'normal',password:'test-test'});let calls=0,release,started;
 const began=new Promise(resolve=>{started=resolve;});
 const service=auth.bindService({async createCustomer(actor,payload){calls++;const tx=new d.sql.Transaction(d.pool);await tx.begin();try{
  if(!await auth.verifySession({transaction:tx,actorId:actor,permission:'customer.edit'})){await tx.rollback();return {state:'UNKNOWN',requestId:payload.requestId};}
  started();if(waitOperation)await new Promise(resolve=>{release=resolve;});await tx.commit();
  return {state:'COMMITTED',requestId:payload.requestId,operation:'customer.create',replayed:false,entity:{kind:'local',id:'1',entityId:'2',selectedCurrency:'TRY',accounts:[{id:'3',customerId:'1',currency:'TRY',currentBalanceExact8:'0.00000000'}]}};
 }catch(error){await tx.rollback();throw error;}},async createProduct(){throw Error('not used');}});
 const app=express();app.use(express.json());app.use(auth.bind);app.use(createDesktopLocalMasterRoutes({service,authenticateNormal:auth.authenticateNormal}));
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 function post(token=signed.accessToken){return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/desktop-local/customers',method:'POST',headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294','content-type':'application/json',authorization:'Bearer '+token}},r=>{const chunks=[];r.on('data',v=>chunks.push(v));r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())}));});req.on('error',reject);req.end(JSON.stringify(body));});}
 return {auth,d,key,signed,post,began,release:()=>release?.(),calls:()=>calls};
}
test('normal bcrypt/JWT login binds current role and rechecks it on the writing transaction',async t=>{
 const f=await fixture(t),r=await f.post();assert.equal(r.status,201);assert.equal(r.body.data.state,'COMMITTED');assert.equal(f.calls(),1);
 const groups=new Map();for(const event of f.d.log.filter(v=>v.event==='query')){const g=groups.get(event.id)||[];g.push(event.sql);groups.set(event.id,g);}
 assert.ok([...groups.values()].some(g=>g.some(s=>s.includes('DESKTOP_AUTH_TARGET_REJECTED'))&&g.some(s=>s.includes('FROM dbo.users u WITH(UPDLOCK,HOLDLOCK)'))&&g.some(s=>s.includes('FROM dbo.permissions WITH(UPDLOCK,HOLDLOCK)'))));
 assert.equal(f.auth.close(),true);
});
test('view-only user can sign in but cannot authorize a master write',async t=>{
 const f=await fixture(t,{permission:false}),r=await f.post();assert.equal(r.status,503);assert.equal(r.body.data.state,'UNKNOWN');assert.equal(f.calls(),0);
});
test('wrong password, wrong target and signed but unregistered bearer never authorize',async t=>{
 const f=await fixture(t);await assert.rejects(f.auth.login({username:'normal',password:'wrong'}));
 f.d.state.target=false;await assert.rejects(f.auth.login({username:'normal',password:'test-test'}));f.d.state.target=true;
 f.d.state.databaseUser='guest';await assert.rejects(f.auth.login({username:'normal',password:'test-test'}));f.d.state.databaseUser='melisa_desktop_test_writer_20261105';
 f.d.state.extraPermission=true;await assert.rejects(f.auth.login({username:'normal',password:'test-test'}));f.d.state.extraPermission=false;
 const forged=jwt.sign({sub:'7',sid:'d6be01f9-fac4-4e9c-b421-e2f070b6beb0'},f.key,{algorithm:'HS256',issuer:'melisa-desktop-initial',audience:'melisa-desktop-initial',expiresIn:'10m'});
 const r=await f.post(forged);assert.equal(r.status,503);assert.equal(r.body.data.state,'UNKNOWN');assert.equal(f.calls(),0);
});
test('expired idle sessions are pruned and active session count stays bounded',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const d=driver('synthetic-hash'),auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:Buffer.alloc(48,4),passwordHasher:{compare:async()=>true}});
 for(let i=0;i<256;i++)await auth.login({username:'normal',password:'test-test'});
 await assert.rejects(auth.login({username:'normal',password:'test-test'}));
 t.mock.timers.tick(600001);
 const next=await auth.login({username:'normal',password:'test-test'});assert.ok(next.accessToken);assert.equal(auth.close(),true);
});
test('expiry cleanup keeps an in-flight SQL lease until its operation finishes',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const f=await fixture(t,{waitOperation:true}),pending=f.post();await f.began;
 t.mock.timers.tick(600001);
 await f.auth.login({username:'normal',password:'test-test'}); // triggers cleanup
 assert.equal(f.auth.close(),false); // active operation still owns its lease
 f.release();const result=await pending;assert.equal(result.status,201);
 assert.equal(f.auth.close(),true);
});
test('role deactivation or user version change invalidates the prior token',async t=>{
 const f=await fixture(t);f.d.state.user.roleActive=false;let r=await f.post();assert.equal(r.status,503);assert.equal(f.calls(),0);
 f.d.state.user.roleActive=true;f.d.state.user.userVersion='0x0000000000000009';r=await f.post();assert.equal(r.status,503);assert.equal(f.calls(),0);
});
test('logout waits for an already-authorized transaction and then denies token reuse',async t=>{
 const f=await fixture(t,{waitOperation:true});const first=f.post();await f.began;let completed=false;
 const logout=f.auth.logout({get:()=>`Bearer ${f.signed.accessToken}`}).then(()=>{completed=true;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);f.release();const result=await first;assert.equal(result.status,201);await logout;assert.equal(completed,true);
 const second=await f.post();assert.equal(second.status,503);assert.equal(f.calls(),1);
});
test('sale lease checks both create and finalize against current locked role and releases after use',async t=>{
 const d=driver('synthetic'),key=Buffer.alloc(48,7);d.state.permissions=['sales.create','sales.finalize'].map(permission_key=>({permission_key,can_view:true,can_create:true,can_update:false,can_delete:false,can_approve:true}));
 const auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:key,passwordHasher:{compare:async()=>true}}),signed=await auth.login({username:'normal',password:'test-test'});
 const service=auth.bindSaleService({async sell(actor){const tx=new d.sql.Transaction(d.pool);await tx.begin();const ok=await auth.verifySession({transaction:tx,actorId:actor,permission:['sales.create','sales.finalize']});if(ok)await tx.commit();else await tx.rollback();return ok;}});
 const app=express();app.use(auth.bind);app.get('/sale',async(req,res)=>{try{const actor=await auth.authenticateNormal(req);res.json({ok:await service.sell(String(actor.userId),{})});}catch{res.json({ok:false});}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const run=()=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/sale',headers:{authorization:'Bearer '+signed.accessToken}},r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>resolve(JSON.parse(body)));});req.on('error',reject);req.end();});
 assert.equal((await run()).ok,true);d.state.permissions=d.state.permissions.filter(p=>p.permission_key!=='sales.finalize');assert.equal((await run()).ok,false);assert.equal(auth.close(),true);
});
test('sales receipt session requires current sales.view and releases its transaction lease',async t=>{
 const d=driver('synthetic'),key=Buffer.alloc(48,9);d.state.permissions=[{permission_key:'sales.view',can_view:true,can_create:false,can_update:false,can_delete:false,can_approve:false}];
 const auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:key,passwordHasher:{compare:async()=>true}}),signed=await auth.login({username:'normal',password:'test-test'});
 const service=auth.bindSaleService({async sell(actor){const tx=new d.sql.Transaction(d.pool);await tx.begin();const ok=await auth.verifySession({transaction:tx,actorId:actor,permission:'sales.view'});if(ok)await tx.commit();else await tx.rollback();return ok;}});
 const app=express();app.use(auth.bind);app.get('/receipt',async(req,res)=>{try{const actor=await auth.authenticateNormal(req);res.json({ok:await service.sell(String(actor.userId),{})});}catch{res.json({ok:false});}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const run=()=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/receipt',headers:{authorization:'Bearer '+signed.accessToken}},r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>resolve(JSON.parse(body)));});req.on('error',reject);req.end();});
 assert.equal((await run()).ok,true);d.state.permissions=[];assert.equal((await run()).ok,false);assert.equal(auth.close(),true);
});
for(const operation of ['preview','receipt'])test(`${operation} lease releases on success and failure; logout waits for in-flight read`,async t=>{
 const d=driver('synthetic');d.state.permissions=['sales.create','sales.finalize','sales.view'].map(permission_key=>({permission_key,can_view:true,can_create:true,can_update:false,can_delete:false,can_approve:true}));
 const auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:Buffer.alloc(48,11),passwordHasher:{compare:async()=>true}});let signed=await auth.login({username:'normal',password:'test-test'}),finish,started,shouldFail=false;
 const began=new Promise(resolve=>{started=resolve;});const runRead=async actor=>{const tx=new d.sql.Transaction(d.pool);await tx.begin();if(!await auth.verifySession({transaction:tx,actorId:actor,permission:operation==='receipt'?'sales.view':['sales.create','sales.finalize']})){await tx.rollback();throw Error('denied');}
  if(!shouldFail){started();await new Promise(resolve=>{finish=resolve;});await tx.commit();return true;}await tx.rollback();throw Error('read failure');};
 const service=auth.bindSaleService({sell:async()=>false,[operation]:runRead});const app=express();app.use(auth.bind);app.get('/read',async(req,res)=>{try{const actor=await auth.authenticateNormal(req);res.json({ok:await service[operation](String(actor.userId))});}catch{res.json({ok:false});}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const call=()=>new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/read',headers:{authorization:'Bearer '+signed.accessToken}},x=>{let body='';x.on('data',v=>body+=v);x.on('end',()=>resolve(JSON.parse(body)));});r.on('error',reject);r.end();});
 const pending=call();await began;let logoutDone=false;const logout=auth.logout({get:()=>`Bearer ${signed.accessToken}`}).then(()=>{logoutDone=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(logoutDone,false);finish();assert.equal((await pending).ok,true);await logout;assert.equal(logoutDone,true);
 shouldFail=true;signed=await auth.login({username:'normal',password:'test-test'});assert.equal((await call()).ok,false);assert.equal(auth.close(),true);
});
test('workflow, draft, dispatch, read and resolution bindings release their current-session lease on success and error',async t=>{
 const d=driver('synthetic');d.state.permissions=['sales.create','sales.finalize','sales.edit','sales.view'].map(permission_key=>({permission_key,can_view:true,can_create:true,can_update:true,can_delete:false,can_approve:true}));
 const auth=createDesktopWriteAuthCore({pool:d.pool,sql:d.sql,tokenKey:Buffer.alloc(48,15),passwordHasher:{compare:async()=>true}}),signed=await auth.login({username:'normal',password:'test-test'});let shouldFail=false;
 const cases=[['bindWorkflowService','transition','sales.edit'],['bindDraftService','createDraft',['sales.create','sales.finalize']],['bindDraftService','preview',['sales.create','sales.finalize']],['bindDispatchService','dispatch',['sales.create','sales.finalize']],['bindWorkflowReadService','read','sales.view'],['bindResolutionService','resolve','sales.view']];
 const bound=cases.map(([bind,name,permission])=>{const invoke=async actor=>{const tx=new d.sql.Transaction(d.pool);await tx.begin();if(!await auth.verifySession({transaction:tx,actorId:actor,permission}))throw Error('denied');if(shouldFail){await tx.rollback();throw Error('synthetic failure');}await tx.commit();return true;};return auth[bind]({[name]:invoke,...(name==='preview'?{createDraft:async()=>false}:{})})[name];});
 const app=express();app.use(auth.bind);app.get('/:case',async(req,res)=>{try{const actor=await auth.authenticateNormal(req);res.json({ok:await bound[Number(req.params.case)](String(actor.userId),{})});}catch{res.json({ok:false});}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const call=i=>new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/'+i,headers:{authorization:'Bearer '+signed.accessToken}},x=>{let body='';x.on('data',v=>body+=v);x.on('end',()=>resolve(JSON.parse(body)));});r.on('error',reject);r.end();});
 for(let i=0;i<cases.length;i++){shouldFail=false;assert.equal((await call(i)).ok,true);shouldFail=true;assert.equal((await call(i)).ok,false);}assert.equal(auth.close(),true);
});
