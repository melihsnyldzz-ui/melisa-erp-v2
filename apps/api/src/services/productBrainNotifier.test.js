import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createProductBrainNotifier } from './productBrainNotifier.mjs';

const fixtureKey = 'ab'.repeat(32);

function notifierFixture(overrides = {}) {
  const requests = [];
  const warnings = [];
  const keys = [];
  let cancellations = 0;
  const notify = createProductBrainNotifier({
    environment: { PB_NOTIFIER_ENABLED: 'true', PB_EVENT_KEY_PATH: 'fixture-key-file' },
    readKeyFile: async (keyPath) => { keys.push(keyPath); return fixtureKey; },
    send: async (...request) => {
      requests.push(request);
      return { ok: true, body: { cancel: async () => { cancellations += 1; } } };
    },
    now: () => 1_800_000_000_000,
    eventId: () => 'fixture-event-id',
    warn: (message) => warnings.push(message),
    ...overrides,
  });
  return { notify, requests, warnings, keys, cancellations: () => cancellations };
}

test('notifier signs only source identity and returns before I/O', async () => {
  const f = notifierFixture();
  assert.equal(f.notify(42), undefined);
  assert.equal(f.keys.length, 0);
  assert.equal(f.requests.length, 0);
  await setImmediate();
  assert.deepEqual(f.keys, ['fixture-key-file']);
  assert.equal(f.requests.length, 1);
  const [url, options] = f.requests[0];
  assert.equal(url, 'http://127.0.0.1:4324/internal/media-changed');
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(JSON.parse(options.body), { eventId: 'fixture-event-id', sourceId: '42', kind: 'MEDIA_CHANGED' });
  const expectedSignature = createHmac('sha256', fixtureKey)
    .update(`POST\n/internal/media-changed\n1800000000000\n${options.body}`).digest('hex');
  assert.equal(options.headers['x-pb-signature'], expectedSignature);
  assert.equal(options.signal instanceof AbortSignal, true);
  assert.equal(f.cancellations(), 1);
  assert.deepEqual(f.warnings, []);
});

test('disabled notifier and invalid source identities do no I/O', async () => {
  const disabled = notifierFixture({ environment: {} });
  disabled.notify(42);
  const invalid = notifierFixture();
  for (const id of [null, undefined, '', 0, -1, 1.5, '01', '42/image', '1'.repeat(16)]) invalid.notify(id);
  await setImmediate();
  assert.equal(disabled.keys.length + invalid.keys.length, 0);
  assert.equal(disabled.requests.length + invalid.requests.length, 0);
});

for (const [name, overrides] of [
  ['missing key', { readKeyFile: async () => { throw new Error('fixture private path'); } }],
  ['invalid key', { readKeyFile: async () => 'invalid-fixture-key' }],
  ['connection refusal', { send: async () => { throw new Error('fixture private response'); } }],
  ['synchronous send failure', { send: () => { throw new Error('fixture private response'); } }],
  ['timeout', { send: async () => { throw new DOMException('timeout', 'TimeoutError'); } }],
  ['non-success status', { send: async () => ({ ok: false, body: { cancel: async () => {} } }) }],
]) {
  test(`${name} defers to reconciliation without leaking failure details`, async () => {
    const f = notifierFixture(overrides);
    assert.doesNotThrow(() => f.notify(42));
    await setImmediate();
    assert.deepEqual(f.warnings, ['PRODUCT_BRAIN_HINT_DEFERRED_TO_RECONCILIATION']);
  });
}
