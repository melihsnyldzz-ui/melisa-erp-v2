import {createHash} from 'node:crypto';

const HEX=/^[a-f0-9]{64}$/, CODE=/^[A-Z0-9_]{1,100}$/;
const SCHEMA='melisa-product-last-purchase.v2';
const SELECTION_REASONS=['LATEST_VERIFIED_PURCHASE_DOCUMENT','LATEST_VERIFIED_COMMERCIAL_ENTRY','OLDER_VERIFIED_WITH_NEWER_AMBIGUITY','CARD_FALLBACK_NO_VERIFIED_NET_SOURCE','NO_VERIFIED_SOURCE','MANUAL_PURCHASE_PROTECTED'];
const fail=(code='PURCHASE_REFERENCE_UNAVAILABLE',statusCode=503,message='Alış referansı şu anda doğrulanamıyor.')=>Object.assign(new Error(message),{code,statusCode});
const names=kind=>[`dbo.usp_assert_product_${kind}`,`dbo.usp_get_product_${kind}`,...['proof','rows','runs'].map(k=>`erp_migration.immutable_product_${kind}_${k}`)];
const OLD_NAMES=names('purchase_reference'), NEW_NAMES=names('last_purchase');
export const lastPurchaseSqlHash=value=>createHash('sha256').update(value,'utf16le').digest('hex');
const exact=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8,18}$/.test(v);
const positive=v=>exact(v)&&v!==null&&BigInt(v.replace('.',''))>0n;
const currency=v=>[null,'TRY','USD','EUR'].includes(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=250;
const codes=v=>Array.isArray(v)&&v.length<=100&&v.every(s=>typeof s==='string'&&CODE.test(s));
function date(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.test(v))return false;
 const day=v.slice(0,10);return Number.isFinite(Date.parse(v))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
}
export function card(raw,id,code){
 if(raw.schemaVersion!=='melisa-product-purchase-reference.v1'||raw.productId!==id||raw.stockCode!==code||!HEX.test(raw.productHash??'')||!HEX.test(raw.bindingHash??'')||!['cardAmountExact','referenceExact','discountExact'].every(k=>exact(raw[k]))||!currency(raw.currency)||!(raw.unitLabel===null||text(raw.unitLabel))||!['UNKNOWN','GROSS','NET'].includes(raw.priceBasis)||!['PROTECTED_MANUAL_PURCHASE','REFERENCE_AVAILABLE','CARD_AMOUNT_ONLY','PARTIAL_CARD_AMOUNT','PURCHASE_UNKNOWN'].includes(raw.status)||!['SOURCE_CARD_AMOUNT','SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT','GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE','PRESERVE_MANUAL_PURCHASE'].includes(raw.method)||!date(raw.sourceAsOf)||!codes(raw.reasons)||typeof raw.protectedExistingCost!=='boolean'||typeof raw.protectedManual!=='boolean'||raw.accountingCost!==false||raw.financialWrites!==0)throw fail();
 if(raw.referenceExact!==null&&(raw.currency===null||raw.unitLabel===null||raw.priceBasis==='UNKNOWN')||raw.status==='REFERENCE_AVAILABLE'&&raw.referenceExact===null||raw.priceBasis==='NET'&&raw.referenceExact!==null&&raw.referenceExact!==raw.cardAmountExact||raw.protectedManual&&(raw.cardAmountExact!==null||raw.referenceExact!==null))throw fail();
 if(raw.referenceExact!==null&&raw.priceBasis==='NET'&&raw.method!=='SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT'||raw.referenceExact!==null&&raw.priceBasis==='GROSS'&&raw.method!=='GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE')throw fail();
 if(raw.referenceExact!==null&&raw.priceBasis==='GROSS'&&(raw.cardAmountExact===null||raw.discountExact===null||raw.cardAmountExact.split('.')[1].length!==8||raw.discountExact.split('.')[1].length!==8||raw.referenceExact.split('.')[1].length!==18||BigInt(raw.referenceExact.replace('.',''))!==BigInt(raw.cardAmountExact.replace('.',''))*(10000000000n-BigInt(raw.discountExact.replace('.','')))))throw fail();
 if(raw.discountExact!==null&&BigInt(raw.discountExact.replace('.',''))>100n*10n**BigInt(raw.discountExact.split('.')[1].length))throw fail();
 return raw;
}
function rational(raw){
 const n=raw.referenceNumerator,d=raw.referenceDenominator;
 if(n===null&&d===null){if(raw.precisionStatus!==null||raw.referenceExact!==null&&raw.sourceKind!=='CARD')throw fail();return;}
 if(!positive(raw.referenceExact)||typeof n!=='string'||typeof d!=='string'||!/^[1-9]\d{0,199}$/.test(n)||!/^[1-9]\d{0,199}$/.test(d)||!['EXACT','TRUNCATED_18'].includes(raw.precisionStatus))throw fail();
 const scale=raw.referenceExact.split('.')[1].length,scaled=BigInt(n)*10n**BigInt(scale),den=BigInt(d),remainder=scaled%den;
 if(scaled/den!==BigInt(raw.referenceExact.replace('.',''))||raw.precisionStatus==='EXACT'&&remainder!==0n||raw.precisionStatus==='TRUNCATED_18'&&(scale!==18||remainder===0n))throw fail();
}
export function selected(raw,c,parentHash,id,code,sourceAsOf){
 if(raw.schemaVersion!==SCHEMA||raw.productId!==id||raw.stockCode!==code||raw.parentRecordHash!==parentHash||raw.productHash!==c.productHash||raw.bindingHash!==c.bindingHash||raw.sourceAsOf!==sourceAsOf||!exact(raw.referenceExact)||raw.referenceExact!==null&&!positive(raw.referenceExact)||!currency(raw.referenceCurrency)||!(raw.referenceUnitLabel===null||text(raw.referenceUnitLabel))||!(raw.referenceDate===null||date(raw.referenceDate))||!['PURCHASE_DOCUMENT','COMMERCIAL_ENTRY','CARD','UNKNOWN'].includes(raw.sourceKind)||!SELECTION_REASONS.includes(raw.selectionReason)||!codes(raw.reasons)||!['NET_REFERENCE','CARD_ONLY','PARTIAL_CARD','PURCHASE_UNKNOWN','PROTECTED_MANUAL'].includes(raw.status)||raw.accountingCost!==false||raw.financialWrites!==0)throw fail();
 const net=raw.referenceExact!==null;
 if(net&&(raw.referenceCurrency===null||raw.referenceUnitLabel===null||!['PURCHASE_DOCUMENT','COMMERCIAL_ENTRY'].includes(raw.sourceKind)||raw.status!=='NET_REFERENCE'||raw.referenceDate===null)||!net&&raw.status==='NET_REFERENCE'||c.protectedManual&&(net||raw.status!=='PROTECTED_MANUAL')||!c.protectedManual&&raw.status==='PROTECTED_MANUAL')throw fail();
 rational(raw);
 if(!Array.isArray(raw.alternatives)||raw.alternatives.length>3)throw fail();
 const alternatives=raw.alternatives.map(a=>{if(!a||typeof a!=='object'||!['PURCHASE_DOCUMENT','COMMERCIAL_ENTRY','CARD','UNKNOWN'].includes(a.sourceKind)||!exact(a.amountExact)||!currency(a.currency)||!(a.unitLabel===null||text(a.unitLabel))||!(a.date===null||date(a.date))||typeof a.reason!=='string'||!CODE.test(a.reason))throw fail();return Object.fromEntries(['sourceKind','amountExact','currency','unitLabel','date','reason'].map(k=>[k,a[k]]));});
 return {...Object.fromEntries(['schemaVersion','productId','stockCode','referenceExact','referenceCurrency','referenceUnitLabel','referenceDate','sourceKind','selectionReason','reasons','status','sourceAsOf','accountingCost','referenceNumerator','referenceDenominator','precisionStatus'].map(k=>[k,raw[k]])),alternatives,cardAmountExact:c.cardAmountExact,cardCurrency:c.currency,cardUnitLabel:c.unitLabel,discountExact:c.discountExact,cardPriceBasis:c.priceBasis,protectedExistingCost:c.protectedExistingCost,protectedManual:c.protectedManual};
}
async function defaultRuntime(){
 const db=await import('../config/database.js');
 const manifestHash=process.env.MELISA_PRODUCT_LAST_PURCHASE_REFERENCE_MANIFEST_HASH,parentManifestHash=process.env.MELISA_PRODUCT_PURCHASE_REFERENCE_MANIFEST_HASH;
 if(!db.isCanonicalTest()||process.env.MELISA_PRODUCT_PURCHASE_REFERENCE_VERSION!=='2'||!HEX.test(manifestHash??'')||!HEX.test(parentManifestHash??''))throw fail();
 const {LAST_PURCHASE_SQL_PROOF:proof}=await import('../../../../scripts/migration/product-last-purchase-sql.mjs');
 const {PURCHASE_REFERENCE_SQL_PROOF:parentProof}=await import('../../../../scripts/migration/product-purchase-reference-sql.mjs');
 return {canonicalTest:true,pool:await db.getSqlPool(),sql:db.getSqlDriver(),manifestHash,parentManifestHash,proof,parentProof};
}
export function createProductLastPurchaseReferenceService({getRuntime=defaultRuntime}={}){
 return {async read(id,query={},actor){
  if(typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n||!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length)throw fail('PURCHASE_REFERENCE_INPUT',400,'Ürün kimliği veya okuma isteği geçersiz.');
  if(!actor)throw fail('AUTH_TOKEN_REQUIRED',401,'Oturum gerekli.');
  if(!Array.isArray(actor.permissions)||!['product.view','purchase.view','finance.view'].every(p=>actor.permissions.includes(p)))throw fail('AUTH_PERMISSION_DENIED',403,'Bu bilgi için yetkiniz bulunmuyor.');
  let tx;try{
   const r=await getRuntime();
   if(r.canonicalTest!==true||!HEX.test(r.manifestHash??'')||!HEX.test(r.parentManifestHash??''))throw fail();
   for(const [proof,list]of [[r.proof,NEW_NAMES],[r.parentProof,OLD_NAMES]])if(!HEX.test(proof?.readerDefinitionHash??'')||Object.keys(proof.moduleHashes??{}).length!==5||!list.every(n=>HEX.test(proof.moduleHashes[n]??'')))throw fail();
   const q=r.sql;tx=new q.Transaction(r.pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
   const identity=(await req().query("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live")).recordset?.[0];
   if(identity?.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.serverName!=='Semih\\MELISADEV'||identity.login!=='melisa_sirket_sales_test_20260929_01'||identity.databaseUser!==identity.login||identity.sysadmin!==0||identity.control!==0||identity.live!==0)throw fail();
   const moduleHashes={...r.parentProof.moduleHashes,...r.proof.moduleHashes},list=[...OLD_NAMES,...NEW_NAMES];
   const observed=(await req().query(`SELECT s.name+N'.'+o.name object_name,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)) definition_hash FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE s.name+N'.'+o.name IN(${list.map(n=>"N'"+n+"'").join(',')})`)).recordset;
   if(!Array.isArray(observed)||observed.length!==10||new Set(observed.map(x=>x.object_name)).size!==10||observed.some(x=>moduleHashes[x.object_name]!==x.definition_hash))throw fail();
   const result=await req().input('product_id',q.BigInt,id).execute('dbo.usp_get_product_last_purchase'),sets=result.recordsets;
   if(!Array.isArray(sets)||sets.length!==3||sets[0]?.length!==1||!Array.isArray(sets[1])||!Array.isArray(sets[2])||sets[1].length>1||sets[2].length>1)throw fail();
   const h=sets[0][0];
   if(h.databaseName!==identity.databaseName||h.serverName!==identity.serverName||h.readerDefinitionHash!==r.proof.readerDefinitionHash||h.manifestHash!==r.manifestHash||h.parentManifestHash!==r.parentManifestHash||!HEX.test(h.parentRowsHash??'')||h.runStatus!=='COMMITTED'||!HEX.test(h.sourceHash??'')||!date(h.sourceAsOf)||!text(h.runId)||!Number.isSafeInteger(h.metadataRows)||h.metadataRows<1)throw fail();
   if(h.requestedProductId===null)throw fail('PURCHASE_REFERENCE_NOT_FOUND',404,'Ürün bulunamadı.');
   if(h.requestedProductId!==id||!text(h.stockCode)||sets[1].length!==1||sets[2].length!==1)throw fail();
   for(const row of [sets[1][0],sets[2][0]])if(typeof row.rowJson!=='string'||!HEX.test(row.rowHash??'')||lastPurchaseSqlHash(row.rowJson)!==row.rowHash)throw fail();
   const c=card(JSON.parse(sets[1][0].rowJson),id,h.stockCode),data=selected(JSON.parse(sets[2][0].rowJson),c,sets[1][0].rowHash,id,h.stockCode,h.sourceAsOf);
   await tx.commit();return {data,meta:{readOnly:true,financialEffect:false}};
  }catch(e){if(tx)try{await tx.rollback();}catch{}if([400,401,403,404].includes(e?.statusCode))throw e;throw fail();}
 }};
}
export const productLastPurchaseReferenceService=createProductLastPurchaseReferenceService();
