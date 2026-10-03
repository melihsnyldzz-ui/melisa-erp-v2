import { assert, cents, clone, currencies, quantity, validDate } from './operationsShared.js';

const clean = (value,limit=80) => { const text=String(value||'').trim();assert(text.length<=limit,'Kart alanı çok uzun.');return text; };
export const productBarcodes = product => [product.barcode,...(product.barcodes||[]),...(product.unitBarcodes||[]).map(item=>item.barcode)].filter(Boolean);
export function resolveProductBarcode(state,value){
 const barcode=String(value||'').trim();if(!barcode)return null;
 for(const product of state.products){
  const piece=(product.unitBarcodes||[]).find(item=>item.barcode===barcode);
  if(piece)return {productId:product.id,kind:'PIECE',size:piece.size,barcode,unitFactor:product.unitFactor||1};
  if([product.barcode,...(product.barcodes||[])].includes(barcode))return {productId:product.id,kind:'PACKAGE',barcode,unitFactor:product.unitFactor||1};
 }
 return null;
}
export function validateProductScan(product,{barcode,unitScans,quantity:packages}){
 const packageCodes=[product.barcode,...(product.barcodes||[])].filter(Boolean);
 if(barcode){assert(packageCodes.includes(barcode),'Parça barkodu tam paket yerine kullanılamaz; paketin barkodunu okutun.');}
 if(unitScans!==undefined){
  assert(Array.isArray(unitScans)&&unitScans.length<=1000,'Seri tarama listesi geçersiz veya çok uzun.');
  const series=product.series||[];assert(series.length,'Parça taraması için ürün serisi tanımlanmalı.');
  const counts=new Map(series.map(part=>[part.size,0]));
  for(const scanned of unitScans){const item=(product.unitBarcodes||[]).find(part=>part.barcode===scanned);assert(item,'Taranan birim barkodu bu ürüne ait değil.');counts.set(item.size,counts.get(item.size)+1);}
  assert(series.every(part=>counts.get(part.size)===part.quantity*packages),'Serideki tüm bedenler tam paket sayısında taranmalı; parça stok hareketi yapılamaz.');
 }
}
export const productPrice = (product,currency) => product.prices?.[currency] ?? (currency==='TRY'?product.salePrice:null);
export const priceInput = (product,currency) => {const price=productPrice(product,currency);return price==null?'':String(price/100);};
export const rateFor = (state,currency,date) => currency==='TRY'?1:state.exchangeRates?.find(rate=>rate.currency===currency&&rate.date===date)?.value??null;
export function saveRate(state,command){
 const {date,currency}=command;validDate(date);assert(currencies.includes(currency)&&currency!=='TRY','Kur para birimi USD veya EUR olmalı.');
 const value=Number(command.value);assert(/^\d+(\.\d{1,4})?$/.test(String(command.value))&&value>0&&value<=100000,'Kur sıfırdan büyük ve en çok dört ondalıklı olmalı.');
 const existing=state.exchangeRates.find(item=>item.date===date&&item.currency===currency);
 const before=existing?clone(existing):null;
 if(existing)existing.value=value;else state.exchangeRates.push({date,currency,value});
 state.cardAudit.push({entity:'exchangeRates',id:`${date}-${currency}`,before,after:{date,currency,value},at:new Date().toISOString(),actor:'Demo Yöneticisi'});
 state.revision++;return state;
}
export function saveCard(state,command){
 assert(['products','customers','suppliers'].includes(command.entity),'Kart türü geçersiz.');
 const list=state[command.entity],input=command.input||{},old=command.id?list.find(p=>p.id===command.id):null;
 assert(!command.id||old,'Kart bulunamadı.');
 const name=clean(input.name,150);assert(name.length>=2,'Kart adı 2–150 karakter olmalı.');
 const record={...old,name,phone:clean(input.phone,40),country:clean(input.country,80)};
 if(command.entity==='customers')record.creditLimits=Object.fromEntries(currencies.map(currency=>[currency,cents(input.creditLimits?.[currency]??String((old?.creditLimits?.[currency]||0)/100))]));
 if(command.entity==='products'){
  record.code=clean(input.code);record.barcode=clean(input.barcode);
  assert(record.code,'Stok kodu zorunlu ve en çok 80 karakter olmalı.');
  assert(!list.some(p=>p.id!==old?.id&&p.code.toUpperCase()===record.code.toUpperCase()),'Bu stok kodu zaten kayıtlı.');
  record.barcodes=Array.isArray(input.barcodes)?input.barcodes.map(value=>clean(value)).filter(Boolean):String(input.barcodes||'').split(/[\s,;]+/).map(value=>clean(value)).filter(Boolean);
  record.supplierId=String(input.supplierId||'');assert(state.suppliers.some(p=>p.id===record.supplierId),'Tedarikçi seçin.');
  const used=old&&(state.documents.some(d=>d.items.some(l=>l.productId===old.id))||state.orders.some(o=>o.items.some(l=>l.productId===old.id)));
  assert(!used||old.supplierId===record.supplierId,'Belgede kullanılan ürünün tedarikçisi değiştirilemez.');
  record.brand=clean(input.brand);record.category=clean(input.category);record.ageGroup=clean(input.ageGroup);record.size=clean(input.size);
  record.series=Array.isArray(input.series)?input.series.map(item=>({size:clean(item.size,40),quantity:quantity(item.quantity)})):[];
  assert(record.series.every(item=>item.size)&&new Set(record.series.map(item=>item.size.toLocaleUpperCase('tr'))).size===record.series.length,'Seri bedenleri boş veya tekrarlı olamaz.');
  record.unitFactor=record.series.length?record.series.reduce((sum,item)=>sum+item.quantity,0):1;
  assert(record.unitFactor<=1000000,'Serideki toplam adet desteklenen sınırı aşıyor.');
  assert(!used||JSON.stringify(old.series||[])===JSON.stringify(record.series),'Kullanılmış ürünün seri içeriği değiştirilemez; yeni stok kodu açın.');
  record.unitBarcodes=Array.isArray(input.unitBarcodes)?input.unitBarcodes.map(item=>({barcode:clean(item.barcode),size:clean(item.size,40)})):[];
  assert(!record.unitBarcodes.length||record.series.length,'Parça barkodu için seri tanımlayın.');
  assert(record.unitBarcodes.every(item=>item.barcode&&record.series.some(part=>part.size===item.size)),'Parça barkodunun bedeni ürün serisinde olmalı.');
  assert(!record.unitBarcodes.length||record.series.every(part=>record.unitBarcodes.some(item=>item.size===part.size)),'Parça taraması için serideki her bedene barkod tanımlayın.');
  assert(new Set(record.unitBarcodes.map(item=>item.size)).size===record.unitBarcodes.length,'Her beden için tek parça barkodu tanımlayın.');
  const all=productBarcodes(record);assert(new Set(all).size===all.length,'Bu barkod birden fazla kez yazılmış.');
  assert(all.every(code=>/^[\x20-\x7E]{1,80}$/.test(code)),'Barkod yazdırılabilir Latin karakterleri içermeli.');
  assert(!list.some(p=>p.id!==old?.id&&productBarcodes(p).some(value=>all.includes(value))),'Bu barkod zaten kayıtlı.');
  const referenced=[...state.documents.flatMap(d=>d.items),...state.orders.flatMap(o=>o.items)].filter(item=>item.productId===old?.id);
  assert(referenced.every(item=>!item.barcode||[record.barcode,...record.barcodes].includes(item.barcode)),'Belgede kullanılan paket barkodu değiştirilemez.');
  assert(!referenced.some(item=>item.unitScans?.length)||JSON.stringify(old.unitBarcodes||[])===JSON.stringify(record.unitBarcodes),'Belgede kullanılan parça barkodları değiştirilemez.');
  record.active=input.active!==false;
  assert(!old||record.active||!state.orders.some(o=>!['CANCELLED','COMPLETED'].includes(o.status)&&o.items.some(l=>l.productId===old.id)),'Açık teklif veya siparişteki ürünü pasifleştirmeden önce süreci sonuçlandırın.');
  assert(!old||record.active||!state.documents.some(d=>d.status==='DRAFT'&&d.items.some(l=>l.productId===old.id)),'Açık taslak belgedeki ürünü pasifleştirmeden önce taslağı sonuçlandırın.');
  record.cost=cents(input.cost);assert(record.cost>0,'Maliyet sıfırdan büyük olmalı.');
  assert(input.prices?.TRY!==''||!input.prices,'TRY satış fiyatı zorunlu.');
  record.prices=Object.fromEntries(currencies.filter(currency=>input.prices?.[currency]!==''&&input.prices?.[currency]!=null).map(currency=>[currency,cents(input.prices[currency])]));
  if(record.prices.TRY===undefined)record.prices.TRY=cents(input.salePrice);
  assert(Object.values(record.prices).every(price=>price>0),'Satış fiyatı sıfırdan büyük olmalı.');
  record.salePrice=record.prices.TRY;
  record.lastPurchasePrice=old?.lastPurchasePrice??null;
  record.stock=old?.stock||0;
 }
 if(old)list[list.indexOf(old)]=record;
 else{state.nextCardId=(state.nextCardId||1000)+1;record.id=`card-${state.nextCardId}`;list.push(record);}
 state.cardAudit.push({entity:command.entity,id:record.id,before:old||null,after:clone(record),at:new Date().toISOString(),actor:'Demo Yöneticisi'});
 state.revision++;return state;
}
