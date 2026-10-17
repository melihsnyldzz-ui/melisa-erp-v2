import React, { useState } from 'react';

function localDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tarih okunamadı' : date.toLocaleString('tr-TR');
}

export function ProductSupplierModelPanel({
  mappings = [],
  supplierOptions = [],
  canEdit = false,
  disabled = false,
  onAdd,
  onToggle,
}) {
  const [supplierId, setSupplierId] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!supplierId || !modelCode.trim() || !canEdit || disabled) return;
    await onAdd?.({ supplierId: Number(supplierId), supplierModelCode: modelCode.trim(), isPrimary });
    setModelCode('');
    setIsPrimary(false);
  }

  return (
    <section className="erp-panel product-supplier-model-panel" aria-label="Tedarikçi model eşleştirmesi">
      <div className="panel-title">
        <strong>Tedarikçi / Model Eşleştirmesi</strong>
        <span>Geçmiş korunur; aynı tedarikçi ve modelde tek aktif ürün</span>
      </div>
      <form className="filter-grid product-model-form" onSubmit={submit}>
        <label>
          Tedarikçi
          <select disabled={disabled || !canEdit} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Tedarikçi seçin</option>
            {supplierOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Kayıtlı model kodu
          <input disabled={disabled || !canEdit} value={modelCode} onChange={(event) => setModelCode(event.target.value)} placeholder="Örn. 0007-A" />
        </label>
        <label className="product-model-primary">
          <input checked={isPrimary} disabled={disabled || !canEdit} onChange={(event) => setIsPrimary(event.target.checked)} type="checkbox" />
          Ana bağlantı
        </label>
        <button disabled={disabled || !canEdit || !supplierId || !modelCode.trim()} type="submit">Bağlantı ekle</button>
      </form>
      <div className="product-table-wrap">
        <table>
          <thead><tr><th>Tedarikçi</th><th>Model</th><th>Tür</th><th>Geçerlilik</th><th>Durum</th><th>İşlem</th></tr></thead>
          <tbody>
            {mappings.length === 0 && <tr><td colSpan="6">Bu ürün için eşleştirme geçmişi yok.</td></tr>}
            {mappings.map((item) => (
              <tr key={item.id}>
                <td>{item.supplierCode ? `${item.supplierCode} / ` : ''}{item.supplierName || item.supplierId}</td>
                <td className="code-cell">{item.modelCode}</td>
                <td>{item.isPrimary ? 'Ana' : 'İkincil'}</td>
                <td>{localDate(item.validFrom)} → {localDate(item.validTo)}</td>
                <td className={item.isActive ? 'status-active' : 'status-passive'}>{item.isActive ? 'Aktif' : 'Pasif'}</td>
                <td><button disabled={disabled || !canEdit} onClick={() => onToggle?.(item)} type="button">{item.isActive ? 'Pasife al' : 'Yeniden etkinleştir'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
