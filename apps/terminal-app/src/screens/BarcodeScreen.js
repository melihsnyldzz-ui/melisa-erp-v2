import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { lookupProductByBarcode } from '../services/productService';
import { colors } from '../styles/theme';

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

export function BarcodeScreen({ session, syncState, navigation, onLookupResult }) {
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [alternatives, setAlternatives] = useState([]);
  const [lastSearchedBarcode, setLastSearchedBarcode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  async function submitLookup() {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || loading) return;

    setError('');
    setWarning('');
    setAlternatives([]);
    setLastSearchedBarcode(trimmedBarcode);
    setLoading(true);

    try {
      const result = await lookupProductByBarcode({
        barcode: trimmedBarcode,
        token: session.accessToken,
      });
      setBarcode('');
      onLookupResult(result);
    } catch (lookupError) {
      setError(lookupError.message || 'Barkod bulunamadi');
      const nextAlternatives = Array.isArray(lookupError.alternatives) ? lookupError.alternatives : [];
      setAlternatives(nextAlternatives);
      if (nextAlternatives.length) {
        setWarning('Tam barkod bulunamadi. Benzer urunleri kontrol edin.');
      }
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }

  function selectAlternative(product) {
    onLookupResult({
      source: 'alternative',
      barcode: lastSearchedBarcode || barcode.trim(),
      products: alternatives,
      selectedProduct: product,
      warning: 'Tam barkod eslesmedi; operator alternatif urun secti.',
      searchedAt: new Date().toISOString(),
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <View style={[styles.modePanel, syncState.online ? styles.modeOnline : styles.modeOffline]}>
          <Text style={styles.modeTitle}>{syncState.online ? 'Online barkod arama' : 'Offline cache arama'}</Text>
          <Text style={styles.modeText}>
            {syncState.online
              ? 'API cevap verirse en guncel stok karti acilir.'
              : 'API kapaliysa telefondaki local cache sonucu kullanilir.'}
          </Text>
        </View>

        <Text style={styles.title}>Barkod Okut</Text>
        <Text style={styles.subText}>
          Donanim scanner Enter gonderdiginde arama otomatik baslar.
        </Text>

        <TextInput
          ref={inputRef}
          value={barcode}
          onChangeText={setBarcode}
          onSubmitEditing={submitLookup}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          returnKeyType="search"
          selectTextOnFocus
          style={styles.barcodeInput}
          placeholder="Barkod"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {warning ? <Text style={styles.warning}>{warning}</Text> : null}

        {alternatives.length ? (
          <View style={styles.alternativePanel}>
            <Text style={styles.alternativeTitle}>Benzer urunler</Text>
            {alternatives.map((product) => (
              <Pressable
                key={`${product.id}-${product.barcodeMasked || product.matchedBarcode || product.stockCode}`}
                onPress={() => selectAlternative(product)}
                style={styles.alternativeRow}
              >
                <Text style={styles.alternativeName}>{product.productName}</Text>
                <Text style={styles.alternativeMeta}>
                  {product.stockCode} / {product.matchedBarcode || product.barcodeMasked || '-'}
                </Text>
                <View style={styles.alternativeFacts}>
                  <Text style={styles.factPill}>Stok {product.stockQuantity}</Text>
                  <Text style={styles.factPill}>{formatMoney(product.salePrice, product.currency)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <TerminalButton label="Ara" onPress={submitLookup} disabled={loading} />
          <TerminalButton label="Temizle" onPress={() => setBarcode('')} variant="secondary" />
        </View>

        {loading ? <ActivityIndicator color={colors.accentDark} style={styles.loader} /> : null}
      </View>

      <View style={styles.statusLine}>
        <Text style={styles.statusText}>
          {syncState.online ? 'Online lookup' : 'Offline cache + queue'}
        </Text>
      </View>

      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 12,
    gap: 10,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  modePanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 3,
  },
  modeOnline: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  modeOffline: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  modeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  barcodeInput: {
    marginTop: 14,
    minHeight: 72,
    borderColor: colors.borderDark,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 12,
  },
  buttonRow: {
    marginTop: 10,
    gap: 8,
  },
  error: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 15,
    fontWeight: '900',
  },
  warning: {
    marginTop: 8,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
  },
  alternativePanel: {
    marginTop: 10,
    gap: 7,
  },
  alternativeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  alternativeRow: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    padding: 10,
  },
  alternativeName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  alternativeMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  alternativeFacts: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  factPill: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  loader: {
    marginTop: 12,
  },
  statusLine: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 10,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
