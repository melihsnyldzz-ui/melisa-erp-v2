import { API_BASE_URL } from '../config/apiConfig.js';

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
  let response;

  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
    const apiError = new Error(payload.error?.message || 'API istegi basarisiz oldu.');
    apiError.code = payload.error?.code || 'API_ERROR';
    apiError.status = response.status;
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
