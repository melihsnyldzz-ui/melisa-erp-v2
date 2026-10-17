import {
  clearAuthTokens,
  get,
  getStoredRefreshToken,
  post,
  storeAuthTokens,
} from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoAuthResponse, demoMeResponse } from '../demo/demoSession.js';

export async function login(username, password) {
  if (apiConfig.demoMode) {
    const response = demoAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const response = await post('/api/auth/login', { username, password });
  storeAuthTokens(response.data);
  return response;
}

export async function localPasswordlessAdminLogin() {
  if (apiConfig.demoMode) {
    const response = demoAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const response = await post('/api/auth/local-passwordless-admin', {});
  storeAuthTokens(response.data);
  return response;
}

export async function logout() {
  if (import.meta.env.VITE_TEST_READ_ONLY === 'true' && !apiConfig.vegaBridgeMode) {
    clearAuthTokens();
    return { success: true };
  }
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

  return get('/api/auth/me');
}

export async function refreshSession() {
  if (apiConfig.demoMode) {
    const response = demoAuthResponse();
    storeAuthTokens(response.data);
    return response;
  }

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    const error = new Error('Oturum süresi doldu, tekrar giriş yapın.');
    error.code = 'AUTH_REFRESH_TOKEN_MISSING';
    throw error;
  }

  const response = await post('/api/auth/refresh', { refreshToken });
  storeAuthTokens(response.data);
  return response;
}
