import AsyncStorage from '@react-native-async-storage/async-storage';
import { terminalConfig } from '../config/env';
import { submitTerminalSale } from './terminalSalesService';

const queueKey = 'terminalPendingQueue';

async function readQueue() {
  const raw = await AsyncStorage.getItem(queueKey);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}

export async function enqueueAction({ eventType, payload = {}, status = 'pending' }) {
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
}

export async function enqueueTerminalSale(payload) {
  return enqueueAction({
    eventType: 'terminal_sale',
    payload,
    status: 'pending',
  });
}

export async function getPendingQueue() {
  return readQueue();
}

export async function markRetryWait(clientEventId, error) {
  const queue = await readQueue();
  const now = new Date().toISOString();
  const updated = queue.map((event) => {
    if (event.clientEventId !== clientEventId) return event;

    const retryCount = Number(event.retryCount || 0) + 1;
    const delayMinutes = retryCount < 2 ? 0.5 : retryCount < 4 ? 5 : 30;
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

    return {
      ...event,
      status: 'retry_wait',
      retryCount,
      lastAttemptAt: now,
      nextRetryAt,
      lastErrorCode: error?.code || 'SYNC_RETRY',
      lastErrorMessage: error?.message || 'Sync tekrar denenecek',
    };
  });

  await writeQueue(updated);
}

async function updateQueueEvent(clientEventId, patch) {
  const queue = await readQueue();
  const updated = queue.map((event) => (
    event.clientEventId === clientEventId
      ? { ...event, ...patch }
      : event
  ));
  await writeQueue(updated);
}

export async function syncPendingTerminalSales({ token } = {}) {
  const queue = await readQueue();
  const saleEvents = queue.filter((event) => (
    event.eventType === 'terminal_sale'
    && ['pending', 'retry_wait', 'failed'].includes(event.status)
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
    await updateQueueEvent(event.clientEventId, {
      status: 'syncing',
      lastAttemptAt: new Date().toISOString(),
    });

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
      await updateQueueEvent(event.clientEventId, {
        status: 'synced',
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: isDuplicate ? 'Daha once gonderilmis' : null,
        serverResponse: response?.data || response,
      });

      if (isDuplicate) {
        result.duplicate += 1;
      } else {
        result.synced += 1;
      }
    } catch (error) {
      result.failed += 1;
      result.lastErrorMessage = error.message || 'Sync basarisiz';
      await updateQueueEvent(event.clientEventId, {
        status: 'failed',
        retryCount: Number(event.retryCount || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: error.code || 'SYNC_FAILED',
        lastErrorMessage: error.message || 'Sync basarisiz',
      });
    }
  }

  return result;
}

export async function getQueueSummary() {
  const queue = await readQueue();
  const pendingCount = queue.filter((event) => ['pending', 'retry_wait', 'syncing'].includes(event.status)).length;
  const failedCount = queue.filter((event) => event.status === 'failed').length;
  const syncedEvents = queue.filter((event) => event.status === 'synced' && event.lastAttemptAt);
  const lastSyncAt = syncedEvents[0]?.lastAttemptAt || null;

  return {
    pendingCount,
    failedCount,
    lastSyncAt,
    totalCount: queue.length,
  };
}
