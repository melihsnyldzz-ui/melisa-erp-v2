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
  invoiceRate = 0,
  supplierRate = 0,
  exchangeRate = 1,
  invoiceCurrency = 'TRY',
  selectedItemId,
  onDeleteItem,
  onSelectItem,
  onUpdateItem,
}) {
  const afterLineDiscounts = items.reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
    return sum + (gross - gross * (Number(item.lineDiscountRate || 0) / 100));
  }, 0);
  const invoiceDiscountTotal = afterLineDiscounts * (Number(invoiceRate || 0) / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountTotal;
  const supplierDiscountTotal = afterInvoiceDiscount * (Number(supplierRate || 0) / 100);
  const rate = Number(exchangeRate || 1);

  function netLineCostTry(lineTotal) {
    const share = afterLineDiscounts > 0 ? lineTotal / afterLineDiscounts : 0;
    const invoiceShare = invoiceDiscountTotal * share;
    const afterInvoiceShare = lineTotal - invoiceShare;
    const supplierShare = supplierDiscountTotal * (afterInvoiceDiscount > 0 ? afterInvoiceShare / afterInvoiceDiscount : share);
    return (afterInvoiceShare - supplierShare) * rate;
  }

  return (
    <section className="erp-panel purchase-items-panel">
      <div className="panel-title">
        <strong>Ürün Satırları</strong>
        <span>Satır bazlı iskonto / {invoiceCurrency} belge maliyeti / stok giriş etkisi</span>
      </div>
      <div className="table-wrap purchase-items-wrap">
        <table className="purchase-items-table">
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Barkod</th>
              <th>Ürün adı</th>
              <th>Miktar</th>
              <th>Para birimi</th>
              <th>Alış fiyatı</th>
              <th>Satır iskonto %</th>
              <th>Satır toplamı</th>
              <th>Net maliyet TRY</th>
              <th>Birim maliyet TRY</th>
              <th>Stok etkisi</th>
              <th>Not</th>
              {!isReadonly && <th>İşlem</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const gross = item.quantity * item.purchasePrice;
              const lineTotal = gross - gross * (item.lineDiscountRate / 100);
              const lineCostTry = netLineCostTry(lineTotal);
              const unitCostTry = Number(item.quantity || 0) > 0 ? lineCostTry / Number(item.quantity || 0) : 0;

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
                  <td className="money-cell purchase-cost-try">{formatMoney(lineCostTry, 'TRY')}</td>
                  <td className="money-cell purchase-cost-try">{formatMoney(unitCostTry, 'TRY')}</td>
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
