import {DESKTOP_SALE_SELECTION_SQL} from './desktopSaleSelectionStore.mjs';
import {DESKTOP_RESERVED_QUANTITY_SQL} from './desktopTwoItemLockedSelection.mjs';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
import {desktopSeriesFactor} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
import {readDesktopCompanyRates} from './desktopCompanyRateRead.mjs';
const fail=()=>{throw Error('DESKTOP_FX_SELECTION_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
function selectionSql(){let text=DESKTOP_SALE_SELECTION_SQL;for(const [old,next] of [["AND a.currency_code=N'TRY'",'AND a.id=TRY_CONVERT(bigint,@accountId)'],["q.currency_code=N'TRY'",'q.currency_code=@documentCurrency AND q.price_tier IS NULL'],['WHERE c.id=TRY_CONVERT(bigint,@customerId);',"WHERE c.id=TRY_CONVERT(bigint,@customerId) AND EXISTS(SELECT 1 FROM dbo.party_entities e WITH(UPDLOCK,HOLDLOCK) WHERE e.id=c.party_entity_id AND e.role=N'customer');"]]){if(text.split(old).length!==2)fail();text=text.replace(old,next);}return text;}
export const DESKTOP_FX_SELECTION_SQL=selectionSql();
export function createDesktopFxSelectionStore({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function select({transaction,scope,customerId,productIds,currencySelection,documentDate}={}){
  const selected=desktopSaleCurrencySelection(currencySelection);if(!transaction||!scope||!id(customerId)||!Array.isArray(productIds)||productIds.length!==2||productIds.some(v=>!id(v))||new Set(productIds).size!==2)fail();const rows=new Map(),reserved=new Map();let customer;
  for(const productId of [...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
   if(await verifyScope({transaction,scope,customerId,productId})!==true)fail();const result=await new sql.Request(transaction).input('customerId',sql.NVarChar(20),customerId).input('productId',sql.NVarChar(20),productId).input('accountId',sql.NVarChar(20),selected.accountId).input('documentCurrency',sql.NVarChar(3),selected.documentCurrency).query(DESKTOP_FX_SELECTION_SQL);
   if(!Array.isArray(result?.recordsets)||result.recordsets.length!==2||result.recordsets.some(rs=>!Array.isArray(rs)||rs.length!==1))fail();const c=result.recordsets[0][0],{seriesUnitId,seriesFactorExact8,...p}=result.recordsets[1][0];if(customer&&JSON.stringify(c)!==JSON.stringify(customer))fail();customer=c;if(seriesUnitId!=null||seriesFactorExact8!=null){if(!id(seriesUnitId)||p.unit!=='ADET')fail();desktopSeriesFactor(seriesFactorExact8);p.seriesUnit={unitId:seriesUnitId,factorExact8:seriesFactorExact8};}rows.set(productId,p);
   const amounts=await new sql.Request(transaction).input('productId',sql.NVarChar(20),productId).query(DESKTOP_RESERVED_QUANTITY_SQL);if(amounts?.recordset?.length!==1||typeof amounts.recordset[0].reservedExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(amounts.recordset[0].reservedExact3))fail();reserved.set(productId,amounts.recordset[0].reservedExact3);
  }
  return {customer,products:productIds.map(id=>rows.get(id)),reservedExact3:productIds.map(id=>reserved.get(id)),companyRates:await readDesktopCompanyRates({sql,transaction,date:documentDate})};
 };
}
