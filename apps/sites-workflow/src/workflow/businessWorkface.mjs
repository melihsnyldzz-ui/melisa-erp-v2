import {businessSaleReadPathAllowed} from '../../../api/src/services/canonicalBusinessSaleReadModel.mjs';
import {partyHistoryPathAllowed} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';
export const businessWorkfaceId='ERP-5244-REALDATA-20261027';
export function isBusinessWorkfaceTarget({location,apiBase,profile}){
 return profile===businessWorkfaceId&&apiBase==='http://127.0.0.1:4144'&&location?.protocol==='http:'&&location.port==='5244'&&['127.0.0.1','localhost','192.168.1.46','100.87.188.3'].includes(location.hostname)&&location.origin===`http://${location.hostname}:5244`;
}
// First real-data candidate is deliberately read-only except normal session
// lifecycle. Existing upstream SQL/API permissions remain the authority.
export function businessWorkfaceRequestAllowed(method,path){
 if(typeof path!=='string'||!path.startsWith('/api/')||path.includes('#')||path.includes('\\')||path.startsWith('//'))return false;
 const pathname=path.split('?')[0];if(pathname.includes('%')||pathname.includes('/../')||pathname.endsWith('/..'))return false;
 if(method==='POST')return /^\/api\/auth\/(?:login|refresh|logout|session-confirm)$/.test(pathname)&&path===pathname;
 if(!['GET','HEAD','OPTIONS'].includes(method))return false;
 if(pathname==='/api/business-sales/selection')return ['GET','HEAD'].includes(method)&&businessSaleReadPathAllowed(path);
 if(pathname.startsWith('/api/business-party-history/'))return ['GET','HEAD'].includes(method)&&partyHistoryPathAllowed(path);
 return /^\/api\/(?:auth\/me|catalog\/products(?:\/[1-9]\d*(?:\/photo)?)?|customer-cards|supplier-cards|(?:customers|suppliers)\/[1-9]\d*\/card|products\/[1-9]\d*\/purchase-reference|home\/summary|work-system\/summary|work-reports(?:\/(?:context|export))?)$/.test(pathname);
}

// This is only the authenticated, read-only native preview seam. It never
// admits a draft, finalize, cancel, collection or a client-selected actor.
export const isBusinessSalePreviewActor=user=>String(user?.id)==='17'&&user.username==='unified-semih-test'&&String(user.role?.id)==='17'&&user.role.code==='unified_test_semih'&&user.isActive!==false&&user.isAdmin!==true&&user.testAdminSession!==true&&user.nativeTerminalSession!==true&&Array.isArray(user.permissions)&&['sales.view','sales.create','customer.view','product.view'].every(p=>user.permissions.includes(p));
export function businessSalePreviewRequestAllowed(method,path,user){
 return isBusinessSalePreviewActor(user)&&(method==='GET'&&path==='/api/work-sales/context'||method==='POST'&&['/api/work-sales/selected-context','/api/work-sales/preview'].includes(path));
}
export function businessSalePreviewSelectionAllowed(value){
 const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
 const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===names;
 return !!(keys(value,'currency,customerAccountId,customerId,documentDate,items')&&id(value.customerId)&&id(value.customerAccountId)&&['TRY','USD','EUR'].includes(value.currency)&&typeof value.documentDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.documentDate)&&Number.isFinite(Date.parse(value.documentDate))&&new Date(value.documentDate).toISOString().slice(0,10)===value.documentDate&&Array.isArray(value.items)&&value.items.length>=1&&value.items.length<=2&&new Set(value.items.map(i=>i?.productId)).size===value.items.length&&value.items.every(i=>keys(i,'productId,quantityExact3,quoteId')&&id(i.productId)&&id(i.quoteId)&&typeof i.quantityExact3==='string'&&/^[1-5]\.000$/.test(i.quantityExact3)));
}
export function businessSalePreviewAvailable(context,user){
 const c=context,cap=c?.capabilities,s=c?.scope,l=c?.limits;
 return !!(isBusinessSalePreviewActor(user)&&c?.meta?.schemaVersion==='melisa-work-trade.v1'&&c.meta.source==='canonical-business-test'&&c.meta.operationOrigin==='CANONICAL_TEST_BUSINESS_SALE'&&c.revision==='0'.repeat(64)&&cap?.canCreate===true&&typeof cap.canFinalize==='boolean'&&typeof cap.canCancel==='boolean'&&cap.canCollect===false&&cap.canCancelCollection===false&&s?.synthetic===false&&s.operationOrigin==='CANONICAL_TEST_BUSINESS_SALE'&&s.customer===null&&Array.isArray(s.products)&&s.products.length===0&&Array.isArray(s.accounts)&&s.accounts.length===0&&JSON.stringify(c.supportedCurrencies)==='["TRY","USD","EUR"]'&&l?.maxItems===2&&l.maxQuantityPerLine===5&&l.maxInvoiceAmountExact4==='500.0000'&&l.maxAmountTryExact4==='500.0000');
}

// Separate authenticated BFF dispatch; the generic read gate stays closed.
export const isBusinessSaleReceiptActor=user=>String(user?.id)==='17'&&user.username==='unified-semih-test'&&String(user.role?.id)==='17'&&user.role.code==='unified_test_semih'&&user.isActive!==false&&user.isAdmin!==true&&user.testAdminSession!==true&&user.nativeTerminalSession!==true&&Array.isArray(user.permissions)&&['sales.view','customer.view','finance.view'].every(p=>user.permissions.includes(p));
export function businessSaleReceiptRequestAllowed(method,path,user){return isBusinessSaleReceiptActor(user)&&method==='GET'&&typeof path==='string'&&/^\/api\/work-sales\/invoices\/[1-9]\d{0,18}$/.test(path)&&BigInt(path.slice(path.lastIndexOf('/')+1))<=9223372036854775807n;}
export function businessSaleBrowserRequestAllowed(method,path){
 if(method==='GET'&&path==='/api/work-sales/context'||method==='POST'&&['/api/work-sales/selected-context','/api/work-sales/preview'].includes(path))return true;
 return method==='GET'&&typeof path==='string'&&/^\/api\/work-sales\/invoices\/[1-9]\d{0,18}$/.test(path)&&BigInt(path.slice(path.lastIndexOf('/')+1))<=9223372036854775807n;
}
