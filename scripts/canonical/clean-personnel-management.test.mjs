import test from 'node:test';import assert from 'node:assert/strict';
import {buildCleanPersonnelManagementDefinitions,buildCleanPersonnelManagementSql,buildCleanPersonnelSchemaSql,cleanPersonnelSchemaBatches} from './clean-personnel-management-sql.mjs';
import {readFileSync} from 'node:fs';
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
test('missing clean personnel prerequisites reuse canonical 0013 and 0014 schema bodies only, without seed or historical assignment',()=>{
 const batches=cleanPersonnelSchemaBatches();assert.equal(batches.length,11);
 for(const name of ['0013_personnel_terminal_sales.sql','0014_personnel_operational_restrictions.sql']){
  const source=readFileSync(new URL('../../infra/sql/migrations/'+name,import.meta.url),'utf8');
  const body=source.slice(source.indexOf('BEGIN TRANSACTION;')+18,source.indexOf('COMMIT TRANSACTION;')).replace(/^GO\s*$/gm,'').trim();
  const normalized=s=>s.replace(/\s+/g,' ').trim();assert.ok(normalized(batches.join('\n')).includes(normalized(body)));
 }
 assert.match(batches[0],/CREATE TABLE dbo.employees/);assert.match(batches[0],/CREATE UNIQUE INDEX UX_employees_user_id/);
 assert.match(batches.join('\n'),/ADD assigned_employee_id BIGINT NULL/);assert.match(batches.join('\n'),/ADD employee_id BIGINT NULL/);
 assert.doesNotMatch(batches.join('\n'),/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP)\b|BEGIN TRANSACTION|COMMIT|^GO\s*$/im);
});
test('incompatible existing table, columns, identity, unique links and defaults reject instead of being overwritten',()=>{
 const sql=buildCleanPersonnelSchemaSql();
 assert.match(sql,/OBJECT_ID\(N'dbo.employees'\) IS NOT NULL AND OBJECT_ID\(N'dbo.employees',N'U'\) IS NULL/);
 for(const condition of ['TYPE_NAME(c.system_type_id)<>expected.type_name','c.is_nullable<>expected.is_nullable','c.is_identity<>expected.is_identity','c.is_computed<>0','c.precision<>5 OR c.scale<>2','system_type_id=127 AND is_nullable=1','f.is_disabled=0 AND f.is_not_trusted=0','i.is_primary_key=1','i.is_unique_constraint=1','user_idisnotnull','sys.default_constraints','B5_MANAGEMENT_PERSONNEL_SCHEMA_INCOMPATIBLE'])assert.ok(sql.includes(condition),condition);
 assert.doesNotMatch(sql,/ALTER COLUMN|NOCHECK|DISABLE TRIGGER|DROP TABLE|UPDATE dbo\.(employees|terminal_devices|sales_invoices)/i);
});
test('schema prerequisites are inside the existing rollback transaction after predecessor proof and before guards are installed',()=>{
 const sql=buildCleanPersonnelManagementSql({probe:true}),schema=buildCleanPersonnelSchemaSql(),position=sql.indexOf(schema);
 assert.ok(position>sql.lastIndexOf('B5_MANAGEMENT_PREDECESSOR_'));assert.ok(position>sql.indexOf('BEGIN TRANSACTION;BEGIN TRY'));
 assert.ok(position<sql.indexOf('CREATE TABLE dbo.clean_personnel_manifest'));
 assert.ok(sql.indexOf('ROLLBACK;SELECT')>position);assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK;THROW/);
 assert.match(sql,/GRANT SELECT ON dbo.employees TO \[melisa_clean_test_app_20261022\]/);
 assert.match(sql,/COL_LENGTH\(N'dbo.employees',N'can_terminal_sale'\) IS NULL/);
});
