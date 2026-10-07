// Pure offline CAS compiler for an UNUSED Goal8 profile; no driver or I/O.
import {buildGoal8DayProfile,sqlHash} from './goal8-test-day-profile.mjs';
import {goal8DayRequestId} from './goal8-test-day.mjs';
const lit=s=>"N'"+s.replaceAll("'","''")+"'";
const fail="THROW 51283,'GOAL8_UNUSED_REPAIR_CONTRACT_REQUIRED',1;";
// These six exact metadata guards were used by the original reviewed installer.
// No native card, business ledger or FIRST quarantine guard is disabled.
export const GOAL8_REPAIR_MANIFEST_GUARDS=Object.freeze([
 ['work_night_guard_work_trade_guard_manifest','work_trade_guard_manifest','after_hash'],
 ['test_batch_guard_test_purchase_batch_guard_manifest','test_purchase_batch_guard_manifest','after_hash'],
 ['c03_immutable_test_purchase_fx_guard_manifest','test_purchase_fx_guard_manifest','definition_hash'],
 ['work_finops_manifest_guard','work_finops_manifest','definition_hash'],
 ['work_inbound_manifest_guard','work_inbound_manifest','definition_hash'],
 ['test_daily_count_lines_manifest_immutable','test_daily_count_lines_guard_manifest','after_hash']
]);
const ownGuards=[['goal8_immutable_goal8_day_scope','goal8_day_scope'],['goal8_immutable_goal8_day_manifest','goal8_day_manifest']];
const nativeTables=['products','product_prices','product_barcodes','suppliers','customers','finance_accounts','stock_movements','supplier_movements','customer_movements','finance_account_movements','purchase_invoices','purchase_invoice_items','sales_invoices','sales_invoice_items','invoice_returns','invoice_return_items','audit_logs','test_goods_batches','test_goods_batch_lines','test_daily_drafts','test_daily_requests','work_inbound_counts','work_inbound_requests','work_trade_requests','work_trade_intents','work_sales_links','work_collection_links','work_supplier_payment_requests','work_trade_scope','work_trade_products','work_trade_install_state','work_trade_legacy_manifest','work_finops_scope','work_finops_receipts','test_purchase_batch_scope','test_daily_scope','test_daily_accounts','permissions','roles','users'];
const sorts={test_daily_scope:'flow',test_daily_accounts:'flow,account_id',test_daily_requests:'request_id',work_inbound_requests:'request_id',work_trade_requests:'request_id',work_trade_intents:'session_id',work_sales_links:'invoice_id',work_collection_links:'movement_id',work_supplier_payment_requests:'request_id',work_trade_products:'product_id',test_purchase_batch_scope:'product_id',work_finops_scope:'currency'};
export function goal8RepairPlan(installed,repaired){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[A-F0-9]{64}$/;
 if(installed?.profileId!=='ERP-GOAL8-20261007'||repaired?.profileId!==installed.profileId||!uuid.test(installed.dayId??'')||repaired.dayId!==installed.dayId||!hash.test(installed.definitionHash??'')||!hash.test(repaired.definitionHash??'')||installed.definitionHash===repaired.definitionHash||installed.schema!==repaired.schema||installed.changed?.length!==22||repaired.changed?.length!==22||installed.owned?.length!==18||repaired.owned?.length!==18)throw Error('GOAL8_REPAIR_EXACT_SCOPE_REQUIRED');
 const pair=(old,next,key,body,pin,prefix)=>{
  const before=new Map(old.map(m=>[m.name,m]));if(before.size!==old.length||new Set(next.map(m=>m.name)).size!==next.length)throw Error('GOAL8_REPAIR_DUPLICATE_MODULE');
  for(const m of next){const b=before.get(m.name);if(!b||!new RegExp('^'+prefix+'[A-Za-z0-9_]+$').test(m.name)||!hash.test(m[pin]??'')||!hash.test(b[pin]??'')||sqlHash(m[body])!==m[pin]||sqlHash(b[body])!==b[pin]||! /^CREATE (PROCEDURE|TRIGGER|VIEW)\b/.test(m[body])||m[body].split(' ')[1]!==b[body].split(' ')[1]||(key&&m[key]!==b[key]))throw Error('GOAL8_REPAIR_CAS_PIN_MISMATCH');}
  return next.filter(m=>m[pin]!==before.get(m.name)[pin]);
 };
 return {changed:pair(installed.changed,repaired.changed,'beforeHash','after','afterHash',''),owned:pair(installed.owned,repaired.owned,null,'definition','hash','goal8_')};
}
export function buildGoal8DayRepair(exported,installed,repaired){
 const plan=goal8RepairPlan(installed,repaired);
 const expected=buildGoal8DayProfile(exported,{dayId:installed.dayId});
 if(JSON.stringify(expected)!==JSON.stringify(repaired))throw Error('GOAL8_REPAIR_CURRENT_COMPILER_REQUIRED');
 const original=new Map(exported.modules.filter(m=>m.schemaName==='dbo').map(m=>[m.name,m]));
 for(const m of installed.changed)if(original.get(m.name)?.definitionHash!==m.beforeHash)throw Error('GOAL8_REPAIR_ORIGINAL_PIN_MISMATCH');
 const guards=[...GOAL8_REPAIR_MANIFEST_GUARDS.map(([name,table])=>({name,table,hash:original.get(name)?.definitionHash})),...ownGuards.map(([name,table])=>({name,table,hash:installed.owned.find(o=>o.name===name)?.hash}))];
 if(guards.some(g=>! /^[A-F0-9]{64}$/.test(g.hash??'')||original.get(g.name)?.disabled))throw Error('GOAL8_REPAIR_METADATA_GUARD_REQUIRED');
 const columns=t=>exported.columns.filter(c=>c.schemaName==='dbo'&&c.tableName===t).map(c=>c.name);
 for(const t of nativeTables)if((sorts[t]??'id').split(',').some(c=>!columns(t).includes(c)))throw Error('GOAL8_REPAIR_NATIVE_COLUMN_CONTRACT_'+t);
 const fingerprint=(table,cols='*',sort=sorts[table]??'id')=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${cols} FROM dbo.${table} ORDER BY ${sort} FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`;
 const preserved=[...nativeTables.map(t=>({name:t,expr:fingerprint(t)})),{name:'goal8_day_quotes',expr:fingerprint('goal8_day_quotes','*','product_id')},{name:'goal8_day_scope_except_seal',expr:fingerprint('goal8_day_scope','id,run_id,day_id,sealed,customer_id,supplier_id,account_id,currency,document_date,max_total,max_quantity,max_operations')},...GOAL8_REPAIR_MANIFEST_GUARDS.map(([,t,col])=>({name:t+'_except_pin',expr:fingerprint(t,columns(t).filter(c=>c!==col).map(c=>'['+c+']').join(','),'name')}))];
 const permissions="CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,type FOR JSON PATH)),2)";
 const roleMembers="CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH)),2)";
 const principals="CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM sys.database_principals ORDER BY principal_id FOR JSON PATH)),2)";
 const triggers="CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.object_id,t.name,t.is_disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') first_d,OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger') last_i,OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger') last_u,OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger') last_d FROM sys.triggers t ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)";
 preserved.push({name:'database_permissions',expr:permissions},{name:'database_role_members',expr:roleMembers},{name:'database_principals',expr:principals},{name:'all_trigger_orders_and_enabled',expr:triggers});
 const target="IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' OR IS_SRVROLEMEMBER(N'sysadmin')<>1 THROW 51283,'GOAL8_REPAIR_EXACT_TEST_OWNER_REQUIRED',1;";
 const pins=(build)=>[...build.changed.map(m=>[m.name,m.afterHash]),...build.owned.map(m=>[m.name,m.hash])].map(([name,hash])=>`IF OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}')) IS NULL OR CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))),2)<>N'${hash}' OR(OBJECTPROPERTY(OBJECT_ID(N'dbo.${name}'),'IsTrigger')=1 AND OBJECTPROPERTY(OBJECT_ID(N'dbo.${name}'),'ExecIsTriggerDisabled')<>0) ${fail}`).join('\n');
 const tableNames=['goal8_day_scope','goal8_day_quotes','goal8_day_intents','goal8_day_history','goal8_day_manifest'];
 const names=[...installed.owned.map(o=>o.name),...tableNames].map(lit).join(',');
 const requestIds=['physical-count-draft','physical-count-approve','return-draft','return-approve'].map(step=>lit(goal8DayRequestId(installed.dayId,step))).join(',');
 const unused=`IF EXISTS(SELECT 1 FROM dbo.goal8_day_history) OR EXISTS(SELECT 1 FROM dbo.goal8_day_intents) OR EXISTS(SELECT 1 FROM dbo.goal8_day_sales_links) OR EXISTS(SELECT 1 FROM dbo.goal8_day_purchase_sources) ${fail}
IF EXISTS(SELECT 1 FROM dbo.work_trade_requests WHERE JSON_VALUE(payload_json,'$.testProfile')=N'ERP-GOAL8-20261007') OR EXISTS(SELECT 1 FROM dbo.work_trade_intents WHERE JSON_VALUE(payload_json,'$.testProfile')=N'ERP-GOAL8-20261007') OR EXISTS(SELECT 1 FROM dbo.work_supplier_payment_requests WHERE JSON_VALUE(payload_json,'$.testProfile')=N'ERP-GOAL8-20261007') OR EXISTS(SELECT 1 FROM dbo.work_inbound_counts WHERE note=N'GOAL8:${installed.dayId}') OR EXISTS(SELECT 1 FROM dbo.test_goods_batches WHERE note=N'GOAL8:${installed.dayId}') OR EXISTS(SELECT 1 FROM dbo.purchase_invoices WHERE document_no LIKE N'TSTB-G8-%') OR EXISTS(SELECT 1 FROM dbo.test_daily_requests WHERE request_id IN(${requestIds})) OR EXISTS(SELECT 1 FROM dbo.test_daily_drafts WHERE JSON_VALUE(payload_json,'$.date')=N'2026-10-07' AND (TRY_CONVERT(bigint,JSON_VALUE(payload_json,'$.productId'))=325503 OR EXISTS(SELECT 1 FROM OPENJSON(payload_json,'$.lines') WITH(productId bigint '$.productId') l WHERE l.productId=325503))) ${fail}`;
 const scope=seal=>`IF(SELECT COUNT(*) FROM dbo.goal8_day_scope)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.goal8_day_scope s JOIN dbo.work_trade_scope w ON w.id=1 AND w.account_id=s.account_id JOIN dbo.finance_accounts a ON a.id=s.account_id WHERE s.id=1 AND s.run_id=N'ERP-GOAL8-20261007' AND s.day_id=CONVERT(uniqueidentifier,N'${installed.dayId}') AND s.sealed=1 AND s.definition_hash=N'${seal}' AND s.customer_id=30598 AND s.supplier_id=13370 AND s.currency=N'TRY' AND s.document_date=CONVERT(date,N'2026-10-07') AND s.max_total=500 AND s.max_quantity=5 AND s.max_operations=30 AND a.account_code=N'TEST-NIGHT-20261006-K') ${fail}`;
 const ownManifest=build=>`IF(SELECT COUNT(*) FROM dbo.goal8_day_manifest)<>18 ${fail}\n`+build.owned.map(o=>`IF NOT EXISTS(SELECT 1 FROM dbo.goal8_day_manifest WHERE name=N'${o.name}' AND definition_hash=N'${o.hash}') ${fail}`).join('\n');
 const sharedManifest=build=>build.changed.flatMap(m=>GOAL8_REPAIR_MANIFEST_GUARDS.map(([,table,col])=>`IF EXISTS(SELECT 1 FROM dbo.${table} WHERE name=N'${m.name}' AND ${col}<>N'${m.afterHash}') ${fail}`)).join('\n');
 const altered=[...plan.changed.map(m=>m.after),...plan.owned.map(m=>m.definition)];
 return {oldSeal:installed.definitionHash,newSeal:repaired.definitionHash,dayId:installed.dayId,changedNames:plan.changed.map(m=>m.name),ownedNames:plan.owned.map(m=>m.name),sql:`-- Exact unused Goal8 CAS metadata repair. Default prepares only; API must be paused.
-- Native card/price/ledger/roles untouched. Reviewed old/new seals are explicit.
SET XACT_ABORT ON;SET NOCOUNT ON;DECLARE @Apply bit=0;
${target}
IF @Apply<>1 BEGIN SELECT N'prepare-only-unused-metadata-repair' mode,N'${installed.definitionHash}' oldSeal,N'${repaired.definitionHash}' newSeal,N'${installed.dayId}' dayId;RETURN;END;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY BEGIN TRANSACTION;DECLARE @lock int,@d nvarchar(max);EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @lock<0 ${fail}
${target}
${scope(installed.definitionHash)}
${pins(installed)}
${ownManifest(installed)}
${sharedManifest(installed)}
${guards.map(g=>`IF OBJECT_DEFINITION(OBJECT_ID(N'dbo.${g.name}')) IS NULL OR CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${g.name}'))),2)<>N'${g.hash}' OR OBJECTPROPERTY(OBJECT_ID(N'dbo.${g.name}'),'ExecIsTriggerDisabled')<>0 OR EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(N'dbo.${g.name}') AND (OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 OR OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 OR OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)) ${fail}`).join('\n')}
IF EXISTS(SELECT 1 FROM sys.objects WHERE SCHEMA_NAME(schema_id)=N'dbo' AND name LIKE N'goal8[_]%' AND type IN(N'U',N'P',N'V',N'TR') AND name NOT IN(${names})) ${fail}
${unused}
EXEC dbo.goal8_day_assert_history;EXEC dbo.work_trade_assert_ready;EXEC dbo.usp_work_supplier_payment_ready;EXEC dbo.usp_work_inbound_ready;
DECLARE @before TABLE(name sysname PRIMARY KEY,hash char(64));
${preserved.map(p=>`INSERT @before VALUES(N'${p.name}',${p.expr});`).join('\n')}
${guards.map(g=>`DISABLE TRIGGER dbo.${g.name} ON dbo.${g.table};`).join('\n')}
${altered.map(d=>`SET @d=${lit(d.replace(/^CREATE /,'ALTER '))};EXEC sys.sp_executesql @d;`).join('\n')}
${plan.changed.flatMap(m=>GOAL8_REPAIR_MANIFEST_GUARDS.map(([,table,col])=>`UPDATE dbo.${table} SET ${col}=N'${m.afterHash}' WHERE name=N'${m.name}' AND ${col}=N'${installed.changed.find(o=>o.name===m.name).afterHash}';`)).join('\n')}
${plan.owned.map(m=>`UPDATE dbo.goal8_day_manifest SET definition_hash=N'${m.hash}' WHERE name=N'${m.name}' AND definition_hash=N'${installed.owned.find(o=>o.name===m.name).hash}';IF @@ROWCOUNT<>1 ${fail}`).join('\n')}
UPDATE dbo.goal8_day_scope SET definition_hash=N'${repaired.definitionHash}' WHERE id=1 AND day_id=CONVERT(uniqueidentifier,N'${installed.dayId}') AND sealed=1 AND definition_hash=N'${installed.definitionHash}';IF @@ROWCOUNT<>1 ${fail}
${guards.map(g=>`ENABLE TRIGGER dbo.${g.name} ON dbo.${g.table};`).join('\n')}
${pins(repaired)}
${ownManifest(repaired)}
${sharedManifest(repaired)}
${scope(repaired.definitionHash)}
${unused}
${preserved.map(p=>`IF NOT EXISTS(SELECT 1 FROM @before WHERE name=N'${p.name}' AND hash=${p.expr}) THROW 51283,'GOAL8_REPAIR_NATIVE_OR_PROTECTION_ROWS_CHANGED',1;`).join('\n')}
${guards.map(g=>`IF CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${g.name}'))),2)<>N'${g.hash}' OR OBJECTPROPERTY(OBJECT_ID(N'dbo.${g.name}'),'ExecIsTriggerDisabled')<>0 ${fail}`).join('\n')}
EXEC dbo.goal8_day_assert_history;EXEC dbo.work_trade_assert_ready;EXEC dbo.usp_work_supplier_payment_ready;EXEC dbo.usp_work_inbound_ready;
COMMIT;SELECT N'exact-unused-goal8-metadata-cas-repair' result,N'${installed.definitionHash}' oldSeal,N'${repaired.definitionHash}' newSeal,N'${installed.dayId}' dayId,22 verifiedNativeModules,18 verifiedOwnerModules;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;`};
}
