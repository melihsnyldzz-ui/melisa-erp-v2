import React from 'react';

export function StockListToolbar({
  showPassive,
  onTogglePassive,
  onOpenNewProduct,
  onOpenProductCard,
  onExportCsv,
  onPrint,
  onRefresh,
  hasSelection = true,
}) {
  return (
    <div className="stock-toolbar">
      <div className="stock-toolbar-title">
        <strong>Stok Listesi</strong>
        <span>Canli stok, rezerve miktar ve terminal hareketleri</span>
      </div>
      <div className="stock-toolbar-actions">
        <button type="button" onClick={onOpenNewProduct}>Yeni Urun</button>
        <button type="button" onClick={onOpenProductCard} disabled={!hasSelection}>Urun Karti Ac</button>
        <button type="button" onClick={onExportCsv}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdir</button>
        <button type="button" onClick={onRefresh}>Yenile</button>
        <button className={showPassive ? 'pressed' : ''} type="button" onClick={onTogglePassive}>
          Pasifleri Goster
        </button>
      </div>
    </div>
  );
}
