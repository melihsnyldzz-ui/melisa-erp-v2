import React from 'react';

export function SalesInvoiceToolbar({ status, isSaving, onNewDraft, onSaveDraft, onFinalize }) {
  return (
    <section className="sales-invoice-toolbar">
      <div className="sales-toolbar-title">
        <strong>Satis Fisi</strong>
        <span>Durum: {status} / mock ticari islem ekrani</span>
      </div>
      <div className="sales-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving}>
          {isSaving ? 'Kaydediliyor' : 'Taslak Kaydet'}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled>Kesinlestir / yakinda</button>
        <button type="button">Yazdir</button>
        <button type="button">Iptal Et</button>
        <button type="button">Musteri Ekstresi</button>
        <button type="button">Yenile</button>
      </div>
    </section>
  );
}
