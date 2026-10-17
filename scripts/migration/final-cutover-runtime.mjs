// Future explicitly approved TEST execution only. Import and PLAN perform no I/O.
import {hash} from './party-currency-readonly-plan.mjs';
import {check,units,exact,TARGET} from './goal73-supplier-delta.mjs';
import {verifyFinalCutoverPlan} from './final-cutover-plan.mjs';
import {verifyCollectorReceipt} from './final-cutover-collector.mjs';
export const DOMAINS=Object.freeze(['stock','price','account']);
export const childId=(plan,domain,inverse=false)=>`${plan.cutoverId}/${inverse?'INVERSE/':''}${domain}`;
export function authorizeFinalCutover(plan,collector,approval,action,{fixture=false,schemas=null}={}){
 verifyFinalCutoverPlan(plan);verifyCollectorReceipt(collector,plan);
 check(['APPLY','RESUME','INVERSE'].includes(action),'FINAL_ACTION');
 if(fixture)check(collector.actualT1===false&&collector.evidenceKind==='SYNTHETIC_OFFLINE'&&hash(approval?.fixtureSchemas)===hash(schemas)&&schemas?.nativeSchema?.startsWith('final_cutover_fixture_')&&schemas.journalSchema?.startsWith('final_cutover_fixture_'),'FINAL_NATIVE_FIXTURE_ONLY');
 else check(collector.actualT1===true&&collector.evidenceKind==='FROZEN_SOURCE','FINAL_ACTUAL_T1_REQUIRED');
 check(approval?.action===action&&approval.cutoverId===plan.cutoverId&&approval.planHash===plan.planHash&&approval.collectorHash===collector.collectorHash&&hash(approval.target)===hash(TARGET)&&approval.actorId&&/^[1-9]\d*$/.test(approval.actorId),'FINAL_APPROVAL');
 if(fixture)check(approval.recovery?.evidenceKind==='SYNTHETIC_NAMESPACE_RECOVERY'&&/^[a-f0-9]{64}$/.test(approval.recovery.checkpointHash??''),'FINAL_FIXTURE_RECOVERY');
 else check(approval.backup?.verifiedRestore===true&&approval.backup.database===TARGET.database&&approval.backup.server===TARGET.server&&/^[a-f0-9]{64}$/.test(approval.backup.sha256??''),'FINAL_RECOVERY_APPROVAL');
 check(/^[a-f0-9]{64}$/.test(approval.guardHash??'')&&/^[a-f0-9]{64}$/.test(approval.schemaHash??'')&&approval.exclusionsHash===hash(plan.excluded),'FINAL_CONTRACT_APPROVAL');
 return approval;
}
export function verifyChild(plan,domain,receipt,inverse=false){
 const {receiptHash,...body}=receipt;
 check(hash(body)===receiptHash&&receipt.id===childId(plan,domain,inverse)&&receipt.planHash===plan.planHash&&receipt.domain===domain&&receipt.status==='COMMITTED'&&receipt.inverse===inverse,'FINAL_CHILD_BINDING');
 const rows=plan.rows.filter(r=>r.kind===domain);
 check(receipt.effects.length===rows.length&&new Set(receipt.effects.map(e=>e.key)).size===rows.length,'FINAL_CHILD_COUNT');
 for(const r of rows){const e=receipt.effects.find(e=>e.key===r.key);check(e&&e.rowHash===hash(r)&&e.nativeId===r.nativeId&&e.delta===(r.kind==='price'?null:exact((inverse?-1n:1n)*units(r.delta)))&&e.operation===r.operation,'FINAL_CHILD_EFFECT');}
 return receipt;
}
export async function runFinalCutover(args){return run(args,false);}
export async function runFinalCutoverFixture(args){check(args.store?.evidenceKind==='SYNTHETIC_NATIVE_SQL','FINAL_NATIVE_FIXTURE_STORE');return run(args,true);}
async function run({plan,collector,store,mode='PLAN',approval=null},fixture){
 verifyFinalCutoverPlan(plan);verifyCollectorReceipt(collector,plan);
 if(mode==='PLAN')return {status:'SEALED_PREPARATION',planHash:plan.planHash,actualT1:collector.actualT1,domains:DOMAINS.map(domain=>({domain,id:childId(plan,domain),rows:plan.rows.filter(r=>r.kind===domain).length})),writes:0};
 authorizeFinalCutover(plan,collector,approval,mode,{fixture,schemas:store?.fixtureSchemas});
 await store.prepare(plan,collector,approval);
 const prior=await store.parent(plan);
 check(prior?.planHash===plan.planHash,'FINAL_PARENT_BINDING');
 check(!prior.inverseStarted||mode==='INVERSE','FINAL_INVERSE_RECOVERY_REQUIRED');
 check(prior.status!=='INVERSED'||mode==='INVERSE','FINAL_PARENT_INVERSED');
 if(prior.status==='STOPPED')check(mode==='RESUME'||mode==='INVERSE','FINAL_STOPPED_RECOVERY_REQUIRED');
 const partial=prior.status.startsWith('STOPPED')||prior.status.startsWith('APPLYING_')||prior.status.startsWith('INVERSE_');
 if(partial)check(mode==='RESUME'||mode==='INVERSE','FINAL_PARTIAL_RECOVERY_REQUIRED');
 if(mode==='RESUME')check(partial&&!prior.status.includes('INVERSE'),'FINAL_RESUME_STOPPED_ONLY');
 const inverse=mode==='INVERSE';
 if(inverse)check(prior.status!=='PREPARED','FINAL_INVERSE_PARENT_STATE');
 const domains=inverse?[...DOMAINS].reverse():DOMAINS;
 const receipts=[];let replayed=0,newEffects=0;
 try{
  for(const domain of domains){
   const applied=await store.child(plan,domain,false);
   if(inverse&&!applied)continue;
   if(applied)verifyChild(plan,domain,applied);
   let receipt=await store.child(plan,domain,inverse);
   if(receipt){verifyChild(plan,domain,receipt,inverse);replayed++;}
   else{
    await store.event(plan,inverse?'INVERSE_'+domain.toUpperCase():'APPLYING_'+domain.toUpperCase());
    receipt=await store.applyDomain(plan,domain,approval,{inverse,applied});
    verifyChild(plan,domain,receipt,inverse);
    newEffects+=receipt.effects.filter(e=>e.operation!=='NOOP').length;
   }
   await store.verifyDomain(plan,domain,receipt,{inverse});receipts.push(receipt);
  }
  const reconciliation=await store.reconcile(plan,receipts,{inverse});
  check(reconciliation.ok===true&&reconciliation.planHash===plan.planHash,'FINAL_RECONCILIATION');
  await store.event(plan,inverse?'INVERSED':'RECONCILED',hash(reconciliation));
  return {status:inverse?'INVERSED':'RECONCILED',planHash:plan.planHash,replayed,newEffects,reconciliation};
 }catch(error){
  // A commit response may have been lost. Never guess its result or auto-inverse.
  await store.event(plan,inverse?'STOPPED_INVERSE':'STOPPED').catch(()=>{});
  throw error;
 }
}
