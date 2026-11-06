import test from 'node:test';
import assert from 'node:assert/strict';
import {DESKTOP_WRITE_OBJECT_PERMISSION_MANIFEST as manifest,DESKTOP_WRITE_PERMISSION_GUARD_SQL as guard} from './desktopWritePermissionPolicy.mjs';

test('writer manifest is narrow: read required tables, insert master rows and update only customer linkage',()=>{
 const selects=manifest.filter(x=>x.permission==='SELECT'),inserts=manifest.filter(x=>x.permission==='INSERT'),updates=manifest.filter(x=>x.permission==='UPDATE');
 assert.equal(selects.length,15);assert.equal(inserts.length,10);assert.deepEqual(updates,[{schema:'dbo',name:'customers',permission:'UPDATE',column:'party_entity_id'}]);
 assert.ok(manifest.every(x=>x.schema==='dbo'&&!['DELETE','EXECUTE','ALTER','CONTROL'].includes(x.permission)));
 assert.ok(!inserts.some(x=>['sales_invoices','stock_movements','customer_movements','suppliers'].includes(x.name)));
});
test('same-connection guard rejects broad roles and server/database/schema/object drift',()=>{
 for(const role of ['securityadmin','serveradmin','setupadmin','dbcreator','db_owner','db_securityadmin','db_datawriter','db_datareader'])assert.ok(guard.includes(`N'${role}'`));
 for(const scope of ["NULL,'SERVER'","NULL,'DATABASE'","'SCHEMA'","'OBJECT'"])assert.ok(guard.includes(scope));
 for(const error of ['DESKTOP_WRITE_ROLE_REJECTED','DESKTOP_WRITE_BROAD_PERMISSION_REJECTED','DESKTOP_WRITE_SCHEMA_PERMISSION_REJECTED','DESKTOP_WRITE_REQUIRED_PERMISSION_MISSING','DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED'])assert.ok(guard.includes(error));
 assert.match(guard,/p\.subentity_name/);assert.match(guard,/allowed\.column_name,'COLUMN'/);
 assert.match(guard,/HAS_PERMS_BY_NAME\(DB_NAME\(\),'DATABASE',N'VIEW DEFINITION'\)/);
 assert.match(guard,/sys\.database_principals/);assert.match(guard,/'USER',N'IMPERSONATE'/);
 assert.match(guard,/DESKTOP_WRITE_USER_IMPERSONATE_REJECTED/);
});
