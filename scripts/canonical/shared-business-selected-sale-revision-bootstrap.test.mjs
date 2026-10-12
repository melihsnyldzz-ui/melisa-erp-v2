import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {capturedFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {assertPreparedSelectedRevisionArtifact} from './shared-business-selected-sale-revision-sql.mjs';
import {buildBusinessSelectedSaleEffectsRevision,assertPreparedSelectedEffectsRevisionArtifact} from './shared-business-selected-sale-effects-revision-sql.mjs';
import {buildBusinessSelectedSaleParentRevision,assertPreparedSelectedParentRevisionArtifact} from './shared-business-selected-sale-parent-revision-sql.mjs';
import {isolatedCopyHash,isolatedCopyJSON,isolatedCopyTopology,validateIsolatedOperationCopyContext,getBusinessDailyHomeReadRevisions,assertIsolatedCopyReadProof} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,configureBusinessSelectedSaleRevision,getRegisteredBusinessSelectedSaleRevision,verifyBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {buildSupplierItemQuarantineParentRevision} from './shared-business-supplier-item-quarantine-parent-revision-sql.mjs';
import {SUPPLIER_ITEM_QUARANTINE_BASE} from './shared-business-supplier-item-quarantine-revision.mjs';
import {OPERATION_QUARANTINE_BASE} from './shared-business-operation-quarantine-revision.mjs';
import {buildOperationQuarantineParentRevision} from './shared-business-operation-quarantine-parent-revision-sql.mjs';
import {OPERATION_QUARANTINE_REVISION_PROOF_SQL} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {STOCK_PREDICATE_REVISION_PROOF_SQL,validateStockPredicateNativeProof,projectVerifiedStockPredicate} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {STOCK_PREDICATE_MODULES} from './shared-business-stock-predicate-distinct-revision-sql.mjs';
import {STOCK_PREDICATE_BASE,STOCK_PREDICATE_TRIGGER_ORDER,stockPredicateLeafProof} from './shared-business-stock-predicate-distinct-source.mjs';

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

async function effectsFixture(){
 const f=await fixture(),{copy}=await compileCapturedBusinessSelectedSaleRevision(f.input),overlay=buildBusinessSelectedSaleEffectsRevision({copy,daily:f.input.daily,profit:f.input.profit,schema:f.input.schema});
 const overlayRows=overlay.revision.modules.map(m=>({copyId:f.copy.copyId,name:m.name,revision:7,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.bundle.revision.revisionHash,profileHash:overlay.revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:overlay.revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:overlay.revision.immutableTriggerHash,triggerDisabled:0}));
 const overlayResult={recordsets:[structuredClone(f.result.recordsets[0]),overlayRows,structuredClone(f.result.recordsets[10])]};
 for(const rows of [...f.result.recordsets.slice(1,6),f.result.recordsets[8]])for(const r of rows){const m=overlay.revision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 f.options.selectedEffectsRevision=overlay.revision;f.calls.length=0;
 f.request={query:async sql=>{f.calls.push(sql);assert([BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL].includes(sql));return structuredClone(sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?overlayResult:f.result);}};
 return {...f,overlay,overlayResult};
}
test('v7 proves four native current modules first in the same transaction, retains sealed v6 and exposes separately current artifacts',async()=>{
 const f=await effectsFixture(),before=isolatedCopyJSON(f.result),overlayBefore=isolatedCopyJSON(f.overlayResult),optionsBefore=isolatedCopyJSON(f.options);
 const value=await configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options});
 assert.deepEqual(f.calls,[BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL]);
 assert.deepEqual(value.revision,f.bundle.revision);assert.equal(value.revision.version,6);assert.deepEqual(value.selectedEffectsRevision,f.overlay.revision);assert.equal(value.bundle.revision.version,7);
 assert.equal(value.bundle.contextArtifact.selectedRevisionHash,f.bundle.revision.revisionHash);assert.equal(value.bundle.contextArtifact.selectedEffectsRevisionHash,f.overlay.revision.revisionHash);
 assert.equal(assertPreparedSelectedEffectsRevisionArtifact(value.bundle.contextArtifact,f.copy,'context'),value.bundle.contextArtifact);assert.equal(assertPreparedSelectedEffectsRevisionArtifact(value.bundle.writeScopeArtifact,f.copy,'intent'),value.bundle.writeScopeArtifact);
 assertIsolatedCopyReadProof(f.copy,{copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes:value.parentHashes});
 assert.throws(()=>assertIsolatedCopyReadProof(f.copy,{copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes:f.bundle.parentHashes}),{code:'ISOLATED_COPY_READ_PROOF'});
 assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);assert.equal(f.calls.length,4);
 assert.equal(isolatedCopyJSON(f.result),before);assert.equal(isolatedCopyJSON(f.overlayResult),overlayBefore);assert.equal(isolatedCopyJSON(f.options),optionsBefore);
 assert.deepEqual(getBusinessDailyHomeReadRevisions(f.copy),{daily:f.input.dailyRevision,profit:f.input.profitRevision});
});
test('missing duplicated unknown drifted disabled overlay and cross-transaction history cannot register or project v7',async()=>{
 const source=await effectsFixture();
 const changes=[f=>f.overlayResult.recordsets[1].pop(),f=>f.overlayResult.recordsets[1].push(structuredClone(f.overlayResult.recordsets[1][0])),f=>f.overlayResult.recordsets[1][0].name='dbo.unknown',f=>f.overlayResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.overlayResult.recordsets[1][0].beforeHash='F'.repeat(64),f=>f.overlayResult.recordsets[1][0].triggerDisabled=1,f=>f.overlayResult.recordsets[1][0].immutableTriggerHash='F'.repeat(64),f=>f.overlayResult.recordsets[1][0].profileHash='F'.repeat(64),f=>f.overlayResult.recordsets[2][0].transactionId='1002',f=>{f.overlayResult.recordsets[0][0].sessionId=f.overlayResult.recordsets[2][0].sessionId=92;},f=>f.result.recordsets[8][0].actualHash='F'.repeat(64),f=>f.result.recordsets[1][0].actualHash='F'.repeat(64),f=>f.result.recordsets[4].pop(),f=>f.result.recordsets[9].pop(),f=>{f.overlayResult.recordsets[0][0].moduleManifestRows=f.overlayResult.recordsets[2][0].moduleManifestRows=184;}];
 for(const change of changes){const f={...source,copy:validateIsolatedOperationCopyContext(source.copy),result:structuredClone(source.result),overlayResult:structuredClone(source.overlayResult)},calls=[];change(f);await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...source.options,request:{query:async sql=>{calls.push(sql);return sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?f.overlayResult:f.result;}}}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);assert.equal(calls[0],BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL);}
});
test('consistent caller v7 substitutions still fail canonical regeneration before original history registration',async()=>{
 const f=await effectsFixture(),options=structuredClone(f.options),overlay=structuredClone(f.overlayResult),result=structuredClone(f.result),module=options.selectedEffectsRevision.modules[1];module.afterHash='F'.repeat(64);const {revisionHash,...body}=options.selectedEffectsRevision;options.selectedEffectsRevision.revisionHash=isolatedCopyHash(body);
 for(const r of overlay.recordsets[1]){r.revisionHash=options.selectedEffectsRevision.revisionHash;if(r.name===module.name)r.afterHash=r.actualHash=module.afterHash;}
 for(const rows of [...result.recordsets.slice(1,6),result.recordsets[8]])for(const r of rows)if(r.name===module.name)r.actualHash=module.afterHash;
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:{query:async sql=>sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?overlay:result}}),{code:'SELECTED_EFFECTS_BOOT_CANONICAL_REVISION'});
 assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});
test('v7 readonly identity persists on re-verification, and legacy v6 cannot consume v7 current hashes',async()=>{
 const legacy=await effectsFixture(),options={...legacy.options};delete options.selectedEffectsRevision;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:legacy.copy,request:legacy.request,...options}),{code:'SELECTED_BOOT_NATIVE_PINS'});
 const f=await effectsFixture(),reader=isolatedCopyTopology(f.copy).reader;for(const result of [f.result,f.overlayResult])for(const index of [0,result.recordsets.length-1])Object.assign(result.recordsets[index][0],{login:reader,databaseUser:reader});
 const value=await configureBusinessSelectedSaleRevision({copy:f.copy,request:f.request,...f.options,nativeReadOnly:true});assert.equal(value.selectedEffectsRevision.version,7);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);
 for(const index of [0,2])Object.assign(f.overlayResult.recordsets[index][0],{login:f.copy.target.login,databaseUser:f.copy.target.databaseUser});await assert.rejects(()=>verifyBusinessSelectedSaleRevision(f.copy,f.request),{code:'SELECTED_BOOT_READER_IDENTITY'});
});
test('v7 native proof SQL reads exact immutable overlay with metadata frames and has no write or grant',()=>{
 assert.match(BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,/FROM dbo.stage4_copy_business_selected_sale_effects_revisions r WITH\(HOLDLOCK\) ORDER BY r.name/);assert.match(BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,/immutable_stage4_copy_business_selected_sale_effects_revisions/);assert.equal(BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL.split('CURRENT_TRANSACTION_ID()').length,3);assert.doesNotMatch(BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|DENY|REVOKE)\b/i);
});

async function parentFixture(){
 const f=await effectsFixture(),{copy}=await compileCapturedBusinessSelectedSaleRevision(f.input),parent=buildBusinessSelectedSaleParentRevision({copy,daily:f.input.daily,profit:f.input.profit,schema:f.input.schema});
 const rows=parent.revision.modules.map(m=>({copyId:f.copy.copyId,name:m.name,revision:8,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.bundle.revision.revisionHash,baseEffectsRevisionHash:f.overlay.revision.revisionHash,profileHash:parent.revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:parent.revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:parent.revision.immutableTriggerHash,triggerDisabled:0}));
 const parentResult={recordsets:[structuredClone(f.result.recordsets[0]),rows,structuredClone(f.result.recordsets[10])]};
 for(const group of [...f.result.recordsets.slice(1,6),f.result.recordsets[8],f.overlayResult.recordsets[1]])for(const r of group){const m=parent.revision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 f.options.selectedParentRevision=parent.revision;f.calls.length=0;
 const query=sql=>sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?parentResult:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?f.overlayResult:f.result;
 f.request={query:async sql=>{f.calls.push(sql);assert([BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL].includes(sql));return structuredClone(query(sql));}};
 return {...f,parent,parentResult};
}
test('v8 proves current parents first, preserves v6 and v7 seals, and returns separately branded effective pins',async()=>{
 const f=await parentFixture(),snapshot=[f.options,f.result,f.overlayResult,f.parentResult].map(isolatedCopyJSON),value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request});
 const sequence=[BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL];assert.deepEqual(f.calls,sequence);
 assert.deepEqual(value.revision,f.bundle.revision);assert.deepEqual(value.selectedEffectsRevision,f.overlay.revision);assert.deepEqual(value.selectedParentRevision,f.parent.revision);assert.equal(value.bundle.revision.version,8);
 for(const [kind,artifact] of [['context',value.bundle.contextArtifact],['intent',value.bundle.writeScopeArtifact]]){assert.equal(artifact.selectedRevisionHash,f.bundle.revision.revisionHash);assert.equal(artifact.selectedEffectsRevisionHash,f.overlay.revision.revisionHash);assert.equal(artifact.selectedParentRevisionHash,f.parent.revision.revisionHash);assert.equal(assertPreparedSelectedParentRevisionArtifact(artifact,f.copy,kind),artifact);assert.throws(()=>assertPreparedSelectedParentRevisionArtifact(structuredClone(artifact),f.copy,kind));}
 const read=definitionHashes=>({copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes});assertIsolatedCopyReadProof(f.copy,read(value.parentHashes));assert.throws(()=>assertIsolatedCopyReadProof(f.copy,read(f.overlay.parentHashes)),{code:'ISOLATED_COPY_READ_PROOF'});assert.throws(()=>assertIsolatedCopyReadProof(f.copy,read(f.bundle.parentHashes)),{code:'ISOLATED_COPY_READ_PROOF'});
 assert.equal(value.parentHashes.effects,f.overlay.parentHashes.effects);assert.notEqual(value.parentHashes.ready,f.overlay.parentHashes.ready);
 assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);assert.deepEqual(f.calls,[...sequence,...sequence]);assert.deepEqual([f.options,f.result,f.overlayResult,f.parentResult].map(isolatedCopyJSON),snapshot);assert.deepEqual(getBusinessDailyHomeReadRevisions(f.copy),{daily:f.input.dailyRevision,profit:f.input.profitRevision});
});
test('v8 missing duplicate unknown native drift, disabled trigger and mixed transactions cannot register or project history',async()=>{
 const source=await parentFixture(),changes=[f=>f.parentResult.recordsets[1].pop(),f=>f.parentResult.recordsets[1].push(structuredClone(f.parentResult.recordsets[1][0])),f=>f.parentResult.recordsets[1][0].name='dbo.unknown',f=>f.parentResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.parentResult.recordsets[1][0].beforeHash='F'.repeat(64),f=>f.parentResult.recordsets[1][0].baseEffectsRevisionHash='F'.repeat(64),f=>f.parentResult.recordsets[1][0].triggerDisabled=1,f=>f.parentResult.recordsets[1][0].immutableTriggerHash='F'.repeat(64),f=>f.parentResult.recordsets[1][0].profileHash='F'.repeat(64),f=>f.parentResult.recordsets[2][0].transactionId='1002',f=>{f.parentResult.recordsets[0][0].sessionId=f.parentResult.recordsets[2][0].sessionId=92;},f=>f.overlayResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.overlayResult.recordsets[1][0].triggerDisabled=1,f=>f.result.recordsets[8].find(r=>r.name==='dbo.usp_business_daily_context').actualHash='F'.repeat(64),f=>f.result.recordsets[1][0].actualHash='F'.repeat(64),f=>f.result.recordsets[4].pop(),f=>f.result.recordsets[9].pop(),f=>{f.parentResult.recordsets[0][0].moduleManifestRows=f.parentResult.recordsets[2][0].moduleManifestRows=184;}];
 for(const change of changes){const f={copy:validateIsolatedOperationCopyContext(source.copy),result:structuredClone(source.result),overlayResult:structuredClone(source.overlayResult),parentResult:structuredClone(source.parentResult)},calls=[];change(f);await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...source.options,request:{query:async sql=>{calls.push(sql);return sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?f.parentResult:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?f.overlayResult:f.result;}}}));assert.equal(calls[0],BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);}
});
test('consistent forged v8 current hashes fail canonical regeneration before original history registration',async()=>{
 const f=await parentFixture(),options=structuredClone(f.options),parentResult=structuredClone(f.parentResult),result=structuredClone(f.result),module=options.selectedParentRevision.modules[1];module.afterHash='F'.repeat(64);const {revisionHash,...body}=options.selectedParentRevision;options.selectedParentRevision.revisionHash=isolatedCopyHash(body);
 for(const r of parentResult.recordsets[1]){r.revisionHash=options.selectedParentRevision.revisionHash;if(r.name===module.name)r.afterHash=r.actualHash=module.afterHash;}
 for(const rows of [...result.recordsets.slice(1,6),result.recordsets[8]])for(const r of rows)if(r.name===module.name)r.actualHash=module.afterHash;
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:{query:async sql=>sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?parentResult:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?structuredClone(f.overlayResult):result}}),{code:'SELECTED_PARENT_BOOT_CANONICAL_REVISION'});assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});
test('v8 requires the sealed v7 predecessor and preserves reader identity on all three proofs and re-verification',async()=>{
 const absent=await parentFixture(),options={...absent.options};delete options.selectedEffectsRevision;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:absent.copy,...options,request:absent.request}),{code:'SELECTED_PARENT_BOOT_REVISION'});assert.equal(absent.calls.length,0);
 const legacy=await parentFixture(),old={...legacy.options};delete old.selectedParentRevision;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:legacy.copy,...old,request:legacy.request}),{code:'SELECTED_EFFECTS_BOOT_NATIVE_PINS'});
 const f=await parentFixture(),reader=isolatedCopyTopology(f.copy).reader;for(const result of [f.parentResult,f.overlayResult,f.result])for(const index of [0,result.recordsets.length-1])Object.assign(result.recordsets[index][0],{login:reader,databaseUser:reader});const value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request,nativeReadOnly:true});assert.equal(value.selectedParentRevision.version,8);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);
 for(const index of [0,2])Object.assign(f.parentResult.recordsets[index][0],{login:f.copy.target.login,databaseUser:f.copy.target.databaseUser});await assert.rejects(()=>verifyBusinessSelectedSaleRevision(f.copy,f.request),{code:'SELECTED_BOOT_READER_IDENTITY'});
});
test('v8 proof SQL reads only finite native registry and immutable trigger with matching transaction frames',()=>{
 assert.match(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,/FROM dbo.stage4_copy_business_selected_sale_parent_revisions r WITH\(HOLDLOCK\) ORDER BY r.name/);assert.match(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,/r.base_effects_revision_hash baseEffectsRevisionHash/);assert.match(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,/immutable_stage4_copy_business_selected_sale_parent_revisions/);assert.equal(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL.split('CURRENT_TRANSACTION_ID()').length,3);assert.doesNotMatch(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|DENY|REVOKE)\b/i);
});

const quarantinePrivatePath=process.env.MELISA_PRIVATE_SUPPLIER_ITEM_TRIGGER;
const operationPrivatePath=process.env.MELISA_PRIVATE_OPERATION_QUARANTINE_ASSERT;
async function quarantineFixture(){
 const f=await parentFixture(),{copy}=await compileCapturedBusinessSelectedSaleRevision(f.input),base=SUPPLIER_ITEM_QUARANTINE_BASE,source={name:base.name,definition:fs.readFileSync(quarantinePrivatePath,'utf8'),nativeHash:base.definitionSha256.toUpperCase(),utf8Hash:base.sourceUtf8Sha256.toUpperCase()},quarantine=buildSupplierItemQuarantineParentRevision({copy,daily:f.input.daily,profit:f.input.profit,schema:f.input.schema,supplierItemQuarantineSource:source});
 const rows=quarantine.revision.modules.map((m,i)=>({copyId:f.copy.copyId,name:m.name,revision:9,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.bundle.revision.revisionHash,baseEffectsRevisionHash:f.overlay.revision.revisionHash,baseParentRevisionHash:f.parent.revision.revisionHash,profileHash:quarantine.revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:quarantine.revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:quarantine.revision.immutableTriggerHash,triggerDisabled:0,moduleType:i===0?'TR':'P',moduleDisabled:0,parentName:i===0?'dbo.sales_invoice_items':null,baseManifestHash:i===0?m.beforeHash:null}));
 const quarantineResult={recordsets:[structuredClone(f.result.recordsets[0]),rows,structuredClone(f.result.recordsets[10])]};
 for(const group of [...f.result.recordsets.slice(1,6),f.result.recordsets[8],f.overlayResult.recordsets[1],f.parentResult.recordsets[1]])for(const r of group){const m=quarantine.revision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 Object.assign(f.options,{supplierItemQuarantineRevision:quarantine.revision,supplierItemQuarantineSource:source});f.calls.length=0;
 const query=sql=>sql===SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL?quarantineResult:sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?f.parentResult:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?f.overlayResult:f.result;
 f.request={query:async sql=>{f.calls.push(sql);assert([SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL].includes(sql));return structuredClone(query(sql));}};
 return {...f,quarantine,quarantineResult};
}
test('v9 native proof SQL preserves before/after SSPI scope and emits exact leaf type/parent/enabled and baseline witnesses',()=>{
 assert.match(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/FROM dbo.stage4_copy_supplier_item_quarantine_revisions r WITH\(HOLDLOCK\)/);assert.match(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/r.base_parent_revision_hash baseParentRevisionHash/);assert.match(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/RTRIM\(o.type\) moduleType/);assert.match(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/o.parent_object_id/);assert.match(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/FROM dbo.stage4_copy_module_manifest WHERE name=r.name/);assert.equal(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL.split('CURRENT_TRANSACTION_ID()').length,3);assert.doesNotMatch(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|DENY|REVOKE)\b/i);
});
test('v9 rejects missing source pair before any native query and leaves history unregistered',async()=>{
 const f=await parentFixture(),options=structuredClone(f.options);options.supplierItemQuarantineRevision={};await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:f.request}),{code:'SUPPLIER_ITEM_BOOT_SOURCE_REQUIRED'});assert.equal(f.calls.length,0);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('ROOT v9 proves exact five modules first, projects v8/v7/v6 only in same TX, and earns current server artifacts',{skip:!quarantinePrivatePath},async()=>{
 const f=await quarantineFixture(),snapshot=[f.options,f.result,f.overlayResult,f.parentResult,f.quarantineResult].map(isolatedCopyJSON),value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request});
 const sequence=[SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL];assert.deepEqual(f.calls,sequence);assert.deepEqual(value.revision,f.bundle.revision);assert.deepEqual(value.selectedEffectsRevision,f.overlay.revision);assert.deepEqual(value.selectedParentRevision,f.parent.revision);assert.deepEqual(value.supplierItemQuarantineRevision,f.quarantine.revision);assert.equal(value.bundle.revision.version,9);assert.equal(value.parentHashes.effects,f.parent.parentHashes.effects);
 for(const [a,k] of [[value.bundle.contextArtifact,'context'],[value.bundle.writeScopeArtifact,'intent']]){assert.equal(assertPreparedSelectedRevisionArtifact(a,f.copy,k),a);assert.equal(a.supplierItemQuarantineRevisionHash,f.quarantine.revision.revisionHash);assert.throws(()=>assertPreparedSelectedRevisionArtifact(structuredClone(a),f.copy,k));}
 const proof=definitionHashes=>({copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes});assertIsolatedCopyReadProof(f.copy,proof(value.parentHashes));assert.throws(()=>assertIsolatedCopyReadProof(f.copy,proof(f.parent.parentHashes)),{code:'ISOLATED_COPY_READ_PROOF'});assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);assert.deepEqual(f.calls,[...sequence,...sequence]);assert.deepEqual([f.options,f.result,f.overlayResult,f.parentResult,f.quarantineResult].map(isolatedCopyJSON),snapshot);
});
test('ROOT v9 missing/duplicate/unknown/hidden/disabled/wrong-parent/baseline/drift rows and mixed TX fail before registration',{skip:!quarantinePrivatePath},async()=>{
 const source=await quarantineFixture(),changes=[f=>f.quarantineResult.recordsets[1].pop(),f=>f.quarantineResult.recordsets[1].push(structuredClone(f.quarantineResult.recordsets[1][0])),f=>f.quarantineResult.recordsets[1][0].name='dbo.other',f=>f.quarantineResult.recordsets[1][0].actualHash=null,f=>f.quarantineResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.quarantineResult.recordsets[1][0].moduleDisabled=1,f=>f.quarantineResult.recordsets[1][0].moduleType='P',f=>f.quarantineResult.recordsets[1][0].parentName='dbo.purchase_invoice_items',f=>f.quarantineResult.recordsets[1][0].baseManifestHash='F'.repeat(64),f=>f.quarantineResult.recordsets[1][0].triggerDisabled=1,f=>f.quarantineResult.recordsets[1][0].immutableTriggerHash='F'.repeat(64),f=>f.quarantineResult.recordsets[1][0].baseParentRevisionHash='F'.repeat(64),f=>f.quarantineResult.recordsets[2][0].transactionId='1002',f=>{f.quarantineResult.recordsets[0][0].moduleManifestRows=f.quarantineResult.recordsets[2][0].moduleManifestRows=184;},f=>f.parentResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.overlayResult.recordsets[1][0].actualHash='F'.repeat(64),f=>f.result.recordsets[4].pop()];
 for(const change of changes){const f={copy:validateIsolatedOperationCopyContext(source.copy),quarantineResult:structuredClone(source.quarantineResult),parentResult:structuredClone(source.parentResult),overlayResult:structuredClone(source.overlayResult),result:structuredClone(source.result)},calls=[];change(f);await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...source.options,request:{query:async sql=>{calls.push(sql);return structuredClone(sql===SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL?f.quarantineResult:sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?f.parentResult:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?f.overlayResult:f.result);}}}));assert.equal(calls[0],SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);}
});
test('ROOT forged coherent v9 self-reported pins still fail independent canonical generation',{skip:!quarantinePrivatePath},async()=>{
 const f=await quarantineFixture(),options=structuredClone(f.options),results=[f.quarantineResult,f.parentResult,f.overlayResult,f.result].map(v=>structuredClone(v)),m=options.supplierItemQuarantineRevision.modules[1];m.afterHash='F'.repeat(64);const {revisionHash,...body}=options.supplierItemQuarantineRevision;options.supplierItemQuarantineRevision.revisionHash=isolatedCopyHash(body);
 for(const rows of results[0].recordsets.slice(1,2))for(const r of rows){r.revisionHash=options.supplierItemQuarantineRevision.revisionHash;if(r.name===m.name)r.afterHash=r.actualHash=m.afterHash;}
 for(const result of results.slice(1))for(const rows of result.recordsets)for(const r of rows)if(r.name===m.name)r.actualHash=m.afterHash;
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:{query:async sql=>structuredClone(results[sql===SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL?0:sql===BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL?1:sql===BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL?2:3])}}),{code:'SUPPLIER_ITEM_BOOT_CANONICAL_REVISION'});assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});
test('ROOT v9 readonly identity and leaf current proof persist on every re-verification',{skip:!quarantinePrivatePath},async()=>{
 const f=await quarantineFixture(),reader=isolatedCopyTopology(f.copy).reader;for(const r of [f.quarantineResult,f.parentResult,f.overlayResult,f.result])for(const i of [0,r.recordsets.length-1])Object.assign(r.recordsets[i][0],{login:reader,databaseUser:reader});const value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request,nativeReadOnly:true});assert.equal(value.bundle.revision.version,9);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);f.quarantineResult.recordsets[1][0].actualHash=null;await assert.rejects(()=>verifyBusinessSelectedSaleRevision(f.copy,f.request),{code:'SUPPLIER_ITEM_BOOT_NATIVE_PINS'});
});
test('ROOT legacy v8 startup cannot silently consume v9 definitions or omit the v8 predecessor',{skip:!quarantinePrivatePath},async()=>{
 const f=await quarantineFixture(),old={...f.options};delete old.supplierItemQuarantineRevision;delete old.supplierItemQuarantineSource;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...old,request:f.request}),{code:'SELECTED_PARENT_BOOT_NATIVE_PINS'});assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
 const missing=await quarantineFixture(),options={...missing.options};delete options.selectedParentRevision;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:missing.copy,...options,request:missing.request}),{code:'SUPPLIER_ITEM_BOOT_REVISION'});assert.equal(missing.calls.length,0);assert.equal(getRegisteredBusinessSelectedSaleRevision(missing.copy),null);
});

async function operationFixture(){
 const f=await quarantineFixture(),{copy}=await compileCapturedBusinessSelectedSaleRevision(f.input),base=OPERATION_QUARANTINE_BASE,source={name:base.name,definition:fs.readFileSync(operationPrivatePath,'utf8'),nativeHash:base.definitionSha256.toUpperCase(),utf8Hash:base.sourceUtf8Sha256.toUpperCase()},operation=buildOperationQuarantineParentRevision({copy,daily:f.input.daily,profit:f.input.profit,schema:f.input.schema,supplierItemQuarantineSource:f.options.supplierItemQuarantineSource,operationQuarantineSource:source});
 const rows=operation.revision.modules.map((m,i)=>({copyId:f.copy.copyId,name:m.name,revision:10,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.bundle.revision.revisionHash,baseEffectsRevisionHash:f.overlay.revision.revisionHash,baseParentRevisionHash:f.parent.revision.revisionHash,baseSupplierItemQuarantineRevisionHash:f.quarantine.revision.revisionHash,profileHash:operation.revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:operation.revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:operation.revision.immutableTriggerHash,triggerDisabled:0,moduleType:'P',baseManifestHash:i===0?m.beforeHash:null}));
 const operationResult={recordsets:[structuredClone(f.result.recordsets[0]),rows,structuredClone(f.result.recordsets[10])]};
 for(const group of [...f.result.recordsets.slice(1,6),f.result.recordsets[8],f.overlayResult.recordsets[1],f.parentResult.recordsets[1],f.quarantineResult.recordsets[1]])for(const r of group){const m=operation.revision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 Object.assign(f.options,{operationQuarantineRevision:operation.revision,operationQuarantineSource:source});f.calls.length=0;
 const results=new Map([[OPERATION_QUARANTINE_REVISION_PROOF_SQL,operationResult],[SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,f.quarantineResult],[BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,f.parentResult],[BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,f.overlayResult],[BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,f.result]]);
 f.request={query:async sql=>{f.calls.push(sql);assert(results.has(sql));return structuredClone(results.get(sql));}};return{...f,operation,operationResult,results};
}
test('v10 metadata reader is finite SELECT-only and requires a paired descriptor/source before any query',async()=>{
 assert.match(OPERATION_QUARANTINE_REVISION_PROOF_SQL,/stage4_copy_operation_quarantine_revisions r WITH\(HOLDLOCK\)/);assert.match(OPERATION_QUARANTINE_REVISION_PROOF_SQL,/base_supplier_item_quarantine_revision_hash/);assert.match(OPERATION_QUARANTINE_REVISION_PROOF_SQL,/baseManifestHash/);assert.equal(OPERATION_QUARANTINE_REVISION_PROOF_SQL.split('CURRENT_TRANSACTION_ID()').length,3);assert.doesNotMatch(OPERATION_QUARANTINE_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
 const f=await parentFixture();await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,operationQuarantineRevision:{},request:f.request}),{code:'OPERATION_QUARANTINE_BOOT_SOURCE_REQUIRED'});assert.equal(f.calls.length,0);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});

async function stockPredicateModelFixture(){
 const f=await fixture(),operation={revisionHash:'A'.repeat(64)},source={objectIds:Object.fromEntries(STOCK_PREDICATE_MODULES.map((n,i)=>[n,100+i])),triggerOrder:{...STOCK_PREDICATE_TRIGGER_ORDER}},body={schemaVersion:'melisa-private-stock-predicate-forward-revision.v1',version:11,copyId:f.copy.copyId,baseSealHash:f.copy.sealHash,baseOperationQuarantineRevisionHash:operation.revisionHash,profileHash:isolatedCopyHash(f.copy),modules:STOCK_PREDICATE_MODULES.map((name,i)=>({name,type:i===0?'TR':'P',beforeHash:i===0?STOCK_PREDICATE_BASE.nativeHash:'B'.repeat(64),afterHash:'C'.repeat(64)})),immutableTriggerHash:'D'.repeat(64),repair:'DISTINCT_AFFECTED_STOCK_HOLD_DOMAINS',leafProof:stockPredicateLeafProof()},revision={...body,revisionHash:isolatedCopyHash(body)};
 const rows=revision.modules.map((m,i)=>({copyId:f.copy.copyId,name:m.name,revision:11,baseSealHash:f.copy.sealHash,baseOperationQuarantineRevisionHash:revision.baseOperationQuarantineRevisionHash,profileHash:revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:revision.immutableTriggerHash,triggerDisabled:0,objectId:source.objectIds[m.name],moduleType:m.type,moduleDisabled:0,parentName:i===0?'dbo.stock_movements':null,baseManifestHash:i===0?m.beforeHash:null,...STOCK_PREDICATE_TRIGGER_ORDER}));
 return {...f,source,stockRevision:revision,stockResult:{recordsets:[structuredClone(f.result.recordsets[0]),rows,structuredClone(f.result.recordsets[10])]}};
}
test('V11 reads six mixed native definitions, object IDs, stock parent, enabled state and BOTH first/last orders in one finite readonly proof',async()=>{
 assert.match(STOCK_PREDICATE_REVISION_PROOF_SQL,/stage4_copy_stock_predicate_revisions r WITH\(HOLDLOCK\)/);
 for(const property of ['ExecIsTriggerDisabled','ExecIsFirstInsertTrigger','ExecIsFirstUpdateTrigger','ExecIsFirstDeleteTrigger','ExecIsLastInsertTrigger','ExecIsLastUpdateTrigger','ExecIsLastDeleteTrigger'])assert(STOCK_PREDICATE_REVISION_PROOF_SQL.includes(property));
 assert.match(STOCK_PREDICATE_REVISION_PROOF_SQL,/o.object_id objectId/);assert.match(STOCK_PREDICATE_REVISION_PROOF_SQL,/o.parent_object_id/);assert.equal(STOCK_PREDICATE_REVISION_PROOF_SQL.split('CURRENT_TRANSACTION_ID()').length,3);assert.doesNotMatch(STOCK_PREDICATE_REVISION_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|DENY|REVOKE|EXEC)\b/i);
 const f=await stockPredicateModelFixture(),before=isolatedCopyJSON(f.stockResult);assert.equal(validateStockPredicateNativeProof(f.copy,f.stockRevision,f.source,f.stockResult,false),f.stockResult);assert.equal(isolatedCopyJSON(f.stockResult),before);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});
test('V11 modeled fresh proof rejects missing duplicate unknown NULL native IDs/hash/type/parent/enabled/order or mixed transaction before registration',async()=>{
 const f=await stockPredicateModelFixture(),changes=[v=>v.recordsets[1].pop(),v=>v.recordsets[1].push(structuredClone(v.recordsets[1][0])),v=>v.recordsets[1][0].name='dbo.other',v=>v.recordsets[1][0].actualHash=null,v=>v.recordsets[1][0].objectId=null,v=>v.recordsets[1][0].objectId++,v=>v.recordsets[1][0].objectId=1.5,v=>v.recordsets[1][0].moduleType='P',v=>v.recordsets[1][0].moduleDisabled=1,v=>v.recordsets[1][0].parentName='dbo.sales_invoice_items',v=>v.recordsets[1][0].baseManifestHash='F'.repeat(64),v=>v.recordsets[1][0].immutableTriggerHash=null,v=>v.recordsets[1][0].triggerDisabled=1,v=>v.recordsets[1][0].baseOperationQuarantineRevisionHash='F'.repeat(64),v=>v.recordsets[1][0].extra=true,v=>v.recordsets[2][0].transactionId='1002',v=>v.recordsets[0][0].copyLockMode='NoLock',v=>v.recordsets[0][0].moduleManifestRows=184,v=>v.recordsets[0][0].sysadmin=1,...Object.keys(STOCK_PREDICATE_TRIGGER_ORDER).map(k=>v=>v.recordsets[1][0][k]=1),v=>v.recordsets[1][1].lastDelete=1,v=>v.recordsets[1][1].parentName='dbo.stock_movements',v=>v.recordsets[1][1].moduleDisabled=1];
 for(const change of changes){const result=structuredClone(f.stockResult);change(result);assert.throws(()=>validateStockPredicateNativeProof(f.copy,f.stockRevision,f.source,result,false));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);}
 const reader=isolatedCopyTopology(f.copy).reader,result=structuredClone(f.stockResult);for(const i of [0,2])Object.assign(result.recordsets[i][0],{login:reader,databaseUser:reader});assert.equal(validateStockPredicateNativeProof(f.copy,f.stockRevision,f.source,result,true),result);assert.throws(()=>validateStockPredicateNativeProof(f.copy,f.stockRevision,f.source,result,false));
});
test('only same-transaction already-proved V11 current pins project to exact V10 predecessors; input witnesses stay immutable',async()=>{
 const f=await stockPredicateModelFixture(),raw=structuredClone(f.result);for(const rows of [...raw.recordsets.slice(1,6),raw.recordsets[8]])for(const r of rows){const m=f.stockRevision.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 const before=isolatedCopyJSON(raw),projected=projectVerifiedStockPredicate(f.stockRevision,f.stockResult,raw,true);assert.equal(isolatedCopyJSON(raw),before);
 for(const rows of [...projected.recordsets.slice(1,6),projected.recordsets[8]])for(const r of rows){const m=f.stockRevision.modules.find(m=>m.name===r.name);if(m)assert.equal(r.actualHash,m.beforeHash);}
 for(const edit of [v=>v.recordsets[10][0].transactionId='1002',v=>v.recordsets[8].find(r=>r.name==='dbo.usp_stage4_copy_ready').actualHash='F'.repeat(64)]){const v=structuredClone(raw);edit(v);assert.throws(()=>projectVerifiedStockPredicate(f.stockRevision,f.stockResult,v,true));}
 assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('unpaired V11 source or descriptor cannot perform a native query or widen registration on legacy startup',async()=>{
 for(const adjunct of [{stockPredicateRevision:{}},{stockPredicateSource:{}},{stockPredicateRevision:{},stockPredicateSource:{}}]){const f=await fixture();await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,...adjunct,request:f.request}));assert.equal(f.calls.length,0);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});
test('ROOT v10 proves current self and five native modules first, then exact v9/v8/v7/v6 and branded effective artifacts',{skip:!quarantinePrivatePath||!operationPrivatePath},async()=>{
 const f=await operationFixture(),before=[f.options,...f.results.values()].map(isolatedCopyJSON),value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request});const sequence=[...f.results.keys()];assert.deepEqual(f.calls,sequence);assert.equal(value.bundle.revision.version,10);assert.deepEqual(value.supplierItemQuarantineRevision,f.quarantine.revision);assert.deepEqual(value.operationQuarantineRevision,f.operation.revision);assert.deepEqual(value.revision,f.bundle.revision);assert.equal(value.parentHashes.effects,f.parent.parentHashes.effects);
 for(const [artifact,kind] of [[value.bundle.contextArtifact,'context'],[value.bundle.writeScopeArtifact,'intent']]){assert.equal(assertPreparedSelectedRevisionArtifact(artifact,f.copy,kind),artifact);assert.throws(()=>assertPreparedSelectedRevisionArtifact(structuredClone(artifact),f.copy,kind));}
 const proof=definitionHashes=>({copyId:f.copy.copyId,sealHash:f.copy.sealHash,backupSHA:f.copy.backupSHA,valid:true,definitionHashes});assertIsolatedCopyReadProof(f.copy,proof(value.parentHashes));assert.throws(()=>assertIsolatedCopyReadProof(f.copy,proof(f.quarantine.parentHashes)),{code:'ISOLATED_COPY_READ_PROOF'});assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);assert.deepEqual(f.calls,[...sequence,...sequence]);assert.deepEqual([f.options,...f.results.values()].map(isolatedCopyJSON),before);
});
test('ROOT v10 NULL/duplicate/wrong self/native/schema/old leaf/history/mixed-TX proofs cannot register',{skip:!quarantinePrivatePath||!operationPrivatePath},async()=>{
 const source=await operationFixture(),changes=[m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1].pop(),m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1].push(structuredClone(m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0])),m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0].actualHash=null,m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0].baseManifestHash='F'.repeat(64),m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0].moduleType='TR',m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0].triggerDisabled=1,m=>m.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[2][0].transactionId='1002',m=>m.get(SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL).recordsets[1][0].actualHash=null,m=>m.get(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL).recordsets[9].pop()];
 for(const change of changes){const copy=validateIsolatedOperationCopyContext(source.copy),results=new Map([...source.results].map(([k,v])=>[k,structuredClone(v)]));change(results);await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy,...source.options,request:{query:async sql=>structuredClone(results.get(sql))}}));assert.equal(getRegisteredBusinessSelectedSaleRevision(copy),null);assert.equal(getBusinessDailyHomeReadRevisions(copy),null);}
});
test('ROOT coherently forged v10 self hashes cannot pass independent canonical regeneration',{skip:!quarantinePrivatePath||!operationPrivatePath},async()=>{
 const f=await operationFixture(),options=structuredClone(f.options),results=new Map([...f.results].map(([k,v])=>[k,structuredClone(v)])),module=options.operationQuarantineRevision.modules[0];module.afterHash='F'.repeat(64);const {revisionHash,...body}=options.operationQuarantineRevision;options.operationQuarantineRevision.revisionHash=isolatedCopyHash(body);for(const r of results.get(OPERATION_QUARANTINE_REVISION_PROOF_SQL).recordsets[1]){r.revisionHash=options.operationQuarantineRevision.revisionHash;if(r.name===module.name)r.afterHash=r.actualHash=module.afterHash;}
 await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:f.copy,...options,request:{query:async sql=>structuredClone(results.get(sql))}}),{code:'OPERATION_QUARANTINE_BOOT_CANONICAL_REVISION'});assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);assert.equal(getBusinessDailyHomeReadRevisions(f.copy),null);
});
test('ROOT readonly v10 rechecks current self and refuses unregistered v9 fallback on actual v10 definitions',{skip:!quarantinePrivatePath||!operationPrivatePath},async()=>{
 const old=await operationFixture(),options={...old.options};delete options.operationQuarantineRevision;delete options.operationQuarantineSource;await assert.rejects(()=>configureBusinessSelectedSaleRevision({copy:old.copy,...options,request:old.request}),{code:'SUPPLIER_ITEM_BOOT_NATIVE_PINS'});assert.equal(getRegisteredBusinessSelectedSaleRevision(old.copy),null);
 const f=await operationFixture(),reader=isolatedCopyTopology(f.copy).reader;for(const r of f.results.values())for(const i of [0,r.recordsets.length-1])Object.assign(r.recordsets[i][0],{login:reader,databaseUser:reader});const value=await configureBusinessSelectedSaleRevision({copy:f.copy,...f.options,request:f.request,nativeReadOnly:true});assert.equal(value.bundle.revision.version,10);assert.equal(await verifyBusinessSelectedSaleRevision(f.copy,f.request),true);f.operationResult.recordsets[1][0].actualHash=null;await assert.rejects(()=>verifyBusinessSelectedSaleRevision(f.copy,f.request),{code:'OPERATION_QUARANTINE_BOOT_NATIVE_PINS'});
});
