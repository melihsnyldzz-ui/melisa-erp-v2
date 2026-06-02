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
  }), { quantity: 0, amountTry: 0 });

  return (
    <section className="erp-panel linked-trace-panel supplier-product-trace-panel">
      <div className="panel-title">
        <strong>Alinan Urunler / Stok Girisleri</strong>
        <span>Tedarikciden urune, fisten karta tek tik izleme</span>
      </div>
      <div className="trace-summary-strip">
        <span><b>{rows.length}</b> satir</span>
        <span className="in-cell"><b>{summary.quantity}</b> adet giris</span>
        <span><b>{formatMoney(summary.amountTry, 'TRY')}</b> net maliyet TRY</span>
      </div>
      {rows.length === 0 ? (
        <div className="list-state">Bu tedarikciden kesinlesmis urun alis izi yok.</div>
      ) : (
        <div className="table-wrap linked-trace-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Fis</th>
                <th>Stok kodu</th>
                <th>Urun</th>
                <th>Adet</th>
                <th>Alis fiyat</th>
                <th>Isk %</th>
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
                    <button type="button" className="link-button" onClick={() => onOpenInvoice?.(row)}>
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
                    <button type="button" className="mini-button" onClick={() => onOpenProduct?.(row)}>Urun</button>
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
