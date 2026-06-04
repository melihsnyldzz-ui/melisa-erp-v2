import React from 'react';

export function CustomerCardHeader({
  customer,
  mode,
  isSaving,
  isPassiveSaving,
  canSave = true,
  canTogglePassive = true,
  onSave,
  onNew,
  onTogglePassive,
}) {
  const passiveLabel = customer.status === 'Pasif' ? 'Aktif Yap' : 'Pasif Yap';

  return (
    <section className="customer-card-header">
      <div className="customer-title-block">
        <strong>Cari Kart</strong>
        <span>{customer.code} / {customer.name} / {customer.type}</span>
      </div>
      <div className="customer-card-toolbar">
        <button type="button" onClick={onSave} disabled={isSaving || isPassiveSaving || !canSave} title={canSave ? 'Kaydet' : 'customer.edit yetkisi gerekli'}>
          {isSaving ? 'Kaydediliyor' : 'Kaydet'}
        </button>
        <button type="button" onClick={onNew}>Yeni</button>
        <button
          type="button"
          onClick={onTogglePassive}
          disabled={mode === 'create' || isSaving || isPassiveSaving || !canTogglePassive}
          title={!canTogglePassive ? 'customer.passive yetkisi gerekli' : mode === 'create' ? 'Pasif/Aktif işlemi için kayıtlı cari gerekir' : 'Kaydı silmeden aktif/pasif durumunu değiştirir'}
        >
          {isPassiveSaving ? 'Isleniyor' : passiveLabel}
        </button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Güncelleme'}</span>
      </div>
    </section>
  );
}
