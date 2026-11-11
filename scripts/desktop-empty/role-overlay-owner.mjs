// Source-only coordinator with a mandatory external host capability. No native
// connector, file, credential, process, CLI entry or operational adapter here.
// Root must separately review a real gate/driver/artifact adapter before use.
import {compileRoleOverlayRead,compileRoleOverlayMutation} from './role-overlay-sql.mjs';
import {parseOverlayRead,validateOverlayBaseline,validateOverlayDecision,validateOverlayReceipt,assertOverlayDelta,assertCompensated,assertOverlayObserved,observationDigest,same,uuid,id,need} from './role-overlay-core.mjs';
const one=(r,n)=>{need(Array.isArray(r?.recordsets)&&r.recordsets.length===n&&r.recordsets.every(x=>Array.isArray(x)&&x.length===1));return r.recordsets.map(x=>x[0]);};
function insertedRows(r){const [f,a,i]=one(r,3);need(id(a.auditId)&&id(i.roleId)&&typeof i.permissionIdsJson==='string');const ps=JSON.parse(i.permissionIdsJson);need(Array.isArray(ps)&&ps.length===7&&ps.every(p=>p&&Object.keys(p).join(',')==='id'&&id(p.id)));return {frozen:f,inserted:{roleId:i.roleId,permissionIds:ps.map(p=>p.id),auditId:a.auditId}};}
const noErrorDetail=()=>({guard:'ROLE_OVERLAY_OPERATION_FAILED',automaticRetry:false});
export async function runRoleOverlayOwner({decision,baseline,receipt=null,trialReceipt=null,gate,driver,artifacts,now=Date.now()}={}){
 validateOverlayDecision(decision,now);need(gate&&typeof gate.verify==='function'&&typeof gate.release==='function'&&driver&&typeof driver.begin==='function'&&typeof driver.close==='function'&&artifacts&&typeof artifacts.createNew==='function');
 const d=decision,write=['trial-rollback','apply','compensate'].includes(d.mode);let tx=null,started=false,submitted=false,commitAttempted=false,committed=false,rolledBack=false,closed=false,outcomeUnknown=false,before=null,after=null,inserted=null,answer=null;
 // The real external gate must prove source/review/runtime/SQL process pins,
 // owner SID, stopped app and held NoShare locks for writes. No default gate.
 if(d.mode==='observe'){validateOverlayReceipt(receipt);need(baseline===null&&d.baselineDigest===observationDigest(receipt.after));}
 else if(d.mode==='compensate'){validateOverlayReceipt(receipt);need(baseline===null&&d.baselineDigest===observationDigest(receipt.after));}
 else{validateOverlayBaseline(baseline);need(d.baselineDigest===observationDigest(baseline));}
 if(d.mode==='apply')need(trialReceipt?.state==='ROLE_OVERLAY_TRIAL_ROLLED_BACK'&&trialReceipt.mode==='trial-rollback'&&trialReceipt.sourceHead===d.sourceHead&&trialReceipt.reviewSha256===d.reviewSha256&&trialReceipt.sqlProcessId===d.sqlProcessId&&trialReceipt.restoreVerified===true&&trialReceipt.operationId===d.trialOperationId&&trialReceipt.operationId!==d.operationId&&trialReceipt.rolledBack===true&&trialReceipt.closed===true&&trialReceipt.committed===false&&trialReceipt.outcomeUnknown===false&&trialReceipt.baselineDigest===d.baselineDigest);
 const boundary=d.mode==='observe'?receipt.after.public.audit.maxId:d.mode==='compensate'?receipt.before.public.audit.maxId:null;
 try{
  await gate.verify({decision:d,write,requiresOfflineApp:true,requiresBothLocks:true,sourceOnlyCoordinator:true});
  tx=await driver.begin({isolation:'SERIALIZABLE',write});started=true;
  const first=one(await tx.query(compileRoleOverlayRead({auditBoundary:boundary})),2);before=parseOverlayRead(...first);
  if(d.mode==='observe')assertOverlayObserved(receipt,before);else need(observationDigest(before)===d.baselineDigest);
  // A durable CreateNew before image is required before submitting any DML.
  await artifacts.createNew(d.operationId,'before',{state:'ROLE_OVERLAY_BEFORE',operationId:d.operationId,mode:d.mode,observation:before});
  if(!write){await tx.rollback();rolledBack=true;tx=null;answer={state:d.mode==='observe'?'ROLE_OVERLAY_OBSERVED':'ROLE_OVERLAY_PREFLIGHT',observation:before};}
  else{
   const body=compileRoleOverlayMutation({mode:d.mode,operationId:d.operationId,before,receipt});submitted=true;
   const mutation=await tx.query(body);
   if(d.mode==='compensate'){const [f,a]=one(mutation,2);need(id(a.auditId));for(const k of ['metadataSha256','securitySha256','businessSha256','adminSha256','settingsSha256','auditSha256','pendingSha256'])need(f[k]===before.frozen[k]);}
   else{const r=insertedRows(mutation);inserted=r.inserted;for(const k of ['metadataSha256','securitySha256','businessSha256','adminSha256','settingsSha256','auditSha256','pendingSha256'])need(r.frozen[k]===before.frozen[k]);}
   const readAfter=one(await tx.query(compileRoleOverlayRead({auditBoundary:before.public.audit.maxId})),2);after=parseOverlayRead(...readAfter);
   if(d.mode==='compensate')assertCompensated(receipt.before,receipt.after,after);else assertOverlayDelta(before,after,inserted);
   await artifacts.createNew(d.operationId,'checked',{state:'ROLE_OVERLAY_CHECKED_NOT_COMMITTED',operationId:d.operationId,mode:d.mode,before,after,inserted});
   if(d.mode==='trial-rollback'){
    await tx.rollback();rolledBack=true;tx=null;
    tx=await driver.begin({isolation:'SERIALIZABLE',write:false});const check=one(await tx.query(compileRoleOverlayRead()),2),restored=parseOverlayRead(...check);need(observationDigest(restored)===d.baselineDigest);await tx.rollback();tx=null;
    answer={state:'ROLE_OVERLAY_TRIAL_ROLLED_BACK',baselineDigest:d.baselineDigest,before,checkedAfter:after,inserted,restoreVerified:true};
   }else{commitAttempted=true;await tx.commit();committed=true;tx=null;answer={state:d.mode==='compensate'?'ROLE_OVERLAY_COMPENSATED':'ROLE_OVERLAY_APPLIED',version:1,baselineDigest:d.baselineDigest,before,after,inserted};}
  }
 }catch{
  if(commitAttempted&&!committed){outcomeUnknown=true;tx=null;}
  else if(tx){try{await tx.rollback();rolledBack=true;}catch{outcomeUnknown=true;}tx=null;}
  answer={state:outcomeUnknown?'ROLE_OVERLAY_UNKNOWN_NO_RETRY':'ROLE_OVERLAY_STOPPED_NO_RETRY',...noErrorDetail()};
 }finally{try{await driver.close();closed=true;}catch{if(commitAttempted&&!committed)outcomeUnknown=true;}try{await gate.release();}catch{closed=false;}}
 const result={...answer,operationId:d.operationId,mode:d.mode,sourceHead:d.sourceHead,reviewSha256:d.reviewSha256,sqlProcessId:d.sqlProcessId,submitted,commitAttempted,committed,rolledBack,closed,outcomeUnknown,automaticRetry:false};
 // Public result persistence failure after commit cannot turn it into a retry.
 try{await artifacts.createNew(d.operationId,'completed',result);}catch{return {state:'ROLE_OVERLAY_RESULT_PERSISTENCE_FAILED_NO_RETRY',operationId:d.operationId,submitted,commitAttempted,committed,rolledBack,closed,outcomeUnknown,automaticRetry:false};}
 return result;
}
export function appliedOverlayReceipt(result){need(result?.state==='ROLE_OVERLAY_APPLIED'&&result.committed===true&&result.closed===true&&result.outcomeUnknown===false);const r={version:1,state:result.state,operationId:result.operationId,baselineDigest:result.baselineDigest,before:result.before,after:result.after,inserted:result.inserted,committed:true,closed:true,outcomeUnknown:false};validateOverlayReceipt(r);return r;}
