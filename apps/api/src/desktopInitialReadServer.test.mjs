import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspect} from 'node:util';
import vm from 'node:vm';
import {createHash,X509Certificate} from 'node:crypto';
import bcrypt from 'bcrypt';
import {createDesktopInitialTlsConfig,getDesktopInitialTlsPool,DESKTOP_INITIAL_TLS_LIMITS} from './config/desktopInitialTls.mjs';
import {createDesktopInitialReadCore,createDesktopInitialReadApp,DESKTOP_INITIAL_SERVER_LIMITS} from './desktopInitialReadServer.mjs';
import {DESKTOP_INITIAL_READ_IDENTITY_SQL} from './services/desktopInitialReadProfile.mjs';

const identity=()=>({serverName:'Semih\\MELISAERP',databaseName:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',
 loginName:'melisa_desktop_test_app_20261105',originalLogin:'melisa_desktop_test_app_20261105',databaseUser:'melisa_desktop_test_app_20261105',
 transport:'TCP',authScheme:'SQL',sysadmin:0,dbOwner:0,controlServer:0,alterAnyLogin:0,impersonateAnyLogin:0,alterAnyDatabase:0,databaseControl:0,
 mutationPermissionCount:0,selectedTableCount:27,businessRows:0,markerCount:1,environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',schemaVersion:1,readOnly:1,actualT1:0,externalOperations:0});
function mockDatabase(){
 const events=[],state={identity:identity(),roleActive:true,userActive:true,roleCode:'empty_local_reader',rows:0,optionsProducts:0,optionsSuppliers:0,sqlFailure:false,passwordHash:'synthetic-hash',permissionMutation:null};
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');events.push('BEGIN');}async commit(){events.push('COMMIT');}async rollback(){events.push('ROLLBACK');}}
 class Request{
  constructor(tx){assert(tx instanceof Transaction);this.params={};}
  input(key,type,value){this.params[key]=value;return this;}
  async query(statement){
   if(state.sqlFailure)throw Error('PRIVATE_DATABASE_ERROR');
   if(statement===DESKTOP_INITIAL_READ_IDENTITY_SQL){events.push('IDENTITY');return {recordset:[state.identity]};}
   if(statement.includes('FROM dbo.users u')){events.push('USER');assert.equal(this.params.username,'kurulum');
    return {recordset:[{id:'11',username:'kurulum',displayName:'Kurulum',roleId:'2',roleCode:state.roleCode,roleName:'Yerel',userActive:state.userActive,roleActive:state.roleActive,passwordHash:state.passwordHash}]};}
   if(statement.includes('FROM dbo.permissions')){events.push('PERMISSIONS');assert.equal(this.params.roleId,'2');assert(!statement.includes('can_view=1 OR'));const rows=['customer.view','dashboard.view','product.view','supplier.view'].map(permission_key=>({permission_key,can_view:true,can_create:false,can_update:false,can_delete:false,can_approve:false}));if(state.permissionMutation)state.permissionMutation(rows);return {recordset:rows};}
   if(statement.includes('AS productTotal')){events.push('OPTIONS');return {recordset:[{productTotal:state.optionsProducts,supplierTotal:state.optionsSuppliers}]};}
   if(statement.includes('COUNT_BIG(*) AS total')){events.push('COUNT');return {recordset:[{total:state.rows}]};}
   throw Error('unexpected SQL');
  }
 }
 return {driver:{Transaction,Request,NVarChar:()=>({}),ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'}},state,events};
}
function coreFor(mock){return createDesktopInitialReadCore({pool:{},driver:mock.driver,tokenKey:Buffer.alloc(48,7),passwordHasher:{compare:async(pass,hash)=>pass==='synthetic-password'&&hash==='synthetic-hash'}});}
test('normal bcrypt-shaped login and all three read endpoints share verified transaction and current role',async()=>{
 const db=mockDatabase(),core=coreFor(db),session=await core.login({username:'kurulum',password:'synthetic-password'});
 assert.equal(session.user.username,'kurulum');assert.equal(session.readOnlySession,true);assert.equal(session.refreshToken,null);
 assert.deepEqual(db.events,['BEGIN','IDENTITY','USER','PERMISSIONS','COMMIT']);
 for(const kind of ['products','customers','suppliers']){db.events.length=0;const result=await core.read(session.accessToken,kind);assert.deepEqual(result.data,[]);assert.deepEqual(db.events,['BEGIN','IDENTITY','USER','PERMISSIONS','COUNT','COMMIT']);}
 assert.equal((await core.me(session.accessToken)).id,11);assert.equal(DESKTOP_INITIAL_SERVER_LIMITS.fullErpReady,false);
});
test('product options match UI contract only when both SQL tables are empty',async()=>{
 const db=mockDatabase(),core=coreFor(db),session=await core.login({username:'kurulum',password:'synthetic-password'});
 db.events.length=0;
 assert.deepEqual(await core.options(session.accessToken),{brands:[],categories:[],suppliers:[],supplierOptions:[],brandCurrencies:{},brandDefaults:{},supplierCurrencies:{}});
 assert.deepEqual(db.events,['BEGIN','IDENTITY','USER','PERMISSIONS','OPTIONS','COMMIT']);
 db.state.optionsSuppliers=1;
 await assert.rejects(core.options(session.accessToken),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 assert.equal(db.events.at(-1),'ROLLBACK');
 db.state.optionsSuppliers=0;db.state.optionsProducts=1;
 await assert.rejects(core.options(session.accessToken),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
});
test('failed credentials, revoked roles, drift and driver errors fail closed without exposing internals',async()=>{
 const db=mockDatabase(),core=coreFor(db);
 await assert.rejects(core.login({username:'kurulum',password:'wrong'}),{code:'DESKTOP_INITIAL_AUTH_REJECTED'});
 assert.equal(db.events.at(-1),'ROLLBACK');
 const session=await core.login({username:'kurulum',password:'synthetic-password'});
 db.state.roleActive=false;await assert.rejects(core.read(session.accessToken,'products'),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 db.state.roleActive=true;db.state.identity.databaseName='master';await assert.rejects(core.read(session.accessToken,'customers'),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 db.state.identity=identity();db.state.rows=1;await assert.rejects(core.read(session.accessToken,'suppliers'),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 db.state.rows=0;db.state.permissionMutation=rows=>{rows[0].can_delete=true;};await assert.rejects(core.read(session.accessToken,'customers'),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 db.state.permissionMutation=rows=>{rows.push({permission_key:'private.delete',can_view:false,can_create:false,can_update:false,can_delete:true,can_approve:false});};await assert.rejects(core.read(session.accessToken,'products'),{code:'DESKTOP_INITIAL_UNAVAILABLE'});
 db.state.sqlFailure=true;await assert.rejects(core.read(session.accessToken,'products'),e=>e.code==='DESKTOP_INITIAL_UNAVAILABLE'&&!e.message.includes('PRIVATE_DATABASE_ERROR'));
 await assert.rejects(core.read('not-a-token','products'),{code:'DESKTOP_INITIAL_AUTH_REJECTED'});
});
test('actual bcrypt checks a synthetic hash without leaking it in the returned user',async()=>{
 const db=mockDatabase(),password='sentetik-deneme-parolasi';db.state.passwordHash=await bcrypt.hash(password,12);
 const core=createDesktopInitialReadCore({pool:{},driver:db.driver,tokenKey:Buffer.alloc(48,7)});
 const value=await core.login({username:'kurulum',password});
 assert(!JSON.stringify(value.user).includes(db.state.passwordHash));
 await assert.rejects(core.login({username:'kurulum',password:password+'wrong'}),{code:'DESKTOP_INITIAL_AUTH_REJECTED'});
});
test('express app installs only normal auth and three GET lists without listening',()=>{
 const app=createDesktopInitialReadApp(coreFor(mockDatabase()));
 const routes=app._router.stack.filter(x=>x.route).map(x=>[Object.keys(x.route.methods)[0],x.route.path]);
 assert.deepEqual(routes,[['post','/api/auth/login'],['get','/api/auth/me'],['get','/api/products/options'],['get','/api/products'],['get','/api/customers'],['get','/api/suppliers']]);
});
test('portable certificate validation uses a synthetic pin only in an isolated config-function fixture',async()=>{
 const pem=await readFile(new URL('./config/fixtures/desktop-tls-synthetic-public.pem',import.meta.url),'utf8');
 const source=await readFile(new URL('./config/desktopInitialTls.mjs',import.meta.url),'utf8');
 const start=source.indexOf('export function createDesktopInitialTlsConfig(input){'),end=source.indexOf('\n// Only this factory',start);
 assert(start>=0&&end>start);
 const functionSource=source.slice(start,end).replace('export function','function');
 assert.doesNotMatch(functionSource,/ConnectionPool|\.connect\s*\(|\.query\s*\(/);
 const syntheticPin=createHash('sha256').update(new X509Certificate(pem).raw).digest('hex');
 assert.equal(DESKTOP_INITIAL_TLS_LIMITS.certificateDerSha256,'dfb05698389659352709765a2109ed82bde543ca552a403e06df652b2cb004d5');
 // The actual production factory keeps its fixed machine pin and rejects this
 // different public fixture. No alternate pin is accepted by production API.
 assert.throws(()=>createDesktopInitialTlsConfig({password:'synthetic-secret',publicCertificatePem:pem}),{code:'DESKTOP_INITIAL_TLS_REJECTED'});
 function fixture({pin=syntheticPin,now=Date.UTC(2026,10,6)}={}){
  const scope={Object,createHash,X509Certificate,inspect,PIN:pin,Date:class extends Date{static now(){return now;}},
   fail(){throw Object.assign(Error('DESKTOP_INITIAL_TLS_REJECTED'),{code:'DESKTOP_INITIAL_TLS_REJECTED'});}};
  vm.runInNewContext(functionSource+';globalThis.build=createDesktopInitialTlsConfig;',scope);
  return scope.build;
 }
 const build=fixture(),cfg=build({password:'synthetic-secret',publicCertificatePem:pem});
 const wrongHostPem=await readFile(new URL('./config/fixtures/desktop-tls-wrong-host-public.pem',import.meta.url),'utf8');
 const wrongHostPin=createHash('sha256').update(new X509Certificate(wrongHostPem).raw).digest('hex');
 assert.throws(()=>fixture({pin:wrongHostPin})({password:'synthetic-secret',publicCertificatePem:wrongHostPem}),{code:'DESKTOP_INITIAL_TLS_REJECTED'});
 assert.equal(cfg.server,'127.0.0.1');assert.equal(cfg.port,51433);assert.equal(cfg.options.serverName,'SEMIH');
 assert.equal(cfg.options.encrypt,true);assert.equal(cfg.options.trustServerCertificate,false);
 assert(!JSON.stringify(cfg).includes('synthetic-secret'));assert(!inspect(cfg).includes('synthetic-secret'));
 for(const factory of [build,fixture({pin:'0'.repeat(64)}),fixture({now:Date.UTC(2019,0,1)}),fixture({now:Date.UTC(2041,0,1)})]){
  const input={password:'synthetic-secret',publicCertificatePem:factory===build?pem.replace('CERTIFICATE','NOTCERTIFICATE'):pem};
  assert.throws(()=>factory(input),{code:'DESKTOP_INITIAL_TLS_REJECTED'});
 }
 let getterCalled=false;assert.throws(()=>build({password:'synthetic-secret',get publicCertificatePem(){getterCalled=true;return pem;}}),{code:'DESKTOP_INITIAL_TLS_REJECTED'});assert.equal(getterCalled,false);
 assert.throws(()=>getDesktopInitialTlsPool({profile:'desktop-initial-read',transport:'pinned-tedious'}),{code:'DESKTOP_INITIAL_TLS_REJECTED'});
});
