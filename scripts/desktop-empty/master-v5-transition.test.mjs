import test from 'node:test';import assert from 'node:assert/strict';
import {compileMasterV5Transition,compileMasterV5Snapshot,compileMasterV5Revert,MASTER_V5_TRANSITION_SCOPE} from './master-v5-transition.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_MANIFEST} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_MANIFEST,DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
import {desktopMasterSchema,desktopMasterV5Schema} from '../../apps/api/src/config/desktopMasterVersion.mjs';
const baseline={metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64),businessRowsSha256:'c'.repeat(64)};
test('pre-acceptance recovery cannot erase sale history and requires exact V5 candidate plus unchanged business rows',()=>{
 const p=compileMasterV5Revert({...baseline,candidateMetadataSha256:'d'.repeat(64),candidateSecuritySha256:'e'.repeat(64)});assert.equal(p.mode,'revert');assert.equal(p.requiresEmptyCancellationJournal,true);assert.match(p.sql,/operation='CANCEL_SALE'/);assert.match(p.sql,/kind='cancel'/);assert.match(p.sql,/MASTER_V5_REVERT_READBACK_DRIFT/);assert.equal((p.sql.match(/DELETE FROM dbo\./g)||[]).length,1);assert.match(p.sql,/DELETE FROM dbo.permissions WHERE role_id=@operatorRole AND permission_key=N'sales.cancel'/);assert.doesNotMatch(p.sql,/DELETE FROM dbo\.(?:sales_|customer_|stock_)/);assert.doesNotMatch(p.sql,/DBCC|CREATE LOGIN|CREATE USER|GRANT /);assert.throws(()=>compileMasterV5Revert(baseline));
});
test('finite V5 adds only three cancellation columns and queue SELECT; earlier manifests remain unchanged',()=>{
 assert.deepEqual(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.slice(0,-4),DESKTOP_MASTER_V3_PERMISSION_MANIFEST);
 assert.deepEqual(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.slice(-4).map(v=>[v.name,v.permission,v.column]),[['sales_invoices','UPDATE','cancelled_at'],['sales_invoices','UPDATE','cancel_reason'],['sales_invoices','UPDATE','updated_by'],['terminal_sync_queue','SELECT',null]]);
 assert.equal(DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS.length,11);assert.deepEqual(DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS.at(-1),{key:'sales.cancel',view:1,create:0,update:0,delete:0,approve:1});
 assert.equal(desktopMasterV5Schema(true,5),5);for(const v of [0,1,2,5,6,'5'])assert.throws(()=>desktopMasterSchema(true,v));assert.throws(()=>desktopMasterSchema(false,5));for(const v of [3,4,6,'5'])assert.throws(()=>desktopMasterV5Schema(true,v));assert.throws(()=>desktopMasterV5Schema(false,5));
 assert.match(DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,/system_type_id=231 AND max_length=500/);assert.match(DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,/CONVERT\(varbinary\(max\)/);
});
test('rollback trial keeps business/security baseline, uses explicit negative permission identity and independently checks the seed',()=>{
 const p=compileMasterV5Transition({mode:'rollback',...baseline});assert.equal(p.sqlTested,false);assert.equal(p.requiresSecurityScopeApproval,true);assert.equal(p.target.database,'MELISA_ERP_DESKTOP_TEST_20261105');assert.equal(MASTER_V5_TRANSITION_SCOPE.newPasswords,0);
 assert.match(p.sql,/WITH\(TABLOCKX,HOLDLOCK\)/);assert.match(p.sql,/BEGIN TRANSACTION/);assert.match(p.sql,/ROLLBACK TRANSACTION/);assert.match(p.sql,/VALUES\(-30002,@operatorRole,N'sales.cancel'/);assert.match(p.sql,/increment_value\)=1/);assert.match(p.sql,/ROLLBACK_IDENTITY_DRIFT/);assert.doesNotMatch(p.sql,/DBCC|CREATE LOGIN|CREATE USER|CREATE ROLE|UPDATE dbo\.(products|customers|stock_movements|customer_movements)/i);
 assert.equal((p.sql.match(/GRANT /g)||[]).length,2);assert.match(p.sql,/GRANT UPDATE ON OBJECT::dbo.sales_invoices\(cancelled_at,cancel_reason,updated_by\)/);assert.match(p.sql,/GRANT SELECT ON OBJECT::dbo.terminal_sync_queue/);assert.deepEqual(p.baseline,baseline);
});
test('apply cannot be compiled without exact independently observed rollback candidate fingerprints',()=>{
 assert.throws(()=>compileMasterV5Transition({mode:'apply',...baseline}));for(const extra of [{server:'elsewhere'},{approved:true},{candidateSecuritySha256:'not-a-hash'}])assert.throws(()=>compileMasterV5Transition({mode:'rollback',...baseline,...extra}));
 const p=compileMasterV5Transition({mode:'apply',...baseline,candidateMetadataSha256:'d'.repeat(64),candidateSecuritySha256:'e'.repeat(64)});assert.match(p.sql,/MASTER_V5_CANDIDATE_DRIFT/);assert.match(p.sql,/COMMIT TRANSACTION/);assert.doesNotMatch(p.sql,/VALUES\(-30002/);assert.equal(p.candidate.securitySha256,'e'.repeat(64));
 const snapshot=compileMasterV5Snapshot();assert.equal(snapshot.readOnly,true);assert.match(snapshot.sql,/schema_version IN\(4,5\)/);assert.doesNotMatch(snapshot.sql,/\b(?:ALTER\s+TABLE|GRANT\b|INSERT\s+(?:INTO\s+)?dbo\.|DELETE\s+(?:FROM\s+)?dbo\.|UPDATE\s+dbo\.)/i);assert.equal(compileMasterV5Transition({mode:'rollback',...baseline}).sha256,compileMasterV5Transition({mode:'rollback',...baseline}).sha256);
});

test('fresh V5 applies trusted narrow customer movement check and revert restores V4',()=>{
 for(const mode of ['rollback','apply']){const p=compileMasterV5Transition({...baseline,mode,...(mode==='apply'?{candidateMetadataSha256:'d'.repeat(64),candidateSecuritySha256:'e'.repeat(64)}:{})});assert.match(p.sql,/MASTER_V5_CUSTOMER_CHECK_DRIFT/);assert.match(p.sql,/ALTER TABLE dbo.customer_movements WITH CHECK ADD CONSTRAINT CK_customer_movements_type CHECK \(movement_type=N'sales_invoice' OR movement_type=N'sales_invoice_cancel'\)/);}
 const revert=compileMasterV5Revert({...baseline,candidateMetadataSha256:'d'.repeat(64),candidateSecuritySha256:'e'.repeat(64)});assert.match(revert.sql,/ALTER TABLE dbo.customer_movements WITH CHECK ADD CONSTRAINT CK_customer_movements_type CHECK \(movement_type IN \(N''sales_invoice''\)\)/);
});
