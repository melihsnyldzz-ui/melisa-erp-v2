// Exact dedicated TEST install, schema+least-privilege SQL account+normal test
// operator in one transaction, initially disabled/inactive. Effective access
// is checked after commit, before a separately guarded activation.
// Client text contains ODBC parameters only.
// CREATE LOGIN needs a server-side literal: SQL telemetry may observe it.
import {createHash} from 'node:crypto';
import {compileFirstSaleSchemaProposal} from './first-sale-schema-proposal.mjs';
import {DESKTOP_LIFECYCLE_PERMISSION_MANIFEST,DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopLifecyclePermissionPolicy.mjs';
export const FIRST_SALE_INSTALL_BASELINE='cc3f08a44d00044ddeadb6499ad4d37a126adfb751ccbd54e7499619962cc3bd';
const login='melisa_desktop_test_writer_20261105',role='desktop_local_writer_v2';
const rights=['customer.view','customer.edit','product.view','product.edit','supplier.view','sales.view','sales.create','sales.edit','sales.finalize'];
export function compileFirstSaleInstall({mode}={}){
 if(!['rollback','apply'].includes(mode))throw Error('FIRST_SALE_INSTALL_MODE');
 const base=compileFirstSaleSchemaProposal({reviewedBaselineSha256:FIRST_SALE_INSTALL_BASELINE,mode:'apply'});
 const end="COMMIT TRANSACTION; SELECT N'FIRST_SALE_SCHEMA_APPLIED';";
 if(base.sql.split(end).length!==2)throw Error('FIRST_SALE_INSTALL_SOURCE');
 const grants=DESKTOP_LIFECYCLE_PERMISSION_MANIFEST.map(v=>`GRANT ${v.permission} ON OBJECT::[dbo].[${v.name}]${v.column?` ([${v.column}])`:''} TO [${role}];`).join('\n');
 const setup=`
 SET @installStage=10;
 IF SUSER_ID(N'${login}') IS NOT NULL OR USER_ID(N'${login}') IS NOT NULL OR EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'desktop_first_sale_operator') OR EXISTS(SELECT 1 FROM dbo.users WHERE username=N'erp_deneme') THROW 51995,'FIRST_SALE_INSTALL_ALREADY_PRESENT',1;
 IF EXISTS(SELECT 1 FROM sys.server_triggers WHERE is_ms_shipped=0) OR EXISTS(SELECT 1 FROM sys.triggers WHERE is_ms_shipped=0) OR EXISTS(SELECT 1 FROM sys.servers WHERE is_linked=1) THROW 51995,'FIRST_SALE_INSTALL_EXTERNAL_HOOK',1;
 DECLARE @secret nvarchar(128)=?,@appHash nvarchar(100)=?;
 IF @secret IS NULL OR DATALENGTH(@secret)<>92 OR LEFT(@secret,3) COLLATE Latin1_General_100_BIN2<>N'A9!' COLLATE Latin1_General_100_BIN2 OR @appHash IS NULL OR DATALENGTH(@appHash)<>120 OR LEFT(@appHash,7) COLLATE Latin1_General_100_BIN2<>N'$2b$12$' COLLATE Latin1_General_100_BIN2 THROW 51995,'FIRST_SALE_INSTALL_SECRET_FORMAT',1;
 DECLARE @i int=4; WHILE @i<=46 BEGIN IF CHARINDEX(SUBSTRING(@secret,@i,1) COLLATE Latin1_General_100_BIN2,N'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-' COLLATE Latin1_General_100_BIN2)=0 THROW 51995,'FIRST_SALE_INSTALL_SECRET_FORMAT',1; SET @i+=1; END;
 DECLARE @ddl nvarchar(max)=N'CREATE LOGIN [${login}] WITH PASSWORD=N'+QUOTENAME(@secret,'''')+N',CHECK_POLICY=ON,CHECK_EXPIRATION=OFF,DEFAULT_DATABASE=[MELISA_ERP_DESKTOP_TEST_20261105];';
 SET @installStage=20;
 EXEC sys.sp_executesql @ddl; SET @ddl=NULL;SET @secret=NULL;
 ALTER LOGIN [${login}] DISABLE;
 SET @installStage=30;
 EXEC sys.sp_executesql N'CREATE USER [${login}] FOR LOGIN [${login}];';
 GRANT CONNECT TO [${login}]; GRANT VIEW DEFINITION TO [${login}];
 ${grants}
 ALTER ROLE [${role}] ADD MEMBER [${login}];
 SET @installStage=40;
 DECLARE @newRole TABLE(id bigint NOT NULL); INSERT dbo.roles(code,name,description,is_system_role,is_active) OUTPUT inserted.id INTO @newRole VALUES(N'desktop_first_sale_operator',N'ERP deneme personeli',N'Yalniz yeni bos TEST ilk satis akisi',0,1);
 INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) SELECT r.id,p.k,1,CASE WHEN p.k IN(N'customer.edit',N'product.edit',N'sales.create') THEN 1 ELSE 0 END,CASE WHEN p.k IN(N'customer.edit',N'product.edit',N'sales.edit') THEN 1 ELSE 0 END,0,CASE WHEN p.k=N'sales.finalize' THEN 1 ELSE 0 END FROM @newRole r CROSS JOIN (VALUES ${rights.map(k=>`(N'${k}')`).join(',')}) p(k);
 INSERT dbo.users(username,password_hash,display_name,role_id,is_active,created_by,updated_by) SELECT N'erp_deneme',@appHash,N'ERP deneme personeli',id,0,NULL,NULL FROM @newRole; SET @appHash=NULL;
 INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,reason,source) SELECT NULL,N'user_created',N'user',id,N'Isolated desktop TEST first sale operator',N'desktop-first-sale-install' FROM dbo.users WHERE username=N'erp_deneme';
 IF (SELECT COUNT_BIG(*) FROM dbo.roles WHERE code=N'desktop_first_sale_operator')<>1 OR (SELECT COUNT_BIG(*) FROM dbo.users WHERE username=N'erp_deneme')<>1 OR (SELECT COUNT_BIG(*) FROM dbo.permissions p JOIN dbo.roles r ON r.id=p.role_id WHERE r.code=N'desktop_first_sale_operator')<>9 OR EXISTS(SELECT 1 FROM sys.server_role_members WHERE member_principal_id=SUSER_ID(N'${login}')) OR NOT EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'${role}') AND member_principal_id=USER_ID(N'${login}')) THROW 51995,'FIRST_SALE_INSTALL_READBACK',1;
 SET @installStage=50;
 IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name=N'${login}' AND is_disabled=1 AND is_policy_checked=1 AND default_database_name=N'MELISA_ERP_DESKTOP_TEST_20261105') OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE username=N'erp_deneme' AND is_active=0) THROW 51995,'FIRST_SALE_DISABLED_STATE_REJECTED',1;
 ${mode==='rollback'?"THROW 51990,'FIRST_SALE_INSTALL_CONTROLLED_ROLLBACK',1;":"COMMIT TRANSACTION;SELECT N'FIRST_SALE_INSTALL_APPLIED';"}`;
 // The bcrypt prefix contains $': a replacement string would expand it into
 // the SQL suffix. A function preserves every byte of the bound hash guard.
 const oldCatch='END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;';
 if(base.sql.split(oldCatch).length!==2)throw Error('FIRST_SALE_CATCH_SOURCE');
 const safeCatch=`END TRY BEGIN CATCH
 DECLARE @originalNumber int=ERROR_NUMBER(),@originalState int=ERROR_STATE(),@originalLine int=ERROR_LINE(),@cleanupNumber int=0;
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 BEGIN TRY REVERT;SET @impersonating=0; END TRY BEGIN CATCH SET @cleanupNumber=ERROR_NUMBER(); END CATCH;
 IF @originalNumber=51990 AND @cleanupNumber=0 THROW;
 DECLARE @safeError nvarchar(2048)=CONCAT(N'FIRST_SALE_SETUP_FAILURE stage=',@installStage,N' error=',@originalNumber,N' state=',@originalState,N' line=',@originalLine,N' cleanup=',@cleanupNumber);
 THROW 51996,@safeError,1;
 END CATCH;`;
 const sql=base.sql.replace(end,()=>setup).replace(oldCatch,()=>safeCatch).replace('SET NOCOUNT ON;','SET NOCOUNT ON; DECLARE @installStage int=0,@impersonating bit=0;');
 return Object.freeze({mode,sql,sqlSha256:createHash('sha256').update(sql).digest('hex'),secretParameterCount:2,login,appUsername:'erp_deneme',commercialSeed:false,existingUserModified:false,createsDisabledLogin:true,createsInactiveOperator:true,effectiveVerificationBeforeActivationRequired:true,serverSidePasswordVisibility:'POSSIBLE'});
}
