import React from 'react';

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function movementLabel(row) {
  if (row.sourceType === 'sales_invoice') return 'Satis';
  if (row.sourceType === 'purchase_invoice') return 'Alis';
  return row.movementType || 'Hareket';
}

function partyLabel(row) {
  return row.customerName || row.supplierName || '-';
}

function quantityLabel(row) {
  if (Number(row.quantityOut || 0) > 0) return `-${Number(row.quantityOut || 0)}`;
  if (Number(row.quantityIn || 0) > 0) return `+${Number(row.quantityIn || 0)}`;
  return Number(row.quantityNet || 0);
}

export function ProductStockUsagePanel({ isLoading, movements, onOpenMovement }) {
  return (
    <section className="erp-panel product-stock-usage-panel">
      <div className="panel-title">
        <strong>Stok Fis Kullanimi</strong>
        <span>Satis / alis fisleri, cari/tedarikci ve adet/fiyat izi</span>
      </div>
      {isLoading ? (
        <div className="list-state">Urun hareketleri yukleniyor...</div>
      ) : null}
      {!isLoading && movements.length === 0 ? (
        <div className="list-state list-state-passive">Bu urun icin kayitli fis hareketi bulunamadi.</div>
      ) : null}
      {!isLoading && movements.length > 0 ? (
        <div className="table-wrap product-stock-usage-wrap">
          <table className="product-stock-usage-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Fis No</th>
                <th>Cari / Kaynak</th>
                <th>Adet</th>
                <th>Birim Fiyat</th>
                <th>TRY Tutar</th>
                <th>Stok Etkisi</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr className="clickable-row" key={row.id} onClick={() => onOpenMovement(row)}>
                  <td>{row.documentDate || '-'}</td>
                  <td>{movementLabel(row)}</td>
                  <td className="code-cell">{row.sourceDocumentNo || '-'}</td>
                  <td>{partyLabel(row)}</td>
                  <td className={Number(row.quantityOut || 0) > 0 ? 'out-cell' : 'in-cell'}>{quantityLabel(row)}</td>
                  <td className="money-cell">{row.unitPrice === null ? '-' : formatMoney(row.unitPrice, row.currency || 'TRY')}</td>
                  <td className="money-cell">{formatMoney(row.amountTry, 'TRY')}</td>
                  <td>{Number(row.quantityNet || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
