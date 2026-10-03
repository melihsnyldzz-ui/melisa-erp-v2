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

  async function addBarcode(event) {
    event.preventDefault();
    if (!barcode.trim() || disabled || !canEdit) {
      return;
    }

    await onAddBarcode?.({
      barcode: barcode.trim(),
      type: 'extra',
      isPrimary: false,
    });
    setBarcode('');
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
          <input disabled readOnly value="Alternatif barkod" />
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
                    disabled={disabled || !canEdit || item.isPrimary || item.type !== 'extra'}
                    type="button"
                    onClick={() => onToggleBarcode?.(item.id, item.isActive)}
                    title={item.isPrimary || item.type !== 'extra' ? 'Bu görev yalnız alternatif barkodları değiştirir.' : undefined}
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
