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
  const saveLabel = isFinalized ? 'Duzeltmeyi Kaydet' : 'Taslak Kaydet';

  return (
    <section className="sales-invoice-toolbar">
      <div className="sales-toolbar-title">
        <strong>Satis Fisi</strong>
        <span>{status}</span>
      </div>
      <div className="sales-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isCancelled || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? saveLabel : 'sales.create/sales.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : saveLabel}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalized || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinlestir' : 'sales.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinlestiriliyor' : isFinalized ? 'Kesin' : isReadonly ? 'Kapali' : 'Kesinlestir'}
        </button>
        <button type="button" onClick={onCancel} disabled={!onCancel || isCancelling || status !== 'FINALIZED' || !canCancel} title={canCancel ? 'Finalized fisi iptal et' : 'sales.cancel yetkisi gerekli'}>
          {isCancelling ? 'Iptal ediliyor' : 'Iptal Et'}
        </button>
        <button type="button" onClick={onExport}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdir</button>
      </div>
    </section>
  );
}
