import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PurchaseInvoiceItemsTable({
  isReadonly = false,
  items,
  selectedItemId,
  onDeleteItem,
  onSelectItem,
  onUpdateItem,
}) {
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
              {!isReadonly && <th>Islem</th>}
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
                  <td className="money-cell">
                    {isReadonly ? item.quantity : (
                      <input
                        min="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => onUpdateItem(item.id, 'quantity', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td>{item.currency}</td>
                  <td className="money-cell">
                    {isReadonly ? formatMoney(item.purchasePrice, item.currency) : (
                      <input
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={item.purchasePrice}
                        onChange={(event) => onUpdateItem(item.id, 'purchasePrice', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td className="money-cell">
                    {isReadonly ? `%${item.lineDiscountRate}` : (
                      <input
                        min="0"
                        max="100"
                        type="number"
                        value={item.lineDiscountRate}
                        onChange={(event) => onUpdateItem(item.id, 'lineDiscountRate', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td className="money-cell">{formatMoney(lineTotal, item.currency)}</td>
                  <td className="purchase-stock-in">{item.stockEffect}</td>
                  <td>{item.note}</td>
                  {!isReadonly && (
                    <td>
                      <button type="button" onClick={() => onDeleteItem(item.id)}>Sil</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
