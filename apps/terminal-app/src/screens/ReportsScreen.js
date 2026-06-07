import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { getPendingQueue } from '../services/queueService';
import { colors } from '../styles/theme';

function formatDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function saleCurrency(payload = {}) {
  return payload.documentCurrency || payload.items?.[0]?.currency || 'TRY';
}

function saleTotal(payload = {}) {
  return (payload.items || []).reduce((sum, item) => (
    sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
  ), 0);
}

function saleQuantity(payload = {}) {
  return (payload.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function formatMoney(value, currency = 'TRY') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function statusLabel(status) {
  if (status === 'pending') return 'Bekliyor';
  if (status === 'retry_wait') return 'Tekrar';
  if (status === 'syncing') return 'Gonderiliyor';
  if (status === 'synced') return 'Gonderildi';
  if (status === 'failed') return 'Hatali';
  return status || '-';
}

function statusTone(status) {
  if (status === 'synced') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function eventDate(event = {}) {
  return event.lastAttemptAt || event.clientCreatedAt;
}

function isTodayEvent(event = {}) {
  const value = eventDate(event);
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function receiptNumber(event) {
  const response = event.serverResponse || {};
  return response.receiptNo || response.salesReceiptNo || response.documentNo || response.id || event.clientEventId;
}

function isDuplicate(event) {
  return event.lastErrorMessage === 'Daha once gonderilmis'
    || Boolean(event.serverResponse?.duplicate)
    || Boolean(event.serverResponse?.data?.duplicate);
}

function padLine(left, right, width = 32) {
  const leftText = String(left || '').slice(0, width);
  const rightText = String(right || '');
  const spaceCount = Math.max(1, width - leftText.length - rightText.length);
  return `${leftText}${' '.repeat(spaceCount)}${rightText}`;
}

function buildReceiptText(event) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const lines = [
    'MELISA MINI ERP',
    'TERMINAL FIS',
    '-'.repeat(32),
    `Fis: ${String(receiptNumber(event)).slice(0, 26)}`,
    `Durum: ${statusLabel(event.status)}`,
    `Tarih: ${formatDate(eventDate(event))}`,
    `Cari: ${payload.customerName || payload.customerCode || '-'}`,
    `Kod: ${payload.customerCode || '-'}`,
    '-'.repeat(32),
  ];

  (payload.items || []).forEach((item) => {
    const itemCurrency = item.currency || currency;
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const total = quantity * unitPrice;
    lines.push(String(item.productName || item.stockCode || `Urun #${item.productId || '-'}`).slice(0, 32));
    lines.push(padLine(`${quantity} x ${formatMoney(unitPrice, itemCurrency)}`, formatMoney(total, itemCurrency)));
  });

  lines.push('-'.repeat(32));
  lines.push(padLine('Toplam adet', saleQuantity(payload)));
  lines.push(padLine('Genel toplam', formatMoney(saleTotal(payload), currency)));
  lines.push('-'.repeat(32));
  lines.push(event.clientEventId);

  return lines.join('\n');
}

function ReceiptListRow({ event, onPress }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const tone = statusTone(event.status);

  return (
    <Pressable onPress={() => onPress(event)} style={({ pressed }) => [styles.receiptRow, pressed && styles.pressedRow]}>
      <View style={styles.receiptMain}>
        <Text style={styles.receiptCustomer} numberOfLines={1}>{payload.customerName || payload.customerCode || `Cari #${payload.customerId || '-'}`}</Text>
        <Text style={styles.receiptSub} numberOfLines={1}>{payload.customerCode || '-'} / {formatDate(eventDate(event))}</Text>
      </View>
      <Text style={styles.receiptQty}>{saleQuantity(payload)}</Text>
      <Text style={styles.receiptTotal}>{formatMoney(saleTotal(payload), currency)}</Text>
      <Text style={[styles.rowStatusPill, styles[`rowStatus_${tone}`]]}>{statusLabel(event.status)}</Text>
    </Pressable>
  );
}

function ReceiptDetail({ event, onBack, onPrint }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const duplicate = isDuplicate(event);
  const receiptText = buildReceiptText(event);

  return (
    <>
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleBlock}>
          <Text style={styles.detailTitle} numberOfLines={1}>{payload.customerName || payload.customerCode || '-'}</Text>
          <Text style={styles.detailMeta}>{payload.customerCode || '-'} / {formatDate(eventDate(event))}</Text>
          <Text style={styles.detailId} numberOfLines={1}>{receiptNumber(event)}</Text>
        </View>
        <Text style={[styles.statusPill, duplicate && styles.statusDuplicate, styles[`status_${statusTone(event.status)}`]]}>
          {duplicate ? 'Duplicate' : statusLabel(event.status)}
        </Text>
      </View>

      <View style={styles.detailActions}>
        <TerminalButton label="Yazdir / Paylas" onPress={() => onPrint(event, receiptText)} />
        <TerminalButton label="Listeye Don" onPress={onBack} variant="secondary" />
      </View>

      <View style={styles.printPreview}>
        <Text style={styles.printPreviewTitle}>Fis cikti onizleme</Text>
        <Text selectable style={styles.printText}>{receiptText}</Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.cellCode, styles.headCell]}>Stok</Text>
          <Text style={[styles.cellName, styles.headCell]}>Urun</Text>
          <Text style={[styles.cellQty, styles.headCell]}>Adet</Text>
          <Text style={[styles.cellPrice, styles.headCell]}>Fiyat</Text>
        </View>
        {(payload.items || []).map((item, index) => {
          const itemCurrency = item.currency || currency;
          const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
          return (
            <View key={`${event.clientEventId}-${item.productId || index}`} style={styles.tableRow}>
              <Text style={styles.cellCode} numberOfLines={1}>{item.stockCode || item.barcode || '-'}</Text>
              <Text style={styles.cellName} numberOfLines={1}>{item.productName || `Urun #${item.productId || '-'}`}</Text>
              <Text style={styles.cellQty}>{Number(item.quantity || 0)}</Text>
              <Text style={styles.cellPrice}>{formatMoney(lineTotal, itemCurrency)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.detailTotals}>
        <Text style={styles.detailTotalLabel}>Toplam adet</Text>
        <Text style={styles.detailTotalValue}>{saleQuantity(payload)}</Text>
        <Text style={styles.detailTotalLabel}>Genel toplam</Text>
        <Text style={styles.detailTotalValue}>{formatMoney(saleTotal(payload), currency)}</Text>
      </View>
      {event.lastErrorMessage ? <Text style={styles.errorText}>{event.lastErrorMessage}</Text> : null}
    </>
  );
}

export function ReportsScreen({ navigation, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [filter, setFilter] = useState('today');
  const [message, setMessage] = useState('');

  const saleEvents = useMemo(() => (
    queue
      .filter((event) => event.eventType === 'terminal_sale')
      .sort((a, b) => String(eventDate(b)).localeCompare(String(eventDate(a))))
  ), [queue]);
  const todaySales = useMemo(() => saleEvents.filter(isTodayEvent), [saleEvents]);
  const pendingSales = useMemo(() => saleEvents.filter((event) => ['pending', 'retry_wait', 'syncing'].includes(event.status)), [saleEvents]);
  const failedSales = useMemo(() => saleEvents.filter((event) => event.status === 'failed'), [saleEvents]);
  const sentSales = useMemo(() => saleEvents.filter((event) => event.status === 'synced'), [saleEvents]);
  const visibleSales = filter === 'sent'
    ? sentSales
    : filter === 'pending'
      ? pendingSales
      : filter === 'failed'
        ? failedSales
        : todaySales;

  const selectedEvent = useMemo(() => (
    saleEvents.find((event) => event.clientEventId === selectedEventId) || null
  ), [saleEvents, selectedEventId]);

  const summary = useMemo(() => visibleSales.reduce((acc, event) => {
    const payload = event.payload || {};
    const currency = saleCurrency(payload);
    return {
      count: acc.count + 1,
      duplicate: acc.duplicate + (isDuplicate(event) ? 1 : 0),
      quantity: acc.quantity + saleQuantity(payload),
      totals: {
        ...acc.totals,
        [currency]: Number(acc.totals[currency] || 0) + saleTotal(payload),
      },
    };
  }, {
    count: 0,
    duplicate: 0,
    quantity: 0,
    totals: {},
  }), [visibleSales]);

  const listTitle = filter === 'sent'
    ? 'Gonderilen Fisler'
    : filter === 'pending'
      ? 'Bekleyen Fisler'
      : filter === 'failed'
        ? 'Hatali Fisler'
        : 'Bugunku Fisler';

  async function refreshReports() {
    setQueue(await getPendingQueue());
    setMessage('Raporlar yenilendi');
    await onRefresh?.();
  }

  function printReceipt(event, receiptText) {
    if (typeof globalThis?.print === 'function') {
      globalThis.print();
      setMessage('Yazdirma penceresi acildi');
      return;
    }

    setMessage(`Fis cikti metni hazir: ${receiptNumber(event)}. Bluetooth yazici baglantisi sonraki fazda baglanacak.`);
  }

  useEffect(() => {
    refreshReports();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {selectedEvent ? (
        <ReceiptDetail
          event={selectedEvent}
          onBack={() => setSelectedEventId('')}
          onPrint={printReceipt}
        />
      ) : (
        <>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Fis</Text>
              <Text style={styles.summaryValue}>{summary.count}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Adet</Text>
              <Text style={styles.summaryValue}>{summary.quantity}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duplicate</Text>
              <Text style={styles.summaryValue}>{summary.duplicate}</Text>
            </View>
          </View>

          <View style={styles.filterGrid}>
            <TerminalButton label={`Bugun ${todaySales.length}`} onPress={() => setFilter('today')} variant={filter === 'today' ? 'primary' : 'secondary'} />
            <TerminalButton label={`Bekleyen ${pendingSales.length}`} onPress={() => setFilter('pending')} variant={filter === 'pending' ? 'primary' : 'secondary'} />
            <TerminalButton label={`Hatali ${failedSales.length}`} onPress={() => setFilter('failed')} variant={filter === 'failed' ? 'primary' : 'secondary'} />
            <TerminalButton label={`Giden ${sentSales.length}`} onPress={() => setFilter('sent')} variant={filter === 'sent' ? 'primary' : 'secondary'} />
          </View>

          <View style={styles.totalStrip}>
            {Object.keys(summary.totals).length ? (
              Object.keys(summary.totals).map((currency) => (
                <Text key={currency} style={styles.totalChip}>{formatMoney(summary.totals[currency], currency)}</Text>
              ))
            ) : (
              <Text style={styles.emptyText}>Henuz gonderilmis fis yok.</Text>
            )}
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{listTitle}</Text>
            <Text style={styles.listMeta}>Fis detayina girmek icin satira dokunun.</Text>
          </View>

          <View style={styles.receiptList}>
            {visibleSales.length ? visibleSales.map((event) => (
              <ReceiptListRow
                key={event.clientEventId}
                event={event}
                onPress={(nextEvent) => setSelectedEventId(nextEvent.clientEventId)}
              />
            )) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Liste bos</Text>
                <Text style={styles.emptyText}>Bu filtrede gosterilecek fis yok.</Text>
              </View>
            )}
          </View>
        </>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TerminalButton label="Yenile" onPress={refreshReports} variant="secondary" />
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
  summaryStrip: {
    minHeight: 46,
    flexDirection: 'row',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  summaryItem: {
    flex: 1,
    justifyContent: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    paddingHorizontal: 8,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  totalStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterGrid: {
    gap: 7,
  },
  totalChip: {
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  listHeader: {
    gap: 2,
  },
  listTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  listMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  receiptList: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  receiptRow: {
    minHeight: 44,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pressedRow: {
    backgroundColor: colors.accentSoft,
  },
  receiptMain: {
    flex: 1,
    minWidth: 0,
  },
  receiptCustomer: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  receiptSub: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  receiptQty: {
    width: 34,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  receiptTotal: {
    minWidth: 74,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  rowStatusPill: {
    minWidth: 62,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 5,
    textAlign: 'center',
  },
  rowStatus_success: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  rowStatus_warning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  },
  rowStatus_danger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  detailHeader: {
    borderColor: colors.success,
    borderWidth: 1,
    borderLeftColor: colors.success,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 9,
  },
  detailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  detailId: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusDuplicate: {
    borderColor: colors.warning,
    color: colors.warning,
  },
  status_success: {
    borderColor: colors.success,
    color: colors.success,
  },
  status_warning: {
    borderColor: colors.warning,
    color: colors.warning,
  },
  status_danger: {
    borderColor: colors.danger,
    color: colors.danger,
  },
  detailActions: {
    gap: 7,
  },
  printPreview: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 10,
    gap: 7,
  },
  printPreviewTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  printText: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: '#fffdf7',
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    padding: 8,
  },
  table: {
    borderColor: '#b7ad98',
    borderWidth: 1,
    backgroundColor: '#f7f4eb',
  },
  tableRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#c9c0ad',
    borderBottomWidth: 1,
  },
  tableHeader: {
    minHeight: 28,
    backgroundColor: '#ebe6d8',
  },
  headCell: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  cellCode: {
    width: 86,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
  },
  cellName: {
    flex: 1,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
  },
  cellQty: {
    width: 38,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  cellPrice: {
    width: 82,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    paddingRight: 5,
  },
  detailTotals: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  detailTotalLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  detailTotalValue: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyPanel: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  message: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
});
