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
const businessSaleJournalPath=path=>typeof path==='string'&&/^\/api\/work-sales\/requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(path);
export function businessSaleReceiptRequestAllowed(method,path,user){return isBusinessSaleReceiptActor(user)&&method==='GET'&&(businessSaleJournalPath(path)||typeof path==='string'&&/^\/api\/work-sales\/invoices\/[1-9]\d{0,18}$/.test(path)&&BigInt(path.slice(path.lastIndexOf('/')+1))<=9223372036854775807n);}
export function businessSaleBrowserRequestAllowed(method,path){
 if(method==='GET'&&path==='/api/work-sales/context'||method==='POST'&&['/api/work-sales/selected-context','/api/work-sales/preview'].includes(path))return true;
 if(method==='POST'&&businessSaleOperationKind(path))return true;
 return method==='GET'&&(businessSaleJournalPath(path)||typeof path==='string'&&/^\/api\/work-sales\/invoices\/[1-9]\d{0,18}$/.test(path)&&BigInt(path.slice(path.lastIndexOf('/')+1))<=9223372036854775807n);
}

const saleId=v=>typeof v==='string'&&v.length<=19&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n&&BigInt(v).toString()===v;
const saleHash=v=>typeof v==='string'&&v.length===64&&/^[a-f0-9]{64}$/.test(v);
const saleUuid=v=>typeof v==='string'&&v.length===36&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const saleKeys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===names;
const saleSelection=v=>businessSalePreviewSelectionAllowed(v)&&saleId(v.customerId)&&saleId(v.customerAccountId)&&v.items.every(i=>saleId(i.productId)&&saleId(i.quoteId)&&i.quantityExact3.length===5&&/^[1-5]\.000$/.test(i.quantityExact3));
export function businessSaleOperationWitnessAllowed(w){
 return !!(saleKeys(w,'creationRequestId,currency,customerAccountId,customerId,id,operationOrigin,partyEntityId,revision,status')&&[w.id,w.customerId,w.customerAccountId,w.partyEntityId].every(saleId)&&saleUuid(w.creationRequestId)&&saleHash(w.revision)&&['TRY','USD','EUR'].includes(w.currency)&&w.operationOrigin==='CANONICAL_TEST_BUSINESS_SALE'&&['draft','finalized'].includes(w.status));
}
export function businessSaleOperationKind(path){
 if(path==='/api/work-sales/drafts')return 'sale_draft';
 if(typeof path!=='string')return null;const match=/^\/api\/work-sales\/drafts\/([1-9]\d{0,18})\/(finalize|cancel)$/.exec(path);
 return match&&match[0]===path&&saleId(match[1])?'sale_'+match[2]:null;
}
export function businessSaleOperationInputAllowed(path,body){
 const operation=businessSaleOperationKind(path);
 if(!operation||!saleUuid(body?.requestId)||!saleHash(body.expectedRevision))return false;
 if(operation==='sale_draft'){
  if(!saleKeys(body,'currency,customerAccountId,customerId,documentDate,expectedRevision,items,previewHash,requestId')||!saleHash(body.previewHash))return false;
  const {requestId,expectedRevision,previewHash,...selection}=body;return saleSelection(selection);
 }
 return !!(saleKeys(body,operation==='sale_cancel'?'expectedRevision,reason,requestId':'expectedRevision,requestId')&&(operation!=='sale_cancel'||typeof body.reason==='string'&&body.reason.trim()===body.reason&&body.reason.length>=5&&body.reason.length<=500));
}
export function businessSaleOperationRequestAllowed(method,path,user){
 const operation=businessSaleOperationKind(path),permission={sale_draft:'sales.create',sale_finalize:'sales.finalize',sale_cancel:'sales.cancel'}[operation];
 return !!(method==='POST'&&permission&&isBusinessSalePreviewActor(user)&&isBusinessSaleReceiptActor(user)&&user.permissions.includes(permission));
}
export function businessSaleOperationAvailable(context,user,operation){
 const key={sale_draft:'canCreate',sale_finalize:'canFinalize',sale_cancel:'canCancel'}[operation];
 // Public capability is only an availability hint. The session subsequently
 // obtains fresh native context; the API owns profile and transaction authority.
 return !!(key&&typeof context?.capabilities?.canCreate==='boolean'&&businessSalePreviewAvailable({...context,capabilities:{...context?.capabilities,canCreate:true}},user)&&context?.capabilities?.[key]===true&&businessSaleOperationRequestAllowed('POST',operation==='sale_draft'?'/api/work-sales/drafts':'/api/work-sales/drafts/1/'+(operation==='sale_finalize'?'finalize':'cancel'),user));
}

export function businessSaleNativeOperationPreviewAllowed(result,selection){
 if(!saleSelection(selection))return false;
 const c=result?.context,p=result?.preview,customer=c?.scope?.customer,rate=c?.rate,settlement=p?.settlement;
 const amount=(v,scale)=>typeof v==='string'&&new RegExp('^(?:0|[1-9]\\d{0,13})\\.\\d{'+scale+'}(?![\\s\\S])').test(v),scaled=v=>BigInt(v.replace('.',''));
 if(c?.meta?.schemaVersion!=='melisa-work-trade.v1'||c.meta.source!=='canonical-business-test'||c.meta.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||c.meta.date!==selection.documentDate||!saleHash(c.revision)||c.capabilities?.canCreate!==true||typeof c.capabilities.canFinalize!=='boolean'||typeof c.capabilities.canCancel!=='boolean'||c.capabilities.canCollect!==false||c.capabilities.canCancelCollection!==false||c.scope?.synthetic!==false||c.scope.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||customer?.id!==selection.customerId||customer.accountId!==selection.customerAccountId||customer.currency!==selection.currency||customer.writeEligible!==true||!Array.isArray(c.scope.accounts)||c.scope.accounts.length!==0||!Array.isArray(c.scope.products)||c.scope.products.length!==selection.items.length||JSON.stringify(c.supportedCurrencies)!==JSON.stringify([selection.currency])||c.limits?.maxItems!==2||c.limits.maxQuantityPerLine!==5||c.limits.maxInvoiceAmountExact4!=='500.0000'||c.limits.maxAmountTryExact4!=='500.0000')return false;
 if(!p||JSON.stringify(p.selection)!==JSON.stringify(selection)||p.scopeRevision!==c.revision||!saleHash(p.previewHash)||p.writable!==true||p.currency!==selection.currency||!Array.isArray(p.items)||p.items.length!==selection.items.length||!['subtotalExact4','grandTotalExact4','amountTryExact4'].every(k=>amount(p[k],4)))return false;
 if(rate?.currency!==selection.currency||!amount(rate.rateExact8,8)||scaled(rate.rateExact8)<=0n||typeof rate.rateDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(rate.rateDate)||!Number.isFinite(Date.parse(rate.rateDate))||new Date(rate.rateDate).toISOString().slice(0,10)!==rate.rateDate||rate.rateDate>selection.documentDate||selection.currency==='TRY'&&rate.rateExact8!=='1.00000000'||settlement?.accountId!==selection.customerAccountId||settlement.documentCurrency!==selection.currency||settlement.accountCurrency!==selection.currency||settlement.documentRateExact8!==rate.rateExact8||settlement.accountRateExact8!==rate.rateExact8)return false;
 let total=0n;
 for(let n=0;n<selection.items.length;n++){
  const s=selection.items[n],product=c.scope.products[n],item=p.items[n],quote=product?.prices?.[0],quantity=BigInt(s.quantityExact3.replace('.',''))/1000n;
  if(product?.id!==s.productId||product.writeEligible!==true||typeof product.stockCode!=='string'||typeof product.name!=='string'||product.unit?.label!=='ADET'||product.unit.factorExact8!=='1.00000000'||!amount(product.stockQuantityExact3,3)||scaled(product.stockQuantityExact3)<quantity*1000n||!Array.isArray(product.prices)||product.prices.length!==1||quote?.quoteId!==s.quoteId||quote.currency!==selection.currency||!amount(quote.unitPriceExact8,8)||scaled(quote.unitPriceExact8)<=0n||item?.productId!==s.productId||item.quoteId!==s.quoteId||item.quantityExact3!==s.quantityExact3||item.stockCode!==product.stockCode||item.name!==product.name||item.unitPriceExact8!==quote.unitPriceExact8||item.unit?.label!=='ADET'||item.unit.factorExact8!=='1.00000000'||!saleId(item.unit.sourceId)||!amount(item.unitPriceExact4,4)||!amount(item.lineTotalExact4,4))return false;
  const price4=(scaled(quote.unitPriceExact8)+5000n)/10000n,line4=price4*quantity;
  if(scaled(item.unitPriceExact4)!==price4||scaled(item.lineTotalExact4)!==line4)return false;total+=line4;
 }
 return total>0n&&total<=5000000n&&p.subtotalExact4===p.grandTotalExact4&&scaled(p.grandTotalExact4)===total&&scaled(p.amountTryExact4)===(total*scaled(rate.rateExact8)+50000000n)/100000000n&&scaled(p.amountTryExact4)>0n&&scaled(p.amountTryExact4)<=5000000n;
}
