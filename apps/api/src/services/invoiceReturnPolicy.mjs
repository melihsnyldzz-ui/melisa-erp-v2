import {createHash} from 'node:crypto';

export const returnError=(code,message,statusCode=400)=>Object.assign(new Error(message),{code,statusCode});
const fail=(message)=>{throw returnError('RETURN_VALIDATION',message);};
export function scaled(value,places,label='Tutar') {
  const text=String(value??'').trim();
  if (!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(text)) fail(`${label}: geçerli, en fazla ${places} ondalıklı pozitif sayı gerekli.`);
  const [whole,fraction='']=text.split('.');
  const result=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
  if(result>9000000000000n)fail(`${label} izin verilen aralığı aşıyor.`);
  return result;
}
export const unscaled=(value,places=4)=>Number(value)/10**places;
export const roundedRatio=(a,b,c)=>{if(c<=0n)fail('Bölünecek miktar sıfır olamaz.');return (a*b+c/2n)/c;};
export const returnHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)fail('Geçerli kayıt kimliği gerekli.');return n;};
export function normalizeReturn(payload={}) {
  if(!['sales','purchase'].includes(payload.kind))fail('İade türü geçersiz.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.requestId??''))fail('Kalıcı iade kimliği gerekli.');
  const sourceInvoiceId=payload.sourceInvoiceId==null||payload.sourceInvoiceId===''?null:id(payload.sourceInvoiceId);
  const date=String(payload.documentDate??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Geçerli iade tarihi gerekli.');
  const reason=String(payload.reason??'').trim();if(!reason||reason.length>500)fail('İade açıklaması 1–500 karakter olmalı.');
  if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>200)fail('İadede 1–200 ürün satırı gerekli.');
  const seen=new Set();
  const items=payload.items.map(row=>{
    const productId=id(row.productId),sourceItemId=sourceInvoiceId?id(row.sourceItemId):null;
    const key=sourceItemId??productId;if(seen.has(key))fail('Aynı ürün/satır birden fazla yazılamaz.');seen.add(key);
    const q=scaled(row.quantity,3,'Adet');if(q<=0n)fail('İade adedi sıfırdan büyük olmalı.');
    const item={productId,sourceItemId,quantity:unscaled(q,3)};
    if(!sourceInvoiceId){item.unitPrice=unscaled(scaled(row.unitPrice,4,'İade birim fiyatı'));if(item.unitPrice<=0)fail('İade fiyatı sıfırdan büyük olmalı.');
      if(payload.kind==='sales')item.unitCostTry=row.unitCostTry==null||row.unitCostTry===''?null:unscaled(scaled(row.unitCostTry,4,'Stok maliyeti'));
    }
    return item;
  }).sort((a,b)=>a.productId-b.productId||(a.sourceItemId??0)-(b.sourceItemId??0));
  const result={requestId:payload.requestId.toLowerCase(),kind:payload.kind,sourceInvoiceId,documentDate:date,reason,items};
  if(!sourceInvoiceId){
    result.partyId=id(payload.partyId);result.documentCurrency=String(payload.documentCurrency??'').toUpperCase();
    if(!['TRY','USD','EUR'].includes(result.documentCurrency))fail('Fiş dövizi TRY, USD veya EUR olmalı.');
    result.exchangeRate=result.documentCurrency==='TRY'?1:unscaled(scaled(payload.exchangeRate,8,'Fiş kuru'),8);
    if(result.exchangeRate<=0)fail('Fiş kuru sıfırdan büyük olmalı.');
    result.accountExchangeRate=payload.accountExchangeRate==null||payload.accountExchangeRate===''?null:unscaled(scaled(payload.accountExchangeRate,8,'Cari kuru'),8);
  }
  return result;
}

// Deterministic largest-remainder allocation keeps all returned lines equal to the original net total.
export function allocateNet(total,weights) {
  const t=scaled(total,4),ws=weights.map(w=>scaled(w,4)),sum=ws.reduce((a,b)=>a+b,0n);
  if(sum===0n){if(t!==0n)fail('Kaynak fişin satır toplamları tutarsız.');return ws.map(()=>0);}
  const parts=ws.map((w,i)=>({i,n:t*w/sum,remainder:t*w%sum}));
  let left=t-parts.reduce((a,b)=>a+b.n,0n);
  for(const p of [...parts].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(left--<=0n)break;p.n++;}
  return parts.map(p=>unscaled(p.n));
}

export function linkedReturnLines(source,requested,prior=[]) {
  if(source.status!=='finalized')throw returnError('RETURN_SOURCE_NOT_FINALIZED','Yalnız kesinleşmiş fişten iade alınabilir.',409);
  const sourceLines=[...source.items].sort((a,b)=>a.id-b.id);
  const net=allocateNet(source.grandTotal,sourceLines.map(x=>x.lineTotal));
  const accountNet=allocateNet(source.accountAmount,net);
  const tryNet=allocateNet(source.amountTry,net);
  return requested.map(row=>{
    const index=sourceLines.findIndex(x=>x.id===row.sourceItemId&&x.productId===row.productId);
    if(index<0)fail('Seçilen satır kaynak fişe ait değil.');
    const original=sourceLines[index];
    const old=prior.filter(p=>p.sourceItemId===row.sourceItemId).reduce((r,p)=>({q:r.q+scaled(p.quantity,3),amount:r.amount+scaled(p.amount,4),account:r.account+scaled(p.accountAmount,4),try:r.try+scaled(p.amountTry,4)}),{q:0n,amount:0n,account:0n,try:0n});
    const quantity=scaled(row.quantity,3),sourceQuantity=scaled(original.quantity,3);
    if(sourceQuantity<=0n||old.q+quantity>sourceQuantity)throw returnError('RETURN_QUANTITY_EXCEEDED','İade adedi, fişin henüz iade edilmemiş adedini aşıyor.',409);
    const part=(total,returned)=>unscaled(roundedRatio(scaled(total,4),old.q+quantity,sourceQuantity)-returned);
    const amount=part(net[index],old.amount),accountAmount=part(accountNet[index],old.account),amountTry=part(tryNet[index],old.try);
    if([amount,accountAmount,amountTry].some(n=>n<0))throw returnError('RETURN_SOURCE_TOTAL_MISMATCH','Önceki iade tutarı kaynakla uyuşmuyor; kayıt incelenmeli.',409);
    return {...row,amount,accountAmount,amountTry,unitPrice:unscaled(roundedRatio(scaled(net[index],4),1000n,sourceQuantity)),unitCostTry:source.kind==='sales'?Number(original.unitCostTry):null};
  });
}

export function stockAfterReturn({quantity,currentStock,currentAverageCostTry,unitCostTry,direction}) {
  if(currentStock==null||currentAverageCostTry==null||unitCostTry==null)throw returnError('RETURN_COST_REVIEW_REQUIRED','Mevcut stok miktarı veya maliyeti bilinmiyor; iade öncesi inceleyin.',409);
  const q=Number(quantity),stock=Number(currentStock),average=Number(currentAverageCostTry),cost=Number(unitCostTry);
  if(![q,stock,average,cost].every(Number.isFinite)||q<=0||average<0||cost<0)fail('Stok miktarı veya maliyet doğrulanamadı.');
  if(stock>0&&average===0)throw returnError('RETURN_COST_REVIEW_REQUIRED','Mevcut pozitif stokun maliyeti sıfır; iade öncesi maliyetini doğrulayın.',409);
  const next=Number((stock+direction*q).toFixed(3));
  if(direction<0&&next<0)throw returnError('RETURN_STOCK_INSUFFICIENT','İade çıkışı için yeterli stok yok.',409);
  if(direction>0){const value=stock>0?(stock*average+q*cost)/(stock+q):cost;return {quantity:next,averageCostTry:Number(value.toFixed(4))};}
  // Removal uses the recorded cost; a later cancellation must not invent negative inventory value.
  const value=stock*average-q*cost;
  if(value< -0.0001)throw returnError('RETURN_COST_REVIEW_REQUIRED','İade ters kaydı mevcut stok maliyetiyle uyuşmuyor; maliyet incelemesi gerekli.',409);
  return {quantity:next,averageCostTry:next>0?Number((Math.max(0,value)/next).toFixed(4)):average};
}
