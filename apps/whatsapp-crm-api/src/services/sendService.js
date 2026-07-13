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

function assertSendConfiguration(phone) {
  if (!env.whatsapp.sendEnabled) {
    throw sendError(
      'WHATSAPP_CRM_SEND_DISABLED',
      'WhatsApp CRM gonderimi kapali. Acmak icin WHATSAPP_SEND_ENABLED=true gerekir.',
      403,
    );
  }

  if (!env.evolution.apiUrl || !env.evolution.apiKey || !env.evolution.instance) {
    throw sendError('WHATSAPP_CRM_EVOLUTION_NOT_CONFIGURED', 'Evolution API ayarlari eksik', 503);
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
    sendEnabled: env.whatsapp.sendEnabled,
    testNumberOnly: env.whatsapp.testNumberOnly,
    allowedTestNumberCount: env.whatsapp.allowedTestNumbers.length,
    evolutionConfigured: Boolean(env.evolution.apiUrl && env.evolution.apiKey && env.evolution.instance),
  };
}

export async function sendCrmTextMessage(payload = {}) {
  const phone = normalizePhone(payload.phone);
  const remoteJid = trimText(payload.remoteJid);
  const text = trimText(payload.text);
  const conversationId = trimText(payload.conversationId);

  if (phone.length < 10) {
    throw sendError('WHATSAPP_CRM_PHONE_INVALID', 'WhatsApp telefon numarasi gecersiz');
  }

  const unsupportedReason = getUnsupportedTargetReason({ phone, remoteJid });
  if (unsupportedReason) {
    throw sendError('WHATSAPP_CRM_SEND_TARGET_UNSUPPORTED', unsupportedReason);
  }

  if (!text) {
    throw sendError('WHATSAPP_CRM_MESSAGE_REQUIRED', 'Gonderilecek mesaj bos olamaz');
  }

  if (text.length > 4000) {
    throw sendError('WHATSAPP_CRM_MESSAGE_TOO_LONG', 'WhatsApp mesaji 4000 karakterden uzun olamaz');
  }

  assertSendConfiguration(phone);

  const provider = getWhatsAppProvider();
  const providerResult = await provider.sendMessage({ phone, remoteJid, text });
  const persistedMessage = await persistOutboundMessage({ conversationId, providerResult });

  return {
    phone,
    conversationId: conversationId || null,
    message: persistedMessage,
    providerMessageId: providerResult.providerMessageId,
    sentAt: providerResult.sentAt,
    sendStatus: getSendStatus(),
  };
}
