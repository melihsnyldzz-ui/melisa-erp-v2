import {homeError} from './homeSummaryModel.mjs';
import {assertIsolatedCopyContext,getBusinessDailySelection} from './isolatedOperationCopyContext.mjs';
import {createHomeSummaryReadStore as createFactory} from './homeSummaryReadStoreFactory.mjs';
import {getCleanContext,assertRegisteredCleanContext} from './cleanSyntheticContext.mjs';
export * from './homeSummaryReadStoreFactory.mjs';
async function defaultRuntime(){const db=await import('../config/database.js');if(getCleanContext())return {pool:await db.getSqlPool(),sql:db.getSqlDriver(),cleanContext:assertRegisteredCleanContext(),port:Number(process.env.API_PORT)};if(db.isIsolatedOperationCopyRuntime())return {pool:await db.getSqlPool(),sql:db.getSqlDriver(),copyContext:assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig())};if(!db.isCanonicalTest())throw homeError();return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createHomeSummaryReadStore({getRuntime=defaultRuntime,getDailySelection=getBusinessDailySelection,getDailyScopeHash}={}){return createFactory({getRuntime,getDailySelection,...(getDailyScopeHash?{getDailyScopeHash}:{})});}
export const homeSummaryReadStore=createHomeSummaryReadStore();
