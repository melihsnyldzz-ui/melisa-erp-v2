import {moduleHash,stage4NativeGuardSQL,COPY_DB,COPY_LOGIN} from './stage4-copy-sql.mjs';
import {SHARED_WRITER} from './shared-test-copy-sql.mjs';
import {SHARED_COPY_DATABASE,validateIsolatedOperationCopyContext,validateIsolatedCopyAdapterRevision,isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const adapt=s=>s.replaceAll(COPY_DB,SHARED_COPY_DATABASE).replaceAll(COPY_LOGIN,SHARED_WRITER);
export function sharedGoodsCreatorGuardSQL(schema){
 const cols=schema.filter(c=>c.schemaName==='dbo'&&c.tableName==='test_goods_batches').map(c=>c.columnName);
 check(['id','created_by','state','decided_by','decided_at','reason'].every(c=>cols.includes(c)),'SHARED_GOODS_SCHEMA');
 let definition=adapt(stage4NativeGuardSQL(schema));
 const start=definition.indexOf("IF @table_name=N'test_goods_batches' BEGIN "),end=definition.indexOf('RETURN;END;',start);
 check(start>=0&&end>start,'SHARED_GOODS_GUARD_BRANCH');
 const branch=definition.slice(start,end);
 const old="IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.created_by') IS NOT NULL AND TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.created_by'))<>@actor) THROW 51904,'STAGE4_ACTOR_SCOPE',1;";
 check(branch.includes(old),'SHARED_GOODS_CREATOR_BEFORE');
 const kept=cols.filter(c=>!['state','decided_by','decided_at','reason'].includes(c)).map(c=>"N'"+c.replaceAll("'","''")+"'").join(',');
 const rule=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i LEFT JOIN OPENJSON(@deleted)d ON JSON_VALUE(i.value,'$.id')=JSON_VALUE(d.value,'$.id') WHERE
 (d.value IS NULL AND (@operation<>N'count_submit' OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.created_by')) IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.created_by'))<>@actor OR ISNULL(JSON_VALUE(i.value,'$.state'),'')<>N'pending' OR JSON_VALUE(i.value,'$.decided_by') IS NOT NULL OR JSON_VALUE(i.value,'$.decided_at') IS NOT NULL))
 OR (d.value IS NOT NULL AND (@actor<>16 OR @operation NOT IN(N'goods_accept',N'goods_reject') OR @target IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.id'))<>@target OR ISNULL(JSON_VALUE(d.value,'$.state'),'')<>N'pending' OR JSON_VALUE(d.value,'$.decided_by') IS NOT NULL OR JSON_VALUE(d.value,'$.decided_at') IS NOT NULL OR ISNULL(JSON_VALUE(i.value,'$.state'),'')<>CASE @operation WHEN N'goods_accept' THEN N'accepted' WHEN N'goods_reject' THEN N'rejected' END OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.decided_by')) IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.decided_by'))<>@actor OR TRY_CONVERT(datetime2,JSON_VALUE(i.value,'$.decided_at')) IS NULL OR NOT EXISTS(SELECT 1 FROM OPENJSON(@p,'$.actors') WITH(id bigint '$.id')a WHERE a.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.created_by'))) OR EXISTS(SELECT 1 FROM OPENJSON(i.value)x FULL JOIN OPENJSON(d.value)y ON x.[key]=y.[key] WHERE COALESCE(x.[key],y.[key]) IN(${kept}) AND (x.[key] IS NULL OR y.[key] IS NULL OR x.type<>y.type OR ISNULL(x.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(y.value,N'') COLLATE Latin1_General_100_BIN2))))) THROW 51904,'STAGE4_GOODS_DECISION_SCOPE',1;`;
 definition=definition.slice(0,start)+branch.replace(old,rule)+definition.slice(end);
 definition=definition.replace('DECLARE @p nvarchar(max),@actor bigint;SELECT @p=m.profile_json,@actor=n.actor_id','DECLARE @p nvarchar(max),@actor bigint,@operation nvarchar(40),@target bigint;SELECT @p=m.profile_json,@actor=n.actor_id,@operation=n.operation,@target=TRY_CONVERT(bigint,JSON_VALUE(n.payload_json,\'$.id\'))');
 check(definition.includes('@operation=n.operation'),'SHARED_GOODS_INTENT_OPERATION');
 return definition;
}
export const revisionTableSQL=`CREATE TABLE dbo.stage4_copy_module_revisions(copy_id uniqueidentifier NOT NULL,revision int NOT NULL CHECK(revision=1),base_seal_hash char(64) NOT NULL,name sysname NOT NULL CHECK(name IN(N'dbo.usp_stage4_copy_ready',N'dbo.usp_stage4_copy_guard',N'dbo.usp_stage4_copy_context')),before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_stage4_copy_module_revisions PRIMARY KEY(copy_id,revision,name),CONSTRAINT FK_stage4_copy_module_revisions_profile FOREIGN KEY(copy_id) REFERENCES dbo.stage4_copy_manifest(copy_id));`;
export const revisionImmutableSQL=`CREATE TRIGGER dbo.immutable_stage4_copy_module_revisions ON dbo.stage4_copy_module_revisions WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${SHARED_COPY_DATABASE}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' OR EXISTS(SELECT 1 FROM deleted) THROW 51904,'SHARED_ADAPTER_REVISION_IMMUTABLE',1;
IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN dbo.stage4_copy_manifest m ON m.copy_id=i.copy_id AND m.sealed=1 LEFT JOIN dbo.stage4_copy_module_manifest p ON p.name=i.name WHERE m.copy_id IS NULL OR p.name IS NULL OR i.revision<>1 OR i.base_seal_hash<>m.seal_hash OR i.before_hash<>p.after_hash OR i.before_hash=i.after_hash OR i.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(i.name))),2)) THROW 51904,'SHARED_ADAPTER_REVISION_PINS',1;END;`;
export function buildSharedCopyRevision(bundle,schema){
 const context=validateIsolatedOperationCopyContext(bundle?.config?.copyContext);
 check(context.target.database===SHARED_COPY_DATABASE&&bundle.moduleManifest?.length===184,'SHARED_REVISION_BASE');
 const names=['dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context'];
 const old=names.map(name=>{const m=bundle.newDefinitions.find(m=>m.name===name),pin=bundle.moduleManifest.find(m=>m.name===name);check(m&&pin&&moduleHash(m.definition)===m.afterHash&&m.afterHash===pin.afterHash,'SHARED_REVISION_BASE_MODULE');return m;});
 const guard=sharedGoodsCreatorGuardSQL(schema);
 check(moduleHash(adapt(stage4NativeGuardSQL(schema)))===old[1].afterHash,'SHARED_REVISION_SCHEMA_BASE_DRIFT');
 const oldCheck="IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest) OR EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest p LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(p.name) WHERE o.object_id IS NULL OR p.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) OR (o.type='TR' AND OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')<>0)) THROW 51904,'STAGE4_MODULE_DRIFT',1;";
 const triggerHash=moduleHash(revisionImmutableSQL);
 const newCheck=`IF (SELECT COUNT(*) FROM dbo.stage4_copy_module_revisions)<>3 OR (SELECT COUNT(*) FROM dbo.stage4_copy_module_revisions WHERE copy_id=@copy_id AND revision=1 AND base_seal_hash=JSON_VALUE(@p,'$.sealHash'))<>3 OR OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_module_revisions'),'ExecIsTriggerDisabled')<>0 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_module_revisions'))),2),'')<>N'${triggerHash}' THROW 51904,'SHARED_ADAPTER_REVISION_DRIFT',1;
IF EXISTS(SELECT 1 FROM dbo.stage4_copy_module_revisions r LEFT JOIN dbo.stage4_copy_module_manifest p ON p.name=r.name WHERE p.name IS NULL OR p.after_hash<>r.before_hash OR r.before_hash=r.after_hash) THROW 51904,'SHARED_ADAPTER_BASE_DRIFT',1;
IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest) OR EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest p LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(p.name) LEFT JOIN dbo.stage4_copy_module_revisions r ON r.copy_id=@copy_id AND r.revision=1 AND r.name=p.name AND r.before_hash=p.after_hash WHERE o.object_id IS NULL OR COALESCE(r.after_hash,p.after_hash)<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) OR (o.type='TR' AND OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')<>0)) THROW 51904,'STAGE4_MODULE_DRIFT',1;`;
 check(old[0].definition.includes(oldCheck),'SHARED_REVISION_READY_BEFORE');
 const ready=old[0].definition.replace(oldCheck,newCheck);
 let contextSQL=old[2].definition;
 for(const key of ['ready','context']){
  const before="ISNULL(JSON_VALUE(@p,'$.sql."+key+".hash'),'')";
  const expected="COALESCE((SELECT r.after_hash FROM dbo.stage4_copy_module_revisions r WHERE r.copy_id=@copy_id AND r.revision=1 AND r.name=N'dbo.usp_stage4_copy_"+key+"' AND r.before_hash=JSON_VALUE(@p,'$.sql."+key+".hash')),"+before+")";
  check(contextSQL.includes(before),'SHARED_REVISION_CONTEXT_BEFORE');contextSQL=contextSQL.replace(before,expected);
 }
 const definitions=[ready,guard,contextSQL];
 const modules=names.map((name,i)=>({name,beforeHash:old[i].afterHash,afterHash:moduleHash(definitions[i])}));
 const body={schemaVersion:'melisa-shared-copy-adapter-revision.v1',version:1,copyId:context.copyId,baseSealHash:context.sealHash,modules,immutableTriggerHash:triggerHash};
 const revision={...body,revisionHash:isolatedCopyHash(body)};validateIsolatedCopyAdapterRevision(context,revision);
 return {schemaVersion:'melisa-shared-copy-adapter-install.v1',target:context.target,copyId:context.copyId,baseSealHash:context.sealHash,backupSHA:context.backupSHA,baseModuleManifestHash:isolatedCopyHash(bundle.moduleManifest),revision,tableSQL:revisionTableSQL,immutableSQL:revisionImmutableSQL,replacements:modules.map((m,i)=>({...m,definition:definitions[i].replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ')})),businessWrites:0,normalRolesChanged:false};
}
