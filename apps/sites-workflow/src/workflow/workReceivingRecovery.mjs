const approval=/^\/api\/work-receiving\/receipts\/([1-9]\d*)\/approve$/;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const fail=()=>{throw Error('Önceki kabul sonucu doğrulanamadı. Kayıt korunuyor.');};

// Only the existing one-field approval request is recoverable here. Other
// operations retain their own protocol; no POST or new UUID is produced.
export function isReceivingApprovalRecovery(pending,context){
 return isReceivingApprovalReadPath(pending,context)&&context.capabilities?.canApprove===true&&pending.body&&Object.keys(pending.body).length===1&&uuid(pending.body.requestId);
}
export function isReceivingApprovalReadPath(pending,context){return context?.meta?.scopeKind==='VERIFIED_BUSINESS_TEST'&&context.meta.operationOrigin==='ISOLATED_TEST_COPY'&&pending?.status==='pending'&&approval.test(pending.path);}
export function receivingApprovalReadback(pending,record,context){
 if(!isReceivingApprovalRecovery(pending,context))fail();
 const id=approval.exec(pending.path)[1],raw=record?.response;
 if(record?.requestId?.toLowerCase()!==pending.body.requestId.toLowerCase()||record.operation!=='goods_accept'||String(raw?.id)!==id||raw.state!=='accepted'||String(raw.supplierId)!==context.scope.supplier.id||raw.currency!==context.scope.supplier.currency||String(raw.warehouseId)!==context.scope.warehouse.id||raw.replayed!==false||!Array.isArray(raw.lines))fail();
 const receipt=context.receipts.find(value=>value.id===id);
 if(!receipt||receipt.state!=='accepted'||receipt.supplierId!==context.scope.supplier.id||receipt.warehouseId!==context.scope.warehouse.id||!receipt.lines.length||receipt.lines.length>2||raw.lines.length!==receipt.lines.length||new Set(raw.lines.map(line=>String(line.id))).size!==raw.lines.length)fail();
 for(const line of receipt.lines){
  const prior=raw.lines.find(value=>String(value.id)===line.id);
  if(!prior||String(prior.productId)!==line.productId||prior.clientLineId!==line.clientLineId||prior.stockCode!==line.stockCode||prior.unit!=='ADET'||line.unit?.label!=='ADET'||line.unit.factorExact8!=='1.00000000'||!/^([1-5])\.000$/.test(line.quantityExact3)||prior.quantity!==Number(line.quantityExact3)||prior.receivedQuantity!==prior.quantity)fail();
 }
 return {requestId:pending.body.requestId,receipt:structuredClone(receipt),replayed:false,recoveredReadOnly:true};
}
