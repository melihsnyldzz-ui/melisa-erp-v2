// Durable rejection is serialized BEFORE the normal request journal. All
// lifecycle writers must take this same lock before they can mutate a sale.
import {createHash} from 'node:crypto';
import {normalizeDesktopWorkflowTransition} from './desktopSaleWorkflowTransactions.mjs';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
import {desktopCompanyRateDate} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {normalizeDesktopSaleCancellation} from '../../../../packages/shared/src/desktopSaleCancellation.mjs';
import {normalizeDesktopSalePricing} from '../../../../packages/shared/src/desktopSalePricing.mjs';
const fail=()=>{throw Error('DESKTOP_REQUEST_RESOLUTION_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export function desktopWorkflowRequestIdentity(actorId,kind,raw){
 if(!id(actorId)||!raw||typeof raw!=='object'||Array.isArray(raw)||!['draft','transition','dispatch','cancel'].includes(kind))fail();
 if(kind==='cancel'){const body=normalizeDesktopSaleCancellation(raw);return {body,hash:createHash('sha256').update(JSON.stringify({actorId,operation:'CANCEL_SALE',command:body})).digest('hex'),requestId:body.requestId,operation:'CANCEL_SALE'};}
 const body=kind==='transition'?normalizeDesktopWorkflowTransition(raw):JSON.parse(JSON.stringify(raw));
 if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.requestId))fail();
 const discounted=kind==='draft'&&Object.hasOwn(body,'discountRateExact4'),pricing=kind==='draft'&&Object.hasOwn(body,'pricing'),fx=kind!=='transition'&&Object.hasOwn(body,'currencySelection');
 if(kind==='draft'&&(pricing&&!discounted||Object.keys(body).sort().join(',')!==['customerId','documentDate','expectedRevision','items','requestId',...(discounted?['discountRateExact4']:[]),...(pricing?['pricing']:[]),...(fx?['currencySelection']:[])].sort().join(',')||discounted&&(typeof body.discountRateExact4!=='string'||!(pricing?/^(?:0|[1-9]\d?)\.\d{4}$/:/^[0-3]\.\d{4}$/).test(body.discountRateExact4)||BigInt(body.discountRateExact4.replace('.',''))>(pricing?999999n:30000n))))fail();
 if(pricing)normalizeDesktopSalePricing(body.pricing);
 if(kind==='dispatch'&&Object.keys(body).sort().join(',')!==['customerId','expectedVersion','invoiceId','productIds','requestId',...(fx?['currencySelection','documentDate']:[])].sort().join(','))fail();
 if(fx){desktopSaleCurrencySelection(body.currencySelection);desktopCompanyRateDate(body.documentDate);}
 const value=kind==='draft'?{actorId,request:body}:kind==='dispatch'?{actorId,c:body}:{actorId,...body};
 return {body,hash:createHash('sha256').update(JSON.stringify(value)).digest('hex'),requestId:body.requestId,operation:kind==='draft'?'CREATE_DRAFT':kind==='dispatch'?'DISPATCH':body.operation};
}
export async function lockDesktopResolution({sql,transaction,requestId}={}){
 const result=await new sql.Request(transaction).input('request',sql.NVarChar(36),requestId).query(`SELECT CONVERT(varchar(20),actor_id) actorId,kind,LOWER(CONVERT(varchar(64),payload_hash,2)) hash FROM dbo.desktop_sale_request_resolutions WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`);
 if(!Array.isArray(result?.recordset)||result.recordset.length>1)fail();return result.recordset[0]??null;
}
