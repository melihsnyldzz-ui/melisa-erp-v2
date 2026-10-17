import React, { useEffect, useMemo, useState } from 'react';
import { fetchFinanceMovements } from '../../services/financeApi.js';
import { printFinanceReceipt } from '../../utils/exportUtils.js';
import { CollectionsReceiptPanel } from './CollectionsReceiptPanel.jsx';
import { linkedReceiptQuery, readLinkedReceipt, receiptFromMovement } from './financeReceiptNavigation.js';

export function LinkedFinanceReceiptScreen({ initialPayload = {}, contextRevision = 0, permissions = [], onOpenScreen }) {
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => {
    try { return { query: linkedReceiptQuery(initialPayload), error: '' }; }
    catch (error) { return { query: null, error: error.message }; }
  }, [initialPayload.mode, initialPayload.movementId, initialPayload.customerId, initialPayload.supplierId, contextRevision]);
  const allowed = Array.isArray(permissions) && (request.query?.partyType === 'supplier'
    ? permissions.includes('supplier.view') && permissions.includes('finance.view')
    : permissions.includes('customer.view'));
  const key = JSON.stringify({ query: request.query, allowed, revision, contextRevision });
  const [state, setState] = useState({ key: '', row: null, error: '', loading: false });
  useEffect(() => {
    let active = true;
    if (!request.query || !allowed) return () => { active = false; };
    setState({ key, row: null, error: '', loading: true });
    Promise.resolve().then(() => fetchFinanceMovements(request.query)).then(response => readLinkedReceipt(response, request.query))
      .then(row => { if (active) setState({ key, row, error: '', loading: false }); })
      .catch(error => { if (active) setState({ key, row: null, error: error.message || 'Makbuz okunamadı.', loading: false }); });
    return () => { active = false; };
  }, [key]);
  const current = state.key === key ? state : { row: null, loading: Boolean(request.query && allowed), error: '' };
  const row = allowed && request.query ? current.row : null;
  const receipt = row ? receiptFromMovement(row) : null;
  const error = request.error || (!allowed ? 'Bu makbuzun cari ve finans bilgilerini görüntüleme yetkiniz yok.' : current.error);
  const openParty = () => {
    if (!row) return;
    const supplier = row.partyType === 'supplier';
    onOpenScreen?.(supplier ? 'supplier-card' : 'customer-card', supplier
      ? { supplierId: row.partyId, supplierCode: row.partyCode } : { customerId: row.partyId, customerCode: row.partyCode });
  };
  return <main className="work-area collections-overview-screen" aria-label="Kayıtlı tahsilat veya ödeme makbuzu">
    <section className="erp-panel collections-hero-panel">
      <div className="collections-hero-copy"><strong>{initialPayload.mode === 'payment' ? 'Kayıtlı Ödeme' : 'Kayıtlı Tahsilat'}</strong><small>Seçtiğiniz hareketin makbuzu</small></div>
      <div className="collections-hero-actions">
        {row && <button type="button" onClick={openParty}>Cari Kartını Aç</button>}
        <button type="button" disabled={!allowed || !request.query || current.loading} onClick={() => setRevision(value => value + 1)}>Yenile</button>
      </div>
    </section>
    {error && <p className="list-state list-state-error" role="alert">{error}</p>}
    {current.loading && <p className="list-state" role="status">Makbuz yükleniyor…</p>}
    <CollectionsReceiptPanel selectedReceipt={receipt} onPrint={() => receipt && printFinanceReceipt(receipt)} onClose={openParty} />
  </main>;
}
