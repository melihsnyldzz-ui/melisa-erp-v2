import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL,CUSTOMER_MASTER_CONSTRAINTS_SQL,CUSTOMER_MASTER_EFFECTIVE_PERMISSIONS_SQL,CUSTOMER_MASTER_KNOWN_CHECKS,CUSTOMER_MASTER_KNOWN_UTC_DEFAULTS,NORMAL_MASTER_FRAME_SQL} from './customerMasterCanonicalSql.mjs';
import {CUSTOMER_MASTER_METADATA_SQL} from './customerMasterMetadataSql.mjs';
import {customerMasterSqlFixture,identityActor as actor} from './customerMasterSql.test-fixture.mjs';

test('normal frame requires object-level visibility for each fixed schema object',()=>{
 const expected=['dbo.customers','dbo.customer_master_local_v1','dbo.customer_master_requests_v1','dbo.customer_master_audit_v1'];
 assert.equal(CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL.split('HAS_PERMS_BY_NAME').length-1,expected.length);
 for(const name of expected)assert(CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL.includes(`HAS_PERMS_BY_NAME(N'${name}',N'OBJECT',N'VIEW DEFINITION')=1`));
 assert(NORMAL_MASTER_FRAME_SQL.indexOf(CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL)<NORMAL_MASTER_FRAME_SQL.indexOf('schemaValid;'));
 assert(NORMAL_MASTER_FRAME_SQL.includes('CONVERT(bit,CASE WHEN '+CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL));
 assert.doesNotMatch(CUSTOMER_MASTER_REQUIRED_VISIBILITY_SQL,/COALESCE|ISNULL| OR /i);
});
test('unknown or denied schema frames reject reads and edits without touching the journal',async()=>{
 for(const schemaValid of [false,null]){const f=customerMasterSqlFixture({normal:true}),before=f.snapshot();f.modes.frame={schemaValid};
  await assert.rejects(f.service.context('100',actor));await assert.rejects(f.cards.detail('100',actor));
  await assert.rejects(f.service.update('100',{requestId:'11111111-1111-4111-8111-111111111111',expectedRevision:'A'.repeat(64),customerCode:'000100',customerName:'Sentetik',customerType:'customer'},actor));
  assert.deepEqual(f.snapshot(),before);
 }
});
test('transaction frame requires the metadata reader constraint grammar, UTC default and no extra foreign key',()=>{
 const sql=CUSTOMER_MASTER_CONSTRAINTS_SQL;
 assert.equal((sql.match(/SELECT COUNT\(\*\) FROM sys\.foreign_keys/g)??[]).length,3);
 assert.equal((sql.match(/SELECT 1 FROM sys\.check_constraints c/g)??[]).length,9);
 assert.equal((sql.match(/c\.is_disabled<>0 OR c\.is_not_trusted<>0 OR c\.definition IS NULL/g)??[]).length,3);
 assert.equal((sql.match(/NOT EXISTS\(SELECT 1 FROM sys\.default_constraints/g)??[]).length,2);
 assert.match(sql,/COUNT\(\*\) FROM sys\.default_constraints d WHERE[^\n]*\)=1 AND EXISTS/);
 assert.match(sql,/COL_NAME\(d\.parent_object_id,d\.parent_column_id\)=N'created_at'/);
 for(const value of [...Object.values(CUSTOMER_MASTER_KNOWN_CHECKS).flat(),...CUSTOMER_MASTER_KNOWN_UTC_DEFAULTS]){
  const literal="N'"+value.replaceAll("'","''")+"'";assert(sql.includes(literal));assert(CUSTOMER_MASTER_METADATA_SQL.includes(literal));
 }
 assert(NORMAL_MASTER_FRAME_SQL.includes(sql));
});
test('frame keeps SELECT permissions for views and requires effective write permissions only for updates',()=>{
 const sql=CUSTOMER_MASTER_EFFECTIVE_PERMISSIONS_SQL;
 assert.equal((sql.match(/N'COLUMN'\)=1/g)??[]).length,33); // 28 SELECT + 5 UPDATE
 assert.equal((sql.match(/N'OBJECT',N'INSERT'\)=1/g)??[]).length,3);
 for(const name of ['customer_code','customer_name','customer_type','version','updated_by'])assert(sql.includes(`N'UPDATE',N'${name}',N'COLUMN')=1`));
 assert.match(sql,/\) AND \(@permission_key=N'customer\.view' OR \(/);
 assert(NORMAL_MASTER_FRAME_SQL.includes(sql));assert.doesNotMatch(sql,/COALESCE|ISNULL/i);
});
