export const GRANULAR_PERMISSIONS = [
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.finalize',
  'sales.cancel',
  'purchase.view',
  'purchase.create',
  'purchase.edit',
  'purchase.finalize',
  'purchase.cancel',
  'product.view',
  'product.edit',
  'product.passive',
  'customer.view',
  'customer.edit',
  'customer.passive',
  'audit.view',
  'dashboard.view',
];

const FULL_ACCESS_ROLE_CODES = new Set(['admin', 'owner_manager', 'owner_partner']);

export function applyRolePermissionDefaults(permissions = [], roleCode = '') {
  const expanded = new Set(permissions);

  if (FULL_ACCESS_ROLE_CODES.has(String(roleCode || '').toLowerCase())) {
    GRANULAR_PERMISSIONS.forEach((permission) => expanded.add(permission));
  }

  return Array.from(expanded).sort();
}

function addWhen(target, condition, permission) {
  if (condition) {
    target.add(permission);
  }
}

export function expandPermissions(permissionRows = []) {
  const expanded = new Set();

  permissionRows.forEach((row) => {
    const key = row.permission_key;
    const canView = Boolean(row.can_view);
    const canCreate = Boolean(row.can_create);
    const canUpdate = Boolean(row.can_update);
    const canApprove = Boolean(row.can_approve);

    expanded.add(key);

    if (key === 'sales.draft.write') {
      addWhen(expanded, canView, 'sales.view');
      addWhen(expanded, canCreate, 'sales.create');
      addWhen(expanded, canUpdate, 'sales.edit');
    }

    if (key === 'sales.finalize') {
      addWhen(expanded, canApprove, 'sales.finalize');
    }

    if (key === 'sales_invoices.manage') {
      addWhen(expanded, canView, 'sales.view');
      addWhen(expanded, canCreate, 'sales.create');
      addWhen(expanded, canUpdate, 'sales.edit');
      addWhen(expanded, canApprove, 'sales.finalize');
      addWhen(expanded, canApprove, 'sales.cancel');
    }

    if (key === 'purchase.draft.write') {
      addWhen(expanded, canView, 'purchase.view');
      addWhen(expanded, canCreate, 'purchase.create');
      addWhen(expanded, canUpdate, 'purchase.edit');
    }

    if (key === 'purchase.finalize') {
      addWhen(expanded, canApprove, 'purchase.finalize');
    }

    if (key === 'purchase_invoices.manage') {
      addWhen(expanded, canView, 'purchase.view');
      addWhen(expanded, canCreate, 'purchase.create');
      addWhen(expanded, canUpdate, 'purchase.edit');
      addWhen(expanded, canApprove, 'purchase.finalize');
      addWhen(expanded, canApprove, 'purchase.cancel');
    }

    if (key === 'product.update' || key === 'products.manage') {
      addWhen(expanded, canView, 'product.view');
      addWhen(expanded, canCreate || canUpdate, 'product.edit');
    }

    if (key === 'product.passive') {
      addWhen(expanded, canView, 'product.view');
      addWhen(expanded, canUpdate || canApprove, 'product.passive');
    }

    if (key === 'customer.update' || key === 'customers.manage') {
      addWhen(expanded, canView, 'customer.view');
      addWhen(expanded, canCreate || canUpdate, 'customer.edit');
    }

    if (key === 'customer.passive') {
      addWhen(expanded, canView, 'customer.view');
      addWhen(expanded, canUpdate || canApprove, 'customer.passive');
    }

    if (GRANULAR_PERMISSIONS.includes(key)) {
      expanded.add(key);
    }
  });

  return Array.from(expanded).sort();
}
