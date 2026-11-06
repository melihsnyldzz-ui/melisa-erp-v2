import test from 'node:test';import assert from 'node:assert/strict';
import {DESKTOP_LIFECYCLE_PERMISSION_MANIFEST as manifest,DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as guard} from './desktopLifecyclePermissionPolicy.mjs';
import {compileDesktopWritePermissionGuard} from './desktopWritePermissionPolicy.mjs';
test('first-sale permissions keep journals immutable and commercial rows undeletable',()=>{
 for(const name of ['desktop_sale_workflow_requests','desktop_sale_request_resolutions','audit_logs'])assert.ok(manifest.filter(x=>x.name===name).every(x=>['SELECT','INSERT'].includes(x.permission)));
 assert.deepEqual(manifest.filter(x=>x.permission==='DELETE').map(x=>x.name).sort(),['desktop_sale_carton_items','desktop_sale_cartons']);
 assert.ok(manifest.filter(x=>x.permission==='UPDATE').every(x=>typeof x.column==='string'));
 assert.ok(!manifest.some(x=>/finance_|purchase_|supplier_movements|auth_refresh_tokens/.test(x.name)));
 assert.ok(guard.includes('DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED'));assert.ok(guard.includes("N'desktop_sale_request_resolutions'"));
});
test('guard compiler cannot turn a manifest into schema, DDL or injected object authority',()=>{
 for(const row of [{schema:'dbo',name:'customers',permission:'ALTER',column:null},{schema:'other',name:'customers',permission:'SELECT',column:null},{schema:'dbo',name:'x];DROP TABLE y',permission:'SELECT',column:null}])assert.throws(()=>compileDesktopWritePermissionGuard([row]));
});
