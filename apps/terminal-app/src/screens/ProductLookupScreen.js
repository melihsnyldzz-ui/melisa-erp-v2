import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { InfoRow } from '../components/InfoRow';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import { getActiveApiBaseUrl } from '../config/env';
import { createCatalogDraft, sendCatalogToCustomer } from '../services/catalogService';
import { uploadProductImage } from '../services/productImageService';
import { getProductDetail, lookupProductByBarcode, searchProductsOfflineFirst } from '../services/productService';
import { openWhatsappProductShare, shareProductText } from '../services/shareService';
import { searchTerminalCustomers } from '../services/terminalSalesService';
import { colors, terminalStyles } from '../styles/theme';

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

function normalizeProduct(row) {
  if (!row) {
    return null;
  }

  const primaryImage = Array.isArray(row.images)
    ? row.images.find((image) => image?.isPrimary && image?.isActive !== false) || row.images.find((image) => image?.isActive !== false) || row.images[0]
    : null;

  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode || '-',
    productName: row.productName || row.name || '-',
    brand: row.brand || '-',
    category: row.category || '-',
    imageUrl: row.imageUrl || row.image_url || row.imagePath || row.image_file_path || primaryImage?.filePath || primaryImage?.url || null,
    currency: row.currency || 'TRY',
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || row.quantity || 0),
    isPassive: Boolean(row.isPassive),
  };
}

function normalizeCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerCode: row.customerCode || row.code || '',
    customerName: row.customerName || row.name || '-',
    city: row.city || '-',
    currency: row.currency || row.currencyCode || 'TRY',
    phone: row.phone || row.phoneMasked || row.gsm || row.mobilePhone || '',
  };
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  return digits;
}

function sourceLabel(source) {
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'api') return 'API';
  if (normalizedSource === 'recent') return 'son okutulan';
  if (normalizedSource === 'cache' || normalizedSource === 'local cache') return 'local cache';
  if (normalizedSource === 'alternative') return 'operator secimi';
  return source || 'manual';
}

function resolveImageUrl(imageUrl, apiBaseUrl) {
  const value = String(imageUrl || '').trim().replace(/\\/g, '/');
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  if (!value || !base) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
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
  const [searchMode, setSearchMode] = useState(lastLookup?.barcode ? 'barcode' : 'stockCode');
  const [query, setQuery] = useState(lastLookup?.barcode || '');
  const [selectedProduct, setSelectedProduct] = useState(initialProduct);
  const [results, setResults] = useState(initialProduct ? [initialProduct] : []);
  const [source, setSource] = useState(lastLookup?.source || 'manual');
  const [warning, setWarning] = useState(lastLookup?.warning || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [selectedImageAsset, setSelectedImageAsset] = useState(null);
  const [imageUploadMessage, setImageUploadMessage] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [singleSendMessage, setSingleSendMessage] = useState('');
  const [singleSending, setSingleSending] = useState(false);
  const [productImageUrl, setProductImageUrl] = useState('');

  useEffect(() => {
    const nextProduct = normalizeProduct(lastLookup?.selectedProduct);
    if (nextProduct) {
      setSelectedProduct(nextProduct);
      setResults([nextProduct]);
      setSource(lastLookup?.source || 'barcode');
      setSearchMode('barcode');
      setWarning(lastLookup?.warning || '');
      setQuery(lastLookup?.barcode || nextProduct.barcodeMasked || nextProduct.stockCode || '');
    }
  }, [lastLookup]);

  useEffect(() => {
    let active = true;

    async function buildImageUrl() {
      const apiBaseUrl = await getActiveApiBaseUrl();
      const nextUrl = resolveImageUrl(selectedProduct?.imageUrl, apiBaseUrl);
      if (active) {
        setProductImageUrl(nextUrl);
      }
    }

    buildImageUrl();
    return () => {
      active = false;
    };
  }, [selectedProduct?.imageUrl]);

  useEffect(() => {
    let active = true;

    async function enrichProductImage() {
      if (!selectedProduct?.id || selectedProduct?.imageUrl) {
        return;
      }

      try {
        const detail = await getProductDetail({
          productId: selectedProduct.id,
          token: session?.accessToken,
        });
        const enrichedProduct = normalizeProduct(detail);

        if (active && enrichedProduct?.imageUrl) {
          setSelectedProduct((current) => (
            current?.id === selectedProduct.id
              ? { ...current, imageUrl: enrichedProduct.imageUrl }
              : current
          ));
        }
      } catch {
        // Gorsel zorunlu degil; cache urun bilgisi gosterilmeye devam eder.
      }
    }

    enrichProductImage();
    return () => {
      active = false;
    };
  }, [selectedProduct?.id, selectedProduct?.imageUrl, session?.accessToken]);

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
      const response = searchMode === 'barcode'
        ? await lookupProductByBarcode({
          barcode: normalizedQuery,
          token: session?.accessToken,
          preferCache: false,
        })
        : await searchProductsOfflineFirst({
          q: normalizedQuery,
          token: session?.accessToken,
          limit: 20,
          preferCache: true,
          stockCodeOnly: true,
        });
      const products = (response.products || []).map(normalizeProduct).filter(Boolean);

      setResults(products);
      setSelectedProduct(products[0] || null);
      setSelectedImageAsset(null);
      setImageUploadMessage('');
      setSingleSendMessage('');
      setSource(response.source || 'cache');
      if (!products.length) {
        setWarning(response.warning || (searchMode === 'barcode'
          ? 'Barkod bulunamadı. Stok kodu için Stok Kodu modunu kullanın.'
          : 'Stok kodu sonuc vermedi. Kodun bir kısmını tekrar deneyin.'));
      }
    } catch (err) {
      setSource('cache');
      setResults([]);
      setSelectedProduct(null);
      setWarning('');
      setError(`Hata: ${err.message || (searchMode === 'barcode' ? 'Barkod bulunamadi' : 'Stok kodu bulunamadi')}`);
    } finally {
      setLoading(false);
    }
  };

  async function shareSelectedProduct(mode = 'share') {
    if (!selectedProduct) {
      setError('Paylasmak icin once urun secin.');
      return;
    }

    setError('');
    setWarning('');

    try {
      const message = mode === 'whatsapp'
        ? await openWhatsappProductShare(selectedProduct)
        : await shareProductText(selectedProduct);
      setShareMessage(`Paylasim metni hazirlandi: ${selectedProduct.stockCode}`);
      return message;
    } catch (err) {
      setError(`Paylasim acilamadi: ${err.message || 'Bilinmeyen hata'}`);
      return null;
    }
  }

  async function pickProductImage(source = 'library') {
    if (!selectedProduct) {
      setError('Gorsel yuklemek icin once urun secin.');
      return;
    }

    setError('');
    setImageUploadMessage('');

    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(source === 'camera' ? 'Kamera izni verilmedi.' : 'Galeri izni verilmedi.');
        return;
      }

      const pickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.72,
        base64: true,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets?.[0]) {
        setImageUploadMessage('Gorsel secimi iptal edildi.');
        return;
      }

      setSelectedImageAsset(result.assets[0]);
      setImageUploadMessage('Gorsel hazir. ERP urun kartina yukleyebilirsiniz.');
    } catch (err) {
      setError(`Gorsel secilemedi: ${err.message || 'Bilinmeyen hata'}`);
    }
  }

  async function uploadSelectedImage() {
    if (!selectedProduct) {
      setError('Gorsel yuklemek icin once urun secin.');
      return;
    }

    if (!selectedImageAsset) {
      setError('Once kameradan cekin veya galeriden gorsel secin.');
      return;
    }

    setImageUploading(true);
    setError('');
    setImageUploadMessage('');

    try {
      await uploadProductImage({
        token: session?.accessToken,
        productId: selectedProduct.id,
        asset: selectedImageAsset,
      });
      setSelectedImageAsset(null);
      setImageUploadMessage('Gorsel ERP urun kartina yuklendi.');
    } catch (err) {
      setError(`Gorsel yuklenemedi: ${err.message || 'API hatasi'}`);
    } finally {
      setImageUploading(false);
    }
  }

  async function searchCustomersForSend() {
    const q = customerQuery.trim();
    if (!q) {
      setError('Cari aramak icin ad, kod veya telefon yazin.');
      return;
    }

    setCustomerLoading(true);
    setError('');
    setSingleSendMessage('');

    try {
      const response = await searchTerminalCustomers({
        q,
        token: session?.accessToken,
        limit: 8,
      });
      const rows = (response.customers || response.data || response.items || [])
        .map(normalizeCustomer)
        .filter(Boolean);
      setCustomerResults(rows);
      if (rows.length === 1) {
        setSelectedCustomer(rows[0]);
      }
      setSingleSendMessage(rows.length ? `${rows.length} cari bulundu.` : 'Cari bulunamadi.');
    } catch (err) {
      setError(`Cari arama basarisiz: ${err.message || 'API hatasi'}`);
    } finally {
      setCustomerLoading(false);
    }
  }

  async function sendSingleProductToCustomer() {
    if (!selectedProduct) {
      setError('Gondermek icin once urun secin.');
      return;
    }

    if (!selectedCustomer) {
      setError('Gondermek icin cari secin.');
      return;
    }

    const phone = normalizePhone(selectedCustomer.phone);
    if (phone.length < 10) {
      setError('Secilen carinin telefon numarasi yok veya gecersiz.');
      return;
    }

    setSingleSending(true);
    setError('');
    setSingleSendMessage('');

    try {
      const draft = await createCatalogDraft({
        token: session?.accessToken,
        name: `${selectedCustomer.customerName} Tekli Urun`,
        customerId: selectedCustomer.id,
        productIds: [selectedProduct.id],
      });
      const result = await sendCatalogToCustomer({
        token: session?.accessToken,
        catalogId: draft.catalogId,
        phone,
      });
      setSingleSendMessage(`${selectedProduct.stockCode} gonderildi. Sonuc: ${result.sent || 0} gonderildi, ${result.failed || 0} hatali, ${result.skipped || 0} atlandi.`);
    } catch (err) {
      setError(`Tekli urun gonderilemedi: ${err.message || 'API hatasi'}`);
    } finally {
      setSingleSending(false);
    }
  }

  return (
    <KeyboardSafeScrollView contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.searchHeader}>
          <Text style={styles.title}>Ürün Ara</Text>
          <Text style={styles.searchHint}>{searchMode === 'barcode' ? 'Klavyesiz barkod okutma' : 'Klavye ile stok kodu arama'}</Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => {
              setSearchMode('barcode');
              setQuery('');
              setError('');
              setWarning('');
            }}
            style={[styles.modeButton, searchMode === 'barcode' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, searchMode === 'barcode' && styles.modeButtonTextActive]}>Barkod</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSearchMode('stockCode');
              setQuery('');
              setError('');
              setWarning('');
            }}
            style={[styles.modeButton, searchMode === 'stockCode' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, searchMode === 'stockCode' && styles.modeButtonTextActive]}>Stok Kodu</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <KeyboardSafeTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchMode === 'barcode' ? 'Barkod okut' : 'Stok kodu yaz'}
            placeholderTextColor={colors.muted}
            style={[styles.input, searchMode === 'barcode' && styles.barcodeInput]}
            autoCapitalize="none"
            showSoftInputOnFocus={searchMode !== 'barcode'}
            keyboardType={searchMode === 'barcode' ? 'number-pad' : 'default'}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <TerminalButton label={loading ? 'Araniyor' : searchMode === 'barcode' ? 'Barkodu Getir' : 'Stok Kodunu Ara'} onPress={search} disabled={loading} />
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
              onPress={async () => {
                setSelectedProduct(product);
                setSelectedImageAsset(null);
                setImageUploadMessage('');
                setSingleSendMessage('');
              }}
              style={[
                styles.resultRow,
                selectedProduct?.id === product.id && styles.selectedResultRow,
              ]}
            >
              <Text style={styles.resultName}>{product.productName}</Text>
              <Text style={styles.resultMeta}>
                {product.stockCode} / {product.barcodeMasked} / Stok {product.stockQuantity}
              </Text>
              {Number(product.stockQuantity || 0) <= 0 ? (
                <Text style={styles.stockWarning}>Stok yok veya eksi.</Text>
              ) : null}
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
          {Number(selectedProduct.stockQuantity || 0) <= 0 ? (
            <Text style={styles.stockWarning}>Stok yok veya eksi. Satis oncesi ERP stok durumunu kontrol edin.</Text>
          ) : null}
          <View style={styles.imageUploadPanel}>
            <Text style={styles.imageUploadTitle}>ERP Urun Gorseli</Text>
            <Text style={styles.imageUploadText}>
              Fotograf terminalde gosterilmez. Secilen gorsel dogrudan ERP stok kartina gonderilir.
            </Text>
            {selectedImageAsset ? (
              <Text style={styles.imageUploadReady}>
                Gorsel secildi / {selectedImageAsset.width || '-'}x{selectedImageAsset.height || '-'}
              </Text>
            ) : null}
            {imageUploadMessage ? <Text style={styles.imageUploadMessage}>{imageUploadMessage}</Text> : null}
            <View style={styles.imageUploadActions}>
              <Pressable
                onPress={() => pickProductImage('camera')}
                disabled={imageUploading}
                style={[styles.imageUploadButton, imageUploading && styles.imageUploadButtonDisabled]}
              >
                <Text style={styles.imageUploadButtonText}>Kamera</Text>
              </Pressable>
              <Pressable
                onPress={() => pickProductImage('library')}
                disabled={imageUploading}
                style={[styles.imageUploadButton, imageUploading && styles.imageUploadButtonDisabled]}
              >
                <Text style={styles.imageUploadButtonText}>Galeri</Text>
              </Pressable>
            </View>
            <TerminalButton
              label={imageUploading ? 'Yukleniyor' : 'ERPye Yukle'}
              onPress={uploadSelectedImage}
              disabled={imageUploading || !selectedImageAsset}
              variant={selectedImageAsset ? 'primary' : 'secondary'}
            />
          </View>
          <View style={styles.sharePanel}>
            <Text style={styles.shareTitle}>Tekli WhatsApp Gonder</Text>
            <View style={styles.sharePreviewRow}>
              {productImageUrl ? (
                <Image source={{ uri: productImageUrl }} style={styles.shareImagePreview} resizeMode="cover" />
              ) : (
                <View style={styles.shareImageEmpty}>
                  <Text style={styles.shareImageEmptyText}>Resim yok</Text>
                </View>
              )}
              <Text style={styles.sharePreview}>
                {`✨ *${selectedProduct.stockCode}* ✨\n🧸 ${selectedProduct.productName}\n💰 *Fiyat:* ${formatMoney(selectedProduct.salePrice, selectedProduct.currency)}`}
              </Text>
            </View>
            <KeyboardSafeTextInput
              value={customerQuery}
              onChangeText={setCustomerQuery}
              placeholder="Cari adı, kodu veya telefon"
              placeholderTextColor={colors.muted}
              style={styles.customerInput}
              returnKeyType="search"
              onSubmitEditing={searchCustomersForSend}
            />
            <TerminalButton
              label={customerLoading ? 'Cari Aranıyor' : 'Cari Ara'}
              onPress={searchCustomersForSend}
              disabled={customerLoading || singleSending}
              variant="secondary"
            />
            {customerResults.length ? (
              <View style={styles.customerResultList}>
                {customerResults.map((customer) => (
                  <Pressable
                    key={`${customer.id}-${customer.customerCode}`}
                    onPress={() => {
                      setSelectedCustomer(customer);
                      setSingleSendMessage(`${customer.customerName} secildi.`);
                    }}
                    style={[
                      styles.customerResultRow,
                      selectedCustomer?.id === customer.id && styles.customerResultRowSelected,
                    ]}
                  >
                    <View style={styles.customerResultMain}>
                      <Text style={styles.customerResultName}>{customer.customerName}</Text>
                      <Text style={styles.customerResultMeta}>{customer.customerCode || '-'} / {customer.city || '-'} / {customer.currency}</Text>
                    </View>
                    <Text style={[styles.customerPhoneBadge, customer.phone ? styles.customerPhoneReady : styles.customerPhoneMissing]}>
                      {customer.phone ? 'Telefon var' : 'Yok'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {selectedCustomer ? (
              <View style={styles.selectedCustomerBox}>
                <Text style={styles.selectedCustomerTitle}>Secili cari</Text>
                <Text style={styles.selectedCustomerText}>{selectedCustomer.customerName}</Text>
                <Text style={styles.selectedCustomerMeta}>{selectedCustomer.phone || 'Telefon yok'}</Text>
              </View>
            ) : null}
            {shareMessage ? <Text style={styles.shareMessage}>{shareMessage}</Text> : null}
            {singleSendMessage ? <Text style={styles.shareMessage}>{singleSendMessage}</Text> : null}
            <TerminalButton
              label={singleSending ? 'Gonderiliyor' : 'Bu Urunu Gonder'}
              onPress={sendSingleProductToCustomer}
              disabled={singleSending || !selectedCustomer}
            />
            <View style={styles.shareActions}>
              <Pressable onPress={() => shareSelectedProduct('whatsapp')} style={[styles.shareButton, styles.whatsappButton]}>
                <Text style={styles.shareButtonText}>WhatsApp</Text>
              </Pressable>
              <Pressable onPress={() => shareSelectedProduct('share')} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Paylas</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <TerminalButton label="Yeni barkod okut" onPress={navigation.openBarcode} />
      <TerminalButton label="Ana ekran" onPress={navigation.goHome} variant="secondary" />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 12,
    paddingBottom: 104,
    gap: 10,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  searchHint: {
    flex: 1,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  modeSwitch: {
    flexDirection: 'row',
    minHeight: 46,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.panel,
  },
  modeButtonActive: {
    backgroundColor: colors.accent,
  },
  modeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: colors.headerText,
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
    minHeight: 48,
    backgroundColor: colors.input,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  barcodeInput: {
    borderColor: colors.warning,
    borderWidth: 2,
    fontSize: 22,
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
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 5,
    borderRadius: 8,
    padding: 11,
    backgroundColor: colors.white,
    ...terminalStyles.rowShadow,
  },
  selectedResultRow: {
    borderColor: colors.success,
    borderLeftColor: colors.success,
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
  stockWarning: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
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
  imageUploadPanel: {
    marginTop: 12,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 10,
    gap: 8,
  },
  imageUploadTitle: {
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  imageUploadText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  imageUploadReady: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  imageUploadMessage: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  imageUploadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  imageUploadButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  imageUploadButtonDisabled: {
    opacity: 0.55,
  },
  imageUploadButtonText: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: '900',
  },
  sharePanel: {
    marginTop: 12,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 10,
    gap: 8,
  },
  shareTitle: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sharePreview: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 22,
  },
  sharePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareImagePreview: {
    width: 76,
    height: 76,
    borderRadius: 8,
    borderColor: colors.borderDark,
    borderWidth: 1,
    backgroundColor: colors.white,
  },
  shareImageEmpty: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.panel,
  },
  shareImageEmptyText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  customerInput: {
    minHeight: 48,
    backgroundColor: colors.input,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  customerResultList: {
    gap: 6,
  },
  customerResultRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 8,
  },
  customerResultRowSelected: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  customerResultMain: {
    flex: 1,
  },
  customerResultName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  customerResultMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  customerPhoneBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  customerPhoneReady: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  customerPhoneMissing: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  selectedCustomerBox: {
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 8,
  },
  selectedCustomerTitle: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedCustomerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  selectedCustomerMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  shareMessage: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  shareActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  whatsappButton: {
    borderColor: colors.success,
    backgroundColor: colors.accent,
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
