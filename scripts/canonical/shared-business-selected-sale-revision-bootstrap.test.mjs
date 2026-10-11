import test from 'node:test';
import assert from 'node:assert/strict';
import {capturedFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {assertPreparedSelectedRevisionArtifact} from './shared-business-selected-sale-revision-sql.mjs';
import {isolatedCopyHash,isolatedCopyJSON,isolatedCopyTopology,validateIsolatedOperationCopyContext,getBusinessDailyHomeReadRevisions,assertIsolatedCopyReadProof} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,configureBusinessSelectedSaleRevision,getRegisteredBusinessSelectedSaleRevision,verifyBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-bootstrap.mjs';

async function fixture(){
 const input=await capturedFixture(),{bundle}=await compileCapturedBusinessSelectedSaleRevision(input),copy=validateIsolatedOperationCopyContext(input.context);
 const meta={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',manifestRows:1,moduleManifestRows:185,copyId:copy.copyId,sealHash:copy.sealHash,backupSHA:copy.backupSHA,profileHash:isolatedCopyHash(copy),queryPlanRegistryExists:false};
 const rows=bundle.revision.modules.map(m=>({copyId:copy.copyId,name:m.name,revision:6,baseSealHash:copy.sealHash,baseDailyRevisionHash:input.dailyRevision.revisionHash,baseProfitRevisionHash:input.profitRevision.revisionHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:bundle.revision.revisionHash,profileHash:bundle.revision.profileHash,actualHash:m.afterHash,immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0}));
 const result={recordsets:[[meta],...structuredClone(input.proofs.daily),structuredClone(input.proofs.profit),...structuredClone(input.proofs.native),rows,structuredClone(input.schema),[structuredClone(meta)]]};
 for(const group of result.recordsets.slice(1,6))for(const r of group){const m=bundle.revision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 const options={base:input.base,performance:input.performance,effects:input.effects,daily:input.daily,profit:input.profit,nativeCheck:input.nativeCheck,schema:input.schema,selectedRevision:bundle.revision,selectedInstall:bundle};
 const calls=[],request={query:async sql=>{calls.push(sql);assert.equal(sql,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL);return structuredClone(result);}};
 return {input,bundle,copy,result,options,calls,request};
}

test('installed v6 earns current pins only after complete canonical historical proof, without mutating witnesses',async()=>{
 const f=await fixture(),snapshot=isolatedCopyJSON(f.result),optionsSnapshot=isolatedCopyJSON(f.options);
 assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
 const value=await configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options});
 assert.equal(f.calls.length,1);assert.equal(isolatedCopyJSON(f.result),snapshot);assert.equal(isolatedCopyJSON(f.options),optionsSnapshot);
 assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),value);assert(Object.isFrozen(value.bundle.revision.modules));
 assert.equal(getRegisteredBusinessSelectedSaleRevision(structuredClone(f.copy)),null);
 assert.equal(isolatedCopyJSON(getBusinessDailyHomeReadRevisions(f.copy)),isolatedCopyJSON({daily:f.input.dailyRevision,profit:f.input.profitRevision}));
 assert.equal(assertPreparedSelectedRevisionArtifact(value.bundle.contextArtifact,f.copy,'context'),value.bundle.contextArtifact);
 assert.equal(assertPreparedSelectedRevisionArtifact(value.bundle.writeScopeArtifact,f.copy,'intent'),value.bundle.writeScopeArtifact);
 assertIsolatedCopyReadProof(f.copy,{copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes:value.parentHashes});
 const stale=Object.fromEntries(Object.entries(f.copy.sql).map(([k,m])=>[k,f.input.profitRevision.modules.find(p=>p.name===m.name)?.afterHash??f.input.dailyRevision.modules.find(p=>p.name===m.name).afterHash]));
 assert.throws(()=>assertIsolatedCopyReadProof(f.copy,{copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes:stale}),{code:'ISOLATED_COPY_READ_PROOF'});
 assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);assert.equal(f.calls.length,2);
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options}),{code:'SELECTED_BOOT_FRESH_CONTEXT'});
});

test('registry, native current definitions, history, and transaction failures cannot create a registration',async()=>{
 const source=await fixture();
 const cases=[
  [r=>r.recordsets[8].pop(),'SELECTED_BOOT_REGISTRY_ROWS'],
  [r=>r.recordsets[8].push(structuredClone(r.recordsets[8][0])),'SELECTED_BOOT_REGISTRY_ROWS'],
  [r=>r.recordsets[8][0].actualHash=null,'SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[8][0].beforeHash='F'.repeat(64),'SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[8][0].profileHash='F'.repeat(64),'SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[8][0].triggerDisabled=1,'SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[8][0].immutableTriggerHash='F'.repeat(64),'SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[8][0].copyId='00000000-0000-4000-8000-000000000001','SELECTED_BOOT_NATIVE_PINS'],
  [r=>r.recordsets[4].pop(),'BUSINESS_DAILY_DB_PROOF'],
  [r=>r.recordsets[5][0].triggerDisabled=1,undefined],
  [r=>r.recordsets[1][0].actualHash='F'.repeat(64),'SELECTED_BOOT_HISTORY_CURRENT_PIN'],
  [r=>r.recordsets[7].push({copy_id:'unregistered'}),'BUSINESS_DAILY_NATIVE_CHECK_UNCONFIGURED'],
  [r=>r.recordsets[9].pop(),'SELECTED_BOOT_NATIVE_SCHEMA'],
  [r=>r.recordsets[9].push(structuredClone(r.recordsets[9][0])),'SELECTED_BOOT_NATIVE_SCHEMA'],
  [r=>r.recordsets[9][0].schemaName='another_schema','SELECTED_BOOT_NATIVE_SCHEMA'],
  [r=>r.recordsets[9][0].typeName='sql_variant','SELECTED_BOOT_NATIVE_SCHEMA'],
  [r=>{r.recordsets[0][0].copyLockMode=r.recordsets[10][0].copyLockMode='NoLock';},'SELECTED_BOOT_TRANSACTION'],
  [r=>{r.recordsets[0][0].isolationLevel=r.recordsets[10][0].isolationLevel=2;},'SELECTED_BOOT_TRANSACTION'],
  [r=>r.recordsets[10][0].sessionId=92,'SELECTED_BOOT_SAME_TRANSACTION'],
  [r=>r.recordsets[10][0].transactionId='1002','SELECTED_BOOT_SAME_TRANSACTION'],
  [r=>{r.recordsets[0][0].queryPlanRegistryExists=r.recordsets[10][0].queryPlanRegistryExists=true;},'SELECTED_BOOT_MANIFEST'],
  [r=>{r.recordsets[0][0].moduleManifestRows=r.recordsets[10][0].moduleManifestRows=184;},'SELECTED_BOOT_MANIFEST'],
  [r=>{r.recordsets[0][0].login=r.recordsets[10][0].login='another_writer';},'ISOLATED_COPY_DB_IDENTITY'],
 ];
 for(const [mutate,code] of cases){const copy=validateIsolatedOperationCopyContext(source.copy),result=structuredClone(source.result);mutate(result);const run=()=>configureBusinessSelectedSaleRevision({copy,...source.options,request:{query:async()=>result}});await assert.rejects(run,code?{code}:undefined);assert.equal(getRegisteredBusinessSelectedSaleRevision(copy),null);assert.equal(getBusinessDailyHomeReadRevisions(copy),null);}
});

test('consistent caller-provided hash substitutions fail canonical regeneration before original copy registration',async()=>{
 const f=await fixture(),options=structuredClone(f.options),result=structuredClone(f.result);
 options.selectedRevision.modules[6].afterHash='F'.repeat(64);
 const {revisionHash:old,...body}=options.selectedRevision;options.selectedRevision.revisionHash=isolatedCopyHash(body);
 for(const r of result.recordsets[8]){r.revisionHash=options.selectedRevision.revisionHash;if(r.name===options.selectedRevision.modules[6].name)r.afterHash=r.actualHash='F'.repeat(64);}
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:{query:async()=>result}}),{code:'SELECTED_BOOT_CANONICAL_REVISION'});
 assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});

test('native readonly startup proves the finite reader principal explicitly and retains it on re-verification',async()=>{
 const f=await fixture(),reader=isolatedCopyTopology(f.copy).reader;
 for(const rows of [f.result.recordsets[0],f.result.recordsets[10]])Object.assign(rows[0],{login:reader,databaseUser:reader});
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options}),{code:'ISOLATED_COPY_DB_IDENTITY'});
 const value=await configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options,nativeReadOnly:true});
 assert.equal(value.revision.version,6);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);
 for(const rows of [f.result.recordsets[0],f.result.recordsets[10]])Object.assign(rows[0],{login:f.copy.target.login,databaseUser:f.copy.target.databaseUser});
 await assert.rejects(()=>verifyBusinessSelectedSaleRevision(f.copy,f.request),{code:'SELECTED_BOOT_READER_IDENTITY'});
 const wrong=await fixture();await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:wrong.copy,request:wrong.request,...wrong.options,nativeReadOnly:true}),{code:'SELECTED_BOOT_READER_IDENTITY'});
});

test('JSON startup null for the absent optional adjunct still requires native unconfigured proof',async()=>{
 const f=await fixture(),options=JSON.parse(JSON.stringify({...f.options,nativeCheck:null}));
 const value=await configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...options});
 assert.equal(value.revision.version,6);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);
 const invalid=await fixture();invalid.result.recordsets[6][0].registryExists=true;
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:invalid.copy,request:invalid.request,...invalid.options,nativeCheck:null}),{code:'BUSINESS_DAILY_NATIVE_CHECK_UNCONFIGURED'});
 assert.equal(getRegisteredBusinessSelectedSaleRevision(invalid.copy),null);
});

test('native proof reader reads all registries and contains no effect, permission, or object mutations',()=>{
 assert.match(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/CURRENT_TRANSACTION_ID\(\)/);
 assert.match(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/FROM dbo.stage4_copy_business_selected_sale_revisions r WITH\(HOLDLOCK\) ORDER BY r.name/);
 assert.doesNotMatch(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|DENY|REVOKE)\b/i);
 assert.match(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/dbo.stage4_copy_business_daily_revisions/);
 assert.match(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/dbo.stage4_copy_business_daily_profit_revisions/);
 assert.match(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,/JOIN sys.columns c ON c.object_id=t.object_id/);
});
