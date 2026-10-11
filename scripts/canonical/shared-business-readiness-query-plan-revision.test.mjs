import test from 'node:test';import assert from 'node:assert/strict';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {prepareReadinessQueryPlanRevision,validateReadinessQueryPlanPreparation,readinessProofTarget,READINESS_PROOF_DATABASE,READINESS_PROOF_LOGIN,QUERY_PLAN_REGISTRY} from './shared-business-readiness-query-plan-revision.mjs';
import {validateIsolatedReadinessQueryPlan,READINESS_PROOF_NEGATIVES} from './shared-business-readiness-query-plan-isolated.mjs';
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
  async installTemporaryRevision(tx,p){events.push(p.variant);tx.variant=p.variant;assert.equal(p.proofOnly,true);assert.equal(moduleHash(p.definition),p.afterHash);const {revisionHash,...body}=p.revision;assert.equal(isolatedCopyHash(body),revisionHash);assert(p.immutableSQL.includes(READINESS_PROOF_DATABASE));if(state.failure==='install')throw Error('FIXTURE_INSTALL');},
  async observeReady(tx){if(state.failure==='ready')throw Error('FIXTURE_READY');return {result:'READY',elapsedMs:tx.variant==='baseline'?1500:300,queryPlanSha256:hash,logicalReads:42,sourceContributionHash:state.equivalenceDrift&&tx.variant==='candidate'?'E'.repeat(64):hash,actorPermissionsHash:hash};},
  async negativeProbe(tx,p){const code=READINESS_PROOF_NEGATIVES.find(v=>v[0]===p.kind)[1];return {rejected:true,errorCode:state.negativeDrift&&tx.variant==='candidate'&&p.kind==='party_hold'?'DIFFERENT':code,savepointRestored:true};},
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
 assert(p.candidateDefinition.includes(READINESS_PROOF_DATABASE));assert(p.candidateDefinition.includes(READINESS_PROOF_LOGIN));assert(p.baselineDefinition.includes(p.proofTriggerHash));assert.equal((p.candidateDefinition.match(/OPTION \(RECOMPILE\)/g)||[]).length,2);assert.equal((p.baselineDefinition.match(/OPTION \(RECOMPILE\)/g)||[]).length,0);
});
test('injected offline fixture proves two rollback-only controls/equivalence/all negatives; not a native execution claim',async()=>{
 const f=fixture(),result=await validateIsolatedReadinessQueryPlan(f);assert.equal(result.rolledBack,true);assert.equal(result.readyForSharedActivation,false);assert.equal(result.installAllowed,false);assert.equal(result.negativeResults.length,READINESS_PROOF_NEGATIVES.length*2);assert.deepEqual(f.events,['inspect','begin','baseline','rollback','ended','begin','candidate','rollback','ended','inspect']);
});
test('wide SQL identity or commit-capable adapter denied before mutation',async()=>{
 for(const patch of [{sysadmin:1},{accessShared:1},{accessLive:1},{accessTest125:1},{dbOwner:0},{database:'LIVE'},{actualT1:true},{sourceDefinitionHash:'E'.repeat(64)}]){const f=fixture();f.state.identityPatch=patch;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/IDENTITY/);assert(!f.events.includes('begin'));}
 const f=fixture();f.adapter.commit=()=>{};await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/ADAPTER/);assert.deepEqual(f.events,[]);
});
test('install/ready/rollback failures stop; every opened transaction attempts rollback',async()=>{
 for(const failure of ['install','ready','rollback','ended']){const f=fixture();f.state.failure=failure;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f));assert(f.events.includes('rollback'));assert(!f.events.includes('candidate'));}
});
test('result or negative behavior drift fails even when each control independently reports READY',async()=>{
 for(const key of ['equivalenceDrift','negativeDrift']){const f=fixture();f.state[key]=true;await assert.rejects(()=>validateIsolatedReadinessQueryPlan(f),/EQUIVALENCE/);assert.equal(f.events.filter(v=>v==='rollback').length,2);}
});
test('no default execution adapter, no implicit proof target and no shared activation are provided',async()=>{
 const b=prepared();await assert.rejects(()=>validateIsolatedReadinessQueryPlan({bundle:b,target:target(b)}),/ADAPTER/);await assert.rejects(()=>validateIsolatedReadinessQueryPlan({bundle:b}),/TARGET/);assert(b.requiredRuntimeConsumers.includes('businessDailyRevisionBootstrap.mjs'));assert(b.tableSQL.includes(QUERY_PLAN_REGISTRY));
});
