import { createHash } from 'node:crypto';
import sql from 'mssql';

const FINGERPRINT_PURPOSE = 'melisa-erp-v2:terminal-sale:v1';
const LEDGER_PAYLOAD_VERSION = 1;
const CLIENT_EVENT_ID_MAX_LENGTH = 120;

function serviceError(code, message, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function normalizeTerminalClientEventId(value) {
  const clientEventId = typeof value === 'string' ? value.trim() : '';

  if (!clientEventId) {
    throw serviceError('TERMINAL_CLIENT_EVENT_ID_REQUIRED', 'clientEventId is required', 400);
  }

  if (
    clientEventId.length > CLIENT_EVENT_ID_MAX_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(clientEventId)
  ) {
    throw serviceError(
      'TERMINAL_CLIENT_EVENT_ID_INVALID',
      `clientEventId must be 1-${CLIENT_EVENT_ID_MAX_LENGTH} printable characters`,
      400,
    );
  }

  return clientEventId;
}

export function createTerminalSaleRequestFingerprint(payload, actorUserId) {
  const normalizedActorUserId = Number(actorUserId);
  if (!Number.isInteger(normalizedActorUserId) || normalizedActorUserId < 1) {
    throw serviceError(
      'TERMINAL_OPERATOR_REQUIRED',
      'Authenticated terminal personnel is required',
      401,
    );
  }

  const canonicalRequest = {
    purpose: FINGERPRINT_PURPOSE,
    actorUserId: normalizedActorUserId,
    clientEventId: payload.clientEventId,
    terminalCode: payload.terminalCode,
    customerId: payload.customerId,
    documentNumber: payload.documentNumber,
    documentCurrency: payload.documentCurrency,
    exchangeRate: payload.exchangeRate,
    note: payload.note,
    items: payload.items.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
    })),
  };

  return sha256(JSON.stringify(canonicalRequest));
}

export function terminalSaleEventMarker(clientEventId) {
  return `[terminal-event-sha256:${sha256(clientEventId)}]`;
}

export function terminalSaleRequestMarker(requestFingerprint) {
  return `[terminal-request-sha256:${requestFingerprint}]`;
}

export function buildTerminalSaleDescription({
  clientEventId,
  requestFingerprint,
  terminalCode,
  note,
}) {
  return [
    terminalSaleEventMarker(clientEventId),
    terminalSaleRequestMarker(requestFingerprint),
    `terminalCode:${terminalCode}`,
    typeof note === 'string' ? note.trim() : '',
  ].filter(Boolean).join(' | ').slice(0, 500);
}

export function readTerminalSaleRequestFingerprint(description) {
  const match = String(description || '').match(/\[terminal-request-sha256:([a-f0-9]{64})\]/u);
  return match?.[1] || null;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function finiteNumber(value, { min = Number.NEGATIVE_INFINITY } = {}) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : null;
}

function boundedText(value, maxLength) {
  const text = typeof value === 'string' ? value : '';
  return text.length <= maxLength ? text : null;
}

function normalizeResultIdentity(value) {
  if (!value) return null;
  const id = positiveInteger(value.id);
  const code = boundedText(value.code, 80);
  const name = boundedText(value.name, 250);
  return id && code !== null && name !== null ? { id, code, name } : null;
}

export function normalizeTerminalSaleResultSnapshot(result) {
  const invoiceId = positiveInteger(result?.invoiceId);
  const documentNumber = boundedText(result?.documentNumber, 80);
  const status = String(result?.status || '').toLowerCase();
  const customerId = positiveInteger(result?.customerEffect?.customerId);
  const customerAmount = finiteNumber(result?.customerEffect?.amount, { min: 0 });
  const customerCurrency = String(result?.customerEffect?.currency || '').toUpperCase();
  const terminal = normalizeResultIdentity(result?.terminal);
  const employee = normalizeResultIdentity(result?.employee);
  const stockEffects = Array.isArray(result?.stockEffects)
    ? result.stockEffects.map((effect) => {
      const productId = positiveInteger(effect?.productId);
      const quantity = finiteNumber(effect?.quantity, { min: 0 });
      const stockEffect = finiteNumber(effect?.effect);
      if (!productId || quantity === null || quantity <= 0 || stockEffect !== -quantity) return null;
      return { productId, quantity, effect: stockEffect };
    })
    : [];

  if (
    result?.ok !== true
    || !invoiceId
    || documentNumber === null
    || status !== 'finalized'
    || !customerId
    || customerAmount === null
    || !/^[A-Z]{3}$/u.test(customerCurrency)
    || !terminal
    || !employee
    || stockEffects.length < 1
    || stockEffects.some((effect) => !effect)
  ) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_RESULT_INVALID',
      'Terminal sale result cannot be stored safely',
      503,
    );
  }

  return {
    ok: true,
    duplicate: false,
    invoiceId,
    documentNumber,
    status,
    stockEffects,
    customerEffect: {
      customerId,
      amount: customerAmount,
      currency: customerCurrency,
    },
    terminal,
    employee,
  };
}

export function buildTerminalSaleLedgerPayload(requestFingerprint, resultSnapshot = null) {
  const payload = {
    version: LEDGER_PAYLOAD_VERSION,
    purpose: FINGERPRINT_PURPOSE,
    requestFingerprint,
  };
  if (resultSnapshot) {
    payload.resultSnapshot = normalizeTerminalSaleResultSnapshot(resultSnapshot);
  }
  return JSON.stringify(payload);
}

function parseTerminalSaleLedgerPayload(payloadJson) {
  try {
    const parsed = JSON.parse(String(payloadJson || ''));
    if (
      parsed?.version !== LEDGER_PAYLOAD_VERSION
      || parsed?.purpose !== FINGERPRINT_PURPOSE
      || !/^[a-f0-9]{64}$/u.test(String(parsed?.requestFingerprint || ''))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function assertTerminalSaleLedgerReplay(ledger, { requestFingerprint, actorUserId }) {
  if (!ledger) return null;

  if (!positiveInteger(ledger.terminalDeviceId)) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event device cannot be verified; manual review is required',
    );
  }

  if (Number(ledger.userId) !== Number(actorUserId)) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_OWNER_MISMATCH',
      'This terminal event belongs to another authenticated user',
      403,
    );
  }

  const storedPayload = parseTerminalSaleLedgerPayload(ledger.payloadJson);
  if (!storedPayload) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event ledger cannot be verified; manual review is required',
    );
  }

  if (storedPayload.requestFingerprint !== requestFingerprint) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_CONFLICT',
      'The same clientEventId was submitted with different sale data',
    );
  }

  if (
    String(ledger.eventType || '').toLowerCase() !== 'invoice_created'
    || String(ledger.status || '').toLowerCase() !== 'synced'
    || String(ledger.targetEntity || '').toLowerCase() !== 'sales_invoice'
    || !Number.isInteger(Number(ledger.targetEntityId))
    || Number(ledger.targetEntityId) < 1
  ) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event has an incomplete or unverifiable result; manual review is required',
    );
  }

  let resultSnapshot;
  try {
    resultSnapshot = normalizeTerminalSaleResultSnapshot(storedPayload.resultSnapshot);
  } catch {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event result snapshot cannot be verified; manual review is required',
    );
  }
  if (resultSnapshot.invoiceId !== Number(ledger.targetEntityId)) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event result does not match its target; manual review is required',
    );
  }

  return {
    invoiceId: Number(ledger.targetEntityId),
    resultSnapshot,
  };
}

export function assertTerminalSaleReplayInvoice(invoice, { ledger, requestFingerprint }) {
  if (
    !invoice
    || Number(invoice.id) !== Number(ledger?.targetEntityId)
    || String(invoice.status || '').toUpperCase() !== 'FINALIZED'
    || Number(invoice.terminalDeviceId) !== Number(ledger?.terminalDeviceId)
    || readTerminalSaleRequestFingerprint(invoice.description) !== requestFingerprint
  ) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
      'Terminal event target cannot be verified against its ledger; manual review is required',
    );
  }

  return invoice;
}

export async function assertTerminalSaleIdempotencySchema(request) {
  const result = await request.query(`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.terminal_sync_queue', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'terminal_device_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'user_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'event_type') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'client_request_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'payload_json') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'status') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'retry_count') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'last_error') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'target_entity') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'target_entity_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_sync_queue', N'processed_at') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM sys.columns key_column
         WHERE key_column.object_id = OBJECT_ID(N'dbo.terminal_sync_queue')
           AND key_column.name = N'client_request_id'
           AND key_column.is_nullable = 0
           AND TYPE_NAME(key_column.system_type_id) = N'nvarchar'
           AND key_column.max_length = 240
       )
       AND EXISTS (
         SELECT 1
         FROM sys.columns device_column
         WHERE device_column.object_id = OBJECT_ID(N'dbo.terminal_sync_queue')
           AND device_column.name = N'terminal_device_id'
           AND device_column.is_nullable = 0
           AND TYPE_NAME(device_column.system_type_id) = N'bigint'
       )
       AND EXISTS (
         SELECT 1
         FROM sys.indexes i
         INNER JOIN sys.index_columns ic
           ON ic.object_id = i.object_id
          AND ic.index_id = i.index_id
         INNER JOIN sys.columns c
           ON c.object_id = ic.object_id
          AND c.column_id = ic.column_id
         WHERE i.object_id = OBJECT_ID(N'dbo.terminal_sync_queue')
           AND i.is_unique = 1
           AND i.is_disabled = 0
           AND i.is_hypothetical = 0
           AND i.has_filter = 0
           AND ic.key_ordinal = 1
           AND c.name = N'client_request_id'
           AND NOT EXISTS (
             SELECT 1
             FROM sys.index_columns extra
             WHERE extra.object_id = i.object_id
               AND extra.index_id = i.index_id
               AND extra.key_ordinal > 1
           )
       )
      THEN 1 ELSE 0
    END AS is_ready;
  `);

  if (!result.recordset?.[0]?.is_ready) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_SCHEMA_MISSING',
      'Terminal sync ledger schema is missing or unsafe',
      503,
    );
  }
}

export async function acquireTerminalSaleIdempotencyLock(request, clientEventId) {
  const lockIdentity = clientEventId.normalize('NFKC').toUpperCase();
  const lockResource = `terminal-sale:v1:${sha256(lockIdentity)}`;
  const result = await request
    .input('terminalSaleLockResource', sql.NVarChar(255), lockResource)
    .query(`
      DECLARE @terminalSaleLockResult INT;

      EXEC @terminalSaleLockResult = sys.sp_getapplock
        @Resource = @terminalSaleLockResource,
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 5000,
        @DbPrincipal = N'public';

      SELECT @terminalSaleLockResult AS lock_result;
    `);
  const rawLockResult = result.recordset?.[0]?.lock_result;
  const lockResult = Number(rawLockResult);

  if ([-1, -2, -3].includes(lockResult)) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_BUSY',
      'This terminal event is already being processed; retry the same event later',
      503,
    );
  }

  if (rawLockResult == null || ![0, 1].includes(lockResult)) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_LOCK_FAILED',
      'Terminal event lock could not be verified safely',
      503,
    );
  }
}

export async function readTerminalSaleLedger(request, clientEventId) {
  const result = await request
    .input('terminalSaleClientEventId', sql.NVarChar(120), clientEventId)
    .query(`
      SELECT TOP (1)
        id,
        terminal_device_id AS terminalDeviceId,
        user_id AS userId,
        event_type AS eventType,
        payload_json AS payloadJson,
        status,
        target_entity AS targetEntity,
        target_entity_id AS targetEntityId
      FROM dbo.terminal_sync_queue WITH (UPDLOCK, HOLDLOCK)
      WHERE client_request_id = @terminalSaleClientEventId;
    `);

  return result.recordset?.[0] || null;
}

export async function findLegacyTerminalSale(request, clientEventId) {
  const legacyMarker = `terminalClientEventId:${clientEventId}`;
  const result = await request
    .input('terminalLegacyClientEventId', sql.NVarChar(120), clientEventId)
    .input('terminalLegacyMarker', sql.NVarChar(160), legacyMarker)
    .query(`
      SELECT TOP (1)
        si.id,
        si.status,
        si.description
      FROM dbo.sales_invoices si
      WHERE RIGHT(COALESCE(si.description, N''), LEN(@terminalLegacyMarker)) = @terminalLegacyMarker
         OR EXISTS (
           SELECT 1
           FROM dbo.audit_logs a
           WHERE a.action = N'terminal_sales_submitted'
             AND a.entity_type = N'sales_invoice'
             AND a.entity_id = si.id
             AND JSON_VALUE(
               CASE WHEN ISJSON(a.after_json) = 1 THEN a.after_json ELSE N'{}' END,
               '$.clientEventId'
             ) = @terminalLegacyClientEventId
         )
      ORDER BY si.id DESC;
    `);

  return result.recordset?.[0] || null;
}

export function assertNoLegacyTerminalSale(existing) {
  if (!existing) return;
  throw serviceError(
    'TERMINAL_SALE_IDEMPOTENCY_LEGACY_UNVERIFIED',
    'A legacy terminal sale uses this clientEventId but its payload cannot be verified; manual review is required',
  );
}

export async function insertTerminalSaleLedger(request, {
  clientEventId,
  terminalDeviceId,
  actorUserId,
  requestFingerprint,
}) {
  const result = await request
    .input('terminalLedgerDeviceId', sql.BigInt, Number(terminalDeviceId))
    .input('terminalLedgerUserId', sql.BigInt, Number(actorUserId))
    .input('terminalLedgerClientEventId', sql.NVarChar(120), clientEventId)
    .input('terminalLedgerPayloadJson', sql.NVarChar(sql.MAX), buildTerminalSaleLedgerPayload(requestFingerprint))
    .query(`
      INSERT INTO dbo.terminal_sync_queue (
        terminal_device_id,
        user_id,
        event_type,
        client_request_id,
        payload_json,
        status,
        retry_count,
        last_error,
        target_entity,
        target_entity_id
      )
      OUTPUT INSERTED.id AS ledgerId
      VALUES (
        @terminalLedgerDeviceId,
        @terminalLedgerUserId,
        N'invoice_created',
        @terminalLedgerClientEventId,
        @terminalLedgerPayloadJson,
        N'processing',
        0,
        NULL,
        N'sales_invoice',
        NULL
      );
    `);

  const ledgerId = Number(result.recordset?.[0]?.ledgerId);
  if (!Number.isInteger(ledgerId) || ledgerId < 1) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_RESERVE_FAILED',
      'Terminal event could not be reserved safely',
      503,
    );
  }
  return ledgerId;
}

export async function markTerminalSaleLedgerSynced(request, {
  ledgerId,
  invoiceId,
  requestFingerprint,
  resultSnapshot,
}) {
  const completedPayloadJson = buildTerminalSaleLedgerPayload(requestFingerprint, resultSnapshot);
  const result = await request
    .input('terminalLedgerSyncId', sql.BigInt, Number(ledgerId))
    .input('terminalLedgerInvoiceId', sql.BigInt, Number(invoiceId))
    .input('terminalLedgerCompletedPayloadJson', sql.NVarChar(sql.MAX), completedPayloadJson)
    .query(`
      UPDATE dbo.terminal_sync_queue
      SET
        status = N'synced',
        payload_json = @terminalLedgerCompletedPayloadJson,
        target_entity = N'sales_invoice',
        target_entity_id = @terminalLedgerInvoiceId,
        last_error = NULL,
        processed_at = SYSUTCDATETIME()
      WHERE id = @terminalLedgerSyncId
        AND status = N'processing';
    `);

  if (Number(result.rowsAffected?.[0] || 0) !== 1) {
    throw serviceError(
      'TERMINAL_SALE_IDEMPOTENCY_STATE_CHANGED',
      'Terminal event ledger changed during processing',
      503,
    );
  }
}
