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
