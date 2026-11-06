import test from 'node:test';import assert from 'node:assert/strict';
import {compileFirstSaleSchemaProposal,compileFirstSaleRollbackReadback} from './first-sale-schema-proposal.mjs';
test('fixed-target schema proposal is atomic and controlled rollback never commits',()=>{
 const plan=compileFirstSaleSchemaProposal({reviewedBaselineSha256:'c'.repeat(64),mode:'rollback'});
 assert.equal(plan.addedTables.length,9);assert.equal(plan.executionAuthorized,false);assert.equal(plan.createsLogin,false);assert.equal(plan.grantsPermissions,false);
 assert.ok(plan.sql.includes("SUSER_SID(N'SEMIH\\Xaser')"));assert.ok(plan.sql.includes("database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1'"));
 assert.ok(plan.sql.includes('FIRST_SALE_BASELINE_DRIFT'));assert.ok(plan.sql.includes('FIRST_SALE_BUSINESS_DATA_PRESENT'));assert.ok(plan.sql.includes('WITH(TABLOCKX,HOLDLOCK)'));
 assert.ok(plan.sql.includes("THROW 51990,'FIRST_SALE_CONTROLLED_ROLLBACK'"));assert.ok(!plan.sql.includes('COMMIT TRANSACTION'));
 assert.ok(plan.sql.includes('IF XACT_STATE()<>0 ROLLBACK TRANSACTION'));assert.ok(!/CREATE LOGIN|GRANT |ALTER ROLE|ADD MEMBER/i.test(plan.sql));
});
test('independent readback compares scoped full schema, marker identity and trusted original constraints',()=>{
 const plan=compileFirstSaleRollbackReadback({reviewedBaselineSha256:'c'.repeat(64)});
 assert.equal((plan.sql.match(/__SQL_CHILD_PID__/g)||[]).length,1);assert.ok(plan.sql.includes('host_process_id=@childPid'));
 assert.ok(plan.sql.includes('(CURRENT_TRANSACTION_ID() IS NULL OR dt.transaction_id<>CURRENT_TRANSACTION_ID())'));
 for(const condition of ['CK_desktop_empty_installation_version','CK_desktop_empty_installation_readonly','is_disabled=0','is_not_trusted=0','READBACK_COMPLETE_METADATA_DRIFT','environment_id=CONVERT','sys.dm_tran_database_transactions','sys.dm_tran_locks','SUSER_SID(ORIGINAL_LOGIN()) IS NULL'])assert.ok(plan.sql.includes(condition),condition);
 assert.ok(!/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|ROLE|dbo\.)/i.test(plan.sql));assert.ok(!plan.sql.includes('BEGIN TRANSACTION'));
});
test('apply compilation is separately named and invalid modes/digests reject',()=>{
 const plan=compileFirstSaleSchemaProposal({reviewedBaselineSha256:'c'.repeat(64),mode:'apply'});assert.ok(plan.sql.includes('COMMIT TRANSACTION'));assert.ok(plan.sql.includes('FIRST_SALE_SCHEMA_APPLIED'));
 assert.throws(()=>compileFirstSaleSchemaProposal({reviewedBaselineSha256:'c'.repeat(64),mode:'retry'}));assert.throws(()=>compileFirstSaleSchemaProposal({reviewedBaselineSha256:'not-a-digest',mode:'rollback'}));
});
