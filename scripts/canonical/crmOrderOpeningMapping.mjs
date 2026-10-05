// Pure, offline E02 metadata validation. No SQL driver, network or environment.
export const CRM_OPENING = Object.freeze({
  database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',
  runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',
  sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',
  planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',
  bindingsHash:'5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72',
  quarantineSeal:'69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7',
});
const fail=()=>{throw Object.assign(new Error('CRM_OPENING_METADATA_INVALID'),{code:'CRM_OPENING_METADATA_INVALID'});};
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail();};
const id=value=>{if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||BigInt(value)>9223372036854775807n)fail();return value;};
const hash=value=>{if(typeof value!=='string'||!/^[a-fA-F0-9]{64}$/.test(value))fail();return value.toLowerCase();};
const text=(value,max)=>{if(typeof value!=='string'||!value||value!==value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail();return value;};
export function normalizeCrmOpeningBaseline(value){
  object(value,['schemaVersion','procedures']);if(value.schemaVersion!==1)fail();object(value.procedures,['context','create','read']);
  return {schemaVersion:1,procedures:Object.fromEntries(['context','create','read'].map(k=>[k,hash(value.procedures[k])]))};
}
export function projectCrmSalePrice(priceExact8){
  if(typeof priceExact8!=='string'||!/^(?:0|[1-9]\d{0,19})\.\d{8}$/.test(priceExact8))fail();
  const [whole,fraction]=priceExact8.split('.'),exact=BigInt(whole)*100000000n+BigInt(fraction);
  const native=(exact+5000n)/10000n;if(native>1000000n*10000n)fail();
  return {priceExact8,nativePriceExact4:`${native/10000n}.${String(native%10000n).padStart(4,'0')}`,
    roundingDeltaExact8:(()=>{const d=native*10000n-exact,a=d<0n?-d:d;return `${d<0n?'-':''}${a/100000000n}.${String(a%100000000n).padStart(8,'0')}`;})(),roundingRule:'HALF_UP'};
}
export const CRM_OPENING_PRODUCT_FIELDS=['sourceId','stockCode','productName','nativeProductId','nativeStockCode','nativeProductName','nativePriceId','priceSourceKey','unitSourceId','mainUnitSourceId','tier','currency','priceExact8','nativePriceExact4','unit','factorExact8','productBindingHash','priceBindingHash','nativePriceRowHash','evidenceSha256'];
export function normalizeCrmOpeningMapping(value){
  const meta=['runId','sourceHash','planHash','bindingsHash','sourceAsOf'];object(value,['schemaVersion',...meta,'products']);
  if(value.schemaVersion!==1||meta.some(k=>value[k]!==CRM_OPENING[k])||!Array.isArray(value.products)||!value.products.length||value.products.length>50)fail();
  const products=value.products.map(row=>{
    object(row,CRM_OPENING_PRODUCT_FIELDS);
    if(typeof row.sourceId!=='string'||!/^vega-[1-9]\d*$/.test(row.sourceId))fail();id(row.sourceId.slice(5));
    const nativeProductId=id(row.nativeProductId),nativePriceId=id(row.nativePriceId),unitSourceId=id(row.unitSourceId),mainUnitSourceId=id(row.mainUnitSourceId);
    if(unitSourceId!==mainUnitSourceId||row.tier!==1||!['TRY','USD','EUR'].includes(row.currency)||row.unit!=='ADET'||row.factorExact8!=='1.00000000')fail();
    const productSourceKey=`VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/${row.sourceId.slice(5)}`;
    if(row.priceSourceKey!==`${productSourceKey}/PRICE/sale/${unitSourceId}/1/${row.currency}`)fail();
    const projection=projectCrmSalePrice(row.priceExact8);if(row.nativePriceExact4!==projection.nativePriceExact4)fail();
    return {sourceId:row.sourceId,stockCode:text(row.stockCode,120),productName:text(row.productName,250),nativeProductId,
      nativeStockCode:text(row.nativeStockCode,50),nativeProductName:text(row.nativeProductName,250),nativePriceId,priceSourceKey:row.priceSourceKey,
      unitSourceId,mainUnitSourceId,tier:1,currency:row.currency,priceExact8:row.priceExact8,nativePriceExact4:row.nativePriceExact4,unit:'ADET',factorExact8:'1.00000000',
      productBindingHash:hash(row.productBindingHash),priceBindingHash:hash(row.priceBindingHash),nativePriceRowHash:hash(row.nativePriceRowHash),evidenceSha256:hash(row.evidenceSha256)};
  }).sort((a,b)=>a.sourceId.localeCompare(b.sourceId,'en'));
  for(const key of ['sourceId','stockCode','nativeProductId','nativePriceId'])if(new Set(products.map(p=>p[key])).size!==products.length)fail();
  return {schemaVersion:1,...Object.fromEntries(meta.map(k=>[k,CRM_OPENING[k]])),products};
}
