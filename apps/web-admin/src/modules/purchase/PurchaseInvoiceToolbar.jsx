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
        <strong>Alis Fisi</strong>
        <span>Durum: {status} / muhasebe stok girisi</span>
      </div>
      <div className="purchase-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isReadonly || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? 'Taslak kaydet' : 'purchase.create/purchase.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Taslak Kaydet'}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinlestir' : 'purchase.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinlestiriliyor' : isReadonly ? 'Kapali' : 'Kesinlestir'}
        </button>
        <button type="button" onClick={onCancel} disabled={!onCancel || isCancelling || status !== 'FINALIZED' || !canCancel} title={canCancel ? 'Finalized alis fisi iptal et' : 'purchase.cancel yetkisi gerekli'}>
          {isCancelling ? 'Iptal ediliyor' : 'Iptal Et'}
        </button>
        <button type="button" onClick={onExport}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdir</button>
      </div>
    </section>
  );
}
