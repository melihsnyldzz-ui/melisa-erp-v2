// Offline preparation only. No pool, SQL connection, filesystem or CLI side effects.
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {prepareBusinessReadinessQueryPlan,prepareBusinessReadinessSourceScopePlan} from './shared-business-readiness-query-plan.mjs';
export const QUERY_PLAN_REGISTRY='dbo.stage4_copy_readiness_query_plan_revisions';
export const QUERY_PLAN_TRIGGER='dbo.immutable_stage4_copy_readiness_query_plan_revisions';
export const READINESS_PROOF_DATABASE='MELISA_ERP_READINESS_PROOF_TEST_20261011_01';
export const READINESS_PROOF_LOGIN='melisa_readiness_proof_rw_20261011_01';
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02',COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82',SERVER='Semih\\MELISADEV',NAME='dbo.usp_stage4_copy_ready';
const hex=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const check=(v,c)=>{if(!v)throw Error(c);};
const exact=(o,keys)=>o&&Object.keys(o).sort().join(',')===keys.toSorted().join(',');
const scalar="DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');";
const hashExpression=/CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\((@@PROCID|o\.object_id|OBJECT_ID\([dvw]\.name\))\)\),2\)/g;
const shape=['source','baseSealHash','baseDailyRevisionHash','baseProfitRevisionHash','dailyScopeHash'];

// The historical registries stay immutable. The new guard verifies the actual
// definition first, then the old guards see its exact sealed predecessor hash
// ONLY for this one procedure. All other module hashes are read fresh unchanged.
export function prepareReadinessQueryPlanRevision(input,options={sourceScopeOptimization:false}){
 check(exact(options,['sourceScopeOptimization'])&&typeof options.sourceScopeOptimization==='boolean','READINESS_REVISION_OPTIONS');
 check(exact(input,shape),'READINESS_REVISION_INPUT');
 for(const k of shape.slice(1))check(hex(input[k]),'READINESS_REVISION_PARENT_PIN');
 const plan=(options.sourceScopeOptimization?prepareBusinessReadinessSourceScopePlan:prepareBusinessReadinessQueryPlan)(input.source),original=input.source.definition;
 check(!original.includes(QUERY_PLAN_REGISTRY)&&!original.includes('@readinessPreviousHash'),'READINESS_REVISION_COLLISION');
 for(const code of ['BUSINESS_DAILY_REVISION_DRIFT','BUSINESS_DAILY_PROFIT_REVISION_DRIFT']){
  const lines=original.split('\n').filter(l=>l.includes("'"+code+"'"));
  check(lines.length===1,'READINESS_REVISION_PARENT_ANCHOR');
 }
 // The v5 ready definition pins its parent v4 hash, while its own v5 hash
 // lives in the immutable registry. Verify that hash fresh in the new guard.
 check(original.includes("N'"+input.baseDailyRevisionHash+"'"),'READINESS_REVISION_PARENT_ANCHOR');
 check(original.includes("N'"+input.dailyScopeHash+"'"),'READINESS_REVISION_SCOPE_ANCHOR');
 const before=plan.beforeHash;
 const tableSQL=`CREATE TABLE ${QUERY_PLAN_REGISTRY}(copy_id uniqueidentifier NOT NULL PRIMARY KEY REFERENCES dbo.stage4_copy_manifest(copy_id),revision int NOT NULL CHECK(revision=6),base_seal_hash char(64) NOT NULL,base_daily_revision_hash char(64) NOT NULL,base_profit_revision_hash char(64) NOT NULL,daily_scope_hash char(64) NOT NULL,name sysname NOT NULL CHECK(name=N'${NAME}'),before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,revision_hash char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());`;
 const immutableSQL=`CREATE TRIGGER ${QUERY_PLAN_TRIGGER} ON ${QUERY_PLAN_REGISTRY} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${DB}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'${SERVER}' OR IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1 OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>1 OR(SELECT COUNT(*) FROM ${QUERY_PLAN_REGISTRY})<>1 THROW 51904,'READINESS_QUERY_PLAN_IMMUTABLE',1;
IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN dbo.stage4_copy_manifest m ON m.copy_id=i.copy_id AND m.sealed=1 WHERE m.copy_id IS NULL OR i.copy_id<>'${COPY}' OR i.revision<>6 OR i.name<>N'${NAME}' OR i.base_seal_hash<>m.seal_hash OR i.base_seal_hash<>N'${input.baseSealHash}' OR i.base_daily_revision_hash<>N'${input.baseDailyRevisionHash}' OR i.base_profit_revision_hash<>N'${input.baseProfitRevisionHash}' OR i.daily_scope_hash<>N'${input.dailyScopeHash}' OR i.before_hash<>N'${before}' OR i.before_hash=i.after_hash OR i.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(i.name))),2) OR i.revision_hash NOT LIKE REPLICATE('[0-9A-F]',64)) THROW 51904,'READINESS_QUERY_PLAN_PINS',1;END;`;
 const triggerHash=moduleHash(immutableSQL),overlays=[];
 let definition=plan.createDefinition.replace(hashExpression,(expression,object)=>{
  const replacement=`(CASE WHEN ${object}=OBJECT_ID(N'${NAME}') THEN @readinessPreviousHash ELSE ${expression} END)`;
  overlays.push({expression,replacement});return replacement;
 });
 // Fail closed on a different historical template; no broad regex adaptation.
 check(overlays.length===6&&overlays.filter(x=>x.expression.includes('@@PROCID')).length===2,'READINESS_REVISION_MODULE_ANCHORS');
 const guard=`DECLARE @readinessPreviousHash varchar(64);
IF(SELECT COUNT(*) FROM ${QUERY_PLAN_REGISTRY})<>1 OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${QUERY_PLAN_TRIGGER}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${QUERY_PLAN_TRIGGER}'))),2),'')<>N'${triggerHash}' THROW 51904,'READINESS_QUERY_PLAN_REGISTRY_DRIFT',1;
IF(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions)<>8 OR EXISTS(SELECT 1 FROM dbo.stage4_copy_business_daily_revisions WHERE copy_id<>@copy_id OR revision<>4 OR revision_hash<>N'${input.baseDailyRevisionHash}') OR(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_profit_revisions)<>3 OR EXISTS(SELECT 1 FROM dbo.stage4_copy_business_daily_profit_revisions WHERE copy_id<>@copy_id OR revision<>5 OR revision_hash<>N'${input.baseProfitRevisionHash}') THROW 51904,'READINESS_QUERY_PLAN_PARENT_DRIFT',1;
SELECT @readinessPreviousHash=before_hash FROM ${QUERY_PLAN_REGISTRY} WHERE copy_id=@copy_id AND copy_id='${COPY}' AND revision=6 AND name=N'${NAME}' AND base_seal_hash=@readyBaseSeal AND base_seal_hash=N'${input.baseSealHash}' AND base_daily_revision_hash=N'${input.baseDailyRevisionHash}' AND base_profit_revision_hash=N'${input.baseProfitRevisionHash}' AND daily_scope_hash=N'${input.dailyScopeHash}' AND before_hash=N'${before}' AND before_hash<>after_hash AND after_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) AND revision_hash LIKE REPLICATE('[0-9A-F]',64);
IF @readinessPreviousHash IS NULL THROW 51904,'READINESS_QUERY_PLAN_DEFINITION_DRIFT',1;
`;
 check(definition.split(scalar).length===2,'READINESS_REVISION_GUARD_ANCHOR');definition=definition.replace(scalar,scalar+'\n'+guard);
 let restored=definition.replace(scalar+'\n'+guard,scalar);
 // Multiple identical expressions are restored one occurrence at a time.
 for(const x of overlays)restored=restored.replace(x.replacement,x.expression);
 check(restored===plan.createDefinition,'READINESS_REVISION_PREDICATE_DRIFT');
 const body={schemaVersion:'melisa-readiness-query-plan-revision.v1',version:6,copyId:COPY,baseSealHash:input.baseSealHash,baseDailyRevisionHash:input.baseDailyRevisionHash,baseProfitRevisionHash:input.baseProfitRevisionHash,dailyScopeHash:input.dailyScopeHash,modules:[{name:NAME,beforeHash:before,afterHash:moduleHash(definition)}],immutableTriggerHash:triggerHash};
 return Object.freeze({schemaVersion:'melisa-readiness-query-plan-preparation.v1',target:{server:SERVER,database:DB},revision:{...body,revisionHash:isolatedCopyHash(body)},plan,originalDefinition:original,createDefinition:definition,reviewAlterDefinition:definition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE '),tableSQL,immutableSQL,guard,overlays,executeAllowed:false,installAllowed:false,businessWrites:0,rolesChanged:false,existingRegistriesUnchanged:true,requiredRuntimeConsumers:['businessReadyRevisionBootstrap.mjs','businessDailyRevisionBootstrap.mjs','isolatedOperationCopyContext.mjs'],verification:'OFFLINE_PREPARATION_ONLY'});
}

export function validateReadinessQueryPlanPreparation(bundle){
 check(bundle?.schemaVersion==='melisa-readiness-query-plan-preparation.v1'&&bundle.executeAllowed===false&&bundle.installAllowed===false,'READINESS_REVISION_NOT_INSTALLABLE');
 const r=bundle.revision;
 const sourceScopeOptimization=bundle.plan?.schemaVersion==='melisa-readiness-source-scope-candidate.v1';
 const rebuilt=prepareReadinessQueryPlanRevision({source:{database:DB,server:SERVER,copyId:COPY,actualT1:false,definition:bundle.originalDefinition,expectedDefinitionHash:r?.modules?.[0]?.beforeHash},baseSealHash:r?.baseSealHash,baseDailyRevisionHash:r?.baseDailyRevisionHash,baseProfitRevisionHash:r?.baseProfitRevisionHash,dailyScopeHash:r?.dailyScopeHash},{sourceScopeOptimization});
 check(isolatedCopyHash(rebuilt)===isolatedCopyHash(bundle),'READINESS_REVISION_ARTIFACT_DRIFT');return rebuilt;
}

// Separate isolated proof only. No permission or database is provisioned here.
export function readinessProofTarget(bundle,input){
 validateReadinessQueryPlanPreparation(bundle);
 check(exact(input,['server','database','login','copyId','actualT1','isolated','sourceDatabase','sourceDefinitionHash'])&&input.server===SERVER&&input.database===READINESS_PROOF_DATABASE&&input.login===READINESS_PROOF_LOGIN&&input.copyId===COPY&&input.actualT1===false&&input.isolated===true&&input.sourceDatabase===DB&&input.sourceDefinitionHash===bundle.revision.modules[0].beforeHash,'READINESS_PROOF_TARGET');
 const rebind=s=>s.replaceAll("DB_NAME() COLLATE Latin1_General_100_BIN2<>N'"+DB+"'","DB_NAME() COLLATE Latin1_General_100_BIN2<>N'"+READINESS_PROOF_DATABASE+"'").replaceAll("ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'melisa_shared_test_rw_20261009_02'","ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'"+READINESS_PROOF_LOGIN+"'");
 // Rebinding changes hashes. Produce separate immutable proof pins; never put
 // these proof definitions/hashes into the shared-copy preparation or config.
 const trigger=rebind(bundle.immutableSQL).replace("IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1",`ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${READINESS_PROOF_LOGIN}'`);
 const proofTriggerHash=moduleHash(trigger);
 // Replace original matches in one pass. A replacement deliberately contains
 // its original hash expression in ELSE; rescanning it would nest the first
 // duplicate @@PROCID gate and leave the second gate without its overlay.
 let overlayIndex=0,offsetDelta=0;
 const baselineOverlayPositions=[];
 let baseline=bundle.originalDefinition.replace(hashExpression,(expression,object,offset)=>{
  const overlay=bundle.overlays[overlayIndex++];
  check(overlay?.expression===expression&&overlay.replacement===`(CASE WHEN ${object}=OBJECT_ID(N'${NAME}') THEN @readinessPreviousHash ELSE ${expression} END)`,'READINESS_PROOF_BASELINE_ANCHOR');
  baselineOverlayPositions.push({offset:offset+offsetDelta,...overlay});offsetDelta+=overlay.replacement.length-expression.length;
  return overlay.replacement;
 });
 check(overlayIndex===6&&overlayIndex===bundle.overlays.length&&baselineOverlayPositions.filter(x=>x.expression.includes('@@PROCID')).length===2,'READINESS_PROOF_BASELINE_ANCHORS');
 // Reverse exact recorded positions, never search replacement text again.
 // This verifies all original predicates and guard text round-trip exactly.
 let baselineRoundtrip=baseline;
 for(const overlay of baselineOverlayPositions.toReversed()){
  check(baselineRoundtrip.slice(overlay.offset,overlay.offset+overlay.replacement.length)===overlay.replacement,'READINESS_PROOF_BASELINE_POSITION');
  baselineRoundtrip=baselineRoundtrip.slice(0,overlay.offset)+overlay.expression+baselineRoundtrip.slice(overlay.offset+overlay.replacement.length);
 }
 check(baselineRoundtrip===bundle.originalDefinition,'READINESS_PROOF_BASELINE_PREDICATE_DRIFT');
 baseline=baseline.replace(scalar,scalar+'\n'+bundle.guard);
 // Native clone diagnosis confirmed that ALTER stores a CREATE header in
 // OBJECT_DEFINITION, with the remaining text unchanged. Separate executable
 // ALTER SQL from its exact expected stored CREATE text. moduleHash itself is
 // never normalized, and shared preparation/source pins remain unchanged.
 const toStored=s=>rebind(s).replaceAll(bundle.revision.immutableTriggerHash,proofTriggerHash);
 const baselineStoredDefinition=toStored(baseline),candidateStoredDefinition=toStored(bundle.createDefinition);
 check([baselineStoredDefinition,candidateStoredDefinition].every(s=>s.startsWith('CREATE PROCEDURE dbo.usp_stage4_copy_ready ')),'READINESS_PROOF_STORED_HEADER');
 const baselineExecutionSQL=baselineStoredDefinition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE '),candidateExecutionSQL=candidateStoredDefinition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ');
 return Object.freeze({target:{...input},sourceDefinition:bundle.originalDefinition,baselineExecutionSQL,baselineStoredDefinition,candidateExecutionSQL,candidateStoredDefinition,tableSQL:bundle.tableSQL,immutableSQL:trigger,proofBaselineHash:moduleHash(baselineStoredDefinition),proofAfterHash:moduleHash(candidateStoredDefinition),proofTriggerHash,sharedBeforeHash:bundle.revision.modules[0].beforeHash,sharedAfterHash:bundle.revision.modules[0].afterHash,identityRebindings:['database','originalLogin','isolatedRegistryOwner'],historicalGuardOverlaySameInBoth:true,installAllowed:false,transactionMustRollback:true,requiresProvisionedProofClone:true});
}
