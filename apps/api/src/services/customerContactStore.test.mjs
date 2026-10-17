import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
import * as copyModel from './isolatedOperationCopyContext.mjs';
import * as contactModel from './customerContactModel.mjs';
import * as contract from '../../../../scripts/canonical/shared-business-customer-contact-contract.mjs';
import {contactFixture} from './customerContact.test-fixture.mjs';

// This module models the registered native interface inside an isolated VM.
// Its private test WeakMap never registers a production/native capability.
async function harness({earned=true}={}){
 const f=contactFixture(),events=[],registry=new WeakMap();if(earned)registry.set(f.copy,f.registered);
 const state={copy:f.copy,replayed:false,ownerError:null,metaMutate:()=>{},rowMutate:()=>{},verifyError:null,verifySwap:false};let tx,metadataReads=0,proofs=0;
 const sql={ISOLATION_LEVEL:{SERIALIZABLE:4},UniqueIdentifier:'uuid',BigInt:'bigint',MAX:-1,NVarChar:n=>'text'+n};
 sql.Transaction=class{constructor(){tx=this;events.push('transaction');}async begin(level){assert.equal(level,4);events.push('begin');}async commit(){events.push('commit');}async rollback(){events.push('rollback');}};
 sql.Request=class{
  constructor(parent){this.parent=parent;assert.equal(parent,tx);this.values={};}
  input(key,_type,value){this.values[key]=value;return this;}
  async query(text){
   assert(!/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(text),'Node adapter must never issue DML or DDL');
   if(text.includes('sp_getapplock')){events.push(text.includes("N'Exclusive'")?'exclusive':'shared');assert.equal(this.values.lockKey,'melisa-stage4-copy:'+f.copy.copyId);return {recordset:[]};}
   assert.equal(text,module.namespace.CUSTOMER_CONTACT_TRANSACTION_SQL);events.push('metadata');
   const row={db:f.copy.target.database,server:f.copy.target.server,login:f.copy.target.login,databaseUser:f.copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'9007199254740993',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:events.includes('exclusive')?'Exclusive':'Shared'};
   state.metaMutate(row,++metadataReads);return {recordset:[row]};
  }
  async execute(name){
   assert([contract.CUSTOMER_CONTACT_CONTEXT,contract.CUSTOMER_CONTACT_UPDATE].includes(name));assert.equal(this.values.copy_id,f.copy.copyId);assert.equal(this.values.customer_id,'100');assert.equal(this.values.actor_id,'17');events.push(name);
   let context=structuredClone(f.context);
   if(name===contract.CUSTOMER_CONTACT_UPDATE){if(state.ownerError)throw state.ownerError;const body=JSON.parse(this.values.payload_json);assert.equal(body.customerId,'100');context.contact={phone:body.phone,city:body.city,country:body.country};context.revision=state.replayed?body.expectedRevision:'D'.repeat(64);}
   const row={context_json:JSON.stringify(context),actor_json:JSON.stringify(f.nativeActor),replayed:name===contract.CUSTOMER_CONTACT_UPDATE&&state.replayed,sessionId:91,transactionId:'9007199254740993',readerDefinitionHash:'A'.repeat(64)};
   state.rowMutate(name,row);return {recordsets:[[row]]};
  }
 };
 const sandbox=createContext({Buffer});
 const synthetic=(name,exports)=>new SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context:sandbox,identifier:name});
 // Real parser checks still execute; only plain JSON records cross VM realms.
 const model={...contactModel,parseCustomerContact:(id,body)=>contactModel.parseCustomerContact(id,Object.fromEntries(Object.entries(body)))};
 const modules=new Map([
  ['./isolatedOperationCopyContext.mjs',synthetic('copy-model',copyModel)],
  ['./customerContactModel.mjs',synthetic('contact-model',model)],
  ['../../../../scripts/canonical/shared-business-customer-contact-contract.mjs',synthetic('contract',contract)],
 ]);
 const native=synthetic('modeled-native-bootstrap',{
  getRegisteredCustomerContactRevision:copy=>registry.get(copy)??null,
  verifyCustomerContactRevision:async(copy,request,{write})=>{assert.equal(copy,f.copy);assert.equal(request.parent,tx);assert.equal(request.values.copy_id,f.copy.copyId);assert.equal(write,events.includes('exclusive'));events.push('native-proof');proofs++;if(state.verifyError)throw state.verifyError;return state.verifySwap?{...f.registered}:registry.get(copy);},
 });await native.link(()=>{throw Error('No native imports');});await native.evaluate();
 const source=await readFile(new URL('./customerContactStore.mjs',import.meta.url),'utf8');
 const module=new SourceTextModule(source,{context:sandbox,importModuleDynamically:async name=>{assert.equal(name,'../../../../scripts/canonical/shared-business-customer-contact-bootstrap.mjs');return native;}});
 await module.link(name=>{assert(modules.has(name),'Unexpected store dependency');return modules.get(name);});await module.evaluate();
 const runtime={getRuntime:async()=>({copyContext:state.copy,pool:{},sql,registered:true,canEdit:true,customerContactRevision:f.registered})};
 return {...f,state,events,api:module.namespace,store:module.namespace.createCustomerContactStore(runtime),proofCount:()=>proofs,nativeExecution:false};
}
const run=(h,write,fn)=>h.store.withCustomerContact({customerId:'100',actor:h.actor,write},fn);
const failed=h=>{assert(h.events.includes('rollback'));assert(!h.events.includes('commit'));};

test('modeled native contact getter uses shared SERIALIZABLE frame and fresh proofs; writer pin is separate from global actors',async()=>{
 const h=await harness(),result=await run(h,false,session=>session.context);assert.equal(result.contact.phone,'001000000');assert.equal(result.accounts.map(row=>row.currency).join(','),'TRY,USD');assert.equal(h.proofCount(),2);assert(h.events.includes('shared'));assert(h.events.includes('commit'));assert(!h.events.includes('rollback'));assert.equal(h.copy.actors.some(actor=>actor.id==='17'),false);
});
test('modeled update sends one exact owner EXEC with canonical path-bound payload and preserves historical replay without a JS CAS check',async()=>{
 const h=await harness();h.state.replayed=true;const body={...h.body,expectedRevision:'B'.repeat(64)},payload=contactModel.parseCustomerContact('100',body).payloadJson;
 const result=await run(h,true,session=>session.update(payload));assert.equal(result.replayed,true);assert.equal(result.context.revision,'B'.repeat(64));assert.equal(h.proofCount(),3);assert(h.events.includes('exclusive'));assert.equal(h.events.filter(event=>event===contract.CUSTOMER_CONTACT_UPDATE).length,1);assert(h.events.includes('commit'));
});
test('raw runtime booleans, unregistered descriptors, cloned copies or the wrong scoped customer cannot start a transaction',async()=>{
 const h=await harness({earned:false});await assert.rejects(run(h,true,()=>{}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});assert.equal(h.events.length,0);
 const clone=await harness();clone.state.copy=structuredClone(clone.copy);await assert.rejects(run(clone,true,()=>{}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});assert.equal(clone.events.length,0);
 const foreign=await harness();await assert.rejects(foreign.store.withCustomerContact({customerId:'999',actor:foreign.actor,write:true},()=>{}),{code:'CUSTOMER_CONTACT_SCOPE'});assert.equal(foreign.events.length,0);
 const denied=await harness();await assert.rejects(denied.store.withCustomerContact({customerId:'100',actor:{...denied.actor,id:15},write:true},()=>{}),{code:'CUSTOMER_CONTACT_FORBIDDEN'});assert.equal(denied.events.length,0);
});
test('foreign DB/frame/lock, native procedure pin/session/transaction and replayed GET all roll back before callback',async()=>{
 const changes=[
  h=>{h.state.metaMutate=row=>{row.live=1;};},h=>{h.state.metaMutate=row=>{row.isolationLevel=2;};},h=>{h.state.metaMutate=row=>{row.copyLockMode='None';};},
  h=>{h.state.rowMutate=(_name,row)=>{row.sessionId=92;};},h=>{h.state.rowMutate=(_name,row)=>{row.transactionId='9007199254740994';};},h=>{h.state.rowMutate=(_name,row)=>{row.readerDefinitionHash='B'.repeat(64);};},h=>{h.state.rowMutate=(_name,row)=>{row.replayed=true;};},
 ];for(const change of changes){const h=await harness();change(h);let called=false;await assert.rejects(run(h,false,()=>{called=true;}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});assert.equal(called,false);failed(h);}
});
test('inactive current actor, permission revoke, role or native permission-row hash mismatch cannot reach a callback',async()=>{
 for(const change of [actor=>{actor.active=false;},actor=>{actor.permissions=['customer.view'];},actor=>{actor.nativeRoleCode='other';},actor=>{actor.permissionsRowsHash='B'.repeat(64);}]){
  const h=await harness();h.state.rowMutate=(_name,row)=>{const actor=JSON.parse(row.actor_json);change(actor);row.actor_json=JSON.stringify(actor);};let called=false;await assert.rejects(run(h,true,()=>{called=true;}),{code:'CUSTOMER_CONTACT_FORBIDDEN'});assert.equal(called,false);failed(h);
 }
});
test('altered identity, missing or merged currency links, unknown balances and masked native phone fail closed',async()=>{
 for(const change of [ctx=>{ctx.customerCode='OTHER';},ctx=>{ctx.sourceId='999';},ctx=>{ctx.accounts.pop();},ctx=>{ctx.accounts[1].currency='TRY';},ctx=>{ctx.balance='0';},ctx=>{ctx.contact.phone='0010****00';}]){
  const h=await harness();h.state.rowMutate=(_name,row)=>{const ctx=JSON.parse(row.context_json);change(ctx);row.context_json=JSON.stringify(ctx);};await assert.rejects(run(h,false,()=>{}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});failed(h);
 }
});
test('callback update is unavailable in read frames and after transaction disposal, with no extra owner SET',async()=>{
 const read=await harness(),payload=contactModel.parseCustomerContact('100',read.body).payloadJson;await assert.rejects(run(read,false,session=>session.update(payload)),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});failed(read);assert(!read.events.includes(contract.CUSTOMER_CONTACT_UPDATE));
 const h=await harness();let retained;await run(h,true,session=>{retained=session.update;});const before=h.events.length;await assert.rejects(retained(payload),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});assert.equal(h.events.length,before);
});
test('fresh proof failure or changed final frame rolls back; native numeric errors have fixed public mapping and no SQL text',async()=>{
 const stale=await harness();stale.state.ownerError={number:52113,message:'PRIVATE SQL CANARY'};await assert.rejects(run(stale,true,session=>session.update(contactModel.parseCustomerContact('100',stale.body).payloadJson)),error=>error.code==='CUSTOMER_CONTACT_STALE'&&!error.message.includes('PRIVATE'));failed(stale);
 const proof=await harness();proof.state.verifySwap=true;await assert.rejects(run(proof,true,()=>{}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});failed(proof);
 const after=await harness();after.state.metaMutate=(row,n)=>{if(n===2)row.transactionId='9007199254740994';};await assert.rejects(run(after,false,()=>{}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});failed(after);
 const privateError=await harness();privateError.state.verifyError=Error('PRIVATE SQL CANARY');await assert.rejects(run(privateError,false,()=>{}),error=>error.code==='CUSTOMER_CONTACT_UNAVAILABLE'&&!error.message.includes('PRIVATE'));failed(privateError);
});
test('six-column owner response rejects duplicate result rows, extra result sets or extra columns',async()=>{
 const h=await harness(),row={context_json:'{}',actor_json:'{}',replayed:false,sessionId:91,transactionId:'92',readerDefinitionHash:'A'.repeat(64)};assert.equal(h.api.customerContactProcedureRow({recordsets:[[row]]}),row);
 for(const recordsets of [[],[[row,row]],[[row],[{extra:'x'}]],[[{...row,extra:true}]],[[{...row,context_json:undefined}],[row]]])assert.throws(()=>h.api.customerContactProcedureRow({recordsets}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
});
