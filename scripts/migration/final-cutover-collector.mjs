// No connection, capture, file access or execution happens on import.
import {hash} from './party-currency-readonly-plan.mjs';
import {check} from './goal73-supplier-delta.mjs';
import {buildFinalCutoverPlan,captureRowsHash} from './final-cutover-plan.mjs';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const seal=body=>({...body,collectorHash:hash(body)});
export function verifyCollectorReceipt(receipt,plan){
 check(receipt&&plan,'FINAL_COLLECTOR_REQUIRED');
 const {collectorHash,...body}=receipt;
 check(hash(body)===collectorHash&&receipt.planHash===plan.planHash&&receipt.rowsHash===plan.capture.rowsHash,'FINAL_COLLECTOR_BINDING');
 check(['SYNTHETIC_OFFLINE','FROZEN_SOURCE'].includes(receipt.evidenceKind),'FINAL_COLLECTOR_KIND');
 return receipt;
}
// Source boundary owns verified Vega report semantics; baseline boundary owns
// immutable opening/version/journal proof. Neither may promote a mock to T1.
export async function collectFinalCutover({input,source,baseline,evidenceKind='SYNTHETIC_OFFLINE',authorizeCapture=null,now=()=>new Date().toISOString()}){
 check(['SYNTHETIC_OFFLINE','FROZEN_SOURCE'].includes(evidenceKind),'FINAL_COLLECTOR_KIND');
 const f=input.freeze;
 check(f?.allVegaWritersStopped===true&&f.offlineQueuesDrained===true&&f.melisaWritesPaused===true&&hex(f.writerInventoryHash)&&hex(f.evidenceHash)&&hex(f.nativePauseProofHash),'FINAL_COLLECTOR_FREEZE');
 if(evidenceKind==='FROZEN_SOURCE'){
  check(authorizeCapture?.action==='READ_FROZEN_T1'&&authorizeCapture.cutoverId===input.cutoverId&&authorizeCapture.freezeHash===hash(f)&&hex(authorizeCapture.scopeHash),'FINAL_CAPTURE_AUTHORIZATION');
  check(source.evidenceKind==='FROZEN_SOURCE'&&baseline.evidenceKind==='NATIVE_READONLY','FINAL_CAPTURE_REAL_BOUNDARIES');
 }else check(source.evidenceKind==='SYNTHETIC_OFFLINE'&&baseline.evidenceKind==='SYNTHETIC_OFFLINE','FINAL_CAPTURE_SYNTHETIC_BOUNDARIES');
 const startedAt=now();check(Date.parse(startedAt)>=Date.parse(f.stoppedAt),'FINAL_CAPTURE_TIME');
 const identity=await source.identity();
 check(identity.server==='DESKTOP-KSRK0EQ'&&identity.database==='VEGA2026'&&identity.period==='D0007'&&identity.selectOnly===true,'FINAL_SOURCE_IDENTITY');
 const scope=input.scope;
 check(scope?.dateTo===input.businessDate&&scope.dateFrom==='2026-01-01'&&scope.activeFilter==='ALL'&&scope.zeroFilter==='INCLUDE'&&hash(scope)===input.commonScopeHash,'FINAL_CAPTURE_SCOPE');
 if(authorizeCapture)check(authorizeCapture.scopeHash===hash(scope),'FINAL_CAPTURE_SCOPE_APPROVAL');
 const before=await source.fingerprint(scope);
 check(hex(before),'FINAL_CAPTURE_FINGERPRINT');
 const captured=await source.readAll(scope);
 check(captured.domains?.join(',')==='accounts,stocks,prices'&&captured.reportDateTo===input.businessDate,'FINAL_CAPTURE_DOMAINS');
 const rows=await baseline.bind(captured,input.acceptedBaselineHash);
 check(rows.baselineHash===input.acceptedBaselineHash&&rows.receiptsVerified===true,'FINAL_CAPTURE_BASELINE');
 const after=await source.fingerprint(scope);
 check(before===after,'FINAL_CAPTURE_SOURCE_DRIFT');
 // Recheck external freeze proof after all reads, including native beforeimages.
 check(await source.verifyFreeze(f)===true&&await baseline.verifyPause(f)===true,'FINAL_CAPTURE_FREEZE_LOST');
 const finishedAt=now();
 const data={target:input.target,cutoverId:input.cutoverId,acceptedBaselineHash:input.acceptedBaselineHash,freeze:f,accounts:rows.accounts,stocks:rows.stocks,prices:rows.prices,excluded:rows.excluded,capture:{sourceServer:identity.server,database:identity.database,period:identity.period,startedAt,finishedAt,commonScopeHash:hash(scope),beforeHash:before,afterHash:after,allDomainsIncluded:true,businessDate:input.businessDate,reportDateTo:captured.reportDateTo}};
 data.capture.rowsHash=captureRowsHash(data);
 const plan=buildFinalCutoverPlan(data);
 const receipt=seal({schemaVersion:'melisa-final-collector.v1',cutoverId:plan.cutoverId,planHash:plan.planHash,rowsHash:plan.capture.rowsHash,evidenceKind,scopeHash:hash(scope),sourceFingerprint:before,baselineHash:input.acceptedBaselineHash,captureAuthorizationHash:authorizeCapture?hash(authorizeCapture):null,actualT1:evidenceKind==='FROZEN_SOURCE'});
 return {plan,receipt};
}
