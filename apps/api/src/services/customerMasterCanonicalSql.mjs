// SQL text only: no executor, DDL/GRANT runner, or runtime activation.
import {CUSTOMER_MASTER_DDL,MASTER_SOURCE_SQL,MASTER_LIST_SQL,MASTER_UPDATE_SQL,MASTER_RECOVERY_SQL} from './customerMasterSqlContract.mjs';
import {CUSTOMER_CARD_READY_SQL,CUSTOMER_CARD_PRESERVED_SQL} from './customerCardReadStore.mjs';
import {CUSTOMER_MASTER_NORMAL_SCOPE,CUSTOMER_MASTER_NORMAL_ADMISSION} from './customerMasterCanonicalRuntime.mjs';
import {customerMasterError} from './customerMasterModel.mjs';
const quote=value=>"N'"+value.replaceAll("'","''")+"'";
const adapt=text=>text.replaceAll('LOWER(CONVERT(varchar(36),p.copy_id))','p.scope_key').replaceAll('LOWER(CONVERT(varchar(36),@copy_id))','@scope_key').replaceAll('copy_id','scope_key').replaceAll('copyId','scopeKey').replaceAll('melisa-stage4-copy:','melisa-customer-master:');
const scopeGuard=`IF @scope_key IS NULL OR @admission_hash IS NULL OR @scope_key COLLATE Latin1_General_100_BIN2<>${quote(CUSTOMER_MASTER_NORMAL_SCOPE)} OR @admission_hash<>${quote(CUSTOMER_MASTER_NORMAL_ADMISSION)} THROW 52110,'CUSTOMER_MASTER_UNAVAILABLE',1;`;
export function canonicalCustomerMasterDDL(sourceCodeCollation){
 if(typeof sourceCodeCollation!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(sourceCodeCollation))throw customerMasterError();
 return adapt(CUSTOMER_MASTER_DDL).replaceAll('scope_key uniqueidentifier NOT NULL','scope_key nvarchar(128) COLLATE Latin1_General_100_BIN2 NOT NULL')
 .replace('customer_code nvarchar(50) NOT NULL',`customer_code nvarchar(50) COLLATE ${sourceCodeCollation} NOT NULL`)
 .replace(' FOREIGN KEY(scope_key) REFERENCES dbo.stage4_copy_manifest(scope_key),\n','')
 +`\nALTER TABLE dbo.customer_master_local_v1 ADD CHECK(scope_key=${quote(CUSTOMER_MASTER_NORMAL_SCOPE)});\nALTER TABLE dbo.customer_master_requests_v1 ADD CHECK(scope_key=${quote(CUSTOMER_MASTER_NORMAL_SCOPE)});\nALTER TABLE dbo.customer_master_audit_v1 ADD CHECK(scope_key=${quote(CUSTOMER_MASTER_NORMAL_SCOPE)});`;
}
const columnSets={local:[['scope_key','nvarchar',256],['customer_id','bigint',8],['identity_hash','char',64],['customer_code','nvarchar',100],['customer_name','nvarchar',500],['customer_type','nvarchar',60],['version','bigint',8],['updated_by','bigint',8]],requests:[['scope_key','nvarchar',256],['request_id','uniqueidentifier',16],['customer_id','bigint',8],['actor_id','bigint',8],['identity_hash','char',64],['payload_hash','char',64],['payload_json','nvarchar',-1],['committed_version','bigint',8]],audit:[['scope_key','nvarchar',256],['request_id','uniqueidentifier',16],['actor_id','bigint',8],['customer_id','bigint',8],['payload_hash','char',64],['before_json','nvarchar',-1,1],['after_json','nvarchar',-1],['created_at','datetime2',8]]};
export const CUSTOMER_MASTER_NORMAL_COLUMN_SETS=Object.freeze(Object.fromEntries(Object.entries(columnSets).map(([name,cols])=>[name,Object.freeze(cols.map(col=>Object.freeze([...col])))])));
// Keep the observational metadata reader and the transactional writer frame on
// the same finite set of recognized constraint expressions. Other syntaxes
// stay unverified until independently assessed, even if SQL-equivalent.
export const CUSTOMER_MASTER_KNOWN_CHECKS=Object.freeze(Object.fromEntries(Object.entries({
 VERSION_POSITIVE:['([version]>(0))','(version>0)'],
 COMMITTED_VERSION_POSITIVE:['([committed_version]>(0))','(committed_version>0)'],
 TARGET_SCOPE_FIXED:[`([scope_key]=N'${CUSTOMER_MASTER_NORMAL_SCOPE}')`,`(scope_key=N'${CUSTOMER_MASTER_NORMAL_SCOPE}')`],
 CUSTOMER_TYPE_SET:["([customer_type]=N'mixed' OR [customer_type]=N'retail' OR [customer_type]=N'wholesale' OR [customer_type]=N'customer')","(customer_type IN(N'customer',N'wholesale',N'retail',N'mixed'))"]
}).map(([name,values])=>[name,Object.freeze(values)])));
export const CUSTOMER_MASTER_KNOWN_UTC_DEFAULTS=Object.freeze(['(sysutcdatetime())','(SYSUTCDATETIME())','sysutcdatetime()','SYSUTCDATETIME()']);
const schema=Object.entries(columnSets).map(([part,columns])=>{const table='dbo.customer_master_'+part+'_v1';return `OBJECT_ID(N'${table}',N'U') IS NOT NULL
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'${table}'))=${columns.length}
 AND NOT EXISTS(SELECT 1 FROM (VALUES ${columns.map(([name,type,len,nullable])=>`(N'${name}',TYPE_ID(N'${type}'),${len},${nullable??0})`).join(',')}) e(n,t,l,z) LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'${table}') AND c.name=e.n WHERE c.column_id IS NULL OR c.system_type_id<>e.t OR c.user_type_id<>c.system_type_id OR c.max_length<>e.l OR c.is_nullable<>e.z OR c.is_identity<>0 OR c.is_computed<>0)
 AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'${table}') AND name=N'scope_key' AND collation_name=N'Latin1_General_100_BIN2')
 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'${table}') AND is_primary_key=1 AND is_disabled=0 AND INDEX_COL(N'${table}',index_id,1)=N'scope_key' AND INDEX_COL(N'${table}',index_id,2)=N'${part==='local'?'customer_id':'request_id'}' AND INDEX_COL(N'${table}',index_id,3) IS NULL)
 AND NOT EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N'${table}'))`;}).join('\n AND ');
const fks=[['local','dbo.customers',[['customer_id','id']]],['requests','dbo.customer_master_local_v1',[['scope_key','scope_key'],['customer_id','customer_id']]],['audit','dbo.customer_master_requests_v1',[['scope_key','scope_key'],['request_id','request_id']]]].map(([part,to,pairs])=>`EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id=OBJECT_ID(N'dbo.customer_master_${part}_v1') AND f.referenced_object_id=OBJECT_ID(N'${to}') AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0 AND f.update_referential_action=0 AND (SELECT COUNT(*) FROM sys.foreign_key_columns WHERE constraint_object_id=f.object_id)=${pairs.length} ${pairs.map(([a,b],i)=>`AND EXISTS(SELECT 1 FROM sys.foreign_key_columns k WHERE k.constraint_object_id=f.object_id AND k.constraint_column_id=${i+1} AND COL_NAME(k.parent_object_id,k.parent_column_id)=N'${a}' AND COL_NAME(k.referenced_object_id,k.referenced_column_id)=N'${b}')`).join(' ')})`).join('\n AND ');
// A hidden trigger, index, column or FK must not make a NOT EXISTS schema
// check appear successful. Check each object in the same transaction frame;
// NULL/0 visibility is not evidence of a matching schema or write admission.
export const CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL=['dbo.customers','dbo.customer_master_local_v1','dbo.customer_master_requests_v1','dbo.customer_master_audit_v1'].map(name=>`HAS_PERMS_BY_NAME(${quote(name)},N'OBJECT',N'VIEW DEFINITION')=1`).join('\n AND ');
const objectFor=part=>'dbo.customer_master_'+part+'_v1';
const requiredChecks={local:['TARGET_SCOPE_FIXED','VERSION_POSITIVE','CUSTOMER_TYPE_SET'],requests:['TARGET_SCOPE_FIXED','COMMITTED_VERSION_POSITIVE'],audit:['TARGET_SCOPE_FIXED']};
const validExpression=(column,values)=>`${column} COLLATE Latin1_General_100_BIN2 IN(${values.map(quote).join(',')})`;
export const CUSTOMER_MASTER_CONSTRAINTS_SQL=Object.entries(requiredChecks).flatMap(([part,kinds])=>{
 const object=quote(objectFor(part)),all=Object.values(CUSTOMER_MASTER_KNOWN_CHECKS).flat();
 return [
  `(SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(${object}))=1`,
  `NOT EXISTS(SELECT 1 FROM sys.check_constraints c WHERE c.parent_object_id=OBJECT_ID(${object}) AND (c.is_disabled<>0 OR c.is_not_trusted<>0 OR c.definition IS NULL OR NOT (${validExpression('c.definition',all)})))`,
  ...kinds.map(kind=>`EXISTS(SELECT 1 FROM sys.check_constraints c WHERE c.parent_object_id=OBJECT_ID(${object}) AND c.is_disabled=0 AND c.is_not_trusted=0 AND ${validExpression('c.definition',CUSTOMER_MASTER_KNOWN_CHECKS[kind])})`),
  part==='audit'?`(SELECT COUNT(*) FROM sys.default_constraints d WHERE d.parent_object_id=OBJECT_ID(${object}))=1 AND EXISTS(SELECT 1 FROM sys.default_constraints d WHERE d.parent_object_id=OBJECT_ID(${object}) AND COL_NAME(d.parent_object_id,d.parent_column_id)=N'created_at' AND ${validExpression('d.definition',CUSTOMER_MASTER_KNOWN_UTC_DEFAULTS)})`:`NOT EXISTS(SELECT 1 FROM sys.default_constraints d WHERE d.parent_object_id=OBJECT_ID(${object}))`
 ];
}).join('\n AND ');
const sourceColumns=['id','customer_code','name','customer_type'];
const selectColumns=[...Object.entries(columnSets).flatMap(([part,columns])=>columns.map(([name])=>[objectFor(part),name])),...sourceColumns.map(name=>['dbo.customers',name])];
const columnPermission=(object,column,permission)=>`HAS_PERMS_BY_NAME(${quote(object)},N'OBJECT',${quote(permission)},${quote(column)},N'COLUMN')=1`;
const selects=selectColumns.map(([object,column])=>columnPermission(object,column,'SELECT')).join('\n AND ');
const writes=[...Object.keys(columnSets).map(part=>`HAS_PERMS_BY_NAME(${quote(objectFor(part))},N'OBJECT',N'INSERT')=1`),...['customer_code','customer_name','customer_type','version','updated_by'].map(column=>columnPermission(objectFor('local'),column,'UPDATE'))].join('\n AND ');
// Read-only actors do not require write permissions; update contexts do.
export const CUSTOMER_MASTER_EFFECTIVE_PERMISSIONS_SQL=`(${selects}) AND (@permission_key=N'customer.view' OR (${writes}))`;
export const NORMAL_MASTER_FRAME_SQL=`/* customer-master:normal-frame */
${scopeGuard}
IF @permission_key IS NULL OR @permission_key NOT IN(N'customer.view',N'customer.update') THROW 52110,'CUSTOMER_MASTER_UNAVAILABLE',1;
${CUSTOMER_CARD_READY_SQL}
SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,
 IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,
 @@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,
 (SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,
 APPLOCK_MODE(N'public',N'melisa-customer-master:'+@scope_key,N'Transaction') copyLockMode,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_customer_cards'))),2) sourceReaderHash,
 (${CUSTOMER_CARD_PRESERVED_SQL}) guardHash,
 (SELECT u.id,u.role_id roleId,r.code roleCode,CONVERT(bit,p.can_view) canView,CONVERT(bit,p.can_update) canUpdate FROM dbo.users u WITH(HOLDLOCK) JOIN dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id JOIN dbo.permissions p WITH(HOLDLOCK) ON p.role_id=r.id AND p.permission_key=@permission_key WHERE u.id=@actor_id AND u.is_active=1 AND r.is_active=1 FOR JSON PATH) actorJson,
 CONVERT(bit,CASE WHEN ${CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL}
 AND ${schema} AND ${fks} AND ${CUSTOMER_MASTER_CONSTRAINTS_SQL}
 AND ${CUSTOMER_MASTER_EFFECTIVE_PERMISSIONS_SQL}
 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.customer_master_local_v1') AND is_unique=1 AND is_disabled=0 AND has_filter=0 AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,1)=N'scope_key' AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,2)=N'customer_code' AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,3) IS NULL)
 AND EXISTS(SELECT 1 FROM sys.columns p JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.customers') AND c.name=N'customer_code' WHERE p.object_id=OBJECT_ID(N'dbo.customer_master_local_v1') AND p.name=N'customer_code' AND p.collation_name=c.collation_name AND c.max_length=100 AND c.system_type_id=TYPE_ID(N'nvarchar') AND c.is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'name' AND max_length=500 AND system_type_id=TYPE_ID(N'nvarchar') AND is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'customer_type' AND max_length=60 AND system_type_id=TYPE_ID(N'nvarchar') AND is_nullable=0)
 THEN 1 ELSE 0 END) schemaValid;`;
export const NORMAL_MASTER_SOURCE_SQL=adapt(MASTER_SOURCE_SQL);
export const NORMAL_MASTER_LIST_SQL=adapt(MASTER_LIST_SQL);
export const NORMAL_MASTER_UPDATE_SQL=scopeGuard+'\n'+adapt(MASTER_UPDATE_SQL);
export const NORMAL_MASTER_RECOVERY_SQL=scopeGuard+'\n'+adapt(MASTER_RECOVERY_SQL);
