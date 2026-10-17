import {createHash} from 'node:crypto';
export const CRM_V2_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const CRM_V2_PRICING_CONTRACT='melisa-crm-draft-pricing.v1';
export const crmV2Error=(code,statusCode=400)=>Object.assign(new Error(code),{code,statusCode});
const fail=(code='CRM_V2_PAYLOAD_INVALID')=>{throw crmV2Error(code);};
const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();};
export function crmV2Id(v){if(!Number.isSafeInteger(v)||v<1)fail('CRM_V2_ID_INVALID');return v;}
export function crmV2Uuid(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))fail('CRM_V2_UUID_INVALID');return v.toLowerCase();}
export function crmV2Phone(v){
 if(typeof v!=='string'||!/^\+?[1-9]\d{6,14}$/.test(v))fail('CRM_V2_PHONE_INVALID');return v.replace(/^\+/,'');
}
export function crmV2Conversation(v){if(typeof v!=='string'||!/^\d{1,20}$/.test(v)||/^0/.test(v))fail('CRM_V2_CONVERSATION_INVALID');return v;}
const text=(v,max)=>{if(typeof v!=='string'||!v||v.length>max||/[\u0000-\u001f\u007f]/.test(v))fail();return v;};
export function crmV2Exact(v,places,max){if(typeof v!=='string'||!new RegExp(`^(0|[1-9]\\d*)\\.\\d{${places}}$`).test(v)||BigInt(v.replace('.',''))>max)fail('CRM_V2_AMOUNT_INVALID');return v;}
export function crmV2Project(v){const n=BigInt(crmV2Exact(v,8,100000000000000n).replace('.',''));const units=(n+5000n)/10000n;return `${units/10000n}.${String(units%10000n).padStart(4,'0')}`;}
const requestKeys=['requestId','conversationId','peer','customerId','customerMatch','documentCurrency','exchangeRateExact8','items'];
const lineKeys=['productId','stockCode','quantity','priceId','unitSourceId','tier','currency','priceExact8','priceSourceKey'];
function manualPricingWitness(value){
 object(value,['origin','versionId','sourcePriceExact8']);
 if(value.origin!=='MANUAL'||typeof value.versionId!=='string'||!/^[1-9]\d{0,18}$/.test(value.versionId)||BigInt(value.versionId)>9223372036854775807n)fail();
 // The immutable source fact has the native decimal(28,8) range. Its NULL
 // remains distinct from zero and from the narrower effective draft price.
 return {origin:'MANUAL',versionId:value.versionId,sourcePriceExact8:value.sourcePriceExact8===null?null:crmV2Exact(value.sourcePriceExact8,8,9999999999999999999999999999n)};
}
export function normalizeCrmV2Request(input){
 const priced=input!==null&&typeof input==='object'&&Object.hasOwn(input,'pricingContract');
 object(input,priced?[...requestKeys,'pricingContract']:requestKeys);
 if(priced&&input.pricingContract!==CRM_V2_PRICING_CONTRACT)fail();
 const requestId=crmV2Uuid(input.requestId),conversationId=crmV2Conversation(input.conversationId),peer=crmV2Phone(input.peer),customerId=crmV2Id(input.customerId);
 const m=input.customerMatch;object(m,['basis','phone','revision','reason']);
 if(!['exact-phone','operator-confirmed'].includes(m.basis)||crmV2Phone(m.phone)!==peer||typeof m.revision!=='string'||!/^[a-f0-9]{64}$/.test(m.revision))fail('CRM_V2_CUSTOMER_MATCH_INVALID');
 if(m.basis==='exact-phone'&&m.reason!==null||m.basis==='operator-confirmed'&&(typeof m.reason!=='string'||m.reason.trim().length<8||m.reason.length>500))fail('CRM_V2_CUSTOMER_MATCH_INVALID');
 if(!['TRY','USD','EUR'].includes(input.documentCurrency))fail('CRM_V2_CURRENCY_INVALID');
 const exchangeRateExact8=crmV2Exact(input.exchangeRateExact8,8,1000000000000n);
 if(BigInt(exchangeRateExact8.replace('.',''))===0n||input.documentCurrency==='TRY'&&exchangeRateExact8!=='1.00000000')fail('CRM_V2_CURRENCY_INVALID');
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>50)fail('CRM_V2_LINES_INVALID');
 let manualCount=0;
 const items=input.items.map(line=>{const manual=priced&&line!==null&&typeof line==='object'&&Object.hasOwn(line,'pricingWitness');object(line,manual?[...lineKeys,'pricingWitness']:lineKeys);
 const productId=crmV2Id(line.productId),priceId=crmV2Id(line.priceId),unitSourceId=crmV2Id(line.unitSourceId);
 if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>9999||line.tier!==1||line.currency!==input.documentCurrency)fail('CRM_V2_LINES_INVALID');
 const out={productId,stockCode:text(line.stockCode,250),quantity:line.quantity,priceId,unitSourceId,tier:1,currency:line.currency,priceExact8:crmV2Exact(line.priceExact8,8,100000000000000n),priceSourceKey:text(line.priceSourceKey,400)};
 if(manual){if(BigInt(out.priceExact8.replace('.',''))===0n)fail('CRM_V2_AMOUNT_INVALID');out.pricingWitness=manualPricingWitness(line.pricingWitness);manualCount++;}return out;
 });
 if(priced&&manualCount===0)fail();
 if(new Set(items.map(l=>l.productId)).size!==items.length)fail('CRM_V2_LINES_INVALID');
 const out={requestId,conversationId,peer,customerId,customerMatch:{basis:m.basis,phone:peer,revision:m.revision,reason:m.reason},documentCurrency:input.documentCurrency,exchangeRateExact8,items};
 if(priced)out.pricingContract=CRM_V2_PRICING_CONTRACT;
 crmV2Totals(out);return out;
}
const unitsText=n=>`${n/10000n}.${String(n%10000n).padStart(4,'0')}`;
export function crmV2Totals(request){const lineTotals=request.items.map(l=>BigInt(crmV2Project(l.priceExact8).replace('.',''))*BigInt(l.quantity));const grand=lineTotals.reduce((a,b)=>a+b,0n),amountTry=(grand*BigInt(request.exchangeRateExact8.replace('.',''))+50000000n)/100000000n;if(grand>100000000000000n||amountTry>100000000000000n)fail('CRM_V2_AMOUNT_INVALID');return {lineTotals:lineTotals.map(unitsText),grandTotalExact4:unitsText(grand),amountTryExact4:unitsText(amountTry)};}
export const crmV2Fingerprint=(request,erpActorId,crmActorId)=>createHash('sha256').update(JSON.stringify([crmV2Id(erpActorId),text(crmActorId,80),normalizeCrmV2Request(request)])).digest('hex');
export function validateCrmV2Document(value,requestId){
 try{
  object(value,['request','id','documentNo','status','customerName','grandTotalExact4','amountTryExact4','items','payloadHash']);
  const request=normalizeCrmV2Request(value.request),totals=crmV2Totals(request);crmV2Id(value.id);
  if(request.requestId!==crmV2Uuid(requestId)||value.status!=='draft'||typeof value.documentNo!=='string'||!value.documentNo||typeof value.customerName!=='string'||!value.customerName||value.grandTotalExact4!==totals.grandTotalExact4||value.amountTryExact4!==totals.amountTryExact4||!Array.isArray(value.items)||value.items.length!==request.items.length||!/^[a-f0-9]{64}$/.test(value.payloadHash))throw Error();
  value.items.forEach((line,index)=>{object(line,['productId','stockCode','quantity','unitPriceExact4','currency','lineTotalExact4']);const r=request.items[index];if(line.productId!==r.productId||line.stockCode!==r.stockCode||line.quantity!==r.quantity||line.currency!==r.currency||line.unitPriceExact4!==crmV2Project(r.priceExact8)||line.lineTotalExact4!==totals.lineTotals[index])throw Error();});
  const {payloadHash,...document}=value;return {...document,request,erpPersisted:true,testOnly:true,stockEffect:false,ledgerEffect:false,collectionEffect:false,reservationEffect:false};
 }catch{throw crmV2Error('CRM_V2_READBACK_INVALID',503);}
}
