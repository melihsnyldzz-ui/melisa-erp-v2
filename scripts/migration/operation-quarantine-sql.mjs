import {RUN} from './target-opening-runtime.mjs';
import {EXPECTED,targetGuard} from './accepted-opening-prices.mjs';
import {requireRule} from './mapping-opening.mjs';
export const holdFields=['entity','source_key','source_id','source_company','source_code','source_name','native_id','native_entity_id','native_source_key','native_code','native_name','status','reasons_json','binding_basis'];
export const holdOpenJson='entity nvarchar(20),source_key nvarchar(250),source_id varchar(20),source_company nvarchar(10),source_code nvarchar(250),source_name nvarchar(500),native_id bigint,native_entity_id bigint,native_source_key nvarchar(250),native_code nvarchar(250),native_name nvarchar(500),status nvarchar(20),reasons_json nvarchar(max),binding_basis nvarchar(80)';
const holds='erp_migration.operation_quarantine_holds';
const held=(entity,value)=>`EXISTS(SELECT 1 FROM ${holds} h WHERE h.entity=N'${entity}' AND h.native_id=${value})`;
const heldEntity=value=>`EXISTS(SELECT 1 FROM ${holds} h WHERE h.native_entity_id=${value})`;
const sourceKey=value=>`EXISTS(SELECT 1 FROM ${holds} h WHERE CONVERT(varbinary(max),h.native_source_key)=CONVERT(varbinary(max),CONVERT(nvarchar(max),${value})))`;
const shared=x=>`${heldEntity(x+'.party_entity_id')} OR EXISTS(SELECT 1 FROM dbo.party_currency_accounts qa WHERE qa.id=${x}.party_currency_account_id AND (${held('customer','qa.customer_id')} OR ${held('supplier','qa.supplier_id')} OR ${heldEntity('qa.party_entity_id')}))`;
const sale=value=>`EXISTS(SELECT 1 FROM dbo.sales_invoices qs WHERE qs.id=${value} AND (${held('customer','qs.customer_id')} OR ${shared('qs')} OR EXISTS(SELECT 1 FROM dbo.sales_invoice_items qi WHERE qi.sales_invoice_id=qs.id AND ${held('product','qi.product_id')})))`;
const purchase=value=>`EXISTS(SELECT 1 FROM dbo.purchase_invoices qp WHERE qp.id=${value} AND (${held('supplier','qp.supplier_id')} OR ${shared('qp')} OR EXISTS(SELECT 1 FROM dbo.purchase_invoice_items qi WHERE qi.purchase_invoice_id=qp.id AND ${held('product','qi.product_id')})))`;
const returns=value=>`EXISTS(SELECT 1 FROM dbo.invoice_returns qr WHERE qr.id=${value} AND (${held('customer','qr.customer_id')} OR ${held('supplier','qr.supplier_id')} OR ${shared('qr')} OR ${sale('qr.source_sales_invoice_id')} OR ${purchase('qr.source_purchase_invoice_id')} OR EXISTS(SELECT 1 FROM dbo.invoice_return_items qi WHERE qi.invoice_return_id=qr.id AND ${held('product','qi.product_id')})))`;
const customerMovement=value=>`EXISTS(SELECT 1 FROM dbo.customer_movements qc WHERE qc.id=${value} AND (${held('customer','qc.customer_id')} OR ${shared('qc')} OR ${sale('qc.sales_invoice_id')} OR ${returns('qc.invoice_return_id')}))`;
const supplierMovement=value=>`EXISTS(SELECT 1 FROM dbo.supplier_movements qv WHERE qv.id=${value} AND (${held('supplier','qv.supplier_id')} OR ${shared('qv')} OR ${purchase('qv.purchase_invoice_id')} OR ${returns('qv.invoice_return_id')}))`;
const flow=value=>`EXISTS(SELECT 1 FROM dbo.test_daily_scope qf WHERE qf.flow=${value} AND (${held('product','qf.product_id')} OR ${held('customer','qf.customer_id')} OR ${held('supplier','qf.supplier_id')}))`;
const goods=value=>`EXISTS(SELECT 1 FROM dbo.test_goods_receipts qg WHERE qg.id=${value} AND (${held('product','qg.product_id')} OR ${held('supplier','qg.supplier_id')}))`;
export const predicates={
  products:x=>`${held('product',x+'.id')} OR ${sourceKey(x+'.source_record_key')}`,
  customers:x=>`${held('customer',x+'.id')} OR ${sourceKey(x+'.source_record_key')} OR ${heldEntity(x+'.party_entity_id')}`,
  suppliers:x=>`${held('supplier',x+'.id')} OR ${sourceKey(x+'.source_record_key')} OR ${heldEntity(x+'.party_entity_id')}`,
  product_barcodes:x=>held('product',x+'.product_id'),
  product_prices:x=>held('product',x+'.product_id'),
  product_source_aliases:x=>`${held('product',x+'.product_id')} OR EXISTS(SELECT 1 FROM ${holds} h WHERE h.entity=N'product' AND CONVERT(int,h.source_id)=${x}.source_product_id) OR ${sourceKey(x+'.source_record_key')}`,
  party_source_links:x=>`${held('customer',x+'.customer_id')} OR ${held('supplier',x+'.supplier_id')} OR ${heldEntity(x+'.party_entity_id')} OR EXISTS(SELECT 1 FROM ${holds} h WHERE h.entity IN(N'customer',N'supplier') AND CONVERT(varbinary(max),h.source_company)=CONVERT(varbinary(max),${x}.source_company) AND CONVERT(int,h.source_id)=${x}.source_id) OR ${sourceKey(x+'.source_record_key')}`,
  party_entities:x=>`${heldEntity(x+'.id')} OR ${sourceKey(x+'.source_record_key')}`,
  party_currency_accounts:x=>`${held('customer',x+'.customer_id')} OR ${held('supplier',x+'.supplier_id')} OR ${heldEntity(x+'.party_entity_id')} OR ${sourceKey(x+'.source_record_key')}`,
  sales_invoices:x=>`${held('customer',x+'.customer_id')} OR ${shared(x)} OR EXISTS(SELECT 1 FROM dbo.sales_invoice_items qi WHERE qi.sales_invoice_id=${x}.id AND ${held('product','qi.product_id')})`,
  purchase_invoices:x=>`${held('supplier',x+'.supplier_id')} OR ${shared(x)} OR EXISTS(SELECT 1 FROM dbo.purchase_invoice_items qi WHERE qi.purchase_invoice_id=${x}.id AND ${held('product','qi.product_id')})`,
  sales_invoice_items:x=>`${held('product',x+'.product_id')} OR ${sale(x+'.sales_invoice_id')}`,
  purchase_invoice_items:x=>`${held('product',x+'.product_id')} OR ${purchase(x+'.purchase_invoice_id')}`,
  invoice_returns:x=>`${held('customer',x+'.customer_id')} OR ${held('supplier',x+'.supplier_id')} OR ${shared(x)} OR ${sale(x+'.source_sales_invoice_id')} OR ${purchase(x+'.source_purchase_invoice_id')} OR EXISTS(SELECT 1 FROM dbo.invoice_return_items qi WHERE qi.invoice_return_id=${x}.id AND ${held('product','qi.product_id')})`,
  invoice_return_items:x=>`${held('product',x+'.product_id')} OR ${returns(x+'.invoice_return_id')} OR EXISTS(SELECT 1 FROM dbo.sales_invoice_items qi WHERE qi.id=${x}.source_sales_item_id AND (${held('product','qi.product_id')} OR ${sale('qi.sales_invoice_id')})) OR EXISTS(SELECT 1 FROM dbo.purchase_invoice_items qi WHERE qi.id=${x}.source_purchase_item_id AND (${held('product','qi.product_id')} OR ${purchase('qi.purchase_invoice_id')}))`,
  stock_movements:x=>`${held('product',x+'.product_id')} OR ${held('customer',x+'.customer_id')} OR ${held('supplier',x+'.supplier_id')} OR (${x}.source_type=N'sales_invoice' AND ${sale(x+'.source_id')}) OR (${x}.source_type=N'purchase_invoice' AND ${purchase(x+'.source_id')}) OR (${x}.source_type IN(N'invoice_return',N'invoice_return_cancel') AND ${returns(x+'.source_id')}) OR (${x}.source_type=N'goods_receipt' AND ${goods(x+'.source_id')})`,
  customer_movements:x=>`${held('customer',x+'.customer_id')} OR ${shared(x)} OR ${sale(x+'.sales_invoice_id')} OR ${returns(x+'.invoice_return_id')}`,
  supplier_movements:x=>`${held('supplier',x+'.supplier_id')} OR ${shared(x)} OR ${purchase(x+'.purchase_invoice_id')} OR ${returns(x+'.invoice_return_id')}`,
  finance_account_movements:x=>`${shared(x)} OR (${x}.party_type=N'customer' AND ${customerMovement(x+'.party_movement_id')}) OR (${x}.party_type=N'supplier' AND ${supplierMovement(x+'.party_movement_id')})`,
  test_daily_scope:x=>`${held('product',x+'.product_id')} OR ${held('customer',x+'.customer_id')} OR ${held('supplier',x+'.supplier_id')}`,
  test_daily_drafts:x=>flow(x+'.flow'),test_daily_requests:x=>flow(x+'.flow'),
  test_stock_reversals:x=>`${held('product',x+'.product_id')} OR ${goods(x+'.goods_id')} OR ${flow(x+'.flow')}`,
  test_goods_receipts:x=>`${held('product',x+'.product_id')} OR ${held('supplier',x+'.supplier_id')}`,
  test_purchase_scope:x=>`${held('product',x+'.product_id')} OR ${held('supplier',x+'.supplier_id')}`,
  test_purchase_links:x=>`${purchase(x+'.invoice_id')} OR ${goods(x+'.goods_id')}`,
  test_sales_scope:x=>`${held('product',x+'.product_id')} OR ${held('customer',x+'.customer_id')}`,
  test_sales_requests:x=>sale(x+'.invoice_id'),
  test_payment_suppliers:x=>held('supplier',x+'.supplier_id'),test_payment_invoices:x=>purchase(x+'.invoice_id'),
  test_payment_requests:x=>`${supplierMovement(x+'.movement_id')} OR ${supplierMovement(x+'.original_id')}`,
  test_refund_scope:x=>held('supplier',x+'.supplier_id'),test_refund_requests:x=>`${supplierMovement(x+'.movement_id')} OR ${supplierMovement(x+'.source_payment_id')} OR ${supplierMovement(x+'.original_id')}`,
  test_finance_requests:x=>`${customerMovement(x+'.customer_movement_id')} OR ${customerMovement(x+'.original_movement_id')}`,
  test_crm_order_product_scope:x=>held('product',x+'.product_id'),
  test_crm_order_requests:x=>`${held('customer',x+'.customer_id')} OR ${sale(x+'.order_id')}`,
  test_crm_order_request_lines:x=>`EXISTS(SELECT 1 FROM dbo.test_crm_order_product_scope qi WHERE qi.source_id=${x}.source_id AND ${held('product','qi.product_id')}) OR EXISTS(SELECT 1 FROM dbo.test_crm_order_requests qr WHERE qr.request_id=${x}.request_id AND (${held('customer','qr.customer_id')} OR ${sale('qr.order_id')}))`,
};
export const guardTables=Object.keys(predicates);
export const rowHash=alias=>`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${holdFields.map(f=>alias+'.'+f).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
export const aggregateSeal=table=>`LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.source_key,h.row_hash FROM ${table} h ORDER BY h.source_key FOR JSON PATH)),2))`;
function ready(seal){requireRule(/^[a-f0-9]{64}$/.test(seal),'QUARANTINE_SEAL_REQUIRED');return `${targetGuard}
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N'${RUN}' AND source_hash='${EXPECTED.sourceHash}' AND plan_hash='${EXPECTED.planHash}' AND seal_hash='${seal}' AND source_as_of='2026-09-30' AND source_rows=176 AND native_holds=172 AND not_present=4 AND sealed=1) THROW 51076,'MIGRATION_QUARANTINE_NOT_READY',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.runs WHERE run_id=N'${RUN}' AND status COLLATE Latin1_General_100_BIN2=N'COMMITTED' AND source_hash='${EXPECTED.sourceHash}' AND plan_hash='${EXPECTED.planHash}') THROW 51076,'MIGRATION_QUARANTINE_NOT_READY',1;
IF (SELECT COUNT(*) FROM ${holds})<>176 OR (SELECT COUNT(*) FROM ${holds} WHERE native_id IS NOT NULL)<>172 OR (SELECT COUNT(*) FROM ${holds} WHERE native_id IS NULL)<>4 OR EXISTS(SELECT 1 FROM ${holds} h WHERE ${rowHash('h')}<>h.row_hash) THROW 51076,'MIGRATION_QUARANTINE_BINDING_DRIFT',1;
IF ${aggregateSeal(holds)}<>'${seal}' THROW 51076,'MIGRATION_QUARANTINE_BINDING_DRIFT',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name IN(N'immutable_operation_quarantine_manifest',N'immutable_operation_quarantine_holds') AND is_disabled=0)<>2 THROW 51076,'MIGRATION_QUARANTINE_NOT_READY',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name IN(${guardTables.map(t=>"N'operation_quarantine_"+t+"'").join(',')}) AND is_disabled=0)<>${guardTables.length} THROW 51076,'MIGRATION_QUARANTINE_NOT_READY',1;`;
}
export function guardSql(table,seal){requireRule(Object.hasOwn(predicates,table),'QUARANTINE_GUARD_TABLE_REQUIRED');return `CREATE TRIGGER dbo.operation_quarantine_${table} ON dbo.${table} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;IF NOT EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted) RETURN;${ready(seal)} IF EXISTS(SELECT 1 FROM(SELECT * FROM inserted UNION ALL SELECT * FROM deleted)x WHERE ${predicates[table]('x')}) THROW 51076,'MIGRATION_OPERATION_QUARANTINED',1;END`;}
const meta=`SELECT DB_NAME() database_name,m.run_id,r.status run_status,m.source_hash,m.plan_hash,m.source_as_of,m.sealed,CONVERT(bit,1) operation_gate,m.seal_hash`;
export function readerSql(kind,seal){
  if(kind==='check')return `CREATE PROCEDURE dbo.usp_check_operation_quarantine @entities_json nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${ready(seal)} IF ISJSON(@entities_json)<>1 OR LEFT(LTRIM(@entities_json),1)<>N'[' THROW 51076,'MIGRATION_QUARANTINE_CHECK_INVALID',1;
CREATE TABLE #requested(entity nvarchar(20),native_id bigint,PRIMARY KEY(entity,native_id));IF (SELECT COUNT(*) FROM OPENJSON(@entities_json))>200 OR EXISTS(SELECT 1 FROM OPENJSON(@entities_json) j WHERE j.type<>5 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N'nativeId' AND k.type=1 AND LEN(k.value) BETWEEN 1 AND 19 AND k.value NOT LIKE '%[^0-9]%' AND TRY_CONVERT(bigint,k.value)>0) OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N'entity' AND k.type=1 AND k.value COLLATE Latin1_General_100_BIN2 IN(N'product',N'customer',N'supplier'))) THROW 51076,'MIGRATION_QUARANTINE_CHECK_INVALID',1;
INSERT #requested SELECT entity,TRY_CONVERT(bigint,nativeId) FROM OPENJSON(@entities_json) WITH(entity nvarchar(20),nativeId varchar(20));
${meta} FROM erp_migration.operation_quarantine_manifest m JOIN erp_migration.runs r ON r.run_id=m.run_id;
SELECT q.entity,CONVERT(varchar(20),q.native_id) native_id,CONVERT(bit,CASE WHEN h.native_id IS NULL THEN 0 ELSE 1 END) blocked,h.source_key,JSON_VALUE(h.reasons_json,'$[0]') reason_code FROM #requested q LEFT JOIN ${holds} h ON h.entity=q.entity AND h.native_id=q.native_id ORDER BY q.entity,q.native_id;END`;
  requireRule(kind==='list','QUARANTINE_READER_KIND_REQUIRED');return `CREATE PROCEDURE dbo.usp_list_operation_quarantine @entity nvarchar(20),@search nvarchar(120)=N'',@page int=1,@page_size int=50 WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${ready(seal)} IF @entity IS NULL OR @entity COLLATE Latin1_General_100_BIN2 NOT IN(N'product',N'customer',N'supplier') OR @page IS NULL OR @page<1 OR @page>100000 OR @page_size IS NULL OR @page_size<1 OR @page_size>100 THROW 51076,'MIGRATION_QUARANTINE_CHECK_INVALID',1;
CREATE TABLE #matches(source_key nvarchar(250) PRIMARY KEY);INSERT #matches SELECT source_key FROM ${holds} WHERE entity=@entity AND(COALESCE(@search,N'')=N'' OR CHARINDEX(@search,source_code)>0 OR CHARINDEX(@search,source_name)>0 OR CHARINDEX(@search,native_code)>0 OR CHARINDEX(@search,native_name)>0);
${meta},(SELECT COUNT_BIG(*) FROM #matches) total,@page page,@page_size page_size,(SELECT COUNT(*) FROM ${holds} WHERE entity=@entity AND native_id IS NOT NULL) native_held,(SELECT COUNT(*) FROM ${holds} WHERE entity=@entity AND native_id IS NULL) not_present FROM erp_migration.operation_quarantine_manifest m JOIN erp_migration.runs r ON r.run_id=m.run_id;
SELECT h.entity,h.source_key,CONVERT(varchar(20),h.native_id) native_id,h.source_code,h.source_name,h.native_code,h.native_name,h.status,h.reasons_json FROM ${holds} h JOIN #matches x ON x.source_key=h.source_key ORDER BY h.source_code,h.source_key OFFSET CONVERT(bigint,@page-1)*@page_size ROWS FETCH NEXT @page_size ROWS ONLY;END`;
}
