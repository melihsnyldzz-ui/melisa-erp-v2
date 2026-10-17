import { assert, validDate, today } from './operationsShared.js';
import { financePosition } from './operationsFinance.js';

export const paymentLabels = { UNPAID: 'Ödeme bekliyor', PARTIAL: 'Kısmi ödendi', PAID: 'Ödendi', OFFSET: 'Borç kapandı' };
export const shippingLabels = { WAITING: 'Gönderim bekliyor', APPROVAL: 'Vade onayı bekliyor', READY: 'Gönderilebilir', SHIPPED: 'Gönderildi', RETURNED: 'İade / düzeltme ile kapandı' };
export const approvalMode = state => state.workflowSettings?.creditApprovalMode || 'BOTH';

export function saleStatus(state, doc) {
  const position = financePosition(state, doc.partyId, doc.currency);
  const invoice = position.invoices.find(row => row.id === doc.id);
  const allocations = position.allocations.filter(row => row.invoiceId === doc.id);
  const paid = allocations.filter(row => ['collection', 'order-payment'].includes(state.documents.find(d => d.id === row.sourceId)?.kind)).reduce((sum, row) => sum + row.amount, 0);
  const adjusted = allocations.filter(row => ['sales-return', 'delivery-correction'].includes(state.documents.find(d => d.id === row.sourceId)?.kind)).reduce((sum, row) => sum + row.amount, 0);
  const remaining = invoice?.open ?? doc.amount;
  const credit = doc.fulfillment?.credit;
  const authorized = credit?.status === 'APPROVED' && credit.amount >= remaining && credit.dueDate >= today();
  const order = state.orders.find(row => row.saleDocumentId === doc.id);
  const shipped = order ? order.fulfillment?.shipments?.some(s => s.status !== 'VOID') : Boolean(doc.fulfillment?.shippedAt);
  const returns = state.documents.filter(d => ['sales-return', 'delivery-correction'].includes(d.kind) && d.status === 'APPROVED' && d.referenceId === doc.id);
  const fullyReturned = doc.items?.length > 0 && doc.items.every(line => returns.reduce((sum,d) => sum + (d.items || []).filter(r => r.productId === line.productId).reduce((n,r) => n + Number(r.quantity),0),0) >= Number(line.quantity));
  return { paid, adjusted, remaining, credit, order,
    payment: remaining === 0 ? (adjusted ? 'OFFSET' : 'PAID') : paid > 0 ? 'PARTIAL' : 'UNPAID',
    shipping: shipped ? 'SHIPPED' : fullyReturned ? 'RETURNED' : credit?.status === 'PENDING' && remaining > 0 ? 'APPROVAL' : remaining === 0 || authorized ? 'READY' : 'WAITING',
  };
}

// Demo business rules; production must enforce these with authenticated server roles.
export function transitionSaleFulfillment(state, command) {
  if (command.type === 'save-workflow-settings') {
    assert(command.actorRole === 'yonetici', 'Ayarları yalnız yönetici değiştirir.');
    assert(['BILL', 'QUEUE', 'BOTH'].includes(command.mode), 'Onay görünümü geçersiz.');
    state.workflowSettings = { ...state.workflowSettings, creditApprovalMode: command.mode };
  } else {
    const doc = state.documents.find(row => row.id === Number(command.id));
    assert(doc?.kind === 'sale' && doc.status === 'APPROVED', 'Tamamlanmış satış fişi seçin.');
    const status = saleStatus(state, doc);
    assert(!status.order, 'Sipariş bağlantılı fişin sevkini sipariş ekranından yönetin.');
    const flow = doc.fulfillment ||= {};
    if (command.type === 'propose-sale-credit') {
      assert(['muhasebe', 'yonetici'].includes(command.actorRole), 'Vade önerisini muhasebe hazırlar.');
      assert(status.remaining > 0 && !flow.shippedAt, 'Gönderilmemiş, açık bakiyeli fiş seçin.');
      validDate(command.dueDate); assert(command.dueDate >= today(), 'Vade bugünden önce olamaz.');
      assert(String(command.reason || '').trim(), 'Vade önerisi için açıklama yazın.');
      flow.credit = { status: 'PENDING', amount: status.remaining, dueDate: command.dueDate, reason: command.reason.trim(), proposedAt: new Date().toISOString() };
    } else if (['approve-sale-credit', 'reject-sale-credit'].includes(command.type)) {
      assert(command.actorRole === 'yonetici', 'Semih veya Angela onayı gerekir.');
      assert(['Semih', 'Angela'].includes(command.approver), 'Onay veren kişiyi seçin.');
      assert(flow.credit?.status === 'PENDING', 'Bekleyen vade önerisi bulunamadı.');
      assert(status.remaining <= flow.credit.amount, 'Kalan borç değişti; muhasebe yeni öneri hazırlamalı.');
      assert(String(command.reason || '').trim(), 'Karar açıklaması yazın.');
      if (command.type === 'approve-sale-credit') assert(flow.credit.dueDate >= today(), 'Önerilen vade geçti; yeni vade önerin.');
      flow.credit = { ...flow.credit, status: command.type === 'approve-sale-credit' ? 'APPROVED' : 'REJECTED', approver: command.approver, decisionReason: command.reason.trim(), decidedAt: new Date().toISOString() };
      if (flow.credit.status === 'APPROVED') doc.dueDate = flow.credit.dueDate;
    } else if (command.type === 'ship-sale') {
      assert(['muhasebe', 'yonetici'].includes(command.actorRole), 'Gönderimi muhasebe veya yönetici kaydeder.');
      assert(status.shipping === 'READY', 'Ödeme tamamlanmadan veya vade onaylanmadan mal çıkışı yapılamaz.');
      assert(!flow.shippedAt, 'Gönderim zaten kaydedildi.');
      assert(String(command.reason || '').trim(), 'Gönderim açıklaması yazın.');
      flow.shippedAt = new Date().toISOString(); flow.shippingNote = command.reason.trim();
    } else throw Error('Gönderim komutu geçersiz.');
  }
  state.workflowAudit ||= [];
  state.workflowAudit.push({ action: command.type, documentId: command.id || null, actorRole: command.actorRole, approver: command.approver || null, reason: command.reason || '', at: new Date().toISOString() });
  state.revision++;
  return state;
}
