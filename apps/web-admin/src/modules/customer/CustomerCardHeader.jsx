import React from 'react';

export function CustomerCardHeader({
  customer,
  mode,
  isSaving,
  isPassiveSaving,
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
        <button type="button" onClick={onSave} disabled={isSaving || isPassiveSaving}>
          {isSaving ? 'Kaydediliyor' : 'Kaydet'}
        </button>
        <button type="button" onClick={onNew}>Yeni</button>
        <button
          type="button"
          onClick={onTogglePassive}
          disabled={mode === 'create' || isSaving || isPassiveSaving}
          title={mode === 'create' ? 'Pasif/Aktif islemi icin kayitli cari gerekir' : 'Kaydi silmeden aktif/pasif durumunu degistirir'}
        >
          {isPassiveSaving ? 'Isleniyor' : passiveLabel}
        </button>
        <button type="button" disabled title="Silme yok; hareket gormus kayitlar silinmeyecek">Sil</button>
        <button type="button">Ekstre</button>
        <button type="button">Yazdir</button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : 'Update'}</span>
      </div>
    </section>
  );
}
