// Desktop-local master SQL adapter, SOURCE ONLY. The read-only installation
// cannot use this store: a reviewed writable migration, a dedicated writer,
// permission assignment and a normal authenticated-session adapter are still
// required. Importing this file opens no connection and executes no SQL.
import {LOCAL_MASTER_RESERVE_SQL,LOCAL_MASTER_FINISH_SQL} from '../../../../scripts/desktop-empty/local-master-schema-proposal.mjs';
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as DESKTOP_WRITE_PERMISSION_GUARD_SQL} from '../config/desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../config/desktopMasterV3Policy.mjs';
import {MASTER_V3_RESERVE_SQL,MASTER_V3_FINISH_SQL} from '../../../../scripts/desktop-empty/master-v3-journal-sql.mjs';
import {isProductRejectionRecord,isDurableProductRejection} from './desktopProductRejection.mjs';

const LOGIN='melisa_desktop_test_writer_20261105';
const DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const GUID='c67f5317-9c0d-4831-aadd-fadc379a95d1';
const ENVIRONMENT='eb2888c2-51cb-4570-a933-397cf7e62806';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const one=r=>{if(!Array.isArray(r?.recordset)||r.recordset.length!==1)fail('LOCAL_SQL_ROW_COUNT');return r.recordset[0];};
const id=r=>{const v=one(r).id;if(typeof v!=='string'||!/^[1-9]\d*$/.test(v))fail('LOCAL_SQL_ID');return v;};
const parse=value=>{if(typeof value!=='string'||value.length>8192)fail('LOCAL_SQL_JOURNAL');try{return JSON.parse(value);}catch{fail('LOCAL_SQL_JOURNAL');}};

// Every statement is executed through a Request bound to the same mssql
// Transaction, which holds its checked-out physical connection through
// commit. Decimal values cross the JS/driver boundary as validated strings;
// SQL converts them to decimal and reads back fixed-scale strings, avoiding
// JavaScript Number precision loss. IDs are also passed as decimal strings.
export function createDesktopLocalMasterSqlStore({pool,sql,verifySession,richCards=false}={}){
 if(!pool||!sql?.Transaction||!sql?.Request||!sql?.NVarChar||!sql?.VarBinary||!sql?.Int||sql?.MAX===undefined||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function'||typeof richCards!=='boolean')fail('LOCAL_SQL_CONFIGURATION');
 const text=sql.NVarChar;
 const execute=(tx,bindings,statement)=>{const q=new sql.Request(tx);for(const [key,type,value] of bindings)q.input(key,type,value);return q.query(statement);};
 const s=(name,value,size=250)=>[name,text(size),value];
 const guard=`SET NOCOUNT ON;
 IF DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'${DATABASE}')
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')
 OR SUSER_SNAME() IS NULL OR CONVERT(varbinary(256),SUSER_SNAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ORIGINAL_LOGIN() IS NULL OR CONVERT(varbinary(256),ORIGINAL_LOGIN())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR USER_NAME() IS NULL OR DATALENGTH(USER_NAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),USER_NAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR DATALENGTH(SUSER_SNAME())<>DATALENGTH(N'${LOGIN}') OR DATALENGTH(ORIGINAL_LOGIN())<>DATALENGTH(N'${LOGIN}')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'TCP'
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_owner'),1)<>0
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='${GUID}')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WITH(UPDLOCK,HOLDLOCK) WHERE id=1 AND environment_id='${ENVIRONMENT}' AND schema_version=${richCards?3:2} AND actual_t1=0 AND external_operations=0 AND read_only=0)
 THROW 51995,'LOCAL_SQL_TARGET_REJECTED',1;
 ${richCards?DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL:DESKTOP_WRITE_PERMISSION_GUARD_SQL}
 SELECT 1 AS ok;`;
 const journalPrefix=`DECLARE @requestId uniqueidentifier=TRY_CONVERT(uniqueidentifier,@requestIdText), @actorId bigint=TRY_CONVERT(bigint,@actorIdText);`;
 const jb=v=>[s('requestIdText',v.requestId,36),s('operation',v.operation,24),s('actorIdText',v.actorId,20),['payloadHash',sql.VarBinary(32),Buffer.from(v.payloadHash,'hex')]];
 return Object.freeze({async withTransaction(work){
  if(typeof work!=='function')fail('LOCAL_SQL_CONFIGURATION');const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;one(await execute(tx,[],guard));
   const api={
    async lockAndVerifyAuthority(v){
     if(!v||!['customer.edit','product.edit',...(richCards?['supplier.edit']:[])].includes(v.permission))return false;
     // Authentication is independently tied to the normal session in the
     // application layer; verifier MUST re-read and hold session authority on
     // this transaction. A fake verifier is suitable only for offline tests.
     const required=richCards&&v.permission==='product.edit'?['product.edit','supplier.view']:v.permission;
     if(await verifySession({transaction:tx,actorId:v.actorId,permission:required})!==true)return false;
     // Mirror permissionCatalog.js: the direct granular key is effective as
     // a key; the legacy *.update/*.manage keys grant edit when either create
     // or update is set. The three full-access role codes are the existing
     // default-role contract, not a new grant introduced by this adapter.
     const stem=v.permission==='customer.edit'?'customer':v.permission==='supplier.edit'?'supplier':'product';
     const r=await execute(tx,[s('actor',v.actorId,20),s('direct',v.permission,120),s('update',stem+'.update',120),s('manage',stem+'s.manage',120)],`SELECT CONVERT(varchar(20),u.id) id FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r WITH(UPDLOCK,HOLDLOCK) ON r.id=u.role_id WHERE u.id=TRY_CONVERT(bigint,@actor) AND u.is_active=1 AND r.is_active=1 AND (EXISTS(SELECT 1 FROM (VALUES(N'admin'),(N'owner_manager'),(N'owner_partner')) allowed(code) WHERE DATALENGTH(r.code)=DATALENGTH(allowed.code) AND CONVERT(varbinary(100),LOWER(r.code COLLATE Latin1_General_100_BIN2))=CONVERT(varbinary(100),allowed.code)) OR EXISTS(SELECT 1 FROM dbo.permissions p WITH(UPDLOCK,HOLDLOCK) WHERE p.role_id=r.id AND ((DATALENGTH(p.permission_key)=DATALENGTH(@direct) AND CONVERT(varbinary(240),p.permission_key)=CONVERT(varbinary(240),@direct) AND (p.can_view=1 OR p.can_create=1 OR p.can_update=1 OR p.can_approve=1)) OR (((DATALENGTH(p.permission_key)=DATALENGTH(@update) AND CONVERT(varbinary(240),p.permission_key)=CONVERT(varbinary(240),@update)) OR (DATALENGTH(p.permission_key)=DATALENGTH(@manage) AND CONVERT(varbinary(240),p.permission_key)=CONVERT(varbinary(240),@manage))) AND (p.can_create=1 OR p.can_update=1)))));`);
     return r?.recordset?.length===1&&r.recordset[0].id===v.actorId;
    },
    async beginRequest(v){const r=await execute(tx,jb(v),journalPrefix+'\n'+(richCards?MASTER_V3_RESERVE_SQL:LOCAL_MASTER_RESERVE_SQL));if(!Array.isArray(r?.recordset)||r.recordset.length>1)fail('LOCAL_SQL_JOURNAL');return r.recordset.length?{state:'REPLAY',response:parse(r.recordset[0].response_json)}:{state:'NEW'};},
    async findProductConflict(v){
     const r=await execute(tx,[s('stockCode',v.stockCode,50),s('barcode',v.barcode,80)],`SELECT CASE
 WHEN EXISTS(SELECT 1 FROM dbo.products WITH(UPDLOCK,HOLDLOCK) WHERE stock_code=@stockCode) THEN N'PRODUCT_STOCK_CODE_IN_USE'
 WHEN EXISTS(SELECT 1 FROM dbo.product_barcodes WITH(UPDLOCK,HOLDLOCK) WHERE barcode=@barcode AND is_active=1) THEN N'PRODUCT_BARCODE_IN_USE'
 ELSE NULL END conflictReason;`);
     const reason=one(r).conflictReason;if(reason!==null&&!['PRODUCT_STOCK_CODE_IN_USE','PRODUCT_BARCODE_IN_USE'].includes(reason))fail('LOCAL_SQL_PRODUCT_CONFLICT');return reason;
    },
    async insertCustomer(v){return id(await execute(tx,[s('code',v.customerCode,50),s('name',v.name),s('phone',v.phone,40),s('city',v.city,100),s('country',v.country,100),s('kind',v.customerType,30),s('currency',v.currency,3),s('actor',v.actorId,20)],`INSERT dbo.customers(customer_code,name,phone,city,country,customer_type,currency_code,balance,risk_limit,is_active,is_deleted,created_by,updated_by) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(@code,@name,@phone,@city,@country,@kind,@currency,0,0,1,0,TRY_CONVERT(bigint,@actor),TRY_CONVERT(bigint,@actor));`));},
    async insertPartyEntity(v){return id(await execute(tx,[s('role',v.role,20),s('name',v.name),s('country',v.country,100)],`INSERT dbo.party_entities(role,name,country,identity_rule) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(@role,@name,@country,N'desktop-local');`));},
    async attachCustomerEntity(v){const r=await execute(tx,[s('customer',v.customerId,20),s('entity',v.entityId,20)],`UPDATE dbo.customers SET party_entity_id=TRY_CONVERT(bigint,@entity) WHERE id=TRY_CONVERT(bigint,@customer) AND party_entity_id IS NULL; SELECT @@ROWCOUNT changed;`);if(one(r).changed!==1)fail('LOCAL_SQL_ATTACH');},
    async insertCurrencyAccount(v){return id(await execute(tx,[s('customer',v.customerId,20),s('entity',v.entityId,20),s('currency',v.currency,3),s('balance',v.currentBalanceExact8,40)],`INSERT dbo.party_currency_accounts(party_entity_id,customer_id,supplier_id,currency_code,current_balance,balance_status) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@entity),TRY_CONVERT(bigint,@customer),NULL,@currency,TRY_CONVERT(decimal(28,8),@balance),N'local');`));},
    async readCustomerPersistence(v){const r=await execute(tx,[s('customer',v.customerId,20),s('entity',v.entityId,20),s('account',v.accountId,20)],`SELECT CONVERT(varchar(20),c.id) c_id,CONVERT(varchar(20),c.party_entity_id) c_entity,c.currency_code c_currency,c.customer_code c_code,c.name c_name,c.phone c_phone,c.city c_city,c.country c_country,c.customer_type c_type,CONVERT(varchar(20),e.id) e_id,e.role e_role,e.name e_name,e.country e_country,CONVERT(varchar(20),a.id) a_id,CONVERT(varchar(20),a.party_entity_id) a_entity,CONVERT(varchar(20),a.customer_id) a_customer,CONVERT(varchar(20),a.supplier_id) a_supplier,a.currency_code a_currency,CONVERT(varchar(40),a.current_balance) a_balance FROM dbo.customers c JOIN dbo.party_entities e ON e.id=c.party_entity_id JOIN dbo.party_currency_accounts a ON a.party_entity_id=e.id WHERE c.id=TRY_CONVERT(bigint,@customer) AND e.id=TRY_CONVERT(bigint,@entity) AND a.id=TRY_CONVERT(bigint,@account);`);const x=one(r);return {customer:{id:x.c_id,entityId:x.c_entity,currency:x.c_currency,customerCode:x.c_code,name:x.c_name,phone:x.c_phone,customerType:x.c_type,city:x.c_city,country:x.c_country},entity:{id:x.e_id,role:x.e_role,name:x.e_name,country:x.e_country},account:{id:x.a_id,entityId:x.a_entity,customerId:x.a_customer,supplierId:x.a_supplier,currency:x.a_currency,currentBalanceExact8:x.a_balance}};},
    async insertSupplier(v){return id(await execute(tx,[s('code',v.supplierCode,50),s('name',v.name),s('phone',v.phone,40),s('city',v.city,100),s('country',v.country,100),s('currency',v.currency,3),s('discount',v.purchaseDiscountRateExact4,20),s('actor',v.actorId,20)],`INSERT dbo.suppliers(supplier_code,name,phone,city,country,currency_code,purchase_discount_rate,balance,is_active,is_deleted,created_by,updated_by) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(@code,@name,@phone,@city,@country,@currency,TRY_CONVERT(decimal(9,4),@discount),0,1,0,TRY_CONVERT(bigint,@actor),TRY_CONVERT(bigint,@actor));`));},
    async attachSupplierEntity(v){const r=await execute(tx,[s('supplier',v.supplierId,20),s('entity',v.entityId,20)],`UPDATE dbo.suppliers SET party_entity_id=TRY_CONVERT(bigint,@entity) WHERE id=TRY_CONVERT(bigint,@supplier) AND party_entity_id IS NULL; SELECT @@ROWCOUNT changed;`);if(one(r).changed!==1)fail('LOCAL_SQL_ATTACH');},
    async insertSupplierCurrencyAccount(v){return id(await execute(tx,[s('supplier',v.supplierId,20),s('entity',v.entityId,20),s('currency',v.currency,3),s('balance',v.currentBalanceExact8,40)],`INSERT dbo.party_currency_accounts(party_entity_id,customer_id,supplier_id,currency_code,current_balance,balance_status) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@entity),NULL,TRY_CONVERT(bigint,@supplier),@currency,TRY_CONVERT(decimal(28,8),@balance),N'local');`));},
    async readSupplierPersistence(v){const r=await execute(tx,[s('supplier',v.supplierId,20),s('entity',v.entityId,20),s('account',v.accountId,20)],`SELECT CONVERT(varchar(20),s.id) s_id,CONVERT(varchar(20),s.party_entity_id) s_entity,s.currency_code s_currency,s.supplier_code s_code,s.name s_name,s.phone s_phone,s.city s_city,s.country s_country,CONVERT(varchar(40),s.purchase_discount_rate) s_discount,CONVERT(varchar(40),s.balance) s_balance,s.is_active s_active,s.is_deleted s_deleted,CONVERT(varchar(20),e.id) e_id,e.role e_role,e.name e_name,e.country e_country,CONVERT(varchar(20),a.id) a_id,CONVERT(varchar(20),a.party_entity_id) a_entity,CONVERT(varchar(20),a.customer_id) a_customer,CONVERT(varchar(20),a.supplier_id) a_supplier,a.currency_code a_currency,CONVERT(varchar(40),a.current_balance) a_balance FROM dbo.suppliers s JOIN dbo.party_entities e ON e.id=s.party_entity_id JOIN dbo.party_currency_accounts a ON a.party_entity_id=e.id WHERE s.id=TRY_CONVERT(bigint,@supplier) AND e.id=TRY_CONVERT(bigint,@entity) AND a.id=TRY_CONVERT(bigint,@account);`);const x=one(r);return {supplier:{id:x.s_id,entityId:x.s_entity,currency:x.s_currency,supplierCode:x.s_code,name:x.s_name,phone:x.s_phone,city:x.s_city,country:x.s_country,purchaseDiscountRateExact4:x.s_discount,balanceExact4:x.s_balance,isActive:x.s_active,isDeleted:x.s_deleted},entity:{id:x.e_id,role:x.e_role,name:x.e_name,country:x.e_country},account:{id:x.a_id,entityId:x.a_entity,customerId:x.a_customer,supplierId:x.a_supplier,currency:x.a_currency,currentBalanceExact8:x.a_balance}};},
    async lockActiveSupplier(v){const r=await execute(tx,[s('supplier',v.supplierId,20)],`SELECT CONVERT(varchar(20),id) id,is_active isActive,is_deleted isDeleted FROM dbo.suppliers WITH(UPDLOCK,HOLDLOCK) WHERE id=TRY_CONVERT(bigint,@supplier);`);return one(r);},
    async insertProduct(v){return id(await execute(tx,[s('code',v.stockCode,50),s('name',v.name),s('unit',v.unit,20),s('currency',v.currency,3),s('sale',v.salePriceExact4,40),s('purchase',v.purchasePriceExact4,40),s('discount',v.purchaseDiscountRateExact4,20),s('cost',v.averageCostTryExact4,40),s('stock',v.initialStockExact3,40),s('actor',v.actorId,20),...(richCards?[s('brand',v.brand,120),s('category',v.category,120),s('supplier',v.supplierId,20)]:[])],`INSERT dbo.products(stock_code,name,unit,currency_code,sales_price,purchase_price,purchase_discount_rate,average_cost_try,current_stock_qty,is_active,is_deleted,created_by,updated_by${richCards?',brand,category,supplier_id':''}) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(@code,@name,@unit,@currency,TRY_CONVERT(decimal(18,4),@sale),TRY_CONVERT(decimal(18,4),@purchase),TRY_CONVERT(decimal(9,4),@discount),TRY_CONVERT(decimal(18,4),@cost),TRY_CONVERT(decimal(18,3),@stock),1,0,TRY_CONVERT(bigint,@actor),TRY_CONVERT(bigint,@actor)${richCards?',@brand,@category,TRY_CONVERT(bigint,@supplier)':''});`));},
    async readRichProductFields(v){return one(await execute(tx,[s('product',v.productId,20)],`SELECT brand,category,CONVERT(varchar(20),supplier_id) supplierId FROM dbo.products WHERE id=TRY_CONVERT(bigint,@product);`));},
    async insertLocalUnit(v){return id(await execute(tx,[s('product',v.productId,20),s('label',v.label,20),s('factor',v.factorExact8,40)],`INSERT dbo.desktop_local_product_units(product_id,label,factor,is_main) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@product),@label,TRY_CONVERT(decimal(28,8),@factor),1);`));},
    async insertBarcode(v){return id(await execute(tx,[s('product',v.productId,20),s('barcode',v.barcode,80),s('actor',v.actorId,20)],`INSERT dbo.product_barcodes(product_id,barcode,barcode_type,is_primary,is_active,created_by,updated_by) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@product),@barcode,N'primary',1,1,TRY_CONVERT(bigint,@actor),TRY_CONVERT(bigint,@actor));`));},
    async insertNativePrice(v){return id(await execute(tx,[s('product',v.productId,20),s('type',v.type,20),['tier',sql.Int,v.tier],s('currency',v.currency,3),s('price',v.priceExact8,40)],`INSERT dbo.product_prices(product_id,price_type,price_tier,currency_code,price,source_unit_id) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@product),@type,@tier,@currency,TRY_CONVERT(decimal(28,8),@price),NULL);`));},
    async linkLocalPriceUnit(v){const r=await execute(tx,[s('product',v.productId,20),s('unit',v.unitId,20),s('price',v.priceId,20)],`INSERT dbo.desktop_local_price_units(product_id,unit_id,price_id) VALUES(TRY_CONVERT(bigint,@product),TRY_CONVERT(bigint,@unit),TRY_CONVERT(bigint,@price)); SELECT @@ROWCOUNT changed;`);if(one(r).changed!==1)fail('LOCAL_SQL_LINK');},
    async readProductPersistence(v){const r=await execute(tx,[s('product',v.productId,20),s('unit',v.unitId,20),s('barcode',v.barcodeId,20),s('price',v.priceId,20)],`SELECT CONVERT(varchar(20),p.id) p_id,p.stock_code p_code,p.name p_name,p.unit p_unit,p.currency_code p_currency,CONVERT(varchar(40),p.sales_price) p_sale,CONVERT(varchar(40),p.purchase_price) p_purchase,CONVERT(varchar(20),p.purchase_discount_rate) p_discount,CONVERT(varchar(40),p.average_cost_try) p_cost,CONVERT(varchar(40),p.current_stock_qty) p_stock,CONVERT(varchar(20),u.id) u_id,CONVERT(varchar(20),u.product_id) u_product,u.label u_label,CONVERT(varchar(40),u.factor) u_factor,u.is_main u_main,CONVERT(varchar(20),b.id) b_id,CONVERT(varchar(20),b.product_id) b_product,b.barcode b_code,b.is_primary b_primary,b.is_active b_active,CONVERT(varchar(20),q.id) q_id,CONVERT(varchar(20),q.product_id) q_product,q.price_type q_type,q.price_tier q_tier,q.currency_code q_currency,CONVERT(varchar(40),q.price) q_price,q.source_unit_id q_source,CONVERT(varchar(20),l.product_id) l_product,CONVERT(varchar(20),l.unit_id) l_unit,CONVERT(varchar(20),l.price_id) l_price FROM dbo.products p JOIN dbo.desktop_local_product_units u ON u.product_id=p.id JOIN dbo.product_barcodes b ON b.product_id=p.id JOIN dbo.product_prices q ON q.product_id=p.id JOIN dbo.desktop_local_price_units l ON l.product_id=p.id AND l.unit_id=u.id AND l.price_id=q.id WHERE p.id=TRY_CONVERT(bigint,@product) AND u.id=TRY_CONVERT(bigint,@unit) AND b.id=TRY_CONVERT(bigint,@barcode) AND q.id=TRY_CONVERT(bigint,@price);`);const x=one(r);return {product:{id:x.p_id,stockCode:x.p_code,name:x.p_name,unit:x.p_unit,currency:x.p_currency,salePriceExact4:x.p_sale,purchasePriceExact4:x.p_purchase,purchaseDiscountRateExact4:x.p_discount,averageCostTryExact4:x.p_cost,initialStockExact3:x.p_stock},unit:{id:x.u_id,productId:x.u_product,label:x.u_label,factorExact8:x.u_factor,isMain:x.u_main},barcode:{id:x.b_id,productId:x.b_product,barcode:x.b_code,isPrimary:x.b_primary,isActive:x.b_active},price:{id:x.q_id,productId:x.q_product,type:x.q_type,tier:x.q_tier,currency:x.q_currency,priceExact8:x.q_price,sourceUnitId:x.q_source},link:{productId:x.l_product,unitId:x.l_unit,priceId:x.l_price}};},
    // Same movement representation as native productService bulk opening.
    async insertOpeningMovement(v){return id(await execute(tx,[s('product',v.productId,20),s('actor',v.actorId,20),s('quantity',v.quantityExact3,40),s('cost',v.averageCostTryExact4,40),s('price',v.unitPriceExact4,40),s('amount',v.amountTryExact4,40),s('date',v.documentDate,10)],`INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,created_by,unit_price,currency_code,amount_try) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@product),N'in',N'stock_adjustment',NULL,TRY_CONVERT(decimal(18,3),@quantity),0,TRY_CONVERT(decimal(18,3),@quantity),TRY_CONVERT(decimal(18,4),@cost),TRY_CONVERT(decimal(18,4),@cost),TRY_CONVERT(date,@date,23),TRY_CONVERT(bigint,@actor),TRY_CONVERT(decimal(18,4),@price),N'TRY',TRY_CONVERT(decimal(18,4),@amount));`));},
    async readOpeningMovement(v){return one(await execute(tx,[s('product',v.productId,20),s('movement',v.movementId,20)],`SELECT CONVERT(varchar(20),id) id,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(20),created_by) actorId,CONVERT(varchar(40),quantity_in) quantityInExact3,CONVERT(varchar(40),quantity_out) quantityOutExact3,CONVERT(varchar(40),quantity_net) quantityNetExact3,CONVERT(varchar(40),unit_cost_try) unitCostTryExact4,CONVERT(varchar(40),unit_price) unitPriceExact4,CONVERT(varchar(40),amount_try) amountTryExact4,CONVERT(char(10),document_date,23) documentDate,currency_code currency,movement_type movementType,source_type sourceType,CONVERT(varchar(20),source_id) sourceId,(SELECT CONVERT(varchar(20),COUNT_BIG(*)) FROM dbo.stock_movements WHERE product_id=TRY_CONVERT(bigint,@product)) productMovementCount FROM dbo.stock_movements WHERE id=TRY_CONVERT(bigint,@movement) AND product_id=TRY_CONVERT(bigint,@product);`));},
    async appendAudit(v){const r=await execute(tx,[s('actor',v.actorId,20),s('operation',v.operation,24),s('entity',v.entityId,20),s('request',v.requestId,36)],`INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,reason,source) VALUES(TRY_CONVERT(bigint,@actor),@operation,N'local-master',TRY_CONVERT(bigint,@entity),@request,N'desktop-local-master-v1'); SELECT @@ROWCOUNT changed;`);if(one(r).changed!==1)fail('LOCAL_SQL_AUDIT');},
    async readMasterAudit(v){const r=await execute(tx,[s('request',v.requestId,36)],`SELECT reason requestId,CONVERT(varchar(20),actor_user_id) actorId,action operation,CONVERT(varchar(20),entity_id) entityId FROM dbo.audit_logs WHERE reason=@request AND source=N'desktop-local-master-v1' AND entity_type=N'local-master';`);return one(r);},
    async finishRequest(v){const r=await execute(tx,[...jb(v),s('responseJson',JSON.stringify(v.response),sql.MAX)],journalPrefix+'\n'+(richCards?MASTER_V3_FINISH_SQL:LOCAL_MASTER_FINISH_SQL));if(one(r).response_json!==JSON.stringify(v.response))fail('LOCAL_SQL_JOURNAL');},
    async readFinishedRequest(v){const r=await execute(tx,[s('request',v.requestId,36)],`SELECT LOWER(CONVERT(varchar(36),request_id)) requestId,operation,CONVERT(varchar(20),actor_id) actorId,LOWER(CONVERT(varchar(64),payload_hash,2)) payloadHash,response_json FROM dbo.desktop_local_master_requests WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`);const x=one(r);return {requestId:x.requestId,operation:x.operation,actorId:x.actorId,payloadHash:x.payloadHash,response:parse(x.response_json)};},
   };
   // Do not depend on the caller to respect the coordinator's order. No
   // business method is exposed before a locked authority check AND a fresh
   // journal reservation in this exact transaction; a replay cannot write.
   let authority=null,active=null,finished=false,journalRead=false,createdProduct=null,openingWritten=false,openingRead=false,opening=null,lockedSupplier=null,richProductRead=false,createdSupplier=null,supplierEntity=null,supplierAccount=null,supplierAttached=false,supplierRead=false,conflictCheck=null,rejected=false,replayRejection=null;
   const customerMethods=new Set(['insertCustomer','attachCustomerEntity','insertCurrencyAccount','readCustomerPersistence']);
   const supplierMethods=new Set(['insertSupplier','attachSupplierEntity','insertSupplierCurrencyAccount','readSupplierPersistence']);
   const productMethods=new Set(['findProductConflict','lockActiveSupplier','insertProduct','readRichProductFields','insertLocalUnit','insertBarcode','insertNativePrice','linkLocalPriceUnit','readProductPersistence','insertOpeningMovement','readOpeningMovement']);
   const guarded=Object.fromEntries(Object.entries(api).map(([name,fn])=>[name,async value=>{
    if(name==='lockAndVerifyAuthority'){
     if(authority!==null||active!==null)fail('LOCAL_SQL_ORDER');
     const ok=await fn(value);if(ok)authority={actorId:value.actorId,permission:value.permission};return ok;
    }
    if(name==='beginRequest'){
     if(!authority||active!==null||value?.actorId!==authority.actorId||
      (value.operation==='customer.create'?'customer.edit':value.operation==='product.create'?'product.edit':richCards&&value.operation==='supplier.create'?'supplier.edit':null)!==authority.permission)fail('LOCAL_SQL_ORDER');
     const result=await fn(value);if(result.state==='NEW')active={requestId:value.requestId,operation:value.operation,actorId:value.actorId,payloadHash:value.payloadHash};
     else if(richCards&&value.operation==='product.create'&&result.state==='REPLAY'&&isProductRejectionRecord(result.response,value.requestId))replayRejection=result.response;
     return result;
    }
    if(!authority||!active)fail('LOCAL_SQL_ORDER');
    if(customerMethods.has(name)&&active.operation!=='customer.create'||supplierMethods.has(name)&&(!richCards||active.operation!=='supplier.create')||productMethods.has(name)&&active.operation!=='product.create'||name==='insertPartyEntity'&&!['customer.create',...(richCards?['supplier.create']:[])].includes(active.operation))fail('LOCAL_SQL_ORDER');
    if(value?.actorId!==undefined&&value.actorId!==active.actorId)fail('LOCAL_SQL_ORDER');
    if(value?.requestId!==undefined&&value.requestId!==active.requestId)fail('LOCAL_SQL_ORDER');
    if(finished&&name!=='readFinishedRequest')fail('LOCAL_SQL_ORDER');
    if(name==='findProductConflict'){
     if(!richCards||conflictCheck||createdProduct||!lockedSupplier||typeof value?.stockCode!=='string'||typeof value.barcode!=='string')fail('LOCAL_SQL_ORDER');
     const reason=await fn(value);conflictCheck={stockCode:value.stockCode,barcode:value.barcode,reason};return reason;
    }
    if(richCards&&active.operation==='product.create'&&name==='insertProduct'&&(!conflictCheck||conflictCheck.reason!==null||value.stockCode!==conflictCheck.stockCode))fail('LOCAL_SQL_ORDER');
    if(richCards&&active.operation==='product.create'&&name==='insertBarcode'&&(!createdProduct||value.productId!==createdProduct.id||value.barcode!==conflictCheck?.barcode))fail('LOCAL_SQL_ORDER');
    if(name==='insertPartyEntity'&&active.operation==='supplier.create'){
     if(!createdSupplier||supplierEntity||value.role!=='supplier'||value.name!==createdSupplier.name||value.country!==createdSupplier.country)fail('LOCAL_SQL_ORDER');supplierEntity=await fn(value);return supplierEntity;
    }
    if(supplierMethods.has(name)){
     if(name==='insertSupplier'){if(createdSupplier)fail('LOCAL_SQL_ORDER');const supplierId=await fn(value);createdSupplier={...value,id:supplierId};return supplierId;}
     if(!createdSupplier||value?.supplierId!==createdSupplier.id||!supplierEntity||value?.entityId!==supplierEntity)fail('LOCAL_SQL_ORDER');
     if(name==='attachSupplierEntity'){if(supplierAttached)fail('LOCAL_SQL_ORDER');const result=await fn(value);supplierAttached=true;return result;}
     if(name==='insertSupplierCurrencyAccount'){if(!supplierAttached||supplierAccount||value.currency!==createdSupplier.currency||value.currentBalanceExact8!=='0.00000000')fail('LOCAL_SQL_ORDER');supplierAccount=await fn(value);return supplierAccount;}
     if(name==='readSupplierPersistence'){if(!supplierAccount||value.accountId!==supplierAccount)fail('LOCAL_SQL_ORDER');const rows=await fn(value),s=rows?.supplier,e=rows?.entity,a=rows?.account;
      if(!s||!e||!a||s.id!==createdSupplier.id||s.entityId!==supplierEntity||s.supplierCode!==createdSupplier.supplierCode||s.name!==createdSupplier.name||s.phone!==createdSupplier.phone||s.city!==createdSupplier.city||s.country!==createdSupplier.country||s.currency!==createdSupplier.currency||s.purchaseDiscountRateExact4!==createdSupplier.purchaseDiscountRateExact4||s.balanceExact4!=='0.0000'||s.isActive!==true||s.isDeleted!==false||e.id!==supplierEntity||e.role!=='supplier'||e.name!==createdSupplier.name||e.country!==createdSupplier.country||a.id!==supplierAccount||a.entityId!==supplierEntity||a.customerId!==null||a.supplierId!==createdSupplier.id||a.currency!==createdSupplier.currency||a.currentBalanceExact8!=='0.00000000')fail('LOCAL_SQL_SUPPLIER_READBACK');supplierRead=true;return rows;}
    }
    if(productMethods.has(name)){
     if(name==='lockActiveSupplier'){if(!richCards||lockedSupplier||createdProduct)fail('LOCAL_SQL_ORDER');const result=await fn(value);if(result?.id!==value?.supplierId||result.isActive!==true||result.isDeleted!==false)fail('LOCAL_SQL_SUPPLIER_UNAVAILABLE');lockedSupplier=result.id;return result;}
     if(name==='insertProduct'){
      if(createdProduct||richCards&&(!lockedSupplier||value.supplierId!==lockedSupplier))fail('LOCAL_SQL_ORDER');
      const productId=await fn(value);createdProduct={id:productId,stock:value.initialStockExact3,cost:value.averageCostTryExact4,brand:value.brand,category:value.category,supplierId:value.supplierId};return productId;
     }
     if(!createdProduct||value?.productId!==createdProduct.id)fail('LOCAL_SQL_ORDER');
     if(name==='readRichProductFields'){if(!richCards)fail('LOCAL_SQL_ORDER');const result=await fn(value);if(result?.brand!==createdProduct.brand||result.category!==createdProduct.category||result.supplierId!==createdProduct.supplierId)fail('LOCAL_SQL_PRODUCT_READBACK');richProductRead=true;return result;}
     if(name==='insertOpeningMovement'){
      if(openingWritten||createdProduct.stock==='0.000'||value.quantityExact3!==createdProduct.stock||value.averageCostTryExact4!==createdProduct.cost)fail('LOCAL_SQL_ORDER');
      const result=await fn(value);openingWritten=true;opening={...value,movementId:result};return result;
     }
     if(name==='readOpeningMovement'){
      if(!openingWritten||value.movementId!==opening.movementId)fail('LOCAL_SQL_ORDER');const result=await fn(value);
      const expected={id:opening.movementId,productId:createdProduct.id,actorId:active.actorId,quantityInExact3:opening.quantityExact3,quantityOutExact3:'0.000',quantityNetExact3:opening.quantityExact3,unitCostTryExact4:opening.averageCostTryExact4,unitPriceExact4:opening.unitPriceExact4,amountTryExact4:opening.amountTryExact4,documentDate:opening.documentDate,currency:'TRY',movementType:'in',sourceType:'stock_adjustment',sourceId:null,productMovementCount:'1'};
      if(Object.keys(expected).some(k=>result?.[k]!==expected[k]))fail('LOCAL_SQL_OPENING_READBACK');openingRead=true;return result;
     }
    }
    if(name==='finishRequest'){
     if(finished||value?.operation!==active.operation||value?.payloadHash!==active.payloadHash)fail('LOCAL_SQL_ORDER');
     rejected=richCards&&active.operation==='product.create'&&conflictCheck?.reason!==null&&isProductRejectionRecord(value.response,active.requestId)&&value.response.reason===conflictCheck?.reason&&!createdProduct;
     if(isProductRejectionRecord(value.response,active.requestId)&&!rejected)fail('LOCAL_SQL_ORDER');
     if(active.operation==='product.create'&&!createdProduct&&!rejected)fail('LOCAL_SQL_ORDER');
     if(active.operation==='supplier.create'&&!supplierRead||active.operation==='product.create'&&richCards&&!richProductRead&&!rejected)fail('LOCAL_SQL_ORDER');
     if(createdProduct&&createdProduct.stock!=='0.000'&&(!openingWritten||!openingRead))fail('LOCAL_SQL_ORDER');
     const result=await fn(value);finished=true;return result;
    }
    if(name==='readFinishedRequest'){
     if(!finished)fail('LOCAL_SQL_ORDER');
     const result=await fn(value);journalRead=true;return result;
    }
    return fn(value);
   }]));
   const result=await work(Object.freeze(guarded));
   if(rejected&&(!isDurableProductRejection(result,active.requestId)||result.replayed!==false||result.reason!==conflictCheck.reason)
    ||replayRejection&&(!isDurableProductRejection(result,replayRejection.requestId)||result.replayed!==true||result.reason!==replayRejection.reason)
    ||!rejected&&!replayRejection&&result?.state==='NOT_COMMITTED')fail('LOCAL_SQL_UNFINISHED_REQUEST');
   if(active&&(!finished||!journalRead))fail('LOCAL_SQL_UNFINISHED_REQUEST');
   if(active?.operation==='product.create'&&!rejected&&(!createdProduct||(createdProduct.stock!=='0.000'&&(!openingWritten||!openingRead))))fail('LOCAL_SQL_UNFINISHED_REQUEST');
   if(active?.operation==='supplier.create'&&!supplierRead||active?.operation==='product.create'&&richCards&&!richProductRead&&!rejected)fail('LOCAL_SQL_UNFINISHED_REQUEST');
   await tx.commit();begun=false;return result;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 }});
}
