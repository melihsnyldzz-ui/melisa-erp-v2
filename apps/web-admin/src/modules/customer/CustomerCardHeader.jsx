import React from 'react';

export function CustomerCardHeader({
  customer,
  mode,
  isSaving,
  isPassiveSaving,
  isEditing = false,
  canSave = true,
  canTogglePassive = true,
  onEdit,
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
        {mode === 'update' && (
          <button type="button" className={isEditing ? 'pressed' : ''} onClick={onEdit} disabled={isSaving || isPassiveSaving || !canSave}>
            {isEditing ? 'Düzenleniyor' : 'Düzenle'}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isPassiveSaving || !canSave || (mode === 'update' && !isEditing)}
          title={canSave ? 'Kaydet' : 'customer.edit yetkisi gerekli'}
        >
          {isSaving ? 'Kaydediliyor' : 'Kaydet'}
        </button>
        <button type="button" onClick={onNew}>Yeni</button>
        <button
          type="button"
          onClick={onTogglePassive}
          disabled={mode === 'create' || isSaving || isPassiveSaving || !canTogglePassive}
          title={!canTogglePassive ? 'customer.passive yetkisi gerekli' : mode === 'create' ? 'Pasif/Aktif işlemi için kayıtlı cari gerekir' : 'Kaydı silmeden aktif/pasif durumunu değiştirir'}
        >
          {isPassiveSaving ? 'İşleniyor' : passiveLabel}
        </button>
        <span className="toolbar-mode">{mode === 'create' ? 'Yeni' : isEditing ? 'Düzenleme açık' : 'İzleme'}</span>
      </div>
    </section>
  );
}
