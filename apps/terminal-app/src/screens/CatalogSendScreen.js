import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import { createCatalogDraft, loadCatalogWorkspace, sendCatalogToCustomer } from '../services/catalogService';
import { colors, terminalStyles } from '../styles/theme';

function formatMoney(value, currency = 'TRY') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function getCustomerName(customer = {}) {
  return customer.customerName || customer.name || customer.customerCode || 'Cari';
}

function getCustomerPhone(customer = {}) {
  return customer.phone || customer.gsm || customer.mobilePhone || '';
}

function ProductRow({ product, selected, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.productRow,
        selected && styles.productRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
        <Text style={styles.checkText}>{selected ? '✓' : ''}</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.stockCode}>{product.stockCode || '-'}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.productName || '-'}</Text>
        <Text style={styles.productMeta}>
          {product.brand || '-'} / {product.category || '-'} / Stok {Number(product.stockQuantity || 0)}
        </Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceText}>{formatMoney(product.salePrice, product.currency)}</Text>
        <Text style={[styles.imageBadge, product.hasImage ? styles.imageReady : styles.imageMissing]}>
          {product.hasImage ? 'Görsel var' : 'Görsel yok'}
        </Text>
      </View>
    </Pressable>
  );
}

function CustomerRow({ customer, selected, onPress }) {
  const phone = getCustomerPhone(customer);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.customerRow,
        selected && styles.customerRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.customerMain}>
        <Text style={styles.customerName}>{getCustomerName(customer)}</Text>
        <Text style={styles.customerMeta}>
          {customer.customerCode || '-'} / {customer.city || '-'} / {customer.currency || 'TRY'}
        </Text>
      </View>
      <Text style={[styles.phoneBadge, phone ? styles.phoneReady : styles.phoneMissing]}>
        {phone ? 'Telefon var' : 'Telefon yok'}
      </Text>
    </Pressable>
  );
}

export function CatalogSendScreen({ navigation, session }) {
  const [filters, setFilters] = useState({
    productSearch: '',
    brand: '',
    category: '',
    currency: '',
    stockMode: 'inStock',
    imageMode: 'withImage',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sendResult, setSendResult] = useState(null);

  const products = workspace?.productCandidates || [];
  const customers = workspace?.customers || [];
  const brands = workspace?.filterOptions?.brands || [];
  const categories = workspace?.filterOptions?.categories || [];
  const selectedCustomer = customers.find((customer) => Number(customer.id) === Number(selectedCustomerId)) || null;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLocaleLowerCase('tr-TR');
    if (!q) {
      return customers.slice(0, 10);
    }

    return customers.filter((customer) => [
      customer.customerName,
      customer.customerCode,
      customer.phone,
      customer.city,
    ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(q))).slice(0, 10);
  }, [customerSearch, customers]);

  const selectedProducts = useMemo(() => {
    const selectedSet = new Set(selectedProductIds.map(Number));
    return products.filter((product) => selectedSet.has(Number(product.productId)));
  }, [products, selectedProductIds]);

  async function refresh(nextFilters = filters) {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await loadCatalogWorkspace({
        token: session?.accessToken,
        filters: nextFilters,
      });
      setWorkspace(data);
      setSelectedProductIds([]);
      setSendResult(null);
      if (!selectedCustomerId && data.customers?.[0]?.id) {
        setSelectedCustomerId(Number(data.customers[0].id));
      }
      setMessage(`${data.productCandidates?.length || 0} ürün bulundu. Filtreyi daraltıp seçebilirsiniz.`);
    } catch (err) {
      setError(err.message || 'Katalog verisi alınamadı');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleProduct(productId) {
    const id = Number(productId);
    setSelectedProductIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function selectVisibleProducts() {
    const visibleIds = products.map((product) => Number(product.productId)).filter(Boolean);
    setSelectedProductIds(visibleIds);
    setMessage(`${visibleIds.length} görünür ürün seçildi.`);
  }

  function clearSelection() {
    setSelectedProductIds([]);
    setMessage('Ürün seçimi temizlendi.');
  }

  async function createAndSend() {
    setMessage('');
    setError('');
    setSendResult(null);

    if (!selectedProducts.length) {
      setError('Göndermek için en az bir ürün seçin.');
      return;
    }

    if (!selectedCustomer) {
      setError('Göndermek için cari seçin.');
      return;
    }

    const phone = normalizePhone(getCustomerPhone(selectedCustomer));
    if (phone.length < 10) {
      setError('Seçilen carinin telefon numarası yok veya geçersiz.');
      return;
    }

    setSending(true);

    try {
      const catalogName = `${getCustomerName(selectedCustomer)} Terminal Katalog`;
      const draft = await createCatalogDraft({
        token: session?.accessToken,
        name: catalogName,
        customerId: selectedCustomer.id,
        productIds: selectedProductIds,
      });

      setMessage(`${draft.itemCount || selectedProductIds.length} ürünlük katalog oluşturuldu. WhatsApp gönderimi başladı.`);

      const result = await sendCatalogToCustomer({
        token: session?.accessToken,
        catalogId: draft.catalogId,
        phone,
      });

      setSendResult({
        ...result,
        catalogNo: draft.catalogNo,
        customerName: getCustomerName(selectedCustomer),
      });
      setMessage(`${result.sent || 0}/${result.total || selectedProductIds.length} ürün gönderildi.`);
    } catch (err) {
      setError(err.message || 'Katalog gönderilemedi');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardSafeScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Katalog Gönder</Text>
        <Text style={styles.heroText}>Ürünleri filtrele, cariyi seç, gönderimi ofis bilgisayarındaki WhatsApp hattından başlat.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>1. Ürünleri filtrele</Text>
        <KeyboardSafeTextInput
          value={filters.productSearch}
          onChangeText={(value) => updateFilter('productSearch', value)}
          placeholder="Stok kodu, ürün adı, barkod, marka"
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => refresh()}
        />
        <View style={styles.optionGrid}>
          <KeyboardSafeTextInput
            value={filters.brand}
            onChangeText={(value) => updateFilter('brand', value)}
            placeholder="Marka"
            placeholderTextColor={colors.muted}
            style={styles.smallInput}
          />
          <KeyboardSafeTextInput
            value={filters.category}
            onChangeText={(value) => updateFilter('category', value)}
            placeholder="Kategori"
            placeholderTextColor={colors.muted}
            style={styles.smallInput}
          />
          <KeyboardSafeTextInput
            value={filters.currency}
            onChangeText={(value) => updateFilter('currency', value.toUpperCase())}
            placeholder="TRY/USD/EUR"
            placeholderTextColor={colors.muted}
            style={styles.smallInput}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.quickOptions}>
          {['withImage', ''].map((value) => (
            <Pressable
              key={`image-${value || 'all'}`}
              onPress={() => updateFilter('imageMode', value)}
              style={[styles.chip, filters.imageMode === value && styles.chipActive]}
            >
              <Text style={[styles.chipText, filters.imageMode === value && styles.chipTextActive]}>
                {value === 'withImage' ? 'Görselli' : 'Tüm görseller'}
              </Text>
            </Pressable>
          ))}
          {['inStock', ''].map((value) => (
            <Pressable
              key={`stock-${value || 'all'}`}
              onPress={() => updateFilter('stockMode', value)}
              style={[styles.chip, filters.stockMode === value && styles.chipActive]}
            >
              <Text style={[styles.chipText, filters.stockMode === value && styles.chipTextActive]}>
                {value === 'inStock' ? 'Stokta' : 'Tüm stoklar'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.quickOptions}>
          {brands.slice(0, 4).map((brand) => (
            <Pressable key={brand} onPress={() => updateFilter('brand', brand)} style={styles.chip}>
              <Text style={styles.chipText}>{brand}</Text>
            </Pressable>
          ))}
          {categories.slice(0, 3).map((category) => (
            <Pressable key={category} onPress={() => updateFilter('category', category)} style={styles.chip}>
              <Text style={styles.chipText}>{category}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.buttonRow}>
          <TerminalButton label={loading ? 'Aranıyor' : 'Ürün Ara'} onPress={() => refresh()} disabled={loading || sending} />
          <TerminalButton label="Temizle" onPress={() => {
            const next = {
              productSearch: '',
              brand: '',
              category: '',
              currency: '',
              stockMode: 'inStock',
              imageMode: 'withImage',
            };
            setFilters(next);
            refresh(next);
          }} variant="secondary" disabled={loading || sending} />
        </View>
      </View>

      <View style={styles.summaryPanel}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Bulunan</Text>
          <Text style={styles.summaryValue}>{products.length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Seçilen</Text>
          <Text style={styles.summaryValue}>{selectedProductIds.length}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Cari</Text>
          <Text style={styles.summaryValueSmall}>{selectedCustomer ? 'Seçili' : 'Yok'}</Text>
        </View>
      </View>

      {selectedCustomer || selectedProductIds.length ? (
        <View style={styles.selectionStrip}>
          <Text style={styles.selectionTitle}>Gönderim hazırlığı</Text>
          <Text style={styles.selectionText}>
            {selectedProductIds.length} ürün / {selectedCustomer ? getCustomerName(selectedCustomer) : 'cari seçilmedi'}
          </Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2. Ürün seç</Text>
          <Text style={styles.sectionMeta}>{products.length} aday</Text>
        </View>
        <View style={styles.buttonRow}>
          <TerminalButton label="Görünenleri Seç" onPress={selectVisibleProducts} variant="secondary" disabled={!products.length || sending} />
          <TerminalButton label="Seçimi Temizle" onPress={clearSelection} variant="secondary" disabled={!selectedProductIds.length || sending} />
        </View>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {!loading && !products.length ? (
          <Text style={styles.emptyText}>Filtreye uygun ürün yok.</Text>
        ) : products.map((product) => (
          <ProductRow
            key={product.productId}
            product={product}
            selected={selectedProductIds.includes(Number(product.productId))}
            onToggle={() => toggleProduct(product.productId)}
          />
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>3. Cari seç</Text>
        <KeyboardSafeTextInput
          value={customerSearch}
          onChangeText={setCustomerSearch}
          placeholder="Cari adı, kodu, telefon veya şehir"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {filteredCustomers.map((customer) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            selected={Number(selectedCustomerId) === Number(customer.id)}
            onPress={() => setSelectedCustomerId(Number(customer.id))}
          />
        ))}
      </View>

      <View style={styles.sendPanel}>
        <Text style={styles.sectionTitle}>4. Oluştur ve gönder</Text>
        <Text style={styles.sendText}>
          {selectedCustomer
            ? `${getCustomerName(selectedCustomer)} / ${getCustomerPhone(selectedCustomer) || 'telefon yok'}`
            : 'Cari seçilmedi'}
        </Text>
        <Text style={styles.sendText}>{selectedProductIds.length} ürün gönderime hazırlanacak.</Text>
        <TerminalButton
          label={sending ? 'Gönderiliyor' : 'Katalog Oluştur ve Gönder'}
          onPress={createAndSend}
          disabled={sending || loading}
        />
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {sendResult ? (
        <View style={[styles.resultPanel, sendResult.failed ? styles.resultWarning : styles.resultSuccess]}>
          <Text style={styles.resultTitle}>Gönderim sonucu</Text>
          <Text style={styles.resultLine}>Katalog: {sendResult.catalogNo || sendResult.catalogId}</Text>
          <Text style={styles.resultLine}>Cari: {sendResult.customerName || '-'}</Text>
          <Text style={styles.resultLine}>Toplam: {sendResult.total || 0}</Text>
          <Text style={styles.resultLine}>Gönderilen: {sendResult.sent || 0}</Text>
          <Text style={styles.resultLine}>Hatalı: {sendResult.failed || 0}</Text>
          <Text style={styles.resultLine}>Atlanan: {sendResult.skipped || 0}</Text>
        </View>
      ) : null}

      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 8,
    paddingBottom: 104,
    gap: 8,
  },
  hero: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 10,
    gap: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  panel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 8,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  smallInput: {
    flex: 1,
    minHeight: 44,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  quickOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    paddingHorizontal: 9,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextActive: {
    color: colors.headerText,
  },
  buttonRow: {
    gap: 7,
  },
  summaryPanel: {
    flexDirection: 'row',
    gap: 7,
  },
  summaryBox: {
    flex: 1,
    minHeight: 64,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    justifyContent: 'center',
    padding: 9,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  summaryValueSmall: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  selectionStrip: {
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 9,
  },
  selectionTitle: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectionText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  productRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    padding: 8,
    ...terminalStyles.rowShadow,
  },
  productRowSelected: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  checkBox: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
  },
  checkBoxSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkText: {
    color: colors.headerText,
    fontSize: 20,
    fontWeight: '900',
  },
  productInfo: {
    flex: 1,
  },
  stockCode: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  productName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  productMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  priceBox: {
    width: 86,
    alignItems: 'flex-end',
    gap: 5,
  },
  priceText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  imageBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  imageReady: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  imageMissing: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  },
  customerRow: {
    minHeight: 64,
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
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  customerMain: {
    flex: 1,
  },
  customerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  customerMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  phoneBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  phoneReady: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  phoneMissing: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  sendPanel: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 10,
    gap: 8,
  },
  sendText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 12,
    textAlign: 'center',
  },
  message: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  resultPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  resultSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  resultWarning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  resultLine: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
