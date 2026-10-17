import {paymentDate,paymentFail,paymentId,paymentKeys,paymentText,paymentUuid,supplierPaymentInput,supplierPaymentPreview} from './workSupplierPaymentModel.mjs';
async function defaultStore(){return (await import('./workSupplierPaymentStore.mjs')).workSupplierPaymentStore;}
function actorCheck(actor){if(String(actor?.id)!=='16'||!Array.isArray(actor.permissions))paymentFail('Bu işlem için yetkiniz bulunmuyor.',403,'WORK_PAYMENT_FORBIDDEN');return {...actor,id:'16'};}
function requireCap(c,key){if(c.context.capabilities[key]!==true)paymentFail('Bu işlem için yetkiniz bulunmuyor.',403,'WORK_PAYMENT_FORBIDDEN');}
export function createWorkSupplierPaymentService({getStore=defaultStore}={}){
 const read=async(actor,fn)=>{actor=actorCheck(actor);return (await getStore()).read(actor,c=>{requireCap(c,'canView');return fn(c);});};
 return {
  context:actor=>read(actor,c=>c.context),
  preview:(input,actor)=>read(actor,c=>supplierPaymentPreview(input,c.context)),
  request:(target,actor)=>read(actor,c=>c.request(paymentUuid(target))),
  async create(input,actor){actor=actorCheck(actor);const payload=supplierPaymentInput(input,true);return (await getStore()).mutate(actor,c=>{requireCap(c,'canPay');return c.journal('payment',payload,async()=>{
   if(payload.expectedRevision!==c.context.revision)paymentFail('Borç veya hesap bakiyesi değişti. Bilgileri yenileyin.',409,'WORK_PAYMENT_STALE');const {requestId,expectedRevision,previewHash,...selection}=payload,preview=supplierPaymentPreview(selection,c.context);if(previewHash!==preview.previewHash)paymentFail('Ödeme önizlemesi değişti. Yeniden kontrol edin.',409,'WORK_PAYMENT_PREVIEW');return {payment:await c.pay(selection,preview),requestId,replayed:false};
  });});},
  async cancel(target,input,actor){actor=actorCheck(actor);paymentKeys(input,['requestId','reason','documentDate']);const payload={id:paymentId(target),requestId:paymentUuid(input.requestId),reason:paymentText(input.reason,300),documentDate:paymentDate(input.documentDate)};if(payload.reason.trim().length<3)paymentFail('En az 3 karakter iptal açıklaması gerekli.');return (await getStore()).mutate(actor,c=>{requireCap(c,'canCancel');return c.journal('payment_cancel',payload,async()=>{
   if(payload.documentDate!==c.context.meta.date)paymentFail('İşlem tarihi bu ödeme kapsamında değil.',409,'WORK_PAYMENT_SCOPE');const original=c.context.payments.find(p=>p.id===payload.id&&p.kind==='payment');if(!original)paymentFail('Asıl ödeme bulunamadı.',404,'WORK_PAYMENT_NOT_FOUND');if(original.ownership!=='work'||!await c.ownsPayment(original.id))paymentFail('Bu kayıt bu ödeme ekranından geri alınamaz.',403,'WORK_PAYMENT_FORBIDDEN');if(original.reversedById!==null)paymentFail('Bu ödeme zaten geri alınmış.',409,'WORK_PAYMENT_ALREADY_CANCELLED');return {payment:await c.cancel(original,payload),requestId:payload.requestId,replayed:false};
  });});}
 };
}
export const workSupplierPaymentService=createWorkSupplierPaymentService();
