import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { getCacheSummary } from '../services/cacheService';
import { enqueueAction, getPendingQueue, syncPendingTerminalSales } from '../services/queueService';
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
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

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
        <InfoRow label="Son sync" value={syncState.lastSyncAt || 'Henuz yok'} />
        <InfoRow label="Urun cache" value={String(cacheSummary.productCount)} />
        <InfoRow label="Cari cache" value={String(cacheSummary.customerCount)} />
        <InfoRow label="Urun cache zamani" value={cacheSummary.productCachedAt ? new Date(cacheSummary.productCachedAt).toLocaleString('tr-TR') : 'Henuz yok'} />
        <InfoRow label="Cari cache zamani" value={cacheSummary.customerCachedAt ? new Date(cacheSummary.customerCachedAt).toLocaleString('tr-TR') : 'Henuz yok'} />
      </View>

      <View style={styles.queuePanel}>
        <Text style={styles.queueTitle}>Local queue</Text>
        {queue.length === 0 ? (
          <Text style={styles.empty}>Bekleyen local event yok.</Text>
        ) : queue.slice(0, 8).map((event) => (
          <View key={event.clientEventId} style={styles.queueRow}>
            <Text style={styles.queueType}>{eventTypeLabel(event.eventType)}</Text>
            <Text style={[styles.queueMeta, event.status === 'failed' && styles.queueError, event.status === 'synced' && styles.queueSuccess]}>
              {statusLabel(event.status)} / deneme {event.retryCount}
            </Text>
            {event.lastErrorMessage ? <Text style={styles.queueErrorText}>{event.lastErrorMessage}</Text> : null}
            <Text style={styles.queueId}>{event.clientEventId}</Text>
          </View>
        ))}
      </View>

      {syncMessage ? <Text style={styles.message}>{syncMessage}</Text> : null}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}

      <TerminalButton label="Device ping queue ekle" onPress={createPingEvent} />
      <TerminalButton label="Satis Kuyrugunu Gonder" onPress={syncSalesQueue} />
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
