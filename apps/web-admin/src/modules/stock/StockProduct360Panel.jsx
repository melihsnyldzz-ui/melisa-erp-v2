import React from 'react';
import { formatDate, formatMoney, movementLabel, movementParty, quantityEffect } from './stock360Utils.js';

export function StockProduct360Panel({
  selectedRow,
  selectedDetail,
  movementSummary,
  stockMovements,
  isDetailLoading,
  detailErrorMessage,
  onOpenMovement,
  onOpenSelectedProduct,
  onOpenScreen,
  onOpenMovementParty,
}) {
  return (
    <aside className="erp-panel stock-360-panel">
      <div className="panel-title stock-panel-title">
        <strong>Ürün 360</strong>
        <span>{selectedRow?.stockCode || 'Seçili ürün yok'}</span>
      </div>
      {!selectedRow && <div className="list-state">Ürün önizleme için listeden stok seçin.</div>}
      {selectedRow && (
        <>
          <div className="stock-360-head">
            <div>
              <span>Ürün</span>
              <strong>{selectedDetail?.productName || selectedRow.name}</strong>
              <small>{selectedRow.stockCode} / {selectedRow.barcode}</small>
            </div>
            <span className={selectedRow.currentStock < 0 ? 'stock-pill negative' : selectedRow.currentStock === 0 ? 'stock-pill zero' : 'stock-pill positive'}>
              {selectedRow.currentStock}
            </span>
          </div>

          <div className="stock-360-metrics">
            <div><span>Satış</span><strong>{selectedRow.salesPrice}</strong></div>
            <div><span>Alış</span><strong>{selectedRow.purchasePrice}</strong></div>
            <div><span>PB</span><strong>{selectedRow.currency}</strong></div>
            <div><span>Ort. maliyet</span><strong>{formatMoney(selectedDetail?.averageCostTry, 'TRY')}</strong></div>
          </div>

          <dl className="stock-360-facts">
            <div><dt>Marka</dt><dd>{selectedRow.brand}</dd></div>
            <div><dt>Kategori</dt><dd>{selectedRow.category}</dd></div>
            <div><dt>Tedarikçi</dt><dd>{selectedRow.supplier}</dd></div>
            <div><dt>Durum</dt><dd>{selectedRow.status}</dd></div>
            <div><dt>Son alış</dt><dd>{formatDate(selectedDetail?.lastPurchaseDate)}</dd></div>
            <div><dt>Son satış</dt><dd>{formatDate(selectedDetail?.lastSaleDate)}</dd></div>
          </dl>

          <div className="stock-360-movement-summary">
            <span><b>Alış fişi</b>{movementSummary.purchaseCount}</span>
            <span><b>Satış fişi</b>{movementSummary.salesCount}</span>
            <span className="in"><b>Giriş</b>+{movementSummary.inQuantity}</span>
            <span className="out"><b>Çıkış</b>-{movementSummary.outQuantity}</span>
          </div>

          {isDetailLoading && <div className="list-state">Ürün hareketleri yükleniyor...</div>}
          {!isDetailLoading && detailErrorMessage && <div className="list-state list-state-error">{detailErrorMessage}</div>}
          {!isDetailLoading && !detailErrorMessage && (
            <div className="stock-360-movements">
              <strong>Son Fiş Hareketleri</strong>
              {stockMovements.length === 0 && <span>Bu ürün için fiş hareketi yok.</span>}
              {stockMovements.slice(0, 8).map((row) => (
                <button type="button" key={row.id} onClick={() => onOpenMovement(row)}>
                  <span>
                    <b>{movementLabel(row)}</b>
                    <small>{row.sourceDocumentNo || '-'} / {movementParty(row)}</small>
                  </span>
                  <strong className={Number(row.quantityOut || 0) > 0 ? 'out' : 'in'}>{quantityEffect(row)}</strong>
                </button>
              ))}
            </div>
          )}

          <div className="stock-360-actions">
            <button type="button" onClick={onOpenSelectedProduct}>Ürün Kartı</button>
            <button type="button" onClick={() => onOpenScreen('stock-movements', { productId: selectedRow.id, stockCode: selectedRow.stockCode })}>Hareketler</button>
            <button type="button" onClick={() => selectedRow.supplierId && onOpenScreen('supplier-card', { supplierId: selectedRow.supplierId, supplierCode: selectedRow.supplierCode })} disabled={!selectedRow.supplierId}>Tedarikçi</button>
            <button type="button" onClick={() => stockMovements[0] && onOpenMovementParty(stockMovements[0])} disabled={!stockMovements.some((row) => row.customerId || row.supplierId)}>Cari</button>
          </div>
        </>
      )}
    </aside>
  );
}
