import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { colors } from '../styles/theme';

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

export function ProductLookupScreen({ lastLookup, navigation }) {
  const product = lastLookup?.selectedProduct || null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>Urun Lookup</Text>
        <Text style={styles.meta}>
          Kaynak: {lastLookup?.source === 'cache' ? 'local cache' : 'API'} / Barkod: {lastLookup?.barcode || '-'}
        </Text>
        {lastLookup?.warning ? <Text style={styles.warning}>{lastLookup.warning}</Text> : null}
      </View>

      {!product ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Urun secili degil</Text>
          <Text style={styles.emptyText}>Barkod okut ekranindan lookup yapin.</Text>
        </View>
      ) : (
        <View style={[styles.productPanel, product.isPassive && styles.passivePanel]}>
          <Text style={styles.productName}>{product.productName}</Text>
          <InfoRow label="Stok kodu" value={product.stockCode} />
          <InfoRow label="Barkod" value={product.barcodeMasked} />
          <InfoRow label="Marka" value={product.brand} />
          <InfoRow label="Kategori" value={product.category} />
          <InfoRow label="Mevcut stok" value={String(product.stockQuantity)} tone={product.stockQuantity < 0 ? 'danger' : 'normal'} />
          <InfoRow label="Satis fiyat" value={formatMoney(product.salePrice, product.currency)} />
          <InfoRow label="Durum" value={product.isPassive ? 'PASIF' : 'AKTIF'} tone={product.isPassive ? 'danger' : 'success'} />

          {product.isPassive ? (
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
    borderRadius: 4,
    padding: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  warning: {
    marginTop: 8,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyPanel: {
    minHeight: 170,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
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
    backgroundColor: '#ffffff',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 4,
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
