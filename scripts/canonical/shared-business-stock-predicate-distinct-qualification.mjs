// Pure offline source qualification. All native responses here are modeled;
// this never connects, rehearses, applies, activates, or issues a runtime grant.
import {createHash} from 'node:crypto';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {buildStockPredicateDistinctRevision,frozenStockPredicateOverlay} from './shared-business-stock-predicate-distinct-revision-sql.mjs';
import {stockPredicateProofFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {configureBusinessSelectedSaleRevision,verifyBusinessSelectedSaleRevision,STOCK_PREDICATE_REVISION_PROOF_SQL} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {assertPreparedSelectedRevisionArtifact} from './shared-business-selected-sale-revision-sql.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyJSON,assertIsolatedCopyReadProof,isolatedCopyTopology} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {loadBusinessSelectedSaleStartup} from '../../apps/api/src/services/businessSelectedSaleStartup.mjs';
const check=(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});};
export async function qualifyStockPredicateDistinctSource({capturedInput,startup,stockPredicateSource,frozenBundle}){
 const {copy}=await compileCapturedBusinessSelectedSaleRevision(capturedInput),bundle=buildStockPredicateDistinctRevision({copy,...startup,stockPredicateSource});
 check(isolatedCopyJSON(frozenStockPredicateOverlay(bundle))===isolatedCopyJSON(frozenBundle),'STOCK_PREDICATE_FROZEN_V2_BYTES');
 const state={...startup,schemaVersion:'melisa-selected-sale-startup-input.v6',stockPredicateSource,stockPredicateRevision:bundle.revision},bytes=Buffer.from(JSON.stringify(state));
 const config={businessReadyRevision:state.base,businessReadyPerformanceRevision:state.performance,businessEffectsPerformanceRevision:state.effects,businessDailyRevision:state.daily.revision,businessDailyProfitRevision:state.profit.revision,businessDailyNativeCheck:state.nativeCheck,businessSelectedSaleStartup:{path:'C:\\Sirket\\ERP\\runtime\\source-qualification-only.json',sha256:createHash('sha256').update(bytes).digest('hex'),revisionHash:state.selectedRevision.revisionHash}};
 loadBusinessSelectedSaleStartup(config,copy,{readFile:()=>bytes});
 for(const nativeReadOnly of [false,true]){
  const context=validateIsolatedOperationCopyContext(capturedInput.context),f=stockPredicateProofFixture({copy:context,input:capturedInput,state,bundle,nativeReadOnly,reader:isolatedCopyTopology(context).reader});
  const value=await configureBusinessSelectedSaleRevision({copy:context,...state,nativeReadOnly,request:f.request});
  check(value.bundle.revision.version===11&&value.stockPredicateRevision.revisionHash===bundle.revision.revisionHash,'STOCK_PREDICATE_SOURCE_MODEL_REGISTRATION');
  for(const [artifact,kind] of [[value.bundle.contextArtifact,'context'],[value.bundle.writeScopeArtifact,'intent']]){assertPreparedSelectedRevisionArtifact(artifact,context,kind);let rejected=false;try{assertPreparedSelectedRevisionArtifact(structuredClone(artifact),context,kind);}catch{rejected=true;}check(rejected,'STOCK_PREDICATE_SOURCE_MODEL_BRANDING');}
  const proof=definitionHashes=>({copyId:context.copyId,sealHash:context.sealHash,backupSHA:context.backupSHA,valid:true,definitionHashes});
  assertIsolatedCopyReadProof(context,proof(value.parentHashes));
  let staleRejected=false;try{assertIsolatedCopyReadProof(context,proof({...value.parentHashes,ready:bundle.baseOperationQuarantineRevision.modules.find(m=>m.name==='dbo.usp_stage4_copy_ready').afterHash}));}catch{staleRejected=true;}check(staleRejected,'STOCK_PREDICATE_STALE_READ_PROOF');
  await verifyBusinessSelectedSaleRevision(context,f.request);
  f.results.get(STOCK_PREDICATE_REVISION_PROOF_SQL).recordsets[1][0].lastDelete=1;
  let rejected=false;try{await verifyBusinessSelectedSaleRevision(context,f.request);}catch(e){rejected=e.code==='STOCK_PREDICATE_BOOT_NATIVE_PINS';}check(rejected,'STOCK_PREDICATE_ORDER_DRIFT');
 }
 return {sourceQualification:true,nativeProofModeled:true,sqlExecuted:false,runtimeActivated:false,frozenV2BitExact:true,startupV6:true,modeledWriterAndReader:true,artifactBranding:true,latestReadProof:true,reverifyOrderDriftRejected:true,revisionHash:bundle.revision.revisionHash,modules:bundle.replacements.length};
}
