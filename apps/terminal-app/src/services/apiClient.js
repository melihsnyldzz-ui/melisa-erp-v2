import { getApiUrl } from '../config/env';

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function getErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback;
}

export async function apiRequest(path, { method = 'GET', token, body, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(await getApiUrl(path), {
      method,
      headers: {
        ...defaultHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

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
