import{headers,manifest,readHistory,decideHeader,key}from'./vega-native-migration-adapters.mjs';
import{decision}from'./vega-native-migration-context.mjs';
export async function exposeBusinessFields(store){const changed={};
 for(const table of ['sales_invoice_items','purchase_invoice_items','invoice_return_items','inventory_document_items','financial_document_items']){
  for(let i=1;i<=6;i++)await store.request().query(`IF COL_LENGTH(N'dbo.${table}',N'discount_rate_${i}') IS NULL ALTER TABLE dbo.${table} ADD discount_rate_${i} decimal(28,8) NULL;`);
  const set=[1,2,3,4,5,6].map(i=>`discount_rate_${i}=TRY_CONVERT(decimal(28,8),JSON_VALUE(discount_rates_json,'$[${i-1}]'))`).join(',');
  const result=await store.request().query(`UPDATE dbo.${table} SET ${set} WHERE source_record_key IS NOT NULL;SELECT @@ROWCOUNT n;`);changed[table]=result.recordset[0].n;
 }
 for(const table of ['sales_invoices','purchase_invoices','invoice_returns','inventory_documents','financial_documents']){
  for(let i=1;i<=4;i++)await store.request().query(`IF COL_LENGTH(N'dbo.${table}',N'source_header_discount_${i}') IS NULL ALTER TABLE dbo.${table} ADD source_header_discount_${i} decimal(28,8) NULL;`);
  await store.request().query(`UPDATE dbo.${table} SET ${[1,2,3,4].map(i=>`source_header_discount_${i}=TRY_CONVERT(decimal(28,8),JSON_VALUE(source_payload_json,'$.ALT${i}'))`).join(',')} WHERE source_record_key IS NOT NULL;`);
 }
 for(const table of ['customers','suppliers'])for(const field of ['TELEFON1','TELEFON2','TELEFON3','ADRESPOSTA','ADRESFATURA','ADRESSEVK']){
  await store.request().query(`IF COL_LENGTH(N'dbo.${table}',N'${field}') IS NULL ALTER TABLE dbo.${table} ADD ${field} nvarchar(max) NULL;`);
  await store.request().query(`UPDATE p SET ${field}=s.value FROM dbo.${table} p OUTER APPLY OPENJSON(p.source_payload_json)WITH(value nvarchar(max) '$.${field}')s WHERE p.source_record_key IS NOT NULL;`);
 }
 await store.request().query("IF COL_LENGTH(N'dbo.migration_decisions',N'related_source_key') IS NULL ALTER TABLE dbo.migration_decisions ADD related_source_key nvarchar(250) NULL;");
 await store.request().query("UPDATE dbo.migration_decisions SET related_source_key=JSON_VALUE(details_json,'$.sourceKey') WHERE related_source_key IS NULL; ALTER TABLE dbo.sales_invoices ALTER COLUMN estimated_profit_try decimal(18,4) NULL; UPDATE dbo.sales_invoices SET estimated_profit_try=NULL WHERE source_record_key IS NOT NULL;");
 store.clearSchema();
 const decisions=[];for(const h of headers().all)if(h.row.TARIH==null&&h.row.IPTAL!==true)decisions.push({...decision(h.key,'document','DOCUMENT_DATE_UNKNOWN'),related_source_key:h.key,source_payload_json:JSON.stringify(h.row)});await store.upsert('migration_decisions',decisions);
 return{lineDiscountFields:changed,headerDiscountFields:4,sourceContactFields:6,unknownDocumentDates:decisions.length,unknownHistoricalProfit:null};
}
