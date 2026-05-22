import React from 'react';

export function PurchaseInvoiceToolbar({
  status,
  isSaving,
  isFinalizing,
  isFinalized,
  canSaveDraft = true,
  canFinalize = true,
  onNewDraft,
  onSaveDraft,
  onFinalize,
}) {
  return (
    <section className="purchase-invoice-toolbar">
      <div className="purchase-toolbar-title">
        <strong>Alis Fisi</strong>
        <span>Durum: {status} / muhasebe stok girisi</span>
      </div>
      <div className="purchase-toolbar-actions">
        <button type="button" onClick={onNewDraft}>Yeni Fis</button>
        <button type="button" onClick={onSaveDraft} disabled={isSaving || isFinalized || isFinalizing || !canSaveDraft} title={canSaveDraft ? 'Taslak kaydet' : 'purchase.draft.write yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Taslak Kaydet'}
        </button>
        <button type="button" className="primary" onClick={onFinalize} disabled={isFinalized || isFinalizing || !onFinalize || !canFinalize} title={canFinalize ? 'Kesinlestir' : 'purchase.finalize yetkisi gerekli'}>
          {isFinalizing ? 'Kesinlestiriliyor' : isFinalized ? 'Kesinlesti' : 'Kesinlestir'}
        </button>
        <button type="button">Yazdir</button>
        <button type="button">Iptal Et</button>
        <button type="button">Tedarikci Ekstresi</button>
        <button type="button">Yenile</button>
      </div>
    </section>
  );
}
