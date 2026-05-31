export const demoPermissions = [
  'dashboard.view',
  'product.update',
  'product.passive',
  'customer.update',
  'customer.passive',
  'sales.draft.write',
  'sales.finalize',
  'purchase.draft.write',
  'purchase.finalize',
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
