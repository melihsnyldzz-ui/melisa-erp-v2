import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createTerminalCartonFileStore} from './terminalCartonStore.mjs';
import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {createCleanTerminalCartonService,cleanCartonInvoice,cleanCartonRequestAllowed} from './cleanTerminalCartonService.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'};Object.assign(process.env,environment);
const identity={databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID};registerCleanContext(identity,environment);
const actor={id:50101,username:'fixture-packer',role:{id:30,code:'clean_test_personnel'},permissions:['sales.view']};
function sourceRows(){const item={productId:'1',stockCode:'0007 FIXTURE',name:'Fixture',quantityExact3:'2.000',unit:{label:'ADET',factorExact8:'1.00000000'}};return [[{id:'80',documentNo:'FIXTURE80',customerName:'Fixture',status:'finalized',previewJson:JSON.stringify({items:[item]})}],[{...item,itemId:'81',currentUnit:'ADET'}],[{productId:'1',barcode:'0000007'},{productId:'1',barcode:'0000008'}],[]];}
function fixture(actualStore){
 const state={packing:true,accepted:true,rows:sourceRows(),calls:[],active:false};
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');assert.equal(state.active,false);state.active=true;state.calls.push('begin');}async commit(){assert.equal(state.active,true);state.calls.push('commit');state.active=false;}async rollback(){state.calls.push('rollback');state.active=false;}}
 class Request{constructor(tx){assert.equal(state.active,true);this.params={};}input(k,t,v){this.params[k]=v;return this;}async execute(name){assert.equal(name,'dbo.usp_clean_personnel_work_actor');state.calls.push('proof');return {recordset:[{accepted:state.accepted,environmentId:CLEAN_ENVIRONMENT_ID,actorId:actor.id,username:actor.username,roleId:30,roleCode:actor.role.code,employeeId:60101,canTerminalPacking:state.packing,canTerminalSale:false}]};}async query(sql){assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/);if(sql.includes('sp_getapplock')){state.calls.push('lock');return {};}assert.equal(this.params.actor,actor.id);assert.match(sql,/l\.actor_id=@actor/);state.calls.push('source');return sql.includes('TOP(50)')?{recordset:[{id:'80'}]}:{recordsets:state.rows};}}
 const driver={BigInt:'bigint',Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'}};
 const store={async load(){assert.equal(state.active,true);state.calls.push('load');return {cartons:[]};},async save(){assert.equal(state.active,true);state.calls.push('save');return {cartons:[]};}};
 const service=createCleanTerminalCartonService({store:actualStore??store,dependencies:async()=>({getSqlPool:async()=>({request:()=>({query:async()=>({recordset:[identity]})})}),getSqlDriver:()=>driver})});return {service,state};
}
test('native proof encloses durable carton journal, exact replay and revocation without a second publication',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'melisa-clean-carton-'));t.after(()=>rm(directory,{recursive:true,force:true}));let state;
 const store=createTerminalCartonFileStore({directory,filesystemRootForOfflineTests:true,assertDirectory:async()=>assert.equal(state.active,true)}),f=fixture(store);state=f.state;
 const loaded=await f.service.load('80',actor),body={requestId:'b649bb96-733e-450e-9c04-c5084e272054',sourceRevision:loaded.source.revision,expectedVersion:loaded.state.version,cartons:[{id:'one',label:'Koli1',allocations:[{itemId:'81',quantityExact3:'2.000'}]}]};
 const saved=await f.service.save('80',body,actor);assert.equal(saved.state.status,'READY');const file=path.join(directory,'actor-'+actor.id+'.json'),before=await readFile(file,'utf8');
 assert.equal((await f.service.save('80',body,actor)).state.replayed,true);assert.equal(await readFile(file,'utf8'),before);
 state.packing=false;await assert.rejects(f.service.save('80',body,actor),{statusCode:403});assert.equal(await readFile(file,'utf8'),before);
});
test('clean packing uses fresh personal task proof through source and journal in the same native transaction',async()=>{
 const {service,state}=fixture();const r=await service.load('80',actor);assert.deepEqual(r.source.items[0].barcodes,['0000007','0000008']);assert.equal(r.source.items[0].stockCode,'0007 FIXTURE');assert.deepEqual(state.calls,['begin','lock','proof','source','load','commit']);
 state.calls=[];state.packing=false;await assert.rejects(service.save('80',{}, {...actor,canTerminalPacking:true}),{statusCode:403});assert.deepEqual(state.calls,['begin','lock','proof','rollback']);assert.equal(state.active,false);
 state.calls=[];state.packing=true;state.accepted=false;await assert.rejects(service.list(actor),{statusCode:403});assert.deepEqual(state.calls,['begin','lock','proof','rollback']);
});
test('wrong roles, protected manager, sales.view alone and forged task claims cannot reach source or journal',async()=>{
 for(const a of [{...actor,role:{id:32,code:'clean_test_personnel_finance'}},{...actor,id:10018,role:{id:28,code:'clean_test_administrator'}},{...actor,isAdmin:true},{...actor,permissions:[]}]){const {service,state}=fixture();await assert.rejects(service.list(a),{code:'CARTON_FORBIDDEN'});assert.deepEqual(state.calls,[]);}
});
test('foreign/missing invoice, changed source, quarantine and unknown unit refuse without journal access',async()=>{
 for(const mutate of [r=>r[0]=[],r=>r[0][0].status='draft',r=>r[1][0].quantityExact3='3.000',r=>r[1][0].currentUnit='SERİ',r=>r[3].push({native_id:1}),r=>r[0][0].previewJson='{broken']){const {service,state}=fixture();mutate(state.rows);await assert.rejects(service.load('80',actor));assert.equal(state.calls.includes('load'),false);assert.equal(state.calls.at(-1),'rollback');}
});
test('only exact clean main API carton paths/methods are admitted; original servers are not opened',()=>{
 const req=(method,path)=>({method,path});for(const path of ['/api/terminal-cartons/receipts','/api/terminal-cartons/receipts/80'])assert.equal(cleanCartonRequestAllowed(req('GET',path),environment),true);
 assert.equal(cleanCartonRequestAllowed(req('POST','/api/terminal-cartons/receipts/80'),environment),true);
 for(const r of [req('POST','/api/terminal-cartons/receipts'),req('PUT','/api/terminal-cartons/receipts/80'),req('POST','/api/terminal-cartons/receipts/01'),req('POST','/api/terminal-cartons/receipts/80?actor=2')])assert.equal(cleanCartonRequestAllowed(r,environment),false);
 for(const port of ['4196','4184','4144'])assert.equal(cleanCartonRequestAllowed(req('POST','/api/terminal-cartons/receipts/80'),{...environment,API_PORT:port}),false);
});
