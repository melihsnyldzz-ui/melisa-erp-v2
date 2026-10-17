// Offline proposals only. This module has no database, filesystem or writer adapter.
import {createHash} from 'node:crypto';
import {DISPLAY_METHOD,verifyObservedDisplayProof} from './party-currency-evidence-resolution.mjs';
export const STATUSES=Object.freeze(['KANITI TAMAM','KANIT EKSİK','İŞLETME KARARI','EŞLEŞME YOK']);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function exact(v){if(typeof v!=='string'||! /^-?\d{1,20}\.\d{8}$/.test(v))throw Error('EXACT_DECIMAL_REQUIRED');return BigInt(v.replace('.',''));}
function decimal(v){const a=v<0n?-v:v;return (v<0n?'-':'')+a/100000000n+'.'+String(a%100000000n).padStart(8,'0');}
export function direction(value){const n=exact(value);return n>0n?'B':n<0n?'A':'ZERO';}
function reportMatches(report,value,account){
 if(report.comparisonBasis===DISPLAY_METHOD){
  const proof=report.observedDisplayProof,key=[account.company,account.period,account.sourceId,account.role,account.currencyRaw].join('/');
  return verifyObservedDisplayProof(proof,{accountKey:key,sourceVersionHash:account.sourceVersionHash,exactSourceNet:value})
   &&report.sha256===proof.reportWitness.originalHash&&report.filterProofHash===proof.reportWitness.scopeHash
   &&report.rowHash===proof.reportWitness.rowHash&&report.excelRow===proof.reportWitness.excelRow
   &&report.amountExact===proof.reportWitness.signedValue&&report.direction===proof.reportWitness.direction;
 }
 if(report.amountExact==null||value==null)return false;
 if(report.comparisonBasis!=='VERIFIED_DISPLAY_ROUNDING')return report.direction===direction(report.amountExact)&&exact(report.amountExact)===exact(value);
 // Rounding and direction must be proved for the active report, never inferred from an old template.
 if(report.decimalScale!==2||report.directionBasis!=='ROUNDED_REPORT_VALUE'||!/^[a-f0-9]{64}$/.test(report.roundingProofHash??''))return false;
 const n=exact(value),absolute=n<0n?-n:n,unit=1000000n;
 const rounded=(absolute/unit+(absolute%unit*2n>=unit?1n:0n))*unit*(n<0n?-1n:1n);
 return exact(report.amountExact)===rounded&&report.direction===direction(decimal(rounded));
}
export function classify(account){
 const missing=[];
 if(!account.identityVerified)return{status:'EŞLEŞME YOK',missing:['EXACT_TARGET_IDENTITY_MISSING']};
 if(!['TRY','USD','EUR'].includes(account.currency))return{status:'İŞLETME KARARI',missing:['UNKNOWN_CURRENCY_NO_AUTOMATIC_CONVERSION']};
 if(account.held)missing.push('HOLD_REMAINS');
 if(!account.openingSemanticsVerified)missing.push('OPENING_OR_DOCUMENTED_NO_CARRY_MISSING');
 if(!account.periodDocumentsVerified)missing.push('PERIOD_DOCUMENT_COMPLETENESS_MISSING');
 if(!account.sameSourceBasisVerified)missing.push('ACCEPTED_AND_NEW_SOURCE_SEMANTICS_NOT_PROVEN');
 if(!account.nativeBaselineVerified)missing.push('NATIVE_OPENING_LOCAL_LEDGER_PROOF_MISSING');
 if(account.sourceDriftDuringCapture)missing.push('SOURCE_CHANGED_DURING_CAPTURE');
 const report=account.report;
 if(!report?.verified||report.independent!==true||!['VEGA_EXPORT','VERIFIED_VEGA_REPORT_QUERY'].includes(report.origin)||
    !/^[a-f0-9]{64}$/.test(report.sha256??'')||report.company!==account.company||report.period!==account.period||
    report.dateFrom!==account.dateFrom||report.dateToExclusive!==account.dateToExclusive||report.currency!==account.currency||
    report.sourceId!==account.sourceId||report.cardType!==account.cardType||report.activeFilter!=='ALL'||report.zeroFilter!=='INCLUDE'||
    !report.capturedAt||!/^[a-f0-9]{64}$/.test(report.filterProofHash??''))missing.push('DATED_FILTERED_INDEPENDENT_VEGA_REPORT_MISSING');
 else if(!reportMatches(report,account.newSourceNet,account))missing.push('REPORT_EXACT_AMOUNT_OR_DIRECTION_NOT_RECONCILED');
 if(account.oldSourceNet==null||account.newSourceNet==null)missing.push('NO_MOVEMENT_OR_UNKNOWN_IS_NOT_ZERO');
 return{status:missing.length?'KANIT EKSİK':'KANITI TAMAM',missing};
}
export function buildReadOnlyPlan(input){
 if(input.environment!=='MELISA_ERP_SIRKET_TEST_20260929_01'||!input.runId||!/^[a-f0-9]{64}$/.test(input.sourceVersionHash??''))throw Error('EXACT_TEST_AND_SOURCE_VERSION_REQUIRED');
 const seen=new Set();
 const accounts=input.accounts.map(a=>{
  if(!['customer','supplier'].includes(a.role)||a.company!==(a.role==='customer'?'F0102':'F0103')||a.period!=='D0007'||!/^\d+$/.test(a.sourceId))throw Error('SOURCE_IDENTITY_ROLE_PERIOD');
  const key=[a.company,a.period,a.sourceId,a.role,a.currencyRaw].join('/');if(seen.has(key))throw Error('DUPLICATE_ACCOUNT');seen.add(key);
  const evidence=classify(a);let proposal=null;
  if(evidence.status==='KANITI TAMAM'){
   if(!a.targetId||!a.nativeAccountId||!a.nativeWitnessHash)throw Error('NATIVE_TARGET_REQUIRED');
   const sign=a.role==='supplier'?-1n:1n,opening=exact(a.nativeOpening),local=exact(a.localEffects),current=exact(a.nativeCurrent);
   if(opening+local!==current||exact(a.nativeLedger)!==current)throw Error('NATIVE_BASELINE_DRIFT');
   if(exact(a.oldSourceNet)*sign!==opening)throw Error('OPENING_CORRECTION_REQUIRES_SEPARATE_PLAN');
   const sourceDelta=exact(a.newSourceNet)-exact(a.oldSourceNet),nativeDelta=sign*sourceDelta;
   proposal={sourceDelta:decimal(sourceDelta),nativeDelta:decimal(nativeDelta),nativeDirectionMapping:a.role==='supplier'?'NEGATE_SOURCE':'PRESERVE_SOURCE',expectedAfter:decimal(opening+local+nativeDelta),nativeWitnessHash:a.nativeWitnessHash};
  }
  return{...a,...evidence,key,proposal};
 }).sort((a,b)=>a.key.localeCompare(b.key,'en'));
 const body={schemaVersion:'melisa-party-currency-readonly-plan.v1',environment:input.environment,runId:input.runId,sourceVersionHash:input.sourceVersionHash,financialWriteAuthorized:false,accounts};
 return{...body,planHash:hash(body)};
}
export function verifyPlan(plan,{runId,sourceVersionHash,nativeWitnesses,priorReceipt=null}){
 const {planHash,...body}=plan;if(hash(body)!==planHash)throw Error('PLAN_PAYLOAD_CONFLICT');
 if(body.financialWriteAuthorized!==false)throw Error('READONLY_PLAN_REQUIRED');
 if(runId!==plan.runId||sourceVersionHash!==plan.sourceVersionHash)throw Error('RUN_OR_SOURCE_CONFLICT');
 // Re-derive eligibility and every proposal; a newly signed altered body is not enough.
 const rebuilt=buildReadOnlyPlan(body);if(rebuilt.planHash!==planHash)throw Error('PLAN_SEMANTIC_CONFLICT');
 if(priorReceipt&&(priorReceipt.runId!==runId||priorReceipt.planHash!==planHash))throw Error('REPLAY_CONFLICT');
 for(const a of plan.accounts.filter(a=>a.status==='KANITI TAMAM'))if(nativeWitnesses[a.key]!==a.proposal.nativeWitnessHash)throw Error('NATIVE_DRIFT');
 return{runId,planHash,status:priorReceipt?'SAME_PLAN_REPLAY':'READONLY_VERIFIED',proposedAccounts:plan.accounts.filter(a=>a.status==='KANITI TAMAM').length,financialWrites:0};
}
