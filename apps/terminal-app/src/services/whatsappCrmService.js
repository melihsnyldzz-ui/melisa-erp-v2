import { getWhatsappCrmApiUrl } from '../config/env';

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function getErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback;
}

async function crmRequest(path, { method = 'GET', token, unlockToken, body, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(await getWhatsappCrmApiUrl(path), {
      method,
      headers: {
        ...defaultHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(unlockToken ? { 'X-CRM-Unlock-Token': unlockToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok || payload?.success === false) {
      const error = new Error(getErrorMessage(payload, 'WhatsApp CRM istegi basarisiz oldu'));
      error.status = response.status;
      error.code = payload?.error?.code || 'WHATSAPP_CRM_API_ERROR';
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('WhatsApp CRM zaman asimina ugradi');
      timeoutError.code = 'WHATSAPP_CRM_TIMEOUT';
      throw timeoutError;
    }

    if (error instanceof SyntaxError) {
      const parseError = new Error('WhatsApp CRM response okunamadi');
      parseError.code = 'WHATSAPP_CRM_PARSE_FAILED';
      throw parseError;
    }

    if (!error.code) {
      error.code = 'WHATSAPP_CRM_NETWORK_ERROR';
      error.message = 'WhatsApp CRM baglantisi kurulamadi';
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function unlockWhatsappCrmAccess({ token, password } = {}) {
  return crmRequest('/crm/access/unlock', {
    method: 'POST',
    token,
    body: { password },
  });
}

export async function getWhatsappCrmInbox({ token, unlockToken, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return crmRequest(`/crm/inbox${suffix}`, { token, unlockToken });
}

export async function getWhatsappCrmHealth({ token } = {}) {
  return crmRequest('/health', { token, timeoutMs: 5000 });
}

export async function getWhatsappCrmMessageMedia({ token, unlockToken, messageId }) {
  return crmRequest(`/crm/messages/${messageId}/media`, {
    token,
    unlockToken,
    timeoutMs: 20000,
  });
}

export async function sendWhatsappCrmText({ token, unlockToken, conversation, text }) {
  return crmRequest('/crm/messages/send', {
    method: 'POST',
    token,
    unlockToken,
    body: {
      conversationId: conversation?.id,
      phone: conversation?.phone,
      remoteJid: conversation?.remoteJid,
      contactName: conversation?.contactName,
      text,
    },
    timeoutMs: 20000,
  });
}

export async function assignWhatsappCrmConversation({ token, unlockToken, conversationId }) {
  return crmRequest(`/crm/conversations/${conversationId}/assignment`, {
    method: 'PATCH',
    token,
    unlockToken,
  });
}
