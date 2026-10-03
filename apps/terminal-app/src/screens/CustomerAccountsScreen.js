import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import { searchTerminalCustomers } from '../services/terminalSalesService';
import { colors } from '../styles/theme';

function extractRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.customers)) return response.customers;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function normalizeCustomer(row = {}) {
  const currency = row.currency || row.currencyCode || row.currency_code || 'TRY';
  return {
    id: row.id,
    customerCode: row.customerCode || row.customer_code || row.code || '',
    customerName: row.customerName || row.name || row.customerCode || row.customer_code || 'Cari',
    phone: row.phone || row.phoneMasked || row.gsm || row.mobilePhone || row.mobile_phone || '',
    city: row.city || '',
    country: row.country || '',
    currency,
    balance: Number(row.balance || 0),
    isPassive: Boolean(row.isPassive || row.is_passive),
  };
}

function formatMoney(value, currency = 'TRY') {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatPhone(value) {
  const text = String(value || '').trim();
  if (!text) return 'Telefon yok';
  return text;
}

function CustomerRow({ customer, selected, onPress }) {
  const hasDebt = Number(customer.balance || 0) > 0;
  const hasCredit = Number(customer.balance || 0) < 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.customerRow,
        selected && styles.customerRowSelected,
        customer.isPassive && styles.customerRowPassive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.customerRowMain}>
        <Text style={styles.customerName} numberOfLines={1}>{customer.customerName}</Text>
        <Text style={styles.customerCode} numberOfLines={1}>{customer.customerCode || '-'}</Text>
        <Text style={styles.customerMeta} numberOfLines={1}>
          {formatPhone(customer.phone)} / {customer.city || customer.country || 'Adres yok'}
        </Text>
      </View>
      <View style={styles.customerRowSide}>
        <Text style={styles.currencyBadge}>{customer.currency}</Text>
        <Text style={[
          styles.balanceText,
          hasDebt && styles.balanceDebt,
          hasCredit && styles.balanceCredit,
        ]}
        >
          {formatMoney(customer.balance, customer.currency)}
        </Text>
      </View>
    </Pressable>
  );
}

function DetailLine({ label, value, tone = undefined }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, tone === 'danger' && styles.detailDanger, tone === 'success' && styles.detailSuccess]} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );
}

export function CustomerAccountsScreen({ navigation, session }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedId = selectedCustomer?.id ? String(selectedCustomer.id) : '';

  const totals = useMemo(() => {
    return customers.reduce((acc, customer) => {
      const key = customer.currency || 'TRY';
      acc[key] = (acc[key] || 0) + Number(customer.balance || 0);
      return acc;
    }, {});
  }, [customers]);

  async function loadCustomers(nextQuery = query) {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await searchTerminalCustomers({
        q: nextQuery,
        token: session?.accessToken,
        limit: 40,
      });
      const rows = extractRows(response).map(normalizeCustomer);
      setCustomers(rows);
      setSelectedCustomer((current) => {
        if (!current) return rows[0] || null;
        return rows.find((row) => String(row.id) === String(current.id)) || rows[0] || null;
      });
      setMessage(rows.length ? `${rows.length} cari listelendi.` : 'Cari bulunamadı.');
    } catch (loadError) {
      setCustomers([]);
      setSelectedCustomer(null);
      setError(loadError.message || 'Cari listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardSafeScrollView contentContainerStyle={styles.content}>
      <View style={styles.searchPanel}>
        <View style={styles.searchHeader}>
          <View>
            <Text style={styles.panelTitle}>Müşteri Cari Arama</Text>
            <Text style={styles.panelMeta}>Ad, kod veya telefon ile hızlı erişim</Text>
          </View>
          <Text style={styles.countBadge}>{customers.length} cari</Text>
        </View>

        <KeyboardSafeTextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => loadCustomers(query)}
          placeholder="Müşteri adı, cari kodu veya telefon"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <View style={styles.searchActions}>
          <TerminalButton label={loading ? 'Aranıyor' : 'Cari Ara'} onPress={() => loadCustomers(query)} disabled={loading} />
          <TerminalButton
            label="Temizle"
            variant="secondary"
            onPress={() => {
              setQuery('');
              loadCustomers('');
            }}
            disabled={loading}
          />
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Cari bilgileri alınıyor...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message && !error ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      {selectedCustomer ? (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailTitle}>{selectedCustomer.customerName}</Text>
              <Text style={styles.detailCode}>{selectedCustomer.customerCode || '-'}</Text>
            </View>
            <Text style={styles.detailCurrency}>{selectedCustomer.currency}</Text>
          </View>

          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Cari bakiye</Text>
            <Text style={[
              styles.balanceAmount,
              selectedCustomer.balance > 0 && styles.balanceDebt,
              selectedCustomer.balance < 0 && styles.balanceCredit,
            ]}
            >
              {formatMoney(selectedCustomer.balance, selectedCustomer.currency)}
            </Text>
          </View>

          <DetailLine label="Telefon" value={formatPhone(selectedCustomer.phone)} tone={selectedCustomer.phone ? 'success' : 'danger'} />
          <DetailLine label="Şehir / Ülke" value={[selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(' / ')} />
          <DetailLine label="Durum" value={selectedCustomer.isPassive ? 'Pasif cari' : 'Aktif cari'} tone={selectedCustomer.isPassive ? 'danger' : 'success'} />

          <View style={styles.quickActions}>
            <TerminalButton label="Yeni Satış" onPress={navigation.openNewSale} />
            <TerminalButton label="Ürün Bilgisi" variant="secondary" onPress={navigation.openProductLookup} />
          </View>
        </View>
      ) : null}

      {Object.keys(totals).length ? (
        <View style={styles.summaryPanel}>
          <Text style={styles.panelTitle}>Listelenen bakiye özeti</Text>
          {Object.entries(totals).map(([currency, amount]) => (
            <View key={currency} style={styles.summaryLine}>
              <Text style={styles.summaryCurrency}>{currency}</Text>
              <Text style={[styles.summaryAmount, amount > 0 && styles.balanceDebt, amount < 0 && styles.balanceCredit]}>
                {formatMoney(amount, currency)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.listPanel}>
        <View style={styles.listHeader}>
          <Text style={styles.panelTitle}>Cari Listesi</Text>
          <Text style={styles.panelMeta}>Dokununca kart detayı açılır</Text>
        </View>

        {customers.map((customer) => (
          <CustomerRow
            key={`${customer.id}-${customer.customerCode}`}
            customer={customer}
            selected={String(customer.id) === selectedId}
            onPress={() => setSelectedCustomer(customer)}
          />
        ))}

        {!customers.length && !loading ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>Cari bulunamadı</Text>
            <Text style={styles.emptyText}>Farklı bir ad, kod veya telefon ile tekrar arayın.</Text>
          </View>
        ) : null}
      </View>

      <TerminalButton label="Ana Ekran" variant="secondary" onPress={navigation.goHome} />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 10,
    paddingBottom: 90,
    gap: 10,
  },
  searchPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  panelMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  countBadge: {
    overflow: 'hidden',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  searchInput: {
    minHeight: 52,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 12,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  messageText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  detailPanel: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  detailCode: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  detailCurrency: {
    minWidth: 58,
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  balanceBox: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  balanceLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  balanceAmount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  balanceDebt: {
    color: colors.danger,
  },
  balanceCredit: {
    color: colors.success,
  },
  detailLine: {
    minHeight: 44,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  detailDanger: {
    color: colors.danger,
  },
  detailSuccess: {
    color: colors.success,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 7,
  },
  summaryLine: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 7,
  },
  summaryCurrency: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  listPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 7,
  },
  listHeader: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  customerRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    padding: 9,
  },
  customerRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  customerRowPassive: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.75,
  },
  customerRowMain: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  customerCode: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  customerMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  customerRowSide: {
    width: 112,
    alignItems: 'flex-end',
    gap: 7,
  },
  currencyBadge: {
    overflow: 'hidden',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  balanceText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyPanel: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    padding: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
});
