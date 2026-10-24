// Native admission around the existing account/personnel transaction services.
// Source compiler only: importing this module never connects to SQL or installs.
import {buildCleanFinanceRehearsalPredecessors} from './clean-finance-rehearsal-sql.mjs';
import {buildCleanDirectSaleDefinitions} from './clean-direct-sale-sql.mjs';
import {buildCleanContactDefinitions} from './clean-contact-sql.mjs';
import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';
import {CLEAN_LOGIN} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {CLEAN_PERSONNEL_ROLES} from '../../apps/api/src/services/cleanPersonnelManagement.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {readFileSync} from 'node:fs';
const Q=s=>"N'"+s.replaceAll("'","''")+"'";
const deny="THROW 51972,'CLEAN_PERSONNEL_DENIED',1;";
const active='SELECT 1 FROM dbo.clean_personnel_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()';
const allowedRole=(id,code)=>'('+Object.entries(CLEAN_PERSONNEL_ROLES).map(([n,c])=>`(${id}=${n} AND ${code}=${Q(c)})`).join(' OR ')+')';
const unchanged=fields=>`IF EXISTS(SELECT 1 FROM OPENJSON(JSON_QUERY(@inserted,'$[0]')) i FULL JOIN OPENJSON(JSON_QUERY(@deleted,'$[0]')) d ON i.[key]=d.[key] WHERE COALESCE(i.[key],d.[key]) NOT IN(${fields.map(Q).join(',')}) AND(i.[key] IS NULL OR d.[key] IS NULL OR i.type<>d.type OR ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(d.value,N'') COLLATE Latin1_General_100_BIN2)) ${deny}`;
const J=(name,from='@inserted')=>`JSON_VALUE(${from},'$[0].${name}')`;
const N=name=>`ISNULL(TRY_CONVERT(bigint,${J(name)}),-1)`;
// Reuse only the schema bodies of the established personnel migrations. Their
// original LIVE database guards and independent transactions are not executed;
// the existing exact clean target, lock and atomic installer own this context.
// Each top-level IF is compiled after the previous DDL, including new columns.
export function cleanPersonnelSchemaBatches(){
 return [['0013_personnel_terminal_sales.sql',7],['0014_personnel_operational_restrictions.sql',4]].flatMap(([name,count])=>{
  const source=readFileSync(new URL('../../infra/sql/migrations/'+name,import.meta.url),'utf8');
  const start=source.indexOf('BEGIN TRANSACTION;'),end=source.indexOf('COMMIT TRANSACTION;',start);
  if(start<0||end<0)throw Error('Canonical personnel migration boundary changed');
  const body=source.slice(start+'BEGIN TRANSACTION;'.length,end).replace(/^GO\s*$/gm,'').trim();
  const batches=body.split(/(?=^IF )/m).map(b=>b.trim()).filter(Boolean);
  if(batches.length!==count||batches.some(b=>!b.startsWith('IF ')||/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|EXEC(?:UTE)?)\b|\b(?:BEGIN|COMMIT|ROLLBACK) TRANSACTION\b/i.test(b)))throw Error('Canonical personnel migration scope changed');
  return batches;
 });
}
const personnelColumns=[
 ['id','bigint',8,0,1],['employee_code','nvarchar',100,0,0],['full_name','nvarchar',300,0,0],['phone','nvarchar',80,1,0],['department','nvarchar',200,1,0],['job_title','nvarchar',200,1,0],['user_id','bigint',8,1,0],['is_active','bit',1,0,0],['created_at','datetime2',null,0,0],['created_by','bigint',8,1,0],['updated_at','datetime2',null,1,0],['updated_by','bigint',8,1,0],['row_version','timestamp',8,0,0],['can_terminal_sale','bit',1,0,0],['can_change_sale_price','bit',1,0,0],['max_sale_discount_percent','decimal',null,0,0]
];
const personnelShape=`EXISTS(SELECT 1 FROM(VALUES ${personnelColumns.map(([n,t,len,nullable,identity])=>`(${Q(n)},${Q(t)},${len??'NULL'},${nullable},${identity})`).join(',')}) expected(name,type_name,max_length,is_nullable,is_identity) LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.employees',N'U') AND c.name=expected.name WHERE c.column_id IS NULL OR TYPE_NAME(c.system_type_id)<>expected.type_name OR expected.max_length IS NOT NULL AND c.max_length<>expected.max_length OR c.is_nullable<>expected.is_nullable OR c.is_identity<>expected.is_identity OR c.is_computed<>0 OR(expected.type_name=N'datetime2' AND c.scale<>0)OR(expected.name=N'max_sale_discount_percent' AND(c.precision<>5 OR c.scale<>2)))`;
const personnelLinks=[['employees','user_id','FK_employees_users','users'],['terminal_devices','assigned_employee_id','FK_terminal_devices_employees','employees'],['sales_invoices','employee_id','FK_sales_invoices_employees','employees']];
const personnelIndexes=[['employees','PK_employees',1,'id'],['employees','UQ_employees_employee_code',1,'employee_code'],['employees','IX_employees_active_name',0,'is_active,full_name,id'],['employees','UX_employees_user_id',1,'user_id'],['terminal_devices','IX_terminal_devices_assigned_employee',0,'assigned_employee_id,is_active,id'],['sales_invoices','IX_sales_invoices_employee_date',0,'employee_id,document_date,status,id']];
export function buildCleanPersonnelSchemaSql(){
 const bad="THROW 51972,'B5_MANAGEMENT_PERSONNEL_SCHEMA_INCOMPATIBLE',1;";
 return `IF OBJECT_ID(N'dbo.terminal_devices',N'U') IS NULL OR OBJECT_ID(N'dbo.sales_invoices',N'U') IS NULL OR(OBJECT_ID(N'dbo.employees') IS NOT NULL AND OBJECT_ID(N'dbo.employees',N'U') IS NULL) ${bad}
 IF OBJECT_ID(N'dbo.employees',N'U') IS NOT NULL AND ${personnelShape} ${bad}
 ${personnelLinks.slice(1).map(([table,col])=>`IF COL_LENGTH(N'dbo.${table}',N'${col}') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}',N'U') AND name=N'${col}' AND system_type_id=127 AND is_nullable=1 AND is_computed=0 AND is_identity=0) ${bad}`).join('\n')}
 ${cleanPersonnelSchemaBatches().map(b=>`EXEC(${Q(b)});`).join('\n')}
 IF ${personnelShape} ${bad}
 ${personnelLinks.map(([table,col,fk,target])=>`IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys f JOIN sys.foreign_key_columns c ON c.constraint_object_id=f.object_id WHERE f.parent_object_id=OBJECT_ID(N'dbo.${table}',N'U') AND f.name=N'${fk}' AND f.referenced_object_id=OBJECT_ID(N'dbo.${target}',N'U') AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0 AND f.update_referential_action=0 AND c.parent_column_id=COLUMNPROPERTY(f.parent_object_id,N'${col}',N'ColumnId') AND c.referenced_column_id=COLUMNPROPERTY(f.referenced_object_id,N'id',N'ColumnId') AND(SELECT COUNT(*) FROM sys.foreign_key_columns x WHERE x.constraint_object_id=f.object_id)=1) ${bad}`).join('\n')}
 ${personnelIndexes.map(([table,name,unique,columns])=>`IF NOT EXISTS(SELECT 1 FROM sys.indexes i WHERE i.object_id=OBJECT_ID(N'dbo.${table}',N'U') AND i.name=N'${name}' AND i.is_unique=${unique} AND i.is_disabled=0 ${name==='PK_employees'?'AND i.is_primary_key=1':name==='UQ_employees_employee_code'?'AND i.is_unique_constraint=1':''} AND(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N',') WITHIN GROUP(ORDER BY k.key_ordinal) FROM sys.index_columns k JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0)=N'${columns}' AND ${name==='UX_employees_user_id'?"LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(i.filter_definition,N'(',N''),N')',N''),N'[',N''),N']',N''),N' ',N'') COLLATE Latin1_General_100_CI_AS)=N'user_idisnotnull'":"i.has_filter=0"}) ${bad}`).join('\n')}
 ${[['is_active','1'],['created_at','sysutcdatetime'],['can_terminal_sale','1'],['can_change_sale_price','0'],['max_sale_discount_percent','0']].map(([column,value])=>`IF NOT EXISTS(SELECT 1 FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id WHERE d.parent_object_id=OBJECT_ID(N'dbo.employees',N'U') AND c.name=N'${column}' AND LOWER(REPLACE(REPLACE(REPLACE(d.definition,N'(',N''),N')',N''),N' ',N'') COLLATE Latin1_General_100_CI_AS)=N'${value}') ${bad}`).join('\n')}
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.employees',N'U') AND name=N'CK_employees_max_sale_discount' AND is_disabled=0 AND is_not_trusted=0 AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(definition,N'(',N''),N')',N''),N'[',N''),N']',N''),N' ',N'') COLLATE Latin1_General_100_CI_AS)=N'max_sale_discount_percent>=0andmax_sale_discount_percent<=100') ${bad}`;
}
const load=`${CLEAN_TARGET_SQL}
 IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR @@TRANCOUNT<>1 OR ISNULL(APPLOCK_MODE(N'public',N'CLEAN_STORE_DAY_20261022',N'Transaction'),N'NoLock')<>N'Exclusive' OR(SELECT COUNT(*) FROM dbo.clean_personnel_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID())<>1 ${deny}
 DECLARE @op nvarchar(24),@actor bigint,@target bigint,@payload nvarchar(max),@changed int,@audited int;
 SELECT @op=operation,@actor=actor_id,@target=target_id,@payload=payload_json,@changed=changed_count,@audited=audit_count FROM dbo.clean_personnel_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();`;

export function buildCleanPersonnelManagementDefinitions(){
 const prior={...buildCleanFinanceRehearsalPredecessors(),...buildCleanDirectSaleDefinitions().definitions,...buildCleanContactDefinitions().definitions};
 const before={},definitions={};
 const changedNames=[...Object.keys(prior).filter(n=>n.endsWith('_ready')),'clean_sale_audit_logs_guard'];
 const projected=`SELECT ${changedNames.map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.clean_personnel_manifest FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
 for(const name of changedNames.filter(n=>n.endsWith('_ready'))){
  const body=prior[name];before[name]=body;
  let next=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`COALESCE(JSON_VALUE(@personnelPredecessors,N'$.'+${a}.name),${hash})`);
  next=next.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,(hash)=>`COALESCE(JSON_VALUE(@personnelPredecessors,N'$.'+d.name),${hash})`);
  if(next===body)throw Error('Personnel predecessor projection missing '+name);
  definitions[name]=next.replace('SET NOCOUNT ON;',`SET NOCOUNT ON;EXEC dbo.usp_clean_personnel_ready;DECLARE @personnelPredecessors nvarchar(max)=(${projected});`);
 }
 const audit=prior.clean_sale_audit_logs_guard,at=audit.indexOf('AS BEGIN')+8;
 if(at<8)throw Error('Personnel audit predecessor missing');
 before.clean_sale_audit_logs_guard=audit;
 definitions.clean_sale_audit_logs_guard=audit.slice(0,at)+`\n IF EXISTS(${active}) BEGIN DECLARE @pi nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@pd nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);EXEC dbo.usp_clean_personnel_guard N'audit_logs',@pi,@pd;RETURN;END;\n`+audit.slice(at);

 definitions.usp_clean_personnel_bind=`CREATE PROCEDURE dbo.usp_clean_personnel_bind @actor_id bigint,@operation nvarchar(24),@target_id bigint=NULL,@payload_json nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR @@TRANCOUNT<>1 OR @actor_id<>10018 OR @operation NOT IN(N'user_create',N'user_update',N'user_password',N'employee_create',N'employee_update') OR ISJSON(@payload_json)<>1 OR LEN(@payload_json)>6000 ${deny}
 IF NOT EXISTS(SELECT 1 FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions p ON p.role_id=r.id WHERE u.id=@actor_id AND u.username=N'semih' AND u.is_active=1 AND r.id=28 AND r.code=N'clean_test_administrator' AND r.is_active=1 AND p.permission_key=N'settings.manage' AND(p.can_create=1 OR p.can_update=1)) ${deny}
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${deny}
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_ready;
 IF EXISTS(SELECT 1 FROM dbo.clean_personnel_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_day_intents) OR EXISTS(SELECT 1 FROM dbo.clean_direct_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_order_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_fx_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_cash_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_inventory_intents) OR EXISTS(SELECT 1 FROM dbo.clean_contact_intents) ${deny}
 IF EXISTS(SELECT [key] FROM OPENJSON(@payload_json) GROUP BY [key] HAVING COUNT(*)<>1) OR EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key] IN(N'password',N'passwordHash',N'password_hash',N'loginPassword')) ${deny}
 DECLARE @role bigint=TRY_CONVERT(bigint,JSON_VALUE(@payload_json,'$.roleId')),@user bigint=TRY_CONVERT(bigint,JSON_VALUE(@payload_json,'$.userId'));
 IF @operation IN(N'user_create',N'employee_create') BEGIN IF @target_id IS NOT NULL ${deny} END
 ELSE IF @target_id IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.clean_personnel_members WHERE CASE WHEN @operation=N'employee_update' THEN employee_id ELSE user_id END=@target_id) THROW 51973,'CLEAN_PERSONNEL_PROTECTED_RECORD',1;
 IF @operation IN(N'user_create',N'user_update') BEGIN
  IF EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key] NOT IN(N'username',N'displayName',N'roleId',N'isActive')) ${deny}
  IF @operation=N'user_create' AND(@role IS NULL OR(SELECT COUNT(*) FROM OPENJSON(@payload_json))<>4) ${deny}
  IF @role IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.roles r WHERE r.id=@role AND r.is_active=1 AND ${allowedRole('r.id','r.code')}) THROW 51974,'CLEAN_PERSONNEL_ROLE_FORBIDDEN',1;
 END;
 IF @operation LIKE N'employee[_]%' BEGIN
  IF @user IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.clean_personnel_members m JOIN dbo.users u ON u.id=m.user_id JOIN dbo.roles r ON r.id=u.role_id WHERE m.user_id=@user AND u.is_active=1 AND r.is_active=1 AND ${allowedRole('r.id','r.code')} AND((@operation=N'employee_create' AND m.employee_id IS NULL)OR(@operation=N'employee_update' AND m.employee_id=@target_id))) THROW 51973,'CLEAN_PERSONNEL_PROTECTED_RECORD',1;
  IF EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key] NOT IN(N'employeeCode',N'fullName',N'phone',N'department',N'jobTitle',N'userId',N'canTerminalSale',N'canChangeSalePrice',N'maxSaleDiscountPercent',N'isActive')) OR(SELECT COUNT(*) FROM OPENJSON(@payload_json))<>10 ${deny}
  IF ISNULL(JSON_VALUE(@payload_json,'$.canChangeSalePrice'),N'')<>N'false' OR ISNULL(TRY_CONVERT(decimal(5,2),JSON_VALUE(@payload_json,'$.maxSaleDiscountPercent')),-1)<>0 ${deny}
 END;
 IF @operation=N'user_password' AND((SELECT COUNT(*) FROM OPENJSON(@payload_json))<>1 OR ISNULL(JSON_VALUE(@payload_json,'$.passwordConfigured'),N'')<>N'true') ${deny}
 INSERT dbo.clean_personnel_intents(session_id,transaction_id,actor_id,operation,target_id,payload_json,changed_count,audit_count)VALUES(@@SPID,CURRENT_TRANSACTION_ID(),@actor_id,@operation,@target_id,@payload_json,0,0);
 SELECT CONVERT(bit,1) accepted,@actor_id actorId,@operation operation;END;`;

 definitions.usp_clean_personnel_guard=`CREATE PROCEDURE dbo.usp_clean_personnel_guard @table sysname,@inserted nvarchar(max),@deleted nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${load}
 IF ISJSON(@inserted)<>1 OR ISJSON(@deleted)<>1 OR(SELECT COUNT(*) FROM OPENJSON(@inserted))<>1 OR(SELECT COUNT(*) FROM OPENJSON(@deleted))>1 ${deny}
 IF @table=N'audit_logs' BEGIN
  IF EXISTS(SELECT 1 FROM OPENJSON(@deleted)) OR @changed<>1 OR @audited<>0 OR ${N('actor_user_id')}<>@actor OR ${N('entity_id')}<>@target OR ${J('source')}<>N'web-admin' OR ${J('entity_type')}<>CASE WHEN @op LIKE N'user[_]%' THEN N'user' ELSE N'employee' END OR ${J('action')}<>CASE @op WHEN N'user_create' THEN N'user_created' WHEN N'user_update' THEN N'user_access_updated' WHEN N'user_password' THEN N'user_password_reset' WHEN N'employee_create' THEN N'employee_created' ELSE N'employee_updated' END ${deny}
  IF EXISTS(SELECT 1 FROM OPENJSON(COALESCE(${J('before_json')},N'{}')) WHERE LOWER([key]) LIKE N'%password%' AND [key]<>N'passwordConfigured') OR EXISTS(SELECT 1 FROM OPENJSON(COALESCE(${J('after_json')},N'{}')) WHERE LOWER([key]) LIKE N'%password%' AND [key]<>N'passwordConfigured') ${deny}
  UPDATE dbo.clean_personnel_intents SET audit_count=1 WHERE session_id=@@SPID;RETURN;END;
 IF @changed<>0 OR ${N('id')}<1 ${deny}
 IF @table=N'users' BEGIN
  IF @op NOT LIKE N'user[_]%' OR ${N('updated_by')}<>@actor ${deny}
  IF @op=N'user_create' BEGIN
   IF EXISTS(SELECT 1 FROM OPENJSON(@deleted)) OR @target IS NOT NULL OR ${N('created_by')}<>@actor OR EXISTS(SELECT 1 FROM dbo.clean_personnel_members WHERE user_id=${N('id')}) ${deny}
   INSERT dbo.clean_personnel_members(user_id,created_by)VALUES(${N('id')},@actor);SET @target=${N('id')};
  END ELSE BEGIN
   IF(SELECT COUNT(*) FROM OPENJSON(@deleted))<>1 OR ${N('id')}<>@target OR TRY_CONVERT(bigint,${J('id','@deleted')})<>@target OR NOT EXISTS(SELECT 1 FROM dbo.clean_personnel_members WHERE user_id=@target) ${deny}
   IF @op=N'user_password' BEGIN ${unchanged(['password_hash','updated_at','updated_by','row_version'])} END
   ELSE BEGIN ${unchanged(['username','display_name','role_id','is_active','updated_at','updated_by','row_version'])} END;
  END;
  IF @op IN(N'user_create',N'user_password') AND(ISNULL(LEN(${J('password_hash')}),0)<>60 OR ISNULL(LEFT(${J('password_hash')},7),N'') NOT IN(N'$2a$12$',N'$2b$12$')) ${deny}
  IF @op<>N'user_password' BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.roles r WHERE r.id=${N('role_id')} AND r.is_active=1 AND ${allowedRole('r.id','r.code')}) ${deny}
   IF EXISTS(SELECT 1 FROM OPENJSON(@payload) p LEFT JOIN OPENJSON(JSON_QUERY(@inserted,'$[0]')) i ON i.[key]=CASE p.[key] WHEN N'displayName' THEN N'display_name' WHEN N'roleId' THEN N'role_id' WHEN N'isActive' THEN N'is_active' ELSE p.[key] END WHERE i.[key] IS NULL OR i.type<>p.type OR ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(p.value,N'') COLLATE Latin1_General_100_BIN2) ${deny}
   IF @op=N'user_update' AND EXISTS(SELECT 1 FROM OPENJSON(JSON_QUERY(@inserted,'$[0]')) i JOIN OPENJSON(JSON_QUERY(@deleted,'$[0]')) d ON d.[key]=i.[key] LEFT JOIN OPENJSON(@payload) p ON p.[key]=CASE i.[key] WHEN N'display_name' THEN N'displayName' WHEN N'role_id' THEN N'roleId' WHEN N'is_active' THEN N'isActive' ELSE i.[key] END WHERE i.[key] IN(N'username',N'display_name',N'role_id',N'is_active') AND p.[key] IS NULL AND(i.type<>d.type OR ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(d.value,N'') COLLATE Latin1_General_100_BIN2)) ${deny}
   IF LEN(${J('username')}) NOT BETWEEN 3 AND 80 OR ${J('username')} COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9._-]%' OR LEN(${J('display_name')})<1 ${deny}
  END;
 END ELSE IF @table=N'employees' BEGIN
  IF @op NOT LIKE N'employee[_]%' OR ${N('updated_by')}<>@actor OR NOT EXISTS(SELECT 1 FROM dbo.clean_personnel_members m JOIN dbo.users u ON u.id=m.user_id WHERE m.user_id=${N('user_id')} AND u.is_active=1) ${deny}
  IF @op=N'employee_create' BEGIN
   IF EXISTS(SELECT 1 FROM OPENJSON(@deleted)) OR @target IS NOT NULL OR ${N('created_by')}<>@actor ${deny}
   UPDATE dbo.clean_personnel_members SET employee_id=${N('id')} WHERE user_id=${N('user_id')} AND employee_id IS NULL;IF @@ROWCOUNT<>1 ${deny} SET @target=${N('id')};
  END ELSE BEGIN
   IF(SELECT COUNT(*) FROM OPENJSON(@deleted))<>1 OR ${N('id')}<>@target OR TRY_CONVERT(bigint,${J('id','@deleted')})<>@target OR ${N('user_id')}<>TRY_CONVERT(bigint,${J('user_id','@deleted')}) ${deny}
   ${unchanged(['employee_code','full_name','phone','department','job_title','can_terminal_sale','can_change_sale_price','max_sale_discount_percent','is_active','updated_at','updated_by','row_version'])}
  END;
  IF EXISTS(SELECT 1 FROM OPENJSON(@payload) p LEFT JOIN OPENJSON(JSON_QUERY(@inserted,'$[0]')) i ON i.[key]=CASE p.[key] WHEN N'employeeCode' THEN N'employee_code' WHEN N'fullName' THEN N'full_name' WHEN N'jobTitle' THEN N'job_title' WHEN N'userId' THEN N'user_id' WHEN N'canTerminalSale' THEN N'can_terminal_sale' WHEN N'canChangeSalePrice' THEN N'can_change_sale_price' WHEN N'maxSaleDiscountPercent' THEN N'max_sale_discount_percent' WHEN N'isActive' THEN N'is_active' ELSE p.[key] END WHERE i.[key] IS NULL OR(CASE WHEN p.[key] IN(N'phone',N'department',N'jobTitle') AND ISNULL(p.value,N'')=N'' AND ISNULL(i.value,N'')=N'' THEN 0 WHEN p.[key]=N'maxSaleDiscountPercent' AND TRY_CONVERT(decimal(5,2),p.value)=TRY_CONVERT(decimal(5,2),i.value) THEN 0 WHEN i.type=p.type AND ISNULL(i.value,N'') COLLATE Latin1_General_100_BIN2=ISNULL(p.value,N'') COLLATE Latin1_General_100_BIN2 THEN 0 ELSE 1 END)=1) ${deny}
 END ELSE ${deny}
 UPDATE dbo.clean_personnel_intents SET target_id=@target,changed_count=1 WHERE session_id=@@SPID;END;`;

 for(const table of ['users','employees'])definitions[`clean_personnel_${table}_guard`]=`CREATE TRIGGER dbo.clean_personnel_${table}_guard ON dbo.${table} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
 DECLARE @inserted nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@deleted nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);
 ${table==='users'?`IF NOT EXISTS(${active}) BEGIN
 ${CLEAN_TARGET_SQL} IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR(SELECT COUNT(*) FROM inserted)<>1 OR(SELECT COUNT(*) FROM deleted)<>1 ${deny}
 ${unchanged(['last_login_at','row_version'])} RETURN;END;`:''}
 EXEC dbo.usp_clean_personnel_guard N'${table}',@inserted,@deleted;END;`;
 definitions.usp_clean_personnel_finish=`CREATE PROCEDURE dbo.usp_clean_personnel_finish WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${load}
 IF @changed<>1 OR @audited<>1 OR @target IS NULL ${deny}
 DELETE dbo.clean_personnel_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();SELECT CONVERT(bit,1) verified,@actor actorId,@op operation;END;`;
 for(const table of ['members','intents'])definitions[`clean_personnel_${table}_guard`]=`CREATE TRIGGER dbo.clean_personnel_${table}_guard ON dbo.clean_personnel_${table} AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;IF USER_NAME()<>N'dbo' ${deny} ${table==='members'?`IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.user_id=d.user_id WHERE i.user_id IS NULL OR i.created_by<>d.created_by OR i.created_at<>d.created_at OR d.employee_id IS NOT NULL) OR NOT EXISTS(${active}) ${deny}`:`IF EXISTS(SELECT 1 FROM inserted WHERE session_id<>@@SPID OR transaction_id<>CURRENT_TRANSACTION_ID()) ${deny}`} END;`;
 definitions.clean_personnel_manifest_immutable=`CREATE TRIGGER dbo.clean_personnel_manifest_immutable ON dbo.clean_personnel_manifest AFTER INSERT,UPDATE,DELETE AS BEGIN ${deny} END;`;
 definitions.usp_clean_personnel_ready=`CREATE PROCEDURE dbo.usp_clean_personnel_ready WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.clean_personnel_manifest)<>PERSONNEL_TOTAL OR EXISTS(SELECT 1 FROM dbo.clean_personnel_manifest d LEFT JOIN sys.sql_modules m ON m.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE m.object_id IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR(OBJECTPROPERTY(m.object_id,'IsTrigger')=1 AND OBJECTPROPERTY(m.object_id,'ExecIsTriggerDisabled')<>0)) ${deny} END;`;
 definitions.usp_clean_personnel_ready=definitions.usp_clean_personnel_ready.replace('PERSONNEL_TOTAL',Object.keys(definitions).length);
 return {before,definitions};
}

export function buildCleanPersonnelManagementSql({probe=false}={}){
 const {before,definitions}=buildCleanPersonnelManagementDefinitions();
 return `SET NOCOUNT ON;SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 ${deny}
 IF OBJECT_ID(N'dbo.clean_personnel_manifest') IS NOT NULL BEGIN EXEC dbo.usp_clean_personnel_ready;${Object.entries(definitions).map(([n,b])=>`IF NOT EXISTS(SELECT 1 FROM dbo.clean_personnel_manifest WHERE name=${Q(n)} AND after_hash=${Q(moduleHash(b))}) ${deny}`).join('\n')} SELECT N'B5_MANAGEMENT_ALREADY_INSTALLED' result;RETURN;END;
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${deny}
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_contact_ready;
 ${Object.entries(before).map(([n,b])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))),2),N'')<>${Q(moduleHash(b))} THROW 51972,${Q('B5_MANAGEMENT_PREDECESSOR_'+n)},1;`).join('\n')}
 ${buildCleanPersonnelSchemaSql()}
 IF COL_LENGTH(N'dbo.employees',N'can_terminal_sale') IS NULL OR COL_LENGTH(N'dbo.employees',N'can_change_sale_price') IS NULL OR COL_LENGTH(N'dbo.employees',N'max_sale_discount_percent') IS NULL ${deny}
 CREATE TABLE dbo.clean_personnel_manifest(name sysname PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,before_definition nvarchar(max) NULL);
 CREATE TABLE dbo.clean_personnel_members(user_id bigint NOT NULL PRIMARY KEY REFERENCES dbo.users(id),employee_id bigint NULL REFERENCES dbo.employees(id),created_by bigint NOT NULL REFERENCES dbo.users(id),created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 CREATE UNIQUE INDEX UX_clean_personnel_employee ON dbo.clean_personnel_members(employee_id) WHERE employee_id IS NOT NULL;
 CREATE TABLE dbo.clean_personnel_intents(session_id int PRIMARY KEY,transaction_id bigint NOT NULL,actor_id bigint NOT NULL,operation nvarchar(24) NOT NULL,target_id bigint NULL,payload_json nvarchar(max) NOT NULL,changed_count int NOT NULL,audit_count int NOT NULL);
 ${Object.entries(definitions).sort(([a],[b])=>(a==='clean_personnel_manifest_immutable'?1:0)-(b==='clean_personnel_manifest_immutable'?1:0)).map(([n,b])=>`INSERT dbo.clean_personnel_manifest VALUES(${Q(n)},${before[n]?Q(moduleHash(before[n])):'NULL'},${Q(moduleHash(b))},${before[n]?Q(before[n]):'NULL'});EXEC(${Q(b.replace(/^CREATE PROCEDURE/,before[n]?'ALTER PROCEDURE':'CREATE PROCEDURE').replace(/^CREATE TRIGGER/,before[n]?'ALTER TRIGGER':'CREATE TRIGGER'))});`).join('\n')}
 ${['manifest','members','intents'].map(t=>`DENY INSERT,UPDATE,DELETE ON dbo.clean_personnel_${t} TO [${CLEAN_LOGIN}];`).join('\n')}
 GRANT SELECT ON dbo.clean_personnel_members TO [${CLEAN_LOGIN}];
 GRANT SELECT ON dbo.employees TO [${CLEAN_LOGIN}];
 GRANT INSERT,UPDATE ON dbo.users TO [${CLEAN_LOGIN}];GRANT INSERT,UPDATE ON dbo.employees TO [${CLEAN_LOGIN}];DENY DELETE ON dbo.users TO [${CLEAN_LOGIN}];DENY DELETE ON dbo.employees TO [${CLEAN_LOGIN}];
 GRANT EXECUTE ON dbo.usp_clean_personnel_bind TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_personnel_finish TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_personnel_ready TO [${CLEAN_LOGIN}];
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_contact_ready;EXEC dbo.usp_clean_personnel_ready;
 ${probe?"ROLLBACK;SELECT N'B5_MANAGEMENT_METADATA_PROBE_ROLLED_BACK' result;":"COMMIT;SELECT N'B5_MANAGEMENT_METADATA_INSTALLED' result;"}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
