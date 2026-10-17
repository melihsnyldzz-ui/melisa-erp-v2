import { assert, quantity } from './operationsShared.js';

export const returnReasons = {
  WRONG:'Yanlış ürün', EXCESS:'Fazla ürün', MISSING:'Eksik teslim',
  CONSIGNMENT:'Konsinye dönüş', OTHER:'Diğer gerekçe',
};

export function normalizeReview(input, kind, items) {
  const raw = kind === 'count' ? input.countSession : input.returnFlow;
  if (!raw) return null; // Existing saved demo records retain their old approval path.
  const countedBy=String(raw.countedBy||'').trim(),note=String(raw.note||'').trim();
  assert(countedBy&&note,'Hazırlayan kişi ve inceleme notu zorunlu.');
  if (kind === 'count') {
    const investigation = Object.fromEntries(Object.entries(raw.investigation||{}).map(([id,value])=>[String(id),String(value||'').trim()]));
    return {stage:'COUNTING',countedBy,note,investigation,history:[]};
  }
  const reasonCode=String(raw.reasonCode||'');
  assert(Object.hasOwn(returnReasons,reasonCode),'İade nedeni seçin.');
  if(kind==='delivery-correction')assert(reasonCode==='MISSING','Eksik teslim düzeltmesi için eksik teslim nedenini seçin.');
  else assert(reasonCode!=='MISSING','Eksik teslim için fiziksel iade yerine düzeltme belgesi açın.');
  const boxCount=quantity(raw.boxCount,kind==='delivery-correction');
  if(kind==='delivery-correction')assert(boxCount===0,'Eksik teslimde fiziksel iade kolisi olmamalı.');
  if(kind!=='delivery-correction')assert(boxCount>0,'Fiziksel iade için koli sayısı zorunlu.');
  assert(items.length,'En az bir ürün sayılmalı.');
  return {stage:'COUNTING',countedBy,note,reasonCode,boxCount,history:[]};
}

export function transitionReview(state, doc, command) {
  const review=doc.kind==='count'?doc.countSession:doc.returnFlow;
  assert(review&&doc.status==='DRAFT','İnceleme bekleyen taslak bulunamadı.');
  const reason=String(command.reason||'').trim();
  if (command.type==='submit-review') {
    assert(review.stage==='COUNTING','Geri gönderilen sayımı önce gerekçeyle düzeltin.');
    if(doc.kind==='count')for(const line of doc.items)if(line.quantity!==line.stockBefore)assert(review.investigation[line.productId],'Farklı sayılan her ürünün fark nedenini yazın.');
    review.stage='REVIEW';
  } else if (command.type==='return-review') {
    assert(review.stage==='REVIEW'&&reason,'Muhasebe geri gönderme gerekçesi zorunlu.');
    review.stage='RETURNED';review.returnReason=reason;
  } else throw Error('İnceleme aşaması geçersiz.');
  review.history.push({action:command.type,reason,at:new Date().toISOString()});
  state.revision++;return state;
}

export function assertCountFresh(state, doc) {
  const productIds=new Set(doc.items.map(line=>line.productId));
  const changed=state.movements.slice(doc.stockMovementIndex ?? 0).some(m=>m.stockDelta&&productIds.has(m.productId));
  assert(!changed,'Sayım yapılan ürünün stoku değişti. Farkı araştırıp yeniden sayın.');
}

export function returnableLines(state, original, kind) {
  const kinds=kind==='purchase-return'?['purchase-return']:['sales-return','delivery-correction'];
  const prior=state.documents.filter(d=>d.referenceId===original.id&&d.status==='APPROVED'&&kinds.includes(d.kind));
  return original.items.map(source=>({productId:source.productId,remaining:source.quantity-prior.flatMap(d=>d.items).filter(i=>i.productId===source.productId).reduce((sum,line)=>sum+line.quantity,0)}));
}
