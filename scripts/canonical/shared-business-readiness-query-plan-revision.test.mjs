import test from 'node:test';import assert from 'node:assert/strict';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {prepareReadinessQueryPlanRevision,validateReadinessQueryPlanPreparation,readinessProofTarget,READINESS_PROOF_DATABASE,READINESS_PROOF_LOGIN,QUERY_PLAN_REGISTRY} from './shared-business-readiness-query-plan-revision.mjs';
import {validateIsolatedReadinessQueryPlan,READINESS_PROOF_NEGATIVES,READINESS_PROOF_NEGATIVE_LAYERS} from './shared-business-readiness-query-plan-isolated.mjs';
const hash='A'.repeat(64),daily='B'.repeat(64),profit='C'.repeat(64),scope='D'.repeat(64),copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
function input(){
 const expression=x=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(${x})),2)`;
 const definition=`CREATE PROCEDURE dbo.usp_stage4_copy_ready @copy_id uniqueidentifier WITH EXECUTE AS OWNER AS BEGIN
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_CRM_SHARED_TEST_20261009_02' THROW 51904,'TARGET',1;
IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'melisa_shared_test_rw_20261009_02' THROW 51904,'LOGIN',1;
DECLARE @p nvarchar(max);DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');
IF(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions)<>8 OR EXISTS(SELECT 1 FROM dbo.stage4_copy_business_daily_revisions d WHERE d.base_seal_hash<>JSON_VALUE(@p,'$.sealHash') OR d.revision_hash<>N'${daily}' OR d.daily_scope_hash<>N'${scope}') THROW 51904,'BUSINESS_DAILY_REVISION_DRIFT',1;
IF(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_profit_revisions)<>3 OR EXISTS(SELECT 1 FROM dbo.stage4_copy_business_daily_profit_revisions v WHERE v.base_seal_hash<>JSON_VALUE(@p,'$.sealHash') OR v.revision_hash<>N'${profit}') THROW 51904,'BUSINESS_DAILY_PROFIT_REVISION_DRIFT',1;
IF EXISTS(SELECT 1 FROM @scopeParties s LEFT JOIN dbo.party_currency_accounts a ON a.id=s.accountId WHERE a.id IS NULL OR a.currency_code<>s.currency OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.native_entity_id=s.partyId)) THROW 51904,'STAGE4_PARTY_SCOPE_DRIFT',1;
IF EXISTS(SELECT 1 FROM @scopeParties s WHERE s.currency=N'LL' OR NOT EXISTS(SELECT 1 FROM @sourceAccounts r WHERE r.balance IS NOT NULL)) THROW 51904,'BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT',1;
SELECT ${expression('@@PROCID')};SELECT ${expression('@@PROCID')};
SELECT ${expression('o.object_id')} FROM sys.objects o;
SELECT ${expression('OBJECT_ID(d.name)')} FROM sys.objects d;
SELECT ${expression('OBJECT_ID(v.name)')} FROM sys.objects v;
SELECT ${expression('OBJECT_ID(w.name)')} FROM sys.objects w;
END;`;
 return {source:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',server:'Semih\\MELISADEV',copyId:copy,actualT1:false,definition,expectedDefinitionHash:moduleHash(definition)},baseSealHash:hash,baseDailyRevisionHash:daily,baseProfitRevisionHash:profit,dailyScopeHash:scope};
}
const prepared=()=>prepareReadinessQueryPlanRevision(input());
const target=b=>({server:b.target.server,database:READINESS_PROOF_DATABASE,login:READINESS_PROOF_LOGIN,copyId:copy,actualT1:false,isolated:true,sourceDatabase:b.target.database,sourceDefinitionHash:b.revision.modules[0].beforeHash});
function fixture(b=prepared()){
 const t=target(b),events=[],state={failure:null,identityPatch:null,equivalenceDrift:false,negativeDrift:false,rollbackDrift:false};
 const identity={server:t.server,database:t.database,originalLogin:t.login,copyId:copy,actualT1:false,dbOwner:1,sysadmin:0,accessShared:0,accessTest125:0,accessLive:0,sourceDefinitionHash:t.sourceDefinitionHash,protectedSchemaHash:hash,businessHash:hash,permissionsHash:hash,registryHistoryHash:hash};
 const adapter={
  async inspect(){events.push('inspect');return {...identity,...state.identityPatch};},
  async snapshot(){return state.rollbackDrift?'F'.repeat(64):hash;},
  async beginRollbackOnly(){events.push('begin');return{};},
  async installTemporaryRevision(tx,p){events.push(p.variant);tx.variant=p.variant;assert.equal(p.proofOnly,true);assert.equal(moduleHash(p.storedDefinition),p.afterHash);assert.equal(p.executionSQL,p.storedDefinition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE '));assert.equal(p.definition,undefined);const {revisionHash,...body}=p.revision;assert.equal(isolatedCopyHash(body),revisionHash);assert(p.immutableSQL.includes(READINESS_PROOF_DATABASE));if(state.failure==='install')throw Error('FIXTURE_INSTALL');},
  async observeReady(tx){if(state.failure==='ready')throw Error('FIXTURE_READY');return {result:'READY',elapsedMs:tx.variant==='baseline'?1500:300,queryPlanSha256:hash,logicalReads:42,sourceContributionHash:state.equivalenceDrift&&tx.variant==='candidate'?'E'.repeat(64):hash,actorPermissionsHash:hash};},
  async negativeProbe(tx,p){events.push('negative:'+p.kind);assert.equal(p.fullRollbackRequired,true);assert.equal(p.savepointRollbackRequired,undefined);const code=READINESS_PROOF_NEGATIVES.find(v=>v[0]===p.kind)[1],layer=READINESS_PROOF_NEGATIVE_LAYERS[p.kind][0];return {rejected:true,errorCode:state.negativeDrift&&tx.variant==='candidate'&&p.kind==='party_hold'?'DIFFERENT':code,layer:state.layerDrift&&tx.variant==='candidate'&&p.kind==='party_hold'?'upstream_native_business':layer,readinessPredicateExercised:!(state.layerDrift&&tx.variant==='candidate'&&p.kind==='party_hold')&&layer==='actual_ready',transactionState:state.doomed?-1:1};},
  async rollback(){events.push('rollback');if(state.failure==='rollback')throw Error('FIXTURE_ROLLBACK');},
  async assertEnded(){events.push('ended');if(state.failure==='ended')throw Error('FIXTURE_ENDED');}
 };return {bundle:b,target:t,adapter,events,state};
}
test('v6 preparation is append-only, exact predecessor pinned, guards fresh and non-installable',()=>{
 const b=prepared();assert.equal(b.revision.version,6);assert.equal(b.overlays.length,6);assert.equal(b.executeAllowed,false);assert.equal(b.installAllowed,false);assert.equal(b.rolesChanged,false);assert.equal(b.existingRegistriesUnchanged,true);assert.equal(validateReadinessQueryPlanPreparation(b).revision.revisionHash,b.revision.revisionHash);
 assert.match(b.immutableSQL,/EXISTS\(SELECT 1 FROM deleted\)/);assert.match(b.immutableSQL,/before_hash<>N'/);assert.match(b.createDefinition,/READINESS_QUERY_PLAN_DEFINITION_DRIFT/);assert.equal((b.createDefinition.match(/OPTION \(RECOMPILE\)/g)||[]).length,2);
 let reverted=b.createDefinition.replace("DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');\n"+b.guard,"DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');");for(const x of b.overlays)reverted=reverted.replace(x.replacement,x.expression);assert.equal(reverted,b.plan.createDefinition);
 assert(!/DISABLE TRIGGER|UPDATE dbo\.stage4_copy_|DELETE FROM|GRANT /i.test(b.tableSQL+b.immutableSQL));
});
test('changed parent/source pin, missing module anchor, collision and altered artifact rejected',()=>{
 for(const key of ['baseDailyRevisionHash','dailyScopeHash'])assert.throws(()=>prepareReadinessQueryPlanRevision({...input(),[key]:'F'.repeat(64)}));
 const changedParent=prepareReadinessQueryPlanRevision({...input(),baseProfitRevisionHash:'F'.repeat(64)});assert.match(changedParent.guard,/revision_hash<>N'FFFFFFFF/);assert.match(changedParent.guard,/READINESS_QUERY_PLAN_PARENT_DRIFT/);
 for(const mutate of [s=>s.replace('o.object_id','x.object_id'),s=>s+'\nDECLARE @readinessPreviousHash varchar(64);']){const i=input();i.source.definition=mutate(i.source.definition);i.source.expectedDefinitionHash=moduleHash(i.source.definition);assert.throws(()=>prepareReadinessQueryPlanRevision(i));}
 const b=prepared();for(const patch of [{installAllowed:true},{createDefinition:b.createDefinition+' '},{immutableSQL:b.immutableSQL+' '},{revision:{...b.revision,version:7}}])assert.throws(()=>validateReadinessQueryPlanPreparation({...b,...patch}));
});
test('proof is exact separate clone only; shared/LIVE/old stage4/unknown copy cannot be selected',()=>{
 const b=prepared(),t=target(b),p=readinessProofTarget(b,t);assert.equal(p.transactionMustRollback,true);assert.equal(p.historicalGuardOverlaySameInBoth,true);assert.notEqual(p.proofAfterHash,b.revision.modules[0].afterHash);assert(!p.immutableSQL.includes("IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1"));
 for(const database of [b.target.database,'LIVE','MELISA_ERP_STAGE04_COPY_TEST_20261008_01'])assert.throws(()=>readinessProofTarget(b,{...t,database}));
 for(const patch of [{actualT1:true},{copyId:'other'},{isolated:false},{login:'sa'},{approved:true}])assert.throws(()=>readinessProofTarget(b,{...t,...patch}));
 assert(p.candidateStoredDefinition.includes(READINESS_PROOF_DATABASE));assert(p.candidateStoredDefinition.includes(READINESS_PROOF_LOGIN));assert(p.baselineStoredDefinition.includes(p.proofTriggerHash));assert.equal((p.candidateStoredDefinition.match(/OPTION \(RECOMPILE\)/g)||[]).length,2);assert.equal((p.baselineStoredDefinition.match(/OPTION \(RECOMPILE\)/g)||[]).length,0);
 for(const [executionSQL,storedDefinition,afterHash]of[[p.baselineExecutionSQL,p.baselineStoredDefinition,p.proofBaselineHash],[p.candidateExecutionSQL,p.candidateStoredDefinition,p.proofAfterHash]]){assert(executionSQL.startsWith('ALTER PROCEDURE '));assert(storedDefinition.startsWith('CREATE PROCEDURE '));assert.equal(executionSQL.replace(/^ALTER PROCEDURE /,'CREATE PROCEDURE '),storedDefinition);assert.equal(moduleHash(storedDefinition),afterHash);assert.notEqual(moduleHash(executionSQL),afterHash);}assert(b.createDefinition.startsWith('CREATE PROCEDURE '));assert.equal(p.baselineDefinition,undefined);assert.equal(p.candidateDefinition,undefined);
});
test('duplicate native @@PROCID readiness gates are overlaid once each without rescanning nested ELSE hashes',()=>{
 const i=input(),expression="CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2)";
 i.source.definition=i.source.definition.replace(`SELECT ${expression};SELECT ${expression};`,`IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_ready_revisions r WHERE r.after_hash=${expression}) THROW 51904,'BUSINESS_READY_REVISION_DRIFT',1;\nIF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_ready_performance_revisions r WHERE r.after_hash=${expression}) THROW 51904,'BUSINESS_READY_PERFORMANCE_REVISION_DRIFT',1;`);
 i.source.expectedDefinitionHash=moduleHash(i.source.definition);
 const b=prepareReadinessQueryPlanRevision(i),candidateBefore=b.createDefinition,revisionBefore=b.revision.revisionHash,p=readinessProofTarget(b,target(b));
 assert.equal(b.overlays.length,6);assert.equal(b.overlays.filter(x=>x.expression===expression).length,2);
 for(const code of ['BUSINESS_READY_REVISION_DRIFT','BUSINESS_READY_PERFORMANCE_REVISION_DRIFT']){const original=i.source.definition.split('\n').find(line=>line.includes("'"+code+"'")),actual=p.baselineStoredDefinition.split('\n').find(line=>line.includes("'"+code+"'"));assert.equal(actual,original.replace(expression,b.overlays[0].replacement));assert.equal((actual.match(/CASE WHEN @@PROCID=/g)||[]).length,1);assert(!actual.includes('ELSE (CASE'));}
 assert.equal((p.baselineStoredDefinition.match(/CASE WHEN @@PROCID=/g)||[]).length,2);assert.equal((p.baselineStoredDefinition.match(/THEN @readinessPreviousHash ELSE/g)||[]).length,6);
 // The other four exact object expressions and source predicates are preserved.
 for(const overlay of b.overlays.slice(2))assert(p.baselineStoredDefinition.includes(overlay.replacement));
 for(const code of ['STAGE4_PARTY_SCOPE_DRIFT','BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT'])assert.equal(p.baselineStoredDefinition.split('\n').find(line=>line.includes("'"+code+"'")),i.source.definition.split('\n').find(line=>line.includes("'"+code+"'")));
 assert.equal(b.createDefinition,candidateBefore);assert.equal(b.revision.revisionHash,revisionBefore);assert.equal(p.candidateStoredDefinition,b.createDefinition.replaceAll("DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_CRM_SHARED_TEST_20261009_02'",`DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${READINESS_PROOF_DATABASE}'`).replaceAll("ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'melisa_shared_test_rw_20261009_02'",`ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${READINESS_PROOF_LOGIN}'`).replaceAll(b.revision.immutableTriggerHash,p.proofTriggerHash));
});
test('injected offline fixture proves two rollback-only controls/equivalence/all negatives; not a native execution claim',async()=>{
 const f=fixture(),result=await validateIsolatedReadinessQueryPlan(f);assert.equal(result.rolledBack,true);assert.equal(result.readyForSharedActivation,false);assert.equal(result.installAllowed,false);assert.equal(result.negativeResults.length,READINESS_PROOF_NEGATIVES.length*2);assert.equal(f.events.filter(v=>v==='begin').length,24);assert.equal(f.events.filter(v=>v==='rollback').length,24);assert.equal(f.events.filter(v=>v.startsWith('negative:')).length,22);assert.equal(f.events.at(-1),'inspect');
});
test('wide SQL identity or commit-capable adapter denied before mutation',async()=>{
 for(const patch of [{sysadmin:1},{accessShared:1},{accessLive:1},{accessTest125:1},{dbOwner:0},{database:'LIVE'},{actualT1:true},{sourceDefinitionHash:'E'.repeat(64)}]){const f=fixture();f.state.identityPatch=patch;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/IDENTITY/);assert(!f.events.includes('begin'));}
 const f=fixture();f.adapter.commit=()=>{};await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/ADAPTER/);assert.deepEqual(f.events,[]);
});
test('install/ready/rollback failures stop; every opened transaction attempts rollback',async()=>{
 for(const failure of ['install','ready','rollback','ended']){const f=fixture();f.state.failure=failure;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f));assert(f.events.includes('rollback'));assert(!f.events.includes('candidate'));}
});
test('result or negative behavior drift fails even when each control independently reports READY',async()=>{
 for(const key of ['equivalenceDrift','negativeDrift','layerDrift']){const f=fixture();f.state[key]=true;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/EQUIVALENCE/);assert.equal(f.events.filter(v=>v==='rollback').length,24);}
});
test('doomed native negatives require full rollback and preserve explicit actor/effects layers',async()=>{const f=fixture();f.state.doomed=true;const r=await validateIsolatedReadinessQueryPlan(f);assert(r.negativeResults.every(n=>n.transactionState===-1&&!Object.hasOwn(n,'savepointRestored')));assert(r.negativeResults.filter(n=>n.kind==='permission_drift').every(n=>n.layer==='native_actor'&&!n.readinessPredicateExercised));assert(r.negativeResults.filter(n=>n.kind==='stock_drift').every(n=>n.layer==='native_effects'&&!n.readinessPredicateExercised));});
test('savepoint-only adapter result cannot masquerade as full native recovery',async()=>{const f=fixture();f.adapter.negativeProbe=async()=>({rejected:true,errorCode:'GUARD',savepointRestored:true});await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/NEGATIVE/);assert.equal(f.events.filter(v=>v==='rollback').length,2);});
test('each negative must restore the complete protected snapshot before the next case',async()=>{const f=fixture(),probe=f.adapter.negativeProbe;f.adapter.negativeProbe=async(...args)=>{const r=await probe(...args);f.state.rollbackDrift=true;return r;};await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/ROLLBACK_DRIFT/);assert.equal(f.events.filter(v=>v==='rollback').length,2);assert.equal(f.events.filter(v=>v.startsWith('negative:')).length,1);});
test('no default execution adapter, no implicit proof target and no shared activation are provided',async()=>{
 const b=prepared();await assert.rejects(()=>validateIsolatedReadinessQueryPlan({bundle:b,target:target(b)}),/ADAPTER/);await assert.rejects(()=>validateIsolatedReadinessQueryPlan({bundle:b}),/TARGET/);assert(b.requiredRuntimeConsumers.includes('businessDailyRevisionBootstrap.mjs'));assert(b.tableSQL.includes(QUERY_PLAN_REGISTRY));
});
