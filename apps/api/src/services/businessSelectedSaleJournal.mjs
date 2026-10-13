import {assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,isolatedCopyHash,isolatedCopyJSON,isolatedCopyUUID} from './isolatedOperationCopyContext.mjs';
import {workError,workId,workDate,workScaled,workExact,workHash,workRevision} from './workSalesModel.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {getBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';

const fail=(code='WORK_SELECTED_SALE_DRIFT',status=409)=>{throw workError(code,'Satışın oluşturma kaydı doğrulanamadı.',status);};
const check=(value,code,status)=>{if(!value)fail(code,status);};
const equal=(a,b)=>isolatedCopyJSON(a)===isolatedCopyJSON(b);
const parse=text=>{check(typeof text==='string');try{return JSON.parse(text);}catch{fail();}};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const fields=(a,b,keys)=>keys.every(key=>a?.[key]!==undefined&&a[key]===b?.[key]);
const headerKeys=['id','documentNo','documentDate','customerId','currency','subtotalExact4','grandTotalExact4','amountTryExact4'];
const lineKeys=['productId','stockCode','name','quantityExact3','unitPriceExact4','lineTotalExact4'];

/**
 * Derive immutable SOURCE selection only from an internal native joined bundle:
 * {link, journal, invoice, items}. The caller must load link and journal with
 * l.request_id=j.request_id in its proven native transaction, retaining raw JSON
 * and exact decimal strings. This utility does not authenticate a SQL connection
 * or authorize writes. Never route request-body JSON to this argument.
 * Future selected-sale previews must include selection.customerAccountId,
 * sourceSelectionHash, policyHash, settlement and each item's chosen barcode.
 * Historical previews without that format intentionally fail closed.
 * The immutable creation journal, not an arbitrary link preview, is evidence.
 */
export function deriveBusinessSelectedSaleJournal(copy,actor,record,{priceHistory=null}={}){
 assertIsolatedCopyContext(copy);
 check(copy.target.database===BUSINESS_COPY_DATABASE,'WORK_SELECTED_SALE_FORBIDDEN',403);
 if(!record)fail('WORK_INVOICE_NOT_FOUND',404);
 const {link:l,journal:j,invoice:h,items:lines}=record;
 check(l&&j&&h&&Array.isArray(lines),'WORK_INVOICE_NOT_FOUND',404);
 const actorId=String(actor?.id);
 check(copy.actors.some(a=>a.id===actorId)&&String(j.actor_id)===actorId&&String(l.actor_id)===actorId,'WORK_SELECTED_SALE_FORBIDDEN',403);
 check(j.copy_id===copy.copyId,'WORK_INVOICE_NOT_FOUND',404);
 try{
  check(j.operation==='sale_draft'&&isolatedCopyUUID(j.request_id)&&l.request_id===j.request_id);
  workId(h.id);check(String(l.invoice_id)===h.id);
  const payload=parse(j.payload_json),response=parse(j.response_json),p=parse(l.preview_json),created=response?.invoice;
  check(j.payload_json===isolatedCopyJSON(payload)&&j.payload_hash===isolatedCopyHash(payload)&&j.response_json===isolatedCopyJSON(response));
  check(payload.copyId===copy.copyId&&payload.sealHash===copy.sealHash&&payload.operationOrigin===copy.operationOrigin&&payload.operation==='sale_draft'&&payload.actorId===actorId&&payload.requestId===j.request_id);
  check(p.copyId===copy.copyId&&p.sealHash===copy.sealHash&&p.operationOrigin===copy.operationOrigin);
  check(created?.id===h.id&&created.status==='draft'&&response.requestId===j.request_id&&response.replayed===false);
  const s=p.selection;
  const pricing=p.pricing?getBusinessProductPriceSaleDTO(copy,priceHistory):null;
  if(p.pricing){
   check(pricing&&pricing.proof.mode==='HISTORY'&&pricing.proof.invoiceId===h.id,'WORK_SELECTED_SALE_PRICING_HISTORY_REQUIRED');
   check(equal(p.pricing,{pricingJson:pricing.pricingJson,pricingHash:pricing.proof.pricingHash,priceRevisionHash:pricing.proof.priceRevisionHash,saleRevisionHash:pricing.proof.saleRevisionHash,copyId:copy.copyId,sealHash:copy.sealHash}),'WORK_SELECTED_SALE_PRICING_HISTORY_DRIFT');
  }else check(priceHistory===null,'WORK_SELECTED_SALE_PRICING_HISTORY_DRIFT');
  check(s&&Array.isArray(s.items)&&s.items.length>=1&&s.items.length<=200&&new Set(s.items.map(i=>i.productId)).size===s.items.length);
  const selected=selectBusinessSaleWriteIntent(copy,{customerId:s.customerId,currency:s.currency,productIds:s.items.map(i=>i.productId)});
  check(payload.businessCustomerId===selected.customerId&&payload.businessAccountId===selected.customerAccountId&&payload.businessCurrency===selected.currency&&equal(payload.businessProductIds,selected.productIds)&&payload.sourceSelectionHash===selected.sourceSelectionHash&&payload.businessSelectedSalePolicyHash===selected.policyHash);
  check(s.customerAccountId===selected.customerAccountId&&p.sourceSelectionHash===selected.sourceSelectionHash&&p.policyHash===selected.policyHash);
  check(payload.customerId===s.customerId&&payload.currency===s.currency&&payload.documentDate===s.documentDate&&equal(payload.items,s.items)&&s.documentDate===copy.date);
  workDate(s.documentDate);workRevision(p.scopeRevision);check(payload.expectedRevision===p.scopeRevision);
  const {previewHash,copyId,sealHash,operationOrigin,...body}=p;
  check(previewHash===workHash(body)&&payload.previewHash===previewHash);
  const rates=copy.currencyRates.filter(r=>r.currency===s.currency);check(rates.length===1);const rate=rates[0];
  check(p.currency===s.currency&&fields(p.settlement,{documentCurrency:s.currency,accountCurrency:s.currency,accountId:selected.customerAccountId,documentRateExact8:rate.rateExact8,accountRateExact8:rate.rateExact8},['documentCurrency','accountCurrency','accountId','documentRateExact8','accountRateExact8'])&&equal(p.settlement.rateSource,rate));
  check(fields(h,created,headerKeys)&&h.documentNo==='NIGHT-'+j.request_id.replaceAll('-','').slice(0,24)&&h.customerId===s.customerId&&h.currency===s.currency&&h.documentDate===s.documentDate&&['draft','finalized','cancelled'].includes(h.status)&&String(h.createdBy)===actorId);
  check(h.accountCurrency===s.currency&&h.accountAmountExact4===p.grandTotalExact4&&h.documentRateExact8===rate.rateExact8&&h.accountRateExact8===rate.rateExact8);
  check(Array.isArray(p.items)&&Array.isArray(created.items)&&p.items.length===s.items.length&&lines.length===s.items.length&&created.items.length===s.items.length);
  let total=0n;
  for(let index=0;index<s.items.length;index++){
   const input=s.items[index],item=p.items[index],native=lines[index],original=created.items[index];
   workId(input.productId);workId(input.quoteId);const quantity=workScaled(input.quantityExact3,3);check(quantity>0n&&quantity%1000n===0n);
   check(fields(item,input,['productId','quoteId','quantityExact3'])&&fields(native,item,lineKeys)&&native.currency===s.currency&&fields(original,item,[...lineKeys,'quoteId','unitPriceExact8'])&&original.currency===s.currency&&equal(original.unit,item.unit));
   const products=copy.products.filter(v=>v.id===input.productId);check(products.length===1);const product=products[0];
   const quotes=product.quotes.filter(q=>q.quoteId===input.quoteId&&q.currency===s.currency&&q.verified===true&&q.mainUnit===true&&q.type==='sale');check(quotes.length===1);
   const price=pricing?pricing.rows.find(r=>r.productId===input.productId&&r.quoteId===input.quoteId&&r.currency===s.currency)?.pricing.priceExact8:quotes[0].priceExact8;
   check(typeof price==='string'&&item.stockCode===product.stockCode&&item.unit?.label===product.unit&&item.unit.factorExact8===product.unitFactorExact8&&item.unitPriceExact8===price&&native.averageCostTryExact4===product.costExact4&&workScaled(native.averageCostTryExact4,4)>0n&&native.barcode===item.barcode&&(native.barcode===null||product.barcodes.includes(native.barcode)));
   const price4=(workScaled(item.unitPriceExact8,8)+5000n)/10000n,line=(quantity*price4+500n)/1000n;
   check(price4>0n&&item.unitPriceExact4===workExact(price4,4)&&item.lineTotalExact4===workExact(line,4));total+=line;
  }
  const amountTry=(total*workScaled(rate.rateExact8,8)+50000000n)/100000000n;
  check(total>0n&&total<=workScaled(copy.businessInvoiceMaxExact4,4)&&p.subtotalExact4===workExact(total,4)&&p.grandTotalExact4===p.subtotalExact4&&p.amountTryExact4===workExact(amountTry,4)&&fields(h,p,['subtotalExact4','grandTotalExact4','amountTryExact4']));
  return freeze({selection:structuredClone(selected),creation:{requestId:j.request_id,invoiceId:h.id,actorId,payloadHash:j.payload_hash}});
 }catch(error){if(error.code==='WORK_SELECTED_SALE_DRIFT')throw error;fail();}
}
