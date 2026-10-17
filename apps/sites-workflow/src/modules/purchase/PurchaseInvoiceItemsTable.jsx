import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

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
  const [showCostDetails, setShowCostDetails] = useState(false);
  const afterLineDiscounts = items.reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
    return sum + (gross - gross * (Number(item.lineDiscountRate || 0) / 100));
  }, 0);
  const invoiceDiscountTotal = afterLineDiscounts * (Number(invoiceRate || 0) / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountTotal;
  const supplierDiscountTotal = afterInvoiceDiscount * (Number(supplierRate || 0) / 100);
  const rate = Number(exchangeRate || 1);

  function lineCostBreakdown(lineTotal, quantity) {
    const share = afterLineDiscounts > 0 ? lineTotal / afterLineDiscounts : 0;
    const invoiceShare = invoiceDiscountTotal * share;
    const afterInvoiceShare = lineTotal - invoiceShare;
    const supplierShare = supplierDiscountTotal * (afterInvoiceDiscount > 0 ? afterInvoiceShare / afterInvoiceDiscount : share);
    const documentDiscountShare = invoiceShare + supplierShare;
    const netLineTotal = afterInvoiceShare - supplierShare;

    return {
      documentDiscountShare,
      netLineTotal,
      netUnitPrice: Number(quantity || 0) > 0 ? netLineTotal / Number(quantity) : 0,
      netLineCostTry: netLineTotal * rate,
    };
  }

  return (
    <section className="erp-panel purchase-items-panel">
      <div className="panel-title">
        <strong>Ürünler</strong>
        <span>{items.length} satır / {invoiceCurrency}</span>
        <button className="invoice-table-detail-toggle" type="button" onClick={() => setShowCostDetails((current) => !current)}>
          {showCostDetails ? 'Maliyetleri Gizle' : 'Maliyet Detayı'}
        </button>
      </div>
      <div className="table-wrap purchase-items-wrap">
        <table className={showCostDetails ? 'purchase-items-table show-cost-details' : 'purchase-items-table'}>
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Ürün adı</th>
              <th>Barkod</th>
              <th>Miktar</th>
              <th>Liste alış</th>
              <th>Satır iskonto %</th>
              <th title="Fiş geneli ve tedarikçi iskontosunun bu satıra düşen payı">Fiş isk. payı</th>
              <th>Net alış</th>
              <th>Net satır</th>
              {showCostDetails && <th>Net maliyet TRY</th>}
              {showCostDetails && <th>Birim maliyet TRY</th>}
              <th>Stok etkisi</th>
              {!isReadonly && <th>İşlem</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const gross = item.quantity * item.purchasePrice;
              const lineTotal = gross - gross * (item.lineDiscountRate / 100);
              const cost = lineCostBreakdown(lineTotal, item.quantity);
              const unitCostTry = Number(item.quantity || 0) > 0 ? cost.netLineCostTry / Number(item.quantity || 0) : 0;

              return (
                <tr
                  key={item.id}
                  className={item.id === selectedItemId ? 'selected' : ''}
                  onClick={() => onSelectItem(item.id)}
                >
                  <td className="code-cell">{item.stockCode}</td>
                  <td className="invoice-product-cell">
                    <strong>{item.productName}</strong>
                  </td>
                  <td className="invoice-barcode-cell">{item.barcode || '-'}</td>
                  <td className="money-cell invoice-quantity-cell in-cell">
                    {isReadonly ? item.quantity : (
                      <input
                        min="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => onUpdateItem(item.id, 'quantity', Number(event.target.value || 0))}
                      />
                    )}
                  </td>
                  <td className="money-cell invoice-price-cell">
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
                  <td className="money-cell invoice-discount-cell">
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
                  <td className="money-cell invoice-discount-cell">{formatMoney(cost.documentDiscountShare, item.currency)}</td>
                  <td className="money-cell purchase-net-unit-price">{formatMoney(cost.netUnitPrice, item.currency)}</td>
                  <td className="money-cell invoice-total-cell">{formatMoney(cost.netLineTotal, item.currency)}</td>
                  {showCostDetails && <td className="money-cell purchase-cost-try">{formatMoney(cost.netLineCostTry, 'TRY')}</td>}
                  {showCostDetails && <td className="money-cell purchase-cost-try">{formatMoney(unitCostTry, 'TRY')}</td>}
                  <td><span className="purchase-stock-in">{item.stockEffect}</span></td>
                  {!isReadonly && (
                    <td>
                      <button className="invoice-row-icon-button" aria-label="Satırı sil" title="Satırı sil" type="button" onClick={() => onDeleteItem(item.id)}><Trash2 size={14} /></button>
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
