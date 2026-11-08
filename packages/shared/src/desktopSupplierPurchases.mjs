import {desktopSupplierCardId as id} from './desktopSupplierCard.mjs';
const keys=(v,k)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===k.length&&k.every(x=>{const d=Object.getOwnPropertyDescriptor(v,x);return d?.enumerable&&Object.hasOwn(d,'value');});
const curr=x=>['TRY','USD','EUR'].includes(x);
const date=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const [y,m,d]=x.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));return y>=1900&&v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d;};
const money=x=>typeof x==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(x);
const balance=x=>typeof x==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(x)&&x!=='-0.00000000';
const row=(r,c)=>keys(r,['invoiceId','documentNo','documentDate','status','documentCurrency','totalExact4','accountCurrency','accountAmountExact4'])&&id(r.invoiceId)&&typeof r.documentNo==='string'&&r.documentNo.trim().length>0&&r.documentNo.length<=60&&!/[\u0000-\u001f\u007f]/.test(r.documentNo)&&date(r.documentDate)&&['finalized','cancelled'].includes(r.status)&&curr(r.documentCurrency)&&r.accountCurrency===c&&money(r.totalExact4)&&money(r.accountAmountExact4);
export const desktopSupplierPurchasesPage=p=>Number.isInteger(p)&&p>=1&&p<=100000;
export function isDesktopSupplierPurchases(v,{supplierId,accountId,page}={}){try{
 if(!keys(v,['supplierId','accountId','currency','balanceExact8','page','hasNext','totalCount','hasUnassignedPurchases','lastPurchase','rows'])||!id(supplierId)||!id(accountId)||v.supplierId!==supplierId||v.accountId!==accountId||!curr(v.currency)||!balance(v.balanceExact8)||!desktopSupplierPurchasesPage(page)||v.page!==page||typeof v.hasNext!=='boolean'||typeof v.hasUnassignedPurchases!=='boolean'||typeof v.totalCount!=='string'||!/^(0|[1-9]\d{0,18})$/.test(v.totalCount)||BigInt(v.totalCount)>9223372036854775807n||!Array.isArray(v.rows)||Reflect.ownKeys(v.rows).length!==v.rows.length+1||v.rows.length>10)return false;
 let total=BigInt(v.totalCount),offset=BigInt((page-1)*10),expected=total>offset?(total-offset>10n?10n:total-offset):0n;if(BigInt(v.rows.length)!==expected||v.hasNext!==(total>offset+10n)||(total===0n?v.lastPurchase!==null:!row(v.lastPurchase,v.currency)))return false;
 let prev=null;for(let i=0;i<v.rows.length;i++){let d=Object.getOwnPropertyDescriptor(v.rows,String(i)),r=d?.value;if(!d?.enumerable||!Object.hasOwn(d,'value')||!row(r,v.currency)||prev&&(r.documentDate>prev.documentDate||r.documentDate===prev.documentDate&&BigInt(r.invoiceId)>=BigInt(prev.invoiceId)))return false;prev=r;}
 return page!==1||total===0n||JSON.stringify(v.lastPurchase)===JSON.stringify(v.rows[0]);
 }catch{return false;}}
