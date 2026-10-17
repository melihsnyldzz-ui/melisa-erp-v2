const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:409});};
export const cartonId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v);
export const cartonRevision=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).every(k=>names.includes(k));
export function cartonQuantity(value){
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,8})\.\d{3}$/.test(value))fail('CARTON_QUANTITY','Miktarı üç ondalıkla doğrulayın.');
 return BigInt(value.replace('.',''));
}
export const cartonExact=value=>`${value/1000n}.${String(value%1000n).padStart(3,'0')}`;
export function cartonInput(value){const raw=String(value??'').trim().replace(',','.');if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(raw))fail('CARTON_QUANTITY','Geçerli bir miktar girin.');const [w,f='']=raw.split('.');return w+'.'+f.padEnd(3,'0');}
export function validateCartonSource(source){
 if(!object(source)||source.schemaVersion!=='melisa-carton-source.v1'||source.status!=='FINALIZED'||!cartonId(source.invoiceId)||!cartonRevision(source.revision)||typeof source.documentNo!=='string'||typeof source.customerName!=='string'||!Array.isArray(source.items)||!source.items.length||source.items.length>200)fail('CARTON_SOURCE','Tamamlanmış fiş bilgileri doğrulanamadı.');
 const seen=new Set();for(const item of source.items){
  if(!object(item)||!cartonId(item.itemId)||!cartonId(item.productId)||seen.has(item.itemId)||typeof item.stockCode!=='string'||!item.stockCode||typeof item.name!=='string'||cartonQuantity(item.requiredExact3)<=0n||item.unit?.verified!==true||typeof item.unit.label!=='string'||!item.unit.label||typeof item.unit.factorExact8!=='string'||!/^(?:0|[1-9]\d{0,8})\.\d{8}$/.test(item.unit.factorExact8)||BigInt(item.unit.factorExact8.replace('.',''))<=0n||!Array.isArray(item.barcodes)||item.barcodes.some(b=>typeof b!=='string'||!b||b.length>128)||new Set(item.barcodes).size!==item.barcodes.length)fail('CARTON_SOURCE_ITEM','Fiş satırı, birim veya barkod bilgisi doğrulanamadı.');seen.add(item.itemId);
 }
 return source;
}
export function validateCartons(cartons,source){
 validateCartonSource(source);if(!Array.isArray(cartons)||cartons.length>100)fail('CARTON_LIMIT','En fazla 100 koli kaydedilebilir.');
 const ids=new Set(),totals=new Map(source.items.map(i=>[i.itemId,0n]));
 for(const box of cartons){if(!keys(box,['id','label','allocations'])||typeof box.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(box.id)||ids.has(box.id)||typeof box.label!=='string'||!box.label.trim()||box.label.length>80||!Array.isArray(box.allocations)||box.allocations.length>200)fail('CARTON_INVALID','Koli bilgisi geçersiz.');ids.add(box.id);const lines=new Set();for(const a of box.allocations){if(!keys(a,['itemId','quantityExact3'])||!totals.has(a.itemId)||lines.has(a.itemId)||cartonQuantity(a.quantityExact3)<=0n)fail('CARTON_ITEM','Koli satırı fişe ait değil veya miktarı geçersiz.');lines.add(a.itemId);totals.set(a.itemId,totals.get(a.itemId)+cartonQuantity(a.quantityExact3));}}
 for(const item of source.items)if(totals.get(item.itemId)>cartonQuantity(item.requiredExact3))fail('CARTON_EXCESS','Kolilerdeki toplam miktar fişteki miktarı aşamaz.');
 return cartons;
}
export function cartonProgress(source,cartons){validateCartons(cartons,source);const lines=source.items.map(i=>{const picked=cartons.reduce((sum,b)=>sum+b.allocations.filter(a=>a.itemId===i.itemId).reduce((s,a)=>s+cartonQuantity(a.quantityExact3),0n),0n),required=cartonQuantity(i.requiredExact3);return {...i,pickedExact3:cartonExact(picked),remainingExact3:cartonExact(required-picked)};});return {lines,complete:lines.every(l=>l.remainingExact3==='0.000'),cartonCount:cartons.length};}
export function setCartonAllocation(source,cartons,cartonId,itemId,quantityExact3){const next=structuredClone(cartons),box=next.find(b=>b.id===cartonId);if(!box)fail('CARTON_NOT_FOUND','Koli bulunamadı.');const value=cartonQuantity(quantityExact3);box.allocations=box.allocations.filter(a=>a.itemId!==itemId);if(value>0n)box.allocations.push({itemId,quantityExact3});validateCartons(next,source);return next;}
export function matchCartonBarcode(source,barcode){validateCartonSource(source);if(typeof barcode!=='string'||!barcode.trim()||barcode.length>128)fail('CARTON_BARCODE','Barkod okunamadı.');const code=barcode.trim();return source.items.filter(i=>i.barcodes.includes(code));}
