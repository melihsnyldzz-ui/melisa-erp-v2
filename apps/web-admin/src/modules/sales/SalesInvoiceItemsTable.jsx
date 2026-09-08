import React, { useState } from 'react';
import { ExternalLink, Minus, Plus, Trash2 } from 'lucide-react';

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
  exchangeRate = /** @type {number | string} */ (1),
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
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

  return (
    <section className="erp-panel sales-items-panel">
      <div className="panel-title">
        <strong>Ürünler</strong>
        <span>{items.length} satır</span>
        {showProfitColumns && (
          <button className="invoice-table-detail-toggle" type="button" onClick={() => setShowFinancialDetails((current) => !current)}>
            {showFinancialDetails ? 'Maliyetleri Gizle' : 'Maliyet ve Kâr'}
          </button>
        )}
      </div>
      <div className="table-wrap sales-items-wrap">
        <table className={showFinancialDetails ? 'sales-items-table show-financial-details' : 'sales-items-table'}>
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Ürün adı</th>
              <th>Barkod</th>
              <th>Miktar</th>
              <th>Birim fiyat</th>
              <th>Satır toplamı</th>
              {showProfitColumns && showFinancialDetails && <th>Net maliyet</th>}
              {showProfitColumns && showFinancialDetails && <th>Net kâr</th>}
              {showProfitColumns && showFinancialDetails && <th>TRY kâr</th>}
              {showProfitColumns && showFinancialDetails && <th>Kâr %</th>}
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
                  <td className="invoice-product-cell">
                    <strong>{item.productName}</strong>
                  </td>
                  <td className="invoice-barcode-cell">{item.barcode || '-'}</td>
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
                  {showProfitColumns && showFinancialDetails && <td className="money-cell">{formatMoney(costInInvoiceCurrency, invoiceCurrency)}</td>}
                  {showProfitColumns && showFinancialDetails && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatMoney(profitInInvoiceCurrency, invoiceCurrency)}</td>}
                  {showProfitColumns && showFinancialDetails && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatMoney(item.grossProfitTry || 0, 'TRY')}</td>}
                  {showProfitColumns && showFinancialDetails && <td className={`money-cell invoice-profit-cell ${profitClassName}`}>{formatPercent(item.grossProfitRate || 0)}</td>}
                  <td>
                    <span className={item.stockState === 'Eksiye duser' ? 'sales-stock-pill risk' : 'sales-stock-pill'}>
                      {showProfitColumns && /^Stok:/.test(item.stockState) ? item.stockState.replace(/^Stok:/, 'Fiş kaydındaki stok:') : item.stockState}
                    </span>
                  </td>
                  {!isReadonly && (
                    <td className="row-action-cell">
                      <div className="row-actions">
                        <button aria-label="Adet azalt" title="Adet azalt" type="button" onClick={() => onAdjustQuantity?.(item.id, -1)}><Minus size={14} /></button>
                        <button aria-label="Adet artır" title="Adet artır" type="button" onClick={() => onAdjustQuantity?.(item.id, 1)}><Plus size={14} /></button>
                        <button aria-label="Ürün kartını aç" title="Ürün kartını aç" type="button" onClick={() => onOpenProduct?.(item.productId, item.stockCode)}><ExternalLink size={14} /></button>
                        <button aria-label="Satırı sil" title="Satırı sil" type="button" onClick={() => onDeleteItem(item.id)}><Trash2 size={14} /></button>
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
