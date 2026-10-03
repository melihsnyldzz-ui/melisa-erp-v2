import React, { useState, useSyncExternalStore } from 'react';
import { dispatchOperations, getOperations, subscribeOperations } from '../../demo/operationsStore.js';
import { approvalMode } from '../../demo/saleFulfillment.js';
import { WorkspaceHeading } from './WorkspaceChrome.jsx';
import { SaleSettlementPanel } from './SaleSettlementPanel.jsx';
import './operations.css';

export function ManagementWorkspace({ roleViewId, onOpenScreen }) {
  const state = useSyncExternalStore(subscribeOperations, getOperations, getOperations);
  const [error, setError] = useState('');
  const pending = state.documents.filter(doc => doc.status === 'APPROVED' && doc.kind === 'sale' && doc.fulfillment?.credit?.status === 'PENDING');
  async function saveMode(mode) { try { await dispatchOperations({ type: 'save-workflow-settings', actorRole: roleViewId, mode }); setError(''); } catch (cause) { setError(cause.message); } }
  return <main className="work-area connected-operations"><WorkspaceHeading screen="settings-overview" title="Yönetim ve onaylar" description="Vadeli gönderim kararları ve iş akışı ayarları" count={`${pending.length} bekleyen`} />
    <section className="erp-panel op-form"><label>Vade onayı nereden verilsin?<select value={approvalMode(state)} onChange={e => saveMode(e.target.value)}><option value="BILL">Fişin içinden</option><option value="QUEUE">Onay listesinden</option><option value="BOTH">Her iki yerden</option></select></label><p>İlker vade önerir. Semih veya Angela’dan birinin onayı yeterlidir. Onay gelene kadar mal gönderimi bekler.</p>{error && <p role="alert">{error}</p>}</section>
    <section className="erp-panel"><h2>Onay bekleyenler</h2>{!pending.length && <p>Bekleyen vade önerisi yok.</p>}{pending.map(doc => <article key={doc.id} className="approval-card"><div className="op-section-title"><h3>{doc.number} · {state.customers.find(c => c.id === doc.partyId)?.name}</h3><button onClick={() => onOpenScreen('sales-invoice-list', { selectedDocumentId: doc.id, documentNo: doc.number })}>Fişi aç</button></div>{approvalMode(state) !== 'BILL' && <SaleSettlementPanel state={state} doc={doc} roleViewId={roleViewId} onOpenScreen={onOpenScreen} inQueue />}</article>)}</section>
    <section className="erp-panel"><h2>İlgili ekranlar</h2><div className="op-actions"><button onClick={() => onOpenScreen('collections-overview')}>Tahsilat ve ödemeler</button><button onClick={() => onOpenScreen('finance-overview')}>Hesap bakiyeleri</button><button onClick={() => onOpenScreen('price-list')}>Fiyatlar ve kurlar</button><button onClick={() => onOpenScreen('reports-overview')}>Raporlar</button></div></section>
    <section className="erp-panel"><h2>Son kararlar</h2>{!(state.workflowAudit || []).length && <p>Henüz karar kaydı yok.</p>}<div className="table-shell"><table className="erp-table"><thead><tr><th>Zaman</th><th>İşlem</th><th>Fiş</th><th>Karar veren</th><th>Açıklama</th></tr></thead><tbody>{(state.workflowAudit || []).slice(-30).reverse().map((row, i) => <tr key={i}><td>{new Date(row.at).toLocaleString('tr-TR')}</td><td>{{'save-workflow-settings':'Onay görünümü','propose-sale-credit':'Vade önerisi','approve-sale-credit':'Vade onayı','reject-sale-credit':'Vade reddi','ship-sale':'Gönderim'}[row.action]}</td><td>{state.documents.find(d => d.id === row.documentId)?.number || '—'}</td><td>{row.approver || (row.actorRole === 'muhasebe' ? 'Muhasebe' : 'Yönetici')}</td><td>{row.reason || '—'}</td></tr>)}</tbody></table></div></section>
  </main>;
}
