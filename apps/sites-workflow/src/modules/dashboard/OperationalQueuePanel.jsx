import React, { useEffect, useRef, useState } from 'react';
import { get } from '../../services/apiClient.js';

const labels = { receipts: 'Muhasebe kabulü bekleyenler', notices: 'Tahsilat bildirimleri', cheques: 'Taslak çekler', counts: 'İncelemeye gönderilen sayımlar' };
const errors = { permission_unverified: 'Görüntüleme yetkisi doğrulanmadı.', not_connected: 'Okuma kaynağı henüz bağlı değil.', read_error: 'Kaynak okunamadı; sayı bilinmiyor.' };
export function OperationalQueuePanel({ onOpenScreen, permissions = [] }) {
  const [state, setState] = useState({ loading: false, data: null, error: '' });
  const request = useRef(null);
  const allowed = permissions.includes('dashboard.view');
  const permissionIdentity = JSON.stringify([...new Set(permissions)].sort());
  useEffect(() => { setState({ loading: false, data: null, error: '' }); return () => request.current?.abort(); }, [permissionIdentity]);
  async function read() {
    if (!allowed) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState({ loading: true, data: null, error: '' });
    try {
      const response = await get('/api/operational-queue', {}, { signal: controller.signal });
      if (controller.signal.aborted || request.current !== controller) return;
      const data = response.data;
      if (data?.source !== 'PROMPT-2-20260923-01' || data.readOnly !== true || data.complete !== false
        || data.scope !== 'TASK_RECEIPTS_NOTICES_CHEQUES_COUNTS_ONLY' || !Array.isArray(data.groups)
        || data.groups.length !== 4 || new Set(data.groups.map(g => g.key)).size !== 4
        || data.groups.some(g => !labels[g.key] || !Array.isArray(g.items)
          || (g.state === 'read' ? !Number.isSafeInteger(g.total) || g.total < 0 || g.items.length !== Math.min(8, g.total)
            || !Number.isFinite(Date.parse(g.readAt)) || g.items.some(i => typeof i.id !== 'string' || !/^[1-9]\d{0,18}$/.test(i.id)
              || BigInt(i.id) > 9223372036854775807n || i.source !== data.source
              || i.kind !== (g.key === 'receipts' ? 'receipt' : g.key === 'notices' ? 'collection_notice' : g.key === 'counts' ? 'stock_count' : 'cheque')
              || i.link?.kind !== i.kind
              || i.status !== (g.key === 'receipts' ? 'submitted' : g.key === 'notices' ? 'pending' : g.key === 'counts' ? 'submitted' : 'draft')
              || i.link?.documentId !== i.id || i.link?.source !== (g.key === 'receipts' ? '/api/inventory-receipts' : g.key === 'notices' ? '/api/collection-notices' : g.key === 'counts' ? '/api/stock-counts' : '/api/cheques'))
            : !errors[g.state] || g.total !== null || g.items.length !== 0))) throw Error('UNVERIFIED');
      setState({ loading: false, data, error: '' });
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) setState({ loading: false, data: null,
        error: error.status === 401 ? 'Normal TEST oturumu gerekli.' : error.status === 403 ? 'Kuyruk okuma yetkisi veya bağlantısı doğrulanmadı.' : 'Bekleyen işler okunamadı; sayı bilinmiyor.' });
    }
  }
  return <section className="v17-card">
    <div className="v17-card-title"><h2>Bekleyen işler</h2><button type="button" className="v17-button" disabled={!allowed || state.loading} onClick={read}>{state.loading ? 'Okunuyor…' : 'Oku / yenile'}</button></div>
    <p className="v17-muted">Görev kapsamındaki kabul, tahsilat bildirimleri, taslak çekler ve incelemeye gönderilen sayımlar. Tüm operasyonların toplamı değildir.</p>
    {!state.data && !state.error && <p>Kaynak henüz okunmadı; bekleyen iş sayısı bilinmiyor.</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.data?.groups.map(group => group.state === 'read' && group.total === 0 ? null : <div key={group.key}>
      <h3>{labels[group.key]}{group.state === 'read' ? ` · ${group.total}` : ''}</h3>
      {group.state !== 'read' ? <p>{errors[group.state]}</p> : <>
        <ul>{group.items.map(item => <li key={item.id}>{group.key === 'receipts'
          ? <button type="button" className="v17-button" onClick={() => onOpenScreen?.('inventory-receipt-list', { receiptId: item.id })}>Kabul #{item.id} →</button>
          : group.key === 'counts' ? <button type="button" className="v17-button" onClick={() => onOpenScreen?.('stock-count', {count:{kind:'stock_count',source:'/api/stock-counts',documentId:item.id}})}>Sayım #{item.id} →</button>
          : group.key === 'cheques' ? <button type="button" className="v17-button" onClick={() => onOpenScreen?.('collections-overview', {mode:'cheque',cheque:{kind:'cheque',source:'/api/cheques',documentId:item.id}})}>Çek #{item.id} →</button>
          : <button type="button" className="v17-button" onClick={() => onOpenScreen?.('collections-overview', { notice: { kind: 'collection_notice', source: '/api/collection-notices', documentId: item.id } })}>Bildirim #{item.id} →</button>}</li>)}</ul>
        <small>Okuma: {new Date(group.readAt).toLocaleString('tr-TR')} · {group.visibilityScope} · İlk {group.items.length} kayıt</small>
      </>}
    </div>)}
    {state.data && <p className="v17-muted">Kaynak: {state.data.source} · Firma/dönem doğrulanmadı. Alış inceleme, sayım farkları ve diğer operasyonlar henüz bağlı değil. Doğrulanmış sıfır satırları gösterilmez.</p>}
  </section>;
}



