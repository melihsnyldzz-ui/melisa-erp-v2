import React, { useEffect, useMemo, useState } from 'react';
import { createSupplier, fetchSupplier, updateSupplier } from '../../services/supplierApi.js';
import { SupplierProductTracePanel } from './SupplierProductTracePanel.jsx';

const emptySupplierForm = {
  supplierCode: '',
  supplierName: '',
  phone: '',
  city: '',
  country: 'Turkiye',
  currency: 'TRY',
  balance: 0,
  purchaseDiscountRate: 0,
  purchaseCount: 0,
  lastPurchaseDate: '',
  movements: [],
  productTrace: [],
  isPassive: false,
};

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function buildSupplierBalanceRows(form) {
  const summary = new Map(['TRY', 'USD', 'EUR'].map((currency) => [currency, {
    currency,
    debit: 0,
    credit: 0,
    balance: 0,
  }]));

  (form.movements || []).forEach((movement) => {
    const currency = movement.currency || form.currency || 'TRY';
    const effect = Number(movement.balanceEffect ?? movement.amount ?? 0);
    const amount = Math.abs(Number(movement.amount || effect || 0));
    const row = summary.get(currency) || { currency, debit: 0, credit: 0, balance: 0 };

    if (effect > 0) {
      row.credit += amount;
    } else if (effect < 0) {
      row.debit += amount;
    }

    row.balance += effect;
    summary.set(currency, row);
  });

  if ((form.movements || []).length === 0) {
    const currency = form.currency || 'TRY';
    const balance = Number(form.balance || 0);
    const row = summary.get(currency) || { currency, debit: 0, credit: 0, balance: 0 };

    row.credit = balance > 0 ? balance : 0;
    row.debit = balance < 0 ? Math.abs(balance) : 0;
    row.balance = balance;
    summary.set(currency, row);
  }

  return Array.from(summary.values());
}

function movementLabel(type) {
  const labels = {
    purchase_invoice: 'Alış fişi',
    purchase_invoice_cancel: 'Alış iptal',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function mapDetailToForm(detail) {
  return {
    supplierCode: detail.supplierCode || '',
    supplierName: detail.supplierName || '',
    phone: detail.phoneMasked || '',
    city: detail.city || '',
    country: detail.country || '',
    currency: detail.currency || 'TRY',
    balance: Number(detail.balance || 0),
    purchaseDiscountRate: Number(detail.purchaseDiscountRate || 0),
    purchaseCount: Number(detail.purchaseCount || 0),
    lastPurchaseDate: detail.lastPurchaseDate || '',
    movements: detail.movements || [],
    productTrace: detail.productTrace || [],
    isPassive: Boolean(detail.isPassive),
  };
}

function validateSupplierForm(form) {
  const missing = [];

  if (!form.supplierCode.trim()) missing.push('tedarikci kodu');
  if (!form.supplierName.trim()) missing.push('ad/unvan');
  if (!form.currency.trim()) missing.push('para birimi');
  if (Number.isNaN(Number(form.purchaseDiscountRate)) || Number(form.purchaseDiscountRate) < 0 || Number(form.purchaseDiscountRate) > 100) {
    missing.push('alis iskontosu 0-100');
  }

  return missing;
}

export function SupplierCardScreen({ supplierId, permissions = [], onDirtyChange, onOpenScreen }) {
  const [activeSupplierId, setActiveSupplierId] = useState(supplierId || null);
  const [form, setForm] = useState(emptySupplierForm);
  const [isLoading, setIsLoading] = useState(Boolean(supplierId));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const mode = activeSupplierId ? 'update' : 'create';
  const canSave = permissions.includes('customer.edit');

  useEffect(() => {
    setActiveSupplierId(supplierId || null);
  }, [supplierId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSupplier() {
      if (!activeSupplierId) {
        setForm(emptySupplierForm);
        setErrorMessage('');
        setIsLoading(false);
        setIsDirty(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSupplier(activeSupplierId);
        if (isMounted) {
          setForm(mapDetailToForm(response.data));
          setIsDirty(false);
        }
      } catch (error) {
        if (isMounted) {
          setForm(emptySupplierForm);
          setErrorMessage(error.message || 'Tedarikci kart API baglantisi basarisiz.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSupplier();

    return () => {
      isMounted = false;
    };
  }, [activeSupplierId]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const summary = useMemo(() => {
    const purchaseMovements = form.movements.filter((row) => row.type === 'purchase_invoice');
    const cancelMovements = form.movements.filter((row) => row.type === 'purchase_invoice_cancel');
    const paymentMovements = form.movements.filter((row) => row.type === 'payment');

    return {
      purchaseCount: purchaseMovements.length || form.purchaseCount,
      cancelCount: cancelMovements.length,
      paymentCount: paymentMovements.length,
      purchaseTotal: purchaseMovements.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      paymentTotal: paymentMovements.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      productQuantity: form.productTrace.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      productAmountTry: form.productTrace.reduce((sum, row) => sum + Number(row.lineTotalTry || 0), 0),
    };
  }, [form.movements, form.purchaseCount, form.productTrace]);
  const balanceRows = useMemo(() => buildSupplierBalanceRows(form), [form]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
    setSuccessMessage('');
  }

  function startNewSupplier() {
    setActiveSupplierId(null);
    setForm(emptySupplierForm);
    setErrorMessage('');
    setSuccessMessage('');
    setIsDirty(false);
  }

  async function saveSupplier() {
    const missing = validateSupplierForm(form);

    if (!canSave) {
      setErrorMessage('Bu islem icin customer.edit yetkisi gerekli.');
      return;
    }

    if (missing.length > 0) {
      setErrorMessage(`Kaydetmeden once zorunlu alanlari tamamlayin: ${missing.join(', ')}.`);
      return;
    }

    const payload = {
      supplierCode: form.supplierCode,
      supplierName: form.supplierName,
      phone: form.phone,
      city: form.city,
      country: form.country,
      currency: form.currency,
      purchaseDiscountRate: Number(form.purchaseDiscountRate || 0),
    };

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = mode === 'create'
        ? await createSupplier(payload)
        : await updateSupplier(activeSupplierId, payload);
      setActiveSupplierId(response.data.id);
      setForm(mapDetailToForm(response.data));
      setIsDirty(false);
      setSuccessMessage(mode === 'create' ? 'Tedarikçi kartı oluşturuldu.' : 'Tedarikçi kartı güncellendi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Tedarikçi kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function openPurchaseInvoice(row) {
    if (row.purchaseInvoiceId && onOpenScreen) {
      onOpenScreen('purchase-invoice', { purchaseDraftId: row.purchaseInvoiceId });
      return;
    }

    if (row.type === 'payment' && onOpenScreen) {
      onOpenScreen('collections-overview', {
        mode: 'payment',
        movementId: row.id,
        supplierId: activeSupplierId,
      });
    }
  }

  function openProductTraceInvoice(row) {
    if (row.purchaseInvoiceId && onOpenScreen) {
      onOpenScreen('purchase-invoice', { purchaseDraftId: row.purchaseInvoiceId, invoiceNo: row.documentNo });
    }
  }

  function openProductTraceProduct(row) {
    if (row.productId && onOpenScreen) {
      onOpenScreen('product-card', { productId: row.productId, stockCode: row.stockCode });
    }
  }

  return (
    <main className="work-area supplier-card-screen">
      {isLoading && <div className="list-state">API'den tedarikçi kartı yükleniyor...</div>}
      {!isLoading && (
        <>
          <section className="customer-card-header">
            <div className="customer-title-block">
              <strong>Tedarikçi Kartı</strong>
              <span>{form.supplierCode || 'YENI-TED'} / {form.supplierName || 'Yeni tedarikçi'}</span>
            </div>
            <div className="customer-card-toolbar">
              <button type="button" onClick={saveSupplier} disabled={isSaving || !canSave}>
                {isSaving ? 'Kaydediliyor' : 'Kaydet'}
              </button>
              <button type="button" onClick={startNewSupplier}>Yeni</button>
              <button type="button" onClick={() => onOpenScreen?.('purchase-invoice-list')}>Alis Fisleri</button>
              <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Güncelleme'}</span>
            </div>
          </section>

          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

          <section className="supplier-card-layout">
            <section className="erp-panel customer-form-panel supplier-form-panel">
              <div className="panel-title">
                <strong>Tedarikçi Bilgileri</strong>
                <span>Alış fişleri ve ödemeler bu alış carisini besler</span>
              </div>
              <div className="customer-form-grid">
                <label>
                  <span>Tedarikçi kodu</span>
                  <input value={form.supplierCode} onChange={(event) => updateField('supplierCode', event.target.value)} />
                </label>
                <label>
                  <span>Ad / unvan</span>
                  <input value={form.supplierName} onChange={(event) => updateField('supplierName', event.target.value)} />
                </label>
                <label>
                  <span>Telefon</span>
                  <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
                </label>
                <label>
                  <span>Para birimi</span>
                  <select value={form.currency} onChange={(event) => updateField('currency', event.target.value)}>
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <label>
                  <span>Alış iskontosu %</span>
                  <input min="0" max="100" step="0.01" type="number" value={form.purchaseDiscountRate} onChange={(event) => updateField('purchaseDiscountRate', event.target.value)} />
                </label>
                <label>
                  <span>Şehir</span>
                  <input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
                </label>
                <label>
                  <span>Ülke</span>
                  <input value={form.country} onChange={(event) => updateField('country', event.target.value)} />
                </label>
                <label>
                  <span>Durum</span>
                  <input readOnly value={form.isPassive ? 'Pasif' : 'Aktif'} />
                </label>
              </div>
            </section>

            <aside className="erp-panel supplier-summary-panel">
              <div className="panel-title">
                <strong>Tedarikçi Özeti</strong>
                <span>Alış, borç ve ürün etkisi</span>
              </div>
              <dl className="supplier-summary-list">
                <div>
                  <dt>Bakiye</dt>
                  <dd className="customer-payable">{formatMoney(form.balance, form.currency)}</dd>
                </div>
                {balanceRows.map((balance) => (
                  <div className="supplier-currency-balance" key={balance.currency}>
                    <dt>{balance.currency}</dt>
                    <dd>
                      <span>Borç {formatMoney(balance.debit, balance.currency)}</span>
                      <span>Alacak {formatMoney(balance.credit, balance.currency)}</span>
                      <b className={balance.balance > 0 ? 'customer-payable' : 'status-active'}>
                        {formatMoney(balance.balance, balance.currency)}
                      </b>
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Alış fişi</dt>
                  <dd>{summary.purchaseCount}</dd>
                </div>
                <div>
                  <dt>Alış toplamı</dt>
                  <dd>{formatMoney(summary.purchaseTotal, form.currency)}</dd>
                </div>
                <div>
                  <dt>Ödeme</dt>
                  <dd>{formatMoney(summary.paymentTotal, form.currency)}</dd>
                </div>
                <div>
                  <dt>İptal hareketi</dt>
                  <dd>{summary.cancelCount}</dd>
                </div>
                <div>
                  <dt>Son alış</dt>
                  <dd>{form.lastPurchaseDate ? String(form.lastPurchaseDate).slice(0, 10) : '-'}</dd>
                </div>
                <div>
                  <dt>Alınan adet</dt>
                  <dd className="in-cell">{summary.productQuantity}</dd>
                </div>
                <div>
                  <dt>Net maliyet TRY</dt>
                  <dd>{formatMoney(summary.productAmountTry, 'TRY')}</dd>
                </div>
              </dl>
            </aside>
          </section>

          <section className="erp-panel supplier-movements-panel">
            <div className="panel-title">
              <strong>Alış / Ödeme Hareketleri</strong>
              <span>Alış fişleri kesinleşince tedarikçi kartını besler</span>
            </div>
            {form.movements.length === 0 ? (
              <div className="list-state">Bu tedarikçi için hareket yok.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Tip</th>
                      <th>Belge no</th>
                      <th>Tutar</th>
                      <th>Bakiye etkisi</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.movements.map((row) => (
                      <tr
                        key={row.id}
                        className={`${row.purchaseInvoiceId || row.type === 'payment' ? 'clickable-row' : ''} ${row.type === 'purchase_invoice_cancel' ? 'cancel-row' : ''}`}
                        onClick={() => openPurchaseInvoice(row)}
                      >
                        <td>{row.date || '-'}</td>
                        <td>{movementLabel(row.type)}</td>
                        <td className="code-cell">{row.documentNo}</td>
                        <td className="money-cell">{formatMoney(row.amount, row.currency)}</td>
                        <td className={`money-cell ${row.balanceEffect >= 0 ? 'customer-payable' : 'status-active'}`}>
                          {formatMoney(row.balanceEffect, row.currency)}
                        </td>
                        <td>{String(row.status || '-').toUpperCase()}</td>
                        <td>
                          {row.purchaseInvoiceId ? (
                            <button type="button" onClick={() => openPurchaseInvoice(row)}>Fişe Git</button>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <SupplierProductTracePanel
            rows={form.productTrace}
            onOpenInvoice={openProductTraceInvoice}
            onOpenProduct={openProductTraceProduct}
          />

          <section className="screen-summary customer-summary">
            <span>Tedarikçi: {form.supplierCode || 'Yeni'}</span>
            <span>Bakiye: {formatMoney(form.balance, form.currency)}</span>
            <span>Alış iskonto: %{Number(form.purchaseDiscountRate || 0)}</span>
            <span>{isDirty ? 'Değişti' : 'Temiz'}</span>
            <span>Kaynak: API / SQL</span>
          </section>
        </>
      )}
    </main>
  );
}
