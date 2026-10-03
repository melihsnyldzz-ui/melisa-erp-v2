import React, { useEffect, useState } from 'react';
import { get } from '../../services/apiClient.js';

export function VegaHistoryAccountLink({ entityType, entityId, permissions = [], onOpenScreen }) {
  const company = entityType === 'customer' ? 'F0102' : entityType === 'supplier' ? 'F0103' : null;
  const permitted = company && ['dashboard.view', 'finance.view', ...(company === 'F0102' ? ['customer.view', 'sales.view'] : ['supplier.view', 'purchase.view'])].every(p => permissions.includes(p));
  const [state, setState] = useState({ key: '', status: 'idle', link: null });
  const key = `${entityType}/${entityId || ''}`;
  useEffect(() => {
    let active = true;
    if (!permitted || !entityId) return () => { active = false; };
    setState({ key, status: 'loading', link: null });
    get('/api/vega-history/account-link', { entityType, entityId }).then(result => {
      if (!active) return;
      const link = result.data;
      if (result.success !== true || result.archiveOnly !== true || (link && (link.company !== company || link.entityType !== entityType || String(link.entityId) !== String(entityId) || !/^[1-9]\d*$/.test(link.partySourceId || '')))) throw Error('LINK_SCOPE_INVALID');
      setState({ key, status: link ? 'ready' : 'unlinked', link });
    }).catch(() => { if (active) setState({ key, status: 'unavailable', link: null }); });
    return () => { active = false; };
  }, [key, entityId, entityType, permitted, company]);
  if (!permitted || !entityId) return null;
  const current = state.key === key ? state : { status: 'loading', link: null };
  const title = current.status === 'unavailable' ? '2026 arşiv bağlantısı şu anda okunamıyor.' : current.status === 'unlinked' ? 'Bu kartın Vega geçmiş bağlantısı henüz doğrulanmadı.' : 'Bu carinin kaynak belgelerini ve ekstresini aç.';
  return <button type="button" title={title} disabled={current.status !== 'ready'} onClick={() => onOpenScreen?.('vega-history', { company, partySourceId: current.link.partySourceId })}>
    {current.status === 'loading' ? 'Vega geçmişi yükleniyor…' : current.status === 'unlinked' ? 'Vega eşleşmesi bekleniyor' : current.status === 'unavailable' ? 'Vega geçmişine ulaşılamıyor' : 'Vega 2026 Belgeleri'}
  </button>;
}
