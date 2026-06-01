export const demoPermissions = [
  'audit.view',
  'dashboard.view',
  'product.view',
  'product.edit',
  'product.update',
  'product.passive',
  'customer.view',
  'customer.edit',
  'customer.update',
  'customer.passive',
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.draft.write',
  'sales.finalize',
  'sales.cancel',
  'purchase.view',
  'purchase.create',
  'purchase.edit',
  'purchase.draft.write',
  'purchase.finalize',
  'purchase.cancel',
  'import.run',
];

export const demoUser = {
  id: 'demo-admin',
  username: 'demo-admin',
  displayName: 'Demo Admin',
  role: {
    id: 'demo-admin-role',
    name: 'Demo Admin',
  },
  permissions: demoPermissions,
};

export const demoTokens = {
  accessToken: 'demo-access-token',
  refreshToken: 'demo-refresh-token',
};

export function demoAuthResponse() {
  return {
    success: true,
    data: {
      ...demoTokens,
      user: demoUser,
    },
  };
}

export function demoMeResponse() {
  return {
    success: true,
    data: demoUser,
  };
}
