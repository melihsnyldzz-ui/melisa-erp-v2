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

function receiptNumber(event) {
  const response = event.serverResponse || {};
  return response.receiptNo || response.salesReceiptNo || response.documentNo || response.id || event.clientEventId;
}

function isDuplicate(event) {
  return event.lastErrorMessage === 'Daha once gonderilmis'
    || Boolean(event.serverResponse?.duplicate)
    || Boolean(event.serverResponse?.data?.duplicate);
}

function ReceiptListRow({ event, onPress }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);

  return (
    <Pressable onPress={() => onPress(event)} style={({ pressed }) => [styles.receiptRow, pressed && styles.pressedRow]}>
      <View style={styles.receiptMain}>
        <Text style={styles.receiptCustomer} numberOfLines={1}>{payload.customerName || payload.customerCode || `Cari #${payload.customerId || '-'}`}</Text>
        <Text style={styles.receiptSub} numberOfLines={1}>{payload.customerCode || '-'} / {formatDate(event.lastAttemptAt || event.clientCreatedAt)}</Text>
      </View>
      <Text style={styles.receiptQty}>{saleQuantity(payload)}</Text>
      <Text style={styles.receiptTotal}>{formatMoney(saleTotal(payload), currency)}</Text>
    </Pressable>
  );
}

function ReceiptDetail({ event, onBack, onPrint }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const duplicate = isDuplicate(event);

  return (
    <>
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleBlock}>
          <Text style={styles.detailTitle} numberOfLines={1}>{payload.customerName || payload.customerCode || '-'}</Text>
          <Text style={styles.detailMeta}>{payload.customerCode || '-'} / {formatDate(event.lastAttemptAt || event.clientCreatedAt)}</Text>
          <Text style={styles.detailId} numberOfLines={1}>{receiptNumber(event)}</Text>
        </View>
        <Text style={[styles.statusPill, duplicate && styles.statusDuplicate]}>{duplicate ? 'Duplicate' : 'Sonuclandi'}</Text>
      </View>

      <View style={styles.detailActions}>
        <TerminalButton label="Yazdir" onPress={() => onPrint(event)} />
        <TerminalButton label="Listeye Don" onPress={onBack} variant="secondary" />
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
    </>
  );
}

export function ReportsScreen({ navigation, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [message, setMessage] = useState('');

  const sentSales = useMemo(() => (
    queue
      .filter((event) => event.eventType === 'terminal_sale' && event.status === 'synced')
      .sort((a, b) => String(b.lastAttemptAt || b.clientCreatedAt).localeCompare(String(a.lastAttemptAt || a.clientCreatedAt)))
  ), [queue]);

  const selectedEvent = useMemo(() => (
    sentSales.find((event) => event.clientEventId === selectedEventId) || null
  ), [sentSales, selectedEventId]);

  const summary = useMemo(() => sentSales.reduce((acc, event) => {
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
  }), [sentSales]);

  async function refreshReports() {
    setQueue(await getPendingQueue());
    setMessage('Raporlar yenilendi');
    await onRefresh?.();
  }

  function printReceipt() {
    if (typeof globalThis?.print === 'function') {
      globalThis.print();
      setMessage('Yazdirma penceresi acildi');
      return;
    }

    setMessage('Yazdirma butonu hazir. Telefon yazici baglantisi sonraki fazda baglanacak.');
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
            <Text style={styles.listTitle}>Gonderilen Fisler</Text>
            <Text style={styles.listMeta}>Fis detayina girmek icin satira dokunun.</Text>
          </View>

          <View style={styles.receiptList}>
            {sentSales.length ? sentSales.map((event) => (
              <ReceiptListRow
                key={event.clientEventId}
                event={event}
                onPress={(nextEvent) => setSelectedEventId(nextEvent.clientEventId)}
              />
            )) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>Liste bos</Text>
                <Text style={styles.emptyText}>Fis gonderildiginde burada gorunecek.</Text>
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
    minWidth: 84,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
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
  detailActions: {
    gap: 7,
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
});
