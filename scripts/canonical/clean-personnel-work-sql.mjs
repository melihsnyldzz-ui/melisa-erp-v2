// Source-only extension of the existing clean transaction binders. No account,
// customer, commercial row, connection, task or installation is created here.
import {buildCleanFinanceRehearsalPredecessors,buildCleanFinanceRehearsalDefinitions,buildCleanFinanceCashDefinitions,buildCleanFinanceFxDefinitions,buildCleanFinanceFxCaseFieldRepairDefinitions,buildCleanFinanceAdministratorDefinitions,buildCleanFinanceLedgerOrderRepairDefinitions} from './clean-finance-rehearsal-sql.mjs';
import {buildCleanDirectSaleDefinitions} from './clean-direct-sale-sql.mjs';
import {buildCleanContactDefinitions} from './clean-contact-sql.mjs';
import {buildCleanPersonnelManagementDefinitions} from './clean-personnel-management-sql.mjs';
import {CLEAN_PERSONNEL_ROLES,CLEAN_PERSONNEL_WORK_ROLES} from '../../apps/api/src/services/cleanPersonnelManagement.mjs';
import {CLEAN_LOGIN} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
const Q=s=>"N'"+s.replaceAll("'","''")+"'";
const deny="THROW 51975,'CLEAN_PERSONNEL_WORK_DENIED',1;";
const seal='clean_personnel_work_manifest';
const groups={sale:[30,31],staff:[30,31],manager:[31],finance:[31,32],all:[30,31,32]};
const roleMatch=(id,code,ids)=>'('+ids.map(n=>`(${id}=${n} AND ${code}=${Q(CLEAN_PERSONNEL_WORK_ROLES[n].code)})`).join(' OR ')+')';
// This is repeated inside the existing native binders/guards, not a reusable
// client-issued capability. The registered member and active employee must be
// the same live user, and no legacy sample user can be adopted.
const personal=(id,kind='all')=>`EXISTS(SELECT 1 FROM dbo.clean_personnel_members pm JOIN dbo.employees pe WITH(HOLDLOCK) ON pe.id=pm.employee_id AND pe.user_id=pm.user_id JOIN dbo.users pu WITH(HOLDLOCK) ON pu.id=pm.user_id JOIN dbo.roles pr WITH(HOLDLOCK) ON pr.id=pu.role_id WHERE pm.user_id=${id} AND pm.user_id NOT IN(15,16,17,18,19,20,21,22,23,10018) AND pe.is_active=1 AND pu.is_active=1 AND pr.is_active=1 AND ${roleMatch('pr.id','pr.code',groups[kind])}${kind==='sale'?' AND pe.can_terminal_sale=1':''})`;
const exact=(body,from,to,count=1)=>{if(body.split(from).length-1!==count)throw Error('B5 work predecessor mismatch: '+from.slice(0,100));return body.replaceAll(from,to);};
const allPrior=()=>({...buildCleanFinanceRehearsalPredecessors(),...buildCleanFinanceRehearsalDefinitions().definitions,...buildCleanFinanceCashDefinitions().definitions,...buildCleanFinanceFxDefinitions().definitions,...buildCleanFinanceFxCaseFieldRepairDefinitions().after,...buildCleanFinanceAdministratorDefinitions().definitions,...buildCleanFinanceLedgerOrderRepairDefinitions().definitions,...buildCleanDirectSaleDefinitions().definitions,...buildCleanContactDefinitions().definitions,...buildCleanPersonnelManagementDefinitions().definitions});
const checks=`(SELECT OBJECT_NAME(parent_object_id) table_name,name,definition,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id IN(OBJECT_ID(N'dbo.work_trade_requests'),OBJECT_ID(N'dbo.stock_movements'),OBJECT_ID(N'dbo.supplier_movements')) ORDER BY parent_object_id,name FOR JSON PATH,INCLUDE_NULL_VALUES)`;
const inboundChecks=`(SELECT name,definition,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.work_inbound_requests') ORDER BY name FOR JSON PATH,INCLUDE_NULL_VALUES)`;
const permissionRows=()=>Object.entries(CLEAN_PERSONNEL_WORK_ROLES).flatMap(([id,r])=>[...new Set([...r.view,...r.create,...r.approve])].sort().map(k=>({id:Number(id),key:k,view:r.view.includes(k)?1:0,create:r.create.includes(k)?1:0,approve:r.approve.includes(k)?1:0})));

// Explicit source variant of the SAME work layer, not an upgrade over an
// installed immutable work/username seal. Defaults and old hashes stay exact.
// Current installations must remain closed until a reviewed in-place upgrade
// exists; the compiler deliberately refuses to overwrite that layer.
const packingColumnProof=`
 IF NOT EXISTS(SELECT 1 FROM sys.columns c JOIN sys.default_constraints d ON d.parent_object_id=c.object_id AND d.parent_column_id=c.column_id WHERE c.object_id=OBJECT_ID(N'dbo.employees') AND c.name=N'can_terminal_packing' AND c.system_type_id=104 AND c.is_nullable=0 AND c.is_computed=0 AND c.is_identity=0 AND REPLACE(REPLACE(REPLACE(d.definition,N'(',N''),N')',N''),N' ',N'')=N'0') ${deny}`;
function withPersonalPackingField(name,source){
 if(name==='usp_clean_personnel_bind'){
  let b=exact(source,"N'canTerminalSale',N'canChangeSalePrice'","N'canTerminalSale',N'canTerminalPacking',N'canChangeSalePrice'");
  b=exact(b,'(SELECT COUNT(*) FROM OPENJSON(@payload_json))<>10',"(SELECT COUNT(*) FROM OPENJSON(@payload_json))<>(10+CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key]=N'canTerminalPacking') THEN 1 ELSE 0 END)");
  const boundary="IF ISNULL(JSON_VALUE(@payload_json,'$.canChangeSalePrice')";
  return exact(b,boundary,`IF EXISTS(SELECT 1 FROM OPENJSON(@payload_json) WHERE [key]=N'canTerminalPacking' AND type<>3) ${deny}
  IF JSON_VALUE(@payload_json,'$.canTerminalPacking')=N'true' AND NOT EXISTS(SELECT 1 FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id WHERE u.id=@user AND u.is_active=1 AND r.is_active=1 AND ${roleMatch('r.id','r.code',[30,31])}) ${deny}
  ${boundary}`);
 }
 let b=exact(source,"N'can_terminal_sale',N'can_change_sale_price'","N'can_terminal_sale',N'can_terminal_packing',N'can_change_sale_price'");
 b=exact(b,"WHEN N'canTerminalSale' THEN N'can_terminal_sale'","WHEN N'canTerminalSale' THEN N'can_terminal_sale' WHEN N'canTerminalPacking' THEN N'can_terminal_packing'");
 const boundary="IF EXISTS(SELECT 1 FROM OPENJSON(@payload) p LEFT JOIN OPENJSON(JSON_QUERY(@inserted,'$[0]')) i ON i.[key]=CASE p.[key] WHEN N'employeeCode'";
 return exact(b,boundary,`IF JSON_VALUE(@payload,'$.canTerminalPacking') IS NULL AND(@op=N'employee_create' AND ISNULL(JSON_VALUE(@inserted,'$[0].can_terminal_packing'),N'')<>N'false' OR @op=N'employee_update' AND ISNULL(JSON_VALUE(@inserted,'$[0].can_terminal_packing'),N'')<>ISNULL(JSON_VALUE(@deleted,'$[0].can_terminal_packing'),N'')) ${deny}
  ${boundary}`);
}

export function buildCleanPersonnelWorkDefinitions({packingTask=false}={}){
 if(typeof packingTask!=='boolean')throw Error('Invalid personal packing selector');
 const prior=allPrior(),definitions={},before={};
 const set=(name,body)=>{if(body===prior[name])throw Error('B5 work unchanged '+name);before[name]=prior[name];definitions[name]=body;};
 // B6 remains limited to one's own synthetic customer 1 / products 1,2 sale.
 let b=prior.usp_clean_direct_sale_bind;
 b=exact(b,"u.id=10018 AND u.username=N'semih' AND r.id=28 AND r.code=N'clean_test_administrator'",`((u.id=10018 AND u.username=N'semih' AND r.id=28 AND r.code=N'clean_test_administrator') OR ${personal('u.id','sale')})`);
 set('usp_clean_direct_sale_bind',b);

 // Inbound staff can create/submit only their own counts. Management review
 // retains its existing approval permissions and original receipt provenance.
 b=prior.usp_clean_store_day_bind;
 b=exact(b,'OR(@admin=1)) AND r.is_active=1',`OR(@admin=1)OR(@operation LIKE N'count[_]%' AND ${personal('u.id','staff')})OR(@operation NOT LIKE N'count[_]%' AND ${personal('u.id','manager')})) AND r.is_active=1`);
 b=exact(b,'(@actor_id<>18 AND @admin<>1)',`(@actor_id<>18 AND @admin<>1 AND NOT ${personal('@actor_id','staff')})`);
 b=exact(b,'(@actor_id<>19 AND @admin<>1)',`(@actor_id<>19 AND @admin<>1 AND NOT ${personal('@actor_id','manager')})`,3);
 b=exact(b,'AND(created_by=18 OR @admin=1 AND created_by=10018);',`AND(created_by=18 OR @admin=1 AND created_by=10018 OR (@admin=1 OR ${personal('@actor_id','manager')}) AND EXISTS(SELECT 1 FROM dbo.clean_personnel_members pm WHERE pm.user_id=dbo.test_goods_batches.created_by));`);
 set('usp_clean_store_day_bind',b);
 b=prior.usp_clean_store_day_guard;
 b=exact(b,'@actor NOT IN(18,10018)',`(@actor NOT IN(18,10018) AND NOT ${personal('@actor','staff')})`);
 set('usp_clean_store_day_guard',b);

 // Legacy TRY collection/payment engine: actual actor rather than fixture id.
 b=prior.usp_clean_store_finance_bind;
 b=exact(b,'(ISNULL(@actor_id,-1)<>20 AND NOT ',`(ISNULL(@actor_id,-1)<>20 AND NOT ${personal('@actor_id','finance')} AND NOT `);
 b=exact(b,"r.code=N'clean_test_finance') OR ",`r.code=N'clean_test_finance') OR ${personal('u.id','finance')} OR `);
 set('usp_clean_store_finance_bind',b);
 for(const n of ['usp_clean_store_finance_guard','usp_clean_store_finance_finish'])set(n,exact(prior[n],'@actor NOT IN(20,10018)',`(@actor NOT IN(20,10018) AND NOT ${personal('@actor','finance')})`));

 // Stock-count staff drafts, application-manager approvals. Existing source
 // receipt/product/date/cost/delta/return limits remain unchanged.
 b=prior.usp_clean_store_inventory_bind;
 b=exact(b,'SET @role=CASE WHEN @admin=1 THEN 28 WHEN @draft=1 THEN 26 ELSE 27 END;',`DECLARE @personal bit=CASE WHEN ${personal('@actor_id','staff')} THEN 1 ELSE 0 END;SET @role=CASE WHEN @personal=1 THEN(SELECT role_id FROM dbo.users WHERE id=@actor_id) WHEN @admin=1 THEN 28 WHEN @draft=1 THEN 26 ELSE 27 END;`);
 b=exact(b,'(ISNULL(@actor_id,-1)<>CASE WHEN @draft=1 THEN 21 ELSE 22 END AND @admin<>1)',`(ISNULL(@actor_id,-1)<>CASE WHEN @draft=1 THEN 21 ELSE 22 END AND @admin<>1 AND NOT(@personal=1 AND (@draft=1 AND @count=1 OR ${personal('@actor_id','manager')})))`);
 b=exact(b,'AND(created_by=21 OR @admin=1 AND created_by=10018);',`AND(created_by=21 OR @admin=1 AND created_by=10018 OR (@admin=1 OR ${personal('@actor_id','manager')}) AND EXISTS(SELECT 1 FROM dbo.clean_personnel_members pm WHERE pm.user_id=dbo.test_daily_drafts.created_by));`);
 set('usp_clean_store_inventory_bind',b);
 for(const n of ['usp_clean_store_inventory_guard','usp_clean_store_inventory_finish']){
  b=exact(prior[n],'@actor NOT IN(21,22,10018)',`(@actor NOT IN(21,22,10018) AND NOT ${personal('@actor','staff')})`);
  if(b.includes('@actor NOT IN(22,10018)'))b=b.replaceAll('@actor NOT IN(22,10018)',`(@actor NOT IN(22,10018) AND NOT ${personal('@actor','manager')})`);
  set(n,b);
 }

 // B4 TRY/USD/EUR use the same native finite case and cancellation journal.
 for(const n of ['usp_clean_finance_b4_bind','usp_clean_finance_b4_fx_usd_bind','usp_clean_finance_b4_fx_eur_bind']){
  b=prior[n];
  const start='AND((@operation IN(',end=' AND p.permission_key=@permission AND p.can_create=1)';
  const pos=b.indexOf(start),last=b.indexOf(end,pos);if(pos<0||last<0)throw Error('B4 actor proof missing '+n);
  b=b.slice(0,pos)+`AND((${b.slice(pos+3,last)}) OR ${personal('u.id','finance')})`+b.slice(last);
  b=exact(b,'m.created_by IN(20,10018)',`((m.created_by IN(20,10018) AND NOT ${personal('@actor_id','finance')}) OR m.created_by=@actor_id OR ${personal('@actor_id','manager')} AND EXISTS(SELECT 1 FROM dbo.clean_personnel_members pm WHERE pm.user_id=m.created_by))`,2);
  set(n,b);
 }
 for(const n of ['usp_clean_finance_b4_guard','usp_clean_finance_b4_fx_usd_guard','usp_clean_finance_b4_fx_eur_guard'])set(n,exact(prior[n],'@actor NOT IN(20,23,10018)',`(@actor NOT IN(20,23,10018) AND NOT ${personal('@actor','finance')})`));
 b=prior.usp_clean_finance_b4_cash_bind;
 b=exact(b,"r.code=N'clean_test_administrator')) AND(p.permission_key",`r.code=N'clean_test_administrator') OR ${personal('u.id','finance')}) AND(p.permission_key`);
 set('usp_clean_finance_b4_cash_bind',b);
 set('usp_clean_finance_b4_cash_guard',exact(prior.usp_clean_finance_b4_cash_guard,'@actor NOT IN(20,10018)',`(@actor NOT IN(20,10018) AND NOT ${personal('@actor','finance')})`));

 // Normal management can select the new finite jobs; managers remain limited
 // to newly enrolled records, just as Semih. No legacy identity is adopted.
 const oldRoles='('+Object.entries(CLEAN_PERSONNEL_ROLES).map(([n,c])=>`(r.id=${n} AND r.code=${Q(c)})`).join(' OR ')+')';
 for(const n of ['usp_clean_personnel_bind','usp_clean_personnel_guard']){
  b=prior[n];if(!b.includes(oldRoles))throw Error('B5 role seam missing');
  b=b.replaceAll(oldRoles,`(${oldRoles} OR ${roleMatch('r.id','r.code',groups.all)})`);
  if(n.endsWith('_bind')){
   b=exact(b,'OR @actor_id<>10018 OR',`OR(@actor_id<>10018 AND NOT ${personal('@actor_id','manager')}) OR`);
   b=exact(b,"u.id=@actor_id AND u.username=N'semih' AND u.is_active=1 AND r.id=28 AND r.code=N'clean_test_administrator' AND r.is_active=1",`u.id=@actor_id AND u.is_active=1 AND r.is_active=1 AND((u.username=N'semih' AND r.id=28 AND r.code=N'clean_test_administrator')OR ${personal('u.id','manager')})`);
  }
  if(packingTask)b=withPersonalPackingField(n,b);
  set(n,b);
 }
 definitions.usp_clean_personnel_work_actor=`CREATE PROCEDURE dbo.usp_clean_personnel_work_actor @actor_id bigint WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_LOGIN}' OR @@TRANCOUNT<>1 OR NOT ${personal('@actor_id')} ${deny}
 EXEC dbo.usp_clean_personnel_work_ready;
 SELECT CONVERT(bit,1) accepted,CONVERT(varchar(36),e.environment_id) environmentId,u.id actorId,u.username,r.id roleId,r.code roleCode,p.id employeeId,p.can_terminal_sale canTerminalSale${packingTask?',p.can_terminal_packing canTerminalPacking':''}
 FROM dbo.clean_personnel_members m JOIN dbo.employees p ON p.id=m.employee_id AND p.user_id=m.user_id JOIN dbo.users u ON u.id=m.user_id JOIN dbo.roles r ON r.id=u.role_id CROSS JOIN dbo.clean_test_environment e WHERE m.user_id=@actor_id AND e.id=1;END;`;

 // Preserve the predecessor byte records. All old ready functions see the
 // immediately preceding hash only after this patch's own hashes are proved.
 const changedNames=[...new Set([...Object.keys(definitions),...Object.keys(prior).filter(n=>n.endsWith('_ready'))])];
 const projected=`SELECT ${changedNames.filter(n=>prior[n]).map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.${seal} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
 for(const n of Object.keys(prior).filter(n=>n.endsWith('_ready'))){
  b=prior[n];
  // Two-argument ISNULL preserves the hash fallback without adding a CASE
  // level to the predecessor chain (SQL Server limits CASE nesting to ten).
  b=b.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`ISNULL(JSON_VALUE(@workPredecessors,N'$.'+${a}.name),${hash})`);
  b=b.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,(hash)=>`ISNULL(JSON_VALUE(@workPredecessors,N'$.personnelPlaceholder'),${hash})`);
  // The only raw module-definition scan is management's d.name / m.definition.
  b=b.replaceAll("N'$.personnelPlaceholder'","N'$.'+d.name");
  if(n==='usp_clean_store_day_ready'||n==='usp_clean_finance_b5_admin_ready')b=b.replaceAll('SELECT after_constraints_hash FROM dbo.clean_finance_b5_admin_manifest','SELECT after_constraints_hash FROM dbo.'+seal);
  b=b.replaceAll('actor_id IN(20,23,10018) AND operation IN',`(actor_id IN(20,23,10018) OR ${personal('actor_id','finance')}) AND operation IN`);
  b=exact(b,'SET NOCOUNT ON;',`SET NOCOUNT ON;EXEC dbo.usp_clean_personnel_work_ready;DECLARE @workPredecessors nvarchar(max)=(${projected});`);
  set(n,b);
 }
 const roleChecks=Object.entries(CLEAN_PERSONNEL_WORK_ROLES).map(([id,r])=>`IF NOT EXISTS(SELECT 1 FROM dbo.roles WHERE id=${id} AND code=${Q(r.code)} AND is_active=1) OR(SELECT COUNT(*) FROM dbo.permissions WHERE role_id=${id})<>${new Set([...r.view,...r.create,...r.approve]).size} ${deny}`).join('\n');
 definitions.usp_clean_personnel_work_ready=`CREATE PROCEDURE dbo.usp_clean_personnel_work_ready WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.${seal})<>WORK_TOTAL OR EXISTS(SELECT 1 FROM dbo.${seal} d LEFT JOIN sys.sql_modules m ON m.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE m.object_id IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR(OBJECTPROPERTY(m.object_id,'IsTrigger')=1 AND OBJECTPROPERTY(m.object_id,'ExecIsTriggerDisabled')<>0)) ${deny}
 IF ISNULL((SELECT after_constraints_hash FROM dbo.${seal} WHERE name=N'usp_clean_store_day_ready'),N'')<>CONVERT(char(64),HASHBYTES('SHA2_256',${checks}),2) OR ISNULL((SELECT inbound_constraints_hash FROM dbo.${seal} WHERE name=N'usp_clean_store_day_ready'),N'')<>CONVERT(char(64),HASHBYTES('SHA2_256',${inboundChecks}),2) ${deny}
 ${roleChecks}${packingTask?packingColumnProof:''}
 ${permissionRows().map(p=>`IF NOT EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=${p.id} AND permission_key=${Q(p.key)} AND can_view=${p.view} AND can_create=${p.create} AND can_approve=${p.approve} AND can_update=0 AND can_delete=0) ${deny}`).join('\n')} END;`;
 definitions.clean_personnel_work_manifest_immutable=`CREATE TRIGGER dbo.clean_personnel_work_manifest_immutable ON dbo.${seal} AFTER INSERT,UPDATE,DELETE AS BEGIN ${deny} END;`;
 definitions.usp_clean_personnel_work_ready=definitions.usp_clean_personnel_work_ready.replace('WORK_TOTAL',Object.keys(definitions).length);
 return {before,definitions};
}

export function buildCleanPersonnelWorkSql({probe=false,inboundOwnerLinks=false,packingTask=false}={}){
 if(typeof inboundOwnerLinks!=='boolean')throw Error('Invalid inbound owner repair selector');
 if(typeof packingTask!=='boolean'||inboundOwnerLinks&&packingTask)throw Error('Incompatible personal packing selector');
 if(inboundOwnerLinks)return buildCleanInboundOwnerLinksSql({probe});
 const {before,definitions}=buildCleanPersonnelWorkDefinitions({packingTask});
 const operations=['collection_create','collection_cancel','payment','payment_cancel','cash_open','cash_close','cash_transfer','cash_expense','stock_count_draft','stock_count_approve','stock_count_reject','stock_count_cancel','purchase_return_draft','purchase_return_approve','purchase_return_reject','purchase_return_cancel'];
 return `SET NOCOUNT ON;SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 ${deny}
 IF OBJECT_ID(N'dbo.${seal}') IS NOT NULL BEGIN ${packingTask?`IF COL_LENGTH(N'dbo.employees',N'can_terminal_packing') IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.${seal} WHERE name=N'usp_clean_personnel_work_actor' AND after_hash=${Q(moduleHash(definitions.usp_clean_personnel_work_actor))}) THROW 51975,'PACKING_FRESH_WORK_LAYER_REQUIRED',1;`:''}EXEC dbo.usp_clean_personnel_work_ready;${Object.entries(definitions).map(([n,b])=>`IF NOT EXISTS(SELECT 1 FROM dbo.${seal} WHERE name=${Q(n)} AND after_hash=${Q(moduleHash(b))}) ${deny}`).join('\n')} SELECT N'B5_PERSONAL_WORK_ALREADY_INSTALLED' result;RETURN;END;
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${deny}
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_ready;
 ${Object.entries(before).map(([n,b])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))),2),N'')<>${Q(moduleHash(b))} THROW 51975,${Q('B5_WORK_PREDECESSOR_'+n)},1;`).join('\n')}
 IF EXISTS(SELECT 1 FROM dbo.roles WHERE id IN(30,31,32) OR code IN(${Object.values(CLEAN_PERSONNEL_WORK_ROLES).map(r=>Q(r.code)).join(',')})) OR EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id IN(30,31,32)) ${deny}${packingTask?`
 IF COL_LENGTH(N'dbo.employees',N'can_terminal_packing') IS NOT NULL THROW 51975,'CLEAN_PACKING_SCHEMA_CONFLICT',1;
 ALTER TABLE dbo.employees ADD can_terminal_packing bit NOT NULL CONSTRAINT DF_clean_employee_packing DEFAULT(0) WITH VALUES;`:''}
 DECLARE @beforeChecks nvarchar(max)=${checks},@beforeInbound nvarchar(max)=${inboundChecks},@constraint nvarchar(max)=(SELECT definition FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.work_trade_requests') AND name=N'CK_clean_inventory_requests' AND is_disabled=0 AND is_not_trusted=0),@inbound sysname=(SELECT name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.work_inbound_requests') AND definition=N'([actor_id]=(19) OR [actor_id]=(18))' AND is_disabled=0 AND is_not_trusted=0);
 IF @constraint IS NULL OR @inbound IS NULL ${deny}
 CREATE TABLE dbo.${seal}(name sysname PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,before_definition nvarchar(max) NULL,before_constraints_json nvarchar(max) NULL,after_constraints_hash char(64) NULL,before_inbound_constraints_json nvarchar(max) NULL,inbound_constraints_hash char(64) NULL);
 SET IDENTITY_INSERT dbo.roles ON;
 ${Object.entries(CLEAN_PERSONNEL_WORK_ROLES).map(([id,r])=>`INSERT dbo.roles(id,code,name,description,is_active)VALUES(${id},${Q(r.code)},${Q(r.name)},N'Kayıtlı kişisel personel; yalnız mevcut temiz TEST iş kapsamı',1);`).join('\n')}
 SET IDENTITY_INSERT dbo.roles OFF;
 ${permissionRows().map(p=>`INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve)VALUES(${p.id},${Q(p.key)},${p.view},${p.create},0,0,${p.approve});`).join('\n')}
 ALTER TABLE dbo.work_trade_requests DROP CONSTRAINT CK_clean_inventory_requests;
 EXEC(N'ALTER TABLE dbo.work_trade_requests WITH CHECK ADD CONSTRAINT CK_clean_inventory_requests CHECK(('+@constraint+N')OR(actor_id>0 AND actor_id NOT IN(15,16,17,18,19,20,21,22,23,10018) AND operation IN(${operations.map(Q).join(',').replaceAll("'","''")})))');
 DECLARE @drop nvarchar(max)=N'ALTER TABLE dbo.work_inbound_requests DROP CONSTRAINT '+QUOTENAME(@inbound);EXEC(@drop);
 ALTER TABLE dbo.work_inbound_requests WITH CHECK ADD CONSTRAINT CK_clean_personnel_inbound_requests CHECK(actor_id IN(18,19,10018) OR(actor_id>0 AND actor_id NOT IN(15,16,17,20,21,22,23) AND operation IN(N'count_create',N'count_update',N'count_submit',N'count_cancel',N'goods_accept',N'goods_reject',N'purchase_draft',N'purchase_finalize')));
 ${Object.entries(definitions).sort(([a],[b])=>(a==='clean_personnel_work_manifest_immutable'?1:0)-(b==='clean_personnel_work_manifest_immutable'?1:0)).map(([n,b])=>`INSERT dbo.${seal}(name,before_hash,after_hash,before_definition,before_constraints_json,after_constraints_hash,before_inbound_constraints_json,inbound_constraints_hash)VALUES(${Q(n)},${before[n]?Q(moduleHash(before[n])):'NULL'},${Q(moduleHash(b))},${before[n]?Q(before[n]):'NULL'},${n==='usp_clean_store_day_ready'?'@beforeChecks':'NULL'},${n==='usp_clean_store_day_ready'?`CONVERT(char(64),HASHBYTES('SHA2_256',${checks}),2)`:'NULL'},${n==='usp_clean_store_day_ready'?'@beforeInbound':'NULL'},${n==='usp_clean_store_day_ready'?`CONVERT(char(64),HASHBYTES('SHA2_256',${inboundChecks}),2)`:'NULL'});EXEC(${Q(b.replace(/^CREATE PROCEDURE/,before[n]?'ALTER PROCEDURE':'CREATE PROCEDURE').replace(/^CREATE TRIGGER/,before[n]?'ALTER TRIGGER':'CREATE TRIGGER'))});`).join('\n')}
 DENY INSERT,UPDATE,DELETE ON dbo.${seal} TO [${CLEAN_LOGIN}];
 GRANT EXECUTE ON dbo.usp_clean_personnel_work_ready TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_personnel_work_actor TO [${CLEAN_LOGIN}];
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_ready;EXEC dbo.usp_clean_personnel_work_ready;
 ${probe?"ROLLBACK;SELECT N'B5_PERSONAL_WORK_METADATA_PROBE_ROLLED_BACK' result;":"COMMIT;SELECT N'B5_PERSONAL_WORK_METADATA_INSTALLED' result;"}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}

// SQL Server rewrites COALESCE(subquery,fallback) into CASE and can evaluate
// the subquery twice. Historical hash projections nest this thousands of times.
// This finite repair changes only those string-hash expressions. The MAX cast
// is essential: ISNULL otherwise adopts the first CHAR(64) width and could hide
// an invalid overlength fallback. No result is cached and every guard still runs.
export function rewriteCleanReadyHashFallbacks(source){
 let replacements=0;
 const quotedEnd=(sql,start)=>{
  const quote=sql[start],end=quote==='['?']':quote;
  for(let i=start+1;i<sql.length;i++)if(sql[i]===end){if(sql[i+1]===end){i++;continue;}return i+1;}
  throw Error('Unbalanced SQL quote');
 };
 const skip=(sql,i)=>{
  if(sql[i]==="'"||sql[i]==='['||sql[i]==='"')return quotedEnd(sql,i);
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i+2);return end<0?sql.length:end;}
  if(sql.startsWith('/*',i)){const end=sql.indexOf('*/',i+2);if(end<0)throw Error('Unbalanced SQL comment');return end+2;}
  return i;
 };
 const rewrite=sql=>{
  let out='';
  for(let i=0;i<sql.length;){
   const skipped=skip(sql,i);if(skipped!==i){out+=sql.slice(i,skipped);i=skipped;continue;}
   if(sql.slice(i,i+9).toUpperCase()!=='COALESCE('||i>0&&/[\w@]/.test(sql[i-1])){out+=sql[i++];continue;}
   let depth=1,j=i+9,arg=j;const parts=[];
   for(;j<sql.length;j++){
    const end=skip(sql,j);if(end!==j){j=end-1;continue;}
    if(sql[j]==='(')depth++;
    else if(sql[j]===')'){if(--depth===0){parts.push(sql.slice(arg,j));break;}}
    else if(sql[j]===','&&depth===1){parts.push(sql.slice(arg,j));arg=j+1;}
   }
   if(depth!==0)throw Error('Unbalanced SQL expression');
   const hashFirst=/^[\s(]*SELECT\s+\w+\.(?:before_hash|after_hash)\b/i.test(parts[0])||/^\s*JSON_VALUE\(@\w+Predecessors\b/i.test(parts[0]);
   if(parts.length===2&&hashFirst){replacements++;out+='ISNULL(CONVERT(nvarchar(max),'+rewrite(parts[0])+'),'+rewrite(parts[1])+')';}
   else out+='COALESCE('+parts.map(rewrite).join(',')+')';
   i=j+1;
  }
  return out;
 };
 const body=rewrite(source);return {body,replacements};
}

// Existing immutable before/after repair pattern; old seals and all write
// binders, account rows, permissions, constraints and transaction rules survive.
export function buildCleanReadyExpressionRepairDefinitions(){
 const prior=buildCleanPersonnelWorkDefinitions().definitions;
 const before=Object.fromEntries(Object.entries(prior).filter(([name])=>name.endsWith('_ready')));
 const names=Object.keys(before),definitions={},counts={};
 const manifest='clean_ready_expression_manifest',immutable='clean_ready_expression_immutable';
 const guard='usp_clean_ready_expression_ready',bad="THROW 51976,'CLEAN_READY_EXPRESSION_DENIED',1;";
 definitions[immutable]=`CREATE TRIGGER dbo.${immutable} ON dbo.${manifest} AFTER INSERT,UPDATE,DELETE AS BEGIN ${bad} END;`;
 definitions[guard]=`CREATE PROCEDURE dbo.${guard} WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.${manifest})<>${names.length+2} OR EXISTS(SELECT 1 FROM dbo.${manifest} d LEFT JOIN sys.sql_modules m ON m.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE m.object_id IS NULL OR m.definition IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR(OBJECTPROPERTY(m.object_id,'IsTrigger')=1 AND OBJECTPROPERTY(m.object_id,'ExecIsTriggerDisabled')<>0)) ${bad} END;`;
 const pinned=`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${guard}'))),2),N'')<>${Q(moduleHash(definitions[guard]))} OR ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${immutable}'))),2),N'')<>${Q(moduleHash(definitions[immutable]))} OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'dbo.${immutable}'),'ExecIsTriggerDisabled'),1)<>0 ${bad}`;
 const projected=`SELECT ${names.map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.${manifest} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
 for(const [name,original]of Object.entries(before)){
  const optimized=rewriteCleanReadyHashFallbacks(original);counts[name]=optimized.replacements;
  // Prove new bytes before exposing immediately preceding hashes to any old
  // layer. Missing entries still use the real current definition hash.
  let body=optimized.body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`ISNULL(JSON_VALUE(@readyExpressionPredecessors,N'$.'+${a}.name),${hash})`);
  body=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,(hash)=>`ISNULL(JSON_VALUE(@readyExpressionPredecessors,N'$.'+d.name),${hash})`);
  if(body===optimized.body)throw Error('Ready expression predecessor seam missing: '+name);
  definitions[name]=exact(body,'SET NOCOUNT ON;',`SET NOCOUNT ON;${pinned}EXEC dbo.${guard};DECLARE @readyExpressionPredecessors nvarchar(max)=(${projected});`);
 }
 return {before,definitions,counts,manifest,guard};
}

export function buildCleanReadyExpressionRepairSql({probe=false,username=false,packingUpgrade=false}={}){
 if(typeof packingUpgrade!=='boolean'||packingUpgrade&&username)throw Error('Invalid installed packing repair selector');
 if(packingUpgrade)return buildCleanPersonnelPackingUpgradeSql({probe});
 const {before,definitions,manifest,guard}=username?buildCleanPersonnelUsernameRepairDefinitions():buildCleanReadyExpressionRepairDefinitions();
 const resultPrefix=username?'PERSONNEL_USERNAME':'READY_EXPRESSION';
 const bad="THROW 51976,'CLEAN_READY_EXPRESSION_DENIED',1;";
 const proof=Object.entries(definitions).map(([name,body])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))),2),N'')<>${Q(moduleHash(body))} ${bad}`).join('\n');
 return `SET NOCOUNT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR @@TRANCOUNT<>0 ${bad}
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${bad}
 IF OBJECT_ID(N'dbo.${manifest}') IS NOT NULL BEGIN ${proof} EXEC dbo.${guard};${username?'EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;':''}COMMIT;SELECT N'${resultPrefix}_ALREADY_INSTALLED' result;RETURN;END;
 EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;
 ${Object.entries(before).map(([name,body])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))),2),N'')<>${Q(moduleHash(body))} ${bad}`).join('\n')}
 IF EXISTS(SELECT 1 FROM dbo.clean_store_day_intents) OR EXISTS(SELECT 1 FROM dbo.clean_personnel_intents) OR EXISTS(SELECT 1 FROM dbo.clean_direct_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_inventory_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_fx_intents) OR EXISTS(SELECT 1 FROM dbo.clean_finance_b4_cash_intents) OR EXISTS(SELECT 1 FROM dbo.clean_contact_intents) ${bad}
 CREATE TABLE dbo.${manifest}(name sysname PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,before_definition nvarchar(max) NULL,before_quoted_identifier bit NULL,before_ansi_nulls bit NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 ${Object.entries(definitions).map(([name,body])=>`INSERT dbo.${manifest}(name,before_hash,after_hash,before_definition,before_quoted_identifier,before_ansi_nulls)SELECT ${Q(name)},${before[name]?Q(moduleHash(before[name])):'NULL'},${Q(moduleHash(body))},${before[name]?`OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))`:'NULL'},${before[name]?`(SELECT uses_quoted_identifier FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'dbo.${name}'))`:'NULL'},${before[name]?`(SELECT uses_ansi_nulls FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'dbo.${name}'))`:'NULL'};`).join('\n')}
 ${Object.entries(definitions).map(([name,body])=>`EXEC(${Q(body.replace(/^CREATE PROCEDURE/,before[name]?'ALTER PROCEDURE':'CREATE PROCEDURE'))});`).join('\n')}
 DENY INSERT,UPDATE,DELETE ON dbo.${manifest} TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.${guard} TO [${CLEAN_LOGIN}];
 ${proof} EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;
 ${probe?`ROLLBACK;SELECT N'${resultPrefix}_PROBE_ROLLED_BACK' result;`:`COMMIT;SELECT N'${resultPrefix}_INSTALLED' result;`}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}

// Finite username-only repair above the already installed C1 readiness layer.
// C1 and all older immutable rows/definitions remain exact before images. The
// native user guard changes one LIKE literal; no actor, role or data rule moves.
export function buildCleanPersonnelUsernameRepairDefinitions(){
 const c1=buildCleanReadyExpressionRepairDefinitions().definitions;
 const prior={...buildCleanPersonnelWorkDefinitions().definitions,...c1};
 const readyNames=Object.keys(c1).filter(n=>n.endsWith('_ready'));
 const names=['usp_clean_personnel_guard',...readyNames];
 const before=Object.fromEntries(names.map(n=>[n,prior[n]])),definitions={};
 const manifest='clean_personnel_username_manifest',guard='usp_clean_personnel_username_ready',immutable='clean_personnel_username_immutable';
 const bad="THROW 51978,'CLEAN_PERSONNEL_USERNAME_NOT_READY',1;";
 definitions.usp_clean_personnel_guard=exact(before.usp_clean_personnel_guard,"N'%[^a-zA-Z0-9._-]%'","N'%[^-a-zA-Z0-9._]%'");
 definitions[immutable]=`CREATE TRIGGER dbo.${immutable} ON dbo.${manifest} AFTER INSERT,UPDATE,DELETE AS BEGIN ${bad} END;`;
 definitions[guard]=`CREATE PROCEDURE dbo.${guard} WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.${manifest})<>${names.length+2} OR EXISTS(SELECT 1 FROM dbo.${manifest} d LEFT JOIN sys.sql_modules m ON m.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE m.object_id IS NULL OR m.definition IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR(OBJECTPROPERTY(m.object_id,'IsTrigger')=1 AND OBJECTPROPERTY(m.object_id,'ExecIsTriggerDisabled')<>0)) ${bad} END;`;
 const pinned=`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${guard}'))),2),N'')<>${Q(moduleHash(definitions[guard]))} OR ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${immutable}'))),2),N'')<>${Q(moduleHash(definitions[immutable]))} OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'dbo.${immutable}'),'ExecIsTriggerDisabled'),1)<>0 ${bad}`;
 const projected=`SELECT ${names.map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.${manifest} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
 for(const name of readyNames){
  let body=before[name];
  body=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`ISNULL(JSON_VALUE(@usernamePredecessors,N'$.'+${a}.name),${hash})`);
  body=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,(hash)=>`ISNULL(JSON_VALUE(@usernamePredecessors,N'$.'+d.name),${hash})`);
  // C1's ten ready bodies pin its guard literally, not through d.name. Only
  // after the new complete proof may this pin see C1's exact old guard hash.
  if(name!=='usp_clean_ready_expression_ready'){
   const hash="CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_clean_ready_expression_ready'))),2)";
   body=exact(body,hash,`ISNULL(JSON_VALUE(@usernamePredecessors,N'$.usp_clean_ready_expression_ready'),${hash})`);
  }
  if(body===before[name])throw Error('Username repair predecessor seam missing: '+name);
  definitions[name]=exact(body,'SET NOCOUNT ON;',`SET NOCOUNT ON;${pinned}EXEC dbo.${guard};DECLARE @usernamePredecessors nvarchar(max)=(${projected});`);
 }
 return {before,definitions,manifest,guard};
}

// One finite field upgrade over the installed C1/username/owner-FK baseline.
// No accepted generator or older immutable row is rewritten. The same proof-
// before-predecessor projection used above preserves those historical seals.
const packingUpgradeBad="THROW 51980,'CLEAN_PERSONNEL_PACKING_NOT_READY',1;";
function packingModuleProof(name,body){
 const trigger=body.startsWith('CREATE TRIGGER '),type=trigger?'TR':'P';
 if(!trigger&&!body.startsWith('CREATE PROCEDURE '))throw Error('Unsupported packing predecessor module');
 const owner=body.slice(0,body.indexOf('BEGIN')).includes('WITH EXECUTE AS OWNER');
 const parent=trigger?/^CREATE TRIGGER dbo\.[a-zA-Z0-9_]+ ON dbo\.([a-zA-Z0-9_]+)/.exec(body)?.[1]:null;
 if(trigger&&!parent)throw Error('Unbound packing predecessor trigger');
 return `IF NOT EXISTS(SELECT 1 FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.object_id=OBJECT_ID(${Q('dbo.'+name)},N'${type}') AND o.schema_id=SCHEMA_ID(N'dbo') AND m.definition IS NOT NULL AND CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2)=${Q(moduleHash(body))} AND m.uses_ansi_nulls=1 AND m.uses_quoted_identifier=1 AND ${owner?'ISNULL(m.execute_as_principal_id,-999)=-2':'m.execute_as_principal_id IS NULL'}${trigger?` AND EXISTS(SELECT 1 FROM sys.triggers t WHERE t.object_id=o.object_id AND t.parent_class=1 AND t.parent_id=OBJECT_ID(${Q('dbo.'+parent)},N'U') AND t.is_disabled=0 AND t.is_instead_of_trigger=0)`:''}) ${packingUpgradeBad}`;
}
function packingOwnerProof(){
 return ['work_inbound_counts','test_goods_batches'].map(table=>`IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys f JOIN sys.foreign_key_columns k ON k.constraint_object_id=f.object_id WHERE f.name=${Q('FK_clean_personnel_'+table+'_creator')} AND f.parent_object_id=OBJECT_ID(${Q('dbo.'+table)},N'U') AND f.referenced_object_id=OBJECT_ID(N'dbo.users',N'U') AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0 AND f.update_referential_action=0 AND k.parent_column_id=COLUMNPROPERTY(f.parent_object_id,N'created_by',N'ColumnId') AND k.referenced_column_id=COLUMNPROPERTY(f.referenced_object_id,N'id',N'ColumnId') AND(SELECT COUNT(*) FROM sys.foreign_key_columns a WHERE a.constraint_object_id=f.object_id)=1) OR(SELECT COUNT(*) FROM sys.foreign_key_columns a WHERE a.parent_object_id=OBJECT_ID(${Q('dbo.'+table)}) AND a.parent_column_id=COLUMNPROPERTY(a.parent_object_id,N'created_by',N'ColumnId'))<>1 OR EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(${Q('dbo.'+table)}) AND definition=N'([created_by]=(18))') ${packingUpgradeBad}`).join('\n');
}
const packingOldEmployeeColumns='id,employee_code,full_name,phone,department,job_title,user_id,is_active,created_at,created_by,updated_at,updated_by,row_version,can_terminal_sale,can_change_sale_price,max_sale_discount_percent';
const packingEmployeeHash=`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${packingOldEmployeeColumns} FROM dbo.employees ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`;
const packingRoleHash=`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.roles ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`;
const packingPermissionHash=`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.permissions ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`;
const packingOldSealHash=`CONVERT(char(64),HASHBYTES('SHA2_256',CONCAT(${['clean_personnel_work_manifest','clean_ready_expression_manifest','clean_personnel_username_manifest'].map(t=>`(SELECT * FROM dbo.${t} ORDER BY name FOR JSON PATH,INCLUDE_NULL_VALUES)`).join(',')})),2)`;

export function buildCleanPersonnelPackingUpgradeDefinitions(){
 const username=buildCleanPersonnelUsernameRepairDefinitions().definitions;
 const prior={...buildCleanPersonnelWorkDefinitions().definitions,...buildCleanReadyExpressionRepairDefinitions().definitions,...username};
 const readyNames=Object.keys(username).filter(n=>n.endsWith('_ready'));
 const names=['usp_clean_personnel_bind','usp_clean_personnel_guard','usp_clean_personnel_work_actor',...readyNames];
 const before=Object.fromEntries(names.map(n=>[n,prior[n]])),definitions={};
 const manifest='clean_personnel_packing_manifest',guard='usp_clean_personnel_packing_ready',immutable='clean_personnel_packing_immutable';
 definitions.usp_clean_personnel_bind=withPersonalPackingField('usp_clean_personnel_bind',before.usp_clean_personnel_bind);
 definitions.usp_clean_personnel_guard=withPersonalPackingField('usp_clean_personnel_guard',before.usp_clean_personnel_guard);
 definitions.usp_clean_personnel_work_actor=exact(before.usp_clean_personnel_work_actor,'p.can_terminal_sale canTerminalSale','p.can_terminal_sale canTerminalSale,p.can_terminal_packing canTerminalPacking');
 definitions[immutable]=`CREATE TRIGGER dbo.${immutable} ON dbo.${manifest} AFTER INSERT,UPDATE,DELETE AS BEGIN ${packingUpgradeBad} END;`;
 const allNames=[...names,immutable,guard];
 definitions[guard]=`CREATE PROCEDURE dbo.${guard} WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL}
 IF(SELECT COUNT(*) FROM dbo.${manifest})<>${allNames.length} OR EXISTS(SELECT name FROM dbo.${manifest} GROUP BY name HAVING COUNT(*)<>1) OR EXISTS(SELECT 1 FROM dbo.${manifest} d LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(N'dbo.'+d.name) LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE d.name COLLATE Latin1_General_100_BIN2 NOT IN(${allNames.map(Q).join(',')}) OR m.object_id IS NULL OR m.definition IS NULL OR d.after_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',m.definition),2) OR m.uses_ansi_nulls<>1 OR m.uses_quoted_identifier<>1 OR ISNULL(m.execute_as_principal_id,-999)<>CASE WHEN d.name=${Q(immutable)} THEN -999 ELSE -2 END OR o.type<>CASE WHEN d.name=${Q(immutable)} THEN N'TR' ELSE N'P' END) ${packingUpgradeBad}
 IF NOT EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(N'dbo.${immutable}',N'TR') AND parent_class=1 AND parent_id=OBJECT_ID(N'dbo.${manifest}',N'U') AND is_disabled=0 AND is_instead_of_trigger=0) ${packingUpgradeBad}
 IF(SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.employees',N'U'))<>17 OR NOT EXISTS(SELECT 1 FROM sys.columns c JOIN sys.default_constraints d ON d.object_id=c.default_object_id AND d.parent_object_id=c.object_id AND d.parent_column_id=c.column_id WHERE c.object_id=OBJECT_ID(N'dbo.employees',N'U') AND c.name=N'can_terminal_packing' AND c.system_type_id=104 AND c.user_type_id=104 AND c.max_length=1 AND c.is_nullable=0 AND c.is_computed=0 AND c.is_identity=0 AND d.name=N'DF_clean_employee_packing' AND REPLACE(REPLACE(REPLACE(d.definition,N'(',N''),N')',N''),N' ',N'')=N'0') ${packingUpgradeBad}
 ${packingOwnerProof()}
 ${['clean_personnel_work_manifest_immutable','clean_ready_expression_immutable','clean_personnel_username_immutable'].map(n=>packingModuleProof(n,prior[n])).join('\n')} END;`;
 const pinned=packingModuleProof(guard,definitions[guard])+'\n'+packingModuleProof(immutable,definitions[immutable]);
 const projected=`SELECT ${names.map(n=>`MAX(CASE WHEN name=${Q(n)} THEN before_hash END) [${n}]`).join(',')} FROM dbo.${manifest} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER`;
 for(const name of readyNames){
  let body=before[name];
  body=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+(\w+)\.name\)\)\),2\)/g,(hash,a)=>`ISNULL(JSON_VALUE(@packingPredecessors,N'$.'+${a}.name),${hash})`);
  body=body.replace(/CONVERT\(char\(64\),HASHBYTES\('SHA2_256',(\w+)\.definition\),2\)/g,hash=>`ISNULL(JSON_VALUE(@packingPredecessors,N'$.'+d.name),${hash})`);
  for(const oldGuard of ['usp_clean_ready_expression_ready','usp_clean_personnel_username_ready']){
   const hash=`CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${oldGuard}'))),2)`;
   body=body.replaceAll(hash,`ISNULL(JSON_VALUE(@packingPredecessors,N'$.${oldGuard}'),${hash})`);
  }
  if(body===before[name])throw Error('Packing predecessor projection seam missing: '+name);
  definitions[name]=exact(body,'SET NOCOUNT ON;',`SET NOCOUNT ON;${pinned}EXEC dbo.${guard};DECLARE @packingPredecessors nvarchar(max)=(${projected});`);
 }
 return {prior,before,definitions,manifest,guard,immutable};
}
function buildCleanPersonnelPackingUpgradeSql({probe}){
 const {prior,before,definitions,manifest,guard,immutable}=buildCleanPersonnelPackingUpgradeDefinitions();
 const afterProof=Object.entries(definitions).map(([n,b])=>packingModuleProof(n,b)).join('\n');
 return `SET NOCOUNT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR @@TRANCOUNT<>0 ${packingUpgradeBad}
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${packingUpgradeBad}
 IF ${['clean_store_day_intents','clean_personnel_intents','clean_direct_sale_intents','clean_order_sale_intents','clean_store_inventory_intents','clean_finance_b4_intents','clean_finance_b4_fx_intents','clean_finance_b4_cash_intents','clean_contact_intents'].map(t=>`EXISTS(SELECT 1 FROM dbo.${t})`).join(' OR ')} ${packingUpgradeBad}
 IF OBJECT_ID(N'dbo.${manifest}') IS NOT NULL BEGIN IF OBJECT_ID(N'dbo.${manifest}',N'U') IS NULL ${packingUpgradeBad} ${afterProof} EXEC dbo.${guard};EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;${probe?'ROLLBACK':'COMMIT'};SELECT N'PERSONNEL_PACKING_UPGRADE_ALREADY_INSTALLED' result;RETURN;END;
 ${Object.entries(prior).map(([n,b])=>packingModuleProof(n,b)).join('\n')}
 ${packingOwnerProof()} EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;
 IF COL_LENGTH(N'dbo.employees',N'can_terminal_packing') IS NOT NULL OR(SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.employees',N'U'))<>16 OR OBJECT_ID(N'dbo.DF_clean_employee_packing') IS NOT NULL OR OBJECT_ID(N'dbo.${guard}') IS NOT NULL OR OBJECT_ID(N'dbo.${immutable}') IS NOT NULL ${packingUpgradeBad}
 DECLARE @packingEmployeesBefore char(64)=${packingEmployeeHash},@packingRolesBefore char(64)=${packingRoleHash},@packingPermissionsBefore char(64)=${packingPermissionHash},@packingOldSealsBefore char(64)=${packingOldSealHash};
 IF @packingEmployeesBefore IS NULL OR @packingRolesBefore IS NULL OR @packingPermissionsBefore IS NULL OR @packingOldSealsBefore IS NULL ${packingUpgradeBad}
 ALTER TABLE dbo.employees ADD can_terminal_packing bit NOT NULL CONSTRAINT DF_clean_employee_packing DEFAULT(0) WITH VALUES;
 CREATE TABLE dbo.${manifest}(name sysname PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,before_definition nvarchar(max) NULL,before_quoted_identifier bit NULL,before_ansi_nulls bit NULL,before_execute_as_principal_id int NULL,before_employee_hash char(64) NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 ${Object.entries(definitions).map(([n,b])=>`INSERT dbo.${manifest}(name,before_hash,after_hash,before_definition,before_quoted_identifier,before_ansi_nulls,before_execute_as_principal_id,before_employee_hash)SELECT ${Q(n)},${before[n]?Q(moduleHash(before[n])):'NULL'},${Q(moduleHash(b))},${before[n]?`OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))`:'NULL'},${before[n]?`(SELECT uses_quoted_identifier FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'dbo.${n}'))`:'NULL'},${before[n]?`(SELECT uses_ansi_nulls FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'dbo.${n}'))`:'NULL'},${before[n]?`(SELECT execute_as_principal_id FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'dbo.${n}'))`:'NULL'},${n===guard?'@packingEmployeesBefore':'NULL'};`).join('\n')}
 IF EXISTS(SELECT 1 FROM dbo.${manifest} WHERE before_hash IS NOT NULL AND(before_definition IS NULL OR before_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',before_definition),2) OR before_quoted_identifier<>1 OR before_ansi_nulls<>1 OR ISNULL(before_execute_as_principal_id,-999)<>-2)) ${packingUpgradeBad}
 ${Object.entries(definitions).map(([n,b])=>`EXEC(${Q(b.replace(/^CREATE PROCEDURE/,before[n]?'ALTER PROCEDURE':'CREATE PROCEDURE'))});`).join('\n')}
 DENY INSERT,UPDATE,DELETE ON dbo.${manifest} TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.${guard} TO [${CLEAN_LOGIN}];
 ${afterProof} EXEC dbo.${guard};EXEC dbo.usp_clean_store_day_ready;EXEC dbo.usp_clean_personnel_work_ready;
 IF ISNULL(@packingEmployeesBefore,N'')<>ISNULL(${packingEmployeeHash},N'') OR ISNULL(@packingRolesBefore,N'')<>ISNULL(${packingRoleHash},N'') OR ISNULL(@packingPermissionsBefore,N'')<>ISNULL(${packingPermissionHash},N'') OR ISNULL(@packingOldSealsBefore,N'')<>ISNULL(${packingOldSealHash},N'') OR EXISTS(SELECT 1 FROM dbo.employees WHERE can_terminal_packing<>0) ${packingUpgradeBad}
 ${probe?"ROLLBACK;SELECT N'PERSONNEL_PACKING_UPGRADE_PROBE_ROLLED_BACK' result;":"COMMIT;SELECT N'PERSONNEL_PACKING_UPGRADE_INSTALLED' result;"}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}

// The personal native actor/binder/trigger already proves membership, active
// employee/user/role and same-transaction ownership. A sample-only creator CHECK
// must not contradict that proof. Replace it with referential identity integrity;
// this is not an authorization grant and never substitutes the native proof.
function buildCleanInboundOwnerLinksSql({probe}){
 const tables=['work_inbound_counts','test_goods_batches'];
 const name=t=>'FK_clean_personnel_'+t+'_creator';
 const bad="THROW 51979,'CLEAN_INBOUND_OWNER_LINKS_CONFLICT',1;";
 const pin=Object.entries(buildCleanPersonnelUsernameRepairDefinitions().definitions).map(([n,b])=>`IF ISNULL(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}'))),2),N'')<>${Q(moduleHash(b))} ${bad}`).join('\n');
 const linked=t=>`EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.name=${Q(name(t))} AND f.parent_object_id=OBJECT_ID(N'dbo.${t}') AND f.referenced_object_id=OBJECT_ID(N'dbo.users') AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0 AND f.update_referential_action=0 AND(SELECT COUNT(*) FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id)=1 AND EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id AND c.parent_column_id=COLUMNPROPERTY(f.parent_object_id,N'created_by',N'ColumnId') AND c.referenced_column_id=COLUMNPROPERTY(f.referenced_object_id,N'id',N'ColumnId')))`;
 const old=t=>`SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.${t}') AND definition=N'([created_by]=(18))' AND is_disabled=0 AND is_not_trusted=0`;
 const parentIds=tables.map(t=>`OBJECT_ID(N'dbo.${t}')`).join(',');
 return `SET NOCOUNT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}
 IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR @@TRANCOUNT<>0 ${bad}
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;BEGIN TRY
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @lock<0 ${bad}
 ${pin} EXEC dbo.usp_clean_store_day_ready;
 IF EXISTS(SELECT 1 FROM dbo.clean_store_day_intents) OR EXISTS(SELECT 1 FROM dbo.clean_personnel_intents) OR EXISTS(SELECT 1 FROM dbo.clean_direct_sale_intents) OR EXISTS(SELECT 1 FROM dbo.clean_store_inventory_intents) OR EXISTS(SELECT 1 FROM dbo.clean_contact_intents) ${bad}
 IF ${tables.map(t=>linked(t)).join(' AND ')} AND NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id IN(${parentIds}) AND definition=N'([created_by]=(18))') BEGIN ${probe?'ROLLBACK':'COMMIT'};SELECT N'B5_INBOUND_OWNER_LINKS_ALREADY_INSTALLED' result;RETURN;END;
 IF ${tables.map(t=>`(${old(t)})<>1`).join(' OR ')} OR EXISTS(SELECT 1 FROM sys.objects WHERE name IN(${tables.map(t=>Q(name(t))).join(',')})) OR EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.parent_object_id IN(${parentIds}) AND c.parent_column_id=COLUMNPROPERTY(c.parent_object_id,N'created_by',N'ColumnId')) ${bad}
 DECLARE @beforeOwnerChecks nvarchar(max)=(SELECT OBJECT_NAME(parent_object_id) table_name,name,definition,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id IN(${parentIds}) ORDER BY parent_object_id,name FOR JSON PATH,INCLUDE_NULL_VALUES);
 ${tables.map((t,i)=>`DECLARE @old${i} sysname=(SELECT name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.${t}') AND definition=N'([created_by]=(18))' AND is_disabled=0 AND is_not_trusted=0);
 DECLARE @drop${i} nvarchar(max)=N'ALTER TABLE dbo.${t} DROP CONSTRAINT '+QUOTENAME(@old${i});EXEC(@drop${i});
 ALTER TABLE dbo.${t} WITH CHECK ADD CONSTRAINT ${name(t)} FOREIGN KEY(created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;`).join('\n')}
 IF ${tables.map(t=>'NOT '+linked(t)).join(' OR ')} ${bad}
 ${pin} EXEC dbo.usp_clean_store_day_ready;
 SELECT @beforeOwnerChecks before_owner_constraints_json;
 ${probe?"ROLLBACK;SELECT N'B5_INBOUND_OWNER_LINKS_PROBE_ROLLED_BACK' result;":"COMMIT;SELECT N'B5_INBOUND_OWNER_LINKS_INSTALLED' result;"}
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
