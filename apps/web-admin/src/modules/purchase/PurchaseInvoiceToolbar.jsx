import React from 'react';

export function PurchaseInvoiceToolbar({ status, onNewDraft, onSaveDraft, onFinalize }) {
  return (
    <section className="purchase-invoice-toolbar">
      <div className="purchase-toolbar-title">
        <strong>Alis Fisi</strong>
        <span>Durum: {status} / muhasebe stok girisi</span>
      </div>
      <div className="purchase-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft}>Taslak Kaydet</button>
        <button type="button" className="primary" onClick={onFinalize}>Kesinlestir</button>
        <button type="button">Yazdir</button>
        <button type="button">Iptal Et</button>
        <button type="button">Tedarikci Ekstresi</button>
        <button type="button">Yenile</button>
      </div>
    </section>
  );
}
