import {validateIsolatedOperationCopyContext,validateIsolatedCopyReadyRevision,validateIsolatedCopyReadyPerformanceRevision,validateIsolatedCopyEffectsPerformanceRevision,isolatedCopyTopology,SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE,copyAssert} from './isolatedOperationCopyContext.mjs';
import {assertSharedCopyRelease} from './sharedCopyRelease.mjs';
import {validateBusinessDailyRevision} from './businessDailyRevisionBootstrap.mjs';
import {validateBusinessDailyProfitRevision} from './businessDailyProfitRevision.mjs';
import {validateBusinessDailyNativeCheckRevision} from './businessDailyNativeCheck.mjs';
import {validateBusinessReadinessQueryPlanRevision} from './businessReadinessQueryPlanRevision.mjs';
import {validateBusinessSelectedSaleStartupPin} from './businessSelectedSaleStartup.mjs';
import {validateProductCopyPurchaseReferencePin} from './productCopyPurchaseReferenceService.mjs';
const validatedDailyScopes=new WeakMap();
export function validateSharedCopyBootstrap(config){
 const context=validateIsolatedOperationCopyContext(config?.copyContext),topology=isolatedCopyTopology(context);
 copyAssert([SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE].includes(context.target.database)&&config.lanHost==='192.168.1.46','SHARED_FINITE_TARGET');
 copyAssert(config.host==='127.0.0.1'&&config.erpPort===topology.apiPort&&config.nativePort===topology.nativePort&&config.webPort===topology.webPort&&config.database===context.target.database&&config.server===context.target.server&&config.sqlUser===topology.reader&&config.salesSqlUser===context.target.login&&typeof config.jwtAccessSecret==='string'&&config.jwtAccessSecret.length>=48&&typeof config.jwtRefreshSecret==='string'&&config.jwtRefreshSecret.length>=48,'STAGE4_CONFIG_IDENTITY');
 if(config.businessReadyRevision!==undefined){copyAssert(config.copyAdapterRevision===undefined,'STAGE4_REVISION_CONFIG');validateIsolatedCopyReadyRevision(context,config.businessReadyRevision);}
 if(config.businessReadyPerformanceRevision!==undefined){copyAssert(config.copyAdapterRevision===undefined&&config.businessReadyRevision!==undefined,'STAGE4_REVISION_CONFIG');validateIsolatedCopyReadyPerformanceRevision(context,config.businessReadyRevision,config.businessReadyPerformanceRevision);}
 if(config.businessEffectsPerformanceRevision!==undefined){copyAssert(config.copyAdapterRevision===undefined&&config.businessReadyRevision!==undefined&&config.businessReadyPerformanceRevision!==undefined,'STAGE4_REVISION_CONFIG');validateIsolatedCopyEffectsPerformanceRevision(context,config.businessReadyRevision,config.businessReadyPerformanceRevision,config.businessEffectsPerformanceRevision);}
 if(config.businessDailyRevision!==undefined){copyAssert(config.businessEffectsPerformanceRevision!==undefined,'STAGE4_REVISION_CONFIG');validateBusinessDailyRevision(context,config.businessReadyRevision,config.businessReadyPerformanceRevision,config.businessEffectsPerformanceRevision,config.businessDailyRevision);validatedDailyScopes.set(context,{scopeHash:config.businessDailyRevision.dailyScopeHash,selection:structuredClone(config.businessDailyRevision.dailyScope.selection)});}
 if(config.businessDailyProfitRevision!==undefined){copyAssert(config.businessDailyRevision!==undefined,'STAGE4_REVISION_CONFIG');validateBusinessDailyProfitRevision(config.businessDailyRevision,config.businessDailyProfitRevision);}
 if(config.businessDailyNativeCheck!==undefined){copyAssert(config.businessDailyProfitRevision!==undefined,'STAGE4_REVISION_CONFIG');validateBusinessDailyNativeCheckRevision(config.businessDailyRevision,config.businessDailyProfitRevision,config.businessDailyNativeCheck);}
 if(config.businessReadinessQueryPlanRevision!==undefined){copyAssert(config.businessDailyProfitRevision!==undefined&&context.target.database===BUSINESS_COPY_DATABASE,'STAGE4_REVISION_CONFIG');validateBusinessReadinessQueryPlanRevision(config.businessDailyRevision,config.businessDailyProfitRevision,config.businessReadinessQueryPlanRevision);}
 if(context.target.database===BUSINESS_COPY_DATABASE)copyAssert(config.copyAdapterRevision===undefined,'STAGE4_REVISION_CONFIG');
 validateBusinessSelectedSaleStartupPin(config,context);
 if(config.productPurchaseReferenceCopyRead!==undefined){copyAssert(config.businessSelectedSaleStartup!==undefined,'COPY_PURCHASE_REFERENCE_QUARANTINE_PROOF_REQUIRED');validateProductCopyPurchaseReferencePin(context,config.productPurchaseReferenceCopyRead);}
 return {context,topology,business:context.target.database===BUSINESS_COPY_DATABASE,webOrigins:['127.0.0.1','localhost','192.168.1.46'].map(host=>`http://${host}:${topology.webPort}`)};
}
export function assertSharedBootstrapRelease(release,context){assertSharedCopyRelease(release);copyAssert(release.sharedTestCopy.database===context.target.database,'SHARED_RELEASE_TARGET_MISMATCH');return release;}
export function publicSharedCopyScope(c){
 const publicScope={schemaVersion:c.schemaVersion,operationOrigin:c.operationOrigin,copyId:c.copyId,sealHash:c.sealHash,backupSHA:c.backupSHA,sourceDatabase:c.sourceDatabase,target:{server:c.target.server,database:c.target.database},date:c.date,actors:c.actors.map(({id,role})=>({id,role})),products:c.products.map(({id,sourceKey,stockCode,unit,unitFactorExact8,priceIds,barcodes,supplierId})=>({id,sourceKey,stockCode,unit,unitFactorExact8,priceIds,barcodes,...(c.target.database===BUSINESS_COPY_DATABASE?{supplierId}:{})})),customers:c.customers.map(({id,partyId,accountId,currency,sourceKey})=>({id,partyId,accountId,currency,sourceKey})),suppliers:c.suppliers.map(({id,partyId,accountId,currency,sourceKey,code,name})=>({id,partyId,accountId,currency,sourceKey,...(typeof code==='string'?{code}:{}),...(typeof name==='string'?{name}:{})})),financeAccounts:c.financeAccounts.map(({id,currency})=>({id,currency}))};
 if(c.target.database===BUSINESS_COPY_DATABASE)Object.assign(publicScope,{scopeKind:c.scopeKind,businessScopeHash:c.businessScopeHash,businessInvoiceMaxExact4:c.businessInvoiceMaxExact4,currencyRates:c.currencyRates.map(({currency,rateExact8,date,source,id})=>({currency,rateExact8,date,source,id}))});
 const daily=validatedDailyScopes.get(c);if(daily)publicScope.businessDaily=structuredClone(daily);
 return publicScope;
}
