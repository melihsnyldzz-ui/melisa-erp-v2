import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRoleCanOpen, demoRolePermissions, getDemoRoleScreenIds } from './demoRolePolicy.js';
import { getRoleScreenIds } from './roleViews.js';

test('sales task view cannot operate cash or approve stock and cannot open those routes', () => {
  const permissions = demoRolePermissions(['sales.create', 'sales.finalize', 'finance.collection', 'finance.payment', 'stock.adjust', 'dashboard.view'], 'satis');
  assert.deepEqual(permissions, ['sales.create', 'dashboard.view']);
  assert.equal(demoRoleCanOpen('satis', 'cash-register'), false);
  assert.equal(demoRoleCanOpen('satis', 'terminal-overview'), true);
  assert.equal(demoRoleCanOpen('muhasebe', 'inventory-receipt-list'), true);
});

test('accounting demo can manage product cards without widening the real session permissions', () => {
  for (const screen of ['stock-list', 'product-card', 'stock-movements', 'price-list', 'stock-valuation']) {
    assert.equal(demoRoleCanOpen('muhasebe', screen), true);
    assert.equal(getDemoRoleScreenIds('muhasebe').has(screen), true);
    assert.equal(getRoleScreenIds('muhasebe').has(screen), false);
  }
  assert.deepEqual(demoRolePermissions(['product.view', 'product.edit', 'settings.manage', 'import.run'], 'muhasebe'), ['product.view', 'product.edit']);
  assert.deepEqual(demoRolePermissions(['product.view'], 'muhasebe'), ['product.view']);
  for (const role of ['satis', 'depo']) {
    assert.deepEqual(demoRolePermissions(['product.view', 'product.edit'], role), ['product.view']);
  }
});
