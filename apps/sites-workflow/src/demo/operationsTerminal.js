import { assert } from './operationsShared.js';
import { approveDocument, saveDocument, transitionReceipt } from './operationsDocuments.js';
import { transitionReview } from './operationsCorrections.js';
import { transitionOrder } from './operationsOrders.js';

// The repository commits one terminal ticket atomically. A completed sale posts
// its stock and customer balance immediately; physical counts still await review.
export function transitionTerminalSubmission(state, command) {
  assert(['satis', 'depo', 'muhasebe', 'yonetici'].includes(command.actorRole), 'Terminal görevi için rol seçin.');
  const { kind, input } = command;
  assert(input && typeof input === 'object', 'Terminal fişi boş.');
  const before = state.revision;
  if (kind === 'order') {
    assert(['satis', 'yonetici'].includes(command.actorRole), 'Siparişi satış veya yönetici hazırlar.');
    transitionOrder(state, { type: 'save-order', input });
    state.orders.at(-1).terminalRequestId = command.requestId;
  } else if (kind === 'sale') {
    assert(['satis', 'muhasebe', 'yonetici'].includes(command.actorRole), 'Satışı satış, muhasebe veya yönetici tamamlar.');
    assert(input.kind === 'sale', 'Fiş türü ile gönderilen kayıt uyuşmuyor.');
    saveDocument(state, { type: 'save', input });
    const doc = state.documents.at(-1);
    doc.terminalRequestId = command.requestId;
    if (!doc.salesPolicy?.requiresManager) approveDocument(null, state, doc);
  } else {
    assert(['receipt', 'count', 'sales-return', 'purchase-return'].includes(kind), 'Terminal işlem türü geçersiz.');
    assert(command.actorRole !== 'satis' || kind === 'sales-return', 'Satış personeli yalnız müşteri iadesi hazırlayabilir.');
    assert(command.actorRole !== 'depo' || kind !== 'sales-return', 'Müşteri iadesini satış veya muhasebe hazırlar.');
    assert(input.kind === kind, 'Fiş türü ile gönderilen kayıt uyuşmuyor.');
    if (kind === 'count' && input.terminalStockSnapshot) for (const line of input.items || []) {
      const current = state.products.find(product => product.id === String(line.productId));
      assert(current && current.stock === input.terminalStockSnapshot[line.productId], 'Çevrimdışı sayım sırasında stok değişti. Güncel stoğu inceleyip yeniden sayın.');
    }
    saveDocument(state, { type: 'save', input });
    const doc = state.documents.at(-1);
    doc.terminalRequestId = command.requestId;
    if (kind === 'receipt') transitionReceipt(state, doc, { type: 'submit-receipt' });
    else transitionReview(state, doc, { type: 'submit-review' });
  }
  state.revision = before + 1;
  if (kind === 'sale' && state.documents.at(-1).status === 'APPROVED') state.documents.at(-1).approvedRevision = state.revision;
  return state;
}
