import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCleanPersonnelWorkDefinitions,buildCleanPersonnelWorkSql} from './clean-personnel-work-sql.mjs';
import {buildCleanPersonnelManagementDefinitions} from './clean-personnel-management-sql.mjs';
import {buildCleanDirectSaleDefinitions} from './clean-direct-sale-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
const bundle=buildCleanPersonnelWorkDefinitions(),d=bundle.definitions;
test('new predecessor fallback adds no CASE layer above the existing SQL Server readiness chain',()=>{
 for(const [name,body] of Object.entries(d).filter(([name])=>name.endsWith('_ready')&&bundle.before[name])){
  assert.match(body,/ISNULL\(JSON_VALUE\(@workPredecessors/,name);
  assert.doesNotMatch(body,/COALESCE\(JSON_VALUE\(@workPredecessors/,name);
 }
 // The new fallback changes neither the immediately preceding sealed bytes
 // nor the rule that a missing entry uses the actual current module hash.
 assert.equal(bundle.before.usp_clean_personnel_ready,buildCleanPersonnelManagementDefinitions().definitions.usp_clean_personnel_ready);
 assert.match(d.usp_clean_store_day_ready,/ISNULL\(JSON_VALUE\(@workPredecessors,N'\$\.'\+\w+\.name\),CONVERT\(char\(64\),HASHBYTES/);
});
test('personal actor is a native active member/employee/user/role join, not a user-supplied flag or a sample account rename',()=>{
 for(const name of ['usp_clean_personnel_work_actor','usp_clean_direct_sale_bind','usp_clean_store_day_bind','usp_clean_store_finance_bind','usp_clean_store_inventory_bind','usp_clean_finance_b4_bind','usp_clean_finance_b4_fx_usd_bind','usp_clean_finance_b4_fx_eur_bind','usp_clean_finance_b4_cash_bind']){
  const b=d[name];assert.match(b,/JOIN dbo\.employees pe WITH\(HOLDLOCK\) ON pe\.id=pm\.employee_id AND pe\.user_id=pm\.user_id/);assert.match(b,/pe\.is_active=1 AND pu\.is_active=1 AND pr\.is_active=1/);assert.match(b,/pm\.user_id NOT IN\(15,16,17,18,19,20,21,22,23,10018\)/);assert.match(b,/MELISA_ERP_CLEAN_TEST_20261022/);assert.match(b,/melisa_clean_test_app_20261022/);
 }
 assert.match(d.usp_clean_direct_sale_bind,/pe\.can_terminal_sale=1/);assert.match(d.usp_clean_personnel_work_actor,/@actor_id bigint/);assert.doesNotMatch(d.usp_clean_personnel_work_actor,/@role|@employee|@accepted/);
});
test('existing B6 financial math, finite products and own-invoice guard are byte-preserved around the actor predicate',()=>{
 const old=buildCleanDirectSaleDefinitions().definitions.usp_clean_direct_sale_bind,next=d.usp_clean_direct_sale_bind;
 const tail='IF EXISTS(SELECT 1 FROM dbo.clean_store_day_intents)';assert.ok(old.includes(tail));assert.equal(next.slice(next.indexOf(tail)),old.slice(old.indexOf(tail)));
 for(const n of ['usp_clean_direct_sale_guard','usp_clean_direct_sale_finish'])assert.equal(d[n],undefined,'existing effect guards are unchanged');
 for(const n of ['usp_clean_finance_b4_bind','usp_clean_finance_b4_fx_usd_bind','usp_clean_finance_b4_fx_eur_bind']){assert.match(d[n],/m\.created_by=@actor_id/);assert.match(d[n],/pm\.user_id=m\.created_by/);assert.match(d[n],/@amount>500/);assert.match(d[n],/20261022/);}
 assert.match(d.usp_clean_store_inventory_bind,/@draft=1 AND @count=1/);assert.match(d.usp_clean_store_inventory_bind,/pr\.id=31 AND pr\.code=N'clean_test_personnel_manager'/);assert.match(d.usp_clean_store_day_bind,/created_by=@actor_id/);
 // members has its own created_by; an unqualified name would inspect the
 // enrolling manager instead of the business record's actual creator.
 assert.match(d.usp_clean_store_day_bind,/pm\.user_id=dbo\.test_goods_batches\.created_by/);assert.match(d.usp_clean_store_inventory_bind,/pm\.user_id=dbo\.test_daily_drafts\.created_by/);assert.doesNotMatch(Object.values(d).join('\n'),/pm\.user_id=created_by\b/);
 assert.match(d.usp_clean_finance_b4_cash_ready,/TRIGGER_NESTLEVEL\(\)>0/);assert.match(d.usp_clean_finance_b4_cash_ready,/actor_id IN\(20,23,10018\) OR EXISTS/);assert.match(d.usp_clean_finance_b4_cash_ready,/pm\.user_id=actor_id/);assert.match(d.usp_clean_finance_b4_cash_ready,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);
});
test('normal management adds three finite jobs without changing first management predecessor or protected account rules',()=>{
 const base=buildCleanPersonnelManagementDefinitions();for(const name of ['usp_clean_personnel_bind','usp_clean_personnel_guard'])assert.equal(bundle.before[name],base.definitions[name]);
 assert.match(d.usp_clean_personnel_bind,/r\.id=30 AND r\.code=N'clean_test_personnel'/);assert.match(d.usp_clean_personnel_bind,/r\.id=31 AND r\.code=N'clean_test_personnel_manager'/);assert.match(d.usp_clean_personnel_bind,/r\.id=32 AND r\.code=N'clean_test_personnel_finance'/);
 assert.match(d.usp_clean_personnel_bind,/m\.employee_id=@target_id/);assert.match(d.usp_clean_personnel_bind,/CLEAN_PERSONNEL_PROTECTED_RECORD/);assert.equal(d.clean_personnel_users_guard,undefined);assert.match(base.definitions.clean_personnel_users_guard,/last_login_at/);
});
test('installation rejects collisions, retains old constraints and seals, is atomic and creates no personal accounts or business records',()=>{
 const sql=buildCleanPersonnelWorkSql(),probe=buildCleanPersonnelWorkSql({probe:true});
 assert.match(sql,/roles WHERE id IN\(30,31,32\) OR code IN/);assert.match(sql,/BEGIN TRANSACTION;BEGIN TRY/);assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);assert.match(sql,/CHECK\(\('\+@constraint/);assert.match(sql,/before_inbound_constraints_json/);assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo\.clean_personnel_work_manifest/);
 assert.match(probe,/ROLLBACK;SELECT N'B5_PERSONAL_WORK_METADATA_PROBE_ROLLED_BACK'/);assert.doesNotMatch(sql,/INSERT (?:INTO )?dbo\.(?:users|employees|customers|sales_invoices)\s*\(/);assert.doesNotMatch(sql,/UPDATE dbo\.users SET|DISABLE TRIGGER|NOCHECK CONSTRAINT/);
 for(const [name,body]of Object.entries(d)){assert.ok(sql.includes(moduleHash(body)),name);if(bundle.before[name])assert.ok(sql.includes(moduleHash(bundle.before[name])),name+' predecessor');}
 assert.match(d.usp_clean_personnel_work_ready,/m\.uses_ansi_nulls<>1 OR m\.uses_quoted_identifier<>1/);assert.match(d.usp_clean_personnel_work_ready,/ExecIsTriggerDisabled/);assert.match(d.usp_clean_personnel_work_ready,/can_update=0 AND can_delete=0/);
});
