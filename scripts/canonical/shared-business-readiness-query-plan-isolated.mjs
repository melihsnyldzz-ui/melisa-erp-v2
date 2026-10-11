// Evidence harness, not a provisioner/installer. The injected adapter must own
// a separately provisioned exact proof clone; there is no default SQL adapter.
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {readinessProofTarget,READINESS_PROOF_DATABASE,READINESS_PROOF_LOGIN} from './shared-business-readiness-query-plan-revision.mjs';
const check=(v,c)=>{if(!v)throw Error(c);};
const exact=(o,k)=>o&&Object.keys(o).sort().join(',')===k.toSorted().join(',');
const hex=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
export const READINESS_PROOF_NEGATIVES=Object.freeze([
 ['party_currency','STAGE4_PARTY_SCOPE_DRIFT'],['party_identity','STAGE4_PARTY_SCOPE_DRIFT'],['party_hold','STAGE4_PARTY_SCOPE_DRIFT'],
 ['missing_source_account','BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT'],['unknown_balance','BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT'],['ll_account','BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT'],
 ['permission_drift','STAGE4_ACTOR_SCOPE_DRIFT'],['stock_drift','STAGE4_PRODUCT_SCOPE_DRIFT'],['price_drift','STAGE4_PRODUCT_SCOPE_DRIFT'],
 ['registry_hash_drift','READINESS_QUERY_PLAN_DEFINITION_DRIFT'],['disabled_query_plan_trigger','READINESS_QUERY_PLAN_REGISTRY_DRIFT']
]);
// A preserved upstream rejection proves the business boundary, not execution
// of the readiness predicate. The layer is explicit and compared in both runs.
export const READINESS_PROOF_NEGATIVE_LAYERS=Object.freeze(Object.fromEntries(READINESS_PROOF_NEGATIVES.map(([kind])=>[kind,Object.freeze(kind==='permission_drift'?['native_actor']:kind==='stock_drift'?['native_effects']:kind==='party_hold'?['actual_ready','upstream_native_business']:['registry_hash_drift','disabled_query_plan_trigger'].includes(kind)?['actual_ready']:['actual_ready','upstream_native_business'])])));
function proofIdentity(x,p){
 check(exact(x,['server','database','originalLogin','copyId','actualT1','dbOwner','sysadmin','accessShared','accessTest125','accessLive','sourceDefinitionHash','protectedSchemaHash','businessHash','permissionsHash','registryHistoryHash'])&&x.server===p.target.server&&x.database===READINESS_PROOF_DATABASE&&x.originalLogin===READINESS_PROOF_LOGIN&&x.copyId===p.target.copyId&&x.actualT1===false&&x.dbOwner===1&&x.sysadmin===0&&x.accessShared===0&&x.accessTest125===0&&x.accessLive===0&&x.sourceDefinitionHash===p.sharedBeforeHash&&['protectedSchemaHash','businessHash','permissionsHash','registryHistoryHash'].every(k=>hex(x[k])),'READINESS_PROOF_IDENTITY');
}
function observation(x){
 check(exact(x,['result','elapsedMs','queryPlanSha256','logicalReads','sourceContributionHash','actorPermissionsHash'])&&x.result==='READY'&&Number.isFinite(x.elapsedMs)&&x.elapsedMs>=0&&Number.isSafeInteger(x.logicalReads)&&x.logicalReads>=0&&['queryPlanSha256','sourceContributionHash','actorPermissionsHash'].every(k=>hex(x[k])),'READINESS_PROOF_OBSERVATION');return x;
}
export async function validateIsolatedReadinessQueryPlan({bundle,target,adapter}={}){
 const proof=readinessProofTarget(bundle,target);
 check(adapter&&['inspect','beginRollbackOnly','snapshot','installTemporaryRevision','observeReady','negativeProbe','rollback','assertEnded'].every(k=>typeof adapter[k]==='function')&&adapter.commit===undefined,'READINESS_PROOF_ADAPTER');
 if(adapter.unsupportedNegativeKinds!==undefined){
  check(Array.isArray(adapter.unsupportedNegativeKinds)&&new Set(adapter.unsupportedNegativeKinds).size===adapter.unsupportedNegativeKinds.length&&adapter.unsupportedNegativeKinds.every(k=>READINESS_PROOF_NEGATIVES.some(n=>n[0]===k)),'READINESS_PROOF_PREREQUISITE_SHAPE');
  check(adapter.unsupportedNegativeKinds.length===0,'READINESS_PROOF_NATIVE_PREREQUISITES_'+adapter.unsupportedNegativeKinds.join('_'));
 }
 const identity=await adapter.inspect();proofIdentity(identity,proof);
 const before=await adapter.snapshot();check(hex(before),'READINESS_PROOF_SNAPSHOT');const observations=[],negativeResults=[];
 // Same identity overlay and appended guard in both controls. Only the four
 // measured query changes differ; neither alters historical registry rows.
 for(const [variant,executionSQL,storedDefinition,afterHash]of[['baseline',proof.baselineExecutionSQL,proof.baselineStoredDefinition,proof.proofBaselineHash],['candidate',proof.candidateExecutionSQL,proof.candidateStoredDefinition,proof.proofAfterHash]]){
  let transaction;
  try{
   transaction=await adapter.beginRollbackOnly();check(transaction,'READINESS_PROOF_TRANSACTION');
   const {revisionHash,...sourceRevision}=bundle.revision;
   const proofRevision={...sourceRevision,modules:[{...sourceRevision.modules[0],afterHash}],immutableTriggerHash:proof.proofTriggerHash};
   await adapter.installTemporaryRevision(transaction,{variant,executionSQL,storedDefinition,tableSQL:proof.tableSQL,immutableSQL:proof.immutableSQL,afterHash,triggerHash:proof.proofTriggerHash,revision:{...proofRevision,revisionHash:isolatedCopyHash(proofRevision)},proofOnly:true});
   const values=[];for(let i=0;i<3;i++)values.push(observation(await adapter.observeReady(transaction,{variant,copyId:target.copyId,collectActualPlan:true})));
   check(new Set(values.map(v=>v.sourceContributionHash)).size===1&&new Set(values.map(v=>v.actorPermissionsHash)).size===1,'READINESS_PROOF_UNSTABLE_SOURCE');observations.push({variant,values});
  }finally{if(transaction)await adapter.rollback(transaction);}
  await adapter.assertEnded();check(await adapter.snapshot()===before,'READINESS_PROOF_ROLLBACK_DRIFT');
  // A trigger THROW can doom the transaction. Never claim that a savepoint was
  // restored: each negative gets its own installation and full rollback.
  for(const [kind,expected]of READINESS_PROOF_NEGATIVES){
   let negativeTransaction;
   try{
    negativeTransaction=await adapter.beginRollbackOnly();check(negativeTransaction,'READINESS_PROOF_TRANSACTION');
    const {revisionHash,...sourceRevision}=bundle.revision;
    const proofRevision={...sourceRevision,modules:[{...sourceRevision.modules[0],afterHash}],immutableTriggerHash:proof.proofTriggerHash};
    await adapter.installTemporaryRevision(negativeTransaction,{variant,executionSQL,storedDefinition,tableSQL:proof.tableSQL,immutableSQL:proof.immutableSQL,afterHash,triggerHash:proof.proofTriggerHash,revision:{...proofRevision,revisionHash:isolatedCopyHash(proofRevision)},proofOnly:true});
    const result=await adapter.negativeProbe(negativeTransaction,{kind,variant,fullRollbackRequired:true});
    // Match the baseline's actual code, rather than assuming an old guard's
    // spelling. New query-plan guards have their own exact expected codes.
    check(exact(result,['rejected','errorCode','layer','readinessPredicateExercised','transactionState',...(result.predicateKind===undefined?[]:['predicateKind'])])&&result.rejected===true&&READINESS_PROOF_NEGATIVE_LAYERS[kind].includes(result.layer)&&result.readinessPredicateExercised===(result.layer==='actual_ready')&&[-1,0,1].includes(result.transactionState)&&typeof result.errorCode==='string'&&/^[A-Z0-9_]+$/.test(result.errorCode)&&(result.predicateKind===undefined||(result.predicateKind==='composite_source_witness'&&['missing_source_account','unknown_balance'].includes(kind)&&result.layer==='actual_ready'&&result.errorCode==='BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT')),'READINESS_PROOF_NEGATIVE');
    if(kind.startsWith('registry_')||kind==='disabled_query_plan_trigger')check(result.errorCode===expected,'READINESS_PROOF_NEW_GUARD');
    negativeResults.push({variant,kind,...result});
   }finally{if(negativeTransaction)await adapter.rollback(negativeTransaction);}
   await adapter.assertEnded();check(await adapter.snapshot()===before,'READINESS_PROOF_ROLLBACK_DRIFT');
  }
 }
 const [baseline,candidate]=observations;
 check(baseline.values[0].sourceContributionHash===candidate.values[0].sourceContributionHash&&baseline.values[0].actorPermissionsHash===candidate.values[0].actorPermissionsHash,'READINESS_PROOF_EQUIVALENCE');
 for(const [kind]of READINESS_PROOF_NEGATIVES){const a=negativeResults.find(x=>x.variant==='baseline'&&x.kind===kind),b=negativeResults.find(x=>x.variant==='candidate'&&x.kind===kind);check(a.errorCode===b.errorCode&&a.layer===b.layer&&a.readinessPredicateExercised===b.readinessPredicateExercised&&a.predicateKind===b.predicateKind,'READINESS_PROOF_NEGATIVE_EQUIVALENCE');}
 const finalIdentity=await adapter.inspect();proofIdentity(finalIdentity,proof);check(isolatedCopyHash(identity)===isolatedCopyHash(finalIdentity),'READINESS_PROOF_FINAL_IDENTITY_DRIFT');
 return {schemaVersion:'melisa-isolated-readiness-query-plan-observation.v1',database:READINESS_PROOF_DATABASE,sourceDatabase:target.sourceDatabase,revisionHash:bundle.revision.revisionHash,observations,negativeResults,rolledBack:true,protectedSnapshotUnchanged:true,installAllowed:false,sharedChanges:0,readyForSharedActivation:false,requiresRuntimeConsumerIntegration:true};
}
