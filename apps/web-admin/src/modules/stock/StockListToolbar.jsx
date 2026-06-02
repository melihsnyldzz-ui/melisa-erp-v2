import React from 'react';

export function StockListToolbar({ showPassive, onTogglePassive, onOpenProductCard }) {
  return (
    <div className="stock-toolbar">
      <div className="stock-toolbar-title">
        <strong>Stok Listesi</strong>
        <span>Canlı stok, rezerve miktar ve terminal hareketleri</span>
      </div>
      <div className="stock-toolbar-actions">
        <button type="button" onClick={onOpenProductCard}>Yeni Ürün</button>
        <button type="button" onClick={onOpenProductCard}>Ürün Kartı Aç</button>
        <button className={showPassive ? 'pressed' : ''} type="button" onClick={onTogglePassive}>
          Pasifleri Göster
        </button>
        <button type="button">Kolonlar</button>
        <button type="button">XLSX</button>
        <button type="button">PDF</button>
        <button type="button">Yenile</button>
      </div>
    </div>
  );
}
