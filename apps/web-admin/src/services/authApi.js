import {
  clearAuthTokens,
  get,
  getStoredRefreshToken,
  OPEN_ADMIN_TOKEN,
  post,
  storeAuthTokens,
} from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoAuthResponse, demoMeResponse } from '../demo/demoSession.js';

export const openAdminUser = {
  id: 0,
  username: 'open-admin',
  displayName: 'Açık Admin',
  role: {
    id: 0,
    code: 'admin',
    name: 'ADMIN',
  },
  permissions: [
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
    'settings.manage',
  ],
  openAdmin: true,
};

export function openAdminAuthResponse() {
  return {
    success: true,
    data: {
      user: openAdminUser,
      accessToken: OPEN_ADMIN_TOKEN,
      refreshToken: null,
      tokenType: 'Bearer',
      expiresIn: 'local-dev',
    },
  };
}

export async function login(username, password) {
  if (apiConfig.demoMode) {
    const response = demoAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const response = openAdminAuthResponse();
  storeAuthTokens(response.data);
  return response;
}

export async function logout() {
  if (apiConfig.demoMode) {
    clearAuthTokens();
    return { success: true };
  }

  const refreshToken = getStoredRefreshToken();
  try {
    await post('/api/auth/logout', { refreshToken });
  } finally {
    clearAuthTokens();
  }
}

export async function fetchMe() {
  if (apiConfig.demoMode) {
    return demoMeResponse();
  }

  try {
    return await get('/api/auth/me');
  } catch (error) {
    const response = openAdminAuthResponse();
    storeAuthTokens(response.data);
    return {
      success: true,
      data: openAdminUser,
    };
  }
}

export async function refreshSession() {
  if (apiConfig.demoMode) {
    const response = demoAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    const response = openAdminAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const response = await post('/api/auth/refresh', { refreshToken });
  storeAuthTokens(response.data);
  return response;
}
