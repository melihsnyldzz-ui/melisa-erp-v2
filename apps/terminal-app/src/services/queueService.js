import AsyncStorage from '@react-native-async-storage/async-storage';
import { terminalConfig } from '../config/env';
import { submitTerminalSale } from './terminalSalesService';

const queueKey = 'terminalPendingQueue';
const PERMANENT_TERMINAL_SALE_ERRORS = new Set([
  'TERMINAL_SALE_IDEMPOTENCY_CONFLICT',
  'TERMINAL_SALE_IDEMPOTENCY_OWNER_MISMATCH',
  'TERMINAL_SALE_IDEMPOTENCY_STATE_INVALID',
  'TERMINAL_SALE_IDEMPOTENCY_LEGACY_UNVERIFIED',
  'TERMINAL_SALE_OUTCOME_UNVERIFIED',
  'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED',
]);
let queueMutationTail = Promise.resolve();
const terminalSaleEventLocks = new Map();

export function requiresTerminalSaleManualReview(event = {}) {
  return event.status !== 'synced'
    && isTerminalSaleManualReviewErrorCode(event.lastErrorCode);
}

export function isTerminalSaleManualReviewErrorCode(errorCode) {
  return PERMANENT_TERMINAL_SALE_ERRORS.has(String(errorCode || ''));
}

async function readQueue() {
  const raw = await AsyncStorage.getItem(queueKey);
  if (raw == null) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Queue root is not an array');
    if (parsed.some((event) => (
      !event
      || typeof event !== 'object'
      || typeof event.clientEventId !== 'string'
      || !event.clientEventId
      || typeof event.eventType !== 'string'
      || !event.eventType
      || typeof event.status !== 'string'
      || !Object.prototype.hasOwnProperty.call(event, 'payload')
    ))) {
      throw new Error('Queue contains an invalid event record');
    }
    if (new Set(parsed.map((event) => event.clientEventId)).size !== parsed.length) {
      throw new Error('Queue contains duplicate event identities');
    }
    return parsed;
  } catch (cause) {
    const error = queueActionError(
      'TERMINAL_QUEUE_STORAGE_CORRUPT',
      'Cihaz satis kuyrugu okunamadi; mevcut kayit korunarak manuel inceleme gerekiyor',
    );
    error.cause = cause;
    throw error;
  }
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}

/** @template T @param {() => T | Promise<T>} task @returns {Promise<T>} */
function withQueueMutation(task) {
  const result = queueMutationTail.then(task, task);
  queueMutationTail = result.then(() => undefined, () => undefined);
  return result;
}

/** @template T @param {string} clientEventId @param {() => T | Promise<T>} task @returns {Promise<T>} */
function withTerminalSaleEventLock(clientEventId, task) {
  const lockKey = String(clientEventId || '');
  const previous = terminalSaleEventLocks.get(lockKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  terminalSaleEventLocks.set(lockKey, current);

  return current.finally(() => {
    if (terminalSaleEventLocks.get(lockKey) === current) {
      terminalSaleEventLocks.delete(lockKey);
    }
  });
}

function queueActionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertQueueEventCanChange(event, actionLabel) {
  if (!event) {
    throw queueActionError('QUEUE_EVENT_NOT_FOUND', 'Satis queue kaydi bulunamadi');
  }
  if (requiresTerminalSaleManualReview(event)) {
    throw queueActionError(
      'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED',
      `Bu fisin sunucu sonucu guvenle dogrulanamadi; manuel inceleme tamamlanmadan ${actionLabel}`,
    );
  }
  if (event.status === 'syncing') {
    throw queueActionError('QUEUE_EVENT_BUSY', 'Fis su anda gonderiliyor; islem bitmeden degistirilemez');
  }
  if (event.status === 'synced') {
    throw queueActionError('QUEUE_EVENT_ALREADY_SYNCED', 'Gonderilmis fis cihaz kuyrugunda degistirilemez');
  }
}

async function mutateQueueEvent(clientEventId, update, {
  allowManualReviewOverride = false,
  allowSyncedOverride = false,
} = {}) {
  return withQueueMutation(async () => {
    const queue = await readQueue();
    const index = queue.findIndex((event) => event.clientEventId === clientEventId);
    if (index < 0) return null;

    const current = queue[index];
    if (requiresTerminalSaleManualReview(current) && !allowManualReviewOverride) return current;
    if (current.status === 'synced' && !allowSyncedOverride) return current;

    const next = await update(current);
    if (!next || next === current) return current;

    const updated = [...queue];
    updated[index] = next;
    await writeQueue(updated);
    return next;
  });
}

export async function enqueueAction({ eventType, payload = {}, status = 'pending' }) {
  return withQueueMutation(async () => {
    const queue = await readQueue();
    const now = new Date().toISOString();
    const event = {
      clientEventId: `${terminalConfig.terminalCode}-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      deviceName: terminalConfig.deviceName,
      terminalCode: terminalConfig.terminalCode,
      eventType,
      payload,
      status,
      retryCount: 0,
      clientCreatedAt: now,
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };

    await writeQueue([event, ...queue]);
    return event;
  });
}

export async function enqueueTerminalSale(payload) {
  return persistTerminalSaleEvent(createTerminalSaleClientEventId(), payload);
}

export function createTerminalSaleClientEventId() {
  return `${terminalConfig.terminalCode}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export async function persistTerminalSaleEvent(clientEventId, payload) {
  const eventId = String(clientEventId || '').trim();
  if (!eventId) {
    throw queueActionError('QUEUE_EVENT_ID_REQUIRED', 'Satis queue kimligi zorunludur');
  }

  return withTerminalSaleEventLock(eventId, () => withQueueMutation(async () => {
    const queue = await readQueue();
    const index = queue.findIndex((event) => event.clientEventId === eventId);

    if (index >= 0) {
      const current = queue[index];
      if (current.eventType !== 'terminal_sale') {
        throw queueActionError('QUEUE_EVENT_TYPE_INVALID', 'Queue kimligi baska bir islem turune aittir');
      }
      assertQueueEventCanChange(current, 'guncellenemez');
      const updated = [...queue];
      updated[index] = {
        ...current,
        payload,
        status: 'pending',
        lastAttemptAt: null,
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
      await writeQueue(updated);
      return updated[index];
    }

    const event = {
      clientEventId: eventId,
      deviceName: terminalConfig.deviceName,
      terminalCode: terminalConfig.terminalCode,
      eventType: 'terminal_sale',
      payload,
      status: 'pending',
      retryCount: 0,
      clientCreatedAt: new Date().toISOString(),
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    await writeQueue([event, ...queue]);
    return event;
  }));
}

export async function getPendingQueue() {
  await queueMutationTail;
  return readQueue();
}

export async function clearNonSaleQueueEvents() {
  return withQueueMutation(async () => {
    const queue = await readQueue();
    const nextQueue = queue.filter((event) => event.eventType === 'terminal_sale');
    await writeQueue(nextQueue);

    return {
      removed: queue.length - nextQueue.length,
      remaining: nextQueue.length,
    };
  });
}

export async function markRetryWait(clientEventId, error) {
  return withTerminalSaleEventLock(clientEventId, () => mutateQueueEvent(clientEventId, (event) => {
    const retryCount = Number(event.retryCount || 0) + 1;
    const delayMinutes = retryCount < 2 ? 0.5 : retryCount < 4 ? 5 : 30;
    return {
      ...event,
      status: 'retry_wait',
      retryCount,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
      lastErrorCode: error?.code || 'SYNC_RETRY',
      lastErrorMessage: error?.message || 'Sync tekrar denenecek',
    };
  }));
}

export async function updateQueueEventPayload(clientEventId, payload) {
  return withTerminalSaleEventLock(clientEventId, () => mutateQueueEvent(clientEventId, (event) => {
    assertQueueEventCanChange(event, 'duzenlenemez');
    return {
      ...event,
      payload,
      status: 'pending',
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
  }, { allowManualReviewOverride: true, allowSyncedOverride: true }));
}

export async function removeQueueEvent(clientEventId) {
  return withTerminalSaleEventLock(clientEventId, () => withQueueMutation(async () => {
    const queue = await readQueue();
    const event = queue.find((entry) => entry.clientEventId === clientEventId);
    assertQueueEventCanChange(event, 'silinemez');
    const nextQueue = queue.filter((entry) => entry.clientEventId !== clientEventId);
    await writeQueue(nextQueue);

    return {
      removed: queue.length - nextQueue.length,
      remaining: nextQueue.length,
    };
  }));
}

export async function markQueueFailed(clientEventId, error) {
  return withTerminalSaleEventLock(clientEventId, () => mutateQueueEvent(clientEventId, (event) => ({
    ...event,
    status: 'failed',
    retryCount: Number(event.retryCount || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastErrorCode: error?.code || 'SYNC_FAILED',
    lastErrorMessage: error?.message || 'Online gonderim basarisiz',
  })));
}

export async function markQueueSynced(clientEventId, serverResponse = null) {
  return withTerminalSaleEventLock(clientEventId, () => mutateQueueEvent(clientEventId, (event) => ({
    ...event,
    status: 'synced',
    lastAttemptAt: new Date().toISOString(),
    lastErrorCode: null,
    lastErrorMessage: null,
    serverResponse,
  })));
}

/** @param {string} clientEventId @param {import('./terminalContracts').SessionOptions} options */
export async function syncTerminalSaleEvent(clientEventId, { token } = {}) {
  return withTerminalSaleEventLock(clientEventId, async () => {
    const { event, alreadySynced } = await withQueueMutation(async () => {
      const queue = await readQueue();
      const index = queue.findIndex((entry) => entry.clientEventId === clientEventId);
      const event = queue[index];

      if (!event || event.eventType !== 'terminal_sale') {
        throw queueActionError('QUEUE_EVENT_NOT_FOUND', 'Satis queue kaydi bulunamadi');
      }
      if (requiresTerminalSaleManualReview(event)) {
        throw queueActionError(
          'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED',
          'Bu fisin sunucu sonucu guvenle dogrulanamadi; manuel inceleme tamamlanmadan yeniden gonderilemez',
        );
      }
      if (event.status === 'synced') {
        return { event, alreadySynced: true };
      }

      const updated = [...queue];
      updated[index] = {
        ...event,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
      };
      await writeQueue(updated);
      return { event, alreadySynced: false };
    });

    if (alreadySynced) {
      return {
        ok: true,
        duplicate: true,
        response: event.serverResponse || null,
      };
    }

    try {
      const response = await submitTerminalSale({
        token,
        payload: {
          ...event.payload,
          clientEventId: event.clientEventId,
          terminalCode: event.terminalCode || terminalConfig.terminalCode,
        },
      });
      const isDuplicate = Boolean(response?.data?.duplicate || response?.duplicate);
      const responseData = response?.data || response;
      if (!Number.isSafeInteger(Number(responseData?.invoiceId)) || Number(responseData.invoiceId) < 1) {
        throw queueActionError('TERMINAL_SALE_OUTCOME_UNVERIFIED', 'Sunucu yanitinda gecerli fis kimligi yok; yeniden islemden once ERP incelemesi gerekiyor');
      }
      await mutateQueueEvent(event.clientEventId, (current) => ({
        ...current,
        status: 'synced',
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: isDuplicate ? 'Daha once gonderilmis' : null,
        serverResponse: responseData,
      }), { allowManualReviewOverride: true, allowSyncedOverride: true });

      return {
        ok: true,
        duplicate: isDuplicate,
        response: responseData,
      };
    } catch (error) {
      await mutateQueueEvent(event.clientEventId, (current) => ({
        ...current,
        status: 'failed',
        retryCount: Number(current.retryCount || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: error.code || 'SYNC_FAILED',
        lastErrorMessage: error.message || 'Sync basarisiz',
      }));
      throw error;
    }
  });
}

/** @param {import('./terminalContracts').SessionOptions} options */
export async function syncPendingTerminalSales({ token } = {}) {
  await queueMutationTail;
  const queue = await readQueue();
  const saleEvents = queue.filter((event) => (
    event.eventType === 'terminal_sale'
    && ['pending', 'retry_wait', 'failed'].includes(event.status)
    && !requiresTerminalSaleManualReview(event)
  ));

  const result = {
    attempted: 0,
    synced: 0,
    duplicate: 0,
    failed: 0,
    lastErrorMessage: null,
  };

  for (const event of saleEvents) {
    result.attempted += 1;
    try {
      const syncResult = await syncTerminalSaleEvent(event.clientEventId, { token });
      if (syncResult.duplicate) {
        result.duplicate += 1;
      } else {
        result.synced += 1;
      }
    } catch (error) {
      result.failed += 1;
      result.lastErrorMessage = error.message || 'Sync basarisiz';
    }
  }

  return result;
}

export async function getQueueSummary() {
  await queueMutationTail;
  const queue = await readQueue();
  const pendingCount = queue.filter((event) => ['pending', 'retry_wait', 'syncing'].includes(event.status)).length;
  const failedCount = queue.filter((event) => event.status === 'failed').length;
  const syncedCount = queue.filter((event) => event.status === 'synced').length;
  const nonSaleCount = queue.filter((event) => event.eventType !== 'terminal_sale').length;
  const duplicateCount = queue.filter((event) => event.status === 'synced' && event.lastErrorMessage === 'Daha once gonderilmis').length;
  const salePendingCount = queue.filter((event) => event.eventType === 'terminal_sale' && ['pending', 'retry_wait', 'syncing'].includes(event.status)).length;
  const saleFailedCount = queue.filter((event) => event.eventType === 'terminal_sale' && event.status === 'failed').length;
  const saleDuplicateCount = queue.filter((event) => event.eventType === 'terminal_sale' && event.status === 'synced' && event.lastErrorMessage === 'Daha once gonderilmis').length;
  const syncedEvents = queue.filter((event) => event.status === 'synced' && event.lastAttemptAt);
  const lastSyncAt = syncedEvents[0]?.lastAttemptAt || null;

  return {
    pendingCount,
    failedCount,
    syncedCount,
    nonSaleCount,
    duplicateCount,
    salePendingCount,
    saleFailedCount,
    saleDuplicateCount,
    lastSyncAt,
    totalCount: queue.length,
  };
}
