// Additive isolated TEST card profile; original V2 install/guard stay frozen.
import {DESKTOP_LIFECYCLE_PERMISSION_MANIFEST} from './desktopLifecyclePermissionPolicy.mjs';
import {compileDesktopWritePermissionGuard} from './desktopWritePermissionPolicy.mjs';
export const DESKTOP_MASTER_V3_PERMISSION_MANIFEST=Object.freeze([
 ...DESKTOP_LIFECYCLE_PERMISSION_MANIFEST,
 Object.freeze({schema:'dbo',name:'suppliers',permission:'INSERT',column:null}),
 Object.freeze({schema:'dbo',name:'suppliers',permission:'UPDATE',column:'party_entity_id'}),
]);
export const DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL=compileDesktopWritePermissionGuard(DESKTOP_MASTER_V3_PERMISSION_MANIFEST);
export const DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS=Object.freeze([
 'customer.view','customer.edit','product.view','product.edit','supplier.view','supplier.edit',
 'sales.view','sales.create','sales.edit','sales.finalize',
].map(key=>Object.freeze({key,view:1,create:['customer.edit','product.edit','supplier.edit','sales.create'].includes(key)?1:0,
 update:['customer.edit','product.edit','sales.edit'].includes(key)?1:0,delete:0,approve:key==='sales.finalize'?1:0})));
