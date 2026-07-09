import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { getPendingQueue, removeQueueEvent, syncTerminalSaleEvent } from '../services/queueService';
import { colors, terminalStyles } from '../styles/theme';

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

function shortProductName(item = {}) {
  return item.productName || item.stockCode || item.barcode || `Urun #${item.productId || '-'}`;
}

function QueueCard({ event, syncingEventId, onSync, onEdit, onDelete }) {
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

      <Text style={styles.cardSummary}>
        {(payload.items?.length || 0)} satir / {saleQuantity(payload)} adet / {formatMoney(saleTotal(payload), currency)}
      </Text>

      {event.lastErrorMessage ? <Text style={styles.errorText}>{event.lastErrorMessage}</Text> : null}

      <View style={styles.linePreview}>
        {(payload.items || []).slice(0, 3).map((item, index) => (
          <View key={`${event.clientEventId}-line-${index}`} style={styles.linePreviewRow}>
            <Text style={styles.linePreviewName} numberOfLines={1}>{shortProductName(item)}</Text>
            <Text style={styles.linePreviewMeta}>
              {Number(item.quantity || 0)} x {formatMoney(item.unitPrice, item.currency || currency)}
            </Text>
          </View>
        ))}
        {(payload.items || []).length > 3 ? (
          <Text style={styles.moreLines}>+{(payload.items || []).length - 3} satir daha</Text>
        ) : null}
      </View>

      {event.status !== 'synced' ? (
        <View style={styles.cardActions}>
          <TerminalButton label="Fisi Duzenle" onPress={() => onEdit(event)} variant="secondary" disabled={Boolean(syncingEventId)} />
          <TerminalButton
            label={syncingEventId === event.clientEventId ? 'Gonderiliyor' : 'Gonder'}
            onPress={() => onSync(event.clientEventId)}
            disabled={Boolean(syncingEventId)}
          />
          <TerminalButton label="Sil" onPress={() => onDelete(event.clientEventId)} variant="danger" disabled={Boolean(syncingEventId)} />
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

  function editSale(event) {
    setMessage('Fis duzenleme ekranina aciliyor');
    setError('');
    navigation.openNewSaleDraft?.(event);
  }

  async function deleteSale(clientEventId) {
    setMessage('');
    setError('');
    try {
      const result = await removeQueueEvent(clientEventId);
      await refreshLocalState();
      setMessage(result.removed ? 'Fis kuyruktan silindi' : 'Fis bulunamadi');
    } catch (deleteError) {
      setError(deleteError.message || 'Fis silinemedi');
    }
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
        <Text style={styles.heroNote}>
          Final test notu: Gonder butonu fisi API'ye yollar ve ERP'ye yazabilir. Sil butonu yalnizca bu cihazdaki lokal kuyruk kaydini kaldirir.
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
          onDelete={deleteSale}
        />
      ))}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {failedSales.length ? (
        <Text style={styles.error}>Hatali fisleri silmeden once musteri, urun, miktar ve hata metnini kontrol edin.</Text>
      ) : null}

      <TerminalButton label="Yenile" onPress={refreshLocalState} variant="secondary" />
      <TerminalButton label="Raporlar" onPress={navigation.openReports} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 8,
    paddingBottom: 104,
    gap: 8,
  },
  heroPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    gap: 3,
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
    fontSize: 18,
    fontWeight: '900',
  },
  heroText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  heroNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
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
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.warning,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 9,
    gap: 7,
    ...terminalStyles.rowShadow,
  },
  queueCardFailed: {
    borderColor: colors.danger,
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  queueCardSynced: {
    borderColor: colors.success,
    borderLeftColor: colors.success,
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
  cardSummary: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  cardActions: {
    gap: 6,
  },
  linePreview: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  linePreviewRow: {
    minHeight: 34,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  linePreviewName: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  linePreviewMeta: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
  },
  moreLines: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
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
