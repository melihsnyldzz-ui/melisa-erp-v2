// Pure first-owner contract and SQL preview. No connection, filesystem or authority.
import {createHash} from 'node:crypto';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {DESKTOP_FINANCE_V7_PERMISSION_MANIFEST,getDesktopEmptyV7SchemaOnlyGuardSql} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {EMPTY_V7_TARGET,EMPTY_V7_SQL_LOGIN,EMPTY_V7_SQL_ROLE,EMPTY_V7_OWNER_PERMISSION_ROWS} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
export const EMPTY_V7_SETUP_TARGET=EMPTY_V7_TARGET;
export function emptyV7HeldFileLimit(file,sha256){return typeof file==='string'&&file.replaceAll('\\','/').toLowerCase()==='c:/program files/nodejs/node.exe'&&sha256==='3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5'?134217728:2000000;}
const fail=()=>{throw Error('EMPTY_V7_FIRST_SETUP_REJECTED');};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const same=(a,b)=>a&&Object.keys(a).sort().join(',')===Object.keys(b).sort().join(',')&&Object.entries(b).every(([k,v])=>a[k]===v);
const q=s=>"N'"+s.replaceAll("'","''")+"'",hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
export const EMPTY_V7_SETUP_TABLES=Object.freeze([...compileDesktopEmptyBootstrap().expectedTables,'desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests','desktop_goods_receipts','desktop_goods_receipt_lines','desktop_goods_purchase_links','desktop_goods_requests','finance_accounts','finance_account_movements','desktop_finance_requests'].sort());
if(EMPTY_V7_SETUP_TABLES.length!==43)fail();
export function validateEmptyV7HumanPassword(value){
 if(!value||Object.keys(value).sort().join(',')!=='confirmation,password,passwordConfirmation'||value.confirmation!==true||typeof value.password!=='string'||value.password.length<8||value.password.length>64||!value.password.isWellFormed()||Buffer.byteLength(value.password,'utf8')>72||value.passwordConfirmation!==value.password)fail();return true;
}
export function assertEmptyV7SetupDecision(value,{packageHash,sourceHead,selfSha256,coreSha256,windowSha256,ownerSid,recordedSchema7AcceptanceSha256,actualIndependentReviewSha256}={}){
 if(!value||value.state!=='ROOT_EMPTY_V7_FIRST_SETUP_DECISION_V1'||!uuid(value.operationId)||!hex(packageHash)||!/^[a-f0-9]{40}$/.test(sourceHead)||![selfSha256,coreSha256,windowSha256,recordedSchema7AcceptanceSha256,actualIndependentReviewSha256].every(hex)||value.packageHash!==packageHash||value.sourceHead!==sourceHead||value.localSourceSha256!==selfSha256||value.coreSha256!==coreSha256||value.windowSha256!==windowSha256||value.ownerSid!==ownerSid||!same(value.target,EMPTY_V7_TARGET)||value.recordedSchema7AcceptanceSha256!==recordedSchema7AcceptanceSha256||value.actualIndependentReviewSha256!==actualIndependentReviewSha256||value.schema7Accepted!==true||value.newSqlPrincipalAuthorized!==true||value.firstHumanOwnerAuthorized!==true||value.noAutomaticRetry!==true)fail();
 for(const k of ['db5Writes','otherDatabaseWrites','roleOrUserCopyFromDb5','businessWrites','companyPolicyDefaults','externalOperations','runtimeAction'])if(value[k]!==false)fail();return true;
}
export function assertEmptyV7SchemaAcceptance(value,independentReviewSha256,{adminSidHex,sqlProcessBirth}={}){
 const t=value?.target,birth=x=>typeof x==='string'?x.replace(/(\.\d*?)0+Z$/,'$1Z'):null;
 if(!value||value.state!=='ROOT_EMPTY_PROFILE_SCHEMA7_ACTUAL_ACCEPTANCE_V1'||value.decision!=='ACCEPT_EMPTY_SCHEMA7_TECHNICAL_PROFILE_ONLY'||value.schemaVersion!==7||value.schema7Accepted!==true||!t||['server','database','databaseId','databaseGuid','environmentId'].some(k=>t[k]!==EMPTY_V7_TARGET[k])||!['2026-11-10T11:10:18.03','2026-11-10T11:10:18.030'].includes(t.databaseCreateTime)||t.sqlProcessId!==8440||birth(t.sqlProcessBirth)!=='2026-11-10T00:32:27.387319Z'||birth(sqlProcessBirth)!==birth(t.sqlProcessBirth)||typeof adminSidHex!=='string'||!/^0x(?:[0-9A-F]{2}){8,85}$/.test(adminSidHex)||t.adminSid!==adminSidHex||!hex(independentReviewSha256)||value.independentCombinedReviewSha256!==independentReviewSha256)fail();
 for(const k of ['actualApplyResultSha256','actualObserverResultSha256','applyRootExitSha256','observerRootExitSha256'])if(!hex(value[k]))fail();
 const names=['metadata','security','objectIds','identities','rows','marker','semantic','references'];
 if(!value.nativeHashes8||Array.isArray(value.nativeHashes8)||Object.keys(value.nativeHashes8).sort().join(',')!==names.sort().join(',')||!Object.values(value.nativeHashes8).every(hex))fail();
 for(const [k,n]of Object.entries({totalUserTables:43,emptyBusinessTables:40,markerRows:1,technicalSettingsRows:2,zeroTryCashRows:1}))if(value[k]!==n)fail();
 for(const k of ['fullK02Acceptance','fullERPReady','humanAcceptance','LIVEAuthorized','firstUserOrAppSqlPrincipalAuthorizedByThisRecord'])if(value[k]!==false)fail();return true;
}
export function assertEmptyV7SchemaReview(review,acceptance){
 if(!review||review.decision!=='GO_EMPTY_SCHEMA7_TECHNICAL_PROFILE_ONLY'||review.P1P2Findings!==0||typeof review.sourceHead!=='string'||!/^[a-f0-9]{40}$/.test(review.sourceHead)||!hex(review.rootApplyDecisionSha256)||!same(review.target,acceptance.target)||!same(review.nativeHashes8,acceptance.nativeHashes8))fail();
 for(const [r,a]of [['applyResultSha256','actualApplyResultSha256'],['observerResultSha256','actualObserverResultSha256'],['applyRootExitSha256','applyRootExitSha256'],['observerRootExitSha256','observerRootExitSha256']])if(!hex(review[r])||review[r]!==acceptance[a])fail();
 for(const k of ['fullK02Acceptance','fullERPReady','humanAcceptance','LIVEAuthorized'])if(review[k]!==false)fail();return true;
}
export function emptyV7AdminIdentitySql({adminPid,adminSidHex}={}){
 if(!Number.isSafeInteger(adminPid)||adminPid<1||typeof adminSidHex!=='string'||!/^0x(?:[0-9A-F]{2}){8,85}$/.test(adminSidHex))fail();
 return "IF DB_ID()<>9 OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210')"
 +" OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')"
 +" OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>8440 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1"
 +" OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' OR ORIGINAL_LOGIN() IS NULL OR SUSER_SNAME() IS NULL"
 +" OR SUSER_SID()<>"+adminSidHex+" OR SUSER_SID(ORIGINAL_LOGIN())<>"+adminSidHex
 +" OR ISNULL((SELECT host_process_id FROM sys.dm_exec_sessions WHERE session_id=@@SPID),0)<>"+adminPid
 +" OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=9 AND database_guid='6d773db9-bd69-4906-b791-d63a490ab1f2')"
 +" OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=9 AND CONVERT(varchar(23),create_date,126)='2026-11-10T11:10:18.030')"
 +" OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='287f689a-43bb-43dd-950b-adb615fcb20c' AND schema_version=7 AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'EMPTY_V7_SETUP_TARGET',1;";
}
const emptyChecks=EMPTY_V7_SETUP_TABLES.filter(n=>!['desktop_empty_installation','system_settings','finance_accounts'].includes(n)).map(n=>'EXISTS(SELECT 1 FROM dbo.['+n+'])').join(' OR ');
export function emptyV7BeforeSetupSql(identity){
 return emptyV7AdminIdentitySql(identity)+'\n'+getDesktopEmptyV7SchemaOnlyGuardSql()
 +"\nIF "+emptyChecks+" THROW 51995,'EMPTY_V7_SETUP_NOT_EMPTY',1;"
 +"\nIF SUSER_ID(N'"+EMPTY_V7_SQL_LOGIN+"') IS NOT NULL OR USER_ID(N'"+EMPTY_V7_SQL_LOGIN+"') IS NOT NULL OR NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'"+EMPTY_V7_SQL_ROLE+"' AND type=N'R' AND owning_principal_id=DATABASE_PRINCIPAL_ID(N'dbo')) OR EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'"+EMPTY_V7_SQL_ROLE+"') OR member_principal_id=DATABASE_PRINCIPAL_ID(N'"+EMPTY_V7_SQL_ROLE+"')) OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id=DATABASE_PRINCIPAL_ID(N'"+EMPTY_V7_SQL_ROLE+"') OR grantor_principal_id=DATABASE_PRINCIPAL_ID(N'"+EMPTY_V7_SQL_ROLE+"')) THROW 51995,'EMPTY_V7_SETUP_PRINCIPAL_EXISTS',1;"
 +"\nIF (SELECT COUNT(*) FROM dbo.system_settings)<>2 OR (SELECT COUNT(*) FROM dbo.finance_accounts)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.finance_accounts WHERE account_code=N'KASA-TRY' AND currency_code=N'TRY' AND account_type=N'cash' AND opening_balance=0 AND current_balance=0 AND is_active=1) THROW 51995,'EMPTY_V7_SETUP_REFERENCE',1;";
}
export const EMPTY_V7_SQL_GRANTS=Object.freeze(DESKTOP_FINANCE_V7_PERMISSION_MANIFEST.map(v=>'GRANT '+v.permission+' ON OBJECT::[dbo].['+v.name+']'+(v.column?' (['+v.column+'])':'')+' TO ['+EMPTY_V7_SQL_ROLE+'];'));
export const EMPTY_V7_SQL_GRANTS_SHA256=hash(EMPTY_V7_SQL_GRANTS.join('\n'));
export function compileEmptyV7FirstSetup(identity){
 const rights=EMPTY_V7_OWNER_PERMISSION_ROWS.map(p=>'('+q(p.permission_key)+',1,1,1,1,1)').join(',');
 const sql="SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'EMPTY_V7_SETUP_TX',1;\nBEGIN TRY BEGIN TRANSACTION;DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-empty-db9-first-owner',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;IF @owner<0 THROW 51995,'EMPTY_V7_SETUP_LOCK',1;\n"
 +emptyV7BeforeSetupSql(identity)
 +"\nIF @technicalPassword IS NULL OR DATALENGTH(@technicalPassword)<>92 OR LEFT(@technicalPassword,3) COLLATE Latin1_General_100_BIN2<>N'A9!' OR @humanHash IS NULL OR DATALENGTH(@humanHash)<>120 OR LEFT(@humanHash,7) COLLATE Latin1_General_100_BIN2<>N'$2b$12$' THROW 51995,'EMPTY_V7_SETUP_PRIVATE_INPUT',1;"
 // As in the existing installer, SQL Server CREATE LOGIN needs a literal;
 // actual technical credentials are private parameters and never public output.
 +"\nDECLARE @ddl nvarchar(max)=N'CREATE LOGIN ["+EMPTY_V7_SQL_LOGIN+"] WITH PASSWORD=N'+QUOTENAME(@technicalPassword,'''')+N',CHECK_POLICY=ON,CHECK_EXPIRATION=OFF,DEFAULT_DATABASE=["+EMPTY_V7_TARGET.database+"];';EXEC sys.sp_executesql @ddl;SET @ddl=NULL;SET @technicalPassword=NULL;"
 +"\nCREATE USER ["+EMPTY_V7_SQL_LOGIN+"] FOR LOGIN ["+EMPTY_V7_SQL_LOGIN+"];GRANT CONNECT TO ["+EMPTY_V7_SQL_LOGIN+"];GRANT VIEW DEFINITION TO ["+EMPTY_V7_SQL_LOGIN+"];\n"+EMPTY_V7_SQL_GRANTS.join('\n')
 +"\nALTER ROLE ["+EMPTY_V7_SQL_ROLE+"] ADD MEMBER ["+EMPTY_V7_SQL_LOGIN+"];"
 +"\nDECLARE @roles TABLE(id bigint);INSERT dbo.roles(code,name,description,is_system_role,is_active) OUTPUT inserted.id INTO @roles VALUES(N'admin',N'Yönetici',N'İlk yerel kurulum yöneticisi',1,1);DECLARE @roleId bigint=(SELECT id FROM @roles);"
 +"\nINSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) SELECT @roleId,k,a,b,c,d,e FROM (VALUES "+rights+") p(k,a,b,c,d,e);"
 +"\nDECLARE @users TABLE(id bigint);INSERT dbo.users(username,password_hash,display_name,role_id,is_active,created_by,updated_by) OUTPUT inserted.id INTO @users VALUES(N'kurulum',@humanHash,N'Kurulum yöneticisi',@roleId,1,NULL,NULL);SET @humanHash=NULL;DECLARE @userId bigint=(SELECT id FROM @users);"
 +"\nINSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,reason,source) VALUES(NULL,N'user_created',N'user',@userId,N'İnsan tarafından tamamlanan ilk kurulum',N'desktop-empty-v7-setup');"
 +"\nIF @userId IS NULL OR @roleId IS NULL OR (SELECT COUNT_BIG(*) FROM dbo.users)<>1 OR (SELECT COUNT_BIG(*) FROM dbo.roles)<>1 OR (SELECT COUNT_BIG(*) FROM dbo.permissions)<>"+EMPTY_V7_OWNER_PERMISSION_ROWS.length+" THROW 51995,'EMPTY_V7_SETUP_READBACK',1;"
 +"\nCOMMIT TRANSACTION;SELECT N'EMPTY_V7_FIRST_OWNER_CREATED' state,CONVERT(varchar(20),@userId) userId,CONVERT(varchar(20),@roleId) roleId,LOWER(CONVERT(varchar(16),row_version,2)) userVersion FROM dbo.users WHERE id=@userId;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;";
 return Object.freeze({kind:'EMPTY_V7_FIRST_SETUP_PREVIEW',sql,sha256:hash(sql),target:EMPTY_V7_TARGET,sqlGrantManifestSha256:EMPTY_V7_SQL_GRANTS_SHA256,executionAuthorized:false,requiresRootDecision:true,requiresHumanSave:true});
}
