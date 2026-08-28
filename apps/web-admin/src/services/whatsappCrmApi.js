import { clearAuthTokens, getStoredAccessToken, renewStoredSession } from './apiClient.js';

const WHATSAPP_CRM_API_BASE_URL = (
  import.meta.env.VITE_WHATSAPP_CRM_API_BASE_URL
  || 'http://localhost:4200'
).replace(/\/+$/, '');
const CRM_UNLOCK_TOKEN_KEY = 'melisa_whatsapp_crm_unlock_token';

export function getStoredWhatsappCrmUnlockToken() {
  return window.sessionStorage.getItem(CRM_UNLOCK_TOKEN_KEY) || '';
}

export function clearWhatsappCrmUnlockToken() {
  window.sessionStorage.removeItem(CRM_UNLOCK_TOKEN_KEY);
}

function buildCrmUrl(path, params = {}) {
  const url = new URL(path, WHATSAPP_CRM_API_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function crmRequest(method, path, { params = {}, body, retryAuth = true } = {}) {
  let response;

  try {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const accessToken = getStoredAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const crmUnlockToken = getStoredWhatsappCrmUnlockToken();
    if (crmUnlockToken && path !== '/crm/access/unlock') {
      headers['X-CRM-Unlock-Token'] = crmUnlockToken;
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

  if (response.status === 401 && retryAuth) {
    const renewed = await renewStoredSession();
    if (renewed) {
      return crmRequest(method, path, { params, body, retryAuth: false });
    }
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

    if (response.status === 401) {
      clearAuthTokens();
      window.dispatchEvent(new CustomEvent('melisa-auth-expired'));
    }

    if (response.status === 423) {
      clearWhatsappCrmUnlockToken();
      window.dispatchEvent(new CustomEvent('melisa-crm-locked'));
    }

    throw apiError;
  }

  return payload;
}

export async function unlockWhatsappCrmAccess(password) {
  const payload = await crmRequest('POST', '/crm/access/unlock', { body: { password } });
  const unlockToken = payload?.data?.unlockToken || '';
  if (!unlockToken) {
    const error = new Error('CRM kilit anahtari alinamadi.');
    error.code = 'WHATSAPP_CRM_ACCESS_TOKEN_MISSING';
    throw error;
  }
  window.sessionStorage.setItem(CRM_UNLOCK_TOKEN_KEY, unlockToken);
  return payload;
}

export async function getWhatsappCrmHealth() {
  return crmRequest('GET', '/health');
}

export async function getWhatsappCrmInbox({ limit = 50, offset = 0 } = {}) {
  return crmRequest('GET', '/crm/inbox', { params: { limit, offset } });
}

export async function getWhatsappCrmChatwootPersonnelMap() {
  return crmRequest('GET', '/crm/integrations/chatwoot/personnel-map');
}

export async function sendWhatsappCrmMessage(payload) {
  return crmRequest('POST', '/crm/messages/send', { body: payload });
}

export async function getWhatsappCrmMessageMedia(messageId) {
  return crmRequest('GET', `/crm/messages/${messageId}/media`);
}

export async function updateWhatsappCrmContactPhone(conversationId, phone) {
  return crmRequest('PUT', `/crm/conversations/${conversationId}/contact-phone`, { body: { phone } });
}

export async function assignWhatsappCrmConversation(conversationId, assigneeUserId = null) {
  return crmRequest('PATCH', `/crm/conversations/${conversationId}/assignment`, {
    body: assigneeUserId ? { assigneeUserId } : {},
  });
}

export async function markWhatsappCrmConversationRead(conversationId) {
  return crmRequest('PATCH', `/crm/conversations/${conversationId}/read`, { body: {} });
}

export async function updateWhatsappCrmConversationStatus(conversationId, status) {
  return crmRequest('PATCH', `/crm/conversations/${conversationId}/status`, { body: { status } });
}

export async function updateWhatsappCrmConversationStage(conversationId, stage) {
  return crmRequest('PATCH', `/crm/conversations/${conversationId}/stage`, { body: { stage } });
}

export async function addWhatsappCrmConversationNote(conversationId, note) {
  return crmRequest('POST', `/crm/conversations/${conversationId}/notes`, { body: { note } });
}

export async function addWhatsappCrmConversationTag(conversationId, tag) {
  return crmRequest('POST', `/crm/conversations/${conversationId}/tags`, { body: { tag } });
}

export async function addWhatsappCrmConversationTask(conversationId, task) {
  return crmRequest('POST', `/crm/conversations/${conversationId}/tasks`, { body: task });
}

export async function addWhatsappCrmProductInterest(conversationId, product) {
  return crmRequest('POST', `/crm/conversations/${conversationId}/product-interests`, { body: { product } });
}

export async function createWhatsappCrmQuote(conversationId, payload) {
  return crmRequest('POST', `/crm/conversations/${conversationId}/quotes`, { body: payload });
}

export const whatsappCrmConfig = {
  baseUrl: WHATSAPP_CRM_API_BASE_URL,
};
