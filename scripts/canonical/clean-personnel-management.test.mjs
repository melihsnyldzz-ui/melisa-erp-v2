import test from 'node:test';import assert from 'node:assert/strict';
import {buildCleanPersonnelManagementDefinitions,buildCleanPersonnelManagementSql} from './clean-personnel-management-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
test('management extends exact predecessor definitions without discarding existing audit guards or seals',()=>{
 const {before,definitions}=buildCleanPersonnelManagementDefinitions(),old=before.clean_sale_audit_logs_guard;
 assert.ok(definitions.clean_sale_audit_logs_guard.endsWith(old.slice(old.indexOf('AS BEGIN')+8)));
 for(const n of Object.keys(before).filter(n=>n.endsWith('_ready'))){assert.match(definitions[n],/EXEC dbo.usp_clean_personnel_ready/);assert.match(definitions[n],/@personnelPredecessors/);}
 const install=buildCleanPersonnelManagementSql();for(const b of Object.values(before))assert.ok(install.includes(moduleHash(b)));
});
test('new records are explicitly enrolled, old users cannot be adopted or granted an administrator role',()=>{
 const {definitions:d}=buildCleanPersonnelManagementDefinitions();const bind=d.usp_clean_personnel_bind,guard=d.usp_clean_personnel_guard;
 for(const text of ['MELISA_ERP_CLEAN_TEST_20261022','e662fd94-d797-4b3b-938a-d143ad758b67','ORIGINAL_LOGIN()','@@TRANCOUNT<>1',"@actor_id<>10018","N'settings.manage'",'CLEAN_PERSONNEL_PROTECTED_RECORD','u.is_active=1','r.is_active=1','m.employee_id IS NULL','m.employee_id=@target_id'])assert.ok(bind.includes(text),text);
 assert.match(bind,/r.id=20 AND r.code=N'clean_test_sales'/);assert.doesNotMatch(bind,/r.id=2 AND r.code=N'admin'/);
 for(const text of ['INSERT dbo.clean_personnel_members','@changed<>0','@audited<>0','user_password_reset','passwordConfigured','changed_count=1','audit_count=1'])assert.ok(guard.includes(text),text);
 assert.match(d.clean_personnel_users_guard,/last_login_at.*row_version/);assert.match(d.clean_personnel_members_guard,/d.employee_id IS NOT NULL/);
});
test('install is atomic, exact target only, adds no accounts or roles and never changes business actor scope',()=>{
 const source=buildCleanPersonnelManagementSql({probe:true});
 assert.match(source,/BEGIN TRANSACTION;BEGIN TRY/);assert.match(source,/ROLLBACK;SELECT N'B5_MANAGEMENT_METADATA_PROBE_ROLLED_BACK'/);
 assert.match(source,/DENY DELETE ON dbo.users/);assert.match(source,/DENY INSERT,UPDATE,DELETE ON dbo.clean_personnel_members/);
 assert.doesNotMatch(source,/DISABLE TRIGGER|TRUNCATE|INSERT (?:INTO )?dbo.roles|INSERT (?:INTO )?dbo.permissions/i);
 const {before}=buildCleanPersonnelManagementDefinitions();assert.ok(!Object.hasOwn(before,'usp_clean_direct_sale_bind'));assert.ok(!Object.hasOwn(before,'usp_clean_store_day_bind'));
});
