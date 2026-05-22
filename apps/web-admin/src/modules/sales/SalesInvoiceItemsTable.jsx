import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function SalesInvoiceItemsTable({ items, selectedItemId, onSelectItem, showProfitColumns = false }) {
  return (
    <section className="erp-panel sales-items-panel">
      <div className="panel-title">
        <strong>Urun Satirlari</strong>
        <span>Satir: {items.length} / sticky header / kompakt giris / maliyet snapshot</span>
      </div>
      <div className="table-wrap sales-items-wrap">
        <table className="sales-items-table">
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Barkod</th>
              <th>Urun adi</th>
              <th>Miktar</th>
              <th>Para birimi</th>
              <th>Birim fiyat</th>
              <th>Satir toplami</th>
              {showProfitColumns && <th>Maliyet TRY</th>}
              {showProfitColumns && <th>Brut kar</th>}
              {showProfitColumns && <th>Kar %</th>}
              <th>Stok durumu</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lineTotal = item.quantity * item.unitPrice;
              return (
                <tr
                  key={item.id}
                  className={item.id === selectedItemId ? 'selected' : ''}
                  onClick={() => onSelectItem(item.id)}
                >
                  <td className="code-cell">{item.stockCode}</td>
                  <td>{item.barcode}</td>
                  <td>{item.productName}</td>
                  <td className="money-cell">{item.quantity}</td>
                  <td>{item.currency}</td>
                  <td className="money-cell">{formatMoney(item.unitPrice, item.currency)}</td>
                  <td className="money-cell">{formatMoney(lineTotal, item.currency)}</td>
                  {showProfitColumns && <td className="money-cell">{formatMoney(item.averageCostTry || 0, 'TRY')}</td>}
                  {showProfitColumns && <td className="money-cell">{formatMoney(item.grossProfitTry || 0, 'TRY')}</td>}
                  {showProfitColumns && <td className="money-cell">{formatPercent(item.grossProfitRate || 0)}</td>}
                  <td className={item.stockState === 'Eksiye duser' ? 'sales-stock-risk' : ''}>{item.stockState}</td>
                  <td>{item.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
