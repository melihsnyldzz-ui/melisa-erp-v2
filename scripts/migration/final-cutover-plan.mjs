// Offline TEST preparation only: no SQL, filesystem, CLI or executable writer.
// The already approved Goal7.3 runtime and its fixed scope remain unchanged.
import {TARGET,check,units,exact,inverseAfter,replayDecision} from './goal73-supplier-delta.mjs';
import {hash} from './party-currency-readonly-plan.mjs';
export {inverseAfter};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const acceptedRun=v=>typeof v==='string'&&uuid(v.replace(/^GOAL(?:7|73)-/,''));
const direction=n=>n>0n?'B':n<0n?'A':'ZERO';
export const captureRowsHash=input=>hash(Object.fromEntries(['accounts','stocks','prices','excluded'].map(k=>[k,[...input[k]].sort((a,b)=>hash(a).localeCompare(hash(b),'en'))])));
function receipts(rows){
 check(Array.isArray(rows),'CUTOVER_ACCEPTED_RECEIPTS');const seen=new Set();
 return rows.reduce((sum,r)=>{check(acceptedRun(r.runId)&&hex(r.manifestHash)&&r.committed===true&&!seen.has(r.runId),'CUTOVER_ACCEPTED_RECEIPT');seen.add(r.runId);return sum+units(r.delta);},0n);
}
function identity(row,kind){
 check(row.identityVerified===true&&row.held===false&&id(row.nativeId)&&hex(row.nativeWitnessHash)&&hex(row.acceptedBaselineHash),'CUTOVER_IDENTITY_HOLD');
 if(kind==='account')check(['customer','supplier'].includes(row.role)&&['TRY','USD','EUR'].includes(row.currency)&&new RegExp('^VEGA2026/'+(row.role==='customer'?'F0102':'F0103')+'/TBLCARI/[1-9]\\d*$').test(row.sourceKey),'CUTOVER_ACCOUNT_KEY');
 else check(/^VEGA2026\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(row.sourceKey),'CUTOVER_PRODUCT_KEY');
}
function balance(row){
 identity(row,'account');check(row.sourceSemanticsVerified===true&&row.openingVerified===true&&hex(row.reportProofHash),'CUTOVER_BALANCE_SOURCE_PROOF');
 const t0=units(row.sourceT0),latest=units(row.acceptedSourceLatest),t1=units(row.sourceT1),sign=row.role==='supplier'?-1n:1n;
 check(row.t0Direction===direction(t0)&&row.t1Direction===direction(t1),'CUTOVER_SOURCE_BA');
 const applied=receipts(row.acceptedReceipts),opening=units(row.nativeOpening),local=units(row.localEffects),before=units(row.nativeBefore);
 check(opening===sign*t0&&applied===sign*(latest-t0),'CUTOVER_ACCEPTED_SOURCE_CHAIN');
 check(before===opening+local+applied&&units(row.nativeLedger)===before,'CUTOVER_NATIVE_LOCAL_DRIFT');
 const total=sign*(t1-t0),delta=total-applied,after=before+delta;
 return {...row,kind:'account',key:row.sourceKey+'/'+row.role+'/'+row.currency,totalT0T1Delta:exact(total),alreadyAppliedDelta:exact(applied),delta:exact(delta),afterBalance:exact(after),afterDirection:direction(sign*after),operation:delta===0n?'NOOP':'DELTA'};
}
function pieces(v){const n=units(v);check(n%100000n===0n,'CUTOVER_STOCK_PRECISION');return n;}
function stock(row){
 identity(row,'stock');check(row.unitVerified===true,'CUTOVER_STOCK_UNIT');
 const t0=pieces(row.sourceT0),latest=pieces(row.acceptedSourceLatest),t1=pieces(row.sourceT1),opening=pieces(row.nativeOpening),local=pieces(row.localEffects),before=pieces(row.nativeBefore),applied=receipts(row.acceptedReceipts);
 check(t0>=0n&&t1>=0n&&opening===t0&&applied===latest-t0,'CUTOVER_STOCK_SOURCE_CHAIN');
 check(before===opening+local+applied&&pieces(row.nativeLedger)===before,'CUTOVER_STOCK_LOCAL_DRIFT');
 const delta=t1-latest,after=before+delta;check(after>=0n,'CUTOVER_NEGATIVE_STOCK');
 return {...row,kind:'stock',key:row.sourceKey+'/STOCK',totalT0T1Delta:exact(t1-t0),alreadyAppliedDelta:exact(applied),delta:exact(delta),afterBalance:exact(after),operation:delta===0n?'NOOP':'DELTA'};
}
function price(row){
 identity(row,'price');check(['TRY','USD','EUR'].includes(row.currency)&&Number.isSafeInteger(row.tier)&&((row.priceType==='sale'&&id(row.unitSourceId)&&row.tier>=1&&row.tier<=6)||(row.priceType==='purchase'&&row.unitSourceId===null&&row.tier===0)),'CUTOVER_PRICE_TUPLE');
 check(row.sourceSemanticsVerified===true&&row.localOverride===false&&row.nativeBefore===row.acceptedSourceLatest,'CUTOVER_PRICE_LOCAL_CONFLICT');
 for(const v of [row.sourceT0,row.acceptedSourceLatest,row.sourceT1])check(v===null||units(v)>=0n,'CUTOVER_PRICE_VALUE');
 // NULL is never replaced by zero, nor automatically written as a destructive removal.
 check(row.sourceT1!==null||row.nativeBefore===null,'CUTOVER_PRICE_REMOVAL_REQUIRES_DECISION');
 return {...row,kind:'price',key:[row.sourceKey,'PRICE',row.priceType,row.unitSourceId??'CARD',row.tier,row.currency].join('/'),afterValue:row.sourceT1,operation:row.nativeBefore===row.sourceT1?'NOOP':'VERSIONED_REPLACE'};
}
export function buildFinalCutoverPlan(input){
 check(input.target?.server===TARGET.server&&input.target.database===TARGET.database,'CUTOVER_PREPARATION_TEST_ONLY');
 check(uuid(input.cutoverId)&&hex(input.acceptedBaselineHash),'CUTOVER_ID_BASELINE');
 const f=input.freeze,c=input.capture;
 check(f?.allVegaWritersStopped===true&&f.offlineQueuesDrained===true&&hex(f.writerInventoryHash)&&hex(f.evidenceHash)&&stamp(f.stoppedAt),'CUTOVER_SOURCE_FREEZE_REQUIRED');
 check(f.melisaWritesPaused===true&&hex(f.nativePauseProofHash),'CUTOVER_NATIVE_PAUSE_REQUIRED');
 check(c?.sourceServer==='DESKTOP-KSRK0EQ'&&c.database==='VEGA2026'&&c.period==='D0007'&&stamp(c.startedAt)&&stamp(c.finishedAt)&&Date.parse(f.stoppedAt)<=Date.parse(c.startedAt)&&Date.parse(c.startedAt)<=Date.parse(c.finishedAt),'CUTOVER_CAPTURE_IDENTITY_TIME');
 check(hex(c.commonScopeHash)&&hex(c.beforeHash)&&c.beforeHash===c.afterHash&&c.allDomainsIncluded===true&&c.reportDateTo===c.businessDate&&/^\d{4}-\d{2}-\d{2}$/.test(c.businessDate),'CUTOVER_COMMON_CAPTURE_PROOF');
 check(Array.isArray(input.accounts)&&Array.isArray(input.stocks)&&Array.isArray(input.prices)&&Array.isArray(input.excluded),'CUTOVER_DOMAINS');
 const rows=[...input.accounts.map(balance),...input.stocks.map(stock),...input.prices.map(price)].sort((a,b)=>a.key.localeCompare(b.key,'en'));
 check(rows.length>0&&new Set(rows.map(r=>r.key)).size===rows.length,'CUTOVER_DUPLICATE_OR_EMPTY');
 check(new Set(rows.map(r=>r.kind+'/'+r.nativeId+(r.kind==='price'?'/'+r.priceType+'/'+r.unitSourceId+'/'+r.tier+'/'+r.currency:''))).size===rows.length,'CUTOVER_DUPLICATE_NATIVE_TARGET');
 check(hex(c.rowsHash)&&c.rowsHash===captureRowsHash(input),'CUTOVER_CAPTURE_ROWS_BINDING');
 const includedKeys=new Set(rows.map(r=>r.key)),excludedKeys=new Set();for(const e of input.excluded){check(typeof e.key==='string'&&e.key.length>0&&!includedKeys.has(e.key)&&!excludedKeys.has(e.key)&&typeof e.reason==='string'&&e.reason.trim().length>0,'CUTOVER_EXCLUSION');excludedKeys.add(e.key);}
 const body={schemaVersion:'melisa-final-cutover-preparation.v1',cutoverId:input.cutoverId,target:input.target,acceptedBaselineHash:input.acceptedBaselineHash,freeze:f,capture:c,rows,excluded:input.excluded,financialWriteAuthorized:false,executeAllowed:false,runtimeAdapter:'NOT_IMPLEMENTED_OR_AUTHORIZED'};
 return {...body,planHash:hash(body)};
}
export function verifyFinalCutoverPlan(plan){
 const {planHash,...body}=plan;check(hash(body)===planHash&&body.financialWriteAuthorized===false&&body.executeAllowed===false&&body.runtimeAdapter==='NOT_IMPLEMENTED_OR_AUTHORIZED','CUTOVER_PLAN_HASH_OR_WRITE');
 const rebuilt=buildFinalCutoverPlan({...body,accounts:body.rows.filter(r=>r.kind==='account').map(original),stocks:body.rows.filter(r=>r.kind==='stock').map(original),prices:body.rows.filter(r=>r.kind==='price').map(original)});
 check(rebuilt.planHash===planHash,'CUTOVER_SEMANTICS_CHANGED');return {planHash,financialWrites:0,executeAllowed:false};
}
function original(row){const r={...row};for(const k of ['kind','key','totalT0T1Delta','alreadyAppliedDelta','delta','afterBalance','afterDirection','afterValue','operation'])delete r[k];return r;}
// Receipt verification contract only. No persisted receipt is created here.
export function finalReplayDecision(plan,receipt){
 verifyFinalCutoverPlan(plan);if(!receipt)return 'NOT_EXECUTABLE_PREPARATION';
 check(receipt.cutoverId===plan.cutoverId&&hash(receipt.target)===hash(plan.target),'CUTOVER_RECEIPT_IDENTITY');
 return replayDecision(receipt,{manifestHash:plan.planHash,parentPlanHash:plan.acceptedBaselineHash});
}
export function priceInverseDecision(effect,currentValue,currentWitnessHash){
 check(effect.operation==='VERSIONED_REPLACE'&&hex(effect.afterWitnessHash),'CUTOVER_PRICE_INVERSE_PROOF');
 return currentValue===effect.afterValue&&currentWitnessHash===effect.afterWitnessHash?{operation:'VERSIONED_RESTORE',value:effect.nativeBefore}:{operation:'BLOCKED_LATER_PRICE_CHANGE'};
}
