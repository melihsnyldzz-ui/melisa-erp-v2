// Deterministic v7 append. Installation and native proof belong to the owner.
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-sql.mjs';
import {SELECTED_SALE_REGISTRY,SELECTED_SALE_IMMUTABLE,SELECTED_SALE_CONTEXT} from './shared-business-selected-sale-revision-contract.mjs';
import {assertIsolatedCopyContext,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';

export const SELECTED_SALE_EFFECTS_REGISTRY='dbo.stage4_copy_business_selected_sale_effects_revisions';
export const SELECTED_SALE_EFFECTS_IMMUTABLE='dbo.immutable_stage4_copy_business_selected_sale_effects_revisions';
export const SELECTED_SALE_EFFECTS_MODULES=Object.freeze(['dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_effects',SELECTED_SALE_CONTEXT,'dbo.usp_business_selected_sale_write_intent_v1']);
const SELECTED_SALE_INTENT_READER=SELECTED_SALE_EFFECTS_MODULES[3];
const prepared=new WeakMap(),check=(ok,code)=>{if(!ok)throw Error(code);};
const lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const create=s=>s.replace(/^ALTER PROCEDURE /,'CREATE PROCEDURE ');
// The owner measured this exact header normalization on the bound SQL Server
// inside a rolled-back transaction: CREATE OR ALTER is stored as CREATE plus
// three spaces. Keep executable and stored bytes distinct; no hash override.
const executable=s=>{check(s.startsWith('CREATE PROCEDURE '),'SELECTED_EFFECTS_EXECUTION_HEADER');return s.replace(/^CREATE PROCEDURE /,'CREATE OR ALTER PROCEDURE ');};
const stored=s=>{check(s.startsWith('CREATE PROCEDURE '),'SELECTED_EFFECTS_STORED_HEADER');return s.replace(/^CREATE PROCEDURE /,'CREATE   PROCEDURE ');};
const hash=n=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${n}))),2)`;
const once=(s,a,b,code)=>{check(s.split(a).length===2,code);return s.replace(a,b);};
const maxKinds=['Stock','Customer','Supplier','Finance'];

// The selected branch was added after v3's scalar optimization. Its JSON max
// predicates were evaluated for ledger rows; preserve every predicate and type.
export function optimizeSelectedSaleEffectsSQL(definition){
 check(typeof definition==='string','SELECTED_EFFECTS_SOURCE');
 let sql=definition;
 for(const [index,kind] of maxKinds.entries()){
  const from=`TRY_CONVERT(bigint,JSON_VALUE(@selected_effect_before,'$.max${kind}Id'))`;
  check(sql.split(from).length===[2,3,2,2][index],'SELECTED_EFFECTS_MAX_ANCHOR');
  sql=sql.replaceAll(from,`@selected_effect_max${kind}Id`);
 }
 const anchor='IF @selected_effect_intent IS NOT NULL BEGIN\n';
 const declarations=maxKinds.map(k=>`DECLARE @selected_effect_max${k}Id bigint=TRY_CONVERT(bigint,JSON_VALUE(@selected_effect_before,'$.max${k}Id'));`).join('');
 return once(sql,anchor,anchor+declarations+'\n','SELECTED_EFFECTS_BRANCH_ANCHOR');
}

export function buildBusinessSelectedSaleEffectsRevision(input){
 const {copy}=input;assertIsolatedCopyContext(copy);
 // Rebuild all ten original definitions from proved v4/v5 parents. Neither a
 // caller-supplied module body nor a caller-supplied hash can become a pin.
 const selected=buildBusinessSelectedSaleRevision(input),base=selected.revision;
 check(selected.writeScopeArtifact.name===SELECTED_SALE_INTENT_READER,'SELECTED_EFFECTS_INTENT_NAME');
 const source=name=>{const m=selected.replacements.find(p=>p.name===name);check(m&&moduleHash(create(m.definition))===m.afterHash,'SELECTED_EFFECTS_BASE_PIN');return m;};
 const pins=SELECTED_SALE_EFFECTS_MODULES.map(name=>({name,beforeHash:source(name).afterHash}));
 const names=SELECTED_SALE_EFFECTS_MODULES.map(lit).join(',');
 const tableSQL=`CREATE TABLE ${SELECTED_SALE_EFFECTS_REGISTRY}(copy_id uniqueidentifier NOT NULL REFERENCES dbo.stage4_copy_manifest(copy_id),name sysname NOT NULL CHECK(name IN(${names})),revision int NOT NULL CHECK(revision=7),base_seal_hash char(64) NOT NULL,base_selected_revision_hash char(64) NOT NULL,profile_hash char(64) NOT NULL,before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,revision_hash char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(copy_id,name));`;
 const oldValues=base.modules.map(m=>`(${lit(m.name)},${m.beforeHash?lit(m.beforeHash):'CAST(NULL AS char(64))'},${lit(m.afterHash)})`).join(',');
 const oldProof=`IF(SELECT COUNT(*) FROM ${SELECTED_SALE_REGISTRY})<>10 OR(SELECT COUNT(DISTINCT revision_hash) FROM ${SELECTED_SALE_REGISTRY})<>1 OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${SELECTED_SALE_IMMUTABLE}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(${hash(lit(SELECTED_SALE_IMMUTABLE))},'')<>${lit(base.immutableTriggerHash)} OR EXISTS(SELECT 1 FROM ${SELECTED_SALE_REGISTRY} s LEFT JOIN(VALUES ${oldValues})p(name,before_hash,after_hash) ON p.name=s.name WHERE p.name IS NULL OR s.copy_id<>${lit(copy.copyId)} OR s.revision<>6 OR s.base_seal_hash<>${lit(copy.sealHash)} OR s.base_daily_revision_hash<>${lit(base.baseDailyRevisionHash)} OR s.base_profit_revision_hash<>${lit(base.baseProfitRevisionHash)} OR s.profile_hash<>${lit(base.profileHash)} OR s.revision_hash<>${lit(base.revisionHash)} OR ISNULL(s.before_hash,'')<>ISNULL(p.before_hash,'') OR s.after_hash<>p.after_hash) THROW 51904,'SELECTED_EFFECTS_BASE_DRIFT',1;`;
 const beforeValues=pins.map(m=>`(${lit(m.name)},${lit(m.beforeHash)})`).join(',');
 const immutableSQL=`CREATE TRIGGER ${SELECTED_SALE_EFFECTS_IMMUTABLE} ON ${SELECTED_SALE_EFFECTS_REGISTRY} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>${lit(copy.target.database)} OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>${lit(copy.target.server)} OR IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1 OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>4 OR(SELECT COUNT(*) FROM ${SELECTED_SALE_EFFECTS_REGISTRY})<>4 OR(SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest)<>185 OR(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions)<>8 OR(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_profit_revisions)<>3 THROW 51904,'SELECTED_EFFECTS_IMMUTABLE',1;
${oldProof}
IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN(VALUES ${beforeValues})p(name,before_hash) ON p.name=i.name WHERE p.name IS NULL OR i.copy_id<>${lit(copy.copyId)} OR i.revision<>7 OR i.base_seal_hash<>${lit(copy.sealHash)} OR i.base_selected_revision_hash<>${lit(base.revisionHash)} OR i.profile_hash<>${lit(base.profileHash)} OR i.before_hash<>p.before_hash OR i.before_hash=i.after_hash OR OBJECT_ID(i.name,N'P') IS NULL OR i.after_hash<>ISNULL(${hash('i.name')},'') OR i.revision_hash COLLATE Latin1_General_100_BIN2 LIKE '%[^A-F0-9]%') OR(SELECT COUNT(DISTINCT revision_hash) FROM inserted)<>1 THROW 51904,'SELECTED_EFFECTS_IMMUTABLE_PIN',1;
IF EXISTS(SELECT 1 FROM ${SELECTED_SALE_REGISTRY} s LEFT JOIN inserted i ON i.copy_id=s.copy_id AND i.name=s.name AND i.before_hash=s.after_hash WHERE OBJECT_ID(s.name,N'P') IS NULL OR COALESCE(i.after_hash,s.after_hash)<>ISNULL(${hash('s.name')},'')) THROW 51904,'SELECTED_EFFECTS_NATIVE_PIN',1;
END;`;
 const triggerHash=moduleHash(immutableSQL);
 // This gate verifies all four current native hashes before predecessor READY
 // sees its finite v6 before-image. No historical registry row is updated.
 const currentProof=`IF(SELECT COUNT(*) FROM ${SELECTED_SALE_EFFECTS_REGISTRY})<>4 OR(SELECT COUNT(DISTINCT revision_hash) FROM ${SELECTED_SALE_EFFECTS_REGISTRY})<>1 OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${SELECTED_SALE_EFFECTS_IMMUTABLE}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(${hash(lit(SELECTED_SALE_EFFECTS_IMMUTABLE))},'')<>${lit(triggerHash)} OR EXISTS(SELECT 1 FROM ${SELECTED_SALE_EFFECTS_REGISTRY} e LEFT JOIN ${SELECTED_SALE_REGISTRY} s ON s.copy_id=e.copy_id AND s.name=e.name AND s.revision=6 AND s.after_hash=e.before_hash WHERE s.name IS NULL OR e.name NOT IN(${names}) OR e.copy_id<>@copy_id OR e.revision<>7 OR e.base_seal_hash<>${lit(copy.sealHash)} OR e.base_selected_revision_hash<>${lit(base.revisionHash)} OR e.profile_hash<>${lit(base.profileHash)} OR e.before_hash=e.after_hash OR OBJECT_ID(e.name,N'P') IS NULL OR e.after_hash<>ISNULL(${hash('e.name')},'') OR e.revision_hash COLLATE Latin1_General_100_BIN2 LIKE '%[^A-F0-9]%') THROW 51904,'SELECTED_EFFECTS_REVISION_DRIFT',1;`;
 const historical=(actual,name)=>`COALESCE((SELECT e.before_hash FROM ${SELECTED_SALE_EFFECTS_REGISTRY} e WHERE e.copy_id=@copy_id AND e.revision=7 AND e.name=${name} AND e.base_selected_revision_hash=${lit(base.revisionHash)} AND e.after_hash=${actual}),${actual})`;
 let ready=create(source(SELECTED_SALE_EFFECTS_MODULES[0]).definition),projections=0;
 ready=ready.replace(/CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\((@@PROCID|OBJECT_ID\(([a-z]+\.name)\)|o\.object_id)\)\),2\)/g,(actual,object,alias)=>{
  projections++;return historical(actual,object==='@@PROCID'?lit(SELECTED_SALE_EFFECTS_MODULES[0]):object==='o.object_id'?'p.name':alias);
 });
 check(projections>0&&ready.includes(historical(hash('s.name'),'s.name')),'SELECTED_EFFECTS_READY_ANCHOR');
 ready=once(ready,"IF(SELECT COUNT(*) FROM "+SELECTED_SALE_REGISTRY+")<>10",oldProof+'\n'+currentProof+'\nIF(SELECT COUNT(*) FROM '+SELECTED_SALE_REGISTRY+')<>10','SELECTED_EFFECTS_READY_GATE');
 const effects=optimizeSelectedSaleEffectsSQL(create(source(SELECTED_SALE_EFFECTS_MODULES[1]).definition));
 const reader=name=>{
  let definition=create(source(name).definition);
  for(const parent of SELECTED_SALE_EFFECTS_MODULES.slice(0,2)){
   const before=`(SELECT after_hash FROM ${SELECTED_SALE_REGISTRY} WHERE copy_id=@copy_id AND revision=6 AND name=N'${parent}')`;
   const after=`COALESCE((SELECT e.after_hash FROM ${SELECTED_SALE_EFFECTS_REGISTRY} e JOIN ${SELECTED_SALE_REGISTRY} s ON s.copy_id=e.copy_id AND s.name=e.name AND s.revision=6 AND s.after_hash=e.before_hash WHERE e.copy_id=@copy_id AND e.revision=7 AND e.name=N'${parent}' AND e.base_selected_revision_hash=${lit(base.revisionHash)}),${before})`;
   definition=once(definition,before,after,'SELECTED_EFFECTS_READER_PARENT_ANCHOR');
  }
  return definition;
 };
 const definitions=[ready,effects,reader(SELECTED_SALE_CONTEXT),reader(SELECTED_SALE_INTENT_READER)];
 const replacements=pins.map((m,i)=>({...m,afterHash:moduleHash(stored(definitions[i])),definition:executable(definitions[i]),storedDefinition:stored(definitions[i])}));
 const body={schemaVersion:'melisa-business-selected-sale-effects-revision.v1',version:7,copyId:copy.copyId,baseSealHash:copy.sealHash,baseSelectedRevisionHash:base.revisionHash,profileHash:base.profileHash,modules:replacements.map(({definition,storedDefinition,...m})=>m),immutableTriggerHash:triggerHash,optimization:'SELECTED_MAX_IDS_ONCE'};
 const revision={...body,revisionHash:isolatedCopyHash(body)};
 const parentHashes=Object.fromEntries(Object.entries(selected.parentHashes).map(([key,value])=>[key,replacements.find(m=>m.name===copy.sql[key].name)?.afterHash??value]));
 const artifact=(prior,kind)=>{const m=replacements.find(m=>m.name===prior.name),value=Object.freeze({...prior,definition:m.definition,storedDefinition:m.storedDefinition,executionSQL:m.definition,definitionHash:m.afterHash,parentHashes:Object.freeze(parentHashes),selectedEffectsRevisionHash:revision.revisionHash});prepared.set(value,{copy,kind});return value;};
 return {schemaVersion:'melisa-business-selected-sale-effects-install.v1',target:copy.target,copyId:copy.copyId,baseSealHash:copy.sealHash,baseSelectedRevision:base,revision,tableSQL,immutableSQL,replacements,parentHashes,contextArtifact:artifact(selected.contextArtifact,'context'),writeScopeArtifact:artifact(selected.writeScopeArtifact,'intent'),businessWrites:0,rolesChanged:false,nativeChecksUnchanged:true,openingHumanAccepted:false};
}
export function validateBusinessSelectedSaleEffectsInstall(bundle,input){check(isolatedCopyJSON(bundle)===isolatedCopyJSON(buildBusinessSelectedSaleEffectsRevision(input)),'SELECTED_EFFECTS_CANONICAL_INSTALL');return true;}
export function assertPreparedSelectedEffectsRevisionArtifact(artifact,copy,kind){const value=prepared.get(artifact);check(value?.copy===copy&&value.kind===kind,'SELECTED_EFFECTS_SERVER_ARTIFACT_REQUIRED');return artifact;}
