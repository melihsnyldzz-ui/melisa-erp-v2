import React from 'react';

export function PurchaseInvoiceToolbar({
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
  onExport,
  onPrint,
}) {
  return (
    <section className="purchase-invoice-toolbar">
      <div className="purchase-toolbar-title">
        <strong>Alış Fişi</strong>
        <span>Durum: {status} / muhasebe stok girişi</span>
      </div>
      <div className="purchase-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fiş</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isReadonly || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? 'Taslak kaydet' : 'purchase.create/purchase.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Taslak Kaydet'}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinleştir' : 'purchase.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinleştiriliyor' : isReadonly ? 'Kapalı' : 'Kesinleştir'}
        </button>
        <button type="button" onClick={onCancel} disabled={!onCancel || isCancelling || status !== 'FINALIZED' || !canCancel} title={canCancel ? 'Finalized alış fişi iptal et' : 'purchase.cancel yetkisi gerekli'}>
          {isCancelling ? 'İptal ediliyor' : 'İptal Et'}
        </button>
        <button type="button" onClick={onExport}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdır</button>
      </div>
    </section>
  );
}
