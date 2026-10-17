import {homeError} from './homeSummaryModel.mjs';
import {assertIsolatedCopyContext,getBusinessDailySelection} from './isolatedOperationCopyContext.mjs';
import {createHomeSummaryReadStore as createFactory} from './homeSummaryReadStoreFactory.mjs';
export * from './homeSummaryReadStoreFactory.mjs';
async function defaultRuntime(){const db=await import('../config/database.js');if(db.isIsolatedOperationCopyRuntime())return {pool:await db.getSqlPool(),sql:db.getSqlDriver(),copyContext:assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig())};if(!db.isCanonicalTest())throw homeError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createHomeSummaryReadStore({getRuntime=defaultRuntime,getDailySelection=getBusinessDailySelection,getDailyScopeHash}={}){return createFactory({getRuntime,getDailySelection,...(getDailyScopeHash?{getDailyScopeHash}:{})});}
export const homeSummaryReadStore=createHomeSummaryReadStore();
