import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { getCacheSummary, markCacheUpdated, saveCustomerCache, saveProductCache } from '../services/cacheService';
import { downloadTerminalCustomers, downloadTerminalProducts } from '../services/terminalSalesService';
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
      const response = await downloadTerminalProducts({ token: session.accessToken, limit: 100 });
      const products = (response.data || []).map(normalizeProduct);
      await saveProductCache(products);
      await markCacheUpdated('product', products.length);
      await refreshSummary();
      await onRefresh();
      setMessage(`${products.length} urun cache guncellendi`);
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
      const response = await downloadTerminalCustomers({ token: session.accessToken, limit: 100 });
      const customers = (response.data || []).map(normalizeCustomer);
      await saveCustomerCache(customers);
      await markCacheUpdated('customer', customers.length);
      await refreshSummary();
      await onRefresh();
      setMessage(`${customers.length} cari cache guncellendi`);
    } catch (updateError) {
      setError(updateError.message || 'Cari cache guncellenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function updateAll() {
    await updateProducts();
    await updateCustomers();
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
      </View>

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
    borderRadius: 4,
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
