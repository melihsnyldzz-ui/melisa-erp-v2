// Offline only. Fixed V3 -> V4 DDL, first rolled back and independently observed.
import {createHash} from 'node:crypto';
import {compileMasterV3Snapshot,MASTER_V3_TARGET_IDENTITY_SQL,MASTER_V3_SECURITY_SNAPSHOT_SQL,MASTER_V3_BUSINESS_SNAPSHOT_SQL,MASTER_V3_TARGET} from './master-v3-transition.mjs';
import {LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from './local-master-schema-proposal.mjs';
import {MASTER_V4_OPERATION_CHECK_SQL} from './master-v4-journal-sql.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopMasterVersion.mjs';
export const MASTER_V4_TARGET=MASTER_V3_TARGET;
const sha=s=>createHash('sha256').update(s).digest('hex');
const quote=s=>`N'${s.replaceAll("'","''")}'`;
const identity=MASTER_V3_TARGET_IDENTITY_SQL.replace('schema_version IN(2,3)','schema_version IN(3,4)');
const snapshots=`${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${MASTER_V3_SECURITY_SNAPSHOT_SQL}\n${MASTER_V3_BUSINESS_SNAPSHOT_SQL}
 SET @metadata=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2));SET @security=@v3_security_sha;SET @business=@v3_business_sha;`;
const hashes=`EXEC sys.sp_executesql ${quote(snapshots)},N'@metadata char(64) OUTPUT,@security char(64) OUTPUT,@business char(64) OUTPUT',@metadata=@metadata OUTPUT,@security=@security OUTPUT,@business=@business OUTPUT;`;
export function compileMasterV4Snapshot(){const old=compileMasterV3Snapshot();if(old.sql.split(MASTER_V3_TARGET_IDENTITY_SQL).length!==3)throw Error('MASTER_V4_SNAPSHOT_DRIFT');const sql=old.sql.replaceAll(MASTER_V3_TARGET_IDENTITY_SQL,identity);return Object.freeze({...old,sql,sha256:sha(sql)});}
const ddl=`CREATE UNIQUE INDEX UX_desktop_v4_customer_currency ON dbo.party_currency_accounts(customer_id,currency_code) WHERE customer_id IS NOT NULL AND supplier_id IS NULL;
 ALTER TABLE dbo.desktop_local_master_requests DROP CONSTRAINT CK_desktop_local_requests_operation;
 ALTER TABLE dbo.desktop_local_master_requests WITH CHECK ADD CONSTRAINT CK_desktop_local_requests_operation CHECK ${MASTER_V4_OPERATION_CHECK_SQL};
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_profile_version_mode;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version IN(2,3,4) AND read_only=0));
 UPDATE dbo.desktop_empty_installation SET schema_version=4 WHERE id=1 AND schema_version=3 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V4_MARKER_UPDATE',1;`;
export const MASTER_V4_TRANSITION_SCOPE=Object.freeze({fromSchemaVersion:3,toSchemaVersion:4,expectedTableCount:36,newTables:0,newGrants:0,newPrincipals:0,businessDml:false,newJournalOperation:'customer.account.create',uniqueIndex:'UX_desktop_v4_customer_currency',requiresStoppedOwnedApp:true,rollbackFirst:true});
export function compileMasterV4Transition(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='businessRowsSha256,metadataSha256,mode,securitySha256'||!['rollback','apply'].includes(v.mode)||['metadataSha256','securitySha256','businessRowsSha256'].some(k=>typeof v[k]!=='string'||!/^[a-f0-9]{64}$/.test(v[k])))throw Error('MASTER_V4_OPTIONS_REJECTED');
 const matches=`@metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}'`;
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V4_EXISTING_TRANSACTION',1;
 ${identity}
 DECLARE @metadata char(64),@security char(64),@business char(64),@owner int,@impersonating bit=0;
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V4_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 DECLARE @table sysname,@lockSql nvarchar(max),@count bigint;
 DECLARE v4_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
 OPEN v4_tables;FETCH NEXT FROM v4_tables INTO @table;
 WHILE @@FETCH_STATUS=0 BEGIN
 SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@table)+N' WITH(TABLOCKX,HOLDLOCK);';EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@count OUTPUT;
 FETCH NEXT FROM v4_tables INTO @table;END;CLOSE v4_tables;DEALLOCATE v4_tables;
 ${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=3)
 OR EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.party_currency_accounts') AND name=N'UX_desktop_v4_customer_currency')
 OR EXISTS(SELECT customer_id,currency_code FROM dbo.party_currency_accounts WHERE customer_id IS NOT NULL AND supplier_id IS NULL GROUP BY customer_id,currency_code HAVING COUNT_BIG(*)>1)
 OR EXISTS(SELECT 1 FROM dbo.desktop_local_master_requests WHERE operation=N'customer.account.create')
 OR (SELECT COUNT_BIG(*) FROM sys.sql_logins WHERE name=N'melisa_desktop_test_writer_20261105' AND sid=0x417717302D2EFA478380226433A0BCA6 AND is_disabled=0 AND is_policy_checked=1)<>1
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=0x417717302D2EFA478380226433A0BCA6)
 THROW 51995,'MASTER_V4_PRECONDITION',1;
 ${hashes}
 IF ${matches} THROW 51995,'MASTER_V4_BASELINE_DRIFT',1;
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 EXEC sys.sp_executesql ${quote(ddl)};
 IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=4)
 OR (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N'CK_desktop_local_requests_operation',N'CK_desktop_profile_version_mode') AND is_disabled=0 AND is_not_trusted=0)<>2
 THROW 51995,'MASTER_V4_SCHEMA_READBACK',1;
 ${DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL}
 ${hashes}
 IF @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' THROW 51995,'MASTER_V4_ROWS_OR_SECURITY_CHANGED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'MASTER_V4_TRANSACTION_REJECTED',1;
 ${v.mode==='rollback'?`ROLLBACK TRANSACTION;${hashes}
 IF ${matches} THROW 51995,'MASTER_V4_ROLLBACK_DRIFT',1;
 SELECT N'MASTER_V4_ROLLED_BACK' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;`:`COMMIT TRANSACTION;
 SELECT N'MASTER_V4_COMMITTED_UNVERIFIED' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;`}
 END TRY BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 REVERT;
 THROW;END CATCH;`;
 return Object.freeze({mode:v.mode,sql,sha256:sha(sql),target:MASTER_V4_TARGET,scope:MASTER_V4_TRANSITION_SCOPE,sqlTested:false,requiresIndependentReadback:true});
}
