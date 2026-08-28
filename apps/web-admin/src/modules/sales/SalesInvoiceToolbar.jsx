import React from 'react';
import { Check, FilePlus2, FileSpreadsheet, Pencil, Printer, Save, XCircle } from 'lucide-react';

export function SalesInvoiceToolbar({
  status,
  isSaving,
  isCancelling = false,
  isFinalizing,
  isReadonly,
  canSaveDraft = true,
  canFinalize = true,
  canCancel = true,
  isCorrectionMode = false,
  onNewDraft,
  onEditFinalized,
  onSaveDraft,
  onFinalize,
  onCancel,
  onExport,
  onPrint,
}) {
  const isFinalized = status === 'FINALIZED';
  const isCancelled = status === 'CANCELLED';
  const isDraft = !isFinalized && !isCancelled;
  const canEditCurrent = isDraft || (isFinalized && isCorrectionMode);

  return (
    <section className="sales-invoice-toolbar">
      <div className="sales-toolbar-title">
        <strong>Satış Fişi</strong>
        <span>{status}</span>
      </div>
      <div className="sales-toolbar-actions">
        <button type="button" onClick={onNewDraft}><FilePlus2 size={15} />Yeni Fiş</button>
        {isFinalized && !isCorrectionMode && (
          <button type="button" onClick={onEditFinalized} disabled={!onEditFinalized || !canSaveDraft} title={canSaveDraft ? 'Kesin fişi doğrudan düzelt' : 'sales.edit yetkisi gerekli'}>
            <Pencil size={15} />Düzenle
          </button>
        )}
        {canEditCurrent && (
          <button type="button" onClick={onSaveDraft} disabled={isSaving || isReadonly || isFinalizing || isCancelling || !canSaveDraft} title={canSaveDraft ? 'Taslağı kaydet' : 'sales.create/sales.edit yetkisi gerekli'}>
            <Save size={15} />{isSaving ? 'Kaydediliyor' : isCorrectionMode ? 'Değişiklikleri Kaydet' : 'Taslağı Kaydet'}
          </button>
        )}
        {isDraft && (
          <button type="button" className="primary" onClick={onFinalize} disabled={isReadonly || isFinalizing || isCancelling || !onFinalize || !canFinalize} title={canFinalize ? 'Fişi kesinleştir' : 'sales.finalize yetkisi gerekli'}>
            <Check size={15} />{isFinalizing ? 'Kesinleştiriliyor' : 'Kesinleştir'}
          </button>
        )}
        {isFinalized && !isCorrectionMode && (
          <button type="button" className="danger-outline" onClick={onCancel} disabled={!onCancel || isCancelling || !canCancel} title={canCancel ? 'Kesinleşmiş fişi iptal et' : 'sales.cancel yetkisi gerekli'}>
            <XCircle size={15} />{isCancelling ? 'İptal ediliyor' : 'İptal Et'}
          </button>
        )}
        <button type="button" onClick={onExport}><FileSpreadsheet size={15} />Excel</button>
        <button type="button" onClick={onPrint}><Printer size={15} />Yazdır</button>
      </div>
    </section>
  );
}
