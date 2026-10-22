// Reuse the existing native V2 writer, replay and immutable receipt guards.
import {createHash} from 'node:crypto';
import {buildCrmV2Procedures,buildCrmV2Guards,buildCrmV2InstallSql,CRM_V2_TARGET_SQL,CRM_V2_READY_SQL,CRM_V2_PRODUCT_PROOF_SQL} from './crm-order-v2-sql.mjs';
import {CUSTOMER_CARD_READY_SQL} from '../../apps/api/src/services/customerCardReadStore.mjs';
import {CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
const q=s=>"N'"+s.replaceAll("'","''")+"'";
const hash=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
export const CLEAN_TARGET_SQL=`IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${CLEAN_DATABASE}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' OR NOT EXISTS(SELECT 1 FROM dbo.clean_test_environment WHERE id=1 AND environment_id='${CLEAN_ENVIRONMENT_ID}' AND synthetic=1 AND actual_t1=0 AND external_operations=0) THROW 51200,'CRM_V2_TARGET_UNAVAILABLE',1;`;
const ready=`${CLEAN_TARGET_SQL}
IF (SELECT COUNT(*) FROM dbo.crm_order_v2_definitions)<>8 OR EXISTS(SELECT 1 FROM dbo.crm_order_v2_definitions d WHERE d.definition_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2) OR OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name)) IS NULL OR (OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'IsTrigger')=1 AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'ExecIsTriggerDisabled')<>0)) THROW 51207,'CRM_V2_NOT_READY',1;`;
const proof=`IF (SELECT COUNT(*) FROM @lines)<>(SELECT COUNT(*) FROM @lines l JOIN dbo.products p WITH(HOLDLOCK) ON p.id=l.product_id JOIN dbo.product_prices v WITH(HOLDLOCK) ON v.id=l.price_id AND v.product_id=p.id WHERE p.is_active=1 AND p.is_deleted=0 AND CONVERT(varbinary(max),p.stock_code)=CONVERT(varbinary(max),l.stock_code) AND p.unit=N'ADET' AND l.unit_source_id=1 AND v.source_unit_id=1 AND v.price_type=N'sale' AND v.price_tier=1 AND v.is_main_unit=1 AND v.currency_code=l.currency AND v.price=l.price_exact AND CONVERT(varbinary(max),v.source_record_key)=CONVERT(varbinary(max),l.price_source_key) AND v.source_record_key=N'SYNTHETIC/20261022/products/'+CONVERT(nvarchar(20),p.id)+N'/PRICE/sale/1/1/'+v.currency_code AND (SELECT COUNT(*) FROM dbo.product_prices x WITH(HOLDLOCK) WHERE x.product_id=p.id AND x.source_unit_id=1 AND x.price_type=N'sale' AND x.price_tier=1 AND x.currency_code=l.currency)=1 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WITH(HOLDLOCK) WHERE h.entity=N'product' AND h.native_id=p.id)) THROW 51204,'CRM_V2_PRODUCT_CHANGED',1;`;
export function buildCleanSyntheticOrderSql(){
 const originals={...buildCrmV2Procedures(),...buildCrmV2Guards()};let install=buildCrmV2InstallSql();
 for(const [name,sql] of Object.entries(originals)){
  const clean=sql.replaceAll(CRM_V2_PRODUCT_PROOF_SQL,proof).replaceAll(CRM_V2_READY_SQL,ready).replaceAll(CRM_V2_TARGET_SQL,CLEAN_TARGET_SQL);
  if(clean.includes('accepted_price_')||clean.includes('VEGA_CAPTURE_'))throw Error('Legacy source proof survived');
  install=install.replaceAll(q(sql),q(clean)).replaceAll(hash(sql),hash(clean));
 }
 install=install.replaceAll(CRM_V2_TARGET_SQL,CLEAN_TARGET_SQL).replaceAll(CUSTOMER_CARD_READY_SQL,CLEAN_TARGET_SQL).replaceAll('melisa_sirket_sales_test_20260929_01',CLEAN_LOGIN);
 return install;
}
