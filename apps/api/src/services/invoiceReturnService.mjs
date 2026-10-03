import {normalizeReturn,returnError,returnHash,linkedReturnLines,scaled,unscaled,roundedRatio,stockAfterReturn,allocateNet} from './invoiceReturnPolicy.mjs';
import {calculateCurrencySettlement} from './currencySettlement.mjs';

const sum=(rows,key)=>unscaled(rows.reduce((n,row)=>n+scaled(row[key],4),0n));
function owner(actor){const id=Number(actor?.id);if(!Number.isSafeInteger(id)||id<=0)throw returnError('AUTH_REQUIRED','Geçerli kullanıcı gerekli.',401);return id;}
export function buildReturnPlan(payload,context) {
  const {source,party,products,prior=[]}=context;
  if(!party||!party.isActive||party.isDeleted)throw returnError('RETURN_PARTY_UNAVAILABLE','Aktif cari kaydı gerekli.',409);
  if(payload.sourceInvoiceId&&(!source||source.id!==payload.sourceInvoiceId||source.kind!==payload.kind||source.partyId!==party.id))throw returnError('RETURN_SOURCE_MISMATCH','Kaynak fiş doğrulanamadı.',409);
  const documentCurrency=source?.documentCurrency??payload.documentCurrency;
  const exchangeRate=source?.exchangeRate??payload.exchangeRate;
  const accountExchangeRate=source?.accountExchangeRate??(party.currency==='TRY'?1:party.currency===documentCurrency?exchangeRate:payload.accountExchangeRate);
  if(source&&source.accountCurrency!==party.currency)throw returnError('RETURN_ACCOUNT_CURRENCY_CHANGED','Kaynak fişin cari dövizi güncel kartla uyuşmuyor.',409);
  let items=source?linkedReturnLines(source,payload.items,prior):payload.items.map(row=>({...row,amount:unscaled(roundedRatio(scaled(row.quantity,3),scaled(row.unitPrice,4),1000n))}));
  const settlement=calculateCurrencySettlement({documentAmount:sum(items,'amount'),documentCurrency,accountCurrency:party.currency,documentRateToTry:exchangeRate,accountRateToTry:accountExchangeRate});
  if(!source){
    // Distribute currency rounding once, so all line amounts exactly match the header.
    const distribute=(total)=>allocateNet(total,items.map(x=>x.amount));
    const accountAmounts=distribute(settlement.accountAmount),tryAmounts=distribute(settlement.amountTry);
    items=items.map((row,i)=>({...row,accountAmount:accountAmounts[i],amountTry:tryAmounts[i]}));
  }
  const nextProducts=new Map(products.map(p=>[p.id,{...p}]));
  items=items.map(row=>{
    const product=nextProducts.get(row.productId);
    if(!product||!product.isActive||product.isDeleted)throw returnError('RETURN_PRODUCT_UNAVAILABLE','Aktif ürün kaydı gerekli.',409);
    const unitCostTry=payload.kind==='purchase'?product.averageCostTry:row.unitCostTry;
    if(unitCostTry==null||!Number.isFinite(Number(unitCostTry))||Number(unitCostTry)<=0)throw returnError('RETURN_COST_REQUIRED','Müşteri iadesinde geçerli stok maliyeti gerekli; bilinmeyen maliyet sıfır kabul edilmez.',409);
    const after=stockAfterReturn({quantity:row.quantity,currentStock:product.stock,currentAverageCostTry:product.averageCostTry,unitCostTry,direction:payload.kind==='sales'?1:-1});
    const planned={...row,stockCode:product.code,productName:product.name,unitCostTry:Number(unitCostTry),stockBefore:product.stock,averageCostBefore:product.averageCostTry,stockAfter:after.quantity,averageCostAfter:after.averageCostTry};
    product.stock=after.quantity;product.averageCostTry=after.averageCostTry;return planned;
  });
  return {kind:payload.kind,sourceInvoiceId:payload.sourceInvoiceId,sourceDocumentNo:source?.documentNo??null,partyId:party.id,partyName:party.name,documentDate:payload.documentDate,reason:payload.reason,documentCurrency,exchangeRate,accountCurrency:party.currency,accountExchangeRate:Number(accountExchangeRate),amount:sum(items,'amount'),accountAmount:sum(items,'accountAmount'),amountTry:sum(items,'amountTry'),items,cashEffect:0};
}

export function createInvoiceReturnService({repository,assertWriteEnabled}) {
  return {
    async preview(raw,actor){owner(actor);const payload=normalizeReturn(raw);return repository.transaction(false,async tx=>{const plan=buildReturnPlan(payload,await tx.context(payload));return {...plan,previewHash:returnHash(plan),requestId:payload.requestId};});},
    async submit(raw,actor){
      const actorId=owner(actor),payload=normalizeReturn(raw),payloadHash=returnHash(payload);
      if(!/^[0-9a-f]{64}$/.test(raw.previewHash??''))throw returnError('RETURN_PREVIEW_REQUIRED','Önce iade etkisini önizleyin.');
      assertWriteEnabled();
      return repository.transaction(true,async tx=>{
        await tx.lockRequest(payload.requestId);
        const existing=await tx.byRequest(payload.requestId);
        if(existing){if(existing.createdBy!==actorId||existing.payloadHash!==payloadHash)throw returnError('RETURN_REQUEST_CONFLICT','Bu işlem kimliği başka bir içerikle kullanılmış.',409);return {...existing,replayed:true};}
        const plan=buildReturnPlan(payload,await tx.context(payload));
        if(returnHash(plan)!==raw.previewHash)throw returnError('RETURN_PREVIEW_STALE','Stok, fiyat veya iade kapsamı değişti. Güncel önizlemeyi inceleyin.',409);
        await tx.assertPeriod(plan.documentDate);
        const saved=await tx.insert(payload,plan,payloadHash,actorId);
        await tx.apply(saved,plan,1,actorId);
        await tx.audit({action:`${payload.kind}_return_finalized`,entityType:'invoice_return',entityId:saved.id,afterSnapshot:{requestId:payload.requestId,...plan},actor});
        return saved;
      });
    },
    async status(requestId,actor){const actorId=owner(actor);if(!/^[0-9a-f-]{36}$/i.test(requestId))throw returnError('RETURN_ID_INVALID','İade kimliği geçersiz.');return repository.transaction(false,async tx=>{const row=await tx.byRequest(requestId);if(!row)return null;if(row.createdBy!==actorId)throw returnError('RETURN_OWNER_MISMATCH','Bu işlem kimliği başka kullanıcıya ait.',403);return row;});},
    async list(kind,actor){owner(actor);if(!['sales','purchase'].includes(kind))throw returnError('RETURN_KIND_INVALID','İade türü geçersiz.');return repository.transaction(false,tx=>tx.list(kind));},
    async cancel(id,raw,actor){
      const actorId=owner(actor);if(!Number.isSafeInteger(Number(id))||Number(id)<=0)throw returnError('RETURN_ID_INVALID','İade kaydı geçersiz.');
      const reason=String(raw?.reason??'').trim();if(!reason||reason.length>500)throw returnError('RETURN_CANCEL_REASON','İptal açıklaması gerekli.');
      const date=String(raw?.documentDate??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw returnError('RETURN_CANCEL_DATE','Geçerli ters kayıt tarihi gerekli.');
      assertWriteEnabled();
      return repository.transaction(true,async tx=>{
        const row=await tx.byId(Number(id),true);if(!row)throw returnError('RETURN_NOT_FOUND','İade kaydı bulunamadı.',404);
        if(row.kind!==raw.kind)throw returnError('RETURN_KIND_MISMATCH','İade türü uyuşmuyor.',409);
        if(row.status==='cancelled')return {...row,replayed:true};
        await tx.assertPeriod(date);await tx.assertPeriod(row.plan.documentDate);
        const party=await tx.party(row.kind,row.plan.partyId);
        if(!party)throw returnError('RETURN_PARTY_UNAVAILABLE','İadenin cari kaydı bulunamadı.',409);
        if(party.currency!==row.plan.accountCurrency)throw returnError('RETURN_ACCOUNT_CURRENCY_CHANGED','İadenin cari dövizi güncel kartla uyuşmuyor; ters kayıt öncesi inceleyin.',409);
        const products=await tx.products(row.plan.items.map(x=>x.productId));
        const plan={...row.plan,documentDate:date,items:row.plan.items.map(item=>{const p=products.find(x=>x.id===item.productId);if(!p)throw returnError('RETURN_PRODUCT_UNAVAILABLE','Ürün bulunamadı.',409);const after=stockAfterReturn({quantity:item.quantity,currentStock:p.stock,currentAverageCostTry:p.averageCostTry,unitCostTry:item.unitCostTry,direction:row.kind==='sales'?-1:1});const planned={...item,stockBefore:p.stock,averageCostBefore:p.averageCostTry,stockAfter:after.quantity,averageCostAfter:after.averageCostTry};p.stock=after.quantity;p.averageCostTry=after.averageCostTry;return planned;})};
        await tx.apply(row,plan,-1,actorId);await tx.markCancelled(row.id,reason,actorId);
        await tx.audit({action:`${row.kind}_return_cancelled`,entityType:'invoice_return',entityId:row.id,beforeSnapshot:row.plan,afterSnapshot:{...plan,cancelReason:reason},actor});
        return {...row,status:'cancelled'};
      });
    },
  };
}

let instance;
async function service(){if(!instance)instance=(async()=>{const [{createInvoiceReturnSqlRepository},{assertMelisaWriteEnabled}]=await Promise.all([import('./invoiceReturnSql.mjs'),import('./writeGuardService.js')]);return createInvoiceReturnService({repository:await createInvoiceReturnSqlRepository(),assertWriteEnabled:assertMelisaWriteEnabled});})().catch(error=>{instance=null;throw error;});return instance;}
export const previewInvoiceReturn=async(body,actor)=>(await service()).preview(body,actor);
export const submitInvoiceReturn=async(body,actor)=>(await service()).submit(body,actor);
export const getInvoiceReturnStatus=async(id,actor)=>(await service()).status(id,actor);
export const listInvoiceReturns=async(kind,actor)=>(await service()).list(kind,actor);
export const cancelInvoiceReturn=async(id,body,actor)=>(await service()).cancel(id,body,actor);
