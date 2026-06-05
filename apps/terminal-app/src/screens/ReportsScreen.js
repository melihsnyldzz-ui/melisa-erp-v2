import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { getPendingQueue } from '../services/queueService';
import { colors, terminalStyles } from '../styles/theme';

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

function isDuplicate(event) {
  return event.lastErrorMessage === 'Daha once gonderilmis'
    || Boolean(event.serverResponse?.duplicate)
    || Boolean(event.serverResponse?.data?.duplicate);
}

function SentReceiptCard({ event }) {
  const payload = event.payload || {};
  const currency = saleCurrency(payload);
  const duplicate = isDuplicate(event);
  const response = event.serverResponse || {};
  const receiptNo = response.receiptNo || response.salesReceiptNo || response.documentNo || response.id || event.clientEventId;

  return (
    <View style={[styles.receiptCard, duplicate && styles.receiptCardDuplicate]}>
      <View style={styles.receiptHeader}>
        <View style={styles.receiptTitleBlock}>
          <Text style={styles.customerName}>{payload.customerName || payload.customerCode || `Cari #${payload.customerId || '-'}`}</Text>
          <Text style={styles.receiptMeta}>{payload.customerCode || '-'} / {formatDate(event.lastAttemptAt || event.clientCreatedAt)}</Text>
        </View>
        <Text style={[styles.statusPill, duplicate && styles.statusDuplicate]}>
          {duplicate ? 'Duplicate' : 'Sonuclandi'}
        </Text>
      </View>

      <View style={styles.factRow}>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Fis</Text>
          <Text style={styles.factValueSmall} numberOfLines={1}>{receiptNo}</Text>
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

      <View style={styles.linesBox}>
        {(payload.items || []).slice(0, 4).map((item, index) => (
          <View key={`${event.clientEventId}-${item.productId || index}`} style={styles.lineRow}>
            <View style={styles.lineText}>
              <Text style={styles.lineName}>{item.productName || item.stockCode || `Urun #${item.productId || '-'}`}</Text>
              <Text style={styles.lineMeta}>{item.stockCode || item.barcode || '-'} / {Number(item.quantity || 0)} x {formatMoney(item.unitPrice, item.currency || currency)}</Text>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0), item.currency || currency)}</Text>
          </View>
        ))}
        {(payload.items || []).length > 4 ? (
          <Text style={styles.moreText}>+{(payload.items || []).length - 4} satir daha</Text>
        ) : null}
      </View>

      <Text style={styles.eventId}>{event.clientEventId}</Text>
    </View>
  );
}

export function ReportsScreen({ navigation, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState('');

  const sentSales = useMemo(() => (
    queue
      .filter((event) => event.eventType === 'terminal_sale' && event.status === 'synced')
      .sort((a, b) => String(b.lastAttemptAt || b.clientCreatedAt).localeCompare(String(a.lastAttemptAt || a.clientCreatedAt)))
  ), [queue]);

  const summary = useMemo(() => sentSales.reduce((acc, event) => {
    const payload = event.payload || {};
    const currency = saleCurrency(payload);
    const total = saleTotal(payload);

    return {
      count: acc.count + 1,
      duplicate: acc.duplicate + (isDuplicate(event) ? 1 : 0),
      quantity: acc.quantity + saleQuantity(payload),
      totals: {
        ...acc.totals,
        [currency]: Number(acc.totals[currency] || 0) + total,
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

  useEffect(() => {
    refreshReports();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroPanel}>
        <Text style={styles.heroTitle}>Terminal Raporlari</Text>
        <Text style={styles.heroText}>Gonderilen satis fisleri bu terminalde sonuc kaydi olarak kalir.</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Gonderilen</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Duplicate</Text>
          <Text style={styles.summaryValue}>{summary.duplicate}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Adet</Text>
          <Text style={styles.summaryValue}>{summary.quantity}</Text>
        </View>
      </View>

      <View style={styles.totalPanel}>
        <Text style={styles.sectionTitle}>Toplamlar</Text>
        {Object.keys(summary.totals).length ? (
          Object.keys(summary.totals).map((currency) => (
            <View key={currency} style={styles.totalRow}>
              <Text style={styles.totalCurrency}>{currency}</Text>
              <Text style={styles.totalValue}>{formatMoney(summary.totals[currency], currency)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Henuz gonderilmis fis yok.</Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gonderilen Fisler</Text>
        <Text style={styles.sectionMeta}>Sonuclanmis terminal gecmisi</Text>
      </View>

      {sentSales.length ? sentSales.map((event) => (
        <SentReceiptCard key={event.clientEventId} event={event} />
      )) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Liste bos</Text>
          <Text style={styles.emptyText}>Fis gonderildiginde burada sonucuyla gorunecek.</Text>
        </View>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TerminalButton label="Yenile" onPress={refreshReports} variant="secondary" />
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
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 12,
    gap: 5,
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
  totalPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 12,
    gap: 8,
  },
  totalRow: {
    minHeight: 44,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  totalCurrency: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  receiptCard: {
    borderColor: colors.success,
    borderWidth: 1,
    borderLeftColor: colors.success,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 12,
    gap: 10,
    ...terminalStyles.rowShadow,
  },
  receiptCardDuplicate: {
    borderColor: colors.warning,
    borderLeftColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  receiptTitleBlock: {
    flex: 1,
  },
  customerName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  receiptMeta: {
    color: colors.muted,
    fontSize: 11,
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
  factRow: {
    flexDirection: 'row',
    gap: 7,
  },
  factBox: {
    flex: 1,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
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
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  linesBox: {
    gap: 8,
  },
  lineRow: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 9,
    gap: 6,
  },
  lineText: {
    flex: 1,
  },
  lineName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  lineMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  lineTotal: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  moreText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  eventId: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
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
    lineHeight: 18,
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
});
