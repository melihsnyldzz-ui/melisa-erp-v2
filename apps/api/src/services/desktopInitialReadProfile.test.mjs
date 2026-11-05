import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDesktopInitialReadIdentity,assertDesktopInitialReadUser,withDesktopInitialReadSession,
 DESKTOP_INITIAL_READ_IDENTITY_SQL,DESKTOP_INITIAL_READ_LIMITS} from './desktopInitialReadProfile.mjs';

const row=()=>({serverName:'Semih\\MELISAERP',databaseName:'MELISA_ERP_DESKTOP_TEST_20261105',
 loginName:'melisa_desktop_test_app_20261105',originalLogin:'melisa_desktop_test_app_20261105',databaseUser:'melisa_desktop_test_app_20261105',
 transport:'TCP',authScheme:'SQL',sysadmin:0,dbOwner:0,controlServer:0,alterAnyLogin:0,impersonateAnyLogin:0,alterAnyDatabase:0,databaseControl:0,mutationPermissionCount:0,
 selectedTableCount:27,businessRows:0,markerCount:1,environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',
 schemaVersion:1,readOnly:1,actualT1:0,externalOperations:0});
const user=()=>({id:'11',username:'kurulum',userActive:true,roleCode:'empty_local_reader',roleActive:true,
 permissions:['customer.view','dashboard.view','product.view','supplier.view']});
test('profile accepts only the observed new test target, marker and encrypted read-only principal',()=>{
 assert.equal(assertDesktopInitialReadIdentity(row()),true);
 for(const change of [{serverName:'Semih\\SQLEXPRESS'},{databaseName:'master'},{loginName:'sa'},
  {originalLogin:'sa'},{databaseUser:'dbo'},{transport:'Shared memory'},{authScheme:'NTLM'},
  {sysadmin:1},{dbOwner:1},{controlServer:1},{alterAnyLogin:1},{impersonateAnyLogin:1},
  {alterAnyDatabase:1},{databaseControl:1},{mutationPermissionCount:1},
  {selectedTableCount:26},{businessRows:1},{markerCount:0},{environmentId:'other'},{schemaVersion:2},
  {readOnly:0},{actualT1:1},{externalOperations:1},{extra:1}])
  assert.throws(()=>assertDesktopInitialReadIdentity({...row(),...change}),{code:'DESKTOP_INITIAL_READ_REJECTED'});
});
test('user role, active status and exact four views are rechecked with no admin expansion',()=>{
 assert.equal(assertDesktopInitialReadUser(user()),true);
 for(const change of [{id:'0'},{username:'other'},{userActive:false},{roleCode:'owner_manager'},
  {roleActive:false},{permissions:['customer.view','dashboard.view','product.view','product.edit']},
  {permissions:[...user().permissions,'sales.create']},{permissions:['customer.view','customer.view','product.view','supplier.view']}])
  assert.throws(()=>assertDesktopInitialReadUser({...user(),...change}),{code:'DESKTOP_INITIAL_READ_REJECTED'});
});
test('query only inspects target identity, marker and permissions, never business values',()=>{
 assert.match(DESKTOP_INITIAL_READ_IDENTITY_SQL,/sys\.fn_my_permissions/);
 assert.match(DESKTOP_INITIAL_READ_IDENTITY_SQL,/CONNECTIONPROPERTY\('net_transport'\)/);
 assert.doesNotMatch(DESKTOP_INITIAL_READ_IDENTITY_SQL,/sys\.dm_exec_connections|encryptOption/);
 assert.match(DESKTOP_INITIAL_READ_IDENTITY_SQL,/dbo\.desktop_empty_installation/);
 const withoutLiterals=DESKTOP_INITIAL_READ_IDENTITY_SQL.replace(/N?'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(withoutLiterals,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXEC(?:UTE)?)\b/i);
 assert.equal(DESKTOP_INITIAL_READ_LIMITS.salesWritesEnabled,false);assert.equal(DESKTOP_INITIAL_READ_LIMITS.fullErpReady,false);
 assert.equal(DESKTOP_INITIAL_READ_LIMITS.verifiesCertificate,false);assert.equal(DESKTOP_INITIAL_READ_LIMITS.authenticatesPassword,false);
});
test('work receives the same connection only after a successful identity read',async()=>{
 const events=[],connection={promises:{query:async sql=>{events.push(sql);return {first:[row()]};}}};
 const result=await withDesktopInitialReadSession(connection,actual=>{assert.equal(actual,connection);events.push('work');return 42;});
 assert.equal(result,42);assert.deepEqual(events,[DESKTOP_INITIAL_READ_IDENTITY_SQL,'work']);
 for(const bad of [[],[row(),row()],[{...row(),databaseName:'master'}]]){
  let called=false;await assert.rejects(withDesktopInitialReadSession({promises:{query:async()=>({first:bad})}},()=>{called=true;}),{code:'DESKTOP_INITIAL_READ_REJECTED'});assert.equal(called,false);
 }
 let called=false;await assert.rejects(withDesktopInitialReadSession({promises:{query:async()=>{throw Error('PRIVATE_SQL');}}},()=>{called=true;}),error=>error.code==='DESKTOP_INITIAL_READ_REJECTED'&&!error.message.includes('PRIVATE_SQL'));assert.equal(called,false);
});
test('accessors are rejected without invoking them',()=>{
 const x=row();Object.defineProperty(x,'serverName',{enumerable:true,get(){throw Error('getter ran');}});
 assert.throws(()=>assertDesktopInitialReadIdentity(x),{code:'DESKTOP_INITIAL_READ_REJECTED'});
});
