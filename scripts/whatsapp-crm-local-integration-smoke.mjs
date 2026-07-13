const baseUrl = (process.env.WHATSAPP_CRM_SMOKE_BASE_URL || 'http://127.0.0.1:4200').replace(/\/+$/, '');
const webhookSecret = process.env.WHATSAPP_CRM_SMOKE_WEBHOOK_SECRET || process.env.WHATSAPP_CRM_WEBHOOK_SECRET || '';
const accessToken = process.env.WHATSAPP_CRM_SMOKE_ACCESS_TOKEN || '';

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required for local WhatsApp CRM smoke`);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error?.message || `Request failed: ${response.status}`);
    error.code = payload?.error?.code || 'WHATSAPP_CRM_LOCAL_SMOKE_FAILED';
    error.status = response.status;
    throw error;
  }

  return payload;
}

requireEnv('WHATSAPP_CRM_SMOKE_WEBHOOK_SECRET', webhookSecret);
requireEnv('WHATSAPP_CRM_SMOKE_ACCESS_TOKEN', accessToken);

const eventSuffix = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const messageId = `LOCAL-SMOKE-${eventSuffix}`;

const webhookPayload = {
  event: 'messages.upsert',
  instance: 'melisa-test',
  data: {
    pushName: 'Local Smoke Musteri',
    message: {
      key: {
        remoteJid: '905559990000@s.whatsapp.net',
        id: messageId,
        fromMe: false,
      },
      message: {
        conversation: 'Local smoke: katalog ve fiyat listesi talebi.',
      },
    },
  },
};

const health = await requestJson(`${baseUrl}/health`);
const firstWebhook = await requestJson(`${baseUrl}/webhooks/evolution`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-melisa-webhook-secret': webhookSecret,
  },
  body: JSON.stringify(webhookPayload),
});
const duplicateWebhook = await requestJson(`${baseUrl}/webhooks/evolution`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-melisa-webhook-secret': webhookSecret,
  },
  body: JSON.stringify(webhookPayload),
});
const inbox = await requestJson(`${baseUrl}/crm/inbox?limit=10`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const summary = {
  health: health.data?.status,
  postgres: health.data?.postgres?.backend,
  firstWebhookDuplicate: firstWebhook.data?.duplicate,
  secondWebhookDuplicate: duplicateWebhook.data?.duplicate,
  inboxSource: inbox.meta?.source,
  conversationCount: inbox.data?.conversations?.length || 0,
  unread: inbox.data?.summary?.unread || 0,
};

if (summary.firstWebhookDuplicate !== false) {
  throw new Error('First webhook should not be duplicate');
}

if (summary.secondWebhookDuplicate !== true) {
  throw new Error('Second webhook should be duplicate');
}

if (summary.inboxSource !== 'postgres') {
  throw new Error(`Inbox source should be postgres, got ${summary.inboxSource}`);
}

if (summary.conversationCount < 1) {
  throw new Error('Inbox should contain at least one persisted conversation');
}

console.log(JSON.stringify(summary, null, 2));
