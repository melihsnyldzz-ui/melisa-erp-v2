import { partyScopeId } from '../../utils/operationNavigation.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PurchaseInvoiceHeader } from './PurchaseInvoiceHeader.jsx';
import { PurchaseInvoiceItemsTable } from './PurchaseInvoiceItemsTable.jsx';
import { PurchaseInvoiceToolbar } from './PurchaseInvoiceToolbar.jsx';
import { PurchaseInvoiceTotals } from './PurchaseInvoiceTotals.jsx';
import {
  cancelPurchaseDraft,
  createPurchaseDraft,
  fetchPurchaseInvoice,
  finalizePurchaseDraft,
  updatePurchaseDraft,
} from '../../services/invoiceDraftApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { fetchCurrencyRates, rateValueForCurrency } from '../../services/currencyRateApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToExcel, printInvoiceReceipt } from '../../utils/exportUtils.js';
import { searchTextIncludes } from '../../utils/searchText.js';
import { fetchAllPages } from '../../utils/fetchAllPages.js';
import { clearInvoiceSupplierSelection, purchaseFinalizeBlock, purchaseProductAvailable, resolvePurchaseProduct, resolveSupplierSelection, supplierSelectionLabel } from '../../utils/purchaseSelection.js';
import { getPurchaseTotals } from '../../../../../packages/shared/src/purchaseDiscounts.mjs';
import { calculateCurrencySettlement } from '../../../../../packages/shared/src/currencySettlement.mjs';
import { mapPersistedPurchaseTotals } from './purchaseInvoiceTotals.js';

const emptyPurchaseInvoice = {
  date: todayIsoDate(),
  invoiceNo: 'Alış Taslağı',
  supplierId: '',
  supplier: '',
  supplierCurrency: '-',
  supplierBalanceLabel: '-',
  supplierDiscountRate: 0,
  invoiceDiscountType: 'rate',
  invoiceDiscountAmount: 0,
  accountExchangeRate: 1,
  invoiceCurrency: 'TRY',
  exchangeRate: 'TRY 1.0000',
  exchangeRateValue: 1,
  description: '',
  status: 'DRAFT',
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatExchangeRate(currency, value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? `${currency || 'TRY'} ${rate.toFixed(4)}` : `${currency || 'TRY'} tanımsız`;
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${apiConfig.baseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function calculateTotals(items, invoiceRate, supplierRate, invoice) {
  const context = { currency: invoice.invoiceCurrency || 'TRY', exchangeRate: Number(invoice.exchangeRateValue || 1),
    accountCurrency: invoice.supplierCurrency, accountExchangeRate: invoice.accountExchangeRate,
    invoiceDiscountType: invoice.invoiceDiscountType, invoiceDiscountAmount: invoice.invoiceDiscountAmount,
    invoiceDiscountRate: invoiceRate, supplierDiscountRate: supplierRate,
    lineCount: items.length, totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) };
  try {
    const calculated = getPurchaseTotals({ items, invoiceDiscountRate: invoiceRate, supplierDiscountRate: supplierRate,
      invoiceDiscountType: invoice.invoiceDiscountType, invoiceDiscountAmount: invoice.invoiceDiscountAmount,
      exchangeRate: invoice.exchangeRateValue });
    const settlement = invoice.supplierId ? calculateCurrencySettlement({ documentAmount: calculated.grandTotal,
      documentCurrency: invoice.invoiceCurrency, accountCurrency: invoice.supplierCurrency,
      documentRateToTry: invoice.exchangeRateValue, accountRateToTry: invoice.accountExchangeRate }) : null;
    return { ...context, ...calculated, totalDiscount: calculated.discountTotal, tryEquivalent: calculated.amountTry,
      stockCostEffect: calculated.stockCostEffectTry, accountAmount: settlement?.accountAmount ?? null, calculationError: '' };
  } catch (error) {
    return { ...context, items: [], subtotal: null, lineDiscountTotal: null, invoiceDiscountTotal: null,
      supplierDiscountTotal: null, totalDiscount: null, grandTotal: null, tryEquivalent: null, stockCostEffect: null,
      accountAmount: null, calculationError: error.message };
  }
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) {
    return todayIsoDate();
  }

  return String(value).slice(0, 10);
}

function mapDraftToInvoice(draft) {
  const status = String(draft.status || '').toUpperCase();

  return {
    invoiceNo: draft.documentNo,
    date: formatDate(draft.documentDate),
    supplierId: draft.supplierId,
    supplier: draft.supplierName || `Tedarikçi #${draft.supplierId}`,
    supplierCurrency: draft.supplierCurrency,
    supplierBalanceLabel: draft.supplierBalanceLabel || '-',
    employeeName: draft.employeeName || '',
    printSnapshot: { items: draft.items, subtotal: draft.subtotal, discountTotal: draft.discountTotal, grandTotal: draft.grandTotal, taxTotal: draft.taxTotal, currency: draft.documentCurrency },
    supplierDiscountRate: Number(draft.supplierDiscountRate || 0),
    invoiceDiscountType: draft.invoiceDiscountType || 'rate',
    invoiceDiscountAmount: Number(draft.invoiceDiscountAmount || 0),
    accountExchangeRate: Number(draft.accountExchangeRate || (draft.supplierCurrency === 'TRY' ? 1 : draft.supplierCurrency === draft.documentCurrency ? draft.exchangeRate : 0)),
    invoiceCurrency: draft.documentCurrency,
    exchangeRate: `${draft.documentCurrency} ${Number(draft.exchangeRate || 1).toFixed(4)}`,
    exchangeRateValue: Number(draft.exchangeRate || 1),
    description: draft.description || '',
    status,
  };
}

function mapDraftItems(items = []) {
  return items.map((item, index) => ({
    id: item.id ?? index + 1,
    productId: item.productId,
    stockCode: item.stockCode,
    barcode: item.barcode || '-',
    productName: item.productName,
    quantity: Number(item.quantity || 0),
    currency: item.currency,
    purchasePrice: Number(item.purchasePrice || 0),
    lineDiscountRate: Number(item.lineDiscountRate || 0),
    stockEffect: item.stockEffect || '-',
    note: item.note || '-',
  }));
}

export function PurchaseInvoiceScreen({ purchaseDraftId, initialSupplierId, permissions = [], onDirtyChange, onRecordSaved }) {
  const loadedDraftIdRef = useRef(null);
  const [draftId, setDraftId] = useState(purchaseDraftId ?? null);
  const initialSupplierApplied = useRef(false);
  const [invoice, setInvoice] = useState(emptyPurchaseInvoice);
  const [items, setItems] = useState([]);
  const [invoiceRate, setInvoiceRate] = useState(0);
  const [supplierRate, setSupplierRate] = useState(0);
  const [status, setStatus] = useState('DRAFT');
  const [persistedTotals, setPersistedTotals] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Taslak alış fişi stok artırmaz ve cari hareket oluşturmaz.');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [purchaseProductOptions, setPurchaseProductOptions] = useState([]);
  const [productToAddId, setProductToAddId] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [suppliersReady, setSuppliersReady] = useState(false);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [currencyRateError, setCurrencyRateError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(purchaseDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const calculatedTotals = useMemo(
    () => calculateTotals(items, invoiceRate, supplierRate, invoice),
    [invoice, invoiceRate, items, supplierRate],
  );
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isCancelled || (isFinalized && !isCorrectionMode) || isSaving || isFinalizing || isCancelling;
  const totals = useMemo(() => (
    isReadonly && persistedTotals
      ? { ...calculatedTotals, ...persistedTotals, items: calculatedTotals.items, calculationError: '' }
      : calculatedTotals
  ), [calculatedTotals, isReadonly, persistedTotals]);
  const canSaveDraft = draftId ? permissions.includes('purchase.edit') : permissions.includes('purchase.create');
  const canFinalize = permissions.includes('purchase.finalize');
  const canCancel = permissions.includes('purchase.cancel');
  const filteredProducts = useMemo(() => {
    return purchaseProductOptions.filter((product) => {
      const matchesQuery = [
        product.stockCode,
        product.barcode,
        product.matchedBarcode,
        product.productName,
        `${product.stockCode} / ${product.productName}`,
      ].some((value) => searchTextIncludes(value, productQuery));

      return purchaseProductAvailable(product, invoice.supplierId, apiConfig.pilotMode) && matchesQuery;
    });
  }, [invoice.supplierId, productQuery, purchaseProductOptions]);
  const selectedSupplier = useMemo(
    () => supplierOptions.find((item) => String(item.id) === String(invoice.supplierId)) || null,
    [invoice.supplierId, supplierOptions],
  );
  const selectedPurchaseProduct = useMemo(
    () => purchaseProductOptions.find((item) => String(item.productId) === String(productToAddId)) || null,
    [productToAddId, purchaseProductOptions],
  );

  useEffect(() => {
    const product = resolvePurchaseProduct(filteredProducts, productQuery);
    setProductToAddId(product ? String(product.productId) : '');
  }, [filteredProducts, productQuery]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrencyRates() {
      try {
        const response = await fetchCurrencyRates({ date: invoice.date });

        if (isMounted) {
          setCurrencyRates(response.data);
          setCurrencyRateError('');
        }
      } catch (error) {
        if (isMounted) {
          setCurrencyRateError(`Kur bilgisi okunamadı: ${error.message || 'API_ERROR'}`);
        }
      }
    }

    loadCurrencyRates();

    return () => {
      isMounted = false;
    };
  }, [invoice.date]);

  useEffect(() => {
    if (draftId || invoice.invoiceCurrency === 'TRY' || invoice.documentRateManual) {
      return;
    }

    const nextRate = currencyRates?.rates?.some(row => row.currency === invoice.invoiceCurrency) ? rateValueForCurrency(currencyRates, invoice.invoiceCurrency) : null;
    if (nextRate === null) {
      return;
    }

    setInvoice((current) => ({
      ...current,
      exchangeRateValue: nextRate,
      exchangeRate: formatExchangeRate(current.invoiceCurrency, nextRate),
      accountExchangeRate: current.invoiceCurrency === current.supplierCurrency ? nextRate : current.accountExchangeRate,
    }));
  }, [currencyRates, draftId, invoice.invoiceCurrency, invoice.documentRateManual]);

  useEffect(() => {
    if (draftId || !invoice.supplierId || invoice.accountRateManual || invoice.supplierCurrency === invoice.invoiceCurrency) return;
    const nextRate = invoice.supplierCurrency === 'TRY' ? 1
      : currencyRates?.rates?.some(row => row.currency === invoice.supplierCurrency) ? rateValueForCurrency(currencyRates, invoice.supplierCurrency) : null;
    setInvoice(current => ({ ...current, accountExchangeRate: nextRate ?? '' }));
  }, [currencyRates, draftId, invoice.supplierId, invoice.supplierCurrency, invoice.invoiceCurrency, invoice.accountRateManual]);

  useEffect(() => {
    let isMounted = true;
    setSuppliersReady(false);
    fetchAllPages(fetchSuppliers, { activeOnly: true })
      .then((suppliers) => {
        if (!isMounted) return;
        setSupplierOptions(suppliers);
        setSuppliersReady(true);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(`Tedarikçi listesi tamamlanamadı: ${error.message || 'API_ERROR'}`);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      setIsLookupLoading(true);

      try {
        const productResponse = await (invoice.supplierId
            ? fetchProducts({
              page: 1,
              limit: 100,
              search: productQuery,
              barcode: productQuery,
              supplierId: apiConfig.pilotMode ? undefined : invoice.supplierId,
              activeOnly: true,
            })
            : Promise.resolve({ data: [] }));

        if (!isMounted) {
          return;
        }

        const nextProducts = (productResponse.data || []).map((product) => ({
          productId: product.id,
          supplierId: product.supplierId || null,
          stockCode: product.stockCode,
          barcode: product.barcodeMasked || '-',
          matchedBarcode: product.matchedBarcode || null,
          productName: product.productName,
          imageUrl: resolveImageUrl(product.imageUrl),
          currency: product.currency,
          purchasePrice: Number(product.purchasePrice || 0),
          lineDiscountRate: Number(product.purchaseDiscountRate || 0),
          isPassive: Boolean(product.isPassive),
        }));

        setPurchaseProductOptions((currentOptions) => {
          const merged = new Map(currentOptions.map((product) => [String(product.productId), product]));
          nextProducts.forEach((product) => merged.set(String(product.productId), product));
          return Array.from(merged.values());
        });
        setErrorMessage('');
      } catch (error) {
        if (isMounted) {
          setProductToAddId('');
          setErrorMessage(`${error.message || 'Alış için tedarikçi ve ürün bilgileri okunamadı.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Tedarikçi ve ürün bilgileri alınamadı; canlı veriye ulaşılamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLookupLoading(false);
        }
      }
    }

    loadLookups();

    return () => {
      isMounted = false;
    };
  }, [invoice.supplierId, productQuery]);

  useEffect(() => {
    if (!purchaseDraftId || loadedDraftIdRef.current === String(purchaseDraftId)) {
      return undefined;
    }

    let isMounted = true;

    async function loadDraft() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchPurchaseInvoice(purchaseDraftId);
        const nextInvoice = mapDraftToInvoice(response.data);
        const nextItems = mapDraftItems(response.data.items);

        if (isMounted) {
          loadedDraftIdRef.current = String(response.data.id);
          setDraftId(response.data.id);
          setInvoice(nextInvoice);
          setSupplierQuery(nextInvoice.supplier);
          setItems(nextItems);
          setPersistedTotals(mapPersistedPurchaseTotals(response.data, nextItems));
          setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
          setSupplierRate(Number(response.data.supplierDiscountRate || 0));
          setStatus(nextInvoice.status);
          setIsCorrectionMode(false);
          setSelectedItemId(nextItems[0]?.id ?? null);
          setIsDirty(false);
          setStatusMessage(nextInvoice.status === 'FINALIZED'
            ? `Kesinleşmiş alış fişi açıldı (#${response.data.id}); stok ve tedarikçi hareketleri kayıtlı.`
            : nextInvoice.status === 'CANCELLED'
              ? `İptal edilmiş alış fişi açıldı (#${response.data.id}); yeni işlem için yeni belge hazırlayın.`
              : `Alış taslağı açıldı (#${response.data.id}); stok ve cari henüz değişmedi.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Alış taslağı okunamadı.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Alış taslağı okunamadı; API ve veritabanı bağlantısını kontrol edin.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [purchaseDraftId]);

  function buildDraftPayload() {
    return {
      documentNo: invoice.invoiceNo,
      documentDate: invoice.date,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier,
      supplierCurrency: invoice.supplierCurrency,
      documentCurrency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRateValue || 1,
      description: invoice.description,
      invoiceDiscountRate: invoiceRate,
      invoiceDiscountType: invoice.invoiceDiscountType,
      invoiceDiscountAmount: invoice.invoiceDiscountAmount,
      accountExchangeRate: invoice.accountExchangeRate,
      supplierDiscountRate: supplierRate,
      items: items.map((item, index) => ({
        productId: item.productId || index + 1,
        stockCode: item.stockCode,
        barcode: item.barcode,
        productName: item.productName,
        quantity: item.quantity,
        currency: item.currency,
        purchasePrice: item.purchasePrice,
        lineDiscountRate: item.lineDiscountRate,
        stockEffect: item.stockEffect,
        note: item.note,
      })),
    };
  }

  function createNewDraft() {
    if (isSaving || isFinalizing || isCancelling) return;
    loadedDraftIdRef.current = null;
    onRecordSaved?.(null);
    setDraftId(null);
    setInvoice(emptyPurchaseInvoice);
    setItems([]);
    setPersistedTotals(null);
    setInvoiceRate(0);
    setSupplierRate(0);
    setStatus('DRAFT');
    setIsCorrectionMode(false);
    setSelectedItemId(null);
    setSupplierQuery('');
    setProductQuery('');
    setProductToAddId('');
    setErrorMessage('');
    setIsDirty(false);
    setStatusMessage('Yeni alış taslağı hazırlandı; kaydedilene kadar ticari etki yok.');
  }

  function markDirty(message) {
    setIsDirty(true);
    setStatusMessage(message);
  }

  function centralRateForCurrency(currency) {
    const nextCurrency = String(currency || 'TRY').toUpperCase();
    if (nextCurrency === 'TRY') {
      return 1;
    }

    const nextRate = currencyRates?.rates?.some(row => row.currency === nextCurrency) ? rateValueForCurrency(currencyRates, nextCurrency) : null;
    if (nextRate === null) {
      setCurrencyRateError(`${nextCurrency} kuru bu fiş tarihi için tanımlı değil. Ayarlar > Döviz Kurları ekranından kur girin.`);
      return null;
    }

    setCurrencyRateError('');
    return nextRate;
  }

  function convertCurrencyAmount(amount, sourceCurrency, targetCurrency) {
    const source = String(sourceCurrency || 'TRY').toUpperCase();
    const target = String(targetCurrency || 'TRY').toUpperCase();
    if (source === target || Number(amount) === 0) return roundCurrency(amount);
    const sourceRate = source === invoice.invoiceCurrency && Number(invoice.exchangeRateValue) > 0
      ? Number(invoice.exchangeRateValue) : centralRateForCurrency(source);
    const targetRate = centralRateForCurrency(target);

    if (sourceRate === null || targetRate === null) {
      return null;
    }

    const amountTry = Number(amount || 0) * sourceRate;
    return roundCurrency(amountTry / targetRate);
  }

  function updateInvoiceField(field, value) {
    setInvoice((current) => ({
      ...current,
      [field]: value,
    }));
    markDirty('Alış taslağı değişti; stok ve tedarikçi cari hareketi oluşmadı.');
  }

  function updateInvoiceCurrency(currency) {
    if (isFinalized) {
      setStatusMessage('Kesinleşmiş fişte tedarikçi ve para birimi değiştirilemez.');
      return;
    }

    const nextCurrency = String(currency || 'TRY').toUpperCase();
    const nextRate = centralRateForCurrency(nextCurrency);
    if (nextRate === null) {
      setErrorMessage('Para birimi değiştirilemedi: fiş tarihi için kur tanımlayın. Mevcut tutarlar korunuyor.');
      return;
    }

    const convertedItems = items.map((item) => {
      const convertedPrice = convertCurrencyAmount(item.purchasePrice, item.currency, nextCurrency);
      return convertedPrice === null ? null : {
        ...item,
        currency: nextCurrency,
        purchasePrice: convertedPrice,
      };
    });

    const convertedDiscountAmount = invoice.invoiceDiscountType === 'amount'
      ? convertCurrencyAmount(invoice.invoiceDiscountAmount, invoice.invoiceCurrency, nextCurrency) : 0;
    if (convertedItems.some((item) => item === null) || convertedDiscountAmount === null) {
      setErrorMessage(`${nextCurrency} için alış satırları çevrilemedi. Döviz Kurları ekranından kur tanımını kontrol edin.`);
      return;
    }

    setInvoice((current) => ({
      ...current,
      invoiceCurrency: nextCurrency,
      exchangeRate: formatExchangeRate(nextCurrency, nextRate),
      exchangeRateValue: nextRate,
      invoiceDiscountAmount: convertedDiscountAmount,
      documentRateManual: false,
      accountExchangeRate: nextCurrency === current.supplierCurrency ? nextRate : current.accountExchangeRate,
    }));
    setItems(convertedItems);
    markDirty('Fiş para birimi değişti; kur bilgisi merkezi döviz kurundan alındı.');
  }

  function updateInvoiceRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Fiş geneli iskonto oranı 0-100 arasında olmalı.');
      return;
    }

    setErrorMessage('');
    setInvoiceRate(value);
    markDirty('Fiş geneli iskonto değişti; taslak henüz ticari etki oluşturmaz.');
  }

  function updateInvoiceDiscountType(value) {
    if (!['rate', 'amount'].includes(value)) return;
    setInvoice(current => ({ ...current, invoiceDiscountType: value, invoiceDiscountAmount: 0 }));
    setInvoiceRate(0);
    markDirty('Fiş iskonto türü değişti; yeni yüzde veya tutarı girin.');
  }

  function updateInvoiceDiscountAmount(value) {
    setInvoice(current => ({ ...current, invoiceDiscountAmount: value }));
    markDirty('Fiş iskonto tutarı değişti; taslak henüz ticari etki oluşturmaz.');
  }

  function updateDocumentRate(value) {
    if (isFinalized || invoice.invoiceCurrency === 'TRY') return;
    setInvoice(current => ({ ...current, exchangeRateValue: value, documentRateManual: true,
      exchangeRate: formatExchangeRate(current.invoiceCurrency, value),
      accountExchangeRate: current.invoiceCurrency === current.supplierCurrency ? value : current.accountExchangeRate }));
    markDirty('Fiş kuru değişti; TRY maliyeti ve cari karşılığı yeniden hesaplandı.');
  }

  function updateAccountRate(value) {
    if (isFinalized || invoice.supplierCurrency === 'TRY' || invoice.supplierCurrency === invoice.invoiceCurrency) return;
    setInvoice(current => ({ ...current, accountExchangeRate: value, accountRateManual: true }));
    markDirty('Cari kuru değişti; tedarikçi borcunun döviz karşılığı yeniden hesaplandı.');
  }

  function updateSupplierRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Tedarikçi iskonto oranı 0-100 arasında olmalı.');
      return;
    }

    setErrorMessage('');
    setSupplierRate(value);
    setInvoice((current) => ({ ...current, supplierDiscountRate: value }));
    markDirty('Tedarikçi iskonto değişti; taslak henüz ticari etki oluşturmaz.');
  }

  function selectSupplier(supplierId) {
    if (isFinalized) {
      setStatusMessage('Kesinleşmiş fişte tedarikçi değiştirilemez.');
      return;
    }

    const supplier = supplierOptions.find((item) => String(item.id) === String(supplierId));

    if (!supplier || !suppliersReady) {
      return;
    }

    const supplierCurrency = supplier.currency || 'TRY';
    const convertedDiscountAmount = invoice.invoiceDiscountType === 'amount'
      ? convertCurrencyAmount(invoice.invoiceDiscountAmount, invoice.invoiceCurrency, supplierCurrency) : 0;
    const convertedItems = items.map((item) => {
      const convertedPrice = convertCurrencyAmount(item.purchasePrice, item.currency, supplierCurrency);
      return convertedPrice === null ? null : { ...item, currency: supplierCurrency, purchasePrice: convertedPrice };
    });
    if (convertedItems.some((item) => item === null) || convertedDiscountAmount === null) {
      setInvoice(clearInvoiceSupplierSelection);
      setSupplierRate(0);
      markDirty('Tedarikçi para birimine geçiş için kur tanımı gerekli.');
      setErrorMessage('Tedarikçi seçilemedi: satır kurlarını tanımlayıp yeniden seçin. Alış satırları korunuyor.');
      return;
    }

    setErrorMessage('');
    const nextSupplierRate = Number(supplier.purchaseDiscountRate || 0);
    const nextRate = centralRateForCurrency(supplier.currency);
    setSupplierRate(nextSupplierRate);
    setSupplierQuery(supplierSelectionLabel(supplier));
    setItems(convertedItems);
    setProductQuery('');
    setPurchaseProductOptions([]);
    setProductToAddId('');
    setInvoice((current) => ({
      ...current,
      supplierId: supplier.id,
      supplier: supplier.supplierName,
      supplierCurrency: supplier.currency,
      supplierBalanceLabel: formatMoney(supplier.balance, supplier.currency),
      supplierDiscountRate: nextSupplierRate,
      invoiceCurrency: supplier.currency,
      exchangeRate: nextRate === null ? `${supplier.currency} tanımsız` : formatExchangeRate(supplier.currency, nextRate),
      exchangeRateValue: nextRate === null ? '' : nextRate,
      invoiceDiscountAmount: convertedDiscountAmount,
      accountExchangeRate: nextRate === null ? '' : nextRate,
      accountRateManual: false,
      documentRateManual: false,
    }));
    markDirty(nextSupplierRate > 0
      ? `Tedarikçi seçildi; alış iskontosu %${nextSupplierRate} önerildi.`
      : 'Tedarikçi seçildi; alış taslağı henüz stok veya cari hareket oluşturmaz.');
  }

  useEffect(() => {
    if (initialSupplierApplied.current || !initialSupplierId || !suppliersReady || isLoading) return;
    initialSupplierApplied.current = true;
    if (draftId || invoice.supplierId || isDirty || items.length || isReadonly || !permissions.includes('purchase.create')) return;
    let id;
    try { id = partyScopeId(initialSupplierId); } catch (error) { setErrorMessage(error.message); return; }
    const supplier = supplierOptions.find(item => String(item.id) === id);
    if (!supplier || supplier.isPassive) { setErrorMessage('Bağlantıdaki tedarikçi aktif alış listesinde bulunamadı. Cariyi kontrol ederek seçin.'); return; }
    selectSupplier(id);
  }, [initialSupplierId, suppliersReady, isLoading, draftId, invoice.supplierId, isDirty, items.length, isReadonly, supplierOptions, permissions]);

  function addDraftItem() {
    if (isSaving || isFinalizing || isLookupLoading || !suppliersReady) return;
    if (!invoice.supplierId) {
      setErrorMessage('Satır eklemek için önce tedarikçi seçin.');
      setStatusMessage('Tedarikçi seçilmeden ürün satırı eklenemez.');
      return;
    }

    if (!productToAddId) {
      setErrorMessage('Satır eklemek için önce ürün seçin.');
      setStatusMessage('Ürün seçilmeden satır eklenemez.');
      return;
    }

    const product = purchaseProductOptions.find((item) => String(item.productId) === String(productToAddId));

    if (!product || isReadonly) {
      setErrorMessage('Seçilen ürün bulunamadı veya fiş salt okunur durumda.');
      return;
    }

    if (product.isPassive) {
      setErrorMessage('Pasif ürünler alış taslağına eklenemez.');
      return;
    }

    if (!purchaseProductAvailable(product, invoice.supplierId, apiConfig.pilotMode)) {
      setErrorMessage('Seçilen ürün bu tedarikçiye bağlı değil. Önce doğru tedarikçiyi seçin.');
      setStatusMessage('Alış fişinde yalnızca seçili tedarikçiye bağlı ürünler eklenebilir.');
      return;
    }

    if (invoice.invoiceCurrency !== 'TRY' && (!Number.isFinite(Number(invoice.exchangeRateValue)) || Number(invoice.exchangeRateValue) <= 0)) {
      setErrorMessage(`${invoice.invoiceCurrency} kuru tanımlı değil. Ayarlar > Döviz Kurları ekranından kur girin.`);
      setStatusMessage('Kur tanımı olmadan dövizli alış satırı eklenemez.');
      return;
    }

    const convertedPurchasePrice = convertCurrencyAmount(product.purchasePrice, product.currency, invoice.invoiceCurrency);
    if (convertedPurchasePrice === null) {
      setErrorMessage(`${product.currency} fiyatlı ürün ${invoice.invoiceCurrency} alış fişine çevrilemedi. Döviz Kurları ekranından kur tanımını kontrol edin.`);
      return;
    }

    const nextId = Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
    setErrorMessage('');
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => String(item.productId) === String(product.productId));

      if (existingItem) {
        setSelectedItemId(existingItem.id);
        return currentItems.map((item) => (
          item.id === existingItem.id ? { ...item, quantity: item.quantity + 1, stockEffect: `+${item.quantity + 1} taslak` } : item
        ));
      }

      setSelectedItemId(nextId);
      return [
        ...currentItems,
        {
          id: nextId,
          productId: product.productId,
          stockCode: product.stockCode,
          barcode: product.barcode,
          productName: product.productName,
          quantity: 1,
          currency: invoice.invoiceCurrency,
          purchasePrice: convertedPurchasePrice,
          lineDiscountRate: product.lineDiscountRate,
          stockEffect: '+1 taslak',
          note: 'Alış taslak satırı',
        },
      ];
    });
    markDirty('Ürün alış taslağına eklendi; gerçek stok artışı yok.');
  }

  function addDraftItemFromKeyboard(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftItem();
    }
  }

  function updateSupplierQuery(value) {
    if (isFinalized) return;
    setSupplierQuery(value);
    const match = suppliersReady ? resolveSupplierSelection(supplierOptions, value) : null;

    if (match) {
      selectSupplier(match.id);
    } else {
      setInvoice(clearInvoiceSupplierSelection);
      setSupplierRate(0);
      setProductToAddId('');
      markDirty('Tedarikçi seçimi temizlendi; listeden kod ve ad ile seçim yapın.');
    }
  }

  function updateProductQuery(value) {
    setProductQuery(value);
    const match = resolvePurchaseProduct(filteredProducts, value);
    setProductToAddId(match ? String(match.productId) : '');
  }

  function updateDraftItem(itemId, field, value) {
    if ((field === 'quantity' || field === 'purchasePrice') && value <= 0) {
      setErrorMessage(field === 'quantity' ? 'Miktar 0 veya negatif olamaz.' : 'Alış fiyatı 0 veya negatif olamaz.');
      return;
    }

    if (field === 'lineDiscountRate' && (value < 0 || value > 100)) {
      setErrorMessage('Satır iskonto oranı 0-100 arasında olmalı.');
      return;
    }

    setErrorMessage('');
    setItems((currentItems) => currentItems.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const nextItem = { ...item, [field]: value };
      return field === 'quantity' ? { ...nextItem, stockEffect: `+${value} taslak` } : nextItem;
    }));
    markDirty('Alış satırı güncellendi; taslak kaydedilene kadar ticari etki yok.');
  }

  function deleteDraftItem(itemId) {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      setSelectedItemId(nextItems[0]?.id ?? null);
      return nextItems;
    });
    markDirty('Alış satırı taslaktan silindi; stok hareketi oluşmadı.');
  }

  async function saveDraft() {
    if (totals.calculationError) {
      setErrorMessage(`Alış taslağı kaydedilemez: ${totals.calculationError}`);
      return;
    }
    if (isCancelled) {
      setStatusMessage('İptal edilmiş alış fişi güncellenemez; yeni taslak kullanın.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage(draftId ? 'Bu işlem için purchase.edit yetkisi gerekli.' : 'Bu işlem için purchase.create yetkisi gerekli.');
      return;
    }

    if (!invoice.supplierId) {
      setErrorMessage('Alış taslağı kaydetmek için tedarikçi seçin.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Boş alış taslağı kaydedilemez. En az bir ürün satırı ekleyin.');
      return;
    }

    if (items.some((item) => item.quantity <= 0 || item.purchasePrice <= 0)) {
      setErrorMessage('Alış taslağı kaydedilemez: miktar ve alış fiyatı 0 veya negatif olamaz.');
      return;
    }

    if (items.some((item) => item.lineDiscountRate < 0 || item.lineDiscountRate > 100)) {
      setErrorMessage('Alış taslağı kaydedilemez: satır iskonto oranı 0-100 arasında olmalı.');
      return;
    }

    if (invoice.invoiceCurrency !== 'TRY' && (!Number.isFinite(Number(invoice.exchangeRateValue)) || Number(invoice.exchangeRateValue) <= 0)) {
      setErrorMessage(`${invoice.invoiceCurrency} kuru tanımlı değil. Ayarlar > Döviz Kurları ekranından kur girin.`);
      setStatusMessage('Kur tanımı olmadan dövizli alış fişi kaydedilemez.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const wasFinalizedCorrection = isFinalized;
      const payload = buildDraftPayload();
      const response = draftId
         ? await updatePurchaseDraft(draftId, payload)
        : await createPurchaseDraft(payload);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      loadedDraftIdRef.current = String(response.data.id);
      setDraftId(response.data.id);
      setInvoice(nextInvoice);
      setItems(nextItems);
      setPersistedTotals(mapPersistedPurchaseTotals(response.data, nextItems));
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setIsCorrectionMode(false);
      onRecordSaved?.({ id: response.data.id, documentNo: response.data.documentNo });
      setStatusMessage(wasFinalizedCorrection
        ? `Kesin alış fişi düzeltildi (#${response.data.id}); stok, tedarikçi bakiyesi ve maliyet kayıtları fark kadar güncellendi.`
        : response.message || `Alış taslağı DB'ye kaydedildi (#${response.data.id}); stok, cari ve average cost etkisi oluşmadı.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alış taslağı kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alış taslak kaydı başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  function editFinalizedInvoice() {
    if (!isFinalized || !canSaveDraft) return;
    setErrorMessage('');
    setIsCorrectionMode(true);
    setStatusMessage('Düzeltme açık. Tedarikçi ve para birimi korunur; satır, miktar, fiyat, iskonto, tarih ve açıklama değiştirilebilir.');
  }

  async function finalizeInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda alış kesinleştirme kapalıdır. Gerçek stok ve tedarikçi hareketleri yazılmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Kesinleştirmek için önce alış taslağını kaydedin.');
      return;
    }

    if (!canFinalize) {
      setErrorMessage('Bu işlem için purchase.finalize yetkisi gerekli.');
      return;
    }

    const finalizeBlock = purchaseFinalizeBlock({ draftId, supplierId: invoice.supplierId, isDirty, isSaving });
    if (finalizeBlock) {
      setErrorMessage(finalizeBlock);
      return;
    }

    setIsFinalizing(true);
    setErrorMessage('');

    try {
      const response = await finalizePurchaseDraft(draftId);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setInvoice(nextInvoice);
      setItems(nextItems);
      setPersistedTotals(mapPersistedPurchaseTotals(response.data, nextItems));
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
      setIsCorrectionMode(false);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Alış fişi kesinleşti (#${response.data.id}); stok ve tedarikçi hareketleri oluştu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alış fişi kesinleştirilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alış kesinleştirme başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsFinalizing(false);
    }
  }

  async function cancelInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda alış iptal simüle edilir; gerçek stok ve tedarikçi hareketleri yazılmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('İptal etmek için kayıtlı alış fişi gerekli.');
      return;
    }

    if (!isFinalized) {
      setErrorMessage('Sadece finalized alış fişleri iptal edilebilir.');
      return;
    }

    if (!canCancel) {
      setErrorMessage('Bu işlem için purchase.cancel yetkisi gerekli.');
      return;
    }

    const reason = window.prompt('Alış fişi iptal nedeni zorunludur:');
    if (!reason || !reason.trim()) {
      setErrorMessage('İptal nedeni zorunludur.');
      return;
    }

    setIsCancelling(true);
    setErrorMessage('');

    try {
      const response = await cancelPurchaseDraft(draftId, reason.trim());
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setInvoice(nextInvoice);
      setItems(nextItems);
      setPersistedTotals(mapPersistedPurchaseTotals(response.data, nextItems));
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
      setIsCorrectionMode(false);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Alış fişi iptal edildi (#${response.data.id}); stok ve tedarikçi ters hareketleri oluştu. Average cost rollback yapılmadı.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alış fişi iptal edilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alış iptal başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsCancelling(false);
    }
  }

  function printPurchaseInvoice() {
    const savedPrint = !isDirty ? invoice.printSnapshot : null;
    printInvoiceReceipt({
      title: 'Alış Fişi',
      documentNo: invoice.invoiceNo,
      status,
      hasUnsavedChanges: isDirty,
      date: invoice.date,
      partyLabel: 'Tedarikçi',
      partyName: invoice.supplier,
      currency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRate,
      description: invoice.description,
      items: savedPrint?.items || items,
      totals: savedPrint || totals,
      extraInfo: [
        { label: 'Personel', value: invoice.employeeName || '—' },
        { label: 'Tedarikçi PB', value: invoice.supplierCurrency },
        { label: 'Tedarikçi Bakiye', value: invoice.supplierBalanceLabel },
        { label: 'Satır Sayısı', value: totals.lineCount },
        { label: 'Toplam Adet', value: totals.totalQuantity },
        { label: 'Fiş İskonto', value: invoice.invoiceDiscountType === 'amount' ? formatMoney(invoice.invoiceDiscountAmount, invoice.invoiceCurrency) : `%${invoiceRate}` },
        { label: 'Tedarikçi İskonto', value: `%${supplierRate}` },
      ],
    });
  }

  function exportPurchaseInvoiceRows() {
    exportRowsToExcel({
      filename: `alış-fişi-${invoice.invoiceNo}`,
      title: `Alış Fişi ${invoice.invoiceNo}`,
      rows: items,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Miktar', key: 'quantity' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Alış Fiyatı', key: 'purchasePrice' },
        { label: 'Satır İskonto %', key: 'lineDiscountRate' },
        { label: 'Satır Toplamı', value: (row) => Number(row.quantity || 0) * Number(row.purchasePrice || 0) },
        { label: 'Net Satır Toplamı', key: 'lineTotal' },
        { label: 'Not', key: 'note' },
      ],
    });
  }

  return (
    <main className="work-area purchase-invoice-screen">
      <PurchaseInvoiceToolbar
        status={status}
        isSaving={isSaving}
        isCancelling={isCancelling}
        isFinalizing={isFinalizing}
        isReadonly={isReadonly}
        canSaveDraft={canSaveDraft && !totals.calculationError}
        canFinalize={canFinalize && !isDirty && Boolean(invoice.supplierId) && Boolean(draftId) && !totals.calculationError}
        canCancel={canCancel}
        isCorrectionMode={isCorrectionMode}
        onNewDraft={createNewDraft}
        onEditFinalized={editFinalizedInvoice}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
        onCancel={cancelInvoice}
        onExport={exportPurchaseInvoiceRows}
        onPrint={printPurchaseInvoice}
      />
      <section className="purchase-invoice-layout">
        {isLoading && <div className="list-state">Alış taslağı API'den okunuyor...</div>}
        {isLookupLoading && <div className="list-state">Tedarikçi ve ürün lookup API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {currencyRateError && <div className="list-state list-state-error">{currencyRateError}</div>}
        {totals.calculationError && <div className="list-state list-state-error" role="alert">{totals.calculationError}</div>}
        {isSaving && <div className="list-state">Alış taslağı API'ye kaydediliyor...</div>}
        {isFinalized && (
          <div className="list-state list-state-success">{isCorrectionMode ? 'Kesin fiş düzeltmeye açık; kaydettiğinizde farklar doğrudan uygulanır.' : 'FINALIZED alış fişi kesinleşmiş; Düzenle ile kontrollü değişiklik yapabilirsiniz.'}</div>
        )}
        {isCancelled && (
          <div className="list-state list-state-success">CANCELLED alış fişi kapalı; yeni işlem için yeni taslak kullanın.</div>
        )}
        {!isReadonly && <section className="erp-panel purchase-draft-controls">
          <div className="panel-title">
            <strong>Alış Girişi</strong>
            <span>Tedarikçiyi seç, ürünü okut veya ara</span>
          </div>
          <div className="purchase-draft-control-grid">
            <label>
              <span>Tedarikçi</span>
              <input
                disabled={isFinalized || !suppliersReady}
                list="purchase-supplier-suggestions"
                placeholder={suppliersReady ? 'Tedarikçi kodu / adı' : 'Tedarikçiler yükleniyor'}
                value={supplierQuery}
                onChange={(event) => updateSupplierQuery(event.target.value)}
              />
              <datalist id="purchase-supplier-suggestions">
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplierSelectionLabel(supplier)} label={supplier.currency || ''} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Ürün / barkod</span>
              <input
                list="purchase-product-suggestions"
                placeholder="Barkod / stok kodu / ürün adı"
                value={productQuery}
                onChange={(event) => updateProductQuery(event.target.value)}
                onKeyDown={addDraftItemFromKeyboard}
              />
              <datalist id="purchase-product-suggestions">
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={`${product.stockCode} / ${product.productName}`} label={formatMoney(product.purchasePrice, product.currency)} />
                ))}
              </datalist>
            </label>
            <button type="button" onClick={addDraftItem} disabled={isLookupLoading || !invoice.supplierId || !suppliersReady}>Satır Ekle</button>
          </div>
          <div className="purchase-entry-context" aria-live="polite">
            <span className={selectedSupplier ? 'is-ready' : ''}><b>Tedarikçi:</b> {selectedSupplier?.supplierName || 'Seçilmedi'}</span>
            <span className={selectedPurchaseProduct ? 'is-ready' : ''}><b>Ürün:</b> {selectedPurchaseProduct ? `${selectedPurchaseProduct.stockCode} / ${selectedPurchaseProduct.productName}` : 'Seçilmedi'}</span>
            <span><b>İskonto:</b> %{Number(supplierRate || 0)}</span>
            <span><b>Fiş:</b> {invoice.invoiceCurrency || 'TRY'} / {invoice.exchangeRate}</span>
          </div>
        </section>}
        <PurchaseInvoiceHeader
          invoice={invoice}
          invoiceRate={invoiceRate}
          isIdentityLocked={isFinalized}
          isReadonly={isReadonly}
          status={status}
          supplierRate={supplierRate}
          onChange={updateInvoiceField}
          onCurrencyChange={updateInvoiceCurrency}
          onInvoiceRateChange={updateInvoiceRate}
          onInvoiceDiscountTypeChange={updateInvoiceDiscountType}
          onInvoiceDiscountAmountChange={updateInvoiceDiscountAmount}
          onDocumentRateChange={updateDocumentRate}
          onAccountRateChange={updateAccountRate}
          onSupplierRateChange={updateSupplierRate}
        />
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state purchase-empty-state">Alış taslak satırı yok. Üstten tedarikçi ve ürün seçip Satır Ekle ile başlayın.</div>
        )}
        <PurchaseInvoiceItemsTable
          invoiceStatus={status}
          isCorrectionMode={isCorrectionMode}
          exchangeRate={invoice.exchangeRateValue}
          invoiceCurrency={invoice.invoiceCurrency}
          invoiceRate={invoiceRate}
          isReadonly={isReadonly}
          items={items}
          lineCosts={totals.items}
          supplierRate={supplierRate}
          selectedItemId={selectedItemId}
          onDeleteItem={deleteDraftItem}
          onSelectItem={setSelectedItemId}
          onUpdateItem={updateDraftItem}
        />
        <PurchaseInvoiceTotals totals={totals} />
        <section className="purchase-status-line">{statusMessage}</section>
      </section>
      <section className="screen-summary purchase-invoice-summary">
        <span>Fiş: {invoice.invoiceNo}</span>
        <span>Draft ID: {draftId || 'yok'}</span>
        <span>{draftId ? 'Kaydedilmiş taslak' : 'Kaydedilmemiş taslak'}</span>
        <span>{isDirty ? 'Değişti' : 'Temiz'}</span>
        <span>Durum: {status}</span>
        <span>Satır: {items.length}</span>
        <span>Adet: {totals.totalQuantity}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
