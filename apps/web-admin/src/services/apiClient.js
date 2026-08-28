import { API_BASE_URL, apiConfig } from '../config/apiConfig.js';

const ACCESS_TOKEN_KEY = 'melisaErpAccessToken';
const REFRESH_TOKEN_KEY = 'melisaErpRefreshToken';
const LOCAL_PASSWORDLESS_SESSION_KEY = 'melisaErpLocalPasswordlessSession';

let sessionRenewalPromise = null;

export function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens({ accessToken, refreshToken, localPasswordlessSession = false }) {
  if (accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.localStorage.removeItem(LOCAL_PASSWORDLESS_SESSION_KEY);
  }

  if (localPasswordlessSession) {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.setItem(LOCAL_PASSWORDLESS_SESSION_KEY, 'true');
  }
}

export function clearAuthTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LOCAL_PASSWORDLESS_SESSION_KEY);
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

async function requestNewSession(path, body) {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    return false;
  }

  storeAuthTokens(payload.data || {});
  return Boolean(payload.data?.accessToken);
}

export async function renewStoredSession() {
  if (sessionRenewalPromise) {
    return sessionRenewalPromise;
  }

  sessionRenewalPromise = (async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        return await requestNewSession('/api/auth/refresh', { refreshToken });
      }

      const isLocalPasswordlessSession = (
        window.localStorage.getItem(LOCAL_PASSWORDLESS_SESSION_KEY) === 'true'
        || Boolean(getStoredAccessToken())
      );
      if (isLocalPasswordlessSession && apiConfig.localPasswordlessLogin) {
        return await requestNewSession('/api/auth/local-passwordless-admin', {});
      }

      return false;
    } catch {
      return false;
    } finally {
      sessionRenewalPromise = null;
    }
  })();

  return sessionRenewalPromise;
}

async function request(method, path, { params = {}, body, retryAuth = true } = {}) {
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

  if (response.status === 401 && retryAuth && !path.startsWith('/api/auth/')) {
    const renewed = await renewStoredSession();
    if (renewed) {
      return request(method, path, { params, body, retryAuth: false });
    }
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
      clearAuthTokens();
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

export async function remove(path, body) {
  return request('DELETE', path, { body });
}

export async function download(path, filename, { retryAuth = true } = {}) {
  const headers = {};
  const accessToken = getStoredAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(buildUrl(path), { headers });
  } catch {
    const error = new Error('API sunucusuna ulasilamadi.');
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  if (response.status === 401 && retryAuth) {
    const renewed = await renewStoredSession();
    if (renewed) return download(path, filename, { retryAuth: false });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || 'Dosya indirilemedi.');
    error.code = payload?.error?.code || 'DOWNLOAD_FAILED';
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
