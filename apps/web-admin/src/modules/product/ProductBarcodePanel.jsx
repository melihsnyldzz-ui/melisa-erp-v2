import React, { useState } from 'react';

function typeLabel(type) {
  const labels = {
    primary: 'Ana barkod',
    extra: 'Ek barkod',
    package: 'Paket barkod',
  };

  return labels[type] || type || '-';
}

export function ProductBarcodePanel({
  barcodes,
  canEdit = false,
  disabled = false,
  onAddBarcode,
  onToggleBarcode,
}) {
  const [barcode, setBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState('extra');
  const [isPrimary, setIsPrimary] = useState(false);

  async function addBarcode(event) {
    event.preventDefault();
    if (!barcode.trim() || disabled || !canEdit) {
      return;
    }

    await onAddBarcode?.({
      barcode: barcode.trim(),
      type: barcodeType,
      isPrimary,
    });
    setBarcode('');
    setBarcodeType('extra');
    setIsPrimary(false);
  }

  return (
    <section className="erp-panel product-barcode-panel">
      <div className="panel-title">
        <strong>Diğer Barkodlar</strong>
        <span>Aynı ana ürün stok kartına bağlı barkodlar</span>
      </div>

      <form className="filter-grid" onSubmit={addBarcode}>
        <label>
          Barkod
          <input
            disabled={disabled || !canEdit}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Barkod / koli barkodu"
          />
        </label>
        <label>
          Tip
          <select disabled={disabled || !canEdit} value={barcodeType} onChange={(event) => setBarcodeType(event.target.value)}>
            <option value="extra">Ek barkod</option>
            <option value="package">Paket barkod</option>
            <option value="primary">Ana barkod</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            checked={isPrimary}
            disabled={disabled || !canEdit}
            type="checkbox"
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          Ana barkod yap
        </label>
        <button disabled={disabled || !canEdit || !barcode.trim()} type="submit">Barkod Ekle</button>
      </form>

      <div className="product-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Barkod</th>
              <th>Tip</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {barcodes.length === 0 && (
              <tr>
                <td colSpan="4">Bu ürüne bağlı barkod yok.</td>
              </tr>
            )}
            {barcodes.map((item) => (
              <tr key={item.id}>
                <td className="code-cell">{item.barcode}</td>
                <td>{typeLabel(item.type)}{item.isPrimary ? ' / Ana' : ''}</td>
                <td className={item.status === 'Pasif' ? 'status-passive' : 'status-active'}>{item.status}</td>
                <td>
                  <button
                    disabled={disabled || !canEdit}
                    type="button"
                    onClick={() => onToggleBarcode?.(item.id, item.isActive)}
                  >
                    {item.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
