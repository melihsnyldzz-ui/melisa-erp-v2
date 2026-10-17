import {createHash} from 'node:crypto';
const fail=(code='PURCHASE_REFERENCE_UNAVAILABLE',statusCode=503,message='Alış referansı şu anda doğrulanamıyor.')=>Object.assign(new Error(message),{code,statusCode});
const ID=/^[1-9]\d{0,18}$/,HEX=/^[a-f0-9]{64}$/;
const moduleNames=['dbo.usp_assert_product_purchase_reference','dbo.usp_get_product_purchase_reference','erp_migration.immutable_product_purchase_reference_proof','erp_migration.immutable_product_purchase_reference_rows','erp_migration.immutable_product_purchase_reference_runs'];
export const purchaseReferenceSqlHash=v=>createHash('sha256').update(v,'utf16le').digest('hex');
function productId(v){if(typeof v!=='string'||!ID.test(v)||BigInt(v)>9223372036854775807n)throw fail('PURCHASE_REFERENCE_INPUT',400,'Ürün kimliği geçersiz.');return v;}
const exact=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8,18}$/.test(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=250;
function dto(raw,id,code,sourceAsOf){
 if(raw.productId!==id||raw.stockCode!==code||!['cardAmountExact','referenceExact','discountExact'].every(k=>exact(raw[k]))||!['TRY','USD','EUR',null].includes(raw.currency)||!(raw.unitLabel===null||text(raw.unitLabel))||!['UNKNOWN','GROSS','NET'].includes(raw.priceBasis)||!['PROTECTED_MANUAL_PURCHASE','REFERENCE_AVAILABLE','CARD_AMOUNT_ONLY','PARTIAL_CARD_AMOUNT','PURCHASE_UNKNOWN'].includes(raw.status)||!['SOURCE_CARD_AMOUNT','SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT','GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE','PRESERVE_MANUAL_PURCHASE'].includes(raw.method)||raw.sourceAsOf!==sourceAsOf||!Array.isArray(raw.reasons)||raw.reasons.some(r=>typeof r!=='string'||!/^[A-Z0-9_]{1,100}$/.test(r))||typeof raw.protectedExistingCost!=='boolean'||typeof raw.protectedManual!=='boolean'||raw.accountingCost!==false||raw.financialWrites!==0)throw fail();
 if(raw.referenceExact!==null&&(raw.currency===null||raw.unitLabel===null||raw.priceBasis==='UNKNOWN')||raw.status==='REFERENCE_AVAILABLE'&&raw.referenceExact===null||raw.priceBasis==='NET'&&raw.referenceExact!==null&&raw.referenceExact!==raw.cardAmountExact||raw.protectedManual&&(raw.cardAmountExact!==null||raw.referenceExact!==null))throw fail();
 if(raw.referenceExact!==null&&raw.priceBasis==='NET'&&raw.method!=='SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT'||raw.referenceExact!==null&&raw.priceBasis==='GROSS'&&raw.method!=='GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE')throw fail();
 if(raw.referenceExact!==null&&raw.priceBasis==='GROSS'){if(raw.cardAmountExact===null||raw.discountExact===null||raw.cardAmountExact.split('.')[1].length!==8||raw.discountExact.split('.')[1].length!==8||raw.referenceExact.split('.')[1].length!==18||BigInt(raw.referenceExact.replace('.',''))!==BigInt(raw.cardAmountExact.replace('.',''))*(10000000000n-BigInt(raw.discountExact.replace('.',''))))throw fail();}
 if(raw.discountExact!==null&&BigInt(raw.discountExact.replace('.',''))>100n*10n**BigInt(raw.discountExact.split('.')[1].length))throw fail();
 return Object.fromEntries(['productId','stockCode','cardAmountExact','referenceExact','discountExact','currency','unitLabel','status','priceBasis','sourceAsOf','method','reasons','protectedExistingCost','protectedManual','accountingCost'].map(k=>[k,raw[k]]));
}
async function defaultRuntime(){
 const db=await import('../config/database.js');if(!db.isCanonicalTest())throw fail();
 const manifestHash=process.env.MELISA_PRODUCT_PURCHASE_REFERENCE_MANIFEST_HASH;if(!HEX.test(manifestHash??''))throw fail();
 const {PURCHASE_REFERENCE_SQL_PROOF:proof}=await import('../../../../scripts/migration/product-purchase-reference-sql.mjs');
 return {canonicalTest:true,pool:await db.getSqlPool(),sql:db.getSqlDriver(),manifestHash,proof};
}
export function createProductPurchaseReferenceService({getRuntime=defaultRuntime}={}){
 return {async read(id,query={},actor){
  productId(id);if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length)throw fail('PURCHASE_REFERENCE_INPUT',400,'Bu okuma ek filtre kabul etmiyor.');
  if(!actor)throw fail('AUTH_TOKEN_REQUIRED',401,'Oturum gerekli.');if(!Array.isArray(actor.permissions)||!['product.view','purchase.view','finance.view'].every(p=>actor.permissions.includes(p)))throw fail('AUTH_PERMISSION_DENIED',403,'Bu bilgi için yetkiniz bulunmuyor.');
  let tx;try{
   const r=await getRuntime();if(r.canonicalTest!==true||!HEX.test(r.manifestHash??'')||!r.proof||Object.keys(r.proof.moduleHashes??{}).length!==5||!moduleNames.every(n=>HEX.test(r.proof.moduleHashes[n]??'')))throw fail();
   const q=r.sql;tx=new q.Transaction(r.pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
   const identity=(await req().query("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live")).recordset?.[0];
   if(identity?.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity.serverName!=='Semih\\MELISADEV'||identity.login!=='melisa_sirket_sales_test_20260929_01'||identity.databaseUser!==identity.login||identity.sysadmin!==0||identity.control!==0||identity.live!==0)throw fail();
   const observed=(await req().query(`SELECT s.name+N'.'+o.name object_name,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)) definition_hash FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE s.name+N'.'+o.name IN(${moduleNames.map(n=>"N'"+n+"'").join(',')})`)).recordset;
   if(!Array.isArray(observed)||observed.length!==5||new Set(observed.map(x=>x.object_name)).size!==5||observed.some(x=>r.proof.moduleHashes[x.object_name]!==x.definition_hash))throw fail();
   const response=await req().input('product_id',q.BigInt,id).execute('dbo.usp_get_product_purchase_reference'),headers=response.recordsets?.[0],rows=response.recordsets?.[1];
   if(headers?.length!==1||!Array.isArray(rows)||rows.length>1)throw fail();const h=headers[0];
   if(h.databaseName!==identity.databaseName||h.serverName!==identity.serverName||h.readerDefinitionHash!==r.proof.readerDefinitionHash||h.manifestHash!==r.manifestHash||h.runStatus!=='COMMITTED'||!HEX.test(h.sourceHash??'')||typeof h.sourceAsOf!=='string'||!Number.isFinite(Date.parse(h.sourceAsOf))||typeof h.runId!=='string'||!h.runId||!Number.isSafeInteger(h.metadataRows)||h.metadataRows<1)throw fail();
   if(h.requestedProductId===null)throw fail('PURCHASE_REFERENCE_NOT_FOUND',404,'Ürün bulunamadı.');if(h.requestedProductId!==id||!text(h.stockCode))throw fail();
   let data;if(rows.length===0)data={productId:id,stockCode:h.stockCode,cardAmountExact:null,referenceExact:null,discountExact:null,currency:null,unitLabel:null,status:'PURCHASE_UNKNOWN',priceBasis:'UNKNOWN',sourceAsOf:h.sourceAsOf,method:'METADATA_NOT_AVAILABLE',reasons:['METADATA_NOT_AVAILABLE'],accountingCost:false};
   else {const row=rows[0];if(typeof row.rowJson!=='string'||purchaseReferenceSqlHash(row.rowJson)!==row.rowHash)throw fail();data=dto(JSON.parse(row.rowJson),id,h.stockCode,h.sourceAsOf);}
   await tx.commit();return {data,meta:{readOnly:true,financialEffect:false}};
  }catch(e){if(tx)try{await tx.rollback();}catch{}if([400,401,403,404].includes(e?.statusCode))throw e;throw fail();}
 }};
}
export const productPurchaseReferenceService=createProductPurchaseReferenceService();
