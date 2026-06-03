import React, { useEffect, useMemo, useState } from 'react';
import { SalesInvoiceHeader } from './SalesInvoiceHeader.jsx';
import { SalesInvoiceItemsTable } from './SalesInvoiceItemsTable.jsx';
import { SalesInvoiceToolbar } from './SalesInvoiceToolbar.jsx';
import { SalesInvoiceTotals } from './SalesInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  salesInvoiceHeader,
  salesInvoiceItems,
} from './salesInvoiceMockData.js';
import {
  cancelSalesDraft,
  createSalesDraft,
  fetchSalesInvoice,
  finalizeSalesDraft,
  updateSalesDraft,
} from '../../services/invoiceDraftApi.js';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchCurrencyRates, rateValueForCurrency } from '../../services/currencyRateApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { exportRowsToExcel, printBusinessDocument } from '../../utils/exportUtils.js';

const emptySalesInvoice = {
  ...salesInvoiceHeader,
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
  const currency = product?.currency || product?.cardCurrency || 'TRY';
  return formatMoney(product?.unitPrice || 0, currency);
}

function formatDate(value) {
  if (!value) {
    return salesInvoiceHeader.date;
  }

  return String(value).slice(0, 10);
}

function mapDraftToInvoice(draft) {
  const status = String(draft.status || '').toUpperCase();

  return {
    invoiceNo: draft.documentNo,
    date: formatDate(draft.documentDate),
    customerId: draft.customerId,
    customer: draft.customerName || `Musteri #${draft.customerId}`,
    customerCurrency: draft.customerCurrency,
    customerBalanceLabel: draft.customerBalanceLabel || '-',
    invoiceCurrency: draft.documentCurrency,
    exchangeRate: formatExchangeRate(draft.documentCurrency, draft.exchangeRate),
    exchangeRateValue: Number(draft.exchangeRate || 1),
    description: draft.description || '',
    status: status === 'DRAFT' ? 'Taslak' : status,
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
    name: customer.customerName,
    currency: customer.currency,
    balance: Number(customer.balance || 0),
  };
}

function mapProductOption(product) {
  return {
    productId: product.id,
    stockCode: product.stockCode,
    barcode: product.barcodeMasked || '-',
    matchedBarcode: product.matchedBarcode || product.barcodeMatched || null,
    productName: product.productName,
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
  return String(value || '').trim().toLowerCase();
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
  const [invoice, setInvoice] = useState(salesDraftId ? salesInvoiceHeader : emptySalesInvoice);
  const [items, setItems] = useState(salesDraftId ? salesInvoiceItems : []);
  const [discountRate, setDiscountRate] = useState(salesDraftId ? invoiceDiscountRate : 0);
  const [status, setStatus] = useState(salesInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(salesDraftId ? salesInvoiceItems[0]?.id : null);
  const [statusMessage, setStatusMessage] = useState('Taslak fis henuz stok veya cari hareket olusturmaz.');
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
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, discountRate, invoice.exchangeRateValue, invoice.invoiceCurrency),
    [discountRate, invoice.exchangeRateValue, invoice.invoiceCurrency, items],
  );
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isFinalized || isCancelled;
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
    const query = customerQuery.trim().toLowerCase();

    return draftCustomerOptions.filter((customer) => (
      !query || [customer.name, customer.currency].some((value) => String(value || '').toLowerCase().includes(query))
    ));
  }, [customerQuery, draftCustomerOptions]);
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
          setCurrencyRateError(`Kur bilgisi okunamadi: ${error.message || 'API_ERROR'}`);
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
        const response = await fetchCustomers({ page: 1, limit: 50, activeOnly: true });
        if (isMounted) {
          setDraftCustomerOptions((response.data || []).map(mapCustomerOption));
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
          setReferenceOptionsError(`Urun listesi okunamadi: ${error.message || 'API_ERROR'}`);
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
          setSelectedItemId(nextItems[0]?.id ?? null);
          setIsDirty(false);
          setStatusMessage(`Taslak fis DB'den acildi (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Taslak fis okunamadi.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Taslak okuma basarisiz; API/DB kontrol edilmeli.');
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
    setSelectedItemId(null);
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
      setCurrencyRateError(`${nextCurrency} kuru bu fis tarihi icin tanimli degil. Ayarlar > Doviz Kurlari ekranindan kur girin.`);
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
    if (field === 'invoiceCurrency') {
      const nextCurrency = String(value || 'TRY').toUpperCase();
      const nextRate = centralRateForCurrency(nextCurrency);
      if (nextRate === null) {
        setInvoice((current) => ({
          ...current,
          invoiceCurrency: nextCurrency,
          exchangeRateValue: '',
          exchangeRate: `${nextCurrency} tanimsiz`,
        }));
        return;
      }
      const convertedItems = items.map((item) => {
        const convertedItem = convertItemToInvoiceCurrency(item, nextCurrency);
        return convertedItem ? withProfitSnapshot(convertedItem, nextCurrency, nextRate) : null;
      });
      if (convertedItems.some((item) => item === null)) {
        setErrorMessage(`${nextCurrency} icin satir fiyatlari cevrilemedi. Doviz Kurlari ekranindan kur tanimini kontrol edin.`);
        return;
      }

      setInvoice((current) => ({
        ...current,
        invoiceCurrency: nextCurrency,
        exchangeRateValue: nextRate,
        exchangeRate: formatExchangeRate(nextCurrency, nextRate),
      }));
      setItems(convertedItems);
      markDirty('Fis para birimi degisti; tanimli kur snapshot olarak kaydedilecek.');
      return;
    }

    if (field === 'exchangeRateValue') {
      setStatusMessage('Kur fis uzerinden degismez; Ayarlar > Doviz Kurlari ekranindan tanimlanir.');
      return;
    }

    setInvoice((current) => ({
      ...current,
      [field]: value,
    }));
    markDirty('Taslak degisti; stok ve cari hareket olusmadi.');
  }

  function selectCustomer(customerId) {
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
      setErrorMessage(`${customer.currency} icin mevcut satir fiyatlari cevrilemedi. Doviz Kurlari ekranindan kur tanimini kontrol edin.`);
      return;
    }

    setInvoice((current) => ({
      ...current,
      customerId: customer.id,
      customer: customer.name,
      customerCurrency: customer.currency,
      customerBalanceLabel: formatMoney(customer.balance, customer.currency),
      invoiceCurrency: customer.currency,
      exchangeRate: nextRate === null ? `${customer.currency} tanimsiz` : formatExchangeRate(customer.currency, nextRate),
      exchangeRateValue: nextRate === null ? '' : nextRate,
    }));
    if (nextRate !== null) {
      setItems(convertedItems);
    }
    setCustomerQuery(customer.name);
    markDirty('Cari secildi; fis para birimi icin tanimli kur alindi.');
  }

  function selectCustomerByQuery(value) {
    setCustomerQuery(value);
    const normalizedValue = value.trim().toLowerCase();
    const exactCustomer = draftCustomerOptions.find((customer) => customer.name.toLowerCase() === normalizedValue);
    const firstMatch = draftCustomerOptions.find((customer) => customer.name.toLowerCase().includes(normalizedValue));
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
    return selectedProduct || resolveProductFromQuery(productLookupOptions, productQuery);
  }

  function addDraftItem() {
    if (!invoice.customerId) {
      setErrorMessage('Satir eklemek icin once cari secin.');
      setStatusMessage('Cari secilmeden urun satiri eklenemez.');
      return;
    }

    const product = resolveProductToAdd();

    if (!product || isReadonly) {
      setErrorMessage(productQuery ? 'Yazilan barkod/stok kodu ile urun bulunamadi.' : 'Satir eklemek icin once urun secin.');
      setStatusMessage('Urun secilmeden satir eklenemez.');
      return;
    }

    setProductToAddId(String(product.productId));

    if (product.isPassive) {
      setErrorMessage('Pasif urunler satis taslagina eklenemez.');
      return;
    }

    const nextId = Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
    const productRateToTry = centralRateForCurrency(product.currency);
    if (productRateToTry === null) {
      setErrorMessage(`${product.currency} maliyeti TRY'ye cevrilemedi. Doviz Kurlari ekranindan kur tanimini kontrol edin.`);
      return;
    }

    const convertedUnitPrice = convertCurrencyAmount(product.unitPrice, product.currency, invoice.invoiceCurrency);
    if (convertedUnitPrice === null) {
      setErrorMessage(`${product.currency} fiyatli urun ${invoice.invoiceCurrency} fisine cevrilemedi. Doviz Kurlari ekranindan kur tanimini kontrol edin.`);
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
          note: 'Taslak satir',
          averageCostTry: product.averageCostTry,
          grossProfitTry: null,
          grossProfitRate: null,
        }, invoice.invoiceCurrency, invoice.exchangeRateValue);

      return [...currentItems, nextItem];
    });
    markDirty('Urun taslak satira eklendi; gercek stok dusumu yok.');
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
    markDirty('Satir guncellendi; taslak kaydedilene kadar ticari etki yok.');
  }

  function deleteDraftItem(itemId) {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      setSelectedItemId(nextItems[0]?.id ?? null);
      return nextItems;
    });
    markDirty('Satir taslaktan silindi; stok hareketi olusmadi.');
  }

  async function saveDraft() {
    if (isCancelled) {
      setStatusMessage('Iptal edilmis fis guncellenemez; yeni taslak kullanin.');
      return;
    }

    if (isFinalized) {
      setStatusMessage('Kesinlesmis satis fisi dogrudan degistirilemez; iptal edip yeni fis girin.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage(draftId ? 'Bu islem icin sales.edit yetkisi gerekli.' : 'Bu islem icin sales.create yetkisi gerekli.');
      return;
    }

    if (!invoice.customerId) {
      setErrorMessage('Taslak kaydetmek icin cari secin.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Bos satis taslagi kaydedilemez. En az bir urun satiri ekleyin.');
      return;
    }

    if (items.some((item) => item.quantity <= 0 || item.unitPrice <= 0)) {
      setErrorMessage('Taslak kaydedilemez: miktar ve fiyat 0 veya negatif olamaz.');
      return;
    }

    if (invoice.invoiceCurrency !== 'TRY' && (!Number.isFinite(Number(invoice.exchangeRateValue)) || Number(invoice.exchangeRateValue) <= 0)) {
      setErrorMessage(`${invoice.invoiceCurrency} kuru tanimli degil. Ayarlar > Doviz Kurlari ekranindan kur girin.`);
      setStatusMessage('Kur tanimi olmadan dovizli fis kaydedilemez.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
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
      setStatusMessage(response.message || `Taslak fis DB'ye kaydedildi (#${response.data.id}); stok ve cari etkisi olusmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Taslak kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Taslak kaydi basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
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
      setStatusMessage('Demo modda kesinlestirme kapalidir. Gercek stok ve cari hareketleri yazilmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Kesinlestirmek icin once taslagi kaydedin.');
      return;
    }

    if (!canFinalize) {
      setErrorMessage('Bu islem icin sales.finalize yetkisi gerekli.');
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
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Satis fisi kesinlesti (#${response.data.id}); stok ve cari hareketleri olustu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Fis kesinlestirilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Kesinlestirme basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsFinalizing(false);
    }
  }

  async function cancelInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda satis iptal simule edilir; gercek stok ve cari hareketleri yazilmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Iptal etmek icin kayitli satis fisi gerekli.');
      return;
    }

    if (!isFinalized) {
      setErrorMessage('Sadece finalized satis fisleri iptal edilebilir.');
      return;
    }

    if (!canCancel) {
      setErrorMessage('Bu islem icin sales.cancel yetkisi gerekli.');
      return;
    }

    const reason = window.prompt('Satis fisi iptal nedeni zorunludur:');
    if (!reason || !reason.trim()) {
      setErrorMessage('Iptal nedeni zorunludur.');
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
      setSelectedItemId(nextItems[0]?.id ?? null);
      setIsDirty(false);
      setStatusMessage(`Satis fisi iptal edildi (#${response.data.id}); stok ve cari ters hareketleri olustu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Fis iptal edilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Satis iptal basarisiz; API/DB kontrol edilmeli.');
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
      filename: `satis-fisi-${invoice.invoiceNo}`,
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
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
        onCancel={cancelInvoice}
        onExport={exportSalesInvoiceRows}
        onPrint={printSalesInvoice}
      />
      <section className="sales-invoice-layout">
        {isLoading && <div className="list-state">Taslak fis API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {referenceOptionsError && <div className="list-state list-state-error">{referenceOptionsError}</div>}
        {currencyRateError && <div className="list-state list-state-error">{currencyRateError}</div>}
        {isSaving && <div className="list-state">Taslak fis API'ye kaydediliyor...</div>}
        {isFinalized && (
          <div className="list-state list-state-success">FINALIZED fis kapali; stok ve cari izi olustu. Degisiklik icin iptal edip yeni fis girin.</div>
        )}
        {isCancelled && (
          <div className="list-state list-state-success">CANCELLED fis kapali; yeni islem icin yeni taslak kullanin.</div>
        )}
        <section className="sales-flow-steps" aria-label="Satış fişi adımları">
          {flowSteps.map((step, index) => (
            <span className={step.done ? 'done' : ''} key={step.key}>
              <b>{index + 1}</b>{step.label}
            </span>
          ))}
        </section>
        <section className="erp-panel sales-draft-controls sales-quick-add-panel">
          <div className="panel-title">
            <strong>Hızlı Satır</strong>
            <span>Cari seç, barkod/ürün yaz, Enter ile satır ekle</span>
          </div>
          <div className="sales-quick-add-grid">
            <label>
              <span>Cari</span>
              <input
                disabled={isReadonly}
                list="sales-customer-suggestions"
                placeholder="Cari adı yaz"
                value={customerQuery || invoice.customer}
                onChange={(event) => selectCustomerByQuery(event.target.value)}
              />
              <datalist id="sales-customer-suggestions">
                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.name} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Ürün / barkod</span>
              <input
                disabled={isReadonly}
                placeholder="Barkod / stok kodu / urun adi"
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
                      <span className="product-suggestion-title">
                        {product.stockCode} / {product.productName}
                      </span>
                      <span className="product-suggestion-price">{formatProductPrice(product)}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label>
              <span>Seçim</span>
              <select value={productToAddId} disabled={isReadonly} onChange={(event) => setProductToAddId(event.target.value)}>
                <option value="">Urun secin</option>
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.stockCode} / {product.productName} / {formatProductPrice(product)}
                  </option>
                ))}
              </select>
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
            <button type="button" disabled={isReadonly} onClick={addDraftItem}>Satir Ekle</button>
          </div>
        </section>
        <SalesInvoiceHeader
          discountRate={discountRate}
          invoice={invoice}
          isReadonly={isReadonly}
          status={status}
          onChange={updateInvoiceField}
          onDiscountChange={(value) => {
            setDiscountRate(value);
            markDirty('Genel iskonto degisti; kaydedilince fis toplamlarina yansir.');
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
        <span>Fis: {invoice.invoiceNo}</span>
        <span>Draft ID: {draftId ?? 'yok'}</span>
        <span>{draftId ? 'Kaydedilmis taslak' : 'Kaydedilmemis taslak'}</span>
        <span>{isDirty ? 'Degisti' : 'Temiz'}</span>
        <span>Durum: {status}</span>
        <span>Satir: {items.length}</span>
        <span>Adet: {totals.totalQuantity}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
