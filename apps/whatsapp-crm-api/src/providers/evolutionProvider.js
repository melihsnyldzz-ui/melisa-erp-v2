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
  return payload.data?.message
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
    .replace(/@c\.us$/i, '')
    .replace(/[^\d+]/g, '');
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

    const text = message.message?.conversation
      || message.message?.extendedTextMessage?.text
      || message.text
      || payload.data?.text
      || '';

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
