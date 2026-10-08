import {createHash} from 'node:crypto';

export const ISOLATED_COPY_SCHEMA='melisa-stage4-isolated-operation-copy.v1';
export const ISOLATED_COPY_ORIGIN='ISOLATED_TEST_COPY';
export const ISOLATED_COPY_DATABASE='MELISA_ERP_STAGE04_COPY_TEST_20261008_01';
export const ISOLATED_COPY_SOURCE_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const ISOLATED_COPY_SERVER='Semih\\MELISADEV';
export const ISOLATED_COPY_PROCEDURES=Object.freeze({ready:'dbo.usp_stage4_copy_ready',context:'dbo.usp_stage4_copy_context',begin:'dbo.usp_stage4_copy_begin',effects:'dbo.usp_stage4_copy_effects'});
const registered=new WeakSet();
const operationDTOs=new WeakMap();
export const isolatedCopyError=(code='ISOLATED_COPY_UNAVAILABLE',statusCode=503)=>Object.assign(new Error('Ayrılmış deneme işleminin kapsamı doğrulanamadı.'),{code,statusCode});
export function copyAssert(ok,code,status=503){if(!ok)throw isolatedCopyError(code,status);}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const isolatedCopyJSON=value=>JSON.stringify(canonical(value));
export const isolatedCopyHash=value=>createHash('sha256').update(isolatedCopyJSON(value),'utf16le').digest('hex').toUpperCase();
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const hash=v=>typeof v==='string'&&/^[A-Fa-f0-9]{64}$/.test(v);
export const isolatedCopyUUID=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const currency=v=>['TRY','USD','EUR'].includes(v);
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function unique(rows,key,code){copyAssert(Array.isArray(rows)&&rows.length>0&&rows.length<=50,code);const keys=new Set();for(const r of rows){copyAssert(r&&id(r[key])&&!keys.has(r[key]),code);keys.add(r[key]);}}

// This is server configuration, never a request-body profile. Keep the original
// TEST and every LIVE target outside this finite, dated copy contract.
export function validateIsolatedOperationCopyContext(input){
 copyAssert(input&&input.schemaVersion===ISOLATED_COPY_SCHEMA&&input.operationOrigin===ISOLATED_COPY_ORIGIN&&input.actualT1===false,'ISOLATED_COPY_SCHEMA');
 copyAssert(isolatedCopyUUID(input.copyId)&&hash(input.backupSHA)&&input.sourceDatabase===ISOLATED_COPY_SOURCE_DATABASE&&/^[a-f0-9]{40}$/.test(input.sourceCommit??'')&&/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.currentProductSourceVersionRunId??''),'ISOLATED_COPY_ORIGIN');
 const target=input.target;
 copyAssert(target?.server===ISOLATED_COPY_SERVER&&target.database===ISOLATED_COPY_DATABASE&&typeof target.login==='string'&&/^melisa_stage4_copy_[a-z0-9_]{1,64}$/.test(target.login)&&target.databaseUser===target.login,'ISOLATED_COPY_TARGET');
 copyAssert(typeof input.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.date)&&Number.isFinite(Date.parse(input.date))&&new Date(input.date).toISOString().slice(0,10)===input.date,'ISOLATED_COPY_DATE');
 unique(input.actors,'id','ISOLATED_COPY_ACTORS');
 copyAssert(input.actors.every(a=>['15','16'].includes(a.id)&&a.role===(a.id==='15'?'isolated_test_sales':'isolated_test_ilker')),'ISOLATED_COPY_ACTORS');
 unique(input.products,'id','ISOLATED_COPY_PRODUCTS');
 for(const p of input.products){
  copyAssert(p.unit==='ADET'&&p.unitFactorExact8==='1.00000000'&&typeof p.stockCode==='string'&&p.stockCode.trim()&&typeof p.sourceKey==='string'&&/^VEGA2026\/F0102TBLSTOKLAR\/[1-9]\d*$/.test(p.sourceKey)&&hash(p.beforeHash),'ISOLATED_COPY_PRODUCT_IDENTITY');
  copyAssert(Array.isArray(p.priceIds)&&p.priceIds.length>0&&p.priceIds.every(id)&&new Set(p.priceIds).size===p.priceIds.length,'ISOLATED_COPY_PRICE_BINDING');
  copyAssert(Array.isArray(p.barcodes)&&p.barcodes.every(b=>typeof b==='string'&&b.length>0&&b.length<=80)&&new Set(p.barcodes).size===p.barcodes.length,'ISOLATED_COPY_BARCODES');
 }
 for(const [name,company] of [['customers','F0102'],['suppliers','F0103']]){
  unique(input[name],'accountId','ISOLATED_COPY_PARTY_ACCOUNTS');
  for(const p of input[name])copyAssert(id(p.id)&&id(p.partyId)&&currency(p.currency)&&typeof p.sourceKey==='string'&&new RegExp('^VEGA2026/'+company+'TBLCARI/[1-9]\\d*$').test(p.sourceKey)&&hash(p.beforeHash)&&hash(p.accountBeforeHash),'ISOLATED_COPY_PARTY_IDENTITY');
 }
 unique(input.financeAccounts,'id','ISOLATED_COPY_FINANCE_ACCOUNTS');
 copyAssert(input.financeAccounts.every(a=>currency(a.currency)&&hash(a.beforeHash)),'ISOLATED_COPY_FINANCE_ACCOUNTS');
 copyAssert(input.sql&&Object.keys(input.sql).length===4&&Object.entries(ISOLATED_COPY_PROCEDURES).every(([k,name])=>input.sql[k]?.name===name&&hash(input.sql[k].hash)),'ISOLATED_COPY_SQL_PINS');
 const {sealHash,...body}=input;
 copyAssert(hash(sealHash)&&sealHash.toUpperCase()===isolatedCopyHash(body),'ISOLATED_COPY_SEAL');
 const context=freeze(structuredClone(input));registered.add(context);return context;
}
export function assertIsolatedCopyContext(context){copyAssert(registered.has(context),'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED');return context;}
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
 copyAssert(proof?.copyId===context.copyId&&proof.sealHash===context.sealHash&&proof.backupSHA===context.backupSHA&&proof.valid===true&&Object.entries(context.sql).every(([key,p])=>proof.definitionHashes?.[key]===p.hash),'ISOLATED_COPY_READ_PROOF');
}
export function bindIsolatedCopyOperationDTO(context,dto){
 assertIsolatedCopyContext(context);
 copyAssert(dto?.meta?.operationOrigin===ISOLATED_COPY_ORIGIN&&dto.meta.copyId===context.copyId&&dto.meta.sealHash===context.sealHash&&dto.meta.date===context.date,'ISOLATED_COPY_DTO_META');
 const scoped=v=>v?.synthetic===false&&v.operationOrigin===ISOLATED_COPY_ORIGIN;
 if(dto.scope){
  copyAssert(scoped(dto.scope),'ISOLATED_COPY_DTO_ORIGIN');
  if(dto.scope.products){
   const products=dto.scope.products;
   copyAssert(Array.isArray(products)&&products.length===context.products.length&&new Set(products.map(p=>p.id)).size===products.length,'ISOLATED_COPY_DTO_PRODUCTS');
   for(const p of products){const sealed=context.products.find(v=>v.id===p.id);copyAssert(sealed&&scoped(p)&&p.writeEligible===true&&p.stockCode===sealed.stockCode&&p.unit?.label===sealed.unit&&p.unit.factorExact8===sealed.unitFactorExact8,'ISOLATED_COPY_DTO_PRODUCTS');
    copyAssert(p.barcode==null||sealed.barcodes.includes(p.barcode),'ISOLATED_COPY_DTO_BARCODES');
    if(p.prices)copyAssert(Array.isArray(p.prices)&&p.prices.length>0&&p.prices.every(q=>sealed.priceIds.includes(q.quoteId)&&q.currency==='TRY'&&typeof q.unitPriceExact8==='string'&&/^(?:0|[1-9]\d*)\.\d{8}$/.test(q.unitPriceExact8)&&q.source?.kind==='isolated-test-copy'&&q.source.copyId===context.copyId&&q.source.sealHash===context.sealHash),'ISOLATED_COPY_DTO_QUOTES');
   }
  }
  for(const [name,key] of [['customers','customer'],['suppliers','supplier']]){const p=dto.scope[key];if(p)copyAssert(scoped(p)&&context[name].some(v=>v.id===p.id&&v.currency===p.currency),'ISOLATED_COPY_DTO_PARTY');}
  if(dto.scope.accounts)copyAssert(Array.isArray(dto.scope.accounts)&&dto.scope.accounts.every(a=>scoped(a)&&context.financeAccounts.some(v=>v.id===a.id&&v.currency===a.currency)),'ISOLATED_COPY_DTO_FINANCE');
 }
 if(dto.suppliers)copyAssert(Array.isArray(dto.suppliers)&&dto.suppliers.length===context.suppliers.length&&dto.suppliers.every(p=>scoped(p)&&context.suppliers.some(a=>a.id===p.id&&a.currency===p.currency)),'ISOLATED_COPY_DTO_PARTY');
 if(dto.accounts)copyAssert(Array.isArray(dto.accounts)&&dto.accounts.length===context.financeAccounts.length&&dto.accounts.every(a=>scoped(a)&&context.financeAccounts.some(v=>v.id===a.id&&v.currency===a.currency)),'ISOLATED_COPY_DTO_FINANCE');
 // Binding remains server-only and disappears when the DTO is serialized.
 operationDTOs.set(dto,context);return dto;
}
export function isolatedCopyOperationDTOContext(dto){
 const context=operationDTOs.get(dto);
 if(!context){copyAssert(dto?.meta?.operationOrigin!==ISOLATED_COPY_ORIGIN,'ISOLATED_COPY_UNBOUND_DTO');return null;}
 bindIsolatedCopyOperationDTO(context,dto);return context;
}
