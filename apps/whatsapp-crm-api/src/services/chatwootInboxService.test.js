import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { listChatwootInboxOverview } from './chatwootInboxService.js';

test('Chatwoot inbox is mapped to the safe CRM read model', async () => {
  const originalFetch = global.fetch;
  const originalChatwoot = {
    ...env.chatwoot,
    agentPersonnelMap: new Map(env.chatwoot.agentPersonnelMap),
  };
  const originalWhatsapp = { ...env.whatsapp };
  const calls = [];

  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.inboxId = 1;
  env.chatwoot.apiAccessToken = 'test-token';
  env.chatwoot.agentPersonnelMap = new Map([[7, 19]]);
  env.whatsapp.provider = 'evolution';
  env.whatsapp.sendEnabled = false;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith('/conversations?status=all&page=1')) {
      return new Response(JSON.stringify({
        data: {
          meta: { all_count: 1 },
          payload: [{
            id: 41,
            inbox_id: 1,
            status: 'open',
            unread_count: 2,
            last_activity_at: 1_720_000_000,
            labels: ['musteri'],
            custom_attributes: { melisa_stage: 'Teklif' },
            meta: {
              sender: { name: 'Test Musteri', phone_number: '+38640111222', identifier: '38640111222@s.whatsapp.net' },
              assignee: { id: 19, name: 'Ahmet' },
              team: { id: 3, name: 'Slovenya' },
            },
          }],
        },
      }), { status: 200 });
    }

    return new Response(JSON.stringify({
      payload: [{
        id: 90,
        content: 'Merhaba',
        message_type: 0,
        created_at: 1_720_000_000,
        status: 'sent',
        attachments: [],
      }, {
        id: 91,
        content: 'CRM notu: Fiyat bekliyor',
        message_type: 1,
        private: true,
        created_at: 1_720_000_100,
        content_attributes: { melisa_crm: { type: 'note', data: { note: 'Fiyat bekliyor' } } },
        attachments: [],
      }],
    }), { status: 200 });
  };

  try {
    const result = await listChatwootInboxOverview({ limit: 25, offset: 0 });
    assert.equal(result.summary.source, 'chatwoot-crm');
    assert.equal(result.conversations.length, 1);
    assert.equal(result.conversations[0].assignedUserId, 7);
    assert.equal(result.conversations[0].phoneIdentity.countryCode, 'SI');
    assert.equal(result.conversations[0].messages[0].direction, 'in');
    assert.equal(result.conversations[0].messages.length, 1);
    assert.equal(result.conversations[0].notes, 'Fiyat bekliyor');
    assert.equal(result.conversations[0].capabilities.assign, true);
    assert.equal(result.conversations[0].capabilities.send, false);
    assert.equal(result.conversations[0].capabilities.localWorkflow, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.headers.api_access_token, 'test-token');
  } finally {
    global.fetch = originalFetch;
    Object.assign(env.chatwoot, originalChatwoot);
    Object.assign(env.whatsapp, originalWhatsapp);
  }
});

test('Chatwoot inbox can return more than one internal 25-row page', async () => {
  const originalFetch = global.fetch;
  const originalChatwoot = { ...env.chatwoot };

  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.inboxId = 1;
  env.chatwoot.apiAccessToken = 'test-token';
  env.chatwoot.includeGroups = false;

  const conversations = Array.from({ length: 27 }, (_, index) => ({
    id: index + 1,
    inbox_id: 1,
    status: index >= 24 ? 'open' : 'resolved',
    meta: { sender: { phone_number: `+90530000${String(index).padStart(4, '0')}` } },
  }));

  global.fetch = async (url) => {
    const text = String(url);
    if (text.includes('/messages')) {
      return new Response(JSON.stringify({ payload: [] }), { status: 200 });
    }
    const page = Number(new URL(text).searchParams.get('page') || 1);
    const start = (page - 1) * 25;
    return new Response(JSON.stringify({
      data: {
        meta: { all_count: conversations.length },
        payload: conversations.slice(start, start + 25),
      },
    }), { status: 200 });
  };

  try {
    const result = await listChatwootInboxOverview({ limit: 50, offset: 0 });
    assert.equal(result.conversations.length, 27);
    assert.equal(result.pagination.total, 27);
    assert.equal(result.summary.open, 3);
  } finally {
    global.fetch = originalFetch;
    Object.assign(env.chatwoot, originalChatwoot);
  }
});

test('Chatwoot inbox enables send only after guarded live approval', async () => {
  const originalFetch = global.fetch;
  const originalChatwoot = { ...env.chatwoot };
  const originalWhatsapp = { ...env.whatsapp };

  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.inboxId = 1;
  env.chatwoot.apiAccessToken = 'test-token';
  env.whatsapp.provider = 'chatwoot';
  env.whatsapp.sendEnabled = true;
  env.whatsapp.testNumberOnly = false;
  env.whatsapp.liveSendApproved = true;

  global.fetch = async (url) => {
    if (String(url).includes('/messages')) {
      return new Response(JSON.stringify({ payload: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: {
        meta: { all_count: 1 },
        payload: [{ id: 51, inbox_id: 1, status: 'open', meta: { sender: { phone_number: '+905301112233' } } }],
      },
    }), { status: 200 });
  };

  try {
    const result = await listChatwootInboxOverview();
    assert.equal(result.capabilities.send, true);
    assert.equal(result.conversations[0].capabilities.send, true);
  } finally {
    global.fetch = originalFetch;
    Object.assign(env.chatwoot, originalChatwoot);
    Object.assign(env.whatsapp, originalWhatsapp);
  }
});

test('Chatwoot inbox ignores conversations from other inboxes', async () => {
  const originalFetch = global.fetch;
  const originalChatwoot = { ...env.chatwoot };
  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.inboxId = 9;
  env.chatwoot.apiAccessToken = 'test-token';

  global.fetch = async () => new Response(JSON.stringify({
    data: {
      meta: { all_count: 1 },
      payload: [{ id: 8, inbox_id: 3, meta: {}, messages: [] }],
    },
  }), { status: 200 });

  try {
    const result = await listChatwootInboxOverview();
    assert.equal(result.conversations.length, 0);
  } finally {
    global.fetch = originalFetch;
    Object.assign(env.chatwoot, originalChatwoot);
  }
});

test('Chatwoot customer inbox hides group conversations by default', async () => {
  const originalFetch = global.fetch;
  const originalChatwoot = { ...env.chatwoot };
  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.inboxId = 1;
  env.chatwoot.apiAccessToken = 'test-token';
  env.chatwoot.includeGroups = false;

  global.fetch = async (url) => {
    if (String(url).includes('/messages')) {
      return new Response(JSON.stringify({ payload: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: {
        meta: { all_count: 2 },
        payload: [
          { id: 1, inbox_id: 1, status: 'open', unread_count: 1, meta: { sender: { name: 'Satis Grubu (GROUP)', identifier: '120363@g.us' } } },
          { id: 2, inbox_id: 1, status: 'open', unread_count: 2, meta: { sender: { name: 'Musteri', phone_number: '+905301112233' } } },
        ],
      },
    }), { status: 200 });
  };

  try {
    const result = await listChatwootInboxOverview();
    assert.equal(result.conversations.length, 1);
    assert.equal(result.conversations[0].id, 2);
    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.unread, 2);
  } finally {
    global.fetch = originalFetch;
    Object.assign(env.chatwoot, originalChatwoot);
  }
});
