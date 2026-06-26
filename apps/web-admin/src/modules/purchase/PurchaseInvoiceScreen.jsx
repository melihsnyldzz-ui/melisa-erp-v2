import React, { useEffect, useMemo, useState } from 'react';
import { PurchaseInvoiceHeader } from './PurchaseInvoiceHeader.jsx';
import { PurchaseInvoiceItemsTable } from './PurchaseInvoiceItemsTable.jsx';
import { PurchaseInvoiceToolbar } from './PurchaseInvoiceToolbar.jsx';
import { PurchaseInvoiceTotals } from './PurchaseInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  purchaseInvoiceHeader,
  purchaseInvoiceItems,
  supplierGeneralDiscountRate,
} from './purchaseInvoiceMockData.js';
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
import { exportRowsToExcel, printBusinessDocument } from '../../utils/exportUtils.js';
import { normalizeSearchText, searchTextIncludes } from '../../utils/searchText.js';

const emptyPurchaseInvoice = {
  ...purchaseInvoiceHeader,
  invoiceNo: 'Alış Taslağı',
  supplierId: '',
  supplier: '',
  supplierCurrency: '-',
  supplierBalanceLabel: '-',
  supplierDiscountRate: 0,
  invoiceCurrency: 'TRY',
  exchangeRate: 'TRY 1.0000',
  exchangeRateValue: 1,
  description: '',
  status: 'DRAFT',
};

function formatExchangeRate(currency, value) {
  return `${currency || 'TRY'} ${Number(value || 1).toFixed(4)}`;
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${apiConfig.baseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function calculateTotals(items, invoiceRate, supplierRate, exchangeRate = 1, currency = 'TRY') {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.purchasePrice, 0);
  const lineDiscountTotal = items.reduce((total, item) => {
    const gross = item.quantity * item.purchasePrice;
    return total + gross * (item.lineDiscountRate / 100);
  }, 0);
  const afterLineDiscounts = subtotal - lineDiscountTotal;
  const invoiceDiscountAmount = afterLineDiscounts * (invoiceRate / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountAmount;
  const supplierDiscountAmount = afterInvoiceDiscount * (supplierRate / 100);
  const grandTotal = afterInvoiceDiscount - supplierDiscountAmount;
  const totalDiscount = lineDiscountTotal + invoiceDiscountAmount + supplierDiscountAmount;
  const lineCount = items.length;
  const totalQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const tryEquivalent = grandTotal * Number(exchangeRate || 1);

  return {
    currency,
    exchangeRate: Number(exchangeRate || 1),
    subtotal,
    lineDiscountTotal,
    invoiceDiscountRate: invoiceRate,
    supplierDiscountRate: supplierRate,
    totalDiscount,
    grandTotal,
    tryEquivalent,
    stockCostEffect: tryEquivalent,
    lineCount,
    totalQuantity,
  };
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
    return purchaseInvoiceHeader.date;
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
    supplierDiscountRate: Number(draft.supplierDiscountRate || 0),
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

export function PurchaseInvoiceScreen({ purchaseDraftId, permissions = [], onDirtyChange }) {
  const [draftId, setDraftId] = useState(purchaseDraftId ?? null);
  const [invoice, setInvoice] = useState(purchaseDraftId ? purchaseInvoiceHeader : emptyPurchaseInvoice);
  const [items, setItems] = useState(purchaseDraftId ? purchaseInvoiceItems : []);
  const [invoiceRate, setInvoiceRate] = useState(purchaseDraftId ? invoiceDiscountRate : 0);
  const [supplierRate, setSupplierRate] = useState(purchaseDraftId ? supplierGeneralDiscountRate : 0);
  const [status, setStatus] = useState('DRAFT');
  const [selectedItemId, setSelectedItemId] = useState(purchaseDraftId ? purchaseInvoiceItems[0].id : null);
  const [statusMessage, setStatusMessage] = useState('Taslak alış fişi stok artırmaz ve cari hareket oluşturmaz.');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [purchaseProductOptions, setPurchaseProductOptions] = useState([]);
  const [productToAddId, setProductToAddId] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [currencyRateError, setCurrencyRateError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(purchaseDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, invoiceRate, supplierRate, invoice.exchangeRateValue, invoice.invoiceCurrency),
    [invoice.exchangeRateValue, invoice.invoiceCurrency, invoiceRate, items, supplierRate],
  );
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isFinalized || isCancelled;
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
      ].some((value) => searchTextIncludes(value, productQuery));

      const matchesSupplier = invoice.supplierId
        && String(product.supplierId || '') === String(invoice.supplierId);

      return matchesSupplier && matchesQuery && !product.isPassive;
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
    if (draftId || invoice.invoiceCurrency === 'TRY') {
      return;
    }

    const nextRate = rateValueForCurrency(currencyRates, invoice.invoiceCurrency);
    if (nextRate === null) {
      return;
    }

    setInvoice((current) => ({
      ...current,
      exchangeRateValue: nextRate,
      exchangeRate: formatExchangeRate(current.invoiceCurrency, nextRate),
    }));
  }, [currencyRates, draftId, invoice.invoiceCurrency]);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      setIsLookupLoading(true);

      try {
        const [supplierResponse, productResponse] = await Promise.all([
          fetchSuppliers({
            page: 1,
            limit: 100,
            search: supplierQuery,
            activeOnly: true,
          }),
          invoice.supplierId
            ? fetchProducts({
              page: 1,
              limit: 100,
              search: productQuery,
              barcode: productQuery,
              supplierId: invoice.supplierId,
              activeOnly: true,
            })
            : Promise.resolve({ data: [] }),
        ]);

        if (!isMounted) {
          return;
        }

        const nextSuppliers = supplierResponse.data || [];
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

        setSupplierOptions(nextSuppliers);
        setPurchaseProductOptions(nextProducts);
        setProductToAddId((currentId) => {
          if (currentId && nextProducts.some((product) => String(product.productId) === String(currentId))) {
            return currentId;
          }

          return String(nextProducts.find((product) => !product.isPassive)?.productId ?? '');
        });
        setErrorMessage('');
      } catch (error) {
        if (isMounted) {
          setSupplierOptions([]);
          setPurchaseProductOptions([]);
          setProductToAddId('');
          setErrorMessage(`${error.message || 'Al lookup verisi okunamad.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Tedarikçi/ürün lookup API hatası; gerçek modda mock fallback yapılmadı.');
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
  }, [invoice.supplierId, productQuery, supplierQuery]);

  useEffect(() => {
    if (!purchaseDraftId) {
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
          setDraftId(response.data.id);
          setInvoice(nextInvoice);
          setItems(nextItems);
          setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
          setSupplierRate(Number(response.data.supplierDiscountRate || 0));
          setStatus(nextInvoice.status);
          setSelectedItemId(nextItems[0]?.id ?? null);
          setIsDirty(false);
          setStatusMessage(`Al tasla DB'den ald (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Al tasla okunamad.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Al taslak okuma baarsz; API/DB kontrol edilmeli.');
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
    setDraftId(null);
    setInvoice(emptyPurchaseInvoice);
    setItems([]);
    setInvoiceRate(0);
    setSupplierRate(0);
    setStatus('DRAFT');
    setSelectedItemId(null);
    setSupplierQuery('');
    setProductQuery('');
    setErrorMessage('');
    setIsDirty(false);
    setStatusMessage('Yeni alış taslagi hazirlandi; kaydedilene kadar ticari etki yok.');
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

    const nextRate = rateValueForCurrency(currencyRates, nextCurrency);
    if (nextRate === null) {
      setCurrencyRateError(`${nextCurrency} kuru bu fis tarihi icin tanıml değil. Ayarlar > Döviz Kurlar ekranından kur girin.`);
      return null;
    }

    setCurrencyRateError('');
    return nextRate;
  }

  function convertCurrencyAmount(amount, sourceCurrency, targetCurrency) {
    const source = String(sourceCurrency || 'TRY').toUpperCase();
    const target = String(targetCurrency || 'TRY').toUpperCase();
    const sourceRate = centralRateForCurrency(source);
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
    markDirty('Al tasla de?i?ti; stok ve tedariki cari hareketi olumad.');
  }

  function updateInvoiceCurrency(currency) {
    const nextCurrency = String(currency || 'TRY').toUpperCase();
    const nextRate = centralRateForCurrency(nextCurrency);
    if (nextRate === null) {
      setInvoice((current) => ({
        ...current,
        invoiceCurrency: nextCurrency,
        exchangeRate: `${nextCurrency} tanımsız`,
        exchangeRateValue: '',
      }));
      markDirty('Fi para birimi de?i?ti ancak kur tanıml değil; kayt için kur girilmeli.');
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

    if (convertedItems.some((item) => item === null)) {
      setErrorMessage(`${nextCurrency} için al satırlar çevrilemedi. Döviz Kurlar ekranından kur tanımını kontrol edin.`);
      return;
    }

    setInvoice((current) => ({
      ...current,
      invoiceCurrency: nextCurrency,
      exchangeRate: formatExchangeRate(nextCurrency, nextRate),
      exchangeRateValue: nextRate,
    }));
    setItems(convertedItems);
    markDirty('Fi para birimi de?i?ti; kur snapshot merkezi kurdan alnd.');
  }

  function updateInvoiceRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Fi geneli iskonto oran 0-100 arasnda olmal.');
      return;
    }

    setErrorMessage('');
    setInvoiceRate(value);
    markDirty('Fi geneli iskonto de?i?ti; taslak henz ticari etki oluturmaz.');
  }

  function updateSupplierRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Tedariki iskonto oran 0-100 arasnda olmal.');
      return;
    }

    setErrorMessage('');
    setSupplierRate(value);
    setInvoice((current) => ({ ...current, supplierDiscountRate: value }));
    markDirty('Tedarikçi iskonto değişti; taslak henüz ticari etki oluşturmaz.');
  }

  function selectSupplier(supplierId) {
    const supplier = supplierOptions.find((item) => String(item.id) === String(supplierId));

    if (!supplier) {
      return;
    }

    setErrorMessage('');
    const nextSupplierRate = Number(supplier.purchaseDiscountRate || 0);
    const nextRate = centralRateForCurrency(supplier.currency);
    setSupplierRate(nextSupplierRate);
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
      exchangeRate: nextRate === null ? `${supplier.currency} tanımsz` : formatExchangeRate(supplier.currency, nextRate),
      exchangeRateValue: nextRate === null ? '' : nextRate,
    }));
    markDirty(nextSupplierRate > 0
       ? `Tedariki se?ildi; al iskontosu %${nextSupplierRate} nerildi.`
      : 'Tedariki se?ildi; al tasla henz stok veya cari hareket oluturmaz.');
  }

  function addDraftItem() {
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
      setErrorMessage('Seçilen ürün bulunamadı veya fiş readonly.');
      return;
    }

    if (product.isPassive) {
      setErrorMessage('Pasif ürünler alış taslağına eklenemez.');
      return;
    }

    if (String(product.supplierId || '') !== String(invoice.supplierId)) {
      setErrorMessage('SeÃ§ilen Ã¼rÃ¼n bu tedarikÃ§iye baÄŸlÄ± deÄŸil. Ã–nce doÄŸru tedarikÃ§iyi seÃ§in.');
      setStatusMessage('AlÄ±ÅŸ fiÅŸinde yalnÄ±zca seÃ§ili tedarikÃ§iye baÄŸlÄ± Ã¼rÃ¼nler eklenebilir.');
      return;
    }

    if (invoice.invoiceCurrency !== 'TRY' && (!Number.isFinite(Number(invoice.exchangeRateValue)) || Number(invoice.exchangeRateValue) <= 0)) {
      setErrorMessage(`${invoice.invoiceCurrency} kuru tanıml değil. Ayarlar > Döviz Kurlar ekranından kur girin.`);
      setStatusMessage('Kur tanım olmadan dvizli al satır eklenemez.');
      return;
    }

    const convertedPurchasePrice = convertCurrencyAmount(product.purchasePrice, product.currency, invoice.invoiceCurrency);
    if (convertedPurchasePrice === null) {
      setErrorMessage(`${product.currency} fiyatlı ürün ${invoice.invoiceCurrency} alış fişine ççevrilemedi. Döviz Kurları ekranından kur tanımını kontrol edin.`);
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
          note: 'Al taslak satır',
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

  function updateDraftItem(itemId, field, value) {
    if ((field === 'quantity' || field === 'purchasePrice') && value <= 0) {
      setErrorMessage(field === 'quantity' ? 'Miktar 0 veya negatif olamaz.' : 'Al fiyat 0 veya negatif olamaz.');
      return;
    }

    if (field === 'lineDiscountRate' && (value < 0 || value > 100)) {
      setErrorMessage('Satr iskonto oran 0-100 arasnda olmal.');
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
    if (isReadonly) {
      setStatusMessage('Kesinleşmiş alış fişi güncellenemez; iptal/düzeltme akışı ayrı sprintte ele alınacak.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage(draftId ? 'Bu islem icin purchase.edit yetkisi gerekli.' : 'Bu islem icin purchase.create yetkisi gerekli.');
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
      const payload = buildDraftPayload();
      const response = draftId
         ? await updatePurchaseDraft(draftId, payload)
        : await createPurchaseDraft(payload);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setDraftId(response.data.id);
      setInvoice(nextInvoice);
      setItems(nextItems);
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(response.message || `Alış taslağı DB'ye kaydedildi (#${response.data.id}); stok, cari ve average cost etkisi oluşmadı.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alış taslağı kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alış taslak kaydı başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
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

    setIsFinalizing(true);
    setErrorMessage('');

    try {
      const response = await finalizePurchaseDraft(draftId);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setInvoice(nextInvoice);
      setItems(nextItems);
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
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
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus(nextInvoice.status);
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
    printBusinessDocument({
      title: 'Alış Fişi',
      documentNo: invoice.invoiceNo,
      status,
      date: invoice.date,
      partyLabel: 'Tedarikçi',
      partyName: invoice.supplier,
      currency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRate,
      description: invoice.description,
      items,
      totals,
      extraInfo: [
        { label: 'Tedarikçi PB', value: invoice.supplierCurrency },
        { label: 'Tedarikçi Bakiye', value: invoice.supplierBalanceLabel },
        { label: 'Satır Sayısı', value: totals.lineCount },
        { label: 'Toplam Adet', value: totals.totalQuantity },
        { label: 'Fiş İskonto', value: `%${invoiceRate}` },
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
        canSaveDraft={canSaveDraft}
        canFinalize={canFinalize}
        canCancel={canCancel}
        onNewDraft={createNewDraft}
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
        {isSaving && <div className="list-state">Alış taslağı API'ye kaydediliyor...</div>}
        {isReadonly && (
          <div className="list-state list-state-success">{status} alış fişi kesinleşmiş; değişiklik için iptal veya yeni taslak kullanın.</div>
        )}
        <section className="erp-panel purchase-draft-controls">
          <div className="panel-title">
            <strong>Hızlı Alış Satırı</strong>
            <span>Tedarikçi seç, barkod/stok kodu yaz, satır ekle</span>
          </div>
          <div className="purchase-draft-control-grid">
            <label>
              <span>Tedarikçi ara</span>
              <input
                disabled={isReadonly}
                placeholder="Ad / telefon / şehir / ülke"
                value={supplierQuery}
                onChange={(event) => setSupplierQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Tedarikçi seç</span>
              <select value={invoice.supplierId || ''} disabled={isReadonly} onChange={(event) => selectSupplier(event.target.value)} onKeyDown={addDraftItemFromKeyboard}>
                <option value="">Tedarikçi seçin</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierCode} / {supplier.supplierName} / İsk %{Number(supplier.purchaseDiscountRate || 0)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Ürün ara</span>
              <input
                disabled={isReadonly}
                placeholder="Barkod / stok kodu / ürün adı"
                value={productQuery}
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  const query = normalizeSearchText(event.target.value);
                  const match = filteredProducts.find((product) => (
                    !product.isPassive &&
                    [product.stockCode, product.barcode, product.matchedBarcode, product.productName].some((value) => (
                      normalizeSearchText(value).includes(query)
                    ))
                  ));
                  setProductToAddId(query && match ? String(match.productId) : '');
                }}
                onKeyDown={addDraftItemFromKeyboard}
              />
            </label>
            <label>
              <span>Ürün seç</span>
              <select value={productToAddId} disabled={isReadonly} onChange={(event) => setProductToAddId(event.target.value)} onKeyDown={addDraftItemFromKeyboard}>
                <option value="">Ürün seçin</option>
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.stockCode} / {product.productName} / Satır isk %{Number(product.lineDiscountRate || 0)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={isReadonly} onClick={addDraftItem}>Satır Ekle</button>
          </div>
          <div className="quick-decision-strip purchase-decision-strip">
            <div className={`quick-decision-card ${selectedSupplier ? 'is-ready' : ''}`}>
              <span>Tedarikçi</span>
              <strong>{selectedSupplier ? selectedSupplier.supplierName : 'Tedarikçi seçilmedi'}</strong>
              <small>
                {selectedSupplier
                  ? `${selectedSupplier.supplierCode || '-'} / ${selectedSupplier.currency} / ${formatMoney(selectedSupplier.balance, selectedSupplier.currency)}`
                  : 'Alış satırı için önce tedarikçi seçin'}
              </small>
            </div>
            <div className={`quick-decision-card ${selectedPurchaseProduct ? 'is-ready' : ''}`}>
              {selectedPurchaseProduct?.imageUrl ? (
                <img className="quick-decision-image" alt={selectedPurchaseProduct.productName || selectedPurchaseProduct.stockCode || 'Urun'} src={selectedPurchaseProduct.imageUrl} />
              ) : null}
              <span>Ürün</span>
              <strong>{selectedPurchaseProduct ? selectedPurchaseProduct.productName : 'Ürün seçilmedi'}</strong>
              <small>
                {selectedPurchaseProduct
                  ? `${selectedPurchaseProduct.stockCode} / ${formatMoney(selectedPurchaseProduct.purchasePrice, selectedPurchaseProduct.currency)} / isk %${Number(selectedPurchaseProduct.lineDiscountRate || 0)}`
                  : 'Barkod, stok kodu veya ürün adı yazın'}
              </small>
            </div>
            <div className="quick-decision-card quick-decision-price">
              <span>Alış</span>
              <strong>İsk %{Number(supplierRate || 0)} / {invoice.invoiceCurrency || 'TRY'}</strong>
              <small>Enter veya Satır Ekle ile taslağa alınır.</small>
            </div>
          </div>
          {selectedSupplier && (
            <div className="purchase-supplier-snapshot">
              <span><b>Tedarikçi</b>{selectedSupplier.supplierCode} / {selectedSupplier.supplierName}</span>
              <span><b>Para birimi</b>{selectedSupplier.currency}</span>
              <span><b>Bakiye</b>{formatMoney(selectedSupplier.balance, selectedSupplier.currency)}</span>
              <span><b>Alış iskontosu</b>%{Number(selectedSupplier.purchaseDiscountRate || 0)}</span>
              <span><b>Fiş kuru</b>{invoice.exchangeRate}</span>
            </div>
          )}
        </section>
        <PurchaseInvoiceHeader
          invoice={invoice}
          invoiceRate={invoiceRate}
          isReadonly={isReadonly}
          status={status}
          supplierRate={supplierRate}
          onChange={updateInvoiceField}
          onCurrencyChange={updateInvoiceCurrency}
          onInvoiceRateChange={updateInvoiceRate}
          onSupplierRateChange={updateSupplierRate}
        />
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state purchase-empty-state">Alış taslak satırı yok. Üstten tedarikçi ve ürün seçip Satır Ekle ile başlayın.</div>
        )}
        <PurchaseInvoiceItemsTable
          exchangeRate={invoice.exchangeRateValue}
          invoiceCurrency={invoice.invoiceCurrency}
          invoiceRate={invoiceRate}
          isReadonly={isReadonly}
          items={items}
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
