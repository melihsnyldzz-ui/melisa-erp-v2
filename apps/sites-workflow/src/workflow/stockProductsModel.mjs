const decimal=/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/;
const invalid=()=>{throw Error('Ürün ve stok yanıtı doğrulanamadı. Yeniden deneyin.');};
const text=v=>v===null||typeof v==='string';
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const exact=v=>v===null||typeof v==='string'&&decimal.test(v);
export function stockExact(value){
 if(value===null)return 'Bilinmiyor';
 if(!exact(value))invalid();
 const [whole,fraction]=value.split('.');
 const trimmed=fraction.replace(/0+$/,'');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(trimmed?','+trimmed:'');
}
export function stockSign(value){
 if(value===null)return 'Stok bilinmiyor';
 if(!exact(value))invalid();
 return !/[1-9]/.test(value)?'Stok sıfır':value.startsWith('-')?'Negatif stok':'Pozitif stok';
}
export function stockProductsPath({search='',barcode='',stock='all',status='all',page=1}={}){
 if(typeof search!=='string'||search.length>120||typeof barcode!=='string'||barcode.length>160||!['all','positive','zero','negative'].includes(stock)||!['all','active','passive'].includes(status)||!Number.isInteger(page)||page<1||page>100000)invalid();
 return '/api/stock-products?'+new URLSearchParams({search,barcode,stock,status,page:String(page),limit:'25'});
}
export function stockProduct(row,{canViewFinance=false}={}){
 if(!row||!id(row.id)||typeof row.stockCode!=='string'||!text(row.productName)||typeof row.isActive!=='boolean'||!exact(row.stockQuantityExact)||!row.unit||!text(row.unit.label)||!(row.unit.sourceId===null||id(row.unit.sourceId))||!exact(row.unit.factorExact8)||typeof row.unit.verified!=='boolean'||!Array.isArray(row.barcodes)||!text(row.imageUrl)||!['accepted-opening','synthetic-test','quarantined-source'].includes(row.provenance?.kind)||!text(row.provenance.sourceKey)||!text(row.provenance.runId)||!text(row.provenance.sourceAsOf)||typeof row.provenance.verified!=='boolean'||![true,false,null].includes(row.hold?.blocked)||!Array.isArray(row.hold.reasons)||row.hold.reasons.some(r=>typeof r!=='string'||!r))invalid();
 if(row.provenance.verified!==true)invalid();
 if(row.provenance.kind==='synthetic-test'&&({'301984':'TEST-V70-20260929-P','301985':'TEST-V70-GOODS-P','301986':'TEST-DAILY-PURCHASE'})[row.id]!==row.stockCode)invalid();
 if(row.provenance.kind==='synthetic-test'?(row.provenance.sourceAsOf!==null||row.provenance.runId!==null||row.provenance.sourceKey!==null):(row.provenance.sourceAsOf!=='2026-09-30'||row.provenance.runId!=='VEGA-OPENING-TEST-20261004-06'||!/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(row.provenance.sourceKey)))invalid();
 if(row.provenance.kind==='quarantined-source'&&row.hold.blocked!==true)invalid();
 if(!row.unit.verified&&row.unit.factorExact8!==null||row.unit.verified&&(row.unit.label===null||row.unit.factorExact8===null||BigInt(row.unit.factorExact8.replace('.',''))<=0n))invalid();
 const barcodeIds=new Set();
 for(const b of row.barcodes){if(!id(b.id)||typeof b.value!=='string'||typeof b.isPrimary!=='boolean'||!text(b.sourceKey)||barcodeIds.has(b.id))invalid();barcodeIds.add(b.id);}
 if(!canViewFinance&&row.financial!==undefined)invalid();
 if(canViewFinance&&row.financial!==undefined){if(!row.financial||!exact(row.financial.averageCostTryExact)||!Array.isArray(row.financial.prices))invalid();for(const p of row.financial.prices){if(!id(p.id)||!['purchase','sale'].includes(p.type)||!(p.unitSourceId===null||id(p.unitSourceId))||!Number.isInteger(p.tier)||!['TRY','USD','EUR'].includes(p.currency)||!exact(p.priceExact)||typeof p.isMainUnit!=='boolean'||!text(p.sourceKey)||(p.type==='purchase'?(p.tier!==0||p.unitSourceId!==null):(p.tier<1||p.tier>6||p.unitSourceId===null)))invalid();}if(new Set(row.financial.prices.map(p=>p.id)).size!==row.financial.prices.length||new Set(row.financial.prices.map(p=>JSON.stringify([p.type,p.unitSourceId,p.tier,p.currency]))).size!==row.financial.prices.length)invalid();}
 return row;
}
export function stockProductsEnvelope(payload,{financePermission=false,detail=false}={}){
 const m=payload?.meta;
 if(payload?.success!==true||m?.readOnly!==true||m?.sourceAsOf!=='2026-09-30'||m?.freshLive!==false||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))||typeof m.canViewFinance!=='boolean'||m.canViewFinance&&!financePermission)invalid();
 if(!m.scopeCounts||m.scopeCounts.acceptedOpening!==16622||m.scopeCounts.syntheticTest!==3||m.scopeCounts.quarantinedSource!==54)invalid();
 if(detail){stockProduct(payload.data,{canViewFinance:m.canViewFinance});return payload;}
 if(!Array.isArray(payload.data)||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==25||!Number.isInteger(m.totalPages)||m.totalPages!==Math.ceil(m.total/m.limit)||payload.data.length!==Math.min(25,Math.max(0,m.total-(m.page-1)*25)))invalid();
 payload.data.forEach(r=>stockProduct(r,{canViewFinance:m.canViewFinance}));
 if(new Set(payload.data.map(r=>r.id)).size!==payload.data.length)invalid();
 return payload;
}
export function stockRequestGate(){let generation=0,active=true;return {next:()=>++generation,current:n=>active&&n===generation,dispose:()=>{active=false;generation++;}};}
export function stockImageSource(value){
 if(value===null)return null;
 if(typeof value!=='string')return null;
 // Referenced images only; never permit an executable or credential-bearing URL.
 if(value.startsWith('/')&&!value.startsWith('//')&&!/[\u0000-\u0020\\]/.test(value))return value;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?value:null;}catch{return null;}
}
