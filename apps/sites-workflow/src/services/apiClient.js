import { buildApiUrl } from './apiUrl.js';
import { demoReadRequest } from '../demo/demoWorkspace.js';
import { API_BASE_URL, apiConfig } from '../config/apiConfig.js';
import { shouldRetryWithRenewedSession } from './authRetryPolicy.js';

const ACCESS_TOKEN_KEY = apiConfig.vegaBridgeMode ? 'melisaVegaAccessToken' : 'melisaErpAccessToken';
const REFRESH_TOKEN_KEY = apiConfig.vegaBridgeMode ? 'melisaVegaRefreshToken' : 'melisaErpRefreshToken';
const LOCAL_PASSWORDLESS_SESSION_KEY = 'melisaErpLocalPasswordlessSession';

const testReadOnly = import.meta.env.VITE_TEST_READ_ONLY === 'true';
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

  if (testReadOnly && !apiConfig.vegaBridgeMode) {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(LOCAL_PASSWORDLESS_SESSION_KEY);
    return;
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
  return buildApiUrl(path, API_BASE_URL, globalThis.window?.location?.origin, params);
}

async function requestNewSession(path, body) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
      signal: apiConfig.vegaBridgeMode ? AbortSignal.timeout(60000) : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Oturum servisine ulaşılamadı. Bağlantı geldiğinde tekrar deneyin; kayıtlı oturumunuz korundu.'), { code: 'AUTH_REFRESH_UNAVAILABLE' });
  }

  // Only an explicit authentication rejection can invalidate the saved session.
  if (response.status === 401) return false;
  if (!response.ok) {
    throw Object.assign(new Error('Oturum şu anda yenilenemiyor. Biraz sonra tekrar deneyin; kayıtlı oturumunuz korundu.'), { code: 'AUTH_REFRESH_UNAVAILABLE', status: response.status });
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw Object.assign(new Error('Oturum servisinin yanıtı okunamadı. Tekrar deneyin; kayıtlı oturumunuz korundu.'), { code: 'AUTH_REFRESH_UNAVAILABLE', status: response.status });
  }

  if (payload?.success === false || typeof payload?.data?.accessToken !== 'string' || !payload.data.accessToken.trim()) {
    throw Object.assign(new Error('Oturum servisi geçerli bir yanıt vermedi. Tekrar deneyin; kayıtlı oturumunuz korundu.'), { code: 'AUTH_REFRESH_UNAVAILABLE' });
  }

  storeAuthTokens(payload.data || {});
  return Boolean(payload.data?.accessToken);
}

export async function renewStoredSession() {
  if (testReadOnly && !apiConfig.vegaBridgeMode) return false;
  if (sessionRenewalPromise) {
    return sessionRenewalPromise;
  }

  const renewalPromise = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      return await requestNewSession('/api/auth/refresh', { refreshToken });
    }

    const isLocalPasswordlessSession = window.localStorage.getItem(LOCAL_PASSWORDLESS_SESSION_KEY) === 'true';
    if (isLocalPasswordlessSession && apiConfig.localPasswordlessLogin) {
      return await requestNewSession('/api/auth/local-passwordless-admin', {});
    }

    return false;
  })();
  sessionRenewalPromise = renewalPromise;

  try {
    return await renewalPromise;
  } finally {
    if (sessionRenewalPromise === renewalPromise) {
      sessionRenewalPromise = null;
    }
  }
}

async function request(method, path, { params = {}, body, retryAuth = true, signal } = {}) {
  if (apiConfig.vegaBridgeMode) {
    const allowedRead = method === 'GET' && (/^\/api\/vega-read\/(products|accounts)(\/[^?#]*)?$/.test(path) || path === '/health' || path === '/api/auth/me');
    const allowedAuth = method === 'POST' && ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].includes(path);
    if (!allowedRead && !allowedAuth) throw Object.assign(new Error('Bu işlem Vega salt-okunur bağlantısında kullanıma açık değil.'), { code: 'VEGA_READ_ONLY' });
  }
  if (apiConfig.demoMode) {
    if (signal?.aborted) throw new DOMException('İstek iptal edildi.', 'AbortError');
    if (method === 'GET') {
      const result = demoReadRequest(path, params);
      if (result) return result;
    }
    const demoError = new Error('Bu ekranın örnek demo verisi henüz hazırlanmadı.');
    demoError.code = 'DEMO_ROUTE_MISSING';
    demoError.meta = { method, path };
    throw demoError;
  }

  let response;

  try {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const accessToken = getStoredAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const deadline = apiConfig.vegaBridgeMode ? AbortSignal.timeout(60000) : undefined;
    const requestSignal = signal && deadline ? AbortSignal.any([signal, deadline]) : signal || deadline;
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      signal: requestSignal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.name === 'TimeoutError') throw Object.assign(new Error('Vega yanıtı gecikti. Bağlantıyı kontrol edip tekrar deneyin.'), { code: 'VEGA_TIMEOUT' });
    const networkError = new Error('Sunucuya bağlantı kurulamadı. Sunucu veya ağ bağlantısı geçici olarak kesilmiş olabilir. Biraz sonra tekrar deneyin.');
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  if (response.status === 401 && shouldRetryWithRenewedSession({ path, retryAuth })) {
    const renewed = await renewStoredSession();
    if (renewed) {
      return request(method, path, { params, body, retryAuth: false, signal });
    }
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.name === 'TimeoutError') throw Object.assign(new Error('Sunucu yanıtı gecikti. Tekrar deneyin.'), { code: 'API_TIMEOUT' });
    const parseError = new Error('API yanıtı okunamadı.');
    parseError.code = 'API_PARSE_ERROR';
    parseError.status = response.status;
    if (apiConfig.vegaBridgeMode) parseError.message = 'Bağlantı servisi beklenen yanıtı vermedi. Sunucu veya erişim kuralı kontrol edilmeli.';
    throw parseError;
  }

  if (!response.ok || payload?.success === false) {
    const apiError = new Error(payload?.error?.message || 'API isteği başarısız oldu.');
    apiError.code = payload?.error?.code || 'API_ERROR';
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

export async function get(path, params = {}, { signal } = {}) {
  return request('GET', path, { params, signal });
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
  if (apiConfig.vegaBridgeMode) throw Object.assign(new Error('Vega bağlantısında dosya indirme henüz açık değil.'), { code: 'VEGA_READ_ONLY' });
  if (apiConfig.demoMode) throw Object.assign(new Error('Bu dosya örnek veri setinde bulunmuyor.'), { code: 'DEMO_DATASET_UNAVAILABLE' });
  const headers = {};
  const accessToken = getStoredAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(buildUrl(path), { headers });
  } catch {
    const error = new Error('API sunucusuna ulaşılamadı.');
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
