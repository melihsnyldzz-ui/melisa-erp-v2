import React from 'react';

export function StockListToolbar({
  showPassive,
  onTogglePassive,
  onOpenNewProduct,
  onOpenProductCard,
  onExportCsv,
  onExportExcel,
  onPrint,
  onRefresh,
  hasSelection = true,
}) {
  return (
    <div className="stock-toolbar">
      <div className="stock-toolbar-title">
        <strong>Stok Listesi</strong>
        <span>Canlı stok, rezerve miktar ve terminal hareketleri</span>
      </div>
      <div className="stock-toolbar-actions">
        <button type="button" onClick={onOpenNewProduct}>Yeni Ürün</button>
        <button type="button" onClick={onOpenProductCard} disabled={!hasSelection}>Ürün Kartı Aç</button>
        <button type="button" onClick={onExportCsv}>CSV</button>
        <button type="button" onClick={onExportExcel}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdır/PDF</button>
        <button type="button" onClick={onRefresh}>Yenile</button>
        <button className={showPassive ? 'pressed' : ''} type="button" onClick={onTogglePassive}>
          Pasifleri Göster
        </button>
      </div>
    </div>
  );
}
