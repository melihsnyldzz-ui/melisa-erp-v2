import { API_BASE_URL, apiConfig } from '../config/apiConfig.js';

const ACCESS_TOKEN_KEY = 'melisaErpAccessToken';
const REFRESH_TOKEN_KEY = 'melisaErpRefreshToken';
export const OPEN_ADMIN_TOKEN = 'open-admin';

export function getStoredAccessToken() {
  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (storedToken) {
    return storedToken;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, OPEN_ADMIN_TOKEN);
  return OPEN_ADMIN_TOKEN;
}

export function getStoredRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function request(method, path, { params = {}, body } = {}) {
  if (apiConfig.demoMode) {
    const demoError = new Error(`Demo mode icin servis mock response tanimli de?il: ${method} ${path}`);
    demoError.code = 'DEMO_ROUTE_MISSING';
    throw demoError;
  }

  let response;

  try {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const accessToken = getStoredAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const networkError = new Error('API sunucusuna ulasilamadi.');
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const parseError = new Error('API response okunamadi.');
    parseError.code = 'API_PARSE_ERROR';
    throw parseError;
  }

  if (!response.ok || payload.success === false) {
    const apiError = new Error(payload.error.message || 'API istegi basarisiz oldu.');
    apiError.code = payload.error.code || 'API_ERROR';
    apiError.status = response.status;
    apiError.meta = payload.meta || {};

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('melisa-auth-expired'));
    }

    throw apiError;
  }

  return payload;
}

export async function get(path, params = {}) {
  return request('GET', path, { params });
}

export async function post(path, body = {}) {
  return request('POST', path, { body });
}

export async function put(path, body = {}) {
  return request('PUT', path, { body });
}

export async function patch(path, body = {}) {
  return request('PATCH', path, { body });
}
