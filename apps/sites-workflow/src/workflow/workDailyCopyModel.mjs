import {operationCopyFromMeta,operationCopyDailySelection} from './isolatedOperationCopyModel.mjs';
import {isCleanCatalogLocation} from './cleanSyntheticCatalogModel.mjs';

const fail=()=>{throw Error('Sayım bilgileri doğrulanamadı. Ürünleri yenileyerek yeniden kontrol edin.');};
const whole=value=>Number.isSafeInteger(value)&&value>=0;
const fingerprint=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);

export function cleanDailyControls(meta,user,flow,{location=globalThis.location}={}){
 if(meta?.cleanDaily===undefined)return null;
 const d=meta.cleanDaily,id=String(user?.id),administrator=id==='10018'&&user?.username==='semih'&&String(user.role?.id)==='28'&&user.role.code==='clean_test_administrator'&&user.isAdmin!==true&&user.testAdminSession!==true,staff=id==='21'||administrator,supervisor=id==='22'||administrator;
 if(meta.environment!=='CLEAN_SYNTHETIC_TEST'||meta.environmentId?.toLowerCase()!=='e662fd94-d797-4b3b-938a-d143ad758b67'||meta.synthetic!==true||meta.actualT1!==false||meta.externalOperations!==false||!isCleanCatalogLocation(location)||!['count','purchase'].includes(flow)||d.date!=='2026-10-22'||d.actorId!==id||(!staff&&!supervisor)||user.role?.code!==(administrator?'clean_test_administrator':staff?'clean_test_counter':'clean_test_inventory_supervisor')||d.canDraft!==staff||d.canReview!==supervisor||!Array.isArray(user.permissions)||!user.permissions.includes(flow==='count'?'product.view':'purchase.view'))fail();
 if(supervisor&&!user.permissions.includes(flow==='count'?'stock.adjust':'purchase.cancel'))fail();
 return {date:d.date,canDraft:staff,canReview:supervisor};
}

// Normal copy pages use native stock quantities. The bounded rehearsal limit
// applies to the difference, not to the absolute quantity already in stock.
export function dailyCopyContext(data,flow,options){
 const profile=operationCopyFromMeta(data?.meta,options);
 if(!profile)return null;
 const daily=operationCopyDailySelection(profile,data.meta),products=daily?profile.products.filter(p=>daily.productIds.includes(p.id)):profile.products;
 if(data.operationOrigin!=='ISOLATED_TEST_COPY'||!['count','purchase'].includes(flow)||data.scope?.flow!==flow||!products.some(p=>p.id===String(data.scope.product_id)&&p.stockCode===data.scope.stock_code))fail();
 if(flow==='count'){
  if(!Array.isArray(data.countProducts)||data.countProducts.length!==products.length||new Set(data.countProducts.map(p=>String(p.id))).size!==data.countProducts.length)fail();
  for(const row of data.countProducts){
   const sealed=products.find(p=>p.id===String(row.id));
   if(!sealed||row.stockCode!==sealed.stockCode||row.unit!==sealed.unit||!whole(row.stockQuantity)||!fingerprint(row.movementFingerprint)||row.barcode!==undefined&&row.barcode!==null&&!sealed.barcodes.includes(row.barcode))fail();
  }
 }
 return profile;
}

export function dailyCopyCountLines(lines,data,profile){
 if(!profile)return lines;
 const daily=operationCopyDailySelection(profile,data.meta),products=daily?profile.products.filter(p=>daily.productIds.includes(p.id)):profile.products;
 if(!Array.isArray(lines)||lines.length<1||lines.length>products.length||new Set(lines.map(l=>String(l.productId))).size!==lines.length)fail();
 for(const line of lines){
  const sealed=products.find(p=>p.id===String(line.productId)),current=data.countProducts.find(p=>String(p.id)===String(line.productId));
  if(!sealed||!current||line.stockCode!==sealed.stockCode||!whole(line.physical)||!whole(line.system)||line.system!==current.stockQuantity||Math.abs(line.physical-line.system)>5||!fingerprint(line.movementFingerprint)||line.movementFingerprint!==current.movementFingerprint)fail();
  const reason=typeof line.reason==='string'?line.reason.trim():'';
  if(line.physical!==line.system&&(reason.length<3||reason.length>500))fail();
 }
 return lines;
}
