// One finite synthetic finance case in the existing clean TEST. No source data,
// alternate database, login, currency inference or general write capability.
import {createHash} from 'node:crypto';
import {assertRegisteredCleanContext,isCleanAdministrator} from './cleanSyntheticContext.mjs';
export const CLEAN_FINANCE_REHEARSAL=Object.freeze({id:'B4-TRY-20261023',date:'2026-10-22',customerId:'2',supplierId:'2',accountId:'2',invoiceId:'2',purchaseInvoiceId:'5',customerOpeningExact4:'251.0000',supplierOpeningExact4:'200.0000',currency:'TRY'});
export const CLEAN_FINANCE_REHEARSAL_PERMISSIONS=Object.freeze({collection_create:'finance.collection',collection_cancel:'finance.collection.cancel',payment:'finance.payment',payment_cancel:'finance.payment.cancel'});
export const cleanFinanceRehearsalEnabled=()=>process.env.MELISA_CLEAN_FINANCE_B4==='20261023';
export function cleanFinanceRehearsalWrite(request,environment=process.env){
 return environment.API_PORT==='4194'&&environment.MELISA_CLEAN_STORE_DAY==='20261022'&&environment.MELISA_CLEAN_FINANCE==='20261022'&&environment.MELISA_CLEAN_FINANCE_B4==='20261023'&&request?.method==='POST'&&/^\/api\/(?:work-collections\/[1-9]\d*\/cancel|work-supplier-payments\/payments\/[1-9]\d*\/cancel)$/.test(request.path);
}
export function financeRehearsalError(){return Object.assign(new Error('Örnek finans işlemi doğrulanamadı.'),{code:'CLEAN_INBOUND_SCOPE_REQUIRED',statusCode:403});}
export function assertFinanceRehearsalActor(actor,operation){
 assertRegisteredCleanContext();
 const normalFinance=String(actor?.id)==='20'&&actor.username==='ornek-finans'&&String(actor.role?.id)==='25'&&actor.role?.code==='clean_test_finance';
 const checker=String(actor?.id)==='23'&&actor.username==='ornek-finans-kontrol'&&String(actor.role?.id)==='29'&&actor.role?.code==='clean_test_finance_checker';
 const allowed=Object.hasOwn(CLEAN_FINANCE_REHEARSAL_PERMISSIONS,operation)&&(operation.endsWith('_cancel')?checker:normalFinance||isCleanAdministrator(actor));
 if(!cleanFinanceRehearsalEnabled()||process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_FINANCE!=='20261022'||!allowed||actor.isAdmin===true||actor.testAdminSession===true||!Array.isArray(actor.permissions)||!actor.permissions.includes(CLEAN_FINANCE_REHEARSAL_PERMISSIONS[operation]))throw financeRehearsalError();
 return actor;
}
export function financeRehearsalBinding(input){
 assertFinanceRehearsalActor(input?.actor,input?.operation);
 if(!input.transaction||!input.sqlDriver||typeof input.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId)||typeof input.payloadJson!=='string'||input.payloadJson.length>16000||!/^[a-f0-9]{64}$/.test(input.payloadHash??''))throw financeRehearsalError();
 let p;try{p=JSON.parse(input.payloadJson);}catch{throw financeRehearsalError();}
 if(!p||Array.isArray(p)||p.actorId!==String(input.actor.id)||p.operation!==input.operation||p.requestId!==input.requestId||p.documentDate!==CLEAN_FINANCE_REHEARSAL.date||createHash('sha256').update(input.payloadJson,'utf16le').digest('hex')!==input.payloadHash)throw financeRehearsalError();
 if(input.operation==='collection_create'&&(p.invoiceId!=='2'||p.accountId!=='2')||input.operation==='payment'&&(p.supplierId!=='2'||p.accountId!=='2'||p.invoiceId!=='5'||p.currency!=='TRY')||input.operation.endsWith('_cancel')&&(typeof p.id!=='string'||!/^[1-9]\d*$/.test(p.id)||typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>300))throw financeRehearsalError();
 return Object.freeze({...input,actor:Object.freeze({id:Number(input.actor.id)}),profile:CLEAN_FINANCE_REHEARSAL.id});
}
