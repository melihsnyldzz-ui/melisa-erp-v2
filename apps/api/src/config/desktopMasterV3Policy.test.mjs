import test from 'node:test';
import assert from 'node:assert/strict';
import {DESKTOP_LIFECYCLE_PERMISSION_MANIFEST as old} from './desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_MANIFEST as next,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL as guard,DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS as permissions} from './desktopMasterV3Policy.mjs';
test('V3 adds exactly supplier insertion and entity attachment; old business effects and journals remain unchanged',()=>{
 assert.deepEqual(next.slice(0,old.length),old);
 assert.deepEqual(next.slice(old.length),[
  {schema:'dbo',name:'suppliers',permission:'INSERT',column:null},
  {schema:'dbo',name:'suppliers',permission:'UPDATE',column:'party_entity_id'},
 ]);
 assert.equal(new Set(next.map(JSON.stringify)).size,next.length);
 assert.match(guard,/DESKTOP_WRITE_OTHER_DATABASE_ACCESS_REJECTED/);
 assert.match(guard,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);
});
test('new app key allows supplier creation without delete, approval or update bits',()=>{
 assert.equal(permissions.length,10);assert.equal(new Set(permissions.map(p=>p.key)).size,10);
 assert.deepEqual(permissions.find(p=>p.key==='supplier.edit'),{key:'supplier.edit',view:1,create:1,update:0,delete:0,approve:0});
 assert(permissions.every(p=>p.delete===0));
});
