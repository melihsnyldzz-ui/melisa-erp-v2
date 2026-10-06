const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value??{},key)).map(key=>[key,value[key]]));
const countPayload=value=>pick(value,['quantity','system','physical','reason','date','unit','warehouse','movementFingerprint','lines','unknownScans']);
// Cost is needed internally for adjustments; personnel counting never receives it.
export function projectPersonnelDailyContext(flow,actor,data) {
  if(flow!=='count'||actor?.permissions?.includes('stock.adjust')||actor?.permissions?.includes('finance.view'))return data;
  return {
    scope:pick(data.scope,['flow','product_id','stock_code','product_name','unit','current_stock_qty']),
    drafts:data.drafts.map(row=>({
      ...pick(row,['id','flow','kind','state','created_by','created_at','decided_by','reason']),
      payload_json:JSON.stringify(countPayload(JSON.parse(row.payload_json))),plan_json:null,
      result_json:row.result_json?JSON.stringify(pick(JSON.parse(row.result_json),['id','stockAfter','quantity','replayed','alreadyApplied'])):null,
    })),
    countProducts:data.countProducts.map(row=>pick(row,['id','stockCode','name','unit','stockQuantityExact3','stockQuantity','barcode','movementFingerprint'])),
    accounts:[],party:data.party?pick(data.party,['id','code','name']):null,source:null,items:[],availablePurchaseSources:[],
    movementFingerprint:data.movementFingerprint,
  };
}
