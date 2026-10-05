import {parseStockProductId,parseStockProductQuery,stockProductDto,stockReadTimestamp} from './stockProductModel.mjs';
export const catalogError=(code='CATALOG_UNAVAILABLE',message='Ürün kataloğu şu anda okunamıyor.',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export function parseCatalogId(value){try{return parseStockProductId(value);}catch{throw catalogError('CATALOG_ID_INVALID','Geçerli ürün kimliği gerekli.',400);}}
export function parseCatalogQuery(value={}){try{if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return parseStockProductQuery({...value,limit:value.limit===undefined?'50':value.limit});}catch{throw catalogError('CATALOG_QUERY_INVALID','Geçerli arama ve filtreler gerekli.',400);}}
const invalid=()=>{throw catalogError();};
const nativeId=value=>{try{return parseStockProductId(value);}catch{return invalid();}};
const priceExact=value=>{if(value===null)return null;if(typeof value!=='string'||!/^\-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(value))return invalid();return value;};
export function catalogProductDto(row,{sqlSales=false,canViewSalesPrices=false}={}){
  if(!row||Object.hasOwn(row,'financial')||Object.hasOwn(row,'averageCostTryExact')||Object.hasOwn(row,'purchasePrice')||Object.hasOwn(row,'purchasePrices')||!Array.isArray(row.salePrices))return invalid();
  let basic;try{basic=stockProductDto({...row,imageUrl:row.imageUrl??null},{financialExpected:false});}catch{return invalid();}
  if(basic.provenance.kind==='synthetic-test'||['301984','301985','301986'].includes(basic.id))return invalid();
  if(!row.photo||row.photo.status!=='missing'||row.photo.url!==null||row.photo.sourceKey!==null||row.photo.verified!==false)return invalid();
  if((!sqlSales||basic.hold.blocked)&&row.salePrices.length)return invalid();
  const salePrices=row.salePrices.map(p=>{
    const unitSourceId=nativeId(p.unitSourceId);
    if(p.type!=='sale'||!Number.isInteger(p.tier)||p.tier<1||p.tier>6||!['TRY','USD','EUR'].includes(p.currency)||typeof p.isMainUnit!=='boolean'
      ||p.sourceKey!==`${basic.provenance.sourceKey}/PRICE/sale/${unitSourceId}/${p.tier}/${p.currency}`)return invalid();
    return {id:nativeId(p.id),type:'sale',unitSourceId,tier:p.tier,currency:p.currency,priceExact:priceExact(p.priceExact),isMainUnit:p.isMainUnit,sourceKey:p.sourceKey};
  });
  if(new Set(salePrices.map(p=>p.id)).size!==salePrices.length||new Set(salePrices.map(p=>JSON.stringify([p.unitSourceId,p.tier,p.currency]))).size!==salePrices.length)return invalid();
  const {imageUrl,...data}=basic;
  return {...data,salePrices:canViewSalesPrices?salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}};
}
export function catalogReadResult(result,{actorId,productId=null,options,canViewSalesPrices=false}){
  if(!result||result.actorId!==actorId||typeof result.canViewSalesPrices!=='boolean'||!Array.isArray(result.rows)||!Number.isSafeInteger(result.total)||result.total<0||result.page!==options.page||result.limit!==options.limit||!stockReadTimestamp(result.readAt)
    ||result.acceptedCount!==16622||result.syntheticCount!==0||result.quarantinedCount!==54||result.rows.length!==Math.min(options.limit,Math.max(0,result.total-(options.page-1)*options.limit)))return invalid();
  const visible=result.canViewSalesPrices&&canViewSalesPrices;
  const data=result.rows.map(row=>catalogProductDto(row,{sqlSales:result.canViewSalesPrices,canViewSalesPrices:visible}));
  if(new Set(data.map(p=>p.id)).size!==data.length||productId!==null&&(result.total>1||data.some(p=>p.id!==productId)))return invalid();
  return {data,meta:{schemaVersion:'melisa-catalog.v1',readOnly:true,sourceAsOf:'2026-09-30',readAt:result.readAt,freshLive:false,total:result.total,page:options.page,limit:options.limit,totalPages:Math.ceil(result.total/options.limit),canViewSalesPrices:visible,scopeCounts:{acceptedOpening:16622,quarantinedSource:54,syntheticTest:0}}};
}
