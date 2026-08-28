import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRolePermissionDefaults } from './permissionCatalog.js';

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
