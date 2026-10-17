import {createHash} from 'node:crypto';
export const cardHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=v=>String(v??'').trim();
const key=v=>text(v).toLocaleUpperCase('tr');
const money=v=>({'$':'USD',USD:'USD','€':'EUR',EUR:'EUR',TL:'TRY',TRY:'TRY'}[text(v)]||'XXX');
export function prepareCards(source){
 if(source.source!=='VEGA2026/F0102'||source.sourceReadOnly!==true||!source.products?.length||source.products.length>50000)throw Error('CARD_SOURCE_INVALID');
 const groups=new Map(),issues=[],warnings=[],cards=[],codes=new Map(),bars=new Map();
 for(const u of source.units){const list=groups.get(u.sourceId)||[];list.push(u);groups.set(u.sourceId,list);}
 for(const p of source.products){
  const units=[...(groups.get(p.sourceId)||[])].sort((a,b)=>Number(b.isDefault)-Number(a.isDefault)||Number(b.isBase)-Number(a.isBase)||a.unitId-b.unitId);
  const primary=units.find(u=>u.isDefault)||units[0],stockCode=text(p.stockCode);
  const warn=message=>warnings.push({sourceId:p.sourceId,stockCode,message});
  if(!primary)warn('Vega’da birim/fiyat tanımı yok; birim TANIMSIZ, para birimi XXX (bilinmiyor), fiyat 0. Satışa kapalı.');
  if(!text(p.name))warn('Ürün adı boş; kart adı olarak stok kodu gösterilir.');
  if(units.filter(u=>u.isDefault).length>1)issues.push({stockCode,message:'Birden fazla varsayılan birim var.'});
  const card={sourceId:Number(p.sourceId),stockCode,name:text(p.name)||stockCode,brand:text(p.brand)||null,category:text(p.category)||null,unit:text(primary?.unit)||'TANIMSIZ',currency:money(primary?.currency),price:primary?Number(primary.price):0,
   primaryUnitId:primary?.unitId||null,barcodes:[...new Set(units.map(u=>text(u.barcode)).filter(Boolean))],sourceUnits:units,saleProhibited:Boolean(p.saleProhibited)};
  card.saleEligible=Boolean(primary&&primary.isDefault&&primary.isBase&&card.unit==='ADET'&&primary.factor===1&&primary.taxRate===0&&card.price>0&&card.currency!=='XXX'&&!card.saleProhibited);
  if(primary&&!card.saleEligible)warn('Kart dahil; birim, fiyat, vergi veya satış kısıtı nedeniyle terminal satışına uygun değil.');
  if(primary&&units.some(u=>u.unit!==primary.unit||u.factor!==primary.factor||u.price!==primary.price||money(u.currency)!==card.currency||u.taxRate!==primary.taxRate))warn('Ek barkodlarda mevcut test kuralı uygulanır: varsayılan birimin fiyatı ve birimi kullanılır.');
  for(const [field,max] of [['stockCode',50],['name',250],['brand',120],['category',120],['unit',20]])if((card[field]?.length||0)>max||(['stockCode','name'].includes(field)&&!card[field]))issues.push({stockCode,message:field+' alanı uygun uzunlukta değil.'});
  if(!Number.isSafeInteger(card.sourceId)||card.sourceId<=0||!Number.isFinite(card.price)||card.price<0||card.price>=1e14)issues.push({stockCode,message:'Kaynak kimliği veya fiyat geçersiz.'});
  if(codes.has(key(stockCode)))issues.push({stockCode,message:'Vega’da stok kodu çakışıyor.'});codes.set(key(stockCode),card.sourceId);
  for(const barcode of card.barcodes){
   if(barcode.length>80||/[\x00-\x1f]/.test(barcode))issues.push({stockCode,message:'Barkod biçimi geçersiz.'});
   if(bars.has(key(barcode))&&bars.get(key(barcode))!==card.sourceId)issues.push({stockCode,message:'Vega’da barkod başka karta da bağlı: '+barcode});
   bars.set(key(barcode),card.sourceId);
  }
  cards.push(card);
 }
 return {cards,warnings,issues};
}
export const cardFields=['stockCode','name','brand','category','unit','currency','price','isActive','isDeleted'];
export function currentCard(p,barcodes){
 return {stockCode:p.stock_code,name:p.name,brand:p.brand,category:p.category,unit:p.unit,currency:p.currency_code,price:Number(p.sales_price),isActive:Boolean(p.is_active),isDeleted:Boolean(p.is_deleted),barcodes:barcodes.filter(b=>Number(b.product_id)===Number(p.id)&&b.is_active).sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)||a.id-b.id).map(b=>b.barcode)};
}
export function planCards(source,target){
 const prepared=prepareCards(source),issues=[...prepared.issues],byId=new Map(target.products.map(p=>[Number(p.id),p])),mapped=new Map(),reverse=new Map();
 for(const a of target.mappings){
  const id=Number(a.entity_id),data=JSON.parse(a.after_json),sourceId=Number(data.sourceId);
  if(!String(data.source||'').startsWith('VEGA2026/F0102')){issues.push({message:'Kaynak eşlemesi başka firmaya ait.'});continue;}
  if((mapped.has(sourceId)&&mapped.get(sourceId)!==id)||(reverse.has(id)&&reverse.get(id)!==sourceId))issues.push({message:'Kaynak kimliği eşlemesi çakışıyor.'});
  mapped.set(sourceId,id);reverse.set(id,sourceId);
 }
 const localCodes=new Map(),localBars=new Map(),barsByProduct=new Map(),latestByProduct=new Map(),beforeByProduct=new Map();
 for(const p of target.products)localCodes.set(key(p.stock_code),Number(p.id));
 for(const b of target.barcodes){if(b.is_active)localBars.set(key(b.barcode),Number(b.product_id));const a=barsByProduct.get(Number(b.product_id))||[];a.push(b);barsByProduct.set(Number(b.product_id),a);}
 for(const a of target.mappings)if(!latestByProduct.has(Number(a.entity_id))||latestByProduct.get(Number(a.entity_id)).id<a.id)latestByProduct.set(Number(a.entity_id),a);
 for(const p of target.products)beforeByProduct.set(Number(p.id),currentCard(p,barsByProduct.get(Number(p.id))||[]));
 const updates=[];
 for(const card of prepared.cards){
  const id=mapped.get(card.sourceId)||null,old=id?byId.get(id):null;
  if(id&&!old){issues.push({stockCode:card.stockCode,message:'Eşlenen yerel ürün bulunamadı.'});continue;}
  if(localCodes.has(key(card.stockCode))&&localCodes.get(key(card.stockCode))!==id)issues.push({stockCode:card.stockCode,message:'Yerel stok kodu başka kimlikte; otomatik birleştirilmez.'});
  for(const barcode of card.barcodes)if(localBars.has(key(barcode))&&localBars.get(key(barcode))!==id)issues.push({stockCode:card.stockCode,message:'Yerel barkod başka ürüne bağlı: '+barcode});
  const before=old?beforeByProduct.get(id):null,after={...card,isActive:true,isDeleted:false};
  const fields=before?[...cardFields.filter(f=>JSON.stringify(before[f])!==JSON.stringify(after[f])),...(JSON.stringify(before.barcodes)!==JSON.stringify(card.barcodes)?['barcodes']:[])]:['new'];
  // Also retain revised raw source metadata/eligibility even when display fields match.
  const latest=latestByProduct.get(id);
  const previous=latest?JSON.parse(latest.after_json):null;
  const metadataChanged=previous?.cardHash!==cardHash(card);
  updates.push({id,sourceId:card.sourceId,stockCode:card.stockCode,name:card.name,before,after,fields,changed:!old||fields.length>0||metadataChanged});
 }
 const includedIds=new Set(updates.map(u=>u.id));
 return {sourceAt:source.at,sourceHash:cardHash(prepared.cards),targetHash:cardHash({products:target.products.map(p=>({id:Number(p.id),...beforeByProduct.get(Number(p.id))})),barcodes:target.barcodes.map(b=>({id:b.id,product_id:b.product_id,barcode:b.barcode,is_active:b.is_active,is_primary:b.is_primary})),mappings:target.mappings}),updates,issues,warnings:prepared.warnings,counts:{activeSource:prepared.cards.length,new:updates.filter(u=>!u.id).length,updated:updates.filter(u=>u.id&&u.changed).length,changed:updates.filter(u=>u.changed).length,unchanged:updates.filter(u=>!u.changed).length,terminalEligible:prepared.cards.filter(c=>c.saleEligible).length,warningCount:prepared.warnings.length,preservedOutsideSource:target.products.filter(p=>!includedIds.has(Number(p.id))).length}};
}
