import { getRoleScreenIds } from './roleViews.js';

const allowed = {
  satis: new Set(['dashboard.view', 'product.view', 'customer.view', 'sales.view', 'sales.create', 'sales.edit', 'sales.draft.write', 'crm.view']),
  depo: new Set(['dashboard.view', 'product.view', 'purchase.view', 'purchase.create', 'purchase.edit', 'purchase.draft.write', 'supplier.view', 'terminal.stock_count.create']),
  muhasebe: new Set(['dashboard.view', 'audit.view', 'product.view', 'product.edit', 'customer.view', 'customer.edit', 'supplier.view', 'supplier.edit', 'purchase.view', 'purchase.create', 'purchase.edit', 'purchase.finalize', 'sales.view', 'sales.create', 'sales.edit', 'sales.finalize', 'finance.view', 'finance.collection', 'finance.payment', 'stock.adjust']),
};

export function demoRolePermissions(permissions, role) {
  return allowed[role] ? permissions.filter(permission => allowed[role].has(permission)) : permissions;
}

export function getDemoRoleScreenIds(role) {
  const screens = getRoleScreenIds(role);
  if (role === 'muhasebe') {
    for (const screen of ['stock-list', 'product-card', 'stock-movements', 'price-list', 'stock-valuation']) {
      screens.add(screen);
    }
  }
  return screens;
}

export function demoRoleCanOpen(role, screenId) {
  const screens = getDemoRoleScreenIds(role);
  return !screens || screens.has(screenId);
}
