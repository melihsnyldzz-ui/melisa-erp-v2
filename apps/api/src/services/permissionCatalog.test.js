import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRolePermissionDefaults, expandPermissions } from './permissionCatalog.js';

test('price editing permission does not grant general product editing or appear for unrelated roles', () => {
  const permissions = expandPermissions([{permission_key:'product.price.edit',can_view:false,can_create:false,can_update:true,can_approve:false}]);
  assert.ok(permissions.includes('product.price.edit'));
  assert.ok(!permissions.includes('product.edit'));
  for (const role of ['viewer','isolated_test_ilker','terminal_user']) {
    assert.ok(!applyRolePermissionDefaults([],role).includes('product.price.edit'));
  }
});

test('active terminal personnel receive CRM view and operation permissions', () => {
  const permissions = applyRolePermissionDefaults([], 'terminal_user');

  assert.ok(permissions.includes('crm.view'));
  assert.ok(permissions.includes('crm.manage'));
  assert.ok(!permissions.includes('finance.view'));
  assert.ok(!permissions.includes('settings.manage'));
});

test('unrelated roles do not receive implicit CRM permissions', () => {
  const permissions = applyRolePermissionDefaults([], 'viewer');

  assert.ok(!permissions.includes('crm.view'));
  assert.ok(!permissions.includes('crm.manage'));
});
