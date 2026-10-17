import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, LoaderCircle, X } from 'lucide-react';
import { applyProductBulkUpdate, previewProductBulkUpdate } from '../../services/productDetailApi.js';

const emptyChanges = {
  brand: { enabled: false, value: '' },
  category: { enabled: false, value: '' },
  supplier: { enabled: false, id: '' },
  productName: { enabled: false, mode: 'find_replace', find: '', value: '' },
};

const fieldLabels = {
  productName: 'Ürün adı',
  brand: 'Marka',
  category: 'Kategori',
  supplierId: 'Ana tedarikçi',
};

function FieldToggle({ checked, label, onChange, children }) {
  return (
    <div className={checked ? 'bulk-update-field enabled' : 'bulk-update-field'}>
      <label className="bulk-update-field-toggle">
        <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>{label}</span>
      </label>
      <div className="bulk-update-field-control">{children}</div>
    </div>
  );
}

export function BulkProductUpdateDialog({ productIds, suggestions, onClose, onApplied }) {
  const [changes, setChanges] = useState(emptyChanges);
  const [preview, setPreview] = useState(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const enabledCount = useMemo(() => Object.values(changes).filter((field) => field.enabled).length, [changes]);
  const canApply = preview?.changedCount > 0
    && confirmationCode === preview.confirmationCode
    && !isApplying;

  function updateField(field, patch) {
    setChanges((current) => ({
      ...current,
      [field]: { ...current[field], ...patch },
    }));
    setPreview(null);
    setConfirmationCode('');
    setErrorMessage('');
  }

  async function handlePreview() {
    setIsPreviewing(true);
    setErrorMessage('');
    try {
      const response = await previewProductBulkUpdate({ productIds, changes });
      setPreview(response.data);
    } catch (error) {
      setPreview(null);
      setErrorMessage(error.message || 'Toplu değişiklik önizlenemedi.');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleApply() {
    if (!canApply) return;

    setIsApplying(true);
    setErrorMessage('');
    try {
      const response = await applyProductBulkUpdate({ productIds, changes, confirmationCode });
      onApplied(response.data);
    } catch (error) {
      setErrorMessage(error.message || 'Toplu değişiklik uygulanamadı.');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="bulk-update-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isApplying) onClose();
    }}>
      <section aria-labelledby="bulk-update-title" aria-modal="true" className="bulk-update-dialog" role="dialog">
        <header className="bulk-update-header">
          <div>
            <h2 id="bulk-update-title">Toplu ürün düzenleme</h2>
            <p>{productIds.length} seçili ürün üzerinde yalnızca işaretlediğiniz alanlar değişir.</p>
          </div>
          <button aria-label="Pencereyi kapat" className="icon-button" disabled={isApplying} onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="bulk-update-protected">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>Stok miktarı, barkod, fiyat ve para birimi bu işlemde korunur.</span>
        </div>

        <div className="bulk-update-fields">
          <FieldToggle checked={changes.category.enabled} label="Kategori değiştir" onChange={(enabled) => updateField('category', { enabled })}>
            <input disabled={!changes.category.enabled} list="bulk-category-options" onChange={(event) => updateField('category', { value: event.target.value })} placeholder="Yeni kategori" value={changes.category.value} />
            <datalist id="bulk-category-options">{suggestions.categories.map((value) => <option key={value} value={value} />)}</datalist>
          </FieldToggle>

          <FieldToggle checked={changes.brand.enabled} label="Marka değiştir" onChange={(enabled) => updateField('brand', { enabled })}>
            <input disabled={!changes.brand.enabled} list="bulk-brand-options" onChange={(event) => updateField('brand', { value: event.target.value })} placeholder="Yeni marka" value={changes.brand.value} />
            <datalist id="bulk-brand-options">{suggestions.brands.map((value) => <option key={value} value={value} />)}</datalist>
          </FieldToggle>

          <FieldToggle checked={changes.supplier.enabled} label="Ana tedarikçi değiştir" onChange={(enabled) => updateField('supplier', { enabled })}>
            <select disabled={!changes.supplier.enabled} onChange={(event) => updateField('supplier', { id: event.target.value })} value={changes.supplier.id}>
              <option value="">Tedarikçi seçin</option>
              {suggestions.supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.label}</option>)}
            </select>
          </FieldToggle>

          <FieldToggle checked={changes.productName.enabled} label="Ürün adı içeriğini değiştir" onChange={(enabled) => updateField('productName', { enabled })}>
            <div className="bulk-name-controls">
              <select disabled={!changes.productName.enabled} onChange={(event) => updateField('productName', { mode: event.target.value })} value={changes.productName.mode}>
                <option value="find_replace">Metin bul ve değiştir</option>
                <option value="prefix">Başına ekle</option>
                <option value="suffix">Sonuna ekle</option>
              </select>
              {changes.productName.mode === 'find_replace' && (
                <input disabled={!changes.productName.enabled} onChange={(event) => updateField('productName', { find: event.target.value })} placeholder="Bulunacak metin" value={changes.productName.find} />
              )}
              <input disabled={!changes.productName.enabled} onChange={(event) => updateField('productName', { value: event.target.value })} placeholder={changes.productName.mode === 'find_replace' ? 'Yeni metin' : 'Eklenecek metin'} value={changes.productName.value} />
            </div>
          </FieldToggle>
        </div>

        {errorMessage && <div className="bulk-update-error">{errorMessage}</div>}

        {preview && (
          <section className="bulk-update-preview">
            <div className="bulk-update-preview-summary">
              <strong>Önizleme</strong>
              <span>{preview.changedCount} değişecek</span>
              <span>{preview.unchangedCount} aynı kalacak</span>
            </div>
            <div className="bulk-update-preview-list">
              {preview.rows.slice(0, 50).map((row) => (
                <div className={row.willChange ? '' : 'unchanged'} key={row.id}>
                  <b>{row.stockCode}</b>
                  <span>{row.willChange ? row.changedFields.map((field) => fieldLabels[field]).join(', ') : 'Değişiklik yok'}</span>
                </div>
              ))}
            </div>
            {preview.rows.length > 50 && <small>İlk 50 ürün gösteriliyor. Toplam {preview.rows.length} ürün kontrol edildi.</small>}
            {preview.changedCount > 0 && (
              <label className="bulk-update-confirmation">
                <span>Uygulamak için <b>{preview.confirmationCode}</b> yazın</span>
                <input autoComplete="off" onChange={(event) => setConfirmationCode(event.target.value)} value={confirmationCode} />
              </label>
            )}
          </section>
        )}

        <footer className="bulk-update-actions">
          <button disabled={isApplying} onClick={onClose} type="button">Vazgeç</button>
          <button disabled={enabledCount === 0 || isPreviewing || isApplying} onClick={handlePreview} type="button">
            {isPreviewing ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : null}
            Önizle
          </button>
          <button className="primary-action" disabled={!canApply} onClick={handleApply} type="button">
            {isApplying ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Check aria-hidden="true" size={16} />}
            Değişiklikleri uygula
          </button>
        </footer>
      </section>
    </div>
  );
}
