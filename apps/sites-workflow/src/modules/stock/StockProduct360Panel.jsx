import React from 'react';
import { X } from 'lucide-react';
import { formatDate, formatMoney, movementLabel, movementParty, quantityEffect } from './stock360Utils.js';

export function StockProduct360Panel({
  selectedRow,
  selectedDetail,
  movementSummary,
  stockMovements,
  isDetailLoading,
  detailErrorMessage,
  onClose,
  onOpenMovement,
  onOpenSelectedProduct,
  onOpenScreen,
  onOpenMovementParty,
  isReadOnly = false,
  testReadOnly = false,
  selectedMetadata = null,
}) {
  if (testReadOnly) return <ReadOnlyProductPanel row={selectedRow} detail={selectedDetail} meta={selectedMetadata} loading={isDetailLoading} error={detailErrorMessage} onClose={onClose} />;
  return (
    <aside className="erp-panel stock-360-panel">
      <div className="panel-title stock-panel-title">
        <div>
          <strong>Ürün 360</strong>
          <span>{selectedRow?.stockCode || 'Seçili ürün yok'}</span>
        </div>
        <button aria-label="Ürün 360 panelini kapat" className="stock-360-close" onClick={onClose} type="button"><X aria-hidden="true" size={16} /></button>
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
            {isReadOnly
              ? <div><span>Stok</span><strong>{selectedRow.currentStock}</strong></div>
              : <div><span>Ort. maliyet</span><strong>{formatMoney(selectedDetail?.averageCostTry, 'TRY')}</strong></div>}
          </div>

          <dl className="stock-360-facts">
            <div><dt>Marka</dt><dd>{selectedRow.brand}</dd></div>
            <div><dt>Kategori</dt><dd>{selectedRow.category}</dd></div>
            <div><dt>4-ÖK (KOD4)</dt><dd>{selectedRow.specialCode4 || '-'}</dd></div>
            <div><dt>GTİP</dt><dd>{selectedRow.gtipCode || '-'}</dd></div>
            {selectedRow.gtipStatus && <div><dt>GTİP durumu</dt><dd>{selectedRow.gtipStatus === 'verified' ? 'Doğrulandı' : 'Taslak'}</dd></div>}
            {selectedRow.gtipConfidence && <div><dt>Güven</dt><dd>{selectedRow.gtipConfidence}</dd></div>}
            <div><dt>Tedarikçi</dt><dd>{selectedRow.supplier}</dd></div>
            <div><dt>Durum</dt><dd>{selectedRow.status}</dd></div>
            {isReadOnly
              ? <div><dt>Kart açılışı</dt><dd>{selectedRow.cardOpenedDate || '-'}</dd></div>
              : <>
                <div><dt>Son alış</dt><dd>{formatDate(selectedDetail?.lastPurchaseDate)}</dd></div>
                <div><dt>Son satış</dt><dd>{formatDate(selectedDetail?.lastSaleDate)}</dd></div>
              </>}
          </dl>

          {isReadOnly && (
            <div className="stock-360-readonly-note">
              <strong>Vega salt okunur.</strong> GTİP Melisa ERP'de yerel olarak tutulur.
              {selectedRow.gtipMaterialBasis && <span>{selectedRow.gtipMaterialBasis}</span>}
              {selectedRow.gtipNote && <span>{selectedRow.gtipNote}</span>}
              {selectedRow.gtipSourceDocumentNo && <span>Kaynak fiş: {selectedRow.gtipSourceDocumentNo}</span>}
            </div>
          )}

          {!isReadOnly && <div className="stock-360-movement-summary">
            <span><b>Alış fişi</b>{movementSummary.purchaseCount}</span>
            <span><b>Satış fişi</b>{movementSummary.salesCount}</span>
            <span className="in"><b>Giriş</b>+{movementSummary.inQuantity}</span>
            <span className="out"><b>Çıkış</b>-{movementSummary.outQuantity}</span>
          </div>}

          {!isReadOnly && <details className="stock-360-movement-details">
            <summary>Son fiş hareketleri</summary>
            {isDetailLoading && <div className="list-state">Ürün hareketleri yükleniyor...</div>}
            {!isDetailLoading && detailErrorMessage && <div className="list-state list-state-error">{detailErrorMessage}</div>}
            {!isDetailLoading && !detailErrorMessage && (
              <div className="stock-360-movements">
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
          </details>}

          {!isReadOnly && <div className="stock-360-actions">
            <button type="button" onClick={onOpenSelectedProduct}>Ürün Kartı</button>
            <button type="button" onClick={() => onOpenScreen('stock-movements', { productId: selectedRow.id, stockCode: selectedRow.stockCode })}>Hareketler</button>
            <button type="button" onClick={() => selectedRow.supplierId && onOpenScreen('supplier-card', { supplierId: selectedRow.supplierId, supplierCode: selectedRow.supplierCode })} disabled={!selectedRow.supplierId}>Tedarikçi</button>
            <button type="button" onClick={() => stockMovements[0] && onOpenMovementParty(stockMovements[0])} disabled={!stockMovements.some((row) => row.customerId || row.supplierId)}>Cari</button>
          </div>}
        </>
      )}
    </aside>
  );
}


function ReadOnlyProductPanel({ row, detail, meta, loading, error, onClose }) {
  const value = v => v == null || v === '' ? 'Bilinmiyor' : String(v);
  const number = v => v == null ? 'Bilinmiyor' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(v);
  return <aside className="v17-product-panel" aria-label="Ürün detay paneli">
    <div className="v17-card-title"><h2>Ürün detayı</h2><button type="button" className="v17-icon-button" aria-label="Ürün detayını kapat" onClick={onClose}><X size={18} /></button></div>
    <div className="v17-media-placeholder" aria-label="Doğrulanmış ürün görseli yok"><span>▦</span><small>Görsel doğrulanmadı</small></div>
    <h3>{value(row?.productName)}</h3><p className="v17-muted">{value(row?.stockCode)}</p>
    {loading ? <div role="status" className="v17-notice">Ayrıntı yükleniyor…</div> : error ? <div role="alert" className="v17-notice error">{error}</div> : detail && <>
      <div className="v17-detail-metrics"><div><span>Kayıtlı stok</span><strong>{number(detail.stockQuantity)}</strong><small>{value(detail.unit)}</small></div><div><span>Satış fiyatı</span><strong>{number(detail.salePrice)}</strong><small>{value(detail.currency)}</small></div></div>
      <dl className="v17-facts">{[['Barkod', detail.barcode], ['Marka', detail.brand], ['Kategori', detail.category], ['Birim', detail.unit], ['Durum', detail.isActive == null ? null : detail.isActive ? 'Aktif' : 'Pasif'], ['Native ürün ID', detail.id], ['Kaynak', meta?.sourceContext?.database ?? 'Doğrulanmadı'], ['Firma / dönem', 'Doğrulanmadı']].map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{value(content)}</dd></div>)}</dl>
    </>}
    <p className="v17-read-context">Kaynak: {meta?.sourceContext?.environment ?? 'Doğrulanmadı'} · Okuma zamanı (yerel): {meta?.readAt && Number.isFinite(Date.parse(meta.readAt)) ? new Date(meta.readAt).toLocaleString('tr-TR') : 'Doğrulanmadı'} · İş tarihi: doğrulanmadı</p>
    <div className="v17-panel-note">Salt okunur ürün kartı. Medya, maliyet ve ticari hareket kapsamı bu teslimde açık değildir.</div>
  </aside>;
}
