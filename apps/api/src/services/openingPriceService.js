// Read only the native IDs accepted by the committed TEST opening rehearsal.
// No staging scan, scalar-price fallback, or source-system connection is allowed.
import {catalogSourceVersion} from './catalogProductReadStore.mjs';
export const OPENING_PRICE_RUN = Object.freeze({
  database:'MELISA_ERP_SIRKET_TEST_20260929_01',
  runId:'VEGA-OPENING-TEST-20261004-06',
  sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',
  planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',
});
const procedures=Object.freeze({detail:'dbo.usp_get_accepted_opening_prices',list:'dbo.usp_list_accepted_opening_products'});
const error=(code,message,statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
const corrupt=()=>error('OPENING_PRICE_BINDING_DRIFT','Kabul edilmiş fiyat eşleşmesi doğrulanamadı.');
const currencies=new Set(['TRY','USD','EUR']);
const flag=value=>value===true||value===1?true:value===false||value===0?false:null;
function id(value,nullable=false){
  if(nullable&&value==null)return null;
  if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||BigInt(value)>9223372036854775807n)throw corrupt();
  return value;
}
function exact(value,nullable=false){
  if(nullable&&value==null)return null;
  if(typeof value!=='string'||!/^\-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(value))throw corrupt();
  return value;
}
function productKey(value,version=null){
  if(typeof value!=='string'||!(version?/^(?:VEGA_CAPTURE_20260930_01|VEGA2026)\/F0102\/TBLSTOKLAR\/[1-9]\d*$/:/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/).test(value))throw corrupt();
  return value;
}
function priceDto(row,expected,version=null){
  const productId=id(row.product_id),sourceKey=productKey(row.product_source_key,version),unit=id(row.source_unit_id,true),tier=row.price_tier;
  if(productId!==expected.productId||sourceKey!==expected.productSourceKey||!['sale','purchase'].includes(row.price_type)
    ||!Number.isInteger(tier)||(row.price_type==='sale'?tier<1||tier>6||unit===null:tier!==0||unit!==null)
    ||!currencies.has(row.currency_code)||flag(row.is_main_unit)===null)throw corrupt();
  const sourcePriceKey=`${sourceKey}/PRICE/${row.price_type}/${unit??'CARD'}/${tier}/${row.currency_code}`;
  if(row.price_source_key!==sourcePriceKey||flag(row.is_main_unit)!==(unit!==null&&unit===expected.mainUnitSourceId))throw corrupt();
  return {id:id(row.price_id),productId,productSourceKey:sourceKey,sourceKey:sourcePriceKey,unitSourceId:unit,
    type:row.price_type,tier,currency:row.currency_code,priceExact:exact(row.price_exact),isMainUnit:flag(row.is_main_unit)};
}
function prices(rows,expected,version=null){
  if(!Array.isArray(rows)||rows.length>1000)throw corrupt();
  const result=rows.map(row=>priceDto(row,expected,version)),ids=new Set(),keys=new Set();
  for(const row of result){const key=JSON.stringify([row.type,row.unitSourceId,row.tier,row.currency]);
    if(ids.has(row.id)||keys.has(key))throw corrupt();ids.add(row.id);keys.add(key);}
  return result;
}
function metadata(row,version=null,kind='detail'){
  const expected=version??OPENING_PRICE_RUN;
  if(version&&(row?.readerDefinitionHash!==version[kind==='detail'?'openingDetailDefinitionHash':'openingListDefinitionHash']?.toUpperCase()))throw corrupt();
  if(!row||row.database_name!==OPENING_PRICE_RUN.database||row.run_id!==expected.runId
    ||row.run_status!=='COMMITTED'
    ||row.source_hash!==expected.sourceHash||row.plan_hash!==expected.planHash
    ||typeof row.source_as_of!=='string'||!row.source_as_of.startsWith(version?.sourceAsOf??'2026-09-30'))throw corrupt();
  return {runId:row.run_id,sourceHash:row.source_hash,planHash:row.plan_hash,sourceAsOf:row.source_as_of,
    readOnly:true,sourceFreshLive:false,cutoverAccepted:false,source:version?'accepted-native-source-version-prices':'accepted-native-opening-prices'};
}
function productDto(row,version=null){
  if(typeof row.stock_code!=='string'||typeof row.product_name!=='string'||flag(row.is_active)===null||!Number.isInteger(row.price_count)||row.price_count<0||row.price_count>1000)throw corrupt();
  return {productId:id(row.product_id),stockCode:row.stock_code,productName:row.product_name,
    productSourceKey:productKey(row.product_source_key,version),mainUnitSourceId:id(row.main_unit_source_id),
    isActive:flag(row.is_active),stockQuantityExact:exact(row.stock_quantity_exact),averageCostTryExact:exact(row.average_cost_try_exact,true),priceCount:row.price_count};
}
function detailResponse(result,requestedId,version=null){
  const header=result.recordsets?.[0];if(!Array.isArray(header)||header.length!==1)throw corrupt();
  const row=header[0],meta=metadata(row,version),accepted=flag(row.accepted);if(accepted===null||id(row.product_id)!==requestedId)throw corrupt();
  const expected={productId:requestedId,productSourceKey:accepted?productKey(row.product_source_key,version):null,mainUnitSourceId:accepted?id(row.main_unit_source_id):null};
  const rows=result.recordsets?.[1];if(!Number.isInteger(row.price_count)||row.price_count<0||row.price_count>1000||!Array.isArray(rows)||rows.length!==row.price_count||(!accepted&&row.price_count!==0))throw corrupt();
  if(version&&accepted&&![OPENING_PRICE_RUN.runId,version.runId].includes(row.product_lineage_run_id))throw corrupt();
  const lineageMeta=version&&accepted&&row.product_lineage_run_id===OPENING_PRICE_RUN.runId?{...meta,runId:OPENING_PRICE_RUN.runId,sourceHash:OPENING_PRICE_RUN.sourceHash,planHash:OPENING_PRICE_RUN.planHash,sourceAsOf:'2026-09-30',source:'accepted-native-opening-prices'}:meta;
  return {data:{...expected,accepted,prices:accepted?prices(rows,expected,version):[]},meta:lineageMeta};
}
function listResponse(result,options,version=null){
  const header=result.recordsets?.[0];if(!Array.isArray(header)||header.length!==1)throw corrupt();
  const row=header[0],meta=metadata(row,version,'list'),total=Number(row.total),products=result.recordsets?.[1],priceRows=result.recordsets?.[2];
  if(!Number.isSafeInteger(total)||total<0||Number(row.page)!==options.page||Number(row.page_size)!==options.limit
    ||!Array.isArray(products)||products.length!==Math.min(options.limit,Math.max(0,total-(options.page-1)*options.limit))||!Array.isArray(priceRows))throw corrupt();
  const data=products.map(p=>productDto(p,version)),byId=new Map(data.map(p=>[p.productId,p])),groups=new Map(),priceIds=new Set();
  if(byId.size!==data.length||new Set(data.map(p=>p.productSourceKey)).size!==data.length)throw corrupt();
  for(const price of priceRows){if(!byId.has(price.product_id)||priceIds.has(price.price_id))throw corrupt();priceIds.add(price.price_id);const group=groups.get(price.product_id)??[];group.push(price);groups.set(price.product_id,group);}
  for(const product of data){product.prices=prices(groups.get(product.productId)??[],product,version);if(product.prices.length!==product.priceCount)throw corrupt();}
  return {data,meta:{...meta,total,page:options.page,limit:options.limit,totalPages:Math.ceil(total/options.limit)}};
}
function parseId(value){try{return id(value);}catch{throw error('OPENING_PRICE_PRODUCT_ID_INVALID','Geçerli ürün kimliği gerekli.',400);}}
export function parseOpeningPriceListQuery(query={}){
  if(Object.keys(query).some(key=>!['search','positive','page','limit'].includes(key)))throw error('OPENING_PRICE_QUERY_INVALID','Fiyat sorgusu alanı geçersiz.',400);
  const integer=(value,fallback,max)=>{if(value===undefined)return fallback;if(typeof value!=='string'||!/^\d+$/.test(value)||Number(value)<1||!Number.isSafeInteger(Number(value))||Number(value)>max)throw error('OPENING_PRICE_QUERY_INVALID','Fiyat sayfalaması geçersiz.',400);return Number(value);};
  if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>120))throw error('OPENING_PRICE_QUERY_INVALID','Fiyat araması en fazla 120 karakter olmalı.',400);
  if(query.positive!==undefined&&!['0','1'].includes(query.positive))throw error('OPENING_PRICE_QUERY_INVALID','Stok filtresi geçersiz.',400);
  return {search:query.search??'',positive:query.positive==='1',page:integer(query.page,1,100000),limit:integer(query.limit,50,100)};
}
export function createOpeningPriceService({getPool,sql,isTest,getSourceVersion=catalogSourceVersion}={}){
  async function runtime(){
    if(getPool){if(!sql||!isTest?.())throw error('OPENING_PRICES_TEST_ONLY','Fiyat provası yalnız izole TEST üzerinde okunabilir.');return{pool:await getPool(),driver:sql};}
    const database=await import('../config/database.js');
    if(!database.isCanonicalTest())throw error('OPENING_PRICES_TEST_ONLY','Fiyat provası yalnız izole TEST üzerinde okunabilir.');
    return {pool:await database.getSqlPool(),driver:database.getSqlDriver()};
  }
  async function read(action){try{return await action(await runtime());}catch(e){
    if(e.code?.startsWith('OPENING_PRICE'))throw e;
    const safeCode=[e.message,e.originalError?.message,...(e.precedingErrors??[]).map(x=>x.message)].some(m=>String(m).includes('OPENING_PRICE_BINDING_DRIFT'))?'OPENING_PRICE_BINDING_DRIFT':'OPENING_PRICES_NOT_READY';
    throw error(safeCode,safeCode==='OPENING_PRICE_BINDING_DRIFT'?'Kabul edilmiş fiyat eşleşmesi doğrulanamadı.':'Kabul edilmiş açılış fiyatları henüz okunamıyor.');
  }}
  return {
    async detail(value){const productId=parseId(value);return read(async({pool,driver})=>{const version=getSourceVersion();if(version&&!/^[a-f0-9]{64}$/i.test(version.openingDetailDefinitionHash??''))throw corrupt();return detailResponse(await pool.request().input('product_id',driver.BigInt,productId).execute(version?'dbo.usp_get_source_version_prices_goal7':procedures.detail),productId,version);});},
    async list(query){const options=parseOpeningPriceListQuery(query);return read(async({pool,driver})=>{const version=getSourceVersion();if(version&&!/^[a-f0-9]{64}$/i.test(version.openingListDefinitionHash??''))throw corrupt();return listResponse(await pool.request().input('search',driver.NVarChar(120),options.search).input('positive_only',driver.Bit,options.positive).input('page',driver.Int,options.page).input('page_size',driver.Int,options.limit).execute(version?'dbo.usp_list_source_version_products_goal7':procedures.list),options,version);});},
  };
}
export const openingPriceService=createOpeningPriceService();
