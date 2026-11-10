// Narrow state machine; host ODBC adapter is lifecycle-root-runner.ps1.
// Import/default preparation never performs I/O. Tests inject inert memory adapters.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {WAREHOUSE_LIFECYCLE_TARGET as T,WAREHOUSE_LIFECYCLE_PARAMETER_TYPES as TYPES,WAREHOUSE_EXECUTION_DECISION_KEY,WAREHOUSE_EXECUTION_DECISION_PREFIX,requireWarehouseAction} from './lifecycle-contract.mjs';
import {compileWarehouseLifecycle} from './lifecycle-sql.mjs';
const fail=tag=>{throw Error('WAREHOUSE_'+tag);};
const same=(a,b,tag)=>{if(!isDeepStrictEqual(a,b))fail(tag);};
const hex=(x,n)=>typeof x==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(x);
const rv=x=>typeof x==='string'&&/^0x[0-9A-F]{16}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const warehouseLifecycleDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function warehouseLifecyclePreparation(){return {state:'WAREHOUSE_LIFECYCLE_PREPARED_NOT_EXECUTABLE',preparationOnly:true,executionReady:false,executionAuthorized:false,sqlConnections:0,target:T,actions:['activate','deactivate'],futureRequirements:['exact execution decision SHA','current phase/readback/runtime bindings','reviewed compiler/host/SQL pins','CreateNew action intent','independent post-CAS readback']};}
export function validateWarehouseExecutionBindings({action,bindings:b,decision:d,decisionBytes,phaseBindingSha256,readback:r,readbackBytes,activationReceipt:a,activationReceiptBytes,now}={}){
 requireWarehouseAction(action);if(action==='observe')fail('MUTATION_ACTION');
 if(!b||b.state!=='WAREHOUSE_LIFECYCLE_PHASE_EXECUTION_BINDINGS'||!d||!r)fail('FUTURE_BINDINGS_REQUIRED');
 const record=d.warehouseContinuationExecution;
 if(!record||record.key!==WAREHOUSE_EXECUTION_DECISION_KEY||record.sha256!==T.proposalSha256||typeof record.decision!=='string'||!record.decision.startsWith(WAREHOUSE_EXECUTION_DECISION_PREFIX))fail('DECISION_NOT_EXECUTION');
 if(!(decisionBytes instanceof Uint8Array)||!isDeepStrictEqual(JSON.parse(Buffer.from(decisionBytes).toString('utf8').replace(/^\uFEFF/,'')),d))fail('DECISION_SOURCE_BYTES');
 same(b.action,action,'PHASE_ACTION');same(b.proposalSha256,T.proposalSha256,'PROPOSAL');same(b.historicalBaselineSha256,T.baselineSha256,'HISTORICAL_BASELINE');
 same([b.runtimeHead,b.packageSha256,b.sourceCount],[T.runtimeHead,T.packageSha256,317],'RUNTIME_PACKAGE');
 if(!uuid(b.lifecycleId)||!Number.isSafeInteger(now)||!Number.isSafeInteger(b.observedAt)||!Number.isSafeInteger(b.expiresAt)||b.observedAt>now||b.expiresAt<=now||b.expiresAt-b.observedAt>300000)fail('FRESH_BINDINGS');
 for(const k of ['decisionSha256','phaseReadbackSha256','runtimeProofSha256','sqlSha256','guardSqlSha256','compiledPlanSha256'])if(!hex(b[k],64))fail('BOUND_SHA');
 same(b.decisionSha256,createHash('sha256').update(decisionBytes).digest('hex'),'DECISION_BYTES_DIGEST');
 if(b.prerequisitesVerified!==true||b.preparationOnly!==false||!hex(b.prerequisiteProofSha256,64)||!hex(phaseBindingSha256,64))fail('PREREQUISITES_NOT_READY');
 if(r.state!=='WAREHOUSE_LIFECYCLE_READ_ONLY_PHASE_OBSERVATION'||r.userId!=='30007'||r.roleId!=='10'||r.protectedUserSha256?.toLowerCase()!==T.protectedUserSha256||!rv(r.userRowVersion)||!Number.isSafeInteger(r.auditCount)||r.auditCount<223)fail('READBACK');
 if(!(readbackBytes instanceof Uint8Array)||!isDeepStrictEqual(JSON.parse(Buffer.from(readbackBytes).toString('utf8').replace(/^\uFEFF/,'')),r)||createHash('sha256').update(readbackBytes).digest('hex')!==b.phaseReadbackSha256||r.observedAtMs!==b.observedAt)fail('READBACK_SOURCE_BYTES');
 for(const k of ['inventorySha256','permissionRowsSha256','membershipsSha256','principalsSha256'])if(!hex(r[k]?.toLowerCase(),64))fail('READBACK_HASH');
 if(action==='activate'){same(r.active,false,'ACTIVATION_INACTIVE');same(r.userRowVersion,T.initialUserVersion,'ACTIVATION_INITIAL_RV');}
 else{
  if(!a||a.state!=='WAREHOUSE_CONTINUATION_ACTIVATION_INDEPENDENTLY_VERIFIED'||a.active!==true||!rv(a.userRowVersion))fail('INDEPENDENT_ACTIVATION_REQUIRED');
  same([a.proposalSha256,a.decisionSha256,a.sourceHead,a.packageSha256,a.userId,a.roleId,a.roleRowVersion],[T.proposalSha256,b.decisionSha256,T.runtimeHead,T.packageSha256,'30007','10',T.roleVersion],'ACTIVATION_BINDING');
  same(a.lifecycleId,b.lifecycleId,'ACTIVATION_LIFECYCLE');same(a.runtimeProofSha256,T.readyProofSha256,'ACTIVATION_RUNTIME');
  same(r.active,true,'DEACTIVATION_ACTIVE');same(r.userRowVersion,a.userRowVersion,'DEACTIVATION_ACTUAL_RV');
  if(!(activationReceiptBytes instanceof Uint8Array)||!isDeepStrictEqual(JSON.parse(Buffer.from(activationReceiptBytes).toString('utf8').replace(/^\uFEFF/,'')),a)||!hex(b.activationReceiptSha256,64)||b.activationReceiptSha256!==createHash('sha256').update(activationReceiptBytes).digest('hex'))fail('ACTIVATION_RECEIPT_DIGEST');
 }
 const plan=compileWarehouseLifecycle({action});same([b.sqlSha256,b.guardSqlSha256],[plan.sqlSha256,plan.guardSqlSha256],'COMPILED_SQL');
 const values={userId:'30007',roleId:'10',lifecycleId:b.lifecycleId,decisionSha256:b.decisionSha256,proposalSha256:T.proposalSha256,phaseBindingSha256,expectedUserVersion:r.userRowVersion,expectedInventorySha256:r.inventorySha256.toLowerCase(),expectedPermissionRowsSha256:r.permissionRowsSha256.toLowerCase(),expectedMembershipsSha256:r.membershipsSha256.toLowerCase(),expectedPrincipalsSha256:r.principalsSha256.toLowerCase(),expectedProtectedUserSha256:T.protectedUserSha256,expectedAuditCount:r.auditCount};
 if(!hex(values.phaseBindingSha256,64))fail('PHASE_BINDING_HASH');
 same(Object.keys(values),Object.keys(TYPES),'TYPED_PARAMETER_ORDER');
 return {plan,values,intent:{state:'WAREHOUSE_LIFECYCLE_ACTION_INTENT',action,lifecycleId:b.lifecycleId,decisionSha256:b.decisionSha256,proposalSha256:T.proposalSha256,phaseBindingSha256,phaseReadbackSha256:b.phaseReadbackSha256,sqlSha256:plan.sqlSha256,expectedUserVersion:r.userRowVersion,expectedInventorySha256:r.inventorySha256.toLowerCase()}};
}
export async function runWarehouseLifecycle(input={},adapter){
 if(input.mode!=='Execute')return warehouseLifecyclePreparation();
 const prepared=validateWarehouseExecutionBindings(input);
 if(!adapter||!['createNew','executeTypedOnce','readCurrent','persistOutcomeNew'].every(k=>typeof adapter[k]==='function'))fail('ROOT_ADAPTER_REQUIRED');
 // This succeeds exactly once per lifecycle/action. UNKNOWN is never resubmitted.
 const key=input.bindings.lifecycleId+'-'+input.action;
 await adapter.createNew(key,prepared.intent);
 let dispatched=false;
 try{
  dispatched=true;const result=await adapter.executeTypedOnce(prepared.plan,prepared.values);
  if(result?.state!=='WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK'||result.action!==input.action||result.userId!=='30007'||result.roleId!=='10'||result.lifecycleId!==input.bindings.lifecycleId||result.oldUserVersion!==prepared.values.expectedUserVersion||!rv(result.userRowVersion)||BigInt(result.userRowVersion)<=BigInt(result.oldUserVersion)||result.active!==(input.action==='activate')||!Number.isSafeInteger(Number(result.auditId))||Number(result.auditId)<=0||result.auditCount!==prepared.values.expectedAuditCount+1||result.decisionSha256!==prepared.values.decisionSha256||result.proposalSha256!==T.proposalSha256||result.phaseBindingSha256!==prepared.values.phaseBindingSha256)fail('CAS_RESULT_UNVERIFIED');
  await adapter.persistOutcomeNew(key,result);return result;
 }catch{
  const outcome={state:dispatched?'WAREHOUSE_LIFECYCLE_UNKNOWN_NO_RETRY':'WAREHOUSE_LIFECYCLE_NOT_DISPATCHED',action:input.action,lifecycleId:input.bindings.lifecycleId,requestResubmitted:false,independentReadbackRequired:true};
  await adapter.persistOutcomeNew(key,outcome);return outcome;
 }
}
export async function inspectWarehouseLifecycleUnknown({lifecycleId,action}={},adapter){
 if(!uuid(lifecycleId)||!['activate','deactivate'].includes(action)||typeof adapter?.readCurrent!=='function')fail('READ_RECONCILIATION');
 // Deliberately has no execute, UUID replacement, or automatic acceptance path.
 return {state:'WAREHOUSE_LIFECYCLE_READBACK_ONLY_NOT_AUTOMATICALLY_ACCEPTED',lifecycleId,action,observation:await adapter.readCurrent({lifecycleId,action}),requestResubmitted:false};
}
