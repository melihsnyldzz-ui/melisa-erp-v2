import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { TerminalButton } from '../components/TerminalButton';
import { terminalConfig } from '../config/env';
import { lookupProductByBarcode } from '../services/productService';
import { enqueueTerminalSale, markQueueFailed, markQueueSynced, syncPendingTerminalSales } from '../services/queueService';
import { buildTerminalSalePayload, searchTerminalCustomers, searchTerminalProducts, submitTerminalSale } from '../services/terminalSalesService';
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

function normalizeProduct(row) {
  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode,
    matchedBarcode: row.matchedBarcode || row.barcode || row.barcodeMasked,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    currency: row.currency || 'TRY',
    salePrice: Number(row.salePrice || 0),
    stockQuantity: Number(row.stockQuantity || 0),
  };
}

const cashCustomerCodes = ['PESIN-TL', 'PESIN-USD', 'PESIN-EUR'];
const recentCustomersKey = 'terminalRecentSaleCustomers';

function cashCurrency(code) {
  return code.replace('PESIN-', '');
}

async function readRecentCustomers() {
  const raw = await AsyncStorage.getItem(recentCustomersKey);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeRecentCustomer(customer) {
  const current = await readRecentCustomers();
  const next = [
    customer,
    ...current.filter((item) => String(item.id) !== String(customer.id)),
  ].slice(0, 5);
  await AsyncStorage.setItem(recentCustomersKey, JSON.stringify(next));
  return next;
}

function SaleResultPanel({ result, onOpenSync }) {
  if (!result) return null;

  const tone = result.status === 'synced'
    ? 'success'
    : result.status === 'duplicate'
      ? 'warning'
      : 'danger';

  return (
    <View style={[styles.saleResultPanel, styles[`saleResult_${tone}`]]}>
      <Text style={styles.saleResultTitle}>{result.title}</Text>
      <Text style={styles.saleResultMessage}>{result.message}</Text>
      <View style={styles.saleResultFacts}>
        <Text style={styles.saleResultPill}>{result.customerName}</Text>
        <Text style={styles.saleResultPill}>{result.lineCount} satir</Text>
        <Text style={styles.saleResultPill}>{result.itemQuantity} adet</Text>
      </View>
      {result.clientEventId ? <Text style={styles.saleResultId}>{result.clientEventId}</Text> : null}
      {result.status === 'offline' || result.status === 'failed' ? (
        <View style={styles.saleResultAction}>
          <TerminalButton label="Sync Merkezine Git" onPress={onOpenSync} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

function LastProductPanel({ product, quantity }) {
  if (!product) return null;

  return (
    <View style={styles.lastProductPanel}>
      <Text style={styles.lastProductLabel}>Son okutulan</Text>
      <Text style={styles.lastProductName}>{product.productName}</Text>
      <View style={styles.lastProductFacts}>
        <Text style={styles.lastProductPill}>{product.stockCode}</Text>
        <Text style={styles.lastProductPill}>Stok {product.stockQuantity}</Text>
        <Text style={styles.lastProductPill}>{quantity} adet</Text>
        <Text style={styles.lastProductPill}>{formatMoney(product.salePrice, product.currency)}</Text>
      </View>
    </View>
  );
}

export function NewSaleScreen({ session, navigation, onRefresh }) {
  const barcodeRef = useRef(null);
  const [customerQuery, setCustomerQuery] = useState('PESIN-TL');
  const [customerResults, setCustomerResults] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [lines, setLines] = useState([]);
  const [productAlternatives, setProductAlternatives] = useState([]);
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [lastScannedQuantity, setLastScannedQuantity] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saleResult, setSaleResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0) * Number(line.unitPrice || 0)
  ), 0), [lines]);
  const itemQuantity = useMemo(() => lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0)
  ), 0), [lines]);
  const totalsByCurrency = useMemo(() => lines.reduce((summary, line) => {
    const currency = line.product.currency || selectedCustomer?.currency || 'TRY';
    const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    return {
      ...summary,
      [currency]: Number(summary[currency] || 0) + lineTotal,
    };
  }, {}), [lines, selectedCustomer?.currency]);
  const lineCurrencies = Object.keys(totalsByCurrency);
  const hasMixedCurrency = selectedCustomer && lineCurrencies.some((currency) => currency !== selectedCustomer.currency);

  useEffect(() => {
    async function loadRecentCustomers() {
      setRecentCustomers(await readRecentCustomers());
    }

    loadRecentCustomers();
  }, []);

  async function selectCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setCustomerQuery(customer.customerCode || customer.customerName || '');
    setRecentCustomers(await writeRecentCustomer(customer));
    setMessage(`${customer.customerName} secildi`);
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }

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
        await selectCustomer(customers[0]);
      } else if (customers.length === 0) {
        setMessage('Cari bulunamadi');
      }
    } catch (searchError) {
      setError(searchError.message || 'Cari arama basarisiz');
    } finally {
      setLoading(false);
    }
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerResults([]);
    setMessage('');
    setError('');
  }

  async function selectCashCustomer(code) {
    setCustomerQuery(code);
    setCustomerResults([]);
    setSelectedCustomer(null);
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await searchTerminalCustomers({
        q: code,
        token: session.accessToken,
        limit: 5,
      });
      const customers = (response.data || []).map(normalizeCustomer);
      const exact = customers.find((customer) => customer.customerCode === code) || customers[0];
      if (!exact) {
        setError(`${code} carisi bulunamadi`);
        return;
      }
      await selectCustomer(exact);
    } catch (selectError) {
      setError(selectError.message || `${code} secilemedi`);
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
    setProductAlternatives([]);
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

      addProductLine(product, parsedQuantity);
      setBarcode('');
      setQuantity('1');
      setMessage(`${product.productName} eklendi`);
      setSaleResult(null);
    } catch (lookupError) {
      setError(lookupError.message || 'Barkod okunamadi');
      setProductAlternatives(Array.isArray(lookupError.alternatives) ? lookupError.alternatives : []);
    } finally {
      setLoading(false);
      setTimeout(() => barcodeRef.current?.focus(), 120);
    }
  }

  async function searchProduct() {
    const q = productQuery.trim();
    if (!selectedCustomer) {
      setError('Once cari secin');
      return;
    }

    if (!q) {
      setError('Urun aramak icin ad, stok kodu veya barkod girin');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await searchTerminalProducts({
        q,
        token: session.accessToken,
        limit: 10,
      });
      const products = (response.data || response.products || response.items || []).map(normalizeProduct);
      setProductResults(products);
      if (products.length === 1) {
        setMessage('1 urun bulundu, satira eklemek icin dokunun');
      } else if (products.length > 1) {
        setMessage(`${products.length} urun bulundu`);
      } else {
        setMessage('Urun bulunamadi');
      }
    } catch (productError) {
      setError(productError.message || 'Urun arama basarisiz');
    } finally {
      setLoading(false);
    }
  }

  function addProductLine(product, parsedQuantity = Number(quantity || 1)) {
    setLastScannedProduct(product);
    setLastScannedQuantity(parsedQuantity);
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
  }

  function adjustInputQuantity(delta) {
    const current = Number(quantity || 1);
    const next = Math.max(1, Number.isFinite(current) ? current + delta : 1);
    setQuantity(String(next));
    setTimeout(() => barcodeRef.current?.focus(), 80);
  }

  function selectProductAlternative(product) {
    const parsedQuantity = Number(quantity || 1);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Miktar zorunlu');
      return;
    }

    addProductLine(product, parsedQuantity);
    setProductAlternatives([]);
    setBarcode('');
    setQuantity('1');
    setError('');
    setMessage(`${product.productName} alternatif olarak eklendi`);
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  function selectSearchedProduct(product) {
    const parsedQuantity = Number(quantity || 1);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Miktar zorunlu');
      return;
    }

    addProductLine(product, parsedQuantity);
    setProductQuery('');
    setProductResults([]);
    setQuantity('1');
    setError('');
    setMessage(`${product.productName} satira eklendi`);
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  async function finishSale() {
    if (!selectedCustomer || lines.length === 0) {
      setError('Cari ve en az bir satir gerekli');
      return;
    }

    setError('');
    setMessage('');
    setSaleResult(null);
    setLoading(true);

    const resultSnapshot = {
      customerName: selectedCustomer.customerName,
      lineCount: lines.length,
      itemQuantity,
    };

    const basePayload = buildTerminalSalePayload({
      customer: selectedCustomer,
      lines,
      terminalCode: terminalConfig.terminalCode,
      note: 'Terminal hizli satis',
    });

    const queuedEvent = await enqueueTerminalSale(basePayload);

    try {
      const response = await submitTerminalSale({
        token: session.accessToken,
        payload: {
          ...basePayload,
          clientEventId: queuedEvent.clientEventId,
        },
      });
      const duplicate = Boolean(response?.data?.duplicate || response?.duplicate);
      await markQueueSynced(queuedEvent.clientEventId, response?.data || response);
      setMessage(duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi');
      setSaleResult({
        ...resultSnapshot,
        status: duplicate ? 'duplicate' : 'synced',
        title: duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi',
        message: duplicate
          ? 'Backend bu fisi daha once almis. Yeni ikinci fis olusturulmadi.'
          : 'Fis backend API tarafina basariyla gonderildi.',
        clientEventId: queuedEvent.clientEventId,
      });
      setLines([]);
      setBarcode('');
      setQuantity('1');
      await onRefresh();
    } catch (submitError) {
      await markQueueFailed(queuedEvent.clientEventId, submitError);
      setMessage('Baglanti yok, fis gonderilemeyenlere alindi');
      setError(submitError.message || 'Online gonderim basarisiz');
      setSaleResult({
        ...resultSnapshot,
        status: 'offline',
        title: 'Gonderilemeyenlere alindi',
        message: submitError.message || 'API baglantisi yok veya istek basarisiz. Fis local queue icinde bekliyor.',
        clientEventId: queuedEvent.clientEventId,
      });
      setLines([]);
      setBarcode('');
      setQuantity('1');
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  function adjustLineQuantity(productId, delta) {
    setLines((current) => current.flatMap((line) => {
      if (String(line.product.id) !== String(productId)) {
        return [line];
      }

      const nextQuantity = Number(line.quantity || 0) + delta;
      return nextQuantity <= 0 ? [] : [{ ...line, quantity: nextQuantity }];
    }));
  }

  function removeLine(productId) {
    setLines((current) => current.filter((line) => String(line.product.id) !== String(productId)));
  }

  function clearSale() {
    setLines([]);
    setBarcode('');
    setQuantity('1');
    setProductAlternatives([]);
    setProductResults([]);
    setLastScannedProduct(null);
    setLastScannedQuantity(0);
    setMessage('Fis temizlendi');
    setError('');
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  async function syncQueue() {
    setLoading(true);
    setError('');
    try {
      const result = await syncPendingTerminalSales({ token: session.accessToken });
      setMessage(`Sync: ${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`);
      setSaleResult({
        status: result.failed ? 'failed' : 'synced',
        title: result.failed ? 'Sync hatali kayit birakti' : 'Bekleyenler gonderildi',
        message: `${result.synced} gonderildi, ${result.duplicate} duplicate, ${result.failed} hatali`,
        customerName: 'Toplu sync',
        lineCount: result.attempted,
        itemQuantity: result.synced + result.duplicate,
      });
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
      <View style={[styles.panel, selectedCustomer && styles.compactCustomerPanel]}>
        <Text style={styles.title}>Yeni Terminal Satis</Text>
        <Text style={styles.meta}>{terminalConfig.terminalCode} / {terminalConfig.deviceName}</Text>

        {!selectedCustomer ? (
          <>
            <Text style={styles.label}>Pesin cari</Text>
            <View style={styles.cashRow}>
              {cashCustomerCodes.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => selectCashCustomer(code)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.cashCard,
                    pressed && styles.cashCardPressed,
                  ]}
                >
                  <Text style={styles.cashTitle}>{cashCurrency(code)}</Text>
                  <Text style={styles.cashMeta}>{code}</Text>
                </Pressable>
              ))}
            </View>
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
            {recentCustomers.length ? (
              <View style={styles.recentPanel}>
                <Text style={styles.label}>Son cariler</Text>
                {recentCustomers.map((customer) => (
                  <Pressable
                    key={customer.id}
                    onPress={() => selectCustomer(customer)}
                    style={styles.customerResultRow}
                  >
                    <View style={styles.customerResultText}>
                      <Text style={styles.customerResultName}>{customer.customerName}</Text>
                      <Text style={styles.customerResultMeta}>{customer.customerCode} / {customer.currency}</Text>
                    </View>
                    <Text style={styles.customerCurrencyBadge}>{customer.currency}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {selectedCustomer ? (
          <View style={styles.selectedBox}>
            <View style={styles.selectedCustomerHeader}>
              <View style={styles.selectedCustomerText}>
                <Text style={styles.selectedCustomerLabel}>Secili cari</Text>
                <Text style={styles.selectedCustomerName}>{selectedCustomer.customerName}</Text>
                <Text style={styles.selectedCustomerMeta}>{selectedCustomer.customerCode}</Text>
              </View>
              <Text style={styles.selectedCurrencyBadge}>{selectedCustomer.currency}</Text>
              <Pressable onPress={clearSelectedCustomer} disabled={loading} style={styles.changeCustomerButton}>
                <Text style={styles.changeCustomerText}>Degistir</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {customerResults.length > 1 ? (
          <View style={styles.resultList}>
            {customerResults.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => selectCustomer(customer)}
                style={styles.customerResultRow}
              >
                <View style={styles.customerResultText}>
                  <Text style={styles.customerResultName}>{customer.customerName}</Text>
                  <Text style={styles.customerResultMeta}>{customer.customerCode} / Bakiye {formatMoney(customer.balance, customer.currency)}</Text>
                </View>
                <Text style={styles.customerCurrencyBadge}>{customer.currency}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.barcodeHeader}>
          <View>
            <Text style={styles.title}>Barkod</Text>
            <Text style={styles.meta}>{selectedCustomer ? 'Cari secili, okutmaya veya aramaya hazir' : 'Once cari secin'}</Text>
          </View>
          <Text style={styles.quantityBadge}>{itemQuantity} adet</Text>
        </View>
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
        <LastProductPanel product={lastScannedProduct} quantity={lastScannedQuantity} />
        <Text style={styles.label}>Miktar</Text>
        <View style={styles.quantityControl}>
          <Pressable onPress={() => adjustInputQuantity(-1)} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>-</Text>
          </Pressable>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            style={styles.quantityInput}
            keyboardType="decimal-pad"
          />
          <Pressable onPress={() => adjustInputQuantity(1)} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>+</Text>
          </Pressable>
        </View>
        <TerminalButton label="Satira Ekle" onPress={addBarcodeLine} disabled={loading} />
        <View style={styles.quickSearchPanel}>
          <Text style={styles.label}>Barkod yoksa urun ara</Text>
          <View style={styles.row}>
            <TextInput
              value={productQuery}
              onChangeText={setProductQuery}
              onSubmitEditing={searchProduct}
              style={styles.input}
              placeholder="Urun adi, stok kodu veya barkod"
              autoCapitalize="none"
            />
            <TerminalButton label="Urun Ara" onPress={searchProduct} disabled={loading} variant="secondary" />
          </View>
          {productResults.length ? (
            <View style={styles.productAlternativePanel}>
              {productResults.map((product) => (
                <Pressable
                  key={`${product.id}-${product.stockCode}`}
                  onPress={() => selectSearchedProduct(product)}
                  style={styles.productAlternativeRow}
                >
                  <View style={styles.productResultHeader}>
                    <Text style={styles.lineName}>{product.productName}</Text>
                    <Text style={styles.stockBadge}>Stok {product.stockQuantity}</Text>
                  </View>
                  <Text style={styles.lineMeta}>
                    {product.stockCode} / {product.matchedBarcode || product.barcodeMasked || '-'} / {formatMoney(product.salePrice, product.currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {productAlternatives.length ? (
          <View style={styles.productAlternativePanel}>
            <Text style={styles.warning}>Tam barkod bulunamadi. Benzer urunlerden secin.</Text>
            {productAlternatives.map((product) => (
              <Pressable
                key={`${product.id}-${product.barcodeMasked || product.matchedBarcode || product.stockCode}`}
                onPress={() => selectProductAlternative(product)}
                style={styles.productAlternativeRow}
              >
                <Text style={styles.lineName}>{product.productName}</Text>
                <Text style={styles.lineMeta}>
                  {product.stockCode} / {product.matchedBarcode || product.barcodeMasked || '-'} / Stok {product.stockQuantity}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.receiptHeader}>
          <View>
            <Text style={styles.title}>Fis Satirlari</Text>
            <Text style={styles.meta}>{lines.length} satir / {itemQuantity} adet</Text>
          </View>
          {lines.length ? <TerminalButton label="Temizle" onPress={clearSale} disabled={loading} variant="secondary" /> : null}
        </View>
        {hasMixedCurrency ? (
          <Text style={styles.warning}>
            Satir para birimi cari para biriminden farkli. Backend kur snapshot ile isleyecek; kur ERP tarafinda kontrol edilmeli.
          </Text>
        ) : null}
        {lines.length === 0 ? (
          <Text style={styles.empty}>Henuz satir yok.</Text>
        ) : lines.map((line) => (
          <View key={line.product.id} style={styles.lineRow}>
            <View style={styles.lineText}>
              <Text style={styles.lineName}>{line.product.productName}</Text>
              <Text style={styles.lineMeta}>{line.product.stockCode} / {line.product.barcodeMasked}</Text>
            </View>
            <View style={styles.lineActions}>
              <Text style={styles.lineAmount}>
                {line.quantity} x {formatMoney(line.unitPrice, line.product.currency)}
              </Text>
              <Text style={styles.lineTotal}>{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0), line.product.currency)}</Text>
              <View style={styles.lineButtons}>
                <Pressable onPress={() => adjustLineQuantity(line.product.id, -1)} style={styles.smallLineButton}>
                  <Text style={styles.smallLineButtonText}>-</Text>
                </Pressable>
                <Pressable onPress={() => adjustLineQuantity(line.product.id, 1)} style={styles.smallLineButton}>
                  <Text style={styles.smallLineButtonText}>+</Text>
                </Pressable>
                <Pressable onPress={() => removeLine(line.product.id)} style={[styles.smallLineButton, styles.smallLineButtonDanger]}>
                  <Text style={[styles.smallLineButtonText, styles.smallLineButtonTextDanger]}>Sil</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        {lineCurrencies.length > 0 ? lineCurrencies.map((currency) => (
          <InfoRow
            key={currency}
            label={`Toplam ${currency}`}
            value={formatMoney(totalsByCurrency[currency], currency)}
            tone="success"
          />
        )) : (
          <InfoRow label="Toplam" value={formatMoney(total, selectedCustomer?.currency || 'TRY')} tone="success" />
        )}
        {selectedCustomer ? <InfoRow label="Fis para birimi" value={selectedCustomer.currency || 'TRY'} /> : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <SaleResultPanel result={saleResult} onOpenSync={navigation.openSyncStatus} />

      <View style={styles.submitPanel}>
        <Text style={styles.submitTitle}>{lines.length ? 'Fis gonderime hazir' : 'Fis bos'}</Text>
        <Text style={styles.submitMeta}>{selectedCustomer ? selectedCustomer.customerName : 'Cari secilmedi'} / {lines.length} satir</Text>
        <TerminalButton label="Fisi Gonder" onPress={finishSale} disabled={loading || lines.length === 0 || !selectedCustomer} />
      </View>
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
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  compactCustomerPanel: {
    backgroundColor: colors.white,
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
  cashRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cashCard: {
    flex: 1,
    minHeight: 82,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    padding: 10,
    gap: 3,
  },
  cashCardPressed: {
    opacity: 0.75,
  },
  cashTitle: {
    color: colors.accentDark,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  cashMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  input: {
    minHeight: 48,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  barcodeInput: {
    minHeight: 66,
    borderColor: colors.borderDark,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    paddingHorizontal: 10,
  },
  quantityControl: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quantityButton: {
    width: 62,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  quantityButtonText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  quantityInput: {
    flex: 1,
    minHeight: 56,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  lastProductPanel: {
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 10,
    gap: 5,
  },
  lastProductLabel: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lastProductName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  lastProductFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lastProductPill: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  selectedBox: {
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedCustomerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedCustomerText: {
    flex: 1,
  },
  selectedCustomerLabel: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedCustomerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  selectedCustomerMeta: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  selectedCurrencyBadge: {
    minWidth: 46,
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
    textAlign: 'center',
  },
  changeCustomerButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
  },
  changeCustomerText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  barcodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quantityBadge: {
    minWidth: 70,
    textAlign: 'center',
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  resultList: {
    gap: 7,
  },
  recentPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 8,
    gap: 7,
  },
  customerResultRow: {
    minHeight: 52,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  customerResultText: {
    flex: 1,
  },
  customerResultName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  customerResultMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  customerCurrencyBadge: {
    minWidth: 52,
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
    textAlign: 'center',
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  lineRow: {
    minHeight: 66,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingVertical: 5,
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
  lineTotal: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  lineActions: {
    gap: 6,
  },
  lineButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  smallLineButton: {
    minWidth: 44,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
  },
  smallLineButtonDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  smallLineButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  smallLineButtonTextDanger: {
    color: colors.danger,
    fontSize: 13,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  submitPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  saleResultPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 7,
  },
  saleResult_success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  saleResult_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  saleResult_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  saleResultTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  saleResultMessage: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  saleResultFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  saleResultPill: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  saleResultId: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  saleResultAction: {
    marginTop: 3,
  },
  submitTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  submitMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  message: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  productAlternativePanel: {
    gap: 7,
  },
  quickSearchPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
    gap: 8,
  },
  productAlternativeRow: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    padding: 10,
  },
  productResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stockBadge: {
    minWidth: 62,
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
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
