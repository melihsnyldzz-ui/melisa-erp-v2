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
  onExport,
  onPrint,
}) {
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const saveLabel = isFinalized ? 'Kesin Fi?' : 'Taslak Kaydet';

  return (
    <section className="sales-invoice-toolbar">
      <div className="sales-toolbar-title">
        <strong>Satış Fişi</strong>
        <span>{status}</span>
      </div>
      <div className="sales-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fiş</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isReadonly || isCancelled || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? saveLabel : 'sales.create/sales.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : saveLabel}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalized || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinleştir' : 'sales.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinleştiriliyor' : isFinalized ? 'Kesin' : isReadonly ? 'Kapalı' : 'Kesinleştir'}
        </button>
        <button type="button" onClick={onCancel} disabled={!onCancel || isCancelling || status !== 'FINALIZED' || !canCancel} title={canCancel ? 'Finalized fişi iptal et' : 'sales.cancel yetkisi gerekli'}>
          {isCancelling ? 'İptal ediliyor' : 'İptal Et'}
        </button>
        <button type="button" onClick={onExport}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdır</button>
      </div>
    </section>
  );
}
