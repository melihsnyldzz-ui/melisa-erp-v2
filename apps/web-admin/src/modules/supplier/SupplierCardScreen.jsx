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

function movementLabel(type) {
  const labels = {
    purchase_invoice: 'Alis fisi',
    purchase_invoice_cancel: 'Alis iptal',
    payment: 'Odeme',
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
    };
  }, [form.movements, form.purchaseCount]);

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
      setSuccessMessage(mode === 'create' ? 'Tedarikci karti olusturuldu.' : 'Tedarikci karti guncellendi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Tedarikci kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function openPurchaseInvoice(row) {
    if (row.purchaseInvoiceId && onOpenScreen) {
      onOpenScreen('purchase-invoice', { purchaseDraftId: row.purchaseInvoiceId });
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
      {isLoading && <div className="list-state">API'den tedarikci karti yukleniyor...</div>}
      {!isLoading && (
        <>
          <section className="customer-card-header">
            <div className="customer-title-block">
              <strong>Tedarikci Karti</strong>
              <span>{form.supplierCode || 'YENI-TED'} / {form.supplierName || 'Yeni tedarikci'}</span>
            </div>
            <div className="customer-card-toolbar">
              <button type="button" onClick={saveSupplier} disabled={isSaving || !canSave}>
                {isSaving ? 'Kaydediliyor' : 'Kaydet'}
              </button>
              <button type="button" onClick={startNewSupplier}>Yeni</button>
              <button type="button" onClick={() => onOpenScreen?.('purchase-invoice-list')}>Alis Fisleri</button>
              <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Update'}</span>
            </div>
          </section>

          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

          <section className="supplier-card-layout">
            <section className="erp-panel customer-form-panel supplier-form-panel">
              <div className="panel-title">
                <strong>Tedarikci Bilgileri</strong>
                <span>Alis fisleri ve odemeler bu karti besler</span>
              </div>
              <div className="customer-form-grid">
                <label>
                  <span>Tedarikci kodu</span>
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
                  <span>Alis iskontosu %</span>
                  <input min="0" max="100" step="0.01" type="number" value={form.purchaseDiscountRate} onChange={(event) => updateField('purchaseDiscountRate', event.target.value)} />
                </label>
                <label>
                  <span>Sehir</span>
                  <input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
                </label>
                <label>
                  <span>Ulke</span>
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
                <strong>Tedarikci Ozeti</strong>
                <span>Alis ve borc etkisi</span>
              </div>
              <dl className="supplier-summary-list">
                <div>
                  <dt>Bakiye</dt>
                  <dd className="customer-payable">{formatMoney(form.balance, form.currency)}</dd>
                </div>
                <div>
                  <dt>Alis fisi</dt>
                  <dd>{summary.purchaseCount}</dd>
                </div>
                <div>
                  <dt>Alis toplami</dt>
                  <dd>{formatMoney(summary.purchaseTotal, form.currency)}</dd>
                </div>
                <div>
                  <dt>Odeme</dt>
                  <dd>{formatMoney(summary.paymentTotal, form.currency)}</dd>
                </div>
                <div>
                  <dt>Iptal hareketi</dt>
                  <dd>{summary.cancelCount}</dd>
                </div>
                <div>
                  <dt>Son alis</dt>
                  <dd>{form.lastPurchaseDate ? String(form.lastPurchaseDate).slice(0, 10) : '-'}</dd>
                </div>
              </dl>
            </aside>
          </section>

          <section className="erp-panel supplier-movements-panel">
            <div className="panel-title">
              <strong>Alis / Odeme Hareketleri</strong>
              <span>Alis fisleri kesinlesince tedarikci kartini besler</span>
            </div>
            {form.movements.length === 0 ? (
              <div className="list-state">Bu tedarikci icin hareket yok.</div>
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
                      <th>Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.movements.map((row) => (
                      <tr key={row.id} className={row.type === 'purchase_invoice_cancel' ? 'cancel-row' : ''}>
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
                            <button type="button" onClick={() => openPurchaseInvoice(row)}>Fise Git</button>
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
            <span>Tedarikci: {form.supplierCode || 'Yeni'}</span>
            <span>Bakiye: {formatMoney(form.balance, form.currency)}</span>
            <span>Alis iskonto: %{Number(form.purchaseDiscountRate || 0)}</span>
            <span>{isDirty ? 'Degisti' : 'Temiz'}</span>
            <span>Kaynak: API / SQL</span>
          </section>
        </>
      )}
    </main>
  );
}
