import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {createIsolatedOperationCopyStore} from './isolatedOperationCopyStore.mjs';
import {isIsolatedOperationCopyMutation} from './isolatedOperationCopyScope.mjs';
const actor={id:'16',permissions:['sales.view','sales.create']},requestId='164c6f4e-aa6c-4758-bc14-677ba55c0fc4';
function fixture(){
 const context=validateIsolatedOperationCopyContext(fixtureContext()),state={effects:0,journal:[],replayProofs:0,commits:0,rollbacks:0,invalidEffect:false,deny:false,wrongDB:false},normalContext={meta:{date:context.date,operationOrigin:context.operationOrigin,copyId:context.copyId,sealHash:context.sealHash},scope:{synthetic:false,operationOrigin:context.operationOrigin}};
 class Transaction{async begin(isolation){assert.equal(isolation,'SERIALIZABLE');this.before=structuredClone(state);}async commit(){state.commits++;}async rollback(){const counts={rollbacks:state.rollbacks+1};Object.assign(state,this.before,counts);}}
 class Request{constructor(parent){this.parent=parent;this.p={};}input(k,t,v){this.p[k]=v;return this;}async query(text){
  if(text.startsWith('SELECT DB_NAME'))return{recordset:[{...fixtureIdentity(context),...(state.wrongDB?{db:'MELISA_ERP_SIRKET_TEST_20260929_01'}:{})}]};
  if(text.includes('sp_getapplock'))return{recordset:[]};
  if(text.startsWith('SELECT actor_id'))return{recordset:state.journal.filter(r=>r.copy_id===this.p.copy_id&&r.request_id===this.p.request_id)};
  if(text.startsWith('INSERT dbo.stage4_copy_requests')){state.journal.push({...this.p});return{recordset:[]};}if(text.startsWith('DROP TABLE IF EXISTS #ReportRows'))return{recordsets:[[{id:'51',currency:'TRY',amount:'92.00000000'}],[{total:1}],[{currency:'TRY',amount:'92.00000000',debit:null,credit:null,recordCount:1}],[{knownLineCount:1,unknownLineCount:0}]]};throw Error('Unexpected SQL');
 }async execute(name){
  if(name.endsWith('_ready'))return{recordset:[]};
  if(name.endsWith('_context'))return{recordset:[{proof_json:JSON.stringify(fixtureProof(context)),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:state.deny?['sales.view']:actor.permissions}),context_json:JSON.stringify(normalContext)}]};
  if(name.endsWith('_begin'))return{recordset:[]};
  if(name.endsWith('_effects')){if(this.p.replay)state.replayProofs++;return{recordset:[{effect_proof_json:JSON.stringify({valid:!state.invalidEffect,copyId:context.copyId,sealHash:context.sealHash,requestId:this.p.request_id,actorId:String(this.p.actor_id),operation:this.p.operation,payloadHash:this.p.payload_hash,stockVerified:true,partyAccountsVerified:true,financeAccountsVerified:true,protectedRowsVerified:true})}]};}throw Error('Unexpected procedure');
 }}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},BigInt:'id',UniqueIdentifier:'uuid',Char:n=>'char'+n,NVarChar:n=>'nvarchar'+n,MAX:'MAX',Bit:'bit'},runtime={copyContext:context,pool:{},sql};
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,buildDomain:async({context,nativeContext})=>({context,createDraft:async()=>{assert.equal(isIsolatedOperationCopyMutation({database:runtime.copyContext.target.database,server:runtime.copyContext.target.server,user:runtime.copyContext.target.login,readOnly:false},nativeContext.transaction),true);state.effects++;return{id:'51'};}})});
 return{store,state,runtime};
}
test('same UUID/body replay independently verifies effects without repeating native mutation',async()=>{const f=fixture(),body={requestId,productId:'34765'},op=c=>c.createDraft();assert.deepEqual(await f.store.mutate(actor,'sale_draft',body,op),{id:'51'});assert.equal((await f.store.mutate(actor,'sale_draft',body,op)).replayed,true);assert.equal(f.state.effects,1);assert.equal(f.state.journal.length,1);assert.equal(f.state.replayProofs,1);await assert.rejects(f.store.mutate(actor,'sale_draft',{...body,productId:'99'},op),{statusCode:409});assert.equal(f.state.effects,1);});
test('native proof failure rolls back native effect and journal; replay proof failure is not accepted',async()=>{const f=fixture(),body={requestId};f.state.invalidEffect=true;await assert.rejects(f.store.mutate(actor,'sale_draft',body,c=>c.createDraft()));assert.equal(f.state.effects,0);assert.equal(f.state.journal.length,0);assert.equal(f.state.rollbacks,1);f.state.invalidEffect=false;await f.store.mutate(actor,'sale_draft',body,c=>c.createDraft());f.state.invalidEffect=true;await assert.rejects(f.store.mutate(actor,'sale_draft',body,c=>c.createDraft()));assert.equal(f.state.effects,1);});
test('wrong database, revoked permission and client profile substitution cause no mutation',async()=>{for(const mode of ['wrongDB','deny','profile']){const f=fixture();if(mode!=='profile')f.state[mode]=true;await assert.rejects(f.store.mutate(actor,'sale_draft',{requestId,...(mode==='profile'?{copyId:'client'}:{})},c=>c.createDraft()));assert.equal(f.state.effects,0);assert.equal(f.state.journal.length,0);}});

test('actual report entry point dispatches registered copy before the original database path',async()=>{const f=fixture();const {createWorkReportsReadStore}=await import('./workReportsReadStore.mjs');const {reportFilters}=await import('./workReportsModel.mjs');const store=createWorkReportsReadStore({getRuntime:async()=>f.runtime,classification:{reportBindings:()=>"[]"}});const result=await store.read(reportFilters({},new Date('2026-10-08T09:00:00Z')),{actor});assert.equal(result.total,1);assert.equal(result.copyMeta.copyId,f.runtime.copyContext.copyId);assert.equal(result.currencyTotals[0].amount,'92.00000000');assert.equal(f.state.effects,0);assert.equal(f.state.commits,1);await assert.rejects(store.read(reportFilters({},new Date('2026-10-08T09:00:00Z')),{actor:{...actor,permissions:[]}}));});
