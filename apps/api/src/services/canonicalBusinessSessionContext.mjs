import {createHash} from 'node:crypto';
import {expandPermissions,applyRolePermissionDefaults} from './permissionCatalog.js';
export const BUSINESS_SESSION=Object.freeze({id:'ERP-5244-REALDATA-20261027',database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',userId:17,username:'unified-semih-test',roleId:17,roleCode:'unified_test_semih',permissionRows:36,permissionHash:'d49893294b3feffa73cb80fdf32ef81e9e4a205db98de3d4becdfe00170bc1d7',sessionPath:'C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\grants.json'});
let registered=null,registeredLegacySaleProof=null,registeredSaleDefinitionHashes=null;
export const CANONICAL_BUSINESS_SALE_READER_MODULES=Object.freeze(['usp_assert_test_current_price_purchase_received','usp_assert_test_purchase_fx_received','usp_get_test_current_price_purchase_context','usp_get_test_product_prices','usp_get_test_purchase_fx_context','usp_get_test_purchase_fx_unit_evidence','usp_get_test_supplier_contact_context','usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a','usp_read_supplier_cards','usp_read_work_catalog_product_b40b0745_1fa0_4970_b19f_1479cf75d67a','usp_set_test_product_price','usp_update_test_supplier_contact','usp_work_inbound_ready','usp_work_supplier_payment_ready'].map(n=>'dbo.'+n));
export function getCanonicalBusinessSaleDefinitionHash(name,fallback){return registeredSaleDefinitionHashes&&Object.hasOwn(registeredSaleDefinitionHashes,name)?registeredSaleDefinitionHashes[name]:fallback;}
const environments=new WeakMap();
const saleAdmissions=new WeakMap(),saleTransactions=new WeakMap(),issuedSaleTransactions=new WeakMap(),saleReadContexts=new WeakMap();
const saleRuntimeBootstraps=new WeakMap();let registeredSaleRuntime=null;
const saleOperations=Object.freeze({sale_draft:'sales.create',sale_finalize:'sales.finalize',sale_cancel:'sales.cancel'});
const saleError=()=>{throw Object.assign(new Error('Native satış işlem kanıtı doğrulanamadı.'),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED',statusCode:503});};
const frozen=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;};
const positiveId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const exact=(v,scale)=>typeof v==='string'&&new RegExp(`^(?:0|[1-9]\\d{0,13})\\.\\d{${scale}}$`).test(v);
const sha=v=>typeof v==='string'&&/^[a-fA-F0-9]{64}$/.test(v);
function normalizeSaleAdmission(profile){
 if(!profile||Object.keys(profile).sort().join(',')!=='assertDefinitionHash,beginDefinitionHash,contextDefinitionHash,effectsDefinitionHash,legacyProof,profileHash,readerDefinitions,schemaVersion'||profile.schemaVersion!=='melisa-canonical-business-sale-admission.v1'||!['profileHash','assertDefinitionHash','beginDefinitionHash','contextDefinitionHash','effectsDefinitionHash'].every(k=>sha(profile[k]))||!profile.legacyProof||Object.keys(profile.legacyProof).sort().join(',')!=='contextHash,effectsHash,readyHash'||!Object.values(profile.legacyProof).every(sha)||!profile.readerDefinitions||Object.keys(profile.readerDefinitions).sort().join('|')!==[...CANONICAL_BUSINESS_SALE_READER_MODULES].sort().join('|')||!Object.values(profile.readerDefinitions).every(sha))saleError();
 return frozen({...profile,...Object.fromEntries(['profileHash','assertDefinitionHash','beginDefinitionHash','contextDefinitionHash','effectsDefinitionHash'].map(k=>[k,profile[k].toUpperCase()])),legacyProof:Object.fromEntries(Object.entries(profile.legacyProof).map(([k,v])=>[k,v.toUpperCase()])),readerDefinitions:Object.fromEntries(Object.entries(profile.readerDefinitions).map(([k,v])=>[k,v.toUpperCase()]))});
}
export const getCanonicalBusinessSaleLegacyProof=()=>registeredLegacySaleProof;
// Metadata compatibility for the admitted API process only. This
// never creates a business session or enables an actor/route/write scope.
export async function configureCanonicalBusinessSaleLegacyProof({profile,identity,mode,port,pool}){
 if(profile===undefined)return null;
 const expected=normalizeSaleAdmission(profile);
 if(registeredLegacySaleProof||identity?.databaseName!==BUSINESS_SESSION.database||identity.serverName!==BUSINESS_SESSION.server||identity.sysadmin!==0||identity.databaseControl!==0||identity.liveDatabaseAccess!==0||mode!=='erp'||port!==4144||identity.canInsertSales!==1)saleError();
 const rows=(await pool.request().query("SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.work_trade_assert_ready',N'P'))),2) readyHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.work_trade_get_context',N'P'))),2) contextHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.work_trade_assert_effects',N'P'))),2) effectsHash;")).recordset;
 if(rows?.length!==1||Object.entries(expected.legacyProof).some(([k,v])=>rows[0][k]!==v))saleError();
 if(mode==='erp'){
  const native=(await pool.request().query("SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_assert_v1',N'P'))),2) assertDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_begin_v1',N'P'))),2) beginDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_context_v1',N'P'))),2) contextDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_effects_v1',N'P'))),2) effectsDefinitionHash;")).recordset;
  if(native?.length!==1||['assertDefinitionHash','beginDefinitionHash','contextDefinitionHash','effectsDefinitionHash'].some(k=>native[0][k]!==expected[k]))saleError();
 }
 const readerRows=(await pool.request().query(`SELECT v.name,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(v.name,N'P'))),2) definitionHash FROM(VALUES ${CANONICAL_BUSINESS_SALE_READER_MODULES.map(n=>`(N'${n}')`).join(',')})v(name);`)).recordset;
 if(readerRows?.length!==CANONICAL_BUSINESS_SALE_READER_MODULES.length||new Set(readerRows.map(r=>r.name)).size!==readerRows.length||readerRows.some(r=>expected.readerDefinitions[r.name]!==r.definitionHash))saleError();
 registeredLegacySaleProof=expected.legacyProof;registeredSaleDefinitionHashes=expected.readerDefinitions;return registeredLegacySaleProof;
}
export const CANONICAL_BUSINESS_SALE_METADATA_SQL="SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,SUSER_SNAME() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') liveDatabaseAccess,@@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',@canonicalSaleLock,N'Transaction') lockMode,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_assert_v1',N'P'))),2) assertDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_begin_v1',N'P'))),2) beginDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_effects_v1',N'P'))),2) effectsDefinitionHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_canonical_business_sale_context_v1',N'P'))),2) contextDefinitionHash;";

// Protected startup configuration is only an expected pin, never an issuance of
// a native write grant. Missing admission keeps existing installations closed.
export function configureCanonicalBusinessSaleAdmission(context,profile,{writesEnabled=false}={}){
 assertCanonicalBusinessSession(context);
 if(profile===undefined)return null;
 if(saleAdmissions.has(context)||typeof writesEnabled!=='boolean')saleError();const normalized=normalizeSaleAdmission(profile),value=Object.freeze({...normalized,writesEnabled});
 if(registeredLegacySaleProof===null||registeredSaleDefinitionHashes===null||Object.entries(value.legacyProof).some(([k,v])=>registeredLegacySaleProof[k]!==v)||Object.entries(value.readerDefinitions).some(([k,v])=>registeredSaleDefinitionHashes[k]!==v))saleError();saleAdmissions.set(context,value);const bootstrap=Object.freeze(Object.create(null));saleRuntimeBootstraps.set(bootstrap,{context,profile:value});return bootstrap;
}
// The startup-only capability is opaque, consumed once, and never returned by
// the normal session or admission getters. The pure starter graph stays closed.
export function consumeCanonicalBusinessSaleRuntimeBootstrap(bootstrap){
 const owned=saleRuntimeBootstraps.get(bootstrap);if(!owned||owned.context!==getCanonicalBusinessSession()||saleAdmissions.get(owned.context)!==owned.profile||registeredSaleRuntime!==null)saleError();assertCanonicalBusinessSession(owned.context);saleRuntimeBootstraps.delete(bootstrap);
 return Object.freeze({saleAdmissions,saleTransactions,issuedSaleTransactions,saleReadContexts,saleOperations,saleError,frozen,positiveId,exact,sha,installRuntime(handlers){
  if(registeredSaleRuntime!==null||getCanonicalBusinessSession()!==owned.context||saleAdmissions.get(owned.context)!==owned.profile||!handlers||Object.keys(handlers).sort().join(',')!=='read,run,with'||Object.values(handlers).some(fn=>typeof fn!=='function'))saleError();assertCanonicalBusinessSession(owned.context);registeredSaleRuntime=Object.freeze({...handlers});
 }});
}
export async function readCanonicalBusinessSaleContext(input){if(!registeredSaleRuntime)saleError();return registeredSaleRuntime.read(input);}
export async function runCanonicalBusinessSaleTransaction(input,callback){if(!registeredSaleRuntime)saleError();return registeredSaleRuntime.run(input,callback);}
export async function withCanonicalBusinessSaleTransaction(input,callback){if(!registeredSaleRuntime)saleError();return registeredSaleRuntime.with(input,callback);}

export function isCanonicalBusinessSaleAvailable(actor){
 const context=getCanonicalBusinessSession();if(!context||!saleAdmissions.has(context))return false;
 assertCanonicalBusinessSession(context);
 return String(actor?.id)==='17'&&actor.username===context.username&&String(actor.role?.id)==='17'&&actor.role.code===context.roleCode&&actor.isActive!==false&&actor.isAdmin!==true&&actor.testAdminSession!==true&&Array.isArray(actor.permissions)&&JSON.stringify([...actor.permissions].sort())===JSON.stringify([...context.permissions].sort());
}
export function getCanonicalBusinessSaleAdmission(actor){return isCanonicalBusinessSaleAvailable(actor)?saleAdmissions.get(getCanonicalBusinessSession()):null;}
export function getCanonicalBusinessSaleContextProof(value){
 const owner=saleReadContexts.get(value);if(!owner)return null;
 assertCanonicalBusinessSession(owner);return value;
}
export function getCanonicalBusinessSaleTransaction(transaction,{operation,actorId,invoiceId}={}){
 const value=saleTransactions.get(transaction);if(!value)return null;
 assertCanonicalBusinessSession(value.context);
 if((operation!==undefined&&operation!==value.binding.operation)||(actorId!==undefined&&String(actorId)!==value.binding.actorId)||(invoiceId!==undefined&&(invoiceId===null?null:String(invoiceId))!==value.binding.invoiceId))saleError();
 return value.binding;
}
export function getCanonicalBusinessSaleCreationProofJSON(transaction){
 const value=saleTransactions.get(transaction);if(!value||value.binding.operation!=='sale_draft')saleError();assertCanonicalBusinessSession(value.context);return value.rawProofJSON;
}
// Pure projection of an existing SQL-issued account/product witness. This
// function never brands a context or creates transaction authority. Account
// sourceKey belongs to the selected customer ACCOUNT, not the customer row.
export function projectCanonicalBusinessSaleContext(value,proof,{profile,before,selection,operation}){
 const origin='CANONICAL_TEST_BUSINESS_SALE';
 if(!['preview','sale_draft'].includes(operation)||!proof||proof.database!==BUSINESS_SESSION.database||proof.server!==BUSINESS_SESSION.server||proof.profileHash!==profile?.profileHash||proof.actorId!=='17'||!Number.isSafeInteger(proof.sessionId)||proof.sessionId<=0||!positiveId(proof.transactionId)||proof.sessionId!==before?.sessionId||proof.transactionId!==before?.transactionId||proof.operation!==operation||proof.write!==(operation==='sale_draft')||!sha(proof.selectionHash)||!sha(proof.revision)||!sha(proof.previewHash)||!positiveId(proof.customerId)||!positiveId(proof.accountId)||!positiveId(proof.partyEntityId)||typeof proof.accountSourceKey!=='string'||!proof.accountSourceKey||!sha(proof.accountSourceWitnessHash))saleError();
 if(operation==='sale_draft'&&(typeof proof.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(proof.requestId)||!sha(proof.bodyHash)||proof.invoiceId!==null))saleError();
 if(operation==='preview'&&(proof.requestId!==null||proof.bodyHash!==null||proof.invoiceId!==null||proof.selectionHash!==proof.revision))saleError();
 if(!selection||proof.customerId!==selection.customerId||proof.accountId!==selection.customerAccountId||proof.currency!==selection.currency||!Array.isArray(selection.items)||selection.items.length<1||selection.items.length>2||!value||value.profileHash!==proof.profileHash||value.revision!==proof.revision||value.nativePreviewHash!==proof.previewHash||value.meta?.schemaVersion!=='melisa-work-trade.v1'||value.meta.source!=='canonical-business-test'||value.meta.operationOrigin!==origin||value.meta.date!==selection.documentDate||value.scope?.synthetic!==false||value.scope.operationOrigin!==origin||!Array.isArray(value.scope.products)||value.scope.products.length!==selection.items.length||!Array.isArray(proof.products)||proof.products.length!==selection.items.length)saleError();
 const customer=value.scope.customer;
 if(customer?.id!==proof.customerId||customer.accountId!==proof.accountId||customer.partyId!==proof.partyEntityId||customer.currency!==proof.currency||customer.synthetic!==false||customer.operationOrigin!==origin||customer.writeEligible!==true||customer.sourceKey!==undefined&&customer.sourceKey!==proof.accountSourceKey||!exact(proof.rateExact8,8)||!['TRY','USD','EUR'].includes(proof.currency)||BigInt(proof.rateExact8.replace('.',''))<=0n||value.rate?.currency!==proof.currency||value.rate.rateExact8!==proof.rateExact8||proof.currency==='TRY'&&proof.rateExact8!=='1.00000000')saleError();
 if(!value.nativeExpected||!Array.isArray(value.nativeExpected.items)||value.nativeExpected.items.length!==selection.items.length||!exact(proof.grandTotalExact4,4)||!exact(proof.amountTryExact4,4)||value.nativeExpected.grandTotalExact4!==proof.grandTotalExact4||value.nativeExpected.amountTryExact4!==proof.amountTryExact4)saleError();
 const ids=new Set();let total=0n;
 for(let i=0;i<selection.items.length;i++){
  const item=selection.items[i],p=proof.products[i],native=value.scope.products[i];
  if(!p||!native||!positiveId(p.productId)||!positiveId(p.quoteId)||!positiveId(p.unitSourceId)||ids.has(p.productId)||item.productId!==p.productId||item.quoteId!==p.quoteId||item.quantityExact3!==p.quantityExact3||native.id!==p.productId||native.synthetic!==false||native.operationOrigin!==origin||native.writeEligible!==true||typeof p.sourceKey!=='string'||!p.sourceKey||!sha(p.sourceWitnessHash)||native.sourceKey!==undefined&&native.sourceKey!==p.sourceKey||native.sourceWitnessHash!==undefined&&native.sourceWitnessHash!==p.sourceWitnessHash||typeof p.stockCode!=='string'||!p.stockCode||typeof p.name!=='string'||!p.name||(p.barcode!==null&&typeof p.barcode!=='string')||native.stockCode!==p.stockCode||native.name!==p.name||native.barcode!==p.barcode||p.unit!=='ADET'||p.factorExact8!=='1.00000000'||native.unit?.label!==p.unit||native.unit.factorExact8!==p.factorExact8||native.unit.sourceId!==p.unitSourceId||!exact(p.averageCostTryExact4,4)||native.costExact4!==p.averageCostTryExact4||!exact(native.stockQuantityExact3,3)||!Array.isArray(native.prices)||native.prices.length!==1||native.prices[0].quoteId!==p.quoteId||native.prices[0].currency!==proof.currency||native.prices[0].unitPriceExact8!==p.unitPriceExact8||!exact(p.quantityExact3,3)||! /^[1-5]\.000$/.test(p.quantityExact3)||!exact(p.unitPriceExact8,8)||!exact(p.unitPriceExact4,4)||!exact(p.lineTotalExact4,4))saleError();
  const quantity=BigInt(p.quantityExact3.replace('.','')),price8=BigInt(p.unitPriceExact8.replace('.','')),price4=BigInt(p.unitPriceExact4.replace('.','')),line=BigInt(p.lineTotalExact4.replace('.',''));
  if(price8<=0n||price4!==(price8+5000n)/10000n||line!==quantity*price4/1000n||BigInt(native.stockQuantityExact3.replace('.',''))<quantity||!value.nativeExpected.items[i]||Object.keys(value.nativeExpected.items[i]).sort().join(',')!=='lineTotalExact4,productId,quantityExact3,quoteId,unitPriceExact4'||['productId','quoteId','quantityExact3','unitPriceExact4','lineTotalExact4'].some(k=>value.nativeExpected.items[i][k]!==p[k]))saleError();
  ids.add(p.productId);total+=line;
 }
 if(total<=0n||total>5000000n||BigInt(proof.grandTotalExact4.replace('.',''))!==total||(total*BigInt(proof.rateExact8.replace('.',''))+50000000n)/100000000n!==BigInt(proof.amountTryExact4.replace('.',''))||BigInt(proof.amountTryExact4.replace('.',''))<=0n||BigInt(proof.amountTryExact4.replace('.',''))>5000000n)saleError();
 const projected=structuredClone(value);projected.scope.customer.sourceKey=proof.accountSourceKey;
 for(let i=0;i<projected.scope.products.length;i++){projected.scope.products[i].sourceKey=proof.products[i].sourceKey;projected.scope.products[i].sourceWitnessHash=proof.products[i].sourceWitnessHash;}
 return frozen(projected);
}
// Pure validation deliberately does not register a transaction or authorize the
// invoice engine. Only the SQL-bound wrapper above can populate its WeakMap.
export function validateCanonicalBusinessSaleTransactionProof(proof,{profile,before,requestId,operation,invoiceId,bodyHash,body}){
 if(!proof||proof.database!==BUSINESS_SESSION.database||proof.server!==BUSINESS_SESSION.server||proof.profileHash!==profile.profileHash||proof.actorId!=='17'||proof.sessionId!==before.sessionId||proof.transactionId!==before.transactionId||proof.requestId!==requestId||proof.operation!==operation||proof.bodyHash!==bodyHash||proof.invoiceId!==invoiceId||!sha(proof.selectionHash)||!sha(proof.revision)||body.expectedRevision!==proof.revision||!['customerId','partyEntityId','accountId'].every(key=>positiveId(proof[key]))||!['TRY','USD','EUR'].includes(proof.currency)||!exact(proof.rateExact8,8)||BigInt(proof.rateExact8.replace('.',''))<=0n||(proof.currency==='TRY'&&proof.rateExact8!=='1.00000000')||!exact(proof.grandTotalExact4,4)||!exact(proof.amountTryExact4,4)||BigInt(proof.grandTotalExact4.replace('.',''))<=0n||BigInt(proof.grandTotalExact4.replace('.',''))>5000000n||BigInt(proof.amountTryExact4.replace('.',''))<=0n||BigInt(proof.amountTryExact4.replace('.',''))>5000000n||!Array.isArray(proof.products)||proof.products.length<1||proof.products.length>2)saleError();
 if(operation==='sale_draft'&&(body.customerId!==proof.customerId||body.customerAccountId!==proof.accountId||body.currency!==proof.currency||!sha(proof.previewHash)||proof.previewHash!==body.previewHash||!Array.isArray(body.items)||body.items.length!==proof.products.length))saleError();
 if(operation==='sale_draft'&&(!proof.context||proof.context.profileHash!==proof.profileHash||proof.context.revision!==proof.revision||proof.context.nativePreviewHash!==proof.previewHash||proof.context.scope?.customer?.id!==proof.customerId||proof.context.scope.customer.accountId!==proof.accountId||proof.context.scope.customer.partyId!==proof.partyEntityId||proof.context.scope.customer.currency!==proof.currency))saleError();
 const ids=new Set();let total=0n;
 for(const p of proof.products){
  if(!positiveId(p.productId)||!positiveId(p.quoteId)||!positiveId(p.unitSourceId)||ids.has(p.productId)||typeof p.stockCode!=='string'||!p.stockCode||typeof p.name!=='string'||!p.name||(p.barcode!==null&&typeof p.barcode!=='string')||p.unit!=='ADET'||p.factorExact8!=='1.00000000'||!sha(p.sourceWitnessHash)||typeof p.sourceKey!=='string'||!p.sourceKey||!exact(p.quantityExact3,3)||!exact(p.unitPriceExact8,8)||!exact(p.unitPriceExact4,4)||!exact(p.lineTotalExact4,4)||!exact(p.averageCostTryExact4,4))saleError();
  const quantity=BigInt(p.quantityExact3.replace('.','')),price8=BigInt(p.unitPriceExact8.replace('.','')),price4=BigInt(p.unitPriceExact4.replace('.','')),line=BigInt(p.lineTotalExact4.replace('.',''));
  if(quantity<1000n||quantity>5000n||quantity%1000n!==0n||price8<=0n||price4<=0n||price4!==(price8+5000n)/10000n||line!==quantity*price4/1000n)saleError();
  if(operation==='sale_draft'){const item=body.items[ids.size];if(item.productId!==p.productId||item.quoteId!==p.quoteId||item.quantityExact3!==p.quantityExact3)saleError();}
  ids.add(p.productId);total+=line;
 }
 if(total!==BigInt(proof.grandTotalExact4.replace('.',''))||(total*BigInt(proof.rateExact8.replace('.',''))+50000000n)/100000000n!==BigInt(proof.amountTryExact4.replace('.','')))saleError();
 return operation==='sale_draft'?frozen({...proof,context:projectCanonicalBusinessSaleContext(proof.context,proof,{profile,before,selection:body,operation})}):frozen(proof);
}
const fail=()=>{throw Object.assign(new Error('Business TEST session target rejected'),{code:'AUTH_BUSINESS_TEST_TARGET_INVALID',statusCode:503});};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function validateBusinessSessionProfile(profile){
 if(!profile||Object.getPrototypeOf(profile)!==Object.prototype||Object.keys(profile).sort().join(',')!=='actualT1,externalOperations,id,permissionHash,sessionPath,userId'||profile.id!==BUSINESS_SESSION.id||profile.userId!==17||profile.permissionHash!==BUSINESS_SESSION.permissionHash||profile.sessionPath!==BUSINESS_SESSION.sessionPath||profile.actualT1!==false||profile.externalOperations!==false)fail();
 return profile;
}
function assertEnvironment(e){
 if(e.MELISA_CANONICAL_TEST!=='true'||e.SQL_DATABASE!==BUSINESS_SESSION.database||e.SQL_SERVER!=='127.0.0.1'||String(e.SQL_PORT)!=='1433'||e.SQL_USER!==BUSINESS_SESSION.login||e.SQL_READ_ONLY!=='false'||e.SQL_TRUSTED_CONNECTION!=='false'||String(e.API_PORT)!=='4144'||e.MELISA_CLEAN_TEST||e.MELISA_ISOLATED_OPERATION_COPY||e.MELISA_TEST_PROTECTED_SESSION_PATH!==BUSINESS_SESSION.sessionPath||! /^[A-Za-z0-9_-]{64,128}$/.test(e.MELISA_BUSINESS_SESSION_SECRET??'')||e.MELISA_BUSINESS_SESSION_SECRET===e.JWT_ACCESS_SECRET)fail();
}
function assertTarget({profile,identity,mode,port,writes,environment}){
 validateBusinessSessionProfile(profile);assertEnvironment(environment);
 if(mode!=='erp'||port!==4144||writes!==true||identity?.databaseName!==BUSINESS_SESSION.database||identity.serverName?.toLowerCase()!=='semih\\melisadev'||identity.loginName!==BUSINESS_SESSION.login||identity.databaseUser!==BUSINESS_SESSION.login||identity.sysadmin!==0||identity.databaseControl!==0||identity.liveDatabaseAccess!==0||identity.canInsertSales!==1)fail();
}
export function validateBusinessSessionWitness({profile,identity,mode,port,writes,environment,user,rows}){
 assertTarget({profile,identity,mode,port,writes,environment});
 if(Number(user?.id)!==17||user.username!==BUSINESS_SESSION.username||Number(user.roleId)!==17||user.roleCode!==BUSINESS_SESSION.roleCode||user.userActive!==true||user.roleActive!==true||user.systemRole!==false||!Array.isArray(rows)||rows.length!==36||digest(rows)!==BUSINESS_SESSION.permissionHash)fail();
 const permissions=applyRolePermissionDefaults(expandPermissions(rows.filter(r=>r.can_view||r.can_create||r.can_update||r.can_approve)),BUSINESS_SESSION.roleCode);
 return Object.freeze({environment:'CANONICAL_BUSINESS_TEST',database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,userId:17,username:BUSINESS_SESSION.username,roleId:17,roleCode:BUSINESS_SESSION.roleCode,permissions:Object.freeze(permissions),sessionPath:BUSINESS_SESSION.sessionPath,actualT1:false,externalOperations:false});
}
export async function configureCanonicalBusinessSession({config,identity,mode,port,writes,pool,environment=process.env}){
 if(mode==='native')return null;
 if(config.businessWorkface===undefined)return null;
 if(registered)fail();assertTarget({profile:config.businessWorkface,identity,mode,port,writes,environment});
 // Fresh SQL proof uses the already checked canonical service pool, never an
 // administrator connection, JWT claim, client identity or copied CLEAN row.
 const user=(await pool.request().query("SELECT u.id,u.username,u.is_active userActive,r.id roleId,r.code roleCode,r.is_active roleActive,r.is_system_role systemRole FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=17 AND u.username=N'unified-semih-test';")).recordset;
 const rows=(await pool.request().query('SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WHERE role_id=17 ORDER BY permission_key;')).recordset;
 if(user.length!==1)fail();
 registered=validateBusinessSessionWitness({profile:config.businessWorkface,identity,mode,port,writes,environment,user:user[0],rows});environments.set(registered,environment);return registered;
}
export function getCanonicalBusinessSession(){return registered;}
export function getCanonicalBusinessSigningKey(context){assertCanonicalBusinessSession(context);return environments.get(context).MELISA_BUSINESS_SESSION_SECRET;}
export function assertBusinessSessionPermissionRows(roleId,rows){
 if(!registered||Number(roleId)!==17)return;
 assertCanonicalBusinessSession(registered);
 if(!Array.isArray(rows)||rows.length!==36||digest(rows)!==BUSINESS_SESSION.permissionHash)throw Object.assign(new Error('Business TEST permissions changed'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
}
export function assertCanonicalBusinessSession(context){if(!context||context!==registered||!environments.has(context))fail();assertEnvironment(environments.get(context));return context;}
export function businessSessionUserAllowed(user,context,fingerprint){
 try{assertCanonicalBusinessSession(context);}catch{return false;}
 return !!(Number(user?.id)===17&&user.username===BUSINESS_SESSION.username&&Number(user.role?.id)===17&&user.role.code===BUSINESS_SESSION.roleCode&&user.isActive!==false&&user.isAdmin!==true&&user.testAdminSession!==true&&Array.isArray(user.permissions)&&JSON.stringify([...user.permissions].sort())===JSON.stringify([...context.permissions].sort())&&/^[a-f0-9]{64}$/.test(fingerprint??''));
}
export function businessSessionFingerprintWitness(user,row){
 if(!registered)return undefined;assertCanonicalBusinessSession(registered);
 if(user.username!==BUSINESS_SESSION.username&&Number(user.id)!==17)return undefined;
 if(Number(user.id)!==17||user.username!==BUSINESS_SESSION.username||Number(user.role?.id)!==17||user.role.code!==BUSINESS_SESSION.roleCode||row.is_active!==true||row.role_is_active!==true||!Array.isArray(user.permissions)||JSON.stringify([...user.permissions].sort())!==JSON.stringify([...registered.permissions].sort())||!/^[0][x][a-fA-F0-9]{16}$/.test(row.user_version??'')||!/^[0][x][a-fA-F0-9]{16}$/.test(row.role_version??''))throw Object.assign(new Error('Business TEST identity changed'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
 return [row.user_version,row.role_version];
}
