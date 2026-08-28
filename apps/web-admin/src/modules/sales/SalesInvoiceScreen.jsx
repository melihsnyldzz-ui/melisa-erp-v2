import React, { useEffect, useMemo, useState } from 'react';
import { SalesInvoiceHeader } from './SalesInvoiceHeader.jsx';
import { SalesInvoiceItemsTable } from './SalesInvoiceItemsTable.jsx';
import { SalesInvoiceToolbar } from './SalesInvoiceToolbar.jsx';
import { SalesInvoiceTotals } from './SalesInvoiceTotals.jsx';
import {
  cancelSalesDraft,
  createSalesDraft,
  fetchSalesInvoice,
  finalizeSalesDraft,
  updateSalesDraft,
} from '../../services/invoiceDraftApi.js';
import { ensureCashCustomerDefinitions, fetchCustomers } from '../../services/customerApi.js';
import { fetchCurrencyRates, rateValueForCurrency } from '../../services/currencyRateApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { exportRowsToExcel, printBusinessDocument } from '../../utils/exportUtils.js';
import { normalizeSearchText, searchTextIncludes } from '../../utils/searchText.js';

const emptySalesInvoice = {
  invoiceNo: 'Taslak',
  date: todayIsoDate(),
  customerId: '',
  customer: '',
  customerCurrency: '-',
  customerBalanceLabel: '-',
  invoiceCurrency: 'TRY',
  exchangeRate: 'TRY 1.0000',
  exchangeRateValue: 1,
  description: '',
  status: 'Taslak',
  terminalCode: '',
  terminalName: '',
  employeeCode: '',
  employeeName: '',
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatExchangeRate(currency, value) {
  return `${currency || 'TRY'} ${Number(value || 1).toFixed(4)}`;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function applyDiscount(amount, discountRate) {
  const rate = Math.min(100, Math.max(0, Number(discountRate || 0)));
  return Number(amount || 0) * (1 - (rate / 100));
}

function calculateTotals(items, discountRate, exchangeRate = 1, currency = 'TRY') {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const totalCost = items.reduce((total, item) => total + item.quantity * item.averageCostTry, 0);
  const lineCount = items.length;
  const totalQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const grossProfit = items.some((item) => item.grossProfitTry !== null && item.grossProfitTry !== undefined)
     ? items.reduce((total, item) => total + Number(item.grossProfitTry || 0), 0)
    : null;
  const grossProfitDocument = grossProfit === null ? null : grossProfit / Number(exchangeRate || 1);
  const discountAmount = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountAmount;
  const tryEquivalent = grandTotal * Number(exchangeRate || 1);
  const estimatedProfit = tryEquivalent - totalCost;

  return {
    currency,
    exchangeRate: Number(exchangeRate || 1),
    subtotal,
    discountRate,
    discountAmount,
    grandTotal,
    tryEquivalent,
    estimatedProfit,
    grossProfit,
    grossProfitDocument,
    lineCount,
    totalQuantity,
  };
}

function resolveUnitCostTry(item, invoiceCurrency, exchangeRate) {
  const productCurrency = String(item.cardCurrency || item.productCurrency || item.currency || 'TRY').toUpperCase();
  const lineCurrency = String(invoiceCurrency || item.currency || 'TRY').toUpperCase();
  const rate = Number(exchangeRate || 1);
  const productRateToTry = Number(item.cardRateToTry || 0);
  const purchasePrice = applyDiscount(item.cardPurchasePrice ?? item.purchasePrice ?? 0, item.purchaseDiscountRate);
  const averageCostTry = Number(item.productAverageCostTry ?? item.averageCostTry ?? 0);

  if (productCurrency !== 'TRY' && purchasePrice > 0) {
    if (productRateToTry > 0) {
      return roundCurrency(purchasePrice * productRateToTry);
    }

    if (productCurrency === lineCurrency && rate > 0) {
      return roundCurrency(purchasePrice * rate);
    }
  }

  if (averageCostTry > 0) {
    return roundCurrency(averageCostTry);
  }

  if (productCurrency === 'TRY' && purchasePrice > 0) {
    return roundCurrency(purchasePrice);
  }

  return 0;
}

function withProfitSnapshot(item, invoiceCurrency, exchangeRate) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const rate = Number(exchangeRate || 1);
  const unitCostTry = resolveUnitCostTry(item, invoiceCurrency, rate);
  const lineTotalTry = quantity * unitPrice * rate;
  const totalCostTry = quantity * unitCostTry;
  const grossProfitTry = lineTotalTry - totalCostTry;

  return {
    ...item,
    averageCostTry: unitCostTry,
    grossProfitTry,
    grossProfitRate: lineTotalTry > 0 ? grossProfitTry / lineTotalTry : 0,
  };
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatProductPrice(product) {
  const currency = product.currency || product.cardCurrency || 'TRY';
  return formatMoney(product.unitPrice || 0, currency);
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${apiConfig.baseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
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
    customerId: draft.customerId,
    customer: draft.customerName || `Müşteri #${draft.customerId}`,
    customerCurrency: draft.customerCurrency,
    customerBalanceLabel: draft.customerBalanceLabel || '-',
    invoiceCurrency: draft.documentCurrency,
    exchangeRate: formatExchangeRate(draft.documentCurrency, draft.exchangeRate),
    exchangeRateValue: Number(draft.exchangeRate || 1),
    description: draft.description || '',
    status: status === 'DRAFT' ? 'Taslak' : status,
    terminalCode: draft.terminalCode || '',
    terminalName: draft.terminalName || '',
    employeeCode: draft.employeeCode || '',
    employeeName: draft.employeeName || '',
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
    unitPrice: Number(item.unitPrice || 0),
    cardCurrency: item.currency,
    cardUnitPrice: Number(item.unitPrice || 0),
    cardPurchasePrice: Number(item.purchasePrice || 0),
    purchaseDiscountRate: Number(item.purchaseDiscountRate || 0),
    cardRateToTry: 0,
    productAverageCostTry: Number(item.averageCostTry || 0),
    stockState: item.stockStatus || '-',
    note: item.note || '-',
    averageCostTry: Number(item.averageCostTry || 0),
    grossProfitTry: item.grossProfitTry === null || item.grossProfitTry === undefined ? null : Number(item.grossProfitTry || 0),
    grossProfitRate: item.grossProfitRate === null || item.grossProfitRate === undefined ? null : Number(item.grossProfitRate || 0),
  }));
}

function mapCustomerOption(customer) {
  return {
    id: customer.id,
    code: customer.customerCode,
    name: customer.customerName,
    currency: customer.currency,
    balance: Number(customer.balance || 0),
  };
}

const cashCustomerShortcuts = [
  { code: 'PESIN-TL', label: 'Peşin TL', currency: 'TRY' },
  { code: 'PESIN-USD', label: 'Peşin USD', currency: 'USD' },
  { code: 'PESIN-EUR', label: 'Peşin EUR', currency: 'EUR' },
];

function mergeCustomerOptions(currentCustomers, nextCustomers) {
  const customersById = new Map(currentCustomers.map((customer) => [String(customer.id), customer]));
  nextCustomers.forEach((customer) => {
    customersById.set(String(customer.id), customer);
  });
  return Array.from(customersById.values());
}

function mapProductOption(product) {
  return {
    productId: product.id,
    stockCode: product.stockCode,
    barcode: product.barcodeMasked || '-',
    matchedBarcode: product.matchedBarcode || product.barcodeMatched || null,
    productName: product.productName,
    imageUrl: resolveImageUrl(product.imageUrl),
    currency: product.currency,
    unitPrice: Number(product.salePrice || 0),
    cardCurrency: product.currency,
    cardUnitPrice: Number(product.salePrice || 0),
    cardPurchasePrice: Number(product.purchasePrice || 0),
    purchaseDiscountRate: Number(product.purchaseDiscountRate || 0),
    cardRateToTry: 0,
    productAverageCostTry: Number(product.averageCostTry || 0),
    purchasePrice: Number(product.purchasePrice || 0),
    averageCostTry: Number(product.averageCostTry || 0),
    stockState: `Stok: ${Number(product.stockQuantity || 0)}`,
    isPassive: product.isPassive,
  };
}

function normalizeSearchValue(value) {
  return normalizeSearchText(value);
}

function productSearchValues(product) {
  return [
    product.stockCode,
    product.barcode,
    product.matchedBarcode,
    product.productName,
    `${product.stockCode} / ${product.productName}`,
  ].map(normalizeSearchValue).filter(Boolean);
}

function resolveProductFromQuery(products, value) {
  const normalizedValue = normalizeSearchValue(value);
  if (!normalizedValue) {
    return null;
  }

  const exactProduct = products.find((product) => (
    !product.isPassive && productSearchValues(product).some((fieldValue) => fieldValue === normalizedValue)
  ));

  if (exactProduct) {
    return exactProduct;
  }

  return products.find((product) => (
    !product.isPassive && productSearchValues(product).some((fieldValue) => fieldValue.includes(normalizedValue))
  )) || null;
}

function productApiSearchValue(value) {
  return String(value || '').split('/')[0].trim();
}

function mergeProductOptions(currentProducts, nextProducts) {
  const productsById = new Map(currentProducts.map((product) => [String(product.productId), product]));
  nextProducts.forEach((product) => {
    productsById.set(String(product.productId), product);
  });
  return Array.from(productsById.values());
}

export function SalesInvoiceScreen({ salesDraftId, permissions = [], onDirtyChange, onOpenScreen }) {
  const [draftId, setDraftId] = useState(salesDraftId ?? null);
  const [invoice, setInvoice] = useState(emptySalesInvoice);
  const [items, setItems] = useState([]);
  const [discountRate, setDiscountRate] = useState(0);
  const [status, setStatus] = useState('DRAFT');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Taslak fiş henüz stok veya cari hareket oluşturmaz.');
  const [draftCustomerOptions, setDraftCustomerOptions] = useState([]);
  const [draftProductOptions, setDraftProductOptions] = useState([]);
  const [productOptionCache, setProductOptionCache] = useState([]);
  const [productToAddId, setProductToAddId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [referenceOptionsError, setReferenceOptionsError] = useState('');
  const [currencyRates, setCurrencyRates] = useState(null);
  const [currencyRateError, setCurrencyRateError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(salesDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, discountRate, invoice.exchangeRateValue, invoice.invoiceCurrency),
    [discountRate, invoice.exchangeRateValue, invoice.invoiceCurrency, items],
  );
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isCancelled || (isFinalized && !isCorrectionMode);
  const canSaveDraft = draftId ? permissions.includes('sales.edit') : permissions.includes('sales.create');
  const canFinalize = permissions.includes('sales.finalize');
  const canCancel = permissions.includes('sales.cancel');
  const productLookupOptions = useMemo(
    () => mergeProductOptions(productOptionCache, draftProductOptions),
    [draftProductOptions, productOptionCache],
  );
  const filteredProducts = useMemo(() => {
    const query = normalizeSearchValue(productQuery);

    const visibleOptions = draftProductOptions.length > 0 ? draftProductOptions : productLookupOptions;

    return visibleOptions.filter((product) => {
      const matchesQuery = !query || productSearchValues(product).some((value) => value.includes(query));

      return matchesQuery && !product.isPassive;
    });
  }, [draftProductOptions, productLookupOptions, productQuery]);
  const filteredCustomers = useMemo(() => {
    return draftCustomerOptions.filter((customer) => (
      [customer.code, customer.name, customer.currency].some((value) => searchTextIncludes(value, customerQuery))
    ));
  }, [customerQuery, draftCustomerOptions]);
  const selectedCustomer = useMemo(
    () => draftCustomerOptions.find((customer) => String(customer.id) === String(invoice.customerId)) || null,
    [draftCustomerOptions, invoice.customerId],
  );
  const selectedQuickProduct = useMemo(
    () => resolveProductToAdd(),
    [productLookupOptions, productQuery, productToAddId],
  );
  const flowSteps = useMemo(() => [
    { key: 'customer', label: 'Cari', done: Boolean(invoice.customerId) },
    { key: 'item', label: 'Ürün', done: items.length > 0 },
    { key: 'draft', label: 'Taslak', done: Boolean(draftId) },
    { key: 'final', label: 'Kesin', done: isFinalized },
  ], [draftId, invoice.customerId, isFinalized, items.length]);

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

    const nextRate = centralRateForCurrency(invoice.invoiceCurrency);
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

    async function loadCustomers() {
      try {
        const [response, cashResponse] = await Promise.all([
          fetchCustomers({ page: 1, limit: 50, activeOnly: true }),
          fetchCustomers({ page: 1, limit: 10, search: 'PESIN', activeOnly: true }),
        ]);
        if (isMounted) {
          setDraftCustomerOptions(mergeCustomerOptions(
            (response.data || []).map(mapCustomerOption),
            (cashResponse.data || []).map(mapCustomerOption),
          ));
        }
      } catch (error) {
        if (isMounted) {
          setReferenceOptionsError(`Cari listesi okunamadi: ${error.message || 'API_ERROR'}`);
        }
      }
    }

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await fetchProducts({
          page: 1,
          limit: 50,
          search: productApiSearchValue(productQuery),
          activeOnly: true,
        });
        const options = (response.data || []).map(mapProductOption);

        if (isMounted) {
          setDraftProductOptions(options);
          setProductOptionCache((current) => mergeProductOptions(current, options));
          setProductToAddId((current) => {
            if (options.some((product) => String(product.productId) === String(current))) {
              return current;
            }
            const queryMatch = resolveProductFromQuery(options, productQuery);
            if (queryMatch) {
              return String(queryMatch.productId);
            }
            if (productQuery.trim()) {
              return current;
            }
            return String(options[0]?.productId ?? '');
          });
        }
      } catch (error) {
        if (isMounted) {
          setReferenceOptionsError(`Ürün listesi okunamadı: ${error.message || 'API_ERROR'}`);
          setDraftProductOptions([]);
          setProductToAddId('');
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [productQuery]);

  useEffect(() => {
    if (!salesDraftId) {
      return undefined;
    }

    let isMounted = true;

    async function loadDraft() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSalesInvoice(salesDraftId);
        const nextInvoice = mapDraftToInvoice(response.data);
        const nextItems = mapDraftItems(response.data.items);

        if (isMounted) {
          setDraftId(response.data.id);
          setInvoice(nextInvoice);
          setItems(nextItems);
          setDiscountRate(Number(response.data.discountRate || 0));
          setStatus(nextInvoice.status);
          setIsCorrectionMode(false);
          setSelectedItemId(nextItems[0]?.id ?? null);
          setIsDirty(false);
          setStatusMessage(`Taslak fiş DB'den açıldı (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Taslak fiş okunamadı.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Taslak okuma başarısız; API/DB kontrol edilmeli.');
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
  }, [salesDraftId]);

  function buildDraftPayload() {
    return {
      documentNo: invoice.invoiceNo,
      documentDate: invoice.date,
      customerId: invoice.customerId,
      customerCurrency: invoice.customerCurrency,
      documentCurrency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRateValue || 1,
      description: invoice.description,
      discountRate,
      estimatedProfitTry: totals.estimatedProfit,
      items: items.map((item, index) => ({
        productId: item.productId || index + 1,
        stockCode: item.stockCode,
        barcode: item.barcode,
        productName: item.productName,
        quantity: item.quantity,
        currency: item.currency,
        unitPrice: item.unitPrice,
        averageCostTry: item.averageCostTry,
        stockStatus: item.stockState,
        note: item.note,
      })),
    };
  }

  function createNewDraft() {
    setDraftId(null);
    setInvoice({ ...emptySalesInvoice, date: todayIsoDate() });
    setItems([]);
    setDiscountRate(0);
    setStatus('Taslak');
    setIsCorrectionMode(false);
    setSelectedItemId(null);
    setCustomerQuery('');
    setProductQuery('');
    setProductToAddId('');
    setQuickQuantity(1);
    setErrorMessage('');
    setIsDirty(false);
    setStatusMessage('Yeni taslak hazirlandi; kaydedilene kadar ticari etki yok.');
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

  function convertItemToInvoiceCurrency(item, targetCurrency) {
    const sourceCurrency = item.cardCurrency || item.currency || 'TRY';
    const sourceUnitPrice = item.cardUnitPrice ?? item.unitPrice;
    const convertedUnitPrice = convertCurrencyAmount(sourceUnitPrice, sourceCurrency, targetCurrency);

    if (convertedUnitPrice === null) {
      return null;
    }

    return {
      ...item,
      currency: String(targetCurrency || 'TRY').toUpperCase(),
      unitPrice: convertedUnitPrice,
      cardCurrency: sourceCurrency,
      cardUnitPrice: sourceUnitPrice,
    };
  }

  function updateInvoiceField(field, value) {
    if (isFinalized && field === 'invoiceCurrency') {
      setStatusMessage('Kesinleşmiş fişte cari ve para birimi değiştirilemez.');
      return;
    }

    if (field === 'invoiceCurrency') {
      const nextCurrency = String(value || 'TRY').toUpperCase();
      const nextRate = centralRateForCurrency(nextCurrency);
      if (nextRate === null) {
        setInvoice((current) => ({
          ...current,
          invoiceCurrency: nextCurrency,
          exchangeRateValue: '',
          exchangeRate: `${nextCurrency} tanımsız`,
        }));
        return;
      }
      const convertedItems = items.map((item) => {
        const convertedItem = convertItemToInvoiceCurrency(item, nextCurrency);
        return convertedItem ? withProfitSnapshot(convertedItem, nextCurrency, nextRate) : null;
      });
      if (convertedItems.some((item) => item === null)) {
        setErrorMessage(`${nextCurrency} icin satır fiyatları çevrilemedi. Döviz Kurlar ekranından kur tanımını kontrol edin.`);
        return;
      }

      setInvoice((current) => ({
        ...current,
        invoiceCurrency: nextCurrency,
        exchangeRateValue: nextRate,
        exchangeRate: formatExchangeRate(nextCurrency, nextRate),
      }));
      setItems(convertedItems);
      markDirty('Fi para birimi de?i?ti; tanıml kur snapshot olarak kaydedilecek.');
      return;
    }

    if (field === 'exchangeRateValue') {
      setStatusMessage('Kur fis uzerinden de?i?mez; Ayarlar > Döviz Kurlar ekranından tanimlanir.');
      return;
    }

    setInvoice((current) => ({
      ...current,
      [field]: value,
    }));
    markDirty('Taslak de?i?ti; stok ve cari hareket olumad.');
  }

  function selectCustomer(customerId) {
    if (isFinalized) {
      setStatusMessage('Kesinleşmiş fişte cari değiştirilemez.');
      return;
    }

    const customer = draftCustomerOptions.find((item) => String(item.id) === String(customerId));

    if (!customer) {
      return;
    }

    const nextRate = centralRateForCurrency(customer.currency);
    const convertedItems = items.map((item) => {
      const convertedItem = convertItemToInvoiceCurrency(item, customer.currency);
      return convertedItem ? withProfitSnapshot(convertedItem, customer.currency, nextRate) : null;
    });
    if (nextRate !== null && convertedItems.some((item) => item === null)) {
      setErrorMessage(`${customer.currency} icin mevcut satır fiyatları çevrilemedi. Döviz Kurlar ekranından kur tanımını kontrol edin.`);
      return;
    }

    setInvoice((current) => ({
      ...current,
      customerId: customer.id,
      customer: customer.name,
      customerCurrency: customer.currency,
      customerBalanceLabel: formatMoney(customer.balance, customer.currency),
      invoiceCurrency: customer.currency,
      exchangeRate: nextRate === null ? `${customer.currency} tanımsz` : formatExchangeRate(customer.currency, nextRate),
      exchangeRateValue: nextRate === null ? '' : nextRate,
    }));
    if (nextRate !== null) {
      setItems(convertedItems);
    }
    setCustomerQuery(customer.name);
    markDirty('Cari se?ildi; fis para birimi icin tanıml kur alindi.');
  }

  async function selectCashCustomer(shortcut) {
    let customer = draftCustomerOptions.find((item) => (
      String(item.code || '').toUpperCase() === shortcut.code
    ));

    if (!customer) {
      try {
        const response = await ensureCashCustomerDefinitions();
        const ensuredCustomers = (response.data || []).map(mapCustomerOption);
        setDraftCustomerOptions((current) => mergeCustomerOptions(current, ensuredCustomers));
        customer = ensuredCustomers.find((item) => String(item.code || '').toUpperCase() === shortcut.code);
      } catch (error) {
        setErrorMessage(`${shortcut.label} carisi hazırlanamadı: ${error.message || 'API_ERROR'}`);
        return;
      }
    }

    if (!customer) {
      setErrorMessage(`${shortcut.label} carisi hazırlanamadı.`);
      return;
    }

    setErrorMessage('');
    selectCustomer(customer.id);
    setStatusMessage(`${shortcut.label} secildi; kesinlesince otomatik tahsilat KASA-${shortcut.currency} hesabina yazilir.`);
  }

  function selectCustomerByQuery(value) {
    setCustomerQuery(value);
    const normalizedValue = normalizeSearchText(value);
    const exactCustomer = draftCustomerOptions.find((customer) => normalizeSearchText(customer.name) === normalizedValue);
    const firstMatch = draftCustomerOptions.find((customer) => normalizeSearchText(customer.name).includes(normalizedValue));
    const customer = exactCustomer || (normalizedValue ? firstMatch : null);

    if (customer) {
      selectCustomer(customer.id);
    }
  }

  function updateProductQuery(value) {
    setProductQuery(value);
    setReferenceOptionsError('');
    const product = resolveProductFromQuery(productLookupOptions, value);
    setProductToAddId(product ? String(product.productId) : '');
  }

  function resolveProductToAdd() {
    const selectedProduct = productLookupOptions.find((item) => String(item.productId) === String(productToAddId));
    return selectedProduct || (productQuery.trim() ? resolveProductFromQuery(productLookupOptions, productQuery) : null);
  }

  function addDraftItem() {
    if (!invoice.customerId) {
      setErrorMessage('Satır eklemek için önce cari seçin.');
      setStatusMessage('Cari seçilmeden ürün satırı eklenemez.');
      return;
    }

    const product = resolveProductToAdd();

    if (!product || isReadonly) {
      setErrorMessage(productQuery ? 'Yazılan barkod/stok kodu ile ürün bulunamadı.' : 'Satır eklemek için önce ürün seçin.');
      setStatusMessage('Ürün seçilmeden satır eklenemez.');
      return;
    }

    setProductToAddId(String(product.productId));

    if (product.isPassive) {
      setErrorMessage('Pasif ürünler satış taslağına eklenemez.');
      return;
    }

    const nextId = Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
    const productRateToTry = centralRateForCurrency(product.currency);
    if (productRateToTry === null) {
      setErrorMessage(`${product.currency} maliyeti TRY'ye çevrilemedi. Döviz Kurlar ekranından kur tanımını kontrol edin.`);
      return;
    }

    const convertedUnitPrice = convertCurrencyAmount(product.unitPrice, product.currency, invoice.invoiceCurrency);
    if (convertedUnitPrice === null) {
      setErrorMessage(`${product.currency} fiyatlı ürün ${invoice.invoiceCurrency} fişine ççevrilemedi. Döviz Kurları ekranından kur tanımını kontrol edin.`);
      return;
    }

    setErrorMessage('');
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => String(item.productId) === String(product.productId));

      if (existingItem) {
        setSelectedItemId(existingItem.id);
        return currentItems.map((item) => (
          item.id === existingItem.id
            ? withProfitSnapshot(
              { ...item, quantity: item.quantity + Math.max(1, Number(quickQuantity || 1)) },
              invoice.invoiceCurrency,
              invoice.exchangeRateValue,
            )
            : item
        ));
      }

      setSelectedItemId(nextId);
      const nextItem = withProfitSnapshot({
          id: nextId,
          productId: product.productId,
          stockCode: product.stockCode,
          barcode: product.barcode,
          productName: product.productName,
          quantity: Math.max(1, Number(quickQuantity || 1)),
          currency: invoice.invoiceCurrency,
          unitPrice: convertedUnitPrice,
          cardCurrency: product.currency,
          cardUnitPrice: product.unitPrice,
          cardPurchasePrice: product.cardPurchasePrice,
          purchaseDiscountRate: product.purchaseDiscountRate,
          cardRateToTry: productRateToTry,
          productAverageCostTry: product.productAverageCostTry,
          purchasePrice: product.purchasePrice,
          stockState: product.stockState,
          note: 'Taslak satır',
          averageCostTry: product.averageCostTry,
          grossProfitTry: null,
          grossProfitRate: null,
        }, invoice.invoiceCurrency, invoice.exchangeRateValue);

      return [...currentItems, nextItem];
    });
    markDirty('Ürün taslak satıra eklendi; gerçek stok düşümü yok.');
  }

  function addDraftItemFromKeyboard(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftItem();
    }
  }

  function adjustDraftItemQuantity(itemId, delta) {
    const item = items.find((currentItem) => currentItem.id === itemId);
    if (!item) {
      return;
    }

    updateDraftItem(itemId, 'quantity', Math.max(1, Number(item.quantity || 1) + delta));
  }

  function openProductCard(productId, stockCode) {
    if (!productId || !onOpenScreen) {
      return;
    }

    onOpenScreen('product-card', { productId, stockCode });
  }

  function updateDraftItem(itemId, field, value) {
    if (value <= 0) {
      setErrorMessage(field === 'quantity' ? 'Miktar 0 veya negatif olamaz.' : 'Fiyat 0 veya negatif olamaz.');
      return;
    }

    setErrorMessage('');
    setItems((currentItems) => currentItems.map((item) => (
      item.id === itemId
         ? withProfitSnapshot({ ...item, [field]: value }, invoice.invoiceCurrency, invoice.exchangeRateValue)
        : item
    )));
    markDirty('Satır güncellendi; taslak kaydedilene kadar ticari etki yok.');
  }

  function deleteDraftItem(itemId) {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      setSelectedItemId(nextItems[0]?.id ?? null);
      return nextItems;
    });
    markDirty('Satır taslaktan silindi; stok hareketi oluşmadı.');
  }

  async function saveDraft() {
    if (isCancelled) {
      setStatusMessage('İptal edilmiş fiş güncellenemez; yeni taslak kullanın.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage(draftId ? 'Bu islem icin sales.edit yetkisi gerekli.' : 'Bu islem icin sales.create yetkisi gerekli.');
      return;
    }

    if (!invoice.customerId) {
      setErrorMessage('Taslak kaydetmek için cari seçin.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Boş satış taslağı kaydedilemez. En az bir ürün satırı ekleyin.');
      return;
    }

    if (items.some((item) => item.quantity <= 0 || item.unitPrice <= 0)) {
      setErrorMessage('Taslak kaydedilemez: miktar ve fiyat 0 veya negatif olamaz.');
      return;
    }

    if (invoice.invoiceCurrency !== 'TRY' && (!Number.isFinite(Number(invoice.exchangeRateValue)) || Number(invoice.exchangeRateValue) <= 0)) {
      setErrorMessage(`${invoice.invoiceCurrency} kuru tanımlı değil. Ayarlar > Döviz Kurları ekranından kur girin.`);
      setStatusMessage('Kur tanımı olmadan dövizli fiş kaydedilemez.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const wasFinalizedCorrection = isFinalized;
      const payload = buildDraftPayload();
      const response = draftId
         ? await updateSalesDraft(draftId, payload)
        : await createSalesDraft(payload);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setDraftId(response.data.id);
      setInvoice(nextInvoice);
      setItems(nextItems);
      setDiscountRate(Number(response.data.discountRate || 0));
      setStatus(nextInvoice.status);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setIsCorrectionMode(false);
      setStatusMessage(wasFinalizedCorrection
        ? `Kesin satış fişi düzeltildi (#${response.data.id}); stok, cari ve hareket kayıtları fark kadar güncellendi.`
        : response.message || `Taslak fiş DB'ye kaydedildi (#${response.data.id}); stok ve cari etkisi oluşmadı.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Taslak kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Taslak kaydı başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  function editFinalizedInvoice() {
    if (!isFinalized || !canSaveDraft) return;
    setErrorMessage('');
    setIsCorrectionMode(true);
    setStatusMessage('Düzeltme açık. Cari ve para birimi korunur; satır, miktar, fiyat, tarih ve açıklama değiştirilebilir.');
  }

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDraft();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  async function finalizeInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda kesinleştirme kapalıdır. Gerçek stok ve cari hareketleri yazılmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Kesinleştirmek için önce taslağı kaydedin.');
      return;
    }

    if (!canFinalize) {
      setErrorMessage('Bu işlem için sales.finalize yetkisi gerekli.');
      return;
    }

    setIsFinalizing(true);
    setErrorMessage('');

    try {
      const response = await finalizeSalesDraft(draftId);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setInvoice(nextInvoice);
      setItems(nextItems);
      setDiscountRate(Number(response.data.discountRate || 0));
      setStatus(nextInvoice.status);
      setIsCorrectionMode(false);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Satış fişi kesinleşti (#${response.data.id}); stok ve cari hareketleri oluştu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Fiş kesinleştirilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Kesinleştirme başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsFinalizing(false);
    }
  }

  async function cancelInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda satış iptal simüle edilir; gerçek stok ve cari hareketleri yazılmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('İptal etmek için kayıtlı satış fişi gerekli.');
      return;
    }

    if (!isFinalized) {
      setErrorMessage('Sadece finalized satış fişleri iptal edilebilir.');
      return;
    }

    if (!canCancel) {
      setErrorMessage('Bu işlem için sales.cancel yetkisi gerekli.');
      return;
    }

    const reason = window.prompt('Satış fişi iptal nedeni zorunludur:');
    if (!reason || !reason.trim()) {
      setErrorMessage('İptal nedeni zorunludur.');
      return;
    }

    setIsCancelling(true);
    setErrorMessage('');

    try {
      const response = await cancelSalesDraft(draftId, reason.trim());
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setInvoice(nextInvoice);
      setItems(nextItems);
      setDiscountRate(Number(response.data.discountRate || 0));
      setStatus(nextInvoice.status);
      setIsCorrectionMode(false);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Satış fişi iptal edildi (#${response.data.id}); stok ve cari ters hareketleri oluştu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Fiş iptal edilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Satış iptal başarısız; API/DB kontrol edilmeli.');
    } finally {
      setIsCancelling(false);
    }
  }

  function printSalesInvoice() {
    printBusinessDocument({
      title: 'Satış Fişi',
      documentNo: invoice.invoiceNo,
      status,
      date: invoice.date,
      partyLabel: 'Müşteri',
      partyName: invoice.customer,
      currency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRate,
      description: invoice.description,
      items,
      totals,
      extraInfo: [
        { label: 'Cari PB', value: invoice.customerCurrency },
        { label: 'Cari Bakiye', value: invoice.customerBalanceLabel },
        { label: 'Satır Sayısı', value: totals.lineCount },
        { label: 'Toplam Adet', value: totals.totalQuantity },
        { label: 'Fiş İskonto', value: `%${discountRate}` },
      ],
    });
  }

  function exportSalesInvoiceRows() {
    exportRowsToExcel({
      filename: `satış-fişi-${invoice.invoiceNo}`,
      title: `Satış Fişi ${invoice.invoiceNo}`,
      rows: items,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Miktar', key: 'quantity' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Birim Fiyat', key: 'unitPrice' },
        { label: 'Satır Toplamı', value: (row) => Number(row.quantity || 0) * Number(row.unitPrice || 0) },
        { label: 'Maliyet TRY', key: 'totalCostTry' },
        { label: 'Brüt Kar TRY', key: 'grossProfitTry' },
        { label: 'Not', key: 'note' },
      ],
    });
  }

  return (
    <main className="work-area sales-invoice-screen">
      <SalesInvoiceToolbar
        status={status}
        isSaving={isSaving}
        isCancelling={isCancelling}
        isFinalizing={isFinalizing}
        isReadonly={isReadonly}
        canSaveDraft={canSaveDraft}
        canFinalize={canFinalize}
        canCancel={canCancel}
        isCorrectionMode={isCorrectionMode}
        onNewDraft={createNewDraft}
        onEditFinalized={editFinalizedInvoice}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
        onCancel={cancelInvoice}
        onExport={exportSalesInvoiceRows}
        onPrint={printSalesInvoice}
      />
      <section className="sales-invoice-layout">
        {isLoading && <div className="list-state">Taslak fiş API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {referenceOptionsError && <div className="list-state list-state-error">{referenceOptionsError}</div>}
        {currencyRateError && <div className="list-state list-state-error">{currencyRateError}</div>}
        {isSaving && <div className="list-state">Taslak fiş API'ye kaydediliyor...</div>}
        {isFinalized && (
          <div className="list-state list-state-success">{isCorrectionMode ? 'Kesin fiş düzeltmeye açık; kaydettiğinizde farklar doğrudan uygulanır.' : 'FINALIZED fiş kesinleşmiş; Düzenle ile kontrollü değişiklik yapabilirsiniz.'}</div>
        )}
        {isCancelled && (
          <div className="list-state list-state-success">CANCELLED fiş kapalı; yeni işlem için yeni taslak kullanın.</div>
        )}
        {!isReadonly && <section className="sales-flow-steps" aria-label="Satış fişi adımları">
          {flowSteps.map((step, index) => (
            <span className={step.done ? 'done' : ''} key={step.key}>
              <b>{index + 1}</b>{step.label}
            </span>
          ))}
        </section>}
        {!isReadonly && <section className="erp-panel sales-draft-controls sales-quick-add-panel">
          <div className="panel-title">
            <strong>Satış Girişi</strong>
            <span>Cari seç, ürünü okut veya ara, adedi gir</span>
          </div>
          <div className="cash-customer-direct">
            <span className="cash-customer-direct-label">Peşin satış</span>
            <div className="cash-customer-shortcuts" aria-label="Peşin cari kısa yolları">
              {cashCustomerShortcuts.map((shortcut) => (
                <button
                  className={invoice.customerCurrency === shortcut.currency && String(selectedCustomer?.code || '').toUpperCase() === shortcut.code ? 'active' : ''}
                  key={shortcut.code}
                  type="button"
                  disabled={isFinalized}
                  onClick={() => selectCashCustomer(shortcut)}
                >
                  <strong>{shortcut.label}</strong><span>{shortcut.currency}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sales-quick-add-grid">
            <label>
              <span>Cari</span>
              <input
                disabled={isReadonly || isFinalized}
                list="sales-customer-suggestions"
                placeholder="Cari adı yaz"
                value={customerQuery || invoice.customer}
                onChange={(event) => selectCustomerByQuery(event.target.value)}
              />
              <datalist id="sales-customer-suggestions">
                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.name} label={`${customer.code || '-'} / ${customer.currency}`} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Ürün / barkod</span>
              <input
                disabled={isReadonly}
                placeholder="Barkod / stok kodu / ürün adı"
                value={productQuery}
                onChange={(event) => updateProductQuery(event.target.value)}
                onKeyDown={addDraftItemFromKeyboard}
              />
              {productQuery.trim() && filteredProducts.length > 0 && (
                <div className="sales-product-suggestion-list">
                  {filteredProducts.slice(0, 8).map((product) => (
                    <button
                      key={product.productId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setProductToAddId(String(product.productId));
                        setProductQuery(`${product.stockCode} / ${product.productName}`);
                      }}
                    >
                      <span className="product-suggestion-main">
                        {product.imageUrl ? (
                          <img alt={product.productName || product.stockCode || 'Urun'} src={product.imageUrl} />
                        ) : (
                          <span className="product-suggestion-image-empty">Yok</span>
                        )}
                        <span className="product-suggestion-title">
                          {product.stockCode} / {product.productName}
                        </span>
                      </span>
                      <span className="product-suggestion-price">{formatProductPrice(product)}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label className="quick-qty-field">
              <span>Adet</span>
              <input
                disabled={isReadonly}
                min="1"
                type="number"
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(Math.max(1, Number(event.target.value || 1)))}
                onKeyDown={addDraftItemFromKeyboard}
              />
            </label>
            <button type="button" disabled={isReadonly} onClick={addDraftItem}>Satır Ekle</button>
          </div>
          <div className="sales-entry-context" aria-live="polite">
            <span className={selectedCustomer ? 'is-ready' : ''}><b>Cari:</b> {selectedCustomer?.name || 'Seçilmedi'}</span>
            <span className={selectedQuickProduct ? 'is-ready' : ''}><b>Ürün:</b> {selectedQuickProduct ? `${selectedQuickProduct.stockCode} / ${selectedQuickProduct.productName}` : 'Seçilmedi'}</span>
            <span><b>Fiş:</b> {invoice.invoiceCurrency || 'TRY'} / Kur {invoice.exchangeRateValue || 1}</span>
          </div>
        </section>}
        <SalesInvoiceHeader
          discountRate={discountRate}
          invoice={invoice}
          isIdentityLocked={isFinalized}
          isReadonly={isReadonly}
          status={status}
          onChange={updateInvoiceField}
          onDiscountChange={(value) => {
            setDiscountRate(value);
            markDirty('Genel iskonto değişti; kaydedilince fiş toplamlarına yansır.');
          }}
        />
        {!isLoading && !errorMessage && items.length === 0 && (
          <section className="sales-empty-state">
            <strong>Satır bekleniyor</strong>
            <span>Önce cari seç, sonra ürün/barkod ara. Enter veya Satır Ekle ile taslağa eklenir.</span>
          </section>
        )}
        <SalesInvoiceItemsTable
          exchangeRate={invoice.exchangeRateValue}
          invoiceCurrency={invoice.invoiceCurrency}
          isReadonly={isReadonly}
          items={items}
          onAdjustQuantity={adjustDraftItemQuantity}
          selectedItemId={selectedItemId}
          onDeleteItem={deleteDraftItem}
          onOpenProduct={openProductCard}
          onSelectItem={setSelectedItemId}
          onUpdateItem={updateDraftItem}
          showProfitColumns={isFinalized || isCancelled}
        />
        <SalesInvoiceTotals totals={totals} />
      </section>
      <section className="screen-summary sales-invoice-summary">
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
