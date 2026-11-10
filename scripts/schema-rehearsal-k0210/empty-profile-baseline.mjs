// Dedicated complete schema2 READ-ONLY SQL preview. No executor, main or connection.
import {createHash} from 'node:crypto';
import {validateRehearsalIdentity} from './identity.mjs';
import {rehearsalTargetGuard} from './foundation.mjs';
import {CANDIDATE_SEMANTIC_SQL} from './semantic.mjs';
import {LOCAL_MASTER_BASE_TABLES,LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from '../desktop-empty/local-master-schema-proposal.mjs';
export const OLD_TABLES=Object.freeze([...LOCAL_MASTER_BASE_TABLES,'desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests'].sort());
export const BASELINE_HASH_FIELDS=Object.freeze(['metadata','security','objectIds','identities','rows','marker','semantic','references']);
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
export const BASELINE_SOURCE_SIGNATURE=hash(JSON.stringify({tables:OLD_TABLES,fields:BASELINE_HASH_FIELDS,metadata:LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,semantic:CANDIDATE_SEMANTIC_SQL}));
export const sqlQuote=s=>`N'${s.replaceAll("'","''")}'`;export const sqlNames=a=>a.map(sqlQuote).join(',');
const q=sqlQuote,names=sqlNames;
export function fixedEmptyIdentity(value){const m=validateRehearsalIdentity(value);if(m.databaseId!==9||m.databaseGuid!=='6d773db9-bd69-4906-b791-d63a490ab1f2'||m.databaseCreateTime!=='2026-11-10T11:10:18.030'||m.environmentId!=='287f689a-43bb-43dd-950b-adb615fcb20c')throw Error('K0210_EMPTY_PROFILE_TARGET');return m;}
const locks=tables=>tables.map(n=>`SELECT @lockCount=COUNT_BIG(*) FROM dbo.[${n}] WITH(TABLOCKX,HOLDLOCK);`).join('\n');
export const hashSql=s=>`LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),${s})),2))`;
export const finishSql=`END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;
export function preamble(m,tables,version){return `SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'K0210_EXISTING_TRANSACTION',1;
${rehearsalTargetGuard(m)}
BEGIN TRY BEGIN TRANSACTION;DECLARE @owner int,@lockCount bigint;
EXEC @owner=sys.sp_getapplock @Resource=N'melisa-k0210-rehearsal-${m.environmentId}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
IF @owner<0 THROW 51995,'K0210_LOCK_REJECTED',1;
${LOCAL_MASTER_CONCURRENCY_GUARD}
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>${tables.length} OR ${tables.map(n=>`OBJECT_ID(${q('dbo.'+n)},N'U') IS NULL`).join(' OR ')} THROW 51995,'K0210_UPGRADE_TABLE_SET',1;
${locks(tables)}
IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id=CONVERT(uniqueidentifier,${q(m.environmentId)}) AND schema_version=${version} AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'K0210_UPGRADE_MARKER',1;
IF (SELECT COUNT(*) FROM sys.database_principals WHERE name=N'desktop_local_writer_v2' AND type=N'R' AND owning_principal_id=DATABASE_PRINCIPAL_ID(N'dbo'))<>1 OR EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2') OR member_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2')) OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2') OR grantor_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2')) THROW 51995,'K0210_EMPTY_WRITER_ROLE',1;`;}
export const emptyGuard=(tables,exceptions)=>`IF ${tables.filter(n=>!exceptions.includes(n)).map(n=>`EXISTS(SELECT 1 FROM dbo.[${n}])`).join(' OR ')} THROW 51995,'K0210_UPGRADE_NONEMPTY',1;`;
export function snapshot(tables,withReferences){
 const references=withReferences?`(SELECT JSON_QUERY((SELECT id,setting_group,setting_key,setting_value,value_type,is_active FROM dbo.system_settings ORDER BY setting_key FOR JSON PATH,INCLUDE_NULL_VALUES)) settings,JSON_QUERY((SELECT id,account_code,account_name,account_type,currency_code,CONVERT(varchar(40),opening_balance) opening_balance,CONVERT(varchar(40),current_balance) current_balance,is_active FROM dbo.finance_accounts ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)) cash FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)`:`N'{"settings":[],"cash":[]}'`;
 return `${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
${CANDIDATE_SEMANTIC_SQL}
DECLARE @metadataJson nvarchar(max)=@local_master_manifest,@semanticJson nvarchar(max)=@candidateSemantic;
DECLARE @securityJson nvarchar(max)=(SELECT JSON_QUERY((SELECT principal_id,name,type,sid,authentication_type,default_schema_name,owning_principal_id,is_fixed_role FROM sys.database_principals ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) principals,JSON_QUERY((SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) members,JSON_QUERY((SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES)) permissions FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
DECLARE @objectIdsJson nvarchar(max)=(SELECT SCHEMA_NAME(schema_id) schemaName,name,RTRIM(type) type,object_id objectId,parent_object_id parentObjectId,OBJECT_NAME(parent_object_id) parentName FROM sys.objects WHERE is_ms_shipped=0 ORDER BY SCHEMA_NAME(schema_id),name,type FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @identitiesJson nvarchar(max)=(SELECT SCHEMA_NAME(t.schema_id) schemaName,t.name tableName,c.object_id objectId,c.column_id columnId,c.name columnName,CONVERT(varchar(50),c.seed_value) seedValue,CONVERT(varchar(50),c.increment_value) incrementValue,CONVERT(varchar(50),c.last_value) lastValue,CONVERT(varchar(50),IDENT_CURRENT(QUOTENAME(SCHEMA_NAME(t.schema_id))+N'.'+QUOTENAME(t.name))) identCurrent FROM sys.identity_columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.is_ms_shipped=0 ORDER BY c.object_id,c.column_id FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @rowsJson nvarchar(max)=(SELECT x.tableName,x.[rowCount] FROM (${tables.map(n=>`SELECT ${q(n)} tableName,COUNT_BIG(*) AS [rowCount] FROM dbo.[${n}]`).join(' UNION ALL ')}) x ORDER BY x.tableName FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @markerJson nvarchar(max)=(SELECT id,CONVERT(varchar(36),environment_id) environment_id,schema_version,actual_t1,external_operations,read_only,CONVERT(varchar(33),created_at,126) created_at FROM dbo.desktop_empty_installation ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @referencesJson nvarchar(max)=${references};
${BASELINE_HASH_FIELDS.map(k=>`IF @${k}Json IS NULL THROW 51995,'K0210_COMPLETE_SNAPSHOT_MISSING',1;DECLARE @${k}Sha256 varchar(64)=${hashSql('@'+k+'Json')};`).join('\n')}`;
}
export const nativeSelect=version=>`SELECT N'K0210_EMPTY_PROFILE_SCHEMA${version}_OBSERVED' state,${BASELINE_HASH_FIELDS.flatMap(k=>[`@${k}Json ${k}Json`,`@${k}Sha256 ${k}Sha256`]).join(',')};`;
export function compileCompleteSchema2Observer(value){const m=fixedEmptyIdentity(value);const sql=`${preamble(m,OLD_TABLES,2)}
${emptyGuard(OLD_TABLES,['desktop_empty_installation'])}
${snapshot(OLD_TABLES,false)}
${nativeSelect(2)} COMMIT TRANSACTION;${finishSql}`;return Object.freeze({kind:'K0210_COMPLETE_SCHEMA2_OBSERVER_PREVIEW',sql,sha256:hash(sql),identity:m,identitySha256:hash(JSON.stringify(m)),sourceSignature:BASELINE_SOURCE_SIGNATURE,executionAuthorized:false,sqlTested:false,readOnly:true,requiresRootDecisionAndOsProof:true,requiresSeparateNativeObservation:true,scope:'All36 tables, all user objects and all36-table identity columns; no legacy27-table projection.'});}
