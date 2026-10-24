// Real routes, middleware, bcrypt, services and user core. SQL is an in-memory
// transaction fixture; this is not proof that metadata ran on SQL Server.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'};
Object.assign(process.env,environment);
registerCleanContext({databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID},environment);
const fixtureSecret=randomUUID(),fixtureHash=await bcrypt.hash(fixtureSecret,12);
const roles=[{id:28,code:'clean_test_administrator',name:'Fixture manager',is_active:true},{id:20,code:'clean_test_sales',name:'Fixture sales',is_active:true},{id:25,code:'clean_test_finance',name:'Fixture finance',is_active:true}];
const permissions=[{role_id:28,permission_key:'settings.manage',can_create:true},{role_id:28,permission_key:'audit.view',can_view:true},{role_id:28,permission_key:'dashboard.view',can_view:true},{role_id:20,permission_key:'product.view',can_view:true},{role_id:20,permission_key:'sales.create',can_create:true}];
const initial={users:[{id:10018,username:'semih',password_hash:fixtureHash,display_name:'Fixture manager',role_id:28,is_active:true},{id:15,username:'ornek-satis',password_hash:fixtureHash,display_name:'Protected sample',role_id:20,is_active:true}],employees:[],members:[],audits:[],refresh:[],sequence:50100,employeeSequence:60100};
let state=structuredClone(initial),failAudit=false,denyNative=false;
const denied=(number=51972)=>{throw Object.assign(Error('Synthetic native denial'),{number});};
const userRow=(s,id)=>{const u=s.users.find(u=>u.id===Number(id));if(!u)return undefined;const r=roles.find(r=>r.id===u.role_id);return {...u,role_code:r.code,role_name:r.name,role_is_active:r.is_active};};
const result=rows=>({recordset:rows,recordsets:[rows],rowsAffected:[rows.length]});
class Transaction{
 async begin(){this.data=structuredClone(state);this.intent=null;}
 async commit(){assert.equal(this.intent,null,'finish must precede commit');state=this.data;}
 async rollback(){this.rolledBack=true;}
}
class Request{
 constructor(transaction){this.transaction=transaction instanceof Transaction?transaction:null;this.params={};}
 input(name,_type,value){this.params[name]=value;return this;}
 async execute(name){
  const t=this.transaction,s=t?.data,p=this.params;assert.ok(t);
  if(name==='dbo.usp_clean_personnel_bind'){
   if(denyNative)denied();const actor=userRow(s,p.actor_id);if(!actor?.is_active||actor.username!=='semih'||actor.role_id!==28)denied();
   const data=JSON.parse(p.payload_json);assert.doesNotMatch(p.payload_json,/passwordHash|password_hash|loginPassword/);
   if(data.roleId!==undefined&&![20,23,25,26].includes(data.roleId))denied(51974);
   if(['user_update','user_password','employee_update'].includes(p.operation)&&!s.members.some(m=>(p.operation==='employee_update'?m.employee_id:m.user_id)===p.target_id))denied(51973);
   if(p.operation.startsWith('employee_')&&!s.members.some(m=>m.user_id===data.userId&&(p.operation==='employee_create'?m.employee_id===null:m.employee_id===p.target_id)&&userRow(s,m.user_id)?.is_active))denied(51973);
   assert.equal(t.intent,null);t.intent={...p,data,changed:0,audited:0};return result([{accepted:true,actorId:p.actor_id,operation:p.operation}]);
  }
  if(name==='dbo.usp_clean_personnel_finish'){const i=t.intent;assert.equal(i.changed,1);assert.equal(i.audited,1);t.intent=null;return result([{verified:true,actorId:i.actor_id,operation:i.operation}]);}
  throw Error('Unexpected native procedure '+name);
 }
 async query(text){
  const s=this.transaction?.data??state,p=this.params,t=this.transaction,i=t?.intent;
  if(text.includes('OBJECT_ID')&&text.includes('clean_personnel_members'))return {recordsets:[[{ready:true}],s.members]};
  if(text.includes('COL_LENGTH'))return result([{is_ready:1}]);
  if(text.includes('INSERT INTO dbo.users')){
   assert.equal(i?.operation,'user_create');assert.match(text,/OUTPUT INSERTED.id INTO @createdUser/);
   if(s.users.some(u=>u.username.toLowerCase()===p.username.toLowerCase()))throw Object.assign(Error('duplicate'),{number:2627});
   const id=++s.sequence;s.users.push({id,username:p.username,password_hash:p.passwordHash,display_name:p.displayName,role_id:p.roleId,is_active:true,created_by:p.actorId,updated_by:p.actorId});s.members.push({user_id:id,employee_id:null});i.target_id=id;i.changed++;return result([{id}]);
  }
  if(text.includes('INSERT INTO dbo.employees')){
   assert.equal(i?.operation,'employee_create');assert.match(text,/OUTPUT INSERTED.id INTO @createdEmployee/);
   if(s.employees.some(e=>e.employee_code===p.employeeCode||e.user_id===p.userId))throw Object.assign(Error('duplicate'),{number:2627});
   const id=++s.employeeSequence;s.employees.push({id,employee_code:p.employeeCode,full_name:p.fullName,phone:p.phone,department:p.department,job_title:p.jobTitle,user_id:p.userId,can_terminal_sale:p.canTerminalSale,can_change_sale_price:p.canChangeSalePrice,max_sale_discount_percent:p.maxSaleDiscountPercent,is_active:p.isActive,created_by:p.actorId,updated_by:p.actorId});s.members.find(m=>m.user_id===p.userId).employee_id=id;i.target_id=id;i.changed++;return result([{id}]);
  }
  if(text.includes('INSERT INTO dbo.audit_logs')){
   if(failAudit)throw Error('Synthetic audit failure');assert.equal(i.changed,1);assert.equal(p.auditActorUserId,10018);assert.equal(p.auditEntityId,i.target_id);i.audited++;s.audits.push({id:s.audits.length+1,actor_user_id:p.auditActorUserId,action:p.auditAction,entity_type:p.auditEntityType,entity_id:p.auditEntityId,before_json:p.auditBeforeJson,after_json:p.auditAfterJson});return result([]);
  }
  if(text.includes('INSERT INTO dbo.auth_refresh_tokens')){s.refresh.push({userId:p.loginUserId,tokenHash:p.refreshTokenHash});return result([]);}
  if(text.includes('UPDATE dbo.users')&&text.includes('password_hash =')){assert.equal(i.operation,'user_password');s.users.find(u=>u.id===p.userId).password_hash=p.passwordHash;s.refresh=s.refresh.filter(r=>r.userId!==p.userId);i.changed++;return result([]);}
  if(text.includes('UPDATE dbo.users')){assert.equal(i.operation,'user_update');const u=s.users.find(u=>u.id===p.id);Object.assign(u,{username:p.username,display_name:p.displayName,role_id:p.roleId,is_active:p.isActive});i.changed++;return result([]);}
  if(text.includes('UPDATE dbo.employees')){assert.equal(i.operation,'employee_update');const e=s.employees.find(e=>e.id===p.id);Object.assign(e,{employee_code:p.employeeCode,full_name:p.fullName,user_id:p.userId,is_active:p.isActive});i.changed++;return result([]);}
  if(text.includes('FROM dbo.roles')&&!text.includes('FROM dbo.users')){
   if(p.roleId!==undefined)return result(roles.filter(r=>r.id===p.roleId&&r.is_active));return result(roles);
  }
  if(text.includes('FROM dbo.permissions'))return result(permissions.filter(r=>p.permissionRoleId===undefined||r.role_id===p.permissionRoleId).map(r=>({...r,role_code:roles.find(x=>x.id===r.role_id).code})));
  if(text.includes('FROM dbo.audit_logs'))return result(s.audits);
  if(text.includes('FROM dbo.employees')){
   if(p.beforeId!==undefined)return result(s.employees.filter(e=>e.id===p.beforeId));
   return result(s.employees.map(e=>({...e,username:userRow(s,e.user_id)?.username,user_role_id:userRow(s,e.user_id)?.role_id,user_role_code:userRow(s,e.user_id)?.role_code,user_role_name:userRow(s,e.user_id)?.role_name})));
  }
  if(text.includes('FROM dbo.terminal_devices'))return result([]);
  if(text.includes('FROM dbo.users')){
   if(p.username!==undefined)return result(s.users.filter(u=>u.username===p.username).map(u=>userRow(s,u.id)));
   const id=p.userId??p.afterId??p.id;if(id!==undefined)return result([userRow(s,id)].filter(Boolean));
   return result(s.users.map(u=>userRow(s,u.id)));
  }
  throw Error('Unhandled in-memory query: '+text.trim().slice(0,100));
 }
}
const q={Transaction,Request},pool={request:()=>new Request()};
await mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>q,getSqlPool:async()=>pool,isCanonicalTest:()=>false}});
await mock.module('../config/env.js',{namedExports:{env:{sql:{database:CLEAN_DATABASE,readOnly:false},auth:{jwtSecret:randomUUID(),refreshSecret:randomUUID(),accessExpiresIn:'15m',refreshExpiresIn:'7d'}}}});
// Types are actual mssql values; no ConnectionPool or SQL transport is created.
const sql=(await import('mssql')).default;Object.assign(q,{BigInt:sql.BigInt,NVarChar:sql.NVarChar,MAX:sql.MAX});
const {login}=await import('./authService.js');
const {requireAuth,requirePermission}=await import('../middleware/authMiddleware.js');
const {authAdminRoutes}=await import('../routes/authAdminRoutes.js');
const {personnelRoutes}=await import('../routes/personnelRoutes.js');
const {cleanPersonnelRequestAllowed}=await import('./cleanPersonnelManagement.mjs');
const app=express();app.use(express.json());
app.use((req,res,next)=>!['GET','HEAD','OPTIONS'].includes(req.method)&&!cleanPersonnelRequestAllowed(req)?res.status(403).json({code:'CLEAN_TEST_OPERATION_DISABLED'}):next());
app.use('/api',authAdminRoutes,personnelRoutes);
app.get('/api/fixture/allowed-read',requireAuth,requirePermission('product.view'),(req,res)=>res.json({id:req.user.id,permissions:req.user.permissions}));
app.use((e,_req,res,_next)=>res.status(e.statusCode??503).json({code:e.code??'UNEXPECTED'}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
test.after(()=>new Promise(resolve=>server.close(resolve)));
const call=async(method,path,body,token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
const credentials={username:'fixture.b5.staff',password:randomUUID(),displayName:'Synthetic B5 Staff',roleId:20};
let managerToken,staffToken,newUserId,newEmployeeId;
test('normal manager creates a new user, normal bcrypt login works, employee link survives reread',async()=>{
 managerToken=(await login({username:'semih',password:fixtureSecret})).accessToken;
 const added=await call('POST','/api/auth-admin/users',credentials,managerToken);assert.equal(added.status,201,JSON.stringify(added.body));
 newUserId=added.body.data.users.find(u=>u.username===credentials.username).id;assert.equal(newUserId,50101);assert.notEqual(state.users.find(u=>u.id===newUserId).password_hash,credentials.password);
 staffToken=(await login({username:credentials.username,password:credentials.password})).accessToken;
 const own=await call('GET','/api/fixture/allowed-read',null,staffToken);assert.equal(own.status,200);assert.equal(own.body.id,newUserId);assert.ok(own.body.permissions.includes('sales.create'));assert.ok(!own.body.permissions.includes('settings.manage'));
 const employee=await call('POST','/api/personnel/employees',{employeeCode:'FIX-B5-60101',fullName:'Synthetic B5 Staff',userId:newUserId,canTerminalSale:true},managerToken);assert.equal(employee.status,201,JSON.stringify(employee.body));newEmployeeId=employee.body.data.employees.find(e=>e.userId===newUserId).id;assert.equal(newEmployeeId,60101);
 const read=await call('GET','/api/personnel/overview',null,managerToken);assert.equal(read.body.data.employees.find(e=>e.id===newEmployeeId).userId,newUserId);
 const auditText=JSON.stringify(state.audits);assert.ok(!auditText.includes(credentials.password));assert.ok(!auditText.includes(state.users.find(u=>u.id===newUserId).password_hash));
 assert.deepEqual(state.users.filter(u=>u.id<50000),initial.users);
});
test('duplicate including inactive username fails, anonymous/wrong role cannot manage, old users cannot be adopted',async()=>{
 assert.equal((await call('POST','/api/auth-admin/users',credentials,managerToken)).status,409);
 assert.equal((await call('POST','/api/auth-admin/users',credentials,null)).status,401);
 assert.equal((await call('POST','/api/auth-admin/users',credentials,staffToken)).status,403);
 assert.equal((await call('PATCH','/api/auth-admin/users/10018',{displayName:'Changed'},managerToken)).status,403);
 assert.equal((await call('PATCH','/api/auth-admin/users/15',{displayName:'Changed'},managerToken)).status,403);
 assert.equal((await call('POST','/api/personnel/employees',{employeeCode:'FIX-OLD',fullName:'Do not adopt',userId:15},managerToken)).status,403);
 assert.equal((await call('POST','/api/auth-admin/users',{...credentials,username:'fixture.admin',roleId:28},managerToken)).status,403);
 assert.deepEqual(state.users.filter(u=>u.id<50000),initial.users);
});
test('native admission denial and audit failure roll back without leaving users, links or passwords in audit',async()=>{
 const prior=structuredClone(state);denyNative=true;
 assert.equal((await call('POST','/api/auth-admin/users',{...credentials,username:'fixture.denied'},managerToken)).status,403);denyNative=false;
 failAudit=true;assert.equal((await call('POST','/api/auth-admin/users',{...credentials,username:'fixture.rollback'},managerToken)).status,503);failAudit=false;
 assert.deepEqual(state,prior);
});
test('normal password reset and personnel update stay on the new identity; links cannot be reassigned',async()=>{
 const nextPassword=randomUUID();
 assert.equal((await call('PATCH',`/api/auth-admin/users/${newUserId}/password`,{password:nextPassword},managerToken)).status,200);
 await assert.rejects(()=>login({username:credentials.username,password:credentials.password}),{statusCode:401});
 credentials.password=nextPassword;
 staffToken=(await login({username:credentials.username,password:nextPassword})).accessToken;
 assert.equal((await call('GET','/api/fixture/allowed-read',null,staffToken)).status,200);
 const update={employeeCode:'FIX-B5-60101',fullName:'Updated Synthetic Staff',userId:newUserId,canTerminalSale:true};
 const changed=await call('PATCH',`/api/personnel/employees/${newEmployeeId}`,update,managerToken);
 assert.equal(changed.status,200,JSON.stringify(changed.body));
 assert.equal(changed.body.data.employees.find(e=>e.id===newEmployeeId).fullName,update.fullName);
 assert.equal((await call('PATCH',`/api/personnel/employees/${newEmployeeId}`,{...update,userId:15},managerToken)).status,403);
 assert.equal((await call('POST','/api/personnel/employees',{...update,employeeCode:'FIX-B5-DUP'},managerToken)).status,403);
 assert.equal((await call('PATCH','/api/auth-admin/users/15/password',{password:randomUUID()},managerToken)).status,403);
 assert.equal((await call('PATCH',`/api/auth-admin/users/${newUserId}`,{roleId:28},managerToken)).status,403);
 assert.equal(state.employees.find(e=>e.id===newEmployeeId).user_id,newUserId);
 assert.ok(!JSON.stringify(state.audits).includes(nextPassword));
 assert.deepEqual(state.users.filter(u=>u.id<50000),initial.users);
});
test('normal account disable rejects the same earlier token and password; passive username stays reserved',async()=>{
 assert.equal((await call('PATCH',`/api/auth-admin/users/${newUserId}`,{isActive:false},managerToken)).status,200);
 assert.equal((await call('GET','/api/fixture/allowed-read',null,staffToken)).status,401);
 await assert.rejects(()=>login({username:credentials.username,password:credentials.password}),{statusCode:401});
 assert.equal((await call('POST','/api/auth-admin/users',credentials,managerToken)).status,409);
 assert.equal((await call('DELETE',`/api/auth-admin/users/${newUserId}`,null,managerToken)).status,403);
 assert.deepEqual(state.users.filter(u=>u.id<50000),initial.users);
});
