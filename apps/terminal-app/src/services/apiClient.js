import { getApiUrl } from '../config/env';

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

let activeAccessToken = '';

export function setApiAccessToken(accessToken) {
  activeAccessToken = String(accessToken || '');
}

export function clearApiAccessToken() {
  activeAccessToken = '';
}

function getErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback;
}

export async function apiRequest(path, {
  method = 'GET',
  token,
  body,
  timeoutMs = 12000,
  retryAuth = true,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestToken = activeAccessToken || token;
    const response = await fetch(await getApiUrl(path), {
      method,
      headers: {
        ...defaultHeaders,
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (response.status === 401 && retryAuth && requestToken && !path.startsWith('/auth/')) {
      const { renewStoredSession } = await import('./authService');
      const renewedSession = await renewStoredSession();
      setApiAccessToken(renewedSession.accessToken);
      return apiRequest(path, {
        method,
        token: renewedSession.accessToken,
        body,
        timeoutMs,
        retryAuth: false,
      });
    }

    if (!response.ok || payload?.success === false) {
      const error = new Error(getErrorMessage(payload, 'API istegi basarisiz oldu'));
      error.status = response.status;
      error.code = payload?.error?.code || 'API_ERROR';
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('API zaman asimina ugradi');
      timeoutError.code = 'API_TIMEOUT';
      throw timeoutError;
    }

    if (error instanceof SyntaxError) {
      const parseError = new Error('API response okunamadi');
      parseError.code = 'API_PARSE_FAILED';
      throw parseError;
    }

    if (!error.code) {
      error.code = 'NETWORK_ERROR';
      error.message = 'API baglantisi kurulamadi';
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingApi() {
  try {
    await apiRequest('/health', { timeoutMs: 5000 });
    return {
      online: true,
      message: 'API online',
    };
  } catch (error) {
    return {
      online: false,
      message: error.message || 'API offline',
      code: error.code || 'API_OFFLINE',
    };
  }
}
