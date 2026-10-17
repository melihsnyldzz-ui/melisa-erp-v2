import {inboundEsc as esc,inboundState} from './workInboundModel.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const text=v=>typeof v==='string'&&v.length<=500;
const quantity=v=>typeof v==='string'&&/^(?:0|[1-9]\d*)\.\d{3}$/.test(v);
const noteLabels=new Map([
 ['SYNTHETIC FINAL04 daily received unit; not real store-day acceptance','Eğitim turunda kaydedilen mal kabulü; gerçek mağaza günü kabulü değildir.'],
 ['SYNTHETIC TEST daily chain','Eğitim turunda kaydedilen sayım satırı.'],
]);
// Exact historical display labels only. Never classify origin or mutate raw notes.
export const receivingNotePresentation=value=>noteLabels.get(value)??value;
export function receivingSupplier(context,receipt){const s=context?.scope?.supplier;return id(receipt?.supplierId)&&receipt.supplierId===s?.id&&typeof s.name==='string'&&typeof s.code==='string'?s:null;}
// Only native IDs and immutable submitted quantities link these records.
// No stock code/name matching, receipt working quantities, or person-name inference.
export function receivingHandoff(context,{countId,receiptId}={}){
 if(!Array.isArray(context?.countDrafts)||!Array.isArray(context?.receipts))return null;
 if(countId!==undefined){if(!id(countId))return null;const counts=context.countDrafts.filter(d=>d.id===countId);if(counts.length!==1)return null;receiptId=counts[0].receiptId;}
 if(!id(receiptId))return null;
 const receipts=context.receipts.filter(r=>r.id===receiptId),counts=context.countDrafts.filter(d=>d.receiptId===receiptId);
 if(receipts.length!==1||counts.length!==1)return null;const receipt=receipts[0],count=counts[0];
 if(!id(count.id)||context.countDrafts.filter(d=>d.id===count.id).length!==1||countId!==undefined&&count.id!==countId||count.state!=='submitted'||!['pending','accepted','rejected'].includes(receipt.state)||!receivingSupplier(context,receipt)||receipt.warehouseId!==context.scope?.warehouse?.id||!text(count.note)||!Array.isArray(count.lines)||!Array.isArray(receipt.lines)||!count.lines.length||count.lines.length!==receipt.lines.length)return null;
 const linePairs=[];
 for(const line of receipt.lines){
  if(!id(line.id)||!id(line.productId)||typeof line.clientLineId!=='string'||!line.clientLineId||receipt.lines.filter(x=>x.id===line.id).length!==1||receipt.lines.filter(x=>x.clientLineId===line.clientLineId&&x.productId===line.productId).length!==1)return null;
  const matches=count.lines.filter(x=>x.clientLineId===line.clientLineId&&x.productId===line.productId);if(matches.length!==1)return null;const counted=matches[0];
  if(!quantity(line.quantityExact3)||counted.physicalQuantityExact3!==line.quantityExact3||counted.expectedQuantityExact3!==null||![null,'short','over','wrong'].includes(counted.issue)||!text(counted.note)||!(counted.barcode===null||typeof counted.barcode==='string'&&counted.barcode.length<=160))return null;
  linePairs.push({receiptLine:line,countLine:counted});
 }
 return{count,receipt,supplier:receivingSupplier(context,receipt),linePairs};
}
export function receivingCountHandoffHtml(context,count){
 if(count?.state!=='submitted')return'';const linked=receivingHandoff(context,{countId:count.id});
 return linked?`<p class="inbound-note">Bağlı kabul #${esc(linked.receipt.id)} · ${esc(inboundState(linked.receipt.state))}. Sayım: ${esc(inboundState(linked.count.state))}.</p>`:'<p class="inbound-note">Bağlı kabul kaydı bu kapsamda doğrulanamadı.</p>';
}
export function receivingReceiptHandoffHtml(context,receipt){
 const supplier=receivingSupplier(context,receipt),linked=receivingHandoff(context,{receiptId:receipt.id});
 return`${supplier?`<p>Tedarikçi: <b>${esc(supplier.code)} · ${esc(supplier.name)}</b></p>`:'<p>Tedarikçi bilgisi bu kapsamda görüntülenemiyor.</p>'}${linked?`<p>Sayım #${esc(linked.count.id)} · ${esc(inboundState(linked.count.state))} → Kabul: ${esc(inboundState(receipt.state))}</p>${linked.count.note?`<p>Sayım açıklaması: ${esc(receivingNotePresentation(linked.count.note))}</p>`:''}<button class="btn" data-count-review="${esc(linked.count.id)}">Sayımı incele</button>`:'<p class="inbound-note">Bu kabulün sayım bağlantısı doğrulanamadı.</p>'}`;
}
export function receivingLineHandoffHtml(context,receipt,line){
 const linked=receivingHandoff(context,{receiptId:receipt.id}),pairs=linked?.linePairs.filter(p=>p.receiptLine.id===line.id&&p.receiptLine.clientLineId===line.clientLineId&&p.receiptLine.productId===line.productId)??[];if(pairs.length!==1)return'';const counted=pairs[0].countLine,issue={short:'Eksik',over:'Fazla',wrong:'Yanlış ürün'}[counted.issue];
 return`<small>Barkod: ${esc(counted.barcode??'Bilinmiyor')}</small><small>Beklenen adet bilinmiyor.</small>${issue?`<small>Sayımda seçilen not: ${issue}</small>`:''}${counted.note?`<small>Satır açıklaması: ${esc(receivingNotePresentation(counted.note))}</small>`:''}`;
}
export function receivingCountOpenGuard({editor,dirty,locked,backupFailed}={},target){
 if(locked)return{allowed:false,message:'Önce son kaydın sonucunu doğrulayın. Açık sayım korunuyor.'};
 if(backupFailed)return{allowed:false,message:'Cihaz yedeği henüz doğrulanmadı. Açık sayım ve kurtarma kaydı korunuyor.'};
 if(editor&&(dirty||editor.id===null))return{allowed:false,message:'Önce açık sayımı kaydedin. Sayım açılmadı; satırlarınız ve cihaz yedeğiniz korunuyor.'};
 if(!id(target?.id))return{allowed:false,message:'Sayım kaydı bu kapsamda görüntülenemiyor.'};
 return{allowed:true,message:''};
}
