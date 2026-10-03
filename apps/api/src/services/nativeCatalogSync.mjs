import {getSqlPool} from '../config/database.js';
import {getCurrencyRates} from './currencyRateService.js';
import {calculateTerminalReferencePrice} from './terminalService.js';
import {nativeCustomers,nativeRequestContext,nativeSigner} from './nativeTerminalCatalog.mjs';
import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {createCatalogFeed} from './nativeCatalogFeed.mjs';
const feed=createCatalogFeed({
 async load(){
  const pool=await getSqlPool();
  const rows=(await pool.request().query("SELECT p.id,p.stock_code,p.name,p.category,p.sales_price,p.currency_code,p.current_stock_qty, (SELECT b.barcode FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_active=1 ORDER BY b.is_primary DESC,b.id FOR JSON PATH) AS barcodes FROM dbo.products p WHERE p.is_active=1 AND p.is_deleted=0 AND "+pilotProductScopeSql('p.id')+" ORDER BY p.id")).recordset.map(p=>({...p,id:Number(p.id)}));
  const rates=(await getCurrencyRates()).rates.filter(r=>r.defined&&r.rateToTry>0).map(r=>({currency:r.currency,rateToTry:r.rateToTry})).sort((a,b)=>a.currency.localeCompare(b.currency));
  return {rows,rates,customers:await nativeCustomers(),priceScope:'currency-v1'};
 },
 quote(p,customer,rates,actor,terminalCode){
  const rateMap=new Map(rates.map(r=>[r.currency,r.rateToTry]));
  if(!rateMap.has(customer.currency)||!rateMap.has(p.currency_code))throw Error('Missing rate');
  const price=calculateTerminalReferencePrice({listPrice:Number(p.sales_price),sourceCurrency:p.currency_code,targetCurrency:customer.currency,documentCurrency:customer.currency,documentExchangeRate:rateMap.get(customer.currency),currencyRateMap:rateMap});
  const barcodes=JSON.parse(p.barcodes||'[]').map(b=>b.barcode),data={productId:p.id,stockCode:p.stock_code,productName:p.name,category:String(p.category??''),barcode:barcodes[0]||'',barcodes,stock:String(p.current_stock_qty),unitPrice:price.toFixed(2),currency:customer.currency,exchangeRate:String(rateMap.get(customer.currency)),customerId:customer.id,priceScope:'currency-v1',quotedAt:new Date().toISOString()};
  return {...data,quoteToken:nativeSigner().issue('quote',{...data,actorId:Number(actor.id),terminalCode,originalCurrency:p.currency_code,originalPrice:String(p.sales_price)})};
 }
});
export async function nativeCatalogVersion(query,actor){await nativeRequestContext(query.terminalCode,actor);return feed.version(query,actor);}
export async function nativeCatalogPage(query,actor){await nativeRequestContext(query.terminalCode,actor);return feed.page(query,actor);}
