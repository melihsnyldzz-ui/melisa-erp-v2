import { assert, cents, currencies, today, validDate } from './operationsShared.js';
import { financePosition } from './operationsFinance.js';
import { applyEntries, movement } from './operationsDocuments.js';
import { rateFor } from './operationsCards.js';

export function transitionFinance(state, command) {
  if (command.type === 'reverse-finance') {
    const source = state.documents.find(d => d.id === Number(command.id));
    assert(source && source.status === 'APPROVED' && ['collection','payment','customer-refund','supplier-refund','expense'].includes(source.kind), 'Düzeltilecek onaylı finans belgesi bulunamadı.');
    const reason = String(command.reason || '').trim(); assert(reason, 'Düzeltme gerekçesi zorunlu.');
    const date = today();
    const original = state.movements.filter(m => m.documentId === source.id && m.kind !== 'cancel');
    assert(original.length === 1, 'Finans belgesi hareketi doğrulanamadı.');
    if (source.channel === 'CASH') {
      assert(state.cashOpen, 'Kapalı dönemin nakit düzeltmesi için önce bugünün kasasını açın.');
      assert(state.cashSessions.at(-1)?.date <= date, 'Kasa oturumu tarihi geçersiz.');
    }
    const id = state.nextId++;
    const doc = { id, number:`DEMO-${String(id).padStart(5,'0')}`, kind:'finance-reversal',date,currency:source.currency,partyId:source.partyId,channel:source.channel,referenceId:source.id,reason,status:'APPROVED',items:[],amount:source.amount,approvedAt:new Date().toISOString() };
    const m = original[0];
    const inverse = movement(doc,{partyDelta:-m.partyDelta,cashDelta:-m.cashDelta,accountDelta:-(m.accountDelta || 0)});
    applyEntries(state,[inverse]); state.movements.push(inverse);
    source.status = 'REVERSED'; source.reversedBy = id;
    if (source.chequeId) { const cheque=state.cheques.find(c=>c.id===source.chequeId); if(cheque){cheque.status='REVERSED';cheque.reversalDocumentId=id;} }
    state.revision++;doc.approvedRevision=state.revision;state.documents.push(doc);
    return state;
  }
  if (command.type === 'register-cheque') {
    assert(state.customers.some(p => p.id === String(command.partyId)), 'Çek müşterisi bulunamadı.');
    assert(currencies.includes(command.currency), 'Çek para birimi geçersiz.');
    const number = String(command.number || '').trim(), bank = String(command.bank || '').trim();
    assert(number && bank, 'Çek numarası ve banka zorunlu.');
    assert(!state.cheques.some(c => c.number === number && c.bank === bank), 'Çek numarası bu bankada kayıtlı.');
    const dueDate = String(command.dueDate || ''); validDate(dueDate, 'Çek vadesi geçersiz.');
    const amount = cents(command.amount); assert(amount > 0, 'Çek tutarı pozitif olmalı.');
    assert(financePosition(state,String(command.partyId),command.currency).open >= amount, 'Çek tutarı açık fatura toplamını aşamaz.');
    const id = state.nextId++;
    state.cheques.push({id,number,bank,dueDate,amount,currency:command.currency,partyId:String(command.partyId),status:'PENDING',createdAt:new Date().toISOString()});
    state.revision++;return state;
  }
  const cheque = state.cheques.find(c => c.id === Number(command.id));
  assert(cheque && cheque.status === 'PENDING', 'Bekleyen çek bulunamadı.');
  if (command.type === 'return-cheque') {
    const reason = String(command.reason || '').trim();assert(reason, 'Çek iade gerekçesi yazın.');
    cheque.status='RETURNED';cheque.reason=reason;state.revision++;return state;
  }
  assert(command.type === 'clear-cheque','Finans komutu tanınmadı.');
  assert(cheque.dueDate <= today(), 'Çek vadesi henüz gelmedi.');
  assert(financePosition(state,cheque.partyId,cheque.currency).open >= cheque.amount, 'Açık belge tutarı çekin tahsiline yetmiyor.');
  const id = state.nextId++,date=today();
  const doc = {id,number:`DEMO-${String(id).padStart(5,'0')}`,kind:'collection',date,currency:cheque.currency,exchangeRate:rateFor(state,cheque.currency,date),partyId:cheque.partyId,referenceId:null,reason:`${cheque.bank} ${cheque.number} çek tahsili`,status:'APPROVED',items:[],amount:cheque.amount,channel:'BANK',chequeId:cheque.id,approvedAt:new Date().toISOString()};
  const entry=movement(doc,{partyDelta:-cheque.amount,accountDelta:cheque.amount});
  applyEntries(state,[entry]);state.movements.push(entry);state.revision++;doc.approvedRevision=state.revision;state.documents.push(doc);
  cheque.status='CLEARED';cheque.collectionDocumentId=id;cheque.clearedAt=doc.approvedAt;
  return state;
}
