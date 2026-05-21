import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PurchaseInvoiceItemsTable({ items, selectedItemId, onSelectItem }) {
  return (
    <section className="erp-panel purchase-items-panel">
      <div className="panel-title">
        <strong>Urun Satirlari</strong>
        <span>Satir bazli iskonto / stok giris etkisi</span>
      </div>
      <div className="table-wrap purchase-items-wrap">
        <table className="purchase-items-table">
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Barkod</th>
              <th>Urun adi</th>
              <th>Miktar</th>
              <th>Para birimi</th>
              <th>Alis fiyati</th>
              <th>Satir iskonto %</th>
              <th>Satir toplami</th>
              <th>Stok etkisi</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const gross = item.quantity * item.purchasePrice;
              const lineTotal = gross - gross * (item.lineDiscountRate / 100);

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
                  <td className="money-cell">{formatMoney(item.purchasePrice, item.currency)}</td>
                  <td className="money-cell">%{item.lineDiscountRate}</td>
                  <td className="money-cell">{formatMoney(lineTotal, item.currency)}</td>
                  <td className="purchase-stock-in">{item.stockEffect}</td>
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
