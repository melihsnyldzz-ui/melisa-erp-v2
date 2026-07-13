import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { sendCrmTextMessage } from './sendService.js';

function captureSendConfig() {
  return {
    sendEnabled: env.whatsapp.sendEnabled,
    testNumberOnly: env.whatsapp.testNumberOnly,
    allowedTestNumbers: [...env.whatsapp.allowedTestNumbers],
    apiUrl: env.evolution.apiUrl,
    apiKey: env.evolution.apiKey,
    instance: env.evolution.instance,
  };
}

function restoreSendConfig(config) {
  env.whatsapp.sendEnabled = config.sendEnabled;
  env.whatsapp.testNumberOnly = config.testNumberOnly;
  env.whatsapp.allowedTestNumbers = [...config.allowedTestNumbers];
  env.evolution.apiUrl = config.apiUrl;
  env.evolution.apiKey = config.apiKey;
  env.evolution.instance = config.instance;
}

test('fails closed when CRM sending is disabled', async () => {
  const config = captureSendConfig();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  env.whatsapp.sendEnabled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  try {
    await assert.rejects(
      () => sendCrmTextMessage({ phone: '905551112233', text: 'Merhaba' }),
      (error) => {
        assert.equal(error.code, 'WHATSAPP_CRM_SEND_DISABLED');
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreSendConfig(config);
  }
});

test('fails closed when test mode has no allowed numbers', async () => {
  const config = captureSendConfig();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  env.whatsapp.sendEnabled = true;
  env.whatsapp.testNumberOnly = true;
  env.whatsapp.allowedTestNumbers = [];
  env.evolution.apiUrl = 'http://evolution.local';
  env.evolution.apiKey = 'test-key';
  env.evolution.instance = 'melisa-test';
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  try {
    await assert.rejects(
      () => sendCrmTextMessage({ phone: '905551112233', text: 'Merhaba' }),
      (error) => {
        assert.equal(error.code, 'WHATSAPP_CRM_SEND_ALLOWLIST_EMPTY');
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreSendConfig(config);
  }
});
