import {catalogError} from './catalogModel.mjs';
const ids=['36961','39169','40331','301991'];
export const BUSINESS_CATALOG_PRICE_EXCLUSIONS=Object.freeze(ids.map(productId=>Object.freeze({productId,reason:productId==='301991'?'DUPLICATE_SOURCE_SALE_PRICE':'ZERO_SOURCE_SALE_PRICE',draftEligible:false})));
export const isBusinessCatalogPriceScope=(copy,version)=>copy?.scopeKind==='VERIFIED_BUSINESS_TEST'&&copy.target?.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&copy.currentProductSourceVersionRunId===version?.runId;
const rowHash=(alias,fields)=>`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${fields.map(f=>`${alias}.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
const productFields=['product_id','product_source_key','source_id','native_source_key','stock_code','product_name','currency_code','unit','main_unit_source_id','stage_payload_hash','stage_sql_hash'];
const priceFields=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
// The four exceptions are re-proved in the same serializable read transaction.
// Missing bindings, changed source/native hashes or any newly usable quote fail closed.
export const BUSINESS_CATALOG_PRICE_EXCLUSION_SQL=`SELECT run_id runId,source_hash sourceHash,plan_hash planHash,bindings_hash bindingsHash,source_as_of sourceAsOf,product_count productCount,price_count priceCount,sealed FROM erp_migration.goal7_source_version_manifest WHERE run_id=@exclusion_run;
SELECT CONVERT(varchar(20),b.product_id) productId,CONVERT(varchar(20),v.price_id) quoteId,CONVERT(varchar(60),v.price_exact) priceExact,
 (SELECT COUNT_BIG(*) FROM dbo.product_prices z WHERE z.product_id=v.product_id AND z.price_type=v.price_type AND z.price_tier=v.price_tier AND z.currency_code=v.currency_code AND NOT EXISTS(SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id)) nativeTupleCount,
 CONVERT(bit,CASE WHEN p.id IS NOT NULL AND n.id IS NOT NULL AND p.is_active=1 AND p.is_deleted=0 AND v.source_unit_id=b.main_unit_source_id
 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(h.native_id=p.id OR CONVERT(varbinary(max),h.native_source_key)=CONVERT(varbinary(max),p.source_record_key) OR h.source_id=b.source_id))
 AND pr.payload_hash=b.stage_payload_hash AND CONVERT(char(64),HASHBYTES('SHA2_256',pr.payload_json),2)=b.stage_sql_hash AND ${rowHash('b',productFields)}=b.binding_hash
 AND r.payload_hash=v.stage_payload_hash AND CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)=v.stage_sql_hash AND ${rowHash('v',priceFields)}=v.binding_hash
 AND CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)=v.native_row_hash
 AND NOT EXISTS(SELECT CONVERT(varbinary(max),p.stock_code),CONVERT(varbinary(max),p.name),CONVERT(varbinary(max),p.source_record_key),CONVERT(varbinary(max),p.unit),CONVERT(varbinary(max),p.currency_code) EXCEPT SELECT CONVERT(varbinary(max),b.stock_code),CONVERT(varbinary(max),b.product_name),CONVERT(varbinary(max),b.native_source_key),CONVERT(varbinary(max),b.unit),CONVERT(varbinary(max),b.currency_code))
 AND NOT EXISTS(SELECT n.product_id,CONVERT(varbinary(max),CONVERT(nvarchar(max),n.price_type)),n.price_tier,CONVERT(varbinary(max),CONVERT(nvarchar(max),n.currency_code)),n.source_unit_id,n.price EXCEPT SELECT v.product_id,CONVERT(varbinary(max),CONVERT(nvarchar(max),v.price_type)),v.price_tier,CONVERT(varbinary(max),CONVERT(nvarchar(max),v.currency_code)),v.source_unit_id,v.price_exact) THEN 1 ELSE 0 END) sourceWitnessVerified
 FROM erp_migration.goal7_source_version_products b LEFT JOIN dbo.products p ON p.id=b.product_id
 JOIN erp_migration.goal7_source_version_prices v ON v.version_run_id=b.version_run_id AND v.product_id=b.product_id AND v.price_type=N'sale' AND v.is_main_unit=1
 LEFT JOIN dbo.product_prices n ON n.id=v.price_id
 LEFT JOIN erp_migration.goal7_source_version_records pr ON pr.run_id=b.lineage_run_id AND pr.entity=N'products' AND pr.source_key=b.lineage_source_key
 LEFT JOIN erp_migration.goal7_source_version_records r ON r.run_id=v.lineage_run_id AND r.entity=N'prices' AND r.source_key=v.lineage_source_key
 WHERE b.version_run_id=@exclusion_run AND b.product_id IN(36961,39169,40331,301991);
SELECT COUNT_BIG(*) sourceActiveCatalog FROM (SELECT p.id FROM erp_migration.goal7_source_version_products b JOIN dbo.products p ON p.id=b.product_id WHERE b.version_run_id=@exclusion_run AND p.is_active=1 AND p.is_deleted=0 UNION SELECT p.id FROM erp_migration.operation_quarantine_holds h JOIN dbo.products p ON p.id=h.native_id WHERE h.entity=N'product' AND p.is_active=1 AND p.is_deleted=0) source;`;
export function validateBusinessCatalogPriceExclusions(recordsets,version){
 const fail=()=>{throw catalogError();};
 const [manifests,quotes,counts]=recordsets??[],m=manifests?.[0];
 const active=typeof counts?.[0]?.sourceActiveCatalog==='string'&&/^[1-9]\d*$/.test(counts[0].sourceActiveCatalog)?Number(counts[0].sourceActiveCatalog):counts?.[0]?.sourceActiveCatalog;
 if(manifests?.length!==1||m.sealed!==true||['runId','sourceHash','planHash','bindingsHash','sourceAsOf','productCount','priceCount'].some(k=>m[k]!==version[k])||!Array.isArray(quotes)||counts?.length!==1||!Number.isSafeInteger(active)||active<4)fail();
 const seen=new Set();let duplicate=0;
 for(const q of quotes){if(!ids.includes(q.productId)||seen.has(q.quoteId)||q.sourceWitnessVerified!==true||typeof q.priceExact!=='string'||!/^\d+\.\d{8}$/.test(q.priceExact))fail();seen.add(q.quoteId);
  if(q.productId==='301991'&&q.quoteId==='278235'){if(Number(q.nativeTupleCount)!==2||BigInt(q.priceExact.replace('.',''))<=0n)fail();duplicate++;}
  else if(Number(q.nativeTupleCount)!==1||q.priceExact!=='0.00000000')fail();
 }
 if(duplicate!==1||quotes.length!==12||ids.some(id=>quotes.filter(q=>q.productId===id).length!==3))fail();
 return {excludedCount:4,excludedProducts:BUSINESS_CATALOG_PRICE_EXCLUSIONS.map(x=>({...x})),sourceActiveCatalog:active,availableActiveCatalog:active-4};
}
export function excludeBusinessCatalogPriceCandidates(candidatesJson){const rows=JSON.parse(candidatesJson);if(!Array.isArray(rows))throw catalogError();return JSON.stringify(rows.filter(([id])=>!ids.includes(id)));}
