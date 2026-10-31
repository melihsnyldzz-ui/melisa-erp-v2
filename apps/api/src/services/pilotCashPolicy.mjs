import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {getSqlDriver} from '../config/database.js';
import {isDailyWebCustomerScope,assertDailyWebCustomer} from './dailyWebPolicy.mjs';
import {hasNativeCustomerAccess} from './nativeCustomerRoutes.mjs';
import {isWorkNightProduct} from './workNightScope.mjs';
import {isIsolatedCopyCustomer,isIsolatedCopyProduct} from './isolatedOperationCopyScope.mjs';
import {getCanonicalBusinessSaleTransaction} from './canonicalBusinessSessionContext.mjs';

export const pilotCashCodes = Object.freeze({'1-PEŞİN $':'USD','3-PEŞİN €':'EUR','2-PEŞİN TL':'TRY'});
export const pilotCashOnly = () => process.env.MELISA_PILOT_RUNTIME === 'true';
export const pilotCashCustomerOnly = () => pilotCashOnly() && !isDailyWebCustomerScope();
export const pilotCashSql = "N'1-PEŞİN $',N'3-PEŞİN €',N'2-PEŞİN TL'";
function reject(code,message){throw Object.assign(new Error(message),{code,statusCode:409});}

export async function assertPilotCashCustomer(request,customerId,documentCurrency){
 if(!pilotCashOnly())return;
 const sql=getSqlDriver();
 const row=(await request.input('pilotCashId',sql.BigInt,customerId).query('SELECT customer_code,currency_code,is_active,is_deleted FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@pilotCashId')).recordset[0];
 if(isIsolatedCopyCustomer(customerId,documentCurrency,request.parent)){
  if(!row||!row.is_active||row.is_deleted||row.currency_code!==documentCurrency)reject('PILOT_CASH_CURRENCY_MISMATCH','Doğrulanmış cari veya para birimi değişmiş.');
  return;
 }
 if(hasNativeCustomerAccess(customerId,documentCurrency)){
  if(!row||!row.is_active||row.is_deleted||row.currency_code!==documentCurrency)reject('PILOT_CASH_CURRENCY_MISMATCH','Doğrulanmış native cari veya para birimi değişmiş.');
  return;
 }
 if(!pilotCashCustomerOnly()){assertDailyWebCustomer(row,documentCurrency);return;}
 if(!row||!row.is_active||row.is_deleted||!Object.hasOwn(pilotCashCodes,row.customer_code))reject('PILOT_CASH_CUSTOMER_REQUIRED','Canlı pilotta yalnız 1-PEŞİN $, 3-PEŞİN € ve 2-PEŞİN TL kullanılabilir.');
 if(pilotCashCodes[row.customer_code]!==row.currency_code||row.currency_code!==documentCurrency)reject('PILOT_CASH_CURRENCY_MISMATCH','Fiş para birimi seçilen peşin cariyle aynı olmalıdır.');
}

export async function assertPilotSaleProducts(requestFactory,items,{consume=false,previousItems=[],allowNegativeStock=false}={}){
 if(!pilotCashOnly())return;
 if(!Array.isArray(items)||items.length===0)reject('PILOT_LINE_INVALID','Satış için en az bir geçerli ürün gereklidir.');
 const sql=getSqlDriver(),quantities=new Map(),previous=new Map();
 for(const item of previousItems)previous.set(Number(item.productId),(previous.get(Number(item.productId))||0)+Number(item.quantity));
 for(const item of items){
  if(!Number.isSafeInteger(Number(item.quantity))||Number(item.quantity)<=0||!Number.isFinite(Number(item.unitPrice))||Number(item.unitPrice)<=0)reject('PILOT_LINE_INVALID','Pilot satış miktarı pozitif tam adet, fiyatı pozitif olmalıdır.');
  quantities.set(Number(item.productId),(quantities.get(Number(item.productId))||0)+Number(item.quantity));
 }
 for(const [productId,quantity] of [...quantities].sort((a,b)=>a[0]-b[0])){
  const request=requestFactory(),canonical=getCanonicalBusinessSaleTransaction(request.parent),canonicalProduct=canonical?.products.find(p=>p.productId===String(productId));
  if(canonical&&(items.length!==canonical.products.length||quantities.size!==items.length||!canonicalProduct||Number(canonicalProduct.quantityExact3)!==quantity||items.filter(i=>Number(i.productId)===productId).some(i=>Number(i.unitPrice).toFixed(4)!==canonicalProduct.unitPriceExact4)))reject('PILOT_PRODUCT_OUT_OF_SCOPE','Ürün native satış işlem kapsamıyla eşleşmiyor.');
  const night=!!canonicalProduct||isWorkNightProduct(productId,request.parent)||isIsolatedCopyProduct(productId,request.parent);
  const p=(await request.input('pilotProductId',sql.BigInt,productId).query(`SELECT p.current_stock_qty,p.unit FROM dbo.products p WITH(UPDLOCK,HOLDLOCK)
   WHERE p.id=@pilotProductId AND p.is_active=1 AND p.is_deleted=0 AND ${night?'p.id=@pilotProductId':pilotProductScopeSql('p.id')}`)).recordset[0];
  if(!p||p.unit!=='ADET')reject('PILOT_PRODUCT_OUT_OF_SCOPE','Ürün doğrulanmış pilot satış kapsamında değil.');
  if(night&&(p.current_stock_qty==null||!Number.isFinite(Number(p.current_stock_qty))))reject('PILOT_STOCK_UNKNOWN','Doğrulanmış stok miktarı gerekli.');
  if(consume&&(canonical||!allowNegativeStock)&&Number(p.current_stock_qty)+(canonical?0:(previous.get(productId)||0))<quantity)reject('PILOT_STOCK_INSUFFICIENT','Melisa stoğu yetersiz; satış kesinleştirilmedi.');
 }
}
