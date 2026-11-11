// Public compiler/validator transport for the separately reviewed Windows owner.
// It never opens files, SQL, a browser, a credential store or a child process.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parsePersonnelObservation} from './empty-v7-personnel-core.mjs';
import {compileRoleOverlayRead,compileRoleOverlayMutation} from './role-overlay-sql.mjs';
import {validateOverlayDecision,validateOverlayBaseline,validateOverlayReceipt,validateCompensatedReceipt,parseOverlayRead,assertOverlayDelta,assertCompensated,assertOverlayObserved,assertCompensatedObserved} from './role-overlay-core.mjs';
import {observationDigest,digest,same,exact,need,id,ROLE_OVERLAY_HASH_KEYS} from './role-overlay-core.mjs';
import {compileOverlayQuantitative,parseOverlayNative,assertOverlayNativePreservation} from './role-overlay-native.mjs';
const one=(sets,n)=>{need(Array.isArray(sets)&&sets.length===n&&sets.every(s=>Array.isArray(s)&&s.length===1));return sets.map(x=>x[0]);};
// A failed public read is never returned. Only the exact static boundary that
// rejected it crosses stderr; the original error, input and stack are dropped.
export const OVERLAY_BEFORE_FAILURE_CODES=Object.freeze(['ROLE_OVERLAY_BEFORE_CONTEXT','ROLE_OVERLAY_BEFORE_RECORDSETS','ROLE_OVERLAY_BEFORE_PUBLIC_READ','ROLE_OVERLAY_BEFORE_BASELINE','ROLE_OVERLAY_BEFORE_FROZEN','ROLE_OVERLAY_BEFORE_PREDECESSOR','ROLE_OVERLAY_BEFORE_ASSERT_CURRENT','ROLE_OVERLAY_BEFORE_QUANTITATIVE','ROLE_OVERLAY_BEFORE_DIGEST']);
const beforeStep=(code,fn)=>{try{return fn();}catch{throw Error(code);}};
export function overlayPublicFailureCode(error){const d=error&&Object.getOwnPropertyDescriptor(error,'message');return d&&Object.hasOwn(d,'value')&&OVERLAY_BEFORE_FAILURE_CODES.includes(d.value)?d.value:'ROLE_OVERLAY_PUBLIC_REJECTED';}
function context(c,now){
 need(exact(c,['decision','baseline','receipt','trialReceipt','predecessor']));const d=validateOverlayDecision(c.decision,now);
 if(d.mode==='preflight'){
  need(c.baseline===null&&c.receipt===null&&c.trialReceipt===null&&exact(c.predecessor,['version','state','mode','target','rosterOperationId','operationId','rosterSha256','counts','users','policy','hashes','business'])&&c.predecessor.counts.users===7&&c.predecessor.counts.roles===6&&c.predecessor.counts.permissions===51&&d.baselineDigest===digest(c.predecessor));
 }else if(['compensate','observe'].includes(d.mode)){need(c.baseline===null&&c.predecessor===null&&c.trialReceipt===null);if(d.mode==='observe'&&c.receipt?.state==='ROLE_OVERLAY_COMPENSATED')validateCompensatedReceipt(c.receipt);else validateOverlayReceipt(c.receipt);need(d.baselineDigest===observationDigest(c.receipt.after));}
 else{need(c.receipt===null&&c.predecessor===null);validateOverlayBaseline(c.baseline);need(d.baselineDigest===observationDigest(c.baseline));if(d.mode==='apply')need(c.trialReceipt?.state==='ROLE_OVERLAY_TRIAL_ROLLED_BACK'&&c.trialReceipt.mode==='trial-rollback'&&c.trialReceipt.sourceHead===d.sourceHead&&c.trialReceipt.reviewSha256===d.reviewSha256&&c.trialReceipt.sqlProcessId===d.sqlProcessId&&c.trialReceipt.closed===true&&c.trialReceipt.rolledBack===true&&c.trialReceipt.committed===false&&c.trialReceipt.outcomeUnknown===false&&c.trialReceipt.restoreVerified===true&&c.trialReceipt.operationId===d.trialOperationId&&c.trialReceipt.baselineDigest===d.baselineDigest);else need(c.trialReceipt===null);}
 return d;
}
export function overlayPublicCommand(mode,input,{now=Date.now()}={}){
 need(exact(input,mode==='--plan'?['context']:mode==='--before'?['context','recordsets','quantitativeRow']:mode==='--checked'?['context','before','beforeNative','mutationSets','afterSets','quantitativeRow']:mode==='--restored'?['context','before','beforeNative','recordsets','quantitativeRow']:[]));const c=input.context,d=mode==='--before'?beforeStep('ROLE_OVERLAY_BEFORE_CONTEXT',()=>context(c,now)):context(c,now),expected=c.baseline??c.receipt?.after;
 if(mode==='--plan'){
  const auditBoundary=d.mode==='observe'?c.receipt.after.public.audit.maxId:d.mode==='compensate'?c.receipt.before.public.audit.maxId:null;
  return {state:'ROLE_OVERLAY_PUBLIC_PLAN',read:compileRoleOverlayRead({auditBoundary}),after:compileRoleOverlayRead({auditBoundary:expected?.public.audit.maxId??null}),restore:compileRoleOverlayRead(),quantitative:compileOverlayQuantitative(d.invoiceIds),mutation:['apply','trial-rollback','compensate'].includes(d.mode)?compileRoleOverlayMutation({mode:d.mode,operationId:d.operationId,before:c.baseline,receipt:c.receipt}):null,rosterOperationId:(c.predecessor??expected?.frozen)?.rosterOperationId};
 }
 if(mode==='--before'){
  const pair=beforeStep('ROLE_OVERLAY_BEFORE_RECORDSETS',()=>one(input.recordsets,2));
  const o=beforeStep('ROLE_OVERLAY_BEFORE_PUBLIC_READ',()=>parseOverlayRead(...pair));
  if(d.mode==='preflight'){
   beforeStep('ROLE_OVERLAY_BEFORE_BASELINE',()=>validateOverlayBaseline(o));
   const current=beforeStep('ROLE_OVERLAY_BEFORE_FROZEN',()=>parsePersonnelObservation(o.frozen));
   beforeStep('ROLE_OVERLAY_BEFORE_PREDECESSOR',()=>{for(const k of ['target','rosterOperationId','rosterSha256','counts','users','policy','hashes','business'])need(same(current[k],c.predecessor[k]));});
  }else beforeStep('ROLE_OVERLAY_BEFORE_ASSERT_CURRENT',()=>{if(d.mode==='observe'){if(c.receipt.state==='ROLE_OVERLAY_COMPENSATED')assertCompensatedObserved(c.receipt,o);else assertOverlayObserved(c.receipt,o);}else need(observationDigest(o)===d.baselineDigest);});
  const native=beforeStep('ROLE_OVERLAY_BEFORE_QUANTITATIVE',()=>parseOverlayNative(input.quantitativeRow,o,d.invoiceIds,d.sqlProcessId));
  const baselineDigest=beforeStep('ROLE_OVERLAY_BEFORE_DIGEST',()=>observationDigest(o));
  return {state:'ROLE_OVERLAY_PUBLIC_BEFORE_VALID',observation:o,native,baselineDigest};
 }
 if(mode==='--restored'){need(d.mode==='trial-rollback');const o=parseOverlayRead(...one(input.recordsets,2));need(observationDigest(o)===observationDigest(input.before));const native=parseOverlayNative(input.quantitativeRow,o,d.invoiceIds,d.sqlProcessId);assertOverlayNativePreservation(input.beforeNative,native);need(same(input.beforeNative.quantitative.rolePermissions,native.quantitative.rolePermissions));return {state:'ROLE_OVERLAY_BASELINE_RESTORED',restoreVerified:true,observation:o,native};}
 need(mode==='--checked'&&['apply','trial-rollback','compensate'].includes(d.mode));need(observationDigest(input.before)===d.baselineDigest);
 const m=one(input.mutationSets,d.mode==='compensate'?2:3);for(const k of ROLE_OVERLAY_HASH_KEYS)need(m[0][k]===input.before.frozen[k]);const after=parseOverlayRead(...one(input.afterSets,2));let inserted=null;
 if(d.mode==='compensate'){need(id(m[1].auditId));assertCompensated(c.receipt.before,c.receipt.after,after);}
 else{need(exact(m[1],['auditId'])&&id(m[1].auditId)&&exact(m[2],['roleId','permissionIdsJson'])&&id(m[2].roleId));const permissions=JSON.parse(m[2].permissionIdsJson);need(Array.isArray(permissions)&&permissions.length===7&&permissions.every(x=>exact(x,['id'])&&id(x.id)));inserted={roleId:m[2].roleId,permissionIds:permissions.map(x=>x.id),auditId:m[1].auditId};assertOverlayDelta(input.before,after,inserted);}
 const native=parseOverlayNative(input.quantitativeRow,after,d.invoiceIds,d.sqlProcessId);assertOverlayNativePreservation(input.beforeNative,native);
 return {state:'ROLE_OVERLAY_CHECKED_NOT_COMMITTED',before:input.before,beforeNative:input.beforeNative,after,native,inserted,baselineDigest:d.baselineDigest};
}
export async function readOverlayPublicInput(stream){const parts=[];let size=0;try{for await(const part of stream){const b=Buffer.from(part);parts.push(b);size+=b.length;need(size<=2097152);}const all=Buffer.concat(parts);try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}finally{all.fill(0);}}finally{parts.forEach(b=>b.fill(0));}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){try{need(process.argv.length===3);const result=overlayPublicCommand(process.argv[2],await readOverlayPublicInput(process.stdin));process.stdout.write(JSON.stringify(result));}catch(error){process.stderr.write(overlayPublicFailureCode(error));process.exitCode=1;}}
