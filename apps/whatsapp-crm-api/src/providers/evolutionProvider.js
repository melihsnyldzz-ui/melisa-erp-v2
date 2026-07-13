import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { WhatsAppProvider } from './whatsappProvider.js';

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload || {}))
    .digest('hex');
}

function getMessage(payload = {}) {
  return payload.data?.message?.key || payload.data?.message?.message
    ? payload.data?.message
    : payload.data
    || payload.data?.messages?.[0]
    || payload.message
    || payload.messages?.[0]
    || null;
}

function getRemoteJid(message = {}, payload = {}) {
  return message.key?.remoteJid
    || message.remoteJid
    || payload.data?.key?.remoteJid
    || payload.remoteJid
    || '';
}

function normalizePhone(remoteJid = '') {
  return String(remoteJid)
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/[^\d+]/g, '');
}

function unwrapMessageBody(body = {}) {
  const nestedMessage = body.ephemeralMessage?.message
    || body.viewOnceMessage?.message
    || body.viewOnceMessageV2?.message
    || body.documentWithCaptionMessage?.message
    || body.editedMessage?.message;

  return nestedMessage ? unwrapMessageBody(nestedMessage) : body;
}

function firstText(...values) {
  return values
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

function labeledPreview(label, detail) {
  const normalizedDetail = String(detail || '').trim();
  return normalizedDetail ? `${label} ${normalizedDetail}` : label;
}

function getGroupSender(message = {}, payload = {}) {
  return message.pushName
    || payload.data?.pushName
    || payload.pushName
    || normalizePhone(message.key?.participant || message.participant || payload.data?.participant || payload.participant)
    || '';
}

function withGroupSender(text, message = {}, payload = {}) {
  const remoteJid = getRemoteJid(message, payload);

  if (!String(remoteJid).endsWith('@g.us')) return text;

  const sender = getGroupSender(message, payload);
  return sender ? `${sender}: ${text}` : text;
}

function mediaPreview(body = {}, message = {}) {
  if (body.imageMessage) return '[Görsel]';
  if (body.videoMessage) return '[Video]';
  if (body.audioMessage) return '[Ses]';
  if (body.documentMessage) return labeledPreview('[Belge]', body.documentMessage.fileName);
  if (body.stickerMessage) return '[Çıkartma]';
  if (body.locationMessage || body.liveLocationMessage) return '[Konum]';
  if (body.contactMessage) return labeledPreview('[Kişi]', body.contactMessage.displayName);
  if (body.contactsArrayMessage) {
    return labeledPreview('[Kişi]', body.contactsArrayMessage.contacts?.[0]?.displayName);
  }

  switch (message.messageType || message.type || body.messageType) {
    case 'imageMessage':
      return '[Görsel]';
    case 'videoMessage':
      return '[Video]';
    case 'audioMessage':
      return '[Ses]';
    case 'documentMessage':
      return '[Belge]';
    case 'stickerMessage':
      return '[Çıkartma]';
    case 'locationMessage':
    case 'liveLocationMessage':
      return '[Konum]';
    case 'contactMessage':
    case 'contactsArrayMessage':
      return '[Kişi]';
    default:
      return '[Mesaj]';
  }
}

function getText(message = {}, payload = {}) {
  const body = unwrapMessageBody(message.message || message);
  const text = firstText(
    body.conversation,
    body.extendedTextMessage?.text,
    body.imageMessage?.caption,
    body.videoMessage?.caption,
    body.documentMessage?.caption,
    message.text,
    payload.data?.text,
  ) || mediaPreview(body, message);

  return withGroupSender(text, message, payload);
}

export class EvolutionProvider extends WhatsAppProvider {
  constructor() {
    super('evolution');
  }

  normalizeWebhook(payload = {}, headers = {}) {
    const message = getMessage(payload) || {};
    const eventType = payload.event || payload.type || payload.data?.event || 'unknown';
    const remoteJid = getRemoteJid(message, payload);
    const messageId = message.key?.id || message.id || payload.data?.id || payload.id || '';
    const eventId = headers['x-evolution-event-id']
      || headers['x-event-id']
      || payload.eventId
      || payload.data?.eventId
      || `${env.evolution.instance}:${eventType}:${messageId || hashPayload(payload)}`;

    const text = getText(message, payload);

    return {
      provider: this.providerName,
      instanceKey: payload.instance || payload.instanceName || env.evolution.instance,
      eventId,
      eventType,
      messageId,
      remoteJid,
      phone: normalizePhone(remoteJid),
      direction: message.key?.fromMe ? 'outbound' : 'inbound',
      text,
      rawPayload: payload,
      receivedAt: new Date().toISOString(),
    };
  }
}
