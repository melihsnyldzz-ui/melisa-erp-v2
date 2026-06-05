import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { clearSyncedQueueEvents, getPendingQueue, syncPendingTerminalSales, syncTerminalSaleEvent } from '../services/queueService';
import { colors } from '../styles/theme';

function statusLabel(status) {
  if (status === 'pending') return 'Bekliyor';
  if (status === 'retry_wait') return 'Tekrar';
  if (status === 'syncing') return 'Gonderiliyor';
  if (status === 'synced') return 'Gonderildi';
  if (status === 'failed') return 'Hatali';
  return status || '-';
}

function formatDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function saleTotal(payload = {}) {
  return (payload.items || []).reduce((sum, item) => (
    sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
  ), 0);
}

function saleQuantity(payload = {}) {
  return (payload.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function saleCurrency(payload = {}) {
  return payload.documentCurrency || payload.items?.[0]?.currency || 'TRY';
}

function formatMoney(value, currency = 'TRY') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function QueueCard({ event, syncingEventId, onSync, onEdit }) {
  const payload = event.payload || {};
  const isFailed = event.status === 'failed';
  const isSynced = event.status === 'synced';
  const currency = saleCurrency(payload);

  return (
    <View style={[styles.queueCard, isFailed && styles.queueCardFailed, isSynced && styles.queueCardSynced]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.customerName}>{payload.customerName || payload.customerCode || `Cari #${payload.customerId || '-'}`}</Text>
          <Text style={styles.cardMeta}>{formatDate(event.clientCreatedAt)}</Text>
        </View>
        <Text style={[styles.statusPill, isFailed && styles.statusDanger, isSynced && styles.statusSuccess]}>
          {statusLabel(event.status)}
        </Text>
      </View>

      <View style={styles.factRow}>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Satir</Text>
          <Text style={styles.factValue}>{payload.items?.length || 0}</Text>
        </View>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Adet</Text>
          <Text style={styles.factValue}>{saleQuantity(payload)}</Text>
        </View>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Toplam</Text>
          <Text style={styles.factValueSmall}>{formatMoney(saleTotal(payload), currency)}</Text>
        </View>
      </View>

      {event.lastErrorMessage ? <Text style={styles.errorText}>{event.lastErrorMessage}</Text> : null}

      {event.status !== 'synced' ? (
        <View style={styles.cardActions}>
          <TerminalButton label="Duzenle" onPress={() => onEdit(event)} variant="secondary" disabled={Boolean(syncingEventId)} />
          <TerminalButton
            label={syncingEventId === event.clientEventId ? 'Gonderiliyor' : 'Gonder'}
            onPress={() => onSync(event.clientEventId)}
            disabled={Boolean(syncingEventId)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function SyncStatusScreen({ session, syncState, navigation, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('open');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncingEventId, setSyncingEventId] = useState('');

  const salesQueue = useMemo(() => queue.filter((event) => event.eventType === 'terminal_sale'), [queue]);
  const openSales = useMemo(() => salesQueue.filter((event) => event.status !== 'synced'), [salesQueue]);
  const failedSales = useMemo(() => salesQueue.filter((event) => event.status === 'failed'), [salesQueue]);
  const syncedSales = useMemo(() => salesQueue.filter((event) => event.status === 'synced'), [salesQueue]);
  const visibleQueue = filter === 'sent' ? syncedSales : filter === 'failed' ? failedSales : openSales;

  async function refreshLocalState() {
    setQueue(await getPendingQueue());
    await onRefresh();
  }

  async function syncAll() {
    setMessage('');
    setError('');
    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      await refreshLocalState();
      setMessage(`${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`);
      if (result.lastErrorMessage) {
        setError(result.lastErrorMessage);
      }
    } catch (syncError) {
      setError(syncError.message || 'Gonderim basarisiz');
    }
  }

  async function syncSingle(clientEventId) {
    setMessage('');
    setError('');
    setSyncingEventId(clientEventId);
    try {
      const result = await syncTerminalSaleEvent(clientEventId, { token: session.accessToken });
      await refreshLocalState();
      setMessage(result.duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi');
    } catch (syncError) {
      await refreshLocalState();
      setError(syncError.message || 'Fis gonderilemedi');
    } finally {
      setSyncingEventId('');
    }
  }

  async function clearSent() {
    setMessage('');
    setError('');
    try {
      const result = await clearSyncedQueueEvents();
      await refreshLocalState();
      setMessage(`${result.removed} gonderilmis fis temizlendi`);
    } catch (clearError) {
      setError(clearError.message || 'Temizleme basarisiz');
    }
  }

  function editSale(event) {
    navigation.openNewSaleDraft?.(event);
  }

  useEffect(() => {
    refreshLocalState();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.heroPanel, failedSales.length ? styles.heroDanger : openSales.length ? styles.heroWarning : styles.heroSuccess]}>
        <Text style={styles.heroTitle}>Bekleyen Fisler</Text>
        <Text style={styles.heroText}>
          {failedSales.length
            ? 'Hatali fis var. Duzenleyip tekrar gonderebilirsiniz.'
            : openSales.length
              ? syncState.online ? 'Bekleyen fisler gonderime hazir.' : 'API offline, fisler kuyrukta bekliyor.'
              : 'Bekleyen fis yok.'}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Bekleyen</Text>
          <Text style={styles.summaryValue}>{openSales.length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Hatali</Text>
          <Text style={styles.summaryValue}>{failedSales.length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Giden</Text>
          <Text style={styles.summaryValue}>{syncedSales.length}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TerminalButton label={`Bekleyen ${openSales.length}`} onPress={() => setFilter('open')} variant={filter === 'open' ? 'primary' : 'secondary'} />
        <TerminalButton label={`Hatali ${failedSales.length}`} onPress={() => setFilter('failed')} variant={filter === 'failed' ? 'primary' : 'secondary'} />
        <TerminalButton label={`Giden ${syncedSales.length}`} onPress={() => setFilter('sent')} variant={filter === 'sent' ? 'primary' : 'secondary'} />
      </View>

      {visibleQueue.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Liste bos</Text>
          <Text style={styles.emptyText}>Bu bolumde gosterilecek fis yok.</Text>
        </View>
      ) : visibleQueue.map((event) => (
        <QueueCard
          key={event.clientEventId}
          event={event}
          syncingEventId={syncingEventId}
          onSync={syncSingle}
          onEdit={editSale}
        />
      ))}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TerminalButton label={syncState.online ? 'Tum Bekleyenleri Gonder' : 'API Offline'} onPress={syncAll} disabled={!syncState.online || !openSales.length} />
      <TerminalButton label="Yenile" onPress={refreshLocalState} variant="secondary" />
      <TerminalButton label="Gonderilmisleri Temizle" onPress={clearSent} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  heroPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 5,
  },
  heroSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  heroWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  heroDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    minHeight: 66,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    justifyContent: 'center',
    padding: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  filterRow: {
    gap: 7,
  },
  emptyPanel: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  queueCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 12,
    gap: 10,
  },
  queueCardFailed: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  queueCardSynced: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleBlock: {
    flex: 1,
  },
  customerName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    overflow: 'hidden',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  statusSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  factRow: {
    flexDirection: 'row',
    gap: 7,
  },
  factBox: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    padding: 8,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  factValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  factValueSmall: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  cardActions: {
    gap: 7,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
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
