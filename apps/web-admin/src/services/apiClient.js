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

export async function get(path, params = {}) {
  let response;

  try {
    response = await fetch(buildUrl(path, params));
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
