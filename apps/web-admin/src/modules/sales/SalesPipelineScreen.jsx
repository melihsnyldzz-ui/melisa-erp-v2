import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchProducts } from '../../services/productApi.js';
import {
  changeSalesOfferStatus,
  changeSalesOrderStatus,
  convertSalesOfferToOrder,
  convertSalesOrderToSalesDraft,
  createSalesOffer,
  createSalesOrder,
  fetchSalesOffer,
  fetchSalesOrder,
  updateSalesOffer,
  updateSalesOrder,
} from '../../services/salesPipelineApi.js';
import { exportRowsToCsv, printBusinessDocument } from '../../utils/exportUtils.js';

function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function emptyForm() {
  return {
    id: null,
    documentNo: '',
    documentDate: todayIsoDate(),
    customerId: '',
    customerCurrency: 'TRY',
    documentCurrency: 'TRY',
    exchangeRate: 1,
    discountRate: 0,
    description: '',
    validUntil: '',
    deliveryNote: '',
    status: 'DRAFT',
    items: [],
  };
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function productDisplayName(product = {}) {
  return product.productName || product.name || product.product_name || '';
}

function productBarcode(product = {}) {
  return product.matchedBarcode || product.barcodeMasked || product.barcode || product.primaryBarcode || '';
}

function normalizeDetail(detail) {
  return {
    id: detail.id,
    documentNo: detail.documentNo || '',
    documentDate: detail.documentDate ? String(detail.documentDate).slice(0, 10) : todayIsoDate(),
    customerId: detail.customerId || '',
    customerCurrency: detail.customerCurrency || detail.cardCurrency || 'TRY',
    documentCurrency: detail.documentCurrency || 'TRY',
    exchangeRate: detail.exchangeRate || 1,
    discountRate: detail.discountRate || 0,
    description: detail.description || '',
    validUntil: detail.validUntil ? String(detail.validUntil).slice(0, 10) : '',
    deliveryNote: detail.deliveryNote || '',
    status: detail.status || 'DRAFT',
    items: detail.items || [],
  };
}

export function SalesPipelineScreen({ type, documentId, onDirtyChange, onOpenScreen }) {
  const isOffer = type === 'offer';
  const [form, setForm] = useState(() => emptyForm());
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(Boolean(documentId));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice), 0);
    const discountTotal = subtotal * (numberValue(form.discountRate) / 100);
    const grandTotal = subtotal - discountTotal;
    return {
      subtotal,
      discountTotal,
      grandTotal,
      amountTry: grandTotal * numberValue(form.exchangeRate || 1),
    };
  }, [form.discountRate, form.exchangeRate, form.items]);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      try {
        const [customerResponse, productResponse] = await Promise.all([
          fetchCustomers({ page: 1, limit: 100, activeOnly: true }),
          fetchProducts({ page: 1, limit: 100, activeOnly: true }),
        ]);
        if (isMounted) {
          setCustomers(customerResponse.data || []);
          setProducts(productResponse.data || []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || 'Cari/ürün listesi okunamadı.');
        }
      }
    }

    loadLookups();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      if (!documentId) {
        setForm(emptyForm());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const loader = isOffer ? fetchSalesOffer : fetchSalesOrder;
        const response = await loader(documentId);
        if (isMounted) {
          setForm(normalizeDetail(response.data));
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || 'Belge detayi okunamadi.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDocument();
    return () => {
      isMounted = false;
    };
  }, [documentId, isOffer]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    onDirtyChange?.(true);
  }

  function selectCustomer(customerId) {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    setForm((current) => ({
      ...current,
      customerId,
      customerCurrency: customer.currency || customer.currencyCode || current.customerCurrency || 'TRY',
      documentCurrency: customer.currency || customer.currencyCode || current.documentCurrency || 'TRY',
    }));
    onDirtyChange?.(true);
  }

  function addLine() {
    const product = products.find((item) => String(item.id) === String(selectedProductId));
    if (!product) {
      setErrorMessage('Satır eklemek için ürün seçin.');
      return;
    }

    const qty = Math.max(numberValue(quantity), 1);
    const unitPrice = numberValue(product.salesPrice ?? product.salePrice ?? product.price ?? 0);
    const line = {
      productId: product.id,
      stockCode: product.stockCode || product.stock_code || '',
      barcode: productBarcode(product),
      productName: productDisplayName(product),
      quantity: qty,
      currency: form.documentCurrency || product.currency || product.currencyCode || 'TRY',
      unitPrice,
      lineTotal: qty * unitPrice,
      note: '',
    };

    setForm((current) => ({ ...current, items: [...current.items, line] }));
    setSelectedProductId('');
    setQuantity(1);
    setErrorMessage('');
    onDirtyChange?.(true);
  }

  function updateLine(index, key, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        const next = { ...item, [key]: value };
        if (key === 'quantity' || key === 'unitPrice') {
          next.lineTotal = numberValue(next.quantity) * numberValue(next.unitPrice);
        }
        return next;
      }),
    }));
    onDirtyChange?.(true);
  }

  function removeLine(index) {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
    onDirtyChange?.(true);
  }

  function toPayload() {
    return {
      documentNo: form.documentNo,
      documentDate: form.documentDate,
      customerId: form.customerId,
      customerCurrency: form.customerCurrency,
      documentCurrency: form.documentCurrency,
      exchangeRate: numberValue(form.exchangeRate || 1),
      discountRate: numberValue(form.discountRate || 0),
      description: form.description,
      validUntil: form.validUntil || null,
      deliveryNote: form.deliveryNote || null,
      items: form.items.map((item) => ({
        ...item,
        quantity: numberValue(item.quantity),
        unitPrice: numberValue(item.unitPrice),
      })),
    };
  }

  async function saveDocument() {
    setIsSaving(true);
    setErrorMessage('');
    setMessage('');
    try {
      const payload = toPayload();
      const response = form.id
         ? await (isOffer ? updateSalesOffer : updateSalesOrder)(form.id, payload)
        : await (isOffer ? createSalesOffer : createSalesOrder)(payload);
      setForm(normalizeDetail(response.data));
      setMessage(`${isOffer ? 'Teklif' : 'Siparis'} kaydedildi.`);
      onDirtyChange?.(false);
    } catch (error) {
      setErrorMessage(error.message || 'Kayıt başarısız.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(status) {
    if (!form.id) {
      setErrorMessage('Durum değiştirmek için önce kaydedin.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setMessage('');
    try {
      const response = await (isOffer ? changeSalesOfferStatus : changeSalesOrderStatus)(form.id, status);
      setForm(normalizeDetail(response.data));
      setMessage('Durum g?ncellendi.');
      onDirtyChange?.(false);
    } catch (error) {
      setErrorMessage(error.message || 'Durum g?ncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function convertDocument() {
    if (!form.id) {
      setErrorMessage('Dönüştürmek için önce belgeyi kaydedin.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setMessage('');
    try {
      if (isOffer) {
        const response = await convertSalesOfferToOrder(form.id);
        const order = response.data.order;
        setMessage(response.data.duplicate ? 'Bu teklif daha once siparie donusturulmus.' : 'Teklif siparie donusturuldu.');
        if (order.id) {
          onOpenScreen?.('sales-order', { orderId: order.id, documentNo: order.documentNo });
        }
      } else {
        const response = await convertSalesOrderToSalesDraft(form.id);
        const salesDraft = response.data.salesDraft;
        setMessage(response.data.duplicate ? 'Bu sipariş için satış fişi zaten oluşturulmuş.' : 'Sipariş satış fişine dönüştürüldü.');
        if (salesDraft.id) {
          onOpenScreen?.('sales-invoice', { salesDraftId: salesDraft.id, invoiceNo: salesDraft.invoiceNo || salesDraft.documentNo });
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'Dönüşüm başarısız.');
    } finally {
      setIsSaving(false);
    }
  }

  function printPipelineDocument() {
    const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.customerId));
    printBusinessDocument({
      title: isOffer ? 'Teklif' : 'Sipariş',
      documentNo: form.documentNo || 'Taslak',
      status: form.status,
      date: form.documentDate,
      partyLabel: 'Cari',
      partyName: selectedCustomer.name || selectedCustomer.customerName || `Cari #${form.customerId || '-'}`,
      currency: form.documentCurrency,
      exchangeRate: form.exchangeRate,
      description: form.description,
      items: form.items,
      totals: {
        currency: form.documentCurrency,
        subtotal: totals.subtotal,
        discountAmount: totals.discountTotal,
        grandTotal: totals.grandTotal,
        tryEquivalent: totals.amountTry,
      },
      extraInfo: [
        { label: 'Cari PB', value: form.customerCurrency },
        { label: isOffer ? 'Geçerlilik' : 'Sevk Notu', value: isOffer ? form.validUntil : form.deliveryNote },
      ],
    });
  }

  function exportPipelineRows() {
    exportRowsToCsv({
      filename: `${isOffer ? 'teklif' : 'sipari'}-${form.documentNo || 'taslak'}`,
      rows: form.items,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Miktar', key: 'quantity' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Birim Fiyat', key: 'unitPrice' },
        { label: 'Satır Toplamı', value: (row) => Number(row.quantity || 0) * Number(row.unitPrice || 0) },
        { label: 'Not', key: 'note' },
      ],
    });
  }

  if (isLoading) {
    return <main className="work-area"><div className="list-state">Belge yükleniyor...</div></main>;
  }

  return (
    <main className="work-area invoice-screen">
      <section className="invoice-toolbar">
        <div className="invoice-title">
          <strong>{isOffer ? 'Teklif Kartı' : 'Siparis Kartı'}</strong>
          <span>{form.documentNo || 'Yeni belge'} / {form.status}</span>
        </div>
        <div className="invoice-actions">
          <button type="button" onClick={() => setForm(emptyForm())}>Yeni</button>
          <button type="button" className="primary-button" onClick={saveDocument} disabled={isSaving}>
            {isSaving ? 'Kaydediliyor' : 'Kaydet'}
          </button>
          <button type="button" onClick={exportPipelineRows}>Excel</button>
          <button type="button" onClick={printPipelineDocument}>Yazdır/PDF</button>
          {isOffer ? (
            <>
              <button type="button" onClick={() => changeStatus('sent')}>Gönderildi</button>
              <button type="button" onClick={() => changeStatus('accepted')}>Kabul</button>
              <button type="button" onClick={convertDocument} disabled={isSaving}>Siparişe Dönüştür</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => changeStatus('confirmed')}>Onayla</button>
              <button type="button" onClick={() => changeStatus('fulfilled')}>Tamamla</button>
              <button type="button" onClick={convertDocument} disabled={isSaving}>Satış Fişine Dönüştür</button>
            </>
          )}
          <button type="button" className="danger-button" onClick={() => changeStatus('cancelled')}>İptal</button>
        </div>
      </section>

      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Belge Bilgileri</strong>
          <span>Cari, para birimi ve kur snapshot</span>
        </div>
        <div className="filter-grid">
          <label>
            Belge No
            <input value={form.documentNo} onChange={(event) => updateField('documentNo', event.target.value)} placeholder="Otomatik" />
          </label>
          <label>
            Tarih
            <input type="date" value={form.documentDate} onChange={(event) => updateField('documentDate', event.target.value)} />
          </label>
          <label>
            Cari
            <select value={form.customerId} onChange={(event) => selectCustomer(event.target.value)}>
              <option value="">Cari seç</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.customerCode || customer.code} / {customer.name}</option>
              ))}
            </select>
          </label>
          <label>
            PB
            <select value={form.documentCurrency} onChange={(event) => updateField('documentCurrency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Kur
            <input type="number" step="0.0001" value={form.exchangeRate} onChange={(event) => updateField('exchangeRate', event.target.value)} />
          </label>
          <label>
            İskonto %
            <input type="number" step="0.01" value={form.discountRate} onChange={(event) => updateField('discountRate', event.target.value)} />
          </label>
          {isOffer ? (
            <label>
              Geçerlilik
              <input type="date" value={form.validUntil} onChange={(event) => updateField('validUntil', event.target.value)} />
            </label>
          ) : (
            <label>
              Sevk Notu
              <input value={form.deliveryNote} onChange={(event) => updateField('deliveryNote', event.target.value)} />
            </label>
          )}
          <label>
            Açıklama
            <input value={form.description} onChange={(event) => updateField('description', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Hzl Satr</strong>
          <span>Ürün seç, adet gir, satır ekle</span>
        </div>
        <div className="quick-line-grid">
          <label>
            Ürün
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              <option value="">Ürün seç</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.stockCode || product.stock_code} / {productDisplayName(product)}</option>
              ))}
            </select>
          </label>
          <label>
            Adet
            <input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <button type="button" className="primary-button" onClick={addLine}>Satır Ekle</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Satırlar</strong>
          <span>{form.items.length} satır</span>
        </div>
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Stok Kodu</th>
                <th>Barkod</th>
                <th>Ürün</th>
                <th>Miktar</th>
                <th>PB</th>
                <th>Birim Fiyat</th>
                <th>Satır Toplamı</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 && (
                <tr><td colSpan="8">Satır bekleniyor.</td></tr>
              )}
              {form.items.map((item, index) => (
                <tr key={`${item.productId}-${index}`}>
                  <td>{item.stockCode}</td>
                  <td>{item.barcode || '-'}</td>
                  <td>{item.productName}</td>
                  <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /></td>
                  <td>{item.currency}</td>
                  <td><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} /></td>
                  <td>{formatMoney(numberValue(item.quantity) * numberValue(item.unitPrice), item.currency)}</td>
                  <td><button type="button" className="mini-button danger-button" onClick={() => removeLine(index)}>Sil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="floating-summary">
        <strong>Toplamlar</strong>
        <span>Ara: {formatMoney(totals.subtotal, form.documentCurrency)}</span>
        <span>İskonto: {formatMoney(totals.discountTotal, form.documentCurrency)}</span>
        <span>Genel: {formatMoney(totals.grandTotal, form.documentCurrency)}</span>
        <span>TRY: {formatMoney(totals.amountTry, 'TRY')}</span>
      </section>
    </main>
  );
}
