const environmentId='e662fd94-d797-4b3b-938a-d143ad758b67';
const fail=()=>{throw Error('Örnek katalog kimliği doğrulanamadı.');};
export const isCleanCatalogLocation=l=>l?.protocol==='http:'&&['127.0.0.1','localhost','192.168.1.46','100.87.188.3'].includes(l.hostname)&&l.port==='5244';
export function isCleanCatalogMeta(meta,location=globalThis.location){return isCleanCatalogLocation(location)&&meta?.environment==='CLEAN_SYNTHETIC_TEST'&&meta.environmentId===environmentId&&meta.synthetic===true&&meta.actualT1===false&&meta.externalOperations===false;}
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const exact=v=>typeof v==='string'&&/^-?(0|[1-9]\d{0,19})\.\d{8}$/.test(v);
export function cleanCatalogProduct(r,m){
 if(!id(r?.id)||typeof r.stockCode!=='string'||typeof r.productName!=='string'||typeof r.isActive!=='boolean'||!exact(r.stockQuantityExact)||r.unit?.label!=='ADET'||r.unit.sourceId!=='1'||r.unit.factorExact8!=='1.00000000'||r.unit.verified!==true||r.provenance?.kind!=='synthetic-test'||r.provenance.verified!==true||r.provenance.sourceKey!=='SYNTHETIC/20261022/products/'+r.id||r.provenance.sourceAsOf!=='2026-10-22'||r.provenance.runId!==null||r.hold?.blocked!==false||!Array.isArray(r.hold.reasons)||r.hold.reasons.length||!Array.isArray(r.barcodes)||!Array.isArray(r.salePrices)||r.financial!==undefined||r.imageUrl!==undefined)fail();
 for(const b of r.barcodes)if(!id(b.id)||typeof b.value!=='string'||!b.value||typeof b.isPrimary!=='boolean'||b.sourceKey!=='SYNTHETIC/20261022/barcodes/'+b.id)fail();
 const c=r.classification;if(!c||c.verified!==true||[c.brand,c.productType,c.sourceName].some(v=>typeof v!=='string'||!v.trim())||typeof r.displayCode!=='string')fail();
 const prefix=r.stockCode.endsWith(' '+c.brand)?r.stockCode.slice(0,-c.brand.length-1):null;if(r.displayCode!==(prefix&&!/\s$/.test(prefix)?prefix:r.stockCode))fail();
 if(!m.canViewSalesPrices&&r.salePrices.length)fail();
 for(const p of r.salePrices)if(!id(p.id)||p.type!=='sale'||p.unitSourceId!=='1'||p.tier!==1||!['TRY','USD','EUR'].includes(p.currency)||!exact(p.priceExact)||p.isMainUnit!==true||p.sourceKey!==r.provenance.sourceKey+'/PRICE/sale/1/1/'+p.currency)fail();
 if(new Set(r.salePrices.map(p=>p.id)).size!==r.salePrices.length||new Set(r.barcodes.map(b=>b.id)).size!==r.barcodes.length)fail();
 if(r.photo?.status==='available'){if(r.photo.verified!==true||r.photo.sourceKey!==r.provenance.sourceKey||r.photo.url!==`/api/catalog/products/${r.id}/photo?variant=preview`||r.photo.thumbnailUrl!==`/api/catalog/products/${r.id}/photo?variant=thumbnail`||!/^[a-f0-9]{64}$/.test(r.photo.sha256))fail();}
 else if(r.photo?.status!=='missing'||r.photo.url!==null||r.photo.sourceKey!==null||r.photo.verified!==false)fail();return r;
}
export function cleanCatalogEnvelope(p,{salesPermission=false,detail=false}={}){
 const m=p?.meta;if(p?.success!==true||m.schemaVersion!=='melisa-catalog.v1'||m.readOnly!==true||m.freshLive!==false||m.sourceAsOf!=='2026-10-22'||!Number.isFinite(Date.parse(m.readAt))||typeof m.canViewSalesPrices!=='boolean'||m.canViewSalesPrices&&!salesPermission||m.scopeCounts?.acceptedOpening!==0||m.scopeCounts.quarantinedSource!==0||!Number.isSafeInteger(m.scopeCounts.syntheticTest)||m.scopeCounts.syntheticTest<1)fail();
 if(detail){cleanCatalogProduct(p.data,m);return p;}
 if(!m.filters||!['brands','productTypes'].every(k=>Array.isArray(m.filters[k])&&m.filters[k].every(v=>typeof v==='string'&&v.trim()))||!Array.isArray(p.data)||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==50||m.totalPages!==Math.ceil(m.total/50)||p.data.length!==Math.min(50,Math.max(0,m.total-(m.page-1)*50)))fail();
 p.data.forEach(r=>cleanCatalogProduct(r,m));if(new Set(p.data.map(r=>r.id)).size!==p.data.length)fail();return p;
}
