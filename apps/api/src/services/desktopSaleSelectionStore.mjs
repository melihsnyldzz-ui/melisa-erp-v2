// Source-only selection reader for the first synthetic TRY acceptance. It
// requires a future real desktop sale scope verifier; importing opens no SQL.
import {desktopSeriesFactor} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
const fail=()=>{throw Error('DESKTOP_SALE_SELECTION_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_SALE_SELECTION_SQL=`SET NOCOUNT ON;
SELECT CONVERT(varchar(20),c.id) id,c.customer_code customerCode,CONVERT(varchar(20),c.party_entity_id) entityId,CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(20),a.customer_id) accountCustomerId,CONVERT(varchar(20),a.party_entity_id) accountEntityId,CONVERT(varchar(20),a.supplier_id) accountSupplierId,a.currency_code accountCurrency,c.currency_code currency,CONVERT(bit,CASE WHEN c.is_active=1 AND c.is_deleted=0 THEN 1 ELSE 0 END) active,CONVERT(varchar(40),c.balance) balanceExact4,CONVERT(varchar(40),a.current_balance) accountBalanceExact8
FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK) JOIN dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) ON a.customer_id=c.id AND a.party_entity_id=c.party_entity_id AND a.supplier_id IS NULL AND a.currency_code=N'TRY' WHERE c.id=TRY_CONVERT(bigint,@customerId);
SELECT CONVERT(varchar(20),p.id) id,CONVERT(varchar(20),u.id) unitId,CONVERT(varchar(20),q.id) priceId,CONVERT(varchar(20),u.product_id) unitProductId,CONVERT(varchar(20),q.product_id) priceProductId,CONVERT(varchar(20),l.unit_id) priceUnitId,CONVERT(varchar(20),b.product_id) barcodeProductId,q.price_type priceType,q.currency_code currency,CONVERT(bit,CASE WHEN p.is_active=1 AND p.is_deleted=0 THEN 1 ELSE 0 END) active,CONVERT(varchar(40),u.factor) unitFactorExact8,u.is_main mainUnit,p.stock_code stockCode,p.name,b.barcode,u.label unit,CONVERT(varchar(40),p.current_stock_qty) stockExact3,CONVERT(varchar(40),TRY_CONVERT(decimal(18,4),q.price)) priceExact4,CONVERT(varchar(40),p.average_cost_try) averageCostTryExact4,
(SELECT CONVERT(varchar(20),s.id) FROM dbo.desktop_local_product_units s WITH(UPDLOCK,HOLDLOCK) WHERE s.product_id=p.id AND s.label=N'SERİ' AND s.is_main=0) seriesUnitId,
(SELECT CONVERT(varchar(40),s.factor) FROM dbo.desktop_local_product_units s WITH(UPDLOCK,HOLDLOCK) WHERE s.product_id=p.id AND s.label=N'SERİ' AND s.is_main=0) seriesFactorExact8
FROM dbo.products p WITH(UPDLOCK,HOLDLOCK)
JOIN dbo.desktop_local_product_units u WITH(UPDLOCK,HOLDLOCK) ON u.product_id=p.id AND u.is_main=1
JOIN dbo.desktop_local_price_units l WITH(UPDLOCK,HOLDLOCK) ON l.product_id=p.id AND l.unit_id=u.id
JOIN dbo.product_prices q WITH(UPDLOCK,HOLDLOCK) ON q.id=l.price_id AND q.product_id=p.id AND q.price_type=N'sale' AND q.currency_code=N'TRY' AND q.price=TRY_CONVERT(decimal(18,4),q.price)
JOIN dbo.product_barcodes b WITH(UPDLOCK,HOLDLOCK) ON b.product_id=p.id AND b.is_primary=1 AND b.is_active=1
WHERE p.id=TRY_CONVERT(bigint,@productId);`;
export function createDesktopSaleSelectionStore({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function select({transaction,scope,customerId,productId}={}){
  if(!transaction||!scope||!id(customerId)||!id(productId)||await verifyScope({transaction,scope,customerId,productId})!==true)fail();
  const result=await new sql.Request(transaction).input('customerId',sql.NVarChar(20),customerId).input('productId',sql.NVarChar(20),productId).query(DESKTOP_SALE_SELECTION_SQL);
  if(!Array.isArray(result?.recordsets)||result.recordsets.length!==2||result.recordsets.some(r=>!Array.isArray(r)||r.length!==1))fail();
  const [customers,products]=result.recordsets,{seriesUnitId,seriesFactorExact8,...product}=products[0];
  if(seriesUnitId!=null||seriesFactorExact8!=null){if(!id(seriesUnitId)||product.unit!=='ADET')fail();desktopSeriesFactor(seriesFactorExact8);product.seriesUnit={unitId:seriesUnitId,factorExact8:seriesFactorExact8};}
  return {customer:customers[0],product};
 };
}
export const DESKTOP_SALE_SELECTION_STORE_LIMITS=Object.freeze({sourceOnly:true,initialSyntheticAcceptanceCurrency:'TRY',multiCurrencySalesImplemented:false,requiresRealSaleScopeVerifier:true,ambiguousPricesRejected:true,realSqlVerified:false});
