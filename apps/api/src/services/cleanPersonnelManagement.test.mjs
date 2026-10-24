import test from 'node:test';
import assert from 'node:assert/strict';
import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {cleanPersonnelRequestAllowed,assertCleanPersonnelWrite,bindCleanPersonnelWrite} from './cleanPersonnelManagement.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'};
Object.assign(process.env,environment);
registerCleanContext({databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID},environment);
const actor={id:10018,username:'semih',role:{id:28,code:'clean_test_administrator'},permissions:['settings.manage']};
test('only normal management routes enter the existing clean router; device and business writes stay closed',()=>{
 for(const path of ['/api/auth-admin/users','/api/personnel/employees'])assert.equal(cleanPersonnelRequestAllowed({method:'POST',path}),true);
 for(const path of ['/api/auth-admin/users/50101','/api/auth-admin/users/50101/password','/api/personnel/employees/60101'])assert.equal(cleanPersonnelRequestAllowed({method:'PATCH',path}),true);
 for(const [method,path] of [['DELETE','/api/auth-admin/users/50101'],['POST','/api/personnel/terminals'],['PATCH','/api/personnel/terminals/1/employee'],['POST','/api/auth-admin/roles'],['POST','/api/sales'],['PATCH','/api/auth-admin/users/0'],['POST','/api/auth-admin/users/']])assert.equal(cleanPersonnelRequestAllowed({method,path}),false);
 assert.equal(cleanPersonnelRequestAllowed({method:'POST',path:'/api/auth-admin/users'},{...environment,API_PORT:'4196'}),false);
});
test('real manager permission and exact target are required; admin-looking flags cannot replace identity',()=>{
 assert.equal(assertCleanPersonnelWrite(actor,'user_create'),true);
 for(const denied of [null,{...actor,id:50101},{...actor,permissions:[]},{...actor,isAdmin:true},{...actor,testAdminSession:true},{...actor,isActive:false}])assert.throws(()=>assertCleanPersonnelWrite(denied,'user_create'),{statusCode:403});
 process.env.SQL_DATABASE='MELISA_ERP_PROD_CANDIDATE_20260917_01';assert.throws(()=>assertCleanPersonnelWrite(actor,'user_create'),{code:'CLEAN_TEST_IDENTITY_REJECTED'});Object.assign(process.env,environment);
 assert.throws(()=>assertCleanPersonnelWrite(actor,'terminal_create'),{statusCode:403});
});
test('native admission and finish use one transaction, only metadata; failures never grant a general mutation scope',async()=>{
 const transaction={},calls=[];
 class Request{constructor(tx,options){assert.equal(tx,transaction);this.options=options;this.params={};}input(k,_t,v){this.params[k]=v;return this;}async execute(name){calls.push({name,params:this.params,options:this.options});return {recordset:[{[name.endsWith('_bind')?'accepted':'verified']:true,operation:'user_create',actorId:10018}]};}}
 const q={Request,BigInt:'bigint',NVarChar:()=>'',MAX:'MAX'};
 const finish=await bindCleanPersonnelWrite(transaction,q,actor,'user_create',{username:'fixture.staff',displayName:'Fixture Staff',roleId:20,password:'never-export-this-value'});await finish();
 assert.deepEqual(calls.map(c=>c.name),['dbo.usp_clean_personnel_bind','dbo.usp_clean_personnel_finish']);assert.doesNotMatch(JSON.stringify(calls),/never-export|password/);
 assert.deepEqual(calls[0].options,{requestTimeout:30000});assert.equal(calls[1].options,undefined);
 await assert.rejects(()=>bindCleanPersonnelWrite(transaction,q,actor,'user_create',{roleId:2}),{code:'CLEAN_PERSONNEL_ROLE_FORBIDDEN'});
 await assert.rejects(()=>bindCleanPersonnelWrite(transaction,q,actor,'employee_create',{userId:50101,loginPassword:'not-allowed'}),{code:'CLEAN_PERSONNEL_ACCOUNT_REQUIRED'});
 q.Request=class extends Request{async execute(){return {recordset:[{accepted:false,actorId:10018,operation:'user_create'}]};}};
 await assert.rejects(()=>bindCleanPersonnelWrite(transaction,q,actor,'user_create',{roleId:20}),{code:'CLEAN_PERSONNEL_ADMISSION_INVALID'});
 q.Request=class extends Request{async execute(){throw Object.assign(Error('protected'),{number:51973});}};
 await assert.rejects(()=>bindCleanPersonnelWrite(transaction,q,actor,'user_update',{},10018),{code:'CLEAN_PERSONNEL_PROTECTED_RECORD',statusCode:403});
});

test('bounded native admission timeout cannot produce a finish capability or retry',async()=>{
 const timeout=Object.assign(Error('readiness timed out'),{code:'ETIMEOUT'});let requests=0;
 class Request{constructor(_tx,options){requests++;assert.deepEqual(options,{requestTimeout:30000});}input(){return this;}async execute(name){assert.equal(name,'dbo.usp_clean_personnel_bind');throw timeout;}}
 await assert.rejects(bindCleanPersonnelWrite({}, {Request,BigInt:'bigint',NVarChar:()=>'',MAX:'MAX'},actor,'user_create',{username:'fixture.staff',displayName:'Fixture',roleId:30}),error=>error===timeout);
 assert.equal(requests,1);
});
