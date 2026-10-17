import React from 'react';

export function PartyContextNotice({ entityType, partyId, partyCode, screenId, onOpenScreen }) {
  if (!partyId) return null;
  const label = entityType === 'supplier' ? 'Tedarikçi' : 'Müşteri';
  return <div className="list-state" role="status">
    <strong>{label}: {partyCode || `#${partyId}`} · Yalnız bu carinin kayıtları</strong>{' '}
    <button type="button" className="mini-button" onClick={() => onOpenScreen?.(`${entityType}-card`, { [`${entityType}Id`]: partyId, [`${entityType}Code`]: partyCode })}>Cari Kartı</button>{' '}
    <button type="button" className="mini-button" onClick={() => onOpenScreen?.(screenId)}>Tüm Cariler</button>
  </div>;
}
