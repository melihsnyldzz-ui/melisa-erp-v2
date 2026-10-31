import test from 'node:test';import assert from 'node:assert/strict';
import {buildCleanContactDefinitions,buildCleanContactSql,CLEAN_CONTACT_FIXTURES} from './clean-contact-sql.mjs';
test('B7 companion preserves complete previous guards and seals all changed ready bodies',()=>{
 const {before,definitions}=buildCleanContactDefinitions();assert.equal(Object.keys(before).length,9);assert.equal(Object.keys(definitions).length,17);
 for(const name of ['clean_sale_customers_guard','clean_inbound_suppliers_guard']){const at=before[name].indexOf('AS BEGIN')+8;assert.ok(definitions[name].endsWith(before[name].slice(at)));assert.match(definitions[name],/CURRENT_TRANSACTION_ID/);assert.match(definitions[name],/usp_clean_contact_guard/);}
 for(const name of Object.keys(before).filter(n=>n.endsWith('_ready'))){assert.match(definitions[name],/EXEC dbo.usp_clean_contact_ready/);assert.match(definitions[name],/@b7Predecessors/);}
 const guard=definitions.usp_clean_contact_guard;assert.match(guard,/phone.*city.*country.*updated_at.*updated_by.*row_version/);assert.match(guard,/FULL JOIN OPENJSON/);assert.match(guard,/@deleted COLLATE/);
});
test('B7 installer is target sealed, atomic, retains old journals and creates immutable contact audit',()=>{
 const sql=buildCleanContactSql({probe:true});assert.match(sql,/MELISA_ERP_CLEAN_TEST_20261022/);assert.match(sql,/CLEAN_STORE_DAY_20261022/);assert.match(sql,/B7_METADATA_PROBE_ROLLED_BACK/);assert.equal(CLEAN_CONTACT_FIXTURES.length,8);assert.equal(new Set(CLEAN_CONTACT_FIXTURES.map(f=>f.kind+f.id)).size,8);assert.match(sql,/DENY INSERT,UPDATE,DELETE ON dbo.clean_contact_requests/);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|TRUNCATE|DELETE FROM dbo\.(?:sales|customer|supplier|finance|stock)_/i);
 const {definitions}=buildCleanContactDefinitions();assert.match(definitions.usp_clean_contact_update,/CLEAN_CONTACT_STALE/);assert.match(definitions.usp_clean_contact_update,/CLEAN_CONTACT_REQUEST_CONFLICT/);assert.match(definitions.usp_clean_contact_update,/before_json,after_json/);
});
