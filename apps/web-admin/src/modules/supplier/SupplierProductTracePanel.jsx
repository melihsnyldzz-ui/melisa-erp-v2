import React from 'react';

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function SupplierProductTracePanel({ rows = [], onOpenInvoice, onOpenProduct }) {
  const summary = rows.reduce((total, row) => ({
    quantity: total.quantity + Number(row.quantity || 0),
    amountTry: total.amountTry + Number(row.lineTotalTry || 0),
    discountTry: total.discountTry + Math.max(0, (Number(row.purchasePrice || 0) * Number(row.quantity || 0) * (Number(row.lineDiscountRate || 0) / 100)) * (Number(row.lineTotalTry || 0) > 0 && Number(row.lineTotal || 0) > 0 ? Number(row.lineTotalTry || 0) / Number(row.lineTotal || 0) : 1)),
    cancelled: total.cancelled + (row.invoiceStatus === 'cancelled' ? 1 : 0),
  }), { quantity: 0, amountTry: 0, discountTry: 0, cancelled: 0 });

  return (
    <section className="erp-panel linked-trace-panel supplier-product-trace-panel">
      <div className="panel-title">
        <strong>Alınan Ürünler / Stok Girişleri</strong>
        <span>Tedarikçiden ürüne, fişten karta tek tık izleme</span>
      </div>
      <div className="trace-summary-strip">
        <span><b>{rows.length}</b> satır</span>
        <span className="in-cell"><b>{summary.quantity}</b> adet giriş</span>
        <span><b>{formatMoney(summary.amountTry, 'TRY')}</b> net maliyet TRY</span>
        <span><b>{formatMoney(summary.discountTry, 'TRY')}</b> iskonto etkisi</span>
        {summary.cancelled > 0 && <span className="cancelled-ledger-badge"><b>{summary.cancelled}</b> iptal izi</span>}
      </div>
      {rows.length === 0 ? (
        <div className="list-state">Bu tedarikçiden kesinleşmiş ürün alış izi yok.</div>
      ) : (
        <div className="table-wrap linked-trace-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Fiş</th>
                <th>Stok kodu</th>
                <th>Ürün</th>
                <th>Adet</th>
                <th>Alış fiyat</th>
                <th>İsk %</th>
                <th>Net TRY</th>
                <th>Birim maliyet TRY</th>
                <th>Git</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.invoiceStatus === 'cancelled' ? 'cancel-row' : ''}>
                  <td>{row.documentDate || '-'}</td>
                  <td>
                    <button type="button" className="document-link-button" onClick={() => onOpenInvoice?.(row)}>
                      {row.documentNo}
                    </button>
                  </td>
                  <td className="code-cell">{row.stockCode}</td>
                  <td>{row.productName}</td>
                  <td className="in-cell">+{row.quantity}</td>
                  <td className="money-cell">{formatMoney(row.purchasePrice, row.currency)}</td>
                  <td>%{Number(row.lineDiscountRate || 0)}</td>
                  <td className="money-cell">{formatMoney(row.lineTotalTry, 'TRY')}</td>
                  <td className="money-cell">{formatMoney(row.netUnitCostTry, 'TRY')}</td>
                  <td>
                    <button type="button" className="mini-button ghost" onClick={() => onOpenProduct?.(row)}>Ürün</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
