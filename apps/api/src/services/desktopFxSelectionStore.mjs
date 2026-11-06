import {DESKTOP_SALE_SELECTION_SQL} from './desktopSaleSelectionStore.mjs';
import {DESKTOP_RESERVED_QUANTITY_SQL} from './desktopTwoItemLockedSelection.mjs';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
import {desktopSeriesFactor} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
import {readDesktopCompanyRates} from './desktopCompanyRateRead.mjs';
const fail=()=>{throw Error('DESKTOP_FX_SELECTION_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
function selectionSql(){let text=DESKTOP_SALE_SELECTION_SQL;for(const [old,next] of [["AND a.currency_code=N'TRY'",'AND a.id=TRY_CONVERT(bigint,@accountId)'],["q.currency_code=N'TRY'",'q.currency_code=@documentCurrency AND q.price_tier IS NULL'],['WHERE c.id=TRY_CONVERT(bigint,@customerId);',"WHERE c.id=TRY_CONVERT(bigint,@customerId) AND EXISTS(SELECT 1 FROM dbo.party_entities e WITH(UPDLOCK,HOLDLOCK) WHERE e.id=c.party_entity_id AND e.role=N'customer');"]]){if(text.split(old).length!==2)fail();text=text.replace(old,next);}return text;}
export const DESKTOP_FX_SELECTION_SQL=selectionSql();
// Distinguish an absent base-currency price from corrupt unit/barcode/link data.
// The original selection remains closed; this query grants no write capability.
export const DESKTOP_FX_MISSING_PRICE_SQL=`SELECT CONVERT(int,CASE WHEN EXISTS(
 SELECT 1 FROM dbo.products p WITH(UPDLOCK,HOLDLOCK)
 WHERE p.id=TRY_CONVERT(bigint,@productId) AND p.is_active=1 AND p.is_deleted=0
 AND (SELECT COUNT_BIG(*) FROM dbo.desktop_local_product_units u WITH(UPDLOCK,HOLDLOCK) WHERE u.product_id=p.id AND u.is_main=1)=1
 AND EXISTS(SELECT 1 FROM dbo.desktop_local_product_units u WITH(UPDLOCK,HOLDLOCK) WHERE u.product_id=p.id AND u.is_main=1 AND u.factor=1 AND u.label=p.unit)
 AND (SELECT COUNT_BIG(*) FROM dbo.product_barcodes b WITH(UPDLOCK,HOLDLOCK) WHERE b.product_id=p.id AND b.is_primary=1 AND b.is_active=1)=1
 AND NOT EXISTS(SELECT 1 FROM dbo.product_prices q WITH(UPDLOCK,HOLDLOCK) WHERE q.product_id=p.id AND q.price_type=N'sale' AND q.price_tier IS NULL AND q.currency_code=@documentCurrency)
) THEN 1 ELSE 0 END) missingPrice;`;
export function createDesktopFxSelectionStore({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function select({transaction,scope,customerId,productIds,currencySelection,documentDate}={}){
  const selected=desktopSaleCurrencySelection(currencySelection);if(!transaction||!scope||!id(customerId)||!Array.isArray(productIds)||productIds.length!==2||productIds.some(v=>!id(v))||new Set(productIds).size!==2)fail();const rows=new Map(),reserved=new Map();let customer;
  for(const productId of [...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
   if(await verifyScope({transaction,scope,customerId,productId})!==true)fail();const result=await new sql.Request(transaction).input('customerId',sql.NVarChar(20),customerId).input('productId',sql.NVarChar(20),productId).input('accountId',sql.NVarChar(20),selected.accountId).input('documentCurrency',sql.NVarChar(3),selected.documentCurrency).query(DESKTOP_FX_SELECTION_SQL);
   if(!Array.isArray(result?.recordsets)||result.recordsets.length!==2||result.recordsets.some(rs=>!Array.isArray(rs))||result.recordsets[0].length!==1||result.recordsets[1].length>1)fail();const c=result.recordsets[0][0];
   if(result.recordsets[1].length===0){
    if(c.id!==customerId||c.accountId!==selected.accountId||c.accountCustomerId!==customerId||c.accountEntityId!==c.entityId||c.accountSupplierId!==null||c.active!==true)fail();
    const diagnostic=await new sql.Request(transaction).input('productId',sql.NVarChar(20),productId).input('documentCurrency',sql.NVarChar(3),selected.documentCurrency).query(DESKTOP_FX_MISSING_PRICE_SQL);
    if(diagnostic?.recordset?.length===1&&diagnostic.recordset[0].missingPrice===1)throw Object.assign(Error('DESKTOP_SALE_PRICE_REQUIRED'),{code:'DESKTOP_SALE_PRICE_REQUIRED'});fail();
   }
   const {seriesUnitId,seriesFactorExact8,...p}=result.recordsets[1][0];if(customer&&JSON.stringify(c)!==JSON.stringify(customer))fail();customer=c;if(seriesUnitId!=null||seriesFactorExact8!=null){if(!id(seriesUnitId)||p.unit!=='ADET')fail();desktopSeriesFactor(seriesFactorExact8);p.seriesUnit={unitId:seriesUnitId,factorExact8:seriesFactorExact8};}rows.set(productId,p);
   const amounts=await new sql.Request(transaction).input('productId',sql.NVarChar(20),productId).query(DESKTOP_RESERVED_QUANTITY_SQL);if(amounts?.recordset?.length!==1||typeof amounts.recordset[0].reservedExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(amounts.recordset[0].reservedExact3))fail();reserved.set(productId,amounts.recordset[0].reservedExact3);
  }
  return {customer,products:productIds.map(id=>rows.get(id)),reservedExact3:productIds.map(id=>reserved.get(id)),companyRates:await readDesktopCompanyRates({sql,transaction,date:documentDate})};
 };
}
