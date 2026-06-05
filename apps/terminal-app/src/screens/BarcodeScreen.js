import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import { lookupProductByBarcode } from '../services/productService';
import { colors } from '../styles/theme';

export function BarcodeScreen({ session, syncState, navigation, onLookupResult }) {
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  async function submitLookup() {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || loading) return;

    setError('');
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
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
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
