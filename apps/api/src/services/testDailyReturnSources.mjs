const fail=(message,statusCode=403)=>{throw Object.assign(new Error(message),{code:'TEST_RETURN_SOURCE',statusCode})};
function id(value){
 if(!/^[1-9]\d*$/.test(String(value??''))||!Number.isSafeInteger(Number(value)))fail('Geçerli kaynak fatura ve satır kimliği gerekli.',400);
 return Number(value);
}

// Scope is supplied by server-owned invoice/link queries, never by the request.
export function resolveDailyReturnSource(sources,input,defaultInvoiceId,{allowCancelled=false}={}){
 const invoiceId=id(input.sourceInvoiceId??defaultInvoiceId);
 const source=sources.find(s=>Number(s.id)===invoiceId);
 if(!source||(!allowCancelled&&source.status!=='finalized'))fail('İade kaynağı kesinleşmiş izinli TEST faturası olmalıdır.');
 const itemId=id(input.sourceItemId??(input.sourceInvoiceId==null?source.items[0]?.id:null));
 const item=source.items.find(i=>Number(i.id)===itemId);
 if(!item)fail('Seçilen satır izinli kaynak faturaya ait değil.');
 return {source,item};
}

export function pendingDailyReturnQuantity(drafts,invoiceId,itemId){
 return drafts.filter(d=>d.kind==='invoice-return'&&d.state==='pending').reduce((total,d)=>{
  const payload=d.payload??JSON.parse(d.payload_json);
  if(Number(payload.sourceInvoiceId)!==Number(invoiceId))return total;
  return total+(payload.items||[]).filter(i=>Number(i.sourceItemId)===Number(itemId)).reduce((n,i)=>n+Number(i.quantity),0);
 },0);
}

export function purchaseSourcesFromRows(rows,drafts){
 const sources=new Map();
 for(const r of rows){
  let source=sources.get(Number(r.id));
  if(!source){source={id:Number(r.id),document_no:r.document_no,status:r.status,document_currency:r.document_currency,grand_total:Number(r.grand_total),supplierId:Number(r.supplier_id),supplierName:r.supplier_name,supplierBalance:Number(r.supplier_balance),supplierCurrency:r.supplier_currency,items:[]};sources.set(source.id,source)}
  const pendingQuantity=pendingDailyReturnQuantity(drafts,source.id,r.item_id),returnedQuantity=Number(r.returned_quantity||0);
  source.items.push({id:Number(r.item_id),product_id:Number(r.product_id),stock_code:r.stock_code,product_name:r.product_name,current_stock_qty:Number(r.current_stock_qty),quantity:Number(r.quantity),line_total:Number(r.line_total),returnedQuantity,pendingQuantity,returnableQuantity:Math.max(0,Number(r.quantity)-returnedQuantity-pendingQuantity)});
 }
 return [...sources.values()];
}
