// One finite synthetic finance case in the existing clean TEST. No source data,
// alternate database, login, currency inference or general write capability.
import {createHash} from 'node:crypto';
import {assertRegisteredCleanContext,isCleanAdministrator} from './cleanSyntheticContext.mjs';
import {isCleanPersonalWorkCandidate} from './cleanPersonnelManagement.mjs';
export const CLEAN_FINANCE_REHEARSAL=Object.freeze({id:'B4-TRY-20261023',date:'2026-10-22',customerId:'2',supplierId:'2',accountId:'2',invoiceId:'2',purchaseInvoiceId:'5',customerOpeningExact4:'251.0000',supplierOpeningExact4:'200.0000',currency:'TRY'});
// Explicit synthetic inputs, never current exchange rates or Vega balances.
// The native FX cohort must separately prove these exact identities before use.
export const CLEAN_FINANCE_FX_CASES=Object.freeze([
 Object.freeze({...CLEAN_FINANCE_REHEARSAL,id:'B4-USD-20261023',fxFixtureId:'1',customerId:'3',supplierId:'3',accountId:'3',invoiceId:'3',purchaseInvoiceId:'6',currency:'USD',rateExact8:'40.00000000',customerCode:'B4-ORNEK-M-USD',supplierCode:'B4-ORNEK-T-USD',customerName:'B4 Örnek USD Müşteri',supplierName:'B4 Örnek USD Tedarikçi',invoiceNumber:'B4-ORNEK-TAHSILAT-USD',purchaseNumber:'B4-ORNEK-ODEME-USD'}),
 Object.freeze({...CLEAN_FINANCE_REHEARSAL,id:'B4-EUR-20261023',fxFixtureId:'2',customerId:'4',supplierId:'4',accountId:'4',invoiceId:'4',purchaseInvoiceId:'7',currency:'EUR',rateExact8:'45.00000000',customerCode:'B4-ORNEK-M-EUR',supplierCode:'B4-ORNEK-T-EUR',customerName:'B4 Örnek EUR Müşteri',supplierName:'B4 Örnek EUR Tedarikçi',invoiceNumber:'B4-ORNEK-TAHSILAT-EUR',purchaseNumber:'B4-ORNEK-ODEME-EUR'}),
]);
export const cleanFinanceFxEnabled=()=>cleanFinanceCashEnabled()&&process.env.MELISA_CLEAN_FINANCE_FX==='20261023';
export function cleanFinanceFxCollectionCase(invoice,account){
 if(!cleanFinanceFxEnabled())return null;
 assertRegisteredCleanContext();
 if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_STORE_DAY!=='20261022'||process.env.MELISA_CLEAN_FINANCE!=='20261022')throw financeRehearsalError();
 return CLEAN_FINANCE_FX_CASES.find(p=>p.invoiceId===invoice?.id&&p.customerId===invoice?.customerId&&p.accountId===account?.id&&p.currency===invoice?.currency&&p.currency===account?.currency&&account.synthetic===true)??null;
}
export const CLEAN_FINANCE_REHEARSAL_PERMISSIONS=Object.freeze({collection_create:'finance.collection',collection_cancel:'finance.collection.cancel',payment:'finance.payment',payment_cancel:'finance.payment.cancel'});
export const cleanFinanceRehearsalEnabled=()=>process.env.MELISA_CLEAN_FINANCE_B4==='20261023';
export const CLEAN_FINANCE_CASH=Object.freeze({id:'B4-CASH-20261023',date:'2026-10-22',drawerId:1,currencies:Object.freeze(['TRY','USD','EUR']),accounts:Object.freeze({TRY:Object.freeze({drawer:2,main:5}),USD:Object.freeze({drawer:3,main:6}),EUR:Object.freeze({drawer:4,main:7})})});
export const cleanFinanceCashEnabled=()=>cleanFinanceRehearsalEnabled()&&process.env.MELISA_CLEAN_FINANCE_CASH==='20261023';
export function cleanFinanceCashWrite(request,environment=process.env){return environment.API_PORT==='4194'&&environment.MELISA_CLEAN_STORE_DAY==='20261022'&&environment.MELISA_CLEAN_FINANCE==='20261022'&&environment.MELISA_CLEAN_FINANCE_B4==='20261023'&&environment.MELISA_CLEAN_FINANCE_CASH==='20261023'&&request?.method==='POST'&&/^\/api\/finance\/cash-register\/(?:open|close|transfers|expenses)$/.test(request.path);}
export function financeCashRehearsalBinding(input){
 assertRegisteredCleanContext();
 const permission={cash_open:['finance.collection','finance.payment'],cash_close:['finance.collection','finance.payment'],cash_transfer:['finance.payment'],cash_expense:['finance.payment']}[input?.operation];
 const actor=input?.actor,normal=String(actor?.id)==='20'&&actor.username==='ornek-finans'&&String(actor.role?.id)==='25'&&actor.role?.code==='clean_test_finance';
 if(!cleanFinanceRehearsalEnabled()||process.env.MELISA_CLEAN_FINANCE_CASH!=='20261023'||process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_FINANCE!=='20261022'||!permission||(!normal&&!isCleanAdministrator(actor)&&!isCleanPersonalWorkCandidate(actor,'cash'))||actor?.isAdmin===true||actor?.testAdminSession===true||!Array.isArray(actor?.permissions)||!permission.some(p=>actor.permissions.includes(p))||!input.transaction||!input.pool||!input.sqlDriver||typeof input.payloadJson!=='string'||input.payloadJson.length>16000||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId??'')||!/^[a-f0-9]{64}$/.test(input.payloadHash??''))throw financeRehearsalError();
 let p;try{p=JSON.parse(input.payloadJson);}catch{throw financeRehearsalError();}
 const keys=(v,list)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===list.length&&Object.keys(v).every(k=>list.includes(k));
 const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000&&Math.abs(v*10000-Math.round(v*10000))<0.000001;
 const text=v=>typeof v==='string'&&v.length<=500;
 const common=['actorId','operation','requestId','expectedRevision'],fields={cash_open:['drawerId','businessDate','openingNote','counts'],cash_close:['sessionId','closingNote','counts'],cash_transfer:['sessionId','currency','amount','direction','description'],cash_expense:['sessionId','categoryId','currency','amount','description','documentNo']}[input.operation];
 if(!keys(p,[...common,...fields])||p.actorId!==String(actor.id)||p.operation!==input.operation||p.requestId!==input.requestId||!/^[a-f0-9]{64}$/.test(p.expectedRevision??'')||createHash('sha256').update(input.payloadJson,'utf16le').digest('hex')!==input.payloadHash)throw financeRehearsalError();
 if(input.operation==='cash_open'||input.operation==='cash_close'){
  const opening=input.operation==='cash_open',parts=opening?['physicalOpening','openingTransfer']:['physicalClosing','carryForward'];
  if(opening?(p.drawerId!==1||p.businessDate!==CLEAN_FINANCE_CASH.date||!text(p.openingNote)):(!Number.isSafeInteger(p.sessionId)||p.sessionId<1||!text(p.closingNote)))throw financeRehearsalError();
  if(!keys(p.counts,CLEAN_FINANCE_CASH.currencies)||CLEAN_FINANCE_CASH.currencies.some(c=>!keys(p.counts[c],parts)||parts.some(k=>!money(p.counts[c][k]))||(!opening&&p.counts[c].carryForward>p.counts[c].physicalClosing)))throw financeRehearsalError();
 }else if(!Number.isSafeInteger(p.sessionId)||p.sessionId<1||!CLEAN_FINANCE_CASH.currencies.includes(p.currency)||!money(p.amount)||p.amount<=0||p.amount>500||!text(p.description)||p.description.trim().length<5||(input.operation==='cash_transfer'?!['main_to_drawer','drawer_to_main'].includes(p.direction):p.categoryId!==1||!text(p.documentNo)))throw financeRehearsalError();
 return Object.freeze({...input,actor:Object.freeze({id:Number(actor.id)}),profile:CLEAN_FINANCE_CASH.id});
}
export function cleanFinanceRehearsalWrite(request,environment=process.env){
 return environment.API_PORT==='4194'&&environment.MELISA_CLEAN_STORE_DAY==='20261022'&&environment.MELISA_CLEAN_FINANCE==='20261022'&&environment.MELISA_CLEAN_FINANCE_B4==='20261023'&&request?.method==='POST'&&/^\/api\/(?:work-collections\/[1-9]\d*\/cancel|work-supplier-payments\/payments\/[1-9]\d*\/cancel)$/.test(request.path);
}
export function financeRehearsalError(){return Object.assign(new Error('Örnek finans işlemi doğrulanamadı.'),{code:'CLEAN_INBOUND_SCOPE_REQUIRED',statusCode:403});}
export function assertFinanceRehearsalActor(actor,operation){
 assertRegisteredCleanContext();
 const normalFinance=String(actor?.id)==='20'&&actor.username==='ornek-finans'&&String(actor.role?.id)==='25'&&actor.role?.code==='clean_test_finance';
 const checker=String(actor?.id)==='23'&&actor.username==='ornek-finans-kontrol'&&String(actor.role?.id)==='29'&&actor.role?.code==='clean_test_finance_checker';
 const allowed=Object.hasOwn(CLEAN_FINANCE_REHEARSAL_PERMISSIONS,operation)&&(isCleanAdministrator(actor)||isCleanPersonalWorkCandidate(actor,operation)||(operation.endsWith('_cancel')?checker:normalFinance));
 if(!cleanFinanceRehearsalEnabled()||process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_FINANCE!=='20261022'||!allowed||actor.isAdmin===true||actor.testAdminSession===true||!Array.isArray(actor.permissions)||!actor.permissions.includes(CLEAN_FINANCE_REHEARSAL_PERMISSIONS[operation]))throw financeRehearsalError();
 return actor;
}
export function financeRehearsalBinding(input){
 assertFinanceRehearsalActor(input?.actor,input?.operation);
 if(!input.transaction||!input.sqlDriver||typeof input.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId)||typeof input.payloadJson!=='string'||input.payloadJson.length>16000||!/^[a-f0-9]{64}$/.test(input.payloadHash??''))throw financeRehearsalError();
 let p;try{p=JSON.parse(input.payloadJson);}catch{throw financeRehearsalError();}
 if(!p||Array.isArray(p)||p.actorId!==String(input.actor.id)||p.operation!==input.operation||p.requestId!==input.requestId||p.documentDate!==CLEAN_FINANCE_REHEARSAL.date||createHash('sha256').update(input.payloadJson,'utf16le').digest('hex')!==input.payloadHash)throw financeRehearsalError();
 const profile=input.profile===undefined||input.profile===CLEAN_FINANCE_REHEARSAL.id?CLEAN_FINANCE_REHEARSAL:CLEAN_FINANCE_FX_CASES.find(c=>c.id===input.profile);
 const fx=profile!==CLEAN_FINANCE_REHEARSAL;
 if(!profile||fx&&(!cleanFinanceFxEnabled()||p.financeCaseId!==profile.id)||!fx&&p.financeCaseId!==undefined)throw financeRehearsalError();
 if(input.operation==='collection_create'&&(p.invoiceId!==profile.invoiceId||p.accountId!==profile.accountId)||input.operation==='payment'&&(p.supplierId!==profile.supplierId||p.accountId!==profile.accountId||p.invoiceId!==profile.purchaseInvoiceId||p.currency!==profile.currency)||input.operation.endsWith('_cancel')&&(typeof p.id!=='string'||!/^[1-9]\d*$/.test(p.id)||typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>300))throw financeRehearsalError();
 return Object.freeze({...input,actor:Object.freeze({id:Number(input.actor.id)}),profile:profile.id,nativePrefix:fx?'usp_clean_finance_b4_fx':'usp_clean_finance_b4'});
}
