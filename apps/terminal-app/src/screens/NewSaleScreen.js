import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { lookupProductByBarcode } from '../services/productService';
import { enqueueTerminalSale, syncPendingTerminalSales } from '../services/queueService';
import { buildTerminalSalePayload, searchTerminalCustomers, submitTerminalSale } from '../services/terminalSalesService';
import { colors } from '../styles/theme';

function normalizeCustomer(row) {
  return {
    id: row.id,
    customerCode: row.customerCode,
    customerName: row.customerName,
    currency: row.currency || 'TRY',
    balance: Number(row.balance || 0),
  };
}

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

export function NewSaleScreen({ session, navigation, onRefresh }) {
  const barcodeRef = useRef(null);
  const [customerQuery, setCustomerQuery] = useState('PESIN-TL');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lines, setLines] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0) * Number(line.unitPrice || 0)
  ), 0), [lines]);

  async function searchCustomer() {
    const q = customerQuery.trim();
    if (!q) return;

    setError('');
    setLoading(true);
    try {
      const response = await searchTerminalCustomers({
        q,
        token: session.accessToken,
        limit: 8,
      });
      const customers = (response.data || []).map(normalizeCustomer);
      setCustomerResults(customers);
      if (customers.length === 1) {
        setSelectedCustomer(customers[0]);
        setMessage(`${customers[0].customerName} secildi`);
        setTimeout(() => barcodeRef.current?.focus(), 100);
      } else if (customers.length === 0) {
        setMessage('Cari bulunamadi');
      }
    } catch (searchError) {
      setError(searchError.message || 'Cari arama basarisiz');
    } finally {
      setLoading(false);
    }
  }

  async function addBarcodeLine() {
    const trimmedBarcode = barcode.trim();
    const parsedQuantity = Number(quantity || 1);

    if (!selectedCustomer) {
      setError('Once cari secin');
      return;
    }

    if (!trimmedBarcode || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Barkod ve miktar zorunlu');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await lookupProductByBarcode({
        barcode: trimmedBarcode,
        token: session.accessToken,
      });
      const product = result.selectedProduct;
      if (!product) {
        setError('Urun bulunamadi');
        return;
      }

      setLines((current) => {
        const existingIndex = current.findIndex((line) => String(line.product.id) === String(product.id));
        if (existingIndex < 0) {
          return [
            ...current,
            {
              product,
              quantity: parsedQuantity,
              unitPrice: Number(product.salePrice || 0),
            },
          ];
        }

        return current.map((line, index) => (
          index === existingIndex
            ? { ...line, quantity: Number(line.quantity || 0) + parsedQuantity }
            : line
        ));
      });
      setBarcode('');
      setQuantity('1');
      setMessage(`${product.productName} eklendi`);
    } catch (lookupError) {
      setError(lookupError.message || 'Barkod okunamadi');
    } finally {
      setLoading(false);
      setTimeout(() => barcodeRef.current?.focus(), 120);
    }
  }

  async function finishSale() {
    if (!selectedCustomer || lines.length === 0) {
      setError('Cari ve en az bir satir gerekli');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    const basePayload = buildTerminalSalePayload({
      customer: selectedCustomer,
      lines,
      terminalCode: terminalConfig.terminalCode,
      note: 'Terminal hizli satis',
    });

    try {
      const queuedEvent = await enqueueTerminalSale(basePayload);
      const response = await submitTerminalSale({
        token: session.accessToken,
        payload: {
          ...basePayload,
          clientEventId: queuedEvent.clientEventId,
        },
      });
      const duplicate = Boolean(response?.data?.duplicate || response?.duplicate);
      setMessage(duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi');
      setLines([]);
      await syncPendingTerminalSales({ token: session.accessToken });
      await onRefresh();
    } catch (submitError) {
      setMessage('Baglanti yok, fis gonderilemeyenlere alindi');
      setError(submitError.message || 'Online gonderim basarisiz');
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function syncQueue() {
    setLoading(true);
    setError('');
    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      setMessage(`Sync: ${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`);
      if (result.lastErrorMessage) {
        setError(result.lastErrorMessage);
      }
      await onRefresh();
    } catch (syncError) {
      setError(syncError.message || 'Sync basarisiz');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>Yeni Terminal Satis</Text>
        <Text style={styles.meta}>{terminalConfig.terminalCode} / {terminalConfig.deviceName}</Text>

        <Text style={styles.label}>Cari ara</Text>
        <View style={styles.row}>
          <TextInput
            value={customerQuery}
            onChangeText={setCustomerQuery}
            onSubmitEditing={searchCustomer}
            style={styles.input}
            placeholder="PESIN-TL veya cari adi"
            autoCapitalize="none"
          />
          <TerminalButton label="Ara" onPress={searchCustomer} disabled={loading} />
        </View>

        {selectedCustomer ? (
          <View style={styles.selectedBox}>
            <InfoRow label="Cari" value={selectedCustomer.customerName} />
            <InfoRow label="Kod" value={selectedCustomer.customerCode} />
            <InfoRow label="Para" value={selectedCustomer.currency} />
          </View>
        ) : null}

        {customerResults.length > 1 ? (
          <View style={styles.resultList}>
            {customerResults.map((customer) => (
              <TerminalButton
                key={customer.id}
                label={`${customer.customerCode} - ${customer.customerName}`}
                onPress={() => {
                  setSelectedCustomer(customer);
                  setMessage(`${customer.customerName} secildi`);
                  setTimeout(() => barcodeRef.current?.focus(), 100);
                }}
                variant="secondary"
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Barkod</Text>
        <TextInput
          ref={barcodeRef}
          value={barcode}
          onChangeText={setBarcode}
          onSubmitEditing={addBarcodeLine}
          style={styles.barcodeInput}
          placeholder="Barkod okut"
          keyboardType="number-pad"
          returnKeyType="done"
        />
        <Text style={styles.label}>Miktar</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={styles.input}
          keyboardType="decimal-pad"
        />
        <TerminalButton label="Satira Ekle" onPress={addBarcodeLine} disabled={loading} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Fis Satirlari</Text>
        {lines.length === 0 ? (
          <Text style={styles.empty}>Henuz satir yok.</Text>
        ) : lines.map((line) => (
          <View key={line.product.id} style={styles.lineRow}>
            <View style={styles.lineText}>
              <Text style={styles.lineName}>{line.product.productName}</Text>
              <Text style={styles.lineMeta}>{line.product.stockCode} / {line.product.barcodeMasked}</Text>
            </View>
            <Text style={styles.lineAmount}>
              {line.quantity} x {formatMoney(line.unitPrice, line.product.currency)}
            </Text>
          </View>
        ))}
        <InfoRow label="Toplam" value={formatMoney(total, selectedCustomer?.currency || 'TRY')} tone="success" />
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <TerminalButton label="Fisi Gonder" onPress={finishSale} disabled={loading || lines.length === 0} />
      <TerminalButton label="Bekleyenleri Gonder" onPress={syncQueue} disabled={loading} variant="secondary" />
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
    gap: 8,
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
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  row: {
    gap: 8,
  },
  input: {
    minHeight: 48,
    borderColor: colors.borderDark,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  barcodeInput: {
    minHeight: 66,
    borderColor: colors.borderDark,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    paddingHorizontal: 10,
  },
  selectedBox: {
    borderColor: colors.success,
    borderWidth: 1,
    backgroundColor: '#f2fff7',
    paddingHorizontal: 8,
  },
  resultList: {
    gap: 7,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  lineRow: {
    minHeight: 54,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lineText: {
    flex: 1,
  },
  lineName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  lineMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  lineAmount: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
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
