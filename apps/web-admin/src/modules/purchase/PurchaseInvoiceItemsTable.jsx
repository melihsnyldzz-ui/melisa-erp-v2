import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { purchaseStockEffectLabel } from '../../utils/purchasePreparation.js';

function formatMoney(amount, currency) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PurchaseInvoiceItemsTable({
  isReadonly = false,
  items,
  lineCosts = [],
  invoiceRate = 0,
  supplierRate = 0,
  exchangeRate = 1,
  invoiceCurrency = 'TRY',
  invoiceStatus = 'DRAFT',
  isCorrectionMode = false,
  selectedItemId,
  onDeleteItem,
  onSelectItem,
  onUpdateItem,
}) {
  const [showCostDetails, setShowCostDetails] = useState(false);

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
            {items.map((item, index) => {
              const cost = lineCosts[index] || {};
              const unitCostTry = cost.unitCostTry;

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
                  {showCostDetails && <td className="money-cell purchase-cost-try">{formatMoney(cost.lineTotalTry, 'TRY')}</td>}
                  {showCostDetails && <td className="money-cell purchase-cost-try">{formatMoney(unitCostTry, 'TRY')}</td>}
                  <td><span className={invoiceStatus === 'FINALIZED' && !isCorrectionMode ? 'purchase-stock-in' : 'purchase-stock-pending'}>{purchaseStockEffectLabel(invoiceStatus, item.quantity, isCorrectionMode)}</span></td>
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
