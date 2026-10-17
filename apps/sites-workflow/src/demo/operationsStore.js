// Connected demo composition: pure business commands plus browser repository.
import { createOperationsRepository, STORAGE_KEY } from './operationsRepository.js';
import { createBrowserLock } from './operationsBrowserLock.js';
import { transitionSaleFulfillment } from './saleFulfillment.js';
import { assert, clone } from './operationsShared.js';
import { seedOperations, ensureShape } from './operationsSeed.js';
import { transitionOrder } from './operationsOrders.js';
import { saveCard, saveRate } from './operationsCards.js';
import { approveDocument, cancelDocument, saveDocument, transitionReceipt } from './operationsDocuments.js';
import { transitionFinance } from './operationsFinanceCommands.js';
import { transitionReview } from './operationsCorrections.js';
import { transitionTerminalSubmission } from './operationsTerminal.js';
export { currencies, financialChannels, kinds, orderStatuses, today, cents } from './operationsShared.js';
export { balance, activeOrderAdvance, settlementBalance, reservedQuantity, availableStock, deriveWorkflowTasks } from './operationsSelectors.js';
export { seedOperations } from './operationsSeed.js';
export { productPrice, priceInput, productBarcodes, resolveProductBarcode, rateFor } from './operationsCards.js';
export { financePosition, accountBalance } from './operationsFinance.js';
export function transitionOperations(previous,command){
 const state=ensureShape(clone(previous));
 if(['save-workflow-settings','propose-sale-credit','approve-sale-credit','reject-sale-credit','ship-sale'].includes(command.type))return transitionSaleFulfillment(state,command);
 if(command.type==='terminal-submit')return transitionTerminalSubmission(state,command);
 if(['reverse-finance','register-cheque','clear-cheque','return-cheque'].includes(command.type))return transitionFinance(state,command);
 if(['save-order','advance-order','cancel-order','record-order-payment','authorize-order-policy','release-order-reservation','finalize-open-account','pack-order','ship-order','confirm-delivery','void-shipment'].includes(command.type)){
  const before=clone(state.orders.find(o=>o.id===Number(command.id))||null);
  const next=transitionOrder(state,command);const order=next.orders.find(o=>o.id===(Number(command.id)||next.nextOrderId-1));
  next.orderAudit||=[];next.orderAudit.push({orderId:order.id,action:command.type,before:before?.status||null,after:order.status,paidBefore:before?.paidAmount||0,paidAfter:order.paidAmount,reason:command.reason||order.cancelReason||order.creditDecision?.reason||'',at:new Date().toISOString()});return next;
 }
 if(command.type==='save-card')return saveCard(state,command);
 if(command.type==='save-rate')return saveRate(state,command);
 if(command.type==='save')return saveDocument(state,command);
 const doc=state.documents.find(d=>d.id===command.id);assert(doc,'Belge bulunamadı.');
 if(command.type==='authorize-sale-policy'){assert(doc.kind==='sale'&&doc.status==='DRAFT'&&doc.salesPolicy?.requiresManager,'Onay bekleyen satış istisnası yok.');assert(String(command.reason||'').trim(),'Yönetici onay gerekçesi zorunlu.');doc.managerApprovalAt=new Date().toISOString();doc.managerApprovalReason=String(command.reason).trim();state.salesAudit||=[];state.salesAudit.push({documentId:doc.id,action:'authorize-sale-policy',reason:doc.managerApprovalReason,at:doc.managerApprovalAt});state.revision++;return state;}
 if(['submit-receipt','return-receipt','map-unknown'].includes(command.type))return transitionReceipt(state,doc,command);
 if(['submit-review','return-review'].includes(command.type))return transitionReview(state,doc,command);
 if(command.type==='approve')return approveDocument(previous,state,doc);
 if(command.type==='cancel')return cancelDocument(previous,state,doc,command);
 throw Error('Desteklenmeyen komut.');
}
const repo=createOperationsRepository({
 storage:globalThis.localStorage||null,
 legacyStorage:globalThis.sessionStorage||null,
 lock:createBrowserLock(),
 seed:seedOperations,
});
let snapshot;const listeners=new Set();
function notify(){for(const listener of listeners)listener();}
function refresh(){const current=ensureShape(repo.read());if(!snapshot||snapshot.revision!==current.revision){snapshot=current;notify();}return snapshot;}
export const getOperations=()=>snapshot||refresh();
export const subscribeOperations=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
if(globalThis.window?.addEventListener)globalThis.window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){try{refresh();}catch{snapshot=undefined;notify();}}});
export async function dispatchOperations(command){
 const expectedRevision=command.expectedRevision??getOperations().revision;
 const requestId=command.requestId??globalThis.crypto?.randomUUID?.();
 try{const next=await repo.execute({...command,expectedRevision,requestId},transitionOperations);if(next.revision!==snapshot?.revision){snapshot=ensureShape(next);notify();}return next;}
 catch(error){try{refresh();}catch{/* Preserve the original command error. */}throw error;}
}
export const exportOperationsRaw=()=>repo.exportRaw();
export const getOperationsBackup=()=>repo.backup();
export async function restoreOperationsBackup(){const next=await repo.restore();snapshot=ensureShape(next);notify();return next;}
