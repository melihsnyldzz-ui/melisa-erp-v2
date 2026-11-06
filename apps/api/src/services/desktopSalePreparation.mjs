// Source-only first-sale preparation. Inputs named "locked" must come from a
// separately verified target transaction; this module grants no authority.
import {createHash} from 'node:crypto';
import {isCashCustomerCode} from './customerService.js';
const fail=()=>{throw Error('DESKTOP_SALE_SELECTION_INVALID');};
const hash=v=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split('-').map(Number);if(y<1900||y>9999)return false;const x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;}
function decimal(v,scale,{positive=false,signed=false}={}){if(typeof v!=='string'||!new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,13})\\.\\d{${scale}}$`).test(v))fail();const neg=v.startsWith('-'),n=BigInt(v.replace('-','').replace('.',''));if(n>9007199254740991n||(positive&&n===0n))fail();return neg?-n:n;}
function fixed(n,s){const neg=n<0n;if(neg)n=-n;const t=n.toString().padStart(s+1,'0');return (neg?'-':'')+t.slice(0,-s)+'.'+t.slice(-s);}
export function desktopSaleSelectionRevision(locked){return hash({customer:locked?.customer,product:locked?.product});}
export function prepareDesktopSale(request,locked){
 const keys=['requestId','customerId','productId','quantityExact3','documentDate','expectedRevision'];
 if(!request||Object.keys(request).sort().join(',')!==keys.sort().join(',')||!uuid(request.requestId)||!id(request.customerId)||!id(request.productId)||!date(request.documentDate)||!/^[0-9a-f]{64}$/.test(request.expectedRevision)||!locked||desktopSaleSelectionRevision(locked)!==request.expectedRevision)fail();
 const c=locked.customer,p=locked.product;
 if(!c||!p||c.id!==request.customerId||p.id!==request.productId||!id(c.accountId)||!id(c.entityId)||!id(p.unitId)||!id(p.priceId)||!text(c.customerCode,50)||isCashCustomerCode(c.customerCode)||c.accountCustomerId!==c.id||c.accountEntityId!==c.entityId||c.accountCurrency!=='TRY'||c.accountSupplierId!==null||p.unitProductId!==p.id||p.priceProductId!==p.id||p.priceUnitId!==p.unitId||p.priceType!=='sale'||p.barcodeProductId!==p.id||c.active!==true||p.active!==true||c.currency!=='TRY'||p.currency!=='TRY'||p.unitFactorExact8!=='1.00000000'||p.mainUnit!==true||!text(p.stockCode,50)||!text(p.name,250)||!text(p.barcode,80)||!text(p.unit,20))fail();
 const quantity=decimal(request.quantityExact3,3,{positive:true}),stock=decimal(p.stockExact3,3,{signed:true}),price=decimal(p.priceExact4,4),cost=decimal(p.averageCostTryExact4,4);
 const customerBalance=decimal(c.balanceExact4,4,{signed:true}),accountBalance=decimal(c.accountBalanceExact8,8,{signed:true});
 if(customerBalance*10000n!==accountBalance)fail();
 const units=(quantity*price+500n)/1000n;if(units>9007199254740991n)fail();
 // Native invoice normalization uses JS Number and Tedious decimal(18,4).
 // Admit only values whose binary path produces the same exact result.
 const nativeTotal=Number(request.quantityExact3)*Number(p.priceExact4),driver=Math.round(Math.abs(nativeTotal*10000));
 if(!Number.isSafeInteger(driver)||BigInt(driver)!==units||Math.round(Number(request.quantityExact3)*1000)!==Number(quantity)||Math.round(Number(p.priceExact4)*10000)!==Number(price)||Math.round(Number(p.averageCostTryExact4)*10000)!==Number(cost))fail();
 const stockAfter=stock-quantity,customerAfter=customerBalance+units,accountAfter=accountBalance+units*10000n;
 if([stockAfter,customerAfter,accountAfter].some(n=>n>9007199254740991n||n< -9007199254740991n))fail();
 const totalExact4=fixed(units,4),stockAfterExact3=fixed(stockAfter,3);
 const invoice={documentNo:'DS-'+request.requestId.slice(0,25),documentDate:request.documentDate,customerId:Number(c.id),customerCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,discountRate:0,items:[{productId:Number(p.id),stockCode:p.stockCode,productName:p.name,barcode:p.barcode,quantity:Number(request.quantityExact3),currency:'TRY',unitPrice:Number(p.priceExact4),averageCostTry:Number(p.averageCostTryExact4)}]};
 return Object.freeze({invoice,expected:Object.freeze({customerId:c.id,entityId:c.entityId,accountId:c.accountId,productId:p.id,unitId:p.unitId,priceId:p.priceId,quantityExact3:request.quantityExact3,documentDate:request.documentDate,unitPriceExact4:p.priceExact4,totalExact4,stockBeforeExact3:p.stockExact3,stockAfterExact3,customerBeforeExact4:c.balanceExact4,customerAfterExact4:fixed(customerAfter,4),accountBeforeExact8:c.accountBalanceExact8,accountAfterExact8:fixed(accountAfter,8),currency:'TRY'})});
}
export const DESKTOP_SALE_PREPARATION_LIMITS=Object.freeze({sourceOnly:true,initialSyntheticAcceptanceCurrency:'TRY',multiCurrencySalesImplemented:false,requiresLockedActualSelection:true,requiresDesktopNativeInvoiceScope:true,requiresTransactionAuthority:true,requiresJournalAndReadback:true,realSqlVerified:false,fullErpReady:false});
