import test from 'node:test';
import assert from 'node:assert/strict';
import {isCleanPersonalWorkCandidate,proveCleanPersonalWorkActor,bindCleanPersonnelWrite,cleanPersonnelOptions} from './cleanPersonnelManagement.mjs';
import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {createTerminalCartonService} from './terminalCartonService.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'};
Object.assign(process.env,environment);
registerCleanContext({databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID},environment);
const actor=(id=50101,roleId=30)=>({id,username:'fixture-packer',role:{id:roleId,code:roleId===31?'clean_test_personnel_manager':roleId===32?'clean_test_personnel_finance':'clean_test_personnel'},permissions:['sales.view']});
function driver(row){return {BigInt:'bigint',Request:class{input(){return this;}async execute(){return {recordset:[row]};}}};}
const proof=a=>({accepted:true,environmentId:CLEAN_ENVIRONMENT_ID,actorId:a.id,username:a.username,roleId:a.role.id,roleCode:a.role.code,employeeId:60101,canTerminalSale:true,canTerminalPacking:true});

test('minimum SQL login discovers packing via sealed native ready proof without VIEW DEFINITION',async()=>{
 let nativeInvoked=false;const pool={request:()=>({query:async query=>{
  // Real minimum-login evidence: the column and executable guard are visible,
  // while OBJECT_DEFINITION(bind/guard/actor) is NULL. Do not grant metadata access.
  nativeInvoked=query.includes('EXEC dbo.usp_clean_personnel_packing_ready;');
  return {recordsets:[[{ready:true}],[],[{personalWorkReady:true}],[{packingTaskSupported:nativeInvoked}]]};
 }})};
 assert.equal((await cleanPersonnelOptions(pool)).packingTaskSupported,true);assert.equal(nativeInvoked,true);
 const rejected={request:()=>({query:async()=>{throw Object.assign(Error('sealed metadata mismatch'),{number:51980});}})};
 await assert.rejects(cleanPersonnelOptions(rejected),{number:51980});
});
test('packing candidate excludes finance, sample users, admin flags and absent permissions',()=>{
 for(const r of [30,31])assert.equal(isCleanPersonalWorkCandidate(actor(50101,r),'packing'),true);
 for(const a of [actor(50101,32),actor(15),{...actor(),isAdmin:true},{...actor(),isActive:false},{...actor(),permissions:[]}])assert.equal(isCleanPersonalWorkCandidate(a,'packing'),false);
});
test('fresh native task proof, never a client task or a general sales permission, controls packing',async()=>{
 const a={...actor(),canTerminalPacking:true};
 assert.equal((await proveCleanPersonalWorkActor({},driver(proof(a)),a,'packing')).canTerminalPacking,true);
 for(const value of [false,undefined,null,1,'true'])await assert.rejects(proveCleanPersonalWorkActor({},driver({...proof(a),canTerminalPacking:value}),a,'packing'),{statusCode:403});
 for(const row of [{...proof(a),accepted:false},{...proof(a),actorId:999},{...proof(a),employeeId:null},{...proof(a),roleId:32}])await assert.rejects(proveCleanPersonalWorkActor({},driver(row),a,'packing'),{statusCode:403});
});
test('revoking the fresh task denies a previously accepted actor and grants no cached capability',async()=>{
 const a=actor(),row=proof(a),q=driver(row);
 await proveCleanPersonalWorkActor({},q,a,'packing');row.canTerminalPacking=false;
 await assert.rejects(proveCleanPersonalWorkActor({},q,a,'packing'),{statusCode:403});
});
test('normal employee binding includes explicit true/false only; old payload stays unchanged',async()=>{
 const manager={id:10018,username:'semih',role:{id:28,code:'clean_test_administrator'},permissions:['settings.manage']},seen=[];
 class Request{constructor(){this.params={};}input(k,t,v){this.params[k]=v;return this;}async execute(){seen.push(JSON.parse(this.params.payload_json));return {recordset:[{accepted:true,actorId:10018,operation:'employee_update'}]};}}
 const q={Request,BigInt:'bigint',NVarChar:()=>'',MAX:'MAX'},payload={userId:50101};
 for(const value of [true,false]){await bindCleanPersonnelWrite({},q,manager,'employee_update',{...payload,canTerminalPacking:value},60101);assert.equal(seen.at(-1).canTerminalPacking,value);}
 await bindCleanPersonnelWrite({},q,manager,'employee_update',payload,60101);assert.equal(Object.hasOwn(seen.at(-1),'canTerminalPacking'),false);
 for(const value of ['true',1,null])await assert.rejects(bindCleanPersonnelWrite({},q,manager,'employee_update',{...payload,canTerminalPacking:value},60101),{statusCode:400});
});
test('existing carton service repeats native personal-task proof before source and storage; a stale client flag cannot grant access',async()=>{
 const a={...actor(),canTerminalPacking:true},row=proof(a),calls=[];
 const invoice={id:'80',status:'finalized',documentNo:'FIXTURE-80',customerId:'90',items:[{itemId:'1',productId:'1',stockCode:'0007 FIXTURE',name:'Fixture',quantityExact3:'2.000',unit:{label:'ADET',factorExact8:'1.00000000',verified:true},barcodes:['0000007']}]};
 const service=createTerminalCartonService({assertContext:async(user,kind)=>{calls.push('proof');assert.equal(kind,'packing');return proveCleanPersonalWorkActor({},driver(row),user,kind);},readSource:async()=>{calls.push('source');return invoice;},store:{load:async()=>{calls.push('load');return {};},save:async()=>{calls.push('save');return {};}}});
 await service.load('80',a);assert.deepEqual(calls,['proof','source','load']);calls.length=0;
 row.canTerminalPacking=false;await assert.rejects(service.save('80',{},a),{statusCode:403});assert.deepEqual(calls,['proof']);
 const falseProof=createTerminalCartonService({assertContext:async()=>({actorId:999,canTerminalPacking:true}),readSource:async()=>{throw Error('must not read');},store:{}});
 await assert.rejects(falseProof.load('80',a),{code:'CARTON_FORBIDDEN'});
});
