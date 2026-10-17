// SQL context is the source of invoice identity, prices and reserved return quantities.
export function purchaseReturnSources(data){
 return (data.availablePurchaseSources||[]).map(p=>({id:String(p.id),number:p.document_no,supplier:p.supplierName,currency:p.document_currency,balance:Number(p.supplierBalance)*100,balanceCurrency:p.supplierCurrency,items:p.items.map(l=>({id:String(l.id),code:l.stock_code,name:l.product_name,qty:Number(l.quantity),priceCents:Number(l.line_total)*100/Number(l.quantity),returnableQuantity:Number(l.returnableQuantity),pendingQuantity:Number(l.pendingQuantity),returnedQuantity:Number(l.returnedQuantity),stock:Number(l.current_stock_qty)}))}));
}
export function invoiceReturnRow(r,data,purchases){
 const item=r.payload.items?.[0],purchaseId=String(r.payload.sourceInvoiceId??data.scope.source_id),p=purchases.find(p=>p.id===purchaseId),line=p?.items.find(l=>l.id===String(item?.sourceItemId)),planned=r.plan?.items?.[0];
 return {id:r.id,kind:r.kind==='uninvoiced'?'uninvoiced':undefined,goodsId:r.payload.goodsId?String(r.payload.goodsId):null,purchaseId:r.kind==='invoice-return'?purchaseId:null,sourceItemId:item?.sourceItemId,purchaseNumber:r.plan?.sourceDocumentNo||p?.number,code:planned?.stockCode||line?.code||data.scope.stock_code,supplier:r.plan?.partyName||p?.supplier||data.party?.name,qty:r.payload.quantity??item?.quantity,reason:r.payload.reason,state:r.state,currency:r.plan?.documentCurrency||p?.currency||'TRY',amount:Number(r.plan?.amount||0)*100,stock:line?.stock,decidedBy:r.state==='cancelled'?'Ters kayıtla iptal':r.decided_by?'İlker TEST':'',index:0};
}
export const purchaseReturnSelectionKey=userId=>`melisa-test-return-source:${userId}`;
export function approvedPurchaseReturnCents(data,invoiceId){
 return (data?.drafts||[]).filter(r=>r.kind==='invoice-return'&&r.state==='approved').reduce((sum,r)=>{const payload=JSON.parse(r.payload_json),plan=JSON.parse(r.plan_json);return sum+(String(payload.sourceInvoiceId)===String(invoiceId)?Number(plan.amount)*100:0)},0);
}
