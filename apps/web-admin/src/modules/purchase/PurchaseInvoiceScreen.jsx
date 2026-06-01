import React, { useEffect, useMemo, useState } from 'react';
import { PurchaseInvoiceHeader } from './PurchaseInvoiceHeader.jsx';
import { PurchaseInvoiceItemsTable } from './PurchaseInvoiceItemsTable.jsx';
import { PurchaseInvoiceRulesPanel } from './PurchaseInvoiceRulesPanel.jsx';
import { PurchaseInvoiceSupplierPanel } from './PurchaseInvoiceSupplierPanel.jsx';
import { PurchaseInvoiceToolbar } from './PurchaseInvoiceToolbar.jsx';
import { PurchaseInvoiceTotals } from './PurchaseInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  purchaseInvoiceHeader,
  purchaseInvoiceItems,
  purchaseInvoicePermissions,
  purchaseInvoiceRules,
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
import { fetchProducts } from '../../services/productApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';

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
  status: 'Taslak',
};

function calculateTotals(items, invoiceRate, supplierRate) {
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

  return {
    subtotal,
    lineDiscountTotal,
    invoiceDiscountRate: invoiceRate,
    supplierDiscountRate: supplierRate,
    totalDiscount,
    grandTotal,
    tryEquivalent: grandTotal,
    stockCostEffect: grandTotal,
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
    supplier: draft.supplierName || `Tedarikci #${draft.supplierId}`,
    supplierCurrency: draft.supplierCurrency,
    supplierBalanceLabel: draft.supplierBalanceLabel || '-',
    supplierDiscountRate: Number(draft.supplierDiscountRate || 0),
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
  const [status, setStatus] = useState(purchaseInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(purchaseDraftId ? purchaseInvoiceItems[0]?.id : null);
  const [statusMessage, setStatusMessage] = useState('Taslak alis fisi stok artirmaz ve cari hareket olusturmaz.');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [purchaseProductOptions, setPurchaseProductOptions] = useState([]);
  const [productToAddId, setProductToAddId] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(purchaseDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, invoiceRate, supplierRate),
    [invoiceRate, items, supplierRate],
  );
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isReadonly = isFinalized || isCancelled;
  const canSaveDraft = draftId ? permissions.includes('purchase.edit') : permissions.includes('purchase.create');
  const canFinalize = permissions.includes('purchase.finalize');
  const canCancel = permissions.includes('purchase.cancel');
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    return purchaseProductOptions.filter((product) => {
      const matchesQuery = !query || [
        product.stockCode,
        product.barcode,
        product.productName,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      return matchesQuery && !product.isPassive;
    });
  }, [productQuery, purchaseProductOptions]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
          fetchProducts({
            page: 1,
            limit: 100,
            search: productQuery,
            activeOnly: true,
          }),
        ]);

        if (!isMounted) {
          return;
        }

        const nextSuppliers = supplierResponse.data || [];
        const nextProducts = (productResponse.data || []).map((product) => ({
          productId: product.id,
          stockCode: product.stockCode,
          barcode: product.barcodeMasked || '-',
          productName: product.productName,
          currency: product.currency,
          purchasePrice: Number(product.purchasePrice || 0),
          lineDiscountRate: 0,
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
          setErrorMessage(`${error.message || 'Alis lookup verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Tedarikci/urun lookup API hatasi; gercek modda mock fallback yapilmadi.');
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
  }, [productQuery, supplierQuery]);

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
          setStatusMessage(`Alis taslagi DB'den acildi (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Alis taslagi okunamadi.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Alis taslak okuma basarisiz; API/DB kontrol edilmeli.');
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
    setStatus('Taslak');
    setSelectedItemId(null);
    setSupplierQuery('');
    setProductQuery('');
    setErrorMessage('');
    setIsDirty(false);
    setStatusMessage('Yeni alis taslagi hazirlandi; kaydedilene kadar ticari etki yok.');
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
    markDirty('Alis taslagi degisti; stok ve tedarikci cari hareketi olusmadi.');
  }

  function updateInvoiceRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Fis geneli iskonto orani 0-100 arasinda olmali.');
      return;
    }

    setErrorMessage('');
    setInvoiceRate(value);
    markDirty('Fis geneli iskonto degisti; taslak henuz ticari etki olusturmaz.');
  }

  function updateSupplierRate(value) {
    if (value < 0 || value > 100) {
      setErrorMessage('Tedarikci iskonto orani 0-100 arasinda olmali.');
      return;
    }

    setErrorMessage('');
    setSupplierRate(value);
    setInvoice((current) => ({ ...current, supplierDiscountRate: value }));
    markDirty('Tedarikci iskonto degisti; taslak henuz ticari etki olusturmaz.');
  }

  function selectSupplier(supplierId) {
    const supplier = supplierOptions.find((item) => String(item.id) === String(supplierId));

    if (!supplier) {
      return;
    }

    setErrorMessage('');
    setSupplierRate(0);
    setInvoice((current) => ({
      ...current,
      supplierId: supplier.id,
      supplier: supplier.supplierName,
      supplierCurrency: supplier.currency,
      supplierBalanceLabel: formatMoney(supplier.balance, supplier.currency),
      supplierDiscountRate: 0,
      invoiceCurrency: supplier.currency,
      exchangeRate: `${supplier.currency} 1.0000`,
      exchangeRateValue: 1,
    }));
    markDirty('Tedarikci secildi; alis taslagi henuz stok veya cari hareket olusturmaz.');
  }

  function addDraftItem() {
    if (!invoice.supplierId) {
      setErrorMessage('Satir eklemek icin once tedarikci secin.');
      setStatusMessage('Tedarikci secilmeden urun satiri eklenemez.');
      return;
    }

    if (!productToAddId) {
      setErrorMessage('Satir eklemek icin once urun secin.');
      setStatusMessage('Urun secilmeden satir eklenemez.');
      return;
    }

    const product = purchaseProductOptions.find((item) => String(item.productId) === String(productToAddId));

    if (!product || isReadonly) {
      setErrorMessage('Secilen urun bulunamadi veya fis readonly.');
      return;
    }

    if (product.isPassive) {
      setErrorMessage('Pasif urunler alis taslagina eklenemez.');
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
          currency: product.currency || invoice.invoiceCurrency,
          purchasePrice: product.purchasePrice,
          lineDiscountRate: product.lineDiscountRate,
          stockEffect: '+1 taslak',
          note: 'Alis taslak satir',
        },
      ];
    });
    markDirty('Urun alis taslagina eklendi; gercek stok artisi yok.');
  }

  function updateDraftItem(itemId, field, value) {
    if ((field === 'quantity' || field === 'purchasePrice') && value <= 0) {
      setErrorMessage(field === 'quantity' ? 'Miktar 0 veya negatif olamaz.' : 'Alis fiyati 0 veya negatif olamaz.');
      return;
    }

    if (field === 'lineDiscountRate' && (value < 0 || value > 100)) {
      setErrorMessage('Satir iskonto orani 0-100 arasinda olmali.');
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
    markDirty('Alis satiri guncellendi; taslak kaydedilene kadar ticari etki yok.');
  }

  function deleteDraftItem(itemId) {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      setSelectedItemId(nextItems[0]?.id ?? null);
      return nextItems;
    });
    markDirty('Alis satiri taslaktan silindi; stok hareketi olusmadi.');
  }

  async function saveDraft() {
    if (isReadonly) {
      setStatusMessage('Kesinlesmis alis fisi guncellenemez; iptal/duzeltme akisi ayri sprintte ele alinacak.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage(draftId ? 'Bu islem icin purchase.edit yetkisi gerekli.' : 'Bu islem icin purchase.create yetkisi gerekli.');
      return;
    }

    if (!invoice.supplierId) {
      setErrorMessage('Alis taslagi kaydetmek icin tedarikci secin.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Bos alis taslagi kaydedilemez. En az bir urun satiri ekleyin.');
      return;
    }

    if (items.some((item) => item.quantity <= 0 || item.purchasePrice <= 0)) {
      setErrorMessage('Alis taslagi kaydedilemez: miktar ve alis fiyati 0 veya negatif olamaz.');
      return;
    }

    if (items.some((item) => item.lineDiscountRate < 0 || item.lineDiscountRate > 100)) {
      setErrorMessage('Alis taslagi kaydedilemez: satir iskonto orani 0-100 arasinda olmali.');
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
      setStatusMessage(response.message || `Alis taslagi DB'ye kaydedildi (#${response.data.id}); stok, cari ve average cost etkisi olusmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alis taslagi kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alis taslak kaydi basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  async function finalizeInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda alis kesinlestirme kapalidir. Gercek stok ve tedarikci hareketleri yazilmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Kesinlestirmek icin once alis taslagini kaydedin.');
      return;
    }

    if (!canFinalize) {
      setErrorMessage('Bu islem icin purchase.cancel yetkisi gerekli.');
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
      setStatusMessage(`Alis fisi kesinlesti (#${response.data.id}); stok ve tedarikci hareketleri olustu.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alis fisi kesinlestirilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alis kesinlestirme basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsFinalizing(false);
    }
  }

  async function cancelInvoice() {
    if (apiConfig.demoMode) {
      setErrorMessage('');
      setStatusMessage('Demo modda alis iptal simule edilir; gercek stok ve tedarikci hareketleri yazilmaz.');
      return;
    }

    if (!draftId) {
      setErrorMessage('Iptal etmek icin kayitli alis fisi gerekli.');
      return;
    }

    if (!isFinalized) {
      setErrorMessage('Sadece finalized alis fisleri iptal edilebilir.');
      return;
    }

    if (!canCancel) {
      setErrorMessage('Bu islem icin purchase.finalize yetkisi gerekli.');
      return;
    }

    const reason = window.prompt('Alis fisi iptal nedeni zorunludur:');
    if (!reason || !reason.trim()) {
      setErrorMessage('Iptal nedeni zorunludur.');
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
      setStatusMessage(`Alis fisi iptal edildi (#${response.data.id}); stok ve tedarikci ters hareketleri olustu. Average cost rollback yapilmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alis fisi iptal edilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alis iptal basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsCancelling(false);
    }
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
      />
      <section className="purchase-invoice-layout">
        {isLoading && <div className="list-state">Alis taslagi API'den okunuyor...</div>}
        {isLookupLoading && <div className="list-state">Tedarikci ve urun lookup API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Alis taslagi API'ye kaydediliyor...</div>}
        {isReadonly && (
          <div className="list-state list-state-success">{status} alis fisi readonly modda; tekrar kayit/kesinlestirme kapali.</div>
        )}
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state">Alis taslak satiri bulunamadi.</div>
        )}
        <PurchaseInvoiceHeader
          invoice={invoice}
          invoiceRate={invoiceRate}
          isReadonly={isReadonly}
          status={status}
          supplierRate={supplierRate}
          onChange={updateInvoiceField}
          onInvoiceRateChange={updateInvoiceRate}
          onSupplierRateChange={updateSupplierRate}
        />
        <section className="erp-panel purchase-draft-controls">
          <div className="panel-title">
            <strong>Alis Taslak Islem Paneli</strong>
            <span>Tedarikci sec / urun ekle / stok artisi yok</span>
          </div>
          <div className="purchase-draft-control-grid">
            <label>
              <span>Tedarikci ara</span>
              <input
                disabled={isReadonly}
                placeholder="Ad / telefon / sehir / ulke"
                value={supplierQuery}
                onChange={(event) => setSupplierQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Tedarikci sec</span>
              <select value={invoice.supplierId || ''} disabled={isReadonly} onChange={(event) => selectSupplier(event.target.value)}>
                <option value="">Tedarikci secin</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierCode} / {supplier.supplierName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Urun ara</span>
              <input
                disabled={isReadonly}
                placeholder="Barkod / stok kodu / urun adi"
                value={productQuery}
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  const query = event.target.value.trim().toLowerCase();
                  const match = purchaseProductOptions.find((product) => (
                    !product.isPassive &&
                    [product.stockCode, product.barcode, product.productName].some((value) => (
                      String(value || '').toLowerCase().includes(query)
                    ))
                  ));
                  setProductToAddId(query && match ? String(match.productId) : '');
                }}
              />
            </label>
            <label>
              <span>Urun sec</span>
              <select value={productToAddId} disabled={isReadonly} onChange={(event) => setProductToAddId(event.target.value)}>
                <option value="">Urun secin</option>
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.stockCode} / {product.productName}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={isReadonly} onClick={addDraftItem}>Satir Ekle</button>
          </div>
        </section>
        <PurchaseInvoiceSupplierPanel invoice={invoice} permissions={purchaseInvoicePermissions} />
        <PurchaseInvoiceItemsTable
          isReadonly={isReadonly}
          items={items}
          selectedItemId={selectedItemId}
          onDeleteItem={deleteDraftItem}
          onSelectItem={setSelectedItemId}
          onUpdateItem={updateDraftItem}
        />
        <PurchaseInvoiceTotals totals={totals} />
        <PurchaseInvoiceRulesPanel rules={purchaseInvoiceRules} statusMessage={statusMessage} />
      </section>
      <section className="screen-summary purchase-invoice-summary">
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
