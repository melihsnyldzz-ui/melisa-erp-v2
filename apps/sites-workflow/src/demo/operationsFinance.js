import { assert, cents, currencies, financialChannels, validDate } from './operationsShared.js';
import { balance, activeOrderAdvance } from './operationsSelectors.js';
import { rateFor } from './operationsCards.js';

const empty = () => Object.fromEntries(currencies.map(currency => [currency, 0]));
export function accountBalance(state, channel, currency) {
  return channel === 'CASH' ? state.cash[currency] : state.accounts?.[channel]?.[currency] || 0;
}

// Replay approved documents in posting order. The running allocation is derived,
// so a cancelled receipt cannot leave an invoice permanently marked as paid.
export function financePosition(state, partyId, currency) {
  const invoices = [];
  const advances = new Map();
  const allocations = [];
  const docs = state.documents.filter(d => d.status === 'APPROVED' && d.partyId === partyId && d.currency === currency)
    .slice().sort((a,b) => (a.approvedRevision || a.id) - (b.approvedRevision || b.id) || a.id - b.id);
  const apply = (source, amount, target = null) => {
    let left = amount;
    for (const invoice of target ? invoices.filter(i => i.id === target) : invoices) {
      const used = Math.min(left, invoice.open);
      invoice.open -= used;
      if (used) allocations.push({ sourceId: source.id, invoiceId: invoice.id, amount: used });
      left -= used;
      if (!left) break;
    }
    return left;
  };
  for (const doc of docs) {
    if (['sale', 'purchase'].includes(doc.kind)) {
      const invoice = { id: doc.id, number: doc.number, date: doc.date, dueDate: doc.dueDate || null, amount: doc.amount, open: doc.amount, kind: doc.kind };
      invoices.push(invoice);
      if (doc.orderId) for (const advance of advances.get(doc.orderId) || []) apply(advance, advance.amount, doc.id);
    } else if (doc.kind === 'order-payment') {
      if (!advances.has(doc.orderId)) advances.set(doc.orderId, []);
      advances.get(doc.orderId).push(doc);
    } else if (['collection', 'payment'].includes(doc.kind)) {
      apply(doc, doc.amount, doc.settlementDocumentId || null);
    } else if (['sales-return', 'purchase-return','delivery-correction'].includes(doc.kind)) {
      apply(doc, doc.amount, doc.referenceId);
    }
  }
  const open = invoices.reduce((sum, invoice) => sum + invoice.open, 0);
  const reserved = activeOrderAdvance(state, partyId, currency);
  const free = balance(state, partyId, currency) + reserved;
  return { invoices, allocations, open, reserved, free, credit: Math.max(0, open - free), overdue: invoices.filter(i => i.open > 0 && i.dueDate && i.dueDate < new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date())) };
}

export function normalizeTransfer(state, input) {
  const date = String(input.date || ''); validDate(date);
  const from = String(input.from || ''), to = String(input.to || '');
  const sourceCurrency = String(input.sourceCurrency || ''), targetCurrency = String(input.targetCurrency || '');
  assert(financialChannels[from] && financialChannels[to], 'Hesap kanalı geçersiz.');
  assert(currencies.includes(sourceCurrency) && currencies.includes(targetCurrency), 'Para birimi geçersiz.');
  assert(from !== to || sourceCurrency !== targetCurrency, 'Kaynak ve hedef hesap aynı olamaz.');
  const amount = cents(input.amount); assert(amount > 0, 'Virman tutarı sıfırdan büyük olmalı.');
  const sourceRate = rateFor(state, sourceCurrency, date), targetRate = rateFor(state, targetCurrency, date);
  assert(sourceRate != null && targetRate != null, 'Bozdurma için iki para biriminin aynı tarihli kayıtlı TRY kuru gerekli.');
  const targetAmount = sourceCurrency === targetCurrency ? amount : Math.round(amount * sourceRate / targetRate);
  assert(targetAmount > 0 && Number.isSafeInteger(targetAmount), 'Bozdurma hedef tutarı geçersiz.');
  const reason = String(input.reason || '').trim(); assert(reason, 'Virman veya bozdurma açıklaması yazın.');
  return { date, from, to, sourceCurrency, targetCurrency, amount, targetAmount, sourceRate, targetRate, reason };
}

export function ensureFinanceShape(state) {
  state.accounts ||= { BANK: empty(), CARD: empty(), OTHER: empty() };
  for (const channel of ['BANK', 'CARD', 'OTHER']) { state.accounts[channel] ||= empty(); for (const currency of currencies) state.accounts[channel][currency] ??= 0; }
  // Old browser records already contain bank/card movements. Derive their opening
  // account totals once, rather than presenting existing receipts as missing.
  if (!state.accountBalancesInitialized) {
    for (const movement of state.movements) if (state.accounts[movement.channel] && movement.cashDelta === 0 && state.documents.find(d => d.id === movement.documentId)?.status === 'APPROVED') {
      if (movement.accountDelta) { state.accounts[movement.channel][movement.currency] += movement.accountDelta; continue; }
      const incoming = ['collection', 'order-payment', 'supplier-refund'].includes(movement.kind);
      const outgoing = ['payment', 'customer-refund', 'expense'].includes(movement.kind);
      if (incoming || outgoing) state.accounts[movement.channel][movement.currency] += (incoming ? 1 : -1) * Math.abs(movement.partyDelta || state.documents.find(d => d.id === movement.documentId)?.amount || 0);
    }
    state.accountBalancesInitialized = true;
  }
  state.cashSessions ||= [];
  if (!state.cashSessions.length) {
    const running = empty();
    let active = null;
    for (const doc of state.documents.filter(d => d.status === 'APPROVED').slice().sort((a,b) => (a.approvedRevision || a.id) - (b.approvedRevision || b.id) || a.id - b.id)) {
      if (doc.kind === 'cash-open') {
        active = { id:doc.id,date:doc.date,opening:{...running},closeDate:null,closing:null,adjustments:[] };
        state.cashSessions.push(active);
      }
      for (const m of state.movements.filter(m => m.documentId === doc.id && m.kind !== 'cancel')) running[m.currency] += m.cashDelta || 0;
      if (doc.kind === 'cash-close' && active) { active.closeDate=doc.date;active.closing={...running};active.closeDocumentId=doc.id;active=null; }
    }
  }
  state.cheques ||= [];
  state.activeCashSessionId ??= state.cashOpen ? state.documents.filter(d => d.kind === 'cash-open' && d.status === 'APPROVED').at(-1)?.id || null : null;
  return state;
}
