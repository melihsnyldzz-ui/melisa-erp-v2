import { getStoredAccessToken } from './apiClient.js';

const WHATSAPP_CRM_API_BASE_URL = (
  import.meta.env.VITE_WHATSAPP_CRM_API_BASE_URL
  || 'http://localhost:4200'
).replace(/\/+$/, '');

function buildCrmUrl(path, params = {}) {
  const url = new URL(path, WHATSAPP_CRM_API_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function crmRequest(method, path, { params = {}, body } = {}) {
  let response;

  try {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const accessToken = getStoredAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    response = await fetch(buildCrmUrl(path, params), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const networkError = new Error('WhatsApp CRM servisine ulasilamadi.');
    networkError.code = 'WHATSAPP_CRM_NETWORK_ERROR';
    throw networkError;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const parseError = new Error('WhatsApp CRM response okunamadi.');
    parseError.code = 'WHATSAPP_CRM_PARSE_ERROR';
    throw parseError;
  }

  if (!response.ok || payload.success === false) {
    const apiError = new Error(payload.error?.message || 'WhatsApp CRM istegi basarisiz oldu.');
    apiError.code = payload.error?.code || 'WHATSAPP_CRM_API_ERROR';
    apiError.status = response.status;
    apiError.meta = payload.meta || {};
    throw apiError;
  }

  return payload;
}

export async function getWhatsappCrmHealth() {
  return crmRequest('GET', '/health');
}

export async function getWhatsappCrmInbox() {
  return crmRequest('GET', '/crm/inbox');
}

export const whatsappCrmConfig = {
  baseUrl: WHATSAPP_CRM_API_BASE_URL,
};
