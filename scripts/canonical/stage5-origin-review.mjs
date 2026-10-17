// Read-only origin evidence review. Importing this module performs no I/O.
import {createHash} from 'node:crypto';
import {crmV2Fingerprint,normalizeCrmV2Request,crmV2Project,crmV2Totals} from '../../apps/api/src/services/crmOrderV2Contract.mjs';
import {buildCrmV2Procedures,buildCrmV2Guards} from './crm-order-v2-sql.mjs';
import {decimal,sumDecimals} from '../migration/mapping-opening.mjs';

const sha=(v,encoding='utf8')=>createHash('sha256').update(v,encoding).digest('hex');
const fail=(v,code)=>{if(!v)throw Error(code);};
const sameId=(a,b)=>String(a)===String(b);
const sqlRow=w=>{fail(w&&typeof w.json==='string'&&/^[a-f0-9]{64}$/i.test(w.rowHash)&&sha(w.json,'utf16le')===w.rowHash.toLowerCase(),'STAGE5_NATIVE_ROW_PROOF');return JSON.parse(w.json);};
const exactField=(json,key)=>{const match=new RegExp('"'+key+'":(-?\\d+(?:\\.\\d+)?)').exec(json);fail(match,'STAGE5_EXACT_FIELD');return decimal(match[1]);};
const definitionBodies={...buildCrmV2Procedures(),...buildCrmV2Guards()};

export function verifyStage5TestOrderWitness({identity,modules,request,header,items,links}){
 fail(identity?.server==='Semih\\MELISADEV'&&identity.database==='MELISA_ERP_SIRKET_TEST_20260929_01','STAGE5_ORIGIN_TARGET');
 fail(Array.isArray(modules),'STAGE5_ORDER_MODULES');
 const modulePins=Object.entries(definitionBodies).map(([name,body])=>{
  const found=modules.filter(m=>m.schemaName==='dbo'&&m.name===name);
  fail(found.length===1&&found[0].disabled===0&&found[0].definitionSHA256?.toLowerCase()===sha(body,'utf16le'),'STAGE5_ORDER_MODULE_CHANGED');
  return {name,definitionSHA256:found[0].definitionSHA256.toLowerCase()};
 });
 const r=sqlRow(request),h=sqlRow(header),body=normalizeCrmV2Request(JSON.parse(r.body_json));
 fail(crmV2Fingerprint(body,r.actor_id,r.crm_actor_id)===r.payload_hash?.toLowerCase(),'STAGE5_ORDER_REQUEST_FINGERPRINT');
 fail(sameId(r.order_id,h.id)&&header.rowHash.toLowerCase()===r.header_hash?.toLowerCase()&&h.status==='draft'&&h.source_offer_id===null&&sameId(h.customer_id,body.customerId)&&h.document_currency===body.documentCurrency,'STAGE5_ORDER_HEADER_LINK');
 // SQL uniqueidentifier -> nvarchar produces uppercase hexadecimal digits.
 fail(body.requestId===r.request_id.toLowerCase()&&h.document_no==='CR2-'+body.requestId.toUpperCase().replaceAll('-','').slice(0,26),'STAGE5_ORDER_REQUEST_LINK');
 fail(Array.isArray(items)&&Array.isArray(links)&&items.length===body.items.length&&links.length===body.items.length,'STAGE5_ORDER_LINES_COMPLETE');
 const itemById=new Map(items.map(w=>{const row=sqlRow(w);return[String(row.id),{row,wrapper:w}]}));
 fail(itemById.size===items.length,'STAGE5_ORDER_DUPLICATE_ITEM');
 const normalizedLinks=links.map(w=>({...sqlRow(w),rowHash:w.rowHash})).sort((a,b)=>a.position-b.position),totals=crmV2Totals(body);
 for(let position=0;position<body.items.length;position++){
  const l=normalizedLinks[position],entry=itemById.get(String(l.item_id)),expected=body.items[position];
  fail(l.position===position&&l.request_id.toLowerCase()===body.requestId&&entry&&entry.wrapper.rowHash.toLowerCase()===l.native_hash.toLowerCase(),'STAGE5_ORDER_LINE_WITNESS');
  const i=entry.row;
  fail(sameId(i.sales_order_id,h.id)&&sameId(i.product_id,expected.productId)&&i.stock_code_snapshot===expected.stockCode&&i.quantity===expected.quantity&&i.currency_code===expected.currency,'STAGE5_ORDER_LINE_OWNERSHIP');
  fail(exactField(entry.wrapper.json,'unit_price')===decimal(crmV2Project(expected.priceExact8))&&exactField(entry.wrapper.json,'line_total')===decimal(totals.lineTotals[position]),'STAGE5_ORDER_LINE_AMOUNT');
 }
 fail(exactField(header.json,'grand_total')===decimal(totals.grandTotalExact4)&&exactField(header.json,'amount_try')===decimal(totals.amountTryExact4),'STAGE5_ORDER_TOTAL');
 fail(h.discount_rate===0&&h.discount_total===0&&exactField(header.json,'subtotal')===exactField(header.json,'grand_total'),'STAGE5_ORDER_DISCOUNT');
 return {classification:'SYNTHETIC_LOCAL',basis:'EXACT_GUARDED_TEST_ORDER_V2_RECEIPT',table:'sales_orders',id:String(h.id),rowHash:header.rowHash.toLowerCase(),requestId:body.requestId,requestRowHash:request.rowHash.toLowerCase(),modulePins,itemRowHashes:items.map(w=>w.rowHash.toLowerCase()).sort(),stockEffect:false,partyEffect:false,cashEffect:false,reservationEffect:false,proofHash:sha(JSON.stringify([modulePins,request.rowHash,header.rowHash,items.map(w=>w.rowHash),links.map(w=>w.rowHash)]))};
}

// A cancellation closure does not resolve REAL_LOCAL versus SYNTHETIC_LOCAL.
// Missing dimensions remain blockers even when quantities happen to sum to 0.
export function reviewStage5CancelledClosure({documentId,status,cancelledAt,expectedEffects,effects}){
 fail(typeof documentId==='string'&&/^[1-9]\d*$/.test(documentId)&&status==='cancelled'&&!!cancelledAt,'STAGE5_CANCEL_HEADER');
 fail(Array.isArray(expectedEffects)&&Array.isArray(effects)&&expectedEffects.length===effects.length&&new Set(expectedEffects).size===expectedEffects.length,'STAGE5_CANCEL_EFFECT_COMPLETENESS');
 const actual=new Set(),groups=new Map();
 for(const e of effects){
  fail(typeof e.key==='string'&&expectedEffects.includes(e.key)&&!actual.has(e.key)&&e.documentId===documentId&&/^[a-f0-9]{64}$/i.test(e.rowHash),'STAGE5_CANCEL_EFFECT_LINK');actual.add(e.key);
  fail(['STOCK','PARTY','CASH'].includes(e.domain)&&Array.isArray(e.dimension),'STAGE5_CANCEL_DIMENSION');
  const key=JSON.stringify([e.domain,...e.dimension]),a=groups.get(key)??[];a.push(e);groups.set(key,a);
 }
 const rows=[...groups].map(([key,es])=>({key,netExact:sumDecimals(es.map(e=>decimal(e.effectExact))),rows:es.length,dimensionVerified:es.every(e=>e.dimension.length===(e.domain==='STOCK'?3:2)&&e.dimension.every(d=>typeof d==='string'&&d.length>0&&d!=='UNKNOWN')),rowHashes:es.map(e=>e.rowHash)}));
 const netZero=rows.length>0&&rows.every(r=>r.netExact==='0.00000000'),dimensionsVerified=rows.every(r=>r.dimensionVerified);
 return {documentId,origin:'UNKNOWN',netZero,dimensionsVerified,status:!netZero?'BLOCKED_NONZERO_EFFECT':!dimensionsVerified?'ZERO_NET_BUT_DIMENSION_UNRESOLVED':'CLOSED_ZERO_EFFECT_ORIGIN_UNRESOLVED',rows};
}
