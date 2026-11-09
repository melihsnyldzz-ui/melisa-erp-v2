import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runWarehouseLifecycle,inspectWarehouseLifecycleUnknown,validateWarehouseExecutionBindings} from './lifecycle-runner.mjs';
import {compileWarehouseLifecycle} from './lifecycle-sql.mjs';
import {WAREHOUSE_LIFECYCLE_TARGET as T,WAREHOUSE_EXECUTION_DECISION_KEY,WAREHOUSE_EXECUTION_DECISION_PREFIX} from './lifecycle-contract.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),raw=x=>Buffer.from(JSON.stringify(x)),h='a'.repeat(64);
function fixture(action='activate'){
 const decision={warehouseContinuationExecution:{key:WAREHOUSE_EXECUTION_DECISION_KEY,sha256:T.proposalSha256,decision:WAREHOUSE_EXECUTION_DECISION_PREFIX+' SYNTHETIC IN-MEMORY TEST ONLY'}};
 const decisionBytes=raw(decision),now=1000000,readback={state:'WAREHOUSE_LIFECYCLE_READ_ONLY_PHASE_OBSERVATION',userId:'30007',roleId:'10',active:action==='deactivate',userRowVersion:action==='activate'?T.initialUserVersion:'0x0000000000200000',protectedUserSha256:T.protectedUserSha256,inventorySha256:h,permissionRowsSha256:h,membershipsSha256:h,principalsSha256:h,auditCount:225,observedAtMs:now};
 const readbackBytes=raw(readback),plan=compileWarehouseLifecycle({action}),bindings={state:'WAREHOUSE_LIFECYCLE_PHASE_EXECUTION_BINDINGS',action,preparationOnly:false,prerequisitesVerified:true,prerequisiteProofSha256:h,proposalSha256:T.proposalSha256,historicalBaselineSha256:T.baselineSha256,runtimeHead:T.runtimeHead,packageSha256:T.packageSha256,sourceCount:317,lifecycleId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',observedAt:now,expiresAt:now+300000,decisionSha256:sha(decisionBytes),phaseReadbackSha256:sha(readbackBytes),runtimeProofSha256:h,sqlSha256:plan.sqlSha256,guardSqlSha256:plan.guardSqlSha256,compiledPlanSha256:sha(raw(plan))};
 const f={mode:'Execute',action,bindings,decision,decisionBytes,readback,readbackBytes,phaseBindingSha256:'b'.repeat(64),now};
 if(action==='deactivate'){const a={state:'WAREHOUSE_CONTINUATION_ACTIVATION_INDEPENDENTLY_VERIFIED',active:true,lifecycleId:bindings.lifecycleId,proposalSha256:T.proposalSha256,decisionSha256:bindings.decisionSha256,sourceHead:T.runtimeHead,packageSha256:T.packageSha256,userId:'30007',roleId:'10',roleRowVersion:T.roleVersion,userRowVersion:readback.userRowVersion,runtimeProofSha256:T.readyProofSha256,auditId:'244',observedAtMs:now-1000};f.activationReceipt=a;f.activationReceiptBytes=raw(a);bindings.activationReceiptSha256=sha(f.activationReceiptBytes);}
 return f;
}
function memoryAdapter({loseAck=false,failCas=false}={}){
 const intents=new Map(),outcomes=new Map(),counts={exec:0,reads:0,audits:0};return {counts,intents,outcomes,async createNew(k,v){if(intents.has(k))throw Error('EXISTS');intents.set(k,structuredClone(v));},async executeTypedOnce(plan,p){counts.exec++;if(failCas)throw Error('CAS');counts.audits++;if(loseAck)throw Error('ACK_LOST');return {state:'WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK',action:plan.action,lifecycleId:p.lifecycleId,userId:'30007',roleId:'10',oldUserVersion:p.expectedUserVersion,userRowVersion:'0x0000000000200001',active:plan.action==='activate',auditId:'244',auditCount:p.expectedAuditCount+1,decisionSha256:p.decisionSha256,proposalSha256:p.proposalSha256,phaseBindingSha256:p.phaseBindingSha256};},async persistOutcomeNew(k,v){if(outcomes.has(k))throw Error('EXISTS');outcomes.set(k,v);},async readCurrent(){counts.reads++;return {active:true,userId:'30007'};}};
}
test('default preparation never calls even an injected adapter; missing authority fails before I/O',async()=>{
 const poison=new Proxy({},{get(){throw Error('IO_ATTEMPT');}});const p=await runWarehouseLifecycle({},poison);assert.equal(p.executionReady,false);assert.equal(p.sqlConnections,0);await assert.rejects(runWarehouseLifecycle({mode:'Execute',action:'activate'},poison),/FUTURE_BINDINGS/);
});
test('preparation-only proposal, bad byte hashes, stale source, expired readback reject with zero calls',async()=>{
 for(const change of [f=>f.bindings.preparationOnly=true,f=>f.decision.warehouseContinuationExecution.sha256=h,f=>f.bindings.decisionSha256=h,f=>f.bindings.runtimeHead='0'.repeat(40),f=>f.now=f.bindings.expiresAt,f=>f.readback.userRowVersion='0x0000000000111ED1',f=>f.bindings.guardSqlSha256=h,f=>f.bindings.phaseReadbackSha256=h]){const f=fixture(),a=memoryAdapter();change(f);await assert.rejects(runWarehouseLifecycle(f,a));assert.deepEqual(a.counts,{exec:0,reads:0,audits:0});assert.equal(a.intents.size,0);}
});
test('activation is one CAS+one audit only; duplicate attempt cannot dispatch again',async()=>{
 const f=fixture(),a=memoryAdapter();const result=await runWarehouseLifecycle(f,a);assert.equal(result.state,'WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK');assert.equal(result.active,true);assert.deepEqual(a.counts,{exec:1,reads:0,audits:1});await assert.rejects(runWarehouseLifecycle(f,a),/EXISTS/);assert.equal(a.counts.exec,1);
});
test('lost acknowledgement is UNKNOWN with immutable intent and no automatic mutation retry',async()=>{
 const f=fixture(),a=memoryAdapter({loseAck:true});const result=await runWarehouseLifecycle(f,a);assert.equal(result.state,'WAREHOUSE_LIFECYCLE_UNKNOWN_NO_RETRY');assert.equal(result.requestResubmitted,false);await assert.rejects(runWarehouseLifecycle(f,a),/EXISTS/);const inspected=await inspectWarehouseLifecycleUnknown({action:f.action,lifecycleId:f.bindings.lifecycleId},a);assert.equal(inspected.state,'WAREHOUSE_LIFECYCLE_READBACK_ONLY_NOT_AUTOMATICALLY_ACCEPTED');assert.deepEqual(a.counts,{exec:1,reads:1,audits:1});
});
test('server CAS failure never fabricates audit/commit; outcome requires independent reconciliation',async()=>{
 const a=memoryAdapter({failCas:true}),f=fixture();const out=await runWarehouseLifecycle(f,a);assert.equal(out.state,'WAREHOUSE_LIFECYCLE_UNKNOWN_NO_RETRY');assert.deepEqual(a.counts,{exec:1,reads:0,audits:0});
});
test('deactivation requires independently verified activation with matching actual fresh RV and exact raw receipt',async()=>{
 const f=fixture('deactivate');assert.equal(validateWarehouseExecutionBindings(f).values.expectedUserVersion,'0x0000000000200000');const a=memoryAdapter();assert.equal((await runWarehouseLifecycle(f,a)).active,false);assert.equal(a.counts.audits,1);
 for(const change of [x=>delete x.activationReceipt,x=>x.activationReceipt.state='WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK',x=>x.activationReceipt.userRowVersion=T.initialUserVersion,x=>x.activationReceipt.runtimeProofSha256=h,x=>x.bindings.activationReceiptSha256=h]){const x=fixture('deactivate'),a=memoryAdapter();change(x);await assert.rejects(runWarehouseLifecycle(x,a));assert.equal(a.counts.exec,0);}
});
