import {operationCopyFromMeta} from './isolatedOperationCopyModel.mjs';

const fail=()=>{throw Error('Sayım bilgileri doğrulanamadı. Ürünleri yenileyerek yeniden kontrol edin.');};
const whole=value=>Number.isSafeInteger(value)&&value>=0;
const fingerprint=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);

// Normal copy pages use native stock quantities. The bounded rehearsal limit
// applies to the difference, not to the absolute quantity already in stock.
export function dailyCopyContext(data,flow,options){
 const profile=operationCopyFromMeta(data?.meta,options);
 if(!profile)return null;
 if(data.operationOrigin!=='ISOLATED_TEST_COPY'||!['count','purchase'].includes(flow)||data.scope?.flow!==flow||!profile.products.some(p=>p.id===String(data.scope.product_id)&&p.stockCode===data.scope.stock_code))fail();
 if(flow==='count'){
  if(!Array.isArray(data.countProducts)||data.countProducts.length!==profile.products.length||new Set(data.countProducts.map(p=>String(p.id))).size!==data.countProducts.length)fail();
  for(const row of data.countProducts){
   const sealed=profile.products.find(p=>p.id===String(row.id));
   if(!sealed||row.stockCode!==sealed.stockCode||row.unit!==sealed.unit||!whole(row.stockQuantity)||!fingerprint(row.movementFingerprint)||row.barcode!==undefined&&row.barcode!==null&&!sealed.barcodes.includes(row.barcode))fail();
  }
 }
 return profile;
}

export function dailyCopyCountLines(lines,data,profile){
 if(!profile)return lines;
 if(!Array.isArray(lines)||lines.length<1||lines.length>profile.products.length||new Set(lines.map(l=>String(l.productId))).size!==lines.length)fail();
 for(const line of lines){
  const sealed=profile.products.find(p=>p.id===String(line.productId)),current=data.countProducts.find(p=>String(p.id)===String(line.productId));
  if(!sealed||!current||line.stockCode!==sealed.stockCode||!whole(line.physical)||!whole(line.system)||line.system!==current.stockQuantity||Math.abs(line.physical-line.system)>5||!fingerprint(line.movementFingerprint)||line.movementFingerprint!==current.movementFingerprint)fail();
  const reason=typeof line.reason==='string'?line.reason.trim():'';
  if(line.physical!==line.system&&(reason.length<3||reason.length>500))fail();
 }
 return lines;
}
