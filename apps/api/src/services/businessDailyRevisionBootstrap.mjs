import {copyAssert,isolatedCopyHash,isolatedCopyJSON,assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,validateIsolatedCopyEffectsPerformanceRevision,registerIsolatedCopyEffectsPerformanceRevision,registerBusinessDailyRevision,registerBusinessDailyProfitRevision} from './isolatedOperationCopyContext.mjs';
import {BUSINESS_EFFECTS_PERFORMANCE_REVISION_PROOF_SQL} from './businessReadyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL,validateBusinessDailyProfitRevision} from './businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL,registerBusinessDailyNativeCheck} from './businessDailyNativeCheck.mjs';
import {validateBusinessReadinessQueryPlanRevision,businessReadinessQueryPlanReadSQL,assertBusinessReadinessQueryPlanProof,overlayBusinessReadinessQueryPlanHistory,registerBusinessReadinessQueryPlan} from './businessReadinessQueryPlanRevision.mjs';

export const BUSINESS_DAILY_REVISION_PROOF_SQL=BUSINESS_EFFECTS_PERFORMANCE_REVISION_PROOF_SQL+`
SELECT DB_NAME() databaseName,CONVERT(varchar(36),r.copy_id) copyId,r.revision version,r.base_seal_hash baseSealHash,r.base_effects_revision_hash baseEffectsRevisionHash,r.name,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,r.daily_scope_hash dailyScopeHash,r.daily_profile_json dailyProfileJSON,p.after_hash baseManifestHash,
 (SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest) baseManifestRows,
 (SELECT m.seal_hash FROM dbo.stage4_copy_manifest m WHERE m.copy_id=r.copy_id AND m.sealed=1) manifestSealHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_business_daily_revisions'))),2) immutableTriggerHash,
 CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_business_daily_revisions'),'ExecIsTriggerDisabled')) triggerDisabled
 FROM dbo.stage4_copy_business_daily_revisions r LEFT JOIN dbo.stage4_copy_module_manifest p ON p.name=r.name ORDER BY r.name;`;

const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const hash=v=>typeof v==='string'&&/^[A-Fa-f0-9]{64}$/.test(v);
const names=['ready','context','begin','guard','effects'].map(k=>'dbo.usp_stage4_copy_'+k).concat(['context','begin','guard'].map(k=>'dbo.usp_business_daily_'+k));
export function validateBusinessDailyRevision(context,base,performance,effects,input){
 assertIsolatedCopyContext(context);validateIsolatedCopyEffectsPerformanceRevision(context,base,performance,effects);
 copyAssert(context.target.database===BUSINESS_COPY_DATABASE&&exact(input,['schemaVersion','version','copyId','baseSealHash','baseEffectsRevisionHash','modules','dailyScope','dailyScopeHash','immutableTriggerHash','revisionHash'])&&input.schemaVersion==='melisa-business-copy-daily-revision.v1'&&input.version===4&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&input.baseEffectsRevisionHash===effects.revisionHash,'BUSINESS_DAILY_REVISION');
 copyAssert(Array.isArray(input.modules)&&input.modules.length===8&&input.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===names[i]&&hash(m.afterHash)&&(i<5?hash(m.beforeHash)&&m.beforeHash!==m.afterHash:m.beforeHash===null))&&hash(input.immutableTriggerHash),'BUSINESS_DAILY_MODULES');
 for(const key of ['ready','context','begin','effects']){const name='dbo.usp_stage4_copy_'+key;copyAssert(input.modules.find(m=>m.name===name).beforeHash===(effects.modules.find(m=>m.name===name)?.afterHash??context.sql[key].hash),'BUSINESS_DAILY_PREDECESSOR');}
 const d=input.dailyScope,s=d?.selection;
 copyAssert(exact(s,['productIds','customerAccountId','supplierAccountId','financeAccountId','currency'])&&s.currency==='TRY'&&s.financeAccountId==='20043'&&Array.isArray(s.productIds)&&s.productIds.length>=1&&s.productIds.length<=2&&new Set(s.productIds).size===s.productIds.length,'BUSINESS_DAILY_SELECTION');
 const pick=(group,key,value)=>{const rows=context[group].filter(p=>p[key]===value);copyAssert(rows.length===1,'BUSINESS_DAILY_SOURCE_IDENTITY');return structuredClone(rows[0]);};
 const customers=[pick('customers','accountId',s.customerAccountId)],suppliers=[pick('suppliers','accountId',s.supplierAccountId)],finance=[pick('financeAccounts','id',s.financeAccountId)];
 for(const p of [...customers,...suppliers])copyAssert(p.currency==='TRY'&&p.sourceKnown===true&&p.accountIdentityVerified===true&&p.sourceAccountWitnessCount===1&&p.openingHumanAccepted===false&&!p.quarantined&&!p.excludedLL&&hash(p.sourceWitnessHash),'BUSINESS_DAILY_PARTY_WITNESS');
 copyAssert(finance[0].currency==='TRY'&&finance[0].type==='cash'&&finance[0].active===true&&finance[0].startingBalanceVerified===true&&finance[0].openingHumanAccepted===false,'BUSINESS_DAILY_CASH_WITNESS');
 const products=s.productIds.map(id=>{const p=pick('products','id',id),quotes=p.quotes?.filter(q=>q.currency==='TRY'&&q.type==='sale'&&q.mainUnit&&q.verified);
  copyAssert(quotes?.length===1&&Number(quotes[0].priceExact8)>0&&Number(quotes[0].priceExact8)<=250&&p.identityVerified&&p.sourceKnown&&p.supplierBindingKnown&&!p.quarantined&&p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&p.supplierId===suppliers[0].id&&p.purchaseCurrency==='TRY'&&p.purchaseInvoiceAccountId===suppliers[0].accountId&&p.purchaseQuote?.verified===true&&Number(p.purchasePriceExact8)>0&&Number(p.purchasePriceExact8)<=250&&Number(p.costExact4)>0&&Number(p.stockExact3)>=1&&hash(p.sourceWitnessHash),'BUSINESS_DAILY_PRODUCT_WITNESS');
  p.quotes=quotes;p.priceIds=[quotes[0].quoteId];p.salePriceExact8=quotes[0].priceExact8;return p;});
 const expected={schemaVersion:'melisa-business-daily-profile.v1',copyId:context.copyId,baseSealHash:context.sealHash,currency:'TRY',products,customers,suppliers,financeAccounts:finance.map(x=>({...x,openingHumanAccepted:false,openingVerified:false,openingOrigin:'UNKNOWN',testEffectsOrigin:'SYNTHETIC_TEST_EFFECT'})),actualT1:false,openingHumanAccepted:false,realFinancialOpeningAuthorized:false,testEffectsOrigin:'SYNTHETIC_TEST_EFFECT',selection:s,limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxAmountExact4:'500.0000'}};
 copyAssert(isolatedCopyJSON(d)===isolatedCopyJSON(expected)&&hash(input.dailyScopeHash)&&input.dailyScopeHash===isolatedCopyHash(d),'BUSINESS_DAILY_SCOPE_SEAL');
 const {revisionHash,...body}=input;copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'BUSINESS_DAILY_REVISION_SEAL');
 return input;
}
export async function configureBusinessDailyRevision(context,base,performance,effects,input,pool,profitInput,nativeCheckInput,queryPlanInput){
 validateBusinessDailyRevision(context,base,performance,effects,input);
 let profitRows,queryPlanProof,overrides=[];
 if(queryPlanInput!==undefined){
  validateBusinessReadinessQueryPlanRevision(input,profitInput,queryPlanInput);
  queryPlanProof=await pool.request().query(businessReadinessQueryPlanReadSQL());
  assertBusinessReadinessQueryPlanProof(context,input,profitInput,queryPlanInput,queryPlanProof);
 }
 if(profitInput!==undefined){
  profitRows=(await pool.request().query(businessDailyProfitReadSQL())).recordset;
  if(queryPlanInput!==undefined)profitRows=overlayBusinessReadinessQueryPlanHistory(profitRows,queryPlanInput);
  overrides=validateBusinessDailyProfitRevision(input,profitInput,profitRows);
 }
 let recordsets=(await pool.request().query(BUSINESS_DAILY_REVISION_PROOF_SQL)).recordsets;
 copyAssert(Array.isArray(recordsets)&&recordsets.length===4,'BUSINESS_DAILY_DB_PROOF');
 if(queryPlanInput!==undefined)recordsets=recordsets.map(rows=>overlayBusinessReadinessQueryPlanHistory(rows,queryPlanInput));
 // Only an independently verified append-only v5 proof may map current
 // definitions back to their immutable historical v4 definitions.
 for(const group of recordsets)for(const row of group){const pin=overrides.find(m=>m.name===row.name);if(pin){copyAssert(row.actualHash===pin.currentHash,'BUSINESS_DAILY_PROFIT_CURRENT_PIN');row.actualHash=pin.historicalHash;}}
 const rows=recordsets[3],keys=['databaseName','copyId','version','baseSealHash','baseEffectsRevisionHash','manifestSealHash','name','beforeHash','afterHash','actualHash','baseManifestHash','baseManifestRows','revisionHash','dailyScopeHash','dailyProfileJSON','immutableTriggerHash','triggerDisabled'];
 copyAssert(Array.isArray(rows)&&rows.length===8&&new Set(rows.map(r=>r.name)).size===8&&input.modules.every(m=>{const r=rows.find(r=>r.name===m.name);return exact(r,keys)&&r.databaseName===BUSINESS_COPY_DATABASE&&r.copyId?.toLowerCase()===context.copyId&&r.version===4&&r.baseSealHash===context.sealHash&&r.manifestSealHash===context.sealHash&&r.baseEffectsRevisionHash===effects.revisionHash&&r.beforeHash===m.beforeHash&&r.afterHash===m.afterHash&&r.actualHash===m.afterHash&&r.baseManifestRows===185&&r.revisionHash===input.revisionHash&&r.dailyScopeHash===input.dailyScopeHash&&r.dailyProfileJSON===isolatedCopyJSON(input.dailyScope)&&r.immutableTriggerHash===input.immutableTriggerHash&&r.triggerDisabled===0;}),'BUSINESS_DAILY_DB_PROOF');
 for(const r of rows){const key=Object.keys(context.sql).find(k=>context.sql[k].name===r.name);copyAssert(key?r.baseManifestHash===context.sql[key].hash:r.name==='dbo.usp_stage4_copy_guard'?r.baseManifestHash===r.beforeHash:r.baseManifestHash===null,'BUSINESS_DAILY_BASE_MODULE_PROOF');}
 // Historical registries still have their original immutable values. Verify
 // their live definitions against v4 before validating the original chain.
 const historical={base:recordsets[0],performance:recordsets[1],effects:recordsets[2]};
 for(const group of Object.values(historical))for(const r of group){const m=input.modules.find(m=>m.name===r.name);copyAssert(m&&r.actualHash===m.afterHash,'BUSINESS_DAILY_HISTORY_CURRENT_PIN');r.actualHash=effects.modules.find(x=>x.name===r.name)?.afterHash;}
 registerIsolatedCopyEffectsPerformanceRevision(context,base,performance,effects,historical);
 const registered=registerBusinessDailyRevision(context,input,rows);
 if(profitInput!==undefined)registerBusinessDailyProfitRevision(context,profitInput,profitRows);
 registerBusinessDailyNativeCheck(context,input,profitInput,nativeCheckInput,await pool.request().query(businessDailyNativeCheckReadSQL()));
 if(queryPlanInput!==undefined)registerBusinessReadinessQueryPlan(context,input,profitInput,queryPlanInput,queryPlanProof);
 return registered;
}
