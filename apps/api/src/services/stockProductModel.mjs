export const stockProductError=(code='STOCK_PRODUCT_UNAVAILABLE',message='Ürün okuma kanıtı şu anda doğrulanamıyor.',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export function parseStockProductId(value){
  if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||BigInt(value)>9223372036854775807n)throw stockProductError('STOCK_PRODUCT_ID_INVALID','Geçerli ürün kimliği gerekli.',400);
  return value;
}
export function parseStockProductQuery(query={}){
  const invalid=()=>stockProductError('STOCK_PRODUCT_QUERY_INVALID','Geçerli ürün araması ve filtreler gerekli.',400);
  if(!query||Object.keys(query).some(k=>!['search','barcode','stock','status','page','limit'].includes(k)))throw invalid();
  const text=(k,max)=>{const v=query[k]??'';if(typeof v!=='string'||v.length>max)throw invalid();return v;};
  const number=(k,fallback,max)=>{if(query[k]===undefined)return fallback;const v=query[k];if(typeof v!=='string'||!/^[1-9]\d*$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)>max)throw invalid();return Number(v);};
  const stock=query.stock??'all',status=query.status??'all';
  if(!['all','positive','zero','negative'].includes(stock)||!['all','active','passive'].includes(status))throw invalid();
  return {search:text('search',120),barcode:text('barcode',160),stock,status,page:number('page',1,100000),limit:number('limit',25,50)};
}
const fail=()=>{throw stockProductError();};
const id=v=>{try{return parseStockProductId(v);}catch{return fail();}};
const text=(v,nullable=false)=>{if(nullable&&v===null)return null;if(typeof v!=='string')return fail();return v;};
const bool=v=>{if(typeof v!=='boolean')return fail();return v;};
const exact=v=>{if(v===null)return null;if(typeof v!=='string'||!/^\-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(v))return fail();return v;};
export const stockReadTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function stockProductDto(row,{sqlFinance=false,canViewFinance=false}={}){
  if(!row||typeof row!=='object'||!row.unit||!row.provenance||!row.hold||!Array.isArray(row.barcodes))return fail();
  const p=row.provenance,u=row.unit,h=row.hold;
  if(!['accepted-opening','synthetic-test','quarantined-source'].includes(p.kind)||p.verified!==true)return fail();
  const syntheticCards={'301984':'TEST-V70-20260929-P','301985':'TEST-V70-GOODS-P','301986':'TEST-DAILY-PURCHASE'};
  if(p.kind==='synthetic-test'&&syntheticCards[row.id]!==row.stockCode)return fail();
  if(p.kind==='synthetic-test'?(p.sourceAsOf!==null||p.runId!==null||p.sourceKey!==null)
    :(p.sourceAsOf!=='2026-09-30'||p.runId!=='VEGA-OPENING-TEST-20261004-06'||typeof p.sourceKey!=='string'||!/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(p.sourceKey)))return fail();
  const unit={label:text(u.label,true),sourceId:u.sourceId===null?null:id(u.sourceId),factorExact8:exact(u.factorExact8),verified:bool(u.verified)};
  if(unit.verified&&(unit.label===null||unit.factorExact8===null||BigInt(unit.factorExact8.replace('.',''))<=0n))return fail();
  if(!unit.verified&&unit.factorExact8!==null)return fail();
  if(!Array.isArray(h.reasons)||h.reasons.some(r=>typeof r!=='string'||!/^[A-Z0-9_]+$/.test(r))||typeof h.blocked!=='boolean'||h.blocked!==Boolean(h.reasons.length))return fail();
  if(p.kind==='quarantined-source'&&!h.blocked)return fail();
  const barcodes=row.barcodes.map(b=>({id:id(b.id),value:text(b.value),isPrimary:bool(b.isPrimary),sourceKey:text(b.sourceKey,true)}));
  if(barcodes.some(b=>!b.value.length||b.value.length>80)||new Set(barcodes.map(b=>b.id)).size!==barcodes.length)return fail();
  if(row.imageUrl!==null&&(typeof row.imageUrl!=='string'||/[\u0000-\u001f]/.test(row.imageUrl)||/^\s*(?:javascript|data|vbscript):/i.test(row.imageUrl)))return fail();
  const data={id:id(row.id),stockCode:text(row.stockCode),productName:text(row.productName,true),isActive:bool(row.isActive),stockQuantityExact:exact(row.stockQuantityExact),unit,barcodes,imageUrl:text(row.imageUrl,true),provenance:{kind:p.kind,sourceKey:p.sourceKey,runId:p.runId,sourceAsOf:p.sourceAsOf,verified:true},hold:{blocked:h.blocked,reasons:[...h.reasons]}};
  if(sqlFinance&&(!Object.hasOwn(row,'financial')||row.financial===null))return fail();
  if(Object.hasOwn(row,'financial')&&row.financial!==null){
    if(!sqlFinance||!row.financial||!Array.isArray(row.financial.prices))return fail();
    const prices=row.financial.prices.map(v=>{
      const unitSourceId=v.unitSourceId===null?null:id(v.unitSourceId);
      if(!['sale','purchase'].includes(v.type)||!['TRY','USD','EUR'].includes(v.currency)||!Number.isInteger(v.tier)||(v.type==='purchase'?(v.tier!==0||unitSourceId!==null):(v.tier<1||v.tier>6||unitSourceId===null)))return fail();
      if(p.kind==='accepted-opening'&&v.sourceKey!==`${p.sourceKey}/PRICE/${v.type}/${unitSourceId??'CARD'}/${v.tier}/${v.currency}`)return fail();
      return {id:id(v.id),type:v.type,unitSourceId,tier:v.tier,currency:v.currency,priceExact:exact(v.priceExact),isMainUnit:bool(v.isMainUnit),sourceKey:text(v.sourceKey,true)};
    });
    if(new Set(prices.map(v=>v.id)).size!==prices.length||new Set(prices.map(v=>JSON.stringify([v.type,v.unitSourceId,v.tier,v.currency]))).size!==prices.length)return fail();
    const financial={averageCostTryExact:exact(row.financial.averageCostTryExact),prices};
    if(canViewFinance)data.financial=financial;
  }
  return data;
}
