import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireTerminalSaleIdempotencyLock,
  assertNoLegacyTerminalSale,
  assertTerminalSaleIdempotencySchema,
  assertTerminalSaleLedgerReplay,
  assertTerminalSaleReplayInvoice,
  buildTerminalSaleDescription,
  buildTerminalSaleLedgerPayload,
  createTerminalSaleRequestFingerprint,
  findLegacyTerminalSale,
  insertTerminalSaleLedger,
  markTerminalSaleLedgerSynced,
  normalizeTerminalClientEventId,
  readTerminalSaleLedger,
  readTerminalSaleRequestFingerprint,
  terminalSaleEventMarker,
} from './terminalSaleIdempotency.js';

function basePayload() {
  return {
    clientEventId: 'TERM-01-1720000000000-12345',
    terminalCode: 'TERM-01',
    customerId: 17,
    documentNumber: 'TS-100',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    note: 'Terminal satis',
    items: [
      { productId: 4, barcode: '869000000004', quantity: 2, unitPrice: 125.5, currency: 'TRY' },
      { productId: 8, barcode: '869000000008', quantity: 1, unitPrice: 75, currency: 'TRY' },
    ],
  };
}

function baseResult() {
  return {
    ok: true,
    duplicate: false,
    invoiceId: 44,
    documentNumber: 'TS-100',
    status: 'finalized',
    stockEffects: [
      { productId: 4, quantity: 2, effect: -2 },
      { productId: 8, quantity: 1, effect: -1 },
    ],
    customerEffect: { customerId: 17, amount: 326, currency: 'TRY' },
    terminal: { id: 3, code: 'TERM-01', name: 'Kasa 1' },
    employee: { id: 12, code: 'EMP-12', name: 'Test Personeli' },
  };
}

function makeRequest({ recordsets = [], rowsAffected = [1] } = {}) {
  const state = { inputs: [], statements: [] };
  let queryIndex = 0;
  const request = {
    input(name, type, value) {
      state.inputs.push({ name, type, value });
      return request;
    },
    async query(statement) {
      state.statements.push(statement);
      const recordset = recordsets[Math.min(queryIndex, Math.max(0, recordsets.length - 1))] || [];
      queryIndex += 1;
      return { recordset, rowsAffected };
    },
  };
  return { request, state };
}

test('clientEventId is trimmed, bounded and rejects control characters', () => {
  assert.equal(normalizeTerminalClientEventId('  TERM-01-123  '), 'TERM-01-123');
  assert.throws(() => normalizeTerminalClientEventId(''), { code: 'TERMINAL_CLIENT_EVENT_ID_REQUIRED' });
  assert.throws(() => normalizeTerminalClientEventId('x'.repeat(121)), {
    code: 'TERMINAL_CLIENT_EVENT_ID_INVALID',
  });
  assert.throws(() => normalizeTerminalClientEventId('TERM\n01'), {
    code: 'TERMINAL_CLIENT_EVENT_ID_INVALID',
  });
});

test('same normalized request produces the same opaque fingerprint', () => {
  const first = createTerminalSaleRequestFingerprint(basePayload(), 9);
  const reorderedObject = {
    items: basePayload().items.map((item) => ({ ...item })),
    note: 'Terminal satis',
    exchangeRate: 1,
    documentCurrency: 'TRY',
    documentNumber: 'TS-100',
    customerId: 17,
    terminalCode: 'TERM-01',
    clientEventId: 'TERM-01-1720000000000-12345',
  };
  const second = createTerminalSaleRequestFingerprint(reorderedObject, 9);

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('every commercial request dimension and actor ownership changes the fingerprint', () => {
  const payload = basePayload();
  const original = createTerminalSaleRequestFingerprint(payload, 9);
  const variants = [
    { ...payload, clientEventId: 'TERM-01-other' },
    { ...payload, terminalCode: 'TERM-02' },
    { ...payload, customerId: 18 },
    { ...payload, documentNumber: 'TS-101' },
    { ...payload, documentCurrency: 'USD' },
    { ...payload, exchangeRate: 40 },
    { ...payload, note: 'Changed' },
    { ...payload, items: payload.items.map((item, index) => index ? item : { ...item, productId: 5 }) },
    { ...payload, items: payload.items.map((item, index) => index ? item : { ...item, barcode: 'changed' }) },
    { ...payload, items: payload.items.map((item, index) => index ? item : { ...item, quantity: 3 }) },
    { ...payload, items: payload.items.map((item, index) => index ? item : { ...item, unitPrice: 126 }) },
    { ...payload, items: payload.items.map((item, index) => index ? item : { ...item, currency: 'USD' }) },
    { ...payload, items: [...payload.items].reverse() },
  ];

  for (const variant of variants) {
    assert.notEqual(createTerminalSaleRequestFingerprint(variant, 9), original);
  }
  assert.notEqual(createTerminalSaleRequestFingerprint(payload, 10), original);
});

test('description keeps fixed event and request markers before a long user note', () => {
  const payload = basePayload();
  const fingerprint = createTerminalSaleRequestFingerprint(payload, 9);
  const description = buildTerminalSaleDescription({
    ...payload,
    requestFingerprint: fingerprint,
    note: 'n'.repeat(1000),
  });

  assert.equal(description.length, 500);
  assert.equal(description.startsWith(terminalSaleEventMarker(payload.clientEventId)), true);
  assert.equal(readTerminalSaleRequestFingerprint(description), fingerprint);
  assert.doesNotMatch(description, /terminalClientEventId:/);
});

test('ledger replay accepts only same owner, fingerprint, synced state and finalized target id', () => {
  const fingerprint = createTerminalSaleRequestFingerprint(basePayload(), 9);
  const ledger = {
    eventType: 'invoice_created',
    terminalDeviceId: 3,
    userId: 9,
    payloadJson: buildTerminalSaleLedgerPayload(fingerprint, baseResult()),
    status: 'synced',
    targetEntity: 'sales_invoice',
    targetEntityId: 44,
  };

  assert.deepEqual(
    assertTerminalSaleLedgerReplay(ledger, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { invoiceId: 44, resultSnapshot: baseResult() },
  );
});

test('ledger replay fails closed for owner, payload and state mismatches', () => {
  const fingerprint = createTerminalSaleRequestFingerprint(basePayload(), 9);
  const ledger = {
    eventType: 'invoice_created',
    terminalDeviceId: 3,
    userId: 9,
    payloadJson: buildTerminalSaleLedgerPayload(fingerprint, baseResult()),
    status: 'synced',
    targetEntity: 'sales_invoice',
    targetEntityId: 44,
  };

  assert.throws(
    () => assertTerminalSaleLedgerReplay(ledger, { requestFingerprint: fingerprint, actorUserId: 10 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_OWNER_MISMATCH', statusCode: 403 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay(ledger, { requestFingerprint: 'a'.repeat(64), actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT', statusCode: 409 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay({ ...ledger, payloadJson: '{bad' }, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay({ ...ledger, status: 'processing' }, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay({ ...ledger, eventType: 'inventory_count' }, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay({ ...ledger, terminalDeviceId: null }, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
  );
  assert.throws(
    () => assertTerminalSaleLedgerReplay({
      ...ledger,
      payloadJson: buildTerminalSaleLedgerPayload(fingerprint),
    }, { requestFingerprint: fingerprint, actorUserId: 9 }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
  );
});

test('replay target must match ledger id, device and request fingerprint', () => {
  const payload = basePayload();
  const fingerprint = createTerminalSaleRequestFingerprint(payload, 9);
  const ledger = { targetEntityId: 44, terminalDeviceId: 3 };
  const invoice = {
    id: 44,
    status: 'FINALIZED',
    terminalDeviceId: 3,
    description: buildTerminalSaleDescription({ ...payload, requestFingerprint: fingerprint }),
  };

  assert.equal(
    assertTerminalSaleReplayInvoice(invoice, { ledger, requestFingerprint: fingerprint }),
    invoice,
  );

  for (const mismatch of [
    { ...invoice, id: 45 },
    { ...invoice, status: 'DRAFT' },
    { ...invoice, terminalDeviceId: 4 },
    { ...invoice, description: terminalSaleEventMarker(payload.clientEventId) },
  ]) {
    assert.throws(
      () => assertTerminalSaleReplayInvoice(mismatch, { ledger, requestFingerprint: fingerprint }),
      { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID', statusCode: 409 },
    );
  }
});

test('schema guard checks the durable ledger and a single-column unique client key', async () => {
  const { request, state } = makeRequest({ recordsets: [[{ is_ready: 1 }]] });
  await assertTerminalSaleIdempotencySchema(request);

  assert.match(state.statements[0], /OBJECT_ID\(N'dbo\.terminal_sync_queue'/);
  assert.match(state.statements[0], /i\.is_unique = 1/);
  assert.match(state.statements[0], /i\.is_disabled = 0/);
  assert.match(state.statements[0], /i\.is_hypothetical = 0/);
  assert.match(state.statements[0], /i\.has_filter = 0/);
  assert.match(state.statements[0], /c\.name = N'client_request_id'/);
  assert.match(state.statements[0], /key_column\.is_nullable = 0/);
  assert.match(state.statements[0], /TYPE_NAME\(key_column\.system_type_id\) = N'nvarchar'/);
  assert.match(state.statements[0], /key_column\.max_length = 240/);
  assert.match(state.statements[0], /device_column\.is_nullable = 0/);
  assert.match(state.statements[0], /TYPE_NAME\(device_column\.system_type_id\) = N'bigint'/);

  const missing = makeRequest({ recordsets: [[{ is_ready: 0 }]] });
  await assert.rejects(assertTerminalSaleIdempotencySchema(missing.request), {
    code: 'TERMINAL_SALE_IDEMPOTENCY_SCHEMA_MISSING',
    statusCode: 503,
  });
});

test('application lock is exclusive, transaction-owned, bounded and fails closed', async () => {
  const immediate = makeRequest({ recordsets: [[{ lock_result: 0 }]] });
  await acquireTerminalSaleIdempotencyLock(immediate.request, basePayload().clientEventId);
  const waited = makeRequest({ recordsets: [[{ lock_result: 1 }]] });
  await acquireTerminalSaleIdempotencyLock(waited.request, 'invoice-event-1');
  const sameIdentity = makeRequest({ recordsets: [[{ lock_result: 0 }]] });
  await acquireTerminalSaleIdempotencyLock(sameIdentity.request, 'INVOICE-EVENT-1');

  assert.match(immediate.state.statements[0], /sys\.sp_getapplock/);
  assert.match(immediate.state.statements[0], /@LockMode = N'Exclusive'/);
  assert.match(immediate.state.statements[0], /@LockOwner = N'Transaction'/);
  assert.match(immediate.state.statements[0], /@LockTimeout = 5000/);
  assert.doesNotMatch(immediate.state.inputs[0].value, /TERM-01/);
  assert.equal(waited.state.inputs[0].value, sameIdentity.state.inputs[0].value);

  for (const lockResult of [-1, -2, -3]) {
    const blocked = makeRequest({ recordsets: [[{ lock_result: lockResult }]] });
    await assert.rejects(
      acquireTerminalSaleIdempotencyLock(blocked.request, basePayload().clientEventId),
      { code: 'TERMINAL_SALE_IDEMPOTENCY_BUSY', statusCode: 503 },
    );
  }

  for (const recordsets of [[[ { lock_result: -999 } ]], [[]]]) {
    const failed = makeRequest({ recordsets });
    await assert.rejects(
      acquireTerminalSaleIdempotencyLock(failed.request, basePayload().clientEventId),
      { code: 'TERMINAL_SALE_IDEMPOTENCY_LOCK_FAILED', statusCode: 503 },
    );
  }
});

test('ledger lookup uses an exact locked client_request_id comparison and never LIKE', async () => {
  const { request, state } = makeRequest({ recordsets: [[{ id: 4 }]] });
  const ledger = await readTerminalSaleLedger(request, basePayload().clientEventId);

  assert.equal(ledger.id, 4);
  assert.match(state.statements[0], /WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.match(state.statements[0], /event_type AS eventType/);
  assert.match(state.statements[0], /client_request_id = @terminalSaleClientEventId/);
  assert.doesNotMatch(state.statements[0], /LIKE/i);
});

test('legacy lookup uses exact marker or exact audit JSON rather than wildcard matching', async () => {
  const { request, state } = makeRequest({ recordsets: [[{ id: 7 }]] });
  const existing = await findLegacyTerminalSale(request, basePayload().clientEventId);

  assert.equal(existing.id, 7);
  assert.match(state.statements[0], /RIGHT\(COALESCE\(si\.description/);
  assert.match(state.statements[0], /\$\.clientEventId/);
  assert.doesNotMatch(state.statements[0], /LIKE/i);
});

test('legacy records never produce an unverified success replay', () => {
  assert.doesNotThrow(() => assertNoLegacyTerminalSale(null));
  assert.throws(() => assertNoLegacyTerminalSale({ id: 7, status: 'finalized' }), {
    code: 'TERMINAL_SALE_IDEMPOTENCY_LEGACY_UNVERIFIED',
    statusCode: 409,
  });
});

test('ledger reservation stores only versioned fingerprint metadata and processing state', async () => {
  const fingerprint = createTerminalSaleRequestFingerprint(basePayload(), 9);
  const { request, state } = makeRequest({ recordsets: [[{ ledgerId: 91 }]] });
  const ledgerId = await insertTerminalSaleLedger(request, {
    clientEventId: basePayload().clientEventId,
    terminalDeviceId: 3,
    actorUserId: 9,
    requestFingerprint: fingerprint,
  });

  assert.equal(ledgerId, 91);
  assert.match(state.statements[0], /INSERT INTO dbo\.terminal_sync_queue/);
  assert.match(state.statements[0], /N'processing'/);
  const payloadJson = state.inputs.find((input) => input.name === 'terminalLedgerPayloadJson').value;
  assert.deepEqual(JSON.parse(payloadJson), {
    version: 1,
    purpose: 'melisa-erp-v2:terminal-sale:v1',
    requestFingerprint: fingerprint,
  });
  assert.doesNotMatch(payloadJson, /Terminal satis|125\.5|869000000004/);
});

test('ledger completion requires one processing row and pins the finalized invoice', async () => {
  const success = makeRequest({ rowsAffected: [1] });
  const fingerprint = createTerminalSaleRequestFingerprint(basePayload(), 9);
  await markTerminalSaleLedgerSynced(success.request, {
    ledgerId: 91,
    invoiceId: 44,
    requestFingerprint: fingerprint,
    resultSnapshot: baseResult(),
  });
  assert.match(success.state.statements[0], /status = N'synced'/);
  assert.match(success.state.statements[0], /payload_json = @terminalLedgerCompletedPayloadJson/);
  assert.match(success.state.statements[0], /target_entity_id = @terminalLedgerInvoiceId/);
  assert.match(success.state.statements[0], /AND status = N'processing'/);
  const completedPayload = JSON.parse(
    success.state.inputs.find((input) => input.name === 'terminalLedgerCompletedPayloadJson').value,
  );
  assert.equal(completedPayload.requestFingerprint, fingerprint);
  assert.deepEqual(completedPayload.resultSnapshot, baseResult());

  const changed = makeRequest({ rowsAffected: [0] });
  await assert.rejects(
    markTerminalSaleLedgerSynced(changed.request, {
      ledgerId: 91,
      invoiceId: 44,
      requestFingerprint: fingerprint,
      resultSnapshot: baseResult(),
    }),
    { code: 'TERMINAL_SALE_IDEMPOTENCY_STATE_CHANGED', statusCode: 503 },
  );
});
