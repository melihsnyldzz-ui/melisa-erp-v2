import test from 'node:test';
import assert from 'node:assert/strict';
import {DESKTOP_MASTER_V5_CHECKS,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,DESKTOP_MASTER_V5_PERMISSION_MANIFEST,DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS} from './desktopMasterV5Policy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_MANIFEST} from './desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from './desktopMasterVersion.mjs';

// Definitions copied from the independent, rolled-back diagnostic metadata.
// No business rows, credentials or installation outcome are represented.
const fixture={
 CK_desktop_profile_version_mode:{table:'desktop_empty_installation',definition:'([schema_version]=(1) AND [read_only]=(1) OR [schema_version]=(2) AND [read_only]=(0) OR [schema_version]=(3) AND [read_only]=(0) OR [schema_version]=(4) AND [read_only]=(0) OR [schema_version]=(5) AND [read_only]=(0))'},
 CK_desktop_request_operation:{table:'desktop_sale_workflow_requests',definition:"(([operation]) collate Latin1_General_100_BIN2='CREATE_DRAFT' OR ([operation]) collate Latin1_General_100_BIN2='PREPARE' OR ([operation]) collate Latin1_General_100_BIN2='SAVE_CARTONS' OR ([operation]) collate Latin1_General_100_BIN2='READY' OR ([operation]) collate Latin1_General_100_BIN2='CHECK' OR ([operation]) collate Latin1_General_100_BIN2='DISPATCH' OR ([operation]) collate Latin1_General_100_BIN2='CANCEL' OR ([operation]) collate Latin1_General_100_BIN2='CANCEL_SALE')"},
 CK_desktop_resolution_kind:{table:'desktop_sale_request_resolutions',definition:"(([kind]) collate Latin1_General_100_BIN2='draft' OR ([kind]) collate Latin1_General_100_BIN2='transition' OR ([kind]) collate Latin1_General_100_BIN2='dispatch' OR ([kind]) collate Latin1_General_100_BIN2='cancel')"}
};
function expected(name){const line=DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL.split('\n').find(s=>s.includes(`name=N'${name}'`));assert.ok(line);assert.match(line,/is_disabled=0 AND is_not_trusted=0/);assert.match(line,/CONVERT\(varbinary\(max\),definition\)=CONVERT/);const found=line.match(/\)=CONVERT\(varbinary\(max\),N'((?:''|[^'])*)'\)\)/);assert.ok(found);return found[1].replaceAll("''", "'");}
test('guard compares recorded SQL Server CHECK metadata byte-for-byte without character normalization',()=>{
 for(const [name,row] of Object.entries(fixture)){assert.ok(DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL.includes(`OBJECT_ID(N'dbo.${row.table}')`));assert.equal(expected(name),row.definition,name);}
});
test('case-sensitive literals, extra conditions and collation names cannot impersonate recorded checks',()=>{
 const op=fixture.CK_desktop_request_operation.definition,kind=fixture.CK_desktop_resolution_kind.definition;
 for(const [name,variant] of [['CK_desktop_request_operation',op.replace('CANCEL_SALE','cancel_sale')],['CK_desktop_request_operation',op.replace('CANCEL_SALE','CANCEL_[SALE]')],['CK_desktop_request_operation',op.replace('CANCEL_SALE','CANCEL_ SALE')],['CK_desktop_request_operation',op.replace(" OR ([operation]) collate Latin1_General_100_BIN2='CANCEL_SALE'",'')],['CK_desktop_request_operation',op.replace(/\)$/, ' OR 1=1)')],['CK_desktop_request_operation',op.replaceAll('Latin1_General_100_BIN2','Latin1_General_100_CI_AS')],['CK_desktop_resolution_kind',kind.replace("'draft'","'DRAFT'")],['CK_desktop_profile_version_mode',fixture.CK_desktop_profile_version_mode.definition.replace('[schema_version]=(1) AND [read_only]=(1) OR [schema_version]=(2) AND [read_only]=(0)','[schema_version]=(1) AND ([read_only]=(1) OR [schema_version]=(2)) AND [read_only]=(0)')]])assert.notEqual(variant,expected(name));
});
test('V4 schema guard and V3 grants stay intact; V5 remains four narrow rights and eleven role permissions',()=>{
 assert.ok(DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL.startsWith(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL));assert.deepEqual(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.slice(0,-4),DESKTOP_MASTER_V3_PERMISSION_MANIFEST);assert.deepEqual(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.slice(-4).map(x=>[x.name,x.permission,x.column]),[['sales_invoices','UPDATE','cancelled_at'],['sales_invoices','UPDATE','cancel_reason'],['sales_invoices','UPDATE','updated_by'],['terminal_sync_queue','SELECT',null]]);assert.equal(DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS.length,11);assert.deepEqual(Object.keys(DESKTOP_MASTER_V5_CHECKS).sort(),Object.keys(fixture).sort());
});

test('customer movement CHECK admits exactly sale and cancellation in native collation with trusted metadata',()=>{
 const sql=DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,line=sql.split('\n').find(x=>x.includes("name=N'CK_customer_movements_type'"));assert.ok(line);assert.match(line,/OBJECT_ID\(N'dbo.customer_movements'\)/);assert.match(line,/is_disabled=0 AND is_not_trusted=0/);assert.match(line,/CONVERT\(varbinary\(max\),definition\)=CONVERT/);assert.ok(line.includes("sales_invoice_cancel"));assert.doesNotMatch(line,/COLLATE|OR 1=1/);
});
