import {stockExact,stockRequestGate} from './stockProductsModel.mjs';
export {stockExact as catalogExact,stockRequestGate as catalogRequestGate};
const fail=()=>{throw Error('Katalog bilgileri doğrulanamadı. Yeniden deneyin.');};
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const text=v=>v===null||typeof v==='string';
const exact=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const goal7Run='GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d';
const versionedProduct=r=>r?.provenance?.kind==='accepted-opening'&&r.provenance.runId===goal7Run&&r.provenance.sourceAsOf==='2026-10-07'&&/^(?:VEGA_CAPTURE_20260930_01|VEGA2026)\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(r.provenance.sourceKey);
export function catalogPath({search='',barcode='',brand='',productType='',image='all',sort='code-asc',stock='all',status='all',page=1}={}){
 if(typeof search!=='string'||search.length>120||typeof barcode!=='string'||barcode.length>160||typeof brand!=='string'||brand.length>250||typeof productType!=='string'||productType.length>250||!['all','available','missing'].includes(image)||!['code-asc','code-desc','stock-desc'].includes(sort)||!['all','positive','zero','negative'].includes(stock)||!['all','active','passive'].includes(status)||!Number.isInteger(page)||page<1||page>100000)fail();
 return '/api/catalog/products?'+new URLSearchParams({search,barcode,brand,productType,image,sort,stock,status,page:String(page),limit:'50'});
}
export function catalogProduct(r,{canViewSalesPrices=false}={}){
 if(!r||!id(r.id)||typeof r.stockCode!=='string'||!text(r.productName)||typeof r.isActive!=='boolean'||!exact(r.stockQuantityExact)||!r.unit||!text(r.unit.label)||!(r.unit.sourceId===null||id(r.unit.sourceId))||!exact(r.unit.factorExact8)||typeof r.unit.verified!=='boolean'||!Array.isArray(r.barcodes)||!r.hold||typeof r.hold.blocked!=='boolean'||!Array.isArray(r.hold.reasons)||r.hold.reasons.some(x=>typeof x!=='string'||!x)||!['accepted-opening','quarantined-source'].includes(r.provenance?.kind)||(r.provenance.sourceAsOf!=='2026-09-30'&&!versionedProduct(r))||r.provenance.verified!==true||typeof r.provenance.sourceKey!=='string'||!Array.isArray(r.salePrices))fail();
 if(r.financial!==undefined||r.averageCostTryExact!==undefined||r.imageUrl!==undefined||r.unit.verified&&(r.unit.label===null||r.unit.factorExact8===null||BigInt(r.unit.factorExact8.replace('.',''))<=0n)||!r.unit.verified&&r.unit.factorExact8!==null||r.provenance.kind==='quarantined-source'&&!r.hold.blocked)fail();
 for(const b of r.barcodes)if(!id(b.id)||typeof b.value!=='string'||!b.value||typeof b.isPrimary!=='boolean'||!text(b.sourceKey))fail();
 if(new Set(r.barcodes.map(b=>b.id)).size!==r.barcodes.length)fail();
 if((!canViewSalesPrices||r.hold.blocked)&&r.salePrices.length)fail();
 for(const p of r.salePrices)if(!id(p.id)||p.type!=='sale'||!id(p.unitSourceId)||!Number.isInteger(p.tier)||p.tier<1||p.tier>6||!['TRY','USD','EUR'].includes(p.currency)||!exact(p.priceExact)||typeof p.isMainUnit!=='boolean'||!text(p.sourceKey))fail();
 if(new Set(r.salePrices.map(p=>p.id)).size!==r.salePrices.length||new Set(r.salePrices.map(p=>JSON.stringify([p.unitSourceId,p.tier,p.currency]))).size!==r.salePrices.length)fail();
 const c=r.classification;if(typeof r.displayCode!=='string'||!c||!['brand','productType','sourceName'].every(k=>c[k]===null||typeof c[k]==='string'&&c[k].trim().length>0)||typeof c.verified!=='boolean')fail();
 const accepted=r.provenance.kind==='accepted-opening'&&!r.hold.blocked;
 if(!accepted&&(c.verified||c.brand!==null||c.productType!==null||c.sourceName!==null)||accepted&&!c.verified)fail();
 let expected=r.stockCode;
 if(accepted&&c.brand!==null&&r.stockCode.endsWith(' '+c.brand)){const prefix=r.stockCode.slice(0,-c.brand.length-1);if(prefix&&!/\s$/.test(prefix))expected=prefix;}
 if(r.displayCode!==expected)fail();
 validateCatalogPhoto(r.photo,r);
 return r;
}
export function catalogEnvelope(p,{salesPermission=false,detail=false}={}){
 const m=p?.meta;
 const baseline=m?.sourceAsOf==='2026-09-30'&&m.scopeCounts?.acceptedOpening===16622,versioned=m?.sourceAsOf==='2026-10-07'&&m.scopeCounts?.acceptedOpening===16671;
 if(p?.success!==true||m?.schemaVersion!=='melisa-catalog.v1'||m.readOnly!==true||(!baseline&&!versioned)||m.freshLive!==false||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))||typeof m.canViewSalesPrices!=='boolean'||m.canViewSalesPrices&&!salesPermission||m.scopeCounts.quarantinedSource!==54||m.scopeCounts.syntheticTest!==0)fail();
 if(!versioned&&(detail?versionedProduct(p.data):Array.isArray(p.data)&&p.data.some(versionedProduct)))fail();
 if(detail){catalogProduct(p.data,m);return p;}
 if(!m.filters||!['brands','productTypes'].every(k=>Array.isArray(m.filters[k])&&m.filters[k].every(v=>typeof v==='string'&&v.trim().length>0)&&new Set(m.filters[k]).size===m.filters[k].length))fail();
 if(!Array.isArray(p.data)||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==50||m.totalPages!==Math.ceil(m.total/50)||p.data.length!==Math.min(50,Math.max(0,m.total-(m.page-1)*50)))fail();
 p.data.forEach(r=>catalogProduct(r,m));if(new Set(p.data.map(r=>r.id)).size!==p.data.length)fail();return p;
}
export function catalogMainPrice(r){
 if(!r.unit.verified||r.hold.blocked)return null;
 const candidates=r.salePrices.filter(p=>p.isMainUnit&&p.unitSourceId===r.unit.sourceId&&p.tier===1);
 return candidates.length===1&&candidates[0].priceExact!==null?candidates[0]:null;
}
export function validateCatalogPhoto(photo,row){
 if(!photo||typeof photo!=='object'||Array.isArray(photo))fail();
 if(photo.status==='missing'){
  if(Object.keys(photo).length!==4||photo.url!==null||photo.sourceKey!==null||photo.verified!==false)fail();return photo;
 }
 if(photo.status!=='available'||Object.keys(photo).length!==6||photo.verified!==true||typeof photo.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(photo.sha256)||!row||!id(row.id)||row.hold?.blocked!==false||row.provenance?.kind!=='accepted-opening'||row.provenance.verified!==true||photo.sourceKey!==row.provenance.sourceKey||photo.url!==`/api/catalog/products/${row.id}/photo?variant=preview`||photo.thumbnailUrl!==`/api/catalog/products/${row.id}/photo?variant=thumbnail`)fail();
 return photo;
}
export function catalogPhotoUrl(photo,row){if(photo?.status==='missing'){validateCatalogPhoto(photo,row);return null;}validateCatalogPhoto(photo,row);return photo.url;}
