import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { getCacheSummary } from '../services/cacheService';
import { clearNonSaleQueueEvents, clearSyncedQueueEvents, enqueueAction, getPendingQueue, syncPendingTerminalSales, syncTerminalSaleEvent } from '../services/queueService';
import { colors } from '../styles/theme';

function eventTypeLabel(eventType) {
  if (eventType === 'terminal_sale') return 'Satis fisi';
  if (eventType === 'device_ping') return 'Cihaz ping';
  if (eventType === 'barcode_lookup') return 'Barkod arama';
  return eventType || '-';
}

function statusLabel(status) {
  if (status === 'pending') return 'Bekliyor';
  if (status === 'retry_wait') return 'Tekrar denenecek';
  if (status === 'syncing') return 'Gonderiliyor';
  if (status === 'synced') return 'Gonderildi';
  if (status === 'failed') return 'Hatali';
  return status || '-';
}

export function SyncStatusScreen({ session, syncState, navigation, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [cacheSummary, setCacheSummary] = useState({ productCount: 0, customerCount: 0 });
  const [queueFilter, setQueueFilter] = useState('problem');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncingEventId, setSyncingEventId] = useState('');

  const filteredQueue = useMemo(() => queue.filter((event) => {
    if (queueFilter === 'problem') {
      return ['pending', 'retry_wait', 'failed', 'syncing'].includes(event.status);
    }
    if (queueFilter === 'sales') {
      return event.eventType === 'terminal_sale';
    }
    if (queueFilter === 'synced') {
      return event.status === 'synced';
    }
    return true;
  }), [queue, queueFilter]);

  const filterCounts = useMemo(() => ({
    problem: queue.filter((event) => ['pending', 'retry_wait', 'failed', 'syncing'].includes(event.status)).length,
    sales: queue.filter((event) => event.eventType === 'terminal_sale').length,
    synced: queue.filter((event) => event.status === 'synced').length,
    all: queue.length,
  }), [queue]);

  async function refreshLocalState() {
    const [nextQueue, nextCache] = await Promise.all([
      getPendingQueue(),
      getCacheSummary(),
    ]);
    setQueue(nextQueue);
    setCacheSummary(nextCache);
    await onRefresh();
  }

  async function createPingEvent() {
    await enqueueAction({
      eventType: 'device_ping',
      payload: {
        username: session.user?.username || null,
        appVersion: '0.1.0',
      },
    });
    await refreshLocalState();
  }

  async function syncSalesQueue() {
    setSyncMessage('');
    setSyncError('');
    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      await refreshLocalState();
      setSyncMessage(`Satis sync: ${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`);
      if (result.lastErrorMessage) {
        setSyncError(result.lastErrorMessage);
      }
    } catch (error) {
      setSyncError(error.message || 'Satis sync basarisiz');
    }
  }

  async function syncSingleSale(clientEventId) {
    setSyncMessage('');
    setSyncError('');
    setSyncingEventId(clientEventId);

    try {
      const result = await syncTerminalSaleEvent(clientEventId, { token: session.accessToken });
      await refreshLocalState();
      setSyncMessage(result.duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi');
    } catch (error) {
      await refreshLocalState();
      setSyncError(error.message || 'Tek fis sync basarisiz');
    } finally {
      setSyncingEventId('');
    }
  }

  async function clearSyncedEvents() {
    setSyncMessage('');
    setSyncError('');
    try {
      const result = await clearSyncedQueueEvents();
      await refreshLocalState();
      setSyncMessage(`${result.removed} gonderilmis kayit gizlendi/temizlendi`);
    } catch (error) {
      setSyncError(error.message || 'Gonderilmis kayitlar temizlenemedi');
    }
  }

  async function clearTestEvents() {
    setSyncMessage('');
    setSyncError('');
    try {
      const result = await clearNonSaleQueueEvents();
      await refreshLocalState();
      setSyncMessage(`${result.removed} test/yardimci event temizlendi`);
    } catch (error) {
      setSyncError(error.message || 'Test eventleri temizlenemedi');
    }
  }

  useEffect(() => {
    refreshLocalState();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>Sync Durumu</Text>
        <InfoRow label="API" value={syncState.apiStatus} tone={syncState.online ? 'success' : 'danger'} />
        <InfoRow label="Terminal" value={terminalConfig.terminalCode} />
        <InfoRow label="Cihaz" value={terminalConfig.deviceName} />
        <InfoRow label="Bekleyen queue" value={String(syncState.pendingCount)} tone={syncState.pendingCount ? 'danger' : 'success'} />
        <InfoRow label="Hatali queue" value={String(syncState.failedCount)} tone={syncState.failedCount ? 'danger' : 'success'} />
        <InfoRow label="Bekleyen satis" value={String(syncState.salePendingCount || 0)} tone={syncState.salePendingCount ? 'danger' : 'success'} />
        <InfoRow label="Hatali satis" value={String(syncState.saleFailedCount || 0)} tone={syncState.saleFailedCount ? 'danger' : 'success'} />
        <InfoRow label="Gonderilen" value={String(syncState.syncedCount || 0)} tone="success" />
        <InfoRow label="Duplicate" value={String(syncState.saleDuplicateCount || syncState.duplicateCount || 0)} />
        <InfoRow label="Test eventleri" value={String(syncState.nonSaleCount || 0)} />
        <InfoRow label="Son sync" value={syncState.lastSyncAt || 'Henuz yok'} />
        <InfoRow label="Urun cache" value={String(cacheSummary.productCount)} />
        <InfoRow label="Cari cache" value={String(cacheSummary.customerCount)} />
        <InfoRow label="Urun cache zamani" value={cacheSummary.productCachedAt ? new Date(cacheSummary.productCachedAt).toLocaleString('tr-TR') : 'Henuz yok'} />
        <InfoRow label="Cari cache zamani" value={cacheSummary.customerCachedAt ? new Date(cacheSummary.customerCachedAt).toLocaleString('tr-TR') : 'Henuz yok'} />
      </View>

      <View style={styles.queuePanel}>
        <Text style={styles.queueTitle}>Local queue</Text>
        <View style={styles.filterRow}>
          {[
            ['problem', 'Sorunlu'],
            ['sales', 'Satis'],
            ['synced', 'Gonderilen'],
            ['all', 'Tumu'],
          ].map(([key, label]) => (
            <TerminalButton
              key={key}
              label={`${label} ${filterCounts[key]}`}
              onPress={() => setQueueFilter(key)}
              variant={queueFilter === key ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        {filteredQueue.length === 0 ? (
          <Text style={styles.empty}>Bu filtrede local event yok.</Text>
        ) : filteredQueue.slice(0, 12).map((event) => (
          <View key={event.clientEventId} style={styles.queueRow}>
            <Text style={styles.queueType}>{eventTypeLabel(event.eventType)}</Text>
            <Text style={[styles.queueMeta, event.status === 'failed' && styles.queueError, event.status === 'synced' && styles.queueSuccess]}>
              {statusLabel(event.status)} / deneme {event.retryCount}
            </Text>
            {event.lastErrorMessage ? <Text style={styles.queueErrorText}>{event.lastErrorMessage}</Text> : null}
            <Text style={styles.queueId}>{event.clientEventId}</Text>
            {event.eventType === 'terminal_sale' && event.status !== 'synced' ? (
              <View style={styles.queueActions}>
                <TerminalButton
                  label={syncingEventId === event.clientEventId ? 'Gonderiliyor' : 'Bu fisi gonder'}
                  onPress={() => syncSingleSale(event.clientEventId)}
                  disabled={Boolean(syncingEventId)}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {syncMessage ? <Text style={styles.message}>{syncMessage}</Text> : null}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}

      <TerminalButton label="Device ping queue ekle" onPress={createPingEvent} />
      <TerminalButton label="Satis Kuyrugunu Gonder" onPress={syncSalesQueue} />
      <TerminalButton label="Gonderilmisleri Temizle" onPress={clearSyncedEvents} variant="secondary" />
      <TerminalButton label="Test Eventlerini Temizle" onPress={clearTestEvents} variant="secondary" />
      <TerminalButton label="Yenile" onPress={refreshLocalState} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  queuePanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  queueTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  filterRow: {
    gap: 6,
    marginBottom: 8,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  queueRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
  },
  queueType: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  queueMeta: {
    marginTop: 2,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  queueId: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  queueActions: {
    marginTop: 7,
  },
  queueSuccess: {
    color: colors.success,
  },
  queueError: {
    color: colors.danger,
  },
  queueErrorText: {
    marginTop: 2,
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
