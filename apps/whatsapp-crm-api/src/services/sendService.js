import { env } from '../config/env.js';
import { getWhatsAppProvider } from '../providers/index.js';
import { persistOutboundMessage } from '../repositories/crmRepository.js';

function sendError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeConversationId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  return trimText(value);
}

function messageFromProviderResult(providerResult) {
  const sentAt = providerResult.sentAt || new Date().toISOString();

  return {
    id: providerResult.providerMessageId || `provider-${Date.now()}`,
    direction: 'out',
    type: providerResult.messageType || 'text',
    text: providerResult.text || '',
    imageUrl: '',
    mimeType: providerResult.media?.mimeType || '',
    fileName: providerResult.media?.fileName || '',
    time: new Date(sentAt).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    }),
    status: 'sent',
    received_at: sentAt,
  };
}

function normalizeSendMedia(media = {}) {
  if (!media || typeof media !== 'object') return null;

  const dataUrl = trimText(media.dataUrl);
  const mimeType = trimText(media.mimeType) || 'application/octet-stream';
  const mediaType = trimText(media.mediaType) || (mimeType.startsWith('image/') ? 'image' : 'document');
  const fileName = trimText(media.fileName) || (mediaType === 'image' ? 'image.jpg' : 'document.pdf');

  if (!dataUrl) return null;

  const isSupported = mimeType.startsWith('image/') || mimeType === 'application/pdf';

  if (!isSupported) {
    throw sendError('WHATSAPP_CRM_MEDIA_UNSUPPORTED', 'Sadece gorsel veya PDF dosyasi gonderilebilir.');
  }

  if (!dataUrl.startsWith('data:')) {
    throw sendError('WHATSAPP_CRM_MEDIA_INVALID', 'Dosya verisi gecersiz.');
  }

  if (dataUrl.length > 14_000_000) {
    throw sendError('WHATSAPP_CRM_MEDIA_TOO_LARGE', 'Dosya 10 MB sinirini asmamalidir.');
  }

  return {
    dataUrl,
    fileName,
    mediaType: mimeType.startsWith('image/') ? 'image' : mediaType,
    mimeType,
  };
}

function normalizePhone(value = '') {
  const digits = trimText(value).replace(/[^\d]/g, '');

  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  return digits;
}

function getUnsupportedTargetReason({ phone, remoteJid }) {
  const jid = trimText(remoteJid).toLowerCase();

  if (jid.endsWith('@g.us')) {
    return 'Bu sohbet grup kimligiyle geldi; grup gonderimi icin ayri destek gerekiyor.';
  }

  if (!jid.endsWith('@lid') && phone.length > 15) {
    return 'WhatsApp hedefi gercek telefon numarasi gibi gorunmuyor.';
  }

  return '';
}

function assertSendConfiguration(phone, conversationId) {
  if (!env.whatsapp.sendEnabled) {
    throw sendError(
      'WHATSAPP_CRM_SEND_DISABLED',
      'WhatsApp CRM gonderimi kapali. Acmak icin WHATSAPP_SEND_ENABLED=true gerekir.',
      403,
    );
  }

  if (!env.whatsapp.testNumberOnly && !env.whatsapp.liveSendApproved) {
    throw sendError(
      'WHATSAPP_CRM_LIVE_SEND_NOT_APPROVED',
      'Canli WhatsApp gonderimi icin acik insan onayi gerekir.',
      403,
    );
  }

  if (env.whatsapp.provider === 'evolution'
    && (!env.evolution.apiUrl || !env.evolution.apiKey || !env.evolution.instance)) {
    throw sendError('WHATSAPP_CRM_EVOLUTION_NOT_CONFIGURED', 'Evolution API ayarlari eksik', 503);
  }

  if (env.whatsapp.provider === 'chatwoot') {
    if (!env.chatwoot.baseUrl || !env.chatwoot.accountId || !env.chatwoot.apiAccessToken) {
      throw sendError('WHATSAPP_CRM_CHATWOOT_NOT_CONFIGURED', 'Chatwoot API ayarlari eksik', 503);
    }

    if (!/^\d+$/.test(conversationId)) {
      throw sendError(
        'WHATSAPP_CRM_CHATWOOT_CONVERSATION_REQUIRED',
        'Chatwoot gonderimi icin gecerli konusma kimligi zorunludur.',
        400,
      );
    }
  }

  if (env.whatsapp.testNumberOnly) {
    const allowedNumbers = env.whatsapp.allowedTestNumbers.map(normalizePhone).filter(Boolean);

    if (allowedNumbers.length < 1) {
      throw sendError(
        'WHATSAPP_CRM_SEND_ALLOWLIST_EMPTY',
        'Test modu acik ama WHATSAPP_ALLOWED_TEST_NUMBERS bos; gonderim fail-closed.',
        403,
      );
    }

    if (!allowedNumbers.includes(phone)) {
      throw sendError(
        'WHATSAPP_CRM_SEND_NUMBER_NOT_ALLOWED',
        'Bu telefon numarasi test gonderim listesinde degil.',
        403,
      );
    }
  }
}

export function getSendStatus() {
  return {
    provider: env.whatsapp.provider,
    sendEnabled: env.whatsapp.sendEnabled && (env.whatsapp.testNumberOnly || env.whatsapp.liveSendApproved),
    testNumberOnly: env.whatsapp.testNumberOnly,
    liveSendApproved: env.whatsapp.liveSendApproved,
    allowedTestNumberCount: env.whatsapp.allowedTestNumbers.length,
    evolutionConfigured: Boolean(env.evolution.apiUrl && env.evolution.apiKey && env.evolution.instance),
    chatwootConfigured: Boolean(env.chatwoot.baseUrl && env.chatwoot.accountId && env.chatwoot.apiAccessToken),
  };
}

export async function sendCrmTextMessage(payload = {}) {
  const phone = normalizePhone(payload.phone);
  const remoteJid = trimText(payload.remoteJid);
  const contactName = trimText(payload.contactName);
  const text = trimText(payload.text);
  const media = normalizeSendMedia(payload.media);
  const conversationId = normalizeConversationId(payload.conversationId);
  const instanceKey = trimText(payload.instanceKey);

  if (env.whatsapp.provider !== 'chatwoot' && phone.length < 10) {
    throw sendError('WHATSAPP_CRM_PHONE_INVALID', 'WhatsApp telefon numarasi gecersiz');
  }

  const unsupportedReason = getUnsupportedTargetReason({ phone, remoteJid });
  if (unsupportedReason) {
    throw sendError('WHATSAPP_CRM_SEND_TARGET_UNSUPPORTED', unsupportedReason);
  }

  if (!text && !media) {
    throw sendError('WHATSAPP_CRM_MESSAGE_REQUIRED', 'Gonderilecek mesaj bos olamaz');
  }

  if (text.length > 4000) {
    throw sendError('WHATSAPP_CRM_MESSAGE_TOO_LONG', 'WhatsApp mesaji 4000 karakterden uzun olamaz');
  }

  assertSendConfiguration(phone, conversationId);

  const provider = getWhatsAppProvider();
  const providerResult = await provider.sendMessage({
    phone,
    remoteJid,
    contactName,
    text,
    media,
    conversationId,
    instanceKey,
  });
  const usesExternalConversationId = /^\d+$/.test(conversationId);
  const persistedMessage = usesExternalConversationId
    ? messageFromProviderResult(providerResult)
    : await persistOutboundMessage({ conversationId, providerResult });

  return {
    phone,
    conversationId: conversationId || null,
    message: persistedMessage,
    providerMessageId: providerResult.providerMessageId,
    sentAt: providerResult.sentAt,
    sendStatus: getSendStatus(),
  };
}
