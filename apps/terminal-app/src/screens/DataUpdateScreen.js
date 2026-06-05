import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { getCacheSummary, markCacheUpdated, replaceCustomerCache, replaceProductCache } from '../services/cacheService';
import { downloadAllTerminalCustomers, downloadAllTerminalProducts } from '../services/terminalSalesService';
import { colors } from '../styles/theme';

function normalizeProduct(row) {
  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    currency: row.currency,
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || 0),
    isPassive: Boolean(row.isPassive),
  };
}

function normalizeCustomer(row) {
  return {
    id: row.id,
    customerCode: row.customerCode,
    customerName: row.customerName,
    phoneMasked: row.phoneMasked,
    city: row.city,
    currency: row.currency || 'TRY',
    balance: Number(row.balance || 0),
    isPassive: Boolean(row.isPassive),
  };
}

function formatDate(value) {
  if (!value) return 'Henuz yok';
  return new Date(value).toLocaleString('tr-TR');
}

function DataCard({ label, value, helper, tone = 'neutral' }) {
  return (
    <View style={[styles.dataCard, styles[`dataCard_${tone}`]]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
      <Text style={styles.dataHelper}>{helper}</Text>
    </View>
  );
}

export function DataUpdateScreen({ session, navigation, onRefresh }) {
  const [summary, setSummary] = useState({ productCount: 0, customerCount: 0 });
  const [lastResult, setLastResult] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refreshSummary() {
    setSummary(await getCacheSummary());
  }

  useEffect(() => {
    refreshSummary();
  }, []);

  async function updateProducts() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await downloadAllTerminalProducts({ token: session.accessToken, pageSize: 100 });
      const products = response.rows.map(normalizeProduct);
      await replaceProductCache(products);
      await markCacheUpdated('product', products.length);
      await refreshSummary();
      await onRefresh();
      setLastResult({
        kind: 'Urun',
        count: products.length,
        totalRows: response.totalRows,
        pageCount: response.pageCount,
        totalPages: response.totalPages,
        truncated: response.truncated,
      });
      setMessage(response.truncated
        ? `${products.length}/${response.totalRows} urun indirildi. API sayfa limiti nedeniyle eksik kaldi.`
        : `${products.length} urun indirildi ve local cache yenilendi`);
    } catch (updateError) {
      setError(updateError.message || 'Urun cache guncellenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function updateCustomers() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await downloadAllTerminalCustomers({ token: session.accessToken, pageSize: 100 });
      const customers = response.rows.map(normalizeCustomer);
      await replaceCustomerCache(customers);
      await markCacheUpdated('customer', customers.length);
      await refreshSummary();
      await onRefresh();
      setLastResult({
        kind: 'Cari',
        count: customers.length,
        totalRows: response.totalRows,
        pageCount: response.pageCount,
        totalPages: response.totalPages,
        truncated: response.truncated,
      });
      setMessage(response.truncated
        ? `${customers.length}/${response.totalRows} cari indirildi. API sayfa limiti nedeniyle eksik kaldi.`
        : `${customers.length} cari indirildi ve local cache yenilendi`);
    } catch (updateError) {
      setError(updateError.message || 'Cari cache guncellenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function updateAll() {
    setLoading(true);
    setError('');
    setMessage('');
    setLastResult(null);

    try {
      const [productResponse, customerResponse] = await Promise.all([
        downloadAllTerminalProducts({ token: session.accessToken, pageSize: 100 }),
        downloadAllTerminalCustomers({ token: session.accessToken, pageSize: 100 }),
      ]);
      const products = productResponse.rows.map(normalizeProduct);
      const customers = customerResponse.rows.map(normalizeCustomer);

      await Promise.all([
        replaceProductCache(products),
        replaceCustomerCache(customers),
      ]);
      await markCacheUpdated('product', products.length);
      await markCacheUpdated('customer', customers.length);

      await refreshSummary();
      await onRefresh();
      setLastResult({
        kind: 'Tum veri',
        productCount: products.length,
        customerCount: customers.length,
        productPages: productResponse.pageCount,
        customerPages: customerResponse.pageCount,
        productTotalRows: productResponse.totalRows,
        customerTotalRows: customerResponse.totalRows,
        productTotalPages: productResponse.totalPages,
        customerTotalPages: customerResponse.totalPages,
        truncated: productResponse.truncated || customerResponse.truncated,
      });
      setMessage(productResponse.truncated || customerResponse.truncated
        ? `${products.length}/${productResponse.totalRows} urun, ${customers.length}/${customerResponse.totalRows} cari indirildi. Eksik kalan sayfa var.`
        : `${products.length} urun, ${customers.length} cari indirildi. Terminal offline satis icin hazir.`);
    } catch (updateError) {
      setError(updateError.message || 'Tum veri guncellenemedi');
    } finally {
      setLoading(false);
    }
  }

  const hasProducts = Number(summary.productCount || 0) > 0;
  const hasCustomers = Number(summary.customerCount || 0) > 0;
  const ready = hasProducts && hasCustomers;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.readyPanel, ready ? styles.readyPanelSuccess : styles.readyPanelWarning]}>
        <Text style={styles.readyTitle}>{ready ? 'Veri hazir' : 'Veri eksik'}</Text>
        <Text style={styles.readyText}>
          {ready
            ? 'Urun ve cari cache var. Internet kesilse bile satis ekrani local veriden calisabilir.'
            : 'Saha oncesi tum veriyi guncelleyin. Urun ve cari cache olmadan offline satis aksar.'}
        </Text>
      </View>

      <View style={styles.dataGrid}>
        <DataCard
          label="Urun"
          value={String(summary.productCount || 0)}
          helper={`Son: ${formatDate(summary.productCachedAt)}`}
          tone={hasProducts ? 'success' : 'warning'}
        />
        <DataCard
          label="Cari"
          value={String(summary.customerCount || 0)}
          helper={`Son: ${formatDate(summary.customerCachedAt)}`}
          tone={hasCustomers ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Veri Guncelle</Text>
        <Text style={styles.meta}>Saha oncesi urun ve cari cache bilgisini telefona indirir.</Text>
        <InfoRow label="Urun cache" value={String(summary.productCount || 0)} />
        <InfoRow label="Cari cache" value={String(summary.customerCount || 0)} />
        <InfoRow label="Urun son guncelleme" value={formatDate(summary.productCachedAt)} />
        <InfoRow label="Cari son guncelleme" value={formatDate(summary.customerCachedAt)} />
        <InfoRow label="Son indirilen urun" value={summary.productCachedCount ? String(summary.productCachedCount) : '-'} />
        <InfoRow label="Son indirilen cari" value={summary.customerCachedCount ? String(summary.customerCachedCount) : '-'} />
      </View>

      {lastResult ? (
        <View style={styles.resultPanel}>
          <Text style={styles.resultTitle}>Son indirme sonucu</Text>
          <InfoRow label="Tur" value={lastResult.kind} />
          {lastResult.productCount !== undefined ? (
            <>
              <InfoRow label="Urun" value={`${lastResult.productCount} kayit / ${lastResult.productPages} sayfa`} />
              <InfoRow label="Cari" value={`${lastResult.customerCount} kayit / ${lastResult.customerPages} sayfa`} />
              <InfoRow label="API toplam urun" value={String(lastResult.productTotalRows ?? '-')} />
              <InfoRow label="API toplam cari" value={String(lastResult.customerTotalRows ?? '-')} />
            </>
          ) : (
            <>
              <InfoRow label="Kayit" value={String(lastResult.count)} />
              <InfoRow label="API toplam" value={String(lastResult.totalRows)} />
              <InfoRow label="Sayfa" value={`${lastResult.pageCount}/${lastResult.totalPages || lastResult.pageCount}`} />
            </>
          )}
          {lastResult.truncated ? <InfoRow label="Durum" value="Eksik indirildi" /> : null}
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <TerminalButton label="Tum Veriyi Guncelle" onPress={updateAll} disabled={loading} />
      <TerminalButton label="Urunleri Guncelle" onPress={updateProducts} disabled={loading} variant="secondary" />
      <TerminalButton label="Carileri Guncelle" onPress={updateCustomers} disabled={loading} variant="secondary" />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    gap: 10,
  },
  readyPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 5,
  },
  readyPanelSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  readyPanelWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  readyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  readyText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  dataGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  dataCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'space-between',
    gap: 4,
  },
  dataCard_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  dataCard_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  dataCard_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  dataLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dataValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  dataHelper: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  resultPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
