import {parseStockProductId,parseStockProductQuery,stockProductDto,stockReadTimestamp} from './stockProductModel.mjs';
import {isBoundCatalogContext,isCurrentProductCatalogContext,validateBoundCatalogContext} from './currentProductCatalogContext.mjs';
export const catalogError=(code='CATALOG_UNAVAILABLE',message='Ürün kataloğu şu anda okunamıyor.',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export function parseCatalogId(value){try{return parseStockProductId(value);}catch{throw catalogError('CATALOG_ID_INVALID','Geçerli ürün kimliği gerekli.',400);}}
export function parseCatalogQuery(value={}){try{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
 const {brand,productType,image,sort,...basic}=value;
 const literal=v=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>250||v.includes('\u0000'))throw Error();return v;};
 if(image!==undefined&&!['all','available','missing'].includes(image)||sort!==undefined&&!['code-asc','code-desc','stock-desc'].includes(sort))throw Error();
 return {...parseStockProductQuery({...basic,limit:basic.limit===undefined?'50':basic.limit}),brand:literal(brand),productType:literal(productType),image:image??'all',sort:sort??'code-asc'};
}catch{throw catalogError('CATALOG_QUERY_INVALID','Geçerli arama ve filtreler gerekli.',400);}}
export function catalogDisplayCode(stockCode,brand){
 if(typeof brand!=='string'||!brand.trim()||!stockCode.endsWith(' '+brand))return stockCode;
 const prefix=stockCode.slice(0,-brand.length-1);return prefix&&!/\s$/.test(prefix)?prefix:stockCode;
}
export function compareCatalogCodes(a,b){
 const key=s=>{const m=/^[0-9]+/.exec(s);return m?{group:0,digits:m[0].replace(/^0+/,'')||'0',suffix:s.slice(m[0].length)}:{group:1,digits:'',suffix:s};};
 const binary=(x,y)=>Buffer.compare(Buffer.from(x,'utf16le'),Buffer.from(y,'utf16le'));
 const x=key(a),y=key(b);return x.group-y.group||x.digits.length-y.digits.length||(x.digits<y.digits?-1:x.digits>y.digits?1:0)||binary(x.suffix,y.suffix)||binary(a,b);
}
const invalid=()=>{throw catalogError();};
const nativeId=value=>{try{return parseStockProductId(value);}catch{return invalid();}};
const priceExact=value=>{if(value===null)return null;if(typeof value!=='string'||!/^\-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(value))return invalid();return value;};
export function catalogProductDto(row,{sqlSales=false,canViewSalesPrices=false,sourceVersion=null}={}){
  if(!row||Object.hasOwn(row,'financial')||Object.hasOwn(row,'averageCostTryExact')||Object.hasOwn(row,'purchasePrice')||Object.hasOwn(row,'purchasePrices')||!Array.isArray(row.salePrices))return invalid();
  let basic;try{basic=stockProductDto({...row,imageUrl:row.imageUrl??null},{financialExpected:false,sourceVersion});}catch{return invalid();}
  if(basic.provenance.kind==='synthetic-test'||['301984','301985','301986'].includes(basic.id))return invalid();
  if(!row.photo||row.photo.status!=='missing'||row.photo.url!==null||row.photo.sourceKey!==null||row.photo.verified!==false)return invalid();
  const c=row.classification;
  if(!c||typeof c.verified!=='boolean'||['brand','productType','sourceName'].some(k=>c[k]!==null&&(typeof c[k]!=='string'||(k==='sourceName'?c[k].length>500:c[k].length>250)||!c[k].trim())))return invalid();
  const verified=basic.provenance.kind==='accepted-opening'&&!basic.hold.blocked;
  if(c.verified!==verified||!verified&&['brand','productType','sourceName'].some(k=>c[k]!==null)||typeof row.displayCode!=='string'||row.displayCode!==catalogDisplayCode(basic.stockCode,verified?c.brand:null))return invalid();
  if((!sqlSales||basic.hold.blocked)&&row.salePrices.length)return invalid();
  const salePrices=row.salePrices.map(p=>{
    const unitSourceId=nativeId(p.unitSourceId);
    if(p.type!=='sale'||!Number.isInteger(p.tier)||p.tier<1||p.tier>6||!['TRY','USD','EUR'].includes(p.currency)||typeof p.isMainUnit!=='boolean'
      ||p.sourceKey!==`${basic.provenance.sourceKey}/PRICE/sale/${unitSourceId}/${p.tier}/${p.currency}`)return invalid();
    return {id:nativeId(p.id),type:'sale',unitSourceId,tier:p.tier,currency:p.currency,priceExact:priceExact(p.priceExact),isMainUnit:p.isMainUnit,sourceKey:p.sourceKey};
  });
  if(new Set(salePrices.map(p=>p.id)).size!==salePrices.length||new Set(salePrices.map(p=>JSON.stringify([p.unitSourceId,p.tier,p.currency]))).size!==salePrices.length)return invalid();
  const {imageUrl,...data}=basic;
  const mediaProvenance=sourceVersion&&row.provenance.mediaSourceKey!==null&&row.provenance.mediaRunId!==null?{sourceKey:row.provenance.mediaSourceKey,runId:row.provenance.mediaRunId}:null;
  if(mediaProvenance&&(mediaProvenance.runId!=='VEGA-OPENING-TEST-20261004-06'||!/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(mediaProvenance.sourceKey)))return invalid();
  return {...data,...(mediaProvenance?{mediaProvenance}:{}),displayCode:row.displayCode,classification:{brand:c.brand,productType:c.productType,sourceName:c.sourceName,verified:c.verified},salePrices:canViewSalesPrices?salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}};
}
export function catalogReadResult(result,{actorId,productId=null,options,canViewSalesPrices=false}){
  const sourceVersion=result?.sourceVersion??null,acceptedCount=sourceVersion?.productCount??16622;
  if(isBoundCatalogContext(sourceVersion)){try{validateBoundCatalogContext(sourceVersion);}catch{return invalid();}}
  else if(sourceVersion&&(!/^GOAL7-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(sourceVersion.runId??'')||sourceVersion.sourceAsOf!=='2026-10-07'||acceptedCount!==16671||['sourceHash','planHash','bindingsHash','readerDefinitionHash'].some(k=>typeof sourceVersion[k]!=='string'||!/^[a-f0-9]{64}$/i.test(sourceVersion[k]))))return invalid();
  if(!result||result.actorId!==actorId||typeof result.canViewSalesPrices!=='boolean'||!Array.isArray(result.rows)||!Number.isSafeInteger(result.total)||result.total<0||result.page!==options.page||result.limit!==options.limit||!stockReadTimestamp(result.readAt)
    ||result.acceptedCount!==acceptedCount||result.syntheticCount!==0||result.quarantinedCount!==54||result.rows.length!==Math.min(options.limit,Math.max(0,result.total-(options.page-1)*options.limit)))return invalid();
  const visible=result.canViewSalesPrices&&canViewSalesPrices;
  const data=result.rows.map(row=>catalogProductDto(row,{sqlSales:result.canViewSalesPrices,canViewSalesPrices:visible,sourceVersion}));
  const f=result.filters;
  if(!f||!Array.isArray(f.brands)||!Array.isArray(f.productTypes)||[f.brands,f.productTypes].some(values=>values.some(v=>typeof v!=='string'||!v.trim()||v.length>250)||new Set(values).size!==values.length))return invalid();
  if(new Set(data.map(p=>p.id)).size!==data.length||productId!==null&&(result.total>1||data.some(p=>p.id!==productId)))return invalid();
  return {data,meta:{schemaVersion:'melisa-catalog.v1',readOnly:true,sourceAsOf:sourceVersion?.sourceAsOf??'2026-09-30',...(isBoundCatalogContext(sourceVersion)?{[isCurrentProductCatalogContext(sourceVersion)?'currentVersion':'finalVersion']:sourceVersion}:{}),readAt:result.readAt,freshLive:false,total:result.total,page:options.page,limit:options.limit,totalPages:Math.ceil(result.total/options.limit),canViewSalesPrices:visible,filters:{brands:[...f.brands],productTypes:[...f.productTypes]},scopeCounts:{acceptedOpening:acceptedCount,quarantinedSource:54,syntheticTest:0}}};
}
