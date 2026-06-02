import React, { useEffect, useMemo, useState } from 'react';
import { SalesInvoiceCustomerPanel } from './SalesInvoiceCustomerPanel.jsx';
import { SalesInvoiceHeader } from './SalesInvoiceHeader.jsx';
import { SalesInvoiceItemsTable } from './SalesInvoiceItemsTable.jsx';
import { SalesInvoiceRulesPanel } from './SalesInvoiceRulesPanel.jsx';
import { SalesInvoiceToolbar } from './SalesInvoiceToolbar.jsx';
import { SalesInvoiceTotals } from './SalesInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  salesInvoiceHeader,
  salesInvoiceItems,
  salesInvoicePermissions,
  salesInvoiceRules,
} from './salesInvoiceMockData.js';
import {
  cancelSalesDraft,
  createSalesDraft,
  fetchSalesInvoice,
  finalizeSalesDraft,
  updateSalesDraft,
} from '../../services/invoiceDraftApi.js';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { apiConfig } from '../../config/apiConfig.js';

const emptySalesInvoice = {
  ...salesInvoiceHeader,
  invoiceNo: 'Taslak',
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

function calculateTotals(items, discountRate) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const totalCost = items.reduce((total, item) => total + item.quantity * item.averageCostTry, 0);
  const lineCount = items.length;
  const totalQuantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const grossProfit = items.some((item) => item.grossProfitTry !== null && item.grossProfitTry !== undefined)
    ? items.reduce((total, item) => total + Number(item.grossProfitTry || 0), 0)
    : null;
  const discountAmount = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountAmount;
  const estimatedProfit = grandTotal - totalCost;

  return {
    subtotal,
    discountRate,
    discountAmount,
    grandTotal,
    tryEquivalent: grandTotal,
    estimatedProfit,
    grossProfit,
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
    exchangeRate: `${draft.documentCurrency} ${Number(draft.exchangeRate || 1).toFixed(4)}`,
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
    productName: product.productName,
    currency: product.currency,
    unitPrice: Number(product.salePrice || 0),
    averageCostTry: Number(product.averageCostTry || product.purchasePrice || 0),
    stockState: `Stok: ${Number(product.stockQuantity || 0)}`,
    isPassive: product.isPassive,
  };
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
  const [productToAddId, setProductToAddId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [referenceOptionsError, setReferenceOptionsError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(salesDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(() => calculateTotals(items, discountRate), [discountRate, items]);
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isFinalized || isCancelled;
  const canSaveDraft = draftId ? permissions.includes('sales.edit') : permissions.includes('sales.create');
  const canFinalize = permissions.includes('sales.finalize');
  const canCancel = permissions.includes('sales.cancel');
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    return draftProductOptions.filter((product) => {
      const matchesQuery = !query || [
        product.stockCode,
        product.barcode,
        product.productName,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      return matchesQuery && !product.isPassive;
    });
  }, [draftProductOptions, productQuery]);
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
          search: productQuery,
          activeOnly: true,
        });
        const options = (response.data || []).map(mapProductOption);

        if (isMounted) {
          setDraftProductOptions(options);
          setProductToAddId((current) => (
            options.some((product) => String(product.productId) === String(current))
              ? current
              : String(options[0]?.productId ?? '')
          ));
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
      customerId: invoice.customerId || 1,
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
    setInvoice(emptySalesInvoice);
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

  function updateInvoiceField(field, value) {
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

    setInvoice((current) => ({
      ...current,
      customerId: customer.id,
      customer: customer.name,
      customerCurrency: customer.currency,
      customerBalanceLabel: formatMoney(customer.balance, customer.currency),
      invoiceCurrency: customer.currency,
      exchangeRate: `${customer.currency} 1.0000`,
      exchangeRateValue: 1,
    }));
    setCustomerQuery(customer.name);
    markDirty('Cari secildi; taslak henuz stok veya cari hareket olusturmaz.');
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
    const normalizedValue = value.trim().toLowerCase();
    const exactProduct = draftProductOptions.find((product) => (
      [product.stockCode, product.barcode, product.productName, `${product.stockCode} / ${product.productName}`]
        .some((fieldValue) => String(fieldValue || '').toLowerCase() === normalizedValue)
    ));
    const firstMatch = draftProductOptions.find((product) => (
      !product.isPassive &&
      [product.stockCode, product.barcode, product.productName, `${product.stockCode} / ${product.productName}`]
        .some((fieldValue) => String(fieldValue || '').toLowerCase().includes(normalizedValue))
    ));
    const product = exactProduct || (normalizedValue ? firstMatch : null);

    setProductToAddId(product ? String(product.productId) : '');
  }

  function addDraftItem() {
    if (!invoice.customerId) {
      setErrorMessage('Satir eklemek icin once cari secin.');
      setStatusMessage('Cari secilmeden urun satiri eklenemez.');
      return;
    }

    if (!productToAddId) {
      setErrorMessage('Satir eklemek icin once urun secin.');
      setStatusMessage('Urun secilmeden satir eklenemez.');
      return;
    }

    const product = draftProductOptions.find((item) => String(item.productId) === String(productToAddId));

    if (!product || isReadonly) {
      setErrorMessage('Secilen urun bulunamadi veya fis readonly.');
      return;
    }

    if (product.isPassive) {
      setErrorMessage('Pasif urunler satis taslagina eklenemez.');
      return;
    }

    const nextId = Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
    setErrorMessage('');
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => String(item.productId) === String(product.productId));

      if (existingItem) {
        setSelectedItemId(existingItem.id);
        return currentItems.map((item) => (
          item.id === existingItem.id ? { ...item, quantity: item.quantity + Math.max(1, Number(quickQuantity || 1)) } : item
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
          quantity: Math.max(1, Number(quickQuantity || 1)),
          currency: product.currency,
          unitPrice: product.unitPrice,
          stockState: product.stockState,
          note: 'Taslak satir',
          averageCostTry: product.averageCostTry,
          grossProfitTry: null,
          grossProfitRate: null,
        },
      ];
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
      item.id === itemId ? { ...item, [field]: value } : item
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
    if (isReadonly) {
      setStatusMessage('Kesinlesmis fis guncellenemez; iptal/duzeltme akisi ayri sprintte ele alinacak.');
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
      setErrorMessage('Bu islem icin sales.cancel yetkisi gerekli.');
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
      setErrorMessage('Bu islem icin sales.finalize yetkisi gerekli.');
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
      />
      <section className="sales-invoice-layout">
        {isLoading && <div className="list-state">Taslak fis API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {referenceOptionsError && <div className="list-state list-state-error">{referenceOptionsError}</div>}
        {isSaving && <div className="list-state">Taslak fis API'ye kaydediliyor...</div>}
        {isReadonly && (
          <div className="list-state list-state-success">{status} fis readonly modda; tekrar kayit/kesinlestirme kapali.</div>
        )}
        <section className="sales-flow-steps" aria-label="Satış fişi adımları">
          {flowSteps.map((step, index) => (
            <span className={step.done ? 'done' : ''} key={step.key}>
              <b>{index + 1}</b>{step.label}
            </span>
          ))}
        </section>
        <SalesInvoiceHeader
          discountRate={discountRate}
          invoice={invoice}
          isReadonly={isReadonly}
          status={status}
          onChange={updateInvoiceField}
          onDiscountChange={setDiscountRate}
        />
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
                list="sales-product-suggestions"
                value={productQuery}
                onChange={(event) => updateProductQuery(event.target.value)}
                onKeyDown={addDraftItemFromKeyboard}
              />
              <datalist id="sales-product-suggestions">
                {filteredProducts.map((product) => (
                  <option
                    key={product.productId}
                    value={`${product.stockCode} / ${product.productName}`}
                  />
                ))}
              </datalist>
            </label>
            <label>
              <span>Seçim</span>
              <select value={productToAddId} disabled={isReadonly} onChange={(event) => setProductToAddId(event.target.value)}>
                <option value="">Urun secin</option>
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.stockCode} / {product.productName}
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
        {!isLoading && !errorMessage && items.length === 0 && (
          <section className="sales-empty-state">
            <strong>Satır bekleniyor</strong>
            <span>Önce cari seç, sonra ürün/barkod ara. Enter veya Satır Ekle ile taslağa eklenir.</span>
          </section>
        )}
        <SalesInvoiceCustomerPanel invoice={invoice} permissions={salesInvoicePermissions} />
        <SalesInvoiceItemsTable
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
        <SalesInvoiceRulesPanel rules={salesInvoiceRules} statusMessage={statusMessage} />
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
