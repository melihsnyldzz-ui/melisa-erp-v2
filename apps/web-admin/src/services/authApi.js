import {
  clearAuthTokens,
  get,
  getStoredRefreshToken,
  post,
  storeAuthTokens,
} from './apiClient.js';

export async function login(username, password) {
  const response = await post('/api/auth/login', { username, password });
  storeAuthTokens(response.data);
  return response;
}

export async function logout() {
  const refreshToken = getStoredRefreshToken();
  try {
    await post('/api/auth/logout', { refreshToken });
  } finally {
    clearAuthTokens();
  }
}

export async function fetchMe() {
  return get('/api/auth/me');
}

export async function refreshSession() {
  const refreshToken = getStoredRefreshToken();
  const response = await post('/api/auth/refresh', { refreshToken });
  storeAuthTokens(response.data);
  return response;
}
