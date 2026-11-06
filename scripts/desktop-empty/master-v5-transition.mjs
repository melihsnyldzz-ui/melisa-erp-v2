// Offline compiler. No connection, credentials, file provisioning or SQL
// execution. Rollback candidate hashes are required before an apply is built.
import {createHash} from 'node:crypto';
import {compileMasterV4Snapshot} from './master-v4-transition.mjs';
import {MASTER_V3_TARGET,MASTER_V3_TARGET_IDENTITY_SQL,MASTER_V3_SECURITY_SNAPSHOT_SQL,MASTER_V3_BUSINESS_SNAPSHOT_SQL} from './master-v3-transition.mjs';
import {LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from './local-master-schema-proposal.mjs';
import {DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopMasterVersion.mjs';
import {DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS,DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,DESKTOP_MASTER_V5_CHECKS,DESKTOP_V5_CUSTOMER_MOVEMENT_CHECK} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
import {SALE_WORKFLOW_SCHEMA_PROPOSAL} from './sale-workflow-schema-proposal.mjs';
import {DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT} from '../../packages/shared/src/desktopFinalCancellationProfile.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),quote=v=>`N'${v.replaceAll("'","''")}'`,fail=()=>{throw Error('MASTER_V5_OPTIONS_REJECTED');};
const identity=MASTER_V3_TARGET_IDENTITY_SQL.replace('schema_version IN(2,3)','schema_version IN(4,5)');
const snapshot=`${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${MASTER_V3_SECURITY_SNAPSHOT_SQL}\n${MASTER_V3_BUSINESS_SNAPSHOT_SQL}
 SET @metadata=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2));SET @security=@v3_security_sha;SET @business=@v3_business_sha;`;
const hashes=`EXEC sys.sp_executesql ${quote(snapshot)},N'@metadata char(64) OUTPUT,@security char(64) OUTPUT,@business char(64) OUTPUT',@metadata=@metadata OUTPUT,@security=@security OUTPUT,@business=@business OUTPUT;`;
export const MASTER_V5_TRANSITION_SCOPE=Object.freeze({fromSchemaVersion:4,toSchemaVersion:5,expectedTableCount:36,newTables:0,newPrincipals:0,newPasswords:0,newSqlRights:4,newOperatorPermission:'sales.cancel',businessDml:false,requiresStoppedOwnedApp:true,rollbackFirst:true,rollbackPermissionId:-30002,rollbackMustPreserveIdentity:true,externalOperations:0,actualT1:0});
export function compileMasterV5Snapshot(){const old=compileMasterV4Snapshot(),oldIdentity=MASTER_V3_TARGET_IDENTITY_SQL.replace('schema_version IN(2,3)','schema_version IN(3,4)'),column='(SELECT schema_version FROM dbo.desktop_empty_installation WHERE id=1) schemaVersion;';if(old.sql.split(oldIdentity).length!==3||old.sql.split(column).length!==2)fail();const sql=old.sql.replaceAll(oldIdentity,identity).replace(column,"(SELECT schema_version FROM dbo.desktop_empty_installation WHERE id=1) schemaVersion,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent;");return Object.freeze({...old,sql,sha256:sha(sql)});}
function operatorGuard(rows){
 const values=rows.map(p=>`(CONVERT(varbinary(240),N'${p.key}'),${p.view},${p.create},${p.update},${p.delete},${p.approve})`).join(',');
 return `IF (SELECT COUNT_BIG(*) FROM dbo.roles WHERE id=@operatorRole AND code=N'desktop_first_sale_operator' AND is_active=1 AND is_system_role=0)<>1
 OR (SELECT COUNT_BIG(*) FROM dbo.users WHERE role_id=@operatorRole)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=30002 AND username=N'erp_deneme' AND role_id=@operatorRole AND is_active=1)
 OR (SELECT COUNT_BIG(*) FROM dbo.permissions WHERE role_id=@operatorRole)<>${rows.length}
 OR EXISTS(SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole EXCEPT SELECT * FROM (VALUES ${values}) e(k,v,c,u,d,a))
 OR EXISTS(SELECT * FROM (VALUES ${values}) e(k,v,c,u,d,a) EXCEPT SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole)
 THROW 51995,'MASTER_V5_OPERATOR_DRIFT',1;`;
}
const changedChecks=Object.entries(DESKTOP_MASTER_V5_CHECKS).map(([name,definition])=>{const table=name.includes('resolution')?'desktop_sale_request_resolutions':name.includes('operation')?'desktop_sale_workflow_requests':'desktop_empty_installation';return `ALTER TABLE dbo.${table} DROP CONSTRAINT ${name};ALTER TABLE dbo.${table} WITH CHECK ADD CONSTRAINT ${name} CHECK ${definition};`;}).join('\n');
const grants=`GRANT UPDATE ON OBJECT::dbo.sales_invoices(cancelled_at,cancel_reason,updated_by) TO desktop_local_writer_v2;
 GRANT SELECT ON OBJECT::dbo.terminal_sync_queue TO desktop_local_writer_v2;`;
export function compileMasterV5Transition(v){
 const keys=['mode','metadataSha256','securitySha256','businessRowsSha256',...(v?.mode==='apply'?['candidateMetadataSha256','candidateSecuritySha256']:[])];
 if(!v||typeof v!=='object'||Array.isArray(v)||!['rollback','apply'].includes(v.mode)||Object.keys(v).sort().join(',')!==keys.sort().join(',')||keys.filter(k=>k!=='mode').some(k=>typeof v[k]!=='string'||! /^[a-f0-9]{64}$/.test(v[k])))fail();
 const baseline=`@metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}'`;
 // A negative explicit temporary identity under a positive increment cannot
 // advance the positive seed. Both the precondition and readback are checked.
 // An actual apply allocates its one new permission normally.
 const permissionInsert=v.mode==='rollback'?`SET IDENTITY_INSERT dbo.permissions ON;SET @identityInsert=1;
 INSERT dbo.permissions(id,role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) VALUES(-30002,@operatorRole,N'sales.cancel',1,0,0,0,1);
 SET IDENTITY_INSERT dbo.permissions OFF;SET @identityInsert=0;`:`INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) VALUES(@operatorRole,N'sales.cancel',1,0,0,0,1);`;
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V5_EXISTING_TRANSACTION',1;
 ${identity}
 DECLARE @metadata char(64),@security char(64),@business char(64),@candidateMetadata char(64),@candidateSecurity char(64),@owner int,@operatorRole bigint,@permissionIdentity numeric(38,0),@impersonating bit=0,@identityInsert bit=0;
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V5_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 DECLARE @table sysname,@lockSql nvarchar(max),@count bigint;
 DECLARE v5_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
 OPEN v5_tables;FETCH NEXT FROM v5_tables INTO @table;
 WHILE @@FETCH_STATUS=0 BEGIN SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@table)+N' WITH(TABLOCKX,HOLDLOCK);';EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@count OUTPUT;FETCH NEXT FROM v5_tables INTO @table;END;CLOSE v5_tables;DEALLOCATE v5_tables;
 ${identity}
 IF (SELECT COUNT_BIG(*) FROM dbo.roles WHERE code=N'desktop_first_sale_operator')<>1 THROW 51995,'MASTER_V5_OPERATOR_DRIFT',1;
 SELECT @operatorRole=id FROM dbo.roles WHERE code=N'desktop_first_sale_operator';
 SET @permissionIdentity=IDENT_CURRENT(N'dbo.permissions');
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=4)
 OR @permissionIdentity IS NULL OR @permissionIdentity<=0
 OR NOT EXISTS(SELECT 1 FROM sys.identity_columns WHERE object_id=OBJECT_ID(N'dbo.permissions') AND name=N'id' AND CONVERT(bigint,increment_value)=1)
 OR EXISTS(SELECT 1 FROM dbo.permissions WHERE id=-30002 OR (role_id=@operatorRole AND permission_key=N'sales.cancel'))
 OR (SELECT COUNT_BIG(*) FROM sys.sql_logins WHERE name=N'melisa_desktop_test_writer_20261105' AND sid=0x417717302D2EFA478380226433A0BCA6 AND is_disabled=0 AND is_policy_checked=1)<>1
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=0x417717302D2EFA478380226433A0BCA6)
 THROW 51995,'MASTER_V5_PRECONDITION',1;
 ${operatorGuard(DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS)}
 ${DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL}
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_customer_movements_type' AND parent_object_id=OBJECT_ID(N'dbo.customer_movements') AND is_disabled=0 AND is_not_trusted=0 AND CONVERT(varbinary(max),definition)=CONVERT(varbinary(max),N'([movement_type]=N''sales_invoice'')')) THROW 51995,'MASTER_V5_CUSTOMER_CHECK_DRIFT',1;
 ${hashes}
 IF ${baseline} THROW 51995,'MASTER_V5_BASELINE_DRIFT',1;
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 EXEC sys.sp_executesql ${quote(changedChecks)};
 ALTER TABLE dbo.customer_movements DROP CONSTRAINT CK_customer_movements_type;
 ALTER TABLE dbo.customer_movements WITH CHECK ADD CONSTRAINT CK_customer_movements_type CHECK ${DESKTOP_V5_CUSTOMER_MOVEMENT_CHECK};
 UPDATE dbo.desktop_empty_installation SET schema_version=5 WHERE id=1 AND schema_version=4 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_MARKER_UPDATE',1;
 ${grants}
 ${permissionInsert}
 UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE id=@operatorRole;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_ROLE_UPDATE',1;
 ${operatorGuard(DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS)}
 ${DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL}
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 ${hashes}
 IF @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' OR (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36 THROW 51995,'MASTER_V5_BUSINESS_DRIFT',1;
 SET @candidateMetadata=@metadata;SET @candidateSecurity=@security;
 ${v.mode==='apply'?`IF @metadata COLLATE Latin1_General_100_BIN2<>'${v.candidateMetadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.candidateSecuritySha256}' THROW 51995,'MASTER_V5_CANDIDATE_DRIFT',1;`:''}
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'MASTER_V5_TRANSACTION_REJECTED',1;
 ${v.mode==='rollback'?`ROLLBACK TRANSACTION;
 IF ISNULL(IDENT_CURRENT(N'dbo.permissions'),-1)<>@permissionIdentity THROW 51995,'MASTER_V5_ROLLBACK_IDENTITY_DRIFT',1;
 ${hashes}
 IF ${baseline} THROW 51995,'MASTER_V5_ROLLBACK_DRIFT',1;
 SELECT N'MASTER_V5_ROLLED_BACK' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256,@candidateMetadata candidateMetadataSha256,@candidateSecurity candidateSecuritySha256,CONVERT(varchar(40),@permissionIdentity) permissionIdentityPreserved;`:`COMMIT TRANSACTION;
 SELECT N'MASTER_V5_COMMITTED_UNVERIFIED' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;`}
 END TRY BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 REVERT;
 IF @identityInsert=1 SET IDENTITY_INSERT dbo.permissions OFF;
 THROW;END CATCH;`;
 return Object.freeze({mode:v.mode,sql,sha256:sha(sql),target:MASTER_V3_TARGET,baseline:Object.freeze({metadataSha256:v.metadataSha256,securitySha256:v.securitySha256,businessRowsSha256:v.businessRowsSha256}),candidate:v.mode==='apply'?Object.freeze({metadataSha256:v.candidateMetadataSha256,securitySha256:v.candidateSecuritySha256}):null,scope:MASTER_V5_TRANSITION_SCOPE,sqlTested:false,requiresIndependentReadback:true,requiresSecurityScopeApproval:true});
}
// Recovery is limited to the pre-acceptance state: no business-row change,
// CANCEL_SALE journal, cancel tombstone or filesystem cancellation fence. The
// runner checks the filesystem separately. This never deletes a sale/history.
export function compileMasterV5Revert(v){
 const keys=['metadataSha256','securitySha256','businessRowsSha256','candidateMetadataSha256','candidateSecuritySha256'];
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.sort().join(',')||keys.some(k=>typeof v[k]!=='string'||! /^[a-f0-9]{64}$/.test(v[k])))fail();
 function originalCheck(name){const blocks=SALE_WORKFLOW_SCHEMA_PROPOSAL.filter(s=>s.includes('CONSTRAINT '+name+' CHECK'));if(blocks.length!==1)fail();const part=blocks[0].split('CONSTRAINT '+name+' CHECK')[1]?.trimStart().split('\n')[0]?.replace(/,\s*$/,'');if(!part?.startsWith('(')||!part.endsWith(')'))fail();return part;}
 const restore=`ALTER TABLE dbo.customer_movements DROP CONSTRAINT CK_customer_movements_type;
 ALTER TABLE dbo.customer_movements WITH CHECK ADD CONSTRAINT CK_customer_movements_type CHECK (movement_type IN (N'sales_invoice'));
 ALTER TABLE dbo.desktop_sale_workflow_requests DROP CONSTRAINT CK_desktop_request_operation;
 ALTER TABLE dbo.desktop_sale_workflow_requests WITH CHECK ADD CONSTRAINT CK_desktop_request_operation CHECK ${originalCheck('CK_desktop_request_operation')};
 ALTER TABLE dbo.desktop_sale_request_resolutions DROP CONSTRAINT CK_desktop_resolution_kind;
 ALTER TABLE dbo.desktop_sale_request_resolutions WITH CHECK ADD CONSTRAINT CK_desktop_resolution_kind CHECK ${originalCheck('CK_desktop_resolution_kind')};
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_profile_version_mode;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version IN(2,3,4) AND read_only=0));`;
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V5_EXISTING_TRANSACTION',1;
 ${identity}
 DECLARE @metadata char(64),@security char(64),@business char(64),@owner int,@operatorRole bigint,@impersonating bit=0;
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V5_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 DECLARE @table sysname,@lockSql nvarchar(max),@count bigint;
 DECLARE v5_revert_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
 OPEN v5_revert_tables;FETCH NEXT FROM v5_revert_tables INTO @table;
 WHILE @@FETCH_STATUS=0 BEGIN SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@table)+N' WITH(TABLOCKX,HOLDLOCK);';EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@count OUTPUT;FETCH NEXT FROM v5_revert_tables INTO @table;END;CLOSE v5_revert_tables;DEALLOCATE v5_revert_tables;
 ${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=5)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=0x417717302D2EFA478380226433A0BCA6)
 OR EXISTS(SELECT 1 FROM dbo.desktop_sale_workflow_requests WHERE operation='CANCEL_SALE')
 OR EXISTS(SELECT 1 FROM dbo.desktop_sale_request_resolutions WHERE kind='cancel')
 OR (SELECT COUNT_BIG(*) FROM dbo.roles WHERE code=N'desktop_first_sale_operator')<>1
 THROW 51995,'MASTER_V5_REVERT_PRECONDITION',1;
 SELECT @operatorRole=id FROM dbo.roles WHERE code=N'desktop_first_sale_operator';
 ${operatorGuard(DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS)}
 ${DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL}
 ${hashes}
 IF @metadata COLLATE Latin1_General_100_BIN2<>'${v.candidateMetadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.candidateSecuritySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' THROW 51995,'MASTER_V5_REVERT_BASELINE_DRIFT',1;
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 REVOKE UPDATE ON OBJECT::dbo.sales_invoices(cancelled_at,cancel_reason,updated_by) FROM desktop_local_writer_v2;
 REVOKE SELECT ON OBJECT::dbo.terminal_sync_queue FROM desktop_local_writer_v2;
 DELETE FROM dbo.permissions WHERE role_id=@operatorRole AND permission_key=N'sales.cancel' AND can_view=1 AND can_create=0 AND can_update=0 AND can_delete=0 AND can_approve=1;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_REVERT_PERMISSION',1;
 EXEC sys.sp_executesql ${quote(restore)};
 UPDATE dbo.desktop_empty_installation SET schema_version=4 WHERE id=1 AND schema_version=5 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_REVERT_MARKER',1;
 UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE id=@operatorRole;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_REVERT_ROLE',1;
 ${operatorGuard(DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS)}
 ${DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL}
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 ${hashes}
 IF @metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' THROW 51995,'MASTER_V5_REVERT_READBACK_DRIFT',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'MASTER_V5_TRANSACTION_REJECTED',1;
 COMMIT TRANSACTION;
 SELECT N'MASTER_V5_REVERTED_UNVERIFIED' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;IF @impersonating=1 REVERT;THROW;END CATCH;`;
 return Object.freeze({mode:'revert',sql,sha256:sha(sql),target:MASTER_V3_TARGET,baseline:Object.freeze({metadataSha256:v.metadataSha256,securitySha256:v.securitySha256,businessRowsSha256:v.businessRowsSha256}),candidate:Object.freeze({metadataSha256:v.candidateMetadataSha256,securitySha256:v.candidateSecuritySha256}),publicBindingSha256:sha(DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT),sqlTested:false,requiresEmptyCancellationJournal:true,requiresIndependentReadback:true,requiresSecurityScopeApproval:true});
}
