import {businessSalePreviewSelectionAllowed} from './businessWorkface.mjs';
export {moneyDisplay} from './moneyDisplay.mjs';
import {operationCopyFromMeta,operationCopyEntity,operationCopyQuote,operationCopyDailySelection} from './isolatedOperationCopyModel.mjs';
import {GOAL8_DAY_SQL_PROFILE_META} from '../../../api/src/services/goal8DaySqlProof.mjs';
import {isSelectedSaleContext,selectedSaleContext,selectedSaleQuote} from './selectedSaleUiModel.mjs';
const bad=()=>{throw Error('İşlem bilgileri doğrulanamadı. Yenileyerek tekrar deneyin.');};
export const tradeId=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
export const tradeRevision=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const tradeExact=(v,scale)=>typeof v==='string'&&new RegExp('^-?(?:0|[1-9]\\d{0,33})\\.\\d{'+scale+'}$').test(v);
export const tradeDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
export function tradeAmount(v){if(v===null)return 'Bilinmiyor';if(typeof v!=='string'||!/^\-?(?:0|[1-9]\d{0,33})\.\d{3,8}$/.test(v))bad();const [whole,f]=v.split('.'),tail=f.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(tail?','+tail:'');}
export function tradeInput(v,scale){if(typeof v!=='string')bad();const raw=v.trim().replace(',','.');if(!new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,'+scale+'})?$').test(raw))bad();const [w,f='']=raw.split('.');return w+'.'+f.padEnd(scale,'0');}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,list)=>object(v)&&Object.keys(v).sort().join()===list.toSorted().join();
const priceHash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const currentAmount=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
export const tradeQuoteSelectable=q=>tradeExact(q?.unitPriceExact8,8)&&BigInt(q.unitPriceExact8.replace('.',''))>0n;
function currentPriceProof(c,copy,selected){
 // Presentation checks on the authenticated backend DTO. Native authority and
 // immutable version hashes are verified by the server before this projection.
 if(c.pricingProof===undefined)return false;
 const proof=c.pricingProof;
 if(!selected||!copy||!keys(proof,['schemaVersion','copyId','sealHash','profileHash','priceRevisionHash','saleRevisionHash','readerDefinitionHash','mode','invoiceId','pricingHash'])||proof.schemaVersion!=='melisa-business-product-price-sale-proof.v1'||proof.copyId!==copy.copyId||proof.sealHash!==copy.sealHash||proof.mode!=='CURRENT'||proof.invoiceId!==null||!['profileHash','priceRevisionHash','saleRevisionHash','readerDefinitionHash','pricingHash'].every(k=>priceHash(proof[k])))bad();
 for(const p of c.scope.products)for(const q of p.prices){
  const pricing=q.pricing;
  if(!keys(pricing,['origin','versionId','sourcePriceExact8','nativeRowHash','bindingHash','priceExact8','versionProofHash'])||!currentAmount(pricing.sourcePriceExact8)||!tradeQuoteSelectable({unitPriceExact8:pricing.sourcePriceExact8})||!priceHash(pricing.nativeRowHash)||!priceHash(pricing.bindingHash)||pricing.priceExact8!==q.unitPriceExact8||!currentAmount(pricing.priceExact8))bad();
  if(pricing.origin==='SOURCE'){if(pricing.versionId!==null||pricing.versionProofHash!==null||pricing.priceExact8!==pricing.sourcePriceExact8)bad();}
  else if(pricing.origin!=='MANUAL'||!tradeId(pricing.versionId)||!priceHash(pricing.versionProofHash))bad();
 }
 return true;
}
export function tradeContext(c){
 const copy=operationCopyFromMeta(c?.meta),synthetic=copy?false:true;
 const readOnly=c?.meta?.cleanSaleReadOnly===true;if(readOnly&&(copy||c.meta.environment!=='CLEAN_SYNTHETIC_TEST'||c.meta.environmentId!=='e662fd94-d797-4b3b-938a-d143ad758b67'||c.meta.synthetic!==true||c.meta.actualT1!==false||c.meta.externalOperations!==false||c.capabilities?.canCreate!==false||c.capabilities.canFinalize!==false||c.capabilities.canCancel!==false||c.scope?.products?.length!==0||c.limits?.maxItems!==0||c.limits.maxQuantityPerLine!==0||c.limits.maxInvoiceAmountExact4!=='0.0000'))bad();
 if(!object(c)||c.meta?.schemaVersion!=='melisa-work-trade.v1'||!tradeDate(c.meta.date)||c.meta.timeZone!=='Europe/Istanbul'||c.meta.source!=='native-test'||!tradeRevision(c.revision)||!['canCreate','canFinalize','canCancel','canCollect','canCancelCollection'].every(k=>typeof c.capabilities?.[k]==='boolean')||c.scope?.synthetic!==synthetic)bad();
 const s=c.scope,p=c.meta.testProfile,goal8=!copy&&p!==undefined,selected=isSelectedSaleContext(c)?selectedSaleContext(c,copy):null,daily=copy&&!selected?operationCopyDailySelection(copy,c.meta,{requireMetaHash:copy.businessDaily!==undefined}):null;
 const priced=currentPriceProof(c,copy,selected);
 if(copy){if(s.operationOrigin!=='ISOLATED_TEST_COPY'||s.products?.length!==(selected?selected.productIds.length:daily?daily.productIds.length:copy.products.length))bad();operationCopyEntity(s.customer,'customers',copy);for(const row of s.products)operationCopyEntity(row,'products',copy);for(const row of s.accounts??[])operationCopyEntity(row,'financeAccounts',copy);}
 if(daily){const customer=copy.customers.find(p=>p.accountId===daily.customerAccountId&&p.currency===daily.currency);if(s.customer.id!==customer.id||s.customer.accountId!==customer.accountId||s.customer.partyId!==customer.partyId||s.customer.sourceKey!==customer.sourceKey||s.products.some(p=>!daily.productIds.includes(p.id))||s.accounts.some(a=>a.id!==daily.financeAccountId||a.currency!==daily.currency)||c.supportedCurrencies?.length!==1||c.supportedCurrencies[0]!==daily.currency)bad();}
 if(goal8&&(p?.id!==GOAL8_DAY_SQL_PROFILE_META.id||p.dayId!==GOAL8_DAY_SQL_PROFILE_META.dayId||p.definitionHash!==GOAL8_DAY_SQL_PROFILE_META.definitionHash||p.sealed!==true||p.synthetic!==true||p.productId!=='325503'||p.supplierId!=='13370'||p.customerId!=='30598'||p.currency!=='TRY'||!tradeId(p.accountId)||s.customer?.id!==p.customerId||s.customer?.code!=='TEST-NIGHT-20261006-C'||s.customer?.currency!=='TRY'||s.products?.length!==2||!s.products.some(row=>row.id===p.productId)||s.products.some(row=>!['301985','325503'].includes(row.id)||row.stockCode!==(row.id==='325503'?'TEST-FINISH-GOODS-P2':'TEST-V70-GOODS-P')||row.prices?.length!==1||row.prices[0]?.currency!=='TRY'||row.prices[0]?.unitPriceExact8!==(row.id==='325503'?'120.00000000':'100.00000000')||row.prices[0]?.source?.fixture!==p.id||row.prices[0]?.source?.quotedPrice!==true)||s.accounts?.some(a=>a.id!==p.accountId||a.code!=='TEST-NIGHT-20261006-K'||a.currency!=='TRY'||a.type!=='cash')))bad();
 if(!tradeId(s.customer?.id)||typeof s.customer.code!=='string'||typeof s.customer.name!=='string'||s.customer.synthetic!==synthetic||s.customer.writeEligible!==true||!tradeExact(s.customer.balanceExact4,4)||!tradeRevision(s.customer.revision)||!['TRY','USD','EUR'].includes(s.customer.currency)||!Array.isArray(s.products)||s.products.length<(readOnly?0:daily||selected?1:2)||!Array.isArray(s.accounts))bad();
 for(const p of s.products){if(!tradeId(p.id)||p.id==='301986'||typeof p.stockCode!=='string'||typeof p.name!=='string'||(p.barcode!==null&&typeof p.barcode!=='string')||p.synthetic!==synthetic||p.writeEligible!==true||!tradeExact(p.stockQuantityExact3,3)||typeof p.unit?.label!=='string'||!tradeExact(p.unit.factorExact8,8)||!tradeRevision(p.revision)||!Array.isArray(p.prices))bad();for(const q of p.prices)if(typeof q.quoteId!=='string'||!q.quoteId||!['TRY','USD','EUR'].includes(q.currency)||!(tradeExact(q.unitPriceExact8,8)||priced&&q.unitPriceExact8===null&&q.pricing.origin==='MANUAL')||!tradeRevision(q.revision)||q.source?.kind!==(copy?'isolated-test-copy':'synthetic-test'))bad();}
 if(copy)for(const product of s.products)for(const quote of product.prices)selected?selectedSaleQuote(quote,product.id,copy,selected.currency):operationCopyQuote(quote,product.id,copy);
 if(new Set(s.products.map(p=>p.id)).size!==s.products.length)bad();
 for(const a of s.accounts)if(!tradeId(a.id)||typeof a.code!=='string'||typeof a.name!=='string'||typeof a.type!=='string'||!['TRY','USD','EUR'].includes(a.currency)||!tradeExact(a.balanceExact4,4)||a.synthetic!==synthetic)bad();
 if(!Array.isArray(c.supportedCurrencies)||!c.supportedCurrencies.length||c.supportedCurrencies.some(v=>!['TRY','USD','EUR'].includes(v))||!Number.isInteger(c.limits?.maxItems)||c.limits.maxItems<(readOnly?0:2)||!Number.isInteger(c.limits.maxQuantityPerLine)||c.limits.maxQuantityPerLine<(readOnly?0:1)||!tradeExact(c.limits.maxInvoiceAmountExact4,4))bad();return c;
}
export function tradeSelection(selection,c){
 if(!object(selection)||selection.customerId!==c.scope.customer.id||!tradeDate(selection.documentDate)||!c.supportedCurrencies.includes(selection.currency)||selection.currency!==c.scope.customer.currency||!Array.isArray(selection.items)||!selection.items.length||selection.items.length>c.limits.maxItems||new Set(selection.items.map(i=>i.productId)).size!==selection.items.length)bad();
 for(const i of selection.items){const p=c.scope.products.find(p=>p.id===i.productId),q=p?.prices.find(q=>q.quoteId===i.quoteId&&q.currency===selection.currency);if(!q||!tradeExact(i.quantityExact3,3)||BigInt(i.quantityExact3.replace('.',''))<1000n||BigInt(i.quantityExact3.replace('.',''))%1000n!==0n||BigInt(i.quantityExact3.replace('.',''))>BigInt(c.limits.maxQuantityPerLine)*1000n)bad();}return selection;
}
function lines(items){if(!Array.isArray(items)||!items.length||new Set(items.map(i=>i.productId)).size!==items.length)bad();for(const i of items)if(!tradeId(i.productId)||typeof i.stockCode!=='string'||typeof i.name!=='string'||!tradeExact(i.quantityExact3,3)||!tradeExact(i.unitPriceExact8,8)||!tradeExact(i.unitPriceExact4,4)||!tradeExact(i.lineTotalExact4,4))bad();}
export function tradePreview(p,c,expected){if(!object(p)||!tradeRevision(p.previewHash)||!tradeRevision(p.scopeRevision)||p.scopeRevision!==c.revision||!['TRY','USD','EUR'].includes(p.currency)||!['subtotalExact4','grandTotalExact4','amountTryExact4'].every(k=>tradeExact(p[k],4))||p.writable!==true)bad();tradeSelection(p.selection,c);lines(p.items);if(p.items.length!==p.selection.items.length||p.currency!==p.selection.currency)bad();if(expected&&(!['customerId','documentDate','currency'].every(k=>p.selection[k]===expected[k])||JSON.stringify(p.selection.items)!==JSON.stringify(expected.items)))bad();for(const i of p.items){const selected=p.selection.items.find(s=>s.productId===i.productId),product=c.scope.products.find(s=>s.id===i.productId),quote=product?.prices.find(q=>q.quoteId===i.quoteId);if(!selected||i.quoteId!==selected.quoteId||i.quantityExact3!==selected.quantityExact3||i.stockCode!==product.stockCode||i.name!==product.name||!quote||i.unitPriceExact8!==quote.unitPriceExact8||i.unit?.label!==product.unit.label||i.unit.factorExact8!==product.unit.factorExact8)bad();}return p;}
export function tradeInvoice(i){if(!object(i)||!tradeId(i.id)||typeof i.documentNo!=='string'||!tradeDate(i.documentDate)||!['draft','finalized','cancelled'].includes(i.status)||!tradeId(i.customerId)||!['TRY','USD','EUR'].includes(i.currency)||!tradeRevision(i.revision)||!['subtotalExact4','grandTotalExact4','amountTryExact4','customerBalanceExact4'].every(k=>tradeExact(i[k],4))||!tradeRevision(i.collections?.revision)||!['receivedExact4','outstandingExact4'].every(k=>tradeExact(i.collections[k],4))||!Array.isArray(i.collections.items))bad();lines(i.items);if(i.items.some(l=>l.currency!==i.currency))bad();i.collections.items.forEach(c=>{tradeCollection(c);if(c.invoiceId!==i.id||c.currency!==i.currency)bad();});return i;}
export function tradeCollection(c){if(!object(c)||!['active','cancelled'].includes(c.status)||!tradeId(c.id)||!tradeId(c.invoiceId)||!tradeId(c.accountId)||!tradeRevision(c.revision)||!tradeExact(c.amountExact4,4)||!['TRY','USD','EUR'].includes(c.currency)||!tradeDate(c.documentDate))bad();return c;}
export function createTradeJournal({storage,key}){const save=v=>{try{storage.setItem(key,JSON.stringify(v));}catch{throw Error('İşlem saklanamadı; kayıt gönderilmedi.');}};return {read(){try{const raw=storage.getItem(key);if(!raw)return null;const p=JSON.parse(raw);if(p?.version!==1||!['pending','done'].includes(p.status)||typeof p.path!=='string'||!object(p.body)||typeof p.body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.body.requestId))throw Error();if(p.invoiceWitness!==undefined&&!canonicalWitness(p.invoiceWitness))throw Error();return p;}catch{throw Error('Son işlem okunamıyor. İşlem sonucu kontrol edilmeli.');}},begin(path,body,options){const p={version:1,path,body,status:'pending'};if(options!==undefined){if(!keys(options,['invoiceWitness'])||!canonicalWitness(options.invoiceWitness))bad();p.invoiceWitness=structuredClone(options.invoiceWitness);}save(p);return p;},done(p,result){const next={...p,status:'done',result};save(next);return next;},clear(){storage.removeItem(key);}};}

export function tradeUuid(crypto=globalThis.crypto){
 const valid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 try{if(typeof crypto?.randomUUID==='function'){const id=crypto.randomUUID();if(!valid(id))throw Error();return id;}if(typeof crypto?.getRandomValues!=='function')throw Error();const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);if(!valid(id))throw Error();return id;}catch{throw Error('İşlem hazırlanamadı; kayıt gönderilmedi. Lütfen tekrar deneyin.');}
}

// Public canonical witnesses are presentation/correlation data. These checks
// never issue native authority or enable a mutation transport.
const canonicalId=v=>tradeId(v)&&v.length<=19&&BigInt(v)<=9223372036854775807n;
const canonicalUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const canonicalWitness=w=>keys(w,['id','customerId','customerAccountId','partyEntityId','currency','creationRequestId','operationOrigin','revision','status'])&&[w.id,w.customerId,w.customerAccountId,w.partyEntityId].every(canonicalId)&&canonicalUuid(w.creationRequestId)&&w.operationOrigin==='CANONICAL_TEST_BUSINESS_SALE'&&tradeRevision(w.revision)&&['draft','finalized'].includes(w.status)&&['TRY','USD','EUR'].includes(w.currency);
const canonicalScope=s=>object(s)&&canonicalId(s.customerId)&&canonicalId(s.customerAccountId)&&['TRY','USD','EUR'].includes(s.currency);
export function tradeCanonicalSaleInvoice(value,expected){
 const i=tradeInvoice(value);
 if(!canonicalScope(expected)||!canonicalId(i.id)||i.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||!canonicalId(i.customerAccountId)||!canonicalId(i.partyEntityId)||!canonicalUuid(i.creationRequestId)||i.customerId!==expected.customerId||i.customerAccountId!==expected.customerAccountId||i.currency!==expected.currency||!tradeExact(i.customerBalanceExact8,8)||i.customerBalanceDisplayOnly!==true||i.collections.receivedExact4!=='0.0000'||i.collections.items.length!==0)bad();
 for(const key of ['invoiceId','creationRequestId','partyEntityId'])if(expected[key]!==undefined&&i[key==='invoiceId'?'id':key]!==expected[key])bad();
 if(i.items.length>2||i.items.some(l=>!canonicalId(l.productId)||!canonicalId(l.quoteId)||! /^[1-5]\.000$/.test(l.quantityExact3)||!canonicalId(l.unit?.sourceId)||l.unit.label!=='ADET'||l.unit.factorExact8!=='1.00000000'))bad();
 const money=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v),scaled=v=>BigInt(v.replace('.',''));
 if(![i.subtotalExact4,i.grandTotalExact4,i.amountTryExact4].every(money)||i.subtotalExact4!==i.grandTotalExact4||scaled(i.grandTotalExact4)<=0n||scaled(i.grandTotalExact4)>5000000n||scaled(i.amountTryExact4)<=0n||scaled(i.amountTryExact4)>5000000n||i.collections.outstandingExact4!==(i.status==='finalized'?i.grandTotalExact4:'0.0000')||i.currency==='TRY'&&i.amountTryExact4!==i.grandTotalExact4)bad();
 let total=0n;for(const l of i.items){if(!money(l.unitPriceExact4)||!money(l.lineTotalExact4)||! /^(?:0|[1-9]\d{0,13})\.\d{8}$/.test(l.unitPriceExact8)||scaled(l.unitPriceExact8)<=0n||scaled(l.unitPriceExact4)!==(scaled(l.unitPriceExact8)+5000n)/10000n||scaled(l.lineTotalExact4)!==scaled(l.unitPriceExact4)*BigInt(l.quantityExact3.slice(0,-4)))bad();total+=scaled(l.lineTotalExact4);}if(total!==scaled(i.grandTotalExact4))bad();
 return i;
}
export function tradeCanonicalSaleRequest({operation,requestId,selection,preview,invoice,scope,reason}={}){
 if(!canonicalUuid(requestId))bad();let path,body,invoiceWitness;
 if(operation==='sale_draft'){
  if(!businessSalePreviewSelectionAllowed(selection)||!preview||preview.canSave!==false||preview.readOnly!==true||!tradeRevision(preview.previewHash)||!tradeRevision(preview.scopeRevision)||JSON.stringify(preview.selection)!==JSON.stringify(selection)||preview.documentDate!==selection.documentDate||preview.currency!==selection.currency)bad();
  const chosen=structuredClone(selection);chosen.items=Object.freeze(chosen.items.map(Object.freeze));path='/api/work-sales/drafts';body={...chosen,previewHash:preview.previewHash,expectedRevision:preview.scopeRevision,requestId};
 }else{
  const i=tradeCanonicalSaleInvoice(invoice,scope);if(requestId===i.creationRequestId)bad();
  if(operation==='sale_finalize'&&i.status!=='draft'||operation==='sale_cancel'&&!['draft','finalized'].includes(i.status)||!['sale_finalize','sale_cancel'].includes(operation))bad();
  invoiceWitness=Object.freeze(Object.fromEntries(['id','customerId','customerAccountId','partyEntityId','currency','creationRequestId','operationOrigin','revision','status'].map(k=>[k,i[k]])));
  path='/api/work-sales/drafts/'+i.id+'/'+(operation==='sale_finalize'?'finalize':'cancel');body={requestId,expectedRevision:i.revision};
  if(operation==='sale_cancel'){if(typeof reason!=='string'||reason.trim().length<5||reason.length>500)bad();body.reason=reason.trim();}
 }
 // Existing createTradeJournal can persist this exact path/body only after a
 // separately issued session capability. This pure value never grants POST.
 return Object.freeze({operation,path,body:Object.freeze(body),...(invoiceWitness?{invoiceWitness}:{}),canSend:false});
}
export function tradeCanonicalSaleJournal(value,pending,scope){
 if(!canonicalScope(scope)||!object(pending)||!['pending','done'].includes(pending.status)||!object(pending.body)||!canonicalUuid(pending.body.requestId)||!tradeRevision(pending.body.expectedRevision))bad();
 const body=pending.body,match=/^\/api\/work-sales\/drafts\/([1-9]\d{0,18})\/(finalize|cancel)$/.exec(pending.path),draft=pending.path==='/api/work-sales/drafts';
 let operation;
 if(draft){
  if(!keys(body,['customerId','customerAccountId','currency','documentDate','items','requestId','previewHash','expectedRevision'])||!tradeRevision(body.previewHash))bad();
  const {requestId,previewHash,expectedRevision,...selection}=body;
  if(!businessSalePreviewSelectionAllowed(selection)||selection.customerId!==scope.customerId||selection.customerAccountId!==scope.customerAccountId||selection.currency!==scope.currency)bad();operation='sale_draft';
 }else{
  if(!match||!canonicalId(match[1])||!keys(body,match[2]==='cancel'?['requestId','expectedRevision','reason']:['requestId','expectedRevision'])||match[2]==='cancel'&&(typeof body.reason!=='string'||body.reason.trim()!==body.reason||body.reason.length<5||body.reason.length>500))bad();
  operation=match[2]==='finalize'?'sale_finalize':'sale_cancel';
  const w=pending.invoiceWitness;if(!canonicalWitness(w)||w.id!==match[1]||w.revision!==body.expectedRevision||w.customerId!==scope.customerId||w.customerAccountId!==scope.customerAccountId||w.currency!==scope.currency||operation==='sale_finalize'&&w.status!=='draft')bad();
 }
 if(!keys(value,['requestId','operation','response'])||value.requestId!==body.requestId||value.operation!==operation||!keys(value.response,['requestId','invoice','replayed'])||value.response.requestId!==body.requestId||typeof value.response.replayed!=='boolean')bad();
 const expected={...scope,...(draft?{creationRequestId:body.requestId}:{invoiceId:match[1],creationRequestId:pending.invoiceWitness.creationRequestId,partyEntityId:pending.invoiceWitness.partyEntityId})},i=tradeCanonicalSaleInvoice(value.response.invoice,expected);
 if(i.status!==({sale_draft:'draft',sale_finalize:'finalized',sale_cancel:'cancelled'}[operation]))bad();
 if(draft&&(i.documentDate!==body.documentDate||JSON.stringify(i.items.map(l=>({productId:l.productId,quoteId:l.quoteId,quantityExact3:l.quantityExact3})))!==JSON.stringify(body.items)))bad();
 if(pending.status==='done'){
  const saved=tradeCanonicalSaleInvoice(pending.result?.invoice,expected);
  if(pending.result.requestId!==body.requestId||saved.id!==i.id||saved.creationRequestId!==i.creationRequestId||saved.partyEntityId!==i.partyEntityId||saved.revision!==i.revision||JSON.stringify(saved.items)!==JSON.stringify(i.items)||saved.grandTotalExact4!==i.grandTotalExact4)bad();
 }
 return i;
}
