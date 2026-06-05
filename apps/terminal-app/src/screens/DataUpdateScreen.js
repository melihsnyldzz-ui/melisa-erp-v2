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
      });
      setMessage(`${products.length} urun cache tam yenilendi`);
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
      });
      setMessage(`${customers.length} cari cache tam yenilendi`);
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
      });
      setMessage(`${products.length} urun, ${customers.length} cari cache tam yenilendi`);
    } catch (updateError) {
      setError(updateError.message || 'Tum veri guncellenemedi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={styles.resultTitle}>Son islem</Text>
          <InfoRow label="Tur" value={lastResult.kind} />
          {lastResult.productCount !== undefined ? (
            <>
              <InfoRow label="Urun" value={`${lastResult.productCount} kayit / ${lastResult.productPages} sayfa`} />
              <InfoRow label="Cari" value={`${lastResult.customerCount} kayit / ${lastResult.customerPages} sayfa`} />
            </>
          ) : (
            <>
              <InfoRow label="Kayit" value={String(lastResult.count)} />
              <InfoRow label="API toplam" value={String(lastResult.totalRows)} />
              <InfoRow label="Sayfa" value={String(lastResult.pageCount)} />
            </>
          )}
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
