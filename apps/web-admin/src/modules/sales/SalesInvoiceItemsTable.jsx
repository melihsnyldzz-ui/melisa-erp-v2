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

export function SalesInvoiceItemsTable({
  exchangeRate = 1,
  invoiceCurrency = 'TRY',
  items,
  onAdjustQuantity,
  selectedItemId,
  onDeleteItem,
  onOpenProduct,
  onSelectItem,
  onUpdateItem,
  showProfitColumns = false,
  isReadonly = false,
}) {
  return (
    <section className="erp-panel sales-items-panel">
      <div className="panel-title">
        <strong>Ürün Satırları</strong>
        <span>{items.length} satır</span>
      </div>
      <div className="table-wrap sales-items-wrap">
        <table className="sales-items-table">
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Barkod</th>
              <th>Ürün adı</th>
              <th>Miktar</th>
              <th>Para birimi</th>
              <th>Birim fiyat</th>
              <th>Satır toplamı</th>
              {showProfitColumns && <th>Net maliyet</th>}
              {showProfitColumns && <th>Net kâr</th>}
              {showProfitColumns && <th>TRY kâr</th>}
              {showProfitColumns && <th>Kâr %</th>}
              <th>Stok durumu</th>
              {!isReadonly && <th>İşlem</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lineTotal = item.quantity * item.unitPrice;
              const rate = Number(exchangeRate || 1);
              const costInInvoiceCurrency = rate > 0 ? Number(item.averageCostTry || 0) / rate : 0;
              const profitInInvoiceCurrency = rate > 0 ? Number(item.grossProfitTry || 0) / rate : 0;
              const profitClassName = Number(item.grossProfitTry || 0) < 0 ? 'negative' : 'positive';
              return (
                <tr
                  key={item.id}
                  className={item.id === selectedItemId ? 'selected' : ''}
                  onClick={() => onSelectItem(item.id)}
                >
                  <td className="code-cell">{item.stockCode}</td>
                  <td>{item.barcode}</td>
                  <td className="invoice-product-cell">
                    <strong>{item.productName}</strong>
                    <small>{item.stockCode} / {item.barcode}</small>
                  </td>
                  <td className="money-cell invoice-quantity-cell out-cell">
                    {isReadonly ? item.quantity : (
                      <input
                        min="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => onUpdateItem(item.id, 'quantity', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td><span className="currency-pill">{item.currency}</span></td>
                  <td className="money-cell invoice-price-cell">
                    {isReadonly ? formatMoney(item.unitPrice, item.currency) : (
                      <input
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={item.unitPrice}
                        onChange={(event) => onUpdateItem(item.id, 'unitPrice', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td className="money-cell invoice-total-cell">{formatMoney(lineTotal, item.currency)}</td>
                  {showProfitColumns && <td className="money-cell">{formatMoney(costInInvoiceCurrency, invoiceCurrency)}</td>}
                  {showProfitColumns && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatMoney(profitInInvoiceCurrency, invoiceCurrency)}</td>}
                  {showProfitColumns && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatMoney(item.grossProfitTry || 0, 'TRY')}</td>}
                  {showProfitColumns && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatPercent(item.grossProfitRate || 0)}</td>}
                  <td>
                    <span className={item.stockState === 'Eksiye duser' ? 'sales-stock-pill risk' : 'sales-stock-pill'}>
                      {item.stockState}
                    </span>
                  </td>
                  {!isReadonly && (
                    <td className="row-action-cell">
                      <div className="row-actions">
                        <button aria-label="Adet azalt" type="button" onClick={() => onAdjustQuantity?.(item.id, -1)}>-</button>
                        <button aria-label="Adet artır" type="button" onClick={() => onAdjustQuantity?.(item.id, 1)}>+</button>
                        <button type="button" onClick={() => onOpenProduct?.(item.productId, item.stockCode)}>Kart</button>
                        <button type="button" onClick={() => onDeleteItem(item.id)}>Sil</button>
                      </div>
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
