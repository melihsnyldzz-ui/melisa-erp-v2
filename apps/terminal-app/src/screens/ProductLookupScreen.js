import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { findCachedProduct, saveProductCache } from '../services/cacheService';
import { searchTerminalProducts } from '../services/terminalSalesService';
import { colors } from '../styles/theme';

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

function normalizeProduct(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode || '-',
    productName: row.productName || row.name || '-',
    brand: row.brand || '-',
    category: row.category || '-',
    currency: row.currency || 'TRY',
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || row.quantity || 0),
    isPassive: Boolean(row.isPassive),
  };
}

function getProductsFromResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.products)) {
    return response.products;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function sourceLabel(source) {
  if (source === 'api') return 'API';
  if (source === 'cache') return 'local cache';
  if (source === 'alternative') return 'operator secimi';
  return source || 'manual';
}

function ProductFact({ label, value, tone = 'neutral' }) {
  return (
    <View style={[styles.factCard, styles[`factCard_${tone}`]]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function ProductLookupScreen({ lastLookup, navigation, session }) {
  const initialProduct = normalizeProduct(lastLookup?.selectedProduct);
  const [query, setQuery] = useState(lastLookup?.barcode || '');
  const [selectedProduct, setSelectedProduct] = useState(initialProduct);
  const [results, setResults] = useState(initialProduct ? [initialProduct] : []);
  const [source, setSource] = useState(lastLookup?.source || 'manual');
  const [warning, setWarning] = useState(lastLookup?.warning || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextProduct = normalizeProduct(lastLookup?.selectedProduct);
    if (nextProduct) {
      setSelectedProduct(nextProduct);
      setResults([nextProduct]);
      setSource(lastLookup?.source || 'barcode');
      setWarning(lastLookup?.warning || '');
      setQuery(lastLookup?.barcode || nextProduct.barcodeMasked || nextProduct.stockCode || '');
    }
  }, [lastLookup]);

  const search = async () => {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      setError('Arama icin barkod, stok kodu veya urun adi yazin.');
      return;
    }

    setLoading(true);
    setError('');
    setWarning('');

    try {
      const response = await searchTerminalProducts({
        q: normalizedQuery,
        token: session?.accessToken,
        limit: 20,
      });
      const products = getProductsFromResponse(response).map(normalizeProduct).filter(Boolean);
      await saveProductCache(products);

      setResults(products);
      setSelectedProduct(products[0] || null);
      setSource('API');
      if (!products.length) {
        setWarning('API sonucu bos. Barkod/stok kodu veya urun adini kontrol edin.');
      }
    } catch (err) {
      const cached = normalizeProduct(await findCachedProduct(normalizedQuery));
      setSource('local cache');
      setResults(cached ? [cached] : []);
      setSelectedProduct(cached);
      setWarning(cached ? 'API erisilemedi, local cache sonucu gosteriliyor.' : '');
      setError(cached ? '' : `Hata: ${err.message || 'Urun bulunamadi'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>Urun Arama</Text>
        <Text style={styles.meta}>
          Kaynak: {sourceLabel(source)} / Son barkod: {lastLookup?.barcode || '-'}
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Barkod, stok kodu veya urun adi"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <TerminalButton label={loading ? 'Araniyor' : 'Ara'} onPress={search} disabled={loading} />
        </View>

        {loading ? <ActivityIndicator color={colors.accentDark} /> : null}
        {warning ? <Text style={styles.warning}>{warning}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {results.length > 1 ? (
        <View style={styles.resultPanel}>
          <Text style={styles.sectionTitle}>Bulunan urunler</Text>
          {results.map((product) => (
            <Pressable
              key={`${product.id || product.stockCode}-${product.barcodeMasked}`}
              onPress={() => setSelectedProduct(product)}
              style={[
                styles.resultRow,
                selectedProduct?.id === product.id && styles.selectedResultRow,
              ]}
            >
              <Text style={styles.resultName}>{product.productName}</Text>
              <Text style={styles.resultMeta}>
                {product.stockCode} / {product.barcodeMasked} / Stok {product.stockQuantity}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!selectedProduct ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Urun secili degil</Text>
          <Text style={styles.emptyText}>Barkod okutun veya yukaridan manuel arama yapin.</Text>
        </View>
      ) : (
        <View style={[styles.productPanel, selectedProduct.isPassive && styles.passivePanel]}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceBadge}>Kaynak: {sourceLabel(source)}</Text>
            <Text style={[styles.sourceBadge, selectedProduct.isPassive ? styles.sourceDanger : styles.sourceSuccess]}>
              {selectedProduct.isPassive ? 'PASIF' : 'AKTIF'}
            </Text>
          </View>
          <Text style={styles.productName}>{selectedProduct.productName}</Text>
          <View style={styles.factGrid}>
            <ProductFact
              label="Stok"
              value={String(selectedProduct.stockQuantity)}
              tone={selectedProduct.stockQuantity > 0 ? 'success' : 'danger'}
            />
            <ProductFact
              label="Satis"
              value={formatMoney(selectedProduct.salePrice, selectedProduct.currency)}
              tone="neutral"
            />
          </View>
          <InfoRow label="Stok kodu" value={selectedProduct.stockCode} />
          <InfoRow label="Barkod" value={selectedProduct.barcodeMasked} />
          <InfoRow label="Marka" value={selectedProduct.brand} />
          <InfoRow label="Kategori" value={selectedProduct.category} />
          <InfoRow label="Mevcut stok" value={String(selectedProduct.stockQuantity)} tone={selectedProduct.stockQuantity < 0 ? 'danger' : 'normal'} />
          <InfoRow label="Satis fiyat" value={formatMoney(selectedProduct.salePrice, selectedProduct.currency)} />
          <InfoRow label="Durum" value={selectedProduct.isPassive ? 'PASIF' : 'AKTIF'} tone={selectedProduct.isPassive ? 'danger' : 'success'} />

          {selectedProduct.isPassive ? (
            <Text style={styles.passiveNote}>Pasif urun yeni terminal satisinda secilmemelidir.</Text>
          ) : null}
        </View>
      )}

      <TerminalButton label="Yeni barkod okut" onPress={navigation.openBarcode} />
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
    padding: 12,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  searchRow: {
    gap: 8,
  },
  input: {
    minHeight: 52,
    backgroundColor: colors.input,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  resultPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultRow: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 10,
    backgroundColor: colors.panel,
  },
  selectedResultRow: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  resultName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  resultMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 8,
  },
  sourceBadge: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sourceSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  sourceDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  factGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  factCard: {
    flex: 1,
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
  },
  factCard_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  factCard_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  factCard_neutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  factValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  emptyPanel: {
    minHeight: 170,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  productPanel: {
    backgroundColor: colors.white,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passivePanel: {
    opacity: 0.75,
    borderColor: colors.danger,
  },
  productName: {
    marginBottom: 5,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  passiveNote: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
});
