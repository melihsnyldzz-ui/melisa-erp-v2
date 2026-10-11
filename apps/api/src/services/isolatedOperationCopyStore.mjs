import {assertIsolatedCopyContext,copyAssert} from './isolatedOperationCopyContext.mjs';
import {createIsolatedOperationCopyStore} from './isolatedOperationCopyStoreFactory.mjs';
export * from './isolatedOperationCopyStoreFactory.mjs';

const workStores=new Map();
export async function getIsolatedOperationCopyWorkStore(domain){
 copyAssert(['trade','inbound','payment','daily'].includes(domain),'ISOLATED_COPY_DOMAIN');
 if(workStores.has(domain))return workStores.get(domain);
 const db=await import('../config/database.js');copyAssert(db.isIsolatedOperationCopyRuntime?.(),'ISOLATED_COPY_RUNTIME');
 const getRuntime=async()=>{
  copyAssert(db.isIsolatedOperationCopyRuntime(),'ISOLATED_COPY_RUNTIME');
  const copyContext=assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig());
  const [invoice,finance,audit,period,currency]=await Promise.all([import('./invoiceDraftService.js'),import('./financeService.js'),import('./auditService.js'),import('./periodLockService.js'),import('./nativeCurrencyAccount.mjs')]);
  return{copyContext,pool:await db.getSqlPool(),sql:db.getSqlDriver(),invoice,finance,audit,period,currency};
 };
 const file={trade:'./workTradeStore.mjs',inbound:'./workInboundStore.mjs',payment:'./workSupplierPaymentStore.mjs',daily:'./testDailyService.mjs'}[domain],builder={trade:'buildIsolatedCopyTradeDomain',inbound:'buildIsolatedCopyInboundDomain',payment:'buildIsolatedCopyPaymentDomain',daily:'buildIsolatedCopyDailyDomain'}[domain];
 const buildDomain=async args=>(await import(file))[builder](args);
 const store=createIsolatedOperationCopyStore({getRuntime,buildDomain,domain,readPermission:{trade:'sales.view',inbound:'goods.view',payment:'supplier.view',daily:'product.view'}[domain]});workStores.set(domain,store);return store;
}
