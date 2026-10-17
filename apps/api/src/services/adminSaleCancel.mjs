import {createHash} from 'node:crypto';
export const ADMIN_MODE='ADMIN_SALE_CANCEL';
export const ADMIN_REQUEST='ERP-LAST-UI-ACTOR-20261001-SALE';
export const ADMIN_DOCUMENT='TST70-4628afbb558461191822';
export const ADMIN_PAYLOAD_HASH=createHash('sha256').update(JSON.stringify({customerId:593,productId:301984,quantity:1})).digest('hex');
const fail=()=>{throw Object.assign(Error('Admin kabulü yalnız kendi tahsilatsız paket fişine uygulanabilir.'),{code:'TEST_ADMIN_CANCEL_BOUNDARY',statusCode:409})};
export function assertAdminCancel({actor,request,invoice,id,collections,stock,balance,cash}){
 if(Number(actor?.id)!==1||actor?.role?.code!=='admin'||!['sales.create','sales.finalize','sales.cancel'].every(p=>actor.permissions?.includes(p)))fail();
 if(request?.request_id!==ADMIN_REQUEST||request.payload_hash!==ADMIN_PAYLOAD_HASH||Number(request.actor_id)!==1||Number(request.invoice_actor_id)!==1||Number(request.invoice_id)!==Number(id)||!Number.isSafeInteger(Number(id))||Number(id)<1)fail();
 if(Number(invoice?.id)!==Number(id)||invoice.documentNo!==ADMIN_DOCUMENT||Number(invoice.customerId)!==593||invoice.grandTotal!==100||!['FINALIZED','CANCELLED'].includes(invoice.status))fail();
 if(!Array.isArray(collections)||collections.length!==0||!Array.isArray(invoice.items)||invoice.items.length!==1||Number(invoice.items[0].productId)!==301984||invoice.items[0].quantity!==1)fail();
 const cancelled=invoice.status==='CANCELLED';
 if(stock!==(cancelled?20:19)||balance!==(cancelled?0:100)||cash!==0)fail();
}
