import {createHash} from 'node:crypto';
export const CRM_ORDER_TEST=Object.freeze({database:'MELISA_ERP_SIRKET_TEST_20260929_01',customerId:593,customerCode:'TEST-V70-20260929-C',conversationId:'55',peer:'905387217733'});
export function crmOrderError(code,statusCode=400){return Object.assign(Error(code),{code,statusCode})}
const fail=code=>{throw crmOrderError(code)};
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
const fixed=(value,places,maximum)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=maximum&&Number(value.toFixed(places))===value;
export function normalizeCrmOrderRequest(input){
  if(!keys(input,['requestId','conversationId','customerId','exchangeRate','items']))fail('CRM_TEST_PAYLOAD_INVALID');
  if(typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId))fail('CRM_TEST_REQUEST_ID_INVALID');
  if(input.conversationId!==CRM_ORDER_TEST.conversationId||input.customerId!==CRM_ORDER_TEST.customerId)fail('CRM_TEST_SCOPE_REQUIRED');
  if(!fixed(input.exchangeRate,8,10000)||input.exchangeRate<=0||!Array.isArray(input.items)||input.items.length<1||input.items.length>50)fail('CRM_TEST_LINES_INVALID');
  const items=input.items.map(line=>{
    if(!keys(line,['sourceId','stockCode','quantity','unitPrice','currency'])||typeof line.sourceId!=='string'||!/^vega-[1-9][0-9]*$/.test(line.sourceId)||!Number.isSafeInteger(Number(line.sourceId.slice(5)))||typeof line.stockCode!=='string'||!line.stockCode||line.stockCode!==line.stockCode.trim()||line.stockCode.length>120||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>9999||!fixed(line.unitPrice,4,1000000)||!['TRY','USD','EUR'].includes(line.currency))fail('CRM_TEST_LINES_INVALID');
    return{sourceId:line.sourceId,stockCode:line.stockCode,quantity:line.quantity,unitPrice:line.unitPrice,currency:line.currency};
  });
  if(new Set(items.map(line=>line.sourceId)).size!==items.length||new Set(items.map(line=>line.stockCode)).size!==items.length||new Set(items.map(line=>line.currency)).size!==1||items[0].currency==='TRY'&&input.exchangeRate!==1)fail('CRM_TEST_LINES_INVALID');
  const total=items.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0);
  if(total>10000000000||total*input.exchangeRate>10000000000)fail('CRM_TEST_AMOUNT_LIMIT');
  return{requestId:input.requestId.toLowerCase(),conversationId:CRM_ORDER_TEST.conversationId,customerId:CRM_ORDER_TEST.customerId,exchangeRate:input.exchangeRate,items};
}
export function crmOrderFingerprint(input,erpActorId,crmActorId){return createHash('sha256').update(JSON.stringify([erpActorId,crmActorId,CRM_ORDER_TEST.peer,normalizeCrmOrderRequest(input)])).digest('hex')}
export function crmOrderGatewayOrigin(value='http://127.0.0.1:62401'){
  let url;try{url=new URL(value)}catch{throw crmOrderError('CRM_TEST_AUTH_ORIGIN_INVALID',503)}
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.port!=='62401'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw crmOrderError('CRM_TEST_AUTH_ORIGIN_INVALID',503);
  return url.origin;
}

export const CRM_ORDER_OPENING=Object.freeze({runId:'VEGA-OPENING-TEST-20261004-06',sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',sourceAsOf:'2026-09-30'});
export function crmOrderNativeId(value){
  const text=typeof value==='number'&&Number.isSafeInteger(value)?String(value):value;
  if(typeof text!=='string'||!/^[1-9]\d*$/.test(text)||BigInt(text)>9223372036854775807n)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
  return text;
}
export function crmOrderPublicId(value){const text=crmOrderNativeId(value);return BigInt(text)<=BigInt(Number.MAX_SAFE_INTEGER)?Number(text):text;}
export function crmOrderMoney(value,maximum=10000000000){
  if(!['number','string'].includes(typeof value)||typeof value==='string'&&!/^(0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value))throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
  const number=Number(value);
  if(!fixed(number,4,maximum))throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
  return number;
}
export function crmOrderTotals(items,exchangeRate){
  if(!fixed(exchangeRate,8,10000)||exchangeRate<=0)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
  const lineUnits=items.map(line=>{
    if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>9999)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    return BigInt(crmOrderMoney(line.unitPrice,1000000).toFixed(4).replace('.',''))*BigInt(line.quantity);
  });
  const grandUnits=lineUnits.reduce((sum,value)=>sum+value,0n),rateUnits=BigInt(exchangeRate.toFixed(8).replace('.','')),tryUnits=(grandUnits*rateUnits+50000000n)/100000000n;
  if(grandUnits>100000000000000n||tryUnits>100000000000000n)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
  const number=units=>Number(units)/10000;
  return{lineTotals:lineUnits.map(number),grandTotal:number(grandUnits),amountTry:number(tryUnits)};
}
export function normalizeCrmOpeningProduct(row){
  const reject=()=>{throw crmOrderError('CRM_TEST_PRODUCT_MAPPING_REQUIRED',409)};
  if(!row||typeof row!=='object'||Array.isArray(row))reject();
  const sourceId=row.sourceId;
  if(typeof sourceId!=='string'||!/^vega-[1-9]\d*$/.test(sourceId)||!Number.isSafeInteger(Number(sourceId.slice(5))))reject();
  let nativeProductId,nativePriceId,unitSourceId,mainUnitSourceId;
  try{nativeProductId=crmOrderNativeId(row.nativeProductId);nativePriceId=crmOrderNativeId(row.nativePriceId);unitSourceId=crmOrderNativeId(row.unitSourceId);mainUnitSourceId=crmOrderNativeId(row.mainUnitSourceId);}catch{reject()}
  const productSourceKey='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+sourceId.slice(5);
  if(row.productSourceKey!==productSourceKey||crmOrderNativeId(row.erpProductId)!==nativeProductId||row.type!=='sale'||row.tier!==1||row.isMainUnit!==true||unitSourceId!==mainUnitSourceId||row.unit!=='ADET'||row.factorExact8!=='1.00000000'||!['TRY','USD','EUR'].includes(row.currency)||row.priceSourceKey!==`${productSourceKey}/PRICE/sale/${unitSourceId}/1/${row.currency}`)reject();
  if(Object.entries(CRM_ORDER_OPENING).some(([key,value])=>row[key]!==value))reject();
  if(typeof row.stockCode!=='string'||!row.stockCode||row.stockCode.trim()!==row.stockCode||row.stockCode.length>120||typeof row.productName!=='string'||!row.productName||row.productName.length>250)reject();
  if(typeof row.priceExact8!=='string'||row.priceExact8.length>40||!/^(0|[1-9]\d*)\.\d{8}$/.test(row.priceExact8)||typeof row.nativePriceExact4!=='string'||!/^(0|[1-9]\d*)\.\d{4}$/.test(row.nativePriceExact4))reject();
  const sourceUnits=BigInt(row.priceExact8.replace('.','')),nativeUnits=(sourceUnits+5000n)/10000n;
  if(nativeUnits>10000000000n)reject(); // Existing public draft unit-price limit: 1,000,000.
  const text=nativeUnits.toString().padStart(5,'0'),projected=`${text.slice(0,-4)}.${text.slice(-4)}`;
  let unitPrice;try{unitPrice=crmOrderMoney(row.unitPrice,1000000);}catch{reject()}
  if(row.nativePriceExact4!==projected||unitPrice.toFixed(4)!==projected)reject();
  return{sourceId,stockCode:row.stockCode,productName:row.productName,erpProductId:crmOrderPublicId(nativeProductId),nativeProductId,productSourceKey,nativePriceId,priceSourceKey:row.priceSourceKey,type:'sale',unitSourceId,mainUnitSourceId,isMainUnit:true,tier:1,currency:row.currency,unit:'ADET',factorExact8:'1.00000000',priceExact8:row.priceExact8,nativePriceExact4:projected,unitPrice,...CRM_ORDER_OPENING,roundingRule:'HALF_UP',roundingRequired:sourceUnits!==nativeUnits*10000n};
}
