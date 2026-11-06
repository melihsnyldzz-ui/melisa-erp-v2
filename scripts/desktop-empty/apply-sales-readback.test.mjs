import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileApplySalesReadback,compileSalesAppliedReadback} from './apply-sales-readback.mjs';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';

const identity={databaseId:7,databaseCreateDate:'2026-11-05T12:34:56.000',databaseGuid:'eb2888c2-51cb-4570-a933-397cf7e62806',serverProcessId:21,applyProcessId:32};
test('post-apply observation binds reviewed 45 SQL, target, identity and unresolved sessions',()=>{
 const r=compileApplySalesReadback(identity),sql=r.sql;
 assert.equal(r.applySqlSha256,'e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d');
 assert.equal(r.sqlSha256,createHash('sha256').update(sql).digest('hex'));
 assert.equal(r.executionAuthorized,false);assert.equal(r.callerIdentityIsNotProof,true);
 for(const text of ['Semih\\MELISAERP','MELISA_ERP_DESKTOP_TEST_20261105','database_id=DB_ID()','database_guid=CONVERT(uniqueidentifier',
  "create_date,126)+'.'+RIGHT('000'",'host_process_id=32','SERVERPROPERTY(\'ProcessID\'))<>21','sys.dm_tran_database_transactions',
  'sys.dm_exec_sessions','sys.dm_exec_requests','sys.dm_tran_locks','Shared memory'])assert.ok(sql.includes(text),text);
 assert.match(sql,/SUSER_SID\(ORIGINAL_LOGIN\(\)\)/);assert.match(sql,/IS_SRVROLEMEMBER\(N'sysadmin'\)/);
});
test('exact table, marker, empty business rows, role and permission baseline are required',()=>{
 const {sql}=compileApplySalesReadback(identity),base=compileDesktopEmptyBootstrap();
 assert.match(sql,/DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED/);
 assert.match(sql,/COUNT_BIG\(\*\) FROM dbo\.desktop_empty_installation\)<>1/);
 assert.match(sql,/schema_version=1 AND actual_t1=0 AND external_operations=0 AND read_only=1/);
 assert.match(sql,/COUNT_BIG\(\*\) FROM sys\.database_role_members\)<>1/);
 assert.match(sql,/membership\.role_principal_id=16384 AND membership\.member_principal_id=1/);
 assert.match(sql,/D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1/);
 assert.match(sql,/COUNT_BIG\(\*\) FROM sys\.database_permissions\)<>220/);
 const empty=[...sql.matchAll(/EXISTS\(SELECT 1 FROM dbo\.\[([a-z_]+)\]\)/g)].map(m=>m[1]);
 assert.deepEqual(empty,base.expectedTables.filter(n=>n!=='desktop_empty_installation'));
 assert.equal(empty.length,26);
});
test('catalog and 14 added-column metadata checks remain source-bound, and no persistent write is generated',()=>{
 const {sql,completeFoundationMetadataVerified,fullApplicationAcceptance}=compileApplySalesReadback(identity);
 assert.match(sql,/DESKTOP_BOOTSTRAP_CATALOG_COLUMNS_REJECTED/);assert.match(sql,/DESKTOP_BOOTSTRAP_CATALOG_INDEXES_REJECTED/);
 assert.match(sql,/DESKTOP_SALES_BOOTSTRAP_METADATA_REJECTED/);
 assert.match(sql,/\(N'sales_invoices',N'account_currency',N'nvarchar',6,0,0\)/);
 assert.match(sql,/\(N'stock_movements',N'warehouse_name',N'nvarchar',160,0,0\)/);
 assert.doesNotMatch(sql,/\b(?:INSERT\s+(?:INTO\s+)?dbo\.|UPDATE\s+dbo\.|DELETE\s+FROM\s+dbo\.|CREATE\s+TABLE|COMMIT|EXEC(?:UTE)?\b)/i);
 assert.equal(completeFoundationMetadataVerified,false);assert.equal(fullApplicationAcceptance,false);
});
test('identity injection, unknown fields, invalid ids and getters fail without invoking getters',()=>{
 for(const changed of [{databaseId:4},{serverProcessId:0},{applyProcessId:-1},{databaseGuid:"x' OR 1=1--"},{databaseCreateDate:"2026-11-05T12:34:56.000'"},{server:'elsewhere'}])
  assert.throws(()=>compileApplySalesReadback({...identity,...changed}));
 let invoked=false;const input={...identity};Object.defineProperty(input,'databaseId',{enumerable:true,get(){invoked=true;return 7;}});
 assert.throws(()=>compileApplySalesReadback(input));assert.equal(invoked,false);
});
test('all user objects must be allowed tables or source-named constraints on the right parent',()=>{
 const {sql}=compileApplySalesReadback(identity);
 assert.match(sql,/FROM sys\.objects o LEFT JOIN sys\.tables p ON p\.object_id=o\.parent_object_id/);
 assert.match(sql,/WHERE o\.is_ms_shipped=0 AND NOT\(/);
 assert.match(sql,/DESKTOP_APPLY_READBACK_UNEXPECTED_OBJECT_REJECTED/);
 // Database and system catalog may use different collations. Object types are
 // fixed-width char(2), so compare bytes instead of collated character data.
 assert.match(sql,/CONVERT\(varbinary\(2\),e\.type\)=CONVERT\(varbinary\(2\),o\.type\)/);
 assert.doesNotMatch(sql,/\be\.type\s*=\s*o\.type\b/);
 assert.match(sql,/e\.parent_name\)=CONVERT\(varbinary\(256\),p\.name\)/);
 assert.match(sql,/\(N'PK_roles',N'PK',N'roles'\)/);
 assert.match(sql,/\(N'FK_empty_local_products_supplier',N'F',N'products'\)/);
 assert.match(sql,/native_parent\.object_id=o\.parent_object_id/);assert.match(sql,/k\.is_system_named=1/);
 // Types for a view, procedure, function, trigger, and sequence do not have
 // an allow clause, and an invented constraint is absent from the pinned set.
 const values=sql.slice(sql.indexOf('INSERT @desktop_allowed_constraints VALUES'),sql.indexOf('IF EXISTS(SELECT 1 FROM sys.objects'));
 for(const value of ["N'V'","N'P'","N'FN'","N'TR'","N'SO'","N'CK_invented'"])assert.equal(values.includes(value),false);
});
test('supervisor interface binds the apply PID and original SQL hash',()=>{
 const {applyProcessId,...rest}=identity;
 const r=compileSalesAppliedReadback({...rest,probeProcessId:applyProcessId});
 assert.equal(r.originalSha256,r.applySqlSha256);assert.match(r.sql,/host_process_id=32/);
 assert.throws(()=>compileSalesAppliedReadback({...rest,probeProcessId:32,extra:true}));
});
