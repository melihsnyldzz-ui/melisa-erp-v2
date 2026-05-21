import React from 'react';

export function ProductBarcodePanel({ barcodes }) {
  return (
    <section className="erp-panel product-barcode-panel">
      <div className="panel-title">
        <strong>Diğer Barkodlar</strong>
        <span>Aynı ana ürün stoğuna bağlı</span>
      </div>
      <div className="product-panel-actions">
        <button type="button">Manuel Ekle</button>
        <button type="button">Sil</button>
      </div>
      <div className="product-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Barkod</th>
              <th>Tip</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {barcodes.map((barcode) => (
              <tr key={barcode.id}>
                <td className="code-cell">{barcode.barcode}</td>
                <td>{barcode.type}</td>
                <td className={barcode.status === 'Pasif' ? 'status-passive' : 'status-active'}>{barcode.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
