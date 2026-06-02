import React from 'react';

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function CustomerProductTracePanel({ rows = [], onOpenInvoice, onOpenProduct }) {
  const summary = rows.reduce((total, row) => ({
    quantity: total.quantity + Number(row.quantity || 0),
    amountTry: total.amountTry + Number(row.lineTotalTry || 0),
    profitTry: total.profitTry + Number(row.grossProfitTry || 0),
  }), { quantity: 0, amountTry: 0, profitTry: 0 });

  return (
    <section className="linked-trace-panel customer-product-trace-panel">
      <div className="panel-title">
        <strong>Satilan Urunler / Stok Cikislari</strong>
        <span>Musteriden urune, fisten karta tek tik izleme</span>
      </div>
      <div className="trace-summary-strip">
        <span><b>{rows.length}</b> satir</span>
        <span className="out-cell"><b>{summary.quantity}</b> adet cikis</span>
        <span><b>{formatMoney(summary.amountTry, 'TRY')}</b> satis TRY</span>
        <span><b>{formatMoney(summary.profitTry, 'TRY')}</b> net kar TRY</span>
      </div>
      {rows.length === 0 ? (
        <div className="list-state">Bu musteriye ait kesinlesmis urun satis izi yok.</div>
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
                <th>Birim fiyat</th>
                <th>Satis TRY</th>
                <th>Kar TRY</th>
                <th>Kar %</th>
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
                  <td className="out-cell">-{row.quantity}</td>
                  <td className="money-cell">{formatMoney(row.unitPrice, row.currency)}</td>
                  <td className="money-cell">{formatMoney(row.lineTotalTry, 'TRY')}</td>
                  <td className="money-cell">{row.grossProfitTry === null ? '-' : formatMoney(row.grossProfitTry, 'TRY')}</td>
                  <td>{formatPercent(row.grossProfitRate)}</td>
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
