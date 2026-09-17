import {run,hash,readSource}from'./vega-native-migration-runtime.mjs';
import {clean,key}from'./vega-native-migration-adapters.mjs';
export const decision=(record,type,reason,details={})=>({source_record_key:`DECISION/${hash([record,reason])}`,record_type:type,reason,status:'UNRESOLVED',details_json:JSON.stringify({sourceKey:record,...details}),source_payload_hash:hash({sourceKey:record,...details})});
export const counts=result=>({inserted:result.filter(r=>r.action==='INSERT').length,updated:result.filter(r=>r.action==='UPDATE').length});
export async function context(store){const q=async t=>(await store.request().query(`SELECT * FROM dbo.[${t}]`)).recordset;
 const products=await q('products'),aliases=await q('product_source_aliases'),parties=await q('party_source_links'),accounts=await q('party_currency_accounts');
 const productsById=new Map(products.map(r=>[String(r.id),r])),productMap=new Map(aliases.map(r=>[String(r.source_product_id),productsById.get(String(r.product_id))]));
 const byCode=new Map();for(const p of products){const c=clean(p.stock_code)?.toLocaleUpperCase('tr-TR');if(!byCode.has(c))byCode.set(c,[]);byCode.get(c).push(p);}
 const partyMap=new Map(parties.map(r=>[`${r.source_company}/${r.source_id}`,r]));
 const accountMap=new Map(accounts.map(r=>[`${r.party_entity_id}/${r.currency_code}`,r]));
 const sourceCards=new Map(['F0102','F0103'].flatMap(c=>readSource(c+'TBLCARI.json').map(r=>[`${c}/${r.IND}`,r])));
 function resolveProduct(company,row){if(company==='F0102')return productMap.get(String(row.STOKNO))||null;if(company==='F0103'){const card=sourceCards.get(`${company}/${row.FIRMANO}`),model=clean(row.MALINCINSI),brand=clean(card?.FIRMAKODU);if(!model||!brand)return null;const candidates=byCode.get(`${model} ${brand}`.toLocaleUpperCase('tr-TR'))||[];if(candidates.length===1&&clean(candidates[0].brand)?.toLocaleUpperCase('tr-TR')===brand.toLocaleUpperCase('tr-TR'))return candidates[0];}return null;}
 return{q,products,productsById,productMap,partyMap,accountMap,sourceCards,resolveProduct};
}
