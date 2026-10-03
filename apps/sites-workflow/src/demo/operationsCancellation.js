import { assert } from './operationsShared.js';
import { financePosition } from './operationsFinance.js';

export function assertCancellationSafe(state, doc) {
  assert(!doc.fulfillment?.shippedAt, 'Gönderilmiş satış için iade veya kontrollü düzeltme kullanın.');
  assert(!state.documents.some(d=>d.status==='APPROVED'&&(d.referenceId===doc.id||d.settlementDocumentId===doc.id)), 'Önce bağlı onaylı belgeleri iptal edin.');
  if(['sale','purchase'].includes(doc.kind)) {
    const allocated=financePosition(state,doc.partyId,doc.currency).allocations.some(a=>a.invoiceId===doc.id&&a.sourceId!==doc.id);
    assert(!allocated,'Faturaya bağlı tahsilat veya ödeme önce düzeltilmeli.');
  }
  if(['sales-return','purchase-return','delivery-correction'].includes(doc.kind)) {
    const refundKind=doc.kind==='purchase-return'?'supplier-refund':'customer-refund';
    assert(!state.documents.some(d=>d.status==='APPROVED'&&d.kind===refundKind&&d.partyId===doc.partyId&&d.currency===doc.currency&&(d.approvedRevision||0)>(doc.approvedRevision||0)), 'İadeye bağlı geri ödeme önce düzeltilmeli.');
  }
  const stockProducts=new Set(doc.kind==='count'?doc.items.map(line=>line.productId):state.movements.filter(m=>m.documentId===doc.id&&m.stockDelta).map(m=>m.productId));
  if(stockProducts.size) {
    const subsequent=state.documents.some(d=>d.id!==doc.id&&d.status==='APPROVED'&&(d.approvedRevision||0)>(doc.approvedRevision||0)&&(
      d.kind==='count'?d.items.some(line=>stockProducts.has(line.productId)):
      doc.kind==='count'&&state.movements.some(m=>m.documentId===d.id&&m.stockDelta&&stockProducts.has(m.productId))
    ));
    assert(!subsequent,'Bu ürün için sonraki sayım veya stok hareketi var; önce etkisini düzeltin.');
  }
  const session=state.cashSessions.find(s=>s.id<=doc.id&&s.closeDocumentId>=doc.id);
  if(session&&doc.kind!=='cash-close'&&state.movements.some(m=>m.documentId===doc.id&&m.cashDelta))assert(false,'Kapalı kasa hareketi iptal edilemez; yeni tarihte düzeltme oluşturun.');
  if(doc.kind==='cash-open')assert(!state.movements.some(m=>m.channel==='CASH'&&m.documentId!==doc.id&&m.documentId>doc.id&&(!session||m.documentId<session.closeDocumentId))&&!session?.closeDate,'Önce kasaya bağlı hareketleri ve kapanışı düzeltin.');
  if(doc.kind==='cash-close')assert(!state.cashSessions.some(s=>s.id>doc.id),'Yeni kasa oturumu varken eski kapanış geri alınamaz.');
}
