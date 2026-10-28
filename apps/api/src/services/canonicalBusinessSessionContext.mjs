import {createHash} from 'node:crypto';
import {expandPermissions,applyRolePermissionDefaults} from './permissionCatalog.js';
export const BUSINESS_SESSION=Object.freeze({id:'ERP-5244-REALDATA-20261027',database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',userId:17,username:'unified-semih-test',roleId:17,roleCode:'unified_test_semih',permissionRows:36,permissionHash:'d49893294b3feffa73cb80fdf32ef81e9e4a205db98de3d4becdfe00170bc1d7',sessionPath:'C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\grants.json'});
let registered=null,registeredLegacySaleProof=null,registeredSaleDefinitionHashes=null;
export const CANONICAL_BUSINESS_SALE_READER_MODULES=Object.freeze(['usp_assert_test_current_price_purchase_received','usp_assert_test_purchase_fx_received','usp_get_test_current_price_purchase_context','usp_get_test_product_prices','usp_get_test_purchase_fx_context','usp_get_test_purchase_fx_unit_evidence','usp_get_test_supplier_contact_context','usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a','usp_read_supplier_cards','usp_read_work_catalog_product_b40b0745_1fa0_4970_b19f_1479cf75d67a','usp_set_test_product_price','usp_update_test_supplier_contact','usp_work_inbound_ready','usp_work_supplier_payment_ready'].map(n=>'dbo.'+n));
export function getCanonicalBusinessSaleDefinitionHash(name,fallback){return registeredSaleDefinitionHashes&&Object.hasOwn(registeredSaleDefinitionHashes,name)?registeredSaleDefinitionHashes[name]:fallback;}
const environments=new WeakMap();
const saleAdmissions=new WeakMap(),saleTransactions=new WeakMap(),issuedSaleTransactions=new WeakMap(),saleReadContexts=new WeakMap();
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
 if(registeredLegacySaleProof===null||registeredSaleDefinitionHashes===null||Object.entries(value.legacyProof).some(([k,v])=>registeredLegacySaleProof[k]!==v)||Object.entries(value.readerDefinitions).some(([k,v])=>registeredSaleDefinitionHashes[k]!==v))saleError();saleAdmissions.set(context,value);return value;
}
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
export async function readCanonicalBusinessSaleContext({actor,selection}){
 if(!isCanonicalBusinessSaleAvailable(actor))saleError();
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(!selection||Object.keys(selection).sort().join(',')!=='currency,customerAccountId,customerId,documentDate,items'||!positiveId(selection.customerId)||!positiveId(selection.customerAccountId)||!['TRY','USD','EUR'].includes(selection.currency)||typeof selection.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(selection.documentDate)||!Array.isArray(selection.items)||selection.items.length<1||selection.items.length>2)saleError();
 const ids=new Set();for(const item of selection.items){if(!item||Object.keys(item).sort().join(',')!=='productId,quantityExact3,quoteId'||!positiveId(item.productId)||!positiveId(item.quoteId)||!exact(item.quantityExact3,3)||! /^[1-5]\.000$/.test(item.quantityExact3)||ids.has(item.productId))saleError();ids.add(item.productId);}
 selection=structuredClone(selection);
 const db=await import('../config/database.js');if(!db.isCanonicalTest()||db.isIsolatedOperationCopyRuntime?.())saleError();
 const pool=await db.getSqlPool(),sql=db.getSqlDriver(),transaction=new sql.Transaction(pool),request=()=>new sql.Request(transaction);
 try{
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@canonicalSaleLock,@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51106,'CANONICAL_BUSINESS_SALE_BUSY',1;");
  const metadata=async()=>{const rows=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(rows?.length!==1)saleError();const m=rows[0];if(m.databaseName!==BUSINESS_SESSION.database||m.serverName!==BUSINESS_SESSION.server||m.loginName!==BUSINESS_SESSION.login||m.databaseUser!==BUSINESS_SESSION.login||m.sysadmin!==0||m.databaseControl!==0||m.liveDatabaseAccess!==0||m.transactionCount!==1||m.transactionState!==1||m.isolationLevel!==4||m.lockMode!=='Shared'||m.assertDefinitionHash!==profile.assertDefinitionHash||m.beginDefinitionHash!==profile.beginDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash||m.effectsDefinitionHash!==profile.effectsDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash)saleError();return m;};
  const before=await metadata(),rows=(await request().input('actor_id',sql.BigInt,'17').input('selection_json',sql.NVarChar(sql.MAX),JSON.stringify(selection)).execute('dbo.usp_canonical_business_sale_context_v1')).recordset;
  if(rows?.length!==1||typeof rows[0].context_json!=='string')saleError();let value;try{value=JSON.parse(rows[0].context_json);}catch{saleError();}
  const scope=value?.scope;
  if(value?.profileHash!==profile.profileHash||!sha(value.revision)||!sha(value.nativePreviewHash)||value.meta?.date!==selection.documentDate||value.meta.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||scope?.synthetic!==false||scope.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||scope.customer?.id!==selection.customerId||scope.customer.accountId!==selection.customerAccountId||scope.customer.currency!==selection.currency||!positiveId(scope.customer.partyId)||!Array.isArray(scope.products)||scope.products.length!==selection.items.length||value.capabilities?.canCollect!==false||value.capabilities.canCancelCollection!==false||!exact(value.rate?.rateExact8,8)||value.rate.currency!==selection.currency||typeof value.rate.rateDate!=='string'||value.rate.rateDate>selection.documentDate||typeof value.rate.sourceKey!=='string'||!value.nativeExpected||!Array.isArray(value.nativeExpected.items)||value.nativeExpected.items.length!==selection.items.length)saleError();
  for(const item of selection.items){const p=scope.products.filter(p=>p.id===item.productId);if(p.length!==1||p[0].synthetic!==false||p[0].operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||p[0].unit?.label!=='ADET'||p[0].unit.factorExact8!=='1.00000000'||!positiveId(p[0].unit.sourceId)||!exact(p[0].costExact4,4)||!Array.isArray(p[0].prices)||p[0].prices.filter(q=>q.quoteId===item.quoteId&&q.currency===selection.currency&&exact(q.unitPriceExact8,8)).length!==1)saleError();}
  if(JSON.stringify(await metadata())!==JSON.stringify(before))saleError();
  await transaction.commit();value.revision=value.revision.toLowerCase();value.nativePreviewHash=value.nativePreviewHash.toLowerCase();for(const key of ['canCreate','canFinalize','canCancel'])value.capabilities[key]=profile.writesEnabled===true&&value.capabilities[key]===true;frozen(value);saleReadContexts.set(value,context);return value;
 }catch(error){try{await transaction.rollback();}catch{}throw error;}
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
// The only issuer constructs its own transaction with the production pool and
// driver. No caller-provided request, driver, connection or transaction is an
// authority. This entry remains unusable until a reviewed SQL admission exists.
export async function runCanonicalBusinessSaleTransaction(input,callback){
 if(!input||Object.keys(input).some(k=>!['actor','requestId','operation','invoiceId','bodyJson'].includes(k)))saleError();
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(!profile||profile.writesEnabled!==true||typeof callback!=='function')saleError();
 if(!Object.hasOwn(saleOperations,input.operation)||String(input.actor?.id)!=='17'||input.actor.username!==context.username||String(input.actor.role?.id)!=='17'||input.actor.role.code!==context.roleCode||input.actor.isActive===false||input.actor.isAdmin===true||input.actor.testAdminSession===true||!Array.isArray(input.actor.permissions)||JSON.stringify([...input.actor.permissions].sort())!==JSON.stringify([...context.permissions].sort())||!input.actor.permissions.includes(saleOperations[input.operation])||typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId)||typeof input.bodyJson!=='string')saleError();
 let body;try{body=JSON.parse(input.bodyJson);}catch{saleError();}
 if(!body||body.actorId!=='17'||body.operation!==input.operation||body.requestId!==input.requestId||(input.operation!=='sale_draft'&&(!positiveId(input.invoiceId)||body.id!==input.invoiceId)))saleError();
 input=Object.freeze({...input,actor:Object.freeze({...input.actor,role:Object.freeze({...input.actor.role}),permissions:Object.freeze([...input.actor.permissions])})});
 const db=await import('../config/database.js');
 if(!db.isCanonicalTest()||db.isIsolatedOperationCopyRuntime?.())saleError();
 const pool=await db.getSqlPool(),sql=db.getSqlDriver(),transaction=new sql.Transaction(pool);
 issuedSaleTransactions.set(transaction,{pool,sql,context});
 let committing=false;
 try{
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(transaction);
  await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@canonicalSaleLock,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51106,'CANONICAL_BUSINESS_SALE_BUSY',1;");
  const metadata=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;
  if(metadata?.length!==1||metadata[0].databaseName!==BUSINESS_SESSION.database||metadata[0].serverName!==BUSINESS_SESSION.server||metadata[0].loginName!==BUSINESS_SESSION.login||metadata[0].databaseUser!==BUSINESS_SESSION.login||metadata[0].sysadmin!==0||metadata[0].databaseControl!==0||metadata[0].liveDatabaseAccess!==0||metadata[0].transactionCount!==1||metadata[0].transactionState!==1||metadata[0].isolationLevel!==4||metadata[0].lockMode!=='Exclusive'||metadata[0].assertDefinitionHash!==profile.assertDefinitionHash||metadata[0].beginDefinitionHash!==profile.beginDefinitionHash||metadata[0].effectsDefinitionHash!==profile.effectsDefinitionHash||metadata[0].contextDefinitionHash!==profile.contextDefinitionHash)saleError();
  if(!Number.isSafeInteger(metadata[0].sessionId)||metadata[0].sessionId<=0||!positiveId(metadata[0].transactionId))saleError();
  const unchangedMetadata=async()=>{const current=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(current?.length!==1||JSON.stringify(current[0])!==JSON.stringify(metadata[0]))saleError();};
  // The owner checks the existing journal before resolving prices/stock. A
  // committed request never obtains another native transaction write binding.
  const issued=(await request().input('request_id',sql.UniqueIdentifier,input.requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),input.operation).input('payload_json',sql.NVarChar(sql.MAX),input.bodyJson).execute('dbo.usp_canonical_business_sale_begin_v1')).recordset;
  if(issued?.length!==1)saleError();
  const bodyHash=createHash('sha256').update(input.bodyJson,'utf16le').digest('hex').toUpperCase();
  if(issued[0].replayed===true){
   const old=issued[0];if(old.actorId!=='17'||old.operation!==input.operation||old.bodyHash!==bodyHash||typeof old.response_json!=='string')saleError();
   const value=JSON.parse(old.response_json);if(!value||value.requestId!==input.requestId)saleError();
   await unchangedMetadata();committing=true;await transaction.commit();return {...value,replayed:true};
  }
  if(issued[0].replayed!==false)saleError();
  const result=await withCanonicalBusinessSaleTransaction({...input,transaction},binding=>callback({binding,transaction,sql}));
  if(!result||result.requestId!==input.requestId)saleError();
  const responseJSON=JSON.stringify(result),responseHash=createHash('sha256').update(responseJSON,'utf16le').digest('hex').toUpperCase();
  await request().input('id',sql.UniqueIdentifier,input.requestId).input('actor',sql.BigInt,'17').input('operation',sql.NVarChar(30),input.operation).input('hash',sql.Char(64),bodyHash).input('payload',sql.NVarChar(sql.MAX),input.bodyJson).input('response',sql.NVarChar(sql.MAX),responseJSON).query('INSERT dbo.work_trade_requests(request_id,actor_id,operation,payload_hash,payload_json,response_json)VALUES(@id,@actor,@operation,@hash,@payload,@response);');
  const completed=(await request().input('request_id',sql.UniqueIdentifier,input.requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),input.operation).input('completed',sql.Bit,true).execute('dbo.usp_canonical_business_sale_assert_v1')).recordset;
  if(completed?.length!==1||completed[0].completed!==true||completed[0].phase!=='DONE'||completed[0].requestId!==input.requestId||completed[0].actorId!=='17'||completed[0].operation!==input.operation||completed[0].bodyHash!==bodyHash||completed[0].responseHash!==responseHash)saleError();
  await unchangedMetadata();committing=true;await transaction.commit();return result;
 }catch(error){try{await transaction.rollback();}catch{}if(committing)throw Object.assign(new Error('İşlemin sonucu henüz doğrulanamadı. Aynı işlem kimliğiyle sonucu kontrol edin.'),{code:'CANONICAL_BUSINESS_SALE_COMMIT_UNCONFIRMED',statusCode:503});throw error;}
 finally{saleTransactions.delete(transaction);issuedSaleTransactions.delete(transaction);}
}
export async function withCanonicalBusinessSaleTransaction(input,callback){
 const {transaction,actor,requestId,operation,invoiceId=null,bodyJson}=input??{},issued=issuedSaleTransactions.get(transaction);
 if(!issued||Object.hasOwn(input,'request')||Object.hasOwn(input,'sql')||transaction.parent!==issued.pool)saleError();
 const {sql}=issued,request=()=>new sql.Request(transaction);
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(issued.context!==context)saleError();
 if(!profile||!transaction||typeof request!=='function'||typeof callback!=='function'||saleTransactions.has(transaction)||!Object.hasOwn(saleOperations,operation)||String(actor?.id)!=='17'||actor.username!==context.username||String(actor.role?.id)!=='17'||actor.role.code!==context.roleCode||actor.isActive===false||actor.isAdmin===true||actor.testAdminSession===true||!Array.isArray(actor.permissions)||JSON.stringify([...actor.permissions].sort())!==JSON.stringify([...context.permissions].sort())||!actor.permissions.includes(saleOperations[operation])||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)||typeof bodyJson!=='string'||(invoiceId!==null&&!positiveId(invoiceId)))saleError();
 const bodyHash=createHash('sha256').update(bodyJson,'utf16le').digest('hex').toUpperCase();
 let body;try{body=JSON.parse(bodyJson);}catch{saleError();}
 if(!body||typeof body!=='object'||Array.isArray(body)||body.actorId!=='17'||body.operation!==operation||body.requestId!==requestId||(operation!=='sale_draft'&&body.id!==invoiceId))saleError();
 const req=()=>{const r=request();if(r?.parent!==transaction)saleError();return r;};
 const metadata=async()=>{const rows=(await req().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(rows?.length!==1)saleError();const m=rows[0];if(m.databaseName!==BUSINESS_SESSION.database||m.serverName!==BUSINESS_SESSION.server||m.loginName!==BUSINESS_SESSION.login||m.databaseUser!==BUSINESS_SESSION.login||m.sysadmin!==0||m.databaseControl!==0||m.liveDatabaseAccess!==0||m.transactionCount!==1||m.transactionState!==1||m.isolationLevel!==4||m.lockMode!=='Exclusive'||!Number.isSafeInteger(m.sessionId)||m.sessionId<=0||!positiveId(m.transactionId)||m.assertDefinitionHash!==profile.assertDefinitionHash||m.beginDefinitionHash!==profile.beginDefinitionHash||m.effectsDefinitionHash!==profile.effectsDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash)saleError();return m;};
 const before=await metadata();
 const rows=(await req().input('request_id',sql.UniqueIdentifier,requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),operation).execute('dbo.usp_canonical_business_sale_assert_v1')).recordset;
 if(rows?.length!==1||typeof rows[0].proof_json!=='string')saleError();
 let proof;try{proof=JSON.parse(rows[0].proof_json);}catch{saleError();}
 const binding=validateCanonicalBusinessSaleTransactionProof(proof,{profile,before,requestId,operation,invoiceId,bodyHash,body});
 const after=await metadata();if(JSON.stringify(after)!==JSON.stringify(before))saleError();
  saleTransactions.set(transaction,{context,binding,rawProofJSON:rows[0].proof_json});
  if(operation==='sale_draft')saleReadContexts.set(binding.context,context);
 try{
  const value=await callback(binding);
  await req().input('request_id',sql.UniqueIdentifier,requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),operation).execute('dbo.usp_canonical_business_sale_effects_v1');
  if(JSON.stringify(await metadata())!==JSON.stringify(before))saleError();
  return value;
 }finally{saleTransactions.delete(transaction);if(operation==='sale_draft')saleReadContexts.delete(binding.context);}
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
 return frozen(proof);
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
