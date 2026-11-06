import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {compileMasterV4Snapshot,compileMasterV4Transition} from './master-v4-transition.mjs';
import {MASTER_V3_RESERVE_SQL} from './master-v3-journal-sql.mjs';import {MASTER_V4_RESERVE_SQL,MASTER_V4_FINISH_SQL} from './master-v4-journal-sql.mjs';
const v={metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64),businessRowsSha256:'c'.repeat(64)};
test('V4 is a separate finite schema, extends both journal guards, and leaves V3 journal untouched',()=>{
 assert(!MASTER_V3_RESERVE_SQL.includes('customer.account.create'));for(const sql of [MASTER_V4_RESERVE_SQL,MASTER_V4_FINISH_SQL]){assert.match(sql,/DATALENGTH\(@operation\)=DATALENGTH\(N'customer.account.create'\)/);assert.match(sql,/LOCAL_MASTER_REQUEST/);}
 assert.match(compileMasterV4Snapshot().sql,/schema_version IN\(3,4\)/);assert(!compileMasterV4Snapshot().sql.includes('schema_version IN(2,3)'));
});
test('DDL locks fixed target and data, adds unique customer/currency only, preserves business/security, rolls back without identity burns',()=>{
 const plan=compileMasterV4Transition({...v,mode:'rollback'});assert.equal(plan.sha256,createHash('sha256').update(plan.sql).digest('hex'));
 assert.match(plan.sql,/UNIQUE INDEX UX_desktop_v4_customer_currency ON dbo.party_currency_accounts\(customer_id,currency_code\) WHERE customer_id IS NOT NULL AND supplier_id IS NULL/);
 assert.match(plan.sql,/TABLOCKX,HOLDLOCK/);assert.match(plan.sql,/MASTER_V4_ROLLBACK_DRIFT/);assert.match(plan.sql,/MASTER_V4_ROWS_OR_SECURITY_CHANGED/);assert(!/GRANT |CREATE (?:LOGIN|USER|TABLE)|INSERT dbo\.|DELETE FROM|TRUNCATE/i.test(plan.sql));
 const apply=compileMasterV4Transition({...v,mode:'apply'});assert.match(apply.sql,/COMMIT TRANSACTION;\s+SELECT N'MASTER_V4_COMMITTED_UNVERIFIED'/);assert.notEqual(plan.sha256,apply.sha256);
 for(const bad of [{...v,mode:'undo'},{...v,mode:'apply',metadataSha256:'x'},{...v,mode:'apply',target:'other'}])assert.throws(()=>compileMasterV4Transition(bad));
});
