import {stockExact,stockImageSource,stockRequestGate} from './stockProductsModel.mjs';
export {stockExact as catalogExact,stockRequestGate as catalogRequestGate};
const fail=()=>{throw Error('Katalog bilgileri doğrulanamadı. Yeniden deneyin.');};
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const text=v=>v===null||typeof v==='string';
const exact=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(v);
export function catalogPath({search='',barcode='',stock='all',status='all',page=1}={}){
 if(typeof search!=='string'||search.length>120||typeof barcode!=='string'||barcode.length>160||!['all','positive','zero','negative'].includes(stock)||!['all','active','passive'].includes(status)||!Number.isInteger(page)||page<1||page>100000)fail();
 return '/api/catalog/products?'+new URLSearchParams({search,barcode,stock,status,page:String(page),limit:'50'});
}
export function catalogProduct(r,{canViewSalesPrices=false}={}){
 if(!r||!id(r.id)||typeof r.stockCode!=='string'||!text(r.productName)||typeof r.isActive!=='boolean'||!exact(r.stockQuantityExact)||!r.unit||!text(r.unit.label)||!(r.unit.sourceId===null||id(r.unit.sourceId))||!exact(r.unit.factorExact8)||typeof r.unit.verified!=='boolean'||!Array.isArray(r.barcodes)||!r.hold||typeof r.hold.blocked!=='boolean'||!Array.isArray(r.hold.reasons)||r.hold.reasons.some(x=>typeof x!=='string'||!x)||!['accepted-opening','quarantined-source'].includes(r.provenance?.kind)||r.provenance.sourceAsOf!=='2026-09-30'||r.provenance.verified!==true||typeof r.provenance.sourceKey!=='string'||!Array.isArray(r.salePrices))fail();
 if(r.financial!==undefined||r.averageCostTryExact!==undefined||r.imageUrl!==undefined||r.unit.verified&&(r.unit.label===null||r.unit.factorExact8===null||BigInt(r.unit.factorExact8.replace('.',''))<=0n)||!r.unit.verified&&r.unit.factorExact8!==null||r.provenance.kind==='quarantined-source'&&!r.hold.blocked)fail();
 for(const b of r.barcodes)if(!id(b.id)||typeof b.value!=='string'||!b.value||typeof b.isPrimary!=='boolean'||!text(b.sourceKey))fail();
 if(new Set(r.barcodes.map(b=>b.id)).size!==r.barcodes.length)fail();
 if((!canViewSalesPrices||r.hold.blocked)&&r.salePrices.length)fail();
 for(const p of r.salePrices)if(!id(p.id)||p.type!=='sale'||!id(p.unitSourceId)||!Number.isInteger(p.tier)||p.tier<1||p.tier>6||!['TRY','USD','EUR'].includes(p.currency)||!exact(p.priceExact)||typeof p.isMainUnit!=='boolean'||!text(p.sourceKey))fail();
 if(new Set(r.salePrices.map(p=>p.id)).size!==r.salePrices.length||new Set(r.salePrices.map(p=>JSON.stringify([p.unitSourceId,p.tier,p.currency]))).size!==r.salePrices.length)fail();
 const photo=r.photo;
 // This contract prepares the image field; verified image delivery is a separate step.
 if(!photo||photo.status!=='missing'||photo.url!==null||photo.sourceKey!==null||photo.verified!==false)fail();
 return r;
}
export function catalogEnvelope(p,{salesPermission=false,detail=false}={}){
 const m=p?.meta;
 if(p?.success!==true||m?.schemaVersion!=='melisa-catalog.v1'||m.readOnly!==true||m.sourceAsOf!=='2026-09-30'||m.freshLive!==false||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))||typeof m.canViewSalesPrices!=='boolean'||m.canViewSalesPrices&&!salesPermission||m.scopeCounts?.acceptedOpening!==16622||m.scopeCounts.quarantinedSource!==54||m.scopeCounts.syntheticTest!==0)fail();
 if(detail){catalogProduct(p.data,m);return p;}
 if(!Array.isArray(p.data)||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==50||m.totalPages!==Math.ceil(m.total/50)||p.data.length!==Math.min(50,Math.max(0,m.total-(m.page-1)*50)))fail();
 p.data.forEach(r=>catalogProduct(r,m));if(new Set(p.data.map(r=>r.id)).size!==p.data.length)fail();return p;
}
export function catalogMainPrice(r){
 if(!r.unit.verified||r.hold.blocked)return null;
 const candidates=r.salePrices.filter(p=>p.isMainUnit&&p.unitSourceId===r.unit.sourceId&&p.tier===1);
 return candidates.length===1&&candidates[0].priceExact!==null?candidates[0]:null;
}
export function catalogPhotoUrl(photo){return photo?.verified===true?stockImageSource(photo.url):null;}
