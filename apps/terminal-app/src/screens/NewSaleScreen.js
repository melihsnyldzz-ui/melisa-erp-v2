import { resolveReviewedProductImage as resolveImageUrl } from '../services/reviewedProductImage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { KeyboardSafeScrollView, KeyboardSafeTextInput } from '../components/KeyboardSafeScrollView';
import { TerminalButton } from '../components/TerminalButton';
import { getActiveApiBaseUrl, terminalConfig } from '../config/env';
import { fetchCurrencyRates, getRateRow, getRateToTry } from '../services/currencyRateService';
import { getProductDetail, lookupProductByBarcode, searchProductsOfflineFirst } from '../services/productService';
import { createTerminalSaleClientEventId, isTerminalSaleManualReviewErrorCode, persistTerminalSaleEvent, syncTerminalSaleEvent } from '../services/queueService';
import { buildTerminalSalePayload, printTerminalSaleReceipt, searchTerminalCustomers, sendTerminalWhatsappShare } from '../services/terminalSalesService';
import { clearWorkingSaleDraft, getWorkingSaleDraft, saveWorkingSaleDraft } from '../services/workingSaleDraftService';
import { colors, terminalStyles } from '../styles/theme';

function normalizeCustomer(row) {
  return {
    id: row.id,
    customerCode: row.customerCode,
    customerName: row.customerName,
    phone: row.phone || row.phoneMasked || row.customerPhone || '',
    currency: row.currency || 'TRY',
    balance: Number(row.balance || 0),
  };
}

function formatMoney(value, currency) {
  return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
}

function normalizeProduct(row) {
  if (!row) return null;

  const primaryImage = Array.isArray(row?.images)
    ? row.images.find((image) => image?.isPrimary && image?.isActive !== false) || row.images.find((image) => image?.isActive !== false) || row.images[0]
    : null;

  return {
    id: row.id,
    stockCode: row.stockCode,
    barcodeMasked: row.barcodeMasked || row.barcode || row.matchedBarcode,
    matchedBarcode: row.matchedBarcode || row.barcode || row.barcodeMasked,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    imageUrl: row.imageUrl || row.image_url || row.imagePath || row.image_file_path || primaryImage?.filePath || primaryImage?.url || null,
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

function formatDraftSavedAt(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
      {result.documentNumber ? <Text style={styles.saleResultId}>Fis: {result.documentNumber}</Text> : null}
      {result.status === 'offline' || result.status === 'failed' || result.status === 'auth' ? (
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
      <View style={styles.lastProductHeader}>
        <View style={styles.lastProductTitleBlock}>
          <Text style={styles.lastProductLabel}>Bulunan urun</Text>
          <Text style={styles.lastProductStockCode} numberOfLines={1}>{product.stockCode}</Text>
          <Text style={styles.lastProductName} numberOfLines={1}>{product.productName}</Text>
        </View>
        <Text style={styles.lastProductPrice}>{formatMoney(product.salePrice, product.currency)}</Text>
      </View>
      <View style={styles.lastProductFacts}>
        <Text style={styles.lastProductPill}>{product.matchedBarcode || product.barcodeMasked || '-'}</Text>
        <Text style={styles.lastProductPill}>Stok {product.stockQuantity}</Text>
        <Text style={styles.lastProductPill}>{quantity} adet</Text>
      </View>
    </View>
  );
}

function RecentScanStrip({ scans, onSelect }) {
  if (!scans.length) return null;

  return (
    <View style={styles.recentScanPanel}>
      <Text style={styles.recentScanTitle}>Son okutulanlar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScanList}>
        {scans.map((scan) => (
          <Pressable
            key={`${scan.product.id}-${scan.scannedAt}`}
            onPress={() => onSelect(scan)}
            style={styles.recentScanChip}
          >
            <Text style={styles.recentScanCode} numberOfLines={1}>{scan.product.stockCode}</Text>
            <Text style={styles.recentScanName} numberOfLines={1}>{scan.product.productName}</Text>
            <Text style={styles.recentScanMeta}>{scan.quantity} adet / {formatMoney(scan.product.salePrice, scan.product.currency)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function RateInfoPanel({ customer, rateSet, onRefresh, loading }) {
  if (!customer) return null;

  const rateRow = getRateRow(rateSet, customer.currency);
  const rate = getRateToTry(rateSet, customer.currency);
  const defined = Boolean(rateRow?.defined);
  const toneStyle = defined ? styles.ratePanelReady : styles.ratePanelWarning;

  return (
    <View style={[styles.ratePanel, toneStyle]}>
      <View style={styles.rateText}>
        <Text style={styles.rateMeta}>
          Kur: {customer.currency || 'TRY'} {Number(rate || 1).toFixed(4)} / {rateRow?.source || rateSet?.source || '-'} / {rateRow?.rateDate || rateSet?.date || '-'}
        </Text>
        {!defined ? (
          <Text style={styles.rateWarning}>Bu para birimi icin tanimli kur bulunamadi. Fallback 1 kullaniliyor.</Text>
        ) : null}
      </View>
      <Pressable onPress={onRefresh} disabled={loading} style={styles.rateRefreshButton}>
        <Text style={styles.rateRefreshText}>{loading ? 'Kur' : 'Yenile'}</Text>
      </Pressable>
    </View>
  );
}

export function NewSaleScreen({ session, syncState, navigation, onRefresh, draftToEdit, onDraftLoaded }) {
  const failedScanPlayer = useAudioPlayer(require('../assets/sounds/barcode-failed.wav'));
  const barcodeRef = useRef(null);
  const productQueryRef = useRef(null);
  const saleScrollRef = useRef(null);
  const productEntryOffsetRef = useRef(0);
  const quantityControlOffsetRef = useRef(0);
  const barcodeLookupInFlightRef = useRef(false);
  const barcodeSettleTimerRef = useRef(null);
  const workingDraftReadyRef = useRef(false);
  const autoSaveRevisionRef = useRef(0);
  const saleQueueActionInFlightRef = useRef(false);
  const activeSaleEventIdRef = useRef('');
  const saleQueuePersistenceUncertainRef = useRef(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [entryMode, setEntryMode] = useState('barcode');
  const [quantity, setQuantity] = useState('1');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [lines, setLines] = useState([]);
  const [productAlternatives, setProductAlternatives] = useState([]);
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [lastScannedQuantity, setLastScannedQuantity] = useState(0);
  const [recentScans, setRecentScans] = useState([]);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [rateMessage, setRateMessage] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saleResult, setSaleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [whatsappActionsOpen, setWhatsappActionsOpen] = useState(false);
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const [recoveryDraftOpen, setRecoveryDraftOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [autoSavedAt, setAutoSavedAt] = useState('');

  function keepQuantityVisible() {
    // Android's numeric keyboard can cover the lower half of this compact screen.
    setTimeout(() => {
      saleScrollRef.current?.scrollTo({
        y: Math.max(0, quantityControlOffsetRef.current - 88),
        animated: true,
      });
    }, 180);
  }

  function openStockCodeSearch() {
    setEntryMode('stockCode');
    setTimeout(() => {
      productQueryRef.current?.focus();
    }, 0);
  }

  function openBarcodeEntry() {
    setEntryMode('barcode');
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  function scheduleBarcodeLookup(value) {
    if (barcodeSettleTimerRef.current) {
      clearTimeout(barcodeSettleTimerRef.current);
    }

    const trimmedValue = String(value || '').trim();
    if (trimmedValue.length < 4) return;

    barcodeSettleTimerRef.current = setTimeout(() => {
      lookupBarcodeProduct(trimmedValue);
    }, 300);
  }

  const total = useMemo(() => lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0) * Number(line.unitPrice || 0)
  ), 0), [lines]);

  // Keep the newest scan near the controls while preserving the saved line order.
  const displayLines = useMemo(() => [...lines].reverse(), [lines]);
  const itemQuantity = useMemo(() => lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0)
  ), 0), [lines]);
  const categorySummary = useMemo(() => {
    const summary = lines.reduce((items, line) => {
      const category = String(line.product?.category || '').trim() || 'Kategorisiz';
      const quantityValue = Number(line.quantity || 0);
      const previous = items[category] || 0;
      return {
        ...items,
        [category]: previous + quantityValue,
      };
    }, {});

    return Object.entries(summary)
      .map(([category, quantityValue]) => ({ category, quantity: quantityValue }))
      .sort((left, right) => {
        if (right.quantity !== left.quantity) {
          return right.quantity - left.quantity;
        }
        return left.category.localeCompare(right.category, 'tr');
      });
  }, [lines]);
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
  const selectedExchangeRate = getRateToTry(currencyRates, selectedCustomer?.currency || 'TRY');

  useEffect(() => {
    let active = true;

    getActiveApiBaseUrl().then((url) => {
      if (active) {
        setApiBaseUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function enrichLineImages() {
      const missingProducts = lines
        .map((line) => line.product)
        .filter((product) => product?.id && !product.imageUrl);

      if (!missingProducts.length) {
        return;
      }

      const uniqueProducts = missingProducts.filter((product, index, all) => (
        all.findIndex((item) => String(item.id) === String(product.id)) === index
      ));

      const imageByProductId = {};
      await Promise.all(uniqueProducts.map(async (product) => {
        try {
          const detail = await getProductDetail({
            productId: product.id,
            token: session?.accessToken,
          });
          const normalized = normalizeProduct(detail);
          if (normalized?.imageUrl) {
            imageByProductId[String(product.id)] = normalized.imageUrl;
          }
        } catch {
          // Gorsel zorunlu degil; satir metin bilgisiyle kalir.
        }
      }));

      if (!active || !Object.keys(imageByProductId).length) {
        return;
      }

      setLines((current) => current.map((line) => {
        const imageUrl = imageByProductId[String(line.product?.id)];
        return imageUrl
          ? { ...line, product: { ...line.product, imageUrl } }
          : line;
      }));
    }

    enrichLineImages();
    return () => {
      active = false;
    };
  }, [lines, session?.accessToken]);

  function convertProductForSale(product) {
    if (!product) return product;

    const sourceCurrency = product.currency || 'TRY';
    const targetCurrency = selectedCustomer?.currency || sourceCurrency;
    const sourceRate = getRateToTry(currencyRates, sourceCurrency);
    const targetRate = getRateToTry(currencyRates, targetCurrency);
    const originalSalePrice = Number(product.salePrice || 0);
    const convertedSalePrice = targetCurrency === sourceCurrency
      ? originalSalePrice
      : (originalSalePrice * Number(sourceRate || 1)) / Number(targetRate || 1);

    return {
      ...product,
      currency: targetCurrency,
      salePrice: Number(convertedSalePrice || 0),
      originalCurrency: sourceCurrency,
      originalSalePrice,
    };
  }

  function buildSalePayloadSnapshot() {
    return buildTerminalSalePayload({
      customer: selectedCustomer,
      lines,
      terminalCode: terminalConfig.terminalCode,
      note: 'Terminal hizli satis',
      testMode: false,
      exchangeRate: selectedExchangeRate,
    });
  }

  function isAuthenticationError(error) {
    return error?.status === 401
      || error?.code === 'AUTH_TOKEN_EXPIRED'
      || error?.code === 'AUTH_TOKEN_INVALID';
  }

  /** @param {number | number[]} [_pattern] */
  function vibrate(_pattern) {
    // Veronica is configured for silent scanning feedback.
  }

  function playFailedScanTone() {
    failedScanPlayer.seekTo(0).catch(() => {});
    failedScanPlayer.play();
  }

  function rememberScan(product, parsedQuantity) {
    if (!product) return;

    setRecentScans((current) => [
      {
        product,
        quantity: parsedQuantity,
        scannedAt: new Date().toISOString(),
      },
      ...current.filter((scan) => String(scan.product.id) !== String(product.id)),
    ].slice(0, 5));
  }

  useEffect(() => {
    async function loadRecentCustomers() {
      setRecentCustomers(await readRecentCustomers());
    }

    loadRecentCustomers();
  }, []);

  useEffect(() => {
    refreshRates(false);
  }, []);

  useEffect(() => () => {
    if (barcodeSettleTimerRef.current) {
      clearTimeout(barcodeSettleTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const query = productQuery.trim();
    if (!selectedCustomer || query.length < 2 || reviewMode) {
      if (!query) {
        setProductResults([]);
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      searchProduct(query);
    }, 280);

    return () => clearTimeout(timer);
  }, [productQuery, selectedCustomer, reviewMode]);

  useEffect(() => {
    if (entryMode !== 'stockCode' || productQuery.trim().length < 2) return;

    const timer = setTimeout(() => {
      saleScrollRef.current?.scrollTo({
        y: Math.max(0, productEntryOffsetRef.current - 88),
        animated: true,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [entryMode, productQuery]);

  useEffect(() => {
    if (entryMode !== 'stockCode' || productResults.length === 0) return;

    // Keep manual matches above the Android keyboard instead of beneath it.
    const timer = setTimeout(() => {
      saleScrollRef.current?.scrollTo({
        y: Math.max(0, productEntryOffsetRef.current - 88),
        animated: true,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [entryMode, productResults.length]);

  useEffect(() => {
    let active = true;

    async function loadWorkingDraft() {
      if (draftToEdit?.payload) return;

      const savedDraft = await getWorkingSaleDraft();
      if (!active) return;

      if (savedDraft) {
        setRecoveryDraft(savedDraft);
        setRecoveryDraftOpen(true);
        setAutoSavedAt(savedDraft.savedAt || '');
        return;
      }

      workingDraftReadyRef.current = true;
    }

    loadWorkingDraft().catch(() => {
      if (!active) return;
      workingDraftReadyRef.current = true;
      setAutoSaveStatus('error');
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftToEdit?.payload) return;

    const payload = draftToEdit.payload;
    setSelectedCustomer({
      id: payload.customerId,
      customerCode: payload.customerCode || `CARI-${payload.customerId}`,
      customerName: payload.customerName || `Cari #${payload.customerId}`,
      currency: payload.documentCurrency || 'TRY',
      balance: 0,
    });
    setCustomerQuery(payload.customerCode || payload.customerName || '');
    setLines((payload.items || []).map((item) => ({
      product: {
        id: item.productId,
        stockCode: item.stockCode || `STK-${item.productId}`,
        barcodeMasked: item.barcode || '',
        matchedBarcode: item.barcode || '',
        productName: item.productName || `Urun #${item.productId}`,
        brand: '-',
        category: '-',
        currency: item.currency || payload.documentCurrency || 'TRY',
        salePrice: Number(item.unitPrice || 0),
        stockQuantity: 0,
      },
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
    })));
    setEditingEventId(draftToEdit.clientEventId || '');
    setReviewMode(true);
    setMessage('Bekleyen fis duzenleme icin acildi');
    setError('');
    setRecoveryDraft(null);
    setRecoveryDraftOpen(false);
    workingDraftReadyRef.current = true;
    onDraftLoaded?.();
  }, [draftToEdit]);

  useEffect(() => {
    if (!workingDraftReadyRef.current) return undefined;

    const revision = autoSaveRevisionRef.current + 1;
    autoSaveRevisionRef.current = revision;

    if (!selectedCustomer || lines.length === 0) {
      clearWorkingSaleDraft().catch(() => {
        if (autoSaveRevisionRef.current === revision) {
          setAutoSaveStatus('error');
        }
      });
      setAutoSaveStatus('idle');
      setAutoSavedAt('');
      return undefined;
    }

    setAutoSaveStatus('saving');
    saveWorkingSaleDraft({
      customer: selectedCustomer,
      lines,
      editingEventId,
    }).then((savedDraft) => {
      if (autoSaveRevisionRef.current !== revision) return;
      setAutoSaveStatus('saved');
      setAutoSavedAt((savedDraft && savedDraft.savedAt) || new Date().toISOString());
    }).catch(() => {
      if (autoSaveRevisionRef.current === revision) {
        setAutoSaveStatus('error');
      }
    });

    return undefined;
  }, [editingEventId, lines, selectedCustomer]);

  async function refreshRates(showMessage = true) {
    if (showMessage) {
      setRateMessage('');
    }

    const rates = await fetchCurrencyRates({ token: session.accessToken });
    setCurrencyRates(rates);

    if (showMessage) {
      setRateMessage(rates.warning || 'ERP kuru yenilendi');
    }
  }

  async function selectCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setCustomerPickerOpen(false);
    setCustomerQuery('');
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
        limit: 5,
      });
      const customers = (response.data || []).map(normalizeCustomer).slice(0, 5);
      setCustomerResults(customers);
      setCustomerPickerOpen(true);
      if (customers.length === 0) {
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
    setCustomerPickerOpen(false);
    setReviewMode(false);
    setMessage('');
    setError('');
  }

  async function selectCashCustomer(code) {
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerPickerOpen(false);
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

  async function lookupBarcodeProduct(rawBarcode) {
    const trimmedBarcode = String(typeof rawBarcode === 'string' ? rawBarcode : barcode).trim();
    const parsedQuantity = Number(quantity || 1);

    if (!selectedCustomer) {
      setError('Once cari secin');
      return;
    }

    if (!trimmedBarcode || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Barkod ve miktar zorunlu');
      return;
    }

    if (barcodeLookupInFlightRef.current) {
      return null;
    }

    barcodeLookupInFlightRef.current = true;
    if (barcodeSettleTimerRef.current) {
      clearTimeout(barcodeSettleTimerRef.current);
    }

    // Clear the scanner field immediately so a bad scan never blocks the next scan.
    setBarcode('');
    setError('');
    setMessage('');
    setLastScannedProduct(null);
    setProductAlternatives([]);
    setLoading(true);
    try {
      const result = await lookupProductByBarcode({
        barcode: trimmedBarcode,
        token: session.accessToken,
        preferCache: !syncState?.online,
      });
      const product = result.selectedProduct;
      if (!product) {
        setError('Urun bulunamadi');
        return null;
      }

      setLastScannedProduct(product);
      setLastScannedQuantity(parsedQuantity);
      rememberScan(product, parsedQuantity);
      setMessage(`${product.productName} bulundu. Bilgileri kontrol edip Satira Ekle'ye basin.`);
      setSaleResult(null);
      vibrate(35);
      return product;
    } catch (lookupError) {
      setError(lookupError.message || 'Barkod okunamadi');
      setProductAlternatives(Array.isArray(lookupError.alternatives) ? lookupError.alternatives : []);
      playFailedScanTone();
      vibrate([0, 80, 60, 80]);
      return null;
    } finally {
      barcodeLookupInFlightRef.current = false;
      setLoading(false);
      // The scanner keeps sending keystrokes to the focused field; reopening it
      // after a scan can make Android show the soft keyboard.
      Keyboard.dismiss();
    }
  }

  async function addBarcodeLine() {
    const parsedQuantity = Number(quantity || 1);

    if (!selectedCustomer) {
      setError('Once cari secin');
      return;
    }

    if (!lastScannedProduct) {
      await lookupBarcodeProduct();
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Miktar zorunlu');
      return;
    }

    addProductLine(lastScannedProduct, parsedQuantity);
    setBarcode('');
    setQuantity('1');
    setMessage(`${lastScannedProduct.productName} satira eklendi`);
    setSaleResult(null);
    Keyboard.dismiss();
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  async function searchProduct(queryValue = productQuery) {
    const q = String(queryValue || '').trim();
    if (!selectedCustomer) {
      setError('Once cari secin');
      return;
    }

    if (!q) {
      setError('Stok kodu girin');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await searchProductsOfflineFirst({
        q,
        token: session.accessToken,
        limit: 10,
        preferCache: true,
        stockCodeOnly: true,
      });
      const normalizedQuery = q.toLocaleLowerCase('tr-TR');
      const products = (response.products || response.data || response.items || [])
        .map(normalizeProduct)
        .filter((product) => String(product.stockCode || '').toLocaleLowerCase('tr-TR').includes(normalizedQuery))
        .sort((left, right) => {
          const leftCode = String(left.stockCode || '').toLocaleLowerCase('tr-TR');
          const rightCode = String(right.stockCode || '').toLocaleLowerCase('tr-TR');
          const leftRank = leftCode === normalizedQuery ? 0 : leftCode.startsWith(normalizedQuery) ? 1 : 2;
          const rightRank = rightCode === normalizedQuery ? 0 : rightCode.startsWith(normalizedQuery) ? 1 : 2;

          if (leftRank !== rightRank) return leftRank - rightRank;
          if (leftCode.length !== rightCode.length) return leftCode.length - rightCode.length;
          return leftCode.localeCompare(rightCode, 'tr');
        });
      setProductResults(products);
      if (products.length === 1) {
        setMessage(`1 urun bulundu (${response.source === 'cache' ? 'offline stok' : 'API'}), satira eklemek icin dokunun`);
      } else if (products.length > 1) {
        setMessage(`${products.length} urun bulundu (${response.source === 'cache' ? 'offline stok' : 'API'})`);
      } else {
        setMessage(response.warning || 'Urun bulunamadi');
      }
    } catch (productError) {
      setError(productError.message || 'Urun arama basarisiz');
    } finally {
      setLoading(false);
    }
  }

  function addProductLine(product, parsedQuantity = Number(quantity || 1)) {
    const saleProduct = convertProductForSale(product);
    setReviewMode(false);
    setLastScannedProduct(product);
    setLastScannedQuantity(parsedQuantity);
    setLines((current) => {
      const existingIndex = current.findIndex((line) => String(line.product.id) === String(saleProduct.id));
      if (existingIndex < 0) {
        return [
          ...current,
          {
            product: saleProduct,
            quantity: parsedQuantity,
            unitPrice: Number(saleProduct.salePrice || 0),
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
    rememberScan(product, parsedQuantity);
    setProductAlternatives([]);
    setBarcode('');
    setQuantity('1');
    setError('');
    setMessage(`${product.productName} alternatif olarak eklendi`);
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  function selectSearchedProduct(product) {
    setLastScannedProduct(product);
    setLastScannedQuantity(Number(quantity || 1));
    setProductQuery('');
    setProductResults([]);
    setError('');
    setMessage(`${product.productName} secildi. Satira Ekle ile fise ekleyin.`);
    setSaleResult(null);
  }

  async function persistCurrentSaleToQueue(payload) {
    const clientEventId = editingEventId
      || activeSaleEventIdRef.current
      || createTerminalSaleClientEventId();
    activeSaleEventIdRef.current = clientEventId;

    try {
      await saveWorkingSaleDraft({
        customer: selectedCustomer,
        lines,
        editingEventId: clientEventId,
      });
    } catch (storageError) {
      setEditingEventId(clientEventId);
      throw storageError;
    }

    try {
      const queuedEvent = await persistTerminalSaleEvent(clientEventId, payload);
      saleQueuePersistenceUncertainRef.current = false;
      return queuedEvent;
    } catch (storageError) {
      const knownQueueState = [
        'QUEUE_EVENT_ALREADY_SYNCED',
        'QUEUE_EVENT_BUSY',
        'QUEUE_EVENT_TYPE_INVALID',
        'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED',
      ].includes(storageError.code);
      saleQueuePersistenceUncertainRef.current = !knownQueueState;
      storageError.queuePersistenceUncertain = !knownQueueState;
      setEditingEventId(clientEventId);
      throw storageError;
    }
  }

  async function finishSale({ printAfterSubmit = false } = {}) {
    if (!selectedCustomer || lines.length === 0) {
      setError('Cari ve en az bir satir gerekli');
      return;
    }
    const readOnlyVegaLine = lines.find((line) => (
      line.product?.source === 'vega'
      || line.product?.saleWritable === false
      || String(line.product?.id || '').startsWith('vega-')
    ));
    if (readOnlyVegaLine) {
      setError('Vega ile paralel kullanimda yeni terminalden satis kaydi kapali. Satisi mevcut Vega terminalinden tamamlayin.');
      setMessage('Urun ve stok bilgisi canli Vega verisinden salt-okunur gosteriliyor.');
      return;
    }

    if (saleQueueActionInFlightRef.current) return;
    saleQueueActionInFlightRef.current = true;

    setError('');
    setMessage('');
    setSaleResult(null);
    setLoading(true);

    let activeClientEventId = editingEventId || '';

    try {
      let resultSnapshot;
      let basePayload;
      try {
        resultSnapshot = {
          customerName: selectedCustomer.customerName,
          lineCount: lines.length,
          itemQuantity,
        };
        basePayload = buildSalePayloadSnapshot();
      } catch (preparationError) {
        setMessage('Fis gonderime hazirlanamadi');
        setError(preparationError.message || 'Fis bilgileri dogrulanamadi; ekrandaki fis korundu');
        return;
      }

      let queuedEvent;
      try {
        queuedEvent = await persistCurrentSaleToQueue(basePayload);
      } catch (storageError) {
        setMessage('Fis cihazda guvenle kaydedilemedi');
        setError(storageError.queuePersistenceUncertain
          ? 'Cihaz kuyrugu yazma sonucu dogrulanamadi. Fis ekranda ve ayni event kimligiyle korundu; yeniden deneyin veya ERP yoneticisine basvurun.'
          : storageError.message || 'Cihaz kuyruguna yazma basarisiz; fis ekranda ve calisma taslaginda korundu');
        return;
      }

      activeClientEventId = queuedEvent.clientEventId;
      let draftCleanupFailed = false;
      try {
        await clearWorkingSaleDraft();
      } catch {
        draftCleanupFailed = true;
      }

      try {
        const syncResult = await syncTerminalSaleEvent(activeClientEventId, {
          token: session.accessToken,
        });
        const responseData = syncResult.response;
        const duplicate = syncResult.duplicate;

        let printSucceeded = false;
        let printFailureMessage = '';
        if (printAfterSubmit) {
          try {
            const printResponse = await printTerminalSaleReceipt({
              token: session.accessToken,
              invoiceId: responseData?.invoiceId,
            });
            const printData = printResponse?.data || printResponse;
            printSucceeded = Boolean(printData?.ok);
          } catch (printError) {
            printFailureMessage = printError.message || 'ERP bilgisayarindaki yaziciya ulasilamadi';
          }
        }

        const submitMessage = duplicate ? 'Daha once gonderilmis' : 'Fis gonderildi';
        const printMessage = printAfterSubmit
          ? printSucceeded
            ? ' ERP bilgisayarindaki yaziciya gonderildi.'
            : ` Fis kaydedildi ancak yazdirilamadi: ${printFailureMessage}`
          : '';

        setMessage(printSucceeded ? 'Fis gonderildi ve yazdirildi' : submitMessage);
        if (printFailureMessage) {
          setError(`Fis kaydedildi, fakat cikti alinamadi. ${printFailureMessage}`);
        } else if (draftCleanupFailed) {
          setError('Fis gonderildi; cihazdaki eski calisma taslagi temizlenemedi ancak ayni event kimligine bagli kaldı.');
        }
        setSaleResult({
          ...resultSnapshot,
          status: duplicate ? 'duplicate' : 'synced',
          title: printSucceeded
            ? 'Fis gonderildi ve yazdirildi'
            : duplicate
              ? 'Daha once gonderilmis'
              : 'Fis gonderildi',
          message: duplicate
            ? `Backend bu fisi daha once almis. Yeni ikinci fis olusturulmadi.${printMessage}`
            : `Fis backend API tarafina basariyla gonderildi.${printMessage}`,
          clientEventId: activeClientEventId,
          documentNumber: responseData?.documentNumber || '',
        });
      } catch (submitError) {
        const authenticationError = isAuthenticationError(submitError);
        const manualReviewError = isTerminalSaleManualReviewErrorCode(submitError.code);
        const resultTitle = manualReviewError
          ? 'ERP incelemesi gerekli'
          : authenticationError
            ? 'Oturum yenilenmeli'
            : 'Gonderim tamamlanmadi';
        const resultMessage = manualReviewError
          ? 'Bu fisin sunucu sonucu guvenle dogrulanamadi. Fisi duzenlemeyin, yeniden gondermeyin veya silmeyin; ERP yoneticisi satis ve denetim kayitlarini kontrol etsin.'
          : authenticationError
            ? 'API baglantisi acik, ancak oturum suresi dolmus. Yeniden giris yaptiktan sonra fisi Sync Merkezi ekranindan gonderebilirsiniz.'
            : `Fis cihaz kuyrugunda korundu. Sunucu islemi tamamlanmadi: ${submitError.message || 'Bilinmeyen hata'}`;

        setMessage(manualReviewError
          ? 'Fis kilitlendi; ERP yoneticisi incelemeli'
          : authenticationError
            ? 'Oturum suresi doldu, fis cihaz kuyrugunda bekliyor'
            : 'Fis cihaz kuyrugunda bekliyor');
        setError(manualReviewError
          ? submitError.message || 'Sunucu sonucu dogrulanamadi'
          : authenticationError
            ? 'Oturum suresi doldu. Yeniden giris yapin.'
            : submitError.message || 'Sunucu islemi tamamlanmadi');
        setSaleResult({
          ...resultSnapshot,
          status: manualReviewError ? 'manual_review' : authenticationError ? 'auth' : 'failed',
          title: resultTitle,
          message: resultMessage,
          clientEventId: activeClientEventId,
        });
      }
      setLines([]);
      setBarcode('');
      setQuantity('1');
      setReviewMode(false);
      setEditingEventId('');
      activeSaleEventIdRef.current = '';
      saleQueuePersistenceUncertainRef.current = false;

      try {
        await onRefresh();
      } catch (refreshError) {
        setError((current) => current || `Fis sonucu korundu; ekran yenilenemedi: ${refreshError.message || 'Yenileme hatasi'}`);
      }
    } finally {
      saleQueueActionInFlightRef.current = false;
      setLoading(false);
    }
  }

  function adjustLineQuantity(productId, delta) {
    setReviewMode(false);
    setLines((current) => current.flatMap((line) => {
      if (String(line.product.id) !== String(productId)) {
        return [line];
      }

      const nextQuantity = Number(line.quantity || 0) + delta;
      return nextQuantity <= 0 ? [] : [{ ...line, quantity: nextQuantity }];
    }));
  }

  function removeLine(productId) {
    setReviewMode(false);
    setLines((current) => current.filter((line) => String(line.product.id) !== String(productId)));
  }

  function openDraftReview() {
    if (!selectedCustomer || lines.length === 0) {
      setError('Cari ve en az bir satir gerekli');
      return;
    }

    setError('');
    setMessage('');
    setSaleResult(null);
    setWhatsappActionsOpen(false);
    setReviewMode(true);
  }

  async function saveDraftToQueue({ goHomeAfterSave = false } = {}) {
    if (!selectedCustomer || lines.length === 0) {
      setError('Kaydedilecek taslak fis yok');
      return;
    }
    if (saleQueueActionInFlightRef.current) return;
    saleQueueActionInFlightRef.current = true;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const wasEditing = Boolean(editingEventId);
      const payload = buildSalePayloadSnapshot();
      const queuedEvent = await persistCurrentSaleToQueue(payload);
      let draftCleanupFailed = false;
      try {
        await clearWorkingSaleDraft();
      } catch {
        draftCleanupFailed = true;
      }
      setSaleResult({
        status: 'offline',
        title: 'Fis taslak kaydedildi',
        message: draftCleanupFailed
          ? 'Fis kuyruga kaydedildi. Eski calisma taslagi temizlenemedi ancak ayni event kimligine bagli kaldi.'
          : 'Fis local kuyruga taslak olarak alindi. Sync Merkezi ekranindan gonderilebilir.',
        customerName: selectedCustomer.customerName,
        lineCount: lines.length,
        itemQuantity,
        clientEventId: queuedEvent.clientEventId,
      });
      setMessage('Fis taslak olarak kaydedildi');
      setLines([]);
      setBarcode('');
      setQuantity('1');
      setReviewMode(false);
      setEditingEventId('');
      activeSaleEventIdRef.current = '';
      saleQueuePersistenceUncertainRef.current = false;
      try {
        await onRefresh();
      } catch (refreshError) {
        setError(`Fis kuyrukta korundu; ekran yenilenemedi: ${refreshError.message || 'Yenileme hatasi'}`);
      }
      if (wasEditing) {
        navigation.openSyncStatus?.();
      } else if (goHomeAfterSave) {
        navigation.goHome();
      }
    } catch (saveError) {
      setMessage('Fis cihazda guvenle kaydedilemedi');
      setError(saveError.message || 'Fis taslak kaydedilemedi; ekrandaki fis korunuyor');
    } finally {
      saleQueueActionInFlightRef.current = false;
      setLoading(false);
    }
  }

  function buildWhatsappSharePayload(mode) {
    return {
      mode,
      phone: selectedCustomer?.phone || '',
      customerId: selectedCustomer?.id,
      customerCode: selectedCustomer?.customerCode || '',
      customerName: selectedCustomer?.customerName || '',
      documentCurrency: selectedCustomer?.currency || 'TRY',
      exchangeRate: Number(selectedExchangeRate || 1),
      items: lines.map((line) => ({
        productId: Number(line.product.id),
        stockCode: line.product.stockCode || '',
        barcode: line.product.matchedBarcode || line.product.barcodeMasked || '',
        productName: line.product.productName || '',
        category: line.product.category || '',
        imageUrl: line.product.imageUrl || '',
        quantity: Number(line.quantity || 1),
        unitPrice: Number(line.unitPrice || line.product.salePrice || 0),
        currency: line.product.currency || selectedCustomer?.currency || 'TRY',
      })),
    };
  }

  async function shareDraftReceiptPdf() {
    if (!selectedCustomer || !lines.length) {
      setError('Paylasilacak fis yok');
      return;
    }

    if (!selectedCustomer.phone) {
      setError('Secili cari kartinda WhatsApp telefonu yok');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await sendTerminalWhatsappShare({
        token: session.accessToken,
        payload: buildWhatsappSharePayload('receipt'),
      });
      const data = result?.data || result || {};
      setMessage(`ERP uzerinden fis PDF gonderildi: ${data.sent || 0} gonderildi, ${data.failed || 0} hatali`);
    } catch (shareError) {
      setError(shareError.message || 'ERP uzerinden fis PDF gonderimi basarisiz');
    } finally {
      setLoading(false);
    }
  }

  async function shareDraftProductsWhatsapp() {
    if (!selectedCustomer || !lines.length) {
      setError('Paylasilacak urun yok');
      return;
    }

    if (!selectedCustomer.phone) {
      setError('Secili cari kartinda WhatsApp telefonu yok');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await sendTerminalWhatsappShare({
        token: session.accessToken,
        payload: buildWhatsappSharePayload('products'),
      });
      const data = result?.data || result || {};
      setMessage(`ERP uzerinden urunler gonderildi: ${data.sent || 0} gonderildi, ${data.failed || 0} hatali, ${data.skipped || 0} atlandi`);
    } catch (shareError) {
      setError(shareError.message || 'ERP uzerinden urun gonderimi basarisiz');
    } finally {
      setLoading(false);
    }
  }

  function clearSale() {
    if (saleQueueActionInFlightRef.current) return;
    if (saleQueuePersistenceUncertainRef.current) {
      setError('Kuyruk yazma sonucu dogrulanamadi; ayni event kimligiyle yeniden denemeden veya ERP incelemeden fis temizlenemez.');
      return;
    }
    setLines([]);
    setBarcode('');
    setQuantity('1');
    setProductAlternatives([]);
    setProductResults([]);
    setLastScannedProduct(null);
    setLastScannedQuantity(0);
    setRecentScans([]);
    setReviewMode(false);
    setEditingEventId('');
    activeSaleEventIdRef.current = '';
    setWhatsappActionsOpen(false);
    setMessage('Fis temizlendi');
    setError('');
    setSaleResult(null);
    setTimeout(() => barcodeRef.current?.focus(), 120);
  }

  function requestLeaveSale() {
    if (saleQueueActionInFlightRef.current) return;
    if (saleQueuePersistenceUncertainRef.current) {
      setExitConfirmationOpen(false);
      setDiscardConfirmationOpen(false);
      setError('Kuyruk yazma sonucu dogrulanamadi; fis guvenle uzlastirilmadan atilip cikilamaz.');
      return;
    }

    if (!lines.length) {
      navigation.goHome();
      return;
    }

    setExitConfirmationOpen(true);
  }

  function recoverWorkingDraft() {
    if (!recoveryDraft) return;

    setSelectedCustomer(recoveryDraft.customer);
    setCustomerQuery(recoveryDraft.customer.customerCode || recoveryDraft.customer.customerName || '');
    setLines(recoveryDraft.lines || []);
    setEditingEventId(recoveryDraft.editingEventId || '');
    activeSaleEventIdRef.current = recoveryDraft.editingEventId || '';
    saleQueuePersistenceUncertainRef.current = false;
    setReviewMode(false);
    setRecoveryDraftOpen(false);
    setRecoveryDraft(null);
    setAutoSaveStatus('saved');
    setAutoSavedAt(recoveryDraft.savedAt || '');
    setMessage('Yarim kalan fis geri yuklendi');
    setError('');
    workingDraftReadyRef.current = true;
  }

  function requestDiscardSaleAndLeave() {
    if (saleQueueActionInFlightRef.current) return;
    if (saleQueuePersistenceUncertainRef.current) {
      setExitConfirmationOpen(false);
      setError('Kuyruk yazma sonucu dogrulanamadi; fis guvenle uzlastirilmadan atilip cikilamaz.');
      return;
    }
    setExitConfirmationOpen(false);
    setDiscardConfirmationOpen(true);
  }

  async function discardWorkingDraft() {
    try {
      await clearWorkingSaleDraft();
      setRecoveryDraftOpen(false);
      setRecoveryDraft(null);
      setAutoSaveStatus('idle');
      setAutoSavedAt('');
      workingDraftReadyRef.current = true;
    } catch (draftError) {
      setError(draftError.message || 'Yarim kalan fis silinemedi');
    }
  }

  async function discardSaleAndLeave() {
    if (saleQueueActionInFlightRef.current) return;
    if (saleQueuePersistenceUncertainRef.current) {
      setExitConfirmationOpen(false);
      setDiscardConfirmationOpen(false);
      setError('Kuyruk yazma sonucu dogrulanamadi; fis guvenle uzlastirilmadan atilip cikilamaz.');
      return;
    }
    setExitConfirmationOpen(false);
    setDiscardConfirmationOpen(false);
    await clearWorkingSaleDraft().catch(() => {});
    setLines([]);
    setBarcode('');
    setQuantity('1');
    setProductQuery('');
    setProductAlternatives([]);
    setProductResults([]);
    setLastScannedProduct(null);
    setLastScannedQuantity(0);
    setRecentScans([]);
    setReviewMode(false);
    setEditingEventId('');
    activeSaleEventIdRef.current = '';
    setWhatsappActionsOpen(false);
    setMessage('');
    setError('');
    setSaleResult(null);
    navigation.goHome();
  }

  async function saveSaleAndLeave() {
    setExitConfirmationOpen(false);
    setDiscardConfirmationOpen(false);
    await saveDraftToQueue({ goHomeAfterSave: true });
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saleQueueActionInFlightRef.current) return true;
      if (expandedImageUrl) {
        setExpandedImageUrl('');
        return true;
      }

      if (saleQueuePersistenceUncertainRef.current) {
        setExitConfirmationOpen(false);
        setDiscardConfirmationOpen(false);
        setError('Kuyruk yazma sonucu dogrulanamadi; fis guvenle uzlastirilmadan atilip cikilamaz.');
        return true;
      }

      if (discardConfirmationOpen) {
        setDiscardConfirmationOpen(false);
        setExitConfirmationOpen(true);
        return true;
      }

      if (exitConfirmationOpen) {
        setExitConfirmationOpen(false);
        return true;
      }

      if (lines.length) {
        setExitConfirmationOpen(true);
      } else {
        navigation.goHome();
      }

      return true;
    });

    return () => subscription.remove();
  }, [discardConfirmationOpen, expandedImageUrl, exitConfirmationOpen, lines.length, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <Modal
      visible={Boolean(expandedImageUrl)}
      transparent
      animationType="fade"
      onRequestClose={() => setExpandedImageUrl('')}
    >
      <Pressable style={styles.imagePreviewBackdrop} onPress={() => setExpandedImageUrl('')}>
        {expandedImageUrl ? (
          <Image source={{ uri: expandedImageUrl }} style={styles.imagePreview} resizeMode="contain" />
        ) : null}
      </Pressable>
    </Modal>
    <Modal
      visible={recoveryDraftOpen}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.customerModalBackdrop}>
        <View style={styles.customerModal}>
          <Text style={styles.customerModalTitle}>Yarim kalan fis bulundu</Text>
          <Text style={styles.customerModalMeta}>
            {recoveryDraft?.customer?.customerName || 'Cari'} / {recoveryDraft?.lines?.length || 0} satir
          </Text>
          <Text style={styles.customerModalMeta}>
            Son otomatik kayit: {formatDraftSavedAt(recoveryDraft?.savedAt) || '-'}
          </Text>
          <Text style={styles.customerModalMeta}>
            Uygulama kapanmis olsa bile bu liste telefonda korunmustur.
          </Text>
          <View style={styles.customerModalActions}>
            <TerminalButton label="Fise Devam Et" onPress={recoverWorkingDraft} />
            <TerminalButton label="Taslagi Sil ve Yeni Basla" onPress={discardWorkingDraft} variant="danger" />
          </View>
        </View>
      </View>
    </Modal>
    <KeyboardSafeScrollView
      ref={saleScrollRef}
      pointerEvents={loading ? 'none' : 'auto'}
      contentContainerStyle={styles.content}
    >
      {!syncState?.online ? (
        <View style={styles.offlineSalePanel}>
          <Text style={styles.offlineSaleTitle}>Offline satis modu</Text>
          <Text style={styles.offlineSaleText}>
            API kapali. Fisi tamamlarsaniz kayit telefonda bekler ve Sync Merkezi'nden gonderilir.
          </Text>
        </View>
      ) : null}

      {editingEventId ? (
        <View style={styles.editDraftPanel}>
          <Text style={styles.editDraftTitle}>Bekleyen fis duzenleniyor</Text>
          <Text style={styles.editDraftText}>
            Kaydedince ayni kuyruk kaydi guncellenir. Yeni ikinci fis olusmaz.
          </Text>
          <Text style={styles.editDraftId} numberOfLines={1}>{editingEventId}</Text>
        </View>
      ) : null}

        <View style={[styles.panel, selectedCustomer && styles.compactCustomerPanel]}>
        {!selectedCustomer ? (
          <>
            <Text style={styles.label}>Pesin cariler</Text>
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
                  <Text style={styles.cashIcon}>{cashCurrency(code)}</Text>
                  <Text style={styles.cashTitle}>Pesin {cashCurrency(code)}</Text>
                  <Text style={styles.cashMeta}>{code}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.searchPanel}>
              <Text style={styles.label}>Cari ara</Text>
              <KeyboardSafeTextInput
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  onSubmitEditing={searchCustomer}
                  style={styles.customerSearchInput}
                  placeholder="Cari adi, kodu veya pesin cari"
                  autoCapitalize="none"
                />
              <TerminalButton label="Cari Ara" onPress={searchCustomer} disabled={loading} />
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
          <View style={styles.saleCompactBar}>
            <View style={styles.saleCompactText}>
              <Text style={styles.selectedCustomerName} numberOfLines={1}>{selectedCustomer.customerName}</Text>
              <RateInfoPanel
                customer={selectedCustomer}
                rateSet={currencyRates}
                onRefresh={() => refreshRates()}
                loading={loading}
              />
            </View>
            <Text style={styles.selectedCurrencyBadge}>{selectedCustomer.currency}</Text>
          </View>
        ) : null}

        <Modal
          visible={customerPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomerPickerOpen(false)}
        >
          <View style={styles.customerModalBackdrop}>
            <View style={styles.customerModal}>
              <View style={styles.customerModalHeader}>
                <View>
                  <Text style={styles.customerModalTitle}>Cari sec</Text>
                  <Text style={styles.customerModalMeta}>En fazla 5 oneriyi gosteriyoruz</Text>
                </View>
                <Pressable onPress={() => setCustomerPickerOpen(false)} style={styles.customerModalClose}>
                  <Text style={styles.customerModalCloseText}>Kapat</Text>
                </Pressable>
              </View>

              <KeyboardSafeTextInput
                value={customerQuery}
                onChangeText={setCustomerQuery}
                onSubmitEditing={searchCustomer}
                style={styles.customerModalInput}
                placeholder="Cari adi veya kodu"
                autoCapitalize="none"
              />

              {customerResults.length ? (
                <View style={styles.customerSuggestionList}>
                  {customerResults.map((customer, index) => (
                    <Pressable
                      key={customer.id}
                      onPress={() => selectCustomer(customer)}
                      style={({ pressed }) => [
                        styles.customerSuggestionRow,
                        pressed && styles.customerSuggestionPressed,
                      ]}
                    >
                      <Text style={styles.customerSuggestionIndex}>{index + 1}</Text>
                      <View style={styles.customerResultText}>
                        <Text style={styles.customerResultName}>{customer.customerName}</Text>
                        <Text style={styles.customerResultMeta}>
                          {customer.customerCode} / Bakiye {formatMoney(customer.balance, customer.currency)}
                        </Text>
                      </View>
                      <Text style={styles.customerCurrencyBadge}>{customer.currency}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.customerModalEmpty}>
                  <Text style={styles.customerOnlyTitle}>Cari bulunamadi</Text>
                  <Text style={styles.customerOnlyText}>Aramayi degistirip tekrar deneyin.</Text>
                </View>
              )}

              <View style={styles.customerModalActions}>
                <TerminalButton label="Tekrar Ara" onPress={searchCustomer} disabled={loading} />
                <TerminalButton label="Vazgec" onPress={() => setCustomerPickerOpen(false)} variant="secondary" />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={exitConfirmationOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setExitConfirmationOpen(false)}
        >
          <View style={styles.customerModalBackdrop}>
            <View style={styles.customerModal}>
              <Text style={styles.customerModalTitle}>Fişte ürün var</Text>
              <Text style={styles.customerModalMeta}>
                Çıkmadan önce fişi taslak olarak kaydedin veya iptal edin.
              </Text>
              <View style={styles.customerModalActions}>
                <TerminalButton label="Fişi Kaydet ve Çık" onPress={saveSaleAndLeave} disabled={loading} />
                <TerminalButton label="Kaydetmeden Çık" onPress={requestDiscardSaleAndLeave} disabled={loading} variant="danger" />
                <TerminalButton label="Vazgeç" onPress={() => setExitConfirmationOpen(false)} disabled={loading} variant="secondary" />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={discardConfirmationOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setDiscardConfirmationOpen(false);
            setExitConfirmationOpen(true);
          }}
        >
          <View style={styles.customerModalBackdrop}>
            <View style={styles.customerModal}>
              <Text style={styles.customerModalTitle}>Kaydetmeden çıkmak istediğinize emin misiniz?</Text>
              <Text style={styles.customerModalMeta}>
                Bu fiş kaydedilmeyecek ve ekrandaki ürün listesi silinecek.
              </Text>
              <View style={styles.customerModalActions}>
                <TerminalButton
                  label="Hayır, Fişe Dön"
                  onPress={() => {
                    setDiscardConfirmationOpen(false);
                    setExitConfirmationOpen(false);
                  }}
                  disabled={loading}
                  variant="success"
                />
                <TerminalButton
                  label="Evet, Kaydetmeden Çık"
                  onPress={discardSaleAndLeave}
                  disabled={loading}
                  variant="danger"
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {!selectedCustomer ? (
        <>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.accentDark} /> : null}
          <View style={styles.customerOnlyPanel}>
            <Text style={styles.customerOnlyTitle}>Once cari secin</Text>
            <Text style={styles.customerOnlyText}>
              Cari secildikten sonra barkod okutma ve fis satirlari ekrani acilir.
            </Text>
          </View>
          <TerminalButton label="Ana ekran" onPress={requestLeaveSale} variant="secondary" />
        </>
      ) : (
        <>
      {!reviewMode ? (
        <>
      <View
        style={styles.panel}
        onLayout={(event) => {
          productEntryOffsetRef.current = event.nativeEvent.layout.y;
        }}
      >
        <View style={styles.barcodeHeader}>
          <View>
            <Text style={styles.title}>Urun Girisi</Text>
            <View style={styles.entryModeControl}>
              <Pressable
                onPress={openBarcodeEntry}
                style={[styles.entryModeButton, entryMode === 'barcode' && styles.entryModeButtonActive]}
              >
                <Text style={[styles.entryModeText, entryMode === 'barcode' && styles.entryModeTextActive]}>Barkod</Text>
              </Pressable>
              <Pressable
                onPress={openStockCodeSearch}
                style={[styles.entryModeButton, entryMode === 'stockCode' && styles.entryModeButtonActive]}
              >
                <Text style={[styles.entryModeText, entryMode === 'stockCode' && styles.entryModeTextActive]}>Stok kodu</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.quantityBadge}>{itemQuantity} adet</Text>
        </View>
        {entryMode === 'barcode' ? (
          <KeyboardSafeTextInput
            ref={barcodeRef}
            value={barcode}
            onChangeText={(value) => {
              const normalizedValue = String(value || '').replace(/[\r\n]/g, '');
              setBarcode(normalizedValue);
              setLastScannedProduct(null);
              setProductAlternatives([]);
              scheduleBarcodeLookup(normalizedValue);
            }}
            onSubmitEditing={() => lookupBarcodeProduct()}
            onFocus={() => setEntryMode('barcode')}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Enter') {
                lookupBarcodeProduct();
              }
            }}
            style={styles.barcodeInput}
            placeholder="Barkod okut"
            showSoftInputOnFocus={false}
            caretHidden={false}
            blurOnSubmit={false}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        ) : (
          <KeyboardSafeTextInput
            ref={productQueryRef}
            value={productQuery}
            onChangeText={setProductQuery}
            onSubmitEditing={() => searchProduct()}
            onFocus={() => setEntryMode('stockCode')}
            style={styles.barcodeInput}
            placeholder="Stok kodu yazin"
            autoCapitalize="none"
            keyboardType="number-pad"
            returnKeyType="search"
          />
        )}
        {entryMode === 'stockCode' && productResults.length ? (
          <View style={styles.productAlternativePanel}>
            {productResults.map((product) => {
              const saleProduct = convertProductForSale(product);
              return (
                <Pressable
                  key={`${product.id}-${product.stockCode}`}
                  onPress={() => selectSearchedProduct(product)}
                  style={styles.productAlternativeRow}
                >
                  <View style={styles.productResultTextBlock}>
                    <Text style={styles.productResultTitle} numberOfLines={1}>
                      {product.stockCode} / {product.productName}
                    </Text>
                    <Text style={styles.productResultMeta} numberOfLines={1}>
                      Stok {product.stockQuantity}
                    </Text>
                  </View>
                  <Text style={styles.productPriceBadge}>{formatMoney(saleProduct.salePrice, saleProduct.currency)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <LastProductPanel product={convertProductForSale(lastScannedProduct)} quantity={quantity || lastScannedQuantity} />
        <Text style={styles.label}>Miktar</Text>
        <View
          style={styles.quantityControl}
          onLayout={(event) => {
            quantityControlOffsetRef.current = event.nativeEvent.layout.y;
          }}
        >
          <Pressable onPress={() => adjustInputQuantity(-1)} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>-</Text>
          </Pressable>
          <KeyboardSafeTextInput
            value={quantity}
            onChangeText={setQuantity}
            onFocus={keepQuantityVisible}
            style={styles.quantityInput}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Pressable onPress={() => adjustInputQuantity(1)} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>+</Text>
          </Pressable>
        </View>
        <TerminalButton label={lastScannedProduct ? 'Satira Ekle' : 'Urunu Getir'} onPress={lastScannedProduct ? addBarcodeLine : lookupBarcodeProduct} disabled={loading} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
        ) : displayLines.map((line) => {
          const lineImageUrl = resolveImageUrl(line.product?.imageUrl, apiBaseUrl);

          return (
            <View key={line.product.id} style={styles.lineRow}>
              <View style={styles.lineMain}>
                <View style={styles.lineText}>
                  <Text style={styles.lineCode}>{line.product.stockCode}</Text>
                  <Text style={styles.lineName} numberOfLines={2}>{line.product.productName}</Text>
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
              {lineImageUrl ? (
                <Pressable onPress={() => setExpandedImageUrl(lineImageUrl)}>
                  <Image source={{ uri: lineImageUrl }} style={styles.lineImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={styles.lineImageEmpty}>
                  <Text style={styles.lineImageEmptyText}>Resim yok</Text>
                </View>
              )}
            </View>
          );
        })}
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

      {rateMessage ? <Text style={styles.message}>{rateMessage}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

      <SaleResultPanel result={saleResult} onOpenSync={navigation.openSyncStatus} />

      <View style={styles.submitPanel}>
        <Text style={styles.submitTitle}>
          {lines.length ? 'Fis taslagi hazir' : 'Fis bos'}
        </Text>
        <Text style={styles.submitMeta}>
          {selectedCustomer ? selectedCustomer.customerName : 'Cari secilmedi'} / {lines.length} satir
        </Text>
        {lines.length ? (
          <Text style={styles.submitMeta}>
            Otomatik taslak: {autoSaveStatus === 'saving'
              ? 'kaydediliyor'
              : autoSaveStatus === 'error'
                ? 'kayit hatasi'
                : `kaydedildi${formatDraftSavedAt(autoSavedAt) ? ` / ${formatDraftSavedAt(autoSavedAt)}` : ''}`}
          </Text>
        ) : null}
        <TerminalButton
          label="Fis Taslagini Kontrol Et"
          onPress={openDraftReview}
          disabled={loading || lines.length === 0 || !selectedCustomer}
        />
      </View>
      <TerminalButton label="Ana ekran" onPress={requestLeaveSale} variant="secondary" />
        </>
      ) : (
        <>
          <View style={styles.reviewPanel}>
            <View style={styles.reviewHeader}>
              <View>
                <Text style={styles.stepLabel}>Taslak fis</Text>
                <Text style={styles.reviewTitle}>Son Kontrol</Text>
                <Text style={styles.reviewMeta}>{selectedCustomer.customerName} / {selectedCustomer.customerCode}</Text>
              </View>
              <Text style={styles.reviewStatus}>TASLAK</Text>
            </View>

            <View style={styles.reviewGrid}>
              <View style={styles.reviewFact}>
                <Text style={styles.reviewFactLabel}>Satir</Text>
                <Text style={styles.reviewFactValue}>{lines.length}</Text>
              </View>
              <View style={styles.reviewFact}>
                <Text style={styles.reviewFactLabel}>Adet</Text>
                <Text style={styles.reviewFactValue}>{itemQuantity}</Text>
              </View>
              <View style={styles.reviewFact}>
                <Text style={styles.reviewFactLabel}>Kur</Text>
                <Text style={styles.reviewFactValue}>{Number(selectedExchangeRate || 1).toFixed(2)}</Text>
              </View>
            </View>

            {lineCurrencies.map((currency) => (
              <InfoRow
                key={`review-${currency}`}
                label={`Toplam ${currency}`}
                value={formatMoney(totalsByCurrency[currency], currency)}
                tone="success"
              />
            ))}

            <View style={styles.receiptContentPanel}>
              <View style={styles.receiptContentHeader}>
                <View>
                  <Text style={styles.receiptContentTitle}>Fis Icerigi</Text>
                  <Text style={styles.receiptContentMeta}>Kategori bazli adet ozeti</Text>
                </View>
                <Text style={styles.receiptContentTotal}>{itemQuantity} adet</Text>
              </View>
              <View style={styles.receiptCategoryList}>
                {categorySummary.length ? categorySummary.map((item) => (
                  <View key={`receipt-category-${item.category}`} style={styles.receiptCategoryRow}>
                    <Text style={styles.receiptCategoryName} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.receiptCategoryQuantity}>{item.quantity} adet</Text>
                  </View>
                )) : (
                  <Text style={styles.receiptCategoryEmpty}>Kategori bilgisi yok</Text>
                )}
              </View>
            </View>

            <View style={styles.reviewLines}>
              {displayLines.map((line) => (
                <View key={`review-line-${line.product.id}`} style={styles.reviewLineRow}>
                  <View style={styles.lineText}>
                    <Text style={styles.lineName}>{line.product.productName}</Text>
                    <Text style={styles.lineMeta}>{line.product.stockCode} / {line.quantity} x {formatMoney(line.unitPrice, line.product.currency)}</Text>
                  </View>
                  <Text style={styles.lineTotal}>{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0), line.product.currency)}</Text>
                </View>
              ))}
            </View>

          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.accentDark} /> : null}

          <View style={styles.reviewActions}>
            <TerminalButton
              label={whatsappActionsOpen ? 'WhatsApp Seceneklerini Kapat' : 'WhatsApp'}
              onPress={() => setWhatsappActionsOpen((current) => !current)}
              disabled={loading || lines.length === 0}
            />
            {whatsappActionsOpen ? (
              <View style={styles.whatsappActionPanel}>
                <Pressable
                  onPress={shareDraftReceiptPdf}
                  disabled={loading || lines.length === 0}
                  style={({ pressed }) => [
                    styles.whatsappActionButton,
                    pressed && styles.whatsappActionPressed,
                    loading && styles.whatsappActionDisabled,
                  ]}
                >
                  <Text style={styles.whatsappActionTitle}>Fisi Gonder</Text>
                  <Text style={styles.whatsappActionMeta}>ERP API PDF olusturur ve WhatsApp'tan yollar</Text>
                </Pressable>
                <Pressable
                  onPress={shareDraftProductsWhatsapp}
                  disabled={loading || lines.length === 0}
                  style={({ pressed }) => [
                    styles.whatsappActionButton,
                    pressed && styles.whatsappActionPressed,
                    loading && styles.whatsappActionDisabled,
                  ]}
                >
                  <Text style={styles.whatsappActionTitle}>Urunleri Gonder</Text>
                  <Text style={styles.whatsappActionMeta}>ERP API gorsel, adet, birim fiyat ve toplam yollar</Text>
                </Pressable>
              </View>
            ) : null}
            <TerminalButton label={editingEventId ? 'Guncelle ve Gonder' : 'Fisi Gonder'} onPress={finishSale} disabled={loading} />
            <TerminalButton label={editingEventId ? 'Degisiklikleri Kaydet' : 'Fisi Kaydet'} onPress={saveDraftToQueue} disabled={loading} variant="secondary" />
            <TerminalButton
              label="Fisi Yazdir"
              onPress={() => finishSale({ printAfterSubmit: true })}
              disabled={loading}
              variant="secondary"
            />
            <TerminalButton label="Duzenle" onPress={() => setReviewMode(false)} disabled={loading} variant="secondary" />
          </View>
          <TerminalButton label="Ana ekran" onPress={requestLeaveSale} variant="secondary" />
        </>
      )}
        </>
      )}
    </KeyboardSafeScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  imagePreviewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    padding: 18,
  },
  imagePreview: {
    width: '100%',
    height: '84%',
  },
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
  offlineSalePanel: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    gap: 4,
  },
  offlineSaleTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '900',
  },
  offlineSaleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  editDraftPanel: {
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.warningSoft,
    padding: 10,
    gap: 4,
  },
  editDraftTitle: {
    color: colors.warning,
    fontSize: 18,
    fontWeight: '900',
  },
  editDraftText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  editDraftId: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  compactCustomerPanel: {
    backgroundColor: colors.white,
    padding: 7,
    gap: 4,
  },
  saleStepHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepLabel: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stepBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepBadgeActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    color: colors.accentDark,
  },
  stepBadgeReady: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    color: colors.success,
  },
  customerIntroPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 10,
    gap: 3,
  },
  customerIntroTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  customerIntroText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  customerOnlyPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 12,
    gap: 4,
  },
  customerOnlyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  customerOnlyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  title: {
    color: colors.text,
    fontSize: 18,
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
    flexWrap: 'nowrap',
    gap: 6,
  },
  cashCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 82,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 7,
    gap: 4,
  },
  cashCardPressed: {
    opacity: 0.75,
  },
  cashIcon: {
    width: 40,
    minHeight: 34,
    overflow: 'hidden',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.accentDark,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 7,
  },
  cashTitle: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  cashMeta: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  searchPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 10,
    gap: 8,
  },
  customerSearchInput: {
    minHeight: 54,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 10,
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
  entryModeControl: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: 4,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  entryModeButton: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 9,
  },
  entryModeButtonActive: {
    backgroundColor: colors.accent,
  },
  entryModeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  entryModeTextActive: {
    color: colors.headerText,
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
    borderLeftColor: colors.success,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 6,
    ...terminalStyles.rowShadow,
  },
  lastProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lastProductTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  lastProductLabel: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lastProductName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  lastProductStockCode: {
    color: colors.danger,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1,
  },
  lastProductPrice: {
    overflow: 'hidden',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 7,
    textAlign: 'center',
  },
  lastProductFacts: {
    flexDirection: 'row',
    gap: 5,
  },
  lastProductPill: {
    flex: 1,
    overflow: 'hidden',
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 5,
    textAlign: 'center',
  },
  recentScanPanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 8,
    gap: 6,
  },
  recentScanTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  recentScanList: {
    gap: 7,
    paddingRight: 6,
  },
  recentScanChip: {
    width: 150,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  recentScanCode: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  recentScanName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  recentScanMeta: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
  },
  saleCompactBar: {
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.successSoft,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  saleCompactText: {
    flex: 1,
    gap: 2,
  },
  ratePanel: {
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratePanelReady: {
    backgroundColor: 'transparent',
  },
  ratePanelWarning: {
    backgroundColor: 'transparent',
  },
  rateText: {
    flex: 1,
  },
  rateMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  rateWarning: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  rateRefreshButton: {
    minWidth: 42,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    paddingHorizontal: 6,
  },
  rateRefreshText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedCustomerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedCustomerName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  selectedCurrencyBadge: {
    minWidth: 42,
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
    textAlign: 'center',
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
  customerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
    justifyContent: 'center',
    padding: 14,
  },
  customerModal: {
    maxHeight: '86%',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 12,
    gap: 10,
  },
  customerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  customerModalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  customerModalMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  customerModalClose: {
    minHeight: 40,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  customerModalCloseText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  customerModalInput: {
    minHeight: 50,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 10,
  },
  customerSuggestionList: {
    gap: 8,
  },
  customerSuggestionRow: {
    minHeight: 68,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 9,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customerSuggestionPressed: {
    opacity: 0.78,
  },
  customerSuggestionIndex: {
    width: 34,
    minHeight: 34,
    overflow: 'hidden',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    color: colors.accentDark,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 6,
  },
  customerModalEmpty: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 4,
  },
  customerModalActions: {
    gap: 8,
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
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderLeftColor: colors.accent,
    borderLeftWidth: 5,
    ...terminalStyles.rowShadow,
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
    minHeight: 132,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    ...terminalStyles.rowShadow,
  },
  lineMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  lineImage: {
    width: 158,
    height: 112,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.panel,
  },
  lineImageEmpty: {
    width: 158,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.panel,
  },
  lineImageEmptyText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  lineText: {
    flex: 1,
    gap: 2,
  },
  lineCode: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  lineName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
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
  reviewPanel: {
    backgroundColor: colors.white,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  reviewMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  reviewStatus: {
    overflow: 'hidden',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reviewGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewFact: {
    flex: 1,
    minHeight: 66,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.panel,
    justifyContent: 'center',
    padding: 10,
  },
  reviewFactLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reviewFactValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  receiptContentPanel: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 9,
    gap: 8,
  },
  receiptContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  receiptContentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  receiptContentMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 1,
  },
  receiptContentTotal: {
    overflow: 'hidden',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  receiptCategoryList: {
    gap: 6,
  },
  receiptCategoryRow: {
    minHeight: 36,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 7,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  receiptCategoryName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  receiptCategoryQuantity: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  receiptCategoryEmpty: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewLines: {
    gap: 7,
  },
  reviewLineRow: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderLeftColor: colors.success,
    borderLeftWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 11,
    gap: 7,
    ...terminalStyles.rowShadow,
  },
  reviewActions: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  whatsappActionPanel: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    padding: 8,
    gap: 7,
  },
  whatsappActionButton: {
    minHeight: 58,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  whatsappActionPressed: {
    opacity: 0.72,
  },
  whatsappActionDisabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  whatsappActionTitle: {
    color: colors.accentDark,
    fontSize: 16,
    fontWeight: '900',
  },
  whatsappActionMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
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
    overflow: 'hidden',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#07110d',
  },
  productAlternativeRow: {
    minHeight: 46,
    borderBottomColor: '#13261d',
    borderBottomWidth: 1,
    backgroundColor: '#07110d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  productResultTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  productResultTitle: {
    color: colors.headerSubtle,
    fontSize: 12,
    fontWeight: '900',
  },
  productResultMeta: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  productPriceBadge: {
    minWidth: 68,
    overflow: 'hidden',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
