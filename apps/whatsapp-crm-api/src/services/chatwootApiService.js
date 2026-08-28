import { env } from '../config/env.js';

function chatwootError(code, message, statusCode = 502, meta = undefined) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (meta) error.meta = meta;
  return error;
}

export function isChatwootApiConfigured() {
  return Boolean(env.chatwoot.baseUrl && env.chatwoot.accountId && env.chatwoot.apiAccessToken);
}

export async function chatwootApiRequest(path, { method = 'GET', body } = {}) {
  if (!isChatwootApiConfigured()) {
    throw chatwootError(
      'WHATSAPP_CRM_CHATWOOT_NOT_CONFIGURED',
      'Chatwoot API baglantisi yapilandirilmamis.',
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.chatwoot.timeoutMs);
  const endpoint = `${env.chatwoot.baseUrl}/api/v1/accounts/${env.chatwoot.accountId}${path}`;

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        api_access_token: env.chatwoot.apiAccessToken,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      throw chatwootError(
        'WHATSAPP_CRM_CHATWOOT_READ_FAILED',
        payload?.message || payload?.error || 'Chatwoot verisi okunamadi.',
        response.status === 401 || response.status === 403 ? 503 : 502,
        { status: response.status },
      );
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw chatwootError('WHATSAPP_CRM_CHATWOOT_TIMEOUT', 'Chatwoot yanit vermedi.', 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
