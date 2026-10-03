import React, { useState } from 'react';
import { dispatchOperations, today } from '../../demo/operationsStore.js';
import { approvalMode, paymentLabels, saleStatus, shippingLabels } from '../../demo/saleFulfillment.js';
const money = (n, c) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c }).format(n / 100);

export function SaleSettlementPanel({ state, doc, roleViewId, onOpenScreen, inQueue = false }) {
  const status = saleStatus(state, doc);
  const [dueDate, setDueDate] = useState(doc.dueDate || today());
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const accounting = ['muhasebe', 'yonetici'].includes(roleViewId);
  const mode = approvalMode(state);
  const showDecision = roleViewId === 'yonetici' && (inQueue ? mode !== 'BILL' : mode !== 'QUEUE');
  async function act(type) {
    if (busy) return; setBusy(true); setError('');
    try { await dispatchOperations({ type, id: doc.id, dueDate, reason, approver, actorRole: roleViewId }); setReason(''); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="sale-settlement" aria-label="Ödeme ve gönderim">
    <div className="sale-summary"><div><span>Ödeme</span><strong>{paymentLabels[status.payment]}</strong></div><div><span>Alınan</span><strong>{money(status.paid, doc.currency)}</strong></div><div><span>Kalan</span><strong>{money(status.remaining, doc.currency)}</strong></div><div><span>Gönderim</span><strong>{shippingLabels[status.shipping]}</strong></div></div>
    {status.adjusted > 0 && <p>İade / düzeltmeyle kapanan: {money(status.adjusted, doc.currency)}</p>}
    {doc.dueDate && <p>Vade: {doc.dueDate}</p>}
    {error && <p role="alert">{error}</p>}
    {status.order ? <button onClick={() => onOpenScreen?.('sales-orders', { orderId: status.order.id })}>Siparişin ödeme ve sevk kaydını aç</button> : <>
      {accounting && status.remaining > 0 && <button type="button" onClick={() => onOpenScreen?.('collections-overview', { kind: 'collection', partyId: doc.partyId, currency: doc.currency, amount: String(status.remaining / 100), settlementDocumentId: doc.id, documentNo: doc.number, workflowTaskId: `collection-${doc.id}` })}>Bu fişe tahsilat gir</button>}
      {status.credit && <p>Vade önerisi: {money(status.credit.amount, doc.currency)} · {status.credit.dueDate} · {{ PENDING: 'Onay bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' }[status.credit.status]}{status.credit.approver ? ` · ${status.credit.approver}` : ''} · {status.credit.reason}</p>}
      {accounting && status.shipping !== 'SHIPPED' && <div className="op-fields">
        {status.remaining > 0 && <label>Önerilen vade<input type="date" min={today()} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
        <label>Açıklama<input value={reason} onChange={e => setReason(e.target.value)} placeholder="Vade önerisi veya gönderim notu" /></label>
        {showDecision && status.credit?.status === 'PENDING' && <label>Onay veren (demo)<select value={approver} onChange={e => setApprover(e.target.value)}><option value="">Seçin</option><option>Semih</option><option>Angela</option></select></label>}
      </div>}
      <div className="op-actions">
        {accounting && status.remaining > 0 && status.shipping !== 'SHIPPED' && <button disabled={busy} onClick={() => act('propose-sale-credit')}>Vadeyi onaya gönder</button>}
        {showDecision && status.credit?.status === 'PENDING' && <><button disabled={busy} onClick={() => act('approve-sale-credit')}>Vadeyi onayla</button><button disabled={busy} onClick={() => act('reject-sale-credit')}>Öneriyi reddet</button></>}
        {!inQueue && mode !== 'BILL' && status.credit?.status === 'PENDING' && roleViewId === 'yonetici' && <button onClick={() => onOpenScreen?.('settings-overview')}>Onay listesini aç</button>}
        {accounting && status.shipping !== 'SHIPPED' && <button className="primary-action" disabled={busy || status.shipping !== 'READY'} onClick={() => act('ship-sale')}>Mal gönderildi olarak kaydet</button>}
      </div>
    </>}
    {doc.fulfillment?.shippedAt && <p>{new Date(doc.fulfillment.shippedAt).toLocaleString('tr-TR')} · {doc.fulfillment.shippingNote}</p>}
  </section>;
}
