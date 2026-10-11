import {createHash} from 'node:crypto';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';

export const ISOLATED_COPY_SCHEMA='melisa-stage4-isolated-operation-copy.v1';
export const ISOLATED_COPY_ORIGIN='ISOLATED_TEST_COPY';
export const ISOLATED_COPY_DATABASE='MELISA_ERP_STAGE04_COPY_TEST_20261008_01';
export const ISOLATED_COPY_SOURCE_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const ISOLATED_COPY_SERVER='Semih\\MELISADEV';
export const SHARED_COPY_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_01';
export const BUSINESS_COPY_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const copyTopologies=Object.freeze({
 [ISOLATED_COPY_DATABASE]:Object.freeze({apiPort:4154,nativePort:4156,webPort:5204,reader:'melisa_stage4_copy_ro_20261008_01',writer:'melisa_stage4_copy_rw_20261008_01',date:'2026-10-08'}),
 [SHARED_COPY_DATABASE]:Object.freeze({apiPort:4174,nativePort:4176,webPort:5224,reader:'melisa_shared_test_ro_20261009_01',writer:'melisa_shared_test_rw_20261009_01',date:'2026-10-09'}),
 [BUSINESS_COPY_DATABASE]:Object.freeze({apiPort:4184,nativePort:4186,webPort:5234,reader:'melisa_shared_test_ro_20261009_02',writer:'melisa_shared_test_rw_20261009_02',date:'2026-10-09'})
});
export const ISOLATED_COPY_PROCEDURES=Object.freeze({ready:'dbo.usp_stage4_copy_ready',context:'dbo.usp_stage4_copy_context',begin:'dbo.usp_stage4_copy_begin',effects:'dbo.usp_stage4_copy_effects'});
const registered=new WeakSet();
const operationDTOs=new WeakMap();
const adapterRevisions=new WeakMap();
const readyRevisions=new WeakMap();
const readyPerformanceRevisions=new WeakMap();
const effectsPerformanceRevisions=new WeakMap();
const businessDailyRevisions=new WeakMap();
const businessDailyProfitRevisions=new WeakMap();
const businessReadinessQueryPlanRevisions=new WeakMap();
export const isolatedCopyError=(code='ISOLATED_COPY_UNAVAILABLE',statusCode=503)=>Object.assign(new Error('Ayrılmış deneme işleminin kapsamı doğrulanamadı.'),{code,statusCode});
export function copyAssert(ok,code,status=503){if(!ok)throw isolatedCopyError(code,status);}
// ODBC dates can have enumerable nanoseconds metadata. Preserve their JSON
// timestamp before sorting plain-object keys for immutable request journals.
const canonical=value=>value instanceof Date?Date.prototype.toJSON.call(value):Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const isolatedCopyJSON=value=>JSON.stringify(canonical(value));
export const isolatedCopyHash=value=>createHash('sha256').update(isolatedCopyJSON(value),'utf16le').digest('hex').toUpperCase();
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const hash=v=>typeof v==='string'&&/^[A-Fa-f0-9]{64}$/.test(v);
export const isolatedCopyUUID=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const currency=v=>['TRY','USD','EUR'].includes(v);
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function unique(rows,key,code,max=50){copyAssert(Array.isArray(rows)&&rows.length>0&&rows.length<=max,code);const keys=new Set();for(const r of rows){copyAssert(r&&id(r[key])&&!keys.has(r[key]),code);keys.add(r[key]);}}

// This is server configuration, never a request-body profile. Keep the original
// TEST and every LIVE target outside this finite, dated copy contract.
export function validateIsolatedOperationCopyContext(input){
 copyAssert(input&&input.schemaVersion===ISOLATED_COPY_SCHEMA&&input.operationOrigin===ISOLATED_COPY_ORIGIN&&input.actualT1===false,'ISOLATED_COPY_SCHEMA');
 copyAssert(isolatedCopyUUID(input.copyId)&&hash(input.backupSHA)&&input.sourceDatabase===ISOLATED_COPY_SOURCE_DATABASE&&/^[a-f0-9]{40}$/.test(input.sourceCommit??'')&&/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.currentProductSourceVersionRunId??''),'ISOLATED_COPY_ORIGIN');
 const target=input.target;
 const topology=copyTopologies[target?.database];
 const business=target?.database===BUSINESS_COPY_DATABASE;
 copyAssert(target?.server===ISOLATED_COPY_SERVER&&topology&&typeof target.login==='string'&&([SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE].includes(target.database)?target.login===topology.writer:/^melisa_stage4_copy_[a-z0-9_]{1,64}$/.test(target.login))&&target.databaseUser===target.login,'ISOLATED_COPY_TARGET');
 if(business)copyAssert(input.scopeKind==='VERIFIED_BUSINESS_TEST'&&hash(input.businessScopeHash)&&input.date===topology.date&&input.externalOperations===false&&input.humanAccepted===false,'ISOLATED_COPY_BUSINESS_SCOPE');
 if(business){
  copyAssert(input.businessInvoiceMaxExact4==='20000.0000','ISOLATED_COPY_BUSINESS_LIMIT');
  const rates=input.currencyRates;
  copyAssert(Array.isArray(rates)&&rates.length>=2&&rates.length<=3&&new Set(rates.map(r=>r.currency)).size===rates.length&&rates.some(r=>r.currency==='TRY'&&r.rateExact8==='1.00000000'),'ISOLATED_COPY_BUSINESS_RATES');
  for(const r of rates)copyAssert(currency(r.currency)&&typeof r.rateExact8==='string'&&/^(?:0|[1-9]\d*)\.\d{8}$/.test(r.rateExact8)&&BigInt(r.rateExact8.replace('.',''))>0n&&typeof r.source==='string'&&r.source.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(r.date??'')&&Number.isFinite(Date.parse(r.date))&&new Date(r.date).toISOString().slice(0,10)===r.date&&r.date<=input.date&&(r.id===null&&r.currency==='TRY'&&r.source==='IDENTITY_TRY'||id(r.id)),'ISOLATED_COPY_BUSINESS_RATES');
 }
 copyAssert(typeof input.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.date)&&Number.isFinite(Date.parse(input.date))&&new Date(input.date).toISOString().slice(0,10)===input.date,'ISOLATED_COPY_DATE');
 if(target.database===SHARED_COPY_DATABASE)copyAssert(input.date===topology.date&&input.actors?.length===2&&input.products?.length===2&&input.products.every(p=>['29980','30003'].includes(p.id))&&input.customers?.length===1&&input.customers[0].id==='210'&&input.customers[0].currency==='TRY'&&input.suppliers?.length===1&&input.suppliers[0].id==='10162'&&input.suppliers[0].currency==='TRY'&&input.financeAccounts?.length===1&&input.financeAccounts[0].id==='20043'&&input.financeAccounts[0].currency==='TRY','ISOLATED_COPY_SHARED_FINITE_SCOPE');
 unique(input.actors,'id','ISOLATED_COPY_ACTORS');
 copyAssert(input.actors.every(a=>['15','16'].includes(a.id)&&a.role===(a.id==='15'?'isolated_test_sales':'isolated_test_ilker')),'ISOLATED_COPY_ACTORS');
 unique(input.products,'id','ISOLATED_COPY_PRODUCTS',business?20000:50);
 for(const p of input.products){
  copyAssert(p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&typeof p.stockCode==='string'&&p.stockCode.trim()&&typeof p.sourceKey==='string'&&/^VEGA2026\/F0102TBLSTOKLAR\/[1-9]\d*$/.test(p.sourceKey)&&hash(p.beforeHash),'ISOLATED_COPY_PRODUCT_IDENTITY');
  copyAssert(Array.isArray(p.priceIds)&&(business||p.priceIds.length>0)&&p.priceIds.every(id)&&new Set(p.priceIds).size===p.priceIds.length,'ISOLATED_COPY_PRICE_BINDING');
  copyAssert(Array.isArray(p.barcodes)&&p.barcodes.every(b=>typeof b==='string'&&b.length>0&&b.length<=80)&&new Set(p.barcodes).size===p.barcodes.length,'ISOLATED_COPY_BARCODES');
 }
 for(const [name,company] of [['customers','F0102'],['suppliers','F0103']]){
  unique(input[name],'accountId','ISOLATED_COPY_PARTY_ACCOUNTS',business?2000:50);
  for(const p of input[name])copyAssert(id(p.id)&&id(p.partyId)&&currency(p.currency)&&typeof p.sourceKey==='string'&&new RegExp('^VEGA2026/'+company+'TBLCARI/[1-9]\\d*$').test(p.sourceKey)&&hash(p.beforeHash)&&hash(p.accountBeforeHash),'ISOLATED_COPY_PARTY_IDENTITY');
  if(business)copyAssert(input[name].every(p=>!(name==='customers'&&['591','592'].includes(p.id))&&p.sourceKnown===true&&hash(p.sourceWitnessHash)),'ISOLATED_COPY_BUSINESS_PARTY_WITNESS');
 }
 unique(input.financeAccounts,'id','ISOLATED_COPY_FINANCE_ACCOUNTS');
 copyAssert(input.financeAccounts.every(a=>currency(a.currency)&&hash(a.beforeHash)),'ISOLATED_COPY_FINANCE_ACCOUNTS');
 copyAssert(input.sql&&Object.keys(input.sql).length===4&&Object.entries(ISOLATED_COPY_PROCEDURES).every(([k,name])=>input.sql[k]?.name===name&&hash(input.sql[k].hash)),'ISOLATED_COPY_SQL_PINS');
 const {sealHash,...body}=input;
 copyAssert(hash(sealHash)&&sealHash.toUpperCase()===isolatedCopyHash(body),'ISOLATED_COPY_SEAL');
 const context=freeze(structuredClone(input));registered.add(context);return context;
}
export function assertIsolatedCopyContext(context){copyAssert(registered.has(context),'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED');return context;}
export function isolatedCopyTopology(context){assertIsolatedCopyContext(context);return copyTopologies[context.target.database];}
export function assertIsolatedCopyIdentity(context,identity){
 assertIsolatedCopyContext(context);const t=context.target;
 copyAssert(identity?.db===t.database&&identity.server===t.server&&identity.login===t.login&&identity.databaseUser===t.databaseUser&&identity.sysadmin===0&&identity.control===0&&identity.live===0&&identity.originalDatabaseAccess===0,'ISOLATED_COPY_DB_IDENTITY');
}
export function assertIsolatedCopyActor(context,actor,actual,permission){
 assertIsolatedCopyContext(context);const a=context.actors.find(a=>a.id===String(actor?.id));
 copyAssert(a&&String(actual?.id)===a.id&&actual.role===a.role&&actual.active===true&&Array.isArray(actor.permissions)&&Array.isArray(actual.permissions)&&actor.permissions.includes(permission)&&actual.permissions.includes(permission),'ISOLATED_COPY_FORBIDDEN',403);
}
export function assertIsolatedCopyReadProof(context,proof){
 assertIsolatedCopyContext(context);
 const revision=businessDailyRevisions.get(context)??adapterRevisions.get(context)??effectsPerformanceRevisions.get(context)??readyPerformanceRevisions.get(context)??readyRevisions.get(context);
 const profit=businessDailyProfitRevisions.get(context);
 const queryPlan=businessReadinessQueryPlanRevisions.get(context)?.revision;
 const registeredSelected=getRegisteredBusinessSelectedSaleRevision(context),selected=registeredSelected?.revision,selectedEffects=registeredSelected?.selectedEffectsRevision;
 copyAssert(proof?.copyId===context.copyId&&proof.sealHash===context.sealHash&&proof.backupSHA===context.backupSHA&&proof.valid===true&&Object.entries(context.sql).every(([key,p])=>proof.definitionHashes?.[key]===(selectedEffects?.modules.find(m=>m.name===p.name)?.afterHash??selected?.modules.find(m=>m.name===p.name)?.afterHash??queryPlan?.modules.find(m=>m.name===p.name)?.afterHash??profit?.modules.find(m=>m.name===p.name)?.afterHash??revision?.modules.find(m=>m.name===p.name)?.afterHash??p.hash)),'ISOLATED_COPY_READ_PROOF');
}
// A separate append-only adapter pin preserves the existing profile seal and
// journal identity. It is never accepted from an HTTP body or an environment flag.
export function validateIsolatedCopyAdapterRevision(context,input){
 assertIsolatedCopyContext(context);
 copyAssert(context.target.database===SHARED_COPY_DATABASE&&input?.schemaVersion==='melisa-shared-copy-adapter-revision.v1'&&input.version===1&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&Array.isArray(input.modules)&&input.modules.length===3,'ISOLATED_COPY_ADAPTER_REVISION');
 const names=['dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context'];
 copyAssert(input.modules.every((m,i)=>m.name===names[i]&&hash(m.beforeHash)&&hash(m.afterHash)&&m.beforeHash!==m.afterHash)&&input.modules[0].beforeHash===context.sql.ready.hash&&input.modules[2].beforeHash===context.sql.context.hash&&hash(input.immutableTriggerHash),'ISOLATED_COPY_ADAPTER_PINS');
 const {revisionHash,...body}=input;
 copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'ISOLATED_COPY_ADAPTER_SEAL');
 return freeze(structuredClone(input));
}
export function registerIsolatedCopyAdapterRevision(context,input,proof){
 const revision=validateIsolatedCopyAdapterRevision(context,input);
 copyAssert(!adapterRevisions.has(context)&&!effectsPerformanceRevisions.has(context)&&Array.isArray(proof)&&proof.length===3&&revision.modules.every(m=>proof.some(p=>p.name===m.name&&String(p.copyId).toLowerCase()===context.copyId&&p.version===1&&p.baseSealHash===context.sealHash&&p.beforeHash===m.beforeHash&&p.afterHash===m.afterHash&&p.actualHash===m.afterHash&&p.baseManifestHash===m.beforeHash&&p.immutableTriggerHash===revision.immutableTriggerHash&&p.triggerDisabled===0)),'ISOLATED_COPY_ADAPTER_DB_PROOF');
 adapterRevisions.set(context,revision);return revision;
}
// This second-copy optimization changes only the ready definition. Its base
// profile and journal seals remain immutable; HTTP/env data cannot register it.
export function validateIsolatedCopyReadyRevision(context,input){
 assertIsolatedCopyContext(context);
 const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===keys.sort().join();
 copyAssert(context.target.database===BUSINESS_COPY_DATABASE&&exactKeys(input,['schemaVersion','version','copyId','baseSealHash','modules','immutableTriggerHash','revisionHash'])&&input.schemaVersion==='melisa-business-copy-ready-revision.v1'&&input.version===1&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&Array.isArray(input.modules)&&input.modules.length===1,'ISOLATED_COPY_READY_REVISION');
 const module=input.modules[0];
 copyAssert(exactKeys(module,['name','beforeHash','afterHash'])&&module.name===ISOLATED_COPY_PROCEDURES.ready&&module.beforeHash===context.sql.ready.hash&&hash(module.afterHash)&&module.afterHash!==module.beforeHash&&hash(input.immutableTriggerHash),'ISOLATED_COPY_READY_PINS');
 const {revisionHash,...body}=input;copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'ISOLATED_COPY_READY_SEAL');
 return freeze(structuredClone(input));
}
export function registerIsolatedCopyReadyRevision(context,input,proof){
 const revision=validateIsolatedCopyReadyRevision(context,input),module=revision.modules[0],row=Array.isArray(proof)&&proof.length===1?proof[0]:null;
 copyAssert(!readyRevisions.has(context)&&!readyPerformanceRevisions.has(context)&&!effectsPerformanceRevisions.has(context)&&!adapterRevisions.has(context)&&row&&row.databaseName===BUSINESS_COPY_DATABASE&&String(row.copyId).toLowerCase()===context.copyId&&row.version===1&&row.baseSealHash===context.sealHash&&row.manifestSealHash===context.sealHash&&row.name===module.name&&row.beforeHash===module.beforeHash&&row.afterHash===module.afterHash&&row.actualHash===module.afterHash&&row.baseManifestHash===module.beforeHash&&row.baseManifestRows===185&&row.revisionHash===revision.revisionHash&&row.immutableTriggerHash===revision.immutableTriggerHash&&row.triggerDisabled===0,'ISOLATED_COPY_READY_DB_PROOF');
 readyRevisions.set(context,revision);return revision;
}
export function validateIsolatedCopyReadyPerformanceRevision(context,baseInput,input){
 const base=validateIsolatedCopyReadyRevision(context,baseInput);
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join();
 copyAssert(exact(input,['schemaVersion','version','copyId','baseSealHash','baseReadyRevisionHash','modules','immutableTriggerHash','revisionHash'])&&input.schemaVersion==='melisa-business-copy-ready-performance-revision.v1'&&input.version===2&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&input.baseReadyRevisionHash===base.revisionHash&&Array.isArray(input.modules)&&input.modules.length===1,'ISOLATED_COPY_READY_PERFORMANCE_REVISION');
 const m=input.modules[0];
 copyAssert(exact(m,['name','beforeHash','afterHash'])&&m.name===ISOLATED_COPY_PROCEDURES.ready&&m.beforeHash===base.modules[0].afterHash&&hash(m.afterHash)&&m.afterHash!==m.beforeHash&&m.afterHash!==context.sql.ready.hash&&hash(input.immutableTriggerHash),'ISOLATED_COPY_READY_PERFORMANCE_PINS');
 const {revisionHash,...body}=input;copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'ISOLATED_COPY_READY_PERFORMANCE_SEAL');
 return freeze(structuredClone(input));
}
// Register the real historical chain in one step. After v2 is installed the
// historical v1 module is not the current SQL body, so its actual hash is v2.
export function registerIsolatedCopyReadyPerformanceRevision(context,baseInput,input,proof){
 const revision=validateIsolatedCopyReadyPerformanceRevision(context,baseInput,input),base=validateIsolatedCopyReadyRevision(context,baseInput),m=revision.modules[0],original=base.modules[0];
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join();
 const keys=['databaseName','copyId','version','baseSealHash','manifestSealHash','name','beforeHash','afterHash','actualHash','baseManifestHash','baseManifestRows','revisionHash','immutableTriggerHash','triggerDisabled'];
 const old=Array.isArray(proof?.base)&&proof.base.length===1?proof.base[0]:null,next=Array.isArray(proof?.performance)&&proof.performance.length===1?proof.performance[0]:null;
 const shared=row=>row?.databaseName===BUSINESS_COPY_DATABASE&&String(row.copyId).toLowerCase()===context.copyId&&row.baseSealHash===context.sealHash&&row.manifestSealHash===context.sealHash&&row.name===m.name&&row.actualHash===m.afterHash&&row.baseManifestHash===original.beforeHash&&row.baseManifestRows===185&&row.triggerDisabled===0;
 copyAssert(!readyPerformanceRevisions.has(context)&&!readyRevisions.has(context)&&!effectsPerformanceRevisions.has(context)&&!adapterRevisions.has(context)&&exact(proof,['base','performance'])&&exact(old,keys)&&exact(next,[...keys,'baseReadyRevisionHash'])&&shared(old)&&shared(next)
  &&old.version===1&&old.beforeHash===original.beforeHash&&old.afterHash===original.afterHash&&old.revisionHash===base.revisionHash&&old.immutableTriggerHash===base.immutableTriggerHash
  &&next.version===2&&next.beforeHash===m.beforeHash&&next.afterHash===m.afterHash&&next.revisionHash===revision.revisionHash&&next.baseReadyRevisionHash===base.revisionHash&&next.immutableTriggerHash===revision.immutableTriggerHash,'ISOLATED_COPY_READY_PERFORMANCE_DB_PROOF');
 readyPerformanceRevisions.set(context,revision);return revision;
}
// The third append-only registry preserves the sealed source's exact baseline
// residuals. It authorizes two real module pins, never a data repair or bypass.
export function validateIsolatedCopyEffectsPerformanceRevision(context,baseInput,performanceInput,input){
 const performance=validateIsolatedCopyReadyPerformanceRevision(context,baseInput,performanceInput);
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join();
 copyAssert(exact(input,['schemaVersion','version','copyId','baseSealHash','baseReadyRevisionHash','baseReadyPerformanceRevisionHash','modules','baselineResiduals','baselineResidualsHash','immutableTriggerHash','revisionHash'])&&input.schemaVersion==='melisa-business-copy-effects-performance-revision.v1'&&input.version===3&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&input.baseReadyRevisionHash===baseInput.revisionHash&&input.baseReadyPerformanceRevisionHash===performance.revisionHash&&Array.isArray(input.modules)&&input.modules.length===2,'ISOLATED_COPY_EFFECTS_PERFORMANCE_REVISION');
 const names=[ISOLATED_COPY_PROCEDURES.ready,ISOLATED_COPY_PROCEDURES.effects],before=[performance.modules[0].afterHash,context.sql.effects.hash];
 copyAssert(input.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===names[i]&&m.beforeHash===before[i]&&hash(m.afterHash)&&m.afterHash!==m.beforeHash&&m.afterHash!==context.sql[i===0?'ready':'effects'].hash)&&hash(input.immutableTriggerHash),'ISOLATED_COPY_EFFECTS_PERFORMANCE_PINS');
 const rows=input.baselineResiduals,seen=new Set();
 copyAssert(Array.isArray(rows)&&rows.length===37,'ISOLATED_COPY_EFFECTS_BASELINE');
 for(const row of rows){
  const key=row?.role+':'+row?.id,party=context[row?.role==='customer'?'customers':'suppliers']?.find(p=>p.id===row?.id&&p.accountId===row?.accountId&&p.currency===row?.currency);
  copyAssert(exact(row,['role','id','accountId','currency','residualExact8','beforeHash','accountBeforeHash','sourceWitnessHash'])&&['customer','supplier'].includes(row.role)&&id(row.id)&&id(row.accountId)&&currency(row.currency)&&!seen.has(key)&&typeof row.residualExact8==='string'&&/^-?(?:0|[1-9]\d{0,20})\.\d{8}$/.test(row.residualExact8)&&!/^[-]?0\.00000000$/.test(row.residualExact8)&&party&&row.beforeHash===party.beforeHash&&row.accountBeforeHash===party.accountBeforeHash&&row.sourceWitnessHash===party.sourceWitnessHash,'ISOLATED_COPY_EFFECTS_BASELINE');seen.add(key);
 }
 copyAssert(rows.filter(r=>r.role==='customer').length===26&&rows.filter(r=>r.role==='supplier').length===11&&hash(input.baselineResidualsHash)&&input.baselineResidualsHash===isolatedCopyHash(rows),'ISOLATED_COPY_EFFECTS_BASELINE_SEAL');
 const {revisionHash,...body}=input;copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'ISOLATED_COPY_EFFECTS_PERFORMANCE_SEAL');
 return freeze(structuredClone(input));
}
export function registerIsolatedCopyEffectsPerformanceRevision(context,baseInput,performanceInput,input,proof){
 const revision=validateIsolatedCopyEffectsPerformanceRevision(context,baseInput,performanceInput,input),base=validateIsolatedCopyReadyRevision(context,baseInput),performance=validateIsolatedCopyReadyPerformanceRevision(context,baseInput,performanceInput);
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join();
 const keys=['databaseName','copyId','version','baseSealHash','manifestSealHash','name','beforeHash','afterHash','actualHash','baseManifestHash','baseManifestRows','revisionHash','immutableTriggerHash','triggerDisabled'];
 const old=Array.isArray(proof?.base)&&proof.base.length===1?proof.base[0]:null,next=Array.isArray(proof?.performance)&&proof.performance.length===1?proof.performance[0]:null,rows=proof?.effects;
 const shared=(row,module)=>row?.databaseName===BUSINESS_COPY_DATABASE&&String(row.copyId).toLowerCase()===context.copyId&&row.baseSealHash===context.sealHash&&row.manifestSealHash===context.sealHash&&row.name===module.name&&row.actualHash===module.afterHash&&row.baseManifestHash===context.sql[module.name===ISOLATED_COPY_PROCEDURES.ready?'ready':'effects'].hash&&row.baseManifestRows===185&&row.triggerDisabled===0;
 copyAssert(!effectsPerformanceRevisions.has(context)&&!readyPerformanceRevisions.has(context)&&!readyRevisions.has(context)&&!adapterRevisions.has(context)&&exact(proof,['base','performance','effects'])&&exact(old,keys)&&exact(next,[...keys,'baseReadyRevisionHash'])&&shared(old,revision.modules[0])&&shared(next,revision.modules[0])
  &&old.version===1&&old.beforeHash===base.modules[0].beforeHash&&old.afterHash===base.modules[0].afterHash&&old.revisionHash===base.revisionHash&&old.immutableTriggerHash===base.immutableTriggerHash
  &&next.version===2&&next.beforeHash===performance.modules[0].beforeHash&&next.afterHash===performance.modules[0].afterHash&&next.revisionHash===performance.revisionHash&&next.baseReadyRevisionHash===base.revisionHash&&next.immutableTriggerHash===performance.immutableTriggerHash
  &&Array.isArray(rows)&&rows.length===2&&revision.modules.every(m=>{const row=rows.find(r=>r?.name===m.name);return exact(row,[...keys,'baseReadyRevisionHash','baseReadyPerformanceRevisionHash','baselineResidualsHash','baselineResidualsJSON'])&&shared(row,m)&&row.version===3&&row.beforeHash===m.beforeHash&&row.afterHash===m.afterHash&&row.revisionHash===revision.revisionHash&&row.baseReadyRevisionHash===base.revisionHash&&row.baseReadyPerformanceRevisionHash===performance.revisionHash&&row.immutableTriggerHash===revision.immutableTriggerHash&&row.baselineResidualsHash===revision.baselineResidualsHash&&row.baselineResidualsJSON===isolatedCopyJSON(revision.baselineResiduals);}), 'ISOLATED_COPY_EFFECTS_PERFORMANCE_DB_PROOF');
 effectsPerformanceRevisions.set(context,revision);return revision;
}
export function bindIsolatedCopyOperationDTO(context,dto){
 assertIsolatedCopyContext(context);
 copyAssert(dto?.meta?.operationOrigin===ISOLATED_COPY_ORIGIN&&dto.meta.copyId===context.copyId&&dto.meta.sealHash===context.sealHash&&dto.meta.date===context.date,'ISOLATED_COPY_DTO_META');
 const scoped=v=>v?.synthetic===false&&v.operationOrigin===ISOLATED_COPY_ORIGIN;
 const daily=businessDailyRevisions.get(context),dailyDTO=dto.meta.businessDailyScopeHash!==undefined;
 if(dailyDTO){
  copyAssert(daily&&dto.meta.businessDailyScopeHash===daily.dailyScopeHash,'BUSINESS_DAILY_DTO_SEAL');
  const s=daily.dailyScope;
  for(const [rows,key] of [['customers','customer'],['suppliers','supplier']])if(dto.scope?.[key])copyAssert(s[rows].some(p=>p.id===dto.scope[key].id&&p.accountId===dto.scope[key].accountId&&p.currency===dto.scope[key].currency),'BUSINESS_DAILY_DTO_PARTY');
  if(dto.scope?.products)copyAssert(dto.scope.products.length===s.products.length&&dto.scope.products.every(p=>s.products.some(v=>v.id===p.id)),'BUSINESS_DAILY_DTO_PRODUCTS');
  if(dto.suppliers)copyAssert(dto.suppliers.length===s.suppliers.length&&dto.suppliers.every(p=>s.suppliers.some(v=>v.id===p.id&&v.accountId===p.accountId&&v.currency===p.currency)),'BUSINESS_DAILY_DTO_PARTY');
 }
 if(dto.scope){
  copyAssert(scoped(dto.scope),'ISOLATED_COPY_DTO_ORIGIN');
  if(dto.scope.products){
   const products=dto.scope.products;
   copyAssert(Array.isArray(products)&&(context.target.database===BUSINESS_COPY_DATABASE?products.length>0&&products.length<=context.products.length:products.length===context.products.length)&&new Set(products.map(p=>p.id)).size===products.length,'ISOLATED_COPY_DTO_PRODUCTS');
   for(const p of products){const sealed=context.products.find(v=>v.id===p.id);copyAssert(sealed&&scoped(p)&&p.writeEligible===true&&p.stockCode===sealed.stockCode&&p.unit?.label===sealed.unit&&p.unit.factorExact8===sealed.unitFactorExact8,'ISOLATED_COPY_DTO_PRODUCTS');
    copyAssert(p.barcode==null||sealed.barcodes.includes(p.barcode),'ISOLATED_COPY_DTO_BARCODES');
    if(p.prices)copyAssert(Array.isArray(p.prices)&&p.prices.length>0&&p.prices.every(q=>sealed.priceIds.includes(q.quoteId)&&(context.target.database===BUSINESS_COPY_DATABASE?currency(q.currency):q.currency==='TRY')&&typeof q.unitPriceExact8==='string'&&/^(?:0|[1-9]\d*)\.\d{8}$/.test(q.unitPriceExact8)&&q.source?.kind==='isolated-test-copy'&&q.source.copyId===context.copyId&&q.source.sealHash===context.sealHash),'ISOLATED_COPY_DTO_QUOTES');
   }
  }
  for(const [name,key] of [['customers','customer'],['suppliers','supplier']]){const p=dto.scope[key];if(p)copyAssert(scoped(p)&&context[name].some(v=>v.id===p.id&&v.currency===p.currency),'ISOLATED_COPY_DTO_PARTY');}
  if(dto.scope.accounts)copyAssert(Array.isArray(dto.scope.accounts)&&dto.scope.accounts.every(a=>scoped(a)&&context.financeAccounts.some(v=>v.id===a.id&&v.currency===a.currency)),'ISOLATED_COPY_DTO_FINANCE');
 }
 if(dto.suppliers)copyAssert(Array.isArray(dto.suppliers)&&dto.suppliers.length===(dailyDTO?daily.dailyScope.suppliers.length:context.suppliers.length)&&dto.suppliers.every(p=>scoped(p)&&context.suppliers.some(a=>a.id===p.id&&a.currency===p.currency)),'ISOLATED_COPY_DTO_PARTY');
 if(dto.accounts)copyAssert(Array.isArray(dto.accounts)&&dto.accounts.length===context.financeAccounts.length&&dto.accounts.every(a=>scoped(a)&&context.financeAccounts.some(v=>v.id===a.id&&v.currency===a.currency)),'ISOLATED_COPY_DTO_FINANCE');
 // Binding remains server-only and disappears when the DTO is serialized.
 operationDTOs.set(dto,context);return dto;
}
export function isolatedCopyOperationDTOContext(dto){
 const context=operationDTOs.get(dto);
 if(!context){copyAssert(dto?.meta?.operationOrigin!==ISOLATED_COPY_ORIGIN,'ISOLATED_COPY_UNBOUND_DTO');return null;}
 bindIsolatedCopyOperationDTO(context,dto);return context;
}
// This is installed only after SQL registry and historical-chain proof. It is
// held by server object identity; no body, environment flag or serialized copy
// can enable the selected daily accounts.
export function registerBusinessDailyRevision(context,input,proof){
 assertIsolatedCopyContext(context);
 const old=effectsPerformanceRevisions.get(context);
 const {revisionHash,...body}=input??{};
 copyAssert(old&&!businessDailyRevisions.has(context)&&context.target.database===BUSINESS_COPY_DATABASE&&input?.version===4&&input.baseEffectsRevisionHash===old.revisionHash&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&hash(revisionHash)&&revisionHash===isolatedCopyHash(body)&&hash(input.dailyScopeHash)&&input.dailyScopeHash===isolatedCopyHash(input.dailyScope)&&Array.isArray(proof)&&proof.length===8&&new Set(proof.map(r=>r.name)).size===8&&input.modules?.length===8&&input.modules.every(m=>proof.some(r=>r.name===m.name&&r.actualHash===m.afterHash&&r.revisionHash===revisionHash&&r.dailyScopeHash===input.dailyScopeHash&&r.triggerDisabled===0)),'BUSINESS_DAILY_REGISTRATION');
 const revision=freeze(structuredClone(input));businessDailyRevisions.set(context,revision);return revision;
}
export function getBusinessDailySelection(context){assertIsolatedCopyContext(context);return businessDailyRevisions.get(context)?.dailyScope.selection??null;}
export function getBusinessDailyScopeHash(context){assertIsolatedCopyContext(context);return businessDailyRevisions.get(context)?.dailyScopeHash??null;}
// HOME may remove only a duplicate outer ready call. Return authoritative
// server registrations; serialized profiles and optional v6 cannot opt in.
export function getBusinessDailyHomeReadRevisions(context){
 assertIsolatedCopyContext(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE||businessReadinessQueryPlanRevisions.has(context))return null;
 const daily=businessDailyRevisions.get(context),profit=businessDailyProfitRevisions.get(context);
 return daily?.version===4&&profit?.version===5?Object.freeze({daily,profit}):null;
}
export function getBusinessReadinessQueryPlanRevision(context){assertIsolatedCopyContext(context);return businessReadinessQueryPlanRevisions.get(context)??null;}
// Registration is a server-only step after fresh SQL proof and v1-v5 closure.
export function registerBusinessReadinessQueryPlanRevision(context,input,proof){
 assertIsolatedCopyContext(context);const daily=businessDailyRevisions.get(context),profit=businessDailyProfitRevisions.get(context),{revisionHash,...body}=input??{},m=input?.modules?.[0];
 copyAssert(context.target.database===BUSINESS_COPY_DATABASE&&daily&&profit&&!businessReadinessQueryPlanRevisions.has(context)&&input?.schemaVersion==='melisa-readiness-query-plan-revision.v1'&&input.version===6&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&input.baseDailyRevisionHash===daily.revisionHash&&input.baseProfitRevisionHash===profit.revisionHash&&input.dailyScopeHash===daily.dailyScopeHash&&input.modules?.length===1&&m.name===ISOLATED_COPY_PROCEDURES.ready&&m.beforeHash===profit.modules.find(p=>p.name===m.name)?.afterHash&&hash(m.afterHash)&&m.afterHash!==m.beforeHash&&hash(input.immutableTriggerHash)&&revisionHash===isolatedCopyHash(body),'BUSINESS_READINESS_QUERY_PLAN_REGISTRATION');
 const sets=proof?.recordsets,meta=sets?.[0]?.[0],row=sets?.[1]?.[0];
 copyAssert(Array.isArray(sets)&&sets.length===4&&sets[0]?.length===1&&sets[1]?.length===1&&meta.databaseName===context.target.database&&meta.serverName===context.target.server&&[1,true].includes(meta.registryExists)&&meta.actualHash===m.afterHash&&meta.immutableTriggerHash===input.immutableTriggerHash&&meta.triggerDisabled===0&&meta.baseManifestRows===185&&meta.manifestSealHash===context.sealHash&&typeof row.copyId==='string'&&row.copyId.toLowerCase()===context.copyId&&row.version===6&&row.name===m.name&&row.beforeHash===m.beforeHash&&row.afterHash===m.afterHash&&row.revisionHash===revisionHash&&row.baseSealHash===context.sealHash&&row.baseDailyRevisionHash===daily.revisionHash&&row.baseProfitRevisionHash===profit.revisionHash&&row.dailyScopeHash===daily.dailyScopeHash,'BUSINESS_READINESS_QUERY_PLAN_REGISTRATION_PROOF');
 const registered=freeze({daily,profit,revision:structuredClone(input)});businessReadinessQueryPlanRevisions.set(context,registered);return registered.revision;
}
// Append-only proof of the three revised definitions. This never changes the
// v4 selection, journal identity, scope or historical module hashes.
export function registerBusinessDailyProfitRevision(context,input,proof){
 assertIsolatedCopyContext(context);const daily=businessDailyRevisions.get(context);
 const {revisionHash,...body}=input??{},names=['dbo.usp_business_daily_guard','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context'];
 copyAssert(daily&&!businessDailyProfitRevisions.has(context)&&input?.schemaVersion==='melisa-business-daily-profit-revision.v1'&&input.version===5&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&input.baseDailyRevisionHash===daily.revisionHash&&input.dailyScopeHash===daily.dailyScopeHash&&hash(revisionHash)&&revisionHash===isolatedCopyHash(body)&&Array.isArray(input.modules)&&input.modules.length===3&&new Set(input.modules.map(m=>m.name)).size===3&&Array.isArray(proof)&&proof.length===3&&new Set(proof.map(r=>r.name)).size===3&&input.modules.every(m=>names.includes(m.name)&&hash(m.afterHash)&&m.beforeHash!==m.afterHash&&daily.modules.some(p=>p.name===m.name&&p.afterHash===m.beforeHash)&&proof.some(r=>r.name===m.name&&r.actualHash===m.afterHash&&r.afterHash===m.afterHash&&r.beforeHash===m.beforeHash&&r.revisionHash===revisionHash&&r.immutableTriggerHash===input.immutableTriggerHash&&r.triggerDisabled===0)),'BUSINESS_DAILY_PROFIT_REGISTRATION');
 copyAssert(proof.every(r=>typeof r.copyId==='string'&&r.copyId.toLowerCase()===context.copyId&&r.revision===5&&r.baseSealHash===context.sealHash&&r.baseDailyRevisionHash===daily.revisionHash&&r.dailyScopeHash===daily.dailyScopeHash),'BUSINESS_DAILY_PROFIT_DB_IDENTITY');
 const revision=freeze(structuredClone(input));businessDailyProfitRevisions.set(context,revision);return revision;
}
