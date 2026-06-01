import React from 'react';

export function SalesInvoiceToolbar({
  status,
  isSaving,
  isCancelling = false,
  isFinalizing,
  isReadonly,
  canSaveDraft = true,
  canFinalize = true,
  canCancel = true,
  onNewDraft,
  onSaveDraft,
  onFinalize,
  onCancel,
}) {
  return (
    <section className="sales-invoice-toolbar">
      <div className="sales-toolbar-title">
        <strong>Satis Fisi</strong>
        <span>Durum: {status} / ticari islem ekrani</span>
      </div>
      <div className="sales-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isReadonly || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? 'Taslak kaydet' : 'sales.create/sales.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Taslak Kaydet'}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinlestir' : 'sales.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinlestiriliyor' : isReadonly ? 'Kapali' : 'Kesinlestir'}
        </button>
        <button type="button">Yazdir</button>
        <button type="button" onClick={onCancel} disabled={!onCancel || isCancelling || status !== 'FINALIZED' || !canCancel} title={canCancel ? 'Finalized fisi iptal et' : 'sales.cancel yetkisi gerekli'}>
          {isCancelling ? 'Iptal ediliyor' : 'Iptal Et'}
        </button>
        <button type="button">Musteri Ekstresi</button>
        <button type="button">Yenile</button>
      </div>
    </section>
  );
}
