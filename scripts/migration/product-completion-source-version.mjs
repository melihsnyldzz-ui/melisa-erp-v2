// Append to the existing immutable Goal7 version tables; never rewrite lineage.
import {digest,sqlJsonHash} from './goal7-test-delta.mjs';
import {decimal,requireRule as check} from './mapping-opening.mjs';
import {SOURCE_VERSION_PRODUCT_FIELDS,SOURCE_VERSION_PRICE_FIELDS,sourceVersionBindingHash} from './goal7-source-version.mjs';
import {validId,hex,sourceNativeKey,priceTuple,productCompletionContext} from './product-completion-plan.mjs';
export function buildProductCompletionVersion({plan,appliedGroups,nativeBindings,effects,deferred=[]}){
 // Full read-only captures carry a diagnostic hash outside the native schema.
 // Keep it in the sealed ancestor evidence, never in a new SQL row projection.
 const nativeProjection=({__row_hash,...row})=>({...row,version_run_id:plan.runId});
 const products=new Map(plan.previousVersion.products.map(p=>[String(p.product_id),nativeProjection(p)]));
 const prices=new Map(plan.previousVersion.prices.map(p=>[String(p.price_id),nativeProjection(p)]));
 const groupBy=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
 const nativeProductsByKey=groupBy(nativeBindings.products,n=>n.source_record_key),nativePricesByTuple=groupBy(nativeBindings.prices,n=>String(n.product_id)+'/'+priceTuple(n)),priorRecords=new Map(plan.previousVersion.records.map(r=>[JSON.stringify([r.run_id,r.entity,r.source_key]),r])),priceCounts=new Map();for(const p of prices.values())priceCounts.set(String(p.product_id),(priceCounts.get(String(p.product_id))??0)+1);
 // Historical stage records remain owned by their original immutable run. Only
 // new records are inserted; the reader may select ancestry records by lineage.
 const newRecords=[],recordKeys=new Set(),appliedProductIds=new Set();
 const record=(entity,sourceKey,payload)=>{const payload_json=JSON.stringify(payload),row={run_id:plan.runId,entity,source_key:sourceKey,payload_hash:digest(payload_json),payload_json},key=JSON.stringify([entity,sourceKey]);check(!recordKeys.has(key),'PRODUCT_VERSION_DUPLICATE_RECORD');recordKeys.add(key);newRecords.push(row);return row;};
 for(const g of appliedGroups){
  const candidates=nativeProductsByKey.get(sourceNativeKey(g.source))??[];check(candidates.length===1,'PRODUCT_VERSION_NATIVE_SINGLETON');const n=candidates[0],pid=String(n.id);check(validId(pid)&&(!g.nativeId||pid===g.nativeId),'PRODUCT_VERSION_NATIVE_ID');
  const old=products.get(pid);check(g.isNew?!old:!!old,'PRODUCT_VERSION_PRIOR_CARD');appliedProductIds.add(pid);
  let product=old;
  const sourceMasterProven=Object.entries({stockCode:'stock_code',name:'name',brand:'brand',category:'category',isActive:'is_active'}).every(([s,f])=>n[f]===g.source[s]);
  if(g.isNew||sourceMasterProven){
   const previousStage=old?priorRecords.get(JSON.stringify([old.lineage_run_id,'products',old.lineage_source_key])):null;
   check(!old||previousStage&&previousStage.payload_hash.toUpperCase()===old.stage_payload_hash.toUpperCase()&&sqlJsonHash(previousStage.payload_json)===old.stage_sql_hash.toUpperCase(),'PRODUCT_VERSION_PRIOR_STAGE');
   const priorData=previousStage?JSON.parse(previousStage.payload_json):{};
   const stage=record('products',g.sourceKey,{...priorData,source_key:g.sourceKey,source_id:g.sourceId,stock_code:n.stock_code,name:n.name,brand:n.brand,category:n.category,unit:n.unit,is_active:n.is_active,quantity:g.stock?.sourceAfter??priorData.quantity??null,average_cost_try:g.isNew?null:priorData.average_cost_try??null,cost_status:g.isNew?'UNKNOWN':priorData.cost_status??'UNKNOWN',source_payload_hash:g.sourcePayloadHash,source_payload_json:JSON.stringify(g.source)});
   product={...(old??{}),product_id:pid,product_source_key:old?.product_source_key??g.sourceKey,source_id:g.sourceId,native_source_key:sourceNativeKey(g.source),stock_code:n.stock_code,product_name:n.name,currency_code:n.currency_code,unit:n.unit,main_unit_source_id:String(g.source.mainUnitSourceId),price_count:0,stage_payload_hash:stage.payload_hash,stage_sql_hash:sqlJsonHash(stage.payload_json),binding_hash:'',version_run_id:plan.runId,lineage_run_id:plan.runId,lineage_source_as_of:plan.sourceAsOf,lineage_source_key:g.sourceKey};
   products.set(pid,product);
  }
  for(const operation of g.prices){const p=operation.after;check(p.type==='sale'&&operation.change!=='REMOVE','PRODUCT_VERSION_SALE_ONLY');const matches=(nativePricesByTuple.get(pid+'/'+priceTuple(p))??[]).filter(n=>decimal(n.priceExact??n.price)===p.priceExact);check(matches.length===1,'PRODUCT_VERSION_PRICE_SINGLETON');const row=matches[0],id=String(row.id),prior=prices.get(id);check(validId(id)&&hex(row.nativeHash??row.__row_hash)&& (operation.change==='INSERT'?!prior:!!prior),'PRODUCT_VERSION_PRICE_OPERATION');
   const stage=record('prices',p.sourceKey,{source_key:p.sourceKey,product_source_key:g.sourceKey,unit_source_id:p.unitSourceId,price_type:'sale',tier:p.tier,currency_code:p.currency,price:p.priceExact,price_status:'SOURCE'});
   const value={...(prior??{}),price_id:id,product_id:pid,product_source_key:product.product_source_key,price_source_key:prior?.price_source_key??`${product.product_source_key}/PRICE/sale/${p.unitSourceId}/${p.tier}/${p.currency}`,source_unit_id:p.unitSourceId,price_type:'sale',price_tier:p.tier,currency_code:p.currency,price_exact:p.priceExact,is_main_unit:p.isMainUnit,stage_payload_hash:stage.payload_hash,stage_sql_hash:sqlJsonHash(stage.payload_json),native_row_hash:(row.nativeHash??row.__row_hash).toUpperCase(),binding_hash:'',version_run_id:plan.runId,lineage_run_id:plan.runId,lineage_source_key:p.sourceKey};value.binding_hash=sourceVersionBindingHash(value,SOURCE_VERSION_PRICE_FIELDS);prices.set(id,value);if(!prior)priceCounts.set(pid,(priceCounts.get(pid)??0)+1);
  }
  for(const superseded of g.supersededSalePrices??[]){const prior=prices.get(superseded.priceId);check(prior&&String(prior.product_id)===pid&&prior.price_type==='sale'&&prior.native_row_hash.toUpperCase()===superseded.before.acceptedNativeHash.toUpperCase()&&decimal(prior.price_exact)===decimal(superseded.before.acceptedPriceExact),'PRODUCT_SUPERSEDED_PRIOR_BINDING');prices.delete(superseded.priceId);priceCounts.set(pid,(priceCounts.get(pid)??0)-1);record('product_completion_superseded',superseded.priceId,{...superseded,sourceKey:g.sourceKey,sourceHash:plan.sourceHash,nativeId:pid,actualT1:false});}
  // Source main-unit selection is separate from master/price ownership. Its
  // verified unit-ID proof may advance while a manual master field is kept.
  product.main_unit_source_id=String(g.source.mainUnitSourceId);
  product.price_count=priceCounts.get(pid)??0;product.binding_hash=sourceVersionBindingHash(product,SOURCE_VERSION_PRODUCT_FIELDS);
  record('product_completion_scope',g.sourceKey,{sourceId:g.sourceId,sourceUid:g.sourceUid,sourcePayloadHash:g.sourcePayloadHash,nativeId:pid,units:g.source.units??null,barcodes:g.source.barcodes,sourceAsOf:plan.sourceAsOf,stock:g.stock,exceptions:g.exceptions,actualT1:false});
 }
 for(const effect of effects)record('product_completion_effects',effect.table+'/'+effect.id,effect);
 for(const p of prices.values()){if(!appliedProductIds.has(String(p.product_id)))continue;const product=products.get(String(p.product_id));check(product,'PRODUCT_VERSION_PRICE_CARD');const expected=p.price_type==='sale'&&String(p.source_unit_id)===String(product.main_unit_source_id);if(p.is_main_unit!==expected){p.is_main_unit=expected;p.binding_hash=sourceVersionBindingHash(p,SOURCE_VERSION_PRICE_FIELDS);}}
 const sort=rows=>[...rows.values()].sort((a,b)=>BigInt(a.product_id??a.price_id)<BigInt(b.product_id??b.price_id)?-1:1);
 const productRows=sort(products),priceRows=[...prices.values()].sort((a,b)=>BigInt(a.price_id)<BigInt(b.price_id)?-1:1);
 const bindingsHash=digest({products:productRows.map(p=>({product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_as_of:p.lineage_source_as_of,lineage_source_key:p.lineage_source_key})),prices:priceRows.map(p=>({price_id:p.price_id,product_id:p.product_id,binding_hash:p.binding_hash,lineage_run_id:p.lineage_run_id,lineage_source_key:p.lineage_source_key}))});
 const context=productCompletionContext({...plan,productCount:productRows.length,priceCount:priceRows.length,bindingsHash});
 const receipt={schemaVersion:'melisa-product-completion-receipt.v1',runId:plan.runId,planHash:plan.planHash,sourceHash:plan.sourceHash,actualT1:false,previousVersionHash:context.previousVersionHash,context,applied:appliedGroups.map(g=>({sourceKey:g.sourceKey,nativeId:String(nativeProductsByKey.get(sourceNativeKey(g.source))[0].id)})),deferred:[...plan.deferred,...deferred],effects,bindingsHash};
 record('product_completion_receipt','receipt',receipt);
 return {products:productRows,prices:priceRows,newRecords,ancestryRecords:plan.previousVersion.records,bindingsHash,context,receipt};
}
