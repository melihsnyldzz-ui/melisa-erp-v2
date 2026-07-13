import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { EvolutionProvider } from './evolutionProvider.js';

const provider = new EvolutionProvider();

function normalize(message, extraData = {}) {
  return provider.normalizeWebhook({
    instance: 'melisa-test',
    event: 'messages.upsert',
    data: {
      key: message.key,
      pushName: message.pushName,
      messageType: message.messageType,
      message,
      ...extraData,
    },
  });
}

test('keeps normal conversation text unchanged', () => {
  const event = normalize({
    key: {
      id: 'text-1',
      remoteJid: '905551112233@s.whatsapp.net',
      fromMe: false,
    },
    message: {
      conversation: 'test',
    },
  });

  assert.equal(event.text, 'test');
  assert.equal(event.phone, '905551112233');
});

test('uses media captions before fallback previews', () => {
  const event = normalize({
    key: {
      id: 'image-caption-1',
      remoteJid: '905551112233@s.whatsapp.net',
      fromMe: false,
    },
    messageType: 'imageMessage',
    message: {
      imageMessage: {
        caption: 'urun gorseli',
      },
    },
  });

  assert.equal(event.text, 'urun gorseli');
});

test('creates safe previews for common non-text payloads', () => {
  const cases = [
    [{ imageMessage: {} }, '[Görsel]'],
    [{ videoMessage: {} }, '[Video]'],
    [{ audioMessage: { ptt: true } }, '[Ses]'],
    [{ documentMessage: { fileName: 'teklif.pdf' } }, '[Belge] teklif.pdf'],
    [{ stickerMessage: {} }, '[Çıkartma]'],
    [{ locationMessage: { degreesLatitude: 41.0, degreesLongitude: 29.0 } }, '[Konum]'],
    [{ contactMessage: { displayName: 'Ayse Musteri' } }, '[Kişi] Ayse Musteri'],
  ];

  for (const [messageBody, expected] of cases) {
    const event = normalize({
      key: {
        id: `case-${expected}`,
        remoteJid: '905551112233@s.whatsapp.net',
        fromMe: false,
      },
      message: messageBody,
    });

    assert.equal(event.text, expected);
  }
});

test('prefixes group previews with sender name when available', () => {
  const event = normalize({
    key: {
      id: 'group-image-1',
      remoteJid: '120363000000000000@g.us',
      participant: '905559998877@s.whatsapp.net',
      fromMe: false,
    },
    pushName: 'Ali',
    messageType: 'imageMessage',
    message: {
      imageMessage: {},
    },
  });

  assert.equal(event.text, 'Ali: [Görsel]');
  assert.equal(event.phone, '120363000000000000');
});

test('unwraps nested Evolution message wrappers', () => {
  const event = normalize({
    key: {
      id: 'view-once-1',
      remoteJid: '905551112233@s.whatsapp.net',
      fromMe: false,
    },
    message: {
      viewOnceMessage: {
        message: {
          videoMessage: {},
        },
      },
    },
  });

  assert.equal(event.text, '[Video]');
});

test('falls back to message type when body is not expanded', () => {
  const event = normalize({
    key: {
      id: 'type-only-document-1',
      remoteJid: '905551112233@s.whatsapp.net',
      fromMe: false,
    },
    messageType: 'documentMessage',
    message: {},
  });

  assert.equal(event.text, '[Belge]');
});

test('sends text messages through Evolution sendText endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    apiUrl: env.evolution.apiUrl,
    apiKey: env.evolution.apiKey,
    instance: env.evolution.instance,
    timeoutMs: env.evolution.timeoutMs,
  };
  const calls = [];

  env.evolution.apiUrl = 'http://evolution.local';
  env.evolution.apiKey = 'test-key';
  env.evolution.instance = 'melisa-test';
  env.evolution.timeoutMs = 1000;
  globalThis.fetch = async (url, options) => {
    calls.push({
      url,
      headers: options.headers,
      body: JSON.parse(options.body),
    });

    return {
      ok: true,
      json: async () => ({ key: { id: 'evo-message-1' } }),
    };
  };

  try {
    const result = await provider.sendMessage({
      phone: '0555 111 22 33',
      text: 'Merhaba',
    });

    assert.equal(result.phone, '905551112233');
    assert.equal(result.providerMessageId, 'evo-message-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://evolution.local/message/sendText/melisa-test');
    assert.equal(calls[0].headers.apikey, 'test-key');
    assert.deepEqual(calls[0].body, {
      number: '905551112233',
      text: 'Merhaba',
      textMessage: {
        text: 'Merhaba',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(env.evolution, originalConfig);
  }
});

test('reports Evolution send failures without hiding provider errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    apiUrl: env.evolution.apiUrl,
    apiKey: env.evolution.apiKey,
    instance: env.evolution.instance,
    timeoutMs: env.evolution.timeoutMs,
  };

  env.evolution.apiUrl = 'http://evolution.local';
  env.evolution.apiKey = 'test-key';
  env.evolution.instance = 'melisa-test';
  env.evolution.timeoutMs = 1000;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'boom' }),
  });

  try {
    await assert.rejects(
      () => provider.sendMessage({ phone: '905551112233', text: 'Merhaba' }),
      (error) => {
        assert.equal(error.code, 'WHATSAPP_CRM_SEND_FAILED');
        assert.equal(error.statusCode, 502);
        assert.match(error.message, /boom/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(env.evolution, originalConfig);
  }
});
