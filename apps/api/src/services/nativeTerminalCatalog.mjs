import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {env} from '../config/env.js';
import {getCurrencyRates} from './currencyRateService.js';
import {getTerminalOperatorContext,calculateTerminalReferencePrice} from './terminalService.js';
import {nativeCashCodes,nativeError,positiveId,tokenCodec} from './nativeTerminalPolicy.mjs';
import {nativeCustomerRoutesEnabled,nativeCustomerScope} from './nativeCustomerRoutes.mjs';

export const nativeSigner=()=>tokenCodec(process.env.NATIVE_TERMINAL_SIGNING_KEY);
export const nativeRequestContext=async(terminalCode,actor)=>getTerminalOperatorContext(terminalCode,actor.id);
export async function nativeCustomers(){
 const pool=await getSqlPool();
 return (await pool.request().query("SELECT id,customer_code AS code,name,currency_code AS currency FROM dbo.customers WHERE is_active=1 AND is_deleted=0 AND customer_code IN(N'1-PEŞİN $',N'2-PEŞİN TL',N'3-PEŞİN €') ORDER BY customer_code")).recordset.map(c=>({...c,id:Number(c.id)})).filter(c=>nativeCashCodes[c.code]===c.currency);
}
export async function nativeBootstrap(query,actor){
 const operator=await nativeRequestContext(query.terminalCode,actor);
 const scope=nativeCustomerRoutesEnabled()?await nativeCustomerScope(operator):{customers:(await nativeCustomers()).map(c=>({...c,isCash:true,routeId:null,routeName:null}))};
 return {...scope,canChangeSalePrice:operator.canChangeSalePrice,employeeName:operator.employeeName,maxDiscount:5,saleEnabled:!env.sql.readOnly,source:'melisa',automaticSubmit:false,collectionMode:'none'};
}
export async function nativeSearch(query,actor,{catalog=false}={}){
 const operator=await nativeRequestContext(query.terminalCode,actor);
 const customers=nativeCustomerRoutesEnabled()?(await nativeCustomerScope(operator)).customers:await nativeCustomers();
 const customer=customers.find(c=>c.id===positiveId(query.customerId));if(!customer)nativeError('NATIVE_CUSTOMER_ROUTE_DENIED','Bu cari cihazın güncel cari kapsamında değil.',403);
 const pool=await getSqlPool(),sql=getSqlDriver(),q=String(query.q||'').trim(),barcode=String(query.barcode||'').trim();
 if(q.length>160||barcode.length>160)nativeError('NATIVE_SEARCH_INVALID','Arama çok uzun.',400);
 const afterId=Number(query.afterId||0),limit=catalog?Math.min(200,Number(query.limit||200)):30;
 if(!Number.isSafeInteger(afterId)||afterId<0||!Number.isSafeInteger(limit)||limit<1)nativeError('NATIVE_PAGE_INVALID','Sayfa geçersiz.',400);
 const pattern='%'+q.replace(/[\[%_]/g,c=>'['+c+']')+'%';
 const rows=(await pool.request().input('q',sql.NVarChar(160),q).input('pattern',sql.NVarChar(500),pattern).input('barcode',sql.NVarChar(160),barcode).input('after',sql.BigInt,afterId).input('limit',sql.Int,limit+1).query(`
 SELECT TOP(@limit) p.id,p.stock_code,p.name,p.category,p.sales_price,p.currency_code,p.current_stock_qty,
 (SELECT b.barcode FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_active=1 ORDER BY b.is_primary DESC,b.id FOR JSON PATH) AS barcodes
 FROM dbo.products p WHERE p.is_active=1 AND p.is_deleted=0
 AND ${pilotProductScopeSql('p.id')}
 AND ${catalog?'p.id>@after':"((@barcode<>N'' AND EXISTS(SELECT 1 FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_active=1 AND b.barcode=@barcode)) OR (@barcode=N'' AND (p.stock_code LIKE @pattern OR p.name LIKE @pattern OR EXISTS(SELECT 1 FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_active=1 AND b.barcode=@q))))"}
 ORDER BY ${catalog?'p.id':"CASE WHEN p.stock_code=@q THEN 0 ELSE 1 END,p.stock_code,p.id"};`)).recordset;
 const rateSet=await getCurrencyRates(),rateMap=new Map(rateSet.rates.filter(r=>r.defined&&r.rateToTry>0).map(r=>[r.currency,r.rateToTry]));
 if(!rateMap.has(customer.currency))nativeError('NATIVE_RATE_REQUIRED','Cari para biriminin ERP kuru eksik.');
 const signer=nativeSigner();
 const quotes=rows.slice(0,limit).map(p=>{
  if(!rateMap.has(p.currency_code)||!['TRY','USD','EUR'].includes(p.currency_code))nativeError('NATIVE_RATE_REQUIRED','Ürün para biriminin ERP kuru eksik.');
  const price=calculateTerminalReferencePrice({listPrice:Number(p.sales_price),sourceCurrency:p.currency_code,targetCurrency:customer.currency,documentCurrency:customer.currency,documentExchangeRate:rateMap.get(customer.currency),currencyRateMap:rateMap});
  const barcodes=JSON.parse(p.barcodes||'[]').map(b=>b.barcode),quotedAt=new Date().toISOString();
  const data={productId:Number(p.id),stockCode:p.stock_code,productName:p.name,category:String(p.category??''),barcode:barcode||barcodes[0]||'',barcodes,stock:String(p.current_stock_qty),unitPrice:price.toFixed(2),currency:customer.currency,exchangeRate:String(rateMap.get(customer.currency)),customerId:customer.id,quotedAt};
  return {...data,quoteToken:signer.issue('quote',{...data,actorId:Number(actor.id),terminalCode:query.terminalCode,originalCurrency:p.currency_code,originalPrice:String(p.sales_price)})};
 });
 return catalog?{quotes,nextId:rows.length>limit?quotes.at(-1).productId:null}:quotes;
}
