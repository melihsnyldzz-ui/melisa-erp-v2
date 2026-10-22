// A transaction adapter for the existing invoiceDraftService, not a sale engine.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';
import {CLEAN_LOGIN} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {CLEAN_ORDER_RECEIPT_PROOF_SQL} from '../../apps/api/src/services/cleanOrderSaleModel.mjs';
import {buildCrmV2Procedures} from './crm-order-v2-sql.mjs';
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
const intent=`SELECT * FROM dbo.clean_order_sale_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()`;
const ready=`${CLEAN_TARGET_SQL}
IF (SELECT COUNT(*) FROM dbo.clean_order_sale_definitions)<>12 OR EXISTS(SELECT 1 FROM dbo.clean_order_sale_definitions d WHERE d.definition_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2) OR OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name)) IS NULL OR (OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'IsTrigger')=1 AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'ExecIsTriggerDisabled')<>0)) THROW 51950,'CLEAN_SALE_NOT_READY',1;`;
const deny="THROW 51951,'CLEAN_SALE_WRITE_DENIED',1;";
export function buildCleanOrderSaleProcedures(){
 const objects={};
 objects.usp_clean_order_sale_begin=`CREATE PROCEDURE dbo.usp_clean_order_sale_begin @order_id bigint,@actor_id bigint,@operation nvarchar(10),@request_id uniqueidentifier,@payload_hash char(64) WITH EXECUTE AS OWNER AS
 SET NOCOUNT ON;SET XACT_ABORT ON;${ready}
 IF @@TRANCOUNT=0 OR @operation NOT IN(N'convert',N'finalize') OR EXISTS(${intent}) ${deny}
 IF NOT EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND ((@operation=N'convert' AND u.id IN(15,17) AND p.permission_key=N'sales.create' AND p.can_create=1) OR (@operation=N'finalize' AND u.id=17 AND p.permission_key=N'sales.finalize' AND p.can_approve=1))) ${deny}
 DECLARE @lock int,@resource nvarchar(255)=N'CLEAN_ORDER_SALE/'+CONVERT(nvarchar(20),@order_id);
 EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;
 IF @lock<0 THROW 51952,'CLEAN_SALE_BUSY',1;
 ${CLEAN_ORDER_RECEIPT_PROOF_SQL.replaceAll('@orderId','@order_id')}
 IF NOT EXISTS(SELECT 1 FROM dbo.crm_order_v2_requests r JOIN dbo.sales_orders o WITH(UPDLOCK,HOLDLOCK) ON o.id=r.order_id JOIN dbo.customers c WITH(UPDLOCK,HOLDLOCK) ON c.id=o.customer_id WHERE o.id=@order_id AND o.status=N'draft' AND o.document_currency=N'TRY' AND o.customer_currency=N'TRY' AND o.exchange_rate_snapshot=1 AND o.grand_total>0 AND o.grand_total<=500 AND o.discount_rate=0 AND c.customer_code=N'ORNEK-M01' AND c.currency_code=N'TRY' AND c.is_active=1 AND c.is_deleted=0 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'customer' AND h.native_id=c.id)) THROW 51953,'CLEAN_SALE_SOURCE_CHANGED',1;
 IF EXISTS(SELECT 1 FROM dbo.sales_order_items l JOIN dbo.products p WITH(UPDLOCK,HOLDLOCK) ON p.id=l.product_id LEFT JOIN dbo.crm_order_v2_requests r ON r.order_id=l.sales_order_id OUTER APPLY(SELECT TOP(1) j.value FROM OPENJSON(r.body_json,'$.items') j WHERE TRY_CONVERT(bigint,JSON_VALUE(j.value,'$.productId'))=l.product_id) body LEFT JOIN dbo.product_prices v WITH(HOLDLOCK) ON v.id=TRY_CONVERT(bigint,JSON_VALUE(body.value,'$.priceId')) AND v.product_id=p.id WHERE l.sales_order_id=@order_id AND (p.id NOT IN(1,2,3) OR p.is_active<>1 OR p.is_deleted<>0 OR p.unit<>N'ADET' OR p.current_stock_qty IS NULL OR p.current_stock_qty<l.quantity OR l.quantity<1 OR l.quantity>5 OR l.quantity<>FLOOR(l.quantity) OR CONVERT(varbinary(max),p.stock_code)<>CONVERT(varbinary(max),l.stock_code_snapshot) OR CONVERT(varbinary(max),p.name)<>CONVERT(varbinary(max),l.product_name_snapshot) OR v.id IS NULL OR v.price<>TRY_CONVERT(decimal(28,8),JSON_VALUE(body.value,'$.priceExact8')) OR v.price<>l.unit_price OR v.currency_code<>N'TRY' OR l.currency_code<>N'TRY' OR v.price_type<>N'sale' OR v.price_tier<>1 OR v.source_unit_id<>1 OR v.is_main_unit<>1 OR v.source_record_key<>N'SYNTHETIC/20261022/products/'+CONVERT(nvarchar(20),p.id)+N'/PRICE/sale/1/1/TRY' OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=p.id))) THROW 51953,'CLEAN_SALE_SOURCE_CHANGED',1;
 IF EXISTS(SELECT 1 FROM dbo.sales_order_items l WHERE l.sales_order_id=@order_id AND ((SELECT COUNT(*) FROM dbo.product_barcodes b WITH(HOLDLOCK) WHERE b.product_id=l.product_id AND b.is_primary=1)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.product_barcodes b WITH(HOLDLOCK) WHERE b.product_id=l.product_id AND b.is_primary=1 AND CONVERT(varbinary(max),b.barcode)=CONVERT(varbinary(max),l.barcode_snapshot)))) THROW 51953,'CLEAN_SALE_SOURCE_CHANGED',1;
 IF @operation=N'convert' AND EXISTS(SELECT 1 FROM dbo.clean_order_sale_links WHERE order_id=@order_id) THROW 51954,'CLEAN_SALE_ALREADY_LINKED',1;
 IF @operation=N'finalize' AND NOT EXISTS(SELECT 1 FROM dbo.clean_order_sale_links l JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=l.invoice_id WHERE l.order_id=@order_id AND l.status=N'draft' AND i.status=N'draft') THROW 51954,'CLEAN_SALE_ALREADY_LINKED',1;
 INSERT dbo.clean_order_sale_intents(session_id,transaction_id,order_id,actor_id,operation,request_id,payload_hash,invoice_id,document_no,customer_id,total,balance_before,stock_before_json)
 SELECT @@SPID,CURRENT_TRANSACTION_ID(),o.id,@actor_id,@operation,@request_id,@payload_hash,l.invoice_id,N'CRS-20261022-'+CONVERT(nvarchar(20),o.id),o.customer_id,o.grand_total,c.balance,(SELECT i.product_id id,p.current_stock_qty qty,i.quantity quantity FROM dbo.sales_order_items i JOIN dbo.products p ON p.id=i.product_id WHERE i.sales_order_id=o.id ORDER BY i.id FOR JSON PATH) FROM dbo.sales_orders o JOIN dbo.customers c ON c.id=o.customer_id LEFT JOIN dbo.clean_order_sale_links l ON l.order_id=o.id WHERE o.id=@order_id;`;
 objects.usp_clean_order_sale_finish=`CREATE PROCEDURE dbo.usp_clean_order_sale_finish WITH EXECUTE AS OWNER AS SET NOCOUNT ON;SET XACT_ABORT ON;${ready}
 IF (SELECT COUNT(*) FROM dbo.clean_order_sale_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID())<>1 ${deny}
 DECLARE @order bigint,@invoice bigint,@operation nvarchar(10),@actor bigint,@total decimal(18,4),@customer bigint,@balance decimal(18,4),@stocks nvarchar(max),@request uniqueidentifier,@hash char(64);
 SELECT @order=order_id,@invoice=invoice_id,@operation=operation,@actor=actor_id,@total=total,@customer=customer_id,@balance=balance_before,@stocks=stock_before_json,@request=request_id,@hash=payload_hash FROM dbo.clean_order_sale_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();
 IF NOT EXISTS(SELECT 1 FROM dbo.sales_invoices WHERE id=@invoice AND customer_id=@customer AND document_currency=N'TRY' AND customer_currency=N'TRY' AND account_currency=N'TRY' AND account_amount=@total AND exchange_rate_snapshot=1 AND account_exchange_rate_snapshot=1 AND grand_total=@total AND amount_try=@total AND status=CASE WHEN @operation=N'convert' THEN N'draft' ELSE N'finalized' END) ${deny}
 IF (SELECT COUNT(*) FROM dbo.sales_invoice_items WHERE sales_invoice_id=@invoice)<>(SELECT COUNT(*) FROM dbo.sales_order_items WHERE sales_order_id=@order) OR EXISTS(SELECT 1 FROM dbo.sales_order_items o FULL JOIN (SELECT * FROM dbo.sales_invoice_items WHERE sales_invoice_id=@invoice)i ON i.product_id=o.product_id WHERE o.sales_order_id=@order AND (i.id IS NULL OR i.quantity<>o.quantity OR i.unit_price<>o.unit_price OR i.line_total<>o.line_total OR CONVERT(varbinary(max),i.stock_code_snapshot)<>CONVERT(varbinary(max),o.stock_code_snapshot))) ${deny}
 IF EXISTS(SELECT 1 FROM OPENJSON(@stocks) WITH(id bigint,qty decimal(18,3),quantity decimal(18,3)) b JOIN dbo.products p ON p.id=b.id WHERE p.current_stock_qty<>b.qty-CASE WHEN @operation=N'finalize' THEN b.quantity ELSE 0 END) OR NOT EXISTS(SELECT 1 FROM dbo.customers WHERE id=@customer AND balance=@balance+CASE WHEN @operation=N'finalize' THEN @total ELSE 0 END) ${deny}
 IF @operation=N'convert' BEGIN
 IF EXISTS(SELECT 1 FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=@invoice) OR EXISTS(SELECT 1 FROM dbo.customer_movements WHERE sales_invoice_id=@invoice) ${deny}
 INSERT dbo.clean_order_sale_links(order_id,invoice_id,status,created_by) VALUES(@order,@invoice,N'draft',@actor);
 END ELSE BEGIN
 IF (SELECT COUNT(*) FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=@invoice)<>(SELECT COUNT(*) FROM dbo.sales_order_items WHERE sales_order_id=@order) OR (SELECT COUNT(*) FROM dbo.customer_movements WHERE sales_invoice_id=@invoice AND movement_type=N'sales_invoice' AND balance_effect=@total AND account_currency=N'TRY' AND account_amount=@total)<>1 ${deny}
 UPDATE dbo.clean_order_sale_links SET status=N'finalized',approved_by=@actor,approved_at=SYSUTCDATETIME() WHERE order_id=@order AND invoice_id=@invoice AND status=N'draft';IF @@ROWCOUNT<>1 ${deny}
 END;
 INSERT dbo.clean_order_sale_requests(request_id,payload_hash,order_id,invoice_id,actor_id,operation) VALUES(@request,@hash,@order,@invoice,@actor,@operation);
 DELETE dbo.clean_order_sale_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();`;
 const trigger=(table,body)=>`CREATE TRIGGER dbo.clean_sale_${table}_guard ON dbo.${table} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;${CLEAN_TARGET_SQL} IF NOT EXISTS(${intent}) ${deny} ${body} END`;
 objects.clean_sale_sales_invoices_guard=trigger('sales_invoices',`
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) ${deny}
 IF EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s WHERE i.customer_id IS NULL OR i.customer_id<>s.customer_id OR i.document_no<>s.document_no OR i.document_currency<>N'TRY' OR i.customer_currency<>N'TRY' OR i.grand_total<>s.total OR i.subtotal<>s.total OR i.discount_total<>0 OR i.exchange_rate_snapshot<>1 OR i.amount_try<>s.total OR (s.invoice_id IS NOT NULL AND i.id<>s.invoice_id) OR (s.operation=N'convert' AND i.status<>N'draft') OR (s.operation=N'finalize' AND i.status<>N'finalized')) ${deny}
 UPDATE dbo.clean_order_sale_intents SET invoice_id=i.id FROM inserted i WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND operation=N'convert' AND invoice_id IS NULL;`);
 objects.clean_sale_sales_invoice_items_guard=trigger('sales_invoice_items',`
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) ${deny}
 IF EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s LEFT JOIN dbo.sales_order_items o ON o.sales_order_id=s.order_id AND o.product_id=i.product_id WHERE o.id IS NULL OR i.sales_invoice_id<>s.invoice_id OR i.quantity<>o.quantity OR i.currency_code<>o.currency_code OR i.unit_price<>o.unit_price OR i.line_total<>o.line_total OR CONVERT(varbinary(max),i.stock_code_snapshot)<>CONVERT(varbinary(max),o.stock_code_snapshot) OR CONVERT(varbinary(max),i.product_name_snapshot)<>CONVERT(varbinary(max),o.product_name_snapshot) OR ISNULL(i.barcode_snapshot,N'')<>ISNULL(o.barcode_snapshot,N'')) ${deny}`);
 objects.clean_sale_products_guard=trigger('products',`
 IF NOT EXISTS(SELECT 1 FROM deleted) OR (SELECT COUNT(*) FROM inserted)<>(SELECT COUNT(*) FROM deleted) ${deny}
 IF EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s OUTER APPLY(SELECT * FROM OPENJSON(s.stock_before_json) WITH(id bigint,qty decimal(18,3),quantity decimal(18,3)) WHERE id=i.id)b JOIN deleted d ON d.id=i.id WHERE s.operation<>N'finalize' OR b.id IS NULL OR i.current_stock_qty IS NULL OR d.current_stock_qty<>b.qty OR i.current_stock_qty<>b.qty-b.quantity) ${deny}`);
 objects.clean_sale_customers_guard=trigger('customers',`
 IF (SELECT COUNT(*) FROM inserted)<>1 OR (SELECT COUNT(*) FROM deleted)<>1 OR EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s JOIN deleted d ON d.id=i.id WHERE s.operation<>N'finalize' OR i.id<>s.customer_id OR d.balance<>s.balance_before OR i.balance<>s.balance_before+s.total OR i.currency_code<>N'TRY') ${deny}`);
 objects.clean_sale_stock_movements_guard=trigger('stock_movements',`
 IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s LEFT JOIN dbo.sales_order_items o ON o.sales_order_id=s.order_id AND o.product_id=i.product_id WHERE s.operation<>N'finalize' OR o.id IS NULL OR i.source_type<>N'sales_invoice' OR i.source_id IS NULL OR i.source_id<>s.invoice_id OR i.movement_type<>N'out' OR i.quantity_in<>0 OR i.quantity_out<>o.quantity OR i.quantity_net<>-o.quantity OR i.customer_id IS NULL OR i.customer_id<>s.customer_id OR i.created_by IS NULL OR i.created_by<>s.actor_id OR i.currency_code IS NULL OR i.currency_code<>N'TRY' OR i.unit_price IS NULL OR i.unit_price<>o.unit_price) ${deny}`);
 objects.clean_sale_customer_movements_guard=trigger('customer_movements',`
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) OR EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s WHERE s.operation<>N'finalize' OR i.customer_id<>s.customer_id OR i.sales_invoice_id IS NULL OR i.sales_invoice_id<>s.invoice_id OR i.movement_type<>N'sales_invoice' OR i.currency_code<>N'TRY' OR i.amount<>s.total OR i.balance_effect<>s.total OR i.created_by IS NULL OR i.created_by<>s.actor_id) ${deny}`);
 objects.clean_sale_audit_logs_guard=trigger('audit_logs',`
 IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s WHERE i.entity_type<>N'sales_invoice' OR i.entity_id IS NULL OR i.entity_id<>s.invoice_id OR i.actor_user_id IS NULL OR i.actor_user_id<>s.actor_id OR i.action NOT IN(N'sales_invoice_draft_created',N'sales_profit_snapshot_created',N'sales_invoice_finalized')) ${deny}`);
 objects.clean_sale_clean_order_sale_links_guard=trigger('clean_order_sale_links',`IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.order_id=d.order_id WHERE i.order_id IS NULL) OR EXISTS(SELECT 1 FROM inserted i CROSS JOIN (${intent}) s WHERE i.order_id<>s.order_id OR i.invoice_id<>s.invoice_id OR i.status<>CASE WHEN s.operation=N'convert' THEN N'draft' ELSE N'finalized' END) ${deny}`);
 objects.clean_sale_requests_immutable=`CREATE TRIGGER dbo.clean_sale_requests_immutable ON dbo.clean_order_sale_requests AFTER UPDATE,DELETE AS BEGIN ${deny} END`;
 objects.clean_sale_definitions_immutable=`CREATE TRIGGER dbo.clean_sale_definitions_immutable ON dbo.clean_order_sale_definitions AFTER UPDATE,DELETE AS BEGIN ${deny} END`;
 if(Object.keys(objects).length!==12)throw Error('Clean sale definition manifest mismatch');
 return objects;
}
function createTablePart(file){const text=fs.readFileSync(new URL(`../../infra/sql/migrations/${file}`,import.meta.url),'utf8');const body=text.slice(text.indexOf('GO')+2);return body.split(/\bGO\s*\r?\n/)[0];}
export function buildCleanOrderSaleInstallSql(passwordHash){
 if(typeof passwordHash!=='string'||!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash))throw Error('Approver password hash required');
 const definitions=buildCleanOrderSaleProcedures();
 const columns={products:[['purchase_discount_rate','decimal(9,4) NULL']],sales_invoices:[['account_currency','nvarchar(3) NULL'],['account_amount','decimal(18,4) NULL'],['account_exchange_rate_snapshot','decimal(18,8) NULL']],sales_invoice_items:[['gross_profit_try','decimal(18,4) NULL'],['gross_profit_rate','decimal(18,6) NULL']],stock_movements:[['unit_price','decimal(18,4) NULL'],['currency_code','nvarchar(3) NULL'],['amount_try','decimal(18,4) NULL']],customer_movements:[['account_currency','nvarchar(3) NULL'],['account_amount','decimal(18,4) NULL'],['account_exchange_rate_snapshot','decimal(18,8) NULL'],['document_exchange_rate_snapshot','decimal(18,8) NULL'],['amount_try','decimal(18,4) NULL']]};
 return `SET QUOTED_IDENTIFIER ON;SET ANSI_NULLS ON;SET XACT_ABORT ON;${CLEAN_TARGET_SQL}BEGIN TRANSACTION;
 IF OBJECT_ID(N'dbo.clean_order_sale_links') IS NOT NULL THROW 51950,'CLEAN_SALE_ALREADY_INSTALLED',1;
 ${createTablePart('0002_customer_movements.sql')}
 ${createTablePart('0010_system_settings.sql')}
 ${Object.entries(columns).flatMap(([t,cols])=>cols.map(([c,type])=>`IF COL_LENGTH(N'dbo.${t}',N'${c}') IS NULL ALTER TABLE dbo.${t} ADD ${c} ${type};`)).join('\n')}
 ALTER TABLE dbo.sales_invoice_items ALTER COLUMN average_cost_try_snapshot decimal(18,4) NULL;
 ALTER TABLE dbo.sales_invoices ALTER COLUMN estimated_profit_try decimal(18,4) NULL;
 ALTER TABLE dbo.stock_movements ALTER COLUMN unit_cost_try decimal(18,4) NULL;
 ALTER TABLE dbo.stock_movements ALTER COLUMN average_cost_try_after decimal(18,4) NULL;
 CREATE UNIQUE INDEX UX_clean_sale_stock_once ON dbo.stock_movements(source_id,product_id) WHERE source_type=N'sales_invoice';
 CREATE UNIQUE INDEX UX_clean_sale_customer_once ON dbo.customer_movements(sales_invoice_id) WHERE movement_type=N'sales_invoice';
 CREATE TABLE dbo.clean_order_sale_links(order_id bigint PRIMARY KEY REFERENCES dbo.sales_orders(id),invoice_id bigint NOT NULL UNIQUE REFERENCES dbo.sales_invoices(id),status nvarchar(10) NOT NULL CHECK(status IN(N'draft',N'finalized')),created_by bigint NOT NULL REFERENCES dbo.users(id),approved_by bigint NULL REFERENCES dbo.users(id),approved_at datetime2 NULL);
 CREATE TABLE dbo.clean_order_sale_requests(request_id uniqueidentifier PRIMARY KEY,payload_hash char(64) NOT NULL,order_id bigint NOT NULL REFERENCES dbo.sales_orders(id),invoice_id bigint NOT NULL REFERENCES dbo.sales_invoices(id),actor_id bigint NOT NULL REFERENCES dbo.users(id),operation nvarchar(10) NOT NULL CHECK(operation IN(N'convert',N'finalize')));
 CREATE TABLE dbo.clean_order_sale_intents(session_id int PRIMARY KEY,transaction_id bigint NOT NULL,order_id bigint NOT NULL,actor_id bigint NOT NULL,operation nvarchar(10) NOT NULL,request_id uniqueidentifier NOT NULL,payload_hash char(64) NOT NULL,invoice_id bigint NULL,document_no nvarchar(30) NOT NULL,customer_id bigint NOT NULL,total decimal(18,4) NOT NULL,balance_before decimal(18,4) NOT NULL,stock_before_json nvarchar(max) NOT NULL);
 CREATE TABLE dbo.clean_order_sale_definitions(name nvarchar(128) PRIMARY KEY,definition_hash char(64) NOT NULL);
 ${Object.entries(definitions).map(([name,sql])=>`EXEC(${quote(sql)});INSERT dbo.clean_order_sale_definitions VALUES(${quote(name)},'${createHash('sha256').update(sql,'utf16le').digest('hex').toUpperCase()}');`).join('\n')}
 SET IDENTITY_INSERT dbo.roles ON;INSERT dbo.roles(id,code,name) VALUES(22,N'clean_test_supervisor',N'Örnek satış sorumlusu');SET IDENTITY_INSERT dbo.roles OFF;
 INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_approve) VALUES(22,N'product.view',1,0,0,0),(22,N'customer.view',1,0,0,0),(22,N'sales.view',1,0,0,0),(22,N'sales.create',0,1,0,0),(22,N'sales.finalize',0,0,0,1);
 SET IDENTITY_INSERT dbo.users ON;INSERT dbo.users(id,username,password_hash,display_name,role_id) VALUES(17,N'ornek-sorumlu',${quote(passwordHash)},N'Örnek satış sorumlusu',22);SET IDENTITY_INSERT dbo.users OFF;
 ${['customer_movements','system_settings','clean_order_sale_links','clean_order_sale_requests','clean_order_sale_definitions'].map(t=>`GRANT SELECT ON dbo.${t} TO [${CLEAN_LOGIN}];`).join('\n')}
 GRANT EXECUTE ON dbo.usp_clean_order_sale_begin TO [${CLEAN_LOGIN}];GRANT EXECUTE ON dbo.usp_clean_order_sale_finish TO [${CLEAN_LOGIN}];
 ${[...Object.keys(buildCrmV2Procedures()),'crm_order_v2_requests','crm_order_v2_lines','sales_orders','sales_order_items','crm_order_v2_definitions'].map(name=>`GRANT VIEW DEFINITION ON OBJECT::dbo.${name} TO [${CLEAN_LOGIN}];`).join('\n')}
 ${['sales_invoices','sales_invoice_items','stock_movements','customer_movements','audit_logs'].map(t=>`GRANT INSERT ON dbo.${t} TO [${CLEAN_LOGIN}];`).join('\n')}
 GRANT UPDATE(current_stock_qty,updated_at) ON dbo.products TO [${CLEAN_LOGIN}];GRANT UPDATE(balance,updated_at) ON dbo.customers TO [${CLEAN_LOGIN}];
 GRANT UPDATE(status,estimated_profit_try,finalized_at,updated_at,account_currency,account_amount,account_exchange_rate_snapshot) ON dbo.sales_invoices TO [${CLEAN_LOGIN}];
 GRANT UPDATE(average_cost_try_snapshot,gross_profit_try,gross_profit_rate) ON dbo.sales_invoice_items TO [${CLEAN_LOGIN}];
 GRANT UPDATE(account_currency,account_amount,account_exchange_rate_snapshot,document_exchange_rate_snapshot,amount_try,balance_effect) ON dbo.customer_movements TO [${CLEAN_LOGIN}];
 COMMIT;SELECT N'CLEAN_ORDER_SALE_INSTALLED' result;`;
}
