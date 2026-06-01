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
  createPurchaseDraft,
  fetchPurchaseInvoice,
  updatePurchaseDraft,
} from '../../services/invoiceDraftApi.js';

const draftSupplierOptions = [
  { id: 501, name: 'Kardelen Bebe Uretim', currency: 'TRY', discountRate: 2, balance: 184000 },
  { id: 502, name: 'Bursa Bebek', currency: 'TRY', discountRate: 3, balance: 94000 },
  { id: 503, name: 'Cotton Baby Global', currency: 'USD', discountRate: 1, balance: 42000 },
];

const draftPurchaseProductOptions = purchaseInvoiceItems.map((item) => ({
  productId: item.productId || item.id,
  stockCode: item.stockCode,
  barcode: item.barcode,
  productName: item.productName,
  currency: item.currency,
  purchasePrice: item.purchasePrice,
  lineDiscountRate: item.lineDiscountRate,
  isPassive: item.stockCode === 'STK-100411',
}));

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
    status: draft.status === 'DRAFT' ? 'Taslak' : 'FINALIZED',
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
  const [productQuery, setProductQuery] = useState('');
  const [productToAddId, setProductToAddId] = useState(String(draftPurchaseProductOptions[0]?.productId ?? ''));
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(purchaseDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, invoiceRate, supplierRate),
    [invoiceRate, items, supplierRate],
  );
  const isFinalized = status === 'FINALIZED';
  const canSaveDraft = permissions.includes('purchase.draft.write');
  const canFinalize = permissions.includes('purchase.finalize');
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    return draftPurchaseProductOptions.filter((product) => {
      const matchesQuery = !query || [
        product.stockCode,
        product.barcode,
        product.productName,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      return matchesQuery && !product.isPassive;
    });
  }, [productQuery]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    const supplier = draftSupplierOptions.find((item) => String(item.id) === String(supplierId));

    if (!supplier) {
      return;
    }

    setErrorMessage('');
    setSupplierRate(supplier.discountRate);
    setInvoice((current) => ({
      ...current,
      supplierId: supplier.id,
      supplier: supplier.name,
      supplierCurrency: supplier.currency,
      supplierBalanceLabel: formatMoney(supplier.balance, supplier.currency),
      supplierDiscountRate: supplier.discountRate,
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

    const product = draftPurchaseProductOptions.find((item) => String(item.productId) === String(productToAddId));

    if (!product || isFinalized) {
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
          currency: invoice.invoiceCurrency,
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
    if (isFinalized) {
      setStatusMessage('Kesinlesmis alis fisi guncellenemez; iptal/duzeltme akisi ayri sprintte ele alinacak.');
      return;
    }

    if (!canSaveDraft) {
      setErrorMessage('Bu islem icin purchase.draft.write yetkisi gerekli.');
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
    setErrorMessage('');
    setStatusMessage('Phase 1’de alış kesinleştirme kapalıdır. Gerçek stok artışı ve tedarikçi cari hareketleri Phase 2’de bağlanacaktır.');
  }

  return (
    <main className="work-area purchase-invoice-screen">
      <PurchaseInvoiceToolbar
        status={status}
        isSaving={isSaving}
        isFinalizing={false}
        isFinalized={isFinalized}
        canSaveDraft={canSaveDraft}
        canFinalize={canFinalize}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="purchase-invoice-layout">
        {isLoading && <div className="list-state">Alis taslagi API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Alis taslagi API'ye kaydediliyor...</div>}
        {isFinalized && (
          <div className="list-state list-state-success">FINALIZED alis fisi readonly modda; tekrar kayit/kesinlestirme kapali.</div>
        )}
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state">Alis taslak satiri bulunamadi.</div>
        )}
        <PurchaseInvoiceHeader
          invoice={invoice}
          invoiceRate={invoiceRate}
          isReadonly={isFinalized}
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
              <span>Tedarikci sec</span>
              <select value={invoice.supplierId || ''} disabled={isFinalized} onChange={(event) => selectSupplier(event.target.value)}>
                <option value="">Tedarikci secin</option>
                {draftSupplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Urun ara</span>
              <input
                disabled={isFinalized}
                placeholder="Barkod / stok kodu / urun adi"
                value={productQuery}
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  const query = event.target.value.trim().toLowerCase();
                  const match = draftPurchaseProductOptions.find((product) => (
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
              <select value={productToAddId} disabled={isFinalized} onChange={(event) => setProductToAddId(event.target.value)}>
                <option value="">Urun secin</option>
                {filteredProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.stockCode} / {product.productName}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={isFinalized} onClick={addDraftItem}>Satir Ekle</button>
          </div>
        </section>
        <PurchaseInvoiceSupplierPanel invoice={invoice} permissions={purchaseInvoicePermissions} />
        <PurchaseInvoiceItemsTable
          isReadonly={isFinalized}
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
