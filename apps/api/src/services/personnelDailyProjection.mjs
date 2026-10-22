const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value??{},key)).map(key=>[key,value[key]]));
const list=(value,project)=>Array.isArray(value)?value.map(project):[];
const restricted=(flow,actor)=>['count','count-cancel','purchase','return-cancel'].includes(flow)&&!actor?.permissions?.includes('finance.view');
const line=value=>pick(value,['id','productId','stockCode','productName','sourceItemId','quantity','physical','system','reason','unit','barcode','movementFingerprint','stockBefore','stockAfter']);
function payload(value){
 const out=pick(value,['requestId','kind','sourceInvoiceId','documentDate','quantity','system','physical','reason','date','unit','warehouse','movementFingerprint','expectedStock','goodsId','invoicedQuantity','invoiceId']);
 if(Array.isArray(value?.lines))out.lines=list(value.lines,line);
 if(Array.isArray(value?.items))out.items=list(value.items,line);
 if(Array.isArray(value?.unknownScans))out.unknownScans=list(value.unknownScans,row=>pick(row,['value','quantity','status']));
 if(Array.isArray(value?.fingerprint))out.fingerprint=list(value.fingerprint,row=>pick(row,['id','quantity_net','source_type','source_id']));
 return out;
}
function plan(value){
 if(!value)return null;
 return {...pick(value,['kind','sourceInvoiceId','sourceDocumentNo','partyId','partyName','documentDate','reason','documentCurrency','previewHash','requestId']),items:list(value.items,line)};
}
function result(value){
 if(!value)return null;
 const out=pick(value,['id','state','status','kind','stockAfter','quantity','replayed','alreadyApplied','requestId','sourceInvoiceId','sourceItemId','goodsId','nativeId','stockMovementId','stock_movement_id','reversal_stock_movement_id','reason']);
 if(value.payload)out.payload=payload(value.payload);
 if(Object.hasOwn(value,'plan'))out.plan=plan(value.plan);
 if(value.result)out.result=result(value.result);
 if(value.reversal)out.reversal=result(value.reversal);
 if(Array.isArray(value.lines))out.lines=value.lines.map(row=>({...line(row),...pick(row,['difference','movementCreated','movementId'])}));
 return out;
}
const invoice=value=>value?pick(value,['id','document_no','status','document_currency']):null;
const sourceItem=value=>pick(value,['id','product_id','stock_code','product_name','unit','barcode','current_stock_qty','quantity','returnedQuantity','pendingQuantity','returnableQuantity','movementFingerprint']);
// Costs remain in the server's immutable calculation/journal; neither GET nor
// mutation/replay transport may expose them to non-finance personnel.
export function projectPersonnelDailyContext(flow,actor,data) {
  if(!restricted(flow,actor))return data;
  return {
    scope:pick(data.scope,['flow','product_id','stock_code','product_name','unit','current_stock_qty','source_id','source_kind','supplier_id','customer_id']),
    drafts:data.drafts.map(row=>({
      ...pick(row,['id','flow','kind','state','created_by','created_at','decided_by','reason']),
      payload_json:JSON.stringify(payload(JSON.parse(row.payload_json))),
      plan_json:flow.startsWith('count')?null:row.plan_json?JSON.stringify(plan(JSON.parse(row.plan_json))):null,
      result_json:row.result_json?JSON.stringify(result(JSON.parse(row.result_json))):null,
    })),
    countProducts:data.countProducts.map(row=>pick(row,['id','stockCode','name','unit','stockQuantityExact3','stockQuantity','barcode','movementFingerprint'])),
    accounts:[],party:data.party?pick(data.party,['id','code','name','currency_code']):null,
    source:flow.startsWith('count')?null:invoice(data.source),
    items:flow.startsWith('count')?[]:list(data.items,sourceItem),
    availablePurchaseSources:flow.startsWith('count')?[]:list(data.availablePurchaseSources,value=>({...invoice(value),...pick(value,['supplierId','supplierName','supplierCurrency']),items:list(value.items,sourceItem)})),
    movementFingerprint:data.movementFingerprint,
  };
}
export function projectPersonnelDailyResponse(flow,actor,data){return restricted(flow,actor)?result(data):data;}
